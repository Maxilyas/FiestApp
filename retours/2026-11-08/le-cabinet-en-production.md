# Le Cabinet en production, le 8 novembre 2026

La question du propriétaire : « Peux-tu regarder le cabinet des curiosités,
comment il se comporte en prod ? Les joueurs sont-ils contents ? Est-ce qu'il
faudrait augmenter le volume de données ? »

**En bref.**

- **La technique tient.** Aucune erreur serveur au Cabinet sur les huit jours
  relevés. Depuis le 6 novembre, un geste répond en 75 à 120 ms en moyenne. Le
  départ d'une traversée prenait encore 6,5 s le 6, juste après une mise en
  ligne ; les 7 et 8, il prend 56 et 123 ms.
- **Les joueurs ont été curieux, puis se sont découragés.** 11 des 16 joueurs
  de la semaine l'ont essayé, dont 7 le 2 novembre. Depuis le 6, il n'en reste
  qu'un ou deux par jour : 11 traversées le 2, une seule le 7 et une le 8.
  **Sept joueurs sur onze n'ont jamais gagné de traversée.** Tous ont arrêté
  au bout d'une ou deux traversées (neuf perdues, trois laissées en route), et
  tous jouent encore ailleurs (jusqu'à 87 parties depuis leur dernière
  traversée). Sur les quatre qui en ont gagné une, trois sont revenus ces
  trois derniers jours.
- **Ce qui les décourage, d'après les traces : perdre tard.** 72 % des
  traversées sont perdues (21 sur 29 depuis la version 3). Toutes les défaites
  arrivent contre un gardien, et 13 contre le dernier. Or une traversée menée
  jusqu'à l'acte III dure 42 minutes et 17 épreuves en médiane, deux fois la
  durée prévue par le calibrage : la défaite tombe après tout ce temps. Le
  premier coupable est le **Filet** : 19 % de manches justes, 59 % à zéro
  étoile, 72 cœurs perdus et le coup fatal de 9 défaites sur 21. Sur la carte,
  les joueurs l'évitent.
- **Le volume de contenu n'explique pas le décrochage** : en dehors du joueur
  le plus assidu, personne n'a revu un seul contenu. Il faut l'augmenter pour
  le **Détail** : avec 100 tableaux, dont quatre comptent comme vus à chaque
  manche, le plus assidu les a tous vus. Sur ses 84 manches, 58 étaient des
  redites (42 de moins de 24 h), réussies à 67 % contre 44 % pour un tableau
  neuf. Il faut le prévoir pour les **Indices**, la **Réplique** et
  l'**Épingle**, que ce joueur a presque épuisés (59 fiches sur 66, 43
  répliques sur 66, 58 lieux sur 90). C'est inutile pour les jeux tirés de la
  base (27 404 questions, aucune redite), sauf pour ajouter au Filet des
  estimations faciles : il n'en a que 27 de difficulté 1.

## Ce que la production a dit

En lecture seule (`reproductions/le-cabinet-en-production.ts`, le jeton de
lecture, des totaux sans un nom), du 1er au 8 novembre 2026.

### Qui joue, et combien

| Jour | Traversées | Gagnées | Perdues | Abandonnées | En route | Joueurs | Épreuves |
|---|---|---|---|---|---|---|---|
| 1er nov. | 2 | 2 | 0 | 0 | 0 | 1 | 12 |
| 2 nov. | 11 | 3 | 7 | 0 | 1 | 7 | 141 |
| 3 nov. | 10 | 1 | 7 | 2 | 0 | 4 | 129 |
| 4 nov. | 5 | 2 | 3 | 0 | 0 | 5 | 39 |
| 5 nov. | 3 | 0 | 2 | 0 | 1 | 3 | 48 |
| 6 nov. | 2 | 0 | 1 | 0 | 1 | 2 | 25 |
| 7 nov. | 1 | 0 | 0 | 0 | 1 | 1 | 14 |
| 8 nov. | 1 | 0 | 1 | 0 | 0 | 1 | 15 |

Sur la même semaine, la campagne garde de 7 à 13 joueurs par jour : seul le
Cabinet a perdu du monde. Un joueur fait à lui seul 193 des 423 épreuves
(46 %). Les onze, anonymes :

