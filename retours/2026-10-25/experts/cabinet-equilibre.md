# Le Cabinet de curiosités : l'équilibre — rapport de l'expert systèmes de jeu et économie

## En bref

L'économie tient : la poussière d'or reste dans le Cabinet, dix parties par jour au plus la paient, et **les confettis et l'expérience restent sous ceux d'une série** dans tous les modèles de temps essayés. La parade des libres non posée est donc tenable, et même plus solidement que ne le dit le calibrage. La collection se finit en deux semaines et demie pour un fidèle et en sept semaines et demie pour l'occasionnel ; dorer tout le musée prend six à neuf semaines au fidèle. En revanche, **l'équilibre des cartes-bonus n'a pas été mesuré**. Le calibrage juge les neuf jeux « sans carte-bonus », alors que chacun a dès la première minute quatre cartes offertes, et que Prudence ajoute une étoile dans 63 parties sur 64 sans jamais rien coûter. Deux pouvoirs à la force 3 rendent un jeu indépendant du savoir :

- **Éclairer à l'Épingle** : qui plante au centre de la zone, sans rien savoir, gagne une commune 91 fois sur 100.
- **Miser** : une seule manche parfaite gagne seule l'œuvre de sa rareté ; au Détail, deviner sans rien savoir fait une épique une fois sur quatre.

Les trois retouches qui rapporteraient le plus :

1. Décaler la zone d'Éclairer de 120 à 165 km (`DECALAGE_DE_LA_ZONE_KM`).
2. Mettre `BONUS_DE_MISE` à 1, 2 et 3.
3. Faire viser chaque jour, par une case de la visite, la salle du prochain gardien. Le premier gardien de l'occasionnel arrive alors au 18ᵉ jour au lieu du 38ᵉ.

## Méthode

Tout a été fait sur la branche `ccr-95f7b600-x1amjl` : d'abord au commit 50c327c, puis rejoué au commit 3034028, où les règles du Cabinet n'avaient pas changé. Il n'y a eu ni navigateur ni base de production. J'ai lancé un fichier à la fois, sous `nice -n 10`, sur une machine chargée de 0,7 à 2,1. Durée : environ trois heures.

- **Lu** :
  - les consignes, ma fiche et le modèle de rapport ;
  - `CLAUDE.md` et les règles `cabinet.md`, `client.md`, `tests.md`, `tablee.md` ;
  - `shared/cabinet/bareme.ts`, `pouvoirs.ts`, `partie.ts`, `musee.ts`, `oeuvres.ts`, `france.ts` ;
  - `jeux/regle.ts`, `outils.ts` et les neuf modules de jeu ;
  - `server/scripts/calibrage-cabinet.ts`, en entier ;
  - `server/src/core/cabinet/vue.ts` (le bilan), `server/test/cabinet-banc.ts` et `cabinet-poussiere.test.ts` (pour le banc) ;
  - côté page : `client/src/views/cabinet/Regles.tsx`, `Annonce.tsx`, `Visite.tsx` et `retenu.ts`, et `shared/glossaire.ts` ;
  - côté documentation : `docs/produit/le-cabinet.md`, `docs/reference/baremes.md` (le Cabinet et son calibrage) et `docs/architecture/decisions.md` (le Cabinet et le calibrage du 25 octobre) ;
  - les six retours de la tablée du 25 octobre 2026, et les rapports `cabinet-triche` et `cabinet-sobriete`, pour ne pas les redire.
- **Lancé** : `calibrage-cabinet.ts` tel quel. Sa sortie est dans `export/evaluations/cabinet-equilibre/calibrage-du-jour.txt`, et redonne au chiffre près les chiffres datés de `baremes.md`.
- **Écrit**, dans `export/evaluations/cabinet-equilibre/` :
  - `calibrage-variante.ts` : une copie du harnais du calibrage, qui joue les mêmes règles partagées sans en recopier une, et ajoute :
    - les tables des cartes, jeu par jeu (section `cartes`) : chaque pouvoir aux forces 1 et 3, chaque seuil, le cadre doré, les étoiles en partie libre, et Miser et Protéger appliqués par `etoilesApresLesPouvoirs` aux étoiles naturelles des parties sans carte ;
    - `--sans-oracle` : Changer décide sur ce que le joueur voit, et paie la lecture de ce qu'il fuit ;
    - `--modele`, `--secondes` et `--serie`, pour un autre modèle de temps ;
    - `--sans-carte` et `--force-1`, pour qui ne choisit pas de carte ;
    - `--visite-vers-le-gardien` et `--chasse-vers-le-gardien`, pour mes propositions ;
    - `--seulement`, pour ne lancer que certaines sections.
  - Les sorties : `cartes-*.txt`, `confettis-S1…S3.txt`, `musee-*.txt` et `sans-oracle-confettis-musee.txt`.
  - Trois reproductions en `node:test`, qui **échouent aujourd'hui** : `epingle-zone.test.ts`, `pouvoirs-equilibre.test.ts` (quatre épreuves) et `libre-a-zero.test.ts` (sur le banc, par les routes).
  - `tablee-parties.ts` : les 113 parties de la tablée, relues par le vrai pli sur une copie de sa base permanente.
