import * as dotenv from "dotenv";
import pg from "pg";

// Load environment variables first
dotenv.config();

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL must be set. Did you forget to provision a database?");
  process.exit(1);
}

async function dropColumn() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    const client = await pool.connect();
    console.log("Dropping gst_hst_paid column from expenses table...");
    
    await client.query('ALTER TABLE expenses DROP COLUMN IF EXISTS gst_hst_paid');
    
    console.log("✓ Successfully dropped gst_hst_paid column (if it existed)");
    
    client.release();
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("Error dropping column:", error);
    await pool.end();
    process.exit(1);
  }
}

dropColumn();

