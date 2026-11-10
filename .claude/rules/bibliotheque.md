---
paths:
  - "shared/{library,echange,liste,modeles,emojis,partage,brouillon,categories,nombres,quizToutPret}.ts"
  - "server/src/core/{estimation,memoire,partages,quizStore,quizToutPret,seed}.ts"
  - "server/src/partages.ts"
  - "server/content/quiz/**"
  - "server/scripts/{migrate-library,rendu-quiz-tout-pret,rendu-mes-quiz,rendu-editeur}.ts"
  - "client/src/brouillon.ts"
  - "client/src/views/EditorApp.tsx"
  - "client/src/components/{MesQuiz,Partage,ChampNombre,QuizToutPret,QuizToutPretADemande}.tsx"
  - "server/test/{bibliotheque,brouillon,echange,liste,editeur,editeur-allers-retours,editeur-pertes,editeur-telephone,enregistrement,entourage,partage,mes-quiz,categories,memoire,nombres,quiz-tout-pret,quiz-tout-pret-apercu,une-autre-question,console-tout-pret,tirage-sans-redite,emojis,gestes}.test.ts"
---

# Les quiz : l'éditeur, la liste collée, l'import, le partage, la mémoire

## Les fichiers

- `shared/library.ts` — le format d'un quiz et ses bornes (`MAX_TITRE`, `MAX_TEXT`, `MAX_QUESTIONS`…) ; `normalizeQuestions`, ce que le serveur garde d'une question — à la création, à l'enregistrement, à la lecture en base, à la reprise d'un brouillon ; `toPlayable` et `questionProblem`, jouable ou « à compléter », et pourquoi ; la durée estimée, la recherche et le résumé de « Mes quiz » ; la liste collée (`parseImportedQuestions`)
- `core/quizStore.ts` · `server/src/api.ts` — la bibliothèque dans la base permanente (`quizzes`, `quiz_images`, `meta`) et ses routes, derrière la session de compte : `/api/quizzes…`, `/api/modeles…`, `/api/quiz-tout-pret…`, `/api/images`, `/api/programmes…` ; et `/media/image/:id`, public — l'UUID est la permission —, qui sert les photos **et** les extraits du blind test, rangés dans la même table
- `client/src/views/EditorApp.tsx` · `components/MesQuiz.tsx` — « Mes quiz » (`/edit`) : « Créer un quiz » à côté du titre, ses quiz en lignes dans une seule carte — la pastille, le nom, ses faits en morceaux entiers (`faitsDuQuiz`), ▶ —, une fiche par quiz (`/edit?fiche=…` : « Lancer », « Modifier les questions », puis Dupliquer, Partager par un code, Exporter en fichier, Proposer au catalogue, Archiver, et « Supprimer ce quiz » seul en bas), deux feuilles (« Créer un quiz » et ses six choix, « Trier et filtrer »), et les premiers pas d'une bibliothèque sans quiz prêt (`PremiersPas`) — `server/scripts/rendu-mes-quiz.ts` les photographie et les mesure aux six tailles d'un téléphone ; l'éditeur (`/edit?quiz=…`), ses cartes — dans l'ordre où on les remplit, une question sur un écran de téléphone (`QuestionCard`, `CarteDeQuestion`) —, l'aperçu, « Régler tout le quiz », « Coller une liste » (`BulkImport`) et « Préparer la demande pour une IA » — `server/scripts/rendu-editeur.ts` le mesure à huit tailles. ▶ et « Lancer » ouvrent un salon sur le quiz (`/salon?quiz=…`) : le programme de ce soir se choisit là, plus ici (`mes-quiz.test.ts`). Sans compte d'animateur, la page ouvre la console par le profil (`ouvrirParLeProfil`)
- `shared/echange.ts` — un quiz qu'on emporte : le fichier d'export (questions, et toutes leurs pièces en clair — photos, extraits), celui de toute la bibliothèque (`fiestapp-bibliotheque`), sa lecture, et l'import, qui repasse par l'envoi d'image et la création de quiz — le navigateur et les tests par le même chemin
- `shared/liste.ts` — « Coller une liste » vue d'ailleurs : le format complet qu'on copie pour un ami ou une IA, écrit à partir des bornes et des catégories, et la demande toute faite pour une IA (`demandePourIA`) ; les photos jointes qui rejoignent leur question par leur nom de fichier (`photoAttendue` en attendant) ; et l'inverse, `ecrireListe` (« Copier en liste »), que `liste.test.ts` recolle
- `shared/brouillon.ts` · `client/src/brouillon.ts` — le brouillon d'un quiz : ce que l'éditeur garde dans le navigateur tant que le serveur n'a pas enregistré, relu comme le serveur relit (`normalizeQuestions`)
- `shared/nombres.ts` · `components/ChampNombre.tsx` — un nombre tapé par un humain, lu comme on l'écrit en France (« 35 000 », « 0,8 », « −40 ») : l'estimation au téléphone, la cible de l'éditeur, l'import d'une liste — une seule lecture ; et le champ d'entier qui garde ce qu'on tape et ne borne qu'en le quittant
- `shared/categories.ts` — la liste fixe des douze catégories, la même chez tous les animateurs
- `shared/modeles.ts` · `core/seed.ts` · `shared/emojis.ts` — les onze modèles sont des fichiers de `server/content/quiz/`, relus du disque à chaque demande (`lireModeles`) : deux rayons (`fete`, `jeu`), « Pour qui ? » sur cinq d'entre eux (`personnaliser`, que `shared/modeles.ts` remplace — prénoms, accords) ; seuls les deux marqués `"amorce": true` entrent, une fois par base, dans la bibliothèque de l'administrateur (`seedLibrary`, drapeau `seeded`), sans réglages. La règle des emojis d'avant Unicode 13, que l'éditeur dit sur la carte et que `emojis.test.ts` garde
- `core/memoire.ts` — la mémoire des quiz : « joué 3 fois », « trouvée par 3 sur 13 », le tirage des jamais posées — dérivée des fiches des soirées (`jeux`), jamais des archives entières
- `shared/quizToutPret.ts` · `core/quizToutPret.ts` · `components/QuizToutPret.tsx` — un quiz tout prêt, tiré de la base de la campagne (le choix du 11 octobre 2026 : les soirées n'avaient que les onze quiz livrés). Il se propose dans « Créer un quiz », en tête des premiers pas d'une bibliothèque sans quiz prêt, dans « Ajouter un quiz » du salon, et à l'écran commun — « Choisis un quiz », où il se lance composé (`selectPack`, la bibliothèque relue avant la réponse), et la salle d'attente d'une bibliothèque vide (`console-tout-pret.test.ts`). La feuille (chargée à la demande, `QuizToutPretADemande.tsx`) : catégories ou sujet, difficulté, nombre, « Des estimations », « Des enfants jouent » ; le dernier choix retenu sur le téléphone (`choixRetenu`, sous try/catch) ; et ce que la base donnera vraiment, par un aperçu du même tirage qui n'écrit rien (`POST /api/quiz-tout-pret/apercu`, `resumeDuQuiz`, `quiz-tout-pret-apercu.test.ts`). Le serveur tire (`composerUnQuiz`, une dérivation pure — menée en tranches par ses routes, `composerUnQuizEnTranches` et `enTranches` : d'une traite, chaque aperçu de la feuille passait toute la base, et l'un d'eux a gelé la production 2,8 s le 7 novembre 2026 ; les mêmes questions au même hasard, `quiz-tout-pret.test.ts`) dans `CampagneStore.pourLesSoirees` — ni retirée, ni de la réserve du quiz du jour — selon les marches de `planDuQuiz` (jamais d'experte hors d'un quiz corsé, ni de vrai ou faux expert ; dans une époque, jamais le QCM d'années que le titre souffle, `souffleeParLEpoque` ; des années, des nombres, des jours : le rang de la bonne et ses leurres tirés comme en campagne, `reponsesAuRangTire` dans `versLeQuiz` — une soirée les montre rangés (`ordreDesReponses`), et la bonne y était sous ◆ ou ● neuf fois sur dix —, la version écrite gardée quand le tirage laisserait la bonne seule dans l'époque du titre), les catégories puis les sous-thèmes à tour de rôle — une spécialité une fois quand les autres passent trois fois, comme en campagne (`pasDuSousTheme`, règle `campagne.md`) —, sans deux jumelles quand il y a mieux (`core/jumelles.ts`, `tirage-sans-redite.test.ts`), rien de la bibliothèque, quiz archivés compris — par l'identifiant et par l'intitulé, car un quiz importé d'un fichier change d'identifiants —, les jamais posées d'abord ; les réponses soufflées par leur racine en dernier recours (`soufflee`, règle `campagne-base.md`). « Des enfants jouent » prend d'abord ce qu'un enfant connaît (`pourUnEnfant`) : l'âge minimum de la base dit ce qu'il comprend, pas ce qu'il sait — filtré seul, Tarantino entrait. Ses estimations — une sur cinq (`UNE_ESTIMATION_SUR`), jamais la première, montées de la plus facile à la plus dure dans les marches de ses QCM (`MARCHES_DES_ESTIMATIONS`) — ne viennent que de questions dont la bonne réponse est la `valeur`, et pas d'un numéro, d'un petit entier que toute la salle sait, ni d'un intitulé qui suppose des choix (`lireLEstimation`, qui dit pourquoi — sa règle vit dans `core/estimation.ts`, que le Filet du Cabinet lit aussi sans tirer le quiz du jour) : leur nombre dans la base se recompte, il ne se recopie pas. Chaque question garde l'identifiant de la base, préfixé (`idDansLeQuiz`, `base-…`) : la mémoire des soirées la suit, même dans un quiz supprimé ; sa marche, que le quiz ne garde pas, vient de la mémoire du quiz (`MemoireDuQuiz.marches`). Le quiz se range comme une copie de modèle (réponses mélangées, titre libre) ; dans l'éditeur, « Une autre » tire la voisine d'une question de la base (`uneAutreQuestion`, `POST /api/quiz-tout-pret/une-autre`, rien d'écrit, `une-autre-question.test.ts`) — `server/scripts/rendu-quiz-tout-pret.ts` photographie la feuille, l'éditeur, le salon et l'écran commun
- `shared/partage.ts` · `core/partages.ts` · `server/src/partages.ts` — partager, par copie seulement : un code court (sept jours, annulable, trente en cours par espace, dix essais manqués par quart d'heure) et le catalogue que l'administrateur relit (`/admin#catalogue`) ; la copie est un instantané pris au geste, et la copie reçue recopie toutes les pièces de ses questions (`copierPhotos`)
- `server/scripts/migrate-library.ts` — `npm run migrate` : la bibliothèque d'une base à l'autre (le fichier local vers Turso), photos comprises, sans écraser l'espace d'un autre — mais ni les réglages (`reglages`), ni l'archivage (`archived_at`), ni les programmes, ni les partages

## Les pièges

- **L'éditeur n'envoie rien pendant qu'on écrit** : le serveur s'endort sous
  les doigts de l'animateur. Une écriture de l'éditeur qui se rejoue sans
  dommage passe par `auReveil` — « Enregistrer », et les photos jointes à une
  liste collée ; et une réponse qui arrive après deux minutes d'attente ne
  remplace l'éditeur que si rien n'a bougé depuis (`modifications`). La photo
  ou l'extrait qu'on joint depuis une carte n'y passe pas, et rejoint sa
  question par son identifiant (`changerParId`) : par sa position, elle
  tombait sur la voisine qu'on avait déplacée entre-temps. « Enregistrer » envoie
  la version d'où il part (`base`), un `jeton` que ses essais au réveil
  reprennent et le numéro de l'essai (`essai`) : le serveur répond 409 si le
  quiz a été enregistré ailleurs depuis — l'autre appareil —, jamais à un
  essai rejoué de son propre clic. Il enregistre un quiz à la fois, et un
  essai plus ancien que le dernier écrit ne réécrit rien : il rend le quiz
  en base. Ce dernier essai (`derniers`) ne vit qu'en mémoire : après un
  redémarrage, un faux conflit reste possible, que le brouillon rattrape.
- **La carte d'une question se lit dans l'ordre où on la remplit, et tient
  sur l'écran d'un téléphone** (le 10 novembre 2026 — le propriétaire : « Est
  ce que tu peux revoir l'onglet quiz maintenant ? Tu peux si tu le souhaites
  modifier la disposition et l'aspect si tu trouves cela nécessaire » ; ici
  aussi la disposition a changé, pas seulement les mesures). En 360 × 640,
  un QCM à quatre réponses faisait 1071 px de haut — un écran et deux tiers,
  1125 dans un quiz qui mélange ses réponses —, son intitulé à 287 px du
  haut de sa carte, sous cinq rangées : son numéro, deux de sortes, deux de
  gestes ; celui de la première question n'arrivait qu'à 588 px, au bas du
  premier écran, et un quiz de dix questions faisait dix-neuf écrans
  (12 077 px), vingt-cinq tiré de la base (15 956). Depuis : 541 px aux six
  tailles d'un téléphone, l'intitulé à 69 px du haut de sa carte, celui de
  la première question à 250 px (39 % de l'écran), dix questions en
  6 740 px, environ 6 600 tirées de la base.
  **La carte, de haut en bas** (`QuestionCard`), le même ordre sur tous les
  écrans : son numéro et sa sorte (`.question-head`), l'intitulé, les
  réponses, ses réglages courants deux à deux — le temps et la catégorie, la
  photo et l'extrait (`.question-reglages`) —, ce qui se règle rarement
  (`.question-replis`), ce qu'elle a à dire, puis ses gestes au pied, sous
  un filet (`.question-gestes` : monter, descendre, insérer, dupliquer,
  l'aperçu, « Une autre », supprimer). Un ordinateur y gagne aussi : 438 px
  au lieu de 526, 480 dans un quiz qui mélange.
  **Au téléphone** (600 px au plus), tout se resserre dans un seul bloc de
  `styles.css`, « L'éditeur d'un quiz, au téléphone », sous la classe de la
  page (`.editeur-quiz` — « Mes quiz » porte `.editor` aussi, et n'en sait
  rien), ses mesures en variables (`--eq-rang`, 44 px, la hauteur d'une
  rangée) : le numéro en pastille ronde, la sorte en sélecteur segmenté, une
  réponse par ligne sans cadre autour de son champ — c'est le champ de la
  bonne qui se teinte —, les gestes en icônes. Ce qu'il tait se cache à
  l'œil seulement (les déclarations de `.sr-only`) : « Question » devant son
  numéro, le nom d'« Aperçu », d'« Une autre » et de « Supprimer » sous leur
  icône (`.question-geste-nom`).
  **Un repli ne se décide pas dans la feuille de style** — un `<details>`
  fermé ne se rouvre pas par elle. La carte lit donc la largeur
  (`useTelephone`, la même borne), pour deux choses seulement : les réglages
  rares d'un QCM — ses sortes, « Garder cet ordre », « Mise de côté » — à
  plat à l'ordinateur, sous « Plus de réglages » au téléphone, où chaque
  pastille prenait sa rangée ; il arrive ouvert dès que l'un est posé — un
  réglage en vigueur ne se cache pas —, puis reste comme on le laisse : le
  refermer quand le dernier s'éteint le fermait sous le doigt. Et « Anecdote,
  note, intertitre », ouvert d'emblée à l'ordinateur s'il est rempli, replié
  au téléphone, son compte à côté de son nom (« · 2 ») : ouvert, il ajoutait
  391 px à chaque question d'un quiz tout prêt, qui arrivent toutes avec
  leur anecdote (1570 px la carte). La lecture vit dans la carte, pas dans
  la page : les cartes restent mémorisées (`CarteDeQuestion`).
  **La page** : une seule rangée entre l'en-tête et la première question —
  « Régler tout le quiz », et l'heure du dernier enregistrement à sa suite
  (sur sa ligne, elle descendait chaque carte de 36 px à chaque
  « Enregistrer ») ; ce que le quiz entier a à dire — son podium, ses bonnes
  réponses en premier — se lit sous les questions, au-dessus d'« Ajouter une
  question ». L'en-tête ne garde collée qu'une rangée, 53 px au lieu de 85 à
  107 : sa durée ne s'y montre que si elle tient à la suite de « prêtes »
  (`.editor-etat`, une rangée qui passe à la ligne, haute d'une seule) —
  « Mes quiz » la dit sur la ligne du quiz. Sous l'encoche d'un iPhone,
  l'application installée, le titre commençait à 22 px, sous elle, et la
  rangée collée s'y glissait : un cache de la hauteur de l'encoche, collé
  en haut de la page (`.editeur-quiz::before`), tient le titre dessous au
  repos et le couvre quand il s'en va ; la rangée collée s'arrête sous lui.
  Sans encoche, il ne fait aucune hauteur. Un vide laissé sous le titre
  l'aurait tenu aussi — 39 px de trou entre le titre et sa rangée, au
  repos.
  **Ce qui le tient** : `editeur-telephone.test.ts` rend la carte telle qu'un
  téléphone et un ordinateur la reçoivent (`CarteDeQuestion`, exportée pour
  elle) — chaque geste à son nom d'avant, dans son ordre — et relit la
  feuille ; `server/scripts/rendu-editeur.ts` mesure chaque carte à huit
  tailles et sort en erreur si la question type dépasse ce qui est atteint
  (`PLAFONDS`), si l'intitulé de la première question passe sous la moitié
  de l'écran, si une cible descend sous 44 px — six téléphones et une
  tablette ; cinq n'y arrivaient pas : la catégorie (27 px), le repli (32),
  l'extrait (37), « Annuler » (23), la case de la photo qui disparaît
  (24) —, un texte sous 11, un champ sous 16 (la liste collée s'écrivait à
  14,4 px), ou si la page déborde de côté. Ses photos d'une page entière ne
  passent pas par `fullPage`, qui rend au téléphone émulé un pointeur de
  souris (skill `regarder-le-rendu`). Un réglage de plus sur la carte prend
  sa place dans cet ordre — courant ou rare —, pas une rangée de plus sous
  la tête.
  **Ce qui reste** : la tête d'une question tirée de la base prend deux
  rangées au téléphone — sa marche à côté de son numéro, la sorte dessous
  (+ 40 px) ; une question à photo, à extrait et à observation fait encore
  1049 px (1846 avant) ; « Coller une liste », avec son mode d'emploi et son
  exemple, 1722 ; sur le plus étroit des téléphones (320 × 568), rien ne
  déborde, mais la sorte passe sous le numéro, la photo et l'extrait l'un
  sous l'autre, et l'en-tête garde deux rangées collées : 633 px ; au texte
  agrandi à 130 %, 689 px, de même ; là où le navigateur ne connaît pas
  `field-sizing` (l'intitulé qui grandit avec son texte — Chromium depuis
  2024), l'intitulé garde deux lignes et sa barre de défilement : 557 px.
  **L'aperçu d'une question**, sur un téléphone, garde les deux colonnes de
  l'écran commun en plus petit (15 px, des cases de 148 px, le bloc qui suit
  `.preview-frame .row`) : à 18 px dans des cases de 132, une réponse d'un
  mot s'y coupait par syllabes — « Can-berra », « Mel-bour-ne » sur trois
  lignes ; le script le dit (« une réponse d'un mot se coupe »). Un mot de
  plus de douze lettres s'y coupe encore.
- **Un champ de plus à une question passe d'abord par `normalizeQuestions`** :
  sans lui, le serveur le jette à l'enregistrement, et le brouillon aussi.
  Puis par la liste collée (ci-dessous), par `PIECES_DE_QUESTION` si c'est une
  pièce, par `toPlayable` et `Entourage` s'il se joue — et par la décision de
  ce qui part aux téléphones (invariant 1). `POST /api/quizzes` (création,
  import) refuse plus de cent questions en le disant et borne le reste en
  silence ; `PUT` avec `base` refuse aussi un temps, une observation ou une
  cible hors bornes (`horsBornesALEnvoi`) — sans `base` (une page d'avant),
  il borne et coupe sans rien dire.
- **« Mes quiz » ne relit que les quiz qui ont changé** (`QuizStore.list`,
  le 3 novembre 2026) : la ligne de chaque quiz, sans ses questions, et le
  résumé gardé sous sa version (`resumes`, `versionDe` : `updated_at`, la
  longueur de ses questions comptée par la base, ses réglages) — les
  questions des seuls quiz dont la version a bougé. Elle relisait toute la
  bibliothèque à chaque ouverture, la normalisait et la résumait d'une
  traite : 420 Ko et 1 160 questions pour la plus grosse de la production,
  25 ms de processeur au banc, deux à quatre fois plus à froid — une route
  rare l'est presque toujours —, et la sonde des gels relevait « Mes quiz »
  seul pendant des gels de 1,5 à 2,4 s, au dixième de cœur de l'hébergeur
  (`retours/2026-11-03/reproductions/liste-des-quiz.ts`). La bibliothèque
  relue au démarrage et après chaque écriture d'un espace (`allBySpace`,
  `all`) les résume au passage, et la mémoire des quiz relue au démarrage
  pour le tirage se garde pour la première lecture de chaque espace
  (`ArchiveStore.memoiresDeTous`) : la première ouverture d'un réveil ne
  relit ni l'une ni l'autre. Le titre et l'archivage se lisent sur la ligne
  — archiver n'avance pas `updated_at`. **Une écriture de plus dans
  `quizzes.questions` avance `updated_at`**, comme `create` et `save` : sans,
  et à longueur égale, la liste garderait le résumé d'avant
  (`bibliotheque.test.ts`).
- **« Mes quiz » se lit en lignes, et sa fiche tient sur un écran** (le
  10 novembre 2026 — le propriétaire : « revoir l'onglet quiz […] modifier la
  disposition et l'aspect si tu trouves cela nécessaire » ; ici, donc, la
  disposition a changé, pas seulement les mesures). En 360 × 640, la liste
  ne montrait que trois quiz entiers sur dix (six en 390 × 844) : des cartes
  de 68 à 128 px — un nom sur trois lignes, les faits sur deux, « à
  compléter » sur la sienne —, la première à 247 px du haut, sous un gros
  bouton « Créer un quiz » ; la fiche d'un quiz défilait de 448 px (226 en
  390 × 844) pour sept gestes, la feuille « Créer un quiz » de 144,
  « Trier et filtrer » de 76. Depuis :
  **la liste** est une seule carte, une ligne par quiz (56, 60 ou 64 px
  selon la hauteur de l'écran), son nom sur une ligne, coupé au bout — sa
  fiche le dit entier —, puis ses faits en morceaux (`faitsDuQuiz`,
  `.quiz-carte-faits`) : chacun entier ou pas du tout, jamais un « ≈ 2 mi… »,
  et dans l'ordre de ce qui presse — ce que la recherche a trouvé, les
  modifications qui attendent dans ce navigateur, « à compléter », puis les
  questions, la durée, « joué 2 fois » ; « 10 à compléter » dit déjà
  qu'aucune n'est prête, et « 0 question » ne le suit plus. Huit quiz
  entiers en 360 × 640, neuf en 390 × 844, dix en 412 × 915.
  **« Créer un quiz »** est à côté du titre, une pastille d'or de 44 px : la
  niche du compagnon ne se pose pas sur cette page (`LISENT_LE_PROFIL`,
  `main.tsx`), le coin est libre — le jour où elle y vient, il ne l'est
  plus. Ce que la tête dit de plus se tait à l'œil quand la hauteur
  manque : combien de quiz sous 820 px, « Animer » sous 720.
  **La fiche**, étroite (700 px au plus) ou courte (moins de 820 px de
  haut), pose son emblème à côté de son nom, « Lancer » et « Modifier »
  côte à côte — « les questions » ne se cache qu'à l'œil (`.fiche-suite`),
  et un quiz qui ne se lance pas garde son seul geste entier —, ses gestes
  rares sur 48 px, leur phrase sur une ligne ; sous 720 px, sur 44, leur nom
  seul, la phrase à l'oreille : elle ne défile plus, des six tailles d'un
  téléphone à un portable en 1366 × 768. Une tablette garde la fiche
  centrée d'avant.
  **Les deux feuilles** se resserrent sous leur classe (`.feuille-creer`,
  `.feuille-trier`, que `Feuille` pose) : leurs choix tiennent sans défiler.
  **Ce bloc vit après les règles de base d'une feuille** : `feuilles.test.ts`
  lit la première règle `.carte-corps {` de `styles.css`, et un
  `.feuille-creer .carte-corps {` posé plus haut répondait à sa place —
  l'épreuve rougissait pour une feuille qui n'avait pas changé.
  **Les premiers pas** montent les trois autres départs (« Coller une
  liste », « Importer le quiz d'un ami », « Créer mon quiz ») sous le quiz
  tout prêt, au-dessus des modèles : les quatre finissent à 494 px pour 575
  visibles en 360 × 640, le catalogue des modèles se lit dessous — il
  défile par nature. « Créer mon quiz » n'y est plus d'or : celui de la tête
  et celui du quiz tout prêt suffisent. Rouverts depuis « Créer un quiz »
  (« Partir d'un modèle »), les modèles se referment d'en haut, « Fermer » à
  côté de leur titre (`.premiers-pas-tete`, `aria-label="Fermer les
  modèles"`) : leur seul bouton attendait au bout du catalogue, à 2 100 px
  sur un téléphone ; il y est resté aussi, pour qui a tout lu.
  Les mesures sont des variables posées sur `.mes-quiz` (`--quiz-*`), à deux
  pas de hauteur (819 et 719 px) et pour toute largeur : un portable de
  768 px de haut a la fiche d'un téléphone moyen. Un quiz touché au doigt
  n'allume plus le geste venu sous lui (`.fiche-geste:hover`, sous
  `@media (hover: hover)` : « Dupliquer » paraissait choisi à l'ouverture de
  la fiche). `mes-quiz.test.ts` garde les morceaux, la feuille et ses pas ;
  `server/scripts/rendu-mes-quiz.ts` compte, taille par taille, les quiz
  entiers de la liste (`QUIZ_ENTIERS`) et sort en erreur s'il y en a moins,
  si la fiche ou une feuille défile, si une cible descend sous 44 px ou un
  texte sous 11. Ce qui reste : « Fermer », en tête de toute feuille de
  l'application, fait 40 px (`Feuille`, d'avant) ; la phrase d'un geste rare
  se coupe au bout sur un téléphone étroit (« Pour un ami d'un autre
  serveur : les questio… ») ; le nom d'un quiz long ne se lit entier que
  dans sa fiche ; et le texte agrandi à 130 %, en 360 × 640, la liste montre
  sept quiz, la fiche défile de 56 px et « Créer un quiz » de 160 dans sa
  feuille — leurs lignes grandissent avec le texte, c'est voulu. Sur un
  écran de 320 px au texte agrandi, « Créer un quiz » passe sous le titre
  (`.bibliotheque-titre`, `flex-wrap`) plutôt que d'élargir la page.
- **Un réglage de plus à la liste collée** se lit dans
  `parseImportedQuestions`, s'annonce dans `FORMAT_DE_LISTE` et paraît dans
  son exemple, que `liste.test.ts` relit : le format copié pour une IA ne
  doit rien promettre que la liste ne sache lire. Et « Copier en liste »
  (`ecrireListe`) écrit ce qu'elle relira à l'identique : une ligne que la
  relecture lirait autrement prend une puce qu'elle retire
  (`ligneDeReponse`) — « - de 5 » perdait son signe.
- **La bibliothèque en mémoire se relit après chaque écriture** d'un espace
  (`refreshLibrary`, `server.ts`), et c'est elle que la console joue — sans
  les quiz archivés ni ceux qui n'ont aucune question prête ; une partie
  lancée garde sa propre copie. Deux écritures lancent deux relectures, qui
  reviennent de Turso à leur rythme : seule la dernière partie pose ce
  qu'elle a lu (`derniereRelecture`) — sinon la plus ancienne, revenue la
  dernière, remettait la version d'avant la correction. Le programme et la
  mémoire des quiz passent par la même.
- **Un quiz naît avec son origine** (`quizzes.origine`, le 4 novembre 2026 :
  le carnet des animateurs du QG compte d'où viennent les quiz prêts de
  chaque salon, règle `qg.md`) : la page envoie son chemin à
  `POST /api/quizzes` — `editeur` (« Un quiz vide »), `liste` (« Coller une
  liste »), `import` (un fichier) ; `lireLOrigineDuQuiz` lit tout le reste
  `inconnue` —, la route décide le sien (`modele`, `tout-pret`, `partage`,
  `catalogue` ; l'amorce, des modèles). « Dupliquer » et le rattachement
  d'un espace gardent celle de l'original. Une création de plus passe la
  sienne à `QuizStore.create` — sans elle, `null`, un quiz « d'avant » —, et
  ce qui crée ou retire un quiz passe par `QuizStore`, qui en tient le
  registre en mémoire (`quizDesEspaces`) : une écriture à côté laisserait le
  carnet compter un quiz effacé jusqu'au redémarrage.
- **Les identifiants des questions portent la mémoire** : « Dupliquer » les
  garde (la copie partage les « Posée le … » de l'original, et le tirage la
  croit déjà posée) ; un fichier importé et une question dupliquée dans
  l'éditeur en reçoivent de neufs ; « Une autre » ne garde de la question
  remplacée que son temps et son intertitre.
- **Une question a trois pièces à part** — sa photo, celle de la
  révélation, l'extrait d'un blind test (`PIECES_DE_QUESTION`,
  `shared/library.ts`) —, chacune sous une adresse `/media/image/…`. Ce qui
  emporte une question — l'export, un code de partage, le catalogue — les
  emporte toutes, et ce qui les vérifie — la reprise d'un brouillon — les
  vérifie toutes : la photo de la révélation oubliée restait l'adresse de
  l'autre espace, et partait au premier ménage du sien. Une quatrième pièce
  rejoint `PIECES_DE_QUESTION`, mais l'export la nomme à la main
  (`shared/echange.ts`) : sa forme dans `FORME` — le typage la réclame —,
  sa mise en clair dans `emporterQuiz`, sa nouvelle adresse dans
  `importerQuiz`. Oubliée là, elle se perd à l'import sans qu'un test
  rougisse : `variantes.test.ts` ne vérifie que les trois. Le ménage, qui ne passe qu'après un enregistrement ou
  une suppression de quiz, n'efface une pièce qu'une heure après qu'aucun
  quiz ne la cite plus (`orpheline_depuis`, posé par l'enregistrement qui la
  retire ou la suppression du quiz) — et jamais celle qu'une partie encore
  sur le disque, une soirée archivée ou un partage vivant cite
  (`photosProtegees`) : comptée depuis son envoi, la grâce laissait
  « Garder la mienne », sur l'autre appareil, citer une photo effacée. À
  l'import, une pièce d'un format refusé disparaît sans laisser de photo
  attendue — à l'inverse d'une pièce perdue à l'export ou à la copie d'un
  partage (`piecesPerduesEnRoute`) : la question peut se dire prête sans
  sa photo.
