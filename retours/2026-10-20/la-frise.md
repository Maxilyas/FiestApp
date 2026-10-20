# La frise, puis le détail — l'étape 5 de « La question au centre », le 20 octobre 2026

L'étape 5 du plan « La question au centre » (`retours/2026-10-19/la-question-au-centre.md`),
après les curiosités (l'étape 4, la version 12). Le testeur, le
19 octobre 2026, parmi ses idées de questions : « des événements à remettre
dans l'ordre », « un tableau à reconnaître d'un détail ». Le brief de
l'étape 2 l'avait annoncé : « Les formes des étapes 3 et 5 — les lettres, la
frise, le détail — vaudront deux crans. »

## Ce qui a été décidé

Le propriétaire, le 20 octobre 2026 à une heure du matin : « Je vais aller me
coucher, je te laisse continuer les étapes et appliquer tes
recommandations. » **Ce brief n'a donc pas été validé point par point** :
chaque décision ci-dessous est ma recommandation, appliquée en son absence,
et dit ce que la changer coûterait. À relire à son réveil.

1. **La frise d'abord, le détail ensuite.** Le détail demande des tableaux,
   des images : le conteneur où je travaille ne joint pas
   `upload.wikimedia.org` (le proxy refuse, comme les musées qui publient
   leurs collections en accès libre), et je n'en fabrique pas. Il attend que
   l'hôte soit ouvert — plus bas, ce qu'il serait.
2. **La frise est une forme de question**, pas une escale bonus : une escale
   sur dix dès l'étage 2, comme la forme à composer — l'adversaire la pose,
   et elle vaut deux crans, comme six choix et à composer. Une escale bonus
   de plus ferait trois curiosités par acte et rien de neuf au combat.
3. **Ses événements viennent de la base de la campagne** : chaque événement
   est une question datée à l'année près, récrite en une ligne par un agent
   — « La prise de la Bastille ». L'année est celle de la question, déjà
   relue par la chaîne de la base ; la ligne ne dit jamais quand. Écrire
   six cents événements de mémoire, leurs dates comprises, aurait demandé
   une relecture de chaque date ; récrire ce que la base sait déjà n'en
   demande qu'une des lignes.
4. **Quatre événements, de la catégorie de l'escale**, à remettre du plus
   ancien au plus récent. Trois, au hasard, se trouveraient une fois sur
   six ; quatre, une fois sur vingt-quatre — elle vaut deux crans.
5. **Les écarts suivent la marche** : au moins trente ans entre deux
   événements voisins à une escale facile, dix à une moyenne, trois à une
   difficile. Une catégorie trop serrée pour l'écart demandé — les jeux
   vidéo tiennent en cinquante ans — le divise par deux jusqu'à ce qu'elle
   tienne, jamais sous un an : deux événements de la même année ne se
   rangent pas.
6. **Le serveur juge** (invariant 1) : la page ne reçoit que les quatre
   lignes, dans un ordre tiré au hasard qui n'est jamais le bon ; les années
   et l'ordre restent au serveur.
7. **Les cartes qui effacent datent** : sur une frise, chaque réponse
   qu'une carte effacerait devient un événement daté — Coup d'œil en date
   un, Voyance deux ; deux au plus, comme deux réponses effacées sur quatre :
   les deux autres restent à placer. Le repère en date un. Celles qui n'ont
   pas de sens sans choix ni lettres s'y refusent en le disant : Double
   chance, Corser, Polymorphe, Simplifier, Miroir, Deux visages, la
   Prédiction, L'initiale, La lettre.
8. **Elle ne mesure rien, n'entre pas au carnet, ne se signale pas** : ce
   n'est pas une question de la base, mais quatre — sa réponse s'écrit sous
   `frise:` et la forme `frise`, comme un rébus.
9. **La version 13 du départ**, en préproduction avec les versions 10 à 12
   qu'elle prolonge (`QUESTION_AU_CENTRE_EN_PRODUCTION`) : une expédition
   partie en version 12 finit à ses règles.

## La règle

- **Sur la carte** : une escale à question ou une élite des étages 2 à 6
  prend la forme `frise` une fois sur dix, à la place des quatre choix — les
  autres formes gardent leur part. L'annonce le dit : « Une frise : quatre
  événements à remettre dans l'ordre ».
- **La question** : « Remets ces événements dans l'ordre, du plus ancien au
  plus récent. » Quatre lignes en cartes, et quatre places sur une frise,
  du plus ancien au plus récent. Toucher une ligne la pose à la première
  place libre ; toucher une place la rend ; « Effacer » rend tout ;
  « Valider » quand les quatre sont posées — les gestes de la forme à
  composer.
- **Ses événements** : ceux du thème de l'escale — sa catégorie, toutes
  celles d'un mélange, les questions d'un thème pointu, celle du
  Commandement. Un thème qui n'a pas de quoi faire une frise la pose à
  quatre choix, comme une forme qu'aucune question ne prend. Jamais vus dans
  une frise d'abord ; à une marche facile, les événements des questions
  faciles d'abord.
- **Le verdict** : juste si l'ordre est le bon, en entier — deux crans. La
  révélation montre la frise dans l'ordre, chaque événement et son année ;
  ratée, l'ordre qu'il avait donné. « Mes réponses » la redit.
- **Les cartes qui datent** : un événement daté montre son année sous sa
  ligne, tiré de la graine et de la position, comme les réponses effacées.

## Le détail, quand les images viendront

Ce qu'il serait, et ce qu'il demande :

- **Une forme de plus**, la même escale sur dix partagée avec la frise : un
  tableau célèbre dont on ne voit qu'un détail, qui s'élargit à mesure — le
  dévoilement en images —, puis « Quel est ce tableau ? » ou « Qui l'a
  peint ? », à quatre choix tirés de la base (ses tableaux et leurs
  peintres viennent de Wikidata, les leurres aussi).
- **Les images** : des œuvres du domaine public, en accès libre
  (Wikimedia Commons, ou un musée qui publie les siennes), réduites et
  découpées d'avance en quatre cadrages, gardées dans le dépôt — une
  centaine de tableaux, quatre cadrages de 20 à 40 Ko : quatre à six
  mégaoctets. Le serveur envoie chaque cadrage à son heure (invariant 1 :
  jamais l'image entière avant la réponse).
- **Ce qui manque** : l'accès à `upload.wikimedia.org` depuis
  l'environnement — ou les images, déposées à la main.

## Les invariants que l'étape touche

- **Invariant 1** — l'ordre et les années ne partent pas avant le verdict ;
  un événement daté par une carte, si — c'est ce qu'elle fait.
- **Invariant 12** — la réponse dit la position de sa question.
- **Invariant 14** — la frise se tire au serveur avec sa question et se
  garde avec elle (ses lignes, ses années, l'ordre montré) : recharger
  redonne la même.
- **La mesure** — une frise ne mesure rien ; ses événements restent des
  questions de la base, que la mesure lit à part, quand on y répond.

## Le calibrage

`calibrage-rencontres.ts --version 13` : la frise se lit comme les autres
formes — le savoir du joueur sur la catégorie, sous le hasard de la forme :
un sur vingt-quatre (`chanceSelonLaForme`) —, et chaque événement daté par
une carte y ajoute ce qu'une lettre posée ajoute à composer. Un modèle, faute
de frises jouées à mesurer : savoir situer quatre événements à trente ans
près n'est pas savoir une réponse, et la semaine de jeu dira lequel des deux
est le plus dur. Une forme plus dure au hasard qui rapporte deux crans,
comme la forme à composer : elle ne doit presque rien déplacer.

## Ce que le code en a fait

La règle ci-dessus, telle quelle, sauf :

- **Le Sphinx date aussi** : sans époque à dire d'une frise — elle en a
  quatre —, il efface ailleurs ; ici, il date un événement, comme Le repère.
  La fiole de clairvoyance, L'écholocation et Vision de même : tout ce que
  `effaceesDuTour` compte date, deux au plus. Révélation, qui efface tout ce
  qui peut l'être, en date deux.
- **Échange, Volte-face et La mue tirent une autre frise** : l'escale garde
  sa forme, et la question neuve se tire à la même.
- **L'annonce dit « l'ordre du temps »** — « Une frise : quatre événements à
  remettre dans l'ordre du temps » —, et les règles ont leur ligne, sous
  celle de la forme à composer : « Les cartes qui effacent en datent, deux au
  plus. »
- **Mille trois cent neuf événements, pas six cents** : la base avait de
  quoi. Une première vague, un agent par morceau de la base (l'histoire en
  deux, puis les arts, le cinéma, la musique, les jeux, le sport, les
  sciences et la nature, la géographie et la cuisine, la culture et la
  fête) : 1 068 lignes, relues par quatre agents, l'année sous les yeux —
  une corrigée (Cabrel : en 1977, son premier album, « Petite Marie » était
  sortie avant), aucune retirée ; vingt-trois doublons écartés au rangement.
  La nature n'en avait que dix-sept — ses questions datées sont rares — :
  une seconde vague pour elle, la cuisine, la fête, la culture et la
  géographie, 293 lignes, relues par deux agents — deux corrigées, cinq
  retirées : trop peu connues en France pour se ranger d'intuition (le
  traité de Waitangi, Santa Baby, Joyeux Noël Charlie Brown, Achy Breaky
  Heart), ou un jubilé de platine qui donnait son année par le calcul. Deux
  lignes refusées au contrôle, récrites à la main : « Boeing 747 » et
  « Taipei 101 » portaient un nombre. De 47 événements en cuisine à 206 en
  histoire, 87 en nature.
- **Vu à l'écran** (`server/scripts/rendu-frise.ts`, 360 × 640) : chaque ligne
  de la frise rangée prenait la largeur de son année, et « 793 » décalait son
  événement de celui de « 1789 » — la colonne des années se partage
  (`subgrid`), alignée à droite. Une année datée par une carte s'écrit en or
  sous sa ligne, et la suit d'une place à l'autre.

**Le calibrage** (`calibrage-rencontres.ts --version 13`, trois cents
expéditions par case ; le faible, le moyen et le fort au bout) :

| Niveau | Version 12 | Version 13 |
|---|---|---|
| 1 | 1 · 34 · 95 | 1 · 31 · 92 |
| 3 | 3 · 47 · 96 | 4 · 47 · 96 |
| 6 | 5 · 50 · 97 | 5 · 50 · 96 |
| 10 | 4 · 50 · 96 | 4 · 52 · 95 |

Trois points au plus d'une version à l'autre : le bruit de trois cents
expéditions. Les trois premières expéditions du moyen vont au bout 46 fois
sur cent (41 en version 12). Comme annoncé, la frise ne déplace rien — et
le modèle de sa chance reste à vérifier sur la semaine de jeu.
