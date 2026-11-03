# La production au 2 novembre 2026 : réactivité, processeur, Turso

La demande du propriétaire : « regarder sur la prod si, niveau performance —
réactivité, processeur, Turso —, cela reste correct, et ce qui serait à
améliorer ». Lu en lecture seule (`PROD_LECTURE_URL`, `PROD_LECTURE_TOKEN`) :
le relevé de l'heure de la page « Le serveur » du QG (`qg_sante`,
`qg_demarrages`), des totaux, des `EXPLAIN QUERY PLAN` — ni un nom, ni un
identifiant —, et `/healthz` relevé toutes les trente secondes un moment.
Les requêtes : `reproductions/lecture-de-la-production.md`.

## Ce que la production dit (du 25 octobre au 2 novembre 2026)

106 heures actives, 33 000 appels d'API, versions `1babf7d` à `3ba0831`.

| | Mesuré | Verdict |
|---|---|---|
| Les routes d'API | médiane 92 ms, 95ᵉ centile ~630 ms (médiane des heures), au-delà d'1 s dans 17 heures sur 106 | correct |
| L'accueil | `GET /api/joueur/moi` et `/api/joueur/missions` parmi les trois routes les plus lentes de 96 heures sur 106, ~1,5 s au 95ᵉ centile ; `/api/campagne/sentiers` ~2,4 s | à améliorer |
| Le processeur, en moyenne | 0,3 % d'un cœur — 3 % du dixième que Render donne | large marge |
| Le gel de la boucle | au-delà d'1 s dans 81 heures sur 106, de 2 s dans 28, 3,4 s au pire | **le vrai sujet** |
| Turso | ~50 ms l'aller-retour en médiane ; 8 % des allers-retours ouvrent leur connexion, 4 tombés sur 118 000, 3 battements tombés | sain |
| Le quota de Turso | 2,6 millions de lignes lues le jour le plus chargé, ~15 % des 500 millions du mois à ce rythme ; écritures ~4 % | sain, suit l'activité |
| La mémoire | 240 à 260 Mo, 316 à 334 Mo les jours où la routine du matin ajoute des questions à la campagne (vers 7 h, sans redescendre : le réducteur est coupé exprès) | sous les 450 de l'alerte |
| Les erreurs | une seule sorte, deux fois : « lecture des missions restée en route 15 s », chaque fois dans la minute d'une mise en ligne, quand le préchauffage sature le dixième de cœur | mineur |
| Le démarrage | 3,3 à 3,6 s ; 68 s le 2 novembre, `VERSION_BAREME` 7 → 8 et `VERSION_DES_JOURS` 1 → 2 relus avant d'ouvrir le port | une fois par montée de version |

Le serveur n'attend pas Turso : il attend son propre processeur. Au banc du
gel (`../2026-10-16/reproductions/banc-gel.ts`, compilé, sur le code du
jour), un accueil coûtait ~75 ms de processeur sur un vrai cœur — 0,75 s au
dixième de cœur —, quatre de front 465 ms, et 60 % partaient dans les
allers-retours vers la base (le `fetch`, les sockets, le décodage du client
libsql), 17 % dans le code de l'application. Le 95ᵉ centile de Turso que le
relevé montre (~420 ms) est gonflé par ces gels : `avecDelai` chronomètre le
`fetch` entier.

## Ce qui a été fait

1. **Les défis reçus cherchent les tentatives par le code du duel**
   (`lectureDesDefisRecus`, et ses sœurs : `mesAmis`, `envoyerLesPrevus`,
   les deux côtés de `lectureDesDuels`) : la requête la plus lourde de la
   semaine, 7,3 % des lignes lues, 2 760 par accueil d'un joueur aux 74 défis
   reçus. Le plan de la production, lu par `EXPLAIN`, prenait l'index du
   profil et du mode ; le `+` de `PAR_SON_CODE` le mène à celui des duels. Le
   banc, lui, prenait déjà le bon : sans statistiques, le choix tient à
   l'ordre où chaque base a créé ses index. `duels-index.test.ts` relit donc
   chaque plan sous des statistiques qui égareraient (`test/statistiques.ts`).
2. **L'accueil d'un lot par magasin** — le profil, le quiz du jour, la
   campagne —, et les missions de même (règle `profil.md`).

