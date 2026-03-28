/**
 * Installation locale complète : Docker Postgres, dépendances, build web, migrations, admin.
 * Usage : npm run setup   (à la racine du projet)
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: true,
    ...opts,
  });
  if (r.status !== 0) {
    throw new Error(`Commande échouée : ${cmd} ${args.join(" ")} (code ${r.status})`);
  }
}

function ensureEnv() {
  const envPath = join(root, ".env");
  const examplePath = join(root, ".env.example");
  if (!existsSync(envPath)) {
    if (!existsSync(examplePath)) {
      throw new Error(".env.example introuvable");
    }
    copyFileSync(examplePath, envPath);
    console.log("→ .env créé à partir de .env.example");
  }
  let text = readFileSync(envPath, "utf8");
  const hasActiveDb = /^\s*DATABASE_URL\s*=/m.test(text);
  if (!hasActiveDb) {
    text =
      text.trimEnd() +
      "\n\n# Ajouté par npm run setup (Postgres local Docker)\nDATABASE_URL=postgresql://qcfa:qcfa@localhost:5432/qcfa\n";
    writeFileSync(envPath, text);
    console.log("→ DATABASE_URL ajouté pour Postgres Docker local");
  }
}

async function waitForPostgres() {
  const { default: pg } = await import("pg");
  const url = "postgresql://qcfa:qcfa@localhost:5432/qcfa";
  for (let i = 0; i < 45; i++) {
    const pool = new pg.Pool({ connectionString: url });
    try {
      await pool.query("SELECT 1");
      await pool.end();
      console.log("→ PostgreSQL joignable");
      return;
    } catch {
      await pool.end().catch(() => {});
    }
    await new Promise((r) => setTimeout(r, 1000));
    if (i % 5 === 0 && i > 0) console.log(`   attente Postgres… (${i}s)`);
  }
  throw new Error(
    "PostgreSQL ne répond pas sur localhost:5432. Lance Docker Desktop puis réessaie : npm run setup"
  );
}

async function main() {
  console.log("=== Q-CFA — installation locale ===\n");

  ensureEnv();

  console.log("→ docker compose up -d (Postgres)");
  const dc = spawnSync("docker", ["compose", "up", "-d"], {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });
  if (dc.status !== 0) {
    console.error(
      "\nDocker a échoué. Installe Docker Desktop, ou démarre le service Docker, puis relance : npm run setup\n"
    );
    process.exit(1);
  }

  console.log("→ npm install (avant d’attendre Postgres — besoin du module pg)");
  run("npm", ["install"]);

  await waitForPostgres();

  console.log("→ Playwright Chromium (postinstall peut déjà l’avoir fait)");
  run("npx", ["playwright", "install", "chromium"]);

  console.log("→ npm run web:build");
  run("npm", ["run", "web:build"]);

  console.log("→ npm run db:migrate");
  run("npm", ["run", "db:migrate"]);

  console.log("→ npm run seed:admin (ignore si admin déjà créé)");
  const seed = spawnSync("npm", ["run", "seed:admin"], {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });
  if (seed.status !== 0) {
    console.warn("seed:admin a retourné une erreur — vérifie ADMIN_EMAIL / ADMIN_PASSWORD dans .env");
  }

  console.log("\n=== Terminé ===");
  console.log("1) Mets ton TELEGRAM_BOT_TOKEN dans .env (optionnel pour le site seul)");
  console.log("2) Terminal A : npm run dev  → http://localhost:3000");
  console.log("3) Terminal B : npm run bot  (si token Telegram renseigné)");
  console.log("4) Admin : /admin avec les identifiants ADMIN_EMAIL / ADMIN_PASSWORD du .env\n");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
