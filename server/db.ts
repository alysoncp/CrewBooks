import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import fs from "node:fs";
import path from "node:path";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const caPath = path.resolve("certs/supabase-dev-db-ca.crt");
const sslConfig = fs.existsSync(caPath)
  ? { ca: fs.readFileSync(caPath, "utf8"), rejectUnauthorized: true }
  : { rejectUnauthorized: false };

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig,
});
export const db = drizzle(pool, { schema });
