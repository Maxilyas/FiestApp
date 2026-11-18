# Les plaques de nom, deuxième version : le paraphe, la vitrine du podium (18 novembre 2026)

> « J'aimerais que les plaques des thèmes soient super jolies et n'encombrent
> pas trop la vue dans le classement. Donne-moi des pistes pour faire ça ? »
> — le propriétaire, le 18 novembre 2026. Puis, après trois tours de pistes :
> « Une combinaison qui me plaît : le paraphe pour tous, la vitrine pour le
> podium, et la grande plaque dans les duels. »

## Ce que montrait la production

Lu le 18 novembre 2026 sur une copie de la base, par le jeton en lecture
seule (`PROD_LECTURE_TOKEN`) : la copie, ses abonnements aux notifications
retirés, a servi un serveur local, et ses pages ont été photographiées au
téléphone. Des totaux, sans un nom :

- **12 profils sur 42 montrent une plaque**, mais ce sont les plus assidus :
  les dix premiers du classement du mois en avaient tous une. Dix lignes
  entières de dix couleurs — Braises, Halloween, Ciel, Olympe, Licorne,
  Disco, Kintsugi… — faisaient une mosaïque : le regard sautait d'une ligne
  à l'autre, chaque score avait sa couleur, et les huit familles de motifs
  (points, grilles, hachures) de la maquette du 10 novembre se lisaient
  comme des esquisses — la fêlure du Kintsugi, deux traits en « A ».
- **13 profils portent un avatar dessiné** (9 légendaires, 3 portraits, un
  compagnon), presque tous dans leur bordure de ligue : un médaillon de
  40 px, son halo et ses étincelles. Les scores du mois ont cinq chiffres.

## Les pistes, dans l'ordre où elles ont été montrées

1. **Trois traitements** (`maquette/trois-pistes.html`) : A, le cartouche —
   la plaque porte l'avatar et le prénom, le rang et le score restent à
   tous — ; B, le liseré et l'emblème ; C, la plaque gravée. Le propriétaire
   a aimé A, et demandé « plus joli ».
2. **Le cartouche, plus loin** (`maquette/le-cartouche-plus-loin.html`) : la
   matière de chaque thème (laque, kraft, néon, glaçage…), le décor sur les
   bords, le prénom dans la police du thème. Puis, sur la copie de la
   production : l'avatar dans le cartouche coupait les prénoms (« Ro… »)
   et cachait le halo des médaillons ; dehors, chaque ligne grandissait ; le
   médaillon épinglé au bout de la plaque tenait.
3. **Six directions vraiment différentes** (« sois créatif »), posées sur le
   vrai classement du mois avec la vraie plaque de chacun : le fanion, le
   billet, **le paraphe**, le sceau de cire, le projecteur, **la vitrine du
   podium** ; et, hors de la liste, **la grande plaque des duels**, le
   vainqueur d'hier à l'accueil, la plaque sur la carte du joueur.

## Ce qui a été décidé

- **Le paraphe, pour tous** : la ligne reste celle de tous ; un trait de
  plume aux couleurs de la plaque souligne le prénom, et son emblème le suit.
- **La vitrine, au podium** : la plaque entière, plus haute, son relief, son
  emblème en grand — au rang 3 au plus, ex æquo compris
  (`PLACES_EN_VITRINE`). Achetée, elle ne se montre en grand qu'en montant :
  elle se gagne aussi en jouant.
- **La grande plaque dans les duels** : à maquetter sur les vrais duels avant
  de la coder.

## Ce qui en est fait

- **Un emblème par thème**, trente-quatre dessins en deux tons
  (`server/scripts/emblemes-des-plaques.ts`) : le clair de la plaque cerné de
  son sombre, chacun poussé jusqu'à 3:1 sur le fond de chaque thème — le
  paraphe et l'emblème se posent sur le fond de celui qui regarde, n'importe
  lequel des trente-cinq — et sur sa propre plaque. Cinq dessins refaits
  après leur planche : la guirlande se lisait comme une moustache, les
  fanions comme une couronne, puis comme des crocs (le serpentin les a
  remplacés).
- **Le prénom ne s'étire plus jusqu'au score** sur une ligne à plaque : le
  trait n'a que sa longueur. L'emblème cède avant le prénom et rapetisse
  entier : sur la copie de la production, un légendaire bordé, un laurier et
  un score à cinq chiffres le réduisaient à 8 px en 360 de large.
- **La loge et la boutique montrent la vitrine** (`LigneDePlaque`) : la forme
  la plus entière, celle qu'on achète.

## Ce qui reste

- La grande plaque des duels, à maquetter.
- La police du thème sur le prénom, et une richesse de la plaque selon la
  rareté du thème : proposées, pas encore décidées.
- Ce que les emblèmes font au téléphone Android de la friture (un Redmi,
  règle `css.md`) ne se lit que sur lui : des images, pas des tracés, ils ne
  devraient pas y passer en multi-échantillonnage.
