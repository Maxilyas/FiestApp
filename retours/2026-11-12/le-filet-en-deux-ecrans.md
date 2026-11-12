# Le Filet en deux écrans, et ses actes décalés d'un cran — le 12 novembre 2026

Le retour que le propriétaire rapportait, trois jours après la mise en ligne du
Filet en deux temps (`../2026-11-09/le-nouveau-filet.md`) : « On me dit que
c'est toujours trop dur, des questions trop difficiles. Les indices n'aident
pas forcément, il faudrait des indices de choses que les gens connaissent. Et
niveau ergonomie, je cite : "Il y a énormément d'infos à l'écran, avec en plus
y a un timer qui tourne." Pourrait-on revoir le design ? »

## Ce que l'écran montrait

Photographié dans l'application en 360 × 640, trois manches d'une épreuve de
traversée :

| L'écran d'avant | Hauteur | Cibles | Mots |
|---|---|---|---|
| La manche qui s'ouvre | 1,2 à 1,3 écran | 8 à 10 | 75 à 80 |
| Une époque touchée | 1,5 à 1,7 écran | 13 à 15 | 85 à 90 |
| … et l'indice pris | 1,65 à 1,9 écran | 13 à 15 | 100 à 110 |

- « Lancer le filet » toujours sous le pli, une époque touchée ; les aides
  aussi.
- Jusqu'à quatre aides de deux sortes : « Deux époques de moins » et « Un
  indice », payées d'une étoile, puis les cartes Coup d'œil et Échange — et
  Coup d'œil offrait la même aide que « Un indice ».
- La tête — les cœurs, les manches, le chrono — prenait 152 pixels, un quart
  de l'écran.

## Ce que la production disait

Du 10 au 12 novembre, 21 manches du nouveau Filet, 5 joueurs
(`reproductions/le-filet-en-production.ts`, en lecture seule, des totaux) : un
petit nombre, une tendance plus qu'une mesure.

| | Le nouveau Filet | Les dix jeux, mêmes jours |
|---|---|---|
| Manches à zéro étoile | 57 % (12 sur 21) | 33 % |
| Étoiles par manche | 0,90 | 1,45 |

- **Avant la refonte, 58 % de manches à zéro et 0,68 étoile** (161 manches du
  2 au 9 novembre) : la moyenne a monté, pas le taux d'échec. Seul le Pari
  fait pire (64 % depuis le 2).
- **On le fuit** : pris 7 fois sur 47 quand la carte le propose, et 45 de ses
  63 parties depuis le 2 novembre sont des assauts de gardien, qui
  l'imposent.
- **Quinze manches sur vingt et une à l'acte II**, sur des questions que le
  panel donne de 25 à 49 % : dix ratées, la bonne époque une fois sur trois —
  une sur quatre au hasard. Ce qu'on y demandait : la mort de Stradivari, « Un
  chant de Noël » de Dickens, « A Love Supreme » de Coltrane, les plats du
  réveillon polonais.
- **Les aides, dans 4 manches sur 21**, quand 10 des 17 manches sans aide sont
  ratées. L'indice, deux fois, pour zéro étoile les deux fois : « Entre la
  mort de Staline et le premier choc pétrolier », pour 1965, suivi d'un lancer
  sur 1987.
- **Quatre manches jusqu'à l'échéance**, dont les deux où l'indice a été pris ;
  le lancer part en 19 s en médiane.
- **Neuf lancers du milieu de l'époque**, le curseur jamais touché.

## Ce qui a été décidé

Le propriétaire, le même jour : « Ok décalage. Pars sur la maquette. Pas de
retrait des gardiens. Ok pour relever le chrono. » La proposition de sortir le
Filet des assauts des gardiens le temps de le corriger est donc écartée ; des
indices faits de repères datés (« c'est après la chute du mur de Berlin,
1989 ») restent à décider.

## Ce qui a été fait

1. **Les actes, décalés d'un cran** (`acteDuFilet`, `sePoseALActe`,
   `shared/cabinet/jeux/filetEnDeuxTemps.ts`). L'acte I ne pose plus que ce que
   chaque Français sait placer (152 questions) ; l'acte II, cela et ce que le
   panel donne à 50 % et plus (347) ; l'acte III, de 25 à 49 (491) ; sous 25,
   plus rien — 913 questions, la moitié du contenu.
2. **Une décision par écran** (`client/src/views/cabinet/jeux/FiletEnDeuxTemps.tsx`).
   D'abord les époques : quatre lignes, leurs bornes et le repère que chacune
   porte, les deux aides au pied collé. Une époque touchée, la valeur : la
   question en rappel, l'époque choisie et de quoi en changer, le nombre entre
   « − » et « + », la piste de toute la largeur, son repère écrit dessus,
   « Lancer le filet » collé sous le pouce.
3. **Un repère par époque** (`REPERES_DU_FILET`, de 2 à 4) : les dates que tout
   le monde connaît étaient deux épingles et deux lignes de légende ; elles
   sont sur les lignes des époques, puis sur la piste.
4. **La carte qui éclaire n'a plus son bouton au Filet** : tant qu'elle peut
   servir, l'aide qu'on touche est offerte, et la phrase des aides le dit.
5. **La tête d'une épreuve sur une rangée**, pour les dix jeux : 71 pixels au
   lieu de 152 ; contre un gardien, ses points de vie sur une rangée dessous,
   83 à 98 pixels. **Le chrono se tait** jusqu'aux dix dernières secondes, pour
   les dix jeux aussi : la barre seule, puis son chiffre.
