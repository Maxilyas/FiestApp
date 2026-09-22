# Quizz de soirée 🎉

Quiz façon Kahoot, gratuit et auto-hébergé, né pour les 30 ans de Romane (19 septembre 2026) et devenu un outil pour toutes les fêtes. Chaque invité joue depuis son téléphone (navigateur, rien à installer), un écran commun (TV/vidéoprojecteur) anime la soirée, et un classement cumulé traverse tous les quiz de la soirée — en individuel **et** par équipe, le quiz n'étant qu'un des trois jeux de la fête.

Plusieurs animateurs partagent le même serveur : chacun a **son compte et son espace** — ses quiz, ses soirées, son historique, son adresse à scanner — et ne voit rien de ceux des autres.

## Démarrage rapide

Prérequis : Node ≥ 20.

```bash
npm install
```

```bash
npm run dev
```

Chez soi, le compte administrateur est `antoine` / `romane` et son espace s'appelle `romane` (variables `ADMIN_*`, voir plus bas). Les adresses, une par usage :

| Page | Adresse | Pour qui |
|---|---|---|
| Jeu | http://localhost:5173/romane | les invités (sur leur téléphone : `http://<IP-du-PC>:5173/romane`) — c'est l'adresse du QR |
| Écran commun | http://localhost:5173/host | la TV / le vidéoprojecteur, une fois l'animateur connecté |
| Mes quiz | http://localhost:5173/edit | l'animateur, pour écrire ses quiz |
| Mon profil | http://localhost:5173/profil | un invité qui revient : son niveau, ses finitions, ses éclats |
| Mon compte | http://localhost:5173/compte | ses réglages de soirée, son mot de passe, l'adresse de ses invités |
| Les comptes | http://localhost:5173/admin | l'administrateur seul : créer un compte à un ami |
| Souvenir | http://localhost:5173/romane/souvenir | tout le monde, le lendemain : podium, palmarès, équipes et tous les chiffres ; l'animateur pendant la fête aussi, la page se rafraîchit seule (`/romane/stats` y mène, droit sur le tableau) |
| Bilan | http://localhost:5173/romane/bilan | les invités, le lendemain : chacun relit ses réponses ; l'animateur y trouve les fiches à imprimer |
| Soirées | http://localhost:5173/romane/soirees | l'historique : chaque soirée passée, avec son souvenir, chiffres compris, et son bilan |

```bash
npm run check
```

```bash
npm run smoke
```

`check` = typecheck serveur + client. `smoke` = test de bout en bout (comptes et sessions, suppression d'un compte, garde-fous, isolation des espaces, inscription, quiz complet, scoring, classement, reconnexion, accusé de réception des réponses, heure du serveur et marge de fin de question, bibliothèque, photos, estimation et estimation saboteuse, retardataire, photo « mémoire », équipes, barème des trois jeux, statistiques et prix, bilan question par question et export, anciennes adresses, reprise après coupure avec deux parties en cours, historique des soirées, mise à jour d'une base d'avant les comptes, profils joueurs et expérience d'une soirée).

## Les comptes et les espaces

Un compte = un animateur = un **espace**, désigné par un nom court dans l'adresse (`/romane`, `/chez-bob`). Tout ce qui se joue, s'écrit ou se range est rattaché à l'espace :

- **ses quiz et ses photos** (`/edit`) ;
- **sa soirée en cours** — invités, équipes, points, partie en cours — et son écran commun (`/host`) ;
- **son historique** (`/romane/soirees`) et les pages publiques de chaque soirée (`/romane/souvenir`, `/romane/bilan`) ;
- **ses réglages** (`/compte`) : le titre de la soirée, le surtitre et le grand titre de l'écran d'inscription (« Les trente ans de / Romane »), la date telle qu'on l'écrit, le nombre maximal d'invités.

Les pages d'animation ne portent pas l'espace dans l'adresse : c'est la session de l'animateur connecté qui le dit. Un identifiant de quiz ou de soirée qui n'est pas du sien vaut « introuvable », et une commande envoyée à la partie d'un voisin est refusée sans que le voisin en sache rien. Les pages des invités, elles, restent **publiques par leur lien**, comme avant : le souvenir — chiffres compris — et le bilan se partagent dans le groupe sans compte. Un fil sous leur titre mène de l'une à l'autre et à l'historique, et rappelle à l'animateur connecté le chemin de son compte.

**Les comptes se créent depuis `/admin`**, par l'administrateur seul : un prénom, un identifiant, un nom d'adresse, et l'application rend un **lien d'activation** à envoyer par le canal qu'on veut. L'ami ouvre le lien, choisit son mot de passe, et son espace est prêt — avec une bibliothèque vide. Le lien vaut sept jours et ne sert qu'une fois ; **un mot de passe oublié se règle par un nouveau lien**, depuis la même page. Un compte se désactive (ses écrans se ferment, ses pages restent lisibles) et se réactive. Un compte désactivé peut ensuite être **supprimé** : ses quiz, ses photos, ses soirées archivées et sa soirée en cours partent avec lui, sans retour, et son identifiant comme son adresse redeviennent libres — **exporte ses soirées avant** (`npm run export -- https://ton-app.onrender.com --slug chez-bob`) si tu veux en garder une trace. L'espace de l'administrateur, celui où mènent les anciennes adresses, ne se supprime pas.

**Pour l'administrateur**, rien ne change : son compte naît au premier démarrage depuis `ADMIN_LOGIN` / `ADMIN_PASSWORD` / `ADMIN_SLUG` / `ADMIN_NAME`, et tout ce qui existait avant les comptes — bibliothèque, photos, archives, soirée en cours — lui est rattaché au premier démarrage, sans rien copier ni effacer. Les anciennes adresses (`/bilan`, `/souvenir`, `/soirees/<id>/…`) redirigent vers son espace : les liens déjà partagés et les QR déjà imprimés restent bons. La racine `/` demande le nom de la soirée à qui arrive sans lien.

## Les profils joueurs

**Rien ne change pour qui ne veut rien changer.** On arrive, on tape un prénom, on joue : c'est toujours le chemin par défaut, en un geste, et c'est celui de la moitié de la salle. Les profils sont pour les autres — ceux qui reviennent.

Un profil (`/profil`) garde ce qu'on a fait **d'une soirée à l'autre et d'un animateur à l'autre** : de l'expérience, un niveau, des finitions d'avatar. Il se crée en trois champs, depuis l'écran d'inscription ou entre deux quiz, et se retrouve ensuite tout seul — le téléphone s'en souvient un an.

