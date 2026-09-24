# Vérification du groupe design — évaluation du 24 septembre 2026

Six rapports d'experts relus et vérifiés : `design-tele`, `design-telephone`,
`design-systeme`, `mots`, `accessibilite` et `benchmark` (dans
`retours/2026-09-24/experts/`). Ils sont recoupés entre eux et avec les 17
retours des invités de la tablée « trois salons »
(`export/tablee/2026-09-24-trois-salons/retours/`), et comparés à la synthèse du
23 septembre (PR #25 à #31).

## En bref

**70 constats examinés.**
- **61 sont retenus**, une fois les doublons fusionnés : 51 défauts confirmés
  (bugs, frictions, dette) et 10 idées ou tensions avec un parti pris.
- **9 ne sont pas confirmés**, et 3 d'entre eux viennent du banc d'essai.
  Deux des trois bugs de balisage relevés par Hugo sont des artefacts : le
  geste `voir` de la tablée calcule lui-même les rôles, et il ne voit pas ce
  que reçoit un lecteur d'écran (voir N1 et N2).
- Le code n'a pas bougé depuis les rapports : `git diff a2d2b5e -- client
  shared server` est vide. Les numéros de ligne des experts sont donc justes,
  avec une exception, signalée en E6.

**Les trois constats les plus graves (P1)** :
1. **E1 · Les réponses longues cassent les deux écrans de référence.**
   - Au téléphone en 360 × 640, la grille des réponses recouvre la question.
   - À la télé en 1366 × 768, le texte est rogné dans les cartes, et à la
     révélation le classement passe sous la console. Il recouvre alors le
     bouton « Question suivante ».
   - Quatre sources.
2. **E2 · En 1920 × 1080, l'écran commun rapetisse.**
   - Les tailles plafonnent vers 1 300 px de large.
   - Sur la même télé, un 1080p montre tout 30 % plus petit qu'un 1366.
3. **M1 · Comment une équipe gagne s'explique de quatre façons, dont une
   fausse.**
   - Deux animateurs sur trois ont vu la victoire basculer à cause des prix,
     sans comprendre pourquoi. Tous les deux ont dû se reprendre devant leur
     salle.

Juste derrière, **E3 · la pause ne se voit pas du canapé**. C'est le constat
qui a le plus de sources : un expert, les trois animateurs de la tablée et
deux invités. L'idée avait déjà été notée le 23 septembre.

**Ce qui est neuf** (la tablée l'a vu, aucun expert) :
- T1 · le tableau des équipes du souvenir se défait en cascade de lettres au
  texte agrandi. Reproduit ici sans le zoom du banc.
- E6 · la marque d'homonymie est coupée sur la console, « Camil… ».
- M7 · « ZOÉ — 8.90 S » au mur.
- S1 · les champs numériques refusent d'être vides, dans cinq champs.
- M6 · l'élision est oubliée ailleurs que dans le titre de l'espace.
- T8 · une alerte d'échec reste affichée sous un succès.
- T9 · « 0 joueurs ce soir ».

### Les constats P1 et P2, dans l'ordre

| # | Constat | P · effort | Statut | Sources |
|---|---|---|---|---|
| E1 | Réponses longues : chevauchement au téléphone, débordement à la télé | P1 · S–M | bug | design-telephone, design-tele, accessibilite, Nadia |
| E2 | Rien ne grandit au-delà de ~1 300 px de large | P1 · M | bug (mise à l'échelle) | design-tele ; captures de Marc et de Léa en 1920 |
| M1 | Classement des équipes : quatre explications, « barème », une phrase fausse | P1 · S | bug de texte | mots, design-tele, Nadia, Marc, Liam |
| E3 | Pause et états de scène illisibles du canapé | P2 · S | friction | design-tele, Léa, Marc, Nadia, Liam, Lucas |
| E4 | Prix, Victoire et clôture restent sur l'écran qui les ouvre | P2 · S–M | bug | design-tele, Léa |
| E5 | Compte des réponses fausses à 2,39:1 en Velours | P2 · S | bug (WCAG 1.4.3) | design-tele, accessibilite |
| E6 | « Camille (2) » coupé en « Camil… » sur la console | P2 · S | bug | Nadia, Marc, design-tele |
| E7 | Remise des prix : coulisses et jargon projetés, effet sur les équipes invisible | P2 · M | friction | design-tele, mots, Marc, Nadia, Léa, Liam |
| E8 | Podium et classements écrits trop petit pour la salle | P2 · S | friction | design-tele |
| T1 | Souvenir : « Les équipes au quiz » en cascade de lettres au texte agrandi | P2 · S | bug (nouveau) | Jeanne ; reproduit |
| T2 | Avatars de l'entrée qui se chevauchent au texte agrandi | P2 · S | bug | design-telephone, accessibilite, Jeanne |
| T3 | Podium inversé au téléphone, marches presque égales à la télé | P2 · S | bug + friction | design-telephone, design-tele, Léa |
| T4 | Au-delà de 8 invités, on ne se voit plus au classement | P2 · S | friction | design-telephone |
| T5 | « Trop tard ! » pour qui n'a rien touché, aucun état « envoi… » | P2 · S–M | friction | design-telephone, Camille M., Karim |
| S1 | Champs numériques qui refusent d'être vides (« 2045 », « 020 ») | P2 · S | bug (nouveau) | Léa, Nadia, Marc ; editeur §2 |
| M2 | Le profil promet « tes points » | P2 · S | texte trompeur | mots, Jeanne |
| M3 | « Annuler les points ? » → [Annuler] [Retirer les points] | P2 · S | piège de libellé | mots |
| A1 | Boutons bascule : son et thème disent l'inverse, trois bascules muettes | P2 · S | bug (WCAG 4.1.2) | accessibilite |
| A2 | Focus des champs presque invisible, anneaux dispersés | P2 · S | friction (WCAG 2.4.7) | accessibilite, design-systeme |
| A3 | Le temps : seule une pause collective | P2 · S–M | tension | accessibilite, benchmark, Bertrand, Karim |
| C1 | « Partir d'un modèle » pour tout nouvel espace | P2 · S | friction | benchmark, Marc |
| C2 | Le nom de la soirée à dire, et `chez-` deviné | P2 · S | friction | benchmark, Camille M., Maëlle |
| C3 | Une vraie télécommande pour l'animateur | P2 · M | idée (forte demande) | benchmark, Léa, Marc, Nadia |

## Méthode

- **Lecture du code** pour chaque constat P1 et P2. Chaque ligne citée a été
  relue, et la ligne exacte est donnée ci-dessous.
- **Captures relues** : celles des experts (`retours/2026-09-24/experts/captures/`)
  et environ vingt captures de la tablée.
- **Reproductions**, dans `export/evaluations/verification/design/` :
  - `equipes-etroites.mjs` : le tableau des équipes du souvenir, avec la
    feuille de style servie par l'atelier, rendu en 360 et en 277 px de large
    dans une vraie fenêtre, sans le zoom CSS du banc. Donne
    `equipes-souvenir-277px.png`.
  - `accessibilite-banc.mjs` : met côte à côte ce que lit le geste `voir` de
    la tablée (`_snapshotForAI`, qui calcule les rôles lui-même) et l'arbre
    d'accessibilité réel de Chromium (CDP `Accessibility.getFullAXTree`).
  - `accents-marc-x2.png` : un titre de la capture de Marc, agrandi deux fois.
- **Scripts des experts relancés** : `emojis.mjs` et `css-mort.mjs`. Les
  contrastes cités ont été recalculés : 2,39:1 et 2,49:1.
- **Rien d'autre n'a été lancé** : ni build, ni verify, ni tablée. L'atelier
  n'a servi qu'à fournir sa feuille de style. Aucun fichier du dépôt n'a été
  modifié.

---

## 1. L'écran commun

### E1 · Les réponses longues cassent les deux écrans de référence — P1 · S–M

**Sources**
- design-tele §2.
- design-telephone §1, et sa note « hors de ma mission » : la console recouvre
  les équipes, et « Question suivante » est refusé au toucher (« Quelque chose
  recouvre ce bouton »).
- accessibilite §3 : au texte à 200 %, les réponses passent sous le pli.
- La tablée, Nadia :
  - `025-q4-estimation-revelation.png` : la 6ᵉ estimation est coupée ;
  - `029-victoire.png` : la liste « Les joueurs » s'arrête au milieu de Hugo.

**Statut** : bug confirmé, par le code et par les captures.

**Preuve**
- Au téléphone :
  - `.quiz-player .ans-grid { align-content: center }` (`client/src/styles.css:1189`) ;
  - la page mesure exactement `100dvh` (`:1198-1202`) ;
  - la grille reçoit `min-height: 0` (`:1211`).
  - Les rangées en `min-content` débordent donc de la grille **des deux
    côtés**, et la première réponse recouvre la question. Voir la capture
    `design-telephone-1-reponses-longues.png`.
- À la télé :
  - `.ans-btn { overflow: hidden; padding: 0 22px }` (`:1250-1257`) et
    `.quiz-host .ans-btn { padding: 0 30px }` (`:1271-1277`) : aucune marge
    verticale, et la hauteur est imposée par la grille. Un texte de trois
    lignes est rogné en haut et en bas (`design-tele-1`).
  - `.host-console` (`:1024`) n'a pas de fond : à la révélation, « Piment »
    se lit derrière « Question suivante » (`design-tele-2`).
- La victoire et le podium défilent sur eux-mêmes (`.stage-scroll`, `:1090`),
  mais personne ne fait défiler une télé.
- L'éditeur accepte 120 caractères par réponse (`shared/library.ts:20`), et
  « Coller une liste » écrite par une IA en produit volontiers. Pour
  comparaison, l'import de Kahoot plafonne à 75 caractères (benchmark,
  note ³).

**Le 23 septembre** : l'axe 3 (#31) tient pour les cas qu'il visait (photo
réduite à la révélation, équipes au podium, QR de clôture entier, console sur
une ligne). Il ne tient pas pour celui-ci.

**Piste**
- Une marge verticale dans les cartes : 10 à 12 px.
- Un palier de taille pour les réponses de plus de 60 caractères environ,
  comme `questionSize.ts` le fait pour la question.
- Au téléphone : `align-content: safe center`, et une page qui défile plutôt
  que des cartes qui se chevauchent.
- À la télé :
  - les classements logés dans la rangée restante
    (`.reveal-boards { min-height: 0; overflow: hidden }`) ;
  - une console opaque (`background: var(--bg)`), pour qu'un débordement soit
    coupé au lieu d'être recouvert.
- Rejouer « Le pire cas » de design-tele à chaque retouche de l'écran commun.
- Optionnel : l'éditeur signale une réponse de plus de 75 caractères.

### E2 · Rien ne grandit au-delà de ~1 300 px de large : en 1920 × 1080, l'écran commun rapetisse — P1 · M

**Sources**
- design-tele §1, et son tableau « Tailles mesurées ».
- Les captures de la tablée en 1920 :
  - `marc/027-27-apres-quiz-salle.png` : une colonne « Invités » d'environ
    290 px, où « Inès » devient « In… », face à un panneau central de 1 160 px
    qui porte un QR de 160 px ;
  - `marc/020-20-pause.png` : des cartes de vrai/faux de 650 px de haut pour
    un « Vrai » de 31 px ;
  - `lea-tele/013` : la moitié basse de l'écran est vide.

**Statut** : bug de mise à l'échelle, confirmé dans le code. Les seuils de
lecture sont calculés (ISO 9241-303), pas mesurés devant une vraie télé.

**Preuve**
- `clamp(2rem, 4.4vw, 3.5rem)` (`styles.css:1094`, `:1122`) plafonne à
  1 273 px de large.
- Les réponses, `clamp(1.2rem, 2.4vw, 1.95rem)` (`:1276`), plafonnent à
  1 300 px.
- Le reste est fixe :
  - `.pill` 11 px (`:455-465`) ;
  - `.podium-name` 1,3 rem (`:1540`) ;
  - `.qr-box svg` 46 px (`:853`) ;
  - le QR d'accueil, `size={148}` (`HostApp.tsx:976`).

**Piste**
- La taille racine de `/host` calculée sur la hauteur de l'écran :
  `max(16px, 100vh / 48)`. Ça donne 16 px en 768 et 22,5 px en 1080.
- Puis passer les tailles de la scène en `rem`.
- Une précaution que l'expert ne signale pas : `/host` s'ouvre aussi sur le
  téléphone de l'animateur (Léa, benchmark §7). En 915 px de haut, la règle
  grossirait sa console de 19 %. Il faut la réserver aux grands écrans, avec
  `@media (min-width: 1100px)` ou `min(100vh / 48, 100vw / 85)`.
- Vérifier que 1366 × 768 ne bouge pas.

### E3 · La pause et les états de scène ne se lisent pas du canapé — P2 · S

**Sources**
- design-tele §5.
- Les trois animateurs de la tablée :
  - Léa, « seule une petite icône… Liam a demandé ce qui se passait » ;
  - Marc, « un petit "II" » ;
  - Nadia, « un "EN PAUSE" lisible de loin ».
- Au téléphone :
  - Liam et Lucas, qui ne voient qu'un bouton qui ne répond plus ;
  - Camille M., qui propose un signal à la reprise.

**Statut** : friction confirmée. Déjà notée le 23 septembre (idée de Nadia :
« une pause qui se voit du canapé »), toujours pas traitée.

**Preuve**
- À la télé :
  - en pause, seul le chiffre du chrono devient ⏸ (`TimerBar.tsx:62`) ;
  - « Regardez bien… » (`HostView.tsx:278`), « suivante dans N s » (`:32`) et
    le plus rapide (`:310`) sont des `.pill` de 11 px en capitales ;
  - « 11 / 12 ont répondu » fait 14 px (`styles.css:840`).
- Au téléphone :
  - la pause est un simple `.hint` atténué (`PlayerView.tsx:248-252`) ;
  - les réponses sont désactivées mais gardent leur aspect
    (`disabled={v.paused || closes}` à `:275`, estompées seulement si
    `closes`, à `:281`). Un toucher ne fait donc rien, en silence
    (`camille-m/008-question-en-pause.png`).

**Piste**
- Un bandeau d'état de scène unique, en serif à environ 1,6 rem :
  - « En pause » ;
  - « Regardez bien : la photo va disparaître » ;
  - « Question suivante dans 7 s » ;
  - « Kévin a répondu le plus vite : 1,11 s ».
- Au téléphone, « En pause » en grand, et les réponses visiblement éteintes.
- Pendant une estimation, « 11 / 12 » en grand au centre.

### E4 · Prix, Victoire, Podium et clôture restent sur l'écran qui les ouvre — P2 · S (minimum) à M

**Sources**
- design-tele §7 : la télé reste sur « Soirée close » pendant tout le quiz
  suivant.
- La tablée, Léa, bug 4 : « Prix » et « Victoire » ouverts depuis son
  téléphone ne passent pas à la télé, « j'ai dû me lever »
  (`lea/022`, `lea-tele/015`, `lea-tele/017`).

**Statut** : bug confirmé dès qu'il y a deux écrans. Or c'est justement ce que
recommandait l'axe 2 du 23 septembre (« la console sur le téléphone de
l'animateur »).

**Preuve**
- `screen` est un état local de la page (`HostApp.tsx:242`).
- La clôture se pose sur tous les écrans (`:272-274`), mais ne s'efface que
  sur celui où l'on clique « La soirée suivante » (`:619-624`).
- `cloture` n'est vidé nulle part ailleurs (`client/src/socket.ts:99`).
- Au rendu, la clôture passe avant le quiz (`:607` avant `:951`).

**Piste**
- Au minimum : `setScreen(null)` et `cloture: null` dès qu'une question
  démarre.
- Mieux : la scène de fin dans l'instantané, avec une commande `host:scene`.
  Elle ne change pas à chaque tick, donc l'invariant 4 est respecté.
- Une nouvelle commande `host:*` doit aussi entrer dans `garde-fous.test.ts`.

### E5 · En Velours, le nombre de ceux qui se sont trompés tombe à 2,39:1 — P2 · S

**Sources** : design-tele §6 et accessibilite §10.

**Statut** : bug confirmé. Même en grand texte, 2,39:1 reste sous le seuil de
3:1 de WCAG 1.4.3.

**Preuve**
- `--dim-carte: var(--dim)` en Velours voile toute la carte, compte compris
  (`styles.css:78-81` et `:1308-1309`).
- Recalcul : champagne à 38 % sur `#1a1412`, soit 2,39:1.
- Sur `design-tele-2`, les comptes « 6 », « 1 » et « 3 » sont presque
  éteints.
- Le correctif d'Ivoire (`:149-154`, dont le commentaire décrit ce bug même)
  n'a pas été porté à Velours.

**Piste** : `--dim-carte: 1; --dim-contenu: var(--dim);` à la racine. Deux
lignes, puis vérifier à l'œil que la carte reste « éteinte ».

### E6 · Sur la console, « Camille (2) » devient « Camil… » : la marque d'homonymie est coupée — P2 · S

**Sources**
- La tablée, Nadia : « J'ai déplacé l'une des deux au hasard »
  (`nadia/016-equipes-melangees.png`).
- La tablée, Marc : « In… » et « Rachid (t… » en 1920 (`marc/027`).
- design-tele §9 : les prénoms sont coupés à 9 caractères.

**Statut** : bug confirmé. Il va contre l'esprit de l'invariant 17 : la marque
est bien écrite, mais coupée là où l'animateur agit. Les `aria-label`, eux, la
gardent (`HostApp.tsx:160`, `:187`, `:206`).

**Preuve** : `.chip-name { max-width: 9ch }` (`styles.css:1855-1866`).
design-tele cite `styles.css:1005`, mais cette règle-là est du CSS mort
(voir S7) : le constat tient, la ligne est fausse.

**Piste**
- Ne jamais couper la marque : le prénom dans un `span` qui peut se couper, la
  marque « (2) » dans un autre en `flex: none`.
- Relever le plafond à 16 ch au-delà de 1 600 px.
- Élargir la colonne des invités en 1920 (voir E2).

### E7 · La remise des prix se joue en coulisses, devant la salle — P2 · M (la scène) et S (les textes)

**Sources**
- design-tele §8 et mots §2.
- La tablée :
  - Marc : « une grille de 15 cartes… tous les lauréats affichés d'un coup ».
    Ses prix pour rire ont renversé la victoire ;
  - Nadia : « projetée alors qu'elle me parle à moi », et « le "1" n'a pas
    d'étiquette » ;
  - Léa : ne se voit pas à la télé (E4) ;
  - Liam : n'a rien compris.
- L'axe 2 du 23 septembre (la remise en scène, effort L) n'a pas été traité.

**Statut** : friction confirmée. En partie en tension avec le README
(l. 454 : la télé porte aussi la console).

**Preuve**
- La consigne projetée : « tant que tu ne cliques pas… sur l'échelle du
  barème… d'expérience » (`HostApp.tsx:725-729`, capture `mots-2`).
- Au souvenir, « sans équipe — aucun point à donner » (`AwardsBoard.tsx:70`).
- Le champ des points n'a ni `<label>` ni `aria-label`, et il se lit par
  `Number(e.target.value)` (`AwardsBoard.tsx:78-83`, capture `nadia/027`).
- Rien ne montre ce qu'un prix fait au classement des équipes avant le clic.

**Piste**
- (S) Un sous-titre pour la salle ; la mécanique rangée dans un `title` de la
  console ; une étiquette « points d'équipe » au champ.
- (M) Un prix à la fois, en scène.
- (M) Avant d'attribuer, afficher l'effet : « +1 aux Guitaristes → égalité
  avec les Arrabbiata » (idée de Nadia et de Marc).

### E8 · Podium et classements : les moments forts écrits trop petit — P2 · S

**Sources** : design-tele §3 et son tableau des tailles. La capture
`design-tele-3` montre des prénoms de 20,8 px sous des marches de 400 px.

**Statut** : friction confirmée dans le code, avec des seuils calculés.

**Preuve**
- `.podium-name` 1,3 rem (`styles.css:1540`) ;
- `.lb-name` 16 px par héritage (`:779`) ;
- `.team-sub` 12 px (`:2061`).

**Piste**
- Sur `.host.staging` : les noms du podium à 2,6 rem, les lignes de classement
  à 1,35 rem.
- Retirer de la télé le sous-titre « 4 membres · 2 967 pts ».

### E9 · Les QR ne se scannent pas du canapé — P3 · S

**Sources** : design-tele §4, et Marc (« il faut se lever »).

**Statut** : friction. La portée suit la règle « dix fois la largeur », et n'a
pas été mesurée avec un vrai téléphone.

**Preuve**
- Le QR d'accueil fait 148 px fixes (`HostApp.tsx:976`).
- Le QR du souvenir, `clamp(84px, 11vh, 124px)` (`styles.css:4149`).

**Pourquoi P3 et pas P2** : la fin de soirée de chaque téléphone mène déjà au
souvenir d'un toucher (`FinDeSoiree.tsx:177-179`).

**Piste** : à la clôture, le QR au centre, `min(34vh, 360px)`.

### E10 · La télé montre la console, la gestion des invités, la liste des quiz — P3 · M — tension

**Sources**
- design-tele §8.
- Léa, Marc (écran recopié) et Nadia (« Choisis un quiz » projeté).
- L'axe 2 du 23 septembre, non résolu.

**Statut** : tension avec un parti pris. Le README (l. 454) veut une console
« en bas, toujours au même endroit » de l'écran commun.

**Piste** : les contrôles d'équipe repliés derrière un bouton « Organiser ».
La vraie réponse est la télécommande (C3).

### E11 · De la place perdue, et une question repliée en colonne — P3 · S

**Sources**
- design-tele §9 : photo d'observation à 56 % de la hauteur, vrai/faux géants
  à texte de 31 px, trois cinquièmes vides pendant une estimation.
- design-telephone §9 : `text-wrap: balance`.
- Nadia, bug 4 : « Sam a- / t-il marché », et un titre qui n'occupe que la
  moitié gauche de l'écran.

**Statut** : friction confirmée (`styles.css:1108-1114`, `:1125`).

**Piste**
- La photo d'observation en `max-height: calc(100vh - 220px)`.
- Le texte du vrai/faux doublé.
- `text-wrap: pretty` au téléphone.
- Un trait d'union insécable (U+2011) dans « -t- », posé par `espacesFines`.

### E12 · Une révélation sans suspense — P3 · S — idée

**Sources** : design-tele §11, et Marc (« un prix à la fois… L'Éclair…
Inès ! »).

**Piste**
- Au podium : 3ᵉ, puis 2ᵉ, puis 1ᵉʳ.
- À la révélation : les mauvaises réponses s'éteignent d'abord.
- Le tout coupé sous `prefers-reduced-motion`, comme aujourd'hui.

---

## 2. Le téléphone

Les réponses longues qui chevauchent la question sont traitées avec la télé,
en **E1**.

### T1 · Le souvenir : « Les équipes au quiz » se défont en cascade de lettres au texte agrandi — P2 · S — nouveau

**Sources**
- La tablée, Jeanne : « coupé en une lettre ou deux par ligne… j'ai eu peur
  d'avoir cassé l'écran » (`jeanne/011-souvenir-palmares.png`, au texte à
  130 %).
- Déjà visible à 100 % dans `design-telephone-3-podium-inverse.png` : « Les
  Carbo… », et un détail sur trois lignes. Aucun expert ne l'a relevé.

**Statut** : bug confirmé, **reproduit sans le zoom CSS du banc**. Dans une
vraie fenêtre de 277 px (un 360 px au zoom de page de 130 %), la colonne du
nom mesure 14 px ; en 360 px, 97 px.

**Preuve**
- `TeamBoard.tsx:49-74` aligne sur une ligne :
  - un rang de 1,7 em ;
  - l'avatar ;
  - le nom (`flex: 1; min-width: 0`, `styles.css:779`) ;
  - le chiffre cerclé (`min-width: 2.2em`) ;
  - le score.
- Le détail (`.team-sub`, `white-space: normal`, `:2061`) passe donc à la
  ligne à chaque mot.
- Voir `export/evaluations/verification/design/equipes-souvenir-277px.png`.

**Piste**
- Sous environ 380 px de large, le nom et son détail prennent une ligne
  entière (`flex-wrap`, ou une requête de conteneur).
- Ou le détail disparaît en largeur étroite.
- Test : aucune colonne de nom sous 80 px à 277 px de large.

### T2 · Au texte agrandi, les avatars de l'entrée se chevauchent — P2 · S

**Sources**
- design-telephone §2 et accessibilite §3 (captures `design-telephone-2`,
  `accessibilite-1`).
- Déjà en contact à 130 % sur `jeanne/002-prenom-avatar.png`.

**Statut** : bug confirmé en émulation du zoom de page, à revérifier sur un
vrai Android.

**Preuve**
- `repeat(6, minmax(0, 1fr))` (`styles.css:549-553`) ;
- `aspect-ratio: 1` (`:555`) ;
- 44 px au doigt (`:2426`).
- Quand la colonne descend sous 44 px, les boutons se recouvrent : toucher le
  koala peut choisir le lion.

**Piste** : `repeat(auto-fill, minmax(44px, 1fr))`.

### T3 · Le podium ment (téléphone) ou ne dit rien (télé) — P2 · S

**Sources**
- design-telephone §3 : sur le souvenir, le vainqueur au nom long est sur la
  plus petite marche.
- design-tele §10 : à 1 030, 882 et 828 points, trois blocs presque égaux.
- Léa (`lea-tele/014`).

**Statut**
- Au téléphone : bug confirmé (capture `design-telephone-3`).
- À la télé : friction. La proportionnalité est un choix, mais elle ne se lit
  plus.

**Preuve**
- `height: 30 + 70 × points/meilleur %` (`Podium.tsx:75`).
- La colonne fait 100 % de haut, et la marche est un élément flexible qui
  rétrécit (`styles.css:1530-1556`).
- Un nom sur trois lignes vole donc la hauteur de sa marche.

**Piste**
- Une marche en px, non rétrécissable (`flex-shrink: 0`).
- Un écart minimal entre deux rangs distincts.
- Le nom sur deux lignes au plus.
- Test : la marche du rang 1 est la plus haute.

### T4 · Au-delà de 8 invités, on ne se voit plus dans le classement — P2 · S

**Source** : design-telephone §4.

**Statut** : friction confirmée dans le code.

**Preuve** : `compact ? rows.slice(0, 8)` (`Leaderboard.tsx:29`), appelé en
compact par `PlayerApp.tsx:380`. Or une vraie soirée compte 15 à 50 invités.

**Piste** : après la 8ᵉ ligne, « ⋯ » puis sa propre ligne, surlignée. Le rang
vient de `classer`, donc les ex æquo restent justes.

### T5 · « Trop tard ! » pour qui n'a rien touché, et aucun état « envoi… » hors ligne — P2 · S (le libellé) puis M

**Sources**
- design-telephone §5.
- Camille M. : « directement "Trop tard", sans détail ».
- Karim : la coupure en plein clic, puis rien.
- Déjà l'idée de Karim le 23 septembre : distinguer « rien proposé » de
  « pas partie ». Non faite.

**Statut** : friction confirmée dans le code.

**Preuve**
- `yourChoice === null` affiche « Trop tard ! » (`PlayerView.tsx:352-358`).
- Pareil pour l'estimation (`:327-332`).
- `.chosen` n'apparaît qu'à la vue du serveur (`:281`).

**Piste**
- « Pas de réponse », neutre, distinct de « Trop tard ! », réservé au refus
  `too-late`.
- Un état `.pending` sur la carte dès qu'on la touche.

### T6 · Au texte très agrandi, la question déborde et les mots se coupent — P3 · S

**Sources**
- design-telephone §6 : « Auc / une ».
- accessibilite §3 : `accessibilite-2`, où « l'Exposition » est coupé à droite.

**Statut** : friction. Elle est en partie grossie par le banc : son zoom CSS
gonfle `dvh`, ce que design-telephone écarte à juste titre.

**Preuve** : `.ans-text { overflow-wrap: anywhere }` (`styles.css:1302`).

**Piste**
- `overflow-wrap: break-word; hyphens: auto`.
- Un plafond à la taille du titre de la question.
- Le chrono collant en haut.

### T7 · Des cibles sous 44 px — P3 · S

**Source** : design-telephone §8.

**Statut** : confirmé en partie.
- Confirmé : les lignes de classement qu'on touche font 40 px, sans règle au
  doigt (`.lb-ouvrable`, `styles.css:4093-4099`).
- **Non confirmé sur un vrai téléphone** : `.btn-small` à 36 px. La règle
  `@media (pointer: coarse)` le porte à 44 px (`:2404-2410`), et le mesureur
  tournait sans écran tactile.
- Les liens de 17 px entrent dans l'exception de WCAG 2.5.8 pour le texte.

**Piste**
- `.lb-ouvrable { min-height: 44px }`.
- Élargir la zone des `.link-inline` hors d'une phrase.

### T8 · « Identifiant ou mot de passe incorrect » reste affiché sous le nouveau code de secours — P3 · S — nouveau

**Source** : la tablée, Malik (`malik/004-nouveau-code-secours.png`).

**Statut** : bug confirmé dans le code.

**Preuve**
- « J'ai oublié mon mot de passe » passe à l'étape `secours` sans vider
  l'erreur (`Entree.tsx:224`).
- L'écran du code l'affiche ensuite (`Entree.tsx:499`).

**Piste** : `setErreur('')` au passage à `secours`.

### T9 · « 0 joueurs ce soir » pour qui n'a joué aucune question — P3 · S — nouveau

**Source** : la tablée, Inès (`ines/011-fin-soiree-lea.png`).

**Statut** : bug confirmé dans le code.

**Preuve**
- `joueurs: x?.releve.joueurs ?? 0` (`server/src/core/space.ts:1044`) : un
  invité arrivé après la dernière question n'a pas de relevé.
- Or c'est la seule branche qui affiche ce compte (`FinDeSoiree.tsx:75`).
- Le « joueurs » est au pluriel même pour zéro.

**Piste**
- Compter la salle comme le fait `carteDe` (`space.ts:387`).
- Pour cet invité, écrire « Tu n'as pas joué de question ce soir ».

### T10 · La fin de soirée met en avant ce qu'on ne peut pas faire — P3 · S

**Sources**
- Zoé : « Rejoindre la soirée suivante » en bouton plein doré, alors que rien
  n'est ouvert.
- Jeanne : le prix gagné n'y figure pas.
- design-telephone (le tableau des variantes de boutons).

**Statut** : friction confirmée (`FinDeSoiree.tsx:174-179`).

**Piste**
- « Revoir la soirée » en bouton principal.
- Les prix de l'invité sur sa propre fin de soirée.

### T11 · La tablette est un téléphone étiré — P3 · M — idée

**Sources** : design-telephone §10, Bertrand, Zoé.

**Piste** : au-delà de 700 px de large, une colonne de 640 px et des réponses
plus hautes.

### T12 · Les petits détails — P3 · S

**Sources** : design-telephone §11, et Karim (« le minuteur n'est plus
visible » pendant la coupure).

**Statut** : confirmés dans le code, sauf les emojis.
- La pastille « Reconnexion… » écrase le prénom.
- Le badge de niveau fait 11,2 px, en chiffres elzéviriens (`.niveau`,
  `styles.css:2893-2905`).
- Le podium du téléphone ne marque pas « moi ».
- Coupure « e- / mail ».
- Pas d'œil pour afficher le mot de passe.
- Emojis monochromes : **non confirmé**. Vu sous Linux ; aucune police
  d'emoji n'est déclarée, mais Windows et Android ont les leurs.

---

## 3. Le système de design

### S1 · Les champs numériques refusent d'être vides : « 2045 », « 020 », « 02 » — P2 · S — nouveau dans ce groupe

**Sources**
- La tablée : Léa (« 2050 » sur huit questions), Nadia (« 2045 »,
  « 010 »), Marc (« 020 » dans « Invités au plus », « 02 » aux points d'un
  prix libre).
- editeur §2, qui ne traite que le champ Temps.

**Statut** : bug confirmé. La convention de CLAUDE.md n'est pas tenue :
« Un nombre tapé se lit avec `lireNombre()`… Le champ garde le texte tapé ».

**Preuve** : cinq champs contrôlés lus par `Number(e.target.value)`, où
`Number('')` vaut 0 et la valeur revient aussitôt :
- `EditorApp.tsx:1560` et `:1650` ;
- `AccountApp.tsx:320` ;
- `AwardsBoard.tsx:83` ;
- `HostApp.tsx:777`.

**Piste** : un composant du système, `ChampNombre`, qui garde le texte tapé,
le lit par `lireNombre` et dit ses bornes. À faire en commun avec la mission
éditeur.

### S2 · Pas de `color-scheme` : les contrôles natifs restent blancs sur Velours — P3 · S

**Source** : design-systeme §1 (capture `design-systeme-1`).

**Statut** : confirmé.
- `grep color-scheme` ne trouve rien.
- `accent-color` n'est posé qu'aux lignes `:1700` et `:2206`.
- Les listes d'équipe de la télé sont touchées aussi (`HostApp.tsx:183`), et
  la salle les voit.

**Piste** : `color-scheme: dark` et `accent-color: var(--accent)` à la racine,
`light` en Ivoire.

### S3 · Le survol écrit en `--accent-hover` : 2,49:1 en Ivoire — P3 · S

**Source** : design-systeme §2.

**Statut** : incohérence confirmée. Recalcul : `#c0973f` sur `#f9f5ec`, soit
2,49:1. La règle `--accent-text` de CLAUDE.md ne couvre pas l'état survolé.

**Preuve** : `styles.css:205`, `:424` (le « Révéler » de la console) et
`:1793`.

**Piste** : un jeton `--accent-text-hover`, à `#6b511a` en Ivoire.

### S4 · Aucun jeton hors couleur — P3 · M — dette

**Source** : design-systeme §3, 4, 5, 9, 13 et 14 : 84 tailles de police,
8 recettes de l'étiquette en capitales, 16 opacités du champagne, des rayons
en dur, une grille de 2 px implicite, des `z-index` sans nom.

**Statut** : dette confirmée par l'inventaire. Un effet visible aujourd'hui :
le filet de `.btn` est écrit en dur à 0,26 (`styles.css:371`) et ne suit pas
l'`--edge` d'Ivoire (0,38). Les boutons y sont plus pâles que les cartes.

**Piste** : l'échelle proposée par l'expert. D'abord `.btn` sur `--edge`, puis
une section à la fois, en regardant en 360 et en 1366.

### S5 · L'état « sélectionné » a trois recettes — P3 · M — dette

**Source** : design-systeme §6.

**Statut** : confirmé : `.ans-btn.chosen` (`:1305`), `.team-btn.selected`
(`:2110`), `.finition-btn.selected` (`:3007`), `.galerie-case.porte`
(`:3972`).

**Piste** : une seule règle, posée sur `aria-pressed` ou `aria-checked`. Mais
une classe pour `.galerie-case`, dont l'`aria-pressed` veut dire « détail
ouvert ».

### S6 · Les couleurs des récompenses, écrites en dur — P3 · S — dette latente

**Source** : design-systeme §8.

**Statut** : confirmé : rareté (`:3047-3049`), bronze et argent
(`:4028-4029`). Rien n'est visible aujourd'hui, puisque ces pages sont en
Velours. Mais l'argent sur la crème donnerait 1,64:1, et les fiches du bilan
sont forcées en Ivoire (`BilanApp.tsx:73`).

### S7 · Du CSS mort : six classes — P3 · S

**Source** : design-systeme §11.

**Statut** : confirmé. Aucune référence dans `client/src` ni `shared` pour
`.a-decrocher`, `.a-decrocher-liste`, `.chips`, `.player-chip .player-name`,
`.podium-actions` et `.question-timer` ; `css-mort.mjs` a été relancé.

C'est plus qu'une question de propreté : design-tele a pris la règle morte
`:1005` pour la cause de la coupure des prénoms (voir E6).

### S8 · Des composants sans nom — P3 · S — dette

**Source** : design-systeme §10.

**Statut** : confirmé.
- L'éditeur emprunte `.team-emoji-select` (`EditorApp.tsx:1538`).
- `.pill-btn` et `.pill-button` sont deux choses différentes.

**Piste** : un en-tête « Composants » dans `styles.css`.

---

## 4. Les mots

### M1 · Comment une équipe gagne : quatre explications, un mot de jargon, une phrase fausse — P1 · S

**Sources**
- mots §1, et design-tele §8 (la légende « Le chiffre cerclé… » coupée au
  mur).
- La tablée :
  - Nadia, « j'ai dû me reprendre devant tout le monde » ;
  - Marc, « mes prix pour rire ont renversé la victoire… devant toute
    l'agence », et « une légende obscure toute la soirée » ;
  - Liam : « chiffre cerclé… non compris du tout ».
- Seul Bertrand trouve « à la moyenne par membre » clair. La phrase du
  téléphone, à elle seule, passe.

**Statut** : bug de texte confirmé, et du jargon (« barème », « chiffre
cerclé »).

**Preuve** : quatre textes différents.
- Au téléphone (`PlayerApp.tsx:366-369`).
- Au mur :
  - au podium (`HostApp.tsx:680-682`) ;
  - dans le panneau des équipes (`:1063-1066`) ;
  - à la victoire (`:909-912`).
- Au souvenir (`RecapApp.tsx:150-155`).
- Et `TeamBoard.tsx:64-67` (« au barème »).

La victoire dit « le gros chiffre est **le total du quiz** ». Or le score d'un
joueur est celui de la soirée (README l. 3 : « un classement cumulé traverse
tous les quiz ») et `finalPoints` en dérive (`shared/teams.ts:49-52`). Dès le
deuxième quiz, la phrase est fausse.

Le code révèle en plus une incohérence : le téléphone classe les équipes à la
seule moyenne (`TeamBoard` en compact, sans `showFinalPoints`,
`PlayerApp.tsx:365` puis `TeamBoard.tsx:38`), alors que la télé les classe au
barème, prix compris. Après une remise de prix, le téléphone et la télé
n'affichent pas le même premier.

**Le 23 septembre** : l'axe 1 (#27) a unifié le verdict (`VerdictDesEquipes`).
Ça tient. Mais la légende s'est multipliée.

**Piste**
- Un seul mot, « points d'équipe », et une seule phrase rangée dans
  `shared/`, reprise partout.
- Au téléphone, le même classement que la télé.
- Avec E7 (M) : montrer ce que fait un prix avant de cliquer.

### M2 · Le profil promet « tes points » — P2 · S

**Sources** : mots §3, et Jeanne, qui cherche justement « retrouver ses
points ».

**Statut** : texte trompeur confirmé. Il va contre l'esprit de l'invariant 8.

**Preuve**
- La bonne version : `Entree.tsx:256`.
- Les fausses : `ProfilForm.tsx:132` (« garde tes points ») et
  `FinDeSoiree.tsx:187` (« tu retrouves tes points »).
- `ProfilApp.tsx:161` écrit « 0 / 60 vers le niveau 2 », sans unité.

**Le 23 septembre** : la synthèse suggérait « Retrouve tes points et tes prix
la prochaine fois » pour Jeanne. **#28 l'a écrit** (commit 468d295). La
correction d'hier a donc créé la promesse fausse d'aujourd'hui. Le mot qui
parle à Jeanne n'est pas le mot juste : c'est à arbitrer.

**Piste** : une seule constante, `PITCH_PROFIL`, par exemple « garde ton
niveau, tes prix et tes avatars ». Et « XP » après le compteur.

### M3 · « Annuler les points de cette question ? » → [Annuler] [Retirer les points] — P2 · S

**Source** : mots §6.

**Statut** : confirmé. Sous pression, l'animateur qui veut annuler les points
touche « Annuler »… et ferme la boîte sans rien faire.

**Preuve** : `HostView.tsx:202-205`, avec le libellé par défaut
`Dialog.tsx:176`.

**Piste** : `cancelLabel: 'Garder les points'`.

### M4 · Les mêmes noms pour deux choses — P3 · S

**Source** : mots §4.

**Statut** : confirmé.
- « Le Devin » est un prix du coup d'œil (`server/src/core/stats.ts:358-361`)
  et un haut fait des estimations exactes (`shared/hautsfaits.ts:295`). Or
  les estimations exactes ont déjà leur prix, « Le Pile-Poil »
  (`stats.ts:398-400`).
- « Le Phénix » et « L'Oracle » sont à la fois des hauts faits et des
  légendaires (`hautsfaits.ts:89`, `:107` ; `legendaires.ts:49`, `:63`). C'est
  un choix qui se défend.
- « Retrouver mon profil » désigne deux écrans (`ProfilForm.tsx:123`,
  `Secours.tsx:48`).

**Piste** : renommer le titre du prix. La clé `devin` reste, donc rien à
toucher à `VERSION_BAREME`.

### M5 · Des mots qui disent le contraire de ce qu'ils montrent — P3 · S

**Sources** : mots §6, et Léa (un « Sans-Faute » à 71 %, ex æquo).

**Statut** : confirmé.
- « Le Sans-Faute » est décerné à 67 % (`stats.ts:309-313`).
- La victoire sans équipes affiche « Aucune équipe — rien à couronner »
  (`HostApp.tsx:859`, `:940`), alors que Jo a gagné la soirée.
- La boîte dit « Retirer « Jo » ? », le bouton « Exclure »
  (`HostApp.tsx:209-211`).
- « Enregistré à 24 sept., 17:10 » (`EditorApp.tsx:749`).
- L'aperçu de l'éditeur (`:894`) n'écrit pas ce que dit le mur
  (`HostView.tsx:377`).

### M6 · L'élision oubliée hors du titre de l'espace — P3 · S — nouveau

**Sources**
- La tablée : Marc (« Le bilan de Inès », sur les fiches imprimées) et Léa
  (« Équipe de Inès »).
- L'expert accessibilité cite « La carte de Iris » sans le relever.
- mots §11 : le surtitre « La soirée d’ » reste seul sur sa ligne (visible
  sur `accessibilite-1`).

**Statut** : confirmé : `BilanApp.tsx:305`, `HostApp.tsx:187`,
`Leaderboard.tsx:51`, `CarteJoueur.tsx:59`. La fonction `deNom` existe déjà
(`shared/typographie.ts:27`).

**Le 23 septembre** : l'axe 7 (#28) n'a corrigé que le titre de l'espace.

**Piste**
- `deNom` partout où un prénom suit « de ».
- Le surtitre « La soirée », et le grand titre « d’Hélène ».

### M7 · Au mur, « ZOÉ — 8.90 S » — P3 · S — nouveau

**Sources**
- La tablée, Léa, bug 7 (`lea-tele/013`).
- Visible sur `design-tele-2` (« KÉVIN — 1.11 S »), sans que l'expert le
  relève.
- mots §11 (les unités en capitales).

**Statut** : confirmé. `(v.fastest.ms / 1000).toFixed(2)` (`HostView.tsx:310`)
écrit un point décimal à l'anglaise, alors que `secondes()` existe
(`client/src/format.ts:11`). Et `.pill` passe tout en capitales, unité
comprise.

**Piste** : `secondes(ms)`, et l'unité hors des capitales.

### M8 · Une année s'écrit « 1 889 » — P3 · S

**Source** : mots §7 (capture `mots-1`).

**Statut** : confirmé : `toLocaleString('fr-FR')` (`format.ts:5`) groupe dès
quatre chiffres. Ça reste lisible, d'où P3.

**Piste** : ne grouper qu'à partir de cinq chiffres.

### M9 · Le même chiffre sous trois noms — P3 · S

**Source** : design-telephone §7.

**Statut** : confirmé.
- « Réussite » au bilan (`BilanPlayer.tsx:98`, `BilanRoom.tsx:73`).
- « Précision » au profil (`Carriere.tsx:340`).
- « 4/6 justes » sur la carte (`format.ts`, `reponsesParType`).
- Les nombres s'écrivent tantôt « 1154 », tantôt « 1 154 ».
- « 0 pts » et « 1 invité·e·s ».

CLAUDE.md dit « précision ».

**Piste** : un libellé, un format, et `motPoints()` partout.

### M10 · Une page, quatre noms ; des onglets qui ne disent pas ce qu'ils montrent — P3 · S

**Sources** : mots §5, et Liam (« souvenir », « bilan » : non compris).

**Statut** : confirmé.
- La liste des soirées porte quatre noms : Mes soirées, Soirées, Historique,
  Les soirées.
- La page s'intitule « Le bilan du quiz » (`BilanApp.tsx:216`), alors
  qu'elle couvre toute la soirée.
- La date est écrite trois fois (`ArchiveBanner.tsx:18-19`).

### M11 · Le masculin par défaut, et le point médian — P3 · S — choix de ton à arbitrer

**Sources** : mots §8, et Camille D. (« Content de te revoir »).

**Statut** : confirmé : `Entree.tsx:298`, `socket.ts:70`,
`sockets.ts:555-556`, `HostApp.tsx:530`, `StatsTable.tsx:20-39`,
`RecapApp.tsx:216`.

**Le 23 septembre** : l'axe 7 (#28) a mis les rangs au féminin quand il le
faut, pas le reste.

**Piste** : des tournures épicènes, sans point médian.

### M12 · Des mots jamais expliqués — P3 · S

**Sources**
- mots §9.
- La tablée : Jeanne (« Biais », « Écart estim. », « Coup d'œil ») et Liam
  (« Coup d'œil », « Le Cancre Magnifique »).
- Déjà demandé le 23 septembre par Sofia (une légende des colonnes). Non fait.

**Statut** : confirmé.
- « badges » (`Entree.tsx:304`) ;
- « soirée qui compte » (`ProfilApp.tsx:293`) ;
- « Clique sur un en-tête » sur un téléphone (`RecapApp.tsx:185`) ;
- les colonnes abrégées de `StatsTable.tsx`.

**Piste**
- Une légende qu'on peut déplier sous le tableau, faite des `title`.
- « Touche » plutôt que « Clique ».
- La colonne « Écart estim. » relève d'une tension : voir plus bas.

### M13 · « Quizz » reste le nom de l'appli installée — P3 · S

**Source** : mots §10.

**Statut** : confirmé : `client/public/manifest.webmanifest:2-3` et
`client/index.html:23`.

**Le 23 septembre** : un reste de l'axe 7. #28 a corrigé l'onglet, pas le
manifeste.

### M14 · Des erreurs qui ne disent pas quoi faire — P3 · S

**Source** : mots §12.

**Statut** : confirmé. Convention de CLAUDE.md (« elles disent quoi faire »)
non tenue :
- « La soirée est complète ! » (`sockets.ts:320`), que reçoit un invité ;
- « Pas ton propre compte » (`auth/routes.ts:266`) ;
- « Image trop lourde » (`quizStore.ts:200`) ;
- « Format d'image non supporté » (`:204`) ;
- « Oups » (`main.tsx:128`) ;
- « Impossible » (`PlayerApp.tsx:178`) ;
- « (/edit) » dans un message (`games/quiz.ts:518`).

### M15 · La typographie et les petites incohérences — P3 · S

**Source** : mots §11.

**Statut** : confirmé par échantillon.
- Apostrophes droites et courbes mêlées.
- « wifi » (`Liaison.tsx:25`, `erreurs.ts:15`).
- Anglicismes : « Top du quiz » (`HostView.tsx:450`), « GO ! »
  (`GetReady.tsx:37`), « Éditer ».
- « pile-poil » et « pile poil ».
- « bloc(s) ignoré(s) ».
- Pour un même geste : Revenir ou Retour, réessaie ou retente.

---

## 5. L'accessibilité

### A1 · Les boutons bascule disent l'inverse, ou ne disent rien — P2 · S

**Source** : accessibilite §2.

**Statut** : bug confirmé (WCAG 4.1.2).
- Le son : le libellé change **et** `aria-pressed={!muted}`. Son allumé, un
  lecteur d'écran lit donc « Couper les sons, activé » (`HostApp.tsx:1088-1090`).
- Le thème fait de même : « Revenir au fond sombre », avec
  `aria-pressed=true` (`:1103-1104`).
- Aucun état sur :
  - le multiplicateur (`HostView.tsx:236-243`) ;
  - QCM / Estimation (`EditorApp.tsx:1375-1388`) ;
  - et, en plus de ce que relève l'expert, les onglets « Les équipes / Les
    joueurs » du podium (`HostApp.tsx:646-660`).

**Piste**
- Un libellé fixe, et l'état porté par `aria-pressed`.
- Un test qui exige `aria-pressed` sur chaque `.pill-btn`.

### A2 · Le focus des champs se voit à peine, et les anneaux sont dispersés — P2 · S

**Sources** : accessibilite §1 et design-systeme §7.

**Statut** : friction confirmée (WCAG 2.4.7 partiel).
- Le seul signe du focus d'un champ est un filet d'un pixel qui passe de 60 %
  à 100 % d'or, soit 2,27:1 entre les deux états (`styles.css:341`, `:357`).
- L'anneau des boutons est recopié en 9 sélecteurs (`:389-399`) et ailleurs.
- Six composants gardent l'anneau par défaut du navigateur : c'est une
  incohérence, pas une absence de focus.

**Piste** : un `:where(…):focus-visible` global, et un vrai anneau sur
`.input` et `.input-line`.

### A3 · Le temps : seule une pause collective — P2 · S–M — tension avec un parti pris

**Sources**
- accessibilite §4 (WCAG 2.2.1).
- benchmark §4 (« Extended Timers » de Jackbox).
- La tablée : Bertrand, qui n'a pas vu la photo à mémoriser en posant sa
  tablette, sans rattrapage possible ; Karim, dont la question est passée
  pendant son entrée.

**Statut** : tension. Le chronomètre partagé est le jeu, et WCAG 2.2.1 admet
l'exception du temps réel. Mais la pause reste entre les mains d'un
animateur qui ne sait pas qu'un invité en a besoin. Et `LECTURE_MS` est un
barème, dont on ne change pas la valeur sans le dire (CLAUDE.md).

**Piste**
- Un réglage de soirée, « Temps : normal · +50 % · ×2 », appliqué par le
  serveur à `duration` et persisté (invariant 5). Le même pour tous, donc
  l'équité tient.
- Une phrase sous « Temps » dans l'éditeur.

### A4 · Des noms qui manquent — P3 · S

**Sources** : accessibilite §6 et §7, et Nadia (le champ des points d'un
prix).

**Statut** : confirmé.
- Six QR sans `title`, alors que `qrcode.react` pose `role="img"` et accepte
  un `title` : `Cloture.tsx:41`, `HostApp.tsx:535`, `:665`, `:834`, `:969`,
  `:976`.
- Le champ des points d'un prix n'a pas de nom (`AwardsBoard.tsx:78-83`) :
  l'expert n'avait pas passé cet écran.
- Aucun `<main>` (`grep` ne trouve rien).
- Des pages sans titre propre, des « Supprimer » répétés dans l'éditeur.

### A5 · Le focus se perd au changement de vue — P3 · S

**Source** : accessibilite §5.

**Statut** : confirmé par l'expert (`partie.mjs`), pas rejoué ici.

**Piste** : poser le focus sur le titre de la nouvelle vue, la console
d'abord.

### A6 · Des annonces en trop au téléphone — P3 · S

**Source** : accessibilite §9.

**Statut** : confirmé.
- Le 3-2-1 (`GetReady.tsx:36-38`) n'a pas `aria-live="off"`, et il vit dans
  la région annoncée du téléphone (`PlayerApp.tsx:287`) : chaque chiffre est
  lu.
- « regarde l'écran commun » ne dit rien à qui ne voit pas.

### A7 · Rien n'est annoncé à l'animateur au lecteur d'écran — P3 · S — idée

**Source** : accessibilite §8.

**Piste** : une région annoncée, discrète, réservée aux événements rares :
« Tout le monde a répondu », « Réponses closes », « Camille a rejoint la
soirée ».

---

## 6. Ce que les concurrents font mieux, et qu'on peut emprunter sans trahir

Les faits sur les concurrents viennent des sources citées par benchmark. Ils
ne sont pas revérifiés ici, et les cases « (mém.) » restent à revérifier. Le
versant FiestApp, lui, est vérifié dans le code.

### C1 · « Partir d'un modèle » pour tout nouvel espace — P2 · S

**Sources** : benchmark §1, et Marc (bibliothèque vide, puis l'impasse
« Importer un quiz »).

**Statut** : friction confirmée. `seedLibrary` n'importe
`server/content/quiz/*.json` qu'une fois, et dans l'espace de
l'administrateur seulement (`server/src/core/seed.ts:9-14`).

**Parti pris** : les quatre sont tenus.

### C2 · Le nom de la soirée à dire, et une entrée qui pardonne — P2 · S

**Sources**
- benchmark §2.
- La tablée : Camille M. (deux essais) et Maëlle (deux questions perdues
  avant d'entrer).
- Le 23 septembre, Camille M. avait déjà dû deviner l'adresse.

**Statut** : friction confirmée. « sam » mène tel quel à `/sam`, puis au refus
(`Rejoindre.tsx:20-27`, `:33-37`).

**Piste**
- Dans la bande « Rejoindre », une ligne « tape **chez-sam** ».
- Essayer `chez-<saisie>` avant de refuser. Aucun espace n'est listé, donc
  l'invariant 3 est tenu.

### C3 · Une vraie télécommande pour l'animateur — P2 · M — idée, demande forte

**Sources**
- benchmark §7.
- **Les trois animateurs de la tablée** : Léa, Marc et Nadia (« animer
  debout, près du gâteau »).
- design-tele §7.
- L'axe 2 du 23 septembre (effort L).

**Statut**
- Vérifié : `/host` s'adapte au téléphone, mais c'est l'écran commun
  rétréci, avec la console sous le pli.
- Les scènes de fin ne suivent pas la télé (E4).
- Tension avec le parti pris 3 **seulement** si la télécommande montre la
  réponse.

**Piste** : une mise en page « télécommande » sous 600 px de large, sans
nouvelle vue : l'action principale et « 3 / 4 ont répondu » en haut. Puis E4.

### C4 · « Partager la soirée » — P3 · S — idée

**Sources**
- benchmark §5.
- Léa : aucun bouton ; deux liens « Souvenir », dont celui de l'onglet qui
  pointe vers `/chez-lea/souvenir`, une adresse qui changera.
- Marc (la lettre d'information de l'agence).
- Déjà demandé le 23 septembre par Camille M. Non fait.

**Statut** : prémisse confirmée : aucun `navigator.share` dans `client/src`.

**Piste** : Web Share, sinon une copie, et toujours l'adresse d'archive.

### C5 · La lecture à voix haute, à la demande — P3 · S–M — tension

**Source** : benchmark §6.

**Statut** : aucun `speechSynthesis` dans le code. Tension avec le README :
le son sort de l'écran commun, pas des téléphones.

### C6 · Le prénom d'abord : trois gestes au lieu de quatre — P3 · S — tension

**Sources** : benchmark §3, et Karim et Rachid (le chemin d'entrée leur a
coûté une question).

**Statut** : tension avec CLAUDE.md : « L'entrée d'une soirée est un écran de
connexion… un choix assumé ». À décider, puis à mesurer par une tablée.

### C7 · Une question « sondage » — P3 · L — idée

**Source** : benchmark §8. Un chemin déjà ouvert par le README.

---

## 7. Ce qui avait été corrigé le 23 septembre : ce qui tient

| Axe (PR) | Ce qui tient | Ce qui ne tient pas, ou pas partout |
|---|---|---|
| 3 · écran commun en 1366 (#31) | photo réduite à la révélation, équipes au podium, QR de clôture entier, console sur une ligne (design-tele) | réponses longues avec photo, révélation d'une estimation à 6 lignes, liste de la victoire (E1) |
| 4 · finitions du téléphone (#29) | noms d'équipe avec « … », pseudo coupé dans l'en-tête, bouton au-dessus du clavier, « 35 000 » accepté, changement d'équipe annoncé (Jeanne, Hugo), retour du navigateur confirmé (Lucas) | — |
| 5 · accessibilité (#30) | « la bonne réponse » écrite au bilan, podium lu dans l'ordre des rangs, lignes de classement nommées, homonymes nommés dans les `aria-label`, question visuelle annoncée (accessibilite, Hugo) | — |
| 7 · les mots (#28) | tu/vous, élision du titre d'espace, titre proposé à la clôture (`lea/026`), « FiestApp » dans les onglets, espaces fines, « jeux physiques » retirés | élision ailleurs (M6), « Quizz » dans le manifeste (M13), masculin hors des rangs (M11) ; et la promesse « tu retrouves tes points », introduite par #28 lui-même (M2) |
| 2 · console (#26) | gestes sûrs, garde de phase, focus rendu, enchaînement « au clic · 5 · 10 · 20 s » (Nadia : « du premier coup ») | la télé montre les coulisses (E10), remise des prix en scène (E7), « qui n'a pas répondu », télécommande (C3) |
| 1 · le lendemain (#27) | un seul verdict partout (`VerdictDesEquipes`), « Remis ce soir-là » | quatre légendes, et le téléphone classé sans les prix (M1) |
| Idées du 23 | — | pause lisible du canapé (E3), « Copier le lien » (C4), légende des colonnes (M12), « rien proposé » ≠ « pas partie » (T5) |

## 8. Ce qui est réussi, et à garder

- **Le contraste de Velours** : encre à 15,5:1, champagne à 9,3:1, et aucun
  texte au repos en `--accent`. Ce n'est jamais la couleur qui empêche de
  lire, c'est la taille (design-tele, design-systeme).
- **Un vrai système de couleurs** : 44 variables, toutes employées. Ivoire
  n'est qu'une redéfinition, et le voile y épargne le compte (à porter à
  Velours, voir E5).
- **La question en Cormorant à 56 px** et ses trois paliers, le chrono en
  ligne doublée d'un chiffre, la valeur d'une estimation, et l'écran de
  victoire, la seule scène taillée pour la salle.
- **Au téléphone** :
  - la question normale tient en 360 × 640 ;
  - l'estimation tient clavier ouvert ;
  - la photo à mémoriser ;
  - les verdicts sont écrits en toutes lettres (« Raté… tu avais dit… »).
    Hugo : « jamais laissé à une couleur ».
- **La couleur n'est jamais seule** : formes ▲◆●■, ✓ et ✕. Camille D.,
  daltonienne, n'a rien manqué.
- **Les homonymes** : « Camille (2) » partout, jamais en base (Camille D.,
  design-tele, mots). À défendre jusque sur la console (E6).
- **Les dialogues** : piège de Tab, Échap, focus rendu. Les messages du
  téléphone sont annoncés : la région polie, le `role="status"` des toasts
  (`PlayerApp.tsx:219`).
- **`prefers-reduced-motion`** coupé par une règle globale. Zoé, migraineuse :
  « aucune gêne de la soirée ».
- **Les emojis** : `emojis.mjs` relancé, 81 emojis, **aucun** au-delà
  d'Unicode 12. La règle tient, mais rien ne la garde. Un test serait bon
  marché (design-systeme §12).
- **L'hygiène** : 1 % de CSS mort, aucun style en ligne statique, aucune
  icône morte.
- **Les mots du jeu** : le tu du téléphone et le vous du mur, les erreurs
  d'invité qui disent quoi faire, le « coup d'œil » défini partout où il
  paraît.
- **Face aux concurrents** (benchmark) : aucun plafond de salle, la reprise
  après coupure, les équipes gratuites, le bilan public de chaque invité, et
  « Copier le format complet » pour l'IA de son choix.

## 9. Non confirmé, ou qui heurte un parti pris

### Non confirmé, ou artefact du banc

- **N1 · Hugo : « des icônes images sans nom »** — artefact du banc.
  - `Icon.tsx:323` et `Shape.tsx:18` sont `aria-hidden="true"`.
  - Le geste `voir` s'appuie sur `page._snapshotForAI()`, qui montre les SVG
    masqués comme des `img`. L'arbre réel de Chromium (CDP) ne les contient
    pas (`accessibilite-banc.mjs`).
- **N2 · Hugo : « des en-têtes de tableau lus comme des cellules »** —
  artefact du banc.
  - Playwright (`_snapshotForAI` comme `ariaSnapshot`) calcule `cell` pour un
    `<th>` sans `scope`. Chromium l'expose bien en `columnheader`, figé ou
    non (même script).
  - `scope="col"` ne coûte rien et rend le tableau sûr partout
    (`StatsTable.tsx:75-77`).
  - **Pour la tablée** : le personnage qui joue au lecteur d'écran devrait
    lire l'arbre de CDP, pas `_snapshotForAI`.
- **N3 · Liam : « le chrono continue pendant la pause »** — non confirmé.
  - Le téléphone fige le chrono (`PlayerView.tsx:243-252`).
  - `camille-m/008` le montre figé, et Bertrand l'a vu se figer.
  - Ce qui est vrai : le signe est discret (E3).
- **N4 · Marc : « les accents semblent décalés »** (Nadia disait déjà la même
  chose le 23) — non confirmé. Agrandie deux fois, la capture `marc/020`
  montre des aigus bien posés, avec le dessin incliné de Cormorant
  (`accents-marc-x2.png`).
- **N5 · design-telephone : `.btn-small` à 36 px** — non confirmé au doigt.
  La règle `pointer: coarse` le porte à 44 px (T7).
- **N6 · benchmark §9 : la clôture propose « Soirée du … »** — seulement quand
  l'espace garde son titre par défaut (`shared/space.ts:125-129`). Sinon elle
  propose le titre, comme « La crémaillère de la coloc » (`lea/026`).
- **N7 · Hugo : les toasts ne seraient pas annoncés** — ils le sont
  (`PlayerApp.tsx:219`, `role` `status` ou `alert`).
- **N8 · Les emojis monochromes** (design-telephone §11) — vus sous Linux
  seulement. À regarder sous Android et sous Windows 10.
- **N9 · Hugo : « ᵉ » en exposant Unicode** — à écouter avec un vrai lecteur
  d'écran, avant de rien changer.
- **Un risque déjà couvert** : Léa trouve « C'était un essai » trop près
  d'« Annuler ». Mais un second dialogue, « Tout effacer », le protège
  (`HostApp.tsx:475-481`).

### Tensions avec un parti pris, à arbitrer

- **La télé est aussi la console** (E10 ; README l. 454). La vraie réponse
  est la télécommande (C3).
- **Le temps** (A3) : le chronomètre partagé est le jeu, et `LECTURE_MS` est
  un barème.
- **La lecture à voix haute** (C5) : le son sort de l'écran commun, pas des
  téléphones.
- **Le prénom d'abord** (C6) : l'entrée est un écran de connexion, un choix
  assumé.
- **Une télécommande qui montrerait la réponse** (C3) : parti pris 3, « le
  serveur décide ».
- **Deux « Rachid » aux avatars différents, sans marque** (Rachid, Marc) :
  l'invariant 17 ne marque que le prénom **et** l'avatar partagés. À 3 m,
  l'emoji de 20 px est la seule différence.
- **« Écart estim. » et « Biais » en pour cent** au tableau des chiffres
  (`StatsTable.tsx:38-39`) : ils vont contre la convention de CLAUDE.md,
  « une estimation se juge au coup d'œil… jamais à l'écart en pour cent ».
  Le commentaire du code le reconnaît et les garde.
- **Le point médian contre l'écriture épicène** (M11) : un choix de ton.
- **« Retrouver ses points »** (M2) : c'est le mot qui parle à Jeanne, et
  c'est l'invariant 8 qu'il contredit.

### Hors de ce groupe, vu en passant (à transmettre)

- **Léa, bug 3** : le vainqueur d'un quiz se recalcule avec la composition du
  moment (Inès ajoutée à 0 point : l'autre équipe gagne). Une question de
  scoring.
- **Nadia** : L'Abstentionniste et Le Coup de Pouce rapportent un point à
  l'équipe de l'absent.
- **Marc et Rachid** : un téléphone planté devient un second invité, qu'on ne
  peut pas fusionner. Le fantôme compte dans « x / y ont répondu ».
- **Bertrand** : le bilan de chacun se lit par tous, en choisissant un prénom
  (parti pris de publicité du bilan, README).
- **Léa, Marc, Nadia** : « qui n'a pas répondu » manque toujours à la console
  (axe 2 du 23 septembre, effort M).
- **Léa et Marc** : « Temps : 50 s » dans une liste collée ne s'applique qu'à
  la première question, et l'aide dit l'inverse. C'est la mission éditeur.

## 10. Les captures les plus parlantes

1. `retours/2026-09-24/experts/captures/design-tele-2-classement-sous-console-1366.jpg`
   — 1366 × 768, révélation d'une question longue à photo :
   - « Piment » passe derrière « Question suivante » (E1) ;
   - les comptes des réponses fausses sont éteints, à 2,39:1 (E5) ;
   - « KÉVIN — 1.11 S », un point décimal à l'anglaise (M7).
2. `retours/2026-09-24/experts/captures/design-telephone-1-reponses-longues.png`
   — 360 × 640 : quatre réponses de 85 à 90 caractères, et la première
   recouvre la dernière ligne de la question (E1).
3. `export/tablee/2026-09-24-trois-salons/captures/jeanne/011-souvenir-palmares.png`,
   avec la reproduction
   `export/evaluations/verification/design/equipes-souvenir-277px.png` :
   « Les équipes au quiz » en cascade de lettres au texte agrandi (T1). La
   colonne du nom mesure 14 px.
4. `export/tablee/2026-09-24-trois-salons/captures/nadia/016-equipes-melangees.png`
   — la console de Nadia : « Camil… » a perdu sa marque « (2) » là où l'on
   range les équipes (E6), et la légende « Le chiffre cerclé : le barème… »
   est coupée au mur (M1).
