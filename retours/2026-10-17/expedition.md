# L'Expédition — le brief de la V1, le 17 octobre 2026

Les demandes : « J'aimerais mettre en place un mode aventure, j'aimerais que
ça soit quelque chose d'innovant où on pourrait réussir à avoir les
légendaires qu'il y a dans le jeu, car aujourd'hui on fait que rajouter des
choses mais on ne sait plus quoi choisir », « les légendaires pourrait donner
justement des pouvoirs pour aider à avancer » ; puis, sur les routes : « le
gros négatif des sentiers que l'on m'a retourné c'est le fait que ce soit un
thème et si on est pas bon dedans c'est impossible à passer » ; puis, sur la
première carte : « il faudrait quelque chose de plus grand pour que ce soit
une réflexion sur quel chemin choisir », « on gagne les légendaires
uniquement si admettons on arrive fin de l'acte 3 alors on a le choix entre 1
des 3 légendaires » ; puis : « J'aimerais que chaque node soit aléatoire sur
toute les catégories », « des thèmes qui normalement sont plus spécifiques et
donc plus dur », « Les liens entre les escales devrait être différent d'une
run à l'autre, pareil pour les escales », « une autre idée […] pour que ça
soit fun et que l'on modifie le façon dont par exemple on peut avoir les
questions » ; enfin « 1. Oui 2. Oui 3. Ok pour v1 » — les pouvoirs des
légendaires deviennent des jokers, les talismans restent, rares et passifs,
quatre formes de questions pour commencer — et « Go ».

