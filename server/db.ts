import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Log database connection info (without sensitive data)
const dbUrl = process.env.DATABASE_URL;
const dbInfo = dbUrl ? new URL(dbUrl) : null;
console.log("[DB] Connecting to database:", dbInfo ? `${dbInfo.protocol}//${dbInfo.hostname}:${dbInfo.port || 'default'}/${dbInfo.pathname.split('/').pop()}` : "unknown");

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  // Add connection error handling
  connectionTimeoutMillis: 5000,
});

// Test the connection on startup
(async () => {
  try {
    const client = await pool.connect();
    console.log('[DB] Database connection test successful');
    client.release();
  } catch (err) {
    console.error('[DB] Database connection test failed:', err);
    console.error('[DB] Please check:');
    console.error('[DB] 1. DATABASE_URL is correct in .env file');
    console.error('[DB] 2. Database server is running');
    console.error('[DB] 3. Database credentials are correct');
    console.error('[DB] 4. Database exists and is accessible');
    // Don't throw - let the app start and show errors on first use
  }
})();

// Handle pool errors
pool.on('error', (err) => {
  console.error('[DB] Unexpected database pool error:', err);
});

pool.on('connect', () => {
  console.log('[DB] New database connection established');
});

export const db = drizzle(pool, { schema });
