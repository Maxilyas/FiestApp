# Le classement au fil du quiz — contre-expertise de performance, 25 septembre 2026

La question de l'animateur : voir son classement au fil du quiz, « sans que
ça dégrade les performances de l'appli ». Un ingénieur performance a mesuré,
indépendamment, l'état d'avant (`1294890`) et la fonctionnalité (`4c87810`) :
le module seul, le vrai moteur avec un faux `io` qui compte les messages, et
une vraie salle de 480 clients socket.io. Son rapport est rangé tel qu'il l'a
rendu ; ses bancs (`perf/…`) vivaient dans son atelier et ne sont pas versés
au dépôt. « Ta place », c'est le premier nom de la ligne de course. Ce qui a
été fait de ses constats est à la fin, « Suite donnée ».

*Contre-expertise indépendante, le 25 septembre 2026. Machine de mesure : quatre cœurs partagés avec d'autres agents. Tout est rejouable (voir « Rejouer »).*

## Verdict

**Non, la fonctionnalité ne dégrade pas les performances de façon notable.** Pendant la question, rien ne change (mêmes vues, même coût). Un retardataire, un réveil ou un niveau gagné hors podium ne renvoient rien à personne de plus, et un renommage une seule vue, celle d'un voisin. Chaque téléphone reçoit environ 190 octets de plus par révélation, soit **+0,25 %** de ce qu'il reçoit par question à 480 invités : l'instantané de la salle, lui, pèse 71 Ko.

Le processeur d'une diffusion grandit sans changer de complexité : à 500 invités, **+1,8 à +4 ms par révélation** et +2,2 ms au podium sur cette machine ; **+15 à +20 %** pour une vague de 500 reconnexions, soit ≈ +45 µs par téléphone, noyés dans les ≈ 5,9 ms que coûte une reconnexion au serveur. L'annonce du commit (« environ 1 ms par révélation ») est sous-estimée d'un facteur 2 à 4, mais l'ordre de grandeur est le bon.

**Un seul recul réel, et rare : exclure un invité pendant une révélation ou au podium renvoie désormais sa vue à toute la salle** (0 → 479 messages à 480 invités). En cause, `sur` et `exAequo`, qui dépendent de la composition de la salle. À corriger en tirant `sur` de l'instantané, ou à assumer avec un test.

## Ce qui a été comparé

L'arbre de travail a bougé trois fois pendant la contre-expertise. J'ai figé chaque état (empreintes sha256 dans `perf/v*/FIGE_A.txt`) et je les ai tous mesurés.

| Nom | Ce que c'est | Rôle ici |
|---|---|---|
| **avant** | `1294890`, dans une worktree à moi (`perf/base`) | la référence |
| v1 | le diff lu à 14 h 27 : sans `sur`, place au podium pour qui n'y monte pas | état intermédiaire |
| v2 | l'arbre à 14 h 37 : `+ sur`, place à tous au podium, et deux `Map` par joueur (`rangs` + `position`) | état intermédiaire |
| **après = v4** | le commit `4c87810` « Le classement au fil du quiz » : `rangs()` remplacé par `rangDe()`, un seul index, et `rangDAvant` en un passage. Identique pour les trois fichiers serveur à `8ab7f0e`, la fusion avec main | **la version jugée** |
| v5 | v4 avec un index par rang au lieu d'un index par joueur (ma variante) | piste écartée, voir R2 |

## Méthode

Trois bancs, du plus pur au plus réel. Chacun tourne dans son propre processus, par (version, N), versions en rotation, sous `nice -n 10`. La charge relevée par `uptime` allait de 0,04 à 1,9 (fichiers `perf/*-charge.txt`).

1. **Module seul** (`perf/module.ts`), sur le modèle de `partieSimulee` : le vrai registre `Party`, le vrai `ScoreLedger`, un mémo par diffusion. J'y ajoute ce que fait vraiment le moteur :
   - une vue émise est sérialisée **deux fois**, par `changed()` puis par socket.io ;
   - une réponse ne recalcule que la vue de son auteur, et l'écran commun à sa cadence (≤ 4/s) ;
   - la dernière réponse repasse par le chemin complet ;
   - une reconnexion, c'est **une** vue avec un mémo neuf (`resendViews`).
   
   85 % de la salle répond, une réponse sur deux est juste, et les réponses s'étalent de 1,5 à 17,5 s. Le temps de lecture offert vaut 5,6 s, ce qui crée de vrais groupes d'ex æquo à 200 points. Le banc tourne 5 processus × 7 essais (35 échantillons) par révélation et par podium, 20 par vague, 50 par question.
