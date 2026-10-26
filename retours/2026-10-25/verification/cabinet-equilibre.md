# Contre-expertise — `cabinet-equilibre` (l'équilibre du Cabinet)

Relu le 26 octobre 2026 sur la branche `ccr-95f7b600-x1amjl` (commit 3034028, arbre propre). Sans navigateur, sans base réelle : seulement le code, les trois reproductions de l'expert, quatre scripts à moi dans `export/evaluations/verification/cabinet-equilibre/`, et une copie de la base jetable de la tablée du 25 octobre, ouverte en lecture seule. Un fichier à la fois, sous `nice -n 10` (charge 0,25). Rien n'est resté allumé, et aucun fichier suivi par git n'a changé.

## En bref

| # | Constat | Annoncée | Verdict | Retenue | Pourquoi, en une ligne |
|---|---|---|---|---|---|
| 1 | Éclairer à l'Épingle : le centre de la zone vaut ★★ | P2 | **confirmé** | P2 | Rejoué (81,4 % de ★★ ou mieux, 91,0 % de communes). Un joueur qui vise le milieu de la terre que la zone couvre fait 93 %. Mais la piste de l'expert ne fait pas ce qu'elle promet : avec elle, la couronne lisible donne encore 45 à 56 % de communes sans rien savoir. |
| 2 | Miser : une manche parfaite gagne seule l'œuvre | P2 | **confirmé** | P2 | Rejoué (24,8 %). Neuf cartes misent à la force 3, pas cinq. La racine est le 1 sur 4 du Détail (constat 8) et ses leurres (`cabinet-triche-2`), et la piste rend Miser 1 et 2 inutiles au Détail. |
| 3 | « Sans carte-bonus », le choix d'office, n'est jamais le bon | P2 | **confirmé, gravité revue** | P3 | Le mécanisme est vrai. La preuve de la tablée est mal lue : 57 des 65 parties sans carte viennent de six profils de vérification, et les six personnages ont pris une carte dans 47 parties sur 54. |
| 4 | Le premier gardien de l'occasionnel au 38ᵉ jour | P2 | **confirmé, gravité revue** | P3 | La lecture est juste. Mais la page donne déjà le levier : en chassant vers le prochain gardien, la variante de l'expert le fait arriver au 20,5ᵉ jour. C'est du rythme, donc du confort. |
| 5 | Le calibrage sans cartes, avec un oracle | P3 | **confirmé** | P3 | Vrai, avec une nuance : les parcours du musée et les confettis choisissent déjà la meilleure carte, et les 52 jours les incluent. |
| 6 | La libre à zéro étoile dit « les cinq ont payé » | P3 | **doublon** (`cabinet-code-2`) | P3 | Rejoué, réel. C'est le même défaut, au même endroit (`vue.ts:179`). |
| 7 | Prudence vaut une rare du Rempart | P3 | **tension** | P3 | `BONUS_DE_PROTECTION` vaut +1 à la force 1 comme à la force 2. La retouche à arbitrer va de pair avec `cabinet-triche-5`. |
| 8 | Le Détail est une loterie | P3 | **tension** | P3 | Les chiffres se recalculent à l'identique. C'est aussi la racine des constats 2 et 3 au Détail. |
| 9 | Prendre son temps, et « à chaque manche » | P3 | **tension** | P3 | Lecture exacte (`partie.ts:131`). La promesse est en deçà, dans le bon sens. |
| 10 | Le cadre doré du Pari, le seuil du double tu | P3 | **confirmé** | P3 | Lecture exacte (`Annonce.tsx:53`, `partie.ts:736`, `musee.ts:464`). |

Le compte : **4 confirmés**, **2 confirmés à gravité revue** (rétrogradés de P2 à P3), **3 tensions**, **1 doublon**, **0 réfuté**. Le plus grave qui tient est le constat 1 (P2).

## Ce que j'ai rejoué

