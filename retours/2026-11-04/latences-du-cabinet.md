# Les latences du Cabinet, le 4 novembre 2026

La question du propriétaire, le QG 2 en production depuis 11 h 46 (`0853e99`) :
« les joueurs ont des latences, notamment sur le Cabinet des curiosités alors
qu'elle est seule à jouer ».

**En bref** : ce n'est pas le QG. La production gèle au même rythme qu'avant son
déploiement, et le QG fermé ne coûte rien à une requête de joueur. La joueuse a
subi trois choses, toutes d'avant lui : des gels de la boucle pendant ses
gestes de traversée, un embouteillage de huit secondes à 13 h, et des
connexions neuves vers Turso à ~0,45 s chacune. Le QG consulté pendant qu'elle
jouait se partageait avec elle le dixième de cœur. Ce qui a été fait le même
jour, plus bas : nommer pour la sonde des gels ce qui tournait sans nom, tenir
à jour ce qu'elle a vu au lieu de le refaire à chaque épreuve (−59 % du
processeur d'une entrée au banc), et la patience des connexions, à essayer en
préproduction (`QUIZ_DB_PATIENCE_MS`).

## Ce que la production a dit

En lecture seule (`reproductions/lecture-de-la-production.ts`, le jeton de
lecture, des totaux sans un nom) et par `/healthz`, relevé toutes les vingt
secondes de 13 h 16 à 13 h 47.

Ce qu'elle a vécu, de 13 h à 13 h 36 :

| Route | Appels | Médiane | 95ᵉ centile | Pire |
|---|---|---|---|---|
| `POST /api/cabinet/partie/:id/geste` | 73 | 64 ms | 574 ms | **8 s** |
| `POST /api/cabinet/traversee/:id/geste` | 16 | 107 ms | 1,6 s | 1,6 s |
| `GET /api/joueur/missions` | 8 | 380 ms | 3,2 s | 3,2 s |

Les gels de l'heure (la sonde, `core/gels.ts`) :

- **12:59:59 → 13:00:01, 1,8 s « sans rien de nommé »** — 280 ms de processeur,
  dont 187 de ramasse-miettes. Dans la même tranche de cinq minutes : un
  aller-retour Turso mesuré à 7,6 s, le geste de 8 s, les missions à 3,2 s, et
  une fenêtre de dix secondes où le conteneur a été bridé 79 % du temps. Le QG
  était consulté (son poste se relit toutes les cinq minutes).
- **13:08:01, 1,5 s** sous `POST /api/cabinet/traversee/:id/geste`, 243 ms de
  processeur ; **13:15:16, 0,5 s** sous la même route.

Ces gels de traversée n'ont rien de neuf : le 2 novembre, neuf gels sous la
même route (0,7 à 2,3 s), le 3, cinq pendant le Cabinet, dont quatre de 1,6 à
1,7 s sous elle — alors sous la mesure des difficultés que le geste relançait
toutes les dix minutes (gardée six heures depuis le 3 au soir).

| Jour | Gels (durée) | Pendant le Cabinet | Sans rien de nommé |
|---|---|---|---|
| 2 novembre | 61 (66 s) | 9 (14,5 s) | 1 |
| 3 novembre | 120 (119 s) | 5 (7,2 s) | 1 |
| 4 novembre, jusqu'à 13 h 40 | 48 (48 s) | 5 (4,3 s) | 1 |

Cinq gels par heure éveillée avant le déploiement, cinq après. L'heure de midi,
la plus consultée au QG — le poste en 0,4 à 2,8 s, la réserve en 1,3 s,
l'économie et la fiche d'un joueur en 1,2 s chacune —, a doublé la médiane de
Turso (92 ms contre ~45) et ouvert 238 connexions, le plus haut des quarante
dernières heures. De 13 h 20 à 13 h 36, le QG fermé : aucun gel, le pire geste
à 0,66 s.

Ce qu'une requête de joueur paie au QG 2 : rien de mesurable — son profil se
lit en mémoire (`profilDuJeton`), ses passages s'écrivent par lots toutes les
dix minutes, les règles (chaque minute) et le flux (toutes les deux secondes,
3 à 6 ms) ne figurent dans aucun gel.

Les connexions : une neuve coûte ~480-510 ms en production aujourd'hui, une
gardée ~45 ms. Il s'en ouvrait 1 à 4 par minute pendant qu'elle jouait,
l'entretien allumé — et chaque fois dans une minute où sa page relisait ses
missions (13 h 18, 13 h 22, 13 h 26, 13 h 28, 13 h 32, 13 h 34, 13 h 37,
13 h 41) : au bilan de chaque épreuve (`MissionsDeLEpreuve`), les missions
partent en un lot par magasin, de front avec la carte, quand l'entretien ne
gardait qu'une connexion depuis les manches — il ne retient que le pic de la
dernière minute, et une épreuve en dure une à deux. Les autres gestes lents,
seuls de leur minute (13 h 25, 13 h 35), suivaient une pause de plus d'une
minute : l'entretien s'arrête soixante secondes après la dernière demande
(`CHAUDES_MS`). Sur quatorze jours, 1,4 % des écarts entre deux gestes du
Cabinet d'un même joueur passent la minute (médiane 6,7 s, 95ᵉ centile 40 s).

Les volumes du Cabinet sont modestes : la plus assidue, 13 traversées, 167
parties, 1 336 gestes ; 36 544 réponses de campagne en tout, 9 017 pour le
profil qui en a le plus.

## Ce que le banc a dit

