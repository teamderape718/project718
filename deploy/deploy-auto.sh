#!/usr/bin/env bash
# Déploiement automatique sur Ubuntu (VPS).
# À lancer SUR LE SERVEUR, depuis la racine du dépôt :
#   sudo bash deploy/deploy-auto.sh
#
# Prérequis : le dossier du projet (git clone ou copie) existe déjà sur le VPS.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QC_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$QC_ROOT"

if [[ $EUID -ne 0 ]]; then
  echo "Ce script doit tourner en root. Relance avec :"
  echo "  sudo bash deploy/deploy-auto.sh"
  exit 1
fi

REAL_USER="${SUDO_USER:-root}"
if [[ "$REAL_USER" == "root" ]]; then
  echo "Astuce : connecte-toi en SSH avec un utilisateur non-root (ex. ubuntu) puis : sudo bash deploy/deploy-auto.sh"
fi

echo ">>> Répertoire projet : $QC_ROOT"
echo ">>> Fichiers npm/pm2 exécutés en tant que : $REAL_USER"

chown -R "$REAL_USER:$REAL_USER" "$QC_ROOT"

echo "==> 1/10 Paquets (Node, Nginx, Docker, Certbot, libs Playwright)"
bash "$SCRIPT_DIR/install-ubuntu.sh"

echo "==> 2/10 PostgreSQL (Docker)"
if [[ -f "$QC_ROOT/docker-compose.yml" ]]; then
  (cd "$QC_ROOT" && docker compose up -d)
else
  echo "!!! Pas de docker-compose.yml — configure PostgreSQL à la main et DATABASE_URL dans .env"
fi

echo "==> 3/10 Fichier .env"
if [[ ! -f "$QC_ROOT/.env" ]]; then
  cp "$QC_ROOT/.env.example" "$QC_ROOT/.env"
  JWT_HEX=$(openssl rand -hex 24)
  ADMIN_PASS=$(openssl rand -base64 16 | tr -d '=/+' | head -c 16)

  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT_HEX}|" "$QC_ROOT/.env"
  sed -i "s|^NODE_ENV=.*|NODE_ENV=production|" "$QC_ROOT/.env"
  sed -i "s|^PUBLIC_SITE_URL=.*|PUBLIC_SITE_URL=https://teamderape718.com|" "$QC_ROOT/.env"
  sed -i "s|^ADMIN_EMAIL=.*|ADMIN_EMAIL=admin@teamderape718.com|" "$QC_ROOT/.env"
  sed -i "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=${ADMIN_PASS}|" "$QC_ROOT/.env"

  if ! grep -qE '^DATABASE_URL=postgresql' "$QC_ROOT/.env"; then
    echo "DATABASE_URL=postgresql://qcfa:qcfa@127.0.0.1:5432/qcfa" >> "$QC_ROOT/.env"
  fi
  grep -q '^HEADLESS=' "$QC_ROOT/.env" || echo "HEADLESS=1" >> "$QC_ROOT/.env"

  SECRET_FILE="/root/qcfa-admin-once.txt"
  umask 077
  {
    echo "URL site : https://teamderape718.com"
    echo "Admin : https://teamderape718.com/admin"
    echo "ADMIN_EMAIL=admin@teamderape718.com"
    echo "ADMIN_PASSWORD=${ADMIN_PASS}"
    echo "Mot de passe à changer après 1ère connexion."
  } >"$SECRET_FILE"
  chmod 600 "$SECRET_FILE"
  echo ">>> Identifiants admin initiaux : $SECRET_FILE (lis avec: sudo cat $SECRET_FILE)"
else
  echo ">>> .env existe déjà — non écrasé."
fi

# Si .env vient de .env.example, DATABASE_URL est souvent commenté → migrations échouent
if ! grep -qE '^DATABASE_URL=postgresql' "$QC_ROOT/.env"; then
  sed -i 's|^# *DATABASE_URL=.*|DATABASE_URL=postgresql://qcfa:qcfa@127.0.0.1:5432/qcfa|' "$QC_ROOT/.env" 2>/dev/null || true
  if ! grep -qE '^DATABASE_URL=postgresql' "$QC_ROOT/.env"; then
    echo "DATABASE_URL=postgresql://qcfa:qcfa@127.0.0.1:5432/qcfa" >>"$QC_ROOT/.env"
  fi
  echo ">>> DATABASE_URL corrigé pour Postgres (Docker)."
fi

run_as() {
  sudo -H -u "$REAL_USER" bash -c "set -e; cd '$QC_ROOT'; $*"
}

echo "==> 4/10 npm install"
run_as "npm install"

echo "==> 5/10 Playwright Chromium"
run_as "npx playwright install chromium"

echo "==> 6/10 Migrations SQL"
run_as "npm run db:migrate"

echo "==> 7/10 Création admin (ok si déjà existant)"
run_as "npm run seed:admin" || true

echo "==> 8/10 Build site React"
run_as "npm run web:build"

echo "==> 9/10 Nginx"
install -m 644 "$SCRIPT_DIR/nginx-qcfa.conf" /etc/nginx/sites-available/qcfa
ln -sf /etc/nginx/sites-available/qcfa /etc/nginx/sites-enabled/qcfa
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "==> 10/10 SSL (Let's Encrypt)"
SSL_EMAIL=$(grep -E '^DEPLOY_SSL_EMAIL=' "$QC_ROOT/.env" 2>/dev/null | cut -d= -f2- | tr -d '\r' || true)
if [[ -n "${SSL_EMAIL:-}" ]]; then
  certbot --nginx -d teamderape718.com -d www.teamderape718.com \
    --non-interactive --agree-tos -m "$SSL_EMAIL" --redirect \
    || echo "Certbot : échec ou déjà configuré — vérifie : certbot certificates"
else
  echo ">>> Ajoute DEPLOY_SSL_EMAIL=ton@email.com dans .env puis lance :"
  echo "    sudo certbot --nginx -d teamderape718.com -d www.teamderape718.com"
fi

echo "==> PM2"
run_as "pm2 delete qcfa-api 2>/dev/null || true; pm2 delete qcfa-bot 2>/dev/null || true"
if grep -qE '^TELEGRAM_BOT_TOKEN=.+' "$QC_ROOT/.env"; then
  run_as "pm2 start deploy/ecosystem.config.cjs"
else
  echo ">>> Pas de TELEGRAM_BOT_TOKEN — démarrage API seulement"
  run_as "pm2 start deploy/ecosystem.config.cjs --only qcfa-api"
fi
run_as "pm2 save"
echo ">>> Si besoin service au boot : exécute la ligne affichée par : sudo -u $REAL_USER pm2 startup"

echo ""
echo "=== Déploiement terminé ==="
echo "Test : curl -sI https://teamderape718.com"
echo "Admin : https://teamderape718.com/admin"
