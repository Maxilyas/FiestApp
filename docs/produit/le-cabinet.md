# Le Cabinet de curiosités

> Un mode pour les profils, qui remplacera l'Expédition : ton Cabinet est un musée à remplir. Les 84 cartes peintes en sont les œuvres, rangées en neuf salles ; on les gagne à neuf petits jeux de deux minutes ; une salle complète réveille son gardien légendaire ; et chaque œuvre garde sur son cartel ce qu'on a appris en la gagnant. Comment on le joue, ses règles chiffrées, ce que l'Expédition laisse, ce qui vient ensuite, puis comment c'est construit.

**Dans cette page** : [En bref](#en-bref) · [Les salles et les œuvres](#les-salles-et-les-œuvres) · [Une partie](#une-partie) · [Les neuf jeux](#les-neuf-jeux) · [Les cartes-bonus](#les-cartes-bonus) · [Une journée](#une-journée) · [La poussière d'or](#la-poussière-dor) · [Les gardiens](#les-gardiens) · [Ce qu'on apprend](#ce-quon-apprend) · [Les mots du Cabinet](#les-mots-du-cabinet) · [Ce que l'Expédition laisse](#ce-que-lexpédition-laisse) · [Ce qui vient ensuite](#ce-qui-vient-ensuite) · [Les règles chiffrées](#les-règles-chiffrées) · [Comment c'est construit](#comment-cest-construit)

> [!NOTE]
> **Le Cabinet est en construction.** Le 24 octobre 2026, après trois tours de propositions, le propriétaire : « J'aimerais refaire une refonte complète de l'expédition. L'objectif à la base c'était de faire un mode aventure, de pouvoir explorer et monter pour obtenir des récompenses. Je veux faire pleins de petits modes de jeu qui justement sont rigolo » ; puis « J'aime beaucoup l'idée de deviner / mettre sur une carte où se trouve une anecdote / questions. Pareil pour la timeline », et « Est-ce que l'on pourrait faire le cabinet des curiosités mais garder toutes les cartes que l'on a pu générer pour la collection ? Ça peut être ça les objets du musée à collectionner. » La proposition qui en est née, et sa maquette jouable, ont été jouées et corrigées par des agents sur trois tours — une joueuse occasionnelle, un complétionniste, une grand-mère en 360 × 640 — avant d'être validées le même jour, avec les quatre réponses du propriétaire (« Suit tes recommandations pour les 4 ») : `retours/2026-10-24/le-cabinet.md`. Le mode se construit depuis le 25 octobre 2026, en préproduction d'abord, un jeu après l'autre ; **il reste fermé en production** tant qu'il n'est pas entier (`CABINET_EN_PRODUCTION`), et l'Expédition s'y joue jusque-là. Cette page dit le mode tel qu'il a été décidé ; elle se complète à mesure qu'il se livre.

## En bref

- **Un musée à remplir.** 84 œuvres — les cartes peintes des rencontres de l'Expédition — en neuf salles : les huit familles, huit œuvres chacune, et le Vestibule, les vingt neutres. Chaque cadre vide dit où chercher (« Elle se trouve au Filet »).
- **Neuf petits jeux de deux minutes**, chacun trois manches de trois étoiles : l'Épingle, la Frise, le Mot mystère, le Détail, le Filet, le Pari, l'Éclair, les Indices, la Réplique.
- **Une visite ou une chasse fait toujours avancer** : une œuvre si les étoiles y sont, de la poussière d'or sinon — et une partie de la visite manquée se retente au même jeu, pour une chasse. Une partie libre paie ses étoiles, les cinq premières du jour. Aucune règle à apprendre avant de jouer.
- **Une journée** : la visite du jour — trois parties, trois jeux, trois œuvres à gagner sans les nommer —, deux chasses pour aller chercher une œuvre précise, et des parties libres à volonté.
- **Des cartes-bonus** : on emporte une œuvre qu'on possède, et son pouvoir — Éclairer, Protéger, Prendre son temps, Miser ou Changer. Elle ne s'use jamais.
- **Vingt-trois gardiens légendaires** : une salle complète réveille le premier, une salle toute dorée le second ; le Scarabée, le Trou noir et trois gardiens de saison se réveillent ailleurs.
- **Ce qu'on apprend reste** : le cartel de chaque œuvre, une carte de France où chaque lieu trouvé reste épinglé, une frise de ce qu'on a daté, et le carnet de la campagne.
- **Gratuit, seul, et sans classement** : ce qu'on y gagne ne sert qu'au Cabinet (l'invariant 8), et l'invité anonyme n'en voit rien — l'accueil d'un profil y mène.

## Les salles et les œuvres

| Salle | Ses œuvres | Leur pouvoir | Ses gardiens |
|---|---|---|---|
| L’Érudit — « Je connais mon rayon » | 8 | Éclairer | la Chouette d’Argent, puis le Lion Couronné |
| Le Devin — « Je lis les signes » | 8 | Éclairer | le Sphinx, puis l’Oracle |
| Le Rempart — « Je tiens bon » | 8 | Protéger | le Phénix, puis l’Ouroboros |
| L’Élan — « Je ne m’arrête plus » | 8 | Prendre son temps | le Tigre Foudre, puis la Comète |
| Le Métamorphe — « Je change la question » | 8 | Changer | Janus, puis le Serpent à plumes |
| Le Flambeur — « Je parie sur moi » | 8 | Miser | le Dragon d’Or, puis le Renard Lunaire |
| Le Sophiste — « Je sème le doute » | 8 | Changer | le Fantôme, puis la Chauve-souris |
| Le Téméraire — « Je joue avec le feu » | 8 | Miser | la Salamandre, puis le Kraken |
| Le Vestibule — « Pour tout le monde » | 20 | le sien, pour chacune | le Coq de l’aube, puis la Chimère |

Chaque famille a trois œuvres communes, trois rares et deux épiques ; le Vestibule, dix communes, cinq rares, deux épiques et trois maudites. **La rareté fixe le seuil** : sur les neuf étoiles d'une partie, il en faut 5 pour une commune, 6 pour une rare ou une maudite, 7 pour une épique.

**Chaque œuvre se trouve à un jeu fixe**, que son cadre vide affiche. La table est écrite une fois, et gelée : dans chaque famille, huit jeux différents ; chaque jeu, neuf ou dix œuvres, des communes aux épiques. (La maquette tirait le jeu d'un hachage de la clé : trois œuvres d'une salle tombaient au même jeu, et un dixième jeu les aurait toutes déplacées.)

**Quatre œuvres t'attendent à ton arrivée** — Coup d’œil, Prudence, Concentration et Échange, au Vestibule — : de quoi emporter une carte-bonus dès ta première partie, un pouvoir chacune, sauf Miser.

**Le cadre doré** : trois manches parfaites sans qu'un pouvoir ait servi — emporter une carte-bonus ne coûte rien, s'en servir si —, ou de la poussière d'or. Une œuvre déjà à toi se rejoue pour la dorer, au prix d'une chasse.

## Une partie

Trois manches, trois étoiles chacune. Avant de commencer, **l'annonce** dit tout ce qui t'attend : le jeu et son geste, son barème, l'œuvre en jeu sans la nommer (« Une œuvre rare de la salle du Devin »), le seuil (« 6 étoiles sur 9 »), et ce que chacune de tes cartes-bonus ferait à ce jeu. Rien n'est consommé avant « Commencer » : revenir en arrière ne coûte ni visite ni chasse.

Après chaque manche, **la révélation** : les étoiles et ce qui les a faites (« Rempart protège la manche : +1 étoile »), la réponse en entier, et « Le savais-tu ? ». À la fin, **le bilan** : les étoiles manche par manche, le total, l'œuvre gagnée et son cartel, un gardien qui se réveille, puis ce que la partie a rapporté — l'écran des gains de toute la campagne.

**Le serveur juge tout, à son heure.** Le téléphone n'envoie que des gestes ; la réponse d'une manche, les coordonnées d'un lieu, l'ordre d'une frise, le mot caché ne lui arrivent qu'à la révélation (l'invariant 1). Chaque chrono court au serveur.

**Recharger reprend la partie au même instant de son chrono** — un téléphone qui s'endort ne coûte plus une partie. **Quitter la compte avec ses étoiles**, chasse ou case de visite comprise, après une confirmation qui dit ce que tu emporterais — les étoiles, Protéger compris, et la poussière d'or, le geste joué par le serveur sans rien écrire — et qui met le chrono en pause : trente secondes au plus par manche, la manche voilée — la pause ne s'achète pas du temps de recherche. On ne relance donc pas jusqu'à tomber sur des questions faciles : tout est tiré au départ. Une partie laissée en plan se clôt le lendemain, à la première page qui la trouve.

## Les neuf jeux

| Jeu | Le geste | Une manche | Éclairer |
|---|---|---|---|
| **L'Épingle** | un récit daté, puis « Où ? » : on plante l'épingle sur la carte de France | à moins de 40 km ★★★ · 120 km ★★ · 300 km ★ | entoure une zone de 170 km qui contient le lieu |
| **La Frise** | une seule frise qui grandit — trois événements, puis cinq, puis sept —, du plus ancien au plus récent | sans faute ★★★ · une erreur ★★ | dévoile l'année d'un nouveau venu |
| **Le Mot mystère** | un mot à trouver, la question pour indice, cinq essais, les couleurs de chaque essai | en 1 ou 2 essais ★★★ · 3 ou 4 ★★ · 5 ★ | souffle une lettre à sa place |
| **Le Détail** | un tableau en quatre cadrages ; « Reculer d'un pas » en montre plus et coûte une étoile ; quatre titres d'époques voisines | au premier coup d'œil ★★★ · un pas ★★ · deux ★ | efface un mauvais titre |
| **Le Filet** | un curseur sur une piste, puis la taille du filet | petit ★★★ · moyen ★★ · grand ★ | montre une zone où est la réponse |
| **Le Pari** | une question ; juste, on garde ses deux étoiles ou on les parie sur une question plus difficile | garder ★★ · parier et réussir ★★★ | efface une mauvaise réponse |
| **L'Éclair** | cinq affirmations, vraies ou fausses, en 55 secondes | 5 justes ★★★ · 4 ★★ · 3 ★ | souffle la réponse de l'affirmation en cours |
| **Les Indices** | « Qui suis-je ? » : cinq indices du plus obscur au plus évident, un nom à taper | en 1 à 3 indices ★★★ · 4 ★★ · 5 et plus ★ ; chaque erreur compte, et en montre un de plus | un indice gratuit |
| **La Réplique** | le mot qui manque d'une réplique culte, puis « Qui l'a dit ? » | le bon mot ★★ · la bonne personne ★ | efface une mauvaise proposition |

Le Pari, l'Éclair, le Mot mystère et le Filet puisent dans la base de questions de la campagne ; le Détail dans ses cent tableaux ; la Frise dans les événements datés de la base et des frises à thème. L'Épingle, les Indices et la Réplique ont **un contenu neuf**, écrit et relu par des agents : des lieux datés de France, des fiches de personnages, des répliques de films, de théâtre et de chansons.

Ce que les tests de la maquette ont fait changer : l'Épingle plus tolérante, l'Éclair à 45 secondes, un chrono par étape à la Réplique, « ↑ Plus ancien » sur la frise, des boutons − et + au Filet, un en-tête et un pied collés — le chrono, le clavier, « Valider » — et des textes plus gros pour la grand-mère en 360 × 640. Puis ce que le calibrage sur le vrai code a fait changer le 25 octobre 2026, pour que les neuf jeux se valent : deux étoiles gardées au Pari, où une œuvre commune était presque hors d'atteinte ; deux erreurs qui ne valent plus une étoile à la Frise, qu'on gagnait en rangeant au hasard ; un indice de plus à chaque étoile des Indices ; l'Éclair à 55 secondes, qui prenait de court un joueur occasionnel une manche sur neuf.

## Les cartes-bonus

Avant chaque partie, on emporte une carte-bonus : une œuvre qu'on possède, les quatre de départ comprises, ou un gardien réveillé. **Son pouvoir vient de sa famille, sa rareté le rend plus fort** — une commune, force 1 ; une rare ou une maudite, 2 ; une épique ou un gardien, 3 —, et **elle ne s'use jamais**. La dernière choisie se retient sur le téléphone.

| Pouvoir | Qui le porte | Ce qu'il fait | Force 1 · 2 · 3 |
|---|---|---|---|
| **Éclairer** | l'Érudit, le Devin, cinq neutres | un indice, propre à chaque jeu (le tableau des jeux) | 1 · 2 · 3 indices par partie |
| **Protéger** | le Rempart, cinq neutres | la première manche imparfaite gagne des étoiles, une fois | +1 · +1 · +2 |
| **Prendre son temps** | l'Élan, cinq neutres | du temps en plus à chaque question — deux par manche au Pari et à la Réplique ; il ne compte que si tu t'en sers | +10 · +20 · +30 s |
| **Miser** | le Flambeur, le Téméraire, les trois maudites | avant une manche, sans l'avoir vue : parfaite, elle rapporte des étoiles en plus, jusqu'à 9 sur la partie ; sinon, elle ne vaut rien | +2 · +3 · +4 |
| **Changer** | le Métamorphe, le Sophiste, deux neutres | remplace la manche avant de répondre ; le chrono continue — jamais à la Frise | 1 · 2 · 3 fois |

Seul Éclairer s'écrit jeu par jeu ; les quatre autres valent partout, et un nouveau jeu ne leur demande rien. Là où il efface — un titre, une réponse, un mot, un nom —, Éclairer en laisse toujours deux : à la seconde étape de la Réplique, qui n'a que trois noms, un seul s'efface. **Les gardiens portent le pouvoir de la salle qu'ils gardent** : le Phénix protège comme le Rempart. Un pouvoir qui a servi — Éclairer, Changer, la mise, la protection, le temps en plus vraiment utilisé — ôte le cadre doré, et l'écran le dit : la manche aidée porte sa note (« éclairée », « changée », « temps en plus » ; une mise que les neuf étoiles de la partie bornent, « au-delà de 9 »), et le bilan d'un neuf sur neuf aidé nomme le pouvoir qui a servi ; une réponse qu'Éclairer ou le temps en plus a aidée ne mesure rien de ce que tu sais.

Ce que la maquette a fermé : la mise à ×2, qui dorait une épique en deux manches ; Protéger à +3, qui vidait les seuils de leur sens ; « Prendre son temps » qui dorait sans aide apparente.

## Une journée

- **La visite du jour** : trois parties, trois jeux différents. Chacune annonce l'œuvre qu'elle peut faire gagner sans la nommer — on la découvre une fois gagnée. Les jeux des deux derniers jours passent après les autres, et un jeu se change une fois par jour. Les œuvres en jeu se tirent parmi celles qui te manquaient à minuit, surtout des communes ; quand rien ne manque, une case propose de dorer, puis de la poussière.
- **Deux chasses par jour** : touche un cadre vide (« Elle se trouve au Filet · Il faut 6 étoiles sur 9 ») et pars à sa recherche, à son jeu ; ou rejoue une œuvre à toi pour la dorer. Après une partie de la visite manquée, « Retenter cette œuvre au même jeu » coûte une chasse : la case et le bilan le proposent, ou disent pourquoi pas (plus de chasse, l'œuvre gagnée depuis), et la demande vise la case — l'œuvre, tu la découvres en la gagnant.
- **Jouer librement** : les jeux livrés, à volonté, sans œuvre en jeu. Les cinq premières parties libres du jour rapportent de la poussière, deux par étoile — sans étoile, rien —, les suivantes sont pour le plaisir ; le bilan d'une libre qui paie sans rien rapporter dit combien il en reste.
- **La série** : les jours d'affilée avec une partie de visite ou de chasse. Elle se lit jusqu'à la veille tant que tu n'as pas joué : « 12 jours de visite d'affilée. Joue aujourd'hui pour garder ta série. » Trente jours réveillent le Scarabée.

Rien ne coûte avant de jouer : un joueur qui ne vient pas n'a rien écrit, et la visite du jour ne se fige qu'à sa première partie.

## La poussière d'or

La monnaie du Cabinet, **qui n'en sort jamais** : ni confettis, ni écus, ni boutique — la décision du propriétaire, pour que l'achat d'une œuvre ne fasse pas concurrence aux thèmes et aux compagnons.

- **Ce qui en rapporte** : toute partie de visite ou de chasse, même ratée — deux par étoile, quatre au moins ; un double — une œuvre que tu avais déjà, regagnée en visite — 15, 30, 30 ou 60 selon sa rareté ; les cinq premières parties libres du jour, deux par étoile.
- **Ce qu'elle achète** : une œuvre précise qui te manque — 200, 400, 400 ou 700 selon sa rareté (commune, rare, maudite, épique) — ou un cadre doré — 100, 200, 200 ou 320. Un gardien ne s'achète pas : il se réveille. Rien ne s'achète ni ne se dore pendant qu'une partie t'attend : ce qu'elle fait à son œuvre se décide à sa fin, et la case de la visite ne dit pas laquelle elle vise.
- **Ce que paie une partie, en plus** : chaque manche réussie (deux étoiles au moins) est une bonne réponse de la campagne — un confetti, l'expérience d'une bonne réponse, un pas pour le compagnon, les missions du jour. Trois au plus par partie, six au Pari.

Les rythmes simulés de la maquette : **tout posséder**, 18 à 24 jours pour un bon joueur, 19 à 39 pour un joueur moyen ; **tout dorer**, plusieurs mois — la longue traîne du complétionniste, et les dorures ont baissé de 40 % pour qu'elle reste atteignable. Remesurés sur le vrai code le 25 octobre 2026, tout doré ne prenait plus qu'un mois au complétionniste : les dorures ont doublé, et le double a été divisé par deux. Tout posséder prend 17 jours au bon joueur, 18 au moyen ; tout dorer, 47 et 61 jours, plus de six mois à qui vient quatre jours sur sept ([le calibrage](../reference/baremes.md#le-calibrage-du-cabinet)).

## Les gardiens

Les vingt-trois légendaires qui ont leur joker à l'Expédition deviennent les gardiens du Cabinet. **Un gardien réveillé, c'est le légendaire gagné**, avec sa carte-bonus : la plus forte de sa famille.

- **Deux par salle** (le tableau des salles) : le premier quand la salle est complète, le second quand tous ses cadres sont dorés.
- **Le Scarabée** : trente jours de visite ou de chasse d'affilée.
- **Le Trou noir** : le Cabinet entier, les 84 œuvres.
- **Trois gardiens de saison**, réveillés par la première œuvre gagnée en jouant pendant leur fête : la Citrouille à Halloween (du 25 octobre au 1ᵉʳ novembre), le Sapin à Noël (du 20 au 26 décembre), le Bouquet au Nouvel An (du 30 décembre au 2 janvier) — **à leur seule fête**, sans rattrapage : une fête qui revient chaque année est une bonne raison de revenir (la décision du propriétaire). Les dates sont celles de toutes les saisons de FiestApp, `shared/saisons.ts`.

Un légendaire que tu as déjà, par n'importe quelle voie, est un gardien réveillé : il ne se réannonce pas (« Salle complète ! Le Phénix veillait déjà sur elle »). Le Cabinet dit toujours le prochain : « La Chouette d’Argent : encore 2 œuvres dans la salle de l’Érudit ». Une œuvre peinte de plus dans une salle complète la rouvre sans endormir son gardien. Et le Cabinet ne dit rien des Divins, n'en montre rien, n'en réveille aucun.

## Ce qu'on apprend

- **Le cartel** : chaque œuvre gagnée garde la question, la réponse et l'anecdote de la manche que tu as le mieux réussie, avec le jeu, le jour et les étoiles. Il se lit seul. Une œuvre achetée ou offerte à l'arrivée le dit à sa place, et la rejouer pour dorer son cadre lui donne le sien.
- **Tes murs** : une carte de France où chaque lieu de l'Épingle reste épinglé, et une frise personnelle où chaque date apprise trouve sa place — rien ne s'écrit pour eux, ils se lisent de ce que tu as joué. Le musée y mène, sous les gardiens.
- **Le carnet** : les erreurs du Pari, du Mot mystère et du Filet y entrent, comme partout en campagne, et s'y signalent. Les affirmations de l'Éclair n'y vont pas — cinq questions récrites, dont aucune n'est plus celle de la base —, et l'écran le dit.
- **Rien ne revient avant sept jours**, d'un jeu à l'autre : le Pari et l'Éclair puisent dans le même tas.

## Les mots du Cabinet

Les mots de l'écran, que le glossaire de la page reprend. **Jamais « carte » seule** : l'Expédition a dû rebaptiser « le plan » la carte d'un acte, que le même mot confondait avec les cartes de la main.

| Mot | Ce que c'est |
|---|---|
| **Le Cabinet** | ton musée, tes neuf salles |
| **Une salle** | une famille et ses huit œuvres ; **le Vestibule**, les vingt neutres |
| **Une œuvre** | une des 84 cartes peintes, à gagner ; **un cadre vide**, une œuvre qui te manque, et le jeu où la chercher |
| **Le cadre doré** | une œuvre gagnée sans faute, ou dorée à la poussière |
| **Le cartel** | ce qu'une œuvre garde de la partie qui l'a gagnée — ou, entrée sans rien à raconter, de celle qui l'a dorée ou rejouée |
| **Une partie** | trois **manches** d'un même jeu, trois **étoiles** chacune |
| **La visite du jour** | trois parties, trois jeux, trois œuvres à gagner |
| **Une chasse** | une partie pour aller chercher une œuvre précise, ou la dorer |
| **Une partie libre** | pour le plaisir, sans œuvre en jeu |
| **La poussière d'or** | la monnaie du Cabinet, qui n'en sort jamais |
| **Une carte-bonus** | l'œuvre — ou le gardien — qu'on emporte, et son **pouvoir** |
| **Un gardien** | un légendaire, réveillé par une salle complète, une salle dorée, la série, le Cabinet entier ou une fête |
| **Tes murs** | ta carte de France et ta frise : ce que tu as appris, à sa place |

## Ce que l'Expédition laisse

L'Expédition était devenue un jeu de cartes à la Slay the Spire — quinze versions en quatre jours, une partie de vingt à trente questions qui pouvait se perdre, le pire format pour un joueur de cinq minutes. Elle laisse au Cabinet ses 84 peintures, ses 23 légendaires à joker et leurs médaillons, ses formes de question devenues des jeux (le vrai ou faux de l'Éclair, les lettres du Mot mystère, la frise, le détail, les valeurs du Filet), et sa saison des fêtes devenue les gardiens de saison.

**Chacun commence son Cabinet à zéro** — les quatre œuvres de départ, rien de rapporté de l'Expédition, qui n'était qu'en essai (la décision du propriétaire du 25 octobre 2026, `docs/architecture/decisions.md`) —, **et ce qu'elle a donné reste** :

- tout légendaire qu'ils possèdent est un gardien qui veillait déjà, sans cérémonie ;
- une expédition en route se finit à ses règles, ou s'abandonne sans rien reprendre ;
- le trophée L'Explorateur garde ses détenteurs, et ses paliers se reliront aux salles complètes une fois le Cabinet ouvert — le crochet est prêt, pas encore branché ; Le Globe-trotter reste montré, figé ; la luciole, qui rejoignait qui menait une expédition au bout, rejoint qui complète sa première salle.

Le gros bouton de l'accueil d'un profil deviendra « Le Cabinet de curiosités », à la place de « L'Expédition » (la décision du propriétaire), quand le Cabinet ouvrira : le départ de l'Expédition se ferme alors, d'un seul drapeau (`EXPEDITION_REMPLACEE`) — sa page dit « L'Expédition a laissé place au Cabinet de curiosités » et y mène, et une expédition en route se finit. Le bouton dit ton musée — « Ton musée : 27 œuvres sur 84 », et « À jouer » tant que la visite du jour attend — de ce que le serveur en sait déjà : l'accueil n'attend rien de plus pour lui. La contrepartie : **après chaque réveil du serveur, le bouton garde sa ligne de toujours, sans « À jouer », jusqu'à ce que tu ouvres le Cabinet** — et la production dort chaque nuit, jusqu'à son réveil de 6 h 55 : le premier passage du jour à l'accueil ne rappelle donc pas la visite. Un choix de sobriété, à confirmer par le propriétaire ([les décisions](../architecture/decisions.md), « Le bouton de l'accueil ne lit le musée qu'en mémoire »).

## Ce qui vient ensuite

- **L'ouverture** : les corrections de la tablée d'agents du 25 octobre 2026 (`retours/2026-10-25/synthese.md`) et les barèmes qu'elle a fait trancher, recalibrés ; puis le Cabinet ouvert en production, et le seul départ de l'Expédition fermé.
- **Après la V1** : l'Épingle du monde ; le dévoilement, le rébus et les curiosités en jeux ; un dictionnaire pour le Mot mystère ; le signalement du contenu neuf ; une page du QG pour le Cabinet.

## Les règles chiffrées

| | Valeur |
|---|---|
| Une partie | 3 manches de 3 étoiles, 9 au plus |
| Le seuil d'une œuvre | commune 5, rare 6, maudite 6, épique 7 étoiles |
| Une manche réussie | 2 étoiles naturelles au moins ; au Pari, la bonne réponse |
| La journée | une visite de 3 parties, 1 jeu à changer, 2 chasses, 5 parties libres qui paient |
| La poussière | 2 par étoile, 4 au moins ; un double 15 · 30 · 30 · 60 |
| Les prix | une œuvre 200 · 400 · 400 · 700 ; un cadre doré 100 · 200 · 200 · 320 |
| Les durées | l'Épingle 45 s, la Frise 60, le Mot mystère 120, le Détail 45, le Filet 45, le Pari 35 par étape, l'Éclair 55, les Indices 75, la Réplique 25 par étape |
| La grâce, la pause | 1,5 s après l'échéance ; 30 s de pause au plus par manche |
| La fraîcheur | rien ne revient avant 7 jours |
| Le Scarabée | 30 jours d'affilée |
| Le plafond | 30 départs d'un coup, puis un toutes les deux minutes |

Chaque constante, sa valeur et ce que la changer implique : [les barèmes](../reference/baremes.md#le-cabinet-de-curiosités). Les choix qui les ont fixées, et ceux que le propriétaire a délégués : [les décisions](../architecture/decisions.md#le-cabinet-de-curiosités).

## Comment c'est construit

- **Tout ce qui se décrit sans jouer est pur et partagé**, dans `shared/cabinet/` : les 84 œuvres et le jeu de chacune (`shared/cabinet/oeuvres.ts`), les salles et leurs gardiens (`shared/cabinet/salles.ts`), les pouvoirs, leurs forces et leurs refus (`shared/cabinet/pouvoirs.ts`), tous les chiffres (`shared/cabinet/bareme.ts`), le drapeau et les jeux livrés (`shared/cabinet/ouverture.ts`), les identifiants des pièces (`shared/cabinet/pieces.ts`), la carte de France (`shared/cabinet/france.ts`), la forme du contenu neuf (`shared/cabinet/contenu.ts`) et le moule des jeux (`shared/cabinet/jeux/regle.ts`). Les œuvres recopient les cartes des rencontres plutôt que de les importer : la page du musée ne tire pas le catalogue de l'Expédition, et `server/test/cabinet-catalogue.test.ts` relit l'un contre l'autre.
- **Une partie est une série de la campagne d'un autre mode** (`campagne_series`, `mode = 'cabinet'`) : son départ figé, ses gestes, puis une ligne de réponse par manche jugée — l'expérience, les confettis, le compagnon, les missions et le carnet la comptent sans rien savoir du Cabinet. Ce qui n'est pas une question de la base porte un seul préfixe, `cab:`, que le carnet, la mesure et le signalement écartent.
- **L'état d'une partie se replie de son départ et de ses gestes** (l'invariant 14) : chaque geste s'écrit avant que sa réponse parte, l'ouverture de chaque manche comprise, si bien qu'un redémarrage du serveur — la veille de l'hébergeur, une mise en ligne — reprend la manche à son échéance.
- **La sobriété** : une page relue d'un aller-retour au réveil, puis zéro ; un aller-retour par geste ; aucune lecture qui grandisse avec l'histoire d'un joueur.
- **La page** (`/cabinet`, `client/src/views/CabinetApp.tsx` et `client/src/views/cabinet/`) : le musée et ses écrans, chacun à son fragment — une salle (`#salle-rempart`), une œuvre et son cartel (`#oeuvre-bastion`), les gardiens, la visite du jour, les jeux libres —, et « Comment ça marche ? » en feuille. Elle ne lit que la vue du serveur (`PageDuCabinet`), sans recopier une règle, et ne télécharge ni l'Expédition ni les règles qui jugent une partie ; aucun de ses textes ne descend sous dix-sept pixels. Une partie s'ouvre par-dessus le musée : l'annonce, qui ne consomme rien avant « Commencer », les manches, le bilan (`client/src/views/cabinet/{Annonce,Partie,Bilan}.tsx`). Les neuf jeux s'y jouent, chacun son écran chargé à la demande.
- `.claude/rules/cabinet.md` — les fichiers et les pièges du domaine, pour qui modifie le code.
