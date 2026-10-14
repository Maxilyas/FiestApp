# Les événements temps réel

> Chaque message Socket.io de FiestApp, dans les deux sens : qui l'émet, ce qu'il porte, son accusé, son effet, ses refus, et le fichier qui l'écoute. Pour le développeur qui touche au protocole ; la mécanique d'ensemble — la vie d'une connexion, l'instantané, les vues, l'horloge, les renvois — est dans [Le temps réel](../architecture/temps-reel.md).

**Dans cette page** : [Les conventions](#les-conventions) · [Du téléphone ou de l'écran vers le serveur](#du-téléphone-ou-de-lécran-vers-le-serveur) · [Du serveur vers les écrans](#du-serveur-vers-les-écrans) · [Ce que socket.io émet lui-même](#ce-que-socketio-émet-lui-même)

## Les conventions

Le contrat tient dans `shared/events.ts` : `ClientToServerEvents` (27 messages) et `ServerToClientEvents` (11), typés des deux côtés. `server/test/documentation.test.ts` vérifie que chacun a sa section ici, et qu'aucune section ne survit à son message.

- **Tout message d'un client passe par `ecouter()`** (`server/src/sockets.ts`, invariant 7). La charge devient toujours un objet — absente, `null` ou un tableau, elle vaut `{}` —, chaque champ se relit à son type (un texte attendu qui n'en est pas un vaut « absent »), l'accusé est toujours une fonction (vide si le client n'en a pas donné), et une exception, synchrone ou dans la promesse du gestionnaire, part au journal (`[socket] « … » a échoué`) et au relevé des erreurs (`server/src/core/pouls.ts`). Quand le message a un accusé, le client reçoit alors la **réponse de panne** que donne sa fiche.
- **Les salles.** `space:<espace>` réunit toute connexion rattachée à un espace — qui suit, qui joue, les écrans ; `hosts:<espace>` les écrans d'animateur (console, télécommande, télé branchée, liaison du chef) ; `player:<invité>` les connexions qui incarnent un invité. `<espace>` est l'identifiant du compte. Le serveur n'émet jamais à tout le monde : les espaces ne se voient pas.
- **Une connexion ne suit qu'un espace**, fixé par le premier message qui en nomme un (`bindSpace`). Un autre espace ensuite : « Cette connexion suit déjà une autre soirée ».
- **Qui peut émettre.** « Tout le monde » : n'importe quelle connexion, même anonyme. « L'invité » : une connexion qui incarne une fiche — par `player:join`, `player:reprendre` ou une réponse qui porte son jeton —, une seule à la fois. « Un écran d'animateur » : une connexion dont le cookie de session `qz_session`, porté par la poignée de main, désigne une session ouverte ; chaque message `host:*` relit cette session (`requireHost`). Venu d'un téléphone, d'une connexion anonyme ou de l'écran d'un autre espace, un `host:*` ne fait rien et ne répond rien ; une connexion qui était un écran et dont la session s'est éteinte est coupée. `server/test/garde-fous.test.ts` tient la liste de tous les `host:*`, que le typecheck impose complète.
- **Les messages du serveur** n'ont ni accusé ni refus : ils partent à une salle, ou à une seule connexion.
- **Côté client**, la page d'un invité et l'écran commun ont chacun une liaison, `client/src/socket.ts` ; le chef d'un salon en ouvre une seconde, celle de l'animateur (`client/src/socketDuChef.ts`). Les délais d'accusé, les sondes et les renvois du client sont dans [Le temps réel](../architecture/temps-reel.md).

## Du téléphone ou de l'écran vers le serveur

Rangés par famille : l'horloge, l'invité, l'écran d'animateur et la partie, les invités vus de la console, les équipes et les prix, la fin de la soirée. Tous s'écoutent dans `wireSockets` (`server/src/sockets.ts`).

### `time:sync`

- **Qui l'émet** : tout le monde, sans identité ni espace. Chaque liaison à sa connexion, trois fois (`syncClock`, `client/src/socket.ts`) ; la sonde de liaison (`verifierLiaison`), au retour au premier plan, au retour du réseau, ou quand un accusé tarde.
- **Charge** : `{}`.
- **Accusé** : `{ serverNow }`, l'heure du serveur en millisecondes.
- **Effet** : aucun au serveur. Le client en tire l'écart de son horloge (`applySample`, `client/src/clock.ts`) ; la sonde ne regarde que si la réponse arrive dans les deux secondes.
- **Refus** : aucun.
- **Écouté par** : `server/src/sockets.ts`.

### `party:watch`

- **Qui l'émet** : tout le monde — la page d'un invité (`/<espace>`), à chaque connexion et avant toute inscription (`watchParty`, `client/src/views/PlayerApp.tsx`), et la même page après une connexion à un profil, pour relire le cookie.
- **Charge** : `{ slug }`, l'adresse de l'espace.
- **Accusé** : `{ ok: true, profile? }` — le profil public du cookie `qz_joueur`, s'il y en a un — ou `{ ok: false, error }`. Panne : `{ ok: false, error: 'Erreur serveur — réessaie' }`.
- **Effet** : rattache la connexion à l'espace pour toute sa vie, puis, juste derrière l'accusé, lui envoie l'instantané des téléphones (`party:snapshot`), à elle seule.
- **Refus** : « Cette adresse ne mène à aucune soirée » (espace inconnu ou désactivé), « Cette connexion suit déjà une autre soirée ».
- **Écouté par** : `server/src/sockets.ts`.

### `player:join`

