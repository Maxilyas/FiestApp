# Le détail, et une expédition bien plus difficile (la version 15)

Le 20 octobre 2026, vers 13 h, le propriétaire, aux trois questions laissées
par la version 14 (`les-familles.md`, « Ce qui reste à trancher ») :

> « Je veux quelque chose de bien plus difficile, aussi met un offset car tu
> as tendance à sous estimer la difficulté. Fait la forme du détail. Les
> autres suit tes recommandations »

Quatre chantiers, une version du départ — la 15 (`VERSION_DU_DETAIL`), en
préproduction avec les versions 10 à 14 (`QUESTION_AU_CENTRE_EN_PRODUCTION`) :
une expédition partie en version 14 finit à ses règles.

## 1. La forme du détail

Ce que le plan disait (`la-frise.md`, « Le détail, quand les images
viendront »), avec les cent tableaux livrés la veille (`server/content/details/`).

- **La moitié de l'escale de la frise**, dès l'étage 2
  (`POIDS_DES_FORMES_AU_DETAIL` : frise 5 %, détail 5 %, le même tirage) — et
  l'escale d'un détail se pose en **Arts & lettres** (`CATEGORIE_DU_DETAIL`) :
  ses tableaux viennent tous de là, et sur une escale de sport, la carte
  aurait menti. Posé après le tirage, le thème ne déplace aucune autre escale.
- **« Qui a peint ce tableau ? »**, avec les quatre choix de la question de
  la base qui demande son peintre — jamais « Quel est ce tableau ? » : la
  réponse est celle de la question de la base, qui entre au carnet ratée, et
  ses leurres sont déjà relus. Une question « le demande » si sa bonne réponse
  est une personne de ses entités (`demandeLePeintre`) : la base écrit
  « Pierre-Auguste Renoir » là où la fiche dit « Auguste Renoir », et la
  largeur du Sacre ou le musée de la Ronde de nuit ne demandent pas qui l'a
  peint. Quatre-vingt-dix-neuf tableaux sur cent se posent.
- **Quatre cadrages, cinq secondes chacun** (`MS_PAR_CADRAGE`), à l'heure du
  serveur, dès que la question se voit (le détail s'annonce, comme un
  dévoilement : `voir`). Arrêt sur image s'y joue et suspend le compte cinq
  secondes. **Reconnu au premier ou au deuxième cadrage, deux crans** ; après,
  un (`cransDeLaForme`, comme le dévoilement trouvé avant la moitié de ses
  mots).
- **Invariant 1** : la vue n'envoie ni le QID, ni le titre, ni l'intitulé de
  la base (il nomme le tableau) — son texte est `QUESTION_DU_DETAIL`, et
  l'heure de son premier cadrage. Les images restent hors de `client/public` :
  une route les sert une à une (`GET /api/expedition/:id/detail/:position/:cadrage`),
  425 avant leur heure, toutes une fois la réponse jugée. La révélation et
  « Mes réponses » montrent le tableau entier, nommé.
- **Les cartes** : ce qui s'y comprend s'y joue — Coup d'œil et ce qui
  efface, L'initiale, La lettre, Le repère (l'époque du tableau), le Sphinx,
  Double chance, Arrêt sur image ; ce qui le changerait de forme se refuse en
  le disant (« Pas sur un détail : sans son tableau, la question le
  nommerait » : Corser, Polymorphe, Simplifier, Miroir, Métamorphose, le
  Prisme), et Deux visages (« deux tableaux à la fois »). Échange tire un
  autre tableau ; Leçon et la Bibliothèque, leur catégorie fétiche.
- **Jamais deux fois le même tableau d'abord** : aucune de ses questions vue,
  à la marche de l'escale s'il en reste, puis le plus anciennement vu
  (`detailPourUneEscale`) — la largeur du Sacre vue en série, le Sacre est vu.
- **La réponse** : celle de sa question de la base, à la forme `detail` —
  elle ne mesure rien ; ratée, elle entre au carnet ; elle se signale.

## 2. Bien plus difficile, avec l'offset

La cible, écrite avant de mesurer : « bien plus difficile » lu comme le fort
aux trois quarts et le moyen au quart ; l'offset la pousse quinze points plus
bas — **le fort à 60 % (± 5), le moyen à 20 %, le faible à 2 ou 3 % aux
niveaux 3 à 10 ; au niveau 1, le fort à 50 %, le moyen à 10 ou 15 %**.

Mesuré au simulateur (`calibrage-rencontres.ts --version 15`), en deux
temps. **D'abord avec le joueur sans style de la version 14** — il prend les
cartes dans l'ordre où, seules, elles valaient à la version 14
(`PREFERENCE_DES_FAMILLES`) —, trois cents puis cinq cents expéditions par
case :

