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
npm run tablee     # une soirée jouée par des agents (régie + /tablee) : voir .claude/skills/tablee/
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
| `games/quiz.ts` | **toutes** les règles : phases, chronomètres, barème (le temps de lecture offert au QCM, l'estimation payée à la distance), vues |
| `core/space.ts` | la soirée d'un espace : ses registres, ses salons socket, ses diffusions, son nom figé, ses crédits |
| `core/party.ts` | le registre des invités (identité par jeton, rattachement au profil, marques d'homonymie, connexions par socket) |
| `core/scores.ts` | journal des gains, en ajout seul |
| `core/answers.ts` | une ligne par invité et par question posée, y compris sans réponse |
| `core/backup.ts` | le miroir de la soirée dans Turso : une file par espace, ordonnée, qui insiste ; la resynchronisation après une panne ; sa santé |
| `core/distante.ts` | le client libsql, avec un délai : une base muette se dit en dix secondes, pas en cinq minutes ; et `ajouterColonne()`, qui lit le schéma avant de migrer et laisse toute panne arrêter le démarrage |
| `core/archive.ts` | l'historique : une fiche par soirée, relue avec les règles du jour ; `Soiree`, le nom figé |
| `core/recap.ts` `review.ts` `stats.ts` `progress.ts` | **dérivations pures** des journaux |
| `core/journal.ts` | le journal rangé question par question et quiz par quiz : la seule lecture qu'en font l'expérience et les hauts faits |
| `core/hautsfaits.ts` | les hauts faits d'une soirée, invité par invité — dérivation pure, jouée à la clôture et sur les archives |
| `core/recalcul.ts` | au démarrage, relit l'historique au barème du jour (`VERSION_BAREME`) : expérience, prix, hauts faits, paliers |
| `shared/hautsfaits.ts` `shared/legendaires.ts` | le catalogue des hauts faits (soirée, carrière en trois paliers) et les douze avatars légendaires qui s'en débloquent — sur la durée : une vingtaine de quiz au premier qui en décroche un |
| `shared/fin.ts` | ce que la soirée annonce : au podium d'un quiz, à la clôture — au téléphone (`soiree:fin`) et à la salle (`soiree:cloture`) |
| `shared/carte.ts` | la carte d'un joueur, ouverte en touchant son nom (`/s/<espace>/joueurs/<id>.json`) |
| `shared/categories.ts` | la liste fixe des catégories de questions, la même chez tous les animateurs |
| `shared/echange.ts` | un quiz qu'on emporte : le fichier d'export (questions, photos en clair), sa lecture, et l'import, qui repasse par l'envoi d'image et la création de quiz — le navigateur et les tests par le même chemin |
| `client/src/components/Legendaire.tsx` | les douze médaillons, en SVG ; verrouillés, une silhouette dorée ; portés, la finition devient leur cercle, et l'Éclat leur donne leur version rare |
| `shared/divins.ts` · `core/divins.ts` | les cinq Divins : le nom, public ; les règles et les légendes, **secrètes**, côté serveur seulement |
| `client/src/components/Divin.tsx` | les cinq dessins, qui débordent de leur cadre ; verrouillés, une nébuleuse sans nom |
| `core/http.ts` | ce qu'une erreur laisse lire : `wrap`, `erreurMontrable`, `messagePourEcran`, `erreurDeRequete` |
| `auth/store.ts` | comptes d'animateurs — c'est-à-dire **des espaces** : `accounts.id` EST le `space_id` |
| `auth/profiles.ts` | profils de joueurs (autre table, autre cookie) |
| `auth/profileRoutes.ts` | la porte d'entrée : se connecter à son profil ouvre aussi la console de l'espace rattaché |
| `auth/http.ts` | cookies, adresse du client, et `loginBudgetOf(app)` : la réserve d'essais commune à toutes les portes |
| `client/src/views/ProfilApp.tsx` | l'accueil (`/`) autant que `/profil` : qui je suis, ce que j'anime, ce que je rejoins |
| `sockets.ts` | tout le protocole temps réel — chaque message passe par `ecouter()` |
| `shared/events.ts` | le contrat socket, typé des deux côtés |
| `shared/homonymes.ts` | « Camille (2) » : la dérivation pure qui distingue deux invités identiques |
| `shared/classement.ts` | la seule règle des ex æquo : rang partagé, vainqueurs, ordre d'affichage — et l'écart d'une estimation (`ecartEstimation`) |
| `shared/nombres.ts` | un nombre tapé par un humain, lu comme on l'écrit en France (« 35 000 », « 0,8 », « −40 ») : l'estimation au téléphone, la cible de l'éditeur, l'import d'une liste — une seule lecture |
| `shared/securite.ts` | la page de retour après connexion : jamais ailleurs que chez soi |
| `shared/erreurs.ts` | les motifs que le client montre quand ça coince (réseau, serveur qui redémarre…), et ce qui passe tout seul (`statutPassager`, `echecPassager`) |
| `shared/reveil.ts` | une écriture qui attend le réveil de l'hébergeur au lieu d'échouer à vingt secondes (`auReveil`, dans `client/src/api.ts`) |
| `shared/brouillon.ts` · `client/src/brouillon.ts` | le brouillon d'un quiz : ce que l'éditeur garde dans le navigateur tant que le serveur n'a pas enregistré, relu comme le serveur relit (`normalizeQuestions`, `shared/library.ts`) |
| `client/src/components/Entree.tsx` | tout ce qu'on traverse entre le scan du QR et la salle d'attente |
| `client/src/components/Liaison.tsx` | ce que voit l'invité quand la liaison tombe |
| `server/scripts/sauvegarde.ts` | la sauvegarde SQL de la base permanente, restaurable par `turso db shell` |
| `server/scripts/calibrage.ts` | combien de quiz demande chaque légendaire, et combien de soirées chaque niveau : des bandes d'amis inventées jouent des soirées entières sur le vrai code des hauts faits et de l'expérience (`npx tsx scripts/calibrage.ts`, format réglable) |
| `server/scripts/tablee/regie.ts` · `pilote.mjs` | la tablée : un serveur jetable, un Chromium, et les gestes des agents qui y jouent une soirée — la marche à suivre, les personnages et leurs consignes dans `.claude/skills/tablee/` (`/tablee`) |
| `retours/<date>/synthese.md` | ce qu'une tablée a trouvé : les axes d'amélioration, vérifiés un à un, et les retours bruts des agents — à lire avant de retoucher un écran qu'ils citent |

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
   jeton qui ne désigne plus personne (exclu, essai effacé) est refusé
   (`unknown-token`), **jamais recréé** : le téléphone repasse par l'entrée,
   pré-remplie. Celui d'une soirée qu'on vient de clore reçoit sa fin de
   soirée (`soiree-close`).
10. **L'expérience d'un quiz se crédite dès qu'il rend son verdict** (son
    podium s'affiche), à la fin de la partie si quelque chose a changé depuis
    (`dernierCredit`, l'empreinte des gains arrivés en base), puis une
    dernière fois à la clôture, toujours, avant tout effacement. C'est
    l'idempotence qui le permet : la ligne `(profil, soirée)` est remplacée,
    jamais ajoutée. Un invité **exclu** rend la sienne, et l'Éclat tiré ce
    soir-là (`exclure()`, à la file des crédits) : le crédit suivant ne
    réécrit que les profils encore là. Ce qui ne se juge qu'une fois tout
    joué — le podium de la soirée, l'assiduité, les **prix** du palmarès, les
    **hauts faits**, les **paliers** de carrière — ne se décide **qu'à la
    clôture**, en un seul lot (`remplacerRecompensesDeSoiree`) : un
    rangement à mi-soirée ne fige rien. Un palier ne se reprend que si la
    soirée qui l'a fait tomber est retirée (essai effacé, soirée supprimée de
    l'historique) — et tout ce qu'elle avait rapporté part avec elle.
11. **Le nom d'une soirée se tire une fois** (`soireeEnCours`) et ne se
    recalcule jamais : exclure le premier arrivé ou redémarrer ne le change
    pas, seules la clôture et l'essai effacé l'oublient (`viderSoiree`).
    Toute écriture permanente sous ce nom passe d'abord par `recopierSoiree`.
    Recalculé, il comptait l'expérience deux fois et dédoublait l'archive.
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
    brutal faisait payer une question deux fois. La clôture efface le miroir
    **avant** la base locale.
14. **Les dérivations restent pures.** La soirée en cours et une archive
    passent par le même chemin — une amélioration profite aux soirées passées.
15. **Un classement passe par `shared/classement.ts`.** Rang = 1 + le nombre
    de concurrents strictement devant ; tous les ex æquo en tête gagnent.
    Cinq règles de départage différentes donnaient trois vainqueurs à un même
    quiz. Deux estimations se comparent par `ecartEstimation`, jamais par
    `Math.abs(valeur - cible)` : la virgule flottante séparait 0,7 et 0,9
    pour 0,8, et le barème au rang payait l'un 200 points et l'autre 30.
16. **Une personne, deux tables — et `accounts.id` ne bouge jamais.** Un
    compte est un **espace** (slug, réglages, et l'identifiant qui cloisonne
    tout le reste) ; un profil est une **personne** (prénom, avatar,
    expérience). `accounts.profile_id` dit qui tient l'espace : se connecter
    à son profil ouvre alors la console sans rien redemander, et la
    déconnexion la referme — mais seulement celle que CE profil avait
    ouverte : chaque session d'animateur retient le profil qui l'a ouverte
    (`auth_sessions.profile_id`), et toutes celles-là tombent quand son mot
    de passe change, que son code de secours sert ou qu'il perd l'espace —
    détaché, ou remplacé par un autre profil —, sauf la console d'où l'on
    fait ce geste. Celles du mot de passe du compte ne bougent pas : c'est
    l'écran commun de la soirée. Pour poser
    le lien, il faut prouver les deux identités ; après, une seule porte
    suffit. Ne fusionne pas les deux tables : l'identifiant d'un compte est
    la clé de partition de dix tables et de toutes les archives.
17. **Les homonymes se règlent à l'affichage, jamais à la saisie.** On ne
    refuse personne et on ne renomme personne : `nomsAffiches()` marque
    « Camille (2) » quand le prénom **et** l'avatar sont partagés, et cette
    marque n'est **jamais** écrite en base — elle s'efface d'elle-même quand
    l'homonyme s'en va. Un prénom sort par trois portes (`publicPlayers`,
    `publicOne`, `ViewContext.playerName`) : c'est la troisième qu'on oublie,
    et c'est elle qui écrit sur le vidéoprojecteur.
18. **L'historique s'écrit tout seul, et la soirée n'a qu'un geste de fin.**
    Elle se range après chaque quiz (`apresQuiz`) ; `host:closeParty` la clôt
    — dernier rangement, crédits de clôture, fin de soirée à chaque téléphone
    et à la salle, puis la page blanche ; `host:discardParty` efface un essai
    avec tout ce qu'il avait crédité. La fin de soirée ne part **qu'une fois
    la soirée effacée** : un miroir qui refuse d'effacer ne doit pas faire
    lire « c'est fini » à une soirée qui continue. `host:resetParty` et
    `host:archiveParty` restent compris des pages d'avant. Entre deux
    soirées, `recap.json` et `bilan.json` désignent la dernière soirée close
    (`derniere`), que le souvenir et le bilan de l'espace montrent à sa place
    (`lecteurDePage`) — sans redirection : la page revient d'elle-même à la
    suivante dès sa première question jouée.
19. **L'expérience se mérite, et ne redescend jamais en cours de soirée.**
    Rien pour la présence, rien seul : tout se gagne dès deux joueurs, un
    podium de quiz à cinq questions, celui de la soirée à quinze (`SEUILS`),
    et un podium a toujours une marche de moins que la salle. L'animateur qui
    joue chez lui gagne comme tout le monde. Les hauts faits gardent leur
    salle de quatre (`salleHautsFaits`). Les gains d'un quiz sont
    définitifs : ce qui peut se renverser d'un quiz à l'autre attend la
    clôture. Une soirée jouée seul reste dans l'historique mais ne compte
    pas (`soireeQuiCompte`) : ni tirage de l'Éclat, ni soirée pour L'Habitué
    — dix « soirées » d'une question faisaient le Renard Lunaire. **Un prix
    ne rapporte jamais d'expérience** : ni ceux du palmarès (une ligne
    d'étagère, rien de plus), ni ceux remis à l'écran, prix libres compris
    (des points d'équipe, jamais le score d'un joueur) — l'un se juge sur
    une seule soirée, l'autre se donne à la main.
20. **Les récompenses sont des dérivations des journaux**, comme le
    souvenir : quand le barème ou un haut fait change, incrémente
    `VERSION_BAREME` — au démarrage, `recalculerHistorique` relit toutes les
    soirées de l'historique avec les règles du jour, et remet à la version
    du jour les lignes qu'il ne sait pas relire (la soirée en cours, les
    paliers) : sinon il relirait tout à chaque démarrage. `decodeDetail`
    reconnaît le format à `v ≥ 2`, jamais à la version du jour.
21. **Les règles des Divins ne quittent jamais le serveur.** Elles vivent
    dans `core/divins.ts`, avec leurs légendes — qui en disent presque
    autant —, et ni `shared/` ni `client/` ne l'importent ni n'en recopient
    une ligne (`divins.test.ts` y veille). Le serveur n'envoie que la liste
    des Divins descendus, le récit à leur seul porteur — pas de jauge, pas
    de progression, pas de ligne d'étagère (`badgesOf` les écarte), pas même
    un compte de badges qui bougerait. Un Divin ne prend ni finition ni
    Éclat.
22. **Durcir un légendaire ou la courbe des niveaux ne reprend rien à
    personne.** Les légendaires et les niveaux se dérivent à chaque lecture :
    relever un seuil suffisait à reprendre le légendaire qu'on portait,
    l'Arbre-Monde avec, et durcir la courbe à faire redescendre de niveau,
    finitions comprises. Une règle qui se durcit ajoute donc une entrée —
    à `DURCISSEMENTS` pour un légendaire, à `COURBES_D_AVANT` pour la courbe
    (`auth/profiles.ts`), avec un drapeau neuf dans `meta` — et n'en modifie
    jamais une : au démarrage, chaque profil retient ce qu'il avait
    (`profile_legendaires`, `profile_niveaux`), et le garde tant que la
    règle d'alors le lui donne. Une soirée retirée de l'historique emporte
    donc encore ce qu'elle avait fait tomber. Et **tout niveau d'un profil
    passe par `niveauDuProfil`** (`ProfileStore.niveauOf`, `gardesOf`) : un
    seul `niveauPour(profil.xp)` oublié, et le mur afficherait un autre
    niveau que sa page.

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
- **Un nombre tapé se lit avec `lireNombre()`** (`shared/nombres.ts`), jamais
  avec `Number()` : « 35 000 » valait NaN au téléphone, et l'éditeur, qui
  relisait sa cible à chaque touche, faisait 8 de « 0,8 ». Le champ garde le
  texte tapé ; seule la valeur lue part en base.
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

**Les noms** : `fiestapp-quizz` (production) et `fiestapp-quizz-preprod`,
les mêmes que dans `render.yaml` — les services ont été renommés. L'adresse
`onrender.com` d'un service, elle, se fixe à sa création : le renommer ne la
change pas, le recréer si, et c'est elle que portent les QR imprimés. Ne
synchronise aucun blueprint : Render n'adopte pas un service créé à la main,
il en créerait des copies à de nouvelles adresses (MISE-EN-LIGNE.md, étape 7).

**Jamais la même base Turso pour les deux** : un « C'était un essai » en
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
  `enFile` : une clôture cliquée pendant un rangement viderait sinon ce
  qu'ils lisent.
- **L'Éclat est un tirage** (une chance sur quarante) et le premier fait
  tomber un palier de carrière : un test qui compte l'expérience au point
  près après une clôture neutralise `ProfileStore.tirageEclat`, sinon il
  échoue une fois sur quarante.
- **Un joueur seul ne rapporte rien.** Un test qui veut de l'expérience
  invite un figurant au moins (`figurants()`, `faux()` dans
  `soiree.test.ts`) ; un test de hauts faits, quatre joueurs au moins. Et
  deux bonnes réponses font un réflexe au plus rapide, à la milliseconde
  près : un test qui compte l'expérience au point près fait se tromper
  l'autre.
- **Une colonne de plus au journal des réponses** se pose dans trois
  fichiers : `addColumn` dans `db.ts` (la locale) ; `COLUMNS`, l'insertion
  et `toRow` dans `answers.ts` ; `ajouterColonne` (le miroir), l'écriture
  (`SQL.reponse`, `ligneReponse`) et la restauration dans `backup.ts`. Une
  seule oubliée, et la colonne se perd au premier réveil sur disque effacé.
- **Toute mutation de `Party` qui touche un prénom, un avatar ou la
  composition invalide le cache des marques** d'homonymie.
- **L'éditeur n'envoie rien pendant qu'on écrit** : le serveur s'endort sous
  les doigts de l'animateur. Une écriture de l'éditeur qui se rejoue sans
  dommage passe par `auReveil` ; et une réponse qui arrive après deux minutes
  d'attente ne remplace l'éditeur que si rien n'a bougé depuis
  (`modifications`). L'envoi d'une photo n'y passe pas : il s'attache à la
  question par sa position, qu'on a pu déplacer entre-temps.
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
  l'écran, pas au typecheck. Chromium et Playwright sont disponibles. Le
  téléphone se regarde en 360 × 640 ; l'écran commun en **1366 × 768** — le
  portable qu'on branche à la télé, où rien ne défile — et en 1920 × 1080,
  avec une question à photo, des équipes et une clôture à hauts faits.
- **La tablée lit l'écran par ses classes** (`.quiz-player`, `.ans-btn`,
  `.guess-form`, `.join-url`, `.fin-tete`…) : en renommer une casse ses
  raccourcis `question`, `repondre` et `scanner` sans que le typecheck le
  voie. Une tablée courte le dit.

## Ce qu'il ne faut pas faire

- Toucher aux barèmes (`CHOICE_POINTS`, `SPEED_BONUS`, `LECTURE_MS…`,
  `PROXIMITY_POINTS`, `CRANS_TOLERES`, `XP`, `SEUILS`, `XP_PAR_PALIER`,
  `XP_PALIER`, l'expérience des hauts faits, `CHANCE_ECLAT`…) sans le dire :
  ce sont des choix de produit, pas des constantes techniques — et sans
  incrémenter `VERSION_BAREME`, l'historique garderait l'ancien. Les points
  d'une question, eux, sont écrits au journal et ne se recalculent jamais :
  une soirée jouée garde le barème de son soir, et `VERSION_BAREME` relit
  seulement ce qui s'en dérive. `calibrage.ts` joue avec les vraies
  formules (`pointsDuChoix`, `pointsDesEstimations`) : il mesure ce qu'un
  nouveau barème fait aux niveaux et aux légendaires.
- Bouger le seuil d'un légendaire ou la courbe des niveaux
  (`XP_PAR_PALIER`) sans le mesurer ni le dire. Ce sont aussi des choix de
  produit, mesurés par `calibrage.ts` ; ils se relisent à chaque lecture,
  sans `VERSION_BAREME`, et ne se durcissent jamais sans leur entrée à
  `DURCISSEMENTS` ou à `COURBES_D_AVANT` (invariant 22).
- Rendre la connexion obligatoire. L'entrée d'une soirée **est** un écran de
  connexion, et l'accueil (`/`) en est un aussi : c'est un choix assumé — mais
  « Jouer sans compte » et « Rejoindre une soirée » y ont exactement le format
  de « Me connecter » et se voient **sans défiler** en 360 × 640, clavier fermé.
  Aucun champ de l'entrée ni de `ProfilForm` n'a d'`autoFocus` : le clavier
  pousserait le bouton hors de l'écran. **Le chemin anonyme reste la valeur de
  l'application** ; les profils s'y greffent, ne le remplacent pas.
- Supprimer ou désactiver une assertion — du smoke ou d'un test — pour la
  faire passer.
