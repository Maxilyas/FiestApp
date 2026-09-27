# Les données : deux bases, un miroir, une archive — rapport de l'expert persistance

## En bref

Les deux épreuves les plus attendues passent. Le code d'aujourd'hui (b57035c)
démarre sur une base fabriquée par celui d'avant #58 (a6fc98b), une soirée en
cours au milieu d'une question, disque gardé comme disque effacé. Rien ne s'y
perd et rien ne s'y dédouble : profils, historique, souvenir, bilan, cartes,
partie reprise, clôture. `npm run sauvegarde` emporte les 34 tables d'une base
bien remplie (quiz du jour compris) et se restaure à l'identique, valeur et
type compris. Le serveur repart dessus.

Ce qui cède, ce sont **les écritures en deux temps**, et chaque fois de la même
manière : la première écriture réussit, la seconde échoue (Turso muet, arrêt,
réponse perdue), et **le second essai ne répare rien**, parce que la première a
effacé ce qui l'aurait guidé. Huit épreuves échouent aujourd'hui. La plus
lourde ne demande aucune panne : **un déploiement pendant une soirée**. Render
fait alors tourner l'ancienne et la nouvelle instance ensemble sur le même
miroir, et le réveil suivant paie deux fois la question jouée entre les deux.

Les trois améliorations les plus rentables :

1. **Un bail sur le miroir** : une seule instance y écrit à la fois.
2. **Ne rien effacer tant que tout n'est pas repris** : pour le retrait d'une
   soirée, l'essai effacé et l'exclusion, la reprise aux profils doit passer
   en premier, et pouvoir se rejouer.
3. **Le drapeau en dernier** : un palier, une nuit du quiz du jour ou un
   effacement du miroir ne se marque « fait » qu'une fois tout écrit, et un
   échec d'effacement demande une resynchronisation.

## Méthode

Travail sur une machine partagée, sans navigateur (la mission est côté
serveur), en environ une heure et demie, coupure comprise. Les pannes de Turso
sont simulées :

- par un déclencheur `RAISE(ABORT)` dans le fichier `file:` qui tient lieu de
  Turso, armé le temps d'un geste ;
- ou, pour « la requête aboutit mais sa réponse se perd », en enveloppant
  `Sqlite3Client.prototype.batch` : le lot s'exécute, puis l'appel lève
  `BaseMuette`.

Les redémarrages sont de vrais `createQuizServer` éteints puis relancés sur les
mêmes fichiers. Aucun fichier suivi par git n'a été modifié.