Ce brief fixe la V1 avant la première ligne de code : la règle, les données,
les invariants qu'elle touche, le calibrage, les tests et le découpage en
étapes. Les quatorze maquettes, jouables — la carte s'y tire vraiment au
sort —, sont sur claude.ai : https://claude.ai/artifact/B7HYdDffstjHybu1gTtj2g
(privées, au compte du propriétaire). Là où ce brief les contredit, il
l'emporte, et dit pourquoi (« Ce qui change depuis les maquettes »).
Les quatre étapes sont dans le code — les trois premières le 17 octobre
2026, les écus le 18 : là où elles s'écartent du brief, il a été mis à jour,
et le dit (« l'étape 1 », « l'étape 2 » entre parenthèses, « Fait à l'étape
3 », « Fait à l'étape 4 ») ; leurs fichiers et leurs pièges, dans
`.claude/rules/expedition.md`. L'expédition est ouverte en production depuis
ses jokers, la cible du calibrage approchée (« Le calibrage »).

## En bref

1. **Un mode de plus, pour les profils** : l'Expédition, sa page à elle
   (`/expedition`), gratuite et sans limite, une à la fois, qui se reprend où
   on l'a laissée.
2. **Trois actes, trois gardiens.** Chaque acte est une carte tirée au sort :
   six étages d'escales, cinq chemins qui ne se croisent jamais, deux
   campements, puis le gardien. Une escale pose une question d'une
   catégorie, d'un mélange de deux ou trois, ou d'un thème pointu, et la
   carte dit, sur chacune, la chance qu'on a de la trouver.
3. **Les légendaires se gagnent au bout, et seulement là.** Les trois
   gardiens sont trois légendaires qu'on n'a pas ; vaincus, ils suivent en
   jokers jusqu'au bout ; après le troisième, on en garde un.
4. **Ce qu'on a gagné sert enfin.** Chaque légendaire devient un joker : deux
   partent avec soi (l'équipée), et l'invité du jour, le même pour tous,
   prête le sien à qui n'en a pas. Les jokers ne sortent jamais de
   l'expédition — ni soirée, ni quiz du jour, ni défi, ni duel :
   l'invariant 8 devient « aucun avantage de jeu face aux autres ».
5. **Les questions autrement** : quatre choix, vrai ou faux, six choix,
   dévoilement — et la main de jokers, qui change la façon d'y répondre.
6. **Ce qu'elle paie** : chaque bonne réponse comme en campagne — un
   confetti, l'expérience d'une bonne réponse —, le carnet garde les
   erreurs, et le légendaire au bout. Les écus, la monnaie de l'expédition,
   meurent avec elle.
7. **Calibrée d'avance.** Une première simulation des règles proposées mène
   au bout le joueur moyen une fois sur trois, le fort plus de huit fois sur
   dix, le faible moins d'une fois sur dix. Sans joker, le moyen n'y
   arriverait que trois fois sur cent : les jokers font le mode.
8. **Quatre étapes**, chacune sa PR et ses tests : la carte et l'expédition
   de bout en bout ; les jokers ; les formes ; les écus. Le gros bouton de
   l'accueil arrive avec les jokers.

## Ce qui a été décidé le 17 octobre 2026

- **Les routes mélangent.** Le défaut des sentiers que remontaient les
  joueurs — un thème qu'on ne sait pas, et le palier ne passe plus — ne doit
  pas renaître : aucune escale n'impose un thème, la carte en offre toujours
  une autre à côté, et un gardien est une règle, jamais un thème. Les thèmes
  pointus existent, plus durs et mieux payés, pour qui les choisit.
- **Une carte plus grande, tirée à chaque expédition** : les escales, leurs
  thèmes, leurs formes et les chemins qui les relient changent d'une
  expédition à l'autre. Choisir sa route est une réflexion : la carte dit sa
  chance sur chaque escale, et sur le tracé qu'on dessine, la chance
  d'arriver au gardien.
- **Les légendaires, au bout de l'acte 3 seulement**, un parmi les trois
  gardiens vaincus. Un gardien vaincu en route ne donne que son joker,
  jusqu'au bout de l'expédition.
- **Les pouvoirs sont des jokers** (la réponse 1), **les talismans restent,
  rares et passifs** (la réponse 2), **quatre formes en V1** (la réponse 3) :
  quatre choix, vrai ou faux, six choix, dévoilement ; l'estimation et « qui
  suis-je ? » plus tard.
- **Proposés le même jour, sans objection avant « Go »** : l'invariant 8
  reformulé, « aucun avantage de jeu face aux autres » ; l'expédition
  gratuite, sans énergie du jour ; sa page à elle, et un gros bouton à
  l'accueil ; les écus qui meurent avec l'expédition, sans jamais devenir des
  confettis ; l'Ascension ratée qui ne laisse aucun légendaire.

## La règle de la V1

### Partir

- **Pour les profils**, comme la campagne : un invité anonyme n'en voit rien,
  et son accueil ne change pas — « Jouer sans compte » d'abord.
- **Une expédition à la fois.** « ← Partir » la laisse où elle en est, sans
  rien perdre ; « Abandonner l'expédition » la finit là. Rien d'autre ne la
  limite : ni énergie, ni nombre par jour.
- **L'équipée** : deux places, pour deux légendaires qu'on a et dont le joker
  existe ; chacun glisse le sien dans le paquet. **L'invité du jour**, le
  même pour tous, tiré de la date de Paris parmi les légendaires à joker,
  peut prendre une place même chez qui ne l'a pas, pour les expéditions
  parties ce jour-là : c'est par lui qu'un profil sans légendaire découvre
  ce qu'ils font, et lequel il veut.
- **Les trois gardiens** se tirent au départ, un par acte, parmi les
  légendaires qu'on n'a pas — jamais ceux de saison, qui ne se gagnent qu'à
  leur saison, par elle seule (l'étape 1 : même à leur période, l'expédition
  leur aurait ouvert une seconde porte), jamais
  l'invité du jour, et seulement ceux qui ont leur joker. S'il en manque, les
  places restantes se prennent parmi les siens : garder l'un d'eux au bout
  ne rapporte rien de plus que l'expérience de ses réponses, et la page le
  dit avant le départ. Un gardien gagné ailleurs en cours de route reste au
  choix, marqué « déjà à toi ».
- La page de départ dit les trois gardiens, l'acte de chacun, et ce que dure
  une expédition : vingt à trente questions.

### La carte d'un acte

Le générateur de la maquette « La grande carte », tel quel :

| | |
|---|---|
| La grille | six étages de quatre colonnes |
| Les chemins | cinq, qui montent d'une colonne voisine à l'autre sans jamais se croiser ; leurs pas font les escales et les liens |
| Le premier étage | des questions d'une catégorie, à quatre choix (sept fois sur dix) ou en vrai ou faux |
| Les étages 2 à 6 | question 46 %, élite 12 % (dès le troisième étage, deux par acte au plus), source 10 %, coffre 12 %, l'inconnu 8 % (deux au plus), échoppe 5 % (une au plus) ; le reste, et ce qu'un plafond refuse, en question |
| Les garanties | une source et un coffre au moins par acte : sans eux, aucune route ne laisserait le choix de se soigner ou de s'équiper — une question des étages 3 à 5 en devient un |
| Le haut | deux campements, celui de gauche au bout des colonnes 1 et 2, celui de droite au bout des colonnes 3 et 4 ; puis le gardien |

**Les thèmes.** Une question ou une élite des étages 2 à 6 prend un mélange
de deux ou trois catégories (18 % : sa question vient de l'une d'elles), un
thème pointu (14 %), sinon une catégorie, tirée parmi les douze. Un thème
pointu est un sujet de `shared/sujets.ts` — un thème, une époque, un fil
rouge — qui a de quoi tirer (`QUESTIONS_POUR_UN_SENTIER_DE_SUJET` : les
trente-trois du 17 octobre 2026) ; il paie ses écus doublés.

**Les formes**, aux étages 2 à 6 : quatre choix 40 %, vrai ou faux 20 %, six
choix 20 %, dévoilement 20 %.

**La marche** de chaque escale, acte par acte — jamais d'experte : le joueur
moyen en trouve une sur dix (`TAUX_DU_CALIBRAGE`), moins que le hasard.

| Acte | Étages 1 à 3 | Étages 4 à 6 | Élite | Gardien |
|---|---|---|---|---|
| 1 | facile | facile | moyenne | facile, quatre bonnes réponses |
| 2 | facile | moyenne | moyenne | moyen, trois bonnes réponses |
| 3 | moyenne | moyenne | difficile | difficile, trois bonnes réponses |

**La chance sur chaque escale** se calcule au départ, pour les trois actes,
et se garde avec l'expédition, comme la chance d'une épreuve à son départ
(l'étape 1 : à l'ouverture de chaque acte, elle aurait demandé le modèle
trois fois, et changé entre deux actes ce que la page avait promis) : la
chance, pour le modèle du savoir (`core/modeleDuSavoir.ts`, lu comme pour
les sentiers — `forceSurLesSentiers`, `chanceSurLaMarche`, sur ses premières
réponses), que le joueur trouve une question de sa catégorie à sa marche —
la moyenne de ses catégories pour un mélange, celle des catégories du sujet,
au poids de leurs questions, pour un thème pointu —, puis ramenée à sa
forme : le savoir se lit sous le hasard d'un sur quatre, et le hasard vaut
un sur six à six choix, un sur deux en vrai ou faux. Une source dit sa
chance à la marche moyenne, toutes catégories, comme le gardien à la
sienne : la question du carnet qu'elle repose ne se choisit qu'en y
marchant — la plus en retard à ce moment-là, quand l'expédition a pu en
ajouter. Elle se montre comme sur les sentiers : la couleur de piste (`couleurDePiste`) et
le pour cent (`pourcentDeChance`). Sous vingt premières réponses, ou avant
le premier ajustement du modèle, la carte dit la chance d'un joueur moyen,
et le dit.

**Le tracé.** On dessine sa route en touchant les escales ; la page calcule,
vie par vie, la chance d'arriver au gardien — une erreur en coûte une, une
source retrouvée et un campement en rendent une, jusqu'à trois — et le
butin espéré, et propose d'abord le tracé le plus sûr. Seul le pas suivant
engage : le tracé se redessine à chaque escale, et le serveur ne vérifie que
le pas, vers une escale reliée. Le calcul est pur (`shared/expedition.ts`)
et tourne dans le téléphone : il ne lit que des chances que le serveur a
déjà montrées.

### Les escales

- **Une question** : trouvée, l'escale est passée ; ratée, elle coûte une vie,
  et l'escale est passée aussi — on ne la rejoue pas.
- **Une élite** : une question de la marche au-dessus. Trouvée, un joker au
  choix parmi trois (étape 2) — et, à l'étape 4, des écus ou un talisman ;
  ratée, une vie, et rien.
- **Une source** : une question de son carnet — la plus en retard d'abord, à
  défaut une facile. Retrouvée, elle rend une vie ; ratée, elle ne coûte
  rien : le carnet la garde.
- **Un coffre** : un joker au choix parmi trois (étape 2). Passer rapporte des
  écus (étape 4).
- **Un campement** : une vie, ou, dès l'étape 2, un joker retiré de son
  paquet.
- **Une échoppe** et **l'inconnu** (étape 4) : des vies, des jokers et des
  talismans contre des écus ; un marchand, un piège ou un légendaire de
  passage, dont le joker reste jusqu'au bout de l'acte.
- **Le gardien** pose ses questions jusqu'à ce qu'on en ait trouvé autant
  qu'il en demande ; chaque erreur coûte une vie. Toutes catégories, à la
  marche de son acte, sans jumelles (`core/jumelles.ts`) ni vrai ou faux —
  une chance sur deux à la porte de l'acte suivant —, tirées d'avance, de
  quoi aller au bout de ses vies. Vaincu, il glisse son joker dans le paquet jusqu'au
  bout ; les vies passent d'un acte à l'autre. En V1, tous les gardiens ont
  cette règle ; les leurs — le Kraken et tes erreurs passées, le quitte ou
  double du Dragon d'Or, les années et les nombres de l'Oracle, dans les
  maquettes — viendront ensuite.
- **Les vies** : trois au départ, trois au plus (`VIES`, comme la campagne).
  À zéro, l'expédition s'arrête.

Les questions viennent de la base de la campagne (`core/baseCampagne.ts`),
jamais de la réserve du quiz du jour, tirées comme une épreuve des sentiers
(`tirerUneEpreuve`) sur le thème de l'escale : jamais vues d'abord, sans
jumelles — ce que l'expédition a déjà posé passe en dernier, comme vu à
l'instant.

### La fin

- **Le gardien de l'acte 3 vaincu**, l'écran du choix (la maquette 9) : les
  trois gardiens, leur joker sous chacun, un à garder. Le choix est définitif.
  Le légendaire est à lui comme s'il l'avait gagné par sa première voie : il
  paraît dans la collection, se porte, et son joker rejoint ceux qu'il peut
  emmener.
- **Puis l'écran des gains**, le même qu'à la fin de chaque mode (`Gains`) :
  « Ce que tu gagnes », « Nouveaux trophées », « À porter » — le légendaire,
  avec son « Essayer ».
- **Perdue ou abandonnée**, le même écran, sans légendaire : l'acte atteint,
  et le rappel que ses erreurs reviendront au carnet.
- **Le corrigé** passe par la liste de toutes les parties (`SerieCorrigee`),
  et une question se signale après sa réponse, comme en série.
- **L'Ascension** (la maquette 9, l'option du bas) viendra plus tard ; la
  règle en est décidée : un quatrième gardien, une seule vie ; réussie, on
  garde deux légendaires, ratée, aucun.

### Les jokers (étape 2)

- **Le paquet, la main, la défausse.** Au départ, le paquet tient quatre
  jokers — Coup d'œil trois fois, Échange — et celui de chaque légendaire de
  l'équipée. À chaque question, on en tire un, si la main en tient moins de
  trois. Un joker à jouer au plus par question. Joué, il va à la défausse,
  qui ne revient dans le paquet qu'au début de l'acte suivant : chaque joker
  sert une fois par acte, et le paquet qui s'épuise avant le gardien est la
  tension du mode.
- **Trois sortes.** *À jouer* : sur une question, puis défaussé. *À poser* :
  posé depuis la main, il agit jusqu'au bout de l'acte. *Sur la carte* : entre
  deux escales.
- **Trois raretés** : commun, rare, et maudit — plus fort, mais il coûte
  une vie ou un butin.
- **En gagner** : une élite trouvée ou un coffre, un au choix parmi trois,
  tirés selon leur rareté (`shared/jokers.ts`, un choix de produit) ; un
  gardien vaincu, le sien. **En retirer** : au campement, au lieu d'une vie.
- **Un joker qui efface ou qui double ne se joue pas sur un vrai ou faux** :
  il répondrait à la place du joueur.
- **Le hasard se rejoue.** Chaque tirage — la main, les offres, la réponse
  qu'un joker efface — vient de la graine de l'expédition et du rang du
  tirage (`hasardDe`, `shared/missions.ts`) : recharger la page ne retire ni
  une main ni une offre.
- **Le serveur joue chaque joker** — les réponses qui s'effacent, l'indice,
  l'autre question — et le téléphone ne reçoit que ce que le joker montre
  (invariant 1).

Les jokers sans légendaire, en V1 :

| Joker | Rareté | Sorte | Effet |
|---|---|---|---|
| Coup d'œil | commun | à jouer | une mauvaise réponse s'efface |
| Échange | commun | à jouer | une autre question, de la même escale |
| La pioche | commun | à jouer | tu tires deux jokers, pour les questions suivantes : elle prend la place du joker de celle-ci |
| Le détour | commun | sur la carte | ton pas suivant peut aller à n'importe quelle escale de l'étage du dessus |
| Double chance | rare | à jouer | deux réponses : il suffit que l'une soit juste |
| Sursis | rare | à jouer | si tu te trompes, tu ne perds pas de vie |
| Tout ou rien | maudit | à jouer | deux mauvaises réponses s'effacent ; si tu te trompes quand même, deux vies |

L'étape 3 ajoute Arrêt sur image (commun, sur un dévoilement : il s'arrête
cinq secondes, le gain ne baisse plus) ; l'étape 4, Quitte ou double (maudit :
juste, les écus de l'escale triplent ; faux, deux vies).

