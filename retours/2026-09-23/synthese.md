# La première tablée — « Les 40 ans de Sam », 23 septembre 2026

Une soirée entière jouée par huit agents (`/tablee`, voir
`.claude/skills/tablee/`) : Nadia, qui anime pour la première fois, et sept
invités de 16 à 71 ans, chacun sur son appareil, dans un vrai navigateur. En
31 minutes et 868 gestes, Nadia a activé son compte, écrit un quiz de neuf
questions (dont une estimation et une photo à mémoriser), fait deux équipes,
animé, remis des prix, clos la soirée et l'a relue ; les invités sont entrés,
ont joué, et ont relu leur fin de soirée, le souvenir et leur bilan. Chacun a
ensuite écrit ce qui lui a plu et ce qui l'a gêné.

**Chaque constat ci-dessous a été vérifié** — dans le code, sur les captures ou
dans le journal de la tablée — et ceux qui venaient du banc d'essai plutôt que
de l'application sont écartés à part, en fin de document. Les retours bruts
sont à côté (`<nom>.md`) ; les chemins de captures qu'ils citent renvoient au
dossier local de la tablée, hors de git, et une sélection est dans `captures/`.

## En bref

Le cœur tient, et il plaît : entrer sans compte, jouer, les deux Camille au
même renard jamais confondues, rien qui repose sur la couleur seule, le
retardataire accueilli sans rien faire, la coupure réseau dite clairement, la
photo qui disparaît, le bilan qu'on relit et qu'on partage. Tous
recommanderaient l'application.

Ce qui coince se range en sept axes, du plus coûteux pour une soirée au
moins coûteux :

1. **Le lendemain contredit la soirée** : trois verdicts d'équipes différents
   d'une page à l'autre, un palmarès qui affiche des prix que l'animatrice
   n'a pas remis — et perd celui qu'elle a inventé.
2. **La console de l'animateur** : des boutons qui changent de rôle sous le
   curseur, « Reposer » sans confirmation, un enchaînement automatique trop
   court, et une télé qui montre les coulisses.
3. **L'écran commun à 1366 × 768** : la console recouvre des réponses, le QR
   du souvenir est coupé.
4. **Les finitions du téléphone** : noms d'équipe coupés sans points de
   suspension, pseudo qui déborde, clavier qui cache le bouton, écrans qui
   s'ouvrent au milieu, changement d'équipe non signalé.
5. **L'accessibilité** : la bonne réponse invisible au lecteur d'écran dans le
   bilan, un podium lu dans le désordre, des chiffres sans nom.
6. **L'éditeur** : chaque question repart à 20 s sans catégorie, une photo
   qu'on ne peut pas agrandir.
7. **Les mots** : un texte périmé projeté au mur, le tu et le vous mêlés,
   l'élision, le masculin par défaut, la typographie.

## Qui était là

| Personnage | L'angle | Appareil | Sa soirée | Entrer · Jouer · Lire · Revenir |
|---|---|---|---|---|
| **Nadia**, 38 ans | anime pour la première fois | portable 1366 × 768 branché à la télé | activation, quiz de 9 questions, 2 équipes, prix, clôture, relecture | 4 · 4 · 4 · 4 |
| **Jeanne**, 71 ans | grand-mère, texte agrandi, lit lentement | petit Android 360 × 640, zoom 130 % | 4ᵉ, 1 281 pts | 4 · 5 · 4 · 5 |
| **Lucas**, 16 ans | cherche la faille, joue vite | iPhone | 2ᵉ, 1 501 pts | 4 · 4 · 4 · 5 |
| **Sofia**, 34 ans | veut son profil et sa progression | Android | 3ᵉ, 1 366 pts, niveau 2 | *voir son retour* |
| **Karim**, 29 ans | arrive en retard, réseau capricieux, veille | Android | 7ᵉ, 512 pts (4 questions perdues aux incidents) | 4 · 3 · 5 · 4 |
| **Camille M.**, 27 ans | n'a pas le QR : passe par l'accueil | Android | 1ʳᵉ, 1 611 pts, sans-faute | 4 · 5 · 5 · 5 |
| **Camille D.**, 45 ans | profil existant, homonyme, daltonienne | Android, vision deutéranope | 5ᵉ, 1 235 pts, « Camille (2) » | 5 · 4 · 5 · 5 |
| **Hugo**, 30 ans | aveugle, lecteur d'écran | Android, arbre d'accessibilité seul | 6ᵉ, 1 004 pts | 4 · 3 · 3 · 4 |

