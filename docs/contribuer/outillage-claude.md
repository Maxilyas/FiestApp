# Travailler avec Claude

> Ce que le dépôt prépare pour Claude Code : sa mémoire (`CLAUDE.md` et les règles de `.claude/rules/`), ses skills, ses agents, le démarrage d'une session et ses permissions ; la tablée, qui fait jouer des soirées à des agents ; `retours/`, où s'archivent leurs trouvailles ; et comment garder tout cela juste. Pour qui travaille avec Claude sur FiestApp.

**Dans cette page** : [la mémoire](#la-mémoire-en-deux-étages) · [les skills](#les-skills) · [les agents](#les-agents) · [la session](#le-démarrage-dune-session-et-les-permissions) · [la tablée](#la-tablée) · [retours](#retours) · [garder la mémoire juste](#garder-la-mémoire-juste)

## La mémoire en deux étages

Claude Code relit `CLAUDE.md` à chaque requête de chaque session, et chaque agent qui ne s'en dispense pas le reçoit aussi. Le 6 octobre 2026, ce fichier faisait 126 Ko — 60 % de plus en trois jours, chaque fonctionnalité y ajoutant sa phrase ; or la documentation de Claude Code vise moins de 200 lignes, au-delà desquelles il suit moins bien ses consignes. La mémoire tient donc en deux étages : une racine courte, valable partout, et une règle par domaine, qui n'arrive que quand on travaille dans ce domaine.

### `CLAUDE.md`, la racine

À la racine du dépôt, ce que tout agent doit savoir, où qu'il touche : comment travailler ici, les commandes, la carte du code et celle des règles, les vingt-deux invariants, les conventions de tout le dépôt, les deux environnements, les pièges qui valent partout, ce qu'il ne faut pas faire, et ce qu'il faut garder quand la conversation se compacte.

Il ne change que pour une commande, un invariant ou une convention de tout le dépôt. Une connaissance nouvelle va dans la règle de son domaine. `server/test/notes-pour-claude.test.ts` le borne à 200 lignes et 24 000 caractères : le faire grandir au-delà est une décision, qui se dit.

### Les règles de `.claude/rules/`

Vingt-huit règles, une par domaine — le moteur du quiz, la salle, la clôture, les deux bases, les récompenses, le QG, l'expédition, le Cabinet de curiosités, les tests, la tablée… La carte de `CLAUDE.md` les nomme toutes. La plupart ont deux parties, « Les fichiers » (chaque fichier du domaine et ce qu'il tient, avec le pourquoi) et « Les pièges » ; certaines portent un invariant en entier, que la racine résume ; d'autres renvoient seulement à leur skill.

Une règle se charge **quand Claude ouvre, avec l'outil Read, un fichier que désigne son en-tête** :

```markdown
---
paths:
  - "server/test/**"
  - "server/scripts/{smoke.ts,tests.mjs}"
---
```

D'où la première consigne de `CLAUDE.md` : lire le code avec Read, jamais par le shell (`cat`, `head`, `sed`), par où la règle n'arrive pas. Pour un domaine sans fichier ouvert, Claude lit sa règle directement. Dans les règles, les chemins s'écrivent courts : `core/` pour `server/src/core/`, `components/` pour `client/src/components/`.

L'en-tête se lit sans pardon : `---`, puis `paths:`, puis un motif par ligne entre guillemets, puis `---`. Un en-tête que Claude Code ne sait pas lire fait charger la règle à chaque session, sans un mot d'erreur ; un motif qui ne désigne plus aucun fichier la rend muette pour toujours. `server/test/notes-pour-claude.test.ts` refuse l'un et l'autre.

## Les skills

Une skill est une procédure en plusieurs étapes, dans `.claude/skills/<nom>/SKILL.md` : son en-tête donne son nom et dit quand s'en servir, et Claude la charge à ce moment-là.

