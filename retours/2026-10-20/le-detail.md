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
- **Le niveau 1 n'y était pas** : le fort à 34 au lieu de 50, le moyen à 9 —
  l'écart au niveau 3 venait des fioles et des premières rares.

### La cible revue : les cartes plus rares aident à gagner

En cours de route, la session qui avait lancé la version 15 a relayé le
propriétaire :

> « Je veux qu'avec les cartes plus rares, et du coup le fait de jouer, ça
> aide vraiment à gagner. Je suis d'accord pour avoir un faible pourcentage
> de victoire au début. »

et une cible neuve, l'offset compris : **au niveau 1, le fort à 30-35 %, le
moyen à 5, le faible à 0 ou 1 ; au 3, 45 et 10 à 12 ; au 6, 55 à 60 et 18 à
20 ; au 10, 65 à 70, 25 à 30 et 3 à 5** — la carrière qui monte nettement
d'un tiers à l'autre, chaque rare et chaque épique seule nettement au-dessus
d'une commune, et au niveau 10 le joueur qui ne prend rien bien en dessous de
celui qui joue. D'abord durcir ce qui ne dépend pas des cartes, puis régler
les rares et les épiques pour qu'elles rattrapent.

Le soin d'abord : la source, le campement, l'échoppe et la fiole de courage
ne rendent plus que **la moitié** (`SOIN_DU_DETAIL`). Puis la rareté, avec
les marches retenues plus haut — trois cents expéditions par case, puis cinq
cents :

| Essai | Niveau 1 | Niveau 3 | Niveau 6 | Niveau 10 |
|---|---|---|---|---|
| le soin à 40 %, +3 crans à l'épique, plus d'épiques dans les offres | 0 · 5 · 26 | 2 · 15 · 46 | 2 · 13 · 48 | 3 · 16 · 50 |
| le même, une épique efface deux réponses sur sa question | 0 · 6 · 26 | 2 · 16 · 44 | 2 · 14 · 47 | 2 · 17 · 50 |
| le même, une rare en efface une | 0 · 7 · 31 | 2 · 15 · 50 | 2 · 18 · 52 | 3 · 19 · 54 |
| sans effacer : une rare pare la moitié de l'attaque, une épique toute | 1 · 6 · 27 | 2 · 17 · 50 | 2 · 19 · 53 | 2 · 19 · 52 |
| la parade et l'effacement de l'épique, encore plus d'épiques dans les offres | 1 · 6 · 27 | 1 · 17 · 51 | 2 · 19 · 47 | 3 · 15 · 53 |
| la parade et l'effacement, une épique jouée en plus de la carte de la question | 1 · 6 · 27 | 2 · 17 · 50 | 2 · 18 · 54 | 2 · 22 · 52 |
| la parade, les fioles au niveau 6 au lieu du 3 | 1 · 6 · 27 | 1 · 13 · 50 | 2 · 19 · 53 | 2 · 19 · 52 |
| la parade et l'effacement, une rare qui pare tout, le soin à moitié | 1 · 8 · 31 | 2 · 15 · 55 | 4 · 23 · 59 | 3 · 26 · 56 |
| **la parade (la moitié, toute), le soin à moitié, le joueur remis à jour** (retenu) | **1 · 6 · 30** | **3 · 17 · 50** | **4 · 22 · 59** | **4 · 24 · 59** |

(la ligne retenue, cinq cents expéditions, au code final ; les crans de
l'épique et l'effacement retirés, sans effet.)

- **Une rare jouée sur la question pare la moitié de l'attaque d'une
  erreur, une épique toute** (`PARADE_DE_LA_RARETE`), en plus de ce
  qu'elle fait. Le codex ouvre les rares à partir du niveau 2 et les
  épiques à partir du 6 : la règle ne touche presque pas le niveau 1, et
  fait monter les autres. Les règles le disent, l'aperçu et la carte levée
  le promettent.
