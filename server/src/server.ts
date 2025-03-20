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

    // Register static files plugin
    await server.register(fastifyStatic, {
      root: path.join(process.cwd(), 'public'),
      prefix: '/public/',
      decorateReply: true
    });

    // Route for monitoring page - Register BEFORE the JWT hook
    server.get('/monitor', async (request, reply) => {
      // Send the file directly from the public directory
      return reply.sendFile('monitor.html');
    });

    // Skip JWT verification for monitor and other public routes
    // Using preHandler to disable JWT requirement
    server.addHook('preHandler', (request, reply, done) => {
      const url = request.url;
      server.log.debug(`Processing request for URL: ${url}`);
      
      // Set a flag on public routes to skip JWT verification
      if (
        url === '/login' ||
        url === '/register' ||
        url.startsWith('/monitor') ||
        url === '/health' ||
        url === '/'
      ) {
        request.isPublicRoute = true;
        server.log.debug('Marked as public route, skipping JWT verification');
      }
      
      done();
    });

    // JWT verification hook for protected routes
    server.addHook('onRequest', async (request, reply) => {
      // Check our custom flag instead of URL matching
      if (request.isPublicRoute) {
        server.log.debug('Public route detected, skipping JWT verification');
        return;
      }
      
      // Alternative check directly with URL
      const url = request.url;
      if (
        url === '/login' ||
        url === '/register' ||
        url.startsWith('/monitor') ||
        url === '/health' ||
        url === '/'
      ) {
        server.log.debug(`Public URL detected (${url}), skipping JWT verification`);
        return;
      }

      try {
        server.log.debug('Attempting JWT verification');
        await request.jwtVerify();
      } catch (err) {
        server.log.error('JWT verification failed');
        reply.send(err);
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