# Le filet : ce que les tests prouvent vraiment — rapport de l'expert tests

## En bref

Le filet est solide là où il a été tendu : sur dix-sept lignes importantes
cassées une à une dans le code de #58 et #59, dix sont vues tout de suite par
le fichier de test qui devait les voir (chrono et minuit du quiz du jour,
podium, `peutPorter`, `niveauRequis`, `paliersAtteints`, `titrePorte`, le
laurier d'un masqué, les annulées des écussons). Mais **deux épreuves de la
suite échouent dix-neuf jours par an** — du 25 octobre au 1er novembre, du 20 au
26 décembre, du 30 décembre au 2 janvier — parce qu'une vraie soirée jouée ces
jours-là ouvre la Citrouille, le Sapin ou le Bouquet : **la CI de toute PR
passera au rouge le dimanche 25 octobre 2026**, sans que rien n'ait changé.
Sept mutants survivent, et ils ont tous la même forme : la suite ne joue jamais
le cas qui départage (un deuxième seul sur le podium, deux jours de saison au
lieu de trois, un animateur qui n'est pas l'administrateur).

Les trois améliorations les plus rentables :
1. Fermer le calendrier des saisons dans le banc (quelques lignes, P2) —
   `export/evaluations/tests/calendrier.test.ts` le prouve aujourd'hui.
2. Verser `admin-seulement.test.ts` : 17 des 19 routes derrière `requireAdmin`
   n'ont aucune épreuve qui refuse un animateur ordinaire (P2, écrite, verte).
3. Verser `trous-du-jour.test.ts` : quatre épreuves courtes qui tuent les six
   autres survivants (P3, écrites, vertes).

## Méthode

Environ une heure et demie, sur la machine à quatre cœurs partagés, tout sous
`nice -n 10`, un fichier de test à la fois (charge relevée entre 0,1 et 3,1).

- **Lu** : `consignes-audit.md`, `experts/tests.md`, `modele-rapport.md`,
  `CLAUDE.md` (invariants, pièges), `RECOMPENSES.md` §5.13, les JSON des onze
  autres experts, `.github/workflows/ci.yml`, `server/package.json`,
  `server/test/banc.ts`, et en entier ou en grande partie : `saisons.test.ts`,
  `laurier.test.ts`, `jour-paliers.test.ts`, `jour-partie.test.ts`,
  `sphinx.test.ts`, `collection.test.ts`, `fonds.test.ts`,
  `ecussons.test.ts`, `carte.test.ts` (titre, vitrine), `hasard.test.ts`
  (réglages), `espaces.test.ts` (attentes), `garde-fous.test.ts`
  (photographier), `temps-reel.test.ts` (serveur partagé),
  `server/scripts/smoke.ts` (assertions de fin de soirée) ; côté code :
  `core/jour.ts`, `core/saisons.ts`, `shared/saisons.ts`, `shared/fonds.ts`,
  `shared/ecussons.ts`, `shared/avatars.ts`, `auth/profiles.ts`
  (`peutPorter`, `titrePorte`, durcissements), `quizDuJour.ts`,
  `auth/http.ts`, `core/progress.ts`, `shared/echange.ts`.
- **Le journal de la dernière vérification** : durées par épreuve, rapportées
  à chaque fichier ; et, par le connecteur GitHub, la durée réelle des étapes
  de la CI sur `main` (b57035c).
- **Mutation à la main** : une copie de travail détachée sur b57035c
  (`git worktree add --detach export/evaluations/tests/mutant b57035c`,
  retirée à la fin), dix-sept mutants appliqués et remis par
  `export/evaluations/tests/mutants.py`, chacun contre le ou les fichiers qui
  devraient le voir — et, pour les survivants, contre tous les fichiers qui
  nomment la fonctionnalité (le smoke ne touche ni au quiz du jour, ni aux
  lauriers, ni aux saisons, ni aux écussons : `grep` à zéro).
- **Le calendrier** : `export/evaluations/tests/decale.mjs`, chargé avant
  `tsx`, décale `Date.now()` et `new Date()` (pas les minuteurs) ; les vingt
  fichiers qui closent une soirée rejoués « le 31 octobre », deux témoins
  « le 24 décembre », « le 31 décembre » et « le 2 novembre ».
- **La couverture** : `node --experimental-test-coverage`, les quatorze
  fichiers de test ajoutés par #58/#59 joués en série
  (`--test-concurrency=1`) sur les modules neufs.
- **Une mesure** : le délai entre le podium d'un quiz et sa ligne
  d'expérience en base, pour juger les `patienter(500)` d'`espaces.test.ts`.

Scripts écrits (tous dans `export/evaluations/tests/`) : `mutants.py`,
`decale.mjs`, `calendrier.test.ts` (reproduction, rouge aujourd'hui),
`admin-seulement.test.ts` et `trous-du-jour.test.ts` (épreuves proposées,
vertes aujourd'hui, qui tuent les sept survivants), `mesure-credit.test.ts` ;
sorties dans `sorties/` (un journal par mutant et par fichier,
`mutants.json`, `halloween-*.txt`, `couverture-nouveaux.txt`).

Pas couvert : le smoke (interdit à lancer ; lu seulement), le client (aucune
épreuve n'y tourne hors des lectures de fichiers), l'ordre des épreuves dans
les sept fichiers qui partagent un serveur (non rejoué).

## Constats

### 1. La suite échoue dix-neuf jours par an : Halloween, Noël, le Nouvel An

- **Où** : `server/test/cloture.test.ts:207` et `server/test/soiree.test.ts:496` ;
  la cause, `server/src/core/saisons.ts:26-28` (`laureatsDeSaison` date la
  soirée à sa première question, à l'horloge de la machine) — aucun test ne
  règle cette horloge-là, contrairement à `horlogeDuJour`.
- **Constat** : une soirée jouée pour de vrai dans un test, close avec un
  profil et un second joueur, ouvre le légendaire de la saison si la CI tourne
  pendant la période (date de Paris). Deux épreuves comptent exactement ce qui
  tombe à la clôture et échouent alors :
  - « clore la soirée : chaque téléphone reçoit sa fin… » attend
    `['lg:chouette']`, reçoit `['lg:chouette', 'lg:citrouille']` ;
  - « les prix ne se décident qu'à la clôture… » lit `profile_badges` sans les
    `hf:` et trouve `« saison:halloween » : 2 lauréats pour une seule soirée`
    (puis `saison:noel`, `saison:nouvel-an`).
- **Preuve** : rejoué, `DATE_CIBLE=2026-10-31T19:00:00Z node --import
  ../export/evaluations/tests/decale.mjs --import tsx --test …` ; échoue aussi
  le 24 et le 31 décembre, passe le 2 novembre (témoin). Les dix-huit autres
  fichiers qui closent une soirée passent à Halloween (`credits`, `eclat`,
  `espaces`, `fin-de-soiree`, `legendaires`, `divins`, `finitions`, `profil`,
  `relecture`, `chiffres`, `garde-fous`, `miroir`, `equipes`,
  `grande-salle`, `resultats`, `saisons`, `scene`, `temps-reel`) : ce sont
  bien ces deux épreuves-là, et elles seules. Reproduction :
  `export/evaluations/tests/calendrier.test.ts` (deux épreuves rouges, le
  témoin vert).
- **Qui ça touche, ce que ça coûte** : toute l'équipe, le 25 octobre 2026 : la
  CI de chaque PR est rouge pendant huit jours, puis sept, puis quatre ; la
  préproduction, déployée à chaque fusion sur `main`, attend. La tentation
  sera de désactiver l'assertion — ce que `CLAUDE.md` interdit.
- **Statut** : bug confirmé (rejoué) — du filet, pas du produit.
- **Piste** : un calendrier des soirées qu'on ferme, comme
  `ProfileStore.tirageEclat` :
  ```ts
  // server/src/core/saisons.ts
  /** Les tests le ferment : une soirée jouée en octobre par la CI n'ouvre pas la Citrouille. */
  export const calendrierDesSoirees = { periodeDu }
  // …dans laureatsDeSaison :
  const periode = calendrierDesSoirees.periodeDu(jourDe(premiere))
  ```
  ```ts
  // server/test/banc.ts, et server/scripts/smoke.ts
  // Une soirée jouée pour de vrai se date à l'horloge de la machine : sans ça,
  // la suite échouait du 25 octobre au 2 janvier.
  calendrierDesSoirees.periodeDu = () => null
  ```
  `saisons.test.ts` le rouvre (`calendrierDesSoirees.periodeDu = periodeDu`)
  en tête de fichier. Un piège de plus au `CLAUDE.md` : « une règle qui lit la
  date d'une soirée se ferme dans le banc ».
- **Priorité · effort** : P2 · S.

### 2. Aucune épreuve ne refuse un animateur ordinaire aux routes de l'administrateur (17 sur 19)

- **Où** : `server/src/quizDuJour.ts:176-275` (les neuf routes de
  `/api/admin/jour`), `server/src/auth/routes.ts:265-339` (les sept de
  `/api/admin/accounts`), `server/src/partages.ts:137-156` (le catalogue).
- **Constat** : 19 routes passent par `requireAdmin` ; seules deux ont une
  épreuve qui vérifie le 403 d'un animateur qui n'est pas l'administrateur
  (`partage.test.ts:130` et `:134`, le catalogue). L'administration du quiz du
  jour n'a que le cas « un profil sans console » (401,
  `jour-partie.test.ts:272`, `jour-reserve.test.ts:169`).
- **Preuve** : le mutant M13 retire `requireAdmin` de
  `/api/admin/jour/masquer` : `jour-partie.test.ts` (12/12) et
  `laurier.test.ts` passent — n'importe quel animateur masquerait alors un
  joueur du classement ; retiré d'`annuler` ou de `prochaines`, il annulerait
  une question pour tous ou lirait les 70 prochaines questions avec leurs
  réponses. L'épreuve proposée `export/evaluations/tests/admin-seulement.test.ts`
  lit les routes dans le routeur d'Express (derrière `requireAdmin` ou sous
  `/api/admin`), les essaie toutes avec la session de Nadia : verte sur le code
  d'aujourd'hui, elle tue M13 (`POST /api/admin/jour/masquer → 404`).
- **Qui ça touche, ce que ça coûte** : personne aujourd'hui (les gardes sont
  là, l'expert `invariants` les a comptées) ; demain, une route de plus ou un
  garde retiré dans un refactor ouvrirait l'administration de tout le serveur
  à chaque animateur, sans qu'une épreuve rougisse.
- **Statut** : trou du filet confirmé (mutant rejoué).
- **Piste** : verser `admin-seulement.test.ts` dans `server/test/` (sur le
  modèle de `garde-fous.test.ts` : la liste se lit dans le code, une route
  neuve y entre d'elle-même).
- **Priorité · effort** : P2 · S.

### 3. Un deuxième seul sur le podium du jour n'est jamais joué : victoire, Champion du jour, laurier, carte

- **Où** : `server/src/core/jour.ts:1000` (`statsDuJour`), `:1047`
  (`resumeDe`), `:1495` (`lireLauriers`) ; les épreuves
  `laurier.test.ts:92` et `jour-paliers.test.ts:133`, `:158`.
- **Constat** : les trois lectures de « vainqueur » filtrent `rang = 1`. Les
  remplacer par `rang <= 3` (ou `<= 2` pour le laurier) ne fait rougir aucune
  épreuve : chaque scénario du quiz du jour a soit des ex æquo en tête, soit
  un troisième qui, à trois joueurs, n'a pas de marche (`xpDuPodium` : une
  marche de moins que la salle). Le message « Carole, deuxième, n'en porte
  pas » (`laurier.test.ts:92`) décrit une Carole qui est en fait **troisième**
  (Alice et Bob ex æquo) et hors podium ; « Carole non » dans
  `jour-paliers.test.ts` n'a pas de ligne de podium à filtrer.
- **Preuve** : mutants M04, M05, M06 survivants contre `jour-paliers`,
  `sphinx`, `fonds`, `carte`, `jour-partie`, `finitions`, `laurier`, `ecran`
  (journaux `sorties/M04-*.txt`, `M05-*.txt`, `M06-*.txt`). La première
  épreuve de `export/evaluations/tests/trous-du-jour.test.ts` (quatre joueurs,
  trois marches sans ex æquo) passe aujourd'hui et tue les trois.
- **Qui ça touche, ce que ça coûte** : une régression ferait des Champions du
  jour, des Kintsugi (dix « victoires »), des Sphinx et des lauriers aux
  deuxièmes et troisièmes — de l'expérience de palier en trop, rangée sous le
  jour, que rien ne reprend.
- **Statut** : trou du filet confirmé (mutants rejoués).
- **Piste** : verser l'épreuve ; corriger le message de `laurier.test.ts:92`
  (« Carole, troisième et hors podium »).
- **Priorité · effort** : P3 · S.

### 4. Les saisons : ni le seuil de jours, ni la soirée à cheval sur minuit, ni « une partie commencée compte »

- **Où** : `server/src/core/jour.ts:1272` (`accorderSaison`),
  `server/src/core/saisons.ts:26-28` ; `saisons.test.ts:94-125`.
- **Constat** : `saisons.test.ts` écrit deux jours en base puis joue le
  troisième : il vérifie que trois jours suffisent, jamais que deux ne
  suffisent pas. Et ses soirées se datent toutes dans une seule journée : dater
  la soirée à sa **dernière** question plutôt qu'à la première ne change rien
  pour lui. Enfin, toutes les parties que les tests écrivent en base sont
  finies (`finie_le = 1` dans `fonds`, `jour-paliers`, `saisons`, `sphinx`) :
  la promesse « une partie commencée compte » (L'Assidu, les saisons,
  `RECOMPENSES.md` §5.13) n'a aucune épreuve — c'est là que l'expert
  `jour-regles` a trouvé son constat 3.
- **Preuve** : mutants M09 (dater à la dernière question) et M10 (`jours - 1`)
  survivants contre `saisons` et `hautsfaits`. Les épreuves 2 et 3 de
  `trous-du-jour.test.ts` les tuent (deux jours à Halloween : pas de
  Citrouille ; 23 h 50 le 1er novembre puis 0 h 20 : Halloween).
- **Qui ça touche, ce que ça coûte** : une régression ouvrirait la Citrouille
  un jour trop tôt, ou la refuserait à la soirée d'Halloween qui finit après
  minuit — la soirée même pour laquelle elle existe.
- **Statut** : trou du filet confirmé (mutants rejoués).
- **Piste** : verser les deux épreuves ; ajouter celle d'une partie commencée
  et laissée (elle échouera tant que `jour-regles-3` n'est pas corrigé).
- **Priorité · effort** : P3 · S.

### 5. Les chemins du quiz du jour que rien ne parcourt

- **Où** : `server/src/core/jour.ts:528-539` (la réserve à sec),
  `:789-807` (la vue sans tirage), `:900-913` (`classementDuMois`),
  `:480-495` et `:1372-1376` (`prochaines`, `retirer`, `garder`), `:1453`
  (démasquer) ; `server/src/quizDuJour.ts:211`, `:232-233`, `:250-254`.
- **Constat** : joués en série sous `--experimental-test-coverage`, les
  quatorze fichiers de test de #58/#59 couvrent 94,6 % des lignes de
  `core/jour.ts`, mais ces branches-là jamais :
  - « à sec, les plus anciennes reviennent, pas celles du mois : jamais un jour
    vide » (`RECOMPENSES.md`) — aucun test ne tire plus de trois jours sur les
    38 questions livrées ;
  - la vue « aucun quiz aujourd'hui » : c'est exactement là que vit le constat
    `jour-regles-5` (« Question suivante » après minuit) ;
  - le classement du mois, et trois gestes de modération (`retirer`, `garder`,
    `prochaines`), le démasquage ;
  - « deux par catégorie au plus » (`choisir`, `:159`) s'exécute, mais aucune
    assertion ne le lit.
- **Preuve** : `sorties/couverture-nouveaux.txt` (74 épreuves vertes, le
  tableau de couverture), commande dans la section « Mesures ».
- **Qui ça touche, ce que ça coûte** : le jour où la réserve s'épuise — la
  routine qui la remplit en panne une semaine —, le tirage suit un chemin que
  rien n'a jamais joué.
- **Statut** : trou du filet confirmé (couverture rejouée).
- **Piste** : une épreuve « la réserve à sec » (vider `jour_reserve` sauf
  douze questions posées il y a quarante jours, tirer trois jours de suite :
  dix questions chaque jour, aucune du mois) ; une « après minuit, sans
  recharger » ; une pour le classement du mois ; une pour `retirer` et
  `garder`.
- **Priorité · effort** : P3 · M.

### 6. Une assertion conditionnelle : un fichier d'avant refusé passe `hasard.test.ts`

- **Où** : `server/test/hasard.test.ts:138`.
- **Constat** : « Un fichier d'avant n'a pas de réglages : il se joue tel
  qu'écrit » s'écrit `if (!('erreur' in vieux)) assert.deepEqual(…)` : si
  `deballerQuiz` refuse le fichier — la régression même que l'épreuve garde —,
  l'assertion ne s'exécute pas. Trois lignes plus haut, le même motif est
  précédé d'un `assert.ok(!('erreur' in deballe))` ; ici, non.
- **Preuve** : mutant M17 (`deballerQuiz` refuse un fichier sans `reglages`) :
  `hasard.test.ts` passe 9 sur 9 (`sorties/M17-hasard.txt`) ; il n'est tué que
  par `echange.test.ts`, dont les fichiers de test se trouvent n'avoir pas de
  réglages.
- **Statut** : épreuve creuse, confirmée (rejouée).
- **Piste** : `assert.ok(!('erreur' in vieux), 'un fichier d’avant se lit')`
  avant la ligne 138.
- **Priorité · effort** : P3 · S.

### 7. Les seuils du lot D ne sont épinglés nulle part

- **Où** : `shared/ecussons.ts:17` ; `ecussons.test.ts:16-18`.
- **Constat** : l'épreuve des écussons relit `SEUILS_ECUSSON` pour construire
  ses attentes : l'or à 150 au lieu de 200 passe. `RECOMPENSES.md` et le
  message du commit annoncent 20 / 75 / 200 comme un choix de produit ; le
  podium du jour, lui, est épinglé (`jour.test.ts:48`).
- **Preuve** : mutant M12 survivant ; tué par l'épreuve 4 de
  `trous-du-jour.test.ts`.
- **Statut** : trou du filet, mineur (un choix de produit qui change sans
  qu'une épreuve demande de le dire).
- **Piste** : une ligne qui épingle les seuils, avec le commentaire « le
  changer se dit, ici et dans RECOMPENSES.md ».
- **Priorité · effort** : P3 · S.

## Mesures et cartes

### Les mutants

Copie de travail détachée sur b57035c ; chaque ligne cassée seule, puis
remise. « Tué par » : le premier fichier qui rougit. Les survivants ont été
rejoués contre tous les fichiers qui nomment la fonctionnalité.

| # | Ligne cassée | Fichiers lancés | Verdict | Tué par (proposé) |
|---|---|---|---|---|
| M01 | `jour.ts:661` `aTemps = true` (le chrono du jour ne coupe plus) | jour-partie | **tué** | « le chrono est celui du serveur » |
| M02 | `jour.ts:658` minuit ne clôt plus une réponse d'hier | jour-partie | **tué** | « minuit clôt la journée » |
| M03 | `jour.ts:1216` podium : `joueurs.length + 1` | jour-partie | **tué** | « minuit clôt la journée » |
| M04 | `jour.ts:1000` `statsDuJour` : `rang <= 3` est une victoire | jour-paliers, sphinx, fonds, carte, jour-partie, finitions | survit | trous-du-jour ① |
| M05 | `jour.ts:1047` `resumeDe` (la carte) : `rang <= 3` | carte, jour-partie | survit | trous-du-jour ① |
| M06 | `jour.ts:1495` laurier : `rang <= 2` | laurier, ecran | survit | trous-du-jour ① |
| M07 | `profiles.ts:718` `peutPorter` : un niveau d'avance | collection | **tué** | — |
| M08 | `avatars.ts:50` `niveauRequis` sur la chaîne entière | collection | **tué** | — |
| M09 | `saisons.ts:26` soirée datée à sa dernière question | saisons, hautsfaits | survit | trous-du-jour ③ |
| M10 | `jour.ts:1272` saison : `jours - 1` suffit | saisons, hautsfaits | survit | trous-du-jour ② |
| M11 | `hautsfaits.ts:488` la clôture décerne les paliers du jour | jour-paliers | **tué** | — |
| M12 | `ecussons.ts:17` l'or à 150 | ecussons | survit | trous-du-jour ④ |
| M13 | `quizDuJour.ts:268` `masquer` sans `requireAdmin` | jour-partie, laurier | survit | admin-seulement |
| M14 | `profiles.ts:733` `titrePorte` ne relit plus les hauts faits | carte | **tué** | — |
| M15 | `jour.ts:1496` un masqué garde son laurier | laurier | **tué** | — |
| M16 | `jour.ts:1030` une annulée compte à l'écusson | ecussons | **tué** | — |
| M17 | `echange.ts:118` un fichier sans réglages refusé | hasard, echange | **tué** (par echange ; hasard passe) | — |

Score : 10 tués sur 17 ; avec les deux fichiers proposés, 17 sur 17.

### Les épreuves fragiles ou creuses

| Épreuve | Nature | Ce qui la rend fragile ou creuse |
|---|---|---|
| `cloture.test.ts:162` « clore la soirée : chaque téléphone reçoit sa fin… » | fragile (calendrier) | rouge du 25/10 au 1/11, 20-26/12, 30/12-2/1 (constat 1) |
| `soiree.test.ts` « les prix ne se décident qu'à la clôture… » (l. 496) | fragile (calendrier) | idem ; sa requête compte aussi les lignes `saison:` comme des prix |
| `hasard.test.ts:138` | creuse | assertion sous `if` (constat 6) |
| `laurier.test.ts:92` « Carole, deuxième » | creuse en partie | Carole est troisième et hors podium : le cas « deuxième » n'est pas joué (constat 3) |
| `jour-paliers.test.ts:133, 158` « Carole non » | creuse en partie | à trois joueurs, la troisième n'a pas de ligne de podium à filtrer |
| `saisons.test.ts:94-125` | creuse en partie | ne vérifie jamais qu'un jour de moins ne suffit pas (constat 4) |
| `ecussons.test.ts:16-18` | creuse en partie | attentes relues dans la constante qu'elles devraient garder (constat 7) |
| `garde-fous.test.ts:199` `vueEnCours … .catch(() => null)` | à surveiller | si la vue ne vient pas, les deux photos disent « undefined » et se ressemblent ; non rejoué |
| temps-reel (17), portes (28), securite (19), telephone-perdu (16), grande-salle (13) | à surveiller | un serveur partagé par toutes les épreuves du fichier : `--test-name-pattern` sur l'une d'elles n'a pas été essayé |

### Les attentes au temps : mesurées, pas fragiles

`espaces.test.ts` attend dix fois à l'aveugle (`patienter(300)` ou `(500)`),
dont quatre fois « le crédit du quiz » avant de compter les lignes
d'expérience — le motif que 89d4260 a retiré ailleurs dans le même fichier.
Mesuré (`mesure-credit.test.ts`, deux passages de six quiz, charge ≈ 1,1) : la
ligne est en base **0 à 1 ms** après la vue du podium. La marge est de ×500 :
pas de faux rouge à attendre. Les attentes qui suivent `geste()` sont
redondantes (le toast arrive après l'effacement). Coût total : environ 4 s
d'attente pure dans ce fichier.

### Le temps de chaque fichier

Somme des épreuves par fichier, dans la vérification complète (trois fichiers
en parallèle, 263 s de mur pour 722 s d'épreuves) :

| Fichier | Épreuves | Somme | Part des 120 s |
|---|---|---|---|
| cloture.test.ts | 11 | 74,0 s | 62 % |
| espaces.test.ts | 9 | 67,0 s | 56 % |
| soiree.test.ts | 6 | 56,4 s | 47 % |
| telephone-perdu.test.ts | 4 | 43,1 s | 36 % |
| credits.test.ts | 6 | 33,7 s | 28 % |

La CI (`ubuntu-latest`) va aussi vite qu'ici : l'étape « Tests » de `main`
(b57035c) a pris 4 min 21 s, la vérification entière 6 min 35 s pour un
plafond de 15. Aucun fichier n'approche la limite ; `cloture` et `espaces`
sont les premiers à couper le jour où ils gagnent trois ou quatre épreuves.

### La couverture des modules neufs (14 fichiers de #58/#59, en série)

```
cd server && nice -n 10 node --enable-source-maps --import tsx --test --test-concurrency=1 \
  --experimental-test-coverage --test-coverage-include='src/core/jour.ts' … \
  test/carte.test.ts … test/sphinx.test.ts
```

| Module | Lignes | Branches | Jamais parcouru (hors types et en-têtes) |
|---|---|---|---|
| `core/jour.ts` | 94,6 % | 83,3 % | réserve à sec, vue sans tirage, classement du mois, `prochaines`, `retirer`, `garder`, démasquer |
| `quizDuJour.ts` | 97,1 % | 75,8 % | routes `prochaines`, `garder`, `retirer` |
| `core/saisons.ts`, `shared/fonds.ts`, `shared/ecussons.ts`, `shared/proches.ts` | 100 % du code exécutable | — | — |

### Où les autres experts ont trouvé le filet troué

Près d'un tiers des 107 constats des onze autres rapports se rangent dans
trois familles que la suite ne joue pas :

1. **deux gestes qui se croisent** (concurrence 1 à 11, jour-regles 2 et 7,
   recompenses-comptes 2 et 3) : les épreuves enchaînent `await` sur `await` ;
   seules `jour-partie` (« une annulation qui croise une réponse ») et
   `espaces` (« deux soirées closes au même instant ») retiennent une écriture
   pour en faire passer une autre ;
2. **une panne à mi-chemin** (persistance 2 à 7, jour-regles 6) : le
   déclencheur `RAISE(ABORT)` de `miroir.test.ts` ne sert qu'au miroir, jamais
   aux écritures des profils ;
3. **un second appareil ou un second profil** (jour-regles 1 et 4,
   securite-portes 1, moteur 10) : la suite joue un téléphone par personne.

## Ce qui marche — à ne pas casser

- **Le banc** : un serveur jetable par fichier, deux bases dans un dossier
  temporaire, `redemarrer({ disqueEfface })`, et `instantane()` qui retient le
  dernier instantané — le piège du paquet qui arrive avant l'écouteur est
  réglé une fois pour toutes.
- **Les horloges qu'on règle** : `horlogeDuJour` pour le quiz du jour, `mock.timers` avec `Date` pour
  `grande-salle` et `classement-en-cours`, `ProfileStore.tirageEclat` pour le
  hasard. Seule `carte.test.ts` commence une partie du jour à l'heure réelle,
  sans rien en attendre qui dépende du jour. Le constat 1 demande seulement d'étendre ce principe aux saisons.
- **Les listes lues dans le code** : `garde-fous.test.ts` tente chaque
  commande du contrat ; c'est le modèle d'`admin-seulement.test.ts`.
- **Les attentes nommées** : chaque `attendre()` a son libellé et son délai ;
  une épreuve qui échoue dit ce qu'elle attendait.
- **La mutation tue là où il faut** : le chrono, minuit, le podium, le port
  d'un emoji de collection, les paliers du jour tenus à l'écart des soirées,
  le titre qui tombe avec son haut fait, le laurier d'un masqué, les
  annulées — tous vus du premier coup.
- **La vitesse** : 652 épreuves en 4 min 21 s en CI, sans un rejeu.

## Recommandations, dans l'ordre

1. **Fermer le calendrier des saisons dans le banc et le smoke**, rouvert par
   `saisons.test.ts` (constat 1). À faire avant le 25 octobre. P2 · S.
2. **Verser `admin-seulement.test.ts`** dans `server/test/` (constat 2).
   P2 · S.
3. **Verser `trous-du-jour.test.ts`** (constats 3, 4, 7) et corriger le
   message « Carole, deuxième ». P3 · S.
4. **Rendre l'assertion de `hasard.test.ts:138` inconditionnelle**
   (constat 6). P3 · S.
5. **Écrire les épreuves des chemins jamais parcourus** : la réserve à sec,
   la vue après minuit sans recharger, le classement du mois, `retirer` /
   `garder` / `prochaines`, une partie commencée qui compte (constats 4 et 5).
   P3 · M.
6. **Un outil de banc pour croiser deux gestes** — retenir une écriture de
   `ProfileStore` ou de `JourStore` le temps d'en laisser passer une autre,
   comme le fait déjà `jour-partie.test.ts:368` à la main — et un déclencheur
   de panne pour les tables des profils : c'est là que la plupart des constats
   des autres experts attendent leur épreuve. P3 · M.
7. **Au `CLAUDE.md`, deux pièges de plus** : « une règle qui lit la date d'une
   soirée se ferme dans le banc » ; et, pour qui écrirait une épreuve qui
   relance `node --test` (comme `calendrier.test.ts`) : l'enfant hérite de
   `NODE_TEST_CONTEXT`, se croit rapporteur de son parent et **ne joue rien**
   — la première version de cette reproduction passait ainsi à vide en
   0,5 s ; il faut retirer la variable et vérifier `# tests ≥ 1`. P3 · S.

## Limites

- Dix-sept mutants, choisis dans le code de #58/#59 : un échantillon, pas une
  mesure de toute la suite. Les modules plus anciens (moteur, miroir,
  sockets) n'ont pas été mutés.
- Le smoke n'a pas été lancé : je le crois insensible au calendrier (il ne lit
  ni `legendaires` ni les lignes `saison:`), sans l'avoir vérifié.
- L'ordre des épreuves dans les fichiers à serveur partagé n'a pas été
  rejoué ; Node 22 ne mélange pas l'ordre.
- `decale.mjs` décale l'horloge murale, pas celle de SQLite ni les
  minuteurs : il suffit aux saisons (dates tirées de `Date.now()` côté
  serveur), pas à tout.
- Les durées dépendent de la charge (1 à 3 sur quatre cœurs partagés avec
  d'autres experts) ; les verdicts des mutants, non.
