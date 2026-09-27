# Contre-expertise du groupe `soiree` : moteur et concurrence

J'ai relu les rapports `moteur` (12 constats) et `concurrence` (11 constats)
sur `main` (b57035c). J'ai relancé toutes les reproductions qui portent un
constat, un fichier à la fois sous `nice -n 10`, et relu chaque chemin depuis
sa porte d'entrée.

## En bref

- **Aucun constat réfuté.** Chaque reproduction échoue aujourd'hui, et pour
  la raison annoncée. Les deux experts ont appelé le vrai code : le moteur,
  le module du quiz et les registres réels (le harnais du moteur rejoue
  `SpaceRuntime.exclure` et `player:join` dans le même ordre que
  `space.ts:910-935` et `sockets.ts:445-447`), ou un vrai serveur par le banc.
- **Les trois constats P2 tiennent** : moteur-1 (le fantôme dans la moyenne
  d'équipe), concurrence-1 (deux clôtures croisées) et concurrence-2 (le
  verrou de connexion traversé en rafale).
- **Quatre doublons** avec des groupes voisins : concurrence-3 avec
  jour-regles-2, concurrence-4 avec recompenses-comptes-2, concurrence-7 avec
  jour-regles-7, concurrence-11 avec client-3. Je les ai rejoués. Je ne
  tranche pas leur fusion, qui revient aux groupes `jour`, `recompenses` et
  `client`.
- **Une tension** : moteur-10, écrite telle quelle dans le commentaire de
  `sockets.ts:393-401`.
- **Deux gravités à revoir, toutes deux sur des doublons.** concurrence-4 :
  à mon sens P3 et non P2, car rien n'est perdu en base, seule l'annonce
  manque. concurrence-11 : P2 et non P3, alignée sur client-3, car un
  « Clore » perdu peut laisser la soirée ouverte jusqu'à la suivante.

