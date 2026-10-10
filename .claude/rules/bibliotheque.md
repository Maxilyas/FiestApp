---
paths:
  - "shared/{library,echange,liste,modeles,emojis,partage,brouillon,categories,nombres}.ts"
  - "server/src/core/{memoire,partages,quizStore}.ts"
  - "server/src/partages.ts"
  - "client/src/brouillon.ts"
  - "client/src/views/EditorApp.tsx"
  - "client/src/components/{MesQuiz,Partage,ChampNombre}.tsx"
  - "server/test/{bibliotheque,brouillon,echange,liste,editeur,editeur-allers-retours,editeur-pertes,partage,mes-quiz,categories,memoire,nombres}.test.ts"
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
