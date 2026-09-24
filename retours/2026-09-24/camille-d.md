# Retour de Camille — 45 ans, téléphone Android

## En une phrase
Une soirée qu'elle a suivie sans effort malgré son daltonisme : partout où ça
compte (bonne/mauvaise réponse, distinction entre les deux Camille), l'appli
parle par formes et par mots, jamais seulement par le rouge et le vert — et
ça, pour une habituée qui redoute justement de ne pas savoir si elle a eu bon,
c'est ce qui rend une soirée agréable plutôt que stressante.

## Mon parcours
Arrivée volontairement après les autres — Nadia et son monde étaient déjà
dans la salle d'attente quand j'ai allumé mon téléphone. J'ai réglé ma vision
en deutéranopie, rejoint « chez nadia » (trois soirées en même temps ce
soir), attendu qu'une autre Camille soit déjà là, puis scanné le QR. À
l'entrée, connexion directe avec mon profil (`camille.d`) : mon prénom et mon
avatar renard sont revenus tout seuls, sans ressaisie. J'ai rejoint les
Randonneurs par défaut — et bonne pioche, l'appli m'a tout de suite montrée
comme « Camille (2) » dans le classement, parce qu'une autre Camille au même
renard jouait déjà dans le salon.

Nadia a lancé le quiz « Spécial Sam » (dix questions sur son frère et un peu
de culture générale) et m'a réassignée aux Arrabbiata en pleine partie en me
désignant à voix haute comme « Camille (2), celle qui a le badge Niv. 1 » —
un peu exposée sur le moment, mais elle ne s'est pas trompée de Camille, et
ça a réglé la question sans que j'aie à intervenir. J'ai joué franc jeu :
juste sur ce que je connais (le mont Blanc, les cordes de guitare, une
estimation de kilomètres marchés), fausse sur ce qui ne concernait que Sam
personnellement (son plat raté, sa ville d'apprentissage des pâtes) — comme
la comptable habituée que je suis, qui ne devine pas la vie privée de
l'hôte. À la question 7, +198 points, bien lancée en 2ᵉ place.

*(Note technique, hors personnage : une panne de l'outil de pilotage, sans
rapport avec FiestApp, m'a coupée une vingtaine de minutes juste après cette
question 7. Les questions 8 à 10, la révélation du podium et la remise des
prix se sont donc jouées sans mon geste — je ne les compte pas comme un
défaut de l'appli, et mon retour ci-dessous n'en tient pas rigueur.)*

À la reprise, la soirée était close : j'ai retrouvé directement l'écran de
fin de soirée (2ᵉ place sur 7, 1098 pts, +43 XP). Je suis allée voir ma page
profil (niveau 1, 43/60 vers le niveau 2, 2 prix) puis j'ai relu le souvenir
de la soirée par curiosité — et j'y ai retrouvé « Camille (2) » partout où
mon nom apparaissait : le podium, le palmarès (« L'Invincible », « Le
Mouton », « Le plus régulier », tous les trois à mon nom), et jusque dans le
grand tableau de statistiques triable. Jamais une confusion avec l'autre
Camille, jamais une couleur à décoder pour m'y retrouver.

## Ce qui m'a plu
- **Les bonnes/mauvaises réponses se lisent sans les couleurs.** Chaque
  option a sa forme fixe (▲ ◆ ● ■), la bonne réponse porte en plus une coche
  ✓ et un fond clair, la mienne quand elle est fausse porte une croix dans un
  cercle — je n'ai à aucun moment eu besoin de distinguer un rouge d'un vert
  pour savoir si j'avais bon. Voir `007-q4-revelation-estimation.png` et le
  détail plus bas.
- **« Camille (2) » est un texte, pas une couleur ni un rang caché.** La
  marque apparaît identique partout : sur mon propre bandeau, sur l'écran
  commun, dans le classement, dans le palmarès, dans le tableau de
  statistiques. Je n'ai jamais eu à deviner laquelle des deux j'étais.
- **Mon profil a été reconnu immédiatement** : identifiant et mot de passe,
  et mon prénom/avatar sont revenus sans que j'aie à les retaper — cohérent
  avec le fait qu'on ne peut pas se rechoisir un avatar une fois profilé.
- **Nadia a pu me distinguer de l'autre Camille à voix haute** en utilisant
  mon niveau affiché, sans que ça tourne à la confusion générale — la
  meilleure preuve que la marque texte fonctionne aussi pour l'animatrice,
  pas seulement pour moi.

## Ce qui m'a gêné
- **Où** : après la fin de soirée, page « Mon profil », bouton retour du
  navigateur.
  **Ce que j'attendais** : revenir à mon écran de fin de soirée (ou au moins
  rester dans « ma » soirée).
  **Ce qui s'est passé** : je suis retombée sur un écran « Content de te
  revoir, Camille — Niveau 1 · 2 badges » avec un bouton « Entrer dans la
  soirée », comme si je n'avais pas encore rejoint — alors que la soirée
  était close et que je l'avais déjà terminée. Je n'ai pas retesté ce bouton
  pour voir s'il m'aurait bien renvoyée à ma fin de soirée (probable, mais
  pas vérifié) : sur le moment, ça m'a fait craindre d'avoir perdu mon
  résultat.
  **Gravité** : détail (j'ai juste rouvert le souvenir par son adresse
  directe pour continuer).
  **Captures** : pas de capture prise sur le coup — le retour texte de
  l'écran donnait : bandeau « Content de te revoir, » + « Camille » + «
  Niveau 1 · 2 badges », boutons « Entrer dans la soirée », « Jouer sous un
  autre prénom ce soir », « Ce n'est pas moi ».
- **Où** : le chronomètre de question, sur tout le quiz.
  **Ce que j'attendais** : vérifier s'il devient illisible pour moi dans ses
  dernières secondes (ma fiche parle d'un « chronomètre qui rougit »).
  **Ce qui s'est passé** : je répondais toujours en 5 à 10 secondes (le
  rythme de jeu me pousse à faire vite), donc je n'ai jamais vu le compte à
  rebours entrer dans sa phase critique — je ne peux ni confirmer ni
  infirmer un souci ici.
  **Gravité** : détail — c'est un point resté sans réponse, pas un problème
  constaté.
  **Captures** : aucune (jamais vu l'état).

## Bugs constatés
Rien de franchement cassé. La seule ligne en console était un `401` sur
`/api/auth/me` avant connexion — attendu, pas une anomalie. Le point « écran
de bienvenue au lieu du souvenir » ci-dessus est une surprise de navigation,
pas une erreur technique visible (pas de trace en console à ce moment-là).

## Mes idées
- Faire en sorte que le bouton « retour » du téléphone, une fois la soirée
  close, ramène à la fin de soirée plutôt qu'à un écran d'entrée « Content de
  te revoir » qui donne l'impression de tout recommencer.
- Garder la carte d'un joueur (celle qu'on ouvre en touchant un nom en salle
  d'attente) accessible aussi depuis le souvenir de la soirée archivée — j'ai
  essayé de toucher mon nom au podium du souvenir par réflexe, rien ne s'est
  ouvert.
- Faire confirmer par quelqu'un qui laisse le chronomètre filer jusqu'au bout
  que sa phase « urgente » ne repose pas que sur une teinte rouge — je n'ai
  pas pu le vérifier moi-même en jouant vite.

## Mes notes
- Entrer dans la soirée : 5/5
- Plaisir de jeu (ou d'animer) : 4/5
- Lisibilité — textes, boutons, couleurs : 4/5
- Envie de revenir, de recommander : 5/5
