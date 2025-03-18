import type { FastifyInstance } from "fastify";
import { authRoutes } from "./auth";
import { characterRoutes } from "./character";
import { worldRoutes } from "./world";
import { db } from "../app";
import { sql } from "drizzle-orm";

export async function setupRoutes(app: FastifyInstance) {
	// Enhanced health check route
	app.get("/health", async () => {
		const status = {
			status: "ok",
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
			memory: process.memoryUsage(),
			services: {
				database: "unknown",
				redis: "unknown"
			}
		};

		try {
			// Check database connection
			await db.execute(sql`SELECT 1`);
			status.services.database = "ok";
		} catch (error) {
			app.log.error("Database health check failed", error);
			status.services.database = "error";
			status.status = "degraded";
		}

		try {
			// Check Redis connection
			await app.redis.ping();
			status.services.redis = "ok";
		} catch (error) {
			app.log.error("Redis health check failed", error);
			status.services.redis = "error";
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
			await request.jwtVerify();
		} catch (err) {
			reply.code(401).send({ error: "Unauthorized" });
		}
	});
}