- **Ce qui n'a rien fait** : des crans de plus à l'épique — face aux
  expertes, frapper ne sert pas, c'est trouver qui compte —, deux réponses
  effacées par une épique (le joueur les garde pour l'élite et le gardien,
  il en a rarement une à la question qu'il ne sait pas), une épique en plus
  de la carte de la question (il joue dix-sept cartes en quarante questions :
  ce n'est pas la règle qui le borne), plus d'épiques dans les offres (il
  laisse celles qui ne valent rien), les fioles plus tard. Retirés : le plus
  simple qui tient.
- **Le joueur simulé, remis à jour** : il prend les cartes dans l'ordre de
  leur mesure seule sous ces règles (`PREFERENCE_DU_DETAIL`) — l'Encyclopédie,
  Représailles, Génie et Rafle, mortes avant la parade, y entrent.
- **Où l'on en est** : le niveau 1 et le niveau 6 sont dans la cible ; le
  niveau 3 au-dessus (le fort à 50 au lieu de 45, le moyen à 17 au lieu de
  10-12) ; le fort du niveau 10 en dessous (59 au lieu de 65-70), le moyen à
  la marge basse (24). Passé le niveau 3, une carte de plus aide moins : une
  carte par question, et le joueur en a déjà une qui sert. Sans prendre une
  carte (`--seule rien`), au niveau 10 : 1 · 5 · 26 — jouer double la
  chance du fort, quintuple celle du moyen.
- **La carrière** (cinquante joueurs, vingt expéditions) : le moyen au bout
  16 fois sur cent à ses trois premières, 21 de la 4ᵉ à la 10ᵉ, 26 de la
  11ᵉ à la 20ᵉ (42, 60 et 60 en version 14) ; le fort 31, 48 et 59 ; le
  faible 1, 2 et 5. Le moyen passe le niveau 10 à sa quinzième expédition
  (treizième). Les exploits : le gardien de l'acte 3 intact, 64 moyens sur
  cent en vingt expéditions (86), 82 forts (100).
- **L'Ascension** (au codex entier, trois cents expéditions, le faible, le
  moyen et le fort) : 4 · 22 · 60 sans cran, puis 1 · 16 · 52, 1 · 10 · 36,
  1 · 7 · 36, 0 · 5 · 25 et 1 · 3 · 21 au cran 5 — chaque cran retire
  encore, le campement et la source à moitié du cran 3 ne retirent rien au
  fort, qui en a déjà moitié moins.

## 3. L'Élan : une aide qui revient

- **Foulée** (commune) efface une mauvaise réponse et revient si juste —
  deux, améliorée ; elle ne frappe plus. **Le Rythme** (rare) en efface deux.
  **Vent arrière** (épique), posé, efface une réponse à chaque question —
  dès celle où il se pose — tant qu'il a juste, retombe à la première erreur
  (`retombentALErreur`), et la carte jouée revient ; il ne frappe plus.
- Chaque carte seule (`--cartes --version 15 --cas 3`, deux cent cinquante
  expéditions au niveau 10, le moyen et le fort, contre ne rien prendre —
  3 et 24) : Foulée +2 · +2 (+2 · +3 en version 14), le Rythme +4 · +5
  (+6 · +1), Vent arrière +3 · +4 (−1 · +2) — joué d'abord comme un pouvoir
  sur une question qu'il savait, −1 · −9 : il efface dès sa question, il se
  joue sur celle qu'on ne sait pas. Inarrêtable +2 · 0, Échauffement
  +1 · −7 et Accélération +1 · +1, intouchés : la parade de l'épique fait
  d'Inarrêtable un doublon, et frapper vaut peu.
- Les styles (`--styles`, quatre cents expéditions, le faible, le moyen et
  le fort ; le joueur suit son style à la lettre) : au niveau 3, sans style
  4 · 18 · 52, l'Élan 2 · 13 · 41, le Devin 1 · 11 · 39, l'Érudit
  1 · 10 · 39, le Métamorphe 2 · 12 · 36, le Flambeur 2 · 11 · 35 ; au
  niveau 10, sans style 4 · 23 · 60, le Rempart 7 · 27 · 62, l'Érudit
  3 · 14 · 50, le Devin 3 · 14 · 47, le Métamorphe 2 · 14 · 45, le Flambeur
  1 · 17 · 41, l'Élan 3 · 12 · 37. Suivi à la lettre, un style laisse les
  meilleures cartes des autres familles : seul le Rempart, qui répond
  encore, fait mieux que sans style.

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
- La cible revue n'est pas atteinte partout : le niveau 3 un peu trop facile,
  le fort du niveau 10 six à onze points sous elle (plus haut, « Où l'on en
  est »).

## Ce qui reste à trancher

- **Cinq rares et épiques ne valent pas encore clairement plus qu'une
  commune**, seules au niveau 10 (le moyen et le fort contre ne rien
  prendre ; la meilleure commune, La lettre, +5 · +5) : Banco 0 · −5, Sursis
  +2 · −4, Accélération +1 · +1, Inarrêtable +2 · 0, Métamorphose +2 · +1.
  Sursis et Inarrêtable pardonnent une erreur, ce que la parade de leur
  rareté fait déjà : à retoucher, chacune mesurée seule.
- **Le fort du niveau 10** : remonter de six à onze points sans toucher au
  niveau 3 demande ce que seuls les derniers niveaux ouvrent — retoucher
  leurs cartes (au-dessus), ou une règle du codex au niveau 7 ou plus.

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
