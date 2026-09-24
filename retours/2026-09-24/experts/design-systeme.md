# Le système de design derrière les écrans — rapport de l'expert design-systeme

## En bref

Il y a bien un système derrière les écrans de FiestApp, et il est plus solide
que ne le laisse croire une feuille de style de 4 254 lignes. Les **couleurs**
sont presque toutes des jetons : 44 variables, toutes employées, aucune
orpheline. Ivoire ne redéfinit que ces variables. Aucun texte ne s'écrit en
`--accent`. Les styles en ligne ne portent que des valeurs calculées, et
tous les emojis respectent la règle « avant Unicode 13 ». Ce qui manque,
c'est tout ce qui **n'est pas couleur** : 84 tailles de police différentes
pour 213 déclarations, 38 pas d'espacement, 16 opacités du champagne,
8 recettes de l'étiquette en capitales, 3 recettes de l'état
« sélectionné », 8 copies de l'anneau de focus. Aucun de ces jetons n'est
nommé.

Les trois améliorations les plus rentables :
1. `color-scheme` sur les deux thèmes. Une ligne chacun, et les contrôles
   natifs (radios, listes déroulantes, ascenseurs) cessent d'être blancs sur
   le Velours.
2. Un anneau de focus unique et un jeton `--accent-text-hover`. Le survol du
   bouton principal de la console tombe à 2,5:1 en Ivoire.
3. Une échelle typographique de neuf crans, et des jetons pour les
   opacités du champagne et pour les états (sélectionné, étiquette). C'est
   une journée de travail pour la première passe, sans changement visible
   à l'écran.

## Méthode

- **Lecture du code** : `client/src/styles.css` en entier par sections,
  `theme.ts`, `Icon.tsx`, les composants et les vues. Le README
  (« Identité visuelle ») et le CLAUDE.md (règles `--accent-text`, emojis,
  `transform`).
- **Trois scripts d'inventaire**, à relancer depuis la racine du dépôt :
  - `retours/2026-09-24/experts/scripts/design-systeme/inventaire-css.mjs`
    (`--json` pour tout le détail) : il découpe la feuille en 3 242
    déclarations, chacune avec sa ligne et son contexte. Il compte couleurs,
    tailles, espacements, rayons, ombres, `z-index`, `@media`, durées et
    variables.
  - `…/css-mort.mjs` : les 571 classes de la feuille, croisées avec toutes
    les chaînes de `client/src` et de `shared/`, préfixes construits compris
    (`av-${…}`).
  - `…/emojis.mjs` : chaque emoji du client, de `shared/` et de
    `server/src`, face aux points de code d'Emoji 13.0 et au-delà, séquences
    ZWJ comprises.
- **Rendu**, dans mon propre atelier (compte Luc, `chez-luc`), avec quatre
  fantômes et un téléphone piloté :
  - l'éditeur et l'écran commun en 1366 × 768 : salle d'attente, choix du
    quiz, question et révélation, en Velours puis en Ivoire ;
  - le téléphone en 360 × 640 : entrée et question d'estimation.
- **Contrastes** calculés sur les jetons (formule WCAG).
- **Pas couvert** :
  - la télé 1920 × 1080 ;
  - la clôture à hauts faits et les pages profil, carte et bilan à l'écran
    (lues dans le code seulement) ;
  - l'impression des fiches ;
  - le rendu réel sous Windows 10.

Environ deux heures.

## Constats

### 1. Les contrôles natifs restent blancs sur le Velours : aucun `color-scheme`
- **Où** : `client/src/styles.css`, où `:root` (l. 42) et
  `:root[data-theme='ivoire']` (l. 112) ne déclarent aucun `color-scheme`.
  C'est visible dans l'éditeur : radios des réponses
  (`EditorApp.tsx:1504`), case « Observation » (l. 1630), liste
  « Catégorie » (l. 1537). Aussi aux listes d'emoji d'équipe sur l'écran
  commun (`HostApp.tsx:92, 183, 573, 749`).
- **Constat** : sans `color-scheme: dark`, le navigateur dessine ses
  contrôles pour un fond clair. Chaque radio non cochée est un disque blanc
  plein, le seul blanc de la page hors QR. La liste déroulante ouvre un menu
  système clair sous Windows. `accent-color` n'est posé que sur deux
  sélecteurs (l. 1700, 2206), pas globalement.