- **Pas couvert** :
  - le comportement réel au doigt (la précision de l'Épingle sur 360 px n'est qu'un indice tiré de la tablée) ;
  - la vitesse réelle des joueurs ;
  - les gardiens de saison ;
  - un vrai historique de préproduction (il n'y en a pas).

## Constats

### 1. Éclairer à l'Épingle : le centre de la zone vaut ★★ quatre fois sur cinq, sans rien savoir

- **Où** : `shared/cabinet/bareme.ts:209` (`DECALAGE_DE_LA_ZONE_KM`, de 40 à 140 km), `shared/cabinet/jeux/epingle.ts:136-150`.
- **Constat** : le centre de la zone dorée est décalé du lieu de 40 à 140 km. Il est donc toujours à moins de 300 km (★), et à moins de 120 km (★★) quatre fois sur cinq. La page dessine ce cercle. Planter en son centre, sans lire le récit, rapporte ★★ dans 80,3 % des manches, ★★★ dans 1,1 % et ★ dans le reste. Ce ★★ est une pièce juste, payée d'un confetti. Avec une carte de force 3 (trois zones, une par manche), on gagne une commune 91 % du temps et une rare 55 %. Le savoir ne compte plus.
- **Preuve** : `export/evaluations/cabinet-equilibre/epingle-zone.test.ts` joue `epingleTiree` et `REGLE_DE_L_EPINGLE` (le vrai Éclairer et le vrai jugement) sur les 90 lieux livrés, 20 000 manches. Sortie : « ★★★ 1.1 %, ★★ 80.3 %, ★ 18.6 %, rien 0.0 % ; une commune 91.0 %, une rare 55.0 % ». Ses deux épreuves échouent. Dans `cartes-oracle.txt`, Éclairer 3 à l'Épingle fait gagner une commune à l'occasionnel 96,5 % du temps (31,8 % sans carte), au moyen 98,3 % (50,5 %). Le joueur au hasard du calibrage, lui, plante n'importe où en France (`calibrage-cabinet.ts:876`). Il ignore cette stratégie, et le plancher mesuré (0,3 %) est faux dès qu'il a la carte.
- **Qui ça touche, ce que ça coûte** : tout porteur d'une carte qui éclaire à la force 3. Ce sont quatre épiques de l'Érudit et du Devin, et cinq gardiens (la Chouette, le Lion, le Sphinx, l'Oracle, la Citrouille). Neuf œuvres se gagnent à l'Épingle. Le jeu qui devait demander de savoir où s'est passée l'histoire se joue sans la lire.
- **Statut** : bug d'équilibre, confirmé (rejoué).
- **Piste** : `DECALAGE_DE_LA_ZONE_KM = [120, 165]`, avec un rayon de 170 km : le lieu reste toujours dans la zone. Le centre ne vaut plus que ★, et ce que le joueur sait de la région fait le reste.
  - Mesuré (`cartes-zone-120-165.txt`), Éclairer 3 fait gagner une commune à l'occasionnel 47 % du temps, au moyen 63,5 %, encore au-dessus de « sans carte ».
  - Un joueur qui ne sait rien plafonne à trois étoiles.
  - Le décalage se tire au départ, avec le plan : rien ne change pour les parties jouées, et aucune version n'est à monter.
  - Le calibrage doit alors faire planter le joueur qui connaît la région dans sa région, ramenée dans la zone. Aujourd'hui, il plante au centre dès qu'il a la zone, ce qui l'y désavantage.
- **Priorité · effort** : P2 · S.

### 2. Miser : une manche parfaite gagne seule l'œuvre de sa rareté, et le Détail devient une loterie d'épiques

- **Où** : `shared/cabinet/bareme.ts:150` (`BONUS_DE_MISE` à 2, 3 et 4), `shared/cabinet/pouvoirs.ts:226`.
- **Constat** : une manche misée parfaite vaut 3 + 2, 3 + 3 ou 3 + 4 étoiles, soit 5, 6 et 7 : exactement les seuils d'une commune, d'une rare et d'une épique. Une seule manche réussie gagne donc l'œuvre de la rareté de la carte, les deux autres à zéro. Au Détail, deviner l'un des quatre titres au premier coup d'œil est parfait une fois sur quatre. Le joueur qui ne sait rien et mise à la force 3 gagne alors une épique dans 24,8 % des parties. Le complétionniste sans carte en gagne 23,3 %, l'occasionnel 6 %. À la Frise, ranger au hasard les trois premiers événements est parfait une fois sur six, ce qui donne 15,8 % d'épiques au hasard. Ailleurs, Miser est rarement utile : il fait souvent moins bien que « sans carte » vers une commune. C'est le pari des jeux où le hasard fait des manches parfaites.
- **Preuve** : `pouvoirs-equilibre.test.ts`, épreuves 3 et 4. La quatrième joue le vrai `REGLE_DU_DETAIL` sur 20 000 parties et donne « une épique dans 24.8 % des parties » ; les deux échouent. Dans la colonne `mise3` de `cartes-oracle.txt`, le joueur au hasard du calibrage gagne au Détail une épique 26,3 % du temps.
- **Qui ça touche, ce que ça coûte** : les porteurs d'une carte qui mise à la force 3 : le Trou noir, et les épiques du Flambeur et du Téméraire. Deux épiques se gagnent au Détail (Pactole, Polymorphe) et deux à la Frise (Représailles, Vent arrière). Une stratégie absurde, ne pas regarder et deviner, y bat le savoir.
- **Statut** : bug d'équilibre, confirmé (rejoué).
- **Piste** : `BONUS_DE_MISE = { 1: 1, 2: 2, 3: 3 }`. Une manche misée parfaite reste toujours à une étoile du seuil de sa rareté (4, 5 et 6).
  - Mesuré (`cartes-mise-123.txt`) : au Détail, au hasard, une épique avec Miser 3 tombe de 26,3 % à 14,5 % (joué), de 24,8 % à 10,3 % à la meilleure manche ; à la Frise, au hasard, de 15,8 % à 9,8 %.
  - Coût : Miser, déjà le plus faible des cinq pouvoirs, s'affaiblit encore. Au Mot mystère, l'occasionnel ne gagne plus une épique avec Miser 3 que 35,5 % du temps (42,3 % aujourd'hui).
  - Avec le constat 1, tout posséder prend 58 jours à l'occasionnel (52 aujourd'hui) et 122,5 au joueur au hasard (95). Le fidèle ne bouge pas (`musee-recommandations.txt`).
  - Le pli juge la mise au barème du code : la version du départ monte (`VERSIONS_DU_DEPART`), et la ligne de `baremes.md` change avec.
- **Priorité · effort** : P2 · S.

### 3. « Sans carte-bonus », le choix d'office de l'annonce, n'est jamais le bon

- **Où** : `client/src/views/cabinet/retenu.ts:35` et `Annonce.tsx:206` (sans carte retenue, l'annonce propose « Sans carte-bonus ») ; `shared/cabinet/pouvoirs.ts:208-229` et `partie.ts:691` (la règle de Protéger).
- **Constat** : Protéger n'agit que sur la première manche imparfaite. Il ne touche donc jamais une partie de trois manches parfaites, et ne retire jamais le cadre doré ni une étoile. Prudence, l'une des quatre œuvres offertes, ajoute une étoile dans 63 des 64 parties possibles et ne coûte rien dans aucune. Les trois autres cartes offertes ne coûtent rien tant qu'on ne s'en sert pas. « Sans carte-bonus » est donc toujours dominé, et c'est pourtant ce que l'annonce propose à qui n'a encore rien choisi. Effets mesurés :
  - Au Pari, Prudence fait passer l'occasionnel de 22,5 % à 63,3 % de communes, et de 2,8 % à 21,3 % d'épiques.
  - Un joueur qui laisse « Sans carte-bonus » met 94 jours à tout posséder au lieu de 52 (l'occasionnel), 27,5 au lieu de 18,5 (le moyen).
  - Son premier gardien arrive au 56ᵉ jour au lieu du 38,5ᵉ (`musee-sans-carte.txt`).
  - 63 des 109 parties de la tablée sont parties sans carte.
- **Preuve** : `pouvoirs-equilibre.test.ts`, épreuve 1, qui sort « il coûte dans 0, il ajoute une étoile dans 63 » ; elle échoue. Les tables viennent de `cartes-sans-oracle.txt`. Le décompte de la tablée, de `tablee-parties.ts` (« cartes emportées : … - 63 »).
- **Qui ça touche, ce que ça coûte** : chaque nouveau joueur, et chaque joueur qui ne pense pas à toucher « Choisir une carte-bonus ». C'est ce que montre la tablée, des agents qui avaient lu les règles.
- **Statut** : friction, et tension avec « les cinq pouvoirs tous utiles, aucun indispensable ». Confirmé (rejoué).
- **Piste** :
  - Sans carte retenue, l'annonce propose d'office une carte offerte, par exemple Prudence. C'est une constante de la page, pas une règle recopiée, et la dernière carte choisie reste retenue comme aujourd'hui.
  - Le calibrage mesure les jeux avec ces quatre cartes (constat 5).
- **Priorité · effort** : P2 · S.

### 4. Les gardiens de l'occasionnel arrivent ensemble, le premier au 38ᵉ jour

- **Où** : `shared/cabinet/musee.ts:313-341` (`visiteDuJour`).
- **Constat** : la visite tire ses trois œuvres parmi toutes celles qui manquent, au seul poids de leur rareté, dans les neuf salles à la fois. Les salles se remplissent donc ensemble, et se complètent presque en même temps.
  - L'occasionnel n'a aucun gardien à la 4ᵉ semaine, dix à la 8ᵉ, le premier au 38ᵉ jour (31 à 44 selon le parcours).
  - Le moyen l'a au 13,5ᵉ jour, puis dix en une semaine.
  - La tablée l'a senti : « 7 œuvres sur 84 et 1 gardien sur 23 après une soirée entière, c'est lent ».
- **Preuve** : `musee-base.txt` (sans oracle) et `calibrage-du-jour.txt` (le calibrage tel quel : 36 jours). La variante `--visite-vers-le-gardien` remplace l'œuvre d'une case par une œuvre qui manque dans la salle du prochain gardien (`prochainGardien`). Le premier gardien arrive alors au 18,5ᵉ jour pour l'occasionnel et au 5,5ᵉ pour le moyen, et tout posséder ne bouge pas (52 et 17,5 jours ; `musee-visite-gardien.txt`). Si le joueur chasse aussi dans cette salle, le premier gardien arrive au 10,5ᵉ jour pour l'occasionnel et au 4ᵉ pour le moyen (`musee-les-deux.txt`).
- **Qui ça touche, ce que ça coûte** : l'occasionnel, qui attend cinq semaines la première grande récompense du mode.
- **Statut** : friction, confirmé (lecture et simulation).
- **Piste** :
  - Chaque jour, une case de la visite vise la salle de `prochainGardien`, quand il lui en manque une. La page dit déjà cette salle (« Peut te faire gagner une œuvre rare de la salle du Devin ») et le prochain gardien : rien de neuf ne part, et l'invariant 1 tient.
  - La visite figée garde sa forme.
  - Avec les constats 1 et 2, mesuré (`musee-recommandations-et-visite.txt`) : premier gardien au 14ᵉ jour pour l'occasionnel et au 6ᵉ pour le moyen ; tout posséder en 51 et 17,5 jours.
- **Priorité · effort** : P2 · M.

### 5. Le calibrage mesure l'équilibre sans les cartes offertes, avec un oracle, et sans le joueur qui ne sait rien mais réfléchit

- **Où** : `server/scripts/calibrage-cabinet.ts`, à quatre endroits :
  - `:1411`, la section 1 « sans carte-bonus » ;
  - `:891`, Changer aux Indices ;
  - `:311` contre `:329`, une question du Pari à 9 s, une question de série à 20 s ;
  - `:876`, le joueur au hasard de l'Épingle.

  Et dans `docs/reference/baremes.md:775-793` et `docs/architecture/decisions.md:1863-1865`.
- **Constat** : quatre biais.
  - **(a) Les cartes offertes ne sont pas mesurées.** Le tableau des jeux (« de 24,6 % au Pari à 86,7 % à la Frise ») est celui d'un joueur sans carte. Avec la meilleure carte offerte, l'occasionnel gagne une commune entre 37 % (le Détail) et 92 % (la Frise), et le Pari passe de 22,5 % à 63,3 %. La retouche du Pari a été décidée sur le chiffre sans carte (de 3,1 % à 24,6 %) ; avec Prudence, c'était de 11 % à 63 % (`cartes-pari-garder1.txt`).
  - **(b) Changer aux Indices a un oracle.** Le joueur décide de changer de fiche au premier indice, le plus obscur, sur ce qu'il ne saurait qu'au cinquième (`!s.reconnu`). Changer 3 y fait passer la commune de 38 % à 78 % ; sans l'oracle, à 37 % : Changer n'y sert à rien. Changer ne coûte aussi que 2 s, sans le temps de lire ce qu'on fuit.
  - **(c) Le joueur au hasard ignore les stratégies sans savoir** : le centre de la zone à l'Épingle (constat 1), la mise au Détail (constat 2).
  - **(d) Les temps se contredisent.** La même question à quatre réponses de la base se répond en 9 s au Pari et en 14 s en série (20 s moins les 6 de l'anecdote). Les 8 % de plus qu'une série, chez le complétionniste avec un gardien, en dépendent.
- **Preuve** : `calibrage-variante.ts`.
  - (b) `cartes-oracle.txt` contre `cartes-sans-oracle.txt` (Indices, colonne `chan3`).
  - (d), avec des temps cohérents (`--secondes pariQuestion=14`, `confettis-S1.txt`) : le Cabinet passe sous la série pour tout le monde (complétionniste 2,35 contre 2,48 la minute).
  - Sans l'oracle, les 8 % de plus deviennent 3 % : 0,08 confetti de plus la minute au lieu de 0,19.
  - Le musée bouge peu : tout dorer passe de 193 à 206 jours pour l'occasionnel (`sans-oracle-confettis-musee.txt`).
- **Qui ça touche, ce que ça coûte** : les décisions. Les cinq retouches du 25 octobre ont été prises sur des chiffres qui ne décrivent ni le joueur averti (qui a ses cartes) ni le joueur au hasard (qui n'est pas si naïf). Les constats 1 et 2 auraient dû sortir du calibrage.
- **Statut** : test et outillage, confirmé (rejoué par la variante).
- **Piste** :
  - Reprendre dans `calibrage-cabinet.ts` la section `cartes` de la variante, ou au moins la ligne « avec la meilleure carte offerte ».
  - Faire décider Changer sans oracle, et lui faire payer la lecture.
  - Donner au joueur au hasard le centre de la zone et la mise au premier cadrage.
  - Prendre pour une question du Pari le temps d'une question de série.
  - Redire les chiffres datés de `baremes.md` avec ces deux lignes.
- **Priorité · effort** : P3 · M.

### 6. Le bilan d'une libre qui payait, finie à zéro étoile, dit que les cinq ont payé, et elle en a pris une pour rien

- **Où** : `server/src/core/cabinet/vue.ts:179` au commit 3034028 (`:176` au commit 50c327c) ; `shared/cabinet/partie.ts:746-747`.
- **Constat** : le bilan lit la poussière gagnée (`b.poussiere > 0`), pas `depart.payee`. Une partie libre qui payait, la première du jour, finie à zéro étoile rapporte 0 poussière : deux par étoile, et pas de plancher en partie libre. Son bilan dit alors « Les cinq parties libres du jour ont payé : celle-ci se joue pour le plaisir », alors qu'il en reste quatre. Et cette partie a pris l'une des cinq libres qui paient, sans rien rapporter. Dans la base de la tablée, 56 parties libres sur 80 n'ont rien rapporté (52 à zéro étoile). La tablée a vu le message faux, dans le retour de Hugo, sans en trouver la cause. « Une partie fait toujours avancer » (`docs/produit/le-cabinet.md`, « En bref ») est faux pour elle.
- **Preuve** : `libre-a-zero.test.ts` (le banc, par les routes) : « bilan : « Les cinq parties libres du jour ont payé… » ; libres qui paient encore : 4 sur 5 » ; l'épreuve échoue.
- **Qui ça touche, ce que ça coûte** : un joueur qui quitte ou rate sa première libre. Il croit ses libres épuisées et s'arrête de jouer pour la poussière.
- **Statut** : bug, confirmé (rejoué).
- **Piste** : dans `bilanDit`, faire décider `d.payee`, plus la poussière :

  ```ts
  if (!d.payee) return 'Les cinq parties libres du jour ont payé : celle-ci se joue pour le plaisir'
  return b.poussiere > 0 ? `${poussieresDites(b.poussiere)} pour ta partie libre` : 'Aucune étoile : pas de poussière d’or cette fois'
  ```

  Et retoucher la phrase de `le-cabinet.md`. Pas de plancher en partie libre : il nourrirait d'autant ce que `cabinet-triche` (constat 5) a trouvé en quittant d'emblée.
- **Priorité · effort** : P3 · S.

### 7. Prudence, offerte, vaut une rare du Rempart ; Protéger n'a jamais de prix

- **Où** : `shared/cabinet/bareme.ts:143` (`BONUS_DE_PROTECTION = { 1: 1, 2: 1, 3: 2 }`).
- **Constat** : la force 1 et la force 2 ajoutent toutes deux une étoile. Les six rares qui protègent (Contre-attaque, Cuirasse, Second souffle, Double chance, Sursis, Sang-froid) n'apportent donc rien de plus que Prudence, offerte à tous dès le premier jour. Avec le constat 3, Protéger est le meilleur pouvoir offert dans sept jeux sur neuf pour l'occasionnel. Seules l'Épingle (Éclairer) et le Mot mystère (Changer) font exception.
- **Preuve** : `pouvoirs-equilibre.test.ts`, épreuve 2 (« force 1 : +1, force 2 : +1 ») ; elle échoue. Les tables viennent de `cartes-sans-oracle.txt`.
- **Statut** : tension avec « la rareté rend plus fort », confirmé (rejoué).
- **Piste** : une option à arbitrer. Protéger de force 1 ne relèverait que la première manche **ratée** (zéro étoile), d'une étoile : un filet de sécurité. La force 2 garderait +1 à la première manche imparfaite, et la force 3 +2.
  - Mesuré (colonne `p0*`), Prudence reste utile là où l'on rate une manche : l'Épingle (46 % contre 49,3 % de communes à l'occasionnel), les Indices (51,8 contre 53,5) et la Réplique (74,8 contre 76,3).
  - Elle cesse de faire le Pari : 37,5 % de communes au lieu de 63,3, et 2,8 % d'épiques au lieu de 21,3.
  - Les rares retrouvent une raison d'être.
  - Coût : le pli juge Protéger au barème du code, et la version du départ monte. La retouche touche aussi la règle (`mancheProtegee`) : ce n'est plus seulement un chiffre.
- **Priorité · effort** : P3 · M.

### 8. Le Détail est une loterie

- **Où** : `shared/cabinet/bareme.ts:239-241` (`ETOILES_AU_CADRAGE`, `TITRES_DU_DETAIL`).
- **Constat** :
  - Répondre au premier cadrage sans rien savoir vaut 0,75 étoile par manche, en espérance.
  - Ses totaux vont par trois : pour l'occasionnel, une rare est aussi probable qu'une commune (29 % et 29 %).
  - Le joueur au hasard y gagne une commune 14 à 16 % du temps, plus qu'à tout autre jeu, et avec Prudence une épique 18 % du temps, trois fois plus que l'occasionnel sans carte (6 %).
  - Hugo l'a dit (« trop dur, 25 % de chance »).
  - `cabinet-triche` a mesuré que les leurres désignent la bonne réponse : 52 % de bonnes réponses sans l'image.
- **Preuve** : `calibrage-du-jour.txt` (le Détail au hasard, 15,9 % de communes, le premier des neuf) et `cartes-sans-oracle.txt` (au hasard avec Prudence, une épique 18,3 % du temps).
- **Statut** : tension (jeu de chance), à arbitrer.
- **Piste** : `TITRES_DU_DETAIL` de 4 à 5. Calculé : le joueur au hasard gagne une commune 10,4 % du temps au lieu de 15,6 %, une épique avec Miser 3 20 % du temps au lieu de 25 %. La retouche se fait avec celle des leurres de `cabinet-triche`, qui pèse plus. Cinq titres et leurs peintres doivent tenir en 360 × 640 : c'est à regarder.
- **Priorité · effort** : P3 · M.

### 9. Prendre son temps ne sert presque à rien, et sa phrase se lit de travers au Pari et à la Réplique

- **Où** : `shared/cabinet/pouvoirs.ts:118` (« +10 s à chaque manche ») ; `partie.ts:127-131` (le temps en plus s'ajoute à **chaque étape**).
- **Constat** : dans le modèle, l'échéance ne prend de court que 0 à 2,9 % des manches. Prendre son temps ne change donc aucune part de victoire au-delà du bruit, et n'est le meilleur pouvoir dans aucun jeu : la colonne `temp3` est égale à la colonne « sans » à ±4 points. Par ailleurs, au Pari et à la Réplique, il ajoute ses secondes à chaque étape, donc 20 s par manche à la force 1, plus que ce que promet « +10 s à chaque manche ». Jeanne, lectrice lente, a pourtant dit que Concentration l'aidait à l'Épingle : le modèle ne sait pas mesurer ce pouvoir.
- **Statut** : tension, et une promesse imprécise (dans le bon sens). Confirmé (lecture).
- **Piste** : compter en préproduction les manches qui expirent, jeu par jeu, et la vitesse réelle des joueurs, avant de juger ce pouvoir. Dire « +10 s à chaque question ».
- **Priorité · effort** : P3 · S.

### 10. Le cadre doré en jouant est hors d'atteinte au Pari, et l'annonce d'une case « pour dorer » tait le double

- **Où** : `shared/cabinet/partie.ts:667` (`cadreDore`) ; `client/src/views/cabinet/Annonce.tsx:53` et `:232`.
- **Constat** : dorer en jouant demande trois manches parfaites, donc au Pari trois paris gagnés sur des questions difficiles ou expertes. Le meilleur joueur y dore 3,5 % du temps, l'occasionnel 0,3 %. À l'Éclair, l'occasionnel dore 0,8 % du temps ; aux Indices, on dore 1,5 à 7 % du temps. Pour comparer, la Frise donne 15 à 55 %. « Rejouer pour dorer » au Pari dépense une chasse presque pour rien, et l'annonce ne le dit pas. Par ailleurs, une case de la visite « pour dorer » paie aussi un double (15 à 60 poussières) au seuil de sa rareté, mais l'annonce n'affiche alors aucun seuil (`seuil: 'rarete' in c.enJeu ? … : null`).
- **Preuve** : `cartes-sans-oracle.txt`, tableau « le cadre doré, joué pour dorer ».
- **Statut** : friction, confirmé (lecture et simulation).
- **Piste** : au Pari, que « parfaite » pour le cadre doré vaille trois premières questions justes gardées (★★ partout). Ou l'annonce le dit : « Au Pari : trois paris gagnés ». Pour une case « pour dorer », dire aussi le seuil du double.
- **Priorité · effort** : P3 · S.

### Hors mission

- `docs/produit/le-cabinet.md`, « Comment c'est construit », dit encore « Le Pari et l'Éclair s'y jouent ; un jeu qui n'a pas encore son écran s'annonce en attente ». Les neuf sont livrés (`JEUX_PRETS`).

## Mesures et cartes

### Jeu par jeu : la part des parties qui gagnent une œuvre

Le premier tableau est le jeu **sans carte** : mille parties par jeu et par joueur (`calibrage-du-jour.txt`, le calibrage tel quel). Le bon joueur et le complétionniste savent autant et vont aussi vite : leurs parties se mesurent ensemble. Doré : joué pour dorer, sans carte, sur 400 parties.

| Jeu | Au hasard : commune · rare · épique | Occasionnel | Moyen | Bon et complétionniste | Doré : occ. · moyen · compl. |
|---|---|---|---|---|---|
| L'Épingle | 0,3 · 0 · 0 % | 34 · 21 · 9 % | 53 · 34 · 17 % | 88 · 73 · 51 % | 1 · 2,5 · 13 % |
| La Frise | 12 · 3 · 2 % | 87 · 65 · 46 % | 92 · 76 · 60 % | 99 · 94 · 82 % | 15 · 24 · 55 % |
| Le Mot mystère | 0 · 0 · 0 % | 61 · 49 · 23 % | 80 · 70 · 38 % | 97 · 94 · 77 % | 13 · 18 · 52 % |
| Le Détail | 16 · 16 · 1,5 % | 30 · 30 · 5 % | 38 · 21 · 12 % | 59 · 37 · 24 % | 6 · 5 · 10 % |
| Le Filet | 3 · 1 · 0,5 % | 56 · 36 · 19 % | 71 · 52 · 33 % | 93 · 82 · 66 % | 5 · 10 · 33 % |
| Le Pari | 4 · 2 · 0,2 % | 25 · 21 · 3 % | 39 · 35 · 7 % | 71 · 64 · 24 % | 0,3 · 0 · 3,5 % |
| L'Éclair | 7 · 3 · 0,7 % | 63 · 39 · 19 % | 86 · 65 · 39 % | 98 · 94 · 82 % | 0,8 · 3 · 22 % |
| Les Indices | 0,3 · 0,3 · 0 % | 37 · 24 · 10 % | 49 · 35 · 20 % | 70 · 53 · 31 % | 1,5 · 4,5 · 7 % |
| La Réplique | 12 · 4 · 1,5 % | 60 · 46 · 27 % | 73 · 56 · 40 % | 94 · 87 · 71 % | 7,5 · 15 · 35 % |

Le second tableau donne la commune puis l'épique **avec la meilleure carte**, d'abord parmi les cartes de force 1 (les quatre offertes, et les communes), puis parmi celles de force 3. Mesuré sur 400 parties par case, sans l'oracle (`cartes-sans-oracle.txt`, à ±2,5 points). « Au hasard, sans savoir » combine le joueur au hasard du calibrage et mes stratégies sans savoir, quand elles font mieux.

| Jeu | Au hasard, sans savoir | Occasionnel : commune (f1 / f3) · épique (f1 / f3) | Moyen | Complétionniste |
|---|---|---|---|---|
| L'Épingle | **91 % de communes avec Éclairer 3, au centre de la zone** | 54 / 96 (Éclairer) · 17 / 33 | 74 / 98 · 32 / 50 | 94 / 99 · 68 / 82 |
| La Frise | 20 / 34 (Protéger) · épique 16 % avec Miser 3 | 92 / 97 (Protéger) · 68 / 83 | 96 / 98 · 80 / 89 | 100 / 100 · 94 / 98 |
| Le Mot mystère | 0 | 73 / 88 (Changer, Protéger) · 47 / 65 | 88 / 98 · 67 / 88 | 100 / 100 · 92 / 99 |
| Le Détail | 19 / **56** (Protéger 3) · **épique 25 % avec Miser 3** | 37 / 76 · 30 / 30 | 51 / 64 · 18 / 30 | 77 / 86 · 41 / 54 |
| Le Filet | 8 / 16 | 72 / 83 (Protéger) · 33 / 46 | 88 / 91 · 47 / 67 | 99 / 99 · 82 / 89 |
| Le Pari | 18 / 22 (Protéger) | **63** / 66 (Protéger) · 21 / 26 | 78 / 90 (Changer 3) · 32 / 37 | 92 / 99 · 62 / 68 |
| L'Éclair | 19 / 32 | 80 / 92 · 40 / 54 | 96 / 99 · 67 / 78 | 100 / 100 · 93 / 99 |
| Les Indices | 2 / 10 | 54 / 68 (Protéger) · 24 / 30 | 68 / 82 · 36 / 43 | 91 / 92 · 54 / 63 |
| La Réplique | 23 / 42 | 76 / 85 · 42 / 57 | 87 / 96 · 60 / 76 | 98 / 100 · 88 / 97 |

### Ce que chaque pouvoir apporte

- **Protéger** est la meilleure carte offerte dans sept jeux sur neuf, et ne coûte jamais rien (constats 3 et 7).
- **Éclairer 3** est imbattable à l'Épingle (constat 1) et fort à l'Éclair (99 % de communes pour le moyen).
- **Changer 3** fait du Pari et du Mot mystère des formalités, en fuyant ce qu'on ne sait pas. Au Pari, le moyen gagne une commune 90 % du temps au lieu de 44, une rare 84 % au lieu de 35 ; au Mot mystère, une commune 98,5 % au lieu de 76. Aux Indices, sans l'oracle, il ne sert à rien.
- **Miser** est souvent moins bon que « sans carte ». Il n'est bon que comme loterie dans les jeux où le hasard fait des manches parfaites (constat 2). Les colonnes « à la meilleure manche » montrent que ce n'est pas la tactique du joueur du calibrage, qui mise toujours la première : à la Frise et au Pari, la meilleure manche à miser est la première ou la troisième selon le joueur.
- **Prendre son temps** ne change rien dans le modèle (constat 9).
- **Miser et Protéger ensemble** ne se peut pas : une carte par partie.

### L'économie

| | Occasionnel | Moyen | Bon | Complétionniste | Au hasard |
|---|---|---|---|---|---|
| Poussière par jour joué | 93 | 184 | 113 | 199 | 79 |
| Tout posséder (31 400 poussières s'il fallait tout acheter) | 52 j | 18,5 j | 17 j | 15 j | 95 j |
| Tout dorer (15 560 poussières) | 206 j | 60,5 j | 47 j | 43 j | 270 j |
| Premier gardien | 38,5 j | 13,5 j | 10,5 j | 11 j | 30 j (le Scarabée) |
| … « Sans carte-bonus » | 94 j · 280 j · 56 j | 27,5 j · 71,5 j · 20 j | | | |
| … avec les constats 1, 2 et 4 | 51 j · 225 j · 14 j | 17,5 j · 59 j · 6 j | | | |

Ces chiffres sont la médiane de quatre parcours, sans oracle. Le fidèle a tout en deux semaines et demie et tout doré en six à neuf semaines ; ensuite, la poussière n'achète plus rien (une limite de la V1, sans constat). Les cinq libres qui paient font environ 70 des 184 poussières quotidiennes du moyen.

### Les confettis à la minute : la parade des libres est-elle tenable ?

Oui. Une partie libre jouée pour ses confettis, contre une série, au meilleur jeu de chacun :

| Modèle | Occasionnel | Moyen | Complétionniste | Au hasard |
|---|---|---|---|---|
| Le calibrage tel quel (avec l'oracle) | 1,51 contre 1,57 | 2,03 contre 2,06 | **2,67 contre 2,48** | 1,16 contre 1,03 |
| Sans l'oracle | 1,32 contre 1,57 | 1,87 contre 2,06 | 2,56 contre 2,48 (+3 %) | 1,16 contre 1,03 |
| Une question du Pari au temps d'une question de série (S1) | 1,32 contre 1,57 | 1,77 contre 2,06 | 2,35 contre 2,48 | 1,16 contre 1,03 |
| Joueur rapide, anecdotes sautées des deux côtés (S2, S3) | 2,53 contre 3,87 | 3,49 contre 5,14 | 4,88 contre 6,24 | 2,67 contre 2,64 |

Le seul surplus qui reste vient du joueur au hasard, au Détail avec Éclairer 3 : huit confettis à l'heure, que le plafond de trente départs borne. Plus le joueur va vite, plus la série l'emporte : le plafond arrête le Cabinet, pas la série.

### La tablée, relue de sa base

`tablee-parties.ts` relit 109 parties finies. Des agents, pas des humains : leur savoir est un plafond, leur adresse au doigt un plancher.

- **L'Épingle** : 28 épingles, dont 9 à moins de 40 km, 13 à moins de 120 et 17 à moins de 300. Jeanne connaissait les trois lieux et a planté à 121, 126 et 162 km. Le modèle du calibrage, « il sait le lieu → à une quinzaine de km », est sans doute optimiste en 360 px.
- **Les cartes** : 58 % des parties ont été jouées sans carte.

## Ce qui marche — à ne pas casser

- **Ce que l'écran promet est composé du barème.** L'annonce, « Comment ça marche ? » et le glossaire lisent chaque chiffre de `bareme.ts`, et les neuf barèmes dits correspondent au jugement de chaque jeu. J'ai vérifié les « à moins de » de l'Épingle, les paliers vides de la Frise et le « 5 et plus » des Indices. Le constat 9 est la seule phrase imprécise, et dans le bon sens.
- **La pièce juste lit les étoiles naturelles** : ni Protéger ni Miser ne paient un confetti de plus. C'est ce qui garde le Cabinet sous la série.
- **La poussière d'or est close** : elle ne sort jamais du Cabinet, cinq libres paient, trente départs à l'heure au plus. Aucune boucle infinie.
- **Les failles de la maquette sont bien fermées** : Protéger plafonne à +2, plus de mise à ×2, et la Frise ne paie plus le rangement au hasard (12 % de communes).
- **Le rythme du fidèle** : tout posséder en deux semaines et demie, une longue traîne de deux mois pour dorer. C'est ce que demande la fiche.

## Recommandations, dans l'ordre

1. **`DECALAGE_DE_LA_ZONE_KM = [120, 165]`** (constat 1). Le centre de la zone ne vaut plus que ★. Éclairer 3 fait gagner une commune à l'occasionnel 47 % du temps au lieu de 96,5, et un joueur qui ne sait rien plafonne à trois étoiles. Aucune version à monter. P2 · S.
2. **`BONUS_DE_MISE = { 1: 1, 2: 2, 3: 3 }`** (constat 2). Une manche misée ne gagne plus seule son œuvre. Au Détail, au hasard, une épique avec Miser 3 : 10 à 14,5 % au lieu de 25. Avec la recommandation 1, l'occasionnel met six jours de plus à tout posséder. Monter la version du départ. P2 · S.
3. **Une case de la visite vers le prochain gardien** (constat 4). Le premier gardien de l'occasionnel arrive au 18,5ᵉ jour au lieu du 38,5ᵉ (au 14ᵉ avec les recommandations 1 et 2), et tout posséder ne bouge pas. P2 · M.
4. **Une carte offerte proposée d'office à l'annonce** (constat 3). Laissé sans carte, l'occasionnel met 94 jours au lieu de 52 à tout posséder. P2 · S.
5. **Le bilan d'une libre qui payait** lit `d.payee` (constat 6). P3 · S.
6. **Le calibrage avec les cartes, sans oracle, avec un joueur au hasard qui réfléchit et des temps cohérents**, et ses chiffres redits dans `baremes.md` (constat 5). P3 · M.
7. **Protéger de force 1 sur une manche ratée seulement** : à arbitrer (constat 7). P3 · M.
8. **Cinq titres au Détail**, avec la correction des leurres de `cabinet-triche` (constat 8). P3 · M.
9. **Compter les manches expirées en préproduction** avant de juger Prendre son temps, et dire « à chaque question » (constat 9). P3 · S.
10. **Le cadre doré du Pari, et le seuil du double à l'annonce** (constat 10). P3 · S.

La parade des parties libres reste non posée : rien ne la demande.

## Limites

- **Le savoir et les temps sont des modèles.** Ce sont ceux du calibrage, et les miens en variantes : je n'ai éprouvé que leur sens, pas leur valeur. Les écarts entre jeux, surtout la Frise si facile et le Détail si dur, tiennent au modèle autant qu'aux règles. La préproduction les dira.
- **Les propositions des constats 4 et 7 ne sont simulées que dans la variante.** Pour le constat 4, une case remplacée après le tirage de la visite ; pour le constat 7, la protection appliquée aux étoiles naturelles. Le code n'est pas écrit.
- **Je n'ai rien regardé au doigt.** Ni la précision de l'Épingle en 360 px, ni le Filet, ni la place de cinq titres au Détail.
- **Rien n'est mesuré des gardiens de saison**, ni de l'arrivée d'un joueur pendant une fête : la Citrouille s'est réveillée dès la première partie de plusieurs agents de la tablée, le 25 octobre étant le premier jour d'Halloween.