**Un profil ne donne jamais un avantage de jeu.** Pas de point bonus, pas de temps en plus, pas de question plus facile : une soirée où les inscrits marqueraient plus ne serait plus une soirée. Il donne du prestige et de la durée, jamais de la performance. C'est pour la même raison qu'un invité anonyme n'affiche **rien** — ni « Niv. 0 », ni pastille grise. L'absence, pas l'infériorité.

**L'expérience** se gagne en venant jouer, et elle récompense d'abord d'être là : 50 points de présence, 1 par question répondue, 2 par bonne réponse, 60/40/25 pour le podium de la soirée et 15 par quiz remporté. Un niveau qui ne mesurerait que la culture générale n'aurait pas le goût d'une soirée entre amis. Une soirée ordinaire vaut environ 115 points ; les premiers niveaux tombent dans la soirée même, le niveau 10 demande huit soirées et le niveau 20 une trentaine.

Tout se calcule **au moment où la soirée est rangée dans l'historique** — la seule fenêtre où les journaux sont encore là, juste avant que « Nouvelle soirée » n'efface. Ranger deux fois la même soirée recalcule au lieu de créditer deux fois.

**Les finitions** habillent l'avatar sans jamais changer l'emoji : Alice reste le renard, c'est ce qui l'entoure qui dit son niveau. Mat au départ, **Argent** au niveau 3, **Or** au 6, **Holo** au 10, **Prisme** au 15 — on porte celle qu'on veut parmi celles qu'on a, et rester en Mat au niveau 15 se remarque aussi.

**L'Éclat**, lui, ne se gagne pas. À chaque soirée jouée avec un profil, **une chance sur quarante** qu'un de vos avatars « s'éclate » : l'emoji lui-même change de couleurs, définitivement, et pour celui-là seulement. Ton renard brille, celui du voisin non. On ne peut ni l'acheter ni l'accélérer, seulement venir jouer.

**Le mot de passe oublié se règle par un code de secours**, affiché une seule fois à l'inscription. Pas d'adresse e-mail : aucune donnée personnelle, rien à héberger, et qui perd tout garde le chemin anonyme, qui n'a jamais été fermé.

**L'animateur peut jouer aussi.** Le cookie d'un profil est distinct de celui d'un compte d'animateur : les deux coexistent dans le même navigateur, de sorte qu'on pilote la soirée depuis la TV en y jouant depuis son téléphone. Son téléphone doit être connecté **au lancement** du quiz, sinon il entre en retardataire à la question suivante.

## Écrire ses quiz

Tout se passe dans **Mes quiz** (`/edit`), réservé à l'animateur connecté : chaque compte a sa bibliothèque. On y crée, duplique et supprime des quiz ; dans un quiz, on ajoute des questions, on les réordonne, on choisit la bonne réponse, le temps de réponse et une photo.

Deux types de questions, au choix pour chacune :

| Type | Comment on répond | Score (200 pts max) |
|---|---|---|
| 🔘 **QCM** | 2 à 4 réponses, une bonne (2 = vrai/faux) | 100 pts si c'est juste + jusqu'à 100 pts de rapidité |
| 🔢 **Estimation** | chacun tape un nombre | 30 pts pour avoir joué + jusqu'à 120 pts selon le rang de proximité + 50 pts au plus proche |

Un **vrai/faux** n'est qu'un QCM à deux réponses : on tape « Vrai » et « Faux » dans les deux premières cases et on laisse les autres vides.

L'estimation évite les blocages : même sans connaître la réponse, on propose un chiffre et on marque quelque chose. La proximité est calculée **par rapport au groupe** — sinon une erreur de 3 ans sur une date et une erreur de 3 km sur une distance rapporteraient la même chose. C'est le **rang** qui compte, pas la distance : le plus proche empoche le maximum, le suivant un peu moins, le plus loin garde ses 30 pts de participation. Une faute de frappe chez le voisin (« 19940 » pour 1994) ne change donc rien aux points des autres — avec une échelle proportionnelle, elle donnait le maximum à toute la salle. À égalité d'écart, le plus rapide gagne.

- **Les cases de réponse vides** sont simplement ignorées en jeu (et la bonne réponse suit son texte, pas son numéro de case).
- **Les brouillons ne sont jamais perdus** : une question incomplète est enregistrée telle quelle, signalée par un ⚠️, et sautée au moment de jouer. La liste affiche « 8 questions prêtes · 2 à compléter ».
- **Photos** : le navigateur les réduit et les recompresse avant l'envoi (une photo de téléphone de 4 Mo devient ~150 Ko), puis elles vivent dans la base.
- **On peut changer d'avis** jusqu'à la révélation, sur un QCM comme sur une estimation : un doigt qui glisse sur un téléphone tenu dans le noir ne doit pas coûter la question. C'est le dernier envoi qui fait foi, heure comprise — se raviser coûte donc du bonus de rapidité, sans quoi on pourrait taper au hasard dès la première seconde pour s'assurer le maximum, puis corriger tranquillement.
- **Une réponse envoyée est une réponse accusée.** Le serveur répond à chaque envoi, et le téléphone le dit quand ça n'est pas passé — « trop tard », « en pause », « vérifie ta connexion ». Sans cet accusé, une réponse refusée disparaissait en silence : le téléphone avait vibré sous le doigt, l'écran ne montrait rien, et l'invité restait persuadé d'avoir répondu. La réponse porte aussi son espace et son jeton, pour le cas qui en perdait le plus : un téléphone qui sort d'une veille ou d'un trou de réseau a, côté serveur, une connexion toute neuve qui ne sait plus ni quelle soirée elle suit ni qui elle est — et le navigateur lui fait vider sa file d'attente avant que la page ait pu se re-présenter.
- **Le chronomètre se lit à l'heure du serveur.** Les échéances sont des instants absolus du serveur, et chaque écran les comparait à la sienne — or une horloge de téléphone dérive, et certaines sont réglées à la main. Un appareil qui retardait de cinq secondes affichait 25 secondes sur une question qui en durait 20 : son porteur répondait « à quatre secondes de la fin » alors que la question était close, et sa réponse disparaissait. Toujours les mêmes personnes, à toutes les questions. L'écart se mesure maintenant à chaque connexion (trois mesures, on garde la plus rapide) et tous les chronomètres s'y cadrent.
- **La fin d'une question laisse passer les retardataires.** Le serveur coupe une seconde et demie après l'échéance affichée — auparavant 400 ms, soit moins qu'un aller simple depuis un téléphone en 4G dans une salle où cinquante autres partagent la cellule. Une réponse tapée juste avant la fin arrive donc encore : elle vaut la bonne réponse, mais le bonus de rapidité est épuisé. Et la révélation déclenchée par la dernière réponse de la salle attend un souffle avant de partir, au lieu de couper la parole à celles encore en vol.
- **Coller une liste** évite de saisir cinquante questions une par une. Une ligne vide sépare deux questions, l'étoile marque la bonne réponse, le signe égal crée une estimation. Les questions sans étoile sont importées mais signalées. La liste arrive à la fin, sauf si on lui donne un numéro : « à partir du n° 41 », et les suivantes se décalent.
- **Déplacer une question au n°** : la pastille « Question 3 » se clique, on tape le numéro voulu, et la question le prend exactement — les autres se décalent, un numéro trop grand l'envoie à la fin. La page défile jusqu'à sa nouvelle place, et « Annuler », sous le titre, défait le dernier déplacement. Les flèches restent pour le ± 1.
- **Insérer, dupliquer** : sur chaque carte, un « + » insère une question vide juste après, et un bouton la duplique juste après, pour en faire une variante.
- **👁 Aperçu** montre une question telle qu'elle sera projetée, sans lancer de partie.
- **🙈 La photo disparaît** transforme n'importe quelle question — QCM comme estimation — en jeu de mémoire. Voir plus bas.

