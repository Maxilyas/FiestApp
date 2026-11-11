# Le contenu du Cabinet, pour le noyau qui joue encore — le 11 novembre 2026

Le propriétaire, après la revue du Cabinet depuis son ouverture : « Fais le
contenu pour le noyau qui joue encore. » Le relevé du 8 novembre
(`../2026-11-08/le-cabinet-en-production.md`) avait montré un seul joueur au
bout du contenu ; rejoué le 10, il en montre trois.

## Ce que la production disait, du 1er au 10 novembre

En lecture seule, par le script du 8 (`../2026-11-08/reproductions/le-cabinet-en-production.ts redites`),
des totaux sans un nom.

| Jeu | Pièces jouées | Redites | Justes sur une redite | Justes sur du neuf |
|---|---|---|---|---|
| Détail | 197 | **83 (42 %)** — 41 tableaux déjà joués, 42 déjà vus en leurre ; 44 de moins de 24 h | **71 %** | 44 % |
| Indices | 172 | 11 (6 %) | 73 % | 36 % |
| Frise | 39 | 1 | — | 63 % |
| Les sept autres | — | 0 | — | — |

Ce que les trois joueurs les plus assidus de chaque jeu avaient vu des
réservoirs écrits à la main :

| Réservoir | Taille | Vus par les trois plus assidus | Le 8 novembre |
|---|---|---|---|
| Détail (tableaux) | 100 | **100, 84, 72** | 100, 60, 48 |
| Indices (fiches) | 66 | **66**, 18, 18 | 59, 18, 18 |
| Réplique | 66 | 60, 20, 13 | 43, 15, 12 |
| Épingle (lieux) | 90 | 67, 18, 12 | 58, 15, 12 |
| Frises à thème | 18 | 3, 2, 2 | 2, 2, 2 |

- **Le Détail était devenu un jeu de mémoire pour ceux qui restent.** Chaque
  manche compte vus ses quatre titres (le bon et ses trois leurres) : vingt
  tableaux par traversée, cent tableaux pour cinq traversées. Faute de fenêtre
  neuve, le tireur repose la plus anciennement vue — plus d'une redite sur deux
  datait de la veille.
- **Les Indices commençaient** : le joueur le plus assidu avait vu les
  soixante-six fiches, et ses onze premières redites se trouvent deux fois plus
  souvent qu'une fiche neuve.
- Les jeux tirés de la base (26 000 QCM) n'ont aucune redite.

## Ce qui a été fait

1. **Les Indices : 66 → 138 fiches.** Soixante-douze personnages que tout
   Français connaît (« le levier le plus fort, c'est d'avoir des questions que
   chacun connaisse », le propriétaire, le 9 novembre) : l'histoire de France
   et du monde, les sciences, les lettres et les arts, la chanson, le cinéma,
   le sport, six personnages de fiction. Trois rédacteurs, chacun au juge du
   dépôt jusqu'à zéro refus ; puis trois relecteurs, qui n'avaient rien écrit,
   sur chaque fait — une cinquantaine de retouches de fond (un sacre mal dit,
   un désert mal situé, un record qui pouvait tomber). L'indice 4 doit suffire
   à la plupart des Français, le 5 à tous. Aucun souverain à chiffre romain :
   « Louis 14 », tapé au téléphone, ne trouverait pas « Louis XIV ».
2. **Le Détail : de 100 à 309 tableaux.** Voir plus bas.
3. **Le Détail ne se promet plus qu'à qui a du neuf.** Au départ d'une
   traversée, s'il reste moins de six fenêtres sans un tableau vu de la semaine
   (`FENETRES_POUR_PROMETTRE_LE_DETAIL`), ni la carte ni les gardiens ne le
   posent ; il revient quand ses tableaux ont passé sept jours.
4. **Le contenu se mesure au rythme de la traversée**
   (`server/test/cabinet-contenu.test.ts`) : une par jour, cinq manches de
   chaque jeu, sept jours sans redite — et le tireur du Détail joue la semaine.

## Les tableaux

La chaîne (`server/scripts/details.ts`) ne prenait que les tableaux que la
base pose (« Qui a peint… ? »). Elle prend maintenant aussi les plus célèbres
de Wikidata — 1 151 tableaux que douze Wikipédia au moins décrivent, 827 d'un
peintre mort à temps et hors de la base —, choisis à la main dans cette
liste : la plus liée n'est pas la plus connue d'un joueur français (une
vingtaine de Madones avant « La Classe de danse »).