| Reproduction | Résultat aujourd'hui |
|---|---|
| `cabinet-equilibre/epingle-zone.test.ts` | 2 épreuves sur 2 échouent : « ★★ ou mieux dans 81.4 % des manches », « une commune dans 91.0 % des parties » |
| `cabinet-equilibre/pouvoirs-equilibre.test.ts` | 4 sur 4 échouent : Protéger coûte dans 0 partie et ajoute une étoile dans 63 ; « force 1 : +1, force 2 : +1 » ; une manche misée parfaite fait 5, 6 et 7 étoiles, les trois seuils ; Détail au hasard misé à la force 3, une épique dans 24.8 % des parties |
| `cabinet-equilibre/libre-a-zero.test.ts` | 1 sur 1 échoue, par les routes d'un vrai serveur jetable : bilan « Les cinq parties libres du jour ont payé… », et il reste 4 libres qui paient sur 5 |

Mes scripts, dans `export/evaluations/verification/cabinet-equilibre/`, chacun avec sa sortie en `.txt` :

- `zone-contre-expertise.ts` : l'Épingle sous trois règles de zone. J'y oppose quatre façons de jouer sans rien savoir, en lisant la zone et la terre que la page dessine (`CONTOUR_DE_LA_FRANCE`). Le jugement est le vrai (`epingleTiree`, `zoneDEclairer`, `REGLE_DE_L_EPINGLE.juger`), et le décalage est muté en mémoire comme le fait l'essai du calibrage, jamais dans le fichier.
- `mise-au-detail.ts` : le Détail joué sans rien savoir, à chaque force de Miser, sous trois barèmes de mise. Il prend le vrai `REGLE_DU_DETAIL` et le vrai `etoilesApresLesPouvoirs`.
- `cartes-en-cause.ts` : qui porte Éclairer, Miser et Protéger à chaque force, et les œuvres de l'Épingle, du Détail et de la Frise, tirés du catalogue.
- `cartes-par-profil.ts` : la carte emportée, partie par partie et profil par profil, dans la copie de la base de la tablée (`export/evaluations/cabinet-equilibre/tablee-base/permanente.db`, en lecture seule). C'est la base jetable d'une tablée, pas une base réelle.

## Constat par constat

### 1. Éclairer à l'Épingle — confirmé, P2

**La reproduction** échoue pour la raison annoncée. Elle appelle ce que le serveur appelle :

- `epingleTiree` tire le décalage au départ (`epingle.ts:136-140`) ;
- `REGLE_DE_L_EPINGLE.eclairer` rend la zone que la vue envoie (`:205`, `montrer` `:213`) ;
- `juger` mesure la distance au lieu (`:194-201`).

Le centre de la zone part bien au téléphone, et la page dessine le cercle. Le chiffre se retrouve sans simulation : la distance du centre au lieu est uniforme entre 40 et 140 km (`bareme.ts:209`), donc elle est sous 120 km avec une probabilité de 80/100, et toujours sous 300 km. Le reste vient du rabat dans le cadre de la carte.

**La garde manquée ?** Aucune :

- une zone par manche, trois à la force 3 (`ECLAIRAGES_PAR_PARTIE`, `bareme.ts:137`) ;
- Éclairer n'ôte que le cadre doré (`partie.ts:691`) ;
- la pièce reste juste, car elle lit les étoiles naturelles (`justeDeLaPiece`, `bareme.ts:51`), qu'Éclairer a fait monter.

Neuf cartes éclairent à la force 3 : Encyclopédie, Génie, Vision et Révélation, puis la Chouette, le Lion, le Sphinx, l'Oracle et la Citrouille (`cartes-en-cause.txt`). Neuf œuvres se gagnent à l'Épingle. Coup d'œil, offert à tous, éclaire à la force 1 : une zone, donc une manche presque sûre.

**Plus fort qu'annoncé** (`zone-contre-expertise.txt`, 12 000 manches par case, une zone à chaque manche) :

| Règle | Sans rien savoir, il plante… | Pièce juste | Commune (trois zones) | Rare |
|---|---|---|---|---|
| aujourd'hui (40–140 km, rayon 170) | au centre | 81,3 % | 90,5 % | 55,0 % |
| | au milieu de la terre que couvre la zone | 82,9 % | **93,1 %** | 67,8 % |
| la piste de l'expert (120–165 km, rayon 170) | au centre | 4,7 % | 1,9 % | 0,1 % |
| | au milieu de la terre de la zone | 41,8 % | **45,1 %** | 18,0 % |
| | sur la couronne, en un point de terre au hasard | 44,6 % | **56,3 %** | 28,5 % |
| | au milieu de la terre de la couronne | 44,4 % | 51,6 % | 22,0 % |
| lieu uniforme dans le disque, rayon 240 | au centre · au milieu de la terre | 28,2 · 44,3 % | 25,1 · 47,6 % | 6,5 · 18,9 % |
| lieu uniforme dans le disque, rayon 300 | au centre · au milieu de la terre | 19,9 · 33,7 % | 15,2 · 32,4 % | 2,5 · 10,8 % |

