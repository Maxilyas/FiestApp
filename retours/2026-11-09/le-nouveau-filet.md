# Le nouveau Filet et le moteur de difficulté — cahier des charges

Le 9 novembre 2026, à la demande du propriétaire : « Au lieu de sortir le
filet, est-ce que plutôt on ne s'intéresserait pas à la modification de la
difficulté ? Une question difficile en filet peut être extrêmement dure si on
ne connaît même pas le sujet. […] Créer un moteur intelligent capable de
donner une note sur la difficulté de la question en se basant sur plusieurs
critères. Aider les joueurs sur certains jeux en permettant d'avoir peut-être
des indices ? » Puis : « maquette et cahier des charges […] une vraie
amélioration de ce qui existe, en te basant sur les données de la prod et ce
qu'il se fait concrètement dans ce type de jeu ». Enfin, au matin, après
avoir joué la maquette : « Le filet en deux temps ne me dérange pas en soi,
mais là je trouve que c'est un peu brouillon. […] Lorsque l'on choisit une
époque, ça n'affiche pas la fourchette pour l'estimation en second temps ;
elle devrait se placer directement au milieu. Le levier le plus fort, c'est
d'avoir des questions que chacun connaisse, sachant que la population et la
connaissance sont des personnes françaises. »

- La maquette jouable : `maquette-filet/` (le README dit comment la lancer),
  publiée aussi en artefact privé.
- Les mesures : `reproductions/`, en lecture seule sur la production, et sur
  la base livrée.
- Le vivier du Filet classé question par question — ce que chaque Français
  sait placer, l'ancrage, ce qui se calcule : `vivier-du-filet.json`, à part
  de la base.
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

**Ce que propose ce cahier des charges, en cinq pièces :**

1. **Des questions que chaque Français sait placer** — le levier le plus
   fort, dit le propriétaire, et les lancers réels le confirment : ce que
   chaque Français sait se place à 2 % près sept fois plus souvent que le
   reste (42 % des lancers contre 6 %), et se réussit à 84 % en deux temps,
   contre 53 %. L'acte I pose cela d'abord. C'est aussi le plus mince :
   classé question par question, le vivier en a 150 sur 1 798, dont 105 que
   le Filet peut poser — une seule en Arts & lettres, une en Jeux. Et ce qui
   manque ne s'écrit pas facilement : à l'essai, un fait sur quatre que tout
   le monde connaît était déjà dans la base (§ 4.3 à 4.5). Les lots écrits
   le soir pour l'acte I l'ont confirmé : la Géographie y est entrée, mais la
   Nature et les Arts & lettres n'ont presque plus rien de connu de tous à
   écrire (§ 4.6).
2. **D'abord l'époque, puis la valeur.** Quatre époques (ou quatre ordres de
   grandeur) ; la bonne vaut déjà une étoile.
3. **Le filet se resserre tout seul.** Plus de taille à parier : à 2 ans près
   trois étoiles, à 6 ans deux. Le curseur se pose au milieu de l'époque
   choisie, et le filet dit d'emblée ce qu'il couvre.
4. **Des repères et deux aides.** Des dates connues sur la frise, et celles
   que le joueur a déjà su placer. Deux aides — « deux époques de moins », un
   indice écrit —, qui retirent chacune une étoile à ce que la manche
   rapporte, sans jamais coûter le cœur.
5. **Un moteur qui note chaque question pour chaque jeu.** Les actes II et III
   se tirent par sa note ; les loteries attendent le dernier acte, et ce qui
   se calcule ne se pose pas.

**Ce que ça change, rejoué sur les lancers réels** (une borne basse : les
curseurs ont été posés sous l'ancienne règle ; la règle rejouée est celle du
§ 3.3, mot pour mot) :

| Règle | Lancers | Manches réussies | Étoiles par manche | Au hasard | Ce que le savoir ajoute |
|---|---|---|---|---|---|
| Le Filet d'aujourd'hui | 169 | 43 % | 0,67 | 45 % | −2 points |
| Le filet qui se resserre tout seul | 169 | 56 % | 1,12 | 45 % | +11 points |
| En deux temps : l'époque, puis la valeur | 169 | 62 % | 1,20 | 25 % | +37 points |
| En deux temps, sans ce qui se calcule | 151 | 58 % | 1,07 | 25 % | +33 points |
| … ce que le moteur donne à 40 % ou plus | 36 | 67 % | 1,39 | 25 % | +42 points |
| … dont ce que chaque Français ne sait pas placer | 19 | 53 % | 1,05 | 25 % | +28 points |
| … ce que chaque Français sait placer | 19 | 84 % | 1,89 | 25 % | +59 points |
| … ou que le moteur donne à 50 % et plus — l'acte I réglé (§ 4.5) | 25 | **76 %** | **1,80** | 25 % | +51 points |

- Ce que chaque Français sait placer passe un peu au-dessus de la zone que
  visent les jeux qui règlent leur difficulté (65 à 80 %) : c'est l'acte I,
  celui où l'on apprend à jouer. Une règle un peu plus large y rentre (la
  première passe de classement : 67 %, § 4.2).
- Les lignes du tirage ne comptent pas les questions qui se calculent, que
  le nouveau Filet ne pose pas : comptées, elles faisaient dire 74 % au
  moteur (§ 5.2).

**Joué par une tablée, trois tours** (`la-tablee-du-filet.md`) : quatre
joueurs aux profils opposés — une institutrice de 72 ans au petit téléphone,
un lycéen pressé, une stratège qui joue chaque soir, un daltonien — ont joué
la maquette contre le Filet d'aujourd'hui, sur les vraies questions ; trois
d'entre eux ont rejoué chaque version corrigée, et un joueur aveugle l'a jouée
deux fois au lecteur d'écran. Tous préfèrent le nouveau — « nettement
meilleure », au second tour ; leurs notes montent d'un tour à l'autre, jusqu'à
4,5 sur 5. Leurs retours ont changé une trentaine de choses, dont le prix des
aides, la piste des grandeurs, la place de l'indice et la règle des
repères. Un juge à l'aveugle a relu
chaque indice : 42 sur 140 donnaient la réponse, aucun aujourd'hui ; 85 sur
136 menaient à cheval sur deux tranches, 25 aujourd'hui, toutes contre une
frontière.

**Puis le propriétaire l'a jouée, au matin** : l'écran s'épure, le curseur
se pose au milieu de l'époque choisie et le filet dit d'emblée ce qu'il
couvre (§ 3.1, § 3.4) ; l'acte I ne pose plus que ce que chaque Français sait
placer (§ 4).

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
  corrélation de rang de 0,1 à 0,4. Notre panel fait 0,61 (§ 5.2) : une
  bonne surprise, à confirmer sur plus de réponses.

## 3. Le nouveau Filet — les règles

### 3.1 Une manche

Un seul écran, de haut en bas — épuré au matin du 9 novembre, le propriétaire
le trouvant « un peu brouillon » :

1. **La question**, sa catégorie au-dessus.
2. **L'époque** — ou l'ordre de grandeur :
   - une ligne : « Choisis l'époque, la bonne vaut ★ » ;
   - quatre boutons côte à côte, une frise ;
   - au-dessus, deux dates repères au plus (§ 3.5), dites en mots dessous.
3. **L'indice, s'il est pris**, ou ce qui reste après « Deux époques de
   moins » : entre l'époque et la piste, là où l'on choisit et où l'on vise.
   Sous les aides, il passait derrière le bouton du bas (Samir).
4. **L'année** — ou la valeur —, dès qu'une époque est touchée, et rien
   avant :
   - **le curseur se pose au milieu de l'époque, et le filet dit d'emblée ce
     qu'il couvre** : « ★★★ 1960–1964 ★★ 1956–1968 » (§ 3.4) ; une aide
     payée y barre son étoile ;
   - le gros chiffre, puis la piste, régulière, et ses crans − et + ;
   - les grands pas d'une graduation (« − 5 ans », « + 100 g ») : de 198
     anneaux à 100, Hugo, au lecteur d'écran, touchait « − » 98 fois ;
   - « − » et « + » s'éteignent aux bouts ;
   - le doigt pose le curseur où il touche, et lui donne le focus ;
   - les deux anneaux du filet se dessinent autour du curseur, le grand en
     tirets, le petit plein ;
   - les repères de l'époque ouverte descendent sur la piste ;
   - toucher une autre époque reste possible.
