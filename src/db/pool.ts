import pg from "pg";
import { loadEnv } from "../config/env.js";

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (pool) return pool;
  const env = loadEnv();
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
  });
  return pool;
}

export function resetPoolForTests(): void {
  if (pool) {
    void pool.end();
    pool = null;
  }
}
