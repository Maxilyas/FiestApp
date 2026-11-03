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
