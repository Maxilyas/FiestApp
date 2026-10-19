# Les curiosités — l'étape 4 de « La question au centre », le 19 octobre 2026

L'étape 4 du plan « La question au centre » (`la-question-au-centre.md`),
après les coups de pouce et les lettres (l'étape 3, la version 11). Le
testeur, le même jour, parmi ses idées de questions : « l'origine d'un plat »,
« 4 images 1 mot » — « des trucs bonus sur le chemin qui te filent des
récompenses cool ».

## Ce qui a été décidé

Le propriétaire, le 19 octobre 2026, à quatre questions :

1. **Le rébus à composer** (ma recommandation) — comme « 4 images 1 mot » :
   des emojis en grand, la réponse en tuiles, le composeur de l'étape 3. Une
   centaine de rébus écrits pour lui — des films, des mots composés, des
   lieux, des personnages, des métiers —, deux mots au plus, des emojis
   d'avant Unicode 13, chacun relu par un test.
2. **Cent plats écrits pour lui** — plutôt que les quarante-cinq « D'où
   vient… ? » que la base de la campagne avait déjà (ma recommandation) :
   écrits et relus par la chaîne de la base (skill `base-campagne`), un lot
   par région du monde et un pour la France, puis rangés dans la base — ils
   servent aussi aux séries. 108 écrits, 103 rangés : cinq retirés à la
   relecture, parce qu'une de leurs mauvaises réponses mangeait aussi le plat
   sous ce nom (les khinkali en Russie, le poulet DG au Gabon, le bokit en
   Martinique, l'estofinade dans le Quercy, les pieds de porc panés en
   Lorraine).
3. **La récompense au choix** (ma recommandation) : une carte rare, une
   fiole ou un talisman côte à côte, un à prendre. La fiole et le talisman à
   leur niveau du codex (3 et 4) ; avant, une carte rare à leur place.
4. **Une par acte** (ma recommandation), dès l'étage 2 : le plat ou le
   rébus — trois par expédition —, tirée à part : aucune autre escale ne
   bouge.

## La règle

- **Sur la carte** : une escale à question des étages 2 à 6 de chaque acte
  devient une curiosité, tirée sur son propre fil (`graine:curiosite:acte`),
  une fois la carte faite — ni la sorte, ni le thème, ni la forme d'une autre
  escale ne change. Le plat une fois sur deux, le rébus sinon. Sur le plan,
  son emblème ; sur sa carte, « Curiosité », son nom — « D'où vient ce plat
  ? », « Le rébus » — et ce qu'elle rapporte.
- **Y entrer** : une question sans adversaire, comme la source, et sans
  cartes — la main attend les adversaires. Trouvée, elle ouvre la
  récompense ; ratée, elle ne coûte rien — ni courage, ni la série d'affilée
  de l'exploit —, et la révélation dit ce qu'il fallait répondre.
- **Le plat** : une question de la base, à quatre choix, parmi les « D'où
  vient… ? » de la cuisine qu'une liste retient
  (`server/content/curiosites/plats.json` : les 103 neufs et ceux de la base
  qui demandent vraiment d'où vient un plat — ni un fromage, ni une sauce, ni
  une marque, ni « de quelle ville tire-t-il son nom »), jamais vue d'abord.
  Sa réponse compte comme une autre : la mesure, le carnet, les écussons.
- **Le rébus** : « Quel film se cache derrière ces emojis ? », les emojis en
  grand, puis les cases et les tuiles — ses lettres et trois de trop —,
  jamais vu d'abord (`server/content/curiosites/rebus.json`). Sa réponse a
  une forme (`lettres`) : elle ne mesure rien, et un rébus n'entre pas au
  carnet — ce n'est pas une question de la base. Sa révélation dit comment
  il se lit (« Une porte et des feuilles : un portefeuille »).
- **La récompense** : trois places, une à prendre, comme une offre.

| Son niveau d'explorateur | Ce qu'elle offre |
|---|---|
| 1 et 2 | trois cartes rares de son codex |
| 3 | deux cartes rares et une fiole |
| 4 et plus | une carte rare, une fiole et un talisman |

  Une fiole quand son sac en a déjà deux, un talisman quand il les a tous :
  une carte rare à leur place. Ne rien prendre ne rapporte rien.

## La version 12

Une sorte d'escale de plus change ce qu'une carte tire : la version du départ
monte, 12 — en préproduction, comme la 10 et la 11
(`QUESTION_AU_CENTRE_EN_PRODUCTION`). Une expédition partie en version 11
finit à ses règles : ses cartes, gardées avec elle, n'ont pas de curiosité.

## Les invariants que l'étape touche

- **Invariant 1** — la bonne réponse d'un rébus ne part pas : ses cases et
  ses tuiles seulement ; le plat, comme toute question à choix.
- **Invariant 12** — la réponse dit la position de sa question.
- **Invariant 14** — rien de neuf ne s'écrit : la curiosité est dans la
  carte, figée au départ ; sa récompense se replie, du hasard de la graine
  et du rang de l'offre.
- **La mesure** — un rébus ne mesure rien ; le plat, si, comme une question
  nue.
- **Les emojis** — d'avant Unicode 13, sans drapeau ni liant : un drapeau
  s'écrit en deux lettres sous Windows 10 (`emojis.test.ts`, et le test des
  rébus).

