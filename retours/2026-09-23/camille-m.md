# Retour de Camille — 27 ans, téléphone

## En une phrase
Une soirée fluide et généreuse en détails, qui a réglé le casse-tête des deux
Camille avec beaucoup d'élégance — juste un clavier qui cache le bouton
« Rejoindre » au tout premier écran, et une petite hésitation visuelle après
chaque réponse à choix.

## Mon parcours
Je suis dans la cuisine chez Nadia, pas devant la télé : elle m'a juste
envoyé « La soirée c'est chez Nadia, rejoins-nous sur FiestApp ! ». J'attends
que son écran s'allume (ça prend un moment, comme toujours avant que
l'animatrice soit prête), puis j'ouvre l'accueil de l'appli. Je clique
« Rejoindre une soirée » et je tape ce que je devine du message de Nadia :
« chez-nadia ». La page m'affiche tout de suite l'adresse complète en
dessous — je sais que j'ai bon avant même de valider, rassurant.

J'arrive sur la page de la soirée « Les 40 ans de Sam », je choisis
« Jouer sans compte », mon prénom Camille, et mon renard 🦊 porte-bonheur —
il était libre. Nadia a préparé des équipes ; je demande à voix haute où est
Sofia, elle me répond « chez les Carbonara », je la rejoins. En salle
d'attente, Nadia réorganise les équipes en direct, puis lâche la vraie
surprise : on est DEUX Camille ce soir, et on a toutes les deux un renard !

Le quiz « Spécial Sam » démarre : 9 questions sur les souvenirs de Sam, la
cuisine, la nature, la musique, une photo-piège (le gâteau, compter les
bougies), une estimation à la louche (les km marchés dans les Pyrénées). Je
réponds vite pendant que le chrono tourne, je regarde la révélation à la
télé entre deux. Je m'en sors très bien : sans-faute sur les 8 questions à
choix, 1611 points, 1ère sur 7 au classement de la soirée.

Le podium est annoncé à la voix par Nadia (j'ai gagné !), puis vient une
remise des prix pleine de bonne humeur — j'en récolte plusieurs (Sans-Faute,
Invincible, Mouton, Sauveur). Résultat final entre équipes : égalité
parfaite, 4 partout. Nadia clôture la soirée : mon téléphone affiche mes
exploits du soir, puis j'ouvre le Souvenir pour le partager dans le groupe
WhatsApp, et mon Bilan personnel très détaillé, où je trouve enfin un lien à
copier.

## Ce qui m'a plu
- Deviner l'adresse de la soirée marche du premier coup, et surtout le champ
  affiche tout de suite l'adresse complète en aperçu
  (`localhost:46545/chez-nadia`) : je sais que j'ai bien tapé avant même de
  valider.
- Les deux « Camille » sont limpides partout où je regarde : sur la télé, sur
  mon téléphone, dans le Souvenir et le Bilan — toujours « Camille » (moi,
  mise en valeur) et « Camille (2) » pour l'autre, jamais mélangées, même en
  ayant toutes les deux un renard.
- La remise des prix est un chouette moment, drôle et valorisant même pour
  qui ne gagne pas (« Le Cancre Magnifique — un prix, pas une punition »).
- Le Bilan personnel très détaillé (question par question, ce que la salle et
  mon équipe ont répondu) et son bouton « Copier le lien de ce bilan » :
  exactement ce qu'il me faut pour l'envoyer au groupe sans faire une capture
  d'écran.
- Pouvoir demander à voix haute dans quelle équipe est une copine, et avoir
  une vraie réponse tout de suite : ça fait vraiment soirée entre amis.