Les jokers des légendaires (la maquette 10), et ceux de la V1 :

| Légendaire | Son joker | Sorte | Effet | En V1 |
|---|---|---|---|---|
| Le Phénix | Renaissance | à poser | si tu perds ta dernière vie, tu renais avec une | oui |
| La Salamandre | Peau de feu | à poser | sur ta dernière vie, ta première erreur ne te coûte rien | oui |
| Le Scarabée solaire | L'aube | à poser | l'acte fini sans erreur depuis qu'il est posé te rend une vie | oui |
| Le Coq de l'aube | Le réveil | à jouer | tu reprends une vie, tout de suite | oui |
| L'Ouroboros | La boucle | à poser | ta prochaine erreur revient à la prochaine escale à question ; retrouvée, elle te rend ta vie | oui |
| La Chouette d'Argent | Sagesse | à jouer | deux mauvaises réponses s'effacent | oui |
| Le Sphinx | Énigme | à jouer | le siècle et le domaine de la question (`meta.date`, `meta.sousTheme`) | oui |
| L'Oracle | Prédiction | à jouer | sur une année ou un nombre : tu montres une réponse, il dit « plus haut » ou « plus bas » | oui |
| L'Éléphant | Mémoire | à jouer | « Tu l'as déjà vue : tu avais répondu… » | plus tard : le tirage pose d'abord ce qu'on n'a jamais vu, il ne servirait presque jamais |
| La Licorne Astrale | Le public | à jouer | ce que les autres ont répondu | plus tard : peu de questions ont assez de réponses pour faire une foule |
| Janus | Deux visages | à jouer | deux questions s'affichent : tu choisis la tienne | oui |
| Le Serpent à plumes | La mue | à jouer | une autre question, qui ne te coûte pas de vie si tu la rates | oui |
| Le Lion Couronné | Commandement | sur la carte | tu choisis la catégorie de l'escale suivante | oui |
| Le Tigre Foudre | L'élan | à poser | trois bonnes réponses d'affilée te font tirer un joker de plus | oui |
| La Chimère | Trois têtes | à poser | tu tires deux jokers par question, et ta main en tient quatre | oui |
| L'Aigle aux lauriers | Vue d'en haut | sur la carte | tout l'acte se révèle | plus tard : il demande une carte qui cache ses escales |
| La Comète | Le raccourci | sur la carte | tu sautes une escale | oui |
| Le Renard Lunaire | Il connaît la maison | sur la carte | une source ou un coffre s'ouvre à l'étage du dessus, relié à toi | oui |
| Le Dragon d'Or | Le trésor | à poser | les coffres t'offrent deux jokers au lieu d'un | oui |
| La Citrouille | La lanterne | sur la carte | les pièges de la carte se montrent | à l'étape 4, avec l'inconnu |
| Le Sapin | Une boule pour chacun | sur la carte | un coffre de plus sur la carte | à l'étape 4, avec l'échoppe |
| Le Bouquet final | Le feu d'artifice | à jouer | toute ta défausse revient dans ton paquet | oui |
| Le Kraken | Remonter des abysses | à poser · maudit | sur ta dernière vie, trois bonnes réponses d'affilée en rendent une ; le poser coûte une vie | oui |
| Le Fantôme | Passe-muraille | à jouer · maudit | tu traverses une question sans y répondre ; elle part au carnet comme ratée | oui |
| Le Trou Noir | L'horizon | à jouer · maudit | joué après une erreur, il te rend sa vie ; le coffre suivant est vide | oui |
| La Chauve-souris | L'écholocation | à poser · maudit | une mauvaise réponse s'efface à chaque question ; la carte ne dit plus ta chance | oui |

