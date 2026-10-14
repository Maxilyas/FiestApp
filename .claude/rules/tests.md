---
paths:
  - "server/test/**"
  - "server/scripts/{smoke.ts,tests.mjs}"
  - "server/scripts/{load-test,fake-player,login,qa-host}.mjs"
  - ".github/workflows/ci.yml"
---

# Écrire et lancer les tests

## Les fichiers

- `server/scripts/tests.mjs` — `npm test` : tous les `test/*.test.ts` en un `node --test`, un fichier de moins à la fois que de cœurs (trois sur quatre), 120 s, `dot` sous Claude Code ; `node scripts/tests.mjs test/<fichier>.test.ts` (depuis `server/`) en lance un sous les mêmes délais — la commande `spec` de `CLAUDE.md` n'en a aucun
- `server/test/banc.ts` — un vrai serveur sur deux bases jetables, redémarrable sur disque effacé, et de quoi lui parler (les rendus et `mesure-pages.ts` s'en servent aussi) · `salle.ts` — le moteur seul, horloge à la main · `relais.ts` — une liaison qu'on gèle
- `server/scripts/smoke.ts` — sections 0 à 35 (24 à 29 sont devenues des fichiers de `server/test/`) ; la première assertion fausse arrête tout
- `server/scripts/load-test.mjs` · `fake-player.mjs` · `qa-host.mjs` — une salle, un invité, un écran commun simulés contre un serveur qui tourne ; l'animateur par `ADMIN_LOGIN` / `ADMIN_PASSWORD` (`login.mjs`, `antoine` / `demo` par défaut)

## Les pièges

- **`smoke.ts` est stateful de bout en bout.** Une soirée jouée insérée au
  milieu casse les assertions d'après (statistiques, bilan, archives). C'est
  pourquoi les nouveaux tests vont dans `server/test/`, un serveur jetable par
  fichier ou par épreuve ; les sections 31 à 35, en fin de smoke, ont chacune
  le leur.
- **Un fichier de tests a deux minutes, pas seulement une épreuve** : sous
  Node 22, `--test-timeout` (120 s) vaut aussi pour le fichier entier, et la
  CI est plus lente qu'ici. Dix-sept épreuves à serveur jetable dans
  `cloture.test.ts` l'ont dépassé (« test timed out after 120000ms » sur le
  fichier) : un fichier qui approche la minute et demie se coupe par thème
  (`credits.test.ts`), sans rien changer à ses épreuves.
- **`npm test` passe avant le build** — dans `npm run verify` comme en CI :
  `client/dist` n'existe pas encore (CI) ou date d'avant (chez soi). Un test
  qui lit une page servie démarre son banc avec `clientDist`
  (`portes.test.ts`, `page.test.ts`).
- **On compte, on ne chronomètre pas** : une machine chargée ferait échouer
  un test qui mesure des millisecondes. `grande-salle.test.ts` compte les
  vues, les écritures et les messages, `jour-charge.test.ts` les
  allers-retours sur le fichier `file:` qui tient lieu de Turso. Les bornes
  de temps qui restent sont larges : un calcul (`protocole.test.ts`, le
  podium au meilleur de trois essais ; `temps-reel.test.ts`) ou un délai qui
  doit tomber (`liaison-morte.test.ts`, `miroir.test.ts`).
- **Le serveur envoie l'instantané juste derrière l'accusé** de `host:hello`
  ou de `party:watch`, souvent dans le même paquet : un écouteur posé après
  avoir attendu l'accusé le rate. `banc.ts` retient le dernier pour ça
  (`instantane()`).
- **L'Éclat est un tirage** (une chance sur quarante, une sur vingt au
  défi) et le premier fait tomber un palier de carrière : un test qui compte
  l'expérience au point près après une clôture, une partie du quiz du jour
  ou un défi neutralise `ProfileStore.tirageEclat` — le banc ne le fait pas,
  le smoke si —, sinon il échoue une fois sur quarante. Il compte aussi ce
  qui paie sans se voir : le bonus de série d'une partie du jour, versé dès
  qu'elle commence (`xpDeSerie`) — laissée en route, elle a son Courant
  d'air —, Le Laurier à la nuit, le Lève-tôt avant 8 h, et en campagne les
  vingt premières bonnes réponses du jour, au double (`xpDeLaBonneReponse`).
  Ses Éclats hors d'une soirée ne comptent pour La Pluie d'Éclats que sans
  ceux des soirées qui se jouent encore (`ProfileStore.soireesEnCours`,
  branché par `server.ts`), comme à une clôture (`eclat-hors-soiree.test.ts`).
  **Le calendrier aussi** : une soirée se date à l'horloge de la machine, et
  close pendant Halloween, Noël ou le Nouvel An, elle ouvrait son légendaire
  de saison — la CI rougissait dix-neuf jours par an. `banc.ts` et
  `smoke.ts` ferment donc le calendrier des soirées (`calendrierDesSoirees`,
  `core/saisons.ts`) ; un test qui date ses soirées lui-même le rouvre
  (`saisons.test.ts`).
- **Un joueur seul ne rapporte rien.** Un test qui veut de l'expérience
  invite un figurant au moins (`figurants()`, `faux()` dans
  `soiree.test.ts`) ; un test de hauts faits, quatre joueurs au moins. Et
  deux bonnes réponses font un réflexe au plus rapide, à la milliseconde
  près : un test qui compte l'expérience au point près fait se tromper
  l'autre.
- **Simuler une panne** : un déclencheur `RAISE(ABORT)` sur le fichier `file:`
  qui tient lieu de Turso (`miroir.test.ts`, `retrait.test.ts`) ; un vrai
  démarrage ou un SIGTERM, en lançant `src/index.ts` dans un processus enfant
  (`exploitation.test.ts`), et le SIGKILL juste après une révélation
  (`miroir.test.ts`) ; une liaison morte que socket.io croit vivante — le
  wifi sans internet —, par le relais de `relais.ts`, devant le vrai module
  du client chargé dans Node (`liaison-morte.test.ts`).
- **Simuler des invités hors de l'adresse locale** passe par la réserve
  d'inscriptions : soixante d'un coup par adresse et par soirée, puis
  soixante par minute (`core/inscriptions.ts`) ; l'adresse locale n'a pas
  de limite. Le test de charge ne répond qu'aux QCM simples et aux
  estimations, le fantôme aussi à « plusieurs » et « ordre ».
