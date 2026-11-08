# La stabilité pour les joueurs, suite : le 8 novembre 2026

Le propriétaire, au vu du bilan du 6 novembre au soir
(`../2026-11-06/stabilite-des-joueurs.md`, « Le soir ») : « Tu peux appliquer ce
que tu recommandes. De plus si tu veux voir la prod avec le quiz du matin ça
fait 1 jour depuis la dernière fois. »

**En bref** : la routine du matin ne refait plus la base qu'une fois — samedi,
la moitié de ses dépôts en moins de 71 ms. La page des sentiers, elle, gelait
encore : la force gardée le 6 ne servait qu'à qui revenait sans avoir joué, et
chaque retour d'une épreuve la refaisait — dix gels en 48 heures, jusqu'à
2,7 s. Elle se tient désormais à jour des seules réponses nouvelles : sur un
banc qui rejoue enfin le vrai chemin, le retour sur la page passe de 396 à
116 ms au dixième de cœur. Le réveil passe ses étapes l'une après l'autre, le
journal d'abord, et les tas du Cabinet se préparent à sa fin : un premier
départ trois minutes après un réveil passe de 4 à 5 s à 0,4. Le premier accueil
d'un réveil — 27,8 et 29,3 s en production — ne bouge pas au banc : il attend
le journal entier et le reste du démarrage. C'est la suite.

## Ce que la production a dit

