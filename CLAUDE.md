# Notes pour Claude

Quiz de soirée façon Kahoot, auto-hébergé. Les invités jouent depuis leur
téléphone, un écran commun anime la salle. Plusieurs animateurs partagent le
serveur : chacun a **son compte et son espace**, et ne voit rien de ceux des
autres.

Le `README.md` explique le produit à un humain. Ce fichier-ci explique le code
à un agent : ce qu'il faut savoir avant de toucher quoi que ce soit.

## Les commandes

```bash
npm run verify     # typecheck + tests + build + test de bout en bout — À LANCER AVANT DE COMMITTER
npm run dev        # serveur + client, http://localhost:5173
npm test           # les tests ciblés de server/test/ (node:test, environ une minute)
npm run smoke      # le test de bout en bout seul (~90 s)
npm run sauvegarde # la base permanente en SQL daté, dans export/sauvegardes/
```

Deux suites, aucune dépendance de plus, et toujours ni linter ni formateur.
`npm run smoke` boote un vrai serveur sur une base jetable et rejoue une
soirée entière : c'est la référence du chemin normal. `npm test` lance
`server/test/*.test.ts` avec `node:test` : ce qu'une soirée rejouée d'un bout
à l'autre ne provoque jamais — pannes, courses, messages malformés,
redémarrages. Chaque fichier qui a besoin d'un serveur démarre le sien,
jetable, avec `server/test/banc.ts` ; les dérivations pures se testent
directement. **Un nouveau comportement arrive avec son test dans
`server/test/`**, qui échoue avant la correction : on n'allonge plus le smoke.

## La carte du code

```
shared/     types et fonctions PURES, partagés client ↔ serveur ↔ test
server/src/core/    les registres et le moteur
server/src/games/   les règles du quiz
client/src/views/   une page = un fichier
server/test/        un fichier par thème, un serveur jetable chacun
```