| Skill | Quand | Ce qu'elle mène |
|---|---|---|
| `regarder-le-rendu` | Après toute retouche qui se voit, avant de dire qu'un écran est fini | Les tailles à regarder — le téléphone en 360 × 640, l'écran commun en 1366 × 768 et 1920 × 1080 — et les scripts qui photographient chaque partie de l'application |
| `tablee` | Pour des retours d'utilisateurs, un test d'usage, « faire jouer des agents » | [La tablée](#la-tablée) : la régie, les agents, les experts, la synthèse |
| `base-campagne` | Pour agrandir la base de questions de la campagne | Écrire un lot, le faire relire, appliquer les décisions, ranger — ou des milliers de questions d'un coup, ou d'après Wikidata |
| `peindre` | Pour refaire ou ajouter une image peinte | La chaîne de `server/scripts/anime/` : générer en lot, juger la planche, livrer sous empreinte |

Leurs scripts : [les commandes](../reference/commandes.md).

## Les agents

Trois agents du projet, dans `.claude/agents/` : un en-tête (nom, description, outils, modèle), puis leur consigne.

| Agent | Ses outils | Son modèle | Son rôle |
|---|---|---|---|
| `convive` | Bash, Read, Write | celui que lui donne la tablée | Un personnage de la tablée — un invité ou l'animatrice —, qui découvre l'application dans un vrai navigateur, comme un humain, pas comme un développeur |
| `redacteur-campagne` | Read, Write, Edit, Bash | `sonnet`, réflexion basse | Écrit un lot de questions de la campagne d'après sa consigne, et le vérifie jusqu'à zéro refus |
| `relecteur-campagne` | Read, Write | `opus`, réflexion basse | Relit la fiche d'un lot et rend ses décisions — retirer, corriger — dans un fichier que le script range |

**Aucun ne reçoit `CLAUDE.md`** (`omitClaudeMd: true`). Un personnage ne connaît pas le code, et trente-cinq agents qui recevaient chacun 122 000 caractères avaient vidé en vingt-cinq minutes la réserve d'usage de cinq heures. Les deux agents de la campagne travaillent sobrement pour la même raison : la première vague, au niveau de réflexion de la session, coûtait quatre mille jetons de sortie par question.

Une recherche large passe par l'agent Explore de Claude Code : il ne charge pas `CLAUDE.md`, et garde le contexte principal propre.

## Le démarrage d'une session et les permissions

- **Le hook de démarrage** (`.claude/hooks/session-start.sh`, déclaré dans `.claude/settings.json`) n'agit que dans une session de Claude Code sur le web (`CLAUDE_CODE_REMOTE=true`) : il fait `npm install --no-save --no-audit --no-fund`, puis dit « [hook] dépendances prêtes — npm run verify enchaîne typecheck, tests, build et smoke ». `install` repart d'un `node_modules` déjà chaud ; `--no-save` empêche le npm du conteneur de réécrire `package-lock.json` à chaque session. En local, il ne fait rien. Il n'installe ni Playwright ni Chromium.
- **Les commandes pré-approuvées** (`.claude/settings.json`) passent sans demande : `npm run check`, `build`, `smoke`, `verify`, `dev`, `npm install`, `npx tsc`, `npx tsx`, les commandes de git qui lisent, committent et poussent, `ls`, `cat`, `grep`, `find`, `sed -n` et leurs voisins, `node -e`, `curl -s` vers `localhost`, `npm run tablee` et le pilote de la tablée. Ni `npm test` ni `node --import tsx --test` n'y sont : ils demandent.
- **Les tests répondent en points** quand Claude Code les lance : il pose `CLAUDECODE=1`, et `server/scripts/tests.mjs` passe alors au compte rendu `dot` ([les tests](tests.md)). `npm run verify` dure une dizaine de minutes : Claude le lance en arrière-plan.
- **L'aperçu** (`.claude/launch.json`) a deux configurations : `quizz`, le vrai serveur sur des bases jetables (`npm run start:qa -w server`, port 3001, un autre s'il est pris), et `client`, Vite sur 5173 — dont le relais vise toujours le port 3001.

## La tablée

Une soirée jouée par des agents qui incarnent des invités et une animatrice, chacun sur son appareil, dans un vrai Chromium, sur un vrai serveur aux bases jetables ; à la fin, chacun écrit ce qui lui a plu, ce qui l'a gêné, les bugs vus. Ce que les tests ne disent pas, la tablée le montre : un bouton caché par le clavier du téléphone, un mot que la grand-mère ne comprend pas, un écran que le lecteur d'écran lit dans le désordre. La skill `tablee` (`.claude/skills/tablee/SKILL.md`) en est la marche à suivre.

**Les pièces** : la régie (`server/scripts/tablee/regie.ts`, `npm run tablee`), qui tient le serveur et les navigateurs ; le pilote (`server/scripts/tablee/pilote.mjs`), un geste par commande — regarder, toucher, écrire, répondre, couper le réseau ; la chronologie (`server/scripts/tablee/chronologie.mjs`), le journal en une page ; et, dans `.claude/skills/tablee/`, cinq consignes communes, deux modèles de compte rendu, dix-sept personnages (`personas/`) et trente-six experts (`experts/`).

**Le déroulé** :

1. démarrer la régie en arrière-plan, attendre « La tablée est prête », lire `export/tablee/courante.json` ;
2. lancer un agent `convive` par personnage, tous ensemble — un modèle rapide pour les invités, que le chronomètre n'attend pas ;
3. pendant la soirée, regarder sans piloter (`regie etat`, la chronologie), relancer un agent coupé plutôt qu'en lancer un neuf ;
4. recueillir et **vérifier** : un bug annoncé se rejoue, se recoupe avec le journal des gestes et celui du serveur ; ce qui vient de la tablée — la lenteur d'un agent, le clavier simulé, un geste mal visé — s'écarte ; un retour qui contredit un parti pris se note comme une tension, pas comme une correction ;
5. écrire la synthèse dans `retours/<AAAA-MM-JJ>/` — les axes d'amélioration, du plus important au moins important, chacun avec son statut —, puis `regie arreter`.

