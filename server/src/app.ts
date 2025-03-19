import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import Redis from 'ioredis';
import { sql } from 'drizzle-orm';
import { config } from './config';
import { characters, users } from './db/schema';
import { eq, and } from 'drizzle-orm';
import argon2 from 'argon2';
import { pgTable, serial, text, integer, jsonb, timestamp, boolean } from 'drizzle-orm/pg-core';
import { db, queryClient } from './db';
import { setupSocketHandlers } from './websocket';

// Define types for requests
interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface CharacterRequest {
  name: string;
}

interface GameEnterRequest {
  characterId: number;
}

interface GamePositionRequest {
  characterId: number;
  position: {x: number, y: number, z: number};
}

interface GameExitRequest {
  characterId: number;
}

interface NearbyQuery {
  characterId: string | number;
  radius?: number;
}

// Enhanced CORS settings
interface CorsSettings {
  origin: string | string[];
  credentials: boolean;
  methods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
}

// Define type for JWT user
interface JwtUser {
  id: number;
}

// Helper function to calculate distance between positions
interface Position {
  x: number;
  y: number;
  z: number;
}

function calculateDistance(pos1: Position, pos2: Position): number {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  const dz = pos1.z - pos2.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

console.log('Starting Alternate Earth MMO Server (Multiplayer Edition)...');
console.log(`Environment: ${config.environment}`);
console.log(`Port: ${config.port}`);

// Create Express app
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  },
  pingTimeout: 30000,
  pingInterval: 15000
});

// Setup Redis clients
const redisClient = new Redis({
  host: 'localhost',
  port: 6379,
  username: 'default',
  password: 'redis'
});

const redisPub = new Redis({
  host: 'localhost',
  port: 6379,
  username: 'default',
  password: 'redis'
});

const redisSub = new Redis({
  host: 'localhost',
  port: 6379,
  username: 'default',
  password: 'redis'
});

// Setup logger (simple for now, can be enhanced with morgan/winston)
const logger = {
  info: (...args: any[]) => console.log(new Date().toISOString(), '[INFO]', ...args),
  error: (...args: any[]) => console.error(new Date().toISOString(), '[ERROR]', ...args),
  warn: (...args: any[]) => console.warn(new Date().toISOString(), '[WARN]', ...args),
  debug: (...args: any[]) => {
    if (config.debug) {
      console.debug(new Date().toISOString(), '[DEBUG]', ...args);
    }
  }
};

// Active players storage
const activePlayers = new Map();

