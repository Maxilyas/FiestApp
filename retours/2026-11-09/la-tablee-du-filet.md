# La tablée du nouveau Filet — 9 novembre 2026

La maquette du cahier des charges (`le-nouveau-filet.md`, `maquette-filet/`)
jouée par une tablée, cette nuit-là, en deux tours : la première version, puis
la seconde, retouchée d'après le premier tour. Chaque joueur est un agent qui
joue un personnage (la skill `tablee`, ses navigateurs de `npm run tablee`),
au téléphone, sur les vraies questions que la production a posées du 1er au
8 novembre ; il ne sait d'une question que ce qu'un dé lui laisse savoir, au
barème de sa fiche. Le chrono était coupé : chacun dit s'il se serait senti
pressé.

Ce sont des agents, pas des joueurs : leurs notes disent une préférence et
des défauts vus, pas une mesure. Ce que le premier tour a trouvé, la seconde
version l'a corrigé ; ce que le second a trouvé, la maquette l'a corrigé à
son tour, puis la vérification au navigateur (18 manches en 360 × 640, le
toucher du milieu, chaque « + », l'écart et le verdict, le focus de
l'indice, aucun débordement) l'a rejoué.

## Les joueurs

| Joueur | Qui | Ce qu'il regarde |
|---|---|---|
| Huguette, 72 ans | institutrice à la retraite, petit téléphone, texte agrandi à 130 %, lit tout avant de toucher | la taille des textes, les mots qui l'arrêtent, le temps de lire |
| Théo, 16 ans | joue entre deux cours, veut que ça aille vite | ce qui bloque, ce qui ralentit |
| Claire, 39 ans | joue au Cabinet chaque soir, trouve le Filet injuste, calcule tout | la justice, le prix des aides, les failles |
| Samir, 47 ans | comptable, daltonien (deutéranopie) | ce que ses yeux distinguent à la révélation |

## Le premier tour : tous préfèrent le nouveau

Chacun a joué deux épreuves du nouveau Filet et une du Filet d'aujourd'hui.

| | Filet d'aujourd'hui | Nouveau Filet |
|---|---|---|
| Huguette — plaisir, clarté, justice | 2 · 3 · 2 | 4 · 4 · 3 |
| Théo | 3 · 3 · 3 | 4 · 4 · 4 |
| Claire | 3 · 4 · 2 | 4 · 3 · 4 |
| Samir | 3 · 3 · 2 | 4 · 4 · 4 |

- **Le savoir approximatif paie, et ça se sent.** Claire se trompe de 40 %
  sur la chouette au Filet d'aujourd'hui : zéro étoile, un cœur perdu, « et
  l'écran m'apprend que même le grand filet aurait raté ». Au nouveau, la
  même erreur sur le haïku lui laisse ★ et son cœur : « je ne suis plus
  punie d'avoir eu la bonne idée générale ». Samir, 65 degrés pour 60 et 1927
  pour 1930 : ★★ chaque fois, « je préfère être payé pour ma visée que pour
  mon culot ».
- **Le pari du Filet d'aujourd'hui, vécu.** Samir est pile sur 12 aux
  Saisons de Tchaïkovski et repart avec ★★, parce qu'il avait pris le filet
  moyen ; puis, sans rien savoir de l'Opéra Garnier, il laisse le grand
  filet au milieu et gagne ★ — « le coup du grand filet au milieu marche sans
  lire la question ». Huguette, pile sur 1 000 kg : « Tout près », ★★.
- **Les cœurs** : au Filet d'aujourd'hui, Claire et Huguette en perdent un
  chacune ; au nouveau, personne, en huit épreuves.
- **Ce qu'ils aiment** : le pas-à-pas numéroté (« comme une consigne au
  tableau », Huguette), le barème affiché avant de jouer (« pour un
  comptable, c'est le plus important »), la révélation qui dit d'où vient
  chaque étoile, les repères gagnés (« ce que j'ai su me resservira,
  j'adore », Claire), les indices tournés en devinettes.

## Ce que le premier tour a trouvé, et ce que la seconde version en a fait

| Ce qui gênait | Qui | La seconde version |
|---|---|---|
| **Toucher pile au milieu de la piste ne pose rien** — le premier réflexe de qui ne sait pas, et « avec le chrono, on croirait le jeu cassé » | les quatre ; la chose à changer en premier pour trois | Le doigt pose le curseur où il tombe, milieu compris (`pointerdown`) — un curseur natif ne dit rien quand on touche la valeur qu'il garde. Le rendu a trouvé derrière un second piège : le bouton collé en bas recouvrait la piste ; elle vient maintenant au-dessus de lui. 18 manches jouées au navigateur, toucher du milieu compris : aucun raté. |
| **La piste des grandeurs est irrégulière** : le milieu de 300 à 1 000 tombe vers 550, 625 ne se pose pas (624, puis 627), « + » reste coincé à 1380 et à 62 | Claire, Samir, Huguette, Théo | Une piste régulière, en crans ronds (de 5 de 300 à 1 000), graduée ; chaque « + » change la valeur jusqu'au bout. |
| **La manche s'ouvre au milieu de la page**, la question cachée au-dessus ; « Manche suivante » passe sous le pli après un nouveau repère | Huguette (sa chose à changer en premier), Claire | Chaque écran s'ouvre en haut, la question sous les yeux ; « Lancer le filet » et « Manche suivante » se collent au bas de l'écran. |
| **« Ton écart 24 % » sous « À 25 % près : non »**, « 6 % » sous « À 6 % près : non » — « je me suis sentie flouée » | Huguette, Claire | Le jugement lit l'écart en pour cent de la réponse, au dixième, et l'écran écrit ce même nombre (« 6,3 % »). |
| **L'aide abaisse un plafond, et ne coûte rien à qui ne sait rien** : « dès que je sèche, j'en prends une ; avec les deux, je ne perds quasiment jamais de cœur » ; « une étoile retirée de mon score, ou seulement le plafond qui baisse ? » | Claire, Samir, Théo | Une aide payée retire une étoile à ce que la manche rapporte, sans jamais coûter le cœur ; le prix se dit en clair, l'étoile payée paraît barrée. Le calcul (`reproductions/prix-des-aides.mjs`) : sous plafond, les deux aides rapportaient 0,95 étoile pour un cœur perdu une fois sur vingt, contre 0,43 et trois sur quatre sans aide. |
| **Les indices donnent la réponse** : le carré de 25 (« fois cent, puis le quart »), Minecraft (« une puissance de deux entre seize et cent »), « compte les semaines » | Claire, Huguette, Théo | Un juge à l'aveugle a relu chaque indice à la place d'un profane : 42 sur 140 donnaient la valeur ; réécrits en trois passes, aucun (`maquette-filet/juge-des-indices.json`, cahier § 3.7). |
| **L'acte I tourne au cours de maths** : secondes dans une heure, millimètres dans un mètre — « c'est pas fun » | Théo, Claire | Le nouveau Filet écarte ce qui se calcule ou se convertit : 16 questions sur 156. |
| **Les repères restent sur la frise**, jamais sur la piste ouverte ; « 100 ans · Un siècle » pour un âge ; l'Atari « de l'indice » devenu son repère | Samir, Huguette, Théo | Les repères de l'époque ouverte descendent sur la piste ; plus de définition d'unité ; un repère se gagne sans aide. |
| **Les repères ne tombent jamais dans l'époque de la réponse** : « deux repères dans deux époques différentes valent un « Deux époques de moins » gratuit » | Claire | Une vraie fuite : 0,34 repère par manche dans l'époque de la réponse, 0,56 dans chacune des autres. Leur époque se tire d'abord : 0,50 partout (`reproductions/reperes-par-epoque.cjs`). |
| **Quatre ronds de teintes voisines** à la révélation — la réponse, le lancer, un repère, le sien —, et le lancer caché sous la réponse ; deux anneaux qui ne diffèrent que d'un beige | Samir, Claire, Huguette | ▼ la réponse au-dessus de la frise, ▲ le lancer en dessous — ils ne se chevauchent plus —, ○ un repère, ◆ le sien ; « la bonne » et « ton choix » écrits dans l'époque ; le grand anneau en tirets, le petit plein. |
| **« à 25 % », il faut le calculer de tête** ; l'ancien disait « Ton filet : de 131 à 193 degrés » | Claire, Théo | « Ton filet ★★★ de 1960 à 1964 · ★★ de 1956 à 1968 », sous la valeur. |
| **10 000 m² tombe entre deux cases** : « dans quelle case ? » | Huguette | Une réponse pile sur une borne est des deux ordres de grandeur. |
| **Les mots** : « La bonne époque » pour des grammes (« une époque, pour du beurre ? »), « Rejouer l'acte ii », « 1 aide(s) », « 31.8 % », les règles qui coupent « de 3 / 000 », les petites lignes grises | les quatre | « Le bon ordre de grandeur » ; « l'acte II » ; « 2 aides, dont une offerte » ; des virgules ; des espaces insécables ; aucun texte d'une manche sous 17 pixels. |
| **Le Filet d'aujourd'hui de la maquette** : « Tout près » au filet moyen même à 0 % d'écart, des dixièmes de pièce (« 12,2 pièces »), Éclairer sans un mot, « Le grand filet l'aurait prise » en vert quand on avait fait mieux | Samir, Huguette, Claire, Théo | Des défauts de la maquette, pas de la production : elle avait recopié la règle, pas les mots. Elle suit maintenant `Filet.tsx` mot pour mot — « Dans le filet », « Le moyen filet ★★☆ », « Indice : la réponse est entre … et … », un pas d'un pour une réponse entière, « − 12 » et « + 1 500 km » pour les grands pas. |

## Le second tour : « nettement meilleure »

Claire, Huguette et Samir ont rejoué la seconde version — deux épreuves du
nouveau Filet chacun —, après avoir relu leur propre retour du premier tour,
sans lire la page « Ce que la tablée a changé » avant de jouer. Hugo, aveugle,
l'a jouée pour la première fois au lecteur d'écran (la fiche `cabinet-hugo`
de la tablée, qui ne perçoit l'écran que par l'arbre d'accessibilité).

| Nouveau Filet — plaisir, clarté, justice | Premier tour | Second tour |
|---|---|---|
| Huguette | 4 · 4 · 3 | 4 · 4,5 · 4 |
| Claire | 4 · 3 · 4 | 4 · 4 · 4 |
| Samir | 4 · 4 · 4 | 4 · 5 · 4 |
| Hugo, au lecteur d'écran (le Filet d'aujourd'hui : 2 · 3 · 2) | — | 4 · 4 · 4 |

- **Ce qui gênait au premier tour est réglé**, un par un, captures à
  l'appui : le toucher du milieu (« du premier coup », Samir, sur une
  grandeur comme sur une année), la piste régulière, « + » qui répond à
  chaque pression, l'écart qui concorde avec le verdict, les mots, le bilan.
  Samir distingue tout à la révélation — « pour la première fois, je n'ai
  jamais eu à deviner quel signe était quoi » —, y compris une époque
  choisie exprès de travers : « la bonne » et « ton choix » sont écrits dans
  les cases.
- **Les aides ont un vrai prix, et on le comprend sans les règles.** « Une
  étoile retirée de mon score, ou seulement le plafond qui baisse ? » a sa
  réponse à l'écran (Samir) ; Claire a payé deux aides exprès pour voir :
  ★★ gagnées, toutes deux reprises, le cœur gardé. « On peut encore protéger
  ses cœurs, mais plus gratuitement. »
- **Les scores baissent, et c'est voulu.** Huguette fait 6 sur 9 à l'acte
  « Pointu » au lieu d'un 8 flatteur, « ce qui colle mieux à ce que je
  sais » ; Claire 3 sur 9 à l'acte III au lieu de 7 : « les aides ne sont plus
  des étoiles gratuites ».
- **Le savoir approximatif paie, dit à l'oreille.** Hugo, 24 % trop bas sur
  la chouette : « Tout près, 2 étoiles sur 3 » ; la même erreur sur la livre,
  au Filet d'aujourd'hui : « À côté, la manche te coûte un cœur ». « La même
  erreur de 24 % vaut deux étoiles d'un côté et un cœur perdu de l'autre.
  Tout est dit. »

## Ce que le second tour a trouvé, et ce que la maquette en a fait

| Ce qui gênait | Qui | La maquette |
|---|---|---|
| **L'indice passe sous le bouton collé** dès que la piste s'ouvre, au moment même de viser | Samir (sa chose à changer en premier) | L'indice se lit entre l'époque et la piste, là où l'on choisit et où l'on vise, et vient sous les yeux quand on le prend. |
| **Le bouton collé en bas cache le dessous** : les nombres de la piste, le gros chiffre, « Ton écart » — un cinquième d'un petit écran | Huguette, Samir | « Lancer le filet » ne se colle plus ; seul « Manche suivante » le reste, plus mince. |
| **Les indices tombent à cheval sur deux époques** : « dans les vingt ans qui suivent la Libération », 1944–1964, enjambe 1950 — Samir a fait son compte, pris le gros côté, et perdu un cœur | Samir, Hugo | Un juge a relu chaque indice avec la tranche du jeu sous les yeux : 85 sur 136 enjambaient une frontière. Recentrés sur leur tranche, et rejugés sur la tranche et sur la valeur : 106 y tiennent, aucun ne donne la valeur ni n'affirme de fait faux ; 29 restent à cheval parce que la réponse touche une frontière (1946, 330 ml), où un indice dans la tranche serait presque la valeur, et où la distance paie des deux côtés. |
| **Après une aide payée, le filet affiche encore les étoiles d'avant**, et rien ne dit qu'une aide ne coûte jamais le cœur | Claire (sa chose à changer en premier), Samir, Huguette | « Ton filet ★★★ » montre l'étoile payée, barrée ; « Tes aides : −1 ★ sur ce que la manche te rapportera, jamais ton cœur : seule une manche ratée le coûte » ; une aide offerte le dit (« elle ne te coûte rien ») — Huguette croyait avoir payé. |
| **Pas de grand pas** : de 198 anneaux à 100, 98 touchers de « − » | Hugo | Un grand pas vaut une graduation : « − 5 ans », « + 100 g ». |
| **Le curseur annonce un nombre interne** (« 100 » pour 2000 m), le toucher ne lui donne pas le focus, le verdict n'est ni un titre ni un statut, l'indice pris ne s'annonce pas, Éclairer disparaît sous le doigt | Hugo, Claire | Le curseur porte sa vraie valeur et la dit ; le doigt lui donne le focus ; le verdict est le titre de la révélation et reçoit le focus ; l'indice pris le reçoit aussi, et ce qu'Éclairer a donné. |
| **Les cases d'ordre de grandeur débordent** sous un texte agrandi (« à 30 000 » coupé au bord) | Huguette (sa chose à changer en premier) | Une tranche de grandeur s'écrit comme une époque, ses deux bornes sans « à ». |
| **Plus une date connue sur la frise** : ses deux repères à elle prenaient toute la place | Huguette | Un repère à soi au plus par manche. |
| **Les repères gagnés sous la première règle** — avec une aide — restent ; « Brasília » promis et absent ; un ★★ avec une aide offerte sans repère, sans un mot | Claire, Huguette | Les repères d'avant s'effacent ; « Il pourra revenir sur la frise » ; « Trouvée avec une aide : elle ne devient pas ton repère ». |
| **Les traits de la piste n'ont pas de chiffres** ; « − » ne s'éteint pas au bout | Samir, Huguette | Les graduations portent leurs nombres ; « − » et « + » s'éteignent aux bouts. |
| **Petits mots** : « Ton aide a pris l'étoile » quand deux en ont pris deux, « dont 1 offerte » puis « dont une offerte », « 0 cœur perdu », « de 1958 » en fin de ligne | Claire, Samir, Huguette | « Tes aides ont pris tes étoiles » ; « 1 aide offerte », « 2 aides, dont 1 offerte » ; « aucun cœur perdu » ; les fourchettes et les comptes ne se coupent plus. |
| **Un repère pile sur une borne tiré deux fois** (« 30 cm · une règle d'écolier », entre 10–30 et 30–100) | le rendu de la maquette | Il ne se tire qu'une fois. |
| **Une question de comptage** (les chiffres 9 de 1 à 100) | le juge des tranches | Écartée avec les calculs. |

## Ce qui reste ouvert

- **Le milieu de la bonne époque paie bien.** Claire : « dès que j'ai la
  bonne époque, le milieu me donne ★★ à peu près une fois sur deux » — 52 %
  sur une époque de 25 ans, ★★★ 20 % (`reproductions/prix-des-aides.mjs`).
  C'est la largeur de l'anneau ★★ (un quart d'époque) qui le veut, et c'est
  elle qui paie l'à-peu-près d'Huguette (« je me suis trompée de cinq ans, et
  les deux étoiles, je les ai gagnées »). La resserrer serait un choix de
  produit, à mesurer au calibrage (cahier, § 7).
- **« Onze ans ou cent trente-trois, même tarif »** (Samir, 11 ans d'écart
  dans l'époque voisine : zéro, comme 133). Une étoile à moins d'une
  demi-tranche a été mesurée sur les lancers réels, puis écartée : 71 % de
  manches réussies au lieu de 62, mais 83 % sur les questions connues —
  au-delà de la zone visée — et 68 % sur les loteries au lieu de 54
  (`reproductions/filet-en-production.ts`, la ligne « ★ aussi à une
  demi-tranche »). Les indices recentrés sur leur tranche répondent mieux au
  cœur perdu de Samir.
- **Le chrono.** Deux gestes, et un indice à lire : 45 secondes suffisent à
  Claire, pas à Huguette ; Hugo, au lecteur d'écran, les dépasse à chaque
  manche. À mesurer en production (cahier, § 7).
- **Le pari perdu.** « Il n'y a toujours rien à parier » (Claire). Le frisson
  reste celui de la carte Miser ; un pari propre au Filet attend (cahier,
  § 8).
- **Ce que la frise laisse deviner** : une croyance plus petite que la plus
  petite tranche tombe d'office dans la bonne quand elle est au bord
  (Huguette, la canette) ; « Deux ordres de moins » laisse parfois une case
  absurde (« 1 000 à 3 000 chapitres pour un roman », Claire ; « 3 000 à
  10 000 degrés » pour une chouette, Samir). La piste d'aujourd'hui a la même
  limite : ses bornes contiennent toujours la réponse.
- **Deux anecdotes de la base à reprendre** — elles ne sont pas de la
  maquette : le girafon « naît debout et chute de près de deux mètres, puis
  se lève » (« s'il naît debout, pourquoi se lever ? », Huguette) ; « Vue
  d'avion, Brasília a la forme d'un avion ».
