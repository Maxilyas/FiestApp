# Retour de Jeanne — 71 ans, petit téléphone Android (texte à 130 %)

## En une phrase
Une soirée agréable, lisible et pas trop compliquée une fois entrée ; mais le choix d'équipe que Nadia réclamait ne m'est jamais apparu, et je ne sais pas comment retrouver mes points demain pour les montrer à ma sœur.

## Mon parcours
- Avant : l'écran de Nadia a mis longtemps à s'allumer ; scanner relancé plusieurs fois.
- Arrivée : trois gros boutons. J'ai cherché « juste mon prénom » et trouvé « Jouer sans compte » : j'ai compris. Prénom tapé, avatar panda déjà choisi, « Rejoindre la soirée ».
- Attente : classement à 0 point et « En attente du prochain quiz… ». Nadia parlait d'équipes : je n'ai rien vu sur mon téléphone.
- Jeu : 10 questions faciles puis « Spécial Sam » (4 questions). Mes réponses ont été prises (le téléphone dit « Réponse enregistrée »). La question 6 (poumons) n'a pas été comptée.
- Fin : 4e sur 7, 1809 points, deux trophées, « Mon bilan », « Plus > Revoir la soirée ».

## Ce qui m'a plu
- Entrée très simple, gros boutons, texte lisible malgré le zoom.
- Le retour immédiat après chaque réponse : « +200 pts · Bien joué ! », la bonne réponse écrite.
- Le « Le saviez-vous ? » (Salzbourg) : c'est très instituteur, j'aime.
- La fin de soirée et le bilan : clairs, chaleureux, trophées amusants.
- Nadia qui parle à voix haute et répond aux problèmes.

## Ce qui m'a gêné
- **Où** : salle d'attente et podium du quiz 1, choix d'équipe.
  **Attendu** : le bouton « Changer » / « Les équipes » dont parlait Nadia. **Arrivé** : rien pour moi (Hugo et Sofia disent pareil) ; je suis restée « sans équipe ». Après la révélation 1, une carte « Les équipes » existait pourtant plus bas : on ne voit pas qu'on peut en rejoindre une.
  **Gravité** : gênant. **Captures** : captures/jeanne/003-salle.png, 004-revelation1.png, 005-equipes.png
- **Où** : question 6 (poumons). Ma réponse « 2 poumons » n'a pas été comptée : « Pas de réponse à cette question », et la « bonne réponse » s'affiche juste comme « 2 », sans le mot. Le téléphone de Camille est resté bloqué sur la réponse précédente.
  **Gravité** : gênant. **Captures** : 006-rev6.png
- **Où** : fin de soirée. « Un profil… commence à la prochaine : celle-ci ne s'y ajoute pas. » Je voulais retrouver mes points demain pour ma sœur ; je ne sais pas si le lien du bilan reste valable sans profil, et « Créer mon profil » m'effraie. « Plus » (petit, replié) cache « Revoir la soirée ».
  **Gravité** : gênant. **Captures** : 007-fin.png, 009-bilan.png, 010-plus.png
- **Où** : clavier ouvert sur l'écran d'entrée : il ne reste visible que le champ prénom et les 4 premiers avatars ; le bouton « Rejoindre » est caché, à trouver en fermant le clavier. **Gravité** : détail. **Capture** : 002-clavier.png
- **Où** : noms longs (« xX_LuCaS_L… ») coupés dans le classement ; mots comme « profil », « avatar », « palmarès », « Coup d'œil » peu parlants. **Gravité** : détail.
- Je n'ai pas pensé à photographier le podium du quiz 1 (l'enchaînement est rapide, la deuxième série démarre seule).

## Bugs constatés
- Question 6 reposée par Nadia : la question n'est pas revenue sur les téléphones, ma réponse n'a pas été enregistrée ; à la révélation, « Pas de réponse » alors que j'avais répondu avant (`repondre 3`). Points annulés par Nadia. Console : seulement un 401 sur `/api/auth/me` (normal hors connexion).
- Équipes : le choix d'équipe ne s'affiche pas sur les téléphones de plusieurs joueurs sans profil (Hugo, Sofia, moi), alors que la télé affiche deux équipes.

## Mes idées
1. Un choix d'équipe visible dès la salle d'attente, avec un gros bouton et des mots simples.
2. Garder un lien « Retrouver ma soirée » en haut de la fin de soirée, et dire clairement s'il marche demain sans profil (ou le proposer à envoyer par message).
3. Écrire la bonne réponse en toutes lettres à la révélation d'un QCM (« 2 poumons »), pas seulement un numéro.
4. Sortir « Plus / Revoir la soirée » de son repli.
5. Mots plus simples (« profil », « palmarès »).

## Mes notes
- Entrer dans la soirée : 4/5
- Plaisir de jeu : 4/5
- Lisibilité — textes, boutons, couleurs : 4/5
- Envie de revenir, de recommander : 4/5
