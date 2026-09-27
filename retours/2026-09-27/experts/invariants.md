# Les règles écrites, relues une à une — rapport de l'expert `invariants`

*Code de `main` (b57035c, juste après la PR #59), samedi 26 septembre 2026.*

## En bref

Les règles mécaniques du `CLAUDE.md` tiennent presque partout, y compris
dans les dix mille lignes de #58 et #59 : les 27 messages clients passent
par `ecouter()`, les 19 commandes `host:*` sont gardées, les 59 clés de
hauts faits ont leur rareté, les 20 prix individuels sont dans
`PRIX_INDIVIDUELS`, les 23 accès au stockage sont sous `try/catch`, et
aucun niveau n'échappe à `niveauDuProfil`. Les 441 noms que cite le
`CLAUDE.md` existent tous, et les chiffres du README et de
`RECOMPENSES.md` sont ceux du code ; ce sont une dizaine de phrases qui
ne le sont plus.

Deux règles écrites cèdent, et je l'ai rejoué :

- **Invariant 8.** Le quiz du jour s'amorce avec les quiz livrés, ceux-là
  mêmes que chaque animateur reçoit. Le premier quiz du jour est, question
  pour question, « Culture générale », et sa correction s'ouvre aux profils.
- **Invariant 20.** Les saisons d'une soirée sont promises « à la clôture
  comme au recalcul », mais `VERSION_BAREME` est resté à 6. Le recalcul ne
  relit donc jamais une soirée déjà rangée, jusqu'au prochain changement
  de barème, qui fera tomber ces légendaires par surprise.

À cela s'ajoutent une règle des Divins écrite en toutes lettres dans la
documentation, un jeton de réserve qui lit plus que « ajouter », et une
dizaine de phrases que le code ne tient plus.

Les trois gestes les plus rentables :
1. Ne plus amorcer la réserve du jour avec les modèles des animateurs, et
   retirer ceux déjà versés.
2. Monter `VERSION_BAREME` à 7, ou écrire que les saisons ne sont pas
   rétroactives.
3. Retirer de la documentation la règle de l'Arbre-Monde et les phrases
   périmées.

## Méthode

Environ une heure et quart de lecture de code et de vérifications
mécaniques (`rg`, lectures ciblées), sur `client/src`, `shared/` et
`server/src`. Chaque occurrence suspecte a été lue et classée : violation,
exception légitime ou faux positif. Il n'y a eu ni navigateur ni rendu,
la fiche n'en demandait pas. Les tests ont été lancés un fichier à la
fois, sous `nice -n 10`, avec une charge de 0,5 à 1,1.

**Lu.** Les consignes, la fiche et le modèle de rapport (`.claude/skills/tablee/`).
`CLAUDE.md` en entier. `README.md` (profils, feuille de route, direction).
`RECOMPENSES.md` § 5 et 6. `MISE-EN-LIGNE.md` (étape 8). `render.yaml`.
La synthèse du 24 septembre (en survol). Puis le code :

- `shared/` :
  - lus en entier : `saisons.ts`, `fonds.ts`, `ecussons.ts`, `categories.ts`, `avatars.ts`, `jour.ts`, `proches.ts` ;
  - lus en partie : `hautsfaits.ts` (catalogue, `PART_DES_JOUEURS`, `plusBeaux`), `classement.ts`, `library.ts` (`PIECES_DE_QUESTION`), `events.ts` (le contrat) ;
  - lus dans leur diff : `legendaires.ts`, `profil.ts`, `carte.ts`, `fin.ts`, `types.ts`, `space.ts`, `glossaire.ts`.
- `server/src/` :
  - `sockets.ts` (`player:join`, `ecouter`) ;
  - `core/space.ts` (diff, carte, empreinte, clôture), `party.ts`, `recalcul.ts`, `objectifs.ts`, `saisons.ts`, `consigne.ts`, `stats.ts` (diff), `divins.ts` (diff), `export.ts`, `seed.ts`, `distante.ts`, `http.ts` ;
  - `core/jour.ts` : la réserve, le tirage, la partie, le verrou, les écussons, la série, la nuit, le laurier, l'administration ;
  - `quizDuJour.ts`, `api.ts`, `server.ts`, `index.ts` ;
  - `auth/profiles.ts` : `avatarPorte`, `toPublic`, `update`, les paliers, les saisons, `badgesOf`, `historiqueOf`, `careerOf`, le recalcul ;
  - `auth/http.ts` ;
  - `games/quiz.ts` (`vctx.memo`, `guessRows`, `reponseJuste`).
- `client/src/` :
  - `styles.css` : focus, écussons, laurier, fonds, médaillons figés, diff ;
  - composants : `Laurier`, `Ecusson`, `Jour` ;
  - dans leur diff : `Leaderboard`, `Podium`, `Course`, `HostView`, `PlayerView`, `HostApp`, `ProfilApp`, `EditorApp` ;
  - `JourApp` (les dates), `api.ts` (le quiz du jour), les dix fichiers qui touchent au stockage.
- `server/test/` : `garde-fous`, `medaillons`, `emojis`, `saisons`, les assertions de `fin-de-soiree` et `hautsfaits`, `banc.ts`.
- `server/scripts/` : `sauvegarde.ts` (liste des tables), `smoke.ts` (sections), `tablee/regie.ts` (sélecteurs).
- Le journal de la dernière vérification (`verify.log`), pour la durée de chaque fichier de test.

**Écrit** (dans `export/evaluations/invariants/`) :
- `catalogues.ts` → `catalogues.json` vide les catalogues du code (hauts
  faits, légendaires, barèmes, saisons, fonds, écussons, collection, jour)
  pour les confronter ligne à ligne aux tableaux de la documentation.
- `jour-modeles.test.ts` : constat 1. **Échoue aujourd'hui.**
- `saison-recalcul.test.ts` : constat 2. Le test principal **échoue
  aujourd'hui** ; le témoin passe.
- `jeton-reserve.test.ts` : constat 3. **Échoue aujourd'hui.**
- `categories-du-jour.ts` tire six jours sur la réserve amorcée et compte
  leurs catégories (constat 5) : `npx tsx` depuis `server/`.

Pour les rejouer : `cd server && nice -n 10 node --import tsx --test --test-timeout=120000 ../export/evaluations/invariants/<nom>.test.ts`.
Tous les serveurs démarrés ont été refermés par leur test.

**Pas couvert.** Les règles qui se jugent à l'écran : « visible sans
défiler en 360 × 640 », les tailles de `/host` en 1920 × 1080. Je n'ai
relu que leur CSS : le diff de #58/#59 ne touche pas la branche anonyme
de l'accueil, et le laurier est en `em`. Pas de `npm test` complet.

## Constats

### 1. Le quiz du jour pose, et corrige pour les profils, les questions que les soirées jouent

- **Où.** L'amorçage de la réserve :
  - `server/src/core/jour.ts:334-345` (`amorcer` : `lireModeles().filter(m => !m.personnaliser)`) ;
  - `server/src/core/jour.ts:520-523` (le tirage prend les plus anciennes d'abord, donc les livrées) ;
  - `server/src/core/jour.ts:1283-1289` (la correction, bonne réponse comprise, s'ouvre à qui a fini, puis à tous à minuit).

  Les mêmes quiz, côté animateurs :
  - `server/src/api.ts:363-403` (`/api/modeles` propose tous les modèles à chaque espace) ;
  - `server/src/core/seed.ts:71-84` (« Culture générale », `amorce: true`, importé d'office dans l'espace de l'administrateur).
- **Constat.** La réserve du jour s'amorce avec les questions des quatre
  quiz livrés non personnalisés : Culture générale, Vrai ou faux, Les
  8-12 ans, Noël en famille, soit 38 questions. Ce sont les modèles qu'on
  propose à chaque nouvel animateur (« partir d'un modèle »). Tirées dans
  l'ordre d'arrivée, elles font les quatre premiers jours. Leur
  correction, bonne réponse comprise, s'ouvre aux profils ; les mêmes
  questions reviennent un mois plus tard, dès que la réserve est à sec.
  - `RECOMPENSES.md:731-733` écarte « ceux des animateurs : leurs invités
    y liraient la prochaine soirée ». Or les quiz livrés **sont** ceux des
    animateurs.
  - L'invariant 8 et le README (l. 100) sont nets : « pas de question
    plus facile » pour un profil.
- **Preuve (rejouée).** `export/evaluations/invariants/jour-modeles.test.ts`
  échoue : les **10 questions sur 10** du premier quiz du jour
  (2026-09-28) sont celles de « 🌍 Culture générale ». Le miel, Jupiter,
  2007, la France 2018, 35 000 communes, le martinet, Olaf, le thé, les
  flamants gris, la Loire : chacune arrive avec sa bonne réponse dans la
  correction.
- **Qui ça touche, ce que ça coûte.** Toute soirée qui joue un quiz livré
  tel quel, et c'est le premier réflexe d'un nouvel animateur. Les
  profils qui ont fait le quiz du jour ces jours-là connaissent les
  réponses ; un invité anonyme, non. C'est l'avantage de jeu que le
  parti pris n° 1 et l'invariant 8 interdisent. N'importe quel profil,
  gratuit, peut aussi lire la correction d'un jour clos : c'est la porte
  la plus simple vers les réponses des modèles.
- **Statut.** Invariant cassé, confirmé (rejoué). La tablée ou
  `jour-regles` peut le recroiser sous l'angle du contenu.
- **Piste.**
  - Ne plus amorcer la réserve avec `lireModeles()`. Une réserve vide
    s'annonce déjà à `/admin`, et la routine la remplit. Sinon, un contenu
    propre au quiz du jour (`server/content/jour/`), qu'aucun animateur ne
    reçoit.
  - Refuser en plus toute question d'un modèle livré à l'entrée de la
    réserve :
    ```ts
    // jour.ts — raisonDEcarter (ou ajouter())
    const LIVREES = new Set(lireModeles().flatMap(m => m.questions.map(q => empreinteDe(String(q.text ?? '')))))
    if (LIVREES.has(empreinteDe(q.text ?? ''))) return 'dans un quiz livré aux animateurs'
    ```
  - Une fois, sous drapeau dans `jour_meta`, marquer `retiree_le` sur les
    lignes `source = 'livre'` pas encore posées.
  - Puis corriger `RECOMPENSES.md` § 5.13 et le README (« La réserve
    s'amorce toute seule avec les quiz livrés »).
  - Le test ci-dessus devient celui de la correction.
- **Priorité · effort.** P2 · S.

### 2. Les saisons d'une soirée déjà rangée ne se relisent pas : `VERSION_BAREME` est resté à 6

- **Où.** `server/src/auth/profiles.ts:181` (`VERSION_BAREME = 6`), `:1706`
  (`aRecalculer` : `detail NOT LIKE '{"v":6,%'`). `server/src/core/recalcul.ts:110`
  (rien à relire, rien ne se fait) et `:47` (`laureatsDeSaison`, jamais
  atteint pour une soirée d'avant). Promesse : `CLAUDE.md:62` et
  `RECOMPENSES.md:410`, « à la clôture comme au recalcul » ; invariant 20,
  « quand le barème ou un haut fait change, incrémente `VERSION_BAREME` ».
- **Constat.** #59 fait naître des soirées une récompense nouvelle, la
  saison. C'est un cas identique aux Divins, qui avaient monté le barème
  à 4 « pour qu'un Divin y descende aussi » sur les soirées d'avant. Ici,
  rien n'a bougé.
  - Une soirée jouée pendant Halloween, Noël ou le Nouvel An et rangée
    avant #59 n'ouvre jamais son légendaire.
  - Le jour où un autre changement montera `VERSION_BAREME`, le recalcul
    relira tout, et la Citrouille d'il y a un an tombera sans rapport avec
    ce changement, sans annonce.
- **Preuve (rejouée).** `export/evaluations/invariants/saison-recalcul.test.ts` :
  - le scénario : une soirée du 31 octobre 2025, close, ramenée à l'état
    d'avant #59 (ligne `saison:` retirée, lignes au barème 6), puis un
    redémarrage ;
  - le test principal échoue : « 0 ligne de saison, légendaires = [] » ;
  - le témoin redescend les lignes d'une version : au redémarrage suivant,
    `[profils] expérience recalculée … 1 soirées relues`, et la Citrouille
    tombe.
- **Qui ça touche, ce que ça coûte.** Les profils des soirées jouées du 25
  octobre au 1er novembre, du 20 au 26 décembre et du 30 décembre au 2
  janvier derniers, si la production en a eu. Puis tout le monde, par
  surprise, au prochain changement de barème.
- **Statut.** Invariant cassé, confirmé (rejoué).
- **Piste.** `VERSION_BAREME = 7`, avec sa ligne dans le commentaire
  (« 7 depuis les saisons : l'expérience n'a pas bougé, mais les soirées
  d'avant doivent se relire pour qu'une saison y tombe aussi »). Si l'on
  ne veut pas de rétroactivité, il faut l'écrire dans `RECOMPENSES.md` et
  `CLAUDE.md`, **et** borner `laureatsDeSaison` aux soirées d'après la
  mise en ligne ; sinon le prochain barème la rendra quand même.
- **Priorité · effort.** P3 (P2 si la production a joué ces soirs-là) · S.

### 3. Le jeton de la réserve lit les questions des trois semaines à venir

- **Où.** `server/src/core/jour.ts:447-476` (`consigne` : jusqu'à 300
  intitulés, `ORDER BY posee_le IS NOT NULL`, les questions pas encore
  posées d'abord). `server/src/quizDuJour.ts:146-152` (`GET
  /api/jour/reserve`, derrière le seul jeton). Promesses :
  - `CLAUDE.md:533` : « le jeton de la réserve ne sait qu'ajouter » ;
  - `MISE-EN-LIGNE.md:181` : « S'il fuitait, il ne coûterait que des
    questions en trop » ;
  - `RECOMPENSES.md:758`.
- **Constat.** La consigne sert à ne pas écrire deux fois la même
  question, et c'est voulu. Mais elle recopie tous les intitulés à venir :
  un jeton qui fuit donne le quiz du jour de demain, et des vingt jours
  suivants. Cela suffit pour chercher les réponses la veille, monter sur
  le podium, porter le laurier et faire tomber Le Champion du jour.
- **Preuve (rejouée).** `export/evaluations/invariants/jeton-reserve.test.ts`
  échoue : « 10 des 10 questions de demain se lisaient la veille avec le
  jeton ».
- **Qui ça touche, ce que ça coûte.** Personne tant que le jeton ne fuit
  pas. S'il fuit, la documentation sous-estime le dégât et l'action à
  mener : changer le jeton ne suffit pas, il faut aussi retirer les
  questions à venir.
- **Statut.** Règle écrite non tenue (la documentation), confirmé
  (rejoué). Le fond relève de `securite-portes`.
- **Piste.** Deux options :
  - ne recopier que des intitulés déjà posés (`WHERE posee_le IS NOT
    NULL`). L'empreinte refuse déjà les copies exactes ; une question
    reformulée d'une question encore en réserve devient possible, et
    l'administration la verrait ;
  - garder la consigne telle quelle et corriger les trois phrases : « il
    lit les intitulés à venir ; s'il fuit, change-le et retire les
    questions des prochains jours ».
- **Priorité · effort.** P3 · S.

### 4. La règle d'un Divin est écrite dans la documentation

- **Où.** `RECOMPENSES.md:401-403` : « L'Arbre-Monde ne le demande pas : il
  ne compte que les douze d'origine ». `CLAUDE.md:58` : « l'Arbre-Monde,
  lui, ne demande que les douze d'origine (`DOUZE_LEGENDAIRES`) ». Ces deux
  phrases, ajoutées par #59, contredisent trois autres textes :
  - `RECOMPENSES.md:441` : les règles vivent dans `core/divins.ts` « et
    nulle part ailleurs » ;
  - README l. 122 : « ce README s'arrête là » ;
  - l'invariant 21 : « Les règles des Divins ne quittent jamais le
    serveur ».
- **Constat.** Le code tient : `divins.test.ts` passe, rien dans `shared/`
  ni dans `client/` n'en dit un mot. Mais la documentation du dépôt,
  lisible par qui lit le dépôt, livre désormais la règle entière d'un des
  cinq Divins.
- **Preuve.** Lecture. `git show a6fc98b:RECOMPENSES.md` ne contenait
  aucune de ces deux phrases.
- **Qui ça touche, ce que ça coûte.** Le mystère des Divins, parti pris
  explicite. Il ne vaut que si le dépôt est lu par des joueurs.
- **Statut.** Règle écrite non tenue (documentation), confirmé (lecture).
- **Piste.** « Un légendaire de plus ne reprend rien à personne », sans
  nommer l'Arbre-Monde ni sa règle. La précision reste dans le
  commentaire de `DOUZE_LEGENDAIRES` (`core/divins.ts:63`), côté serveur.
- **Priorité · effort.** P3 · S.

### 5. Dix phrases que le code ne tient plus

- **Où.** Chacune a sa ligne.

  | Où | Ce qui est écrit | Ce que fait le code |
  |---|---|---|
  | `shared/jour.ts:10-11` (en-tête) | « Tout ce qui ne se gagne qu'en soirée y reste : hauts faits, paliers de carrière, légendaires, Divins, Éclat. » | Le quiz du jour décerne trois paliers de carrière, le Sphinx et les trois légendaires de saison. |
  | `RECOMPENSES.md:685-687` (§ 5.13) | « les légendaires, les Divins et l'Éclat restent aux soirées » | Idem ; le § 5.4 et le README (« les autres légendaires ») disent juste. |
  | `CLAUDE.md:251` (invariant 19) | « Rien pour la présence, rien seul » | Le quiz du jour paie jusqu'à 75 XP à qui joue seul, par choix (option B). L'invariant n'en dit rien ; seul le tableau des fichiers le mentionne. |
  | `RECOMPENSES.md:735` | « Deux par catégorie au plus chaque jour » | `choisir` (`jour.ts:156-174`) en met deux au plus *d'abord*, puis complète sans limite. Mesuré sur la réserve amorcée (`categories-du-jour.ts`) : le 4ᵉ jour pose 4 « Nature » et 3 « Sciences ». |
  | `RECOMPENSES.md:737`, `jour.ts:528` | « à sec, les plus anciennes reviennent (pas celles du mois) : jamais un jour vide » | Pas le premier mois : seules les questions posées il y a plus de 30 jours reviennent (`JOURS_AVANT_DE_REPOSER`, `jour.ts:106`). Mesuré : les 38 questions amorcées font trois jours de 10, un de 8, puis les 5ᵉ et 6ᵉ jours n'ont **pas de quiz** (« la réserve de questions est vide ») tant que ni la routine ni l'administrateur n'ont rempli la réserve. |
  | `CLAUDE.md:62`, `RECOMPENSES.md:410` | saisons « à la clôture comme au recalcul » | Voir le constat 2. |
  | `CLAUDE.md:533`, `MISE-EN-LIGNE.md:181`, `RECOMPENSES.md:758` | le jeton « ne sait qu'ajouter » | Voir le constat 3. |
  | `CLAUDE.md:16` | `npm test` : « environ une minute » | 263,7 s à la dernière vérification (652 épreuves, 77 fichiers). |
  | `RECOMPENSES.md` § 5.3, tableau de carrière | « 🥉 Le Podium » | Le code et le tableau des plus rares du même fichier disent « L'Habitué du Podium ». |
  | `shared/profil.ts:401`, `shared/jour.ts:303` | deux commentaires de documentation orphelins | Ceux de `Carriere` et de `PartieDuJour` sont restés au-dessus d'une interface insérée avant eux. |
- **Constat.** Aucune de ces phrases ne casse le code. Elles égarent le
  prochain qui lit : un agent qui se fie à l'en-tête de `shared/jour.ts`
  refusera un légendaire au quiz du jour.
- **Preuve.** Lecture, ligne à ligne. `catalogues.json` pour les chiffres.
- **Statut.** Documentation, confirmé (lecture).
- **Piste.** Une passe de relecture, une ligne chacune. Pour l'invariant
  19 : « … rien seul — sauf le quiz du jour, qui se joue seul et paie au
  plus un quiz de dix questions (`#jour`) ».
- **Priorité · effort.** P3 · S.

### 6. La lettre des conventions : cinq écarts sans gravité

- **Où, et ce qui s'y passe.**
  - `server/src/core/export.ts:195` : `short()` coupe l'intitulé d'une
    question avec `slice`. Un emoji au 69ᵉ caractère laisse un demi-emoji,
    écrit « � » dans l'en-tête du CSV. Démontré sur l'expression
    recopiée : `"x"×68 + "🐆…"` donne `"x�…"`, là où `tronquer` donne
    `"x🐆"`. Code d'avant #58.
  - `server/src/quizDuJour.ts:262` (#58) : la recherche de profils à
    `/admin` est coupée avec `.slice(0, 40)`. Sans effet en base, elle ne
    sert que de filtre.
  - `client/src/games/quiz/PlayerView.tsx:894` et
    `client/src/games/quiz/HostView.tsx:350` : le rang est recompté sur
    place (`1 + filter(o => o.points > p.points).length`) au lieu de
    `rangPartage`. C'est la même règle (invariant 15), hors du module
    unique. Code d'avant #58.
  - `server/src/core/jour.ts:1516` (#58) : la liste des profils de
    l'administration montre `r.avatar` brut, pas `avatarPorte`. Seul
    l'administrateur le voit.
- **Statut.** Écarts à la lettre, confirmés (lecture). Aucun n'abîme une
  soirée.
- **Piste.**
  - `tronquer(s, max - 1) + '…'` et `tronquer(req.query.q, 40)` ;
  - `rangPartage(p.points, v.podium!.map(o => o.points))` et son
    équivalent pour les votes ;
  - `avatarPorte`, ou une ligne de commentaire qui assume l'exception.
- **Priorité · effort.** P3 · S.

## Mesures et cartes

### Les règles, une à une

Violation : ✗. Exception légitime : ◐. Tenue : ✓.

**Les conventions**

| Règle | Vérification | Occurrences lues | Verdict |
|---|---|---|---|
| Commentaires en français, qui disent pourquoi | commentaires ajoutés par #58/#59, recherche de mots anglais, `TODO`, `FIXME` | ≈ 1 500 lignes | ✓ |
| Très peu de dépendances | `package.json` absent du diff | — | ✓ |
| Emojis d'avant Unicode 13 | portée d'`emojis.test.ts` (client, public, index, shared, server/src, content), et la collection (12 emojis, Unicode ≤ 12) | 12 + catalogue | ✓ |
| Erreur montrable : `new Error` nu | `extends Error`, `.code =`, `throw` non-Error ; `erreurMontrable` | 3 classes, toutes internes | ✓ |
| Messages courts, qui disent quoi faire | 23 messages neufs | 23 | ◐ Trois ne disent pas quoi faire (« Question introuvable », « Cette question n'est pas encore posée », « Profil introuvable ») ; seul un appel forgé les voit |
| `tronquer`, jamais `slice` | `.slice(` | 109, dont ≈ 25 sur du texte | ✗ `export.ts:195`, `quizDuJour.ts:262`. ◐ Texte réduit à l'ASCII d'abord (`space.ts:56`, `echange.ts:62`, `Entree.tsx:69`), identifiant validé ensuite (`space.ts:67`, `profiles.ts:566`), en-tête HTTP (`profiles.ts:1094`, `store.ts:507`), majuscule initiale recollée (`JourApp.tsx:769`, `Jour.tsx:137`, `Carriere.tsx:72`), suffixe d'homonyme (`homonymes.ts:77`) |
| `lireNombre`, jamais `Number()` ; `ChampNombre` | `Number(`, `parseInt`, `parseFloat` ; `type="number"`, `inputMode` | 190 | ◐ `HostApp.tsx:906` (un `<select>`), `EditorApp.tsx:2262` (« à partir du n° » : le texte est gardé, le vide vaut « à la fin »), `EditorApp.tsx:2788` (3 chiffres). Côté serveur : des charges JSON déjà lues au téléphone (`quiz.ts:1006`, `:1140` ← `lireNombre` de `PlayerView`/`HostView`) |
| Précision des seuls QCM ; estimation au coup d'œil | `Math.abs(` entre une valeur et une cible | 20 | ◐ `PlayerView.tsx:783` (affichage), `progress.ts:47` (relevé jamais affiché), `hautsfaits.ts:146-149` (seuil du facteur dix). `stats.ts` (biais en %) est la tension n° 12 du 24 septembre |
| `vctx.memo`, deux vues par réponse | classements dans `quiz.ts` | 9 | ✓ (`quiz.ts` intouché par #58/#59, sauf deux `export`) |
| `--accent-text` pour l'écrit, `--accent` pour les aplats | `color: var(--accent)`, `'var(--accent)'` en TSX | 2 | ◐ `styles.css:3987` (le blason d'or : un graphisme `aria-hidden`, 3,13 : 1 en Ivoire, au-dessus du 3 : 1 exigé pour un graphisme ; le bronze et l'argent prennent pourtant leur variante `-text`), `Jour.tsx:20` (un aplat) |
| Un seul anneau de focus | `outline:` | 2 | ◐ `styles.css:5158` (`.carte-joueur`, focalisée par programme, `tabindex=-1`) |
| Stockage sous `try/catch` | `localStorage`, `sessionStorage`, `document.cookie` | 23 | ✓ |
| Pas d'`autoFocus` dans l'entrée ni `ProfilForm` | `autoFocus`, `.focus()` | 2 + 7 | ✓ (`HostView.tsx:268` pour la cible, `PlayerView.tsx:334` pour l'estimation : hors entrée) |
| CSS : pas de `transform` qu'une animation écrase | `@keyframes`, `transform` et `animation` ajoutés | 3 | ✓ (`lg-bougie` n'anime que l'opacité, gelée dans les listes) |
| CSS : `/host` en `rem` ; aucune règle réservée à une hauteur | `@media` et tailles ajoutés | 0 nouvelle `@media` | ✓ (le laurier est en `em`) |

**Les invariants**

| Invariant | Vérification | Verdict |
|---|---|---|
| 1 · Logique serveur | `QuestionDuJour` sans bonne réponse ; correction gardée (`jour.ts:1289`) ; admin derrière `requireAdmin` (9/9 routes) | ✗ La correction des questions livrées donne d'avance la réponse d'une question de soirée (constat 1) |
| 2 · Deux bases | tables `jour_*` dans la base permanente ; `ajouterColonne` pour `titre`, `vitrine`, `fond` ; la sauvegarde lit `sqlite_master` | ✓ |
| 3 · `space_id` | route de la carte ; le quiz du jour, commun par choix | ✓ |
| 4 · L'instantané | `laurier` ajouté à `PublicPlayer` (change une fois par jour), rediffusion par `laurierChange` | ✓ |
| 5 · Chronos persistés | le jour n'a pas de minuteur (échéance en base, `expirer`) | ✓ |
| 6 · `serverNow()` | `Date.now()` au client : 15 occurrences, aucune échéance ; `JourApp` : `serverNow` et `avecLHeure` | ✓ |
| 7 · Accusés, `ecouter()` | 27 messages du contrat contre 27 `ecouter` ; seul `socket.on` : `disconnect` | ✓ |
| 8 · Aucun avantage de jeu, l'anonyme n'affiche rien | laurier, écussons, fonds, titre, collection : profils seuls ; emoji de collection filtré à l'entrée (`sockets.ts:407-409`) | ✗ Constat 1 |
| 9 · La fiche fait foi | `player:join` inchangé, sauf le filtre de collection | ✓ |
| 10 · Crédits | soirée inchangée ; paliers du jour sous `#jour:<jour>`, jamais repris | ✓ |
| 11 · Nom de soirée | saisons datées comme `soireeDesInvites` | ✓ |
| 12 · Un geste dit ce qu'il visait | réponse du jour : `jour` + `index`, périmée refusée | ✓ |
| 13 · Miroir | rien de neuf dans la base locale | ✓ |
| 14 · Dérivations pures | `objectifs`, `saisons`, `ecussons`, `proches` : purs ; `laureatsDeSaison` identique en clôture et en recalcul | ✓ |
| 15 · `classement.ts` | le jour : `classer`, `rangDansLesTries` | ◐ Deux rangs recomptés sur place, même règle (constat 6) |
| 16 · Une personne, deux tables | routes neuves sans effet sur les sessions | ✓ |
| 17 · Homonymes | classement du jour par `nomsAffiches` (`jour.ts:1552`) ; aucune marque en base | ✓ |
| 18 · Un seul geste de fin | inchangé | ✓ |
| 19 · L'expérience se mérite | podium du jour à une marche de moins que la salle (`xpDuPodium`) ; un joueur seul n’a ni podium ni laurier (`jour.ts:1217`) | ◐ Le jour paie seul par choix, l'invariant ne le dit pas (constat 5) |
| 20 · `VERSION_BAREME` | règles de #58/#59 dérivées des journaux | ✗ Saisons (constat 2) ; `stats.ts`, `hautsfaits`, `XP` : pas de changement de règle |
| 21 · Divins secrets | `divins.test.ts` ; `badgesOf` et `toPublic` écartent `dv:` et `saison:` ; `approches` et `proches` sans Divin | ✓ dans le code · ✗ dans la documentation (constat 4) |
| 22 · Durcir ne reprend rien, `niveauDuProfil` | `niveauPour(` : 4 appels, tous dans `niveauDuProfil`, `progression` ou `COURBES_D_AVANT` ; `fondsOuverts`, `peutPorter`, `apparenceDe` et les lignes du jour passent par `niveauOf` ; aucune condition durcie (`legendaires.ts` : ajouts seulement) | ✓ |

**La structure**

| Règle | Vérification | Verdict |
|---|---|---|
| Chaque `host:*` dans `garde-fous.test.ts` | 19 commandes, liste typée | ✓ |
| Chaque haut fait dans `PART_DES_JOUEURS` | `catalogues.ts` : 20 + 13 × 3 = 59 clés, aucune sans rareté, aucune orpheline | ✓ |
| Chaque prix individuel dans `PRIX_INDIVIDUELS` | 22 clés dans `stats.ts` = 20 individuels + Coup de Pouce + Plus Solidaire | ✓ |
| `PIECES_DE_QUESTION` partout où part une question | la réserve refuse `image`, `son`, `photoAttendue` | ◐ `imageRevelation` n'est pas vérifiée (`jour.ts:141`), mais aucune liste collée ne sait en porter |
| `empreinteDesPages` | pas de nouvelle source ; la carte se calcule à la demande | ✓ |
| `revision` des journaux | aucune écriture neuve dans `Party`, `Teams`, `ScoreLedger`, `AnswerLog` | ✓ |
| `recopierSoiree` avant l'écriture | saisons rangées par `remplacerRecompensesDeSoiree` après `await recopie` (`space.ts:1437-1440`) | ✓ |
| `cleDeSoiree` | `objectifsDe` ; `careerOf:1685` compare les noms seuls, exception documentée pour les Éclats | ✓ |
| `#paliers` et `#jour` écartés | `historiqueOf`, `jour.ts:1072`, `jour.ts:1167` ; `aRecalculer` et le recalcul les traitent à part | ✓ (`profilsAvecExperience`, code mort d'avant #58, ne les écarte pas) |
| Médaillons hors du chemin de l'invité | imports statiques depuis `PlayerApp` (`medaillons.test.ts`) | ✓ |
| Nouvelles classes de la tablée | `quiz-player`, `ans-btn`, `guess-form`, `join-url`, `fin-tete`… | ✓ toutes présentes |
| Un fichier de test sous deux minutes | durées de `verify.log` | ✓ nouveaux fichiers de 0 à 9 s ; `cloture.test.ts` à 74 s cumulées |
| L'Éclat neutralisé dans les tests | nouveaux tests qui ferment une soirée | ✓ |

**La documentation**

| Contrôle | Résultat |
|---|---|
| 441 noms entre accents graves dans `CLAUDE.md` | 0 absent. Les 19 qui ne se trouvaient pas tels quels (`ArchiveStore.ecrire`, `JourStore.maintenant`, `RAISE(ABORT)`…) existent sous leur forme décomposée |
| Noms de #58/#59 et leur rôle (`accorderPaliersDuJour`, `cleDuJour`, `laureats`, `laurierChange`, `accorderSaison`, `laureatsDeSaison`, `periodeDu`, `fondsOuverts`, `fondPorte`, `plusBeauxEcussons`, `SEUILS_ECUSSON`, `DOUZE_LEGENDAIRES`, `niveauRequis`, `COLLECTION`, `Distinctions.laurier`) | Tous font ce qui est dit, sauf « au recalcul » (constat 2) |
| Barème XP, `SEUILS`, courbe 60 × (n−1)², finitions 3/6/10/15/20/25 | ✓ |
| Hauts faits : 20 de soirée (XP de chacun), 10 + 3 de carrière (paliers) | ✓ (nom « Le Podium », constat 5) |
| 16 légendaires, leurs conditions | ✓ |
| Collection (12 emojis, niveaux 2 à 17), anneaux vert < 10 et bleu | ✓ |
| Écussons 20/75/200, 12 catégories ; fonds (30 jours, niveau 20, 10 victoires, Habitué · Or) | ✓ |
| Saisons (dates, 3/3/2 jours) ; jour (75 XP, 25/15/10, médailles 6/8/10, paliers 7/30/100, 1/5/20, 1/3/10) ; 1 240 sur 2 000 → 46 ; tableau B (1 105 XP/mois, niveau 15) | ✓ |
| `PART_DES_JOUEURS` contre le tableau des plus rares | ✓ |
| Jeton de 32 caractères, étape 8, `render.yaml` | ✓ (sauf ce qu'il lit, constat 3) |

## Ce qui marche — à ne pas casser

- **Les garde-fous typés.** `garde-fous.test.ts` (commandes `host:*`),
  `hautsfaits.test.ts` (`PART_DES_JOUEURS` égal au catalogue) et
  `fin-de-soiree.test.ts` (`PRIX_INDIVIDUELS` égal aux clés du calcul)
  ont suivi #59 sans qu'on y pense. C'est ce qui fait tenir la structure.
- **`ecouter()` et les accusés** : 27 messages sur 27, et aucun raccourci
  dans les dix mille lignes neuves.
- **L'invariant 22 bien appliqué au neuf.** Fonds, collection, apparence
  et classement du jour lisent tous le niveau par `niveauOf`. La
  collection se juge par `peutPorter` à l'entrée d'une soirée comme à
  l'écriture du profil, et l'anonyme qui forge un emoji repart avec 🎉.
- **Le quiz du jour tient les règles du moteur** : échéance du serveur
  recalée par `avecLHeure`, geste qui dit sa question, verrou par profil,
  `tronquer` sur les signalements, `classer` et `nomsAffiches` au
  classement, `#jour` écarté partout où l'on relit des soirées.
- **Les Divins** : dans le code, aucune fuite. `badgesOf`, `toPublic`,
  les objectifs et « les plus proches » les ignorent tous.
- **La documentation chiffrée** : cinquante valeurs relues, cinquante
  justes. La dette est dans les phrases, pas dans les nombres.

## Recommandations, dans l'ordre

1. **Sortir les quiz livrés de la réserve du jour** : retirer l'amorçage
   ou le donner à un contenu propre au jour, refuser les empreintes des
   modèles, retirer une fois les lignes `livre` non posées. P2 · S.
2. **`VERSION_BAREME = 7`** pour les saisons, ou non-rétroactivité écrite
   **et** bornée dans `laureatsDeSaison`. P3 · S.
3. **La consigne du jeton** : n'y recopier que les intitulés posés, ou
   dire ce que le jeton lit dans `CLAUDE.md`, `MISE-EN-LIGNE.md` et
   `RECOMPENSES.md`. P3 · S.
4. **Retirer la règle de l'Arbre-Monde** de `RECOMPENSES.md:401-403` et
   `CLAUDE.md:58`. P3 · S.
5. **Relire les dix phrases périmées** (constat 5), dont l'invariant 19
   et l'en-tête de `shared/jour.ts`. P3 · S.
6. **Les cinq écarts à la lettre** (constat 6). P3 · S.
7. **Ajouter une garde qui manque.** Un test qui relit, pour chaque
   récompense dérivée d'une soirée (prix, hauts faits, Divins, saisons),
   qu'elle entre dans `creditDArchive`. Un second, qui échoue si un
   fichier de `shared/` ou de `core/` introduit une clé `saison:`, `dv:`
   ou `hf:` sans que `VERSION_BAREME` bouge. Le premier est
   mécanique ; le second demande une empreinte du catalogue gardée dans
   le test. P3 · M.

## Limites

- Aucune règle d'écran n'a été regardée à l'écran : 360 × 640 sans
  défiler, `/host` en 1366 × 768 et 1920 × 1080. Seul leur CSS a été
  relu.
- Pour les constats 1 et 2, je ne sais pas si la production a déjà
  amorcé sa réserve, ni si elle a joué des soirées pendant les saisons
  passées. La gravité en dépend. La préproduction, déployée à chaque
  fusion, a certainement la réserve amorcée.
- Les messages d'erreur, le contraste des médailles en Ivoire et les
  tailles des nouveaux écrans relèvent des experts `mots`,
  `accessibilite` et `jour-ecran`. Je n'en ai vérifié que la règle écrite.

## Hors mission

- **Une saison peut se perdre alors qu'elle était méritée deux fois.**
  `ProfileStore.accorderSaison` (`auth/profiles.ts`, `if
  (this.recompensesOf(profileId).has(cle)) return false`) ne range rien
  sous le jour si une soirée l'a déjà rangée. Retirer ensuite cette
  soirée de l'historique emporte la Citrouille, même avec trois jours de
  quiz du jour dans la période : « l'une des deux suffit » ne tient plus.
  Confirmé à la lecture, pour `recompenses-comptes`.
- **Un espace nommé `jour`**, créé avant #58, devient inaccessible : `jour`
  a rejoint `RESERVED_SLUGS` (`shared/space.ts:25`) sans migration ni
  alerte au démarrage. Peu probable ; pour `securite-portes` ou
  `exploitation`.