6. **Le chrono du Filet, de 45 à 60 s** (`DUREES_DES_JEUX`).

## Ce que les écrans portent maintenant

`reproductions/rendu-du-filet.ts`, en 360 × 640, trois manches, deux passes :

| L'écran | Hauteur | Cibles | Mots |
|---|---|---|---|
| Les époques | 1 écran | 6 à 7 | 45 à 70 |
| La valeur | 1 écran | 8 | 35 à 50 |

- Sans carte en jeu, les deux écrans tiennent sans défiler sur toutes les
  manches photographiées, une année comme une grandeur ; le script sort en
  erreur sinon, ou si le repère de la piste passe deux lignes.
- Ce qui défile encore : l'écran des époques avec l'indice pris et une question
  de quatre lignes (16 pixels) ; les deux écrans quand la carte Échange est au
  pied ou posée sous la manche (5 à 7 %) ; la révélation, qui n'a pas changé
  (1,3 à 1,8 écran).
- Contre un gardien, la tête fait 83 à 98 pixels au lieu de 71 : une question
  de quatre lignes y fait défiler l'écran des époques d'une vingtaine de
  pixels. Mesuré sur la tête seule, pas sur un assaut joué.
- Ce que le rendu a trouvé en route : la rangée des manches qui repassait
  sous les cœurs dès cinq cœurs et dix pièces d'or (46 pixels) ; le repère du
  bout de la piste écrit un mot par ligne — décalé par une marge, il perdait
  sa largeur ; « 10 – 30 » sans unité pour une grandeur, et sa consigne sur
  deux lignes.

## Ce que le décalage promet, et ce qu'il ne promet pas

Les lancers du Filet d'avant, du 1er au 8 novembre, rejoués en deux temps sur
les questions que le Filet pose encore (`le-filet-en-production.ts actes`) —
une borne basse, comme le 9 novembre :

| Le classement de la question | Lancers | Manches réussies | Étoiles |
|---|---|---|---|
| Ce que chaque Français sait placer | 19 | 84 % | 1,89 |
| Le panel à 50 % et plus | 5 | 40 % | 1,20 |
| Le panel de 25 à 49 | 50 | 54 % | 0,86 |

- **Hors de ce que chaque Français sait placer, la note du panel ne trie
  presque rien.** Un acte II fait du seul panel à 50 % serait resté à une
  manche sur deux : il reprend donc tout le réservoir de l'acte I.
- **Ce qu'un acte promet**, une question tirée au hasard dans ce qu'il pose :
  84 % de manches réussies à l'acte I, 67 % à l'acte II, 53 % à l'acte III.
  Avant : 75, 55 et 54 %.
- **L'acte III ne devient pas plus facile.** Les « loteries » ôtées ne se
  réussissaient pas moins que le panel de 25 à 49 sur ces lancers.

Le calibrage de la traversée, rejoué avec ces lois, trois mille traversées par
joueur (`docs/reference/baremes.md`, « Le calibrage du Cabinet ») :

| Traversées gagnées | Sans aide payée, le 9 | Le 12 | L'indice quand il ne sait pas, le 9 | Le 12 |
|---|---|---|---|---|
| L'occasionnel | 6,4 % | 8,3 % | 7,3 % | 8,8 % |
| Le moyen | 30,9 % | 32,4 % | 32,1 % | 34,1 % |
| Le fort | 88,3 % | 87,9 % | 89,2 % | 88,4 % |

Une à deux traversées de plus sur cent pour l'occasionnel et le moyen. Les
vrais joueurs faisaient moins que ce modèle au Filet : c'est sur leurs manches
qu'il faudra relire le décalage.

## Ce qui reste ouvert

- **Les indices.** Rien n'y a changé : la moitié redisent les bornes de la
  case (« Plus de trente combats, mais moins de cent »), un sur cinq demande de
  dater deux autres faits (« Entre la guerre de Corée et le premier choc
  pétrolier »), et un indice est écrit pour mener à l'époque, jamais plus près
  — il coûte l'étoile que l'époque rapporte. Vu au rendu : « À l'époque de
  Napoléon, entre la Révolution et la Restauration », pour l'année où Napoléon
  attaque la Russie.
- **L'acte I n'a que deux catégories sur la carte**, l'Histoire et la Culture
  générale (`VALEURS_D_UN_THEME_DU_FILET`, douze valeurs distinctes) : la
  Musique en a onze, Autour de la fête dix. Un plancher à dix en ferait quatre ;
  écrire des questions que chaque Français sait placer, le chantier du cahier
  (§ 4.4), reste le vrai remède.
- **L'acte III à une manche sur deux**, et les gardiens qui imposent le jeu.
- **Rien de tout cela n'a été joué par une tablée**, et la production dira ce
  que font les joueurs : `le-filet-en-production.ts manches`, à relancer après
  une semaine.
- **Le Pari** : 64 % de manches à zéro depuis le 2 novembre, pas regardé ici.

## Les reproductions

- `reproductions/le-filet-en-production.ts` — les manches réelles du nouveau
  Filet, chaque question posée, les dix jeux côte à côte, la loi des étoiles
  de chaque acte. En lecture seule, des totaux.
- `reproductions/rendu-du-filet.ts` — les écrans photographiés et mesurés sur
  un serveur jetable.
