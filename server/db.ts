import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const sslConfig = process.env.NODE_ENV === "production"
  ? { rejectUnauthorized: false } // For Supabase/Render PostgreSQL
  : { rejectUnauthorized: false }; // Keep dev simple too

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig,
});
export const db = drizzle(pool, { schema });
