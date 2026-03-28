# Git push → déploiement automatique

## Une fois sur ton VPS (SSH ou console AlexHost)

```bash
sudo mkdir -p /var/www
sudo git clone https://github.com/TON_COMPTE/q-cfa.git /var/www/q-cfa
cd /var/www/q-cfa
# Copie .env (secrets) — une seule fois
sudo bash deploy/deploy-auto.sh
```

Ou au minimum : Node, git clone, `.env`, `npm install`, `web:build`, `pm2` (comme dans `deploy/DEPLOY.md`).

## Clé SSH pour GitHub (sans mot de passe)

Sur ton **PC** ou le VPS :

```bash
ssh-keygen -t ed25519 -f github-deploy -N ""
```

Sur le **VPS** (en SSH), ajoute la **clé publique** (`github-deploy.pub`, tout le contenu du fichier) à la fin de `~/.ssh/authorized_keys` de l’utilisateur qui fera le `git pull` (souvent une ligne qui commence par `ssh-ed25519`).

Sur **GitHub** → ton dépôt → **Settings → Secrets and variables → Actions** → ajoute :

| Secret            | Exemple              |
|-------------------|----------------------|
| `VPS_HOST`        | `213.232.235.145`    |
| `VPS_USER`        | `root` ou `ubuntu`   |
| `VPS_SSH_KEY`     | contenu de `github-deploy` (**privée**, sans `.pub`) |
| (optionnel) `VPS_PORT` | si SSH n’est pas sur le port 22, il faudra éditer le workflow |

## Ensuite

À chaque **`git push`** sur `main` (ou `master`), le workflow met à jour le code sur le VPS et redémarre PM2.

**Branche par défaut :** si ton repo utilise `master`, le workflow le gère dans `git pull`.

## Sécurité

- Ne commite **jamais** la clé privée.
- Préfère un utilisateur **non-root** sur le VPS avec droits sur `/var/www/q-cfa` et `pm2`.
