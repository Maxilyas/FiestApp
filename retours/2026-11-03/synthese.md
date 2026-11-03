# La production au 3 novembre 2026 : ce qui lit le quota de Turso, et ce qui gèle

La demande du propriétaire : « regarder en production ce qui consomme
maintenant en read sur Turso et les gels du serveur », puis, sur les trois
pistes proposées, « attaque les points 1 et 2 ». Lu en lecture seule
(`PROD_LECTURE_URL`, `PROD_LECTURE_TOKEN`) : le relevé de l'heure de la page
« Le serveur » du QG (`qg_sante`), des totaux et des `EXPLAIN QUERY PLAN` — ni
un nom, ni un identifiant. `reproductions/ce-qui-lit-le-plus.ts` le relit,
version par version.

## Ce que la production dit

Trois jours, du 31 octobre au 3 novembre : 7,2 millions de lignes lues,
36 000 écrites — 14 % des 500 millions du mois à ce rythme. Sain. La plus
grosse lecture de la semaine d'avant, les défis reçus de l'accueil (12 %),
a disparu avec la version du 3 novembre au matin ; les épreuves validées
de l'accueil, gardées en mémoire depuis l'après-midi (`05bed2d`), aussi.

Ce qui lisait le plus sous les versions de l'après-midi (`8e42aab`,
`89cf01b`, neuf heures relevées) :

| Part | Par appel | Ce que c'est |
|---|---|---|
| 19 % | 59 790 lignes, 4 appels | l'économie du QG : ses bonnes réponses de campagne heure par heure (`economieDepuis`) — SQLite parcourait toute la table des réponses (`SCAN r`), jointe à leurs séries, à chaque ouverture |
| 4,6 % | 2 846 | le rang du quiz du jour, tous les jours qu'il a joués (`RANK() OVER`, `lecturesDesStats`) |
| 3,7 % | 188, 243 appels | ses paliers validés, relus dans le lot de chaque bonne réponse de campagne (`lectureDesPaliersValides`) — par l'index des sentiers, ses épreuves ratées aussi |
| 3,5 % | 5 431 | l'histoire de ses duels classés (`lectureDesDuels`) |
| 3,2 % | 876 | ses catégories au quiz du jour (`savoirDe`) |

Les gels : de 15 h à 22 h, 33 de plus d'une demi-seconde, 30 s en tout —
107 en dix-neuf heures sous la version d'avant les tranches du 2 novembre
(`73cec7d`), 70 en quinze sous les trois suivantes. Le travail de fond de la
campagne (le modèle du savoir, la mesure, les tirages, les sujets) tourne
pendant la plupart d'entre eux, avec les routes de toutes les heures —
l'accueil, la page des sentiers. Une route gèle seule : `GET /api/quizzes`,
« Mes quiz », quatre fois ce jour-là, 1,5 à 2,4 s, 242 à 392 ms de
processeur.

## Ce qui a été fait

1. **L'économie du QG compte ses bonnes réponses au journal des réponses**
   (`justesDeTousDepuis`, `core/journalDesReponses.ts`), rattrapé d'un
   aller-retour qui ne lit que les réponses neuves : 60 000 lignes par
   ouverture, puis rien. Et sans la semaine de marge, qui ne servait qu'un
   index : une partie reprise plus d'une semaine après son début paie aussi.
   `qg-charge.test.ts` lit le plan de chaque lecture de la page (aucun
   `SCAN` des réponses), `journal-des-reponses.test.ts` compare la dérivation
   au SQL.
2. **Les épreuves validées ont leur index partiel**
   (`idx_campagne_series_validees`, couvrant, `WHERE mode = 'sentier' AND
   issue = 'validee'`) : la lecture de ses paliers reste dans le lot de
   chaque bonne réponse — la règle des sentiers le veut, une réponse qui
   valide un palier le compte dans son propre lot —, mais ne parcourt plus
   que ses épreuves validées : 124 lignes au lieu de 281 pour le plus
   assidu. Celle de l'accueil, quand elle n'est pas gardée, de même. Sans
   statistiques, SQLite le préfère quel que soit l'ordre où la base a créé
   ses index (`campagne-index.test.ts`), sous le moteur de libsql comme sous
   celui des tests.
