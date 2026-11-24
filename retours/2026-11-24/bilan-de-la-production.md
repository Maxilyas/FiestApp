# Le bilan de la production, et ce qui gelait hors du réveil : le 24 novembre 2026

Le propriétaire, le 23 novembre : « Tu peux regarder en prod, tu as les var
d'environnement, pour les performances visibles dans le QG ainsi que les
erreurs et quels sont les axes d'amélioration », puis, sur les axes proposés :
« Je ne veux pas que tu t'occupes du réveil pour le moment, commence par le
réglage des alertes », et « Go » sur la suite.

**En bref** : le serveur est sain — une erreur en huit jours, la mémoire et le
quota de Turso larges —, et ce qui fait attendre les joueurs, c'est le réveil
(laissé de côté, à la demande). Les alertes du QG sonnaient pour rien : elles
sont réglées (#444), et la règle des versions ne prend plus une heure de hoquet
pour une version lente. Hors du réveil, deux gels se sont corrigés — les tas du
Cabinet chaque matin, la page des sentiers au retour d'une épreuve — ; le
troisième, le départ d'une série, ne se reproduit pas au banc : ses étapes se
nomment désormais, et la production dira laquelle gèle.

## Ce que la production a dit

Par le bilan de la production (`server/scripts/bilan-de-la-production.ts`, en
lecture seule), du 15 au 23 novembre : 26 484 appels d'API, la moitié sous
75 ms, 19 sur 20 sous 474 ms, la pire 28,9 s ; une seule erreur serveur
(`GET /api/jour`, Turso muet dix secondes le 23 à 21 h 05) ; Turso 46 ms à la
médiane ; 337 Mo de mémoire au plus ; 42 millions de lignes lues projetées sur
le mois, pour 500.

| Ce qui fait attendre | Ce que la production a relevé |
|---|---|
| Le réveil | Les quinze pires attentes de la semaine, 22 à 29 s, toutes dans les minutes d'un démarrage : le premier accueil d'un réveil de nuit (28,2 s le 17 à 1 h 16, 28,9 s le 22 à 1 h 35), la routine à 6 h 56 (21,9 s le 23). **Laissé de côté.** |
| Les alertes | « Version qui ralentit » ouverte onze jours sur trente (`GET /api/auth/me` 4 → 9 ms) ; « Turso lent » vingt fois en huit jours, pour quatre heures entières au-delà de la seconde ; « Ressenti dégradé » trente-trois fois, dont neuf au réveil. |
| Les tas du Cabinet | Dix gels de 0,9 à 2,3 s, chaque matin entre 7 h 19 et 7 h 27, après les dépôts de la routine, sous « fond · tas du Cabinet » seul. |
| Le départ d'une série | Neuf gels sous la seule route, jusqu'à 2,9 s (le 21 à 20 h 11), presque tous sur le premier départ après dix à trente minutes sans une requête. |
| La page des sentiers | Onze gels de 0,5 à 2,4 s, « campagne · force sur les sentiers ×2 ». |

## Ce qui a été fait

1. **Les alertes** (#444) : une version ne ralentit une route que d'un tiers et
   de 200 ms au moins (`ECART_QUI_SE_SENT_MS`), hors de l'heure où chaque
   démarrage a commencé ; Turso se juge sur cent allers-retours
   (`ALLERS_RETOURS_POUR_JUGER`) ; le ressenti ne s'ouvre que lent à trois
   reprises (`MOMENTS_LENTS_POUR_LE_RESSENTI`) et laisse de côté les dix
   premières minutes d'un démarrage (`DEMARRAGE_A_FROID_MS`). Un incident
   laissé ouvert quand l'hébergeur endort le serveur se referme à son
   extinction, pas au réveil (`finDuGuetDAvant`) : « Turso lent » du 20 avait
   duré 379 minutes pour vingt guettées.
2. **Une heure de hoquet ne fait plus une version lente** : la règle, à peine
   réglée, disait `GET /api/jour` passé de 238 à 508 ms sous la version en
   ligne — heure par heure, la route tournait autour de 150 ms, sauf deux
   appels à 10,3 s le 23 à 21 h, Turso muet. Deux versions se comparent sur le
   95ᵉ centile de leur heure médiane (`centileDesHeures`). Rejoué : plus rien
   sous la version en ligne, le départ d'une série sous `5da104e`
   (235 ms → 1,4 s) reste dit.
3. **Les tas du Cabinet en tranches** : au banc de la correction du QG
   (`../2026-11-08/reproductions/correction-au-qg.ts`), les plus longues
   étapes des tas d'une liste neuve étaient les frises des sujets d'un bloc
   (9 à 16 ms sur un vrai cœur), la table des identifiants (7 ms), celle des
   catégories (4 ms). La campagne range ses deux tables en tranches avant les
   tas (`porte.preparerLesTables`), et les frises se font en tranches
   (`frisesEnTranches`) : plus aucune étape des tas au-delà de 8 ms.
4. **La page des sentiers** : au retour d'une épreuve, sa force et sa semaine
   faisaient deux passes du modèle d'un seul tenant — le « ×2 » de la sonde.
   Sa semaine attend désormais son propre tour de boucle (`semaineAJour`,
   un `setImmediate`).
5. **Le départ d'une série nomme ses étapes** (« campagne · questions
   jouables », « campagne · ce qu’il a vu », « campagne · tirage d’une
   série », « campagne · série laissée récompensée ») : ses gels ne se
   reproduisent pas.

## Le départ d'une série, au banc

`reproductions/depart-d-une-serie.ts` : un joueur de 9 000 réponses, la base
livrée, le faux Turso à 30 ms, le modèle ajusté ; il part sur toutes les
catégories, sur une, sur deux puis trois jamais prises, sur un sujet, et en
laisse chaque fois une en route.

| Le départ d'une série | Processeur, médiane / pire | Temps, médiane / pire | Gels |
|---|---|---|---|
| Sur un vrai cœur, sous le profileur | 55 à 73 / 86 ms | 86 à 193 ms | aucun |
| Au dixième de cœur, enchaînés | 23 à 32 / 65 ms | 158 à 293 / 525 ms | aucun |
| Au dixième de cœur, le premier départ après douze minutes de calme | 47 ms | 369 ms | aucun |

Le profileur ne trouve aucun bloc qui approche les 457 ms de processeur du gel
du 21 à 20 h 11 : le tirage (4 ms par départ), ce qu'il a vu (3 ms), la liste
d'un choix (2 ms). La production en est loin : sa médiane, 279 ms, est celle
du banc bridé, mais un départ sur vingt y gèle. Ce qui coïncidait : le premier
départ après dix à trente minutes sans une requête (le 18 à 10 h 17, le 21 à
20 h 11, le 22 à 21 h 53), et, dans certains, le ramasse-miettes (306 ms le 17
à 9 h 26, 282 le 19 à 10 h 05). Le calme seul ne le reproduit pas au banc.
Ses étapes nommées, le relevé dira laquelle.

## Ce qui reste

1. **Le réveil** — à la demande, plus tard.
2. **Le départ d'une série**, une fois que la production aura nommé l'étape.
3. **La correction d'une question au QG** refait la base dans un bloc de 99 à
   136 ms sur un vrai cœur (sous le profileur, au banc de la correction) : sur
   la route de l'administrateur, rare (onze fois en huit jours), sans gel relevé
   en production.
4. Hors du code : la base de Turso est en Irlande, le serveur à Francfort
   (`../2026-10-14/synthese.md`) ; l'offre payante de l'hébergeur supprimerait
   les réveils et le dixième de cœur — des décisions du propriétaire.

## Le relancer

```bash
cd server && npx tsx scripts/bilan-de-la-production.ts 192
cd server && SERIES=600 PROFIL=1 node --single-threaded-gc --no-memory-reducer --max-old-space-size=320 --import tsx ../retours/2026-11-24/reproductions/depart-d-une-serie.ts 3
cd server && GEL=1 SERIES=600 REPOS=12 node --single-threaded-gc --no-memory-reducer --max-old-space-size=320 --import tsx ../retours/2026-11-24/reproductions/depart-d-une-serie.ts 1
cd server && PROFIL=1 node --single-threaded-gc --no-memory-reducer --max-old-space-size=320 --import tsx ../retours/2026-11-08/reproductions/correction-au-qg.ts 3
```

Le bilan lit `PROD_LECTURE_URL` et `PROD_LECTURE_TOKEN` — jamais `QUIZ_DB_URL`.
`GEL=1` demande d'être root (cgroup v1).