5. **Les aides** (§ 3.6) et leur prix, en une phrase.
6. **« Lancer le filet »**, éteint tant qu'aucune époque n'est choisie
   (« Choisis d'abord une époque »). Collé au bas de l'écran à la seconde
   version, il cachait la piste, le gros chiffre et l'indice d'un petit écran
   (Huguette, Samir) : il reste à sa place.

**Ce que l'épure a retiré** :
- les titres numérotés des deux étapes et leurs barèmes (« à 2 ans ★★★ · à
  6 ans ★★ ») : le filet dit ses anneaux en nombres, et la révélation dit
  d'où viennent les étoiles ;
- les bornes de la piste sous elle : l'époque choisie les porte ;
- les nombres des graduations : des traits suffisent à dire la piste
  régulière, et leurs nombres se chevauchaient sous un texte agrandi
  (« 100150200250300 », Huguette) ;
- « Touche la piste », et l'attente d'un premier toucher.

La révélation se resserre de même (§ 3.8).

Chaque manche s'ouvre en haut, la question sous les yeux : à la première
version, elle s'ouvrait là où « Manche suivante » avait laissé la page.

**Au lecteur d'écran** (Hugo, la tablée) : chaque manche dit où l'on en est
(« Acte I », « Manche 1 sur 3 », « 4 cœurs sur 4 », la question en titre) ;
les quatre époques sont des boutons qui disent leurs bornes et lequel est
pressé ; le curseur porte sa vraie valeur et la dit (« 1937 », « 350 m ») —
il annonçait « 12 » pour 1937 ; un grand pas dit sa taille (« 5 ans de
plus ») ; les étoiles écrites se disent en mots (« une étoile en moins », pas
« moins un, une étoile ») ; l'indice pris, ce qui reste après « Deux époques
de moins » (« Il reste 1925–1949 et 1975–1999 ») et le verdict reçoivent le
focus ; la légende de la révélation dit les valeurs (« La réponse, 1946 ») ;
« Quitter » demande d'abord. Hugo, au second passage : « je vise en trois
gestes au plus ».

Le chrono reste de 45 secondes (`DUREES_DES_JEUX.filet`). À l'échéance, la
page lance ce qui est posé : l'époque choisie et le curseur où il est.

### 3.2 Les époques et les ordres de grandeur

- **Une année.**
  - Quatre époques consécutives, de 25 ans depuis 1800, de 50 ans de 1500 à
    1799, d'un siècle avant : on date plus grossièrement ce qui est loin.
  - Leurs bornes sont rondes : 1775–1799, 1800–1824.
  - L'époque de la réponse se place parmi les quatre sans qu'aucune époque
    ne passe dans l'avenir : une réponse de 1975 à 1999 ne peut être que dans
    la troisième ou la quatrième, une de 2000 à 2024 que dans la quatrième.
  - **Sa place se tire avec des poids**, pas au hasard parmi celles qui
    restent : tirée au hasard, elle se devinait — « toujours la dernière
    époque » gagnait 29 % des manches (25 % au hasard pur). Les poids donnent
    à chaque place un quart des réponses : les anciennes vont moins souvent
    dans la dernière, autant que les récentes y vont d'office
    (`reproductions/place-de-la-reponse.mts`, décision 10). La maquette tire
    ainsi.
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

### 3.4 Le curseur se pose au milieu de l'époque choisie

- **Dès qu'une époque est touchée, le curseur se pose en son milieu, et le
  filet dit ce qu'il couvre.** Le propriétaire, au matin du 9 novembre :
  « lorsque l'on choisit une époque, ça n'affiche pas la fourchette pour
  l'estimation en second temps ; elle devrait se placer directement au
  milieu ».
- Les versions jouées par la tablée attendaient un toucher (« Touche la
  piste »), de peur qu'un curseur posé d'office donne des étoiles à qui ne
  bouge pas. Il n'en donne pas plus que ce toucher-là, qui était justement le
  premier geste de qui ne sait pas — les quatre joueurs, au premier tour.
  Mesuré sur les 139 questions jouables de la maquette, dans la bonne époque,
  le milieu rapporte :

  | Sans rien savoir, dans la bonne époque | ★★★ | ★★ | ★ seule | Étoiles en moyenne |
  |---|---|---|---|---|
  | Une année (43 questions) | 21 % | 26 % | 53 % | 1,67 |
  | Une grandeur (96) | 13 % | 28 % | 59 % | 1,53 |

  - C'est la largeur de l'anneau ★★ qui en décide (§ 8, décision 11), pas
    la place du curseur au départ.
  - Le milieu d'une tranche tombe parfois sur une réponse ronde : 20 de 10 à
    30, 200 de 100 à 300 (« les moins de vingt ans » d'Aznavour, la hauteur
    du Sphinx). Le toucher au milieu l'attrapait déjà.
- Il garde sa valeur quand on change d'époque, si elle y tient encore ;
  sinon, il se pose au milieu de la nouvelle.

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
  - **tirés sans regarder où est la réponse** : jamais du même sujet que la
    question (aucun mot de cinq lettres ou plus en commun), jamais la réponse
    elle-même (« 1969 · Le premier pas sur la Lune » pour une question sur la
    Lune), et c'est tout. La deuxième version les tenait à un quart d'époque
    au moins de la réponse, de peur qu'un repère collé à elle la donne : au
    troisième tour, Claire a vu qu'un repère dans la bonne époque disait
    alors où la réponse n'était pas — « avec 1870 sur la piste, la réponse
    était forcément entre 1850 et 1863 » —, et qui visait « comme le repère »
    n'avait jamais ★★★. Tirés sans distance, 44 % des repères de l'époque de
    la réponse tombent à ★★ d'elle ou moins, comme le veut le hasard ; avant,
    aucun.
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
  - Ce qu'elle coûte se dit en une phrase sous les boutons, et ce qu'elle ne
    coûte jamais : « Une aide coûte une étoile, jamais un cœur », puis « Tes
    aides : −1 ★, jamais un cœur » — Claire et Samir ne l'apprenaient qu'à la
    révélation. La phrase était plus longue avant l'épure du matin (§ 3.1). Le filet barre l'étoile payée avant le
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
  | Tiennent dans la tranche de la réponse | 51 | 110 |
  | À cheval, la réponse contre une frontière (330 ml, 1926) — gardés | 85 | 25 |
  | Donnent la valeur, ou affirment un fait faux | 0 | 0 |

  - **La cible, précisée : la tranche du jeu, toute la tranche.** Un indice
    qui la recopie (« plus haut que la tour Eiffel, mais loin d'un
    kilomètre » pour 300–1000) fait choisir la bonne ; il ne dit rien de
    plus que ce que vaut le milieu de la tranche (§ 8).
  - **Contre une frontière, on garde l'indice qui enjambe** : un indice tenu
    dans la tranche y serait presque la valeur (« juste après la guerre »
    pour 1946), et la distance paie des deux côtés (§ 3.3) — **sauf s'il
    penche du mauvais côté** : quand le milieu de sa fourchette tombe dans la
    tranche voisine, plus loin que ★★, il coûte le cœur de qui le suit. Quatre
    gardés étaient de ceux-là, dont celui de Samir ; réécrits pour couvrir la
    tranche de la réponse (« entre la crise de 1929 et la fin des années
    quarante » pour 1946).
  - La passe a aussi trouvé une question qui se compte (les chiffres 9 de 1
    à 100), écartée avec les calculs (§ 5.4).
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
- **« La réponse : 1898 »**, en grand, et dessous « tu visais 1840 · 58 ans
  d'écart ».
- **D'où viennent les étoiles, en une ligne** : « ✓ la bonne époque ✗ à 6
  ans près ✗ à 2 ans près », et ce que les aides ont pris. En cinq lignes,
  la révélation débordait d'un petit écran ; la tablée tenait à savoir
  « exactement d'où viennent mes étoiles ».
- **L'anecdote**, toujours : c'est le moment où l'on apprend.
- **Le repère gagné**, s'il y en a un.
- **« Manche suivante »**, juste après ce qu'on lit. Collé au bas de l'écran
  à la deuxième version — sous un repère gagné, il passait sous le pli
  (Claire) —, il couvrait l'écart, les cases et l'anecdote d'un petit écran
  (Huguette, au troisième tour) : rien ne se colle au bas de l'écran.

### 3.9 Ce que voit le téléphone (invariant 1)

- **Avant le verdict, le téléphone ne reçoit jamais** la valeur, ni quelle
  époque est la bonne, ni l'endroit de la réponse dans son époque.
- **Il reçoit les quatre époques**, comme il reçoit les bornes de la piste
  aujourd'hui.
- **Les aides se jouent au serveur** :
  - « Deux époques de moins » renvoie les deux époques retirées, choisies au
    serveur ;
  - l'indice ne part qu'une fois pris ;
  - les repères partent avec la manche. Tirés sans regarder la réponse — leur
    époque d'abord, puis un événement de cette époque —, ils n'en disent
    rien, sinon qu'elle n'est pas l'année même de l'un d'eux (§ 3.5).
- **La place de la réponse dans ses quatre époques se tire au serveur**, du
  hasard du serveur, jamais de la graine (`pisteDuFilet` aujourd'hui).

## 4. Le levier le plus fort : des questions que chaque Français sait placer

Le propriétaire, au matin du 9 novembre : « Le levier le plus fort, c'est
d'avoir des questions que chacun connaisse, sachant que la population et la
connaissance sont des personnes françaises. » Les lancers réels lui donnent
raison.

### 4.1 Le classement

Un agent a classé les 591 questions que le panel a notées — les 156 posées
et l'échantillon de 435 du vivier (`maquette-filet/ancrage.json`) — sans
voir ni le panel ni les lancers :

- **Chaque Français la sait placer** : un adulte français pris au hasard — ni
  passionné du sujet, ni joueur de quiz — la place à ★★ (6 ans, 25 %) de
  mémoire, parce qu'il l'a apprise à l'école, la voit tous les jours, ou l'a
  entendue partout ; la limite, environ sept adultes sur dix.
  - Un sujet célèbre ne suffit pas : tout le monde connaît Astérix, personne
    ne sait combien d'albums il compte.
  - Ce qui se calcule ou se définit n'en est pas : ce n'est pas un souvenir
    (§ 5.4).
  - D'où il le sait, pour les 61 retenues : la vie de tous les jours 25
    (« 33 cl imprimé sur chaque canette »), la culture populaire 14, l'école
    12, l'actualité 10.
- **Son ancrage** :
  - un sujet français : l'histoire de France, ses lieux, ses lois, sa vie
    quotidienne, ses personnalités ;
  - un sujet du monde, présent dans la vie des Français : ce qu'on en
    apprend à l'école, les grands événements, Titanic, les Beatles, le corps
    humain, et les détails de spécialiste sur ces sujets ;
  - un sujet de l'étranger, enraciné ailleurs et peu présent ici :
    l'histoire intérieure des États-Unis, les unités anglo-saxonnes, le
    baseball.
- **Une première passe, plus large, sert de contrôle**
  (`reproductions/accord-des-passes.cjs`) : elle retenait 127 questions là
  où la seconde en retient 61, 44 en commun ; les deux s'accordent sur 83 %
  des questions (kappa 0,38), et presque parfaitement sur ce qui est un sujet
  français (159 des 160 de la seconde). La seconde, aux définitions
  serrées, fait foi.

### 4.2 Ce que disent les lancers

Les lancers réels rejugés en deux temps (§ 3.3), sans ce qui se calcule
(`reproductions/filet-en-production.ts ancrage`) :

| Sur 145 lancers | Lancers | « Il savait » (à 2 % près) | Réussis aujourd'hui | Réussies en deux temps | Étoiles par manche |
|---|---|---|---|---|---|
| **Chaque Français la sait placer** | 19 | **42 %** | 63 % | **84 %** | **1,89** |
| Les autres | 126 | 6 % | 34 % | 53 % | 0,94 |
| — un sujet français | 30 | 7 % | 43 % | 60 % | 0,97 |
| — un sujet du monde | 78 | 6 % | 31 % | 51 % | 0,96 |
| — un sujet de l'étranger | 18 | 0 % | 33 % | 50 % | 0,83 |

- **Ce que chaque Français sait se place à 2 % près sept fois plus souvent
  que le reste**, se réussit à 84 % en deux temps, et rapporte près d'une
  étoile de plus par manche.
- **C'est le savoir commun qui compte, plus que le sujet** : parmi le reste,
  un sujet français se place à peine mieux qu'un autre (60 % contre 51 et
  50 %). La durée de la Commune de Paris est au programme ; ses 72 jours,
  personne ne les sait. Écrire des questions sur la France ne suffit pas :
  il faut écrire ce que les Français savent.
- **Il ajoute au panel, qui note pourtant « des joueurs d'une application
  française »** : parmi les questions que le panel donne à 40 % ou plus,
  celles que chaque Français sait placer se réussissent à 82 % (1,76
  étoile, 35 % « il savait »), les autres à 53 % (1,05 étoile, 16 %). Le
  panel lit la difficulté du fait ; il lit mal la culture de ceux qui
  jouent.
- **Il prédit mieux que le panel** qui « savait » : AUC 0,80 seul, contre
  0,78 ; d'abord lui, puis le panel pour départager, 0,82
  (`reproductions/moteur-de-difficulte.ts panel`).
- **La première passe dit la même chose, plus doucement** : avec ses 127
  questions, 21 lancers, 33 % « il savait », 67 % de manches réussies, 1,52
  étoile ; avec les 44 que les deux retiennent, 79 % et 1,71. Plus la règle
  est stricte, plus l'écart est grand — et moins il y a de questions.
- De petits nombres : 19 lancers pour le premier groupe. Le sens ne bouge
  pas d'une passe à l'autre ; l'ampleur, à remesurer en production.

### 4.3 Ce que le vivier en a

Les 1 798 questions de la base que le Filet peut poser, classées une à une
— les 589 de la passe qui fait foi, puis les autres par sept agents, chacun
à l'aveugle avec dix questions de cette passe glissées dans son lot : il
s'en accorde à 93 % (kappa 0,85) — dans un fichier à part, la base n'en est
pas touchée (`vivier-du-filet.json`, `reproductions/vivier-du-filet.mts`) :

- **150 sont de celles que chaque Français sait placer (8 %)**, 159 se
  calculent ;
- **105 seulement se posent à l'acte I** : le tireur du Filet écarte une
  année sans 46 ans de recul et une grandeur sous dix (`seTendAuFilet`) — et
  avec elles 38 des 76 années que chaque Français sait placer, la moitié
  (1981, 1998, 2002) ;
- 90 valeurs distinctes : le Filet ne pose jamais deux fois la même dans une
  partie, et 1945 revient ;
- d'où chaque Français le sait : la vie de tous les jours 43, l'école 40, la
  culture populaire 35, l'actualité 32 ;
- un sujet français l'est quinze fois sur cent (76 sur 501), un sujet du
  monde six (71 sur 1 112), un sujet de l'étranger deux (3 sur 177).

| Catégorie | Jouables au Filet | Chaque Français | Posables à l'acte I |
|---|---|---|---|
| Culture générale | 233 | 36 | 31 |
| Histoire | 153 | 34 | 26 |
| Musique | 141 | 12 | 9 |
| Autour de la fête | 129 | 12 | 8 |
| Sport | 167 | 9 | 7 |
| Cinéma & séries | 137 | 11 | 6 |
| Sciences | 216 | 10 | 5 |
| Cuisine | 83 | 5 | 5 |
| Géographie | 121 | 6 | 4 |
| Nature | 111 | 3 | 2 |
| Arts & lettres | 112 | 3 | 1 |
| Jeux & pop culture | 187 | 9 | 1 |

- **Le levier le plus fort est aussi le plus mince.** L'acte I d'une étape
  « Filet · Arts & lettres » ou « Filet · Jeux » n'aurait qu'une question ;
  seules la Culture générale et l'Histoire en ont de quoi tenir quelques
  semaines. Les sept catégories du bas n'en ont pas dix.
- La Géographie est le paradoxe : celle de la France est la plus apprise de
  toutes (le mont Blanc, la Loire, les départements), et ses questions
  françaises demandent des détails — l'altitude du puy Mary, du pic du Midi
  de Bigorre, les sommets de plus de 4 000 mètres des Alpes — plutôt que ce
  que tout le monde a appris.
- Même la culture populaire française y est pointue : quatre questions sur
  Kaamelott (les jours de tournage, les épisodes), aucune que chaque
  Français sait placer.
- L'échantillon de 435 questions en annonçait 10 % ± 3 : le compte exact
  tient dans sa marge.
- Au passage, des intitulés qui ne se comprennent pas seuls : écrits dans
  un lot d'univers, ils taisaient la série — « Combien d'épisodes compte la
  saison 4 ? », « Quel âge Merlin prétend-il avoir ? ». Le Filet les pose
  hors de tout contexte : cinq corrigés sous leur identifiant (la série
  nommée, et une anecdote de *Lost* aux dates fausses), parmi les questions
  d'univers du vivier. Et un doublon que le juge des faits ne voit pas :
  `k9n359l1` et `i3uqyd02` posent le même code de 108 minutes, sous deux
  entités écrites autrement (« Le Cygne », « Station Cygne »).

### 4.4 Ce qu'il faut en faire

1. **Le tirage** : l'acte I pose ce que chaque Français sait placer, ou ce
   que le panel donne à 50 % et plus — la règle seule visait trop haut
   (§ 4.5) ; l'acte II, le reste que le panel donne à 25 % ou plus ;
   l'acte III, les loteries, où tombent les deux tiers des sujets de
   l'étranger (41 sur 64). La maquette tire déjà ainsi : 24 questions à
   l'acte I, 50 au II, 64 au III.
2. **Le panel le marque en notant** : deux cases de plus à sa consigne —
   « chaque Français la place à ★★, de mémoire », « son sujet : français, du
   monde, de l'étranger » —, à la passe sur la base (§ 5.6) et à l'écriture
   de chaque question.
3. **Écrire ce que chaque Français sait, d'abord là où il en manque** — une
   cinquantaine de questions par catégorie, une centaine dans les plus
   minces (le Sport, la Nature, la Géographie, la Cuisine), par
   `redacteur-campagne`, la règle dans la consigne de son lot, le panel
   notant à l'écriture et le classement relu par un second agent. Le savoir
   commun d'un Français vient de quatre sources :

   | D'où il le sait | Ce qui s'y écrit |
   |---|---|
   | L'école | les dates du programme d'histoire (la Bastille, l'armistice, la Ve République) ; la géographie de la France (le mont Blanc, la Loire, les départements) |
   | La vie de tous les jours | la plaquette de beurre, le thermostat 6, la vitesse sur autoroute, les 35 heures, la durée d'un match |
   | L'actualité vécue | la Coupe du monde de 1998, l'euro dans les poches, l'incendie de Notre-Dame |
   | La culture populaire | les films et les chansons que tout le monde a vus ou chantés, le Tour de France, les jeux de société |

   - **C'est le fait qui doit être connu, pas son sujet** (§ 5.2) : la
     Commune de Paris est au programme, sa durée non.
   - **Une question de l'étranger a souvent un jumeau français** : la
     statue de la Liberté a la tour Eiffel, le mah-jong le tarot, le mile le
     marathon. Le jumeau va à l'acte I ; l'original reste à l'acte III.
4. **Les indices et les repères parlent français, eux aussi** : les repères
   sont des dates de l'école et de l'actualité françaises (Marignan, la
   Bastille, les congés payés, 1998) ; un indice s'oriente par ce que tout
   Français connaît (« au temps du disco », « quand l'euro arrive dans les
   poches »), jamais par une référence d'ailleurs.

### 4.5 Le pilote : écrire ce que chaque Français sait

Avant tout lot en nombre, le propriétaire a voulu un essai : trente questions
à nombre, jouables au Filet, écrites par la chaîne de la base (la skill
`base-campagne` : la consigne `--nombres` et une section « ce lot en
particulier », le rédacteur, le vérificateur, la relecture des faits),
rangées sur la branche, sans déploiement — la géographie d'abord, ce que
chaque Français sait ; puis le sport, ce qu'il sait estimer (ce qu'il a eu
en main, ou vu cent fois sur un terrain). Le relevé de chaque question et de
ses deux jugements : `reproductions/pilote-du-filet.json`.

| Les faits que les rédacteurs ont essayés | Géographie | Sport |
|---|---|---|
| Déjà dans la base — la tour Eiffel, le puy de Dôme, l'Everest ; le filet de tennis, le panier à 3,05 m, le but de 7,32 m… | 13 | 12 |
| Pas assez connus, ou pas assez estimables — la Garonne, le Nil ; l'écart des haies du 110 m… | 12 | 8 |
| Un chiffre pas assez sûr — le Rhône, le mont Blanc remesuré ; le poids d'un ballon de rugby… | 12 | 7 |
| Écrits | 10 | 10 |
| **Sur** | **47** | **37** |

- **Écrits, relus, rangés : 10 questions**, toutes jouables au Filet — la
  Loire, quatre distances depuis Paris, la tour de Pise, les tours de
  Notre-Dame, le dôme du Sacré-Cœur, le pas de Calais, le mont Ventoux
  (`server/content/campagne/geographie.json` : 27 414 questions). La
  relecture n'en a retiré aucune et corrigé une anecdote fausse : la Loire
  « jamais endiguée » a ses levées et ses barrages.
- **Puis le juge à l'aveugle, à la règle stricte : une seule des dix est de
  celles que chaque Français sait placer** — la Loire, « ses 1 000 km
  s'apprennent à l'école ». Les distances « s'estiment plus qu'elles ne se
  savent » ; les monuments sont célèbres, pas leur hauteur.
- **Le sport, ensuite : 9 questions rangées** sur 10 écrites (27 423
  questions) — la relecture a retiré la longueur d'un terrain de football :
  les lois du jeu en laissent une fourchette, de 90 à 120 m, et 105 m n'est
  qu'une recommandation. Les rédacteurs se sont repliés sur les cotes
  réglementaires — le rond central, la ligne de service, la poutre —,
  justes, mais que personne n'estime.
- **Un second juge à l'aveugle, sur les vingt** : rien que chaque Français
  sache — il refuse même la Loire, que le premier gardait : au seuil de sept
  adultes sur dix, deux juges divergent sur les cas limites — et trois que
  chaque Français sait estimer, sur les dix-neuf rangées : Paris–Marseille,
  Paris–Bordeaux (« la route des vacances par l'A10 »), la largeur d'un bassin
  olympique (« deux fois plus long que large »).

Ce qu'on en tire :

1. **Les faits que tout le monde connaît sont déjà dans la base**, ou
   presque : 25 des 84 faits essayés y étaient, et la consigne en écartait
   d'autres d'emblée. Écrire en nombre ce que chaque Français sait ou estime,
   à la règle stricte, rendrait peu : quatre questions au plus pour 84 faits
   essayés, une sur vingt.
2. **Savoir n'est pas savoir placer.** Paris–Marseille fait 775 km par la
   route : dans le filet ★★ des 660 km à vol d'oiseau (de 495 à 825), où
   tombe qui l'a faite en voiture sans la savoir. La règle stricte (« de
   mémoire ») mesure le savoir ; le Filet paie le placement. Un second
   critère — ce que chaque Français sait **estimer**, par ce qu'il vit :
   les distances, les durées, les tailles du quotidien — serait le vrai
   gisement à écrire. Un juge à l'aveugle l'a cherché parmi les 156
   questions posées (`reproductions/estime-des-posees.json`), et les lancers
   réels rejugés (`filet-en-production.ts estime`) vont dans son sens, sur
   trop peu de lancers pour conclure :

   | Sur 145 lancers | Lancers | « Il savait » | Réussies en deux temps | Étoiles par manche |
   |---|---|---|---|---|
   | Chaque Français la sait placer | 19 | 42 % | 84 % | 1,89 |
   | Il la sait estimer, sans la savoir | 6 | 17 % | 67 % | 1,50 |
   | Ni l'un ni l'autre | 120 | 5 % | 53 % | 0,92 |

   Les questions posées sont presque toutes sues, ou hors de portée : il en
   faut de cette sorte dans le jeu pour trancher. Le pilote en apporte —
   les distances et les hauteurs de la géographie, puis le Sport — et se
   mesure en production avant d'écrire en nombre.
3. **Deux règles écartent des faits parfaits pour le Filet** :
   - la base refuse une mesure refaite (le mont Blanc, de 4 808 à 4 805 m)
     — juste pour un QCM au mètre près, sans effet à 6 % près ;
   - le Filet ne pose une année qu'avec 46 ans de recul (`seTendAuFilet`) :
     208 des 702 années de son vivier, après 1980, ne se posent jamais — et
     avec elles ce que les Français ont vécu (1981, 1998, 2002) : 38 des 76
     années que chaque Français sait placer, la moitié (§ 4.3). Le nouveau Filet
     pourrait les poser par une dernière époque qui finit aujourd'hui, au prix
     d'une place moins secrète : les quatre époques ne passent jamais dans
     l'avenir, et une réponse récente ne peut tomber que dans les dernières.
     Le compromis est chiffré à la décision 10 (§ 8).
4. **Où chercher alors, plutôt qu'écrire** :
   - **la sévérité de la règle est un réglage** : stricte, l'acte I se
     réussit à 84 % sur les lancers réels, au-dessus des 65 à 80 % que
     visent les jeux qui règlent leur difficulté, et ne garde qu'une
     question posable sur douze. Chaque règle candidate, rejouée sur les
     lancers et comptée dans l'échantillon du vivier
     (`reproductions/filet-en-production.ts severite`) :

     | L'acte I | Lancers | Réussies en deux temps | Étoiles par manche | Questions posables au vivier |
     |---|---|---|---|---|
     | Chaque Français la sait placer — la règle stricte | 19 | 84 % | 1,89 | ~114 |
     | **… ou le panel à 50 % et plus** | 25 | **76 %** | 1,80 | **~317** |
     | … ou le panel à 60 % et plus | 20 | 85 % | 1,95 | ~220 |
     | … ou la première passe, plus large, et le panel à 40 % | 24 | 79 % | 1,83 | ~237 |
     | La première passe, seule | 21 | 67 % | 1,52 | ~258 |

     **La stricte, complétée du panel à 50 %, tombe sur les trois manches
     sur quatre et triple l'acte I** : les deux signaux sont ceux que la
     passe du panel donnera en production (§ 5.6). Calée sur 25 lancers : à
     revérifier à blanc, avec les autres notes du moteur.

     Les comptes de ce tableau viennent d'un échantillon. **Le panel passé
     sur tout le vivier**, le soir du 9 novembre (§ 5.5), donne le compte
     exact, au nouveau Filet — sans ce qui se calcule, une année avec 25 ans
     de recul : **264 questions à l'acte I**, dont 121 que chaque Français
     sait placer et 143 que le panel donne à 50 % et plus, pour 174 valeurs
     distinctes — 277 et 178 avec les questions neuves du soir (§ 4.6) ;
   - **le recul des années** : 25 ans au lieu de 46 rendent 16 années que
     chaque Français sait placer (décision 10) ;
   - **les dix-neuf questions du pilote, en production** : leurs lancers
     diront si ce qui s'estime se place, mieux que six lancers d'aujourd'hui.

### 4.6 Des questions neuves pour l'acte I

Le tracé de la carte (§ 6) ne promet le Filet à l'acte I que dans une
catégorie qui y a douze valeurs distinctes. Au contenu du 9 novembre, quatre
n'y arrivaient pas : la Nature (2), la Cuisine (4), les Arts & lettres (6)
et la Géographie (7). Le soir même, la chaîne de la base y a écrit ce que la
plupart des Français placent, à la lettre du § 4.4 : des années de l'école
et de l'actualité, des grandeurs du quotidien. Chaque lot avait la consigne
`--nombres` et une section « ce lot en particulier », qui renversait ce
qu'elle dit du savoir commun. Il est passé par le vérificateur, la relecture
des faits et le rangement (`server/test/campagne-base.test.ts` : 27 544
questions). Puis le classement à l'aveugle et le panel l'ont noté comme le
reste du vivier : une troisième passe, et une quatrième pour un second lot de
géographie, chacune recalée sur vingt étalons de la première
(`reproductions/panel-du-vivier.mts`).

| | Nature | Cuisine | Arts & lettres | Géographie |
|---|---|---|---|---|
| Écrites et acceptées par le vérificateur | 40 | 40 | 30 | 30, puis 12 |
| Redites qu'il ne voyait pas — remplacées, sauf en cuisine | 4 | 8 | 12 | 13 |
| Retirées pour un gabarit répété | — | 8 | 7 | — |
| Retirées à la relecture des faits | 1 | 2 | 4 | — |
| Rangées | 39 | 22 | 19 | 30, puis 11 (l'équateur aux Sciences) |
| À l'acte I | 0 | 3 | 0 | 7, puis 3 |
| Valeurs distinctes à l'acte I | 2 → 2 | 4 → 7 | 6 → 6 | 7 → **14** |

- **La Géographie entre à l'acte I**, qui a désormais neuf catégories. Ce
  qui y entre : les indépendances que l'école raconte — la Tunisie, le
  Maroc, Madagascar, la Guinée et son « non » —, les changements du monde
  vécus par l'actualité — le Viêt Nam réunifié, le drapeau de l'Afrique du
  Sud en 1994, la Slovénie et la Croatie —, l'Everest, les 96 départements
  de la métropole. Le premier lot lui laissait une valeur de moins que le
  seuil ; le second, court, a été écrit avec la liste des valeurs que l'acte
  avait déjà, puisqu'une valeur posée deux fois ne compte qu'une.
- **La Cuisine gagne trois valeurs, pas assez** : ce qu'on lit sur
  l'emballage — le pot de yaourt de 125 g, les 2 000 kcal des étiquettes —
  et l'embargo de la vache folle. Ses formats connus de tous sont déjà dans
  la base (la plaquette de beurre, la canette), et ses dates de marques ne
  passent pas 40 au panel.
- **La Nature et les Arts & lettres n'ont presque plus rien à écrire pour
  l'acte I.** Leurs dates connues de tous sont dans la base, ou trop
  récentes pour le recul de 25 ans : l'accord de Paris (2015) et le Grenelle
  de l'environnement (2007), notés 85 et 72 par le panel, ne se poseront
  qu'en 2040 et 2032. Leurs rédacteurs se sont repliés sur ce que personne
  ne place, la création des parcs nationaux, la mort des écrivains : aucune
  de leurs 58 questions ne passe 45 au panel. Pour elles, c'est le tracé qui
  répond — la carte ne leur promet pas l'acte I —, et leurs questions vont
  aux actes II et III.
- **Les faits connus de tous sont dans la base, et souvent sous l'autre
  face** : la date d'une œuvre est écrite dans l'intitulé qui demande son
  auteur (« Quel peintre a représenté la révolution de Juillet 1830 dans La
  Liberté guidant le peuple ? »). Le vérificateur ne voit pas ces redites
  pour une réponse chiffrée (`memeFait`) : 37 des 140 premières questions en
  étaient, rattrapées par un contrôle à part (la règle `campagne-base.md`).
- **Un appel au panel, une dérive** : sur ses étalons, la troisième passe
  note comme la première (38,5 contre 40,6, corrélation 0,92), la
  quatrième plus bas (34,2, corrélation 0,93) ; recalée, chacune classe 14
  étalons sur 20 au même acte que la première — le bruit déjà mesuré au
  § 5.5. Le classement à l'aveugle s'accorde avec la passe qui fait foi sur
  9 de ses 10 étalons, aux deux lots, et ajoute cinq questions que chaque
  Français sait placer : l'Everest, le pot de yaourt, les 2 000 kcal, la
  vache folle et les 96 départements.
- **Leurs indices**, par la chaîne des vagues (`reproductions/indices/`) :
  120 écrits par trois rédacteurs, acte par acte, puis mêlés pour deux juges
  à l'aveugle, qui les ont tous gardés (119 mènent à toute la tranche, un
  un peu large). Le contenu du Filet (`server/content/cabinet/filet.json`)
  en est refait : 1 761 questions, 1 575 indices.

## 5. Le moteur de difficulté

### 5.1 Ce qu'il fait

Il donne, pour chaque question et **chaque jeu qui la pose**, une
connaissabilité : la part des joueurs qui la réussiraient.

- Au Filet : la part qui placeraient la valeur à 5 % près.
- En QCM : la part qui la trouveraient parmi quatre.

Et, pour un joueur donné, sa chance (§ 5.4).

La même question n'a pas la même difficulté selon le jeu. « Combien de cm²
dans un m² ? » se trouve parmi quatre réponses par élimination ; sur une
piste, sans réponse proposée, il faut le savoir. Un sujet obscur coûte peu en
QCM et tout au Filet, au Mot ou aux Indices.

### 5.2 Deux notes qui se corrigent l'une l'autre

**La note a priori**, avant toute réponse : l'avis d'un panel d'IA, question
par question et jeu par jeu.

- La consigne, par jeu (celle du Filet) : « la part des joueurs adultes d'une
  application de quiz grand public française qui placeraient la valeur à
  ±5 % près, sans choix » ; celle du QCM, « parmi quatre ».
- Validée sur la production (`reproductions/moteur-de-difficulte.ts panel`,
  relancé le 9 novembre au matin) :

  | Ce qu'il fallait prédire | Difficulté écrite | Panel de l'IA |
  |---|---|---|
  | Au Filet, « il savait » (à 2 % près), 146 lancers | AUC 0,73 | **AUC 0,78** |
  | Au Filet, « à 9 % près » | AUC 0,50 | **AUC 0,62** |
  | En QCM, la réussite corrigée de la force des joueurs (393 questions, 1 855 premières réponses) | rang 0,47 | **rang 0,61** |

- Quand l'IA annonce qu'au moins un joueur sur deux placerait la valeur,
  37 % savaient vraiment ; sous 25 %, 3 %.
- **Sans ce qui se calcule.** La première mesure comptait les 18 lancers des
  questions qui se calculent (« les grammes d'un kilogramme ») : tout le
  monde les « sait », le panel les notait haut, et elles le flattaient —
  AUC 0,85 au lieu de 0,78, 57 % de « il savait » au-dessus de 50 % au lieu
  de 37. Le nouveau Filet ne les pose pas (§ 5.4) : ce cahier les écarte de
  toutes ses mesures du tirage.
- **Un critère fait mieux que le panel** : « chaque Français la sait
  placer », seul, prédit « il savait » à AUC 0,80 ; d'abord lui, puis le
  panel, 0,82 (§ 4).
- **Elle se recale** : elle prédit 74 % de réussite moyenne en QCM, les
  joueurs en font 67 % — un décalage d'ensemble, appris une fois par famille.
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

### 5.3 Les critères, en résumé

| Critère | D'où il vient | Ce qu'il pèse |
|---|---|---|
| L'avis du panel de l'IA, par jeu | une passe d'agents sur la base, puis à l'écriture de chaque question | le plus fort |
| Les réponses de chaque question, par jeu | le journal des réponses | prend le dessus avec les réponses |
| La force du joueur dans la catégorie | le modèle du savoir (`core/modeleDuSavoir.ts`) | sa chance à lui |
| La difficulté écrite | `meta.difficulte` | l'ancien départ, gardé comme repli |
| La forme (année, nombre, mot), l'âge minimum | la base | un ajustement |

### 5.4 Ce qu'il permet

- **Viser une chance plutôt qu'une marche.**
  - Le tirage d'une épreuve vise une réussite par acte : l'acte I autour de
    trois manches sur quatre, l'acte II deux sur trois, l'acte III une sur
    deux.
  - En première version :
    - l'acte I tire au Filet ce que chaque Français sait placer, ou ce que le
      panel donne à 50 % et plus (§ 4.5) ;
    - l'acte II, le reste que le panel donne à 25 % ou plus ;
    - l'acte III, les loteries.
  - Le vivier de la maquette — les questions réellement posées, les calculs
    écartés — s'y répartit en 24, 50 et 64. Par la seule note du panel (40 %
    et 25 %), il se répartissait en 35, 40 et 64 ; mais celles qu'il donne à
    40 % ou plus sans que chaque Français les sache placer se réussissent à
    53 %, loin des trois manches sur quatre (§ 4.2).
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

### 5.5 Le vivier du Filet, vu par le moteur — et ce qu'il faut écrire

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
  - Il faut écrire là ce que chaque Français sait placer (§ 4.4) : des
    hauteurs, des distances, des durées et des dates de l'école, du
    quotidien et de l'actualité, notées par le panel à l'écriture, une
    centaine par catégorie faible.
  - C'est la réponse à la question du volume : pas plus de questions en
    général, mais des questions **connaissables au Filet** là où il en
    manque.

**Le vivier entier, le soir du 9 novembre.** Le panel a noté les 1 194
questions qui n'avaient pas de note, en huit lots de 159 ou 160, d'un agent
chacun, la consigne de la première passe mot pour mot ; chaque lot portait
dix étalons de la première passe — 80 en tout — pour mesurer sa dérive
(`panel-du-vivier.json`, `reproductions/panel-du-vivier.mts`) :

- **la seconde passe note plus haut** : 39,9 en moyenne sur les étalons
  contre 36,9, et sept points de plus autour de 50, là où se joue l'acte I.
  Elle se recale sur la première par les seuls étalons — même moyenne, même
  dispersion — avant de servir : c'est la première que les vrais lancers ont
  validée (§ 5.2). Sans recalage, l'acte I aurait pris 29 questions de plus ;
- **le même panel, deux fois, classe 70 % des étalons au même acte**
  (corrélation 0,84) : une note seule est bruitée, et ce sont les lancers qui
  la corrigeront, question par question (§ 5.6) ;
- **ce que chaque acte en tire**, au nouveau Filet — sans ce qui se
  calcule, une année avec 25 ans de recul (`seTendEnDeuxTemps`) :

  | Acte | Questions | Années | Grandeurs | Valeurs distinctes |
  |---|---|---|---|---|
  | I — chaque Français, ou le panel à 50 % et plus | 264 | 167 | 97 | 174 |
  | II — le panel de 25 à 49 % | 422 | 225 | 197 | 317 |
  | III — le panel sous 25 % | 803 | 217 | 586 | 692 |

  Les 1 489 questions posables se partagent mal : l'acte I n'a que 2
  questions en Nature, 5 en Cuisine, 6 en Arts & lettres et 7 en
  Géographie, quand la Culture générale en a 51 et l'Histoire 50. Le tracé
  de la carte ne peut y proposer le Filet à l'acte I (§ 6), et c'est là
  qu'écrire paiera (§ 4.4). Écrit le soir même, cela a payé pour la
  Géographie, à peine pour la Cuisine, pas du tout pour la Nature et les
  Arts & lettres (§ 4.6).

### 5.6 Le mettre en service

- **La passe sur la base** : les agents notent les 27 404 questions, par lots,
  sur l'abonnement, comme la génération de la base (`generer-campagne.ts`).
  - Le panel de cette nuit a noté 518 questions en six lots de 87, d'un
    agent chacun ; celui du soir, les 1 194 autres questions du vivier
    (§ 5.5). Le vivier du Filet est noté en entier.
  - Les questions neuves sont notées à l'écriture (`redacteur-campagne`), et
    celles de la routine du matin à leur dépôt.
- **À blanc d'abord**, comme Duolingo :
  - une semaine où le moteur note ses prédictions sans servir ;
  - puis il se compare aux lancers (AUC, rang), et seulement alors il tire.

## 6. L'intégration dans FiestApp

Tout se lit dans la règle du Cabinet (`.claude/rules/cabinet.md`) ; voici ce
que chaque morceau devient.

| Morceau | Ce qui change |
|---|---|
| `shared/cabinet/bareme.ts` | Les chiffres neufs, chacun sa ligne dans `baremes.md` (`documentation.test.ts`, `cabinet-catalogue.test.ts`) : les époques (`EPOQUES_DU_FILET` : 25, 50, 100 et leurs seuils), les anneaux (un douzième, un quart ; 6 % et 25 % de la réponse, l'écart lu au dixième), la suite des ordres de grandeur, les crans d'une tranche (deux cents au plus, ronds, un au moins pour une réponse entière), `AIDES_PAR_MANCHE` (2), ce qu'une aide payée retire (une étoile). `LARGEURS_DU_FILET`, `ETOILES_DU_FILET`, `POSITION_DE_LA_REPONSE`, `PISTE_DES_ANNEES`, `ZONE_DU_FILET` restent, pour les parties d'avant. |
| `shared/cabinet/jeux/filetEnDeuxTemps.ts` — **écrit le 9 novembre** (le lot 1, `server/test/cabinet-filet-en-deux-temps.test.ts`) | La règle pure, à côté de celle d'avant (`filet.ts`) : le tirage (`FiletEnDeuxTempsTire` : la question, la valeur, les quatre tranches et leurs crans, la ou les bonnes, les anneaux, les deux époques que l'aide retirerait, les repères, l'indice, le prix d'une aide — tout figé au départ), l'état (les aides prises, payées ou offertes ; l'époque touchée et le curseur, la page les tient), les gestes (`repondre` : l'époque et le curseur ; `aide` : sa clé), le jugement à la distance (§ 3.3, l'écart d'une grandeur lu au dixième, `ecartEnPourCent`), Éclairer qui offre une aide, ce qu'on montre et ce qu'on révèle (§ 3.9), la pièce (`composee` : « 1962\|1\|eI », le curseur, l'époque, les aides — minuscule payée, capitale offerte), le cartel ; et ce que le tireur appelle : les places possibles, les poids des places par acte (`poidsDesPlaces`), le tirage d'une place, les repères (`reperesDuFilet`), le tirage entier (`tirageEnDeuxTemps`). Une aide payée laisse `payees` au verdict : réussie à zéro étoile, la manche n'est pas ratée. |
| La version du départ — **aucune** | Le cahier proposait une version 4 (`VERSIONS_DU_DEPART`) : le pli aurait choisi la règle par `d.v`. Le code préfère figer dans le tirage ce que le pli juge (la règle du Cabinet, comme `EpingleTiree.decalage`) : le tirage du nouveau Filet porte `deuxTemps`, ses tranches, ses anneaux et le prix d'une aide, et le registre choisit la règle par lui. Une partie commencée se juge comme elle a été tirée, un chiffre changé ne vaut que pour les parties qui commencent, et le Filet d'avant juge les parties d'avant — un tirage sans `deuxTemps`. **Branché le soir du 9 novembre** (le lot 2) : le registre (`filets.ts`), la relecture du départ et des gestes (`lecture.ts` : le lancer `{ epoque, x }`, l'aide `{ quoi: 'aide', aide }`), le pli, la vue — éprouvés par les routes, un plan récrit à la main en base (`cabinet-secret.test.ts`). Le tireur pose le nouveau depuis le lot 3 (`FILET_EN_DEUX_TEMPS`, plus bas). |
| La traversée — **écrit le 9 novembre** (le lot 2) | Une aide coûte une étoile, jamais un cœur : la manche conclue dit ce que ses aides ont pris (`MancheConclue.payees`, d'une seule copie, `mancheConclue`), et `consequencesDe` ne prend ni cœur ni or à une manche réussie que ses aides ont laissée à zéro — ni la Cagnotte : l'aide a pris ce que la manche rapportait. |
| Le tireur — **écrit le 9 novembre** (le lot 3) | `server/src/core/cabinet/tirages/filetEnDeuxTemps.ts`, que `filet.ts` appelle quand le serveur tire en deux temps (`ctx.filetEnDeuxTemps`) : le tirage par acte au lieu des marches — l'acte I parmi ce que chaque Français sait placer ou que le panel donne à 50 % et plus (§ 4, § 5.5), l'acte II de 25 à 49, l'acte III sous 25 (`acteDuFilet`, `PANEL_DE_L_ACTE_I`, `PANEL_DE_L_ACTE_II`) —, l'acte lu de l'étape (`ctx.vise.acte`, `acteDe`), l'acte I hors d'une traversée ; rien à l'acte promis, les autres. Les époques, la place de la réponse — ses poids par acte, lus dans les tas des valeurs, jamais la base entière —, les deux époques que l'aide retire et les repères se figent dans le tirage, du hasard du serveur ; jamais deux fois la même valeur dans une partie. Éprouvé sur de vraies questions du contenu (`vraiesQuestionsDuFilet`), par le pli et par les routes, une épreuve de l'acte II comprise (`cabinet-filet-en-deux-temps.test.ts`). |
| Le drapeau — **écrit le 9 novembre** (le lot 3) | `FILET_EN_DEUX_TEMPS` (`shared/cabinet/ouverture.ts`), oui : le serveur tire le nouveau Filet, l'annonce dit son barème (`JEUX.filet`). Une constante du code, la même en préproduction et en production, puisque la page la lit pour l'annonce ; l'option `filetEnDeuxTemps` du serveur la passe outre, et le banc d'essai garde le Filet d'avant à ses tests. **Fusionner la branche, c'est livrer le nouveau Filet** : en préproduction d'emblée, en production au déploiement suivant. |
| Le tracé de la carte (`tracerLaCarte`, `shared/cabinet/traversee.ts`) — **écrit le 9 novembre** | Une épreuve du Filet ne promet qu'une catégorie où son acte a de quoi tirer : au moins douze valeurs distinctes posables à l'année du départ (`VALEURS_D_UN_THEME_DU_FILET`, `categoriesDuFilet`). Le serveur les lui donne au départ de la traversée, acte par acte, comme il donne au Quiz ses thèmes (`categoriesDuFiletALAnnee`, `ThemesDuContenu.filet`) ; une carte tracée les garde. Au contenu du 9 novembre, l'acte I perdait la Nature (2 valeurs), la Cuisine (4), les Arts & lettres (6) et la Géographie (7) ; après les questions neuves du soir (§ 4.6), la Géographie y entre (14 valeurs), la Cuisine monte à 7, et l'acte I garde neuf catégories ; les actes II et III les gardent toutes. Sans liste — le Filet d'avant, une base illisible —, la carte est celle d'avant, au même hasard. Le tireur garde son repli : la catégorie promise d'abord, puis une autre de l'acte. |
| Les repères — **écrits le 9 novembre**, les communs (le lot 3) puis les siens | Un fichier de contenu (`server/content/cabinet/reperes.json`, 68 dates et 15 grandeurs, rangé et jugé par `cabinet-contenu.ts`) ; une grandeur ne prend que des repères de son unité (« minutes » et « min » sont la même). **Les siens** : les années qu'il a su placer au nouveau Filet, juste — ★★ au moins — et sans aide, même offerte. Le journal des réponses les tient (`JournalDesReponses.placesAuFiletDe`) : sa lecture prend la pièce composée d'un lancer juste du Filet (« 1962\|1 », ses aides au bout), comparée à la requête qui la lirait dans `journal-des-reponses.test.ts`. Le tireur en pose un au plus, marqué sien (◆, « ton repère » à l'écran), sous l'étiquette que le contenu donne à son fait (`QuestionDuFilet.repere`), sur la frise d'une autre année. Une colonne de plus à la lecture du journal : le premier réveil après la mise en ligne le relit en entier, une fois. |
| Les indices — **les trois actes écrits le 9 novembre** (le lot 3, puis trois vagues) | Dans le contenu du Filet (`server/content/cabinet/filet.json`, une question de la base par ligne : son classement, sa note du panel, son indice, son repère), refait du vivier par `retours/2026-11-09/reproductions/contenu-du-filet.mts` — jamais à la main —, jugé à la lettre par `cabinet-contenu.ts` (`refusDeLIndiceALaLettre` : la borne d'une tranche passe dite comme une borne, « plus de dix secondes », jamais comme une valeur, « environ trois cents mètres » pour 330) et au sens par le juge à l'aveugle (§ 3.7) — un agent de plus dans la chaîne d'écriture, qui n'écrit jamais ce qu'il juge ; une question sans indice ne propose pas l'aide. La chaîne, ses consignes et ses scripts : `retours/2026-11-09/reproductions/indices/` (son `README.md`). Une vague par acte, de huit à douze rédacteurs et de sept à onze juges à l'aveugle ; les 147 indices de la maquette rejugés avec l'acte II, au verdict « étroit » né de lui (§ 3.7 : plus serré que la tranche, son milieu rapporte deux étoiles que celui de la tranche ne rapportait pas) ; 65 indices refusés puis réécrits — 63 gardés au second jugement, 2 devenus « sans indice » —, et celui du haïku, qui invitait à un calcul (« fais l'addition ») que le juge à l'aveugle ne voit pas. Posables en 2026, avec les questions neuves du soir (§ 4.6 : 120 indices de plus, tous gardés par les juges à l'aveugle) : 255 des 277 questions de l'acte I ont leur indice, 453 des 462 de l'acte II, 867 des 870 de l'acte III — 1 575 indices, et 34 questions sans indice honnête : l'énoncé donne déjà l'époque ou la tranche (le Lusitania, Bill Russell et ses treize saisons), ou le seul repère mène droit à la valeur (Jeanne Calment, où « un siècle » tombe trop près de ses 122 ans). |
| Les pouvoirs (`shared/cabinet/pouvoirs.ts`) | Éclairer, au Filet, devient la première aide offerte ; Changer et le temps en plus restent. `refusDuPouvoir` dit pourquoi une aide ne se prend pas (déjà prise, plus de place, la manche tranchée). |
| La page — **écrite le 9 novembre** (le lot 3) | L'écran du § 3.1 et du § 3.8 (`client/src/views/cabinet/jeux/FiletEnDeuxTemps.tsx`), que l'aiguillage des deux Filets choisit par la forme de la manche (`FILETS`, `jeux/Filet.tsx`) : une partie d'avant garde son écran. Ses classes dans la section du Cabinet de `styles.css` — la frise des époques en `cab-epoques` et `cab-tranche`, `.cab-frise` étant la Frise. Aucun texte sous 17 pixels : `cabinet-ecran.test.ts` relit chaque taille — la première maquette en écrivait à 13, « petites et pâles » pour Huguette. Les étoiles se dessinent (`Etoiles` : chaque anneau les siennes, une aide payée en éteint une) ou se disent en mots (« Coûte une étoile », « une étoile en moins »), jamais en signes. Le curseur est celui du Filet d'avant (`.cab-curseur`, un mât) : posé au milieu de l'époque dès qu'elle est touchée, il n'a plus d'état « pas encore touché », et le toucher de sa valeur n'a rien à dire. Rien ne se colle au bas de l'écran : le bouton du lancer y cachait la piste et le gros chiffre (§ 3.1). L'indice pris et ce qui reste après « Deux époques de moins » reçoivent le focus. La note de la manche dit l'aide payée (« −1 : ton aide », `vue.ts`). Éprouvé rendu en HTML sur les vues d'un vrai serveur (`cabinet-ecran-filet.test.ts`). |
| Le moteur | `core/modeleDuSavoir.ts` : une difficulté par question et par jeu, partie de la note a priori ; la note a priori dans la base (`meta.connaissabilite`, par jeu) ou dans une table du Cabinet, avec ses trois cases — « chaque Français la sait placer » et son ancrage (§ 4), « se calcule », qui écarte une question du Filet (§ 5.4) ; les lancers du Filet lus en paliers. |
| Le QG | La page du Cabinet : la réussite de chaque jeu, la part des loteries tirées, la liste des questions à revoir. |
| Le calibrage (`calibrage-cabinet.ts --sections traversee`) — **mesuré le 9 novembre** | Le calibrage joue le Filet que le serveur tire : de vraies questions de son contenu, à l'acte de l'épreuve. Son joueur modèle tient la loi des vrais lancers rejoués en deux temps, acte par acte (`reproductions/filet-en-production.ts actes` : 75, 55 et 54 % de réussies) : il sait l'époque et vise un anneau, ou il ne la sait pas — il la touche alors au hasard, sauf s'il prend l'indice. Le modèle du Filet d'avant n'avait jamais été recalé, et donnait plus que les joueurs : la comparaison se fait au Filet d'avant tel qu'on l'a joué, sur les mêmes lancers (`--filet avant-joue`). À joueurs égaux, le nouveau Filet rend au moyen trois à cinq traversées sur cent (25,6 → 29 à 30,9 %), deux ou trois à l'occasionnel et au fort ; les gardiens ne tombent pas plus vite (1,4, 2,9 et 3,9 assauts au moyen), c'est le cœur que l'aide garde. En partie libre, à l'acte I, il est bien plus généreux que l'ancien joué (une commune 73 fois sur cent au moyen, 29 avant), et rejoint le modèle sur lequel le musée s'est mesuré (67,8). Les chiffres : `docs/reference/baremes.md`, « Le nouveau Filet, au calibrage du 9 novembre 2026 ». Les points de vie des gardiens n'ont pas bougé — le propriétaire, le 9 novembre : « je ne pense pas qu'il faut enlever ou toucher la vie des boss pour le moment ». |

**Les tests**, dans `server/test/` (un comportement neuf arrive avec son
test). Écrits le 9 novembre : la règle pure, le secret de ce qu'elle montre,
les repères et la place de la réponse, le branchement, une partie d'avant
relue à sa règle (`cabinet-filet-en-deux-temps.test.ts`, `cabinet-secret.test.ts`,
`cabinet-traversee.test.ts`) ; puis le contenu et son juge à la lettre
(`cabinet-contenu.test.ts`), le tireur par acte sur de vraies questions, par
le pli et par les routes, et l'écran rendu (`cabinet-ecran-filet.test.ts`).
Puis le calibrage, qui joue le nouveau Filet acte par acte et vérifie que
l'indice pris garde le cœur (`cabinet-calibrage-modele.test.ts`) ; le tracé
— les catégories de chaque acte, et la carte qui ne promet qu'elles — et les
siens parmi les repères, lus du journal des réponses comme la requête les
lirait (`cabinet-filet-en-deux-temps.test.ts`, `journal-des-reponses.test.ts`) ;
enfin le dé de la tablée à l'acte de la question, ses seuils recalculés du
modèle du calibrage (`tablee.test.ts`). La liste d'origine :

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
  réponse en reçoit autant que les autres, à un centième près), et dans
  l'époque de la réponse, aussi près d'elle que le hasard le veut ; jamais du
  même sujet, jamais la réponse elle-même ; un des siens au plus, gagné sans
  aide ;
- le juge des indices, et le tireur qui écarte ce qui se calcule ;
- une partie de la version 3 relue telle qu'elle s'est jouée ;
- le tirage : l'acte I parmi ce que chaque Français sait placer, les autres
  par la connaissabilité ;
- l'écran rendu (`cabinet-ecran-neufs.test.ts`).

## 7. Mesurer après la mise en ligne

Le script `reproductions/filet-en-production.ts` rejoue les mêmes lectures
sur la nouvelle version. Les cibles :

| Mesure | Aujourd'hui | Cible |
|---|---|---|
| Manches du Filet réussies | 43 % | 65 à 80 % à l'acte I, 50 % au moins à l'acte III |
| « Il savait » (à 2 % près) à l'acte I, ce que chaque Français sait placer | — | quatre lancers sur dix, comme rejoué (§ 4.2) |
| Au hasard (la bonne époque) | 45 % | 25 % |
| Ce que le savoir ajoute | −2 points | +25 points au moins |
| Manches à zéro étoile | 59 % | 35 % au plus |
| Le Filet choisi sur la carte | 23 % | 33 % (la part égale) |
| Coups fatals du Filet | 9 sur 21 traversées perdues | sa part des épreuves |
| Le moteur, à blanc | — | AUC ≥ 0,8 sur les lancers neufs |

Avec 11 joueurs, pas de test A/B : un avant-après, par les mêmes scripts. Et
un sondage du QG aux joueurs du Cabinet (`qg_annonce_questions`).

## 8. Les décisions à prendre

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
4. **La passe du panel sur toute la base**, avec ses deux cases neuves
   (chaque Français, l'ancrage), puis le moteur à blanc une semaine.
5. **Les points de vie des gardiens**, à remesurer une fois le Filet changé.
   Le calibrage proposait déjà 11 et 17 aux actes II et III.
6. **Les autres jeux après le Filet** : le Pari d'abord (64 % de manches à
   zéro étoile, 45 cœurs perdus), puis les Indices.
7. **Le levier français** (§ 4) : l'acte I parmi ce que chaque Français sait
   placer — 105 questions posables aujourd'hui, classées une à une — et en
   écrire là où il en manque, notées par le panel à l'écriture. Le pilote
   (§ 4.5) dit comment : à la règle stricte, l'écriture rend peu ; ce que
   chaque Français sait **estimer** — les distances, les durées, les tailles
   du quotidien — est le gisement à mesurer d'abord en production.
   - L'autre voie garde l'acte I à la seule note du panel (40 % ou plus) :
     plus fourni (environ 760 questions), mais ce qu'il y met sans que chaque
     Français le sache se réussit à 53 % (§ 4.2).
   - La sévérité de la règle est un réglage : stricte, l'acte I se réussit à
     84 % (rejoué) et ne garde qu'une question posable sur douze ; complétée
     du panel à 50 % et plus, 76 %, et trois fois plus de questions
     (§ 4.5).
   - La proposition : la stricte complétée du panel à 50 %, revérifiée à
     blanc ; l'écriture, seulement là où la mesure du pilote en production
     dira qu'elle paie.
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
   Miser (Quitte ou double) ; un pari propre au Filet attend (§ 9).
10. **Le recul des années** : 46 ans au Filet (`seTendAuFilet`). Il écarte
    la moitié des années que chaque Français sait placer — 38 sur 76 :
    1981, 1998, 2002 (§ 4.3). Raccourci, il en rend, mais la place de la
    réponse se devine mieux : les quatre époques ne passent jamais dans
    l'avenir, et une réponse récente ne peut tomber que dans les dernières
    (`reproductions/vivier-du-filet.mts`) :

    | Recul | Années posables | Dont chaque Français | « Toujours la dernière époque » gagne |
    |---|---|---|---|
    | 46 ans, aujourd'hui | 494 | 38 | 29 % |
    | 35 ans | 554 | 47 | 31 % |
    | 25 ans | 615 | 54 | 34 % |
    | 20 ans | 638 | 61 | 37 % |

    - Le hasard pur fait 25 % : la fuite existe déjà, petite.
    - **Elle se referme si la place de la réponse se tire avec des poids**,
      pour que chaque place reçoive un quart des réponses — les anciennes
      vont moins souvent dans la dernière, autant que les récentes y vont
      d'office. Simulé sur les années du vivier
      (`reproductions/place-de-la-reponse.mts`) :

      | Recul | La place | « Toujours la dernière » | Le joueur qui lit la frise |
      |---|---|---|---|
      | 46 ans, aujourd'hui | au hasard | 29 % | 47 % |
      | 25 ans | au hasard | 35 % | 45 % |
      | **25 ans** | **avec des poids** | **25 %** | **39 %** |
      | 25 ans | frises équilibrées | 30 % | 33 % |

      « Le joueur qui lit la frise » connaît la répartition des années de la
      base et prend, pour les quatre époques qu'il voit, la plus probable :
      la borne haute de qui joue sans rien savoir de la question. Il trouve
      la bonne époque 47 % du temps aujourd'hui — la fuite n'était pas
      petite : les années de la base se serrent au XXe siècle. Les poids la
      ramènent à 39 %, sous ce qu'elle est aujourd'hui ; équilibrer chaque
      frise, à 33 %, au prix d'une place qui se devine un peu (30 %).
    - **Les poids se calculent par acte**, sur les années qu'il pose.
      L'acte I prend les années que chacun sait placer, et les récentes y
      pèsent bien plus qu'ailleurs : avec les poids de tout le vivier,
      « toujours la dernière » y gagnerait 30 % ; avec les siens, 25 % —
      et le joueur qui lit la frise, 43 % au lieu de 51 aujourd'hui.
      Quand les réponses forcées dépassent le quart, aucun poids ne
      referme tout : la maquette, dont l'acte I a 16 années récentes sur
      23, reste à 35 %. Le tireur garde alors les années récentes sous le
      quart de celles qu'il tire à l'acte.
    - **La proposition : 25 ans de recul, la place tirée avec des poids.**
      Elle rend 16 années que chaque Français sait placer — l'abolition de
      la peine de mort, la chute du mur, la mort de Diana, le premier
      iPod —, et fuit moins qu'aujourd'hui. La maquette la joue : ces seize
      années sont à son acte I, avec leur indice relu à l'aveugle.
11. **La largeur de l'anneau ★★** : un quart d'époque. Dans la bonne époque,
    le milieu sans rien savoir y tombe 52 fois sur cent, et ★★★ 20 fois
    (`reproductions/prix-des-aides.mjs`) — « ★ pour la bonne époque vaut
    plutôt une étoile et demie » (Claire, au second tour). C'est aussi ce qui
    paie l'à-peu-près (Huguette, cinq ans d'écart : ★★). La resserrer à un
    sixième (4 ans) ferait tomber le milieu à 36 % ; un choix de produit, à
    mesurer au calibrage avant d'y toucher. Le curseur s'y pose désormais
    d'office (§ 3.4) : « Lancer » sitôt l'époque choisie rapporte ce que
    rapportait le toucher au milieu, ce qui rend la question visible.
12. **Écartée : une étoile à moins d'une demi-tranche, même dans la tranche
    voisine** — « onze ans ou cent trente-trois, même tarif » (Samir).
    Rejouée sur les lancers réels : 71 % de manches réussies au lieu de 62,
    mais 83 % sur les questions connues, au-delà de la zone visée, et 68 %
    sur les loteries au lieu de 54 (`reproductions/filet-en-production.ts`,
    la ligne « ★ aussi à une demi-tranche »). Trop généreux : ce sont les
    indices recentrés sur leur tranche (§ 3.7) qui répondent au cœur perdu de
    Samir.

## 9. Ce qui attend

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
