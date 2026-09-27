# La progression : ce qui se crédite, se garde et se reprend — rapport de l'expert recompenses-comptes

## En bref

Le livre de comptes tient sur l'essentiel : le total d'un profil est toujours
la somme de ses lignes, recalculée dans la transaction même qui écrit la ligne ;
les lignes à part (`#paliers`, `#jour`) sont écartées partout où l'on compte des
soirées ; un barème monté relit l'historique sans rien reprendre de ce que seul
le quiz du jour décerne (rejoué). Deux défauts comptent vraiment. **Au prochain
`VERSION_BAREME`, tout l'historique se relira à chaque démarrage** — chaque réveil
de Render —, parce que la ligne `#jour` remise au barème s'écrit `{"v":6.0}` (mesuré :
5,3 s et 629 requêtes au lieu de 1,2 s et 60, pour 101 soirées). Et **une clôture
reprise ou croisée n'annonce plus ce que la première avait débloqué** : légendaire,
Divin, palier tombent en silence. Viennent ensuite des reprises trop larges ou trop
étroites (un palier retiré alors que les soirées restantes le méritent, une saison
retirée alors que les jours de quiz la méritent) et l'absence de verrou par profil
dans `ProfileStore`. Les trois corrections les plus rentables : lier la version en
entier dans `remettreAuBareme` (une ligne), n'autoriser qu'une clôture à la fois et
calculer « ce qui est neuf » sans les lignes de la soirée elle-même, et poser un
verrou par profil autour de chaque décernement.

## Méthode

Lecture du code de mon angle, en commençant par ce que #58 et #59 ont changé
(`git diff a6fc98b..HEAD`), puis reproduction de chaque soupçon sur le banc
(`server/test/banc.ts`, deux bases jetables), un fichier de test à la fois sous
`nice -n 10`. Environ une heure. Charge de la machine pendant les mesures : 0,4 à 1,1
(quatre cœurs partagés). Aucun navigateur : mon angle est le serveur.

