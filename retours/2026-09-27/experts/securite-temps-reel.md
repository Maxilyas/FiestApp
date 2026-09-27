# securite-temps-reel — rapport de l'expert temps réel

## En bref

Le cœur du temps réel tient. Sur les points les plus dangereux — commander la
soirée d'un voisin, lire la bonne réponse avant la révélation (vues **et**
JSON publics), tuer le processus avec un message malformé, franchir le
cloisonnement `space_id` — je n'ai rien trouvé qui cède : `ecouter()`,
`bindSpace()`, le moteur qui ne connaît que sa partie, et le journal qui
n'écrit qu'à la révélation font correctement leur travail, et le plafond
`maxHttpBufferSize` (1 Mo) borne déjà les charges. Trois failles cèdent
pourtant, toutes rejouées : **(1)** un griefeur qui ne connaît que le slug
public peut bloquer « Rendre sa place » pour toute la salle en épuisant un
compteur d'essais commun à l'espace (P2) ; **(2)** un `player:join` forgé fait
porter à un invité anonyme — ou à un profil trop bas — un emoji de collection
réservé, parce que le contrôle de niveau juge l'avatar *avant* son nettoyage
(P3, invariant 8) ; **(3)** une session d'animateur qui expire — la télé
branchée par appairage, plafonnée à 24 h — ne coupe pas la connexion déjà
ouverte : `requireHost` ne relit que le drapeau posé au `host:hello` (P3,
invariant 16). Les trois se corrigent en quelques lignes.

## Méthode

