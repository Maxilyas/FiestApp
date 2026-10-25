# Le Cabinet de curiosités : la base, le quota, le processeur (`cabinet-sobriete`)

**Ton angle** : ingénieur des performances, spécialiste des bases distantes
facturées à la ligne. **Ta question** : le Cabinet tient-il sa promesse de
sobriété — **zéro aller-retour vers Turso pour une page déjà en mémoire,
un seul lot à froid, un aller-retour par geste**, aucune lecture qui grandit
avec l'histoire d'un joueur, peu de processeur par requête — et ses écritures
sont-elles **gardées** (rien deux fois, rien de perdu, rien d'orphelin) ?
Le quota de Turso compte les lignes lues et écrites (333 millions lues le
22 octobre 2026) ; la production dort la nuit et chaque réveil est un
démarrage. Consignes : `consignes-audit.md`.

**Où regarder** : `server/src/core/cabinet/` (`magasin.ts` : les musées et
les parties en mémoire, leurs bornes, ce qui s'oublie ; `tables.ts` : le lot
froid et ses requêtes ; `ecriture.ts` : les lots gardés ;
`tirages/tas.ts` : ce qui se prépare en fond), `server/src/core/porteDeLaCampagne.ts`,
`server/src/core/campagne.ts` (`init`, ce que la porte ajoute au premier lot),
`server/src/cabinet.ts` ; la règle `.claude/rules/cabinet.md`,
`.claude/rules/journaux-et-miroir.md`, `.claude/rules/campagne.md` ;
`docs/reference/base-de-donnees.md` (les tables du Cabinet) ; les tests
`cabinet-charge.test.ts`, `cabinet-index.test.ts`, `demarrage.test.ts`,
`campagne-charge.test.ts` (le patron qui compte les allers-retours).

**Ce que tu mesures** — par un banc instrumenté (compte les allers-retours
et les lignes lues et écrites, sur le modèle de `cabinet-charge.test.ts`),
jamais au chronomètre :
- **Chaque route**, à chaud et à froid : la page, commencer, chaque geste
  de chaque jeu, la fin d'une partie (avec et sans gardien réveillé), l'achat,
  la dorure, l'échange, le cartel, la partie relue, les murs, une image du
  Détail. Compare à ce que promet `docs/reference/api-http.md`.
- **Un fidèle** : un profil de 300 parties, 84 œuvres, une semaine de visites
  — les lignes que lit sa page à froid, et le premier geste d'après un réveil.
- **Le réveil du serveur** : ce que le Cabinet ajoute au démarrage
  (`demarrage.test.ts`), la préparation des tas en fond (rend-elle la main ?),
  le premier départ d'une liste neuve.
- **Les plans des requêtes** (`EXPLAIN QUERY PLAN`, avec et sans
  statistiques) : chaque lecture part-elle de la clé du profil ?
- **La mémoire** : les bornes des caches (`MUSEES_GARDES`, `PARTIES_GARDEES`),
  ce qui grandit sans borne (une `Map` par profil jamais vidée ?), ce qui se
  recalcule à chaque page (le pli rejoué de bout en bout, le musée dérivé).
- **Les écritures** : chaque lot gardé (un geste rejoué n'écrit rien, une
  écriture ratée s'oublie et se relit), aucune `UPDATE`/`DELETE` sur
  `campagne_reponses` (les déclencheurs des tranches), la taille du départ
  figé (`campagne_series.cabinet`).

**Hors de ton angle** : la triche (`cabinet-triche`), l'équilibre
(`cabinet-equilibre`), la tenue du code (`cabinet-code`).