- **Qui l'émet** : tout le monde. L'entrée d'un nouvel invité (prénom, avatar, équipe) ; l'entrée d'un profil, sans prénom ni avatar — ceux du profil ; le téléphone qui se re-présente seul à chaque connexion, avec son seul jeton, juste derrière `party:watch` et sans attendre sa réponse ; le chef qui entre après « Ouvrir le salon ». `joinAsPlayer`, `client/src/socket.ts`.
- **Charge** : `{ slug, name?, avatar?, token?, teamId?, horsClassement? }`.
  - `token` : un jeton qui désigne une fiche fait une **re-présentation** — prénom et avatar envoyés sont ignorés, la fiche du serveur fait foi (invariant 9).
  - `teamId` : absent, l'équipe ne bouge pas ; `null` ou une équipe inconnue, sans équipe ; une équipe de la soirée, celle-là — y compris pendant un quiz.
  - `horsClassement` : le chef qui anime seulement. Écouté du seul profil qui tient l'espace, redit à chaque présentation, gardé en mémoire jusqu'à la fin de la soirée ; il prend effet au lancement du quiz suivant.
- **Accusé** (`JoinAck`) : `{ ok: true, playerId, token, name, avatar, profile? }` — l'identité que le serveur a retenue, que le téléphone garde — ou `{ ok: false, error, reason?, fin?, derniere? }`. Panne : `{ ok: false, error: 'Erreur serveur — réessaie' }`.
- **Effet**, dans l'ordre :
  1. le profil du cookie se lit ; si la connexion s'est fermée entre-temps, rien ne suit, pas même l'accusé ;
  2. la fiche reconnue : celle du profil s'il en a une ce soir (`findByProfile` — un profil, une fiche par soirée), sinon celle du jeton, sauf si elle est rattachée à un autre profil que celui du téléphone : il repart alors d'une fiche neuve ;
  3. une **nouvelle fiche** passe ses garde-fous (les refus plus bas) ; son prénom et son avatar viennent de la charge, sinon du profil, et un emoji de collection n'est accepté que du profil qui l'a ouvert ;
  4. la fiche s'écrit (`Party.join`, `server/src/core/party.ts`) et se rattache au profil ; un nouvel invité fait quitter la scène à la clôture d'hier ;
  5. la connexion incarne l'invité (salle `player:<invité>`), et l'accusé part ;
  6. l'invité entre dans la partie en cours s'il n'en était pas (`joinLate`) ; avant sa première vue, sa connexion reçoit l'instantané des téléphones ; puis l'instantané regroupé part à la salle, et sa vue de partie lui revient (`resendViews`).
- **Refus** :
  - « Cette adresse ne mène à aucune soirée », « Cette connexion suit déjà une autre soirée » ;
  - le jeton d'un invité de la soirée qu'on vient de clore (gardé en mémoire depuis la clôture) : `reason: 'soiree-close'`, « Cette soirée est close — voici la tienne », et sa fin de soirée dans `fin` ;
  - un jeton qui ne désigne plus personne : `reason: 'unknown-token'`, et jamais une fiche recréée. Si ce jeton n'a pas été effacé (exclusion, essai) et que l'espace n'a rien joué depuis sa dernière clôture, l'accusé porte cette soirée close (`derniere`) et dit « La soirée est close. La dernière soirée de cet espace : *titre* » ; sinon « On ne te retrouve plus dans cette soirée — rejoins-la » ;
  - pour une nouvelle fiche seulement : « La soirée est complète — préviens l'animateur, qui peut libérer des places » (les inscrits, connectés ou non, ont atteint « Invités au plus », borné par `MAX_PLAYERS`) ; « Il faut un prénom ! », avant de puiser dans la réserve ; « Trop d'inscriptions d'un coup — réessaie dans une minute » (trois identités par connexion, `JOINS_PER_SOCKET`, puis la réserve d'inscriptions par adresse et par espace, `server/src/core/inscriptions.ts`).

  Un refus avec motif envoie aussi à la connexion `player:removed` portant ce motif — pour les pages d'avant, qui ne lisent pas l'accusé — et, pour `unknown-token`, un `toast` du même message.
- **Écouté par** : `server/src/sockets.ts`.

### `player:action`

- **Qui l'émet** : l'invité, à chaque réponse (`sendPlayerAction`, `client/src/socket.ts`).
- **Charge** : `{ sessionId, action, slug?, token? }`. `action` est une `QuizAction` (`shared/games/quiz.ts`) — `answer { choice }`, `guess { value }`, `answers { choices }` ou `order { order }` —, avec `qIndex` et `round`, la question et le tour qu'elle vise (invariant 12). `slug` et `token` permettent à une connexion encore anonyme de se rattacher.
- **Accusé** (`ActionAck`) : `{ ok: true }`, ou `{ ok: false, reason, error }`. Panne : le motif `error`.
- **Effet** : une connexion qui ne suit aucun espace s'y rattache par `slug`, une connexion qui n'incarne personne incarne la fiche du `token` — c'est la réponse tapée pendant une coupure, que socket.io rejoue sur la connexion neuve avant que la page se re-présente. Puis le moteur la juge (`GameEngine.handlePlayerAction`, `server/src/core/engine.ts` ; les règles dans `server/src/games/quiz.ts`) : le dernier envoi fait foi, heure comprise, et un envoi identique au précédent est confirmé sans rien réécrire.
- **Refus** :

  | Motif | Quand | Ce que lit l'invité |
  |---|---|---|
  | `no-party` | la connexion ne suit aucun espace, et la réponse n'en nomme pas | « Ta réponse n'est pas partie — reconnexion en cours, réessaie » |
  | `unknown-player` | ni identité ni jeton reconnu | « Ta réponse n'est pas partie — reconnexion en cours, réessaie » |
  | `ended` | `sessionId` n'est pas la partie en cours — celle d'un autre espace comprise | « Ce quiz est terminé » |
  | `not-participant` | l'invité n'est pas de la partie | « Tu n'es pas dans cette partie — tu joues à la prochaine question » |
  | `too-late` | la question n'est plus ouverte, ou la réponse vise une autre question ou un autre tour | « Trop tard — la question était finie » |
  | `paused` | le chronomètre est figé | « Le quiz est en pause — regarde l'écran commun » |
  | `invalid` | ni un choix valable, ni un nombre | « Réponse non comprise — réessaie » |
  | `error` | une panne du serveur | « Erreur serveur — réessaie » |
  | `timeout` | posé par le téléphone, sans accusé en quatre secondes | « Ta réponse n'est pas encore partie — elle partira dès que le réseau revient », ou « Ta réponse n'est pas partie — touche-la à nouveau » |

  Chaque `too-late` est compté au pouls du serveur (`server/src/core/pouls.ts`).
