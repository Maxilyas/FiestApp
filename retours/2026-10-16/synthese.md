# « Turso répond vraiment lentement » — le gel du processeur, le 16 octobre 2026

Les demandes : « Turso répond vraiment lentement, tu peux analyser avec les
données de prod ? Est-ce que c'est les duels qui font ça ? », puis « Liste-moi
toutes les améliorations de perf possibles et celle que tu penses mettre en
place pour le gel du processeur », puis « Go » — la première étape du plan,
faite dans la même PR —, puis « Oui et passe à la suite » — la deuxième —,
puis « passe à la suite » — la troisième.

La revue s'appuie sur la base de production, lue en lecture seule et en
totaux (`reproductions/lecture-de-la-production.md`) — le relevé de l'heure
(`qg_sante`) et les démarrages, les volumes, des requêtes chronométrées — ;
sur le code ; et sur **un banc au volume de la production, le serveur bridé
au dixième de cœur comme sur Render** (`reproductions/README.md`). Les
constats, un par un : `constats.json`.

## En bref

1. **Ce ne sont pas les duels.** Les duels de tous les joueurs coûtent à
   Turso 9 ms de plus qu'un `SELECT 1`, ceux d'un joueur 5 ; la production
   en compte 149. Leurs routes ne paraissent que de loin en loin parmi les
   plus lentes de l'heure, derrière `/api/joueur/missions`, `/moi` et
   `/nouveautes`.
2. **Turso répond vite ; le serveur gèle.** Au relevé de l'heure, la médiane
   d'un aller-retour tourne autour de 100 ms, mais son 95ᵉ centile monte à
   1,7 s et ses pires à 6 s ; dans les mêmes heures, la boucle de Node se
   fige 1,2 à 3,7 s, et le processeur ne dépasse jamais 14,9 % d'un cœur au
   pire relevé de dix secondes — la marque d'un quota, qu'il touche dans
   onze des trente-sept heures chargées. L'offre gratuite de Render donne un dixième de cœur,
   par tranches de dix millisecondes chaque dixième de seconde : un calcul
   qui en demande plus attend la tranche suivante, et chaque aller-retour en
   vol attend avec lui. `avecDelai` chronomètre le `fetch` entier : le gel
   s'y compte comme du temps de Turso.
3. **Le banc le reproduit.** Bridé au dixième de cœur, le serveur gèle 1,3 à
   2 s à la première ouverture de la campagne, au tirage d'une série ou d'un
   dé, au réveil ; le ramasse-miettes s'y fige jusqu'à 1,5 s ; quatre
   téléphones qui ouvrent l'accueil ensemble y prennent douze secondes. La
   machine du banc était elle-même partagée : ses gels sont plus longs que
   ceux de Render, les rapports tiennent.
4. **Où part le processeur d'une requête** : 60 % dans le client de la base
   — le `fetch` de Node, le décodage de libsql, les sockets —, 1,5 à 2 ms
   par aller-retour sur un vrai cœur, dix à vingt au dixième. Il suit donc
   le nombre d'allers-retours : la page du profil en faisait seize, la
   pastille de « Profil » — demandée à chaque accueil — autant, en quatre
   vagues, et l'accueil quatorze.
5. **Et les calculs qui parcourent toute la base** — vingt-quatre mille
   questions : les sujets comptés à la première ouverture de la campagne
   (150 ms de processeur, 1,4 s de gel bridé), chaque tirage (35 à 120 ms,
   0,3 à 1,7 s), la validation de la base à chaque réveil (1,6 s de
   processeur, seize secondes de serveur saturé ; trois à onze réveils par
   jour en production, mises en ligne comprises).
6. **Chaque série garde ses soixante questions**, 22 Ko, pour neuf jouées en
   moyenne : 23 Mo dans la base, que les lectures du savoir rouvrent pour
   chaque réponse (`json_extract`) — vingt à trente millisecondes chez
   Turso, et 305 Ko décodés à chaque ouverture de la page des duels.

## Ce que la production a dit