Au tout premier démarrage, les quiz livrés dans `server/content/quiz/*.json` sont importés une fois dans la bibliothèque de l'administrateur pour ne pas partir d'une page blanche. Ensuite ces fichiers ne servent plus à rien : tout vit dans la base. Les autres comptes commencent avec une bibliothèque vide.

## Déroulé d'une partie

L'animateur clique **Lancer un quiz** sur l'écran commun, choisit le quiz, et le 3-2-1 démarre. Pour chaque question : la question s'affiche, chacun répond sur son téléphone, la révélation montre la bonne réponse, la répartition des réponses, le plus rapide et le top 5. À la fin, podium — et les points s'ajoutent au **classement de la soirée**, qui survit d'un quiz à l'autre (et à un redémarrage du serveur).

Pendant une question, **l'écran commun bascule en mode scène** : les panneaux latéraux s'effacent, la question et les réponses grossissent, le QR code se réduit dans un coin — il reste visible pour les retardataires sans voler la vedette. Une barre de temps se vide en couleur (elle se lit du fond de la salle bien mieux qu'un chiffre) et passe au rouge dans les cinq dernières secondes.

**Le son** sort uniquement de l'écran commun : cinquante téléphones qui bipent ensemble, c'est une cacophonie. Les sons sont générés à la volée par le navigateur — aucun fichier à héberger, aucune musique sous droits, rien qui arrive en retard. Le bouton 🔊 de l'en-tête les coupe (le choix est mémorisé). Les navigateurs interdisant tout son avant une interaction, l'audio s'initialise au premier clic sur « Lancer un quiz ».

**Le vidéoprojecteur délave les noirs** : dans une salle éclairée, l'écran commun en fond sombre devient un rectangle gris où plus rien ne se lit. Le bouton ☀️ de la console le passe en **mode Ivoire** — fond crème, encre sombre, les teintes des feuilles imprimées de la soirée — et 🌙 le ramène en Velours. Le choix est mémorisé sur le PC de l'animateur et ne concerne que l'écran commun : les téléphones des invités restent sombres, c'est ce qui ménage les yeux dans le noir.

**L'animateur garde la main** : ⏸ pause (le chronomètre se fige, plus personne ne peut répondre), ↺ reposer la même question, ✖ annuler les points d'une question dont la réponse était fausse, renommer ou exclure un invité d'un clic sur sa pastille, et ⛶ plein écran. Aucun secret ne passe par la barre d'adresse : la session est dans un cookie que le navigateur garde pour lui.

**⏩ Manuel / Auto 5 s / Auto 10 s** : en mode automatique, la question suivante part toute seule après la révélation, avec un décompte affiché. Un quiz de dix questions demandait vingt clics — autant d'occasions de décrocher de la soirée. Corriger ou reposer une question reprend la main aussitôt.

## La photo qui disparaît

Cochez **🙈 La photo disparaît avant la question** sous une photo et la question devient un jeu de mémoire. La photo est d'abord projetée **seule**, en grand, pendant le nombre de secondes choisi : ni l'intitulé ni les réponses ne partent sur les téléphones, qui affichent « 👀 Mémorise ! ». Puis elle disparaît et la question démarre avec son chronomètre normal.

C'est cette phase séparée qui fait le jeu. Afficher la photo et les réponses en même temps reviendrait à laisser répondre en la regardant — la mémoire n'y servirait plus à rien.

Le mécanisme marche pour les deux types de question : un QCM (« combien de bougies sur le gâteau ? ») comme une estimation (« en quelle année cette photo a-t-elle été prise ? »). **La photo revient à la révélation**, pour vérifier ensemble ce qu'on croyait avoir vu. L'animateur peut abréger l'observation d'un clic sur **Passer à la question** si tout le monde a déjà vu.

Une photo sans cette case cochée se comporte comme avant : elle reste affichée à côté de la question.

## Les prix de fin de soirée

Chaque réponse est journalisée : qui, à quelle question, en combien de temps, juste ou faux, et même les questions laissées passer. Le classement seul ne suffirait pas — il ne retient que les gains positifs, donc ni les erreurs, ni les temps de réponse n'y laissent de trace.

De ce journal sortent **une vingtaine de prix**, calculés tout seuls : ⚡ L'Éclair (le plus rapide en moyenne), 🐢 Le Contemplatif (le plus lent, mais juste), 🔫 La Gâchette Facile (vite et faux), ⏰ Le Buzzer de Fin, 💯 Le Sans-Faute, 🙃 Le Cancre Magnifique, 😴 L'Abstentionniste, 🔥 L'Invincible, 🌚 La Série Noire, 🔮 Le Devin, 🎈 L'Optimiste, 🪨 Le Pessimiste, 🎯 Le Pile-Poil, 🦄 Le Franc-Tireur, 🐑 Le Mouton, ✋ Le Doigt qui Tremble, 🦸 Le Sauveur, 📈 La Remontada, 📉 La Chute Libre, 👁️ L'Œil de Lynx, plus deux prix d'équipe : 🤝 Le Coup de Pouce et ⚖️ La Plus Solidaire.

**Rien n'est attribué automatiquement.** L'écran **🏅 Remise des prix** les propose avec le nom du lauréat, la règle et le chiffre qui la justifie ; l'animateur choisit lesquels il remet et combien de points ils valent. Un panneau libre permet d'en inventer d'autres (« ont chanté le plus fort », +3), et un prix mal donné se retire d'un clic. Un prix ne se propose que s'il a de la matière : trois réponses ne font pas une moyenne.

Ces points s'ajoutent au **barème des trois jeux**, pas à la moyenne du quiz : ce sont deux choses différentes, et les mélanger rendrait les deux illisibles. L'écran **👑 Victoire** annonce l'équipe qui remporte le quiz, prix compris — reste à y ajouter les deux jeux physiques.

**Les chiffres vivent sur la page souvenir**, sous le podium et le palmarès — `/romane/stats` y mène, droit sur le tableau : dix-sept colonnes, triables en cliquant sur un en-tête, une ligne par joueur — points, réponses données, justes, fausses, taux de réussite, temps moyen, meilleur temps, plus longues séries, questions passées, revirements, réponses de dernière seconde, fois où l'on était seul de la salle, fois où l'on a suivi la majorité, estimations et leur écart moyen, biais optimiste ou pessimiste. La page se rafraîchit toute seule tant que la soirée est en cours et n'a pas besoin de compte : elle se garde ouverte sur le téléphone de l'animateur pendant la fête, et se partage aux invités ensuite. Le tableau défile dans son propre cadre, dans les deux sens — dix-sept colonnes ne tiennent sur aucun téléphone, ni cent invités sur un écran — et garde en vue la ligne des titres et la colonne des prénoms pendant qu'on cherche le sien. Un QR y mène depuis l'écran de remise des prix.

**L'écran de victoire** montre les deux classements côte à côte : les équipes avec leur total du quiz, leurs points cumulés et leur moyenne d'un côté ; le classement individuel de l'autre. Les équipes décident du vainqueur, mais c'est pour son score personnel que chacun a joué — les deux méritent d'être à l'écran au même moment.

## Le bilan, question par question

Le lendemain, chacun veut savoir ce qu'il a répondu — et ce que les autres ont répondu. **La page `/romane/bilan`** le raconte, sans compte : on choisit son prénom dans la liste, et on relit sa soirée question par question — l'intitulé, ce qu'on a répondu, la bonne réponse, son temps, ses points, et en regard ce que son équipe et la salle ont choisi (deux barres par réponse : la salle en champagne, l'équipe en encre). Pour une estimation : sa proposition, la vraie valeur, son rang de proximité et la proposition la plus proche de la salle. En tête, quatre chiffres (points et rang, rang dans l'équipe, réussite, temps moyen) et les moments forts : les prix dont on est le lauréat proposé, son plus beau coup, la question où l'on a été le seul de la salle à trouver, celle qu'on a ratée alors que tout le monde l'avait…

Un seul lien à poster dans le groupe : le téléphone qui a servi à jouer se souvient de son invité et ouvre directement son bilan ; les autres choisissent leur prénom. Chaque bilan a son adresse (`/romane/bilan#p=…`, bouton « Copier le lien ») pour l'envoyer à quelqu'un en particulier. Tout le monde peut lire le bilan de tout le monde : c'est une page souvenir, pas un carnet de notes.

**L'onglet « La soirée »** relit tout pour tout le monde : les questions qui ont marqué (la plus ratée, la plus facile, la plus clivante, la plus hésitante, la plus vite jouée, la plus longue), les équipes quiz par quiz, puis chaque question avec la répartition des réponses, la réussite de chaque équipe, le plus rapide, et le moment où quelqu'un prend la tête du classement.

**Les fiches** (`/romane/bilan/fiches`) enchaînent une fiche par invité, en Ivoire, chacune sur sa page : « Imprimer » puis « Enregistrer en PDF », et on envoie à chacun la sienne — ou on imprime le tout.

**L'export** met les mêmes chiffres en fichiers, pour les garder à l'abri ou rédiger ses messages soi-même :

```bash
npm run export -- https://ton-app.onrender.com --slug romane
```

Il écrit dans `export/romane/` un `bilan.json` complet et trois CSV faits pour Excel (point-virgule, accents corrects) : `invites.csv` (une ligne par invité, une colonne par question — « Canberra ✔ · 1,8 s · 190 pts »), `questions.csv` (une ligne par question, avec la répartition des réponses et la réussite de chaque équipe) et `equipes.csv` (une ligne par équipe, un quiz par colonne). Sans `--slug`, c'est l'espace de l'administrateur. Si le serveur ne répond plus, `npm run export -- --db libsql://… --token …` lit directement la base Turso.

**Comment ça marche, et ce qu'il ne faut pas faire.** Le journal des réponses ne garde que des numéros : celui de la question dans son quiz, celui de la réponse choisie. Les intitulés sont retrouvés dans la copie du quiz que chaque partie terminée conserve sur le disque du serveur, et sinon dans la bibliothèque, par titre de quiz — en vérifiant que ce qu'elle dit colle au journal (type de question, bonne réponse, nombre de réponses). D'où une précaution tant que la soirée n'est pas rangée dans l'historique : **ne pas retoucher les quiz joués** — réordonner ou supprimer une question, vider une case de réponse ou renommer le quiz, et le bilan signale « quiz modifié depuis la soirée », ou perd l'intitulé (les numéros et les points restent). Une fois la soirée archivée, ses questions voyagent avec elle et la bibliothèque peut changer.

## L'historique des soirées

L'application sert plus d'une fête. **`/romane/soirees`** liste les soirées passées de l'espace, et chacune se relit avec les mêmes pages que la soirée en cours : `/romane/soirees/<id>/souvenir`, `/romane/soirees/<id>/bilan` — et les fiches à imprimer avec. Les pages disent en tête quelle soirée elles relisent.

**Sauvegarder** (écran commun, à côté de 🧹 Nouvelle soirée) range la soirée en cours dans l'historique sous le nom qu'on lui donne, sans rien effacer : à faire dès la fin de la fête pour la mettre à l'abri, ou avant même la fin, la soirée continue. **🧹 Nouvelle soirée** fait la même chose avant d'effacer : rien ne s'efface tant que l'archive n'est pas écrite, et si la base distante ne répond pas, la soirée reste là et l'animateur est prévenu. Une soirée archivée deux fois est mise à jour, pas dupliquée : c'est la date et l'heure d'arrivée du premier invité qui l'identifient — dans l'espace, deux animateurs peuvent avoir fait la fête le même soir sans se gêner.

Une archive est une copie complète — invités, équipes, points, prix remis, journal des réponses, et les quiz tels qu'ils ont été posés — rangée dans la base permanente, à côté de la bibliothèque. Rien n'y est précalculé : le souvenir et le bilan se relisent depuis ces données avec le code du jour, et une amélioration des prix ou du bilan profite aux soirées passées. Les quiz voyagent avec l'archive : on peut ensuite retoucher la bibliothèque, ou la réécrire pour la fête suivante, sans rien perdre.

Sur `/romane/soirees`, l'animateur de l'espace — connecté à son compte — renomme une soirée ou la retire de l'historique. L'export sait viser une archive : `npm run export -- https://ton-app.onrender.com --slug romane --soiree 2026-09-19-k7x2q` (l'identifiant est dans l'adresse de ses pages) écrit ses fichiers dans `export/romane/2026-09-19-k7x2q/`.

## Faire durer le suspense

Avec cinquante invités et un classement cumulé, les mêmes trois personnes mènent dès le premier quiz et 47 autres regardent une course perdue d'avance. Deux mécaniques corrigent ça.

**Le multiplicateur.** Avant de lancer un quiz, l'animateur choisit **points normaux, ×2 ou ×3**. Annoncé à la salle, un dernier quiz en points doubles rend tout rattrapable jusqu'à la dernière question — un écart de 400 points redevient jouable. Le multiplicateur s'affiche en or sur l'écran commun et sur chaque téléphone : un bonus qu'on ne voit pas ne motive personne.

**Les prix de caractère.** En plus des trois premiers, l'écran du podium et la page souvenir désignent **le plus beau coup** (le plus gros score sur une seule question), **le plus régulier** (celui qui a marqué sur le plus de questions) et **le vainqueur de chaque quiz** — autant de cadeaux à remettre, et une raison pour chacun de rester dans la partie.

**En fin de soirée**, le bouton 🏆 célèbre le classement cumulé en plein écran, avec un QR vers la **page souvenir** (`/romane/souvenir`) : podium, nombre de quiz, points distribués, le plus beau coup et le plus régulier — et, plus bas, toutes les statistiques. Elle est publique, à partager aux invités le lendemain.

**Entre deux soirées**, 🧹 Nouvelle soirée range d'abord la soirée dans l'historique (voir plus haut), puis efface invités et points, sauvegarde distante comprise — les essais d'avant la fête ne doivent pas traîner dans le classement du soir J. Une archive d'essais se retire ensuite d'un clic sur `/romane/soirees`.

## Les équipes

Le quiz n'est **qu'un jeu sur trois** : les deux autres se jouent debout, hors de l'application. Chacun garde donc ses points personnels, et les équipes s'en déduisent — pas de score collectif saisi à la main, pas de double comptabilité.

**Rejoindre son équipe.** L'inscription se fait en deux écrans : prénom + avatar, puis l'équipe. Le deuxième n'apparaît que si l'animateur a créé des équipes ; sinon on rejoint directement, comme avant. Depuis la salle d'attente, chacun peut encore se corriger tant qu'aucun quiz ne tourne — pendant une partie, c'est refusé : changer d'équipe emporte ses points, ce serait un déménagement de score entre deux questions.

**Le classement d'équipe se fait à la moyenne par membre, pas au total.** Six équipes ne se remplissent jamais à égalité parfaite, et une équipe de neuf battrait mécaniquement une équipe de six. Le total reste affiché en petit — c'est lui qu'on commente à voix haute — mais c'est la moyenne qui classe.

**Le barème des trois jeux.** À la fin, le quiz rapporte à chaque équipe autant de points que son rang le permet : avec six équipes, **6 points à la première, 5 à la deuxième, … 1 à la dernière**. C'est le chiffre en turquoise sur l'écran commun et sur la page souvenir — celui à recopier sur le tableau des trois jeux, où s'ajoutent les résultats des deux jeux physiques. Deux équipes à égalité partagent le même rang et les mêmes points.

**Côté animateur**, le panneau *Invités* regroupe les pastilles par équipe : on repère d'un coup d'œil qui s'est trompé, et un menu déroulant sur la pastille le déplace. On crée une équipe (nom + emoji), on la renomme, on la supprime — **supprimer une équipe n'exclut personne** : ses membres repassent « sans équipe » et gardent leurs points. Le bouton ✨ crée les six équipes par défaut d'un coup, à renommer ensuite.

**Entre deux questions**, l'écran commun annonce qui mène : les équipes d'abord, le top du quiz ensuite — c'est le classement d'équipe qui décide de la soirée. Chaque téléphone montre au même moment son total, son rang, et où en est son équipe.

**Le podium** bascule entre 👥 *Les équipes* (podium collectif + barème à reporter) et 🏆 *Les joueurs* (podium individuel + prix de caractère). Les deux comptent : le classement individuel fait jouer chacun, le classement d'équipe désigne le vainqueur de la soirée.

**Les retardataires entrent en cours de route** : quelqu'un qui arrive pendant un quiz rejoint la partie immédiatement. Il ne récupère rien sur les questions déjà posées, mais il joue toutes les suivantes. S'il arrive pendant une révélation, il est accueilli par un « 👋 Bienvenue » plutôt que par un « ⏰ Trop tard » pour une question qu'il n'a jamais vue.

## Où vivent les données

Deux stockages séparés, et c'est volontaire :

- **La base permanente** est le seul contenu précieux : elle doit survivre à un redéploiement. En local c'est un fichier (`server/data/quizzes.db`) ; en ligne, on pointe `QUIZ_DB_URL` vers une base **Turso** gratuite. Le code est le même — le client libSQL parle aux deux. Elle contient les comptes (mots de passe hachés, jamais en clair), les sessions ouvertes (seule l'empreinte du jeton), les liens d'activation, la bibliothèque de quiz et ses photos, et les soirées archivées.
- **L'état d'une partie** (question en cours, réponses) vit dans une base SQLite locale, jetable, et il est recopié dans la base distante au plus toutes les deux secondes. Après un redémarrage, même sur un disque effacé, la question en cours reprend là où elle en était — au pire, deux secondes de réponses en moins.
- **Les invités et leurs points** sont recopiés dans la base distante au fil de l'eau et rechargés au démarrage si le disque local est reparti vide. Sur un hébergeur gratuit le disque est effacé à chaque redémarrage : sans ce miroir, la soirée repartirait à zéro sans que personne comprenne pourquoi.
- **Les soirées archivées** vivent dans la base permanente, avec la bibliothèque : une ligne par soirée, tout dedans (table `soirees`, clé = espace + identifiant). C'est ce qui reste quand la suivante commence.

