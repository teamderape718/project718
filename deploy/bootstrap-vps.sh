#!/usr/bin/env bash
# Une seule commande sur le VPS (après git push de ce fichier sur GitHub) :
#   curl -fsSL https://raw.githubusercontent.com/TEAM/REPO/main/deploy/bootstrap-vps.sh | bash
#
# Optionnel AVANT (même ligne, pour éviter nano) — reste dans l’historique du shell :
#   export TELEGRAM_BOT_TOKEN='ton_token' DEPLOY_SSL_EMAIL='toi@email.com'
#   curl -fsSL ... | bash
set -euo pipefail

REPO_URL="${QCFA_REPO_URL:-https://github.com/teamderape718/project718.git}"
INSTALL_DIR="${QCFA_HOME:-$HOME/qcfa}"

if [[ "${EUID:-0}" -ne 0 ]]; then
  echo "Relance en root : sudo bash … ou connecte-toi en root."
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y git curl ca-certificates

if [[ ! -d "$INSTALL_DIR/.git" ]]; then
  echo ">>> Clone $REPO_URL -> $INSTALL_DIR"
  git clone "$REPO_URL" "$INSTALL_DIR"
else
  echo ">>> Mise à jour $INSTALL_DIR"
  git -C "$INSTALL_DIR" pull --rebase || git -C "$INSTALL_DIR" pull || true
fi

cd "$INSTALL_DIR"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo ">>> .env créé depuis .env.example"
fi

if [[ -n "${TELEGRAM_BOT_TOKEN:-}" ]]; then
  if grep -q '^TELEGRAM_BOT_TOKEN=' .env; then
    sed -i "s|^TELEGRAM_BOT_TOKEN=.*|TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}|" .env
  else
    printf '\nTELEGRAM_BOT_TOKEN=%s\n' "${TELEGRAM_BOT_TOKEN}" >>.env
  fi
  echo ">>> TELEGRAM_BOT_TOKEN enregistré dans .env"
fi

if [[ -n "${DEPLOY_SSL_EMAIL:-}" ]]; then
  if grep -q '^DEPLOY_SSL_EMAIL=' .env; then
    sed -i "s|^DEPLOY_SSL_EMAIL=.*|DEPLOY_SSL_EMAIL=${DEPLOY_SSL_EMAIL}|" .env
  else
    printf '\nDEPLOY_SSL_EMAIL=%s\n' "${DEPLOY_SSL_EMAIL}" >>.env
  fi
  echo ">>> DEPLOY_SSL_EMAIL enregistré dans .env"
fi

echo ">>> Lancement deploy/deploy-auto.sh"
bash deploy/deploy-auto.sh

echo ""
echo ">>> Terminé. Mot de passe admin : sudo cat /root/qcfa-admin-once.txt"
