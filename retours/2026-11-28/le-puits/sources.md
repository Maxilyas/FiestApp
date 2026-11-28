# Les sources d'énigmes : ce qui existe, et ce qu'on peut en prendre

Le 28 novembre 2026. Le propriétaire : « Il faut aller chercher beaucoup plus de
sources. Prends tout ce que tu vois sur internet fait par humain. » Ce relevé
dit ce qui a été trouvé, ce qui a été lu, et à quelles conditions chaque source
entre dans le puits.

## La règle retenue

L'application n'est pas vendue, mais elle est en ligne : y recopier un texte,
c'est le republier, payant ou non. Trois cas, donc — les deux premiers sont
déjà ceux du Sphinx (« sources libres, écrites par des humains ») :

| La source | Ce qu'on en prend |
|---|---|
| **Domaine public** (l'auteur est mort depuis plus de soixante-dix ans) | Tout : l'énigme, son texte, sa solution. On traduit, on raconte, on cite l'auteur, le titre, le numéro |
| **Licence libre** (MIT, CC BY-SA, domaine public déclaré) | Le code ou les données, aux conditions de la licence ; on la nomme |
| **Texte protégé** (un site, un livre récent, une émission) | **L'idée seulement** : la mécanique d'une énigme n'appartient à personne. On la raconte avec nos mots, jamais avec les leurs |

Pour un jeu qu'on manipule, la troisième ligne coûte peu : l'énoncé se réécrit
de toute façon, et ce qui se joue — une barque, deux cruches, une règle — est
libre. Chaque fiche de la maquette dit sa source ; une énigme fabriquée par le
programme le dit aussi (« tirée par le programme, sur le modèle de… »).

## Le domaine public, texte en main

Lus d'ici, par leur miroir sur GitHub (Projet Gutenberg) ou sur Wikisource.

| Le recueil | Ce qu'il contient | Pour quels moules |
|---|---|---|
| **H. E. Dudeney, *Amusements in Mathematics***, 1917 | **430 énigmes** et leurs solutions, rangées par lui : arithmétique et algèbre (141), géométrie et découpages (64), points et lignes (8), jetons qui bougent (25), tracés d'un seul trait et routes (23), combinaisons et groupes (26), échiquier (74), mesurer, peser, ranger (11), traversées de rivière (5), jeux à deux (21), carrés magiques (15), inclassables (17) | Presque tous : traversées, cruches, grenouilles, pièces qui glissent, échiquier, carrés magiques, un seul trait, duels |
| **H. E. Dudeney, *The Canterbury Puzzles***, 1907 | **114 énigmes** racontées par les pèlerins de Chaucer | Les mêmes, avec un récit déjà fait |
| **Lewis Carroll, *Symbolic Logic***, 1896 | Une soixantaine de **sorites** : des prémisses saugrenues, une conclusion à tirer | Les sorites |
| **Lewis Carroll, *A Tangled Tale***, 1885 · ***The Game of Logic***, 1886 | Dix « nœuds » racontés ; des syllogismes sur un damier | Problèmes, déductions |
| **Édouard Lucas, *Récréations mathématiques***, 4 tomes, 1882-1894 | Les traversées, les ponts, les labyrinthes, les reines, le solitaire, le baguenaudier, le taquin, les dominos, les marelles. Les quatre fac-similés sont sur Wikisource en français ; 58 pages du tome 1 et 15 du tome 3 y sont transcrites | Grenouilles, solitaire, taquin, échiquier, labyrinthes |
| ***Un million d'énigmes, charades et logogriphes***, 1858 | 719 pièces en vers — la source des visites du Sphinx | Reste aux visites |
| ***Le Sphinx au foyer*** (Wikisource) | Énigmes, charades, homonymes, **mots carrés**, **mots en triangle**, proverbes, sonnets-portraits, avec leurs explications | Les jeux de lettres, en français et d'époque |
| ***Le livre des jeux d'esprit*** (Wikisource) | Énigmes, charades, logogriphes | Les jeux de lettres |
| ***Les Enfantines du bon pays de France*** · *Le Folk-lore de l'Île-Maurice* (Wikisource) | Devinettes populaires ; sirandanes | Devinettes |

## Le domaine public, à aller chercher

Repérés, mais leurs numérisations (Internet Archive, Gallica) ne répondent pas
depuis cet environnement.

- **Alcuin d'York**, *Propositiones ad acuendos juvenes*, vers 800 : 53 problèmes, dont les trois premières traversées de rivière connues.
- **Bachet de Méziriac**, *Problèmes plaisants et délectables*, 1612 : pesées, partages de vin, maris jaloux, la course à cent.
- **Jacques Ozanam**, *Récréations mathématiques et physiques*, 1694.
- **Sam Loyd**, *Cyclopedia of 5000 Puzzles, Tricks and Conundrums*, 1914 : le plus gros recueil illustré ; Donald Knuth en tient un index des énigmes mathématiques.
- **W. W. Rouse Ball**, *Mathematical Recreations and Essays*, 1892 · **« Professor Hoffmann »**, *Puzzles Old and New*, 1893 · **W. F. White**, *A Scrap-Book of Elementary Mathematics*, 1908 · **Sophus Tromholt**, *Streichholzspiele*, 1889 (les jeux d'allumettes).
- **Eugène Rolland**, *Devinettes ou énigmes populaires de la France*, 1877.
- Une douzaine de recueils anglais de devinettes et de jeux de mots sur le Projet Gutenberg (*Conundrums, Riddles and Puzzles*, *The Book of Riddles*, *Merry's Book of Puzzles*…) : ils jouent sur l'anglais, et ne se traduisent pas.

## Les licences libres : des générateurs et des bases

| La source | Sa licence | Ce qu'elle apporte |
|---|---|---|
| **La collection de Simon Tatham** | MIT | 38 jeux de logique, chacun avec son générateur et son solveur : Net, Cube, Fifteen, Sixteen, Twiddle, Rectangles, Netslide, Pattern, Solo, Mines, Same Game, Flip, Guess, Pegs, Dominosa, Untangle, Black Box, Slant, Light Up, Map, Loopy, Inertia, Tents, Bridges, Unequal, Galaxies, Filling, Keen, Towers, Singles, Magnets, Signpost, Range, Pearl, Undead, Unruly, Flood, Tracks |
| **pzpr.js**, le moteur de puzz.link | MIT | Environ 300 genres de grilles logiques à la japonaise, avec leurs règles |
| **La base de problèmes de Lichess** | Domaine public | **6 057 356 problèmes d'échecs**, tirés de vraies parties, chacun noté (sa difficulté est mesurée) et étiqueté (mat en un, fourchette…) |
| **fogleman/rush** | MIT | Toutes les positions intéressantes du jeu des voitures qui glissent |
| **Microban**, David W. Skinner | Redistribution permise | 155 petits niveaux de Sokoban |
| **OpenLexicon (Lexique)** | Libre | Une liste de mots français : le dictionnaire qui manque aux mots en échelle et aux anagrammes |
| **Wikibooks, « Puzzles »** · **Wikipédia** | CC BY-SA | Des énigmes classiques par familles, et la description de chaque famille |

## Les idées seulement

Des textes protégés, ou des bases dont la licence est floue : on y prend la
mécanique, jamais l'énoncé.

- **Les énigmes de TED-Ed** (le pont, les chapeaux des prisonniers, les trois dieux, la fausse pièce, la chute de l'œuf, les casiers, l'énigme dite d'Einstein, les yeux verts…) : presque toutes sont des classiques plus anciens, racontés à neuf.
- **Martin Gardner**, **Raymond Smullyan**, **Boris Kordemsky**, **Nikoli** : les grands auteurs du XXe siècle.
- **Les sites français** : Diophante (des milliers de problèmes), Récréomath, Math93, Bibmaths ; l'IREM de Lyon, « Énigmes de Âne à Zèbre » (901 énigmes).
- **Les jeux de données d'énigmes** (RiddleSense, BrainTeaser, les collections de devinettes sur GitHub) : en anglais, ramassés sur le web, réservés à un usage non commercial ou sans licence dite.

## Ce que la maquette en fait

Vingt et un moules, sur six socles. Chaque énigme écrite cite sa source ; celles
de Dudeney ont été relues dans son texte, et le programme retrouve ses nombres
(onze transvasements au n° 365, dix-sept déménagements au n° 220, dix sauts au
n° 216).

Aucune énigme de la maquette ne vient de la réserve du Sphinx, que le
propriétaire joue : `recoupe.mjs` dit, sans rien en montrer, si une énigme qu'on
veut écrire s'y trouve déjà, et celles qui s'y trouvaient n'ont pas été écrites.
Les deux puisent pourtant aux mêmes livres : le puits pose d'autres énigmes des
mêmes familles.