Chaque ligne, dans les deux bases, porte l'espace à qui elle appartient. Au premier démarrage après la mise à jour, les lignes d'avant les comptes prennent l'espace de l'administrateur ; cette mise à jour est idempotente et ne copie ni n'efface rien.

## Tester avec de vrais téléphones (à la maison)

1. PC et téléphones sur le **même wifi**.
2. `npm run build && npm start` → tout est servi sur `http://<IP-du-PC>:3001` (l'IP s'affiche au démarrage ; l'écran commun peut rester en `localhost`, le QR code affiche automatiquement l'adresse réseau, suivie du nom de l'espace).
3. **Une fois pour toutes, dans un PowerShell administrateur** (sinon Windows bloque les connexions entrantes) :

```powershell
Set-NetConnectionProfile -NetworkCategory Private
```

```powershell
New-NetFirewallRule -DisplayName "Quizz" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3001,5173
```

Pour simuler des invités sans téléphone (ils répondent au hasard) :

```bash
node server/scripts/fake-player.mjs http://localhost:3001 Test1 300 --slug romane
```

## Mettre en ligne (gratuitement)

📄 **Mode d'emploi pas à pas, sites et commandes compris : [MISE-EN-LIGNE.md](MISE-EN-LIGNE.md).** Ce qui suit en est le résumé.

Objectif : les invités scannent le QR et jouent en 4G, sans réseau à installer sur place. Il faut un hébergeur qui tienne les WebSocket — GitHub Pages, Vercel et Netlify ne conviennent pas.

Deux comptes gratuits à créer (je ne peux pas le faire à ta place) :

**1. Turso — la base permanente.** Crée un compte, puis une base. Récupère son URL (`libsql://…`) et un jeton d'accès. L'offre gratuite (100 bases, 5 Go, 500 millions de lignes lues par mois) est sans commune mesure avec deux quiz de cinquante questions.

**2. Render — le serveur.** Connecte ce dépôt : Render lit `render.yaml` et crée le service. Renseigne ensuite les variables dans son interface :

| Variable | Valeur |
|---|---|
| `ADMIN_LOGIN` | ton identifiant de connexion |
| `ADMIN_PASSWORD` | ton mot de passe d'amorçage — en ligne, le serveur refuse de démarrer avec celui par défaut. Il ne sert qu'à créer le compte : change-le depuis « Mon compte », puis retire la variable |
| `ADMIN_SLUG` | le nom de ton espace dans les adresses (`romane`) |
| `QUIZ_DB_URL` | l'URL `libsql://…` de Turso |
| `QUIZ_DB_TOKEN` | le jeton Turso |

L'adresse publique du QR code se règle toute seule : Render fournit `RENDER_EXTERNAL_URL`, le serveur s'en sert et y ajoute le nom de l'espace.

**3. Transférer les quiz écrits en local**, pour ne pas les ressaisir — une fois le serveur démarré en ligne, puisque c'est lui qui crée ton compte :

```bash
npm run migrate -- --to libsql://ta-base.turso.io --token ton-jeton
```

**4. Empêcher la mise en veille.** C'est la vraie limite de l'offre gratuite de Render : sans trafic entrant pendant 15 minutes, le service s'endort, et le réveil prend environ une minute — le premier invité qui scanne attendrait devant une page blanche. Deux parades, à combiner :

- Un service de ping gratuit (cron-job.org, UptimeRobot…) qui appelle `https://ton-app.onrender.com/healthz` toutes les 10 minutes. Le quota gratuit (750 heures/mois pour un mois qui en compte 730) permet de rester allumé en permanence.
- Ouvrir l'écran commun **cinq minutes avant** l'arrivée des invités. Tant qu'un écran ou un téléphone est connecté, le trafic des websockets empêche la veille.

Si tu préfères un hébergeur qui ne dort jamais, Northflank propose deux services toujours actifs sur son offre gratuite — mais il demande une carte pour vérifier le compte, ce que Render ne fait pas.

## Le repli : tout en local

Si la salle capte mal ou si l'hébergeur fait des siennes, le même code tourne sur ton PC avec un routeur wifi. Renseigne alors `WIFI_SSID`/`WIFI_PASS` : l'écran commun affiche **deux QR codes** (1️⃣ rejoindre le wifi, 2️⃣ ouvrir le quiz).

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | `3001` | Port du serveur |
| `ADMIN_LOGIN` | `antoine` | L'identifiant de l'administrateur — utilisé au premier démarrage seulement, pour créer son compte |
| `ADMIN_PASSWORD` | `romane` | Son mot de passe d'amorçage — obligatoire en ligne (le défaut y est refusé), à changer puis retirer |
| `ADMIN_SLUG` | `romane` | Le nom de son espace dans les adresses |
| `ADMIN_NAME` | `Antoine` | Son prénom, tel qu'affiché |
| `MAX_PLAYERS` | `500` | Plafond d'invités par soirée, au-dessus du réglage de chaque espace (150 par défaut) |
| `DB_PATH` | `server/data/quizz.db` | Base de la partie en cours (jetable) |
| `QUIZ_DB_URL` | fichier voisin de `DB_PATH` | Base permanente : `file:...` ou `libsql://...` (Turso) |
| `QUIZ_DB_TOKEN` | — | Jeton Turso, si base distante |
| `PUBLIC_URL` | `RENDER_EXTERNAL_URL` | URL publique à mettre dans le QR code |
| `WIFI_SSID` / `WIFI_PASS` | — | Si définis : QR « rejoindre le wifi » sur l'écran commun |

## Garde-fous

Le serveur ne fait confiance à rien de ce qui vient d'un téléphone ou d'une page, et personne ne peut le saturer depuis une seule connexion :

- **les comptes** : mots de passe hachés avec scrypt (natif Node), sessions de trente jours glissants dans un cookie `httpOnly` (`Secure` en ligne, `SameSite=Lax`) dont seule l'empreinte est en base ; vingt essais de connexion par adresse puis vingt par minute, et cinq échecs sur un identifiant le ferment un quart d'heure ; un identifiant inconnu coûte le même temps qu'un mot de passe faux ; se déconnecter, changer de mot de passe ou désactiver un compte ferme toutes ses sessions et coupe ses écrans communs ; supprimer un compte (désactivé d'abord, jamais l'espace de l'administrateur) coupe aussi les téléphones de sa soirée et efface tout ce qu'il a laissé, dans les deux bases, le compte en dernier ;
- **les écritures** de l'API exigent un en-tête que seule la page envoie (contre les requêtes forgées depuis un autre site) et, en ligne, l'origine de l'application ; le corps d'une requête n'est lu qu'une fois la session vérifiée ;
- **l'isolation** : l'espace vient de la session ou de l'adresse, jamais d'une charge utile ; une connexion ne suit qu'une soirée ; un identifiant de quiz, de soirée ou de partie qui n'est pas du sien vaut « introuvable » ou « terminée », au niveau du stockage lui-même ;
- cinq présentations refusées coupent la connexion socket ; une connexion ne crée pas plus de trois identités, une adresse pas plus de 25 d'un coup (puis 30 par minute : en 4G, des dizaines d'invités partagent la même adresse chez leur opérateur), et la soirée est complète au plafond réglé par l'animateur ;
- prénoms et avatars sont nettoyés et bornés, les photos vérifiées ;
- en ligne, le temps réel n'accepte que les pages servies par l'application, le JS part compressé avec un an de cache, et les en-têtes de durcissement (CSP, `nosniff`…) sont posés.

