# La nuit du 12 octobre 2026 — la télé branchée, les prix, les équipes

Le propriétaire a demandé, le 12 octobre au soir, « une revue sur le scénario
où on branche une télé ». Elle a été faite en rejouant le scénario entier sur
un serveur jetable, une télé en 1920 × 1080 et le téléphone du chef en
360 × 640 (`server/scripts/rendu-tele.ts`, nouveau) : `/tele` et son code,
« Créer un salon » et « Sur une télé », le code tapé, le salon ouvert, quatre
invités, une question et sa révélation, le téléphone du chef qui s'en va
puis revient, la télé rechargée, le serveur qui redémarre, le podium, la
clôture. Le journal du script dit, à chaque moment, si la télé montre la
salle ou la console de l'animateur, et ce qui s'y toucherait.

## En bref

**La télé d'un salon montrait la console de l'animateur**, du branchement
jusqu'à la clôture : le panneau des invités et la création d'équipes,
« Lancer un quiz », « Mes quiz », « Mon compte », « Historique »,
« Accueil », « Clore la soirée », puis pendant la partie « Révéler »,
« Pause », « Suivante », « Reposer », « Annuler les points » — sur une télé
que personne ne peut toucher. La salle d'attente vue de loin, faite pour elle
le 3 octobre (le code du salon en grand, le QR, ceux qui arrivent, « Nadia
lance la partie depuis son téléphone »), ne s'affichait jamais : elle
attendait une télécommande déclarée, et la barre du chef n'en déclarait pas.

Le reste du scénario tient : le code se lit de loin et se tape sans
ambiguïté, la télé s'ouvre deux secondes après sa validation, rechargée elle
revient où elle était, et après un redémarrage du serveur la télé et la
barre du chef reprennent d'elles-mêmes la question en cours.

## Les constats

| # | Constat | Verdict |
|---|---|---|
| 1 | La télé d'un salon montre toute la console, du branchement à la clôture | **Corrigé** : branchée par un code, la télé est un écran de salle dès son branchement (`ecranDeSalle`) |
| 2 | Un téléphone qui se verrouille rend la console à la télé (la télécommande partie, la télé « reprend la main ») | **Corrigé**, par la même règle ; quand personne ne l'anime, un lien discret, « Piloter d'ici », rend la console à qui a une souris |
| 3 | Pendant le choix du quiz, la télé montre le panneau des invités et la liste des quiz | **Corrigé** : la salle d'attente vue de loin, et les coulisses restent au téléphone |
| 4 | Les consignes se contredisent : la télécommande dit d'ouvrir `/host` sur la télé, qui « pourra alors piloter ta soirée » ; le salon et la télé disent `/tele` ; « Mon compte » ne connaît que l'ordinateur relié à la télé | **Corrigé** : `/tele` partout, et la télé « montre » la soirée |
| 5 | « Télé branchée » est sans retour : la télé rechargée entre-temps montre un code neuf, l'ancien n'ouvre plus rien, et le champ ne revient qu'en rechargeant la page — et ses choix avec | **Corrigé** : « Télé branchée : elle s'ouvre dans un instant », et « Une autre télé ? » rouvre le champ |
| 6 | « Terminer le quiz » sur le dernier du programme clôt la soirée sans le dire : la boîte parle d'un quiz seul, et le chef qui voulait encore le podium tombe sur sa fin de soirée | **Corrigé** : « Terminer ce quiz et la soirée ? », lu dans l'état de la partie (une barre rechargée le sait encore) |
| 7 | Une télé branchée garde sa connexion au-delà de sa soirée : un écran de salle ne fait aucun geste qui relirait sa session de 24 heures, et allumée chez un ami elle recevait ses soirées des jours plus tard | **Corrigé** : sa connexion tombe à l'heure de sa fin, et sa page revient à son code |
| 8 | « 0 joueur » s'écrit en chiffres à l'ancienne : « O joueur » de l'autre bout de la pièce | **Corrigé** (`lining-nums`) |
| 9 | Deux écrans de salle dans la même pièce jouent la fanfare deux fois | Laissé : rare, et les couper demanderait de désigner l'un des deux |
| 10 | La tablée (`npm run tablee`) ne sait pas jouer une télé branchée par `/tele` | Laissé : l'outillage des agents, pas le produit |
| 11 | Aucun script ne rejouait la télé | **Fait** : `rendu-tele.ts` |