**La piste ne tient pas sa promesse.** « Un joueur qui ne sait rien plafonne à trois étoiles » n'est vrai que pour qui plante au centre. Avec un décalage de 120 à 165 km et un rayon de 170, le lieu est toujours à 5–50 km du bord du cercle. La couronne devient ce qui se lit, et la mer fait le reste : seize des 90 lieux livrés sont hors du contour dessiné, sur la côte ou une île, et bien d'autres en sont proches. Sans rien savoir, on tombe alors à 45–56 % de communes au lieu de 91–93 %. C'est mieux, mais l'Épingle resterait le jeu le plus généreux sans savoir (au Détail, 56 % avec Protéger 3, selon le tableau de l'expert).

Il y a pire : le joueur averti du calibrage plante au centre dès qu'il a la zone et ne sait pas le lieu (`calibrage-cabinet.ts:879-880`). Avec la piste, il ferait moins bien qu'un joueur qui ne sait rien mais vise la couronne. Les 47 % de l'occasionnel mesurés par l'expert sous la piste sont donc un plancher du modèle, pas une mesure.

**La réalité.** Le Cabinet est fermé en production (`CABINET_EN_PRODUCTION`). En préproduction, cela touche tout porteur d'une carte qui éclaire, dès Coup d'œil, et les dégâts restent dans son musée. Une pièce juste paie aussi un confetti et une bonne réponse d'expérience. Jouées au centre de la zone, les parties libres d'un joueur qui ne sait rien rapportent donc environ 2,4 pièces justes par partie, bornées à 90 par heure par les trente départs (`DEPARTS_PAR_HEURE`). C'est plus que sa série (1,03 la minute, selon l'expert), mais le plafond le borne. Cela renforce le constat sans le rendre P1. P2 tient.

**Correction.** Le diagnostic est bon et la piste va dans le bon sens. Elle ne suffit pas, et sa promesse est fausse. Avant de choisir une valeur :

- ajouter au calibrage le joueur sans savoir qui plante au milieu de la terre de la zone, ou sur la couronne si le décalage a un plancher ;
- faire planter le joueur qui connaît la région dans sa région, ramenée dans la zone, comme l'expert le demande.

Les règles mesurées ici :

- un lieu uniforme dans le disque, d'un rayon de 300 km, donne 15 à 32 % de communes sans savoir, ce qui reste dans la fourchette des autres jeux. Il n'y a plus de couronne à lire. Le prix : Éclairer servira moins au joueur qui sait la région, et il faut le mesurer ;
- une zone qui garde la forme d'aujourd'hui ne descend pas sous 45 %. Si l'on veut moins, c'est ce qu'Éclairer donne à l'Épingle qu'il faut revoir, pas son décalage.

Le décalage est figé dans le plan (`EpingleTiree.decalage`) : une autre loi de tirage ne demande aucune version. `RAYON_D_ECLAIRER_KM`, lui, est relu à chaque relecture (`zoneDEclairer`, `epingle.ts:147-150`). Changé, il redessinerait d'un autre rayon la zone de « Mes réponses » des parties jouées. Il faut le figer dans le tirage avec le décalage, ou ne faire que l'agrandir.

### 2. Miser — confirmé, P2

**La reproduction** échoue pour la raison annoncée : 3 + `BONUS_DE_MISE` vaut 5, 6 et 7, exactement `SEUILS_DES_RARETES` (`pouvoirs.ts:226`, `bareme.ts:58`, `:150`). Le chemin est celui de la page. Avec une carte qui mise, le serveur n'ouvre pas la première manche d'office (`magasin.ts:718`). La page propose « Miser sur cette manche ? » avant même la première (`Partie.tsx:819-826`), et le pli l'accepte avant que la manche soit vue (`partie.ts:443-465`). Deviner au premier cadrage est un geste que tout joueur peut faire.

