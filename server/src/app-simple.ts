import fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyCors from '@fastify/cors';
import fastifyRedis from '@fastify/redis';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from './config';
import { sql } from 'drizzle-orm';
import { characters, users } from './db/schema';
import { eq } from 'drizzle-orm';
import argon2 from 'argon2';

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

// Define type for JWT user
interface JwtUser {
  id: number;
}

console.log('Starting Alternate Earth MMO Server (Multiplayer Edition)...');
console.log(`Environment: ${config.environment}`);
console.log(`Port: ${config.port}`);

const app = fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  },
});

// Register plugins
app.log.info('Initializing CORS...');
app.register(fastifyCors, {
  origin: config.corsOrigins,
  credentials: true,
});

app.log.info('Initializing JWT...');
app.register(fastifyJwt, {
  secret: config.jwtSecret,
});

// Initialize Redis (for player sessions and real-time data)
app.log.info('Initializing Redis...');
app.register(fastifyRedis, {
  url: config.redisUrl,
  closeClient: true
});

// Setup database connection
app.log.info(`Connecting to database at ${config.databaseUrl.replace(/:[^:]*@/, ':***@')}`);
const queryClient = postgres(config.databaseUrl);
export const db = drizzle(queryClient);
app.log.info('Database connection established');

// Active players storage
const activePlayers = new Map();

// Setup authentication routes
app.post('/auth/register', async (request, reply) => {
  const { username, email, password } = request.body as RegisterRequest;
  
  try {
    // Check if user already exists
    const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
    if (existingUser.length > 0) {
      return reply.code(400).send({ error: 'User already exists' });
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
    const token = app.jwt.sign({ id: user.id });
    
    return { token, user };
  } catch (error) {
    app.log.error(error);
    return reply.code(500).send({ error: 'Registration failed' });
  }
});

app.post('/auth/login', async (request, reply) => {
  const { email, password } = request.body as LoginRequest;
  
  try {
    // Find user
    const user = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
    if (user.length === 0) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }
    
    // Verify password with Argon2
    const validPassword = await argon2.verify(user[0].passwordHash, password);
    if (!validPassword) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }
    
    // Update last login
    await db.update(users)
      .set({ lastLogin: new Date(), isOnline: true })
      .where(eq(users.id, user[0].id));
    
    // Generate token
    const token = app.jwt.sign({ id: user[0].id });
    
    return {
      token,
      user: {
        id: user[0].id,
        username: user[0].username,
      },
    };
  } catch (error) {
    app.log.error(error);
    return reply.code(500).send({ error: 'Login failed' });
  }
});