- **Écouté par** : `server/src/sockets.ts`.

### `player:horsLigne`

- **Qui l'émet** : tout le monde — l'entrée, quand le prénom tapé est déjà porté dans la salle (400 ms après la dernière frappe, redemandé à chaque instantané), et le téléphone d'un « second Rachid » (`horsLigneDuMemeNom`, `client/src/components/Reprendre.tsx`).
- **Charge** : `{ slug, name }`.
- **Accusé** : `{ ok: true, absent? }` — `absent` : `{ name, avatar, profil }`, le prénom tel qu'il s'affiche (marque d'homonymie comprise), son avatar, et si sa fiche est rattachée à un profil — ou `{ ok: false, error }`. Panne : `{ ok: false, error: 'Erreur serveur — réessaie' }`. Le client prend un refus, une panne ou un silence pour « personne ».
- **Effet** : rattache la connexion à l'espace, puis cherche une fiche **hors ligne** du même prénom, sans casse ni accents (`sansAccent`, `shared/homonymes.ts`) — hors la fiche que cette connexion incarne, celle du profil du téléphone, et les « seconds Rachid » laissés après une reprise. La réponse ne va qu'à ce téléphone : l'instantané des téléphones ne dit pas qui est connecté.
- **Refus** : « Cette adresse ne mène à aucune soirée », « Cette connexion suit déjà une autre soirée ». Un prénom vide rend `{ ok: true }`, sans absent.
- **Écouté par** : `server/src/sockets.ts`.

### `player:reprendre`

- **Qui l'émet** : tout le monde — le nouveau téléphone d'un invité dont le téléphone est mort, après « J'ai un code » (`reprendrePlace`, `client/src/socket.ts`).
- **Charge** : `{ slug, code, token? }`. `code` : les six chiffres que la console a fait paraître (seuls les chiffres comptent : « 482 913 », « 482-913 ») ; `token` : l'identité que ce téléphone portait jusque-là, s'il en avait une — le « second Rachid ».
- **Accusé** : celui de `player:join` (`JoinAck`) ; réussie, l'identité de la fiche reprise, avec un **jeton neuf**. Panne : `{ ok: false, error: 'Erreur serveur — réessaie' }`.
- **Effet** : la fiche reçoit un jeton neuf — l'ancien téléphone, rallumé, recevra `unknown-token` — et la connexion l'incarne ; le code est consommé. Le « second Rachid » s'efface s'il n'a rien joué ; sinon il reste avec ses points, que la fiche reprise ne récupère pas, et la partie ne l'attend plus (`laisserPlace`, `server/src/core/space.ts`). Comme à `player:join`, l'instantané part à ce téléphone avant sa première vue. Les écrans d'animateur reçoivent le `toast` « *Rachid* a repris sa place ».
- **Refus** (la connexion n'est jamais coupée) :
  - « Cette adresse ne mène à aucune soirée », « Cette connexion suit déjà une autre soirée » ;
  - « Trop d'essais — demande un nouveau code à l'animateur » : cinq codes faux sur cette connexion, tant que l'animateur n'en a pas fait paraître un neuf (`PLACE_MAX_FAILURES`) ;
  - « Attends la révélation, puis retape le code » : le second Rachid a joué, et sa réponse à la question ouverte n'est pas jugée — le code n'est ni consommé ni compté ;
  - « Trop d'essais ici — réessaie dans une minute » : cinq codes faux dans l'espace sur la dernière minute (`ESSAIS_MANQUES_MAX`, `FENETRE_ESSAIS_MS`, `server/src/core/places.ts`) — le code n'est même pas regardé. Quand un code faux ferme ainsi la minute, les écrans d'animateur reçoivent le `toast` « Des codes faux arrivent en rafale : « Rendre sa place » attend une minute — un code neuf rouvre la porte » ;
  - « Ce code ne marche pas — demande-en un nouveau à l'animateur » : inconnu, périmé ou déjà servi ;
  - « Ton ancien téléphone est revenu — joue dessus » : le code est consommé ;
  - « Connecte-toi à ton profil : il te rend ta place » (une fiche à profil) et « Ce téléphone est connecté à un profil — ouvre la soirée dans une fenêtre privée pour reprendre ta place » : ces deux-là laissent le code valable.
- **Écouté par** : `server/src/sockets.ts`.

### `player:setTeam`

- **Qui l'émet** : l'invité, depuis la salle d'attente — « Changer », « Choisir mon équipe » (`setMyTeam`, `client/src/socket.ts`).
- **Charge** : `{ teamId }` — une équipe, ou `null` pour aucune.
- **Accusé** : `{ ok: true }` ou `{ ok: false, error }`. Panne : `{ ok: false, error: 'Erreur serveur — réessaie' }`.
- **Effet** : pose l'équipe (une équipe inconnue vaut « sans équipe ») ; l'instantané des téléphones part à ce téléphone **avant** l'accusé — sa page relit son en-tête dans l'instantané —, puis regroupé à la salle. Les questions déjà jouées gardent l'équipe de leur moment.
- **Refus** : « Rejoins la soirée d'abord » (la connexion n'incarne personne), « Pas pendant un quiz — on verra à la fin ! » (une partie est ouverte, son podium compris).
- **Écouté par** : `server/src/sockets.ts`.

### `host:hello`

- **Qui l'émet** : un écran d'animateur, à chaque connexion — l'écran commun et la télé (`helloHost`, `client/src/views/HostApp.tsx`), la liaison du chef (`client/src/socketDuChef.ts`).
- **Charge** : `{}`. La session voyage dans le cookie `qz_session` de la poignée de main, jamais dans la page.
- **Accusé** : `{ ok: true, slug, name, branchee? }` — l'espace de la session ; `branchee` : une télé ouverte par un code d'appairage, qui dit alors par qui — ou `{ ok: false }`. Panne : `{ ok: false }`.
- **Effet** : la connexion devient un écran de l'espace de sa session (salle `hosts:<espace>`). Pour une télé branchée, un minuteur coupe la connexion à la fin de sa session, même sans un geste. Puis, à cette connexion seule : l'annonce de clôture si elle est à l'écran (`soiree:cloture`), l'instantané des écrans, la vue d'animateur de la partie en cours (`resendHostViews`). Enfin le salon s'ouvre — ou se rouvre, s'il est dans la demi-heure qui suit une clôture — et son code part à la salle s'il a changé.
- **Refus** : `{ ok: false }` sans session ouverte, ou si la connexion suit déjà un autre espace. Au cinquième refus, la connexion est coupée (`HELLO_MAX_FAILURES`).
- **Écouté par** : `server/src/sockets.ts`.

### `host:telecommande`

- **Qui l'émet** : un écran d'animateur — la console, à chaque connexion et à chaque bascule « Télécommande » (`client/src/views/HostApp.tsx`) ; la liaison du chef, qui s'y tient toujours.
- **Charge** : `{ active }`.
- **Accusé** : aucun.
- **Effet** : cette connexion se tient, ou non, en télécommande, et l'instantané part sur-le-champ (`sendSnapshot`). Tant qu'un écran de l'espace s'y tient, l'instantané des écrans porte `telecommande`, et l'écran projeté laisse les coulisses — la liste des quiz, la grille des prix — à sa main. Le drapeau vit avec la connexion : une reconnexion le redit, et le départ d'une télécommande rediffuse l'instantané.
- **Refus** : aucun, hors écran d'animateur.
- **Écouté par** : `server/src/sockets.ts`.

### `host:launch`

- **Qui l'émet** : un écran d'animateur — « Lancer un quiz » et « Quiz suivant » à la console (`client/src/views/HostApp.tsx`), « Lancer le quiz » et « Quiz suivant » dans la barre du chef.
- **Charge** : `{ depuis? }` — la partie que l'écran voyait, celle que le lancement remplace ; `null` s'il n'en voyait aucune.
- **Accusé** : aucun.
- **Effet** : si `depuis` vise la partie en cours — ou manque : une page d'avant —, une nouvelle partie s'ouvre (`GameEngine.launch`) : celle en cours se termine d'abord, et les invités connectés à cet instant en sont les participants. La fin de programme d'un salon se défait (`reconsidererCloture`), et la scène revient au jeu. Un `depuis` qui ne vise pas la partie en cours est ignoré en silence (invariant 12).
- **Refus** : une erreur du lancement revient en `toast` d'erreur — « Aucun quiz prêt à jouer — ouvre « Mes quiz » pour en créer un, ou partir d'un modèle ». Le serveur ne vérifie pas qu'un invité est connecté : c'est la console qui grise « Lancer un quiz ».
- **Écouté par** : `server/src/sockets.ts`.

### `host:command`

- **Qui l'émet** : un écran d'animateur — la console et la télécommande (`envoyerCommande`, `client/src/socket.ts`), dont « Ne plus l'attendre » (`client/src/components/Absents.tsx`) ; la barre du chef (`commande`, `client/src/socketDuChef.ts`).
- **Charge** : `{ sessionId, command }`. `command` est une `QuizCommand` (`shared/games/quiz.ts`) : `selectPack { packId, multiplier? }`, `next`, `pause`, `resume`, `cancel`, `replay`, `cible { value }`, `autoNext { seconds }` (`null` : au clic), `nePlusAttendre { playerId }`. `next`, `cancel`, `replay` et `cible` portent la visée `{ phase, qIndex, round }` : ce que l'écran avait sous les yeux au moment du clic.
- **Accusé** : `{ ok: true }` dès que le geste est arrivé — pas forcément joué ; `{ ok: false }` hors écran d'animateur ou sans `sessionId`. Panne : `{ ok: false }`.
- **Effet** : le moteur passe la commande au module de jeu (`GameEngine.handleHostCommand`). Une commande dont la visée ne correspond plus au moment présent est ignorée en silence : un « Révéler » qui croise la révélation automatique ne la saute pas. La console renvoie une fois, après une sonde, un geste resté trois secondes sans accusé ; la barre du chef n'attend pas l'accusé et ne renvoie pas.
- **Refus** : une partie qui n'est plus en cours lève « Cette partie est terminée », qui revient en `toast` d'erreur — l'accusé reste `{ ok: true }`.
- **Écouté par** : `server/src/sockets.ts`.

### `host:endSession`

- **Qui l'émet** : un écran d'animateur — « Terminer » et « Terminer le quiz », « Annuler » au choix du quiz, « Remise des prix » au podium d'un quiz (`client/src/views/HostApp.tsx`, `client/src/games/quiz/HostView.tsx`) ; « Terminer le quiz » de la barre du chef.
- **Charge** : `{ sessionId }`.
- **Accusé** : aucun.
- **Effet** : si `sessionId` est la partie en cours, elle se termine (`SpaceRuntime.terminerLaPartie`) : ses chronomètres s'éteignent, une question ouverte n'est ni payée ni journalisée, ce qui a été gagné reste, et `session:ended` part à l'espace. Sur le dernier quiz du programme d'un salon ouvert depuis un téléphone, la soirée se clôt dans la foulée.
- **Refus** : aucun ; une autre partie que celle en cours est ignorée.
- **Écouté par** : `server/src/sockets.ts`.

### `host:scene`

- **Qui l'émet** : un écran d'animateur — « Podium » et ses onglets « Les équipes » et « Les joueurs », « Prix », « Victoire », le retour à la salle d'attente, « La soirée suivante » (`client/src/views/HostApp.tsx`).
- **Charge** : `{ ecran, onglet?, depuis? }`. `ecran` : `podium`, `prix`, `victoire`, ou `null` pour la salle d'attente ; `onglet` : `equipes` ou `joueurs`, au podium ; `depuis` : l'écran que l'animateur quittait.
- **Accusé** : aucun.
- **Effet** : pose la scène de **tous** les écrans d'animateur de l'espace (`SpaceRuntime.poserScene`), qui la reçoivent sur-le-champ dans l'instantané des écrans ; la salle ne reçoit rien. La scène vit en mémoire : un redémarrage ramène la salle d'attente.
- **Refus**, tous en silence : un `ecran` inconnu ; un `depuis` illisible, ou qui n'est plus la scène du moment (invariant 12) ; `cloture`, que seule la fin de soirée pose ; depuis la clôture, autre chose que `null` ; un écran de fin pendant qu'une partie est ouverte, podium du quiz compris — « Remise des prix » envoie donc `host:endSession` d'abord ; la scène qu'on a déjà.
- **Écouté par** : `server/src/sockets.ts`.

### `host:renamePlayer`

- **Qui l'émet** : un écran d'animateur — « Un surnom pour « X » ce soir », en touchant un prénom de la salle d'attente (`client/src/views/HostApp.tsx`).
- **Charge** : `{ playerId, name }`.
- **Accusé** : aucun.
- **Effet** : le prénom de la fiche devient ce surnom, nettoyé comme à l'entrée (`cleanName`, 24 caractères au plus), pour toute la soirée et son archive ; le profil garde le sien. L'instantané part regroupé, et les vues de la partie se recalculent (`rafraichirVues`) : le podium et le plus rapide écrivent aussi les prénoms. Un téléphone qui se re-présente garde le surnom.
- **Refus** : un surnom vide une fois nettoyé, ou un invité que l'espace ne connaît pas : rien.
- **Écouté par** : `server/src/sockets.ts`.

### `host:removePlayer`

- **Qui l'émet** : un écran d'animateur — la croix d'une puce, « Exclure « X » de la soirée ? » (`client/src/views/HostApp.tsx`).
- **Charge** : `{ playerId }`.
- **Accusé** : aucun.
- **Effet** : `SpaceRuntime.exclure` — la fiche, ses gains et ses réponses s'effacent, au miroir en un seul lot ; l'invité quitte la partie en cours (s'il était le dernier attendu, la révélation s'arme) ; ses codes de place tombent et son jeton est retenu comme effacé ; l'instantané part regroupé ; ses connexions reçoivent `player:removed` et n'incarnent plus personne ; ce que la soirée avait crédité à son profil lui est repris.
- **Refus** : un invité que l'espace ne connaît pas : rien.
- **Écouté par** : `server/src/sockets.ts`.

### `host:rendrePlace`

- **Qui l'émet** : un écran d'animateur — « Rendre sa place » ou « Un autre code », dans « Qui manque ? » (`rendrePlace`, `client/src/components/Absents.tsx`).
- **Charge** : `{ playerId }`.
- **Accusé** (`PlaceRendue`) : `{ ok: true, code, expiresAt }` — six chiffres, et leur échéance à l'heure du serveur — ou `{ ok: false, error }`. Panne : `{ ok: false, error: 'Erreur serveur — réessaie' }`.
- **Effet** : un code à usage unique pour cette fiche, valable trois minutes (`VIE_DU_CODE_MS`, `server/src/core/places.ts`), en mémoire seulement. Il remplace le code précédent de la même fiche, et rend leurs essais à l'espace comme à chaque connexion. L'invité le tape sur son nouveau téléphone (`player:reprendre`).
- **Refus** : « Réservé à l'animateur » ; « Cet invité n'est plus dans la soirée » ; « Son téléphone est encore connecté — rien à rendre » ; « Il a un profil : qu'il s'y connecte sur son nouveau téléphone » — jamais de code pour une fiche à profil.
- **Écouté par** : `server/src/sockets.ts`.

### `host:createTeam`

- **Qui l'émet** : un écran d'animateur — « Nouvelle équipe » puis « Ajouter » (`client/src/views/HostApp.tsx`) ; « Ajouter une équipe » dans la barre du chef.
- **Charge** : `{ name, emoji }`.
- **Accusé** : aucun.
- **Effet** : une équipe de plus (`Teams.create`, `server/src/core/teams.ts`), son nom nettoyé, 🎈 si l'emoji manque ; l'instantané part regroupé.
- **Refus**, en `toast` d'erreur : « Pas plus de 10 équipes », « Il faut un nom d'équipe ».
- **Écouté par** : `server/src/sockets.ts`.

### `host:updateTeam`

- **Qui l'émet** : un écran d'animateur — le nom et l'emoji d'une équipe (`client/src/views/HostApp.tsx`), la feuille d'équipe de la barre du chef.
- **Charge** : `{ teamId, name?, emoji? }`.
- **Accusé** : aucun.
- **Effet** : renomme l'équipe ou change son emoji — un nom ou un emoji vide une fois nettoyé laisse l'ancien ; l'instantané part regroupé.
- **Refus** : une équipe inconnue : rien.
- **Écouté par** : `server/src/sockets.ts`.

### `host:removeTeam`

- **Qui l'émet** : un écran d'animateur — la suppression d'une équipe, confirmée (« Ses *N* membres ne sont pas exclus : ils repassent « sans équipe » et gardent leurs points. », `client/src/views/HostApp.tsx`) ; la feuille d'équipe de la barre du chef.
- **Charge** : `{ teamId }`.
- **Accusé** : aucun.
- **Effet** : l'équipe et ses prix disparaissent ; ses membres repassent sans équipe, avec leurs points ; l'instantané part regroupé.
- **Refus** : une équipe inconnue : rien.
- **Écouté par** : `server/src/sockets.ts`.

### `host:seedTeams`

- **Qui l'émet** : un écran d'animateur — « Les créer d'un coup » (`client/src/views/HostApp.tsx`) ; la barre du chef qui a choisi « En équipes », sur une soirée qui n'en a pas (deux).
- **Charge** : `{ count? }` — de deux à six ; sans nombre (une page d'avant), six.
- **Accusé** : aucun.
- **Effet** : seulement si la soirée n'a aucune équipe, les `count` premières équipes proposées (`EQUIPES_PROPOSEES`, `shared/teams.ts`) ; l'instantané part regroupé.
- **Refus** : une soirée qui a déjà des équipes : rien.
- **Écouté par** : `server/src/sockets.ts`.

### `host:assignPlayer`

- **Qui l'émet** : un écran d'animateur — le menu d'équipe d'une puce de la salle d'attente (`client/src/views/HostApp.tsx`).
- **Charge** : `{ playerId, teamId }` — `null` pour sortir l'invité de son équipe.
- **Accusé** : aucun.
- **Effet** : déplace l'invité, y compris pendant un quiz — les questions déjà jouées gardent l'équipe de leur moment ; l'instantané part regroupé ; son téléphone, et lui seul, reçoit un `toast` au nom de l'animateur : « Bob t'a placé·e dans l'équipe 💃 Les Salseras », ou « Bob t'a sorti·e de ton équipe ».
- **Refus** : un invité que l'espace ne connaît pas : rien.
- **Écouté par** : `server/src/sockets.ts`.

### `host:awardTeam`

- **Qui l'émet** : un écran d'animateur — « Attribuer », « Redonner » et le « Prix libre » de la remise des prix (`client/src/views/HostApp.tsx`).
- **Charge** : `{ teamId, points, reason, remise? }`. `remise` : l'identifiant que la console tire pour ce geste (`client/src/remise.ts`), 64 caractères au plus.
- **Accusé** : aucun.
- **Effet** : un prix pour l'équipe — points arrondis et bornés de −500 à +500 (`PRIX_MAX`), motif coupé à 60 caractères (« Prix spécial » s'il manque) ; l'instantané part regroupé. Un geste dont la `remise` a déjà servi ne remet rien : un double clic ne remet le prix qu'une fois.
- **Refus**, en `toast` d'erreur : « Équipe introuvable », « Il faut un nombre de points ».
- **Écouté par** : `server/src/sockets.ts`.

### `host:removeBonus`

- **Qui l'émet** : un écran d'animateur — la croix « Retirer ce prix », sous « Prix déjà remis » (`client/src/views/HostApp.tsx`).
- **Charge** : `{ bonusId }`.
- **Accusé** : aucun.
- **Effet** : le prix disparaît ; l'instantané part regroupé.
- **Refus** : un prix inconnu : rien.
- **Écouté par** : `server/src/sockets.ts`.

### `host:closeParty`

- **Qui l'émet** : un écran d'animateur — « Clore la soirée », avec le titre de sa boîte (`client/src/views/HostApp.tsx`) ; « Terminer la soirée » dans la barre du chef, sans titre.
- **Charge** : `{ title? }` ; sans titre, la soirée garde celui qu'elle porte.
- **Accusé** : aucun.
- **Effet** : clôt la soirée par `cloreLaSoiree` (`server/src/sockets.ts`), le chemin que prend aussi le QG (invariant 18) : archive sous ce titre, crédits de clôture, soirée effacée — le miroir d'abord —, `soiree:fin` à chaque téléphone, `soiree:cloture` aux écrans. Une seconde clôture pendant la première attend son issue. L'issue revient à cet écran en `toast` : « « *titre* » est close — la soirée suivante peut commencer », ou « Soirée vierge — rien n'avait été joué » (sans rien de joué, la soirée s'efface comme un essai). Le détail : [Après la soirée](../produit/apres-la-soiree.md).
- **Refus**, en `toast` d'erreur : « L'essai est en train de s'effacer — attends qu'il ait fini » ; « Rien n'a été effacé : … », quand la base permanente refuse — la soirée continue, entière.
- **Écouté par** : `server/src/sockets.ts`.