| Essai | Niveau 1 | Niveau 3 | Niveau 6 | Niveau 10 |
|---|---|---|---|---|
| version 14 | 2 · 37 · 95 | 5 · 56 · 97 | 9 · 61 · 97 | 7 · 55 · 97 |
| acte 2 en moyenne, acte 3 en difficile en haut, gardien expert | 0 · 3 · 37 | 1 · 11 · 57 | 1 · 17 · 63 | 3 · 14 · 62 |
| acte 2 rendu, gardien de l'acte 3 en difficile | 0 · 10 · 81 | 1 · 24 · 91 | 1 · 25 · 93 | 3 · 21 · 89 |
| le même, gardien à 5 crans | 0 · 8 · 77 | 1 · 17 · 92 | 1 · 18 · 90 | 0 · 20 · 88 |
| acte 2 rendu, gardien de l'acte 3 en difficile, deux de frappe de plus partout | 1 · 15 · 81 | 2 · 28 · 91 | 2 · 36 · 91 | 3 · 27 · 88 |
| marches d'avant, un cran de plus aux élites et aux gardiens, trois de frappe de plus | 0 · 16 · 78 | 1 · 31 · 92 | 1 · 36 · 88 | 1 · 28 · 86 |
| acte 3 seul : difficile en haut, gardien expert | 1 · 10 · 39 | 4 · 21 · 63 | 5 · 25 · 69 | 5 · 23 · 63 |
| le même, gardien à 3 crans | 1 · 17 · 54 | 6 · 31 · 77 | 7 · 35 · 78 | 7 · 31 · 75 |
| le même, gardien qui frappe 8 | 1 · 13 · 48 | 5 · 26 · 71 | 5 · 30 · 77 | 6 · 27 · 71 |

**Puis avec le joueur remis à jour** — l'ordre où, seules, les cartes le
mènent au bout à la version 15 (`PREFERENCE_DU_DETAIL`, mesuré sur l'avant-
dernière ligne) : il prend mieux, et l'acte 3 « difficile en haut » ne
suffisait plus (1 · 13 · 55, puis 6 · 33 · 80, 6 · 31 · 78, 5 · 30 · 78).
Quatre cents puis six cents expéditions par case :

| Essai | Niveau 1 | Niveau 3 | Niveau 6 | Niveau 10 |
|---|---|---|---|---|
| acte 2 en moyenne, élite et gardien difficiles | 0 · 9 · 49 | 3 · 25 · 75 | 2 · 22 · 77 | 1 · 19 · 74 |
| acte 2, gardien difficile seul | 0 · 9 · 50 | 2 · 28 · 79 | 2 · 23 · 77 | 3 · 21 · 76 |
| acte 3 en difficile en bas aussi | 1 · 7 · 47 | 1 · 21 · 75 | 3 · 20 · 76 | 2 · 21 · 72 |
| acte 3 : l'élite experte | 1 · 12 · 48 | 5 · 31 · 75 | 5 · 27 · 71 | 4 · 25 · 69 |
| le même, et l'acte 2 durci | 0 · 8 · 45 | 2 · 24 · 69 | 2 · 17 · 65 | 1 · 18 · 66 |
| acte 3 : l'élite et les hauts étages experts | 1 · 8 · 28 | 5 · 20 · 51 | 5 · 19 · 55 | 4 · 19 · 47 |
| acte 3 : les hauts étages experts, le gardien difficile | 2 · 21 · 60 | 5 · 40 · 77 | 5 · 40 · 78 | 4 · 39 · 78 |
| **acte 3 : les hauts étages et le gardien experts** (retenu) | **1 · 9 · 34** | **5 · 21 · 57** | **6 · 24 · 60** | **5 · 22 · 58** |

(le faible, le moyen et le fort au bout, pour cent ; la ligne retenue, cinq
cents expéditions, au code final.)

- **Seules les questions expertes retiennent le fort.** Les crans des
  élites et des gardiens, l'attaque d'une erreur, une marche de plus à
  l'acte 2 retirent au moyen bien plus qu'au fort — il reste à 75-90. Le
  gardien de l'acte 3 en experte, puis ses hauts étages, le ramènent à
  soixante ; l'élite garde sa marche difficile — experte aussi, le fort
  tombait sous cinquante. **« Jamais d'experte » était un choix de produit**
  (`MARCHES_DES_ACTES`) : la version 15 le rompt pour l'acte 3
  (`MARCHES_PLUS_DURES`). Les crans et l'attaque restent ceux de la version
  14 : le plus simple qui tient la cible.
