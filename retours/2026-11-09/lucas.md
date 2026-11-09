# Retour de Lucas — 16 ans, iPhone

## En une phrase
Rapide à rejoindre et fluide, mais je finis 6e/7 à cause d'une estimation avalée et d'une question zappée, et personne ne m'a jamais mis dans une équipe.

## Mon parcours
- Arrivée : scan du QR (la télé a mis un moment à s'allumer), « Jouer sans compte », pseudo énorme `xX_LuCaS_Le_BoSs_Du_QuIz 🔥🔥🔥😎` : coupé net à 24 caractères, sans message. Rejoint direct.
- Attente : salle avec classement (Hugo et moi à 0). J'ai chambré la salle avec `dire`.
- Quiz 1 (10 questions) : QCM faciles, rapides. Tests de triche : changer sa réponse (permis, ça coûte le bonus de rapidité, et ça m'a fait perdre Q1 !), toucher deux fois la même (trop lent, la question était déjà révélée), bouton `retour` du navigateur (rien ne se passe, je reste dans la question), 2e onglet sur l'adresse de la soirée (il me remet dans le même joueur, pas de double jeu).
- Quiz 2 « Spécial Sam » (4 questions) : bien, j'ai été le seul à trouver le GR20.
- Fin : écran de fin, trophée « La Remontada », bilan détaillé.

## Ce qui m'a plu
- Entrée en deux touches, pas de compte.
- Réponse très rapide : le chrono, la rapidité qui compte, « la bonne réponse la plus rapide de la salle » au bilan.
- Le bilan : précision, temps moyen, meilleur temps, moments forts, détail question par question. Je vois que j'ai été le plus rapide 2 fois.
- Changer de réponse est possible et clairement annoncé (« au prix du bonus de rapidité »).
- Impossible de jouer deux fois avec un 2e onglet.

## Ce qui m'a gêné
- **Où** : question 3 du quiz 1 (estimation, poids du ballon). **Attendu** : ma réponse 450 prise en compte (c'était la bonne, 3 autres l'ont eue). **Arrivé** : le pilote a signalé « le téléphone ne montre pas de réponse enregistrée », révélation « Pas de réponse à cette question », bilan « sans réponse ». Points perdus. **Gravité** : gênant à bloquant pour mon classement (à confirmer : bug ou envoi trop tôt). **Captures** : captures/lucas/007-bilan.png.
- **Où** : question 6 (poumons), Nadia a révélé trop tôt, puis a « reposé » la question. **Arrivé** : mon téléphone est resté sur la révélation, la question rejouée n'est jamais arrivée (Camille, Sofia l'ont dit aussi). Annulée. **Gravité** : gênant (le fil, et la salle bloquée plusieurs minutes).
- **Où** : équipes. La télé annonçait Les Randonneurs et Les Pizzaïolos, mais mon téléphone n'a jamais proposé de choisir une équipe : « sans équipe » au bilan, pas de bouton « Changer ». **Gravité** : gênant (je rate une partie du jeu).
- **Où** : pseudo. Tronqué à 24 caractères sans prévenir, le champ montre seulement la fin du texte (« …LuCaS_Le_BoSs_Du_QuIz »). Emoji et fin perdus. **Gravité** : détail. **Captures** : captures/lucas/002-pseudo.png.
- **Où** : le pseudo long est tronqué avec « … » dans le classement et l'en-tête. **Gravité** : détail. **Captures** : captures/lucas/003-salle.png.
- **Où** : écran de fin / bilan. « 13 questions » mais 14 ont été posées, la question annulée n'est pas expliquée ; le bilan par question est une très longue page serrée, petit texte. **Gravité** : détail. **Captures** : captures/lucas/007-bilan.png.
- Le podium du quiz 1 m'a donné « 7e place · 1115 pts » alors que je suis passé 6e à la fin : normal, mais pas de prix pour moi. **Captures** : captures/lucas/005-apres10.png.

## Bugs constatés
- **Estimation non enregistrée (Q3 quiz 1)** : étapes : `repondre 450` à 1,8 s de l'ouverture sur une estimation. Attendu : réponse enregistrée comme aux autres estimations (Q7 et Q3 du quiz 2 ont marché à 2-3 s). Obtenu : « le téléphone ne montre pas de réponse enregistrée », puis « Pas de réponse ». Possible : réponse envoyée trop tôt avant que le champ soit prêt ; à vérifier. Capture : captures/lucas/007-bilan.png.
- **Question reposée jamais reçue** (voir plus haut) : le téléphone reste sur la révélation.
- **Choix d'équipe absent** du téléphone des joueurs sans compte (Hugo, Sofia, moi) alors que la télé affiche des équipes.
- `console` : seulement `[HTTP 401] GET /api/auth/me` (normal hors connexion).

## Mes idées
1. Afficher le choix d'équipe dès l'entrée (ou ne pas annoncer d'équipes sur la télé si le téléphone ne les propose pas).
2. Confirmer clairement qu'une estimation est envoyée, et ne jamais l'avaler.
3. Si une question est reposée, la pousser sur tous les téléphones (ou ne pas l'annoncer).
4. Dire quand le pseudo est coupé, avec un compteur en direct.
5. Un vrai prix « le plus rapide » visible au podium, pas seulement au bilan ; bilan plus court en haut.

## Mes notes
- Entrer dans la soirée : 4/5
- Plaisir de jeu (ou d'animer) : 3/5
- Lisibilité — textes, boutons, couleurs : 4/5
- Envie de revenir, de recommander : 3/5
