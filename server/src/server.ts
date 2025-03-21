import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyRedis from '@fastify/redis';
import fastifyStatic from '@fastify/static';
import { Server } from 'socket.io';
import path from 'node:path';
import { setupRoutes } from './routes';
import { config } from './config';
import { setupSocketHandlers } from './websocket';

// Extend FastifyRequest to include our custom property
declare module 'fastify' {
  interface FastifyRequest {
    isPublicRoute?: boolean;
  }
}

// Create Fastify server
const server = Fastify({
  logger: {
    level: config.debug ? 'debug' : 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  },
});

async function start() {
  try {
    // Register Fastify plugins
    await server.register(fastifyCors, {
      origin: config.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    });

    // Register JWT plugin
    await server.register(fastifyJwt, {
      secret: config.jwtSecret,
    });

    // Parse Redis URL for connection options
    function parseRedisUrl(url: string) {
      try {
        // Parse Redis URL format redis://username:password@host:port/db
        const parsedUrl = new URL(url);
        const password = parsedUrl.password || 'redis';
        const host = parsedUrl.hostname || 'aeredis';
        const port = Number(parsedUrl.port) || 6379;
        const username = parsedUrl.username || 'default';
        
        return { host, port, username, password };
      } catch (error) {
        server.log.error(`Invalid Redis URL: ${url}. Using default connection.`);
        return {
          host: 'aeredis',
          port: 6379,
          username: 'default',
          password: 'redis',
        };
      }
    }

    const redisConfig = parseRedisUrl(config.redisUrl);
    server.log.info(`Connecting to Redis at ${redisConfig.host}:${redisConfig.port}`);

    // Create Redis client instance manually
    const Redis = require('ioredis');
    const redisClient = new Redis(redisConfig);
    
    // Register Redis plugin with pre-created client
    await server.register(fastifyRedis, {
      client: redisClient
    });

    // Register static files plugin with the correct path
    await server.register(fastifyStatic, {
      root: path.join(__dirname, '../public'),
      prefix: '/public/',
      decorateReply: true
    });

    // Register monitor routes BEFORE any other routes or hooks
    // This ensures these routes are not affected by any subsequent hooks
    server.get('/monitor', async (request, reply) => {
      // Use absolute path to ensure we're pointing to the correct file
      const filePath = path.join(__dirname, '../public/monitor.html');
      server.log.debug(`Serving monitor.html from: ${filePath}`);
      return reply.sendFile('monitor.html', path.join(__dirname, '../public'));
    });

    server.get('/monitor.js', async (request, reply) => {
      // Use absolute path to ensure we're pointing to the correct file
      const filePath = path.join(__dirname, '../public/monitor.js');
      server.log.debug(`Serving monitor.js from: ${filePath}`);
      return reply.sendFile('monitor.js', path.join(__dirname, '../public'));
    });

    // Create a list of public routes that don't require authentication
    const publicRoutes = [
      '/login',
      '/register',
      '/favicon.ico',
      '/health',
      '/',
      '/public/*',
      '/socket.io/*'
    ];

    // JWT verification hook with public route exclusions
    server.addHook('onRequest', async (request, reply) => {
      const url = request.url;
      
      // Skip authentication for monitor-related routes
      // Explicitly check for monitor routes first
      if (url === '/monitor' || url === '/monitor.js' || url.startsWith('/socket.io/')) {
        server.log.debug(`Monitor/WebSocket route detected (${url}), skipping JWT verification`);
        return;
      }
      
      // Skip authentication for OPTIONS requests (CORS preflight)
      if (request.method === 'OPTIONS') {
        server.log.debug('CORS preflight request detected, skipping JWT verification');
        return;
      }
      
      // Check if this is a public route
      const isPublic = publicRoutes.some(route => {
        if (route.endsWith('*')) {
          return url.startsWith(route.slice(0, -1));
        }
        return url === route;
      });
      
      if (isPublic) {
        server.log.debug(`Public route detected (${url}), skipping JWT verification`);
        return;
      }
      
      try {
        server.log.debug('Attempting JWT verification');
        await request.jwtVerify();
      } catch (err) {
        server.log.error('JWT verification failed');
        reply.code(401).send({ error: 'Authentication required' });
      }
    });

    // Register all routes
    await setupRoutes(server);

    // Start the server
    await server.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`Alternate Earth MMO Server running on 0.0.0.0:${config.port}`);
    console.log(`Environment: ${config.environment}`);

    // Create HTTP server for socket.io
    const httpServer = server.server;
    
    // Setup Socket.io
    const io = new Server(httpServer, {
      cors: {
        origin: config.corsOrigins,
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
      },
      pingTimeout: 30000,
      pingInterval: 15000,
      // Explicitly set both transports to ensure compatibility
      transports: ['websocket', 'polling'],
      // Add path for clarity
      path: '/socket.io/'
    });

    // Setup socket handlers
    setupSocketHandlers(io, server.redis);

  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

// Start server
start();

// Export server instance (useful for testing)
export { server }; 