# Retour de Hugo — 30 ans, téléphone (lecteur d'écran)

## En une phrase
Une soirée qu'un aveugle peut vraiment jouer — les textes disent toujours qui a
raté, qui a trouvé et ce qu'il fallait répondre — mais elle est semée de
petites icônes muettes et d'un tableau de stats qui, eux, ne parlent qu'aux
yeux.

## Mon parcours
Karim m'avait donné l'adresse ; j'ai attendu que l'écran de Nadia s'allume,
puis je suis entré sans compte, prénom « Hugo », avatar hibou 🦉. Choix
d'équipe (Les Randonneurs), puis Nadia a remélangé les équipes à la main et
m'a basculé chez Les Arrabbiata — un geste de sa part, pas de l'appli, je ne
le compte pour rien.

J'ai joué sept questions au premier rang : deviné au hasard les deux sur Sam
lui-même (l'instrument, le plat raté), su la vraie/fausse sur le refuge, visé
250 km sur une estimation à 420, et retrouvé mes réflexes de culture générale
sur le mont Blanc, les cordes de la guitare et — chance plus que savoir — la
ville des pâtes fraîches. Sur ce tronçon, chaque écran me disait clairement où
j'en étais : la question posée, le temps restant, si j'avais répondu, si
j'avais eu juste.

Une coupure de mon côté (rien à voir avec l'application) m'a ensuite éloigné
un bon moment : j'ai manqué les questions 8 (la tomate), 9 (la photo du
gâteau) et 10 (le surnom de Sam) sans y répondre. Je ne compte pas ça comme
une gêne de l'appli — juste un trou dans ma propre soirée. Je suis revenu au
podium déjà joué : Sofia championne, les Arrabbiata et les Guitaristes ex
æquo après les prix, et moi reparti avec « Le Cancre Magnifique » (deux
mauvaises réponses, dans la bonne humeur — un prix qui fait sourire, pas
grincer). Puis la fin de soirée, le souvenir de la soirée et mon bilan
question par question, pour relire tout ça au calme.

## Ce qui m'a plu
- **Entrer sans compte, sans friction pour moi** : champ « Ton prénom »
  correctement étiqueté, et chaque avatar est un bouton nommé individuellement
  (« Avatar 🦊 », « Avatar 🦉 »…) — TalkBack sait ce qu'il propose, je n'ai pas
  eu à deviner lequel j'avais sous le doigt.
- **Le verdict est toujours écrit en toutes lettres**, jamais laissé à une
  couleur ou une icône seule : « Raté… tu avais dit *La batterie* · La bonne
  réponse : *La guitare* », ou « +198 pts · Bien joué ! ». Même chose dans mon
  bilan : chaque option porte le mot « toi » si je l'ai choisie, et « la bonne
  réponse » si c'est elle. Ça, ça marche pour moi quoi qu'il arrive aux icônes
  à côté.
- **« Réponse enregistrée »** s'affiche après chaque réponse : exactement ce
  que je voulais vérifier à chaque question (est-ce que ça a été pris en
  compte ?).
- **Des titres partout** (`heading` de niveau 1 à 3, sur chaque page et même
  sur chaque question de mon bilan) : je peux sauter de question en question
  sans tout réécouter — c'est ce qui rend un lecteur d'écran vivable sur une
  longue page.
- **Des repères de navigation nommés** (« Pages de la soirée », « Sections du
  bilan ») pour aller direct au souvenir, au bilan ou à la liste des soirées.
- Détail amusant pour un développeur : dans mon bilan, la part de la salle qui
  a choisi une option s'affiche « 67 % » à l'écran, mais l'extrait `voir`
  montre que le nom accessible de cet élément est « 4 réponses » (le chiffre
  brut, pas le pourcentage) — voir l'extrait plus bas. Si c'est voulu, c'est
  même mieux pour moi qu'un pourcentage sans total.

## Ce qui m'a gêné
- **Où** : à peu près tout écran qui commente une réponse ou un classement —
  révélation de question, mon bilan question par question, le souvenir de la
  soirée (podium, palmarès, en-têtes de section).
- **Ce que j'attendais** : que les petites icônes qui accompagnent un texte
  (coche de bonne réponse, pictogramme devant un titre…) soient soit muettes
  pour de vrai (invisibles pour TalkBack), soit nommées.
- **Ce qui s'est passé** : elles apparaissent dans l'arbre d'accessibilité
  comme des images SANS nom — ni ignorées, ni décrites. TalkBack va donc
  annoncer « image » (ou rester muet de façon imprévisible) au milieu d'une
  phrase, sans rien dire d'utile. Exemple, à la révélation de la question 1 :
  ```
  - paragraph [ref=e153]:
    - text: Raté… tu avais dit
    - img [ref=e154]
    - strong [ref=e156]: La batterie
  - paragraph [ref=e157]:
    - text: "La bonne réponse :"
    - img [ref=e158]
    - strong [ref=e160]: La guitare
  ```
  Et dans mon bilan, sur quasiment chaque option de chaque question :
  ```
  - listitem [ref=e140]:
    - generic [ref=e141]:
      - img [ref=e142]
      - generic [ref=e144]: La guitare
      - img [ref=e145]
      - generic [ref=e147]: la bonne réponse
      - generic "4 réponses" [ref=e148]: 67 %
  ```
  Deux images muettes sur une seule ligne de réponse, x4 options x10 questions.
  Le texte qui suit sauve le sens (je sais que c'était la bonne réponse), mais
  ça fait beaucoup de « image » pour rien à traverser.
- **Gravité** : gênant — je n'ai jamais perdu le fil de qui avait gagné ou
  perdu, le texte suffit toujours, mais ça alourdit chaque question et
  chaque écran de bilan.
- **Extraits `voir`** : ci-dessus.

- **Où** : le souvenir de la soirée, section « Toutes les statistiques » (le
  grand tableau, 18 colonnes, un joueur par ligne).
- **Ce que j'attendais** : pouvoir me poser sur une case (par ex. mes
  « Fausses ») et que TalkBack me dise la colonne ET la valeur, comme sur
  n'importe quel vrai tableau.
- **Ce qui s'est passé** : les en-têtes de colonnes sont du texte + un bouton
  de tri, pas des cases d'en-tête (`columnheader`). L'extrait `voir` le montre
  bien — les en-têtes sont des `cell`, pas des `columnheader` :
  ```
  - row "Joueur Points Répondu Justes Fausses Réussite Temps moy. …" [ref=e233]:
    - cell "Joueur" [ref=e234]
    - cell "Points" [ref=e235]:
      - button "Points" [ref=e236] [cursor=pointer]
  ```
  et ma propre ligne se résume à une seule phrase compacte, sans étiquette
  entre les chiffres :
  ```
  - row "🦉 Hugo 905 7/10 4 2 67 % 6,3 s 4,5 s 4 2 3 0 0 1 5 1 (0✓) 60 % 40 % -40 %" [ref=e352]
  ```
  Dix-huit nombres à la file, et il faut compter sur ses doigts pour savoir
  que le 5ᵉ, c'est « Fausses ». Le paragraphe au-dessus dit lui-même que le
  tableau ne rentre pas sur un téléphone et qu'il faut le faire défiler — pour
  moi, le problème n'est pas la largeur, c'est l'absence d'étiquette de
  colonne portée par chaque case.
- **Gravité** : gênant, mais pas bloquant — mon bilan personnel juste en
  dessous raconte les mêmes chiffres en phrases complètes, question par
  question, et celui-là se lit bien. Ce tableau récapitulatif reste
  difficile à explorer par moi-même.
- **Extraits `voir`** : ci-dessus.

- **Où** : la salle d'attente, en pleine partie — au moment où Nadia a
  réorganisé les équipes à la main.
- **Ce que j'attendais** : être informé que mon équipe avait changé, comme un
  changement d'écran normal.
- **Ce qui s'est passé** : le pilote me signale ce changement à part (« Au
  passage, l'écran a affiché : Nadia t'a placé·e dans l'équipe 🌶️ Les
  Arrabbiata ») — ce qui ressemble à un toast temporaire. Je n'ai pas pu
  vérifier avec un vrai TalkBack s'il est annoncé automatiquement (région
  live) ou s'il faut être en train de regarder l'écran au bon moment pour
  l'attraper avant qu'il disparaisse. Si c'est la deuxième option, un joueur
  qui ne voit pas l'écran ne saurait son changement d'équipe qu'en le
  déduisant plus tard des scores.