### `host:discardParty`

- **Qui l'émet** : un écran d'animateur — « C'était un essai », puis « Tout effacer » (`client/src/views/HostApp.tsx`).
- **Charge** : aucune.
- **Accusé** : aucun.
- **Effet** : la partie se termine ; ce que la soirée avait crédité aux profils leur est repris en un seul lot, son archive s'efface, puis la soirée (`SpaceRuntime.discardParty`) ; les jetons de ses invités sont retenus comme effacés, et leurs téléphones reçoivent `party:reset`. `toast` : « Essai effacé — rien n'a été gardé ».
- **Refus**, en `toast` d'erreur : « La soirée est en train de se clore — attends la fin » ; « Rien n'a été effacé : … ».
- **Écouté par** : `server/src/sockets.ts`.

### `host:resetParty`

- **Qui l'émet** : un écran resté sur une page d'avant — l'ancien « Nouvelle soirée ». La page d'aujourd'hui ne l'envoie plus.
- **Charge** : aucune.
- **Accusé** : aucun.
- **Effet** : celui de `host:closeParty` sans titre.
- **Refus** : ceux de `host:closeParty`.
- **Écouté par** : `server/src/sockets.ts`.

### `host:archiveParty`

- **Qui l'émet** : un écran resté sur une page d'avant — l'ancien « Sauvegarder ». La page d'aujourd'hui ne l'envoie plus : la soirée se range seule après chaque quiz.
- **Charge** : `{ title? }`.
- **Accusé** : aucun.
- **Effet** : range la soirée dans l'historique sous ce titre, sans la clore ; `toast` « « *titre* » est dans l'historique ».
- **Refus**, en `toast` d'erreur : « Rien à ranger : aucune question n'a encore été jouée », ou l'erreur du rangement.
- **Écouté par** : `server/src/sockets.ts`.