| Traversées | Gagnées | Perdues | Abandonnées ou laissées | Épreuves | Dernière traversée | Parties ailleurs depuis |
|---|---|---|---|---|---|---|
| 14 | 3 | 9 | 2 | 193 | 6 nov. | 31 |
| 4 | 2 | 1 | 1 | 30 | 7 nov. | 1 |
| 3 | 2 | 1 | 0 | 49 | 8 nov. | 0 |
| 2 | 1 | 1 | 0 | 23 | 4 nov. | 7 |
| 2 | 0 | 1 | 1 | 15 | 6 nov. | 4 |
| 2 | 0 | 2 | 0 | 22 | 5 nov. | 1 |
| 2 | 0 | 1 | 1 | 29 | 5 nov. | 38 |
| 2 | 0 | 2 | 0 | 28 | 5 nov. | 87 |
| 2 | 0 | 2 | 0 | 28 | 4 nov. | 7 |
| 1 | 0 | 0 | 1 | 0 | 2 nov. | 26 |
| 1 | 0 | 1 | 0 | 6 | 2 nov. | 39 |

Aucun des sept joueurs sans victoire n'a commencé de traversée après le 6.
Pourtant, les onze ont tous joué dans l'application entre le 6 et le 8.

### Comment finit une traversée

Depuis la version 3 (le 2 novembre), 29 traversées sont finies : 21 perdues
(72 %), 6 gagnées (21 %) et 2 abandonnées à l'acte I, au bout de 1 et
4 minutes. Quatre autres sont encore en route, dont deux n'ont jamais dépassé
le choix des cartes.

- **Toutes les défaites tombent contre un gardien** : 4 à l'acte I, 4 à
  l'acte II et **13 à l'acte III**. Le dernier coup vient du Filet 9 fois, des
  Indices 4 fois, du Pari 3 fois, de l'Éclair et du Détail 2 fois chacun, et
  de l'Épingle une fois.
- **Une traversée dure deux fois plus longtemps que prévu.** Jouées d'une
  traite jusqu'à l'acte III, quinze traversées ont duré 42 minutes en médiane
  (de 23 à 130) pour 17 épreuves. Le calibrage annonçait une vingtaine de
  minutes et 15 épreuves pour le joueur moyen (`docs/reference/baremes.md`,
  « La traversée, d'un bout à l'autre »).
- **Le calibrage ne vaut que pour les plus engagés.** Au calibrage, le moyen
  gagne 25 traversées sur cent, l'occasionnel 6 et le fort 84. En production,
  les quatre joueurs qui ont gagné au moins une fois en gagnent 6 sur 20 :
  c'est le moyen. Les sept autres n'en ont gagné aucune sur 12 (9 perdues,
  3 laissées en route) : c'est l'occasionnel. Au calibrage (version 2), le
  moyen perd surtout à l'acte II (38 %, contre 24 % à l'acte III) ; en
  production, on perd au dernier gardien (13 défaites sur 21, 20 points de
  vie).

### Les jeux

Manches des 29 traversées finies depuis la version 3. Une manche est juste à
partir de deux étoiles naturelles (`justeDeLaPiece`). La colonne « Choisi »
donne la part des fois où le joueur prend ce jeu quand la carte le lui
propose parmi d'autres.

| Jeu | Manches | Justes | Zéro ★ | Cœurs perdus | Coups fatals | Temps médian d'une manche | Choisi |
|---|---|---|---|---|---|---|---|
| Réplique | 107 | **75 %** | 10 % | 4 | 0 | 12 s | **64 %** |
| Mot mystère | 96 | 63 % | 33 % | 22 | 0 | 83 s | 36 % |
| Frise | 27 | 59 % | 41 % | 5 | 0 | 29 s | **12 %** |
| Quiz | 71 | 55 % | 23 % | 12 | 0 | 40 s | 29 % |
| Détail | 137 | 53 % | 34 % | 31 | 2 | 13 s | 51 % |
| Éclair | 165 | 39 % | 22 % | 28 | 2 | 39 s | 40 % |
| Pari | 96 | 36 % | **64 %** | 45 | 3 | 13 s | 28 % |
| Indices | 128 | 34 % | 42 % | 44 | 4 | 57 s | 44 % |
| Épingle | 111 | 33 % | 28 % | 20 | 1 | 18 s | **19 %** |
| Filet | 138 | **19 %** | **59 %** | **72** | **9** | 19 s | 23 % |

- **Le Filet** est passé de 16 % à 26 % de manches justes après l'abaissement
  de ses marches le 3 novembre (« mettre des questions moins dures »). Il
  reste de loin le plus dur, et 62 % de ses manches finissent encore à zéro
  étoile.
- **La réussite baisse d'acte en acte** : 57 %, 47 % puis 44 % aux épreuves,
  et 42 %, 38 % puis 35 % contre les gardiens.
