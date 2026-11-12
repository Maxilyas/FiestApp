TA MISSION : dresser la liste des FAITS CANDIDATS (pas des questions complètes) pour le premier acte du jeu « Le Filet » d'une application de quiz française, dans UNE catégorie.

Le jeu : on place une valeur — une année, une grandeur — sur une piste, et un adulte français pris au hasard (ni passionné du sujet, ni joueur de quiz) doit pouvoir la placer DE MÉMOIRE, à 6 ans près pour une année, à 25 % près pour une grandeur. Un fait compte quand CHAQUE Français le sait placer : parce qu'il l'a appris à l'école, le voit tous les jours, l'a vécu dans l'actualité, ou l'a entendu partout dans la culture populaire. La limite : environ sept adultes sur dix y arriveraient. C'est le FAIT qui doit être connu, pas son sujet : la Commune de Paris est au programme, ses 72 jours non ; tout le monde connaît Astérix, personne ne sait combien d'albums il compte.

LE TRI FINAL N'EST PAS LE TIEN : un classement à l'aveugle, par d'autres agents, décidera ensuite ce qui est « connu de chaque Français ». Ton rôle : proposer BEAUCOUP de faits SÛRS parmi les plus connus — y compris ceux dont tu hésites sur la notoriété —, et ne rejeter que ce qui est manifestement de spécialiste, ou dont tu n'es pas certain de la valeur exacte (une date contestée, une mesure refaite, un chiffre qui bouge : jamais). L'exactitude de la valeur, elle, est ton affaire : n'écris que ce dont tu es certain à cent pour cent.

CE QUI SE PLACE (le crible le vérifie) :
- une année de 1001 à 2001 (rien après 2001) ; ou une grandeur d'au moins 10 (une durée, une distance, un poids, une taille, un âge, un nombre d'objets). Rien qui se calcule ou se définit (« les grammes d'un kilogramme »).
- Pas d'alcool.
- Dans une catégorie, la valeur ne sert qu'UNE fois : une valeur déjà prise à l'acte I (liste plus bas) ou déjà dans ta liste est écartée par le crible — choisis alors un autre fait.

OÙ CHERCHER (parcours, sous-thème par sous-thème de ta catégorie) : pour chacun, demande-toi « quelle date, quel chiffre un Français a-t-il forcément en tête ? ». Les familles qui marchent :
- les années des grands événements vécus ou appris (école, actualité des quarante dernières années) ;
- les âges et les dates de mort ou de naissance de gens que tout le monde connaît (un chanteur, un acteur, un sportif, un roi) ;
- les nombres des titres et des expressions, qui sont des faits que tout le monde a en tête : « Le Tour du monde en 80 jours », « Vingt mille lieues sous les mers », « Les 101 Dalmatiens », « Ali Baba et les quarante voleurs », « Les Mille et Une Nuits », « Fahrenheit 451 », « les 24 Heures du Mans », « le Mille Bornes » — ce que ce nombre MESURE (des jours, des lieues, des voleurs, des kilomètres, des heures) est la question ; jamais le titre recopié dans l'intitulé de façon à souffler la valeur ;
- les formats et les quantités de la vie de tous les jours (emballages, cartes d'un jeu — belote, tarot, 52 —, cases d'un plateau, dimensions d'un terrain, d'une feuille, d'un lit, d'une pièce de monnaie : seulement des valeurs sûres et uniques) ;
- ce qu'on lit sur les objets (volts, ampères, calories, centilitres, grammes) ;
- les durées et les distances que chacun a vécues (un trajet, un match, un film, une saison, un mandat, une peine) ;
- les objets et les lieux dont tout le monde sait la taille ou l'âge (un monument, un pont, une tour : seulement une valeur qui ne bouge plus).

COMMENT TRAVAILLER :
1. Écris un fichier JSON /home/user/FiestApp/.lots-campagne/gis-<cat>.json (nom donné par ta mission) : un tableau de lignes {"categorie": "<ta catégorie exacte>", "sousTheme": "<clé>", "texte": "<un intitulé court de question qui demande la valeur, sans la dire>", "reponse": "<la réponse écrite, avec son unité : « 500 g », « 1980 »>", "valeur": <le nombre>, "unite": "<l'unité, ou \"\" pour une année>", "mots": ["<le nom propre ou le sujet le plus distinctif>", "<un deuxième mot-clé>"], "source": "ecole|quotidien|medias|culture"}. Au moins deux mots-clés par ligne, écrits comme ils le seraient dans un intitulé de la base (sans article).
2. Lance le crible : cd /home/user/FiestApp/server && node --import tsx ../.lots-campagne/crible-candidats.mts /home/user/FiestApp/.lots-campagne/gis-<cat>.json --ecrire=/home/user/FiestApp/.lots-campagne/gis-<cat>.gardees.json — il écarte chaque candidate dont la valeur est mal formée ou déjà prise, et chaque fait déjà posé par la base (il cite la question qui le pose). NE SUPPRIME PAS les lignes écartées de ton fichier : le crible les relit à chaque passage, et on les compte. Ajoute des lignes neuves à la fin, relance, et continue jusqu'à ce que le crible garde le nombre demandé par ta mission — ou que tu ne trouves plus rien de sûr à proposer (dis-le alors).
3. N'ouvre aucun autre fichier, ne cherche pas sur le web.
4. Ton bilan : combien de lignes écrites, combien gardées par le crible, combien écartées pour « déjà dans la base » (les faits connus de tous que la base pose déjà sous une autre face), et trois exemples de chaque.
