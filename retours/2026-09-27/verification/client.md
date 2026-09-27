# Contre-expertise — groupe `client` (client, bibliothèque, invariants)

*Code de `main` (b57035c ; HEAD a9ddd7f ne touche que `.claude/`), 27 septembre 2026.*

J'ai relu les 31 constats des trois rapports, rejoué 18 reproductions (dans
Chromium pour 11 d'entre elles) et écrit une reproduction de plus. Le client
construit pour l'occasion (`export/evaluations/verification/client/dist`) a
**les mêmes empreintes de fichiers** que ceux des deux experts : leurs rejeux
portaient bien sur le code de `main`.

**En bref.** Les trois rapports sont solides : aucun faux positif net, une
seule réfutation (client-10, dont le déclencheur annoncé ne se produit pas).
Trois gravités baissent :
- **bibliotheque-1** passe de P1 à P2. La perte est réelle, muette et
  définitive, mais rien sur le chemin normal ne mène à 101 questions.
- **bibliotheque-5** passe de P2 à P3 : le dégât se voit dans l'éditeur avant la soirée.
- **client-2** passe de P2 à P3 : un retard borné, sans rien de perdu.

Le constat sur les quiz livrés dans le quiz du jour (invariants-1) est une
**tension** documentée, comme l'a jugé la contre-expertise `jour` pour
jour-regles-13.

## Le tableau

