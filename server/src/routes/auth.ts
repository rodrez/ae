import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import argon2 from 'argon2';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

const registerSchema = z.object({
  username: z.string().min(3).max(30),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', async (request, reply) => {
    try {
      const { username, email, password } = registerSchema.parse(request.body);

      // Check if user already exists
      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, email),
      });

      if (existingUser) {
        return reply.code(400).send({ error: 'User already exists' });
      }

      // Hash password with Argon2
      const passwordHash = await argon2.hash(password);

      // Create user
      const [user] = await db.insert(users).values({
        username,
        email,
        passwordHash,
      }).returning({ id: users.id, username: users.username });

      // Generate token
      const token = app.jwt.sign({ id: user.id });

      return { token, user };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: error.errors });
      }
      throw error;
    }
  });

  app.post('/login', async (request, reply) => {
    try {
      const { email, password } = loginSchema.parse(request.body);

      // Find user
      const user = await db.query.users.findFirst({
        where: eq(users.email, email),
      });

      if (!user) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      // Verify password with Argon2
      const validPassword = await argon2.verify(user.passwordHash, password);
      if (!validPassword) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      // Update last login
      await db.update(users)
        .set({ lastLogin: new Date(), isOnline: true })
        .where(eq(users.id, user.id));

      // Generate token
      const token = app.jwt.sign({ id: user.id });

      return {
        token,
        user: {
          id: user.id,
          username: user.username,
        },
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: error.errors });
      }
      throw error;
    }
  });

  app.post('/logout', async (request, reply) => {
    try {
      const userId = request.user.id;
      await db.update(users)
        .set({ isOnline: false })
        .where(eq(users.id, userId));

      return { success: true };
    } catch (error) {
      throw error;
    }
  });
} 