## Du serveur vers les écrans

Aucun n'a d'accusé ni de refus. Chaque fiche dit d'où il part, à qui, ce qu'il porte, et ce que le client en fait.

### `party:snapshot`

- **Qui l'émet** : `server/src/core/space.ts` — `broadcastSnapshot`, regroupé, et `sendSnapshot`, sur-le-champ et dans ses deux versions ; et `server/src/sockets.ts`, à la seule connexion qui se présente ou fait le geste (`party:watch`, `player:join`, `player:reprendre`, `player:setTeam`, `host:hello`).
- **À qui** : la version des téléphones à `space:<espace>` sauf `hosts:<espace>` ; la version des écrans à `hosts:<espace>`.
- **Charge** : `PartySnapshot` (`shared/types.ts`).

  | Champ | Versions | Ce qu'il porte |
  |---|---|---|
  | `players` | les deux | chaque invité (`PublicPlayer`) : identifiant, prénom, avatar, score de la soirée, équipe ; `nomAffiche` quand une marque d'homonymie le distingue ; `horsClassement` pour le chef qui anime seulement ; ce qu'ajoute un profil (niveau, finition, légendaire, laurier…), absent sans profil ; `connected`, aux écrans seulement |
  | `teams` | les deux | chaque équipe : effectif, total, moyenne, prix |
  | `bonuses` | les deux | les prix remis |
  | `session` | les deux | la partie en cours (`id`, `participantIds`), ou `null` |
  | `joinUrl` | les deux | l'adresse d'entrée, que porte le QR |
  | `space` | les deux | l'espace : son adresse, son nom, ses titres, « Invités au plus » |
  | `code` | les deux | le code du salon, tant qu'il vaut |
  | `finDuProgramme` | les deux | le dernier quiz du programme d'un salon a rendu son verdict |
  | `wifi` | les écrans (`null` aux téléphones) | le réseau de la soirée, pour son QR (`WIFI_SSID`, `WIFI_PASS`) |
  | `sauvegardeEnRetard` | les écrans | la base permanente refuse les écritures de la soirée depuis un moment |
  | `scene` | les écrans | l'écran de fin posé — podium, prix, victoire, clôture ; absent en salle d'attente |
  | `telecommande` | les écrans | un écran de l'espace se tient en télécommande |
  | `finEnRoute` | les écrans | `close` ou `discard` : une fin de soirée est en cours |