**Lu** : `CLAUDE.md`, `RECOMPENSES.md`, `README.md` (profils, « La direction »),
`MISE-EN-LIGNE.md` (étape 5) ; `server/src/auth/profiles.ts` (entier),
`core/recalcul.ts`, `core/space.ts` (crédits, exclusion, clôture, essai),
`core/jour.ts` (partie, nuit, annulation, saisons, carrière du jour),
`core/divins.ts`, `core/saisons.ts`, `core/objectifs.ts`, `core/stats.ts` (prix),
`core/archive.ts` (noms, retrait), `core/recap.ts`, `api.ts` (retrait d'une soirée),
`server.ts` (démarrage, suppression d'un compte), `auth/routes.ts`, `sockets.ts`
(`player:join`, `host:closeParty`), `quizDuJour.ts` ; `shared/profil.ts`,
`hautsfaits.ts`, `legendaires.ts`, `saisons.ts`, `ecussons.ts`, `fonds.ts`,
`avatars.ts`, `proches.ts`, `divins.ts`, `archive.ts` ; les tests `saisons`,
`jour-paliers`, `jour-partie`, `espaces`, `cloture`, `miroir`, `chiffres` ; le
client pour ce qui calcule un niveau (`JourApp.tsx`, `FinDeSoiree.tsx`, `HostApp.tsx`).
Rapports d'avant relus : `retours/2026-09-24/experts/perf-serveur.md` (recalcul) et
`robustesse-espaces.md` (paliers et espaces) — rien de ce qui suit n'y figure.

**Écrit**, dans `export/evaluations/recompenses-comptes/` (chacun se lance par
`cd server && nice -n 10 node --import tsx --test --test-timeout=120000 ../export/evaluations/recompenses-comptes/<fichier>`) :

| Fichier | Ce qu'il montre | Aujourd'hui |
|---|---|---|
| `recalcul-perpetuel.test.ts` | après un barème monté, le démarrage suivant relit encore tout | échoue (constat 1) |
| `mesure-recalcul-perpetuel.ts` | le coût de ces démarrages (`npx tsx`, 101 soirées, 20 ms) | mesure |
| `cloture-reprise.test.ts` | témoin ; clôture refusée puis reprise ; deux « Clore » croisés | 1 passe, 2 échouent (constat 2) |
| `paliers-course.test.ts` | `#paliers` qui perd un palier ; un palier rangé deux fois | 2 échouent (constat 3) |
| `palier-retire.test.ts` | retirer la soirée d'un palier encore mérité | échoue (constat 4) |
| `saison-retiree.test.ts` | la Citrouille perdue avec la soirée malgré trois jours de quiz | échoue (constat 5) |
| `legende-du-jour.test.ts` | niveau 10 par le quiz du jour, sans La Légende | échoue (constat 6) |
| `recalcul-du-jour.test.ts` | un barème monté n'enlève rien au quiz du jour | passe (ce qui marche) |

**Pas couvert** : la vraie latence de Turso et ses réponses dans le désordre (les
courses du constat 3 sont forcées par un crochet sur le client libsql) ; l'effet
d'un démarrage lent sur Render lui-même ; les Divins du constat 2, confirmés à la
lecture (même variable que les légendaires), pas rejoués — il faut six joueurs et
vingt QCM.

## Constats

### 1. Au prochain `VERSION_BAREME`, tout l'historique se relit à chaque démarrage
- **Où** : `server/src/auth/profiles.ts:1758` (`remettreAuBareme`, branche
  `LIGNE_JOUR`) ; la recherche des lignes à relire, `profiles.ts:1703-1708`
  (`detail NOT LIKE '{"v":6,%'`) ; l'appel, `core/recalcul.ts:144-147`.
- **Constat** : la ligne du quiz du jour se remet au barème par
  `json_set(detail, '$.v', ?)`. Le nombre JavaScript part lié en flottant — en
  local comme chez Turso (hrana l'envoie en `type: "float"`,
  `node_modules/@libsql/hrana-client/lib-esm/shared/json_encode.js:53-55`) —, et
  SQLite écrit `{"v":6.0,"jours":1}`. Ce texte ne commence pas par `{"v":6,` :
  `aRecalculer` le retrouve au démarrage suivant, et `recalculerHistorique` relit
  **toutes** les soirées archivées, recrédite tous les profils et réécrit toutes
  les récompenses — à chaque démarrage, tant que chacun de ces profils n'a pas
  rejoué au quiz du jour (sa partie réécrit la ligne proprement). Qui ne revient
  pas au quiz du jour laisse le recalcul tourner pour toujours. C'est exactement
  ce que l'invariant 20 interdit (« sinon il relirait tout à chaque démarrage »).
- **Preuve** : `recalcul-perpetuel.test.ts` — après le premier démarrage, la ligne
  lit `{"v":6.0,"jours":1}`, et le second démarrage journalise encore « expérience
  recalculée… 1 soirées relues ». Mesure (`mesure-recalcul-perpetuel.ts`, 101
  soirées de 30 invités dont 12 profils, latence simulée de 20 ms, charge 1,1) :

  | Démarrage | durée | requêtes à la base permanente |
  |---|---|---|
  | ordinaire, rien à relire | 1,2 s | 60 |
  | premier après le barème monté (attendu) | 6,5 s | 829 |
  | deuxième (attendu : ordinaire) | **5,4 s** | **629** |
  | troisième (attendu : ordinaire) | **5,2 s** | **629** |

  Le test existant ne le voit pas : `jour-partie.test.ts:350` vérifie
  `JSON.parse(detail).v !== 1`, que `6.0` satisfait.
- **Qui ça touche, ce que ça coûte** : latent aujourd'hui (toutes les lignes `#jour`
  sont nées à la version 6), certain au prochain barème monté — le dépôt l'a monté
  quatre fois, de 2 à 6, les 23 et 24 septembre. Ensuite, chaque réveil de l'offre gratuite (« chaque réveil
  en est un », MISE-EN-LIGNE.md) retarde l'ouverture du port de plusieurs secondes,
  linéairement avec l'historique, retélécharge chaque archive de Turso et réécrit
  toutes les récompenses ; la salle qui attend le réveil en début de soirée attend
  d'autant.
