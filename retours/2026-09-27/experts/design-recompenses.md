# Les récompenses à l'écran — rapport de l'expert design-recompenses

## En bref

Ce que #58 et #59 ont mis à l'écran est beau et tient dans le cas courant
d'un téléphone de 360 px au texte normal. On y trouve la grille unique des
avatars, les fonds de carte, les écussons, le laurier, le Sphinx et les
légendaires de saison. Sur l'écran commun, le laurier grandit avec la scène
(× 1,41 entre 1366 et 1920). Il reste entier dans les listes coupées
(`Coupe`), se lit à 8,6:1 en Velours et à 5,3:1 en Ivoire, et le mouvement
réduit fige tout. Le défaut vient dès qu'on quitte ce cas courant : un
téléphone de 320 px, ou le texte agrandi à 130 %. L'onglet « Carrière » du
profil sort de l'écran et ne se touche plus : c'est là que vivent
l'identifiant et le mot de passe. Au classement et au podium du téléphone,
les lauréats perdent leur prénom, puis leur laurier. Les trois
améliorations les plus rentables, chacune essayée dans le navigateur (le
fichier `pistes.css` fait passer les trois épreuves) :

1. des onglets qui cèdent de la place (`grid-auto-columns: minmax(0, 1fr)`) ;
2. une ligne de classement qui passe sur deux rangs sous 250 px de large ;
3. des silhouettes de collection claires plutôt que noires. Aujourd'hui,
   noires sur une case sombre, elles ne se détachent qu'à 1,1:1.

## Méthode

Environ deux heures et demie. J'ai tout rejoué sur mon propre banc, dans
`export/evaluations/design-recompenses/`, avec le client construit dans ce
dossier (`vite build --outDir …/dist`) et servi par `demarrer({ clientDist })`.
Un seul Chromium à la fois, sous `nice -n 10`. La charge de la machine est
notée à côté de chaque mesure de temps.

**Les profils** (`profils.ts`) sont écrits dans la base permanente, comme le
font `fonds.test.ts`, `ecussons.test.ts`, `carte.test.ts`, `sphinx.test.ts`
et `rendu-ecran.ts`.
- **Marie-Charlotte Lefebvre** : 24 caractères, soit le maximum. Niveau 25
  (Constellation), les douze légendaires, le Sphinx et les trois de saison,
  deux Divins, l'Éclat sur le Phénix qu'elle porte. Les quatre fonds (elle
  porte le théâtre), douze écussons mêlés (quatre or, quatre argent, trois
  bronze, un rien), une vitrine choisie, le titre le plus long (« L'Ascenseur
  Émotionnel ») et le laurier.
- **Guillaume-Maxime Wawrzyn** : niveau 20, l'Aurore, la Citrouille portée,
  le laurier.
- **Ophélie** : niveau 17, 🪐, la Nuit étoilée, le laurier.
- **Bo** : Hélios porté, le Kintsugi.
- **Deux Camille homonymes**, dont une lauréate.
- **Léa** : à 20 XP du niveau 9, pour voir s'ouvrir un emoji de collection.
- **Zoé** : un profil tout neuf.
- Deux anonymes au banc, et deux anonymes dans de vrais navigateurs.

**Les appareils :**
- téléphone 360 × 640 (Velours) ;
- 320 × 568 ;
- 277 × 492 à `deviceScaleFactor` 2,6, soit un 360 × 640 au texte à 130 % :
  c'est le zoom de page de Chrome Android, qui a remplacé son réglage
  « taille du texte » ;
- mouvement réduit ;
- écran commun en 1366 × 768 et 1920 × 1080, en Velours puis en Ivoire.