2. **Moteur** (`perf/moteur.ts`) : le vrai `GameEngine`, une vraie base SQLite, et un faux `io` qui compte les messages et les octets salon par salon. Les horloges sont simulées (`mock.timers`, comme `grande-salle.test.ts`), donc les **comptes sont déterministes** : avant et après voient les mêmes points et les mêmes ex æquo. C'est ce banc qui compte les `session:view` reçues par les téléphones déjà là dans chaque cas qui peut faire repartir la salle. Il tourne 3 fois à 150, 300 et 500 invités.
3. **Vraie salle** (`perf/salle.ts` + `perf/serveur.ts`) : un vrai serveur jetable (`createQuizServer`) dans un processus enfant, qui mesure sa boucle (`monitorEventLoopDelay`, 10 ms de résolution) et son processeur (`process.cpuUsage`). En face, N vrais clients `socket.io-client` (websocket) qui s'inscrivent, répondent (tirage à graine, mêmes gestes avant et après) et comptent chaque paquet reçu, événement par événement. Octets = paquet socket.io en UTF-8 + 1 octet de cadre engine.io. `perMessageDeflate` n'est pas activé, ce qui est le défaut de socket.io 4. Le banc tourne à 200 et 480 invités, auxquels s'ajoutent 20 retardataires (le plafond est 500). Cinq questions de 30 s par passage, deux à trois passages par version, puis une série ciblée pour le processeur (10 questions × 3 passages par version).

J'ai aussi vérifié l'équivalence v4 ↔ v5 (`perf/equivalence.ts`) : 300 parties tirées au hasard (2 à 80 invités, homonymes, retardataires, exclusions, annulation, « Reposer », podium). **123 447 vues** comparées, en diffusion et seules : **0 écart**.

### Le banc de départ (`perf/bench.ts`), et pourquoi je ne l'ai pas gardé

- **Il ne peut mesurer qu'un arbre** : ses imports pointent en dur vers `/home/user/FiestApp`. Pas d'« avant » possible sans le réécrire.
- **Un seul processus pour les trois tailles** : le JIT et le tas de 150 servent à 300 puis à 500.
- **« Le meilleur de cinq »** donne un minimum, pas une médiane, et cache la dispersion (le p95 de la révélation passe de 3,1 à 10,1 ms, voir plus bas).
- **Une seule sérialisation par vue**, alors que le moteur en fait deux pour une vue qui part. **Et la vue de l'écran commun recalculée à chaque réponse**, alors que le moteur la bride à 4/s. Ces deux écarts ont la même taille avant et après : ils ne biaisent pas la comparaison, seulement les chiffres absolus.
- **Il ne compte ni les vues qui changent ni les messages** (pas de `lastSent`). Il ne pouvait donc pas voir la régression de l'exclusion, qui est une affaire de messages, pas de millisecondes.
- **La vague de reconnexions n'est mesurée qu'à la 6ᵉ question**, jamais à la première révélation, où le groupe à zéro est le plus gros et le tri le plus cher (`localeCompare` sur les ex æquo). Aucun scénario de retardataires, d'exclusion, de renommage ou de crédit d'expérience.

## Résultats

### 1. Le processeur d'une diffusion (module seul, ms)

Échantillons regroupés de toutes les passes (base / v2 / v4 en rotation). La vague, c'est N vues calculées une à une, chacune avec un mémo neuf.

| Diffusion | N | Avant p50 / p95 / max | Après (v4) p50 / p95 / max | Δ p50 | v2 p50 (intermédiaire) |
|---|---:|---:|---:|---:|---:|
| Question entière (réponses + souffle) | 150 | 5.35 / 13.03 / 14.17 | 5.42 / 13.64 / 15.45 | +0.06 ms (+1 %) | 5.46 (+2 %) |
| Question entière (réponses + souffle) | 300 | 10.05 / 20.97 / 24.61 | 10.83 / 19.75 / 22.89 | +0.78 ms (+8 %) | 10.10 (+0 %) |
| Question entière (réponses + souffle) | 500 | 20.73 / 34.12 / 38.04 | 21.33 / 34.06 / 48.54 | +0.60 ms (+3 %) | 20.52 (−1 %) |
| Révélation, 1ʳᵉ question | 150 | 1.75 / 9.86 / 10.21 | 2.32 / 10.95 / 11.20 | +0.57 ms (+33 %) | 2.26 (+29 %) |
| Révélation, 1ʳᵉ question | 300 | 3.34 / 12.86 / 13.67 | 4.53 / 16.82 / 17.92 | +1.20 ms (+36 %) | 4.16 (+25 %) |
| Révélation, 1ʳᵉ question | 500 | 4.84 / 13.49 / 15.07 | 6.68 / 15.87 / 16.68 | +1.84 ms (+38 %) | 6.58 (+36 %) |
| Révélation, 6ᵉ question | 150 | 1.21 / 1.60 / 2.39 | 1.80 / 2.50 / 5.19 | +0.59 ms (+49 %) | 1.78 (+47 %) |
| Révélation, 6ᵉ question | 300 | 1.35 / 2.03 / 2.04 | 2.86 / 4.45 / 5.37 | +1.51 ms (+111 %) | 3.47 (+157 %) |
| Révélation, 6ᵉ question | 500 | 2.29 / 3.07 / 3.26 | 6.26 / 10.09 / 12.05 | +3.97 ms (+174 %) | 6.01 (+163 %) |
| Podium | 150 | 0.97 / 1.75 / 2.07 | 1.64 / 3.04 / 3.25 | +0.67 ms (+70 %) | 1.34 (+38 %) |
| Podium | 300 | 1.88 / 2.23 / 3.58 | 2.75 / 3.61 / 5.02 | +0.88 ms (+47 %) | 2.57 (+37 %) |
| Podium | 500 | 3.23 / 6.97 / 17.10 | 5.40 / 8.54 / 12.72 | +2.16 ms (+67 %) | 4.37 (+35 %) |
| N reconnexions, 1ʳᵉ révélation | 150 | 10.42 / 20.58 / 20.82 | 12.34 / 14.46 / 15.25 | +1.92 ms (+18 %) | 15.33 (+47 %) |
| N reconnexions, 1ʳᵉ révélation | 300 | 50.75 / 62.95 / 87.92 | 59.20 / 78.09 / 91.01 | +8.45 ms (+17 %) | 71.88 (+42 %) |
| N reconnexions, 1ʳᵉ révélation | 500 | 163.33 / 189.99 / 214.54 | 187.23 / 214.37 / 220.03 | +23.90 ms (+15 %) | 210.41 (+29 %) |
| N reconnexions, 6ᵉ révélation | 150 | 6.66 / 7.23 / 7.33 | 8.93 / 10.98 / 12.00 | +2.26 ms (+34 %) | 11.46 (+72 %) |
| N reconnexions, 6ᵉ révélation | 300 | 29.28 / 51.50 / 51.53 | 40.61 / 59.58 / 78.90 | +11.33 ms (+39 %) | 46.59 (+59 %) |
| N reconnexions, 6ᵉ révélation | 500 | 97.14 / 116.53 / 127.22 | 116.21 / 144.59 / 157.61 | +19.07 ms (+20 %) | 147.91 (+52 %) |

