---
paths:
  - "shared/etiquettes.ts"
  - "server/src/core/{consigne,etiquetage}.ts"
  - "server/src/quizDuJour.ts"
  - "client/src/components/AdminDuJour.tsx"
  - "server/test/{jour-reserve,etiquetage}.test.ts"
---

# La réserve du quiz du jour et ce qu'on demande à une IA

## Les fichiers

- `core/consigne.ts` — la consigne qu'on donne à une IA pour écrire la réserve du quiz du jour — avec ce que disent les joueurs de la difficulté des dernières questions posées (`ceQueDisentLesJoueurs`), qu'une IA qui écrit sans retour ne sait pas juger — la routine Claude Code qui la remplit derrière `RESERVE_TOKEN` (`/api/jour/reserve` : la consigne, puis le dépôt ; `docs/exploitation/mise-en-ligne.md`, étape 9), ou « Copier la consigne pour une IA » à `/admin` : une seule pour les deux. Le serveur ne détient aucune clé d'IA
- `shared/etiquettes.ts` · `core/etiquetage.ts` — les métadonnées d'une question de la réserve — sous-thème (une liste fermée par catégorie), étiquettes, difficulté estimée, âge, portée, leurres, source… : la consigne qu'on donne à une IA pour les écrire (`consigneDEtiquetage`, cinq versions essayées le 3 octobre 2026), et la relecture de ce qu'elle rend (`lireEtiquetage`), qui refuse l'entrée entière sur une clé inconnue et applique les règles de prudence. Par la porte de la réserve, avec son jeton (`/api/jour/reserve/etiquetage`) ; rangées dans `jour_reserve.metadonnees`

## Les pièges

- **La consigne du quiz du jour ne promet rien que la réserve refuse.**
  Elle décrit le format de « Coller une liste » réduit à ce que
  `raisonDEcarter` accepte, et son exemple se relit dans
  `jour-reserve.test.ts`. Quand la réserve apprendra une nouvelle sorte de
  question (les estimations à tolérance), la consigne la décrit dans le
  même commit — sinon la routine écrit pour rien, ou jamais ce qu'on veut.
- **Le jeton de la réserve n'efface rien, mais il lit les questions à
  venir** : la consigne rappelle les intitulés des prochains jours (l'IA ne
  les réécrit pas), et l'étiquetage rend celles qui ne sont pas encore
  décrites — les prochaines à sortir d'abord — avec leur bonne réponse
  (`aEtiqueter`) ; la même porte (`porteDeLaReserve`) ouvre aussi la base
  de la campagne (`mountBaseDeLaCampagne`). Il les vaut donc, et se change
  des deux côtés s'il fuit ; une route de plus derrière lui n'efface rien.
- **Les métadonnées de la réserve ne servent encore à rien** : rien ne
  relit `jour_reserve.metadonnees` — ni le tirage, ni la consigne, ni
  `/admin`. Une question décrite « hors-base » (un prénom à remplacer, une
  photo à regarder) reste tirable : le jour où l'étiquetage doit trier, le
  tirage (`tirer`) le lit dans le même commit.
