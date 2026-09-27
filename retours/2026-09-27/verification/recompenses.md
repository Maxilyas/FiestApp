# Contre-expertise du groupe `recompenses` — `recompenses-comptes` et `recompenses-vitrine`

Code relu : `main`, b57035c. Machine : quatre cœurs partagés, charge 0,2 à 1,7
pendant les rejeux (`uptime`), un fichier de test à la fois sous `nice -n 10`.
Rien de suivi par git n'a été modifié ; rien n'est resté allumé.

## En bref

Les deux rapports sont honnêtes : **aucun constat réfuté**. Toutes les
reproductions échouent aujourd'hui, et pour la raison annoncée. Le seul P2
propre à ce groupe tient : **au prochain `VERSION_BAREME`, tout l'historique
se relira à chaque démarrage** (`{"v":6.0}`), rejoué et mesuré. Or trois
rapports (celui-ci, `invariants-2`, et la correction des parties seules plus
bas) demandent justement de monter le barème : **cette ligne se corrige
d'abord**.

Le second P2, la clôture reprise ou croisée qui se tait, est un **doublon**
de `concurrence-4` et `concurrence-1`, à fusionner. Sa part propre : les
légendaires de hauts faits et les Divins, pas seulement les paliers.

Deux gravités revues :
- les **paliers tombés en jouant seul** (hors mission de `recompenses-vitrine`,
  annoncé P2) sont réels, et c'est l'invariant 19 qui casse, mais ils sont P3 :
  il faut un compte d'animateur, le gain est cosmétique, et le même élevage
  reste ouvert avec un second téléphone ;
- la **course de `#paliers`** (`recompenses-comptes-3`) ne se produit pas avec
  des temps ordinaires : 0 perte sur 120 essais à 20 ms ± 18. Il faut une
  requête bloquée plusieurs allers-retours. Le palier rangé deux fois, lui,
  se produit 27 fois sur 40 quand deux clôtures du même profil tombent à
  60 ms d'écart ; c'est déjà rare.

Enfin, une phrase de « Ce qui marche » de `recompenses-vitrine` est fausse :
`player:join` n'est pas étanche. C'est `securite-temps-reel-2`, vérifié ici.

## Le tableau

