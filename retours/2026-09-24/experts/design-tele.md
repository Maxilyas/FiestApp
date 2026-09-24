# L'écran commun, vu du canapé — rapport de l'expert design grand écran

## En bref

L'écran commun est beau et se tient bien en 1366 × 768 dans le cas courant :
Velours est très contrasté (encre 15,5:1), la question en Cormorant à 56 px et
le chrono se lisent de loin, la victoire est une vraie scène, et le correctif
#31 (axe 3 de la première tablée) tient pour les cas qu'il visait. Mais
**l'écran ne grandit pas avec l'écran** : toutes les tailles plafonnent vers
1300 px de large, si bien qu'en 1920 × 1080 la même télé montre tout 30 % plus
petit, et les réponses y passent sous le seuil de lecture à 3 m. Et tout ce qui
n'est ni la question, ni les réponses, ni le chrono — classements, noms du
podium, « Regardez bien… », « Suivante dans 7 s », le QR du souvenir — est
écrit ou dessiné pour un écran de bureau, pas pour un canapé.

Les trois améliorations les plus rentables :
1. **Mettre l'écran commun à l'échelle de la hauteur de l'écran** (une taille
   racine en `vh` sur `/host`) — un seul geste qui relève tout en 1920 × 1080.
2. **Faire tenir le pire cas en 1366 × 768** : des réponses longues débordent
   de leur carte, et à la révélation le classement passe sous la console.
3. **Grossir ce que la salle doit lire aux moments forts** : noms du podium,
   classements, QR du souvenir, et les messages d'état (pause, enchaînement,
   « Regardez bien… ») aujourd'hui en 11 px.

## Méthode

Environ deux heures dans mon atelier (régie à moi seul, `chez-fabien`).

- **Deux quiz** écrits pour l'écran : « Le grand quiz du salon » (7 questions :
  une question de 215 caractères aux réponses de 50 à 75 caractères, une photo,
  une photo à mémoriser, deux estimations dont une avec unité, un vrai/faux, une
  question à trois réponses) et « Le pire cas » (2 questions : question longue
  + photo + réponses de 75 à 90 caractères ; estimation longue + photo + unité).
- **Une salle de 12** : 11 fantômes (Marie-Charlotte de La Rochefoucauld, Léo,
  Zoé, deux Camille, Jean-Baptiste, Ophélie, Bo, François-Xavier, Émilie, Kévin)
  et un téléphone piloté à la main, Gaspard 🦊 en 360 × 640, qui gardait les
  questions ouvertes ; **trois équipes** (Les Flamants, Piment, Les Étoiles
  filantes).
- **Quatre écrans communs capturés à chaque phase** : `fabien` (1366 × 768) et
  `fabien-tv` (1920 × 1080), chacun avec un second onglet en Ivoire — soit
  quatre captures par phase, 46 phases capturées, dans
  `export/evaluations/design-tele/planches/` (non versionné).
- **Un mesureur** (`export/evaluations/design-tele/mesure.mjs`) : un Chromium à
  part, connecté au compte, en 1366 × 768 et 1920 × 1080, qui à chaque
  changement d'écran relève chaque texte — taille, police, contraste avec le
  fond effectif, et s'il est coupé par un conteneur, hors de l'écran ou sous la
  console — et la taille des QR et des photos. 90 relevés, agrégés par
  `tailles.cjs`.
- **Lecture du code** : `client/src/styles.css`, `HostApp.tsx`,
  `HostView.tsx`, `Podium.tsx`, `theme.ts`.

**Le calcul de lisibilité.** Une télé de 140 cm (55 pouces), 16:9, fait
68,6 cm de haut. Un portable 1366 × 768 qu'on y branche est étiré : 1 px =
0,893 mm ; en 1920 × 1080, 1 px = 0,635 mm. À 3 m, on juge la **hauteur des
capitales** en minutes d'arc (ISO 9241-303 : 16′ au minimum, 20–22′ pour lire
sans effort). Hauteur de capitale ≈ 0,70 du corps pour Figtree, ≈ 0,63 pour
Cormorant Garamond (valeurs approchées). D'où, en corps CSS :

| Seuil à 3 m, télé de 140 cm | Figtree @1366 | Figtree @1920 | Cormorant @1366 | Cormorant @1920 |
|---|---|---|---|---|
| minimum (16′) | 22 px | 31 px | 25 px | 35 px |
| confortable (20′) | 28 px | 39 px | 31 px | 44 px |

