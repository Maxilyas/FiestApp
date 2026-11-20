# Le podium aéré — de petits objets aux coins, l'avatar qui flotte

Le 20 novembre 2026, au lendemain du podium peint
(`retours/2026-11-19/podium-peint/`).

## La demande

> J'aime bien le fait qu'il y ait des choses poser sur le podium mais là je
> trouve que ça fait trop chargé et ça ne fait pas respirer l'avatar. Du coup
> visuellement c'est brouillon. Tu aurais une idée pour allégée et aéré cela ?

Sur le classement du jour d'un joueur : de grands objets peints sur chaque
coin de chaque marche, l'avatar debout entre eux, à leur hauteur — sa
couronne de ligue et les étincelles de sa finition s'y mêlaient. Quatre
pistes (`maquette/1-quatre-pistes.jpg`) : la marche nue, de petits objets
bas aux coins, l'avatar plus grand, les deux ensemble. Puis :

> Avant de faire cela (celle que tu recommandes) est ce que l'avatar ne
> pourrait pas être plus haut ? Déplus peux tu tester avec des avatars
> complexe. Regarde sur la prod notamment

Les trois premiers du classement de la production portaient ce jour-là (lu en
lecture seule, sans un prénom) un Phénix éclaté en obsidienne, finition
Constellation et bordure de diamant ; Anubis, Aurore, bordure d'or ; le panda
des cerisiers, Prisme, bordure de bronze, éclaté. Trois hauteurs avec eux
(`maquette/2-trois-hauteurs-avec-des-avatars-charges.jpg`, des prénoms
inventés) : posé sur la marche, un peu plus haut, flottant avec son ombre.

> Je préfère F pour que ça soit plus aérien, c'est bien que l'avatar flotte GO

## Le code

- **Un petit objet bas par coin** : le croquis de la marche n'a plus qu'une
  case basse à chaque coin du dessus (`le-code/croquis.png`,
  `server/scripts/anime/gabarit-marche.ts`, `decor` : 21 % de la largeur sur
  16 % de haut), la croix du milieu reste vide, et la consigne le dit
  (`server/scripts/anime/decors.ts`, `consigneDUneMarche`) — un seul petit
  objet par coin, pas plus haut que sa case, rien qui pende sur les côtés ;
  la richesse d'un thème rare passe sur la face et le médaillon (`FINITIONS`).
  Les trente-sept marches repeintes (`le-code/0-les-37-marches-et-leur-gabarit.jpg` :
  la face et le cercle du gabarit tracés par-dessus).
- **Repeintes en trois passes** : 22 sur 37 justes du premier coup
  (`le-code/5-premier-passage.jpg`) — les petits objets libéraient le
  modèle, qui peignait des boîtes à pied visible, des dessus en perspective,
  des médaillons bas, et une fois le mot « GOMME » sur la gomme du Cahier.
  Un paragraphe de plus, « la géométrie d'abord, quel que soit le thème »,
  en a rattrapé huit sur quinze ; les sept dernières ont eu leur sujet
  réécrit, chacune pour ce qu'elle faisait mal (le kiosque de la Guinguette
  et sa guirlande de fanions repoussaient le médaillon, le gazon du Stade se
  peignait en terrain vu d'en haut, la page des Heures se tenait debout au
  milieu du dessus…). 59 images, 8,48 $ ; la maquette 0,86 $.
- **L'avatar flotte** (`client/src/styles.css`, `.pdc-avatar`) : 14 % de la
  largeur de sa marche au-dessus d'elle, son ombre posée sur le dessus, un
  cran plus grand qu'avant (2,45 rem, 3,05 pour le premier), et au moins
  aussi haut que les objets des coins, même sur une tablette.
- **De l'air au-dessus de lui, mesuré au pixel** : `server/scripts/rendu-podium.ts`
  habille les trois premiers comme ceux de la production, photographie
  l'avatar seul sur un fond transparent et cherche la première rangée qu'il
  peint. Mesurées en boîtes, les lumières des finitions (un voile de
  l'Aurore, une orbite de la Constellation) touchaient toutes leur score
  de 10 à 13 points, quand l'œil y voyait de l'air ; au pixel, il en
  restait 1 à 5 — les rayons du Prisme à 1. La case a pris 6 points de plus
  au-dessus de lui (20, et 22 pour le premier) : 7 à 10 points d'air au
  téléphone, 30 sur une tablette, et le script sort en erreur sous 5
  (`le-code/1-planche-des-podiums.jpg`, `le-code/2-l-ecran.jpg`,
  `le-code/3-tablette.jpg`).
- La planche des médaillons, à regarder avant de livrer
  (`le-code/4-les-medaillons.jpg`).

Les originaux en 1K, les repeints mis de côté compris, restent dans
`export/decors/originaux/`, hors du dépôt, sur la machine qui les a peints.