## Les axes d'amélioration

Priorité : P1 abîme la soirée de toute une salle, P2 celle de quelques-uns.
Effort : S, quelques lignes ; M, une journée ; L, un lot.

### 1. Le lendemain doit raconter la soirée qu'on a vécue — P1

**Trois verdicts d'équipes pour une même soirée.** L'écran de victoire et
l'historique annoncent « Les Carbonara et Les Randonneurs, ex æquo, 4 points
chacune » (barème + prix). Le souvenir classe « 1. Les Carbonara, 2. Les
Randonneurs », avec des chiffres cerclés 2 et 1 — le barème **sans** les prix —
sous une légende qui dit « les points de classement du quiz, auxquels les
prix se sont ajoutés ». Le bilan écrit « meilleure équipe : Les Carbonara »,
qui est la meilleure *moyenne*. Et de retour en salle d'attente, le panneau
des équipes de l'écran commun les classe encore 1 et 2.
*Vérifié* : le souvenir et la salle d'attente passent par `TeamBoard`, qui
classe par `rankTeams` et affiche `gamePoints` (`client/src/components/TeamBoard.tsx`,
`client/src/views/RecapApp.tsx:141`) ; l'écran de victoire par `finalRanking`
et `vainqueursDuQuiz` ; le bilan par la meilleure moyenne du quiz
(`client/src/components/BilanRoom.tsx:133`). Captures `02`, `03`, `04`.

**Le palmarès ignore la remise des prix.** Nadia a remis quatre prix
calculés sur dix et un prix libre (« Le coup de cœur de Sam », aux
Randonneurs). Le souvenir, les bilans et les fiches affichent les dix prix,
dont « L'Abstentionniste — 4 questions sans réponse » pour Karim, dont le
réseau avait lâché et que Nadia avait épargné à voix haute, et « Le Coup de
Pouce : Karim ferme la marche ». Le prix libre, lui, n'apparaît nulle part.
*Vérifié* : le souvenir affiche `recap.stats.awards`, tous les prix calculés
(`RecapApp.tsx:153`) ; aucune page d'après la soirée n'affiche les prix remis
(`bonuses`). C'est un parti pris écrit (README, « Les profils joueurs » :
« que l'animateur l'ait remis à l'écran ou non »), mais l'écran de remise des
prix — « Rien n'est attribué tant que tu ne cliques pas » — fait croire
l'inverse à l'animatrice. Capture `03`.

**Pistes.**
- (S) Le souvenir montre le barème **prix compris** (`finalPoints`), nomme
  l'équipe ou les équipes qui remportent le quiz (`vainqueursDuQuiz`), et sa
  légende dit ce qu'elle montre ; le bilan écrit « meilleure moyenne » là où
  il ne tient pas compte des prix.
- (S) Une section « Remis ce soir-là » dans le souvenir et le bilan : les prix
  remis à l'écran, prix libres compris, avec leurs points.
- (M, **à arbitrer**) Que devient un prix calculé que l'animateur n'a pas
  remis ? Soit l'animateur peut le retirer du palmarès (il retirerait aussi
  la ligne de l'étagère du profil), soit l'écran de remise change de nom
  (« Des points pour les équipes ») pour lever le malentendu. La première
  touche au parti pris « les récompenses sont des dérivations des journaux »
  (CLAUDE.md, invariant 20) : un retrait devrait lui-même être journalisé.

### 2. La console de l'animateur : des gestes sûrs, une télé sans coulisses — P1

