# Turso « deux fois plus lent qu'hier » — la revue de performance du 14 octobre 2026

La demande : « Les routes sur Turso ont doublé par rapport à hier en temps de
latence, tu pourrais me faire une review complète niveau perf et ce que l'on
peut améliorer ? »

La revue s'appuie sur le code ; sur ce que la production dit d'elle-même par
`/healthz`, public, lu le 14 octobre au matin ; sur la base de production,
lue le même jour en lecture seule — volumes, index, plans, temps des
requêtes ; et sur **un banc qui rejoue le vrai chemin de la production** :
un faux Turso qui parle le protocole HTTP de libsql, une latence réglable
par aller-retour, une activité jouée par les vraies routes — sur le code
d'hier soir et sur celui d'aujourd'hui. Tout se rejoue (`reproductions/`,
son `README.md`). Le premier pas du plan, le transport, est fait dans la
même PR ([perf-turso-13]) ; le reste attend.

## En bref

1. **La production tourne encore sur `d4cd799`** (13 octobre, 13 h 59, la
   PR #189 des duels) : son `/healthz` le dit (`version`). Elle n'a ni la
   page « Le serveur » ni son relevé, ni la base doublée, ni les pages
   neuves du QG, ni le modèle du savoir. La page qui montre le doublement
   est donc celle de la **préproduction**, redéployée à chaque fusion sur
   `main` — neuf fois aujourd'hui, chaque fois un démarrage.
2. **En production, au repos, un aller-retour vers Turso coûte 29 ms sur
   une connexion gardée, et 225 ms sur une connexion à rouvrir** — mesuré
   par le serveur lui-même, processeur à 0 %, aucun joueur : douze lectures
   d'affilée, puis douze espacées de 6 s. Les 230 ms de médiane du 13
   octobre, ce sont des connexions rouvertes. Le `fetch` de Node referme
   une connexion inactive au bout de 4 s quand le serveur n'annonce pas son
   délai ; hors soirée, presque chaque requête arrive après une pause, et
   repaie TCP et TLS. La base est en Irlande, le service à Francfort : les
   29 ms, c'est surtout le trajet ; les 196 de plus, la connexion à
   rouvrir.
3. **Le chiffre de « Turso » suit donc surtout le rythme du trafic** :
   dense, les connexions restent chaudes ; clairsemé, elles se rouvrent.
   D'un jour à l'autre, il peut doubler sans que rien ne change. En
   préproduction, chaque déploiement ouvre une vingtaine de connexions
   neuves à la fois — au réveil de ce matin, 74 allers-retours dans la
   minute, 93 ms de médiane, 408 au 95ᵉ centile, 633 au pire —, et qui passe
   d'une page du QG à l'autre, une pause entre chaque, ne trouve que des
   connexions froides.
4. **Le code n'a ajouté aucun aller-retour depuis hier soir.** Le même banc,
   rejoué sur `c3b2f99` (13 octobre, 21 h 14 : la PR #195, celle qui a mis
   en route la page « Le serveur ») et sur `ea5b144` (aujourd'hui), compte
   les mêmes allers-retours, et les mêmes en série, sur toutes les routes
   des joueurs et tous les gestes de jeu. Le réveil en a trois à cinq de
   plus (68 → 71, ou 70 → 75 selon l'état de la base).
5. **La base de la campagne a doublé cette nuit** (11 059 → 21 887
   questions, la PR #194) — en préproduction, et en production au prochain
   déploiement. Elle se revalide entière à chaque réveil (776 → 1 416 ms de
   processeur sur la machine du banc, tas 20 → 39 Mo) et se parcourt à
   chaque tirage (une série 30 → 43 ms, le dé 15 → 25). Le processeur compte
   aussi dans le chrono de Turso (`core/distante.ts:112-120`) : au dixième
   de cœur, c'est le second terme, derrière les connexions. Et le 95ᵉ
   centile des routes compte aussi celles de l'administration
   (`server.ts:259-271`), dont les quatre pages neuves du QG.
6. **Le multiplicateur, ce sont les allers-retours en série** : à 225 ms la
   connexion froide, la page du profil en attend 6 (≈ 1,4 s), « Commencer »
   le quiz du jour 7, chaque question 6 — la réponse 3, « Question
   suivante » 3 —, la dernière réponse 10 (≈ 2,3 s), un réveil 35.
7. **La base de production est petite, et SQLite n'y coûte presque rien**
   — 9 907 réponses de campagne, 52 quiz, 31 profils : la plupart des
   lectures y prennent moins de 20 ms de plus que l'aller-retour lui-même.
   Ce qui pèse, ce sont les lectures entières qui grandissent : les
   bibliothèques de tous les espaces à chaque réveil (570 Ko), la mesure
   des difficultés, ce qu'un joueur a vu, et le modèle du savoir quand il
   arrivera. Les réécritures du banc y gagnent peu (5 à 10 ms), et celle de
   l'économie y perd tant que son index manque.

Le premier levier est donc le transport — garder les connexions chaudes, ou
n'en ouvrir qu'une ([perf-turso-13]) : il ramènerait l'aller-retour d'un
trafic clairsemé de ~225 ms vers ~30. Puis les allers-retours en série, et
le processeur avant que la base doublée n'arrive en production. Les
parcours complets que relevait le banc viennent après : à ces volumes, ils
ne coûtent presque rien.

## Ce que la production a dit (14 octobre, au matin)

| Mesure (côté serveur, `/healthz`) | médiane | 95ᵉ centile | pire |
|---|---|---|---|
| Production au repos, douze lectures espacées de 6 s | 225 ms | 566 ms | 566 ms |
| Production au repos, douze lectures d'affilée | 29 ms | 263 ms (la première) | 263 ms |
| Préproduction, la minute de son réveil (74 allers-retours) | 93 ms | 408 ms | 633 ms |
| Production, le 13 octobre (`duels-attente.test.ts`) | 230 ms | 765 ms | — |

La lecture : la page publique de l'historique d'un espace
(`/s/:slug/soirees.json`), un seul aller-retour sans cache
(`archives.list`). Le processeur était à 0 %, la boucle libre (pire retard
12 à 16 ms) : rien d'autre que la connexion ne sépare les deux premières
lignes. La production : `d4cd799`, levée depuis quatre heures et demie,
142 Mo de mémoire résidente, 69 Mo de tas, aucun joueur connecté. Le
script : `reproductions/sonde.mjs`.

## Ce que la base de production a dit (14 octobre, lecture seule)

Lue depuis une session à part, avec les deux variables de lecture que le
propriétaire a ajoutées : des `SELECT`, des `EXPLAIN QUERY PLAN` et
`sqlite_master`, rien d'écrit, et rien que des comptes, des tailles, des
plans et des temps — ni un nom, ni un identifiant. Une requête qui prend un
profil a pris le plus assidu, sans le nommer. Les temps passent par le
proxy de sortie de la session, qui rouvre le TLS : un `SELECT 1` y coûte
126 ms sur une connexion gardée. Chaque temps ci-dessous est la médiane de
trois, moins ce `SELECT 1` — ce que la requête coûte de plus que
l'aller-retour, à une dizaine de millisecondes près (des nets négatifs le
montrent) : l'ordre de grandeur compte, pas la milliseconde. La consigne
exacte : `reproductions/lecture-de-la-production.md`.

**La base est en Irlande** (`aws-eu-west-1`) ; le service Render, à
Francfort — Render n'a pas de région en Irlande. Les 29 ms d'une connexion
gardée, c'est surtout ce trajet ; une connexion à rouvrir y ajoute deux ou
trois allers-retours vers Dublin, et le chiffrement au dixième de cœur.

**Elle est petite** : 9 907 réponses de campagne en 945 séries, 1 950
réponses et 195 parties du quiz du jour, 404 questions dans sa réserve, 52
quiz, 40 soirées, 31 profils, 23 comptes, 201 sessions, 49 duels, 149
lignes d'expérience. Les tables `party_*` sont vides (aucune soirée en
cours), et `qg_sante` comme `qg_demarrages` n'existent pas : la production
n'a pas encore le relevé.

| Lecture | quand | plan en production | lignes · octets | ms de plus qu'un `SELECT 1` |
|---|---|---|---|---|
| Les bibliothèques de tous les espaces (`allBySpace`) | chaque réveil | `SCAN quizzes` | 52 · 570 Ko | 295 |
| Le modèle du savoir (`LECTURE_DU_SAVOIR`) | chaque réveil, puis toutes les demi-heures — au prochain déploiement | `SCAN r` | 15 · 134 Ko | 133 |
| La mesure des difficultés (`mesures`) | toutes les dix minutes, sur une requête | `SCAN campagne_reponses` | 1 · 89 Ko | 106 |
| Les fiches des soirées (`memoiresDeTous`) | chaque réveil | `SCAN soirees` | 40 · 85 Ko | 46 |
| Ce que le plus assidu a vu (`lectureDesVues`) | chaque série, chaque dé | ses séries, par leur index | 1 · 103 Ko | 45 |
| Le carnet du plus assidu (`suivisDe`) | chaque accueil | `SCAN campagne_duels`, deux fois | 1 622 · 76 Ko | 31 |
| … réécrit en `EXISTS` ([perf-turso-8]) | | son duel, par la clé | 1 622 · 76 Ko | 22 |
| Les sessions des comptes (`AuthStore.init`) | chaque réveil | `SCAN auth_sessions` | 201 · 82 Ko | 20 |
| Les séries du QG (`seriesEnCours`), `UNION` | au prochain déploiement | `SCAN profile_xp` | 19 · 4 Ko | 17 |
| … en `UNION ALL` ([perf-turso-10]) | | `SCAN profile_xp` | 19 · 4 Ko | 12 |
| Les cotes de tous (`toutesLesCotes`) | le classement des duels, le préchauffage | par leurs index | 93 · 16 Ko | 15 |
| L'économie (`economieDepuis`), `JOIN` | au prochain déploiement | `SCAN r` | 17 · 0,4 Ko | 3 |
| … en `CROSS JOIN` ([perf-turso-9]) | | `SCAN s` | 17 · 0,4 Ko | 12 |
| La réserve du jour (`etatDeLaReserve`) | `/healthz`, toutes les dix minutes | `SCAN jour_reserve` | 1 · 42 o | 2 |

Ce qu'elle dit :

- **Le coût n'est pas dans SQLite.** À ces volumes, la plupart des lectures
  coûtent moins de 20 ms de plus que l'aller-retour lui-même. Ce qui se
  paie, c'est l'aller-retour — et sa connexion.
- **Ce qui pèse, ce sont les lectures entières qui grandissent** : les
  bibliothèques, à chaque réveil — 570 des 753 Ko que lisent ses neuf
  lectures entières ([perf-turso-14]) ; la mesure et le savoir,
  qui relisent toutes les réponses de campagne ([perf-turso-3]) ; ce qu'un
  joueur a vu, à chaque série, qui grandit avec lui.
- **Les réécritures du banc sont justes, mais petites aujourd'hui** :
  `EXISTS` −9 ms, `UNION ALL` −5, à peine plus que le bruit. Le `CROSS
  JOIN` de l'économie est même plus lent : la production n'a pas
  `idx_campagne_series_commencee`, ni `idx_profile_xp_quand` — le code
  d'aujourd'hui les crée (`1788205` et `de69637`, le 13 octobre au soir),
  au prochain déploiement. Les plans de [perf-turso-9] et [10] se relisent
  après lui : un plan ne dépend pas du volume, mais des index.
- **La tenue des connexions ne s'est pas laissé lire** : le proxy de la
  session rouvre le TLS, et c'est lui qu'on mesurait — aucun en-tête
  `Keep-Alive`, pas de HTTP/2 négocié, une connexion neuve à chaque essai
  après 10, 30, 60 ou 90 s de calme, sans une erreur. Seul le serveur, sur
  Render, peut dire combien de temps Turso garde une connexion
  ([perf-turso-12], [13]).

## Sur la page « Le serveur » de la préproduction

- **Les démarrages** : chaque fusion en est un. Chacun ouvre ses connexions
  à froid, puis lance le préchauffage — base, cotes, mesure, modèle. Les
  heures des déploiements de la journée sont celles qui tirent le 95ᵉ
  centile ; « prêt en », divisé par 35 vagues, dit ce que valait un
  aller-retour ce matin-là.
- **Les trois routes les plus lentes de l'heure** (les `lentes` du relevé) :
  des `/api/admin/…`, ce sont les pages neuves du QG, comptées dans « ce
  qu'un joueur attend ».
- **Le processeur et le pire gel**, contre le pointillé des 10 % : au
  plafond, le calcul s'ajoute aux connexions.

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
gains sont estimés à 225 ms par aller-retour, ce que coûte en production
une connexion à rouvrir — le cas le plus courant hors soirée.

### Le transport

**[perf-turso-13] Une connexion vers Turso tient 4 s de calme, puis se
rouvre — et c'est elle qui fait la latence.** En production, au repos :
225 ms de médiane par aller-retour quand la connexion est à rouvrir, 29 ms
quand elle est gardée (ci-dessus, `reproductions/sonde.mjs`). Le `fetch` de
Node referme une connexion inactive au bout de 4 s quand le serveur ne dit
rien de son délai (`keepAliveTimeout` d'undici, démontré par
`reproductions/connexions.mjs`) ; la requête suivante repaie TCP et TLS,
et le chiffrement au dixième de cœur. Et chaque requête simultanée — une
vague de six lectures, un réveil qui en lance vingt — ouvre sa propre
connexion : en HTTP/1.1, une connexion porte une requête à la fois. Même
d'affilée, deux allers-retours enchaînés en ouvrent deux : le `fetch` de
Node n'a pas encore rendu la première connexion quand la requête suivante
part dans la même tâche (mesuré : deux connexions pour dix allers-retours
enchaînés, une seule dès qu'une milliseconde les sépare) — après une pause,
une chaîne d'`await` paie deux poignées de main, pas une.
Le délai d'inactivité de Turso, lui, reste à lire : la session qui a lu la
base de production passait par un proxy qui rouvre le TLS, et c'est lui
qu'elle a mesuré (ci-dessus). Seul le serveur, sur Render, peut le dire :
d'abord en comptant ses connexions neuves ([perf-turso-12]), puis, en
préproduction, avec un délai plus long, en guettant les connexions que
Turso aurait fermées (`other side closed`, `UND_ERR_SOCKET`). S'il
l'annonce (`Keep-Alive: timeout=…`, un en-tête que le proxy retirait),
undici préfère l'annonce à toute garde : au-delà, rien à gagner.
**Pistes**, ce délai connu :
un agent au `keepAliveTimeout` plus long pour les seules requêtes de Turso,
sous ce délai — une connexion que Turso aurait fermée ferait échouer
l'écriture qui l'emprunte ; HTTP/2 (`allowH2` du même agent), si Turso
l'accepte : toutes les requêtes simultanées sur une seule connexion chaude ;
à défaut, un `SELECT 1` toutes les quelques secondes tant que des joueurs
sont là, qui ne lit aucune ligne. L'agent se pose sans dépendance — le
dispatcher global de Node remplacé par un autre de sa classe — ou par
`undici` en dépendance (une de plus : au propriétaire d'en décider, le
dépôt en veut peu). Le gain, sur un trafic clairsemé : de ~225 ms à ~30 par
aller-retour, sur chacun.

**Le premier pas est fait, dans cette PR** (`server/src/core/connexions.ts`,
`connexions-de-la-base.test.ts`) : les connexions se comptent — ouvertes,
refermées par la base et leur âge, tombées en route, le délai que Turso
annonce —, à `/healthz` (`base.connexions`) et sur la page « Le serveur »,
sous le temps de Turso ; et la garde se règle (`QUIZ_DB_KEEPALIVE_MS`, les
4 s de Node sans elle), par un agent de la classe de celui du `fetch`, sans
dépendance. Sur le banc, par le vrai client libsql : après six secondes de
calme, la page du profil ouvrait huit à neuf connexions, aucune avec une
garde de trente secondes. Reste à la poser en préproduction et à lire sa page.

**La suite, le même jour : Turso referme à 5 s, et la garde est retirée.**
Posée à 30 s directement en production (déployée à 16 h 06, `47682f8`), la
garde a fait dire à la page « Le serveur » le délai que la session de
lecture ne pouvait pas lire : Turso referme lui-même une connexion après
5 s de calme, sans l'annoncer — 838 connexions sur 839 refermées par lui
entre 16 h et 17 h, 783 sur 782 l'heure suivante (une venait d'avant), la
plus jeune chaque fois à 5,0 s (5 022 ms). La garde ne gardait donc rien
au-delà de 5 s, et une requête partie juste à 5 s empruntait la connexion
qu'il fermait : six allers-retours tombés entre 17 h et 18 h, et quatre
erreurs 500 — `GET /api/duels`, `GET /api/duels/croises` et
`GET /api/campagne/duel/:code`, qui attendent la même lecture partagée des
cotes de tous (`toutesLesCotes`), et `POST /api/campagne/serie/:id/reponse`,
la réponse d'un joueur. Ce qu'elle gagnait, lu dans les réponses de la
production (sept jours) : seule une réponse arrivée entre 4 et 5 s après la
précédente gardait sa connexion — 4,3 % en campagne, 8,7 % au quiz du jour ;
85 à 92 % arrivent après 5 s, les joueurs répondant le plus souvent toutes
les six à huit secondes. `QUIZ_DB_KEEPALIVE_MS` est retirée du code, et le
démarrage dit de l'ôter des variables d'un service qui la garderait.

**L'entretien des connexions, prototypé à la suite** (`QUIZ_DB_KEEPWARM=1`,
`core/connexions.ts`) : puisqu'une connexion ne se garde qu'en servant, le
serveur la fait servir tant qu'un joueur est là — une route d'API hors de
`/api/admin`, une minute durant (`CHAUDES_MS` ; 99 % des pauses d'une même
partie de campagne et 96 % d'un joueur entre deux parties durent moins
d'une minute, quatorze jours de production) : avant que la plus anciennement
servie des connexions qu'il garde ait trois secondes de calme
(`BATTEMENT_MS`, avant les 4 s de Node, loin des 5 de Turso), un `SELECT 1`
— qui ne lit aucune ligne — sur chaque connexion libre, six au plus (`CHAUDES_AU_PLUS` : une réponse en emprunte deux, la campagne
et les duels quatre à six). Le `fetch` donne à
chaque requête la première connexion libre, et referme une connexion
inactive à 4,0 s pile (mesuré sous Node 22) : la seconde de marge couvre une
boucle en retard. Ses battements passent par un client à eux, et ne
comptent ni dans le temps de Turso, ni dans ses échecs, ni parmi les
connexions neuves d'un joueur : la page « Le serveur » les dit à part.
Sur le banc (`reproductions/connexions-chaudes.ts`) — le vrai serveur, le
vrai client libsql, un faux Turso qui referme à 5 s et fait payer 196 ms à
une connexion neuve, une joueuse qui ouvre l'accueil, la campagne, joue
douze réponses aux écarts de la production, revient sur les duels après
vingt secondes, puis sur l'accueil :

| | sans l'entretien | avec |
|---|---|---|
| Une réponse de série, médiane | 465 ms | 70 ms |
| Réponses qui ont ouvert une connexion | 11 sur 12 | 1 sur 12 |
| La campagne (4 allers-retours) | 342 ms | 109 ms |
| Les duels, après 20 s de pause | 244 ms | 43 ms |
| L'accueil (13 allers-retours de front) | 264 ms, 13 neuves | 248 ms, 7 neuves |
| Connexions neuves, en tout (59 allers-retours) | 52 | 15 |
| Battements | — | 281 en 2 min 40, aucun tombé |

Une bonne réponse fait deux allers-retours enchaînés, et chacun ouvrait sa
connexion : 465 ms de Turso par réponse, ce que la production paie aussi.
L'accueil ne gagne rien : treize allers-retours de front, six connexions
chaudes, et la page attend la plus lente — c'est le terrain d'HTTP/2 ou de
moins d'allers-retours ([perf-turso-5]). Le banc a aussi trouvé le défaut
d'une première version, qui comptait le calme sur toutes les connexions à
la fois : une réponse toutes les une à deux secondes n'en laissait jamais
trois, et les connexions qu'elle n'empruntait pas se refermaient — onze
neuves à l'accueil d'après. Le calme se compte donc connexion par
connexion (`connexions-de-la-base.test.ts` le garde).

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

En production : 9 907 réponses ; la mesure en lit 89 Ko, ~106 ms de plus
qu'un `SELECT 1`, le modèle du savoir — qui arrive au prochain déploiement
— 134 Ko, ~133 ms : les deux lectures les plus chères après les
bibliothèques du réveil, et elles grandissent à chaque réponse. Aucun index
sur `campagne_reponses(reserve_id)` : il n'aiderait pas une lecture qui
prend tout. Ce qu'un joueur a vu (`lectureDesVues`, à chaque série et à
chaque dé) suit la même pente, à son échelle : 103 Ko pour le plus assidu,
déjà en un seul texte.

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
éviterait ce parcours — en production, 149 lignes : c'est l'aller-retour
qui coûte, pas le parcours. Les neuf lectures entières du réveil y pèsent
753 Ko, dont 570 pour les bibliothèques ([perf-turso-14]).

### Les parcours complets

Les plans viennent d'`EXPLAIN QUERY PLAN`, avec les vrais arguments, sur la
base du banc. Sans `ANALYZE` — ni sur le banc, ni chez Turso —, SQLite ne
sait rien du volume : le plan lu ici est celui de la production, à index
égaux — et la production n'a pas encore deux des index du code
d'aujourd'hui ([9] et [10]). Chaque réécriture proposée a été vérifiée
(`reproductions/plans.mjs`), et la base de production en a donné les
temps : à ses volumes, les quatre premiers ne coûtent pas plus de 31 ms —
le dernier, [14], en coûte 295.

**[perf-turso-8] Le carnet parcourt tous les duels du serveur, à chaque
accueil.** `suivisDe` (`core/campagne.ts:1744`) écarte les défis ouverts par
`s.duel IN (SELECT code FROM campagne_duels WHERE ferme_le > ?)` : la liste de
tous les duels ouverts, sans index sur `ferme_le` (`SCAN campagne_duels`) —
l'accueil de chaque profil (le compte « À revoir »), le carnet, ce qu'il a
appris. **Piste** : `EXISTS (SELECT 1 FROM campagne_duels d WHERE d.code =
s.duel AND d.ferme_le > ?)`, une recherche par la clé pour ses seuls duels.
En production : 49 duels ; le carnet du plus assidu, 1 622 lignes, coûte
31 ms de plus qu'un `SELECT 1`, 22 en `EXISTS`. Peu aujourd'hui, à chaque
accueil — et le parcours grandit avec les duels.

**[perf-turso-9] La page de l'économie parcourt toutes les réponses de
campagne**, à chaque ouverture (`economieDepuis`,
`core/campagne.ts:5250`) : le commentaire compte sur
`idx_campagne_series_commencee`, mais le planificateur préfère parcourir
`campagne_reponses` et chercher chaque série par sa clé (`SCAN r`). Le
`CROSS JOIN`, qui impose l'ordre — les séries par leur date, puis leurs
réponses par la clé —, le corrige sur le banc. En production, il perd : la
page n'y est pas encore (la PR #208), ni l'index (`1788205`), et sans lui
le `CROSS JOIN` parcourt toutes les séries — 12 ms de plus qu'un `SELECT
1`, contre 3 pour le parcours des 9 907 réponses. **Piste** : rien pour
l'instant. Le `CROSS JOIN` se remesure une fois l'index en production ; il
ne gagnera que lorsque la semaine de la page ne couvrira plus qu'une part
des séries.

**[perf-turso-10] Les séries du QG parcourent `jour_parties` et
`profile_xp` entiers** (`seriesEnCours`, `core/jour.ts:2650-2654`) : leur
`UNION` se fusionne en parcourant les deux tables par profil, trois fois
(une par lecture du lot). **Piste** : `UNION ALL` — un `IN` n'a que faire des
doublons —, et chaque moitié prend l'index de sa date
(`idx_jour_parties_jour`, `idx_profile_xp_quand`). En production : 17 ms
de plus qu'un `SELECT 1`, 12 en `UNION ALL` ; `profile_xp` n'y a que 149
lignes, et pas encore son index (`de69637`) : sa moitié ne le prendra
qu'au prochain déploiement. Petit, pour une page du QG — la réécriture
reste juste.

**[perf-turso-11] `/healthz` parcourt la réserve du quiz du jour toutes les
dix minutes** — la tâche de cron-job.org qui garde la production éveillée
l'appelle autant (`reserveDuJour`, `server.ts:742-757` →
`etatDeLaReserve`, `core/jour.ts:709`). **Piste** : `avanceDeLaReserve`
(`core/jour.ts:2511`), que la vue d'ensemble lit déjà, par son index. En
production, la réserve compte 404 questions : le parcours coûte 2 ms.
Négligeable — la piste ne vaut que pour la forme.

**[perf-turso-14] Chaque réveil lit les bibliothèques de tous les espaces,
questions comprises** (`allBySpace`, `core/quizStore.ts:172-181`, appelé
par `refreshLibrary` au démarrage, `server.ts:449`). En production : 52
quiz, 570 Ko — les trois quarts des 753 Ko que lisent les neuf lectures
entières du réveil —, quand un réveil ne sert presque toujours qu'un ou
deux espaces. Un seul aller-retour, en parallèle des autres branches du
démarrage, mais un demi-mégaoctet à recevoir sur une connexion neuve et à
décoder deux fois au dixième de cœur : la réponse, puis les questions de
chaque quiz (`rowToQuiz`). **Piste**, à étudier : la bibliothèque d'un
espace lue quand il s'ouvre — un écran d'animateur, une soirée à reprendre
(`refreshLibrary(spaceId)` existe déjà) —, pourvu que « Lancer » et le
salon l'attendent.

### La mesure

**[perf-turso-12] La page « Le serveur » mêle ce qu'elle compare.** Le 95ᵉ
centile « ce qu'un joueur attend » compte les routes de l'administration ;
celui de Turso compte le réveil, le préchauffage, la mesure des
difficultés, le modèle du savoir, le relevé lui-même — et le temps que la
boucle met à revenir. **Pistes**, toutes agrégées et sans un nom comme le
reste du relevé : les routes `/api/admin` à part ; Turso « sous une route »
et « en fond », séparés par un `AsyncLocalStorage` posé dans le minutage des
routes ; les connexions neuves vers Turso, comptées par le canal de
diagnostic `undici:client:connected` (sans dépendance) — la part des
allers-retours qui repaient leur poignée de main, et la seule façon de lire
combien de temps Turso garde une connexion ([perf-turso-13]) ; le gel
imposé par l'hébergeur, lu dans `/sys/fs/cgroup/cpu.stat`
(`throttled_usec`, sous try/catch) — la part du processeur. Et la
préproduction, redéployée à chaque fusion, mesure surtout ses démarrages :
ses heures ne se comparent pas à celles de la production.

## Le plan proposé

1. **Le transport** [13] — la mesure est dans cette PR, et la garde
   réglable n'a pas tenu : Turso referme à 5 s (lu en production le même
   jour, plus haut). À la place, l'entretien des connexions : poser
   `QUIZ_DB_KEEPWARM=1` en préproduction, lire sa page « Le serveur » — la
   part des connexions neuves doit tomber, sans battement ni aller-retour
   tombé en route —, puis la production. HTTP/2 ensuite, s'il passe : une
   seule connexion chaude pour toute une vague. C'est le seul levier qui
   divise chaque aller-retour ; il se mesure tout de suite à `base.p50Ms`.
2. **Une petite PR sûre**, chaque correction avec son test au compteur
   d'allers-retours que les tests ont déjà (`duels-attente.test.ts`,
   `jour-charge.test.ts`) : les lectures partagées [6], la mesure séparée
   [12], le carnet [8], les séries du QG [10]. L'économie [9] et `/healthz`
   [11] attendent : la production n'y gagnerait rien aujourd'hui.
3. **Les allers-retours en série**, un par un : le quiz du jour [4], le
   profil [5], le réveil [7].
4. **Le processeur et les lectures entières**, avant que la base doublée
   n'arrive en production : la base validée au build [1], le préchauffage
   étalé [2] ; puis ce qui lit tout et grandit — la mesure et le modèle en
   delta [3], les bibliothèques à la demande [14].

Hors du code : la plus petite offre payante de Render (un demi-cœur, jamais
endormie) diviserait le terme du processeur et supprimerait les réveils —
un choix de budget, pas une correction ; elle ne change rien aux
connexions. Et la région de la base : à Dublin pour un service à
Francfort, chaque aller-retour fait le trajet, et une connexion à rouvrir
le fait trois fois. Une région plus proche de Francfort, si l'offre de
Turso en propose une (`turso db locations`), raccourcirait chacun ; mais
une base ne déménage pas, elle se recopie sous une autre adresse — une
opération de production, à décider par le propriétaire, et après le
transport, qui gagne plus.

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
  campagne ; la production en a près de dix mille) — les plans ne dépendent
  pas du volume, mais des index ; le miroir des soirées n'a pas été mesuré.
- **La base de production** se lit en lecture seule, depuis une session
  neuve qui voit ses deux variables : `reproductions/lecture-de-la-production.md`
  est la consigne qu'elle a reçue, à lui redonner telle quelle — après le
  prochain déploiement, pour relire [9] et [10] sur leurs index, et le
  modèle du savoir.

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
