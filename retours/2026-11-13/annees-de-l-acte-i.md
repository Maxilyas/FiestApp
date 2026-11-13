# Les années de l'acte I du Filet : les faces que le juge fermait

Le 12 novembre 2026 au soir, le juge des faits a cessé de refuser une réponse chiffrée qu'une autre question de la base
écrit dans son intitulé : c'est une autre face du même fait, qui entre liée à sa sœur, et le tirage ne les pose jamais
ensemble (`server/src/core/faces.ts`, la décision « Deux faces d'un même fait entrent toutes deux, et c'est le tirage qui
les sépare »). Le propriétaire, le même soir : « enchaîne sur l'écriture des années de l'acte 1 du Filet ». Ce relevé dit
ce qui a été écrit, ce que le juge refusait encore, ce qui a été corrigé, et ce que ça donne au Filet.

## Le résultat

Valeurs distinctes posables à l'acte I en 2026, par catégorie (la mesure du relevé du 12 novembre, `categoriesDuFiletALAnnee` :
une valeur posée deux fois ne compte qu'une fois, la carte promet une catégorie à douze) :

| Catégorie | Le 12 au soir | Le 13 | Questions neuves rangées | dont « chaque Français » |
|---|---|---|---|---|
| Cinéma & séries | 21 | **45** | 25 | 24 |
| Histoire | 28 | **40** | 15 | 12 |
| Musique | 29 | **37** | 9 | 8 |
| Culture générale | 28 | 28 | — | — |
| Sport | 18 | **26** | 9 | 8 |
| Autour de la fête | 12 | **18** | 6 | 6 |
| Sciences | 14 | **16** | 2 | 2 |
| Géographie | 12 | 12 | — | — |
| Jeux & pop culture | 10 | **12** | 3 | 2 |
| Arts & lettres | 7 | 10 | 4 | 3 |
| Cuisine | 9 | 9 | — | — |
| Nature | 3 | 3 | — | — |
| **Total** | 191 | **256** | 73 | 65 |

- **25 est atteint dans cinq catégories** (trois la veille) : le Cinéma & séries, l'Histoire, la Musique, la Culture
  générale et le Sport. **Le seuil de 12 l'est dans neuf** : la carte promet désormais l'acte I au Jeux & pop culture, tout
  juste (12), comme la Géographie. Les Arts & lettres (10), la Cuisine (9) et la Nature (3) restent dessous : la liste du
  12 novembre n'y avait presque rien que chaque Français sache placer et que la base n'ait déjà.
- **Le contenu du Filet** (`server/content/cabinet/filet.json`) passe de 1 865 à 1 938 questions, de 1 671 à 1 741 avec un
  indice. Au contenu, 298 questions à l'acte I (233 la veille), 504 à l'acte II (435), 516 à l'acte III (512). Posables en
  2026 : 266, 426 et 481 questions (201, 357 et 477).
- **La base** passe de 28 721 à 28 794 questions, et **le juge des faits** reconnaît une face qu'il refusait encore (plus
  bas). Aucun barème n'est touché, ni le seuil, ni le classement.

## Les faits à écrire

La liste vient du classement du 12 novembre (`../2026-11-12/reproductions/acte-i/faits-candidats.json`) : 309 faits que
chaque Français sait placer et que la base fermait. Relus à l'état du jour, ôtés :

- ceux dont la question qui les bloquait est déjà au Filet sous la même valeur ;
- les valeurs déjà prises à l'acte I dans leur catégorie, ou deux fois dans la liste ;
- les vrais doublons — la sœur a pour réponse la valeur même (la majorité à 18 ans, les 50 États, les 12 étoiles du
  drapeau européen, un match de 90 minutes, les 24 Heures du Mans) — ;
- les jours du calendrier, les titres qui portent leur nombre (*Fahrenheit 451*, *Les 101 Dalmatiens*) ;
- les dates qui se disent de deux façons (la sortie de *Titanic* en France, en 1998, quand le film est de 1997), les
  valeurs arrondies (la distance de la Terre au Soleil) et ce que le Filet ne pose pas (la prise d'otages de Munich,
  « sensible ») ;

puis chaque fait rangé dans la catégorie que les règles de partage lui donnent (un événement daté en Histoire, un film en
Cinéma & séries, un manga en Arts & lettres, le Walkman et le TGV en Sciences) : **83 faits**, en neuf lots — Cinéma &
séries 26, Histoire 16, Musique 10, Sport 9, Autour de la fête 7, Jeux & pop culture 6, Arts & lettres 5, Sciences 4.
La Nature, la Cuisine et la Géographie n'en avaient aucun.

