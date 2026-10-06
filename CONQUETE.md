# La Conquête

Ce document décrit un troisième mode de jeu pour les profils, à côté du quiz
du jour et de la campagne : **la Conquête**, un jeu de territoires sur une
carte de tuiles hexagonales, où chaque tuile se gagne par une épreuve de quiz.
Il est né d'une idée du propriétaire, le 6 octobre 2026 :

> « Une vaste carte remplie de tuiles hexagonales. Le but du jeu : étendre son
> influence en prenant part à des territoires plus ou moins dangereux. Pour
> s'emparer des territoires, il faut répondre à des quiz, que ce soit en mode
> trois vies jusqu'à X, en rapidité comme le quiz du jour, ou comme la
> campagne. Certaines tuiles, pour être conquises, devront être battues par
> plusieurs personnes, ce qui permet d'introduire les guildes. On peut
> s'étendre sur des tuiles neutres, mais aussi entrer en guerre contre des
> guildes ou des joueurs seuls. Gagner de l'influence fera gagner des
> confettis, des cosmétiques et d'autres choses qu'on devra imaginer. Faut-il
> des périodes, qui se réinitialisent ? »

> **Rien n'est construit.** C'est un brief, à discuter : il propose des
> règles, des nombres et un chemin, et dit ce que le code rend facile ou
> coûteux. Les nombres sont des points de départ, qu'une simulation mesurera
> avant qu'on les fige (§ 11.11), comme pour les sentiers. Les décisions qui
> reviennent au propriétaire sont rassemblées au § 13.
>
> **La maquette jouable** : `maquettes/la-conquete.html` (à ouvrir dans un
> navigateur), publiée aussi sur https://claude.ai/artifact/S5wqCh22RJdLEzWVYdLWMU
> — les Terres, une tuile, une épreuve, un siège, la guilde, le classement, la
> Gazette. Tout y est simulé, et rien n'y est enregistré.

Il prolonge `README.md` (le produit), `CLAUDE.md` (les invariants) et
`RECOMPENSES.md` (ce qui se gagne).

---

## 0. En une page

**Le principe.** Les Terres du Savoir : une grande carte hexagonale, douze
provinces — une par catégorie, une par branche des sentiers —, que l'Oubli
recouvre d'une brume. Chaque tuile se reprend par une épreuve de quiz de sa
catégorie ; plus on approche du Cœur, plus c'est dangereux, et plus elle
rapporte. Chaque jour, cinq étendards : un étendard, une épreuve. Chaque nuit,
les tuiles versent leur influence. Dès la deuxième semaine, on peut assiéger
ses voisins ; les citadelles et les merveilles ne tombent qu'à plusieurs :
c'est l'affaire des guildes. Chaque mois, une Conquête : les Terres renaissent,
ce qu'on a gagné reste.

**Ce que je recommande** :

| # | Décision | En une phrase |
|---|---|---|
| 1 | Un mode des profils, sur tout le serveur | comme le quiz du jour : l'anonyme et les soirées n'y perdent rien |
| 2 | Les Terres, ce sont les douze catégories | ce qu'on sait devient un territoire ; le danger monte vers le centre |
| 3 | Cinq étendards par jour | le temps de jeu est borné : la régularité paie, pas l'acharnement |
| 4 | L'Oubli d'abord, la guerre ensuite | un adversaire commun, qui rend le jeu jouable à huit ; la guerre ouvre le 8 |
| 5 | Un mois, une Conquête, remise à zéro | contre la boule de neige ; un début, un milieu, une fin ; ce qui se gagne reste |
| 6 | Des guildes de deux à six, sans discussion | citadelles à trois, merveilles à quatre ; des signaux, pas de messages |

**Faisable ?** Oui, sans dépendance ni service de plus. La moitié du chemin
existe : la base de 5 012 questions étiquetées, le moteur des séries de la
campagne (une épreuve de conquête est une série d'un autre mode, comme les
épreuves des sentiers), le chronomètre tenu par le serveur du quiz du jour,
les clôtures à la première demande, les budgets du jour lus dans un journal,
`ranger`, les notifications. Le neuf est classique : la carte (de la
géométrie pure), l'état des Terres (le pli d'un journal), les guildes (deux
tables) et l'écran (un SVG). Le vrai risque n'est pas technique, c'est
l'équilibre : une vingtaine de joueurs, la boule de neige, les absents. D'où
l'Oubli, la remise à zéro, les étendards comptés, et une simulation avant de
figer les nombres.

**Le chemin** : six lots ; le deuxième rend déjà jouable une « Conquête
zéro », sans guerre ni guilde (§ 12).

---

## 1. Pourquoi ce mode tient dans FiestApp

### 1.1 Les quatre partis pris

Le README (« La direction ») les donne ; chaque fonctionnalité se range
derrière eux.

1. **Un geste pour jouer.** La Conquête ne touche pas aux soirées. Comme la
   campagne, elle demande un profil, et l'invité anonyme n'en voit rien : ni
   bouton qui le nargue, ni marque à côté des prénoms en soirée (§ 9.6).
2. **Zéro euro.** Rien de payant : l'état des Terres tient en mémoire, Turso
   n'écrit qu'à chaque geste, et rien ne tourne la nuit — tout se décide à la
   première demande (§ 11.5), comme le quiz du jour et le défi de la semaine.
3. **Le serveur décide.** L'épreuve se joue au serveur, comme en campagne : la
   bonne réponse n'arrive qu'après la sienne. Le maître d'une tuile, la chute
   d'un siège, l'influence : tout se calcule au serveur.
4. **Ce qui a été joué se garde.** Les Terres sont le pli d'un journal en
   ajout seul (§ 11.4). L'influence, les couronnes et les hauts faits s'en
   dérivent, et les Terres d'un mois passé se relisent (Les Annales, § 8.5).

### 1.2 Ce qu'elle apporte

- **Un but à l'échelle du mois.** Le quiz du jour dure dix questions, la
  campagne une série ; il manquait un but qui se poursuit sur des semaines et
  se joue à plusieurs sans être ensemble.
- **La dimension sociale des profils** (README, « Les chemins ouverts » ;
  RECOMPENSES.md, idée 39, les rivalités) : des voisins, des alliés, des
  guildes.
- **Les douze catégories deviennent une géographie.** On est fort en Nature :
  on tient la forêt. Une guilde a besoin d'un historien et d'une géographe. Les
  écussons de savoir racontent ce qu'on sait ; la Conquête le met en jeu.
- **Une raison de revenir chaque jour, sans s'y épuiser** : cinq étendards, et
  ce qui s'est passé pendant la nuit.

### 1.3 La tension à assumer

Le README écrit : « Ce qui n'est volontairement pas fait : classement public
entre espaces — seul le quiz du jour, joué par les profils, se classe sur tout
le serveur. » La Conquête serait **le second classement de tout le serveur**,
et le premier qui oppose des joueurs directement. C'est un choix de produit
(§ 13, n° 9) ; la suite le suppose acté.

### 1.4 Pour qui

- **Une vingtaine de joueurs** au quiz du jour (RECOMPENSES.md, § 5.16). La
  moitié jouerait la Conquête : il faut un jeu qui tienne **à huit comme à
  quarante**.
- **Des amis** : « pas d'anti-triche » (arbitrage du propriétaire, § 5.16), et
  la campagne reste sans chronomètre.
- **Des sessions courtes**, au téléphone, en 360 × 640 : cinq à dix minutes
  par jour.
- **Des joueurs très différents** : la grand-mère au petit téléphone de la
  tablée doit pouvoir prendre une tuile en trois touchers.

---

## 2. Le monde : les Terres du Savoir

### 2.1 La forme

- Une grande île hexagonale de tuiles hexagonales (pointe en haut,
  coordonnées axiales), de rayon R. Elle est **tirée d'une graine** au premier
  jour du mois, puis figée (§ 2.5).
- **Sa taille suit la population** : une quinzaine de tuiles par joueur
  attendu (ceux qui ont joué la Conquête le mois d'avant, ou le quiz du jour
  dans les quinze derniers jours).

  | Joueurs attendus | Rayon | Tuiles |
  |---|---|---|
  | jusqu'à 12 | 8 | 217 |
  | une vingtaine | 10 | 331 |
  | une trentaine | 12 | 469 |
  | une quarantaine | 14 | 631 |

- Quinze par joueur, c'est assez pour que l'Éveil reste paisible, et trop peu
  pour que la Mêlée ne vienne pas : si chacun réussit une prise et demie par
  jour, les deux tiers des Terres sont repris à la fin de la première semaine,
  et les frontières se touchent.

