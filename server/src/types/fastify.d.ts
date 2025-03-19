import 'fastify';
import type { Redis } from 'ioredis';
import type { JwtPayload } from 'jsonwebtoken';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
    config: {
      port: number;
      databaseUrl: string;
      redisUrl: string;
      jwtSecret: string;
      corsOrigins: string | string[];
      environment: 'development' | 'production' | 'test';
      debug: boolean;
    };
  }

  interface FastifyRequest {
    jwtVerify: () => Promise<JwtPayload>;
    user: {
      id: number;
      [key: string]: unknown;
    };
  }
} 