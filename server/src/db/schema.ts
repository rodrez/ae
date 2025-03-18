import { pgTable, serial, text, timestamp, integer, jsonb, boolean, doublePrecision } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastLogin: timestamp('last_login'),
  isOnline: boolean('is_online').default(false),
});

export const characters = pgTable('characters', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  name: text('name').notNull(),
  level: integer('level').default(1),
  experience: integer('experience').default(0),
  health: integer('health').default(100),
  mana: integer('mana').default(100),
  inventory: jsonb('inventory').$type<{ items: any[] }>().default({ items: [] }),
  position: jsonb('position').$type<{ x: number, y: number, z: number }>(),
  lastSaved: timestamp('last_saved').defaultNow(),
});

export const gameObjects = pgTable('game_objects', {
  id: serial('id').primaryKey(),
  type: text('type').notNull(), // 'monster', 'resource', 'dungeon', etc.
  name: text('name').notNull(),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  properties: jsonb('properties').default({}),
  respawnTime: timestamp('respawn_time'),
  isActive: boolean('is_active').default(true),
});

export const instances = pgTable('instances', {
  id: serial('id').primaryKey(),
  type: text('type').notNull(), // 'dungeon', 'raid', etc.
  state: jsonb('state').default({}),
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at'),
  maxPlayers: integer('max_players'),
  currentPlayers: integer('current_players').default(0),
});

export const instancePlayers = pgTable('instance_players', {
  id: serial('id').primaryKey(),
  instanceId: integer('instance_id').references(() => instances.id),
  characterId: integer('character_id').references(() => characters.id),
  joinedAt: timestamp('joined_at').defaultNow(),
  leftAt: timestamp('left_at'),
}); 