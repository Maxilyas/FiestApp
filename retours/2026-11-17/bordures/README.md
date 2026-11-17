# Les bordures de ligue : trois pistes

Le 17 novembre 2026. Le propriétaire : « J'aimerais que tu regardes les
bordures que l'on gagne via les duels. Je trouve parfois que ce n'est pas très
joli avec l'avatar. Peux-tu me faire des propositions pour avoir quelque chose
de vraiment joli ? Tu peux regarder sur la prod. »

**Le choix**, le même jour, devant la planche : « Mets en place tes
recommandations » — la parure, au métal de la ligue. Elle est dans
`client/src/components/dessinDesBordures.ts` depuis le commit suivant ; trois
bordures ont changé de nom avec leur dessin (le Rameau, l'Olivier, les
Feuilles d'or).

Ce dossier reste la maquette telle qu'elle a été montrée. `planche.ts` lisait
le dessin de l'application pour sa colonne « Aujourd'hui » et sa piste 1
(`svgDuCadre(ligue, crans, finition)`, `svgDesRayons`) : il ne se rejoue plus
qu'au commit de la planche (`67d72d9`).

## Ce que la production montre

Relevé le jour même, en lecture seule (`PROD_LECTURE_URL`, rien que des
SELECT), sans un nom ni un identifiant — la tenue seule, redessinée ici par
les vrais composants (`planche-constat.jpg`).

- 21 profils ont fini un duel classé, **19 portent une bordure** : bronze 9,
  or 3, platine 3, diamant 2, argent 1, maîtres 1.
- **14 sur 19 ne sont pas serties** (de 0 à 11 crans).
- **13 entourent un avatar peint** — 9 légendaires, 3 portraits, 1 compagnon —,
  6 un emoji.
- Les finitions : Aurore 5, Or 4, Prisme 3, Holo 3, Constellation 2,
  Abysses 1, Argent 1 (lues du niveau à peu près : un niveau gardé d'une
  courbe d'avant n'est pas relu ici).

Ce qui cloche, à l'œil :

1. **L'état qu'on voit le plus est le moins beau.** Une bordure pas encore
   sertie est un coin de métal, de travers, sur une roue en pointillé — on
   dirait un chargement, ou une pièce cassée.
2. **Le bandeau est large et chargé** — dents, stries, perles, puis les
   ornements : il fait 40 % du diamètre, dispute l'œil à la peinture qu'il
   entoure, et, dans une ligne de classement, fait un halo brouillé.
3. **Le métal vient de la finition.** En Holo, Prisme ou Aurore — onze tenues
   sur dix-neuf —, c'est un arc-en-ciel pastel autour d'une peinture ; et la
   ligue ne se lit plus : un bronze porté en Or est doré.

## Ce que les trois pistes ont en commun

- **Le cadre est toujours entier** : un cran à gagner n'est plus un pointillé.
- **Les crans se sertissent du bas vers le haut, des deux côtés à la fois** :
  à chaque victoire la bordure reste symétrique. Le compte ne change pas —
  douze crans, la même règle (`releverLesDuels`) —, seul l'ordre où ils se
  dessinent.
- **Le métal de la ligue** : le bronze est de bronze. La finition garde ce
  qui est à elle — le cercle du médaillon, son halo, sa lumière. (La question
  se tranche à part : `planche-metal.jpg` montre les deux.)

## Les pistes

`planche-face.jpg` les met côte à côte sur neuf tenues de la production ;
chaque piste a sa photo — ses six ligues, chaque victoire, les dix-neuf
tenues, une ligne de classement à sa taille et à la loupe.

1. **Les alliages, apaisés** (`planche-apaise.jpg`). Les six dessins validés
   le 12 octobre, intacts. Un cran à gagner est le même métal, patiné. Le
   moins de changement : ni nom, ni taille. Le bandeau reste large, et la
   patine est trop sombre sur l'Ivoire (à éclaircir si c'est elle).
2. **Le jonc serti** (`planche-jonc.jpg`). Un anneau de métal deux fois plus
   fin et douze chatons : chaque victoire y sertit la pierre de la ligue —
   rivet, perle, rubis, cristal, brillant, étoile d'or. La matière du jonc dit
   la ligue (moleté, perlé, gravé, givré, taillé, émaillé), et son insigne en
   bas : l'écu riveté, la perle en pendant, la fleur de lys, le cristal, le
   brillant, le Soleil noir. Les noms d'aujourd'hui lui vont encore.
3. **La parure** (`planche-parure.jpg`). Un fil de métal, l'insigne en bas,
   et un brin de deux feuilles par victoire : la couronne pousse des deux
   côtés — laurier de bronze, olivier d'argent, feuille d'or et ses rubis,
   cristaux de givre, marquises de diamant, flammes du Soleil noir. Un cran à
   gagner est un bourgeon sur le fil. C'est celle où chaque victoire se voit
   le plus. Trois noms seraient à revoir (le Moletage, le Perlé, les Fleurons
   ne décrivent plus rien), et « Le Laurier » est déjà pris par le quiz du
   jour.

En Ivoire : `planche-ivoire-face.jpg`, `-jonc.jpg`, `-parure.jpg`.

## Ce que j'en pense

La parure, au métal de la ligue. C'est la seule où deux victoires font déjà
quelque chose de joli, où douze font une récompense, et où l'avatar garde la
première place à chaque étape. Le jonc est le repli si l'on veut le plus
sobre — c'est lui qui se tient le mieux dans une ligne de classement. La
piste 1 ne règle que le premier des trois défauts.

## Ce qu'une piste retenue toucherait

- `client/src/components/dessinDesBordures.ts` (le dessin ; `dessins.ts`, ici,
  s'y réécrit), `Bordure.tsx`, `metaux.ts` si le métal devient celui de la
  ligue — le sceau d'un légendaire garde alors celui de la finition.
- `client/src/styles.css` : `.bo` et ses marges (une bordure fine dépasse
  moins), l'étoile d'un légendaire scellé (`.av-bordure .sc`, à rapprocher du
  bord — la planche le fait), le filet du halo d'Or (`.av-or::before`, qui
  ferait un second cercle autour d'une bordure fine), le reflet qui tourne
  (`.bo-reflet`, son masque au rayon du nouveau cadre).
- `shared/duels.ts` (`NOM_DE_LA_BORDURE`, si des noms changent), la carte d'un
  joueur (`cadreDeLaCarte`, déjà aux métaux des ligues).
- `server/test/bordures.test.ts`, `server/scripts/planche-bordures.ts`, les
  règles `medaillons.md` et `duels.md`, `docs/produit/les-duels.md` et
  `le-profil.md`, le glossaire.
- Rien au barème ni à `VERSION_DU_RELEVE` : les crans se comptent comme avant.

## Ce que la maquette ne montre pas

- Ce qui bouge : le reflet de l'argent et du diamant, les rayons des maîtres.
  Tout y est figé.
- Un dessin simplifié pour les listes : c'est le même, réduit — il tient déjà
  mieux que celui d'aujourd'hui (la loupe, au bas de chaque photo).

## Refaire la planche

Au commit de la planche (`git checkout 67d72d9`) :

```bash
cd server && npx tsx ../retours/2026-11-17/bordures/planche.ts
```

`SEULEMENT=face,jonc` pour quelques sections, `SANS_IVOIRE=1` pour sauter le
thème clair, `DENSITE=2` pour des photos plus fines. Les pages (`planche.html`,
`planche-ivoire.html`, six mégaoctets chacune) sont ignorées par git.
