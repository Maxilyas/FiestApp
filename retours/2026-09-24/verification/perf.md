# Performance et robustesse : ce qui tient — vérification du 24 septembre 2026

*Ce document vérifie la part « performance et robustesse » de l'évaluation. Sources :*
- *les rapports d'experts `retours/2026-09-24/experts/{perf-serveur, perf-temps-reel, perf-chargement, perf-rendu, robustesse-espaces}.md` et leurs scripts ;*
- *`export/evaluations/rapports/perf-observateur.md`, arrivé à 16:34 et intégré ;*
- *`export/evaluations/verification/salons-marc-lea.md`, section « Trois salons sur un même serveur ».*

*Mes scripts, mes résultats bruts et un profil CPU sont dans `export/evaluations/verification/perf/`. Je n'ai modifié aucun fichier du dépôt, et je n'ai touché à aucune régie en cours.*

---

## La réponse courte

### Que se passe-t-il quand plusieurs animateurs jouent en même temps ?

- **Les espaces sont étanches et le serveur ne tombe pas.** Aucune fuite d'un espace à l'autre n'a été vue :
  - 26 tentatives et 88 messages fouillés (robustesse-espaces) ;
  - 28 essais et 6 880 téléphones (perf-temps-reel) ;
  - les 20 espaces de mes deux essais ;
  - les trois salons réels de la tablée.

  Aucune erreur serveur non plus : ni pendant l'heure de tablée réelle, ni sur 3 192 réponses simulées. Après une coupure (SIGTERM ou SIGKILL, disque effacé ou non), chaque partie reprend exactement à son échéance. La tablée réelle confirme la stabilité et l'étanchéité. Elle ne dit rien de la capacité : il y avait au plus 14 invités.
- **La tenue au dixième de cœur de Render gratuit.** Je rejoue ce plafond en suspendant le serveur 90 ms sur 100 (SIGSTOP/SIGCONT) :

  | Situation | Résultat | Source |
  |---|---|---|
  | Dix soirées de 30, en même temps | **tiennent** : accusé p95 106–255 ms, révélation ≤ 0,8 s, aucune fuite | mes 2 essais |
  | Une soirée de 150 | tient : accusé p95 173 ms | perf-temps-reel, 1 essai |
  | Trois soirées de 50 | ≈ 45 % du plafond en moyenne, pointes ≈ 90 % | perf-observateur, estimation |
  | Une soirée de 300 | **casse** : accusé 1,2 s en médiane, 3,2 s au pire | perf-temps-reel, 1 essai |

  Les dix soirées de 30 prennent 80 % du plafond, mais à un rythme accéléré (une question toutes les 4 s environ par salon). À un rythme réel, il reste de la marge ; au-delà de dix salons, rien n'est mesuré. Dix salles de 30 coûtent bien moins qu'une salle de 300, car le coût d'une salle croît plus vite que son nombre d'invités.
- **Ce qui cède en premier, dans l'ordre** :
  1. **Le souvenir d'une grande soirée, scanné par toute la salle.** C'est le QR de la clôture, ou celui du podium de chaque quiz.
     - 50 scans d'une soirée de 150 invités × 40 questions demandent 3,7 s de CPU.
     - Au dixième de cœur, **le serveur ne répond plus à personne pendant 32 s**. Je l'ai mesuré (T1), avec la base permanente en fichier local. Avec Turso, distant, ce serait plutôt une demi-minute où chaque geste de chaque soirée attend jusqu'à une seconde environ (estimé).
     - Pour une soirée de 30, le même geste gèle le serveur 3 s.
  2. **La ruée du scan.** Chaque téléphone qui arrive coûte environ 30 ms de CPU, dont la moitié sert à recompresser l'application (C1). Au dixième de cœur, cela fait environ 0,3 s par téléphone.
  3. **Au-delà de 150 invités dans une salle**, chaque réponse recalcule les vues des N téléphones et réécrit tout l'état de la partie (T4). L'instantané, lui, repart à toute la salle à chaque arrivée et à chaque veille (T3).
- **Un voisin bruyant gêne-t-il les autres ?**
  - Sur une machine qui a de la marge, presque pas : à côté d'un salon de 400, l'accusé passe de 5 à 13 ms au p95.
  - Au dixième de cœur, oui, à trois moments :
    - **sa clôture**, avec le souvenir : jusqu'à 30 s de gel pour tous ;
    - **son arrivée** : quand 150 invités entrent d'un coup, les inscriptions des voisins attendent plusieurs secondes ;
    - **pendant le jeu**, un peu : les révélations des petits salons prennent jusqu'à 0,8 s de retard.
  - Il existe aussi un couplage sans rapport avec le CPU : la réserve de 60 inscriptions par minute est **commune à tous les espaces** d'une même adresse (E1). Et en ligne, on ne sait pas encore si l'adresse lue derrière le proxy de Render est bien celle du client (risque, voir E1).

### Quelle performance, quelle rapidité ?

- **L'entrée d'un invité.** On mesure en 4G moyenne émulée, sur un téléphone d'entrée de gamme (processeur ×4), médiane de 5 essais à 41 ms d'écart :
  - 2,2 s jusqu'à l'écran d'entrée ;
  - 2,6 s jusqu'à la salle d'attente.

  Le goulot est la bande passante (225 Ko à télécharger), pas le processeur. Recharger la page ne coûte que 606 octets. Environ 1,8 s est à portée, selon une estimation, avec trois gestes :
  - compresser les fichiers au moment du build ;
  - sortir les médaillons du chemin de l'invité anonyme ;
  - ne plus précharger les polices (−157 ms, mesurés).
- **Le temps réel.**
  - Sur 4 cœurs, jusqu'à 500 invités : la question arrive 3 à 13 ms après le geste (p95 ≤ 31 ms), l'accusé en 2 à 3 ms. La révélation part 45 ms après le souffle voulu de 700 ms.
  - Au dixième de cœur, accusé médian : 42 ms à 50 invités, 74 ms à 150, 51 à 82 ms pour dix salons de 30, et 1,2 s à 300.
  - Les quelque 550 ms d'accusé vécues pendant la tablée viennent du pilote des agents, pas du serveur. Seul, le serveur répond en 2 ms.
- **La fluidité.** Pour une salle anonyme, l'écran commun (processeur ×2) et le téléphone (×6) tiennent 60 images/s, sans fuite mémoire sur 30 questions. Deux coûts restent à réduire :
  - le chronomètre fait 60 mises en page par seconde pendant toute la question ; animé par `scaleX`, il coûterait 80 % de moins (mesuré) ;
  - les légendaires animés dans les listes font tomber l'écran commun à 40 images/s (5ᵉ centile) à la clôture. La mesure porte sur une salle d'habitués forcée, lointaine aujourd'hui.

**Quatre bugs confirmés** : E1, E2, E3 et T1. T1 est un bug de performance : il abîme la soirée de tout le serveur. Le reste se répartit ainsi :
- des coûts confirmés, à optimiser ;
- un compromis assumé (E4) ;
- un risque de production à lever : l'adresse du client derrière le proxy de Render.

### Les chiffres qui tiennent

