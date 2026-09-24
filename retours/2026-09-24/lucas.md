# Retour de Lucas — 16 ans, iPhone

## En une phrase
J'ai essayé de faire planter le truc pendant toute la soirée et j'ai rien
trouvé à redire côté technique — mais j'ai fini 3ᵉ et le seul prix que j'ai
gagné se moque de moi, donc bon.

## Mon parcours
Arrivée : j'ai scanné le QR (une fois relancé parce que l'écran commun
n'était pas encore allumé — logique, l'animatrice avait pas encore lancé), et
direct « Jouer sans compte ». J'ai tapé un pseudo bien chargé
(`xX_LuCaS_Le_BoSs_Du_QuIz_Xx 🔥🔥🔥😎`) pour voir ce qu'elle en faisait :
coupé à 24 caractères, propre, sans bout d'emoji cassé. J'ai gardé l'avatar
taco par défaut (j'avais pas envie de chercher), pris la première équipe
(Les Guitaristes) et rejoint direct.

Le quiz « Spécial Sam » a démarré vite. J'ai testé mes trucs dès la
question 1 : changer de réponse plusieurs fois, retoucher la même — rien n'a
buggé, juste enregistré à chaque fois. Sur la question 2, pause surprise
(sonnette à la porte, l'animatrice a mis sur pause) — le chrono a repris
exactement où il s'était arrêté, ça au moins c'est du solide. J'ai testé le
bouton retour du navigateur en pleine question : ça m'a demandé si je
voulais vraiment quitter, en me disant que je garderais mes points si je
revenais. Sur la question 5, j'ai ouvert la soirée dans un deuxième onglet
pour voir si je pouvais voter deux fois : nan, les deux onglets montrent
exactement la même réponse en direct, et changer sur l'un change l'autre —
pas de triche possible.

À la question 3, j'ai été le plus rapide de la question (5,2 s) et l'écran
commun l'a affiché en gros — ça, c'était satisfaisant. J'ai enchaîné assez
bien jusqu'à la question 7 (bon sur 1, 3, 5, 6, 7 ; loupé la 2 ; à peu près
sur l'estimation de la 4).

Ensuite j'ai eu un blanc — un souci de mon côté, rien à voir avec
l'application, j'ai décroché une vingtaine de minutes et j'ai raté les
questions 8 à 10 sans rien pouvoir y faire. Quand j'ai regardé à nouveau, le
quiz était fini : podium direct, 3ᵉ place, 965 pts, derrière Sofia et
Camille (2). À la clôture, l'animatrice a annoncé les prix : L'Éclair (le
plus rapide) est allé à Jeanne, pas à moi — ça m'a piqué. Et le prix qu'elle
m'a donné, « Le Doigt qui Tremble », c'est pour mes 4 changements d'avis de
dernière seconde pendant le quiz — exactement mes tests. J'ai été un peu
grillé devant tout le monde (« le boss du quiz hésite, on dirait ! »). En
allant voir le souvenir de la soirée, j'ai même découvert un deuxième prix à
mon nom, « Le Contemplatif » : mon temps de réponse moyen était de 15,8 s,
le plus lent de tous les joueurs — alors que j'ai tapé vite à chaque fois,
c'est mes changements d'avis qui ont plombé ma moyenne. Ironique. Mon équipe,
elle, a rattrapé les Arrabbiata grâce aux prix et fini ex æquo première —
ça, c'est une consolation.

## Ce qui m'a plu
- Le badge « LUCAS — 5,36 s » affiché en gros sur l'écran commun quand j'ai
  été le plus rapide de la question 3 : exactement le genre de truc qui me
  donne envie de continuer.
- Le chronomètre qui reprend pile où il s'était arrêté après la pause de
  l'animatrice — pas une seconde perdue ni volée.
- Le bouton retour qui protège : au lieu de me faire sortir bêtement, il
  demande, et rassure qu'on retrouve sa place et ses points.
- Le tableau de stats du souvenir, très détaillé (temps moyen, revirements,
  série, coup d'œil…) : je peux aller vérifier exactement pourquoi j'ai eu
  chaque prix, chiffre par chiffre. Ça donne envie de rejouer pour corriger.
- Les équipes rééquilibrées en direct par l'animatrice sans que ça casse
  rien pour moi.

## Ce qui m'a gêné
- **Où** : le classement final / les prix, à la clôture.
  **Ce que j'attendais** : être signalé comme rapide (j'ai été 1er sur au
  moins une question).
  **Ce qui s'est passé** : le prix de vitesse est allé à quelqu'un d'autre,
  et moi j'ai eu deux prix qui se moquent de mon indécision.
  **Gravité** : détail — c'est même plutôt malin de la part de
  l'application (elle a bien vu ce que je faisais), mais pour mon personnage
  ça reste une petite déception.
  **Captures** : `006-fin-de-soiree.png` (le classement final sur mon
  téléphone).
- **Où** : question 2, en pause pour la sonnette.
  **Ce que j'attendais** : continuer à jouer.
  **Ce qui s'est passé** : attente sans rien à faire, le temps de la pause.
  **Gravité** : détail — c'est un choix de l'animatrice, pas un défaut de
  l'appli, mais ça casse le rythme quand on veut aller vite.
- **Où** : le champ pseudo, à l'entrée.
  **Ce que j'attendais** : garder mon pseudo complet avec les flammes.
  **Ce qui s'est passé** : coupé à 24 caractères, sans les emojis.
  **Gravité** : détail — c'est probablement voulu (les pseudos trop longs
  ça doit être moche partout), mais un ado à qui on coupe son swag, ça le
  déçoit.

## Bugs constatés
Aucun. J'ai spécifiquement cherché la faille toute la soirée : changer de
réponse plusieurs fois de suite, toucher deux fois le même bouton, faire
« retour » navigateur en pleine question, ouvrir un deuxième onglet avec les
mêmes cookies pour essayer de voter deux fois sur la même question. Chaque
fois, l'application a réagi proprement : dernière réponse retenue, dialogue
de confirmation avant de quitter, les deux onglets parfaitement synchronisés
sans double vote possible. La console ne montre qu'un 401 normal sur
`/api/auth/me` (pas connecté), rien d'anormal.

## Mes idées
1. Un indicateur pendant le quiz (pas seulement au récap final) qui dit où
   on se situe sur la vitesse par rapport aux autres, pas juste sur une
   question isolée — pour donner un vrai objectif à poursuivre en direct,
   pas juste après coup.
2. Sur le champ pseudo, prévenir de la limite de caractères avant de taper
   (ou pendant), pas seulement une fois qu'on a dépassé — pour ceux qui
   comme moi tapent vite sans regarder.
3. Pendant une pause décidée par l'animatrice, un petit mot sur l'écran du
   téléphone («l'animatrice a mis sur pause ») aiderait à comprendre que ce
   n'est pas un blocage — je l'ai vu en tapant `texte`, mais un personnage
   qui ne relit pas activement l'écran pourrait croire à un plantage.

## Mes notes
- Entrer dans la soirée : 5/5
- Plaisir de jeu (ou d'animer) : 4/5
- Lisibilité — textes, boutons, couleurs : 5/5
- Envie de revenir, de recommander : 4/5
