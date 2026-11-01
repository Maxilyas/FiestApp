# Les défis des cartes — proposition pour le Cabinet de curiosités

*Le 1er novembre 2026, d'après le retour de la propriétaire : « comme c'est dur
d'équilibrer les cartes, est-ce qu'on ne pourrait pas avoir des choses à gagner
en fonction des cartes que l'on a sur nous — des défis : avoir X d'or à la fin,
battre sans parade… — des cosmétiques selon la difficulté, et même des
légendaires ».*

Rien de ce qui suit n'est construit. Cette page est à valider : les choix
ouverts sont en fin de page.

## 1. Le problème et l'idée

Dix cartes, trois à choisir : une carte un peu plus faible que les autres
n'est **jamais** prise, et on ne peut pas l'équilibrer au dixième près. Chaque
retouche du barème change d'un coup toutes les traversées.

**Le défi donne un deuxième prix à une carte, en dehors de sa puissance.**
Une carte faible devient intéressante pour ce qu'elle *permet de gagner*,
pas pour ce qu'elle fait en jeu. Le barème des cartes n'a plus besoin
d'être parfait : une carte un peu faible porte un défi plus généreux, et
le choix des trois cartes devient un vrai choix, entre puissance et défi.

Ça respecte les règles du Cabinet :

- **Pas de cinquième notion.** Le défi est écrit *au dos de la carte*, il
  fait partie de « tes cartes ». Pas d'écran ni de monnaie en plus dans la
  traversée.
- **Aucun avantage de jeu qui sorte du Cabinet** (invariant 8) : on ne gagne
  que des cosmétiques et des confettis, comme ailleurs.
- **Une dérivation du journal** (invariant 20) : la traversée est déjà un pli
  pur de ses gestes et des bilans de ses épreuves. Un défi est une fonction
  de ce pli, recalculable si la règle change.

## 2. Le principe en une phrase

> **Chaque carte porte un défi. Il ne compte que si la carte est dans ta main.**

- Les défis se lisent **au choix des trois cartes**, une ligne sous chaque
  carte (« Au dos : finir un acte avec 300 pièces »). On choisit ses cartes
  en sachant ce qu'on vise.
- Chaque défi a **trois rangs** — Bronze, Argent, Or — de plus en plus durs.
  Un rang réussi est **acquis pour toujours** (comme un palier) ; on revient
  avec la même carte pour viser le rang d'au-dessus.
- Un défi réussi **se dit à l'instant** (un sceau qui tombe sur la carte, dans
  la tête de la carte) et se range **à la fin de la traversée**, gagnée,
  perdue ou abandonnée : un défi d'acte réussi reste acquis même si la
  traversée tombe ensuite. Sinon une traversée ratée au troisième acte
  coûterait tout, et on n'oserait plus rien tenter.
- Beaucoup de défis demandent **d'avoir la carte et de ne pas s'en servir**,
  ou de s'en servir de façon extrême. C'est le cœur de l'idée : la Parade la
  plus forte devient la carte d'un défi « sans parade ».

## 3. Les dix défis (premier jet, chiffres à calibrer)

| Carte | Le défi | Bronze | Argent | Or |
|---|---|---|---|---|
| **Cagnotte** | *Le Trésorier* — de l'or en poche | 150 pièces à la fin d'un acte | 300 pièces à la fin d'un acte | 500 pièces à la fin de la traversée |
| **Parade** | *Sans filet* — ne pas en avoir besoin | Un gardien vaincu sans qu'aucune parade ne serve | Deux gardiens | Traversée gagnée sans une seule parade |
| **Panacée** | *Increvable* — garder ses cœurs | Un acte fini sans perdre un cœur | Deux actes | Traversée gagnée sans perdre un cœur |
| **Quitte ou double** | *Le Flambeur* — miser et gagner | Trois mises gagnées | Cinq mises gagnées d'affilée | Le coup final d'un gardien porté sur une mise |
| **Coup de grâce** | *L'Exécuteur* — abattre vite | Un gardien vaincu en un seul assaut | Deux gardiens en un seul assaut | Un gardien abattu dès la 2ᵉ manche |
| **Concentration** | *Le Sang-froid* — ne pas traîner malgré le temps offert | Une épreuve aux 3 manches justes | Une épreuve sans faute, chaque réponse dans la première moitié du temps | Un gardien vaincu ainsi |
| **Coup d'œil** | *Lucide* — garder l'indice pour soi | Un acte fini sans l'utiliser | Deux actes | Traversée gagnée sans jamais l'utiliser |
| **Échange** | *Pas de regret* — jouer la première manche donnée | Un gardien vaincu sans échange | Deux gardiens | Traversée gagnée sans un seul échange |
| **Pourboire** | *L'Avare* — le marchand peut attendre | Un acte sans rien acheter | Deux actes | Traversée gagnée sans dépenser une pièce |
| **Second souffle** | *Le Revenant* — revenir de loin | Le second souffle sert, et l'acte est quand même fini | Le gardien de l'acte vaincu dans l'assaut qui suit le second souffle | Traversée gagnée après le second souffle |

Ce tableau joue sur des choses que le pli de la traversée sait **déjà** : l'or
et les cœurs à chaque geste, les manches de chaque bilan (`ManchePayee` :
étoiles, misée, parée, coups), les assauts d'un gardien, les achats, le
second souffle. Seuls Coup d'œil, Échange et Concentration demandent de lire
les gestes des parties (la colonne `joker`, et le temps de chaque réponse au
journal des réponses), qui sont aussi déjà écrits.