**Pas couvert** : un vrai vidéoprojecteur ni une vraie télé (le rendu des
noirs, le flou, l'étirement), Windows 10 et ses emojis, 50 invités ou plus, six
équipes, la page « Les chiffres » (elle s'ouvre dans un onglet à part),
`prefers-reduced-motion` (lu dans le code seulement).

## Constats

### 1. Rien ne grandit au-delà de 1300 px : en 1920 × 1080, l'écran rapetisse
- **Où** : toutes les phases ; `client/src/styles.css:1094-1096`, `:1121`,
  `:1276`, et toutes les tailles en `rem`/`px` de l'écran commun.
- **Constat** : les tailles sont des `clamp(min, vw, max)` dont le plafond est
  atteint vers 1270–1350 px de large (`clamp(2rem, 4.4vw, 3.5rem)` plafonne à
  1273 px ; les réponses, `clamp(1.2rem, 2.4vw, 1.95rem)`, à 1300 px), et le
  reste est en `rem` fixes. Résultat mesuré : **les mêmes tailles en pixels aux
  deux définitions** (question 56 px, réponses 31,2 px, classement 16 px,
  noms du podium 20,8 px). Sur la même télé, le 1920 × 1080 montre donc tout
  30 % plus petit… et laisse des marges vides immenses : cartes de vrai/faux de
  650 px de haut pour un « Vrai » de 31 px, question bornée à 1120 px de large
  (`:1123`) qui laisse 40 % de l'écran vide à droite, bas de l'écran vide sous
  les classements en Ivoire.
- **Preuve** : tableau « Tailles mesurées » plus bas ; captures
  `16-q6-vraifaux--fabien-tv.png`, `04-q1-lecture--fabien-tv.png`,
  `05-q1-revelation--fabien-tv_iv.png` (dossier des planches) ;
  `design-tele-3-podium-1920-ivoire.jpg`.
- **Qui ça touche, ce que ça coûte** : toute la salle, dès que l'écran commun
  tourne en 1920 × 1080 — une télé branchée à un PC récent, un Chromecast, une
  smart TV. Les réponses tombent à **15,9′** (sous le minimum), le classement à
  **8′**. Paradoxe : une meilleure définition donne un jeu moins lisible.
- **Statut** : bug confirmé (de mise à l'échelle).
- **Piste** : faire dépendre la taille racine de la **hauteur** de l'écran, sur
  `/host` seulement — là où `applyTheme()` pose déjà l'habillage
  (`client/src/main.tsx:70`) :
  ```css
  /* L'écran commun se lit à la hauteur de l'écran : 16 px en 768, 22,5 en 1080. */
  html:has(.host) { font-size: max(16px, calc(100vh / 48)); }
  ```
  puis passer en `rem` les tailles encore en `px` de la scène (réponses,
  classements, pastilles, console), et relever les plafonds des `clamp` (ou
  les remplacer par des `rem`, qui suivent désormais la hauteur). Vérifier
  ensuite les deux tailles de référence — 1366 × 768 ne doit pas bouger.
- **Priorité · effort** : P1 · M.

### 2. Le pire cas déborde en 1366 × 768 : réponses coupées, classement sous la console
- **Où** : question longue avec photo et réponses longues, en question puis en
  révélation ; `.quiz-host .ans-btn` (`styles.css:1271-1277`), la règle
  `max-height: 820px` (`:4240` et suivantes).
- **Constat** :
  - **En question**, les réponses sur trois lignes sortent de leur carte : la
    première ligne colle au bord haut, la dernière est rognée par le bas
    (« le glaçage blanc du gâteau », jambages coupés). La carte n'a **aucune
    marge verticale** (`padding: 0 30px`) et sa hauteur est imposée par la
    grille.
  - **À la révélation**, les classements n'ont plus la place : « Les équipes »
    montre une ligne et demie, et la seconde (« Piment ») **se dessine sous la
    console, visible derrière le bouton « Question suivante »** ; côté « Top du
    quiz », la ligne de Kévin (y = 696 px) chevauche la console (y = 710 px) et
    le bouton « 20 s ».
  - Même sans photo, la question de 215 caractères du premier quiz ne laisse à
    la révélation qu'une ligne et demie d'équipes (`05-q1-revelation--fabien.png`).
- **Preuve** : `retours/2026-09-24/experts/captures/design-tele-1-reponses-debordent-1366.jpg`,
  `retours/2026-09-24/experts/captures/design-tele-2-classement-sous-console-1366.jpg` ;
  relevé `mesures/029-1366.json` : six textes « sous la console et non coupés »
  (Rang, 1, 📱, Kévin, 200). Pour rejouer : le second quiz de
  `export/evaluations/design-tele/liste2.txt`, 12 joueurs, trois équipes.
- **Qui ça touche, ce que ça coûte** : toute la salle, à chaque question
  bavarde — et une liste écrite par une IA (« Coller une liste ») en produit
  volontiers. Les réponses, c'est ce qu'on lit pour jouer.
- **Statut** : bug confirmé. Le correctif #31 tient pour les cas qu'il visait
  (voir « Axe 3 » plus bas), pas pour celui-ci.
- **Piste** :
  - une marge verticale aux cartes : `padding: 12px 30px` ;
  - un palier de taille des réponses, comme la question (`questionSize.ts`) :
    si une réponse dépasse ~60 caractères, `ans-sm` à ~0,8 × ;
  - la scène en colonne flexible au-dessus de la console, jamais dessous :
    `.host.staging` en grille `auto 1fr auto` dont la rangée du milieu a
    `min-height: 0; overflow: hidden`, et les classements qui s'y logent
    (`.reveal-boards { min-height: 0; overflow: hidden }`) plutôt que de pousser ;
  - un fond opaque à la console (`background: var(--bg)`) pour qu'un
    débordement se coupe au lieu de se superposer ;
  - un test de rendu : le smoke ou `server/test/` n'en ont pas, mais la tablée
    peut rejouer ce quiz en 1366 × 768 à chaque retouche de l'écran commun.
- **Priorité · effort** : P1 · S (marges, fond de console) à M (grille).

### 3. Les moments forts sont écrits trop petit : podium, classements
- **Où** : `.podium-name` (`styles.css:1540`, 1,3 rem = 20,8 px),
  `.podium-points` (24 px), `.lb-name` (16 px), `.lb-score` (21,6 px),
  `.team-sub` (12 px), `.guess-value` (18,4 px).
- **Constat** : au podium du quiz, à celui de la soirée et à la clôture, **les
  prénoms des trois gagnants font 20,8 px**, sous des marches de 300 à 400 px
  de haut qui n'affichent qu'un rang et un score. À 3 m : **13,4′ en 1366,
  9,5′ en 1920** — sous le minimum. Les classements (révélation, podium,
  victoire, salle d'attente) sont en 16 px (8–11′) ; les estimations révélées,
  en 18,4 px. Seul l'écran de victoire est taillé pour la salle (nom de
  l'équipe en 64 px, 41′).
- **Preuve** : `21-podium-t1--fabien.png`, `23-podium-t11--fabien-tv_iv.png`
  (`design-tele-3-podium-1920-ivoire.jpg`), `32-cloture-t8--fabien.png` ; tableau
  des tailles.
- **Qui ça touche** : toute la salle au seul moment où elle regarde toute
  ensemble l'écran. Aujourd'hui, c'est la voix de l'animateur qui annonce les
  gagnants ; l'écran ne fait que confirmer.
- **Statut** : friction forte.
- **Piste** : sur la scène (`.host.staging`), noms du podium à 2,6 rem
  (≈ 42 px en 768, 28′), scores à 2 rem ; lignes de classement à 1,35 rem
  (22 px) avec le sous-titre (« 4 membres · 2967 pts au total ») retiré de la
  télé ou fondu dans une infobulle de la console : c'est un chiffre pour
  l'animateur. Les marches peuvent céder 30 % de leur hauteur aux noms.
- **Priorité · effort** : P2 · S.

### 4. Les QR ne se scannent pas du canapé
- **Où** : salle d'attente (`.invite-qr`), bande d'état (`.qr-box svg`, 46 px,
  `styles.css:853`), QR du souvenir au podium et à la clôture (`.scene-qr .qr-box
  svg`, `clamp(84px, 11vh, 124px)`, `:4149`).
- **Constat** : mesurés — **salle d'attente 148 px aux deux définitions**
  (13,2 cm sur la télé en 1366, 9,4 cm en 1920) ; **souvenir 84 px en 1366,
  119 px en 1920** (7,5 cm dans les deux cas) ; bande 46 px (4,1 / 2,9 cm).
  Règle usuelle : un QR se lit jusqu'à dix fois sa largeur. Le souvenir se
  scanne donc à **75 cm**, celui de l'accueil à 1,3 m au mieux.
- **Preuve** : relevés `mesures/013-1366.json`, `avant/055-1920.json`,
  `045-1366.json`, `046-1920.json` (champ `qr`) ; `32-cloture-t8--*.png`.
- **Qui ça touche** : à l'arrivée, les invités s'approchent de la télé de toute
  façon — tolérable. À la **clôture**, tout le monde est assis, et le QR du
  souvenir est le dernier geste que l'écran demande : douze personnes qui se
  lèvent l'une après l'autre, ou qui ne le font pas.
- **Statut** : friction (non mesuré sur un vrai téléphone à 3 m : à vérifier).
- **Piste** : à la clôture, le QR du souvenir au centre et en grand
  (`min(34vh, 360px)`, ≈ 30 cm sur la télé, lisible à 3 m), le podium à côté ;
  les hauts faits peuvent passer au second plan (ils sont aussi sur chaque
  téléphone). En salle d'attente, le QR à `min(40vh, 420px)` : il est seul au
  centre, la place est là.
- **Priorité · effort** : P2 · S.

### 5. Ce que la salle doit savoir s'écrit en 11 px
- **Où** : `.pill` (11 px, `HostView.tsx`), `.band-answered` (14 px), le chrono
  en pause.
- **Constat** : les messages d'état de la scène sont des pastilles de 11 px
  (**5,6′ à 7,9′** à 3 m) :
  - « **Regardez bien…** » pendant la photo à mémoriser — c'est la seule
    consigne de la phase, et la photo occupe l'écran sans question : sans la
    lire, la salle ne sait pas qu'il faut retenir ;
  - « **Suivante dans 7 s** » pendant l'enchaînement automatique ;
  - « Kévin — 1.11 s », le plus rapide (un petit moment de gloire perdu) ;
  - **la pause** : seul le chiffre du chrono devient une icône ⏸ de 20 px ; rien
    ne dit « En pause » à la salle (`14-pause--*.png`) ;
  - « **11 / 12 ont répondu** », la seule information vivante pendant la
    question, est en 14 px dans la bande — alors que l'écran d'une estimation
    est vide aux trois cinquièmes (`11-q4-estimation--fabien.png`).
- **Qui ça touche** : toute la salle, à chaque question.
- **Statut** : friction.
- **Piste** : un **bandeau d'état de scène** unique sous le chrono, en serif
  à 1,6 rem, qui dit l'état en mots — « Regardez bien : la photo va
  disparaître », « En pause », « Question suivante dans 7 s » (avec la barre du
  chrono qui se vide), « Kévin a répondu le plus vite : 1,11 s ». Et pendant
  une estimation, le compte des réponses en grand au centre (« 11 / 12 »), qui
  meuble l'attente et pousse les retardataires.
- **Priorité · effort** : P2 · S.

### 6. En Velours, le nombre de ceux qui se sont trompés tombe à 2,4:1
- **Où** : `styles.css:78-81`, `:149-154`, `:1308-1309`.
- **Constat** : à la révélation, une mauvaise réponse est voilée. En Ivoire, le
  voile ne couvre que le texte (`--dim-contenu`) — le commentaire l'explique :
  « à 50 %, le nombre de ceux qui s'y sont trompés tombait à 1,7:1, alors que
  c'est ce que la salle cherche des yeux ». **En Velours, c'est toute la carte
  qui est voilée à 0,38** (`--dim-carte: var(--dim)`), compte compris : champagne
  voilé sur noir = **2,39:1**, formes voilées ≈ 2,1:1. Au vrai/faux « 6 contre
  6 », le 6 de la bonne réponse se lit, l'autre à peine
  (`17-q6-revelation-auto--fabien.png`).
- **Statut** : bug confirmé (le correctif d'Ivoire n'a pas été porté à Velours).
- **Piste** : en Velours aussi, voiler le contenu et pas le compte :
  ```css
  :root { --dim-carte: 1; --dim-contenu: var(--dim); }
  ```
  (et vérifier que la carte reste lisiblement « éteinte » : le fond de la
  carte peut passer à `--surface-faint`).
- **Priorité · effort** : P2 · S.

### 7. Les scènes de fin n'existent que sur la page qui les a ouvertes
- **Où** : `client/src/views/HostApp.tsx:242` (`screen`, un état local),
  `:272-274`, `:607-624`.
- **Constat** : Podium, Remise des prix, Victoire et la clôture sont un état de
  la page, pas de la soirée. Avec deux écrans communs ouverts sur le même
  compte (le portable de l'animateur et la télé, ou la console reprise sur un
  second appareil), **« Victoire » cliqué sur le portable laisse la télé en
  salle d'attente**. Pire : la clôture, elle, s'affiche partout — mais ne s'en
  va que sur l'écran où l'on clique « La soirée suivante » ; **la télé est
  restée sur « Soirée close » pendant tout le quiz suivant** (bande : « Le pire
  cas · Soirée close · 12 connecté·e·s »). Rejoué : `41-pire-q1-revelation--fabien-tv.png`.
- **Qui ça touche** : l'animateur qui pilote depuis un autre appareil que celui
  branché à la télé — précisément ce que la première tablée recommandait
  (axe 2, « la console sur le téléphone de l'animateur »), et ce qu'un
  animateur fait déjà d'instinct pour « animer debout ».
- **Statut** : bug confirmé (sur deux écrans) ; sur un seul écran, rien.
- **Piste** : faire de la scène de fin un état de la soirée, diffusé comme la
  phase (une commande `host:scene` qui pose `scene` dans l'instantané — il ne
  change pas à chaque tick, l'invariant 4 est sauf), et effacer la clôture
  d'un écran dès qu'un quiz démarre (`quizView.phase !== 'pickPack'`). À
  défaut, au minimum : `setScreen(null)` quand une question commence.
- **Priorité · effort** : P2 · S (le minimum) à M (la scène partagée).

### 8. La télé montre encore les coulisses (axe 2 de la première tablée : non résolu)
- **Où** : salle d'attente, Remise des prix, podium de soirée, console.
- **Constat** : la salle d'attente projette des listes déroulantes d'équipe,
  des boutons d'exclusion et « Ajouter » ; la Remise des prix est un tableau de
  dix cartes en 12–15 px, avec une consigne pour l'animateur (« un prix ne
  rapporte rien tant que tu ne cliques pas… ») et **tous les lauréats visibles
  d'un coup** ; le panneau des équipes affiche une note technique coupée en
  plein mot (« Le chiffre cerclé : le barème, prix compris — il range les
  équipes… », `01-attente--fabien-tv_iv.png`). Attribuer un prix ne fait rien
  à l'écran : seul « + 1 de prix » en 12 px apparaît sous l'équipe. La console
  est projetée (« Annuler les points », « Terminer »).
- **Statut** : tension avec un parti pris — l'écran commun est aussi la
  console (README, « L'écran commun a deux repères fixes ») ; relevé par la
  première tablée, pas encore traité.
- **Piste** : la remise **un prix à la fois**, en scène (icône 128 px, titre
  64 px, lauréat 48 px, motif), les autres en attente ; dans la salle
  d'attente, les contrôles d'équipe repliés derrière un bouton « Organiser »
  de la console ; les notes explicatives hors de la télé (infobulle).
- **Priorité · effort** : P3 · M (remise en scène) ; S (repli des contrôles).

### 9. De la place perdue qui pourrait servir la lecture
- **Constat** :
  - photo à mémoriser : 570 × 428 px en 1366 (56 % de la hauteur), alors
    qu'elle est seule à l'écran pendant l'observation (`08-q3-observation--fabien.png`) ;
  - estimation en cours : trois cinquièmes de l'écran vides
    (`11-q4-estimation--*.png`) ;
  - vrai/faux : deux cartes de 905 × 650 px pour « Vrai » et « Faux » en 31 px ;
  - salle d'attente : les prénoms coupés à 9 caractères (« Marie-Char… »,
    « Jean-Bapti… », `styles.css:1005`) même en 1920, où la colonne a la place ;
    et en 1366 la troisième équipe et le classement passent sous le bas de leur
    panneau.
- **Piste** : photo d'observation à `max-height: calc(100vh - 220px)` ; en
  vrai/faux (deux réponses), texte des réponses à 2× et centré ; `max-width`
  des prénoms en `ch` relevé à 16 dès 1600 px.
- **Priorité · effort** : P3 · S.

### 10. Un podium qui ne fait pas podium quand les scores sont serrés
- **Où** : `client/src/components/Podium.tsx:75` — `height: 30 + 70 × points / meilleur`.
- **Constat** : à 1030 / 882 / 828 points, les marches font 100 / 90 / 86 % : trois
  blocs presque égaux, coupés net en bas, sans sol (`21-podium-t1--fabien.png`).
  Quand les écarts sont grands (395 / 230 / 108), c'est un vrai podium.
- **Statut** : idée (la proportionnalité est un choix ; elle dit l'écart).
- **Piste** : des marches fixes par rang (100 / 78 / 62 %), l'écart dit par les
  scores ; ou un minimum d'écart visuel de 12 % entre deux rangs distincts.
- **Priorité · effort** : P3 · S.

### 11. Mise en scène : une révélation sans suspense
- **Constat** : la bonne réponse passe en champagne avec un petit `pop` de
  0,4 s ; le podium monte d'un bloc (0,65 s) ; les trois marches arrivent
  ensemble. Les animations restent sobres et se coupent bien sous
  `prefers-reduced-motion` (`styles.css:1841`).
- **Statut** : idée.
- **Piste** : au podium, 3ᵉ puis 2ᵉ puis 1ᵉʳ, une seconde d'écart, le nom du
  premier en dernier (le son `fanfare` existe déjà) ; à la révélation, les
  mauvaises réponses qui s'éteignent d'abord, la bonne qui s'allume ensuite.
- **Priorité · effort** : P3 · S.

## Mesures et cartes

### Tailles mesurées face aux tailles lisibles (télé de 140 cm à 3 m)

Hauteur de capitale en minutes d'arc. ✅ ≥ 20′ · 🟡 16–20′ · ❌ < 16′.
Contraste : le plus faible relevé en Velours.

| Élément | Police | px @1366 | px @1920 | @1366 | @1920 | Contraste |
|---|---|---|---|---|---|---|
| Valeur à trouver (estimation) | Cormorant | 80 | 104 | ✅ 51,6′ | ✅ 47,7′ | 9,3:1 |
| Nom de l'équipe gagnante | Cormorant | 64 | 64 | ✅ 41,3′ | ✅ 29,3′ | 9,3:1 |
| Chrono | Cormorant | 54 | 66 | ✅ 34,8′ | ✅ 30,3′ | 9,3:1 (5,7 en rouge) |
| Question courte | Cormorant | 56 | 56 | ✅ 36,1′ | ✅ 25,7′ | 15,5:1 |
| Adresse d'invitation (salle d'attente) | Cormorant | 41,6 | 41,6 | ✅ 26,8′ | 🟡 19,1′ | 15,5:1 |
| Question longue (`q-sm`, > 120 car.) | Cormorant | 35,2 | 35,2 | ✅ 22,7′ | 🟡 16,1′ | 15,5:1 |
| Réponses (QCM) | Figtree | 31,2 | 31,2 | ✅ 22,4′ | ❌ 15,9′ | 15,5:1 |
| Consigne d'estimation (« Tapez… ») | Cormorant italique | 32 | 32 | ✅ 20,6′ | ❌ 14,7′ | 6,7:1 |
| Compte d'une réponse (révélation) | Cormorant | 27,2 | 27,2 | 🟡 17,5′ | ❌ 12,5′ | **2,4:1 si voilée** |
| Points au podium | Cormorant | 24 | 24 | ❌ 15,5′ | ❌ 11,0′ | 9,3:1 |
| Score dans un classement | Cormorant | 21,6 | 21,6 | ❌ 13,9′ | ❌ 9,9′ | 9,3:1 |
| **Prénoms du podium** | Cormorant | 20,8 | 20,8 | ❌ 13,4′ | ❌ 9,5′ | 15,5:1 |
| « La photo a disparu — de mémoire ! » | Cormorant italique | 19,2 | 19,2 | ❌ 12,4′ | ❌ 8,8′ | 9,3:1 |
| Estimations révélées | Cormorant | 18,4 | 18,4 | ❌ 11,9′ | ❌ 8,4′ | 15,5:1 |
| Prénom dans un classement | Figtree | 16 | 16 | ❌ 11,5′ | ❌ 8,2′ | 15,5:1 |
| Lauréat d'un prix | Figtree | 15,2 | 15,2 | ❌ 10,9′ | ❌ 7,7′ | 15,5:1 |
| « 11 / 12 ont répondu » (bande) | Figtree | 14 | 14 | ❌ 10,0′ | ❌ 7,1′ | 15,5:1 |
| Sous-titre d'équipe (« 4 membres · … ») | Figtree | 12 | 12 | ❌ 8,6′ | ❌ 6,1′ | 6,7:1 |
| Pastilles : « Regardez bien… », « Suivante dans 7 s », le plus rapide | Figtree | 11 | 11 | ❌ 7,9′ | ❌ 5,6′ | 6,7–9,3:1 |

Lecture : **tout ce qui est plus petit que la réponse d'un QCM ne se lit pas
du canapé**, et en 1920 × 1080 même la réponse passe sous le seuil. Le
contraste, lui, n'est presque jamais en cause.

### Contrastes des jetons (calculés)

| Couple | Velours | Ivoire |
|---|---|---|
| Encre / fond | 15,5:1 | 14,6:1 |
| Texte atténué (`--muted`) / fond | 6,7:1 | 4,7:1 |
| Champagne texte (`--accent-text`) / fond | 9,3:1 | 5,1:1 |
| Texte sur aplat champagne (bonne réponse) | 9,3:1 | 5,4:1 |
| Mauvaise réponse voilée : texte | 3,2:1 | 3,1:1 |
| Mauvaise réponse voilée : **son compte** | **2,4:1** | 14,6:1 (non voilé) |
| Formes ▲ ◆ ● ■ / fond | 7,0 – 9,3:1 | 3,1 – 4,3:1 |

Le losange champagne d'Ivoire (`#ac8536`) reste le plus faible à 3,1:1 : il
passe le seuil des éléments graphiques (3:1), de peu.

### Planches, phase par phase

Toutes les captures (quatre par phase : 1366 et 1920, Velours et Ivoire) sont
dans `export/evaluations/design-tele/planches/<n>-<phase>--<écran>.png`.

| Phase | 1366 × 768 | 1920 × 1080 | Verdict |
|---|---|---|---|
| Salle d'attente (01, 24) | Console sur une ligne ✅ ; 3ᵉ équipe et classement coupés dans leur panneau ; prénoms coupés à 9 car. | Tout tient, QR 148 px au centre d'un panneau de 1160 px ; note « Le chiffre cerclé… » coupée | 🟡 coulisses (constat 8), QR (4) |
| Choix du quiz (02) | Bibliothèque et barème projetés | idem | 🟡 coulisses |
| Préparation 3-2-1 (03) | Beau : chiffre géant, « Préparez vos téléphones… » | idem | ✅ |
| Question longue (04, 40) | Question 35 px, réponses 31 px au même niveau ; **réponses de 3 lignes qui débordent** | Réponses 31 px dans des cartes de 320 px | ❌ (2), (1) |
| Question photo (06, 19) | Photo 368 × 275, bonne hiérarchie | Photo 575 × 430 | ✅ |
| Photo à mémoriser (08, 09) | Photo à 56 % de la hauteur ; « Regardez bien… » en 11 px | idem | 🟡 (5), (9) |
| Estimation (11, 13) | Trois cinquièmes vides ; unité « (en m) » dans la consigne | idem | 🟡 (5) |
| Vrai / faux (16) | Correct | Cartes géantes, texte petit | 🟡 (9) |
| Révélation QCM (05, 07, 10, 17) | Photo réduite : équipes + top visibles ✅ ; question longue : 1,5 ligne d'équipes ; compte voilé 2,4:1 | Place perdue en bas | 🟡 (6) |
| Révélation estimation (12, 15) | 5 estimations visibles sur 12, liste qui défile ; unité bien posée (« 4 806 m ») | 8 visibles | ✅ |
| Révélation, pire cas (41) | **Classement sous la console** | Correct | ❌ (2) |
| Pause (14) | Seule l'icône du chrono change | idem | ❌ (5) |
| Enchaînement auto (17, 18) | « Suivante dans 7 s » en pastille de 11 px | idem | ❌ (5) |
| Podium du quiz (21-23, 44) | Prénoms 20,8 px ; « Les équipes après ce quiz » visible ✅ | idem, dans une page plus grande | 🟡 (3), (10) |
| Remise des prix (25, 26) | Tableau de 10 cartes, la 10ᵉ coupée | idem | ❌ coulisses (8) |
| Victoire (27b, 28, 45) | Belle scène : piment 128 px, « Piment » 64 px ; 4 joueurs visibles | 10 joueurs | ✅ (seul écran taillé pour la salle) |
| Podium de soirée (29) | QR souvenir 84 px ; note explicative projetée | QR 119 px | 🟡 (4), (8) |
| Clôture (31, 32, 46) | QR du souvenir **entier** ✅ mais 84 px ; hauts faits qui défilent | QR 119 px | 🟡 (4) |
| Entre deux soirées (après clôture) | — | **La télé reste sur « Soirée close »** pendant le quiz suivant | ❌ (7) |

### Axe 3 de la première tablée (corrigé par #31) : ce qui tient

| Relevé du 23 septembre | Aujourd'hui |
|---|---|
| Révélation d'une question à photo : la console couvre la 2ᵉ rangée, équipes et top sous l'écran | ✅ **tient** : photo en vignette, trois équipes et 4,5 lignes de top visibles (`07`) |
| Podium du quiz : « Les équipes après ce quiz » ne montre que son titre | ✅ **tient** (`21`) |
| Clôture : le QR du souvenir coupé | ✅ **tient** : entier (`32`, `46`) — mais trop petit pour le canapé (constat 4) |
| Salle d'attente après un quiz : console sur deux lignes | ✅ **tient** : une ligne (`24`) |
| — | ❌ **ne tient pas** pour une question longue + photo + réponses longues (constat 2) |

### Cohérence avec les téléphones

Les formes, leurs couleurs et l'ordre des réponses sont les mêmes au téléphone
et à l'écran (`tel-q2-photo`) ; la révélation du téléphone (« +200 pts · Tu as
dit 1887 — à 2 près ») répond bien à celle de l'écran. Rien à signaler.

## Ce qui marche — à ne pas casser

- **Le contraste de Velours** : encre 15,5:1, champagne 9,3:1. Ce n'est jamais
  la couleur qui empêche de lire, c'est la taille.
- **La question en Cormorant à 56 px** et ses trois paliers (`questionSize.ts`) :
  une question courte se lit du fond de la pièce.
- **Le chrono** : ligne fine + grand chiffre, qui passe au rouge ; lisible à
  35′.
- **La valeur à trouver d'une estimation** (80–104 px) et l'unité à côté ; la
  liste des estimations, rangée, avec « +200 ».
- **L'écran de victoire** : la seule scène vraiment taillée pour la salle —
  s'en inspirer pour le podium et la remise des prix.
- **La photo qui se réduit à la révélation** (#31) : le bon arbitrage.
- **Le 3-2-1 « Préparez vos téléphones… »** : simple, lisible, efficace.
- **Ivoire** : un vrai second habillage, pas une inversion ; le voile qui
  épargne le compte (à porter à Velours, constat 6).
- **La console sur une ligne** en 1366, et des animations sobres qui se
  coupent sous `prefers-reduced-motion`.
- **Les homonymes** : « Camille » et « Camille (2) » s'affichent proprement
  partout, sans casser les colonnes.

## Recommandations, dans l'ordre

1. **Taille racine de l'écran commun en fonction de la hauteur**
   (`max(16px, 100vh / 48)`), plafonds des `clamp` relevés, tailles de scène en
   `rem` — P1 · M (constat 1).
2. **Faire tenir le pire cas en 1366** : marge verticale aux cartes, palier de
   taille pour les réponses longues, scène qui ne passe jamais sous la console,
   console opaque — P1 · S à M (constat 2).
3. **Porter le voile d'Ivoire à Velours** : `--dim-carte: 1; --dim-contenu:
   var(--dim)` — P2 · S (constat 6). Deux lignes.
4. **Un bandeau d'état de scène lisible** : « Regardez bien », « En pause »,
   « Question suivante dans 7 s », le plus rapide ; et le compte des réponses
   en grand pendant une estimation — P2 · S (constat 5).
5. **Grossir podium et classements** : prénoms du podium ≥ 2,6 rem, lignes de
   classement ≥ 1,35 rem, sous-titres retirés de la télé — P2 · S (constat 3).
6. **QR du souvenir au centre et en grand à la clôture**, QR d'accueil agrandi —
   P2 · S (constat 4).
7. **Scène de fin partagée entre écrans**, au minimum `setScreen(null)` au
   départ d'un quiz — P2 · S à M (constat 7).
8. **Remise des prix en scène, un prix à la fois ; contrôles de la salle
   d'attente repliés** — P3 · M (constat 8, axe 2 de la première tablée).
9. **Place perdue** : photo d'observation plus grande, vrai/faux en grand,
   prénoms moins coupés — P3 · S (constat 9).
10. **Podium à marches fixes et révélation en trois temps** — P3 · S
    (constats 10 et 11).

Avant tout cela, une habitude : **regarder l'écran commun en 1920 × 1080 aussi
souvent qu'en 1366 × 768**, avec « Le pire cas » (`export/evaluations/design-tele/liste2.txt`,
à recopier dans un endroit versionné si l'équipe l'adopte).

## Limites

- Les seuils de lecture sont calculés (ISO 9241-303, hauteurs de capitale
  approchées) pour une télé de 140 cm à 3 m ; pas vérifiés devant une vraie
  télé ni un vidéoprojecteur, où le flou et l'étirement d'un 1366 × 768 retirent
  encore de la netteté.
- La portée des QR suit la règle « dix fois la largeur » : un téléphone récent
  zoomé fait mieux ; à vérifier avec deux ou trois téléphones réels.
- Chromium sous Linux : ni Windows 10 (ses emojis, sa police de repli), ni
  l'écran d'une smart TV.
- Une salle de 12 et trois équipes : 50 invités ou six équipes chargeraient
  encore la salle d'attente et les classements.
- Le constat 7 suppose deux écrans communs ouverts ; sur un seul, il n'existe
  pas.
- Un défaut apparent en cours d'atelier — les onglets Ivoire repassés en
  Velours — venait de mon banc (mon geste « toucher Revenir » a pris le bouton
  « Revenir au fond sombre ») : écarté, rien dans l'application.
