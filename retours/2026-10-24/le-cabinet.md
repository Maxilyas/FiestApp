# Le Cabinet de curiosités : la refonte de l'Expédition (proposition de V1)

Le 24 octobre 2026, le propriétaire, après trois tours de propositions
(un mode aventure à la Mario, puis « un mode complètement différent ») :

> « J'aimerais refaire une refonte complète de l'expédition. L'objectif à la
> base c'était de faire un mode aventure, de pouvoir explorer et monter pour
> obtenir des récompenses. Je veux faire pleins de petits modes de jeu qui
> justement sont rigolo. »
>
> « J'aime beaucoup l'idée de deviner / mettre sur une carte où se trouve une
> anecdote / questions. Pareil pour la timeline. »
>
> « Est-ce que l'on pourrait faire le cabinet des curiosités mais garder toutes
> les cartes que l'on a pu générer pour la collection ? Ça peut être ça les
> objets du musée à collectionner. »
>
> « Cadre les familles, adresse le bilan de ce qu'on garde ou qu'on retire et
> itère jusqu'à avoir une maquette entièrement jouable avec tous les mini-jeux.
> Prends des décisions toi-même. Carte à collectionner, par famille, et le fait
> de compléter une famille peut par exemple récompenser des légendaires. »

Ce document est la V1 proposée : ce qu'est le mode, ses règles chiffrées, ce
que l'Expédition garde et ce qu'elle retire, le plan de construction, et ce
que trois tours de tests par des agents ont fait changer. **Aucune ligne de
code de l'application n'a changé** : tout vit dans la maquette jouable
(`maquette/`, et publiée en artefact).

## Pourquoi changer

- **Quinze versions en quatre jours.** L'Expédition est devenue un jeu de
  cartes à la Slay the Spire : actes, escales, adversaires en crans, courage,
  énergie, styles, familles, fioles, Ascension, échoppe, talismans… Le brief du
  17 octobre le disait déjà : « on fait que rajouter des choses mais on ne sait
  plus quoi choisir ».
- **Une partie dure vingt à trente questions et peut se perdre.** C'est le
  pire format pour un joueur occasionnel : trop long pour cinq minutes, et
  l'échec efface l'effort. Le joueur qui veut tout finir, lui, n'obtient ses
  légendaires qu'au bout.
- **Les formes de question étaient cachées sous le combat.** Le vrai ou faux,
  les lettres, la frise, le détail, le rébus existent déjà ; ils deviennent ici
  le jeu.

## Le mode en une phrase

**Ton Cabinet est un musée à remplir.** Les 84 cartes peintes sont ses œuvres,
rangées en neuf salles. On les gagne en jouant à neuf petits jeux de deux
minutes. Une salle complète réveille son gardien légendaire. Chaque œuvre
garde sur son cartel ce qu'on a appris en la gagnant.

Il sert les deux publics à la fois :

