# Express to Fastify Migration Guide

## Overview

This project has been migrated from Express to Fastify for improved performance, better TypeScript support, and schema validation capabilities. The Express implementation has been completely removed, and we now exclusively use Fastify.

## Key Changes

1. **Server Implementation**:
   - Fastify implementation: `src/server.ts`
   - Entry point: `src/index.ts`

2. **Route Handling**:
   - Routes use Fastify's plugin system with prefixes
   - Authentication is handled via Fastify hooks and JWT plugin
   - Route handlers use Fastify's request/reply interfaces

3. **Plugins**:
   - Fastify uses a plugin system for features like:
     - `@fastify/cors` for CORS support
     - `@fastify/jwt` for authentication
     - `@fastify/redis` for Redis connection
     - `@fastify/static` for serving static files
     - `@fastify/websocket` for WebSocket support

4. **TypeScript Support**:
   - Custom type definitions in `src/types/fastify.d.ts`
   - Better request/response typing

## Benefits of Fastify

1. **Performance**: Fastify is significantly faster than Express
2. **Schema Validation**: Built-in JSON Schema validation using the TypeBox integration
3. **TypeScript Support**: First-class TypeScript support
4. **Plugin System**: More organized codebase with the plugin architecture
5. **Middleware**: Hooks provide a more structured approach to middleware

## Additional Notes

- Socket.io is used for real-time communication
- The database connection is managed through Drizzle ORM
- Redis is used for caching and real-time event propagation 