Vingt et un en V1, vingt-trois avec l'étape 4. Tant qu'un légendaire n'a
pas son joker, il n'entre ni dans l'équipée ni parmi les gardiens. Ceux de
saison agissent toute l'année : leur saison ne borne que leur conquête. Le
reste de la collection viendra
après (la maquette 10, en bas) : les compagnons, un joker qui grandit avec
leurs formes — le Flair du Loup ; les portraits des sentiers, des talents
passifs, comme un talisman. **Les Divins n'ont aucun joker** : un pouvoir en
dirait trop sur ce qui les fait descendre (invariant 21).

### Les formes (étape 3)

- **Quatre choix** : la question de la base, telle quelle.
- **Vrai ou faux** : la base n'en a que 144 de natifs, dont trois en sport et
  cinq au cinéma (le relevé du 17 octobre 2026). Une question à quatre choix
  en devient un : son intitulé, une réponse proposée — la bonne une fois sur
  deux —, « vrai ou faux ? ». Une question née vrai ou faux se pose telle
  qu'elle est écrite.
- **Six choix** : ses quatre réponses et deux leurres (`meta.leurres` : 25 271
  questions sur 25 529 en ont deux).
- **Dévoilement** : l'intitulé paraît mot à mot, les quatre réponses dès le
  départ ; répondre tôt paie plus d'écus. Le texte arrive du serveur au fil
  des mots — une réponse HTTP qui s'écrit à leur rythme —, jamais entier
  d'avance (invariant 1), et le gain se lit à l'heure du serveur, à la
  réception de la réponse (invariant 6).

**Fait à l'étape 3** (le 17 octobre 2026), avec ce que le code a dû
trancher : le dévoilement dit un mot tous les 350 ms (`MS_PAR_MOT`), le
premier dès que la question se pose, et ne se tire que parmi les intitulés
de six mots au moins (`MOTS_DU_DEVOILEMENT`) ; ses mots partent par leur
route (`GET /api/expedition/:id/devoilement`), un par ligne, et la réponse
dit à quel mot elle est arrivée (`devoile`) — les écus de l'étape 4 le
liront. Arrêt sur image suspend le compte cinq secondes
(`ARRET_SUR_IMAGE_MS`), mots compris. Deux visages ne se joue pas sur un
dévoilement : deux textes à la fois, on n'en lirait aucun. Une forme
qu'aucune question du thème ne peut prendre se pose à quatre choix ; une
élite a sa forme, comme une question. Arrêt sur image ne s'offre qu'aux
expéditions parties depuis (`Joker.depuis`, le départ en version 3) : les
offres se rejouent de la graine, et un joker de plus aurait changé celles
d'une expédition en route.

### Les écus, l'échoppe, les talismans (étape 4)

- **Les écus** d'une escale trouvée, selon la chance qu'elle annonçait :
  piste verte 5, bleue 10, rouge 20, noire 30 ; doublés sur un thème pointu,
  divisés par deux en vrai ou faux ; au dévoilement, trois fois le prix au
  premier mot, puis il descend jusqu'au prix de l'escale. Une élite ajoute
  25, un gardien 40.
- **Ce qu'ils achètent**, à l'échoppe : une vie, un joker, un talisman, un
  joker retiré. Les prix sont un choix de produit (`shared/expedition.ts`,
  `docs/reference/baremes.md`).
