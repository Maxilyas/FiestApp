# Les coups de pouce et les lettres — l'étape 3 de « La question au centre », le 19 octobre 2026

L'étape 3 du plan « La question au centre » (`la-question-au-centre.md`),
après la question d'abord (l'étape 2, la version 10). Le testeur, le même
jour : « Ça manque un peu de cartes pour donner des indices […]. Ça pourrait
être des bails genre ça te donne des aides pour la réponse mais genre de
différentes manières. Soit un indice, soit ça te donne des lettres présentes
dans la réponse […] comme un pendu. Je pense ça donnerait plus de variété
dans la manière de répondre. »

## Ce qui a été décidé

Le propriétaire, le 19 octobre 2026, à trois questions :

1. **La forme à composer** — la question sans choix : on compose la réponse
   en touchant des tuiles, ses lettres mélangées et trois lettres en trop.
   Pas de clavier : il pousserait les boutons hors de l'écran. Elle vaut
   deux crans, comme six choix. **Les réponses de deux mots au plus et de
   douze lettres au plus** (« Victor Hugo », « Mont Blanc ») — plutôt qu'un
   seul mot de dix lettres, ma recommandation : 59 % de la base s'y prête,
   au lieu de 25 %.
2. **Trois cartes neuves, des coups de pouce** (ma recommandation) :
   L'initiale, Le repère, La lettre.
3. **Une escale à composer sur cinq**, dès l'étage 2 (ma recommandation).

## Ce que la base sait déjà

Mesuré sur les 26 291 questions de la base de la campagne
(`server/content/campagne/`) :

- **La forme à composer** : une bonne réponse de deux mots au plus — séparés
  par une espace ; le trait d'union et l'apostrophe restent dedans, posés
  d'office —, de quatre à douze lettres, sans chiffre : 15 382 questions,
  59 % — la moitié d'un mot, la moitié de deux. De 49 % en Sciences à 77 %
  en Géographie, et autant à chaque difficulté (de 57 à 69 %). Un article en
  tête (« La cochenille », « Un losange ») est posé d'office, devant les
  cases : on compose le mot, pas l'article.
- **Une date** : 39 % des questions en ont une (`date`, à l'année ou au
  siècle) — le siècle de la loupe, et l'époque du Repère.
- **Un domaine** : toutes ont leur sous-thème (« Histoire · Pouvoirs »).
- **L'initiale**, sur une question à quatre choix : elle n'appartient qu'à la
  bonne réponse une fois sur deux — décisive, comme Voyance qui en efface
  deux. **Le nombre de lettres** l'est deux fois sur trois : trop, pour une
  carte ; à composer, les cases le disent déjà.

## La forme à composer

- **Ce qu'on voit** : la question, puis les cases de la réponse, mot par mot
  — l'article, le trait d'union et l'apostrophe posés d'office —, puis les
  tuiles : les lettres de la réponse, sans accents (« É » est un E, « Œ » deux
  tuiles, O et E), et trois lettres en trop, mélangées d'avance par la graine.
  Toucher une tuile la pose dans la première case vide ; toucher une case
  pleine rend sa tuile. « Effacer » vide tout ; « Valider » attend que tout
  soit plein.
- **Le serveur garde l'ordre** (invariant 1) : la page reçoit les tuiles et
  la longueur des mots, jamais la réponse ; elle envoie les lettres
  composées, que le serveur compare à celles de la bonne réponse.
- **Juste** : l'adversaire perd deux crans (`CRANS_D_UNE_QUESTION_DURE`).
  **Faux** : il attaque, comme ailleurs. Le verdict dit ce qu'il fallait
  composer : « Tu as composé SOPHOCLES — c'était Sophocle ».
- **La chance** qu'annonce l'escale : le savoir, et un dixième de hasard —
  des tuiles bien rangées font parfois trouver un mot à moitié su
  (`chanceSelonLaForme`). Ses écus suivent sa chance, comme partout.
- **Les cartes qui effacent** retirent les lettres en trop : Coup d'œil une,
  Voyance et Sagesse deux, Révélation toutes, comme Augure d'avance,
  Vision, L'écholocation et la fiole de clairvoyance, une chacune. Simplifier
  repose la question en vrai ou faux : la porte de sortie de qui ne trouve
  pas. Ne s'y jouent pas : Corser, Polymorphe, Double chance, Deux visages,
  la Prédiction, Arrêt sur image — chacune le dit, et la main la garde.
- **Une réponse composée ne mesure rien** : sa forme l'écarte de la mesure
  des difficultés et du savoir, comme les autres formes
  (`campagne_reponses.forme`). Une erreur entre au carnet.

## Les coups de pouce