| Grandeur | Chiffre retenu (4 cœurs Xeon à 2,8 GHz) | D'où |
|---|---|---|
| CPU d'une question | ≈ 35 ms + 2 ms par invité jusqu'à 150, soit ≈ 120–130 ms à 50 et ≈ 350 ms à 150 ; ≈ 1 s à 500 | perf-observateur ; mon A/B sans instrumentation (120 ms à 50) ; perf-serveur (500) |
| Instantané `party:snapshot` | ≈ 166 o par invité : 8 Ko à 50, 25 Ko à 150, 81 Ko à 500 | perf-serveur et perf-temps-reel, concordants |
| Octets par téléphone et par question | 10 à 11,5 Ko à 50, 28 Ko à 150, 102 Ko à 500 | perf-temps-reel, perf-observateur, et ma rejoue (11,5 Ko à 50) |
| CPU d'une arrivée | ≈ 30 ms : 7 pour l'inscription, 8,5 pour servir les fichiers, 15 pour les recompresser | perf-observateur ; tailles brotli/gzip rejouées à l'octet (C1) |
| Souvenir archivé, par requête | 11–13 ms (30 × 40, archive de 447 Ko) ; 74–130 ms (150 × 40, 2,2 Mo) ; 160–290 ms (300 × 40) | ma mesure ; perf-serveur pour 300 |
| Mémoire du serveur | 115–235 Mo, dont ≈ 130 Ko par invité en jeu : 512 Mo ne sont pas la limite | concordant chez tous |
| Démarrage local | 0,5 à 0,9 s selon la méthode ; non mesuré sur Render | robustesse, perf-chargement, perf-observateur ; ma rejoue (855 ms) |
| Clôture | ≈ 5 allers-retours Turso par profil, en série (66 pour 12 profils) : 6,7 s à 100 ms de latence | perf-serveur (son « ~8 par profil » est surestimé) |
| Passage au dixième de cœur | ×8,7 sur la durée d'un calcul CPU (3,7 s de CPU → 32 s) | ma mesure : l'hypothèse « ×10 » des experts tient en ordre de grandeur |

---

## Comment j'ai vérifié

- **Chaque constat relu dans le code**, à la ligne citée. Les numéros ci-dessous sont ceux du dépôt au commit `9dd100e`.
- **Six mesures rejouées**, bases jetables dans `export/evaluations/verification/perf/`, chaque serveur éteint à la fin :
  1. le harnais de perf-temps-reel (`charge.mjs`, copié en `charge-verif.mjs`, sorties redirigées) à 50 invités, avec 2, 4 puis 8 questions ;
  2. ce même harnais avec 8 questions, **avec et sans l'histogramme de retard** de l'expert, deux fois chacun, plus un **profil CPU** ; et le CPU du serveur au repos, avec et sans l'histogramme (`repos.mjs`) ;
  3. le harnais de perf-serveur (`salle.mjs 50`) ;
  4. **dix salons de 30 au dixième de cœur**, deux fois : les experts ne l'avaient pas mesuré ;
  5. **le souvenir archivé scanné par la salle**, sur 4 cœurs puis au dixième de cœur (`souvenir-quota.mts`, résultats dans `souvenir-resultats.jsonl`). Seul perf-serveur l'avait mesuré, à 300 invités et sur 4 cœurs ;
  6. les tailles gzip et brotli des fichiers du paquet déjà construit (`client/dist`, même empreinte que chez l'expert).
- **Conditions de mesure** :
  - la machine : 4 cœurs Xeon à 2,8 GHz et 16 Go ; load1 entre 0,04 et 0,7 ; les régies de la tablée et leur Chromium tournaient en fond ;
  - tout est lancé en `nice -n 10`, avec le serveur toujours dans son propre processus ;
  - le générateur est mesuré à part : boucle p99 ≤ 1,7 ms, max ≤ 24 ms.
- **Pas rejoués** :
  - les scripts de robustesse-espaces, puisque le code tranche seul ;
  - les mesures dans le navigateur de perf-chargement et de perf-rendu, dont les A/B tournaient déjà en deux tours.

## Les chiffres des experts : que valent-ils ?

| Expert | Répété ? | Charge de la machine donnée ? | Générateur séparé ? | Les conclusions suivent-elles ? |
|---|---|---|---|---|
| perf-serveur | ≥ 2 passes concordantes ; **reproduit ici** (`salle.mjs 50` : 60–70 ms par question, 170 ms de lancement, contre 50–80 et 140–150) | oui (0,1–0,7) | oui pour `salle.mjs` (le `/proc` du seul serveur) ; les micro-mesures tournent dans le même processus | oui. Le « ×10 sur Render » est une hypothèse, que ma mesure au plafond rend plausible (×8,7). Le « ~8 allers-retours par profil » à la clôture est surestimé : 5,5 mesurés, voir T5 |
| perf-temps-reel | solo ×4 ; 5 × 60 et voisin ×3 ; **plafond et veille ×1** ; reproduit ici (1 307 ms de CPU de jeu à 50, contre 1 499) | oui, dans chaque JSON | oui, et mesuré. Au plafond, les arrêts du serveur dépendent pourtant des minuteurs du générateur | **Latences : oui.** **CPU par question : non**, gonflé par son instrumentation (voir plus bas). Sa phrase « croît plus vite que la salle » n'est pas soutenue par ses propres chiffres entre 50 et 200 invités (380 → 690 ms pour quatre fois plus d'invités) ; ceux de perf-serveur la soutiennent faiblement, de 200 à 500 |
| perf-chargement | 5 passages, médiane, écart de 41 ms | oui (< 0,4) | sans objet | oui. Les tailles sont rejouées ici à l'octet. Les gains 1, 2, 4, 6 et 7 sont estimés ; seul le n° 3 (les polices) est mesuré |
| perf-rendu | A/B en deux tours ; passes uniques | oui (2 à 3, du fait de ses navigateurs) | sans objet | oui pour le chronomètre. La « salle d'habitués » (un tiers de légendaires) est forcée et lointaine : sa priorité P1 est conditionnelle |
| robustesse-espaces | fonctionnel (80 essais) | oui (≈ 0,2) | — | oui. La collision E3 est provoquée en figeant l'horloge, et sa probabilité réelle est négligeable : P2 surévalué |
| perf-observateur | 5 passages du serveur seul | oui | oui (le serveur sorti de la régie) | oui. Son « le serveur n'a jamais été le goulot » tient pour la tablée réelle, mais cette tablée ne dit rien de la capacité |

### Le CPU d'une question : trois chiffres, une même réalité

À 50 invités, les experts donnent 50 à 80 ms (perf-serveur), 128 ms (perf-observateur) ou 380 ms (perf-temps-reel). Il n'y a pas de désaccord sur le code. Les écarts viennent des harnais :

