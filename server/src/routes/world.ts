import type { FastifyInstance } from "fastify";
import { db } from "../app";
import { gameObjects } from "../db/schema";

export async function worldRoutes(app: FastifyInstance) {
  app.get("/objects", async (request) => {
    const { lat, lng, radius } = request.query as { lat: number; lng: number; radius: number };
    // TODO: Implement spatial query for nearby objects
    return db.query.gameObjects.findMany();
  });
} 