- **le joueur occasionnel** : une partie de deux minutes fait toujours avancer
  (une œuvre, ou de la poussière d'or), rien ne se perd, aucune règle à
  apprendre ;
- **celui qui veut tout compléter** : les cadres vides qui disent où chercher,
  les raretés, les cadres dorés, les deux gardiens par salle, les gardiens de
  saison.

## Les règles

### Les œuvres et les salles

- **84 œuvres** : toutes les cartes peintes des rencontres
  (`client/public/cartes`). Les trois fioles n'en sont pas.
- **9 salles** : les huit familles (l'Érudit, le Devin, le Rempart, l'Élan, le
  Métamorphe, le Flambeur, le Sophiste, le Téméraire), huit œuvres chacune,
  et **le Vestibule**, les vingt neutres.
- **La rareté fixe le seuil** : une partie vaut 9 étoiles (trois manches de
  trois). Il en faut **5 pour une commune, 6 pour une rare ou une maudite,
  7 pour une épique**.
- **Le cadre doré** : trois manches parfaites **sans qu'un pouvoir ait
  servi**, ou de la poussière d'or (50, 100, 100, 160 selon la rareté). Une
  œuvre possédée se rejoue pour la dorer, au prix d'une chasse.
- **Chaque œuvre se trouve à un jeu fixe**, que son cadre vide affiche (« à
  chercher au Filet »).

### Les gardiens : les 23 légendaires

- **Deux par salle** : le premier se réveille quand la salle est complète, le
  second quand tous ses cadres sont dorés (9 salles, 18 gardiens). Exemple :
  l'Érudit, la Chouette d'Argent puis le Lion ; le Rempart, le Phénix puis
  l'Ouroboros.
- **Cinq autres** :
  - le Scarabée, à trente jours de visite d'affilée ;
  - le Trou noir, au Cabinet entier (les 84 œuvres) ;
  - trois gardiens de saison, réveillés par la première œuvre gagnée pendant
    leur fête : la Citrouille à Halloween, le Sapin à Noël, le Bouquet au
    Nouvel An.
- **Un gardien réveillé, c'est le légendaire gagné**, avec sa carte : la plus
  forte de sa famille.
- **Aucun Divin.** Le Cabinet n'en dit rien, n'en montre rien, n'en réveille
  aucun (invariant 21).

### Une journée

- **La visite du jour** : trois parties, trois jeux différents. Les jeux des
  deux derniers jours passent après les autres, et on peut changer un jeu par
  jour. Chacune annonce « une œuvre rare de la salle du Devin » sans la
  nommer : on la découvre une fois gagnée.
- **Deux chasses par jour** : on touche un cadre vide et on joue au jeu où
  l'œuvre se trouve, ou on rejoue une œuvre possédée pour la dorer. Après un
  échec en visite, « Retenter cette œuvre au même jeu » coûte une chasse.
- **Jouer librement** : les neuf jeux, à volonté, sans œuvre en jeu. Les cinq
  premières parties libres du jour rapportent de la poussière, les suivantes
  sont pour le plaisir.
- **La série** : les jours d'affilée avec une partie de visite ou de chasse.
  Elle se lit jusqu'à la veille tant qu'on n'a pas joué : « Joue aujourd'hui
  pour garder ta série. »

### La poussière d'or

C'est la monnaie du Cabinet, et elle ne sort jamais du Cabinet : ni confettis,
ni écus.

- **Ce qu'elle achète** : une œuvre précise (200, 400, 400 ou 700 selon la
  rareté) ou un cadre doré (50, 100, 100, 160).
- **Ce qui en rapporte** :
  - toute partie de visite ou de chasse, même ratée : 2 par étoile, 4 au
    moins ;
  - un double : 30, 60, 60 ou 120 ;
  - une partie libre : 2 par étoile, cinq fois par jour.
- **Quitter compte la partie** avec les étoiles déjà gagnées, chasse ou visite
  consommée, et un rechargement fait pareil : on ne relance pas jusqu'à tomber
  sur des questions faciles. Quitter demande confirmation et met le chrono en
  pause.

### Les cartes-bonus : cinq pouvoirs

Avant chaque partie, on emporte une carte qu'on possède. **Son pouvoir vient
de sa famille ; sa rareté le rend plus fort. Elle ne s'use jamais.** Les
légendaires portent le pouvoir de la salle qu'ils gardent.

| Pouvoir | Familles | Ce qu'il fait | Force (commune · rare · épique) |
|---|---|---|---|
| **Éclairer** | l'Érudit, le Devin, cinq neutres | un indice, propre à chaque jeu (tableau suivant) | 1 · 2 · 3 indices par partie |
| **Protéger** | le Rempart, cinq neutres | une fois par partie, la première manche imparfaite gagne des étoiles | +1 · +1 · +2 |
| **Prendre son temps** | l'Élan, cinq neutres | du temps en plus à chaque manche | +10 · +20 · +30 s |
| **Miser** | le Flambeur, le Téméraire, les trois maudites | avant une manche, sans l'avoir vue, une fois par partie : parfaite, elle rapporte des étoiles en plus ; sinon, rien | +2 · +3 · +4 |
| **Changer** | le Métamorphe, le Sophiste, deux neutres | remplace la manche avant de répondre, le chrono continue (pas à la Frise) | 1 · 2 · 3 fois |

Seul Éclairer s'écrit jeu par jeu. Les quatre autres valent partout, et un
nouveau mini-jeu ne demande donc qu'une ligne :

| Jeu | Éclairer |
|---|---|
| L'Épingle | entoure une grande zone (170 km) qui contient le lieu |
| La Frise | dévoile l'année d'un nouveau venu |
| Le Mot mystère | souffle une lettre à sa place |
| Le Détail | efface un mauvais titre |
| Le Filet | montre une zone où est la réponse |
| Le Pari | efface une mauvaise réponse |
| L'Éclair | souffle la réponse de l'affirmation en cours |
| Les Indices | un indice gratuit |
| La Réplique | efface une mauvaise proposition |

**L'invariant 8 tient** : le Cabinet se joue seul, comme l'Expédition, et
aucun pouvoir n'en sort.

### Les neuf mini-jeux

Chaque partie compte trois manches de trois étoiles. Après chaque manche, une
révélation avec son « Le savais-tu ? ».

