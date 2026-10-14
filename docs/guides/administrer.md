# Administrer FiestApp

> Le guide de l'administrateur du serveur : entrer au QG (`/admin`), puis, page par page, ce qu'on y trouve et ce qu'on y fait — surveiller le serveur, clore une soirée laissée en plan, aider un joueur ou le modérer, veiller sur les salons, relire le catalogue, tenir les réserves de questions.

**Dans cette page** : [Entrer au QG](#entrer-au-qg) · [La vue d'ensemble](#la-vue-densemble) · [Le journal](#le-journal-de-tes-gestes) · [Le serveur](#la-santé-du-serveur) · [Les soirées](#les-soirées) · [Les profils](#les-profils-et-la-fiche-dun-joueur) · [Les salons](#les-salons) · [Le catalogue](#le-catalogue) · [Le quiz du jour](#le-quiz-du-jour) · [La campagne](#la-campagne-et-les-sentiers) · [Les comptes d'avant](#les-comptes-davant)

> [!NOTE]
> Le QG grandit : chaque mode de jeu y reçoit sa page, l'une après l'autre — le quiz du jour, puis la campagne ; les duels et l'économie suivront. Ce guide dit ce que chaque page montre et permet ; la place exacte d'un chiffre peut bouger.

## Entrer au QG

Le QG est réservé au compte administrateur : celui que le serveur crée à son tout premier démarrage, sur une base encore vide, à partir de `ADMIN_LOGIN`, `ADMIN_PASSWORD`, `ADMIN_SLUG` et `ADMIN_NAME` (voir [la mise en ligne](../exploitation/mise-en-ligne.md)). Ces variables ne servent qu'à cette naissance : les changer ensuite ne change rien au compte. En ligne, sur une base vide, le serveur refuse de démarrer sans un vrai `ADMIN_PASSWORD` — `demo`, la valeur par défaut, ne passe pas.

1. Ouvre `/connexion` (« Espace animateur ») et entre ton identifiant et ton mot de passe. Si ton profil de joueur tient ton espace, te connecter à ton profil ouvre aussi ta console.
2. Ouvre `/admin` — ou, depuis « Compte », « Administration · Toi seul » › « Le QG ». Sans session, `/admin` te renvoie à la connexion, puis t'y ramène.

Un autre animateur lit « Cette page est réservée à l'administrateur. » ; une télé branchée par un code n'administre rien, pas même celle que ta console a branchée. Des espaces des autres, le QG ne montre que des chiffres : leurs quiz, leurs questions, les prénoms de leurs invités et les titres de leurs soirées restent chez leur animateur.

| Page | Adresse | Ce que tu y trouves |
|---|---|---|
| La vue d'ensemble | `/admin` | l'instant, ce qui attend un geste, la journée, trente jours, le serveur |
| Le journal | `/admin#journal` | tes gestes, du plus récent au plus ancien |
| Le serveur | `/admin#serveur` | sept jours de santé, heure par heure |
| Les soirées | `/admin#soirees` | celles qui se jouent, celles laissées en plan, le bilan du mois |
| Le quiz du jour | `/admin#jour` | la journée, la réserve, le tirage, le classement, les séries, le rappel du soir |
| La campagne | `/admin#campagne` | la journée, ce qu'on joue, le défi de la semaine, les parcours, les vies, les sentiers et leurs mélanges, la base, la routine du matin, les signalements |
| Les profils | `/admin#profils` | chaque joueur, et sa fiche |
| Les salons | `/admin#salons` | chaque espace du serveur |
| Le catalogue | `/admin#catalogue` | les copies de quiz proposées à tous |

Le QG se tient à jour seul — le direct toutes les dix secondes, la vue d'ensemble toutes les cinq minutes et chaque fois que tu y reviens — et ne relit rien tant que l'onglet est caché. En tête, « En direct » ; si le serveur se tait, « Dernier relevé à 21 h 40 » ou « Le serveur ne répond pas ».

## La vue d'ensemble

**En ce moment** : les soirées en cours (« et 1 laissée en plan »), les invités connectés sur ceux inscrits ce soir, les profils passés ces cinq dernières minutes, et les écritures qui attendent le miroir Turso — « miroir à jour », ou « Turso en échec depuis 21 h 05 », « 2 salons en retard ».

**À traiter** : ce qui attend un geste, le plus pressé d'abord ; une ligne qui a sa page l'ouvre. Rien ? « Rien n'attend de geste : la réserve tient, personne ne signale rien. »

| La ligne | Elle paraît quand… | Où agir |
|---|---|---|
| « Le miroir Turso est en panne » (rouge) | Turso échoue, ou des salons sont en retard | [Exploiter](../exploitation/exploiter.md) |
| « Le serveur s'est arrêté net » (rouge) | un démarrage des dernières 24 heures s'est arrêté sans s'éteindre proprement | Le serveur |
| « N erreurs serveur » (rouge) | des erreurs depuis le début de l'heure d'avant ; la source la plus fréquente est nommée | Le serveur |
| « La mémoire approche du plafond » (rouge) | plus de 450 Mo, sur les 512 de l'hébergeur | Le serveur |
| « Turso répond lentement » | plus d'une seconde au 95ᵉ centile, sur au moins vingt allers-retours | Le serveur |
| « La réserve du quiz du jour » (rouge) | moins de sept jours d'avance | Le quiz du jour |
| « Signalements du quiz du jour » · « … de la campagne » | des questions signalées | Le quiz du jour · La campagne |
| « Une copie à relire » | des copies proposées au catalogue | Le catalogue |
| « Une soirée laissée en plan » | six heures sans un signe de vie | Les soirées |
| « Le rappel du soir » | des envois en échec à la dernière tournée | — |

**Aujourd'hui** : Profils actifs, Quiz du jour, Séries de campagne, Duels joués, Nouveaux profils, Achats en boutique — chacun comparé à la même heure, en moyenne sur les sept jours d'avant (« 12 % » et sa flèche ; sous vingt d'habitude, « 7 d'habitude » ; ou « comme d'habitude »), avec le trait des douze derniers jours. Comparé à des journées entières, un soir à 21 h se lisait toujours en baisse.

**Participations par jour** : trente jours, mode par mode — soirées, campagne, quiz du jour, duels. Un joueur compte une fois par mode et par jour ; en soirée, chaque invité qui a joué, au jour de la première question. « Les chiffres, jour par jour » déplie le tableau.

**Soirées en cours** : chaque soirée par son salon — où elle en est, depuis quand, combien de téléphones connectés sur combien d'inscrits, « aucun écran branché » s'il y a lieu, « sauvegardée » ou « sauvegarde en retard ». **Le serveur** : mémoire, processeur (en part d'un cœur), boucle occupée, Turso au 95ᵉ centile, connexions temps réel, et le dernier dépôt de la routine du matin dans la réserve du quiz du jour et dans la base de la campagne.

## Le journal de tes gestes

Chaque geste du QG qui change quelque chose s'y note de lui-même, en une phrase qui nomme ce qu'il a touché : « Profil supprimé : Tom (@tom) », « Espace désactivé : Nadia B. », « Soirée laissée en plan close : Antoine — rien n'avait été joué ». Un refus ne s'y note jamais. Un geste noté ne se modifie ni ne s'efface : défaire, c'est faire le geste contraire, qui se note à son tour. Le journal garde le nom d'un profil supprimé — la trace de ce qui a eu lieu.

Filtres : Tous, Soirées, Profils, Salons, Catalogue, Quiz du jour, Campagne. Les gestes se rangent par jour (« Aujourd'hui », « Hier », puis la date), cinquante à la fois (« Voir les gestes d'avant »). La fiche d'un joueur reprend les tiens sur son profil (« Tes gestes sur ce profil »). Un code de secours tiré n'y paraît jamais, seulement sa phrase : « Code de secours neuf tiré : Léa (@lea) ».

## La santé du serveur

Sept jours, heure par heure, gardés dans la base permanente ; la nuit, l'hébergeur endort le serveur, et ses heures sont hachurées.

- **Cette semaine** : les démarrages (le plus long à être prêt, les arrêts nets), les erreurs serveur, Turso et les routes au 95ᵉ centile comparés à leur habitude, et la route la plus lente.
- **Ce qu'un joueur attend** (le 95ᵉ centile des routes d'API) et **Turso** (celui d'un aller-retour vers la base), heure par heure.
- **La charge, heure par heure** : le processeur (la moyenne, en part d'un cœur), la boucle (le pire gel — toute la salle l'attend), la mémoire et les invités connectés (leurs pics), avec en pointillé les plafonds de l'hébergeur gratuit : un dixième de cœur, 512 Mo.
- **Les erreurs serveur** : les routes et les sockets en erreur, les exceptions échappées, et leurs sources.
- **Réveils et arrêts** : chaque démarrage et sa raison — « Réveil » (l'hébergeur rallume le serveur endormi), « Mise en ligne » (une version neuve), « Relancé » (le serveur d'avant vivait encore, ou s'est éteint dans la minute), « Redémarrage après un arrêt net » —, et chaque « Arrêt net » : ni extinction propre, ni signe de vie depuis vingt minutes. Puis le tableau des heures éveillées.

Une alerte du serveur se traite dans [Exploiter](../exploitation/exploiter.md).

## Les soirées

« Les quiz, les questions et les prénoms des invités restent chez leur animateur : le QG n'en voit que les chiffres. »

- **En direct** : les soirées qui se jouent.
- **Laissées en plan** : sans un signe de vie — une arrivée, une réponse, une partie qui avance — depuis six heures. Leurs invités attendent leurs récompenses de clôture, et leurs profils ne se suspendent ni ne se suppriment tant qu'elles ne sont pas closes.
- **Ces trente jours** : Soirées, Invités par soirée (la médiane), Quiz par soirée, Questions jouées — chaque soirée comptée au jour de sa première question. **Quand on joue** et **La taille des salles**, sur quatre-vingt-dix jours. **L'historique du mois** : date, salon, invités, quiz, questions (« · pas encore close »).

**Clore une soirée laissée en plan** est ton seul geste sur la soirée d'un autre. « Clore la soirée », puis confirme : elle se range dans l'historique et ses invités sont crédités comme à une clôture ordinaire — expérience, podium, prix ; chaque téléphone reçoit sa fin de soirée, et son animateur la retrouve close (« Soirée close — ses invités sont crédités », ou « … rien n'y avait été joué »). Une soirée qui a repris vie se refuse (« Cette soirée vit encore : seule une soirée laissée en plan se clôt d'ici »), comme celle que son animateur est en train de finir.

## Les profils et la fiche d'un joueur

« N profils sur ce serveur. Sans recherche, les derniers vus. » Cherche par prénom ou par identifiant : trente résultats au plus, les profils suspendus compris. Une ligne ouvre la fiche : @identifiant, niveau, « en ligne » ou « dernier passage … » ; Inscription, Soirées, Quiz du jour (« · hors classement » s'il y est masqué), Campagne, Duels, Confettis (« dont 50 offerts »), Espace (son salon ou le compte d'animateur qu'il tient), Connexion (« ouverte », ou « fermée jusqu'à 22 h 15 »), l'épreuve de sentier qui l'attend, et « Tes gestes sur ce profil ».

### L'aider

| Geste | Ce qu'il fait |
|---|---|
| « Offrir des confettis » | De 1 à 500 (50 par défaut), avec un mot facultatif de 140 caractères au plus, « lu sur son accueil ». Un don ne se reprend pas, et ne se fait pas à un profil suspendu. |
| « Tirer un code de secours » | Pour qui a perdu son mot de passe : un code neuf, montré une seule fois (« Copier le code »), à lui transmettre. Il le tape dans « J'ai oublié mon mot de passe » avec son identifiant, puis choisit un mot de passe ; un nouveau code, que personne d'autre ne voit, remplace alors le tien. Son code d'avant ne vaut plus rien. |
| « Lever le verrou de connexion » | Paraît quand sa connexion est fermée — cinq essais manqués, du mot de passe ou du code de secours, la ferment un quart d'heure — et la rouvre aussitôt. |
| « Libérer l'épreuve » | Paraît quand une épreuve de sentier l'attend — tant qu'elle attend, aucune autre ne commence — et la referme sans lui coûter de vie. |

Il n'y a ni adresse e-mail, ni mot de passe provisoire, ni lien de réinitialisation : le code de secours est la seule porte de retour d'un profil.

### Le modérer

| Geste | Ce qu'il fait |
|---|---|
| « Changer son prénom » | Pour un prénom qui ne va pas — jamais pour départager deux homonymes : la salle les distingue d'elle-même. Ses soirées passées gardent l'ancien. |
| « Suspendre » | Ses sessions tombent, et les consoles qu'il avait ouvertes ; le profil ne s'ouvre plus — son bon mot de passe lui répond « Ton profil est suspendu : demande à l'administrateur de le réactiver » — et disparaît des classements, de la recherche et des cartes. Rien ne s'efface. |
| « Réactiver » | Il retrouve tout, et se reconnecte. |
| « Supprimer le profil » | Le dialogue dit, avant le clic, ce qui part et ce qui reste. |

La suppression efface pour de bon son niveau, ses avatars, ses trophées, ses achats, les confettis qu'on lui a offerts, ses parties du quiz du jour et de la campagne, ses duels, ses amis et ses rappels du soir ; son identifiant redevient libre. Restent les soirées jouées, dans l'historique des autres avec ce qu'elles leur ont rapporté, et l'espace qu'il tenait, détaché — son salon garde ses quiz et les souvenirs de ses soirées ; tu le supprimes à part, dans « Les salons », si tu le veux. Suspendre et supprimer se refusent tant qu'il joue une soirée pas encore close : sa clôture ne le retrouverait plus.

**Ce que le joueur en voit** : en tête de son accueil, une fois par téléphone, ce que tu as fait pour lui ces trente derniers jours — « +50 confettis », ton mot, « — de l'administrateur » ; ou « Ton prénom a changé » —, chaque annonce avec son « Merci ».

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

## Le quiz du jour

Les règles du mode vivent dans [Le quiz du jour](../produit/le-quiz-du-jour.md) ; sa page au QG suit la journée et tient la réserve.

- **Aujourd'hui** : les parties commencées et finies (comparées à la même heure d'habitude), la part de bonnes réponses et celle d'hier, les séries en cours et la plus longue, les téléphones abonnés au rappel et la dernière tournée.
- **La réserve** : ses jours d'avance, ses questions prêtes et déjà posées. Sous sept jours, elle s'allume : « Moins d'une semaine d'avance. Colle une liste, ou copie la consigne dans ton IA : sans question neuve, la réserve rejouera les plus anciennes. » Elle dit si le remplissage automatique est ouvert — la routine du matin y dépose ses questions quand le serveur a son `RESERVE_TOKEN` — et ses derniers apports, avec ce qui a été écarté et pourquoi : elle ne prend que des questions à choix, sans photo. « Coller une liste » (au format de l'éditeur de quiz, puis « Ajouter à la réserve »), « Copier la consigne pour une IA » (la même que celle de la routine : colle-la dans le chatbot de ton choix, puis sa réponse dans « Coller une liste »), « Voir les prochains jours » (les prochaines questions avec leur réponse, « Retirer » en ôte une).
- **Question par question** : le tirage d'aujourd'hui — chaque question, sa part de bonnes réponses, ses signalements ouverts ; touchée, ce que chaque réponse a recueilli (une question piège se voit à la mauvaise réponse qui l'emporte), celles laissées au temps, le temps moyen. « Annuler ses points pour tous », sans attendre un signalement : ses points s'effacent pour tous ceux qui l'ont jouée aujourd'hui, du classement du jour comme du mois, et l'expérience de chacun suit — rien ne la rend. « Retirer de la réserve » : elle ne reviendra plus.
- **Signalements** : chaque question signalée — son jour, sa bonne réponse, ce qu'en disent les joueurs — avec « Annuler ses points pour tous » (tant que son jour court : après minuit, son podium est payé), « Retirer de la réserve », et « Garder », qui referme les signalements.
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
- **La base** : ses questions à jouer et retirées, par catégorie et par difficulté (de 1 à 5). **La routine du matin** : ce qu'elle a déposé aujourd'hui, ces sept jours et en tout, et ses dernières questions — c'est la première fois qu'un humain les lit ; « Retirer » en sort une, pour tous.
- **Signalements** : qui signale, où il a joué, ce qu'il a répondu et ce qu'il en dit ; ce que toutes les réponses en disent ; d'où vient la question, et son identifiant. « Corriger » (l'intitulé, les réponses et la bonne, l'anecdote : la même bonne réponse garde l'identifiant et les mesures de la question ; une autre la fait repartir sous un nouvel identifiant et retire l'ancienne ; les séries déjà tirées gardent la version qu'elles ont lue), « Retirer de la campagne » (pour tous, pour toujours), « Garder » (referme les signalements).

Une épreuve de sentier qui bloque un joueur se libère depuis sa fiche.

## Les comptes d'avant

Avant les salons ouverts par les profils, un animateur recevait un compte : un identifiant, un mot de passe, une adresse choisie (`/chez-bob`). Il en reste ; « Les salons » les marque « mot de passe », ou « à activer » tant qu'aucun mot de passe n'a été choisi. Le tien en est un si ton espace est né au premier démarrage du serveur.

- **Un mot de passe perdu, ou jamais choisi** : sur la feuille du compte, « Un lien pour son mot de passe ». Envoie-le par le canal de ton choix : il vaut sept jours, ne sert qu'une fois, et en refaire un annule le précédent. La personne l'ouvre (`/activer`), voit son identifiant et l'adresse de son espace, choisit un mot de passe de 8 caractères au moins, et arrive sur « Compte » ; ses autres sessions sont fermées.
- **Un profil à rattacher** : le titulaire rattache lui-même son profil à son espace (« Compte » › « Mon profil joueur »), en donnant le mot de passe de ce profil. Quand ce n'est pas possible — l'identifiant de son compte était déjà pris par un autre profil —, fais-le pour lui : « Rattacher à un profil ».

## Pour aller plus loin

- [La sécurité](../architecture/securite.md) — les comptes, les sessions, les limites d'essais, le cloisonnement des espaces
- [Exploiter](../exploitation/exploiter.md) — surveiller, sauvegarder, restaurer, dépanner
- [La mise en ligne](../exploitation/mise-en-ligne.md) — le compte administrateur, `RESERVE_TOKEN` et la routine du matin
- [Le quiz du jour](../produit/le-quiz-du-jour.md), [La campagne](../produit/la-campagne.md), [Les sentiers du savoir](../produit/les-sentiers-du-savoir.md) — les règles des modes que le QG surveille
- [L'API HTTP](../reference/api-http.md) — les routes `/api/admin/…`
