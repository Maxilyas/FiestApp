# Les données : deux bases, un miroir, une archive (`persistance`)

**Ton angle** : ingénieur des données et de la reprise après panne. **Ta
question** : de la réponse tapée au souvenir relu un an plus tard, qu'est-ce
qui peut se **perdre**, se **dédoubler** ou se **corrompre** — un arrêt
brutal, une base Turso muette, un disque effacé au réveil, une migration sur
la vraie base de production ? Consignes : `consignes-audit.md`.

**Où regarder** : `server/src/core/db.ts` (la locale), `core/backup.ts` (le
miroir : la file par espace, les `uid`, `ouvrirLot` / `fermerLot`, la
resynchronisation), `core/distante.ts` (le délai, `ajouterColonne`),
`core/archive.ts`, `core/recalcul.ts`, `core/answers.ts`, `core/scores.ts`,
`core/party.ts`, la clôture et `viderSoiree` / `recopierSoiree` /
`soireeEnCours` dans `core/space.ts`, les schémas de la base permanente
(`auth/store.ts`, `auth/profiles.ts`, `core/jour.ts`, `core/quizStore.ts`,
`core/partages.ts`, `core/programmes.ts`), `server/src/index.ts` (démarrage,
arrêt), `scripts/sauvegarde.ts`, `core/export.ts`, et `MISE-EN-LIGNE.md`.
Invariants 2, 5, 10, 11, 13, 14, 18, 20, et les pièges « Une colonne de plus
au journal des réponses », « Un serveur qu'on ferme doit éteindre ses
chronomètres », « `/healthz` doit rester un 200 », « Simuler une panne ».

**Ce que tu cherches** :
- **Les migrations sur une base qui existe** : #58 et #59 ont créé des
  tables et des colonnes (quiz du jour, `profile_legendaires`,
  `profile_niveaux`, fonds, titres, vitrine…). Démarre le code d'aujourd'hui
  sur une base permanente **fabriquée par le code d'avant** (`git worktree
  add export/evaluations/persistance/avant a6fc98b`, démarre-le, joue une
  soirée, arrête-le, puis démarre le code d'aujourd'hui sur la même base) :
  démarre-t-il ? que valent les anciennes lignes ? une colonne `NOT NULL`
  sans défaut ? un index manquant sur une requête fréquente ?
- **Les écritures en plusieurs temps** : une récompense, un crédit, une
  partie du jour écrits en plusieurs requêtes Turso sans lot — un arrêt au
  milieu laisse-t-il un état que le code ne sait pas relire ? Une requête
  qui dépasse le délai de dix secondes **mais passe quand même** — rejouée,
  se dédouble-t-elle ?
- **Le miroir** (invariant 13) : une nouvelle écriture de la soirée qui
  contournerait la file ; la resynchronisation qui effacerait ; la clôture
  qui efface le miroir avant la base locale ; un SIGKILL au pire moment
  (`exploitation.test.ts` pour lancer un vrai processus).
- **Ce qui doit survivre** (invariant 2) : quelque chose des nouvelles
  fonctions (laurier, paliers du jour, saisons, collection) vit-il dans la
  base locale jetable, ou seulement en mémoire, et se perd-il au réveil ?
- **La sauvegarde** : `npm run sauvegarde` emporte-t-elle **toutes** les
  tables de la base permanente, les nouvelles comprises ? Rejoue-la sur une
  base de banc bien remplie, restaure-la dans une base neuve, et compare
  table par table.
- **La croissance** : les tables qui ne font que grandir (réponses du jour,
  signalements, lignes d'expérience, archives) et les requêtes qui les
  parcourent entières (classement du mois, carrière, écussons) — les index
  existent-ils ?

**Hors de ton angle** : les courses sans panne (`concurrence`), l'exactitude
des récompenses (`recompenses-comptes`).

**Ce que tu rends, en plus du modèle** : la carte des données (table · base ·
qui l'écrit · en lot ou non · idempotente ou non · sauvegardée ou non ·
index), et pour chaque perte possible le scénario de panne qui la provoque.
