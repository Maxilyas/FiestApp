# Plusieurs animateurs sur un même serveur — rapport de l'expert UX administrateur et animateurs

## En bref

Le cloisonnement tient : sur 16 tentatives de l'animateur B pour atteindre ce qui
est à A (quiz, archives, carte d'un invité, commandes d'écran commun, jeton
d'invité, réglages, `/api/admin`), **aucune fuite** — tout répond 404/403 ou
est ignoré en silence (invariant 3). Se passer un quiz par fichier est **sans
perte** (photo, photo mémoire, catégories, durées, unité) et tient en trois
gestes. Ce qui coince est **le formulaire de création de compte** de `/admin`,
que chaque ami traverse : l'identifiant se remplit d'**une seule lettre** et le
tiret ne peut **pas se taper** dans l'adresse — Antoine corrige deux champs à
chaque compte, ou publie une adresse qu'il n'a pas voulue. Les trois
améliorations les plus rentables : (1) réparer ces deux champs (S) ;
(2) dire à l'ami désactivé, et à l'ami qui tape le mot de passe de son profil
sur `/connexion`, ce qui se passe vraiment (S) ; (3) donner une bibliothèque
de départ aux nouveaux espaces — les deux quiz livrés restent chez l'administrateur (S-M).

## Méthode

- Une heure et demie, seul dans mon conteneur, sur l'atelier de la tablée lancé
  `--sans-animateur` (serveur jetable, Chromium piloté par `pilote.mjs`).
- Appareils : `aa-admin` (portable 1366 × 768), `aa-admin-tel` (petit téléphone
  360 × 640), `aa-sarah` (téléphone, puis portable), `aa-tom` (portable) et
  `aa-tom-tel` (petit téléphone), `aa-julie` (portable).
- Comptes créés par l'interface de `/admin` (Sarah, Tom) ; Julie par l'API, avec
  les mêmes routes, pour aller plus vite à l'échange de quiz.
- Deux sondes, qui réutilisent `server/test/banc.ts` contre n'importe quel serveur :
  - `retours/2026-09-24/experts/scripts/admin-animateurs/sonde-cloisonnement.ts` :
    A joue et clôt une soirée (une archive), rouvre une soirée avec une invitée, puis B
    essaie d'atteindre tout ça par HTTP et par socket ;
  - `retours/2026-09-24/experts/scripts/admin-animateurs/sonde-suppression.ts` :
    une joueuse à profil gagne de l'expérience chez un animateur, que l'administrateur
    supprime ensuite ; on relit son profil avant et après.
- Lecture du code : `client/src/views/AdminApp.tsx`, `ActivateApp.tsx`,
  `AccountApp.tsx`, `server/src/auth/routes.ts`, `auth/store.ts`,
  `server/src/sockets.ts`, `server/src/api.ts`, `server/src/server.ts`.
- Pas couvert : deux soirées jouées **en même temps** à la main avec de vrais
  téléphones (la sonde le fait par socket), le changement d'adresse d'un espace
  en direct, et les consoles ouvertes par un profil quand on le détache
  (déjà testé par `console.test.ts`).

## Constats

### 1. L'identifiant du nouveau compte se remplit d'une seule lettre
- **Où** : `/admin`, « Créer un compte » — `client/src/views/AdminApp.tsx:277`.
- **Constat** : l'identifiant se déduit du prénom **seulement s'il est vide**
  (`if (!login) setLogin(…)`). À la première lettre tapée, il vaut « s » ; il
  n'est plus vide, donc il ne suit plus. « Sarah Lefèvre » donne l'identifiant
  **`s`**, « Tom » donne **`t`**. Au clic, le serveur refuse : « Identifiant : 2 à
  32 caractères, lettres, chiffres, point, tiret » — un message qui ne dit pas
  que c'est **trop court**, alors que « s » est bien une lettre.
- **Preuve** : `retours/2026-09-24/experts/captures/admin-animateurs-1-identifiant-une-lettre.png`
  (« Sarah Lefèvre » → identifiant « s », adresse « sarah-lefevre »). À rejouer :
  `/admin`, taper un prénom au clavier (le pilote tape lettre à lettre, comme une
  personne). Un prénom **collé** d'un coup, lui, remplit bien l'identifiant.
- **Qui ça touche** : l'administrateur, à **chaque** compte créé — le premier geste
  de l'accueil d'un ami.
- **Statut** : bug confirmé.
- **Piste** : suivre le prénom tant que l'identifiant n'a pas été retouché, comme
  l'adresse le fait déjà :
  ```tsx
  const [loginTouched, setLoginTouched] = useState(false)
  // …onChange du prénom
  if (!loginTouched) setLogin(normalizeSlug(e.target.value).replace(/-/g, '.'))
  // …onChange de l'identifiant
  setLoginTouched(true)
  ```
  Et un message qui dit la longueur : « Identifiant trop court : 2 caractères au moins ».
- **Priorité · effort** : P2 · S.

### 2. On ne peut pas taper de tiret dans « Nom dans l'adresse »
- **Où** : `/admin`, « Créer un compte » — `AdminApp.tsx:307`.
- **Constat** : chaque touche passe par `normalizeSlug`, qui retire les tirets
  **en fin de texte**. Taper « chez-tom » : à « chez- », le tiret disparaît, et
  on obtient **`cheztom`**. Seul le coller passe. Le compte de Sarah a été créé
  sous `/chezsarah` au lieu de `/chez-sarah` — et l'adresse est ce que porte le QR,
  ce qu'on dicte et imprime.
- **Preuve** : `pilote aa-admin ecrire "Nom dans l'adresse" "chez-tom"` →
  « Ses invités ouvriront …/cheztom » ; `coller` → `chez-tom`. Tableau des comptes :
  `/chezsarah`. (La fenêtre « Renommer » n'a pas le défaut : elle normalise à la fin.)
- **Qui ça touche** : l'administrateur, puis tous les invités de l'ami (une adresse
  moins lisible, et la changer ensuite casse les QR déjà imprimés).
- **Statut** : bug confirmé.
- **Piste** : garder le texte tapé, ne normaliser qu'à l'envoi et dans l'aperçu :
  ```tsx
  onChange={e => { setSlugTouched(true); setSlug(e.target.value.toLowerCase()) }}
  // aperçu : {normalizeSlug(slug) || '…'} ; envoi : slug: normalizeSlug(slug)
  ```
  Un test client (`client.test.ts`) peut rejouer la frappe lettre à lettre.
- **Priorité · effort** : P2 · S.

### 3. Le mot de passe du profil rattaché, tapé sur `/connexion`, échoue sans explication
- **Où** : `/connexion` (et `/host`, `/edit` déconnectés) — `server/src/auth/routes.ts:68`.
- **Constat** : Sarah rattache son profil (`sarah` / `sarah-profil1`) à son espace
  (compte `sarah` / `sarah-secret`) — même identifiant, deux mots de passe. Le
  README lui promet qu'elle « n'a plus qu'un mot de passe à retenir ». Quand
  « Me déconnecter » la renvoie sur `/connexion`, elle tape donc le seul qu'elle
  retient : « Identifiant ou mot de passe incorrect ». L'aide (« Tu as rattaché
  ton profil ? Connecte-toi depuis l'accueil ») est **sous le clavier** en 412 px.
- **Preuve** : `retours/2026-09-24/experts/captures/admin-animateurs-2-connexion-mot-de-passe-du-profil.png`.
  Étapes : rattacher un profil depuis `/compte`, « Me déconnecter », taper
  l'identifiant et le mot de passe du profil sur `/connexion`.
- **Qui ça touche** : chaque animateur qui a suivi le conseil de rattacher son profil.
- **Statut** : friction confirmée.
- **Piste** : sur `/api/auth/login`, si le compte refuse, essayer le profil du
  même identifiant **quand il est rattaché à un espace actif** (c'est la même
  porte que `/api/joueur/console`, même réserve d'essais) ; ou, au minimum, un
  message propre : « C'est le mot de passe de ton profil ? Entre par l'accueil »,
  avec le lien **au-dessus** du bouton. Garder un seul message d'échec pour ne
  rien dire de l'existence d'un compte.
- **Priorité · effort** : P2 · S (message) / M (porte unique).

### 4. Un compte désactivé ne se dit jamais désactivé
- **Où** : écran commun de l'ami (`HostApp.tsx:314`), `/connexion` (`routes.ts:68`),
  bouton « Lien » de `/admin`.
- **Constat** : Antoine désactive Tom pendant que son écran commun est ouvert.
  L'écran bascule en quelques secondes sur « Session fermée — reconnecte-toi » ;
  Tom retape son **bon** mot de passe → « Identifiant ou mot de passe incorrect ».
  Il croit l'avoir oublié. Antoine, lui, peut encore cliquer « Lien » sur la ligne
  désactivée : le lien rendu échoue à coup sûr (« Lien invalide ou expiré —
  demande un nouveau lien à l'administrateur ») — une boucle.
- **Preuve** : écran de Tom après désactivation (`pilote aa-tom texte`) : « Session
  fermée — reconnecte-toi » ; activation d'un lien créé pour Tom désactivé :
  `{"error":"Lien invalide ou expiré — demande un nouveau lien à l'administrateur"}`.
- **Qui ça touche** : l'ami désactivé (et Antoine, qu'on appellera).
- **Statut** : friction confirmée.
- **Piste** : un message distinct **après** vérification du mot de passe (on ne
  révèle alors rien à qui ne le connaît pas) : « Ton compte est en pause —
  vois avec l'administrateur ». Côté `/admin`, cacher « Lien » sur une ligne
  désactivée (ou le refuser : `routes.ts:249`, `if (target.disabledAt) 400`).
- **Priorité · effort** : P3 · S.

### 5. Un nouvel animateur arrive devant une bibliothèque vide
- **Où** : `/edit` d'un compte neuf — `EditorApp.tsx:311` ; `server/src/server.ts:252`.
- **Constat** : les deux quiz livrés (« Qui connaît le mieux [Prénom] ? », « Culture
  générale ») ne sont importés que dans l'espace par défaut. Julie arrive sur
  « Aucun quiz pour l'instant. Crée le premier ! » — rien sur « Importer un quiz »,
  ni sur l'existence des modèles. Or « Qui connaît le mieux [Prénom] ? » est
  précisément un **modèle à personnaliser**.
- **Preuve** : `/edit` de Julie (`pilote aa-julie`) ; `seedLibrary(store, defaultSpace)`
  seul appel.
- **Qui ça touche** : chaque ami animateur, à sa première soirée.
- **Statut** : friction.
- **Piste** : appeler `seedLibrary` (ou une variante par espace) à l'activation d'un
  compte ; ou, dans l'état vide, deux boutons : « Partir d'un modèle » (les quiz
  livrés) et « Importer le quiz d'un ami ».
- **Priorité · effort** : P2 · S-M.

### 6. `/admin` ne dit rien de ce qu'il se passe dans les espaces
- **Où** : tableau « Tous les comptes » — `AdminApp.tsx` ; `PublicAccount` n'a que
  `id, login, name, slug, role, status, createdAt, lastLoginAt`.
- **Constat** : avant de désactiver ou supprimer Tom, Antoine ne sait pas s'il
  **anime en ce moment** (la désactivation ferme son écran en pleine soirée), combien
  il a de quiz et de soirées archivées (la suppression les efface « sans retour »),
  s'il a rattaché un profil, ni si un lien d'activation attend et jusqu'à quand.
  La fenêtre de suppression renvoie à `npm run export` — une commande qu'on ne tape
  pas depuis un téléphone. Le lien d'activation, enfin, ne rappelle pas
  l'**identifiant** qu'il faudra retaper plus tard (`/compte` le montre, mais Sarah
  n'y reviendra pas avant d'en avoir besoin).
- **Preuve** : lecture de `routes.ts:227-234` et `AdminApp.tsx:148-215` ; fenêtre
  « Supprimer le compte de Tom ? » (`pilote aa-admin voir`).
- **Qui ça touche** : l'administrateur.
- **Statut** : idée (manque).
- **Piste** : trois colonnes de plus, calculées côté serveur sans rien lire des
  contenus : « soirée en cours » (oui/non), « quiz · soirées » (deux nombres),
  « profil rattaché » (prénom) ; « lien en attente, jusqu'au … » dans l'état. Dans
  la fenêtre du lien : « Son identifiant : **sarah** » à recopier avec le lien, et
  un bouton « Copier le message » (« Voici ton lien… ton identifiant est sarah »).
  Un bouton « Télécharger ses soirées » plutôt qu'une commande.
- **Priorité · effort** : P3 · M.

### 7. `/admin` au téléphone : les gestes sont hors de l'écran
- **Où** : `/admin` en 360 × 640.
- **Constat** : le tableau défile à l'horizontale dans sa carte : « Lien »,
  « Désactiver », « Supprimer » et la date de connexion sont hors champ, sans
  indice qu'il faut glisser.
- **Preuve** : `retours/2026-09-24/experts/captures/admin-animateurs-3-admin-au-telephone.png`.
- **Qui ça touche** : Antoine, qui reçoit « j'ai perdu mon lien » par message, sur son téléphone.
- **Statut** : friction confirmée.
- **Piste** : sous 600 px, une carte par compte (nom, adresse, état, puis les
  boutons sur une ligne) au lieu du tableau.
- **Priorité · effort** : P3 · S-M.

### 8. Supprimer un espace garde l'expérience de ses soirées
- **Où** : `removeAccount`, `server/src/server.ts:313-334`.
- **Constat** : Léa gagne 60 XP chez Tom ; Antoine supprime le compte de Tom. Après :
  toujours **60 XP**, et la soirée reste dans son historique, sans lien
  (`"chez": null, "slug": null`, que `ProfilApp.tsx:339` affiche proprement). Alors
  que retirer **une** soirée de l'historique reprend tout ce qu'elle avait rapporté
  (`api.ts:150`, invariant 10), supprimer **toutes** les soirées d'un espace ne
  reprend rien.
- **Preuve** : `sonde-suppression.ts` → `avant : xp 60 · chez "Tom"` ;
  `suppression : 200` ; `après : xp 60 · chez null`.
- **Qui ça touche** : les joueurs à profil ; un « espace d'essai » créé puis
  supprimé laisse ses gains.
- **Statut** : tension avec un parti pris (invariant 10 : « un palier ne se reprend
  que si la soirée qui l'a fait tomber est retirée »). Les deux se défendent : on
  ne punit pas les joueurs du départ d'un animateur, mais l'essai supprimé garde
  son expérience. À arbitrer, puis à écrire dans le README (« Les comptes et les
  espaces ») et dans la fenêtre de suppression.
- **Piste** : si l'on reprend : `retirerSoireeEntiere` pour chaque archive avant
  `archives.removeSpace`. Si l'on garde : le dire, et un test qui le fige.
- **Priorité · effort** : P3 · S.

### 9. L'activation et le lien déjà servi
- **Où** : `/activer` — `ActivateApp.tsx`.
- **Constat** : (a) le lien, rouvert une seconde fois (sur un autre appareil),
  dit « Lien invalide ou expiré — demande un nouveau lien à l'administrateur »,
  alors que le compte est actif et qu'il suffit de se connecter ; (b) la page ne dit
  ni **quel espace** on active ni l'**identifiant** — le gestionnaire de mots de
  passe enregistre un mot de passe sans nom ; (c) le jeton est retiré de l'adresse
  au premier affichage (voulu) : un rechargement avant d'avoir validé donne « Ce lien
  est incomplet ».
- **Preuve** : `pilote aa-tom:b` sur le lien déjà servi.
- **Statut** : friction.
- **Piste** : `consumeActivation` peut distinguer « déjà servi » (le compte a un
  mot de passe) → « Ce lien a déjà servi : connecte-toi » + lien `/connexion`.
  Afficher « Espace de Sarah — identifiant **sarah** » (le serveur le rend avec un
  `GET` du jeton, ou la page après succès) et un `<input autocomplete="username"
  hidden>` rempli. Garder le jeton en `sessionStorage` (sous try/catch) jusqu'à la réussite.
- **Priorité · effort** : P3 · S.

### 10. Se passer un quiz : parfait par fichier, impossible en texte
- **Où** : `/edit`, « Exporter » / « Importer un quiz » ; « Coller une liste ».
- **Constat** : par fichier, rien ne se perd — voir le tableau plus bas. Mais il
  n'existe pas de chemin inverse de la liste collée : on ne peut pas **copier un
  quiz en texte** pour l'envoyer dans une conversation (le format de liste sait
  pourtant tout dire : temps, photo par nom de fichier, observation, catégories).
  Et une photo n'est jamais « à nous » : B peut citer `/media/image/<id de A>` dans
  son propre quiz (la sonde le montre) — la photo disparaîtra quand A fera le ménage
  (`pruneImages` ne regarde que l'espace de A). Rien ne le fait sans le vouloir
  (l'import renvoie les photos), c'est une note, pas un défaut.
- **Statut** : idée.
- **Piste** : un bouton « Copier en liste » sur chaque quiz, qui écrit le
  `FORMAT_DE_LISTE` (l'inverse de `parseImportedQuestions`), relu par `liste.test.ts`
  (aller-retour sans perte).
- **Priorité · effort** : P3 · M.

### 11. Petites choses de `/compte`
- Les deux champs du profil (« Identifiant du profil », « Son mot de passe ») sont
  soulignés (`input-line`), tous les autres encadrés : la carte a l'air d'un autre
  écran (capture pleine page de `/compte` en 412 px).
- « Si tu n'en as pas encore, crée-le depuis l'accueil » sans lien vers l'accueil, et
  l'accueil, une fois le profil créé, ne ramène pas à `/compte` pour le rattacher. Quand
  les deux cookies sont là (session d'animateur **et** profil), les deux identités sont
  déjà prouvées : l'accueil pourrait proposer « Rattacher ce profil à ton espace » d'un geste.
- Le bouton « Rattacher » est sous le clavier en 412 px ; il faut fermer le clavier.
- « Il choisira son mot de passe » dans la fenêtre du lien : « Il ou elle », ou
  « Ton ami choisira… ».
- **Priorité · effort** : P3 · S.

## Mesures et cartes

### Parcours 1 — ouvrir un compte à un ami

| Pas | Qui | Geste | Remarque |
|---|---|---|---|
| 1 | Antoine | `/admin` (connecté) | |
| 2 | Antoine | taper le prénom | identifiant = 1 lettre (constat 1) |
| 3 | Antoine | **retaper** l'identifiant | |
| 4 | Antoine | **coller** l'adresse si elle a un tiret | constat 2 |
| 5 | Antoine | « Créer et obtenir le lien » | fenêtre : le lien, pas l'identifiant |
| 6 | Antoine | « Copier le lien », puis l'envoyer | hors application |
| 7 | Ami | ouvrir le lien | « Bienvenue — choisis ton mot de passe » |
| 8-9 | Ami | mot de passe ×2 | |
| 10 | Ami | « Activer mon compte » | arrive sur `/compte`, identifiant affiché |

**10 gestes, dont 2 de correction** qui n'existeraient pas sans les constats 1 et 2.
Lien perdu / mot de passe oublié : « Lien » sur la ligne → copier → l'ami choisit un
nouveau mot de passe : 3 gestes pour Antoine, 4 pour l'ami. L'ancien mot de passe
reste valable tant que le lien n'a pas servi (vérifié : connexion 200), puis toutes
les sessions tombent (`routes.ts:131`). Supprimer : « Désactiver » → confirmer →
« Supprimer » → confirmer : 4 gestes, deux fenêtres rouges. Bien.

### Parcours 2 — l'espace de l'animateur et son profil

| Étape | Gestes | Remarque |
|---|---|---|
| Créer son profil (accueil) | 6 (Créer un profil, 3 champs, Créer, C'est noté) | code de secours bien mis en avant |
| Aller à `/compte` | 1 (adresse tapée) | aucun lien depuis l'accueil |
| Rattacher | 3 (2 champs + Entrée, le bouton est sous le clavier) | le mot de passe tapé il y a une minute, redemandé |
| Revenir plus tard | 2 (accueil → « Animer ma soirée ») | la promesse tient |
| … par `/connexion` avec le mot de passe du profil | échec | constat 3 |

### Parcours 3 — le cloisonnement, sonde par sonde

`sonde-cloisonnement.ts`, B = Tom contre A = Sarah :

| Tentative de B | Résultat |
|---|---|
| `GET` / `PUT` / `DELETE` / `duplicate` du quiz de A | 404 ×4 |
| `PUT` / `DELETE /api/soirees/<archive de A>` | 404 ×2 |
| `/s/<B>/soirees/<archive de A>/recap.json` et `bilan.json` | 404 ×2 |
| `/s/<B>/joueurs/<invitée de A>.json` | 404 |
| `GET /api/admin/accounts` | 403 |
| bibliothèque de B | 0 quiz, rien de A |
| `PUT /api/space/settings` avec `slug`/`name` de A | l'espace de A inchangé |
| écran commun de B : `selectPack`, `renamePlayer`, `removePlayer`, `endSession` visant A | ignorés — Emma reste chez A, sous son prénom |
| jeton d'Emma présenté chez B (`player:join`) | `unknown-token` |
| réponse d'Emma envoyée chez B (`player:action`) | `unknown-player` |

**Aucune fuite.** Ce qui est public l'est par choix (README) : `/s/<espace>/soirees.json`
liste les soirées de n'importe quel espace dont on connaît le nom, prénoms compris,
et une photo se lit par son identifiant.

### Parcours 4 — se passer un quiz (Sarah → Julie)

| Champ | Chez Sarah | Chez Julie après import |
|---|---|---|
| photo (JPEG) | `/media/image/…` | nouvelle photo, nouvel identifiant |
| photo mémoire | 8 s | 8 s |
| catégories | Culture générale, Cinéma & séries, Géographie | identiques |
| durées | 45 / 60 / 30 s | identiques |
| estimation | 1997 « ans » | identique |
| QCM à 3 réponses | 3 réponses | 3 réponses (la 4ᵉ case vide du fichier ne gêne pas) |

3 gestes (Exporter · envoyer le fichier · Importer un quiz) ; message clair des deux
côtés (« est dans tes téléchargements… », « est dans ta bibliothèque : 3 questions,
1 photo »). Fichier de 23 Ko pour une photo.

### Parcours 5 — l'administrateur qui anime

`/compte` d'Antoine : « · administrateur » et un bouton « Les comptes » ; `/edit` a
aussi son lien vers `/admin` ; `/admin` renvoie vers « Mon compte » et « Écran
commun ». Les deux quiz livrés sont chez lui seul (constat 5). Il ne voit rien des
quiz ni des soirées de ses amis — par choix (`AdminApp.tsx:13`) — et c'est bien.

## Ce qui marche — à ne pas casser

- **Le cloisonnement** : un socket se lie à un seul espace, la session dit l'espace et
  jamais la page ; tout identifiant d'un autre répond « introuvable » (constat
  Parcours 3). La sonde peut devenir un test de `server/test/`.
- **Désactiver ferme vraiment** : les sessions tombent et l'écran commun ouvert se
  referme en quelques secondes ; l'adresse de l'espace dit aux invités « ne mène à
  aucune soirée » ; réactiver ne coûte qu'un clic.
- **Le lien d'activation** : dans le fragment, retiré de l'adresse, une seule fois, sept
  jours, l'ancien annulé par le nouveau, et l'ancien mot de passe reste bon tant que
  l'ami n'a pas choisi le nouveau.
- **La suppression** : deux pas (désactiver puis supprimer), deux fenêtres rouges,
  l'espace par défaut protégé, et le profil d'un joueur garde une soirée sans lien
  plutôt qu'un lien cassé.
- **« Animer ma soirée » depuis l'accueil** une fois le profil rattaché : deux gestes.
- **L'export/import** : sans perte, photos comprises, et un message qui dit où est le
  fichier et ce que l'ami doit en faire.

## Recommandations, dans l'ordre

1. Réparer l'identifiant déduit du prénom et le tiret de l'adresse dans « Créer un
   compte » (constats 1 et 2) — P2 · S.
2. Donner une bibliothèque de départ aux nouveaux espaces, et un état vide qui propose
   « Partir d'un modèle » / « Importer le quiz d'un ami » (constat 5) — P2 · S-M.
3. `/connexion` : accepter le mot de passe du profil rattaché, ou le dire (constat 3) — P2 · S.
4. Dire « compte en pause » à l'ami désactivé et retirer « Lien » d'une ligne
   désactivée (constat 4) — P3 · S.
5. Rappeler l'identifiant avec le lien d'activation, et traiter le lien déjà servi
   (constats 6 et 9) — P3 · S.
6. Arbitrer ce que la suppression d'un espace fait à l'expérience des joueurs, et
   l'écrire (constat 8) — P3 · S.
7. `/admin` au téléphone en cartes, et trois colonnes d'état (soirée en cours, quiz ·
   soirées, profil) (constats 6 et 7) — P3 · M.
8. « Copier en liste » pour se passer un quiz en texte (constat 10) — P3 · M.
9. Promouvoir `sonde-cloisonnement.ts` en test de `server/test/` (un serveur jetable,
   deux espaces) — P3 · S.

## Limites

- Les constats d'écran ont été faits sur Chromium émulé (412 et 360 px, 1366 × 768),
  pas sur un vrai téléphone : le clavier réel peut cacher plus ou moins.
- Je n'ai pas joué deux soirées **à la main** en même temps ; la simultanéité est
  vérifiée par socket (sonde) et par une soirée jouée chez A pendant que B agissait.
- Le changement d'adresse d'un espace (« Renommer ») n'a été lu que dans le code : la
  fenêtre prévient bien que les liens cassent, et aucune redirection de l'ancienne
  adresse n'existe.
- Je n'ai pas vérifié ce que `recalculerHistorique` fait, au démarrage suivant, des
  lignes d'expérience d'un espace supprimé (constat 8) : à regarder avant d'arbitrer.
