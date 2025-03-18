import 'dotenv/config';
import { z } from 'zod';

const configSchema = z.object({
  port: z.coerce.number().default(3000),
  databaseUrl: z.string(),
  redisUrl: z.string().default('redis://localhost:6379'),
  jwtSecret: z.string(),
  corsOrigins: z.string().default('*'),
  environment: z.enum(['development', 'production', 'test']).default('development'),
});

export const config = configSchema.parse({
  port: process.env.PORT,
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  jwtSecret: process.env.JWT_SECRET,
  corsOrigins: process.env.CORS_ORIGINS,
  environment: process.env.NODE_ENV,
}); 