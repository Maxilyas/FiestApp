# Les tests

> Comment le dépôt se vérifie — `npm run verify`, `npm test`, `npm run smoke` —, les trois aides des tests (le banc, la salle, le relais), comment écrire une épreuve et ce qui la fait trébucher ; puis chaque fichier de `server/test/`, rangé par thème. Pour qui touche au code.

**Dans cette page** : [deux suites](#deux-suites-et-un-filet) · [lancer les tests](#lancer-les-tests) · [le smoke](#le-test-de-bout-en-bout) · [les trois aides](#les-trois-aides) · [écrire une épreuve](#écrire-une-épreuve) · [les pièges](#les-pièges) · [les fichiers par thème](#les-fichiers-de-test-par-thème)

## Deux suites et un filet

- **`npm run smoke`** démarre de vrais serveurs sur des bases jetables et rejoue une soirée entière : la référence du chemin normal.
- **`npm test`** lance les fichiers de `server/test/` : ce qu'une soirée rejouée ne provoque jamais — pannes, courses, messages malformés, redémarrages — et les règles pures, les écrans rendus en HTML. Chaque fichier qui a besoin d'un serveur démarre le sien, jetable : aucun ne partage rien avec un autre.

**Un nouveau comportement arrive avec son test dans `server/test/`, qui échoue avant la correction ; le smoke ne s'allonge plus.** C'est un seul scénario : une soirée jouée au milieu fausse tout ce qui suit, et le symptôme ne désigne jamais la section fautive. **Et jamais une assertion supprimée ou désactivée pour la faire passer** (`CLAUDE.md`) : aucun fichier n'a de `skip`, de `only` ni de `todo`.

Aucune dépendance de plus (`node:test`, `node:assert`), ni linter, ni formateur, ni mesure de couverture. Aucun test ne lance de navigateur : regarder un écran est le travail des [scripts de rendu](../reference/commandes.md#photographier-lapplication).

## Lancer les tests

### `npm run verify`

`npm run check && npm run test && npm run build && npm run smoke`, arrêté à la première étape qui échoue — **avant chaque commit**. Une dizaine de minutes : sur la CI, de 8 min (5 octobre 2026) à 9 min 40 (13 octobre), dont 6 min 30 à 8 min de tests, 70 s de smoke, 20 à 30 s de typecheck, 5 s de build ; c'est `server/test/` qui grandit.

La CI (`.github/workflows/ci.yml`, « Vérification ») joue ces quatre étapes après un `npm ci`, sur Node 22, quinze minutes au plus : à chaque poussée sur `main`, à chaque PR, ou à la main. Une exécution plus récente de la même branche annule la précédente.

### `npm test`

`server/scripts/tests.mjs`, lancé depuis `server/` :

- **la liste** : tous les `test/*.test.ts`, triés par nom — faite par le script, car Node 20 ne développe pas le motif ;
- **un seul `node --test`** (`--import tsx`) : chaque fichier dans son processus, un de moins à la fois que la machine n'a de cœurs ;
- **120 s au plus par épreuve — et, en Node 22, par fichier entier** (`--test-timeout=120000`) : un fichier qui approche la minute et demie se coupe par thème, comme `server/test/credits.test.ts` est né de `server/test/cloture.test.ts` ;
- **un point par épreuve** (`--test-reporter=dot`) quand `CLAUDECODE` est posé — Claude Code le pose, et d'une commande qui échoue il ne lit que 10 000 caractères des 30 000 premiers : le TAP de toute la suite faisait 500 Ko, l'épreuve en échec n'y était jamais. Un terminal et la CI gardent le compte rendu de Node ;
- **en CI, les échecs redits à la fin** (`CI` posé) : le TAP reste, et un second compte rendu, en points, redit après le décompte chaque épreuve en échec, en entier — GitHub ne rend que les cinq mille dernières lignes d'un journal, et le TAP de la suite en fait quinze mille : le 17 octobre 2026, deux exécutions rouges n'ont pas pu dire quelle épreuve avait échoué (`server/test/compte-rendu-des-tests.test.ts`) ;
- **son code de sortie** est celui de `node --test` ; tué par un signal, 1.

Un seul fichier, ou une seule épreuve, depuis `server/` :

```bash
node scripts/tests.mjs test/miroir.test.ts                                  # les délais de npm test
node --import tsx --test --test-reporter=spec test/miroir.test.ts           # tous les journaux, sans délai : peut pendre
node --import tsx --test --test-name-pattern="panne" test/miroir.test.ts    # les épreuves dont le titre correspond
```

### Le test de bout en bout

`npm run smoke` lance `server/scripts/smoke.ts` : un seul `try`, et la première assertion fausse écrit `❌` et sort en code 1 — rien de ce qui suit n'est joué. Au bout, « ✅ Smoke test OK — 41 étapes ». Il neutralise l'Éclat, ferme les calendriers de saison (des soirées, des expéditions, du Cabinet), démarre huit serveurs (administrateur `antoine` / `smoke-pass-1`, espace `smoke`) et laisse ses dossiers `quizz-smoke-*` et `quizz-legacy-*` dans le dossier temporaire du système.

| § | Ce qu'elle joue |
|---|---|
| 0 à 0 ter | La liste collée, l'écart d'horloge (`bestSample`), niveaux et finitions, déplacer et insérer des questions |
| 1, 1 bis | L'écran commun : mauvais mot de passe, écriture sans l'en-tête maison, socket sans session ; cinq présentations refusées coupent la connexion ; trois identités par connexion |
| 2 à 8 | Deux invités, un quiz, les réponses et la rapidité, le classement ; la question suivante, l'accusé (`invalid`, `no-party`), le souffle et `too-late` ; la reconnexion par le jeton ; la fin du quiz |
| 9 à 10 bis | L'API derrière la session ; les comptes ; deux espaces qui ne se voient pas ; les photos ; la suppression d'un compte |
| 11 à 15 bis | Brouillon, quiz créé, joué, supprimé ; l'estimation, le retardataire, l'estimation absurde |
| 16 à 20 | La pause, le changement d'avis, le ×2, l'annulation, l'enchaînement ; renommer, exclure ; un prix de caractère ; le ménage des photos ; la photo à mémoriser |
| 21 à 23 | Les équipes à la moyenne ; statistiques et prix ; le bilan et l'export ; un redémarrage sur disque effacé, deux parties en cours |
| 30 | L'historique : ranger, renommer, « Nouvelle soirée », exporter, retirer |
| 31 à 35 | Chacune son serveur : une base d'avant les comptes ; la marge réseau et `time:sync` ; les profils jusqu'à « Clore la soirée » ; l'entrée et les homonymes ; une seule porte pour la console |

Les sections 24 à 29 sont devenues des fichiers de `server/test/`.

## Les trois aides

Trois modules de `server/test/` ne sont pas des tests.

### Le banc

`server/test/banc.ts` démarre **un vrai serveur sur deux bases jetables** — un dossier `quizz-banc-*` avec `locale.db` et `permanente.db`, un fichier `file:` qui tient le rôle de Turso — et donne de quoi lui parler.

- `demarrer(options)` passe ses options au serveur (`QuizServerOptions`, `server/src/server.ts` : `clientDist`, `baseDeLaCampagne`, `horlogeDuJour`, `miroir`, `rappels`…) et rend `{ url, server, dir, dbPath, quizDbUrl, redemarrer, close }`. `redemarrer({ disqueEfface: true })` rejoue le réveil de l'hébergeur — la base locale effacée, la permanente gardée, le même port ; `close()`, dans un `after()`, ferme tout et efface le dossier.
- Parler : `connecter`, `instantane` (le dernier instantané reçu qui convient, ou le prochain), `emitAck` (l'accusé, 5 s au plus), `attendre` (un événement, 8 s au plus), `ecrire` (avec l'en-tête `X-Requested-With: quizz`), `cookieDe`, `connexionAnimateur`, `inscrireProfil`.
- Préparer : `qcm`, `estimation`, `creerQuiz`, `ecranCommun`, `invite` (anonyme, profil, jeton qui se re-présente, hors classement), `lancerQuiz` (la première question trois secondes après), `patienter`, et `baseDEssai(n, …)`, une petite base de campagne valide.
- Son administrateur : `antoine` / `banc-pass-1`, espace `banc`. Il ferme les calendriers de saison dès son import — des soirées, des expéditions, du Cabinet ; il ne touche pas à l'Éclat.

Les scripts de rendu et `server/scripts/mesure-pages.ts` démarrent leur serveur par lui.

### La salle à horloge manuelle

`server/test/salle.ts` joue **le moteur seul** : le vrai `GameEngine`, le vrai module du quiz, les vrais registres sur une base SQLite en mémoire, une diffusion qui retient tout ce qui part, et une horloge qu'on avance à la main (`horloge()`, les `mock.timers` de `node:test`). Pour viser un instant qu'un vrai serveur ne laisse pas choisir — le souffle avant la révélation, une pause, un intertitre. Ses gestes : `inscrire`, `rejoindre`, `deconnecter`, `exclure`, `lancer`, `commande`, `visee`, `repondre`, `vueDe`, `vueHote`, `fermer`. `server/test/moteur.test.ts` s'en sert.

### Le relais

`server/test/relais.ts` est un relais TCP devant le serveur ; `trouNoir()` gèle les connexions ouvertes dans les deux sens, fermeture comprise, et laisse passer les suivantes. C'est le téléphone sur un wifi sans internet, qui se croit relié jusqu'au battement de cœur manqué (dix secondes plus huit). `server/test/liaison-morte.test.ts` s'en sert, devant le vrai module du client (`client/src/socket.ts`) chargé dans Node.

## Écrire une épreuve

1. **Trouve le fichier de son thème** ([la liste](#les-fichiers-de-test-par-thème)) ; un thème neuf a le sien.
2. **Choisis l'aide** : le serveur entier (routes, temps réel, bases, redémarrage) → le banc ; un instant du moteur → la salle ; une liaison morte → le relais ; une règle pure (`shared/`, une dérivation de `server/src/core/`) → un appel direct ; un écran → son composant rendu en HTML.
3. **Vois-la échouer** sur le code d'avant la correction. Son titre dit ce qui doit tenir ; le commentaire de tête du fichier dit pourquoi — le bug évité, la décision.
4. **Lance le fichier seul**, puis `npm run verify`.

Sur un serveur jetable, la forme de `server/test/banc.test.ts` :

```ts
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { attendre, connexionAnimateur, creerQuiz, demarrer, ecranCommun, emitAck, invite, lancerQuiz, qcm, type Banc } from './banc'

let banc: Banc
before(async () => {
  banc = await demarrer()
})
after(() => banc.close())

test('la réponse d’Alice est accusée, puis révélée', async () => {
  const cookie = await connexionAnimateur(banc.url)
  const quiz = await creerQuiz(banc.url, cookie, [qcm('On y est ?')])
  const host = await ecranCommun(banc.url, cookie)
  const alice = await invite(banc.url, 'Alice')

  const sessionId = await lancerQuiz(host, quiz)
  await attendre(alice.socket, 'session:view', (p: any) => p.view.phase === 'question', 'la question')
  const ack = await emitAck<any>(alice.socket, 'player:action', { sessionId, action: { type: 'answer', choice: 0 } })
  assert.equal(ack.ok, true, 'toute réponse reçoit un accusé')

  // Seule, sa réponse déclenche la révélation après le souffle.
  const revelee = await attendre<any>(alice.socket, 'session:view', p => p.view.phase === 'reveal', 'la révélation')
  assert.ok(revelee.view.yourPoints > 0)
})
```

Sur le moteur seul, la forme de `server/test/moteur.test.ts` :

```ts
import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { horloge, qcm, salle } from './salle'

let h: ReturnType<typeof horloge> | null = null
afterEach(() => {
  h?.arreter()
  h = null
})

test('la révélation attend le souffle', () => {
  h = horloge()
  const s = salle([{ id: 'q', title: 'Le moteur', questions: [qcm('Un ?')] }])
  s.inscrire('Alice')
  s.lancer(h.avancer)
  s.repondre('Alice', { type: 'answer', choice: 0 })
  h.avancer(699)
  assert.equal(s.st.phase, 'question')
  h.avancer(1)
  assert.equal(s.st.phase, 'reveal')
  s.fermer()
})
```

Un écran se teste rendu : pose `React` sur `globalThis` avant d'importer le composant (`await import(…)`) — sous `tsx`, le JSX du client appelle un `React` global —, puis `renderToStaticMarkup` (`react-dom/server`), et lis le HTML.

## Les pièges

- **`npm test` passe avant le build** : `client/dist/` n'existe pas encore (CI) ou date d'avant la retouche. Un test qui lit une page servie donne `clientDist` à son banc (`server/test/portes.test.ts`, `server/test/page.test.ts`).
- **Deux minutes par fichier**, pas seulement par épreuve. La commande `spec`, sans délai, peut pendre.
- **Un processus par fichier** : une affectation statique (`ProfileStore.tirageEclat`) ne fuit pas d'un fichier à l'autre, mais d'une épreuve à l'autre du même fichier si elle n'est pas rendue.
- **On compte, on ne chronomètre pas** : une machine chargée ferait échouer qui mesure des millisecondes. `server/test/grande-salle.test.ts` compte vues, écritures et messages, `server/test/jour-charge.test.ts` les allers-retours vers le fichier qui tient lieu de Turso ; les bornes de temps qui restent sont larges — un calcul (`server/test/protocole.test.ts`, au meilleur de trois essais) ou un délai qui doit tomber (`server/test/liaison-morte.test.ts`).
- **L'instantané arrive juste derrière l'accusé** de `host:hello` ou de `party:watch`, souvent dans le même paquet : un écouteur posé après l'accusé le rate. Lis-le par `instantane()`.
- **L'Éclat est un tirage** (`CHANCE_ECLAT`, et ses cousins du jour et du défi) dont le premier fait tomber un palier : un test qui compte l'expérience au point près neutralise `ProfileStore.tirageEclat`, ou il échoue une fois sur quarante. Le smoke le fait, pas le banc.
- **Le calendrier aussi** : close pendant Halloween, Noël ou le Nouvel An, une soirée ouvrait son légendaire de saison, et la CI aurait rougi dix-neuf jours par an. Le banc et le smoke ferment chaque calendrier de `server/src/core/saisons.ts` — des soirées (`calendrierDesSoirees`), des expéditions (`calendrierDesExpeditions`) et du Cabinet (`calendrierDuCabinet`, né le 25 octobre 2026, premier jour d'Halloween : la première œuvre gagnée pendant la fête réveille son gardien) ; `server/test/saisons.test.ts` et `server/test/expedition-saison.test.ts` rouvrent le leur. Un calendrier de plus — tout objet `{ periodeDu }` que le module exporte, quel que soit son nom — se ferme aux deux bouts, au smoke avant son premier serveur, ce que `server/test/calendrier.test.ts` vérifie.
- **Un joueur seul ne rapporte rien** : un figurant au moins pour de l'expérience, quatre joueurs pour des hauts faits. Deux bonnes réponses font un réflexe au plus rapide, à la milliseconde : qui compte au point près fait se tromper l'autre.
- **Un banc qui vit plus de vingt secondes lit la vraie base de la campagne** en fond, sauf `baseDeLaCampagne` (souvent `baseDEssai(…)`), que toute épreuve de la campagne donne : celle du dépôt grandit à chaque lot.
- **Simuler une panne** : un déclencheur `RAISE(ABORT)` sur le fichier de la base permanente (`server/test/miroir.test.ts`, `server/test/retrait.test.ts`) ; un démarrage, un SIGTERM ou le paquet construit, en processus enfant (`server/test/exploitation.test.ts`) ; un SIGKILL après une révélation (`server/test/miroir.test.ts`) ; une liaison morte, par le relais.
- **Des invités hors de l'adresse locale** passent par la réserve d'inscriptions (`server/src/core/inscriptions.ts`) : soixante d'un coup par adresse et par espace, puis soixante par minute. L'adresse locale n'a pas de limite.

## Les fichiers de test, par thème

Deux cent huit fichiers au 14 octobre 2026, quelque mille six cents épreuves ; cent quarante et un démarrent le banc. Chaque ligne résume le commentaire de tête du fichier, qui dit le reste — souvent le bug qui l'a fait naître.

### L'outillage, la mémoire de Claude, la documentation

- `server/test/banc.test.ts` — le banc lui-même : une question jouée, un réveil sur disque effacé qui ne perd rien.
- `server/test/notes-pour-claude.test.ts` — `CLAUDE.md` sous 200 lignes et 24 000 caractères, l'en-tête `paths:` de chaque règle, la carte, les fichiers cités.
- `server/test/documentation.test.ts` — `README.md` et `docs/` relus contre le code : fichiers cités, liens, sommaire, `npm run`, et la référence des routes, événements, variables, tables, adresses et barèmes.
- `server/test/vitrine.test.ts` — la vitrine publiée telle quelle sur GitHub Pages : chaque image et chaque lien dans le site, et l'aperçu d'un lien partagé publié avec la page, à la taille dite, sous 300 Ko.
- `server/test/calendrier.test.ts` — la suite ne dépend pas du jour où elle tourne : chaque calendrier de saison fermé au banc et au smoke, ouvert partout ailleurs.
- `server/test/emojis.test.ts` — aucun emoji postérieur à Unicode 12 dans le client, `shared/`, `server/src/` et `server/content/`.
- `server/test/divins.test.ts` — les Divins rares, et leurs règles hors du navigateur, des réponses d'API, de l'étagère et de la documentation.

### La soirée : le moteur, le quiz, les équipes

- `server/test/moteur.test.ts` — le moteur horloge à la main : arrivées, absents, pauses, enchaînement, intertitres.
- `server/test/bareme.test.ts` — le barème d'une réponse : l'estimation à l'écart, le bonus de rapidité.
- `server/test/variantes.test.ts` — « plusieurs », l'ordre, « Qui dans la salle ? », l'estimation en direct.
- `server/test/hasard.test.ts` — les réponses mélangées une fois, la copie jouée fait foi.
- `server/test/programme.test.ts` — le programme de la soirée et sa finale ×2.
- `server/test/enchainement.test.ts` — l'enchaînement réglé, d'un quiz à l'autre.
- `server/test/equipes.test.ts` — une seule règle de verdict des équipes, la moyenne par question.
- `server/test/equipes-choisies.test.ts` — de deux à six équipes d'un coup ; le retardataire compte dès le podium.
- `server/test/classement-en-cours.test.ts` — sa place au fil du quiz, ses voisins, sans coût pour la salle.
- `server/test/gestes.test.ts` — les petits gestes de la gestion des quiz.
- `server/test/regie.test.ts` — la télécommande du chef ; jamais la bonne réponse avant la salle.
- `server/test/chef-hors-classement.test.ts` — « J'anime seulement » : rien du chef ne compte.
- `server/test/resultats.test.ts` — qui gagne, qui reçoit quel prix.
- `server/test/scene.test.ts` — la scène des écrans d'animateur, tenue par le serveur.

### La salle : le temps réel, les invités, le chef

- `server/test/protocole.test.ts` — les gestes disent ce qu'ils visent ; le coût des diffusions à trois cents invités.
- `server/test/temps-reel.test.ts` — messages malformés, identité périmée, exclusion en pleine question, une salle derrière une box.
- `server/test/garde-fous.test.ts` — aucune commande `host:*` d'un téléphone ou d'un autre espace ; chronomètres réarmés.
- `server/test/poignee-de-main.test.ts` — un geste d'animateur relit la session de sa poignée de main.
- `server/test/grande-salle.test.ts` — le coût d'une réponse, d'une veille, d'une arrivée, compté.
- `server/test/au-geste.test.ts` — qui fait le geste se voit tout de suite.
- `server/test/liaison-morte.test.ts` — un geste dans une liaison morte : sonde, réouverture, renvoi.
- `server/test/rafales.test.ts` — les verrous des portes de connexion sous une rafale d'essais.
- `server/test/remise.test.ts` — un prix remis une fois, même cliqué deux fois.
- `server/test/reprise-rafale.test.ts` — « Rendre sa place » en rafale.
- `server/test/telephone-perdu.test.ts` — le téléphone mort : ne plus l'attendre, rendre sa place.
- `server/test/salle-attente.test.ts` — les puces de la salle d'attente ne se redessinent que si elles changent.
- `server/test/salle-vide.test.ts` — une question close sans réponse n'enchaîne pas seule.
- `server/test/salons.test.ts` — le salon d'un profil et son code à six chiffres.
- `server/test/barre-du-chef.test.ts` — la barre du chef qui joue, par une seconde liaison.
- `server/test/chef-entree.test.ts` — le chef entre sans « Entrer dans la soirée ».
- `server/test/equipes-du-chef.test.ts` — les équipes au téléphone du chef.
- `server/test/equipes-preparees.test.ts` — les équipes préparées avant d'ouvrir le salon.
- `server/test/fin-de-quiz-chef.test.ts` — « Le podium » puis « Quiz suivant ».
- `server/test/tele-salle.test.ts` — la télé branchée par un code, pur écran de salle.

### L'écran commun et ce que voient les téléphones

- `server/test/ecran.test.ts` — la taille des réponses, les marches du podium, la feuille de style.
- `server/test/petit-ecran.test.ts` — le téléphone à 320 px et au texte agrandi.
- `server/test/son.test.ts` — le premier geste ouvre le son de la télé.
- `server/test/console.test.ts` — les chiffres de la console.
- `server/test/accessibilite.test.ts` — ce qu'entend un lecteur d'écran.
- `server/test/toucher.test.ts` — la réponse se prend au lever du doigt.
- `server/test/entourage.test.ts` — anecdote, note, photo de révélation, intertitre : rien aux téléphones avant l'heure.

### La fin de soirée et les archives

- `server/test/cloture.test.ts` — « Clore la soirée », « C'était un essai », ce que l'historique garde.
- `server/test/credits.test.ts` — ce qu'une soirée crédite, la relecture de l'historique.
- `server/test/cloture-auto.test.ts` — la fin du programme : « Terminer la soirée ».
- `server/test/cloture-reprise.test.ts` — une clôture refusée puis reprise.
- `server/test/une-fin.test.ts` — une fin de soirée à la fois.
- `server/test/fin-allegee.test.ts` — la fin de soirée épurée, sans rien perdre, au format de toutes les fins : le tableau de bord, « Ce que tu gagnes », les trophées, deux boutons, « Plus ».
- `server/test/fin-de-soiree.test.ts` — record battu, objectifs proches, prix dans la collection.
- `server/test/fin-gardee.test.ts` — la fin gardée par le téléphone, jamais le récit d'un Divin.
- `server/test/entre-deux-soirees.test.ts` — la fin ne se rouvre qu'au retour sur la page.
- `server/test/pages-de-soiree.test.ts` — souvenir, bilan, historique public et leur flèche.
- `server/test/historique-compte.test.ts` — l'historique dans « Mon compte ».
- `server/test/liens.test.ts` — les liens d'une archive ne changent jamais.
- `server/test/retrait.test.ts` — retirer une soirée reprend ses crédits, même si la base hoquette.
- `server/test/soiree.test.ts` — le nom d'une soirée tiré une fois, les prix décidés à la clôture.

### Les journaux, le miroir, le démarrage

- `server/test/miroir.test.ts` — panne de Turso, processus tué après une révélation, effacement distant raté.
- `server/test/demarrage.test.ts` — les allers-retours du réveil, comptés.
- `server/test/relecture.test.ts` — les constats de la relecture des quarante-quatre commits.
- `server/test/enregistrement.test.ts` — deux appareils sur un même quiz : un 409 au lieu d'écraser.
- `server/test/categories.test.ts` — la catégorie d'une question, de l'éditeur à la fiche du joueur.

### L'exploitation

- `server/test/exploitation.test.ts` — le démarrage en processus enfant : le paquet, le SIGTERM, la sauvegarde.
- `server/test/portes.test.ts` — le statut, l'aperçu et l'indexation d'une adresse.
- `server/test/petites-portes.test.ts` — les petites portes du téléphone et de la console.
- `server/test/ressenti.test.ts` — ce que `/healthz` dit du ressenti.

### Le client : chargement, entrée, navigation, mots

- `server/test/chargement.test.ts` — les fichiers du paquet servis déjà compressés ; un téléchargement abandonné en route n'est pas une erreur serveur.
- `server/test/client.test.ts` — ce que le téléphone dit quand un appel échoue.
- `server/test/connexion-claire.test.ts` — trois gros boutons, « Jouer sans compte » d'abord.
- `server/test/depart.test.ts` — ce que la page demande dès son arrivée.
- `server/test/navigation.test.ts` — le liant entre les pages.
- `server/test/page.test.ts` — la page nommée par le serveur avant tout script.
- `server/test/medaillons.test.ts` — les dessins chargés à la demande.
- `server/test/mots.test.ts` — les noms des prix et leurs clés.
- `server/test/chiffres.test.ts` — la précision des QCM, le coup d'œil des estimations.
- `server/test/design.test.ts` — le système de design.
- `server/test/feuilles.test.ts` — une feuille, une carte ou un dialogue ouvert : la page de dessous ne défile plus, rien ne clignote à l’ouverture, rien ne se lit au travers, sous aucun thème, et le décor du thème se retire le temps qu’elle reste ouverte ; une feuille est une vraie fenêtre (le focus dedans, gardé quand on appuie sur son voile, le reste inerte, Échap).
- `server/test/typographie.test.ts` — élision, rang, espaces insécables.

### Les comptes, l'administration, le QG

- `server/test/admin-seulement.test.ts` — toute route d'administration refuse l'animateur et la télé.
- `server/test/administration.test.ts` — l'administration devenue le QG.
- `server/test/appairage.test.ts` — brancher la télé par un code.
- `server/test/emprunts.test.ts` — ce qu'une session d'emprunt ne peut pas faire.
- `server/test/espaces.test.ts` — ce que les espaces partagent sans le savoir.
- `server/test/profil-unique.test.ts` — un seul profil par personne.
- `server/test/profils-admin.test.ts` — chercher, supprimer un profil.
- `server/test/securite.test.ts` — retour après connexion, essais ratés, politique de contenu.
- `server/test/qg.test.ts` — le direct et la vue d'ensemble du QG.
- `server/test/journal.test.ts` — le journal des gestes de l'administrateur.
- `server/test/qg-soirees.test.ts` — les soirées au QG.
- `server/test/qg-serveur.test.ts` — la santé du serveur sur sept jours.
- `server/test/quota-de-turso.test.ts` — le quota de Turso : ce que chaque réponse de Turso dit avoir lu, compté heure par heure par les deux transports, projeté sur trente jours, ses requêtes lourdes nommées, et l'alerte de « À traiter ».
- `server/test/qg-erreurs.test.ts` — les erreurs au QG : le tri relu sur les versions — réglée, revenue, ignorée —, l'alerte qui ne compte que celles à regarder, et la panne d'un mode qui sonne sur le téléphone de l'administrateur, puis son retour, redémarrage compris.
- `server/test/veille.test.ts` — la veille des modes de jeu, l'horloge à la main : quand un mode tombe, quand il est rétabli, ce que la notification dit.
- `server/test/qg-charge.test.ts` — ce que les listes du QG coûtent à Turso : les quiz de tous les espaces d'une seule lecture.
- `server/test/qg-jour.test.ts` — le quiz du jour au QG : le tirage question par question, le classement du mois, les séries, le rappel du soir.
- `server/test/campagne-contredites.test.ts` — ce que les réponses contredisent, au QG : les plus nettes d'abord, et « Reclasser » à la difficulté qu'elles disent.
- `server/test/qg-campagne.test.ts` — la campagne au QG : le mélange d'un palier réglé pour les épreuves qui commencent, jamais celles en cours ; les paliers du jour, le défi sans jamais le tirer, les parcours, les vies.
- `server/test/qg-signalements.test.ts` — la page des signalements : corriger une question du jour — le jour qui l'a posée compris quand la bonne réponse ne change pas, ses points annulés dans le même geste —, reclasser au quiz du jour et en campagne — et les deux partis ensemble, chaque requête attendant son tour de boucle comme une réponse de Turso —, l'issue de chaque geste, l'historique, le merci sur l'accueil du joueur.
- `server/test/fiche-joueur.test.ts` — la fiche d'un joueur et ses gestes.

### Les profils et la collection

- `server/test/profil.test.ts` — ce que la page du profil relit.
- `server/test/profil-atlas.test.ts` — les écrans du profil.
- `server/test/loge.test.ts` — la loge : essayer, puis « Porter ».
- `server/test/grille-avatars.test.ts` — la grille des avatars.
- `server/test/album-des-avatars.test.ts` — l'album rangé par rareté.
- `server/test/ma-collection.test.ts` — tout ce qui se gagne : trois familles, les albums des avatars, des trophées et des thèmes, les adresses d'avant.
- `server/test/trophees.test.ts` — l'album des trophées : une page par mode, chaque piste et ce que chaque étape ouvre, relus contre les règles des fonds, des gerbes, des thèmes et des légendaires.
- `server/test/collection.test.ts` — les emojis de collection, réservés aux profils.
- `server/test/carte.test.ts` — la carte d'un joueur.
- `server/test/carte-du-solo.test.ts` — la carte de qui ne joue qu'en solo.
- `server/test/carte-a-collectionner.test.ts` — la carte à collectionner : le cadre de sa ligue, le tableau de son dos, son retournement, son fond sur l'illustration, son compagnon perché et en grand.
- `server/test/avatars-des-pages.test.ts` — l'avatar porté dans le souvenir et le bilan.
- `server/test/proches.test.ts` — « Les plus proches ».
- `server/test/premier-haut-fait.test.ts` — le titre et la vitrine d'un débutant.
- `server/test/menu.test.ts` — la barre du menu.
- `server/test/mots-du-solo.test.ts` — les mots du jeu solo.
- `server/test/compagnons.test.ts` — les compagnons de la boutique.

### Les récompenses

- `server/test/experience.test.ts` — le barème de l'expérience.
- `server/test/hautsfaits.test.ts` — hauts faits, paliers, légendaires.
- `server/test/legendaires.test.ts` — durcir un légendaire ne reprend rien.
- `server/test/niveaux.test.ts` — personne ne redescend de niveau.
- `server/test/eclat.test.ts` — ce qui éclate.
- `server/test/eclat-hors-soiree.test.ts` — l'Éclat au quiz du jour et au défi.
- `server/test/ecussons.test.ts` — les écussons de savoir.
- `server/test/recalcul.test.ts` — relire l'historique une fois, jamais sur une base qui hoquette.
- `server/test/saisons.test.ts` — les légendaires de saison.
- `server/test/saisons-relues.test.ts` — les saisons des soirées déjà rangées.
- `server/test/sphinx.test.ts` — le Sphinx.
- `server/test/recompenses-montrees.test.ts` — ce que les récompenses montrent.
- `server/test/gains.test.ts` — l'écran des gains de toutes les fins : une ligne par piste, les plus rares d'abord, « À porter » et son « Essayer », les étoiles du quiz du jour ; chaque fin passe par les mêmes pièces.

### Les dessins

- `server/test/avatar-en-grand.test.ts` — l'avatar de la carte, en grand.
- `server/test/branches.test.ts` — les avatars du savoir.
- `server/test/compagnons-peints.test.ts` — les compagnons peints.
- `server/test/finitions.test.ts` — ex æquo, coupures, export, prêt : les suites de la première vague.
- `server/test/lumieres.test.ts` — la lumière des trois dernières finitions.
- `server/test/medaillons-peints.test.ts` — légendaires et Divins peints.
- `server/test/bordures.test.ts` — les bordures de ligue.

### Les thèmes et la boutique

- `server/test/a-la-une.test.ts` — « À la une » : un compagnon, un thème, un fond, et le bandeau qui se glisse.
- `server/test/boutique.test.ts` — les quatre rayons de la boutique.
- `server/test/decors-peints.test.ts` — les décors peints.
- `server/test/fonds.test.ts` — les fonds de carte.
- `server/test/fonds-des-savoirs.test.ts` — les fonds des savoirs : l'achat, ses refus, le QG, la suppression.
- `server/test/gerbes.test.ts` — les gerbes.
- `server/test/heros.test.ts` — les pages phares.
- `server/test/themes.test.ts` — les thèmes et leurs confettis.

### Les missions du jour et le coffre de la semaine

- `server/test/missions.test.ts` — trois missions par jour, ce qui est fait retenu une fois, le coffre du lundi.
- `server/test/missions-page.test.ts` — ce que la page sait de ses missions : une lecture partagée, le refus d'un invité.
- `server/test/missions-charge.test.ts` — ce que la ligne de l'accueil attend de Turso.

### La bibliothèque de quiz

- `server/test/bibliotheque.test.ts` — retrouver, ranger, tout emporter.
- `server/test/brouillon.test.ts` — l'éditeur face à l'hébergeur qui s'endort.
- `server/test/console-tout-pret.test.ts` — le quiz tout prêt depuis la console.
- `server/test/echange.test.ts` — un quiz qui voyage, photos comprises.
- `server/test/editeur.test.ts` — une question neuve reprend sa voisine.
- `server/test/editeur-allers-retours.test.ts` — ce qu'un quiz perdait en voyageant.
- `server/test/editeur-pertes.test.ts` — ce que l'éditeur perdait sans le dire.
- `server/test/liste.test.ts` — la liste collée et son format.
- `server/test/memoire.test.ts` — la mémoire des quiz.
- `server/test/mes-quiz.test.ts` — « Mes quiz » au pouce.
- `server/test/nombres.test.ts` — un nombre tapé se lit d'une seule façon.
- `server/test/partage.test.ts` — partager un quiz.
- `server/test/quiz-tout-pret.test.ts` — un quiz tout prêt.
- `server/test/quiz-tout-pret-apercu.test.ts` — sa feuille dit ce qu'il composera.
- `server/test/une-autre-question.test.ts` — « Une autre » dans l'éditeur.

### Le quiz du jour

- `server/test/jour.test.ts` — ses règles pures.
- `server/test/jour-partie.test.ts` — joué de bout en bout, minuit passé.
- `server/test/jour-justesse.test.ts` — juste jusqu'au bout.
- `server/test/jour-charge.test.ts` — ce qu'une visite coûte à Turso.
- `server/test/jour-mois.test.ts` — la partie et le mois.
- `server/test/jour-nuit.test.ts` — ce que la nuit décerne.
- `server/test/jour-paliers.test.ts` — ses paliers.
- `server/test/jour-telephone.test.ts` — quand le réseau, le doigt ou l'horloge trahissent.
- `server/test/jour-reserve.test.ts` — la réserve et sa porte.
- `server/test/etiquetage.test.ts` — les métadonnées d'une question, sa difficulté mesurée.
- `server/test/corrige.test.ts` — le corrigé d'une question.
- `server/test/laurier.test.ts` — le laurier du vainqueur d'hier.
- `server/test/soiree-et-jour.test.ts` — la soirée et le quiz du jour se parlent.
- `server/test/rappel.test.ts` — le rappel du soir, seule notification d'un joueur — et le service worker sous `/admin`, celui des alertes du QG. Le faux service de push et ses téléphones vivent dans `server/test/push.ts`.
- `server/test/installation.test.ts` — installer l'application.

### La campagne et sa base

- `server/test/campagne.test.ts` — la série : sa base à elle, les jamais vues d'abord, trois vies comptées au serveur.
- `server/test/campagne-abandon.test.ts` — abandonner une série décerne ce qu'elle a joué.
- `server/test/campagne-carnet.test.ts` — le carnet de révision, relu du journal des réponses.
- `server/test/campagne-charge.test.ts` — ce qu'une réponse de campagne coûte à Turso.
- `server/test/journal-des-reponses.test.ts` — le journal des réponses gardé en mémoire : chaque dérivation — la mesure, le modèle, l'expérience, les vues, les écussons, les missions, le carnet, les compagnons, les épreuves des sentiers — comparée au SQL d'avant sur une base au hasard, lue par tranches, en double et en retard, des rébus, des frises et des pièces du Cabinet (`cab:`) compris, qu'aucun carnet ne garde ; puis ses tranches gardées (`campagne_tranches`) : un réveil qui les relit au lieu de toute la base, un duel annulé depuis, une tranche égarée, illisible ou d'avant, une réponse effacée ou modifiée et une série effacée, qui les effacent.
- `server/test/hors-de-la-base.test.ts` — ce qui n'est pas une question de la base, d'une seule liste (`shared/horsDeLaBase.ts`) : le rébus, la frise et le Cabinet, chacun sa phrase au signalement ; le même partage en SQL qu'en mémoire ; une garde qui relit le code du serveur et de `shared/` — pas ses commentaires — pour qu'aucun filtre ni aucun refus n'y soit recopié ; puis, par les routes, une partie du Cabinet ratée : sa question de la base entre au carnet et se signale, le reste non.
- `server/test/journal-des-duels.test.ts` — le journal des duels gardé en mémoire, comparé joueur par joueur à la lecture d'avant (`lectureDesDuels`) sur une base au hasard : lu une fois, puis ce qui ferme sans rien écrire, ce qui finit sous ses yeux, ce qui s'écrit sans lui, et une fin écrite ailleurs, que la relecture du démarrage voit ; puis ce que ses relectures ne perdent pas en route — un lot de fin de partie sans réponse, une réponse écrite juste après la fermeture de son duel, une relecture ratée, une lue avant le départ d'un profil —, l'horloge à la main et les réponses retenues par une porte.
- `server/test/campagne-defi.test.ts` — le défi de la semaine, son vainqueur, le laurier d'argent.
- `server/test/campagne-en-tete.test.ts` — les bonnes réponses sous le numéro de la question.
- `server/test/campagne-ouverture.test.ts` — la page s'ouvre avant la réponse du serveur.
- `server/test/campagne-recompenses.test.ts` — hauts faits de série, paliers, légendaires, records par catégorie.
- `server/test/campagne-sujets.test.ts` — une série sur un sujet qui traverse les catégories.
- `server/test/campagne-variete.test.ts` — catégories et sous-thèmes à tour de rôle.
- `server/test/campagne-familles.test.ts` — une question part de la part que trouve sa famille : sa catégorie et sa difficulté, ou, pour une année, un nombre, un vrai ou faux, sa forme.
- `server/test/bareme-du-solo.test.ts` — le barème du solo et son recompte au démarrage.
- `server/test/tirage-sans-redite.test.ts` — pas deux jumelles dans une épreuve ou un duel.
- `server/test/tirage-a-la-piece.test.ts` — le tirage à la pièce, sorti de `core/campagne.ts` (`core/tirageALaPiece.ts`) : comparé au code d'avant, gardé dans le test, au même hasard — l'escale, le battage d'une question, la moins vue, la frise de quatre ; puis ce qu'il apprend pour le Cabinet : la fenêtre de sept jours, deux marches qui se valent, cinq QCM d'un coup pour l'Éclair ; et la frise de sept, jamais sous l'écart (`choisirLaFriseSansRepli`) — sur des tas serrés, contre toutes les suites possibles.
- `server/test/porte-de-la-campagne.test.ts` — la porte du Cabinet de curiosités vers la campagne (`core/porteDeLaCampagne.ts`), sur le magasin même, ses allers-retours comptés : le réveil, qui pose ses tables, sa colonne et son secret sans un aller-retour de plus ; le secret, tiré une fois pour deux serveurs et un redémarrage ; le rituel d'une réponse (l'expédition en route qui relit ce qu'il a vu, le journal qui se sait en retard) ; la fin d'une partie — l'expérience créditée une fois, au rang de chaque juste dans son jour de Paris, minuit compris, ses gardiens, ses paliers, le compagnon, dans cet ordre —, rien de refait quand le geste qui garde le lot était déjà pris, et rien qui fasse échouer une fin écrite ; un lot refusé ; ce que le Cabinet ajoute aux paliers, sans un compte de la campagne ; la base gardée, et le verrou du profil, dans les deux sens.
- `server/test/campagne-base.test.ts` — la base livrée : rien de défectueux n'y entre, elle ne recule jamais.
- `server/test/campagne-routine.test.ts` — le dépôt du matin, relu par le juge, plafonné.
- `server/test/campagne-signalements.test.ts` — les signalements : garder, retirer, corriger.
- `server/test/meme-fait.test.ts` — le même fait sous deux intitulés.
- `server/test/generer-campagne.test.ts` — la génération en nombre : vagues, dédoublonnage, relecture rejouée.
- `server/test/inventaires.test.ts` — les inventaires de la danse, de la santé, de la langue française, de l'anglais et de l'espagnol : la consigne qui les donne, la commande famille par famille, la couverture et ce qui reste sans question.
- `server/test/faits-wikidata.test.ts` — les faits de Wikidata, sans réseau.
- `server/test/reponses-soufflees.test.ts` — les réponses soufflées par leur racine.

### Les sentiers du savoir et les parcours de thème

- `server/test/sentiers.test.ts` — les paliers, le seuil, les portraits, les vies.
- `server/test/sentiers-chapitres.test.ts` — les huit premiers paliers deux par deux, un thème chacun.
- `server/test/sentiers-panorama.test.ts` — le haut des sentiers en un seul bloc.
- `server/test/sentiers-reprise.test.ts` — les portraits d'avant les sentiers, repris en paliers.
- `server/test/sentiers-sujets.test.ts` — les sentiers à thème, sans vies.
- `server/test/sentiers-une-epreuve.test.ts` — une épreuve à la fois, dite à l'écran.
- `server/test/sentiers-vies.test.ts` — les vies du jour, celles qu'on achète, l'administration des paliers.
- `server/test/sentiers-pour-toi.test.ts` — sa chance sur chaque sentier, en couleur de piste, et ce qu'elle valait il y a une semaine.
- `server/test/parcours.test.ts` — les parcours de thème, dans « Apprendre ».

### Les duels et les amis

- `server/test/duels.test.ts` — la cote relue du journal, les ligues du lundi, le dé contre Automate.
- `server/test/duels-attente.test.ts` — ce que « Défier » et le dé font attendre.
- `server/test/duels-index.test.ts` — le plan de chaque requête qui joint les tentatives d'un duel, sur une base sans statistiques comme la production : par le code du duel, jamais par le profil, et jamais toutes les tentatives du serveur pour les duels d'un seul joueur ; et le rattrapage du journal des duels, qui part du `rowid` de la dernière série vue.
- `server/test/duels-contre.test.ts` — défier quelqu'un en particulier.
- `server/test/duels-historique.test.ts` — bilan, records, face-à-face, courbe de la cote.
- `server/test/duels-page.test.ts` — le score d'en face jamais écrit avant l'heure.
- `server/test/duels-place.test.ts` — sa place au classement des duels.
- `server/test/campagne-amis.test.ts` — les amis noués par les défis.
- `server/test/campagne-duel.test.ts` — le défi entre amis d'avant.
- `server/test/campagne-rencontre.test.ts` — le dé : Automate, tout de suite.
- `server/test/amis.test.ts` — la feuille des amis, qui est en ligne.
- `server/test/amis-feuille.test.ts` — la feuille des amis et la page des duels, rendues.
- `server/test/joueurs-croises.test.ts` — les joueurs croisés, à défier ou à ajouter.
- `server/test/modele-du-savoir.test.ts` — le modèle du savoir, qu'Automate et la page des sentiers lisent : ce que vaut chaque difficulté estimée, appris en bloc.

## Pour aller plus loin

- [Les commandes](../reference/commandes.md) — chaque script npm et chaque script de `server/scripts/`
- [Démarrer dans le code](demarrer.md) — installer, lancer, le cycle d'une modification
- [Les conventions](conventions.md) — les commentaires qui disent pourquoi, les erreurs, les dépendances
- [Travailler avec Claude](outillage-claude.md) — la tablée, qui montre ce que les tests ne disent pas
