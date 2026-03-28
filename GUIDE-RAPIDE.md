# Ce que tu veux → ce que le projet fait déjà

## 1. Un bot qui marche « en vrai »

**C’est quoi ?** Le bot Telegram cherche des annonces Kijiji intéressantes, te les montre, et peut envoyer un SMS au vendeur (Telnyx) si un numéro est sur l’annonce.

**Ce qu’il faut pour qu’il tourne 24 h/24 :**

- Un **serveur** (ton VPS) **allumé**
- Sur le serveur : le projet installé, fichier **`.env`** avec au minimum `TELEGRAM_BOT_TOKEN` et les clés **Telnyx** si tu veux les SMS
- Lancer le bot avec **PM2** : `pm2 start deploy/ecosystem.config.cjs` (ou seulement l’app `qcfa-bot`)

Sans serveur qui tourne = pas de bot en ligne.

---

## 2. Un vrai site internet

**C’est quoi ?** Un site avec pages publiques + une partie **admin** pour toi seul.

| Partie | Adresse (une fois en ligne) | À quoi ça sert |
|--------|------------------------------|----------------|
| **Espace client** (visiteurs) | `/client` | Explications + liens vers catalogue. **Pas de compte** pour voir vidéos, boutique, véhicules. |
| **Boutique** | `/merch` | Tes produits merch (prix, image, lien). |
| **Véhicules & machines** | `/inventaire` | Ce que tu mets en vitrine (disponible / réservé…). |
| **Vidéos** | `/videos` | Tes liens (YouTube, etc.). |
| **Admin** | `/admin` | **Connexion** (email + mot de passe) → tu **ajoutes / modifies** vidéos, merch, inventaire, et tu vois les **négociations** liées au bot. |

**Comptes clients avec login + panier** (Amazon-style) : **pas encore** dans ce projet. Là, le « client » = tout visiteur qui regarde le site ; **toi** = admin qui gère le contenu.

---

## 3. Pour que **tout** soit fonctionnel sur Internet

Il faut **une fois** :

1. Mettre le code sur **GitHub** (tu as `project718`).
2. Sur le **VPS** : installer le projet (voir `deploy/deploy-auto.sh` ou `deploy/DEPLOY.md`).
3. Remplir **`.env`** (base de données, JWT, `PUBLIC_SITE_URL=https://teamderape718.com`, Telegram, Telnyx…).
4. **Nginx + SSL** devant l’app (port 3000).
5. **PM2** : `qcfa-api` (site + API) et `qcfa-bot` (si token Telegram).

Tant que ces étapes ne sont pas faites sur le serveur, le site reste **503** ou vide — ce n’est pas un bug du code sur ton PC, c’est que **personne n’a encore installé le tout sur le VPS**.

---

## 4. Ordre simple si tu es perdu

1. Sur ton PC : `git push` vers GitHub quand tu modifies le projet.  
2. Sur le VPS (une personne ou toi en SSH / Remote SSH) : **une fois** `sudo bash deploy/deploy-auto.sh`.  
3. Ensuite : mises à jour possibles avec **GitHub Actions** (voir `.github/workflows/README-DEPLOY.md`) ou `git pull` sur le serveur.

---

**En une phrase :** le site + l’admin + la boutique + le bot **sont dans le projet** ; pour qu’ils soient **en ligne pour tout le monde**, il faut les **faire tourner sur ton VPS** avec `.env` et PM2, comme dans les fichiers du dossier `deploy/`.

---

## 5. « Je ne vois aucun site / aucun bot » — causes fréquentes

Le code sur ton **PC** ou sur **GitHub** ne suffit pas : il faut un **processus qui tourne** (ton VPS ou ton ordinateur) avec **Node**, **`.env`**, et souvent **PostgreSQL**.

| Symptôme | Cause probable |
|----------|----------------|
| Domaine en **503** ou erreur Nginx | **qcfa-api** ne tourne pas, ou Nginx ne pointe pas vers le bon port (`PORT` dans `.env`, souvent **3000**). |
| Page blanche ou message « Q-CFA API » | Tu n’as pas lancé **`npm run web:build`** avant de démarrer le serveur : il manque `web/dist/index.html`. |
| Pages du site mais **erreur / vide** sur vidéos & co. | **`DATABASE_URL`** manquant ou Postgres injoignable → l’API renvoie **503**. Lance **`npm run db:migrate`** et crée un admin avec **`npm run seed:admin`**. |
| Bot Telegram **ne répond jamais** | **`TELEGRAM_BOT_TOKEN`** absent dans `.env`, ou processus **`qcfa-bot`** arrêté / en crash (voir **`pm2 logs qcfa-bot`**). Le bot doit rester **allumé** (PM2 ou `npm run bot`). |

**À faire sur la machine où ça doit marcher :**

1. À la racine du projet : **`npm run doctor`** — il liste ce qui manque (build web, DB, token Telegram, etc.).
2. Si l’API tourne : ouvre **`http://TON_IP:3000/health/ready`** (ou via le domaine) : tu dois voir **`ok: true`** avec **`webBuilt`** et **`database`** à `true`. Sinon corrige ce qui est en `false`.

**Tout faire en une commande sur ton PC** (Docker Desktop requis pour Postgres) :

```bash
cd q-cfa
npm run setup
```

Ça crée `.env` si besoin, ajoute `DATABASE_URL` pour le conteneur du `docker-compose.yml`, lance Postgres, `npm install`, `web:build`, `db:migrate`, `seed:admin`. Ensuite : **`npm run dev`** puis **http://localhost:3000** ; bot : **`npm run bot`** (avec **`TELEGRAM_BOT_TOKEN`** dans `.env`).

Sans Docker : installe Postgres à la main, mets **`DATABASE_URL`** dans `.env`, puis `npm install` → `npm run web:build` → `npm run db:migrate` → `npm run seed:admin` → `npm run dev`.
