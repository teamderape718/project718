import "dotenv/config";
import pg from "pg";
import { loadEnv } from "../config/env.js";
import { runMigrations } from "./migrate.js";

async function main() {
  const env = loadEnv();
  if (!env.DATABASE_URL) {
    console.error("DATABASE_URL is required for migrations.");
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await runMigrations(client);
    console.log("Migrations applied.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