Trois cartes neuves, peintes comme les autres (`server/scripts/anime/cartes.ts`,
environ 0,035 $ l'image au modèle Nano Banana 2). Chacune est une aide : la
réponse aidée ne mesure rien (`jokerQuiAide`). Le serveur calcule ce qu'elle
montre, qui seul lit la bonne réponse (invariant 1).

| La carte | Rareté | À choix | À composer |
|---|---|---|---|
| **L'initiale** | rare | « Elle commence par S » — pas sur un vrai ou faux, elle répondrait à sa place | Elle pose la première lettre |
| **Le repère** | commune | Son époque — « les années 1240 », « le XIIIᵉ siècle » —, sinon son domaine — « Histoire · Pouvoirs » ; même sur un vrai ou faux | De même |
| **La lettre** | commune | « Sa troisième lettre : R » — une place où la bonne réponse se distingue ; pas sur un vrai ou faux | Elle pose une lettre à sa place |

Améliorées : L'initiale+ pose aussi la dernière lettre, Le repère+ dit les
deux — l'époque et le domaine —, La lettre+ en pose deux. Elles entrent au
codex à l'échelle de la version 11 : Le repère et La lettre au niveau 1, à
la place de rien — les communes du niveau 1 attendaient des aides —,
L'initiale au niveau 3.

## La version 11

Une forme de plus sur les cartes et trois cartes au catalogue changent ce
qu'une expédition tire : la version du départ monte, 11 — en préproduction,
comme la 10 (`QUESTION_AU_CENTRE_EN_PRODUCTION`). Une expédition partie en
version 10 finit à ses règles : ses cartes — gardées avec elle — n'ont pas
d'escale à composer, son codex figé n'a pas les trois cartes neuves. Au
premier étage, rien ne change : quatre choix sept fois sur dix, un vrai ou
faux sinon. Aux étages 2 à 6 : quatre choix 30 %, vrai ou faux 20 %, six
choix 15 %, dévoilement 15 %, à composer 20 %.

## Les invariants que l'étape touche

- **Invariant 1** — les tuiles disent les lettres de la réponse, c'est le
  jeu ; jamais leur ordre. Ce que montre un coup de pouce se calcule au
  serveur.
- **Invariant 12** — une carte jouée porte la position de sa question.
- **Invariant 14** — rien ne s'écrit de neuf dans le pli : les lettres
  posées et les tuiles retirées se déduisent de la graine, de la position et
  des cartes jouées.
- **La mesure** — une réponse composée, ou aidée, ne mesure rien.

## Le calibrage

`calibrage-rencontres.ts --version 11` : la chance d'une question à composer
vient de `chanceSelonLaForme` ; son joueur joue les coups de pouce quand il
ne sait pas, comme les aides. La cible ne change pas — le moyen au bout une
fois sur trois au niveau 1, en une quarantaine de questions — : une
question à composer est plus dure, et rapporte plus.

## Ce qui s'en est écarté, à la réalisation

- **La lettre dit qu'elle contient une lettre, pas sa place** : « Elle
  contient un R », comme au pendu — une lettre qu'une autre réponse encore à
  l'écran n'a pas. « Sa troisième lettre : R » départageait presque toujours :
  trop, pour une commune. Mesurée sur la base livrée (26 147 questions à
  quatre choix), qui ne sait pas trouve ainsi six fois sur dix.
- **L'initiale** n'appartient qu'à la bonne réponse **deux fois sur trois**,
  pas une sur deux — compté sans son article (« Sans son article, elle
  commence par C ») : qui ne sait pas trouve huit fois sur dix. Une rare.
- **Le repère efface quand il n'a pas d'époque à dire**, comme le Sphinx de
  l'Énigme. Proposé, il disait alors le domaine de la question — que
  l'escale dit déjà : mesuré seul contre ne rien prendre (mille expéditions
  au niveau 1), il retirait trois points au joueur moyen et six au fort,
  mort six fois sur dix dans la main. Une question qui ne se date pas, ou
  dont la réponse est une année — l'époque la donnerait —, perd désormais une
  mauvaise réponse — à composer, une lettre de trop — : il ne change plus
  rien au moyen, et coûte encore quatre points au fort, qui sait ses réponses
  et ne joue presque jamais d'aide. Amélioré, il dit le domaine en plus.
- **Les tuiles se mélangent au tirage de la question** et se gardent avec
  elle (`QuestionDeSerie.tuiles`, `enTrop`), au lieu d'être refaites de la
  graine à chaque lecture : leur ordre ne dépend pas du code du jour. Les
  lettres de trop que retirent les cartes, elles, se choisissent à la graine
  et au rang de la question, comme les réponses effacées.
- **La réponse composée s'écrit à part** (`campagne_reponses.composee`), et
  `choix` vaut la bonne réponse de la base si elle est juste, −1 sinon : les
  lectures qui comptent les réponses données — les missions lisent `choix IS
  NOT NULL` — la comptent sans rien en savoir.
- **Effacer** vide toutes les cases, comme prévu ; une case pleine touchée
  rend sa tuile.
- **Le rendu en 360 × 640 a trouvé les cases invisibles** : une case vide,
  sans largeur, ne comptait pour rien dans celle de son mot, qui tombait à
  zéro. Elle a une largeur, et le test le garde.

## Ce que le calibrage a mesuré

Le 19 octobre 2026, trois cents expéditions par case (le faible, le moyen et
le fort au bout) :

| | Version 10 | Version 11, sans les coups de pouce | Version 11 |
|---|---|---|---|
| Niveau 1 | 1, 32, 92 | 1, 31, 92 | 1, 30, 92 |
| Niveau 3 | 1, 36, 95 | 2, 38, 95 | 3, 41, 96 |
| Niveau 6 | 2, 43, 95 | 2, 43, 94 | 3, 49, 95 |
| Niveau 10 | 3, 44, 94 | 4, 42, 95 | 2, 45, 92 |

La forme à composer seule ne déplace rien : plus dure, elle rapporte deux
crans. Les coups de pouce font gagner au moyen trois à six points à mesure
qu'il les ouvre — La lettre au niveau 1, L'initiale au 3. Le moyen va
toujours au bout une fois sur trois à sa première expédition, en 38
questions, passe le niveau 10 à sa quatorzième, comme en version 10. Chaque
carte seule contre ne rien prendre : La lettre +8 au niveau 1 et +6 au
niveau 10 pour le moyen (mille expéditions), L'initiale +6 au niveau 10
(deux cent cinquante), Le repère retouché +0.