- **Effet** : le client remplace son instantané. Chaque version ne part que si elle a changé ; toutes les cinq minutes, les deux repartent, forcées. Quand la base permanente passe en retard ou s'en remet, seule la version des écrans part.
- **Écouté par** : `client/src/socket.ts`, `client/src/socketDuChef.ts`.

### `session:view`

- **Qui l'émet** : `server/src/core/engine.ts`, à chaque passage du moteur, et à qui revient (`resendViews`, `resendHostViews`).
- **À qui** : `player:<invité>` pour chaque participant, sa vue (`playerView`) ; `hosts:<espace>`, la vue d'animateur (`hostView`) ; l'écran qui se présente, la sienne.
- **Charge** : `{ sessionId, view }` — une `QuizPlayerView` ou une `QuizHostView` (`shared/games/quiz.ts`).
- **Effet** : le client range la vue sous sa partie. Une vue ne part que si elle a changé pour son destinataire, sauf vers qui revient d'une coupure ; celle des écrans part au plus quatre fois par seconde pendant que les réponses arrivent.
- **Écouté par** : `client/src/socket.ts`, `client/src/socketDuChef.ts`.

### `session:ended`

- **Qui l'émet** : `server/src/core/engine.ts`, quand une partie se termine.
- **À qui** : `space:<espace>`.
- **Charge** : `{ sessionId }`.
- **Effet** : le client oublie la vue de cette partie ; les téléphones reviennent à la salle d'attente.
- **Écouté par** : `client/src/socket.ts`, `client/src/socketDuChef.ts`.

