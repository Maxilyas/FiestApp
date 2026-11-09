# Le nouveau Filet et le moteur de difficulté — cahier des charges

Le 9 novembre 2026, à la demande du propriétaire : « Au lieu de sortir le
filet, est-ce que plutôt on ne s'intéresserait pas à la modification de la
difficulté ? Une question difficile en filet peut être extrêmement dure si on
ne connaît même pas le sujet. […] Créer un moteur intelligent capable de
donner une note sur la difficulté de la question en se basant sur plusieurs
critères. Aider les joueurs sur certains jeux en permettant d'avoir peut-être
des indices ? » Puis : « maquette et cahier des charges […] une vraie
amélioration de ce qui existe, en te basant sur les données de la prod et ce
qu'il se fait concrètement dans ce type de jeu ».

- La maquette jouable : `maquette-filet/` (le README dit comment la lancer),
  publiée aussi en artefact privé.
- Les mesures : `reproductions/`, en lecture seule sur la production, et sur
  la base livrée.
- Ce que la tablée de la maquette en a dit : `la-tablee-du-filet.md`.

## En bref

**Le Filet d'aujourd'hui se joue au hasard.** Sur les 169 lancers réels du
1er au 8 novembre, les joueurs réussissent 43 % des manches. Un joueur qui
lancerait le grand filet au milieu sans lire la question en réussirait 45 %.
Trois causes, mesurées :

1. **Le pari sur la taille du filet se retourne contre eux** : le grand filet
   posé au même endroit aurait réussi 56 % des manches.
2. **La piste trahit la réponse** : celle-ci tombe toujours entre 8 et 92 %
   de sa longueur, et le grand filet laissé au milieu l'attrape une fois sur
   deux.
3. **Le savoir approximatif ne rapporte rien.** On sait (à 2 % près), ou l'on
   tire au sort : la moitié des curseurs des questions moyennes tombent à
   plus de 20 % de la valeur.

**Ce que propose ce cahier des charges, en quatre pièces :**

1. **D'abord l'époque, puis la valeur.** Quatre époques (ou quatre ordres de
   grandeur) ; la bonne vaut déjà une étoile.
2. **Le filet se resserre tout seul.** Plus de taille à parier : à 2 ans près
   trois étoiles, à 6 ans deux. Le curseur ne part de nulle part.
3. **Des repères et deux aides.** Des dates connues sur la frise, et celles
   que le joueur a déjà su placer. Deux aides — « deux époques de moins », un
   indice écrit —, qui retirent chacune une étoile à ce que la manche
   rapporte, sans jamais coûter le cœur.
4. **Un moteur qui note chaque question pour chaque jeu.** Le Filet tire,
   acte par acte, des questions que les joueurs savent placer ; les loteries
   attendent le dernier acte, et ce qui se calcule ne se pose pas.

**Ce que ça change, rejoué sur les lancers réels** (une borne basse : les
curseurs ont été posés sous l'ancienne règle ; la règle rejouée est celle du
§ 3.3, mot pour mot) :

| Règle | Manches réussies | Étoiles par manche | Au hasard | Ce que le savoir ajoute |
|---|---|---|---|---|
| Le Filet d'aujourd'hui | 43 % | 0,67 | 45 % | −2 points |
| Le filet qui se resserre tout seul | 56 % | 1,12 | 45 % | +11 points |
| En deux temps : l'époque, puis la valeur | 62 % | 1,20 | 25 % | +37 points |
| En deux temps, questions du moteur (≥ 25 %) | 66 % | 1,38 | 25 % | +41 points |
| En deux temps, questions du moteur (≥ 40 %) | **74 %** | **1,74** | 25 % | +49 points |

Le dernier palier est la zone que visent les jeux qui règlent leur
difficulté : 65 à 80 % de réussite.

**Joué par une tablée, deux tours** (`la-tablee-du-filet.md`) : quatre
joueurs aux profils opposés — une institutrice de 72 ans au petit téléphone,
un lycéen pressé, une stratège qui joue chaque soir, un daltonien — ont joué
la maquette contre le Filet d'aujourd'hui, sur les vraies questions, puis
trois d'entre eux la seconde version, et un joueur aveugle au lecteur
d'écran. Tous préfèrent le nouveau — « nettement meilleure », au second tour ;
leurs retours ont changé une vingtaine de choses, dont le prix des aides, la
piste des grandeurs et la place de l'indice. Un juge à l'aveugle a relu
chaque indice : 42 sur 140 donnaient la réponse, aucun aujourd'hui ; 85 sur
136 menaient à cheval sur deux tranches, 29 aujourd'hui, toutes contre une
frontière.

## 1. Ce que la production a montré

En lecture seule, du 1er au 8 novembre 2026 (`reproductions/filet-en-production.ts`) :
169 lancers du Filet, 162 questions distinctes, 9 joueurs.

- **Le choix du filet** : petit 16 fois, moyen 64, grand 89.
  - Les joueurs réussissent 43 % de leurs manches.
  - Le grand filet, posé au même endroit, en aurait réussi 56 % : le pari sur
    un filet plus petit leur coûte des manches.
- **Il savait, ou il tirait au sort.** Part des curseurs selon leur écart à
  la valeur, en part de la piste :

  | Questions | À moins de 2 % | De 2 à 20 % | Au-delà de 20 % |
  |---|---|---|---|
  | faciles (15) | 73 % | 13 % | 13 % |
  | moyennes (87) | 14 % | 36 % | 51 % |
  | difficiles (50) | 2 % | 50 % | 48 % |

  - 47 % des curseurs tombent dans le bon tiers de la piste, contre 33 % au
    hasard : un savoir partiel existe, et rien ne le paie.
- **La piste d'une grandeur est linéaire** (de 0 à une borne ronde).
  - Sa tolérance varie donc de ±10 % à ±113 % de la valeur, selon l'endroit
    où celle-ci tombe sur la piste.
  - Exemple réel : « Combien de cm² dans un m² ? », moyenne en QCM, posée sur
    une piste de 0 à 35 000. Qui hésite entre 10 000 et 100 000 ne peut même
    pas exprimer son hésitation.
- **La difficulté affichée vient du QCM**, où l'on peut écarter trois
  mauvaises réponses. Au Filet, sans réponse proposée, elle ne tient plus.