**Plus large qu'annoncé.** L'expert cite « le Trou noir, et les épiques du Flambeur et du Téméraire », soit cinq cartes. Elles sont **neuf** à miser à la force 3 : Pactole, Rafle, Berserk et Baroud, puis le Dragon d'Or, le Renard Lunaire, la Salamandre, le Kraken et le Trou noir. Un gardien porte le pouvoir de la salle qu'il garde (`cartes-en-cause.txt`). Les œuvres visées sont bien deux épiques au Détail (Pactole, Polymorphe) et deux à la Frise (Représailles, Vent arrière).

**Mesuré au Détail** (`mise-au-detail.txt`, 20 000 parties, le vrai jugement) :

| Barème de la mise | Miser 1 : une commune | Miser 2 : une rare | Miser 3 : une épique |
|---|---|---|---|
| sans carte | 15,9 % | 15,9 % | 1,7 % |
| aujourd'hui (+2 · +3 · +4) | 29,7 % | 29,7 % | **25,0 %** |
| la piste de l'expert (+1 · +2 · +3) | 15,9 % | 15,9 % | 11,1 % |
| la force 3 seule (+2 · +3 · +3) | 29,7 % | 29,7 % | 11,1 % |

La loterie qui choque est l'épique : 25 % contre 1,7 % sans carte, quinze fois plus. Elle s'aggrave avec ce que `cabinet-triche-2` a confirmé : sans l'image, les leurres désignent la bonne réponse dans 52 % des cas. Le titre du premier cadrage est alors trouvé une fois sur deux, et l'épique misée vient une partie sur deux.

**La piste a un coût que l'expert dit à moitié.** Avec +1 et +2, Miser 1 et 2 ne valent plus rien au Détail pour qui ne sait rien : 15,9 %, autant que sans carte. Et l'expert mesure que Miser est déjà le plus faible des cinq pouvoirs ailleurs. C'est une tension avec « les cinq pouvoirs tous utiles ». Au Détail, Protéger 3 fait déjà 56 % de communes sans savoir. La racine est la structure du Détail (constat 8) : 3 ou 0 étoile sur un titre deviné une fois sur quatre. Miser et Protéger ne font que l'exploiter.

**Correction.** Trancher avec le constat 8 et `cabinet-triche-2` (les leurres), puis remesurer Miser. Si l'on veut fermer la seule loterie des épiques, `BONUS_DE_MISE = { 1: 2, 2: 3, 3: 3 }` suffit : une manche misée parfaite fait 6, une étoile sous l'épique. Le Détail tombe à 11,1 % sans toucher aux forces 1 et 2. Dans les deux cas, la version du départ monte : le pli relit `BONUS_DE_MISE` au barème du code (`pouvoirs.ts:226`, `VERSIONS_DU_DEPART`), et la ligne de `baremes.md:692` change dans le même commit.

### 3. « Sans carte-bonus » d'office — confirmé, rétrogradé à P3

**Le mécanisme est vrai.** Protéger ne porte que la première manche imparfaite (`pouvoirs.ts:208-212`) et ne retire jamais d'étoile (`:227`). Le cadre doré exige trois manches parfaites (`partie.ts:667`), là où Protéger n'agit pas. La reproduction le dit : il coûte dans 0 partie et ajoute dans 63 parties sur 64. C'est voulu (« Emporter une carte-bonus ne coûte rien ; l'avoir jouée, si », `partie.ts:663-665`). Sans carte retenue, l'annonce dit « Sans carte-bonus : tu joues sans pouvoir » (`Annonce.tsx:235`, `retenu.ts:35`).

**La preuve de la tablée est mal lue** (`cartes-par-profil.txt`). Sur les 113 séries du Cabinet de la copie, 65 sont parties sans carte. 57 d'entre elles viennent de six profils de vérification, qui ne sont pas des joueurs : Vérif (18 sur 18), Verifdoigt (24 sur 24), Verifa (10 sur 10), Verifdiff (3 sur 3), Verifnav (2 sur 2) et Verifregles (1 sur 2). Les six personnages ont pris une carte dans **47 parties sur 54**. Lucas, Théo, Hugo et Ophélie l'ont fait à chaque partie. Jeanne a regardé, n'a rien pris la première fois, puis a gardé Concentration (son retour, `jeanne.md:14`, `:114`). Une fois choisie, la carte est retenue d'une partie à l'autre (`retenu.ts:35-36`).

