import { defineConfig } from "drizzle-kit";
import fs from "node:fs";
import path from "node:path";
import * as dotenv from "dotenv";

const ca = fs.readFileSync(path.resolve("certs/supabase-dev-db-ca.crt"), "utf8");
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

console.log("DRIZZLE SSL CA PATH:", path.resolve("certs/supabase-dev-db-ca.crt"));
console.log("DRIZZLE SSL CA LEN:", ca.length);
console.log("DRIZZLE DATABASE_URL HOST:", new URL(process.env.DATABASE_URL!).host);


export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
    ssl: {
      ca,
      rejectUnauthorized: true,
    },
  },
});