| Constat | Annoncée | Verdict | Retenue | En une ligne |
|---|---|---|---|---|
| moteur-1 · le fantôme et le Rachid « laissé » pèsent sur la moyenne d'équipe | P2 | **confirmé** | P2 | Rejoué : Rouges 600, Bleus 800 à jeu égal. Contredit la règle écrite (README l. 299 : « les membres qui l'ont eue sous les yeux ») |
| moteur-2 · arrivé au podium, il monte sur le podium | P3 | **confirmé** | P3 | Rejoué : `classement()` range tous les `participantIds` (quiz.ts:633-642), et le commentaire de `onPlayerJoin` promet l'inverse |
| moteur-3 · arrivé dans le souffle : 600 ms, puis « Pas de réponse » | P3 | **confirmé** | P3 | Rejoué. Cas particulier d'une limite plus large : arriver 600 ms avant l'échéance fait pareil (ma repro) |
| moteur-4 · un candidat exclu devient « ??? » | P3 | **confirmé** | P3 | Rejoué : `vctx.playerName` rend `'???'` (engine.ts:142) pour un candidat figé |
| moteur-5 · deux Camille, deux boutons identiques | P3 | **confirmé** | P3 | Rejoué. Plus fréquent qu'il n'y paraît : l'entrée **impose** un autre avatar à l'homonyme (Entree.tsx:595-687) |
| moteur-6 · « Rendre sa place » : la vue avant l'instantané | P3 | **confirmé** | P3 | Rejoué : `joinLate(res.id)` sans rappel (sockets.ts:579). Un éclair de 120 ms plus 2 ms par invité |
| moteur-7 · « Révéler » pendant la pause : la révélation reste « en pause » | P3 | **confirmé** | P3 | Rejoué : `reveal()` ne remet pas `pausedMs` à null. Seulement visuel (HostView.tsx:626, :509) |
| moteur-8 · « au clic » pendant l'intertitre : il part seul | P3 | **confirmé** | P3 | Rejoué : la commande n'éteint que `autoNext` (quiz.ts:1121-1135), pas le chrono `intertitre` (:385-388) |
| moteur-9 · palier illisible, NaN, révélations sautées | P3 | **confirmé** | P3 | Rejoué. Nature revue : c'est du durcissement, pas une faille. Il faut une console, qui peut déjà tout |
| moteur-10 · le renommage tombe au second appareil d'un profil | P3 | **tension** | P3 | Rejoué ; l'arbitrage entre l'invariant 8 et l'invariant 9 est écrit dans le code (sockets.ts:393-401) |
| moteur-11 · `host:launch` sans visée | P3 | **confirmé** | P3 | Vrai à la lecture (engine.ts:215). La repro teste un contrat que nul client n'envoie ; la fenêtre réelle suppose un écran figé plusieurs secondes |
| moteur-12 · le laurier de minuit ne rejoint pas le podium affiché | P3 | **confirmé** | P3 | Lecture de bout en bout : `laurierChange` (server.ts:379-381) ne recalcule aucune vue de partie |
| concurrence-1 · « Clore » et « C'était un essai » ne s'excluent pas | P2 | **confirmé** | P2 | Rejoué : seconde annonce au podium vide, fin gardée appauvrie, Zoé effacée. Aucune garde (space.ts:1407, sockets.ts:897-901) |
| concurrence-2 · verrou de connexion traversé en rafale | P2 | **confirmé** | P2 | Rejoué : 19 faux vérifiés puis le bon accepté. `allow` puis deux `await` puis `failed` (profileRoutes.ts:204-209) |
| concurrence-3 · classement du jour gardé périmé, podium de la nuit faux | P2 | **doublon** (jour-regles-2) | P2 | Rejoué, même racine (jour.ts:885), même correction |
| concurrence-4 · clôture rejouée : paliers non annoncés | P2 | **doublon** (recompenses-comptes-2) | P3 | Rejoué. Rien n'est perdu en base : seule l'annonce manque, après une panne de Turso à la clôture |
| concurrence-5 · entré pendant la clôture, effacé sans un mot | P3 | **confirmé** | P3 | Rejoué par le vrai `player:join` : `party:reset` seulement pour « discard » (space.ts:1771) |
| concurrence-6 · cache de bibliothèque posé dans le désordre | P3 | **confirmé** | P3 | Rejoué ; `refreshLibrary` est hors du verrou `unParUn` (api.ts:239 contre :259), et le client libsql lance vingt requêtes à la fois |
| concurrence-7 · réponse de 23 h 59 écrite après la nuit | P3 | **doublon** (jour-regles-7) | P3 | Rejoué avec une porte forcée ; la fenêtre réelle est d'un aller-retour à minuit |
| concurrence-8 · connexion en vol pendant le changement de mot de passe | P3 | **confirmé** | P3 | Rejoué avec une porte. `revokeAll` ne ferme que ce qui existe avant son `DELETE` (profiles.ts:1146-1153) |
| concurrence-9 · code de secours servi deux fois | P3 | **confirmé** | P3 | Rejoué : `UPDATE … WHERE id = ?` sans condition (profiles.ts:983). Le client ne rejoue pas seul (`req`, api.ts:85) : il faut deux onglets |
| concurrence-10 · codes de partage en rafale | P3 | **confirmé** | P3 | Rejoué : 40 sur 40. Durcissement, vu l'espace des codes |
| concurrence-11 · geste d'animateur perdu à la reconnexion | P3 | **doublon** (client-3) | P2 | Rejoué ; même racine que client-3 et que securite-temps-reel-3 (`requireHost`, sockets.ts:700) |

**Compte** : 18 confirmés, 4 doublons, 1 tension, 0 réfuté, 0 incertain.

## Méthode

- **Relu** : les deux rapports et leurs JSON, les fiches `experts/moteur.md`
  et `experts/concurrence.md`, et les JSON de tous les autres rapports, pour
  les doublons. J'ai aussi lu `verification/securite.md`, que le groupe
  `securite` vient de rendre, pour les croisements.
