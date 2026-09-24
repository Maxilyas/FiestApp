# Retour de Malik — 23 ans, téléphone

## En une phrase
Un mot de passe oublié n'a pas plombé la soirée : le code de secours l'a fait
rentrer en moins d'une minute, sans rater une seule question — même si
l'écran de succès lui a fait douter une seconde avec une vieille erreur
encore affichée dessous.

## Mon parcours
Avant d'arriver, Malik sait déjà qu'il a un souci : son profil `malik` (🐺),
créé le mois dernier à une autre soirée, et son mot de passe qu'il ne
retrouve plus — juste un code de secours noté dans ses notes de téléphone.

**Arrivée** : chez Léa, l'écran commun met un peu de temps à s'allumer (elle
prépare depuis son téléphone) mais le scan finit par passer. Sur l'écran de
connexion (« La crémaillère de la coloc »), il tente `malik2024` : refusé.
Il tente `Malik123` : refusé aussi. Il ne panique pas, va direct sur « J'ai
oublié mon mot de passe ».

**La récupération** : l'écran « Retrouver mon profil » lui pré-remplit déjà
son identifiant — un bon point, une case en moins à remplir. Il tape son
code de secours (`GRWM-K6CN-V4KW-JWJT`) et un nouveau mot de passe. Ça
marche du premier coup : un nouvel écran lui donne un nouveau code de secours
à noter (« il ne sera plus jamais affiché »). Mais juste en dessous de ce
nouveau code, l'alerte rouge « Identifiant ou mot de passe incorrect » de ses
essais précédents est toujours affichée — une seconde de flottement avant de
comprendre que ça avait en fait marché.

**Entrer et jouer** : tout ça s'est joué avant même que Léa lance le quiz —
il choisit l'équipe « Les invités » (il n'habite pas la coloc), mais Léa le
replace elle-même dans « La coloc » à voix haute (« toi tu habites ici »),
avec un petit message à l'écran pour le confirmer. Il chambre Liam, le coloc
irlandais, avant la première question. Le quiz (9 questions, thème
« la coloc ») se joue vite : bon sur l'estimation des cartons du
déménagement et sur le nombre de mouettes d'une photo, raté sur les
questions sciences et sur les histoires internes de la coloc (l'armoire
IKEA, la vaisselle), bon sur la capitale du Canada et sur les Spice Girls —
son terrain, la musique.

**La fin** : 3ᵉ place sur 3 (938 pts, derrière Liam et Zoé), +30 XP. Léa
distribue les prix d'humour : Malik récolte « Le Cancre Magnifique » (quatre
réponses fausses avec le sourire), Liam « L'Invincible ». La soirée se clôt
juste après. Malik va voir sa page profil : sa progression (niveau 1, 30/60
vers le niveau 2), sa fiche du soir, et ses prix.

## Ce qui m'a plu
- Le code de secours a marché du premier coup, et l'identifiant était déjà
  rempli sur l'écran de récupération — un pas de moins à faire quand on est
  déjà agacé d'avoir oublié son mot de passe.
- Toute la manip (deux mots de passe ratés + récupération) s'est faite
  pendant l'attente, avant que Léa lance le quiz : il n'a raté aucune
  question pour ça.
- Le message d'erreur du premier essai était clair et rassurant (« Tu peux
  aussi jouer sans compte, juste en dessous ») — ça dit tout de suite qu'on
  n'est pas coincé.
- La page profil après coup : progression, fiche et prix d'un coup d'œil,
  sans avoir à chercher.
- Le prix « Le Cancre Magnifique » pour ses quatre réponses fausses — bon
  esprit, ça fait rire même en finissant dernier.

## Ce qui m'a gêné
- **Où** : l'écran « Note ce code de secours », juste après avoir validé la
  récupération du profil avec le bon code de secours.
- **Ce que j'attendais** : un écran de succès propre, avec seulement le
  nouveau code de secours et le bouton pour entrer.
- **Ce qui s'est passé** : le nouveau code s'affiche bien, mais l'alerte
  rouge « Identifiant ou mot de passe incorrect » des deux tentatives de
  connexion précédentes est encore affichée juste en dessous — comme si la
  récupération avait échoué alors qu'elle venait de réussir.
- **Gravité** : gênant (une seconde de doute, à relire deux fois pour être
  sûr que c'était bon avant de continuer).
- **Capture** : `captures/malik/004-nouveau-code-secours.png`

## Bugs constatés
- **L'alerte d'erreur de la connexion survit à l'écran de succès de la
  récupération.**
  - **Pour le reproduire** : sur l'écran de connexion d'une soirée, entrer un
    identifiant existant avec un mauvais mot de passe (l'alerte « Identifiant
    ou mot de passe incorrect » s'affiche) → cliquer « J'ai oublié mon mot de
    passe » → entrer un code de secours valide et un nouveau mot de passe →
    valider.
  - **Attendu** : l'écran « Note ce code de secours » (qui suit une
    récupération réussie) ne montre aucune trace de l'erreur de connexion
    précédente.
  - **Obtenu** : le nouveau code de secours et le bouton « C'est noté —
    j'entre » s'affichent bien, mais l'alerte rouge de l'ancien échec de
    connexion reste visible juste en dessous. On dirait que cette alerte
    n'est pas effacée quand on change d'écran, elle appartient à un état
    partagé entre la connexion et la récupération.
  - **Capture** : `captures/malik/004-nouveau-code-secours.png`
  - **Console** : rien signalé au moment de la récupération réussie (les
    deux seules lignes de `console` sont les 401 des deux tentatives de mot
    de passe ratées, normales sur une page où l'on n'est pas connecté) — donc
    un résidu d'affichage côté client, pas une panne côté serveur.

## Mes idées
1. Vider l'alerte d'erreur de la connexion dès qu'on passe à l'écran de
   récupération par code de secours (voir le bug ci-dessus) : simple à
   corriger, et ça évite un doute inutile juste après avoir réussi.
2. Sur l'écran « Retrouver mon profil », le champ vide du code de secours
   affiche l'exemple `XXXX-XXXX-XXXX-XXXX` — presque un vrai code à l'oreille
   pressée. Un style encore plus clairement « exemple » (plus pâle, ou un
   texte du genre « ex. AB12-… ») aiderait quelqu'un qui tape vite entre deux
   blagues.

## Mes notes
- Entrer dans la soirée : 4/5
- Plaisir de jeu (ou d'animer) : 5/5
- Lisibilité — textes, boutons, couleurs : 4/5
- Envie de revenir, de recommander : 5/5
