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

`npm run check && npm run test && npm run build && npm run smoke`, arrêté à la première étape qui échoue — **avant chaque commit**. Environ neuf minutes sur quatre cœurs (8 min 51 le 1er novembre 2026), dont six et demie de tests, 70 s de smoke, 20 à 45 s de typecheck, 5 à 20 s de build ; c'est `server/test/` qui grandit. Il en prenait quatorze et demie, dont 12 min 05 de tests, avant que les tests passent à huit fichiers à la fois (le même jour).

La CI (`.github/workflows/ci.yml`, « Vérification ») ne tenait plus sur une machine : de 8 min (5 octobre 2026) à 14 min 46 (1er novembre), dont 12 min 20 de tests, et sa borne de quinze minutes a coupé le smoke d'une PR qui ajoutait des tests. Depuis le 1er novembre 2026, elle se répartit sur cinq machines à la fois, après un `npm ci`, sur Node 22 :

- **quatre tranches de tests** (`tests 1/4` … `tests 4/4`, `node scripts/tests.mjs --tranche=2/4`), deux à trois minutes chacune : chaque fichier dans une tranche et une seule ; une tranche qui échoue laisse les autres finir ;
- **le typecheck, le build et le smoke** à la suite sur la cinquième (`typecheck, build et smoke`) ;
- **`verifier`**, la vérification d'avant, qui garde son nom : elle attend les cinq, et ne passe que s'ils sont tous passés — jugée même quand l'une échoue ou est annulée (`if: always()`), car une vérification sautée passe pour réussie aux yeux de GitHub (`server/test/tranches-des-tests.test.ts`).

Chacune a quinze minutes au plus, un filet contre l'exécution qui pend. Elle tourne à chaque poussée sur `main`, à chaque PR, ou à la main, et une exécution plus récente de la même branche annule la précédente. Le dépôt est public : ces machines ne coûtent rien.

### `npm test`

`server/scripts/tests.mjs`, lancé depuis `server/` :

- **la liste** : tous les `test/*.test.ts`, triés par nom — faite par le script, car Node 20 ne développe pas le motif ;
- **un seul `node --test`** (`--import tsx`) : chaque fichier dans son processus, **deux à la fois par cœur**, seize au plus (`--test-concurrency`, depuis Node 20.10) — près de la moitié de la suite attend de vraies minuteries sans rien calculer (l'ouverture d'une question, le calme avant sa révélation, la grâce) : le 1er novembre 2026, sur quatre cœurs, trois fichiers à la fois (le défaut de Node, un de moins que de cœurs) prenaient 12 min 05 pour 21 min de processeur, huit à la fois 6 min 21, près du plancher de ce processeur ;
- **`--tranche=2/4`** ne lance que la deuxième tranche sur quatre — le fichier de rang i, dans l'ordre des noms, va à la tranche i modulo 4 —, et **`--liste`** écrit les fichiers qu'il lancerait, sans en lancer aucun : la CI s'en sert ;
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

