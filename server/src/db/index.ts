import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { config } from "../config";

// Create a PostgreSQL connection pool
const pool = new Pool({
  connectionString: config.databaseUrl
});

// Create and export the drizzle db instance
export const db = drizzle(pool);
export const queryClient = pool;