- **L'aide existe, mais personne ne l'a** :
  - Éclairer n'a jamais servi au Filet, et 23 fois en tout, tous jeux
    confondus.
  - Il faut la carte Coup d'œil pour l'avoir, et elle n'a été choisie que
    dans 4 traversées sur 34.
- **Les questions tirées étaient des loteries** : 44 % des Filets posés
  avaient une connaissabilité de moins de 25 % (le moteur, plus bas).
- **Le Filet tue les traversées** : c'est lui qui porte le dernier coup dans
  9 traversées perdues sur 21. Sur la carte, les joueurs le choisissent 23
  fois sur cent quand il est proposé.

## 2. Ce qui se fait ailleurs

Une recherche en ligne sur les jeux d'estimation, les aides des jeux de quiz
et la difficulté adaptative. Elle s'appuie sur les résumés d'un moteur de
recherche : les pages elles-mêmes n'étaient pas joignables d'ici. Ce sont des
ordres de grandeur et des mécaniques, pas des citations.

- **Personne n'est en tout-ou-rien.**
  - GeoGuessr paie la distance : 5 000 × e^(−10 d / D), où D est la taille
    de la carte (une formule retrouvée par les joueurs, que GeoGuessr ne
    publie pas).
  - Les jeux de dates retirent quelques points par année d'écart
    (whentaken : −1 par an les cinq premières, −2 les cinq suivantes…).
  - Kahoot propose une marge réglable sur son curseur ; Wavelength a des
    zones à 4, 3 et 2 points autour de la cible.
- **Placer par rapport à ce qu'on connaît.**
  - Timeline et Hitster font insérer un événement entre d'autres.
  - Apprendre quelques valeurs repères améliore les estimations de toutes les
    autres, encore quatre mois après (l'expérience des populations des pays).
  - Les questions de Fermi se notent à l'ordre de grandeur : 5, 3 ou 1
    point.
- **Une aide coûte du score, pas une monnaie.**
  - Only Connect paie 5, 3, 2 ou 1 point selon le nombre d'indices vus.
  - Le « 50:50 » du Millionnaire efface deux réponses.
  - Un indice qui rend la réponse devinable nuit à l'apprentissage
    (Vaughn et Kornell, 2019).
  - Une erreur faite avec assurance, puis corrigée, se retient le mieux :
    la révélation doit toujours montrer la réponse et son anecdote.
- **La difficulté se mesure en jouant.**
  - Chaque problème d'échecs de Lichess a sa cote, mise à jour à chaque
    essai, comme celle d'un joueur.
  - Duolingo prédit la réussite d'un exercice pour chaque apprenant (son
    modèle Birdbrain) et vise environ 70 % ; les applis d'entraînement visent
    65 à 80 %.
  - Duolingo a fait tourner son modèle « à blanc », ses prédictions notées
    sans servir, avant de le brancher.
- **L'IA pour noter une question jamais jouée** : la littérature trouve une
  corrélation de rang de 0,1 à 0,4. Notre panel fait 0,62 (plus bas) : une
  bonne surprise, à confirmer sur plus de réponses.

## 3. Le nouveau Filet — les règles

### 3.1 Une manche

Un seul écran, de haut en bas :

1. **La question**, sa catégorie au-dessus.
2. **L'époque** — ou l'ordre de grandeur :
   - quatre boutons côte à côte, une frise ;
   - au-dessus, deux dates repères au plus (§ 3.5) ;
   - la ligne de l'étape dit « la bonne : ★ ».