Trois modules de `server/test/` ne sont pas des tests et servent à tous. D'autres servent un seul thème, chacun sa ligne [plus bas](#les-fichiers-de-test-par-thème) : `server/test/push.ts`, `server/test/garde-des-connexions.ts`, `server/test/chemin-des-imports.ts`, `server/test/teintes.ts`, `server/test/expedition-journal.ts`, et ceux du Cabinet de curiosités — `server/test/cabinet-banc.ts`, `server/test/cabinet-plans.ts`, `server/test/calibrage-du-cabinet.ts`.

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
- **Le calendrier aussi** : close pendant une fête, une soirée ouvrait son légendaire de saison — et le timbre de son année depuis le 1er novembre 2026 —, et la CI aurait rougi dix-neuf jours par an avec Halloween, Noël et le Nouvel An, soixante et onze à partir de 2027 avec les cinq fêtes de plus. Le banc et le smoke ferment chaque calendrier de `server/src/core/saisons.ts` — des soirées (`calendrierDesSoirees`), des expéditions (`calendrierDesExpeditions`) et du Cabinet (`calendrierDuCabinet`, né le 25 octobre 2026, premier jour d'Halloween : la première œuvre gagnée pendant la fête réveille son gardien) ; `server/test/saisons.test.ts`, `server/test/fetes.test.ts` et `server/test/expedition-saison.test.ts` rouvrent le leur. Le quiz du jour n'a pas de calendrier : un test qui le joue pendant une fête date ses parties (`horlogeDuJour`). Un calendrier de plus — tout objet `{ periodeDu }` que le module exporte, quel que soit son nom — se ferme aux deux bouts, au smoke avant son premier serveur, ce que `server/test/calendrier.test.ts` vérifie.
- **Un joueur seul ne rapporte rien** : un figurant au moins pour de l'expérience, quatre joueurs pour des hauts faits. Deux bonnes réponses font un réflexe au plus rapide, à la milliseconde : qui compte au point près fait se tromper l'autre.
- **Un banc qui vit plus de vingt secondes lit la vraie base de la campagne** en fond, sauf `baseDeLaCampagne` (souvent `baseDEssai(…)`), que toute épreuve de la campagne donne : celle du dépôt grandit à chaque lot.
- **Simuler une panne** : un déclencheur `RAISE(ABORT)` sur le fichier de la base permanente (`server/test/miroir.test.ts`, `server/test/retrait.test.ts`) ; un démarrage, un SIGTERM ou le paquet construit, en processus enfant (`server/test/exploitation.test.ts`) ; un SIGKILL après une révélation (`server/test/miroir.test.ts`) ; une liaison morte, par le relais.
- **Des invités hors de l'adresse locale** passent par la réserve d'inscriptions (`server/src/core/inscriptions.ts`) : soixante d'un coup par adresse et par espace, puis soixante par minute. L'adresse locale n'a pas de limite.

## Les fichiers de test, par thème

Plus de trois cents fichiers au 26 octobre 2026, quelque trois mille épreuves ; plus de deux cents démarrent un serveur — le banc, ou celui du Cabinet, qui passe par lui. Chaque ligne résume le commentaire de tête du fichier, qui dit le reste — souvent le bug qui l'a fait naître. Un fichier neuf y prend sa ligne dans le commit qui le crée : `server/test/liste-des-tests.test.ts` rougit tant qu'il ne l'a pas.

### L'outillage, la mémoire de Claude, la documentation

- `server/test/banc.test.ts` — le banc lui-même : une question jouée, un réveil sur disque effacé qui ne perd rien.
- `server/test/notes-pour-claude.test.ts` — `CLAUDE.md` sous 200 lignes et 24 000 caractères, l'en-tête `paths:` de chaque règle, la carte, les fichiers cités.
- `server/test/documentation.test.ts` — `README.md` et `docs/` relus contre le code : fichiers cités, liens, sommaire, `npm run`, et la référence des routes, événements, variables, tables, adresses et barèmes.
- `server/test/liste-des-tests.test.ts` — chaque fichier de `server/test/` a sa ligne ici, sous son thème, une seule ; seules les trois aides de tous s'en passent. Le 26 octobre 2026, quatre-vingt-dix-huit n'avaient pas la leur.
- `server/test/compte-rendu-des-tests.test.ts` — le compte rendu de `npm test` en CI : le TAP tel quel, puis chaque épreuve en échec redite en entier après le décompte, là où GitHub la montre encore.
- `server/test/tranches-des-tests.test.ts` — la CI en quatre tranches ne perd rien : chaque fichier de `server/test/` dans une tranche et une seule (`--tranche`, `--liste`), chaque tranche lancée par la CI, et `verifier` rouge dès qu'une tranche ou le bout en bout l'est.
- `server/test/vitrine.test.ts` — la vitrine publiée telle quelle sur GitHub Pages : chaque image et chaque lien dans le site, et l'aperçu d'un lien partagé publié avec la page, à la taille dite, sous 300 Ko.
- `server/test/calendrier.test.ts` — la suite ne dépend pas du jour où elle tourne : chaque calendrier de saison fermé au banc et au smoke, ouvert partout ailleurs.
- `server/test/emojis.test.ts` — aucun emoji postérieur à Unicode 12 dans le client, `shared/`, `server/src/` et `server/content/`.
- `server/test/divins.test.ts` — les Divins rares, et leurs règles hors du navigateur, des réponses d'API, de l'étagère et de la documentation.
- `server/test/tablee.test.ts` — le banc des agents : `toucher --a` là où l'on vise (une décimale à la française refusée), un curseur qui ne se tape pas, la lettre seule qui vise sa touche et jamais « Quitter » (`nomDUnSigneSeul`), la photo qui attend les images qu'elle montre — la page entière, ses paresseuses comprises, éprouvée sur de fausses images —, le dé et ses tirages au journal, ce que la régie en branche, la chronologie des dés ; chaque geste de la régie dit dans l'aide du pilote et dans les consignes ; les personnages du Cabinet qui ignorent des choses, leur domaine lu au sujet quand la manche tait sa catégorie ; la marche de chaque chose à savoir, lue au plan figé d'une partie jouée sur un vrai serveur (`bancDuCabinet`) ; les seuils du dé recalculés du modèle du calibrage — ceux des consignes au joueur « tablée », ceux d'Ophélie à l'occasionnel.

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
- `server/test/homonymes.test.ts` — « Camille (2) » compare l'avatar qu'on voit — le légendaire, le portrait, le compagnon ou le Divin porté, sinon l'emoji —, jamais la finition, l'Éclat ni la bordure.

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
- `server/test/appels-en-route.test.ts` — un appel à la base distante qui ne revient jamais (`clientBorne`) : borné de bout en bout, le suivant part d'un client neuf, et plus rien ne fige ce qui l'attendait.
- `server/test/connexions-de-la-base.test.ts` — les connexions vers Turso comptées — ouvertes, refermées par la base, tombées en route —, l'entretien qui les garde chaudes (`QUIZ_DB_KEEPWARM`) et la garde à l'heure de Node après un gel de la boucle, par le `fetch` de Node.
- `server/test/garde-des-connexions.ts` — pas un fichier de tests : ce que tout transport vers la base permanente doit tenir, déclaré pour un transport (`testerLesConnexions`), que le fichier précédent et le suivant jouent.
- `server/test/transport-leger.test.ts` — le transport léger (`QUIZ_DB_TRANSPORT=leger`) : la garde des connexions entière, puis ce qui lui est propre.

### L'exploitation

- `server/test/exploitation.test.ts` — le démarrage en processus enfant : le paquet, le SIGTERM, la sauvegarde.
- `server/test/portes.test.ts` — le statut, l'aperçu et l'indexation d'une adresse.
- `server/test/petites-portes.test.ts` — les petites portes du téléphone et de la console.
- `server/test/ressenti.test.ts` — ce que `/healthz` dit du ressenti.
- `server/test/base-preparee.test.ts` — la base de la campagne vérifiée une fois au build et relue telle quelle au réveil, le dossier relu quand elle ne le dit plus.
- `server/test/ramasse-miettes.test.ts` — le ramasse-miettes réglé par la commande de démarrage, que `NODE_OPTIONS` refuse, et `/healthz` qui dit s'il a pris.

### Le client : chargement, entrée, navigation, mots

- `server/test/chargement.test.ts` — les fichiers du paquet servis déjà compressés ; un téléchargement abandonné en route n'est pas une erreur serveur.
- `server/test/client.test.ts` — ce que le téléphone dit quand un appel échoue.
- `server/test/connexion-claire.test.ts` — trois gros boutons, « Jouer sans compte » d'abord ; un profil qui naît, et chaque refus sous le champ qu'il vise ; un titre de premier niveau à chaque écran de connexion.
- `server/test/depart.test.ts` — ce que la page demande dès son arrivée.
- `server/test/navigation.test.ts` — le liant entre les pages.
- `server/test/page.test.ts` — la page nommée par le serveur avant tout script.
- `server/test/medaillons.test.ts` — les dessins chargés à la demande.
- `server/test/mots.test.ts` — les noms des prix et leurs clés.
- `server/test/chiffres.test.ts` — la précision des QCM, le coup d'œil des estimations.
- `server/test/design.test.ts` — le système de design.
- `server/test/feuilles.test.ts` — une feuille, une carte ou un dialogue ouvert : la page de dessous ne défile plus, rien ne clignote à l’ouverture, rien ne se lit au travers, sous aucun thème, et le décor du thème se retire le temps qu’elle reste ouverte ; une feuille est une vraie fenêtre (le focus dedans, gardé quand on appuie sur son voile, le reste inerte, Échap).
- `server/test/typographie.test.ts` — élision, rang, espaces insécables.
- `server/test/chemin-des-imports.ts` — pas un fichier de tests : ce qu'une page télécharge avec elle, ses imports statiques de proche en proche, que partagent ceux qui gardent un chemin léger.
- `server/test/teintes.ts` — pas un fichier de tests : les couleurs de chaque thème lues dans sa feuille et le contraste qu'on en tire, une seule copie pour `server/test/design.test.ts` et `server/test/cabinet-ecran.test.ts`.

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
- `server/test/qg-activite.test.ts` — l'activité au QG : les questions jouées et les parties, mode par mode et jour par jour, et ce que chaque profil a joué ; des soirées des autres, rien que des chiffres.
- `server/test/qg-duels.test.ts` — les duels au QG : jour par jour, les ligues et le classement tels que les joueurs les voient, ceux qui attendent leur adversaire, et « Annuler » un duel qu'il n'a pas commencé.
- `server/test/qg-economie.test.ts` — l'économie au QG : les confettis gagnés et dépensés source par source, ceux qui circulent — égaux aux soldes des profils, au confetti près —, les meilleures ventes, les Éclats et les légendaires portés.
- `server/test/maintenance.test.ts` — le bandeau rouge et les pages fermées le temps d'une réparation, puis bientôt disponibles à leurs seuls testeurs ; chaque porte relue dans le routeur.
- `server/test/annonces.test.ts` — les annonces à tous : un message lu une fois en haut de chaque accueil, des confettis pour chacun en un seul lot, une question à poser, une réponse par profil.
- `server/test/affiches.test.ts` — l'affiche des nouveautés : posée au QG, une par page, montrée sur chaque accueil et « Nouveau » sur le bouton de sa page jusqu'à la visite — notée quand le serveur sert la page, ses confettis offerts une fois, même après un redémarrage —, « Plus tard » qui la range, sa fin, son retrait, une page fermée qui ne compte pas, le Cabinet là où il ne s'ouvre pas, un profil supprimé ; et l'affiche et les pastilles rendues.

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
- `server/test/carte-a-collectionner.test.ts` — la carte à collectionner : le cadre de sa ligue, le tableau de son dos, son retournement de face en face, son fond sur chaque face, son compagnon perché et en grand.
- `server/test/carte-savoir.test.ts` — ses faces de plus : le radar de son savoir (dix QCM par catégorie, ses forces, ce qui lui reste à conquérir) et la moyenne des joueurs, ses sentiers, le retournement d'une face à l'autre, les deux faces rendues, et le serveur qui les remplit.
- `server/test/avatars-des-pages.test.ts` — l'avatar porté dans le souvenir et le bilan.
- `server/test/proches.test.ts` — « Les plus proches ».
- `server/test/premier-haut-fait.test.ts` — le titre et la vitrine d'un débutant.
- `server/test/menu.test.ts` — la barre du menu.
- `server/test/mots-du-solo.test.ts` — les mots du jeu solo.
- `server/test/compagnons.test.ts` — les compagnons de la boutique.
- `server/test/nouveautes.test.ts` — la pastille rouge des nouveautés : ce que le serveur retient qu'un profil a vu dans sa loge, pour tous ses appareils, et chaque nouveauté de la pièce « Avatar » marquée jusqu'à sa case.
- `server/test/profil-charge.test.ts` — ce que la page du profil, la pastille de « Profil » et la page des duels coûtent à la base permanente, allers-retours comptés.
- `server/test/style.test.ts` — le style de « Ma collection » en albums — fonds, gerbes, finitions, bordures —, et la loge qui ne montre que ce qu'on a.
- `server/test/un-seul-avatar.test.ts` — un joueur n'a qu'un avatar : partout où il se montre, celui qu'il porte ; chaque composant relu.
- `server/test/niche.test.ts` — la niche du compagnon en haut de chaque page du téléphone : c'est lui qui grandit, porté ou non ; la toucher ouvre sa fiche.
- `server/test/ma-niche.test.ts` — sa gestion, chez lui : l'adoption l'installe sans le faire porter, son nom, la forme qu'il montre, celui qui y vit — et ce qu'on porte ne la fait plus bouger.
- `server/test/niche-paliers.test.ts` — sa niche qui s'embellit après sa forme ultime, chaque palier gardé, et la carte qui montre le compagnon de sa niche avec son nom.
- `server/test/niche-reactions.test.ts` — ses réactions à la révélation, une règle pure, et chaque écran de révélation qui les lui dit — le Cabinet compris, par sa seule partie.
- `server/test/ornements-peints.test.ts` — les ornements de la niche, peints : leurs fichiers sous empreinte, chacun à son plan, et le choix de le montrer peint, dessiné ou caché.
- `server/test/jardin.test.ts` — les règles pures du soin et du jardin : trente trouvailles, le cadeau tiré à ses chances, les deux légendaires par exploit, le terrain qui grandit.
- `server/test/soins.test.ts` — s'occuper de son compagnon sur un serveur jetable : trois envies par jour, le cadeau tiré une fois, la cueillette, le jardin vérifié place par place, rien qui reste d'un profil supprimé.
- `server/test/luciole.test.ts` — la luciole, qui ne s'achète pas : la Première traversée la donne, et la première salle complète du Cabinet de curiosités ; installée dans une niche vide, jamais à la place d'un autre.

### Les récompenses

- `server/test/experience.test.ts` — le barème de l'expérience.
- `server/test/hautsfaits.test.ts` — hauts faits, paliers, légendaires.
- `server/test/legendaires.test.ts` — durcir un légendaire ne reprend rien.
- `server/test/niveaux.test.ts` — personne ne redescend de niveau.
- `server/test/eclat.test.ts` — ce qui éclate.
- `server/test/eclat-hors-soiree.test.ts` — l'Éclat au quiz du jour et au défi.
- `server/test/eclat-reserve.test.ts` — l'Éclat tombé sur un avatar déjà éclaté attend en réserve, puis se dépense pour toujours sur un autre avatar à lui, jamais un Divin.
- `server/test/ecussons.test.ts` — les écussons de savoir.
- `server/test/recalcul.test.ts` — relire l'historique une fois, jamais sur une base qui hoquette.
- `server/test/saisons.test.ts` — les légendaires de saison.
- `server/test/saisons-relues.test.ts` — les saisons des soirées déjà rangées.
- `server/test/fetes.test.ts` — les huit fêtes (Pâques et ses dates, rien avant 2027 pour les cinq du 1er novembre 2026, jamais deux le même jour), leur légendaire et leur gerbe, les timbres et le carnet, au quiz du jour et en soirée, et les deux relectures qui rangent ceux d'Halloween 2026.
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
- `server/test/cartes-peintes.test.ts` — les cartes peintes de l'Expédition, sous empreinte et d'un poids qu'un téléphone porte ; l'œuvre peinte, sortie d'elles pour le Cabinet de curiosités, son cadre doré et son chemin sans rien de l'Expédition.
- `server/test/journal-des-couts.test.ts` — le journal des coûts des chaînes de peinture : chaque image payée comptée au tarif de son modèle, et le budget relu avant la suivante.

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
- `server/test/missions-compensation.test.ts` — les missions d’étoiles d’avant rattrapées d’une partie finie, leur tampon, le coffre de compensation une fois, le coffre que l’administrateur offre, l’Éclat acheté puis dépensé.
- `server/test/missions-page.test.ts` — ce que la page sait de ses missions : une lecture partagée, le refus d'un invité.
- `server/test/missions-charge.test.ts` — ce que la ligne de l'accueil attend de Turso.
- `server/test/missions-decouvertes.test.ts` — les découvertes du 1er novembre 2026 : l'épreuve du sentier d'une catégorie, le Cabinet moitié moins souvent et seulement là où il se joue, un duel à lancer sur un thème à qui a quelqu'un à défier ; ce que chacune lit de la journée, sa lecture, ce que la page en dit, et chacune faite par les routes de son mode — une épreuve ratée, un duel lancé (pas celui qu'on relève), la première réponse d'une épreuve de la traversée.
- `server/test/coffre-du-mois.test.ts` — le coffre du mois : la place au classement du quiz du jour fait son rang, et il s'ouvre une fois, comme celui de la semaine.

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
- `server/test/rappel.test.ts` — le rappel du soir, seule notification d'un joueur — et le service worker sous `/admin`, celui des alertes du QG.
- `server/test/push.ts` — pas un fichier de tests : un service de push sur la machine, et les téléphones qui s'y abonnent, qui déchiffrent ce qu'ils reçoivent comme un vrai ; le rappel du soir et les alertes du QG (`server/test/qg-erreurs.test.ts`) s'en servent.
- `server/test/installation.test.ts` — installer l'application.

