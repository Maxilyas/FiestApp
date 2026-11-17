# Le Filet en deux étapes : l'époque pour de bon, puis la valeur dans la bonne — le 17 novembre 2026

Le retour que le propriétaire rapportait, cinq jours après le Filet en deux écrans
(`../2026-11-12/le-filet-en-deux-ecrans.md`) et quatre après les années de l'acte I
(`../2026-11-13/annees-de-l-acte-i.md`) : « J'ai toujours des retours négatifs à propos du filet.
Maintenant c'est, si tu choisis la mauvaise époque, tu as automatiquement faux. Est-ce que l'on ne
pourrait pas découper alors le jeu en deux parties, trouver la tranche de l'époque puis la date exacte
dedans ? »

## Ce que la règle faisait

Depuis le 9 novembre, le Filet se jouait en deux temps mais **d'un seul lancer** : l'époque touchée
ouvrait sa piste, le curseur y vivait, et le lancer portait l'époque et la valeur. La distance jugeait
d'abord — ★★★ à un douzième d'époque, ★★ à un quart —, sinon ★ pour la bonne époque. Dans une
mauvaise époque, la réponse n'est pas sur la piste : zéro étoile, un cœur de moins, sauf à tomber du
bon côté d'une borne. Les décalages du 12 et du 13 novembre ont rendu les questions plus faciles ; ce
mécanisme, lui, n'avait pas bougé.

## Ce qui a été fait

