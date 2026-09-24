# Vérification — les salons de Marc et de Léa (tablée du 24 septembre 2026)

Trois soirées en même temps sur un même serveur (`export/tablee/2026-09-24-trois-salons/`).
Ce document ne couvre que deux salons : **chez Marc** (l'afterwork d'une agence, écran
1920 × 1080 recopié, quiz écrit par une IA) et **chez Léa** (une crémaillère animée
depuis un téléphone, avec une télé à part), plus Inès, qui passe de l'un à l'autre.

**Chaque constat a été vérifié** : dans le code (`fichier:ligne`), sur les captures, dans
`journal.jsonl` et `regie.log`, ou rejoué — trois rejeux, sans toucher à la tablée en
direct, dans ce dossier-ci (`export/evaluations/verification/salons-marc-lea/`, liste
en fin de document). Ce qui venait du banc est écarté à part.

La coupure de l'outil vers 15:26 n'a touché **aucune** des deux soirées : Marc a clos à
15:21:34, Léa à 15:22:35. Seules les relectures du lendemain de Léa et d'Inès ont repris
après, à 15:54.

## En bref

Le cœur a tenu dans les deux salons, et plaît : la liste écrite par une IA comprise du
premier coup (un quiz de dix questions jouable cinq minutes après l'activation), la
console au téléphone pendant tout le quiz, entrer sans compte, le profil reconnu d'une
fête à l'autre, le code de secours, la photo à mémoriser. Les trois soirées ne se sont
pas gênées (voir « Trois salons sur un même serveur »).

34 constats, dont **12 bugs confirmés** (lus dans le code ou rejoués) ; 8 remarques
écartées, venues du banc. Ce qui coince, du plus coûteux au moins coûteux :

1. **Un quiz joué change de vainqueur** quand une invitée arrivée après coup rejoint une
   équipe (Léa, Inès) — et l'historique l'aurait gardé. *Bug confirmé, rejoué.*
2. **Animer au téléphone** : la remise des prix et l'écran de victoire ne s'ouvrent que
   sur l'écran qu'on touche ; la télé reste en salle d'attente. *Bug confirmé.*
3. **Le téléphone qui meurt** : deux « Rachid », des points jamais réunis, un fantôme
   que la salle attend à chaque question, et rien dans la console pour y remédier.
4. **Les champs de nombres** qui affichent « 2050 », « 020 », « 02 », et **la liste
   collée** qui ne transmet pas le temps, contrairement à son aide. *Bugs confirmés.*
5. **La police des titres décale ses accents** — « non confirmé » le 23, rejoué
   aujourd'hui. *Bug confirmé.*
6. Puis : brancher la télé quand on anime au téléphone, des prix qui retournent la
   victoire, la pause et le QR qui ne se lisent pas au mur, les ex æquo des prix, le
   bilan ouvert à tous, et une série de finitions.

## Qui était là

| Personnage | L'angle | Appareil | Sa soirée | Entrer · Jouer/animer · Lire · Revenir |
|---|---|---|---|---|
| **Marc**, 45 ans | anime pour la 1ʳᵉ fois, fait écrire son quiz par une IA | portable branché au grand écran, 1920 × 1080, recopié | compte activé → quiz de 10 questions jouable en ~5 min ; 3 équipes, 4 prix (dont un libre à +2), clôture, relecture, export et réimport | 5 · 4 · 4 · 4 |
| **Inès**, 26 ans | passe d'une fête à l'autre, avec son profil | téléphone | chez Marc : **1ʳᵉ, 1 355 pts**, niveau 1 → 2 (+91 XP) ; chez Léa : arrivée après le quiz, aucune question | 5 · 4 · 5 · 4 |
| **Bertrand**, 58 ans | sans compte, méfiant, lunettes de près | tablette Android 800 × 1280, puis en paysage | **2ᵉ, 995 pts** ; Cancre Magnifique et prix du fou rire (à son équipe) | 5 · 4 · 5 · 3 |
| **Rachid**, 35 ans | son téléphone meurt après la Q3 | téléphone, puis un emprunté (`rachid-bis`) | **3ᵉ, 491 pts** (⚽) — et 186 pts restés sur « Rachid (tél. HS) » 🦁, 5ᵉ | 3 · 4 · 4 · 4 |
| **Maëlle**, 24 ans | stagiaire au fond, sans le QR, sous pseudo | iPhone | « Fantomette », **4ᵉ, 292 pts** : entrée à la Q3, décroche après la Q4 ; Le Somnambule | 2 · 3 · 4 · 4 |
| **Léa**, 22 ans | anime sans ordinateur | téléphone 412 × 915 + télé 1920 × 1080 (`lea-tele`) | liste collée de 9 questions, 2 équipes, 2 prix, clôture — tout au téléphone sauf la télé | 3 (activer 5, télé 2) · 4 · 4 · 4 |
| **Liam**, 23 ans | Erasmus, français débutant | iPhone | **1ᵉʳ, 1 280 pts** | 5 · 5 · 3 · 4 |
| **Zoé**, 23 ans | « réduire les animations », téléphone couché | téléphone, puis en paysage | **2ᵉ, 1 273 pts** | 4 · 5 · 4 · 5 |
| **Malik**, 23 ans | mot de passe oublié, code de secours | téléphone | **3ᵉ, 938 pts**, +30 XP | 4 · 5 · 4 · 5 |

## Les constats vérifiés

Priorité : P1 abîme la soirée de toute une salle, P2 celle de quelques-uns, P3 le confort.
Effort : S, quelques lignes ; M, une journée ; L, un lot.

### 1. Un quiz joué change de vainqueur quand quelqu'un rejoint une équipe après coup — P1 · S — bug confirmé (rejoué)

**Ce qui se passe.** Chez Léa, le quiz s'achève : « Les invités » (Liam seul, 1 280)
battent « La coloc » (Zoé 1 273 et Malik 938, moyenne 1 106). Le podium l'annonce, Léa
aussi (15:18:50). Inès arrive à 15:19, choisit elle-même « Les invités » à l'entrée, avec
0 point et sans avoir joué une question. La moyenne des invités tombe à 640, et l'écran de
victoire couronne « La coloc » (3 points contre 2). Léa ne l'a vu qu'en regardant les
chiffres. Elle a sorti Inès de l'équipe (15:20:47) et la victoire est revenue aux invités.

**Qui.** Léa, Inès. Captures `lea-tele/014` (podium : les invités premiers),
`lea-tele/015` (les invités à 640, deuxièmes), `lea/023` (« La coloc » remporte le quiz),
`lea-tele/017` (les invités, une fois Inès sortie).

**Preuve.** `teamScores` fait la moyenne sur **tous** les membres d'une équipe, qu'ils
aient joué ou non (`shared/teams.ts:18-35`). C'est la même fonction partout : la salle
(`server/src/core/space.ts:736`), le souvenir (`recap.ts:94`), le bilan (`review.ts:435`)
et l'historique (`archive.ts:267`). L'historique sait pourtant qui a joué. La fiche porte
`joue` (`archive.ts:208`, `219`) et s'en sert pour les vainqueurs individuels et le nombre
de joueurs (`archive.ts:254-263`), mais pas pour les équipes. Rejoué sur les chiffres de
la fiche réelle (`verdict-equipes.ts`) :
- Inès sortie de l'équipe (ce qu'a fait Léa) : les invités l'emportent, 2 + 1 = 3 ;
- Inès restée : « La coloc » gagne, 3 contre 2. C'est ce que l'historique, le souvenir et
  le bilan auraient gardé si Léa avait clos sans y toucher.