- **Code relu** :
  - `server/src/games/quiz.ts` : `startQuestion`, `reveal`, `classement`,
    `standings`, `podiumDe`, `reponsesMontrees`, `logQuestion`, `awaited`,
    `onHostCommand`, `onPlayerJoin`, `onPlayerLeave`, `onTimer` ;
  - `server/src/core/engine.ts` : `vctx`, `launch`, `joinLate`,
    `dropParticipant`, `resendViews`, `rafraichirVues` ;
  - `server/src/core/space.ts` : `exclure`, `rendrePlace`, `laisserPlace`,
    `closeParty`, `viderSoiree`, `lancementDeQuiz` ;
  - `server/src/sockets.ts` : `player:join`, `player:reprendre`,
    `host:launch`, `host:command`, `requireHost` ;
  - `server/src/core/jour.ts` : `commencer`, `repondre`, `enregistrer`,
    `joueursDu`, `clorePasses`, `clore` ;
  - `server/src/auth/http.ts` (`LoginBudget`, `Budget`),
    `auth/profileRoutes.ts:195-215`, `auth/profiles.ts` (`byId`, `verify`,
    `useRecovery`, `revokeAll`) ;
  - `server/src/partages.ts:20-100`, `server/src/server.ts:290-335` et
    `:376-381`, `server/src/core/distante.ts` ;
  - `shared/teams.ts`, `shared/profil.ts` (`distinctions`) ;
  - côté client : `HostApp.tsx` (`clore`, `lancerQuiz`, les boutons
    « Quiz suivant »), `HostView.tsx` (pause, enchaînement, intertitre,
    podium), `PlayerView.tsx`, `PlayerApp.tsx:293-320` et `:578-582`,
    `socket.ts:55-110`, `api.ts:85` et `:296-306`, et
    `Entree.tsx:595-687` ;
  - `README.md` l. 213 et 297-303, `retours/2026-09-24/verification/salons-marc-lea.md`
    (constat 3), la PR #49 (16b2399).
- **Rejoué**, depuis `server/`, un fichier à la fois, sous `nice -n 10` et
  `--test-timeout=120000`. Chaque constat échoue pour la raison annoncée :
  - `moteur/phases.test.ts` : 7 épreuves, 7 échecs (moteur-2, 3, 4, 5, 7, 8,
    9), avec les messages du rapport ;
  - `moteur/fantome-equipe.test.ts` : « Rouges 600 · Bleus 800 » ;
  - `moteur/reprise-au-geste.test.ts`, `moteur/lancer-vise.test.ts` et
    `moteur/renommage-profil.test.ts` : en échec ;
  - `concurrence/double-cloture.test.ts` : 2 annonces, la seconde au podium
    `[]` ; fin au réveil à 16 XP contre 26 ; Zoé en `unknown-token` ;
  - `concurrence/essai-et-cloture.test.ts` : « Essai effacé », puis archive et
    ligne d'expérience présentes ;
  - `concurrence/cloture-rejouee.test.ts` : `{"xp":8,"xpPaliers":0,"paliers":[]}` ;
  - `concurrence/entree-pendant-la-cloture.test.ts` : la salle vaut `[]`,
    Zoé ne reçoit rien, et `setTeam` répond « Rejoins la soirée d'abord » ;
  - `concurrence/bibliotheque-perimee.test.ts` : bonne réponse révélée `0` ;
  - `concurrence/classement-garde-perime.test.ts` : Bob rang 2 à 1 600, podium
    Alice seule ;
  - `concurrence/minuit-reponse-en-route.test.ts` : podium Alice seule ;
  - `concurrence/essais-en-rafale.test.ts` : le témoin en série passe ; en
    rafale, 401 ×19 puis 200 ;
  - `concurrence/intrus-pendant-le-changement.test.ts` : 200 puis 200 ;
  - `concurrence/secours-deux-fois.test.ts` : `[false,true]` ;
  - `concurrence/codes-de-partage-en-rafale.test.ts` : le témoin passe ; en
    rafale, 40 sur 40 ;
  - `concurrence/geste-pendant-la-coupure.test.ts` : 2 re-présentations,
    aucun toast, 1 invité.
- **Écrit** : `export/evaluations/verification/soiree/arrivee-en-fin-de-question.test.ts`.
  Il passe aujourd'hui et mesure : arriver 600 ms avant l'échéance d'une
  question ordinaire écrit aussi une ligne « présent, sans réponse, 0 point ».
- **Machine** : charge de 0,2 à 1,7 sur quatre cœurs partagés. Aucune mesure
  de temps n'entre dans un verdict. Rien de ce que j'ai lancé ne tourne encore.
  Les processus `exploitation/…` et `client/…` que j'ai vus appartiennent à
  d'autres agents : je n'y ai pas touché.

## Les constats, un par un

### moteur-1 · le fantôme dans la moyenne d'équipe — confirmé, P2

**Rejoué** sur un vrai serveur, par les vraies commandes : `nePlusAttendre`,
`host:rendrePlace`, `player:reprendre`. La salle lit « Rouges 600 · Bleus
800 » pour deux équipes qui ont tout juste au même rythme.