3. **« Mes quiz » ne relit que les quiz qui ont changé** (`QuizStore.list`) :
   la ligne de chaque quiz, sans ses questions, et le résumé gardé sous sa
   version — sa date de modification, la longueur de ses questions, ses
   réglages ; la bibliothèque relue au démarrage et après chaque écriture le
   résume au passage, et la mémoire des quiz relue au démarrage pour le
   tirage se garde pour la première ouverture (`bibliotheque.test.ts`). Et
   `tronquer` ne découpe plus un texte déjà court : `normalizeQuestions` y
   passait chaque champ de chaque question.

Au banc (`reproductions/liste-des-quiz.ts`), une bibliothèque au volume de
la plus grosse de la production — 43 quiz, 1 160 questions —, derrière le
faux Turso, au transport léger et au client minimal :

| `GET /api/quizzes` | Avant | Après |
|---|---|---|
| Une ouverture, le code chaud | 25 à 30 ms de processeur, 620 Ko rapportés de la base | 3,5 à 3,8 ms, 11 Ko |
| La première d'un processus neuf (les drapeaux de la production) | 57 à 86 ms | 20 à 26 ms |
| La deuxième | 81 à 102 ms | 17 à 24 ms |
| La bibliothèque normalisée (démarrage, chaque écriture) | 7,7 à 8,9 ms | 4,3 à 5,4 ms |

Une requête d'API coûte en production deux fois le processeur du banc, et
au dixième de cœur chaque milliseconde en dure dix : la première ouverture
d'un réveil passe d'un gel de deux secondes à quelques dixièmes, les
suivantes ne gèlent plus.

## Ce qui reste

- **Le travail de fond de la campagne** reste de la plupart des gels — le
  modèle du savoir, les tirages, la mesure, les sujets. La synthèse du
  2 novembre le disait : au banc bridé, il n'a plus de bloc du dépôt à
  couper ; le levier est le processeur de l'hébergeur, un choix de budget.
- **Les lectures suivantes du quota** : le rang du quiz du jour
  (2 846 lignes par appel), l'histoire des duels classés (5 431), les
  catégories du quiz du jour (876). Aucune ne pèse plus de 5 %.
- **À relire après la mise en ligne** : `reproductions/ce-qui-lit-le-plus.ts`
  sur la version qui portera ces trois changements — l'économie ne doit plus
  paraître, ni « Mes quiz » parmi les gels.

## Puis : les routes qui gèlent d'elles-mêmes

Le même soir, le propriétaire : « On va laisser 6 h pour le recalcul,
j'aimerais que tu fasses uniquement le point 4 » — corriger une à une les
pages que la sonde relevait avec le seul fond qu'elles attendent, mesurées
au banc comme « Mes quiz ». Les cadences du fond (`MESURES_GARDEES_MS`,
`MODELE_GARDE_MS`) restent à six heures.

`reproductions/routes-qui-gelent.ts` mesure chacune sur la base du banc
grossie au volume de la production (35 000 réponses, rangées dans l'ordre
du temps comme en production : recopiées en arrière, elles rendaient le
carnet du joueur incertain, relu de la base à chaque lecture), derrière le
faux Turso, pour le joueur qui a le plus joué (3 268 réponses), le code
compilé comme le paquet : la première fois qu'un processus la sert — le
code jamais compilé, comme une route rare en production —, puis cinq fois.
Le processeur, sur un vrai cœur, avant les deux changements plus bas — un
passage ; à froid, une route varie d'un passage à l'autre du simple au
double, le compilateur de V8 travaillant à côté :

