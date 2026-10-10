# Les règles écrites, relues une à une (`invariants`)

**Ton angle** : relecteur de code systématique. **Ta question** : les
vingt-deux invariants et les conventions du `CLAUDE.md`, et les pièges de
ses règles (`.claude/rules/`), tiennent-ils **partout** dans le code d'aujourd'hui — surtout dans les dix
mille lignes des PR #58 et #59 — et la documentation dit-elle encore vrai ?
Consignes : `consignes-audit.md`.

**Ta méthode** : pour chaque règle, une vérification mécanique (`rg`, une
lecture ciblée), passée sur `client/src`, `shared/` et `server/src` ; chaque
occurrence suspecte est lue et jugée (violation · exception légitime · faux
positif). Par exemple — la liste n'est pas close :
- `.slice(` sur un texte venu d'un humain (→ `tronquer`) ; `Number(`,
  `parseInt`, `parseFloat` sur une saisie (→ `lireNombre`) ; `Date.now()`
  dans une échéance du serveur (→ `serverNow`) ; `socket.on(` pour un
  message client (→ `ecouter`) ; `new LoginBudget(` ; `.avatar` lu tel quel
  pour l'afficher (→ `avatarPorte`) ; `niveauPour(` hors de
  `niveauDuProfil` ; `Math.abs(` entre une valeur et une cible
  (→ `ecartEstimation`) ; `=== q.correct` (→ `reponseJuste`) ; un accès à
  `localStorage`, `sessionStorage` ou `document.cookie` hors d'un
  `try/catch` ; un `autoFocus` dans l'entrée ou `ProfilForm` ; une
  `new Error` à message montrable qui porte un `code` ;
- côté CSS : `--accent` pour un texte (→ `--accent-text`), un `outline`
  posé par un composant, une taille de la scène de `/host` en `px` hors de
  `@media (min-width: 1101px)`, une règle réservée à une seule hauteur
  d'écran, une animation qui pose `transform` sur un élément centré par
  `translate` ;
- côté structure : chaque commande `host:*` dans `garde-fous.test.ts` ;
  chaque haut fait dans `PART_DES_JOUEURS` ; chaque prix individuel dans
  `PRIX_INDIVIDUELS` ; chaque pièce d'une question dans
  `PIECES_DE_QUESTION` et dans tout ce qui emporte une question ; chaque
  source d'une page publique dans `empreinteDesPages` ; chaque écriture d'un
  journal qui fait monter sa `revision` ; `recopierSoiree` avant toute
  écriture permanente sous un nom de soirée ; `cleDeSoiree` partout où l'on
  compare des soirées ; `#paliers` et `#jour` écartés par tout lecteur de
  `profile_xp` ; aucun import statique des médaillons sur le chemin d'un
  invité ; un classement qui passe par `shared/classement.ts` et par
  `vctx.memo` ; `VERSION_BAREME` monté si #59 a touché un barème.
- **La documentation** : chaque nom cité par le `CLAUDE.md` et ses règles pour les
  nouveautés (`accorderPaliersDuJour`, `cleDuJour`, `laureats`,
  `laurierChange`, `accorderSaison`, `laureatsDeSaison`, `periodeDu`,
  `fondsOuverts`, `fondPorte`, `plusBeauxEcussons`, `SEUILS_ECUSSON`,
  `DOUZE_LEGENDAIRES`, `niveauRequis`, `COLLECTION`, `Distinctions.laurier`…)
  existe-t-il et fait-il ce qui est dit ? Les chiffres de `RECOMPENSES.md` et
  du README (seuils, barèmes, nombres de jours) sont-ils ceux du code ?

**Hors de ton angle** : juger si une règle est bonne — tu vérifies qu'elle
est tenue. Les bugs profonds de logique vont aux autres experts ; une règle
écrite qui n'est pas tenue est à toi.

**Ce que tu rends, en plus du modèle** : le tableau règle par règle (la
vérification lancée · occurrences · violations · exceptions légitimes), les
violations avec `fichier:ligne`, et les écarts entre la documentation et le
code.
