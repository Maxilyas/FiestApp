# Le banc de la revue du 14 octobre 2026

Un faux Turso (`faux-turso.ts`) : le protocole Hrana v2 sur HTTP, celui que
le client libsql parle à une adresse `http://`, adossé à un fichier SQLite,
avec une latence réglable par aller-retour. Le serveur s'y branche par
`quizDbUrl` — le banc des tests (`server/test/banc.ts`) l'accepte tel quel —,
et chaque requête emprunte le vrai chemin de la production : le client HTTP
de libsql, sa limite de requêtes en vol, son décodage, `avecDelai`. Il compte
chaque aller-retour, ses instructions, ses octets, et passe chaque requête
distincte à `EXPLAIN QUERY PLAN` avec ses vrais arguments.

Les bases jetables vont dans `export/perf-turso/` (ignoré par git). Tout se
lance depuis `server/` :

```bash
cd server
# Les routes : activité réaliste, réveil à disque effacé, chaque route à froid et à chaud, à 0 et 30 ms (≈ 5 min).
TAG=aujourdhui node --import tsx ../retours/2026-10-14/reproductions/routes.ts
# Les gestes de jeu et la chronologie d'un réveil, sur la base de la passe précédente (même TAG).
TAG=aujourdhui node --import tsx ../retours/2026-10-14/reproductions/jeu.ts
# La trace aller par aller du profil, de l'accueil, de la carte et d'une partie du quiz du jour.
node --import tsx ../retours/2026-10-14/reproductions/trace.ts
# Les plans des parcours complets, et ceux de leur réécriture.
node ../retours/2026-10-14/reproductions/plans.mjs
# Le fetch de Node et ses connexions.
node ../retours/2026-10-14/reproductions/connexions.mjs
```

Sur un service déployé, au repos et rarement (chaque série compte dans sa
minute de `/healthz` et dans son relevé de l'heure) : une connexion vers
Turso rouverte contre gardée, mesurée par le serveur lui-même.

```bash
BASE=https://<le service> SLUG=<un espace> node ../retours/2026-10-14/reproductions/sonde.mjs
```

Comparer deux commits : un autre arbre, mesuré avec les modules de celui-ci.

```bash
git worktree add --detach ../../hier c3b2f99
ln -s "$PWD/../node_modules" ../../hier/node_modules
DEPOT=../../hier TAG=hier node --import tsx ../retours/2026-10-14/reproductions/routes.ts
DEPOT=../../hier TAG=hier node --import tsx ../retours/2026-10-14/reproductions/jeu.ts
```

L'ancienne base de la campagne contre la nouvelle (la commande qui tire
l'ancienne de git est en tête de `base.ts`) :

```bash
node --expose-gc --import tsx ../retours/2026-10-14/reproductions/base.ts ancienne
node --expose-gc --import tsx ../retours/2026-10-14/reproductions/base.ts nouvelle
```

Les limites : pas de vraie latence de Turso ni de vraie poignée de main TLS ;
des volumes de banc. Les plans, eux, ne dépendent pas du volume (pas
d'`ANALYZE`, ni ici ni chez Turso). Comme les reproductions du 27 septembre,
ce dossier est une archive : une correction recopie son épreuve dans
`server/test/`, au compteur d'allers-retours que les tests ont déjà
(`duels-attente.test.ts`, `jour-charge.test.ts`).