## Ce qui m'a gêné
- **Où** : l'écran « Quelle soirée ? » de l'accueil, juste après avoir tapé
  le nom de la soirée.
  **Ce que j'attendais** : voir le bouton « Rejoindre la soirée » dès que je
  finis de taper.
  **Ce qui s'est passé** : le clavier ouvert cachait tout le bas de l'écran,
  bouton compris — j'ai dû fermer le clavier moi-même pour le voir et le
  toucher.
  **Gravité** : gênant (quelques secondes perdues, un petit moment de
  flottement pour une invitée qui ne connaît pas encore l'appli).
  **Captures** : `export/tablee/2026-09-23-21h14/captures/camille-m/001-accueil-nom-soiree.png`

- **Où** : les questions à choix (2, 3, 4, 6, 8, 9), juste après avoir touché
  une réponse.
  **Ce que j'attendais** : voir ma réponse cochée tout de suite.
  **Ce qui s'est passé** : au moment précis du clic, rien ne semblait encore
  coché (mon appareil a même signalé « le téléphone ne montre pas ta réponse
  comme enregistrée ») ; une capture prise juste après confirme que la coche
  et « Réponse enregistrée » finissent par s'afficher. Sur la question à
  estimation (taper un nombre), ce souci n'est jamais arrivé.
  **Gravité** : détail pour moi qui ne recontrôle pas — mais de quoi taper
  deux fois par angoisse si on doute d'avoir cliqué, chrono qui tourne.
  **Captures** : `export/tablee/2026-09-23-21h14/captures/camille-m/005-question2-apres-reponse.png`
  (la coche est bien là une fois affichée)

- **Où** : juste après la 9ᵉ et dernière question du quiz.
  **Ce que j'attendais** : voir le podium du quiz s'afficher sur mon
  téléphone, comme pour les autres écrans qui comptent.
  **Ce qui s'est passé** : le temps que je lève les yeux vers l'écran commun,
  mon téléphone et la télé étaient déjà passés au classement général de la
  soirée / à la salle d'attente — je n'ai vu le podium du quiz que raconté à
  la voix par Nadia, jamais affiché sous mes yeux.
  **Gravité** : détail (peut venir de ma propre lenteur à regarder, pas
  forcément un vrai souci de l'appli).
  **Captures** : `export/tablee/2026-09-23-21h14/captures/camille-m/014-tele.png`

## Bugs constatés
Décalage d'affichage après avoir touché une réponse à choix multiple (jamais
vu à l'estimation) : à l'instant du clic, l'écran ne montre pas encore la
sélection comme enregistrée ; un rafraîchissement quelques instants après
montre bien la coche et le texte « Réponse enregistrée ». Reproduit sur 5
questions à choix sur 6 (question 1 : bon du premier coup ; questions 2, 3,
4, 6, 8, 9 : le même avertissement à chaque fois). Rien d'anormal dans
`console` au même moment — seulement des 401 attendus sur `/api/auth/me`
avant connexion. La réponse n'est jamais perdue au final, c'est un aller-retour
visuel qui traîne une ou deux secondes.
- Pour reproduire : ouvrir une question à choix (pas une estimation),
  toucher une réponse, regarder l'écran dans l'instant qui suit.
- Attendu : la réponse choisie apparaît cochée immédiatement.
- Obtenu : un bref instant sans coche visible, avant qu'elle apparaisse.
- Captures : `export/tablee/2026-09-23-21h14/captures/camille-m/005-question2-apres-reponse.png`,
  `export/tablee/2026-09-23-21h14/captures/camille-m/008-question3-pause.png`

## Mes idées
- Rendre la coche de sélection immédiate sur les questions à choix (sans
  dépendre d'un aller-retour serveur perceptible), pour que je sache tout de
  suite que mon tap a compté — surtout en fin de chrono.
- Sur petit écran, faire remonter le formulaire (ou garder le bouton
  d'action visible) quand le clavier s'ouvre, au lieu de me laisser fermer le
  clavier moi-même avant de pouvoir valider.
- Un bouton « Copier le lien » directement sur l'écran de Fin de soirée et
  sur le Souvenir, comme sur le Bilan : j'ai dû aller jusqu'au Bilan pour
  trouver de quoi partager dans le groupe.

## Mes notes
- Entrer dans la soirée : 4/5
- Plaisir de jeu : 5/5
- Lisibilité — textes, boutons, couleurs : 5/5
- Envie de revenir, de recommander : 5/5