| Jeu | Le geste | Le barème d'une manche | Le contenu |
|---|---|---|---|
| **L'Épingle** | un récit, puis « où ? » : on plante l'épingle sur la carte de France | moins de 40 km ★★★ · 120 km ★★ · 300 km ★ | nouveau : des lieux datés (coordonnées et date, Wikidata) |
| **La Frise** | une seule frise qui grandit : 3, puis 5, puis 7 événements, du plus ancien en haut au plus récent | sans faute ★★★ · une erreur ★★ · deux ★ | `server/content/frises/` plus des frises à thème |
| **Le Mot mystère** | un Wordle dont l'indice est une question, cinq essais | 1-2 essais ★★★ · 3-4 ★★ · 5 ★ | la base : les réponses d'un mot de 5 à 7 lettres |
| **Le Détail** | le tableau en quatre cadrages, « Reculer d'un pas » coûte une étoile, quatre titres d'époques voisines | 1er cadrage ★★★ · 2e ★★ · 3e ★ | `server/content/details/` : 100 tableaux |
| **Le Filet** | un curseur, puis la taille du filet : petit, moyen, grand | dans le petit ★★★ · le moyen ★★ · le grand ★ | la base : les questions à valeur (`valeur`, `date`) |
| **Le Pari** | un QCM ; juste, on garde ★ ou on parie sur une question difficile | garder ★ · parier et réussir ★★★ | la base (difficulté 1-3, puis 4-5 pour le pari) |
| **L'Éclair** | cinq affirmations, vrai ou faux, 45 s | 5 justes ★★★ · 4 ★★ · 3 ★ | la base (la réponse proposée, juste ou un leurre) |
| **Les Indices** | « Qui suis-je ? » : cinq indices du plus obscur au plus évident, on tape un nom | 1-2 indices ★★★ · 3 ★★ · 4-5 ★, une erreur coûte une étoile | nouveau : des fiches de personnages |
| **La Réplique** | le mot qui manque d'une réplique culte, puis « Qui l'a dit ? » | le bon mot ★★ · la bonne personne ★ | nouveau : des répliques (films, théâtre, chansons) |

### Ce qu'on apprend

- **Le cartel** : chaque œuvre gagnée garde la question, la réponse et
  l'anecdote de la partie, avec le jeu, le jour et les étoiles. Il se lit seul.
- **Tes murs** : une carte de France où chaque lieu de l'Épingle reste
  épinglé, et une frise personnelle où chaque date apprise trouve sa place.
- **Le carnet** : les erreurs y entrent, comme partout en campagne.
- **Rien ne revient avant sept jours**, d'un jeu à l'autre : le Pari et
  l'Éclair puisent dans le même tas.

## Ce que l'Expédition garde, et ce qu'elle retire

| | Garde | Retire |
|---|---|---|
| **Les cartes** | les 84 peintures (`cartes-peintes.ts`, la chaîne `peindre`), leurs noms, leurs familles, leurs raretés, leurs devises | le paquet, la main, la pioche, la défausse, l'énergie, les coûts, les améliorations |
| **Les légendaires** | les 23 légendaires à joker et leurs médaillons, devenus gardiens ; ceux qu'un joueur possède restent réveillés | les gardiens de fin d'acte et le choix au bout du troisième |
| **Les formes** | le vrai ou faux (→ l'Éclair), les lettres (→ le Mot mystère), la frise (→ la Frise), le détail (→ le Détail), les valeurs (→ le Filet) | le six choix, les crans des formes |
| **Plus tard** | le dévoilement, le rébus et les curiosités : deux mini-jeux tout prêts pour une V2 | — |
| **La structure** | le carnet, le signalement, la correction, « jamais vues d'abord » | les actes, le plan, les escales, les campements, l'inconnu, les pièges |
| **Les rencontres** | rien | les adversaires, le courage, les sceaux, la frappe, le doute, le second essai, les styles, l'Ascension |
| **L'économie** | la saison des fêtes (devenue les gardiens de saison) | les écus, l'échoppe, les talismans, les fioles, le passeport, l'invité du jour, l'équipée |
| **La progression** | — | la renommée, les niveaux d'explorateur, l'échelle du codex, les exploits, les dos de cartes |

**Les joueurs actuels ne perdent rien** (l'esprit de l'invariant 22) :

- toute carte que leur codex leur avait ouverte devient une œuvre possédée,
  au cartel « Rapportée de l'Expédition » ;
- tout légendaire possédé réveille son gardien, sans cérémonie ;
- une expédition en route se finit à ses règles, ou s'abandonne sans rien
  reprendre ;
- le trophée **L'Explorateur** garde ses détenteurs ; ses paliers se relisent
  aux salles complètes (une, trois, six).

## Le plan de construction

Quatre étapes, chacune en préproduction d'abord, derrière un drapeau
(`CABINET_EN_PRODUCTION`), l'Expédition fermée seulement à la dernière.

1. **Le socle, avec les jeux dont le contenu existe déjà.**
   - Les salles, les œuvres, la migration des joueurs.
   - La visite et la chasse, la poussière, les gardiens des salles.
   - Quatre jeux : la Frise, le Détail, l'Éclair, le Pari.
2. **Les jeux à contenu calculé** : le Mot mystère, le Filet, et les pouvoirs
   des cartes-bonus.
3. **Les jeux à contenu neuf** : l'Épingle (des lieux datés, tirés de
   Wikidata par `faits-wikidata.ts`, relus comme la base de la campagne) et
   les murs. Puis les Indices et la Réplique (écrits et relus par les agents
   `redacteur-campagne` et `relecteur-campagne`, cinquante entrées chacun
   au moins).
