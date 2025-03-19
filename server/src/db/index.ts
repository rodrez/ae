import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { config } from "../config";
import * as schema from "./schema";

// Connection retry settings
const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 3000;

// Flag to track database connection status
let isConnected = false;
let connectionAttempts = 0;

// Create a PostgreSQL connection pool with better error handling and logging
const pool = new Pool({
  connectionString: config.databaseUrl,
  // Add a reasonable connection timeout
  connectionTimeoutMillis: 10000,
});

// Setup event listeners for connection issues
pool.on('error', (err) => {
  console.error('Unexpected database error:', err.message);
  isConnected = false;
  
  // Try to reconnect if the connection is lost during operation
  if (err.message.includes('connection terminated') || 
      err.message.includes('connection ended') ||
      err.message.includes('getaddrinfo') ||
      err.message.includes('connect ECONNREFUSED')) {
    attemptReconnect();
  }
});

// Create and export the drizzle db instance
export const db = drizzle(pool, { schema });
export const queryClient = pool;

// Function to test database connection
export async function testConnection(): Promise<boolean> {
  try {
    console.log(`Attempting database connection to: ${config.databaseUrl.replace(/:[^:]*@/, ':****@')}`);
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    
    console.log(`Database connected successfully at ${result.rows[0].now}`);
    isConnected = true;
    connectionAttempts = 0;
    return true;
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`Database connection failed: ${errorMessage}`);
    isConnected = false;
    
    // Check if we should attempt a reconnection
    if (connectionAttempts < MAX_RETRIES) {
      attemptReconnect();
    } else {
      console.error(`Failed to connect to database after ${MAX_RETRIES} attempts. Last error: ${errorMessage}`);
      console.error('Please check your database configuration and ensure the database service is running.');
    }
    
    return false;
  }
}

// Function to attempt reconnection
function attemptReconnect() {
  connectionAttempts++;
  console.log(`Attempting to reconnect to database (${connectionAttempts}/${MAX_RETRIES}) in ${RETRY_DELAY_MS}ms...`);
  
  // Schedule a reconnection attempt after delay
  setTimeout(async () => {
    await testConnection();
  }, RETRY_DELAY_MS);
}

// Initialize connection on startup
testConnection().catch(error => {
  console.error('Initial database connection attempt failed:', error.message);
  console.error('Please check your database configuration and ensure the database service is running.');
});