**Des boutons qui changent de rôle sous le curseur.** Pendant une question :
« Révéler · Pause · Auto · Terminer » ; à la révélation : « Question suivante ·
Reposer · Annuler les points · Auto · Terminer »
(`client/src/games/quiz/HostView.tsx:283`). « Reposer » prend la place de
« Pause », sans confirmation ; un double-clic sur « Révéler » peut tomber sur
« Question suivante » et écourter la révélation — la visée des commandes
(invariant 12) ne protège pas de ce cas, puisque le second clic vise l'écran
qu'il a sous les yeux. Le focus reste sur la position cliquée : une
télécommande de présentation qui envoie Entrée déclencherait le bouton
suivant. Nadia : « j'ai eu peur à chaque clic », et elle n'a pas osé essayer
« Reposer », « Annuler les points » ni « Terminer ».

**L'enchaînement automatique.** Le bouton affiche l'état (« Manuel ») plutôt
que l'action ; 5 et 10 s ne laissent pas le temps de commenter ; le clic de
Nadia pour repasser en manuel est arrivé après le départ de la question
suivante, et son commentaire a sauté.

**La télé montre les coulisses.** La console est projetée : la boîte « Un
surnom pour « xX_LuCaS_Le_BoSs_Du_QuIz » ce soir » s'affiche en grand, la
remise des prix montre les dix prix et leurs lauréats avant qu'on les
annonce, avec une consigne écrite pour l'animatrice ; et remettre un prix ne
fait rien à la télé (la carte se grise).

**Qui n'a pas répondu ?** Pendant la question, l'animatrice ne voit que « 5 / 7
ont répondu » : impossible de relancer quelqu'un par son prénom. Elle n'a su
le prénom du retardataire qu'au podium.

**Pistes.**
- (S) L'action principale toujours au même endroit, à gauche ; les gestes
  risqués (Reposer, Annuler les points, Terminer) groupés à droite, et
  Reposer confirmé comme Annuler ; le focus rendu après chaque commande ; un
  second clic ignoré dans la demi-seconde qui suit un changement de phase.
- (S) « Enchaînement : manuel · 10 s · 20 s · 30 s », qui dit ce qu'il fera.
- (M) Les prénoms de ceux qui n'ont pas encore répondu, discrets, pendant la
  question.
- (L) Une remise des prix en scène — un prix à la fois, en grand — et, plus
  loin, **la console sur le téléphone de l'animateur**, la télé ne montrant
  que le jeu : c'est ce qui libérerait Nadia de son ordinateur (« animer
  debout au milieu du salon »).

### 3. L'écran commun à 1366 × 768 — P1

C'est la définition des portables qu'on branche à une télé. Vérifié sur les
captures :
- à la révélation d'une question à photo, la console recouvre la seconde
  rangée de réponses, et « Les équipes » et « Top du quiz » passent sous le
  bas de l'écran (capture `01`) ;
- au podium du quiz, « Les équipes après ce quiz » ne montre que son titre ;
- à la clôture, **le QR du souvenir est coupé** — celui que les invités
  doivent scanner pour emporter la soirée (capture `05`) ;
- en salle d'attente après un quiz, la console passe sur deux lignes
  (capture `04`).

Personne ne fait défiler une télé pendant une fête. **Pistes** (S-M) : une
photo de révélation bornée en hauteur (`vh`), une console compacte sur une
ligne, et vérifier l'écran commun en 1366 × 768 comme on vérifie le
téléphone en 360 × 640 — la tablée le fait désormais à chaque soirée.

### 4. Les finitions du téléphone — P2

- **Noms d'équipe coupés sans points de suspension** (« Les Carbonar »,
  « Les Randonneur », « Les Rando » au texte agrandi) — Lucas, Jeanne, Nadia.
  *Cause* : `.team-row .lb-name { display: flex }` (`client/src/styles.css:1964`)
  annule le `text-overflow: ellipsis` de `.lb-name` (`styles.css:771`) ; la
  pastille « Camille (2) » déborde aussi de sa carte d'équipe (capture `04`).
