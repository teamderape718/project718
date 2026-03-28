#!/usr/bin/env bash
# À lancer sur le VPS Ubuntu (root ou sudo) : bash deploy/install-ubuntu.sh
set -euo pipefail

echo "==> Mise à jour paquets"
apt-get update -y
apt-get upgrade -y

echo "==> Outils de base"
apt-get install -y curl git nginx ufw ca-certificates gnupg

echo "==> Node.js 20.x (NodeSource)"
if ! command -v node &>/dev/null || [[ "$(node -v)" != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node -v
npm -v

echo "==> PM2 (process manager)"
npm install -g pm2

echo "==> Docker (PostgreSQL via docker compose — optionnel mais recommandé)"
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
fi

echo "==> Dépendances Playwright / Chromium (scraping Kijiji)"
apt-get install -y \
  libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libdbus-1-3 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
  libxrandr2 libgbm1 libasound2t64 libpango-1.0-0 libcairo2 fonts-liberation \
  || true

echo "==> Pare-feu : SSH + HTTP + HTTPS"
ufw allow OpenSSH
ufw allow "Nginx Full"
ufw --force enable || true

echo "==> Certbot (SSL Let's Encrypt)"
apt-get install -y certbot python3-certbot-nginx

echo ""
echo "OK. Étapes suivantes :"
echo "  1. Copier le projet dans /var/www/q-cfa (git clone ou rsync)"
echo "  2. cd /var/www/q-cfa && cp .env.example .env && nano .env"
echo "  3. docker compose up -d   # PostgreSQL"
echo "  4. npm install && npx playwright install chromium && npm run db:migrate && npm run seed:admin"
echo "  5. npm run web:build"
echo "  6. sudo cp deploy/nginx-qcfa.conf /etc/nginx/sites-available/qcfa && sudo ln -sf /etc/nginx/sites-available/qcfa /etc/nginx/sites-enabled/ && sudo rm -f /etc/nginx/sites-enabled/default && sudo nginx -t && sudo systemctl reload nginx"
echo "  7. sudo certbot --nginx -d teamderape718.com -d www.teamderape718.com"
echo "  8. pm2 start deploy/ecosystem.config.cjs && pm2 save && pm2 startup"