**Le chemin.** `logQuestion` (quiz.ts:866-869) écrit une ligne pour chaque
participant dont `playFrom <= qIndex`. Ni la dispense ni la connexion n'y
entrent. La fiche morte qu'on n'attend plus garde donc sa ligne à 0, sous son
équipe figée. Le Rachid « laissé » aussi : `laisserPlace` (space.ts:987-997)
le dispense, mais il reste participant. `startQuestion` garde la dispense des
hors-ligne (quiz.ts:375). `questionsDesEquipes` compte chaque ligne comme un
présent (shared/teams.ts:56-81). Je n'ai trouvé aucune garde en amont.

**Un argument de plus pour l'expert.** La règle publiée dit que la moyenne
d'une question se fait sur « les membres qui l'ont eue sous les yeux »
(README l. 299). Le fantôme ne l'a pas eue, et le Rachid laissé non plus :
son porteur joue sous l'autre fiche. Le code contredit donc sa propre règle
écrite ; ce n'est pas un parti pris.

**La réalité.** Cela touche toute équipe dont un téléphone meurt en plein
quiz. Le cas le plus simple ne demande même pas la reprise : Rachid se
réinscrit sur un téléphone emprunté, et il compte deux fois. Le dégât
s'arrête avec le quiz, puisque le fantôme n'est plus connecté au lancement
suivant (engine.ts:217). P2 tient : quelques salles, un verdict d'équipe qui
peut se retourner.

**Déjà vu** le 24 septembre (salons-marc-lea, constat 3 : « dilue l'équipe
Commercial ») ; la PR #49 a réglé l'attente et la reprise, pas la moyenne.

**Correction** : celle de l'expert.
`.filter(id => id in st.responses || !st.dispenses?.includes(id) || ctx.connected(id))`
dans `logQuestion`. Elle sort aussi le fantôme de L'Abstentionniste et du
Somnambule. L'épreuve de l'expert deviendra le test. Ajouter une épreuve pour
le cas sans reprise (fiche morte dispensée plus Rachid réinscrit).

### moteur-2 · arrivé au podium — confirmé, P3

**Rejoué.** `onPlayerJoin` lui donne `playFrom = qIndex + 1` (quiz.ts:1173).
Mais `classement()` (:633-642) range tous les `participantIds`, et
`standings`, `podiumDe` et `yourQuizRank` le lisent. Seul `indexDesPlaces`
filtre (:660). Le commentaire de `onPlayerJoin` (« arrivé au podium, il y
tenait une place de dernier ») décrit un correctif qui n'a retiré que
`place`. Aucune expérience n'est en jeu : le podium d'expérience se lit au
journal (progress.ts:136-146). P3 tient : c'est l'écran de la salle, dans
les petites salles où plusieurs joueurs sont à zéro.

**Correction** : celle de l'expert, le filtre `playFrom <= qIndex` dans
`classement()`. `indexDesPlaces` en garde un redondant, sans dommage.

### moteur-3 · arrivé dans le souffle — confirmé, P3

**Rejoué** : `phase reveal, justArrived false, au journal : {"answered":false,"points":0}`.
Le souffle, armé quand plus personne n'est attendu (quiz.ts:1157, :1192),
révèle sans revérifier (:1202).

**Nuance.** Ma repro `arrivee-en-fin-de-question.test.ts` montre le même
sort pour qui arrive 600 ms avant l'échéance d'une question ordinaire. C'est
un choix écrit : « il peut encore répondre (avec moins de temps) ». Le
souffle reste plus trompeur : le téléphone voit encore quinze secondes au
chronomètre, et la question se révèle 600 ms plus tard. Le constat tient donc
tel quel. La correction proposée ne couvre que ce cas-là, et c'est bien.

**Correction** : celle de l'expert. Pour aller plus loin, et c'est à
arbitrer : commencer à la question suivante quand il reste moins que le
temps de lecture offert.

### moteur-4 · « ??? » dans « Qui dans la salle ? » — confirmé, P3

**Rejoué.** `reponsesMontrees` (quiz.ts:778-782) relit les noms des candidats
figés avec `vctx.playerName`, qui rend `'???'` pour un invité effacé
(engine.ts:142). L'exclusion passe par `dropParticipant`, puis `run()`, puis
`fanout` : toute la salle reçoit la liste changée. Le fantôme exclu en
pleine question est justement un candidat, puisque les candidats sont tous
les participants (quiz.ts:367-370). P3.