### La campagne et sa base

- `server/test/campagne.test.ts` — la série : sa base à elle, les jamais vues d'abord, trois vies comptées au serveur.
- `server/test/campagne-abandon.test.ts` — abandonner une série décerne ce qu'elle a joué.
- `server/test/campagne-carnet.test.ts` — le carnet de révision, relu du journal des réponses.
- `server/test/campagne-charge.test.ts` — ce qu'une réponse de campagne coûte à Turso.
- `server/test/journal-des-reponses.test.ts` — le journal des réponses gardé en mémoire : chaque dérivation — la mesure, le modèle, l'expérience, les vues (dépliées de ce qu'une pièce du Cabinet a montré de la base, les premières réponses telles quelles), les écussons, les missions, le carnet, les compagnons, les épreuves des sentiers — comparée au SQL d'avant sur une base au hasard, lue par tranches, en double et en retard, des rébus, des frises et des pièces du Cabinet (`cab:`) compris, qu'aucun carnet ne garde ; puis ses tranches gardées (`campagne_tranches`) : un réveil qui les relit au lieu de toute la base, un duel annulé depuis, une tranche égarée, illisible ou d'avant, une réponse effacée ou modifiée et une série effacée, qui les effacent.
- `server/test/hors-de-la-base.test.ts` — ce qui n'est pas une question de la base, d'une seule liste (`shared/horsDeLaBase.ts`) : le rébus, la frise et le Cabinet, chacun sa phrase au signalement ; le même partage en SQL qu'en mémoire ; une garde qui relit le code du serveur et de `shared/` — pas ses commentaires — pour qu'aucun filtre ni aucun refus n'y soit recopié ; puis, par les routes, une partie du Cabinet ratée : sa question de la base entre au carnet et se signale, le reste non.
- `server/test/cabinet-hors-des-vues.test.ts` — ce que le Cabinet révèle de la base compte vu pour toute la campagne : les cinq questions d'une manche de l'Éclair, celles qui nomment le tableau du Détail, les nouveaux venus d'une frise d'un sujet — que la série lit vues —, jamais comme ses premières réponses ; et ce qu'une manche a montré de plus que sa pièce (`cabinet.montre`) : les trois leurres du Détail, ce que « Changer » remplace au Détail, au Pari et à l'Épingle — la rechange, qui n'est plus nue —, jamais sur tes murs (`jugeesDe`).
- `server/test/journal-des-duels.test.ts` — le journal des duels gardé en mémoire, comparé joueur par joueur à la lecture d'avant (`lectureDesDuels`) sur une base au hasard : lu une fois, puis ce qui ferme sans rien écrire, ce qui finit sous ses yeux, ce qui s'écrit sans lui, et une fin écrite ailleurs, que la relecture du démarrage voit ; puis ce que ses relectures ne perdent pas en route — un lot de fin de partie sans réponse, une réponse écrite juste après la fermeture de son duel, une relecture ratée, une lue avant le départ d'un profil —, l'horloge à la main et les réponses retenues par une porte.
- `server/test/campagne-defi.test.ts` — le défi de la semaine, son vainqueur, le laurier d'argent.
- `server/test/campagne-en-tete.test.ts` — les bonnes réponses sous le numéro de la question.
- `server/test/campagne-ouverture.test.ts` — la page s'ouvre avant la réponse du serveur.
- `server/test/campagne-recompenses.test.ts` — hauts faits de série, paliers, légendaires, records par catégorie.
- `server/test/campagne-sujets.test.ts` — une série sur un sujet qui traverse les catégories.
- `server/test/campagne-variete.test.ts` — catégories et sous-thèmes à tour de rôle.
- `server/test/campagne-familles.test.ts` — une question part de la part que trouve sa famille : sa catégorie et sa difficulté, ou, pour une année, un nombre, un vrai ou faux, sa forme.
- `server/test/rang-de-la-bonne.test.ts` — une bonne réponse qui se range (année, nombre, jour) se tire à son rang, ses leurres pris parmi les siens : la répartition et la plus proche de la moyenne relues sur la base livrée, le quiz tout prêt et l'époque de son titre, le signalement qui n'y voit pas une version d'avant, la consigne qui demande des leurres de part et d'autre.
- `server/test/bareme-du-solo.test.ts` — le barème du solo et son recompte au démarrage.
- `server/test/tirage-sans-redite.test.ts` — pas deux jumelles dans une épreuve ou un duel.
- `server/test/tirage-a-la-piece.test.ts` — le tirage à la pièce, sorti de `core/campagne.ts` (`core/tirageALaPiece.ts`) : comparé au code d'avant, gardé dans le test, au même hasard — l'escale, le battage d'une question, la moins vue, la frise de quatre ; puis ce qu'il apprend pour le Cabinet : la fenêtre de sept jours, deux marches qui se valent, cinq QCM d'un coup pour l'Éclair ; et la frise de sept, jamais sous l'écart (`choisirLaFriseSansRepli`) — sur des tas serrés, contre toutes les suites possibles.
- `server/test/porte-de-la-campagne.test.ts` — la porte du Cabinet de curiosités vers la campagne (`core/porteDeLaCampagne.ts`), sur le magasin même, ses allers-retours comptés : le réveil, qui pose ses tables, sa colonne et son secret sans un aller-retour de plus ; le secret, tiré une fois pour deux serveurs et un redémarrage ; le rituel d'une réponse (l'expédition en route qui relit ce qu'il a vu, le journal qui se sait en retard) ; la fin d'une partie — l'expérience créditée une fois, au rang de chaque juste dans son jour de Paris, minuit compris, ses gardiens, ses paliers, le compagnon, dans cet ordre —, rien de refait quand le geste qui garde le lot était déjà pris, et rien qui fasse échouer une fin écrite ; un lot refusé ; ce que le Cabinet ajoute aux paliers, sans un compte de la campagne ; la base gardée, et le verrou du profil, dans les deux sens.
- `server/test/campagne-modes.test.ts` — le mode d'une partie lu dans une seule liste (`MODES_DE_SERIE`) : son type, sa lecture, le lieu d'un signalement ; une partie du Cabinet que les routes de la série refusent, sinon pour signaler une question de la base, et que le QG compte à part ; chaque insertion d'une partie relue dans le code du serveur.
- `server/test/campagne-index.test.ts` — les lectures des séries ne parcourent que les séries, et la partie en cours de chaque mode se cherche par le profil et le mode : le plan de chaque lecture, sans statistiques comme la production, puis sous des statistiques qui préféreraient le mauvais index.
- `server/test/campagne-mesure.test.ts` — la mesure des difficultés qui ne se fait jamais attendre, sa série de référence et son décodage comparés au code d'avant, gardé dans le test.
- `server/test/tirage-prepare.test.ts` — le tirage d'une série préparé une fois par liste de jouables et par mesure, comparé question pour question au tirage d'avant, au même hasard.
- `server/test/travail-de-fond.test.ts` — le travail de fond rend la main une étape à la fois : les tours de boucle comptés, jamais deux étapes lourdes dans le même.
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
- `server/test/sentiers-par-coeur.test.ts` — ce qui s'apprend par cœur (une année, le réalisateur d'un film) : aucune question avant le cinquième palier, deux au plus ensuite, sans redite ni sortie du chapitre ; une personne mesurée dans sa famille ; le sentier du cinéma de la base livrée.
- `server/test/sentiers-panorama.test.ts` — le haut des sentiers en un seul bloc.
- `server/test/sentiers-reprise.test.ts` — les portraits d'avant les sentiers, repris en paliers.
- `server/test/sentiers-sujets.test.ts` — les sentiers à thème, sans vies.
- `server/test/sentiers-une-epreuve.test.ts` — une épreuve à la fois, dite à l'écran.
- `server/test/sentiers-vies.test.ts` — les vies du jour, celles qu'on achète, l'administration des paliers.
- `server/test/sentiers-pour-toi.test.ts` — sa chance sur chaque sentier, en couleur de piste, et ce qu'elle valait il y a une semaine.
- `server/test/parcours.test.ts` — les parcours de thème, dans « Apprendre ».
- `server/test/sentiers-trophees.test.ts` — les trophées des sentiers : Le Randonneur, La Constellation, Le Cartographe, L'Impeccable et Contre toute attente ; les paliers repris des portraits d'avant n'y comptent qu'une fois rejoués.

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
- `server/test/duels-montee.test.ts` — la montée : deux cotes, la cachée qui règle Automate et celle qu'on voit, qui avance pour qui joue ; l'ELO dès la Platine, et l'adversaire sous ses ligues gardées compté à son plancher.
- `server/test/duels-de.test.ts` — le dé à chances égales, sur ce qu'on a choisi : Automate compte comme un adversaire de sa cote.
- `server/test/duels-enjeu.test.ts` — ce qu'un duel met en jeu, dit avant de le jouer, partout où l'on choisit un adversaire, et la feuille du dé qui s'ouvre avant de tirer.
- `server/test/calibrage-duels.test.ts` — le script qui mesure les duels sur une vraie base, éprouvé ici sur une base jetable au vrai schéma : il relit le journal que la cote relit, n'écrit rien et ne nomme personne.

