# Retour de Zoé — 23 ans, téléphone Android

## En une phrase
Une soirée chaleureuse et personnalisée (le quiz parlait d'elle et de ses
colocs), jouée sans la moindre gêne visuelle malgré ses migraines et son
téléphone couché à l'horizontale — juste un tableau de stats et un accueil
qui manquent un peu de soin pour un petit écran.

## Mon parcours
Avant de rejoindre, j'allume mon téléphone et j'active tout de suite
« réduire les animations » : mes migraines ophtalmiques ne pardonnent pas.
Chez Léa, l'écran commun n'était pas encore allumé — elle préparait son quiz
depuis son propre téléphone — j'ai donc relancé le scan plusieurs fois en
attendant, sans y voir de souci : ce n'est pas l'appli qui est en cause, et
un autre invité, moins patient que moi, s'est plaint à voix haute que
« l'écran est noir ». Une fois le QR affiché, l'entrée sans compte a été
rapide : mon prénom, un avatar guitare 🎸, et j'étais en salle d'attente,
sobre, avec Liam. Léa a formé les équipes à la volée : je me suis retrouvée
avec Malik contre Liam et Inès.

Le quiz (9 questions) était très personnalisé — des questions sur la coloc
elle-même (le déménagement, l'armoire IKEA, qui fait la vaisselle). J'ai
raté mes deux premières réponses « perso » — j'ai même dit que c'était moi
qui faisais le plus la vaisselle, alors que c'était Léa ! — mais j'ai
cartonné sur la suite : la question-photo à mémoriser (une plage, 3
mouettes, pile juste), les sciences, la culture générale, la musique. À la
moitié du quiz, j'ai posé mon téléphone sur l'accoudoir, à l'horizontale :
l'affichage est resté centré et confortable, rien n'a débordé ni ne s'est
étiré bizarrement.

J'ai fini 2ᵉ sur 3, à seulement 7 points de Liam — suspense jusqu'au bout.
Léa a annoncé les prix à voix haute pendant que la soirée se clôturait, puis
mon téléphone a affiché ma fin de soirée, nette et lisible même en paysage.
Je suis allée voir le souvenir : une page dense mais bien construite en
cartes, où j'ai découvert que j'avais gagné le prix « Le Pessimiste » — je
sous-estime tout, systématiquement. Plutôt juste, vu ma réponse sur les
cartons du déménagement.

## Ce qui m'a plu
- La typographie serif dorée sur fond très sombre, cohérente de l'entrée
  jusqu'au souvenir — chic, sobre, ça fait « vraie petite fête ».
- Aucune animation agressive nulle part : ni confettis, ni transition
  brusque à la révélation, au podium ou à la fin de soirée. Avec mon
  réglage activé, je n'ai eu aucune gêne oculaire de la soirée.
- Le passage en paysage à la moitié du quiz ne casse rien : le contenu
  reste centré, à une largeur de lecture confortable, sans s'étirer bord à
  bord de l'écran.
- Le quiz « sur mesure », avec des questions sur la coloc elle-même — fun,
  personnel, le genre de détail qui rend une soirée mémorable.
- Le souvenir de la soirée : beaucoup de contenu, mais rangé en cartes
  claires, avec des prix bien trouvés (« Le Pessimiste » me correspondait
  vraiment).
- Le petit détail typographique du prénom en écriture cursive sur l'écran
  de choix d'avatar.

## Ce qui m'a gêné
- **Où** : le souvenir de la soirée, le tableau « Toutes les statistiques ».
  **Ce que j'attendais** : pouvoir lire mes propres chiffres (coup d'œil,
  écart d'estimation, biais…) sans manipulation.
  **Ce qui s'est passé** : le tableau a 18 colonnes et ne tient pas sur un
  téléphone ; il faut le faire défiler horizontalement pour voir les
  dernières colonnes, et l'appli le dit elle-même dans son texte d'aide.
  **Gravité** : gênant — rien de bloquant, mais en graphiste j'aurais aimé
  un empilement en fiches ou des colonnes figées plutôt qu'un défilement.
  **Capture** : `/home/user/FiestApp/export/tablee/2026-09-24-trois-salons/captures/zoe/011-souvenir.png`
  (le bloc « Toutes les statistiques », en bas).
- **Où** : l'écran de fin de soirée.
  **Ce que j'attendais** : que l'action la plus pertinente juste après une
  clôture (revoir la soirée) soit la plus visible.
  **Ce qui s'est passé** : « Rejoindre la soirée suivante » est en bouton
  plein doré, le plus voyant, alors qu'il n'y a rien à rejoindre dans
  l'instant ; « Revoir la soirée » n'a qu'un contour.
  **Gravité** : détail.
  **Capture** : `/home/user/FiestApp/export/tablee/2026-09-24-trois-salons/captures/zoe/010-fin-soiree.png`
- **Où** : l'écran d'entrée et la salle d'attente, en portrait.
  **Ce que j'attendais** : une mise en page qui occupe l'écran.
  **Ce qui s'est passé** : beaucoup de vide sous les cartes — tout est
  tassé en haut d'un écran de téléphone qui est pourtant grand.
  **Gravité** : détail, purement esthétique.
  **Captures** : `/home/user/FiestApp/export/tablee/2026-09-24-trois-salons/captures/zoe/001-entree.png`,
  `/home/user/FiestApp/export/tablee/2026-09-24-trois-salons/captures/zoe/003-attente.png`

## Bugs constatés
Aucun bug technique rencontré. `console` n'a signalé qu'un 401 attendu sur
`/api/auth/me` avant connexion — normal pour un invité sans compte. Le jeu
des 9 questions, la bascule portrait → paysage et la lecture du souvenir se
sont comportés normalement de bout en bout.

Par honnêteté : je n'ai capturé aucun écran de *question active* (avec ses
boutons de réponse) une fois en paysage — seulement les écrans de
révélation. Je ne peux donc pas garantir à 100 % qu'aucun bouton ne réclame
de défiler pendant une question active en paysage ; je peux seulement dire
que répondre ne m'a posé aucune difficulté (5 à 11 s par réponse, sans
accroc) sur les quatre questions jouées après avoir tourné le téléphone.

## Mes idées
1. Sur le souvenir, remplacer le tableau à 18 colonnes par des fiches
   empilées (ou au moins figer les premières colonnes) pour un petit écran
   — l'appli sait déjà qu'il ne tient pas, ce serait bien d'en tirer la
   conséquence plutôt que de prévenir.
2. Sur la fin de soirée, inverser la mise en avant : « Revoir la soirée »
   en bouton plein, « Rejoindre la soirée suivante » en contour (ou masqué
   tant qu'aucune soirée n'est ouverte) — c'est l'action qu'on a vraiment
   envie de faire juste après une clôture.
3. Un mot d'attente pendant que l'écran commun n'est pas encore allumé
   (« l'animatrice prépare encore son quiz ») aiderait les invités qui
   arrivent trop tôt — ce soir, un autre joueur a cru l'appli en panne.

## Mes notes
- Entrer dans la soirée : 4/5
- Plaisir de jeu : 5/5
- Lisibilité — textes, boutons, couleurs : 4/5
- Envie de revenir, de recommander : 5/5
