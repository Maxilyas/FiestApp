# Retour de Hugo — 30 ans, téléphone Android (TalkBack)

## En une phrase
Une vraie bonne soirée entre amis, bien racontée à la voix par l'animatrice —
mais mon téléphone, lui, ne m'a jamais dit une seule fois quelle était la
bonne réponse : ni pendant le jeu, ni en relisant mon bilan le lendemain.

## Mon parcours
Karim m'a filé l'adresse et a scanné le QR pour moi ; l'écran de connexion
était déjà allumé. Je suis entré sans compte, prénom « Hugo », équipe Les
Carbonara. La salle d'attente annonçait clairement mon nom, mes 0 points et
mon équipe.

Le quiz « Spécial Sam » a commencé : 9 questions. J'ai répondu vite à chaque
fois (rock de Sam au pif, carbonara raté par manque de temps, Mont Blanc de
mémoire, pieuvre à trois cœurs juste, Wonderwall = Oasis juste, distance des
Pyrénées au pif, gnocchis au pif, Hakuna Matata = Roi Lion juste). Sur la
question 4 — une photo à mémoriser — je n'ai rien pu faire du tout : pas de
photo, pas de bouton qui réagisse à temps, donc pas de réponse envoyée.

À la fin : 6ᵉ sur 7, 1004 points, mon équipe gagne l'égalité parfaite avec les
Randonneurs (Nadia l'a annoncé à voix haute, prix par prix — sympa d'entendre
tout ça sans avoir besoin de l'écran). J'ai relu mon « Souvenir » et mon
« Bilan » ensuite : très détaillés, mais avec le même trou partout — la bonne
réponse d'un QCM n'est jamais écrite en toutes lettres.

## Ce qui m'a plu
- Les pages ont de vrais titres qui s'enchaînent bien (h1 la soirée, h2 les
  sections, h3 chaque question) : je peux sauter de section en section avec
  mon lecteur, sans tout parcourir au fil du texte.
- Les boutons annoncent leur état : « Me connecter » désactivé tant que les
  champs sont vides, « Rejoindre la soirée » désactivé tant qu'aucune équipe
  n'est choisie, l'avatar et l'équipe choisis marqués `[pressed]`. C'est
  exactement ce qu'un lecteur d'écran doit annoncer.
- Les émojis décoratifs des avatars n'écrasent pas le nom du bouton (« Avatar
  🦊 » reste lisible, pas juste un émoji tout seul).
- La question d'estimation (les km de Sam dans les Pyrénées) était nickel :
  champ « Ton estimation », bouton « Corriger », confirmation « Ta réponse :
  800 km · tu peux encore la corriger ». Et dans le bilan, la bonne valeur
  est écrite noir sur blanc : « La bonne valeur 412 km ». C'est exactement ce
  qu'il faudrait pour les QCM aussi (voir plus bas).
