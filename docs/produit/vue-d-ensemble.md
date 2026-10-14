# FiestApp en une page

> Ce qu'est FiestApp, à qui elle sert, ses modes de jeu, ses partis pris, et la carte de ses pages. À lire en premier.

## Ce que c'est

FiestApp est un **quiz de soirée**. Un écran commun — une télé, un vidéoprojecteur, l'ordinateur branché dessus — montre les questions à toute la salle ; chaque invité répond sur **son téléphone**, dans le navigateur, sans rien installer : il scanne un QR code ou tape un code à six chiffres, choisit un prénom et un avatar, et joue. Les points tombent à chaque révélation, en individuel et par équipe, et la soirée se termine par un podium, des prix et une page souvenir à partager.

Elle est **auto-hébergée et gratuite** : un serveur Node sur une offre gratuite (Render) et une base libSQL gratuite (Turso) suffisent. Plusieurs animateurs partagent le même serveur ; chacun a **son espace** — ses quiz, ses soirées, son historique — et ne voit rien de ceux des autres.

Entre deux soirées, les joueurs qui ont un **profil** continuent seuls ou entre amis : le quiz du jour, la campagne, les sentiers du savoir, les duels. Un profil garde sa progression d'une soirée à l'autre — niveaux, trophées, avatars peints, collection —, mais ne donne jamais un avantage de jeu.

## Les modes de jeu

| Mode | En deux mots | Pour qui | Où | En savoir plus |
|---|---|---|---|---|
| **La soirée** | Un quiz animé sur l'écran commun, chacun répond depuis son téléphone ; équipes, podiums, prix | les invités, avec ou sans profil, et un animateur | `/<espace>`, l'écran commun (`/host`, `/tele`) | [La soirée](la-soiree.md) · [Les questions](les-questions.md) · [Après la soirée](apres-la-soiree.md) |
| **Le quiz du jour** | Dix questions par jour, les mêmes pour tous, un classement du jour et du mois, une série à tenir | les profils | `/jour` | [Le quiz du jour](le-quiz-du-jour.md) |
| **La campagne** | Des séries à trois vies, sans chronomètre ; un carnet qui fait revenir ce qu'on rate ; un défi chaque semaine | les profils | `/campagne` | [La campagne](la-campagne.md) |
| **Les sentiers du savoir** | Douze branches, des paliers à valider, des portraits peints à gagner | les profils | `/campagne#sentiers` | [Les sentiers du savoir](les-sentiers-du-savoir.md) |
| **Les duels** | Une cote, des ligues, des défis à ses amis, et Automate, toujours disponible | les profils | `/duels` | [Les duels](les-duels.md) |

Les questions des soirées viennent de la bibliothèque de l'animateur — écrites dans l'éditeur, collées depuis une liste, importées, partagées, ou composées d'un geste par le **quiz tout prêt** dans la base de questions relues de la campagne ([Les quiz](les-quiz.md)).

## Les gens

**L'invité.** Il arrive par le QR de l'écran commun ou par le code du salon, et l'entrée lui propose trois gros boutons : « Jouer sans compte » d'abord, puis « Me connecter » et « Créer un profil ». Sans compte, un prénom et un avatar suffisent ; son téléphone retient sa place, et il la retrouve après une coupure. Rien ne le marque : un invité anonyme n'a ni niveau ni pastille, pas même un « niveau 0 ». Voir [Jouer](../guides/jouer.md).

**Le joueur à profil.** Un prénom, un mot de passe, un code de secours pour le jour où il l'oublie — ni adresse e-mail, ni téléphone. Il ne rechoisit jamais son prénom ni son avatar en entrant dans une soirée, garde son expérience, ses prix et sa collection, joue aux modes solo, et s'habille dans sa loge. Voir [Le profil](le-profil.md) et [Les récompenses](les-recompenses.md).

