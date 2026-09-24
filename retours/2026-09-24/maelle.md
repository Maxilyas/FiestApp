# Retour de Maëlle — 24 ans, iPhone

## En une phrase
Une entrée compliquée sans le QR lui a coûté deux questions avant même de
jouer, mais la soirée a quand même pensé à elle jusqu'au bout — jusqu'au
petit prix de consolation retrouvé dans le train.

## Mon parcours
J'arrive après tout le monde et je m'assois au fond, derrière un pilier :
impossible de voir le QR sur l'écran commun. Je demande le lien dans le chat
("Marc, tu peux mettre le lien dans le Slack ?") mais personne ne me répond —
Marc est pris par les équipes et les blagues des collègues, et ça dure de
longues minutes. Je me débrouille seule depuis l'accueil : je devine le nom
de la soirée, je tape « marc », ça échoue (« Cette adresse ne mène à aucune
soirée »), et pendant ce temps le quiz démarre sans moi — les deux premières
questions sont passées avant que j'aie pu m'inscrire. Je corrige avec
« chez-marc », et là ça marche. Je choisis de jouer sans compte, avec un
pseudo — Fantomette — et un renard en avatar : pas question que mon vrai
prénom s'affiche en grand devant la direction si je finis dernière. Je
rejoins l'équipe Tech, vide : je serai seule dedans. J'arrive en pleine
question 3, en pause (Bertrand est parti chercher les bières) ; ça reprend,
je réponds vite, et c'est juste. Question 4, une estimation sur les cafés de
l'agence, je réponds aussi. Puis, comme prévu, je range mon téléphone pour
filer à mon train, sans rien fermer. Les six questions suivantes défilent
sans moi. Plus tard, dans le train, je rouvre l'appli : la soirée est close,
et mon écran m'attend avec mon classement (4ᵉ place sur 5, 292 pts) et un
petit clin d'œil, « Le Somnambule », pour avoir décroché en route. Je vais
fouiller le souvenir de la soirée et mon bilan personnel : tout y est,
question par question, avec une phrase qui répond exactement à ce que je me
demandais : « Arrivée en cours de quiz : les 2 premières questions ne
comptent pas pour toi. » Je copie même le lien de mon bilan pour le garder.

## Ce qui m'a plu
- Le message d'erreur quand je me suis trompée de nom de soirée est clair et
  gentil, pas un mur technique : « Cette adresse ne mène à aucune soirée.
  Vérifie le nom avec ton hôte, ou scanne à nouveau le QR de l'écran. »
- Jouer sans compte, juste un prénom et un avatar, c'est vraiment rapide —
  personne n'a eu besoin de mon vrai prénom pour que je puisse jouer.
- Mon bilan me dit explicitement que les 2 premières questions ne comptent
  pas pour moi puisque je suis arrivée en retard : exactement la question que
  je me posais, résolue sans que j'aie à demander à personne.
- Le clin d'œil « Le Somnambule » sur mon écran de fin, et le prix « Coup de
  Pouce » remis à mon équipe (moi toute seule, dernière du classement) : ça
  ne se moque pas de moi, ça sourit avec moi.
- Le lien de mon bilan, copiable en un geste (« Lien copié »), pour le
  retrouver ou le montrer plus tard sans tout refaire.

## Ce qui m'a gêné
- **Où** : l'entrée dans la soirée, avant même d'avoir pu rejoindre.
  **Ce que j'attendais** : pouvoir rejoindre facilement même sans voir le QR,
  par exemple grâce au lien que je demandais dans le chat.
  **Ce qui s'est passé** : personne n'a répondu à temps (l'animateur gérait
  la salle), et j'ai dû deviner seule le nom de la soirée depuis l'accueil ;
  mon premier essai a échoué, et le quiz a démarré pendant ce temps-là — j'ai
  raté les deux premières questions avant même d'avoir pu m'inscrire.
  **Gravité** : gênant (j'ai fini par y arriver seule, mais c'est du jeu
  perdu pour de bon, pas juste du temps).
  **Captures** : `001-accueil.png` (mon point de départ) — je n'ai pas pensé
  à capturer l'écran d'erreur lui-même, prise dans le rythme de deviner le
  bon nom.
- **Où** : mon arrivée, annoncée à voix haute par l'animateur.
  **Ce que j'attendais** : avec un pseudo, rester discrète.
  **Ce qui s'est passé** : Marc a deviné tout haut « Bienvenue Fantomette !
  C'est toi Maëlle ? » devant toute la salle dès que j'ai rejoint.
  **Gravité** : détail (ce n'est pas la faute de l'appli — elle n'a jamais
  montré mon prénom à personne — mais dans les faits, le pseudo ne m'a pas
  rendue invisible).
  **Captures** : aucune, c'est une phrase dite dans le chat, pas un écran.
- **Où** : mon bilan personnel, bloc « Dans ton équipe ».
  **Ce que j'attendais** : une indication utile sur ma place dans l'équipe.
  **Ce qui s'est passé** : « 1ʳᵉ place sur 1 » — vrai, mais ça ne dit rien
  puisque j'étais seule dans l'équipe Tech.
  **Gravité** : détail.
  **Captures** : `012-bilan-perso.png`.

## Bugs constatés
Rien de cassé à signaler. La console ne montre que les 401 attendus sur
`/api/auth/me` tant qu'on n'est pas connectée. Tous mes gestes — deviner le
nom de la soirée, jouer sous pseudo, partir en cours de quiz sans rien
fermer, revenir après la clôture — ont donné exactement le résultat annoncé,
y compris le décompte de mes points (177 + 115 = 292) et le « 2 premières
questions ne comptent pas pour toi » qui colle pile à mon heure d'arrivée.

## Mes idées
- Rendre l'adresse de la soirée trouvable sans dépendre de la salle : par
  exemple la rappeler sur l'écran commun de temps à autre (pas seulement au
  lancement), ou suggérer le bon nom quand celui qu'on tape s'en approche
  (« marc » est si proche de « chez-marc »). Ça m'aurait évité de rater deux
  questions avant même de jouer.
- Cacher ou reformuler « Dans ton équipe : 1ʳᵉ place sur 1 » quand l'équipe
  n'a qu'un seul membre — ce chiffre ne dit rien à personne dans ce cas.
- Garder tel quel tout le reste du rattrapage pour qui part en cours de
  route : le décompte au bilan, le clin d'œil de fin de soirée et le lien
  copiable font déjà très bien le travail.

## Mes notes
- Entrer dans la soirée : 2/5
- Plaisir de jeu (ou d'animer) : 3/5
- Lisibilité — textes, boutons, couleurs : 4/5
- Envie de revenir, de recommander : 4/5