**Coût.** Le verdict annoncé à toute la salle se retourne sans un mot, puis se fige dans
l'archive. Il suffit d'un cas banal : un retardataire qui choisit une équipe entre deux
quiz.

**Piste.** Un membre ne compte dans la moyenne de son équipe qu'à partir de sa première
ligne au journal des réponses (le `joue` de la fiche). Concrètement : un paramètre de
`teamScores` (les joueurs qui ont joué), passé par ses quatre appelants. C'est le même
chemin pour la soirée et pour l'archive (invariant 14). Le test, dans `server/test/` : un
invité rejoint une équipe après le quiz, et la victoire ne bouge pas. Le cas voisin reste
un parti pris : déplacer un joueur qui **a** joué emporte ses points (README, « Les
équipes »). Le figer demanderait d'écrire l'équipe au journal des réponses (trois
fichiers, voir CLAUDE.md).

### 2. Animer au téléphone : la remise des prix et la victoire restent dans la main — P1 (quand on anime au téléphone) · M — bug confirmé

**Ce qui se passe.** Léa pilote tout le quiz depuis son téléphone, et la télé suit à la
seconde : questions, révélations, podium du quiz, clôture. Ce n'est plus vrai après le
quiz. « Prix », « Victoire » et le podium de la soirée ne s'ouvrent que sur l'écran qu'on
touche : la télé reste sur « Salle d'attente », et un prix remis ne s'y lit que par
« +1 de prix » dans le tableau des équipes. Léa s'est levée pour ouvrir « Victoire » à la
télécommande. Les prix, la salle ne les a jamais vus. Marc vit l'inverse : son écran est
recopié, et la salle lit la grille des quinze lauréats avant qu'il ouvre la bouche
(`marc/028`).

**Qui.** Léa : `lea/022`, `lea/023`, `lea-tele/015`, `lea-tele/016`, `lea-tele/017`.
Marc : `marc/028`, `marc/029`.

**Preuve.** L'écran de fin est un état local de la page :
`useState<null | 'podium' | 'awards' | 'victory' | 'cloture'>`
(`client/src/views/HostApp.tsx:242`), ouvert par `openScreen` (`:428-433`). Aucune
commande `host:*` ne le diffuse (`shared/events.ts:122-175`). Seule la clôture suit sur
tous les écrans, parce qu'elle vient du serveur (`HostApp.tsx:273`). Le README prévoit
pourtant « deux écrans animateurs » (l. 192).

**Coût.** Les prix et l'équipe gagnante, c'est le moment où toute la salle regarde
l'écran. Il n'y passe pas, ou l'animatrice doit retourner à la télé.

**Piste.**
- Une scène tenue par le serveur : une commande `host:scene` (`null | 'podium' | 'prix' |
  'victoire'`, plus le dernier prix remis), placée dans l'instantané, que suivent tous les
  écrans communs de la soirée. Elle change rarement, ce qui respecte l'invariant 4. La
  commande rejoint `garde-fous.test.ts`.
- L'écran qui pilote garde la grille des prix et leurs lauréats ; les autres montrent en
  grand le prix qu'on vient de remettre. C'est la « remise des prix en scène » (piste L de
  la tablée du 23), que Marc redemande.
- Un réglage « écran de salle » sur `/host` qui masque la barre de console. Léa : « toute
  la barre de console reste visible par la salle » (`lea-tele/007`).

### 3. Le téléphone qui meurt : deux « Rachid », des points jamais réunis, un fantôme qu'on attend — P2 · M (L pour une vraie fusion) — manque confirmé, et une tension