| Constat | Gravité annoncée | Verdict | Gravité retenue | Pourquoi, en une ligne |
|---|---|---|---|---|
| comptes-1 · `{"v":6.0}` : recalcul à chaque démarrage | P2 | confirmé | P2 | Rejoué. Le nombre est lié en REAL (local et hrana) ; mesuré : +1,8 s et 345 requêtes au lieu de 60 à chaque démarrage, pour 30 soirées |
| comptes-2 · clôture reprise ou croisée muette | P2 | doublon | P2 | Rejoué (2 échecs sur 3, le témoin passe). Même cause que `concurrence-4` et `concurrence-1` ; ajoute les légendaires et les Divins |
| comptes-3 · pas de verrou par profil | P3 | confirmé | P3 | (a) Impossible à temps égaux (0 sur 120) : il faut une requête bloquée. (b) 27 sur 40 quand deux clôtures coïncident |
| comptes-4 · palier retiré mais encore mérité | P3 | confirmé | P3 | Rejoué. Rien ne redécerne après `DELETE /api/soirees/:id`, `api.ts:440-442` |
| comptes-5 · Citrouille perdue avec la soirée | P3 | doublon | P3 | Rejoué ; c'est `jour-regles-8`, même piste |
| comptes-6 · La Légende hors du quiz du jour | P3 | tension | P3 | Rejoué ; invariant 10 (paliers à la clôture) contre option B (le jour compte dans le niveau) |
| comptes-7 · saisons sans `VERSION_BAREME` | P3 | doublon | P3 | C'est `invariants-2`, rejoué là-bas ; ne se corrige qu'après comptes-1 |
| comptes-8 · compte supprimé, crédits gardés | P3 | tension | P3 | Lu, `server.ts:397-420` : aucun appel à `ProfileStore`. À trancher |
| vitrine-1 · le quiz du jour n'annonce pas le niveau | P3 | confirmé | P3 | Rejoué ; la fin de partie montre la barre (`JourApp.tsx:485-491`), jamais la montée |
| vitrine-2 · `hautsFaitsGagnes` ne lit que le bronze | P3 | confirmé | P3 | Rejoué ; la correction d'une ligne (`cleRangee`) est la bonne |
| vitrine-3 · écusson fait seul | P3 | tension | P3 | Rejoué ; même cause que les paliers solo, une seule correction |
| vitrine-4 · emoji de collection gardé en soirée | P3 | confirmé | P3 | Rejoué ; il faut un niveau qui redescend en pleine soirée |
| vitrine-5 · récit d'un Divin sur `/api/auth/me` | P3 | confirmé | P3 | Rejoué. Lettre de l'invariant 21 ; risque minime à côté de `securite-portes-1` |
| vitrine-6 · emoji sous un légendaire (3 écrans) | P3 | confirmé | P3 | Le sondage à la télé, oui. Les prix et « ont gagné hier » sont des lignes de texte, où l'emoji est voulu (RECOMPENSES § 5.4) |
| vitrine-7 · Éclat de la page du compte | P3 | confirmé | P3 | Rejoué (la garde) et lu, `AccountApp.tsx:199` |
| vitrine-8 · avatar d'Unicode 13+ forgé | P3 | confirmé | P3 | Rejoué ; durcissement de faible valeur (quatre caractères quelconques passent déjà) |
| vitrine-9 · dessins des médaillons sur `/` | P3 | confirmé | P3 | Lu : imports statiques `Apparence.tsx:5-6`, `Trophees.tsx:3` ; mesure Playwright non rejouée |
| vitrine-10 · attente des dessins en pleine question | P3 | tension | P3 | Lu : 2,5 s au plus, une fois, voulu dans le code |
| vitrine-11 · petites incohérences (4) | P3 | confirmé | P3 | Les quatre relues, toutes tiennent |
| vitrine hors mission · paliers tombés seul | P2 | confirmé, gravité revue | P3 | Rejoué (Le Devin, +10 XP seul) ; invariant 19, mais seulement pour un animateur, cosmétique |
| vitrine hors mission · saison gagnée deux fois | — | doublon | P3 | `recompenses-comptes-5` = `jour-regles-8` |
| vitrine hors mission · page du profil sans filet | — | confirmé | P3 | La table renommée n'arrive pas en ligne ; le vrai chemin est `clorePasses` dans `carriereDe`, qui lève |

Compte : 13 confirmés, 1 confirmé à gravité revue, 4 tensions, 4 doublons,
0 réfuté, 0 incertain.

## Méthode

**Rejoué** : toutes les reproductions des deux experts, sauf deux témoins qui
passent déjà (`recalcul-du-jour`, `ecritures-forgees`) et la mesure Playwright
(`octets-accueil.ts`). Plus la mesure `mesure-recalcul-perpetuel.ts` à
30 soirées et 20 ms.

**Écrit**, dans `export/evaluations/verification/recompenses/` :

| Fichier | Ce qu'il montre | Résultat |
|---|---|---|
| `paliers-latence.test.ts` | Les deux courses de comptes-3 sans écriture tenue à la main. Chaque requête paie un aller-retour de 20 ms ± gigue, partagé au hasard entre aller et retour (des réponses qui peuvent se doubler), et les deux décernements partent à 0-60 ms d'écart | (a) 0 perte sur 40 à ± 8 ms, 0 sur 80 à ± 18 ms (`GIGUE=18 ESSAIS=80`). (b) 27 doubles sur 40 |
| `liaison-flottante.ts` | Ce que `json_set(detail, '$.v', ?)` écrit | `{"v":6.0,…}`, type `real` ; avec `CAST(? AS INTEGER)` : `{"v":7,…}` |
| `paire-coupee.ts` | `niveauRequis` sur la chaîne brute contre la chaîne nettoyée | 🪐 coupé par U+200B : niveau 0 brut, 17 une fois nettoyé |