**Lu** : `core/db.ts`, `core/backup.ts` (en entier), `core/distante.ts`,
`core/archive.ts` (magasin), `core/recalcul.ts`, `core/engine.ts`
(persistance, miroir, arrêt), `core/space.ts` (nom de soirée, crédits,
exclusion, clôture, essai, `viderSoiree`), `core/party.ts`, `teams.ts`,
`scores.ts` et `answers.ts` (écritures locales et leur recopie),
`auth/profiles.ts` (schéma, migrations, crédits, retraits, paliers, lignes à
part), `auth/store.ts` (schéma), `core/jour.ts` (en entier),
`core/quizStore.ts` (schéma), `server.ts` (démarrage, arrêt, suppression d'un
compte), `index.ts`, `api.ts` (routes de l'historique), `quizDuJour.ts`,
`scripts/sauvegarde.ts`, `render.yaml`, `MISE-EN-LIGNE.md`, les tests
`miroir`, `exploitation` et `jour-partie`, et le rapport
`retours/2026-09-24/experts/robustesse-espaces.md`. Ses constats 1 et 2
(soirées de même nom, palier compté sur un essai d'ailleurs) sont corrigés et
tiennent. Son constat 4 (deux secondes de réponses perdues sur un SIGKILL)
reste un compromis assumé.

**Écrit** (dans `export/evaluations/persistance/`) :

| Fichier | Ce qu'il fait | Aujourd'hui |
|---|---|---|
| `outils.ts` | les gestes d'un téléphone, d'un écran commun, d'une page, sans importer de code serveur (sert aux deux versions) | — |
| `migration/phase-avant.ts` | le code a6fc98b (copie de travail `avant/`) fabrique une base : une soirée close, une seconde arrêtée en pleine question, SIGTERM | exécuté |
| `migration/apres.test.ts` | le code d'aujourd'hui sur cette base, disque gardé puis effacé | **passe** (2/2) |
| `sauvegarde/sauvegarde.test.ts` | remplit la base (quiz du jour joué et clos, signalement, masque, photo, programme, partage, soirée au miroir), sauvegarde, restaure, compare, redémarre | **passe** |
| `retour-arriere/retour.ts` | le code a6fc98b relancé sur la base remplie par celui d'aujourd'hui | exécuté |
| `croissance/plans.mjs` | `EXPLAIN QUERY PLAN` des requêtes qui parcourent les tables qui grandissent | exécuté |
| `ecritures/retrait-soiree.test.ts` | retrait d'une soirée, puis « C'était un essai », pendant un hoquet | **échoue** (2/2) |
| `ecritures/exclusion.test.ts` | exclusion d'un invité à profil pendant un hoquet | **échoue** |
| `ecritures/paliers.test.ts` | palier de carrière tombé pendant un hoquet | **échoue** |
| `ecritures/jour-nuit.test.ts` | nuit du quiz du jour, Turso muet le temps d'un profil | **échoue** |
| `miroir/deux-instances.test.ts` | déploiement « sans coupure » : deux instances sur le même miroir | **échoue** |
| `miroir/effacement-perdu.test.ts` | clôture : l'effacement du miroir aboutit, sa réponse se perd | **échoue** |
| `miroir/redemarrage-disque-garde.test.ts` | redémarrage sur disque gardé après une panne du miroir | **échoue** |

Les sorties du dernier passage sont dans `sorties/`. Chaque épreuve se lance
depuis `server/` :

```bash
nice -n 10 node --import tsx --test --test-timeout=120000 ../export/evaluations/persistance/<dossier>/<nom>.test.ts
```

`migration/apres.test.ts` demande d'abord `phase-avant.ts`, et la sauvegarde
part de la base que laisse la migration.

**Non couvert** : un vrai Turso (latence, limites de taille des réponses), un
vrai Render. Sa documentation sur les déploiements est bloquée par le proxy :
voir le constat 1. La restauration par `turso db shell` n'est pas couverte
(celle par `sqlite3` l'est, par `better-sqlite3`).

## Constats

### 1. Un déploiement pendant une soirée : deux instances écrivent au même miroir, et le réveil suivant paie deux fois

- **Où** : `server/src/server.ts:265-267` (la nouvelle instance recharge le
  miroir à son démarrage), `server/src/core/backup.ts:1070` (`restoreInto`),
  `backup.ts:450-523` (aucune écriture de la file n'est liée à une instance),
  `server/src/index.ts:138-160` (« L'hébergeur prévient avant de
  redémarrer »), `render.yaml` (`healthCheckPath: /healthz`, aucun disque
  persistant), `MISE-EN-LIGNE.md:407`.
- **Constat** : un service web sans disque persistant et avec un contrôle de
  santé se redéploie chez Render **sans coupure**. La nouvelle instance
  démarre pendant que l'ancienne sert encore, et l'ancienne ne reçoit son
  SIGTERM qu'une fois la nouvelle jugée en bonne santé. Les websockets restent
  sur l'ancienne jusque-là.
  - La nouvelle recharge le miroir **à son démarrage**, puis l'ancienne
    continue la soirée : réponses, révélations, gains, arrivées. Tout cela
    part au miroir, et l'ancienne s'y vide encore en s'éteignant.
  - La nouvelle reprend ensuite la partie **telle qu'elle l'avait lue**,
    révèle à son tour et écrit ses propres gains et réponses (d'autres `uid`).
    Ses chronomètres, réarmés dès le démarrage, peuvent aussi révéler « sans
    réponse » pendant le chevauchement.
  - Rien ne sépare les deux écritures. Tout de suite, ce qui s'est joué chez
    l'ancienne est perdu pour la salle. Et au réveil suivant sur disque
    effacé (la veille de l'offre gratuite, un redémarrage), le miroir rend
    les **deux** jeux de gains et de réponses, plus les invités que la
    nouvelle n'a jamais vus.
  - La clôture suivante range ensuite dans l'archive, et crédite en
    expérience, ce journal doublé.
- **Preuve** : `miroir/deux-instances.test.ts`. Trois serveurs sur le même
  fichier `file:` : l'ancien joue la question 1, le nouveau démarre, l'ancien
  joue et révèle la question 2 et reçoit Dora, puis s'éteint. Les téléphones
  passent au nouveau, qui révèle la question 2, puis un réveil sur disque
  effacé :

  ```
  totaux chez la nouvelle instance : 398, 398, 398
  totaux au réveil :                 597, 597, 597
  réponses en double au journal : 3 invités × question 2 (n: 2)
  invités au réveil : [ 'Alice', 'Bob', 'Chloé', 'Dora' ]
  ```

  La promesse de `MISE-EN-LIGNE.md:407` (« une révélation ne se paie jamais
  deux fois au réveil ») ne tient pas pour un déploiement.
- **Qui ça touche, ce que ça coûte** : toute la salle d'une soirée en cours
  pendant un déploiement. En production, le déploiement est manuel, mais le
  serveur est partagé entre animateurs : celui qui déploie ne voit pas la
  soirée d'un ami. La préproduction se redéploie à chaque fusion. Le dommage
  est silencieux et se propage à l'archive et à l'expérience.
- **Statut** : bug confirmé (rejoué) sur le code. Le chevauchement des
  instances vient de la documentation de Render (« zero-downtime deploys »,
  désactivés seulement avec un disque persistant). Je n'ai pas pu la
  consulter d'ici, le proxy bloque render.com. À vérifier sur la
  préproduction : ouvrir une soirée, déployer, et lire dans les journaux si
  « … rechargés après redémarrage » de la nouvelle instance précède
  « extinction demandée » de l'ancienne.
- **Piste** : **un bail sur le miroir**, pris par la nouvelle instance
  **avant** `restoreInto`, et vérifié dans chaque lot de la file. Si le bail
  n'est plus le sien, la transaction échoue entière. L'ancienne cesse alors
  d'écrire et renvoie ses écrans à la nouvelle.

  ```sql
  CREATE TABLE IF NOT EXISTS party_bail (cle TEXT PRIMARY KEY, instance TEXT NOT NULL, pris_le INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS party_garde (ok INTEGER NOT NULL CHECK (ok = 1));
  -- en tête de chaque lot de l'instance `moi` :
  INSERT INTO party_garde (ok) SELECT 0 WHERE (SELECT instance FROM party_bail WHERE cle = 'miroir') IS NOT :moi;
  ```

  Pour ne rien perdre du tout, la version complète est une passation. La
  nouvelle instance ouvre son port (le contrôle de santé passe), attend que
  l'ancienne rende le bail après s'être vidée à son SIGTERM (ou qu'il
  expire), puis seulement recharge et accepte les téléphones. D'ici là, dans
  `MISE-EN-LIGNE.md` : « ne déploie qu'avec `quizEnCours` et `espacesActifs`
  à 0 dans `/healthz` ».
- **Priorité · effort** : P2 · M (bail et garde), L (passation sans perte).

### 2. Retirer une soirée de l'historique : l'archive part d'abord, et un hoquet laisse tout aux profils, pour toujours

- **Où** : `server/src/api.ts:440-442` (`archives.remove`, puis
  `retirerSoireeEntiere`), `server/src/auth/profiles.ts:1284-1307` (les
  profils touchés se lisent dans les lignes que ce même lot efface).
- **Constat** : la route efface l'archive, puis reprend aux profils ce que la
  soirée leur avait crédité. Si la seconde étape échoue (Turso muet dix
  secondes, redéploiement), la soirée a déjà disparu de la liste. L'écran dit
  « Erreur serveur — réessaie », mais il n'y a plus rien à réessayer : un
  second essai répond « Soirée introuvable ». Expérience, prix, hauts faits et
  paliers restent aux profils, et aucun geste ne les reprend plus. C'est
  exactement ce que le bouton promet d'empêcher (« ce qu'elle avait rapporté
  aux profils avec — expérience, prix, hauts faits. C'est définitif. »).
- **Preuve** : `ecritures/retrait-soiree.test.ts`, premier test (panne sur
  les effacements de `profile_xp`, `profile_badges` et `profile_eclats`) :

  ```
  premier essai : 500 {"error":"Erreur serveur — réessaie dans un instant"}
  second essai : 404 {"error":"Soirée introuvable"}
  archive encore là : false — reste aux profils : { xp: 2, badges: 7, totaux: [ 97, 30 ] }
  ```

- **Qui ça touche, ce que ça coûte** : l'animateur qui retire un essai oublié
  et ses joueurs à profil. Niveaux, légendaires et paliers deviennent faux,
  définitivement : même un recalcul au barème du jour garde les lignes d'une
  soirée absente de l'historique (`recalcul.ts:150-160`).
- **Statut** : bug confirmé (rejoué).
- **Piste** : reprendre d'abord, effacer l'archive en dernier, et désigner
  les profils par l'archive elle-même (qui survit tant que la reprise n'est
  pas allée au bout) :

  ```ts
  const trouvee = await deps.archives.get(spaceId, req.params.id)
  if (!trouvee) return res.status(404).json({ error: 'Soirée introuvable' })
  const profils = trouvee.archive.players.flatMap(p => (p.profileId ? [p.profileId] : []))
  await deps.profiles.retirerSoireeEntiere(req.params.id, spaceId, profils) // `touches` = profils ∪ lignes lues
  await deps.archives.remove(spaceId, req.params.id)
  ```

- **Priorité · effort** : P2 · S.

### 3. Un invité à profil exclu pendant un hoquet garde l'expérience de la soirée (invariant 10)

- **Où** : `server/src/core/space.ts:945-947` (`rendreCredit(...).catch(e =>
  console.error('[xp]', e))`), `space.ts:1012-1021`,
  `server/src/auth/profiles.ts:1260-1275`.
- **Constat** : l'exclusion est locale et immédiate. Ce que la soirée avait
  crédité au profil (sa ligne, son Éclat) part ensuite au loin, sans
  attendre. Un échec n'y laisse qu'une ligne au journal. Rien ne le rejoue :
  les crédits suivants ne réécrivent que les profils encore là, et la clôture
  aussi. L'exclu garde l'expérience et l'Éclat d'une soirée dont il a été
  retiré.
- **Preuve** : `ecritures/exclusion.test.ts` (panne sur les effacements de
  `profile_xp` au moment de l'exclusion, puis un second quiz et la clôture) :

  ```
  crédité à Malik au podium : [ { soiree_id: '2026-09-27-…', xp: 60 } ]
  [xp] LibsqlBatchError: SQLITE_CONSTRAINT: … base permanente muette
  après la clôture, Malik garde : [ { soiree_id: '2026-09-27-…', xp: 60 } ] — total 60
  ```

- **Qui ça touche, ce que ça coûte** : un invité exclu (souvent un
  plaisantin, ou un double) garde de l'expérience pour toujours. Un SIGTERM
  juste après l'exclusion produit la même chose (`server.close()` n'attend
  pas la file des crédits).
- **Statut** : bug confirmé (rejoué).
- **Piste** : un crédit de soirée fait foi pour **toute** la soirée. À la
  clôture au moins (et, sans surcoût notable, à chaque crédit), effacer les
  lignes et les Éclats de cette soirée pour les profils absents des gains,
  puis recalculer leur total :

  ```sql
  DELETE FROM profile_xp WHERE soiree_id = ? AND space_id = ? AND profile_id NOT IN (…profils des gains…);
  DELETE FROM profile_eclats WHERE soiree_id = ? AND profile_id NOT IN (…);
  ```

- **Priorité · effort** : P2 · S.

### 4. Un palier de carrière tombé pendant un hoquet ne rapporte jamais son expérience, ni ne s'annonce

- **Où** : `server/src/auth/profiles.ts:1414-1447` (`accorderPaliers` : le
  badge, puis dans d'autres requêtes `ecrireXpDesPaliers` et
  `recalculerTotal`), même motif dans `accorderPaliersDuJour` (`:1455-1476`).
  Autre cas du même motif, relevé à la lecture : l'Éclat, tiré après
  `creditSoiree` (`space.ts:734-749`), est perdu si `grantEclat` échoue, car
  le crédit suivant voit la ligne et ne retire plus.
- **Constat** : si la base se tait entre le badge et la ligne `#paliers`, la
  clôture échoue et l'animateur réessaie. Au second essai, le palier est déjà
  sur l'étagère, `neufs` est vide, et la ligne `#paliers` n'est jamais
  réécrite. Les 10, 25 ou 50 points ne sont jamais crédités, et la fin de
  soirée n'annonce plus le palier. Ils ne reviennent qu'au palier suivant, qui
  relit tous les badges.
- **Preuve** : `ecritures/paliers.test.ts` (L'Habitué à la troisième soirée,
  panne sur l'écriture de la ligne `#paliers`) :

  ```
  première clôture : { kind: 'error', message: 'Rien n’a été effacé : Erreur serveur — réessaie dans un instant' }
  seconde clôture : { kind: 'info', message: '« La troisième » est close — …' }
  palier sur l’étagère : [ { badge: 'hf:habitue:1' } ] — ligne #paliers : [] — annoncé : [] — total 100
  ```

- **Qui ça touche, ce que ça coûte** : un profil par palier tombé dans la
  fenêtre (deux allers-retours). Perte modeste, mais définitive jusqu'au
  palier suivant, et le moment fort de la fin de soirée disparaît.
- **Statut** : bug confirmé (rejoué). L'Éclat : confirmé (lecture).
- **Piste** : le badge, la ligne `#paliers` (calculée sur les paliers qu'il
  a déjà et les neufs) et le total dans **un seul lot**. À défaut, quand
  `neufs` est vide, vérifier que la ligne `#paliers` porte bien les paliers
  de l'étagère et la réécrire sinon. Pour l'Éclat, l'écrire dans le lot de
  `creditSoiree`.
- **Priorité · effort** : P3 · S.

### 5. La nuit du quiz du jour se déclare close avant d'avoir payé son podium

- **Où** : `server/src/core/jour.ts:1210-1232` (`clore` : `jour_clotures` et
  `jour_podiums` d'un lot, puis `ecrireXp` profil par profil), `:1188-1203`
  (`clorePasses` ne revoit jamais un jour déjà dans `jour_clotures`). Même
  motif à la dernière réponse d'une partie (`enregistrer`, `:685-724`, puis
  `ecrireXp` à part). Rejouée, la réponse rend sa révélation sans rien
  réécrire (`:653`) : ni l'expérience de la dernière question, ni
  L'Assidu, ni Le Sans-Faute (lecture).
- **Constat** : si Turso se tait pendant qu'on paie un profil du podium, la
  boucle s'arrête : lui et ceux qui le suivent ne sont pas payés. Le jour est
  pourtant déjà marqué clos, et plus rien ne recommence. Le visiteur qui a
  déclenché la nuit (pas forcément un joueur du podium) reçoit un 500.
- **Preuve** : `ecritures/jour-nuit.test.ts` (quatre profils, panne sur le
  total de Bruno, deuxième) :

  ```
  première demande du lendemain : 500
  alice  rang 1  podium 25  partie 75  ligne 100
  bruno  rang 2  podium 15  partie 60  ligne 60     ← 15 jamais payés
  chloe  rang 3  podium 10  partie 45  ligne 45     ← 10 jamais payés
  ```

- **Qui ça touche, ce que ça coûte** : les suivants du podium d'une nuit.
  Leur podium ne rejoint leur expérience qu'à leur prochaine partie (la somme
  est recalculée), jamais s'ils ne rejouent pas.
- **Statut** : bug confirmé (rejoué). La dernière réponse : confirmé
  (lecture).
- **Piste** : le drapeau en dernier. Podiums (`INSERT OR IGNORE`), puis
  `ecrireXp` de chacun (idempotent), puis `jour_clotures` : une nuit
  interrompue se rejoue en entier. Pour `enregistrer`, mettre la ligne
  `#jour` et le total dans le lot de la réponse (sommes en SQL).
- **Priorité · effort** : P3 · S.

### 6. L'effacement du miroir aboutit, sa réponse se perd : la soirée continue sur un miroir vide

- **Où** : `server/src/core/backup.ts:1014-1049` (`remettreAZero` :
  l'échec de l'effacement remonte sans `echec()` ni resynchronisation),
  `:726-740` (une resynchronisation ne suit qu'un échec de la file).
- **Constat** : la clôture efface le miroir. Si Turso valide mais que la
  réponse dépasse dix secondes, le code croit que rien n'a bougé : l'écran
  lit « Rien n'a été effacé », la base locale garde la soirée, la file
  reprend. Le miroir, lui, est vide, et rien ne le remplit de nouveau. Si
  l'animateur, rassuré, continue plutôt que de reclore, le prochain réveil
  sur disque effacé rend une soirée amputée.
- **Preuve** : `miroir/effacement-perdu.test.ts` (le lot d'effacement
  s'exécute, puis `BaseMuette`) :

  ```
  l’écran commun lit : 'Rien n’a été effacé : la sauvegarde en ligne ne répond pas — réessaie dans un instant'
  en local : { invites: 2, gains: 2, reponses: 2 } — au miroir : { invites: 0, gains: 0, reponses: 0 }
  au réveil : { invites: 1, gains: 0, reponses: 0 }
  ```

- **Qui ça touche, ce que ça coûte** : toute la salle, mais seulement si
  deux circonstances se suivent (une réponse de Turso au-delà de dix
  secondes, puis un redémarrage avant une clôture réussie).
- **Statut** : bug confirmé (rejoué, réponse perdue simulée).
- **Piste** : après un effacement en échec, l'état du miroir est inconnu.
  Dans le `catch` de `remettreAZero`, appeler `this.demanderResync(voie)`,
  qui ne réécrit que ce qui manque.
- **Priorité · effort** : P3 · S.

### 7. « C'était un essai » interrompu : l'écran dit « Rien n'a été effacé », et le second clic ne recalcule plus rien

- **Où** : `server/src/core/space.ts:1684-1704`, `profiles.ts:1284-1307`.
- **Constat** : si l'effacement des lignes passe et que le recalcul du total
  échoue, l'écran commun lit « Rien n'a été effacé ». Ce n'est pas vrai :
  les lignes d'expérience de l'essai sont parties. Le second clic retrouve
  zéro profil touché (il les cherche dans les lignes déjà effacées) et ne
  recalcule aucun total : le profil garde un niveau qu'aucune ligne ne
  justifie. Le crédit suivant le corrige d'un coup, en pleine soirée
  (l'expérience redescend alors sous les yeux de la salle, invariant 19).
- **Preuve** : `ecritures/retrait-soiree.test.ts`, second test :

  ```
  premier clic : { kind: 'error', message: 'Rien n’a été effacé : Erreur serveur — réessaie dans un instant' }
  lignes d’expérience d’Alice après le premier clic : []
  second clic : { kind: 'info', message: 'Essai effacé — rien n’a été gardé' }
  total d’Alice : 60 avant, 60 après ; somme de ses lignes : 0
  ```

- **Statut** : bug confirmé (rejoué).
- **Piste** : la même que le constat 2 : `retirerSoireeEntiere` reçoit les
  profils de la soirée (`this.party.all()`, encore là) au lieu de les
  déduire des lignes qu'il efface. Et le message devient « L'effacement n'est
  pas allé au bout — réessaie ».
- **Priorité · effort** : P3 · S (avec le 2).

### 8. Après un redémarrage sur disque gardé, rien ne recomplète le miroir

- **Où** : `server/src/core/backup.ts:1076` (base locale peuplée : elle fait
  autorité, rien n'est rechargé), `server.ts:265-277` (aucune
  resynchronisation au démarrage), `backup.ts:739`.
- **Constat** : le PC de secours (MISE-EN-LIGNE.md) ou un auto-hébergement
  redémarre alors que Turso refusait les écritures, et la file s'abandonne.
  Si Turso répond de nouveau au redémarrage, aucun échec, donc aucune
  resynchronisation : le miroir reste troué jusqu'à la clôture. La soirée qui
  repartirait de lui (disque perdu, retour sur Render) perd ce qui s'est joué
  avant l'arrêt, et retrouve une question révélée sans ses gains.
- **Preuve** : `miroir/redemarrage-disque-garde.test.ts` :

  ```
  en local avant l’arrêt : { gains: 2, reponses: 2 }
  [sauvegarde] extinction : 5 écriture(s) abandonnée(s) dans 1 espace(s)
  au miroir, soirée repartie sur le disque gardé : { gains: 0, reponses: 0 }
  au réveil suivant, disque effacé : { gains: 0, reponses: 0 }
  ```

- **Statut** : bug confirmé (rejoué). Sur Render, le disque s'efface
  toujours : le cas ne s'y présente pas.
- **Piste** : au démarrage, une resynchronisation de chaque espace qui a des
  lignes locales (elle compare avant d'écrire, et n'écrit rien quand tout est
  déjà là).
- **Priorité · effort** : P3 · S.

### 9. Le retour à la version d'avant range la ligne `#jour` parmi les soirées

- **Où** : le code a6fc98b (`historiqueOf` n'écarte que `#paliers`, son
  `ecrireXpDesPaliers` ignore les paliers du jour qu'il ne connaît pas).
- **Constat** : après un déploiement raté, relancer a6fc98b sur la base que
  le code d'aujourd'hui a remplie fonctionne (aucune erreur), mais :
  - la ligne d'expérience du quiz du jour apparaît comme une soirée
    `#jour` dans l'historique de chaque profil qui y a joué ;
  - à la lecture : si l'ancien code réécrit la ligne `#paliers` (un palier
    tombé), il le fait sans l'expérience des paliers du jour
    (`hf:champion-du-jour:1`, `hf:sans-faute:1`), qu'aucun retour en avant
    ne rend avant le palier suivant.
- **Preuve** : `retour-arriere/retour.ts` :
  `alice (200) : xp 781, … soirées : [ '#jour (100 xp)', '2026-09-26-xje8l-… (309 xp)', … ]`.
- **Statut** : tension avec le parti pris « ce qui a été joué se garde » ;
  confirmé (rejoué) pour l'historique, lecture pour `#paliers`.
- **Piste** : dans `MISE-EN-LIGNE.md`, « sauvegarde avant de promouvoir ; un
  retour arrière après #58 montre `#jour` comme une soirée ». Pour la suite,
  une version de schéma dans `meta`, qu'une version plus ancienne refuse au
  démarrage.
- **Priorité · effort** : P3 · S.

## Mesures et cartes

### L'épreuve de migration (a6fc98b → b57035c)

| Contrôle | Disque gardé | Disque effacé |
|---|---|---|
| Démarrage | 63 ms, aucune erreur | 38 ms ; « 6 invités, 25 gains, 54 réponses et la partie en cours rechargés » (miroir écrit par l'ancien code) |
| Colonnes et tables neuves | `profiles.titre`, `vitrine`, `fond` (NULL), dix tables `jour_*`, réserve amorcée (38 questions) | idem |
| Chaque profil (`/api/joueur/moi`) | xp, niveau, badges, légendaires, Éclats, historique : identiques | identiques |
| Soirée close par l'ancien code | fiche, souvenir, bilan, cartes : 200, mêmes vainqueurs | idem |
| Partie reprise | question 3, révélée à l'heure de son échéance ; chaque téléphone retrouve sa fiche par son jeton | idem |
| Clôture après la reprise | 2 archives (pas 3), nom de soirée gardé par-delà minuit, une ligne d'expérience par profil et par soirée, total = somme des lignes, miroir vidé | idem |

Seul changement visible : Bruno avait choisi 🐢 librement avant #59. Au
niveau 2, il porte désormais 🎉 (la tortue est de collection, niveau 4).
C'est voulu (`avatarPorte`), mais rien ne le lui dit.

### La sauvegarde

Base remplie : 34 tables, 171 lignes, toutes les tables du quiz du jour
non vides. Sauvegarde, puis restauration par `exec` dans un fichier neuf :
**mêmes objets de schéma au texte près, mêmes lignes, `typeof` compris**,
table par table. Le serveur redémarre sur la base restaurée, disque effacé :
profils identiques, animateur toujours connecté, soirée en cours revenue du
miroir restauré. Aucune table AUTOINCREMENT dans la base permanente : rien ne
dépend de `sqlite_sequence`, que le script écarte.

### Carte des données

| Table | Base | Qui l'écrit | En lot | Idempotente au rejeu | Sauvegardée | Index |
|---|---|---|---|---|---|---|
| `players`, `teams`, `team_bonus` | locale | `Party`, `Teams` | non (une ligne) | upsert au miroir | par le miroir | PK, `space_id` |
| `answer_log`, `score_entries` | locale | `AnswerLog`, `ScoreLedger` | lot de la révélation | `uid` unique | par le miroir | `uid`, `space_id` |
| `sessions`, `soiree` | locale | `GameEngine.persist`, `tirerSoiree` | avec les gains / direct | upsert | par le miroir | PK |
| `party_*` (7) | permanente | `PartyBackup` (file par espace) | oui (lots ≤ 200) | oui (`uid`, upserts) — **mais pas entre deux instances** (constat 1) | oui | `space_id` |
| `accounts`, `auth_sessions`, `activations`, `meta` | permanente | `AuthStore` | requêtes seules | login/slug uniques | oui | PK, `account_id` |
| `profiles` | permanente | `ProfileStore` | total recalculé en SQL | oui | oui | PK, `login` |
| `profile_xp` | permanente | crédits, recalcul, `#paliers`, `#jour` | ligne + total d'un lot | remplacée | oui | PK (profil, soirée) — `soiree_id` seul : parcours |
| `profile_badges` | permanente | prix, hauts faits, paliers, saisons | par soirée : oui ; **paliers : non** (constat 4) | `ON CONFLICT DO NOTHING` | oui | PK, `badge` |
| `profile_eclats` | permanente | `grantEclat` | **non** (après le crédit) | `DO NOTHING` | oui | PK — `soiree_id` : parcours |
| `profile_niveaux`, `profile_legendaires` | permanente | démarrage qui durcit | avec leur drapeau | `DO NOTHING` | oui | PK |
| `quizzes`, `quiz_images` | permanente | `QuizStore` | — | enregistrement par jeton | oui | `space_id` |
| `programmes`, `partages`, `catalogue` | permanente | leurs magasins | — | — | oui | `space_id`, `statut` |
| `soirees` | permanente | `ArchiveStore.save` | upsert seul | oui | oui | PK (espace, id) |
| `jour_reserve`, `jour_apports`, `jour_tirages` | permanente | `JourStore` | tirage + « posée » d'un lot | empreinte unique, `OR IGNORE` | oui | `posee_le` |
| `jour_parties`, `jour_reponses` | permanente | `enregistrer` | réponse + partie d'un lot ; **`#jour` à part** (constat 5) | garde `WHERE question = ?` | oui | PK, `jour`, `(jour, question)` |
| `jour_clotures`, `jour_podiums` | permanente | `clore` | d'un lot ; **XP à part** (constat 5) | `OR IGNORE` | oui | PK, `profile_id` |
| `jour_signalements`, `jour_masques`, `jour_meta` | permanente | `JourStore` | — | upsert / `OR IGNORE` | oui | PK |

### Pour chaque perte, le scénario qui la provoque

| Ce qui se perd ou se corrompt | Scénario | Constat |
|---|---|---|
| Points doublés, réponses en double, invités fantômes au réveil | déploiement pendant une soirée (deux instances) | 1 |
| Ce que la salle a joué pendant le chevauchement | idem | 1 |
| Expérience, prix, paliers d'une soirée retirée | hoquet de Turso pendant le retrait | 2 |
| Expérience et Éclat d'un exclu gardés | hoquet ou SIGTERM juste après l'exclusion | 3 |
| Expérience d'un palier, son annonce | hoquet entre le badge et `#paliers` | 4 |
| Un Éclat tiré | hoquet entre le crédit et `grantEclat` | 4 (lecture) |
| Podium du jour de ceux qui suivent | hoquet pendant la nuit | 5 |
| Expérience de la dernière question, L'Assidu, Le Sans-Faute | hoquet à la dernière réponse du jour | 5 (lecture) |
| Toute la soirée au miroir | réponse perdue de l'effacement, puis réveil | 6 |
| Totaux justes après un essai | hoquet pendant « C'était un essai » | 7 |
| Ce que la file attendait | redémarrage sur disque gardé, Turso revenu | 8 |
| Deux secondes de réponses | SIGKILL sur Render | compromis assumé (`engine.ts:22`) |
| Ce que la file attendait | redémarrage pendant « Sauvegarde en retard » | assumé (`MISE-EN-LIGNE.md:405`) |

### La croissance

Toutes les requêtes fréquentes passent par un index (`croissance/plans.mjs`) :

- classement du jour et du mois, « trouvée par », partie, carrière, série,
  écussons ;
- nuit, lauriers, historique, resynchronisation.

Les parcours entiers ne viennent que des gestes rares :

- `retirerSoireeEntiere` et `remplacerRecompensesDeSoiree` (sur
  `soiree_id`) ;
- `aRecalculer` et `memoiresDeTous` à chaque démarrage (quelques ko par
  soirée).

Tailles mesurées :

| Ce qui s'écrit | Taille |
|---|---|
| partie au miroir (8 questions, 6 invités) | 3,3 ko |
| archive (14 questions, 6 invités) | 39 ko |
| fiche d'une archive | 1,5 ko |
| tirage du jour | 2,5 ko |
| réponse du jour | ~90 o, soit 10 lignes par joueur et par jour (≈ 18 Mo par an pour 50 joueurs quotidiens) |

À noter, sans constat : `restoreInto` lit chaque table du miroir, tous
espaces confondus, en une seule réponse. Le script de sauvegarde, lui,
pagine « parce qu'une réponse de la base a sa limite ». Aux tailles
mesurées on en est loin, sauf une soirée jamais close pendant des mois. Un
index `soiree_id` sur `profile_xp`, `profile_badges` et `profile_eclats`
accélérerait le recalcul au barème du jour (un parcours par soirée relue).

## Ce qui marche — à ne pas casser

- **Les migrations** : `ajouterColonne` lit le schéma, toute colonne ajoutée
  est nullable, et chaque durcissement écrit son drapeau dans le même lot
  que ses lignes. Le passage a6fc98b → b57035c ne perd rien.
- **Le miroir d'une instance** : `uid` tirés à l'écriture locale, upserts,
  état de la partie dans le lot de ses gains. La resynchronisation n'efface
  jamais. La clôture efface le miroir avant la base locale. Chaque écriture
  locale de la soirée a sa recopie (vérifié registre par registre).
- **Le nom de soirée** tiré une fois, rangé des deux côtés, et gardé par-delà
  minuit et les réveils (épreuve de migration).
- **Le quiz du jour** se garde contre le double paiement par ses clauses SQL
  (`WHERE question = ?`, `INSERT OR IGNORE`, empreinte unique) plutôt que
  par ses verrous en mémoire. C'est ce qui le protège aussi entre deux
  instances.
- **La sauvegarde** : générique (tout `sqlite_master`), typée, paginée,
  écrite à côté puis renommée. Les tables de #58 et #59 y sont sans qu'on y
  ait pensé.

## Recommandations, dans l'ordre

1. **Bail sur le miroir** (constat 1), puis passation sans perte. En
   attendant, une ligne dans `MISE-EN-LIGNE.md` : déployer seulement avec
   `quizEnCours` et `espacesActifs` à 0 dans `/healthz`. P2 · M.
2. **Retrait d'une soirée : reprendre aux profils d'abord, désignés par
   l'archive, effacer l'archive en dernier** (constats 2 et 7). P2 · S.
3. **Un crédit de soirée fait foi pour toute la soirée** : effacer les lignes
   et Éclats des profils absents (constat 3). P2 · S.
4. **Le drapeau en dernier** : `jour_clotures` après les podiums payés ;
   badge, `#paliers` et total d'un seul lot ; `#jour` dans le lot de la
   réponse (constats 4 et 5). P3 · S.
5. **Resynchroniser quand l'état du miroir est inconnu** : après un
   effacement en échec, et au démarrage sur disque gardé (constats 6 et 8).
   P3 · S.
6. **Retour arrière** : sauvegarde avant de promouvoir, et une version de
   schéma pour la suite (constat 9). P3 · S.

## Limites

- Pas de vrai Turso : délais, limites de taille des réponses et réponses
  perdues sont simulés (déclencheurs, client enveloppé). Pas de vrai Render :
  le chevauchement des instances pendant un déploiement vient de sa
  documentation, que le proxy ne laisse pas consulter. C'est à confirmer sur
  la préproduction (constat 1, procédure donnée).
- La restauration par `turso db shell` n'est pas éprouvée. Une photo tient
  sur une ligne de plusieurs centaines de ko d'hexadécimal, qu'un shell
  distant pourrait refuser.
- Le temps et le nombre de requêtes du premier démarrage après la mise à jour
  sont laissés à l'expert exploitation. Ici, en local, 38 à 63 ms, sans
  recalcul (`VERSION_BAREME` inchangé à 6).
- Les courses sans panne sont laissées à l'expert concurrence, l'exactitude
  des récompenses à recompenses-comptes.

## Hors mission

- **Saisons et historique** (recompenses-comptes). #59 fait lire les saisons
  « au recalcul de l'historique », mais `VERSION_BAREME` n'a pas bougé
  (6 → 6). Les soirées d'Halloween, de Noël et du Nouvel An déjà archivées
  n'ouvriront leur légendaire qu'au prochain changement de barème
  (invariant 20).
- **Annonce après un redémarrage** (lecture, non rejoué). `xpAnnoncee` vit en
  mémoire : après un redémarrage en cours de soirée, le crédit suivant
  annonce à chaque téléphone l'expérience de toute la soirée comme un gain
  neuf (`space.ts:774-796`).
