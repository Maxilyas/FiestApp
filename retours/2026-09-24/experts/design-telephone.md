# Le téléphone de l'invité, écran par écran — rapport de l'expert design mobile

## En bref

Le téléphone de FiestApp est beau et cohérent. Velours tient sur tous les
écrans : fond noir chaud, serif pour ce qui compte, champagne pour ce qu'on
touche. En 360 × 640, la question normale, l'estimation clavier ouvert, la
photo à mémoriser, les révélations, le podium et la fin de soirée s'affichent
sans défiler. Quatre axes de la première tablée tiennent : l'en-tête coupe le
pseudo avec des points de suspension, le bouton de l'entrée suit le clavier,
« 125 000 » est accepté, et un texte illisible est signalé.

Trois défauts restent, et on les voit dès qu'on sort de la question moyenne
au texte normal :

1. **Des réponses longues recouvrent la question** en 360 × 640. La grille
   des réponses, de hauteur fixe et centrée, déborde vers le haut.
2. **Au texte agrandi, les avatars de l'entrée se chevauchent.** La grille
   garde ses 6 colonnes et chaque bouton ses 44 px.
3. **Le podium du souvenir s'inverse** quand le nom du vainqueur est long :
   sa marche devient plus basse que celle des deuxièmes.

S'y ajoutent des finitions :
- au-delà de 8 invités, on ne se voit pas dans le classement de la salle
  d'attente ;
- « Trop tard ! » s'affiche aussi pour qui n'a pas répondu ;
- le même chiffre porte trois noms différents d'une page à l'autre.

## Méthode

- **Durée et outils** : environ 1 h 15 sur l'atelier (régie `atelier.json`).
  Gaëlle anime depuis l'écran commun (`gaelle`, 1366 × 768).
- **Le quiz** : 7 questions. Un vrai/faux, un QCM à 3 réponses, un QCM à 4
  réponses de 85 à 90 caractères sous une question de 160 caractères, une
  estimation (« 131 000 habitants »), une photo à mémoriser pendant 8 s, et
  deux QCM de 20 s.
- **La salle** : deux équipes, dont une au nom de plus de 20 caractères,
  cinq fantômes (dont des homonymes) et quatre téléphones pilotés à la main.
- **Les téléphones** :
  - `gaelle-p` : petit téléphone 360 × 640, prénom long
    « Marie-Christine Beaulieu », sans compte ;
  - `gaelle-a` : Android 412 × 915, création de profil, puis `zoom 130` et
    `zoom 200` ;
  - `gaelle-i` : iPhone 390 × 844. Connexion ratée, puis sans compte, avec
    une question en `orientation paysage`, et aucune réponse à la première
    question (le cas « sans réponse ») ;
  - `gaelle-t` : tablette 800 × 1280. Réseau coupé pendant une question
    (« trop tard »), puis rétabli.
- **Deux « mesureurs »** : des téléphones automatiques
  (`export/evaluations/design-telephone/mesureur.mjs`, Playwright). Ils
  rejoignent la soirée, jouent, et à chaque écran relèvent :
  - toutes les cibles tactiles de moins de 44 px ;
  - les débordements horizontaux et les petites polices.

  Le premier tourne en 360 × 640 au texte normal (38 écrans), le second en
  360 × 640 au zoom CSS de 200 % (36 écrans). Un troisième script
  (`avatars200.mjs`) reproduit en 206 × 457 px CSS ce que fait le zoom de
  page de Chrome à 200 % sur un 412 × 915.
- **Écrans couverts** :
  - l'entrée : connexion, erreur de connexion, prénom et avatar, clavier
    ouvert, création de profil, code de secours ;
  - la partie : salle d'attente, choix d'équipe, préparation, questions à 2,
    3 et 4 réponses, réponses longues, estimation clavier ouvert, texte
    illisible, photo à mémoriser, les quatre révélations (juste, faux, trop
    tard, sans réponse), le classement entre deux questions, le podium ;
  - après la partie : fin de soirée (anonyme, avec profil, sans rang),
    souvenir, bilan, carte d'un joueur, page profil ;
  - les imprévus : liaison perdue, rechargement après la clôture.
- **Non couvert** :
  - les Divins, l'Éclat et un légendaire porté (aucun n'est tombé) ;
  - le thème Ivoire (le téléphone ne le prend pas) ;
  - un vrai clavier logiciel (celui de la tablée est simulé) ;
  - Safari iOS réel.