**Ce qui se passe.** Le téléphone de Rachid s'éteint à 15:11:04, au début de la Q4. Sur
le téléphone emprunté, il retape « Rachid ». Le lion est éteint dans la grille : « Il y a
déjà un « Rachid » — ton 🚀 vous distinguera » (`rachid-bis/001`). Il prend ⚽ et revient
à la Q5. Il finit 3ᵉ avec 491 points. Ses 186 points d'avant restent sur la fiche 🦁, hors
ligne, jusque dans le souvenir, son bilan et l'historique (« 5 joueurs »). Marc, en
direct : « je ne peux pas fusionner tes deux Rachid pendant le quiz : on verra à la fin ».
À la fin, il ne trouve que « renommer » (« Rachid (tél. HS) ») et « sans équipe ».

Le fantôme pèse aussi sur toute la salle :
- **il est attendu à chaque question** (« 0 / 5 ont répondu » quand l'en-tête dit
  « 4 connecté·e·s ») : la révélation n'arrive plus dès que tout le monde a répondu. Marc
  a révélé à la main de la Q8 à la Q10 ; ses `attendre « 4 / 5 ont répondu »` échouent
  quatre fois entre 15:14 et 15:17 ;
- il dilue l'équipe Commercial, dont la moyenne tombe de 743 à 557 (`rachid-bis/004`,
  `marc/027`) ;
- il rafle L'Abstentionniste (`marc/028`) et Le Somnambule.

**Qui.** Rachid et Marc, avec Bertrand et Maëlle en témoins. Captures `rachid-bis/001`,
`004`, `007`, `marc/027`, `marc/028`.

**Preuve.**
- Aucune commande ne rend sa place à un invité ni ne réunit deux fiches
  (`shared/events.ts:157-175` : renommer, exclure, placer dans une équipe). Exclure le
  fantôme lui aurait retiré ses 186 points et ses réponses (README l. 192).
- Pendant un quiz, le panneau des invités disparaît de la console (`HostApp.tsx:373`).
- Un nouveau téléphone n'a pas le jeton de l'ancien : il ne peut être qu'un nouvel
  invité. C'est voulu (invariant 9), sinon n'importe qui prendrait la place de n'importe
  qui. L'entrée éteint l'avatar de tout homonyme, y compris hors ligne
  (`client/src/components/Entree.tsx:88-93`).
- Un participant hors ligne reste attendu, et c'est un choix écrit (`quiz.ts:318-331`) :
  « l'exclure reviendrait à révéler dans le dos de quelqu'un dont le réseau a hoqueté une
  seconde ». **La tension est là** : ce qui protège d'un hoquet pénalise une panne
  définitive.
- Deux « Rachid » aux avatars différents ne portent pas de marque : c'est conforme à
  l'invariant 17, qui ne marque que le prénom **et** l'avatar partagés.

**Coût.** Un joueur perd ses points, et son équipe une part de sa moyenne. Toute la salle
attend le chrono entier à chaque question, sauf si l'animateur révèle à la main. Un
téléphone à plat en soirée, c'est courant.

**Piste.**
- (M) « Rendre sa place » sur la pastille d'un invité hors ligne, **y compris pendant le
  quiz**. La console montre un QR ou un code à usage unique, que le nouveau téléphone
  scanne pour recevoir le jeton de l'ancienne fiche. C'est une re-présentation ordinaire
  (invariant 9), et seul l'animateur peut l'autoriser.
- (S) À l'entrée, quand le prénom tapé est celui d'un invité hors ligne : « Un « Rachid »
  🦁 est hors ligne : si c'est toi, demande à l'animateur de te rendre ta place ».
- (S) Sur la console : « On attend encore Rachid 🦁 (hors ligne) », avec « Ne plus
  l'attendre ». L'animateur tranche, et la règle par défaut ne bouge pas.
- (L, à arbitrer) Réunir deux fiches après coup : des gains compensés au journal, qui
  reste en ajout seul (`core/scores.ts`), et les lignes de réponses à reprendre.

### 4. Les champs de nombres se battent contre le clavier : « 2050 », « 020 », « 02 » — P2 · S — bug confirmé

**Ce qui se passe.** Léa vide le champ « Temps » (20) pour y taper 50. Le champ se
remplit aussitôt de « 20 », et ses chiffres s'ajoutent derrière. Résultat : « 2050 » sur
huit questions, « 2 » en effaçant chiffre par chiffre. Aucun avertissement, et le
compteur affiche toujours « 9/9 prêtes » (`lea/009`). Elle y a perdu une dizaine de
minutes. Marc a vu la même famille ailleurs : « Invités au plus » vidé puis 20 donne
« 020 » (la valeur enregistrée est juste), et les points du prix libre donnent « 02 ».

**Preuve.** Cinq champs `type="number"` contrôlés, lus par `Number(e.target.value)` :
- le temps de réponse, `value={question.duration || DEFAULT_DURATION}` : un champ vidé
  vaut 0, et l'affichage repart à 20 (`client/src/views/EditorApp.tsx:1559-1560`) ;
- le temps d'observation (`EditorApp.tsx:1649-1650`) ;
- « Invités au plus » (`AccountApp.tsx:319-320`) ;
- les points du prix libre (`HostApp.tsx:776-777`) ;
- les points de chaque prix (`AwardsBoard.tsx:83`).

