# Retour de Lucas — 16 ans, iPhone (390 × 844, portrait)

Captures : `/home/user/FiestApp/export/tablee/2026-10-25-22h07/captures/lucas/` (numéros ci-dessous, ex. `001` = `001-musee.png`).

## En une phrase
Un musée propre, lisible et sympa à remplir, mais je n'ai trouvé aucune vraie faille pour tricher (le serveur tient bon), et les jeux que je connais sont presque tous trop faciles : j'ai fini la visite et la plupart des parties à 9 étoiles sur 9.

## Mon parcours
- **Arrivée.** Accueil, « Me connecter », identifiant + mot de passe. Le clavier cachait le bouton « Me connecter » : j'ai fini avec Entrée. Sur l'accueil connecté, « Le Cabinet de curiosités » est dans « Seul », facile à trouver. Je n'ai pas eu besoin de `ouvrir /cabinet`.
- **Le musée.** Un mot de bienvenue avec « Comment ça marche ? » et « C'est parti ». Je ne lis pas : j'ai tapé « C'est parti » (le mot disparaît), puis « La visite du jour » (`001`, `002`). En haut : 4 œuvres sur 84, 0 gardien sur 23, 0 poussière d'or. J'ai compris qu'il fallait jouer les trois parties.
- **La visite du jour** : Réplique, Éclair, Mot mystère. L'annonce dit le jeu, ce qu'on gagne et « Il faut 5 étoiles sur 9 » (`003`). Les cartes-bonus sont lisibles (`004`), j'ai pris Prudence (+1 étoile, une fois par partie) parce que « +1 étoile » parle tout de suite.
  - **La Réplique** : 9 sur 9. Reçu : +18 poussières, le repère (cadre doré), la Citrouille (avatar légendaire, Halloween), +30 XP (`005`, `008`).
  - **Changer de jeu** (une fois par jour) : L'Éclair est devenu Le Détail. Ensuite le bouton disparaît et « Tu as déjà changé un jeu aujourd'hui » s'affiche (`009`).
  - **Le Détail** : 5 sur 9, gagné de justesse, avec le +1 de Prudence (`010`, `011`, `012`, `014`).
  - **Le Mot mystère** : 9 sur 9 en un essai à chaque manche (`015`, `016`).
- **Les salles et les chasses.** Un cadre vide donne un « ? », sa rareté et le jeu où chercher l'œuvre (`017`, `018`). Chasse n°1 au Mot mystère : question sur La Bayadère, aucune idée. J'ai quitté : 1 étoile (Prudence), +4 poussières, œuvre non gagnée (`019`, `020`, `021`). Chasse n°2 aux Indices : gagnée, Pourboire, 9 sur 9, +18 poussières (`033`, `034`).
- **Parties libres.** Éclair 7/9 (`022`, `023`, `024`). Épingle 9/9 (`025`, `026`). Frise 9/9 (`028`). Pari 6/9 (`032`). Filet 9/9 (`035`). Les 5 premières parties libres paient de la poussière. La 6e (lancée et quittée aussitôt) dit clairement « se joue pour le plaisir ».
- **Après.** J'ai doré le cadre de Concentration (100 poussières, avec confirmation, `027`, `029`). Il me reste 32. Je suis à 8 œuvres sur 84, 1 gardien sur 23 (la Citrouille, `030`), niveau 3 (`037`). « Comment ça marche ? » est complet mais long (`031`).

