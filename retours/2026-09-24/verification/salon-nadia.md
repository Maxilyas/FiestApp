# Le salon de Nadia, vérifié — tablée du 24 septembre 2026 (« trois salons »)

Nadia rejouait la tablée du 23 septembre : les mêmes huit personnages, la même
soirée, « Les 40 ans de Sam ». Cette fois, le serveur était partagé avec les
salons de Marc et de Léa, et les sept axes de la première tablée avaient reçu
leurs PR (#25 à #31). Ce document fait deux choses : il transforme les retours
des agents en constats vérifiés, et il mesure l'amélioration axe par axe.

**Comment c'est vérifié.** Pour chaque constat, j'ai cherché qui d'autre l'avait
vu, dans ce salon, dans les deux autres et dans la première tablée. Je l'ai
recoupé avec `journal.jsonl` et `regie.log`, puis vérifié dans le code
(`fichier:ligne`) ou rejoué. Les rejeux n'ont jamais touché la régie. Ils ont
tourné sur un serveur jetable, avec une **copie** de la base permanente de la
tablée, qui contient l'archive « Les 40 ans de Sam » et le quiz de Nadia. Tout
est dans `export/evaluations/verification/salon-nadia/` : `serveur.ts`,
`souvenir-zoom.mjs`, `arbre-a11y.mjs`, `champ-temps.mjs` et leurs captures. Le
serveur est éteint.

**La coupure du banc.** Une limite d'usage de l'outil a coupé tous les agents
pendant vingt-huit minutes. Le dernier geste de Nadia date de 15:25:09, le
suivant de 15:53:51. L'enchaînement automatique, réglé à 10 s, a joué seul les
questions 8 à 10 (dont la photo à mémoriser), puis le podium, et personne n'y a
répondu. Tout ce qui en découle est écarté, en fin de document. `regie.log` ne
montre aucune erreur du serveur de toute la soirée : 57 minutes, trois salons
et 1 648 gestes.

## En bref

- **Le lendemain ne contredit plus la soirée.** L'écran de victoire, l'historique
  et le souvenir donnent le même verdict, prix compris. La console ne bouge plus
  sous le curseur. L'éditeur reprend le temps et la catégorie de la question
  précédente. Le bilan parle au lecteur d'écran, et les mots projetés au mur
  sont justes. **Cinq axes sur sept sont corrigés, deux le sont en partie.**
- **Le verdict des équipes se contredit maintenant pendant la soirée même.** Au
  podium, Nadia a annoncé les Arrabbiata. Quatre prix « pour rire » ont ensuite
  couronné deux équipes. Marc a vécu la même chose dans son salon, « devant
  toute l'agence ».
- **L'écran commun en 1366 × 768 n'est corrigé qu'en partie.** La révélation d'une
  estimation à six réponses et l'écran de victoire débordent encore, avec
  seulement sept invités.
- **De nouveaux bugs apparaissent.** L'un est ancien et a été révélé par un banc
  plus fidèle : le champ « Temps » de l'éditeur affiche « 2045 », puis enregistre
  120 s sans un mot. Deux autres viennent de #29 : « Camille (2) » est coupé en
  « Camil… » sur la console, et le bloc des équipes du souvenir se défait lettre
  par lettre quand le texte est agrandi.
- **Les deux « bugs de balisage » signalés par Hugo viennent du banc.** Le pilote
  lui montre des icônes que Chrome cache bien au lecteur d'écran. Rejoué : Chrome
  expose 0 image et 19 vrais en-têtes de colonne.

## Qui était là

Les notes se lisent dans cet ordre : entrer · jouer · lire · revenir.

| Personnage | L'angle | Appareil | Sa soirée du 24 | Notes du 24 | Notes du 23 | Sa soirée du 23 |
|---|---|---|---|---|---|---|
| **Nadia**, 38 ans | anime pour la première fois | portable 1366 × 768 | quiz de 10 questions écrit en 4 min 38 s (1 à la main, 8 collées, 1 photo), 3 équipes, enchaînement à 10 s, 4 prix, clôture, lendemain | 5 · 4 · 4 · 5 | 4 · 4 · 4 · 4 | quiz de 9, 2 équipes, prix, clôture |
| **Jeanne**, 71 ans | grand-mère, texte à 130 % | petit Android 360 × 640 | 4ᵉ, 922 pts, L'Éclair | 5 · 4 · 3 · 4 | 4 · 5 · 4 · 5 | 4ᵉ, 1 281 pts |
| **Lucas**, 16 ans | cherche la faille | iPhone 390 × 844 | 3ᵉ, 965 pts, Le Doigt qui Tremble | 5 · 4 · 5 · 4 | 4 · 4 · 4 · 5 | 2ᵉ, 1 501 pts |
| **Sofia**, 34 ans | veut son profil et sa progression | Android 412 × 915 | 1ʳᵉ, 1 146 pts, +58 XP (58/60 vers le niveau 2) | 5 · 5 · 4 · 5 | 4 · 5 · 5 · 5 | 3ᵉ, 1 366 pts |
| **Karim**, 29 ans | retardataire, veille, réseau capricieux | Android | 7ᵉ, 195 pts, 1 réponse sur 9 : Q2 à son arrivée, Q4 en veille, Q5 sans réseau, Q6 révélée sans lui, Q7 à Q10 pendant la coupure | 3 · 2 · 5 · 4 | 4 · 3 · 5 · 4 | 7ᵉ, 512 pts |
| **Camille M.**, 27 ans | sans QR, passe par l'accueil | Android | 6ᵉ, 859 pts, 5 réponses, toutes justes | 3 · 4 · 4 · 5 | 4 · 5 · 5 · 5 | 1ʳᵉ, 1 611 pts |
| **Camille D.**, 45 ans | profil existant, homonyme, deutéranope | Android, vision deutéranope | 2ᵉ, 1 098 pts, « Camille (2) », +43 XP | 5 · 4 · 4 · 5 | 5 · 4 · 5 · 5 | 5ᵉ, 1 235 pts |
| **Hugo**, 30 ans | aveugle, lecteur d'écran | Android, arbre d'accessibilité seul | 5ᵉ, 905 pts, Le Cancre Magnifique | 5 · 4 · 3 · 4 | 4 · 3 · 3 · 4 | 6ᵉ, 1 004 pts |
| **Moyenne** | | | | **4,5 · 3,9 · 4,0 · 4,5** | **4,1 · 4,1 · 4,4 · 4,6** | |

Les rangs et les points viennent de l'archive (`soirees`, `2026-09-24-o324i`).
Les scores sont plus bas que le 23 parce que personne n'a répondu aux trois
dernières questions (la coupure).

**Entrer** gagne 0,4 point. Il baisse chez deux personnages seulement : Karim
(le choix d'équipe lui coûte une question, constat 7) et Camille M. (l'adresse
exacte, constat 13).

**Jouer** perd 0,2 point. La coupure pèse sur cette note, même si tous les agents
disent ne pas la compter. S'y ajoutent les incidents prévus par la fiche de
Karim.

**Lire** perd 0,4 point. Jeanne passe à 3 à cause du souvenir au texte agrandi
(constat 6). Sofia, Camille M. et Camille D. passent de 5 à 4.

## Avant / après : les sept axes du 23 septembre

| Axe du 23 (PR) | Verdict | La preuve ce soir |
|---|---|---|
| 1. Le lendemain contredit la soirée (#27) | **Corrigé**, mais le problème a glissé dans la soirée elle-même (constat 1) | Trois écrans donnent le même verdict : la victoire (`029`), l'historique (`032`) et le souvenir (`033`) disent « Les Arrabbiata et Les Guitaristes, ex æquo, 4 points chacune, prix compris ». Le souvenir et le bilan le tirent de `VerdictDesEquipes` (`RecapApp.tsx:149`, `BilanRoom.tsx:61`). « Remis ce soir-là » liste les quatre prix remis, dans l'ordre (`RecapApp.tsx:160-166`). Le palmarès précise « remis à l'écran ou non » (`RecapApp.tsx:170-176`). Il reste deux choses. « Remis ce soir-là » nomme l'équipe, pas le lauréat (Jeanne). Et le bilan ne calcule pas la moyenne d'une équipe comme l'écran de victoire (constat 5). |
| 2. La console de l'animateur (#26) | **En partie** | **Corrigé.** Les boutons sont grisés au lieu de disparaître. L'action principale reste à gauche, « Reposer » demande confirmation, et les gestes qui défont sont groupés à droite (`HostView.tsx:150-215`, capture `025`). L'enchaînement se règle en « au clic · 5 s · 10 s · 20 s ». Nadia : « je n'ai jamais cherché quoi faire », et le mode automatique « m'a enfin permis de lâcher l'ordinateur ». **Toujours là.** La télé montre les coulisses : la liste « Choisis un quiz » (`017`), la consigne « tant que tu ne cliques pas » et les dix lauréats avant qu'on les annonce (`027`, `HostApp.tsx:726-728`). Remettre un prix ne fait que griser sa carte (`028`). « Qui n'a pas répondu ? » reste un simple compte (`HostApp.tsx:527`). La télécommande, Léa l'a improvisée avec un second appareil, mais la remise des prix et la victoire ne s'affichent que sur l'écran où l'on clique : l'écran courant est un état local (`HostApp.tsx:242`). |
| 3. L'écran commun à 1366 × 768 (#31) | **En partie** | **Corrigé.** La révélation d'un QCM tient à l'écran avec trois équipes et le top 5 (`021`). Le podium du quiz tient aussi, avec 7 joueurs et 3 équipes (`026`). Le QR du souvenir est entier à la clôture (`031`), et la console tient sur une ligne (`016`, `025`). **Revenu.** Débordent encore : l'estimation révélée à six réponses (`025`), l'écran de victoire (`029`, constat 3), et la remise des prix, où le prix libre et « Prix déjà remis » (l'endroit où l'on retire un prix) passent sous le bas de l'écran (`027`). La légende du panneau « Les équipes » est coupée en salle d'attente (`016`). **Non observé** : la révélation d'une photo, jouée pendant la coupure. |
| 4. Les finitions du téléphone (#29) | **Corrigé**, avec deux effets de bord | **Corrigé.** Les noms d'équipe coupés finissent par des points de suspension (« Les R… », Jeanne `008`). Le changement d'équipe est annoncé, Jeanne : « le jeu me l'a dit gentiment » (`sockets.ts:555`). Le retour arrière demande « Quitter la soirée ? » (Lucas). Le pseudo est coupé net à 24 caractères, sans moitié d'emoji (Lucas). Plus personne ne se plaint du clavier (qui reste simulé). **Effets de bord de la même PR** : « Camil… » (constat 4) et les équipes du souvenir au texte agrandi (constat 6). **Neuf** : le retour arrière après la clôture (constat 10). |
| 5. L'accessibilité (#30) | **Corrigé** | Hugo : « chaque option porte le mot « toi » si je l'ai choisie, et « la bonne réponse » si c'est elle ». Il salue aussi « des titres partout », les repères nommés et « Réponse enregistrée ». Dans le code : le podium suit l'ordre des rangs (`Podium.tsx:51-57`), les libellés de la console portent la marque d'homonymie (`HostApp.tsx:150-160`, `187`, `206`), et la question à photo s'annonce comme « Question visuelle » (`PlayerView.tsx:258`, non observé : Hugo était coupé à Q9). Ses deux nouveaux « bugs » viennent du banc (voir « Écarté »). Il reste un `aria-sort` absent (confirmé), et deux points non confirmés : le toast d'équipe et la lecture de « 5ᵉ ». |
| 6. L'éditeur (#25) | **Corrigé**, mais un bug ancien est apparu | **Corrigé.** Une question neuve reprend le temps et la catégorie de la précédente. Nadia : « rien eu à régler pour la dixième ». Dans la base, la question photo ajoutée à la main a bien 45 s et « Autour de la fête ». La photo s'agrandit (« Voir la photo en grand », `EditorApp.tsx:1577`, capture `008`). L'aperçu joue la photo seule, puis « La photo a disparu » (`010`-`012`). **Apparu** : le champ « Temps » (constat 2). Le bug existe depuis le 22 septembre ; le banc du 23 le masquait parce qu'il remplissait les champs d'un coup. **Neuf** : dans l'aperçu, un bouton change de rôle sous le curseur (constat 14). |
| 7. Les mots (#28) | **Corrigé pour l'essentiel** | **Corrigé.** Plus de « deux jeux physiques ». Le tutoiement est partout (« Choisis un quiz »). L'élision est faite (`shared/space.ts:93-94`). La clôture propose le titre de la soirée (`030`). L'onglet s'appelle « FiestApp » (`client/index.html:30`). « En champagne » a quitté les légendes. La fin de soirée dit « Avec un profil, tu retrouves tes points et tes prix », la phrase que Jeanne demandait (`009`). **Revenu** : le jargon du classement des équipes. On lit « le chiffre cerclé : le barème, prix compris », « la moyenne par membre, qui distribue le barème » et « sur l'échelle du barème » (`HostApp.tsx:680`, `726-728`, `1064` ; `RecapApp.tsx:152-155`). Nadia et Marc l'ont trouvé obscur toute la soirée. Et « une petite équipe n'est pas pénalisée » (`PlayerApp.tsx:367`) est démenti par la règle du retardataire (constat 5). **Neuf** : la césure « a- / t-il » au mur (constat 14). |

## Les constats vérifiés

Priorités : **P1** abîme la soirée de toute une salle, **P2** celle de quelques
invités, **P3** est un détail. Effort : **S**, quelques lignes ; **M**, une
journée ; **L**, un lot.

### 1. Des prix « pour rire » renversent un vainqueur déjà annoncé — friction et tension avec un parti pris · P1 · S

- **Ce qui se passe.** Le podium du quiz classe les équipes : 1. Arrabbiata ③ 1002,
  2. Guitaristes ② 944, 3. Randonneurs ① 733 (`026`). Nadia annonce : « Chez les
  équipes, les Arrabbiata l'emportent » (journal, 15:54:01). Elle remet ensuite
  quatre prix pour rire. Chaque « Attribuer » ajoute 1 point à l'équipe du
  lauréat, et l'écran de victoire affiche « Ex æquo · 4 points chacune » (`029`).
  Rien ne l'annonçait avant le clic. L'écran des prix ne montre pas le classement
  des équipes. Le « 1 » de chaque carte n'a pas d'étiquette. Et le texte qui
  explique la règle s'adresse à l'animatrice (« tant que tu ne cliques pas »),
  alors qu'il est projeté à toute la salle (`027`).
- **Qui l'a vécu.** Nadia : « j'ai dû me reprendre devant tout le monde ». Sofia,
  Karim, Lucas et Hugo l'ont pris comme un rebondissement drôle. Dans le salon
  de Marc, même scène : « Mes prix pour rire ont renversé la victoire — gênant,
  et devant toute l'agence » (`marc.md:39-42`). Chez Léa, c'est une arrivée
  tardive qui a renversé la victoire annoncée (constat 5).
- **Preuve.**
  - L'archive contient 4 prix à +1 : L'Éclair et Le Doigt qui Tremble pour les
    Guitaristes, Le Cancre Magnifique pour les Arrabbiata, L'Abstentionniste pour
    les Randonneurs. Le barème 3-2-1 devient donc 4-4-2.
  - Un prix ne peut pas valoir 0 point : `awardBonus` refuse la valeur 0
    (`server/src/core/teams.ts:153`).
  - Le champ de points des prix calculés n'a ni libellé ni `aria-label`
    (`AwardsBoard.tsx:77-83`). Celui du prix libre en a un (« Points du prix »,
    `HostApp.tsx:775`).
  - Le podium titre « Les équipes après ce quiz » sans rien dire des prix
    (`HostView.tsx:479-481`).
- **Le parti pris en jeu.** Le README, section « Les équipes », dit : « un prix
  peut renverser l'ordre, c'est tout son intérêt » (`README.md:274`). Le
  renversement est donc voulu. Ce qui ne l'est pas, c'est que l'animatrice le
  découvre après l'avoir annoncé, et qu'aucun prix ne puisse se remettre « pour
  l'honneur ».
- **Coût.** C'est le moment qui conclut la soirée. Deux animateurs sur trois ont
  dû rattraper le verdict devant leur salle.
- **Pistes.**
  - (S) Afficher l'effet de chaque prix avant le clic, par exemple « +1 aux
    Guitaristes → égalité avec les Arrabbiata », sous le classement des équipes,
    barème plus prix.
  - (S) Étiqueter le champ : « points pour l'équipe ».
  - (S) Accepter 0 point pour un prix « pour l'honneur », qui apparaît dans
    « Remis ce soir-là » sans changer le classement.
  - (S) Au podium, écrire « avant les prix » : le renversement devient un suspense
    annoncé au lieu d'un démenti.
  - (M) Sortir de la télé ce qui ne s'adresse qu'à l'animatrice.

### 2. Le champ « Temps » de l'éditeur ne se vide pas : « 45 » devient « 2045 », enregistré 120 s — bug confirmé · P1 · S

- **Ce qui se passe.** Dès que le champ est vide, il affiche de nouveau « 20 ». Ce
  qu'on tape s'ajoute derrière : « 2045 ». Rien ne le signale, et la question
  est comptée « prête ».
- **Qui l'a vécu.**
  - Nadia (`005-temps-2045.png`, « 1/1 prête »).
  - Léa, dans son salon : « 2050 » sur huit questions, et l'une est tombée à
    « 2 », avec « une dizaine de minutes de bricolage » (`lea.md:11`, `38`).
  - Marc : « Un champ numérique garde son zéro quand on le vide »
    (`marc.md:86`).
  - L'expert de l'éditeur (`retours/2026-09-24/experts/editeur.md`, § 2).
- **Preuve dans le code.**
  - L'affichage `value={question.duration || DEFAULT_DURATION}` et la lecture
    `Number(e.target.value)` sont en `EditorApp.tsx:1559-1560`.
  - `questionProblem` ne vérifie pas le temps (`shared/library.ts:285-298`).
  - `normalizeQuestions` borne le temps sans prévenir (`shared/library.ts:349-351`).
  - Le temps d'observation a le même défaut (« 010 », `EditorApp.tsx:1649-1650`),
    tout comme les points d'un prix (`AwardsBoard.tsx:83`).
  - Le code enfreint la convention de CLAUDE.md : « Un nombre tapé se lit avec
    `lireNombre()`… Le champ garde le texte tapé ».
- **Rejoué** (`champ-temps.mjs`, sur la copie de la base) :
  - Sur « 45 », un retour arrière donne « 4 », un second donne « 20 » (le champ se
    remplit tout seul). Taper « 30 » donne « 2030 ». Le compteur affiche toujours
    « 10/10 prêtes ».
  - Après « Enregistrer », la base contient **120 s**.
  - Arrêté sur le « 4 » intermédiaire, le champ aurait enregistré 5 s.
- **Historique.** Ce code date du 22 septembre (`git blame`). Il existait donc le
  23, mais le pilote remplissait alors les champs d'un coup. Il n'apparaît que
  depuis que `ecrire` tape touche par touche (6c02cfa).
- **Coût.** Toute la salle joue une question de deux minutes, ou de cinq
  secondes, que personne n'a choisie.
- **Pistes.**
  - (S) Garder le texte tapé dans le champ et le lire avec `lireNombre()`.
  - (S) Afficher « entre 5 et 120 s » quand la valeur est hors bornes, et laisser
    `questionProblem` refuser un temps hors bornes au lieu de le borner en
    silence.
  - (S) Un « même temps pour tout le quiz » : Nadia, Léa et Marc le demandent tous
    les trois.

### 3. L'écran commun déborde encore en 1366 × 768 — bug confirmé · P1 · S

- **Ce qui se passe.**
  - À la révélation de l'estimation (`025`), la 6ᵉ proposition (Camille, 120 km,
    +80) est coupée. « Les équipes » montre une équipe et demie sur trois, et
    « Top du quiz » deux lignes.
  - Sur l'écran de victoire (`029`), « Les joueurs » s'arrête sur Hugo, 5ᵉ. Camille
    et Karim n'apparaissent pas.
  - Tout cela avec sept invités seulement.
- **Qui l'a vécu.** Nadia, sur le portable de la tablée (viewport 1366 × 768 sans
  barre de navigateur : un vrai portable a encore moins de place).
- **Preuve dans le code.**
  - La liste des propositions est plafonnée à 45 % de la hauteur et défile dans
    son cadre (`styles.css:1085`). Les classements prennent le reste (`1086`),
    et les écrans de fin défilent aussi (`1090`). Personne ne fait défiler une
    télé.
  - L'emoji et le nom du vainqueur ne rétrécissent qu'en
    `(max-width: 1100px) and (max-height: 500px)` (`styles.css:1455-1471`). Le
    bloc 820 px de #31 (`4240-4252`) ne les traite pas. À 1366 px, l'emoji
    `clamp(4rem, 12vw, 8rem)` mesure donc 128 px (`2307`).
  - La liste de contrôle de CLAUDE.md (« Regarde le rendu ») cite la photo, les
    équipes et la clôture, mais ni l'estimation ni la victoire.
- **Coût.** La salle ne voit pas la fin des listes, dès sept invités.
- **Pistes.**
  - (S) Dans le bloc 820 px, réduire l'emoji et le nom du vainqueur comme à
    500 px.
  - (S) Couper les listes à ce qui tient, avec « et 2 autres », comme la victoire
    le fait déjà au-delà de douze, plutôt qu'un cadre qui défile.
  - (S) Placer les propositions sur deux colonnes.
  - (S) Ajouter « une estimation à sept réponses et l'écran de victoire » à la
    liste de contrôle en 1366 × 768.

### 4. La marque « (2) » est coupée sur la console : « Camil… » — bug confirmé (régression de #29) · P2 · S

- **Ce qui se passe.** Dans la colonne « Invités » de l'écran commun, là où l'on
  range les équipes, la pastille de Camille D. affiche « Camil… » (`016`). Le
  classement, juste à droite, écrit bien « Camille (2) ».
- **Qui l'a vécu.** Nadia : « J'ai déplacé l'une des deux au hasard ». En réalité,
  elle s'est fiée au badge (« Camille (2), celle qui a le badge Niv. 1 », journal
  15:16:38). Camille D. : « un peu exposée sur le moment ».
- **Preuve.**
  - L'ancienne règle `.chip-name { max-width: 9ch … text-overflow: ellipsis }`
    (`styles.css:1862`) s'ajoute à celle de #29, `.player-chip { max-width: 100%;
    min-width: 0 }` (`styles.css:993-996`). La pastille ne déborde plus de sa
    carte, alors c'est le prénom qui rétrécit, et la marque part la première.
  - L'infobulle dit « Donner un surnom pour la soirée » (`HostApp.tsx:159`) :
    survoler la pastille ne donne pas le nom entier.
  - Le 23 (capture `04` de la première tablée), « Camille (2) » s'affichait en
    entier, mais la pastille débordait.
- **Invariant 17.** La marque est la seule chose qui distingue deux invités
  identiques. Ici, le badge « Niv. 1 » a sauvé Nadia. Avec deux Camille
  anonymes, rien ne les distinguerait là où l'on fait les équipes.
- **Pistes.**
  - (S) Ne jamais couper la marque : les points de suspension portent sur le
    prénom seul, et « (2) » va dans son propre élément (la marque est construite
    en `shared/homonymes.ts:48`).
  - (S) Mettre le nom entier en `title`, ou laisser la pastille passer sur deux
    lignes.

### 5. Un retardataire fait baisser la moyenne de son équipe pour les questions qu'il n'a pas jouées — règle à arbitrer · P2 · M

- **Ce qui se passe.** Karim arrive pendant la question 2, et la moyenne des
  Randonneurs passe de 182 à 121 alors que personne n'a encore joué cette
  question (`021` : « 3 membres · 363 pts »). Les Randonneurs finissent derniers
  (733) avec le plus gros total (2 200).
- **Qui l'a vécu.**
  - Nadia l'a vu. Karim a cru l'inverse : « rejoindre une équipe en cours de
    soirée ne la pénalise pas ».
  - Chez Léa, Inès est arrivée après le quiz. La moyenne de son équipe est
    passée de 1 280 à 640, et l'écran de victoire a changé de vainqueur ; Léa a
    dû la sortir de l'équipe (`lea.md:16`, `34`).
  - Chez Marc, une moyenne « tombe de 743 à 557 » (`marc.md:32`).
- **Preuve.**
  - La moyenne divise le total par tous les membres actuels, quelle que soit
    leur heure d'arrivée (`shared/teams.ts:24-32`).
  - Le téléphone affirme pourtant « une petite équipe n'est pas pénalisée »
    (`PlayerApp.tsx:367`), et l'écran d'équipe dit « Tes points restent les tiens
    — ils comptent aussi pour ton équipe » (`Entree.tsx:525`).
  - Deux règles coexistent. Le bilan divise par les membres **présents au quiz**
    (`server/src/core/review.ts:439-446`), alors que la victoire et le souvenir
    divisent par tous les membres (`teams.ts:32`). Dans le salon de Nadia, cela
    revient au même, car Karim a des réponses dès Q2. Pour un invité arrivé après
    le quiz, comme Inès, le lendemain contredirait de nouveau la soirée.
  - Changer d'équipe n'est refusé que pendant un quiz
    (`server/src/sockets.ts:416-429`). Après « Terminer le quiz », déplacer un
    invité reclasse donc un quiz déjà fini.
- **Le choix de produit en jeu.** Le classement des équipes est un choix de
  produit (CLAUDE.md, « Ce qu'il ne faut pas faire »).
- **Pistes.**
  - (M) Une seule règle, dans `shared/teams.ts`, que lisent la soirée et le
    bilan : chaque membre compte au prorata des questions qui lui ont été posées
    (le journal des réponses a une ligne par invité et par question posée).
  - (M) Figer le verdict d'un quiz à sa fin.
  - (S) Une phrase simple pour l'expliquer.

### 6. Le souvenir sur un petit téléphone : les équipes s'y défont au texte agrandi, et la page est très longue — bug confirmé (le bloc) et friction (la longueur) · P2 · S

- **Ce qui se passe.** Le texte de Jeanne est agrandi à 130 %. Dans « Les équipes
  au quiz », le nom et le détail tombent en colonne d'une ou deux lettres : « L… /
  2 / me / · / 188 / pts / au / tot… » (`jeanne/011`). Pour retrouver son prix
  (L'Éclair), elle a dû faire défiler plusieurs écrans.
- **Rejoué** (`souvenir-zoom.mjs`, `souvenir-equipes-360-130.png`) :
  - en 360 px à 130 %, la colonne du nom mesure 6 à 20 px de large, et le détail
    273 à 292 px de haut ;
  - en 360 px à 100 %, elle mesure 85 à 96 px, pour 4 à 5 lignes de détail ;
  - en 412 px à 130 %, elle mesure 58 à 72 px.
- **Cause.** Dans une ligne d'équipe, seul le nom peut rétrécir (`.lb-name`,
  `flex: 1; min-width: 0`, `styles.css:779`). Depuis #29, son détail est un bloc
  qui passe à la ligne (`styles.css:2058-2061`). Le rang (1,7 em), le chiffre
  cerclé (2,2 em au moins) et la moyenne gardent toute leur largeur.
- **La longueur.**
  - En 360 px à 130 %, la page fait 8 904 px de haut, soit environ quatorze
    écrans.
  - « Le reste du classement », où Jeanne (4ᵉ) se trouve, commence à 8 053 px. Il
    vient après le palmarès (douze cartes) et le tableau à 18 colonnes
    (`RecapApp.tsx:170-195`). À 100 %, la page fait 5 284 px et la section
    commence à 4 691 px.
  - Au même zoom, les noms d'équipe deviennent « Les R… » sur le téléphone
    (`008`), et il faut défiler pour voir le choix d'équipe, sans rien qui
    l'indique (`003`).
- **Pistes.**
  - (S) Sous 360 px effectifs, passer la ligne d'équipe sur deux étages : rang,
    emoji, nom et chiffres, puis le détail sur toute la largeur.
  - (S) Placer « Le reste du classement » juste après le podium.
  - (S) Replier « Toutes les statistiques » sur téléphone : le bilan dit déjà
    ces chiffres en phrases.
  - (S) Ajouter une légende pour Biais, Écart estim. et Coup d'œil. Jeanne l'a
    demandée ce soir, et Sofia le 23.

### 7. Le retardataire doit choisir une équipe même quand la question court — friction · P2 · S

- **Ce qui se passe.** Selon le journal, Karim touche « Continuer » à 15:19:42,
  fait une capture, choisit « Les Randonneurs » à 15:20:00 et touche « Rejoindre la
  soirée » à 15:20:06. La question 2 est révélée vers 15:20:12 : il la rejoint
  six secondes avant la fin, et son premier écran est « Trop tard ! »
  (`karim/001`-`003`).
- **Preuve.**
  - Dès qu'il existe des équipes, l'écran d'équipe est obligatoire
    (`Entree.tsx:147-151`), et son bouton reste grisé tant qu'aucune équipe n'est
    choisie (`Entree.tsx:534-537`). L'entrée ignore qu'une question est en cours.
  - La plupart des 24 s viennent de l'agent. Pour un humain, cet écran et ses
    deux touchers coûtent 3 à 5 s, soit justement la marge d'un retardataire.
  - Le téléphone permet déjà de changer d'équipe hors quiz (« Changer », `005` ;
    `sockets.ts:416-429`).
- **Pistes.**
  - (S) Pendant une question, faire entrer directement, dans la plus petite
    équipe ou sans équipe (à trancher avec le constat 5), et proposer le choix
    d'équipe après la question.
  - (S) Afficher les prénoms dans le choix d'équipe. Camille M. a dû crier
    « Sofia, t'es dans quelle équipe ?? ».

### 8. La fin de soirée du téléphone ne dit pas les prix — friction · P2 · S

- **Qui l'a vécu.**
  - Jeanne n'y voit que son rang et ses points, pas L'Éclair que Nadia venait
    d'annoncer à voix haute (`009`).
  - Camille M. a découvert « Le Sans-Faute » et « Le plus beau coup » en
    fouillant le souvenir. Lucas y a trouvé « Le Contemplatif ».
- **Preuve.**
  - `FinDeSoiree` porte le rang, les points, les hauts faits et le profil, mais
    aucun prix (`shared/fin.ts:33-60`). La boîte de clôture annonce d'ailleurs
    « son rang, ses hauts faits, ses niveaux » (`030`).
  - Le téléphone promet pourtant « tes points et tes prix ».
  - Le bilan calcule déjà les prix de chacun (`awards`, `shared/review.ts:131`).
- **Pistes.**
  - (S) Ajouter une ligne « Tes prix ce soir » à la fin de soirée.
  - (S) Dans « Remis ce soir-là », écrire le nom du lauréat à côté de son équipe.

### 9. La réponse tapée hors ligne — non confirmé (le comportement est le bon), mais une friction demeure · P3 · S

- **Ce qui se passe.** Pendant une coupure réseau, Karim tape « Le mont Blanc » à
  la question 5. L'écran affiche « Ta réponse n'est pas partie ». Le réseau
  revient pendant la question 6, et il ne saura jamais ce qu'est devenue sa
  réponse (`006`, `007`).
- **L'application ne l'a pas perdue.**
  - Hors ligne, socket.io-client 4.8.3 met l'envoi en file et le fait partir à
    la reconnexion (`node_modules/socket.io-client/build/esm/socket.js:263-272`,
    `599-606`).
  - Le client renvoie la réponse une fois tant que la question est ouverte
    (`client/src/socket.ts:246-318`).
  - La coupure a duré 38 s (15:23:19 → 15:23:57), et Q5 s'est close vers
    15:23:36. À la reconnexion, le serveur refuse donc une réponse périmée, à
    raison (invariants 6 et 12).
- **La friction.**
  - Le téléphone ne le dit jamais. L'accusé tardif arrive alors que la promesse
    est déjà réglée sur « timeout » (`socket.ts:280-292`), et il est ignoré.
  - Pendant la coupure, le message d'erreur recouvre la barre du chronomètre
    (`006`).
- **Pistes.**
  - (S) Après la reconnexion, écrire « Ta réponse à la question 5 est arrivée
    trop tard — c'était le mont Blanc ».
  - (S) Pendant la coupure, dire « pas encore partie : elle partira dès que le
    réseau revient », et placer le message plus bas pour libérer le chronomètre.

### 10. Après la clôture, le retour arrière mène à « Entrer dans la soirée » — friction · P3 · S

- **Ce qui se passe.** Camille D. passe de sa fin de soirée à son profil, puis
  revient en arrière. Elle retombe sur « Content de te revoir, Camille — Entrer
  dans la soirée », « comme si je n'avais pas encore rejoint ».
- **Preuve.**
  - À `soiree:fin`, le téléphone oublie son identité et ne garde la fin de soirée
    qu'en mémoire (`client/src/socket.ts:88-92`).
  - Une fois la page rechargée, il n'a plus de jeton et donc rien à reprendre
    (`PlayerApp.tsx:65-66`) : c'est l'entrée de la soirée suivante qui
    s'affiche.
  - L'entrée ne sait rien de la soirée qu'on vient de clore. Pourtant,
    `recap.json` et `bilan.json` la désignent (invariant 18).
  - « Entrer dans la soirée » l'inscrirait dans la soirée vierge qui suit.
- **Pistes.**
  - (S) Garder la fin de soirée dans le `sessionStorage` de l'espace (sous
    try/catch) jusqu'à la première question de la soirée suivante.
  - (S) Ou afficher sur l'entrée : « La soirée « Les 40 ans de Sam » est close —
    revoir ta fin de soirée ».

### 11. Sur `/profil`, « Rejoindre une soirée » ignore la soirée en cours — friction déjà signalée le 23 · P3 · S

- **Ce qui se passe.** Sofia est dans la soirée de Nadia. Le bouton l'envoie
  pourtant sur « Quelle soirée ? » (`sofia/009`), et elle a « une seconde de
  doute : est-ce que j'ai quitté la partie ? ».
- **Preuve.** Le bouton ouvre le formulaire générique (`ProfilApp.tsx:180`) sans
  lire l'identité que le téléphone garde pour chaque espace
  (`quizz.me.<espace>`, `client/src/state.ts:79`). Sofia l'avait déjà proposé
  le 23 (synthèse, « idées à mûrir »).
- **Piste** (S) : afficher « Revenir chez-nadia » en tête de « Ce soir » quand le
  téléphone a une identité dans une soirée ouverte.

### 12. La pause ne se voit pas du canapé — friction · P3 · S

- **Qui l'a vécu.**
  - Nadia : sur la télé, seul un petit « II » remplace le compte à rebours
    (`020`).
  - Lucas : « un petit mot sur l'écran du téléphone aiderait ».
  - Camille M. : un signal quand la question reprend.
- **Ce qui marche.** Le chronomètre reprend « pile où il s'était arrêté »
  (Lucas). Le journal compte 15,4 s à Lucas pour une réponse arrivée 34 s après
  l'apparition de la question, dont 21 s de pause.
- **Preuve.**
  - Les secondes sont remplacées par une icône de 0,6 em, à la télé comme au
    téléphone (`TimerBar.tsx:62`, `styles.css:1175`). La télé n'affiche aucun mot
    (`HostView.tsx:319-325`).
  - Le téléphone affiche un petit « En pause — regarde l'écran commun »
    (`PlayerView.tsx:248-251`), qui renvoie vers une télé muette.
  - Les réponses sont bloquées sans en avoir l'air (`PlayerView.tsx:275`, voulu).
- **Piste** (S) : écrire « En pause » en grand sur la télé, garder les secondes
  figées à côté de l'icône, et faire vibrer le téléphone à la reprise.

### 13. « nadia » est refusé, « chez-nadia » accepté — friction et tension avec l'invariant 3 · P3 · S

- **Ce qui se passe.** Nadia a seulement dit « c'est chez Nadia ». Camille M.
  tape « nadia » et se voit refusée, puis réussit avec « chez-nadia »
  (`camille-m/002`, `003`).
- **Preuve.**
  - Le formulaire mène à `/<normalizeSlug(saisie)>` (`Rejoindre.tsx:22-26` ;
    `shared/space.ts:46-56`). « chez nadia », tapé comme on le dit, aurait donc
    marché.
  - L'exemple du champ est « demo » (`Rejoindre.tsx:49`), l'espace de
    démonstration de l'administrateur.
  - Le message d'erreur ne rappelle pas ce qui a été tapé, et le champ revient
    vide.
- **La tension.** Proposer « chez-nadia » à qui tape « nadia » révélerait le nom
  d'autres espaces (invariant 3 : « le voisin n'en sait rien »).
- **Pistes** (S) :
  - un exemple du genre « chez-camille » ;
  - l'aide « le nom exact, avec ses tirets — « chez nadia » se tape aussi » ;
  - l'erreur « « nadia » ne mène à aucune soirée ».

### 14. Petits bugs et frictions

| Quoi | Qui | Preuve | Statut | Piste | P · E |
|---|---|---|---|---|---|
| Dans l'aperçu, « Passer à la question » devient « Revoir la photo » sous le curseur, et un clic tardif relance la photo | Nadia (`011`) | `EditorApp.tsx:917-931` | friction (le même piège que l'axe 2) | ignorer le clic dans la demi-seconde qui suit, comme `garde()` le fait dans la console | P3 · S |
| La césure « a- / t-il » au mur | Nadia (`024`, `025`) | `espacesFines` ne traite pas « -t-il » (`shared/typographie.ts:50-56`) | bug confirmé | un gluon (U+2060) après les traits d'union de « -t-il », « -t-elle » et « -t-on » | P3 · S |
| Le « 1 » de chaque prix n'a pas d'étiquette | Nadia (`027`) | `AwardsBoard.tsx:77-83`, ni libellé ni `aria-label` | bug confirmé (accessibilité) | « pts » visible et un `aria-label` (voir le constat 1) | P3 · S |
| Les réponses gardent l'ordre de saisie : la bonne est en premier dans 6 QCM sur 9 | Nadia | le quiz dans la base ; aucun mélange nulle part | idée | un avertissement dans l'éditeur, ou un mélange au lancement (hors vrai/faux) | P3 · S-M |
| « Créer les 6 équipes d'un coup », pour sept invités | Nadia | `HostApp.tsx:597-601` | friction | un nombre réglable, ou un bouton « Répartir les invités » | P3 · S |
| « 0 pts · 1ʳᵉ place » sur le téléphone avant le premier quiz | Jeanne (`005`) | le panneau des équipes, lui, ne classe rien avant un quiz (`TeamBoard.tsx:39-43`) | friction | ne pas afficher le rang tant que rien n'est joué | P3 · S |
| Aucun `aria-sort` sur la colonne triée | rejeu | 0 `th` porte `aria-sort` (`arbre-a11y.mjs`) | bug mineur (accessibilité) | `aria-sort` sur la colonne active | P3 · S |
| Le toast « Nadia t'a placé·e… » est-il annoncé au lecteur d'écran ? | Hugo | le toast naît avec son contenu, `role="status"` (`PlayerApp.tsx:218-222`) | non confirmé (à écouter avec un vrai TalkBack) | une région vivante toujours présente | P3 · S |
| « 5ᵉ » (U+1D49) bien prononcé ? | Hugo | — | non confirmé | à écouter avec un vrai TalkBack | P3 |
| Le chronomètre urgent ne tient-il qu'à la couleur ? | Camille D. | non : les chiffres et une barre qui bat (`styles.css:1156`, `1174`) | non confirmé (pas un problème) | — | — |

### 15. Les idées des personnages, à mûrir

- **Nadia.**
  - Voir **qui** n'a pas répondu, sans le projeter. Déjà demandé le 23 : la
    console n'affiche toujours qu'un compte (`HostApp.tsx:527`).
  - En mode automatique, se mettre en pause quand personne n'a répondu. La
    coupure l'a montré : trois questions et un podium ont été joués devant une
    salle vide.
  - Une télécommande sur son téléphone : Léa l'a bricolée, mais les prix et la
    victoire ne suivent pas à la télé.
  - Le résultat des équipes sur l'écran de clôture (`031`).
  - Répartir les invités dans les équipes, qui s'étaient choisi la même équipe à
    cinq sur six.
- **Karim.** Le récapitulatif après une coupure (constat 9).
- **Camille M.**
  - Les prénoms dans le choix d'équipe (constat 7).
  - Un signe de plus que « (2) » pour une capture partagée. L'invariant 17 le
    permet, puisque tout reste à l'affichage.
- **Sofia.**
  - La progression chiffrée sous chaque avatar légendaire.
  - Un bilan qui reconnaît le profil connecté.
- **Camille D.** La carte d'un joueur, ouverte depuis le souvenir.
- **Lucas.**
  - Sa vitesse face aux autres, en direct.
  - La limite de 24 caractères annoncée avant qu'on tape.
  - Le Contemplatif et Le Doigt qui Tremble naissent tous deux de ses
    changements d'avis tardifs. C'est conforme aux règles (le temps retenu est
    celui de la dernière réponse), et il trouve ça « plutôt malin ».

## Ce qui plaît — à ne pas casser

- **Entrer sans compte.** « Jouer sans compte » se trouve du premier coup, Jeanne
  comprise, et six personnages donnent 5/5 à l'entrée.
- **Les homonymes.** Camille D. : « Camille (2) » apparaît partout, jamais comme
  une couleur ni comme un rang caché. Les deux Camille n'ont jamais été
  confondues.
- **Rien ne repose sur la couleur seule.** Les formes (▲ ◆ ● ■), la coche, « toi » et
  « la bonne réponse » suffisent : la daltonienne n'a rien manqué.
- **La robustesse** (Lucas). Changer d'avis, toucher deux fois, faire retour en
  pleine question (« Quitter la soirée ? »), ouvrir un deuxième onglet : les
  onglets restent synchronisés, et on ne peut pas voter deux fois. Le pseudo est
  coupé à 24 caractères sans moitié d'emoji. La pause fige le chronomètre à la
  seconde.
- **Les incidents se disent** (Karim). « Trop tard ! » donne la bonne réponse, le
  total et le rang. « Ta réponse n'est pas partie » s'affiche aussitôt. Et les
  coups du sort (« Le Somnambule ») transforment une soirée ratée en souvenir.
- **« Coller une liste »** est ce que Nadia a préféré. Elle a écrit 10 questions en
  4 min 38 s (journal, 15:03:15 → 15:07:53). « Copier le format complet » plaît
  aussi, et le temps collé suit bien les questions sans ligne « Temps » (dans la
  base, toutes ont 45 s, sauf l'estimation à 60 s).
- **La photo à mémoriser et son aperçu**, et **le gros bouton doré**, qui dit
  toujours la suite.
- **Le mode automatique** : « Suivante dans 6 s ».
- **La révélation d'une estimation** : 420 km en énorme, et les invités rangés du
  plus proche au plus loin.
- **Les prix calculés**, drôles et bienveillants. « L'Éclair : Jeanne » a été le
  meilleur moment de la soirée.
- **Les ex æquo couronnés ensemble.** La clôture propose le titre de la soirée, et
  « C'était un essai » reste en rouge, à l'écart.
- **Le lendemain** : l'historique, le souvenir (« un vrai album »), le bilan en un
  seul lien, les fiches à imprimer, et l'export du quiz.
- **Le profil** (Sofia) : deux étapes, un code de secours copiable, et le médaillon
  qui dit comment le décrocher.
- **Le bilan au lecteur d'écran** (Hugo) : le verdict en toutes lettres, des titres
  partout, des repères nommés.
- **Trois soirées sur un même serveur** sans une erreur au journal ni une fuite
  d'un salon à l'autre (Léa : « aucune fuite constatée »).

## Écarté : ce qui vient du banc

- **La coupure de l'outil** (de 15:25 à 15:54 environ) :
  - les questions 8 à 10 sont restées sans réponse, et le podium a été joué
    devant une salle vide ;
  - Nadia n'a pas vu la photo disparaître, et Hugo n'a pas joué la question
    visuelle ;
  - Karim n'a pas pu tester le rechargement ;
  - Camille M. a « décroché ».
- **Les « images sans nom » et les en-têtes en `cell` de Hugo.** Le geste `voir`
  montre l'instantané « IA » de Playwright (`regie.ts:765`), qui liste une `<svg
  aria-hidden="true">` comme `img` et un `th` comme `cell`. J'ai rejoué avec
  l'arbre d'accessibilité de Chrome (`arbre-a11y.mjs`) :
  - sur le bilan de Hugo, les 53 `svg` sont tous `aria-hidden`, Chrome n'expose
    **aucune** image, et l'instantané du pilote affiche 53 lignes « img » ;
  - sur le tableau du souvenir, Chrome expose **19 `columnheader`** (Joueur,
    Points…).

  Pour la régie : pour le personnage au lecteur d'écran, `voir` devrait utiliser
  `ariaSnapshot()`, qui respecte `aria-hidden`.
- **« Trop tard » à la question 2 de Camille M.** Après la pause, le raccourci
  `question` attend une question **nouvelle**. Il ignore la même question
  rouverte quand l'agent n'y a pas encore répondu (`regie.ts:1241-1247`). Elle a
  donc attendu jusqu'à la révélation (journal, 15:19:31 → 15:20:12), et
  l'archive n'a aucune réponse d'elle à Q2. Lucas, lui, a répondu après la
  reprise. Pour la régie : rendre la question ouverte quand `!p.question.repondu`.
- **La question 4 de Karim, au sortir de la veille.** La question s'est close à
  15:22:42, pendant que l'agent enchaînait trois gestes (console, voir, répondre) :
  c'est son temps de réaction, pas l'application.
- **La question 6 révélée sans Karim.** Nadia a révélé à 6 sur 7 (« Il en manque
  un… tant pis, je révèle ! »). C'est un choix de l'animatrice.
- **Les 20 « scanner » refusés** avant que l'écran commun s'allume, et le « chez
  nadia » tapé comme un geste par Lucas : l'usage du pilote.

## Les captures qui parlent

- `export/tablee/2026-09-24-trois-salons/captures/nadia/029-victoire.png`. Après
  le podium (`026`), qui annonçait les Arrabbiata, quatre prix pour rire
  couronnent deux équipes. En 1366 × 768, la liste des joueurs s'arrête sur Hugo.
- `export/tablee/2026-09-24-trois-salons/captures/nadia/005-temps-2045.png`. « 45 »
  est devenu « 2045 », la question est « prête », et elle sera enregistrée à 120 s.
- `export/evaluations/verification/salon-nadia/souvenir-equipes-360-130.png` (et
  `captures/jeanne/011-souvenir-palmares.png`). Au texte agrandi, le bloc des
  équipes du souvenir s'écrit lettre par lettre.
- `export/tablee/2026-09-24-trois-salons/captures/nadia/016-equipes-melangees.png`.
  « Camil… » dans la colonne où l'on fait les équipes, et « Camille (2) » en
  entier dans le classement juste à côté.