- **Gravité** : gênant, mais non vérifié avec certitude — à tester
  spécifiquement.

- **Où** : partout où une place ou un rang s'affiche (« 5ᵉ place sur 7 »,
  « 2ᵉ place sur 2 », « 3ᵉ estimation la plus proche sur 6 »).
- **Ce que j'attendais** : que « ᵉ » se lise comme un simple « e » d'ordinal.
- **Ce qui s'est passé** : c'est écrit avec un caractère Unicode « exposant »
  spécial (pas un simple e). Je n'ai pas de vrai TalkBack sous la main pour
  vérifier la prononciation exacte, mais ce genre de caractère spécial est
  connu pour mal passer sur certains lecteurs d'écran (ignoré, ou lu par son
  nom Unicode au lieu du son « e »).
- **Gravité** : détail, à vérifier.

## Bugs constatés
Je n'ai pas ouvert la console cette session (consigne du jour : aller à
l'essentiel), donc rien à en dire côté erreurs JS — aucun plantage ni écran
bloqué observé par ailleurs, tout est resté jouable jusqu'au bout.

Côté accessibilité, deux points sont des bugs de balisage, pas juste un
ressenti de personnage, et se reproduisent partout dans l'app :
1. **Images sans nom accessible** au lieu d'être soit décoratives (masquées
   pour de bon), soit nommées — voir les extraits `voir` ci-dessus (révélation
   de question 1, option de la question 1 de mon bilan). Reproductible sur
   quasiment chaque écran qui a joué : révélations, bilan, souvenir,
   en-têtes de section (« Les équipes », « Le plus beau coup »…).
