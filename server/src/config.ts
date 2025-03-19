import 'dotenv/config';
import { z } from 'zod';

// Default CORS origins for development
const DEFAULT_CORS_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3001', 'http://127.0.0.1:3001'];

const configSchema = z.object({
  port: z.coerce.number().default(3000),
  databaseUrl: z.string(),
  redisUrl: z.string().default('redis://localhost:6379'),
  jwtSecret: z.string(),
  corsOrigins: z.union([
    z.string(),
    z.array(z.string())
  ]).default(DEFAULT_CORS_ORIGINS),
  environment: z.enum(['development', 'production', 'test']).default('development'),
  debug: z.boolean().default(false),
});

// Helper function to parse CORS origins from string
function parseCorsOrigins(origins: string | undefined): string | string[] {
  if (!origins) return DEFAULT_CORS_ORIGINS;
  
  // If it's a wildcard, use it directly
  if (origins === '*') return origins;
  
  // If comma separated list, split into array
  if (origins.includes(',')) {
    return origins.split(',').map(o => o.trim());
  }
  
  return origins;
}

export const config = configSchema.parse({
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/altearth',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET || 'your_jwt_secret_key',
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
  environment: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
  debug: process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development'
}); 