Deux cent vingt tableaux regardés un à un — 56 que la base pose et que la
première passe n'avait pas pris, 164 célèbres de Wikidata —, par neuf lots,
et un dixième pour reprendre ceux qu'un bord avait fait écarter : 209 gardés,
11 écartés avec leur raison (`ECARTES` : un haut cintré, une
reproduction aux couleurs faussées, un nu trop cru pour un jeu ouvert dès dix
ans, une attribution contestée, un quatrième Goya de la même année). Pour
chacun, le détail choisi à l'œil sur sa planche puis vérifié découpé
(`DETAILS`) : ni signature, ni date, ni inscription, et rien qui nomme le
tableau à lui seul avant d'avoir regardé.

- **309 tableaux, 107 peintres**, du XVe au XXe siècle (18, 47, 46, 23, 152,
  23) : le XIXe en tient la moitié, comme la mémoire d'un joueur français ;
  aucun peintre n'en a plus de douze.
- **78 se rognent avant de se découper** (`ROGNAGES`) : Commons photographie
  souvent la toile avec son bord, un filet sombre ou la baguette de son
  cadre, et trois des onze écartés d'octobre l'étaient pour un cadre. Huit
  tableaux d'abord écartés pour leur bord sont revenus ainsi.
- **1 236 images, 41 Mo** dans le dépôt (13 Mo pour les cent premiers), 40 ko
  au plus chacune, servies une à une à leur heure comme avant.
- **153 n'ont pas de question dans la base** : leur révélation dit ce qu'ils
  sont — le titre, le peintre, l'année —, sans « Le savais-tu ? ».

