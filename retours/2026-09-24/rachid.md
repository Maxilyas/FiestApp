# Retour de Rachid — 35 ans, téléphone (mort à la Q3, puis un second, emprunté)

## En une phrase
Rachid revient dans la partie et finit 3e malgré la panne — mais ses points
d'avant restent bloqués sur un « Rachid » fantôme que ni lui ni l'animateur
n'ont pu ramener dans le sien, et pour un compétiteur ça laisse un goût amer.

## Mon parcours
Arrivée chez Marc sans compte, avatar lion, équipe Commercial — je chambre
tout le monde. Question 1 et 2 ratées (j'accuse Bertrand pour la bassine du
café… c'était moi). Question 3 : pause bière, puis bonne réponse, +186 pts,
2e place. Là, mon téléphone meurt (5 % de batterie). J'emprunte le portable
d'un collègue (`rachid-bis`) : je rescanne, retape « Rachid »… et découvre
que l'avatar lion m'est refusé (« déjà pris par un homonyme »). Je crie à
Marc de m'aider pendant que je remplis le formulaire — le temps de le faire,
la question 4 est passée sans moi. Je repars avec un ballon de foot en
avatar, en pleine question 5, et je termine la soirée 3e avec 491 pts. Au
podium et à la fin de soirée, mon ancien « moi » (186 pts) est toujours là,
séparément, jusque dans le souvenir et mon propre bilan.

## Ce qui m'a plu
- Le comeback fonctionne : je rejoue, je marque, je finis sur le podium
  malgru la panne — l'appli ne m'a pas mis KO pour la soirée.
- Le bilan de mon nouveau « moi » est honnête : « Arrivée en cours de quiz :
  les 4 premières questions ne comptent pas pour toi. » Pas de faux-semblant.
- À la clôture, le jeu sait ce qui s'est passé : mon ancien profil est
  étiqueté « Rachid (tél. HS) » dans les hauts faits, le souvenir et le
  classement — et le haut fait « L'Abstentionniste » (7 questions sans
  réponse) tombe sur le bon des deux, pas sur moi.
- Marc a gardé le rythme et l'ambiance (les blagues sur l'agence, la pause
  bière) — l'animation n'a pas soufferte de ma panne.

## Ce qui m'a gêné

- **Où** : l'écran d'entrée sur le téléphone emprunté (`rachid-bis`), puis
  Marc en pleine partie (`dire`).
  **Ce que j'attendais** : en retapant le même prénom — et en demandant de
  l'aide à l'animateur, comme mon personnage le ferait vraiment — je pensais
  pouvoir récupérer mes 186 points ou au moins mon avatar.
  **Ce qui s'est passé** : l'avatar lion est bloqué (« déjà pris par un
  homonyme »), j'en reprends un autre, et Marc répond en direct : « je ne
  peux pas fusionner tes deux Rachid pendant le quiz : on verra à la fin. »
  Réponse : jamais. Le souvenir final garde deux lignes « Rachid » séparées,
  186 + 491 pts, jamais additionnées nulle part.
  **Gravité** : gênant — j'ai perdu mes points et le fil de mon identité,
  sans aucun recours, ni pour moi ni pour l'animateur.
  **Captures** : `rachid-bis/001-avatar-bloque.png`,
  `rachid-bis/006-tele.png`, `rachid-bis/007-souvenir.png`.

- **Où** : l'écran commun (tele) et la liste des invités, du quiz jusqu'à la
  salle d'attente d'après.
  **Ce que j'attendais** : que la salle sache lequel est le « vrai » Rachid
  du moment.
  **Ce qui s'est passé** : les deux « Rachid » s'affichent à l'identique,
  sans aucun texte pour les distinguer — seul un petit icône avatar diffère
  (lion / ballon), et une minuscule lune (hors ligne) visible seulement côté
  console animateur. Le système de « Camille (2) » ne se déclenche pas ici
  puisque les avatars diffèrent : deux noms strictement identiques cohabitent
  quand même.
  **Gravité** : gênant — confusion possible pour toute la salle, pas
  seulement pour moi.
  **Captures** : `rachid-bis/002-tele.png`, `rachid-bis/004-tele.png`.

- **Où** : le formulaire de retour (scanner → prénom → avatar → équipe) sur
  le téléphone emprunté.
  **Ce que j'attendais** : rentrer vite, la soirée continue sans moi.
  **Ce qui s'est passé** : le temps de repasser par les quatre étapes, la
  question 4 (l'estimation des cafés) s'est refermée sans que j'aie rien pu
  proposer, et je suis arrivé sur la question 5 avec 22 s à peine restantes.
  **Gravité** : gênant — une question entière perdue à cause de la longueur
  du chemin de retour, pas seulement de la panne elle-même.
  **Captures** : `rachid-bis/008-bilan-ancien-rachid.png` (mon ancien bilan
  montre la Q4 « sans réponse »).

## Bugs constatés
Rien de cassé : la console ne montre que des 401 attendus sur
`/api/auth/me` (pas connecté). Le comportement observé (deux fiches
« Rachid » distinctes, jamais fusionnées) semble un choix — sans jeton, un
nouvel appareil ne peut pas prouver qu'il est le même invité — plutôt qu'un
bug. C'est le manque d'un geste de rattrapage, pas une casse.

## Mes idées
1. Donner à l'animateur un geste « fusionner ces deux invités » utilisable
   **pendant** le quiz, pas seulement constaté après coup — Marc l'a demandé
   lui-même en direct.
2. Sur l'écran commun et la liste des invités, écrire un mot quand deux noms
   identiques cohabitent avec des avatars différents (« reconnecté » /
   « parti ») plutôt que de laisser deviner à la petite lune.
3. À l'écran d'entrée, quand le prénom tapé correspond à un invité de la
   soirée en cours qui vient de se déconnecter, proposer « C'est moi, je
   reviens » au lieu de le traiter d'emblée comme un homonyme.

## Mes notes
- Entrer dans la soirée : 3/5
- Plaisir de jeu : 4/5
- Lisibilité — textes, boutons, couleurs : 4/5
- Envie de revenir, de recommander : 4/5
