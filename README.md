# Quizz Romane 30 🎉

Quiz façon Kahoot, gratuit et auto-hébergé, pour les 30 ans de Romane (19 septembre 2026). Chaque invité joue depuis son téléphone (navigateur, rien à installer), un écran commun (TV/vidéoprojecteur) anime la soirée, et un classement cumulé traverse tous les quiz de la soirée.

## Démarrage rapide

Prérequis : Node ≥ 20.

```bash
npm install
```

```bash
npm run dev
```

Trois adresses, une par usage :

| Page | Adresse | Pour qui |
|---|---|---|
| Jeu | http://localhost:5173 | les invités (sur leur téléphone : `http://<IP-du-PC>:5173`) |
| Écran commun | http://localhost:5173/host?key=romane | la TV / le vidéoprojecteur |
| Mes quiz | http://localhost:5173/edit?key=romane | Antoine, pour écrire les quiz |

```bash
npm run check
```

```bash
npm run smoke
```

`check` = typecheck serveur + client. `smoke` = test de bout en bout (inscription, quiz complet, scoring, classement, reconnexion, bibliothèque, photos).

## Écrire ses quiz

Tout se passe dans **Mes quiz** (`/edit`), protégé par la même clé que l'écran commun. On y crée, duplique et supprime des quiz ; dans un quiz, on ajoute des questions, on les réordonne, on choisit la bonne réponse, le temps de réponse et une photo.

- **2 à 4 réponses** par question (2 = vrai/faux). Les cases laissées vides sont simplement ignorées en jeu.
- **Les brouillons ne sont jamais perdus** : une question incomplète est enregistrée telle quelle, signalée par un ⚠️, et sautée au moment de jouer. La liste affiche « 8 questions prêtes · 2 à compléter ».
- **Photos** : le navigateur les réduit et les recompresse avant l'envoi (une photo de téléphone de 4 Mo devient ~150 Ko), puis elles vivent dans la base.
- **Score** : 100 pts par bonne réponse + jusqu'à 100 pts de bonus de rapidité.

Au tout premier démarrage, les quiz livrés dans `server/content/quiz/*.json` sont importés une fois dans la bibliothèque pour ne pas partir d'une page blanche. Ensuite ces fichiers ne servent plus à rien : tout vit dans la base.

## Déroulé d'une partie

L'animateur clique **Lancer un quiz** sur l'écran commun, choisit le quiz, et le 3-2-1 démarre. Pour chaque question : la question s'affiche, chacun répond sur son téléphone, la révélation montre la bonne réponse, la répartition des réponses, le plus rapide et le top 5. À la fin, podium — et les points s'ajoutent au **classement de la soirée**, qui survit d'un quiz à l'autre (et à un redémarrage du serveur).

Les invités qui arrivent après le lancement d'un quiz attendent le suivant (l'entrée en cours de partie arrive au lot 3).

## Où vivent les données

Deux stockages séparés, et c'est volontaire :

- **La bibliothèque de quiz** est le seul contenu précieux : elle doit survivre à un redéploiement. En local c'est un fichier (`server/data/quizzes.db`) ; en ligne, on pointe `QUIZ_DB_URL` vers une base **Turso** gratuite. Le code est le même — le client libSQL parle aux deux.
- **L'état d'une partie** (joueurs, scores, question en cours) vit dans une base SQLite locale, jetable : une soirée, puis on jette. Elle permet la reprise après un crash ou un redémarrage en pleine partie.

## Tester avec de vrais téléphones (à la maison)

1. PC et téléphones sur le **même wifi**.
2. `npm run build && npm start` → tout est servi sur `http://<IP-du-PC>:3001` (l'IP s'affiche au démarrage ; l'écran commun peut rester en `localhost`, le QR code affiche automatiquement l'adresse réseau).
3. **Une fois pour toutes, dans un PowerShell administrateur** (sinon Windows bloque les connexions entrantes) :

