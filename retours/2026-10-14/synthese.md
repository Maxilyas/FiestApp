# Turso « deux fois plus lent qu'hier » — la revue de performance du 14 octobre 2026

La demande : « Les routes sur Turso ont doublé par rapport à hier en temps de
latence, tu pourrais me faire une review complète niveau perf et ce que l'on
peut améliorer ? »

Sans accès à la production — ni Turso, ni Render, ni les journaux —, la
revue s'appuie sur trois choses : le code ; ce que le dépôt sait déjà de la
production (la page « Le serveur » du QG, et ce que `/healthz` disait le 13
octobre, noté dans `server/test/duels-attente.test.ts`) ; et **un banc qui
rejoue le vrai chemin de la production** : un faux Turso qui parle le
protocole HTTP de libsql, une latence réglable par aller-retour, et une
activité jouée par les vraies routes — sur le code d'hier soir et sur celui
d'aujourd'hui. Tout se rejoue (`reproductions/`, son `README.md`). Aucun
fichier de l'application n'a été modifié.

## En bref

1. **Le code n'a ajouté aucun aller-retour depuis hier soir.** Le même banc,
   rejoué sur `c3b2f99` (13 octobre, 21 h 14 : la PR #195, celle qui a mis
   en route la page « Le serveur ») et sur `ea5b144` (aujourd'hui), compte
   les mêmes allers-retours, et les mêmes en série, sur toutes les routes
   des joueurs et tous les gestes de jeu. Le réveil en a trois à cinq de plus
   (68 → 71, ou 70 → 75 selon l'état de la base).
2. **Ce qui a doublé cette nuit, c'est la base de la campagne** : 11 059 →
   21 887 questions, 10 → 20 Mo de JSON (la PR #194, fusionnée à 0 h 06).
   Sa lecture, à chaque réveil, coûte 1,8 fois plus de processeur (776 →
   1 416 ms sur la machine du banc — de l'ordre de 6 s au dixième de cœur
   de Render, qui en mettait 3,5 pour l'ancienne) et 19 Mo de tas de plus ;
   le tirage d'une série passe de 30 à 43 ms de processeur, le dé de 15 à
   25, une épreuve et les sujets prennent 30 à 40 % de plus.
3. **Ce que la page appelle « Turso » compte aussi le processeur du
   serveur.** Le chrono part avant le `fetch` et s'arrête quand la boucle
   d'événements reprend la main après lui (`core/distante.ts:112-120`) : au
   dixième de cœur, une boucle occupée, ou un processus que l'hébergeur met
   en pause faute de quota, s'y ajoute. Le 13 octobre, `/healthz` disait
   **230 ms de médiane et 765 ms au 95ᵉ centile par aller-retour** ; pour
   une base en Europe, le réseau seul en coûte de 2 à 30. Et près de la
   saturation, l'attente ne suit pas la charge : un processeur occupé à
   50 % qui passe à 75 % fait attendre trois fois plus (une file d'attente,
   ρ/(1−ρ)). Les 40 % de calcul que la base a ajoutés aux gestes de la
   campagne peuvent suffire à doubler les temps.
4. **« Ce qu'un joueur attend » compte aussi l'administrateur**, et Turso
   compte tout ce qui part en fond. Le 95ᵉ centile des routes mêle
   `/api/admin/*` à celles des joueurs (`server.ts:259-271`) — et quatre
   pages neuves du QG sont arrivées depuis cette nuit (le quiz du jour, la
   campagne, les duels, l'économie), chacune avec ses grosses lectures. Avec
   quelques dizaines d'appels dans l'heure, le 95ᵉ centile, c'est le
   deuxième ou le troisième appel le plus lent : ouvrir ces pages un matin
   suffit à le déplacer.
5. **Le vrai multiplicateur, ce sont les allers-retours en série.** À
   230 ms pièce : la page du profil en attend 6 (≈ 1,4 s), « Commencer » le
   quiz du jour 7, chaque question 6 — la réponse 3, « Question suivante »
   3 —, la dernière réponse 10 (≈ 2,3 s), un réveil 35 (≈ 8 s avant
   d'ouvrir le port). Tout ce qui alourdit un aller-retour se paie autant de
   fois.

Le doublement vient donc, selon toute vraisemblance, du **processeur** — la
base doublée, amplifiée par la saturation du dixième de cœur — et du **QG**
ouvert ce matin, compté dans la même mesure ; peut-être aussi des
**connexions** (plus bas, à vérifier). Pas des allers-retours du code. La
page « Le serveur » permet de trancher en dix minutes.

## Ce qu'il faut regarder pour trancher (sans rien changer)

Sur la page « Le serveur » (`/admin#serveur`), pour les heures qui ont
doublé :

- **Les trois routes les plus lentes de l'heure** (sous les graphiques, les
  `lentes` du relevé). Des `/api/admin/…` : ce sont les pages neuves du QG,
  ouvertes ce matin, qui pèsent dans « ce qu'un joueur attend ». Des
  `POST /api/campagne/serie`, `/rencontre`, `/sentiers/epreuve`,
  `GET /api/joueur/moi` : c'est le calcul.
- **Le processeur et le pire gel de la boucle**, contre le pointillé des
  10 % de l'hébergeur. Au plafond pendant les heures lentes : le chrono de
  Turso mesure l'attente du processeur.
- **Les démarrages** : « prêt en » d'aujourd'hui contre ceux d'hier. Un
  réveil attend 35 allers-retours l'un derrière l'autre : son temps, divisé
  par 35, dit ce que vaut un aller-retour ce jour-là.

Dans `/healthz` : `base.p50Ms` — si la médiane a doublé aussi, c'est tout le
chemin qui ralentit, pas une requête lourde de temps en temps ;
`charge.cpuPct` et `charge.retardBoucleMaxMs` ; `campagne.savoir.dureeMs`,
ce que le dernier ajustement du modèle d'Automate a duré, rendu de main
compris. Et une fois : `turso db show fiestapp`, pour la région de la base
(le service Render est à Francfort).

## Ce qui a changé depuis hier soir, mesuré

Le banc a joué la même activité sur les deux commits — quatorze profils au
quiz du jour, deux séries chacun, une épreuve, un duel contre Automate, le
défi, des duels classés, une soirée close —, puis un réveil à disque effacé,
puis chaque route à froid et à chaud, à 30 ms par aller-retour.

| | hier soir (`c3b2f99`) | aujourd'hui (`ea5b144`) |
|---|---|---|
| Base de la campagne | 11 059 questions | 21 887 questions |
| Réveil : allers-retours · vagues en série | 68 à 70 · 35 | 71 à 75 · 35 |
| Accueil, à chaud : allers-retours · en série | 12 · 2 | 12 · 2 |
| Profil, à chaud | 17 · 6 | 17 · 6 |
| Une réponse au quiz du jour | 3,2 · 3,3 | 3,2 · 3,3 |
| Profil, pendant que la base se lit (à 30 ms) | 290 ms | 488 ms |
| `/api/jour`, pendant que la base se lit | 134 ms | 258 ms |
| Tirage d'une série (processeur, médiane de six) | 30 ms | 43 ms |
| Lecture de la base au réveil (processeur) | 776 ms | 1 416 ms |
| Tas de la base | 20 Mo | 39 Mo |

Les allers-retours sont identiques ; ce qui change, c'est le calcul —
surtout pendant que la base se lit, vingt secondes après chaque réveil
(une seconde sur le banc) : deux fois plus longue, sa lecture occupe le
processeur en même temps que les premières requêtes.

## Les constats

Chacun son identifiant, repris dans `constats.json` avec sa preuve. Les
gains sont estimés à 230 ms par aller-retour, la médiane du 13 octobre.

### Le processeur

**[perf-turso-1] La base de la campagne se valide entièrement à chaque
réveil, et elle a doublé.** `lireLaBaseSansBloquer`
(`core/baseCampagne.ts:324-370`) relit les douze fichiers et repasse chaque
question au crible : le profil du chargement montre l'enlèvement des
accents (`sansAccent`, 14 %, et `\p{Diacritic}`, 3 %), la validation
(`lireQuestionDeLaBase`, `lireEtiquetage`, `tronquer`, 17 %), le
ramasse-miettes (7 %) ; le `JSON.parse` des 20 Mo, lui, ne fait que 78 ms.
Tout se calcule pareil d'un réveil à l'autre. **Piste** : la valider une fois,
au build (`npm run build` écrit la base lue — empreintes, `soufflee`, racines
comprises — dans le paquet ; le serveur la relit, et relit les sources s'il
ne la trouve pas, en développement et aux tests). Mesuré : de 1,4 s à
0,5 s de processeur (−60 %), et 6 Mo de tas de moins sans ce que le
serveur ne lit jamais (l'explication, la source, la description des
entités, ce qui reste à relire). Les fichiers du dépôt restent la seule
vérité : la base compilée se refait à chaque build.

**[perf-turso-2] Tout le préchauffage part en même temps, 20 s après
l'ouverture du port** (`CampagneStore.prechauffer`,
`core/campagne.ts:1638-1646`) : la base (ci-dessus), toutes les cotes des
duels, la mesure des difficultés (un parcours complet des réponses de
campagne), et le modèle du savoir (un autre, avec deux regroupements, puis
son ajustement). Au dixième de cœur, c'est plusieurs secondes de processeur
plein, pendant lesquelles chaque requête et chaque aller-retour attendent.
**Piste** : les étaler (la base d'abord, le reste derrière, une à une).

**[perf-turso-3] La mesure des difficultés et le modèle du savoir relisent
toutes les réponses de campagne**, la première toutes les dix minutes sur le
chemin de la requête qui la trouve périmée (`mesures`,
`core/campagne.ts:944-963`), le second toutes les demi-heures et à chaque
réveil (`LECTURE_DU_SAVOIR`, `core/campagne.ts:5621-5625`). Deux parcours
complets de `campagne_reponses`, qui grandissent à chaque réponse jouée —
du temps chez Turso, des lignes lues au quota, un gros texte à décoder ici.
Deux requêtes simultanées qui la trouvent périmée la relisent deux fois (pas
de promesse partagée dans `mesures`). **Piste** : ne lire que ce qui est
venu depuis la dernière lecture (`WHERE r.rowid > ?` : le plan est une
recherche par la clé, `reproductions/plans.mjs`), en gardant les sommes en
mémoire ; ou les tenir à jour à chaque réponse, le serveur étant le seul à
écrire.

### Les allers-retours en série

**[perf-turso-4] Le quiz du jour attend la base 75 fois l'une derrière
l'autre par partie** (≈ 17 s à 230 ms). La trace aller par aller
(`reproductions/trace.ts`) :

- une réponse (`JourStore.repondre`, `core/jour.ts:1071`) : sa partie relue,
  puis le lot qui l'écrit, puis l'expérience (`ecrireXp`) — 3 ;
- « Question suivante » (`suivante`, `core/jour.ts:1033`) : sa partie
  relue, puis la vue, puis la question servie — 3 ;
- « Commencer » : 7 vagues ;
- la dernière réponse : **10**, l'une derrière l'autre — les paliers de fin
  de partie, un haut fait, deux lectures de badges, une ligne d'expérience,
  le total, l'Éclat, le compagnon (`enregistrer`, `core/jour.ts:1158-1170`).

**Pistes** : la partie gardée en mémoire sous le verrou du profil (le
serveur est seul à l'écrire, comme la série en cours de la campagne,
`enCours`) : −1 sur la réponse et sur « Question suivante » ; l'expérience et
tout ce que la fin décerne écrits **après** la réponse, le verrou tenu
jusque-là — comme le dé (`avecVerrouJusquALEcriture`) : la question suivante
et l'écran de fin attendent le verrou, donc trouvent tout écrit. De 75 à
une quarantaine par partie (≈ 9 s au lieu de 17), dont 9 de moins sur la
seule dernière réponse.

**[perf-turso-5] La page du profil enchaîne 6 vagues** (`detailDe`,
`auth/profileRoutes.ts:97-140`) : la carrière du quiz du jour et ses
réponses (2), puis les badges et l'historique, puis les titres des soirées,
puis les statistiques, puis la boutique — chacune attend la précédente.
**Piste** : la nuit close d'abord (`clorePasses`, en mémoire presque
toujours), puis tout de front : 3 vagues (≈ −0,7 s).

**[perf-turso-6] La même lecture, plusieurs fois dans la même requête.**
Les paliers des sentiers (`sentier_acquis` et les épreuves) se lisent 4 fois
pour la page du profil et 3 fois pour l'accueil, la cote des duels 2 fois :
chaque porte les demande à part — `detailDe` (`auth/profileRoutes.ts:115`),
la boutique (`auth/profiles.ts:1222`), les fonds de la carrière
(`auth/profiles.ts:1958`), les confettis de campagne
(`core/campagne.ts:1660`), les statistiques de campagne. **Piste** : une
lecture en vol partagée par profil (`CampagneStore.paliersDe`,
`releveDesDuels`) : la seconde demande reçoit la promesse de la première —
−4 allers-retours au profil, −3 à l'accueil, sans rien changer à ce qu'on lit.

**[perf-turso-7] Un réveil attend 35 vagues avant d'ouvrir le port**
(≈ 8 s à 230 ms ; 1,06 s à 30 ms sur le banc). Trois chaînes : les comptes
(`AuthStore.init`, `auth/store.ts:137-218`, 8 allers-retours l'un après
l'autre), la soirée à recharger (`restoreInto`, `core/backup.ts:1089-1095` :
sept `SELECT` successifs ; et le schéma des six tables `party_*`, lu table
après table, `core/backup.ts:432-443`), et les drapeaux relus un par un
après le démarrage de front (le recalcul, les jours, les séries, le barème
du solo, les portraits). **Piste** : chacune en un lot — une douzaine de
vagues (≈ −5 s par réveil). Et le recalcul relit tout `profile_xp` à chaque
réveil pour y chercher une ligne d'une ancienne version (`detail NOT LIKE`,
`auth/profiles.ts:3561`) : un drapeau à la version du barème lui
éviterait ce parcours.

### Les parcours complets

Les plans viennent d'`EXPLAIN QUERY PLAN`, avec les vrais arguments, sur la
base du banc. Sans `ANALYZE` — ni sur le banc, ni chez Turso —, SQLite ne
sait rien du volume : le plan lu ici est celui de la production. Chaque
réécriture proposée a été vérifiée (`reproductions/plans.mjs`).

**[perf-turso-8] Le carnet parcourt tous les duels du serveur, à chaque
accueil.** `suivisDe` (`core/campagne.ts:1744`) écarte les défis ouverts par
`s.duel IN (SELECT code FROM campagne_duels WHERE ferme_le > ?)` : la liste de
tous les duels ouverts, sans index sur `ferme_le` (`SCAN campagne_duels`) —
l'accueil de chaque profil (le compte « À revoir »), le carnet, ce qu'il a
appris. **Piste** : `EXISTS (SELECT 1 FROM campagne_duels d WHERE d.code =
s.duel AND d.ferme_le > ?)`, une recherche par la clé pour ses seuls duels.

**[perf-turso-9] La page de l'économie parcourt toutes les réponses de
campagne**, à chaque ouverture (`economieDepuis`,
`core/campagne.ts:5250`) : le commentaire compte sur
`idx_campagne_series_commencee`, mais le planificateur préfère parcourir
`campagne_reponses` et chercher chaque série par sa clé (`SCAN r`).
**Piste** : `CROSS JOIN`, qui impose l'ordre — les séries par leur date, puis
leurs réponses par la clé.

**[perf-turso-10] Les séries du QG parcourent `jour_parties` et
`profile_xp` entiers** (`seriesEnCours`, `core/jour.ts:2650-2654`) : leur
`UNION` se fusionne en parcourant les deux tables par profil, trois fois
(une par lecture du lot). **Piste** : `UNION ALL` — un `IN` n'a que faire des
doublons —, et chaque moitié prend l'index de sa date
(`idx_jour_parties_jour`, `idx_profile_xp_quand`).

**[perf-turso-11] `/healthz` parcourt la réserve du quiz du jour toutes les
dix minutes** — la tâche de cron-job.org qui garde la production éveillée
l'appelle autant (`reserveDuJour`, `server.ts:742-757` →
`etatDeLaReserve`, `core/jour.ts:709`). **Piste** : `avanceDeLaReserve`
(`core/jour.ts:2511`), que la vue d'ensemble lit déjà, par son index.

### La mesure

**[perf-turso-12] La page « Le serveur » mêle ce qu'elle compare.** Le 95ᵉ
centile « ce qu'un joueur attend » compte les routes de l'administration ;
celui de Turso compte le réveil, le préchauffage, la mesure des
difficultés, le modèle du savoir, le relevé lui-même — et le temps que la
boucle met à revenir. **Pistes**, toutes agrégées et sans un nom comme le
reste du relevé : les routes `/api/admin` à part ; Turso « sous une route »
et « en fond », séparés par un `AsyncLocalStorage` posé dans le minutage des
routes ; les connexions neuves vers Turso, comptées par le canal de
diagnostic `undici:client:connected` (sans dépendance) ; le gel imposé par
l'hébergeur, lu dans `/sys/fs/cgroup/cpu.stat` (`throttled_usec`, sous
try/catch) — la preuve directe que le processeur fait la latence.

### Le transport

**[perf-turso-13] Une connexion vers Turso tient 4 s de calme, puis se
rouvre** — si Turso n'annonce pas son délai. Le `fetch` de Node referme une
connexion inactive au bout de 4 s quand le serveur ne dit rien
(`keepAliveTimeout` d'undici, démontré par
`reproductions/connexions.mjs`) ; la requête suivante repaie alors TCP et
TLS — deux allers-retours réseau de plus, et le chiffrement au dixième de
cœur. Hors soirée, la plupart des requêtes arrivent sans doute après plus de
4 s de calme.
**Piste**, après la mesure de [perf-turso-12] : un agent au délai plus long
pour les seules requêtes de Turso — `undici` en dépendance (une de plus :
au propriétaire d'en décider, le dépôt en veut peu) ou le dispatcher global
de Node, remplacé sans dépendance par un autre de sa classe —, toujours sous
le délai d'inactivité de Turso :
une connexion que Turso aurait fermée ferait échouer l'écriture qui
l'emprunte.

## Le plan proposé

1. **Trancher**, aujourd'hui : la page « Le serveur » et `/healthz`
   (ci-dessus).
2. **Une petite PR sûre**, chaque correction avec son test au compteur
   d'allers-retours que les tests ont déjà (`duels-attente.test.ts`,
   `jour-charge.test.ts`) : le carnet [8], l'économie [9], les séries du QG
   [10], `/healthz` [11], les lectures partagées [6], la mesure séparée
   [12].
3. **Les allers-retours en série**, un par un : le quiz du jour [4], le
   profil [5], le réveil [7].
4. **Le processeur** : la base validée au build [1], le préchauffage étalé
   [2], la mesure et le modèle en delta [3].
5. **Le transport** [13], si la mesure montre des connexions neuves à la
   plupart des requêtes.

Hors du code, le levier le plus direct : le processeur. Au dixième de cœur,
chaque milliseconde de calcul en coûte jusqu'à dix d'attente ; la plus petite
offre payante de Render (un demi-cœur, jamais endormie) diviserait ce terme
et supprimerait les réveils — un choix de budget, pas une correction.

## Le banc

- **Le faux Turso** (`reproductions/faux-turso.ts`) parle le protocole
  Hrana v2 sur HTTP, adossé à un fichier SQLite. Le serveur s'y branche par
  une adresse `http://` : chaque requête emprunte le vrai chemin — le client
  HTTP de libsql, sa limite de vingt requêtes en vol, son décodage JSON,
  `avecDelai` (`core/distante.ts`), qui nourrit `pouls.base` et le relevé.
  Le fichier `file:` des tests ne passe pas par `fetch`.
- **La latence** se règle par aller-retour (0 ou 30 ms). L'écart entre 30 et
  0 ms, divisé par 30, dit combien d'allers-retours une route attend l'un
  derrière l'autre ; les vagues de la trace le montrent directement.
- **Le processeur** se mesure à latence nulle (`process.cpuUsage`), sur une
  machine plusieurs fois plus rapide que le dixième de cœur de Render : les
  rapports comptent, pas les valeurs.
- **Les limites** : pas de vraie latence de Turso ni de vraies poignées de
  main TLS ; des volumes de banc (quelques centaines de réponses de
  campagne, pas des dizaines de milliers) — les plans, eux, ne dépendent pas
  du volume ; le miroir des soirées n'a pas été mesuré.

## Annexes

### Les routes à 30 ms par aller-retour (aujourd'hui)

À froid : la première requête après un réveil à disque effacé ; à chaud : la
seconde. « En série » : les allers-retours attendus l'un derrière l'autre.

| Route | à froid : ms, allers | à chaud : ms, allers, en série |
|---|---|---|
| `GET /api/joueur/moi?accueil` | 252, 19 | 82, 12, 2 |
| `GET /api/joueur/moi` (profil) | 488, 23 | 210, 17, 6 |
| `GET /api/joueur/carte` | 103, 9 | 71, 9, 2 |
| `GET /api/jour` | 258, 10 | 69, 4, 2 |
| `GET /api/jour/correction/:jour` | 102, 3 | 101, 3, 3 |
| `GET /api/campagne` | 103, 4 | 36, 4, 1 |
| `GET /api/campagne/sentiers` | 38, 7 | 40, 7, 1 |
| `GET /api/campagne/carnet` | 41, 2 | 39, 2, 1 |
| `GET /api/campagne/serie/:id/correction` | 68, 2 | 67, 2, 2 |
| `GET /api/duels` | 39, 2 | 38, 2, 1 |
| `GET /s/:slug/recap.json` | 72, 2 | 2, 0, 0 |
| `GET /api/admin/qg` | 48, 12 | 47, 8, 1 |
| `GET /api/admin/economie` | 51, 17 | 42, 4, 1 |
| `GET /api/admin/profils` | 71, 2 | 75, 2, 2 |

### Les gestes de jeu à 30 ms par aller-retour (aujourd'hui)

| Geste | ms | allers | en série |
|---|---|---|---|
| `POST /api/jour/commencer` | 239 | 11 | 6,7 |
| `POST /api/jour/repondre` | 108 | 3,2 | 3,3 |
| `POST /api/jour/suivante` | 103 | 4 | 3,1 |
| la dernière réponse du jour (trace) | 330 | 10 | 10 |
| `POST /api/campagne/serie` | 100 | 3 | 1,6 |
| une réponse de série | 69 | 2 | 2,1 |
| `POST /api/campagne/rencontre` (le dé) | 97 | 2 | 1,2 |
| une réponse au dé | 76 | 2,2 | 2,3 |
| `POST /api/campagne/sentiers/epreuve` | 150 | 6 | 4 |
| une réponse d'épreuve | 70 | 2 | 2,1 |

### L'ancienne base et la nouvelle, processeur seul

| | 11 059 questions | 21 887 questions |
|---|---|---|
| Lecture de la base (processeur) | 776 ms | 1 416 ms |
| Tas · pic de mémoire résidente | 20 Mo · +49 Mo | 39 Mo · +84 Mo |
| Premier `GET /api/campagne` après la lecture | 98 ms | 141 ms |
| `POST /api/campagne/serie` | 30 ms | 43 ms |
| `POST /api/campagne/rencontre` (le dé) | 15 ms | 25 ms |
| `POST /api/campagne/sentiers/epreuve` | 15 ms | 20 ms |
| `GET /api/campagne/sujets` | 11 ms | 16 ms |
| Une réponse de série | 6 ms | 7 ms |
| `GET /api/joueur/moi?accueil`, `GET /api/jour` | 12 ms, 5 ms | 12 ms, 5 ms |
