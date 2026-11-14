# Le classement du jour en friture sur un téléphone Android

Quatre retours du même téléphone, du 9 au 14 novembre 2026. Ce relevé dit ce
qu'on a su à chaque fois, ce qui était faux, et ce qui a fait changer d'avis.

## Ce que le téléphone montre

Au classement du quiz du jour (`/jour#classement`, et le jour joué), une
partie de la page est remplacée par du bruit : des lignes de pixels, et, le
13, le compagnon de sa niche recopié deux fois côte à côte. Les médaillons —
et, depuis les plaques de nom, leurs motifs — restent dessinés par-dessus.
Les prénoms, les rangs, les points, les fonds des lignes ont disparu.

## Les trois corrections à côté

| Jour | Ce qu'on a cru | Ce qu'on a fait | Ce que le téléphone a répondu |
|---|---|---|---|
| le 9 | trop de calques dans la liste, la mémoire des tuiles | les lignes et les légendaires rendent leur calque | pareil le lendemain |
| le 10 | le décor du Ciel, cinq plein-écrans pendant son fondu | le décor dans une seule couche (52 → 31 Mo) | pareil le 13, sous la Guinguette : une page de 10 Mo |
| le 13 | les fusions des médaillons (`mix-blend-mode`) | retirées des listes | pareil le 14 — retiré depuis |

Les deux premières restent : elles tiennent pour ce qu'elles mesurent.
Aucune des trois hypothèses ne se rejouait ici ; chacune s'est décidée sur
une ressemblance. Ce qui a manqué : lire les captures tuile par tuile, et
demander plus tôt ce que le téléphone dit de sa carte graphique.

## Ce que le téléphone dit de lui (`chrome://gpu`, le 14)

- Un Redmi (`2409BRN2CY`), Android 16, Chrome 157.
- `ANGLE (ARM, Mali-G52 MC2, OpenGL ES 3.2 v1.r49p1-03bet0…)` : un pilote
  marqué « bet0 ».
- Skia en `GaneshGL`, rastérisation graphique, quatre échantillons au plus,
  `GL_EXT_multisampled_render_to_texture` : le multi-échantillonnage s'y fait
  dans la texture même de la tuile, que le pilote passe d'un mode à l'autre.
- `GL_KHR_blend_equation_advanced` désactivée par Chrome : les fusions
  avancées ne passent pas par le pilote — l'hypothèse du 13 tombait là.
- Cinq contournements de pilote Mali récents dans la liste de Chrome
  (`glBlitFramebuffer`, les niveaux de mipmap, les relectures).

## Ce que les captures disent, relues tuile par tuile

Une tuile fait la largeur de l'écran et, sur cet écran, environ 384 pixels
de haut (762 mesurés pour deux, sur la capture du 13).

- Le 10 : une tuile perdue, celle qui contient le médaillon vert aux
  Abysses, au rang 2. Les trois rangs suivants, sur la tuile d'après, sont
  intacts — dont un médaillon éclaté, à gemme.
- Le 13 : deux tuiles perdues (762 pixels), dont la frontière traverse le
  même médaillon, au rang 3. Les rangs 7 et 8, sur la tuile suivante, sont
  intacts — dont un compagnon éclaté, à gemme.
- Le 9, chaque ligne avait encore son calque : seule la sienne était perdue.

Dans une tuile perdue, ce qui reste est ce que le navigateur dessine à part
puis recolle — un médaillon, le motif d'une plaque (il a une opacité) —, et,
à ce qu'on en voit, seulement à partir de cet avatar-là dans l'ordre du
dessin : rien des deux premiers rangs, le 13. Ce qui remplit
le reste est de la mémoire jamais écrite : l'image d'une autre texture.

## L'explication retenue

L'avatar aux Abysses est le seul de ces classements dont la lumière a des
traits (les tentacules de ses méduses). Chrome trace un trait en
multi-échantillonnage (MSAA dynamique) quand le calque s'y prête ; la tuile
passe alors, en cours de dessin, d'une texture simple à une texture
multi-échantillonnée, et le pilote doit y recharger ce qui était déjà peint.
Tout indique qu'il ne le fait pas : ce qui précède est perdu, ce qui suit
est dessiné.

Ce qui est vérifié : le mode de dessin (`reproductions/passes-msaa.mts`,
la trace de Skia dans un Chromium à rastérisation graphique : des centaines
de traits tracés en MSAA au classement, 562 à 874 selon l'essai), et le
moyen d'en sortir. Ce qui ne l'est pas : la panne elle-même, qui ne se
rejoue sur aucune machine d'ici.

## La correction

Chrome renonce au MSAA pour tout calque qui contient un dessin sans
lissage. Un avatar dessiné pose donc sous lui un point sans lissage,
invisible (`SansLissage`, `client/src/components/Avatar.tsx`) : dans la
trace, plus un seul trait en MSAA, et la photo est la même à l'œil.

## Ce qu'on demande au téléphone

1. `/jour#classement`, la page de tous : la friture a-t-elle disparu ?
2. Si oui, `/jour?sans=sonde#classement` : elle doit revenir — c'est la
   preuve que le point en est la cause.
3. Si non : `?sans=lumiere`, puis `bordure`, `medaillon`, `gemme`, `motif`
   à la place de `sonde` — la pièce dont le retrait la fait disparaître est
   celle qu'il faut regarder.
