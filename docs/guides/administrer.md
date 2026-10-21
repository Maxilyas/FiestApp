# Administrer FiestApp

> Le guide de l'administrateur du serveur : entrer au QG (`/admin`), puis, page par page, ce qu'on y trouve et ce qu'on y fait — surveiller le serveur, prévenir les joueurs d'un problème et fermer ce qui ne marche pas, leur annoncer qu'il est réglé, clore une soirée laissée en plan, aider un joueur ou le modérer, veiller sur les salons, relire le catalogue, tenir les réserves de questions, relire les questions signalées, annuler un duel que l'adversaire n'a pas commencé, suivre les confettis.

**Dans cette page** : [Entrer au QG](#entrer-au-qg) · [La vue d'ensemble](#la-vue-densemble) · [Le journal](#le-journal-de-tes-gestes) · [Les erreurs](#les-erreurs-et-les-pannes) · [Le serveur](#la-santé-du-serveur) · [La maintenance](#la-maintenance) · [Les annonces](#les-annonces) · [Les soirées](#les-soirées) · [Les profils](#les-profils-et-la-fiche-dun-joueur) · [Les salons](#les-salons) · [Le catalogue](#le-catalogue) · [Les signalements](#les-signalements) · [Le quiz du jour](#le-quiz-du-jour) · [La campagne](#la-campagne-et-les-sentiers) · [Les duels](#les-duels) · [L'économie](#léconomie) · [Les comptes d'avant](#les-comptes-davant)

> [!NOTE]
> Le QG a grandi page après page : chaque mode de jeu y a la sienne — le quiz du jour, la campagne, les duels —, l'économie et les signalements aussi ; « Animer » a commencé par les annonces, les événements et la mise en avant viendront à leur tour. Ce guide dit ce que chaque page montre et permet ; la place exacte d'un chiffre peut bouger.

## Entrer au QG

Le QG est réservé au compte administrateur : celui que le serveur crée à son tout premier démarrage, sur une base encore vide, à partir de `ADMIN_LOGIN`, `ADMIN_PASSWORD`, `ADMIN_SLUG` et `ADMIN_NAME` (voir [la mise en ligne](../exploitation/mise-en-ligne.md)). Ces variables ne servent qu'à cette naissance : les changer ensuite ne change rien au compte. En ligne, sur une base vide, le serveur refuse de démarrer sans un vrai `ADMIN_PASSWORD` — `demo`, la valeur par défaut, ne passe pas.

1. Ouvre `/connexion` (« Espace animateur ») et entre ton identifiant et ton mot de passe. Si ton profil de joueur tient ton espace, te connecter à ton profil ouvre aussi ta console.
2. Ouvre `/admin` — ou, depuis « Compte », « Administration · Toi seul » › « Le QG ». Sans session, `/admin` te renvoie à la connexion, puis t'y ramène.

Un autre animateur lit « Cette page est réservée à l'administrateur. » ; une télé branchée par un code n'administre rien, pas même celle que ta console a branchée. Des espaces des autres, le QG ne montre que des chiffres : leurs quiz, leurs questions, les prénoms de leurs invités et les titres de leurs soirées restent chez leur animateur.

| Page | Adresse | Ce que tu y trouves |
|---|---|---|
| La vue d'ensemble | `/admin` | l'instant, ce qui attend un geste, la journée, trente jours, le serveur |
| Le journal | `/admin#journal` | tes gestes, du plus récent au plus ancien |
| Les erreurs | `/admin#erreurs` | les erreurs serveur de la semaine, à trier — à regarder, réglées, ignorées —, les modes de jeu en panne, et ton téléphone, que leur panne fait sonner |
| Le serveur | `/admin#serveur` | sept jours de santé, heure par heure |
| La maintenance | `/admin#maintenance` | le bandeau rouge qui prévient les joueurs d'un problème, les pages fermées le temps d'une réparation, et celles bientôt disponibles, ouvertes à leurs seuls testeurs |
| L'activité | `/admin#activite` | trente jours de questions jouées et de parties, mode par mode, et qui joue à quoi |
| Les soirées | `/admin#soirees` | celles qui se jouent, celles laissées en plan, le bilan du mois |
| Le quiz du jour | `/admin#jour` | la journée, la réserve, le tirage, le classement, les séries, le rappel du soir |
| La campagne | `/admin#campagne` | la journée, ce qu'on joue, le défi de la semaine, les parcours, les vies, les sentiers et leurs mélanges, la base, la routine du matin |
| Les duels | `/admin#duels` | la journée, les duels par jour, les ligues, le classement, les duels qui attendent leur adversaire |
| Les profils | `/admin#profils` | chaque joueur, et sa fiche |
| Les salons | `/admin#salons` | chaque espace du serveur |
| L'économie | `/admin#economie` | les confettis gagnés et dépensés, d'où ils viennent, où ils partent, ce qui circule, les meilleures ventes, les Éclats et les légendaires |
| Le catalogue | `/admin#catalogue` | les copies de quiz proposées à tous |
| Les signalements | `/admin#signalements` | les questions que les joueurs signalent, au quiz du jour et en campagne, et celles relues ces trente jours |
| Les annonces | `/admin#annonces` | un message à tous les profils, lu une fois en haut de leur accueil — une panne réglée, une nouveauté —, avec des confettis pour chacun si tu veux |

Le QG se tient à jour seul — le direct toutes les dix secondes, la vue d'ensemble toutes les cinq minutes et chaque fois que tu y reviens — et ne relit rien tant que l'onglet est caché. En tête, « En direct » ; si le serveur se tait, « Dernier relevé à 21 h 40 » ou « Le serveur ne répond pas ».

## La vue d'ensemble

**En ce moment** : les soirées en cours (« et 1 laissée en plan »), les invités connectés sur ceux inscrits ce soir, les profils passés ces cinq dernières minutes, et les écritures qui attendent le miroir Turso — « miroir à jour », ou « Turso en échec depuis 21 h 05 », « 2 salons en retard ».

**À traiter** : ce qui attend un geste, le plus pressé d'abord ; une ligne qui a sa page l'ouvre. Rien ? « Rien n'attend de geste : la réserve tient, personne ne signale rien. »

| La ligne | Elle paraît quand… | Où agir |
|---|---|---|
| « Panne : le quiz du jour » (rouge) | un mode de jeu ne répond plus : une de ses routes échoue au moins trois fois en dix minutes, et plus souvent qu'elle ne réussit — depuis quand, combien d'échecs, le dernier | Les erreurs |
| « Le miroir Turso est en panne » (rouge) | Turso échoue, ou des salons sont en retard | [Exploiter](../exploitation/exploiter.md) |
| « Le serveur s'est arrêté net » (rouge) | un démarrage des dernières 24 heures s'est arrêté sans s'éteindre proprement | Le serveur |
| « N erreurs serveur à regarder » (rouge) | des erreurs depuis le début de l'heure d'avant, sans celles que tu as réglées ou ignorées ; la source la plus fréquente est nommée | Les erreurs |
| « La mémoire approche du plafond » (rouge) | plus de 450 Mo, sur les 512 de l'hébergeur | Le serveur |
| « Turso répond lentement » | plus d'une seconde au 95ᵉ centile, sur au moins vingt allers-retours | Le serveur |
| « La réserve du quiz du jour » (rouge) | moins de sept jours d'avance | Le quiz du jour |
| « 3 questions signalées » | des questions signalées, au quiz du jour ou en campagne — le détail dit combien de chaque mode, et par combien de joueurs | Les signalements |
| « Une copie à relire » | des copies proposées au catalogue | Le catalogue |
| « Une soirée laissée en plan » | six heures sans un signe de vie | Les soirées |
| « Le rappel du soir » | des envois en échec à la dernière tournée | — |

**Aujourd'hui** : Profils actifs, Quiz du jour, Séries de campagne, Duels joués, Nouveaux profils, Achats en boutique — chacun comparé à la même heure, en moyenne sur les sept jours d'avant (« 12 % » et sa flèche ; sous vingt d'habitude, « 7 d'habitude » ; ou « comme d'habitude »), avec le trait des douze derniers jours. Comparé à des journées entières, un soir à 21 h se lisait toujours en baisse.

**Participations par jour** : trente jours, mode par mode — soirées, campagne, quiz du jour, duels. Un joueur compte une fois par mode et par jour ; en soirée, chaque invité qui a joué, au jour de la première question. « Les chiffres, jour par jour » déplie le tableau.

**Soirées en cours** : chaque soirée par son salon — où elle en est, depuis quand, combien de téléphones connectés sur combien d'inscrits, « aucun écran branché » s'il y a lieu, « sauvegardée » ou « sauvegarde en retard ». **Le serveur** : mémoire, processeur (en part d'un cœur), boucle occupée, Turso au 95ᵉ centile, connexions temps réel, et le dernier dépôt de la routine du matin dans la réserve du quiz du jour et dans la base de la campagne.

## L'activité

Ce que les joueurs font, en quantité : la vue d'ensemble compte les joueurs, cette page ce qu'ils ont joué, sur trente jours. Une **question jouée** est une question posée à un joueur, qu'il y ait répondu ou l'ait laissée au temps — en soirée, une par invité et par question ; une **partie**, un quiz de soirée, une partie du quiz du jour ou de campagne, un duel (chaque côté d'un duel classé compte le sien). Une partie se date à son début.

- **Ces trente jours** : une tuile par mode — ses questions jouées en grand, ses parties et ses joueurs dessous (en soirée, les soirées et leurs invités qui ont joué).
- **Jour par jour** : un petit graphique par mode, chacun à son échelle — les soirées montent d'un coup le samedi, la campagne tous les jours ; « Questions jouées » ou « Parties ». Le jour touché se lit sous chacun.
- **Qui joue à quoi** : chaque profil, le plus assidu d'abord, et une barre — sa longueur dit combien il a joué, ses couleurs à quoi —, avec ses questions, ses jours et le mode où il joue le plus (« surtout la campagne, 82 % »). « Tous les modes », ou un seul : les plus assidus de ce mode. Dix d'abord, cinquante au plus ; une ligne ouvre sa fiche. Les invités sans profil n'y sont pas : ils ne comptent qu'au volume des soirées.

La fiche d'un joueur dit aussi ses trente jours, mode par mode (« Trente jours : 340 questions en 12 jours : campagne 280, quiz du jour 60 »).

## Le journal de tes gestes

Chaque geste du QG qui change quelque chose s'y note de lui-même, en une phrase qui nomme ce qu'il a touché : « Profil supprimé : Tom (@tom) », « Espace désactivé : Nadia B. », « Soirée laissée en plan close : Antoine — rien n'avait été joué ». Un refus ne s'y note jamais. Un geste noté ne se modifie ni ne s'efface : défaire, c'est faire le geste contraire, qui se note à son tour. Le journal garde le nom d'un profil supprimé — la trace de ce qui a eu lieu.

Filtres : Tous, Soirées, Profils, Salons, Catalogue, Quiz du jour, Campagne, Duels, Maintenance, Annonces, Erreurs. Les gestes se rangent par jour (« Aujourd'hui », « Hier », puis la date), cinquante à la fois (« Voir les gestes d'avant »). La fiche d'un joueur reprend les tiens sur son profil (« Tes gestes sur ce profil »). Un code de secours tiré n'y paraît jamais, seulement sa phrase : « Code de secours neuf tiré : Léa (@lea) ».

## Les erreurs et les pannes

Les erreurs serveur de la semaine — celles qu'un joueur a lues « Erreur serveur — réessaie dans un instant » —, les mêmes comptées ensemble, et ce que tu en as dit. Elles avaient leur liste sur la page du serveur ; elles ont maintenant leur page, où chacune se trie. Seules celles **à regarder** allument la ligne rouge de la vue d'ensemble.

- **En panne maintenant** : les modes de jeu qui ne répondent plus — le quiz du jour, la campagne, le défi de la semaine, les duels, l'Expédition, les soirées, la boutique, l'accueil et la connexion des profils. Un mode tombe quand une de ses routes, ou un message du temps réel, échoue au moins trois fois en dix minutes et plus souvent qu'elle ne réussit ; un refus (un mot de passe faux, une page en maintenance) n'est pas un échec. Chacun dit depuis quand, ses échecs, le dernier, et la route qui l'a fait tomber. Il se dit **rétabli** quand chaque route tombée a réussi de nouveau, sans un échec pendant un quart d'heure. Un redémarrage — la mise en ligne de la réparation — ne l'oublie pas.
- **Ce qui a échoué**, en trois onglets — **À regarder**, **Réglées**, **Ignorées**, chacun son compte. Chaque ligne dit d'où elle vient (la route sous son modèle, le message du temps réel), sa sorte et son message, combien de fois, la dernière fois, et l'endroit du code qui l'a levée (« JourStore.repondre · server/src/core/jour.ts »). Touchée, elle ouvre sa fiche : le message entier, son code (`SQLITE_BUSY`, `ECONNRESET`), la première et la dernière fois, les versions où elle est tombée, ses heures, sa pile d'appels ramenée aux fichiers du dépôt, et « Copier le détail », pour la réparer ailleurs. Rien n'y garde un jeton, les paramètres d'une adresse ni le texte qu'une requête illisible citait.
- **La trier**, depuis sa fiche, avec un mot si tu veux (« PR #284 », « un hoquet de Turso », 80 caractères au plus) :
  - **Réglée** : elle sort de la liste à regarder. Si elle retombe sous une version qui ne l'avait jamais vue — celle qui portait la réparation —, elle revient d'elle-même, marquée « Revenue après avoir été réglée » : la réparation n'a pas pris. Si elle retombe sous une version qui l'avait déjà vue, elle reste réglée : la réparation attend sa mise en ligne, et sa ligne le dit.
  - **Ignorer : sans gravité** : elle ne sonnera plus, même si elle retombe.
  - **Remettre à regarder** : son tri s'efface.

  Le tri tient au-delà des huit jours du relevé : une erreur ignorée qui retombe dans un mois le reste. Chaque geste se note au journal, sous « Erreurs ».
- **Comptées sans leur détail** : douze erreurs différentes par heure gardent leur détail ; au-delà, et pour celles d'avant le 17 octobre 2026, elles se comptent par source, et ne se trient pas.
- **Sur ton téléphone** : « Prévenir ce téléphone » le fait sonner à la panne d'un mode, puis à son retour — rien d'autre : ni une erreur seule, ni un joueur qui se trompe de mot de passe. Une seule notification pour les modes tombés ensemble (une base muette les fait tous tomber) ; elle dit les modes, le nombre d'échecs et la route, jamais un prénom ni un message d'erreur, et la toucher ouvre cette page. Sur Android, un onglet de Chrome suffit ; sur iPhone, ajoute d'abord FiestApp à l'écran d'accueil — Partager, puis « Sur l'écran d'accueil » — et ouvre le QG depuis l'application. Cinq téléphones au plus, chacun son « Retirer » ; « Faire sonner mes téléphones » envoie un essai. Ces notifications ne sont pas le rappel du soir : couper l'un ne coupe pas l'autre, et une déconnexion ne les éteint pas.

## La santé du serveur

Sept jours, heure par heure, gardés dans la base permanente ; la nuit, l'hébergeur endort le serveur, et ses heures sont hachurées. Tout y est mesuré par le serveur lui-même, sans clé de l'API de Render — une clé ouvrirait tout le compte. Sur Render, l'introduction mène aussi aux graphiques que l'hébergeur garde de son côté, vus de dehors (`RENDER_SERVICE_ID`, qu'il pose lui-même).

- **Cette semaine** : les démarrages (le plus long à être prêt, les arrêts nets), les erreurs serveur, Turso et les routes au 95ᵉ centile comparés à leur habitude, et la route la plus lente.
- **Ce qu'un joueur attend** (le 95ᵉ centile des routes d'API) et **Turso** (celui d'un aller-retour vers la base), heure par heure — et sous Turso, la part des allers-retours qui ont dû ouvrir leur connexion : à 100 %, chacun a refait sa poignée de main. La légende de l'heure dit combien de temps le serveur garde ses connexions, le délai que Turso annonce, et ce qu'une garde trop longue ferait voir : des connexions refermées par Turso, des allers-retours tombés en route.
- **La charge, heure par heure** : le processeur (la moyenne, en part d'un cœur), le gel de l'hébergeur (la part de l'heure où le processeur manquait), la boucle (le pire gel — toute la salle l'attend), la mémoire, les invités connectés et les connexions ouvertes (leurs pics — chaque téléphone et chaque écran du temps réel en tient une ; la légende dit aussi les clients du temps réel), avec en pointillé les plafonds du conteneur, lus au démarrage — ceux de l'offre gratuite, un dixième de cœur et 512 Mo, quand la machine ne les dit pas.
- **Le trafic, heure par heure** : les requêtes servies — les pages, les fichiers, l'API ; ni le temps réel, ni les sondes de `/healthz` — et, dessous, celles refusées (les 4xx : une page introuvable, une session expirée, la réserve d'inscriptions) ; puis ce que la machine a envoyé et reçu, Turso compris. La légende de l'heure détaille les requêtes : réussies, redirigées, refusées, en erreur.
- **Les erreurs serveur** : les routes et les sockets en erreur, les exceptions échappées, heure par heure ; la légende de l'heure nomme leurs sources (« 3 erreurs : POST /api/jour/reponse (2), socket host:launch (1) »).
- **Ce qui a échoué** : combien d'erreurs différentes cette semaine, la dernière, d'où elles viennent le plus, et « Les erreurs », qui mène à [leur page](#les-erreurs-et-les-pannes), où chacune se lit et se trie.
- **Réveils et arrêts** : chaque démarrage et sa raison — « Réveil » (l'hébergeur rallume le serveur endormi), « Mise en ligne » (une version neuve), « Relancé » (le serveur d'avant vivait encore, ou s'est éteint dans la minute), « Redémarrage après un arrêt net » —, et chaque « Arrêt net » : ni extinction propre, ni signe de vie depuis vingt minutes. Puis le tableau des heures éveillées.

Une alerte du serveur se traite dans [Exploiter](../exploitation/exploiter.md).

## La maintenance

Quand quelque chose ne marche plus pour les joueurs — le quiz du jour qui ne s'ouvre pas, un défi qui plante —, cette page, sous « Piloter », sert à les prévenir et à fermer ce qui ne marche pas le temps de le réparer ; et, pour ce qui n'est pas encore prêt, à l'annoncer pour bientôt en ne l'ouvrant qu'à quelques testeurs. Tout vaut dès la page suivante qu'ils ouvrent ; chaque geste va au journal (filtre « Maintenance »). Ce qui ne marche pas se compte en rouge dans la barre de côté, quelle que soit la page du QG où tu es : rien ne se rouvre de lui-même.

**Le bandeau** : une phrase ou deux, 140 caractères au plus, que les joueurs lisent en rouge en haut de chaque page — l'accueil, les modes, la boutique, le QG —, avec ou sans profil. L'aperçu la montre telle qu'ils la liront à mesure que tu l'écris. « Afficher le bandeau », « Changer le bandeau » quand tu le retouches, « Retirer le bandeau ». Il ne paraît jamais pendant une soirée — ni sur le téléphone des invités, où il prendrait la place des réponses, ni sur l'écran commun, qui le projetterait à toute la salle —, ni pendant une question du quiz du jour ou de la campagne, où la page tient l'écran au pixel près.

**Les pages** : le quiz du jour, la campagne (le défi de la semaine avec), le défi de la semaine seul, les duels (les défis entre amis compris), l'Expédition, la boutique. Chacune est ouverte à tous, en maintenance, ou bientôt disponible ; deux boutons la font passer à l'un des deux autres. « Mettre en maintenance », confirmé, puis « Rouvrir ». Une page en maintenance :

- se remplace, pour les joueurs, par un écran qui dit qu'une réparation est en cours, que rien de ce qu'ils ont gagné n'est perdu, avec « Retour à l'accueil » et « Réessayer » ;
- éteint son bouton sur l'accueil, qui dit « En maintenance : reviens un peu plus tard » ; le défi fermé seul éteint sa tuile, sous son onglet à côté du quiz du jour ;
- ferme ce qui y commence — une partie, un départ, un achat —, même depuis une page restée ouverte : le joueur lit « Le quiz du jour est en maintenance : reviens un peu plus tard ». Une partie déjà à l'écran, elle, se finit ;
- tait le rappel du soir, pour le quiz du jour : il part si tu rouvres avant 22 h.

Toi, tu y entres encore, par la session de ta console : une ligne te rappelle que la page est fermée pour les joueurs — de quoi vérifier la réparation en production avant de rouvrir. Les soirées ne se ferment pas : une salle entière joue derrière l'écran commun ; pour prévenir les animateurs, le bandeau.

**Bientôt disponible** : pour ce qui n'est pas encore prêt — l'Expédition qu'on essaie encore —, fermé à tous sauf à ses testeurs et à toi. « Bientôt disponible », confirmé ; pour les joueurs qui attendent, la page se remplace par un écran qui dit qu'elle arrive bientôt (« L'Expédition arrive bientôt »), sans parler de panne ; son bouton de l'accueil s'éteint sur « Bientôt disponible », et ce qui y commence leur répond « L'Expédition arrive bientôt : reviens dans quelques jours ». Rien de rouge : rien n'y est cassé, et la page peut attendre des semaines. Sous la page, **ses testeurs** : « Ajouter un testeur » cherche un profil par son prénom ou son identifiant, comme « Les profils » ; « Retirer » le renvoie attendre avec les autres. Un testeur entre par sa session de joueur, connecté à son profil : la page s'ouvre pour lui comme pour tous, et son bouton de l'accueil le lui dit d'une pastille « En test ». Personne d'autre ne voit qui teste. « Ouvrir à tous », confirmé, la rend à tout le monde dès la page suivante qu'ils ouvrent ; ses testeurs restent notés, pour une prochaine fois. Mise en maintenance, elle ne s'ouvre plus qu'à toi : ce qui ne marche pas ne s'essaie pas. Un profil supprimé ne teste plus rien.

Une fois réparé : retire le bandeau, rouvre la page, puis dis-le à chacun par [une annonce](#les-annonces) — « Faire une annonce », sous le bandeau, y mène. Le bandeau se lit en passant et part avec la panne ; l'annonce, elle, attend chacun sur son accueil.

## Les annonces

Sous « Animer » : un message pour tous les profils, que chacun lit une fois, en haut de son accueil — « Le quiz du jour et le défi remarchent. Merci de votre patience ! » après une panne, « L'Expédition est ouverte à tous » pour une nouveauté. Chaque geste va au journal (filtre « Annonces »).

- **Ce qu'elle dit** : 200 caractères au plus ; l'aperçu la montre telle que les joueurs la liront, à mesure que tu l'écris.
- **Des confettis pour chacun ?** De 0 à 500 — un dédommagement, un cadeau. La page dit à combien de profils elle partirait et ce que ça fait en tout. Chacun les reçoit en un don, comme ceux de la fiche d'un joueur : dans son solde, et parmi « Tes dons » à l'économie.
- **« Annoncer à tous »** (ou « Annoncer et offrir 50 confettis »), confirmé : elle part aux profils d'aujourd'hui, sans les suspendus. Ni les invités sans profil ni ceux qui en créeront un ensuite ne la liront : elle parle d'avant eux. Un profil suspendu à l'envoi n'en reçoit pas les confettis ; réactivé, il lit le message seul.
- **Ce que le joueur en voit** : une carte en tête de son accueil, une fois par téléphone, pendant trente jours — « +50 confettis, à tous les joueurs », ton message, « — de l'administrateur », et « Merci » ; sans confettis, « À tous les joueurs » et « Compris ».
- **Les annonces faites** : chacune, la plus récente d'abord — son message, ses confettis, combien de profils l'ont reçue, quand. « Retirer », confirmé, la tait à qui ne l'a pas encore lue — une faute dans le message, une nouvelle qui ne tient plus — ; ses confettis restent à chacun : un don ne se reprend pas. Un mois passé, elle ne se montre plus d'elle-même.

Une réponse perdue en route ne fait pas offrir deux fois : refait, le même envoi répond « Cette annonce est déjà partie : la voici dans la liste ».

### Poser une question

Sous le message, « Une question aux joueurs ? » : l'annonce devient une demande de retour. Le message est la question.

- **Un vote** : deux à cinq choix, chacun de quarante caractères au plus (« Les duels », « La campagne »…). Chaque joueur en touche un.
- **Une note** : de 1 à 5.
- **Un mot libre** : jusqu'à 200 caractères.
- **Des confettis pour avoir répondu** : de 0 à 500, donnés une fois à chaque profil qui répond, en plus de ceux que l'annonce offre à tous si tu en as mis. L'aperçu montre la carte telle qu'ils la liront.

Les joueurs la voient sur leur accueil avec leurs boutons. « Plus tard » la laisse revenir à leur prochaine visite, jusqu'à ce qu'ils répondent, que tu la closes ou qu'un mois passe. Un joueur ne répond qu'une fois, et un profil créé après l'envoi n'est pas questionné.

Dans « Les annonces faites », chaque question montre ses réponses : un décompte par choix ou par note, la moyenne d'une note, les mots libres avec le prénom de qui les a écrits. « Clore la question » la retire de l'accueil sans rien reprendre : les résultats et les confettis donnés restent. Retirer l'annonce ferme aussi les réponses.

## Les soirées

« Les quiz, les questions et les prénoms des invités restent chez leur animateur : le QG n'en voit que les chiffres. »

- **En direct** : les soirées qui se jouent.
- **Laissées en plan** : sans un signe de vie — une arrivée, une réponse, une partie qui avance — depuis six heures. Leurs invités attendent leurs récompenses de clôture, et leurs profils ne se suspendent ni ne se suppriment tant qu'elles ne sont pas closes.
- **Ces trente jours** : Soirées, Invités par soirée (la médiane), Quiz par soirée, Questions jouées — chaque soirée comptée au jour de sa première question. **Quand on joue** et **La taille des salles**, sur quatre-vingt-dix jours. **L'historique du mois** : date, salon, invités, quiz, questions (« · pas encore close »).

**Clore une soirée laissée en plan** est ton seul geste sur la soirée d'un autre. « Clore la soirée », puis confirme : elle se range dans l'historique et ses invités sont crédités comme à une clôture ordinaire — expérience, podium, prix ; chaque téléphone reçoit sa fin de soirée, et son animateur la retrouve close ; le QG te le confirme : « Soirée close — ses invités sont crédités », ou « … rien n'y avait été joué ». Une soirée qui a repris vie se refuse (« Cette soirée vit encore : seule une soirée laissée en plan se clôt d'ici »), comme celle que son animateur est en train de finir.

## Les profils et la fiche d'un joueur

« N profils sur ce serveur. Sans recherche, les derniers vus. » Cherche par prénom ou par identifiant : trente résultats au plus, les profils suspendus compris. Une ligne ouvre la fiche : @identifiant, niveau, « en ligne » ou « dernier passage … » ; Inscription, Soirées, Quiz du jour (« · hors classement » s'il y est masqué), Campagne, Duels, Confettis (« dont 50 offerts »), Espace (son salon ou le compte d'animateur qu'il tient), Connexion (« ouverte », ou « fermée jusqu'à 22 h 15 »), l'épreuve de sentier qui l'attend, et « Tes gestes sur ce profil ».

### L'aider

| Geste | Ce qu'il fait |
|---|---|
| « Offrir des confettis » | De 1 à 500 (50 par défaut), avec un mot facultatif de 140 caractères au plus, « lu sur son accueil ». Un don ne se reprend pas, et ne se fait pas à un profil suspendu. Sur ta propre fiche, le groupe s'appelle « Pour toi » et le geste « T'offrir des confettis » : tu t'en offres comme à n'importe qui. |
| « Offrir un Éclat » | Un Éclat en réserve, confirmé : le joueur le dépense dans sa loge, pièce « Avatar », sur n'importe quel avatar à lui qui n'a pas encore éclaté — définitif. Sert à tester comme à récompenser ; sur ta propre fiche, « T'offrir un Éclat ». Pas à un profil suspendu, et le QG ne le compte pas parmi les Éclats tirés. |
| « Tirer un code de secours » | Pour qui a perdu son mot de passe : un code neuf, montré une seule fois (« Copier le code »), à lui transmettre. Il le tape dans « J'ai oublié mon mot de passe » avec son identifiant, puis choisit un mot de passe ; un nouveau code, que personne d'autre ne voit, remplace alors le tien. Son code d'avant ne vaut plus rien. |
| « Lever le verrou de connexion » | Paraît quand sa connexion est fermée — cinq essais manqués, du mot de passe ou du code de secours, la ferment un quart d'heure — et la rouvre aussitôt. |
| « Libérer l'épreuve » | Paraît quand une épreuve de sentier l'attend — tant qu'elle attend, aucune autre ne commence — et la referme sans lui coûter de vie. |

Il n'y a ni adresse e-mail, ni mot de passe provisoire, ni lien de réinitialisation : le code de secours est la seule porte de retour d'un profil.

### Le modérer

| Geste | Ce qu'il fait |
|---|---|
| « Changer son prénom » | Pour un prénom qui ne va pas — jamais pour départager deux homonymes : la salle les distingue d'elle-même. Ses soirées passées gardent l'ancien. |
| « Remettre au classement » | Paraît quand le profil est masqué (« hors classement »), même suspendu, même le tien : il revient aux classements du quiz du jour et des duels. Le masque, lui, se pose depuis les classements, jamais d'ici. |
| « Suspendre » | Ses sessions tombent, et les consoles qu'il avait ouvertes ; le profil ne s'ouvre plus — son bon mot de passe lui répond « Ton profil est suspendu : demande à l'administrateur de le réactiver » — et disparaît des classements, de la recherche et des cartes. Rien ne s'efface. |
| « Réactiver » | Il retrouve tout, et peut se reconnecter ; ses anciennes sessions restent fermées. |
| « Supprimer le profil » | Le dialogue dit, avant le clic, ce qui part et ce qui reste. |

La suppression efface pour de bon son niveau, ses avatars, ses trophées, ses achats, les confettis qu'on lui a offerts, ses parties du quiz du jour et de la campagne, ses duels, ses amis et ses rappels du soir ; son identifiant redevient libre. Restent les soirées jouées, dans l'historique des autres avec ce qu'elles leur ont rapporté, et l'espace qu'il tenait, détaché — son salon garde ses quiz et les souvenirs de ses soirées ; tu le supprimes à part, dans « Les salons », si tu le veux. Suspendre et supprimer se refusent tant qu'il joue une soirée pas encore close : sa clôture ne le retrouverait plus.

**Ce que le joueur en voit** : en tête de son accueil, une fois par téléphone, ce que tu as fait pour lui ces trente derniers jours — « +50 confettis », ton mot, « — de l'administrateur » ; ou « Ton prénom a changé » —, chaque annonce avec son « Merci ». Une question qu'il avait signalée et qui a servi l'y remercie aussi, avec « Avec plaisir » ([les signalements](#les-signalements)).

## Les salons

Tous les espaces du serveur : les salons ouverts par des profils, et les comptes d'animateur d'avant, à mot de passe. Tu n'en crées pas : chacun ouvre son salon depuis son profil (« Créer un salon »), sans rien te demander.

Filtres : Tous, Sans titulaire, Désactivés. Chaque espace se nomme par son titulaire (« Le salon de Léa »), « Un salon sans titulaire · … » quand son profil a été supprimé, ou par son nom pour un compte d'avant ; puis son adresse, ses quiz, sa dernière visite, et au besoin une étiquette : « toi », « désactivé », « sans titulaire », « à activer », « mot de passe ».

| Geste | Ce qu'il fait |
|---|---|
| « Renommer » | « Le nom affiché » (40 caractères), puis « Le nom dans l'adresse » (minuscules, chiffres et tirets, 24 au plus) — « Changer l'adresse casse les liens déjà partagés. » |
| « Rattacher à un profil » | Pour un espace sans titulaire : l'identifiant du profil qui le tiendra. S'il tenait déjà un salon, ses quiz rejoignent celui-ci, photos comprises, et l'ancien reste, détaché, pour ses souvenirs. Ainsi se réunissent deux identités que le serveur ne pouvait pas deviner être la même personne. |
| « Un lien pour son mot de passe » | Pour un compte d'avant : voir [Les comptes d'avant](#les-comptes-davant). |
| « Désactiver » | « Plus personne ne pourra l'ouvrir, et ses écrans communs se fermeront. » Les invités n'y entrent plus ; son titulaire lit « Ton salon est en pause — demande à l'administrateur ». Ses quiz, ses soirées et ses pages publiques — souvenir, bilan, historique — restent. |
| « Réactiver » | Rouvre la porte ; personne n'est reconnecté d'office. |
| « Supprimer » | Pour un espace désactivé seulement : « On ne supprime qu'un espace désactivé : c'est le pas de recul. » |

**Supprimer** demande un choix : « Supprimer, les joueurs gardent leurs gains » — un ami qui s'en va —, ou « Supprimer, et reprendre leurs gains » — un compte qui fabriquait des soirées. Ce que ses soirées ont rapporté aux joueurs (expérience, prix, hauts faits, paliers) leur reste, ou leur est repris ; une soirée gardée se lit « un espace fermé » dans « Mes soirées » de qui l'a jouée. Le reste part sans retour : ses quiz, ses photos, ses soirées archivées — leurs souvenirs ne s'ouvrent plus — et sa soirée en cours, dont les téléphones sont prévenus puis coupés. Son identifiant et son adresse redeviennent libres. Pour garder une trace, exporte ses soirées avant (`npm run export`) ou sauvegarde toute la base (`npm run sauvegarde`) — voir [Exploiter](../exploitation/exploiter.md). L'espace par défaut, le tien, où mènent les anciennes adresses, ne se supprime pas.

## Le catalogue

Les copies de quiz que les animateurs proposent à tous depuis « Mes quiz ». Rien n'y paraît sans toi : « Relis-la : pas de prénoms d'invités, pas de photos de proches. » Rangées en « À relire » et « Publiées » ; « Relire » déplie leurs questions, la bonne réponse marquée. « Publier » met la copie dans « Partir d'un modèle » de chaque espace, avec le nom de son auteur ; « Refuser » l'écarte ; « Retirer » sort une copie publiée. Le partage côté animateur : [Les quiz](../produit/les-quiz.md).

## Les signalements

Ce que les joueurs signalent après leur réponse (« Signaler une erreur dans cette question »), au quiz du jour comme en campagne — séries, sentiers, parcours de thème, défi de la semaine, duels —, sur une seule page ; la barre de côté compte les questions qui attendent, et les pages du quiz du jour et de la campagne y mènent par une ligne. Côté joueur : [Le quiz du jour](../produit/le-quiz-du-jour.md), [La campagne](../produit/la-campagne.md).

- **En tête** : les questions à relire et les joueurs qui les signalent ; celles du quiz du jour (« dont 2 d'aujourd'hui ») et celles de la campagne ; les questions relues ces trente jours, et ce qui en a été fait (« 3 corrigées · 1 retirée · 2 gardées »).
- **À relire** : une carte par question, de tous les modes ou d'un seul (Tout, Quiz du jour, Campagne), « les plus signalées d'abord » ou « les plus récentes d'abord ». D'où elle vient — sa catégorie et le jour qui l'a posée, ou sa catégorie, son sous-thème et où on l'a jouée —, combien de joueurs la signalent et depuis quand ; l'intitulé, les réponses, la bonne cochée — au quiz du jour, la part de chacune ; ce que disent toutes les réponses — au quiz du jour, combien l'ont jouée et la part de justes ; en campagne, la part de justes, sa difficulté estimée à l'écriture et celle de l'usage, d'où elle vient et son identifiant ; l'anecdote ; puis chaque joueur qui la signale — son prénom, son identifiant, ce qu'il avait répondu, quand, et sa phrase —, ceux déjà relus repliés dessous. La page montre les cinquante questions les plus récemment signalées de chaque mode ; les autres paraissent à mesure.
- **Relues** : les questions relues ces trente jours, la plus récente d'abord — d'où elle venait, combien de joueurs la signalaient, ce qui en a été fait et quand : « Corrigée · l'anecdote », « Reclassée · Histoire › Civilisations anciennes · difficulté 4 », « Retirée de la réserve », « Points annulés pour tous », « Gardée » ; « Relue » pour une question relue avant le 14 octobre 2026. Signalée de nouveau, une question revient dans « À relire », ses signalements d'avant repliés dessous.

Chaque geste referme les signalements de sa question, dit ce qui en a été fait et se note au journal. Un geste refusé le dit — « Rien n'a changé : « Garder » referme ses signalements », « Cet intitulé est déjà dans la campagne » — et ne referme rien.

| Geste | Ce qu'il fait |
|---|---|
| « Corriger » | L'intitulé, les réponses et la bonne, l'anecdote ; le formulaire dit ce que fera la correction avant que tu l'enregistres. **Au quiz du jour**, c'est la version de la réserve qui change — celle que ses prochains tirages poseront. La même bonne réponse — une faute, un leurre, une anecdote —, et le jour qui l'a posée la prend aussi : l'écran de correction de chacun, et ceux qui la jouent encore aujourd'hui. Une autre bonne réponse ne vaut que pour la suite — ses joueurs ont répondu par la place de chaque réponse — : tant que son jour court, « Annuler aussi ses points pour tous », cochée d'office, règle le jour joué dans le même geste. **En campagne**, la même bonne réponse garde l'identifiant de la question, ses réponses passées et sa difficulté mesurée ; une autre la fait repartir sous un nouvel identifiant, sans les mesures de l'ancienne, qui est retirée. Les séries déjà tirées gardent la version qu'elles ont lue. |
| « Reclasser » | La catégorie, le sous-thème et la difficulté estimée — de 1, presque tout le monde la trouve, à 5, un passionné —, celle d'avant en pointillé. Pour la suite : les réponses déjà données gardent leur catégorie, et les écussons de chacun ne bougent pas. Une question du jour que la routine n'a pas encore décrite ne reclasse que sa catégorie. |
| « Retirer de la réserve » · « Retirer de la campagne » | Elle ne sera plus posée, pour personne, pour toujours ; les séries déjà tirées la gardent. |
| « Annuler ses points pour tous » | Au quiz du jour, tant que son jour court (après minuit, son podium est payé) : ses points s'effacent pour tous ceux qui l'ont jouée aujourd'hui, du classement du jour comme de celui du mois, et l'expérience de chacun suit. Elle reste dans le tirage, annulée. Une confirmation : rien ne la rend. |
| « Garder » | La question est juste : ses signalements se referment. Sur une question déjà retirée, « Refermer ». |

**Ce que le joueur en voit** : quand sa remarque a servi — la question corrigée, reclassée, retirée, ou ses points annulés —, un merci en tête de son accueil, une fois : « Merci, Léa ! La question du quiz du jour que tu as signalée, « Quel fleuve traverse… », a servi : elle a été corrigée. » « Garder » ne lui dit rien : la question était juste.

## Le quiz du jour

Les règles du mode vivent dans [Le quiz du jour](../produit/le-quiz-du-jour.md) ; sa page au QG suit la journée et tient la réserve.

- **Aujourd'hui** : les parties commencées et finies (comparées à la même heure d'habitude), la part de bonnes réponses et celle d'hier, les séries en cours et la plus longue, les téléphones abonnés au rappel et la dernière tournée.
- **La réserve** : ses jours d'avance, ses questions prêtes et déjà posées. Sous sept jours, elle s'allume : « Moins d'une semaine d'avance. Colle une liste, ou copie la consigne dans ton IA : sans question neuve, la réserve rejouera les plus anciennes. » Elle dit si le remplissage automatique est ouvert — la routine du matin y dépose ses questions quand le serveur a son `RESERVE_TOKEN` — et ses derniers apports, avec ce qui a été écarté et pourquoi : elle ne prend que des questions à choix, sans photo. « Coller une liste » (au format de l'éditeur de quiz, puis « Ajouter à la réserve »), « Copier la consigne pour une IA » (la même que celle de la routine : colle-la dans le chatbot de ton choix, puis sa réponse dans « Coller une liste »), « Voir les prochains jours » (les prochaines questions avec leur réponse, « Retirer » en ôte une).
- **Question par question** : le tirage d'aujourd'hui — chaque question, sa part de bonnes réponses, ses signalements ouverts ; touchée, ce que chaque réponse a recueilli (une question piège se voit à la mauvaise réponse qui l'emporte), celles laissées au temps, le temps moyen. « Annuler ses points pour tous », sans attendre un signalement : ses points s'effacent pour tous ceux qui l'ont jouée aujourd'hui, du classement du jour comme du mois, et l'expérience de chacun suit — rien ne la rend. « Retirer de la réserve » : elle ne reviendra plus.
- **Les signalements** : une ligne dit combien de questions attendent, et mène à [leur page](#les-signalements), où l'on corrige, reclasse, annule, retire ou garde.
- **Joueurs par jour**, sur trente jours ; **le classement du mois**, tel que les joueurs le voient, avec « Masquer » au bout de chaque ligne ; **les séries en cours**, par longueur (1 à 6 jours, 7 à 29, 30 à 99, 100 et plus), les trois plus longues et les sabliers achetés ce mois-ci.
- **Le rappel du soir** — à 18 h, aux téléphones qui l'ont demandé et dont la partie n'est pas finie : les téléphones abonnés, puis les sept derniers soirs (envoyés, « Déjà joué », échecs, « Partis » : des abonnements défaits).
- **Masquer un profil** : le chercher, « Masquer du classement » ou « Remettre au classement ». Masqué, un profil joue toujours, mais il sort des classements — quiz du jour et duels —, des podiums et des lauriers, et on ne peut plus le défier ; personne ne l'en avertit, et sur son téléphone sa ligne reste. Sa fiche dit « hors classement ».

## La campagne et les sentiers

Les règles vivent dans [La campagne](../produit/la-campagne.md) et [Les sentiers du savoir](../produit/les-sentiers-du-savoir.md).

- **Aujourd'hui** : les joueurs (dont ceux des sentiers) et les parties (séries et épreuves), comparés à la même heure des sept jours d'avant ; les paliers validés, et ceux du premier coup ; les joueurs du défi de la semaine.
- **Ce qu'on joue** : les parties commencées chaque jour, sur trente jours, un petit graphique par sous-mode — Séries, Sentiers, Parcours de thème, Révisions, Défi de la semaine.
- **Le défi de la semaine** : ses joueurs, comptés comme son classement (sans les profils masqués ni suspendus), son meilleur score, le score médian des tentatives finies, la semaine dernière et ses vainqueurs ; puis la répartition des scores, et les trois questions les plus ratées, jugées à partir de cinq réponses. Le QG ne tire jamais le défi : tant que personne ne l'a ouvert, la page dit qu'il se tirera à la première ouverture.
- **Les parcours de thème** les plus suivis sur trente jours (joueurs, étapes validées, parcours finis), et **les vies** : achetées jour par jour, perdues, et celles prises dans la réserve au-delà des douze du jour.
- **Les sentiers** : les sept derniers jours (joueurs, épreuves, paliers validés, vies perdues et achetées), puis, sur trois mois, chaque palier de tous les sentiers ou d'un seul — la chance d'un essai au seuil du jour, qui l'a validé (du premier coup ou non), qui y reste bloqué et ses échecs, les abandons, les rejeux à part ; les bonnes réponses par marche (faciles, moyennes, difficiles, expertes) à côté de ce que le calibrage suppose ; un palier plus facile que celui d'avant se signale (« plus facile que P3 ») ; enfin « Les plus bloqués ».
- **Régler un palier** : sous « Tous les sentiers », « Régler » ouvre le mélange d'un palier — combien de faciles, de moyennes, de difficiles, seize en tout, jamais d'experte —, la difficulté que les joueurs liront, et la chance d'un essai que donnerait ce mélange, estimée sur ce que les joueurs de ce palier trouvent vraiment (au calcul, pour un joueur moyen, tant que le palier a trop peu d'épreuves). Un avertissement dit si le palier deviendrait plus facile que celui d'avant, ou plus dur que le suivant. « Appliquer » vaut pour les douze sentiers ensemble, et pour les épreuves qui commencent : celles en cours gardent leurs questions, aucun palier validé ne se reprend, et le seuil reste à dix. Un palier réglé porte « réglé au QG », son mélange d'origine et ce que disent les épreuves commencées depuis ; « Revenir au mélange d'origine » le défait. Chaque réglage va au journal, avec l'ancien mélange et le nouveau. Le palier du maître ne se règle pas, et les seuils restent dans le code.
- **La base** : ses questions à jouer et retirées, par catégorie et par difficulté (de 1 à 5).
- **Ce que les réponses contredisent** : les questions jouées cinq fois au moins dont la part de bonnes réponses dit une autre marche que la leur, vingt au plus, les plus nettes d'abord — « trouvée 0 fois sur 6 (0 %) : tirée moyenne, ses réponses la disent experte ». Leur famille corrige déjà ce qui leur ressemble (une date ratée part difficile, voir [la campagne](../produit/la-campagne.md)) : restent celles qui font exception à leurs voisines. « Reclasser » ouvre le même geste que pour une question signalée, la difficulté que disent ses réponses déjà choisie, celle d'avant en pointillé ; la question change de marche au tirage suivant, et sort de la liste. Le geste va au journal.
- **La routine du matin** : ce qu'elle a déposé aujourd'hui, ces sept jours et en tout, et ses dernières questions — c'est la première fois qu'un humain les lit ; « Retirer » en sort une, pour tous.
- **Les signalements** : une ligne dit combien de questions attendent, et mène à [leur page](#les-signalements), où l'on corrige, reclasse, retire ou garde.

Une épreuve de sentier qui bloque un joueur se libère depuis sa fiche.

## Les duels

Les règles vivent dans [Les duels](../produit/les-duels.md) ; leur page au QG suit les duels contre Automate comme ceux entre joueurs, et ceux qui attendent leur adversaire.

- **Aujourd'hui** : « Duels joués » — les parties de duel commencées, « contre Automate » et « contre un joueur » — et leurs « Joueurs », comparés à la même heure des sept jours d'avant ; « En attente », les duels partis sans réponse ; « Confettis de ligue », ce que la semaine dernière a payé, et à combien de joueurs — masqués compris : ces confettis sont à eux.
- **Les duels par jour**, sur trente jours, en deux petits graphiques : « Contre Automate », les parties du dé (« un adversaire simulé, de son niveau, toujours classé ») ; « Classés, entre joueurs », les duels lancés chaque jour, et combien ont été joués des deux côtés.
- **Les ligues** : les joueurs classés, ligue par ligue, des Maîtres au Bronze — ceux qui ont fini un duel classé ces quatre dernières semaines, comptés comme le classement : sans les profils masqués ni suspendus. Dessous, la semaine dernière : les joueurs payés pour trois duels joués, et leurs confettis de ligue.
- **Le classement**, tel que les joueurs le voient : ses dix premiers — rang, ligue, duels joués, cote — et combien il classe de joueurs, sur les quatre dernières semaines. « Masquer », au bout de chaque ligne, pose le masque du quiz du jour, le même pour les deux classements, après la même confirmation : le profil sort des classements du quiz du jour et des duels, des podiums et des lauriers, et on ne peut plus le défier ; personne ne l'en avertit. Le geste se note au journal sous « Quiz du jour ». Dessous, « Hors classement » liste les profils masqués — leur prénom et leur identifiant, sans avatar —, chacun avec « Remettre au classement » ; le masque se lève aussi depuis la page du quiz du jour et depuis la fiche du joueur.
- **En attente** : les duels classés partis — qui l'a lancé a joué sa partie — que le profil défié n'a pas encore commencés, les plus près d'expirer d'abord, vingt au plus (« Et 3 autres, qui expirent plus tard. ») : qui défie qui, « parti il y a 2 j · expire dans 4 j », et « Annuler ». Puis « Partis, sans réponse », avec le plus ancien, et « Fermés sans réponse » ces sept jours, expirés ou annulés : ils ne comptent pour personne. Un profil suspendu s'y lit « Un profil parti ».
- **Annuler un duel** : « Annuler », puis « Annuler le duel » — ou « Le garder ». Il se ferme tout de suite, comme à son expiration : il ne compte pour personne, aucune cote ne bouge, et il sort des duels à jouer du profil défié. Rien ne le rouvre. Il se refuse déjà fermé (« Ce duel est déjà fermé »), ou commencé par le profil défié (« Ce duel est commencé des deux côtés : il compte déjà, il ne s'annule plus »). Il se note au journal sous « Duels », et sur la fiche de qui l'avait lancé. Le QG ne rouvre aucun duel et n'en défait aucun de joué : la cote se relit des duels joués.

## L'économie

Les confettis se gagnent et se dépensent selon [La boutique](../produit/la-boutique.md). Leur page au QG se lit sans un geste — « Les prix restent dans le code. » — et ne tient aucun compte à part : chaque source se relit à ses règles, comme le solde de chacun.

- **Aujourd'hui** : « Gagnés », toutes sources, « Dépensés », en boutique, et « Achats », sorte par sorte (« 19 thèmes · 2 compagnons » ; des vies achetées d'un coup font un achat), comparés à la même heure des sept jours d'avant ; « En circulation », la somme de tous les soldes, et ce que la journée y a ajouté.
- **Gagnés et dépensés, jour par jour** : trente jours, en deux petits graphiques, et leurs totaux.
- **D'où ils viennent**, sur trente jours, la plus grosse source d'abord : Campagne, Quiz du jour, Soirées, Ligues des duels, Étoiles des sentiers, Missions du jour, Coffres de la semaine, et « Tes dons », ceux que tu as offerts depuis la fiche d'un joueur. Les ligues comptent au lundi qui paie la semaine close, les étoiles à l'épreuve qui atteint la note.
- **Où ils partent**, sur trente jours : Thèmes, Compagnons, Fonds de carte, Vies, Sabliers — les objets achetés (une vie compte pour une), puis ce qu'ils ont coûté, au prix payé : « Un prix payé reste le sien : un thème qui change de prix ne change pas l'achat d'hier. »
- **En circulation** : ce que les joueurs ont en poche, relu une fois par jour, à la première ouverture de la page (« relu à 9 h 12, une fois par jour ») — « Tous les soldes », profils suspendus compris ; le « Solde médian » de ceux qui ont joué ces trente jours ; « De quoi un compagnon », les profils qui ont de quoi s'en offrir un ; puis les profils par tranche de solde, la dernière au prix d'un compagnon. Un solde peut passer sous zéro : une soirée retirée de l'historique emporte ses confettis.
- **Les meilleures ventes** : les thèmes, les compagnons et les fonds de carte, huit au plus, les plus vendus ces trente jours d'abord — « Article », « Rareté », « Ventes », « 30 jours ». Les vies et les sabliers se comptent dans « Où ils partent ».
- **Les Éclats et les légendaires** : les Éclats tombés ces trente jours, au quiz du jour, en soirée et au défi de la semaine ; les profils qui portent un légendaire, et les six plus portés. Un légendaire ne compte que vraiment porté, par un profil qui n'est pas suspendu — ni un portrait, ni un compagnon, ni un Divin.

Les jours finis et les soldes se lisent une fois par jour, les ventes et les légendaires au plus toutes les dix minutes, la journée à chaque ouverture.

## Les comptes d'avant

Avant les salons ouverts par les profils, un animateur recevait un compte : un identifiant, un mot de passe, une adresse choisie (`/chez-bob`). Il en reste ; « Les salons » les marque « mot de passe », ou « à activer » tant qu'aucun mot de passe n'a été choisi. Le tien en est un si ton espace est né au premier démarrage du serveur.

- **Un mot de passe perdu, ou jamais choisi** : sur la feuille du compte, « Un lien pour son mot de passe ». Envoie-le par le canal de ton choix : il vaut sept jours, ne sert qu'une fois, et en refaire un annule le précédent. La personne l'ouvre (`/activer`), voit son identifiant et l'adresse de son espace, choisit un mot de passe de 8 caractères au moins, et arrive sur « Compte » ; ses autres sessions sont fermées.
- **Un profil à rattacher** : le titulaire rattache lui-même son profil à son espace (« Compte » › « Mon profil joueur »), en donnant le mot de passe de ce profil. Quand ce n'est pas possible — l'identifiant de son compte était déjà pris par un autre profil —, fais-le pour lui : « Rattacher à un profil ».

## Pour aller plus loin

- [La sécurité](../architecture/securite.md) — les comptes, les sessions, les limites d'essais, le cloisonnement des espaces
- [Exploiter](../exploitation/exploiter.md) — surveiller, sauvegarder, restaurer, dépanner
- [La mise en ligne](../exploitation/mise-en-ligne.md) — le compte administrateur, `RESERVE_TOKEN` et la routine du matin
- [Le quiz du jour](../produit/le-quiz-du-jour.md), [La campagne](../produit/la-campagne.md), [Les sentiers du savoir](../produit/les-sentiers-du-savoir.md), [Les duels](../produit/les-duels.md) — les règles des modes que le QG surveille
- [La boutique](../produit/la-boutique.md), [Les récompenses](../produit/les-recompenses.md) — les confettis, l'Éclat et les légendaires que la page de l'économie compte
- [L'API HTTP](../reference/api-http.md) — les routes `/api/admin/…`
