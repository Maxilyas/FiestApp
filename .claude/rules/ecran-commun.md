---
paths:
  - "client/src/views/HostApp.tsx"
  - "client/src/games/quiz/{HostView,Regie}.tsx"
  - "client/src/components/{Coupe,HostConsole,Tele,Appairage,Podium,Leaderboard,TeamBoard,TimerBar,GetReady}.tsx"
  - "client/src/styles.css"
  - "server/scripts/rendu-tele.ts"
  - "server/test/{ecran,petit-ecran,tele-salle,scene}.test.ts"
---

# L'écran commun (/host)

## Les fichiers

- `client/src/components/Coupe.tsx` — une liste de l'écran commun coupée à ce qui tient, « et 2 autres » dessous : personne ne fait défiler une télé
- `client/src/components/Tele.tsx` · `Appairage.tsx` — la télé qu'on branche : `/tele` s'ouvre sur son code (`EcranDeBranchement`), qu'un téléphone valide — « Sur une télé » au salon, « Brancher la télé » à la télécommande, l'un et l'autre disent `/tele` —, puis, en salle d'attente et pendant le choix du quiz, la salle vue de loin (`SalleDeLaTele`) ; la session d'une télé branchée tient une soirée, et sa connexion tombe à sa fin même sans un geste (`sockets.ts`, `appairage.test.ts`). `server/scripts/rendu-tele.ts` rejoue le scénario entier, salon et barre du chef compris, et dit à chaque moment ce que la télé montre

## Les pièges

- **Une télé branchée par un code est un écran de salle** (`ecranDeSalle`) :
  ni console, ni panneau des équipes, ni coulisses, et le focus ne s'y pose
  pas — on la branche depuis le téléphone qui anime, et la télécommande
  d'une télé ne clique pas. Elle l'est dès son branchement, quoi que
  déclarent les téléphones : elle ne l'était que pendant qu'une
  télécommande se déclarait, la barre du chef d'un salon ne le faisait pas,
  et la télé d'un salon montrait toute la console, « Mes quiz » et « Mon
  compte » compris — un téléphone verrouillé l'y ramenait aussi (la revue du
  12 octobre 2026). Quand personne ne l'anime d'un téléphone, « Piloter
  d'ici », discret, lui rend la console à la souris jusqu'au rechargement
  (`tele-salle.test.ts`).

- **Sur grand écran, `/host` compte en `rem`.** Sa taille racine suit la
  hauteur de l'écran (16 px en 768, 22,5 en 1080) : une taille de scène
  écrite en pixels ne grandit pas en 1920 × 1080, et la même télé la montre
  30 % plus petite. Les composants partagés avec les téléphones y ont leurs
  mesures en `rem` (le bloc en tête de « Écran commun », `styles.css`).
  Une liste de la scène passe par `Coupe`, jamais par un cadre qui défile,
  et son cadre tient sa hauteur de la mise en page, pas de son contenu.
  Et 1920 × 1080 fait 48 rem de haut, comme 1366 × 768 : une règle réservée
  à l'un (`max-height: 820px`) donne moins de place à l'autre. Tout ce qui
  grossit la scène vit dans `@media (min-width: 1101px)` : l'animateur tient
  aussi `/host` au téléphone, où rien ne grossit, où la page défile et où
  `Coupe` ne coupe rien (`overflow: visible`). `ecran.test.ts` y veille.
- **`rendu-ecran.ts` dit ce qui dépasse de la scène** (`DEBORDE=1`), à
  chaque moment et aux deux définitions. La clôture la plus courante — le
  QR du souvenir en grand, une équipe, des hauts faits — dépassait d'1,6
  rem, et ses hauts faits ne montraient que le haut de leurs badges (le
  11 octobre 2026 : ses écarts se sont resserrés, le QR a gardé sa taille
  de canapé). Ce qui reste au relevé est voulu : le nom long coupé au
  podium, le halo d'un légendaire, la remise des prix — l'outil de
  l'animateur, qui défile.