## L'accueil, avant et après

`reproductions/allers-de-l-accueil.ts` compte les allers-retours,
`reproductions/processeur-de-l-accueil.ts` mesure le processeur au transport
léger de la production. Avant et après en séries entrelacées — l'ancien code
dans un autre arbre, sur la même base —, chaque chiffre la médiane de ses
passages : le client du banc compte avec le serveur, et la machine du banc est
partagée, ±10 à 20 % d'un passage à l'autre.

Les allers-retours (exacts, le faux Turso les compte) :

| | Avant | Après |
|---|---|---|
| `GET /api/joueur/moi?accueil` | 13, et un 14ᵉ derrière à l'accueil entier | 3 lots de front (un 4ᵉ, derrière : le carnet relu de la base pour ce joueur du banc, dont les réponses sont recopiées dans le désordre — `carnetIncertain`, comme avant) |
| `GET /api/joueur/missions` | 8 | 3 |
| `GET /api/joueur/nouveautes` | 4 | 3 |
| L'accueil entier | 25, en 4 vagues | 10, en 3 vagues |
| Quatre accueils de front | 100 | 40 |

Le processeur, en millisecondes (`N=60`, chaque série sa médiane) :

| | Avant | Après |
|---|---|---|
| `GET /api/joueur/moi?accueil` (3 passages) | 15,3 · 18,4 | 10,8 · 11,6 |
| `GET /api/joueur/missions` | 7,0 · 6,7 | 5,3 · 6,4 |
| `GET /api/joueur/nouveautes` | 4,8 · 3,9 | 5,5 · 5,9 |
| L'accueil entier, un à la fois (5 passages) | 22,5 · 21,4 · 20,3 | 22,0 · 20,3 · 21,0 |
| Quatre accueils de front (5 passages) | 76,5 · 74,2 · 73,5 | 57,3 · 53,2 · 52,5 |

Ce que ça dit : au banc, un accueil seul ne coûte pas moins — son faux Turso
répond sur la machine même, sans TLS, et un aller-retour de plus n'y pèse
presque rien —, mais quatre accueils de front coûtent 28 % de moins, 40
allers-retours au lieu de 100 à se disputer les huit connexions du transport
léger (`CONNEXIONS_AU_PLUS`). C'est le moment où la production gèle.

En production, un aller-retour coûte davantage — TLS, une vraie connexion —,
et l'accueil seul y gagne aussi : il lançait 21 allers-retours de front (13
pour l'en-tête, 8 pour les missions), au-delà des six connexions gardées
chaudes (`CHAUDES_AU_PLUS`) et des huit que le transport ouvre au plus — les
suivants attendaient qu'une connexion se libère, un aller-retour de plus, ou
en ouvraient une neuve, poignée de main TLS comprise. Il en lance six ou sept.
À lire sur la page « Le serveur » du QG après la mise en ligne : les
allers-retours de l'heure, la part de ceux qui ouvrent leur connexion, le gel
de la boucle.

## Les gels, le même jour

« Par rapport au freeze du serveur, on peut y faire quelque chose ? » Le
relevé de l'heure le dit : le gel suit l'activité — le plus long de chaque
heure, en médiane des heures, 0,08 s sans un appel, 0,4 s de 1 à 20, ~1 s de
21 à 100, ~1,5 s de 101 à 300, ~1,8 s au-delà. Le 31 octobre, pendant une
soirée de vingt invités, 2,9 s dans l'heure de 22 h. Le relevé ne gardait que
ce maximum : ni ce qui tournait, ni quand.

**Une réponse partie à temps pouvait recevoir « Trop tard ».** Vérifié sur
la boucle de Node (`reproductions/` n'en garde que le test,
`server/test/gel-en-fin-de-question.test.ts`) : gelée dans une lecture —
une requête, une réponse de la base — ou dans un `setImmediate` — une étape
de fond —, la boucle passe ensuite les chronomètres échus, puis seulement
les sockets. Une question a 1,5 s de marge (`GRACE_MS`) : au-delà, le
chronomètre de la question sonnait avant que la réponse arrivée pendant le
gel soit lue. Gelée dans un chronomètre, elle lit les sockets d'abord.