**Correction** : celle de l'expert (`null` et un bouton grisé, le vote
refusé). Elle vaut mieux que garder le prénom : on exclut parfois un
plaisantin, et son nom n'a pas à rester sous les doigts de la salle.

### moteur-5 · deux Camille identiques — confirmé, P3

**Rejoué** : `["Camille","Camille","Hugo"]`.

**Plus fréquent que ne le dit le rapport.** L'entrée éteint l'avatar d'un
homonyme et en impose un autre (Entree.tsx:595, :668, :687). Deux Camille
entrées par le chemin normal ont donc **toujours** deux avatars différents,
et la marque « (2) » ne s'y pose jamais. Dans ce sondage, deux homonymes sont
toujours deux boutons indiscernables. P3 tient : c'est un vote pour rire,
mais un bug systématique.

**Correction** : celle de l'expert, les avatars à côté des candidats, décorés
comme ailleurs. Cela croise recompenses-vitrine-6 (l'avatar du résultat à la
télé) : les deux gagnent à passer par la même décoration.

### moteur-6 · « Rendre sa place » avant l'instantané — confirmé, P3

**Rejoué.** À `sockets.ts:577-579`, on trouve `broadcastSnapshot()` (regroupé)
puis `joinLate(res.id)` sans rappel. `player:join`, lui, envoie l'instantané
avant la première vue (:445). `PlayerApp.tsx:305` lit `iAmIn` dans
l'instantané et affiche « tu entres à la prochaine question » (:580-582).
L'éclair dure 120 ms plus 2 ms par invité, et seulement quand la fiche morte
n'était pas du quiz. P3.

**Correction** : la ligne de l'expert.

### moteur-7 · la pause survit à « Révéler » — confirmé, P3

**Rejoué.** `reveal()` (quiz.ts:431-460) ne touche pas à `pausedMs`. Les
deux vues le reportent (:1264, :1376). La pastille « En pause » de la
télécommande n'est pas gardée par `!revealing` (HostView.tsx:626-630), et le
bouton de la console reste « Reprendre » (:509). La scène de la télé, elle,
est gardée (:795). Le défaut est visuel ; la question suivante le remet à
zéro (:363). P3.

**Correction** : `st.pausedMs = null` au début de `reveal()`, avant le détour
par `cible`.

### moteur-8 · « au clic » pendant l'intertitre — confirmé, P3

**Rejoué.** L'intertitre arme son chrono d'après l'enchaînement
(quiz.ts:383-388). La commande `autoNext` à `null` n'éteint que `autoNext`
(:1126-1129). La console montre bien l'enchaînement pendant l'intertitre
(HostView.tsx:691-696, via `consoleQuestion`), et la pastille y décompte
toujours (:690). P3.

**Correction** : celle de l'expert. Par symétrie, un palier choisi pendant
l'intertitre pourrait armer son chrono ; ce n'est pas requis.

### moteur-9 · palier NaN — confirmé, P3 (nature revue)

**Rejoué.** `host:command` passe la commande telle quelle (sockets.ts:715-720),
et `Math.round(undefined)` rend `NaN` (quiz.ts:1122). La console n'a jamais
envoyé autre chose qu'un nombre ou `null` (`git log -S` sur le client). Ce
n'est pas une faille : il faut être animateur authentifié, et un animateur
peut déjà terminer, exclure ou révéler à volonté. C'est du **durcissement**,
et non de la `securite`. La garde est la même qu'au lancement.

### moteur-10 · renommage et second appareil — tension, P3

**Rejoué** : « GrosBill » renommé « Bill » redevient « GrosBill ».
`declare = !known || !token` (sockets.ts:402). Le commentaire juste au-dessus
(:393-401) choisit en connaissance de cause : sans jeton, c'est une
déclaration, et le profil dit son prénom (invariant 8). À arbitrer comme
l'expert le propose.

### moteur-11 · `host:launch` sans visée — confirmé, P3

**Vrai à la lecture.** `launch()` termine toute partie en cours
(engine.ts:215), et `host:launch` ne porte rien (sockets.ts:702-713).

