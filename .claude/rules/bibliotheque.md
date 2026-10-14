---
paths:
  - "shared/{library,echange,liste,modeles,emojis,partage,brouillon,categories,nombres,quizToutPret}.ts"
  - "server/src/core/{memoire,partages,quizStore,quizToutPret,seed}.ts"
  - "server/src/partages.ts"
  - "server/content/quiz/**"
  - "server/scripts/{migrate-library,rendu-quiz-tout-pret}.ts"
  - "client/src/brouillon.ts"
  - "client/src/views/EditorApp.tsx"
  - "client/src/components/{MesQuiz,Partage,ChampNombre,QuizToutPret,QuizToutPretADemande}.tsx"
  - "server/test/{bibliotheque,brouillon,echange,liste,editeur,editeur-allers-retours,editeur-pertes,enregistrement,entourage,partage,mes-quiz,categories,memoire,nombres,quiz-tout-pret,quiz-tout-pret-apercu,une-autre-question,console-tout-pret,tirage-sans-redite,emojis,gestes}.test.ts"
---

# Les quiz : l'éditeur, la liste collée, l'import, le partage, la mémoire

## Les fichiers

- `shared/library.ts` — le format d'un quiz et ses bornes (`MAX_TITRE`, `MAX_TEXT`, `MAX_QUESTIONS`…) ; `normalizeQuestions`, ce que le serveur garde d'une question — à la création, à l'enregistrement, à la lecture en base, à la reprise d'un brouillon ; `toPlayable` et `questionProblem`, jouable ou « à compléter », et pourquoi ; la durée estimée, la recherche et le résumé de « Mes quiz » ; la liste collée (`parseImportedQuestions`)
- `core/quizStore.ts` · `server/src/api.ts` — la bibliothèque dans la base permanente (`quizzes`, `quiz_images`, `meta`) et ses routes, derrière la session de compte : `/api/quizzes…`, `/api/modeles…`, `/api/quiz-tout-pret…`, `/api/images`, `/api/programmes…` ; et `/media/image/:id`, public — l'UUID est la permission —, qui sert les photos **et** les extraits du blind test, rangés dans la même table
- `client/src/views/EditorApp.tsx` · `components/MesQuiz.tsx` — « Mes quiz » (`/edit`) : des cartes, une fiche par quiz (`/edit?fiche=…` : « Lancer », « Modifier les questions », puis Dupliquer, Partager par un code, Exporter en fichier, Proposer au catalogue, Archiver, et « Supprimer ce quiz » seul en bas), deux feuilles (« Créer un quiz » et ses six choix, « Trier et filtrer ») ; l'éditeur (`/edit?quiz=…`), ses cartes, l'aperçu, « Régler tout le quiz », « Coller une liste » (`BulkImport`) et « Préparer la demande pour une IA ». ▶ et « Lancer » ouvrent un salon sur le quiz (`/salon?quiz=…`) : le programme de ce soir se choisit là, plus ici (`mes-quiz.test.ts`). Sans compte d'animateur, la page ouvre la console par le profil (`ouvrirParLeProfil`)
- `shared/echange.ts` — un quiz qu'on emporte : le fichier d'export (questions, et toutes leurs pièces en clair — photos, extraits), celui de toute la bibliothèque (`fiestapp-bibliotheque`), sa lecture, et l'import, qui repasse par l'envoi d'image et la création de quiz — le navigateur et les tests par le même chemin
- `shared/liste.ts` — « Coller une liste » vue d'ailleurs : le format complet qu'on copie pour un ami ou une IA, écrit à partir des bornes et des catégories, et la demande toute faite pour une IA (`demandePourIA`) ; les photos jointes qui rejoignent leur question par leur nom de fichier (`photoAttendue` en attendant) ; et l'inverse, `ecrireListe` (« Copier en liste »), que `liste.test.ts` recolle
- `shared/brouillon.ts` · `client/src/brouillon.ts` — le brouillon d'un quiz : ce que l'éditeur garde dans le navigateur tant que le serveur n'a pas enregistré, relu comme le serveur relit (`normalizeQuestions`)
- `shared/nombres.ts` · `components/ChampNombre.tsx` — un nombre tapé par un humain, lu comme on l'écrit en France (« 35 000 », « 0,8 », « −40 ») : l'estimation au téléphone, la cible de l'éditeur, l'import d'une liste — une seule lecture ; et le champ d'entier qui garde ce qu'on tape et ne borne qu'en le quittant
- `shared/categories.ts` — la liste fixe des douze catégories, la même chez tous les animateurs
- `shared/modeles.ts` · `core/seed.ts` · `shared/emojis.ts` — les onze modèles sont des fichiers de `server/content/quiz/`, relus du disque à chaque demande (`lireModeles`) : deux rayons (`fete`, `jeu`), « Pour qui ? » sur cinq d'entre eux (`personnaliser`, que `shared/modeles.ts` remplace — prénoms, accords) ; seuls les deux marqués `"amorce": true` entrent, une fois par base, dans la bibliothèque de l'administrateur (`seedLibrary`, drapeau `seeded`), sans réglages. La règle des emojis d'avant Unicode 13, que l'éditeur dit sur la carte et que `emojis.test.ts` garde
- `core/memoire.ts` — la mémoire des quiz : « joué 3 fois », « trouvée par 3 sur 13 », le tirage des jamais posées — dérivée des fiches des soirées (`jeux`), jamais des archives entières
- `shared/quizToutPret.ts` · `core/quizToutPret.ts` · `components/QuizToutPret.tsx` — un quiz tout prêt, tiré de la base de la campagne (le choix du 11 octobre 2026 : les soirées n'avaient que les onze quiz livrés). Il se propose dans « Créer un quiz », en tête des premiers pas d'une bibliothèque sans quiz prêt, dans « Ajouter un quiz » du salon, et à l'écran commun — « Choisis un quiz », où il se lance composé (`selectPack`, la bibliothèque relue avant la réponse), et la salle d'attente d'une bibliothèque vide (`console-tout-pret.test.ts`). La feuille (chargée à la demande, `QuizToutPretADemande.tsx`) : catégories ou sujet, difficulté, nombre, « Des estimations », « Des enfants jouent » ; le dernier choix retenu sur le téléphone (`choixRetenu`, sous try/catch) ; et ce que la base donnera vraiment, par un aperçu du même tirage qui n'écrit rien (`POST /api/quiz-tout-pret/apercu`, `resumeDuQuiz`, `quiz-tout-pret-apercu.test.ts`). Le serveur tire (`composerUnQuiz`, une dérivation pure) dans `CampagneStore.pourLesSoirees` — ni retirée, ni de la réserve du quiz du jour — selon les marches de `planDuQuiz` (jamais d'experte hors d'un quiz corsé, ni de vrai ou faux expert ; dans une époque, jamais le QCM d'années que le titre souffle, `souffleeParLEpoque`), les catégories puis les sous-thèmes à tour de rôle, sans deux jumelles quand il y a mieux (`core/jumelles.ts`, `tirage-sans-redite.test.ts`), rien de la bibliothèque, quiz archivés compris — par l'identifiant et par l'intitulé, car un quiz importé d'un fichier change d'identifiants —, les jamais posées d'abord ; les réponses soufflées par leur racine en dernier recours (`soufflee`, règle `campagne-base.md`). « Des enfants jouent » prend d'abord ce qu'un enfant connaît (`pourUnEnfant`) : l'âge minimum de la base dit ce qu'il comprend, pas ce qu'il sait — filtré seul, Tarantino entrait. Ses estimations — une sur cinq (`UNE_ESTIMATION_SUR`), jamais la première, montées de la plus facile à la plus dure dans les marches de ses QCM (`MARCHES_DES_ESTIMATIONS`) — ne viennent que de questions dont la bonne réponse est la `valeur`, et pas d'un numéro, d'un petit entier que toute la salle sait, ni d'un intitulé qui suppose des choix (`lireLEstimation`, qui dit pourquoi) : leur nombre dans la base se recompte, il ne se recopie pas. Chaque question garde l'identifiant de la base, préfixé (`idDansLeQuiz`, `base-…`) : la mémoire des soirées la suit, même dans un quiz supprimé ; sa marche, que le quiz ne garde pas, vient de la mémoire du quiz (`MemoireDuQuiz.marches`). Le quiz se range comme une copie de modèle (réponses mélangées, titre libre) ; dans l'éditeur, « Une autre » tire la voisine d'une question de la base (`uneAutreQuestion`, `POST /api/quiz-tout-pret/une-autre`, rien d'écrit, `une-autre-question.test.ts`) — `server/scripts/rendu-quiz-tout-pret.ts` photographie la feuille, l'éditeur, le salon et l'écran commun
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
- **Un champ de plus à une question passe d'abord par `normalizeQuestions`** :
  sans lui, le serveur le jette à l'enregistrement, et le brouillon aussi.
  Puis par la liste collée (ci-dessous), par `PIECES_DE_QUESTION` si c'est une
  pièce, par `toPlayable` et `Entourage` s'il se joue — et par la décision de
  ce qui part aux téléphones (invariant 1). `POST /api/quizzes` (création,
  import) refuse plus de cent questions en le disant et borne le reste en
  silence ; `PUT` avec `base` refuse aussi un temps, une observation ou une
  cible hors bornes (`horsBornesALEnvoi`) — sans `base` (une page d'avant),
  il borne et coupe sans rien dire.
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