## Constats

### 1. Des réponses longues recouvrent la question en 360 × 640

- **Où** : la question à choix, `client/src/styles.css:1189`
  (`.quiz-player .ans-grid … align-content: center`) et
  `styles.css:1198-1212`. Pendant une question, la page prend exactement
  `100dvh`, et la grille reçoit `min-height: 0`.
- **Constat** : une question de 160 caractères avec quatre réponses de 85 à
  90 caractères, soit 4 lignes chacune, ne tient pas dans les 640 px. La
  grille ne peut pas défiler : ses rangées débordent. Comme elle est centrée
  (`align-content: center`), elle déborde **des deux côtés**. La première
  réponse monte sur la dernière ligne de la question (« qui parcourt les
  océans du globe ? » est barré par « Le Nautilus, un sous-marin »). En bas,
  la 4ᵉ carte touche le bord de l'écran. Rien n'est coupé à l'intérieur des
  cartes : ce sont les cartes qui se chevauchent avec la question.
- **Preuve** : `retours/2026-09-24/experts/captures/design-telephone-1-reponses-longues.png`
  (`gaelle-p`, Q3). Sur l'iPhone en paysage, c'est l'autre moitié du même
  mécanisme : la page défile, mais les réponses de 5 lignes touchent le
  haut et le bas de leur carte (`.ans-btn { padding: 0 22px }`,
  `styles.css:1257`, sans marge verticale).
- **Qui ça touche, ce que ça coûte** : toute la salle au petit téléphone, dès
  qu'un animateur écrit des réponses longues. L'éditeur les autorise
  (`MAX_ANSWER_TEXT = 120`), et « Coller une liste » écrite par une IA en
  produit volontiers. On lit mal la question au moment où le chronomètre
  compte.
- **Statut** : bug confirmé.
- **Piste** (S) :
  - aligner la grille par le haut quand elle ne tient pas :
    `align-content: safe center` (Chrome 115+, Safari 17.4+) ;
  - repli : `.player-shell:has(.ans-grid) { height: auto; min-height: 100dvh }`
    quand la question est `q-sm`, pour que la page défile au lieu de se
    chevaucher ;
  - donner aux cartes une marge verticale :
    `.quiz-player .ans-btn { padding: 10px 18px; }`.

  Test (Playwright, 360 × 640) : pour chaque `.ans-btn`, `top` ≥ le `bottom`
  de `.quiz-question`, et le `bottom` de la dernière ≤ `innerHeight` ou la
  page défile.
- **Priorité · effort** : P1 · S.

### 2. Au texte agrandi, les avatars de l'entrée se chevauchent

- **Où** : l'écran prénom et avatar de l'entrée.
  `styles.css:549-553` (`.emoji-grid { grid-template-columns: repeat(6, minmax(0, 1fr)) }`)
  et `styles.css:2426` (`@media (pointer: coarse) { .emoji-btn { min-height: 44px } }`),
  avec `aspect-ratio: 1`.
- **Constat** : les boutons gardent 44 × 44 px, mais les 6 colonnes
  rétrécissent avec la largeur. En 206 px CSS de large (un 412 × 915 au zoom
  de page de 200 %), chaque colonne fait 16,7 px et chaque bouton 44 px : les
  avatars se chevauchent de plus de moitié. Toucher le koala peut choisir le
  lion. La colonne fait moins de 44 px dès que la largeur CSS descend sous
  environ 340 px, c'est-à-dire **dès 110 % de texte sur le 360 × 640**. Au
  zoom CSS de la tablée, le mesureur relève 25 × 61 px par bouton : des
  ovales écrasés.
- **Preuve** :
  - `retours/2026-09-24/experts/captures/design-telephone-2-avatars-texte-agrandi.png` ;
  - mesure de `avatars200.mjs` :
    `{"w":44,"h":44,"grid":"16.66px 16.67px …"}` ;
  - `m200/mesures.jsonl`, écran 2.

  Le libellé « Ton avatar » passe aussi sur deux lignes à côté de
  « 11 invité·e·s déjà là ».
- **Qui ça touche, ce que ça coûte** : la grand-mère au texte agrandi, dès
  l'entrée, sur l'écran que CLAUDE.md veut sans défilement. Elle choisit un
  avatar qu'elle n'a pas touché, sans le savoir.
- **Statut** : bug confirmé (sur l'émulation du zoom de page, à revérifier
  sur un vrai Android).
