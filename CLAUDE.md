# Notes pour Claude

Quiz de soirée façon Kahoot, auto-hébergé. Les invités jouent depuis leur
téléphone, un écran commun anime la salle. Plusieurs animateurs partagent le
serveur : chacun a **son compte et son espace**, et ne voit rien de ceux des
autres.

Le `README.md` explique le produit à un humain. Ce fichier-ci explique le code
à un agent : ce qu'il faut savoir avant de toucher quoi que ce soit.

## Les commandes

```bash
npm run verify   # typecheck + build + test de bout en bout — À LANCER AVANT DE COMMITTER
npm run dev      # serveur + client, http://localhost:5173
npm run smoke    # le test de bout en bout seul (~90 s)
```

Il n'y a **pas d'autre suite de tests**, pas de linter, pas de formateur.
`npm run smoke` boote un vrai serveur sur une base jetable et rejoue une
soirée entière. C'est la référence : si elle passe, ça marche.

## La carte du code

```
shared/     types et fonctions PURES, partagés client ↔ serveur ↔ test
server/src/core/    les registres et le moteur
server/src/games/   les règles du quiz
client/src/views/   une page = un fichier
```

| Fichier | Ce qu'il porte |
|---|---|
| `core/engine.ts` | route actions/commandes/timers vers le module de jeu, persiste, rediffuse les vues filtrées |
| `games/quiz.ts` | **toutes** les règles : phases, chronomètres, barème, vues |
| `core/space.ts` | la soirée d'un espace : ses registres, ses salons socket, ses diffusions |
| `core/party.ts` | le registre des invités (identité par jeton, rattachement au profil, marques d'homonymie) |
| `core/scores.ts` | journal des gains, en ajout seul |
| `core/answers.ts` | une ligne par invité et par question posée, y compris sans réponse |
| `core/recap.ts` `review.ts` `stats.ts` `progress.ts` | **dérivations pures** des journaux |
| `auth/store.ts` | comptes d'animateurs — c'est-à-dire **des espaces** : `accounts.id` EST le `space_id` |
| `auth/profiles.ts` | profils de joueurs (autre table, autre cookie) |
| `auth/profileRoutes.ts` | la porte d'entrée : se connecter à son profil ouvre aussi la console de l'espace rattaché |
| `client/src/views/ProfilApp.tsx` | l'accueil (`/`) autant que `/profil` : qui je suis, ce que j'anime, ce que je rejoins |
| `sockets.ts` | tout le protocole temps réel |
| `shared/events.ts` | le contrat socket, typé des deux côtés |
| `shared/homonymes.ts` | « Camille (2) » : la dérivation pure qui distingue deux invités identiques |
| `client/src/components/Entree.tsx` | tout ce qu'on traverse entre le scan du QR et la salle d'attente |

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
7. **Toute réponse d'invité reçoit un accusé.** Jamais de `return` muet dans
   `player:action` — c'est exactement le bug qu'on a passé une session à
   traquer.
8. **Un profil ne donne aucun avantage de jeu**, et un invité anonyme
   n'affiche **rien** : ni « Niv. 0 », ni pastille grise. L'absence, pas
   l'infériorité. Un profil reconnu, en revanche, **ne rechoisit jamais** son
   prénom ni son avatar : `player:join` sans `name` ni `avatar` les prend
   dans le profil.
9. **Les profils se créditent à la fin de chaque quiz**, puis une dernière
   fois dans `archiveParty()`, avant tout effacement. C'est l'idempotence qui
   le permet : la ligne `(profil, soirée)` est remplacée, jamais ajoutée.
   Attendre l'archivage, c'était ne rien donner à celui qui venait de gagner —
   un animateur range sa soirée quand il y pense, parfois jamais. Les
   **badges**, eux, restent à l'archivage : ils se décernent sur la soirée
   entière, et un prix donné trop tôt ne se reprend plus.
10. **Les dérivations restent pures.** La soirée en cours et une archive
    passent par le même chemin — une amélioration profite aux soirées passées.
11. **Une personne, deux tables — et `accounts.id` ne bouge jamais.** Un
    compte est un **espace** (slug, réglages, et l'identifiant qui cloisonne
    tout le reste) ; un profil est une **personne** (prénom, avatar,
    expérience). `accounts.profile_id` dit qui tient l'espace : se connecter
    à son profil ouvre alors la console sans rien redemander, et la
    déconnexion la referme — mais seulement celle que CE profil avait
    ouverte. Pour poser le lien, il faut prouver les deux identités ; après,
    une seule porte suffit. Ne fusionne pas les deux tables : l'identifiant
    d'un compte est la clé de partition de dix tables et de toutes les
    archives.
12. **Les homonymes se règlent à l'affichage, jamais à la saisie.** On ne
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

## Les deux environnements

`render.yaml` décrit **deux services** : `quizz-romane-30` (production, déployée
à la main) et `fiestapp-preprod` (préproduction, déployée à chaque fusion sur
`main`). Ils ne diffèrent que par `QUIZ_DB_URL` — tout le précieux est dans
Turso, la base locale est jetable.

**Jamais la même base Turso pour les deux** : un « Nouvelle soirée » en
préproduction effacerait de vraies soirées archivées. Hors production,
`APP_ENV` pose un bandeau sur toutes les pages (injecté dans `index.html` par
`server.ts`, affiché par `main.tsx`).

## Les pièges de ce dépôt

- **`smoke.ts` est stateful de bout en bout.** Une soirée jouée insérée au
  milieu casse les assertions d'après (statistiques, bilan, archives). Les
  tests qui jouent une partie complète se mettent **en fin de fichier, sur
  leur propre serveur jetable** — voir les sections 32, 33 et 34.
- **Un serveur qu'on ferme doit éteindre ses chronomètres.** Un chrono de
  question qui sonne après `close()` révèle sur une base fermée et emporte le
  processus — c'est ce que fait `GameEngine.stop()`. Allonger le smoke suffit
  à réveiller ce genre de fantôme : le symptôme (« The database connection is
  not open ») ne désigne jamais la section qui l'a déclenché.
- **Les accusés socket** doivent tolérer un client qui n'en attend pas :
  `typeof ack === 'function' ? ack : () => {}`. Les scripts d'essai et les
  téléphones restés sur une vieille page n'en envoient pas.
- **`package-lock.json` bouge tout seul** selon la version de npm. Ne le
  committe pas si ce n'est pas le sujet.
- **En CSS, `transform` se compose APRÈS `rotate`** : centrer par
  `transform: translate(-50%,-50%)` un élément qui tourne l'envoie balader.
  Centre par marges.
- **Regarde le rendu.** Trois bugs de cette base n'étaient visibles qu'à
  l'écran, pas au typecheck. Chromium et Playwright sont disponibles.

## Ce qu'il ne faut pas faire

- Toucher aux barèmes (`CHOICE_POINTS`, `XP`, `CHANCE_ECLAT`…) sans le dire :
  ce sont des choix de produit, pas des constantes techniques.
- Rendre la connexion obligatoire. L'entrée d'une soirée **est** un écran de
  connexion, et l'accueil (`/`) en est un aussi : c'est un choix assumé — mais
  « Jouer sans compte » et « Rejoindre une soirée » y ont exactement le format
  de « Me connecter » et se voient **sans défiler** en 360 × 640, clavier fermé.
  Aucun champ n'y a d'`autoFocus` : le clavier pousserait ce bouton-là hors de
  l'écran. **Le chemin anonyme reste la valeur de l'application** ; les profils
  s'y greffent, ne le remplacent pas.
- Supprimer ou désactiver une assertion du smoke pour la faire passer.