### 2.2 Douze provinces et le Cœur

Les Terres sont découpées en douze parts autour du centre, une par branche des
sentiers. Leur nom et leur lueur sont ceux de l'application
(`shared/branches.ts`, `client/src/components/Atlas.tsx`). Une tuile pose ses
questions dans la catégorie de sa province.

| Province | Catégorie | Lueur | Des noms de lieux |
|---|---|---|---|
| Le tour du monde | Culture générale | `#5fb8ff` | la Plaine des Voyageurs, le Pic des Boussoles |
| Les mythologies | Histoire | `#e8b04a` | les Bois du Minotaure, le Mont des Oracles |
| Les océans | Géographie | `#3fd0d4` | la Lande des Atolls, le Pic des Phares |
| L'espace | Sciences | `#a08bff` | les Dunes d'Euclide, la Crête des Comètes |
| La forêt | Nature | `#7ccf6a` | la Crête des Lynx, la Futaie de la Hulotte |
| Le grand écran | Cinéma & séries | `#ff6b8a` | le Pré des Projecteurs, les Sables du Clap |
| La scène | Musique | `#ff9f5a` | les Hauts du Diapason, la Lande des Ménestrels |
| Les contes | Arts & lettres | `#c48bff` | les Bois du Petit Poucet, le Mont des Encriers |
| Le stade | Sport | `#4fd18b` | les Champs du Podium, le Pic du Maillot jaune |
| La brigade | Cuisine | `#f2c14e` | les Dunes du Safran, le Pré des Marmitons |
| L'arcade | Jeux & pop culture | `#ff5fd2` | la Futaie des Pixels, les Hauts du Joker |
| Le carnaval | Autour de la fête | `#ffb347` | la Plaine des Masques, l'Erg des Lampions |

Au centre, **le Cœur** : deux anneaux de tuiles de toutes les catégories, les
plus dangereuses. L'ordre des provinces autour du centre est tiré lui aussi :
un mois la forêt borde les océans, le suivant le stade.

### 2.3 Les anneaux du danger

Le danger monte de la côte vers le centre. Il dit le niveau des questions
(§ 4.2) et ce que la tuile rapporte (§ 9.1). Le Cœur et sa lisière sont fixes ;
le reste se partage en trois bandes.

| Où | Danger | Questions | Influence par nuit |
|---|---|---|---|
| la côte, le tiers extérieur | 1 · sûr | faciles | 10 ✦ |
| l'arrière-pays, le tiers du milieu | 2 · calme | faciles et moyennes | 20 ✦ |
| les hautes terres, le tiers intérieur | 3 · rude | moyennes | 30 ✦ |
| la lisière du Cœur, l'anneau 3 | 4 · périlleux | moyennes et difficiles | 50 ✦ |
| le Cœur, les anneaux 0 à 2 | 5 · redoutable | difficiles | 80 ✦ |

### 2.4 Les terrains, et leur épreuve

Chaque tuile a un terrain, que la carte montre, et qui dit **comment** elle se
prend.

| Terrain | Part des tuiles | Épreuve (§ 4.1) | L'idée |
|---|---|---|---|
| 🌾 Plaine | ~30 % | L'Escarmouche | court et indulgent : la porte d'entrée |
| 🌲 Bois | ~25 % | La Traque | trois vies, six bonnes : la série de la campagne |
| ⛰️ Mont | ~20 % | L'Ascension | huit questions qui durcissent : l'épreuve des sentiers |
| 🏜️ Dunes | ~15 % | La Course | le chronomètre : le quiz du jour |
| 🏚️ Ruines | ~4 % | L'Énigme | trois questions dures, et un butin |
| 🌊 Lac | ~6 % | — | infranchissable : des cols, des détours, des frontières naturelles |
| 🏰 Citadelle | 12, une par province | Le Siège | ne tombe qu'à trois membres d'une guilde |
| 🏛️ Merveille | 6, à la lisière du Cœur | La Grande Épreuve | ne tombe qu'à quatre |
| 🌟 Le Cœur des Terres | 1, au centre | La Grande Épreuve | ne s'ouvre qu'au Crépuscule |

Les six merveilles se dressent chacune entre deux provinces — lesquelles, la
graine du mois le dit : la Bibliothèque d'Alexandrie, le Colisée, les Jardins
suspendus, le Colosse de Rhodes, le Grand Phare, le Labyrinthe. Chacune a sa
**relique** (§ 9.4).

Ainsi les trois façons de jouer qu'imaginait le propriétaire — trois vies
jusqu'à X, la rapidité du quiz du jour, l'épreuve de la campagne — ne sont pas
un réglage à choisir : **c'est le relief**. On lit la carte comme on lit une
épreuve.

### 2.5 Le tirage

- La graine est celle du mois (`conquete:2026-10`) : tout s'en déduit — la
  forme, l'ordre des provinces, les lacs, les terrains, les noms. Le premier
  qui ouvre la Conquête du mois tire les Terres et les fige en base, comme le
  défi de la semaine (`tirageDuDefi` : `INSERT … ON CONFLICT DO NOTHING`, puis
  relire — deux serveurs gardent le premier tirage).
- Les règles du mois (formats, seuils, tributs) **sont figées avec elles** : un
  nombre changé en cours de mois ne vaut que pour la Conquête suivante, comme
  un seuil des sentiers ne vaut que pour les épreuves qui commencent.
- **La mer se retire.** Quand il n'y a plus de côte libre pour débarquer
  (§ 8.6), un anneau de plus émerge à minuit. Les nouvelles tuiles sont une
  côte (danger 1) ; les autres gardent le leur. La carte grandit avec la
  population, sans rien prendre à personne.

### 2.6 L'anatomie d'une tuile

| Champ | Ce qu'il dit |
|---|---|
| `q, r` | sa place |
| province | sa catégorie (toutes, au Cœur) |
| terrain | son épreuve |
| danger | de 1 à 5, par son anneau |
| nom | « La Crête des Lynx », tiré de la graine |
| maître | un profil, une guilde, ou l'Oubli |
| garnison | de 0 à 3 étoiles (§ 6.5) |
| état | libre · tenue · assiégée (par qui, à quel score, jusqu'à quand) · sous trêve · protégée |

Seuls le maître, la garnison et l'état bougent, et ils se lisent dans le
journal (§ 11.4).

---

## 3. La journée d'un conquérant

### 3.1 Les étendards

- **Cinq étendards par jour**, rendus à minuit (heure de Paris), **sans
  cumul** — comme les vies des sentiers. Revenir chaque jour rapporte plus
  qu'enchaîner (RECOMPENSES.md, § 5.17, « La régularité d'abord »).
- **Rien ne se compte à côté** : les étendards se relisent dans le journal des
  gestes du jour, comme `viesDe` relit les épreuves ratées. Un hoquet de la
  base ne fausse rien.
- **Ils ne s'achètent pas.** Les vies des sentiers se rachètent en confettis ;
  ici, ce serait acheter la terre du voisin. Une option : **le
  ravitaillement**, un sixième étendard le jour où l'on finit sa partie du quiz
  du jour (§ 13, n° 3).

| Geste | Coût | Ce qu'il fait |
|---|---|---|
| Débarquer | 0 | prendre sa première tuile, sur une côte libre (§ 8.6) |
| Conquérir | 1 | une tuile de l'Oubli qui touche ses terres |
| Fortifier | 1 | une étoile de garnison sur une tuile à soi ou à sa guilde |
| Assiéger | 2 | une tuile d'un voisin qui touche ses terres (dès le 8) |
| Repousser | 0 | défendre une tuile assiégée : toujours gratuit |
| Le siège d'une citadelle | 1 | l'ouvrir, ou le rejoindre |
| La Grande Épreuve | 1 | une épreuve de plus vers la merveille de sa guilde |

### 3.2 Une journée

- **8 h 10, dans le métro.** La Gazette : « Cette nuit, tes onze tuiles t'ont
  versé 240 ✦. Léa assiège ta Crête des Lynx : 6 sur 8. » Un toucher sur le
  bandeau rouge, L'Ascension, 7 sur 8 : le siège est levé, la crête gagne une
  étoile. C'était gratuit.