- **Piste** (S) :
  `.emoji-grid { grid-template-columns: repeat(auto-fill, minmax(44px, 1fr)); }`.
  La grille passe à 5, puis 4, puis 3 colonnes, et les 24 avatars restent
  entiers. Test : aucun `.emoji-btn` dont le rectangle en recoupe un autre,
  en 206 et en 277 px de large.
- **Priorité · effort** : P2 · S.

### 3. Le podium du souvenir s'inverse quand le vainqueur a un nom long

- **Où** : `client/src/components/Podium.tsx:75`
  (`height: 30 + 70 × points/meilleur %`) et `styles.css:1530-1556`
  (`.podium-col { height: 100%; justify-content: flex-end }`,
  `.podium-step` rétrécissable).
- **Constat** : la marche est en pourcentage de la colonne, et c'est un
  élément flexible qui peut rétrécir. « Marie-Christine Beaulieu » prend
  3 lignes au-dessus de sa marche et lui vole la hauteur. La marche du 1ᵉʳ
  (1 154 pts) mesure environ 120 px, celles des deux 2ᵉˢ (969 pts) environ
  175 px : **le vainqueur est sur la plus petite marche**.
- **Preuve** : `retours/2026-09-24/experts/captures/design-telephone-3-podium-inverse.png`
  (souvenir, `gaelle-p`, 360 × 640).
- **Qui ça touche, ce que ça coûte** : le souvenir partagé le lendemain et,
  si le même composant sert à l'écran commun, la projection de la victoire.
  C'est l'image de la soirée qui ment.
- **Statut** : bug confirmé.
- **Piste** (S) :
  - `.podium-step { flex-shrink: 0; height: calc(56px + 110px * var(--part)) }`,
    avec `--part = points / meilleur`, posée par `Podium.tsx` ;
  - `.podium-name` limité à deux lignes (`-webkit-line-clamp: 2`) avec
    points de suspension ;
  - test : la marche du rang 1 est la plus haute.
- **Priorité · effort** : P2 · S.

### 4. Au-delà de 8 invités, on ne se voit plus dans le classement

- **Où** : `client/src/views/PlayerApp.tsx:380` (`<Leaderboard compact …>`)
  et `client/src/components/Leaderboard.tsx:29`
  (`compact ? rows.slice(0, 8) : rows`).
- **Constat** : le classement du téléphone s'arrête aux 8 premiers, suivis
  de « et 8 autres… » qu'on ne peut pas toucher. En salle d'attente, tout le
  monde est à 0 et le départage est alphabétique : Marie-Christine, 9ᵉ par
  ordre alphabétique, ne se voyait pas, alors que son en-tête dit
  « 1ʳᵉ place ». Après le quiz, Léo (10ᵉ) ne s'y voit pas non plus. La
  ligne surlignée « moi » n'apparaît donc que pour les 8 premiers.
- **Preuve** : `export/tablee/atelier/captures/gaelle-p/007-attente-equipes.png`.
  16 invités, huit lignes, Marie-Christine absente.
- **Qui ça touche, ce que ça coûte** : dans une vraie soirée (15 à 50
  personnes), la majorité de la salle. Celui qui est en bas de tableau est
  justement celui qui cherche sa place.
- **Statut** : friction confirmée.
- **Piste** (S) : en mode compact, si « moi » n'est pas dans les 8, ajouter
  une ligne de séparation « ⋯ » puis sa ligne surlignée. Le rang vient de
  `classer`, donc les ex æquo restent justes.
- **Priorité · effort** : P2 · S.

### 5. « Trop tard ! » pour qui n'a pas répondu, et pas de retour au toucher hors ligne

- **Où** : `client/src/games/quiz/PlayerView.tsx:352-358`
  (`v.yourChoice === null` → horloge rouge et « Trop tard ! »), et
  `client/src/socket.ts:270` (`sendPlayerAction`). La carte n'est marquée
  qu'une fois l'accusé reçu.
- **Constat** : trois situations donnent le même écran rouge :
  - Léo, qui n'a pas répondu (iPhone) ;
  - la tablette, qui a touché « Faux » à 35 s mais hors ligne ;
  - celui dont la réponse est vraiment arrivée après la fin.

  Pendant la coupure, le bouton touché n'a montré **aucun état** : ni
  choisi, ni « envoi… ». Seul le bandeau « Connexion perdue » était visible.
  L'invité ne sait pas si son geste a compté.
