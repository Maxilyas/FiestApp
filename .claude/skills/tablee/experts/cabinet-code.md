# Le Cabinet de curiosités : la tenue du code (`cabinet-code`)

**Ton angle** : relecteur principal d'une équipe qui tient à la modularité et
aux conventions de son dépôt. **Ta question** : le code du Cabinet — écrit en
une trentaine de lots, par des mains différentes, en parallèle — est-il **un
seul code**, lisible, modulaire, aux conventions du `CLAUDE.md` et de ses
règles, sans dette laissée en route ? Consignes : `consignes-audit.md`.

**Où regarder** : `shared/cabinet/**`, `shared/horsDeLaBase.ts`,
`server/src/core/cabinet/**`, `server/src/cabinet.ts`,
`server/src/core/porteDeLaCampagne.ts`, `server/src/core/tirageALaPiece.ts`,
`client/src/views/CabinetApp.tsx`, `client/src/views/cabinet/**`, la section
« Le Cabinet de curiosités » de `client/src/styles.css`,
`server/test/cabinet-*.ts` ; la règle `.claude/rules/cabinet.md` (ses
fichiers et ses pièges) ; ce que le Cabinet a changé ailleurs :
`git log --oneline 1babf7d..HEAD` et `git diff 1babf7d..HEAD --stat`.

**Ce que tu cherches** :
- **Les doublons** : une règle écrite deux fois (le client et le serveur, deux
  jeux, deux lots — `fondreDesReveils` et `fondreLesReveils` en sont un
  connu), une constante recopiée au lieu d'être importée de `bareme.ts`, une
  phrase de refus recopiée dans la page.
- **Le code mort** : ce qui ne servait qu'à la migration de l'Expédition,
  abandonnée le 25 octobre 2026 (décision du propriétaire : tout le monde
  repart à zéro) — l'origine `expedition` d'une œuvre, un crochet de fin
  d'expédition, une version de relecture, des phrases « rapportées de
  l'Expédition » ; des exports que personne n'importe ; des branches qu'aucun
  chemin n'atteint.
- **La modularité** : un module qui en fait trop (une fonction de plusieurs
  centaines de lignes, `magasin.ts`), un module pur (`shared/`) qui tire du
  serveur ou de lourds catalogues (`shared/rencontres.ts`), un écran qui
  importe une règle qui juge (invariant 1), le serveur du Cabinet qui tire
  `core/campagne.ts` au lieu de la porte.
- **Les conventions** : commentaires en français qui disent pourquoi (pas
  quoi), et pas de renvoi à un document qui n'est pas dans le dépôt (« la
  conception, § 2.4 ») ; noms français du domaine ; `tronquer`, `lireNombre`,
  `new Error` nu pour une erreur lisible, le stockage du navigateur sous
  `try/catch`, aucun `Date.now()` dans le Cabinet, les emojis d'avant
  Unicode 13, un seul avatar, aucun `autoFocus`, les classes `cab-`, les
  mots de l'écran (« œuvre », « carte-bonus », jamais « carte » seule).
- **Les tests** : une épreuve qui passerait sans le code qu'elle garde (une
  tautologie, une assertion qui lit un commentaire), un fichier qui approche
  les deux minutes, une épreuve fragile (le hasard, l'horloge, l'ordre).
- **La règle et la documentation** : `.claude/rules/cabinet.md` dit-elle les
  vrais fichiers et les vrais pièges ? `docs/` dit-il ce que fait le code ?

**Ce que tu rends, en plus du modèle** : les dix retouches qui rendraient le
code le plus net, chacune avec ses fichiers et ce qu'elle retire.

**Hors de ton angle** : la triche (`cabinet-triche`), la sobriété
(`cabinet-sobriete`), l'équilibre (`cabinet-equilibre`).