Par le bilan de la production (`server/scripts/bilan-de-la-production.ts`, en
lecture seule), du vendredi 6 novembre 2 h au dimanche 8 novembre 2 h : 43
heures relevées, `b109781` (les correctifs du 6) depuis le 6 à 11 h 40,
`629f944` (les mêmes, et l'accueil au réveil de la PR #371) depuis le 7 à
3 h 54.

| Ce qui fait attendre | Ce que la production a relevé |
|---|---|
| La routine du matin (`POST /api/campagne/base`), son premier matin sous la nouvelle version | samedi, 36 dépôts, la moitié en moins de 71 ms (352 sur les deux matins d'avant), 19 sur 20 en moins de 0,9 s (2,1 s) ; la base refaite une fois, à la publication — 7 h 25, un gel de 1,3 s : les sujets, les tirages, les tas du Cabinet. Restent le premier dépôt d'un réveil, 9,1 s — sans doute l'index des faits de toute la base, bâti à ce premier dépôt —, et deux gels de 0,6 et 0,7 s à 7 h 15 |
| La page des sentiers, au retour d'une épreuve | dix gels « campagne · force sur les sentiers » en 48 heures, 15 s en tout, de 0,9 à 2,7 s (le 6 à 19 h 21, avec le modèle du savoir refait en fond) |
| Le réveil | 29,3 s pour un accueil au réveil du 7 à 0 h 29, 27,8 s à celui du 6 à 6 h 52 ; cinq à sept gels en cinq minutes — le journal des réponses, celui des duels, le modèle du savoir, les sujets et les tirages |
| L'ouverture de la campagne (`GET /api/campagne`, `/carnet` et `/sujets` de front) | 40 gels à elles trois en 48 heures — 17,8 s le carnet, 11,4 la page, 10,9 les sujets —, autour d'une seconde à chaque ouverture |
| Le Cabinet | 6,5 s pour le premier départ d'après la mise en ligne du 6 (12 h 59) ; le même soir, à 20 h 10, trois questions corrigées au QG (`POST /api/admin/campagne/corriger`) ont refait la base, puis ses tas, pendant une traversée en cours : deux gels de 2,1 et 1,8 s |
| Le quiz tout prêt (`POST /api/quiz-tout-pret/apercu`) | un gel de 2,8 s le 7 à 14 h 39, 19 sur 20 en 3 s : quelqu'un qui prépare sa soirée |
| Turso | 17 288 allers-retours, la moitié sous 46 ms ; 11 % ont payé leur poignée de main ; la patience : 2 055 attentes, 149 lassées ; aucun tombé, aucune erreur serveur |

Les versions : `629f944`, 22 heures, 19 sur 20 en moins de 372 ms, 1,5 gel par
heure ; `b109781`, 15 heures, 740 ms, 2,9 gels par heure ; `88afa99`, 7 heures,
561 ms, 3,7 gels par heure — des jours et des heures différents, qui ne se
comparent pas d'une ligne à l'autre.

## Ce qui a été fait

1. **La force sur les sentiers se tient à jour de ses seules réponses
   nouvelles** (`server/src/core/forceTenue.ts`, `CampagneStore.forceTenue`).
   Ses premières réponses vivent en tableaux de nombres, sous la série de
   référence qui en a lu les difficultés, complétées des seules nouvelles
   (`JournalDesReponses.lirePremieres`), relues en entier si une première
   d'avant a changé en place (`retouchesDe`). Sa force se relit dessus par le
   calcul même de `forceDuJoueur` (`forceDesTableaux`) : la même au bit près
   (`force-tenue.test.ts`). Sa semaine se refait à l'heure et quand sa force
   change. Le départ d'une épreuve reprend la force que la page vient de tenir
   (`chanceAuDepart`), au lieu de la refaire.
2. **Le réveil passe ses étapes l'une après l'autre** (`prechauffer`,
   `lUneApresLAutre`) : le journal des réponses d'abord, puis la base, les
   bordures de ligue, les sujets et les tirages, les tas du Cabinet, le modèle
   du savoir. La publication des dépôts de la routine de même
   (`travail-de-fond.test.ts`).
3. **Les tas du Cabinet se préparent à la fin du réveil** et après les dépôts
   de la routine (`baseRenouvelee`, `CabinetStore.preparerSesTas`), plus
   seulement à la première page du Cabinet.

## Ce que le banc a dit

### La page des sentiers, sur le vrai chemin

`reproductions/sentiers-le-vrai-chemin.ts` : un joueur de 9 000 réponses et dix
autres de 2 000, la base livrée, le modèle du savoir ajusté, le faux Turso
dehors à 30 ms ; six épreuves jouées par les routes, deux bonnes réponses sur
trois, la page à l'arrivée et au retour de chacune, au dixième de cœur.

| La page des sentiers | Avant | Après |
|---|---|---|
| Retour sur la page (médiane / pire) | 396 / 699 ms | 116 / 278 ms |
| Son processeur (médiane / pire) | 51 / 74 ms | 25 / 34 ms |
| Départ d'une épreuve (médiane / pire) | 497 / 2 910 ms | 334 / 1 928 ms |
| Gels de plus d'une demi-seconde | 1 (599 ms) | 0 |
| La force au profileur, sur un vrai cœur (six retours, six départs) | 232 ms | 18 ms |

Le banc du 6 novembre enchaînait huit visites sans jouer : la force gardée y
servait sept fois sur huit, et la production la refaisait au retour de chaque
épreuve. Ce banc-ci rejoue le chemin d'un joueur. Des 138 ms que la force
prenait encore à `forceDuJoueur`, 11 seulement étaient ses pas de Newton : le
reste, ses premières réponses rangées en tables neuves à chaque fois.

### Le réveil

`reproductions/reveil-au-dixieme.ts` : le paquet de la production
(`server/dist/index.mjs`), dans un processus à lui, avec ses drapeaux et ses
variables, à cinq millisecondes de processeur sur cent dès sa naissance — une
requête coûte en production deux fois le processeur du banc
(`docs/exploitation/capacite.md`) —, sur 40 125 réponses de vingt-huit profils,
vingt tranches gardées, le modèle du savoir gardé sept heures plus tôt. Deux
téléphones ouvrent l'accueil dès qu'il écoute, un troisième dix secondes
après, et un départ du Cabinet part trois minutes après. Le paquet de `main`
(construit à part) et celui-ci, en alternance, sur la même base :

| Le réveil, trois passages de chaque | Avant (`main`) | Après |
|---|---|---|
| L'accueil des deux premiers téléphones (médiane, et d'un passage à l'autre) | 16,7 s (15,5 à 21,6) | 17,1 s (15,1 à 21,7) |
| Le troisième, dix secondes après | 7,5 s (6,2 à 11,1) | 7,7 s (5,7 à 11,9) |
| Le premier départ du Cabinet, trois minutes après | 4,1 à 5,0 s | 0,4 à 0,5 s |
| Le modèle du savoir ajusté | 64 à 70 s | 70 à 81 s |

Le modèle du savoir, lancé désormais au bout du préchauffage, s'ajuste six à
dix secondes plus tard : la page des sentiers attend d'autant pour dire ses
chances après un réveil. Les missions, elles, ont répondu 500 à deux passages
de chaque paquet : leur lecture se borne à quinze secondes (« lecture des
missions restée en route 15 s, à l'étape « ses journaux » »), et le journal
du réveil les a dépassées — la production, un peu plus prompte sur ce point,
les a servies en 8,6 et 8,8 s.

**Le premier accueil ne bouge pas.** Au banc, le préchauffage ne part qu'après
lui : son minuteur de vingt secondes sonne quand les premiers accueils ont déjà
répondu. En production, plus lente, il partait pendant — ses gels nommaient la
base, le modèle et les tirages sous l'accueil qui attendait —, et c'est ce que
l'échelonnement empêche ; le banc ne sait pas le montrer. Ce que ce premier
accueil attend, c'est le journal des réponses en entier : 200 ms de processeur
sur un vrai cœur pour 40 000 réponses — 91 pour décoder ses tranches, 107 pour
les appliquer (`reproductions/journal-au-reveil.ts`) —, plusieurs secondes au
dixième de cœur ; et le reste du démarrage. La production attend deux fois plus
que le banc : elle a en plus 875 duels à relire, le quiz du jour, l'histoire
des profils.

À trois millisecondes sur cent, le faux Turso coupe des connexions que le
serveur gelé croit vivantes (« socket hang up »), avant comme après : ces
passages-là ne disent rien. Un premier passage d'avant, sous le profileur,
disait 27 s pour l'accueil : sous la bride, le profileur gonfle tout.

## Ce qui reste

1. **Le premier accueil d'un réveil** (27,8 et 29,3 s en production, 15 à
   22 s au banc) : que le banc ait d'abord ce que la production a de plus — les
   duels, le quiz du jour —, puis que l'accueil n'attende plus tout le journal —
   lire d'abord les réponses de qui attend, ou alléger sa lecture. Les missions,
   bornées à quinze secondes, y tombent en 500 dès que le journal tarde.
2. **L'ouverture de la campagne** — la page, le carnet et les sujets de front :
   une seconde de gel à chaque ouverture, quarante en 48 heures. À profiler.
3. **Les corrections du QG en pleine soirée** refont la base et les tas du
   Cabinet sous les joueurs (le 6 à 20 h 10, deux gels de 2,1 et 1,8 s). D'ici
   là, corriger hors des heures de jeu ; ensuite, ne refaire que la question
   corrigée.
4. **L'accueil et les missions** (32 % du temps du serveur), **l'aperçu du quiz
   tout prêt** (2,8 s de gel), **le premier dépôt de la routine** d'un réveil
   (9,1 s : la routine attend, et un gel de 0,8 s).

## Le relancer

```bash
cd server && NODE_USE_ENV_PROXY=1 npx tsx scripts/bilan-de-la-production.ts 48
cd server && GEL=1 SERIES=600 node --single-threaded-gc --no-memory-reducer --max-old-space-size=320 --import tsx ../retours/2026-11-08/reproductions/sentiers-le-vrai-chemin.ts 6
cd server && npm run build && GEL=1 QUOTA=5000 CABINET_A=180 node --import tsx ../retours/2026-11-08/reproductions/reveil-au-dixieme.ts
cd server && node --single-threaded-gc --max-old-space-size=320 --import tsx ../retours/2026-11-08/reproductions/journal-au-reveil.ts
```

`GEL=1` demande d'être root (`/sys/fs/cgroup/cpu/gel`), `PROFIL=1` le
profileur de V8 — au réveil, sous la bride, il gonfle tout : un passage sans
lui fait foi. `REUTILISER=1` reprend la base du passage d'avant, et
`SERVEUR_DIR` le dossier `server/` d'un autre arbre, son paquet construit. Le
bilan lit `PROD_LECTURE_URL` et `PROD_LECTURE_TOKEN` — jamais `QUIZ_DB_URL`.