2. **Le tableau « Toutes les statistiques »** utilise des cases `cell` +
   `button` de tri comme en-têtes de colonnes au lieu de vraies cases d'en-tête
   (`columnheader`/`<th scope="col">`) : voir l'extrait `voir` ci-dessus. Le
   lien entre une valeur et sa colonne se perd pour un lecteur d'écran.

## Mes idées
- **Nommer ou masquer les petites icônes de statut** (coche de bonne réponse,
  pictogrammes de titre de section) : soit `alt=""` combiné à un vrai retrait
  de l'arbre d'accessibilité, soit un nom explicite quand l'icône porte un
  sens que le texte voisin ne répète pas encore. C'est le changement qui
  toucherait le plus d'écrans à la fois.
- **Donner de vraies cases d'en-tête au tableau de stats** (`columnheader`
  plutôt que `cell`), pour que je puisse me poser sur n'importe quelle valeur
  et entendre sa colonne. Le tri au clic peut rester tel quel.
- **Vérifier si le changement d'équipe en cours de partie (et les autres
  toasts) passe par une région live** — sinon, un joueur qui ne regarde pas
  l'écran au bon moment ne le sait jamais.
- **Vérifier la question à photo de mémoire avec un vrai lecteur d'écran** :
  je n'ai pas pu la jouer en direct ce soir (déconnecté à ce moment-là), mais
  une question qui demande de compter un détail sur une photo affichée
  brièvement (« combien de bougies sur le gâteau ? ») n'a, par nature, aucune
  alternative texte ou audio pour quelqu'un qui ne voit pas l'image — à moins
  que l'appli en prévoie une que je n'ai pas vue. Point à vérifier en priorité
  avant de conclure quoi que ce soit, je n'ai pas de preuve directe.
- **Un « e » ordinal en texte normal plutôt qu'en exposant Unicode**, pour ne
  pas dépendre du bon vouloir de chaque moteur de synthèse vocale.

## Mes notes
- Entrer dans la soirée : 5/5
- Plaisir de jeu : 4/5
- Lisibilité — textes, boutons, couleurs : 3/5 (le texte porte toujours le
  sens, mais les icônes muettes et le tableau sans en-têtes fatiguent la
  traversée à l'oreille)
- Envie de revenir, de recommander : 4/5
