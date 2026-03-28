import { loadEnv } from "../config/env.js";
import { getPool } from "../db/pool.js";
import type pg from "pg";

export function getPortalPool(): pg.Pool | null {
  const env = loadEnv();
  if (!env.DATABASE_URL) return null;
  return getPool();
}
