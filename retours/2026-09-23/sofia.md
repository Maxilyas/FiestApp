# Retour de Sofia — 34 ans, téléphone

## En une phrase
Sofia repart avec un profil, un niveau 2, un prix (« L'Éclair ») et un haut
fait tout neufs — exactement le genre de soirée qui lui donne envie de créer
un compte partout où elle joue, et de revenir aux 41 ans de Sam l'an prochain.

## Mon parcours
Dans le taxi, coup d'œil sur `/` : un écran clair, « Rejoindre une soirée » et
« Créer un profil » bien visibles, rien d'obligatoire. Une fois arrivée,
`scanner` tombe pile sur l'écran déjà allumé de Nadia (« Les 40 ans de Sam »).
Je crée mon profil tout de suite : prénom, avatar (le renard 🦊), puis un
identifiant et un mot de passe — pas d'e-mail à donner, ça me plaît. Un code
de secours s'affiche une seule fois : **FH3P-BNNE-JETM-74FA**, je le note (et
je teste le bouton « Copier », qui marche). Choix d'équipe : je rejoins Les
Carbonara. En salle d'attente, je regarde ma carte (tout à zéro, logique,
c'est ma première fois) et je fais un tour par `/profil` : la barre de
progression (« 0/60 vers le niveau 2 »), les douze médaillons légendaires
verrouillés — j'en touche un, « Le Phénix », et la condition s'affiche en
clair. Les cinq Divins, eux, restent des « ? » total mystère, j'adore.

Le quiz « Spécial Sam » démarre : neuf questions sur l'hôte de la soirée
(son groupe de rock à 15 ans, le sommet des Alpes qu'il rêve de gravir, son
gâteau à mémoriser, sa carbonara, sa marche dans les Pyrénées, ses gnocchis
ratés, Hakuna Matata…). Je connais ma culture générale (Mont Blanc, Oasis,
Le Roi Lion, la pieuvre à trois cœurs) mais pas la vie privée de Sam : je
devine sur les questions « famille ». Sur la question carbonara, j'étais
montée voir l'écran commun pendant la question précédente et je suis
revenue trop tard sur mon téléphone : réponse ratée, « trop tard » — tant
pis, c'est le jeu, il faut suivre le rythme. Je termine 3ᵉ sur 7 avec 1366
points, et je gagne le prix **L'Éclair** (la réponse la plus rapide en
moyenne, 6,9 s) : Nadia l'annonce à voix haute, moment fierté. Puis vient la
remise des prix de toute la soirée (dix prix différents, très généreux), une
égalité parfaite entre les deux équipes, et Nadia clôture : mon téléphone
affiche ma fin de soirée — **+72 points d'expérience, niveau 1 → 2**, et un
haut fait, « La Foudre ». Je vais ensuite tout relire : le souvenir de la
soirée (podium, palmarès complet, tableau de stats), mon bilan personnel
question par question, et mon profil mis à jour (niveau 2, le Tigre Foudre
passé à « 1 sur 10 », mes prix, mes soirées).

## Ce qui m'a plu
- Créer un profil est rapide et rassurant : pas d'e-mail, un code de secours
  affiché une seule fois et copiable, et ça se fait sans quitter le rythme de
  la soirée.
- Les questions personnalisées sur Sam (groupe de rock, gâteau à mémoriser,
  Pyrénées à pied, gnocchis ratés) rendent le quiz vivant, pas générique — on
  sent que c'est SA soirée, pas un quiz de stock.