React 19 réécrit un champ vide dont la valeur passe à 0, puis laisse « 020 », puisque
`"020" == 20` (`node_modules/react-dom/cjs/react-dom-client.development.js:1662-1664`).
Rien ne dit ensuite que 2050 s sort des bornes : `questionProblem` ne regarde pas le
temps (`shared/library.ts:285-297`), et le serveur le ramène en silence à 120 s ou à 5 s
(`library.ts:252`, `349-351`). C'est aussi un écart à une convention du dépôt : « un
nombre tapé se lit avec `lireNombre()` […] le champ garde le texte tapé ; seule la valeur
lue part en base » (CLAUDE.md).

**Coût.** Une question à 120 s au lieu de 50, ou à 5 s, partirait telle quelle.
L'animatrice au téléphone y perd son temps de préparation.

**Piste.** Un petit composant de champ numérique qui garde le texte tapé et ne remonte que
la valeur lue (`lireNombre`), borne et prévient à la sortie du champ (« entre 5 et
120 s »), pour les cinq champs. `questionProblem` signale en plus un temps hors bornes.
Et un « Appliquer ce temps à tout le quiz » près du champ : Marc et Léa l'ont cherché
tous les deux.

### 5. La liste collée ne transmet pas le temps, et ses deux aides se contredisent — P2 · S — bug confirmé (rejoué)

**Ce qui se passe.** Léa met « Temps : 50 s » sous sa première question seulement, comme
l'aide du panneau le lui dit. La catégorie suit, le temps non : la Q1 est à 50 s, les huit
autres à 20 s (`lea/006`, `lea/008`). C'est ce qui l'a envoyée dans le champ du
constat 4. Marc a suivi le format complet (« Temps » sous chaque question) et n'a rien eu
à reprendre, mais il a relevé la contradiction.

**Preuve.**
- L'aide du panneau dit : « Sans ces lignes, elles prennent le temps et la catégorie de
  la question qui les précède » (`EditorApp.tsx:1089-1093`).
- Le format copié pour l'IA dit : « Sans cette ligne, celui réglé dans FiestApp (20 s au
  départ) » (`shared/liste.ts:115`).
- Le code : la catégorie court d'une question à l'autre (`let categorie`,
  `shared/library.ts:490`), mais chaque question repart du temps de la question voisine
  de l'endroit où l'on colle (`const question = emptyQuestion(modele)`,
  `library.ts:507`).
- Rejoué (`liste-temps.ts`) : 50 s · 20 s · 20 s, la même catégorie aux trois.

**Piste.** Faire courir le temps comme la catégorie (une variable `temps`, initialisée par
la question voisine) et écrire la même phrase dans les deux textes. `liste.test.ts` relit
l'exemple du format : y ajouter le cas « un seul Temps ». Le format annonce aussi « de 5 à
120 secondes », ce que l'éditeur ne dit nulle part.

### 6. La police des titres décale ses accents — P2 · S — bug confirmé (rejoué ; « non confirmé » le 23)

**Ce qui se passe.** Marc, directeur de création : « dans les grands titres, les accents
semblent décalés au-dessus des lettres : « été créée », « août », « Les soirées ». Ça se
remarque sur une télé. » Nadia l'avait déjà signalé le 23, sans confirmation.

**Preuve.**
- Sa capture agrandie (`accents-zoom-capture.png`) montre l'accent de « cafés » posé
  entre le é et le s.
- Rejoué dans le Chromium de la tablée (`accents-polices.mjs`, qui produit
  `accents-trois-polices.png`) : les deux polices livrées décalent vers la droite l'accent
  de toutes les lettres accentuées essayées (é, û, É), en texte NFC. Ce sont
  `client/public/fonts/cormorant-garamond-600.woff2` et `-500-italic.woff2`. La police
  serif du système, elle, place bien les accents.
- Les textes en base sont bien en NFC (vérifié sur les quiz, les espaces et les archives
  de la tablée) : le problème vient de la police.
- La police contient pourtant ces lettres (é : glyphe 170, û : glyphe 143, d'après
  `police-cmap.mjs`). Ce sont leurs dessins composés qui placent mal l'accent, sans doute
  depuis la réduction du fichier.

**Coût.** Chaque titre accentué, au mur comme sur les téléphones. En français, il y en a
partout.

**Piste.** Régénérer les deux woff2 depuis la police d'origine en vérifiant les glyphes
composés, puis rejouer `accents-polices.mjs`. À confirmer sous Windows 10, qui fait tourner
l'écran commun.

### 7. Allumer la télé quand on anime au téléphone — P2 · S (lien) / L (appairage) — friction confirmée

**Ce qui se passe.** À la télécommande, Léa tape l'adresse du site. L'accueil affiche
« Retrouver mon profil », qui refuse son identifiant d'animatrice (« Identifiant ou mot de
passe incorrect ») sans lui indiquer d'autre piste. Elle recopie `/host`, vu sur son
téléphone, puis retape identifiant et mot de passe accentué. Au total : deux adresses,
deux connexions et une dizaine de minutes debout (`lea-tele/001` à `003`).

**Preuve.** L'accueil ne connaît que les profils (`client/src/components/ProfilForm.tsx:97`).
« Animer ma soirée » n'y paraît que pour un profil rattaché à un espace
(`ProfilApp.tsx:176`), et Léa n'a pas de profil.

**Piste.**
- (S) Sous le formulaire de l'accueil, un lien « Tu animes une soirée ? Écran commun »
  vers `/host`.
- (L) Un code d'appairage affiché sur le `/host` de la télé, validé depuis la console du
  téléphone déjà connecté. Plus aucun mot de passe à taper à la télécommande.

### 8. Des prix qui retournent la victoire annoncée — P2 · S-M — tension avec un parti pris

