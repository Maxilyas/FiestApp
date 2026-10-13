# Le crédit de l'API, le 13 octobre 2026 — la base relue, classée, agrandie

Le propriétaire a reçu 200 $ de crédit sur l'API d'Anthropic, et ne s'en
servira qu'une fois. L'outillage de [la PR #192](https://github.com/Maxilyas/FiestApp/pull/192)
(un dossier jetable, `credit-api/`, retiré avant la fusion — le dépôt garde
son choix du 10 octobre : ni clé ni SDK) l'a dépensé sur la base de la
campagne, en lots (Message Batches, moitié prix), dans une session qui avait
la clé. Le passage a suivi son mode d'emploi : un pilote de la relecture sur
trois cents questions, ses décisions lues avant d'être appliquées ; toute la
base relue une seconde fois, classement compris ; mille questions à nombre
pour les estimations du quiz tout prêt ; puis le reste du crédit en questions
neuves, écrites par Opus, moins dix dollars de marge.

## En bref

- **La base passe de 11 059 à 21 887 questions.** Elle a été relue en
  entier une seconde fois (22 retirées, 528 corrigées sous leur identifiant,
  521 reclassées), puis a reçu 904 questions à nombre et 9 946 questions
  neuves.
- **Les estimations du quiz tout prêt** jouables au plus près passent de 644
  à 1 546 avec les questions à nombre — de 9 à 21 de difficulté 1 et de 137 à
  517 de difficulté 2, ce qui manquait le plus —, puis à 1 738 avec les
  questions neuves.
- **Chaque sous-thème a désormais deux cents questions au moins** : les
  questions neuves allaient d'abord là où il en manquait le plus.
- **187,21 $ dépensés** sur 200 (au tarif public des lots ; la console
  d'Anthropic fait foi), en 41 lots et 1 873 demandes.
- Chaque décision de relecture est dans son journal, avant et après, recopié
  tel quel dans `journaux/`, à côté de ce compte rendu.

## Ce que chaque étape a coûté

| Étape | Lots | Demandes | Prévu | Mesuré |
|---|---|---|---|---|
| Le pilote de la relecture (300 questions) | 2 | 14 | 1,20 $ | 0,63 $ |
| Toute la base relue (10 759 questions) | 2 | 294 | 39,70 $ | 16,77 $ |
| Mille questions à nombre | 6 | 121 | 11,60 $ | 18,41 $ |
| Questions neuves, tranche 1 (3 000) | 10 | 368 | 44,61 $ | 36,25 $ |
| Questions neuves, tranche 2 (3 000) | 7 | 410 | 48,67 $ | 41,66 $ |
| Questions neuves, tranche 3 (3 000) | 7 | 426 | 51,98 $ | 45,50 $ |
| Questions neuves, tranche 4 (1 700) | 7 | 240 | 30,93 $ | 27,99 $ |
| **En tout** | **41** | **1 873** | **228,69 $** | **187,21 $** |

## La relecture

### Le pilote

Trois cents questions tirées de partout, en treize fiches d'une catégorie,
relues par Opus en réflexion `high` : aucun retrait, 20 corrections, 15
reclassements, un doute vérifié sur le web. Ses décisions ont été lues une à
une — et trois fiches de questions gardées relues à côté, sans y trouver de
faute manquée — avant d'être appliquées ; le propriétaire a ajouté une
difficulté (le parc amazonien de Guyane, à 2 : son intitulé reformulé ne
laissait plus qu'une réponse hors de la métropole).

### Toute la base

Les 10 759 autres questions, en 274 fiches : 19 retraits sûrs, 985
corrections — dont 506 reclassements —, 20 doutes vérifiés sur le web,
sources à l'appui (3 gardés, 14 corrigés, 3 retirés). Après les retouches du
propriétaire : **22 retirées, 508 corrigées, 506 reclassées.**

- **Les retraits** : neuf doublons d'un fait déjà posé (Carcassonne, Nancy,
  Versailles, Ada Lovelace, Ben-Hur, « Les Bienveillantes », Bernal 2019, le
  pessimisme, le signe des Poissons) ; sept questions dont un leurre était
  juste aussi (le poisson-vipère porte lui aussi un leurre lumineux, un
  caméléon est un lézard, un acte de théâtre se divise aussi en tableaux, le
  mont-d'or se mange chaud sur des pommes de terre, « Black Jack » nomme aussi
  le drapeau pirate, et deux noces : deux ans de mariage font les noces de
  cuir en France, quarante celles d'émeraude) ; deux autres noces de la liste
  américaine ; « le blues grec », qui soufflait la Grèce ; trois faits
  périmés ou que les sources ne départagent pas (la confiture « extra »
  depuis la directive 2024/1438, les quatre tonnes de krill de la baleine
  bleue — seize d'après une étude de 2021 —, le berceau du Rummikub).
- **Les corrections** : des faits faux dans l'anecdote, l'explication ou
  l'intitulé — l'Ascension n'est pas « quarante jours après Pâques » (ce
  serait un vendredi), « Du côté de chez Swann » ne s'ouvre pas sur la
  madeleine, les coprinces d'Andorre au Moyen Âge, Just Fontaine pas encore à
  Reims pour la finale de 1956, l'œuf du guillemot qui ne roule pas en
  cercle, le Peach Drop d'Atlanta remplacé par des drones, la première
  boutique de Lenôtre rue d'Auteuil… ; les réponses soufflées par leur racine,
  de 137 à 11 parmi les relues ; des difficultés franchement fausses.
- **Le classement**, avec les règles de partage et les définitions de la
  consigne d'écriture : 104 changements de catégorie (les drapeaux à la
  géographie, le calendrier aux mesures, les films, séries et musiques que la
  fête rangeait chez elle, les dates d'inauguration à l'histoire, les
  monuments situés à la géographie), 113 de sous-thème (les palmarès de
  Cannes aux coulisses, les capitales), et les étiquettes à la lettre de leur
  définition : 113 posées (« tour-de-france » 46, « cannes » 33…), 227
  retirées (« etymologie » 148, quand seule l'anecdote racontait l'origine du
  mot ; « surnom » 18…). Les sujets s'en ressentent : « L'origine des mots »
  passe de 420 à 272 questions, toujours de douze catégories ; « Les grands
  rendez-vous du sport » de 237 à 285 ; « Autour de la fête » de 813 à 779.

Les retouches du propriétaire, avant d'appliquer : **une question à nombre
garde sa difficulté** — le correcteur en relevait 21 de deux crans, en les
jugeant comme un QCM au chiffre près, quand la consigne des nombres les note
sur ce que la plupart approchent (les estimations faciles manquaient déjà) ;
**deux questions sauvées**, que leur correction aurait fait retirer par le
juge : « du Pas-de-Calais » écrivait la réponse (Calais) dans l'intitulé, et
l'anecdote du Renoir dépassait les 280 caractères permis.

## Les questions à nombre

Mille questions dont la bonne réponse est un nombre qui s'approche, écrites
par Opus avec la consigne des nombres (la moitié de difficulté 2), dans les
sous-thèmes où un nombre se pose déjà : 999 écrites, 929 gardées par le juge
(65 posaient un fait que la base avait déjà, 5 son intitulé), 25 retirées et
48 corrigées à la relecture, **904 rangées**. Les estimations jouables au plus
près passent de 644 à 1 546.

## Les questions neuves

Écrites par Opus (le choix du propriétaire : la qualité avant le nombre),
250 par catégorie et par tranche — 140 environ pour la dernière, taillée pour finir
le crédit à dix dollars près —, là où les sous-thèmes manquaient le plus,
puis relues par Opus avec le jugement de l'agent correcteur du dépôt :
**9 946 rangées** en quatre tranches.

| Tranche | Demandées | Écrites | Gardées par le juge | Fait déjà posé | Retirées à la relecture | Corrigées | Rangées |
|---|---|---|---|---|---|---|---|
| 1 | 3 000 | 2 981 | 2 893 | 77 | 20 | 73 | 2 873 |
| 2 | 3 000 | 2 978 | 2 815 | 151 | 22 | 58 | 2 793 |
| 3 | 3 000 | 2 972 | 2 778 | 180 | 25 | 65 | 2 753 |
| 4 | 1 700 | 1 700 | 1 535 | 153 | 8 | 38 | 1 527 |

`voisines` n'a trouvé, à aucune tranche, deux questions sur le même fait ;
ses paires presque pareilles — des préfectures, des noms de domaine, les
surnoms des équipes de rugby, des alphabets — posent chacune deux faits, et
le tirage ne sert pas deux jumelles côte à côte.

## Ce qu'on en retient

- **Les estimations de coût ratent dans les deux sens.** La relecture a
  coûté la moitié du prévu : 98 jetons de sortie par question en réflexion
  `high`, au lieu de 300. L'écriture, le double : 900 par question, la pensée
  comprise, au lieu de 450 — vérifier un nombre exact fait réfléchir, même en
  réflexion basse. Sept lots de questions à nombre sur quarante-trois
  s'arrêtaient au plafond de 32 000 jetons, payés entiers et inutilisables
  (quatre dollars perdus, deux fois pour certains) : en lot, un plafond plus
  haut ne coûte que ce qui s'écrit, il est passé à 64 000.
- **Plus la base grandit, plus chaque question neuve coûte.** Les refus pour
  un fait déjà posé sont passés de 77 à 151 puis 180 par tranche de trois
  mille, chacun repartant en correction : de 12,1 $ à 15,2 $ les mille
  questions demandées. Une base de vingt mille questions approche de ce que
  ses sous-thèmes peuvent porter sans se répéter.
- **Le second correcteur est prudent, et ses doutes valent de l'or.** Vingt-
  deux retraits sur onze mille questions (0,2 %) : la première relecture
  avait fait son travail ; ce qu'elle avait laissé passer tenait surtout aux
  anecdotes et aux explications. Les vingt doutes ont été vérifiés sur le
  web, de deux à six sources chacun, et leurs verdicts relus un à un avant
  d'être appliqués : trois questions gardées, quatorze corrigées, trois
  retirées.
- **Une question à nombre ne se juge pas comme un QCM**, et **une correction
  se relit comme une question** : elle peut écrire la réponse dans
  l'intitulé, ou dépasser ce que le juge permet — le juge, lui, retire la
  question.

## Les journaux

Recopiés tels quels, dans `journaux/` à côté de ce compte rendu :

- `relecture-pilote.journal.md` et `relecture-base.journal.md` — chaque
  retrait, chaque correction, chaque reclassement de la base, avant et après,
  avec son motif et, pour un doute, ses sources ;
- `relecture-base.ecartees.json` — les 21 difficultés que le propriétaire a
  laissées à leur question à nombre ;
- `generation-<nom>-relecture-<vague>.txt` — ce que la relecture de chaque
  génération a retiré ou corrigé, avant le rangement.