- **12 h 40.** Deux étendards. La Futaie de la Hulotte (La Traque : trois vies,
  six bonnes) est prise. Le Pic des Comètes (L'Ascension, niveau 4) résiste :
  « Tu y retournes demain. »
- **21 h.** Camille a posé un signal : « Siège ce soir → la Citadelle des
  Druides ». Un étendard dans le siège ; Hugo fait le troisième. La citadelle
  tombe aux Lanternes.
- **Minuit**, à la première demande : le tribut, les sièges échus, les
  étendards rendus.

Cinq à dix minutes, en trois fois ou d'un coup.

---

## 4. Les épreuves

### 4.1 Cinq épreuves, et deux pour les guildes

| Épreuve | Terrain | La règle | Ce qu'elle reprend | Durée |
|---|---|---|---|---|
| **L'Escarmouche** | Plaine | 5 questions, 4 bonnes | une épreuve des sentiers, courte | ~1 min |
| **La Traque** | Bois | 3 vies, 6 bonnes avant la troisième erreur | la série de la campagne | 1 à 2 min |
| **L'Ascension** | Mont | 8 questions qui durcissent, 6 bonnes | l'épreuve des sentiers | ~2 min |
| **La Course** | Dunes | 6 questions de 15 s, 4 bonnes à temps | le quiz du jour et son chronomètre | ~1 min 30 |
| **L'Énigme** | Ruines | 3 questions difficiles ou expertes, 2 bonnes | le palier de maître | ~1 min |
| **Le Siège** | Citadelle | 3 membres de la guilde réussissent chacun L'Ascension, en 24 h | — | — |
| **La Grande Épreuve** | Merveille, Cœur | 4 membres au moins, 40 bonnes à eux tous en 48 h, 5 chacun au moins | — | — |

Comme pour les sentiers, **la règle d'une épreuve ne change jamais** : ce sont
les questions qui durcissent avec le niveau de la tuile. « Six sur huit » se
retient en une phrase.

L'épreuve s'arrête à la faute de trop — quand il ne reste plus assez de
questions pour passer —, comme une épreuve des sentiers. Quitter compte comme
un échec : sinon, on fermerait l'application à la deuxième erreur.

### 4.2 Le niveau d'une tuile

**Niveau = danger + garnison + soutien**, de 1 à 9 :

- le danger, de 1 à 5 (§ 2.3) ;
- la garnison, de 0 à 3 étoiles (§ 6.5), pour une tuile tenue ;
- le soutien : un de plus si quatre de ses six voisines sont au même maître
  (ou à la même guilde). Le cœur d'un empire est plus dur que sa frontière.

| Niveau | Les questions | Niveau | Les questions |
|---|---|---|---|
| 1 | faciles | 6 | moyennes et difficiles |
| 2 | faciles, une moyenne sur quatre | 7 | difficiles |
| 3 | faciles et moyennes | 8 | difficiles, une experte sur quatre |
| 4 | moyennes | 9 | difficiles et expertes |
| 5 | moyennes, une difficile sur quatre | | |

Le niveau d'une question est celui de la campagne (`niveauDeQuestion` : sa
difficulté estimée, lissée par les réponses). **Pas d'experte sous le niveau
8** : moins d'un joueur sur cinq les trouve, et il n'y en a que 21 à 49 par
catégorie (§ 11.10). Dans L'Ascension, le niveau monte d'un cran toutes les
trois questions.

### 4.3 La catégorie

Celle de la province. Le Cœur et les merveilles mélangent toutes les
catégories, un sous-thème chacun avant d'en reprendre un — la règle des paliers
9 à 12 des sentiers.

### 4.4 La performance

Pour comparer deux épreuves, un assaut et sa défense (§ 6.3) : **le nombre de
bonnes réponses** ; dans La Course, **les points** du quiz du jour (100 par
bonne réponse, jusqu'à 100 de plus pour la vitesse, `pointsDuChoix`). À
égalité, le défenseur garde sa terre.

### 4.5 Le chronomètre, pour La Course seulement

Le propriétaire a choisi « pas d'anti-triche » et une campagne sans
chronomètre ; la Conquête suit. Seules les dunes sont chronométrées : c'est
leur nature, pas une police. Le chronomètre est celui du quiz du jour — l'heure
à laquelle le serveur sert la question (`servie_le`), une marge (`GRACE_MS`),
la réponse jugée à son arrivée. Si la triche devenait un sujet entre amis, le
même chronomètre s'étendrait aux assauts (§ 13, n° 6).

### 4.6 Les questions

- Elles viennent de **la base de la campagne** (5 012 questions, étiquetées,
  relues), jamais de la réserve du quiz du jour, qui reste à part.
- **Jamais vues d'abord**, tous modes confondus : une question vue en campagne
  attend son tour.
- Une question **se signale** après sa réponse et se relit à
  `/admin#campagne`, comme en campagne.
- **La correction d'un assaut attend la fin du siège** : elle soufflerait les
  réponses au défenseur. Le défi de la semaine fait de même.

---

## 5. L'Oubli : l'adversaire de tous

Les Terres commencent **sous la brume**. Tout le monde avance d'abord contre
elle, et c'est ce qui rend le jeu jouable à huit.

- **Ce qu'il est** : le maître de toute tuile que personne ne tient. Une brume
  teintée de sa province, plus sombre vers le Cœur. Le repousser, c'est
  réussir l'épreuve de la tuile à son niveau.
- **Il reprend les absents.** Qui ne joue plus depuis cinq jours perd une tuile
  par nuit, par les bords, jusqu'à sa capitale. Les terres d'un absent ne
  restent pas figées : elles redeviennent à prendre. Celui qui revient garde ce
  qui reste.
- **Pas d'entretien.** Aucune tuile ne s'use tant qu'on joue : l'Oubli punit
  l'absence, jamais l'emploi du temps. Un jeu où il faut arroser ses tuiles
  chaque jour devient une corvée.
- **Plus tard, la Marée** (§ 15) : un soir, la brume monte sur une province et
  menace ses tuiles les plus riches, que chacun défend comme un siège. Un
  adversaire qui frappe les plus grands, jamais les plus faibles.

---

## 6. La guerre

### 6.1 Quand

À partir du **8 du mois**, après l'Éveil (§ 8.4). Avant, personne n'attaque
personne : chacun a le temps de débarquer et de s'étendre.

### 6.2 L'assaut

- Deux étendards ; une tuile d'un voisin qui **touche** ses terres (ou celles
  de sa guilde).
- On joue l'épreuve de la tuile, à son niveau.
- **Réussi**, l'étendard est planté : la tuile est **assiégée** jusqu'à
  **minuit le lendemain**. **Raté**, elle reste à son maître, et l'assaillant y
  retourne demain.

### 6.3 Repousser

- **Gratuit**, toujours : être attaqué ne doit rien coûter.
- Le maître, ou **n'importe quel membre de sa guilde**, rejoue la même épreuve
  au même niveau et doit faire **au moins aussi bien** que l'assaillant
  (§ 4.4). Une tentative par défenseur.
- Réussi, le siège est levé : la garnison gagne une étoile, et l'assaillant ne
  peut plus assiéger cette tuile pendant 48 heures.
- C'est **un duel en différé** : « Léa a fait 6 sur 8 : fais au moins autant. »
  La phrase dit tout.

### 6.4 La chute

À minuit le lendemain de l'assaut — à la première demande qui suit, puisque
rien ne tourne la nuit —, une tuile que personne n'a défendue change de
maître : garnison à zéro, et **24 heures de trêve** pendant lesquelles personne
ne la reprend.

**Un jour plein pour répondre** : un assaut posé à 23 h tombe le surlendemain
à minuit, pas six heures plus tard. Personne ne perd sa terre pendant son
sommeil.

### 6.5 La garnison

- De 0 à 3 étoiles, chacune un niveau de plus pour qui assiège.
- **Fortifier** : un étendard, et réussir l'épreuve de la tuile à son niveau
  du moment.
- Une défense réussie ajoute une étoile ; une tuile qui change de mains repart
  de zéro.
- Trois étoiles au plus : un empire ne devient jamais imprenable.

### 6.6 Les protections

| Protection | Durée | Pourquoi |
|---|---|---|
| L'Éveil | du 1er au 7 | le temps de débarquer et de s'étendre |
| Le bouclier du débarquement | 48 h, ou jusqu'à son premier assaut | arriver en cours de mois (§ 8.6) |
| La trêve | 24 h après un changement de mains | pas de ping-pong |
| Un siège à la fois | par tuile | la défense reste lisible |
| Deux sièges ouverts au plus | par assaillant | pas de rafale sur un voisin absent |
| Un jour plein | entre l'assaut et la chute | on se défend le soir, pas à trois heures du matin |

