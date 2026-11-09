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
version l'a corrigé ; ce que le second a trouvé, la section du second tour le
dit.

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

## Ce qui reste ouvert

- **Le pari perdu.** « Ici le filet se resserre tout seul : il n'y a plus de
  risque à prendre » (Claire, qui aimait le frisson du petit filet). Le
  frisson reste celui de la carte Miser ; un pari propre au Filet attend
  (cahier, § 8).
- **Le chrono.** Deux gestes au lieu d'un, et un indice à lire : 45 secondes
  suffisent à Claire, pas à Huguette. À mesurer en production avant d'y
  toucher (cahier, § 7).
- **L'acte III généreux ?** Claire y fait 7 sur 9 en ne sachant que une
  question sur trois, Huguette 8 sur 9 à l'acte II : les aides y étaient, et
  les indices trop forts. Le prix retouché et le juge des indices y
  répondent ; le second tour le vérifie.

## Le second tour

(à venir)
