# Le banc du 16 octobre 2026 : le gel du processeur

Les scripts du banc, posés sur celui de la revue du 14 octobre
(`../../2026-10-14/reproductions/` : le faux Turso, qui parle le protocole
HTTP de libsql et compte chaque aller-retour). Les bases jetables vont dans
`export/perf-turso/` (ignoré par git). Tout se lance depuis `server/`. Chaque
script dit en tête ce qu'il mesure : `banc-vague.ts` l'accueil d'un
téléphone, médiane de sept vagues ; `allers-par-route.ts` les
allers-retours de chaque route ; `tas-de-la-base.ts` ce que la base de la
campagne pèse et coûte à chaque réveil ; `banc-tirage.ts` les sujets et le
tirage (plus bas).

```bash
cd server
# Le volume de la production, puis chaque route et chaque tâche de fond mesurée (≈ 3 min).
node --import tsx ../retours/2026-10-16/reproductions/banc-gel.ts
# Le même, le serveur au dixième de cœur, comme l'offre gratuite de Render (≈ 15 min, root, cgroup v1).
GEL=1 node --import tsx ../retours/2026-10-16/reproductions/banc-gel.ts
# Avec le profileur de V8 : les fonctions qui ont pris le processeur (ses propres échantillons coûtent).
PROFILER=1 node --import tsx ../retours/2026-10-16/reproductions/banc-gel.ts
# Puis, sur la base qu'il a laissée : les allers-retours de chaque route, et son processeur rangé par couche.
node --import tsx ../retours/2026-10-16/reproductions/banc-gel-profil.ts
```

**Le volume** : 32 profils, dont 17 qui jouent — le quiz du jour, trois
séries, une épreuve de sentier, un dé contre Automate, des duels classés
entre eux —, par les vraies routes ; puis leurs séries, leurs réponses et
leurs duels recopiés quatorze fois en arrière sur douze jours, et onze jours
de quiz du jour : ≈ 1 400 séries, ≈ 14 000 réponses de campagne, ≈ 110
duels. La production en avait 1 292, 13 406 et 149 ce jour-là.

**Ce qu'il dit, étape par étape** : son temps, le processeur du processus
(le client du banc compris, une milliseconde par requête environ), le plus
long gel de la boucle (`monitorEventLoopDelay` à 5 ms), les pauses du
ramasse-miettes (`PerformanceObserver`), le tas. Le réveil à disque effacé,
les douze secondes de préchauffage qui suivent, dix routes à froid puis à
chaud pour le joueur qui a le plus répondu et pour un joueur moyen, un
tirage et un dé, puis l'horloge avancée de trente et une minutes — la
mesure des difficultés et le modèle du savoir se refont en fond —, et enfin
l'accueil d'un téléphone (six requêtes de front), puis de quatre.

**Le dixième de cœur** (`GEL=1`) : le processus du serveur entre dans un
cgroup v1 à `cpu.cfs_quota_us = 10000` sur une période de 100 ms — dix
millisecondes de processeur par dixième de seconde, ce que Render donne à
l'offre gratuite —, et le faux Turso en ressort : c'est la base distante,
à 30 ms l'aller-retour. La machine de ce banc était elle-même partagée :
200 ms de processeur y prenaient 600 ms de mur sans bride, 4,8 s bridées.
Ses gels sont donc plus longs que ceux de Render ; les rapports entre
étapes, avant et après une correction, restent justes.

**L'étape 2 — les sujets et le tirage** (`banc-tirage.ts`) : sur la vraie
base, sans serveur, les sujets de toute la base, la préparation d'un tirage
(`PreparationDuTirage`), puis chaque tirage pour un joueur lourd, moyen et
neuf. Sous tsx, chaque fonction fléchée passe par `__name` (esbuild garde
leurs noms) ; le paquet de production non : le script se compile d'abord,
pour mesurer comme en production.

```bash
cd server
npx esbuild ../retours/2026-10-16/reproductions/banc-tirage.ts --bundle --platform=node \
  --format=esm --packages=external --outfile=../export/banc/banc-tirage.mjs
node ../export/banc/banc-tirage.mjs
```

**Les limites** : le faux Turso n'a ni TLS ni vraie latence ; la base est
inventée — mêmes volumes, pas les mêmes joueurs ; le banc ne lit jamais la
base de production (elle se lit en totaux, en lecture seule :
`lecture-de-la-production.md`).
