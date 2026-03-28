/**
 * Diagnostic local : pourquoi le site ou le bot ne répondent pas.
 * Usage : npm run doctor  (à la racine du projet, avec .env si tu en as un)
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "../src/config/env.js";
import { getPortalPool } from "../src/portal/db-access.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const webIndex = join(root, "web", "dist", "index.html");

async function main() {
  const env = loadEnv();
  console.log("=== Q-CFA — diagnostic ===\n");

  const checks: { label: string; ok: boolean; hint?: string }[] = [];

  checks.push({
    label: "Fichier web compilé (web/dist/index.html)",
    ok: existsSync(webIndex),
    hint: existsSync(webIndex)
      ? undefined
      : "Lance : npm run web:build  — sans ça, le serveur n’affiche qu’un message API, pas le site React.",
  });

  checks.push({
    label: "DATABASE_URL défini dans .env",
    ok: Boolean(env.DATABASE_URL?.trim()),
    hint: "Sans PostgreSQL, les pages publiques renvoient 503. Installe Postgres (Docker ou serveur) et npm run db:migrate.",
  });

  let dbPing = false;
  let dbError: string | undefined;
  if (env.DATABASE_URL?.trim()) {
    const pool = getPortalPool();
    if (pool) {
      const c = await pool.connect();
      try {
        await c.query("SELECT 1");
        dbPing = true;
      } catch (e) {
        dbError = e instanceof Error ? e.message : String(e);
      } finally {
        c.release();
      }
    }
  }
  checks.push({
    label: "Connexion PostgreSQL",
    ok: Boolean(env.DATABASE_URL?.trim()) && dbPing,
    hint:
      !env.DATABASE_URL?.trim()
        ? undefined
        : dbPing
          ? undefined
          : dbError ?? "Impossible de joindre la base (Postgres lancé ? URL correcte ?)",
  });

  checks.push({
    label: "JWT_SECRET (min. 16 caractères, change en prod)",
    ok: env.JWT_SECRET.length >= 16,
  });

  checks.push({
    label: "TELEGRAM_BOT_TOKEN (pour npm run bot / PM2 qcfa-bot)",
    ok: Boolean(env.TELEGRAM_BOT_TOKEN?.trim()),
    hint: "Sans token, le processus bot s’arrête tout de suite. Crée un bot avec @BotFather sur Telegram.",
  });

  checks.push({
    label: "PUBLIC_SITE_URL (HTTPS, liens dans Telegram)",
    ok: Boolean(env.PUBLIC_SITE_URL?.trim()),
    hint: "Optionnel pour le bot, mais recommandé : ex. https://teamderape718.com",
  });

  for (const c of checks) {
    const icon = c.ok ? "OK " : "KO ";
    console.log(`${icon} ${c.label}`);
    if (!c.ok && c.hint) console.log(`   → ${c.hint}`);
  }

  console.log("\n--- Sur ton VPS (production) ---");
  console.log("Le site Internet et le bot 24h/24 ne marchent QUE si :");
  console.log("1) PM2 tourne : pm2 status  (qcfa-api + qcfa-bot)");
  console.log("2) Nginx pointe vers 127.0.0.1:3000 (ou le PORT de ton .env)");
  console.log("3) curl -s http://127.0.0.1:3000/health/ready  → JSON avec ok: true");
  console.log("\nSur ton PC pour tester le site sans VPS : npm run web:build && npm run dev");
  console.log("Puis ouvre http://localhost:3000 (il faut quand même Postgres pour les données).\n");

  const allCore =
    existsSync(webIndex) && Boolean(env.DATABASE_URL?.trim()) && dbPing && Boolean(env.TELEGRAM_BOT_TOKEN?.trim());
  process.exit(allCore ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