**Ce qui se passe.** Au podium, Marc annonce « l'équipe Créa gagne ! » (Créa 1 355 de
moyenne, Commercial 743). Il remet ensuite quatre prix, dont le Cancre Magnifique (+1,
Bertrand) et « le meilleur fou rire » (+2, Bertrand). Commercial passe à 2 + 3 = 5, Créa
à 3 + 1 = 4, et l'écran de victoire couronne Commercial devant toute l'agence (`marc/026`,
`028`, `030`, `031`). La règle est écrite en haut de la remise, mais en petit, et Marc ne
l'a comprise qu'après coup. Le prix libre ne se donne qu'à une équipe : Marc a écrit
« (Bertrand) » dans le motif.

**Preuve.** C'est la règle écrite : « un prix peut renverser l'ordre, c'est tout son
intérêt » (README l. 274 ; `shared/teams.ts:56-62`). Un prix est un point d'équipe,
jamais le score d'un joueur (invariant 19). Un prix d'honneur à 0 point est refusé
(`server/src/core/teams.ts:153`, « Il faut un nombre de points »).

**Coût.** L'animateur découvre après coup qu'il a changé le vainqueur, et la salle assiste
à un retournement que personne n'a voulu.

**Piste (à arbitrer).**
- Sur la carte d'un prix, avant « Attribuer », dire ce qu'il change : « Commercial
  passerait devant Créa ».
- Accepter 0 point pour un prix d'honneur : une ligne dans « Remis ce soir-là », rien au
  barème.
- Sur l'écran de victoire, rappeler « Créa gagne le quiz, Commercial l'emporte aux prix ».

### 9. Ce que le mur ne dit pas : la pause, le QR, qui n'a pas répondu — P2 · S / M — frictions, déjà vues le 23

- **La pause** ne se voit qu'à un « ⏸ » de 24 px à la place des secondes
  (`client/src/components/TimerBar.tsx:61-63` ; `marc/020`, `lea-tele/009`). Marc et Léa
  l'ont relevé, et Liam a demandé « qu'est-ce qui happen ». Ironie : pendant ce temps, le
  téléphone dit « En pause — regarde l'écran commun » (`PlayerView.tsx:250`). *Piste*
  (S) : « PAUSE » en grand sur l'écran commun, chronomètre grisé.
- **Le QR de la salle d'attente** fait 148 px quel que soit l'écran (`HostApp.tsx:976`),
  soit 8 % de la largeur en 1920 × 1080. Il faut se lever pour le scanner (Marc,
  `marc/014`). L'adresse, écrite en très grand, compense. *Piste* (S) : une taille en
  `vmin`.
- **Qui n'a pas répondu ?** La console ne dit que « 3 / 5 ont répondu »
  (`server/src/games/quiz.ts:835-836`). Fantomette a laissé passer six questions sans que
  Marc le voie, et Léa voulait taquiner qui traîne. C'était une piste M de la tablée du 23,
  toujours ouverte. *Piste* : les prénoms de ceux qu'on attend, dans la seule vue de
  l'animateur (`hostView`), avec les invités hors ligne marqués comme tels. C'est aussi ce
  qui aurait révélé le fantôme du constat 3.

### 10. La remise des prix, relue le lendemain — P3 · S — une tension, deux frictions

- **Les ex æquo sont tranchés au prénom, sans le dire.** L'Invincible (5 bonnes d'affilée)
  et Le Sans-Faute (71 %) vont à Liam, à égalité avec Zoé. Le Pile-Poil va à Liam, à
  égalité avec Zoé et Malik (Léa ; `lea/022`, `lea/030`). *Vérifié* : `buildAwards` ne
  retient qu'un lauréat, départagé par le volume puis par le prénom
  (`server/src/core/stats.ts:447-456`), et L passe avant Z. C'est un choix écrit (« pour
  que le prix ne change pas de mains à chaque rechargement »), mais il est **en tension
  avec l'invariant 15** (« tous les ex æquo en tête gagnent »). Et le palmarès se range
  sur l'étagère des profils : Zoé n'aura pas ces prix. *Piste* : la carte dit « ex æquo
  avec Zoé » et laisse l'animateur choisir ; pour le palmarès, à arbitrer.
- **Trois temps moyens qui se contredisent.** La Gâchette Facile (« répond parmi les plus
  vite ») va à Malik avec 9,1 s, Le Contemplatif (« le plus lent ») à Liam avec 8,1 s, et
  la fiche de Malik affiche 6,9 s. *Vérifié* : ce ne sont pas les mêmes moyennes.
  - L'Éclair et Le Contemplatif moyennent les seules bonnes réponses (`stats.ts:173`).
  - La Gâchette moyenne toutes les réponses aux QCM (`stats.ts:156`) et divise les
    erreurs par ce temps (`stats.ts:295`) : elle peut revenir à un joueur lent.
  - La fiche du bilan moyenne toutes les réponses, estimations comprises
    (`review.ts:330`).

  *Piste* : écrire la base (« 9,1 s sur ses 7 QCM ») et reformuler la Gâchette (« se
  trompe souvent, et vite »).
- **Partager le souvenir.** Il n'y a aucun bouton pour le faire, ni à la clôture ni sur le
  souvenir. Seul le bilan a « Copier le lien de ce bilan » (`BilanApp.tsx:182`). « Les
  soirées » a en plus deux liens « Souvenir » : l'onglet mène à `/chez-lea/souvenir`, qui
  montrera la soirée suivante ; la carte, au lien stable (`lea/027`, `028`, `032`). Léa
  (pour WhatsApp) et Marc (pour la newsletter) le cherchaient ; Camille M. le demandait
  déjà le 23. *Piste* (S) : un bouton « Partager » (`navigator.share`, avec repli sur le
  presse-papiers) portant l'adresse stable `/soirees/<id>/souvenir`, à la clôture et sur
  le souvenir.