**L'animateur.** Un profil qui ouvre son **salon** — son espace — d'un toucher, ou un compte d'animateur d'avant, à identifiant et mot de passe. Il prépare ses quiz, branche une télé par son code ou ouvre l'écran commun, et anime depuis la console ou depuis son téléphone, en jouant avec les autres ou en animant seulement. Voir [Animer une soirée](../guides/animer-une-soiree.md).

**L'administrateur.** Le compte créé au premier démarrage du serveur. Il veille sur tout depuis le QG (`/admin`) : ce qui se joue, la santé du serveur, les soirées laissées en plan, les joueurs à aider ou à modérer, les salons, les réserves de questions. Voir [Administrer](../guides/administrer.md).

## Les partis pris

Quelques choix tiennent l'application depuis le début. Chaque fonctionnalité nouvelle se range derrière eux.

1. **Jouer sans compte, toujours.** « Jouer sans compte » est le premier bouton de l'entrée ; les profils s'ajoutent à ce chemin, ils ne le remplacent pas. La moitié d'une salle n'en créera jamais, et c'est très bien ainsi.
2. **Le serveur décide.** Toute la logique du jeu vit sur le serveur ; un écran ne reçoit que ce qu'il doit montrer. La bonne réponse n'arrive sur aucun téléphone avant la révélation.
3. **Rien ne se perd.** Chaque réponse reçoit un accusé ; chaque écriture de la soirée est recopiée dans la base permanente ; un téléphone retrouve sa place, un serveur qui redémarre reprend la question là où elle en était.
4. **Ce qui a été joué se garde.** Les journaux de chaque soirée se rangent tels quels, et les pages — souvenir, bilan, prix, expérience — se recalculent à partir d'eux : une amélioration d'aujourd'hui profite aux soirées passées.
5. **Zéro euro, zéro donnée personnelle.** Des offres gratuites pour héberger, aucune adresse e-mail demandée.
6. **Chacun chez soi.** Un identifiant qui n'appartient pas à son espace vaut « introuvable » : les espaces ne se voient pas.

Le pourquoi technique de chacun : [la vue d'ensemble de l'architecture](../architecture/vue-d-ensemble.md).

## La carte des pages

| Adresse | Ce qu'on y trouve | Pour qui |
|---|---|---|
| `/` | L'accueil : sans profil, le choix à trois boutons ; avec, ses gros boutons de jeu | tout le monde |
| `/profil` | Le profil : la loge (« M'habiller »), « Ma collection », « Mes soirées », « Ma carrière » | les profils |
| `/boutique` | La boutique : thèmes, compagnons, objets | les profils |
| `/jour` | Le quiz du jour | les profils |
| `/campagne` | La campagne : séries, sentiers, défi, « Apprendre » | les profils |
| `/duels` | Les duels | les profils |
| `/salon` | Ouvrir son salon | les profils |
| `/<espace>` | Le téléphone d'un invité : l'entrée, la salle d'attente, le quiz, la fin de soirée | les invités |
| `/host` · `/tele` | L'écran commun, et la télé qu'on branche par son code | l'animateur |
| `/edit` | « Mes quiz » et l'éditeur | l'animateur |
| `/compte` | Le compte de l'espace : réglages, historique | l'animateur |
| `/admin` | Le QG | l'administrateur |
| `/<espace>/souvenir` · `/<espace>/bilan` · `/<espace>/soirees` | Le souvenir, le bilan et l'historique — publics, par leur lien | tout le monde |

Toutes les adresses, leurs variantes et leurs redirections : [la référence des adresses](../reference/adresses.md).

## Pour aller plus loin

- [La vitrine](https://maxilyas.github.io/FiestApp/) — FiestApp en images, sur l'application réelle
- [La première soirée](../guides/premiere-soiree.md) — lancer FiestApp chez soi et jouer un premier quiz
- [La vue d'ensemble de l'architecture](../architecture/vue-d-ensemble.md) — comment c'est construit
- [L'historique](../contribuer/historique.md) — comment on en est arrivé là