**Lu**, en plus des rapports, des fiches et des autres JSON :
- `profiles.ts` : `aRecalculer`, `remettreAuBareme`, `accorderPaliers*`, `ecrireXpDesPaliers`, `accorderSaison`, `retirerSoiree*`, `crediterSoireeEntiere`, `update`, `toPublic`, `careerOf` ;
- `recalcul.ts` et `server.ts` (démarrage, `removeAccount`) ;
- `space.ts` : `closeParty`, `crediterCloture`, `carteDe` ;
- `sockets.ts` : `player:join`, `host:closeParty` ;
- `api.ts` (`DELETE /api/soirees/:id`), `routes.ts` (`/api/auth/me`), `profileRoutes.ts` (`detailDe`) ;
- `progress.ts`, `journal.ts` (réflexes), `jour.ts` (`clorePasses`, `vainqueursDe`, `categoriesDe`, `carriereDe`), `quiz.ts` (`votesDuSondage`) ;
- `shared/profil.ts` (`carriereDe`, `soireeQuiCompte`), `hautsfaits.ts`, `legendaires.ts`, `avatars.ts` ;
- le client : `HostApp.tsx` (« Clore »), `PlayerApp.tsx`, `AccountApp.tsx`, `Apparence.tsx`, `Carriere.tsx`, `CarteJoueur.tsx`, `Entree.tsx`, `AwardsBoard.tsx`, `JourApp.tsx` ;
- `RECOMPENSES.md` § 5.1 à 5.5 ;
- `retours/2026-09-24/experts/robustesse-espaces.md` : aucun doublon ancien ;
- l'historique git de `VERSION_BAREME` : passé à 6 le 24 septembre, deux jours avant la première ligne `#jour` (dd3b2a3). Le défaut de comptes-1 est donc bien latent.

## Les constats, un par un

### recompenses-comptes-1 — confirmé, P2

**Reproduction.** `recalcul-perpetuel.test.ts` échoue pour la raison
annoncée. Le second démarrage journalise encore « 1 soirées relues », et la
ligne lit `{"v":6.0,"jours":1}`.

Je l'ai simulée comme l'expert, en redescendant les lignes par un `json_set`
écrit en dur : c'est l'état de toute base au lendemain d'un barème monté.

**Le chemin.**
1. `remettreAuBareme` (`profiles.ts:1755-1759`) lie `VERSION_BAREME`, un nombre JS.
2. En local, `valueToSql` le passe tel quel à la liaison native, qui en fait un `real` (`liaison-flottante.ts`). Chez Turso, hrana l'envoie en `type: "float"` (`@libsql/hrana-client/lib-esm/shared/json_encode.js:53-55`). SQLite écrit alors `6.0`.
3. `aRecalculer` cherche `NOT LIKE '{"v":6,%'` (`profiles.ts:1705-1706`) : la ligne reste à relire.
4. Le recalcul tourne **avant** l'ouverture du port (`server.ts:345`).
5. Seule une partie du quiz du jour réécrit la ligne proprement (`ecrireXpDuJour`, `JSON.stringify`, `profiles.ts:1789`).

Aucune garde en amont.

**Mesure** (mienne, 30 soirées, 20 ms) :

| Démarrage | Durée | Requêtes à la base permanente |
|---|---|---|
| ordinaire | 1,2 s | 60 |
| 2ᵉ après le barème | 3,0 s | 345 |
| 3ᵉ après le barème | 3,0 s | 345 |

Même allure que les 101 soirées de l'expert.