- **Un pseudo long déborde de l'en-tête** : `.me-header h2` (`styles.css:665`)
  n'a ni coupure ni points de suspension, quand le classement juste dessous
  en a (capture `06`). Le champ, lui, coupe à 24 caractères sans rien dire.
- **Le clavier cache le bouton** de l'écran du prénom (Jeanne : avatars et
  « Continuer » disparus) et de « Quelle soirée ? » (Camille M.) : ces écrans
  ancrent leur bouton en bas (`.join-grow`). *Piste* : `interactive-widget=resizes-content`
  dans la balise viewport (`client/index.html:7`) — Chrome Android remonte
  alors la page au-dessus du clavier —, à vérifier sur un vrai téléphone,
  puisque le clavier de la tablée est simulé (capture `07`).
- **La fin de soirée s'ouvre au milieu de la page**, sous son titre : seule
  l'entrée remet le défilement en haut (`Entree.tsx:111`).
- **Un invité changé d'équipe par l'animatrice n'en sait rien** (Camille D.) :
  un toast « Nadia t'a placé·e chez les Randonneurs ».
- **Le retour du navigateur sort de la soirée en pleine question** (Lucas) —
  le geste retour d'Android, souvent involontaire. *Piste* : une entrée
  d'historique posée à l'arrivée en salle d'attente, et un `popstate` qui
  demande « Quitter la soirée ? ».

Effort S pour chacun.

### 5. L'accessibilité — P2

Hugo a joué à l'oreille, avec l'arbre d'accessibilité pour seuls yeux. Il
salue la structure des titres, l'état des boutons annoncé (grisé, pressé), le
tableau des chiffres en vrai tableau, et les estimations (« La bonne valeur :
412 km »). Vérifié dans le code :
- **Dans le bilan, la bonne réponse d'une question à choix n'est marquée que
  pour les yeux** : la classe `correct` et une coche `aria-hidden`
  (`client/src/components/BilanQuestion.tsx:113`, `Icon.tsx:323`). Le lecteur
  d'écran ne peut pas savoir quelle réponse était la bonne. Pendant le jeu,
  la révélation du téléphone, elle, l'écrit en toutes lettres (« La bonne
  réponse : … »). *Piste* (S) : un texte masqué « bonne réponse » dans la
  ligne.
- **Le podium se lit 2ᵉ, 1ᵉʳ, 3ᵉ** : `order = [1, 0, 2]`
  (`client/src/components/Podium.tsx:57`). Avec deux équipes, sa troisième
  colonne reste vide et le décentre (Nadia). *Piste* (S) : le DOM dans l'ordre
  des rangs, la mise en scène par la propriété CSS `order`.
- **Des chiffres sans nom** : « 1 · 🐯 · Hugo · 0 » — lequel est le rang,
  lequel les points ? *Piste* (S) : un libellé par ligne de classement.
- **Les deux Camille ont les mêmes libellés** à l'écran commun (« Donner un
  surnom à Camille », « Exclure Camille… ») : les `aria-label` prennent
  `p.name`, sans la marque « (2) » (`client/src/views/HostApp.tsx:154`, `181`,
  `200`). C'est une quatrième porte par où sort un prénom (invariant 17).
- **La question à photo est injouable sans la vue** — c'est son principe.
  L'annoncer (« question visuelle ») plutôt que laisser l'invité découvrir
  une question sans image.

### 6. L'éditeur de quiz — P2

- **Chaque nouvelle question repart à 20 s et sans catégorie**
  (`emptyQuestion()`, `client/src/views/EditorApp.tsx:403` et `533`) : Nadia a
  corrigé le temps et la catégorie neuf fois. *Piste* (S) : une nouvelle
  question reprend le temps et la catégorie de la précédente.
- **La photo** : la vignette est minuscule et ne s'agrandit pas ; l'aperçu
  refuse une question sans deux réponses (« rien à projeter ») — Nadia a tapé
  deux fausses réponses pour pouvoir compter les bougies ; et l'aperçu ne
  joue pas la phase « Regardez bien… » d'une question de mémoire. (S-M)