| Mesure (50 invités) | CPU par question | Pourquoi |
|---|---|---|
| perf-serveur, `salle.mjs` | 50–80 ms (ma rejoue : 60–70) | les 50 réponses partent d'un bloc, dans une fenêtre serrée : c'est un plancher |
| perf-temps-reel, `charge.mjs` | 380 ms (1 499 ÷ 4) | lancement et podium compris, et surtout `monitorEventLoopDelay({ resolution: 1 })` (`scripts/perf-temps-reel/serveur.ts:33-35`) |
| le même harnais chez moi, 8 questions | 2 161 et 2 210 ms avec l'histogramme à 1 ms ; **1 182 et 1 186 ms sans** ; 1 394 ms avec l'histogramme à 10 ms | A/B sur la même machine, 40 s de jeu à chaque fois : **l'histogramme à 1 ms coûte environ 1 s de CPU pour 40 s** |
| perf-observateur | 128 ms par salon (3 × 50) ; 349 ms à 150 | réponses étalées, histogramme à 10 ms (environ +17 %) |
| chiffre retenu | **≈ 120 ms à 50** (marginal, sans instrumentation) ; ≈ 35 ms + 2 ms par invité jusqu'à 150 ; ≈ 1 s à 500 | la part en N² (`changed` + `persist`) domine à 500 : T4 |

Le profil CPU à 50 invités (`temps-reel/profils/prof-50/`, 975 ms de fil principal pour 8 questions) se répartit ainsi :

| Poste | CPU (ms) | Détail |
|---|---|---|
| `persist` | 212 | dont 131 de sérialisation de l'état et d'écriture SQLite |
| `fanout` | 221 | dont 155 d'émission socket.io et 37 de `changed` |
| écriture synchrone du miroir `file:` (libsql) | 127 | voir T7 |
| `writev` | 105 | — |

**Ce que cela change** :
- Les chiffres de CPU par question de perf-temps-reel sont gonflés d'un facteur 1,8 à 50 invités.
- Ses **latences au plafond**, elles, tiennent. Suspendu, le processus ne subit pas les réveils de l'histogramme, et à 300 invités la boucle est de toute façon saturée.
- Pour les mesures de production, **un histogramme de retard à 1 ms est à proscrire**. Pendant le jeu, il a coûté ≈ 25 ms de CPU par seconde, soit le quart d'un dixième de cœur. Au repos, c'est bien moins : ≈ 0,5 ms/s mesurée (`repos.mjs`). Il faut viser 20 ms de résolution ou plus, ou `performance.eventLoopUtilization()`, qui n'arme aucun minuteur, et vérifier le surcoût par un A/B comme le mien avant de le livrer.

### Trois réserves qui valent pour tous les chiffres

- **Tous les harnais utilisaient un miroir `file:`**, synchrone dans la boucle (T7). Conséquences :
  - les coûts d'inscription y sont **pessimistes** par rapport à la production ;
  - la clôture et les crédits y sont **optimistes** : aucune latence Turso, sauf dans `miroir-lent.ts`, qui simule une latence fixe sans débit.
- **Le plafond rejoué par SIGSTOP/SIGCONT n'est pas le quota CFS d'un conteneur** :
  - il est plus dur au repos, avec environ 50 ms de latence plancher (boucle p50 à 90–99 ms dans mes essais) ;
  - il est plus généreux quand le processus travaille, car pendant les 10 ms ouvertes tous ses fils tournent en parallèle sur 4 cœurs : ramasse-miettes, zlib dans le pool de libuv… ;
  - on ignore d'ailleurs si le dixième de cœur de Render est un plafond strict ;
  - c'est donc un ordre de grandeur, pas une promesse.
- **Aucun vrai réseau** (tout passe par localhost), **aucun vrai Turso**, **aucun Render**. Seule la préproduction répondra, avec les mesures de la dernière section.

---

## Les constats vérifiés

**Statut** :
- **bug confirmé** : lu dans le code, et rejoué ou mesuré ;
- **optimisation** : un coût confirmé, avec un gain chiffré ;
- **risque** : plausible, non mesuré ;
- **tension** : un parti pris ou un compromis assumé ;
- **non confirmé**.

**Priorité** : P1, la soirée de toute une salle est abîmée ; P2, celle de quelques-uns ; P3, du confort. **Effort** : S, quelques lignes ; M, une journée ; L, un lot.

### Étanchéité et robustesse

#### E1. La réserve d'inscriptions par adresse est commune à tous les espaces — bug confirmé · P2 · S