- **Le coffre** est pris 91 fois sur cent quand il est proposé. Parmi les
  jeux, les joueurs vont vers les plus rapides et les mieux réussis (la
  Réplique, le Détail) et évitent la Frise, l'Épingle et le Filet. La Frise
  est pourtant réussie à 59 % : ce rejet tient sans doute à l'écran ou à la
  durée, pas au contenu. 143 choix en tout : c'est une tendance, pas une
  mesure fine.
- **« Quitter ? » ne sert presque jamais** : 2 épreuves quittées sur 379.

### Le contenu : redites et réservoirs

Une redite, c'est un contenu déjà posé à ce joueur dans une autre partie, au
Cabinet ou ailleurs dans la campagne. Un contenu composé (Éclair, Quiz, frise
d'un sujet) compte une redite dès qu'une de ses questions a déjà été posée.
Ce qu'une manche montre en plus compte comme vu : les trois titres leurres du
Détail, et ce que « Changer » a remplacé.

| Jeu | Pièces jouées | Redites | Manches par jour joué (médiane, pire) |
|---|---|---|---|
| Éclair | 192 | 0 | 6, 43 |
| Filet | 158 | 0 | 6, 36 |
| **Détail** | 154 | **58 (38 %)** — 27 tableaux déjà joués, 31 déjà vus en leurre ; 42 de moins de 24 h | 3, 41 |
| Indices | 143 | 0 | 6, 25 |
| Pari | 126 | 0 | 4, 26 |
| Épingle | 120 | 0 | 6, 33 |
| Réplique | 119 | 0 | 6, 21 |
| Mot mystère | 107 | 0 | 6, 26 |
| Quiz | 77 | 0 | 3, 21 |
| Frise | 27 | 0 | 3, 3 |

Les 58 redites du Détail viennent toutes du même joueur. Les dix autres
n'ont revu aucun contenu, dans aucun jeu. Ce que les trois plus assidus de
chaque jeu ont vu des réservoirs hors de la base :

| Réservoir | Taille | Vus par les trois plus assidus | Consommé par traversée | Traversées avant la première redite, à une par jour |
|---|---|---|---|---|
| Détail (tableaux) | 100 | **100**, 60, 48 | 5 manches, soit 20 tableaux vus (fenêtre de quatre) | ~5 |
| Indices (fiches) | 66 | **59**, 18, 18 | 4,8 fiches | ~14 |
| Réplique | 66 | **43**, 15, 12 | 3,8 répliques | ~17 |
| Épingle (lieux) | 90 | **58**, 15, 12 | 4 lieux | ~22 |
| Frises à thème | 18 | 2, 2, 2 | 0,3 frise au plus (9 épreuves de Frise en 29 traversées) | ~60 |

- **Le contenu neuf a été dimensionné pour le musée, pas pour la traversée.**
  `cabinet-contenu.test.ts` garantit sept jours sans redite au rythme du
  musée : une visite, deux chasses et cinq parties libres, soit deux parties
  (six manches) par jour et par jeu. La traversée consomme quatre à cinq
  manches de chaque jeu, et le joueur le plus assidu enchaîne jusqu'à trois
  traversées par jour, soit 21 à 43 manches d'un même jeu dans ses grosses
  journées.
- **Le Détail s'épuise par construction** : chaque manche compte comme vue
  une fenêtre de quatre tableaux voisins dans le temps (`tirages/detail.ts`).
  Sa redite se reconnaît : réponse juste à 67 % contre 44 % sur un tableau
  neuf, ce que la tablée du 25 octobre avait annoncé.
- **La base suffit largement aux autres jeux.** Elle compte 27 404 questions :
  26 214 se jouent en QCM (Pari, Éclair, Quiz), 5 073 au Mot mystère et 1 825
  au Filet. Pour le Filet, seules 27 sont de difficulté 1 et 523 de
  difficulté 2, soit 36 à 59 questions faciles par catégorie. Le Filet
  demande une estimation sur une piste, sans réponses proposées. Or la
  difficulté de ses questions a été estimée et mesurée en QCM.

### La technique

Le relevé de chaque heure (`qg_sante`, huit jours gardés, 182 heures) compte
4 erreurs serveur, dont aucune au Cabinet.

| Route | 6 → 8 nov. : appels | Moyenne | Pire 95ᵉ centile d'une heure |
|---|---|---|---|
| `POST /api/cabinet/partie/:id/geste` | 362 | 77 à 113 ms | 0,9 s (pire : 1,4 s, le 6) |
| `POST /api/cabinet/traversee/:id/geste` | 90 | 93 à 117 ms | 0,5 s |
| `GET /api/cabinet/traversee` | 88 | 73 à 120 ms | 0,6 s |
| `POST /api/cabinet/traversee` (le départ) | 4 | 3,3 s le 6 → 56 et 123 ms les 7 et 8 | 6,5 s le 6 |

Les 4 et 5 novembre avaient encore un geste de 8 s, une traversée à 4,1 s et
un départ de traversée à 8,3 s (`../2026-11-04/latences-du-cabinet.md`). Les
deux départs relevés les 7 et 8 ont pris 56 et 123 ms : c'est encourageant,
mais ce ne sont que deux mesures. Depuis le 8 à 15 h 18, la production
tourne sur `7fb947c`, qui prépare aussi les tas du Cabinet à la fin du réveil
(règle `campagne.md`).

### Ce qu'on ne sait pas

- **Aucune mesure directe de la satisfaction.** Aucun sondage n'a porté sur le
  Cabinet : le seul, le 21 octobre, portait sur la campagne et a reçu deux
  réponses. Le contenu propre au Cabinet ne peut pas être signalé, c'est
  voulu. Aucune question de la base jouée au Cabinet n'a été signalée.
- **Les nombres sont petits** : 11 joueurs, 35 traversées, dont 14 pour un
  seul joueur.
- **Une corrélation n'est pas une cause.** Ceux qui perdent sont peut-être
  aussi ceux que le Cabinet intéressait le moins. Que les défaites les aient
  fait partir reste une hypothèse : un sondage la confirmerait.

## Ce que je propose, dans l'ordre

Chaque piste est un choix de produit, à mesurer d'abord
(`calibrage-cabinet.ts --sections traversee`) et à décider par le
propriétaire.

1. **Rendre la traversée gagnable pour ceux qui la découvrent.** C'est le
   levier qui compte : sept joueurs sur onze ont décroché sans avoir revu un
   seul contenu.
   - **Le Filet** : le retirer des assauts des gardiens, comme la Frise
     (`JEUX_SANS_GARDIEN`, `shared/cabinet/traversee.ts`). C'est contre les
     gardiens qu'il joue 36 de ses 48 épreuves et porte ses 9 coups fatals.
     Autre option : élargir son filet.
   - **Les gardiens des actes II et III à 11 et 17 points de vie** au lieu
     de 13 et 20. C'est déjà mesuré : le moyen y gagne 33 traversées sur
     cent, l'occasionnel 11 et le fort 87 (`baremes.md`, « La version 3 »).
     Cette option attendait l'accord du propriétaire.
   - **Une traversée plus courte** : elle dure deux fois ce que le calibrage
     annonçait, et la défaite tombe au bout de ces 40 minutes.
   - **Recaler le joueur modèle du calibrage** sur les taux de la production
     (le tableau des jeux) : son « moyen » gagne plus que les vrais joueurs.
2. **Le Détail : passer de 100 à environ 300 tableaux.** La chaîne existe
   (`server/scripts/details.ts`), mais elle part des 156 questions « Qui a
   peint… ? » de la base. Pour aller au-delà, il faut l'ouvrir directement à
   Wikidata, ou écrire d'abord ces questions (`faits-wikidata.ts`). Chaque
   nouveau tableau demande aussi de choisir son détail à l'œil sur les
   planches. En attendant, la carte pourrait ne plus proposer le Détail à qui
   n'a plus de fenêtre jamais vue.
3. **Les Indices, la Réplique et l'Épingle : doubler, sans urgence.** Seul le
   joueur le plus assidu en approche la fin. Quand ce contenu entrera, aligner
   `cabinet-contenu.test.ts` sur le rythme de la traversée, qu'il ne connaît
   pas encore.
4. **Le Filet : plus de volume n'y changera rien, il lui faut de meilleures
   questions.** Il faut des estimations écrites pour être estimées : des
   ordres de grandeur connus, des années célèbres. Elles passeraient par le
   pipeline de la base (skill `base-campagne`).
5. **Demander aux joueurs.** Le QG sait envoyer une annonce avec une question
   et des confettis à la clé (`qg_annonce_questions`) : « Qu'est-ce qui t'a
   fait arrêter le Cabinet ? », avec pour choix trop dur, trop long, pas
   compris, pas le temps, autre. Onze réponses vaudraient mieux que toutes
   ces traces.
