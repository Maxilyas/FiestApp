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

`check` = typecheck serveur + client. `smoke` = test de bout en bout (inscription, quiz complet, scoring, classement, reconnexion, bibliothèque, photos, estimation, retardataire).

## Écrire ses quiz

Tout se passe dans **Mes quiz** (`/edit`), protégé par la même clé que l'écran commun. On y crée, duplique et supprime des quiz ; dans un quiz, on ajoute des questions, on les réordonne, on choisit la bonne réponse, le temps de réponse et une photo.

Deux types de questions, au choix pour chacune :

| Type | Comment on répond | Score (200 pts max) |
|---|---|---|
| 🔘 **QCM** | 2 à 4 réponses, une bonne (2 = vrai/faux) | 100 pts si c'est juste + jusqu'à 100 pts de rapidité |
| 🔢 **Estimation** | chacun tape un nombre | 30 pts pour avoir joué + jusqu'à 120 pts selon la proximité + 50 pts au plus proche |

L'estimation évite les blocages : même sans connaître la réponse, on propose un chiffre et on marque quelque chose. La proximité est calculée **par rapport au groupe** — sinon une erreur de 3 ans sur une date et une erreur de 3 km sur une distance rapporteraient la même chose. Le plus proche empoche le maximum, le plus loin garde ses 30 pts de participation. À égalité d'écart, le plus rapide gagne.

- **Les cases de réponse vides** sont simplement ignorées en jeu (et la bonne réponse suit son texte, pas son numéro de case).
- **Les brouillons ne sont jamais perdus** : une question incomplète est enregistrée telle quelle, signalée par un ⚠️, et sautée au moment de jouer. La liste affiche « 8 questions prêtes · 2 à compléter ».
- **Photos** : le navigateur les réduit et les recompresse avant l'envoi (une photo de téléphone de 4 Mo devient ~150 Ko), puis elles vivent dans la base.
- **On peut changer d'avis** jusqu'à la révélation, sur un QCM comme sur une estimation : un doigt qui glisse sur un téléphone tenu dans le noir ne doit pas coûter la question. C'est le dernier envoi qui fait foi, heure comprise — se raviser coûte donc du bonus de rapidité, sans quoi on pourrait taper au hasard dès la première seconde pour s'assurer le maximum, puis corriger tranquillement.
- **Coller une liste** évite de saisir cinquante questions une par une. Une ligne vide sépare deux questions, l'étoile marque la bonne réponse, le signe égal crée une estimation. Les questions sans étoile sont importées mais signalées.
- **👁 Aperçu** montre une question telle qu'elle sera projetée, sans lancer de partie.

Au tout premier démarrage, les quiz livrés dans `server/content/quiz/*.json` sont importés une fois dans la bibliothèque pour ne pas partir d'une page blanche. Ensuite ces fichiers ne servent plus à rien : tout vit dans la base.

## Déroulé d'une partie

L'animateur clique **Lancer un quiz** sur l'écran commun, choisit le quiz, et le 3-2-1 démarre. Pour chaque question : la question s'affiche, chacun répond sur son téléphone, la révélation montre la bonne réponse, la répartition des réponses, le plus rapide et le top 5. À la fin, podium — et les points s'ajoutent au **classement de la soirée**, qui survit d'un quiz à l'autre (et à un redémarrage du serveur).

