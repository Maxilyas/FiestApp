---
paths:
  - "shared/{library,echange,liste,modeles,emojis,partage,brouillon,categories,nombres,quizToutPret}.ts"
  - "server/src/core/{memoire,partages,quizStore,quizToutPret}.ts"
  - "server/src/partages.ts"
  - "client/src/brouillon.ts"
  - "client/src/views/EditorApp.tsx"
  - "client/src/components/{MesQuiz,Partage,ChampNombre,QuizToutPret,QuizToutPretADemande}.tsx"
  - "server/test/{bibliotheque,brouillon,echange,liste,editeur,editeur-allers-retours,editeur-pertes,partage,mes-quiz,categories,memoire,nombres,quiz-tout-pret,quiz-tout-pret-apercu,console-tout-pret,tirage-sans-redite}.test.ts"
---

# Les quiz : l'éditeur, la liste collée, l'import, le partage, la mémoire

## Les fichiers

- `shared/echange.ts` — un quiz qu'on emporte : le fichier d'export (questions, et toutes leurs pièces en clair — photos, extraits), sa lecture, et l'import, qui repasse par l'envoi d'image et la création de quiz — le navigateur et les tests par le même chemin
- `shared/liste.ts` — « Coller une liste » vue d'ailleurs : le format complet qu'on copie pour un ami ou une IA, écrit à partir des bornes et des catégories, et les photos jointes qui rejoignent leur question par leur nom de fichier (`photoAttendue` en attendant) ; et l'inverse, `ecrireListe` (« Copier en liste »), que `liste.test.ts` recolle
- `shared/brouillon.ts` · `client/src/brouillon.ts` — le brouillon d'un quiz : ce que l'éditeur garde dans le navigateur tant que le serveur n'a pas enregistré, relu comme le serveur relit (`normalizeQuestions`, `shared/library.ts`)
- `shared/nombres.ts` — un nombre tapé par un humain, lu comme on l'écrit en France (« 35 000 », « 0,8 », « −40 ») : l'estimation au téléphone, la cible de l'éditeur, l'import d'une liste — une seule lecture
- `shared/categories.ts` — la liste fixe des catégories de questions, la même chez tous les animateurs
- `shared/modeles.ts` · `shared/emojis.ts` — les modèles livrés, leurs rayons et « Pour qui ? » ; la règle des emojis d'avant Unicode 13, que l'éditeur dit sur la carte et que `emojis.test.ts` garde
- `core/memoire.ts` — la mémoire des quiz : « joué 3 fois », « trouvée par 3 sur 13 », le tirage des jamais posées — dérivée des fiches des soirées (`jeux`), jamais des archives entières
- `shared/quizToutPret.ts` · `core/quizToutPret.ts` · `components/QuizToutPret.tsx` — un quiz tout prêt (le choix du 11 octobre 2026 : les soirées n'avaient que les onze quiz livrés, quand la base de la campagne compte plus de dix mille questions relues) : dans « Créer un quiz », en tête des premiers pas d'une bibliothèque vide (sous les onze modèles, il arrivait en douzième, à près de quatre écrans de téléphone ; « Par où commencer » le nomme), dans « Ajouter un quiz » du salon, et à l'écran commun — « Choisis un quiz », où il se lance composé (« Lancer 15 questions », au multiplicateur choisi : `selectPack` le trouve, la bibliothèque relue avant la réponse), et dont il devient le geste principal quand tout a été joué ce soir (les autres s'y rejouent, « Rejouer ») ; et la salle d'attente d'une bibliothèque vide, à la place de « Créer mon premier quiz » : les invités là, il s'y compose et s'y lance d'un toucher — la partie ouverte, il la choisit (`aLancer`, quinze secondes au plus) —, sinon il dit qu'il est prêt (`console-tout-pret.test.ts`) —, une feuille — ses catégories, la difficulté (facile, progressive, corsée), combien de questions, « Des estimations » (cochées d'office), « Des enfants jouent » (ce qu'un enfant connaît d'abord — l'âge de six ans, ou une facile de dix ans, `pourUnEnfant` —, même déjà posé ; le reste de dix ans, `AGE_DES_ENFANTS`, pour compléter seulement : l'`ageMin` de la base dit ce qu'un enfant comprend, pas ce qu'il sait, et filtré seul il gardait les trois quarts de la base, Tati et Tarantino compris ; « · en famille » au titre), puis les sujets de la campagne (`GrilleDesCategories`, `GrilleDesSujets` : la grille de la série, coupée en deux pour que la difficulté ne se cherche pas au fond de la feuille) —, tout réglé d'office — ou sur le dernier choix composé, retenu sur le téléphone et relu prudemment (`choixRetenu`, sous try/catch : une manche de plus pour la même tablée ne se rechoisit pas) —, « Composer » collé en bas sous ce qu'il composera et ce qu'il durera (`dureeDuQuizToutPretS`, le calcul de l'éditeur : l'animatrice se demande d'abord combien de temps ça dure) — ses catégories nommées, trois au plus (`nommerLesCategories`, comme le titre), et, l'aperçu du serveur venu un quart de seconde après le dernier toucher (`POST /api/quiz-tout-pret/apercu` : le même tirage, rien d'écrit — `ApercuDuQuiz`), ce que la base en donnera vraiment : « dont 3 estimations », « 1 estimation seulement », « aucune estimation ici », « 12 questions seulement » — « Des estimations » promettait une question sur cinq, et dix-huit réglages sur cent trois en livraient moins sans rien dire (`resumeDuQuiz`, le 12 octobre 2026, `quiz-tout-pret-apercu.test.ts`) ; chargée à la demande, préchargée par la feuille qui y mène (`QuizToutPretADemande.tsx` : dix kilo-octets de moins au premier écran de la bibliothèque et du salon). Le serveur tire (`POST /api/quiz-tout-pret`, `composerUnQuiz`, une dérivation pure) dans ce que la campagne pose (`CampagneStore.pourLesSoirees` : ni retirée, ni de la réserve du quiz du jour), les marches du plan (`planDuQuiz` — jamais d'experte hors d'un quiz corsé, ni de vrai ou faux expert, un pile ou face de clôture ; dans une époque, pas le QCM d'années dont seule la bonne en est, que le titre soufflait, `souffleeParLEpoque`), sa difficulté lue comme en série (`niveauDeQuestion`, ses mesures comprises), les catégories à tour de rôle d'une marche à l'autre, puis leurs sous-thèmes, et jamais deux jumelles quand il y a mieux — la même forme d'intitulé, ou deux réponses en commun (`core/jumelles.ts`) : un quiz de géographie de vingt questions posait deux paires de jumelles, deux capitales, plus aucune (le 12 octobre 2026, `tirage-sans-redite.test.ts`) ; rien de sa bibliothèque, quiz archivés compris — par l'identifiant, et par l'intitulé : un quiz dupliqué change les identifiants —, d'abord ce que ses soirées n'ont jamais posé, puis le plus anciennement posé ; une marche qui manque emprunte à sa voisine. Les estimations — une question sur cinq (`UNE_ESTIMATION_SUR`), tirées d'abord, réparties, jamais la première (`placesDesEstimations`), trente secondes (`DUREE_D_UNE_ESTIMATION`) — viennent des questions dont la bonne réponse est leur `valeur` (`cibleDeLEstimation` : la base en donne aussi une à une question dont un nombre n'est qu'un détail), plus de dix ou à virgule — « Combien d'anneaux sur le drapeau olympique ? » se devine, ne s'estime pas —, ni un numéro (`NUMERO` : 814 n'est pas « presque » le vol 815), ni un petit entier qu'une facile fait savoir à tous (`PETIT_ENTIER_CONNU` : « 6 × 7 », soixante minutes — toute la salle finissait ex æquo ; il reste un bon QCM), d'un intitulé qui se lit sans les choix (ni « parmi », ni « laquelle »), une unité trop longue pour l'écran effacée seulement si l'intitulé la dit (« 66 », sans ses millions d'années, trompait la salle) ; des marches de son quiz, celles de ses QCM (`MARCHES_DES_ESTIMATIONS` : jamais une facile dans un quiz corsé, rien que des faciles dans un facile), sur leur propre plan, rangées de la plus facile à la plus dure — tirées au hasard des marches, une difficile tombait une fois sur trois à la quatrième question (`quiz-tout-pret.test.ts`, l'expert du quiz tout prêt, le 11 octobre 2026) ; six cent cinquante environ dans la base, dont cent quarante-six faciles — vingt-sept avant la vague de questions à nombre du 11 octobre 2026 (`consigne --nombres`, règle `campagne-base.md`), quand un quiz facile d'une seule catégorie n'en avait aucune —, et moins d'estimations quand le choix est étroit (un sujet sur trois n'a pas encore son compte). Chaque question garde l'identifiant de la base, préfixé (`idDansLeQuiz`, `base-…`) : la mémoire des soirées, qui suit les questions par leur identifiant, la reconnaît même dans un quiz supprimé depuis. Le quiz se range comme une copie de modèle — réponses mélangées à chaque partie, titre libre (« Histoire et Nature · 10 questions faciles (2) ») — et s'ouvre dans l'éditeur, ou rejoint le salon de ce soir ; `GET /api/quiz-tout-pret` dit ce que la base offre (`baseDesSoirees`) (`quiz-tout-pret.test.ts` ; `server/scripts/rendu-quiz-tout-pret.ts` photographie la feuille, l'éditeur et le salon)
- `shared/partage.ts` · `core/partages.ts` · `server/src/partages.ts` — partager, par copie seulement : un code court (sept jours, annulable, dix essais manqués par quart d'heure) et le catalogue que l'administrateur relit ; la copie reçue recopie toutes les pièces de ses questions (`copierPhotos`)

## Les pièges

- **L'éditeur n'envoie rien pendant qu'on écrit** : le serveur s'endort sous
  les doigts de l'animateur. Une écriture de l'éditeur qui se rejoue sans
  dommage passe par `auReveil` ; et une réponse qui arrive après deux minutes
  d'attente ne remplace l'éditeur que si rien n'a bougé depuis
  (`modifications`). L'envoi d'une photo n'y passe pas, et elle rejoint sa
  question par son identifiant (`changerParId`) : par sa position, elle
  tombait sur la voisine qu'on avait déplacée entre-temps. « Enregistrer » envoie
  la version d'où il part (`base`), un `jeton` que ses essais au réveil
  reprennent et le numéro de l'essai (`essai`) : le serveur répond 409 si le
  quiz a été enregistré ailleurs depuis — l'autre appareil —, jamais à un
  essai rejoué de son propre clic. Il enregistre un quiz à la fois, et un
  essai plus ancien que le dernier écrit ne réécrit rien : il rend le quiz
  en base.
- **Un réglage de plus à la liste collée** se lit dans
  `parseImportedQuestions`, s'annonce dans `FORMAT_DE_LISTE` et paraît dans
  son exemple, que `liste.test.ts` relit : le format copié pour une IA ne
  doit rien promettre que la liste ne sache lire. Et « Copier en liste »
  (`ecrireListe`) écrit ce qu'elle relira à l'identique : une ligne que la
  relecture lirait autrement prend une puce qu'elle retire
  (`ligneDeReponse`) — « - de 5 » perdait son signe.
- **La bibliothèque en mémoire se relit après chaque écriture** d'un espace
  (`refreshLibrary`, `server.ts`), et c'est elle que « Lancer » joue. Deux
  écritures lancent deux relectures, qui reviennent de Turso à leur rythme :
  seule la dernière partie pose ce qu'elle a lu (`derniereRelecture`) —
  sinon la plus ancienne, revenue la dernière, remettait la version d'avant
  la correction. Le programme et la mémoire des quiz passent par la même.
- **Une question a trois pièces à part** — sa photo, celle de la
  révélation, l'extrait d'un blind test (`PIECES_DE_QUESTION`,
  `shared/library.ts`) —, chacune sous une adresse `/media/image/…`. Ce qui
  emporte une question — l'export, un code de partage, le catalogue — les
  emporte toutes, et ce qui les vérifie — la reprise d'un brouillon — les
  vérifie toutes : la photo de la révélation oubliée restait l'adresse de
  l'autre espace, et partait au premier ménage du sien. Une quatrième pièce
  rejoint cette liste. Le ménage n'efface une pièce qu'une heure après
  qu'aucun quiz ne la cite plus (`orpheline_depuis`, posé par
  l'enregistrement qui la retire) : comptée depuis son envoi, la grâce
  laissait « Garder la mienne », sur l'autre appareil, citer une photo
  effacée.