**Réserve sur la repro.** `lancer-vise.test.ts` envoie `{ depuis: null }`,
un champ qu'aucun client n'envoie et que le serveur ne lit pas. Elle échouera
donc tant que le contrat n'existe pas : elle prouve l'absence de la visée,
pas une course aux vrais temps. La fenêtre réelle est étroite. Tout lancement
passe par `pickPack`, le choix du quiz, puis 3 s de `getReady`
(space.ts:1284, quiz.ts:1044-1046). Pour couper une question, le second
écran doit donc avoir gardé une vue sans partie pendant plusieurs secondes :
une télécommande figée sur un wifi qui hoquette, dont le clic part au retour
sur la même connexion. Un geste mis en réserve pendant une vraie coupure est
perdu, lui (concurrence-11). P3.

**Correction** : celle de l'expert. `lancerQuiz` (HostApp.tsx:693) envoie
`snap.session?.id ?? null`.

### moteur-12 · laurier de minuit sur un podium affiché — confirmé (lecture), P3

`laurierChange` (server.ts:379-381) n'appelle que `broadcastSnapshot()`. Les
lignes du podium et des estimations portent `distinctions(p)`, laurier
compris (quiz.ts:761, :842, shared/profil.ts:636-644). Elles ne se
recalculent qu'à `fanout` ou à `rafraichirVues` (engine.ts:389-393). Je ne
l'ai pas rejoué. Le défaut est cosmétique et ne se voit qu'avec un podium à
l'écran à minuit. P3.

**Correction** : `rt.engine.rafraichirVues()` dans `laurierChange`.

### concurrence-1 · les deux gestes de fin ne s'excluent pas — confirmé, P2

**Rejoué** :
- `double-cloture` : deux annonces, la seconde avec `podium = []` ;
- la fin gardée au réveil sans niveau, sans finition, sans palier (16 XP
  contre 26) ;
- Zoé, entrée entre les deux clôtures, reçoit `unknown-token` avec « La
  soirée est close ».

`essai-et-cloture` : « Essai effacé — rien n'a été gardé », puis l'archive et
l'expérience sont bien là.

**Le chemin.** `closeParty` pose `fermeture` sans la lire (space.ts:1407-1408).
`sockets.ts:897-901` ne garde rien non plus. Chaque appel lit les journaux
avant son premier `await`, puis passe par `enFile` derrière l'autre. Côté
client, `cloreButton` reste affiché tant que `snap.players.length > 0`
(HostApp.tsx:778). Rien ne dit « en cours » avant le toast de fin.

**La réalité.** Il faut un second « Clore » confirmé pendant la clôture :
deux écrans d'animateur, ou un animateur qui ne voit rien venir et recommence
(boîte, `soirees.json`, confirmation). Sur Turso, avec des profils, la
clôture dure des secondes : c'est plausible. La variante « essai puis
clore » est plus rare : il faut deux gestes contraires en quelques secondes.
Son état final suit d'ailleurs le dernier geste, et c'est surtout le toast
de l'essai qui ment. Le dégât principal reste la seconde annonce au podium
vide sur la télé, au moment le plus regardé de la soirée, et le retardataire
effacé. P2 tient.

**Voisinage.** recompenses-comptes-2 rejoue aussi les deux « Clore »
(seconde annonce vide, fin gardée sans légendaire). Même correction.

**Correction** : celle de l'expert, une fin à la fois par espace : le second
`closeParty` rend la promesse du premier, un geste contraire est refusé avec
un message, et `archiveParty` est refusé pendant une fin. Côté console,
« Clôture en cours… » et le bouton inerte. Ajouter aussi la garde de
client-3 : « Clore » inerte tant que `!s.connected`.

### concurrence-2 · le verrou par identifiant traversé en rafale — confirmé, P2

**Rejoué** : en série, 401 ×5 puis 429 ; en rafale, 401 ×19 puis **200**.
Entre `budget.allow` et `budget.failed`, il y a `await dummyHash()` et
`await profiles.verify()`, donc scrypt dans le pool de threads
(profileRoutes.ts:204-209, http.ts:147-166). Toutes les portes à clé suivent
ce motif : routes.ts:63, :178, :216, profileRoutes.ts:349, :399.