### L'Expédition

Une partie est une série de la campagne (`mode = 'expedition'`) ; son départ se ferme le jour où le Cabinet de curiosités le remplace (`EXPEDITION_REMPLACEE`), et ce qu'elle a donné reste. Chaque version du départ a gardé ses épreuves : une expédition partie avant une règle se rejoue sous les siennes.

- `server/test/expedition.test.ts` — les routes de bout en bout, la source, les gardiens qu'il a, l'ouverture en production.
- `server/test/expedition-carte.test.ts` — le générateur, les chances, le tracé.
- `server/test/expedition-carte-ecran.test.ts` — l'écran de la carte, rendu : une seule escale éclairée, les escales permises en cartes, la plus sûre à son ruban, la main en cartes au cadre de leur rareté, la carte levée.
- `server/test/expedition-question-ecran.test.ts` — une question à l'écran : les deux réponses de Double chance cochées, leur filet tenu sous le survol collé du téléphone.
- `server/test/expedition-pli.test.ts` — le pli, qui replie l'état à chaque lecture.
- `server/test/expedition-legendaires.test.ts` — la voie d'un légendaire gardé au bout, les jokers, la voie montrée.
- `server/test/expedition-jokers.test.ts` — chaque joker dans le pli : la main, la défausse, les posés, les offres, le campement, l'équipée.
- `server/test/expedition-mesure.test.ts` — par les routes : l'équipée et l'invité du jour, ce qu'un joker montre sans la bonne réponse, la colonne `joker`, la mesure, le carnet ; aucun joker hors de l'expédition.
- `server/test/expedition-charge.test.ts` — les allers-retours de chaque geste, comptés ; ce qu'il a vu relu après une réponse ailleurs ; une écriture ratée oubliée.
- `server/test/expedition-sur-place.test.ts` — les cartes jouées sur place donnent la vue du pli, chacune puis des expéditions entières au hasard ; par les routes, leur lot écrit d'un aller-retour.
- `server/test/expedition-tirage.test.ts` — le tirage d'une escale : ce qu'il lit, compté, et ses règles.
- `server/test/expedition-formes.test.ts` — six choix, vrai ou faux, le dévoilement et sa route, Arrêt sur image.
- `server/test/expedition-ecus.test.ts` — les écus dans le pli : les pistes, l'échoppe, les talismans, l'inconnu ; une expédition d'avant les écus.
- `server/test/expedition-echoppe.test.ts` — par les routes : les écus qui meurent avec l'expédition, l'échoppe et ses refus, l'inconnu caché jusqu'à son dévoilement, le piège qui finit d'un geste.
- `server/test/expedition-themes.test.ts` — sur la vraie base : les thèmes pointus d'une carte, jamais une rubrique ni une époque remplacée.
- `server/test/expedition-passeport.test.ts` — le tampon d'un thème pointu trouvé, la carte qui signale les autres, le Globe-trotter.
- `server/test/expedition-saison.test.ts` — la fête sur les cartes, son légendaire à l'acte 3, le calendrier des expéditions rouvert.
- `server/test/codex.test.ts` — le codex, pur : l'échelle et les exploits, la renommée et les niveaux, les offres, le trésor d'un gardien, les fioles, les dos, l'Ascension.
- `server/test/expedition-codex.test.ts` — le codex par les routes : le bilan écrit à chaque fin, la renommée relue des bilans, les bilans refaits une fois, le codex et le cran de l'Ascension figés au départ.
- `server/test/expedition-rencontres.test.ts` — les rencontres : leurs règles et le pli.
- `server/test/expedition-rencontres-routes.test.ts` — les rencontres par les routes : la question cachée tant qu'il prépare, la mise, le verdict, le dévoilement, Corser, Simplifier, une fiole bue.
- `server/test/expedition-rencontres-ecran.test.ts` — l'écran des rencontres, rendu : la carte levée qui promet ce que le serveur fait, la préparation dans l'ordre où l'on joue, le codex, les fioles, et les mots de l'écran — ni « sceaux », ni « Charge », ni « Garde », ni « inspiration ».
- `server/test/expedition-partir.test.ts` — « ← Partir » mène au départ, qui garde l'expédition en route ; un débutant n'y choisit pas de légendaires ; l'Ascension, rien avant une victoire.
- `server/test/expedition-styles.test.ts` — « Ton style » : l'échelle des styles, le paquet d'un style et ce qu'il remplace, les offres sans style tirées comme avant lui, carte pour carte.
- `server/test/expedition-jeu-complet.test.ts` — le jeu complet : l'énergie de chaque acte, l'épique dans les offres, chaque carte neuve levée puis jouée, sa promesse tenue par le pli.
- `server/test/expedition-huit-familles.test.ts` — les huit familles : leurs seize cartes, le doute avant le verdict, le courage qu'on paie.
- `server/test/expedition-ameliorations.test.ts` — les cartes améliorées : aucune qui fasse moins que sa carte, et aucune clé qui s'améliore cherchée seule dans le code.
- `server/test/expedition-question-au-centre.test.ts` — la question au centre (la version 10) : les crans de l'adversaire, le tour, la main de l'acte, une carte par question.
- `server/test/expedition-coups-de-pouce.test.ts` — les coups de pouce et les lettres (la version 11) : le gabarit, les tuiles, la composition jugée au serveur.
- `server/test/expedition-curiosites.test.ts` — les curiosités (la version 12) : le générateur, les rébus et les plats livrés, la récompense.
- `server/test/expedition-frise.test.ts` — la frise (la version 13) : ses règles pures, le contenu livré, le pli, puis par les routes et à l'écran.
- `server/test/expedition-familles.test.ts` — les familles en façons de répondre (la version 14) : les six styles, le second essai, la fétiche.
- `server/test/expedition-detail.test.ts` — le détail (la version 15) : ses cadrages, les tableaux livrés, l'acte 3 plus dur, le carnet.
- `server/test/details.test.ts` — les images du détail, que le Détail du Cabinet montre aussi : quatre cadrages emboîtés par tableau, 40 Ko au plus chacun, un peintre mort depuis soixante-dix ans révolus, chaque tableau demandé par une question de la base.
- `server/test/expedition-journal.ts` — pas un fichier de tests : le journal écrit comme le serveur, des plans faits à la main, et les pièces de la page rendues, que partagent les fichiers du jeu complet et des versions d'après.

