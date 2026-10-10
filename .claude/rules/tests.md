---
paths:
  - "server/test/**"
  - "server/scripts/smoke.ts"
---

# Écrire et lancer les tests

## Les pièges

- **`smoke.ts` est stateful de bout en bout.** Une soirée jouée insérée au
  milieu casse les assertions d'après (statistiques, bilan, archives). C'est
  pourquoi les nouveaux tests vont dans `server/test/`, un serveur jetable par
  fichier ; ceux qui vivent encore en fin de smoke (sections 32 à 35) y ont
  chacun le leur.
- **Un fichier de tests a deux minutes, pas seulement une épreuve** : sous
  Node 22, `--test-timeout` (120 s) vaut aussi pour le fichier entier, et la
  CI est plus lente qu'ici. Dix-sept épreuves à serveur jetable dans
  `cloture.test.ts` l'ont dépassé (« test timed out after 120000ms » sur le
  fichier) : un fichier qui approche la minute et demie se coupe par thème
  (`credits.test.ts`), sans rien changer à ses épreuves.
- **Le serveur envoie l'instantané juste derrière l'accusé** de `host:hello`
  ou de `party:watch`, souvent dans le même paquet : un écouteur posé après
  avoir attendu l'accusé le rate. `banc.ts` retient le dernier pour ça
  (`instantane()`).
- **L'Éclat est un tirage** (une chance sur quarante, une sur vingt au
  défi) et le premier fait tomber un palier de carrière : un test qui compte
  l'expérience au point près après une clôture, une partie du quiz du jour
  ou un défi neutralise `ProfileStore.tirageEclat`, sinon il échoue une fois
  sur quarante. Il compte aussi ce qui paie sans se voir : le bonus de série
  d'une partie du jour, versé dès qu'elle commence (`xpDeSerie`) — laissée
  en route, elle a son Courant d'air —, Le Laurier à la nuit, le Lève-tôt
  avant 8 h, et en campagne les vingt premières bonnes réponses du jour, au
  double (`xpDeLaBonneReponse`). Ses Éclats hors d'une soirée ne comptent pour La Pluie
  d'Éclats que sans ceux des soirées qui se jouent encore
  (`ProfileStore.soireesEnCours`, branché par `server.ts`), comme à une
  clôture (`eclat-hors-soiree.test.ts`). **Le calendrier aussi** : une soirée se date
  à l'horloge de la machine, et close pendant Halloween, Noël ou le Nouvel
  An, elle ouvrait son légendaire de saison — la CI rougissait dix-neuf
  jours par an. `banc.ts` et `smoke.ts` ferment donc le calendrier des
  soirées (`calendrierDesSoirees`, `core/saisons.ts`) ; un test qui date ses
  soirées lui-même le rouvre (`saisons.test.ts`).
- **Un joueur seul ne rapporte rien.** Un test qui veut de l'expérience
  invite un figurant au moins (`figurants()`, `faux()` dans
  `soiree.test.ts`) ; un test de hauts faits, quatre joueurs au moins. Et
  deux bonnes réponses font un réflexe au plus rapide, à la milliseconde
  près : un test qui compte l'expérience au point près fait se tromper
  l'autre.
- **Simuler une panne** : un déclencheur `RAISE(ABORT)` sur le fichier `file:`
  qui tient lieu de Turso (`miroir.test.ts`) ; un vrai démarrage, un SIGTERM
  ou un SIGKILL, en lançant `src/index.ts` dans un processus enfant
  (`exploitation.test.ts`) ; une liaison morte que socket.io croit vivante
  — le wifi sans internet —, par le relais de `relais.ts`, devant le vrai
  module du client chargé dans Node (`liaison-morte.test.ts`).
