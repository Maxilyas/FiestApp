# Retour de Karim — 29 ans, téléphone Android (412 × 915)

## En une phrase
Arrivé en retard, je suis entré sans me prendre la tête et j'ai rattrapé le train en marche ; les coupures de réseau et de veille m'ont fait perdre des points sans que l'écran me dise clairement quoi.

## Mon parcours
- Avant : j'ai attendu que la télé affiche la question 2 (très long, plus de 25 min), puis scanné le QR.
- Arrivée : écran d'accueil (Jouer sans compte / Me connecter / Créer un profil), prénom, avatar (un chat déjà coché), choix d'équipe (j'ai pris les Pizzaïolos), « Rejoindre la soirée ». J'atterris sur la Q2 en pause (« En pause, le chrono reprendra où il s'est arrêté », boutons grisés).
- Veille (`veille 20`) : à mon réveil, la Q2 était finie, j'étais sur la Q3 (estimation, ballon de foot : 450 g, pile-poil, +200).
- Réseau coupé sur la Q4 : j'ai touché « L'extinction », la carte est passée en pointillés, « Envoi… » en bas, bandeau rouge « Connexion perdue — reconnexion… ». Réseau rétabli : « +190 pts, Bien joué », mais aussi un message « Trop tard — la question était finie ». La réponse était bien comptée (12,0 s).
- Rechargement : raté sur la Q6 (j'ai laissé passer la question, c'est ma lenteur) ; refait sur la Q7 : je retrouve la même question, le chrono juste, aucune perte.
- Fin du quiz 1 : 6e, 1220 pts. Quiz 2 « Spécial Sam » : 515 pts, 2e du quiz. Fin de soirée : 5e sur 7, 1735 pts, trophée « Le Contemplatif ». Bilan lu en entier.

## Ce qui m'a plu
- Entrer sans compte : trois touches, rien à installer.
- La Q2 en pause à mon arrivée : je ne suis pas jeté dans un chrono qui court.
- Le bilan : « Arrivée en cours de quiz : les 2 premières questions ne comptent pas pour toi » répond à ma question sur les points perdus.
- Le rechargement en pleine question est indolore.
- La révélation (rang, écart avec le suivant, « Le saviez-vous ? », qui a été le plus rapide) et le bilan détaillé question par question.
- Nadia qui me souhaite la bienvenue en direct.

## Ce qui m'a gêné
- **Où** : Q4, réponse envoyée réseau coupé, puis retour du réseau.
  **Ce que j'attendais** : savoir clairement si ma réponse était partie. **Ce qui s'est passé** : pendant la coupure, seul un « Envoi… » discret (bas de l'écran) et un trait en pointillés disent que ça n'est pas parti ; au retour, +190 pts (bien comptée) mais une alerte « Trop tard — la question était finie » contradictoire. Je ne sais pas si j'ai réussi ou raté. **Gravité** : gênant. **Captures** : captures/karim/006-reseau-coupe.png, 007-reseau-retabli.png
- **Où** : après une veille de 20 s. **Attendu** : un mot du genre « tu as manqué la question 2 ». **Obtenu** : je me retrouve sur la Q3, sans explication ; la Q2 a disparu (0 point, silencieusement). **Gravité** : gênant. **Captures** : 003-avant-veille.png, 004-apres-veille.png
- **Où** : fin de la Q6 (poumons) et rejouée par Nadia. Les téléphones (le mien, Camille, Sofia) sont restés sur la révélation, la question « reposée » n'est jamais arrivée ; Nadia a dû annuler. **Gravité** : gênant (pour la salle). **Captures** : 009-apres-recharge.png
- **Où** : révélation de la Q6, « La bonne réponse : 2 » alors que les choix étaient 0 / 1 / 2 / 3 : on ne sait pas si c'est le choix n°2 ou la valeur 2. **Gravité** : détail. Même écran : « Personne n'a trouvé 0/1 » et seule Nadia listée.
- **Où** : fin de soirée. « Le Contemplatif, 3,6 s de réflexion » alors que j'ai été le plus rapide de la salle deux fois : le trophée me va mal. **Gravité** : détail. **Captures** : 012-fin.png
- **Où** : fin de soirée, « Créer mon profil » : « celle-ci ne s'y ajoute pas ». Dommage de ne pas pouvoir garder mon trophée. **Gravité** : détail.
- **Où** : choix d'équipe, deux équipes inégales en nombre (« avec Nadia », « avec Camille ») et « Un quiz a commencé : choisis ton équipe, ou entre sans » : clair, rien à redire sauf que je ne savais pas ce que « entre sans » me faisait perdre. **Gravité** : détail.

## Bugs constatés
- **Contradiction au retour du réseau (Q4)** : étapes : `reseau coupe`, toucher une réponse, `reseau retabli`. Attendu : soit « réponse enregistrée », soit « trop tard ». Obtenu : +190 pts ET alerte « Trop tard — la question était finie ». Console : `WebSocket connection to 'ws://localhost:45887/socket.io/...' failed: net::ERR_INTERNET_DISCONNECTED` (attendu hors ligne). Captures : 006, 007.
- **Question rejouée non reçue** (vu via la salle) : la question reposée par l'animatrice n'est pas arrivée sur les téléphones restés sur la révélation, pour au moins 3 joueurs. Je n'ai pas pu le reproduire côté invité autrement qu'en le constatant.
- **Veille** : 3 erreurs WebSocket en console au réveil (ERR_INTERNET_DISCONNECTED), reconnexion silencieuse. Pas de message visible.
- Pas testé : une réponse donnée juste avant un rechargement (j'ai rechargé avant de répondre).

## Mes idées
1. Au retour du réseau, un seul message net : « Ta réponse est bien arrivée » ou « Elle n'est pas passée », jamais les deux ; et une indication de l'état d'envoi plus visible que « Envoi… » en bas.
2. Après une veille ou une coupure, dire ce qu'on a manqué (« Tu as raté la question 2 »).
3. Garantir que la question reposée arrive aussi aux téléphones restés sur la révélation.
4. À la révélation d'une question à choix numériques, écrire la bonne réponse comme le choix (« 3 : 2 »).
5. Pour les retardataires, une attente de la télé plus courte ou un message d'accueil « tu arrives en route, les questions déjà passées ne comptent pas » dès l'entrée (il n'apparaît que dans le bilan).
6. Revoir la règle du « Contemplatif » quand on est aussi le plus rapide.

## Mes notes
- Entrer dans la soirée : 4/5
- Plaisir de jeu (ou d'animer) : 4/5
- Lisibilité — textes, boutons, couleurs : 4/5
- Envie de revenir, de recommander : 4/5