Ce qui a été fait :

1. **Un chronomètre de partie en retard passe un tour de boucle**
   (`RETARD_D_UN_GEL_MS`, `core/engine.ts`) : les réponses arrivées pendant
   le gel se lisent avant la révélation. Il reste armé ce tour-là : une pause
   de l'animateur, le souffle relancé l'éteignent.
2. **Le travail de fond laisse passer la question d'une soirée**
   (`laisserPasserLaSalle`, `core/tourniquet.ts`) : le modèle du savoir —
   28,5 s refait de zéro au démarrage du 2 novembre, 5,6 s le suivant, à
   `/healthz` — et les tirages d'une mesure neuve ne commencent ni ne
   reprennent tant qu'une question attend ses réponses, trois minutes au
   plus.
3. **Ce qui gèle se relève** (`core/gels.ts`) : chaque gel de plus d'une
   demi-seconde, ce qui tournait pendant — la route sous son modèle, le
   message du temps réel, le chronomètre, le travail de fond —, le
   processeur pris et les pauses du ramasse-miettes, au relevé de l'heure,
   et la page « Le serveur » du QG les dit (« Ce qui gèle »). La suite —
   couper les plus gros blocs — se décidera sur ce que la production y
   montrera : `reproductions/gels-de-la-production.ts` les lit en lecture
   seule, heure par heure, avec les appels de chaque heure.
4. **Le pire gel de l'heure se perdait** quand il couvrait l'échéance du
   relevé de la charge, toutes les dix secondes : le relevé lisait puis
   remettait à zéro l'histogramme avant qu'il ait noté le gel — un gel de
   deux secondes une fois sur cinq, un de dix à chaque fois (reproduit trois
   fois sur trois, `gels.test.ts`). Les chiffres plus haut sont donc des
   minorants. Le relevé lit maintenant un tour de boucle plus tard.

Au banc du gel bridé au dixième de cœur (`../2026-10-16/reproductions/banc-gel.ts`,
compilé, qui imprime maintenant ce que la sonde relève), au volume du banc —
deux fois et demie moins que la production —, le serveur ne gèle plus d'une
demi-seconde qu'au préchauffage du réveil : trois gels de 0,5 à 0,6 s, le
modèle du savoir et la préparation des tirages en cours. Un quatrième, de
2,9 s, venait du banc lui-même — une lecture SQLite synchrone dans le même
processus —, et la sonde l'a mis au compte de ce qui tournait : ce qui
tournait n'est pas forcément ce qui gelait, la page le dit.

## Ce qui gèle, d'après la production, et les blocs coupés

La sonde a relevé, de 13 h à 23 h le 2 novembre (version 73cec7d), 55 gels
d'une demi-seconde ou plus — `reproductions/gels-de-la-production.ts`, en
lecture seule, sans un nom. Les plus longs, et ce qui tournait pendant :

| Gel | Processeur | Ce qui tournait |
|---|---|---|
| 2,8 s | 433 ms | la page des sentiers, le modèle du savoir, les tirages d'une mesure neuve |
| 2,4 s | 377 à 380 ms | la page des sentiers (deux fois), la campagne, le modèle, la mesure |
| 2,3 s | 359 à 371 ms | un geste de la traversée du Cabinet, la mesure des difficultés, les tirages de la mesure neuve (quatre fois de 1,6 à 2,3 s) |
| 2,2 s | 359 ms | la page des signalements du QG, seule — l'administrateur corrigeait des questions |
| 1,5 s | 242 ms | la vue d'ensemble du QG |
| 0,6 à 1,0 s | 105 à 166 ms | le réveil : la base, le modèle du savoir, les sujets et tirages |

D'où l'ordre suivi : la mesure neuve et ses tirages sous les gestes du
Cabinet, la page des sentiers et le départ d'une épreuve, le modèle du
savoir, les pages du QG, le réveil. Chaque gel garde environ six fois son
processeur en temps (le dixième de cœur, et un calcul coupé par la bride qui
coûte plusieurs fois son prix).

