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
2. **Le Détail : de 100 à NOMBRE tableaux.** Voir plus bas.
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

DÉTAIL_DES_TABLEAUX

Ce que Wikidata dit de travers s'écrit à la main dans le script, avec ce qui
le fonde : cinquante-trois années (« Le Pays de Cocagne », 1550 pour 1567 ;
« L'Astronome », 1664 pour 1668 ; un intervalle daté de sa première année),
vingt-deux titres ou peintres (« June flamboyante », « La Source — Alexandre
Desgoffe »).

Un tableau venu de Wikidata seul n'a pas de question dans la base : sa
révélation dit ce qu'il est, sans « Le savais-tu ? ».

## Ce qui reste

- **La Réplique (60 répliques vues sur 66 par le plus assidu) et l'Épingle
  (67 lieux sur 90)** approchent du bout sans redite encore. À doubler de même.
- **Aux plus grosses journées du joueur le plus assidu — trois traversées —,
  seuls les Indices tiennent la semaine** ; le Détail en tient cinq jours,
  puis quitte sa carte le temps que ses tableaux reviennent.
- **Des anecdotes pour les tableaux sans question** : les écrire, c'est écrire
  leur « Qui a peint… ? » dans la base (skill `base-campagne`).
- **Rien de tout cela ne répond au décrochage** des joueurs qui n'ont jamais
  gagné une traversée : le contenu sert ceux qui restent.