L'analyseur d'URL d'Express 4 s'appuie sur `qs`, dont `npm audit` signale deux failles de déni de service : aucune adresse ne lit de paramètre d'URL, et l'application utilise l'analyseur simple de Node — cette bibliothèque n'est jamais appelée.

## Test de charge

```bash
npm run load -- http://localhost:3001 50 --slug romane
```

Le script simule une salle entière : il se connecte comme l'animateur (`ADMIN_LOGIN` / `ADMIN_PASSWORD`), inscrit N invités d'un coup dans son espace, joue lui-même le rôle de l'écran commun et mesure ce qui compte le soir J. Relevé sur un PC portable, 50 invités : inscriptions 141 ms en moyenne (p95 201 ms), diffusion d'une question vers les téléphones 1 ms, révélation 2 ms, 80 Mo de mémoire serveur. À 100 invités, la diffusion reste à 1 ms et les inscriptions montent à 550 ms au pire — l'offre gratuite de Render (512 Mo) a de la marge.

## Identité visuelle

Direction **« Velours »** (choisie le 8 septembre 2026, elle remplace « Salsa nocturne ») : un noir chaud éclairé d'un seul halo, du champagne pour ce qui compte, une serif pour ce qui se lit de loin. Tout est dans `client/src/styles.css`, piloté par une vingtaine de variables en tête de fichier — les couleurs, les deux polices, les rayons.