- **Preuve** :
  - `export/tablee/atelier/captures/gaelle-t/003-q1-horsligne.png` (aucune
    carte marquée après le toucher) et `004-q1-revel-retour.png`
    (« Trop tard ! ») ;
  - `gaelle-i/003-q1-revel.png` (le même écran sans avoir rien touché).
- **Qui ça touche, ce que ça coûte** : le retardataire au réseau capricieux,
  qui croit que l'application l'a trahi.
- **Statut** : friction confirmée.
- **Piste** (S à M) :
  - marquer la carte touchée tout de suite (état `.pending`, filet en
    pointillé et « Envoi… » en dessous), puis `.chosen` à l'accusé ;
  - distinguer « Pas de réponse » (icône neutre, gris) de « Trop tard ! »
    (rouge), ce dernier réservé à une réponse refusée `too-late`. Il faut
    garder en local la dernière réponse envoyée pour la question.
- **Priorité · effort** : P2 · S (le libellé) / M (l'état en attente).

### 6. Au texte très agrandi, les réponses coupent les mots

- **Où** : `styles.css:1302` (`.ans-text { overflow-wrap: anywhere }`)
  avec les marges fixes de `.ans-btn` (22 px + forme 22 px + 16 px d'écart,
  plus la coche).
- **Constat** : au zoom 200 sur 412 px, « Aucune » devient
  « Auc / une » dans la carte choisie : il reste environ 50 px au texte.
  À 130 %, rien ne se coupe.
- **Preuve** : `export/tablee/atelier/captures/gaelle-a/019-q5-z200-repondu.png`.
- **Statut** : friction confirmée (zoom CSS de la tablée).
- **Piste** (S) : `overflow-wrap: break-word; hyphens: auto;` (le document
  est en `lang="fr"`), et une requête de conteneur qui resserre la carte
  quand elle est étroite :
  `@container (max-width: 240px) { .ans-btn { gap: 10px; padding-inline: 12px } }`.
- **Priorité · effort** : P3 · S.

### 7. Le même chiffre, trois noms et deux comptes

- **Où** : la carte d'un joueur, la page profil, le bilan, la fin de
  soirée, le souvenir.
- **Constat** :
  - la part de bonnes réponses aux QCM s'appelle « 4/6 justes » sur la
    carte, « Précision · 50 % · 2 sur 4 QCM » sur le profil et
    « Réussite · 83 % · 5 justes sur 6 QCM » dans le bilan ;
  - le nombre de joueurs vaut « sur 10 » à la fin de soirée et sur la
    carte, mais « 11 joueurs » et « 1ʳᵉ place sur 11 » dans le souvenir et
    le bilan. Léo, sans point, est compté d'un côté et pas de l'autre ;
  - les nombres : « 1154 pts » dans l'en-tête et le podium du téléphone,
    « 1 154 pts » à la fin de soirée et dans le bilan ;
  - l'accord : « 0 pts », et « 1 invité·e·s déjà là »
    (`Entree.tsx:260` et `:615`).
- **Preuve** : `gaelle-p/031-carte-joueur.png`, `gaelle-a/023-profil.png`,
  `gaelle-p/038-bilan-moi2.png`, `gaelle-p/032-fin-soiree.png`,
  `gaelle-p/029-podium.png`.
- **Statut** : incohérence confirmée. Les mots relèvent aussi de l'expert
  des mots : à croiser.
- **Piste** (S) :
  - un seul libellé, « Précision », toujours au format de CLAUDE.md
    (« 83 % · 5 sur 6 QCM ») ;
  - une seule règle pour « sur N » (les joueurs classés), et `formatNumber`
    pour tout score ≥ 1 000 ;
  - `motPoints()` (qui existe, `Rank.tsx`) partout où l'on écrit « pts »
    après un nombre ;
  - « 1 invité déjà là », « 2 invité·e·s déjà là ».
- **Priorité · effort** : P3 · S.

### 8. Des cibles tactiles sous 44 px

- **Où / constat** : le mesureur en 360 × 640 (38 écrans) relève, hors
  liens de texte :

  | Cible | Taille | Écran |
  |---|---|---|
  | Ligne du classement (`.lb-row.lb-ouvrable`), qui ouvre une carte | 282 × **40** | salle d'attente, entre deux quiz |
  | « Choisir mon équipe » / « Changer » (`.btn-small`) | 143 × **36** | salle d'attente |
  | Avatars (`.emoji-btn`) | **42 × 42** au pointeur fin ; 44 × 44 au doigt, mais voir le constat 2 | entrée |
  | « J'ai oublié mon mot de passe » (`.link-inline`) | 158 × **17** | entrée, accueil |
  | « j'ai un profil » (`.link-inline`) | 62 × **17** | prénom et avatar |
  | « Gagner des niveaux : créer un profil » | 193 × **17** | salle d'attente |
  | « Créer mon profil » (fin de soirée) | 94 × **15** | fin de soirée |

  Les cartes de réponse (≥ 52 px de haut) et les boutons principaux
  (56 px et plus) sont larges partout.
- **Preuve** : `export/evaluations/design-telephone/m100/mesures.jsonl`
  (champ `cibles`).
- **Statut** : friction. Les lignes de 40 px sont les seules cibles
  « de jeu » concernées.
- **Piste** (S) :
  - `.lb-ouvrable { min-height: 44px }` ;
  - `.btn-small` à 44 px de haut sur `pointer: coarse` ;
  - les liens en ligne gardent leur allure, mais on étend leur zone :
    `.link-inline { padding-block: 12px; margin-block: -12px; }`.
- **Priorité · effort** : P3 · S.

### 9. Le texte de la question se replie en colonne étroite

- **Où** : `styles.css:1108-1114` (`.quiz-question { text-wrap: balance }`)
  et `h1, h2, h3` (`styles.css:220`).
- **Constat** : `balance` égalise les lignes. Sur 360 px,
  « La tour Eiffel a / été repeinte en / jaune en 1968. » prend environ
  200 px sur 320, avec un grand vide à droite. Le bloc paraît étroit, et la
  question prend une ligne de plus que nécessaire. Sur la tablette, la même
  question laisse la moitié de la colonne vide. C'est pareil pour les
  titres (« Soirée du 24 / septembre 2026 »).
- **Preuve** : `gaelle-p/010-q1-vraifaux.png`,
  `gaelle-t/002-q1-vraifaux.png`, `gaelle-p/032-fin-soiree.png`.
- **Statut** : friction (goût).
- **Piste** (S) : `text-wrap: pretty` sur `.quiz-player .quiz-question`
  (évite la veuve sans rétrécir le bloc), `balance` gardé pour l'écran
  commun, qui est centré.
- **Priorité · effort** : P3 · S.

### 10. La tablette est un téléphone étiré

- **Où** : toutes les pages de la partie en 800 × 1280.
- **Constat** : la colonne est limitée à 520 px. Les deux réponses du
  vrai/faux sont posées à mi-hauteur (y ≈ 690) sous un vide de 450 px, et
  le podium flotte au milieu. Rien n'est cassé, mais les cibles sont petites
  pour l'écran, et le texte de la question ne profite pas de la largeur.
- **Preuve** : `gaelle-t/002-q1-vraifaux.png`, `gaelle-t/007-podium.png`.
- **Statut** : idée.
- **Piste** (M) : au-delà de 700 px de large, une colonne de 640 px,
  question en 40 px, et des réponses à 120 px de haut.
- **Priorité · effort** : P3 · M.

### 11. Les petits détails

- **L'en-tête pendant une coupure** : la pastille « Reconnexion… » réduit
  le prénom à « Mari… » et fait passer « 1ʳᵉ place » sur deux lignes
  (`gaelle-p/040-liaison-perdue-30s.png`). *Piste* : poser la pastille sous
  l'en-tête, pleine largeur, ou n'y garder que l'icône.
- **Le badge de niveau** (« ① » à côté du prénom, 11,2 px, serif à chiffres
  elzéviriens) ressemble à un « I » ou à une notification
  (`gaelle-p/030-entre-quiz.png`, `gaelle-a/023-profil.png`). *Piste* :
  chiffres alignés (`font-variant-numeric: lining-nums`, déjà employé par
  `.podium-medal`) et 13 px au moins.
- **Le podium du téléphone** ne marque ni le vainqueur ni « moi » : la
  ligne 1 a la même carte que les 2ᵉˢ (`gaelle-p/029-podium.png`), alors
  que le classement de la salle d'attente surligne « moi ». *Piste* : la
  classe `me` et le fond champagne de la ligne 1.
- **Le chemin « Créer un profil »** passe par l'écran du prénom, qui dit en
  pied « Rien à installer · ton prénom suffit · j'ai un profil »
  (`gaelle-a/001-creer-profil.png`) : ce n'est pas le bon message sur ce
  chemin. La coupure « e- / mail » tombe au bout de la ligne
  (`002-creer-profil2.png`) : `e‑mail` avec un trait d'union insécable.
  Aucun bouton pour afficher le mot de passe tapé dans le noir.
- **Des emojis en monochrome** : l'avatar 🐵 de la fin de soirée et le
  😴 du « Somnambule » sortent en dessin au trait (DejaVu Sans).
  `styles.css` ne déclare aucune police d'emoji, et le repli choisit la
  première police qui a le glyphe (`gaelle-i/011-fin-soiree.png`). Vu sous
  Linux, **non confirmé** sous Android et Windows 10. Segoe UI Symbol a
  aussi des glyphes monochromes. *Piste* :
  `.av-emoji, .fin-badge-emoji { font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif; }`.

### Hors de ma mission, à transmettre (écran commun, 1366 × 768)

Avec les réponses longues de la question 3, la console de l'animatrice
recouvre la section « Les équipes ». « Question suivante » est **sous** une
ligne d'équipe, et le toucher est refusé (« Quelque chose recouvre ce
bouton ») : il a fallu la touche Entrée. Preuve :
`export/tablee/atelier/captures/gaelle/003-host-recouvert.png`. L'axe 3 de
la première tablée ne tient donc pas avec des réponses de quatre lignes.

