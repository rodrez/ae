import type { FastifyInstance } from "fastify";
import { authRoutes } from "./auth";
import { characterRoutes } from "./character";
import { worldRoutes } from "./world";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { config } from "../config";

export async function setupRoutes(app: FastifyInstance) {
	// Enhanced health check route
	app.get("/health", async () => {
		const status = {
			status: "ok",
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
			memory: process.memoryUsage(),
			services: {
				database: {
					status: "unknown",
					message: "",
					connectionString: maskConnectionString(config.databaseUrl)
				},
				redis: {
					status: "unknown",
					message: "",
					connectionString: maskConnectionString(config.redisUrl)
				},
				server: {
					status: "ok",
					port: config.port,
					environment: config.environment,
					nodeVersion: process.version
				}
			}
		};

		try {
			// Check database connection
			const startTime = performance.now();
			await db.execute(sql`SELECT 1`);
			const pingTime = Math.round(performance.now() - startTime);
			
			status.services.database.status = "ok";
			status.services.database.message = `Connected (ping: ${pingTime}ms)`;
		} catch (error) {
			app.log.error("Database health check failed", error);
			status.services.database.status = "error";
			status.services.database.message = error instanceof Error ? error.message : String(error);
			status.status = "degraded";
		}

		try {
			// Check Redis connection
			const startTime = performance.now();
			// Use app's redis instance if available
			if (app.redis) {
				await app.redis.ping();
				const pingTime = Math.round(performance.now() - startTime);
				
				status.services.redis.status = "ok";
				status.services.redis.message = `Connected (ping: ${pingTime}ms)`;
			} else {
				status.services.redis.status = "unknown";
				status.services.redis.message = "Redis instance not available";
				status.status = "degraded";
			}
		} catch (error) {
			app.log.error("Redis health check failed", error);
			status.services.redis.status = "error";
			status.services.redis.message = error instanceof Error ? error.message : String(error);
			status.status = "degraded";
		}

		return status;
	});

	// Register route groups
	app.register(authRoutes, { prefix: "/auth" });
	app.register(characterRoutes, { prefix: "/characters" });
	app.register(worldRoutes, { prefix: "/world" });

	// Add authentication to protected routes
	app.addHook("onRequest", async (request, reply) => {
		try {
			if (request.routerPath?.startsWith("/auth") || 
				request.routerPath === "/health") {
				return;
			}
			// Check if jwtVerify is available (depends on FastifyJWT plugin)
			if (typeof request.jwtVerify === 'function') {
				await request.jwtVerify();
			} else {
				app.log.error("JWT verification not available");
				reply.code(500).send({ error: "Server configuration error" });
			}
		} catch (err) {
			reply.code(401).send({ error: "Unauthorized" });
		}
	});
}

// Helper function to mask sensitive information in connection strings
function maskConnectionString(connectionString: string): string {
	try {
		// For database URLs like: postgres://username:password@hostname:port/database
		if (!connectionString) return 'Not configured';
		
		// Create a URL object
		const url = new URL(connectionString);
		
		// Mask the password if present
		if (url.password) {
			url.password = '********';
		}
		
		return url.toString();
	} catch (error) {
		// If parsing fails, return a generic masked string
		return 'Invalid connection string format';
	}
}
