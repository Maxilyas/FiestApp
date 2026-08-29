# Quizz Romane 30 🎉

Quiz façon Kahoot, gratuit et auto-hébergé, pour les 30 ans de Romane (19 septembre 2026). Chaque invité joue depuis son téléphone (navigateur, rien à installer), un écran commun (TV/vidéoprojecteur) anime la soirée, et un classement cumulé traverse tous les quiz de la soirée — en individuel **et** par équipe, le quiz n'étant qu'un des trois jeux de la fête.

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
| Statistiques | http://localhost:5173/stats | Antoine pendant la fête, tout le monde après |

```bash
npm run check
```

```bash
npm run smoke
```

`check` = typecheck serveur + client. `smoke` = test de bout en bout (inscription, quiz complet, scoring, classement, reconnexion, bibliothèque, photos, estimation, retardataire, photo « mémoire », équipes, barème des trois jeux, statistiques et prix).

## Écrire ses quiz

Tout se passe dans **Mes quiz** (`/edit`), protégé par la même clé que l'écran commun. On y crée, duplique et supprime des quiz ; dans un quiz, on ajoute des questions, on les réordonne, on choisit la bonne réponse, le temps de réponse et une photo.

Deux types de questions, au choix pour chacune :

| Type | Comment on répond | Score (200 pts max) |
|---|---|---|
| 🔘 **QCM** | 2 à 4 réponses, une bonne (2 = vrai/faux) | 100 pts si c'est juste + jusqu'à 100 pts de rapidité |
| 🔢 **Estimation** | chacun tape un nombre | 30 pts pour avoir joué + jusqu'à 120 pts selon la proximité + 50 pts au plus proche |

Un **vrai/faux** n'est qu'un QCM à deux réponses : on tape « Vrai » et « Faux » dans les deux premières cases et on laisse les autres vides.

L'estimation évite les blocages : même sans connaître la réponse, on propose un chiffre et on marque quelque chose. La proximité est calculée **par rapport au groupe** — sinon une erreur de 3 ans sur une date et une erreur de 3 km sur une distance rapporteraient la même chose. Le plus proche empoche le maximum, le plus loin garde ses 30 pts de participation. À égalité d'écart, le plus rapide gagne.

- **Les cases de réponse vides** sont simplement ignorées en jeu (et la bonne réponse suit son texte, pas son numéro de case).
- **Les brouillons ne sont jamais perdus** : une question incomplète est enregistrée telle quelle, signalée par un ⚠️, et sautée au moment de jouer. La liste affiche « 8 questions prêtes · 2 à compléter ».
- **Photos** : le navigateur les réduit et les recompresse avant l'envoi (une photo de téléphone de 4 Mo devient ~150 Ko), puis elles vivent dans la base.
- **On peut changer d'avis** jusqu'à la révélation, sur un QCM comme sur une estimation : un doigt qui glisse sur un téléphone tenu dans le noir ne doit pas coûter la question. C'est le dernier envoi qui fait foi, heure comprise — se raviser coûte donc du bonus de rapidité, sans quoi on pourrait taper au hasard dès la première seconde pour s'assurer le maximum, puis corriger tranquillement.
- **Coller une liste** évite de saisir cinquante questions une par une. Une ligne vide sépare deux questions, l'étoile marque la bonne réponse, le signe égal crée une estimation. Les questions sans étoile sont importées mais signalées.
- **👁 Aperçu** montre une question telle qu'elle sera projetée, sans lancer de partie.
- **🙈 La photo disparaît** transforme n'importe quelle question — QCM comme estimation — en jeu de mémoire. Voir plus bas.

Au tout premier démarrage, les quiz livrés dans `server/content/quiz/*.json` sont importés une fois dans la bibliothèque pour ne pas partir d'une page blanche. Ensuite ces fichiers ne servent plus à rien : tout vit dans la base.

## Déroulé d'une partie

L'animateur clique **Lancer un quiz** sur l'écran commun, choisit le quiz, et le 3-2-1 démarre. Pour chaque question : la question s'affiche, chacun répond sur son téléphone, la révélation montre la bonne réponse, la répartition des réponses, le plus rapide et le top 5. À la fin, podium — et les points s'ajoutent au **classement de la soirée**, qui survit d'un quiz à l'autre (et à un redémarrage du serveur).