### 6.7 Le code d'honneur

**On n'assiège pas qui pèse moins du tiers de soi** (sa guilde comptée, en
tuiles), sauf s'il vous a assiégés dans les trois derniers jours. La grande
guilde ne dévore pas le joueur seul qui vient d'arriver ; la revanche reste
permise. La feuille de la tuile le dit : « Code d'honneur : Jeanne pèse moins
du tiers de ta guilde. On ne l'assiège que si elle vous a attaqués. »

### 6.8 L'exemple de la maquette

Léa, seule, tient onze tuiles des océans ; Les Lanternes en tiennent
vingt-neuf. Le code d'honneur la laisse passer (onze fois trois, trente-trois,
pèse plus que vingt-neuf). Elle assiège la Crête des Lynx et fait 6 sur 8 à
L'Ascension. Le bandeau rouge s'allume chez les trois Lanternes. Le premier
qui fait au moins 6 sur 8 avant minuit demain lève le siège, et la crête gagne
une étoile.

---

## 7. Les guildes

### 7.1 Ce qu'est une guilde

- **De deux à six membres**, un chef ou une cheffe. Avec une vingtaine de
  joueurs : trois ou quatre guildes, et des joueurs seuls.
- **Elle dure** : la guilde survit au mois ; ses terres, non.
- **Une guilde, un territoire** : les tuiles de ses membres prennent sa
  couleur. Chacun avance depuis les terres de tous, et défend celles de tous.

### 7.2 Créer, rejoindre, quitter

- **Créer** : un nom (24 caractères, coupés par `tronquer`), une devise choisie
  dans une liste (§ 7.8), une bannière (§ 7.7).
- **Rejoindre** : par un code à six chiffres que le chef fait paraître, valable
  sept jours, ses essais manqués comptés — la mécanique des codes de partage
  (`core/partages.ts`).
- **Quitter** : à tout moment. On ne rejoint pas une autre guilde avant trois
  jours, et **personne ne change de camp au Crépuscule**. Ses tuiles le
  suivent.
- Le chef exclut, transmet son rôle, dissout. Une guilde sans membre se dissout
  seule.

### 7.3 Les citadelles

- Une par province, à mi-chemin du Cœur ; 150 ✦ par nuit.
- **Le Siège** : un membre l'ouvre (un étendard, une Ascension) ; deux autres
  doivent réussir la leur dans les 24 heures. Trois cases, sur la carte et dans
  l'onglet de la guilde.
- Une citadelle tenue se reprend par un siège de même forme, que sa guilde peut
  repousser comme une tuile.

### 7.4 Les merveilles et le Cœur

- Six merveilles à la lisière du Cœur (300 ✦ par nuit) ; le Cœur des Terres au
  centre (500 ✦), qui ne s'ouvre qu'au Crépuscule.
- **La Grande Épreuve** : quatre membres au moins, quarante bonnes réponses à
  eux tous en 48 heures — des épreuves de huit questions difficiles, un
  étendard chacune —, cinq au moins par membre. Une jauge que les autres
  guildes voient monter : c'est la course.
- Une merveille tenue se reprend en faisant **mieux** que la guilde qui la
  tient.
- Tenue le dernier soir du mois, elle donne **sa relique** à chacun de ses
  membres (§ 9.4).

### 7.5 Des signaux, pas de discussion

Une discussion libre demanderait une modération que l'application n'a pas, et
les amis ont déjà leur groupe de messages. La guilde a **des signaux tout
faits**, posés sur une tuile et effacés à minuit : ⚔️ « On vise celle-ci »,
🛡️ « À défendre », 👁️ « À surveiller », 🏰 « Siège ce soir ». Trois à la fois.

### 7.6 Les joueurs seuls

On joue seul sans être de seconde zone :

- le classement des joueurs et les couronnes des provinces (§ 9.2) ignorent les
  guildes ;
- seules les citadelles et les merveilles leur sont fermées ;
- le code d'honneur les protège des grandes guildes ;
- une option : **le panache**, l'influence d'un joueur seul comptée un quart de
  plus (§ 13, n° 5).

### 7.7 La bannière

L'emblème de la guilde est **un gonfanon**, pas un bouclier : les écussons de
savoir ont déjà la forme d'un blason (`Ecusson.tsx`), et on les confondrait.

- **Ses pièces** : une forme (gonfanon, flamme, queue d'aronde, carrée), une
  partition (plein, parti, coupé, tranché, écartelé, chevron, bande, fasce),
  deux émaux (les métaux, or et argent ; les couleurs, gueules, azur, sinople,
  sable, pourpre), et un meuble — un emoji d'avant Unicode 13 : 🏮 ⚓ 🦉 🗝️ 🌙
  ⭐ 🔥 🦁 🐺 🦅…
- **Le blasonnement s'écrit tout seul** : « Parti de sable et d'or, à la
  lanterne ». La règle des émaux — ni métal sur métal, ni couleur sur couleur —
  se respecte : c'est une application de quiz, on y apprend quelque chose.
- **Les pièces se gagnent** (§ 9.4) : le meuble de chaque province en y tenant
  dix tuiles un soir, les formes et les partitions par les hauts faits. La
  guilde compose avec les pièces de tous ses membres.
- Elle flotte sur la capitale de la guilde, dans son onglet, au classement et
  dans la Gazette.

### 7.8 Ce qui se modère

- **Le nom d'une guilde** est le seul texte libre que la Conquête ajoute, et
  tout le monde le voit : 24 caractères ; l'administrateur le renomme ou
  dissout la guilde (`/admin#conquete`) ; les profils masqués du quiz du jour
  (`jour_masques`) le sont ici aussi.
- **La devise** se choisit dans une liste d'une quarantaine (« Nous portons la
  lumière », « Toutes voiles dehors », « Plus haut, plus loin »…) : rien à
  modérer.

---

## 8. Les mois : faut-il remettre à zéro ?

### 8.1 La réponse : oui, chaque mois

Chaque mois est **une Conquête** : la Conquête d'octobre, la Conquête de
novembre. Le 1er, les Terres renaissent d'une graine neuve.

| Ce qui repart de zéro | Ce qui reste |
|---|---|
| les Terres et leur forme | ce qui se gagne : confettis, titres, reliques, hauts faits, paliers, pièces de bannière, légendaires, thème, fond, gerbe |
| les maîtres, les garnisons, les sièges | les guildes et leurs membres |
| l'influence du mois | la carrière : tuiles prises, sièges repoussés, mois dans le premier quart |
| les étendards (chaque nuit, de toute façon) | Les Annales : les Terres de chaque mois, telles qu'elles étaient le dernier soir |

### 8.2 Pourquoi

1. **La boule de neige.** Dans un monde qui ne finit pas, le premier et le plus
   assidu prennent tout, et le suivant n'a plus de place. À vingt joueurs, une
   seule guilde dominante tue le jeu en deux mois.
2. **Les absents.** Un monde permanent se remplit d'empires abandonnés.
3. **Un début, un milieu, une fin.** Un mois a son Éveil, sa Mêlée et son
   Crépuscule. Un monde sans fin n'a jamais de dernier soir, ni de podium.
4. **La nouveauté.** Une graine neuve, c'est une géographie neuve : la forêt
   borde la brigade, le Grand Phare change de voisins.
5. **Le code.** L'état d'un mois est petit et borné ; une erreur de règle ne
   dure qu'un mois ; l'équilibre se règle entre deux Conquêtes.
6. **Les rythmes de l'application.** Le mois y est déjà une unité : le champion
   du mois, le calendrier des Heures, Le Mois complet.

### 8.3 Les autres réponses, pesées