**La réalité.** La promesse écrite (« cinq échecs… d'où que viennent les
essais », http.ts:128-131) ne tient plus. On passe de cinq essais par quart
d'heure à vingt par adresse et par quart d'heure, soit vingt fois le nombre
d'adresses. Même le verrou intact (480 essais par jour) ne sauve pas un mot
de passe très faible : c'est la longueur minimale qui protège d'abord.
Mais la garde devient sans effet contre un attaquant qui a beaucoup
d'adresses. P2 tient.

**Voisinage.** C'est l'autre face de securite-portes-3, que le groupe
`securite` classe en tension. Il faut corriger celle-ci **avant** tout
assouplissement de l'autre (verification/securite.md l. 154-157).

**Correction** : celle de l'expert, les essais en vol comptés comme des
échecs tant qu'ils ne sont pas jugés, et libérés dans un `finally`, sorties
anticipées comprises.

### concurrence-3 · classement du jour gardé périmé — doublon de jour-regles-2, P2

**Rejoué** : Bob au rang 2 à 1 600 points alors que la base lui en donne
1 800 ; podium de la nuit pour Alice seule. `joueursDu` range le résultat
sous `this.revision` **après** ses attentes (jour.ts:885). `clore` lit ce
même cache (:1212). En ligne, la fenêtre est d'au moins un aller-retour
(le `SELECT`), et de plusieurs quand le cache des profils est froid, au
réveil de l'hébergeur (`byId`, profiles.ts:539-544). Le podium est
définitif (`INSERT OR IGNORE`). P2, comme les deux experts. Même racine et
même correction que jour-regles-2 : le groupe `jour` tranche la fusion.

### concurrence-4 · clôture rejouée sans ses paliers — doublon de recompenses-comptes-2, P3

**Rejoué** : `{"xp":8,"xpPaliers":0,"paliers":[]}` alors que
`hf:globe-trotteur:1` est en base. `accorderPaliers` ne rend que les paliers
neufs, et la fin se raconte à partir de ce qui vient de s'écrire.

**Gravité.** Je retiens **P3**. Le palier, son expérience et le légendaire
sont bien en base, et la page du profil les montre : seule l'annonce manque.
Il faut en plus que Turso refuse l'effacement à la clôture. Le groupe
`recompenses` tranche pour le constat fusionné, qui couvre aussi les
légendaires et les Divins.

**Correction** : raconter depuis la base, avec les paliers rangés sous
(soirée, espace). Elle règle aussi l'annonce appauvrie de concurrence-1.

### concurrence-5 · entré pendant la clôture — confirmé, P3

**Rejoué**, par le vrai `player:join` du banc. `party.clearAll()` efface tout
le monde (space.ts:1725), y compris qui est entré après la lecture de
`players` (:1415). Pour une clôture, le téléphone détaché ne reçoit ni fin ni
`party:reset` (:1771). Le client n'a aucune autre voie pour l'apprendre : il
reste en salle d'attente (socket.ts:68-106). P3 : la fenêtre dure le temps
de la clôture, et le QR est encore affiché.

**Correction** : celle de l'expert, `party:reset` à tout détaché absent de
la salle lue au départ.

### concurrence-6 · cache de bibliothèque dans le désordre — confirmé, P3

**Rejoué** : la salle voit « Sydney ». `refreshLibrary` pose ce que la
dernière réponse ramène (server.ts:301-304). La relecture est hors du verrou
d'enregistrement (`unParUn` à api.ts:239, `onLibraryChanged` à :259). Le
client libsql lance vingt requêtes HTTP à la fois (distante.ts), qui peuvent
revenir dans le désordre. Il faut deux écritures du même espace dans le même
aller-retour : c'est rare. P3.

**Correction** : le numéro de tour de l'expert. Autre voie équivalente :
chaîner les relectures par espace. La dernière partie est alors la dernière
posée.

### concurrence-7 · la réponse de 23 h 59 — doublon de jour-regles-7, P3

**Rejoué**, avec une porte posée dans `enregistrer`. Le contrôle de minuit
(jour.ts:658) précède l'écriture (:663). `clorePasses` prend `#nuit`, pas le
verrou du profil (:1188-1199). En vrai, la fenêtre est d'un aller-retour à
minuit pile. P3, comme les deux experts.

**Correction.** Préférer la marge de nuit de l'expert (clore les jours
antérieurs à `jourDe(maintenant - 60 s)`) : `DELAI_DISTANT_MS` borne toute
écriture à 10 s, et la réponse acceptée compte. L'écriture conditionnelle de
jour-regles-7 refuserait au contraire une réponse déjà acceptée. Les deux
peuvent se combiner.