### 11. Inès, d'une fête à l'autre — P3 · S — un bug, et une règle respectée

- **« 0 joueurs ce soir »** s'affiche sur sa fin de soirée chez Léa, où trois invités
  avaient joué (`ines/011`). *Vérifié* : sans relevé (elle n'a répondu à rien),
  `joueurs` retombe à 0 (`space.ts:1044`), affiché tel quel (`FinDeSoiree.tsx:75`).
  **Bug confirmé.** *Piste* : `joueurs: x?.releve.joueurs ?? summary.players`, et une
  phrase qui parle d'elle (« Tu n'as pas joué ce soir · 3 joueurs »).
- **« Mes soirées » ne garde que la soirée chez Marc** (`ines/015`). C'est **conforme** :
  la liste est faite des lignes d'expérience du profil (`auth/profiles.ts:1236-1252`), et
  une soirée sans aucune réponse n'en écrit pas (`relevesDeSoiree`, `core/progress.ts`) —
  « rien pour la présence » (invariant 19). En écrire une ferait aussi compter la soirée
  pour L'Habitué, ce que l'invariant interdit. *Idée* (M) : lister à part les soirées où
  l'on est venu sans jouer, lues dans les archives (le rattachement y survit,
  `archive.ts:111`), sans toucher à `profile_xp`.
- **La clôture de Marc ne l'a pas suivie.** Elle avait quitté la page de Marc à 15:18 ;
  sa fin de soirée reste gardée pour son jeton (`space.ts:1051`). *Idée* (S) : sur
  `/profil`, un encart « Depuis ta dernière visite : chez Marc, +25 XP, un haut fait »,
  avec le lien du souvenir.
- Son profil a tenu sa promesse : reconnue chez Léa sans rien retaper (`ines/009`), et
  jamais d'« Inès (2) » d'un espace à l'autre.

### 12. Le bilan de chacun, ouvert à tous — P2 · M — tension avec un parti pris

Bertrand est venu méfiant, et repart avec 3/5 en envie de revenir. Le bilan liste tous
les prénoms, et un toucher ouvre le détail des réponses de n'importe qui. Le souvenir
montre d'emblée le tableau de tous les joueurs. Et Marc annonce qu'il mettra ce lien dans
la newsletter (`bertrand/011`, `012`). C'est pourtant le parti pris écrit : « Le bilan le
raconte, sans compte […] on choisit son prénom dans la liste » (README l. 224) ; « Le
palmarès, lui, est public » (l. 214). *À arbitrer* : un réglage d'espace « bilans
personnels », où chacun n'ouvre que le sien par son propre lien (le `#p=…` existe déjà),
et une phrase qui dit ce que le souvenir montre avant qu'on le partage.

### 13. Les finitions — P3 · S chacune — bugs confirmés, sauf mention

- **Pendant la photo à mémoriser, la console affiche « au clic »** alors que
  l'enchaînement est réglé sur 20 s (`lea-tele/011`). Un clic sur « au clic » y serait
  même ignoré. La vue de l'observation n'envoie pas `autoNextSeconds`
  (`quiz.ts:809-817`), contrairement à celle de la question (`quiz.ts:833`), et le bouton
  n'envoie rien s'il se croit déjà actif (`HostView.tsx:108`, `116`). *Piste* : ajouter le
  champ à la vue `observe`.
- **« ⚡ ZOÉ — 8.90 S »** : `(v.fastest.ms / 1000).toFixed(2)` (`HostView.tsx:310`) écrit
  un point à l'anglaise et deux décimales, quand le reste de l'application écrit
  « 6,9 s ».
- **« Le bilan de Inès »**, et « Équipe de Inès » pour le lecteur d'écran
  (`BilanApp.tsx:305`, `HostApp.tsx:187`), alors que `deNom()` existe
  (`shared/typographie.ts:21-27`).
- **« In… » en 1920 × 1080.** Dans la colonne des invités, la pastille « Niv. 2 · Inès · ☾
  · équipe » coupe le prénom à deux lettres (`marc/027`, `032`) : c'est `.chip-name`
  (`min-width: 0`) qui cède (`styles.css:1855-1868`). *Piste* : le prénom garde au moins
  5 ch, et c'est le badge ou le sélecteur qui cède d'abord.
- **L'erreur de connexion survit à la récupération du profil** (Malik, `malik/004`) :
  « Identifiant ou mot de passe incorrect » reste affiché sous le nouveau code de secours.
  Ni « J'ai oublié mon mot de passe » (`Entree.tsx:224`) ni la récupération réussie
  (`:270-277`) ne vident `erreur`, que l'écran du code affiche (`:499`).
- **L'import.** Le message « « Spécial agence » est dans ta bibliothèque… » reste affiché
  après la suppression de ce quiz, que la suppression n'efface pas
  (`EditorApp.tsx:368-370`). Autre point, une friction : le quiz importé porte le même nom
  que l'original, et « Supprimer « Spécial agence » ? » ne dit pas lequel (`marc/039`).
- *Friction* — **« Importer un quiz » n'est pas « importer une liste »** (Marc,
  `marc/005`). Son premier réflexe ouvre un sélecteur de fichier muet ; « Coller une
  liste » n'existe qu'à l'intérieur d'un quiz. *Piste* : à côté d'« Importer un quiz »,
  un « Coller une liste » qui crée le quiz et ouvre le panneau.
- *Friction* — **« Dans ton équipe : 1ʳᵉ place sur 1 »** (Maëlle, `maelle/012`). La tuile
  s'affiche même quand on est seule dans son équipe (`BilanPlayer.tsx:83-91`) : la taire
  sous deux membres.
