# Mise en ligne — mode d'emploi

Tout ce qu'il faut pour mettre **Quizz Romane 30** en ligne et l'animer le 19 septembre 2026. Rien de ce qui suit ne coûte d'argent, et aucune carte bancaire n'est demandée.

---

## 1. Les trois sites (+ GitHub)

| Site | À quoi il sert | Carte bancaire | Compte à créer |
|---|---|---|---|
| [github.com](https://github.com) | héberge le code ; Render y lit le dépôt `Maxilyas/FiestApp` | non | déjà fait |
| [turso.tech](https://turso.tech) | la base qui garde tes quiz **pour toujours** | non | oui |
| [render.com](https://render.com) | le serveur qui fait tourner le jeu | non | oui |
| [cron-job.org](https://cron-job.org) | réveille le serveur toutes les 10 min | non | oui |

---

## 2. À noter quelque part (tu en auras besoin plusieurs fois)

Garde ces cinq valeurs sous la main — un fichier texte, un gestionnaire de mots de passe, ce que tu veux. **Ne les mets pas dans le dépôt.**

| Quoi | Où tu l'obtiens | Exemple |
|---|---|---|
| URL Turso | page de ta base Turso | `libsql://quizz-romane-xxx.turso.io` |
| Jeton Turso | bouton de création de token, **affiché une seule fois** | `eyJhbGciOi…` |
| Clé animateur (`HOST_KEY`) | tu l'inventes | `salsa2026!` |
| Adresse publique | donnée par Render après le déploiement | `https://quizz-romane-30.onrender.com` |
| Adresse de l'écran commun | l'adresse publique + `/host?key=ta-clé` | |

⚠️ **La clé animateur circule dans l'adresse.** Qui l'a peut lancer des quiz et modifier tes questions. Choisis autre chose que `romane`, et ne projette pas l'adresse complète sur le vidéoprojecteur.

---

## 3. Le déploiement, dans l'ordre

L'ordre compte : si tu déploies avant de migrer, l'application recopiera les deux quiz d'exemple dans ta base Turso et tu auras des doublons à supprimer.

### Étape 1 — Pousser le code sur GitHub

Render déploie depuis GitHub, pas depuis ton PC.

```bash
git push
```

### Étape 2 — Créer la base Turso

Sur [turso.tech](https://turso.tech) : crée un compte (connexion GitHub possible), puis une base — nomme-la `quizz-romane`, emplacement en Europe. Sur sa page, récupère **l'URL** (`libsql://…`) et crée un **jeton**.

En ligne de commande si tu préfères :

```bash
turso db create quizz-romane
```

```bash
turso db show quizz-romane --url
```

```bash
turso db tokens create quizz-romane
```

### Étape 3 — Transférer tes quiz vers Turso

```bash
npm run migrate -- --to libsql://TON-URL.turso.io --token TON-JETON
```

Ça copie **tout** ce que contient ta bibliothèque locale : quiz terminés, brouillons, photos. Fais le ménage dans `/edit` avant si nécessaire.

La commande se relance autant de fois que tu veux : un quiz déjà en ligne est mis à jour, un nouveau est ajouté. Elle n'efface jamais rien à destination.

### Étape 4 — Déployer sur Render

Sur [render.com](https://render.com) : crée un compte, puis **New → Blueprint**, connecte le dépôt `Maxilyas/FiestApp`. Render lit `render.yaml` et te demande trois valeurs :

| Variable | Ce que tu mets |
|---|---|
| `HOST_KEY` | ta clé animateur |
| `QUIZ_DB_URL` | l'URL Turso de l'étape 2 |
| `QUIZ_DB_TOKEN` | le jeton de l'étape 2 |

Deux à trois minutes de construction, et Render t'affiche ton adresse publique. Elle apparaîtra automatiquement dans le QR code — rien à configurer de plus.

### Étape 5 — Empêcher la mise en veille

Sans trafic pendant 15 minutes, l'offre gratuite de Render endort le serveur, et le réveil prend environ une minute. Le premier invité qui scanne attendrait devant une page blanche.

Sur [cron-job.org](https://cron-job.org), crée une tâche :

- adresse à appeler : `https://TON-ADRESSE.onrender.com/healthz`
- toutes les **10 minutes**
- laisse-la tourner jusqu'au lendemain de la fête

Le quota gratuit de Render (750 h/mois, pour un mois qui en compte 730) permet de rester allumé en permanence.

### Étape 6 — Vérifier pour de vrai

Ouvre l'adresse de l'écran commun, puis **scanne le QR avec ton téléphone en 4G, wifi coupé**. C'est le seul test qui prouve que le soir J fonctionnera.

```bash
npm run load -- https://TON-ADRESSE.onrender.com 20
```

Simule 20 invités sur le serveur en ligne et mesure les temps de réponse réels.

---

## 4. Toutes les commandes

### Écrire et tester chez toi

```bash
npm install
```

```bash
npm run dev
```

| Page | Adresse en local |
|---|---|
| Jeu (téléphone) | http://localhost:5173 |
| Écran commun | http://localhost:5173/host?key=romane |
| Mes quiz | http://localhost:5173/edit?key=romane |

En local la clé est `romane` (sauf si tu définis `HOST_KEY`). En ligne, c'est la tienne.

### Vérifier que rien n'est cassé

```bash
npm run check
```

```bash
npm run smoke
```

`check` contrôle le code, `smoke` rejoue une soirée entière (inscription, quiz, scores, reconnexion, bibliothèque, photos, estimation, retardataire).

### Simuler des invités

```bash
node server/scripts/fake-player.mjs http://localhost:3001 Testeur 300
```

Un invité fantôme qui répond au hasard pendant 300 secondes. Lance la commande plusieurs fois pour en avoir plusieurs.

```bash
npm run load -- http://localhost:3001 50
```

Test de charge complet : 50 invités, un quiz joué de bout en bout, et les temps mesurés.

### Transférer les quiz

```bash
npm run migrate -- --to libsql://TON-URL.turso.io --token TON-JETON
```

### Repli : tout faire tourner sur ton PC

Si la salle ne capte pas ou si l'hébergeur fait des siennes.

```bash
npm run build
```

```bash
npm start
```

Tout est alors servi sur `http://IP-DE-TON-PC:3001` (l'adresse s'affiche au démarrage). Les téléphones doivent être sur le **même wifi**. À faire une seule fois, dans un PowerShell **administrateur** :

```powershell
Set-NetConnectionProfile -NetworkCategory Private
```

```powershell
New-NetFirewallRule -DisplayName "Quizz Romane 30" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3001,5173
```

Avec un routeur wifi sans internet, renseigne `WIFI_SSID` et `WIFI_PASS` : l'écran commun affiche alors deux QR codes (1️⃣ rejoindre le wifi, 2️⃣ ouvrir le quiz).

---

## 5. Le soir J

1. **La veille** : vérifie que le ping tourne et ouvre l'adresse publique pour confirmer que tout répond.
2. **5 minutes avant** : ouvre l'écran commun sur le vidéoprojecteur. Tant qu'un écran est connecté, le serveur ne s'endort pas.
3. Vérifie le bouton 🔊 en haut de l'écran commun (les sons ne sortent que de là, jamais des téléphones).
4. Les invités scannent le QR, choisissent un prénom et un avatar.
5. **Lancer un quiz** → choisis **points normaux, ×2 ou ×3**, puis le quiz → le 3-2-1 démarre. Annonce le multiplicateur à la salle : c'est ce qui garde tout le monde dans la course.
6. Pendant une question : **Révéler la réponse** sans attendre le chronomètre, ou **⏸ Pause** pour un discours.
7. Après la révélation : **↺ Reposer** la question, ou **✖ Annuler les points** si la bonne réponse était fausse.
8. **⏩ Manuel / Auto 5 s / Auto 10 s** : en automatique, tu ne cliques plus entre les questions.
9. Un pseudo malheureux ? Clique dessus dans la liste des invités pour le renommer, ou sur la croix pour exclure.
10. À la fin : **🏆 Podium de la soirée** — il affiche aussi le plus beau coup, le plus régulier et le vainqueur de chaque quiz, de quoi remettre plusieurs cadeaux. Fais scanner le QR de la page souvenir.
11. Entre deux quiz, le classement de la soirée reste affiché et **se cumule**.

Les retardataires rejoignent en cours de partie : ils jouent les questions suivantes, sans rattraper les précédentes.

---

## 6. Si ça coince

| Symptôme | Cause probable | Quoi faire |
|---|---|---|
| Page blanche ~1 min au premier scan | serveur endormi | attendre le réveil ; vérifier le ping |
| « Clé incorrecte » | `HOST_KEY` différente de celle de Render | reprendre la valeur dans les variables Render |
| Aucun quiz proposé au lancement | la base Turso est vide | relancer la migration (étape 3) |
| « Aucun quiz prêt à jouer » | toutes les questions sont des brouillons | dans `/edit`, compléter ce qui porte un ⚠️ |
| Un invité ne voit rien après avoir répondu | c'est normal | la question est sur l'écran commun ; son téléphone attend la révélation |
| Téléphone bloqué sur « reconnexion… » | réseau du téléphone | il se reconnecte tout seul, son score est conservé |
| Quiz modifié en ligne puis écrasé | migration relancée après coup | une fois en ligne, n'écris plus qu'en ligne |
| Les scores des essais sont encore là | la sauvegarde distante les a gardés | **🧹 Nouvelle soirée** sur l'écran commun |

Un redémarrage du serveur en pleine partie n'est pas grave : la question en cours et les scores sont rechargés, et les téléphones se reconnectent seuls.