Le téléphone ne prend jamais Ivoire (`theme.ts` : seul `/host` l'applique).
« Ivoire au téléphone » est donc sans objet.

**Les scripts écrits** (tous dans `export/evaluations/design-recompenses/`) :

| Fichier | Rôle |
|---|---|
| `outils.ts` | Le banc, l'écriture en base et le relevé `RELEVE` : débordements, lauriers coupés, prénoms coupés, textes de moins de 12 px. Aussi `contrastesSurFond` : le texte est caché, on photographie, on lit les pixels du fond réel. |
| `profils.ts` | Les huit profils. |
| `01-profils.ts` | Les trois onglets de trois profils, en 360 et à 130 %, la légende d'un légendaire ou d'un Divin, le mouvement réduit. |
| `02-soiree.ts [ivoire]` | Une soirée de douze : salle d'attente, révélations, estimation, podium, classement, podium de soirée, victoire, clôture. Aussi les cartes sur chaque fond, avec le contraste de chaque texte, et la fin de soirée de Léa et de Marie-Charlotte. |
| `03-saison.ts` | Halloween au quiz du jour : la carte de la saison, puis la Citrouille qui s'ouvre. |
| `sonde-onglets.ts`, `sonde-classement.ts`, `sonde-profil.ts`, `sonde-animations.ts`, `sonde-grille.ts`, `sonde-silhouettes.ts` | Les mesures ciblées (`PISTES=1` injecte `pistes.css`). |
| `couleurs.mjs` | Contrastes et écarts de teinte calculés sur les jetons (WCAG, CIE Lab, Machado 2009 pour la deutéranopie). |
| `rendu-ecran-copie.ts` | `server/scripts/rendu-ecran.ts` à l'identique, sauf `clientDist` et les chemins, lancé avec `MESURE=1`. Sortie : `rendu/mesure.txt` et 40 captures. |
| **`design-recompenses.test.ts`** | **La reproduction.** Trois épreuves `node:test` qui échouent aujourd'hui et passent avec `PISTES=1`. |

**Les fichiers lus :**
- les composants : `Apparence.tsx`, `Trophees.tsx`, `Carriere.tsx`,
  `CarteJoueur.tsx`, `Ecusson.tsx`, `Laurier.tsx`, `Avatar.tsx`,
  `Niveau.tsx`, `Podium.tsx`, `Leaderboard.tsx`, `Rank.tsx` ;
- les vues et le quiz : `views/ProfilApp.tsx`, `views/JourApp.tsx`
  (classement et saison), `views/HostApp.tsx` (pastilles, victoire),
  `games/quiz/Course.tsx`, `HostView.tsx` (estimations), `PlayerView.tsx`
  (podium) ;
- les données et le thème : `shared/fonds.ts`, `shared/avatars.ts`,
  `shared/legendaires.ts`, `shared/hautsfaits.ts`, `theme.ts` ;
- les styles : `git diff a6fc98b..b57035c -- client/src/styles.css`, en
  entier (#58 et #59) ;
- la documentation : `RECOMPENSES.md` §§ 5.4 à 5.6 et 5.13, le README
  (« La direction ») ;
- les rapports précédents : les trois de design du 24 septembre, et
  `recompenses-vitrine.json`, dont je ne reprends aucun constat.

**Ce que je n'ai pas couvert :**
- un vrai Android ni un iPhone : le texte agrandi est émulé par le viewport ;
- Windows 10 réel (les emojis sont rendus par les polices de Linux) ;
- `prefers-reduced-transparency` ;
- l'impression.

Le quiz du jour n'est vu que pour la saison et le laurier : son écran est à
`jour-ecran`.

## Constats

### 1. Au texte agrandi, l'onglet « Carrière » du profil sort de l'écran, et le mot de passe avec lui

- **Où** : `/profil` et l'accueil d'un profil connecté.
  - La règle : `client/src/styles.css:5220-5229`
    (`.onglets { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr }`).
  - Les onglets : `views/ProfilApp.tsx:424-443` (la barre, l. 426).
  - « Identifiant et mot de passe » ne vit que dans cet onglet :
    `ProfilApp.tsx:361-363`.
- **Constat** : `1fr` vaut `minmax(auto, 1fr)`. Aucune colonne ne descend
  sous sa largeur minimale (icône, puis « Apparence » d'un seul mot), et la
  barre garde toujours 303 px de contenu :
  - en 360 px, elle en a 318 : tout tient ;
  - en 320 px, elle n'en a que 278, et « Carrière » va de 235 à 324 px. Il
    est coupé au bord de l'écran (« Carriè ») ;
  - en 277 px (un 360 au texte à 130 %), son centre tombe hors de l'écran,
    et la page ne défile pas en largeur. Le toucher ne l'atteint plus :
    Playwright échoue (« intercepts pointer events »).

  Trois choses deviennent inaccessibles au doigt : la fiche, « Mes
  soirées », et le changement de mot de passe.
- **Preuve** :
  - `captures/sonde-onglets-277.png` (« Ca » au bord), `sonde-onglets-320.png` ;
  - `notes-01-profils.json` : `onglet-inatteignable-riche-zoom-carriere: true`,
    `deborde: ["button.onglet 324"]` ;
  - épreuve 1 de `design-recompenses.test.ts` :
    `320 px : « Carrière » sort de sa barre (324 > 300) — le toucher ne l'atteint plus`.
- **Qui ça touche, ce que ça coûte** : les profils au texte agrandi — la
  grand-mère de la tablée — et les téléphones de 320 px. Le seuil exact :
  la barre déborde sous 345 px CSS, soit un iPhone de 375 px dès 110 %.
  L'onglet n'est plus atteignable sous 280 px CSS environ.
- **Statut** : bug confirmé (rejoué). Il vient de #58 (`2d78067`, la barre
  reprise du quiz du jour, `dd3b2a3`).
- **Piste** (essayée : `pistes.css`, et l'épreuve passe) :
  ```css
  /* `1fr` vaut `minmax(auto, 1fr)` : « Apparence » refusait de céder. */
  .onglets { grid-auto-columns: minmax(0, 1fr); }
  .onglet { min-width: 0; padding-inline: 4px; }
  @media (max-width: 340px) { .onglets-profil .onglet .icon { display: none; } }
  ```
  Rendu : `captures/sonde-onglets-277-pistes.png`. Les trois libellés
  tiennent à 73 px chacun. La même règle vaut pour les onglets de période
  du quiz du jour (`JourApp.tsx:661`, `.onglets-petits`).
- **Priorité · effort** : P2 · S.

### 2. Au classement et au podium du téléphone, les lauréats perdent leur prénom, puis leur laurier

- **Où** :
  - la ligne : `.lb-row` (`styles.css:819-852`), dans
    `components/Leaderboard.tsx:71-82` (le classement de la salle d'attente) ;
  - le podium du téléphone : `games/quiz/PlayerView.tsx:891-900` ;
  - la même structure, à la lecture : `games/quiz/Course.tsx:111-120` et
    `views/JourApp.tsx:708-719` (classement du quiz du jour, où les points
    sont en plus formatés « 1 240 ») ;
  - le laurier dans la ligne : `NomLaure` (`Laurier.tsx:62-70`),
    `.nom-laure` (`styles.css:3736-3737`).
- **Constat** : une ligne porte, sur une seule rangée :
  - le rang (1,7 em de serif) ;
  - l'avatar ;
  - le prénom ;
  - le niveau ;
  - les points (serif 1,35 rem) ;
  - quatre écarts de 10 px.

  Seul le prénom cède. Le laurier en prend 23 px de plus (1,15 em + 0,3 em).
  Mesuré dans une vraie salle, après un quiz de six questions (points à
  quatre chiffres) :

  | Largeur | Prénom d'un lauréat (Marie-Charlotte) | Sans laurier | Laurier |
  |---|---|---|---|
  | 360 px | 66 px (« Marie-… ») | 89 px | vu |
  | 320 px | 26 px (« M… ») | 49 px | vu |
  | 277 px (130 %) | **0 px** | 6 px | **coupé** |

  En 277 px, les lignes des trois lauréats de tête ne montrent **ni prénom
  ni laurier** : seulement un avatar, « 25 » et « 1200 ». Les non-lauréats
  gardent une initiale (« L… », « C… »). La promesse du laurier est
  retournée : « C'est le prénom qui se coupe sur un écran étroit, jamais le
  laurier » (RECOMPENSES.md § 5.13). En 320 px, ceux qu'on veut honorer sont
  les seuls qu'on ne lit pas : « Ca… », « G… », « M… », « Op… », contre
  « Camille… », « Kévin », « Léa ». Au passage, « Camille (2) » y perd sa
  marque (« Camille… »).
- **Preuve** :
  - `captures/sonde-classement-tel-320.png` et `-277.png` ;
  - `sonde-podium-tel-277.png`, et `tel-06-podium-du-quiz-hugo130.png`
    (podium sans un nom) ;
  - `notes-sonde-classement.json` ;
  - épreuve 2 de `design-recompenses.test.ts`, qui échoue sur douze lignes,
    par exemple : `classement, 277 px : Marie-Charlotte Lefebvre — 0 px de
    prénom sur 38 pour trois lettres, laurier coupé`.
- **Qui ça touche, ce que ça coûte** : tout invité au texte agrandi ou sur
  un petit téléphone, à chaque classement. C'est aussi là qu'on touche un
  nom pour ouvrir sa carte : une ligne sans nom ne dit pas quelle carte elle
  ouvre.
- **Statut** : bug confirmé (rejoué). La rangée unique est ancienne, mais
  le laurier (#59) la fait tomber pour ceux qu'il distingue.
- **Piste** (essayée ; l'épreuve passe) : sous 250 px de liste, deux rangs.
  Le prénom et son laurier en haut ; le niveau et les points dessous.
  ```css
  .leaderboard, .podium { container-type: inline-size; }
  @container (max-width: 250px) {
    .lb-row { display: grid; grid-template-columns: auto auto minmax(0, 1fr) auto;
      grid-template-areas: 'rang av nom nom' 'rang av niv score'; column-gap: 8px; row-gap: 2px; }
    .lb-row > .lb-rank { grid-area: rang; width: 1.2em; }
    .lb-row > .av { grid-area: av; }
    .lb-row > .lb-name { grid-area: nom; }
    .lb-row > .niveau { grid-area: niv; justify-self: end; }
    .lb-row > .lb-score { grid-area: score; }
  }
  ```
  Résultat : en 320 px, 130 px de prénom au lieu de 26 ; en 277 px, 87 px au
  lieu de 0, laurier compris ; et « Camille (2) » se lit en entier
  (`sonde-classement-tel-277-pistes.png`). L'écran commun (des listes de plus
  de 250 px) ne bouge pas. L'épreuve devient le test de la correction.
- **Priorité · effort** : P2 · S.

### 3. Les emojis de collection fermés sont des trous noirs : 1,1:1

- **Où** : l'onglet Apparence, grille « Mes avatars » :
  - `.silhouette { filter: brightness(0); opacity: 0.55 }` et
    `.case-avatar.ferme { background: rgba(0,0,0,.25) }`
    (`styles.css:5805`, `5824`) ;
  - `Apparence.tsx:100-120`.
- **Constat** : la silhouette est noire à 55 %, sur une case assombrie
  elle-même posée sur une carte sombre. Elle ne se détache de sa case qu'à
  **1,1:1** (pixels mesurés ; 1,15:1 calculé). À côté, les légendaires
  fermés sont une silhouette dorée à 2,6-4,1:1, et les Divins une nébuleuse
  à 6,3:1. Les douze emojis de collection sont justement ce qu'un profil
  neuf gagne en premier, un par niveau : ils se lisent comme douze cercles
  vides, avec « niv. N » en 9,5 px. RECOMPENSES.md § 5.5 promet « une
  silhouette et « niv. 8 » tant qu'il est fermé ».
- **Preuve** :
  - `captures/silhouettes.png`, à côté de `silhouettes-pistes.png` ;
  - `profil-neuf-grille.png` ;
  - `notes-sonde-profil.json` (`contrasteSombre: 1.1`) ;
  - épreuve 3 : `la silhouette ne se détache de sa case qu'à 1.1:1 (1.1,
    1.1, 1.1, 1.1)`.
- **Statut** : friction confirmée (rejouée). Visible à chaque visite d'un
  profil sous le niveau 17.
- **Piste** (essayée ; 3:1 atteint) : une silhouette claire, comme celles
  des légendaires.
  ```css
  .silhouette { filter: brightness(0) invert(1); opacity: 0.36; }
  ```
  Au passage, « niv. N » peut monter à 10,5 px sans rien déplacer : il est
  posé en absolu.
- **Priorité · effort** : P3 · S.

### 4. La grille « Mes avatars » fait tourner 219 animations : un demi-cœur d'un téléphone moyen

- **Où** : `Apparence.tsx:139-185`. Chaque légendaire et chaque Divin de la
  grille est un `<Legendaire>` ou un `<Divin>` animé. Chaque emoji porte en
  plus la finition animée du profil.
- **Constat** : pour un profil riche, 219 animations infinies sur 178
  éléments SVG, qui animent `transform`, `rotate`, `scale` et `opacity` sur
  des formes internes. La feuille le dit elle-même (`styles.css:4640-4657`) :
  « que le navigateur ne compose pas : chacune refaisait le style et la mise
  en page de tout l'écran, à chaque image ». Mesures CDP, 5 s de repos, la
  grille à l'écran :

  | Condition | Tâches du fil principal | Recalcul de style | Charge |
  |---|---|---|---|
  | animée | 155–229 ms/s | 44–60 ms/s | 1,1–1,3 |
  | figée (`pause()`) | 0 | 0 | 1,3 |
  | animée, processeur ÷ 4 (téléphone moyen) | **463–522 ms/s** | 146–167 ms/s | 1,4–2,5 |
  | piste (seuls le porté et l'ouvert bougent), ÷ 4 | 190–195 ms/s | 50–53 ms/s | 1,8–2,2 |

  La règle de la maison est « figés dans les listes, animés là où ils sont
  le sujet ». Sur cette page, le sujet est **un** avatar : celui qu'on porte
  ou celui qu'on vient de toucher. La carte d'un joueur riche en anime 19
  de plus d'un coup (16 légendaires et 3 Divins).
- **Preuve** : `sonde-animations.ts`, `notes-sonde-animations.json`,
  `notes-sonde-profil.json`. Le mouvement réduit coupe tout : 0 animation
  en cours (`notes-01-profils.json`).
- **Statut** : perf, confirmée (mesurée).
- **Piste** :
  ```css
  /* La grille est une liste : seuls bougent l'avatar porté et celui qu'on regarde. */
  .grille-unique .case-avatar:not(.selected):not(.ouverte) :is(.lg, .dv) *,
  .grille-unique .case-avatar:not(.selected) .av::before,
  .grille-unique .case-avatar:not(.selected) .av::after { animation-play-state: paused; }
  .carte-legendaires .lg *, .carte-legendaires .dv * { animation: none; }
  ```
  La première ligne seule ramène la charge de 520 à 195 ms/s.
- **Priorité · effort** : P3 · S.

### 5. À l'écran commun, le laurier se pose avant le prénom des pastilles, et le coupe à deux lettres

- **Où** : salle d'attente, `views/HostApp.tsx:199-206` (le laurier entre
  le niveau et le bouton du prénom), et `plancherDuPrenom` (`:100-111`, un
  plancher de 4 ch).
- **Constat** : partout ailleurs, le laurier suit le prénom (« juste après
  son prénom », RECOMPENSES.md). Dans la pastille, il le précède :
  `[avatar] Niv. 25 🌿 Mari… [équipe]`. Il retire au prénom 23 px en 1366
  et 32 px en 1920 (sonde, sans équipes). Avec les équipes, les lauréats
  touchent le plancher de quatre caractères :
  - « Ophélie » devient « Op… » en 1366 comme en 1920 ;
  - la Camille lauréate devient « Ca… », à côté de « Cam… (2) » : on ne
    sait plus laquelle est laquelle.

  Le commentaire du plancher comptait le pire cas « badge, marque, lune,
  équipe, croix », pas le laurier.
- **Preuve** : `captures/tele-01-attente-1366.jpg`, `-1920.jpg` ;
  `rendu/01-attente-1366.jpg` (« Ca… (2) » contre « Cami… ») ;
  `notes-sonde-classement.json` (`pastilles-1366`, `pastilles-1920`).
- **Statut** : friction confirmée (rejouée), et une incohérence de
  placement.
- **Piste** : poser le laurier **dans** `.chip-name`, derrière la marque,
  en troisième colonne de sa grille :
  `grid-template-columns: minmax(var(--plancher), max-content) auto auto`.
  C'est le même ordre que partout ailleurs, et il entre ainsi dans le
  calcul du plancher. Le laurier sert aussi de repère pour lire le niveau
  à côté.
- **Priorité · effort** : P3 · S.

### 6. Les fonds de carte : le contenu défile sur le rideau du théâtre, et le titre pâlit sur l'aurore

- **Où** :
  - le décor est posé sous le contenu (`z-index: -1`, `styles.css:3759`) ;
  - `.carte-fond.fond-theatre .carte-tete { margin-top: 30px }` (`:3942`) ;
  - la lueur de l'aurore : `radial-gradient(70% 38% at 28% 16%, rgba(70,255,170,.42)…)`.
- **Constat** :
  - **Théâtre.** Le lambrequin (34 px, franges d'or) est dessiné derrière
    le contenu. Seule la tête de la carte est décalée de 30 px. Dès qu'on
    défile, et une carte riche fait 1 171 px dans un cadre de 598, le
    prénom puis les cartes des hauts faits passent **par-dessus** les
    franges d'or : un texte clair sur des festons dorés.
  - **Aurore.** La lueur verte tombe exactement sur l'en-tête. Le titre
    doré italique (« L'Estimation Cosmique », 16,8 px) n'y atteint 4,5:1
    que sur 90 % de ses pixels, avec un minimum de 3,2:1. « Vainqueur du
    quiz du jour d'hier » descend à 4,65:1 (10ᵉ centile), le rang à
    5,0:1. Sur la nuit, le kintsugi et le théâtre, tous les textes
    restent au-dessus de 5,5:1.
- **Preuve** : `captures/carte-theatre-mc-mi.png`, `-bas.png`,
  `carte-aurore-gw.png`, et `notes-02-soiree.json` (`contrastes` de chaque
  carte). La mesure ne compte pas l'ombre portée du texte, qui aide un peu.
- **Statut** : friction confirmée.
- **Piste** :
  - Théâtre : faire défiler **sous** le rideau, comme sur une scène. Soit
    un calque au-dessus du contenu (`.carte-fond.fond-theatre::before
    { z-index: 1 }`, `pointer-events: none` y est déjà), soit
    `.carte-fond.fond-theatre .carte-defile { margin-top: 34px }` à la
    place du décalage de la seule tête.
  - Aurore : descendre la lueur sous l'en-tête (`at 28% 16%` → `at 70% 60%`)
    ou l'éteindre derrière le texte (`rgba(70,255,170,.28)`).
- **Priorité · effort** : P3 · S.

### 7. « Ma finition » montre le renard alors que la salle voit le Phénix

- **Où** : `components/Apparence.tsx:252` et `:271`. Les aperçus sont
  `<Avatar avatar={profil.avatar} finition={f} … />`, sans `legendaire`.
- **Constat** : sous un légendaire porté, la finition « devient le cercle
  du médaillon » (RECOMPENSES.md § 5.5). Pourtant les sept boutons de
  « Ma finition » montrent l'emoji caché dessous (le renard) avec un halo.
  On choisit donc « Aurore » sans voir ce que la salle verra : un Phénix
  cerclé d'aurore. « Ce que la salle voit », juste au-dessus, montre bien
  le Phénix (`captures/profil-riche-apparence-3.png` contre `-pli.jpg`).
- **Statut** : incohérence confirmée (lecture et capture). Ce n'est pas le
  constat recompenses-vitrine-7, qui porte sur l'Éclat dans « Mon compte ».
- **Piste** : passer `legendaire={profil.legendaire ?? undefined}` et
  l'Éclat de ce qu'on porte (`cibleEclat(profil.legendaire, profil.avatar)`)
  aux aperçus. Un Divin n'a pas de finition : sous un Divin, remplacer la
  section par une phrase (« Hélios a sa propre lumière »).
- **Priorité · effort** : P3 · S.

### 8. Ce qui reste à gagner s'écrit à 2,3:1, et « pas encore » a six dessins

- **Où** :
  - `.finition-btn:disabled { opacity: 0.45 }` (`styles.css:4092`, ancien),
    repris par les fonds en #59 (`Apparence.tsx:376-392`) ;
  - `.ecusson.palier-0` (pointillé à 0,6) ;
  - `.prix-collection .manque` (pointillé, emoji `grayscale(1) brightness(.45)`) ;
  - `.silhouette` (noire) ;
  - la silhouette dorée des légendaires ;
  - la nébuleuse des Divins.
- **Constat** : un fond fermé dit sa règle (« 10 victoires au quiz du
  jour », « 25 soirées (L'Habitué · Or) »), et c'est l'information qu'on
  vient chercher. Voilée à 45 %, elle tombe à **2,26:1** et le nom à 3,81:1
  (13:1 et 5,6:1 une fois ouverts). Surtout, « pas encore » se dessine de
  six façons sur les deux mêmes onglets :
  - l'opacité à 0,45 ;
  - le pointillé ;
  - la silhouette noire ;
  - le gris assombri ;
  - la silhouette dorée ;
  - la nébuleuse.
- **Preuve** : `captures/profil-neuf-fonds.png`, `profil-neuf-trophees.jpg` ;
  `couleurs.mjs`.
- **Statut** : friction et dette.
- **Piste** : une seule recette, celle des écussons et des prix, qui est
  la plus lisible. Un cadre en pointillé, l'objet atténué mais pas le texte :
  ```css
  .finition-btn:disabled { opacity: 1; border-style: dashed; cursor: not-allowed; }
  .finition-btn:disabled > :not(.muted) { opacity: 0.5; }
  ```
  La règle garde ainsi son `--muted` à 5,6:1.
- **Priorité · effort** : P3 · S.

### 9. Écussons : le bronze et l'or se ressemblent, et la carte ne dit le palier que par la couleur

- **Où** : `components/Ecusson.tsx`, `styles.css:3985-3991`, la carte
  (`CarteJoueur.tsx:172-178`, sans légende).
- **Constat** :
  - Le bronze `#c98b58` et l'or `#d9b56a` ne sont séparés que de ΔE 20,
    et de ΔE 12,8 en deutéranopie. L'argent, lui, se détache à ΔE 50.
  - Sur la page du profil, la légende chiffrée (« 40 / 75 » contre « 205 »)
    lève le doute. Sur la carte, les trois écussons n'ont pas de légende :
    le palier n'y est porté que par la teinte. Le texte `sr-only` ne sert
    que le lecteur d'écran.
  - Dans la grille, les noms tiennent sur une à trois lignes (« Jeux & pop
    culture »), et les légendes d'une même rangée ne s'alignent pas.
- **Preuve** : `captures/profil-riche-ecussons.png`, `carte-theatre-mc-bas.png`,
  `couleurs.mjs`.
- **Statut** : idée.
- **Piste** :
  - un signe de forme en plus de la teinte : une, deux ou trois encoches au
    pied du blason, ou un blason plein pour l'or
    (`.palier-3 .ecusson-forme path { fill-opacity: .35 }`) ;
  - `align-content: start` et `grid-template-rows: subgrid` pour aligner
    les légendes (ou `min-height: 2.3em` sur `.ecusson-nom`).
- **Priorité · effort** : P3 · S.

### 10. Les 321 lignes de CSS de #59 face aux jetons (angle design-systeme)

- **Où** : `git diff 910a2de..b57035c -- client/src/styles.css`.
- **Ce qui est bien fait** :
  - les anneaux de collection sont des jetons, dans les deux thèmes
    (`--anneau-collection`, `-haut`) ;
  - le laurier écrit en `--accent-text` (8,6:1 Velours, 5,3:1 Ivoire) ;
  - le `z-index: -1` reste local, dans un `isolation: isolate` : aucune
    couche globale de plus ;
  - la seule animation nouvelle (`lg-bougie`) tombe sous la règle
    `prefers-reduced-motion` ;
  - le décor du fond, toujours nocturne, redéfinit ses propres
    `--ink`/`--muted`/`--accent-text` sur `.carte-fond` : c'est un bon
    usage des jetons.
- **Ce qui s'écarte** :
  - **Couleurs** : 27 hex distincts (107 occurrences) et 49 `rgba()`
    littéraux, dont **#d9b56a recopié 8 fois** (et 2 fois en `rgba(217,181,106,…)`).
    C'est l'or de Velours. Celles des `data:` SVG sont inévitables ; les
    `border-color`, `box-shadow` et le lambrequin pourraient lire
    `--fond-or`, à poser une fois sur `.carte-fond`.
  - **Dessin des étoiles** : 116 `radial-gradient`, dont 107 étoiles d'un
    pixel. Une image SVG par fond ferait le même dessin en une couche.
  - **Typographie** : #58 et #59 ajoutent **six tailles sous le plancher
    de 11 px** de `.label` : 9,5 px (`.case-niveau`), 9,9 (`.hf-fois`),
    10,4, 10,5 (`.detail-famille`), 10,6 (`.prix-titre`) et 10,9
    (`.ecusson-nom`, `.ecusson-legende`). Sur l'onglet Trophées, cela fait
    20 titres de prix en 10,6 px et 24 textes d'écussons en 10,9 px
    (`notes-01-profils.json`, `petits`).
  - **Rayons** : 10 px et 12 px en dur, cinq fois. Le rapport design-systeme
    du 24 septembre proposait `--radius-xs` ; il n'existe toujours pas.
  - **Opacité du champagne** : un nouveau `rgba(var(--accent-rgb), .3)`
    (`.case-avatar.ouverte`).
  - **L'or des écussons** : il lit `--accent` (un aplat), là où le bronze
    et l'argent lisent `--bronze-text` et `--argent-text`. Il n'existe pas
    de `--or-text`.
- **Statut** : dette, rien de visible à ce jour, et le téléphone ne prend
  jamais Ivoire.
- **Piste** :
  - `.carte-fond { --fond-or: #d9b56a; }` et ses six usages ;
  - `--or-text` à côté de `--bronze-text` ;
  - `--radius-xs: 10px` ;
  - ramener les six petites tailles à 11 px (`--t-label`), ce qui rejoint
    le constat 3 pour « niv. N ».
- **Priorité · effort** : P3 · S.

### 11. Au podium, le légendaire du vainqueur paraît plus petit que l'emoji du troisième

- **Où** : `.podium-avatar` (`FinalPodium`, `Podium.tsx:99`) ;
  `Legendaire` au format de l'emoji.
- **Constat** : un emoji qui porte une finition reçoit un halo de 1,45 em.
  Sous un légendaire, la finition devient le cercle du médaillon, qui garde
  1 em. Mesuré sur la capture 1366 : le Phénix du premier fait environ
  57 px de diamètre, et le poulpe « Or » de la troisième environ 76 px avec
  son halo. Le premier paraît le plus petit du podium, alors que c'est la
  plus belle chose qu'on puisse porter.
- **Preuve** : `captures/tele-06-podium-du-quiz-1366.jpg`,
  `-1366-ivoire.jpg`, `tele-10-cloture-1366.jpg`.
- **Statut** : idée (la règle « la finition devient le cercle » est un
  choix, à garder).
- **Piste** : `.podium-avatar .av-emoji > .lg, .carte-avatar .av-emoji > .lg { font-size: 1.3em; }`.
  Le médaillon rejoint ainsi l'emplacement d'un emoji avec son halo.
- **Priorité · effort** : P3 · S.

### 12. La carte d'un joueur riche, au texte agrandi : quatre écrans de défilement

- **Où** : `CarteJoueur.tsx:128-145` (tous les Divins, puis tous les
  légendaires, en entier) et `.carte-tete` (avatar et texte côte à côte).
- **Constat** :
  - En 277 px, la carte de Marie-Charlotte fait **1 700 px** de contenu
    dans un cadre de 450, soit 3,8 écrans. Sa tête tient dans une colonne
    d'environ 140 px : le prénom sur trois lignes, le titre sur deux.
  - En 360 px, elle fait 1 171 px pour 598. Les 19 médaillons y occupent
    quatre rangs, avant même « Ses plus beaux hauts faits ».
- **Preuve** : `captures/carte-theatre-mc-130.png`, `carte-aurore-gw-130.png`,
  `notes-02-soiree.json` (`defile`).
- **Statut** : idée.
- **Piste** :
  - une seule rangée de médaillons (les Divins d'abord), puis « +12 » qui
    déplie ;
  - sous 300 px, l'avatar au-dessus du texte :
    `@container (max-width: 300px) { .carte-tete { flex-direction: column; text-align: center } }`.
- **Priorité · effort** : P3 · S.

### 13. `rendu-ecran.ts`, le pire cas de référence, donne 🐝 et 🐢 à deux anonymes : ils deviennent 🎉

- **Où** : `server/scripts/rendu-ecran.ts:104` (les avatars des dix
  invités). Les deux derniers sont anonymes (`i < 6` seulement a un profil).
- **Constat** : depuis #59, 🐢 (niveau 4) et 🐝 (niveau 8) sont des emojis
  de collection, réservés aux profils (`peutPorter`). Ophélie et Bo, les
  deux anonymes, entrent donc en 🎉 dans chaque capture du pire cas. Le
  script ne montre plus la salle qu'il décrit.
- **Preuve** : `export/evaluations/design-recompenses/rendu/01-attente-1366.jpg`
  (deux 🎉), produit par la copie à l'identique du script.
- **Statut** : dette de l'outil. Ce n'est pas un bug du produit :
  recompenses-vitrine-11 couvre l'entrée anonyme.
- **Piste** : dans `rendu-ecran.ts`, `'🐝'` → `'🐞'` et `'🐢'` → `'🐬'`,
  deux emojis de l'inscription. Mieux encore, donner un emoji de
  collection à l'un des six profils, pour que le pire cas le montre.
- **Priorité · effort** : P3 · S.

## Mesures et cartes

### Le laurier, de 1366 à 1920 (largeur du laurier / taille du prénom, en px)

| Écran | 1366 × 768 | 1920 × 1080 | Rapport |
|---|---|---|---|
| Pastilles de la salle d'attente | 16,5 / 14,4 | 23,3 / 20,3 | × 1,41 |
| Listes (révélation, estimations, victoire) | 23 / 20 | 32,3 / 28,1 | × 1,41 |
| Podium du quiz, clôture | 40,5 / 35,2 | 56,9 / 49,5 | × 1,41 |

Le laurier suit la scène (`em`), comme le prénom. `rendu-ecran.ts`
(`MESURE=1`) ne relève rien de récompense qui ne grandisse pas.

### Contrastes des nouveaux textes et graphismes

| Élément | Mesure |
|---|---|
| Laurier, Velours / Ivoire | 8,6:1 / 5,3:1 |
| Anneaux de la grille (légendaire, Divin, collection vert, collection bleu) sur la carte | 6,8 · 6,6 · 7,8 · 6,7:1 |
| Contour des écussons (bronze, argent, or) sur la carte | 5,9 · 9,4 · 8,6:1 |
| Silhouette d'emoji de collection fermé | **1,1:1** (constat 3) |
| Silhouette dorée d'un légendaire fermé, nébuleuse d'un Divin | 2,6–4,1:1, 6,3:1 |
| Règle d'un fond fermé (opacité 0,45) | **2,26:1** (constat 8) |
| Textes des cartes, 10ᵉ centile sur le fond réel : nuit, kintsugi, théâtre | ≥ 5,5:1 |
| Textes des cartes, aurore : titre doré, « Vainqueur… » | **3,98:1** (min 3,2), 4,65:1 (constat 6) |

### Planches, écran par écran

Toutes les captures sont dans `export/evaluations/design-recompenses/captures/`.

| Écran | Captures | Ce qui va | Ce qui ne va pas |
|---|---|---|---|
| **Profil : en-tête** | `profil-riche-pli.jpg`, `-130.jpg` | Titre en italique d'or sous le prénom, laurier et sa phrase, barre d'XP ; un prénom de 24 caractères passe proprement sur deux lignes, le niveau à droite. | — |
| **Onglets** | `sonde-onglets-{360,320,277}.png`, `-pistes` | Onglets de 44 px, état actif net. | Sous 345 px, « Carrière » sort ; en 277, il ne se touche plus (1). |
| **Apparence : grille** | `profil-riche-grille.png`, `profil-neuf-grille.png`, `grille-porte-*.png`, `silhouettes*.png` | Une seule grille, anneaux distincts (même en deutéranopie, ΔE 47 entre vert et bleu), avatar porté cerclé d'or avec un halo, légende au toucher (`profil-riche-detail-*.png`). | Silhouettes de collection invisibles (3), « niv. N » en 9,5 px, 219 animations (4) ; chaque emoji du choix porte la finition, et la grille d'un niveau 25 devient 29 disques bleu nuit identiques (goût). |
| **Apparence : finitions, titre, fonds** | `profil-riche-apparence-3/4/5.png`, `profil-neuf-fonds.png` | Titres en pastilles serif, « et 14 autres à gagner » plutôt que trente boutons ; les vignettes de fonds sont justes et belles. | L'aperçu de la finition ignore le légendaire (7) ; règles des fonds fermés à 2,3:1 (8). |
| **Trophées** | `profil-riche-trophees-*.png`, `profil-riche-ecussons.png`, `profil-neuf-trophees.jpg` | Vitrine lisible, avec « ce qu'il a fallu » ; « Les plus proches » avec jauge ; prix en collection. | Bronze et or proches, légendes non alignées (9) ; 20 titres de prix en 10,6 px ; un profil neuf voit 32 cases vides (12 écussons, 20 « ? »), ce qui est voulu, mais on pourrait les replier. |
| **Carrière** | `profil-riche-carriere.jpg`, `profil-neuf-carriere.jpg` | État vide soigné (tirets, « les courbes apparaissent dès deux soirées ») ; catégories en barres. | Inaccessible au texte agrandi (1). |
| **Carte d'un joueur** | `carte-*.png`, `-mi`, `-bas`, `-130` | Quatre fonds beaux et distincts, qui ne bougent pas sous le texte ; le cadre reste en place, le contenu défile ; l'encre claire est réglée pour le décor ; « Vainqueur du quiz du jour d'hier » ; une carte neuve reste sobre. | Le contenu passe sur le rideau du théâtre, titre à 4:1 sur l'aurore (6) ; une carte riche fait 3,8 écrans à 130 % (12) ; des étoiles tombent sur les lettres (« HAUTS FAITS »), c'est du goût. |
| **Téléphone en soirée** | `tel-*.png`, `sonde-classement-tel-*.png`, `sonde-podium-tel-*.png` | En 360 px, laurier gardé et prénom coupé proprement ; « À 145 pts de Camille » ; podium du téléphone, sa ligne surlignée. | 320 / 277 px : prénoms et lauriers perdus (2). |
| **Fin de soirée** | `fin-lea.jpg`, `fin-mc.jpg` | « Nouvel avatar de collection » : le flamant en grand, « Le porter », la phrase qui explique ; paliers en cartes ; « Niveau 9 ! ». | — |
| **Quiz du jour : saison** | `saison-accueil-360.png`, `saison-citrouille-ouverte.png` | La silhouette dorée de la Citrouille et « 2 jours sur 3 » ; la fin de partie fête la Citrouille comme une fin de soirée. | — |
| **Écran commun, attente** | `tele-01-attente-*.jpg`, `rendu/01-attente-*.jpg` | Légendaires, Divins et niveaux se lisent ; le laurier grandit avec la scène. | Laurier avant le prénom, prénoms des lauréats à deux lettres (5) ; deux 🎉 dans le pire cas (13). |
| **Écran commun, révélation, estimations, victoire** | `tele-03/04/09-*.jpg` | Le laurier reste entier quand `Coupe` coupe la liste ; le prénom seul se coupe. | — |
| **Podium, clôture** | `tele-06/10-*.jpg`, Ivoire compris | Laurier et niveau sous le prénom, hors de sa coupe à deux lignes ; Ivoire juste (or foncé) ; « Un avatar a éclaté ». | Le légendaire du premier paraît plus petit (11). |

## Ce qui marche — à ne pas casser

- **Le laurier** :
  - une couronne dessinée (pas un emoji) en `em`, qui grandit avec la
    scène (× 1,41) ;
  - toujours en `--accent-text` : 8,6:1 en Velours, 5,3:1 en Ivoire ;
  - jamais coupé dans les listes que `Coupe` tronque, et hors de la coupe
    du nom au podium ;
  - dit à l'oreille (`LAURIER_TEXTE`) sans entrer dans le `textContent` du
    prénom, que la tablée lit.
- **Les fonds de carte** : quatre décors nocturnes, distincts et beaux.
  Le décor tient au cadre et le contenu défile par-dessus, un choix
  exemplaire. Rien ne bouge sous le texte. Leur propre encre claire rend
  le fond indépendant du thème.
- **Le mouvement réduit** coupe tout : 0 animation en cours sur le profil,
  et la bougie de la Citrouille comprise.
- **La grille unique** : une place par avatar, un anneau par rareté aux
  couleurs séparables, même en deutéranopie (vert et bleu à ΔE 47). La
  légende s'ouvre au toucher, sous la grille, et « Revenir à mon emoji »
  suit.
- **La fin de soirée qui ouvre un emoji de collection** et la fin de
  partie qui ouvre la Citrouille : une carte chacune, l'objet en grand,
  « Le porter ».
- **Les états vides** : le profil neuf ne montre ni « niveau 0 » ni rien
  d'humiliant. Il montre ce qui vient, et la carte d'un anonyme reste sa
  soirée.
- **Les emojis de collection** respectent la règle des emojis d'avant
  Unicode 13 : quatre sont d'Emoji 12 (🦩 🦥 🦦 🪐), affichés par
  Windows 10 depuis 1903.

## Recommandations, dans l'ordre

1. **Onglets du profil** : `grid-auto-columns: minmax(0, 1fr)`, icônes
   masquées sous 340 px (constat 1). P2 · S.
2. **Classement et podium du téléphone sur deux rangs** sous 250 px de
   liste (constat 2). Cela vaut aussi pour la Course et le classement du
   quiz du jour. P2 · S.
3. **Silhouettes de collection claires** : `invert(1)` à 0,36 (constat 3).
   P3 · S.
4. **Figer la grille** sauf l'avatar porté et l'ouvert, et figer les
   médaillons de la carte (constat 4). P3 · S.
5. **Le laurier des pastilles derrière le prénom**, dans `.chip-name`
   (constat 5). P3 · S.
6. **Théâtre et aurore** : défiler sous le rideau, éloigner la lueur de
   l'en-tête (constat 6). P3 · S.
7. **Aperçus de finition sur le légendaire porté** (constat 7). P3 · S.
8. **Une seule recette pour « pas encore »**, la règle d'un fond fermé
   lisible (constat 8). P3 · S.
9. **Un signe de forme pour le palier des écussons**, les légendes
   alignées (constat 9). P3 · S.
10. **Jetons** : `--fond-or`, `--or-text`, `--radius-xs`, plancher de
    11 px (constat 10). P3 · S.
11. **Médaillon du podium à 1,3 em** et carte compacte au texte agrandi
    (constats 11 et 12). P3 · S.
12. **`rendu-ecran.ts`** : deux emojis d'inscription pour ses anonymes
    (constat 13). P3 · S.

Les épreuves 1 à 3 de `design-recompenses.test.ts` sont prêtes à entrer
dans `server/test/` avec leurs corrections. Elles demandent un client
construit, comme `portes.test.ts`.

## Limites

- **Le texte agrandi** est émulé par un viewport de 277 × 492 CSS. C'est
  ce que fait le zoom de page de Chrome Android et de Safari (« aA »).
  Un vrai appareil peut arrondir autrement : le seuil de 250 px de la
  piste 2 est à vérifier sur un Android à 130 % et sur un iPhone SE.
- **Emojis** : rendus par Noto sous Linux. Sous Windows 10 antérieur à
  1903 (LTSC 2019), 🦩 🦥 🦦 🪐 s'afficheraient en carré vide. La règle
  « avant Unicode 13 » ne l'interdit pas ; à voir si l'écran commun d'un
  animateur tourne sur un tel poste.
- **Contrastes des cartes** : mesurés sur les pixels du fond, sans l'ombre
  portée du texte. La lecture réelle est un peu meilleure que les chiffres
  de l'aurore.
- **Coût des animations** : mesuré sous Chromium de bureau, et ralenti
  quatre fois pour figurer un téléphone moyen. Un vrai téléphone peut
  composer autrement. Le rapport entre « animée » et « piste » (÷ 2,5) est
  plus sûr que les valeurs absolues.
- **Les chiffres des cartes** (« Soirées : 1 ») viennent de profils
  fabriqués sans archive. Je ne les ai pas jugés.
- **Hors mission** :
  - En 320 px, le classement du téléphone coupe la marque d'homonymie
    (« Camille… » pour « Camille (2) », `Leaderboard.tsx:77`, une seule
    chaîne ellipsée). La piste 2 la rend.
  - « En tête du quiz » (`Coupe`, écran commun) montre deux ex æquo à 200
    et cache la troisième, Marie-Charlotte, dans « et 3 autres »
    (`tele-03-q1-revelation-1366.jpg`) : un vainqueur caché.
