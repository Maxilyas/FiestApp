# La stabilité pour les joueurs, le 6 novembre 2026

Le propriétaire, le 4 novembre : « que l'on regarde les vrais points
bloquants / latence » sur deux jours ; le 6, au vu du bilan : « Je veux que ce
soit stable pour les joueurs. Go pour tes recommandations. »

**En bref** : depuis la version `88afa99` (le 4 novembre, 17 h 02), la moitié
des réponses d'API part en moins de 74 ms, dix-neuf sur vingt en moins de
0,55 s ; le Cabinet ne gèle plus ; la patience des connexions (150 ms) a évité
environ 1 170 poignées de main en 31 heures. Ce qui faisait encore attendre :
la page des sentiers à chaque visite, la routine du matin qui refaisait toute
la base à chacun de ses trente-trois dépôts, la mesure des difficultés qui
tombait en plein soir, et chaque démarrage — le réveil du matin, une mise en
ligne. Les trois premiers sont corrigés ici ; le quatrième se mesure d'abord.

## Ce que la production a dit

Par le bilan de la production (`server/scripts/bilan-de-la-production.ts`, en
lecture seule), sur les 48 heures du 4 au 6 novembre et les 31 heures de la
version `88afa99`.

| Ce qui fait attendre | Ce que la production a relevé |
|---|---|
| La page des sentiers (`GET /api/campagne/sentiers`) et le départ d'une épreuve | 19 sur 20 en 1,8 s et 1,7 s, jusqu'à 3,4 s ; six gels en 31 h (7,3 s), le premier poste, chacun 1,5 à 2,3 s pour tous les joueurs |
| La routine du matin (`POST /api/campagne/base`) | 33 dépôts entre 7 h et 7 h 45 le 5 novembre, 35 le 6 ; jusqu'à 10,7 s ; cinq gels de 800 ms en six secondes le 6 à 7 h 05 ; le premier départ du Cabinet du 5, à 7 h 30, a attendu **8,3 s** (2,7 s de gel pour refaire ses tas) |
| La mesure des difficultés, toutes les six heures | tombée le 5 novembre à 21 h, en plein soir : deux gels et une réponse d'épreuve à 6,2 s |
| Les démarrages | 13,5 s pour `GET /api/joueur/moi` à la mise en ligne du 4 novembre (15 h 05) ; **27,8 s** au réveil du 6 novembre (6 h 52), sept gels en cinq minutes : le journal des réponses, le modèle du savoir, les sujets et tirages, la mesure, la base, tous ensemble |
| L'accueil et les missions | 19 sur 20 vers 0,85 s, 28 % du temps du serveur à eux deux |
| Le QG à sa première ouverture du matin | 10,4 s le 5 novembre à 9 h, et deux allers-retours vers Turso restés sans réponse dix secondes — les deux seules erreurs serveur des 48 heures |

La patience des connexions (`QUIZ_DB_PATIENCE_MS=150`, posée en production avec
`88afa99`) : 1 245 attentes en 31 heures, 53 ms en moyenne, 73 lassées — autant
de poignées de main évitées, à ~0,45 s chacune. Elle reste.

## Ce qui a été fait

1. **La routine du matin publie ses dépôts ensemble** (`publierLesAjouts`,
   `core/campagne.ts`). Chaque dépôt rangé se publiait : le suivant relisait la
   base et la refaisait entière — ses sujets, ses tirages, les tas du Cabinet —,
   une trentaine de fois par matinée. Ses questions se jouent désormais une fois
   sa commande du jour remplie (chaque catégorie a reçu les siennes), ou dix
   minutes après son dernier dépôt (`PUBLICATION_DES_AJOUTS_MS`) ; ce qui attend
   compte déjà pour le dépôt suivant et la commande. Publiée, la base se refait
   en fond une fois, ses sujets et ses tirages derrière elle, et le Cabinet ses
   tas (`baseRenouvelee`, un quatrième crochet de sa porte) : le premier départ
   ne les attend plus. Le choix de produit : les questions du matin arrivent
   après le dernier dépôt plutôt qu'au sien (`campagne-routine.test.ts`).
2. **La page des sentiers garde la force du joueur d'une visite à l'autre**
   (`forcesGardees`, `chancesPourLui`) : refaite à chaque visite de toutes ses
   premières réponses, elle prenait la moitié du processeur de la page. Elle se
   refait quand il a répondu (`JournalDesReponses.versionDe`), quand la série de
   référence change — une base, une mesure, un modèle neufs —, et chaque heure,
   sa semaine glissant ; sous son nom pour la sonde des gels (« campagne · force
   sur les sentiers ») (`sentiers-pour-toi.test.ts`).