Pendant une question, **l'écran commun bascule en mode scène** : les panneaux latéraux s'effacent, la question et les réponses grossissent, le QR code se réduit dans un coin — il reste visible pour les retardataires sans voler la vedette. Une barre de temps se vide en couleur (elle se lit du fond de la salle bien mieux qu'un chiffre) et passe au rouge dans les cinq dernières secondes.

**Le son** sort uniquement de l'écran commun : cinquante téléphones qui bipent ensemble, c'est une cacophonie. Les sons sont générés à la volée par le navigateur — aucun fichier à héberger, aucune musique sous droits, rien qui arrive en retard. Le bouton 🔊 de l'en-tête les coupe (le choix est mémorisé). Les navigateurs interdisant tout son avant une interaction, l'audio s'initialise au premier clic sur « Lancer un quiz ».

**L'animateur garde la main** : ⏸ pause (le chronomètre se fige, plus personne ne peut répondre), ↺ reposer la même question, ✖ annuler les points d'une question dont la réponse était fausse, renommer ou exclure un invité d'un clic sur sa pastille, et ⛶ plein écran. La clé n'apparaît jamais dans la barre d'adresse.

**⏩ Manuel / Auto 5 s / Auto 10 s** : en mode automatique, la question suivante part toute seule après la révélation, avec un décompte affiché. Un quiz de dix questions demandait vingt clics — autant d'occasions de décrocher de la soirée. Corriger ou reposer une question reprend la main aussitôt.

**En fin de soirée**, le bouton 🏆 célèbre le classement cumulé en plein écran, avec un QR vers la **page souvenir** (`/souvenir`) : podium, nombre de quiz, points distribués, le plus beau coup et le plus régulier. Elle est publique, à partager aux invités le lendemain.

**Entre deux soirées**, 🧹 Nouvelle soirée efface invités et points, sauvegarde distante comprise — les essais d'avant la fête ne doivent pas traîner dans le classement du soir J.

**Les retardataires entrent en cours de route** : quelqu'un qui arrive pendant un quiz rejoint la partie immédiatement. Il ne récupère rien sur les questions déjà posées, mais il joue toutes les suivantes. S'il arrive pendant une révélation, il est accueilli par un « 👋 Bienvenue » plutôt que par un « ⏰ Trop tard » pour une question qu'il n'a jamais vue.

## Où vivent les données

Deux stockages séparés, et c'est volontaire :

- **La bibliothèque de quiz** est le seul contenu précieux : elle doit survivre à un redéploiement. En local c'est un fichier (`server/data/quizzes.db`) ; en ligne, on pointe `QUIZ_DB_URL` vers une base **Turso** gratuite. Le code est le même — le client libSQL parle aux deux.
- **L'état d'une partie** (question en cours, réponses) vit dans une base SQLite locale, jetable. Elle permet la reprise après un crash.
- **Les invités et leurs points** sont recopiés dans la base distante au fil de l'eau et rechargés au démarrage si le disque local est reparti vide. Sur un hébergeur gratuit le disque est effacé à chaque redémarrage : sans ce miroir, la soirée repartirait à zéro sans que personne comprenne pourquoi.

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

## Mettre en ligne (gratuitement)

📄 **Mode d'emploi pas à pas, sites et commandes compris : [MISE-EN-LIGNE.md](MISE-EN-LIGNE.md).** Ce qui suit en est le résumé.

Objectif : les invités scannent le QR et jouent en 4G, sans réseau à installer sur place. Il faut un hébergeur qui tienne les WebSocket — GitHub Pages, Vercel et Netlify ne conviennent pas.

Deux comptes gratuits à créer (je ne peux pas le faire à ta place) :

**1. Turso — la bibliothèque de quiz.** Crée un compte, puis une base. Récupère son URL (`libsql://…`) et un jeton d'accès. L'offre gratuite (100 bases, 5 Go, 500 millions de lignes lues par mois) est sans commune mesure avec deux quiz de cinquante questions.

**2. Render — le serveur.** Connecte ce dépôt : Render lit `render.yaml` et crée le service. Renseigne ensuite les trois variables dans son interface :

| Variable | Valeur |
|---|---|
| `HOST_KEY` | une clé à toi, pas `romane` — quiconque l'a peut animer et éditer |
| `QUIZ_DB_URL` | l'URL `libsql://…` de Turso |
| `QUIZ_DB_TOKEN` | le jeton Turso |

L'adresse publique du QR code se règle toute seule : Render fournit `RENDER_EXTERNAL_URL`, le serveur s'en sert.

**3. Transférer les quiz écrits en local**, pour ne pas les ressaisir :

```bash
npm run migrate -- --to libsql://ta-base.turso.io --token ton-jeton
```

**4. Empêcher la mise en veille.** C'est la vraie limite de l'offre gratuite de Render : sans trafic entrant pendant 15 minutes, le service s'endort, et le réveil prend environ une minute — le premier invité qui scanne attendrait devant une page blanche. Deux parades, à combiner :

- Un service de ping gratuit (cron-job.org, UptimeRobot…) qui appelle `https://ton-app.onrender.com/healthz` toutes les 10 minutes. Le quota gratuit (750 heures/mois pour un mois qui en compte 730) permet de rester allumé en permanence.
- Ouvrir l'écran commun **cinq minutes avant** l'arrivée des invités. Tant qu'un écran ou un téléphone est connecté, le trafic des websockets empêche la veille.

Si tu préfères un hébergeur qui ne dort jamais, Northflank propose deux services toujours actifs sur son offre gratuite — mais il demande une carte pour vérifier le compte, ce que Render ne fait pas.

## Le repli : tout en local

Si la salle capte mal ou si l'hébergeur fait des siennes, le même code tourne sur ton PC avec un routeur wifi. Renseigne alors `WIFI_SSID`/`WIFI_PASS` : l'écran commun affiche **deux QR codes** (1️⃣ rejoindre le wifi, 2️⃣ ouvrir le quiz).

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | `3001` | Port du serveur |
| `HOST_KEY` | `romane` | Clé d'accès de l'écran commun et de l'éditeur (`?key=...`) |
| `DB_PATH` | `server/data/quizz.db` | Base de la partie en cours (jetable) |
| `QUIZ_DB_URL` | fichier voisin de `DB_PATH` | Bibliothèque de quiz : `file:...` ou `libsql://...` (Turso) |
| `QUIZ_DB_TOKEN` | — | Jeton Turso, si base distante |
| `PUBLIC_URL` | `RENDER_EXTERNAL_URL` | URL publique à mettre dans le QR code |
| `WIFI_SSID` / `WIFI_PASS` | — | Si définis : QR « rejoindre le wifi » sur l'écran commun |

## Test de charge

```bash
npm run load -- http://localhost:3001 50
```

Le script simule une salle entière : il inscrit N invités d'un coup, joue lui-même le rôle de l'écran commun et mesure ce qui compte le soir J. Relevé sur un PC portable, 50 invités : inscriptions 141 ms en moyenne (p95 201 ms), diffusion d'une question vers les téléphones 1 ms, révélation 2 ms, 80 Mo de mémoire serveur. À 100 invités, la diffusion reste à 1 ms et les inscriptions montent à 550 ms au pire — l'offre gratuite de Render (512 Mo) a de la marge.

## Identité visuelle

Direction **« Salsa nocturne »**, pensée pour une salle dans le noir : fond aubergine profond, magenta et or, une lueur qui respire derrière l'écran commun. Tout est dans `client/src/styles.css`, piloté par une dizaine de variables en tête de fichier — changer `--hot` et `--gold` suffit à réorienter toute l'application.

Trois règles ont guidé les choix, et elles valent pour toute évolution :

- **Le contraste avant la finesse.** L'écran commun est vu de loin sur un vidéoprojecteur. Deux couleurs distinctes sur un écran de PC peuvent devenir identiques à cinq mètres.
- **Aucune police téléchargée.** Tout repose sur des caractères déjà présents sur les machines (Bahnschrift condensée pour ce qui doit se lire de loin, Corbel pour le reste). Rien à charger, rien qui arrive en retard, et ça marche sans réseau.
- **La couleur n'est jamais seule.** Chaque réponse porte une forme (▲ ◆ ● ■) pour qui distingue mal les couleurs, et les animations se coupent si le système demande moins de mouvement.

L'espace animateur (`/edit`) partage la palette mais reste calme : pas de lueur, pas d'animation. C'est un outil de travail, pas un spectacle.

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
| 3 | Questions « estimation », entrée en cours de quiz, révélations enrichies | ✅ |
| 4 | Habillage show (mode scène, barre de temps, podium animé, sons) | ✅ |
| 5 | Déploiement gratuit (Render + Turso), QR public, test de charge à 50 joueurs | ✅ |
| 6 | Scores à l'abri d'un redémarrage, écran commun qui tient dans la hauteur | ✅ |
| 7 | Commandes d'animation : pause, question reposée, invités gérés | ✅ |
| 8 | Podium de la soirée et page souvenir | ✅ |
| 9 | Import en masse, aperçu, veille des téléphones, prénoms en double | ✅ |
