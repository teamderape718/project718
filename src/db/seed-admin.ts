import "dotenv/config";
import pg from "pg";
import { loadEnv } from "../config/env.js";
import { hashPassword } from "../portal/password.js";
import { countAdmins, insertAdmin } from "../portal/repo.js";

async function main() {
  const env = loadEnv();
  if (!env.DATABASE_URL) {
    console.error("DATABASE_URL requis.");
    process.exit(1);
  }
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    console.error("ADMIN_EMAIL et ADMIN_PASSWORD requis dans .env");
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
  const c = await pool.connect();
  try {
    const n = await countAdmins(c);
    if (n > 0) {
      console.log("Un admin existe déjà. Utilisez le panneau ou supprimez la ligne en base pour re-seed.");
      return;
    }
    const h = await hashPassword(env.ADMIN_PASSWORD);
    await insertAdmin(c, env.ADMIN_EMAIL, h);
    console.log(`Admin créé : ${env.ADMIN_EMAIL}`);
  } finally {
    c.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
