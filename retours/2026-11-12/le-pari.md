# Le Pari, l'autre jeu très en dessous — le 12 novembre 2026

Le relevé du Filet (`le-filet-en-deux-ecrans.md`) montrait un second jeu au
fond du tableau : depuis le 2 novembre, 64 % des manches du Pari ne rapportent
aucune étoile, contre 34 % pour les dix jeux. Le propriétaire : « Tu parlais
aussi d'un autre jeu qui est très en dessous ? » — puis, à la proposition du
même relevé : « oui stp ». Rien n'est changé au jeu ici : ce qu'il montre,
d'abord.

## Ce que la production dit

Du 1er au 12 novembre, 154 manches, 10 joueurs — l'un d'eux en a joué 75
(`reproductions/le-pari-en-production.ts`, en lecture seule, des totaux).

| D'où viennent les 98 manches à zéro étoile | Manches | Part des zéros |
|---|---|---|
| La première question, fausse | 78 | 80 % |
| Le pari perdu | 20 | 20 % |
| Le temps (aucune réponse) | 0 | — |

Les autres : 43 manches gardées (★★), 13 paris gagnés (★★★). 0,81 étoile par
manche.

- **Une seule question décide de la manche.** La première est juste une fois
  sur deux (49 %), et fausse, la manche vaut zéro et coûte un cœur.
- **Cette question est difficile là où le jeu se joue.** Elle suit la marche de
  l'acte : 85 des 154 premières questions étaient difficiles, 9 expertes.

  | La première question | Manches | Juste |
  |---|---|---|
  | facile | 24 | 79 % |
  | moyenne | 36 | 53 % |
  | difficile | 85 | 39 % |
  | experte | 9 | 56 % |

- **Les assauts des gardiens font le gros des manches** (88 sur 154), un cran
  plus haut que les épreuves : à l'assaut de l'acte II, 48 manches, la première
  question juste une fois sur trois, 77 % de manches à zéro.
- **Parier perd en moyenne.** 33 paris sur 76 premières questions justes, 13
  gagnés (39 %) : 1,18 étoile en moyenne, contre 2 gardées — et six paris sur
  dix coûtent un cœur. Il faudrait deux paris gagnés sur trois pour qu'il
  vaille la peine. À l'assaut de l'acte III, plus personne ne parie (0 sur 14).
- **Ni le temps, ni l'écran.** La première réponse part en 9 s en médiane (35 s
  de chrono), aucune manche n'est allée à l'échéance. Éclairer a servi une fois.

## Le même QCM, sans rien à parier

Le Quiz pose les mêmes questions de la base, quatre par manche
(`le-pari-en-production.ts quiz`, 516 questions) :

| À sa marche | Une question du Quiz | La première du Pari |
|---|---|---|
| facile | 88 % justes | 79 % |
| moyenne | 66 % | 53 % |
| difficile | 42 % | 39 % |
| experte | 31 % | 56 % (9 manches) |

Les joueurs ne répondent pas plus mal au Pari qu'au Quiz. Mais au Quiz, deux
justes sur quatre gardent la manche et son cœur ; au Pari, une question
difficile à 40 % de réussite vaut tout ou rien.

## Ce que l'écran montre

`reproductions/rendu-du-pari.ts`, en 360 × 640 : la question (5 cibles, une
trentaine de mots), « garder ou parier » (3 cibles) et la question du pari
tiennent chacune sur un écran. Rien à voir avec le Filet d'avant.

Deux choses à l'écran du choix :

- « Raté, la manche ne rapporte rien » : la phrase ne dit pas le cœur qu'un
  pari perdu coûte dans une traversée.
- « Parier » est le bouton doré, celui que l'écran désigne — le choix qui perd
  en moyenne.

## Ce qu'on demande

- Des premières questions difficiles : la capitale du Botswana, l'auteur des
  *Maias*, le sculpteur du Voltaire assis, l'inventeur de la fermeture à
  glissière, les cartes de vœux japonaises, la charrue sans roues.
- Des questions de pari expertes : le quartier de Londres où est né un acteur
  de *Lost*, le roi d'Écosse de Bannockburn, le jeu NES du robot R.O.B.

## Ce que le jeu disait de lui-même

`shared/cabinet/jeux/pari.ts` : « une question facile ou moyenne ; juste, il
garde deux étoiles, ou les parie sur une question plus difficile ». Dans la
traversée, la première question prend la marche de l'acte (`MARCHES_DES_ACTES`,
`MARCHES_DES_GARDIENS`) : moyenne à l'assaut de l'acte I, difficile à ceux des
actes II et III. La difficulté, que le jeu mettait dans le pari — au choix —,
est passée dans la question qu'on ne peut pas éviter.

## Les pistes

Aucune n'est décidée ; chacune touche un barème.

1. **Rendre la première question à ce que le jeu annonce.** Un cran sous les
   autres jeux, comme le Filet et l'Éclair : facile, facile, moyenne aux
   épreuves ; facile, moyenne, moyenne aux assauts. Aux taux mesurés sur le
   Quiz, la première question passerait d'une juste sur deux à trois sur
   quatre, là où le Pari s'est joué. La difficulté de l'acte resterait dans la
   question du pari.
2. **Un pari qui ne coûte pas tout.** Perdu, il laisserait une étoile au lieu
   de zéro : plus de cœur perdu pour avoir tenté. Rejoué sur les 154 manches
   sans rien changer d'autre : 51 % de manches à zéro au lieu de 64 %, 0,94
   étoile au lieu de 0,81 — sans compter que l'on parierait plus.
3. **Un écran du choix qui dit vrai** : ce qu'un pari perdu coûte, et « Garder »
   au même rang que « Parier ».

## Les limites

- 154 manches, dont la moitié d'un seul joueur ; 33 paris.
- Les deux estimations rejouent les manches réelles ou des taux mesurés
  ailleurs : elles ne disent pas comment on jouerait sous d'autres règles.
- Le calibrage de la traversée n'a pas été rejoué.

## Les reproductions

- `reproductions/le-pari-en-production.ts` — d'où viennent les zéros, par acte
  et par marche, garder ou parier, le temps ; chaque question posée ; les
  questions du Quiz une à une.
- `reproductions/rendu-du-pari.ts` — les écrans photographiés et mesurés sur un
  serveur jetable.