`reproductions/traversee-au-dixieme.ts` : des traversées jouées pour de vrai
par les routes, le faux Turso dehors à 30 ms, le transport léger et le client
minimal, au dixième de cœur (`GEL=1`).

- Profil neuf : une manche 100 à 200 ms, le pire geste 0,8 s, aucun gel. Le
  premier départ d'un processus sans préchauffage, 12,4 s (1,24 s de
  processeur) — le banc coupe le préchauffage au profil, la production non : à
  13 h, son départ a pris 171 ms.
- Avec 9 000 réponses d'histoire (`SERIES=600`) : l'entrée dans une épreuve à
  204 ms en médiane (26 ms de processeur), au pire 796 ms (75 ms). Le
  profileur : refaire ce qu'il a vu (`vuesDe`, puis `vuesDuCabinet`) prenait
  45 % du processeur d'une entrée, le tirage 35 %. Les 243 ms de la production
  ne se reproduisent pas : il y manque une étape, que les noms neufs diront.

`reproductions/connexions-du-bilan.ts` : l'entretien allumé, le faux Turso qui
referme à 5 s et fait payer 450 ms une connexion neuve.

- Au rythme d'une personne, une requête à la fois : 59 requêtes, 2 connexions
  neuves — chacune après une pause de 75 s (500 ms au lieu de ~50).
- Le bilan comme la page le fait, la carte et les missions de front
  (`RAFALE=1`), six secondes entre deux gestes : 40 requêtes, 8 connexions
  neuves — 3 au premier bilan, ses missions en 546 ms au lieu de ~50, puis une
  au détour d'une manche, une autre devant le marchand (499 ms).
- Le même jeu avec 150 ms de patience (`PATIENCE_MS=150`) : aucune connexion
  neuve ; les missions du bilan en 90 à 229 ms (médiane 97), la carte en 93 à
  180 ms.

## Ce qui a été fait, le même jour

1. **Ce qui tournait sans nom se nomme** (`core/gels.ts` : `sousLeNom` pour un
   calcul d'un seul tenant, `pendant` pour une étape qui attend) : les tas du
   Cabinet, lancés derrière une page ou attendus par un départ (« fond · tas du
   Cabinet »), le tour du flux du QG, le relevé du serveur, la tournée du rappel
   du soir, le point du matin, et les étapes lourdes d'une traversée — son
   tirage, la conclusion d'une épreuve, ses trophées, la fin d'une partie
   (« cabinet · … »). Le prochain gel dira laquelle (`gels-nommes.test.ts`). La
   relecture horaire du journal des duels, suspectée d'abord, était déjà nommée.
2. **Ce qu'elle a vu se tient à jour** (`JournalDesReponses.vuesDuCabinetDe`) :
   lu une fois, puis suivi réponse par réponse — chaque valeur est la plus
   récente des vues qui la montrent, une réponse neuve ne fait qu'en monter.
   Au banc profilé, une entrée d'épreuve passe de 9,3 à 3,8 ms de processeur du
   serveur, le ramasse-miettes pendant elles de −35 %
   (`journal-des-reponses.test.ts` la compare à la carte refaite de zéro).
3. **La patience des connexions** (`QUIZ_DB_PATIENCE_MS`, éteinte d'office) :
   un aller-retour sans connexion libre attend, au plus tant de millisecondes,
   qu'une de celles qui servent déjà se libère, plutôt que d'en ouvrir une —
   deux attentes au plus par connexion, rien à attendre à froid
   (`placeSurUneGardee`, `core/transportLeger.ts`, `patience-des-connexions.test.ts`).
   `/healthz` la dit (`base.connexions.patience` : ses attentes, ses lassées).
   À essayer en préproduction avec `150`, la page « Le serveur » du QG ouverte,
   comme chaque réglage des connexions : moins de connexions neuves pendant
   qu'un joueur joue, peu de lassées, aucune erreur de plus.

## Ce qui reste

- **Le gel de 13 h et les 243 ms d'un geste de traversée** : ni l'un ni l'autre
  ne se reproduit au banc. Les noms neufs, une fois en ligne, diront ce qui
  tournait ; sans nom encore, un gel qui n'est presque que du ramasse-miettes
  est un grand ramassage.
- **Le QG consulté pendant une soirée ou une partie** : ses pages lourdes se
  partagent le dixième de cœur avec les joueurs. Ouvert et caché, il ne coûte
  rien ; feuilleté, il se paie.
- **La pause de plus d'une minute** : 1,4 % des gestes du Cabinet paient une
  connexion neuve. Allonger l'entretien les couvrirait, au prix de ses
  battements après le départ du joueur ; rien n'y a été changé.

## Le relancer

```bash
cd server && NODE_USE_ENV_PROXY=1 node --import tsx ../retours/2026-11-04/reproductions/lecture-de-la-production.ts gels 8
cd server && GEL=1 SERIES=600 PROFIL=1 node --single-threaded-gc --no-memory-reducer --max-old-space-size=320 --import tsx ../retours/2026-11-04/reproductions/traversee-au-dixieme.ts 2
cd server && RAFALE=1 PAUSE_MS=6000 LONGUE_PAUSE_MS=0 EPREUVES=4 PATIENCE_MS=150 node --import tsx ../retours/2026-11-04/reproductions/connexions-du-bilan.ts
```

`GEL=1` demande d'être root (`/sys/fs/cgroup/cpu/gel`) ; la lecture de la
production, `PROD_LECTURE_URL` et `PROD_LECTURE_TOKEN` — jamais `QUIZ_DB_URL`.