- **L'export** télécharge un fichier sans dire qu'un autre animateur l'ouvre
  avec « Importer un quiz ». (S)

Ce que Nadia a aimé : le compteur « 9/9 prêtes », les avertissements
(« cette question ne sera pas jouée »), l'aperçu tel qu'il sera projeté, le
type Estimation et son unité, la liste des catégories.

### 7. Les mots — P2

Tout se lit au mur, par toute la famille. Vérifié :
- « **Ajoute-lui tes deux jeux physiques** pour désigner l'équipe gagnante de
  la soirée » s'affiche sous l'écran de victoire : c'est un reste de la
  soirée « jour-j », retirée au lot 23 (`client/src/views/HostApp.tsx:893`,
  capture `02`).
- **Le tu et le vous** : « Choisis ton mot de passe » (`ActivateApp.tsx:43`),
  « Créez le premier ! » (`EditorApp.tsx:249`), « Choisissez un quiz »
  (`HostView.tsx:111`).
- **« La soirée de Antoine »** : le titre d'un espace neuf ne fait pas
  l'élision (`shared/space.ts:93`).
- **La clôture propose « Soirée du 23 septembre 2026 »** plutôt que le titre
  de la soirée, « Les 40 ans de Sam » (`HostApp.tsx:460`).
- **Le masculin par défaut** : « 1ᵉʳ sur 7 » pour Camille, « toujours
  souriant » pour Camille (2).
- **Les espaces insécables** : un « ? » ou un « » » orphelin en début de
  ligne, au mur (capture `01`). *Piste* : les poser à l'affichage, avant
  ? ! : ; et à l'intérieur des guillemets.
- « Classées à la moyenne par membre, **en champagne** » : une couleur n'est
  pas un mot pour les invités.
- Le profil se vante en « **hauts faits** » et « **avatars légendaires** » :
  Jeanne n'y a rien compris. « Retrouve tes points et tes prix la prochaine
  fois » lui aurait parlé.

Effort S pour chacun.

### Et des idées à mûrir

- **Karim** : dans le bilan, distinguer « tu n'as rien proposé » de « ta
  réponse n'est pas partie » — le téléphone le savait sur le moment.
- **Camille M.** : « Copier le lien » sur la fin de soirée et le souvenir, pas
  seulement sur le bilan.
- **Lucas** : un prix de la vitesse régulière — jamais le plus rapide,
  toujours dans les premiers.
- **Nadia** : envoyer tous les bilans d'un coup (une page de liens, ou un QR
  par fiche imprimée) ; une pause qui se voit du canapé.

## Ce qui plaît — à ne pas casser

- **Entrer sans compte.** Les cinq invités entrés sans compte ont trouvé
  « Jouer sans compte » du premier coup, Jeanne comprise ; trois écrans jusqu'à la salle
  d'attente. Camille M., sans QR, a deviné l'adresse, et l'aperçu de
  l'adresse sous le champ l'a rassurée avant même de valider.
- **Les homonymes.** Deux Camille au même renard, jamais confondues :
  « Camille (2) » partout, à la télé, sur les téléphones, dans le souvenir, le
  bilan, le tableau des chiffres. Les deux l'ont relevé.
- **Rien ne repose sur la couleur seule.** Les formes des réponses, la ✓, le
  « TOI », le « raté » : la daltonienne n'a rien manqué (capture `08`).
- **Les incidents se disent.** Le retardataire entre sans que personne ne
  fasse rien ; la coupure réseau s'affiche aussitôt (« Connexion perdue —
  reconnexion… », « Ta réponse n'est pas partie — vérifie ta connexion »), et
  le bilan explique ensuite chaque question perdue.
- **Les deux meilleurs moments**, selon l'animatrice : la photo qui disparaît,
  et l'estimation, où la salle a le plus ri.
- **Le bilan personnel**, relu en détail par presque tous et partagé par son
  lien.