3. **La mesure des difficultés se garde un jour** (`MESURES_GARDEES_MS`, six
   heures jusque-là) : la production dort chaque nuit et chaque mise en ligne
   la relit au démarrage — elle ne se relit plus en pleine journée.
4. **Les mises en ligne hors des heures où l'on joue** : ni le soir (19 h–22 h),
   ni à midi (`docs/exploitation/mise-en-ligne.md`, étape 8).

## Ce que le banc a dit

`reproductions/sentiers-au-dixieme.ts` : un joueur de 9 000 réponses et dix
autres de 2 000, la base livrée, le modèle du savoir ajusté, le faux Turso
dehors à 30 ms ; huit visites de la page des sentiers.

| La page des sentiers | Avant | Après |
|---|---|---|
| Processeur par visite, sur un vrai cœur (médiane / pire) | 60 / 105 ms | 26 / 37 ms |
| Au dixième de cœur (`GEL=1`), temps (médiane / pire) | 498 / 816 ms | 100 / 165 ms |
| Gels au dixième de cœur | 1 (515 ms) | 0 |
| `chancesPourLui`, temps inclus sur les huit visites | 213 ms | 10,5 ms |

En production, où une requête coûte deux fois le processeur du banc, la page
gelait 1,5 à 2,3 s : on attend de l'ordre de 0,2 à 0,3 s.

## Ce qui reste

- **Les démarrages** : le réveil du matin et chaque mise en ligne lancent ensemble
  la lecture du journal, le modèle du savoir, les sujets et les tirages, la mesure
  et la base, au dixième de cœur, pendant que les premières pages attendent le
  journal — 27,8 s ce matin. Les échelonner — le journal d'abord, le reste
  derrière lui — demande d'être mesuré au banc avant d'être touché.
- **L'accueil et les missions** : 28 % du temps du serveur, à profiler.
- **Le QG à sa première ouverture du matin** : ses lectures de trente jours, et
  les deux seuls allers-retours tombés des 48 heures.
- **Les connexions neuves** : 12 % des allers-retours en paient encore une — les
  requêtes isolées après plus d'une minute de calme, et les rafales du soir
  au-delà de ce que l'entretien garde.

## Le soir : ce que la version du jour a changé

Le point programmé de 18 h 40 (le bilan relu sur les sept heures de `b109781`, mise
en ligne à 11 h 40, avant midi comme convenu) :

- **La mesure des difficultés** ne s'est plus relue en route, et aucune erreur
  serveur ; la patience tient (313 attentes, 30 lassées).
- **La page des sentiers gelait encore** : cinq gels de 0,9 à 1,9 s, tous pendant
  « campagne · force sur les sentiers ». La force gardée ne servait qu'à qui
  revenait sur la page sans avoir joué ; or le chemin d'un joueur des sentiers est
  la page, une épreuve, la page : chaque réponse la faisait refaire en entier. Le
  banc enchaînait huit visites sans jouer — le mauvais scénario, et l'annonce de
  « 0,2 à 0,3 s » ne tenait pas. Corrigé pour de bon le 8 novembre, sur un banc
  qui rejoue le vrai chemin (`../2026-11-08/stabilite-des-joueurs.md`).
- **Le premier départ du Cabinet** d'après la mise en ligne a attendu 6,5 s
  (12 h 59) : ses tas ne se préparaient qu'à la première visite de sa page.
- **La routine du matin** tournait encore sous l'ancienne version ce jour-là ; son
  premier matin sous la nouvelle est celui du 7.

## Le relancer

```bash
cd server && NODE_USE_ENV_PROXY=1 npx tsx scripts/bilan-de-la-production.ts 48
cd server && GEL=1 SERIES=600 node --single-threaded-gc --no-memory-reducer --max-old-space-size=320 --import tsx ../retours/2026-11-06/reproductions/sentiers-au-dixieme.ts 8
```

`GEL=1` demande d'être root (`/sys/fs/cgroup/cpu/gel`), `PROFIL=1` le profileur
de V8 ; le bilan, `PROD_LECTURE_URL` et `PROD_LECTURE_TOKEN` — jamais
`QUIZ_DB_URL`.