**Le banc à l'échelle de la production** (`reproductions/gels-rejoues.ts`) :
la base du banc du gel grossie à 35 000 réponses, le faux Turso dehors —
qui apprend au passage les paramètres numérotés du Cabinet (`?1`) —, les
scènes de l'après-midi rejouées par les vraies routes : des épreuves du
Cabinet entrées et quittées, l'horloge avancée de onze minutes une fois sur
deux, la page des sentiers, une épreuve, les signalements avec une question
reclassée puis une corrigée, le Cabinet après la correction, la vue
d'ensemble, un réveil. Sur un vrai cœur, au profileur, les plus gros blocs
d'un seul tenant : le départ d'une épreuve de sentier (60 ms — le tirage et la
série de référence), les familles et les index d'une base refaite (23 à
34 ms), la série de référence de la page des sentiers (25 ms), la mise en
famille de la mesure (13 ms), sa préparation du tirage (7 ms), et une
tranche du modèle du savoir (10 à 12 ms). Puis bridé au dixième de cœur
(`GEL=1`, les drapeaux de la production), les gels mêmes que la production
relevait :

| Scène, au dixième de cœur | Avant | Après |
|---|---|---|
| La page des sentiers, à froid | gel de 0,7 s | aucun retard de 0,15 s |
| La page des sentiers, après les mesures neuves | gels de 1,0 et 0,5 s | deux retards de 0,2 s |
| Une épreuve du Cabinet, la mesure périmée | retards jusqu'à 0,4 s | aucun retard de 0,15 s |
| Une question reclassée, la page des signalements qui suit | 0,5 s, 0,4 s | 0,2 s au plus |
| Une traversée du Cabinet après la correction | gel de 1,7 s | retards de 0,2 s |
| Le départ d'une épreuve de sentier | gel de 1,2 s, le départ seul | 0,7 et 0,5 s, le modèle du savoir refait en fond |

Ce qui a été fait : **un calcul sur toute la base se fait en tranches**
(`CalculEnTranches`, `shared/tranches.ts` ; `enTranches`,
`core/tourniquet.ts`) — la mise en famille de la mesure, les familles d'une
base (gardées par question : une base refaite ne relit que les neuves), la
préparation d'un tirage, la série de référence, la base refaite et ses
index, le comptage des sujets au réveil, chacun de deux mille cinq cents
questions au plus par tour de boucle, deux à trois millisecondes sur un
vrai cœur. La préparation du tirage et la série de référence ne se font plus
jamais d'une traite sur le chemin d'une requête : la requête attend leurs
tranches, partagées avec le fond, et la série de référence se refait en fond
derrière chaque mesure neuve et chaque modèle neuf, avant la page qui la
lit. Le départ d'une épreuve de sentier tire une place par tranche. Le
modèle du savoir passe la base en tranches à chaque passe, quatre mille
chances au plus — vingt mille gelaient le banc bridé 0,6 à 0,9 s —, et la
première préparation des tas du Cabinet cinquante questions par tranche,
plus deux cents.

Ce qui reste, mesuré au même banc bridé : le modèle du savoir refait en
fond (0,5 à 0,7 s, ses tranches resserrées n'ont pas suffi — à profiler
bridé), la vue d'ensemble du QG (0,5 à 0,7 s — le décodage de trente jours
de parties et ses comptes du jour), la première traversée lancée sur une
liste de questions neuve (0,7 à 1,3 s — les thèmes du Quiz rangés d'un
bloc), et le réveil (0,9 à 1,1 s sous « modèle du savoir » et « sujets et
tirages ») : 60 ms qu'aucune fonction du dépôt ne revendique au profileur,
sur un vrai cœur — en production, sans doute aussi le paquet compilé au
premier appel de chaque fonction ; le cache de compilation de Node
(`module.enableCompileCache`) est une piste, à mesurer.

## Ce qui reste à décider

- **Le processeur de l'hébergeur.** L'offre gratuite donne un dixième de
  cœur : chaque milliseconde de calcul y en dure dix. Le palier payant le
  plus bas en donne la moitié d'un — cinq fois plus —, et ne dort plus. Un
  choix de budget, au propriétaire.
- **Les relectures de version avant l'ouverture du port** : 68 s le
  2 novembre, et elles grandiront avec l'historique.
- **La mémoire après l'apport du matin** : à surveiller, `rssMo` à
  `/healthz`.