Lecture :

- **La question entière ne bouge pas.** Le chemin de code est identique pendant la question (`place` n'y est jamais calculée). L'écart mesuré, de −1 à +8 %, donne donc le bruit de ce banc : ±10 % environ.
- **La révélation et le podium coûtent quelques millisecondes de plus, pas un ordre de grandeur.** Le relatif est grand parce que la base est petite : grâce au mémo, la révélation de la 6ᵉ question ne coûtait que 4,6 µs par téléphone. La 1ʳᵉ révélation coûte moins en plus (+1,8 ms) : il n'y a pas encore de rang d'avant (`rangDAvant` rend `undefined`), et le gros groupe à zéro n'a pas de voisin derrière.
- **Le commit v4 a retiré le plus gros du surcoût de v2** : la double `Map` par joueur. La vague de 500 reconnexions passe de +29 / +52 % (v2) à **+15 / +20 %** (v4).
- **Côté décorations et noms, rien ne bouge** : 5 invités décorés par révélation avant comme après, 503 au podium (le classement complet de l'écran commun, + 3), et le même nombre de noms relus (N + 4 à 6). Aucun tri de plus, aucune décoration de plus.

Octets de la vue d'un téléphone (paquet socket.io) : révélation 1ʳᵉ question **415 → 551 o** (+136), révélation 6ᵉ question **416 → 611 o** (+195), podium **366 → 551 o** (+185). La place seule fait en moyenne 136 o à la 1ʳᵉ révélation et 195 o ensuite, 205 o au plus.

### 2. Octets et messages par téléphone, sur une vraie salle

Moyenne des questions 2 à 5 (la 1ʳᵉ porte en plus le compte à rebours), médiane des passages. Trois passages pour l'avant, deux pour l'après.

| Par téléphone et par question | 200 invités : avant → après | 480 invités : avant → après |
|---|---:|---:|
| Messages reçus | 4,72 → **4,72** | 4,68 → **4,68** |
| Octets reçus | 32,7 → 32,8 Ko (**+0,6 %**) | 72,6 → 72,8 Ko (**+0,25 %**) |
| dont `session:view` (2,8 vues) | 1,11 → 1,29 Ko | 1,10 → 1,29 Ko |
| dont `party:snapshot` (1 instantané) | 31,5 → 31,5 Ko | 71,5 → 71,5 Ko |
| Vue de révélation | 452 → 640 o | 452 → 641 o |

Le rapport de conception estimait ≈ 55 Ko de places par révélation à 500 invités, et +0,2 %. Mesuré : ≈ 90 Ko par révélation à 480 (190 o × 480), et **+0,25 %** des octets par question. L'hypothèse de fond tient : **l'instantané de toute la salle, renvoyé à chaque révélation, pèse 55 fois toutes les vues d'un téléphone sur la question** (111 fois sa vue de révélation).

### 3. Les cas qui peuvent faire repartir la salle

**Banc moteur**, `session:view` reçues par les téléphones **déjà là**. Comptes déterministes ; temps du geste en médiane de 3 à 6 passages. En gras, les comptes qui changent.

| Pendant la révélation | Q | N (à zéro) | Avant : vues · temps | v1 : vues | Après (v4) : vues · temps |
|---|---|---|---:|---:|---:|
| 20 retardataires, un par un | 1ʳᵉ | 500 (305) | 0 · 88.6 ms | 0 | 0 · 123.7 ms |
| 20 retardataires, un par un | 5ᵉ | 500 (33) | 0 · 67.0 ms | 0 | 0 · 91.4 ms |
| Toute la salle se re-présente (1 vue chacun, voulu) | 1ʳᵉ | 500 (305) | 500 · 170.1 ms | 500 | 500 · 209.9 ms |
| Toute la salle se re-présente (1 vue chacun, voulu) | 5ᵉ | 500 (33) | 498 · 116.6 ms | 498 | 498 · 145.3 ms |
| Renommage d'un invité à zéro (`rafraichirVues`) | 1ʳᵉ | 500 (305) | 0 · 2.8 ms | 1 | **1** · 4.1 ms |
| **Exclusion d'un invité à zéro** | 1ʳᵉ | 150 (96) | 0 · 2.0 ms | 95 | **149** · 3.3 ms |
| **Exclusion d'un invité à zéro** | 1ʳᵉ | 300 (190) | 0 · 2.4 ms | 189 | **299** · 5.7 ms |
| **Exclusion d'un invité à zéro** | 1ʳᵉ | 500 (305) | 0 · 3.8 ms | 304 | **499** · 10.0 ms |
| **Exclusion d'un invité à zéro** | 5ᵉ | 500 (33) | 0 · 3.9 ms | 32 | **497** · 7.4 ms |
| **Exclusion d'un invité qui a marqué** | 1ʳᵉ | 500 (305) | 400 · 4.8 ms | 402 | **498** · 8.9 ms |
| **Exclusion d'un invité qui a marqué** | 5ᵉ | 500 (33) | 264 · 4.7 ms | 346 | **496** · 7.0 ms |

| Au podium | N | Avant : vues · temps | Après (v4) : vues · temps |
|---|---:|---:|---:|
| Niveau gagné hors podium (`rafraichirVues`, `space.ts:821`) | 500 | 0 · 2.7 ms | 0 · 4.2 ms |
| Niveau gagné sur le podium (préexistant : le podium est décoré) | 500 | 496 · 4.9 ms | 496 · 9.1 ms |
| Arrivée au podium | 500 | 0 · 4.0 ms | 0 · 6.7 ms |

Les mêmes comptes à 150 et 300 invités sont dans `perf/moteur-resultats*.jsonl`, avec la même forme. Temps par arrivée pendant la révélation, à 500 invités : 3,9 → 5,4 ms (p50, 1ʳᵉ question) et 3,3 → 4,5 ms (5ᵉ).

**Vraie salle** : `session:view` reçues par les téléphones déjà là, instantanés compris. Processeur du serveur pendant la fenêtre du geste ; boucle bloquée = retard maximal de la boucle, résolution 10 ms déduite.

| Geste | N | Avant : vues · processeur · boucle max | Après (v4) : vues · processeur · boucle max | Champs changés (après) |
|---|---:|---:|---:|---|
| 20 retardataires d'un coup | 200 | 0 · 166–224 ms · 30–54 ms | 0 · 261–279 ms · 56–70 ms | aucun |
| 20 retardataires d'un coup | 480 | 0 · 377–490 ms · 153–173 ms | 0 · 395–406 ms · 92–118 ms | aucun |
| Exclusion d'un invité à zéro | 200 | 0 / 199 · 60–73 ms · 1–8 ms | **199 / 199** · 100–106 ms · 1–4 ms | `place.sur` ×199, `place.exAequo` ×108 |
| Exclusion d'un invité à zéro | 480 | 0 / 479 · 64–102 ms · 9–52 ms | **479 / 479** · 105–130 ms · 12–14 ms | `place.sur` ×479, `place.exAequo` ×271 |
| Toute la salle se re-présente | 200 | 1 vue chacun · 0,71–0,86 s · 144–238 ms | 1 vue chacun · 0,85 s · 163–213 ms | — |
| Toute la salle se re-présente | 480 | 1 vue chacun · 2,50–3,12 s · 91–174 ms | 1 vue chacun · 2,59–3,07 s · 75–199 ms | — |
| Renommage au podium (`rafraichirVues`) | 480 | 0 · 44–56 ms · 9–19 ms | 0 · 57–60 ms · 11–21 ms | aucun (ce tirage) |
| Arrivée au podium | 480 | 0 · 58–144 ms · 19–25 ms | 0 · 60–83 ms · 14–16 ms | — |

Fourchettes : trois passages avant, deux après. À 200 invités, les 20 retardataires coûtent un peu plus après (261–279 contre 166–224 ms), ce que 480 ne confirme pas (395–406 contre 377–490) : non tranché sur ces effectifs. Le banc moteur, déterministe, attribue à la fonctionnalité +1,0 à +1,5 ms par arrivée, soit +20 à +35 ms pour les vingt.

Chaque téléphone reçoit par ailleurs **un instantané complet** (71 Ko à 480) pour l'arrivée d'un retardataire, l'exclusion ou le renommage, et **deux** pour une reconnexion : c'est préexistant, et c'est ce qui pèse (voir R5).

Processeur du serveur par question, sur vraie salle à 480 : phase des réponses, 717–756 ms avant comme après ; fenêtre de révélation (vue de chacun + instantané regroupé + écritures), voir le tableau ci-dessous. Boucle bloquée à la révélation : médiane 15,4 ms avant (15 échantillons, pire 120 ms), 15,2 ms après (10 échantillons, pire 25 ms). Aucune dégradation visible au-dessus du bruit.

**Mesure ciblée de la révélation**, pour trancher le bruit : 480 invités, 10 questions, sans aucun scénario, avant et après en alternance, trois passages chacun, soit 27 révélations par version. Charge de 0,04 à 0,4.

| Vraie salle, 480 invités | Avant | Après (v4) |
|---|---:|---:|
| Processeur de la fenêtre de révélation (vues, écritures, instantané regroupé) : p50 / p95 / max | 120 / 228 / 229 ms | 133 / 185 / 210 ms |
| Boucle bloquée à la révélation (retard max) : p50 / p95 / max | 14,7 / 57,4 / 61,4 ms | 12,7 / 28,0 / 70,6 ms |
| Processeur de la phase des réponses (p50) | 753 ms | 707 ms |
| Messages et octets par téléphone et par question | 4,70 · 69,9 Ko | 4,70 · 70,1 Ko |

L'écart des médianes du processeur (+13 ms) **n'est pas significatif** : Mann-Whitney p ≈ 0,41, P(après > avant) = 0,57. Pour la boucle, P(après > avant) = 0,47. Les deux distributions couvrent 90 à 230 ms. Le banc moteur, lui, attribue à la fonctionnalité +4 ms de calcul de vues par révélation à 500.

### 4. Relecture du diff (`4c87810`)

- **Pendant la question, rien.** `place` n'est posée qu'à la révélation (`server/src/games/quiz.ts:1283`, sous `st.phase === 'reveal'`) et au podium (`quiz.ts:1298`). La phase `cible` rend avant (`quiz.ts:1226-1229`). `vueDependDesAutres: false` tient donc : une réponse ne recalcule que deux vues. C'est mesuré (question entière inchangée, 1,83 vue par téléphone et par question avant comme après) et gardé par le test « rien ne se calcule ni ne part pendant la question ».
- **Pas de boucle N² dans une diffusion.** `indexDesPlaces` (`quiz.ts:655-660`) trie une fois par diffusion via `classement()` (mémo `quiz:classement`) : une copie filtrée, une `Map` position, deux tableaux de bornes (`groupesDExAequo`, `shared/classement.ts:118`). Chaque vue y lit ses voisins en O(1). `rangDAvant` (`quiz.ts:694-710`) compte en O(N) à la première lecture, puis trie une fois et cherche par dichotomie (`rangDansLesTries`, `shared/classement.ts:101`, testé contre `rangPartage` sur 300 tirages).
- **Une vue seule (reconnexion) coûte O(N log N), comme avant** : c'est le tri du classement, préexistant. `rangDe` (`quiz.ts:670-678`) lit le rang dans le même index. Seule exception, le retardataire : `participantIds.includes` puis `lignes.reduce`, O(N) par vue de retardataire. Voir R4.
- **Le mémo est bien utilisé**, avec une subtilité : `rangDAvant` garde un compteur de lectures (`lectures++`) dans une valeur du mémo, donc un état mutable dont le chemin dépend de l'ordre des lectures. C'est sûr tant que le mémo naît et meurt avec la diffusion (`engine.ts:607`, `broadcast()`). Hors diffusion, `memo` rend un objet neuf à chaque appel : toujours la première lecture, toujours juste. Le résultat est identique sur les deux chemins, j'ai vérifié 123 447 vues.
- **Données périmées : rien de grave.** Les points et les rangs des voisins viennent de la vue, calculée dans la même diffusion que `yourQuizRank`. Le prénom, l'avatar et le niveau viennent de l'instantané, regroupé (120 ms + 2 ms par invité, ≈ 1 s à 480) : au pire une seconde de retard sur un prénom, et un voisin encore inconnu se dit par son rang (`shared/course.ts`, `nomDe`).
- **Invariant 4 : l'instantané n'a pas bougé.** Les vues restent dédoublonnées par `lastSent` (`engine.ts:618`). Mais `sur` fait dépendre la vue de chaque téléphone de la composition de la salle classée : c'est l'esprit de l'invariant 4, « la salle ne reçoit rien quand seul X change », qui cède à l'exclusion (R1).
- **Invariant 14 : respecté.** Les dérivations du téléphone sont pures (`shared/course.ts`), la place n'est ni rangée ni archivée, et l'état persisté ne gagne qu'un booléen (`soireeEntamee`).
- **Le client ne coûte presque rien.** Deux `players.find` par rendu (`Course.tsx`), ≈ 1 000 comparaisons à 500 invités : négligeable, non mesuré sur un vrai téléphone.

## Risques, par gravité

### R1 — Mineur, et le seul recul en messages : une exclusion renvoie sa vue à toute la salle

**Preuve.** Voir les tableaux 3 : 0 → 499 vues à 500 invités (banc moteur, déterministe) ; 0 → 479/479 sur vraie salle à 480, avec `place.sur` changé chez tous et `place.exAequo` chez les 271 ex æquo à zéro. v1, sans `sur`, n'en renvoyait qu'aux ex æquo (304 à la 1ʳᵉ révélation, 32 à la 5ᵉ). L'exclusion d'un invité qui a marqué touche maintenant tout le monde (264 → 496 à la 5ᵉ révélation, 500 invités), au lieu de ceux qui étaient derrière lui.

**Les chemins** :
- `host:removePlayer` (`server/src/sockets.ts:742`) → `exclure` (`server/src/core/space.ts:878`) → `dropParticipant` (`server/src/core/engine.ts:344`) → `fanout` ;
- et `laisserPlace` (`space.ts:954`), qui efface le « second Rachid » d'une reprise de place par code, s'il était arrivé pendant une question (donc classé, à zéro).

**Coût.** Un message et ≈ 640 o de plus par téléphone : ≈ 300 Ko pour la salle à 480, et +3 à +6 ms de processeur à 500 (banc moteur). L'exclusion envoie déjà l'instantané complet à tous (71 Ko par téléphone) : le surcoût vaut +0,9 % des octets de ce geste. Le geste est rare, et confirmé par une boîte de dialogue (`client/src/views/HostApp.tsx:263-269`).

**Pourquoi le corriger quand même.** C'est exactement la classe de régression que la fonctionnalité veut empêcher. CLAUDE.md dit maintenant : « Un champ de plus dans la place qui changerait pour toute la salle à une arrivée ferait la même chose (`classement-en-cours.test.ts` y veille) ». C'est vrai pour une arrivée, mais `sur` le fait à une exclusion, et aucun test ne le garde.

**Correction proposée.** Retirer `sur` de la vue : le téléphone a déjà les participants dans l'instantané (`PartySnapshot.session.participantIds`), et l'exclusion le renvoie de toute façon.

```ts
// server/src/games/quiz.ts — placeAuQuiz : plus de `sur`, rien ne dépend plus de la taille de la salle
return {
  ...(devant && { devant }),
  ...(derriere && { derriere }),
  ...(exAequo > 0 && { exAequo }),
  ...(avant !== undefined && avant !== lignes[i].rang && { avant }),
}

// client : « sur combien » se lit dans l'instantané, que l'exclusion renvoie déjà à tous
const sur = snap.session?.participantIds.length ?? 0
ligneDeCourse({ ...entree, sur }) // shared/course.ts : `sur` passe de `place` à l'entrée
```

La limite : `participantIds` compte aussi le retardataire qui n'a pas encore joué, d'où un « sur 481 » au lieu de « sur 480 » le temps d'une révélation. « sur N » ne s'écrit qu'à la moitié haute (`moitieHaute`, `shared/course.ts:63`). Si le produit tient au chiffre exact du serveur, on peut aussi le **figer à la révélation** (un nombre dans l'état, posé par `reveal()` et au podium) : une exclusion ne le change alors qu'à la question suivante.

Il reste `exAequo` : l'exclusion renvoie encore sa vue au groupe d'ex æquo de l'exclu (304/500 à la 1ʳᵉ révélation, 32 à la 5ᵉ). Le compte exact ne sert qu'à la phrase du lecteur d'écran (`shared/course.ts:105`) : c'est un choix de produit, que je laisserais tel quel.

Dans les deux cas, ajouter l'épreuve qui manque, dans `classement-en-cours.test.ts`, sur le modèle de celle de l'arrivée :

```ts
test('une exclusion pendant la révélation ne renvoie sa vue qu’à ses ex æquo', () => {
  // … même moteur que « dans le moteur, une arrivée pendant la révélation… »
  const envoisAvant = ids.map(id => recu.get(`player:${id}`)?.length ?? 0)
  party.remove(ids[19]); engine.dropParticipant(ids[19]) // à zéro, avec 14 ex æquo
  const renvoyes = ids.slice(0, 19).filter((id, k) => (recu.get(`player:${id}`)?.length ?? 0) > envoisAvant[k])
  assert.ok(renvoyes.length <= 14, `${renvoyes.length} téléphones ont reçu leur vue`)
})
```

### R2 — Mineur : une vue recalculée seule (reconnexion, réveil) coûte +15 à +20 %

**Preuve.** Tableau 1, lignes « N reconnexions » : ≈ +40 à +50 µs par reconnexion à 500 invités, sur cette machine.

**En perspective.** Sur vraie salle, une reconnexion coûte ≈ 5,9 ms de processeur au serveur à 480 invités (2,5 à 3,1 s pour 479 reconnexions, avant comme après). La vue en est ≈ 0,23 ms, et la place ≈ 0,04 ms au banc module. Le profil le confirme : **2,5 % de la vague**. Le reste, c'est l'instantané, construit pour chaque `party:watch` (`sockets.ts:284`) puis encodé et écrit, et l'écran commun recalculé à chaque connexion.

Profil du serveur pendant une vague de 479 reconnexions (v4, 480 invités, `node:inspector`, 2,9 s de processeur actif, profileur compris) :

| Où part le processeur d'une vague de reconnexions | Part |
|---|---:|
| socket.io / ws : encodage et écriture — les deux instantanés de 71 Ko par téléphone, surtout | 30,7 % |
| Poignée de main, base, répartition des événements, divers | 24,8 % |
| **Écran commun recalculé à chaque connexion et déconnexion** (`rafraichirAnimateur`, `sockets.ts:259` et `:945`) — préexistant, voir R5 | 20,3 % |
| Construction des instantanés (`buildSnapshot`) | 9,1 % |
| Vue du téléphone : tri du classement (préexistant) | 4,1 % |
| Ramasse-miettes | 3,5 % |
| Le profileur lui-même | 3,0 % |
| **Vue du téléphone : la place** (`indexDesPlaces` hors tri, `placeAuQuiz`, `rangDAvant`) | **2,5 %** |
| Vue du téléphone : le reste (vue, sérialisation, émission) | 1,7 % |

**Pas de correction nécessaire.** Le commit a déjà retiré la double `Map` de v2 (+29 / +52 % → +15 / +20 %). J'ai essayé d'aller plus loin (v5 : groupes d'ex æquo indexés par rang, en une passe, au lieu d'une `Map` par joueur, d'une copie filtrée et de deux tableaux). v5 est équivalente sur 123 447 vues et passe les 20 épreuves de `classement-en-cours.test.ts`, mais son gain est **dans le bruit** (vague 500 : 183 contre 187 ms à la 1ʳᵉ révélation, 129 contre 116 ms à la 6ᵉ). Je ne la recommande pas. Le diff est dans `perf/correction-v5.diff` pour mémoire.

### R3 — Négligeable : la diffusion de la révélation et du podium

**Preuve.** À 500 invités, +1,8 ms (1ʳᵉ révélation), +4,0 ms (6ᵉ) et +2,2 ms (podium) ; 136 à 195 octets de plus par vue. Sur l'instance gratuite de Render, qui n'a qu'un dixième de processeur (README), comptez environ ×10, soit +20 à +40 ms par révélation. C'est une extrapolation, non mesurée là-bas.

**En perspective.** La fenêtre de révélation d'une vraie salle de 480 coûte déjà ≈ 100 à 130 ms au serveur ici, dominés par l'instantané renvoyé à tous. D'où viennent les millisecondes : les objets de la place et leurs `...(cond && {…})`, la double sérialisation d'un objet imbriqué, la recherche dans la `Map`, et le tri des totaux d'avant (une fois par diffusion). Rien à corriger.

**À corriger dans le texte** : le commit et le README (« Sa place, à chaque révélation, ne coûte presque rien ») annoncent « environ 1 ms de plus par révélation » et « 150 octets de plus par téléphone » ; le README et le rapport de conception parlent d'« une centaine d'octets ». Mesuré : **+1,8 à +4 ms** et **+136 à +195 octets** (≈ 190 dès la 2ᵉ question). L'ordre de grandeur tient ; les chiffres, non.

### R4 — Négligeable : le rang d'un retardataire se compte en O(N)

`rangDe` (`quiz.ts:670-678`) fait `participantIds.includes` puis `lignes.reduce` pour chaque vue de retardataire, soit O(L·N) par diffusion (L retardataires depuis la dernière question), contre O(1) avant (`rangs`). À 500 invités et 20 retardataires, ≈ 10 000 comparaisons : invisible. Si l'on veut le borner, il suffit d'un mémo par total, qui ne vaut qu'un calcul par diffusion puisque les retardataires sont tous à zéro :

```ts
const sien = sess.state.totals[playerId] ?? 0
return vctx.memo(`quiz:rang-hors-place:${sien}`, () => 1 + lignes.reduce((d, c) => d + (c.item.points > sien ? 1 : 0), 0))
```

### R5 — Hors champ, préexistant : ce qui pèse vraiment dans une grande salle

Ce n'est pas la fonctionnalité, mais c'est ce que ses mesures montrent.

- **L'instantané renvoyé à chaque révélation.** Par téléphone et par question, à 480 invités : 72,6 Ko, dont **71,5 Ko d'instantané**. Il est renvoyé à chaque révélation (`onScoresChanged` → `broadcastSnapshot`, `space.ts:270`), soit ≈ 34 Mo à émettre pour la salle.
- **L'instantané reconstruit à chaque reconnexion.** Chacune le reconstruit et le sérialise pour un seul téléphone (`party:watch`, `sockets.ts:284`), puis en reçoit un second, regroupé : ≈ 143 Ko et ≈ 5,9 ms de processeur serveur par reconnexion à 480, soit ≈ 1 minute de processeur Render pour une vague de 480, par extrapolation. D'après le profil, l'encodage et l'écriture en font 31 %, la construction 9 %.
- **L'écran commun recalculé à chaque connexion et déconnexion d'un téléphone** (`incarner()`, `sockets.ts:259` ; `disconnect`, `sockets.ts:945` → `rafraichirAnimateur`, `engine.ts:394`). Chaque passage fait un mémo neuf, donc, pendant une révélation, un tri complet du classement (`standings(…, 5)`) et `compteParReponse`. C'est **20 % du processeur d'une vague de reconnexions** à 480, pour une vue qui, hors de la question, ne dépend pas des connexions : `changed()` ne l'envoie d'ailleurs pas.

Pistes pour une tâche à part : un delta des scores à la révélation ; le JSON de l'instantané des téléphones gardé entre deux changements (`space.ts:1170` le calcule déjà pour dédoublonner) ; `rafraichirAnimateur` bridé comme `fanoutCible` (≤ 4/s), ou réservé à la phase de question, la seule dont la vue lit les connexions (`attendus`).

## Ce qui est bien fait

- **Le tri est fait une fois par diffusion.** Voisins en O(1), rang d'avant par dichotomie. Même nombre de noms relus et d'invités décorés avant et après (5 à la révélation, N + 3 au podium) : le commit ne décore **personne** de plus, le téléphone décore ses voisins avec son instantané.
- **Rien pendant la question**, vérifié : même coût, mêmes vues (1,83 par téléphone et par question), aucune place dans une vue de question, ni de `cible`, ni de pause.
- **Les retardataires sont écartés des places.** C'est ce qui garde une arrivée à 0 vue renvoyée (moteur à 150, 300 et 500 ; vraie salle à 200 et 480), et un test la garde, dans le vrai moteur.
- **`onPlayerJoin` range l'arrivant de `cible` ou du podium à la question suivante** (`quiz.ts:1171`). Arrivée au podium : 0 vue renvoyée ; il ne tient pas une place de dernier.
- **Un niveau gagné hors podium ne renvoie rien** (0 → 0), parce que la place ne porte aucune décoration.
- **L'itération v2 → v4, faite pendant la contre-expertise, a divisé par deux le surcoût d'une reconnexion.** Une seule `Map` par joueur, et `rangDAvant` sans rien ranger à la première lecture.
- **Le test de la fonctionnalité compte au lieu de chronométrer** : noms relus ≤ N + 10, 0 décoration, ≤ 200 octets de place, 0 vue renvoyée à l'arrivée. C'est la bonne école pour une CI chargée. Son seuil de 200 octets est juste : j'ai mesuré 205 octets au plus avec la clé `"place":`, 196 sans.

## Non vérifié

- Le dixième de processeur de Render : tout « ×10 » ici est une extrapolation depuis le README.
- Le rendu sur un vrai téléphone (`Course.tsx`), la batterie, la 4G. Les octets comptés sont la charge utile non compressée + 1 octet de cadre, sans l'en-tête WebSocket.
- Les estimations, sondages, « plusieurs » et « ordre » : mes bancs jouent des QCM. `placeAuQuiz` ne dépend pas du type, mais la distribution des ex æquo, si.
- Les équipes, le multiplicateur ×2 ou ×3 (points plus longs de 1 ou 2 octets), la vue de l'écran commun (que le diff ne touche pas).
- Le crédit d'expérience au podium avec de vrais profils sur vraie salle : vérifié seulement au banc moteur, avec un `badgeOf` injecté. Sur vraie salle, j'ai rejoué `rafraichirVues` par un renommage au podium.
- La mémoire : `lastSent` garde ≈ 190 octets de plus par téléphone (≈ 90 Ko à 480). C'est un calcul, pas une mesure.

## Rejouer

Tout est dans `<atelier>/perf/`. Les copies figées `v1`, `v2`, `v4` et `v5` s'y trouvent aussi. La worktree `base` y a été posée puis retirée ; pour la recréer :

```bash
P=<atelier>/perf
git -C /home/user/FiestApp worktree add --detach $P/base 1294890 && ln -s /home/user/FiestApp/node_modules $P/base/node_modules
```

Puis :

```bash
cd /home/user/FiestApp/server
P=<atelier>/perf
nice -n 10 node --import tsx $P/module.ts $P/base 500 7        # une (version, N) du banc module ; $P/v4 pour l'après
nice -n 10 node --import tsx $P/moteur.ts $P/v4 500            # les comptes déterministes des scénarios
nice -n 10 node --import tsx $P/salle.ts  $P/v4 480            # la vraie salle (≈ 1 min 30)
A=v4 B=v5 node --import tsx $P/equivalence.ts                  # v4 et v5 rendent-elles les mêmes vues ?
python3 $P/agreger.py $P/module-resultats2.jsonl               # les tableaux
python3 $P/agreger-moteur.py $P/moteur-resultats2.jsonl
python3 $P/agreger-salle.py $P/salle-resultats.jsonl $P/salle-resultats2.jsonl
```

## Suite donnée

- **R1, l'exclusion** : corrigé. « Sur combien » ne vient plus du serveur ; le téléphone le lit dans l'instantané (`session.participantIds`), que l'exclusion renvoie déjà à tous. Une exclusion pendant la révélation ne renvoie plus sa vue qu'aux ex æquo de l'exclu, et l'épreuve proposée garde ce compte (`classement-en-cours.test.ts`, « une exclusion pendant la révélation… »). Elle échoue avec l'ancien champ : 19 téléphones sur 19.
- **R3, les chiffres** : le README et la PR disent maintenant « 2 à 4 ms » et « 140 à 200 octets ».
- **R4, le rang d'un retardataire** : compté une fois par diffusion, par total (`quiz:rang-hors-place`).
- **R2** : laissé tel quel, comme recommandé.
- **R5, hors champ** : proposé comme une tâche à part — l'écran commun recalculé à chaque connexion et déconnexion d'un téléphone (20 % d'une vague de reconnexions), et l'instantané reconstruit pour chaque reconnexion.
  - **L'écran commun** : corrigé ensuite. `rafraichirAnimateur` passe par la fenêtre du compteur de réponses (250 ms, celle de `fanoutCible`), et cette fenêtre compte désormais depuis le dernier calcul, parti ou non : comptée depuis le dernier envoi, elle ne bridait rien à la révélation, où une connexion ne change pas la vue. Banc moteur, 480 invités qui tombent puis reviennent en 2,9 s pendant la 1ʳᵉ révélation : **960 vues calculées → 13**, ≈ 530 → 9 ms de processeur sur ce banc, aucune envoyée avant comme après. Le dernier état des « hors ligne » part toujours, au plus 250 ms plus tard ; `grande-salle.test.ts` le garde, et compte les vues d'une vague (200 → 9 pour cent invités).
  - **L'instantané** : reste à faire, et à mesurer à part. Il se lit aussi dans les pastilles des profils (niveau, finition, légendaire, Éclat), qui n'ont pas de `revision` : le réutiliser d'une reconnexion à l'autre demande d'abord une empreinte de toutes ses sources, sans quoi un téléphone qui revient lirait un niveau périmé.