- **Preuve** : `retours/2026-09-24/experts/captures/design-systeme-1-controles-natifs.png`
  (l'éditeur en 1366 × 768 : quatre disques blancs devant les réponses).
  `grep -n "color-scheme" client/src/styles.css` ne renvoie rien.
- **Qui ça touche** : l'animateur dans l'éditeur, à chaque question. Sur
  l'écran commun, aussi les listes d'emoji d'équipe, vues par la salle.
- **Statut** : friction confirmée.
- **Piste** :
  ```css
  :root { color-scheme: dark; accent-color: var(--accent); }
  :root[data-theme='ivoire'] { color-scheme: light; }
  ```
  Puis retirer les deux `accent-color` locaux. À vérifier à l'écran : la
  radio cochée garde son champagne, et le menu de la liste passe en sombre
  sous Chromium et sous Windows.
- **Priorité · effort** : P3 · S.

### 2. Le survol écrit en `--accent-hover`, qui ne tient pas la règle `--accent-text` en Ivoire
- **Où** : `styles.css:205` (`a:hover`), `:424` (`.btn-accent:hover`) et
  `:1793` (`.link-btn:hover`). En Ivoire, `--accent-hover` vaut `#c0973f`
  (l. 122).
- **Constat** : la règle du CLAUDE.md, `--accent-text` pour ce qui s'écrit,
  est respectée au repos : aucun `color: var(--accent)` dans la feuille.
  Mais les trois survols écrivent en `--accent-hover`, un aplat plus clair
  que `--accent`. Sur la crème, `#c0973f` donne **2,49:1**, contre 5,07:1
  pour `--accent-text`. Or `.btn-accent` est le bouton principal de la
  console (« Révéler », `HostView.tsx:284`), celui que la souris survole
  juste avant de cliquer. Même chose pour « Souvenir » et « Jouer ici »
  sur l'écran commun (`HostApp.tsx:699, 986`).
- **Preuve** : contrastes calculés (`#c0973f` sur `#f9f5ec` : 2,49:1 ;
  `#836420` : 5,07:1). Je ne l'ai pas capturé à l'écran, faute d'un geste
  « survol » dans le pilote.
- **Qui ça touche** : l'animateur en Ivoire, le temps d'un survol. C'est
  bref, mais c'est précisément le contraste qu'Ivoire devait sauver.
- **Statut** : incohérence confirmée dans le code, rendu non capturé.
- **Piste** : un jeton de plus, pour que la règle couvre aussi l'état
  survolé.
  ```css
  :root { --accent-text-hover: var(--accent-hover); }
  :root[data-theme='ivoire'] { --accent-text-hover: #6b511a; } /* 6,85:1 */
  a:hover, .link-btn:hover, .btn-accent:hover { color: var(--accent-text-hover); }
  ```
  `.btn-primary:hover` peut garder `--accent-hover` : c'est un aplat, avec
  une encre à 6,71:1 en Ivoire.
- **Priorité · effort** : P3 · S.

### 3. Aucune échelle typographique : 84 tailles pour 213 déclarations
- **Où** : toute la feuille. Inventaire par `inventaire-css.mjs`.
- **Constat** :
  - 147 tailles sont en `rem`, 44 en `px`, 18 en `clamp()` et 3 en `em`.
  - Les quasi-doublons se comptent par grappes : 11 px, 0,68, 0,7, 0,74 et
    0,75 rem sous 12 px ; 0,78, 0,8, 0,82 et 0,85 rem, 13 et 14 px entre
    12 et 14 px ; 1,3, 1,35, 1,4 et 1,45 rem, 22, 23 et 24 px entre 20 et
    24 px.
  - Tableau complet plus bas (§ Mesures).
  - Seuls `h1` à `h3` ont une taille nommée (l. 224-226).
- **Preuve** : `node …/inventaire-css.mjs | sed -n '/## font-size/,/## unités/p'`.
- **Qui ça touche** : personne à l'écran aujourd'hui. Le coût vient à
  chaque écran neuf : on choisit une taille à l'œil, et la
  feuille gagne une valeur de plus. C'est le principal frein à rendre le
  système explicite.
- **Statut** : dette, pas un bug.
- **Piste** : l'échelle de neuf crans proposée plus bas. Elle ramène
  chaque grappe à un cran, à ±0,5 px près : l'écart ne se voit pas.
  Les `clamp()` des grands titres de l'écran commun restent tels quels.
  Ce sont des réglages de scène, et ils tiennent déjà sur 1366 et sur 1920.
- **Priorité · effort** : P3 · M.

### 4. L'étiquette en capitales, recopiée huit fois
- **Où** : `.label` (l. 258) est la recette : 11 px, graisse 500,
  `letter-spacing: 0.22em`, capitales. Elle s'emploie dans 63 `className`.
  Douze autres règles refont des capitales espacées :
  - `.join-eyebrow` (l. 520) : 0,3em ;
  - `.console-label` (l. 1031) : 12 px et 0,18em ;
  - `.pill` (l. 466) : 0,14em ;
  - `.btn-big` (l. 448) : 0,14em ;
  - et les l. 609, 699, 834, 1918, 2374, 2608 et 3148.
- **Constat** : ces douze règles emploient **huit espacements de lettres
  différents** (0,1 / 0,12 / 0,14 / 0,18 / 0,22 / 0,24 / 0,28 / 0,3em) et
  quatre tailles (11 px, 12 px, 0,68rem, 0,7rem).
- **Preuve** : `grep -n "text-transform: uppercase" client/src/styles.css`,
  puis la sortie `letter-spacing` de l'inventaire.
- **Statut** : incohérence confirmée, invisible à l'œil nu une par une.
- **Piste** : deux jetons, `--label-size: 11px` et
  `--label-track: 0.22em`, plus un second cran pour les boutons
  (`--label-track-btn: 0.14em`). Les douze règles y renvoient.
- **Priorité · effort** : P3 · S.

### 5. Le champagne à seize opacités, et des jetons de filet qui ne servent pas partout
- **Où** : 31 `rgba(var(--accent-rgb), x)` hors jetons, avec 16 valeurs
  de `x` : 0, 0,14, 0,16, 0,18, 0,26, 0,28, 0,3, 0,35, 0,4, 0,42, 0,45,
  0,5, 0,55, 0,6, 0,75 et 0,8.
- **Constat** : trois jetons couvrent déjà ce besoin, `--accent-soft`
  (0,12), `--edge` (0,22) et `--edge-strong` (0,55). Pourtant :
  - `.btn`, le composant le plus employé, pose son filet à 0,26 (l. 371)
    au lieu de `--edge` ;
  - `.pill.multi` et `.pill.status-active` ont un « filet fort » à 0,5 ;
  - `.bilan-q.q-ok` et `.fait-eclat` ont le leur à 0,6 ;
  - `.badge.rarete-legendaire` a le sien à 0,75.

  L'œil ne sépare pas 0,22 de 0,26, ni 0,5 de 0,55 de 0,6. Ce sont les
  mêmes intentions, écrites différemment.
- **Preuve** : `grep -oE "rgba\(var\(--accent-rgb\), *[0-9.]+\)" client/src/styles.css | sort | uniq -c`.
- **Statut** : dette. Risque réel en Ivoire, qui redéfinit `--edge` à
  0,38 et `--edge-strong` à 0,75, précisément parce que 0,22 disparaissait
  sur la crème. Les filets écrits en dur ne suivent pas ce réglage. Le
  filet des `.btn` d'Ivoire reste donc à 0,26, plus pâle que toutes les
  cartes autour.
- **Piste** : `.btn { border: 1px solid var(--edge) }`. Ramener
  0,5/0,55/0,6 à `--edge-strong`. Garder les rares 0 des dégradés.
  Ajouter `--accent-focus` (0,4) pour les anneaux doux s'il en reste un.
- **Priorité · effort** : P3 · S. À regarder en Ivoire après coup : le
  filet des boutons fonce.

### 6. L'état « sélectionné » a trois recettes
- **Où** :
  - (a) filet de 1,5 px en `--accent` et fond `--accent-soft` :
    `.ans-btn.chosen` (l. 1305), `.team-btn.selected` (l. 2110),
    `.emoji-btn.selected` (l. 571) ;
  - (b) filet `--edge-strong` et fond `--accent-soft` :
    `.finition-btn.selected` (l. 3007), `.answer-edit.is-correct`,
    `.lb-row.me`, `.bilan-chip:hover` ;
  - (c) filet `--accent` et fond `--accent-soft` : `.galerie-case.porte`
    (l. 3972).
- **Constat** : l'avatar choisi, l'équipe choisie, la réponse choisie et
  la finition portée signifient la même chose. Ils ne se dessinent pas
  pareil : l'épaisseur du filet change, et donc la taille de la case, car
  1,5 px contre 1 px décale le contenu d'un demi-pixel.
- **Statut** : incohérence confirmée dans le code.
- **Piste** : une classe d'état, ou mieux l'attribut qu'on pose déjà pour
  l'accessibilité.
  ```css
  :is([aria-pressed='true'], [aria-checked='true'], .est-choisi) {
    border-color: var(--accent);
    background: var(--accent-soft);
    box-shadow: inset 0 0 0 0.5px var(--accent); /* l'épaisseur sans décaler */
  }
  ```
  Une précaution : `.galerie-case` porte déjà `aria-pressed` pour dire
  « détail ouvert » (`Carriere.tsx:75`), pas « porté ». Pour elle, la
  classe `.est-choisi` s'impose, et non l'attribut.
- **Priorité · effort** : P3 · M (quatre composants à rebrancher, et à
  regarder sur le téléphone).

### 7. Huit anneaux de focus, identiques, déclarés un par un
- **Où** : l. 389-399 (neuf sélecteurs), 1289, 1738, 1887, 2108, 2489,
  3922 et 3943.
- **Constat** : c'est toujours `outline: 2px solid var(--accent)`, avec un
  décalage de 2 à 6 px. Chaque composant neuf doit penser à s'ajouter à la
  liste. `.finition-btn`, `.link-btn`, `.link-inline`, `.pill-button`,
  `.filet` et `.galerie-case` ne s'y sont pas ajoutés : ils gardent
  l'anneau par défaut du navigateur, bleu et noir. Je l'ai lu dans le
  code, pas regardé au clavier.
- **Statut** : incohérence confirmée dans le code. Accessibilité : non
  confirmé à l'écran.
- **Piste** : une règle globale, qui remplace les huit.
  ```css
  :where(a, button, summary, select, input, textarea, [tabindex]):focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  ```
  Les rares décalages de 3 à 6 px restent en surcharge locale. Pour les
  champs `.input` et `.input-line`, qui retirent l'anneau au profit du
  filet (l. 341, 357), `:where` garde une spécificité nulle.
- **Priorité · effort** : P3 · S.

### 8. Couleurs de récompense écrites en dur, figées sur le Velours
- **Où** :
  - `.badge.rarete-*` (l. 3047-3049) recopie en `rgba()` les teintes
    Velours des formes (`--shape-3`, `-2`, `-0`) ;
  - `.palier-1` et `.palier-2` (l. 4028-4029) : bronze `#c98b58` et
    argent `#b9c3cf` ;
  - `.courbes` (l. 4063-4065) déclare ses trois jetons localement, pas
    dans `:root`.
- **Constat** : aujourd'hui, ces composants ne vivent que sur des pages
  toujours en Velours (profil, carte : `ProfilApp`, `PlayerApp`). Rien ne
  casse. Mais l'argent sur la crème donnerait **1,64:1** et le bronze
  2,64:1. Le jour où une étagère ou un palier passe sur l'écran commun ou
  sur une fiche imprimée du bilan (forcée en Ivoire, `BilanApp.tsx:73`),
  ils deviennent illisibles. La rareté, elle, garderait des pastels que
  les formes ont justement quittés en Ivoire.
- **Statut** : dette latente, non visible aujourd'hui.
- **Piste** :
  - des composantes pour les formes, comme pour l'accent
    (`--shape-3-rgb`…), et
    `border-color: rgba(var(--shape-3-rgb), 0.45)` ;
  - `--palier-bronze` et `--palier-argent` dans les deux thèmes (en
    Ivoire, `#8a5a2e` à 5,39:1 et `#6f7a86` à 4,02:1) ;
  - les `--courbe-*` montés dans `:root`.
- **Priorité · effort** : P3 · S.

### 9. Rayons : une échelle à trois crans dont deux se touchent, et sept valeurs en dur
- **Où** : `--radius` 16 px, `--radius-sm` 14 px et `--radius-pill`
  (l. 90-92). En dur : `10px` ×7, `12px` ×4, `6px` ×4, `2px` ×3, et une
  fois chacun `8px`, `22px`, `24px` et `999px`. Ce dernier, l. 212, est
  `--radius-pill` réécrit.
- **Constat** : 16 et 14 px ne se distinguent pas à l'œil. Il manque en
  revanche le cran des petites boîtes : vignettes, champs, cadres de
  photo et de QR, à 10-12 px.
- **Statut** : dette.
- **Piste** : `--radius-xs: 10px` (champs, vignettes, QR ; les 12 px s'y
  rangent) et `--radius-xxs: 6px` (focus, petites cases). Garder `--radius`
  et `--radius-sm` tels quels : les fusionner changerait le rendu de 19
  règles pour 2 px.
- **Priorité · effort** : P3 · S.

### 10. Des composants sans nom : le sélecteur, le champ, la pastille cliquable
- **Où** :
  - la liste « Catégorie » de l'éditeur emprunte `.team-emoji-select`
    (`EditorApp.tsx:1538`), la classe des emojis d'équipe de l'écran
    commun ;
  - `.pill-btn` (l. 477) et `.pill-button` (l. 1751) ont presque le même
    nom pour deux choses différentes, dont une n'est employée qu'une fois
    (`EditorApp.tsx:1363`) ;
  - trois styles de champ : `.input` encadré (éditeur, compte), `.input-line`
    souligné (entrée, profil) et `.guess-input` (serif, estimation) ;
  - 16 composants sont des « pilules à filet », avec leur propre hauteur
    et leur propre corps.
- **Constat** : chaque variante est justifiée par un commentaire, et c'est
  la marque du dépôt. Mais aucun inventaire ne dit lesquelles existent.
  Celui qui ajoute un écran recopie la plus proche.
- **Statut** : dette.
- **Piste** : renommer `.team-emoji-select` en `.select` (et la classe
  d'équipe s'y ajoute), et `.pill-button` en `.pill.est-cliquable`. Surtout,
  une section « Composants » en tête de `styles.css`, qui liste les
  variantes admises : `.btn` × {primary, accent, ghost, danger} ×
  {small, big, icon, block}, `.pill`, `.pill-btn`, `.card`, `.input`,
  `.input-line`, `.dialog`, `.toast`. Voir le tableau plus bas.
- **Priorité · effort** : P3 · S pour les noms, M pour la section.

### 11. CSS mort : six classes, une quarantaine de lignes
- **Où** :
  - `.a-decrocher` et `.a-decrocher-liste` (l. 3056-3080, ~25 lignes : une
    étagère « à décrocher » qui n'existe plus) ;
  - `.chips` (l. 2886, 3617) ;
  - `.player-chip .player-name` (l. 1005) ;
  - `.podium-actions` (l. 1957) ;
  - `.question-timer` (l. 1177).
- **Constat** : aucune chaîne de `client/src` ni de `shared/` ne les
  nomme, en entier ou par préfixe. Les `status-*` que le script signale
  aussi sont vivants : ils sont construits par concaténation
  (`AdminApp.tsx:119`, `'pill status-' + a.status`). Sur 571 classes, le
  taux de mort est de **1 %** : c'est très propre.
- **Preuve** : `node …/css-mort.mjs`, puis une vérification à la main de
  chacune par `grep -rn`.
- **Priorité · effort** : P3 · S.

### 12. La règle « emojis antérieurs à Unicode 13 » tient, mais rien ne la garde
- **Où** : `shared/avatars.ts:5`, `HostApp.tsx:70` (le commentaire),
  `shared/hautsfaits.ts`, `server/src/core/stats.ts` et `teams.ts`.
- **Constat** : **81 emojis distincts, aucun postérieur à Emoji 12**, et
  aucune séquence ZWJ (celles de 13.x comme 🐻‍❄️ ou ❤️‍🔥 sont faites de
  points de code anciens). Le plus récent est 🦩 (Emoji 12, 2019),
  qu'affiche Windows 10 depuis la version 1903. Six symboles BMP sans
  sélecteur `U+FE0F` (✨ ⭐ ⚽ ⚡ ⏰ ✋) : ils sont en présentation emoji
  par défaut, sans risque. Mais la règle ne tient qu'à la vigilance : aucun
  test ne la vérifie. La liste des emojis d'équipe vit dans
  `HostApp.tsx:72`, et non dans `shared/` avec les avatars.
- **Preuve** : `node …/emojis.mjs --tout`.
- **Statut** : conforme. L'idée est de le garder conforme.
- **Piste** : un `server/test/emojis.test.ts`, qui reprend la table de
  `emojis.mjs` et échoue sur tout point de code d'Emoji 13 et au-delà
  dans `client/src`, `shared` et `server/src`. Monter `TEAM_EMOJIS` dans
  `shared/avatars.ts`, à côté de `AVATARS`, pour qu'un seul fichier porte
  la règle.
- **Priorité · effort** : P3 · S.

### 13. Espacements : une grille de 2 px qui ne dit pas son nom
- **Où** : 497 valeurs d'espacement (`padding`, `margin`, `gap`), 38 pas
  distincts.
- **Constat** : 91 % des valeurs sont paires (10, 12, 6, 8, 14, 4, 18 et
  16 px font à eux seuls 370 occurrences). Mais 43 sont impaires : 7 px
  ×11, 9 ×7, 3 ×8, 5 ×8, 11 ×3, 15 et 1. Et 277 valeurs ne tombent pas
  sur une grille de 4. Un passage à 4/8 px changerait trop de rendus pour
  ce qu'il rapporte.
- **Statut** : dette légère.
- **Piste** : ne pas jetonner les espacements un à un. Déclarer la grille
  de 2 px comme règle dans l'en-tête de `styles.css`, arrondir les 43
  valeurs impaires au pair voisin (écran par écran, en regardant), et
  nommer seulement les trois pas de structure : `--gap-serre: 6px`,
  `--gap: 12px` et `--gap-large: 18px`. Ce sont ceux des piles
  `flex-direction: column`, dupliquées sous 11 noms (§ Mesures).
- **Priorité · effort** : P3 · M.

### 14. `z-index` et points de rupture : une échelle implicite, à nommer
- **Où** :
  - 17 `z-index` : les couches du fond (0 à 3) et les surfaces flottantes
    `.bandeau` 40, `.annonces-niveau` 45, `.toast` 50,
    `.preview-backdrop` 60, `.celebration` 60, `.dialog-backdrop` 70 et
    `.env-badge` 9999 ;
  - 10 largeurs de rupture distinctes : 1100 ×5, 600 ×3, 900 ×3, 560, 380,
    1101 et 1599 px, plus les hauteurs 500, 620 et 820 px.
- **Constat** : les couches suivent déjà un ordre sensé. Rien ne l'écrit.
  560 et 600 px sont deux ruptures pour la même idée (le téléphone), et
  `(min-width: 1101px)` est le complément à la main de 1100.
- **Piste** : `--z-bandeau: 40; --z-annonce: 45; --z-toast: 50; --z-apercu: 60; --z-dialogue: 70; --z-env: 9999`.
  Pour les ruptures, un commentaire d'en-tête qui liste les trois ruptures
  admises (600 téléphone, 900 tablette, 1100 écran commun compact) et
  range 560 à 600. Les variables CSS ne marchent pas dans `@media` : la
  règle reste écrite.
- **Priorité · effort** : P3 · S.

## Mesures et cartes

### Vue d'ensemble de `styles.css`

| Mesure | Valeur |
|---|---|
| Lignes | 4 254 |
| Déclarations | 3 242 |
| Classes | 571, dont 6 mortes (1 %) |
| Variables définies (`:root` + Ivoire) | 44 noms, **toutes employées**, aucune orpheline |
| Variables employées sans définition | 2 : `--marches` et `--w`, posées en ligne par `Podium.tsx:64` et `BilanQuestion.tsx:38` (voulu) |
| Styles en ligne (`style={{…}}`) | 15, **tous des valeurs calculées** (largeur de jauge, délai d'animation, hauteur de marche) |
| Sections titrées | 47 |
| `@keyframes` | 47, dont 36 décoratives (`lg-*` ×15, `dv-*` ×18, `av-*` ×3) |
| `@media (prefers-reduced-motion)` | 5 : une globale (l. 1841), qui suffit, et 4 redondantes par prudence |

### Couleurs

| Où | Occurrences | Distinctes | Lecture |
|---|---|---|---|
| Jetons (`:root`, Ivoire) | — | 46 valeurs | le système |
| `rgba(var(--accent-rgb), x)` | 31 | 16 opacités | semi-jetons (constat 5) |
| `rgba(var(--alert-rgb), x)` | 5 | — | semi-jetons, sains |
| Littéraux, interface | 9 | 7 | QR `#fff` ×2, voile d'aperçu 0,78 (contre `--backdrop` 0,72), vignette 0,7, exemple d'import `rgba(0,0,0,.25)`, barre de la bonne réponse `rgba(26,20,18,.35)`, ombre de l'aperçu, fond d'impression |
| Littéraux, récompenses | 9 | 9 | rareté ×3, palier ×2, courbes ×3, cadenas `#211915` (constat 8) |
| Littéraux, finitions, légendaires et Divins | ~51 | ~45 | Argent, Holo, Prisme, Éclat, Aurore, Constellation, fin-divin, fait-ombre : décoratifs, **légitimement** hors jetons |
| TSX | 508 dans `Legendaire.tsx` et `Divin.tsx` ; 8 ailleurs | 373 | les dessins SVG (légitimes) ; l'encre des QR `#1a1412` recopiée dans `Cloture.tsx:41`, alors que `HostApp.tsx:44` en a une constante |

**Règle `--accent-text` / `--accent`** : respectée au repos, aucun texte en
`--accent`. L'exception est l'état survolé (constat 2).

### Typographie

| Plage (équiv. px) | Valeurs distinctes | Détail (valeur × occurrences) |
|---|---|---|
| ≤ 12 | 7 | 11px×7 · 12px×6 · 0.7rem×4 · 0.75rem×3 · 0.74rem · 0.68rem · 10px |
| 12–14 | 6 | 0.82rem×7 · 0.85rem×7 · 14px×3 · 0.8rem×3 · 13px×2 · 0.78rem×2 |
| 14–16,5 | 5 | 0.9rem×12 · 0.95rem×6 · 1rem×5 · 16px · 1.02rem |
| 16,5–20 | 6 | 1.2rem×7 · 1.15rem×7 · 1.25rem×5 · 1.1rem×4 · 1.05rem×2 · 20px |
| 20–24 | 8 | 1.3rem×10 · 1.5rem×8 · 1.4rem×4 · 1.35rem×3 · 22px×2 · 23px×2 · 1.45rem×2 · 24px |
| 24–32 | 7 | 1.6rem×6 · 1.9rem×5 · 1.8rem×4 · 1.7rem×4 · 27px×3 · 2rem×3 · 30px |
| 32–48 | 10 | 3rem×4 · 2.2rem×3 · 2.6rem×3 · 44px×2 · 34px×2 · 33px · 2.1rem · 2.3rem · 40px · 2.5rem |
| > 48 | 14 | surtout des emojis et médaillons (150, 170, 180, 128 px) et les chiffres de scène |
| `clamp()` | 18 | les titres de l'écran commun et de l'entrée |

- Familles : `var(--serif)` ×54, `var(--sans)` ×9, et deux piles monospace
  différentes (l'une commence par Consolas, l'autre par ui-monospace).
- Graisses : 600 ×39, 500 ×32, 400 ×2, 700 ×1.
- `line-height` : 13 valeurs. `letter-spacing` : 13 valeurs.

### Espacements, rayons, ombres

| Pas (px) | 10 | 12 | 6 | 8 | 14 | 4 | 18 | 16 | 2 | 20 | 7 | 22 | autres (26 valeurs) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Occurrences | 81 | 61 | 52 | 50 | 47 | 42 | 21 | 16 | 12 | 11 | 11 | 9 | 84 |

| Rayon | `--radius-pill` | `--radius-sm` | `--radius` | 10px | 12px | 6px | 50 % | 2px | autres |
|---|---|---|---|---|---|---|---|---|---|
| Occurrences | 21 | 11 | 8 | 7 | 4 | 4 | 4 | 3 | 6 |

Ombres : deux jetons (`--shadow-toast` et `--shadow-dialog`), bien employés.
Mais `.preview-frame` (l. 2031) recopie `0 24px 60px rgba(0,0,0,.55)` au lieu
de `var(--shadow-dialog)`, et perd ainsi sa variante Ivoire.

### Durées d'animation et de transition

Les transitions d'interface se regroupent autour de **150 ms (×16)**,
200 ms (×7) et 120 ms (×5), avec des écarts à 250, 300, 350, 400 et
450 ms. Tout le reste (2 à 90 s) appartient aux boucles décoratives des
médaillons. Proposition : `--vite: 120ms; --normal: 150ms; --lent: 400ms`.

### Règles en double exact (corps identique, sélecteurs différents)

On en compte 30 paires ou groupes. Les plus parlants :
- `display:flex; flex-direction:column; gap:10px` sur 5 sélecteurs
  (`.field`, `.join-actions`, `.quiz-list`, `.number-edit`, `.free-award`) ;
- la même pile avec `gap:12px` sur 4 et avec `gap:18px` sur 2 ;
- `.warn` = `.info` ;
- `.serif-note` = `.join-sub` ;
- `.pill.multi` = `.pill.status-active` ;
- `.import-photos` = `.observe-edit` (sept déclarations) ;
- `.duration-input` = `.position-input`.

Ce n'est pas du code mort, ce sont des composants qui s'ignorent. Une
classe utilitaire `.pile` (`--pile-gap`) en couvrirait onze.

### Les composants, tels qu'ils existent

| Famille | Variantes | Hauteur | Remarque |
|---|---|---|---|
| `.btn` | primary · accent · ghost · danger × small · big · icon · block | 44 / 36 / 58 | propre, commenté ; au moins 59 `<button>` et `<a>` l’emploient |
| `.pill-btn` (bascule) | `.active` | 36 | 7 règles |
| `.pill` (étiquette) | flash · multi · status-* · `.pill-button` | 28 | constat 10 |
| Choix en case | `.ans-btn`, `.team-btn`, `.emoji-btn`, `.finition-btn`, `.galerie-case` | — | trois recettes du « sélectionné » (constat 6) |
| Carte (surface + filet) | 22 composants, dont `.card`, `.game-card`, `.bilan-q`, `.fait`… | — | rayon 16/14/12 et remplissage 10 à 18 px selon le cas |
| Champ | `.input` · `.input-line` · `.guess-input` | 44 / — / — | trois styles, chacun justifié |
| Dialogue | `.dialog` (un seul, `Dialog.tsx`) | — | exemplaire : un composant, un voile, une ombre |
| Toast | `.toast`, `.toast-error` | — | centré par marges (le piège du CLAUDE.md est respecté) |
| Icônes | 43 noms dans `Icon.tsx`, **tous employés** | trait 1,8 px | aucune icône morte, aucun emoji d'interface |

### Échelle de jetons proposée

```css
:root {
  /* Typographie — neuf crans ; les grappes actuelles s'y rangent à ±0,5 px. */
  --t-label: 11px;      /* 10, 11, 0.68–0.75rem */
  --t-xs: 0.82rem;      /* 0.78–0.85rem, 13, 14px */
  --t-sm: 0.9rem;       /* 0.9, 0.95rem */
  --t-md: 1rem;         /* 1, 1.02rem, 16px */
  --t-lg: 1.2rem;       /* 1.1–1.25rem, 20px */
  --t-xl: 1.45rem;      /* 1.3–1.5rem, 22–24px */
  --t-2xl: 1.8rem;      /* 1.6–2rem, 27–30px */
  --t-3xl: 2.6rem;      /* 2.1–3rem, 33–44px */
  --t-scene: 3.4rem;    /* au-delà : les clamp() de la scène restent tels quels */
  --label-track: 0.22em;
  --label-track-btn: 0.14em;

  /* Couleur — ce qui manque aux 44 jetons actuels. */
  --accent-text-hover: var(--accent-hover);
  --shape-0-rgb: 217, 138, 154; --shape-1-rgb: 217, 181, 106;
  --shape-2-rgb: 169, 154, 214; --shape-3-rgb: 143, 191, 168;
  --palier-bronze: #c98b58; --palier-argent: #b9c3cf;
  --courbe-precision: #c98500; --courbe-oeil: #3987e5; --courbe-reflexe: #1f9a78;

  /* Formes et couches. */
  --radius-xs: 10px; --radius-xxs: 6px;
  --z-bandeau: 40; --z-annonce: 45; --z-toast: 50; --z-apercu: 60; --z-dialogue: 70;
  --gap-serre: 6px; --gap: 12px; --gap-large: 18px;
  --vite: 120ms; --normal: 150ms; --lent: 400ms;
  color-scheme: dark;
  accent-color: var(--accent);
}
:root[data-theme='ivoire'] {
  color-scheme: light;
  --accent-text-hover: #6b511a;              /* 6,85:1 sur la crème */
  --shape-0-rgb: 194, 86, 108; /* … les quatre, assombries comme les formes */
  --palier-bronze: #8a5a2e;                  /* 5,39:1 */
  --palier-argent: #6f7a86;                  /* 4,02:1 */
}
```

## Ce qui marche — à ne pas casser

- **Les couleurs sont un vrai système.** 44 variables, toutes vivantes. Deux
  thèmes par simple redéfinition, et le couple `--accent` /
  `--accent-text` documenté par ses contrastes mesurés (l. 124-129). Aucun
  texte au repos en `--accent`. C'est rare dans une base de cette taille,
  et c'est ce qui rend Ivoire possible en 60 lignes.
- **Les commentaires disent pourquoi.** Presque chaque exception de la
  feuille (le bouton désactivé qui ne « brunit » pas, le voile d'Ivoire
  posé sur la réponse et pas sur son compte, le fond non `fixed`) raconte
  le bug qu'elle évite. C'est la documentation du système : à garder, et à
  compléter par l'en-tête « Composants » plutôt qu'à remplacer.
- **Aucun style en ligne statique**, **aucune icône morte**, **1 % de CSS
  mort** et **zéro emoji récent** : l'hygiène est déjà là.
- **Un seul dialogue, un seul toast, une seule famille `.btn`.** Les
  variantes sont peu nombreuses et nommées par intention (primary, accent,
  ghost, danger).
- **Le mouvement réduit** est coupé par une règle globale, qui attrape aussi
  les 36 animations des médaillons.
- **Le rendu tient.** Question, révélation et console se lisent en
  1366 × 768 dans les deux thèmes. En Ivoire, la révélation est franche
  (aplat or, encre sombre) et les réponses fausses restent lisibles.

## Recommandations, dans l'ordre

1. **`color-scheme` et `accent-color` à la racine** des deux thèmes, pour
   des contrôles natifs sombres en Velours (constat 1). P3 · S.
2. **`--accent-text-hover`** pour les trois survols qui écrivent, et le
   survol du bouton principal passe de 2,5:1 à 6,85:1 en Ivoire
   (constat 2). P3 · S.
3. **Un anneau de focus global** en `:where(…):focus-visible`, qui
   remplace huit déclarations et couvre six composants oubliés
   (constat 7). P3 · S.
4. **Les filets du champagne sur les jetons** : `.btn` sur `--edge`, et les
   0,5/0,6/0,75 sur `--edge-strong`, pour qu'Ivoire les corrige aussi
   (constat 5). P3 · S.
5. **Supprimer les six classes mortes**, et **tester la règle des
   emojis** dans `server/test/emojis.test.ts`, en montant `TEAM_EMOJIS`
   dans `shared/` (constats 11 et 12). P3 · S.
6. **Jetons des récompenses** (rareté, paliers, courbes) dans les deux
   thèmes, avant qu'un écran Ivoire ne les montre (constat 8). P3 · S.
7. **L'étiquette en capitales** sur deux jetons (constat 4), et les rayons
   `--radius-xs` et `--radius-xxs` (constat 9). P3 · S.
8. **L'échelle typographique de neuf crans**, appliquée section par
   section, chaque section regardée en 360 × 640 et 1366 × 768
   (constat 3). P3 · M.
9. **Un seul état « sélectionné »**, sur `aria-pressed` et `aria-checked`
   (constat 6). P3 · M.
10. **Un en-tête « Composants »** dans `styles.css`, les noms rangés
    (`.select`, `.pill.est-cliquable`), la grille de 2 px déclarée, et les
    `z-index` et ruptures nommés (constats 10, 13 et 14). P3 · M.

Les points 1 à 7 font la journée de « gains rapides » demandée. Aucun ne
change la mise en page, et seuls les points 1, 2 et 4 changent un rendu, à
vérifier en Ivoire.

## Limites

- Les contrastes du survol (constat 2) et des paliers en Ivoire (constat 8)
  sont **calculés**, pas photographiés.
- L'anneau de focus manquant (constat 7) est lu dans le code, pas parcouru
  au clavier.
- Je n'ai pas vu :
  - la télé 1920 × 1080 ;
  - la clôture à hauts faits ;
  - les pages profil, carte et bilan ;
  - l'impression des fiches ;
  - un vrai Windows 10 (menu des `<select>`, rendu des emojis).
- Les inventaires reposent sur un découpage CSS maison, qui ne connaît pas
  la cascade : une valeur comptée peut être écrasée ailleurs. Les chiffres
  décrivent la feuille telle qu'elle est écrite, pas telle qu'elle
  s'applique.
- L'échelle proposée n'a pas été appliquée pour voir ce qu'elle déplace.
  Le « ±0,5 px » vaut pour les grappes, et un titre de scène peut réagir
  autrement.