Les 94 jours au lieu de 52 décrivent donc un joueur qui ne touche jamais « Choisir une carte-bonus ». C'est une borne, pas le cas typique. Le défaut reste réel, mais c'est une première partie moins bonne et un joueur inattentif plus lent : du confort.

**Correction.** Proposer d'office une carte offerte, oui. Mais Prudence d'office ferait jouer à chaque nouveau joueur la faille de `cabinet-triche-5`, que la lecture confirme : quittée, la manche en cours se juge à 0 (`finir`, `partie.ts:439`), elle est donc « imparfaite », et Prudence la relève (`mancheProtegee`, `pouvoirs.ts:210`). Une libre quittée d'emblée paie alors deux poussières. Il faut corriger d'abord Protéger, pour qu'il ne porte qu'une manche tranchée par une réponse, ou proposer une carte qui n'agit pas seule (Coup d'œil, Échange). Le plus propre : que la vue du serveur dise la carte proposée, plutôt qu'une constante de la page, qui ne doit porter aucune règle.

### 4. Les gardiens de l'occasionnel — confirmé, rétrogradé à P3

**La lecture est juste.** `visiteDuJour` tire les trois cibles parmi toutes les œuvres manquantes, au seul poids de la rareté (`musee.ts:324-331`). Les salles se remplissent donc ensemble.

**Le levier existe déjà, et la page le montre.** Le musée dit « Le prochain gardien : …, encore N œuvres dans la salle de … » (`prochainGardien`, `musee.ts:213-223`), et les deux chasses du jour peuvent viser cette salle. La variante de l'expert le mesure elle-même (`musee-chasse-gardien.txt`) : en chassant vers le gardien, l'occasionnel a son premier gardien au 20,5ᵉ jour (11–25), le moyen au 4,5ᵉ. C'est presque ce que donne sa piste (18,5 et 5,5). Ce sont aussi des médianes de quatre parcours seulement (31 à 44 jours pour la base).