### concurrence-8 · connexion en vol pendant le changement de mot de passe — confirmé, P3

**Rejoué**, avec une porte après `verify`. `revokeAll` supprime en base et en
mémoire ce qui existe à cet instant (profiles.ts:1146-1153). Une session
ouverte juste après survit. La vraie fenêtre est scrypt plus un
aller-retour ; un intrus qui se reconnecte en boucle y tombe sans effort.
P3 : il faut déjà connaître l'ancien mot de passe, et être dans la fenêtre.

**Correction** : celle de l'expert, la session insérée à condition que le
haché vérifié soit encore en base. Même garde pour `auth_sessions`.

### concurrence-9 · code de secours servi deux fois — confirmé, P3

**Rejoué** : `[false,true]`. `useRecovery` fait un `UPDATE … WHERE id = ?`
sans condition (profiles.ts:975-991). Le client n'a aucun renvoi automatique
(`req`, api.ts:85-100 ; `secours`, :302-306), et le formulaire se grise : il
faut deux onglets. P3.

**Correction** : celle de l'expert.

### concurrence-10 · codes de partage en rafale — confirmé, P3

**Rejoué** : 40 codes sur 40 essayés. La réserve se lit avant `await
deps.partages.recevoir` et ne s'écrit qu'après (partages.ts:86-92). Il faut
un compte d'animateur, et l'espace des codes rend la devinette hors de
portée. C'est du durcissement. P3.

**Correction** : celle de l'expert, l'essai compté avant l'attente et retiré
en cas de succès.

### concurrence-11 · geste d'animateur perdu à la reconnexion — doublon de client-3, P2

**Rejoué** : 2 re-présentations, aucun toast, et la clôture n'a jamais eu
lieu. Avec la vraie mise en réserve de socket.io-client, le geste part avant
`connect`, donc avant `host:hello`, et `requireHost` l'ignore
(sockets.ts:700). C'est le même défaut que client-3 et le même point que
securite-temps-reel-3.

**Gravité.** Je retiens **P2**, comme client-3, et non P3. Un « Révéler »
perdu, le chronomètre le rattrape. Mais un « Clore » perdu sans un mot peut
laisser la soirée ouverte. Rien ne clôt une soirée oubliée, et la suivante
la continuerait sous le même nom (invariant 11). Le groupe `client` tranche.

**Correction** : un `requireHost` qui présente la connexion par le cookie de
sa poignée de main et relit la session à chaque geste. Elle corrige
concurrence-11, client-3 et securite-temps-reel-3 à la fois. En attendant,
« Clore » inerte hors connexion (client-3).

## Les doublons et voisinages

- concurrence-3 = **jour-regles-2** : même ligne (jour.ts:885), même
  correction.
- concurrence-7 = **jour-regles-7** : la marge de nuit est préférable à
  l'écriture conditionnelle, ou s'y ajoute.
- concurrence-4 = **recompenses-comptes-2** (reprise) ;
  concurrence-1 ∩ recompenses-comptes-2 : les deux « Clore » croisés.
  recompenses-comptes-3 (paliers rangés deux fois par deux clôtures) partage
  la même garde, une fin à la fois.
- concurrence-11 = **client-3** (et client-2 pour « Révéler ») ; même
  fonction que **securite-temps-reel-3**.
- concurrence-2 ↔ **securite-portes-3** : les deux faces de `LoginBudget` ;
  corriger concurrence-2 d'abord.
- moteur-5 ↔ **recompenses-vitrine-6** : l'avatar absent du sondage, au
  bouton de vote d'un côté, au résultat de l'autre.
- moteur-11 : l'expert `client` l'avait cité hors mission, sans le rejouer.
  Ce n'est pas un doublon de constat.
- client-5 (double « Attribuer ») n'a pas d'équivalent dans ces deux
  rapports. Ni `moteur` (prix d'équipe) ni `concurrence` (double geste) ne
  l'ont vu. C'est la même famille que concurrence-1 : un geste sans garde
  d'unicité.
- Déjà rapporté : moteur-1 (retours/2026-09-24, salons-marc-lea, constat 3),
  que la PR #49 n'a pas corrigé sur ce point.