- **Statut** : bug confirmé (rejoué).
- **Piste** : lier la version en entier, ou réécrire le JSON côté serveur comme la
  branche des soirées le fait déjà :
  ```ts
  sql: `UPDATE profile_xp SET detail = json_set(detail, '$.v', CAST(? AS INTEGER)) WHERE profile_id = ? AND soiree_id = ?`,
  ```
  Et que le test du démarrage vérifie le motif de `aRecalculer`, pas `JSON.parse` :
  après un démarrage, `aRecalculer()` ne rend plus rien. À corriger **avant** de
  monter `VERSION_BAREME` (voir le constat 7).
- **Priorité · effort** : P2 · S.

### 2. Une clôture reprise ou croisée n'annonce plus ce que la première avait débloqué
- **Où** : `server/src/core/space.ts:1477-1519` (`crediterCloture` : l'état
  « avant » est lu au début de CETTE clôture, `accorderPaliers` ne rend que les
  paliers insérés par elle) ; `space.ts:1407` (aucun garde contre une seconde
  clôture en vol) ; `space.ts:1623` et `:1674` (la fin gardée et la clôture de la
  salle sont celles de la dernière) ; `sockets.ts:864-897`.
- **Constat** : une clôture écrit tout — hauts faits, paliers, légendaires, Divins —
  avant d'effacer la soirée. Si le miroir refuse d'effacer (« Rien n'a été effacé »,
  la soirée continue, invariant 18), ou si une panne coupe les crédits en route, la
  clôture qu'on relance compare à un profil qui a déjà tout : la Chouette, le Divin,
  le palier ne sont plus « neufs », et ni le téléphone ni la salle ne les voient
  tomber ; une montée de niveau due aux paliers est comptée « avant ». Même cause
  sans panne : deux écrans d'animateur (la télécommande et la console) qui cliquent
  « Clore » au même moment lancent deux clôtures complètes ; la seconde, calculée
  après les crédits de la première, remplace la clôture à l'écran de la salle et la
  fin gardée des téléphones qui dormaient.
- **Preuve** : `cloture-reprise.test.ts`, Alice fait un Grand Chelem (huit QCM, salle
  de quatre). Témoin, close du premier coup : sa fin et la clôture disent
  `['lg:chouette']`. Miroir qui refuse les effacements, puis reprise : la Chouette
  est bien à Alice (`/api/joueur/moi`), mais sa fin dit `legendaires: []`. Deux
  `host:closeParty` émis d'affilée : deux `soiree:cloture` reçues, la dernière avec
  `legendaires: []`, et le téléphone qui se re-présente reçoit une fin sans la
  Chouette. Les Divins suivent le même chemin (`dejaDivins`, `space.ts:1482` et
  `:1519`) : confirmé à la lecture.
- **Qui ça touche, ce que ça coûte** : le moment que toute la mécanique prépare —
  « Quand l'un descend, toute la salle le voit à la clôture » — passe en silence pour
  la personne qui décroche un légendaire ou un Divin ce soir-là. Il faut une panne de
  Turso au mauvais moment, ou deux animateurs pressés.
- **Statut** : bug confirmé (rejoué).
- **Piste** : une clôture à la fois (la seconde attend ou reçoit la promesse de la
  première) ; et « ce qui est neuf » calculé contre le profil **sans les lignes de
  cette soirée** : légendaires et Divins d'avant dérivés de
  `profile_badges` hors `(space_id, soiree_id)` courant, paliers de la soirée relus
  sous son nom (`badge GLOB 'hf:*:[123]' AND soiree_id = ?`) plutôt que les seuls
  insérés, et `xpPaliers` à partir d'eux.
  ```ts
  if (this.clotureEnVol) return this.clotureEnVol
  this.clotureEnVol = this.clore(title).finally(() => (this.clotureEnVol = null))
  ```