## Ce que le juge refusait encore : 22 faces sur 83

Neuf rédacteurs (`redacteur-campagne`), une consigne par lot (`base-campagne.ts consigne`, la section « CE LOT EN
PARTICULIER » de `../2026-11-12/reproductions/acte-i/consignes/particulier-faits.md`, et la phrase de la consigne commune sur
les faces) : 55 questions acceptées sur 83, **28 refusées comme redites**.

Six l'étaient vraiment : la base avait déjà la question de leur année, et elle était déjà au Filet — la mort de John Lennon
(1980), Google (1998), le premier TGV (1981), « J'accuse… ! » (1898), la majorité à 21 ans avant 1974, *Super Mario Bros.*
(1985). Le tri n'avait comparé que la question qui bloquait chaque fait le 12 novembre, une seule par fait : la question de
l'année, quand elle existait sous une autre formule, lui échappait.

Les 22 autres étaient des faces que le juge disait **retournées**. L'année d'un fait connu se demande en nommant ce fait, et
la question qui le pose déjà l'a souvent pour réponse : « En quelle année Neil Armstrong pose-t-il le pied sur la Lune ? »
quand la base demande « En juillet 1969, sur quel astre les astronautes d'Apollo 11 ont-ils posé le pied ? ». Chacune
écrit la réponse de l'autre, et elles parlent de la même chose : le juge les jugeait retournées — un doublon — avant de voir
que l'une avait pour réponse un nombre. Le défaut se voyait sur l'exemple même de la décision de la veille : « En quelle
année Delacroix peint-il *La Liberté guidant le peuple* ? » entrait, « En quelle année **Eugène** Delacroix… » se refusait.
Six rédacteurs de cinéma avaient contourné le refus en ôtant le réalisateur de l'intitulé ; les autres, à qui la consigne
interdit de contourner, avaient écarté le fait.

**Le juge est corrigé** (`lienEntre`, `server/src/core/memeFait.ts`) : une réponse chiffrée que l'autre écrit fait une face
même quand chacune écrit la réponse de l'autre, et même quand ce dont elles parlent porte le nombre dans son nom — Jesse Owens
« aux Jeux de Berlin » (1936) et la télévision des Jeux de 1936 (Berlin), toutes deux sur les « Jeux olympiques d'été de
1936 », que `chiffreeEcrite` écarte pour ne pas voir le même fait dans toute question sur ces Jeux. Les retournées sans
nombre restent des doublons (le dragon du drapeau du Bhoutan, Charlot et Charlie Chaplin) : `faces.test.ts`, rouge sans le
correctif. Les rédacteurs, relancés sur leurs seuls refus, ont tout écrit au naturel : **77 questions**.

## Ce que le recoupement et la relecture ont retiré

- **Une redite que le juge ne voit pas** : « En quelle année les premiers jeux Pokémon sont-ils sortis au Japon ? » (1996),
  quand la base a « … les premiers jeux Pokémon, Rouge et Vert, sont-ils sortis au Japon ? » (`r7idbz3r`, déjà au Filet). À
  même réponse chiffrée, le juge ne compare que les entités, et elles différaient (« Pokémon », « Pokémon Rouge et Vert »).
  Le recoupement à la main l'a trouvée — la même réponse et quatre mots de cinq lettres en commun —, comme les régions de
  2016 la veille.
- **Trois questions à deux années possibles**, retirées par les relecteurs (`relecteur-campagne`, trois fiches) : *Casablanca*
  (avant-première à New York en novembre 1942, sortie en janvier 1943, en 1947 en France), les départements (le décret du
  22 décembre 1789, la loi de 1790), « Les Guignols de l'info » (« Les Arènes de l'info » en 1988, le nom en 1990).
- **Onze corrections** : le pays de sortie dit quand la France a vu le film l'année suivante (*Titanic*, *Toy Story*, *Les
  Dents de la mer*, *Les Aristochats*), et sept anecdotes ou explications fausses — *La Grande Vadrouille* détrônée par
  *Titanic* en 1998, pas par les Ch'tis ; 36 mètres pour le premier vol des Wright, pas une centaine ; le troisième millénaire
  qui commence en 2001, pas avec les Jeux de Sydney ; *La Vie en rose* enregistrée en 1946 ; Disneyland Paris sous ce nom en
  1994 ; les premiers repas des Restos du cœur servis dès l'hiver 1985 ; *Hélène et les garçons*, commencée en mai 1992.