Ce que Wikidata dit de travers s'écrit à la main dans le script, avec ce qui
le fonde : cinquante-deux années (« Le Pays de Cocagne », 1550 pour 1567 ;
« L'Astronome », 1664 pour 1668 ; un intervalle daté de sa première année),
vingt-deux titres ou peintres (« June flamboyante », « La Source — Alexandre
Desgoffe », la « Procession nuptiale sur le Hardangerfjord » peinte à deux).

## Ce que le Détail tient maintenant

Joué par son vrai tireur, sous la garde de la carte, vingt joueurs pendant
quatre semaines (`reproductions/le-detail-au-rythme.mts`) :

| Traversées par jour | Manches redites | La première traversée sans Détail | Sans Détail, sur quatre semaines |
|---|---|---|---|
| 1 | 0 sur 2 800 | jamais | aucune |
| 2 | 0 sur 4 865 | le septième jour | une sur huit |
| 3 — les plus grosses journées du plus assidu | 0 sur 5 105 | le cinquième jour | quatre sur dix |

Plus aucune redite, à aucun rythme : là où les tableaux manquent, c'est le
jeu qui s'absente de la carte, et un autre prend sa place.

## La Réplique et l'Épingle, le même jour

Le propriétaire, au vu de ce qui précède : « Pourrais-tu envoyer des agents
avec un plus petit modèle (adapté à la tâche selon toi) pour la Réplique et
l'Épingle ? » — et, pour l'Épingle : « trop dur, c'est parfois des choses
qu'on n'arrive pas à savoir », avec l'idée d'indices qui se déroulent pendant
que les étoiles baissent, et la question de rester en France (la décision :
`docs/architecture/decisions.md`, « Les indices de l'Épingle »).

Rédacteurs et relecteurs : des agents d'un modèle plus petit que celui qui a
mené le chantier, chaque lot relu par un autre agent que son rédacteur, puis
relu une dernière fois à la main.

- **La Réplique : 66 → 137.** Quatre-vingts écrites en cinq lots (cinéma
  français, cinéma et séries du monde, lettres, chanson, mots de l'histoire),
  71 gardées. Ce que la relecture a écarté ou corrigé dit où un rédacteur se
  trompe : la **traduction littérale** d'une réplique étrangère (« Personne ne
  met Bébé dans un coin », « Pourquoi tant de sérieux ? », « Mange mon
  short ! »), la **citation déformée** que tout le monde répète (« Luke, je
  suis ton père »), la forme française d'un mot historique (« Et pourtant,
  elle bouge »), un leurre qui était une variante courante, un « autre » qui
  avait aussi dit la phrase ; et, relu à la main, une marque ou un personnage
  nommés dans la phrase même (« Un Mars et ça repart » : qui l'a dit ?).
- **L'Épingle : 90 → 171 lieux**, neuf thèmes neufs de lieux que tout Français
  connaît : les monuments que le monde nous envie, le bord de mer, les
  châteaux, les sommets, le sport, « D'où ça vient ? », l'histoire en un lieu,
  les capitales d'un savoir-faire, les villes en fête. Les 81 ont été relus
  (une douzaine de dates, autant de directions, cinq coordonnées corrigées),
  puis recoupés par le calcul : commune, département et coordonnées contre
  Wikidata — 79 sur 81 confirmés d'office, les deux autres à la main, et les 90
  anciens de même.

## Les indices de l'Épingle, écrits deux fois

La première version, le matin : pour chaque lieu une « piste » qui disait le
coin de France (« En Normandie, sur la côte de la Manche, à deux heures de
Paris. »), puis un second indice calculé de ses coordonnées (« À 170 km à
l'ouest de Paris. »). Le propriétaire, en la voyant : « Pour moi les indices
doivent être beaucoup plus subtils, et soit relater un fait où se situe le
point, ou alors même son histoire. Par exemple, c'est ici que la tour Eiffel
se trouve — en bien plus élaboré et pas trop direct bien sûr. Mais je trouve
dommage d'avoir des "à 100 km de Paris", y a plus aucune réflexion. »

La seconde, l'après-midi : **deux faits à déduire par lieu, 342 en tout**, et
plus rien de calculé.

- **Sept rédacteurs** (27 lieux chacun au plus), sur une consigne : l'indice 1
  fait déduire sans nommer ni région, ni massif, ni mer ; l'indice 2 suffit à
  un Français moyen pour viser à 150 km près, et se suffit à lui-même. Ils ont
  tous écrit de mémoire, sans une recherche, et l'ont dit.
- **Sept relecteurs**, qui n'avaient rien écrit, sur trois épreuves : est-ce
  vrai, cela aide-t-il à poser l'épingle, est-ce au bon niveau. **118 indices
  réécrits ou retouchés sur 342, dans 87 lieux**, et près de cinquante faits
  vérifiés par une recherche (les comptes par épreuve sont ceux de leurs
  rapports).
  - *N'aide pas à poser l'épingle* (une cinquantaine) — le défaut que les
    rédacteurs ne voient pas : un fait vrai sur la ville, qui ne dit rien de
    sa place à qui connaît déjà son nom. « En 843, un traité y partage
    l'empire de Charlemagne » pour Verdun ; « une petite chouette de pierre y
    porte bonheur » pour Dijon ; « Renoir y est né » pour Limoges.
  - *Faux, approximatif ou invérifiable* (près de trente) : Mouton rangé parmi les premiers
    crus de 1855 (il ne l'est que depuis 1973) ; Drouet reconnaissant le roi
    « à Valmy » (à Sainte-Menehould) ; « Pêcheur d'Islande » sur la mauvaise
    côte ; un « voisin » à cinquante kilomètres.
  - *Pas au bon niveau, ou ne se suffit pas* (une vingtaine) : un second
    indice qui dit « ce même duc », « cette cathédrale », quand il remplace le
    premier à l'écran ; une ville de la carte prise pour repère.
- **Une dernière relecture à la main**, les 342 un à un : seize lieux
  retouchés — une redite du récit (la villa de l'impératrice, à Biarritz), un
  fait qui datera (la résidence d'un président), un indice trop obscur (les
  neuf prêtresses de l'île de Sein, remplacées par le phare d'Ar-Men).

Ce qui reste fragile : la plupart des faits tiennent à la mémoire de deux
agents et à ma relecture, une cinquantaine seulement à une recherche. Aucun
n'envoie loin s'il est faux — ils disent un fait, plus une direction —, mais
un fait faux reste une faute devant un joueur.

## Ce qui reste

- **Aux plus grosses journées du joueur le plus assidu — trois traversées —,
  les Indices, la Réplique et l'Épingle tiennent maintenant la semaine** (105
  manches de chacun en sept jours) ; le Détail en tient quatre jours, puis
  quitte sa carte quatre fois sur dix, le temps que ses tableaux reviennent.
- **Les indices de l'Épingle ne sont pas mesurés** : le calibrage de la
  traversée joue encore le jeu sans indice. À relever sur les vraies manches :
  combien en demandent un, deux, et ce que le jeu fait alors au taux de
  victoire.
- **Un nombre se coupe au milieu** : « 2 100 mètres » passe à la ligne entre
  ses deux morceaux, à l'Épingle comme ailleurs (`espacesFines` ne colle pas
  les milliers). Vu au rendu, pas corrigé ici. **Corrigé le même jour** :
  `espacesFines` colle les milliers d'un nombre écrit dans un texte
  (`milliersColles`, règle `css.md`), sans toucher au contenu — au col du
  Tourmalet, la coupe tombait de 332 à 362 px de large, et plus à aucune
  (`reproductions/nombre-coupe.ts`).
- **« Les Iris » de Van Gogh manquent** : choisis dans la liste, ils ne sont
  pas sortis candidats de la chaîne — à reprendre avec le prochain lot.
- **Des anecdotes pour les tableaux sans question** : les écrire, c'est écrire
  leur « Qui a peint… ? » dans la base (skill `base-campagne`).
- **Rien de tout cela ne répond au décrochage** des joueurs qui n'ont jamais
  gagné une traversée : le contenu sert ceux qui restent.