- **Lecture intégrale** : `server/src/sockets.ts` (960 l.), `shared/events.ts`,
  `core/space.ts` (les deux instantanés, la carte, la clôture, la scène),
  `core/engine.ts` (actions, commandes, vues, chronomètres, miroir),
  `games/quiz.ts` (`playerView`/`hostView`, `logQuestion`, barème),
  `core/party.ts`, `core/places.ts`, `core/inscriptions.ts`,
  `core/pages.ts`, `core/review.ts`, `auth/appairage.ts`, `auth/store.ts`
  (sessions, `resolveSession`, `onRevoke`), `server.ts` (config socket.io,
  pages publiques `/s/…`), `api.ts` (médias), `auth/avatars`/`profiles`
  (`peutPorter`, `avatarPorte`). Diff `a6fc98b..b57035c` (#58/#59) lu sur les
  fichiers de mon angle.
- **Rapports d'avant** : `retours/2026-09-24/experts/robustesse-espaces.md` et
  la synthèse (failles entre espaces déjà couvertes par `espaces.test.ts` :
  je ne les reprends pas). `garde-fous.test.ts`, `protocole.test.ts`,
  `temps-reel.test.ts`, `telephone-perdu.test.ts`, `appairage.test.ts` lus
  pour savoir ce qui est déjà gardé.
- **Reproductions** (dans `export/evaluations/securite-temps-reel/`, banc
  jetable de `server/test/banc.ts`, lancées `nice -n 10`, une à la fois ;
  charge machine `load 0.4–1.2`) :
  - `reprise-dos.test.ts` — **échoue aujourd'hui** (constat 1).
  - `avatar-de-collection.test.ts` — 2 assertions **échouent** (constat 2),
    le témoin passe.
  - `host-sans-revalidation.test.ts` — **échoue aujourd'hui** (constat 3),
    au niveau `wireSockets` (couture io/socket, sans horloge truquée).
  - `pages-en-cours.test.ts` — **passe** : garde de l'invariant 1 sur les
    JSON publics (aucune fuite pendant la question, tout paraît à la
    révélation).
- **Non couvert** : pas de test de charge (mille sockets, `player:action` en
  rafale) — la machine est partagée ; pas de vrai Turso ; pas de navigateur
  (mission serveur) ; le déclencheur réel du constat 3 (une connexion télé
  ouverte 24 h sans reconnexion) est démontré à la couture, pas à la seconde
  près.

## Constats

### 1. Un griefeur qui connaît le slug bloque « Rendre sa place » pour toute la salle

- **Où** : `server/src/core/places.ts:83` (`lire()` : `if (this.manques.length
  >= ESSAIS_MANQUES_MAX) return { motif: 'trop' }`, vérifié **avant** de
  regarder le code) ; `places.ts:47` (`manques`, compteur **commun à tout
  l'espace**, tous codes confondus, fenêtre 60 s) ; `sockets.ts:495-529`
  (`player:reprendre` : le garde-fou `placeFailures` est par connexion, mais
  il ne borne qu'une connexion).
- **Constat** : le code « Rendre sa place » (6 chiffres) est protégé de la
  force brute par un compteur d'essais manqués **par espace** — cinq par
  minute glissante. Ce compteur est partagé par toutes les connexions, et le
  slug est public (QR, URL). Un griefeur envoie cinq `player:reprendre` à faux
  codes (une seule connexion suffit, ou plusieurs pour esquiver le plafond
  `placeFailures`) : le compteur de l'espace est plein pour 60 s, et l'invité
  au téléphone mort, **muni du bon code que l'animateur vient de lui donner**,
  lit « Trop d'essais ici — réessaie dans une minute ». En répétant chaque
  minute (cinq messages depuis des sockets neufs), la reprise reste cassée
  toute la soirée. La console, elle, affiche encore « Valable 3 minutes » :
  exactement le symptôme que le correctif de `places.ts` voulait chasser,
  déplacé de « code mort » à « reprise refusée ».
- **Preuve** : `export/evaluations/securite-temps-reel/reprise-dos.test.ts`
  échoue aujourd'hui — après cinq faux codes venus de connexions anonymes, la
  reprise avec le bon code rend
  `{"ok":false,"error":"Trop d'essais ici — réessaie dans une minute"}`.
- **Qui ça touche, ce que ça coûte** : l'invité dont le téléphone est mort,
  toute la soirée — le seul chemin de récupération sans jeton. Griefing à
  distance, coût nul pour l'attaquant, l'animateur ne comprend pas pourquoi
  « ça ne marche pas ». N'abîme pas le reste de la soirée.
- **Statut** : bug confirmé (rejoué).
- **Piste** : compter les essais manqués **par adresse** (comme la réserve
  d'inscriptions, `Budget`/`clientIp`) plutôt que dans un seul seau d'espace,
  en gardant un plafond par code contre la force brute — un griefeur
  n'épuise alors que sa propre adresse, pas celle de l'invité. À défaut,
  ne compter comme « essai manqué » que les codes de la **bonne longueur mais
  faux** et garder le seau d'espace bien plus large (p. ex. 30/min), le
  6-chiffres restant hors de portée.
- **Priorité · effort** : P2 · S.

### 2. Un `player:join` forgé fait porter un emoji de collection réservé (invariant 8)

- **Où** : `server/src/sockets.ts:407-409` — `const tape = texte(charge.avatar);
  const choisi = tape && deps.profiles.peutPorter(profile, tape) ? tape : ''`.
  `peutPorter` (`profiles.ts:716`) lit `niveauRequis(tape)` sur l'avatar
  **brut**, puis `Party.join` (`party.ts:108`) le nettoie avec `cleanAvatar`
  (`avatars.ts:68`), qui **retire les caractères invisibles** — donc
  reconstitue un emoji que le contrôle n'a pas vu.
- **Constat** : l'emoji de collection (🐲 niveau 16, 🪐 niveau 17…) est
  « réservé aux profils » et ne se porte qu'au niveau qui l'ouvre
  (CLAUDE.md, invariant 8 et le piège « l'invité anonyme n'y porte aucun
  emoji de collection »). En glissant un caractère invisible (`U+200B`,
  `U+00AD`… catégorie `Cf`) **au milieu de la paire de substitution** —
  `\uD83D` `U+200B` `\uDC32` —, `niveauRequis` voit deux demi-caractères et
  rend 0 (contrôle passé), puis `cleanAvatar` retire l'invisible et recolle
  🐲. L'invité anonyme, ou un profil de niveau 1, porte alors l'emoji à
  l'écran commun et sur tous les téléphones.
- **Preuve** : `export/evaluations/securite-temps-reel/avatar-de-collection.test.ts`
  — le témoin (🐲 tapé tel quel) est bien refusé ; les deux cas forgés
  échouent : l'accusé rend un emoji de collection à un anonyme, et un profil
  niveau 1 porte 🪐 (niveau 17).
- **Qui ça touche, ce que ça coûte** : purement cosmétique — aucun avantage de
  jeu, aucune donnée, et ces emojis sont tous antérieurs à Unicode 13 (pas de
  carré vide sous Windows 10). Mais c'est une garde délibérée de #58 qui tombe,
  et l'« absence, pas l'infériorité » de l'invariant 8 qui se troue : un
  anonyme affiche un statut qu'il n'a pas, devant toute la salle.
- **Statut** : bug confirmé (rejoué).
- **Piste** : juger le niveau sur l'avatar **nettoyé**, aligné sur ce que
  `Party.join` stockera : `const propre = cleanAvatar(tape); const choisi =
  tape && deps.profiles.peutPorter(profile, propre) ? propre : ''`. Même
  correction à surveiller dans `profiles.ts:1016-1017` (mise à jour de
  l'avatar du profil), qui a le même motif `cleanAvatar` puis `niveauRequis`
  — à vérifier qu'il nettoie bien avant de juger.
- **Priorité · effort** : P3 · S.

### 3. Une session d'animateur qui expire ne coupe pas la connexion déjà ouverte (invariant 16)

- **Où** : `server/src/sockets.ts:700` (`requireHost = () => socket.data.isHost
  ? runtime() : null`) ; `:678` (`isHost` posé une fois au `host:hello`) ;
  `:154-158` (seule `auth.onRevoke` coupe un écran commun) ;
  `auth/store.ts:523` (`resolveSession` supprime une session expirée **sans**
  prévenir les écouteurs de révocation ; aucun balayage périodique ne le fait
  au fil de l'eau).
- **Constat** : l'espace d'un écran commun est fixé au `host:hello` et n'est
  plus jamais revérifié : chaque commande ne lit que `socket.data.isHost`.
  La seule chose qui coupe la connexion est une **révocation explicite**
  (déconnexion, mot de passe changé, compte désactivé). L'**expiration
  naturelle** d'une session ne déclenche rien. Or une télé branchée par
  appairage reçoit une session plafonnée à 24 h (`fin_max`, `TELE_BRANCHEE_MS`,
  invariant 16 : « jamais plus de 24 heures »). Tant que sa connexion socket
  tient — le battement de cœur socket.io la maintient sans reconnexion —,
  elle garde la main sur la soirée (créer/renommer des équipes, exclure,
  clore) bien au-delà de ses 24 h, alors qu'elle ne pourrait plus se
  re-présenter (`host:hello` échouerait). Le client `HostApp` **re-émet**
  `host:hello` à chaque reconnexion, donc une simple coupure réseau referme
  la porte — mais une télé laissée allumée sur un wifi stable ne se
  reconnecte jamais.
- **Preuve** : `export/evaluations/securite-temps-reel/host-sans-revalidation.test.ts`
  échoue aujourd'hui — présentée avec une session valide puis rendue
  introuvable (sans révocation), la connexion reçoit encore
  `host:command {type:'next'}` (`commandes reçues après expiration = ["next"]`)
  et n'est pas coupée. Le déclencheur réel (connexion continue > 24 h) n'est
  pas rejoué à la seconde près — l'horloge truquée perturbe le battement de
  cœur socket.io — mais le mécanisme (absence de re-contrôle) est
  sans ambiguïté dans le code.
- **Qui ça touche, ce que ça coûte** : la télé « de quelqu'un d'autre » — le
  bar, la salle louée, les parents — laissée branchée d'une soirée à l'autre
  sans coupure réseau ni redémarrage : elle garde le contrôle de l'espace au
  lieu de retomber à son code d'appairage le lendemain. Étroit (il faut une
  connexion ininterrompue), et la personne est physiquement sur place, mais
  c'est l'esprit de l'invariant 16 (« une soirée, pas un mois ») qui n'est
  pas tenu.
- **Statut** : bug confirmé (rejoué au banc pour le mécanisme ; lecture pour
  le déclencheur de 24 h).
- **Piste** : re-valider la session dans `requireHost` — `deps.auth
  .sessionById(socket.data.authSessionId)` (déjà mémorisé, `sockets.ts:680`)
  et refuser/couper si elle a disparu ; ou un balayage périodique des
  sessions expirées qui appelle les écouteurs de révocation comme le fait
  déjà le démarrage (`store.ts`, `fermees`). La première est la plus sûre et
  la moins coûteuse (une lecture mémoire par commande d'animateur).
- **Priorité · effort** : P3 · S.

## Mesures et cartes

### Le tableau des messages socket (client → serveur)

| Message | Qui peut l'envoyer | Contrôle d'espace | Validation de la charge | Accusé |
|---|---|---|---|---|
| `time:sync` | quiconque | — (sans espace) | aucune (charge vide) | oui |
| `party:watch` | quiconque | `bindSpace` (verrou 1er espace) | `texte(slug)` → `spaceOf` | oui + `enPanne` |
| `player:join` | quiconque | `bindSpace` | `texte`, `cleanName`, `peutPorter`†, réserve d'inscriptions | oui + `enPanne` |
| `player:action` | quiconque (rattaché par jeton) | `runtime()`/`bindSpace`, moteur compare `sess.id` | `texte`, `lireIndex`, `Number.isFinite` | oui (`refuse`) |
| `player:reprendre` | quiconque | `bindSpace` | `texte(code)`, budget espace‡ | oui + `enPanne` |
| `player:horsLigne` | quiconque | `bindSpace` | `texte(name)` | oui + `enPanne` |
| `player:setTeam` | invité rattaché | `runtime()` | `validTeam` | oui |
| `host:*` (19 gestes) | écran commun présenté | `requireHost` = `isHost` posé au hello§ | `texte()`/`Number` par champ | selon geste |

† contrôle contourné par le nettoyage (constat 2). ‡ budget commun à l'espace,
épuisable par un tiers (constat 1). § non revérifié après expiration
(constat 3). `garde-fous.test.ts` prouve qu'aucun `host:*` ne passe par un
téléphone, une connexion anonyme ou un autre espace — vérifié, tient.

### La liste des essais — ce qui tient, ce qui cède

| Essai | Résultat |
|---|---|
| `host:*` (19) depuis téléphone / anonyme / autre espace | tient (`garde-fous.test.ts`) |
| `player:action` visant la partie/le sessionId d'un autre espace | tient (`ended`) |
| charge absente / `null` / nombre / tableau / sans accusé, sur chaque message | tient (`temps-reel.test.ts`, revu) |
| promesse rejetée dans un écouteur (base injoignable) | tient (journal + accusé) |
| lire la bonne réponse / cible / anecdote / ordre avant révélation (vues) | tient (gaté `phase==='reveal'`) |
| lire la bonne réponse / cible / anecdote via recap/bilan/soirees en cours | tient (`pages-en-cours.test.ts`) |
| `note`, extrait `son`, programme vers un téléphone | tient (hostView seulement) |
| charge > 1 Mo (`maxHttpBufferSize`) | tient (socket.io coupe) |
| carte `/s/<B>/joueurs/<invité de A>` | tient (404, cloisonné) |
| **bloquer « Rendre sa place » de toute la salle avec le seul slug** | **cède (constat 1)** |
| **emoji de collection porté par un anonyme / profil trop bas** | **cède (constat 2)** |
| **télé dont la session a expiré, connexion maintenue** | **cède (constat 3)** |

## Ce qui marche — à ne pas casser

- **`ecouter()` (sockets.ts:184)** : charge toujours objet, accusé toujours
  fonction, exception synchrone **et** de promesse rattrapées et journalisées
  avec le nom de l'événement. C'est le filet qui a survécu à tous mes
  messages malformés.
- **`bindSpace()` une fois pour toutes** : une connexion qui a suivi A ne lit
  jamais B — `party:watch`, `player:join`, `host:hello`, `player:action`
  croisés échouent tous.
- **Invariant 1, vues ET pages publiques** : `logQuestion` n'écrit qu'à la
  révélation (`quiz.ts` `reveal`), donc recap/bilan/soirees ne portent jamais
  la question en cours ; les vues gâchent tout ce qui trahit derrière
  `st.phase === 'reveal'`. L'extrait de blind test et la note restent en
  `hostView`.
- **`maxHttpBufferSize` par défaut (1 Mo)** : les charges sont bornées, une
  trame plus grosse coupe la connexion — pas de mégaoctet à analyser.
- **La carte d'un joueur** ne porte ni login, ni liste d'espaces, ni
  identifiant de connexion : le playerId de l'URL est aléatoire et cloisonné.

## Recommandations, dans l'ordre

1. **Compteur d'essais « Rendre sa place » par adresse, pas par espace**
   (constat 1) — P2 · S.
2. **Juger `peutPorter` sur l'avatar nettoyé** dans `player:join`, et vérifier
   le même motif dans la mise à jour d'un profil (constat 2) — P3 · S.
3. **Re-valider la session d'animateur par commande** (ou couper à
   l'expiration) dans `requireHost` (constat 3) — P3 · S.
4. Les trois reproductions de `export/evaluations/securite-temps-reel/`
   rejoignent `server/test/` (elles échouent aujourd'hui, passeront corrigées) ;
   `pages-en-cours.test.ts` garde l'invariant 1 des JEUX publics.

## Limites

- Pas de test de charge : le flot de `player:action`/`party:watch`/`time:sync`
  n'a **aucun** plafond de fréquence par connexion (seule la création
  d'identité et la taille des trames sont bornées). Une connexion qui martèle
  ces messages ne coûte qu'à elle-même en diffusion (invariant 4 :
  `vueDependDesAutres: false`), mais brûle du processeur serveur ; à mesurer
  sur une vraie instance (P3, durcissement — cohérent avec les rapports
  `perf-*`). De même, socket.io n'a pas de plafond de connexions par adresse.
- `player:horsLigne` révèle, à qui connaît le slug, la présence (nom + avatar
  + « a un profil ») d'un invité **hors ligne** portant un prénom donné :
  divulgation mineure, cohérente avec le souvenir public — non chiffrée comme
  faille.
- Constat 3 : mécanisme rejoué à la couture `wireSockets` ; le déclencheur
  réel (connexion continue > 24 h) reste à confirmer sur un vrai appareil —
  l'horloge truquée perturbe le battement de cœur socket.io.
- Pas de vrai Turso, pas de navigateur. Les fuites entre espaces déjà
  couvertes par `espaces.test.ts`/`robustesse-espaces.md` ne sont pas
  reprises.

## Hors mission

- `client/src/views/HostApp.tsx:454-457` : au `connect`, si `helloHost()` ne
  répond pas (`catch → null`), on ne conclut rien — correct ; mais si la
  session a été révoquée, le serveur coupe avec `io server disconnect` et le
  client ne se reconnecte pas (attendu). RAS, noté pour l'expert `client`.