### `toast`

- **Qui l'émet** : `server/src/sockets.ts`.
- **À qui** : la connexion qui a fait le geste ; `hosts:<espace>` pour une place reprise et des codes faux en rafale ; `player:<invité>` pour un déplacement d'équipe.
- **Charge** : `{ kind, message }`, `kind` valant `info` ou `error`.
- **Effet** : la page affiche le message (`showToast`, `client/src/state.ts`) ; la liaison du chef ne montre que les erreurs, sous sa barre. Les messages sont ceux des fiches ci-dessus : les issues de clôture et d'essai, les refus des équipes et des prix, l'erreur d'un lancement ou d'une commande, la place reprise, les codes faux, le déplacement d'équipe, le jeton refusé.
- **Écouté par** : `client/src/socket.ts`, `client/src/socketDuChef.ts`.

### `player:removed`

- **Qui l'émet** : `server/src/core/space.ts` (une exclusion, `exclure`), `server/src/sockets.ts` (un jeton refusé), `server/src/server.ts` (un compte supprimé).
- **À qui** : les connexions de l'invité exclu ; la connexion dont le jeton est refusé ; tout `space:<espace>` d'un compte qu'on supprime, dont les connexions sont ensuite coupées.
- **Charge** : `{ reason? }` — `soiree-close` ou `unknown-token` pour un jeton refusé ; rien pour une exclusion ou une suppression.
- **Effet** : sans motif, le téléphone oublie son identité, revient à l'entrée et lit « L'animateur t'a retiré de la soirée ». Avec un motif, une page d'aujourd'hui l'ignore — l'accusé de son `player:join` lui a tout dit ; seule une page d'avant s'en sert.
- **Écouté par** : `client/src/socket.ts`.

