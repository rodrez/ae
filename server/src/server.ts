import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyCors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyRedis from '@fastify/redis';
import fastifyStatic from '@fastify/static';
import { Server } from 'socket.io';
import path from 'node:path';
import { setupRoutes } from './routes';
import { config } from './config';
import { setupSocketHandlers } from './websocket';
import { db, queryClient as pool } from './db';

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
      origin: [
        'http://localhost:3001',
        'http://localhost:5173',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:5173',
      ],
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

    // Register WebSocket plugin
    await server.register(fastifyWebsocket);

    // Register static files plugin
    await server.register(fastifyStatic, {
      root: path.join(process.cwd(), 'public'),
    });

    // JWT verification hook for protected routes
    server.addHook('onRequest', async (request, reply) => {
      // Skip JWT verification for public routes
      if (
        request.routeOptions?.url === '/login' ||
        request.routeOptions?.url === '/register' ||
        request.routeOptions?.url === '/monitor' ||
        request.routeOptions?.url === '/health' ||
        request.routeOptions?.url?.startsWith('/public/') ||
        request.routeOptions?.url === '/'
      ) {
        return;
      }

      try {
        await request.jwtVerify();
      } catch (err) {
        reply.send(err);
      }
    });

    // Route for monitoring page
    server.get('/monitor', async (_, reply) => {
      return reply.sendFile('monitor.html');
    });

    // Register all routes
    await setupRoutes(server);

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
    });

    // Setup socket handlers
    setupSocketHandlers(io, server.redis);

    // Start the server
    await server.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`Alternate Earth MMO Server running on 0.0.0.0:${config.port}`);
    console.log(`Environment: ${config.environment}`);

  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

// Start server
start();

// Export server instance (useful for testing)
export { server }; 