**Plusieurs salons** se jouent en même temps sur le même serveur (`--animateur` répété) ; **les experts** — le parcours de l'animateur, les mots, l'accessibilité, la performance… — travaillent dans « l'atelier », une seconde régie à côté ; **les audits de code** — sécurité, moteur, persistance, courses, invariants… — lisent le code, sept au plus à la fois, et leurs constats passent par une contre-expertise qui essaie de les réfuter avant la synthèse.

**Ses limites** : Chromium seulement, ni Safari ni Firefox ; un clavier et une veille simulés ; des agents qui réagissent en plusieurs secondes ; une animatrice qui arrive par un compte à activer, le chemin d'avant les salons ouverts depuis un profil ; et ce que signalent les navigateurs ne s'écrit nulle part. Ne lance pas `npm run build` pendant une tablée : il réécrit le client que la régie sert aux agents.

## `retours/`

Les archives de ce que des agents ont trouvé : une synthèse vérifiée, les retours bruts, les rapports d'experts, parfois les captures et les épreuves qui prouvent un constat. **À lire avant de retoucher un écran qu'elles citent.** Un dossier par date, jamais réécrit :

| Dossier | Ce qu'il range |
|---|---|
| `retours/2026-09-23/` | La première tablée : la synthèse, huit retours de personnages, des captures |
| `retours/2026-09-24/` | La deuxième : trois salons, dix-sept retours, les experts, leur vérification, les corrections axe par axe |
| `retours/2026-09-25/` | Trois rapports : le classement au fil du quiz, sa contre-expertise de performance, la gestion des quiz |
| `retours/2026-09-27/` | L'audit du code après #58 et #59 : la synthèse, tous les constats et leur verdict (`constats.json`), les rapports, les contre-expertises et les épreuves qui les prouvent (`reproductions/`) |
| `retours/2026-10-05/` | Ce que chaque page fait attendre à un téléphone, mesuré |
| `retours/2026-10-10/` | La mémoire de Claude : pourquoi `CLAUDE.md` s'est coupé en règles |
| `retours/2026-10-11/` | L'atelier des nouveautés — le jeu solo et le quiz tout prêt : la synthèse et les rapports des experts |
| `retours/2026-10-12/` | Une revue de nuit : la télé branchée, les prix, les équipes |
| `retours/2026-10-13/` | La base de la campagne relue et agrandie sur le crédit de l'API, et les journaux de ses relectures |

## Garder la mémoire juste

Deux tests relisent la mémoire et la documentation à chaque `npm test` :

- `server/test/notes-pour-claude.test.ts` — `CLAUDE.md` sous ses bornes ; l'en-tête de chaque règle lisible ; chaque motif désigne un fichier ; la carte de `CLAUDE.md` nomme chaque règle, et rien qu'elles ; chaque fichier que citent `CLAUDE.md`, les règles, les skills et les agents existe.
- `server/test/documentation.test.ts` — chaque fichier cité et chaque lien de `README.md` et de `docs/` existent, chaque page se trouve depuis le sommaire, chaque `npm run` cité existe ; chaque route, événement, variable d'environnement et table du code a sa ligne dans la référence, et rien qu'eux ; chaque adresse de page aussi ; chaque barème de la référence a la valeur du code ; et le `README.md` de la racine reste une porte d'entrée, sous 20 000 caractères.

Et les habitudes qui vont avec :

- Une connaissance nouvelle — un piège, une décision et son pourquoi — va dans la règle de son domaine, dans le même commit que le code.
- Un fichier renommé emporte son motif dans l'en-tête de sa règle ; une règle de plus entre dans la carte de `CLAUDE.md`.
- Une route, un événement, une table, une variable, une adresse ou un barème qui change met sa page de `docs/reference/` à jour.
- Les règles des Divins ne s'écrivent nulle part ailleurs que dans leur module (invariant 21) : ni dans une règle, ni dans un commentaire, ni dans la documentation. `server/test/divins.test.ts` y veille.

Après une retouche de la mémoire : `cd server && node --import tsx --test --test-reporter=spec test/notes-pour-claude.test.ts`.

## Pour aller plus loin

- [Les tests](tests.md) — les deux suites, le banc, et ce que la tablée ne remplace pas
- [Les commandes](../reference/commandes.md) — la régie, le pilote, la chronologie, les rendus
- [Démarrer dans le code](demarrer.md) — le cycle d'une modification
- [Les conventions](conventions.md) — ce que la mémoire demande au code