Le relevé de l'heure (`qg_sante`, 14–16 octobre), les trente-sept heures
de cent appels et plus :

| Turso, médiane | Turso, 95ᵉ centile | Turso, pire | Routes, 95ᵉ centile | Boucle, pire gel | Processeur, pire relevé de 10 s |
|---|---|---|---|---|---|
| 46 à 219 ms | 0,6 à 1,7 s | 1,5 à 6,2 s | 0,9 à 3,3 s | 1,2 à 3,7 s | 5 à 14,9 % — jamais au-dessus, atteint dans 11 heures |

Les routes les plus lentes, heure après heure : `GET /api/joueur/missions`
(jusqu'à 6,6 s au 95ᵉ centile), `GET /api/joueur/moi`,
`GET /api/joueur/nouveautes` ; `GET /api/duels` et `POST /api/campagne/duel`
de loin en loin. Démarrages : 3, 11 et 4 les 14, 15 et 16 octobre, prêts en
4 à 7 s.

## Ce qui est fait dans cette PR — l'étape 1

- **La pastille de « Profil » ne refait plus la page** (perf-gel-3) :
  `ceQueLaLogeLit`, cinq lectures d'une vague au lieu de seize en quatre,
  chaque champ du même endroit que la page (`CeQueLaLogeLit`, `ToutDonne`) ;
  `profil-charge.test.ts` compare les deux comptes.
- **Une lecture de la campagne par profil** (perf-gel-4) :
  `CampagneStore.duProfil` — confettis, paliers, cote — que le solde lit
  d'un aller-retour au lieu de deux, et que la page du profil partage entre
  sa boutique, ses portraits, ses fonds et ses bordures.
- **La page des duels ne décode plus les questions de ses rencontres
  finies** (perf-gel-5).
- **`jourDe` gardé par heure** (perf-gel-6).
- **Le gel de l'hébergeur mesuré** (perf-gel-1) : `sondeDuGel` lit le cgroup
  du conteneur ; `/healthz` dit `charge.geleePct` et `geleeMaxPct`, le relevé
  de l'heure `gelePct` et `geleMaxPct`, la page « Le serveur » le montre sous
  le processeur.

Mesuré au banc, à chaud, l'accueil d'un téléphone — ses six requêtes de
front —, médianes de sept vagues (`reproductions/banc-vague.ts`) :

| | Avant | Après |
|---|---|---|
| Un joueur, processeur | 85 ms | 65 ms (−24 %) |
| Un joueur, allers-retours | 47 | 34 (−28 %) |
| Un joueur, au dixième de cœur | 1 091 ms, la boucle gelée 294 ms | 697 ms, 200 ms |
| Quatre joueurs, processeur | 361 ms | 272 ms (−25 %) |
| Quatre joueurs, au dixième de cœur | 4 096 ms, la boucle gelée 392 ms | 3 392 ms, 298 ms |

Et route par route, à chaud, pour le joueur qui a le plus répondu
(processeur) : la pastille 26 → 9 ms, les missions 49 → 33, la page des
duels 13 → 7, le carnet 27 → 20, la page du profil 20 → 14. À la première
visite après un réveil, au dixième de cœur, quatre accueils de front
passent de 12,1 à 7,5 s.

## L'étape 2 — les calculs sur toute la base

Puis « Oui et passe à la suite », dans la même PR :

- **Les sujets** (perf-gel-7) : `sujetsDe` lu par l'index de ce qui fait
  entrer une question dans un sujet — une étiquette, une portée, un
  sous-thème, des années — au lieu de passer les vingt-sept sujets pour
  chacune (35 à 60 ms → 14 à 30 pour la base, compilé) ; lus en fond après le
  démarrage, par tranches de mille (`preparerEnFond`) ; comptés une fois par
  liste de jouables (`sujetsComptes`), que la campagne, le quiz tout prêt et
  les parcours partagent.
- **Le tirage** (perf-gel-8) : ce qu'il relit de chaque question — sa
  marche, sa catégorie et son sous-thème — se prépare une fois par liste de
  jouables et par mesure (`PreparationDuTirage`, gardée par le serveur, prête
  dès le réveil, ses files gardées quand la mesure change). Il ne reste à
  chaque tirage que le battage, sur des indices, ses vues marquées depuis ses
  vues, et une passe qui range les jamais vues. **La même série qu'avant,
  question pour question, au même hasard** : `tirage-prepare.test.ts` garde
  l'ancien tirage entier et les compare sur la vraie base — toute la base,
  une catégorie, un sujet, de zéro à neuf dixièmes de questions vues.
- **Ce qui faisait tout refaire** : la réserve du quiz du jour se relisait
  en un ensemble neuf toutes les dix minutes, et la campagne refaisait alors
  ses jouables et tout ce qui s'en tire — elle garde désormais son ensemble
  tant qu'elle ne change pas ; et ceux qui trouvent la mesure périmée
  ensemble n'en relisent qu'une, et reçoivent la même.

Mesuré sur la vraie base, compilé comme en production (`banc-tirage.ts`) :

| | Avant | Après |
|---|---|---|
| Un tirage, joueur neuf · moyen · lourd | 13 · 15 · 25 ms | 1,4 · 1,5 · 2,7 ms |
| La préparation d'un tirage | — | 11 à 19 ms, une fois toutes les dix minutes au plus ; 5 ms quand seule la mesure change |
| Les sujets de toute la base | 35 à 60 ms, à la première ouverture | 14 à 30 ms, en fond |

Et au banc complet, le serveur au dixième de cœur (`banc-gel.ts GEL=1`,
après l'étape 1 → après l'étape 2) :

| | Avant | Après |
|---|---|---|
| La première ouverture de la campagne après un réveil | 1,6 s, la boucle gelée 1,5 s | 0,2 s, 0,17 s |
| Le dé du joueur le plus actif | 1,0 s, gelée 0,87 s | 0,2 s, 0,17 s |
| Une série et un dé d'un joueur moyen | 0,39 s et 0,37 s | 0,13 s et 0,07 s |
| La série du joueur le plus actif, premier tirage après le réveil | 1,1 s | 0,7 s — sa préparation, désormais faite en fond |

Le tirage qui suit l'expiration de la mesure reste lourd (1,2 à 1,4 s au
dixième de cœur) : la mesure se relit et se refait sur toute la base
(`mesuresEnFamille`), et le dé refait sa série de référence
(`serieDeReference`). Mesuré à part, compilé : 45 à 70 ms de processeur par
relecture — le décodage de ses deux textes 15 ms, les familles 9 à 22, la
préparation du tirage 4, la série de référence du dé 15 à 24 —, toutes les
dix minutes d'activité au plus. Moins que le réveil : il passe avant
(l'étape 4, plus bas).

## L'étape 3 — le réveil

Puis « passe à la suite », encore dans la même PR. À chaque démarrage —
trois à onze par jour en production, mises en ligne comprises —, le serveur
relisait la base de la campagne et repassait ses 24 131 questions au juge :
1,3 s de processeur sur les 1,6 de la lecture, treize secondes de serveur
saturé au dixième de cœur (perf-gel-9).

- **`npm run build` la vérifie une fois** et la range à côté du paquet, une
  question par ligne, telle que le juge la rend (`preparerLaBase`,
  `server/dist/index.campagne.ndjson`) ; le paquet en connaît le nom
  (`__BASE_PREPAREE__`) et la relit telle quelle (`lireLaBasePreparee`).
- **Au fil du fichier**, par morceaux de 64 Ko : un seul `JSON.parse` de ses
  vingt-cinq mégaoctets aurait figé le serveur deux secondes au dixième de
  cœur ; la lecture rend la main toutes les quelques millisecondes.
- **Écartée quand elle ne dit plus le dossier** — un fichier de la base qui
  a changé depuis le build, sa taille ou sa date, ou un autre format — : le
  journal le dit, et le dossier se relit et se vérifie, comme avant. Sous
  tsx (`npm run dev`, les tests, les scripts), rien ne change.

| La base, au réveil (`banc-reveil.ts`, compilé) | Avant | Après |
|---|---|---|
| Le temps | 0,96 à 1,13 s | 0,29 s |
| Le processeur | 1,1 à 1,2 s | 0,38 s |
| Le plus long bloc de la boucle | 23 à 96 ms | 5 ms |

Au journal du paquet : « base préparée relue : 24131 questions en 339 ms ».
Pas allégée : les corrections du QG et le dépôt de la routine relisent
l'entrée entière (`entreeDeLaBase`, ses `leurres`, ses `entites`) ; ôter ces
champs demanderait de la relire à la demande — 8 Mo de tas et 0,1 s de
plus à gagner.

## L'étape 4 — la mesure relue

Puis « passe à la suite » : ce que chaque mesure neuve refait, toutes les
dix minutes d'activité, sur le chemin de la requête qui la trouvait
périmée — le tirage ou le dé qui suivait son expiration, 1,2 à 1,4 s au
dixième de cœur.

- **Elle se relit avant d'être due** : demandée dans ses deux dernières
  minutes (`MESURE_EN_AVANCE_MS`), la suivante part en fond, puis ses
  familles et la préparation du tirage de toutes les catégories
  (`relireLaMesureEnFond`). Qui la demande pendant ce temps reçoit celle
  qu'il a trouvée ; la requête de la onzième minute trouve la neuve prête,
  sans un aller-retour. Une fois par mesure, même ratée : elle se relit
  alors à son heure, sur le chemin de la requête, comme avant. Sans
  activité dans ses deux dernières minutes, rien ne change.
- **Ses deux textes en tableaux** (`json_group_array`) : sept mille clés
  d'objet se décodaient deux à trois fois plus lentement que des triplets.
- **La série de référence du dé** lit ses marches de la préparation du
  tirage, qui les sait déjà (`referencePour`, `PreparationDuTirage.marche`),
  et trie chaque groupe — une marche, une catégorie — en tableau de nombres,
  d'un coup, au lieu de listes triées par une fonction (`serieDeReference`).
  La même au nombre près : `campagne-mesure.test.ts` garde l'ancienne et
  les compare sur la vraie base.

| Une mesure neuve (`banc-mesure.ts`, compilé, 7 000 questions jouées), médianes de trois passages | Avant | Après |
|---|---|---|
| Ses deux textes décodés | 11 à 16 ms | 5 à 7 ms |
| Ses familles (`mesuresEnFamille`) | 5 à 7 ms | 5 à 7 ms |
| La préparation du tirage | 3 à 4 ms | 3 à 4 ms |
| La série de référence du dé | 11 à 13 ms | 6 à 7 ms |
| En tout | 30 à 37 ms, sur le chemin de la requête | 19 à 23 ms, en fond sous l'activité |

Le premier passage, à froid — le cas d'une mesure toutes les dix minutes,
que le moteur de JavaScript a peut-être oubliée —, coûte deux fois la
médiane, avant comme après. Restent à prendre : les familles, qu'un index
par base réduirait, et ce qu'il a vu, encore décodé d'un objet à chaque
série (`lectureDesVues`) — un à deux millisecondes pour les plus fidèles.

## La suite proposée

2. ~~**Les calculs sur toute la base**~~ : faits (les étapes 2 et 4, plus
   haut).
3. ~~**Le réveil**~~ : la base vérifiée au build (l'étape 3, plus haut).
   L'alléger des champs que le jeu ne lit pas reste à faire (perf-gel-10).
4. **Le transport**, mesuré en préproduction d'abord : un `fetch` sur
   `https.request`, ou Hrana sur WebSocket (perf-gel-2).
5. **Les questions des séries** : la catégorie et le niveau sur la réponse,
   puis les seules questions jouées gardées (perf-gel-11).

Hors du code : la plus petite offre payante de Render (un demi-cœur, jamais
endormie) quintuple le budget et supprime les réveils — un choix de budget.
La page « Le serveur » dira désormais, heure par heure, quelle part du temps
le dixième de cœur a manqué.