Trois règles ont guidé les choix, et elles valent pour toute évolution :

- **Le contraste avant la finesse.** L'écran commun est vu de loin sur un vidéoprojecteur, dans le noir. La question est en Cormorant Garamond à 56 px, la bonne réponse se révèle en aplat champagne, le chrono est une ligne fine doublée d'un grand chiffre. Deux couleurs distinctes sur un écran de PC peuvent devenir identiques à cinq mètres.
- **Les polices voyagent avec l'application.** Cormorant Garamond (600, et l'italique 500 pour les sous-titres) et Figtree (fonte variable, 400 à 600) sont livrées en woff2 dans `client/public/fonts` — sous-ensemble latin, 67 Ko en tout, licence OFL jointe — et servies par le serveur. Rien ne part chercher Google à l'exécution : le repli wifi local marche hors ligne, et la politique de sécurité reste à `'self'`.
- **La couleur n'est jamais seule.** Les quatre teintes (rose, champagne, lavande, sauge) ne servent qu'aux formes ▲ ◆ ● ■ des réponses, en SVG ; le texte reste encre. Les icônes d'interface sont des SVG au trait de 1,8 px — plus d'emojis dans l'interface, seuls les avatars et les emojis d'équipe en restent, parce que ce sont les invités qui les choisissent (tous antérieurs à Unicode 13 : Windows 10 n'affiche pas les plus récents). Les animations se coupent si le système demande moins de mouvement.

L'écran commun a deux repères fixes : une bande d'état en haut (le titre de la soirée, quiz en cours, « Question 3 / 8 », combien ont répondu, QR et adresse pour rejoindre) et une **console animateur** en bas, toujours au même endroit — Révéler, Pause, Auto, Terminer, puis le son, le fond clair ou sombre, et le plein écran. L'espace animateur (`/edit`, `/compte`, `/admin`) partage la palette mais reste calme : pas d'animation, c'est un outil de travail, pas un spectacle.

**« Ivoire »** est Velours passé sur papier, pour l'écran commun quand le vidéoprojecteur ne rend pas les noirs : le fond devient crème (`#f9f5ec`), le noir chaud devient l'encre, le champagne s'assombrit (`#ac8536`) pour rester lisible, et les quatre teintes des formes foncent — le losange champagne disparaissait sur la crème. Ce sont les couleurs des fiches imprimées de `jour-j/`, pour que l'écran et les feuilles sur les tables se répondent. Techniquement, c'est un second jeu de variables sous `:root[data-theme='ivoire']` dans la même feuille de style : rien d'autre ne change, ni les tailles, ni les polices, ni la mise en page. Le bouton de la console pose l'attribut sur la page et mémorise le choix (`client/src/theme.ts`) ; il n'est lu que sur `/host`, les téléphones n'en savent rien.

## Architecture

```
client/   React + Vite — les adresses (client/src/routes.ts) : "/" (quelle soirée ?),
          "/<espace>" (téléphone), "/host" (écran commun), "/edit" (mes quiz),
          "/compte", "/admin", "/connexion", "/activer" (le compte),
          "/<espace>/souvenir", "/bilan", "/soirees" (les pages publiques — "/stats" ouvre le
          souvenir sur ses chiffres ; chaque archive se relit par "/<espace>/soirees/<id>/…")
server/   Node + Socket.io + Express — logique de jeu 100% côté serveur
shared/   Types TS partagés (protocole socket, vues du quiz, bibliothèque, barème des équipes, espaces, écart d'horloge)
```

- **AuthStore** (`server/src/auth/store.ts`) + **routes d'auth** (`auth/routes.ts`, `auth/http.ts`) — les comptes, leurs sessions et leurs liens d'activation, dans la base permanente et en mémoire ; la porte de l'API (`requireAccount`), le garde anti-CSRF, la limite d'essais. La suppression d'un compte est une cascade composée dans `server.ts`, là où toutes les réserves sont à portée : connexions, soirée en mémoire, disque local, miroir, historique, bibliothèque, et le compte en dernier.
- **SpaceRuntime / SpaceRegistry** (`core/space.ts`) — la soirée d'un espace : ses registres, son moteur, ses salons socket et ses diffusions (dédoublonnées, regroupées). Créée à la première connexion ; les espaces dont une partie était en cours au démarrage sont réveillés tout de suite.
- **Party** (`server/src/core/party.ts`) — registre des joueurs d'un espace. L'identité survit aux coupures : un token stocké sur le téléphone permet de retrouver son joueur après un refresh, une perte de réseau ou un redémarrage du serveur. C'est ce même token que porte chaque réponse (`player:action`), pour qu'une connexion encore anonyme puisse être rebranchée sur son joueur sans attendre la fin du re-join.
- **ProfileStore** (`server/src/auth/profiles.ts`) + **routes** (`auth/profileRoutes.ts`) — les profils des joueurs récurrents, dans la base permanente. Ils réutilisent le hachage scrypt et le modèle de session des comptes, mais pas leur table : un animateur possède un espace, pas un joueur. Et là où `AuthStore` garde tous ses comptes en mémoire (il y en a une poignée), les profils peuvent se compter par milliers : seules les sessions y montent, un profil s'y range à la première lecture.
- **Progress** (`core/progress.ts`) — ce qu'une soirée rapporte aux profils qui l'ont jouée, dérivé des journaux par une fonction pure, comme le souvenir et le bilan. La consolidation, elle, se fait dans `archiveParty()` : la clé `(profil, soirée)` la rend idempotente.
- **Teams** (`teams.ts`) — registre des équipes, séparé des joueurs : une équipe vit toute la soirée, ses membres vont et viennent. Le rattachement est une colonne sur le joueur, donc déplacer quelqu'un déplace ses points sans toucher au journal des scores.
- **AnswerLog** (`answers.ts`) — une ligne par joueur et par question posée, réponses manquantes comprises. C'est la seule source des statistiques : le classement, lui, ne garde que les gains positifs. Une question annulée ou reposée en sort, pour ne pas compter deux fois.
- **Stats** (`stats.ts`) — les moyennes, les séries et les prix, dérivés du journal. Les prix sont proposés, jamais appliqués : c'est l'animateur qui décide.
- **Review** (`review.ts`) — le bilan question par question, dérivé du journal recroisé avec les questions telles qu'elles ont été posées : la copie du quiz gardée dans chaque partie terminée, sinon la bibliothèque. Servi par `/s/<espace>/bilan.json`, public ; `export.ts` en tire les fichiers de `npm run export`.
- **Recap** (`recap.ts`) — la page souvenir, calculée des journaux par une fonction pure : la soirée en cours et une archive passent par le même chemin.
- **Archive** (`archive.ts`) — l'historique des soirées : une copie complète de la soirée (journaux, quiz joués) rangée dans la base permanente, relue par `/s/<espace>/soirees/:id/recap.json` et `…/bilan.json`. Archiver ne recalcule rien ; relire se fait avec le code du jour.
- **ScoreLedger** (`scores.ts`) — scores en append-only : chaque gain est une ligne (joueur, points, raison). Classement = somme par joueur, historique gratuit.
- **GameEngine** (`engine.ts`) — pilote la partie en cours d'un espace (une seule à la fois par espace) : route actions/commandes/timers vers le module de jeu, persiste l'état après chaque changement et rediffuse les **vues filtrées**.
- **Horloge** (`shared/clock.ts` + `client/src/clock.ts`) — l'écart entre l'horloge d'un écran et celle du serveur, mesuré à chaque connexion par `time:sync` et appliqué par `serverNow()`. Les chronomètres (barre de temps, 3-2-1, enchaînement automatique) ne lisent plus l'heure locale : une horloge de téléphone qui dérive affichait du temps qui n'existait plus, et les réponses envoyées dans ce temps-là étaient perdues.
- **Vues filtrées** — les clients ne reçoivent jamais l'état brut : chaque joueur reçoit `playerView(state, playerId)`, l'écran `hostView(state)`. C'est ce qui empêche la bonne réponse d'arriver dans le téléphone avant la révélation.
- **QuizStore** (`quizStore.ts`) + **API** (`api.ts`) — la bibliothèque de quiz et son API REST, derrière la session, chaque appel dans l'espace du compte connecté. Les photos sont servies par `/media/image/:id`, sans compte : les téléphones doivent pouvoir les charger, et l'identifiant est un UUID impossible à deviner.
- **Module quiz** (`server/src/games/quiz.ts`) — les règles : phases, timers, scoring, vues. Le moteur étant synchrone et la bibliothèque asynchrone, le module garde une **copie en mémoire** des quiz de chaque espace, rafraîchie au démarrage et après chaque édition — jamais pendant une partie.

## Feuille de route

| Lot | Contenu | Statut |
|---|---|---|
| 1 | Nettoyage : application 100 % quiz | ✅ |
| 2 | Bibliothèque en base + éditeur de quiz dans le navigateur | ✅ |
| 3 | Questions « estimation », entrée en cours de quiz, révélations enrichies | ✅ |
| 4 | Habillage show (mode scène, barre de temps, podium animé, sons) | ✅ |
| 5 | Déploiement gratuit (Render + Turso), QR public, test de charge à 50 joueurs | ✅ |
| 6 | Scores à l'abri d'un redémarrage, écran commun qui tient dans la hauteur | ✅ |
| 7 | Commandes d'animation : pause, question reposée, invités gérés | ✅ |
| 8 | Podium de la soirée et page souvenir | ✅ |
| 9 | Import en masse, aperçu, veille des téléphones, prénoms en double | ✅ |
| 10 | Équipes : points individuels, classement collectif, barème des trois jeux | ✅ |
| 11 | Photo « mémoire » et classements annoncés entre deux questions | ✅ |
| 12 | Journal des réponses, statistiques, prix de fin de soirée et écran de victoire | ✅ |
| 13 | Le bilan : ce que chacun a répondu question par question, la relecture collective, les fiches imprimables, l'export CSV | ✅ |
| 14 | L'historique des soirées : archives complètes, relecture des pages d'une soirée passée, sauvegarde avant remise à zéro | ✅ |
| 15 | Les comptes et les espaces : un animateur par compte, ses quiz et ses soirées à lui, un lien d'activation pour chaque ami | ✅ |
| 16 | Les pages publiques reliées par un fil, le tableau des chiffres aux repères figés, la suppression d'un compte | ✅ |