Pendant une question, **l'écran commun bascule en mode scène** : les panneaux latéraux s'effacent, la question et les réponses grossissent, le QR code se réduit dans un coin — il reste visible pour les retardataires sans voler la vedette. Une barre de temps se vide en couleur (elle se lit du fond de la salle bien mieux qu'un chiffre) et passe au rouge dans les cinq dernières secondes.

**Le son** sort uniquement de l'écran commun : cinquante téléphones qui bipent ensemble, c'est une cacophonie. Les sons sont générés à la volée par le navigateur — aucun fichier à héberger, aucune musique sous droits, rien qui arrive en retard. Le bouton 🔊 de l'en-tête les coupe (le choix est mémorisé). Les navigateurs interdisant tout son avant une interaction, l'audio s'initialise au premier clic sur « Lancer un quiz ».

**L'animateur garde la main** : ⏸ pause (le chronomètre se fige, plus personne ne peut répondre), ↺ reposer la même question, ✖ annuler les points d'une question dont la réponse était fausse, renommer ou exclure un invité d'un clic sur sa pastille, et ⛶ plein écran. La clé n'apparaît jamais dans la barre d'adresse.

**⏩ Manuel / Auto 5 s / Auto 10 s** : en mode automatique, la question suivante part toute seule après la révélation, avec un décompte affiché. Un quiz de dix questions demandait vingt clics — autant d'occasions de décrocher de la soirée. Corriger ou reposer une question reprend la main aussitôt.

## La photo qui disparaît

Cochez **🙈 La photo disparaît avant la question** sous une photo et la question devient un jeu de mémoire. La photo est d'abord projetée **seule**, en grand, pendant le nombre de secondes choisi : ni l'intitulé ni les réponses ne partent sur les téléphones, qui affichent « 👀 Mémorise ! ». Puis elle disparaît et la question démarre avec son chronomètre normal.

C'est cette phase séparée qui fait le jeu. Afficher la photo et les réponses en même temps reviendrait à laisser répondre en la regardant — la mémoire n'y servirait plus à rien.

Le mécanisme marche pour les deux types de question : un QCM (« combien de bougies sur le gâteau ? ») comme une estimation (« en quelle année cette photo a-t-elle été prise ? »). **La photo revient à la révélation**, pour vérifier ensemble ce qu'on croyait avoir vu. L'animateur peut abréger l'observation d'un clic sur **Passer à la question** si tout le monde a déjà vu.

Une photo sans cette case cochée se comporte comme avant : elle reste affichée à côté de la question.

## Les prix de fin de soirée

Chaque réponse est journalisée : qui, à quelle question, en combien de temps, juste ou faux, et même les questions laissées passer. Le classement seul ne suffirait pas — il ne retient que les gains positifs, donc ni les erreurs, ni les temps de réponse n'y laissent de trace.

De ce journal sortent **une vingtaine de prix**, calculés tout seuls : ⚡ L'Éclair (le plus rapide en moyenne), 🐢 Le Contemplatif (le plus lent, mais juste), 🔫 La Gâchette Facile (vite et faux), ⏰ Le Buzzer de Fin, 💯 Le Sans-Faute, 🙃 Le Cancre Magnifique, 😴 L'Abstentionniste, 🔥 L'Invincible, 🌚 La Série Noire, 🔮 Le Devin, 🎈 L'Optimiste, 🪨 Le Pessimiste, 🎯 Le Pile-Poil, 🦄 Le Franc-Tireur, 🐑 Le Mouton, ✋ Le Doigt qui Tremble, 🦸 Le Sauveur, 📈 La Remontada, 📉 La Chute Libre, 👁️ L'Œil de Lynx, plus deux prix d'équipe : 🤝 Le Coup de Pouce et ⚖️ La Plus Solidaire.

**Rien n'est attribué automatiquement.** L'écran **🏅 Remise des prix** les propose avec le nom du lauréat, la règle et le chiffre qui la justifie ; l'animateur choisit lesquels il remet et combien de points ils valent. Un panneau libre permet d'en inventer d'autres (« ont chanté le plus fort », +3), et un prix mal donné se retire d'un clic. Un prix ne se propose que s'il a de la matière : trois réponses ne font pas une moyenne.

Ces points s'ajoutent au **barème des trois jeux**, pas à la moyenne du quiz : ce sont deux choses différentes, et les mélanger rendrait les deux illisibles. L'écran **👑 Victoire** annonce l'équipe qui remporte le quiz, prix compris — reste à y ajouter les deux jeux physiques.

**Les chiffres vivent sur `/stats`**, à leur propre adresse : un tableau de dix-sept colonnes, triable en cliquant sur un en-tête, une ligne par joueur — points, réponses données, justes, fausses, taux de réussite, temps moyen, meilleur temps, plus longues séries, questions passées, revirements, réponses de dernière seconde, fois où l'on était seul de la salle, fois où l'on a suivi la majorité, estimations et leur écart moyen, biais optimiste ou pessimiste. La page se rafraîchit toute seule et n'a pas besoin de clé : elle se garde ouverte sur le téléphone de l'animateur pendant la fête, et se partage aux invités ensuite. Le tableau défile dans son propre cadre — dix-sept colonnes ne tiennent sur aucun téléphone. Un QR y mène depuis l'écran de remise des prix, et la page souvenir en reprend l'essentiel.

**L'écran de victoire** montre les deux classements côte à côte : les équipes avec leur total du quiz, leurs points cumulés et leur moyenne d'un côté ; le classement individuel de l'autre. Les équipes décident du vainqueur, mais c'est pour son score personnel que chacun a joué — les deux méritent d'être à l'écran au même moment.

## Faire durer le suspense

Avec cinquante invités et un classement cumulé, les mêmes trois personnes mènent dès le premier quiz et 47 autres regardent une course perdue d'avance. Deux mécaniques corrigent ça.

**Le multiplicateur.** Avant de lancer un quiz, l'animateur choisit **points normaux, ×2 ou ×3**. Annoncé à la salle, un dernier quiz en points doubles rend tout rattrapable jusqu'à la dernière question — un écart de 400 points redevient jouable. Le multiplicateur s'affiche en or sur l'écran commun et sur chaque téléphone : un bonus qu'on ne voit pas ne motive personne.

**Les prix de caractère.** En plus des trois premiers, l'écran du podium et la page souvenir désignent **le plus beau coup** (le plus gros score sur une seule question), **le plus régulier** (celui qui a marqué sur le plus de questions) et **le vainqueur de chaque quiz** — autant de cadeaux à remettre, et une raison pour chacun de rester dans la partie.

**En fin de soirée**, le bouton 🏆 célèbre le classement cumulé en plein écran, avec un QR vers la **page souvenir** (`/souvenir`) : podium, nombre de quiz, points distribués, le plus beau coup et le plus régulier. Elle est publique, à partager aux invités le lendemain.

**Entre deux soirées**, 🧹 Nouvelle soirée efface invités et points, sauvegarde distante comprise — les essais d'avant la fête ne doivent pas traîner dans le classement du soir J.

## Les équipes

Le quiz n'est **qu'un jeu sur trois** : les deux autres se jouent debout, hors de l'application. Chacun garde donc ses points personnels, et les équipes s'en déduisent — pas de score collectif saisi à la main, pas de double comptabilité.

**Rejoindre son équipe.** L'inscription se fait en deux écrans : prénom + avatar, puis l'équipe. Le deuxième n'apparaît que si l'animateur a créé des équipes ; sinon on rejoint directement, comme avant. Depuis la salle d'attente, chacun peut encore se corriger tant qu'aucun quiz ne tourne — pendant une partie, c'est refusé : changer d'équipe emporte ses points, ce serait un déménagement de score entre deux questions.

**Le classement d'équipe se fait à la moyenne par membre, pas au total.** Six équipes ne se remplissent jamais à égalité parfaite, et une équipe de neuf battrait mécaniquement une équipe de six. Le total reste affiché en petit — c'est lui qu'on commente à voix haute — mais c'est la moyenne qui classe.

**Le barème des trois jeux.** À la fin, le quiz rapporte à chaque équipe autant de points que son rang le permet : avec six équipes, **6 points à la première, 5 à la deuxième, … 1 à la dernière**. C'est le chiffre en turquoise sur l'écran commun et sur la page souvenir — celui à recopier sur le tableau des trois jeux, où s'ajoutent les résultats des deux jeux physiques. Deux équipes à égalité partagent le même rang et les mêmes points.

**Côté animateur**, le panneau *Invités* regroupe les pastilles par équipe : on repère d'un coup d'œil qui s'est trompé, et un menu déroulant sur la pastille le déplace. On crée une équipe (nom + emoji), on la renomme, on la supprime — **supprimer une équipe n'exclut personne** : ses membres repassent « sans équipe » et gardent leurs points. Le bouton ✨ crée les six équipes par défaut d'un coup, à renommer ensuite.

**Entre deux questions**, l'écran commun annonce qui mène : les équipes d'abord, le top du quiz ensuite — c'est le classement d'équipe qui décide de la soirée. Chaque téléphone montre au même moment son total, son rang, et où en est son équipe.

**Le podium** bascule entre 👥 *Les équipes* (podium collectif + barème à reporter) et 🏆 *Les joueurs* (podium individuel + prix de caractère). Les deux comptent : le classement individuel fait jouer chacun, le classement d'équipe désigne le vainqueur de la soirée.

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
client/   React + Vite — 5 routes : "/" (téléphone), "/host" (écran commun), "/edit" (mes quiz),
          "/stats" (les chiffres), "/souvenir" (le lendemain)
server/   Node + Socket.io + Express — logique de jeu 100% côté serveur
shared/   Types TS partagés (protocole socket, vues du quiz, bibliothèque, barème des équipes)
```

- **Party** (`server/src/core/party.ts`) — registre des joueurs. L'identité survit aux coupures : un token stocké sur le téléphone permet de retrouver son joueur après un refresh, une perte de réseau ou un redémarrage du serveur.
- **Teams** (`teams.ts`) — registre des équipes, séparé des joueurs : une équipe vit toute la soirée, ses membres vont et viennent. Le rattachement est une colonne sur le joueur, donc déplacer quelqu'un déplace ses points sans toucher au journal des scores.
- **AnswerLog** (`answers.ts`) — une ligne par joueur et par question posée, réponses manquantes comprises. C'est la seule source des statistiques : le classement, lui, ne garde que les gains positifs. Une question annulée ou reposée en sort, pour ne pas compter deux fois.
- **Stats** (`stats.ts`) — les moyennes, les séries et les prix, dérivés du journal. Les prix sont proposés, jamais appliqués : c'est l'animateur qui décide.
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
| 10 | Équipes : points individuels, classement collectif, barème des trois jeux | ✅ |
| 11 | Photo « mémoire » et classements annoncés entre deux questions | ✅ |
| 12 | Journal des réponses, statistiques, prix de fin de soirée et écran de victoire | ✅ |
