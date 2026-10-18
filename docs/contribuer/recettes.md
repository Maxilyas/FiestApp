# Les recettes

> Faire évoluer FiestApp sans rien casser : 37 recettes, chacune avec les fichiers à toucher dans l'ordre, ce qu'il ne faut pas oublier et le test qui la gardera. Pour qui ajoute une sorte de question, un trophée, un thème, une route, une table…

Chaque recette suit les règles du dépôt. Un nouveau comportement arrive avec son test, qui échoue avant la modification ([les tests](tests.md)). Une valeur de barème est un choix de produit, qui se dit ([les barèmes](../reference/baremes.md)). Une route, un événement, une table, une variable ou une adresse qui naît met à jour sa page de la référence dans le même commit — `server/test/documentation.test.ts` le réclame. Et avant de pousser : `npm run verify`.

**Les recettes, domaine par domaine** :

- **Le quiz** — [Ajouter une sorte de question](#ajouter-une-sorte-de-question) · [Changer une valeur du barème des questions](#changer-une-valeur-du-barème-des-questions)
- **La salle et le temps réel** — [Ajouter un événement temps réel](#ajouter-un-événement-temps-réel) · [Ajouter un champ à l'instantané](#ajouter-un-champ-à-linstantané)
- **La fin de soirée et les archives** — [Ajouter un prix au palmarès](#ajouter-un-prix-au-palmarès) · [Ajouter une donnée au souvenir ou au bilan](#ajouter-une-donnée-au-souvenir-ou-au-bilan) · [Ajouter une porte de clôture](#ajouter-une-porte-de-clôture)
- **Les données et la mise en ligne** — [Ajouter une table](#ajouter-une-table) · [Ajouter une variable d'environnement](#ajouter-une-variable-denvironnement) · [Ajouter une mesure à /healthz](#ajouter-une-mesure-à-healthz)
- **Les comptes, la sécurité et le QG** — [Ajouter une route d'administration](#ajouter-une-route-dadministration) · [Ajouter un geste au QG, journalisé](#ajouter-un-geste-au-qg-journalisé)
- **La page** — [Ajouter une page](#ajouter-une-page) · [Garder quelque chose sur l'appareil](#garder-quelque-chose-sur-lappareil)
- **L'expérience et les récompenses** — [Ajouter un haut fait de soirée](#ajouter-un-haut-fait-de-soirée) · [Durcir un légendaire](#durcir-un-légendaire)
- **Le profil** — [Ajouter un avatar peint](#ajouter-un-avatar-peint) · [Ajouter une pièce à la loge](#ajouter-une-pièce-à-la-loge)
- **Les confettis et la boutique** — [Ajouter un thème](#ajouter-un-thème) · [Ajouter une gerbe](#ajouter-une-gerbe) · [Ajouter un achat en confettis](#ajouter-un-achat-en-confettis)
- **Les quiz** — [Ajouter un modèle de quiz](#ajouter-un-modèle-de-quiz) · [Ajouter un réglage à la liste collée](#ajouter-un-réglage-à-la-liste-collée) · [Ajouter une pièce à une question](#ajouter-une-pièce-à-une-question)
- **Le quiz du jour** — [Ajouter un haut fait du quiz du jour](#ajouter-un-haut-fait-du-quiz-du-jour) · [Changer le barème du quiz du jour](#changer-le-barème-du-quiz-du-jour) · [Apprendre une nouvelle sorte de question au quiz du jour](#apprendre-une-nouvelle-sorte-de-question-au-quiz-du-jour)
- **La campagne** — [Agrandir la base de la campagne](#agrandir-la-base-de-la-campagne) · [Ajouter un haut fait de campagne](#ajouter-un-haut-fait-de-campagne)
- **Les sentiers du savoir** — [Changer un seuil ou un mélange de paliers](#changer-un-seuil-ou-un-mélange-de-paliers) · [Ajouter un parcours de thème](#ajouter-un-parcours-de-thème)
- **Les duels** — [Changer la cote, la montée, une ligue ou la récompense du lundi](#changer-la-cote-la-montée-une-ligue-ou-la-récompense-du-lundi) · [Ajouter une ligue](#ajouter-une-ligue) · [Régler Automate](#régler-automate)
- **L'outillage** — [Écrire un test sur un serveur jetable](#écrire-un-test-sur-un-serveur-jetable) · [Ajouter une règle pour Claude](#ajouter-une-règle-pour-claude) · [Ajouter un personnage à la tablée](#ajouter-un-personnage-à-la-tablée)

## Le quiz

### Ajouter une sorte de question

Le plus court chemin est une **variante de QCM**, comme « plusieurs », « ordre » et « sondage » : elle hérite des réponses, du chronomètre, du temps de lecture et du barème. Une sorte entièrement neuve (un autre `kind`) suit le même chemin, en touchant davantage de branches. Dans l'ordre :

1. **Le format** — `shared/library.ts` : ajoute-la à `Variante` et à `VARIANTES`, ses champs à `QuizQuestionDef` et à `PlayableQuestion`. Un champ de plus passe **d'abord** par `normalizeQuestions`, sinon le serveur le jette à l'enregistrement (et le brouillon avec). Puis `toPlayable` (ce qui se joue), `questionProblem` (ce qui manque, « à compléter », avec une borne comme `MIN_ORDRE` si elle en a une), et `horsBornes` si elle en a.
2. **La liste collée** — dans `parseImportedQuestions`, la ligne « Type : … » (`lireSorte`), et son écriture dans `ECRITURE_DES_SORTES` (le typecheck la réclame) ; puis `FORMAT_DE_LISTE` et son exemple, et `ecrireListe` (« Copier en liste »), dans `shared/liste.ts` — le format donné à une IA ne doit rien promettre que la liste ne sache relire.
3. **Le hasard** — `shared/hasard.ts` : ses réponses se mélangent-elles avec le réglage du quiz (`ordreDesReponses`), jamais (vrai ou faux, « sondage »), ou toujours, à sa façon (`melangerLOrdre`) ? Les index d'une réponse sont ceux de la copie jouée.
4. **Le contrat** — `shared/games/quiz.ts` : la réponse qu'envoie le téléphone (`QuizAction`), et les champs des vues (`QuizPlayerView`, `QuizHostView`).
5. **Les règles** — `server/src/games/quiz.ts` :
   - `onPlayerAction` lit la réponse (des index : `lireIndex`), renvoie `invalid` à ce qui ne se lit pas, et confirme sans rien réécrire la même réponse renvoyée ;
   - `reponseJuste` dit juste ou non — jamais `r.choice === q.correct` ; `scoreQuestion` paie, de préférence par `pointsDuChoix` : aucune constante ne bouge, et `VERSION_BAREME` non plus ;
   - `logQuestion` écrit le journal — une sorte où rien n'est juste ni faux n'y entre pas, comme « Qui dans la salle ? », qui ferait baisser la précision de ceux qui votent ; `compteParReponse` (la répartition) et `laQuestion` (« Cette question ») suivent ;
   - `playerView` et `hostView` : ce qui trahit la réponse ne part **qu'à la révélation** (`st.phase === 'reveal'`), et la vue d'un téléphone ne lit jamais la réponse d'un autre pendant la question (invariant 1, `vueDependDesAutres`).
6. **Le bilan** — `bonneReponseEnMots` (`shared/review.ts`), la question rangée par `server/src/core/review.ts`, et `client/src/components/BilanQuestion.tsx`.
7. **Les écrans** — l'éditeur (`client/src/views/EditorApp.tsx`) ; le téléphone (`client/src/games/quiz/PlayerView.tsx` : la saisie, puis la révélation) ; l'écran commun et la télécommande (`client/src/games/quiz/HostView.tsx`, `client/src/games/quiz/Regie.tsx`) ; la consigne de la salle (`CONSIGNE_DES_VARIANTES`, `client/src/games/quiz/consignes.ts`, que le typecheck réclame aussi). Garde les classes que lit la tablée (`.ans-btn`, `.valider-variante`…) et apprends-lui la sorte dans `server/scripts/tablee/regie.ts` ; le fantôme (`server/scripts/fake-player.mjs`) aussi.
8. **Les tests** — `server/test/variantes.test.ts` (elle se joue, se note, se refuse tard, ne fuit pas avant la révélation), `server/test/liste.test.ts` (la liste collée relue à l'identique), `server/test/hasard.test.ts` si elle a son mélange, `server/test/emojis.test.ts` pour ses textes. Puis regarde-la au téléphone et à l'écran commun (skill `regarder-le-rendu`).

### Changer une valeur du barème des questions

`CHOICE_POINTS`, `SPEED_BONUS`, `LECTURE_MS…`, `GUESS_POINTS`, `PROXIMITY_POINTS` et `CRANS_TOLERES` sont des choix de produit : dis-le. Mesure d'abord ce que la valeur fait aux niveaux et aux légendaires avec `server/scripts/calibrage.ts`, qui joue avec les vraies formules. Change la constante dans `server/src/games/quiz.ts`, sa ligne dans `docs/reference/baremes.md` dans le même commit, et les attendus de `server/test/bareme.test.ts`. Les soirées jouées gardent leurs points — écrits au journal, jamais recalculés — : pas de `VERSION_BAREME` à monter. Mais le quiz du jour paie avec les mêmes fonctions (`server/src/core/jour.ts`) : ses parties à venir changent aussi.

## La salle et le temps réel

### Ajouter un événement temps réel

1. **`shared/events.ts`** — sa clé dans `ClientToServerEvents` ou `ServerToClientEvents`, avec sa charge et, si le client doit connaître l'issue, son accusé `(res) => void` ; un commentaire dit pourquoi il existe. La charge est un objet, que le serveur relira champ par champ. Un message qu'un téléphone peut envoyer juste après une coupure porte de quoi se rattacher seul, comme `player:action` (`slug`, `token`) : socket.io le rejoue avant que la page se re-présente.
2. **`server/src/sockets.ts`** — son gestionnaire dans `wireSockets`, **toujours par `ecouter(événement, (charge, repondre) => …, enPanne)`**, jamais par `socket.on` : une exception y arrêterait le processus, et toutes les soirées avec (invariant 7). Chaque champ se relit à son type (`texte()`…) : le contrat ne promet que des noms. Avec un accusé, donne `enPanne`, ce que le client reçoit si le gestionnaire lève. Un geste d'animateur commence par `const rt = requireHost(); if (!rt) return`, qui relit la session de la poignée de main ; un message d'invité trouve son espace par `runtime()`, ou par `spaceOf(charge.slug)` puis `bindSpace` s'il est le premier de la connexion. Un geste qui fait avancer la partie porte sa visée (invariant 12). Un refus se lit dans le noir : court, en français, il dit quoi faire — dans l'accusé, ou dans un `toast`.
3. **Ce que le serveur émet** part toujours à une salle — `space:<espace>`, `hosts:<espace>`, `player:<invité>` — ou à la seule connexion qui a fait le geste, jamais à tout le serveur. Ce qui change la salle passe plutôt par l'instantané (`broadcastSnapshot`, regroupé) que par un événement de plus.
4. **Le client** — l'émetteur dans `client/src/socket.ts` : par `demander` s'il attend un accusé (une liaison et un réseau, un seul envoi, dix secondes au plus), et en décidant s'il rejette (`watchParty`) ou résout un refus (`joinAsPlayer`) ; l'écouteur à côté des autres, et dans `client/src/socketDuChef.ts` si la barre du chef en a besoin.
5. **`docs/reference/evenements-temps-reel.md`** — sa fiche, sous un titre `###` qui ne porte que son nom, entre accents graves, dans « Du téléphone ou de l'écran vers le serveur » ou « Du serveur vers les écrans » : qui l'émet, sa charge, son accusé, son effet, ses refus, le fichier qui l'écoute. `server/test/documentation.test.ts` rougit tant qu'une clé du contrat n'a pas sa section, et quand une section survit à sa clé.
6. **Le test**, dans `server/test/`, sur un serveur jetable (`server/test/banc.ts`) : le chemin normal, une charge malformée et un message sans accusé (`server/test/temps-reel.test.ts` montre comment). Un `host:*` entre dans `COMMANDES`, la liste de `server/test/garde-fous.test.ts` — le typecheck exige qu'elle soit complète —, et son geste dans `gestes`, pointé sur ce qui existe : le test le joue depuis un téléphone, une connexion anonyme et l'écran d'un autre espace, et rougit tant qu'une commande de la liste n'y est pas tentée.

### Ajouter un champ à l'instantané

1. **`shared/types.ts`** — le champ dans `PartySnapshot`, facultatif s'il est rare : absent quand il ne dit rien (comme `sauvegardeEnRetard`), l'instantané dédoublonné n'en porte pas le poids.
2. **`server/src/core/space.ts`** — dans `snapshotComplet` s'il regarde toute la salle, dans `enPlusPourLesEcrans` s'il ne regarde que l'animateur : le mot de passe du wifi et qui est connecté ne partent jamais aux téléphones. **Jamais un champ qui change à chaque tick** (invariant 4) : chaque changement repartirait à toute la salle.
3. **Qui l'envoie** : un changement qui diffuse déjà suffit ; sinon `broadcastSnapshot()` là où la valeur change (regroupé : 120 ms aux écrans, 120 ms plus 2 ms par inscrit aux téléphones), et `sendSnapshot()` seulement pour un changement rare qui doit se voir tout de suite — il part sans attendre et annule les envois regroupés.
4. **Le client** garde l'instantané entier (`client/src/socket.ts`) : la page le lit tel quel.
5. **La documentation** : sa ligne dans le tableau de `party:snapshot` (`docs/reference/evenements-temps-reel.md`).
6. **Le test** : `server/test/grande-salle.test.ts` compte les messages d'une grande salle — un champ trop bavard s'y voit ; `server/test/au-geste.test.ts` garde l'instantané que reçoit l'auteur d'un geste avant sa vue.

## La fin de soirée et les archives

### Ajouter un prix au palmarès

1. **`server/src/core/stats.ts`** — un `Spec` de plus dans `SPECS` : sa clé, son emoji (antérieur à Unicode 13 : `emojis.test.ts`), son titre, sa règle en une phrase (le souvenir, la remise et la collection la lisent), `eligible` — son seuil : sans matière, le prix ne se propose pas —, `score`, `volume` si le score est un taux (30 sur 30 doit battre 3 sur 3 avant tout départage par le prénom), `exige` si les prétendants doivent montrer un écart (L'Éclair et Le Contemplatif), `detail`, le chiffre qui le justifie. Un prix qui lit plus que la ligne d'un joueur — une équipe, deux quiz, les photos — se décide dans `buildAwards` par `pushBest`, avec sa `FicheDePrix`, qui rejoint aussi les fiches où `CATALOGUE_DES_PRIX` cherche la sienne (sans elle, le module lève à son chargement), et sa clé rejoint `PRIX_INDIVIDUELS` à la main (ceux de `SPECS` y sont d'office).
2. **La clé, en minuscules, sans tiret ni chiffre** : `fin-de-soiree.test.ts` relit les clés du calcul par `key: '([a-z]+)'`. Elle s'écrit sur les étagères (`profile_badges`) et ne se renomme jamais ; le titre, si — l'étagère le relit par `titreDuPrix` (`sansfaute` s'appelle « Le Plus Précis », `devin` « Le Compas dans l'Œil ») ; un prix de `pushBest`, que `titreDuPrix` ne connaît pas, y garde le titre écrit la dernière fois qu'il est tombé.
3. **Un chiffre de plus par joueur ?** `PlayerStat` (`shared/types.ts`), `computeStats` et `emptyStat` ; sa colonne dans « Les chiffres » s'il doit se voir (`client/src/components/StatsTable.tsx`, sa légende comprise). Une donnée que le journal des réponses n'a pas se pose dans trois fichiers (règle `journaux-et-miroir.md`) — et les archives d'avant ne l'auront jamais : le prix doit s'en passer.
4. **La collection grandit** : « *N* prix sur 20 » passe à 21. `fin-de-soiree.test.ts` compte vingt prix (`PRIX_INDIVIDUELS.length`) : ce nombre change avec le produit, et se dit. Un prix d'équipe rejoint la liste `equipes` du même test, et ne se collectionne pas.
5. **Ni expérience ni points d'office** : un prix ne rapporte jamais d'expérience (invariant 19), et se remet à `POINTS_D_UN_PRIX`.
6. **Les soirées passées** : leur souvenir et leur bilan le montrent aussitôt (les archives se relisent avec le code du jour). Pour qu'il tombe aussi sur les étagères de leurs lauréats, monte `VERSION_BAREME` (`server/src/auth/profiles.ts`) : au démarrage, le recalcul remplace les prix de chaque soirée — un choix de produit, à dire.
7. **Le test**, qui échoue avant : dans `server/test/resultats.test.ts`, une dérivation pure — `computeStats` sur le strict minimum de lignes qui décerne le prix, puis le cas sous le seuil et l'ex æquo départagé.
8. **La documentation** : sa ligne au palmarès de `docs/produit/apres-la-soiree.md`, et le compte (« vingt prix individuels »).

### Ajouter une donnée au souvenir ou au bilan

1. **La dériver des journaux**, par une fonction pure : `buildRecap` (`server/src/core/recap.ts`) ou `buildReview` (`server/src/core/review.ts`). La soirée en cours (`liveRecap`, `liveReview`) et une archive (`recapOfArchive`, `reviewOfArchive`, `server/src/core/archive.ts`) passent par elles : une seule écriture sert les deux (invariant 14).
2. **Son type** : `Recap` (`shared/types.ts`) ou `Review` (`shared/review.ts`), en champ optionnel quand une page d'avant ou une archive d'avant ne l'a pas (« Absent des pages d'avant »).
3. **Rien de la question ouverte** : le souvenir et le bilan sont publics et se lisent pendant la soirée. Le journal des réponses ne reçoit une question qu'à sa révélation (`logQuestion`, `server/src/games/quiz.ts`) ; une donnée tirée d'ailleurs — la partie en cours, les réponses en attente — donnerait la bonne réponse avant l'heure (invariant 1).
4. **Si l'archive ne la garde pas** : `PartyArchive` (`shared/archive.ts`) et ce qui la remplit ; les archives d'avant ne l'auront jamais, la page s'en passe.
5. **Une nouvelle source de la page** — une table, un registre — entre dans `empreinteDesPages` (`server/src/core/space.ts`) et fait monter sa `revision` à chaque écriture qui change vraiment quelque chose : sinon la page gardée reste en retard, une minute au plus (`server/src/core/pages.ts`). Une écriture de l'historique passe par `ArchiveStore.ecrire`.
6. **Le test** : `server/test/resultats.test.ts` pour la dérivation (une archive d'avant comprise, sans le champ) et pour la page gardée qui se refait (« chaque écriture qui change le souvenir ou le bilan le refait ») ; `server/test/pages-de-soiree.test.ts` si la page change.

### Ajouter une porte de clôture

1. **Passer par `cloreLaSoiree`** (`server/src/sockets.ts`), jamais par `SpaceRuntime.closeParty` directement : c'est lui qui tient les comptes de toute clôture — la mesure des inscriptions, les adresses vues de l'espace, la ligne du journal —, une seule fois quand deux clôtures se croisent (`finEnRoute`, `server/src/core/space.ts`). « Terminer le quiz » sur le dernier quiz d'un programme y échappe encore (`considererCloture`, `server/src/core/space.ts`) — l'exemple à ne pas suivre.
2. **Rendre l'issue telle quelle** : un miroir qui refuse laisse la soirée entière, et l'échec part en erreur neutre (`wrap` pour une route, jamais un 503, que le client lit « le serveur redémarre »).
3. **Le test** : dans `server/test/cloture.test.ts` — un fichier qui approche la minute et demie se coupe par thème, comme `credits.test.ts` (règle `tests.md`) —, deux clôtures croisées par la porte neuve et l'écran commun, et un miroir qui refuse (`server/test/miroir.test.ts` montre comment).

## Les données et la mise en ligne

### Ajouter une table

**Dans la base permanente** — le cas courant :

1. Crée-la dans l'`init()` du magasin qui la possède, en `CREATE TABLE IF NOT EXISTS`, avec ses index **dans le même lot** (`batch`) : un index posé à part coûte un aller-retour de plus à chaque réveil. Le magasin s'ouvre dans sa branche du démarrage de front (`deFront`, `server/src/server.ts`) ; s'il a besoin d'un autre, dans la même branche, après lui.
2. Une colonne venue plus tard passe par `ajouterColonne` (`server/src/core/distante.ts`), qui lit le schéma — jamais un `ALTER` dont on avale l'erreur : une base qui décroche laisserait la colonne absente sans un mot. Un échec y arrête le démarrage, et c'est voulu.
3. Range-la par `space_id` si elle appartient à un espace, et filtre chaque requête par lui (invariant 3) ; par `profile_id` si elle appartient à une personne.
4. Décide de ce qui l'efface. Une ligne à `profile_id` part avec le profil : ajoute sa table à la suppression de son magasin (`ProfileStore.supprimer`, `JourStore.oublierProfil`, `RappelStore.oublierProfil` ou `CampagneStore.oublierProfil`, que compose `supprimerProfil` dans `server/src/server.ts`) — `server/test/profils-admin.test.ts` relit chaque table qui porte un `profile_id`. Une ligne à `space_id` part avec l'espace (`removeAccount`, même fichier) ; et dis si la clôture ou l'essai effacé la touchent.
5. Donne-lui sa section dans `docs/reference/base-de-donnees.md` (un titre `### \`nom\``, sous sa famille) : `server/test/documentation.test.ts` compare chaque `CREATE TABLE` du serveur à la page, dans les deux sens.

Rien à faire pour la sauvegarde : `npm run sauvegarde` lit toutes les tables qu'elle trouve.

**Dans la base locale** — une table de la soirée, rare et lourde : elle vit à quatre endroits, et une seule oubliée la perd au premier réveil sur disque effacé. Sa création et son index d'espace dans `server/src/core/db.ts` (`PARTY_TABLES`, `wipeSpace`, `lireSoireeLocale` pour la resynchronisation) ; sa copie au miroir dans `server/src/core/backup.ts` (la table `party_*`, ses écritures par la file de l'espace, `MIRROR_TABLES` pour la remise à zéro, `restoreInto` pour la restauration) ; son registre, et le `clearAll` que la clôture appelle (`viderSoiree`, `server/src/core/space.ts`). `server/test/miroir.test.ts` rejoue une soirée sur un disque effacé : ajoute-y la tienne. Et ses deux tables, la locale et sa copie au miroir, ont chacune leur section dans `docs/reference/base-de-donnees.md` : `server/test/documentation.test.ts` lit tous les `CREATE TABLE` du serveur.

### Ajouter une variable d'environnement

1. Lis-la une fois, dans `server/src/index.ts` — pas au fond d'un module —, nettoyée (`trim`), avec son défaut, et passe-la à `createQuizServer` par `QuizServerOptions` (`server/src/server.ts`) : un test la donne alors sans toucher l'environnement du processus.
2. Si elle est indispensable en ligne, refuse de démarrer sans elle (`refuser`, un message qui dit quoi faire), plutôt que de démarrer sur un repli muet : le serveur démarrait sur un fichier local sans `QUIZ_DB_URL`, et tout disparaissait au premier réveil.
3. Si c'est un secret, il ne paraît jamais au journal — en ligne, il se garde et se lit sur le tableau de bord de l'hébergeur : une base s'y écrit par son seul hôte.
4. Documente-la : une ligne dans `docs/reference/configuration.md`, son nom entre accents graves en première colonne, son défaut, quand elle est obligatoire. `server/test/documentation.test.ts` lit chaque `process.env.X` du serveur, de `shared/`, des scripts, du client et de `client/vite.config.ts`, et refuse aussi une variable documentée que plus rien ne lit. Une variable propre à un script va dans `docs/reference/commandes.md`, à côté de sa commande.
5. Si les services en ligne doivent la poser, ajoute-la à `render.yaml` pour les deux (`sync: false` pour un secret : sa valeur ne vit que sur le tableau de bord) — puis pose-la sur les deux tableaux de bord, qui font foi.

### Ajouter une mesure à `/healthz`

1. Ajoute-la sous son propre filet, dans la route (`mesurer('nom', () => ({ … }))`, `server/src/server.ts`) : une mesure qui lève ne doit jamais faire tomber la réponse, toujours un 200 — sinon Render redémarre l'instance, disque effacé.
2. Agrégée, tous espaces confondus, **sans un nom, une adresse ni un identifiant** : la route est publique.
3. Lue sans rien parcourir : un compteur tenu au fil de l'eau (une fenêtre du pouls, `server/src/core/pouls.ts`), ou une valeur relue en fond et gardée, comme l'avance de la réserve du quiz du jour (`RESERVE_RELUE_MS`) — jamais une requête à la base sur le chemin de la sonde, que la veille appelle toutes les dix minutes.
4. Si elle doit se suivre sur plusieurs jours, nourris aussi le relevé de l'heure (`releve`) : `/healthz` ne dit que la dernière minute.
5. Dis-la dans `docs/exploitation/exploiter.md` (« Ce que dit /healthz ») ; `server/test/exploitation.test.ts` vérifie que la réponse ne nomme personne.

## Les comptes, la sécurité et le QG

### Ajouter une route d'administration

1. **La ranger sous `/api/admin/…`**, dans le module de son sujet — `server/src/profilsAdmin.ts` (les profils, les espaces), `server/src/qg.ts` (le QG), `mountJourAdmin` (`server/src/quizDuJour.ts`), `mountCampagneAdmin` (`server/src/campagne.ts`), `server/src/partages.ts` (le catalogue) —, ou dans un `mount…` neuf appelé par `mountApi` (`server/src/api.ts`) **après** `requireAccount` et le lecteur de JSON de 4 Mo. Elle n'a rien à poser elle-même : le bloc de `/api/admin` lui applique `requireAccount`, `requireAdmin` et `refuserLesTeles`, puis `journaliser`. Une route d'administration hors de `/api/admin` — à éviter — passe `requireAdmin` à la main.
2. **Écrire le traitement dans `wrap(async (req, res) => …)`** (`server/src/core/http.ts`) : un refus fait pour être lu se lève en `new Error('…')` — court, en français, qui dit quoi faire — et répond 400 ; un 404 (« … introuvable ») ou un 409 se répond à la main ; toute autre exception devient un 500 neutre, son détail au journal du serveur. Un identifiant de la route (`:id`) se cherche, et son absence répond 404.
3. **Si elle change quelque chose**, elle dit sa phrase au journal du QG juste avant de répondre (la recette suivante).
4. **Le client** : sa méthode dans `api.admin` (`client/src/api.ts`), et le geste sur la page du QG qui le porte (`client/src/views/AdminApp.tsx` et ses composants `client/src/components/Qg*.tsx`, `client/src/components/Admin*.tsx`).
5. **La documentation** : sa ligne dans `docs/reference/api-http.md` — `server/test/documentation.test.ts` exige chaque route du serveur dans la référence — et, si l'administrateur s'en sert, sa place dans `docs/guides/administrer.md`.

À ne pas oublier : une réponse qui porte un secret pose `Cache-Control: no-store` et ne va jamais au journal ; rien du contenu des soirées d'un autre espace — ni quiz, ni question, ni prénom d'invité, ni titre — ne sort par une route du QG.

Le test : `server/test/admin-seulement.test.ts` la trouve seul dans le routeur et exige un 403 pour un animateur ordinaire et pour la télé branchée de l'administrateur — rien à y ajouter. Si elle change quelque chose, `server/test/journal.test.ts` la réclame aussi, jouée avec sa phrase (la recette suivante). Son comportement s'éprouve dans le fichier de son sujet (`server/test/fiche-joueur.test.ts`, `server/test/qg.test.ts`, `server/test/qg-soirees.test.ts`…), une épreuve qui échoue avant.

### Ajouter un geste au QG, journalisé

1. **La route** (la recette précédente) : juste avant `res.json`, `noterLeGeste(res, { sorte, resume, cible })` (`server/src/core/journalDesGestes.ts`). `journaliser` n'écrit la ligne qu'une fois la réponse partie, et seulement si elle dit oui (statut sous 400) : un refus ne se note jamais, une lecture non plus.
   - `sorte` : l'une de `SORTES_DE_GESTES` (`shared/qg.ts`) — `soiree`, `profil`, `salon`, `catalogue`, `jour`, `campagne`. Une sorte neuve rejoint `SORTES_DE_GESTES` et `NOM_DE_LA_SORTE`, puis les filtres et les icônes du journal (`FILTRES`, `ICONE`, `client/src/components/QgJournal.tsx`).
   - `resume` : une phrase qui nomme ce que le geste a touché, lue **avant** le geste si ce qu'il touche va disparaître (un profil supprimé, un espace renommé) ; jamais accordée à un prénom — elle parle du profil, de l'espace, de la question : « Profil suspendu : Léa (@lea) » ; un intitulé de question s'y cite par `extrait()`. Jamais un secret : le code de secours tiré n'y est pas.
   - `cible` : l'identifiant du profil, de l'espace ou de la question visés — la fiche d'un joueur relit les gestes de son profil (`GET /api/admin/gestes?cible=`).
2. **Le geste à l'écran** : son bouton sur la page du QG, une confirmation s'il ne se défait pas (`confirmDialog`), le message de son issue, puis la page — et le journal — relus. Défaire un geste, c'est un autre geste, qui se note à son tour : le journal ne se modifie jamais.
3. **La documentation** : ce qu'on y fait, dans `docs/guides/administrer.md`.

Le test : jouer la route dans le scénario de la première épreuve de `server/test/journal.test.ts` et ajouter sa phrase attendue à la liste ; l'épreuve lit les routes de `/api/admin` dans le routeur et rougit tant qu'une seule qui écrit n'a pas été jouée avec sa phrase — sans phrase, elle se note par sa méthode et son chemin, sous la sorte « Autres ». Son effet s'éprouve dans le fichier de son sujet.

## La page

### Ajouter une page

1. **`shared/adresses.ts`** — son nom dans `AccountPage` et `ACCOUNT_PAGES` pour une page sans espace (`/<nom>`) ; dans `PublicPage` et `PUBLIC_PAGES` pour une page d'un espace (`/<espace>/<nom>`, et sa version d'archive).
2. **`shared/space.ts`** — le même nom dans `RESERVED_SLUGS`. Rien ne l'impose : sans lui, un espace de ce nom deviendrait injoignable, son adresse ouvrant la page (`duels` y manque aujourd'hui). Un dossier servi avant la page (`server/src/server.ts`) s'y ajoute de même.
3. **`client/src/views/<Page>.tsx`** — la page, un fichier.
4. **`client/src/main.tsx`** — son chargeur dans `ACCOUNT` (ou `PUBLIC`) ; dans `REPERE_PROPRE` si elle pose ses propres repères (en-tête, navigation) ; dans `LISENT_LE_PROFIL` si elle lit le profil, dont elle porte alors le thème. Ce qu'elle ne montre qu'après son premier écran passe par `aLaDemande`, jamais par `lazy`.
5. **`client/src/titres.ts`** — le titre de son onglet dans `TITRES` (« … · FiestApp ») ; le typecheck le réclame, `server/test/design.test.ts` le relit.
6. **Côté serveur**, rien pour une page sans espace : `decrirePage` la sert en 200, non indexée. Une page d'un espace prend sa description et son suffixe de titre (`DESCRIPTIONS`, `SUFFIXES`, `server/src/core/apercus.ts`, réclamés par le typecheck).
7. **`shared/depart.ts`** — dans `donneesDeDepart`, ce que la page demande dès son code arrivé : seulement ce que **tout** visiteur demande à l'ouverture, à l'adresse exacte, lue dans `DEPART` ou `adresseDesDonnees` par la page elle-même. Le navigateur rend la réponse préchargée sans regarder son âge : une adresse demandée après une connexion y lirait celle d'un invité. Le fragment (`#…`) ne parvient pas au serveur : `donneesDuFragment`.
8. **Les tests**, qui échouent avant : ses données de départ dans `server/test/depart.test.ts` ; ce qu'elle ne doit pas télécharger (la liaison temps réel, les dessins…) dans `server/test/medaillons.test.ts` ; son statut, s'il a quelque chose de particulier, dans `server/test/portes.test.ts`.
9. **La documentation** — sa ligne dans `docs/reference/adresses.md` (`server/test/documentation.test.ts` exige chaque page de `ACCOUNT_PAGES`) et, si elle précharge, dans la table de `docs/architecture/client.md`.
10. **Regarde-la** en 360 × 640 (skill `regarder-le-rendu`), et mesure-la avant et après (`npm run mesure`, sa page et le sélecteur de son écran utile ajoutés à `PAGES`, dans `server/scripts/mesure-pages.ts`).

### Garder quelque chose sur l'appareil

1. **Est-ce une commodité ?** Tout ce qui doit survivre ou se partager va au serveur ; l'appareil ne garde que de quoi se re-présenter et des préférences.
2. **Une clé `quizz.…`**, rangée par espace (`quizz.me.<espace>`) ou par profil (`quizz.annonces.vues.<profil>`) quand sa valeur en dépend : un jeton d'un espace ne vaut rien dans un autre.
3. **Chaque lecture et chaque écriture sous `try/catch`** — `writeSafe` (`client/src/state.ts`) en est le modèle —, et la page qui marche sans : un stockage refusé ne doit coûter que la commodité. Rien ne le vérifie automatiquement ; un module qui lit le stockage à son chargement le simule dans son test (`server/test/installation.test.ts`).
4. **Ne renomme jamais une clé en service** : chaque téléphone oublierait ce qu'il gardait (`quizz.profile.<espace>` garde son vieux nom pour cela). Une valeur dont la forme change porte sa version (`VERSION_GARDEE`).
5. **Sa ligne** dans la table du stockage de `docs/architecture/client.md`.

## L'expérience et les récompenses

### Ajouter un haut fait de soirée

1. **Le catalogue** — `shared/hautsfaits.ts`, une entrée dans `HAUTS_FAITS_DE_SOIREE` : `key` (`hf:…`), `famille: 'soiree'`, un emoji antérieur à Unicode 13, `title`, `rule` (la règle telle que la fin de soirée l'annonce), `ton` (`'eclat'` pour un exploit, `'ombre'` pour un coup du sort) et `xp` — un coup du sort de soirée rapporte 10 au plus.
2. **La règle** — `server/src/core/hautsfaits.ts`, dans `hautsFaitsDeSoiree` : une dérivation pure du journal rangé (`server/src/core/journal.ts`), qui ne se juge que dans une salle de quatre joueurs au moins (`SEUILS.salleHautsFaits`, déjà appliqué par la fonction). S'il faut compter quelque chose de plus par invité, un champ du relevé dans `relevesDeSoiree` (`server/src/core/progress.ts`).
3. **Sa rareté** — sa part dans `PART_DES_JOUEURS` (`shared/hautsfaits.ts`), mesurée par `cd server && npx tsx scripts/calibrage.ts`, qui joue la vraie règle sur des bandes d'amis simulées et affiche les parts à recopier, un format de soirée par lancement : on recopie la moyenne de trois (le défaut, deux quiz de cinquante questions à douze ; `--quiz 2 --questions 30 --joueurs 10` ; `--quiz 3 --questions 12 --joueurs 8`). Sans elle, il passe pour le plus courant de tous et ne vient jamais sur la carte d'un joueur.
4. **Le passé** — `VERSION_BAREME` + 1 (`server/src/auth/profiles.ts`) : au démarrage, `recalculerHistorique` relit les soirées archivées et le décerne, expérience comprise, à qui l'avait fait. Sans elle, seules les clôtures à venir le connaissent.
5. **Ce qu'il ne faut pas oublier** — rien de plus à brancher pour le montrer : la clôture le décerne et l'annonce, anonymes compris, l'écran des gains le compte parmi les « Nouveaux trophées », et l'album des trophées le range dans la page de la soirée, en exploit ou en coup du sort selon son `ton` (`shared/trophees.ts`) ; un légendaire qui le demanderait se mesure aussi (`shared/legendaires.ts`, même script) ; un haut fait qui ne se juge que hors des soirées va dans `HAUTS_FAITS_DU_JOUR` ou `HAUTS_FAITS_DE_CAMPAGNE`, avec son `origine`, et se relit sous `VERSION_DES_JOURS` ou `VERSION_DES_SERIES`, pas `VERSION_BAREME`.

**Le test** — `server/test/hautsfaits.test.ts` : sa règle sur un journal construit, à quatre joueurs (et rien en dessous), son expérience, et sa part dans `PART_DES_JOUEURS`, que le test réclame pour chaque haut fait qui se regagne. Il échoue avant la règle.

### Durcir un légendaire

1. **Mesurer d'abord** — `cd server && npx tsx scripts/calibrage.ts` dit combien de quiz la règle neuve demande au premier de la bande (une vingtaine, pour la plupart des légendaires des soirées). Les voies du quiz du jour, de la campagne et des saisons n'y sont pas simulées : elles s'estiment.
2. **Retenir l'ancienne règle** — `server/src/auth/profiles.ts`, une entrée de plus **à la fin** de `DURCISSEMENTS` : un `drapeau` neuf et, dans `avant`, la règle d'aujourd'hui de chaque légendaire qu'on durcit (`{ hautFait, fois }` ou `{ hautFait, palier }`). Ne jamais modifier une entrée existante : son drapeau est déjà posé en production, et elle ne se rejouerait pas.
3. **Durcir** — `shared/legendaires.ts` : la `condition` du légendaire, ou la voie d'`aussi` qu'on durcit ; et sa légende, si elle écrit le seuil en toutes lettres.
4. **Au démarrage** — `ProfileStore.init` joue l'entrée une fois (`garderLesLegendairesAcquis`) : chaque profil qui tenait l'ancienne règle retient le légendaire et cette règle dans `profile_legendaires`, puis le drapeau se pose dans `meta`. Il le garde tant que cette règle tient sur son étagère : une soirée retirée l'emporte encore.
5. **Ce qu'il ne faut pas faire** — monter `VERSION_BAREME` pour cela : un légendaire se relit à chaque lecture, sans version. Et sans l'entrée de l'étape 2, le durcissement reprendrait aussitôt le légendaire à qui ne tient plus la règle neuve — celui qu'il porte compris (invariant 22).

**Le test** — `server/test/legendaires.test.ts` : un seul haut fait ne suffit plus, ce qui était gagné avant reste gagné tant que la règle d'alors tient, et, sur un vrai serveur, un légendaire gagné avant le durcissement reste à son porteur — et à lui seul ; `server/test/hautsfaits.test.ts` relit les vingt-six et les hauts faits qui les ouvrent. Une étape de piste qui ouvre le légendaire se lit aussi dans `shared/pistes.ts`, que `server/test/trophees.test.ts` vérifie contre les vraies règles.

## Le profil

### Ajouter un avatar peint

Un légendaire, un compagnon ou un portrait de plus, dans une famille qui existe.

1. **Son entrée au catalogue**, dans `shared/` : un légendaire dans `shared/legendaires.ts` (sa règle : la recette des légendaires) ; un compagnon dans `shared/compagnons.ts` — sa clé dans `CleDeCompagnon`, sa ligne dans `CATALOGUE` (nom, genre, emoji antérieur à Unicode 13, phrase, quatre formes) — et son allure dans `client/src/components/Compagnon.tsx` (`ALLURES` : son disque, son aura, le monde vivant de sa forme ultime ; le typecheck la réclame) ; un portrait dans `shared/branches.ts`.
2. **Sa consigne**, dans la chaîne : `LEGENDAIRES_PEINTS` (`server/scripts/anime/legendaires.ts`), `COMPAGNONS` (`server/scripts/anime/compagnons.ts`), `SUJETS` (`server/scripts/anime/consignes.ts`).
3. **Le peindre, le juger, le livrer**, en suivant la skill `peindre` (`.claude/skills/peindre/SKILL.md`) : un lot à moitié prix, ou en direct pour un compagnon ; la planche (`server/scripts/planche-medaillons.ts`, `server/scripts/planche-portraits.ts`) ; la livraison (`legendaires.ts --livrer`, `livrer.ts`, `livrer-compagnons.ts`) pose les fichiers dans `client/public/` sous leur empreinte et réécrit `client/src/components/legendaires-peints.ts`, `client/src/components/portraits/` ou `client/src/components/compagnons-peints.ts`. Jamais à la main.
4. **L'album suit tout seul** (`AVATARS_DE_L_ALBUM`, `shared/album.ts`) — et un légendaire qu'ouvre l'étape d'une piste paraît sous elle dans l'album des trophées (`shared/pistes.ts`, que `server/test/trophees.test.ts` relit contre les vraies règles) : rien à coder, mais les comptes que les tests fixent changent — à mettre à jour en connaissance de cause : `server/test/album-des-avatars.test.ts` (les pages et le total), `server/test/ma-collection.test.ts` (les totaux de « Ma collection »), `server/test/compagnons.test.ts` (douze formes), `server/test/branches.test.ts` (soixante-douze portraits), `server/test/hautsfaits.test.ts` (vingt-six légendaires).
5. **Les tests qui le gardent** : `server/test/medaillons-peints.test.ts`, `server/test/branches.test.ts` et `server/test/compagnons-peints.test.ts` refusent un fichier que plus personne ne cite ; `server/test/medaillons.test.ts`, un dessin chargé hors de la demande. Puis regarde-le au téléphone (`server/scripts/rendu-profil.ts`, skill `regarder-le-rendu`).

À ne pas oublier : un avatar peint de plus ne donne aucun avantage de jeu ; durcir la règle d'un légendaire ajoute une entrée à `DURCISSEMENTS` et n'en modifie jamais une (invariant 22) ; un Divin ne se documente que par son nom.

### Ajouter une pièce à la loge

1. **La pièce** : son id dans `PieceDeLaLoge` et sa ligne dans `PIECES_DE_LA_LOGE` (`shared/piecesDeLaLoge.ts` : nom, groupe `salle` ou `moi`, la phrase de qui la voit). Le typecheck réclame alors son icône (`ICONES`, `client/src/components/LogeTete.tsx`) et ce qu'elle a à porter pour le « Nouveau » (`ceQuIlAPorter`, `shared/loge.ts`).
2. **L'essai**, pur, dans `shared/loge.ts` : son champ dans `Essai`, ce qu'elle ôte dans `essayer` s'il y a lieu, son effet sur la carte (`avecLEssai`) et sa ligne dans la barre (`lignesDeLEssai`).
3. **Le serveur** : sa colonne dans `profiles` (`ajouterColonne` au démarrage de `ProfileStore`), sa validation dans `ProfileStore.update` — un refus en clair, par `new Error`, avant toute écriture —, sa relecture à chaque affichage si elle peut se perdre (comme `fondPorte`), son champ dans ce que rend le profil (`toPublic` ou `toDetail`, types de `shared/profil.ts`). La route `PUT /api/joueur/moi` (`server/src/auth/profileRoutes.ts`) recopie les champs un à un : ajoute le sien.
4. **Le client** : son champ dans `ChoixDuProfil` et sa phrase pour le lecteur d'écran (`annonceDuChoix`, `client/src/components/choix.ts`), dans le type de `api.joueur.enregistrer` (`client/src/api.ts`), son panneau dans `client/src/components/Loge.tsx`, son écran dans `ECRANS` (`client/src/views/ProfilApp.tsx`) pour que son adresse ouvre la loge sur elle.
5. **Le piège** : `PUT /api/joueur/moi` rend le profil léger. Si seul le détail porte la pièce, `ProfilApp.enregistrer` doit la recopier de l'essai envoyé, comme le fond de carte — sinon la carte de la loge garde l'ancienne.
6. **Si la salle la voit** : `badgeDe` et `distinctions` pour l'instantané, `carteDuProfil` pour la carte, la tête de la loge pour sa carte.
7. **Les tests** : `server/test/loge.test.ts` (l'essai, la barre, « Porter » tout ou rien, le « Nouveau »), `server/test/profil-atlas.test.ts` (la tête de la loge et ses pièces) ; puis le rendu en 360 × 640 (`server/scripts/rendu-profil.ts`).

## Les confettis et la boutique

### Ajouter un thème

1. **Sa ligne dans `THEMES`** (`shared/themes.ts`), dans le bloc de sa rareté — le catalogue va du moins cher au plus cher : `key`, `nom`, `rarete`, `humeur` (la phrase de sa fiche), `clair` (un fond clair) ; `saison` s'il ne se vend que pendant une période ; `gagne` (`regle`, `par`, `ou`) et la rareté légendaire s'il ne se vend pas.
2. **Sa feuille** `client/src/themes/<clé>.css` : ses jetons sous `:root[data-theme='<clé>']`, dont `color-scheme` (`light` s'il est `clair`, `dark` sinon) ; son décor dans les couches fixes (`body::before`, `body::after`, `#root::before`, `#root::after`), sans pointeur, animé par `transform` et `opacity` ; ses `@keyframes` préfixées de sa clé et, s'il anime, un bloc `@media (prefers-reduced-motion: reduce)` qui pose `animation: none !important` ; toute règle qui peindrait `.card`, `.label`, `.niveau`… écartée de la carte à fond par `:where(:not(.carte-fond, .carte-fond *))`.
3. **Ses polices** dans `client/public/fonts/themes/`, chacune avec sa ligne dans `client/public/fonts/themes/LICENCES.txt` ; aucune autre adresse. Un thème peint reçoit ses images de la chaîne de `server/scripts/anime/` (skill `peindre`), qui réécrit le bloc des décors de sa feuille, entre ses deux repères.
4. **Son aperçu** : `npm run build -w client`, puis, dans `server/`, `npx tsx scripts/apercus-themes.ts <clé>` — l'écran d'une question photographié sous le thème, dans `client/src/themes/apercus/<clé>.webp`.
5. S'il lit l'heure de Paris, sa clé rejoint `SUIVENT_L_HEURE` (`client/src/themeJoueur.ts`).
6. Les comptes figés du catalogue : `server/test/themes.test.ts` (trente-cinq, et par rareté) et `server/test/ma-collection.test.ts` (l'album, page par page).

**À ne pas oublier** : sa rareté fait son prix (`PRIX_DES_THEMES`), un choix de produit. Regarde-le au téléphone, sur ce qui est vraiment peint derrière chaque ligne : `server/scripts/rendu-themes.ts <clé> --contraste` (skill `regarder-le-rendu`) — `design.test.ts` ne compare ses couleurs qu'à ses jetons (`--bg`, `--surface`, `--accent`…), jamais au décor peint. Velours s'écrit `null`, partout.

**Les tests qui le gardent** : `server/test/design.test.ts` (une feuille par thème et pas une de trop, ses contrastes aux seuils d'Ivoire, `color-scheme`, ses animations, ses adresses), `server/test/themes.test.ts` (le catalogue, un aperçu de moins de 30 000 octets), `server/test/fonds.test.ts` (la carte à fond), `server/test/decors-peints.test.ts` (s'il est peint).

### Ajouter une gerbe

1. **Sa clé** dans `CleDeGerbe` et **sa ligne** dans `GERBES` (`shared/gerbes.ts`) : son nom ; ce qui l'ouvre (`par`) — un haut fait qui existe (`shared/hautsfaits.ts`), un nombre de fois (`hautFait`, `fois`) ou à un palier (`palier`, `au` : un palier plus haut le vaut) — et sa règle affichée (`regle`, à la suite de « Elle se gagne avec ») ; ses particules, des emojis d'avant Unicode 13 ; son mouvement (`jaillit`, `tombe` ou `monte`).
2. **Son allure** (`allure`), à elle seule — distincte des autres : de 6 à 30 particules, une taille de 2,5 au plus, une durée qui la laisse moins de quatre secondes à l'écran.
3. Rien d'autre : la loge, « Ma collection » et son compte la lisent d'eux-mêmes, et `GerbeVue` (`client/src/components/Gerbe.tsx`) la dessine à une seule taille de police, chaque particule réduite par `transform: scale()`.

**À ne pas oublier** : une gerbe ne s'achète pas, et ne se voit que sur le téléphone de qui la porte (invariant 8) ; regarde-la éclater au téléphone (skill `regarder-le-rendu`).

**Le test qui la garde** : `server/test/gerbes.test.ts` (le haut fait existe, l'allure distincte et bornée, une seule taille de police, porter et refuser) ; `server/test/emojis.test.ts` pour ses particules.

### Ajouter un achat en confettis

1. **Sa table** dans la base permanente (`server/src/auth/profiles.ts`), une ligne par achat avec `profile_id` et le prix payé (`prix`) — une ligne que rien ne modifiera : un prix changé plus tard ne doit ni rembourser ni refaire payer.
2. **`achatsDe`** la lit dans le même `batch` que les autres, et **`boutiqueEtDons`** l'ajoute aux dépenses.
3. **L'achat** passe par `unAchatALaFois` : il relit le solde, refuse en clair (« Il te manque 30 confettis pour… », un `new Error('…')` nu), écrit, et la route rend la boutique à jour — la page affiche le solde du serveur.
4. **`ProfileStore.supprimer`** ajoute la table à sa liste : oubliée, la suppression d'un profil laisserait ses lignes.
5. Un objet de plus rejoint `OBJETS` (`client/src/components/Objets.tsx`), qui fait sa case et sa fiche au rayon « Objets ».

**À ne pas oublier** : sa route, sa table et son prix ont leur ligne dans la référence (`docs/reference/api-http.md`, `docs/reference/base-de-donnees.md`, `docs/reference/baremes.md`) — le test de la documentation réclame la route et la table, CLAUDE.md le prix. Une source de gains, elle, s'ajoute aux gains de `boutiqueEtDons` : rétroactive par construction, elle crédite d'un coup tout ce qui a déjà été joué — un choix de produit à dire.

**Les tests qui le gardent** : `server/test/profils-admin.test.ts` (chaque table qui porte un `profile_id` s'efface avec le profil), `server/test/themes.test.ts` (deux achats partis ensemble, un seul passe), `server/test/boutique.test.ts` (les cases et les fiches des objets).

## Les quiz

### Ajouter un modèle de quiz

1. Écris `server/content/quiz/<nom>.json`. Son nom de fichier, en minuscules et en tirets, devient l'identifiant du modèle (`/api/modeles/<nom>`). Il porte `title` (l'emoji en tête fait sa pastille, d'avant Unicode 13), `description` (une phrase qui dit à quoi il sert), `rayon` (`fete` ou `jeu`), `ordre` (sa place dans son rayon, 99 sans lui) et ses `questions`, de 8 à 15, au format de `shared/library.ts` (`text`, `answers`, `correct`, ou `kind: "number"`, `target`, `unit` ; `duration`, `category`…).
2. Un jeu se joue tel quel : chaque question prête, sa `source` (d'où vient le fait), une catégorie de `CATEGORIES`, et la bonne réponse qui change de case. Une fête s'écrit : aucune question prête, les réponses à écrire marquées ✏️, les prénoms en « [Prénom] » (ou « [Prénom 1] », « [Prénom 2] ») et `"personnaliser": { "prenoms": 1 }` (ou 2) pour « Pour qui ? ».
3. Une photo : son fichier dans `server/content/quiz/images/`, son nom dans `image` — elle sera servie sous `/media/quiz/…`. Avec `observeSeconds`, elle se mémorise.
4. Pas de `"amorce": true` : seuls Culture générale et Qui connaît le mieux [Prénom] ? entrent dans la bibliothèque de l'administrateur.
5. Mets à jour le compte et le tableau des modèles de `docs/produit/les-quiz.md`, et « les onze modèles » de `.claude/rules/bibliotheque.md`.

À ne pas oublier : rien à migrer — relu du disque à chaque demande (`lireModeles`), il se propose dès la mise en ligne, et les copies déjà faites ne bougent pas. Le salon ne propose que six modèles jouables tels quels : un septième jeu n'y paraît pas. Les tests : `server/test/partage.test.ts` (« les modèles livrés » : un rayon, une phrase, 8 à 15 questions qui se relisent, un jeu tout prêt et sourcé, une fête sans rien de prêt, ses images livrées ; l'amorce à deux modèles), `server/test/emojis.test.ts` (tout `server/content/`) et `server/test/exploitation.test.ts` (le serveur empaqueté trouve les modèles).

### Ajouter un réglage à la liste collée

1. `shared/library.ts` : son nom dans `Reglage`, ses mots dans `REGLAGES` (sans accent ni majuscule, synonymes compris), sa lecture dans `parseImportedQuestions` — sous l'intitulé seulement, jamais en tête du bloc. S'il pose un champ de la question, ce champ passe aussi par `normalizeQuestions` : sans lui, le serveur le jette à l'enregistrement, et le brouillon aussi.
2. `shared/liste.ts` : sa ligne dans `FORMAT_DE_LISTE`, ses bornes lues des constantes, et sa place dans `EXEMPLE_DU_FORMAT` ; puis `ecrireListe`, pour que « Copier en liste » l'écrive et que la liste se recolle à l'identique. Une réponse que la relecture prendrait pour ce réglage prend une puce en copie (`ligneDeReponse`) — « - de 5 » perdait son signe.
3. L'aide courte du panneau « Coller une liste » (`client/src/views/EditorApp.tsx`), s'il doit s'y dire.

À ne pas oublier : le format copié pour une IA ne promet rien que la liste ne sache lire. Le test : `server/test/liste.test.ts` — l'exemple du format se relit tel quel, chaque possibilité comprise ; ajoute l'épreuve du réglage lu, et celle du quiz copié en liste puis recollé.

### Ajouter une pièce à une question

Une pièce vit à part, sous une adresse `/media/image/…` : la photo, la photo de la révélation et l'extrait en sont.

1. `shared/library.ts` : son champ dans `QuizQuestionDef`, accepté par `normalizeQuestions` seulement sous `/media/` ; son nom dans `PIECES_DE_QUESTION` — la copie d'un partage (`copierPhotos`) et la reprise d'un brouillon (`photosAVerifier`) la parcourent alors d'elles-mêmes. L'export et l'import (`shared/echange.ts`), non : sa forme dans `FORME` (le typage la réclame), sa mise en clair dans `emporterQuiz` et sa nouvelle adresse dans `importerQuiz`, qui nomment chaque pièce — oubliée, elle partait sous son adresse et se perdait à l'import. S'il se joue, dans `Entourage` (`entourageDe`).
2. `shared/brouillon.ts` : son nom pour l'avis d'une pièce perdue (`NOM_DE_LA_PIECE`, que le typage réclame).
3. `shared/liste.ts` : ce que « Copier en liste » en fait — une pièce ne voyage pas en texte (`CE_QUI_NE_VOYAGE_PAS`, `ecrireListe`).
4. `server/src/games/quiz.ts` : qui la reçoit et quand, décidé dans `playerView` et `hostView` (invariant 1) — à la révélation au plus tôt, si elle trahit la réponse.
5. `client/src/views/EditorApp.tsx` : le bouton qui l'envoie (`POST /api/images`), qui rejoint sa question par son identifiant (`changerParId`).

À ne pas oublier : le ménage la protège sans rien de plus — il cherche toute adresse `/media/image/…` dans le texte des quiz, des parties sur le disque, des archives et des partages vivants (`photosCitees`) — ; un nouveau format passe par la liste du serveur (`IMAGE_MIMES` ou `SON_MIMES`). Les tests : `server/test/variantes.test.ts` (un quiz emporté garde toutes ses pièces), `server/test/editeur-pertes.test.ts` (le brouillon repris vérifie ses pièces) et `server/test/echange.test.ts`.

## Le quiz du jour

### Ajouter un haut fait du quiz du jour

1. `shared/hautsfaits.ts` : sa ligne dans `HAUTS_FAITS_DU_JOUR` — sa clé (`hf:…`), `origine: 'jour'`, son emoji (antérieur à Unicode 13), son nom, sa règle en une phrase, son ton et son expérience (`xp`, un choix de produit, à dire). Elle suffit à le payer à chaque fois dans la ligne des paliers (`xpHorsDesSoirees`) et à lui ouvrir un titre. Puis sa rareté estimée dans `PART_DES_JOUEURS` : la bande de `server/scripts/calibrage.ts` ne joue qu'en soirée.
2. `server/src/core/jour.ts` : le décerner au bon moment — `decernerAuDebut` (au « Jouer »), `decernerALaFin` (la partie finie) ou `decernerLaNuit` (ce qui se mesure aux autres). Un haut fait de la nuit rejoint `CLES_DE_LA_NUIT` : sinon la fin de la partie l'annonce, et le lendemain ne le raconte pas. S'il se mesure aux autres, il se juge dans la salle — masqués et suspendus écartés — et, s'il le faut, à partir de `SALLE_DU_JOUR`. Toute heure se lit à l'horloge du magasin (`maintenant`), à Paris.
3. Les jours d'avant : monter `VERSION_DES_JOURS` les relit une fois au démarrage, en ajoutant sans rien reprendre — mais un mois déjà clos ne se relit jamais : un haut fait de mois demande sa propre relecture.
4. S'il ouvre un légendaire, `shared/legendaires.ts` ; et sa ligne dans le tableau des hauts faits de `docs/produit/le-quiz-du-jour.md`.

À ne pas oublier : jamais de tirage au sort dans ce que la relecture rejoue (l'Éclat se tire dans `enregistrer`) ; jamais une règle de Divin hors de `server/src/core/divins.ts` (invariant 21).

Le test : son épreuve dans `server/test/jour-nuit.test.ts` (la nuit, la salle de huit, la relecture au démarrage) ou `server/test/jour-mois.test.ts` (le début et la fin d'une partie, l'heure de Paris), qui échoue avant ; `server/test/hautsfaits.test.ts` exige sa rareté, `server/test/emojis.test.ts` son emoji.

### Changer le barème du quiz du jour

1. Le dire d'abord : l'expérience du jour est un choix de produit (CLAUDE.md), comme celle de la campagne.
2. `shared/jour.ts` : `XP_MAX_DU_JOUR`, `XP_PODIUM_DU_JOUR`, `XP_PAR_JOUR_DE_SERIE`, `XP_DE_SERIE_MAX` — et leur commentaire, qui dit pourquoi.
3. Le passé : chaque partie et chaque podium ont figé leur expérience, si bien qu'un changement ne vaut que pour ce qui s'écrit ensuite. Pour recompter tout ce qui s'est joué, un drapeau neuf dans `server/src/core/baremeDuSolo.ts` (`DRAPEAU`) : au démarrage suivant, `appliquerLeBaremeDuSolo` repasse une fois — les parties à leurs points et les podiums à leur rang (`JourStore.revaloriser`), chaque partie avec la série qu'elle tenait ce jour-là —, mais aussi la campagne, les paliers, le rattrapage des niveaux et La Légende : vérifier que ces étapes réécrivent la même chose. Ni `VERSION_BAREME` ni `VERSION_DES_JOURS` ne relisent la ligne `#jour`.
4. Les lignes de ces constantes dans `docs/reference/baremes.md` — `server/test/documentation.test.ts` compare chaque valeur au code — et le tableau des règles de `docs/produit/le-quiz-du-jour.md`.

Le test : `server/test/bareme-du-solo.test.ts` (le bonus de série dès la partie commencée, un haut fait du jour qui paie, la revalorisation unique) et `server/test/jour.test.ts` (l'expérience et le bonus de série).

### Apprendre une nouvelle sorte de question au quiz du jour

1. `server/src/core/jour.ts` : `raisonDEcarter` cesse de l'écarter ; le tirage (`tirer`) et l'étiquetage (`aEtiqueter`), qui ne gardent que les questions à choix, l'acceptent ; la réponse (`repondre`, `enregistrer`) sait la juger et la payer — sans salle pour comparer, une estimation a besoin d'une tolérance écrite dans la question.
2. `shared/jour.ts` : ce que la question et sa révélation portent (`QuestionDuJour`, `RevelationDuJour`) — rien de la bonne réponse avant la sienne (invariant 1).
3. `client/src/views/JourApp.tsx` : son écran (`vueDeQuestion`) ; puis la correction (`client/src/components/Corrige.tsx`) et le tirage question par question du QG (`recueilDeLaQuestion`, `shared/qgDuJour.ts`), qui comptent aujourd'hui les réponses par choix.
4. `server/src/core/consigne.ts` : la consigne la décrit, et son exemple (`EXEMPLE_DU_JOUR`) en montre une, **dans le même commit** — sinon la routine écrit pour rien, ou jamais ce qu'on veut.

Le test : `server/test/jour-reserve.test.ts` relit l'exemple de la consigne dans la réserve et ce qu'elle écarte ; `server/test/jour-partie.test.ts` joue la partie (aucune bonne réponse avant la sienne, le chrono, la correction) ; `server/test/qg-jour.test.ts` le suivi du QG.

## La campagne

### Agrandir la base de la campagne

Toutes les commandes se lancent depuis `server/`. La skill `base-campagne` (`.claude/skills/base-campagne/SKILL.md`) décrit chaque étape en détail.

1. **Voir ce qui manque** : `npx tsx scripts/base-campagne.ts stats` donne les questions par catégorie, par sous-thème et par difficulté.
2. **Préparer le dossier des lots** : `mkdir -p ../.lots-campagne`. Git l'ignore, et la redirection de l'étape suivante ne le crée pas.
3. **Écrire la consigne** : `npx tsx scripts/base-campagne.ts consigne <Catégorie> <sous-thème>:<n> … --lot=<nom> > ../.lots-campagne/<nom>.consigne.md`. Le nom ne contient que des lettres et des chiffres. Avec `--nombres`, la consigne demande des questions à nombre.
4. **Faire écrire le lot** : lance un agent `redacteur-campagne` par lot, avec le chemin de la consigne. Il écrit `<nom>-01.json`, `<nom>-02.json`… et lance `verifier` jusqu'à zéro refus.
5. **Chercher les intitulés presque pareils** : `npx tsx scripts/base-campagne.ts voisines ../.lots-campagne/<nom>-*.json`.
6. **Faire relire le lot** : `npx tsx scripts/base-campagne.ts fiche ../.lots-campagne/<nom>-*.json > ../.lots-campagne/<nom>.fiche.txt`, puis lance un agent `relecteur-campagne`. Il écrit ses décisions dans `../.lots-campagne/<nom>.decisions.json`.
7. **Appliquer, vérifier, ranger** : `npx tsx scripts/base-campagne.ts appliquer ../.lots-campagne/<nom>.decisions.json`, puis `verifier`, puis `ranger ../.lots-campagne/<nom>-*.json`. Le rangement tire les identifiants et réécrit les douze fichiers de `server/content/campagne/`.
8. **Relever le plancher et committer** : relève `AU_MOINS` dans `server/test/campagne-base.test.ts`, avec une ligne qui dit ce qui est entré. Committe `server/content/campagne/`, jamais le dossier des lots.

À ne pas oublier :
- **Pour des centaines de questions**, passe par `npx tsx scripts/generer-campagne.ts preparer --questions=<n>`, ou `--sentiers`, ou `--theme=<clé>`, puis `suite` après chaque vague d'agents.
- **Pour des faits tirés de Wikidata**, passe par `server/scripts/faits-wikidata.ts` (`vues-des-dumps`, `extraire`, `lots`, puis `fusionner`). Chaque lot se relit quand même.
- **L'abonnement** : aucune vague ne se lance dans l'heure qui précède la routine du matin, qui partage l'abonnement.
- **Les fichiers de décisions d'un lot Wikidata** se nomment avec un point, `<nom>.NN.decisions.json`, pour que `ranger <nom>-*.json` ne les prenne pas pour un lot.
- **Une correction faite hors d'un lot** (« Corriger » à l'administration, ou une coquille corrigée à la main) ne repasse pas par le contrôle du même fait : lance `voisines` après.

Les tests qui gardent la base :
- `server/test/campagne-base.test.ts` : aucune entrée défectueuse, le plancher `AU_MOINS`, toutes les marches représentées, 150 questions par catégorie et 15 par sous-thème au moins, aucune question des quiz livrés ;
- `server/test/campagne-sujets.test.ts` : chaque sujet a de quoi faire une série ;
- `server/test/meme-fait.test.ts` : le contrôle du même fait.

### Ajouter un haut fait de campagne

1. **Le déclarer** dans `HAUTS_FAITS_DE_CAMPAGNE` (`shared/hautsfaits.ts`), avec les champs suivants :
   - `key` (`hf:…`) ;
   - `famille: 'soiree'` et `origine: 'campagne'`, qui le rangent dans la collection de la campagne ;
   - un emoji antérieur à Unicode 13 ;
   - `title`, `rule` et `ton` ;
   - son expérience, `xp` ;
   - `paieUneFois` s'il ne doit payer qu'une fois.

   Il entre alors tout seul dans la ligne des paliers (`HAUTS_FAITS_HORS_SOIREE`, `xpHorsDesSoirees`).
2. **Lui donner sa rareté** dans `PART_DES_JOUEURS`, dans le même fichier. Sans elle, il passe pour le plus courant de tous et `server/test/hautsfaits.test.ts` échoue.
3. **Écrire sa condition** dans `server/src/core/campagne.ts` :
   - dans `hautsFaitsDeLaSerie` (fonction pure) si elle se lit sur les réponses d'une partie ;
   - sinon dans `recompenserLaSerie`, comme le Tour du monde, qui lit les records.

   Un seuil devient une constante nommée, comme `FUNAMBULE`, et prend une ligne dans les barèmes. C'est un choix de produit, à dire.
4. **Le décerner au passé** : monte `VERSION_DES_SERIES`. Au démarrage suivant, `relireLesSeries` le décernera aux séries de mode `serie` déjà finies. Un haut fait qu'on aurait gagné au défi ou en duel ne se rattrape pas, et la relecture n'enlève jamais rien.
5. **Brancher ce qu'il ouvre**, s'il en ouvre : un légendaire (`shared/legendaires.ts`), une gerbe (`shared/gerbes.ts`) ou un thème (`shared/themes.ts`).
6. **Le tester** dans `server/test/campagne-recompenses.test.ts` : la condition lue sur les réponses dans l'ordre, puis la relecture au démarrage.

À ne pas oublier :
- **Le tirage de l'Éclat** reste hors de `recompenserLaSerie`, que la relecture rejoue.
- **Un palier de carrière de campagne** suit une autre voie : une entrée de `HAUTS_FAITS_DE_CARRIERE` avec `deCampagne`, dont la valeur se lit dans `statsDe`.

## Les sentiers du savoir

### Changer un seuil ou un mélange de paliers

C'est un choix de produit (CLAUDE.md, « Ce qu'il ne faut pas faire ») : dis-le avant de toucher, chiffres à l'appui.

1. Mesure sur le calcul : `npx tsx scripts/calibrage-sentiers.ts --seuil 11 --maitre 9`, depuis `server/` (sans option, les seuils du code). `server/scripts/calibrage-sentiers.ts` donne, pour six joueurs de plus en plus forts dans la catégorie, la chance de valider chaque palier du premier coup, puis, jusqu'au sommet, les vies perdues, les questions, le temps et les jours de vies. Pour un mélange, change-le d'abord (`MELANGES`, dans `shared/sentiers.ts`) : le script lit `PALIERS`.
2. Mesure sur les vraies épreuves : `/admin#campagne`, « Les sentiers ». Chaque palier y dit la chance d'un essai à chaque seuil essayé, qui l'a validé et du premier coup, qui y reste bloqué et ses échecs, les abandons, les bonnes réponses par marche à côté du calcul — et « plus facile que P7 » quand un palier passe mieux que le précédent.
3. Change `SEUIL_DES_PALIERS`, `SEUIL_DU_MAITRE` ou `MELANGES` dans `shared/sentiers.ts`. Garde ce qu'exige `server/test/sentiers.test.ts` : seize questions par mélange, une difficulté moyenne qui monte à chaque palier, aucune experte avant le maître. Ajuste-y la valeur attendue d'un seuil changé (`assert.equal(SEUIL_DES_PALIERS, 10)`), sans retirer une assertion.
4. Relis ce qui l'écrit en toutes lettres : les commentaires de `SEUIL_DES_PALIERS` et des mélanges (les chiffres du calcul), la fiche du maître (« plus de la moitié », `client/src/views/Sentiers.tsx`), et la documentation (« dix bonnes réponses » : `docs/produit/les-sentiers-du-savoir.md`, `docs/produit/les-recompenses.md`, `docs/produit/la-boutique.md`). Les règles du bloc du haut, la fiche d'un palier et l'épreuve lisent la constante.
5. Corrige la ligne de `docs/reference/baremes.md` : `server/test/documentation.test.ts` compare la valeur écrite à celle du code.

À ne pas oublier : le seuil se fige dans chaque épreuve à son départ (`campagne_series.seuil`), ses seize questions aussi. **Une épreuve en cours se finit à l'ancien seuil, sur son ancien mélange** ; seules celles qui commencent prennent le nouveau. Une issue écrite ne se relit pas : un palier validé le reste, même sous un seuil relevé, et les étoiles d'une épreuve se lisent à son propre seuil (`sentiersLus`). L'administration montre les seuils côte à côte. Si la marche supposée des questions change, `TAUX` (`server/scripts/calibrage-sentiers.ts`) et `TAUX_DU_CALIBRAGE` (`shared/sentiers.ts`) changent ensemble : le script recopie les taux au lieu de les importer. Les tests : `server/test/sentiers.test.ts`, `server/test/sentiers-vies.test.ts` (l'administration et ses seuils), `server/test/sentiers-panorama.test.ts` (les règles du bloc).

### Ajouter un parcours de thème

Un parcours n'a rien à lui : il vient tout seul à chaque sujet de la campagne qui a soixante questions jouables (`QUESTIONS_POUR_UN_SENTIER_DE_SUJET`) — sauf une fête ou une rubrique, que le sentier de leur catégorie monte déjà (`aUnParcours`). Ajouter un parcours, c'est ajouter un sujet.

1. `shared/sujets.ts` : une ligne de `SUJETS` — sa clé, son nom, `famille: 'theme'` (ou une époque, un fil rouge), ses sous-thèmes par catégorie (`sousThemes` : « france » n'est pas le même en cuisine et en géographie) et, s'il en a, l'étiquette qui le porte hors d'elles (`etiquettes`, comme `animaux` ou `invention`). S'il ne lit qu'un sous-thème, il en tient la rubrique : donne-lui sa catégorie (`categorie`), sinon le joueur trouve deux fois le même choix. `campagne-sujets.test.ts` refuse un sujet qui double une rubrique ou contient la moitié d'un autre.
2. `client/src/iconeDuSujet.ts` : son icône. Sans elle, il prend l'horloge des époques — `server/test/campagne-sujets.test.ts` le refuse pour un thème ou un fil rouge.
3. Vérifie qu'il a de quoi : `server/test/campagne-sujets.test.ts` demande à chaque sujet cent questions dans la base livrée, cinq de chaque marche (et sept catégories pour une époque ou un fil rouge). S'il en manque, `npx tsx scripts/generer-campagne.ts preparer --theme=<clé>` (depuis `server/`, `server/scripts/generer-campagne.ts`, `commandeDuTheme`) commande ce qui lui manque pour se monter deux fois (skill `base-campagne`).
4. **Un thème neuf, sur un savoir que la base n'a pas** (la danse, les métiers de la santé, le 15 octobre 2026) : un sous-thème neuf par catégorie où ce savoir vit (`SOUS_THEMES`, `shared/sousThemes.ts` — il y gagne sa rubrique, choisie sous sa catégorie, dès cent questions) — jamais plusieurs dans la même, chaque sous-thème prenant sa part des séries de sa catégorie —, rangé dans un chapitre de son sentier (`shared/chapitres.ts`, `sentiers-chapitres.test.ts`), sa règle de partage dans les deux consignes (`server/src/core/consigneCampagne.ts`, `server/src/core/etiquetage.ts`), une étiquette pour le reste (`ETIQUETTES`, famille « Les fils rouges »), et son **inventaire** (`server/src/core/inventaires.ts`) : ses familles, leurs sujets, leur poids. `base-campagne.ts inventaire <clé>` le met en clair pour le relire ; `base-campagne.ts reclasser` y range les questions que la base avait déjà, sous leur identifiant ; `generer-campagne.ts preparer --inventaire=<clé> --questions=<n>` le remplit famille par famille, puis `--manques` ferme ce que `base-campagne.ts couverture <clé>` dit encore sans question. Chaque sous-thème neuf a quinze questions au moins avant le commit (`campagne-base.test.ts`). Un sous-thème qui mêlait deux savoirs se coupe de même : la langue française (le 17 octobre 2026) a repris à `langue`, par `reclasser`, tout ce qui parlait du français — `langue` garde les autres langues et les écritures —, et sa règle de partage dit lequel prend quoi.

Rien d'autre : la série, la feuille du choix et la liste des parcours le lisent d'eux-mêmes, avec ses six étapes (`PALIERS_DES_SUJETS`). À ne pas oublier : la page dit « parcours » et « étape », jamais « sentier » ni « palier » (`server/test/parcours.test.ts`) ; ses étoiles ne paient rien. Les tests : `server/test/campagne-sujets.test.ts`, `server/test/sentiers-sujets.test.ts`, `server/test/parcours.test.ts`, et `server/test/inventaires.test.ts` pour un inventaire.

## Les duels

### Changer la cote, la montée, une ligue ou la récompense du lundi

Ce sont des choix de produit (CLAUDE.md, « Ce qu'il ne faut pas faire ») : dis-le avant de toucher, car tout se relit à chaque lecture — les deux cotes, les ligues, les crans et les confettis de **tout le monde**, semaines passées comprises, changent d'un coup, sans `VERSION_BAREME` ni recalcul au démarrage.

1. Mesure d'abord ce que la règle neuve fait aux duels. Sur les vrais duels : `npx tsx scripts/calibrage-duels.ts` (depuis `server/`, en lecture seule, sur `PROD_LECTURE_URL` — jamais `QUIZ_DB_URL` ; `--echelles`, `--participation`) les rejoue tous, à l'ELO d'avant, aux règles du code et à l'essai. Pour Automate : `npx tsx scripts/calibrage-automate.ts` rejoue des joueurs simulés sur la vraie base, au vrai tirage, avec la vraie règle de la cote cachée.
2. Change la constante dans `shared/duels.ts` (`COTE_DE_DEPART`, `SCORE_DE_REFERENCE`, `POINTS_PAR_BONNE_REPONSE`, `DUELS_DE_PLACEMENT`, `POIDS_DU_PLACEMENT`, `POIDS_D_UN_DUEL`, `PARTICIPATION_SOUS_L_OR`, `PARTICIPATION_AU_DESSUS`, `PART_DU_LANCEUR`, `PERTE_SOUS_L_OR`, `LIGUES_GARDEES`, `LIGUE_DE_L_ELO`, `LIGUES`, `DUELS_POUR_LA_RECOMPENSE`, `JOURS_DU_CLASSEMENT`, `CRANS_D_UNE_BORDURE`).
3. Relis les phrases qui l'écrivent en toutes lettres : « Tout le monde part de 1000, en ligue de bronze. Une ligue tous les cent points », « En or, chaque duel rapporte », « L'argent, l'or et la platine, une fois atteints, ne se perdent plus ; contre un joueur plus bas, tu joues comme s'il y était aussi […] À partir de la platine, c'est ton niveau qui parle » (`server/test/duels-page.test.ts` la relit) et « quatre semaines » dans `client/src/views/Duels.tsx` ; « cinq dernières minutes » dans `client/src/views/Amis.tsx` (pour `EN_LIGNE_MS`, `server/src/auth/profiles.ts`). Les autres lisent la constante.
4. Corrige sa ligne dans `docs/reference/baremes.md` : `server/test/documentation.test.ts` compare la valeur écrite à celle du code ; et le tableau de ce qui se joue dans `docs/produit/les-duels.md`.
5. Ajuste les attentes de `server/test/duels.test.ts` (la cote, l'enjeu, la récompense du lundi), `server/test/duels-place.test.ts`, `server/test/bordures.test.ts`, `server/test/duels-montee.test.ts` et `server/test/duels-de.test.ts` — sans supprimer une assertion : le quatrième garde la promesse du propriétaire, qui joue monte en Or, même pas très bon, puis en Platine, qu'il garde ; le dernier, le dé à chances égales (le 16 octobre 2026 : « je perds 17 pour gagner 4 »), 24 × E² en Or et l'ELO à partir de la Platine (le 17 : « à partir de platine c'est là que ça commence vraiment »).

À ne pas oublier : les cotes d'un duel contre quelqu'un, écrites à son lancement (`campagne_duels.cote_auteur`, `cote_adversaire`, et leurs cachées `cote_cachee_auteur`, `cote_cachee_adversaire`), ne se relisent pas — les duels déjà lancés gardent la force d'en face de l'ancienne règle. Au dé, la cote qu'on voit se joue contre elle-même (`forceQuOnVoit`) : une règle qui ferait dépendre l'enjeu du score d'Automate obligerait le dé à tirer avant de demander — et la feuille fermée laisserait un duel en cours.

### Ajouter une ligue

1. `shared/duels.ts` : sa clé dans `CleDeLigue`, sa ligne dans `LIGUES` (nom, nom court, cote de départ, confettis du lundi), le nom de sa bordure dans `NOM_DE_LA_BORDURE`.
2. `client/src/components/Blason.tsx` : son emblème (`EMBLEMES`).
3. `client/src/components/dessinDesBordures.ts` : le métal et le dessin de sa bordure (règle `.claude/rules/medaillons.md`).
4. `client/src/styles.css` : ses couleurs (`.ligue-<clé>`, `--lueur` et `--ligue-vif`, dans les deux blocs).
5. `client/src/views/Duels.tsx` : le cadran donne trente degrés à chaque ligue sur un demi-cercle (`angleDeLaCote`, `CadranDesLigues`) — une septième le déborde.
6. Regarde le rendu : `server/scripts/rendu-bordures.ts` (six joueurs du bronze aux maîtres) et `server/scripts/rendu-duels.ts`, client construit d'abord (skill `regarder-le-rendu`).

À ne pas oublier : les seuils se relisent — un joueur déjà au-dessus du nouveau seuil y entre aussitôt, ses semaines passées repaient à la nouvelle ligue et sa bordure s'ouvre. Les tests : `server/test/bordures.test.ts`, `server/test/duels.test.ts`, `server/test/duels-page.test.ts` (le cadran).

### Régler Automate

1. `server/src/core/campagne.ts` : `ECART_D_AUTOMATE` (l'écart permis autour de ce qu'on attend de lui), `partieDAutomate` (les tirages), `automatePour` (son niveau : `niveauPourLeDuel`, de `shared/duels.ts`, sur la cote cachée — jamais celle qu'on voit, que la montée porte au-dessus du niveau) ; les a priori du modèle dans `server/src/core/modeleDuSavoir.ts` (`ECART_DES_FORCES`, `ECART_DES_CATEGORIES`).
2. Mesure avant et après avec `server/scripts/calibrage-automate.ts` : la part des duels gagnés, à égalité, perdus, l'écart de son score au niveau de la cote cachée, et les enjeux déséquilibrés de l'ELO seul. Un Automate plus fort fait gagner moins souvent : relance `server/test/duels-montee.test.ts`, qui garde la promesse de la montée — l'enjeu du dé, à chances égales, ne le dit pas : seule la part des duels gagnés le montre.
3. Corrige les lignes de `docs/reference/baremes.md`.

À ne pas oublier : ses réponses sont tirées au lancement du dé et gardées dans la série (`campagne_series.adversaire`) — une règle neuve ne vaut que pour les dés suivants. Le modèle du savoir ne règle que lui : n'en fais pas lire les marches des séries, des sentiers ou du quiz tout prêt sans recalibrer leurs mélanges. Les tests : `server/test/campagne-rencontre.test.ts` (son niveau, l'écart tenu, la fin anticipée) et `server/test/modele-du-savoir.test.ts`.

## L'outillage

### Écrire un test sur un serveur jetable

1. **Le fichier du thème**, dans `server/test/` (la liste par thème : `docs/contribuer/tests.md`). Un thème neuf a le sien, avec en tête un commentaire en français qui dit pourquoi il existe — le bug évité, la décision.
2. **Le banc** : `demarrer()` dans un `before()`, `banc.close()` dans un `after()` (`server/test/banc.ts`). Les options passent au serveur : `clientDist` si l'épreuve lit une page servie (le client n'est pas encore construit quand `npm test` tourne), `baseDeLaCampagne: baseDEssai(…)` si elle joue la campagne, `horlogeDuJour` si elle passe minuit.
3. **Préparer** : `connexionAnimateur`, `creerQuiz` avec `qcm` ou `estimation`, `ecranCommun`, `invite` (anonyme, profil, jeton), `lancerQuiz` — la première question arrive trois secondes après.
4. **Agir et lire** : `emitAck` pour un geste qui attend son accusé, `attendre` pour un événement, `instantane()` pour l'instantané — il arrive juste derrière l'accusé, souvent dans le même paquet. `ecrire` pour une route, avec l'en-tête maison.
5. **Ne pas oublier** : neutraliser `ProfileStore.tirageEclat` si l'épreuve compte l'expérience au point près, et le rendre ensuite ; inviter un figurant (quatre joueurs pour des hauts faits) ; compter plutôt que chronométrer ; `redemarrer({ disqueEfface: true })` pour un réveil de l'hébergeur.
6. **Le voir échouer** sur le code d'avant la correction, puis le lancer seul depuis `server/` (`node scripts/tests.mjs test/<fichier>.test.ts`), puis `npm run verify`. Un fichier qui approche la minute et demie se coupe par thème : il a deux minutes en tout.

Le test qui le gardera : lui-même, à chaque `npm test` et en CI ; `server/test/banc.test.ts` garde le banc.

### Ajouter une règle pour Claude

1. **`.claude/rules/<domaine>.md`**, ouvert par son en-tête, sans écart : `---`, `paths:`, un motif par ligne entre guillemets (`  - "server/src/core/jour.ts"`), `---`. Chaque motif doit désigner au moins un fichier ; les accolades se développent (`{jour,rappels}.ts`).
2. **Le corps** : « Les fichiers » — chaque fichier du domaine et ce qu'il tient, avec le pourquoi —, puis « Les pièges ». Les chemins s'y écrivent courts (`core/…` pour `server/src/core/…`, `components/…` pour `client/src/components/…`).
3. **La carte de `CLAUDE.md`** : une ligne de plus au tableau des domaines, qui nomme la règle (`` `<domaine>.md` ``). Ce que la racine disait de ce domaine descend dans la règle.
4. **Ne pas oublier** : rien sur les conditions des Divins, ni ici ni ailleurs (invariant 21) ; une règle n'est lue que si Claude ouvre ses fichiers par l'outil Read.
5. **Le test** : `cd server && node --import tsx --test --test-reporter=spec test/notes-pour-claude.test.ts` — l'en-tête lisible, chaque motif vivant, la carte complète, chaque fichier cité existant.

Le test qui la gardera : `server/test/notes-pour-claude.test.ts`, à chaque `npm test` — un fichier renommé sans son motif la rendrait muette, et il le dit.

### Ajouter un personnage à la tablée

1. **Sa fiche**, dans `.claude/skills/tablee/personas/<nom>.md`, sur le modèle des autres : qui il est, son appareil, son arrivée, son scénario, ce qu'il regarde — et un angle : un usage, une contrainte, une question précise sur l'application.
2. **Un profil déjà inscrit ?** La régie le crée au démarrage (`npm run tablee -- --profil "Prénom/identifiant/avatar"`) : la fiche et l'option vont ensemble, l'une sans l'autre fait échouer le personnage.
3. **Un geste neuf ?** Il se dit à trois endroits : son cas dans `server/scripts/tablee/regie.ts`, l'aide écrite à la main de `server/scripts/tablee/pilote.mjs`, et les consignes ou les fiches qui l'emploient.
4. **Le lancer** : un agent `convive` de plus, avec ses valeurs du jour (son identifiant pour le pilote, le dossier, son salon s'il y en a plusieurs) ; puis `node server/scripts/tablee/chronologie.mjs` pour voir ses gestes ratés.

Le test qui le gardera : aucun — la tablée est une soirée, pas un test. `server/test/notes-pour-claude.test.ts` vérifie seulement que les fichiers cités par la skill existent ; une tablée courte dit si ses gestes visent encore des textes et des classes qui existent.

## Pour aller plus loin

- [Démarrer](demarrer.md) — installer, lancer, le tour du dépôt, le cycle d'une modification
- [Les conventions](conventions.md) — le code, les commentaires, les textes, le CSS
- [Les tests](tests.md) — le banc, la salle, le relais, et comment écrire une épreuve
- [Les décisions](../architecture/decisions.md) — ce que chaque règle protège
