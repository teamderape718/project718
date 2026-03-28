#!/usr/bin/env bash
# Met l’email admin en base sur teamderape.718@yahoo.com (mot de passe inchangé).
# Usage sur le VPS : bash deploy/fix-admin-email.sh
set -euo pipefail
docker exec qcfa-postgres psql -U qcfa -d qcfa -c \
  "UPDATE admin_users SET email = lower('teamderape.718@yahoo.com') WHERE id = (SELECT id FROM admin_users ORDER BY id ASC LIMIT 1);"
echo "OK. Connecte-toi avec teamderape.718@yahoo.com et ton mot de passe admin actuel."