### `party:reset`

- **Qui l'émet** : `server/src/core/space.ts`, à la fin d'une soirée (`viderSoiree`).
- **À qui** : chaque connexion d'une fiche effacée qui n'a pas de fin de soirée à lire — les téléphones d'un essai effacé, ceux d'une soirée close sans rien de joué, et ceux entrés pendant une clôture.
- **Charge** : aucune.
- **Effet** : le téléphone oublie qui il était, pas son prénom : l'entrée le propose, pré-remplie, avec « Nouvelle soirée ! Rejoins-la pour jouer » s'il avait une identité. Le téléphone du chef du salon, lui, revient à l'accueil (`/`).
- **Écouté par** : `client/src/socket.ts`.

### `player:profil`

- **Qui l'émet** : `server/src/core/space.ts`, quand l'expérience d'un quiz se crédite et que le total du soir de ce profil a bougé, puis à la clôture.
- **À qui** : `player:<invité>`, pour un invité rattaché à un profil.
- **Charge** : `PublicProfile` (`shared/profil.ts`), le profil à jour.
- **Effet** : le téléphone remplace le profil reçu à la poignée de main : son niveau monte pendant la soirée.
- **Écouté par** : `client/src/views/PlayerApp.tsx`.

### `player:gain`

- **Qui l'émet** : `server/src/core/space.ts`, au crédit d'un quiz qui rapporte de l'expérience à ce profil.
- **À qui** : `player:<invité>`.
- **Charge** : `GainAnnonce` (`shared/fin.ts`) : l'expérience gagnée, le niveau avant et après, les finitions ouvertes.
- **Effet** : le téléphone fête le gain au podium du quiz — un niveau, une finition.
- **Écouté par** : `client/src/socket.ts`.

### `soiree:progres`

- **Qui l'émet** : `server/src/core/space.ts`, au crédit d'un quiz qui fait monter des profils de niveau.
- **À qui** : `hosts:<espace>`.
- **Charge** : `ProgresDeQuiz` (`shared/fin.ts`), `{ montees }`.
- **Effet** : l'écran commun affiche le bandeau des montées de niveau au podium du quiz ; une clôture l'efface.
- **Écouté par** : `client/src/socket.ts`.

### `soiree:fin`

- **Qui l'émet** : `server/src/core/space.ts`, à la clôture, une fois la soirée effacée.
- **À qui** : `player:<invité>`, chaque invité de la soirée close.
- **Charge** : `FinDeSoiree` (`shared/fin.ts`) : son rang, ses points, ses prix, ses hauts faits et, pour un profil, ce qu'il y a gagné.
- **Effet** : le téléphone n'incarne plus personne — il garde son prénom pour la soirée suivante —, garde sa fin (`quizz.fin.<espace>`) et l'affiche. Le serveur la retient aussi par jeton, en mémoire, pour le téléphone qui dormait (`player:join`, motif `soiree-close`).
- **Écouté par** : `client/src/socket.ts`.

### `soiree:cloture`

- **Qui l'émet** : `server/src/core/space.ts`, à la clôture ; `server/src/sockets.ts`, à un écran qui se présente pendant qu'elle est à l'écran.
- **À qui** : `hosts:<espace>` ; l'écran qui se présente.
- **Charge** : `ClotureDeSoiree` (`shared/fin.ts`) : la soirée, son podium, les équipes qui l'emportent, les hauts faits, les légendaires, les Divins descendus — leur nom, jamais leur récit —, les montées de niveau, les Éclats.
- **Effet** : l'écran commun l'annonce à la salle, et la scène passe à la clôture jusqu'à « La soirée suivante », un nouvel invité, un quiz lancé ou « Ouvrir le salon ».
- **Écouté par** : `client/src/socket.ts`.

## Ce que socket.io émet lui-même

Hors du contrat, `connect` et `disconnect`.

- **Au serveur**, `connection` pose les écouteurs de la connexion. `disconnect` la retire de son invité — qui passe hors ligne quand c'était sa dernière connexion —, rediffuse l'instantané, recalcule la vue d'animateur (elle montre qui, parmi ceux qu'on attend, est hors ligne) et, pour une télécommande, rend les coulisses à la télé. Son gestionnaire a son propre filet d'exceptions.
- **Au client**, `connect` remet l'horloge à mesurer et relance la présentation — `party:watch` et le jeton, ou `host:hello` ; `disconnect` allume le bandeau de liaison. Une coupure décidée par le serveur — session révoquée, télé arrivée à la fin de sa session, présentations refusées — ne se reconnecte pas d'elle-même : la console revient à son formulaire (« Session fermée — reconnecte-toi »), la télé à son code.

## Pour aller plus loin

- [Le temps réel](../architecture/temps-reel.md) — la vie d'une connexion, l'instantané, les vues, l'horloge, les accusés et les renvois
- [Vue d'ensemble de l'architecture](../architecture/vue-d-ensemble.md) — le chemin d'une réponse, du téléphone au miroir
- [Animer une soirée](../guides/animer-une-soiree.md) — les mêmes gestes, vus de la console
- [La sécurité](../architecture/securite.md) — les sessions, la réserve d'inscriptions, le cloisonnement des espaces
- [Les barèmes](baremes.md) — les délais et les limites de la salle
- [Les recettes](../contribuer/recettes.md) — ajouter un événement temps réel
