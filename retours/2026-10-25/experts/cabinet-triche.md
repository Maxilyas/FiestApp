# Le Cabinet de curiosités — rapport de l'expert triche, horloges et requêtes forgées (`cabinet-triche`)

## En bref

Le Cabinet tient bien face aux requêtes forgées : le pli est déterministe (huit mille parties au hasard, gestes valables et forgés, relues sans un écart ni un geste ignoré), chaque clé venue du téléphone passe par une `Map`, chaque écriture est gardée par la base (D9), la graine d'Éclairer et celle de la visite ne sortent jamais, et une cinquantaine de requêtes piégées (clés du prototype, nombres qui n'en sont pas, dix mille signes, geste d'un autre jeu, carte-bonus qu'il n'a pas) se refusent toutes en mots, sans rien écrire. Les failles sont ailleurs : dans ce que le serveur laisse décider à la page (le voile de la pause), et dans ce que la forme d'une manche dit d'elle-même (les leurres du Détail). Les trois améliorations qui rapporteraient le plus : **(1)** poser le voile de « Quitter ? » au serveur et faire compter la pause quand elle fait gagner du temps (aujourd'hui, trente secondes par manche, la question sous les yeux, sans que la partie soit « aidée ») ; **(2)** tirer les leurres du Détail dans une fenêtre qui ne désigne pas la bonne (aujourd'hui, 52 % de bonnes réponses sans regarder l'image, contre 25 %) ; **(3)** déplier les composés du Cabinet pour la fraîcheur de toute la campagne, duels compris.

## Méthode

Lecture du code du Cabinet sur la branche `ccr-95f7b600-x1amjl` (HEAD `50c327c` ; la dernière vérification complète, verte, date de `757855b`) : `server/src/cabinet.ts` ; `server/src/core/cabinet/{magasin,ecriture,vue,tables,gardiens}.ts`, `tirages/{index,communs,pari,eclair,epingle,detail}.ts`, `server/src/core/details.ts`, `core/porteDeLaCampagne.ts` ; `shared/cabinet/{partie,lecture,chrono,musee,pouvoirs,pieces,bareme,vues}.ts`, `jeux/{regle,outils,pari,eclair,mot,filet,detail,frise,epingle,indices,replique}.ts` ; `shared/missions.ts` (`hasardDe`), `core/jumelles.ts` ; les passages de `core/campagne.ts` qui lisent le Cabinet (signalement, duel classé). La règle `.claude/rules/cabinet.md` en entier, `docs/produit/le-cabinet.md` (série, Scarabée, pause), `docs/produit/vue-d-ensemble.md` (les partis pris), la section du Cabinet de `docs/reference/api-http.md`. Les tests existants survolés pour ne rien refaire : `cabinet-secret`, `cabinet-routes`, `cabinet-pouvoirs`, `cabinet-poussiere`, `cabinet-charge`, `cabinet-chronos` (lu en entier pour la pause). Les retours de la tablée du 25 octobre (`export/tablee/2026-10-25-22h07/retours/`, Lucas surtout, qui a cherché des failles à la main) : rien de ce qu'elle a vu n'est redit ici comme neuf.

Ce que j'ai écrit, tout dans `export/evaluations/cabinet-triche/` (lancé un fichier à la fois, `nice -n 10`, charge de la machine entre 0,4 et 1,7) :

| Fichier | Ce qu'il fait | Aujourd'hui |
|---|---|---|
| `pli-au-hasard.test.ts` | 8 000 parties des neuf jeux sous sept cartes-bonus, gestes valables et forgés, heures qui sautent ; chaque geste accepté écrit en JSON puis relu `duServeur`, la relecture comparée à l'état | passe — ce qui tient |
| `gestes-forges.test.ts` | une cinquantaine de requêtes piégées contre chaque route | passe — ce qui tient |
| `pause-sous-le-voile.test.ts` | la pause de « Quitter ? » rejouée par les routes et par le pli (constat 1) | **échoue** (4 épreuves) |
| `detail-par-les-voisins.ts` (+ `.txt`, sa sortie) | les 1 000 propositions possibles du Détail, résolues sans l'image (constat 2) | mesure |
| `eclair-hors-des-vues.test.ts` | les vues de la campagne après une manche de l'Éclair (constat 3) | **échoue** |
| `retente-oracle.test.ts` | l'œuvre visée d'une case manquée, retrouvée par les refus (constat 4) | **échoue** |
| `quitter-d-emblee.test.ts` | dix départs quittés aussitôt ; trente jours de visites quittées (constat 5) | passe — elle mesure |