- La page profil répond exactement à mes questions : combien pour le niveau
  suivant (barre + chiffre exact), comment débloquer un légendaire (je touche
  le médaillon, la condition s'affiche en toutes lettres).
- Les Divins totalement mystérieux (« ? », « inconnu ») donnent une vraie
  envie de revenir sans rien spoiler.
- Le bilan personnel après coup est très riche : ce que j'ai répondu à
  chaque question, ce que mon équipe et toute la salle ont répondu, qui a été
  le plus rapide — parfait pour quelqu'un comme moi qui aime décortiquer sa
  partie.
- Le classement d'équipe à la moyenne par membre est bien expliqué (« une
  petite équipe n'est pas pénalisée »), avec le total qui reste visible à
  côté.
- Les homonymes (deux Camille, même avatar renard) se sont réglés tout seuls
  à l'écran (« Camille (2) ») sans qu'on ait à choisir un autre prénom.

## Ce qui m'a gêné
- **Où** : l'écran de création de profil, juste après avoir tapé mon
  prénom.
  **Ce que j'attendais** : pouvoir enchaîner directement sur « Continuer ».
  **Ce que j'ai vu** : le clavier ouvert cache le bouton « Continuer » (il
  reste seulement les avatars, visibles au-dessus). Ça se résout tout seul
  si on touche un avatar juste après (le clavier se ferme), mais si on garde
  l'avatar par défaut et qu'on cherche « Continuer » les yeux sur l'écran, il
  n'est pas là.
  **Gravité** : détail (contournable, je ne m'en suis même pas rendu compte
  sur le coup).
  **Captures** : `export/tablee/2026-09-23-21h14/captures/sofia/004-creation-profil-clavier.png`
- **Où** : `/profil`, section « Ce soir », alors que j'étais déjà dans la
  soirée de Nadia (j'y étais allée voir ma progression depuis la salle
  d'attente).
  **Ce que j'attendais** : un raccourci pour revenir à « Les 40 ans de Sam ».
  **Ce que j'ai vu** : un bouton générique « Rejoindre une soirée », comme si
  je n'étais dans aucune.
  **Gravité** : détail (j'ai juste fait « Revenir » du navigateur).
  **Captures** : `export/tablee/2026-09-23-21h14/captures/sofia/010-profil-avant-soiree.png`

## Bugs constatés
À quatre reprises sur les neuf questions (Q3, Q4, Q6 et Q9 — pas sur Q1, Q5,
Q7), le geste « toucher ma réponse » a été suivi d'un message comme quoi
l'écran ne montrait pas encore la réponse enregistrée, alors que le contenu
affiché juste après (la même lecture d'écran) montrait déjà « Réponse
enregistrée » avec la bonne option cochée. Pour la Q3, j'ai vérifié avec une
capture d'écran : `export/tablee/2026-09-23-21h14/captures/sofia/017-pause-question3.png`
montre bien « Le Mont Blanc » coché et « Réponse enregistrée » écrit en bas —
tout est correct. `console` ne signale aucune erreur (seulement deux `401`
attendus sur `/api/auth/me`, normal pour un profil de joueur). Aucune réponse
n'a été perdue : mon bilan final liste bien mes 8 vraies réponses (6
justes, 1 fausse, 1 sans réponse). Je n'ai pas d'autre piste que ce battement
d'un instant entre le clic et l'affichage de la confirmation — à surveiller
si ça se reproduit ailleurs que dans mon outil d'observation.

## Mes idées
1. Fêter un peu plus le passage de niveau : c'est LE moment que j'attendais
   toute la soirée (« 1 → 2, Niveau 2 ! »), et il s'affiche avec juste une
   barre de progression statique — un petit effet (confettis, une
   animation) rendrait ce moment aussi mémorable que le podium.
2. Sur `/profil`, quand on a déjà rejoint une soirée ce soir, remplacer le
   bouton générique « Rejoindre une soirée » par un lien direct vers cette
   soirée (avec son nom) plutôt que de faire deviner qu'il faut rescanner ou
   revenir en arrière.
3. Dans le tableau « Toutes les statistiques » du souvenir, une petite
   légende pour les colonnes moins évidentes (« Biais », « Revirements »,
   « Seul ») aiderait une joueuse qui veut vraiment comprendre son chiffre,
   pas juste le lire.

## Mes notes
- Entrer dans la soirée : 4/5
- Plaisir de jeu (ou d'animer) : 5/5
- Lisibilité — textes, boutons, couleurs : 5/5
- Envie de revenir, de recommander : 5/5
