# Retour de Karim — 29 ans, téléphone

## En une phrase
Une soirée sympa mais frustrante : entre le réseau qui lâche, le téléphone qui
s'endort et un rechargement malheureux, j'ai raté la moitié de mes questions —
et pourtant, à aucun moment je n'ai douté de ce qui s'était vraiment passé, le
bilan final m'a tout réexpliqué noir sur blanc.

## Mon parcours
J'arrive volontairement en retard, une fois que l'écran commun affichait déjà
la Question 2 (il a fallu patienter un bon moment que Nadia allume son écran
et lance le quiz — normal, c'est elle qui prépare). Le temps de scanner, de
taper mon prénom, choisir mon avatar (le ballon ⚽, forcément) et mon équipe
(les Randonneurs), la Question 2 s'était déjà fermée : premier écran vu, un
« Trop tard ! » avec la bonne réponse. Pas grave, c'est le jeu quand on
traîne.

Question 3 (Le Mont Blanc) et Question 4 (les bougies du gâteau, de mémoire)
répondues normalement — mal comptées d'ailleurs, j'ai dit 8 bougies, la salle
entière a dit 7, j'étais tout seul dans mon erreur. Sur la Question 5 (les
pieuvres, la science c'est pas mon fort), mon téléphone s'est mis en veille
en pleine question : à mon réveil il ne restait qu'une seconde, j'ai essayé
de taper une réponse quand même, trop tard, la question était déjà passée à
la suivante. Sur la Question 6 (Wonderwall — Oasis, ça je connais), tout
s'est bien passé. Sur la Question 7 (l'estimation des kilomètres marchés par
Sam), pile au moment de répondre, plus de réseau : l'écran me l'a dit
clairement, ma valeur est restée affichée, mais le temps que le réseau
revienne, la question était fermée — réponse jamais partie. Sur la Question
8 (la recette ratée), j'ai rechargé la page parce que ça me semblait figé :
le temps que la page revienne, la question était déjà close aussi. Question
9 (Hakuna Matata — Le Roi Lion), dans mon élément, répondue sans souci.

Résultat : 7ᵉ sur 7, 512 points, avec deux prix inattendus — « Le
Contemplatif » (le plus lent à répondre mais juste) et « L'Abstentionniste »
(le plus de questions sans réponse, 4 sur 8). Fin de soirée simple sur mon
téléphone, puis je suis allé fouiller le souvenir et surtout mon bilan
personnel, question par question, pour comprendre ce que mes problèmes de
réseau m'avaient vraiment coûté.

## Ce qui m'a plu
- Le message pendant la coupure réseau est exactement ce qu'il me fallait :
  « Ta réponse n'est pas partie — vérifie ta connexion », avec mon « 450 »
  toujours affiché dans le champ et le bouton Valider prêt à réessayer. Zéro
  ambiguïté sur l'instant.
- Le bilan personnel (« Relire mon bilan ») rejoue question par question ce
  que j'ai répondu, ce qu'a répondu la salle, ce qu'a répondu mon équipe — et
  pour mes 4 questions ratées, il dit clairement « sans réponse » avec la
  bonne réponse et le pourcentage de la salle qui a trouvé. Exactement la
  réponse à la question que mon personnage se posait : oui, mes points
  perdus ont compté, et je vois où et pourquoi.
- Les prix « Le Contemplatif » et « L'Abstentionniste » : plutôt que de me
  cacher ma mauvaise soirée, l'appli en fait un moment sympa à l'écran commun
  — ça fait passer la pilule.
- Rejoindre sans compte, en trois écrans (prénom, avatar, équipe), sans
  jamais me demander de mot de passe : rapide, même en retard et pressé.
- Aucune bonne réponse ne fuite jamais avant l'heure, même pendant mes
  galères de connexion — que du texte honnête (« Trop tard », « en pause »).