4. **La fin de l'Expédition** : la migration jouée en préproduction, le
   drapeau ouvert en production, la documentation (`docs/produit/`, une page
   « Le Cabinet de curiosités »).

**Ce que l'architecture impose** :

- **Invariant 1** : le serveur juge chaque manche. L'Épingle n'envoie les
  coordonnées, la Frise l'ordre, le Mot mystère le mot, le Filet la valeur
  qu'à la révélation ; le téléphone envoie un geste, le serveur rend les
  couleurs ou les étoiles.
- **Les chronos sont lus à `serverNow()`** (invariant 6).
- **Le pouvoir d'une carte et le cadre doré se jugent au serveur.**
- **Le Cabinet est une série de la campagne** (`mode = 'cabinet'`) : la base,
  le carnet, l'expérience et les confettis la comptent sans rien en savoir.
- **Les règles chiffrées vont dans `docs/reference/baremes.md`** : seuils,
  prix, poussière, pouvoirs.

## Ce que les tests ont fait changer

Trois agents ont joué la maquette deux fois chacun :

- une joueuse occasionnelle, en 390 × 844 ;
- un complétionniste, qui a relu le code et simulé l'économie ;
- une grand-mère, en 360 × 640, au rythme lent.

Un quatrième a fait une passe de bugs au regard neuf.

**Les failles fermées** :

- quitter ou recharger sans coût ;
- une réponse fourre-tout acceptée aux Indices ;
- au Filet, la réponse toujours au milieu de la piste ;
- Miser à ×2, qui dorait une épique en deux manches ;
- la poussière infinie en partie libre ;
- Protéger qui vidait les seuils de leur sens ;
- « Prendre son temps » qui dorait sans aide apparente.

**La lisibilité** :

- des textes plus gros ;
- un en-tête et un pied collants (le chrono, le clavier, « Valider ») ;
- « ↑ Plus ancien » sur la frise ;
- 45 s à l'Éclair, un chrono par question à la Réplique ;
- l'Épingle plus tolérante ;
- des boutons − et + au Filet ;
- un glossaire : « Les mots du Cabinet ».

**Ce qui fait revenir** :

- les cartels qui se lisent seuls ;
- la série qui ne retombe plus à zéro le matin ;
- « Le prochain gardien : encore 2 œuvres dans la salle du Rempart » ;
- le jeu qu'on peut changer ;
- rien qui revient avant une semaine.

**Les rythmes simulés** :

- **Tout posséder** : 18 à 24 jours pour un bon joueur, 19 à 39 pour un
  joueur moyen.
- **Tout dorer** : plusieurs mois. C'est voulu : c'est la longue traîne du
  complétionniste, et les dorures ont baissé de 40 % pour qu'elle reste
  atteignable.

## Ce qui reste à trancher

1. **La poussière d'or ou les confettis ?** Ma recommandation : la poussière,
   propre au Cabinet. Les confettis achètent les thèmes et les compagnons de
   la boutique, et un achat d'œuvre les mettrait en concurrence.
2. **Les gardiens de saison** : à leur seule fête (un joueur arrivé en février
   attend dix mois la Citrouille), ou rattrapables par un défi ? Ma
   recommandation : leur fête seulement. Une fête qui revient chaque année
   est une bonne raison de revenir.
3. **La carte de l'Épingle** : la France seulement en V1, le monde en V2 (même
   jeu, une autre carte, des lieux d'ailleurs) ?
4. **Le nom** : « Le Cabinet de curiosités » remplace-t-il « L'Expédition » sur
   l'accueil, ou l'Expédition reste-t-elle le nom du bouton ?