| Constat | Annoncée | Verdict | Retenue | Pourquoi, en une ligne |
|---|---|---|---|---|
| client-1 · réponse perdue dans une liaison morte | P2 | confirmé | P2 | Rejoué : jamais reçue en 20 s. La copie corrigée la livre à 6,3 s sans nouveau toucher. |
| client-2 · « Révéler » perdu à la télécommande | P2 | confirmé, gravité revue | P3 | Rejoué. Le chrono ou le « tous ont répondu » révèle quand même, et l'animateur retouche après 15 s ; rien n'est perdu. |
| client-3 · « Clore » perdu pendant une reconnexion | P2 | confirmé | P2 | Rejoué, témoin vert. concurrence-11 en est le doublon (la contre-expertise `soiree` l'a rangé sous client-3). |
| client-4 · télé muette à la télécommande | P2 | confirmé | P2 | Rejoué : 0 contexte audio. `initAudio` n'a que 3 appelants, tous sur la page qui pilote. |
| client-5 · double clic sur « Attribuer » | P2 | confirmé | P2 | Rejoué : « +1 L'Éclair, +1 L'Éclair ». Visible dans « Prix déjà remis », mais la victoire peut basculer. |
| client-6 · recherches croisées | P3 | confirmé | P3 | Rejoué. |
| client-7 · salle d'attente vide avant l'entrée | P3 | confirmé | P3 | Rejoué. L'éclair dure un aller-retour. |
| client-8 · carte rouverte après le quiz | P3 | confirmé | P3 | Rejoué. |
| client-9 · déconnexion muette | P3 | confirmé | P3 | Rejoué : au rechargement, le profil est toujours ouvert. |
| client-10 · panne lue « adresse inconnue » | P3 | réfuté | P3 | La seule lecture faillible est déjà rattrapée (sockets.ts:282), et le délai est tu par la page. Reste un durcissement. |
| client-11 · minuteur de « Qui manque ? » | P3 | confirmé | P3 | Lecture ; coût négligeable. |
| client-12 · « Copier le lien » hors https | P3 | confirmé | P3 | Lecture : TypeError synchrone avant le `.catch`. |
| client-13 · boîte de clôture sans délai | P3 | confirmé | P3 | Rejoué (repro neuve) : aucune boîte en 30 s, ni au second toucher une fois la liaison revenue. |
| bibliotheque-1 · au-delà de 100 questions | **P1** | confirmé, gravité revue | **P2** | Rejoué partout. Mais modèles ≤ 15, demande à une IA ≤ 100, exports ≤ 100 : il faut coller deux listes ou tenir une banque. |
| bibliotheque-2 · photo sur la voisine | P2 | confirmé | P2 | Rejoué : la photo arrive sur « Première ? ». |
| bibliotheque-3 · « Garder la mienne » et le ménage | P2 | confirmé | P2 | Rejoué : 200, une photo citée qui répond 404. |
| bibliotheque-4 · brouillon : une pièce vérifiée sur trois | P2 | confirmé | P2 | Rejoué : [404, 404, 404], puis `photosAVerifier` ne rend que la photo. |
| bibliotheque-5 · anecdote sur deux lignes | P2 | confirmé, gravité revue | P3 | Rejoué. L'écart se voit dans l'éditeur (réponse en trop, « blocs ignorés ») avant toute soirée. |
| bibliotheque-6 · ce que la liste oublie | P3 | confirmé | P3 | Rejoué. |
| bibliotheque-7 · « - de 5 » perd son signe | P3 | confirmé | P3 | Rejoué (43 écarts sur 400 quiz). |
| bibliotheque-8 · deux versions au catalogue | P3 | confirmé | P3 | Rejoué. |
| bibliotheque-9 · pièce illisible, question « prête » | P3 | confirmé | P3 | Rejoué (6 verts, 1 rouge). |
| bibliotheque-10 · faux « autre appareil » | P3 | confirmé | P3 | Lecture. `reveil.ts` admet lui-même qu'un essai abandonné peut arriver. |
| bibliotheque-11 · `slice` dans l'export CSV | P3 | confirmé | P3 | Rejoué (sonde). Même ligne que la première puce d'invariants-6. |
| bibliotheque-12 · « (copie) » qui tombe | P3 | confirmé | P3 | Rejoué (sonde). |
| invariants-1 · quiz livrés dans le quiz du jour | P2 | tension | P3 | Rejoué, mais c'est un choix écrit trois fois, contre l'invariant 8. Recoupe jour-regles-13 (tension aussi). |
| invariants-2 · saisons et `VERSION_BAREME` | P3 | confirmé | P3 | Rejoué. À corriger **après** recompenses-comptes-1, sinon le recalcul tourne à chaque démarrage. |
| invariants-3 · le jeton lit les questions à venir | P3 | confirmé | P3 | Rejoué. MISE-EN-LIGNE.md:181 est faux ; recoupe jour-regles-13. |
| invariants-4 · règle de l'Arbre-Monde dans la doc | P3 | confirmé | P3 | Lecture : RECOMPENSES.md:402, CLAUDE.md:58. |
| invariants-5 · dix phrases périmées | P3 | confirmé | P3 | Contrôle par sondage : 4ᵉ jour à 8 questions dont 4 « Nature », 5ᵉ et 6ᵉ jours vides. |
| invariants-6 · cinq écarts à la lettre | P3 | confirmé | P3 | Lecture, les cinq relus. |

**Compte** : 26 confirmés, 3 confirmés à gravité revue, 1 réfuté, 1 tension,
0 doublon à retirer. Trois constats en recoupent d'autres, sans que rien soit
à retirer :
- client-3 est l'original de concurrence-11 ;
- invariants-2 est l'original de recompenses-comptes-7 ;
- la première puce d'invariants-6 est bibliotheque-11.

## Méthode

- **Lu** : les deux consignes, les trois fiches, les trois rapports et leurs
  JSON, les JSON des autres rapports et les contre-expertises déjà rendues
  (`securite`, `jour`, `recompenses`, `soiree`) pour les doublons.
- **Code relu** :
  - côté client : `client/src/socket.ts` (`verifierLiaison`, `demander`,
    `sendPlayerAction`), `sound.ts`, `HostApp.tsx` (appels à `initAudio`,
    `clore`, prix remis), `AwardsBoard.tsx`, `RemiseEnScene.tsx`,
    `PlayerApp.tsx` (`presenter`, `carte`, `spaceError`), `ProfilApp.tsx:376`,
    `Absents.tsx`, `AdminApp.tsx:59`, `copier.ts` ;
    `EditorApp.tsx` : recherche, `save`, `pickImage`, ajout, liste collée, tirage, anecdote ;
  - côté serveur : `server/src/sockets.ts` (`ecouter`, `party:watch`,
    `requireHost`, `host:awardTeam`), `server/src/api.ts` (PUT des quiz,
    `menageDesPhotos`), `core/quizStore.ts` (grâce, `duplicate`),
    `core/export.ts:195`, `core/jour.ts` (`amorcer`, `choisir`, `consigne`,
    liste d'administration), `core/divins.ts:67-192`, `quizDuJour.ts:262` ;
  - `shared/` : `library.ts` (bornes, `horsBornesALEnvoi`,
    `normalizeQuestions`, `texteLibre`), `liste.ts`, `brouillon.ts`,
    `hasard.ts`, `reveil.ts` ;
  - `socket.io-client` 4.8.3, `build/esm/socket.js:585-593` (`emitBuffered`
    avant `connect`) ;
  - la documentation : RECOMPENSES.md § 5.13 et l. 395-442, MISE-EN-LIGNE.md
    étape 8, README l. 128 et 199.
- **Rejoué** (un fichier à la fois, `nice -n 10`, charge de 0,5 à 2,6) :
  - `client/` : `reponse-trou-noir` (deux fois, puis avec
    `CLIENT_DIST=corrige/dist`), `telecommande-trou-noir`, `cloture-perdue`,
    `tele-muette`, `prix-double`, `recherche-croisee`, `petits-etats`,
    `deconnexion-muette` ;
  - `bibliotheque/` : `editeur-navigateur`, `enregistrer`,
    `aller-retour-liste`, `allers-retours`, `sonde-coupes.ts` ;
  - `invariants/` : `jour-modeles`, `saison-recalcul`, `jeton-reserve`,
    `categories-du-jour.ts`.
- **Écrit** : `export/evaluations/verification/client/boite-cloture.test.ts`
  (client-13). Relais en trou noir, puis un toucher sur « Clore la soirée »
  et un second une fois la liaison revenue.
- Rien n'est resté allumé : chaque test ferme son banc, son relais et son navigateur.

## Le raisonnement, constat par constat

### client-1 — une réponse touchée dans une liaison morte — **confirmé, P2**

- **Rejeu** : échoue pour la raison annoncée.
  - Chronologie : « Envoi… » à 0,3 s, « Ta réponse n'est pas partie » à
    8,4 s, bandeau à 14,7 s, reconnexion ; la réponse n'arrive jamais au
    serveur.
  - La copie corrigée (`corrige/`, la seule retouche de `socket.ts` : sonder
    avant de renvoyer) la livre à **6,3 s**. La piste est donc prouvée.
- **Chemin** :
  - `socket.ts:407-411` renvoie aussitôt. Le commentaire de `envoyer`
    (`:346-351`) dit lui-même que socket.io « l'écrit dans un transport mort,
    et elle est perdue ».
  - Au délai, rien n'appelle `verifierLiaison()`, contrairement à
    `demander()` (`:196-203`).
  - Le conseil affiché, « touche-la à nouveau », renvoie à son tour dans la
    liaison morte jusqu'au battement de cœur (`server.ts:225-226`, 10 + 8 s).
- **Réalité** :
  - Sous Android, un vrai passage du wifi à la 4G ferme d'ordinaire les
    sockets du wifi, et la reconnexion est alors franche.
  - Le trou noir, c'est le wifi saturé ou sans internet, le fond du jardin,
    la cave, le tunnel. En soirée, ce n'est pas rare.
  - Le dégât : les points d'un invité qui a touché à temps. P2 tient.
- **Correction** : celle de l'expert. Garder aussi sa seconde moitié
  (`verifierLiaison` rend la sonde en cours) : la copie corrigée ne l'a pas
  codée, et une sonde lancée par `visibilitychange` ferait sinon partir le
  renvoi sans l'attendre.

### client-2 — « Révéler » perdu à la télécommande — **confirmé, gravité revue P3**

- **Rejeu** : échoue comme annoncé (« reconnexion… » à 13,7 s, jamais
  révélée en 20 s).
- **Réalité** :
  - La question n'attend pas indéfiniment. Son chrono la révèle
    (`quiz.ts:1201`), comme le « tous ont répondu » (`'settle'`,
    `quiz.ts:1024`, `:1202`).
  - L'épreuve portait une question de 60 s ; une vraie en dure 20 à 30.
  - En enchaînement « au clic », la salle attend que l'animateur retouche
    après la reconnexion : 10 à 18 s.
  - Rien n'est perdu, et l'animateur voit que rien ne bouge.
  - C'est un hoquet, P3, pas une salle bloquée.
- **Correction** : la même famille que client-1. `demander()` avec accusé
  pour `host:command`, puis la sonde au délai. Le geste renvoyé porte déjà sa
  visée (invariant 12).

### client-3 — « Clore » pendant une reconnexion — **confirmé, P2**

- **Rejeu** : échoue. Le témoin (liaison tenue) passe.
- **Chemin** : `socket.io-client`, `socket.js:585-593` : `emitBuffered()`
  part **avant** `emitReserved("connect")`, donc avant le `host:hello` de
  `HostApp`, et `requireHost()` (`sockets.ts:700`) ignore le geste sans un mot.
- **Doublon** : c'est concurrence-11, que la contre-expertise `soiree` a déjà
  rangé sous client-3, à P2.
- **Gravité** :
  - La pastille « reconnexion… » est à l'écran au moment du clic, et l'absence
    de cérémonie de clôture se remarque. Le plus souvent, l'animateur retouchera.
  - Mais s'il referme l'ordinateur, la soirée reste ouverte : pas de fin aux
    téléphones, pas de hauts faits, et la suivante la continue (invariant 11).
  - P2 tient, au titre du concours de circonstances.
- **Correction** : celle de concurrence-11 vaut mieux, parce qu'elle répare
  tous les gestes d'un coup, côté serveur. `requireHost()` présente la
  connexion par le cookie de sa poignée de main, comme `host:hello`.
  Côté page, griser « Clore » tant que `!s.connected`.

### client-4 — la télé muette — **confirmé, P2**

- **Rejeu** : `{"contextes":0,"oscillateurs":0}` à la question. Le témoin
  (deux clics sur « Sons ») sonne.
- **Chemin** : `initAudio` n'a que trois appelants, tous des clics sur la
  page qui pilote (`HostApp.tsx:664`, `:694`, `:1554`). En mode
  télécommande, la télé ne voit aucun de ces clics.
  - Même un clic sur le plein écran ne l'ouvre pas.
  - `tone()` rend la main dès `!ctx` (`sound.ts:68`).
- **Réalité** :
  - Toute soirée animée au téléphone, mode mis en avant par « Brancher la
    télé », perd ses sons : le 3-2-1, le tic-tac, la révélation, la fanfare,
    la remise des prix.
  - L'icône de la télé dit « son allumé ».
  - Pas de données en jeu, mais une fonction entière éteinte dans un mode
    principal, pour une correction de quelques lignes. P2 tient.
- **Correction** : celle de l'expert (écouteurs `pointerdown`/`keydown` en
  capture), prouvée par la copie corrigée. On peut compléter :
  - dans `tone()`, `if (!ctx && navigator.userActivation?.hasBeenActive) initAudio()`,
    qui couvre un geste fait avant le montage de `HostApp` ;
  - pour la télé branchée par code, qui n'a jamais reçu de geste, dire
    « touche l'écran pour le son ».

### client-5 — double clic sur « Attribuer » — **confirmé, P2**

- **Rejeu** : `+1 L'Éclair, +1 L'Éclair`. Le témoin (prix libre) ne part qu'une fois.
- **Chemin** : `AwardsBoard.tsx:121-127` émet à chaque clic, et
  `sockets.ts:822-829` ajoute sans garde. « Redonner » veut qu'un même motif
  puisse revenir : le serveur ne peut donc pas dédoublonner sur le motif.
- **Nuance** :
  - Le doublon se voit dans « Prix déjà remis », avec un bouton pour le
    retirer (`HostApp.tsx:1168-1195`).
  - La télé n'annonce que le dernier prix.
  - Un point d'équipe de trop peut quand même retourner la victoire.
  - P2 au titre du concours de circonstances.
- **Correction** : celle de l'expert. Un identifiant de remise tiré au clic
  rend le geste idempotent ; « Redonner » en tire un neuf.

### client-6 à client-9 — **confirmés, P3**

- **client-6** : rejoué (« Fromages » sous « france »). Même motif à
  `AdminDuJour.tsx:94-100`.
- **client-7** : rejoué (`salle d'attente (« », 0 pt) → entrée`). L'éclair dure un aller-retour.
- **client-8** : rejoué (`carte à l'écran après le quiz : 1`).
- **client-9** : rejoué. Formulaire affiché sans un mot, et au rechargement
  le profil est toujours ouvert. Le cookie du profil ne se retire pas côté
  client, et c'est le téléphone prêté qui en pâtit.

### client-10 — panne lue « adresse inconnue » — **réfuté, P3 (durcissement)**

- Le chemin `ok:false → FormulaireSoiree` existe, mais « une panne du
  serveur » n'y mène pas :
  - la seule lecture faillible de `party:watch`, le profil dans la base
    permanente, est rattrapée (`sockets.ts:282`, `.catch(() => null)`) ;
  - un serveur muet fait **rejeter** `watchParty` (`demander`, `socket.ts:199`),
    et la page le tait (`PlayerApp.tsx:158-160`) ;
  - `OTHER_SPACE` suppose de passer d'un espace à l'autre sans recharger, ce
    que le client ne fait jamais (aucun `pushState` entre espaces).
- Ne reste qu'une exception de programmation dans `toPublic`, `bySlug` ou
  `bindSpace`. Distinguer le motif reste un durcissement bon marché.

### client-11, client-12 — **confirmés à la lecture, P3**

- **client-11** : `codes` n'est jamais purgé (`Absents.tsx:51-56`), et un
  panneau se redessine toutes les 5 s. C'est négligeable.
- **client-12** : hors https, `navigator.clipboard` est `undefined`, et
  `navigator.clipboard.writeText(...)` lève avant le `.catch`
  (`AdminApp.tsx:59`). Pas de toast, et la boîte qui montrait le lien s'est
  fermée. `copierTexte()` existe déjà.

### client-13 — boîte de clôture sans délai — **confirmé (rejoué ici), P3**

Ma reproduction (`verification/client/boite-cloture.test.ts`) : console
derrière le relais gelé, un toucher sur « Clore la soirée ».
- **Aucune boîte en 30 s**, alors que socket.io s'est reconnecté à 18,8 s.
- Un **second toucher**, liaison revenue : toujours pas de boîte en 15 s.
- Le `fetch(soirees.json)` (`HostApp.tsx:753`) reprend une connexion HTTP
  gelée du pool, et rien ne la borne.

Réserve : dans le relais, une connexion gelée ne se ferme jamais. Sur un vrai
réseau, le délai dépend du pool du navigateur (HTTP/2 chez Render) et du
délai TCP ; il peut atteindre des minutes. P3 : il faut une liaison morte à
l'instant de clore. La piste de l'expert est la bonne :
`fetch(url, { signal: AbortSignal.timeout(3000) })`, puis le titre par défaut.

### bibliotheque-1 — au-delà de 100 questions — **confirmé, gravité revue P2**

**Le rejeu échoue sur tous les chemins annoncés.**
- Chromium : « 120 questions reconnues » · 120 cartes · 100 après
  « Enregistrer » · 100 en base · aucune alerte.
- API : `PUT` 200 avec 100 ; `POST` 201 avec 100 ; `lireBrouillon` rend 100.
- Le chemin est sans ambiguïté :
  - `normalizeQuestions` coupe (`library.ts:785`) ;
  - `horsBornesALEnvoi` coupe aussi avant de juger (`:763`) et ne compte pas
    les questions ;
  - l'éditeur prend la réponse (`poser(saved)`, `EditorApp.tsx:1435`) ;
  - le brouillon relu est coupé lui aussi (`brouillon.ts:63`) : même sans
    « Enregistrer », un rechargement perd la 101ᵉ.

**Est-ce plausible ? Rarement.**
- **Modèles livrés** : de 8 à 15 questions (`server/content/quiz/*.json`).
  Le catalogue ne publie que des quiz déjà enregistrés, donc ≤ 100.
- **Import d'un fichier** : un export sort d'un quiz enregistré, donc ≤ 100.
  « Toute la bibliothèque » se relit quiz par quiz. Il faut un fichier fait
  à la main ou par un autre outil. Encore la perte n'est-elle pas définitive
  (le fichier reste), seulement l'avis ment : « 120 questions ».
- **Liste collée** : `parseImportedQuestions` ne borne rien. Mais la demande
  qu'on copie pour une IA plafonne à 100 (`liste.ts:360`), et le format
  l'annonce : « 100 questions au plus par quiz » (`liste.ts:150`).
  Le cas réaliste : **deux listes collées dans le même quiz**.
- **À la main** : « Ajouter », « Insérer » et « Dupliquer » n'ont pas de
  borne. Le tirage (« N sur {pretes} », jusqu'à 100, `EditorApp.tsx:2027-2033`)
  invite bien à tenir une banque. Mais l'expert éditeur du 24 septembre
  jugeait déjà 100 questions « très long » (35 écrans, frappe qui colle à
  148 ms).

**Ce que dit l'interface** :
- l'éditeur ne nomme la borne nulle part ;
- seul le compteur de l'en-tête passe de « 120/120 prêtes » à « 100/100 » ;
- la limite n'apparaît que dans le texte destiné à l'IA et dans la borne du
  nombre demandé.

**Verdict** : perte muette et définitive, mais sur un chemin marginal. Elle
touche peu d'animateurs, et aucune salle. P2.

**Correction** : celle de l'expert.
- Refuser plutôt que couper : l'éditeur borne l'ajout, la liste annonce le
  trop-plein.
- `horsBornesALEnvoi` teste `raw.length > MAX_QUESTIONS` **avant** son
  `slice`.
- Le même refus sur `POST /api/quizzes`, que l'import emprunte et que
  `horsBornesALEnvoi` ne garde pas.
- Un `lireBrouillon` qui ne coupe pas.

### bibliotheque-2 — photo sur la voisine — **confirmé, P2**

- **Rejeu** : `la photo est allée à : ["Première ?"]`.
- **Chemin** :
  - `pickImage` attend l'envoi, puis appelle `onChange`
    (`EditorApp.tsx:2794-2803`) ;
  - ce `onChange` est la fermeture `fn => actions.changer(index, fn)` du
    rendu d'avant (`:2641`), qui patche par position (`:1259`) ;
  - `setBusy` ne grise que le bouton de la photo, pas « Monter ».
- Un réarrangement pendant un envoi en 4G est un concours de circonstances,
  et le dégât se voit en soirée : P2 tient.
- **Correction** : par identifiant, comme le propose l'expert.

### bibliotheque-3 — « Garder la mienne » et le ménage — **confirmé, P2**

- **Rejeu** : le 409, puis « Garder la mienne » en 200, avec une photo qui
  répond 404.
- **Chemin** :
  - la grâce compte depuis `created_at` (`quizStore.ts:27`, `:365-366`) ;
  - le ménage part après chaque PUT et chaque suppression (`api.ts:263`, `:342`) ;
  - le PUT ne vérifie rien de ce qu'il cite.
- Deux appareils, dont l'un retire une photo vieille d'une heure : c'est
  rare, mais c'est le cas même que le 409 veut protéger.
- **Correction** : l'`orpheline_depuis` de l'expert est la bonne racine.
  Allonger la grâce ne suffirait pas : la photo retirée est ancienne, elle
  partirait quand même. À défaut, le PUT qui rend les pièces manquantes.

### bibliotheque-4 — le brouillon ne vérifie que la photo — **confirmé, P2**

- **Rejeu** : `[404, 404, 404]` après le ménage, puis `photosAVerifier` ne
  rend que la photo.
- C'est la lettre du piège « Une question a trois pièces à part ». Le dégât
  (révélation cassée, blind test muet sur une question « prête ») ne se voit
  qu'en soirée.
- **Correction** : parcourir `PIECES_DE_QUESTION` dans `photosAVerifier` et
  `sansPhotosDisparues`.

### bibliotheque-5 — anecdote ou note sur plusieurs lignes — **confirmé, gravité revue P3**

- **Rejeu** : les trois épreuves échouent comme décrit.
- **Chemin** : `ecrireListe` écrit `Anecdote : ${q.anecdote}` tel quel
  (`liste.ts:295-296`), alors qu'elle replie l'intitulé (`:285`).
- **Gravité revue** : il faut une anecdote ou une note tapée sur deux lignes
  (champs de 280 caractères, « deux phrases »), **et** l'aller-retour copier
  puis recoller. Le résultat se voit dans l'éditeur avant toute soirée :
  - une réponse de trop sur la carte ;
  - un intitulé bizarre, et le bloc coupé annoncé dans « blocs ignorés » ;
  - le barème reste cohérent (la bonne réponse suit son index).
- **Correction** : celle de l'expert, une ligne.

### bibliotheque-6 à bibliotheque-12 — **confirmés, P3**

- **Rejoués** :
  - `aller-retour-liste` 4 à 8 : bibliotheque-6 et -7 ;
  - `enregistrer` 6 : bibliotheque-8 (catalogue `[["Géo facile",2],["Géo facile",1]]`) ;
  - `allers-retours` 7 : bibliotheque-9 (« arrive prête, sans son bébé ») ;
  - `sonde-coupes` : bibliotheque-11 (`"a\ud83c…"` → `EF BF BD`) et -12
    (« (copie) » tombe à 80 caractères).
- **bibliotheque-8** : le commentaire de `partages.ts:162-164` promet bien
  que l'ancienne copie part quand la nouvelle est publiée.
- **bibliotheque-10**, à la lecture : un jeton neuf par clic
  (`EditorApp.tsx:1421`) et `memeClic` qui l'exige (`api.ts:239-243`).
  `shared/reveil.ts` admet lui-même qu'« un essai abandonné par le client a
  pu arriver quand même, après le réveil ». Il faut un réveil de plus de
  deux minutes : P3.

### invariants-1 — quiz livrés dans le quiz du jour — **tension, P3**

- **Rejeu** : `jour-modeles.test.ts` échoue. Les 10 questions du 28 septembre
  sont celles de « Culture générale ».
- **Mais c'est un choix écrit, trois fois** :
  - `jour.ts:325-332` ;
  - RECOMPENSES.md § 5.13 : « Amorcée au premier démarrage par les quiz livrés » ;
  - README l. 128 : « La réserve s'amorce toute seule avec les quiz livrés ».
- Il heurte la raison même qu'il donne pour écarter les quiz des animateurs
  (« leurs invités y liraient la prochaine soirée »), puisque les quiz livrés
  se jouent tels quels en soirée. Il heurte aussi l'invariant 8. C'est un
  arbitrage : un quiz du jour dès le premier matin, ou aucun recouvrement.
- **L'avantage est mince** :
  - les modèles sont publics (le dépôt, « Partir d'un modèle » dans chaque
    espace) ;
  - un invité qui les a déjà joués en soirée en sait autant ;
  - le recouvrement tient aux trois ou quatre premiers jours de la réserve
    (38 questions), puis revient seulement si elle reste à sec plus de 30 jours.
- **Recoupement** : jour-regles-13, jugé tension P3 par la contre-expertise `jour`.
- **Si l'on tranche pour l'invariant 8**, la piste de l'expert. La moitié la
  moins chère : marquer `retiree_le` sur les lignes `source = 'livre'` pas
  encore posées, et ne plus amorcer.

### invariants-2 — saisons et `VERSION_BAREME` — **confirmé, P3**

- **Rejeu** : le test principal échoue (0 ligne de saison). Le témoin passe
  (la Citrouille tombe au prochain recalcul).
- **La simulation est fidèle** : une soirée close par le code de #59, puis
  ramenée à l'état d'avant (ligne `saison:` retirée, lignes à `v = 6`).
- **Impact réel** : incertain et probablement nul. Il faut des soirées
  archivées entre le 25 octobre 2025 et le 2 janvier 2026, alors que
  l'historique du dépôt commence le 22 septembre 2026.
- **Recoupement** : recompenses-comptes-7, que la contre-expertise
  `recompenses` renvoie ici.
- **Point d'ordre, essentiel** : monter à 7 **avant** de corriger
  recompenses-comptes-1 (P2 confirmé : la ligne `#jour` s'écrit
  `{"v":6.0}`) ferait relire l'historique à **chaque** démarrage. La montée
  se livre avec cette correction, ou après.

### invariants-3 — le jeton lit les questions à venir — **confirmé, P3**

- **Rejeu** : « 10 des 10 questions de demain se lisaient la veille ».
- **Chemin** : `consigne()` (`jour.ts:446-456`), `ORDER BY posee_le IS NOT
  NULL` puis `LIMIT 300`.
- MISE-EN-LIGNE.md:181 (« il ne coûterait que des questions en trop ») est
  faux, et la marche à suivre après une fuite est incomplète : il faut aussi
  retirer les questions à venir.
- **Recoupement** : jour-regles-13 (tension, pour l'administrateur de
  confiance). Ici, c'est la fuite du jeton, un secret posé chez un tiers :
  P3.
- **Correction** : ne rappeler que les intitulés posés (l'empreinte refuse
  déjà les copies exactes), ou corriger les trois phrases.

### invariants-4 à invariants-6 — **confirmés, P3**

- **invariants-4** : RECOMPENSES.md:401-403 et CLAUDE.md:58 livrent la règle
  entière de l'Arbre-Monde (`DOUZE_LEGENDAIRES.every`, `divins.ts:191`).
  Absente d'a6fc98b.
- **invariants-5**, vérifié par sondage :
  - l'en-tête de `shared/jour.ts:10-11` ;
  - `choisir` (`jour.ts:156-174`) complète sans limite par catégorie ;
  - `categories-du-jour.ts` rejoué : le 4ᵉ jour pose 8 questions, dont 4
    « Nature » ; les 5ᵉ et 6ᵉ jours sont vides, ce que dément « jamais un jour vide » ;
  - « 🥉 Le Podium » (RECOMPENSES.md:314) contre « L'Habitué du Podium »
    (`hautsfaits.ts:322`).
- **invariants-6** : les cinq relus.
  - `export.ts:195` : c'est bibliotheque-11.
  - `quizDuJour.ts:262`.
  - `PlayerView.tsx:894` et `HostView.tsx:350` : même règle,
    hors de `classement.ts`.
  - `jour.ts:1516` : `String(r.avatar)`, à l'administrateur seul.

## Hors mission des rapports, en passant

- **client** :
  - `host:launch` sans visée, c'est moteur-11 (confirmé P3 par `soiree`) ;
  - `host:awardTeam` sans garde, c'est la moitié serveur de client-5.
- **invariants**, deux points :
  - la saison perdue avec sa soirée, c'est recompenses-comptes-5 et
    jour-regles-8 ;
  - l'espace nommé `jour` est vrai à la lecture : `jour` est entré dans
    `RESERVED_SLUGS` (`shared/space.ts:25`) sans migration. Non rejoué, hors
    de mon groupe.