**Réalité.** Rien n'arrive tant que `VERSION_BAREME` reste à 6. Mais
`invariants-2`, `recompenses-comptes-7` et la correction des parties seules
demandent toutes une montée. Chaque réveil de Render paierait alors des
secondes qui croissent avec l'historique, jusqu'à ce que chaque profil du
quiz du jour ait rejoué. Le recalcul est idempotent : aucun Éclat n'est
retiré (`crediterSoireeEntiere` n'en tire pas), donc le dommage est du temps,
pas des données.

P2 tient : c'est certain dès la prochaine montée, et chaque démarrage le paie.

**Correction.** Celle de l'expert : `CAST(? AS INTEGER)`, vérifiée par
`liaison-flottante.ts`. Deux ajouts :
- corriger aussi le test existant (`jour-partie.test.ts:350`), qui lit
  `JSON.parse(detail).v !== 1` et que `6.0` satisfait. Il faut vérifier que
  `(await profiles.aRecalculer()).lignes` est vide après un démarrage ;
- livrer cette correction **dans le même commit** que la première montée à 7,
  ou avant.

### recompenses-comptes-2 — doublon de `concurrence-4` et `concurrence-1`, P2

**Reproduction.** `cloture-reprise.test.ts` : le témoin passe (la Chouette
est annoncée) ; les deux autres échouent comme annoncé.
- Clôture refusée par le miroir, puis reprise : la Chouette est bien en base, mais la fin dit `legendaires: []`.
- Deux `host:closeParty` émis d'affilée : la dernière `soiree:cloture` et la fin gardée disent `[]`.

**Le chemin.**
1. `crediterCloture` (`space.ts:1477-1487`) lit « avant » dans la mémoire du profil au début de *cette* clôture.
2. `accorderPaliers` ne rend que les paliers insérés par ce passage.
3. `closeParty` (`space.ts:1407`) pose `fermeture` sans jamais la lire.
4. Le client n'émet qu'une fois par confirmation de la boîte (`HostApp.tsx:767`). Le double envoi du test demande donc deux confirmations : deux écrans, ou un second clic pendant une clôture lente, que rien ne signale (`concurrence-1`, `client-13`).

**Doublon.**
- `concurrence-4` : même reprise, mêmes paliers muets ;
- `concurrence-1` : deux clôtures croisées, fin gardée sans palier.

La part propre de comptes-2 : les **légendaires tirés de hauts faits de
soirée** (la Chouette) et les **Divins** (`dejaDivins`, `space.ts:1482`,
`:1519`, lu). La piste de `concurrence-4` (« en déduire les légendaires par
`legendairesOuvertsPar` ») ne les couvre pas : `legendairesOuvertsPar` retire
la clé entière (`legendaires.ts:221-230`), donc un Grand Chelem déjà gagné
une autre soirée ferait disparaître la Chouette du calcul d'« avant ».

**Réalité.** Rien n'est perdu en base : seule la fête manque, au téléphone et
à la télé. Le chemin le plus probable est un second clic pendant une
clôture lente chez Turso. P2, comme les deux autres.

**Meilleure correction** (une pour les trois) :
- une seule fin à la fois par espace (`clotureEnVol`) ;
- « avant » lu dans la base : l'étagère **moins les lignes de cette soirée**,
  en décomptant (`n - 1`) et non en retirant la clé. Cela donne les
  légendaires et les Divins d'avant ;
- les paliers annoncés relus sous `(soirée, espace)`
  (`badge GLOB 'hf:*:[123]' AND soiree_id = ? AND space_id = ?`) ;
- `xpPaliers` et `niveauAvant` tirés de ces paliers.

### recompenses-comptes-3 — confirmé, P3 (et plus rare qu'annoncé pour (a))

**Reproduction.** `paliers-course.test.ts` échoue sur ses deux épreuves. Mais
les deux courses y sont forcées : une écriture est tenue par un crochet
jusqu'à ce que l'autre passe. J'ai donc rejoué sans tenir personne
(`paliers-latence.test.ts`) :

- **(a) `#paliers` qui perd un palier : 0 sur 40** à 20 ms ± 8, **0 sur 80** à
  ± 18. C'est attendu. Chaque décernement fait 4 allers-retours entre
  l'insertion de son palier et l'écriture de `#paliers`, et un seul entre la
  lecture et l'écriture de `#paliers`. Pour qu'une écriture périmée passe en
  dernier, il faut qu'une requête reste bloquée plusieurs allers-retours :
  une reprise, ou un hoquet de Turso. Il faut en plus un palier de soirée et
  un palier du jour, au même profil, à la même seconde. L'expert parle
  d'« une fenêtre d'un aller-retour » : c'est plus étroit que ça.
- **(b) palier rangé deux fois : 27 sur 40** quand les deux clôtures partent à
  moins de 60 ms. Il faut un profil qui joue dans deux salons le même soir,
  et deux animateurs qui cliquent « Clore » dans le même dixième de seconde.
  Le dommage est faible : `ecrireXpDesPaliers` dédoublonne (`new Set`), donc
  l'expérience n'est pas payée deux fois. Il reste une double annonce, et un
  palier qui survit au retrait de l'une des deux soirées.

**Meilleure correction, sans verrou** : tout faire dans le lot qui range le palier.
- Pour (b) : `INSERT … SELECT … WHERE NOT EXISTS (SELECT 1 FROM profile_badges WHERE profile_id = ? AND badge = ?)`, et « neufs » = les instructions dont `rowsAffected` vaut 1.
- Pour (a) : `#paliers` recalculé par une seule instruction dans le même lot (`SUM(CASE substr(badge, -1) WHEN '1' THEN 10 WHEN '2' THEN 25 WHEN '3' THEN 50 END)` sur les badges distincts), puis le total.

Tout est atomique, et aucune chaîne de promesses n'est à tenir entre
`JourStore` et `SpaceRegistry`.

### recompenses-comptes-4 — confirmé, P3

**Reproduction.** `palier-retire.test.ts` : `palierApresRetrait: 0` avec trois
soirées restantes, puis la cinquième annonce `['hf:habitue:1']`.

**Le chemin.** `DELETE /api/soirees/:id` appelle `archives.remove`, puis
`retirerSoireeEntiere` (`api.ts:440-442`, `profiles.ts:1284-1307`). Rien ne
redécerne ensuite. Le recalcul le ferait (`recalcul.ts:173-180`), mais il ne
tourne qu'avec un barème monté.

Ce n'est pas la tension de `robustesse-espaces` (le 24) : là-bas, le palier
était *immérité* et restait. Ici, il est *mérité* et part.

**Correction.** Celle de l'expert, et elle couvre aussi l'essentiel de
vitrine-2 (le bronze revient). Garder quand même la ligne de vitrine-2 : un
retrait peut faire passer la carrière sous le bronze sans toucher l'argent.

### recompenses-comptes-5 — doublon de `jour-regles-8`, P3

Rejoué : `{ rangeeSousLeJour: 0, citrouille: false }`. Même chemin
(`accorderSaison`, `profiles.ts:1503`), même piste. La note hors mission de
`recompenses-vitrine` est le même constat, une troisième fois.

### recompenses-comptes-6 — tension, P3

Rejoué : niveau 10 par le seul quiz du jour, `hf:legende` à 0. Deux règles
écrites s'y rencontrent :
- `CLAUDE.md` (invariant 10, et le piège « Le quiz du jour a son horloge ») :
  un palier de carrière se juge à la clôture, et `paliersAtteints` écarte ce
  qui est `duJour` ;
- RECOMPENSES : l'expérience du jour compte dans le niveau.

C'est à arbitrer, pas à corriger.

### recompenses-comptes-7 — doublon de `invariants-2`, P3

Même constat, rejoué là-bas (`saison-recalcul.test.ts`). Le rappel est juste :
monter à 7 sans comptes-1 déclenche le recalcul perpétuel.

### recompenses-comptes-8 — tension, P3

Lu : `removeAccount` (`server.ts:397-420`) n'appelle pas `ProfileStore`. Les
lignes `profile_xp` restent, avec un `space_id` orphelin. C'est un choix
(garder la progression des invités d'un animateur parti) à écrire, dans un
sens ou dans l'autre.

### recompenses-vitrine-1 — confirmé (friction), P3

Rejoué : +75 XP, niveau 2, 🦚 ouvert. La fin de partie ne contient ni niveau
d'avant, ni niveau d'après. Le client montre bien « Niveau N » dans la barre
(`JourApp.tsx:485-491`), mais jamais la montée.

Le report sur la soirée suivante est exact : `niveauAvant` se lit sur
`profil.xp - xpSoiree`, qui compte déjà `#jour` (`space.ts:1502`).

### recompenses-vitrine-2 — confirmé, P3

Rejoué : `titre=null vitrineChoisie=null étagère=["hf:bavard:2"] PUT titre → 400`.

Les paliers sont injectés en base, exactement comme `accorderPaliers` les
range. C'est un raccourci légitime : bronze et argent tombent d'ordinaire à
deux soirées différentes.

La correction proposée (`cleRangee(h.key, recompenses) !== null`) aligne
`hautsFaitsGagnes` (`hautsfaits.ts:460-465`) sur `cleRangee` : je la retiens
telle quelle.

### recompenses-vitrine-3 — tension, P3

Rejoué : un écusson Sport fait seul, montré sur la carte. `carriereDe`
(`profil.ts:494-526`) n'écarte une soirée qui ne compte pas **que** du compte
des soirées. Son propre commentaire dit pourtant « ni pour la fiche ». Une
seule correction couvre ce constat et le suivant (voir plus bas).

### recompenses-vitrine-4 — confirmé, P3

Rejoué : la page montre niveau 1 🦊, la salle et la carte niveau 1 🦚.
`peutPorter` n'est jugé qu'au `player:join` (`sockets.ts:407-408`).

Il faut un niveau qui redescend **pendant** une soirée où le profil joue :
un retrait d'une autre soirée, une question du jour annulée, un recalcul.
C'est rare.

Réserve sur la piste : `nomsAffiches` compare l'avatar de la fiche. Si la
décoration montre un autre avatar que la fiche, une marque d'homonymie peut
se lire à côté de deux avatars différents. Autre voie : réécrire l'avatar
de la fiche, par une mutation de `Party` qui invalide les marques, au moment
où le niveau descend.

### recompenses-vitrine-5 — confirmé, P3

Rejoué : la session d'une télé appairée lit `divins=[{key:'dv:helios', legende:…}]`
et `profil.login=alice` sur `/api/auth/me` (`routes.ts:98-110`). La lettre de
l'invariant 21 est cassée.

Le risque est minime : un Divin sur un compte d'animateur, lu dans les outils
réseau d'une télé. À côté, `securite-portes-1` (la même session peut
rattacher un profil étranger) est bien plus grave. Les deux se corrigent
ensemble : une projection légère pour le compte, et des routes d'identité
refusées aux sessions d'écran.

### recompenses-vitrine-6 — confirmé (le sondage), P3

Rejoué : `{"name":"Alice","avatar":"🦊","votes":2}` sous le Phénix, sur
l'écran commun. Pour les deux autres écrans, RECOMPENSES § 5.4 dit :
« L'emoji choisi reste dessous, pour les lignes de texte (export,
messages) ».
- La remise des prix (`AwardsBoard.tsx:71`, `{avatar} {name}` en texte, sur la console) est une ligne de texte : c'est voulu.
- « ont gagné hier » (`JourApp.tsx:622`, des emojis dans un `<p>`) est discutable.

