import type { FastifyInstance } from "fastify";
import { db } from "../db";
import { characters } from "../db/schema";
import { eq } from "drizzle-orm";

export async function characterRoutes(app: FastifyInstance) {
  app.get("/", async (request) => {
    const userId = request.user.id;
    return db.query.characters.findMany({
      where: eq(characters.userId, userId)
    });
  });
} 