## Mesures et cartes

**Où tient le téléphone en 360 × 640, texte normal** (hauteur de page
relevée par le mesureur, 640 = sans défilement) :

| Écran | Hauteur | Remarque |
|---|---|---|
| Entrée : connexion, prénom et avatar | 640 | tient, clavier fermé ; clavier ouvert, le bouton passe sous le clavier (Entrée le ferme, c'est voulu) |
| Salle d'attente, 3 invités | 640 | |
| Salle d'attente, 16 invités, équipes | 960 | défile ; 8 lignes seulement (constat 4) |
| Préparation, questions courtes, estimation, photo | 640 | tiennent ; l'estimation tient clavier ouvert |
| Question longue, 4 réponses longues | 640 | **chevauchement** (constat 1) |
| Révélations, podium, fin de soirée | 640 | tiennent |
| Souvenir | 5 368 | long, lisible ; podium inversé (constat 3) |

**Au zoom CSS de 200 % de la tablée**, les pages de la partie mesurent
entre 1 280 et 2 517 px. Le banc applique un `zoom` CSS sur `<html>`, qui
multiplie aussi `100dvh`. Les pages « un écran » (question, révélation)
deviennent donc deux fois plus hautes que la fenêtre, et leur contenu
centré tombe en bas (`gaelle-a/020-q5-revel-z200.png`). **C'est un
artefact du banc** : le zoom de page de Chrome Android ne gonfle pas
`dvh`. Les constats 2 et 6, eux, ont été rejoués en émulant le zoom de
page (viewport CSS réduit).

**Débordement horizontal** : aucun sur les 74 écrans mesurés.

**Petites polices** (< 13 px) : les libellés en capitales espacées
(`.label`, 11 px : « TON PRÉNOM », « QUESTION 1 / 7 », la catégorie), le
badge de niveau (11,2 px), les notes de pied (12 px). Le gris `--muted`
sur `--bg` fait 6,7 : 1, donc le contraste suffit. À 11 px et 0,22 em
d'espacement, la lecture reste fragile pour un œil de 70 ans ; 12 px
suffirait.

**Composants, ce qui diffère d'un écran à l'autre** :

| Composant | Variante A | Variante B |
|---|---|---|
| Bouton secondaire | capitales espacées (« JOUER SANS COMPTE », « CRÉER UN PROFIL ») | minuscules (« Plus tard — je joue », « Revoir la soirée », « Mon profil », « Me déconnecter ») |
| Bouton principal | capitales (« REJOINDRE LA SOIRÉE », « VALIDER ») | minuscules (« Rejoindre la soirée suivante », fin de soirée) |
| Ligne « moi » | surlignée dans le classement | non marquée dans le podium du téléphone |
| Précision | « 4/6 justes » (carte) | « 50 % · 2 sur 4 QCM » (profil) · « Réussite 83 % » (bilan) |
| Score | « 1154 » (en-tête, podium) | « 1 154 » (fin, bilan) |
| Révélation | « Raté… » et « Trop tard ! » ont une icône | « Bien joué ! » n'en a pas : le grand « +187 pts » en tient lieu (cohérent, à garder) |

## Ce qui marche — à ne pas casser

- **La question normale en 360 × 640** : chronomètre fin doublé d'un grand
  chiffre, forme et couleur de chaque réponse (jamais la couleur seule),
  cartes de 52 à 100 px qui se partagent la hauteur. Le « Réponse
  enregistrée · tu peux encore changer » posé dans la marge du bas ne fait
  pas bouger les cartes sous le doigt.
- **L'estimation** : grand champ serif, unité en italique à côté, bouton
  qui reste au-dessus du clavier. « 125 000 » est accepté, et « cent
  mille » reçoit « Écris seulement un nombre, comme 35 000 ou 12,5. »
  (l'axe 4 de la première tablée tient).
- **La photo à mémoriser** : pastille « MÉMORISE », décompte, puis « La
  photo a disparu — de mémoire ! » avec l'œil barré. Clair et joli.
- **Les révélations** : gros gain en champagne, la bonne réponse avec sa
  forme. La réponse longue est révélée en entier, sans coupure.
- **L'en-tête** : le prénom long est coupé avec des points de suspension
  (corrigé depuis la première tablée).
- **L'entrée** : « Jouer sans compte » et « Créer un profil » au même
  format que « Me connecter », et tout tient en 640 px. Le bouton suit le
  clavier à la création du profil. L'erreur de connexion dit quoi faire
  (« Tu peux aussi jouer sans compte, juste en dessous »).
- **Le code de secours**, isolé, en chasse fixe, avec « Copier » et « Il ne
  sera plus jamais affiché ».
- **Le paysage** : question et réponses sur deux colonnes, tout tient en
  390 px de haut pour une question normale.
- **La fin de soirée**, en une carte par nouvelle. L'invité sans rang lit
  « 10 joueurs ce soir » plutôt qu'un « 0 pt » humiliant (invariant 8 dans
  l'esprit).

## Recommandations, dans l'ordre

1. **Réponses longues** : `align-content: safe center`, page qui défile au
   lieu de se chevaucher, et une marge verticale dans les cartes de réponse
   (constat 1). P1 · S.
2. **Avatars au texte agrandi** : `repeat(auto-fill, minmax(44px, 1fr))`
   (constat 2). P2 · S.
3. **Podium** : marche non rétrécissable, hauteur en px, nom sur deux
   lignes au plus (constat 3). P2 · S.
4. **Se voir dans le classement** au-delà de 8 : ajouter sa ligne après
   « ⋯ » (constat 4). P2 · S.
5. **« Pas de réponse » ≠ « Trop tard ! »**, et un état « envoi… » sur la
   carte touchée (constat 5). P2 · S puis M.
6. **Cibles** : lignes du classement et `.btn-small` à 44 px, zone des
   liens en ligne élargie (constat 8). P3 · S.
7. **Un seul vocabulaire** : Précision, « sur N », `formatNumber`,
   `motPoints`, « 1 invité » (constat 7). P3 · S.
8. **Coupure des mots** au texte très agrandi (constat 6), `text-wrap:
   pretty` pour la question (constat 9), et les petits détails du
   constat 11. P3 · S.
9. **Une mise en page tablette** (constat 10). P3 · M.

## Limites

- **Le clavier est simulé** (la régie retaille la fenêtre) : le
  comportement réel de `interactive-widget=resizes-content` sur Chrome
  Android et de Safari iOS reste à voir sur un vrai appareil.
- **Le texte agrandi** a été émulé de deux façons : le `zoom` CSS de la
  tablée, qui gonfle `dvh` (artefact écarté ci-dessus), et un viewport CSS
  réduit. Le « Taille du texte » d'Android et le Dynamic Type d'iOS peuvent
  différer : les constats 2 et 6 sont à confirmer sur un appareil réel.
- **Les emojis** sont rendus par les polices du conteneur Linux (constat
  11) : à revoir sous Android et sous Windows 10.
- **Non vus** : Divins, Éclat, légendaire porté, hauts faits de carrière
  sur la fin de soirée, le Rejoindre de l'accueil, la veille du téléphone,
  un invité exclu.
- **Aucune correction n'a été appliquée** : les pistes sont à tester avec
  le rendu, en 360 × 640 et en 412 × 915.