Seul le sondage à la télé est un vrai écart.

### recompenses-vitrine-7 — confirmé, P3

Lu et gardé : `AccountApp.tsx:199` calcule l'Éclat sur `profil.avatar`, là
où quatre autres pages passent par `cibleEclat`. La correction tient en une
ligne, et la garde source (`eclat-porte.test.ts`) mérite d'entrer dans
`server/test/`.

### recompenses-vitrine-8 — confirmé, P3 (durcissement)

Rejoué : 🫠 par `player:join`, 🥲 par `PUT /api/joueur/moi`. Mais un client
forgé pose déjà quatre caractères quelconques (`cleanAvatar`, `avatars.ts:68-73`),
lettres comprises : un carré vide n'est pas pire. La correction est bon
marché (`emojisRecents` existe, `shared/emojis.ts:94`), la valeur faible.

### recompenses-vitrine-9 — confirmé, P3 (perf)

Lu : `ProfilApp` importe statiquement `Apparence`, qui importe `Legendaire`
et `Divin` (`Apparence.tsx:5-6`), et `Trophees.tsx:3`. La mesure Playwright
(14 218 o sur `/`) n'a pas été rejouée ; les imports suffisent à l'établir.

La règle de `CLAUDE.md` ne vise que le chemin du QR (`Avatar`, `PlayerApp`,
la carte). C'est donc de la perf, pas un invariant.