// Protected routes - require authentication
app.register(async (protectedApp) => {
  protectedApp.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  // Character routes
  protectedApp.get('/characters', async (request) => {
    const userId = (request.user as JwtUser).id;
    
    return db.select().from(characters).where(eq(characters.userId, userId));
  });
  
  protectedApp.post('/characters', async (request, reply) => {
    const userId = (request.user as JwtUser).id;
    const { name } = request.body as CharacterRequest;
    
    try {
      // Create character
      const [character] = await db.insert(characters).values({
        userId,
        name,
        // Default starting position in the game world
        position: { x: 0, y: 0, z: 0 },
      }).returning();
      
      return character;
    } catch (error) {
      app.log.error(error);
      return reply.code(500).send({ error: 'Failed to create character' });
    }
  });
  
  // Game world routes
  protectedApp.post('/game/enter', async (request, reply) => {
    const userId = (request.user as JwtUser).id;
    const { characterId } = request.body as GameEnterRequest;
    
    try {
      // Verify character belongs to user
      const character = await db.select().from(characters)
        .where(eq(characters.id, characterId))
        .where(eq(characters.userId, userId))
        .limit(1);
      
      if (character.length === 0) {
        return reply.code(404).send({ error: 'Character not found' });
      }
      
      // Mark character as active
      const sessionId = `player:${characterId}`;
      await app.redis.set(sessionId, JSON.stringify({
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
      
      app.log.info(`Player ${character[0].name} (ID: ${characterId}) entered the game`);
      app.log.info(`Active players: ${activePlayers.size}`);
      
      return { 
        success: true, 
        message: 'Entered game world',
        activePlayerCount: activePlayers.size
      };
    } catch (error) {
      app.log.error(error);
      return reply.code(500).send({ error: 'Failed to enter game' });
    }
  });
  
  protectedApp.post('/game/position', async (request, reply) => {
    const userId = (request.user as JwtUser).id;
    const { characterId, position } = request.body as GamePositionRequest;
    
    try {
      // Verify character belongs to user
      const character = await db.select().from(characters)
        .where(eq(characters.id, characterId))
        .where(eq(characters.userId, userId))
        .limit(1);
      
      if (character.length === 0) {
        return reply.code(404).send({ error: 'Character not found' });
      }
      
      // Update position in database
      await db.update(characters)
        .set({ position, lastSaved: new Date() })
        .where(eq(characters.id, characterId));
      
      // Update active player
      if (activePlayers.has(characterId)) {
        const player = activePlayers.get(characterId);
        player.position = position;
        player.lastUpdated = Date.now();
        activePlayers.set(characterId, player);
      }
      
      // Publish position update to Redis
      await app.redis.publish('player:updates', JSON.stringify({
        type: 'move',
        characterId,
        position,
      }));
      
      return { success: true };
    } catch (error) {
      app.log.error(error);
      return reply.code(500).send({ error: 'Failed to update position' });
    }
  });
  
  protectedApp.get('/game/nearby', async (request) => {
    const { characterId, radius = 100 } = request.query as NearbyQuery;
    
    try {
      if (!activePlayers.has(Number(characterId))) {
        return { players: [] };
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
      
      return { players: nearbyPlayers };
    } catch (error) {
      app.log.error(error);
      return { players: [] };
    }
  });

  protectedApp.post('/game/exit', async (request, reply) => {
    const userId = (request.user as JwtUser).id;
    const { characterId } = request.body as GameExitRequest;
    
    try {
      // Remove from active players
      if (activePlayers.has(characterId)) {
        activePlayers.delete(characterId);
        app.log.info(`Player (ID: ${characterId}) exited the game`);
        app.log.info(`Active players: ${activePlayers.size}`);
      }
      
      // Remove from Redis
      const sessionId = `player:${characterId}`;
      await app.redis.del(sessionId);
      
      await db.update(users)
        .set({ isOnline: false })
        .where(eq(users.id, userId));
      
      return { success: true };
    } catch (error) {
      app.log.error(error);
      return reply.code(500).send({ error: 'Failed to exit game' });
    }
  });
});

// Helper function to calculate distance between positions
interface Position {
  x: number;
  y: number;
  z: number;
}

function calculateDistance(pos1: Position, pos2: Position) {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  const dz = pos1.z - pos2.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Setup health check route
app.get('/health', async () => {
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
    await queryClient`SELECT 1`;
    status.services.database = 'ok';
  } catch (error) {
    app.log.error('Database health check failed', error);
    status.services.database = 'error';
    status.status = 'degraded';
  }

  try {
    // Check Redis connection
    await app.redis.ping();
    status.services.redis = 'ok';
  } catch (error) {
    app.log.error('Redis health check failed', error);
    status.services.redis = 'error';
    status.status = 'degraded';
  }

  return status;
});

// Global error handler
app.setErrorHandler((error, request, reply) => {
  app.log.error({ err: error, path: request.url }, 'Server error');
  reply.status(500).send({ error: 'Internal Server Error' });
});

// Cleanup function for graceful shutdown
async function cleanup() {
  app.log.info('Saving player data before shutdown...');
  
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
  app.log.info(`Saved ${updates.length} player positions`);
}

// Start the server
const start = async () => {
  try {
    app.log.info('Server ready, listening for connections...');
    await app.listen({ port: config.port, host: '0.0.0.0' });
    app.log.info(`Server running at http://localhost:${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

process.on('SIGINT', async () => {
  app.log.info('Shutting down server...');
  await cleanup();
  await app.close();
  app.log.info('Server shutdown complete');
  process.exit(0);
});

start(); 