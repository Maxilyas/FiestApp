---
paths:
  - "server/src/core/{space,party,salons,places}.ts"
  - "server/src/sockets.ts"
  - "shared/{events,homonymes,clock,space,console}.ts"
  - "client/src/{socket,socketDuChef,chef,telecommande,remise,clock,veille}.ts"
  - "client/src/views/{PlayerApp,SalonApp}.tsx"
  - "client/src/components/{BarreDuChef,FeuilleDEquipe,Liaison,Absents,Reprendre,TeamPicker,Rejoindre}.tsx"
  - "server/test/{protocole,poignee-de-main,salle-attente,salle-vide,salons,barre-du-chef,chef-entree,fin-de-quiz-chef,equipes-du-chef,telephone-perdu,temps-reel,rafales,grande-salle,liaison-morte,garde-fous,remise,tele-salle,equipes-preparees}.test.ts"
---

# La salle : la liaison temps réel, les invités, les salons, la barre du chef

## Les fichiers

- `core/space.ts` — la soirée d'un espace : ses registres, ses salons socket, ses diffusions, son nom figé, ses crédits — et la scène des écrans d'animateur (`poserScene` : podium, prix, victoire, clôture), que la télé suit quand on anime à la télécommande
- `core/party.ts` — le registre des invités (identité par jeton, rattachement au profil, marques d'homonymie, connexions par socket)
- `core/salons.ts` — le code d'un salon : six chiffres tirés à son ouverture — au premier écran d'animateur qui se présente, ou par « Créer un salon » (`POST /api/joueur/salon`, qui crée l'espace du profil la première fois, à une adresse neutre `s-…`, sans compte d'animateur à demander) —, dans la base permanente et en mémoire ; il vaut encore une demi-heure après la clôture (`SURSIS_APRES_CLOTURE_MS`), puis le salon suivant en tire un neuf. `/<code>` redirige vers l'adresse de l'espace (`decrirePage`) ; vingt codes manqués par adresse, puis deux par minute, et même le bon ne se cherche plus. Six chiffres ne sont jamais le nom d'un espace (`isValidSlug`)
- `core/places.ts` — « Rendre sa place » : les codes à usage unique qui rendent sa fiche à un invité dont le téléphone est mort — en mémoire, vite périmés, cinq essais manqués par minute (la console est prévenue quand des codes faux la ferment) ; jamais pour une fiche à profil, et la reprise renouvelle le jeton
- `client/src/views/SalonApp.tsx` · `components/BarreDuChef.tsx` · `socketDuChef.ts` · `chef.ts` — « Créer un salon » (`/salon`) : les quiz de ce soir (le programme), où l'on voit les questions — une télé se branche par son code (`/tele`), « Une autre télé ? » rouvre le champ (la télé rechargée entre-temps montre un code neuf) ; branchée, la télé n'est qu'un écran de salle, dès son branchement et quand le téléphone du chef se verrouille (`ecranDeSalle`, règle `ecran-commun.md`) —, si le chef joue ou anime seulement — anime seulement, il suit la soirée sur la même interface, sa barre en bas, et répond sans que rien de lui ne compte : ni points, ni journal, ni attente, ni classement (`LancementDeQuiz.horsClassement`, `joueurs()` dans `games/quiz.ts`, redit à chaque `player:join` par son seul téléphone, écouté de lui seul) —, les équipes de ce soir, préparées avant d'ouvrir, hors des réglages (le souhait du propriétaire du 12 octobre 2026 : deux proposées, `EQUIPES_PROPOSEES`, un toucher en renomme une, `FeuilleDEquipe` sans membres à confirmer, « Ajouter une équipe » la suivante, `equipeSuivante` ; envoyées avec « Ouvrir le salon » et posées avant le premier invité — jamais par-dessus celles d'une soirée qui en a, `lireEquipesPreparees`, `SpaceRuntime.ouvrirSalon` ; retenues sur le téléphone, `ReglagesDuChef.equipesPreparees` ; le chef qui joue choisit la sienne en entrant — `equipes-preparees.test.ts`), et repliés dans « Réglages », le rythme et les points ; puis la barre du chef en bas de son téléphone de joueur, chargée à la demande sur le seul téléphone qui a ouvert le salon (`chefIci`) : le code et son QR, le quiz lancé au programme, la pause, révéler, la suite, et à l'écart, dans « ⋯ », ce qui défait quelque chose — et les équipes : celles préparées en créant le salon, sinon deux d'office (une page d'avant), un toucher en renomme une, « Ajouter une équipe » en crée une (`FeuilleDEquipe`, son nom et son emoji). Ses gestes passent par une seconde liaison, celle de l'animateur (`socketDuChef`) — une seule ne tient pas les deux rôles —, qui se dit télécommande à chaque connexion (`host:telecommande` : la télé garde ses coulisses pour lui, et ne propose pas de se piloter tant qu'il est là), et elle ne lit de la vue d'animateur que sa phase, le compte des réponses et si le quiz est le dernier du programme (`dernierDuProgramme` : « Terminer le quiz » le dit avant de clore la soirée — `barre-du-chef.test.ts`, `cloture-auto.test.ts`). « Ouvrir le salon » le fait entrer dans sa soirée sans « Entrer dans la soirée » (`demanderEntree`, une fois), et une soirée effacée sans rien de joué le ramène à l'accueil, pas à l'entrée (`party:reset`, `client/src/socket.ts` ; `chef-entree.test.ts`). Le dernier quiz joué, sa barre dit « Terminer la soirée », et le podium reste jusqu'à ce geste — rien ne se décompte. Sous sa fin de soirée, une ligne « Ton salon » ouvre sa feuille : « Encore un quiz, avec eux », « C'était un essai » — un seul « Accueil » sur la page
- `sockets.ts` — tout le protocole temps réel — chaque message passe par `ecouter()`, et chaque geste d'animateur relit la session de sa poignée de main (`requireHost`)
- `shared/events.ts` — le contrat socket, typé des deux côtés
- `shared/homonymes.ts` — « Camille (2) » : la dérivation pure qui distingue deux invités identiques
- `client/src/components/Liaison.tsx` — ce que voit l'invité quand la liaison tombe
- `client/src/components/Absents.tsx` · `Reprendre.tsx` — le téléphone perdu : « Qui manque ? » à la console (ne plus l'attendre, rendre sa place), et le code tapé par l'invité

## Les pièges

- **Pas de `socket.on` direct pour un message client** : `ecouter()` le fait
  pour toi, charge normalisée et accusé optionnel compris. Côté client,
  `watchParty` et `helloHost` rejettent sur délai (`demander`), alors que
  `joinAsPlayer` et `setMyTeam` résolvent un refus. Un geste de la partie
  part par `envoyerCommande` (accusé, sonde, un renvoi — il porte sa
  visée), une réponse sonde la liaison avant son renvoi (`verifierLiaison`
  rend la sonde en cours), et un prix se remet avec l'identifiant de son
  geste (`remise`, `client/src/remise.ts`) : un double clic ne le remet
  qu'une fois.
- **L'entrée paraît avant la liaison.** La page d'un invité précharge son
  état de départ (`/s/<espace>/entree.json`, `shared/depart.ts`) : ce que
  `party:watch` dirait, l'instantané des téléphones et le profil du cookie.
  Elle ne s'en sert que sans rien à reprendre (`entreeUtilisable`) : un
  jeton attend sa re-présentation — l'instantané seul montrait la salle
  d'attente d'un invité que la soirée ne connaît peut-être plus —, une fin
  de soirée gardée passe d'abord, et ce que la liaison a dit l'emporte. Un
  geste fait avant la liaison l'attend (`demander`, dix secondes), et
  `party:watch` part toujours avant lui : la présentation s'écoute dès
  l'ouverture de la page. Le bandeau de coupure de l'entrée attend la
  première liaison, quatre secondes au plus (`PREMIERE_LIAISON_MS`) :
  « Connexion perdue » clignotait sur chaque téléphone qui scannait le QR.
  Et le téléphone qui revient — rechargé, réveillé — envoie son jeton juste
  derrière `party:watch`, sans attendre sa réponse : la liaison garde
  l'ordre, et chaque réveil coûte un aller-retour de moins (`depart.test.ts`).
  Ouvrir la liaison dès le code de la page arrivé (`main.tsx`) plutôt
  qu'au premier rendu, essayé le 11 octobre 2026 : elle s'ouvrait 45 ms plus
  tôt, et la salle d'attente ne gagnait rien de mesurable — en 4G, c'est la
  poignée de main du WebSocket qui pèse (340 ms). Et un second `connect()`
  sur un transport déjà ouvert renverrait la présentation de l'espace de
  noms : une seconde socket au serveur, sur la même liaison.
- **Toute mutation de `Party` qui touche un prénom, un avatar ou la
  composition invalide le cache des marques** d'homonymie.
- **Une nouvelle commande `host:*`** s'ajoute à la liste de
  `garde-fous.test.ts`, qui vérifie qu'un téléphone ne peut pas la jouer — le
  typecheck le rappelle. **Une route d'administration vit sous
  `/api/admin`** : gardée d'un bloc (`api.ts`, administrateur seul, jamais
  une télé branchée), elle entre d'elle-même dans `admin-seulement.test.ts`.

