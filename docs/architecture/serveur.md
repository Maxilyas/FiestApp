# Le serveur

> Le serveur de l'intérieur, pour qui va le modifier : démarrage et arrêt,
> registres et magasins, routes et erreurs, le moteur et son module de jeu, les
> tâches de fond, le paquet.

**Dans cette page** : [Les fichiers d'entrée](#les-fichiers-dentrée) ·
[Le démarrage, pas à pas](#le-démarrage-pas-à-pas) ·
[L'arrêt](#larrêt) ·
[Les registres et les magasins](#les-registres-et-les-magasins) ·
[Les routes](#les-routes) ·
[Le moteur et le module de jeu](#le-moteur-et-le-module-de-jeu) ·
[Les tâches de fond](#les-tâches-de-fond) ·
[Le paquet](#le-paquet)

## Les fichiers d'entrée

| Fichier | Rôle |
|---|---|
| `server/src/index.ts` | Lit l'environnement, refuse les configurations dangereuses, lance `createQuizServer`, puis pose le filet et l'arrêt propre |
| `server/src/server.ts` | `createQuizServer` : Express, Socket.io, l'ordre du démarrage, `/healthz`, les pages publiques d'un espace, le client compilé, ce qui touche à tout (`removeAccount`, `supprimerProfil`) et l'arrêt (`close`) |
| `server/src/api.ts` | `mountApi` : l'ordre des gardes de `/api`, puis la bibliothèque |
| `server/src/sockets.ts` | `wireSockets` : le protocole temps réel, chaque message passé par `ecouter()` ; et `cloreLaSoiree`, que l'écran commun et le QG partagent |
| `server/src/racine.ts` | `SERVEUR`, le dossier `server/` d'où se compte tout chemin |

Express et Socket.io partagent un seul serveur HTTP, qui sert aussi le client
compilé : une seule chose à héberger.

## Le démarrage, pas à pas

```mermaid
flowchart TD
  IDX["index.ts — lit l'environnement<br/>refuse sans QUIZ_DB_URL en ligne"] --> CQS["createQuizServer — Express,<br/>en-têtes, Socket.io"]
  CQS --> LOC["initDb — la base locale"]
  LOC --> AUTH["AuthStore.init, ensureDefaultSpace<br/>les comptes d'abord, seuls"]
  AUTH --> FRONT{{"deFront — treize branches de front"}}
  FRONT --> B1["le miroir : init, restoreInto,<br/>stampLegacySpace"]
  FRONT --> B2["profils, quiz du jour,<br/>rappel du soir"]
  FRONT --> B3["bibliothèque et amorce, programmes,<br/>partages, salons"]
  FRONT --> B4["campagne, journal des gestes,<br/>santé, maintenance, historique"]
  B1 & B2 & B3 & B4 --> LIENS["les branchements entre magasins,<br/>adopterLesComptes"]
  LIENS --> RELU["les relectures uniques : recalculerHistorique,<br/>reprendreLesPortraits, relireLesJours,<br/>relireLesSeries, appliquerLeBaremeDuSolo"]
  RELU --> SALLE["SpaceRegistry, wakeRunning<br/>les parties en cours repartent"]
  SALLE --> SOCK["wireSockets"]
  SOCK --> ROUTES["les routes : /healthz, /s/…,<br/>mountApi, le client compilé"]
  ROUTES --> LISTEN["listen — « prêt en N ms »"]
  LISTEN --> APRES["sante.demarrer, rappels.demarrer,<br/>la base de la campagne 20 s plus tard"]
  APRES --> FILET["index.ts — le filet,<br/>SIGTERM et SIGINT"]
```

1. **L'environnement** (`server/src/index.ts`). « En ligne » vaut `RENDER` non
   vide ou `NODE_ENV=production`. En ligne sans `QUIZ_DB_URL`, le serveur
   refuse de démarrer : sur un fichier local, comptes, quiz et archives
   disparaissaient au premier réveil. Chez soi, la base permanente est un
   fichier `quizzes.db` à côté de la base locale. Un `RESERVE_TOKEN` de moins
   de 32 caractères laisse fermée la porte de la routine
   ([la configuration](../reference/configuration.md)).
2. **Express et Socket.io.** Express perd `x-powered-by`, prend l'analyseur de
   requête simple (l'étendu repose sur `qs`, et ses failles de déni de
   service) et, en ligne, `trust proxy` à un saut ; puis viennent le minutage
   des routes, `compression()`, les en-têtes de sécurité. Socket.io bat toutes
   les 10 s et lâche après 8 — une liaison morte se voit en 18 s au lieu de
   45 — et refuse en ligne une origine autre que l'origine publique.
3. **La base locale** : `initDb` (`server/src/core/db.ts`) ouvre SQLite en WAL,
   crée les sept tables, ajoute les colonnes manquantes.
4. **Les comptes d'abord, seuls** : tout le reste est rangé par espace.
   `AuthStore.init()` crée ses tables, fait le ménage des sessions expirées et
   charge tout en mémoire ; `ensureDefaultSpace` crée l'administrateur ou
   relit l'espace par défaut. En ligne, sur une base sans compte, un
   `ADMIN_PASSWORD` absent ou laissé à `demo` arrête tout (`DemarrageRefuse`)
   — là seulement : exigé à chaque démarrage, il empêchait la production de se
   réveiller une fois la variable retirée.
5. **Les magasins se construisent**, chacun avec son client libSQL
   (`clientDistant`, `server/src/core/distante.ts`), qui abandonne une requête
   après 10 s : sans lui, on a mesuré 301 s d'attente, et tout gelait.
6. **Treize branches de front** (`deFront`) : le miroir (ses tables,
   `restoreInto` si la base locale est vide, `stampLegacySpace`), les profils,
   le quiz du jour et l'amorce de sa réserve, le rappel du soir, la
   bibliothèque et son amorce (`seedLibrary`), les programmes, les partages,
   les salons, la campagne, le journal des gestes, la santé du serveur, la
   maintenance (le bandeau, les pages fermées du QG et leurs testeurs, `Maintenance`),
   l'historique. En série, chaque réveil attendait soixante allers-retours —
   trois secondes de page blanche ; et un échec ne remonte qu'une fois toutes
   les branches finies, pour que rien n'écrive plus après.
7. **Les branchements.** Le quiz du jour et la campagne reçoivent les profils
   à leur construction ; ce qui ne relie les magasins qu'à la lecture se
   branche une fois tous ouverts, par des fonctions —
   `profiles.statsDuJour = id => jour.statsDuJour(id)`, le laurier, les paliers
   des sentiers, les confettis de la campagne… Puis `adopterLesComptes` donne
   une fois son profil à chaque compte d'animateur d'avant.
8. **Les relectures uniques**, chacune sous sa version ou son drapeau :
   `recalculerHistorique` (sans les soirées en cours, lues dans la table locale
   `soiree`), `reprendreLesPortraits`, `jour.relireLesJours`,
   `campagne.relireLesSeries`, `appliquerLeBaremeDuSolo`. Une base qui hoquette
   ici fait échouer le démarrage, que l'hébergeur relance : le recalcul ne
   remet jamais au barème du jour les lignes d'une archive que la base n'a
   pas rendue.
9. **La salle** : le QR du wifi (`WIFI_SSID`, `WIFI_PASS`), `SpaceRegistry`,
   puis `wakeRunning()`, qui réveille chaque espace dont une partie était
   `running` dans `sessions` — son moteur réarme ses chronomètres. Les autres
   attendent leur première connexion ou leur première page.
10. **Le temps réel** (`ReserveDInscriptions`, `wireSockets`), puis **les
    routes**, dans l'ordre décrit plus bas.
11. **L'écoute** : le port s'ouvre, le journal dit
    `[serveur] prêt en N ms — au plus M invités par soirée`. Ensuite seulement
    — un réveil n'attend pas un aller-retour de plus — `sante.demarrer` écrit
    ce démarrage, la base de la campagne se lit en fond 20 s plus tard, et le
    rappel du soir regarde l'heure chaque minute.
12. **Le filet** (`server/src/index.ts`) : une promesse rejetée sans personne
    pour l'attendre ou une exception échappée partent au journal, et le serveur
    continue — tomber, c'était éteindre les soirées de tous les espaces pour un
    incident qui n'en touchait qu'une. Avant ce point, un démarrage raté
    s'arrête net (code 1), sur une ligne qui dit quoi faire.

## L'arrêt

`SIGTERM` ou `SIGINT` appelle `close()` une seule fois ; un minuteur force la
sortie 12 s après le signal. L'ordre :

1. le filet de l'instantané et le préchauffage de la campagne s'arrêtent ;
2. `sante.arreter()` écrit tout de suite l'extinction propre — l'hébergeur
   coupe net trente secondes après avoir prévenu ;
3. le rappel du soir et la mesure de charge s'arrêtent ;
4. `registry.stopAll()` : chaque moteur éteint ses chronomètres (leurs
   échéances restent écrites), écrit la réponse en attente et pousse son
   dernier état au miroir ;
5. `io.close()`, puis la file du miroir se vide — 10 s au plus, le reste est
   abandonné et dit au journal ;
6. la base locale se ferme, puis les magasins, les profils en dernier.

Un chronomètre qui sonnerait après la fermeture révélerait sur une base
fermée ; une resynchronisation en attente relit la base locale ; un crédit
d'expérience parti avec le dernier quiz garde le plus long sursis. En ligne, la
commande lance `node` lui-même (`exec node`) : par `npm start`, le signal se
perdait.

## Les registres et les magasins

Les **registres** tiennent la soirée en cours d'un espace : base locale,
recopiée au miroir. Les **magasins** tiennent ce qui doit survivre, dans la
base permanente. Ce qui ne vit qu'en mémoire part à chaque redémarrage.

| Nom | Fichier | Rôle | Base(s) |
|---|---|---|---|
| `SpaceRegistry` · `SpaceRuntime` | `server/src/core/space.ts` | Une soirée par espace, créée à la demande : registres, moteur, diffusions, scène, nom de la soirée, crédits, clôture | mémoire ; la table locale `soiree`, l'historique et les crédits |
| `Party` | `server/src/core/party.ts` | Les invités : jetons, profil, connexions, homonymes | locale (`players`), miroir |
| `Teams` | `server/src/core/teams.ts` | Les équipes et leurs prix | locale (`teams`, `team_bonus`), miroir |
| `ScoreLedger` | `server/src/core/scores.ts` | Le journal des gains, en ajout seul | locale (`score_entries`), miroir |
| `AnswerLog` | `server/src/core/answers.ts` | Une ligne par invité et par question posée | locale (`answer_log`), miroir |
| `GameEngine` | `server/src/core/engine.ts` | Une partie à la fois : route, persiste, rediffuse | locale (`sessions`), miroir |
| `PartyBackup` | `server/src/core/backup.ts` | Le miroir : files, lots, resynchronisation, restauration, santé | permanente (`party_*`) |
| `AuthStore` | `server/src/auth/store.ts` | Comptes (les espaces), sessions d'animateur, activations | permanente, tout en mémoire |
| `ProfileStore` | `server/src/auth/profiles.ts` | Profils, sessions, expérience, étagère, Éclats, achats | permanente (`profiles`, `profile_*`) |
| `QuizStore` | `server/src/core/quizStore.ts` | La bibliothèque et ses photos | permanente (`quizzes`, `quiz_images`, `meta`) |
| `ProgrammeStore` | `server/src/core/programmes.ts` | Le programme d'une soirée | permanente (`programmes`) |
| `PartageStore` | `server/src/core/partages.ts` | Les codes de partage, le catalogue | permanente (`partages`, `catalogue`) |
| `SalonStore` | `server/src/core/salons.ts` | Le code à six chiffres d'un salon | permanente (`salons`), mémoire |
| `ArchiveStore` | `server/src/core/archive.ts` | L'historique des soirées | permanente (`soirees`) |
| `JourStore` · `RappelStore` | `server/src/core/jour.ts`, `server/src/core/rappels.ts` | Le quiz du jour ; le rappel du soir | permanente (`jour_*`) |
| `CampagneStore` | `server/src/core/campagne.ts` | Campagne, défi, sentiers, parcours, duels, amis | permanente (`campagne_*`, `sentier_acquis`, `sentier_melanges`) ; ses questions dans `server/content/campagne/` |
| `JournalDesGestes` · `SanteDuServeur` | `server/src/core/journalDesGestes.ts`, `server/src/core/santeDuServeur.ts` | Le journal du QG ; la santé du serveur sur sept jours, et chaque erreur serveur en détail (`server/src/core/erreurs.ts`) | permanente (`qg_*`) |
| `PagesPubliques` | `server/src/core/pages.ts` | Souvenir et bilan calculés une fois, gardés compressés | mémoire |
| `PlacesRendues` · `ReserveDInscriptions` · `Appairages` | `server/src/core/places.ts`, `server/src/core/inscriptions.ts`, `server/src/auth/appairage.ts` | Codes « Rendre sa place », réserve d'inscriptions, branchement des télés | mémoire |

- **La base d'abord, la mémoire ensuite** (`AuthStore`, `ProfileStore`) :
  dans l'autre ordre, une écriture refusée valait jusqu'au redémarrage, et une
  révocation refusée ressuscitait.
- **Une colonne venue après coup** passe par `ajouterColonne` dans la base
  permanente, qui lit le schéma une fois par table au lieu de prendre tout
  refus pour « elle existe déjà » (`addColumn` dans la locale).
- **Un registre écrit en local, puis au miroir**, ses seules lignes ; un gain
  ou une réponse reçoit son `uid` à l'écriture locale. Le détail :
  [Les données](./donnees.md), [les tables](../reference/base-de-donnees.md).

## Les routes

### Qui déclare quoi

| Fichier | Les familles de routes | Monté par |
|---|---|---|
| `server/src/server.ts` | `/healthz` ; `/s/:slug/…`, les pages publiques d'un espace ; les anciennes adresses (302) ; `/media/quiz` ; `/robots.txt` ; le client compilé | `createQuizServer` |
| `server/src/auth/routes.ts` | `/api/auth/*`, `/api/space/*`, `/api/admin/accounts*` | `mountAuthApi` |
| `server/src/auth/appairage.ts` | `/api/auth/appairage*` | `mountAppairage` |
| `server/src/auth/profileRoutes.ts` | `/api/joueur/*` | `mountProfileApi` |
| `server/src/quizDuJour.ts` | `/api/jour/*`, dont la réserve de la routine ; `/api/admin/jour/*` | `mountJour`, `mountReserve`, `mountJourAdmin` |
| `server/src/campagne.ts` | `/api/campagne/*`, `/api/duels/*`, dont la base de la routine ; `/api/admin/campagne*` | `mountCampagne`, `mountBaseDeLaCampagne`, `mountCampagneAdmin` |
| `server/src/partages.ts` | `/api/partages/*`, `/api/catalogue*`, `/api/admin/catalogue*`, le partage d'un quiz | `mountPartages` |
| `server/src/profilsAdmin.ts` | `/api/admin/profils*`, `/api/admin/espaces*` | `mountProfilsAdmin` |
| `server/src/qg.ts` | `/api/admin/qg*`, `/api/admin/activite`, `/api/admin/soirees*`, `/api/admin/serveur`, `/api/admin/gestes` | `mountQg` |
| `server/src/api.ts` | `/api/quizzes*`, `/api/images`, `/media/image/:id`, `/api/modeles*`, `/api/programmes*`, `/api/quiz-tout-pret*`, `/api/soirees/:id` | `mountApi` |

Chaque route, sa méthode et son accès : [l'API HTTP](../reference/api-http.md).

### Les gardes, dans l'ordre

1. Le minutage des routes d'API, sous leur modèle, jamais leur adresse ;
   `compression()` ; `nosniff`, `Referrer-Policy`, `Permissions-Policy`, et
   une politique de contenu qui n'ouvre le temps réel qu'à l'hôte demandé.
2. `/healthz`, les pages publiques `/s/:slug/…` (un espace inconnu : 404
   « Soirée introuvable »), les anciennes adresses.
3. Sous `/api` :
   1. `csrfGuard` : toute écriture porte `X-Requested-With: quizz` et, en
      ligne, ne dit pas d'autre origine que la publique — sinon 403
      « Requête refusée » ;
   2. `/api/admin` gardé d'un bloc (`requireAccount`, `requireAdmin`,
      `refuserLesTeles`), puis `journaliser`, qui note au journal du QG chaque
      geste accepté — posé route par route, un garde retiré ne faisait rougir
      aucune épreuve ;
   3. les routes hors de la porte commune — comptes, appairage, profil du
      joueur, quiz du jour, campagne et duels, dépôts de la routine (derrière
      `RESERVE_TOKEN`) —, chacune avec ses gardes et un petit lecteur JSON ;
   4. `requireAccount` sur tout le reste : 401 « Connexion requise », vérifié
      **avant** de lire le corps — sinon n'importe qui faisait analyser quatre
      mégaoctets de JSON ;
   5. le lecteur JSON de 4 Mo (les photos arrivent en dataURL) — jamais pour
      une lecture (`GET`, `HEAD`), qui n'a pas de corps —, puis les routes
      réservées aux animateurs et à l'administrateur.
4. `/media/quiz` ; puis toute adresse inconnue sous `/api`, `/media` ou `/s` :
   404 en JSON, jamais la page d'accueil.
5. `/robots.txt` et le client compilé : `/assets` déjà compressé, les dossiers
   d'images peintes, un fichier absent en 404 ; toute autre adresse passe par
   `servirPage`, qui pose statut, aperçus, préchargements et attente
   ([Le client](./client.md)).
6. `erreurDeRequete`, le dernier filet.

### Comment une erreur devient une réponse

Tout passe par `server/src/core/http.ts`. Une route asynchrone s'enveloppe dans
`wrap` (Express 4 n'attrape pas les rejets de promesse), et `repondreErreur`
tranche par `erreurMontrable` :

| L'erreur | La réponse | Le journal |
|---|---|---|
| un `Error` nu, sans `code` : `new Error('Cet identifiant est déjà pris')` | 400, son message | rien |
| toute autre : `LibsqlError`, `TypeError`, `ENOENT`… | 500, « Erreur serveur — réessaie dans un instant » | le détail, et une erreur au relevé de l'heure |
| un JSON cassé | 400, « Requête illisible — recharge la page et réessaie » | une ligne : sa sorte (`entity.parse.failed`…) et les en-têtes qui annonçaient le corps — jamais le corps |
| un corps trop lourd | 413, « Envoi trop lourd — allège-le et réessaie » | la même ligne |
| un fichier du paquet que le téléphone laisse en route — il change de page, perd le réseau : `ECONNABORTED`, que `servirPrecompresse` tait | aucune : plus personne pour la lire | rien, et rien au relevé de l'heure |

La règle tient à la classe : un message fait pour l'invité se lève par un
`new Error('…')` nu, en français, et dit quoi faire ; le reste parle de tables
et de colonnes — rien qui aide un invité, tout ce qui renseigne un curieux.
L'écran commun suit la même règle dans ses toasts (`messagePourEcran`), et la
page d'erreur d'Express, pile comprise, ne sort jamais.

## Le moteur et le module de jeu

Chaque `SpaceRuntime` construit son `GameEngine` (`server/src/core/engine.ts`)
avec `quizModule` (`server/src/games/quiz.ts`), le seul module branché.
**Le moteur ne connaît aucune règle** : il route réponses, commandes et
chronomètres vers le module, persiste et rediffuse. **Le module ne connaît ni
base ni réseau** : il reçoit l'état et un contexte, et rend des vues.

### Le contrat d'un module

`GameModule`, dans `server/src/core/types.ts` :

| Crochet | Quand | Ce qu'il rend |
|---|---|---|
| `createInitialState` | au lancement, qui termine la partie d'avant | l'état neuf |
| `onLaunch` | juste après | rien : il agit par le contexte |
| `onPlayerAction` | une réponse d'invité | un motif de refus (`ActionRefusal`), ou rien si elle est retenue |
| `onHostCommand`, `onTimer` | un geste d'animateur, un chronomètre | rien |
| `onPlayerJoin`, `onPlayerLeave` | un retardataire (`joinLate`), un exclu | rien |
| `reponseEnSuspens` | avant de rendre une place par code | vrai si une réponse attend son verdict |
| `playerView`, `hostView` | à chaque diffusion | la vue d'un invité, celle des écrans d'animateur |
| `vueDependDesAutres` | une promesse | `false` : une réponse ne change que la vue de son auteur et celle de l'écran commun |

Le **`GameContext`** est la seule façon d'agir : `award`, `logAnswers` (une
ligne par participant, réponse ou non), `dropAnswers`, `setTimer`,
`clearTimer`, `end`, `verdict` (le podium est à l'écran : l'expérience peut se
créditer), et de quoi lire. Le **`ViewContext`** des vues ne fait que lire ;
son `memo` calcule une fois par diffusion ce qui ne dépend pas du destinataire,
un classement, un podium — chaque vue retriait la salle, une demi-minute de
processeur par question à cinq cents invités.

### Un passage : `run()`

```mermaid
flowchart TD
  G["un geste : réponse, commande,<br/>chronomètre, arrivée, exclusion"] --> O["ouvrirLot()"]
  O --> H["le module joue son passage<br/>avec le GameContext"]
  H --> FIN{"ctx.end() ?"}
  FIN -->|oui| E["endSession — partie close,<br/>session:ended à tout l'espace,<br/>onSessionEnded — apresQuiz"]
  FIN -->|non| VV{"une simple réponse ?<br/>ni phase, ni chronomètre, ni journal"}
  VV -->|oui| P1["persistBientot, fanoutCible<br/>sa vue, l'écran commun à sa cadence"]
  VV -->|non| P2["persist — l'état en local, puis au miroir<br/>fanout — chaque vue qui a changé"]
  E --> F["fermerLot() — une transaction<br/>vers la file du miroir"]
  P1 --> F
  P2 --> F
  F --> A["onScoresChanged — l'instantané regroupé<br/>onVerdict, si la partie continue — apresQuiz"]
```

- **Un lot par passage** : gains, réponses et état partent ensemble, sans quoi
  un processus tué entre deux envois faisait révéler deux fois la même
  question au réveil.
- **L'état** (`sessions.state`, avec la copie exacte du quiz joué) s'écrit en
  local avec les échéances des chronomètres. Une simple réponse attend la fin
  du tour de boucle — deux cents réponses lues d'un coup réécrivaient deux
  cents fois l'état — et ne part au miroir qu'au plus toutes les 2 s
  (`MIRROR_INTERVAL_MS`) ; tout le reste part sur-le-champ.
- **Les vues** ne partent que si elles ont changé, et l'écran commun reçoit la
  sienne quatre fois par seconde au plus pendant une question
  (`HOST_INTERVAL_MS`).
- **Un chronomètre** sonne hors de toute requête : une exception s'arrête au
  journal sans emporter le processus.
- **Un verdict ou une fin de partie** lance `apresQuiz` : la soirée se range
  dans l'historique, l'expérience du quiz se crédite.

### Ce que fait `quizModule`

Ses phases (`pickPack`, `getReady`, `intertitre`, `observe`, `question`,
`cible`, `reveal`, `finished`) et ses chronomètres (`ready`, `intertitre`,
`observe`, `question`, `settle`, `autoNext`) s'écrivent avec la partie. Il garde trois
mémoires par espace, relues après chaque écriture : la bibliothèque jouable
(`setQuizLibrary`), le programme de ce soir (`setProgramme`), la dernière pose
de chaque question (`setQuestionsPosees`) ; deux relectures revenaient de
Turso dans le désordre, et seule la dernière demandée pose désormais ce
qu'elle a lu (`derniereRelecture`). Une partie joue sa propre copie du quiz,
tirée une fois. Son barème des QCM sert aussi le quiz du jour
(`server/src/core/jour.ts` importe `pointsDuChoix`, `GRACE_MS`…) : y toucher
change les deux. → [Les questions](../produit/les-questions.md),
[Le temps réel](./temps-reel.md)

## Les tâches de fond

| Tâche | Où | Rythme | Ce qu'elle fait |
|---|---|---|---|
| Les chronomètres d'une partie | `GameEngine` | à l'échéance | échéances écrites avec la partie, réarmées au redémarrage |
| Les fenêtres d'une partie | `GameEngine` | 250 ms ; 2 s | la vue de l'écran commun pendant une question ; le va-et-vient recopié au miroir |
| L'instantané | `SpaceRuntime.broadcastSnapshot` | 120 ms (+ 2 ms par invité aux téléphones) | une diffusion par fenêtre, dédoublonnée |
| Le filet de l'instantané | `server/src/server.ts` | 5 min | renvoie tout, dédoublonnage ignoré : un client qui a manqué une diffusion se répare |
| La file du miroir | `PartyBackup` | en continu | réessais de 250 ms à 15 s ; « en retard » à l'écran après 10 s ; resynchronisation au rétablissement |
| La mesure de charge | `Charge` (`server/src/core/pouls.ts`) | 10 s | processeur, boucle (sonde à 100 ms), mémoire, invités connectés |
| La santé du serveur | `SanteDuServeur` | 10 min (`RELEVE_MS`) | le relevé de l'heure et un signe de vie, gardés huit jours |
| Le rappel du soir | `RappelStore` | chaque minute | la tournée part dès 18 h, jamais à partir de 22 h |
| La base de la campagne | `CampagneStore.prechauffer` | une fois, 20 s après l'ouverture | vérifiée au build et relue telle quelle par le paquet, par morceaux de 64 Ko (`lireLaBasePreparee`) — sous tsx, relue et vérifiée par tranches de 200 questions ; chaque tranche rend la main ; puis ses index, les sujets de chaque question, par tranches de mille, les familles de la mesure, la préparation des tirages (`preparerEnFond`) et le modèle du savoir, chaque étape à son tour de boucle (`rendreLaMain`, plus bas) : la première ouverture de la campagne et le premier tirage les trouvent faits |
| La mesure des difficultés | `CampagneStore.mesures` | demandée dans ses deux dernières minutes (`MESURE_EN_AVANCE_MS`) | la suivante relue en fond, puis ses familles et la préparation des tirages (`relireLaMesureEnFond`), chacune à son tour de boucle : la requête qui l'aurait trouvée périmée la trouve prête ; une fois par mesure, même ratée — elle se relit alors à son heure, sur le chemin de la requête |
| La réserve du jour pour `/healthz` | `server/src/server.ts` | 10 min au plus | relue en arrière-plan ; `/healthz` répond avec ce qu'il a |
| La fin d'une télé branchée | `server/src/sockets.ts` | à l'heure dite | sa connexion tombe, même sans un geste |

**Une étape de fond par tour de boucle** (`rendreLaMain`,
`server/src/core/tourniquet.ts`). Les calculs de fond de la campagne rendent
la main entre leurs étapes, mais plusieurs qui attendent la même chose — la
base au réveil, une mesure neuve — repartaient ensemble, dans la même phase
de la boucle : les index de la base, ses familles, la préparation des tirages
et la série de référence faisaient un seul bloc de 130 ms, 1,3 s de serveur
figé au dixième de cœur de l'hébergeur. Le tourniquet n'en laisse repartir
qu'une par tour, dans l'ordre où elles l'ont demandé : les requêtes arrivées
entre deux sont lues, et le plus long gel n'est plus que la plus longue étape
— vingt à trente millisecondes : les index de la base, ou la première
préparation d'un tirage (`travail-de-fond.test.ts`).

**Rien ne tourne la nuit** : l'hébergeur gratuit dort. La journée d'hier du
quiz du jour se clôt à la première demande d'aujourd'hui (`clorePasses`), les
semaines passées du défi à la première demande qui suit, et le modèle du
savoir — qu'Automate lit pour les duels, et la page des sentiers pour dire
à chacun sa chance — se réajuste quand il a vieilli, à la demande de l'un ou
de l'autre (`MODELE_GARDE_MS`). Un service externe garde la production éveillée en
journée en appelant `/healthz`, qui répond toujours 200 : un échec ferait
redémarrer l'instance, disque et file du miroir perdus
([Exploiter](../exploitation/exploiter.md)).

## Le paquet

| | Commande | Ce qu'elle lance |
|---|---|---|
| Construire | `npm run build` | `vite build`, puis `server/scripts/empaqueter.ts` : esbuild, de `server/src/index.ts` à `server/dist/index.mjs`, ESM, Node 20, `shared/` compris |
| Démarrer en ligne | `cd server && exec node --single-threaded-gc --no-memory-reducer --max-old-space-size=320 dist/index.mjs` (`render.yaml`) | le paquet, sans tsx, le ramasse-miettes réglé pour le dixième de cœur |
| Démarrer chez soi | `npm start` | `tsx src/index.ts` : les sources, pas le paquet |

- **Pourquoi** : chaque réveil de l'offre gratuite est un démarrage, et tsx y
  traduisait tout le TypeScript — 0,8 à 1 s de processeur et 40 Mo de plus sur
  un dixième de cœur, quelques secondes de page blanche au premier invité.
- **Les dépendances restent dans `node_modules`** (`packages: 'external'`),
  binaires de better-sqlite3 et de libSQL compris.
- **`SERVEUR`** (`server/src/racine.ts`) est le dossier `server/`, d'où se
  comptent les quiz livrés (`server/content/quiz/`), la base de la campagne,
  la base locale par défaut et le client compilé (`client/dist/`). Le paquet
  vit un étage sous `server/`, comme `server/src/index.ts` : un chemin compté
  depuis l'`import.meta.url` d'un module y menait hors du dépôt — ni amorce,
  ni modèles, ni réserve du jour, et pas une erreur.
  `server/test/exploitation.test.ts` démarre un vrai paquet.

## Pour aller plus loin

- [La vue d'ensemble](./vue-d-ensemble.md) · [Le temps réel](./temps-reel.md) ·
  [Les données](./donnees.md) · [La sécurité](./securite.md)
- [L'API HTTP](../reference/api-http.md) ·
  [Les événements](../reference/evenements-temps-reel.md)
- [Exploiter](../exploitation/exploiter.md) — `/healthz`, le dépannage
- [Démarrer](../contribuer/demarrer.md) — `npm run dev`, une modification
