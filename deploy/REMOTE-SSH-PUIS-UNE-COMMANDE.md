# Déployer avec Cursor Remote SSH (une commande)

## Pourquoi je ne vois pas ton VPS depuis ton PC

Quand tu parles à l’IA **sans** être en Remote SSH, le terminal est sur **Windows**. Les commandes ne partent **pas** sur le serveur.

## Étapes (une fois)

### 1. Connecter Cursor au VPS

1. `Ctrl+Shift+P` → **Remote-SSH: Connect to Host…**
2. Choisis ton hôte ou ajoute : `ssh root@213.232.235.145` (ou ton utilisateur).
3. Mot de passe **dans la fenêtre Cursor uniquement**, pas dans le chat.

### 2. Ouvrir le dossier du projet **sur le serveur**

**File → Open Folder** → `/var/www/q-cfa`  
(Si le dossier n’existe pas : **Terminal → New Terminal** puis `sudo mkdir -p /var/www && sudo git clone <ton-repo> /var/www/q-cfa`.)

### 3. Vérifier que le terminal est bien le VPS

Dans le terminal intégré :

```bash
hostname
uname -a
```

Tu dois voir **Linux** et le nom du serveur, pas `GHOST` / Windows.

### 4. Lancer le déploiement automatique

```bash
cd /var/www/q-cfa
chmod +x deploy/deploy-auto.sh
sudo bash deploy/deploy-auto.sh
```

Optionnel **avant** (recommandé pour SSL sans question) : dans `.env`, ajoute une ligne :

```env
DEPLOY_SSL_EMAIL=ton@email.com
```

### 5. Retrouver le mot de passe admin créé automatiquement

```bash
sudo cat /root/qcfa-admin-once.txt
```

---

## Ensuite, avec l’IA

Quand **cette fenêtre Cursor** est ouverte **en Remote** sur `/var/www/q-cfa`, tu peux dire : *« vérifie pm2 »*, *« relance l’API »* — les commandes du terminal iront sur le **VPS**.

Si le terminal affiche encore **PowerShell** ou `C:\...`, tu n’es **pas** en Remote : reconnecte l’hôte SSH.