- Le palmarès de fin de soirée (l'Éclair, le Contemplatif, le Sans-Faute…) se
  lit comme des phrases complètes : « 🦊 Sofia — 6,9 s de moyenne sur 6 bonnes
  réponses ». Rien à deviner.
- Le grand tableau de statistiques (17 colonnes) est un vrai tableau HTML,
  avec des en-têtes de colonnes cliquables et nommés : mon lecteur peut
  annoncer « Points, 1004 » colonne par colonne. Du beau travail.
- Nadia a raconté toute la remise des prix à voix haute : dans une vraie
  salle, ça me serait arrivé aux oreilles même sans regarder l'écran commun.

## Ce qui m'a gêné

- **Où** : le Souvenir et le Bilan de la soirée, sur *chaque* question à
  choix (QCM et vrai/faux) — question 1, 2, 3, 4, 5, 6, 8, 9.
  **Ce que j'attendais** : pouvoir savoir, en lisant l'écran, quelle réponse
  était la bonne — c'est la première chose que je vérifie à une révélation.
  **Ce qui s'est passé** : rien dans le texte ne le dit. Le seul indice est
  une icône sans nom, ajoutée uniquement à côté de la bonne option — que mon
  lecteur ne peut pas annoncer. Extrait de `voir` sur la question 1 (« Les
  Spaghettis Électriques » est la bonne réponse, je n'avais pas trouvé) :
  ```
  - generic [ref=e128]:
      - img [ref=e130]
      - generic [ref=e132]: Les Spaghettis Électriques
      - img [ref=e133]              <- une deuxième icône, sans nom, ici seulement
      - generic "1 réponse" [ref=e135]: 17 %
  - generic [ref=e141]:              <- une réponse fausse : une seule icône
      - img [ref=e143]
      - generic [ref=e145]: Rando Rock
      - generic "0 réponse" [ref=e146]: 0 %
  ```
  Comparez avec la question 7 (estimation), qui fait ça très bien : « La
  bonne valeur : 412 km » est écrit en toutes lettres. Rien n'empêche
  d'écrire pareil pour un QCM (par exemple nommer cette deuxième icône
  « Bonne réponse », ou l'écrire dans le texte de l'option).
  **Gravité** : bloquant — pour ce point précis, je n'ai trouvé aucun moyen,
  nulle part (ni pendant le jeu, ni le lendemain dans le Bilan), de connaître
  la bonne réponse d'un QCM par la lecture seule. Sur un quiz, c'est
  l'information la plus importante de toutes.

- **Où** : question 4, « Vous avez bien regardé le gâteau de Sam ? Combien de
  bougies ? » — une photo affichée seule quelques secondes.
  **Ce que j'attendais** : au moins une chance de deviner, ou de comprendre
  pourquoi je ne peux pas.
  **Ce qui s'est passé** : la photo n'a évidemment aucun sens pour moi — et
  même en essayant de répondre au pif, mon geste a été refusé : « Ce bouton
  est grisé : il ne réagit pas pour l'instant. » Le temps de comprendre, la
  question était fermée ; je n'ai envoyé aucune réponse. Mon bilan confirme :
  « Q4 · 45 s · photo mémoire » → « sans réponse ».
  **Gravité** : bloquant, pour cette question précise — un format « regardez
  bien l'écran » est par nature injouable sans les yeux, et je n'ai même pas
  pu tenter ma chance.

- **Où** : Souvenir de la soirée, section « Le podium ».
  **Ce que j'attendais** : entendre les joueurs dans l'ordre de leur rang
  (1er, puis 2e, puis 3e), comme partout ailleurs dans l'appli.
  **Ce qui s'est passé** : l'ordre de lecture est 2e, puis 1er, puis 3e (mise
  en forme « marches d'escalier », sans doute jolie à l'œil) :
  ```
  - generic: "2" · 👑 · Lucas · "1501"
  - generic: "1" · 🦊 · Camille · "1611"
  - generic: "3" · 🦊 · Sofia · "1366"
  ```
  En entendant « 2, Lucas, 1501 » avant « 1, Camille, 1611 », j'ai d'abord cru
  Lucas en tête. Le même écran juste après la question 9 (avant d'aller au
  Souvenir), lui, était bien dans l'ordre 1-2-3. Détail amusant : les deux
  nombres bruts « 2 » et « 1501 » ne disent pas lequel est le rang et lequel
  est le score — il faut deviner par déduction.
  **Gravité** : gênant — je finis par comprendre, mais à retardement.

- **Où** : un peu partout où il y a un classement (salle d'attente, équipes,
  podium, « reste du classement ») : des chiffres seuls, sans mot à côté.
  Exemple, dans la salle d'attente :
  ```
  - button "La carte de Hugo": "1" · 🐯 · Hugo · "0"
  ```
  **Ce que j'attendais** : quelque chose comme « rang 1, Hugo, 0 points ».
  **Ce qui s'est passé** : juste des nombres nus, à interpréter par leur
  position. Ailleurs sur la même page, un chiffre EST bien étiqueté (« Points
  de classement du quiz — les prix s'y ajoutent »), donc la technique existe
  déjà dans l'appli, juste pas partout.
  **Gravité** : gênant, léger, mais récurrent sur toute l'application.

- **Où** : question 3, pendant une pause de l'animatrice (« Sam, pose ce
  verre, c'est une question sur TOI ! »).
  **Ce que j'attendais** : que mon lecteur me dise que la question est en
  pause, si je n'ai pas entendu la remarque de Nadia.
  **Ce qui s'est passé** : ma tentative de réponse a été purement et
  simplement refusée (« La question est en pause : les réponses sont
  bloquées »), sans que je puisse vérifier si un état « désactivé » est
  annoncé au bon moment — je n'ai pas réussi à revoir l'écran pile pendant la
  pause pour en être sûr.
  **Gravité** : détail — je n'ai que la moitié de l'information, à vérifier.

- **Où** : l'entrée de la soirée, juste après avoir tapé mon prénom.
  **Ce que j'attendais** : un bouton qui garde son nom.
  **Ce qui s'est passé** : le bouton s'appelait « Rejoindre la soirée » avec
  le clavier ouvert, puis « Continuer » une fois le clavier fermé — sans que
  je touche rien d'autre entre les deux (sans doute le temps que l'appli
  apprenne que les équipes étaient activées pour cette soirée).
  **Gravité** : détail.

## Bugs constatés
Ce que j'ai vu, moi (indépendamment de mon personnage), en dehors de la
console (`console` n'a jamais rien signalé d'anormal — seulement deux 401
attendus sur `/api/auth/me`, normal sans compte) :

- **La bonne réponse d'un QCM/vrai-faux n'a nulle part d'équivalent texte.**
  Pour reproduire : jouer n'importe quel QCM, puis ouvrir le Souvenir ou le
  Bilan de la soirée et lire la liste des options avec un lecteur d'écran (ou
  l'outil `voir` du pilote). Attendu : la bonne option est identifiable au
  texte. Obtenu : seule une deuxième balise `<img>` sans nom accessible est
  ajoutée à côté de la bonne option (voir extraits ci-dessus, questions 1 à
  9, présent dans les deux onglets « Mon bilan » et « La soirée »). Ça
  contraste avec les questions d'estimation, qui écrivent « La bonne valeur :
  412 km » en toutes lettres.

- **Réponse envoyée mais confirmation en retard.** Sur 7 QCM/vrai-faux
  répondus, 4 fois (questions 3, 6, 8, 9) l'outil a signalé immédiatement
  après l'appui : « ⚠ … mais le téléphone ne montre pas ta réponse comme
  enregistrée », avant que la lecture suivante affiche bien « Réponse
  enregistrée ». Aucune erreur console associée, et l'état final est
  toujours correct — mais l'instant de l'appui, rien ne confirme
  l'enregistrement. Je n'ai pas les moyens de savoir si ça vient du réseau de
  test ou de l'application.

- **Question 4 : bouton de réponse durablement grisé, question ratée sans
  recours.** Pour reproduire : arriver sur une question de type « photo
  mémoire » et essayer de répondre. Obtenu : « Ce bouton est grisé : il ne
  réagit pas pour l'instant » ; en retentant juste après, la question était
  déjà fermée (passage direct à la question 5). Je n'ai pas pu déterminer la
  durée exacte du verrouillage, seulement qu'il a suffi à me faire rater
  toute la fenêtre de réponse.

- **Ordre de lecture du podium inversé (2e, 1er, 3e) dans le Souvenir**,
  alors que le podium affiché juste après un quiz (sur le téléphone, avant
  d'aller au Souvenir) est bien dans l'ordre 1er, 2e, 3e. Deux composants
  visiblement différents pour la « même » information, un seul est dans le
  bon ordre pour un lecteur d'écran.

## Mes idées
- **Écrire la bonne réponse en texte sur les QCM et vrai/faux**, dans le
  Souvenir et le Bilan (et pourquoi pas à la révélation en direct) — soit en
  nommant l'icône de validation (« Bonne réponse »), soit en reprenant la
  formule déjà utilisée pour les estimations (« La bonne réponse : … »).
  C'est de loin ce qui me manquerait le plus si je rejouais.
- **Donner au podium du Souvenir le même ordre de lecture que celui de fin de
  quiz** (1er, 2e, 3e), quitte à garder l'affichage visuel en marches
  d'escalier — l'ordre du DOM et l'ordre visuel n'ont pas besoin d'être liés.
- **Étiqueter les chiffres de classement** (rang, points) au moins par un nom
  accessible, comme c'est déjà fait pour le petit chiffre cerclé des équipes
  (« Points de classement du quiz — les prix s'y ajoutent ») : la recette
  existe déjà dans l'appli, il ne manque que de la généraliser.
- **Pour les questions « regardez la photo »**, je ne sais pas s'il existe
  une vraie solution accessible (le jeu repose sur l'image elle-même) — mais
  au minimum, annoncer clairement que « cette question est visuelle, tu ne
  pourras pas y répondre » éviterait de se cogner sur un bouton grisé sans
  comprendre pourquoi.

## Mes notes
- Entrer dans la soirée : 4/5
- Plaisir de jeu (ou d'animer) : 3/5
- Lisibilité — textes, boutons, couleurs : 3/5
- Envie de revenir, de recommander : 4/5