| Route | À froid | Chaud |
|---|---|---|
| L'accueil (en-tête, missions, nouveautés) | 37 ms | 27 ms |
| La page des sentiers | 14 | 17 |
| La campagne (campagne, carnet, sujets de front) | 33 | 24 |
| Une série neuve | 29 | 15 |
| Le départ d'une épreuve | 234 | 17 |
| L'abandon d'une épreuve | 11 | 8 |
| Le QG, vue d'ensemble | 45 | 20 |
| Le QG, la page de la campagne | 41 | 28 |
| Le QG, les sentiers palier par palier | 24 | 14 |
| Le QG, l'activité | 19 | 15 |

La page des sentiers est légère en elle-même : ses gels de production
viennent de ce qui tourne avec elle — le fond, les autres routes — et du
code froid d'un réveil. Deux routes avaient un bloc à elles :

4. **Le départ d'une épreuve à froid** passait la moitié de son processeur
   à calculer, pour chaque candidate, la signature de ses jumelles — sa
   forme, sans accent, mot par mot, et ses réponses nettes — et ce qui
   s'apprend par cœur : 202 et 61 ms sur toute la base, une fois par
   processus, au premier tirage de chaque catégorie, série et défi compris.
   Le build les range désormais dans la base préparée (format 3,
   `signeAPreparer`, `parCoeurCalcule`) : les formes une fois chacune
   (14 653 pour 27 404 questions), les réponses nettes des seules questions
   où elles ne sont pas les réponses en minuscules (15 960), le par-cœur en
   un chiffre. Les colonnes se coupent en une ligne par bloc de deux mille
   questions : d'une seule ligne, elles pesaient 2,2 Mo, un `JSON.parse` de
   13 ms d'un bloc sur un vrai cœur, une centaine au dixième de cœur. La
   base grossit de 1,6 Mo, sa lecture d'une trentaine de millisecondes.
   `base-preparee.test.ts` compare, question par question, ce que le tirage
   lit à ce que le serveur calcule.
5. **La page de la campagne du QG** repassait quatorze fois les vingt-sept
   mille questions à chaque ouverture — une pour les contredites, une pour
   les catégories, une par catégorie pour les difficultés. Elle les compte
   d'une passe (`tableauDeLaBase`), et garde le tableau tant que les
   jouables et la mesure restent les mêmes (`tableauxDuQg`, sous la mesure :
   relue toutes les six heures, elle l'emporte). `campagne-contredites.test.ts`
   le compare au code d'avant sur la vraie base, et relit la page derrière
   une mesure neuve.

Au même banc, le même code, la base préparée avec et sans les signatures
— sans, le serveur les calcule comme avant —, quatre passages de chaque :

| | Avant | Après |
|---|---|---|
| Le départ d'une épreuve, à froid | 95 à 234 ms de processeur, 62 à 115 ms d'attente | 61 à 69 ms, 42 à 49 ms |
| Une série neuve, à froid | 29 à 32 ms | 30 à 58 ms : elle ne lit que quelques dizaines de candidates, rien ne se voit sous le bruit |
| La page de la campagne du QG, à froid | 41 ms | 27 à 29 ms |
| La même, ensuite | 28 ms | 5 à 6 ms |

Au dixième de cœur, chaque milliseconde en dure dix : le premier départ
d'une épreuve d'un réveil tenait le serveur d'une à plus de deux secondes,
en tranches ; six à sept dixièmes désormais. Les autres routes ne bougent
pas.

## Ce qui reste, après le point 4

- **L'accueil et la page de la campagne** coûtent 30 à 40 ms à froid, 20 à
  25 ensuite, sans bloc à eux : un coût émietté — les allers-retours vers la
  base en font un dixième. Ce sont les routes de toutes les heures ; leurs
  gels de production sont ceux du fond qui tourne avec elles.
- **La vue d'ensemble du QG** (45 à 60 ms à froid) compte déjà ses trente
  jours en tranches, un chiffre par tour de boucle ; son premier appel paie
  surtout le code froid.
- **À relire après la mise en ligne** : la page « Le serveur » du QG — le
  départ d'une épreuve et la page de la campagne ne doivent plus paraître
  seuls parmi les gels.
