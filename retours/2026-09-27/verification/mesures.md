# Contre-expertise du groupe `mesures` : tests, perf-serveur, parcours-profil

J'ai relu trois rapports sur `main` (b57035c) :

- `tests`, 7 constats ;
- `perf-serveur`, 6 constats ;
- `parcours-profil`, 11 constats.

J'ai relancé toutes les reproductions qui portent un P1 ou un P2, un fichier à la fois sous `nice -n 10`. J'ai aussi écrit les miennes, dans `export/evaluations/verification/mesures/` :

- une horloge décalée écrite à part, pour ne pas vérifier l'outil de l'expert avec lui-même ;
- les bornes des saisons ;
- trois mutants rejoués dans une copie tirée par `git archive` ;
- la mesure du quiz du jour à l'échelle d'un serveur d'amis.

Les sorties sont dans `mesures/resultats.txt`. Le rapport `perf-client` n'existait pas encore quand j'ai fini.

## En bref

- **Aucun constat réfuté.** Les chemins de code sont ceux que les experts décrivent, et chaque reproduction relancée échoue pour la raison annoncée.
- **Le calendrier (tests-1) tient, au jour près.**
  - J'ai rejoué `cloture.test.ts` avec ma propre horloge :
    - le 24 octobre à 23 h 30 (heure de Paris), il passe ;
    - le 25 octobre à 0 h 30, il échoue (`+ 'lg:citrouille'`).
  - `soiree.test.ts` échoue le 2 janvier à 23 h 30 (« saison:nouvel-an : 2 lauréats »). Il passe le 3 janvier à 0 h 30.
  - Le calendrier pur compte 19 jours.
  - J'ai relu le smoke : il est insensible aux saisons. Il n'affirme rien sur les légendaires, et les lignes `saison:` sont exclues des badges et de la vitrine (`auth/profiles.ts:773` et `:1579`).
  - **La CI de toute PR rougit dès le samedi 24 octobre 2026 à 22 h UTC**, c'est-à-dire minuit à Paris. La correction doit arriver avant.
- **Perf-serveur : les comptes sont justes, mais l'échelle est gonflée.**
  - Les quatre reproductions redonnent 613, 603, 6 248 et 20, au compte près.
  - Le scénario n'est pas celui d'un serveur d'amis : 500 joueurs au quiz du jour la veille, avec 50 à 80 ms par aller-retour. Render est à Francfort, Turso « en Europe » (MISE-EN-LIGNE.md:48, :70), et le code dit lui-même « quelques dizaines de millisecondes » (`distante.ts:15`).
  - Avec ses propres outils, à 25 ms : la première visite du matin prend **1,5 s à 30 joueurs** et **2,1 s à 100 joueurs**, pas 12 s. L'abandon à 20 s demanderait environ 1 700 joueurs par jour à 25 ms.
  - J'abaisse donc perf-serveur-1 et perf-serveur-2 en P3. Les corrections restent bonnes et bon marché.
  - Le vrai poids de perf-serveur-2 est ailleurs : la correction touche le même code que le bug de données jour-regles-2 / concurrence-3 (P2), et un seul correctif ferme les trois.
- **Une correction proposée est à reprendre** (perf-serveur-5). Si l'on passe à `recompter` le tirage lu au début de l'annulation, deux annulations croisées peuvent repayer la première question annulée. Relu sous le verrou de chaque profil, le tirage ne le permet pas.
- **Deux doublons** :
  - perf-serveur-6 = exploitation-7 (les mêmes 60 allers-retours au démarrage) ;
  - parcours-profil-8 = le reste non fait de PR-4 / lien 6 (`retours/2026-09-24/verification/parcours.md:280`, `:371`).
- **Deux tensions**, bien posées par l'expert : parcours-profil-9 et parcours-profil-10.
- **Cinq gravités abaissées de P2 à P3** : tests-2, perf-serveur-1, perf-serveur-2, parcours-profil-1 et -2.
  - Pour tests-2 : aucun défaut n'existe aujourd'hui, c'est un trou dans le filet.
  - Pour les deux constats de perf : l'échelle.
  - Pour les deux constats de parcours : ce sont des invitations qui manquent, rien ne casse.
  - parcours-profil-3 garde son P2 : un bouton y ment à quelqu'un qui arrive pour la première fois.