### recompenses-vitrine-10 — tension, P3

Lu (`PlayerApp.tsx:190-209`) : l'attente est bornée à 2,5 s, une fois, et le
commentaire l'assume. D'ordinaire, 14 Ko en cache.

### recompenses-vitrine-11 — confirmé, P3

Les quatre relues, et toutes tiennent :
- `ApercuSalle` et l'en-tête du téléphone n'ont pas de `NomLaure` ;
- `CarteJoueur.tsx:110` compare `p.prenom` à `carte.nom`, qui porte la marque (`space.ts:612`, `nomAffiche`) ;
- `Carriere.tsx:54` affiche « Il a éclaté » sans regarder `gagne` ;
- `Entree.tsx:94` reprend `choix.avatar` sans vérifier `AVATARS`.

### Hors mission de recompenses-vitrine — les paliers tombés seul : confirmé, gravité revue P2 → P3

Rejoué (`seul.test.ts`) : une soirée seule fait tomber Le Devin · Bronze et
rapporte 10 XP, alors que la fiche dit 0 soirée. C'est l'invariant 19
(« rien seul »), et `recompenses-comptes` ne l'a pas vu.

Le chemin : `carriereDe` additionne réponses, justes, estimations exactes,
hôtes, avatars et catégories de toutes les soirées. `accorderPaliers` court
pour chaque gain.