- **La console** : « on sait toujours quoi faire ensuite » — le bouton doré
  suit la soirée.
- **La clôture** : une confirmation où le nom se choisit, et « C'était un
  essai », en rouge, à l'écart.
- **Les prix bienveillants** : « un prix, pas une punition ».

## Écarté : ce qui venait de la tablée

- **« Ma réponse ne s'affichait pas comme enregistrée »** (six invités sur
  sept) : un faux positif du banc. Le pilote confiait l'attente de l'accusé à
  `waitForFunction`, que la politique de sécurité de l'application
  (`script-src 'self'`, sans `unsafe-eval`) refuse dès que le prédicat n'est
  pas vrai au premier regard — c'est aussi l'erreur « unsafe-eval » que
  Camille D. a vue passer en console. Le banc concluait donc dès le premier
  regard, quelques millisecondes après le toucher ; relue un instant plus
  tard, chaque réponse était enregistrée, et le journal n'en a perdu aucune.
  Corrigé : la régie relit la page jusqu'à l'accusé.
- **La page blanche après « retour »** (Lucas) : l'onglet de la tablée
  commence sur `about:blank`. Sur un vrai téléphone, le retour ramènerait à
  l'appareil photo qui a scanné le QR : le constat de fond demeure (axe 4),
  pas la page blanche.
- **Le rond brun sur la photo du gâteau** (Karim) : le soleil que la régie a
  dessiné.
- **« Aucune réponse possible à la question photo »** (Hugo) : son premier
  geste (`repondre 7`) avait été lu comme le numéro d'une réponse et non comme
  son texte — un défaut du pilote, corrigé —, et le second est arrivé après
  l'échéance.
- **« Jamais la bonne réponse, même en direct »** (Hugo) : la révélation du
  téléphone l'écrit en toutes lettres ; c'est le raccourci `question` qui
  sautait la révélation. Corrigé : il la lit maintenant. Le constat sur le
  bilan, lui, est confirmé (axe 5).
- **Les accents décalés dans la police des titres** (Nadia) : la police
  livrée contient toutes les lettres accentuées précomposées et ses ancres de
  diacritiques (`mark`, `mkmk`) ; non confirmé — à regarder sur un vrai écran.
- **Le temps de réaction des agents** (4 à 10 s, médiane) : celui de l'outil.
  Les questions duraient 45 à 50 s ; aucun invité n'a jugé le chronomètre
  trop court pour lire.

## Ce que la tablée a appris sur elle-même

Corrigé dans la régie et les consignes pour la prochaine fois :
- `attendre … --tele` échouait tant que l'écran commun était éteint ;
- un agent qui délègue son attente à une tâche de fond met fin à sa mission —
  les consignes disent maintenant d'attendre au premier plan ;
- l'accusé des réponses (`waitForFunction` refusé par la politique de
  sécurité) ;
- `repondre 2007` visait la réponse n° 2007 et non « 2007 » ;
- `question` ne saute plus ni la révélation ni la photo à mémoriser ;
- l'écran commun n'est reconnu que s'il montre le QR : un invité qui ouvre
  `/host` sur son téléphone n'est pas la télé ;
- un filet contre les promesses rejetées, comme celui du serveur.

Et à garder en tête : le clavier et la veille sont simulés, Chromium seul
joue les téléphones, et un agent reste un lecteur très attentif — il lit ce
qu'un invité survole. Ses retours disent où regarder ; un vrai téléphone
tranche.

## Les retours

- [Nadia](nadia.md) — l'animatrice qui débute
- [Jeanne](jeanne.md) — la grand-mère
- [Lucas](lucas.md) — l'ado pressé
- [Sofia](sofia.md) — la joueuse fidèle
- [Karim](karim.md) — le retardataire au réseau capricieux
- [Camille M.](camille-m.md) — celle qui n'a pas le QR
- [Camille D.](camille-d.md) — l'habituée daltonienne
- [Hugo](hugo.md) — le lecteur d'écran