```powershell
Set-NetConnectionProfile -NetworkCategory Private
```

```powershell
New-NetFirewallRule -DisplayName "Quizz Romane 30" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3001,5173
```

Pour simuler des invités sans téléphone (ils répondent au hasard) :

```bash
node server/scripts/fake-player.mjs http://localhost:3001 Test1 300
```

## Le soir J

Cible : **hébergement gratuit en ligne** (lot 5), les invités se connectent en 4G/5G en scannant le QR — aucun réseau à installer sur place. Il faut un hébergeur qui supporte les WebSocket : GitHub Pages, Vercel et Netlify ne conviennent pas.

Repli toujours disponible : tout relancer en local sur le PC (voir ci-dessus) avec un routeur wifi sur place. Dans ce cas, renseignez `WIFI_SSID`/`WIFI_PASS` : l'écran commun affiche alors **deux QR codes** (1️⃣ rejoindre le wifi, 2️⃣ ouvrir le quiz).

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | `3001` | Port du serveur |
| `HOST_KEY` | `romane` | Clé d'accès de l'écran commun et de l'éditeur (`?key=...`) |
| `DB_PATH` | `server/data/quizz.db` | Base de la partie en cours (jetable) |
| `QUIZ_DB_URL` | fichier voisin de `DB_PATH` | Bibliothèque de quiz : `file:...` ou `libsql://...` (Turso) |
| `QUIZ_DB_TOKEN` | — | Jeton Turso, si base distante |
| `PUBLIC_URL` | — | URL publique à mettre dans le QR code (hébergement en ligne) |
| `WIFI_SSID` / `WIFI_PASS` | — | Si définis : QR « rejoindre le wifi » sur l'écran commun |

## Architecture

```
client/   React + Vite — 3 routes : "/" (téléphone), "/host" (écran commun), "/edit" (mes quiz)
server/   Node + Socket.io + Express — logique de jeu 100% côté serveur
shared/   Types TS partagés (protocole socket, vues du quiz, bibliothèque)
```

- **Party** (`server/src/core/party.ts`) — registre des joueurs. L'identité survit aux coupures : un token stocké sur le téléphone permet de retrouver son joueur après un refresh, une perte de réseau ou un redémarrage du serveur.
- **ScoreLedger** (`scores.ts`) — scores en append-only : chaque gain est une ligne (joueur, points, raison). Classement = somme par joueur, historique gratuit.
- **GameEngine** (`engine.ts`) — pilote la partie en cours (une seule à la fois) : route actions/commandes/timers vers le module de jeu, persiste l'état après chaque changement et rediffuse les **vues filtrées**.
- **Vues filtrées** — les clients ne reçoivent jamais l'état brut : chaque joueur reçoit `playerView(state, playerId)`, l'écran `hostView(state)`. C'est ce qui empêche la bonne réponse d'arriver dans le téléphone avant la révélation.
- **QuizStore** (`quizStore.ts`) + **API** (`api.ts`) — la bibliothèque de quiz et son API REST, protégée par la clé. Les photos sont servies par `/media/image/:id`, sans clé : les téléphones doivent pouvoir les charger.
- **Module quiz** (`server/src/games/quiz.ts`) — les règles : phases, timers, scoring, vues. Le moteur étant synchrone et la bibliothèque asynchrone, le module garde une **copie en mémoire** des quiz, rafraîchie au démarrage et après chaque édition — jamais pendant une partie.

## Feuille de route

| Lot | Contenu | Statut |
|---|---|---|
| 1 | Nettoyage : application 100 % quiz | ✅ |
| 2 | Bibliothèque en base + éditeur de quiz dans le navigateur | ✅ |
| 3 | Questions « estimation », entrée en cours de quiz, révélations enrichies | à faire |
| 4 | Habillage show (couleurs, barre de temps, podium animé, sons) | à faire |
| 5 | Déploiement gratuit (Render + Turso), QR public, test de charge à 50 joueurs | à faire |