Peuvent tomber seul :
- Le Bavard, L'Encyclopédie, Le Devin ;
- Le Collectionneur (en changeant d'avatar à chaque soirée) ;
- Le Globe-trotteur (en jouant dans plusieurs espaces).

Ne tombent pas seul : Le Réflexe (il faut deux bonnes réponses,
`journal.ts:123`) et L'Habitué (déjà filtré). Aucun légendaire n'y est donc
accessible : au plus 425 XP de paliers, et des écussons.

**P3 et non P2**, pour trois raisons :
- il faut un compte d'animateur pour jouer seul chez soi ;
- l'effet est cosmétique (invariant 8) ;
- le même élevage reste ouvert avec un second téléphone, que l'invariant 19
  accepte (« dès deux joueurs »).

**Correction commune avec vitrine-3.** En tête de la boucle de `carriereDe`,
`if (!soireeQuiCompte(gain)) continue` : c'est ce que dit déjà son
commentaire. La dérivation d'un haut fait change, donc `VERSION_BAREME`
monte, dans le même lot que comptes-7, **après** comptes-1. Les paliers déjà
tombés restent : le recalcul n'en reprend aucun.

### Hors mission — la saison gagnée deux fois : doublon

C'est `recompenses-comptes-5`, lui-même `jour-regles-8`.

### Hors mission — la page du profil sans filet : confirmé, P3

Rejoué : 500. La simulation (une table renommée) n'arrive pas en production :
`JourStore.init` crée ses tables au démarrage, et une panne de Turso fait
tomber `toDetail` d'abord.

Le vrai chemin est ailleurs. `detailDe` attend `jour.carriereDe`, qui
commence par `clorePasses` (`jour.ts:1061`), et `clorePasses` lève si la
clôture d'une nuit échoue (`jour.ts:1191-1197`). Une nuit qui échoue, et
l'accueil de chaque profil répond 500 jusqu'à ce qu'elle passe. Un
`.catch` sur les deux lectures du jour, comme la carte (`space.ts:639`),
suffit.

## Ce qui ne tient pas dans « Ce qui marche »

`recompenses-vitrine` écrit : « L'écriture est étanche… `player:join` vérifie
`peutPorter` sur la chaîne brute avant `cleanAvatar`… pas plus qu'un ZWJ ».

C'est justement parce que le jugement porte sur la chaîne **brute** que ce
n'est pas étanche. Une paire de substitution coupée par U+200B vaut niveau 0 ;
`cleanAvatar` retire l'invisible et recolle 🪐, niveau 17 (`paire-coupee.ts`).
C'est `securite-temps-reel-2`.

`PUT /api/joueur/moi`, lui, nettoie d'abord (`profiles.ts:1016-1017`) : cette
porte-là est bien étanche.

## L'ordre des corrections

1. **comptes-1** (`CAST`, et le test qui vérifie `aRecalculer()`), avant toute
   montée du barème.
2. Une seule montée à 7 pour trois changements : les saisons (comptes-7 =
   `invariants-2`), les parties seules (`carriereDe`), et ce que la relecture
   doit refaire.
3. La clôture unique et « le neuf » lu dans la base (comptes-2 =
   `concurrence-4` + `concurrence-1`).
4. Le rangement atomique des paliers (comptes-3), puis le redécernement après
   un retrait (comptes-4) et `hautsFaitsGagnes` (vitrine-2).
5. Le reste, P3, dans n'importe quel ordre.