Les épreuves qui échouent sont écrites pour passer le jour où c'est corrigé ; leur message d'échec dit ce que fait le code d'aujourd'hui. Lancer : `cd server && nice -n 10 node --import tsx --test --test-timeout=120000 ../export/evaluations/cabinet-triche/<fichier>.test.ts`. Rien n'est resté allumé : chaque banc se ferme en fin de fichier.

Pas couvert : la page elle-même (`Partie.tsx` et ses écrans, au navigateur) — seul ce que le serveur rend compte pour cet angle ; deux vrais processus pendant une mise en ligne (les gardes D9 ont leurs épreuves à deux magasins, `cabinet-charge.test.ts`, que je n'ai pas refaites) ; le contenu livré, juge par juge.

## Constats

### 1. La pause de « Quitter ? » donne trente secondes par manche, la question sous les yeux, sans que rien le marque

- **Où** : `server/src/core/cabinet/vue.ts:256` (la manche montrée tant qu'elle n'est pas tranchée, pause comprise) ; `shared/cabinet/partie.ts:524-540` (sous la pause, seule la réponse passe, à l'échéance reculée), `:355-360` (`marquerLeTemps` compte la pause comme du temps normal), `:690-691` (`aidee` ne lit pas la pause) ; `shared/cabinet/chrono.ts:63-72` (`pauseCompteeMs`, `echeanceDe`) ; `bareme.ts:189` (`PAUSE_MAX_MS`, « la confirmation ne s'achète pas du temps de recherche »).
- **Constat** : la règle promet que la pause ne s'achète pas de temps de recherche, parce que la manche est voilée. Le voile n'existe qu'à la page (`VoileDeLaPause`) : la vue que le serveur rend au geste `pause` porte la manche entière — à la Réplique, la réplique et ses quatre mots —, l'image du Détail se sert sous la pause, et l'échéance recule de toute la pause. Une pause d'une seconde à l'ouverture, « Continuer » trente secondes plus tard, et la manche dure trente secondes de plus — 25 s deviennent 55 s à la Réplique. La pièce reste sans `joker`, la partie n'est pas « aidée » : le cadre doré reste à portée, et au Pari la première question sort nue (mesure des difficultés, précision, L'Érudit). La carte « Prendre son temps » la plus forte (le Tigre, +30 s) marque chaque réponse qui s'en sert et ferme le cadre doré : la pause, gratuite et sans carte, fait mieux qu'elle.
- **Preuve** : `pause-sous-le-voile.test.ts`, quatre épreuves qui échouent aujourd'hui. La vue de la pause : `{"jeu":"replique","etape":1,"avant":"Vive le","apres":" libre !","mots":[{"mot":"Québec"},…]}`. Le mot choisi 54 s après l'ouverture d'une Réplique passe et vaut ★★★, sa pièce `joker` NULL ; le même geste au même instant sans pause : 400 « Le temps de cette manche est écoulé ». Au pli : trois manches parfaites répondues 29 s après leur durée normale — sous la pause `aidee false, cadre doré true`, sous le Tigre `aidee true, cadre doré false`. Une chasse à la Cagnotte sous trois pauses : `gagnee-doree, aidee false`.
- **Qui ça touche, ce que ça coûte** : n'importe qui avec les outils du navigateur — ou qui a lu la question avant de toucher « Quitter » et cherche ailleurs pendant la pause. Le cadre doré (une dorure vaut 100 à 320 poussières d'or), les étoiles des manches courtes (Réplique 25 s, Pari 35 s), et, au Pari, des réponses aidées comptées nues au savoir de la campagne. La tablée l'avait frôlé sans le voir : Lucas a vu le chrono repartir sous le voile au-delà de 30 s (sa gêne n° 5), pas les trente secondes gagnées.
- **Statut** : bug confirmé (rejoué). Il heurte le parti pris 2 (« un écran ne reçoit que ce qu'il doit montrer »).
- **Piste** : deux pas, l'un sans débat, l'autre un choix de produit. (a) Sous la pause, la vue ne porte pas la manche (`enCours` absent quand `phaseDe(e) === 'pause'`), et la route d'un cadrage refuse sous la pause ; la page l'a déjà, mais un téléphone qui recharge sous « Quitter ? » ne la relit plus. (b) Une réponse qui n'arrive à l'heure que grâce à la pause marque l'étape comme le temps en plus — dans `marquerLeTemps`, comparer à `e.ouverteLe + e.dureeNormaleMs + e.graceMs` sans la pause comptée, ou une marque à part —, ce qui ferme le cadre doré et rend la pièce aidée ; c'est une règle que le pli juge : elle monte `VERSIONS_DU_DEPART` (règle `cabinet.md`). Autre voie : borner la pause à quelques secondes (le temps de lire la confirmation), un chiffre figé au départ, sans version.
- **Priorité · effort** : P2 · S pour (a), M pour (b) avec sa version et ses épreuves.

### 2. Le Détail se résout sans regarder l'image : les leurres désignent la bonne réponse

- **Où** : `shared/cabinet/jeux/detail.ts:112-136` (`detailTire`) ; `server/src/core/cabinet/tirages/detail.ts:41` ; `bareme.ts` (`VOISINS_EN_ANNEES` = 5).
- **Constat** : chaque tableau se propose avec trois leurres pris parmi ses cinq voisins les plus proches en années — un ensemble fixe, le même à chaque partie, que la page reçoit tel quel (les quatre titres). Qui connaît les années du catalogue (chaque révélation les dit : `DetailRevele.tableau.annee` ; cent tableaux, cartographiés en une soirée de parties libres) cherche, parmi les quatre, celui dont les cinq voisins contiennent les trois autres : la bonne passe toujours ce test, les leurres souvent pas. Même sans le catalogue, les seules années des quatre titres suffisent à en gagner beaucoup : la bonne est au centre de ses voisins.
- **Preuve** : `detail-par-les-voisins.ts`, sur les 100 tableaux livrés et les 1 000 propositions possibles (trois leurres parmi cinq) : la bonne passe toujours ; un seul titre passe dans 23,9 % des cas, deux dans 29 % ; au hasard parmi ceux qui passent, **52,1 % de bonnes réponses, contre 25 % à l'aveugle** ; le titre « le plus au centre » des quatre années, 41,2 %. Au premier coup d'œil, chaque bonne réponse vaut ★★★ : une chasse d'une œuvre commune (seuil 5, deux manches justes sur trois) se gagne 53 % du temps sans voir une image, contre 16 % ; une épique (sept étoiles, trois sur trois), 14 % contre 1,6 %. Éclairer, qui efface au hasard parmi les mauvais titres, s'y ajoute.
- **Qui ça touche, ce que ça coûte** : neuf œuvres sur 84 se gagnent au Détail ; un joueur méthodique, ou un amateur de peinture qui a les dates en tête, joue le Détail sans le tableau. Rien de ce qui part n'est une réponse, mais l'ensemble des titres en est une : c'est l'invariant 1 dans sa lettre (« rien de ce qui juge n'arrive au téléphone avant le verdict »).
- **Statut** : bug confirmé (mesuré sur le contenu livré, par la règle même du tirage). La conception l'avait pesé à moitié — « plus large que cinq, l'époque redevenait un indice ; au plus proche seul, les mêmes voisins revenaient toujours ensemble » —, pas l'inférence par l'ensemble des voisins.
- **Piste** : tirer les quatre titres comme une fenêtre de quatre tableaux consécutifs dans l'ordre des années, qui contient la bonne à une place tirée au hasard (au besoin parmi les six ou sept voisins, toujours consécutifs) : chacun des quatre a alors les trois autres pour voisins, et aucun ne se distingue — ni au centre, ni par l'ensemble. Une forme de tirage qui change : le plan figé garde l'ancienne (`DetailTire` porte ses titres), aucune version à monter pour les parties en route. Le script se rejoue sur la règle neuve et doit tomber près de 25 %.
- **Priorité · effort** : P2 · S (le tireur et son épreuve).

### 3. Ce que le Cabinet révèle de la base reste « jamais vu » pour la campagne — duels classés compris

- **Où** : `shared/cabinet/pieces.ts:86-96` (`deplier` : « la série, elle, ne déplie pas ») ; `shared/cabinet/jeux/eclair.ts:160-178` (la révélation dit la bonne réponse de chacune) ; `server/src/core/campagne.ts:4057-4058` (le duel classé tire ce que ni l'un ni l'autre n'a vu, sur `journal.vuesDe`).
- **Constat** : une manche de l'Éclair pose cinq questions de la base et révèle la bonne réponse de chacune, mais sa pièce s'écrit sous un composé (`cab:eclair:<id>+…`) que seul le Cabinet déplie. Pour la série, l'épreuve, le dé et le duel classé, les cinq questions restent « jamais vues » : elles reviennent comme neuves — y compris dans un duel classé, dont le tirage écarte expressément ce que l'un ou l'autre a vu (« le duel reposait à son auteur la question vue dix minutes plus tôt »). Le Détail fait de même avec « Qui a peint… ? » (sa révélation dit le titre et le peintre ; `cab:tableau:<QID>`), une frise d'un sujet avec ses questions datées. La première réponse de campagne à ces questions compte nue : la mesure des difficultés et le modèle du savoir la lisent comme un savoir d'avant.
- **Preuve** : `eclair-hors-des-vues.test.ts` échoue : après une manche de l'Éclair, la campagne ne voit que `["cab:eclair:fil00017+cab08101+mot00017+fil00016+cab08005"]` ; aucune des cinq questions dont la révélation vient de dire la réponse. Une partie libre de l'Éclair (illimitée, trente départs par heure) en révèle quinze.
- **Qui ça touche, ce que ça coûte** : qui joue beaucoup l'Éclair arrive au duel classé — cote, ligues, confettis du lundi, bordures — avec des questions vues que le tirage croit neuves ; l'avantage croît avec le volume, il n'est pas ciblé. Le choix « la série ne déplie pas » est écrit (`decisions.md`, « une question récrite par l'Éclair peut y revenir ») — mais pour sa forme récrite, pas pour sa réponse dite à la révélation.
- **Statut** : bug confirmé (rejoué), à arbitrer avec la décision écrite.
- **Piste** : faire lire à `JournalDesReponses.vuesDe` les composés dépliés (`deplier`, le même que le Cabinet), ou les déplier une fois au rangement du journal ; le Détail, déplier `cab:tableau:<QID>` en ses questions (`tableau.questions`), comme le tireur du Cabinet le fait déjà dans l'autre sens (`vuLe`, `tirages/detail.ts:23`). Les dérivations du journal ont leur épreuve contre le SQL d'avant (`journal-des-reponses.test.ts`) : le changement s'y écrit.
- **Priorité · effort** : P3 · M.

### 4. L'œuvre visée d'une case manquée se retrouve par l'ordre des refus du départ

- **Où** : `shared/cabinet/musee.ts:473-476` (« Retenter » jugé) puis `:492-493` (la carte-bonus jugée après) ; `server/src/core/cabinet/magasin.ts:644` (le plafond des départs, trente par heure).
- **Constat** : une case manquée doit garder son œuvre secrète (« l'œuvre qu'elle visait reste à découvrir », `cabinet-secret.test.ts:535`). Une chasse forgée `{ origine: 'chasse', oeuvre, retente: true, carte: 'lg:phenix' }` passe le refus de « Retenter » sur la seule œuvre visée et tombe alors sur « Tu n'as pas cette carte-bonus » ; sur toute autre, « Retenter ne sert qu'après une visite manquée de cette œuvre ». Rien ne part : ni partie, ni chasse dépensée. La rareté et la salle de la case (`enJeu`, sur la page) bornent les candidates à trois — dix au Vestibule —, bien sous le plafond.
- **Preuve** : `retente-oracle.test.ts` échoue : « une seule candidate a un autre refus — `[["cagnotte","Tu n'as pas cette carte-bonus"]]` — et c'est l'œuvre visée : cagnotte ».
- **Qui ça touche, ce que ça coûte** : un joueur qui forge ses requêtes ; il y gagne de pouvoir « Retenter » — la chasse au jeu de la visite, que la page ne sait pas proposer — et la surprise de l'œuvre. Peu de chose en jeu : c'est un secret promis qui fuit. À noter dans le même esprit : quand la salle n'a plus qu'une œuvre manquante de la rareté d'une case, `enJeu` la désigne déjà — une tension du choix de montrer rareté et salle, pas une faille.
- **Statut** : bug confirmé (rejoué).
- **Piste** : dans `cadreDuDepart`, juger la carte-bonus avant « Retenter » (ou rendre le même refus pour « pas cette œuvre » et « pas manquée aujourd'hui »), et une épreuve dans `cabinet-secret.test.ts` : une chasse « Retenter » forgée sur chaque candidate rend le même refus.
- **Priorité · effort** : P3 · S.

### 5. Quitter d'emblée rapporte trente poussières d'or par jour, et trente jours de visites quittées réveillent le Scarabée

- **Où** : `shared/cabinet/partie.ts:745-751` (`poussiereDeLaPartie` : quatre au moins en visite et en chasse, même quittée) ; `shared/cabinet/pouvoirs.ts:208-212` (`mancheProtegee` : la manche quittée, à zéro, est « imparfaite ») ; `server/src/core/cabinet/ecriture.ts:76-92` et `magasin.ts:721-733` (la série compte le jour d'un **départ**) ; `shared/cabinet/musee.ts:195-200` (le Scarabée à trente jours).
- **Constat** : trois cases de la visite, deux chasses et cinq libres, chacune commencée sous Prudence puis quittée sans avoir répondu à rien : 4 + 4 + 4 + 4 + 4 + 2 + 2 + 2 + 2 + 2 = **30 poussières d'or**, une œuvre commune tous les sept jours sans une réponse. Et une seule visite commencée puis quittée chaque jour tient la série : au trentième, le Scarabée — un gardien légendaire, carte-bonus de force 3 — se réveille.
- **Preuve** : `quitter-d-emblee.test.ts` (passe, il mesure) : « 10 départs, … = 30 poussières d'or, solde 30 » ; « série 30 jours (record 30), Scarabée réveillé : true ».
- **Qui ça touche, ce que ça coûte** : la tablée a vu la moitié de la poussière (Lucas, gêne n° 4 : « je gagne de la poussière et une étoile sans répondre »), pas le Scarabée. Une dizaine de secondes par jour pour un légendaire. La documentation le dit d'une phrase (« les jours d'affilée avec une partie de visite ou de chasse ») : c'est la règle, pas un bogue — mais elle heurte « personne ne gagne un gardien sans le mériter ».
- **Statut** : tension avec un parti pris de la mission (la récompense méritée), confirmée par le banc. L'équilibre de la poussière est à `cabinet-equilibre` ; le Scarabée et la série sont ici.
- **Piste** : faire compter à la série le jour d'une partie qui a tranché au moins une manche par une réponse (lisible au bilan : une pièce dont `choix` n'est pas nul), ou d'une partie menée au bout ; Protéger ne porter qu'une manche jugée sur une réponse (`fin === 'jugee'`), pas une manche quittée — ce que le pli juge : version du départ. Une ligne de plus dans « Comment ça marche ? » si la règle reste.
- **Priorité · effort** : P3 · M.

## Mesures et cartes

**Le pli au hasard** (`pli-au-hasard.test.ts`) : 8 000 parties, neuf jeux, sept cartes-bonus (aucune, Éclairer 1 et 3, Changer 2 avec deux rechanges, Miser 3, Protéger 3, Prendre son temps 3), une vingtaine de sortes de gestes dont un sur six d'un autre jeu ou d'une autre manche, des pas de 0 à 90 s. Chaque geste accepté écrit en JSON et relu en geste du serveur : la relecture redonne l'état au champ près, zéro geste ignoré, les pièces à leur position, chaque bilan lisible par `lireLeBilan`.

**Le Détail sans l'image** (`detail-par-les-voisins.txt`) :

| Ce que sait le joueur | Bonnes réponses au premier coup d'œil | Chasse commune gagnée (2 sur 3) | Chasse épique gagnée (3 sur 3) |
|---|---|---|---|
| rien (le hasard) | 25 % | 16 % | 1,6 % |
| les années des quatre titres | 41 % | 37 % | 7 % |
| les années du catalogue (les révélations) | 52 % | 53 % | 14 % |

**La pause** — ce que gagne une manche, la question sous les yeux d'un téléphone qui n'affiche pas le voile :

| Jeu | Durée | Avec la pause | Gain |
|---|---|---|---|
| La Réplique | 25 s + 25 s | 30 s à partager | +60 % |
| Le Pari | 35 s + 35 s | 30 s à partager | +43 % |
| L'Épingle, le Détail, le Filet | 45 s | 75 s | +67 % |
| L'Éclair | 55 s | 85 s | +55 % |
| La Frise | 60 s | 90 s | +50 % |
| Les Indices | 75 s | 105 s | +40 % |
| Le Mot mystère | 120 s | 150 s | +25 % |

**Les requêtes forgées** (`gestes-forges.test.ts`, extrait de la sortie) : `carte "__proto__"` → 400 « Tu n'as pas cette carte-bonus » ; `chasse constructor` → 400 « Cette œuvre n'est pas au Cabinet » ; `achat lg:phenix` → 400 « Un gardien ne s'achète pas : il se réveille » ; `achat au prix objet` → 400 « Le prix a changé… » ; `rang objet` → 409 « Ce geste est passé… » ; `clore par la page`, `manche 3`, `__proto__ comme jeu`, `deux clés de jeu`, `index 99` → 400 « Ce geste ne se lit pas : recharge la page » ; `nom de dix mille signes` → 413 « Envoi trop lourd » ; `partie inconnue` → 404. Aucun 500, rien d'écrit.

## Ce qui marche — à ne pas casser

- **Le pli est une fonction pure et déterministe** : relu de la base, il redonne l'état au champ près, quelles que soient les heures et les gestes forgés (huit mille parties). C'est ce qui rend sûrs la reprise, deux onglets, deux serveurs et « Mes réponses ».
- **La lecture d'un geste** (`lireUnGeste`) refait chaque objet champ par champ, une seule clé de jeu, `clore` refusé de la page, le texte coupé par `tronquer` ; chaque règle de jeu relit ensuite à ce qu'elle a montré (`reponseEnvoyee` par `Object.hasOwn`). Aucune clé venue du téléphone ne se lit par `TABLE[cle]`.
- **Les secrets du tirage** : la graine d'Éclairer tirée par `randomUUID`, la visite par HMAC d'un secret gardé en base, le décalage de la zone de l'Épingle et l'ordre des effacés de la Réplique figés au tirage (deux remèdes cumulés), la piste du Filet du hasard du serveur. Recouper la zone d'Éclairer d'une partie à l'autre ne sert à rien : la première révélation a déjà dit la réponse.
- **Les cadrages du Détail** ne se servent qu'atteints, par l'indice du plan figé et jamais la manche ; une rechange pas prise, un tableau remplacé par Changer ne se servent jamais.
- **Les écritures gardées par la base** (D9) : un geste par rang, la poussière sous le seul geste qui finit, le solde relu dans l'instruction de la dépense, aucune dépense sous une partie qui attend — y compris pour l'œuvre d'une case de la visite, qui ne se trahit donc pas par l'achat.
- **Le chrono à l'heure d'arrivée, prise avant le verrou** : un geste qui attend le verrou n'y perd rien, et la page ne peut pas antidater (son corps est fixé à l'envoi).

## Recommandations, dans l'ordre

1. **Le voile de la pause au serveur** : `enCours` absent sous la pause, cadrage refusé sous la pause (constat 1, a) — P2 · S.
2. **Les leurres du Détail en fenêtre consécutive**, la bonne à une place au hasard ; rejouer `detail-par-les-voisins.ts` (constat 2) — P2 · S.
3. **La pause qui fait gagner du temps se marque** — ou se borne à quelques secondes (constat 1, b) : un choix de produit, avec sa version du départ — P2 · M.
4. **La carte-bonus jugée avant « Retenter »** dans `cadreDuDepart`, et son épreuve au secret (constat 4) — P3 · S.
5. **Déplier les composés pour toute la campagne** (`vuesDe`), le Détail par les questions de son tableau (constat 3) — P3 · M.
6. **Une série et un Protéger qui demandent une réponse** (constat 5) — P3 · M, après arbitrage.

## Limites

Je n'ai rien joué au navigateur : ce que la page montre sous la pause, et qu'un lecteur d'écran y lirait, n'est pas vérifié ici (elle démonte la manche, `Partie.tsx:536-537`). Le Détail est mesuré sur la règle du tirage recopiée dans le script, pour la première manche d'une partie (les suivantes écartent les tableaux déjà posés, ce qui ne change pas l'inférence) ; un joueur réel n'a pas forcément le catalogue. Deux serveurs pendant une mise en ligne ne sont éprouvés que par les épreuves existantes. Le contenu livré (66 répliques, 66 fiches, 90 lieux, 100 tableaux, 18 frises) n'est pas jugé ici, sauf pour la mesure du Détail.

## Hors mission

- **La sobriété** (`cabinet-sobriete`) : un geste au rang en avance (`rang: 1e9`) oublie le musée et la partie (`magasin.ts:775-777`) et relit la partie en base, à chaque requête, sans plafond sur la route des gestes ; un téléphone forgé peut en enchaîner autant qu'il veut.
- **L'équilibre** (`cabinet-equilibre`) : les petites réserves de contenu, revues au bout de sept jours, et tes murs qui listent les coordonnées exactes de chaque lieu épinglé, font de l'Épingle, des Indices et de la Réplique un jeu de mémoire pour qui joue tous les jours.