## L'invariant 4, en entier

4. **L'instantané est dédoublonné et regroupé** (`space.ts`). N'y mets jamais
   un champ qui change à chaque tick : il partirait à toute la salle. Il en
   part deux versions, chacune dédoublonnée : celle des écrans d'animateur,
   qui porte en plus le wifi, la scène et la télécommande
   (`enPlusPourLesEcrans`) — la salle ne reçoit rien quand seule la scène
   change —, et celle des téléphones, **sans `connected`**
   (`pourLesTelephones`) — une veille d'écran ne repart qu'à l'écran commun. Le regroupement des
   téléphones grandit avec la salle (120 ms + 2 ms par invité), celui des
   écrans communs reste à 120 ms ; et celui qui fait le geste (`join`,
   `setTeam`) reçoit le sien sur-le-champ — au `join`, une fois compté dans
   la partie et avant sa première vue. Ce qui change la salle sans veille
   (réglages, parures, un prénom) diffuse de lui-même : la veille des autres
   ne le porte plus.

## L'invariant 9, en entier

9. **La fiche du serveur fait foi.** Un `player:join` qui porte un jeton est
   une re-présentation : prénom et avatar envoyés sont ignorés — sinon le
   renommage d'un pseudo par l'animateur tombait au réveil du téléphone. Le
   second appareil d'un profil déjà là, sans jeton, ne redéclare pas non
   plus le prénom de sa fiche — seulement son avatar, que l'animateur ne
   change pas. Un
   jeton qui ne désigne plus personne (exclu, essai effacé) est refusé
   (`unknown-token`), **jamais recréé** : le téléphone repasse par l'entrée,
   pré-remplie. Celui d'une soirée qu'on vient de clore reçoit sa fin de
   soirée (`soiree-close`) — que le téléphone n'affiche que réveillé sur la
   page où il jouait : arrivé pour jouer, il la garde pour l'entrée
   (`recevoirFinRendue`) ; après un redémarrage qui l'a oubliée, un
   `unknown-token` qui porte la soirée close à revoir (`derniere`). Un
   nouveau téléphone ne prend le jeton d'une fiche que par le code que
   l'animateur fait paraître (`player:reprendre`), jamais sur un prénom
   retapé.