- *Friction* — **la fin de soirée met en avant « Rejoindre la soirée suivante »** (bouton
  plein) plutôt que « Revoir la soirée » (contour), alors qu'aucune soirée n'est encore
  ouverte (`FinDeSoiree.tsx:174-179` ; `zoe/010`, `ines/011`).
- *Rien d'urgent* — **« C'était un essai » à côté d'« Annuler »** au téléphone
  (`lea/026`) : une seconde confirmation le protège déjà (`HostApp.tsx:475-481`).

### 14. Les autres écrans, les autres lecteurs — P3 · M — frictions et idées

- **La tablette en paysage** : une colonne de 560 px au milieu d'un écran de 1 280
  (`styles.css:658` ; `bertrand/003`, `007`, `009`). Bertrand : « un téléphone posé au
  milieu d'une tablette ». Le souvenir et le bilan, eux, prennent toute la largeur. Le
  téléphone couché de Zoé est resté confortable.
- **Le tableau des chiffres a 18 colonnes** et défile en largeur au téléphone (Zoé,
  `zoe/011` ; Liam). *Piste* : figer les deux premières colonnes, ou empiler des fiches
  sous 600 px.
- **Les mots pour un débutant** (Liam, français A2-B1). Il bute sur « Coup d'œil », « Le
  Cancre Magnifique », « bilan », « souvenir », « palmarès », et sur la légende « Le
  chiffre cerclé : le barème, prix compris… », que Marc trouvait déjà obscure. La photo à
  mémoriser et les vrai/faux passent sans un mot. *Idées* : la règle d'un prix en une
  ligne, au toucher ; la légende des équipes en deux mots (« points du quiz + prix »).
- **La catégorie maison.** « Vie de l'agence » n'existe pas, car la liste des catégories
  est fixe (`shared/categories.ts`). C'est un parti pris, à garder en tête.