- **Les talismans**, rares — une élite, un coffre, l'échoppe —, passifs,
  jusqu'au bout de l'expédition ; ils changent la route (la maquette 6 : la
  loupe, chaque question d'Histoire dit son siècle ; le maillot jaune, le
  sport paie double écus ; la boussole, l'inconnu se dévoile).
- **Ils meurent avec l'expédition**, et ne deviennent jamais des confettis :
  un confetti reste une bonne réponse.
- **La mise** (la maquette 5) viendra plus tard.

**Fait à l'étape 4** (le 18 octobre 2026), avec ce que le code a dû
trancher : la couleur qui paie est celle de la chance que la carte
annonçait — ou le Commandement, la catégorie choisie (`chanceAnnoncee`) — ;
une question à deux réponses, née vrai ou faux ou tirée d'une autre, paie
moitié ; au dévoilement, le prix descend du triple au premier mot jusqu'au
prix de l'escale au dernier, lu de l'heure où le serveur a reçu la réponse
(`repondue_le`, déjà écrite : `devoileA`). Les écus ne s'écrivent nulle part,
le pli les compte (`ecusDeLaReponse`) ; un achat, un geste (`acheter`), garde
le prix payé. Un coffre passé sans rien y prendre rapporte 15 écus. Une
offre cache un talisman une fois sur six ou sept (`CHANCE_D_UN_TALISMAN`, à
prendre au lieu d'un joker), l'échoppe en vend un ; une vie et un joker
retiré, un par échoppe ; chaque article une fois. L'échoppe ne retient pas :
le pas suivant la quitte. L'inconnu cache, un tiers chacun, un marchand,
un piège — une vie, la dernière comprise — ou un légendaire de passage,
tiré hors de l'équipée, dont le joker entre dans la main, pleine ou non,
jusqu'au bout de l'acte. Ce qu'il cache se tire de la graine et ne part
jamais avec la carte avant d'être dévoilé (invariant 1). La loupe ne dit le
siècle que d'une question qui se date, et sa réponse, aidée, ne mesure
rien. Quitte ou double ne se joue que sur une question ou une élite, qui
seules paient des écus. La lanterne de la Citrouille montre les pièges de
l'inconnu jusqu'au bout de l'acte ; la boule du Sapin change en coffre une
escale de l'étage du dessus. Les écus, Quitte ou double et les talismans ne
valent que pour les expéditions parties depuis (le départ en version 4) :
celles d'avant se rejouent sans écus. La carte en compte : sous le tracé,
le butin espéré (`ecusEsperes`) ; la chance d'arriver compte un piège sur
trois dans l'inconnu qu'elle ne voit pas.

### Ce que l'expédition paie, et ce qu'elle ne compte pas

| | Compte | Pourquoi |
|---|---|---|
| Un confetti par bonne réponse | oui, comme dans tous les modes (`CampagneStore.duProfil`) | |
| L'expérience d'une bonne réponse | oui (`XP_PAR_JUSTE`, `JUSTES_DOUBLEES_PAR_JOUR`) | le barème ne bouge pas : aucune expérience de plus pour un gardien |
| Le Marathonien | oui | il compte l'effort |
| Le carnet | toutes ses erreurs ; une bonne réponse aidée — par un joker, ou un vrai ou faux tiré d'une question à quatre choix — ne retrouve rien | trouvée par chance, elle ne prouve rien |
| La mesure des difficultés (`mesures`), le modèle du savoir, les écussons et la précision (`savoirDe`), L'Érudit | les seules réponses nues : la question telle que la base l'a écrite, sans joker | à six choix ou aidée, une question n'a plus la difficulté qu'on mesure |
| Une source | au carnet, comme une révision ; ni à la mesure, ni aux écussons et à la précision, ni à L'Érudit, ni aux catégories des missions (`carnet: true`, `HORS_DU_CARNET` — l'étape 1) | elle repose une question ratée, réponse lue : elle ne dit rien de la question ni de son savoir |
| « Jamais vues d'abord » | oui | une question posée est vue |
| Les records, la Grande Série, les hauts faits des séries, l'Éclat | non | l'expédition n'est pas une série, et se rejoue à volonté : comme la série, elle ne tire pas l'Éclat |
| Les écus | non | ils meurent avec elle |
| Le légendaire | oui | au bout de l'acte 3 |

### Ce qui change depuis les maquettes

- **La main se garde** : un joker tiré par question, trois en main. Les
  maquettes en tiraient deux par question et jetaient ceux qu'on ne jouait
  pas : jouer ne coûtait donc rien, on jouait tout, sans choix — et un joker
  de carte, tiré devant une question, ne pouvait pas attendre la carte.
- **Un joker se joue en deux touchers** (l'étape 2) : sur la maquette 4,
  toucher sa carte le jouait — un toucher perdu sous les réponses coûtait le
  meilleur joker de l'acte. Sa carte ouvre « Ta main », qui dit ce qu'il fait,
  ou pourquoi il ne se joue pas maintenant, puis son bouton le joue. Sur la
  carte, la main tient en une ligne dans le panneau du tracé : ses cartes
  l'auraient poussé au-dessus de la moitié de l'écran.
- **L'équipée se choisit dans une feuille** (l'étape 2), comme les
  catégories d'une série : rien ne change avant « Choisir ». La maquette 2
  en faisait un écran ; le départ garde la ligne de la maquette 1, « Ton
  équipée · Changer ».
- **Le campement a son écran** (l'étape 2), que les maquettes n'avaient
  pas : une vie, ou un joker retiré, choisi parmi les siens.
- **La défausse revient à chaque acte**, pas dès que le paquet est vide :
  sinon un seul Double chance repassait presque à chaque question, et
  réduire son paquet à son meilleur joker devenait le seul jeu (le
  calibrage, plus bas).
- **Le gardien se bat jusqu'à n bonnes réponses, chaque erreur coûtant une
  vie**, au lieu de « cinq questions, quatre à trouver » : une seule monnaie,
  les vies, et pas de second échec à expliquer.
- **« Autre carte » disparaît** : la carte se tire au départ, et ne se change
  pas en route.
- **Le tracé n'engage que le pas suivant** : un plan, pas un contrat.
- **L'« Indice » du paquet de départ disparaît** : la base n'a pas d'indice
  écrit, et ce qu'elle a — les entités et l'explication d'une question —
  souffle la réponse ; l'indice est l'Énigme du Sphinx, le siècle et le
  domaine. **« Le public » n'est qu'à la Licorne**, et la mue du Serpent ne
  coûte pas de vie, pour ne pas doubler l'Échange commun.
- **Les gardiens se tirent parmi les légendaires qu'on n'a pas** : le
  Kraken, le Dragon d'Or et l'Oracle des maquettes n'en sont qu'un exemple.
- **Les jokers des saisons agissent toute l'année.**
- Les cartes 3A et 3B, premières variantes, sont remplacées par la 3.

## Le calibrage

Une première simulation, sur le générateur de la maquette et la règle
ci-dessus, faite avant tout code : vingt mille expéditions par case
(`simulation-expedition.mjs`, à côté de ce brief — `node
retours/2026-10-17/simulation-expedition.mjs`, cinq minutes). Le joueur
moyen trouve ce que trouve le calibrage des sentiers (`TAUX_DU_CALIBRAGE`),
le faible et le fort sont décalés d'un logit, comme les décale
`calibrage-sentiers.ts` ; chacun a ses catégories fortes et faibles, choisit
sa route sur sa chance, se soigne quand il saigne, et joue un joker quand il
ne sait pas.

| | Faible | Moyen | Fort |
|---|---|---|---|
| Avec une équipée (la Chouette, le Phénix) | 7 % | 34 % | 85 % |
| Le paquet de départ seul | 3 % | 19 % | 70 % |
| Sans aucun joker | 0 % | 3 % | 38 % |
| Questions jouées, avec l'équipée | 19 | 24 | 25 |

1. **Les jokers font le mode** : sans eux, le joueur moyen n'arrive au bout
   que trois fois sur cent ; deux légendaires dans l'équipée lui valent
   quinze points de plus. Ce qu'on a gagné sert à gagner la suite : c'est la
   demande.
2. **La défausse qui revenait dès le paquet vide cassait le calcul** : un
   seul Double chance, seul dans le paquet, repassait presque à chaque
   question et portait le joueur moyen de 3 à 31 % — autant qu'une équipée
   entière. Rendue à chaque acte, la défausse le laisse à 5 %.
3. **Le gardien est le mur** : le faible s'arrête à celui de l'acte 2, une
   expédition sur deux. Le rendre facile à cinq bonnes réponses porte le
   faible à 14 %, mais le moyen à 44 %, et le mur passe à l'acte 3.

**La cible**, retenue le 17 octobre : le moyen une fois sur trois, le fort
huit fois sur dix. Elle se mesure pour de bon par
`server/scripts/calibrage-expedition.ts`, sur le vrai générateur et le vrai
pli, les joueurs décalés d'un logit comme `calibrage-sentiers.ts` le fait des
paliers, chacun suivant le tracé le plus sûr que la page lui propose — puis
sur les vraies expéditions. **À l'étape 1, sans jokers** : faible 0 %, moyen
5 %, fort 42 % sur deux mille expéditions — la simulation disait 0, 3 et 38.
Les jokers de l'étape 2 doivent faire le reste : la cible se remesure avec
eux, avant d'ouvrir en production.

**Avec les jokers (l'étape 2)**, remesurée le même jour sur deux mille
expéditions par joueur, chacun sachant ou ne sachant pas chaque question et
jouant son meilleur joker quand il ne sait pas, comme la simulation :

| | Faible | Moyen | Fort |
|---|---|---|---|
| Avec la Chouette et le Phénix | 4 % | 26 % | 67 % |
| — en gardant ses jokers rares et légendaires pour le gardien (`--garder`) | 5 % | 29 % | 72 % |
| Avec Janus et le Serpent à plumes, en les gardant | 4 % | 28 % | 79 % |
| Le paquet de départ seul | 2 % | 16 % | 60 % |
| Sans aucun joker | 0 % | 4 % | 39 % |

La cible est approchée, pas tenue : la simulation, plus simple — l'élite et
le coffre donnaient toujours un Double chance, le gardien vaincu rien —,
disait 34 et 85. Une main de quatre la tiendrait (`MAIN_MAX` : le moyen à
33 %, le fort à 74 %, en gardant ses jokers) ; un quatrième Coup d'œil au
départ n'y change rien de mesurable. L'expédition s'ouvre aux règles du
brief, et le choix d'une main de quatre reste au propriétaire (l'étape 2).

**Avec les formes (l'étape 3)**, remesurée le même jour, le calibrage
posant chaque escale à sa forme — le vrai ou faux à deux réponses, le six
choix à six, sa chance ramenée comme la carte la ramène :

| | Faible | Moyen | Fort |
|---|---|---|---|
| Avec la Chouette et le Phénix | 5 % | 25 % | 66 % |
| — en les gardant (`--garder`) | 6 % | 28 % | 70 % |
| Avec Janus et le Serpent à plumes, en les gardant | 4 % | 28 % | 77 % |
| Le paquet de départ seul | 2 % | 17 % | 61 % |
| Sans aucun joker | 0 % | 4 % | 40 % |

Rien ne bouge au-delà du bruit de deux mille expéditions : le vrai ou faux,
que le hasard aide, paie ce que le six choix coûte.

**Avec les écus (l'étape 4)**, remesurée le 18 octobre 2026 : le joueur
achète à l'échoppe une vie s'il lui en manque, puis le meilleur joker de
l'étal, puis la loupe ou la boussole ; il répond à mi-texte un dévoilement
qu'il sait, joue Quitte ou double sur ce qu'il sait, et suit le tracé le
plus sûr, qui compte un piège sur trois dans l'inconnu qu'il ne voit pas :

| | Faible | Moyen | Fort |
|---|---|---|---|
| Avec la Chouette et le Phénix | 6 % | 25 % | 67 % |
| — en les gardant (`--garder`) | 8 % | 30 % | 71 % |
| Avec Janus et le Serpent à plumes, en les gardant | 6 % | 31 % | 77 % |
| Le paquet de départ seul | 3 % | 20 % | 62 % |
| Sans aucun joker | 0 % | 5 % | 43 % |
| Écus gagnés, avec la Chouette et le Phénix | 97 | 139 | 174 |
| Articles achetés | 0,6 | 0,9 | 0,9 |

L'échoppe rend un à trois points : une vie s'y achète, le moyen à peu près
une fois par expédition. Sans jokers, l'échoppe et l'inconnu ne sont que des
pas sans question — sans écus, rien ne s'y achète ni ne s'y cache —, et
c'est ce qui monte le fort de 40 à 43 %. La cible reste approchée, pas
tenue.

## Les données

- **Une expédition est une partie de la campagne d'un autre mode**
  (`campagne_series`, `mode = 'expedition'`), comme une épreuve de sentier :
  ses questions telles qu'elle les a lues (`questions`, allongées à chaque
  tirage, avec leur escale et leur acte — leur forme à l'étape 3 —, et
  `carnet` pour celle d'une source) ; `position`, `vies` et `justes`, tenues
  à jour par chaque écriture, pour ce qui les lit sans refaire le pli ;
  `issue` (`legendaire`, `perdue`, `abandonnee`) ; et une colonne neuve,
  `expedition` (JSON versionné : `{ v, graine, numero, gardiens, cartes,
  moyen }` à l'étape 1 — les chances de chaque escale dans ses cartes,
  `moyen` quand elles sont celles d'un joueur moyen —, `equipee` et `invite`
  à l'étape 2). Les trois cartes, tirées au départ de leur graine, se gardent
  telles quelles : une retouche du générateur ne déplace pas une escale sous
  les pieds de qui joue. Toute requête des parties filtre déjà son mode —
  `SERIES`, ou ses modes nommés un à un — : `expedition` rejoint chaque
  liste à dessein, jamais par défaut.
- **Le journal des gestes** — `expedition_gestes`, une table neuve :
  `serie_id` et `rang` (la clé), `geste` (JSON), `fait_le`. Pas de colonne
  `apres`, prévue ici d'abord (l'étape 1) : une question qui attend sa
  réponse n'admet que l'abandon, et les questions se consomment dans l'ordre
  de leur tirage — gestes et réponses ne s'entrelacent que d'une façon. Un
  joker joué sur une question (étape 2) dira la position qu'il vise.
  Un geste : `avancer` (vers une escale), `jouer` (un joker, sur quelle
  question), `poser`, `prendre` (une offre d'un coffre ou d'une élite, ou
  rien), `camper` (une vie, ou le joker retiré), `acheter` (étape 4),
  `garder` (le légendaire, au bout), `abandonner`.
- **Les réponses restent dans `campagne_reponses`** — c'est ce qui fait
  compter l'expérience, les confettis, le carnet et « jamais vues d'abord »
  sans rien en savoir —, avec deux colonnes neuves, vides partout ailleurs,
  chacune à l'étape qui la remplit (l'étape 1 : vides, elles n'auraient rien
  dit) : `forme` (vide : telle que la base l'a écrite ; sinon `six`,
  `vrai-faux`, `devoilement` — étape 3) et `joker` (vide : sans aide ; sinon
  la clé du joker qui l'a touchée — étape 2). Un seul fragment SQL dit « une
  réponse nue » (`forme IS NULL AND joker IS NULL`), que lisent la mesure,
  le modèle du savoir, les écussons et L'Érudit ; le carnet ne compte une
  bonne réponse retrouvée que nue. À l'étape 1, ce fragment est celui des
  sources (`HORS_DU_CARNET`, sur le drapeau `carnet` de la question) : il
  s'étendra aux deux colonnes.
- **L'état est un pli** (`shared/expedition.ts`) : les cartes, les gestes et
  les réponses donnent la position, les vies, le paquet, la main, la
  défausse, les jokers posés, les écus, les gardiens vaincus — le même pli
  pour l'expédition en cours et pour une finie (invariant 14). Son hasard
  vient de la graine et du rang (`hasardDe` sur `graine:pioche:n`,
  `graine:offre:n`…) : rien ne se retire en rechargeant. Seules les
  questions se tirent de la base — elles dépendent de ce qu'il a vu, et de la
  mesure — : elles s'écrivent à leur tirage, comme en série.
- **Le légendaire gagné** est une ligne de `profile_badges`,
  `expedition:<légendaire>` rangée sous la partie (`#campagne:<id>`, comme
  ce que range une série), hors de l'étagère et du compte des badges, comme
  les saisons (`saison:halloween`) ; chaque légendaire qui a son joker, hors
  saison, reçoit la voie qui la lit (`aussi`, `{ hautFait:
  'expedition:kraken', fois: 1 }`), que l'album dit partout où un légendaire
  dit comment il se gagne (son lieu `expedition`) — cachée tant que
  l'expédition est fermée en production (`voiesMontrees`).
- **Le poids** : une expédition, vingt à trente questions — une série en
  garde jusqu'à soixante —, une soixantaine de gestes, et trois cartes de
  quelques kilo-octets.

Les routes proposées, sur le modèle de la campagne :

| Route | Ce qu'elle fait |
|---|---|
| `GET /api/expedition` | l'expédition en cours, vue du joueur ; sinon de quoi partir : son équipée possible, l'invité du jour |
| `POST /api/expedition` | partir, avec son équipée |
| `POST /api/expedition/:id/geste` | un geste du journal, avec le rang qu'il croit suivre |
| `POST /api/expedition/:id/reponse` | une réponse, avec sa position |
| `POST /api/expedition/:id/abandon` | l'abandon |

Chaque requête : un lot de lectures, un lot d'écritures, sous le verrou du
profil, comme la campagne. Un geste qui ne suit pas le dernier rang est
refusé — un double toucher, un second onglet — : l'invariant 12, porté au
solo. `avancer` vers une question en rend la question, dans la même
réponse : pas un aller-retour de plus.

## Les invariants que l'expédition touche

- **1 · La logique de jeu est serveur.** La bonne réponse n'arrive qu'après
  la réponse ; les réponses qu'un joker efface, l'indice, la question
  échangée, c'est le serveur qui les choisit ; le texte d'un dévoilement
  arrive mot à mot. La carte et les chances sont publiques ; le contenu de
  l'inconnu (étape 4) ne l'est pas.
- **6 · Une échéance se lit à `serverNow()`.** Le dévoilement est le seul
  chronomètre du mode : son gain se lit à l'heure du serveur.
- **8 · Aucun avantage de jeu face aux autres.** La formulation proposée, à
  écrire dans `CLAUDE.md` avec la première PR de code : « **Un profil ne
  donne aucun avantage de jeu face aux autres** — ni en soirée, ni au quiz
  du jour, ni au défi, ni en duel ; seule l'expédition, qu'on joue seul, fait
  servir ce qu'on a gagné, et ses jokers n'en sortent jamais —, et un invité
  anonyme n'affiche **rien** […] ». Avec elle, « Les principes » de
  `docs/produit/les-recompenses.md` (« Ce que tu gagnes se voit ; rien ne se
  joue ») et une décision dans `docs/architecture/decisions.md`. Aucune route
  d'un autre mode n'accepte un joker, et l'expédition n'a pas de classement.
- **12 · Un geste dit ce qu'il visait** : chaque geste porte son rang, chaque
  réponse sa position.
- **14 · Les dérivations restent pures** : l'état est le pli du journal, le
  même pour l'expédition en cours et pour une finie.
- **20 · Les récompenses sont des dérivations des journaux** : le légendaire
  se lit d'une ligne rangée et d'une voie ; l'expérience et les confettis,
  des réponses. Le barème ne change pas : aucune version à monter.
- **21 · Les Divins** : aucun joker. Ce qu'une voie neuve change aux Divins
  se vérifie dans `core/divins.ts`, et ne s'écrit nulle part ailleurs.
- **22 · Durcir ne reprend rien** : une voie de plus n'ôte rien à personne, et
  un légendaire gagné en expédition ne se reprend jamais, même si la règle
  de l'expédition change.
- **Le chemin anonyme reste la valeur** : l'accueil d'un invité ne change
  pas, ni ses trois gros boutons.
- **Le dixième de cœur** : un tirage par escale, sur le tirage préparé ; les
  chances des trois actes, une fois, au départ, sur le modèle déjà en
  mémoire ; le pli, un passage sur une soixantaine de gestes ; aucune passe
  sur toute la base.

## Les écrans

| Écran | Sa maquette | Étape |
|---|---|---|
| L'entrée de l'expédition, ses trois gardiens | 1 · L'Expédition | 1 (l'équipée à l'étape 2) |
| L'équipée | 2 · L'équipée | 2 |
| La carte d'un acte, le tracé | 3 · La grande carte | 1 |
| Une escale | 4 · Une escale | 1 (la main à l'étape 2) |
| Le gardien | 7 · Le gardien | 1 |
| Le gardien vaincu | 8 · Le gardien vaincu | 1 |
| Le choix du légendaire | 9 · Le choix du légendaire, sans l'Ascension | 1 |
| Les jokers des légendaires | 10 · Les 26 jokers | 2 |
| Un joker pour ton paquet | 12 · Un joker pour ton paquet | 2 |
| Le dévoilement | 11 · Le dévoilement, et ta main | 3 |
| Un talisman | 6 · Un talisman | 4 |
| La mise | 5 · La mise | plus tard |

Les mots : une **expédition**, trois **actes**, des **escales**, un
**gardien** ; le **tracé** ; l'**équipée**, l'**invité du jour** ; un
**joker**, le **paquet**, la **main**, la **défausse** ; une **source**, un
**coffre**, une **élite**, un **campement**, une **échoppe**, **l'inconnu** ;
un **thème pointu**, un **mélange** ; les **écus**, un **talisman**. La
**carte** est celle de l'acte, comme celle des sentiers : un joker n'est
jamais une carte. Les mots des récompenses restent ceux du 13 octobre 2026 —
trophée, Bronze · Argent · Or, étoiles, palier —, sans médaille ni badge.

## Les étapes

Chacune sa PR, qui arrive avec ses tests (`server/test/`, en échec avant le
code) et met à jour, dans le même commit, ce que `documentation.test.ts`
réclame : les routes (`docs/reference/api-http.md`), les tables
(`docs/reference/base-de-donnees.md`), les constantes
(`docs/reference/baremes.md`). Jusqu'à l'étape 2, l'expédition n'a pas de
bouton à l'accueil, et ses routes répondent 404 en production — en ligne et
sans `APP_ENV` : la préproduction, `npm run dev` et les tests la jouent, et
rien ne s'y gagne en production avant que le mode soit entier.

### Étape 1 — La carte, et une expédition de bout en bout

- `shared/expedition.ts` : le générateur, les marches, la chance ramenée à sa
  forme, la chance d'arriver et le tracé le plus sûr, le pli.
  `shared/jokers.ts` : le catalogue, en données seulement — il dit quels
  légendaires peuvent garder un acte.
- Le mode `expedition`, la colonne `expedition`, la table
  `expedition_gestes` ; les colonnes `forme` et `joker` attendent l'étape
  qui les remplit, et le fragment de la réponse nue n'écarte encore que les
  sources (`HORS_DU_CARNET`).
- Les escales de l'étape : des questions à quatre choix (et les vrai ou faux
  natifs que le tirage amène), sur une catégorie, un mélange ou un thème
  pointu ; les sources ; les campements ; les gardiens à la règle commune ;
  les trois actes ; la fin, le choix, le légendaire et sa voie. Les élites et
  les coffres attendent l'étape 2, l'échoppe et l'inconnu l'étape 4 : d'ici
  là, le générateur pose une question à la place d'une élite, d'une échoppe
  ou de l'inconnu, une source à la place d'un coffre.
- Les routes, la page `/expedition` — la carte, l'escale, le gardien, la
  fin, l'écran des gains —, `server/scripts/rendu-expedition.ts` (chaque
  écran en 360 × 640, la skill `regarder-le-rendu`),
  `server/scripts/calibrage-expedition.ts`.
- La règle `.claude/rules/expedition.md` et sa ligne dans la carte de
  `CLAUDE.md`, l'invariant 8 reformulé, la page `docs/produit/l-expedition.md`
  reliée au sommaire, sa décision.
- Les tests :
  - `expedition-carte.test.ts` — la même graine donne la même carte ; les
    chemins ne se croisent jamais ; toute escale mène à un campement ; une
    source au moins (le coffre en devient une) ; sur deux mille cartes, les
    parts des sources, des mélanges et des thèmes pointus dans leurs bornes ;
    un thème pointu toujours tirable ; les chances, le tracé le plus sûr, ce
    qu'on peut encore atteindre ; les gardiens, jamais de saison.
  - `expedition.test.ts` (sur `banc.ts`) — partir ; n'avancer que vers une
    escale reliée ; une erreur coûte une vie, une source et un campement en
    rendent une, jamais au-delà de trois ; le gardien tombe à sa n-ième bonne
    réponse ; la dernière vie perdue finit l'expédition ; « ← Partir » la
    retrouve telle quelle, et une seule à la fois ; un geste rejoué ou en
    retard est refusé ; la bonne réponse ne part jamais avant la réponse ; au
    bout, un seul légendaire, parmi les trois gardiens, jamais deux fois.
  - `expedition-legendaires.test.ts` — la voie sur chaque légendaire qui a
    son joker, hors saison ; la ligne `expedition:` ouvre le légendaire par
    sa voie, sans paraître sur l'étagère ni au compte des badges ; fermée en
    production, la voie compte mais ne se montre pas.
  - `expedition.test.ts` dit aussi qu'une source reprend une question du
    carnet sans que sa réponse mesure rien, et qu'un gardien qu'on a déjà se
    dit avant le départ.
  - `expedition-pli.test.ts` — le pli du journal redonne l'état, et le même
    journal rejoué redonne le même état.
  - `gains.test.ts` rend aussi la fin de l'expédition.

### Étape 2 — Les jokers

- La main, le paquet, la défausse, les trois sortes, les raretés ; les jokers
  sans légendaire et les vingt et un des légendaires ; l'équipée et l'invité
  du jour ; les élites et les coffres sur la carte ; le campement qui retire
  un joker. Puis le gros bouton de l'accueil, et les routes ouvertes en
  production : sans jokers, l'expédition n'était qu'une série en carte.
- La colonne `joker` remplie ; la mesure, le modèle, les écussons, L'Érudit
  et le carnet n'en lisent que les réponses nues.
- Les tests :
  - `expedition-jokers.test.ts` — recharger ne change ni la main ni une
    offre ; chaque joker fait ce qu'il dit, et rien de plus ; un joker posé
    agit jusqu'au bout de l'acte ; la défausse revient à l'acte suivant ; un
    joker qui efface ne se joue pas sur un vrai ou faux ; aucune route du
    défi, des duels ou du quiz du jour n'accepte un joker.
  - `expedition-mesure.test.ts` — une réponse aidée ne bouge ni la mesure, ni
    le modèle, ni les écussons, ni L'Érudit, ni un rendez-vous du carnet ;
    elle paie son confetti, son expérience et Le Marathonien ; une erreur
    aidée entre au carnet.

### Étape 3 — Les formes (faite le 17 octobre 2026)

- Six choix, vrai ou faux tiré d'une question à quatre choix, dévoilement
  au fil des mots ; Arrêt sur image. La colonne `forme` remplie.
- Les tests : la bonne réponse jamais avant la réponse, à six choix comme en
  vrai ou faux ; un dévoilement ne livre que les mots déjà dits ; son gain
  se lit à l'heure du serveur ; une réponse d'une autre forme ne mesure rien.

### Étape 4 — Les écus et ce qu'ils achètent (faite le 18 octobre 2026)

- Les écus, l'échoppe, les talismans, l'inconnu, Quitte ou double ; la
  Citrouille et le Sapin.
- Les tests : les écus meurent avec l'expédition, et le solde de confettis
  n'en sait rien ; les prix de l'échoppe ; un talisman tient jusqu'au bout.

### Après le brief (le 18 octobre 2026)

La refonte des sujets de la campagne venue — quatre-vingt-douze dans
l'onglet des thèmes —, deux idées retenues par le propriétaire (« Idée 1 2
stp ») : **le passeport**, un tampon par thème pointu trouvé, la carte qui
signale ceux qui manquent, et Le Globe-trotter pour les compter ; **la
saison des fêtes**, leur fête plus souvent sur les cartes et leur légendaire
en gardien de l'acte 3. Le détail : `docs/produit/l-expedition.md`.

Le même jour, **la carte revue** à la demande du propriétaire : « il faudrait
uniquement illuminer la node sur laquelle on est et pas tout le chemin. Une
fois vaincu ça nous proposerait uniquement les nodes de devant que l'on peut
atteindre », et la carte « un peu fouillon et pas trop compréhensible ». Le
tracé de la maquette 3 ne se dessine plus : seule l'escale où l'on est
s'éclaire, les escales de devant qu'on peut atteindre sont proposées —
entourées, leur nom et leur chance en clair —, le reste attend en retrait
sans un mot ; on en touche une, puis « Y aller ». Le tracé le plus sûr se
compte encore : le panneau nomme la plus sûre des proposées, et ce nom,
touché, la choisit. La légende passe dans une feuille, « La carte ».

### Plus tard

L'Ascension ; la règle propre de chaque gardien ; les compagnons et les
portraits ; l'estimation et « qui suis-je ? » ; une carte qui cache ses
escales, et l'Aigle avec elle ; la Licorne et l'Éléphant ; les trophées de
l'expédition dans l'album ; une page au QG, qui relira le calibrage sur les
vraies expéditions ; une expédition de la semaine, la même carte pour tous.

## Tranché le 17 octobre 2026

Les sept questions ci-dessous, relues avec le propriétaire, et ce qui change
depuis les maquettes : « Go je valide passe a la suite ». Chaque proposition
est retenue telle qu'écrite — la cible du calibrage, rien de plus pour un
gardien qu'on a déjà, aucune expérience de plus pour un gardien vaincu, la
mise plus tard, le vrai ou faux tiré d'une question à quatre choix, une
carte neuve à qui abandonne avant sa première réponse, l'expédition de la
semaine plus tard et sans jokers classés.

1. **La cible du calibrage** : le joueur moyen au bout une fois sur trois, le
   fort huit fois sur dix ? Le faible n'y arrive qu'une fois sur quatorze,
   arrêté surtout par le gardien de l'acte 2. Deux leviers, si c'est trop
   peu : un acte 2 plus doux, au risque d'ouvrir le mode aux forts ; ou des
   marches à la mesure de chacun, lues sur sa force par le modèle du savoir
   — l'expédition se gagnerait alors à la ruse plus qu'au savoir. Proposé :
   lancer comme ci-dessus, et relire sur les vraies expéditions.
2. **Un gardien qu'on a déjà**, quand il ne reste plus assez de légendaires à
   gagner : que rapporte-t-il au bout ? L'Éclat ne se donne pas, il se tire ;
   des confettis toucheraient à l'économie. Proposé : rien de plus que
   l'expérience de ses réponses, et la page le dit avant le départ.
3. **Une expérience pour un gardien vaincu ?** Le barème du solo ne bouge pas
   sans le dire. Proposé : non en V1.
4. **La mise** (la maquette 5) : en V1, ou plus tard ? Proposé : plus tard.
5. **Le vrai ou faux** : tirer chacun d'une question à quatre choix (proposé),
   ou écrire des vrai ou faux natifs — 144 aujourd'hui, dont trois en sport ?
6. **Repartir pour une autre carte** : abandonner avant sa première réponse
   rend une carte neuve, donc on choisit un peu sa carte. On le laisse ?
   Proposé : oui ; chaque carte offre déjà de quoi passer.
7. **L'expédition de la semaine** : la même carte et les mêmes gardiens pour
   tous, un classement des écus. Proposé : plus tard — et sans jokers
   classés, ou elle contredirait l'invariant 8.