**73 questions rangées** (la base passe de 28 721 à 28 794), 72 liées à leurs sœurs — 241 liens, jusqu'à quinze pour une
seule question —, la seule sans sœur étant le seuil de la fièvre.

## Le classement, le panel et les indices

La chaîne de la veille, sans rien y changer (`../2026-11-12/reproductions/acte-i/`, `../2026-11-09/reproductions/indices/`) :

- **Le classement à l'aveugle** (un classeur, `classer.consigne.md` et vingt-huit exemples visibles de la passe de
  référence, douze étalons aveugles ; `lots-de-notation.mts`, `lire-le-classement.mts questions --verser`) : étalons 11 sur
  12 pour « chacun » — les six vrais retrouvés, un à tort —, l'ancrage et le calcul 12 sur 12. **65 des 73 questions sont
  « chaque Français »**, aucune ne se calcule. Les huit autres : Dragon Ball, *Les Aristochats*, la naissance de Lennon,
  l'Empire allemand, les Jeux de Séoul, Donkey Kong, Constantinople et le départ de Magellan.
- **Le panel** (passe 8, `lire-le-panel.mts 8 --verser`) : recalé sur dix-neuf des vingt étalons de la première passe — le
  vingtième n'est plus dans la base —, corrélation 0,93, le même acte pour 13 sur 19 une fois recalé. 70,4 en moyenne, 68 à
  50 et plus, 5 de 25 à 49. Il ne joue qu'aux actes II et III.
- **Les indices** (deux rédacteurs, `consigne-redacteur.md` ; le juge à la lettre, `verifier-un-lot.mts`, tout passé au
  premier essai ; deux juges à l'aveugle, `consigne-juge.md`) : **70 indices, tous au verdict « tranche »**, aucun large,
  aucun refus, rien à réécrire. Trois questions **sans indice honnête**, l'époque étant dans l'intitulé : le traité de
  Versailles « après la Première Guerre mondiale », Napoléon « vaincu » envoyé à Sainte-Hélène, la fin de la guerre du Viêt
  Nam — 1975 ouvre sa tranche, tout indice qui y mène donne la fin de la guerre. La recherche à la main des mots qui
  trahissent un calcul (« addition », « fois », « le seul »…) n'a trouvé que deux « moitié » de siècle, une époque. Une
  limite : les 21 indices de la tranche 1975–1999 reprennent sept formules (« Entre la mort de Pompidou et le passage à
  l'euro »…), qu'un joueur croisera plusieurs fois.
- `contenu-du-filet.mts` a refait le contenu ; `cabinet-contenu.test.ts` en relève les planchers (1 930 questions ; 295,
  500 et 510 par acte), `cabinet-filet-en-deux-temps.test.ts` attend le Jeux & pop culture à l'acte I.

## Ce que ça a coûté

Dix-huit agents, et huit relances : neuf rédacteurs (Sonnet), relancés sur leurs seuls refus une fois le juge corrigé —
celui du sport deux fois, pour les Jeux de 1936 et de 1988 —, de 30 000 à 48 000 jetons chacun ; trois relecteurs (Opus),
13 000 à 14 000 ; un classeur, 173 000, et un panel, 134 000 ; deux rédacteurs d'indices, 168 000 et 176 000 ; deux juges à
l'aveugle, 111 000 et 131 000. Sans la correction du juge, 22 des 83 faits seraient restés fermés.

## Pour refaire

La chaîne est celle du 12 novembre (`../2026-11-12/acte-i-du-filet.md`, « Pour refaire ») ; ce qui s'y ajoute :

1. relire chaque fait à écrire contre **toutes** les questions de la base qui posent sa valeur sous son sujet, pas seulement
   celle qui l'a bloqué — la question de l'année est peut-être déjà là, et déjà au Filet ;
2. dire aux rédacteurs qu'une face s'écrit au naturel, en nommant le fait : le juge ne la refuse plus ;
3. pour un film, l'année de sa sortie dans le pays que l'intitulé nomme, et la sortie française dans l'explication quand elle
   tombe l'année suivante ;
4. le recoupement à la main après chaque lot, réponse par réponse : à même réponse chiffrée, le juge ne voit que les entités.