| Constat | Annoncée | Verdict | Retenue | En une ligne |
|---|---|---|---|---|
| tests-1 · la suite échoue 19 jours par an | P2 | **confirmé** | P2 | Rejoué deux fois, avec deux horloges différentes. Rouge dès le 24/10 à 22 h UTC, vert le 24/10 à 23 h 30 Paris et le 3/1 ; le smoke est épargné |
| tests-2 · 17 routes d'admin sans épreuve de refus | P2 | **confirmé, gravité revue** | P3 | M13 rejoué : il survit à jour-partie (12/12) et à laurier, et `admin-seulement` le tue. Aucune faille aujourd'hui : c'est un durcissement. Mieux : un garde unique sur le préfixe `/api/admin` |
| tests-3 · un deuxième seul au podium du jour | P3 | **confirmé** | P3 | M04 rejoué : il survit à jour-paliers et à sphinx, et `trous-du-jour` ① le tue. Dans le test du laurier, Carole est bien troisième, hors podium |
| tests-4 · saisons : seuil, minuit, partie commencée | P3 | **confirmé** | P3 | Lu : `saisons.test.ts:108-118` ne finit jamais une partie avec deux jours seulement. `trous-du-jour` ②③ est vert aujourd'hui |
| tests-5 · chemins du quiz du jour jamais parcourus | P3 | **confirmé** | P3 | `grep` : aucune épreuve n'appelle `mois=`, `prochaines`, `garder`, `retirer` ni le démasquage. La couverture de l'expert concorde |
| tests-6 · assertion sous `if` dans hasard.test.ts | P3 | **confirmé** | P3 | M17 rejoué : hasard.test.ts passe (9/9), echange.test.ts le tue |
| tests-7 · seuils des écussons non épinglés | P3 | **confirmé** | P3 | Lu : `ecussons.test.ts:16` relit `SEUILS_ECUSSON`. Mineur |
| perf-serveur-1 · le réveil charge les joueurs d'hier un par un | P2 | **confirmé, gravité revue** | P3 | Rejoué : 613 A/R. Le mécanisme est linéaire, mais le premier matin coûte 1,5 s à 30 joueurs et 2,1 s à 100, à 25 ms. Le scénario à 500 joueurs et 80 ms est une hypothèse de croissance |
| perf-serveur-2 · chaque réponse périme le classement d'hier | P2 | **confirmé, gravité revue** | P3 | Rejoué : 20 relectures pour 10 « suivante ». Cela fait 60 lignes par geste à 30 joueurs. À corriger d'un seul coup avec jour-regles-2 / concurrence-3 |
| perf-serveur-3 · l'accueil lit les points de tout le monde sur 30 jours | P3 | **confirmé** | P3 | Rejoué : 6 248 lignes, et 1 206 lignes à 30 joueurs par jour |
| perf-serveur-4 · 154 allers-retours en série par partie | P3 | **confirmé** | P3 | Lu : c'est cohérent. Environ 0,35 s par question à 25 ms, que le temps de lecture offert absorbe (≥ 1 s) |
| perf-serveur-5 · « Annuler pour tous » à 500 joueurs | P3 | **confirmé** | P3 | Lu. À 30 joueurs, l'annulation prend moins d'une seconde. **La piste « passer le tirage à `recompter` » ouvre une course** entre deux annulations |
| perf-serveur-6 · 60 allers-retours au démarrage | P3 | **doublon** | P3 | exploitation-7, avec le même compte (60 ; 54 avant #58) |
| parcours-profil-1 · la soirée ne parle pas du quiz du jour | P2 | **confirmé, gravité revue** | P3 | `FinDeSoiree.tsx` et `shared/fin.ts` : ni « jour » ni série. C'est une invitation qui manque ; rien n'est cassé |
| parcours-profil-2 · pas de rendez-vous, laurier jamais annoncé | P2 | **confirmé, gravité revue** | P3 | `JourApp.tsx` n'emploie « laurier » que dans `NomLaure`, et sa seule ligne vers demain est à l'l. 532 |
| parcours-profil-3 · `/jour` anonyme : « Me connecter à mon profil » | P2 | **confirmé** | P2 | `JourApp.tsx:180-195` et `ProfilApp.tsx:183-187`. Le chemin d'arrivée d'un nouveau venu passe par un bouton qui lui ment. Une correction à deux paramètres existe (`?creer=1` y est déjà) |
| parcours-profil-4 · « 3ᵉ place sur 3 · 0 pt » | P3 | **confirmé** | P3 | `JourApp.tsx:609` montre le rang dès que `rang > 0`, contre `shared/course.ts:11-13` |
| parcours-profil-5 · la carte ne s'ouvre qu'en soirée | P3 | **confirmé** | P3 | Route `/s/:slug/joueurs/:id.json` → `carteDe(playerId)`, qui ne connaît que la soirée en cours |
| parcours-profil-6 · la série ne s'explique pas | P3 | **confirmé** | P3 | `shared/glossaire.ts` n'a pas d'entrée « série » |
| parcours-profil-7 · rattacher son profil : tout retaper | P3 | **confirmé** | P3 | `AccountApp.tsx:233-238`. La piste « un seul mot de passe » touche l'invariant 16 : à arbitrer |
| parcours-profil-8 · pas de retour au profil depuis le souvenir | P3 | **doublon** | P3 | Le reste de PR-4 / lien 6 du 24 septembre : « Mon bilan » sur soi est fait, le lien « Mon profil » dans `SpaceNav` non |
| parcours-profil-9 · classement du jour inter-espaces | P3 | **tension** | P3 | RECOMPENSES §5.13 (« tout le serveur ») contre README:613. Invariant 3 non touché : un profil est une personne, pas un espace |
| parcours-profil-10 · le laurier en soirée, face à l'anonyme | P3 | **tension** | P3 | RECOMPENSES §5.13 l'a voulu (« jusque dans les soirées ») ; parti pris n° 1 |
| parcours-profil-11 · deux listes au lieu d'un fil | P3 | **confirmé** (idée) | P3 | `ProfilApp.tsx:315-359` : c'est exact |

---

## tests

### tests-1 · La suite échoue du 25 octobre au 2 janvier — confirmé, P2

**Rejoué deux fois.**

1. **La reproduction de l'expert**, `calendrier.test.ts` : Halloween et Noël échouent, le témoin du 2 novembre passe.
   - Sa limite : le témoin ne rejoue que `soiree.test.ts`. Rien ne montrait que `cloture.test.ts` passe sous l'horloge décalée hors saison.
2. **Ma propre reproduction**, `mesures/bornes-saisons.test.ts`, avec une horloge écrite à part (`mesures/horloge.mjs`). Elle comble ce trou :

| Instant (Paris) | Épreuve | Résultat |
|---|---|---|
| 24 oct. 23 h 30 | clôture | **passe** : la même épreuve, sous la même horloge décalée, hors saison |
| 25 oct. 0 h 30 | clôture | **échoue** : `0: 'lg:chouette', 1: 'lg:citrouille'` |
| 2 janv. 23 h 30 | prix | **échoue** : `« saison:nouvel-an » : 2 lauréats pour une seule soirée` |
| 3 janv. 0 h 30 | prix | **passe** |

Autres vérifications :

- Le calendrier pur (`periodeDu`, de jour en jour sur une année) compte **19 jours**, du 2026-10-25 au 2027-01-02.
- Témoin de plus : `legendaires.test.ts` passe le 24 décembre (4/4).

**Le chemin du code.** Rien ne vient contredire le constat :

- La soirée se date à la première réponse du journal (`core/saisons.ts:26-28`), écrite à l'horloge de la machine.
- `jourDe` lit l'heure de Paris par `Intl` (`shared/jour.ts:85-99`), quel que soit le fuseau de la CI.
- La clôture appelle `laureatsDeSaison` (`core/space.ts:893`), et les deux épreuves comptent au plus juste :
  - `cloture.test.ts:207` : `legendaires` égal à `['lg:chouette']` ;
  - `soiree.test.ts:488-497` : un lauréat par ligne de `profile_badges` hors `hf:`. Or une ligne `saison:` va à **chaque** profil.
- `saisons.test.ts:169-174` le dit en toutes lettres : « le serveur ne se règle pas sur une autre horloge que la sienne ».

**Les autres fichiers.**

- **Le smoke**, que l'expert n'avait pas lancé et que je n'ai pas lancé non plus : je l'ai lu.
  - Il ne contient aucune assertion sur `legendaires`.
  - `badges === vitrine.length` et `vitrine.every(b => b.fois === 1)` excluent `saison:` (`auth/profiles.ts:773`, `:1579`).
  - Il est donc insensible aux saisons.
- **`exploitation.test.ts` et `securite.test.ts`** ne closent aucune soirée à profil.
- **Les 18 autres fichiers** passent le 31 octobre dans le balayage de l'expert (`tests/sorties/halloween-*.txt`).

**La réalité.**

- C'est certain et déterministe : toute PR, et chaque poussée sur `main`, à partir du **samedi 24 octobre 2026 à 22 h UTC**.
- « La préproduction attend » n'est pas établi. `render.yaml:125` dit `autoDeploy: true`, sans condition de CI, mais c'est le tableau de bord qui fait foi.
- La gravité P2 tient : c'est le filet de toute l'équipe, pendant 19 jours, et la tentation sera de retirer l'assertion.

**Correction.** Celle de l'expert me convient :

- un calendrier des soirées qu'on ferme dans `banc.ts`, comme `ProfileStore.tirageEclat` ;
- rouvert en tête de `saisons.test.ts`, et de `trous-du-jour.test.ts` s'il est versé : son épreuve ③ appelle `laureatsDeSaison`.

Deux précisions :

- Le fermer dans `smoke.ts` n'est pas nécessaire (voir plus haut), mais ne coûte rien.
- Indépendamment, la requête de `soiree.test.ts:490` devrait écarter `saison:%` comme elle écarte `hf:%` : une saison n'est pas un prix, et chaque profil la reçoit.

Il faut fusionner avant le 24 octobre.

### tests-2 · 17 routes d'admin sans épreuve de refus — confirmé, gravité revue P3

**Rejoué** (`mesures/mutant.sh`, dans une copie tirée par `git archive b57035c`, jamais dans le dépôt) : on retire `requireAdmin` de `/api/admin/jour/masquer` (M13).

| Épreuve | Résultat |
|---|---|
| `jour-partie.test.ts` | survit (12/12) |
| `laurier.test.ts` | survit (1/1) |
| `admin-seulement.test.ts` | **tué** |

- Sur le code d'aujourd'hui, `admin-seulement` est vert et trouve 19 routes.
- Le compte `grep` est juste : 7 routes dans `auth/routes.ts`, 3 dans `partages.ts`, 9 dans `quizDuJour.ts`.
- Le seul refus d'un animateur ordinaire éprouvé est dans `partage.test.ts:130` et `:134`.

**Pourquoi P3.** Chaque garde est là, et rien n'est exploitable aujourd'hui. C'est une dette du filet, qui devient une faille P1 le jour où une route en oublie un.

**Meilleure correction : rendre l'oubli impossible, pas seulement visible.**

- Les 19 routes posent chacune leur garde, derrière `app.use('/api', requireAccount)` (`api.ts:96`).
- Un garde posé une fois sur le préfixe suffit, en tête de `mountApi`, avant `mountAuthApi` (`api.ts:78`) :
  ```ts
  // Tout ce qui vit sous /api/admin est à l'administrateur : une route neuve ne peut plus oublier son garde.
  app.use('/api/admin', requireAccount(deps.auth), requireAdmin)
  ```
- Garder aussi `admin-seulement.test.ts`, qui reste utile pour une route d'admin hors du préfixe.
- Ce test repose sur des détails internes d'Express 4 (`application.handle`, `_router`). Le jour d'Express 5, il échouera bruyamment (`routes.length >= 19`), pas en silence : acceptable.

### tests-3 à tests-7 (P3, nature `test`)

**tests-3 · confirmé.**

- M04 rejoué : il survit à `jour-paliers` (3/3) et à `sphinx` (2/2), et `trous-du-jour` ① le tue.
- Le message de `laurier.test.ts:92` est faux :
  - Alice et Bob font dix sur dix, ex æquo (`:72-75`) ;
  - Carole est troisième sur trois ;
  - `xpDuPodium(3, 3)` vaut 0 : Carole n'a donc pas de ligne `jour_podiums`, et `rang <= 2` ne change rien pour elle.

**tests-4 · confirmé à la lecture.**

- `saisons.test.ts:108-118` écrit deux jours puis joue le troisième. Aucune partie ne se finit avec deux jours seulement, donc M10 ne peut pas se voir.
- `trous-du-jour` ②③ est vert aujourd'hui. Je n'ai pas rejoué M09 et M10.

**tests-5 · confirmé.**

- Aucune épreuve n'appelle `mois=`, `/prochaines`, `/garder` ou `/retirer`, ni `masque: false` (`grep` à zéro).
- Les lignes non couvertes de `couverture-nouveaux.txt` concordent.

**tests-6 · confirmé.**

- M17 rejoué : `hasard.test.ts` passe (9/9), `echange.test.ts` échoue quatre fois.
- La ligne `hasard.test.ts:138` est bien sous `if`.

**tests-7 · confirmé, mineur.**

- `ecussons.test.ts:16` construit ses attentes à partir de `SEUILS_ECUSSON`.
- Épingler une constante de produit est un choix, que le dépôt fait déjà pour le podium du jour (`jour.test.ts:48`).

---

## perf-serveur

### Ce que comptent les chiffres, et à quelle latence

- **Le compteur est honnête.**
  - Il enveloppe `Sqlite3Client.execute` et `.batch`, soit une requête chacun.
  - En production, `libsql://` passe par le client HTTP, lui aussi à une requête par appel (`distante.ts:36-43`).
  - Les allers-retours, les lignes et les appelants sont des comptes. Je les ai retrouvés à l'identique.
- **Les durées sont des estimations.**
  - Elles valent le nombre d'allers-retours en série multiplié par une latence fixe.
  - 50 ms est plausible mais pessimiste, pour Render à Francfort vers un Turso « en Europe ». 80 ms est la queue haute.
  - Le code lui-même compte sur « quelques dizaines de millisecondes » (`distante.ts:15`).
  - Personne n'a mesuré le vrai Turso. Je ne l'ai pas pu non plus.
- **Le scénario n'est pas celui d'un serveur d'amis.**
  - La veille compte 500 joueurs, et 200 par jour avant.
  - L'application se dit « entre amis » (README l. 1). Le calibrage joue des « bandes d'amis ». `PROFILS_EN_VOL` (`jour.ts:109-116`) a été réglé pour « cinquante joueurs ».
  - L'expert le reconnaît dans ses limites (« hypothèse de croissance ; à 50 joueurs par jour, divisez par 4 à 10 »). Mais ses gravités et son « En bref » reposent sur les 500.

**J'ai remesuré avec ses propres outils** (`mesures/echelle.test.ts`, qui réutilise `compteur.ts` et `peupler.ts`, à 25 ms, charge 1,9) :

| Joueurs la veille (et par jour) | 1re visite du jour : la veille à clore, serveur froid | Réveil en journée : veille close, mémoire vide | `GET /api/joueur/moi` |
|---|---|---|---|
| 30 | 133 A/R, ≈ 59 en série, **1,5 s** | 103 A/R, ≈ 19, 0,48 s | 7 A/R, 1 206 lignes |
| 100 | 343 A/R, ≈ 86, **2,1 s** | 313 A/R, ≈ 33, 0,81 s | 7 A/R, 3 289 lignes |
| 500 | 1 543 A/R, ≈ 244, **6,1 s** | 1 513 A/R, ≈ 112, 2,8 s | 7 A/R, 15 286 lignes |

Le compte à 500 joueurs (1 543) est exactement celui de l'expert. Son « 12 s » est le même compte à 50 ms.

### perf-serveur-1 · Le réveil charge les joueurs d'hier un par un — confirmé, gravité revue P3

**Rejoué** : `reproductions.test.ts` ① donne 613 allers-retours, dont 200 `SELECT * FROM profiles WHERE id = ?`.

**Le chemin est exact.**

- `joueursDu` passe par `parLots(…, 8, byId)` (`jour.ts:873-889`).
- `byId`, puis `remember`, enchaînent trois allers-retours en série (`profiles.ts:539-544`, `:1864-1870`).
- `carriereDe` attend `clorePasses` (`jour.ts:1060-1061`), qui prend le verrou `#nuit` (`:1190`). L'accueil d'un profil attend donc bien le matin.
- **Nuance** : après un réveil en journée, la veille déjà close, `clorePasses` ne coûte que deux allers-retours (`:1188-1203`, `lireLauriers` sans `joueursDu`). L'accueil n'attend pas ; seul `/api/jour` recharge la salle d'hier (`vueDe`).

**Pourquoi P3.**

- À l'échelle probable (30 à 100 joueurs du quiz du jour), le premier matin coûte 1,5 à 2,1 s à 25 ms, et un réveil en journée moins d'une seconde.
- L'abandon du client à 20 s demande environ 1 700 joueurs la veille à 25 ms, ou 700 à 80 ms.
- Le mécanisme est linéaire et mérite sa correction. Mais il ne gâche la matinée de personne aujourd'hui.

**Sur la correction** (`byIds` par paquets de 400) :

- **Bonne, mais elle ne suffit pas à petite échelle.** À 30 joueurs, le chargement ne fait que ≈ 12 des ≈ 59 allers-retours en série. Le reste, c'est le podium payé marche par marche, sous verrou : `ecrireXp`, `recalculerTotal`, `statsDuJour`, `accorderPaliersDuJour`, `ecrireXpDesPaliers` (`mesures/resultats.txt` § 5). Payer les trois marches dans un seul lot ferait gagner davantage que `byIds` sur un petit serveur.
- **Un détail à régler dans `byIds`.** Après l'`await`, il ne faut pas ranger un profil qui est entre-temps arrivé en mémoire par un autre chemin. Sinon, une ligne lue avant un renommage remplace l'objet que `Object.assign` venait de mettre à jour. La même course existe déjà entre deux `byId`, mais un paquet de 400 l'élargit.

### perf-serveur-2 · Chaque réponse périme le classement figé d'hier — confirmé, gravité revue P3

**Rejoué** : ④ donne 20 relectures pour 10 « Question suivante », soit 4 000 lignes à 200 joueurs.

**La cause est double.**

- Une seule `revision` sert pour tous les jours (`jour.ts:200`).
- Dans `vueDe`, `vainqueursDe` et `sonJour` appellent `joueursDu(hier)` en parallèle (`:783-787`), sans partager la lecture en cours.

**Pourquoi P3 pour la perf.**

- À 30 joueurs, cela fait un aller-retour de plus en série et 60 lignes par geste.
- L'extrapolation « deux tiers du dixième de cœur » suppose 200 parties dans la même heure. L'expert la donne pour une estimation.
- Les CPU mesurés (−42 %) sont une borne haute, SQLite tournant dans le processus. Je ne les ai pas rejoués.

**Ce qui compte vraiment.** C'est la même ligne que jour-regles-2 et concurrence-3 (P2 données) : un classement rangé sous une révision lue **après** les `await`, sur lequel la nuit paie le podium.

- Une révision par jour, **lue avant la lecture**, plus la lecture partagée, ferme les trois.
- À faire dans le même commit que le correctif de données, avec leurs deux reproductions et l'épreuve ④ comme tests.
- `clore` doit lire la base, pas le cache (pistes de jour-regles-2 et concurrence-3).

### perf-serveur-3 · L'accueil lit les points de tous sur 30 jours — confirmé, P3

- **Rejoué** : 6 248 lignes, dont 6 176 par `joursJoues` (`jour.ts:1112`).
- À 30 joueurs par jour, cela fait 1 206 lignes par visite. On reste loin de tout quota gratuit, mais c'est du décodage pour rien.
- L'expert écarte à raison `RANK() OVER` : ce serait une seconde règle des ex æquo (invariant 15).

### perf-serveur-4 · 154 allers-retours en série par partie — confirmé (lecture), P3

C'est cohérent avec `repondre` (`jour.ts:646-667`) et `suivante` (`:624-637`). Je n'ai pas rejoué `routes.test.ts`.

Une précision que le rapport n'a pas :

- `servie_le` est posé avant le `partieDe` et le `vueDe` qui suivent (`:631-636`), soit six ou sept allers-retours avant que la question parte. De même, `repondre` lit l'heure après deux allers-retours.
- Ce temps est donc **pris sur le chrono du joueur** : environ 0,2 s à 25 ms.
- Il reste absorbé par le temps de lecture offert (`LECTURE_MS` ≥ 1 s, `quiz.ts:159` et `:187-190`). Ce n'est pas une iniquité, mais c'est une raison de plus de raccourcir `suivante`.

### perf-serveur-5 · « Annuler pour tous » à 500 joueurs — confirmé (lecture), P3 ; correction à reprendre

- Le chemin est exact (`jour.ts:1384-1440`). À l'échelle d'un serveur d'amis (30 joueurs), l'annulation tient en moins d'une seconde.
- **La piste « passer le tirage à `recompter` au lieu de le relire » ouvre une course.** Scénario :
  1. deux annulations A puis B croisent leurs `parLots` ;
  2. pour un même profil, le recompte de B (qui écarte a et b) passe sous son verrou **avant** celui de A (qui n'écarte que a, avec le tirage passé) ;
  3. la question b redevient payée.
- Relu sous le verrou de chaque profil, comme aujourd’hui (`:1417`), le tirage donne toujours la dernière liste.
- **Correction** : garder la lecture sous le verrou, mais la rendre gratuite, avec un tirage gardé en mémoire et invalidé sous `#tirage` par `annuler` (la piste de perf-serveur-4) ; puis fondre `recompter` et `ecrireXp` en un lot.
- Recoupe en partie jour-regles-11 (annulation sans retour, cache non invalidé à mi-chemin).

### perf-serveur-6 · 60 allers-retours au démarrage — doublon

C'est exploitation-7 : même mesure, même compte (60 ; 54 avant #58 ; 24 `PRAGMA table_info`), même piste.

---

## parcours-profil

Les trois P2 relus dans le code, et les captures regardées (`002-a02`, `018-j08`).

### parcours-profil-3 · `/jour` anonyme : « Me connecter à mon profil » — confirmé, P2

**Le code.**

- `JourApp.tsx:180-195` : un seul lien, `href="/"`, dont le libellé dit « Me connecter à mon profil ».
- `ProfilApp.tsx:183-187` : `onDone` relit le profil et reste sur l'accueil.
- `PITCH_PROFIL` (`shared/profil.ts:761`) ne parle pas du quiz du jour.

**Ce que l'expert compte.** « 8 touchers et 2 saisies » : les deux saisies sont le prénom et le mot de passe, pas le lien. Il n'y a pas à retaper l'adresse : la `CarteDuJour` de l'accueil (`ProfilApp.tsx:262`, `Jour.tsx:117`) ramène à `/jour`. Le détour est réel, mais il ne perd rien.

**Pourquoi P2.**

- C'est la porte d'arrivée d'un jeu quotidien : le lien qu'un ami envoie.
- Le bouton annonce une connexion à quelqu'un qui n'a pas de profil.

**La correction est petite.**

- `?creer=1` existe déjà (`lireCreation`, `ProfilApp.tsx:536-545`).
- Il reste à lire `next` avec `pageDeRetour` (`shared/securite.ts:20`), **avec `'/'` pour repli**. Le repli par défaut est `/host`, qui n'a rien à faire ici.

**Les partis pris.** La phrase de l'accueil anonyme est une invitation à l'endroit même où l'on crée un profil, pas un manque montré en soirée. Elle est compatible avec « un anonyme n'y voit rien qui lui manque » : je suis l'expert.

### parcours-profil-1 et -2 · La soirée et la partie ne donnent pas rendez-vous — confirmés, gravité revue P3

**Le code.**

- `FinDeSoiree.tsx` ne dit « jour » nulle part (seules les lignes 136 et 355 contiennent « serie » ou « jour », et pas en ce sens). `shared/fin.ts` ne porte aucune série.
- `JourApp.tsx` n'emploie « laurier » que dans `NomLaure` (l. 712). Sa seule ligne vers demain est à la l. 532.

**Pourquoi P3.**

- Ce sont des invitations qui manquent, des idées de fidélisation : rien ne casse, ni rien ne trompe.
- La porte prévue du quiz du jour, la carte sous « Ce soir » (RECOMPENSES §5.13), existe.

**La garde.** Pour -1, la mention n'irait que dans le bloc du profil, au téléphone, jamais dans la clôture de la salle (`soiree:cloture`). Sinon, l'écran commun montrerait à l'anonyme un jeu qui lui est fermé (parti pris n° 1).

### Les P3, d'un coup d'œil

| Constat | Verdict |
|---|---|
| -4 | Exact : `JourApp.tsx:609` montre `place(rang) sur joueurs` dès que `rang > 0`, points nuls compris. `shared/course.ts:11-13` l'interdit en soirée. La capture montre « 3ᵉ place sur 3 · 0 pt » |
| -5 | Exact : `server.ts:614` → `space.carteDe(playerId)` (`space.ts:598`), qui ne connaît que les invités de la soirée en cours |
| -6 | Exact : pas d'entrée « série » dans `shared/glossaire.ts` |
| -7 | Exact : `AccountApp.tsx:233-238`. La piste « ne redemander que le mot de passe du profil » touche l'invariant 16 (« il faut prouver les deux identités »). Une session d'animateur ouverte peut valoir la seconde preuve : à arbitrer, comme l'expert le dit |
| -8 | **Doublon** : le reste de PR-4 / lien 6 (`retours/2026-09-24/verification/parcours.md:280`, `:371`). « Mon bilan » sur soi est fait ; « Mon profil » dans `SpaceNav` (`SpaceNav.tsx:45-62`) ne l'est pas |
| -9 | **Tension** bien posée : RECOMPENSES §5.13 veut « tout le serveur », README:613 écarte le « classement public entre espaces ». L'invariant 3 n'est pas touché : un profil est une personne (invariant 16), et le classement se lit avec un profil (`quizDuJour.ts:77-84`) |
| -10 | **Tension** bien posée : le laurier « jusque dans les soirées » est voulu (RECOMPENSES §5.13) ; parti pris n° 1 |
| -11 | Idée, exacte (`ProfilApp.tsx:315-359`) |

---

## Hors mission, vu en chemin

`ProfilApp.tsx:97-99` : `relire().catch(() => setProfil(null))`. Tout échec de `GET /api/joueur/moi` (délai, 500, base muette) montre l'accueil d'un anonyme à un profil connecté. perf-serveur l'a signalé hors mission ; je le confirme à la lecture.

Il est distinct de client-9 (la déconnexion, `ProfilApp.tsx:376-379`). `JourApp` distingue déjà `UnauthorizedError`.

## Méthode

**Fichiers lus.**

- Les consignes, les trois fiches, les trois rapports et leurs JSON, et les JSON des autres rapports pour les doublons.
- `verification/jour.json` et `soiree.md`, `retours/2026-09-24/verification/parcours.md` et `perf.md`.
- Côté serveur : `core/saisons.ts`, `shared/saisons.ts`, `shared/jour.ts`, `core/jour.ts` (tirage, partie, classement, carrière, nuit, annulation), `auth/profiles.ts` (`byId`, `remember`, `recompterRecompenses`, badges), `auth/http.ts`, `api.ts`, `quizDuJour.ts`, `distante.ts`.
- Les tests : `cloture`, `soiree`, `saisons`, `laurier`, `hasard`, `ecussons` et `carte`, ainsi que `scripts/smoke.ts` (§ badges).
- `.github/workflows/ci.yml`, `render.yaml`, MISE-EN-LIGNE.md.
- Côté client : `JourApp.tsx`, `ProfilApp.tsx`, `Jour.tsx`, `FinDeSoiree.tsx`, `SpaceNav.tsx`, `AccountApp.tsx`, `api.ts`.

**Scripts** (dans `export/evaluations/verification/mesures/`) :

| Fichier | Rôle |
|---|---|
| `horloge.mjs` | l'horloge décalée, écrite à part |
| `bornes-saisons.test.ts` | le calendrier pur, et quatre instants aux bornes |
| `mutant.sh` | rejoue un mutant dans une copie `git archive`, retirée ensuite, puis vérifie la restauration |
| `echelle.test.ts` et `echelle.json` | le quiz du jour à 30, 100 et 500 joueurs, à 25 ms |
| `resultats.txt` | les sorties |

**Relancé.**

- `tests/calendrier.test.ts`, `tests/admin-seulement.test.ts`, `tests/trous-du-jour.test.ts` ;
- `perf-serveur/reproductions.test.ts` ;
- `legendaires.test.ts` à Noël ;
- les mutants M13, M04 et M17.

**Pas relancé.**

- Le smoke : il est interdit, je l'ai lu.
- `cpu.test.ts`, `routes.test.ts`, `annulation.test.ts`.
- La couverture.
- Les parcours en navigateur : je me suis appuyé sur le code et les captures.

**Laissé derrière moi.** Aucun fichier suivi par git n'a été modifié (`git status` est vide), et aucun processus ne reste allumé.
