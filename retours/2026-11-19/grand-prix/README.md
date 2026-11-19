# Le Grand Prix — la maquette (19 novembre 2026)

« Le jour J il y aurait un évènement où il faudrait "battre" [une joueuse],
c'est son double IA en se basant sur ses réponses. À la clé un magnifique
cheval », puis : « il faudrait que ça soit générique / modulaire, c'est-à-dire
qu'on pourrait ensuite mettre n'importe qui comme avatar et jouer contre lui »
(le propriétaire). Le premier Grand Prix est prévu pour un anniversaire,
début décembre 2026.

## La maquette

Dix écrans de téléphone (390 × 844), dans le Velours, sur une planche Design
privée : <https://claude.ai/artifact/86BjSNKbmN8AtBbHqySvuR>. Les prénoms sont
inventés : Léa est la personne fêtée, Nina celle qui court.

1. **L'accueil, le jour J** — le Grand Prix prend la place de l'affiche d'une
   nouveauté : son flot, « Le Grand Prix de Léa », « Bats son fantôme, gagne
   son flot », « Courir ».
2. **Le réveil de la fêtée** — le mot de l'administrateur, le flot
   d'honneur aux rubans d'or, l'avatar en plus dans sa version à elle
   (Pégase couronné), « Porter Pégase », « Mon Grand Prix ».
3. **Avant le départ** — le cavalier fantôme dans le ciel, ce qu'on gagne,
   la règle en trois lignes, « Ils l'ont battue » (le fantôme classé parmi
   eux), « Prendre le départ », essais illimités.
4. **En course** — les deux chevaux, des constellations : le sien doré, le
   fantôme en pointillé bleu ; « Léa a sauté · 5,2 s » sans dire si sa barre
   est tombée ; les scores, le parcours en miniature, l'appel qui approche,
   la question et ses quatre réponses.
5. **La révélation** — son saut sans faute, la barre du fantôme, la réponse
   et le temps de chacun, l'anecdote.
6. **L'arrivée gagnée** — « Ce que tu gagnes » : le flot, l'avatar de la
   personne battue en son cœur ; « À porter » : l'avatar en plus,
   « Essayer ».
7. **L'arrivée perdue** — « Où ça s'est joué », obstacle par obstacle,
   « Recourir » sur un parcours neuf.
8. **Le carnet des Grands Prix** — dans « Ma collection » : le flot et le
   souvenir de la course.
9. **Le bilan du soir de la fêtée** — qui l'a battue, qui son fantôme a tenu
   en échec, sa question la plus redoutable, « Me battre moi-même ».
10. **Au QG** — le fantôme, le jour, le nom, les rubans, le mot, l'avatar en
    plus et la version de la fêtée ; essayer son parcours, programmer.

## Les décisions

« Chevaux constellation, dix obstacles […] prends ta recommandation pour le
flot, l'affiche du jour suffit » (le propriétaire, le 19 novembre 2026).

- **Le jeu est générique** : un Grand Prix se règle au QG (un profil, un
  jour, un flot, un mot, un avatar en plus s'il le veut). Le code ne connaît
  aucun joueur.
- **Tout le monde court**, et sans réglage de consentement : « on est tous
  entre amis ».
- **Le fantôme rejoue ses vraies réponses**, sur des questions qu'il a
  vraiment jouées, à son vrai rythme.
- **Dix obstacles**, une question chacun ; une erreur ou un refus, 4 points ;
  à points égaux, le chrono — le temps de réponse cumulé.
- **Essais illimités**, un parcours neuf à chaque départ ; ni expérience ni
  confettis.
- **Les chevaux de la course sont des constellations**, dessinées par le
  code ; seul l'avatar en plus se peint (Pégase, le premier).
- **Le prix générique est le flot**, dessiné par le code, l'avatar de la
  personne battue en son cœur ; la fêtée reçoit le flot d'honneur. Il se
  range dans un carnet des Grands Prix et **compte dans la valeur d'une
  collection comme un timbre** : comme une fête, un Grand Prix ne court
  qu'un jour, et un flot manqué ne se rattrape pas. L'avatar en plus compte
  comme tout avatar, à sa rareté.
- **L'affiche du jour suffit** sur l'accueil : aucune ligne de plus.

## Le terrain du fantôme

« Il faut écarter le quiz du jour et j'aurais aimé qu'on combatte [la
joueuse] sur ses thèmes ou catégories de prédilection […] Le but c'est de la
mettre en valeur ! », puis, à la proposition de ses trois meilleures
catégories au pourcentage : « Je préférerais que ça soit sur là où elle a
passé le plus de temps […] c'est sûrement là où elle est la meilleure, c'est
juste que si tu vas loin tu fais plus de fautes » (le propriétaire, le
19 novembre 2026).

- **Le quiz du jour sort du vivier** : tout le monde l'a joué le même jour,
  et ce n'est pas là qu'on est chez soi. On n'en garde que ses temps, pour
  le rythme du fantôme en campagne, qui n'en mesure pas.
- **Son terrain : les thèmes où il a passé le plus de temps** — compté en
  réponses de campagne par thème choisi (`campagne_series.sujet`), pas en
  justesse : au pourcentage, une catégorie peu jouée passait devant celles
  où il a passé des heures, et une longue série y fait plus de fautes sans
  qu'on y soit moins bon. Trois thèmes au plus, les trois plus joués cochés
  d'office au QG ; l'administrateur en coche d'autres parmi les siens.
- **Chaque course les prend à tour de rôle** (4, 3 et 3), et ce qu'un
  coureur a déjà joué en campagne passe en dernier : sur un thème partagé,
  on ne court pas sur ses propres réponses.

## Tout sur un écran

« Le bouton "Me battre moi-même" n'est pas visible. Je veux que tout soit
visible sur un écran. Je veux aussi moins de texte inutile, que ça soit plus
épuré. Visuellement on doit comprendre » — et la feuille du réveil : « il y
a plein de lignes de texte en dessous, pas jolies ni pertinentes » (le
propriétaire, le 19 novembre 2026).

- **Le départ, l'arrivée et la feuille tiennent en 360 × 640**, le bouton
  au bas de l'écran, sous le pouce.
- **Des blocs à voir** : le terrain en tuiles (emblème et nom, sans ses
  comptes), la règle en quatre pictogrammes, ceux qui l'ont battu en
  pastilles (visage et prénom). La fêtée a son flot d'or dans le ciel de sa
  page et deux chiffres — ont couru, l'ont battue — à la place du flot à
  gagner et de la règle ; « tenus en échec » et « sa question la plus
  redoutable », deux phrases, sont partis.
- **La feuille du réveil** : le paragraphe sous la carte — son terrain, les
  règles, « toi aussi, tu peux courir » — est remplacé par une ligne dans la
  carte, « Toute la bande court contre ton fantôme ».