- **Source** : robustesse-espaces, constat 3.
- **Preuve** : `sockets.ts:46-47` (60 d'un coup, 60 par minute) ; `sockets.ts:123`, une seule réserve pour tout le serveur, créée dans `wireSockets` ; `sockets.ts:322`, `joinBudget.take(ip)`, où la clé est l'adresse seule ; `core/budget.ts`, `take(key)`. Le commentaire de `sockets.ts:30-45` pense à « toute une salle derrière une box », pas à plusieurs salles. Le code tranche seul, je ne l'ai pas rejoué. L'expert l'a vu céder : 60 invités chez A, puis le premier invité de B refusé.
- **Qui ça touche** : deux salles derrière une même adresse publique : une école, une entreprise, un tournoi à plusieurs animateurs. La salle B voit son QR « ne pas marcher » pendant une minute, à cause d'une salle qu'elle ne connaît pas.
- **Risque associé, à lever en production (P1 s'il se confirme)** : `clientIp()` lit la **dernière** entrée de `x-forwarded-for` (`sockets.ts:105-117` ; `server.ts:162-164`, `trust proxy 1`), en supposant « un seul saut de proxy ». Je n'ai pas pu lire les pages de Render : le proxy de ce conteneur les bloque. Les extraits des moteurs de recherche disent pourtant deux choses : que le client est la **première** entrée, et que le proxy de Render **ajoute** son adresse à celles qu'il reçoit, derrière Cloudflare.

  Si la dernière entrée est l'adresse d'un proxy, alors tous les invités qui passent par le même proxy partagent **une seule** réserve de 60 inscriptions par minute. Une salle de 150 prendrait des refus, et plusieurs soirées se gêneraient toutes. `temps-reel.test.ts:718-740` ne simule qu'une seule entrée. À vérifier en production : voir la dernière section.
- **Piste** :
  - clé `${ip}|${spaceId}` ;
  - plus une réserve large par adresse, pour tout le serveur, contre l'inondation (par exemple `new Budget(300, 300, { skipLoopback: true })`) ;
  - un test dans `server/test/` : 60 inscriptions chez A, puis une chez B, depuis la même adresse (`x-forwarded-for`, comme `temps-reel.test.ts:725`).
- **Invariants** : aucun. Le plafond de chaque soirée borne toujours le plaisantin.

#### E2. Un palier de carrière compte l'essai en cours d'un autre espace, et le garde — bug confirmé (rare) · P3 · S

- **Source** : robustesse-espaces, constat 2 (l'expert le classait en tension).
- **Preuve** :
  - `accorderPaliers` (`profiles.ts:1110-1111`) lit `careerOf` → `historiqueOf` (`profiles.ts:1236-1262`). Cette fonction prend **toutes** les lignes `profile_xp` du profil, y compris celles des soirées encore en cours dans d'autres espaces, déjà créditées au verdict de chaque quiz (invariant 10 ; `space.ts:533-583`) ;
  - `retirerSoireeEntiere` (`profiles.ts:984-1006`) n'efface que les badges `WHERE soiree_id = ? AND space_id = ?`. Le palier rangé sous le nom de B reste donc quand A efface son essai ;
  - son propre commentaire dit pourtant « une soirée qui n'a pas eu lieu ne laisse rien derrière elle » (`profiles.ts:977-983`).

  C'est donc un bug, pas une simple tension. Dans un seul espace, c'est impossible : la seule soirée en cours est celle qui clôt.
- **Qui ça touche** : un profil qui joue un essai chez A et une vraie soirée chez B le même soir. Il y gagne un palier immérité : un badge et 10 à 40 XP.
- **Piste** : à la clôture, exclure de `careerOf` les soirées en cours des autres espaces. Le registre les connaît (`server.ts:503`, `soireeEnCours`). L'autre soirée retrouvera ce palier à sa propre clôture, si elle est gardée.
- **Invariants** : 10 et 20. Le palier se décide toujours à la clôture, en un seul lot.

#### E3. L'identifiant d'une soirée ne porte pas l'espace — bug confirmé (provoqué, improbable) · P3 · S (ou M)

- **Source** : robustesse-espaces, constat 1 (l'expert le classait P2 · M).
- **Preuve** :
  - `archiveIdOf` (`archive.ts:44-48`) forme l'identifiant avec la date de Paris et les 5 derniers chiffres, en base 36, de l'heure en millisecondes. Le commentaire « unique à la seconde près » (`archive.ts:45`) est faux : l'unicité vaut à la milliseconde près, modulo 36⁵ ms, soit environ 16 h 47 min ;
  - côté profils, la clé ignore l'espace : `profile_xp` a pour clé `(profile_id, soiree_id)` (`profiles.ts:320-328`) ;
  - l'upsert garde le `space_id` de la première écriture (`profiles.ts:918-922`) ;
  - les Éclats s'effacent par `soiree_id` seul (`profiles.ts:994`) ;
  - `creditPrecedent` et `eclatDeLaSoiree` lisent sans l'espace (`profiles.ts:1012-1019`, `:1035-1041`) ;
  - même racine dans `recalcul.ts:89` (`enCours.has(id)`).

  L'expert l'a fait céder en figeant l'horloge.
- **Qui ça touche** : un profil qui joue deux soirées nées à la même milliseconde : il perd l'expérience de l'une. Un « C'était un essai » peut aussi emporter les Éclats de la soirée homonyme d'un autre espace. Il faut une coïncidence à la milliseconde : c'est silencieux et définitif, mais quasi impossible sans script. D'où P3.
- **Piste, moins chère que celle de l'expert** : rendre l'identifiant unique entre espaces **au moment de le tirer** (`space.ts:238-246`, `tirerSoiree`, qui le fige une fois pour toutes, invariant 11), par exemple avec un suffixe dérivé de l'espace. Pas de migration. Aucun test ne fige le format (vérifié), et `ID = /^[\w-]{1,64}$/` (`archive.ts:285`) l'accepte. Les requêtes « sans l'espace » deviennent alors justes. L'expert proposait autre chose : mettre l'espace dans la clé des trois tables, ce qui demande une migration Turso, M.

#### E4. Une réponse accusée peut se perdre sur SIGKILL avec disque effacé — tension (compromis documenté) · P3 · S

- **Source** : robustesse-espaces, constat 4.
- **Preuve** :
  - une réponse n'écrit ni gain ni ligne de journal (`quiz.ts:539-597`). `lotCharge()` reste donc faux, et l'état de la partie ne part au miroir qu'à la cadence de 2 s (`engine.ts:501-520`, `MIRROR_INTERVAL_MS`, `engine.ts:22`) ;
  - le compromis est écrit en tête d'`engine.ts` (`:12-22`) et dans `MISE-EN-LIGNE.md:364` : « au pire, deux secondes de réponses en moins » ;
  - SIGTERM, lui, vide la file : 4 fois sur 4 chez l'expert.
- **Qui ça touche** : un arrêt brutal (manque de mémoire, plantage), pas un déploiement.
- **Piste** : le téléphone renvoie sa dernière réponse accusée à la re-présentation, si la vue reçue dit « pas de réponse » pour la même question encore ouverte. Attention : le temps de réponse est recalculé à l'arrivée.

### Temps réel et serveur

#### T1. Le souvenir et le bilan se recalculent à chaque requête : une grande salle qui scanne le QR gèle le serveur de tous — bug de performance confirmé, mesuré au dixième de cœur · P1 (salle de 100 et plus sur un serveur partagé) / P3 (30 invités) · S à M

- **Sources** : perf-serveur, constats 2 et 6 ; perf-observateur, constat 5 (la lenteur des pages du lendemain). Mesure : la mienne.
- **Preuve dans le code** :
  - aucune mise en cache : `server.ts:401-412` (`recap.json`, `bilan.json`) → `space.ts:804-835` (`liveRecap`, `liveReview`, qui relisent tout le journal) ;
  - pour une soirée close, `server.ts:449-462` → `archive.ts:431-442`, qui télécharge **l'archive entière** puis `JSON.parse`, à chaque requête ;
  - le QR mène là à chaque podium de quiz (`HostApp.tsx:663-666`) et à la clôture (`Cloture.tsx:41`) ; « Revoir la soirée » aussi (`FinDeSoiree.tsx:177`) ;
  - côté client, `lecteurDePage` ne lit l'archive qu'une fois par page (`client/src/derniere.ts:30-47`). En revanche, le souvenir d'une soirée en cours se rafraîchit toutes les 20 s, **même dans un onglet caché** (`RecapApp.tsx:56`, aucun `visibilitychange`).
- **Mesure** (`souvenir-quota.mts`) : serveur dans son processus, archives synthétiques reprises de `historique.ts`. Une sonde `/healthz` toutes les 100 ms joue le voisin.

  | Situation | CPU serveur | Tout servi en | Le voisin (`/healthz`) a attendu |
  |---|---|---|---|
  | 4 cœurs, 1 requête, 150 × 40 | 110–130 ms | 86–120 ms | — |
  | 4 cœurs, **50 requêtes**, 150 × 40 | 3 870 ms (77 ms/requête) | 3,3 s | **3,2 s** |
  | 4 cœurs, 30 requêtes, 30 × 40 | 320 ms (11 ms/requête) | 0,3 s | 61 ms |
  | 0,1 cœur, 1 requête, 150 × 40 | 80 ms | 0,6 s | — |
  | 0,1 cœur, **50 requêtes**, 150 × 40 | 3 690 ms | **32,2 s** | **32,2 s** |
  | 0,1 cœur, 30 requêtes, 30 × 40 | 390 ms | 3,3 s | 3,2 s |

  Cela concorde avec perf-serveur (300 × 40 : 160 à 290 ms par requête, et 50 requêtes = 8,4 s de CPU sur 4 cœurs).
- **En production**, Turso est distant et asynchrone. Les requêtes se glissent alors entre des blocs de calcul d'environ 0,75 s chacun au dixième de cœur, au lieu de bloquer tout d'une traite. On obtient une demi-minute où tout geste de toutes les soirées attend jusqu'à environ une seconde. Et 50 × 2,2 Mo quittent Turso.
- **Estimation, non mesurée** : chaque page de souvenir ouverte pendant la soirée coûte 7 ms toutes les 20 s à 30 × 40, et 35 à 50 ms à 150 × 40 (chiffres de perf-serveur). Avec 50 pages ouvertes au premier plan en fin de grande soirée, cela ferait environ 2,5 requêtes par seconde, soit à peu près tout le dixième de cœur.
- **Piste** :
  - un cache par espace, **qui garde la promesse en vol**, pour que 50 requêtes simultanées ne calculent qu'une fois. Code proposé par perf-serveur, constat 2 ;
  - une clé d'invalidation faite des journaux : nombre de réponses, nombre de gains, et un compteur de version de `Party` et des équipes ;
  - pour les archives, un petit LRU `(space_id, id)`, vidé par `save`, `remove` et le renommage ;
  - côté client, ne pas rafraîchir un onglet caché (`document.hidden`) ;
  - un test dans `server/test/resultats.test.ts` : deux GET successifs ne calculent qu'une fois, 50 GET simultanés aussi, et une question jouée entre deux GET les distingue.
- **Invariants** : 14 (les dérivations restent pures et partagées : seule leur mémoïsation s'ajoute) et 3 (la clé porte l'espace). Une invalidation oubliée montre une page en retard, jamais celle d'une autre soirée.

#### T2. Ce que tient un serveur partagé au dixième de cœur — mesuré en émulation · P2 · S

- **Sources** : perf-temps-reel, constat 2 (un essai par taille) ; perf-observateur (projection ×10) ; mes deux essais à dix salons de 30.
- **Mes essais** : 10 × 30 invités, arrivées étalées sur 30 s, 4 questions par salon, les dix quiz en même temps.
  - inscription : p50 52–91 ms, max ≤ 352 ms ;
  - accusé : p50 51–82 ms, p95 106–255 ms, max ≤ 339 ms ;
  - révélation après le souffle : ≤ 414 ms, une fois 805 ms ;
  - CPU serveur : 0,08 cœur pendant le jeu, soit 80 % du plafond ; boucle p99 ≈ 500 ms (le plancher du rejeu est de 90 ms) ;
  - 0 fuite, générateur p99 ≤ 1,7 ms.

  Résultats bruts : `temps-reel/q01-dix-30-*.json`.
- **Constat** : jusqu'à 150 invités par salon, tout tient. À 300 dans une même salle, ça casse. Le plafond de 150 est déjà le réglage par défaut (`shared/space.ts:87`) et la consigne écrite (`render.yaml:73-75`, `MISE-EN-LIGNE.md:356`). Mais le plafond réglable reste à 500 (`shared/space.ts:89`), et **`MAX_PLAYERS` borne chaque espace, pas leur somme** (`space.ts:717-721`, `server.ts:299`).
- **Piste** :
  - vérifier que `MAX_PLAYERS=150` est bien posé sur les deux services Render : c'est le tableau de bord qui fait foi, pas le fichier ;
  - ajouter un mot dans « Mon compte » au-delà de 150 ;
  - rejouer `charge-verif.mjs --quota 0.1` après chaque optimisation.

#### T3. L'instantané porte toute la salle à chaque téléphone, et repart à chaque arrivée, veille ou gain — optimisation · P2 · S (P1 au-delà de 150)

- **Sources**, dédoublonnées : perf-serveur constat 1, perf-temps-reel constat 1, perf-observateur constat 4.
- **Preuve** :
  - l'instantané porte la liste complète des invités, avec `connected` (`party.ts:306`), à toute la salle (`space.ts:729-765`) ;
  - il part à chaque arrivée (`sockets.ts:359`), chaque re-rattachement (`:403`), chaque coupure (`:642`) et chaque gain (`space.ts:169`) ;
  - il est regroupé à 120 ms (`space.ts:767-772`), dédoublonné, et donc bien conforme à l'invariant 4. C'est le volume, pas la fréquence, qui coûte ;
  - sur une vague d'arrivées une par une, chaque arrivée fait sa propre diffusion. perf-serveur compte 45 450 messages pour 300 arrivées, soit Σk = 45 150 : le N³ en octets est confirmé (1,04 Go pour 300, 133 Mo pour 150) ;
  - côté téléphone, seul `Entree.tsx:116` lit le `connected` des autres, pour un compte. L'écran commun, lui, s'en sert (`HostApp.tsx:147`, `:177`, `:366`).
- **Qui ça touche** : à 150, c'est une curiosité de bande passante (≈ 1,3 Mo pour le premier arrivé, 28 Ko par question et par téléphone). Au-delà, c'est la sortie de l'instance et le CPU des révélations et des réveils.
- **Piste, dans l'ordre** :
  1. un instantané de téléphone **sans `connected`**, avec un simple `connectes: number`, dédoublonné à part de celui des écrans : les veilles ne repartent plus qu'à l'écran commun ;
  2. un regroupement proportionnel à la salle, `120 + 2 × N` ms ;
  3. plus tard (M), l'instantané léger de perf-temps-reel : le haut du classement, sa propre ligne à part. Il change le protocole (`shared/events.ts`) et touche aux homonymes de l'entrée (`Entree.tsx:92`, `:564`).
- **Invariants** : 4 (deux versions, chacune dédoublonnée) et 17 (`nomAffiche` inchangé).

#### T4. Chaque réponse recalcule et sérialise N vues, puis réécrit tout l'état — optimisation · P2 · S à M (P1 dès 300)

- **Sources**, dédoublonnées : perf-serveur constat 3, perf-temps-reel constat 4.
- **Preuve** :
  - `handlePlayerAction` → `run` → `persist` + `fanout` → `changed` (`engine.ts:197-206`, `:343-392`, `:422-437`, `:455-460`, `:463-486`) ;
  - pendant une question, `playerView` ne dépend que de l'état commun et de **sa** réponse (`quiz.ts:731-790`, vérifié). La vue de l'écran commun change à chaque réponse (`quiz.ts:835`, `answeredCount`) ;
  - l'accusé part après tout cela (`sockets.ts:410-411`).

  Les deux experts concordent. À 500 invités, `changed` et `persist` font ≈ 75 % du moteur seul (perf-serveur), et `fanout` et `persist` ≈ 62 % du serveur complet (perf-temps-reel, qui compte aussi les écritures réseau).
- **Piste** :
  1. une rediffusion ciblée, **déclarée par le module** (`vueDependDesAutres: false`), à l'auteur plus l'écran commun, tant que l'`empreinte()` ne bouge pas. Un test d'équivalence : une partie de 30, réponse par réponse, doit envoyer les mêmes vues ;
  2. `persist` regroupé au tour de boucle (`setImmediate`), sans risque. Une fenêtre de 250 ms, en revanche, ferait perdre une réponse accusée sur un SIGKILL **sans** disque effacé, ce qui n'arrive pas aujourd'hui : c'est un arbitrage. Les chronomètres restent persistés immédiatement (invariant 5).

  Gain estimé, non rejoué : question à 500 de ~1 s à ~0,35 s.

#### T5. La clôture attend environ 5 allers-retours Turso par profil, en série — optimisation · P2 · M

- **Source** : perf-serveur, constat 5.
- **Preuve** : `crediterExperience` (`space.ts:445-497`) et `crediterCloture` (`space.ts:965-1010`), dans une boucle `for … await`. Par profil :
  - `creditPrecedent` : 1 aller-retour ;
  - `creditSoiree` : 2 ;
  - `historiqueOf`, via `accorderPaliers` : 1 ;
  - `eclatDeLaSoiree` : 1 ;
  - `byId` est en mémoire ;
  - s'y ajoutent environ 5 allers-retours si un palier tombe.

  Soit environ 5 par profil, et non 8. Cela concorde avec les 66 requêtes mesurées pour 12 profils. Mesuré : 6,7 s à 100 ms de latence, 26,5 s à 400 ms. Extrapolation : 100 profils × 5 × 30 ms ≈ 15 s avant que la salle lise « c'est fini ».
- **Piste** : un parallélisme borné (6 à 8 profils en vol) à l'intérieur de `enFile`, et `creditSoiree` + `recalculerTotal` en un seul `batch`.
- **Invariants** : 18 (la fin de soirée part toujours après l'effacement) et 10 (le crédit reste idempotent).

#### T6. Le recalcul au barème du jour passe avant l'ouverture du port, en série — optimisation · P2 · S à M

- **Source** : perf-serveur, constat 4 (latence simulée : 68 s pour 101 soirées).
- **Preuve** : `server.ts:271` passe avant `listen` (`server.ts:558`). `recalcul.ts:88-107` fait, pour **chaque** archive, `archives.get` (téléchargement **complet** et analyse de l'archive, ce que la mesure à latence fixe ignore), puis un `creditSoiree` par profil, en série.
- **Qui ça touche** : le premier démarrage après un `VERSION_BAREME` incrémenté. L'effet sur l'échéance de déploiement de Render n'est pas vérifié.
- **Piste** : un `batch` par soirée.

#### T7. Chez soi, le miroir `file:` écrit dans la boucle, et les inscriptions des voisins font la queue — optimisation · P3 · S

- **Source** : perf-temps-reel, constat 3 (l'expert le classait P2).
- **Preuve** : `pousser` → `pomper` → `envoyer` → `client.batch` (`backup.ts:555-588`, `:644-669`, `:703-708`). Mon profil voit `run` de libsql **dans la pile** de `pousser`, donc synchrone. Chaque invité paie sa transaction, d'où l'escalier des cinq salons de 60 (311 → 1 104 ms).
- **Portée** : `file:` n'est le défaut que chez soi (`index.ts:50`). En ligne, Turso est asynchrone et les envois se regroupent d'eux-mêmes. Plusieurs grandes salles sur un même PC sont rares, d'où P3. Mais cela rend **pessimistes** les chiffres d'inscription de tous les experts.
- **Piste** : un `setImmediate` avant de pomper (code de perf-temps-reel), en vérifiant que l'arrêt (SIGTERM) vide bien la file (invariant 13).

#### T8. Le rangement après chaque quiz réécrit toute l'archive, dans un format verbeux — optimisation · P3 · M

- **Source** : perf-serveur, constat 6.
- **Preuve** : `space.ts:533-583` enchaîne `buildArchive`, `sha1` et `archives.save` de la ligne entière. Mesuré ici : 447 Ko à 30 × 40, 2,2 Mo à 150 × 40.
- **Piste** : un format en colonnes, `v: 2`, lu comme `decodeDetail`. Après T1, qui supprime déjà la relecture.

### Chargement

#### C1. La compression à la volée produit du brotli 4, plus gros que gzip, et coûte la moitié du CPU d'une arrivée — optimisation · P2 · S

- **Sources**, dédoublonnées : perf-chargement constat 1, perf-observateur constat 2.
- **Preuve** : `server.ts:167` (`compression()`) ; `node_modules/compression/index.js:65` (brotli qualité 4 par défaut). J'ai rejoué les tailles sur `client/dist` :

  | Fichier | brut | gzip 6 | brotli 4 (à la volée) | brotli 11 |
  |---|---|---|---|---|
  | `index-Dj7U8XGy.js` | 206 416 | 65 654 | 65 703 (6 ms) | 56 370 (392 ms) |
  | `index-DYfM5twH.css` | 86 697 | 17 113 | 18 163 | 14 835 |
  | `Niveau-CvMwzCpU.js` | 59 460 | 16 153 | 16 379 | 13 827 |
  | `HostApp-BQXTD84a.js` | 54 584 | 17 021 | 17 391 | 15 267 |
  | `PlayerApp-UtlCPKG8.js` | 36 116 | 10 731 | 11 120 | 9 734 |

  perf-observateur mesure la recompression à 15 ms de CPU pour les 30 ms d'une arrivée. Les fichiers sont pourtant immuables (`server.ts:522-532`, cache d'un an).
- **Piste** : précompresser au build, en brotli 11 et en gzip, et servir le fichier `.br` ou `.gz` avant `express.static`. Code chez perf-observateur, constat 2. `compression()` laisse passer une réponse déjà encodée. Un test : `Accept-Encoding: br` reçoit `Content-Encoding: br`, et le même contenu une fois décompressé.

#### C2. Les médaillons et `Carriere` sont sur le chemin de l'invité anonyme — optimisation · P3 · S

- **Preuve** : `Avatar.tsx:4-5` importe `Legendaire` et `Divin` statiquement ; `CarteJoueur.tsx:8-10` importe `Carriere` ; `PlayerApp.tsx:17`, `:20-21` et `Entree.tsx:14` suivent. Tailles construites : `Niveau` 59 460 o, `Carriere` 16 885 o.
- **Gain** : ≈ 21 Ko et ≈ 0,1 s (estimé).
- **Piste** : `lazy()`, avec l'emoji en attente.

#### C3. Le préchargement des polices retarde l'écran d'entrée — tension (commentaire d'`index.html`) · P3 · S

- **Preuve** : `client/index.html:27-28`.
- **Gain** : −157 ms mesurés sur l'écran d'entrée, sans saut de police visible. Ne pas le remplacer par des `modulepreload`, mesurés pires (+52 ms).

#### C4. Pendant une seconde, l'invité regarde « Chargement… » — idée · P3 · S

- **Piste** : un repli qui nomme la soirée. Perçu seulement ; non vérifié au-delà du rapport.

#### C5. Le démarrage passe par `tsx` — optimisation · P3 · M

- **Preuve** : `render.yaml:64`, `MISE-EN-LIGNE.md:163`.
- **Gain** : −0,4 s en local (paquet `esbuild`). Sur Render, la minute de réveil de l'hébergeur domine ; non mesuré.

#### C6. Un seul CSS et React DOM — optimisations · P3 · M / L

- Le CSS unique pèse 86 697 o, dont 10 % servent à l'invité. Le découper : P3 · M.
- React DOM fait 78 % du script d'entrée. Passer à Preact : P3 · L, **en tension** avec « très peu de dépendances » : c'est un remplacement de moteur.

#### C7. Un commentaire périmé — P3 · S

- `server.ts:165-166` annonce « 320 Ko à nu, 100 Ko compressé ». C'est aujourd'hui 381 Ko et 121 Ko sur le chemin de l'invité.

### Rendu

#### R1. Les légendaires animés font refaire style et mise en page à chaque image — optimisation · P2 · S (P1 pour une salle d'habitués)

- **Preuve** :
  - `styles.css:3215-3240` anime `transform` sur les formes **internes** du SVG (`.lg *`), que Chromium ne compose pas ;
  - l'A/B de perf-rendu, en deux tours, fait tomber les mises en page de 14 à 0 par seconde, et le fil principal de 188 à 27 ms/s, en figeant `.lg *` ;
  - `prefers-reduced-motion` fige déjà les légendaires et les Divins (`styles.css:3348`, `:3520`) : le gel est donc acceptable à l'œil.
- **Réserve** : la salle mesurée est forcée (un tiers de légendaires). Le premier légendaire tombe vers la vingtième soirée.
- **Piste** : figés dans les listes, animés au podium, à la clôture, sur la carte et sur le profil.

#### R2. Le chronomètre anime `width` : 60 mises en page par seconde pendant toute la question — optimisation · P3 · S

- **Preuve** : `TimerBar.tsx:31-34` (`setInterval` à 100 ms) ; `:59` (`style={{ width }}`) ; `styles.css:1150-1154` (`transition: width 0.12s`).
- **Gain** : l'A/B donne 196 → 49 ms/s au téléphone avec `scaleX`.
- **Vérifié pour l'équipe** : l'animation `throb` de l'état urgent n'anime que l'opacité (`styles.css:1819-1822`). Il n'y a donc pas de conflit avec un `transform: scaleX` (le piège du `transform` écrasé, `CLAUDE.md`). L'échéance reste lue à `serverNow()` (invariant 6).

#### R3. L'écran commun se redessine en entier à chaque réponse — optimisation · P3 · S à M (P2 à 300 et plus)

- **Preuve** :
  - `answeredCount` change à chaque réponse (`quiz.ts:835`), et la vue part aussitôt (`engine.ts:430-435`) ;
  - elle est rangée dans le magasin global (`client/src/socket.ts:52-54`), lu par `HostApp` entier (`HostApp.tsx:227-228`, `useAppState`), sans `memo` ;
  - mesuré : 23 messages/s à 140 invités, 60 images/s tenues.
- **Piste** : regrouper côté serveur la vue de l'écran commun pendant la phase `question`, au plus 4 envois par seconde. Même idée que T4.

#### R4. Les listes de la salle d'attente ne sont pas mémoïsées — optimisation · P3 · S

- Une longue tâche de 151 ms au retour en salle, à 140 invités.

#### R5. Précharger la photo pendant l'observation — sans objet

- Voir « Ce qui n'est pas confirmé ».

---

## L'ordre de correction, dédoublonné

| # | Constat | P · effort | Pourquoi d'abord |
|---|---|---|---|
| 1 | **T1** — cache des pages publiques, avec la promesse en vol, et pas de rafraîchissement d'un onglet caché | **P1** · S à M | la seule panne mesurée qui gèle **tous** les espaces : 32 s au dixième de cœur |
| 2 | **E1** — réserve d'inscriptions par `(adresse, espace)`, et **vérifier l'adresse lue derrière Render** | P2 (P1 si l'adresse est celle d'un proxy) · S | un bug entre espaces, et un doute de production qui peut toucher chaque soirée |
| 3 | **C1** — précompression au build | P2 · S | −15 ms de CPU par arrivée (la moitié), −15 % d'octets |
| 4 | **Mesures en production** (dernière section) | P2 · S, puis M | sans elles, rien de ce qui précède ne se confirme sur Render |
| 5 | **T3** — instantané des téléphones sans `connected`, regroupement proportionnel | P2 · S | la veille et les arrivées ne repartent plus à toute la salle |
| 6 | **T2** — `MAX_PLAYERS=150` vérifié sur les deux services, et un mot dans les réglages | P2 · S | le seul garde-fou contre la salle de 300 qui casse |
| 7 | **T4** — rediffusion ciblée et `persist` au tour de boucle | P2 · S à M | ce qui ouvrirait 300 invités |
| 8 | **T5** — clôture parallélisée par profil | P2 · M | la fin de soirée à l'heure pour une grande salle |
| 9 | **T6** — recalcul regroupé par soirée | P2 · S à M | un déploiement de barème sans minutes de 502 |
| 10 | **R1** — légendaires figés dans les listes | P2 · S | la fête à 60 images/s quand la bande vieillira |
| 11 | E2, E3, E4, T7, T8, C2 à C7, R2 à R4 | P3 | confort, ou cas rares |

---

## Ce qui est solide — à garder

- **Le cloisonnement.**
  - `bindSpace()` n'est posé qu'une fois (`sockets.ts:198-252`).
  - Le moteur ne connaît que sa partie (`engine.ts:199`, `:324-330`) ; l'API lit l'espace dans la session.
  - Il y a des salons `space:`, `hosts:` et des salons `player:` tirés au hasard.
  - Résultat : 0 fuite partout, tablée réelle comprise ; les homonymes restent chez eux.
- **Rien ne fait tomber le processus.**
  - `ecouter()` protège chaque message, et les chronomètres sont sous `try/catch` (`engine.ts:395-411`).
  - Aucune erreur en une heure réelle, ni sur 3 192 réponses simulées, ni dans mes essais.
- **Les redémarrages.** Quatre sortes de coupure ont été essayées. Chaque partie reprend, chronomètres réarmés sur l'échéance persistée (`engine.ts:119-155`), la révélation 1 501 à 1 512 ms après l'échéance d'origine (`GRACE_MS`, `quiz.ts:78`). C'est l'invariant 5.
- **Le dédoublonnage des vues** (`lastSent`) : 2 messages par réponse, 15 vues par téléphone et par quiz, quelle que soit la salle. **`vctx.memo`** : le podium de 500 se calcule en 5 ms.
- **L'instantané regroupé et dédoublonné** (invariant 4) : 4,5 messages par invité et par question, quelle que soit la taille.
- **Le miroir isolé du jeu.** À 400 ms de latence, ni l'accusé ni la révélation ne bougent. La fusion divise les requêtes par quatre, et la file est bornée.
- **`enFile` par espace, avec des lignes remplacées et des totaux en `SUM`.** Trois clôtures dans le même tour de boucle n'ont rien perdu ni rien doublé.
- **La mémoire.** De 115 à 235 Mo, sans fuite, ni côté serveur ni sur 30 questions au navigateur.
- **Le paquet.** Le découpage par route, les fichiers immuables un an, la page revalidée (606 octets au rechargement), `websocket` d'abord, et un CLS nul à l'entrée.
- **`/healthz`** reste un 200, bon marché et sans nom d'espace : trois propriétés à garder en l'enrichissant.

## Ce qui n'est pas confirmé, ou est écarté

- **Le serveur mort pendant une vague d'arrivées** (perf-serveur, constat 8) : non reproduit par l'expert, relancé deux fois. Collision de port probable.
- **La queue des inscriptions en ligne** (perf-temps-reel, constat 3) : le mécanisme est propre au miroir `file:`. Avec Turso, c'est non mesuré, et probablement sans objet (T7).
- **Le gain d'`esbuild` sur Render** (perf-chargement, constat 5) : mesuré en local seulement.
- **Précharger la photo pendant l'observation** (perf-rendu, constat 5) : **sans objet**. Le téléphone reçoit et affiche **déjà** la photo pendant l'observation (`quiz.ts:745-755`, `PlayerView.tsx:219`). Sans observation, la précharger enverrait l'énoncé avant la question, ce qu'interdit l'invariant 1. Écarté.
- **« Les pages du lendemain sont lentes »** (perf-observateur, constat 5) : **écarté côté serveur**. Un souvenir archivé de 30 × 40 coûte 11 à 13 ms (mesuré). La seconde vient du navigateur (chargement du morceau, rendu) et du banc (≈ 380 ms de stabilisation par `toucher`).
- **Les /healthz à 89 et 119 ms du début de tablée** : ils viennent du banc, pas du serveur (perf-observateur).
- **« À la portée de n'importe quel script »** (E3) : il faudrait tenir à la milliseconde la première arrivée de deux espaces. Et le dommage ne touche que les profils présents dans les deux soirées.
- **Les chiffres extrapolés « ×10 »** : confirmés en ordre de grandeur par l'émulation (×8,7). La nature du dixième de cœur de Render (plafond strict ou part garantie) reste **inconnue**.
- **Risques plausibles, non mesurés** :
  - l'adresse derrière le proxy de Render (E1) ;
  - des espaces jamais déchargés du registre (`spaces` de `/healthz`) : de la mémoire sur des jours, peu probable sur l'offre gratuite, qui redémarre souvent ;
  - la somme des salles, non bornée (T2) ;
  - le `fsync` du disque de Render sous `persist` à chaque réponse.

---

## Les mesures à ajouter en production

**Pourquoi** : sur Render, rien ne dit aujourd'hui si le serveur tient. `/healthz` (`server.ts:353-364`) ne donne que le RSS, et deux de ses champs trompent :
- `spaces` compte les espaces chargés depuis le démarrage, pas les soirées vivantes (`:359`) ;
- `quizzes` compte une partie arrêtée sur son podium (`:361`).

**Les contraintes** : tout reste agrégé, sans aucun nom (la route est publique), lu en O(1), et **toujours un 200** (un échec redémarre l'instance, disque effacé). Chaque réveil de l'offre gratuite remet les compteurs à zéro : ce qui compte doit aussi partir au journal.

**Dans `/healthz`**, sur la dernière minute (esquisse chez perf-observateur, constat 1) :

| Champ | Ce qu'il dit | Comment |
|---|---|---|
| `charge.cpuPct` | le CPU du processus, tous fils (zlib compris) | `process.cpuUsage()` |
| `charge.boucleOccupeePct` | la part du temps où la boucle travaille | `performance.eventLoopUtilization()`, sans minuteur |
| `charge.retardBoucleP99Ms`, `…MaxMs` | ce qu'attend un message d'invité | `monitorEventLoopDelay` à **20 ms de résolution au moins**. À 1 ms, il a presque doublé le CPU du jeu mesuré ici (A/B, ×1,8) |
| `charge.retardChronosMaxMs` | de combien une révélation a sonné en retard (invariants 5 et 6) | `Date.now() - deadline` dans le rappel d'`armTimer` (`engine.ts:395-411`) |
| `memoire.tasMo`, `connexions` | une fuite ; les sockets ouverts | `process.memoryUsage().heapUsed` ; `io.engine.clientsCount` |
| `espacesActifs`, `quizEnCours`, `podiumsAffiches` | ce qui vit vraiment ; « puis-je déployer ? » | un filtre sur `registry.all()` et la phase de la partie |
| `miroir.latenceP95Ms`, `miroir.enAttenteMax` | Turso, au pire de la minute | chronométrer `envoyer` (`backup.ts:703-708`) |
| `diffusion.koParMin` | ce que le serveur envoie, instantanés à part | `json.length × taille du salon` dans `sendSnapshot` (`space.ts:757-765`) |
| `pages.p95Ms`, `pages.maxMs`, `pages.parMin` | le coût du souvenir et du bilan (T1) | un chronomètre autour de `server.ts:401-462` |
| `inscriptions.refusParMin`, `inscriptions.clesDistinctes` | la réserve (E1), et si elle compte vraiment des clients distincts | autour de `joinBudget.take` (`sockets.ts:322`) |
| `reponses.tropTardParMin` | des réponses refusées parce que le serveur a pris du retard | les refus `too-late` de `handlePlayerAction` |

**Au journal, une ligne à chaque fois** :
- **au démarrage** : « prêt en X ms », avec, s'il a tourné, le recalcul au barème : soirées, requêtes, durée (`server.ts:271`) ;
- **à la clôture** : invités, questions, durée, « crédits en X ms, R requêtes distantes », octets diffusés ;
- **pour une page publique de plus de 500 ms** : sa taille et son type (souvenir ou bilan, en cours ou archivé) ;
- **au premier refus de la réserve** pour une clé, dans la minute : une empreinte de la clé et le **nombre d'entrées** de `x-forwarded-for` ;
- **à chaque clôture** : le nombre de clés distinctes vues par la réserve, rapporté au nombre d'invités. Plusieurs entrées ne prouvent rien seules, car un client peut envoyer son propre en-tête. En revanche, si toute une salle de téléphones en 4G tombe sous une ou deux clés, `clientIp()` lit l'adresse d'un proxy, et E1 passe en P1 ;
- **pour un chronomètre qui sonne plus d'une seconde après son échéance**.

**Une mesure à faire une fois, sur la préproduction** : c'est la même offre, avec sa propre base Turso. Il s'agit d'y pointer `charge-verif.mjs`, sans `--quota` puisque le vrai quota s'appliquera, avec quelques ruées et dix salons de 30. Il faudra plusieurs adresses sources, ou `--etalement`, à cause de la réserve.

On y apprendra :
- si le dixième de cœur est un plafond strict ;
- ce que coûte vraiment Turso depuis Francfort ;
- ce qu'y donne T1 : 50 GET du souvenir d'une soirée de 150.

---

## Sources

- **Rapports vérifiés** : `retours/2026-09-24/experts/perf-serveur.md`, `perf-temps-reel.md`, `perf-chargement.md`, `perf-rendu.md`, `robustesse-espaces.md` ; `export/evaluations/rapports/perf-observateur.md` ; `export/evaluations/verification/salons-marc-lea.md`.
- **Mes mesures**, dans `export/evaluations/verification/perf/` :
  - `charge-verif.mjs` et `serveur-verif.ts` : le harnais de perf-temps-reel, sorties redirigées, avec l'histogramme réglable par `SANS_ELD` et `ELD_RES` ;
  - `souvenir-quota.mts` et `serveur-garde.mts` : la rafale du souvenir, avec `souvenir-resultats.jsonl` ;
  - `repos.mjs` et `serveur-mesure.mts` : le CPU au repos ;
  - `temps-reel/*.json` : les résultats ; `temps-reel/profils/prof-50/` : le profil CPU.
- **L'adresse du client derrière Render** : les pages n'ont pas pu être lues depuis ce conteneur (proxy). Seuls les extraits des moteurs de recherche ont servi :
  - [Send the correct X_FORWARDED_FOR — Render Feature Requests](https://feedback.render.com/features/p/send-the-correct-xforwardedfor)
  - [Accessing client IPs in a Node/Express app — Render Community](https://community.render.com/t/accessing-client-ips-in-a-node-express-app/36282)
  - [How Render handles DDoS attacks — Render](https://render.com/articles/how-render-handles-ddos-attacks)
  - [X-Forwarded-For — MDN](https://developer.mozilla.org/docs/Web/HTTP/Headers/X-Forwarded-For)
