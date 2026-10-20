# « Mon compagnon », chez lui — la maquette (20 octobre 2026)

« J'aimerais revoir l'onglet mon compagnon, car je trouve qu'il y a trop de
texte et ce n'est pas assez visuel. De plus j'aimerais pouvoir cliquer sur
adopter et que ça me montre tous les compagnons que je peux avoir mais pas que
ça me redirige vers la boutique. […] Pareil les boutons porter avatar, caresser
je trouve qu'ils sont gros et pas jolis. J'aimerais que ce soit vraiment un
endroit où c'est stylisé, intuitif et visuel. J'aimerais aussi au-delà des
bonnes réponses et de la déco, réfléchir pour faire évoluer la niche et savoir
comment on pourrait faire comme un mini jeu de s'occuper de son compagnon. Que
ce soit fun et qu'à la fin on puisse avoir des choses supplémentaires »
(le propriétaire).

Une maquette interactive au téléphone, en deux tours. Au second, ses retours :
le compagnon ne se voyait ni dans la niche ni à la cueillette, et la lanterne
gagnée passait derrière la niche (deux bugs de la maquette) ; « Le soin :
oui » ; « J'aimerais avoir beaucoup d'objets différents que l'on peut
collectionner. Chacun de raretés différentes. Plus ou moins durs à obtenir. Les
trouvailles se voient uniquement chez lui. On pourrait même imaginer débloquer
du terrain / nombre d'objets que l'on peut poser. Pour que ça fasse un vrai
cocon douillet. Un seul jeu au début ». Puis la validation : les doubles,
oui ; des trouvailles de saison, plus tard, une fois toutes trouvées ; « Tu
peux enlever le lien vers mon avatar et tu peux commencer à implémenter ».

## La planche

Tout se regarde sur la planche Design, privée :
<https://claude.ai/artifact/CdiytGY35XWzZeY3ojvW7u> — la page chez lui, le
réveil, les envies, la cueillette et sa fin, le cadeau et le grand cadeau,
« Décorer », la galerie et deux fiches, le domaine entier, et les trente
trouvailles.

## Ce qui est dans l'application

La page (`client/src/components/MonCompagnon.tsx`, règle `profil.md`) : sa
niche en grand au milieu de son jardin, son nom sur une plaque, une seule
pastille de geste ; ses trois envies du jour (le goûter, le câlin du doigt, la
cueillette) ; son cadeau, une trouvaille tirée au serveur, le grand tous les
sept jours de complicité ; trente trouvailles en cinq raretés, doubles compris,
deux légendaires d'exploit ; son jardin qui grandit de trois à dix places ;
« Décorer » ; son chemin sur un seul fil ; la galerie des quatre, où l'on adopte
sur place. « Le porter en avatar » est parti de partout où il était — l'avatar
se choisit dans la loge.

Ce qui a changé en chemin, par rapport à la maquette :

- **Le sommeil se retient sur le téléphone** (`quizz.compagnon.reveil`) : il
  dort au premier passage du jour, sauf s'il a déjà fait quelque chose
  aujourd'hui, ici ou ailleurs. Le serveur n'en garde rien : un réveil ne se
  mérite pas.
- **La complicité est le compte de ses cadeaux ouverts**, pas des jours
  passés : un jour manqué ne retire rien, il n'avance pas non plus. Elle est à
  chaque compagnon, comme son jardin ; les trouvailles, elles, sont au profil.
- **Les légendaires ne se tirent jamais** : la fontaine aux étoiles vient à cent
  jours de complicité avec l'un d'eux, l'étoile filante apprivoisée à dix
  cueillettes à trois étoiles — relues des journaux, comme un haut fait.
- **La cueillette se joue au téléphone et s'écrit à la fin** : le serveur borne
  le score (deux cents au plus) et l'écart entre deux parties (vingt-cinq
  secondes). Il n'y a rien à gagner à tricher : ni confettis, ni expérience,
  ni avantage — un record et, à la longue, l'étoile filante.
- **Sans nom, il est « ton loup »** dans les phrases (« Ton loup a un cadeau
  pour toi ») : « Loup a un cadeau » se lisait comme un prénom.
- **La plaque est plus étroite** que sur la maquette, et le « + » d'une place
  au sol se pose au-dessus d'elle : une plaque longue (« Lui donner un nom »)
  couvrait la gamelle et la place libre d'à côté.

## Le soir : la fiche de la niche, plus douce

« Maintenant quand on clique sur la niche en haut à droite, on pourrait avoir
un truc plus soft avec les actions pour le caresser et rediriger vers
l'onglet compagnon ? […] je rendrais ce truc plus simple, c'est à dire
uniquement pouvoir interagir avec lui ? Et de savoir où il en est
bien-sûr » (le propriétaire).

La feuille « Ma niche », qui montait du bas avec toute sa gestion — son nom,
ses formes, ses ornements, ses compagnons —, devient une bulle qui sort de la
niche (`FicheDeLaNiche`) : lui en grand, qu'on caresse — ses tours compris —,
son nom et sa forme, où il en est vers sa forme suivante ou son prochain
ornement, ses envies du jour (« Un cadeau t'attend chez lui ! »), et deux
pastilles, « Le caresser » et « Chez lui », d'or quand son cadeau l'y attend.
Tout ce qui se règle vit sur sa page. Caressé dans la bulle, il ne dort plus
volets fermés chez lui l'instant d'après.

## Pour plus tard

- Des trouvailles de saison, une fois les trente trouvées (le propriétaire).
- D'autres jeux que la cueillette (« un seul jeu au début, on verra par la
  suite »).
- Les trente trouvailles sont dessinées d'après la maquette
  (`client/src/components/Trouvaille.tsx`) ; peintes un jour, comme les
  ornements de la niche, elles prendront leur place.
