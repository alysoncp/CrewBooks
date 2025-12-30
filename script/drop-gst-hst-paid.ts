import * as dotenv from "dotenv";
import pg from "pg";

// Load environment variables first
dotenv.config();

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  process.exit(1);
}

async function dropColumn() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    const client = await pool.connect();
    
    await client.query('ALTER TABLE expenses DROP COLUMN IF EXISTS gst_hst_paid');
    
    client.release();
    await pool.end();
    process.exit(0);
  } catch (error) {
    await pool.end();
    process.exit(1);
  }
}

dropColumn();

