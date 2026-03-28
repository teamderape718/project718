# Q-CFA — Quebec Car Flip Automator

API Node.js (Fastify) + scraping Kijiji (Playwright + stealth), filtres obligatoires, matrice de prix, pipeline optionnel Claude / Groq, SMS Telnyx, PostgreSQL pour historique et dédoublonnage des alertes, **bot Telegram** (`/scan` → annonces à fort potentiel + bouton *Commencer le deal* → SMS vendeur Telnyx si le numéro est sur la fiche).

## Prérequis

- [Node.js](https://nodejs.org/) 20+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (optionnel, pour PostgreSQL)

## Installation rapide (une commande)

**Docker Desktop** doit tourner (pour PostgreSQL). À la racine du projet :

```powershell
cd q-cfa
npm run setup
```

Sous Windows tu peux aussi lancer `.\scripts\setup.ps1` (vérifie Node puis appelle `npm run setup`).

Ça crée `.env` si besoin, démarre Postgres (`docker compose`), `npm install`, `web:build`, `db:migrate`, `seed:admin`. Puis : `npm run dev` → http://localhost:3000

Sinon, manuellement : copiez `.env.example` → `.env`, ajoutez `DATABASE_URL=postgresql://qcfa:qcfa@localhost:5432/qcfa`, `docker compose up -d`, `npm install`, `npm run web:build`, `npm run db:migrate`, `npm run seed:admin`.

Ajoutez dans `.env` selon usage : `TELNYX_*` (SMS), `TELEGRAM_BOT_TOKEN` (bot), `NOTIFY_SMS_TO`, `ANTHROPIC_API_KEY`, `GROQ_API_KEY`.

## Site web + admin + inventaire

- **Public** : accueil, vidéos, merch, inventaire (véhicules / machines).
- **Admin** : `/admin` (login JWT) → `/admin/panel` — vidéos, merch, inventaire, **négociations** (remplies par le bot sur *Commencer le deal*).
- **Build** : `npm run web:build` puis `npm start` (sert `web/dist` + API).
- **Dev** : `npm run dev` + `npm run web:dev` (Vite proxy `/api`).
- **1er admin** : `npm run db:migrate`, puis `ADMIN_EMAIL` / `ADMIN_PASSWORD` dans `.env`, `npm run seed:admin`.
- **Bot** : `PUBLIC_SITE_URL` en **HTTPS** pour les boutons Site / Admin dans `/menu`.

## Commandes

| Commande | Rôle |
|----------|------|
| `npm run setup` | **1re install locale** : Docker Postgres, build web, migrate, seed admin |
| `npm run doctor` | Vérifie `.env`, build, DB, token Telegram |
| `npm start` | API + site (après `web:build`) |
| `npm run dev` | API watch |
| `npm run web:dev` | Front Vite (5173) |
| `npm run web:build` | Compile le site → `web/dist` |
| `npm run build` | = `web:build` |
| `npm run scrape:kijiji` | Scrape Kijiji + filtres + scores (JSON) |
| `npm run pipeline:kijiji -- 2` | Pipeline (sans SMS) |
| `npm run pipeline:kijiji -- 2 --notify` | + SMS Telnyx |
| `npm run pipeline:kijiji -- 2 --details` | + fiches détail |
| `npm run db:migrate` | Tables PostgreSQL |
| `npm run seed:admin` | Premier compte admin |
| `npm run bot` | Telegram : `/menu`, `/scan`, *Commencer le deal* |

Pour tourner en continu : `pm2 start npm --name qcfa-bot -- run bot` (après `npm install -g pm2`).

## API (extrait)

- `GET /health` — santé
- `GET /api/public/videos` | `merch` | `inventory` — contenu public
- `POST /api/admin/login` — `{ "email", "password" }` → `{ "token" }`
- `GET /api/admin/*` — CRUD (header `Authorization: Bearer <token>`)
- `POST /scrape/kijiji` — `{ "maxPages": 2, "applyPrivateFilter": true }`
- `POST /pipeline/kijiji` — `{ "maxPages": 2, "sendOwnerSms": false, "fetchListingDetails": false }`

## Déploiement VPS (teamderape718.com, etc.)

Guide pas à pas : **[deploy/DEPLOY.md](deploy/DEPLOY.md)** — Nginx, SSL Certbot, PM2, Docker PostgreSQL, scripts dans `deploy/`.

**Pas encore de GitHub ?** [deploy/PREMIER-REPO-GITHUB.md](deploy/PREMIER-REPO-GITHUB.md)

**Trop compliqué ?** Lis d’abord [deploy/C-EST-SIMPLE.md](deploy/C-EST-SIMPLE.md) (2 façons : **push Git** ou **une commande** sur le serveur).

**Push Git = déploiement :** [.github/workflows/README-DEPLOY.md](.github/workflows/README-DEPLOY.md)

**Cursor Remote SSH + une commande :** [deploy/REMOTE-SSH-PUIS-UNE-COMMANDE.md](deploy/REMOTE-SSH-PUIS-UNE-COMMANDE.md) — [deploy/deploy-auto.sh](deploy/deploy-auto.sh)

## Avertissement

Le scraping peut être interdit par les conditions d’utilisation des sites ; utilisez des délais raisonnables et respectez la loi.
