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