**L'outil d'équilibrage :** une carte faible reçoit des seuils plus bas ou des
récompenses plus belles. Ça se règle **sans toucher au jeu** : une ligne de
`bareme.ts` par défi, et sa ligne dans `baremes.md`.

## 4. Les défis des gardiens : la route vers les légendaires

En plus des cartes, **chaque gardien a son « épreuve de maître »**, liée à sa
devise. Elle se lit dans l'annonce du gardien, qui existe déjà :

- **Le Dragon** (« Il garde son or. Prends-le-lui ») : le vaincre en ayant
  400 pièces en poche.
- **Le Phénix** (« Il renaît de ses cendres ») : le vaincre juste après
  avoir perdu un cœur.
- **Le Tigre** (« Il frappe vite ») : le vaincre en un seul assaut.
- **Le Sphinx** (« Il ne laisse passer que ceux qui savent ») : le vaincre
  sans faute.
- … une par gardien (vingt), écrites dans leur esprit.

Un gardien vaincu **avec** son épreuve de maître donne son légendaire avec
une **finition** au choix de la fin (en reprenant les finitions qui existent :
argent, or, holo…). Ça répond à « même des légendaires » **sans peindre
vingt images de plus**. Ceux qui ont déjà le légendaire ont alors une raison
de revenir l'affronter.

## 5. Ce qu'on gagne

| Rang | Ce qu'il donne | Pourquoi |
|---|---|---|
| **Bronze** | Des confettis (25 ?) | La monnaie de la boutique existe déjà : le Bronze sert à acheter un thème, un fond. |
| **Argent** | Des confettis (75 ?) **et** un dos de carte doré pour cette carte, au choix des cartes | Visible au moment où on choisit : la fierté se voit. |
| **Or** | Un **sceau** au profil : le nom du défi, sur la carte du joueur (« Le Trésorier ») | Un titre se montre partout où la carte du joueur s'ouvre, soirées comprises. |
| **Les dix Or** | Un **légendaire exclusif**, « Le Collectionneur » (à peindre, skill `peindre`), et le fond du Cabinet | Le seul légendaire neuf à peindre ; il se mérite sur des dizaines de traversées. |
| **Cinq Argent** | Une **gerbe** du Cabinet (des cartes à jouer qui volent aux bonnes réponses) | Les gerbes ont déjà leur règle de déblocage (`par: { … }`). |
| **Épreuve de maître** | Le légendaire du gardien avec une finition | Voir § 4. |

Rien ne touche au barème de l'expérience (pas de `VERSION_BAREME`) si les
défis ne rapportent pas d'expérience. **Je le recommande** : l'expérience
viendrait doubler celle des épreuves, déjà payées.

## 6. Plus tard, si ça plaît : les sceaux de difficulté

Une variante dans l'esprit de Slay the Spire : au départ, on **s'impose**
des contraintes (un cœur de moins, des gardiens plus solides, un marchand
fermé) et chaque contrainte acceptée relève les récompenses des défis.
Elle passe par les notions existantes (cœurs, or, cartes), mais elle ajoute
un choix au départ : **à garder pour un deuxième lot**, une fois qu'on aura
vu si les défis simples suffisent.

## 7. Comment ça se construirait (pour plus tard)

- `shared/cabinet/defis.ts`, pur : `DEFIS` (un par carte, trois rangs),
  `EPREUVES_DE_MAITRE` (une par gardien), et `defisDeLaTraversee(depart,
  gestes, bilans)` → les rangs atteints. Testé seul sur des traversées
  écrites à la main (comme `rendu-traversee.ts` le fait déjà).
- Rangés à la fin de la traversée sous `#cabinet`, comme le légendaire
  (`rattraperLeLegendaire` pour la panne), idempotents par leur clé
  `defi:<carte>:<rang>` — **un rang validé ne se reprend jamais**
  (invariant 22 : un défi durci ajoute une entrée, il n'en modifie pas une).
- Une version des défis (`VERSION_DES_DEFIS`) pour relire les traversées
  d'avant quand une règle change : les traversées déjà jouées donneraient
  leurs défis **dès la mise en ligne**. C'est un beau cadeau de lancement.
- La page : une ligne sous chaque carte au choix des cartes, le sceau qui
  tombe dans la tête, et les défis réussis au bilan de fin. C'est tout.
- Au QG : le **taux de prise de chaque carte** et son taux de victoire,
  pour voir si les défis rééquilibrent vraiment le choix.

## 8. Les choix à faire

1. **Les défis de cartes seuls, ou aussi les épreuves de maître des
   gardiens** dès le premier lot ? (Ma recommandation : les deux. Les
   gardiens donnent le « légendaire » demandé sans rien à peindre.)
2. **Le légendaire exclusif des dix Or** : oui, et à peindre ? Ou seulement
   des finitions ?
3. **Confettis aux rangs Bronze/Argent** : d'accord sur le principe ? (C'est
   un choix de produit : ça change l'économie de la boutique.)
4. **Un défi d'acte acquis même si la traversée est perdue** : d'accord ?
   (Ma recommandation : oui.)
5. **Les traversées passées relues au lancement** (des défis offerts
   d'emblée) : oui ?
