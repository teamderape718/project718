# Créer ton premier repo GitHub (sans rien casser)

Le fichier **`.env`** (mots de passe, clés) est déjà dans **`.gitignore`** : il ne partira **pas** sur GitHub.

## 1. Sur le site GitHub

1. Va sur [https://github.com/new](https://github.com/new)
2. **Repository name** : par ex. `qcfa` ou `teamderape718`
3. Laisse **vide** (pas de README, pas de .gitignore) — plus simple pour la suite
4. Clique **Create repository**

GitHub va t’afficher une URL du type :  
`https://github.com/TON_PSEUDO/qcfa.git`

## 2. Sur ton PC (PowerShell)

Ouvre le terminal **dans le dossier du projet** :

```powershell
cd "C:\Users\ghost\Desktop\TEAM DERAPE\q-cfa"
git init
git add .
git commit -m "Premier envoi du projet"
git branch -M main
git remote add origin https://github.com/TON_PSEUDO/qcfa.git
git push -u origin main
```

Remplace **`TON_PSEUDO`** et **`qcfa`** par ce que tu as choisi sur GitHub.

### Si GitHub demande un mot de passe

GitHub n’accepte plus le mot de passe du compte pour `git push`. Utilise l’une de ces options :

- **Méthode A** : GitHub te propose de te connecter dans une fenêtre (Cursor / Git Credential Manager).
- **Méthode B** : crée un **Personal Access Token** : GitHub → **Settings → Developer settings → Personal access tokens** → en donner un avec la permission **repo**, et quand `git push` demande le mot de passe, tu colles **le token** à la place.

## 3. Après le premier push

Tu pourras suivre **[.github/workflows/README-DEPLOY.md](../.github/workflows/README-DEPLOY.md)** pour que chaque **`git push`** mette à jour ton VPS (après avoir fait **une fois** l’installation sur le serveur).

---

**Pas installé Git ?** Télécharge : [https://git-scm.com/download/win](https://git-scm.com/download/win)
