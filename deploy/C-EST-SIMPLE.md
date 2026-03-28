# C’est simple (vraiment)

## Ce qu’il faut comprendre

Ton **PC** et ton **serveur** sont deux machines différentes.  
Cursor sur ton PC **ne peut pas** aller tout seul sur le serveur : il n’a pas le droit, techniquement.

**Avant**, si ça « marchait depuis ici », c’était en général l’une de ces choses :

- tu **poussais le code** (Git) et quelque chose déployait tout seul, **ou**
- tu étais **déjà connecté au serveur** sans t’en rendre compte.

---

## La façon la plus simple pour toi : **Git push = déploiement**

1. Tu travailles sur le projet sur ton **PC** (comme maintenant).
2. Tu fais **`git push`** vers GitHub.
3. **GitHub** se connecte à ton VPS et met à jour le site **tout seul**.

Tu n’as qu’à configurer **une fois** les secrets sur GitHub (voir `.github/workflows/README-DEPLOY.md`).

Après ça : **modifier le code → push → le site se met à jour**. Pas besoin de SSH à chaque fois.

---

## L’autre façon (si tu ne veux pas GitHub Actions)

Une seule fois : ouvrir le projet **sur le serveur** avec Cursor (Remote SSH), puis lancer **une** commande :

`sudo bash deploy/deploy-auto.sh`

Ensuite les mises à jour : `git pull` sur le serveur + redémarrage (ou tu passes au **push automatique** ci-dessus).

---

En résumé : **depuis ton PC, le geste simple c’est `git push`**, pas « l’IA qui se connecte au VPS ».