## Ce qui m'a gêné
- **Où** : bilan personnel, question 7 (l'estimation des km de Sam).
  **Ce que j'attendais** : puisque l'écran m'avait dit en direct « ta réponse
  n'est pas partie » (donc il savait que j'avais tapé quelque chose), je
  m'attendais à un résumé du genre « ta réponse n'est pas arrivée à temps ».
  **Ce qui s'est passé** : le bilan dit sobrement « Tu n'as rien proposé »,
  comme si je n'avais même pas essayé.
  **Gravité** : détail — c'est factuellement vrai (le serveur n'a jamais
  reçu mon 450), mais ça efface la tentative que l'appli avait pourtant vue
  passer sur le moment.
  **Captures** : `captures/karim/006-reseau-coupe-avant.png` (le moment où
  ça bloque), `captures/karim/007-reseau-coupe-apres.png`.
- **Où** : réponse à la question 4 (les bougies), au moment de toucher « 8 ».
  **Ce que j'attendais** : une confirmation immédiate que mon choix était
  enregistré.
  **Ce qui s'est passé** : l'outil qui pilote mon téléphone a signalé que
  l'écran ne montrait pas encore la réponse comme enregistrée juste après le
  clic — un instant plus tard, si, elle l'était (voir « Bugs constatés »).
  **Gravité** : détail — pas de perte réelle, juste un flottement d'une
  fraction de seconde qui pourrait donner envie de retaper.
- **Où** : réveil du téléphone en pleine question 5 (les pieuvres), puis
  rechargement en pleine question 8 (la recette).
  **Ce que j'attendais** : voir, en me réveillant ou en rechargeant, un
  écran de révélation clair pour CETTE question avant de passer à la
  suivante.
  **Ce qui s'est passé** : dans les deux cas, le temps que mon geste
  aboutisse, j'étais déjà sur la question suivante — je n'ai jamais vu la
  correction de la 5 ni de la 8 « en direct », seulement plus tard dans le
  bilan. Je note ce point avec prudence : une bonne partie de ce délai vient
  du temps que JE (l'agent qui joue Karim) ai mis à enchaîner mes commandes,
  pas forcément d'une lenteur de l'appli elle-même.
  **Gravité** : détail, à vérifier dans de meilleures conditions de mesure.

## Bugs constatés
- Sur la question 4, en touchant l'option « 8 » : le retour immédiat de
  l'action indiquait *« mais le téléphone ne montre pas ta réponse comme
  enregistrée »*, alors que la lecture d'écran suivante (quelques centaines
  de millisecondes plus tard) affichait bien « Réponse enregistrée · tu peux
  encore changer, au prix du bonus de rapidité ». La réponse a bien été
  comptée au final (elle apparaît comme fausse dans mon bilan, pas comme
  « sans réponse »). Donc pas de perte de donnée, mais un court instant où
  l'interface n'a pas encore affiché la confirmation d'un choix pourtant pris
  en compte. Pas de reproduction fiable trouvée au-delà de cette occurrence.
- Photo de mémorisation de la question 4 (`captures/karim/003-photo-memoire.png`) :
  en haut à droite de l'image du gâteau, un rond plein brun/gris sans forme
  reconnaissable, qui ne ressemble à aucun élément de décor identifiable
  (pas un ballon, pas une bougie). Possible reste d'un élément qui ne
  s'affiche pas correctement. Je n'ai pas pu déterminer si c'est voulu.
- Aucune erreur inattendue en console pendant toute la soirée : uniquement
  des `WebSocket connection ... failed: net::ERR_INTERNET_DISCONNECTED`
  pendant les moments où j'avais moi-même coupé le réseau ou mis le
  téléphone en veille — cohérent, rien d'anormal à signaler là-dessus.

## Mes idées
- Sur le bilan personnel, distinguer « tu n'as rien proposé » (vraiment
  aucune tentative) de « ta réponse n'est pas arrivée à temps » quand
  l'appli sait qu'il y a eu une coupure réseau au moment de la question —
  ça change le ressenti pour quelqu'un comme moi qui a le forfait juste.
- Un petit mot dans le bilan quand une question a été manquée à cause d'un
  rechargement ou d'un réveil d'écran (si l'appli peut le distinguer d'un
  simple oubli) rassurerait sur le fait que ce n'était pas un choix de ne
  pas répondre.

## Mes notes
- Entrer dans la soirée : 4/5
- Plaisir de jeu : 3/5
- Lisibilité — textes, boutons, couleurs : 5/5
- Envie de revenir, de recommander : 4/5
