# La boutique, en grilles : le diagnostic, la maquette, la décision (10 novembre 2026)

> « Je parlais plutôt par exemple de la boutique, qu'en penses-tu ? Est-ce
> vraiment bien conçu ? J'ai l'impression que les utilisateurs ont du mal et
> ne voient pas grand-chose sur leur téléphone. Tu as carte blanche pour me
> faire une maquette d'une nouvelle boutique, aucune limitation. Tu peux tout
> refaire. » — le propriétaire, le 10 novembre 2026.

## Ce qui n'allait pas

La boutique du 1er novembre 2026 (« la Galerie » : « À la une », une étagère
par rareté, le panier d'essai), mesurée au téléphone sur un serveur jetable,
une habituée (1400 confettis) et un nouveau venu (80) :

| | 360 × 640 | 390 × 844 |
|---|---|---|
| Hauteur de la page | 3587 px — **6,2 écrans** | 3579 px — 4,6 écrans |
| Articles entiers à l'arrivée | **1** | 3 |
| Le rayon des thèmes | 1482 px, 2,6 écrans | 1482 px |
| Les compagnons | une étagère, **1 sur 5** visible | 2 sur 5 |
| Les fonds | 620 px, 1,1 écran | 661 px |
| Le comptoir | 593 px, un écran pour trois objets | 543 px |

- **L'écran d'arrivée ne montrait rien de la boutique.** « À la une », en
  tête, prenait 208 px pour une grande carte — un article que les rayons
  montrent plus bas —, puis les puces, le titre « Thèmes » et deux lignes
  d'explication : la première carte de thème commençait au bas de l'écran.
- **Cinq étagères qui glissent de côté.** Une par rareté, deux cartes de
  136 × 227 px visibles sur cinq : vingt-deux thèmes demandaient cinq gestes
  de côté, en plus de défiler. Rien ne dit qu'une rangée continue.
- **Trois façons d'acheter.** Un thème dans une feuille, puis un dialogue à
  trois boutons (« Acheter et porter », « L'acheter seulement », « Plus
  tard ») ; un fond dans la page, sous une grande carte ; un objet dans une
  autre feuille.
- **Rien pour qui n'a pas de quoi.** La plupart des visites : un confetti par
  bonne réponse, des thèmes de 150 à 1000. Les prix hors de portée se
  lisaient « encore 580 », et le bouton d'achat, éteint, n'offrait rien à
  faire.
- **Un paragraphe par rayon** expliquait ce qu'est un thème, un compagnon,
  un fond : la place de deux rangées d'articles.

## La maquette

Une page interactive, construite sur le vrai catalogue — ses thèmes, leurs
aperçus, leurs prix, les cinq compagnons, les douze fonds —, avec deux
profils de démonstration, et une planche de sept photos avant/après. Sa
source est dans `maquette/` (`boutique.html`, `donnees.js` ; ses images sont
des copies de celles de l'application, que `images.cjs` refait).

Ce qu'elle proposait :

- **Une seule page dense, sans rien qui glisse de côté** : les thèmes en
  grille, trois par rangée, du moins cher au plus cher ; les cinq compagnons
  sur une rangée ; les fonds quatre par rangée, sa carte sur chacun ; le
  comptoir en trois lignes.
- **Chaque rayon dit en une ligne** ce qu'on vient y chercher : « 22, dont 9
  à ta portée ». Un prix à l'or quand son solde le paie, en gris sinon.
- **Un seul présentoir** pour tout ce qui se vend : une feuille qui monte du
  bas, son image à gauche, ce qu'il est et son prix à droite, ses gestes au
  pied ; des flèches qui feuillettent le rayon.
- **L'achat en deux touchers, au même endroit** : « L'acheter », puis
  « Confirmer » ; ensuite « Le porter » ou « Plus tard ».
- **« Mon envie »** : l'article pour lequel on économise, suivi en tête de
  la boutique.
- **Son solde se touche** : d'où viennent les confettis.

Mesurée en 360 × 640 : 2125 px, 3,7 écrans, neuf thèmes entiers à l'arrivée ;
douze en 390 × 844.

Quatre points restaient « à trancher », chacun avec une recommandation :

1. « À la une » quitte-t-elle la boutique ? — *oui : l'accueil la garde.*
2. Trois ou quatre thèmes par rangée ? — *trois : leurs noms restent entiers.*
3. « Mon envie », qui demande un côté serveur ? — *oui.*
4. L'achat en deux touchers, à la place du dialogue ? — *oui.*

## La décision

« Implémente toutes tes recommandations, je valide la maquette » (le
propriétaire, le 10 novembre 2026). C'est fait le jour même.

- **« À la une » a quitté la boutique** (`UneDeLaBoutique.tsx` supprimé) ;
  celle de l'accueil reste, et amène ici.
- **Les rayons en grilles** (`LaBoutique.tsx`, `Boutique.tsx`,
  `RayonDesCompagnons.tsx`, `RayonDesFonds.tsx`, `Comptoir.tsx`), leurs
  règles pures dans `shared/rayons.ts`.
- **Le présentoir** (`Presentoir.tsx`), ses gestes par une règle pure
  (`gestesDuPresentoir`).
- **« Mon envie »** (`shared/envie.ts`, `PUT /api/joueur/envie`, la colonne
  `profiles.envie`) : relue à chaque affichage, jamais effacée — achetée ou
  sortie de sa saison, elle ne se montre plus.
- **« Tes confettis »**, par son solde (`FeuilleDesConfettis`).

### Ce qui s'écarte de la maquette, et pourquoi

- **Le prix n'est pas dans « Garder »**, dans la barre de l'essai : il est
  au-dessus du nom (« À l'essai · 🎊 1000 »). « Garder · 🎊 1000 » ne
  laissait au nom du Chat des lanternes que cinquante pixels en 360 de large
  sous une police large — cinq lignes.
- **Les deux gestes du présentoir ne sont pas de même largeur** : deux parts
  pour le premier, trois pour le geste attendu. À parts égales, « Confirmer ·
  🎊 1000 » se coupait sous le Carnet de voyage. Les parts ne changent pas
  d'une étape à l'autre : « Confirmer » tombe bien sous « L'acheter ».
- **« L'essayer » et « J'en ai envie » gardent leur nom** quand ils sont
  pressés — une coche devant, `aria-pressed` pour le lecteur d'écran — au
  lieu de devenir « Retirer l'essai » et « C'est ton envie » : la règle des
  interrupteurs de l'application.
- **Un objet garde sa quantité** (deux vies d'un coup, la place qui reste
  pour le sablier), et **un compagnon ses formes à toucher**, son saut au
  toucher, et, adopté, sa jauge et ses liens : la maquette les montrait
  figés.
- **Le savoir d'un fond s'écrit en entier** sous sa tuile (« Culture
  générale », pas « Culture G. »), sur deux lignes s'il le faut.
- **Une tuile de saison le dit** (« de saison ») : une saison ne dure que
  quelques jours.
- **Quatre thèmes par rangée dès 520 px de large**, six fonds : une
  tablette, un téléphone couché.
- **L'image d'une tuile fait 64 px**, pas 66, et la page remonte de 12 px
  sous sa tête : avec la niche d'un compagnon au coin, la troisième rangée
  de thèmes passait de 14 px sous le menu en 360 × 640.
- **Ses classes s'appellent `article-…`** : `profil-atlas.test.ts` refuse
  toute règle `.tuile-`, le nom des tuiles du profil d'avant.

### Ce que ça donne

Mesuré par `server/scripts/rendu-boutique.ts` (le client construit d'abord,
depuis `server/` : `npx tsx scripts/rendu-boutique.ts ../export/boutique`),
qui sort en erreur si ce qui tient ne tient plus :

| | 360 × 640 | 390 × 664 | 360 × 740 | 412 × 800 | 390 × 844 | 412 × 915 |
|---|---|---|---|---|---|---|
| Une habituée — la page | 2102 px, 3,7 écrans | 2122, 3,5 | 2102, 3,1 | 2144, 2,9 | 2122, 2,7 | 2144, 2,5 |
| — thèmes entiers à l'arrivée | **9** | 9 | 9 | 12 | 12 | 15 |
| Un nouveau venu, son envie en tête — la page | 2282 px, 4,0 écrans | 2302, 3,8 | 2282, 3,4 | 2324, 3,2 | 2302, 3,0 | 2324, 2,7 |
| — thèmes entiers à l'arrivée | 6 | 6 | 9 | 9 | 12 | 12 |

Les présentoirs tiennent sans défiler en 360 × 640 : un thème 400 px, un
fond 380, deux vies 516, un compagnon 530 — le plus haut.

### Ce qui reste

- **La bulle « Touche-moi ! » de la niche couvre le solde** les trois
  premières visites (d'avant : elle couvrait déjà la puce du solde).
- **Sous une police large** (le Carnet de voyage, la Game Boy), un mot de
  plus de dix lettres se coupe en deux sur une tuile ; au texte agrandi à
  130 %, « Guinguette » aussi. Le nom reste entier, c'est voulu.
- **Sous l'encoche d'un iPhone**, rien n'est mesuré : Chromium sans écran
  n'en a pas.
- **Une envie de saison jamais achetée se remontre à la saison suivante**
  (rien ne s'efface) : un choix de produit, à confirmer à l'usage.
- **`Envie` existe deux fois** : celle-ci, et l'envie du jour d'un compagnon
  (`shared/soins.ts`, `profile_envies`). Le serveur l'importe sous un autre
  nom (`EnvieDeLaBoutique`).
- **« Fermer »**, en tête de toute feuille de l'application, fait 40 px de
  haut (d'avant).
