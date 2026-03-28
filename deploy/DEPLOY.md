# Déploiement sur VPS Ubuntu — teamderape718.com

Tu exécutes tout **en SSH** sur ton serveur (`213.232.235.145`). Le DNS Namecheap (A `@` → IP) est déjà bon.

## 1. Transférer le projet sur le serveur

**Option A — Git (recommandé)**  
Sur ton PC : pousse le dossier `q-cfa` sur GitHub/GitLab (sans le fichier `.env`).  
Sur le VPS :

```bash
sudo mkdir -p /var/www && sudo chown -R $USER:$USER /var/www
cd /var/www
git clone https://github.com/TON_COMPTE/q-cfa.git
cd q-cfa
```

**Option B — ZIP**  
Sur ton PC : zip le dossier `q-cfa` (sans `node_modules`).  
Sur le VPS : `scp` ou panneau AlexHost upload, puis `unzip` dans `/var/www/q-cfa`.

## 2. Installation système (une fois)

```bash
cd /var/www/q-cfa
chmod +x deploy/install-ubuntu.sh
sudo bash deploy/install-ubuntu.sh
```

## 3. PostgreSQL

```bash
cd /var/www/q-cfa
docker compose up -d
```

Dans `.env` :

```env
DATABASE_URL=postgresql://qcfa:qcfa@127.0.0.1:5432/qcfa
```

*(Mot de passe : change `POSTGRES_PASSWORD` dans `docker-compose.yml` + même valeur dans `DATABASE_URL` si tu sécurises.)*

## 4. Fichier `.env` sur le serveur

```bash
cp .env.example .env
nano .env
```

Renseigne au minimum :

| Variable | Exemple |
|----------|---------|
| `DATABASE_URL` | `postgresql://qcfa:qcfa@127.0.0.1:5432/qcfa` |
| `JWT_SECRET` | longue chaîne aléatoire (32+ caractères) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | pour `npm run seed:admin` |
| `PUBLIC_SITE_URL` | `https://teamderape718.com` |
| `TELEGRAM_BOT_TOKEN` | si tu lances le bot |
| `TELNYX_*` | si SMS |
| `KIJIJI_QUEBEC_AUTOS_URL` | ta recherche Kijiji |

## 5. Build applicatif

```bash
cd /var/www/q-cfa
npm install
npx playwright install chromium
npm run db:migrate
npm run seed:admin
npm run web:build
```

## 6. Nginx (reverse proxy → port 3000)

```bash
sudo cp /var/www/q-cfa/deploy/nginx-qcfa.conf /etc/nginx/sites-available/qcfa
sudo ln -sf /etc/nginx/sites-available/qcfa /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

## 7. SSL (HTTPS)

```bash
sudo certbot --nginx -d teamderape718.com -d www.teamderape718.com
```

Renouvellement auto : déjà configuré par certbot (timer systemd).

## 8. Démarrage 24/7 (PM2)

```bash
cd /var/www/q-cfa
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup
# Exécuter la ligne que pm2 startup affiche (sudo env ...)
```

- **API + site** : process `qcfa-api` (écoute `3000`, Nginx en frontal).  
- **Bot** : `qcfa-bot`. Si tu n’as pas encore de token Telegram, retire le bloc `qcfa-bot` dans `ecosystem.config.cjs` ou arrête-le : `pm2 stop qcfa-bot`.

## 9. Vérifications

```bash
curl -sI https://teamderape718.com
curl -s https://teamderape718.com/api/public/site-meta
pm2 status
```

- Site public : `https://teamderape718.com`  
- Admin : `https://teamderape718.com/admin`

## Mise à jour ultérieure

```bash
cd /var/www/q-cfa
git pull
npm install
npm run db:migrate
npm run web:build
pm2 restart all
```

---

**Je ne peux pas me connecter à ton VPS à ta place.** Si une commande échoue, copie-colle le message d’erreur (sans mots de passe).