### Mes failles (chacune suivie de `console`)
| Essai | Ce qui s'est passé |
|---|---|
| Toucher deux fois le même bouton (deux commandes d'affilée, ~1 s d'écart) | La 2e touche tombe sur l'écran suivant : à L'Éclair, elle a répondu « Faux » à l'affirmation d'après sans que je la lise. Je ne peux pas faire un vrai double-tap en moins de 200 ms ; je ne peux donc pas dire si l'appli le bloque. Aux Indices, deux « Un indice de plus » rapprochés n'en ont montré qu'un. |
| Toucher une réponse au dernier moment (L'Éclair, manche 2) | Prise en compte, rien d'anormal. |
| `recharger` en pleine manche (Réplique, manche 3) | La partie est conservée et le chrono a continué de courir : à la reprise, il restait 4 s. Mais voir « Bugs » : trouver comment reprendre m'a pris du temps. |
| `retour` en pleine manche (Épingle) | Ouvre « Quitter cette partie ? », chrono en pause. « Continuer » me rend la manche intacte. Bien. |
| Second onglet (`lucas:2 ouvrir /cabinet`) | Le musée y affiche « Ta partie au Mot mystère / au Filet t'attend ». On y reprend **la même manche** (même chrono). Les parties libres sont grisées. Au Filet, j'ai joué la manche dans l'onglet 2, puis tenté de la rejouer dans l'onglet 1 : message « Ce geste est passé : ta partie a continué sans lui », l'onglet 1 s'est resynchronisé (`036`). `console` : un HTTP 409, rien d'autre. Pas de double gain. |
| `reseau coupe` en manche (Pari, manche 1) | Message « Pas de réseau — vérifie ton Wi-Fi ou ta 4G, puis réessaie ». Le chrono continue de courir (côté serveur). Réseau rétabli, j'ai retouché la même réponse et c'est passé. `console` : `POST …/geste net::ERR_INTERNET_DISCONNECTED`. Clair. |
| `veille 40` en manche (Détail, manche 3, 45 s) | À mon retour, la manche était finie : « C'était… » et 0 étoile, sans autre punition (`013`). Normal. |
| Quitter une partie mal partie | « La partie compte avec ses étoiles, et ta chasse est utilisée » (`020`). Voir la gêne n°4 : on peut y gagner une étoile et de la poussière sans jouer. |
| Rejouer une case de la visite déjà faite | Impossible : « Faite » sans bouton. Au bilan d'une partie libre il y a un bouton « Rejouer », qui marche. |
| Dépenser plus que ce que j'ai (acheter à 200 avec 84) | Bouton grisé, « Il te manque 154 poussières d'or » (`018`). Le toucher ne fait rien. |
| Acheter deux fois la même œuvre | Je n'ai jamais eu 200 poussières, je n'ai donc pas pu essayer. Dorer un cadre (100) est possible une fois, puis l'écran passe à « Son cadre est doré » et le bouton disparaît. |

## Ce qui m'a plu
- Le musée est beau et net : fond sombre, or, gros boutons. On comprend vite quoi faire (« Jouer », « Commencer »).
- Les écrans de fin sont très motivants : l'œuvre qui entre dans le musée, son cartel, la poussière, l'XP, la Citrouille qui se réveille (`008`, `014`, `016`).
- La Réplique : je connais les répliques (Gandalf, Thierry Roland), c'est rapide et les « Le savais-tu ? » sont marrants.
- Quand je coupe le réseau, rien ne casse et le message est clair. Quand je joue dans deux onglets, le serveur ne se laisse pas avoir et l'écran se corrige tout seul.
- La carte de France est lisible (7 villes nommées, la Corse, le lieu et mon épingle sur la révélation, `025`, `026`). Le guidage clavier de l'épingle dit « À 150 km au nord-ouest de Lyon » : pratique.
- Le dialogue « Quitter ? » est franc sur ce que ça coûte (`020`).
- Le message « Les cinq parties libres du jour ont payé : celle-ci se joue pour le plaisir » évite de se demander pourquoi la poussière n'arrive plus.
- Les indices du Mot mystère (lettres vertes, jaunes, grises avec symboles) se lisent bien (`019`).

## Ce qui m'a gêné
Du plus grave au plus léger :

1. **Reprendre une partie après avoir rechargé**
   - **Où** : « La visite du jour » (`#visite`), après `recharger` en pleine manche.
   - **Ce que j'attendais** : un bouton « Reprendre » à côté de la partie commencée, ou une manche qui revient seule.
   - **Ce qui s'est passé** : je retombe sur la visite. Le compteur dit « 1 sur 3 faite » alors que ma partie n'est pas finie. La ligne de la Réplique dit « Faite — Commencée », sans bouton. Un texte dit « Ta partie à la Réplique t'attend : reprends-la ou quitte-la d'abord ». Les deux autres « Jouer » sont grisés. Je n'ai rien à toucher. J'ai dû deviner qu'il fallait remonter au musée (où une bannière « Ta partie à la Réplique t'attend — Reprends-la où tu l'as laissée » existe, `007`). Pendant ce temps le chrono courait : il restait 4 s à la manche.
   - **Gravité** : gênant (j'ai perdu des secondes de chrono et le fil). Le même texte « reprends-la ou quitte-la d'abord », sans lien, apparaît aussi en « Jouer librement » quand une partie est commencée.
   - **Captures** : `006`, `007`.
2. **« Revenir au musée » ne ramène pas toujours au musée**
   - **Où** : le bouton en bas des bilans.
   - **Ce que j'attendais** : l'écran « Ton musée ».
   - **Ce qui s'est passé** : la 1re fois, oui. Ensuite je suis arrivé dans la salle de l'Érudit (alors que je venais de gagner une œuvre du Flambeur), puis dans la salle du Devin, puis sur « La visite du jour » (après une chasse et après une partie libre). J'ai dû taper « Le Cabinet » pour retrouver le musée.
   - **Gravité** : gênant (on se croit perdu et la salle n'a rien à voir avec ma partie).
   - **Captures** : `017`.
3. **Les jeux que je connais sont trop faciles**
   - **Où** : Réplique, Mot mystère, Épingle, Frise, Filet, Indices (9 sur 9 chacun, ou presque).
   - **Gravité** : détail pour un joueur peu informé, mais pour moi la tension disparaît (voir plus bas la difficulté jeu par jeu).
4. **Quitter rapporte quelque chose**
   - **Où** : bouton « Quitter », dialogue puis bilan.
   - **Ce qui s'est passé** : avec Prudence, quitter dès la manche 1 donne « 1 étoile : +1 protégée quittée » et, en chasse, +4 poussières (« même ratée »). En partie libre, démarrer puis quitter donne +2 poussières, sur chacune des 5 parties payantes. Ça tient à la règle annoncée (« 4 au moins, même ratée »), mais je gagne de la poussière et une étoile sans répondre. Cela dit, la chasse du jour est brûlée, donc je ne l'abuserais pas.
   - **Gravité** : détail (économie).
   - **Captures** : `021`.
5. **Dialogue « Quitter ? » laissé ouvert**
   - **Où** : en manche, après « Quitter ».
   - **Ce qui s'est passé** : j'ai laissé le dialogue ouvert 35 s. Passé 30 s, le chrono se remet à tourner (96 → 83 puis 69), mais l'écran continue d'afficher « En pause » et la manche cachée. Je ne sais plus si le chrono court.
   - **Gravité** : détail.
   - **Captures** : `020` (le dialogue au début).
6. **Un bouton collé en bas coupe la fin de la révélation**
   - **Où** : révélation du Détail (le « Le savais-tu ? » passe sous « Manche suivante ») et du Pari (« Ta réponse » est coupé).
   - **Gravité** : détail (je ne lis rien, mais le texte caché est le plus utile : ta réponse).
   - **Captures** : `011`, `032`.
7. **Petites incohérences d'affichage**
   - Bilan d'une partie libre : « 14 poussières d'or pour ta partie libre » puis « +14 poussières d'or », la même info deux fois (`024`).
   - Musée en fin de journée : « La visite du jour — Faite : reviens demain, ou pars à la chasse dans une salle » alors que « 0 chasse aujourd'hui » (`037`).
   - Le bloc « Halloween » se vide : au début « Gagne une œuvre, et la Citrouille se réveillera », après la Citrouille il ne reste que le mot « Halloween » dans un cadre (`037`).
   - Au Détail, le nom des tableaux peut être très long (« Les Cosaques zaporogues écrivant une lettre au sultan de Turquie ») : lisible, mais le bouton prend la moitié de l'écran (`010`).
   - Au login, le clavier cache « Me connecter » ; Entrée règle le problème.
8. **La chasse à la question inconnue**
   - Chasse n°1 (Mot mystère, La Bayadère, 6 lettres) : impossible pour moi, personne de mon âge ne connaît ça. Aucun moyen d'abandonner sans perdre la chasse. J'ai quitté après un essai (`019`, `021`). Je n'ai pas vu d'option « une autre question ».
   - **Gravité** : détail.

## Bugs constatés
(ce que **moi** j'ai constaté, indépendamment de Lucas)
- **Compteur « faite » et ligne « Faite — Commencée » alors que la partie n'est pas finie** (gêne n°1).
  - *Pour reproduire* : lancer une partie de la visite (par ex. La Réplique), recharger la page en pleine manche, ouvrir « La visite du jour ».
  - *Attendu* : « 0 sur 3 faite » (ou un état « En cours ») et un bouton « Reprendre ».
  - *Obtenu* : « 1 sur 3 faite », la ligne « Faite — Commencée » sans bouton, les autres « Jouer » grisés, le texte « reprends-la ou quitte-la d'abord » sans aucun lien.
  - *Captures* : `006`, `007`. `console` : rien (seulement les 401 attendus avant la connexion, à 22:08:18).
- **« Revenir au musée » mène à des écrans différents** (gêne n°2).
  - *Pour reproduire* : finir une partie de la visite (Détail, Mot mystère) ou une chasse et toucher « Revenir au musée ».
  - *Attendu* : toujours `/cabinet` (le musée).
  - *Obtenu* : `/cabinet#salle-erudit`, `/cabinet#salle-devin`, `/cabinet#visite` selon les fois.
  - *Capture* : `017`.
- **Chronomètre qui repart sous le dialogue « Quitter ? » avec « En pause » toujours affiché** (gêne n°5).
  - *Pour reproduire* : en manche, toucher « Quitter », attendre plus de 30 s.
  - *Capture* : `020` (début uniquement).
- **Ce qui n'est pas un bug de l'appli mais que j'ai noté** : la lecture de l'écran par `voir` ne m'a donné aucune référence `[ref=…]`. Quand deux boutons s'appellent « Quitter » (celui d'en haut et celui du dialogue), `toucher "Quitter"` visait le mauvais ; j'ai dû passer par `touche Tab` puis `touche Enter`. Un vrai joueur n'est pas concerné.
- **`console`** : seulement les 401 d'avant la connexion, `ERR_INTERNET_DISCONNECTED` quand j'ai coupé le réseau, et un `HTTP 409` quand l'onglet périmé a rejoué un geste. Rien d'inattendu.

## Mes idées
1. Un bouton « Reprendre » directement sur la ligne de la visite (et en « Jouer librement ») quand une partie est commencée, et un compteur qui ne compte « faite » que les parties finies.
2. « Revenir au musée » doit toujours amener sur le musée.
3. Monter la difficulté : des questions où l'on peut se tromper (Réplique, Mot mystère, Indices), une tolérance plus serrée pour l'Épingle (40 km pour trois étoiles ; mon tir « au centre » a fait 63 km sur le puy de Dôme et a quand même rapporté 3 étoiles avec Prudence). Pour quelqu'un qui joue vite et connaît ses sujets, 9 sur 9 sans effort ne donne pas envie de rejouer.
4. Ne rien donner pour une partie quittée sans avoir joué (ni étoile Prudence, ni poussière en partie libre), ou le dire clairement avant.
5. Une chasse ratée sur une question trop pointue devrait pouvoir se relancer une fois, ou la question être choisie dans les thèmes qu'on aime.
6. Retirer le doublon « X poussières d'or pour ta partie libre » / « +X ».
7. Quand les chasses sont épuisées, ne plus écrire « pars à la chasse » sur la visite du jour.
8. Rendre la fin des révélations lisible : laisser de la place au-dessus du bouton fixe.

## Mes notes
- Comprendre ce qu'on fait au Cabinet : 4/5. Visite, œuvre, étoiles, poussière : tout se comprend en quelques touches. J'ai perdu un point avec la reprise de partie et « Revenir au musée ».
- Plaisir de jeu, jeu par jeu :
  - La Réplique : 4/5 — **trop facile** pour moi (9/9) : trois choix pour qui l'a dit, des répliques connues.
  - Le Détail : 3/5 — **juste** : 5 sur 9, il faut reculer d'un pas ou deviner. Bon jeu, mais je ne connais pas la peinture, et le temps (45 s) suffit.
  - Le Mot mystère : 4/5 — **trop facile** sur la visite (1 essai à chaque manche, 120 s) ; **trop dur** sur la chasse (La Bayadère). Le jeu est fun quand je connais.
  - L'Éclair : 4/5 — **juste** : 7/9, le rythme est bon (55 s, 5 affirmations), deux erreurs sur ma culture musicale.
  - L'Épingle : 4/5 — **trop facile** : la carte aide, 40 km pour 3 étoiles, je fais 38 km et 28 km sans effort.
  - La Frise : 3/5 — **trop facile** : le thème « petit écran » est le mien, 9/9 sans erreur.
  - Le Pari : 3/5 — **juste** : 6/9, mon pari raté m'a coûté (1 étoile seulement, grâce à Prudence), mon pari réussi m'a fait plaisir. La règle est claire.
  - Les Indices : 4/5 — **juste** : Gainsbourg avec trois indices et une erreur ; Ada Lovelace en trois indices, par chance ; Tintin dès le premier indice.
  - Le Filet : 3/5 — **trop facile** : tout trouvé du premier coup sur le petit filet (Pokémon, canette, 2+3×4).
- Lisibilité — textes, boutons, couleurs, la carte de France : 4/5. Gros boutons, bon contraste, carte nette. Je retire un point pour les textes coupés sous le bouton fixe (`011`, `032`) et les pages longues (« Comment ça marche ? », `031`).
- Envie de revenir demain : 3/5. La visite du jour est courte, la série de 30 jours et les gardiens donnent un but. Mais je n'ai trouvé aucune faille et presque tout était facile ; sans défi, je reviens surtout pour voir ce que le prochain gardien (le Dragon d'Or) donne.
- Le sentiment de progresser vers quelque chose (le musée, les gardiens) : 3/5. Un gardien réveillé dès la première œuvre (Halloween), c'est motivant. Ensuite : 8 œuvres sur 84 après une douzaine de parties, 200 poussières pour acheter une œuvre quand une partie en rapporte 10 à 18 : la progression est lente, et les salles à 0 sur 8 restent des « ? » (`037`).