- **Le niveau 1 n'y est pas** : le fort à 34 au lieu de 50, le moyen à 9.
  L'écart entre le niveau 1 et le niveau 3 vient des fioles — ouvertes au
  niveau 3, deux bues par expédition — : tout réglage commun qui remonte le
  niveau 1 à cinquante remonte les autres au-dessus de soixante-dix. Un niveau
  1 plus dur, dans le sens de l'offset ; à défaire, s'il le faut, par une
  règle du codex au niveau 1, pas par la difficulté de tous.
- **Le faible à 5 ou 6** au lieu de 2 ou 3 : il va au bout quand les cartes
  d'aide tombent bien, que la version 14 lui donnait déjà (7 à 9).
- **Débloquer n'affaiblit pas** : le moyen va au bout 9, 21, 24 puis 22 fois
  sur cent — le niveau 10 sous le 6, dans le bruit de cinq cents expéditions,
  comme en version 14 (61, puis 55).
- **La carrière** (cinquante joueurs, vingt expéditions) : le moyen au bout
  17 fois sur cent à ses trois premières (42 en version 14), puis 21 et 22
  (60) ; le fort 35, puis 56 et 53 (95 à 98) ; le faible 1 à 5 (3 à 6). Le
  moyen passe le niveau 10 à sa quinzième expédition (treizième) : la
  renommée vient aussi des expéditions perdues. Les exploits : le gardien de
  l'acte 3 intact, 46 moyens sur cent en vingt expéditions (86), 78 forts
  (100).
- **L'Ascension** : [ASCENSION]

## 3. L'Élan : une aide qui revient

- **Foulée** (commune) efface une mauvaise réponse et revient si juste —
  deux, améliorée ; elle ne frappe plus. **Le Rythme** (rare) en efface deux.
  **Vent arrière** (épique), posé, efface une réponse à chaque question —
  dès celle où il se pose — tant qu'il a juste, retombe à la première erreur
  (`retombentALErreur`), et la carte jouée revient ; il ne frappe plus.
- Chaque carte seule (`--cartes --version 15 --cas 3`, quatre cents
  expéditions au niveau 10, le moyen et le fort, contre ne rien prendre —
  12 et 48) : Inarrêtable +9 · +8, Foulée +5 · +4 (+2 · +3 en version 14),
  le Rythme +3 · +5 (+6 · +1), Vent arrière +2 · −1 (−1 · +2) — joué d'abord
  comme un pouvoir sur une question qu'il savait, −1 · −9 : il efface dès sa
  question, il se joue sur celle qu'on ne sait pas. Échauffement 0 · −9 et
  Accélération −1 · −4, intouchés : elles frappent, et frapper vaut peu.
- Les styles : [STYLES]

## 4. Le carnet : le second essai y entre

Une question retrouvée au second essai entre au carnet : sa première réponse
était fausse. Le carnet lit `campagne_reponses` (`suivisDe`) : une réponse
juste aidée par une carte d'essai — la colonne `joker` porte Parade, Second
souffle, Bastion ou Cuirasse (`CARTES_DU_SECOND_ESSAI`) — y compte comme
ratée. La carte de l'essai passe désormais avant celle d'un indice joué avec
(`jokerQuiAide`). La règle vaut aussi pour les réponses de la version 14 : le
carnet se relit du journal à chaque lecture.

## Ce qui s'écarte du plan

- « Quel est ce tableau ? » n'est pas posé : sa réponse ne serait aucune
  question de la base, et ne pourrait entrer au carnet.
- Le détail ne prend pas le thème de son escale : il l'impose (Arts &
  lettres).
- Le niveau 1 reste sous la cible, le faible un peu au-dessus, et seules
  les marches ont bougé (plus haut).

## Les invariants que l'étape touche

- **1** : jamais un cadrage avant son heure, ni le tableau avant le verdict.
- **6** : les cadrages se comptent à l'heure du serveur ; la page les relit à
  `serverNow()`, et la route refuse ce qui vient trop tôt.
- **14** : une expédition de la version 14 garde ses marches, son Élan et ses
  formes ; la 15 se rejoue à la sienne.

## Vu à l'écran

`server/scripts/rendu-detail.ts` (360 × 640) : l'annonce, les quatre
cadrages, la révélation, « Mes réponses », Échauffement et Inarrêtable levés
au codex. Le cadre du tableau à hauteur fixe poussait la quatrième réponse
sous le pli : il cède sa hauteur aux réponses, comme la photo d'une question
(`.exp-detail-cadre`). Inarrêtable levé disait « Pour toute la rencontre »
quand ses mots le faisaient retomber à l'erreur : un pouvoir qui retombe dit
« Jusqu'à ta prochaine erreur ». La page du départ lisait encore le codex à
la version 14 (Vent arrière « +2 ») ; une révélation d'un détail disait « au
2ᵉ mot ».
