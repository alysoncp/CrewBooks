import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

// Use pooler for migrations
const databaseUrl = process.env.DATABASE_URL_POOLER;

if (!databaseUrl) {
  throw new Error("DATABASE_URL_POOLER must be set for migrations");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
    // For Supabase pooler connections, we need to accept self-signed certs
    ssl: {
      rejectUnauthorized: false,
    },
  },
});