| Fichier | Ce qu'il porte |
|---|---|
| `core/engine.ts` | route actions/commandes/timers vers le module de jeu, persiste, rediffuse les vues filtrées |
| `games/quiz.ts` | **toutes** les règles : phases, chronomètres, barème, vues |
| `core/space.ts` | la soirée d'un espace : ses registres, ses salons socket, ses diffusions, son nom figé, ses crédits |
| `core/party.ts` | le registre des invités (identité par jeton, rattachement au profil, marques d'homonymie, connexions par socket) |
| `core/scores.ts` | journal des gains, en ajout seul |
| `core/answers.ts` | une ligne par invité et par question posée, y compris sans réponse |
| `core/backup.ts` | le miroir de la soirée dans Turso : une file par espace, ordonnée, qui insiste ; la resynchronisation après une panne ; sa santé |
| `core/distante.ts` | le client libsql, avec un délai : une base muette se dit en dix secondes, pas en cinq minutes |
| `core/archive.ts` | l'historique : une fiche par soirée, relue avec les règles du jour ; `Soiree`, le nom figé |
| `core/recap.ts` `review.ts` `stats.ts` `progress.ts` | **dérivations pures** des journaux |
| `core/http.ts` | ce qu'une erreur laisse lire : `wrap`, `erreurMontrable`, `messagePourEcran`, `erreurDeRequete` |
| `auth/store.ts` | comptes d'animateurs — c'est-à-dire **des espaces** : `accounts.id` EST le `space_id` |
| `auth/profiles.ts` | profils de joueurs (autre table, autre cookie) |
| `auth/profileRoutes.ts` | la porte d'entrée : se connecter à son profil ouvre aussi la console de l'espace rattaché |
| `auth/http.ts` | cookies, adresse du client, et `loginBudgetOf(app)` : la réserve d'essais commune à toutes les portes |
| `client/src/views/ProfilApp.tsx` | l'accueil (`/`) autant que `/profil` : qui je suis, ce que j'anime, ce que je rejoins |
| `sockets.ts` | tout le protocole temps réel — chaque message passe par `ecouter()` |
| `shared/events.ts` | le contrat socket, typé des deux côtés |
| `shared/homonymes.ts` | « Camille (2) » : la dérivation pure qui distingue deux invités identiques |
| `shared/classement.ts` | la seule règle des ex æquo : rang partagé, vainqueurs, ordre d'affichage |
| `shared/securite.ts` | la page de retour après connexion : jamais ailleurs que chez soi |
| `shared/erreurs.ts` | les motifs que le client montre quand ça coince (réseau, serveur qui redémarre…) |
| `client/src/components/Entree.tsx` | tout ce qu'on traverse entre le scan du QR et la salle d'attente |
| `client/src/components/Liaison.tsx` | ce que voit l'invité quand la liaison tombe |
| `server/scripts/sauvegarde.ts` | la sauvegarde SQL de la base permanente, restaurable par `turso db shell` |

## Les invariants — à ne jamais casser

1. **La logique de jeu est 100 % serveur.** Les clients reçoivent
   `playerView` / `hostView`, jamais l'état brut : sinon la bonne réponse
   arrive dans le téléphone avant la révélation.
2. **Deux bases, deux rôles.** La locale (SQLite) est **jetable** et « Nouvelle
   soirée » la vide. Ce qui doit survivre — comptes, quiz, archives, profils —
   va dans la permanente (libsql/Turso).
3. **Tout est cloisonné par `space_id`.** Un identifiant qui n'est pas du sien
   vaut « introuvable », et le voisin n'en sait rien.
4. **L'instantané est dédoublonné et regroupé** (`space.ts`). N'y mets jamais
   un champ qui change à chaque tick : il partirait à toute la salle.
5. **Les chronomètres sont persistés** et réarmés au redémarrage.
6. **Une échéance se lit à `serverNow()`**, jamais à `Date.now()` : l'horloge
   d'un téléphone dérive, et on a déjà perdu des réponses pour ça.
7. **Toute réponse d'invité reçoit un accusé**, et **tout message d'un client
   passe par `ecouter()`** (`sockets.ts`) : la charge devient un objet,
   l'accusé une fonction, l'exception un journal. Un seul `player:action` sans
   charge, un seul `party:watch` sans accusé tuait le processus — et les
   soirées de tous les espaces avec.
8. **Un profil ne donne aucun avantage de jeu**, et un invité anonyme
   n'affiche **rien** : ni « Niv. 0 », ni pastille grise. L'absence, pas
   l'infériorité. Un profil reconnu, en revanche, **ne rechoisit jamais** son
   prénom ni son avatar : `player:join` sans `name` ni `avatar` les prend
   dans le profil.
9. **La fiche du serveur fait foi.** Un `player:join` qui porte un jeton est
   une re-présentation : prénom et avatar envoyés sont ignorés — sinon le
   renommage d'un pseudo par l'animateur tombait au réveil du téléphone. Un
   jeton qui ne désigne plus personne (exclu, « Nouvelle soirée ») est refusé
   (`unknown-token`), **jamais recréé** : le téléphone repasse par l'entrée,
   pré-remplie.
10. **Les profils se créditent dès que le quiz rend son verdict** (son podium
    s'affiche), à la fin de la partie, puis une dernière fois dans
    `archiveParty()`, avant tout effacement. C'est l'idempotence qui le
    permet : la ligne `(profil, soirée)` est remplacée, jamais ajoutée. Les
    **prix de la soirée** se remplacent de même à chaque archivage, en un seul
    lot (`remplacerPrixDeSoiree`) — un « Sauvegarder » à mi-soirée ne fige
    rien. Les badges de **carrière**, eux, ne se reprennent jamais.
11. **Le nom d'une soirée se tire une fois** (`soireeEnCours`) et ne se
    recalcule jamais : exclure le premier arrivé ou redémarrer ne le change
    pas, seul `resetParty` l'oublie. Toute écriture permanente sous ce nom
    passe d'abord par `recopierSoiree`. Recalculé, il comptait l'expérience
    deux fois et dédoublait l'archive.
12. **Un geste dit ce qu'il visait.** Les commandes `next`, `cancel`, `replay`
    et les réponses portent la phase, la question et le tour : une commande
    périmée est ignorée en silence, une réponse périmée reçoit `too-late`, et
    un champ absent (une page d'avant) garde l'ancien comportement. Sans ça,
    un « Révéler » qui croisait la révélation automatique sautait la
    révélation.
13. **Rien ne se perd en route vers le miroir.** Chaque écriture de la soirée
    rejoint la file de son espace, ordonnée, qui insiste jusqu'au succès ;
    gains et réponses portent un `uid` tiré en local, pour un rejeu sans
    doublon ; un `run()` envoie l'état de la partie **avec** ses gains et ses
    réponses, en un seul lot (`ouvrirLot` / `fermerLot`) — sinon un arrêt
    brutal faisait payer une question deux fois. « Nouvelle soirée » efface le
    miroir **avant** la base locale.
14. **Les dérivations restent pures.** La soirée en cours et une archive
    passent par le même chemin — une amélioration profite aux soirées passées.
15. **Un classement passe par `shared/classement.ts`.** Rang = 1 + le nombre
    de concurrents strictement devant ; tous les ex æquo en tête gagnent.
    Cinq règles de départage différentes donnaient trois vainqueurs à un même
    quiz.
16. **Une personne, deux tables — et `accounts.id` ne bouge jamais.** Un
    compte est un **espace** (slug, réglages, et l'identifiant qui cloisonne
    tout le reste) ; un profil est une **personne** (prénom, avatar,
    expérience). `accounts.profile_id` dit qui tient l'espace : se connecter
    à son profil ouvre alors la console sans rien redemander, et la
    déconnexion la referme — mais seulement celle que CE profil avait
    ouverte. Pour poser le lien, il faut prouver les deux identités ; après,
    une seule porte suffit. Ne fusionne pas les deux tables : l'identifiant
    d'un compte est la clé de partition de dix tables et de toutes les
    archives.
17. **Les homonymes se règlent à l'affichage, jamais à la saisie.** On ne
    refuse personne et on ne renomme personne : `nomsAffiches()` marque
    « Camille (2) » quand le prénom **et** l'avatar sont partagés, et cette
    marque n'est **jamais** écrite en base — elle s'efface d'elle-même quand
    l'homonyme s'en va. Un prénom sort par trois portes (`publicPlayers`,
    `publicOne`, `ViewContext.playerName`) : c'est la troisième qu'on oublie,
    et c'est elle qui écrit sur le vidéoprojecteur.

## Les conventions

- **Commentaires en français**, et ils disent **pourquoi**, pas *quoi*. Un
  commentaire qui paraphrase le code est du bruit ; un commentaire qui raconte
  la décision ou le bug évité vaut de l'or. C'est la marque du dépôt : garde-la.
- Noms : anglais pour l'infrastructure historique (`Party`, `ScoreLedger`),
  français pour le domaine récent (`Finition`, `niveauPour`, `Carriere`).
- **Très peu de dépendances**, et c'est voulu. N'en ajoute pas sans raison forte.
- **Emojis antérieurs à Unicode 13 uniquement** : l'écran commun tourne sous
  Windows 10, les plus récents s'y affichent en carré vide.
- Les messages d'erreur sont lus par des invités dans le noir : courts, en
  français, et ils disent quoi faire.
- **Une erreur faite pour être lue se lève avec un `new Error('…')` nu**, sans
  `code`. Toute autre classe (LibsqlError, TypeError…) devient un 500 neutre
  dans une route (`repondreErreur`) ou « Erreur serveur » dans un toast de
  l'écran commun (`messagePourEcran`), et son détail part au journal.
- **Un texte se coupe avec `tronquer()`** (`shared/avatars.ts`), jamais avec
  `slice()` : un emoji à la frontière laissait sa moitié en base.
- **Ce qui ne dépend pas du destinataire d'une vue** — un classement, un
  podium — passe par `vctx.memo` : un tri par vue coûtait une demi-minute par
  question à 500 invités.
- **Côté client** : `--accent-text` pour ce qui s'écrit, `--accent` pour les
  aplats (le contraste d'Ivoire en dépend) ; tout accès au stockage du
  navigateur sous try/catch — des cookies bloqués donnaient une page noire.

## Les deux environnements

Deux services Render : la production (déployée à la main) et la
préproduction (déployée à chaque fusion sur `main`). Ils ne diffèrent que par
`QUIZ_DB_URL` — tout le précieux est dans Turso, la base locale est jetable.
Les services ont été créés à la main : c'est leur tableau de bord qui fait
foi, commandes de build et de démarrage comprises, et `render.yaml` n'en est
que la référence.

**Noms en suspens** : les services réels s'appellent `quizz-romane-30` et
`fiestapp-preprod`, mais `render.yaml` porte depuis `b2a09ad` les noms
`fiestapp-quizz` et `fiestapp-quizz-preprod`. Tant que le propriétaire n'a
pas tranché, ne synchronise aucun blueprint : Render créerait des copies à de
nouvelles adresses (MISE-EN-LIGNE.md, étape 7).

**Jamais la même base Turso pour les deux** : un « Nouvelle soirée » en
préproduction effacerait de vraies soirées archivées. Hors production,
`APP_ENV` pose un bandeau sur toutes les pages (injecté dans `index.html` par
`server.ts`, affiché par `main.tsx`). En ligne, le serveur refuse de démarrer
sans `QUIZ_DB_URL`.

## Les pièges de ce dépôt

- **`smoke.ts` est stateful de bout en bout.** Une soirée jouée insérée au
  milieu casse les assertions d'après (statistiques, bilan, archives). C'est
  pourquoi les nouveaux tests vont dans `server/test/`, un serveur jetable par
  fichier ; ceux qui vivent encore en fin de smoke (sections 32 à 35) y ont
  chacun le leur.
- **Le serveur envoie l'instantané juste derrière l'accusé** de `host:hello`
  ou de `party:watch`, souvent dans le même paquet : un écouteur posé après
  avoir attendu l'accusé le rate. `banc.ts` retient le dernier pour ça
  (`instantane()`).
- **Un serveur qu'on ferme doit éteindre ses chronomètres** et vider son
  miroir avant de fermer la base locale, que la resynchronisation relit.
  Un chrono de question qui sonne après `close()` révèle sur une base fermée —
  c'est ce que fait `GameEngine.stop()`. Allonger le smoke suffit à réveiller
  ce genre de fantôme : le symptôme (« The database connection is not open »)
  ne désigne jamais la section qui l'a déclenché.
- **Pas de `socket.on` direct pour un message client** : `ecouter()` le fait
  pour toi, charge normalisée et accusé optionnel compris. Côté client,
  `watchParty` et `helloHost` rejettent sur délai (`demander`), alors que
  `joinAsPlayer` et `setMyTeam` résolvent un refus.
- **`loginBudgetOf(app)`, jamais `new LoginBudget()`** : toutes les portes qui
  ouvrent une console partagent la même réserve d'essais.
- **Les crédits lisent les journaux avant le premier `await`** et passent par
  `enFile` : un « Nouvelle soirée » cliqué pendant un archivage viderait sinon
  ce qu'ils lisent.
- **Toute mutation de `Party` qui touche un prénom, un avatar ou la
  composition invalide le cache des marques** d'homonymie.
- **`/healthz` doit rester un 200** : sur un échec, Render redémarre
  l'instance — disque effacé, file du miroir perdue. La santé du miroir se lit
  dans son bloc `miroir`, et la resynchronisation **n'efface jamais** : un PC
  de secours lancé sur de vieux essais viderait sinon la vraie soirée.
- **Simuler une panne** : un déclencheur `RAISE(ABORT)` sur le fichier `file:`
  qui tient lieu de Turso (`miroir.test.ts`) ; un vrai démarrage, un SIGTERM
  ou un SIGKILL, en lançant `src/index.ts` dans un processus enfant
  (`exploitation.test.ts`).
- **Une nouvelle commande `host:*`** s'ajoute à la liste de
  `garde-fous.test.ts`, qui vérifie qu'un téléphone ne peut pas la jouer — le
  typecheck le rappelle.
- **`package-lock.json` bouge tout seul** selon la version de npm. Ne le
  committe pas si ce n'est pas le sujet (le hook installe en `--no-save`).
- **En CSS, `transform` se compose APRÈS `rotate`**, et une animation qui pose
  `transform` écrase celui de l'élément : le toast, centré par
  `translateX(-50%)`, partait sur la droite. Centre par marges.
- **Regarde le rendu.** Plusieurs bugs de cette base n'étaient visibles qu'à
  l'écran, pas au typecheck. Chromium et Playwright sont disponibles.

## Ce qu'il ne faut pas faire

- Toucher aux barèmes (`CHOICE_POINTS`, `XP`, `CHANCE_ECLAT`…) sans le dire :
  ce sont des choix de produit, pas des constantes techniques.
- Rendre la connexion obligatoire. L'entrée d'une soirée **est** un écran de
  connexion, et l'accueil (`/`) en est un aussi : c'est un choix assumé — mais
  « Jouer sans compte » et « Rejoindre une soirée » y ont exactement le format
  de « Me connecter » et se voient **sans défiler** en 360 × 640, clavier fermé.
  Aucun champ de l'entrée ni de `ProfilForm` n'a d'`autoFocus` : le clavier
  pousserait le bouton hors de l'écran. **Le chemin anonyme reste la valeur de
  l'application** ; les profils s'y greffent, ne le remplacent pas.
- Supprimer ou désactiver une assertion — du smoke ou d'un test — pour la
  faire passer.