- **L'adresse devinée.** Maëlle tape « marc » et reçoit un refus clair. Lui proposer
  « chez-marc » reviendrait à laisser énumérer les espaces du serveur (invariant 3 : « le
  voisin n'en sait rien ») : une idée à arbitrer, pas une correction.
- **Une page de résultats** tenant sur une page, pour une newsletter (Marc) : podium,
  équipes, prix remis. Une idée.

## Trois salons sur un même serveur : aucune gêne constatée

- **Aucune erreur** : `regie.log` ne compte que les 22 lignes du démarrage, sur toute la
  soirée.
- **Les mêmes délais partout** : l'accusé d'une réponse (geste `repondre`) prend 550 ms de
  médiane chez Léa, 564 ms chez Marc et 574 ms chez Nadia, pendant que les trois quiz
  tournaient en même temps (15:09-15:25). Le plus long : 794 ms chez Léa, 891 ms chez
  Marc. C'est le coût fixe du pilote : aucun salon n'a ralenti l'autre.
- **Aucune fuite** : Marc (« aucune trace des soirées de Nadia et Léa chez moi ») et Léa
  (« je n'ai entendu et vu que mes invités ») le disent. Chaque écran compte ses seuls
  invités (« 4 connecté·e·s » chez Léa, `lea-tele/015`). Inès figure au même moment dans
  deux soirées, sous le même profil et le même 🦉, et n'est marquée « (2) » nulle part
  (`lea-tele/015`, fiches des deux archives).
- **Des bases bien cloisonnées** (copie lue dans `copie-tablee/`) : chaque archive et
  chaque ligne d'expérience porte le `space_id` de son espace (`chez-marc`, `chez-lea`),
  et le crédit d'Inès chez Marc (91 XP) est arrivé pendant qu'elle attendait chez Léa,
  sans rien déranger.

## Ce qui plaît — à ne pas casser

- **Le format pour une IA** (Marc : « exactement l'outil dont j'avais besoin »). Tout a été
  compris du premier coup : le vrai/faux, les estimations avec leur unité (« = 1 240
  cafés », avec l'espace des milliers), les catégories, « Temps » placé après le « = »,
  « Photo », « Observation ». La photo rejoint sa question par son nom de fichier. Seule
  reprise : la bonne réponse des ballons, une erreur de Marc. Le quiz était jouable
  environ cinq minutes après l'activation (journal : 15:02:28 → 15:06:57).
- **« Coller une liste » au téléphone** (Léa : « LA fonction pour quelqu'un qui écrit ses
  questions dans ses notes ») et **l'aperçu**, qui lui a fait compter 3 mouettes et
  corriger ses notes, qui en disaient 5.
- **La console au téléphone pendant le quiz** : lancer, révéler, mettre en pause, régler
  l'enchaînement depuis le canapé, et la télé suit à la seconde. **« Suivante : au clic ·
  5 s · 10 s · 20 s »** s'applique tout de suite, même sur la révélation en cours (Marc,
  Léa).
- **La pause qui fige vraiment le chrono**, et le fait dire au téléphone (Bertrand :
  « pas de triche possible ni de temps perdu »).
- **La question à photo** est le meilleur moment des deux salons, et la seule sans
  barrière de langue pour Liam.
- **Entrer sans compte** : Bertrand (« un soulagement »), Maëlle sous pseudo, Liam « aux
  icônes », Zoé. **Le code de secours** a fait rentrer Malik en moins d'une minute, sans
  lui faire rater une question. **Le profil reconnu** d'un espace à l'autre, sans rien
  retaper (Inès).
- **La retardataire accueillie sans rien faire**, et le bilan qui explique « les 2
  premières questions ne comptent pas pour toi » (Maëlle, Rachid).
- **Rien ne bouge** avec « réduire les animations », et le téléphone couché reste lisible
  (Zoé).
- **Ce que les corrections du 23 ont apporté**, relevé sans qu'on le demande : le message
  quand l'animatrice change quelqu'un d'équipe (Malik, #29) ; « Remis ce soir-là » dans le
  souvenir et le bilan (#27) ; l'export qui dit quoi faire du fichier (Marc, #25) ; les
  gestes risqués de la console à l'écart, et « Reposer » confirmé (#26).
- **La clôture** : le QR du souvenir sur les deux écrans, que chacun scanne avant de
  partir (Léa).
- **Les prix calculés tout seuls** : quinze prix bien trouvés et bien formulés (Marc), et
  « ça ne se moque pas de moi, ça sourit avec moi » (Maëlle).

## Écarté : ce qui venait du banc

- **« Le chrono du téléphone continue pendant la pause »** (Liam). Ses deux captures
  (`liam/006` à 15:12:48, `liam/007` à 15:12:57) ont été prises **après** la reprise :
  Léa avait mis en pause à 15:12:24 et repris à 15:12:34. Le 29 s affiché est exact
  (question ouverte à 15:12:18, 50 s plus 10 s de pause). Le téléphone fige bien son
  chrono et affiche « En pause » (`PlayerView.tsx:246-251`), et Bertrand l'a constaté chez
  Marc. Seule sa tentative de réponse de 15:12:26 tombait dans la pause, et elle a été
  refusée à juste titre.
- **« Enregistrer ne confirme rien »** (Marc). Le toast « Réglages enregistrés » existe
  (`AccountApp.tsx:260`) et dure 4 s (`client/src/state.ts:159`) ; la capture de Marc
  arrive 5 s après son clic. Léa l'a vu (`lea/003`).
- **La photo à mémoriser manquée** (Bertrand). L'observation durait 8 s, vers 15:12:15
  (Inès la capture à 15:12:19) ; son geste « paysage » tombe à 15:12:22, sa capture
  suivante à 15:12:32. Le
  scénario (tourner la tablette à ce moment-là) et la lenteur de l'outil suffisent. Reste
  une idée : on ne peut pas revoir la photo avant la révélation.
- **Les deux questions perdues par Maëlle.** Elles viennent du scénario (derrière un
  poteau, une minute à attendre un lien Slack que l'agent Marc n'a pas envoyé) et de la
  lenteur des gestes. La faute de frappe sur l'adresse ne lui a coûté que 14 s (15:09:08
  → 15:09:21). Et **« revenir après être partie » n'a pas été éprouvé** : aucun geste
  `veille` ni `partir`, son téléphone est resté ouvert et a reçu sa fin de soirée en
  direct, à 15:21. À rejouer.
- **La Q4 perdue par Rachid.** Refaire l'entrée a pris 1 min 36 à l'agent (six gestes,
  15:11:10 → 15:12:46) ; un humain y mettrait une demi-minute. Le fond, lui, est retenu au
  constat 3.
- **« L'écran est noir »** au début chez Léa (Liam, Zoé, Malik) : la télé n'était pas
  encore allumée, et Léa préparait son quiz. C'est la même chose chez Marc.
- **Marc qui devine Fantomette à voix haute** : une affaire de salle, pas de
  l'application, qui n'a jamais montré son prénom.
- **La coupure de 15:26** n'a touché aucune des deux soirées (voir l'introduction).

## Les captures qui montrent le problème mieux que des mots

1. `export/tablee/2026-09-24-trois-salons/captures/lea/023-23-victoire-telephone.png` —
   « La coloc remporte le quiz » : Inès, 0 point, arrivée après le quiz, a divisé par deux
   la moyenne des invités (640), qui avaient gagné.
2. `export/tablee/2026-09-24-trois-salons/captures/lea-tele/015-tele-15-remise-prix.png`
   — Léa remet les prix depuis son téléphone, et la télé reste en « Salle d'attente ».
3. `export/tablee/2026-09-24-trois-salons/captures/rachid-bis/004-tele.png` — deux
   « Rachid » (⚽ 491, 🦁 186, hors ligne) ; Commercial compte trois membres et tombe à
   557.
4. `export/tablee/2026-09-24-trois-salons/captures/lea/009-09-temps-2050.png` — « Temps :
   2050 s », sans un avertissement.

Et, pour les accents, le rejeu :
`export/evaluations/verification/salons-marc-lea/accents-trois-polices.png` — le même
titre avec les deux Cormorant livrés, puis avec la serif du système.

## Les rejeux (dans `export/evaluations/verification/salons-marc-lea/`)

- `verdict-equipes.ts` — le verdict des équipes de Léa, relu comme l'historique le relit,
  avec et sans Inès (`cd server && npx tsx ../export/evaluations/verification/salons-marc-lea/verdict-equipes.ts`).
- `liste-temps.ts` — la liste de Léa, avec « Temps : 50 s » sur la première question
  seulement.
- `accents.mjs`, `accents-polices.mjs` → `accents-zoom-capture.png`,
  `accents-police.png`, `accents-trois-polices.png` — la police livrée, rendue par
  Chromium.
- `police-cmap.mjs` — ce que contient la police (lettres précomposées, tables).
- `copie-tablee/` — une copie des deux bases de la tablée, lue en lecture seule
  (archives, lignes d'expérience, quiz).

Aucun serveur démarré (les rejeux sont des fonctions pures et un Chromium), aucun geste
sur la régie en direct, aucun fichier du dépôt modifié.
