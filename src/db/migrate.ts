import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { PoolClient } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function readSchemaSql(): string {
  return readFileSync(join(__dirname, "schema.sql"), "utf8");
}

export async function runMigrations(client: PoolClient): Promise<void> {
  await client.query(readSchemaSql());
}