| Réponse | Pour | Contre |
|---|---|---|
| **Un monde permanent** | on bâtit pour toujours | boule de neige, empires abandonnés, pas de fin ; la remise à zéro finit par venir, plus tard et plus mal |
| **Une marée** (chaque mois, une part de chaque empire retourne à l'Oubli) | rien ne disparaît d'un coup | moins lisible ; les grands restent grands ; pas de dernier soir |
| **Deux semaines** | plus de finales | trop court pour les guildes et les merveilles : 70 étendards par joueur |
| **Trois mois** | de grandes guerres | la fin est trop loin, et arriver en cours de route décourage |

### 8.4 Les trois temps du mois

| Temps | Dates | Ce qui s'y passe |
|---|---|---|
| **L'Éveil** | du 1er au 7 | on débarque, on reprend à l'Oubli ; aucune guerre ; les guildes se forment ; les citadelles s'ouvrent le 4 |
| **La Mêlée** | du 8 à la veille du Crépuscule | la guerre ; les merveilles s'ouvrent le 10 |
| **Le Crépuscule** | les trois derniers jours | l'influence compte double ; les guildes ne bougent plus ; le Cœur s'ouvre |

### 8.5 La clôture, et Les Annales

- **Rien ne tourne le 1er à minuit** : la première demande du mois clôt la
  Conquête d'avant, comme `cloreLesMois` et `cloreLesDefis` — sous un verrou,
  **les récompenses d'abord, le drapeau ensuite**, l'ordre de `cloreLeMois` et
  de `cloreLeDefi`.
- Chaque récompense se range par `ranger`, sans doublon, sous
  `#conquete:2026-10`.
- **Les Annales** : les Terres du dernier soir, figées, se relisent — « Où
  étais-tu en octobre ? ». Une page de plus au profil, « Mes Conquêtes », et une
  ligne sur la carte d'un joueur.

### 8.6 Arriver en cours de mois

- On **débarque** quand on veut, sur une tuile libre de la côte, dans la
  province de son choix. La Conquête propose celles de ses meilleures
  catégories, d'après ses écussons.
- **Le bouclier** : 48 heures sans pouvoir être assiégé, ou jusqu'à son premier
  assaut.
- Plus de côte libre ? **La mer se retire** à minuit (§ 2.5).
- Arriver le 20 ne fait pas gagner le mois, mais une couronne de province reste
  à portée (§ 9.2).

### 8.7 Le mot : « la Conquête d'octobre », pas « la saison »

« Saison » a déjà trois sens dans le code : les légendaires de saison
(Halloween, Noël, le Nouvel An, `shared/saisons.ts`, et leurs clés `saison:`),
les thèmes de saison de la boutique, une famille d'étiquettes de questions. On
écrit donc **la Conquête d'octobre**, et dans le code `conquete:2026-10`.

---

## 9. L'influence, et ce qu'elle rapporte

### 9.1 L'influence

- Chaque nuit, chaque tuile verse **son tribut** à son maître : 10, 20, 30, 50
  ou 80 ✦ selon son danger ; les ruines, 20 de plus ; une citadelle 150, une
  merveille 300, le Cœur 500. Au Crépuscule, tout compte double.
- L'influence du mois est **la somme des tributs** : tenir longtemps compte plus
  que finir gros, et un coup de force au dernier soir ne vole pas le mois.
- Elle **se dérive du journal** — le maître de chaque tuile à chaque minuit.
  Personne ne la tient à la main (invariants 14 et 20).
- Une tuile assiégée paie encore son maître, jusqu'à sa chute.

### 9.2 Les classements

- **Les joueurs** : l'influence de leurs propres tuiles.
- **Les guildes** : celle de leurs membres, tant qu'ils en sont.
- **Les provinces** : dans chacune, qui y a amassé le plus. Douze couronnes par
  mois : le spécialiste de cuisine peut ceindre celle de la brigade sans viser
  le podium. C'est l'échelle de la variété (RECOMPENSES.md, § 2) : tout le
  monde a quelque chose à chasser.
- Les ex æquo passent par `shared/classement.ts` (invariant 15).

### 9.3 Trois échelles, comme le reste

| Échelle | Quand | Quoi |
|---|---|---|
| **Chaque réponse** | tout de suite | un confetti par bonne réponse, son expérience, l'écusson de sa catégorie — comme en campagne |
| **Le mois** | à sa clôture | des confettis, des titres datés, la marque du sceptre, les reliques |
| **La durée** | quand ça tombe | hauts faits, paliers de carrière, pièces de bannière, légendaires, un thème, un fond, une gerbe |

### 9.4 Ce qui se gagne

**À chaque réponse**, sans rien construire (§ 11.2) :

- 🎊 un confetti par bonne réponse ;
- l'expérience de la campagne : 5 par bonne réponse, 10 pour les vingt
  premières de la journée, **tous modes confondus** — la Conquête ne fait pas
  exploser le barème du solo ;
- l'écusson de savoir de sa catégorie, et sa précision.

**À la fin du mois**, des montants à valider (§ 13, n° 8) :

| Qui | Quoi |
|---|---|
| quiconque tient une tuile le dernier soir | 🎊 30 |
| la moitié haute du classement | 🎊 30 de plus |
| le podium | 🎊 200 · 120 · 80 ; au premier, le titre « Le Sceptre d'octobre 2026 » |
| chaque couronne de province | 🎊 50, et le titre « La Couronne de la forêt · octobre 2026 » |
| la guilde première | 🎊 60 par membre, et la bannière d'or tout le mois suivant |
| chaque merveille tenue | 🎊 40 par membre, et **sa relique** |

Pour la mesure : un thème commun coûte 150 confettis, une vie 25, un sablier
50 ; qui fait le quiz du jour et un quart d'heure de campagne par jour en gagne
autour d'un millier par mois. Le podium vaut un thème ; une couronne, deux
vies. **Ce serait la première récompense en confettis** : aujourd'hui, ils ne
viennent que des bonnes réponses. À décider (§ 13, n° 8).

**Des titres qui se portent sans genre.** Le Sceptre, la Couronne, la
Bannière : des objets, que chacune et chacun porte tel quel — là où « Champion
d'octobre » s'écrit au masculin pour tout le monde (un point resté ouvert,
`retours/2026-09-24/experts/mots.md`).

**Sur la durée** :

- **Des hauts faits de conquête**, rangés sous le mois et payés dans la ligne
  des paliers, comme ceux du jour et de la campagne :

  | Haut fait | Ton | Comment |
  |---|---|---|
  | 🚩 Le Premier Pas | éclat | prendre sa première tuile d'un mois |
  | 🧭 Le Cartographe | éclat | tenir dans le mois une tuile dans chacune des douze provinces |
  | 🛡️ Le Rempart | éclat | repousser trois sièges dans le mois |
  | 🐏 Le Bélier | éclat | faire tomber une citadelle avec sa guilde |
  | 🏛️ La Relique | éclat | tenir une merveille le dernier soir |
  | 🌟 Le Cœur des Terres | éclat | tenir le Cœur le dernier soir |
  | 🏰 L'Inexpugnable | éclat | finir le mois sans avoir perdu une tuile, avec dix au moins |
  | 🔁 Le Revenant | éclat | reprendre une tuile qu'on vous avait prise |
  | 🃏 Le Château de cartes | ombre | perdre cinq tuiles en une nuit |
  | 📷 Le Touriste | ombre | débarquer, et ne rien prendre d'autre de tout le mois |
  | 🌧️ Waterloo | ombre | rater trois assauts d'affilée |

- **Trois paliers de carrière** (bronze, argent, or) : **Le Conquérant** (50,
  250, 1 000 tuiles prises), **Le Gardien** (10, 50, 150 sièges repoussés),
  **Le Stratège** (1, 5, 12 mois finis dans le premier quart).
- **Six reliques**, une par merveille, à collectionner de mois en mois : le
  Rouleau d'Alexandrie, la Tessère du Colisée, la Graine des Jardins, la Torche
  du Colosse, la Lentille du Phare, le Fil d'Ariane. **Les six ouvrent un thème
  qu'aucune boutique ne vend**, **La Mappemonde** — le parchemin, la rose des
  vents, les monstres marins dans les marges —, comme les douze pages ouvrent
  les Très Riches Heures.
- **Un fond de carte**, **Le Portulan**, au premier Sceptre.
- **Une gerbe**, **Les Étendards** — de petits drapeaux —, à Le Conquérant ·
  Argent.
- **Deux légendaires**, peints comme les autres : **La Tarasque** (Le
  Conquérant · Or) et **Le Cerbère** (Le Gardien · Or). Et des voies de plus
  vers des légendaires qui existent — le Dragon d'Or par le Cœur des Terres, le
  Lion Couronné par trois Sceptres. Une voie de plus ne reprend rien à personne
  (invariant 22).
- **Les pièces de bannière** (§ 7.7).

### 9.5 La marque du sceptre

Le premier du mois porte **le sceptre** tout le mois suivant : sur sa carte de
joueur, dans la Conquête et à son classement, comme le champion du mois. **Pas
en soirée** (§ 13, n° 11) : le laurier y suffit, et la salle n'a pas à savoir
qui gagne une guerre où elle ne joue pas.

### 9.6 Ce qui ne rapporte jamais

- **Aucun avantage en soirée** (invariant 8) : ni point, ni seconde, ni rien de
  ce qui se joue devant la salle.
- **Rien à l'anonyme.** L'accueil sans profil reste « Jouer sans compte », « Me
  connecter », « Créer un profil » : la Conquête n'y paraît pas.
- **Rien ne se reporte d'un mois sur l'autre, sauf ce qui se porte** : on ne
  commence pas la Conquête de novembre avec plus d'étendards pour avoir gagné
  celle d'octobre.

---

## 10. Les écrans

La maquette (`maquettes/la-conquete.html`) les montre presque tous.

### 10.1 L'accueil

Un gros bouton de plus sous « Seul », après la campagne (`AccueilJouer`,
`GrosBouton`). Ce qu'il dit change avec la journée :

- « La Conquête · Débarque sur les Terres d'octobre », tant qu'on n'a pas
  débarqué ;
- « La Conquête · 3 étendards · Léa assiège ta Crête des Lynx », et la pastille
  « À défendre » ;
- « La Conquête · Plus d'étendards : ils reviennent à minuit ».

Son lien s'écrit en dur (`'/conquete'`) : importer une constante de la page
tirerait toute la page dans le paquet de l'accueil (`AccueilDesRoles.tsx`).

### 10.2 La page `/conquete`

Comme la campagne : « ← Accueil » en haut à gauche, pas de barre du menu
(`menu.test.ts`), une rangée d'onglets en pilules.

- **L'en-tête** : « La Conquête », la pastille du temps (« La Mêlée · J−12 »,
  qui ouvre le mois et ce qu'il rapporte), et « ? », les règles.
- **Le bandeau** : les cinq étendards (le drapeau au trait de l'application,
  plein ou vide), l'influence du mois, le rang, ce que la nuit versera.
- **Les onglets** : Les Terres · Guilde · Classement · Gazette (une pastille
  rouge compte ce qui te concerne).

### 10.3 Les Terres

- La carte en SVG, qu'on glisse et qu'on pince. De loin, les provinces et leurs
  noms ; de près, les terrains, les capitales et les avatars de leurs maîtres.
- **Ses terres** cernées de clair, **ce qui est à portée** en pointillé d'or,
  l'Oubli en brume teintée de sa province, une tuile assiégée rayée de la
  couleur de l'assaillant et qui bat, le siège d'une citadelle cerclé de sa
  jauge.
- **Le bandeau rouge** quand on est assiégé ; il mène à la tuile.
- En bas : « Mes terres », « Tout », « Liste », − et +.

### 10.4 La feuille d'une tuile

Elle monte du bas (`Feuille`, `Pieces.tsx`) et s'ouvre **courte** — le nom, la
province, ce qui s'y passe en une phrase, le geste — pour laisser voir la tuile
au-dessus. Le détail (danger, garnison, tribut, l'épreuve et son niveau) se
déplie. Un seul bouton — Conquérir, Fortifier, Assiéger, Repousser, Rejoindre
le siège —, ou à sa place **ce qui l'empêche** : « Trop loin : à 3 tuiles des
terres de ta guilde », « Sous trêve jusqu'à 21 h », « Code d'honneur… », « Plus
d'étendards : ils reviennent à minuit ».

### 10.5 L'épreuve

L'écran des épreuves des sentiers (`EcranDEpreuve`) : l'enjeu en tête (la
tuile, « au moins 6 bonnes réponses sur 8 »), les cases et la ligne d'or du
seuil — ou les trois cœurs de La Traque, ou la barre du chronomètre de La
Course —, la question, les quatre réponses et leurs formes. À la fin :
l'étendard planté, ou la brume ; ce que ça rapporte ; « Revenir aux Terres ».
Sur la carte, une onde d'or autour de la tuile prise.

### 10.6 La guilde, le classement, la Gazette

- **Guilde** : la bannière et son blasonnement, ses chiffres, le siège en cours
  et sa jauge, les membres, les signaux, le code pour recruter.
- **Classement** : Joueurs · Guildes · Provinces.
- **La Gazette des Terres** : le tribut de la nuit, puis les nouvelles —
  d'abord celles qui te regardent (« Léa assiège ta Crête des Lynx »), puis
  celles des Terres (« Les Corsaires tiennent le Grand Phare depuis quatre
  jours », « L'Oubli a repris deux tuiles de Marc »). C'est le journal raconté,
  sans rien de plus à stocker.

### 10.7 Le premier jour

« Choisis ta côte » : les Terres de loin, les côtes libres en pointillé, et la
suggestion de ses meilleures catégories. Les règles en six lignes, dépliées
jusqu'à sa troisième prise, puis rangées sous « Comment ça marche ? », comme
celles des sentiers. La première tuile se prend par une Escarmouche.

### 10.8 Pour tout le monde

- **La liste « À ta portée »** : ce qui touche ses terres, des tuiles les plus
  sûres aux plus dangereuses, en gros boutons — la carte en liste, pour le
  lecteur d'écran et pour qui voit mal les petites tuiles.
- **Jamais la couleur seule** : un maître a sa couleur *et* sa frontière,
  l'assaut ses rayures et ses épées, le siège sa jauge. La joueuse daltonienne
  de la tablée lit la carte.
- **Le mouvement réduit** arrête la pulsation, l'onde et les glissements.
- Rien sous 11 px (`--t-label`), les contrôles à 44 px.
- La page vient à la demande : ni l'accueil anonyme ni l'entrée d'une soirée ne
  la téléchargent (`medaillons.test.ts`).

### 10.9 Les textes, une première main

- Notification : « Léa assiège ta Crête des Lynx. Fais au moins 6 sur 8 avant
  minuit demain pour la garder. »
- Échec : « L'Oubli tient bon. Ton étendard est tombé ; tu y retournes
  demain. »
- Clôture, dans la Gazette : « La Conquête d'octobre est close. Tu finis 4ᵉ,
  avec 2 310 ✦ — et la Couronne de la forêt est à toi. »

---

## 11. Faisable ?

### 11.1 Le verdict

**Oui, sans dépendance nouvelle ni service payant.** Le cœur — une épreuve de
quiz jouée au serveur, comptée en confettis, en expérience et en écussons —
existe : c'est une série de la campagne d'un mode de plus, comme les épreuves
des sentiers. Le neuf, c'est de la géométrie, un journal et un écran. La
taille, elle, est réelle : trois à quatre lots comme celui des sentiers. D'où
un chemin où le deuxième lot se joue déjà (§ 12).

### 11.2 Ce qui existe déjà

| Il faut | Ça existe | Où |
|---|---|---|
| des questions par catégorie et par difficulté | la base de la campagne : 5 012 questions étiquetées, leur difficulté mesurée | `core/baseCampagne.ts`, `niveauDeQuestion` |
| tirer une épreuve d'un mélange | `tirerUneEpreuve`, exportée : le mélange, les sous-thèmes, jamais vues d'abord, les emprunts | `core/campagne.ts` |
| jouer une épreuve au serveur | les séries et leurs modes (`serie`, `sentier`, `defi`), le verrou du profil | `core/campagne.ts`, `campagne_series` |
| les confettis, l'expérience, les écussons | comptés sur toutes les séries, sans filtre de mode | `justesDe`, `lectureDesJustes`, `savoirDe` |
| un chronomètre tenu par le serveur | `servie_le`, `GRACE_MS` | `core/jour.ts`, `games/quiz.ts` |
| un budget du jour lu dans un journal | `viesDe` | `shared/sentiers.ts` |
| un tirage fait une fois pour tous | `tirageDuDefi` | `core/campagne.ts` |
| une clôture à la première demande | `cloreLesDefis`, `cloreLesMois` | `core/campagne.ts`, `core/jour.ts` |
| ranger une récompense sans doublon | `ranger`, les conteneurs `#jour:`, `#mois:`, `#defi:` | `auth/profiles.ts` |
| un titre daté | `mois:2026-10`, `titreDuChampion` | `shared/jour.ts` |
| un thème qui se gagne | `gagne: { cle }`, `themeGagne` | `shared/themes.ts` |
| une collection qui ouvre un thème | les pages des Heures | `shared/calendrier.ts` |
| un rang partagé | `classer` | `shared/classement.ts` |
| l'heure de Paris | `jourDe`, `moisDe`, `minutesAvantMinuit` | `shared/jour.ts` |
| une notification | le Web Push sans bibliothèque | `core/pousser.ts`, `core/rappels.ts` |
| masquer un profil d'un classement | `jour_masques` | `core/jour.ts` |
| un code court | les codes de partage | `core/partages.ts` |
| peindre | la chaîne des décors et des légendaires | `server/scripts/anime/` |
| mesurer avant de figer | `calibrage-sentiers.ts` | `server/scripts/` |

### 11.3 Ce qu'il faut construire

- **`shared/conquete.ts`, pur** : la géométrie des hexagones ; le tirage des
  Terres d'une graine ; les règles (épreuves, niveaux, coûts, tributs) ; **le
  pli du journal** en un état (maîtres, garnisons, sièges, trêves) ;
  l'influence de chaque nuit ; les étendards du jour. Tout se teste sans
  serveur.
- **`core/conquete.ts`, `ConqueteStore`** : la Conquête du mois, tirée au
  premier venu et figée ; le journal, en mémoire et dans Turso ; les gestes,
  sous le verrou de la tuile et celui du profil ; la résolution de minuit à la
  lecture ; la clôture ; les guildes.
- **`server/src/conquete.ts`** : les routes (§ 11.4).
- **Dans la campagne** : le mode `conquete` ; des seuils paramétrés par le
  nombre de questions (ils en supposent seize) ; le chronomètre de La Course.
- **Côté client** : `views/ConqueteApp.tsx`, la carte en SVG, la feuille,
  l'épreuve (celle des sentiers), la guilde, le classement, la Gazette ; le
  bouton de l'accueil.
- **Dans les profils** : l'origine `conquete` des hauts faits, le conteneur
  `#conquete:AAAA-MM`, les titres datés, le sceptre, les reliques, la bannière,
  une ligne de « Ma collection ».
- **`/admin#conquete`**, `calibrage-conquete.ts`, `rendu-conquete.ts`, et les
  tests.

### 11.4 Les données

```
conquete_mondes   mois (PK, 'AAAA-MM'), graine, rayon, regles (JSON, figées), tire_le, clos_le
conquete_journal  id, mois, tuile ('q,r'), geste, profil, guilde, serie_id, quand, details (JSON) — en ajout seul
guildes           id, nom, banniere (JSON), devise, creee_le, dissoute_le
guilde_membres    guilde, profil, role, depuis, jusqua — l'histoire, pas seulement l'état
campagne_series   + tuile, + geste, + servie_le — mode 'conquete'
profile_badges    sous '#conquete:AAAA-MM' : hauts faits, couronnes, reliques
```

- **L'état des Terres est le pli du journal.** À une vingtaine de joueurs, trois
  mille gestes par mois : quelques millisecondes à relire au démarrage. Il vit
  en mémoire, comme les tirages du jour.
- Les gestes : `debarquement`, `prise`, `echec`, `assaut`, `defense`, `chute`,
  `fortification`, `oubli`, `siege`, `grande-epreuve`, `retrait` (la mer).
- **Les routes** : `GET /api/conquete` (les Terres en tableaux compacts, et son
  état : étendards, influence, sièges — sous un ETag de révision) ;
  `POST /api/conquete/geste` `{ tuile, geste }`, qui rend une épreuve ;
  `POST /api/conquete/epreuve/:id/reponse` ; `GET /api/conquete/gazette` et
  `/classement` ; `/api/conquete/guilde…` ; `/api/admin/conquete`.

### 11.5 Le temps : tout se décide à minuit, à la première demande

Rien ne tourne la nuit : le service dort de minuit à 7 h. À la première demande
après minuit, sous un verrou, la Conquête rattrape ce qui est échu, **dans
l'ordre des échéances** — les sièges qui tombent, l'Oubli chez les absents, le
tribut (une simple lecture du journal), les étendards rendus ; et le 1er, la
clôture du mois. Comme `clorePasses`. L'horloge est celle qu'on injecte
(`horlogeDuJour`) : les tests font passer minuit, et le premier du mois.

### 11.6 La charge

- **La carte** : 331 tuiles, six champs chacune — une dizaine de Ko de JSON,
  trois une fois compressés, servis de la mémoire.
- **Le rafraîchissement** : à l'ouverture, au retour sur l'onglet, et toutes les
  soixante secondes tant qu'on regarde, sous un ETag de révision (`no-cache`,
  pas le `no-store` du reste de l'API) : un 304 tant que rien n'a bougé. Pas de
  liaison temps réel : rien ne change assez vite pour la payer.
- **Turso** : un geste coûte ce que coûte une série de la campagne — deux
  allers-retours au plus par bonne réponse (`campagne-charge.test.ts`) —, plus
  l'écriture du journal à la fin de l'épreuve.
- **Le rendu** : quelques centaines d'hexagones en SVG, une transformation par
  geste, ni filtre ni ombre ; de loin, les icônes et les pointillés
  disparaissent. La maquette tient au téléphone.

### 11.7 Les pièges repérés dans le code

1. **Un mode inconnu se relit comme une série** (`versSerie`,
   `core/campagne.ts`) : une ligne `conquete` serait acceptée par `repondre`
   comme une série à trois vies. Le mode se déclare avant tout.
2. **Seize questions en dur** dans `issueDe`, `epreuveFinie` et `etoilesDe`
   (`shared/sentiers.ts`) : à paramétrer.
3. **L'expérience de la campagne se réécrit en entier** depuis le journal
   (`experienceLue`) : un bonus propre à la Conquête est un haut fait (la ligne
   des paliers) ou se dérive là, sinon il s'efface. Une ligne d'expérience à
   part rejoindrait `LIGNES_A_PART`.
4. **Les hauts faits** : une origine de plus (`Origine`),
   `HAUTS_FAITS_HORS_SOIREE` (sinon ils ne paient rien), `PART_DES_JOUEURS`
   (`hautsfaits.test.ts`), `listesDesTrophees` (sinon la collection les
   ignore) ; aucune clé ne finit par `:1`, `:2` ou `:3`.
5. **La mesure des difficultés** relit toutes les réponses toutes les dix
   minutes (`mesures`, sans index sur `reserve_id`) : la Conquête la fait
   grossir. Et les réponses chronométrées de La Course n'ont pas à la fausser.
6. **Les mots déjà pris** : saison (§ 8.7), carte (la carte d'un joueur), fond
   de carte, atlas (`Atlas.tsx`), écusson, équipe, champion, série, défi,
   palier, sentier, maître ; Le Triomphe (un haut fait et un fond), L'Élite
   (un palier), Le Sommet (un thème). « Épreuve » se partage avec les
   sentiers : à l'écran, chaque épreuve de la Conquête porte son nom
   (L'Escarmouche, La Traque…). Libres : guilde, territoire, influence,
   conquête, les Terres, l'Oubli, étendard.
7. **`champion`** veut déjà dire « champion du mois du quiz du jour » dans
   l'instantané : le sceptre prend un champ à lui.
8. **Le bouton de l'accueil** est épinglé par `navigation.test.ts` et
   `campagne-ouverture.test.ts`.
9. **Un légendaire de plus touche aux Divins** : le vérifier dans
   `core/divins.ts`, sans en écrire une ligne ailleurs (invariant 21).
10. **Le rappel du soir a une étiquette fixe** (`tag: 'quiz-du-jour'`,
    `sw.js`) et une seule réservation par téléphone et par jour
    (`dernier_jour`) : une notification de siège prend sa propre étiquette, sa
    propre réservation et son propre consentement — la cloche ne promet que le
    rappel du quiz.
11. **Deux routes de la campagne lisent `Date.now()`** plutôt que l'horloge
    injectée (`server/src/campagne.ts`) : la Conquête lit la sienne partout, dès
    le premier jour.

### 11.8 Les invariants

| Invariant | Comment la Conquête le tient |
|---|---|
| 1 · le serveur décide | l'épreuve, le maître, la chute, l'influence : au serveur ; la bonne réponse n'arrive qu'après la sienne |
| 2 · deux bases | tout dans Turso, rien dans la base jetable |
| 3 · le cloisonnement | la Conquête n'appartient à aucun espace : comme le quiz du jour, elle est aux profils |
| 8 · ni avantage, ni marque pour l'anonyme | rien en soirée ; rien pour l'anonyme |
| 14 et 20 · des dérivations | l'état, l'influence et les récompenses se relisent du journal, sous une version (`VERSION_DES_CONQUETES`) |
| 15 · un classement | `shared/classement.ts` |
| 21 · les Divins | rien n'en sort |
| 22 · ne rien reprendre | une voie de plus vers un légendaire ; un titre, une relique gagnés restent |

### 11.9 Les risques

| Risque | Pourquoi | La parade |
|---|---|---|
| Trop peu de joueurs | une vingtaine au quiz du jour, la moitié ici | l'Oubli joue contre tous ; les Terres à la taille de la population ; douze couronnes ; des joueurs seuls qui comptent |
| La boule de neige | les premiers prennent tout | la remise à zéro ; cinq étendards ; l'Éveil sans guerre ; la garnison plafonnée ; le code d'honneur |
| La guerre qui dégoûte | perdre sa tuile en dormant | défense gratuite, un jour plein, les trêves, le code d'honneur ; rien de perdu au-delà du mois |
| La corvée | entretenir son empire | aucun entretien : seuls les absents de cinq jours perdent |
| La complexité | cinq épreuves, des sièges, des guildes | l'Escarmouche d'abord ; les règles dépliées jusqu'à la troisième prise ; « À ta portée » ; un bouton par feuille ; une Conquête zéro sans guerre ni guilde |
| Les questions qui s'épuisent | § 11.10 | les expertes au niveau 8 ; les emprunts ; la routine du matin |
| La triche | des épreuves sans chronomètre | le choix du propriétaire ; La Course ; le chronomètre des assauts, en réserve |
| Les noms de guilde | du texte libre que tout le monde voit | 24 caractères, l'administrateur, les masques ; la devise dans une liste |
| Le chantier | six lots | une Conquête zéro jouable dès le deuxième |

### 11.10 La réserve de questions

- **L'offre** : 5 012 questions, de 199 (Autour de la fête) à 481 (Géographie)
  par catégorie, dont **21 à 49 expertes** par catégorie. Elle grandit de 60
  par jour — cinq par catégorie, dix au plus — par la routine du matin.
- **La demande** : une vingtaine de joueurs × cinq étendards × six questions,
  soit **environ 600 questions par jour**, une cinquantaine par catégorie. Un
  joueur assidu en voit une trentaine par jour, surtout dans les deux à quatre
  catégories de ses provinces : une catégorie de 400 questions lui dure **un
  mois et demi** avant les redites, moins s'il joue aussi la campagne.
- **Donc** : les expertes au niveau 8 et plus, à l'Énigme et au Cœur
  seulement ; les emprunts au niveau voisin quand une marche manque
  (`EMPRUNTS`) ; **la routine monte à dix par catégorie** pour les plus
  courtes ; et les redites, quand elles viennent, touchent tout le monde
  pareil. `/admin#conquete` dira la part de questions déjà vues.

### 11.11 Comment on saura que c'est bon

- **Les tests** (`server/test/conquete-*.test.ts`), un serveur jetable chacun,
  l'horloge à la main : le tirage d'une graine est stable ; le pli du journal ;
  un siège qui tombe à minuit, un autre repoussé ; le code d'honneur ; les
  étendards rendus ; l'Oubli des absents ; une clôture qui ne paie qu'une
  fois, même relancée ; une ligne `conquete` refusée par `repondre`.
- **La simulation** (`calibrage-conquete.ts`), comme `calibrage-sentiers.ts` :
  des bandes de joueurs inventés — assidus et intermittents, seuls et en
  guilde — jouent des mois entiers sur le vrai code. On regarde le jour où les
  frontières se touchent, la part des Terres reprises, l'écart entre le
  premier et le dixième, combien de couronnes changent de tête, combien de
  sièges réussissent ; et on règle la taille, les étendards, les seuils et les
  tributs sur ces chiffres-là.
- **Le rendu** (`rendu-conquete.ts`) : la carte, une feuille, une épreuve, la
  guilde, en 360 × 640 et sur un écran de bureau.
- **Une tablée** : la grand-mère au petit téléphone prend-elle sa première
  tuile ?

---

## 12. Le chemin

| Lot | Ce qu'il contient | Ce qu'on peut faire ensuite | Taille |
|---|---|---|---|
| 0 | la maquette | la regarder, en discuter | fait |
| 1 · Les Terres | `shared/conquete.ts`, la Conquête du mois tirée et figée, le journal, le mode `conquete` des séries, la page en lecture seule | voir les Terres du mois | moyen |
| 2 · Conquérir | débarquer, conquérir, les étendards, l'influence, l'Oubli des absents, les classements des joueurs et des provinces, la clôture, les confettis et les titres datés | **la Conquête zéro** : un vrai mois, contre l'Oubli | comme les sentiers |
| 3 · La guerre | assiéger, repousser, la garnison, les trêves, le code d'honneur, la Gazette, la notification | la Mêlée | moyen |
| 4 · Les guildes | créer, rejoindre, le territoire commun, les citadelles, les merveilles, le Cœur, les signaux, le classement des guildes, la modération | les guildes | comme les sentiers |
| 5 · Ce qui se gagne | hauts faits et paliers, reliques, bannière, sceptre, Les Annales, « Ma collection » ; La Tarasque, Le Cerbère, La Mappemonde, Le Portulan, Les Étendards, peints | tout ce qui se porte | grand (la peinture) |
| 6 · Mesurer | `calibrage-conquete.ts`, `/admin#conquete`, `rendu-conquete.ts`, une tablée | régler | moyen |

La simulation du lot 6 se fait **avant** de figer les nombres du lot 2, et le
lot 2 peut se jouer un mois entier, entre amis, avant qu'on ouvre la guerre.

---

## 13. Les décisions à prendre ensemble

1. **Les noms** : la Conquête, les Terres du Savoir, l'Oubli, les étendards,
   l'influence. *Je recommande ceux-là.*
2. **La remise à zéro** : chaque mois *(recommandé)*, toutes les deux
   semaines, ou jamais (les marées).
3. **Les étendards** : cinq par jour, sans cumul *(recommandé)*. Et un sixième
   le jour où l'on a fini son quiz du jour ?
4. **La guerre** : dès le 8 *(recommandé)* ; le code d'honneur
   *(recommandé)* ; la défense gratuite *(recommandé)*.
5. **Les guildes** : de deux à six, citadelles à trois, merveilles à quatre
   *(recommandé)* ; des signaux, pas de discussion *(recommandé)*. Et le
   panache des joueurs seuls ?
6. **Le chronomètre** : à La Course seulement *(recommandé, fidèle à « pas
   d'anti-triche »)*, ou à tous les assauts.
7. **L'expérience** : celle de la campagne, quota partagé *(recommandé)*, ou
   une ligne à part.
8. **Les confettis du mois** : les montants du § 9.4 — la première récompense
   en confettis.
9. **Un second classement de tout le serveur** : à écrire dans le README, à
   côté du quiz du jour.
10. **Les notifications** : une par jour au plus, à part du rappel du soir, sur
    consentement *(recommandé)* ; ou aucune, et la Gazette suffit.
11. **Le sceptre en soirée** : non, sur la carte et dans la Conquête seulement
    *(recommandé)* ; ou à côté du laurier.
12. **Arriver en cours de mois** : le bouclier et la mer qui se retire
    *(recommandé)*.

---

## 14. Ce qu'il ne faut pas faire

- **Vendre des étendards, des garnisons ou du temps** contre des confettis : on
  achèterait la terre du voisin.
- **Faire entrer la Conquête dans les soirées** : ni point, ni avantage, ni
  rappel devant la salle (invariant 8).
- **Ouvrir une discussion** entre joueurs.
- **Faire tourner quoi que ce soit la nuit** : le service dort ; tout se résout
  à la lecture.
- **Notifier plus d'une fois par jour.**
- **Reprendre ce qui a été gagné** : un titre, une relique, une pièce de
  bannière restent, même si le mois se relit (invariant 22).
- **Tenir l'influence à la main** : elle se dérive du journal.
- **Montrer la Conquête à l'anonyme** : ni bouton, ni marque, ni « il te manque
  un profil ».

---

## 15. Plus tard

- **Les pactes** : deux guildes qui ne s'assiègent pas pendant sept jours, d'un
  commun accord, et la carte le montre.
- **Les bâtiments** : une tour de guet, un pont sur un lac, un phare qui fait
  traverser la mer.
- **Les événements** : la Comète (une tuile qui brille un jour et rapporte
  gros), la Marée (§ 5).
- **Les Terres à thème** : un mois où une province vaut double, un mois
  « années 80 ».
- **L'écran commun** : entre deux quiz d'une soirée, les Terres de ceux qui
  sont dans la salle — à regarder, sans rien changer au jeu.
- **L'étendard personnel** : l'héraldique du joueur seul.
- **Plusieurs Terres**, si la population passe la soixantaine.
