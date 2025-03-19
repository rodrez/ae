# Alternate Earth Server

This is the server component of the Alternate Earth MMO game.

## Fastify Implementation

This project uses Fastify for improved performance, better TypeScript support, and schema validation capabilities. See `MIGRATION.md` for details on the architecture and benefits of using Fastify.

## Environment Setup

### Development Environment

For local development, you have two options:

1. **Docker Compose** (recommended): Run all services in Docker containers.
2. **Local Development**: Run the server directly on your machine, connecting to services.

#### Option 1: Using Docker Compose

Run all services together:

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

#### Option 2: Local Development

1. Make sure PostgreSQL and Redis are running locally or accessible.
2. Copy the appropriate .env file:

```bash
# For connecting to local services
cp .env.local .env

# Or for connecting to Docker containers
cp .env.docker .env
```

3. Install dependencies and run the server:

```bash
pnpm install
pnpm run dev
```

## Environment Files

- `.env`: The active environment file used by the application
- `.env.local`: Configuration for local development (uses localhost)
- `.env.docker`: Configuration for use with Docker containers (uses container names)

## Troubleshooting Connection Issues

### Database Connection

The error "getaddrinfo EAI_AGAIN aepg" means the server can't resolve the hostname "aepg" (the PostgreSQL container name). This happens when:

1. You're running the server directly on your machine (not in Docker)
2. Your .env file is using container names instead of localhost

**Solution**: Use the `.env.local` file which has the correct localhost configuration:

```bash
cp .env.local .env
```

Or modify your `.env` file to use `localhost` instead of `aepg`:

```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/ae
REDIS_URL=redis://:redis@localhost:6379/0
```

### Redis Connection

Similar to database issues, if you see Redis connection errors when running locally, make sure you're using localhost in your configuration:

```
REDIS_URL=redis://:redis@localhost:6379/0
```

### TypeScript Type Errors

You might see TypeScript errors related to FastifyInstance extensions for Redis and JWT. To fix these:

1. Create a custom fastify.d.ts file in the src/types directory:

```typescript
import 'fastify';
import { Redis } from 'ioredis';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
    // Add other extended properties here
  }

  interface FastifyRequest {
    jwtVerify: () => Promise<any>;
    // Add other request extensions here
  }
}
```

2. Update your tsconfig.json to include this type definition file.

## Health Check

The server includes an enhanced health check endpoint at `/health` that reports the status of all services. Use this to verify connections are working properly. 