## Le calibrage

`calibrage-rencontres.ts --version 12` : une escale à adversaire de moins sur
les chemins qui passent par la curiosité, et une récompense. Le plat se
trouve à la chance du joueur sur la cuisine, le rébus à sa chance moyenne,
composé. Le moyen allait au bout une fois sur trois en version 11 : la
curiosité est un cadeau, elle doit l'aider un peu, pas lui ouvrir la route.

## Ce qui s'en est écarté

- **Cent soixante-dix-neuf plats, pas cent** : les cent trois écrits, et
  soixante-seize que la base avait déjà, sous toutes leurs tournures
  (« De quel pays viennent… », « Dans quel pays mange-t-on… ») — j'en
  annonçais quarante-cinq ; relus un à un, ils étaient davantage. La liste
  se tient à la main : ce qu'un intitulé ne dit pas de lui-même se décide à
  l'œil — un fromage, une sauce, une marque, l'origine d'un nom n'en sont
  pas ; le bouillon d'awara, qui demande « de quel territoire d'outre-mer »,
  si —, et le test des plats livrés vérifie que chacun demande bien d'où
  vient un plat.
- **Cent cinquante-six rébus, pas une centaine** : des mots composés (35),
  des films (31), des personnages (28), des lieux (23), des métiers (16),
  des jeux, des plats et des fêtes (8, 7 et 8). Chaque genre a sa question
  — « Quel métier se cache derrière ces emojis ? » — : sans, on cherchait un
  film dans un mot composé. Ni drapeau — sous Windows 10, il s'écrit en deux
  lettres et dirait le pays —, ni liant, ni couleur de peau : chaque
  téléphone les dessine à sa façon.
- **Au niveau 1, deux cartes et pas trois** : le codex n'y a que deux rares,
  Double chance et Sursis ; la récompense ne propose pas une autre rareté à
  leur place. Trois au niveau 2, où s'ouvre Voyance.
- **Trouvée, elle ne prolonge pas la série d'affilée de l'exploit non
  plus** : une escale sans adversaire ne fait pas l'exploit, ni ne le
  coupe.
- **Sa carte dit sa sorte et son nom** : les cartes des escales sans
  adversaire n'avaient qu'un mot depuis la version 5 — « Curiosité » seul
  ne disait pas ce qu'on allait y faire.
- **Vu au rendu** : « Mes réponses » ne montrait pas les emojis d'un rébus,
  que le serveur envoyait — « Quel personnage se cache derrière ces
  emojis ? », sans eux. Ils se posent sous l'intitulé, en grand. Et
  « Ta récompense t'attend +10 XP » se lisait comme dix points de
  récompense : « Bien vu, ta récompense t'attend ! +10 XP ».

## Ce que le calibrage a mesuré

Trois cents expéditions par case, le faible, le moyen et le fort au bout :

| Niveau d'explorateur | Version 11 | Version 12 |
|---|---|---|
| 1 | 1, 30, 92 | 1, 34, 95 |
| 3 | 3, 41, 96 | 3, 47, 96 |
| 6 | 3, 49, 95 | 5, 50, 97 |
| 10 | 2, 45, 92 | 4, 50, 96 |

Douze rencontres par expédition au lieu de treize pour le moyen, autant de
questions. Sa carrière : ses trois premières expéditions vont au bout 41 fois
sur cent, 31 en version 11 ; de la quatrième à la dixième, 43 au lieu de 36 ;
de la onzième à la vingtième, 45 au lieu de 48 — le codex entier, le cadeau
pèse moins. Quatre à six points de plus pour le moyen aux niveaux 1, 3 et 10,
un au 6, et presque rien au fort : l'aide voulue, sans lui ouvrir la route.
