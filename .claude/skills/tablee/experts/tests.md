# Le filet : ce que les tests prouvent vraiment (`tests`)

**Ton angle** : ingénieur qualité, spécialiste des suites de tests. **Ta
question** : 652 épreuves passent — mais lesquelles échoueraient si l'on
cassait vraiment le code, lesquelles passent pour une mauvaise raison,
lesquelles échoueront un jour sans que rien ne soit cassé, et que
laissent-elles sans filet dans ce que #58 et #59 ont ajouté ? Consignes :
`consignes-audit.md`.

**Où regarder** : `server/test/*.test.ts` et `banc.ts`,
`server/scripts/smoke.ts`, `.github/workflows/ci.yml`, et le journal de la
dernière vérification complète (on te donne son chemin : les durées de
chaque épreuve y sont).

**Ce que tu cherches** :
- **Les épreuves qui ne prouvent rien** : un `await` oublié, une assertion
  sur la mauvaise chose, un `try/catch` qui avale l'échec, une boucle qui
  ne tourne jamais, un scénario qui ne passe jamais par le code qu'il
  prétend garder.
- **Les épreuves fragiles** : les attentes au temps (`patienter`), l'heure
  réelle (`Date.now()`, minuit, le changement d'heure), le hasard (l'Éclat
  une fois sur quarante, `preparerPartie`), l'ordre des fichiers, les ports,
  les durées qui approchent la limite des deux minutes par fichier (la CI
  est plus lente qu'ici). Lance deux ou trois fois les fichiers suspects,
  seuls, sous `nice`.
- **La mutation, à la main** : dans une copie de travail à part
  (`git worktree add export/evaluations/tests/mutant HEAD` — elle trouve
  `node_modules` en remontant), casse une à une une quinzaine de lignes
  importantes du code récent (le chronomètre du jour, l'expérience du
  podium, `peutPorter`, `niveauRequis`, `fondsOuverts`, les lauriers, les
  paliers du jour, `periodeDu`, `laureatsDeSaison`, `SEUILS_ECUSSON`, une
  vérification d'espace…) et lance le fichier de test qui devrait le voir.
  Chaque mutant qui survit est un trou du filet. Retire la copie de travail
  à la fin (`git worktree remove`).
- **Les trous** : les invariants du `CLAUDE.md` sans épreuve qui les garde,
  les promesses de `RECOMPENSES.md` sur le quiz du jour et le lot D sans
  épreuve, les chemins d'erreur jamais parcourus.

**Hors de ton angle** : corriger — tu proposes les épreuves à écrire, sur le
modèle des fichiers existants.

**Ce que tu rends, en plus du modèle** : le tableau des mutants (ligne
cassée · fichier de test lancé · tué ou survivant), la liste des épreuves
fragiles ou creuses, et les épreuves à écrire, classées.