// Middleware
app.use(express.json());
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:5173', 'http://127.0.0.1:3001', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Add an additional OPTIONS handler for preflight requests
app.options('*', cors({
  origin: ['http://localhost:3001', 'http://localhost:5173', 'http://127.0.0.1:3001', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

interface RequestWithUser extends express.Request {
  user: JwtUser;
}

// JWT Verification middleware
const verifyToken = (
  req: express.Request, 
  res: express.Response, 
  next: express.NextFunction
) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtUser;
    (req as RequestWithUser).user = decoded;
    next();
  } catch (error) {
    logger.error('JWT verification failed:', error);
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

// =========================================
// AUTH ROUTES
// =========================================
const authRouter = express.Router();

// Register
authRouter.post('/register', async (req: express.Request, res: express.Response) => {
  const { username, email, password } = req.body as RegisterRequest;
  
  try {
    // Check if user already exists
    const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Hash password with Argon2
    const passwordHash = await argon2.hash(password);
    
    // Create user
    const [user] = await db.insert(users).values({
      username,
      email,
      passwordHash,
    }).returning({ id: users.id, username: users.username });
    
    // Generate token
    const token = jwt.sign({ id: user.id }, config.jwtSecret);
    
    return res.json({ token, user });
  } catch (error) {
    logger.error('Registration failed:', error);
    return res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
authRouter.post('/login', async (req: express.Request, res: express.Response) => {
  const { email, password } = req.body as LoginRequest;
  
  try {
    // Find user
    const user = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
    if (user.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Verify password with Argon2
    const validPassword = await argon2.verify(user[0].passwordHash, password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Update last login
    await db.update(users)
      .set({ lastLogin: new Date(), isOnline: true })
      .where(eq(users.id, user[0].id));
    
    // Generate token
    const token = jwt.sign({ id: user[0].id }, config.jwtSecret);
    
    return res.json({
      token,
      user: {
        id: user[0].id,
        username: user[0].username,
      },
    });
  } catch (error) {
    logger.error('Login failed:', error);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// =========================================
// CHARACTER ROUTES
// =========================================
const charactersRouter = express.Router();

// Apply auth middleware
charactersRouter.use(verifyToken);

// Get all characters for current user
charactersRouter.get('/', async (req: express.Request, res: express.Response) => {
  const userId = (req as RequestWithUser).user.id;
  
  try {
    const userCharacters = await db.select().from(characters).where(eq(characters.userId, userId));
    return res.json(userCharacters);
  } catch (error) {
    logger.error('Get characters failed:', error);
    return res.status(500).json({ error: 'Failed to get characters' });
  }
});

// Create a new character
charactersRouter.post('/', async (req: express.Request, res: express.Response) => {
  const userId = (req as RequestWithUser).user.id;
  const { name } = req.body as CharacterRequest;
  
  try {
    // Create character
    const [character] = await db.insert(characters).values({
      userId,
      name,
      // Default starting position in the game world
      position: { x: 0, y: 0, z: 0 },
    }).returning();
    
    return res.json(character);
  } catch (error) {
    logger.error('Character creation failed:', error);
    return res.status(500).json({ error: 'Failed to create character' });
  }
});

// =========================================
// GAME ROUTES
// =========================================
const gameRouter = express.Router();

// Apply auth middleware
gameRouter.use(verifyToken);

// Enter game with a character
gameRouter.post('/enter', async (req: express.Request, res: express.Response) => {
  const userId = (req as RequestWithUser).user.id;
  const { characterId } = req.body as GameEnterRequest;
  
  try {
    // Verify character belongs to user
    const character = await db.select().from(characters)
      .where(and(
        eq(characters.id, characterId),
        eq(characters.userId, userId)
      ))
      .limit(1);
    
    if (character.length === 0) {
      return res.status(404).json({ error: 'Character not found' });
    }
    
    // Mark character as active
    const sessionId = `player:${characterId}`;
    await redisClient.set(sessionId, JSON.stringify({
      characterId,
      userId,
      position: character[0].position,
      lastUpdated: Date.now()
    }));
    
    // Add to active players
    activePlayers.set(characterId, {
      id: characterId,
      name: character[0].name,
      position: character[0].position,
      lastUpdated: Date.now()
    });
    
    logger.info(`Player ${character[0].name} (ID: ${characterId}) entered the game`);
    logger.info(`Active players: ${activePlayers.size}`);
    
    return res.json({ 
      success: true, 
      message: 'Entered game world',
      activePlayerCount: activePlayers.size
    });
  } catch (error) {
    logger.error('Game enter failed:', error);
    return res.status(500).json({ error: 'Failed to enter game' });
  }
});

// Update player position
gameRouter.post('/position', async (req: express.Request, res: express.Response) => {
  const userId = (req as RequestWithUser).user.id;
  const { characterId, position } = req.body as GamePositionRequest;
  
  try {
    // Validate position data
    if (!position || typeof position !== 'object' || 
        typeof position.x !== 'number' || 
        typeof position.y !== 'number') {
      return res.status(400).json({ 
        error: 'Invalid position data',
        details: 'Position must include valid x and y coordinates'
      });
    }
    
    // Ensure z is a number (default to 0 if not provided)
    const validPosition = {
      x: position.x,
      y: position.y,
      z: typeof position.z === 'number' ? position.z : 0
    };
    
    // Verify character belongs to user
    const character = await db.select().from(characters)
      .where(and(
        eq(characters.id, characterId),
        eq(characters.userId, userId)
      ))
      .limit(1);
    
    if (character.length === 0) {
      return res.status(404).json({ error: 'Character not found' });
    }
    
    // Update position in database
    await db.update(characters)
      .set({ position: validPosition, lastSaved: new Date() })
      .where(eq(characters.id, characterId));
    
    // Update active player
    if (activePlayers.has(characterId)) {
      const player = activePlayers.get(characterId);
      player.position = validPosition;
      player.lastUpdated = Date.now();
      activePlayers.set(characterId, player);
    }
    
    // Publish position update to Redis
    await redisPub.publish('player:updates', JSON.stringify({
      type: 'move',
      characterId,
      position: validPosition,
    }));
    
    return res.json({ success: true });
  } catch (error) {
    logger.error('Position update failed:', error);
    return res.status(500).json({ error: 'Failed to update position' });
  }
});

// Get nearby players
gameRouter.get('/nearby', async (req: express.Request, res: express.Response) => {
  const { characterId, radius = 100 } = req.query as unknown as NearbyQuery;
  
  try {
    if (!activePlayers.has(Number(characterId))) {
      return res.json({ players: [] });
    }
    
    const currentPlayer = activePlayers.get(Number(characterId));
    const nearbyPlayers = [];
    
    // Find players within radius
    for (const [id, player] of activePlayers.entries()) {
      // Skip self
      if (id === Number(characterId)) continue;
      
      // Simple distance calculation (can be improved for actual game with spatial indexing)
      const distance = calculateDistance(currentPlayer.position, player.position);
      
      if (distance <= radius) {
        nearbyPlayers.push({
          id: player.id,
          name: player.name,
          position: player.position,
          distance
        });
      }
    }
    
    return res.json({ players: nearbyPlayers });
  } catch (error) {
    logger.error('Nearby query failed:', error);
    return res.json({ players: [] });
  }
});

// Exit game
gameRouter.post('/exit', async (req: express.Request, res: express.Response) => {
  const userId = (req as RequestWithUser).user.id;
  const { characterId } = req.body as GameExitRequest;
  
  try {
    // Remove from active players
    if (activePlayers.has(characterId)) {
      activePlayers.delete(characterId);
      logger.info(`Player (ID: ${characterId}) exited the game`);
      logger.info(`Active players: ${activePlayers.size}`);
    }
    
    // Remove from Redis
    const sessionId = `player:${characterId}`;
    await redisClient.del(sessionId);
    
    await db.update(users)
      .set({ isOnline: false })
      .where(eq(users.id, userId));
    
    return res.json({ success: true });
  } catch (error) {
    logger.error('Game exit failed:', error);
    return res.status(500).json({ error: 'Failed to exit game' });
  }
});

// =========================================
// SYSTEM ROUTES
// =========================================

// Health check route
app.get('/health', async (req, res) => {
  const status = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: 'unknown',
      redis: 'unknown'
    },
    players: {
      active: activePlayers.size
    }
  };

  try {
    // Check database connection
    await queryClient.query('SELECT 1');
    status.services.database = 'ok';
  } catch (error) {
    logger.error('Database health check failed:', error);
    status.services.database = 'error';
    status.status = 'degraded';
  }

  try {
    // Check Redis connection
    await redisClient.ping();
    status.services.redis = 'ok';
  } catch (error) {
    logger.error('Redis health check failed:', error);
    status.services.redis = 'error';
    status.status = 'degraded';
  }

  return res.json(status);
});

// WebSocket diagnostics
app.get('/ws-diagnostics', (req, res) => {
  // Get information about the server's WebSocket setup
  const wsInfo = {
    sockets: {
      connected: io.engine.clientsCount,
      rooms: io.sockets.adapter.rooms.size,
    },
    cors: {
      origins: config.corsOrigins,
    },
    serverInfo: {
      nodeVersion: process.version,
      platform: process.platform,
      uptime: process.uptime(),
    },
    request: {
      headers: req.headers,
      ip: req.ip,
    }
  };
  
  res.json(wsInfo);
});

// WebSocket test endpoint (handled by socket.io)
app.get('/ws-test', (req, res) => {
  res.send('To test WebSockets, connect to this server using Socket.io client');
});

// Register routers with app
app.use('/auth', authRouter);
app.use('/characters', charactersRouter);
app.use('/game', gameRouter);

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error({ err, path: req.url }, 'Server error');
  res.status(500).json({ error: 'Internal Server Error' });
});

// Cleanup function for graceful shutdown
async function cleanup() {
  logger.info('Saving player data before shutdown...');
  
  // Save all active player positions to database
  const updates = [];
  for (const [characterId, player] of activePlayers.entries()) {
    updates.push(
      db.update(characters)
        .set({ position: player.position, lastSaved: new Date() })
        .where(eq(characters.id, characterId))
    );
  }
  
  await Promise.all(updates);
  logger.info(`Saved ${updates.length} player positions`);
  
  // Close Redis connections
  await redisClient.quit();
  await redisPub.quit();
  await redisSub.quit();
}

// Start the server
const start = async () => {
  try {
    // Setup Socket.io handlers
    logger.info('Setting up Socket.io handlers...');
    setupSocketHandlers(io, redisClient, redisPub, redisSub, logger);
    
    // Start listening
    server.listen(config.port, () => {
      logger.info(`Server running at http://localhost:${config.port}`);
      logger.info('Server ready, listening for connections...');
    });
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down server...');
  await cleanup();
  server.close(() => {
    logger.info('Server shutdown complete');
    process.exit(0);
  });
});

start(); 