Les tests : `tele-salle.test.ts` (la règle de l'écran de salle, « Piloter
d'ici », les consignes), `appairage.test.ts` (la connexion qui tombe à la fin
de la soirée), `cloture-auto.test.ts` (le dernier quiz du programme dans la
vue d'animateur). PR #158.

# Les prix : pour le plaisir

La question du propriétaire : « les prix, je pense qu'il n'y a plus de prix
à décerner vraiment ? Ou du moins uniquement pour le fun. »

**Ce qu'il en restait.** Deux choses portent ce nom. Le **palmarès** — une
vingtaine de prix calculés tout seuls (L'Éclair, Le Cancre Magnifique,
L'Abstentionniste…) — ne rapporte plus d'expérience depuis longtemps : il se
lit au souvenir et se range sur l'étagère des profils, remis ou non. Et la
**remise des prix**, à l'écran : chaque prix remis ajoutait **cent points
d'équipe** d'office, de quoi renverser la victoire qu'on venait d'annoncer —
c'était même le bouton principal au podium d'un quiz en équipes, devant
« Quiz suivant ». La tablée l'avait déjà vu le 24 septembre : « après deux
prix pour rire aux Guitaristes, c'était 4-4 » (`2026-09-24/nadia.md`).

**Ce qui change** (un choix de produit, dit ici et dans la PR) :

- un prix remis vaut **zéro point d'office** (`POINTS_D_UN_PRIX`) : la télé
  l'annonce « pour l'honneur », le classement ne bouge pas ; le champ reste,
  pour qui veut qu'un prix compte, et ce qu'il changerait se dit alors avant
  le clic ;
- au podium d'un quiz, **« Quiz suivant » passe devant « Remise des prix »** ;
- « Avant les prix : ils peuvent encore changer l'ordre » ne s'écrit plus
  sous le podium — « Prix à points compris » seulement s'il y en a ;
- la phrase des équipes, partout : « le plus de points d'équipe l'emporte ;
  un prix est pour le plaisir, sauf si l'animateur lui donne des points » ;
- « Revenir aux prix », à l'écran de victoire, devient « Remise des prix ».

Les soirées passées gardent leurs prix tels qu'ils ont été remis : chaque
prix porte ses points au journal, rien ne se recalcule. PR #159.

# Les équipes, préparées avant d'ouvrir le salon

Le souhait : « préparer les équipes avant de créer le salon ». « En équipes »
dormait dans les réglages repliés de « Créer un salon », et c'est la barre du
chef qui créait deux équipes, une fois le salon ouvert : on les renommait la
salle déjà là, et les premiers arrivés entraient sans.

Désormais « Les équipes » a son bloc, sous « Et toi ? » : « Chacun pour soi »
ou « En équipes » ; en équipes, deux proposées, une ligne chacune, qu'un
toucher renomme dans la feuille de la barre du chef (nom, emoji) —
« Ajouter une équipe » ajoute la suivante, dix au plus, deux au moins.
« Ouvrir le salon » les envoie, le serveur les pose avant le premier invité,
et le téléphone les retient pour la fois suivante. Le chef qui joue choisit
la sienne en entrant, comme ses invités. Une soirée qui a déjà ses équipes
les garde. Le rendu (`rendu-tele.ts`, étapes 2b et 4) les photographie.

# Les tirages sans redites

Le dernier point de l'atelier du 11 octobre (`2026-10-11/synthese.md`,
« Une question par gabarit dans une épreuve ») : au premier palier de la
forêt, seize questions en posaient quatre « Comment appelle-t-on le petit
de… », mêmes leurres. La base a des familles écrites en série — deux cent
vingt-quatre « Qui a réalisé le film… », cent quatre « Qui a reçu le
prix… » —, et le tirage ne regardait que la catégorie et le sous-thème.

Mesuré sur la vraie base, avant d'y toucher : une série du petit écran
posait onze paires de **jumelles** (la même forme d'intitulé, ses trois
premiers mots pleins, ou deux réponses en commun) dans ses vingt premières
questions, dont cinq « Qui a créé la série… » ; une série de géographie
cinq paires, trois capitales ; un quiz tout prêt de géographie deux paires.

- **Les épreuves** des sentiers ne prennent plus deux jumelles quand la
  marche en a d'autres aussi fraîches ; un **duel** se tire sur ce que ses
  deux joueurs n'ont pas vu (PR #161).
- **Les séries, le défi de la semaine, les duels** : les marches se tirent
  dans l'ordre où la série les pose, et partagent leurs comptes — les
  catégories tournent d'une marche à l'autre (chacune repartait de zéro, et
  une même catégorie pouvait ouvrir les quatre), et une jumelle se juge sur
  tout ce qui a été posé avant elle. Le petit écran passe de 11,4 paires à
  0,4, la géographie de 5,0 à 0,2, le cinéma de 3,0 à 0.
- **Les quiz tout prêts** : de chaque sous-thème, une question qui n'est la
  jumelle d'aucune déjà prise ; plus aucune paire sur huit compositions
  types.

La fraîcheur passe toujours devant : une jumelle jamais vue bat une question
déjà vue. Le tirage garde son temps (1 à 3 ms une épreuve, 1 à 15 ms une
série). Les règles : `core/jumelles.ts` ; les tests :
`tirage-sans-redite.test.ts`.

# Les mots du solo, et la carte de qui ne joue qu'en solo

Deux points de l'atelier du 11 octobre, encore ouverts.

**Les mots** (#163) — le tableau « Les mots qu'un joueur ne comprend pas » :
plus de « il » pour un prénom (« Bérénice s'était arrêté avant », « s'il a
activé les notifications », « quand il l'a joué »), « plus qu'une vie »,
« haut fait du Tour du monde » (c'est aussi le sentier de la culture
générale), « Le défi d'Aline », « 1 joueur l'a joué » (son auteur ne le
relève pas), « Me changer » au lieu de « Ma carte », la vitrine qui se gagne
aussi en solo, « des portraits à gagner » à l'accueil, « Reprendre à la
question 2 » au carnet. Regardés en 360 × 640 : le bouton du carnet, avec
« question 10 sur 10 », aurait débordé ; l'accueil tenait en trois lignes
avec « des sentiers où gagner des portraits ».

**La carte** (#164) — ouverte depuis le classement du défi de la semaine,
la carte de qui ne joue qu'en solo disait « Soirées 0 · Quiz gagnés 0 ·
Coup d'œil — · Réflexe — ». Sans soirée, ses cadrans sont ceux du solo :
son record de série, les paliers de ses sentiers, ses bonnes réponses de
campagne — chacun s'il a quelque chose à dire. Qui joue aussi en soirée
garde les cadrans des soirées, et sa campagne en pastille.

# La feuille du quiz tout prêt dit ce qu'il composera

Le constat 9 de l'animatrice exigeante (atelier du 11 octobre) : « Des
estimations », cochées d'office, promettaient une question sur cinq, et
dix-huit réglages sur cent trois en livraient moins sans rien dire — « Les
records » aucune ; le résumé disait « 3 catégories » sans dire lesquelles.
Un aperçu du serveur (`POST /api/quiz-tout-pret/apercu`, le même tirage que
« Composer », rien d'écrit) compte maintenant les questions et les
estimations, et le résumé le dit : « Toutes les catégories · progressive ·
≈ 8 min · dont 3 estimations », « Les records · … · aucune estimation ici »,
« Cuisine · … · 12 questions seulement ». Le bouton dit le vrai nombre de
questions. PR #165.

Mesuré aussi cette nuit, client d'avant la nuit (#157) contre client d'après
(#164), en séries entrelacées sur la même machine (4G, processeur ×4, trois
essais, deux tours) : aucune page n'a ralenti — les écarts tiennent dans le
bruit (±70 ms sur l'écran utile, ±40 ms de script), le JavaScript pèse le
même poids à un kilo-octet près.

# « Une autre », dans l'éditeur

Le constat 8 de l'animatrice exigeante : rien ne remplaçait une question
qu'on n'aime pas dans un quiz tout prêt — retirer le Tarantino du quiz des
enfants le laissait à quatorze. Chaque question tirée de la base a
maintenant « Une autre » : sa voisine de la même catégorie, de la même
marche et de la même sorte (une estimation pour une estimation), pas plus
vieille d'âge, hors de la bibliothèque et du quiz, ni la jumelle d'une autre
de ses questions — ses sujets d'abord, puis la jamais posée. Rien ne
s'écrit au serveur : la carte la prend, et « Enregistrer » la range. Au
téléphone, le bouton ajoute une ligne aux seules cartes de la base ; la
marche de chaque question, que le quiz ne garde pas, reste à montrer.
PR #166.

# Le premier titre d'un débutant

Le constat 11 de l'experte du jeu solo : « Mon titre » disait « Aucun ·
53 titres à gagner », et rien de plus — le crayon du vestiaire menait à une
page sans choix, et rien ne disait comment gagner le premier. « Mon titre »
et « Ma vitrine » d'un profil qui n'a encore aucun haut fait disent
maintenant le plus proche, sa jauge comprise — « L'Alpiniste · Bronze,
6 sur 10 bonnes réponses dans une série de campagne » : un premier palier de
carrière, seul à se commencer (`lePremierHautFait`) —, sinon le plus simple
pour commencer, L'Alpiniste, qu'une série suffit à gagner, sans personne et
à toute heure. Dès le premier haut fait, plus rien : il a son titre.
PR #167.

# Le défi de la semaine sur l'accueil

Le constat 5 de l'experte du jeu solo, laissé en suspens : le défi de la
semaine, neuf chaque lundi, ne se trouvait qu'au troisième onglet de la
campagne, et le bouton de l'accueil n'en disait rien. Il le dit maintenant,
tant qu'il n'est pas fini, à qui a déjà joué la campagne — un débutant garde
la phrase qui dit ce qu'on y fait : « Le défi de la semaine : 3 joueurs
l'ont relevé », pastille « À relever » ; commencé, « Ton défi de la semaine
t'attend : reprends-le », « À finir ». Il ne passe devant le carnet que
commencé, le lundi, ou pour qui en a déjà relevé un : un joueur assidu a
presque chaque jour des questions à revoir, et devant elles toute la
semaine, le défi aurait caché le rendez-vous du carnet à qui ne le joue
jamais. Le serveur le lit en une requête, de front avec les sentiers et le
carnet : l'accueil n'attend rien de plus.