- **Priorité · effort** : P2 · M.

### 3. `ProfileStore` n'a pas de verrou par profil : un palier peut perdre son expérience, ou se ranger deux fois
- **Où** : `server/src/auth/profiles.ts:1518-1538` (`ecrireXpDesPaliers` : lecture
  des paliers, puis écriture de `#paliers`, deux allers-retours hors transaction) ;
  `:1426-1428` et `:1456-1457` (`deja` lu en mémoire, avant l'insertion). Le quiz du
  jour écrit sous le verrou de `JourStore` (`core/jour.ts:1241-1255`), la clôture
  d'une soirée sous la file de son espace : aucun des deux ne connaît l'autre.
- **Constat** : (a) la clôture d'une soirée et le quiz du jour — fin de partie, nuit,
  recompte d'une annulation — qui décernent chacun un palier au même profil peuvent
  se croiser dans `ecrireXpDesPaliers` : le plus lent réécrit une somme périmée, et
  l'expérience d'un palier sort du total jusqu'au palier suivant. (b) Deux clôtures
  simultanées qui atteignent le même palier le rangent sous leurs deux soirées et le
  fêtent aux deux fins. Le total lui-même ne perd jamais une écriture : il est
  toujours la somme des lignes, dans la même transaction.
- **Preuve** : `paliers-course.test.ts`, courses forcées par un crochet sur le client
  libsql (l'écriture de la première est tenue le temps que l'autre passe). (a)
  L'Assidu · Bronze et L'Habitué · Bronze rangés, `#paliers` = 10 au lieu de 20, total
  13 au lieu de 23. (b) `hf:habitue:1` et `hf:globe-trotteur:1` rangés deux fois
  chacun, et annoncés par les deux clôtures. `espaces.test.ts` (« deux soirées closes
  au même instant… ») passe parce que la base locale répond assez vite.
- **Qui ça touche, ce que ça coûte** : un profil, dans une fenêtre d'un aller-retour
  vers Turso. Rare ; le cas le plus plausible est une soirée qui se clôt juste après
  minuit pendant que la nuit du quiz du jour se clôt en arrière-plan (`laureats()`).
- **Statut** : bug confirmé (rejoué, course forcée).
- **Piste** : un verrou par profil dans `ProfileStore` (la même chaîne de promesses
  que `JourStore.avecVerrou`) autour de « relire `deja` → ranger → `ecrireXpDesPaliers`
  → total », pris par `accorderPaliers`, `accorderPaliersDuJour`, `accorderSaison`,
  `retirerSoiree` et `retirerSoireeEntiere` (profil par profil). À défaut pour (a) :
  calculer `#paliers` en une seule instruction SQL dans le lot qui range le palier.
- **Priorité · effort** : P3 · S à M.

### 4. Retirer la soirée où un palier est tombé le reprend, même quand les soirées restantes le méritent
- **Où** : `server/src/auth/profiles.ts:1284-1307` (`retirerSoireeEntiere`),
  appelé par `api.ts:437-443` et par l'essai effacé ; le recalcul, lui, redécerne
  (`core/recalcul.ts:173-180`).
- **Constat** : le palier part avec la soirée qui l'a fait tomber (invariant 10), et
  rien ne le redécerne sur ce qui reste. La page du profil montre alors la jauge
  pleine sans le palier ; un légendaire qui en dépend (le Renard Lunaire, la Comète)
  ne se porte plus ; la clôture suivante le fête comme neuf.
- **Preuve** : `palier-retire.test.ts` — quatre soirées, L'Habitué · Bronze tombe à
  la troisième ; on retire la troisième : `{ palierApresRetrait: 0 }` avec trois
  soirées comptées, puis la cinquième soirée annonce `['hf:habitue:1']`.
- **Qui ça touche, ce que ça coûte** : l'habitué dont l'animateur retire une soirée
  de test ou un doublon ; un Renard porté disparaît jusqu'à la soirée suivante.
- **Statut** : bug confirmé (rejoué) ; la lettre de l'invariant 10 décrit la
  reprise, pas ce qui suit.
- **Piste** : après `retirerSoireeEntiere`, pour chaque profil touché,
  `accorderPaliers` sur sa soirée close la plus récente, soirées en cours ailleurs
  écartées — ce que fait déjà le recalcul —, sans rien annoncer.
- **Priorité · effort** : P3 · S.

### 5. Une saison gagnée d'abord en soirée se perd avec elle, malgré les jours de quiz du jour
- **Où** : `server/src/auth/profiles.ts:1501-1512` (`accorderSaison` rend faux si la
  saison est déjà là, sans rien ranger sous le jour) ; la raison de ce garde,
  `shared/legendaires.ts:221-230` (`legendairesOuvertsPar` retire la clé entière,
  pas une ligne).
- **Constat** : la Citrouille a deux voies. Ouverte d'abord par une soirée
  d'Halloween, elle n'est plus rangée sous le troisième jour de quiz du jour qui la
  mérite aussi. Retirer ensuite la soirée de l'historique l'emporte ; la période
  passée, rien ne la rend. RECOMPENSES dit qu'une soirée retirée emporte « ce
  qu'elle avait fait tomber » — pas ce que les jours de quiz avaient mérité.
- **Preuve** : `saison-retiree.test.ts` — soirée du 26 octobre (journal redaté comme
  dans `saisons.test.ts`), puis trois jours de quiz du jour dans la période ; retrait
  le 3 novembre : `{ rangeeSousLeJour: 0, citrouille: false }`, alors que les trois
  parties sont toujours en base.
- **Qui ça touche, ce que ça coûte** : peu de monde (deux voies, puis un retrait),
  mais c'est un légendaire d'une fois par an.
- **Statut** : bug confirmé (rejoué).
- **Piste** : ranger la saison sous le jour dès qu'aucune ligne `#jour:%` ne la porte,
  même si une soirée l'a déjà ouverte ; et, dans `legendairesOuvertsPar`, décompter
  les lignes tombées ce jour-là (`n - 1`) au lieu de retirer la clé — l'annonce ne
  revient pas pour autant.
- **Priorité · effort** : P3 · S.

### 6. La Légende ne tombe qu'à la clôture d'une soirée, alors que le niveau compte le quiz du jour
- **Où** : `shared/hautsfaits.ts:349-357` (`hf:legende` mesure le niveau),
  `:486-501` (`paliersAtteints` à la clôture, `paliersDuJourAtteints` sans lui) ;
  `server/src/auth/profiles.ts:868-886` (la page montre la jauge).
- **Constat** : l'expérience du quiz du jour compte dans le niveau (option B), mais La
  Légende n'est jugée qu'à la clôture d'une soirée. Qui ne vient qu'au quiz du jour
  passe le niveau 10 sans le palier ni ses 10 points ; sa page lit « niveau 10 » sous
  un palier à 10 non tombé, et sa première soirée le lui annoncera comme si elle
  l'avait fait.
- **Preuve** : `legende-du-jour.test.ts` — soixante-cinq jours au plein de
  l'expérience, puis une partie jouée : niveau 10, `hf:legende` à `fois: 0`.
- **Qui ça touche, ce que ça coûte** : le joueur du quiz du jour seul (un an de B
  mène au niveau 15, RECOMPENSES § 5.13).
- **Statut** : tension entre « le quiz du jour compte dans le niveau » et « un
  palier de carrière se juge à la clôture », confirmée (rejoué).
- **Piste** : juger aussi `hf:legende` dans `accorderPaliersDuJour` (rangé sous le
  jour), ou écrire dans RECOMPENSES que La Légende attend une soirée, et ne pas
  montrer une jauge pleine.
- **Priorité · effort** : P3 · S.

### 7. Les saisons dérivent des soirées sans que `VERSION_BAREME` ait monté
- **Où** : `server/src/auth/profiles.ts:181` (toujours 6) ; `core/saisons.ts:19-34` et
  `core/recalcul.ts:47` (la saison fait partie de ce que la relecture range).
- **Constat** : #59 ajoute une récompense tirée des journaux des soirées (la saison),
  « à la clôture comme au recalcul », sans monter le barème (invariant 20 ; les Divins
  l'avaient monté à 4 pour la même raison). Une soirée archivée pendant une période
  passée n'a pas sa saison aujourd'hui ; elle la recevra au prochain barème monté,
  pour une tout autre raison, sans que personne ne la lui annonce.
- **Preuve** : lecture — `aRecalculer` ne rend rien tant que toutes les lignes sont à
  6, donc `laureatsDeSaison` ne passe jamais sur l'historique existant.
- **Qui ça touche, ce que ça coûte** : seulement si l'historique de production a des
  soirées du 25 octobre au 1er novembre, du 20 au 26 décembre ou du 30 décembre au 2
  janvier. Je ne peux pas le vérifier.
- **Statut** : invariant non tenu, confirmé (lecture).
- **Piste** : monter `VERSION_BAREME` à 7 avec un mot dans son commentaire —
  **après** le constat 1, sinon cette montée déclenche le recalcul perpétuel.
- **Priorité · effort** : P3 · S.

### 8. Supprimer un compte d'animateur efface ses soirées, pas ce qu'elles avaient crédité
- **Où** : `server/src/server.ts:397-420` (`removeAccount`) et
  `auth/routes.ts:336-349` (« Tout ce qu'il a laissé part avec lui ») : aucun appel à
  `ProfileStore`.
- **Constat** : l'historique de l'espace disparaît (`archives.removeSpace`), mais
  l'expérience, les prix, les hauts faits, les paliers, les Divins, les saisons et
  les Éclats de ses soirées restent aux profils, et « Mes soirées » garde des lignes
  sans titre ni espace. Retirer ces mêmes soirées une à une les aurait repris. Si
  l'administrateur supprime un compte parce qu'il fabriquait des soirées (deux
  téléphones suffisent pour l'Éclat et L'Habitué), ce qu'elles ont rapporté reste.
- **Preuve** : lecture du chemin de suppression.
- **Statut** : tension — garder la progression des invités d'un animateur parti, ou
  appliquer « une soirée retirée reprend ce qu'elle avait crédité ».
- **Piste** : trancher ; pour reprendre, `retirerSoireeEntiere` sur chaque soirée de
  l'espace (et la soirée en cours) avant `archives.removeSpace`.
- **Priorité · effort** : P3 · S.

## Mesures et cartes

### Le tableau des récompenses

| Récompense | Où elle se décide | Sa clé | Qui l'écrit | Qui la relit | Ce qui la reprend |
|---|---|---|---|---|---|
| Expérience d'une soirée | verdict de chaque quiz (`apresQuiz`), puis la clôture ; recalcul (`creditDArchive`) | `profile_xp (profile_id, soiree_id)`, espace en colonne | `creditSoiree`, `crediterSoireeEntiere` : ligne remplacée, total = somme, même transaction | `historiqueOf`, `careerOf`, `niveauDuProfil` | exclusion (`retirerSoiree`), essai effacé et retrait (`retirerSoireeEntiere`) |
| Expérience des paliers | chaque palier rangé ou retiré | `profile_xp (profile_id, '#paliers')` | `ecrireXpDesPaliers` — lue puis écrite (constat 3) | le total | recalculée à chaque palier et à chaque retrait |
| Expérience du quiz du jour | fin de partie, nuit, recompte | `profile_xp (profile_id, '#jour')` | `ecrireXpDuJour`, sous le verrou de `JourStore` | le total | l'annulation d'une question du jour ; jamais une soirée |
| Prix du palmarès | clôture (`computeStats`) ; recalcul | `profile_badges (profile_id, clé, soiree_id)` | `remplacerRecompensesDeSoiree` : efface puis range, hors paliers | étagère, collection (`PRIX_INDIVIDUELS`), carte | retrait, essai, exclusion |
| Hauts faits de soirée | clôture ; recalcul | `profile_badges (…, 'hf:x', soirée)` | idem | étagère, légendaires (« fois »), titre, vitrine | idem |
| Paliers de carrière | clôture (`accorderPaliers`, sur les soirées closes) ; recalcul | `profile_badges (…, 'hf:x:n', soirée qui l'a fait tomber)` | `accorderPaliers` | légendaires à palier, Grand théâtre, titre | le retrait de SA soirée seulement (constat 4) |
| Paliers du quiz du jour | fin de partie ; nuit (Champion) ; recompte | `profile_badges (…, 'hf:x:n', '#jour:AAAA-MM-JJ')`, espace `''` | `accorderPaliersDuJour` | Sphinx, Nuit étoilée, Kintsugi, titre | rien : aucune soirée ne les porte |
| Saison | clôture et recalcul (`laureatsDeSaison`, datée à la première réponse) ; quiz du jour (`accorderSaison`) | `profile_badges (…, 'saison:x', soirée \| '#jour:J')` | `remplacerRecompensesDeSoiree`, `accorderSaison` | `legendairesDebloques` ; hors étagère et hors compte | le retrait de la soirée qui la porte (constat 5) |
| Divins | clôture ; recalcul (`divinsDeSoiree`) | `profile_badges (…, 'dv:x', soirée)` | `remplacerRecompensesDeSoiree` | `divinsOf` (liste) ; récit au seul porteur | retrait, essai |
| Arbre-Monde | dérivé | les douze d'origine (`DOUZE_LEGENDAIRES`) | — | `divinsDebloques` | la perte d'un des douze |
| Légendaires (Sphinx compris) | dérivés | l'étagère + `profile_legendaires (profile_id, légendaire)` | `garderLesLegendairesAcquis`, une fois par durcissement | `legendairesOf`, `legendairePorte` | ce qui cesse de les faire tenir |
| Éclat | chaque crédit, une fois par soirée qui compte | `profile_eclats (profile_id, avatar)`, `soiree_id` en colonne | `grantEclat` | `eclatsOf`, La Pluie d'Éclats | exclusion, essai, retrait |
| Niveau, finitions, emojis de collection, fonds | dérivés à chaque lecture | `profiles.xp` + `profile_niveaux (profile_id, pas)` | `garderLesNiveauxAtteints`, une fois | `niveauDuProfil`, `peutPorter`, `avatarPorte`, `fondPorte` | relus : rien ne se réécrit |
| Écussons | dérivés | — | — | `ecussonsDe(carrière, JourStore.categoriesDe)` | les réponses d'une soirée retirée |
| Titre, vitrine | choisis | `profiles.titre`, `profiles.vitrine` | `update` | `titrePorte`, `vitrineChoisie` | relus : un haut fait retiré les emporte |
| Laurier | la nuit (`clore`) | `jour_podiums`, rang 1 d'hier | `clore` | `laureats()` | le masquage |

### Les lectures de `profile_xp`

| Lecture | Écarte `#paliers` et `#jour` ? |
|---|---|
| `historiqueOf` → carrière, fiche, L'Habitué, écussons, objectifs, « Mes soirées » | oui (`profiles.ts:1638`) |
| série du quiz du jour, carrière du jour (`jour.ts:1072`, `:1167`) | oui |
| `aRecalculer` | les traite à part (`recalcul.ts:138-147`) — constat 1 |
| `profilsAvecExperience` | non, mais personne ne l'appelle |

## Ce qui marche — à ne pas casser

- **Le total ne perd jamais une écriture** : chaque ligne s'écrit avec
  `UPDATE profiles SET xp = (SELECT SUM…)` dans le même lot, en soirée comme au quiz
  du jour. Même la course du constat 3 laisse un total égal à la somme des lignes.
- **Un barème monté ne reprend rien au quiz du jour** (`recalcul-du-jour.test.ts`,
  vert) : paliers du jour, Sphinx par ses sans-faute, Citrouille gagnée par trois
  jours, ligne `#jour` et total, identiques avant et après la relecture. Les clés
  `#jour:J` (espace `''`) ne croisent jamais `remplacerRecompensesDeSoiree`, bornée à
  `(space_id, soiree_id)` et qui épargne les paliers.
- **Le Sphinx ne compte qu'une fois** (`legendairesDebloques` rend chaque clé une
  fois ; `legendairesOuvertsPar` ne le refête pas par sa seconde voie), et l'Arbre-Monde
  ne demande que les douze d'origine : ni le Sphinx ni les saisons ne lui reprennent
  rien. Le compte des badges écarte `dv:` et `saison:`.
- **Tout niveau passe par `niveauDuProfil`** côté serveur, emoji de collection et
  fonds compris ; le client affiche les niveaux que le serveur lui donne.
- **Les règles des Divins restent au serveur** ; le récit ne part qu'à son porteur.
- **Hypothèse écartée** : un profil pas encore chargé après un redémarrage aurait
  eu ses paliers du jour rangés une seconde fois (`recompensesOf` vide). Non :
  `ecrireXpDuJour` finit par `byId`, qui charge l'étagère juste avant
  `accorderPaliersDuJour` (`jour.ts:1250-1252`).

## Recommandations, dans l'ordre

1. Lier la version en entier dans `remettreAuBareme` (`CAST(? AS INTEGER)`), et
   faire vérifier au test que `aRecalculer()` est vide après un démarrage — P2 · S.
   À faire avant toute montée de `VERSION_BAREME`.
2. Une seule clôture à la fois, et « ce qui est neuf » calculé sans les lignes de la
   soirée elle-même (légendaires, Divins, paliers, niveau) — P2 · M.
3. Un verrou par profil dans `ProfileStore` autour de chaque décernement et de
   chaque retrait — P3 · S à M.
4. Redécerner les paliers encore mérités après un retrait ou un essai effacé, sans
   annonce — P3 · S.
5. Ranger la saison sous le jour même quand une soirée l'a ouverte, et décompter
   les lignes dans `legendairesOuvertsPar` — P3 · S.
6. Monter `VERSION_BAREME` pour les saisons, après le point 1 — P3 · S.
7. Trancher La Légende au quiz du jour et la suppression d'un compte (constats 6 et
   8) — P3 · S.

## Limites

- Les courses du constat 3 sont forcées ; je n'ai pas mesuré leur fréquence réelle
  sur Turso, ni rejoué les réponses qui arrivent dans le désordre (qui peuvent aussi
  laisser en mémoire un total ou une étagère périmés jusqu'à l'écriture suivante).
- Le coût du constat 1 est mesuré sur un fichier local avec 20 ms de latence
  simulée ; sur Render, le réveil ajoute déjà son temps propre.
- Les Divins du constat 2 ne sont confirmés qu'à la lecture.
- Je ne sais pas si la production a des soirées dans les périodes de saison
  (constat 7).

## Hors mission

- **Le « +XP » après un réveil** : `xpAnnoncee` vit en mémoire (`space.ts:431`,
  `:774-796`) ; après un redémarrage en pleine soirée, le podium suivant fête « +
  toute l'expérience de la soirée » au lieu de celle du quiz. Confirmé à la lecture
  (recompenses-vitrine).
- **Deux `host:closeParty` jouent deux clôtures complètes** (`sockets.ts:864`,
  `space.ts:1407`) : deux lignes « soirée finie » au journal, deux mesures
  d'inscriptions (concurrence) ; l'effet sur les annonces est au constat 2.