3. **L'année** — ou la valeur :
   - **l'indice, s'il est pris, se lit ici**, entre l'époque et la piste —
     là où l'on choisit et où l'on vise ; sous les aides, il passait derrière
     le bouton du bas (Samir) ;
   - la piste s'ouvre sur l'époque touchée, sans curseur : « Touche la
     piste », et vient sous les yeux ;
   - **le premier toucher pose le curseur, partout, pile au milieu compris** :
     c'est le réflexe de qui ne sait pas, et à la première version le milieu
     ne répondait pas (les quatre joueurs de la tablée) ; le doigt lui donne
     aussi le focus ;
   - les crans − et + l'ajustent d'un cran rond, les grands pas d'une
     graduation (« − 5 ans », « + 100 g » — de 198 anneaux à 100, Hugo, au
     lecteur d'écran, touchait « − » 98 fois) ; « − » et « + » s'éteignent aux
     bouts ; la piste est régulière, et ses graduations portent leurs
     nombres (§ 3.2) ;
   - les deux anneaux du filet se dessinent autour du curseur — le grand en
     tirets, le petit plein — et se disent en nombres dessous : « Ton filet
     ★★★ de 1960 à 1964 · ★★ de 1956 à 1968 » ; une aide payée y barre son
     étoile ;
   - les repères de l'époque ouverte descendent sur la piste ;
   - la ligne de l'étape dit « à 2 ans ★★★ · à 6 ans ★★ » ;
   - toucher une autre époque reste possible.
4. **Les aides** (§ 3.6) et ce qu'elles coûtent, en clair.
5. **« Lancer le filet »**, éteint tant que l'époque et le curseur ne sont
   pas posés — « Choisis d'abord une époque », puis « Pose ton curseur sur la
   piste ». Collé au bas de l'écran à la seconde version, il cachait la
   piste, le gros chiffre et l'indice sur un petit écran (Huguette, Samir) :
   il reste à sa place.

Chaque manche s'ouvre en haut, la question sous les yeux : à la première
version, elle s'ouvrait là où « Manche suivante » avait laissé la page.

**Au lecteur d'écran** (Hugo, la tablée) : chaque manche dit où l'on en est
(« Acte I », « Manche 1 sur 3 », « 4 cœurs sur 4 », la question en titre) ;
les quatre époques sont des boutons qui disent leurs bornes et lequel est
pressé ; le curseur porte sa vraie valeur et la dit (« 1937 », « 350 m ») —
il annonçait « 12 » pour 1937 ; les étoiles écrites se disent en mots ;
l'indice pris et le verdict reçoivent le focus.

Le chrono reste de 45 secondes (`DUREES_DES_JEUX.filet`). À l'échéance, la
page lance ce qui est posé : l'époque seule vaut son étoile, si elle est la
bonne.

### 3.2 Les époques et les ordres de grandeur

- **Une année.**
  - Quatre époques consécutives, de 25 ans depuis 1800, de 50 ans de 1500 à
    1799, d'un siècle avant : on date plus grossièrement ce qui est loin.
  - Leurs bornes sont rondes : 1775–1799, 1800–1824.
  - L'époque de la réponse est tirée au hasard parmi les quatre, sans
    qu'aucune époque ne passe dans l'avenir. Avec 46 ans de recul
    (`seTendAuFilet`), une réponse de 1960 à 1980 ne peut être que dans la
    troisième ou la quatrième époque, comme la piste d'aujourd'hui s'arrête à
    l'année en cours.
- **Une grandeur.**
  - Quatre ordres de grandeur bornés par la suite 1, 3, 10, 30, 100… : de
    1 000 à 3 000, de 3 000 à 10 000.
  - L'ordre de grandeur de la réponse commence à la plus haute borne qui ne
    la dépasse pas ; sa place parmi les quatre est tirée au hasard.
  - **Une réponse pile sur une borne est des deux tranches qui la bordent** :
    10 000 m² se range de 3 000 à 10 000 comme de 10 000 à 30 000 (« dans
    quelle case ? », Huguette).
  - Des tranches centrées sur des nombres ronds (≈ 100) mettaient au milieu
    de la piste la réponse de toutes les questions qui en ont une ronde — vu
    à la maquette. Bornées par des nombres ronds, une réponse ronde tombe sur
    une borne.
- **La piste d'une tranche est régulière**, en crans ronds, deux cents au
  plus : d'un an pour une époque ; de 5 de 300 à 1 000, de 10 de 1 000 à
  3 000 ; jamais moins d'un pour une réponse entière, d'un dixième sinon. Des
  graduations la disent régulière à l'œil.
  - La première version la voulait logarithmique (« on pense en rapports ») :
    son milieu de 300 à 1 000 tombait vers 550 quand Claire visait 650, 625
    ne se posait pas (624, puis 627), et « + » restait coincé à 1380 et à 62
    — deux crans écrivaient le même nombre. Le rapport reste dans les
    tranches, qui croissent par trois ; dedans, on vise en unités.
- **Ce qui se tire se tire au départ** : les quatre époques, la place de la
  réponse et les repères se figent dans le plan de la partie (`FiletTire`),
  comme la piste aujourd'hui.

### 3.3 Le jugement

- **À la distance d'abord** :
  - une année : ★★★ à un douzième de l'époque près (2 ans sur 25, 4 sur 50,
    8 sur 100), ★★ à un quart (6, 12, 25 ans) ;
  - une grandeur : ★★★ à 6 % de la réponse, ★★ à 25 % — l'écart en pour cent
    de la réponse, lu au dixième, tel que l'écran l'écrit. La première
    version jugeait en rapport (x / 1,25) et écrivait l'écart arrondi :
    « Ton écart 24 % » sous « À 25 % près : non » (Huguette, 190 g pour
    250 g), « 6 % » sous « À 6 % près : non » (Claire, 17 pour 16).