1. **Deux étapes, chacune jugée à part** (`shared/cabinet/jeux/filetEnDeuxTemps.ts`). L'époque
   d'abord : une ligne touchée est jouée pour de bon, comme une réponse du Quiz ou le mot de la
   Réplique, et la bonne vaut une étoile. Puis la valeur : l'écran dit la bonne époque à tous, ouvre
   sa piste, et la valeur visée dans le grand anneau ajoute une étoile, dans le petit deux
   (`ETOILES_DES_ETAPES_DU_FILET`). Une étoile par chose réussie :

   | | La valeur loin | Tout près (un quart d'époque) | Pile dedans (un douzième) |
   |---|---|---|---|
   | La bonne époque | ★ | ★★ | ★★★ |
   | La mauvaise, ou le temps l'a prise | rien | ★ | ★★ |

   Qui sait l'époque gagne ce qu'il gagnait. Qui la rate garde jusqu'à deux étoiles, et son cœur dès
   la première.
2. **Un chrono par étape**, soixante secondes chacune : le temps mis à choisir l'époque, et à lire
   son verdict, n'est pas pris à celui de viser. L'échéance de la première ne coûte que l'époque — la
   valeur s'ouvre quand même, sur la bonne ; à celle de la seconde, l'époque trouvée compte encore.
3. **Les aides ne changent pas** : « Deux époques de moins » et « Un indice », au pied de l'écran des
   époques, une étoile chacune de ce que la manche valait, jamais un cœur ; la carte qui éclaire en
   offre une. Elles mènent à l'époque : jouée, elles ne se prennent plus, et l'indice ne se redit pas.
4. **L'écran de la valeur ouvre sur le verdict de l'époque** (`FiletEnDeuxTemps.tsx`,
   `EpoqueJouee`) : « La bonne époque : 1400 – 1499. Une étoile de gagnée. », ou « C'était
   1975 – 1999. Il reste deux étoiles à prendre. » — à la place de « changer d'époque », qui n'a plus
   lieu d'être. Chaque anneau dit ce que la manche vaudra, l'étoile de l'époque et les aides payées
   comprises. Le focus va au curseur, que le verdict décrit à l'oreille.
5. **Une manche tirée avant garde sa règle**, ses écrans et sa révélation : le tirage dit lui-même
   comment il se joue (`parEtape`), sans version du départ. La bonne époque ne part au téléphone
   qu'une fois la sienne jouée (invariant 1), et aucun refus ne la trahit avant.

Le moule des jeux portait déjà deux étapes — le Pari, la Réplique — : le pli n'a pas changé.

## Ce que les écrans portent

`reproductions/rendu-du-filet.ts`, en 360 × 640, trois manches jouées au doigt sur un serveur
jetable — la bonne époque, une mauvaise après « Deux époques de moins », une mauvaise sans aide :

| L'écran | Hauteur | Cibles | Mots |
|---|---|---|---|
| Les époques | 1 écran | 6 à 7 | 50 à 76 |
| La valeur, son verdict en tête | 1 écran | 7 | 49 à 62 |

- Sans carte en jeu, les deux écrans tiennent sans défiler sur les trois manches ; le script sort en
  erreur sinon. Le verdict de l'époque tient en deux lignes (63 px) : écrit d'abord avec l'époque
  choisie (« Pas 1775 – 1799 : c'était… »), il en prenait trois.
- Avec Coup d'œil, Échange et Quitte ou double (`chargee`), les écrans défilent encore de quelques
  dizaines de pixels, les cartes posées sous la manche — comme le 12 novembre ; « Lancer le filet »
  reste collé sous le pouce.
- La révélation n'a pas changé de taille (1,4 à 1,7 écran) : la frise dit son choix et la bonne,
  chaque coche vaut une étoile.

## Ce que le calibrage en dit

Trois mille traversées par joueur, la règle d'avant rejouée sur les mêmes joueurs et les mêmes
questions (`calibrage-cabinet.ts --sections traversee --traversees 3000 --filet un-lancer`, puis sans
`--filet` ; `--aides jamais` pour les colonnes sans aide). Le joueur modèle qui ne sait pas l'époque
en joue une au hasard, puis laisse le curseur au milieu de la bonne : une borne basse.

| Traversées gagnées | Un seul lancer, sans aide payée | Deux étapes, sans aide payée | Un seul lancer, l'aide quand il ne sait pas | Deux étapes, l'aide quand il ne sait pas |
|---|---|---|---|---|
| L'occasionnel | 11,5 % | 12,3 % | 12,3 % | 11,6 % |
| Le moyen | 42,7 % | 45,9 % | 44,8 % | 44,3 % |
| Le fort | 93,4 % | 93,8 % | 93,6 % | 93,7 % |
| Au hasard | 0 % | 0 % | 0 % | 0 % |

| Manches du Filet qui gardent leur cœur, acte I · II · III, sans aide payée | Un seul lancer | Deux étapes |
|---|---|---|
| L'occasionnel | 86 · 80 · 65 % | 91 · 88 · 80 % |
| Le moyen | 91 · 86 · 70 % | 95 · 92 · 84 % |
| Le fort | 96 · 93 · 84 % | 98 · 96 · 91 % |
| Au hasard | 33 · 37 · 47 % | 61 · 66 · 59 % |

- **Les manches à zéro étoile du moyen à l'acte III passent de 30 à 16 sur cent**, celles de
  l'occasionnel de 35 à 20. Trois traversées de plus sur cent pour le moyen, une pour l'occasionnel.
- Avec l'aide payée, rien ne bouge à la mesure près : elle donnait déjà l'époque, donc le cœur.
- Les bornes du calibrage tiennent (`cabinet-calibrage*.test.ts`) ; les points de vie des gardiens
  n'ont pas bougé.

## Ce que la découpe coûte, et ce qui reste ouvert

- **Le Filet se joue de nouveau un peu au hasard.** Deux chances d'une étoile au lieu d'une — l'époque
  une fois sur quatre, puis le milieu de la bonne époque, dans le grand anneau une fois sur deux — :
  sans rien savoir ni payer d'aide, six manches sur dix gardent leur cœur au lieu de quatre, et une
  partie libre vaut une commune 9 fois sur cent au lieu de 2. Le joueur au hasard ne gagne toujours
  aucune traversée. Resserrer le grand anneau d'un quart à un sixième d'époque n'y change presque
  rien (55 à 62 manches sur cent au lieu de 59 à 66, `--essai ANNEAUX_DES_EPOQUES=trois:12/deux:6`).
  Ce qui y répondrait — un grand anneau qui ne vaudrait son étoile qu'à qui a trouvé l'époque, par
  exemple — est une décision du propriétaire, que ce travail n'a pas prise.
- **Une aide payée rapporte moins qu'avant** : elle mène à l'époque, dont elle reprend l'étoile. Elle
  assure le cœur ; elle ne fait plus gagner d'étoile à qui visait ensuite. Les aides n'avaient servi
  qu'à quatre manches sur vingt et une en production.
- **Soixante secondes pour viser**, c'est large : le même chrono à chaque étape, comme à la Réplique,
  sans constante de plus. À resserrer si les traversées s'allongent.
- **Une époque touchée par erreur ne se reprend plus** : c'est le prix d'une étape jugée. Elle coûte
  une étoile, plus la manche.
- **Rien de tout cela n'a été joué par une tablée ni par de vrais joueurs.**
  `../2026-11-12/reproductions/le-filet-en-production.ts manches` dira, après une semaine, ce que
  font les joueurs du second écran : laissent-ils le curseur au milieu ?

## Les reproductions

- `reproductions/rendu-du-filet.ts` — les deux étapes photographiées et mesurées au doigt, sur un
  serveur jetable (`simple`, `chargee` ; `ECRAN=390x844`).
