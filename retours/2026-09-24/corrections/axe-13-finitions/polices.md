# Le circonflexe de « û » dans les Cormorant livrés — vérifié, laissé

Constat : [salons-marc-lea §6], capture `captures/09` — les accents des deux
Cormorant livrés paraissent décalés vers la droite, le circonflexe de « û »
surtout.

## D'où viennent les deux fichiers

Aucun script ni note dans le dépôt : ils sont arrivés avec le premier commit
(`989e298`, « Affiche »). Ils sont **identiques, octet pour octet**, au
sous-ensemble « latin » que sert Google Fonts aujourd'hui (Cormorant Garamond
v21, police version 4.001) :

| Fichier livré | md5 | Adresse Google Fonts (`css2?family=Cormorant+Garamond:ital,wght@0,600;1,500`) |
|---|---|---|
| `cormorant-garamond-600.woff2` | `bf1e09fb81d7b2cf111de1018dfeb5d4` | `…/v21/co3umX5slCNuHLi8bLeY9MK7whWMhyjypVO7abI26QOD_iE9KnTOig.woff2` |
| `cormorant-garamond-500-italic.woff2` | `9b8a16c9964e7123966c123bfd4482b1` | `…/v21/co3smX5slCNuHLi8bLeY9MK7whWMhyjYrGFEsdtdc62E6zd5wDD-iNM8.woff2` |

## Ce que disent les glyphes

Mesuré avec fontTools (installé hors du dépôt), sur une chasse de 1 000
unités : le centre de l'accent moins le centre de la lettre.

| | û | â | ô | é | è | à | É |
|---|---|---|---|---|---|---|---|
| 600 livrée | −4 | −22 | +2 | +73 | −23 | −68 | +40 |
| 600 complète (TTF Google, non réduite) | −4 | −22 | +2 | +73 | −23 | −68 | +40 |
| 600 v3.303 (fontsource 4.5.0, 2021) | −4 | −22 | +1 | +72 | −24 | −68 | +42 |
| 500 italique livrée | +30 | +77 | +38 | +128 | +54 | +62 | +134 |
| 500 italique v3.303 | +31 | +75 | +38 | +128 | +53 | +60 | +135 |

- La réduction n'a rien changé : le fichier livré a les mêmes contours que la
  police complète, et « û » y est un glyphe précomposé (pas d'accent posé par
  `mark`) — le texte en NFC l'utilise tel quel.
- Deux versions de la police à cinq ans d'écart placent les accents au même
  endroit, à deux unités près : c'est le dessin de Cormorant.
- En romain, le circonflexe de « û » est **centré sur la chasse** (−4/1000) :
  c'est un chevron haut et étroit, et la queue du « u » à droite élargit la
  chasse sans élargir la panse — d'où l'impression qu'il penche à droite à
  petite taille. Les aigus penchent à droite, les graves à gauche, par dessin.
- En italique, tous les accents suivent la pente (environ +30 à +130).

`accents-centres-sur-la-chasse.jpg` : les trois polices à 160 px, un filet au
milieu de chaque chasse — Cormorant 600, Cormorant 500 italique, serif du
système.

## Pourquoi on n'y touche pas

Régénérer les deux fichiers depuis la police d'origine redonnerait les mêmes
glyphes. Corriger vraiment, ce serait redessiner les accents (un fork de la
police, sous OFL, à renommer) ou changer de police des titres : un choix de
design, pas une finition — à trancher par l'animateur de l'application, pas
d'office.