- **Sinon, ★ pour la bonne époque**, ou le bon ordre de grandeur.
- **Une réponse posée près d'une borne**, de l'autre côté, garde ses étoiles
  de distance : 2 ans d'écart valent ★★★, quelle que soit l'époque touchée ;
  la révélation le dit (« La mauvaise époque, mais si près de la réponse que
  la distance compte d'abord »).
- **Les aides payées** retirent leur étoile de ce qui précède (§ 3.6).
- **Ratée — aucune étoile de distance ni d'époque —, la manche coûte un
  cœur**, comme aujourd'hui ; une aide ne le fait jamais perdre. Une étoile
  rapporte son or et frappe le gardien, comme aujourd'hui.

Au hasard, un joueur trouve la bonne époque une fois sur quatre : le savoir
compte enfin.

### 3.4 Le curseur ne part de nulle part

- Posé d'office au milieu, il donnait des étoiles à qui ne bougeait pas, et
  le milieu d'une tranche ronde était la réponse.
- Il garde sa valeur quand on change d'époque, si elle y tient encore.

### 3.5 Les repères

- **Deux repères au plus** sur la frise des quatre époques, et ceux de
  l'époque ouverte descendent sur la piste (« comme Notre-Dame », 69 m, se
  cherchait à tâtons — Samir) :
  - **leur époque se tire d'abord, chacune la même chance**, un repère par
    époque ; puis un repère de cette époque. Choisis parmi tous ceux qui
    s'écartent de la réponse, ils tombaient rarement dans l'époque de la
    réponse — moins de place autour d'elle — et deux repères dans deux
    époques valaient « Deux époques de moins » gratuit (Claire : cinq repères
    sur cinq hors de l'époque de la réponse). Mesuré sur mille tirages de
    chaque année de la maquette : 0,34 repère par manche dans l'époque de la
    réponse, 0,56 dans chacune des autres ; l'époque tirée d'abord, 0,50
    partout (`reproductions/reperes-par-epoque.cjs`) ;
  - jamais à moins d'un quart d'époque de la réponse ;
  - jamais du même sujet que la question (aucun mot de cinq lettres ou plus
    en commun).
- **Les siens d'abord.** Une année que le joueur a placée à ★★ au moins,
  **sans aide**, devient *son* repère : elle revient, dorée, sur la frise de
  ses prochaines dates (« 1889 · La tour Eiffel (ton repère) »). Sa mémoire
  devient sa règle graduée. Une année trouvée par l'indice n'est pas un
  savoir : l'Atari « de l'indice » revenait à Huguette comme son repère ; la
  révélation le dit (« Trouvée avec une aide : elle ne devient pas ton
  repère »).
  - **Un des siens au plus par manche** : au second tour, les deux repères
    d'Huguette prenaient toute la frise, et plus une date connue n'y venait.
  - Il « pourra revenir », pas « se posera » : il ne vient pas quand il
    donnerait la réponse (Brasília, 1960, promis et absent d'une question
    dont la réponse était 1960).
  - En production, ils se lisent du journal des réponses : les pièces du
    Filet à ★★ au moins, et les questions de la base à une année exacte qu'il
    a trouvées en QCM.
- **Puis des dates que tout le monde connaît.**
  - Une liste tenue à la main, chaque date vérifiée (`extraire.mts` de la
    maquette en porte 68).
  - En production, un fichier de contenu du Cabinet (`reperes.json`), jugé
    au rangement comme les autres.
- **Pour les grandeurs**, des repères de la même unité quand il y en a : la
  tour Eiffel (330 m), un marathon (42 km), un match de football
  (90 minutes). Jamais la définition d'une unité : « 100 ans · Un siècle »,
  pour l'âge d'Orson Welles, apprenait à Huguette ce qu'est un siècle. Les
  unités de la base sont trop variées pour en avoir souvent ; l'indice y fait
  le travail.

### 3.6 Les aides

- **Deux aides, chacune une fois par manche** :
  - **« Deux époques de moins »** (« deux ordres de moins ») retire deux
    mauvaises époques : le 50:50 du Millionnaire ;
  - **« Un indice »** donne une phrase pour s'orienter, jamais la valeur
    (§ 3.7).
- **Chacune, payée, retire une étoile à ce que la manche rapporte** : ★★
  moins une, ★. Ratée, la manche coûte un cœur comme toujours ; réussie, elle
  garde le cœur même quand l'aide a pris sa seule étoile (« Ton aide a pris
  l'étoile ; ton cœur reste »).
  - **La première version abaissait un plafond** (« au plus ★★ ») : à qui ne
    visait qu'une étoile, l'aide ne coûtait rien, et Claire a vu la faille —
    « dès que je sèche, j'en prends une ; avec les deux, je ne perds
    quasiment jamais de cœur ». Le calcul lui donne raison — sur une année
    qu'on ignore tout à fait, un joueur qui choisit une époque au hasard et
    pose au milieu : « Deux époques de moins » sous plafond faisait passer de
    0,43 à 0,76 étoile en moyenne, et d'un cœur perdu trois fois sur quatre à
    une fois sur deux, mieux sur les deux tableaux. Retirée, elle coûte
    0,07 étoile en moyenne pour un quart de cœur sauvé : une vraie décision.
    Les deux à la fois, sous plafond, rapportaient 0,95 étoile pour un cœur
    perdu une fois sur vingt — l'assurance gratuite de Claire ; retirées,
    0,19 étoile pour le même cœur sauvé (`reproductions/prix-des-aides.mjs`).
  - L'indice, lui, reste rentable quand on sèche — s'il mène à la bonne
    époque neuf fois sur dix, 0,65 étoile payée, contre 0,43 sans — et coûte
    quand on sait à peu près : c'est ce qu'une aide doit être.
  - Ce qu'elle coûte se dit en clair sous les boutons, et ce qu'elle ne
    coûte jamais : « Tes aides : −1 ★ sur ce que la manche te rapportera,
    jamais ton cœur : seule une manche ratée le coûte » — Claire et Samir ne
    l'apprenaient qu'à la révélation. Le filet barre l'étoile payée avant le
    lancer, la révélation et le bilan après — Samir ne savait pas si c'était
    « une étoile retirée de mon score, ou seulement le plafond qui baisse ».
    Une aide offerte le dit aussi (« elle ne te coûte rien ») : Huguette, sous
    « Prise · offerte », croyait avoir payé.
  - Au second tour, avec ce prix : « on peut encore protéger ses cœurs, mais
    plus gratuitement » (Claire, qui a payé deux aides exprès : ★★ gagnées,
    toutes deux reprises, le cœur gardé).
  - Un prix en étoiles, pas en or : il se paie dans la manche même, sans un
    geste de plus, et l'or garde son seul usage, le marchand.
- **Une question sans indice honnête ne propose que l'autre aide** : quand
  l'énoncé donne déjà l'époque (un sous-marin allemand coule un paquebot ; la
  trêve de Noël dans les tranchées), tout indice d'époque est la réponse
  (§ 3.7).
- **La carte Coup d'œil offre la première aide de chaque épreuve** :
  - elle remplace Éclairer au Filet, dont la zone dorée ne servait à
    personne ;
  - la carte garde son rôle ailleurs.

### 3.7 Les indices

- **Sa cible est la tranche, jamais la valeur** : une phrase de 100 signes au
  plus, qui mène à l'époque ou à l'ordre de grandeur, et laisse encore à
  savoir.
  - une année : son époque ou son contexte, par des repères que le public
    connaît (« Au temps du disco, quand les premières consoles entrent dans
    les salons ») ;
  - une grandeur : un encadrement large par des choses connues (« Nettement
    plus haute que l'Arc de triomphe, mais bien moins que la tour Eiffel »).
- **Écrits par des agents, puis jugés deux fois**, comme le contenu du
  Cabinet (`cabinet-contenu.ts`) :
  - **à la lettre, par un script** : aucun nombre à moins de 15 ans d'une
    année, ni à moins de 20 % d'une grandeur ; le nombre en toutes lettres
    non plus ;
  - **au sens, par un juge à l'aveugle** : un agent qui se met à la place
    d'un profane — rien du sujet, une culture d'école — et dit ce qu'il tire
    de la question et de l'indice : la valeur, ★★ à coup sûr, la tranche,
    rien, une erreur, une ambiguïté. Un indice qui mène à la valeur se
    réécrit, puis repasse le juge.
- **Ce que le juge a trouvé** (`maquette-filet/juge-des-indices.json`, chaque
  passe et son verdict) : la tablée se plaignait d'indices qui donnaient la
  réponse — le carré de 25, « fois cent, puis le quart » ; Minecraft, « une
  puissance de deux entre seize et cent » ; les mineurs chiliens, « compte les
  semaines ». Le juge l'a mesuré :

  | Sur les 140 questions jouables | Premier jet | Après trois passes |
  |---|---|---|
  | Mènent à la tranche — la cible | 63 | 124 |
  | ★★ à coup sûr | 26 | 9 |
  | Donnent la valeur | 42 | 0 |
  | Ne mènent à rien, ou à deux tranches | 7 | 3 |
  | Ambigus (« bien plus que la majorité ») | 2 | 0 |
  | Sans indice : l'énoncé donne déjà l'époque | — | 4 |

  - Ce que le script ne voyait pas, c'est le calcul (« fais l'addition » :
    bon quand il reste à savoir, mauvais quand il suffit de compter),
    l'élimination (deux puissances de deux, un seul billet entre 300 et
    1 000 €) et le fait daté de la même année (« l'année du premier Star
    Wars » pour l'Atari).
  - La première relecture, d'un agent qui écrivait aussi, n'en avait
    corrigé que 6 : il faut un juge qui n'écrit pas.
- **Puis la tranche du jeu.** Au second tour, Samir perd un cœur sur un
  indice honnête : « dans les vingt ans qui suivent la Libération », pour
  1946, mène à 1944–1964, à cheval sur 1925–1949 et 1950–1974 — « mon calcul
  était bon, la chance non ». Le juge relit alors chaque indice avec la
  tranche du jeu sous les yeux : **85 sur 136 enjambaient une frontière** —
  « plus de X, moins de Y », « l'après-guerre », « la Belle Époque », qui
  coupent 1900, 1925, 1950 ou 300. Recentrés, puis rejugés sur la tranche et
  sur la valeur :

  | Sur les 136 indices | Avant | Après |
  |---|---|---|
  | Tiennent dans la tranche de la réponse | 51 | 106 |
  | À cheval, la réponse contre une frontière (1946, 330 ml) — gardés | 85 | 29 |
  | Donnent la valeur, ou affirment un fait faux | 0 | 0 |

  - **La cible, précisée : la tranche du jeu, toute la tranche.** Un indice
    qui la recopie (« plus haut que la tour Eiffel, mais loin d'un
    kilomètre » pour 300–1000) fait choisir la bonne ; il ne dit rien de
    plus que ce que vaut le milieu de la tranche (§ 7).
  - **Contre une frontière, on garde l'indice qui enjambe** : un indice tenu
    dans la tranche y serait presque la valeur (« juste après la guerre »
    pour 1946), et la distance paie des deux côtés (§ 3.3).
  - La passe a aussi trouvé une question qui se compte (les chiffres 9 de 1
    à 100), écartée avec les calculs (§ 4.4).
- **Rangement** : en production, un fichier de contenu du Cabinet, clé par
  question (`server/content/cabinet/indices-du-filet.json`) — ou un champ de
  la base, si l'on veut que la campagne s'en serve un jour.

### 3.8 La révélation

- **Le verdict**, titre de l'écran où le focus se pose : « Pile dedans »
  ★★★, « Tout près » ★★, « La bonne époque » ★ — « Le bon ordre de grandeur »
  pour une grandeur (« une époque, pour du beurre ? », Huguette) —, « À
  côté », et « La manche te coûte un cœur ». L'étoile payée pour une aide
  paraît barrée ; quand les aides ont tout pris, « Tes aides ont pris tes
  étoiles ; ton cœur reste ».
- **La frise**, où chaque chose a sa forme et ses mots, jamais sa seule
  couleur — Samir, daltonien, confondait quatre ronds de teintes voisines, et
  le lancer se cachait sous la réponse :
  - **▼ la réponse**, au-dessus de la frise ; **▲ ton lancer**, en dessous :
    ils ne se chevauchent jamais ;
  - **○ un repère**, **◆ le tien** ;
  - la bonne époque écrit « la bonne », la sienne « ton choix » ;
  - la légende reprend chaque forme en mots.
- **« La réponse : 1898 · tu visais 1840 »**, puis les trois critères en
  lignes (« La bonne époque — ★ oui », « À 6 ans près — non »…), l'écart, et
  ce que les aides ont pris.
- **L'anecdote**, toujours : c'est le moment où l'on apprend.
- **Le repère gagné**, s'il y en a un.
- **« Manche suivante »**, collé au bas de l'écran, mince : sous un repère
  gagné, il passait sous le pli (Claire).

### 3.9 Ce que voit le téléphone (invariant 1)

- **Avant le verdict, le téléphone ne reçoit jamais** la valeur, ni quelle
  époque est la bonne, ni l'endroit de la réponse dans son époque.
- **Il reçoit les quatre époques**, comme il reçoit les bornes de la piste
  aujourd'hui.
- **Les aides se jouent au serveur** :
  - « Deux époques de moins » renvoie les deux époques retirées, choisies au
    serveur ;
  - l'indice ne part qu'une fois pris ;
  - les repères partent avec la manche. Leur époque, tirée d'abord, ne dit
    rien de celle de la réponse (§ 3.5) ; ils n'en disent qu'une chose : elle
    n'est pas tout contre eux, à moins d'un quart d'époque. C'est une fuite
    minime et voulue : un repère collé à la réponse la donnerait.
- **La place de la réponse dans ses quatre époques se tire au serveur**, du
  hasard du serveur, jamais de la graine (`pisteDuFilet` aujourd'hui).

## 4. Le moteur de difficulté

### 4.1 Ce qu'il fait

Il donne, pour chaque question et **chaque jeu qui la pose**, une
connaissabilité : la part des joueurs qui la réussiraient.

- Au Filet : la part qui placeraient la valeur à 5 % près.
- En QCM : la part qui la trouveraient parmi quatre.

Et, pour un joueur donné, sa chance (§ 4.4).

La même question n'a pas la même difficulté selon le jeu. « Combien de cm²
dans un m² ? » se trouve parmi quatre réponses par élimination ; sur une
piste, sans réponse proposée, il faut le savoir. Un sujet obscur coûte peu en
QCM et tout au Filet, au Mot ou aux Indices.

### 4.2 Deux notes qui se corrigent l'une l'autre

**La note a priori**, avant toute réponse : l'avis d'un panel d'IA, question
par question et jeu par jeu.

- La consigne, par jeu (celle du Filet) : « la part des joueurs adultes d'une
  application de quiz grand public française qui placeraient la valeur à
  ±5 % près, sans choix » ; celle du QCM, « parmi quatre ».
- Validée sur la production :

  | Ce qu'il fallait prédire | Difficulté écrite | Panel de l'IA |
  |---|---|---|
  | Au Filet, « il savait » (à 2 % près), 163 lancers | AUC 0,78 | **AUC 0,85** |
  | Au Filet, « à 9 % près » | AUC 0,57 | **AUC 0,69** |
  | En QCM, la réussite corrigée de la force des joueurs (369 questions, 1 729 premières réponses) | rang 0,49 | **rang 0,62** |

- Quand l'IA annonce qu'au moins un joueur sur deux placerait la valeur,
  57 % savaient vraiment ; sous 25 %, 4 à 7 %.
- **Elle se recale** : elle prédit 75 % de réussite moyenne en QCM, les
  joueurs en font 68 % — un décalage d'ensemble, appris une fois par famille.
- **Ce qui n'a pas servi**, mesuré sur 32 780 premières réponses :
  - la notoriété du sujet (ses vues sur Wikipédia, son nombre de langues)
    n'ajoute rien à la difficulté écrite (AUC 0,685 dans les deux cas) ;
  - une question sur Astérix peut porter sur un détail obscur : c'est le fait
    qui doit être connu, pas son sujet ;
  - la forme, la catégorie, l'âge minimum et la longueur ajoutent un peu
    (0,697).

**La note vécue**, apprise des réponses de chaque question dans chaque jeu :

- **Une cote par question et par jeu**, mise à jour à chaque réponse, comme
  les problèmes d'échecs de Lichess. Elle part de la note a priori et s'en
  détache à mesure que les réponses arrivent.
- **Le branchement dans le code d'aujourd'hui** : une question démarre avec
  vingt réponses fictives au taux de sa difficulté écrite (`tauxLisse`,
  `shared/campagne.ts`). Elles prendraient le taux de la note a priori, jeu
  par jeu.
- **Au Filet, chaque lancer dit de combien on s'est trompé**, pas seulement
  si l'on a eu juste : ses étoiles (0 à 3) se lisent en paliers, et le moteur
  apprend vite, même avec peu de joueurs.

### 4.3 Les critères, en résumé

| Critère | D'où il vient | Ce qu'il pèse |
|---|---|---|
| L'avis du panel de l'IA, par jeu | une passe d'agents sur la base, puis à l'écriture de chaque question | le plus fort |
| Les réponses de chaque question, par jeu | le journal des réponses | prend le dessus avec les réponses |
| La force du joueur dans la catégorie | le modèle du savoir (`core/modeleDuSavoir.ts`) | sa chance à lui |
| La difficulté écrite | `meta.difficulte` | l'ancien départ, gardé comme repli |
| La forme (année, nombre, mot), l'âge minimum | la base | un ajustement |

### 4.4 Ce qu'il permet

- **Viser une chance plutôt qu'une marche.**
  - Le tirage d'une épreuve vise une réussite par acte : l'acte I autour de
    trois manches sur quatre, l'acte II deux sur trois, l'acte III une sur
    deux.
  - En première version, des seuils de connaissabilité :
    - l'acte I tire au Filet ce que 40 % au moins savent placer ;
    - l'acte II, de 25 à 39 % ;
    - l'acte III, le reste.
  - Le vivier de la maquette — les questions réellement posées, les calculs
    écartés — s'y répartit en 35, 40 et 65.
- **Écarter ce qui se calcule.** Un calcul (« le carré de 25 »), une
  conversion d'unités (« les secondes d'une heure », « les mètres carrés d'un
  hectare »), une question qui écrit de quoi trouver sa réponse (Verdun « du
  21 février au 18 décembre ») : on la sait ou on la calcule, on ne l'estime
  pas.
  - Le moteur les donnait connues de tous (85 à 90 %) : l'acte I tournait au
    cours de maths (« c'est pas fun », Théo), et l'indice d'un calcul en était
    la solution — les 16 questions de cette sorte, sur 156, avaient toutes un
    indice qui donnait la valeur.
  - Peu nombreuses dans la base, servies souvent : 56 au moins des 1 825
    questions que le Filet peut poser se calculent ou se convertissent,
    d'après leurs mots (3 %, `reproductions/calculs-du-vivier.mts`) — mais 16
    des 156 que la production a posées (10 %), des conversions de la marche 1
    aux diviseurs de la marche 5.
  - Le panel les marque en notant (une case de plus à sa consigne : « se
    calcule à partir de l'énoncé ou d'une définition d'école »), et le tireur
    du Filet ne les pose pas ; le QCM et le Quiz les gardent.
- **Puis la chance de chacun** : la force du joueur dans la catégorie
  (modèle du savoir) contre la difficulté de la question dans ce jeu. Le
  Cabinet se joue seul : l'invariant 8 n'interdit pas d'y régler le jeu à la
  personne.
- **Dire la difficulté sur la carte** : la couleur de piste des sentiers
  (verte, bleue, rouge, noire, chacune sa forme) sur chaque étape. Pour les
  sentiers, le choix a été de dire la chance plutôt que d'adoucir : la carte
  deviendrait un choix de risque, sans toucher aux règles.
- **Au QG** : la liste des loteries — ce que presque personne ne sait placer
  —, à réécrire, à retirer du Filet, ou à garder pour l'acte III.
- **Pour les autres jeux** : le Pari (64 % de manches à zéro étoile), les
  Indices, l'Épingle. La même mécanique, sur leur propre note.

### 4.5 Le vivier du Filet, vu par le moteur — et ce qu'il faut écrire

Le panel a noté 435 questions tirées au hasard parmi les 1 780 que le Filet
peut poser (`reproductions/moteur-de-difficulte.ts vivier`) :

| | Acte I (≥ 40 %) | Acte II (25–39 %) | Acte III (< 25 %) |
|---|---|---|---|
| Tout le vivier | 43 % ± 5, environ 760 questions | 22 %, environ 400 | 35 %, environ 620 |
| Les années | 63 % | 25 % | 12 % |
| Les grandeurs | 28 % | 20 % | 51 % |

- **Une année se place bien mieux qu'une grandeur** : les dates sont le cœur
  du Filet, les grandeurs presque des loteries une fois sur deux.
- **Trois catégories n'ont presque rien de connaissable** : la Cuisine
  (environ 9 questions sur 83), la Géographie (14 sur 111) et la Nature (13
  sur 111). Une étape « Filet · Cuisine » à l'acte I y tournerait en rond en
  quelques jours.
  - La carte de la traversée ne doit proposer le Filet que dans une catégorie
    qui a de quoi tenir son acte : le tracé lit le vivier du moteur.
  - Il faut écrire là : des estimations que le grand public sait placer
    (hauteurs, distances, durées et dates connues), notées par le panel à
    l'écriture, une centaine par catégorie faible.
  - C'est la réponse à la question du volume : pas plus de questions en
    général, mais des questions **connaissables au Filet** là où il en
    manque.

### 4.6 Le mettre en service

- **La passe sur la base** : les agents notent les 27 404 questions, par lots,
  sur l'abonnement, comme la génération de la base (`generer-campagne.ts`).
  - Le panel de cette nuit a noté 518 questions en six lots de 87, d'un
    agent chacun.
  - Les questions neuves sont notées à l'écriture (`redacteur-campagne`), et
    celles de la routine du matin à leur dépôt.
- **À blanc d'abord**, comme Duolingo :
  - une semaine où le moteur note ses prédictions sans servir ;
  - puis il se compare aux lancers (AUC, rang), et seulement alors il tire.

## 5. L'intégration dans FiestApp

Tout se lit dans la règle du Cabinet (`.claude/rules/cabinet.md`) ; voici ce
que chaque morceau devient.

| Morceau | Ce qui change |
|---|---|
| `shared/cabinet/bareme.ts` | Les chiffres neufs, chacun sa ligne dans `baremes.md` (`documentation.test.ts`, `cabinet-catalogue.test.ts`) : les époques (`EPOQUES_DU_FILET` : 25, 50, 100 et leurs seuils), les anneaux (un douzième, un quart ; 6 % et 25 % de la réponse, l'écart lu au dixième), la suite des ordres de grandeur, les crans d'une tranche (deux cents au plus, ronds, un au moins pour une réponse entière), `AIDES_PAR_MANCHE` (2), ce qu'une aide payée retire (une étoile). `LARGEURS_DU_FILET`, `ETOILES_DU_FILET`, `POSITION_DE_LA_REPONSE`, `PISTE_DES_ANNEES`, `ZONE_DU_FILET` restent, pour les parties d'avant. |
| `shared/cabinet/jeux/filet.ts` | La règle pure : le tirage (`FiletTire` : la question, la valeur, les quatre époques, la place de la réponse, les repères), l'état (l'époque touchée, les aides prises, les époques retirées), le geste (`repondre` : l'époque et le curseur ; `aide` : sa clé), le jugement à la distance (§ 3.3), ce qu'on montre et ce qu'on révèle (§ 3.9), la pièce (`composee` : « 1852\|1\|2 », le curseur, l'époque, les aides), le cartel. |
| `VERSIONS_DU_DEPART` (`shared/cabinet/partie.ts`) | Une version de plus (la 4) : le pli jugerait autrement une partie déjà commencée. La règle d'avant reste, choisie par `d.v` ; son départ et son bilan écrits en dur dans `cabinet-regles.test.ts`. |
| `server/src/core/cabinet/tirages/filet.ts` | Le tirage par la connaissabilité de l'acte (§ 4.4) au lieu des marches (`MARCHES_DU_FILET_AUX_EPREUVES`, `_AUX_GARDIENS`), les époques et les repères figés dans le tirage, du hasard du serveur. |
| Le tracé de la carte (`tracerLaCarte`, `shared/cabinet/traversee.ts`) | Une étape de Filet ne prend qu'une catégorie dont le vivier tient son acte — le serveur lui donne, comme il donne au Quiz ses thèmes (`themesDuQuiz`), les catégories qui en ont assez : la Cuisine, la Géographie et la Nature n'en ont pas à l'acte I (§ 4.5). |
| Les repères | Un fichier de contenu (`server/content/cabinet/reperes.json`, rangé et jugé par `cabinet-contenu.ts`), et les siens lus du journal des réponses (`JournalDesReponses`, une dérivation de plus, comparée au SQL d'avant dans `journal-des-reponses.test.ts`). |
| Les indices | `server/content/cabinet/indices-du-filet.json`, une entrée par question, jugée à la lettre par `cabinet-contenu.ts` et au sens par le juge à l'aveugle (§ 3.7) — un agent de plus dans la chaîne d'écriture, comme `relecteur-campagne`, qui n'écrit jamais ce qu'il juge ; une question sans indice ne propose pas l'aide. |
| Les pouvoirs (`shared/cabinet/pouvoirs.ts`) | Éclairer, au Filet, devient la première aide offerte ; Changer et le temps en plus restent. `refusDuPouvoir` dit pourquoi une aide ne se prend pas (déjà prise, plus de place, la manche tranchée). |
| La page (`client/src/views/cabinet/jeux/Filet.tsx`) | L'écran du § 3.1, ses classes `cab-filet-*` dans la section du Cabinet de `styles.css`. Aucun texte sous 17 pixels : `cabinet-ecran.test.ts` relit chaque taille — la première maquette en écrivait à 13, « petites et pâles » pour Huguette ; la seconde tient 17 partout dans une manche, la frise sur deux ou trois lignes, et les grands nombres en mots (« 300 millions »). Le toucher pose le curseur où il tombe, par le doigt même (`pointerdown`) : un curseur natif ne dit rien quand on touche sa valeur, et le milieu d'une piste vierge ne répondait pas. Le bouton du lancer se colle au bas de l'écran, la piste ouverte vient au-dessus de lui (`scroll-padding-bottom`). |
| Le moteur | `core/modeleDuSavoir.ts` : une difficulté par question et par jeu, partie de la note a priori ; la note a priori dans la base (`meta.connaissabilite`, par jeu) ou dans une table du Cabinet, avec la case « se calcule » qui écarte une question du Filet (§ 4.4) ; les lancers du Filet lus en paliers. |
| Le QG | La page du Cabinet : la réussite de chaque jeu, la part des loteries tirées, la liste des questions à revoir. |
| Le calibrage (`calibrage-cabinet.ts --sections traversee`) | Le joueur modèle du Filet devient bimodal — il sait, il sait à peu près, il ne sait pas —, recalé sur les lancers réels. Les étoiles par manche du Filet passent de 0,67 à environ 1,1–1,8 : les gardiens tombent plus vite, à mesurer avant de toucher à leurs points de vie. |

**Les tests à écrire**, dans `server/test/` (un comportement neuf arrive avec
son test) :

- la règle pure :
  - les époques (bornes, place de la réponse, jamais l'avenir) ;
  - les ordres de grandeur (une valeur ronde sur une borne : des deux
    tranches) ;
  - les crans d'une tranche : réguliers, ronds, chaque « + » change la
    valeur jusqu'au bout — la maquette en a joué 18 manches au navigateur,
    toucher du milieu compris, sans un cran coincé ;
  - le jugement à la distance de part et d'autre d'une borne, l'écart au
    dixième (17 pour 16 : 6,3 %, non) ;
  - l'aide payée qui retire une étoile sans jamais coûter le cœur, le
    curseur absent à l'échéance ;
- le secret, à ajouter à `cabinet-secret.test.ts` : ni la valeur ni la bonne
  époque dans une vue, l'indice seulement une fois pris ;
- les repères : leur époque tirée d'abord (sur mille tirages, celle de la
  réponse en reçoit autant que les autres, à un centième près), jamais trop
  près, jamais du même sujet, les siens d'abord, gagnés sans aide ;
- le juge des indices, et le tireur qui écarte ce qui se calcule ;
- une partie de la version 3 relue telle qu'elle s'est jouée ;
- le tirage par la connaissabilité ;
- l'écran rendu (`cabinet-ecran-neufs.test.ts`).

## 6. Mesurer après la mise en ligne

Le script `reproductions/filet-en-production.ts` rejoue les mêmes lectures
sur la nouvelle version. Les cibles :

| Mesure | Aujourd'hui | Cible |
|---|---|---|
| Manches du Filet réussies | 43 % | 65 à 80 % à l'acte I, 50 % au moins à l'acte III |
| Au hasard (la bonne époque) | 45 % | 25 % |
| Ce que le savoir ajoute | −2 points | +25 points au moins |
| Manches à zéro étoile | 59 % | 35 % au plus |
| Le Filet choisi sur la carte | 23 % | 33 % (la part égale) |
| Coups fatals du Filet | 9 sur 21 traversées perdues | sa part des épreuves |
| Le moteur, à blanc | — | AUC ≥ 0,8 sur les lancers neufs |

Avec 11 joueurs, pas de test A/B : un avant-après, par les mêmes scripts. Et
un sondage du QG aux joueurs du Cabinet (`qg_annonce_questions`).

## 7. Les décisions à prendre

1. **Le Filet en deux temps** (cette proposition), ou seulement le filet qui
   se resserre tout seul.
   - Le second est plus simple, mais laisse au hasard 45 % de manches
     réussies.
   - Le premier le ramène à 25 %, et paie le savoir approximatif.
2. **Les aides** :
   - une étoile retirée chacune, la carte Coup d'œil offrant la première —
     la proposition, après la tablée ;
   - le plafond de la première version (« au plus ★★ ») était plus doux et
     plus simple à dire, mais gratuit pour qui ne savait rien (§ 3.6) ;
   - ou une aide gratuite pour tous à l'acte I, le temps d'apprendre.
3. **La couleur de piste** de chaque étape sur la carte de la traversée.
4. **La passe du panel sur toute la base**, puis le moteur à blanc une
   semaine.
5. **Les points de vie des gardiens**, à remesurer une fois le Filet changé.
   Le calibrage proposait déjà 11 et 17 aux actes II et III.
6. **Les autres jeux après le Filet** : le Pari d'abord (64 % de manches à
   zéro étoile, 45 cœurs perdus), puis les Indices.
7. **Écrire des estimations connaissables** là où le vivier en manque : la
   Cuisine, la Géographie, la Nature, et les grandeurs en général (§ 4.5) —
   une centaine par catégorie, notées par le panel à l'écriture.
8. **Le chrono** : deux gestes au lieu d'un, et un indice à lire. 45 secondes
   suffisent à Claire, pas à Huguette (« remonter chercher la question,
   choisir l'époque, toucher la piste, lire l'indice, et réfléchir ! »). À
   garder, et à mesurer en production (le temps de chaque manche est déjà
   écrit, `dureesDesManches`) avant d'y toucher ; la carte « Prendre son
   temps » existe pour qui lit lentement. Hugo, au lecteur d'écran, les
   dépasse à chaque manche : écouter la manche de haut en bas en prend déjà
   vingt.
9. **Le pari perdu** : « il n'y a plus de risque à prendre » (Claire, qui
   aimait le frisson du petit filet). Le frisson reste celui de la carte
   Miser (Quitte ou double) ; un pari propre au Filet attend (§ 8).
10. **La largeur de l'anneau ★★** : un quart d'époque. Dans la bonne époque,
    le milieu sans rien savoir y tombe 52 fois sur cent, et ★★★ 20 fois
    (`reproductions/prix-des-aides.mjs`) — « ★ pour la bonne époque vaut
    plutôt une étoile et demie » (Claire, au second tour). C'est aussi ce qui
    paie l'à-peu-près (Huguette, cinq ans d'écart : ★★). La resserrer à un
    sixième (4 ans) ferait tomber le milieu à 36 % ; un choix de produit, à
    mesurer au calibrage avant d'y toucher.
11. **Écartée : une étoile à moins d'une demi-tranche, même dans la tranche
    voisine** — « onze ans ou cent trente-trois, même tarif » (Samir).
    Rejouée sur les lancers réels : 71 % de manches réussies au lieu de 62,
    mais 83 % sur les questions connues, au-delà de la zone visée, et 68 %
    sur les loteries au lieu de 54 (`reproductions/filet-en-production.ts`,
    la ligne « ★ aussi à une demi-tranche »). Trop généreux : ce sont les
    indices recentrés sur leur tranche (§ 3.7) qui répondent au cœur perdu de
    Samir.

## 8. Ce qui attend

- **La salle fantôme** : la bande où les joueurs précédents ont lancé leur
  filet, comme « l'avis du public » du Millionnaire. Il faut d'abord des
  lancers : 162 questions distinctes pour 169 lancers aujourd'hui.
- **Juger par rapport aux autres**, comme les soirées jugent une estimation
  par rapport à la salle : la difficulté se règlerait d'elle-même. Même
  attente.
- **Le pari d'un point** « plus haut ou plus bas que la médiane des autres »
  (Wits & Wagers, Guesspionage), pour qui ne sait rien.
- **Écarté : des jetons d'aide gagnés par le savoir**, comme les jetons de
  Hitster — un ★★★ sans aide en rapporterait un, à dépenser là où l'on sèche.
  Astucieux, mais c'est une cinquième notion, et la traversée n'en a que
  quatre (les cœurs, l'or, tes cartes, la carte) : l'aide se paie dans la
  manche même, en étoiles.
