# Site sur ton domaine + bot Telegram 24 h/24 sur ton VPS

## Méthode simple (recommandée) : SSH depuis ton PC + **une** commande

Le terminal **VNC dans le navigateur** colle souvent mal : ce n’est pas normal pour travailler. Fais plutôt ceci sur **Windows** :

1. Touche **Windows**, tape **powershell**, Entrée.
2. Connexion au serveur (remplace si besoin) :

```powershell
ssh root@213.232.235.145
```

3. Une fois connecté : **clic droit** dans la fenêtre = **coller** tout le bloc d’un coup.

**Une seule ligne** (après avoir poussé ce dépôt sur GitHub, branche `main`) :

```bash
curl -fsSL https://raw.githubusercontent.com/teamderape718/project718/main/deploy/bootstrap-vps.sh | bash
```

Pour mettre le **bot** et l’**email SSL** sans ouvrir `nano`, colle **avant** (une fois) — puis relance la ligne `curl` :

```bash
export TELEGRAM_BOT_TOKEN='COLLE_TON_TOKEN_ICI'
export DEPLOY_SSL_EMAIL='ton@email.com'
curl -fsSL https://raw.githubusercontent.com/teamderape718/project718/main/deploy/bootstrap-vps.sh | bash
```

*(Attention : l’historique du serveur peut garder ces lignes ; après coup tu peux vider l’historique ou changer le token côté BotFather si tu t’inquiètes.)*

Si ton dépôt ou ta branche n’est pas `main`, change l’URL dans `curl` (ex. `master` au lieu de `main`).

---

Objectif : **https://ton-domaine.com** ouvre ton site, et le **bot Telegram** tourne **tout le temps** sur le même serveur.

Le projet est déjà réglé pour **teamderape718.com**. Si ton domaine est un autre nom, dis-le à la personne qui déploie : il faudra changer **3 endroits** (fichier Nginx, Certbot, `PUBLIC_SITE_URL` dans `.env`).

---

## Avant toute chose (à faire une fois)

1. **Ton nom de domaine** (ex. `teamderape718.com`) doit avoir un enregistrement **A** chez ton registrar (Namecheap, etc.) qui pointe vers **l’IP publique de ton VPS** (ex. `213.232.235.145`).  
   - Attends **15 min à quelques heures** après le changement DNS avant de lancer SSL.

2. **Le code** doit être sur le VPS. Le plus simple : le projet est sur **GitHub**, et sur le serveur tu fais un `git clone` (une fois).

3. Sur le VPS : **Ubuntu** (comme dans les scripts du dossier `deploy/`).

---

## Sur le VPS : une seule grosse commande (après préparation)

### Étape A — Te connecter au serveur

Depuis ton PC, avec **PuTTY**, **Windows Terminal**, ou l’extension **Remote SSH** de Cursor : connexion **SSH** avec l’utilisateur que ton hébergeur t’a donné (souvent `ubuntu` ou `root`).

### Étape B — Mettre le projet sur le serveur

Exemple si le dépôt s’appelle `project718` sur GitHub :

```bash
cd ~
git clone https://github.com/teamderape718/project718.git qcfa
cd qcfa
```

(Si le dossier ou l’URL Git est différent, adapte. L’important : être **à la racine du projet** là où il y a `package.json` et le dossier `deploy/`.)

### Étape C — Renseigner le bot et l’email SSL (obligatoire pour que tout roule)

```bash
nano .env
```

(Si `.env` n’existe pas encore, le script `deploy-auto.sh` le créera — tu peux aussi copier : `cp .env.example .env` avant le script.)

Ajoute ou modifie **au minimum** :

```env
TELEGRAM_BOT_TOKEN=colle_ici_le_token_de_BotFather
DEPLOY_SSL_EMAIL=ton@email.com
```

- Token : ouvre Telegram → cherche **@BotFather** → `/newbot` ou récupère le token d’un bot existant.  
- **Ne partage jamais** ce token dans un chat public.

Enregistre le fichier (dans nano : `Ctrl+O`, Entrée, `Ctrl+X`).

### Étape D — Lancer l’installation automatique

```bash
sudo bash deploy/deploy-auto.sh
```

Ce script (déjà dans le projet) installe Node, Nginx, Docker + Postgres, compile le site, migre la base, configure **teamderape718.com**, tente **Let’s Encrypt** si `DEPLOY_SSL_EMAIL` est rempli, et démarre **PM2** avec **l’API + le bot** (si le token Telegram est présent).

### Étape E — Noter le mot de passe admin

Le script affiche un fichier à lire **en root** :

```bash
sudo cat /root/qcfa-admin-once.txt
```

Tu y trouves l’URL admin et le **mot de passe** du premier compte. Connecte-toi sur **https://teamderape718.com/admin** puis change ce mot de passe si tu veux.

### Étape F — Que ça redémarre après un reboot du VPS

Le script affiche souvent une ligne du genre `pm2 startup` à copier-coller avec **sudo**. Fais-le : sinon après un redémarrage du serveur, le site et le bot ne se relanceront pas tout seuls.

---

## Vérifier que tout roule

Sur le serveur :

```bash
pm2 status
```

Tu dois voir **qcfa-api** (site + API) et **qcfa-bot** (Telegram) en **online**.

Dans le navigateur : **https://teamderape718.com**  
Page technique : **https://teamderape718.com/health/ready** — si tout est vert côté serveur, tu vois `"ok": true` (avec base + site compilé).

Sur Telegram : envoie **/start** ou **/menu** à ton bot.

---

## Si quelque chose bloque

| Problème | Piste |
|----------|--------|
| Site ne charge pas | `pm2 logs qcfa-api` — erreur Node ou `.env` |
| Bot ne répond pas | `pm2 logs qcfa-bot` — token manquant ou faux ; ou `TELEGRAM_ALLOWED_CHAT_IDS` trop restrictif dans `.env` |
| Erreur SSL / certificat | DNS pas encore propagé ; relance plus tard `sudo certbot --nginx -d teamderape718.com -d www.teamderape718.com` |
| 502 / 503 devant Nginx | L’app ne tourne pas sur le port **3000** : `pm2 restart qcfa-api` |

---

## Ce que personne ne peut faire à ta place

- Entrer **sur ton VPS** (SSH) : c’est **toi** ou quelqu’un à qui tu donnes l’accès.  
- Coller **ton** token Telegram et **ton** email dans **`.env`**.

Cursor / une IA **ne se connecte pas** à ton serveur automatiquement : elle peut seulement te préparer ce guide et le code. Le geste **sur le VPS** reste **une connexion SSH + les commandes ci-dessus** (ou un prestataire qui les exécute pour toi).

Après la première fois, les mises à jour du code se font souvent par **`git pull`** sur le VPS puis `npm install`, `npm run web:build`, `pm2 restart all` — ou par **GitHub Actions** si tu l’as configuré (voir `.github/workflows/README-DEPLOY.md`).