### Le Cabinet de curiosités

Une partie est une série de la campagne (`mode = 'cabinet'`), qui n'y touche que par sa porte : la porte elle-même (`server/test/porte-de-la-campagne.test.ts`), le tirage à la pièce, ce qui n'est pas une question de la base, ce que ses manches font compter vu, le journal des réponses et le mode d'une partie ont leur ligne [avec la campagne](#la-campagne-et-sa-base). Ce que le produit en dit : [le Cabinet de curiosités](../produit/le-cabinet.md). Ses épreuves partent du banc du Cabinet (`server/test/cabinet-banc.ts`) — sa base d'essai, ses magasins seuls, ou un vrai serveur — ou des plans d'essai (`server/test/cabinet-plans.ts`) pour les règles pures ; le calendrier du Cabinet y est fermé, sauf dans `server/test/cabinet-saisons.test.ts`.

- `server/test/cabinet-banc.ts` — pas un fichier de tests : une base d'essai du Cabinet et ses magasins sur un fichier `file:` — plusieurs « serveurs » sur la même —, un vrai serveur (`bancDuCabinet`) et de quoi y jouer par les routes, les réponses lues dans le plan figé en base.
- `server/test/cabinet-plans.ts` — pas un fichier de tests : un contenu tiré de chacun des dix jeux, petit et lisible, un départ, et une partie jouée geste à geste comme le serveur la jouera, l'heure d'arrivée de chaque geste à la main.
- `server/test/cabinet-regles.test.ts` — une partie jouée en pur, de son départ à son bilan : le pli des gestes, les pièces qu'il range, les étoiles après les pouvoirs, le cadre doré, l'issue, la poussière, la lecture d'un départ, d'un geste et d'un bilan — chaque version écrite en dur —, le musée : la visite, la série, les gardiens dus, les refus.
- `server/test/cabinet-chronos.test.ts` — le chrono, pur : figé au départ, la grâce, l'échéance, la pause, les deux étapes du Pari et de la Réplique, Prendre son temps ; puis par les routes, à l'horloge du banc ; et jamais l'horloge de la machine dans le code du Cabinet.
- `server/test/cabinet-jeux-base.test.ts` — le Pari, l'Éclair, le Mot mystère et le Filet, les quatre jeux qui posent une question de la base : leurs règles pures, leur tireur au serveur, une partie entière par les routes.
- `server/test/cabinet-jeux-images.test.ts` — le Détail et la Frise : leurs règles, leur tirage sur la base livrée, la route des cadrages — rien avant d'être atteint, l'adresse d'un tirage, jamais celle d'une manche —, une partie de chacun par les routes.
- `server/test/cabinet-jeux-neufs.test.ts` — l'Épingle, les Indices et la Réplique, les trois jeux du contenu neuf : leurs règles, leur tirage sur le contenu livré — le jamais vu d'abord —, une partie de chacun par les routes, et tes murs.
- `server/test/cabinet-quiz.test.ts` — le Quiz, le dixième jeu : sa règle pure — quatre questions jugées ensemble, Éclairer question par question, rien de la bonne réponse avant le verdict, une seule pièce hors de la base —, son tireur sur une base d'essai — le sujet promis d'abord, sinon la catégorie, sinon une autre —, les thèmes que la carte peut promettre, famille par famille, et une épreuve du Quiz jouée par les routes d'une traversée.
- `server/test/cabinet-pouvoirs.test.ts` — les cinq pouvoirs des cartes-bonus par les routes : ce que chacun fait, combien de fois, ses refus mot pour mot ; ce qu'en disent la manche, le bilan et l'annonce ; la carte-bonus figée au départ — jamais une qu'il n'a pas, ni un Divin, ni un joker de l'Expédition.
- `server/test/cabinet-contenu.test.ts` — le contenu neuf livré — les lieux, les fiches, les répliques, les frises à thème — et ses juges, une seule copie.
- `server/test/cabinet-catalogue.test.ts` — le catalogue relu contre les rencontres, les peintures, les légendaires et les saisons ; les tables gelées écrites en entier ; chaque constante de `shared/cabinet/bareme.ts` contre sa ligne des [barèmes](../reference/baremes.md), les jeux livrés contre `JEUX_PRETS` ; les imports des modules légers, et ceux du serveur du Cabinet, qui ne tirent ni la campagne, ni le quiz du jour, ni les Divins.
- `server/test/cabinet-secret.test.ts` — l'invariant 1, jeu par jeu : rien de ce qui juge avant le verdict de sa manche, ni une rechange de « Changer », ni la graine de la partie, ni celle de la visite, ni l'œuvre visée d'une case ; chaque réponse lue en entier, pour qu'un champ neuf s'y voie.
- `server/test/cabinet-journal.test.ts` — ce que le Cabinet écrit au journal des réponses : une ligne par pièce, juste dès deux étoiles naturelles, sa forme, le pouvoir qui l'a aidée (`joker`), `cab:` devant ce qui n'est pas une question de la base ; l'expérience créditée une fois, à la fin ; aucune réponse modifiée ni effacée.
- `server/test/cabinet-montee.test.ts` — la tour : le pli d'une montée relue de ses parties du jour (une porte ouverte à son seuil figé, fermée elle coûte un cœur, le sommet, deux parties au même étage), les portes tirées de la graine (les mêmes à chaque page ; l'œuvre de la salle au jeu où elle se trouve, le coffre, une salle complète, un musée plein), le départ d'une porte (refusée si elle a changé, la carte-bonus de toute la montée), le record ; puis une montée jouée par les routes — l'œuvre d'une porte ouverte qui entre au musée, sans poussière, les portes fermées jusqu'au dernier cœur, le record relu après un redémarrage.
- `server/test/cabinet-routes.test.ts` — la page, commencer en visite, en chasse ou en libre, un geste à son rang, la reprise après un redémarrage, la partie d'hier close à la page du lendemain, la suppression d'un profil avec des lignes dans les trois tables, le plafond des départs.
- `server/test/cabinet-traversee.test.ts` — la traversée en trois actes jouée en pur (`shared/cabinet/traversee.ts`) : les dix cartes et leur phrase à chaque niveau, les gardiens (des légendaires du Cabinet, rangeables, jamais la Frise), la carte des trois actes — trois chemins, un coffre, le marchand, le gardien, des diagonales qui ne se croisent jamais, un thème du contenu jamais deux fois —, l'or de chaque étoile et le cœur de chaque manche ratée, quitter qui ne fuit rien, la Cagnotte, la Parade, Quitte ou double, le Second souffle, le coffre et le marchand, les assauts contre un gardien jusqu'à sa chute, l'acte suivant, le légendaire au bout ; ce qui se relit, l'épreuve vue comme une partie du Cabinet (la version 3 du départ, deux mises au plus haut), et les chemins d'ici qui mènent à une étape lointaine (`cheminsVers`)
- `server/test/cabinet-traversee-routes.test.ts` — la traversée par ses routes : un profil seulement, trois cartes pour partir, une seule en route ; aller vers une épreuve y entre — sa partie, ses cartes, ce qu'elle vaut déjà —, quittée elle se conclut et coûte ses cœurs ; le gardien à terre avant la dernière manche, l'épreuve quittée et conclue par la lecture suivante, sans plus rien à reprendre ; le rang, les refus en mots, le cloisonnement, la relecture après un redémarrage, l'abandon ; le légendaire choisi au bout, rangé sur l'étagère
- `server/test/cabinet-defis.test.ts` — les défis de tes cartes et les épreuves de maître : leur catalogue — dix défis à trois rangs, une épreuve par gardien —, ce qu'une traversée gagnée ou perdue fait tomber épreuve par épreuve — un rang donne ceux d'en dessous, une épreuve conclue sans ce qui y a servi ne prouve aucun « sans » —, la lecture de ce qui a servi sur `conclure`, ce qui se range une seule fois sous `#cabinet`, la relecture du démarrage sur une vraie partie quittée, et ce qu'ils rapportent : les confettis au solde, le titre de l'Or porté, la gerbe des cartes, le Djinn.
- `server/test/cabinet-charge.test.ts` — deux serveurs sur la même base, une écriture refusée, la suppression d'un profil sous un départ, les tas d'une liste neuve tour par tour, les allers-retours de chaque route comptés, et l'accueil qui dit le musée sans un de plus.
- `server/test/cabinet-index.test.ts` — le plan de chaque lecture du lot froid et de chaque garde des lots d'écriture, sans statistiques comme la production : jamais le parcours d'une table qui grandit avec l'histoire.
- `server/test/cabinet-poussiere.test.ts` — la poussière d'or par les routes : acheter une œuvre, dorer un cadre, changer un jeu de la visite, le cartel, « Mes réponses » ; le solde vérifié dans l'instruction même, même par deux serveurs ; rien pendant qu'une partie attend ; « Retenter » et les cinq libres payées ; rien de la poussière hors du Cabinet.
- `server/test/cabinet-gardiens.test.ts` — les gardiens : ce que le musée doit comparé à l'étagère, seul ce qui manque rangé sous `#cabinet` ; leur annonce à la fin d'une partie, à un achat, à une dorure, à la page qui suit la partie d'hier ; la luciole à la première salle complète, le bronze de L'Explorateur ; un rangement raté rattrapé ; jamais un Divin.
- `server/test/cabinet-saisons.test.ts` — les gardiens de saison, à leur seule fête : la première œuvre gagnée en jouant pendant Halloween range `saison:halloween` sous `#cabinet` ; ni un achat, ni une dorure ; le seul fichier qui rouvre le calendrier du Cabinet.
- `server/test/cabinet-ouverture.test.ts` — où le Cabinet répond : hors de la production toujours, en production sous son drapeau, la balise du Cabinet fermé, ses routes en 404 dites en mots ; la maintenance qui ferme son départ, ses achats, ses dorures et son échange, jamais un geste ; puis le départ de l'Expédition fermé (`EXPEDITION_REMPLACEE`), que le banc force par son option.
- `server/test/cabinet-ecran.test.ts` — la page rendue en HTML sur ce qu'un vrai serveur rend : son code et sa donnée de départ, ce qu'elle ne télécharge pas, l'épreuve par-dessus la carte et son entrée d'historique, le titre de l'onglet ; le musée qui dort (ses cimaises, une salle, le cartel, la visite, les jeux libres) ; des parties des six premiers jeux jouées par les routes et chaque écran de leurs vues ; `api.cabinet` contre un faux `fetch` puis par les routes ; le bouton de l'accueil ; chaque taille et chaque contraste de sa feuille de style.
- `server/test/cabinet-ecran-neufs.test.ts` — de même pour l'Épingle, les Indices et la Réplique : la carte de France, ses calculs et ses gestes, jamais le lieu hors du dessin ; les pas de l'Épingle retenus au profil ; le souffle des noms ; la Réplique quittée au bon mot ; tes murs, que leur route rend encore.
- `server/test/cabinet-mots-du-musee.test.ts` — chaque phrase que la tablée du 26 octobre 2026 a lue de travers, rendue sur ce que le serveur rend : le cartel d'une œuvre gagnée à un autre jeu que le sien, et d'une doublée ; deux cadres vides qui ne portent plus le même nom à l'oreille ; le carnet de l'Éclair ; le Scarabée ; le musée qui ne promet plus deux minutes ; le titre de l'œuvre au bilan ; et les mots de la documentation.
- `server/test/cabinet-calibrage.test.ts` — le calibrage (`server/scripts/calibrage-cabinet.ts`) joue les règles du code : ses planchers, une mesure stable, son plafond, et ce que fait un joueur au hasard au Filet, au Détail et au Mot.
- `server/test/cabinet-calibrage-modele.test.ts` — le modèle du calibrage, corrigé après la tablée du 25 octobre 2026 — ce que le joueur sait : le rang selon la force aux Indices, la marche au Filet, le temps du Pari, la zone d'Éclairer à l'Épingle, le joueur « tablée », la Frise en années.
- `server/test/cabinet-calibrage-cartes.test.ts` — le même modèle, ses cartes-bonus : la mise au Détail sans rien savoir, Changer qui paie sa lecture et ne lit pas l'avenir, Miser jamais pire que sans carte.
- `server/test/cabinet-calibrage-parties.test.ts` — le même modèle, ses parties et le musée : les quatre œuvres de départ au tableau des jeux, le chasseur qui éveille son gardien avant l'occasionnel, jamais plus de parties parfaites qu'à sept étoiles. Les trois se coupent sur leurs thèmes : en un seul fichier, 117 s à huit fichiers à la fois (le 1er novembre 2026).
- `server/test/calibrage-du-cabinet.ts` — pas un fichier de tests : le calibrage lancé et lu comme ses deux fichiers d'épreuves le font — un seul en durait plus d'une minute.

## Pour aller plus loin

- [Les commandes](../reference/commandes.md) — chaque script npm et chaque script de `server/scripts/`
- [Démarrer dans le code](demarrer.md) — installer, lancer, le cycle d'une modification
- [Les conventions](conventions.md) — les commentaires qui disent pourquoi, les erreurs, les dépendances
- [Travailler avec Claude](outillage-claude.md) — la tablée, qui montre ce que les tests ne disent pas