La citation de la tablée (« 7 œuvres sur 84 et 1 gardien sur 23 après une soirée entière, c'est lent », `camille-d.md:131`) parle du rythme d'ensemble après une soirée, pas de gardiens qui arrivent ensemble. Un rythme à régler sans dommage ni triche, c'est P3.

**Correction.** La piste de l'expert reste la meilleure : contrairement à la chasse vers le gardien, elle ne coûte rien à « tout posséder » (52 jours, contre 56,5). Elle n'apprend rien à la page de plus qu'aujourd'hui : la case dit déjà sa rareté et sa salle (`vue.ts:103`). Le calibrage, lui, devrait faire chasser vers le prochain gardien, la stratégie que la page suggère.

### 5. Les biais du calibrage — confirmé, P3

Les quatre biais se lisent :

- **(a)** La section 1 est sans carte (`calibrage-cabinet.ts:1411`).
- **(b)** Changer aux Indices décide sur `!s.reconnu`, tiré d'avance, au premier indice (`:891`).
- **(c)** Le joueur au hasard plante n'importe où (`:876-877`).
- **(d)** Une question du Pari compte 9 s, une question de série 20 s (`:311`, `:329`).

Une nuance sur (a) et sur la phrase « le calibrage ne les a jamais mesurées » : les parcours du musée choisissent la meilleure carte pour chaque partie (`meilleure`, `:1143-1157`, puis `:1250`, `:1266`, `:1286`), et la section des confettis mesure « avec le meilleur gardien » (`:1477`). Les 52 jours et le débit des confettis tiennent donc déjà compte des cartes. Ce qui manque, c'est le tableau jeu par jeu avec cartes, celui sur lequel les retouches du 25 octobre ont été décidées.

J'ajoute au point (c) ce que le constat 1 montre : il faut aussi un joueur sans savoir qui lit la terre et la couronne.

### 6. La libre à zéro étoile — doublon de `cabinet-code-2`, P3

Rejoué par les routes : le défaut est réel. C'est le même défaut, au même endroit (`vue.ts:179`, où `bilanDit` décide sur `b.poussiere > 0`), relevé par `cabinet-code-2`, qui ajoute que « cinq » y est écrit en dur.

La seconde moitié du constat, « elle a pris une des cinq sans rien rapporter », est la règle. Les libres qui paient sont les cinq premières commencées, décidées au départ (`musee.ts:486`, `payee`). L'expert a raison de refuser un plancher en partie libre.

**Correction**, celle des deux rapports fondue en une :

```ts
if (!d.payee) return `Les ${formatNumber(LIBRES_QUI_PAIENT)} parties libres du jour ont payé : celle-ci se joue pour le plaisir`
return b.poussiere > 0 ? `${poussieresDites(b.poussiere)} pour ta partie libre` : 'Aucune étoile : pas de poussière d’or cette fois'
```

Il faut aussi retoucher la phrase « Une partie fait toujours avancer » de `le-cabinet.md:14`. La reproduction de l'expert, `libre-a-zero.test.ts`, en fera le test.

### 7. Prudence vaut une rare du Rempart — tension, P3

`BONUS_DE_PROTECTION = { 1: 1, 2: 1, 3: 2 }` (`bareme.ts:143`) : c'est exact, et cela contredit « sa rareté le rend plus fort » (`bareme.ts:130-131`). L'épreuve 2 de la reproduction ne fait que comparer deux constantes, mais il n'y avait rien d'autre à prouver.

C'est un choix à arbitrer. La valeur +3 a été fermée parce qu'elle « vidait les seuils de leur sens ». L'option de l'expert, où la force 1 ne relève qu'une manche ratée, touche la règle (`mancheProtegee`) et monte la version du départ. Elle se fait dans la même version que la garde de `cabinet-triche-5` (Protéger seulement sur une manche tranchée par une réponse) : une seule montée pour les deux.

### 8. Le Détail est une loterie — tension, P3

Les chiffres se recalculent :

- avec quatre titres, un joueur qui ne sait rien gagne une commune dans 3p²(1−p) + p³ = 15,6 % des parties (15,9 % simulé) ;
- avec cinq titres, 10,4 % ;
- Miser 3 à cinq titres donne 20 % d'épiques.

Ce constat recoupe `cabinet-triche-2` (les leurres) sans le doubler : l'un est le hasard, l'autre une fuite. Il est la racine des constats 2 et 3 au Détail, et c'est par lui que je commencerais.

### 9. Prendre son temps — tension, P3

C'est exact : `chronoDuDepart` ajoute `enPlusMs` à chaque étape (`partie.ts:118`, `:131`), alors que l'écran dit « à chaque manche » (`forceDite`, `pouvoirs.ts:118`). La ligne de `baremes.md:691` dit déjà « à chaque manche et à chaque étape ». La promesse est en deçà, dans le bon sens. Le jugement sur l'utilité du pouvoir est honnête : le modèle ne sait pas le mesurer.

### 10. Le cadre doré du Pari, le seuil du double — confirmé, P3

Le cadre doré du Pari :

- il demande trois manches à trois étoiles naturelles (`partie.ts:667`) ;
- au Pari, seule une mise gagnée en donne trois, garder en donne deux (`ETOILES_DU_PARI`, `bareme.ts:286`) ;
- dorer au Pari, c'est donc gagner trois paris difficiles.

Le double de la case « pour dorer » :

- une case de la visite « pour dorer » a bien son seuil (`musee.ts:464`) ;
- elle paie un double si elle l'atteint sans le cadre doré (`partie.ts:736`) ;
- l'annonce ne dit pas ce seuil (`Annonce.tsx:53`).

Les deux tiennent.

## Hors mission

- La phrase périmée de `le-cabinet.md` (« Le Pari et l'Éclair s'y jouent… ») est déjà le constat `cabinet-code-6`.
- Pour le chiffre « la parade des libres est tenable » : le joueur au hasard de la variante de l'expert ignore la zone d'Éclairer. Son débit de confettis à l'Épingle avec Éclairer 3 n'a donc pas été mesuré au centre de la zone. Le plafond des départs le borne à 90 pièces justes par heure (constat 1), et la conclusion « le Cabinet reste sous la série » ne tient alors que pour qui sait quelque chose. C'est à remesurer avec le constat 5, pas un constat neuf.
