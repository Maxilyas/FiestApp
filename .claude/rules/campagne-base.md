---
paths:
  - "server/src/core/{baseCampagne,consigneCampagne}.ts"
  - "server/scripts/base-campagne.ts"
  - "server/content/campagne/**"
  - "client/src/components/AdminCampagne.tsx"
  - "server/test/{campagne-base,campagne-routine,campagne-signalements}.test.ts"
  - ".claude/agents/{redacteur-campagne,relecteur-campagne}.md"
---

# La base de questions de la campagne

Pour agrandir la base (un lot, sa relecture, son rangement), suis la skill `base-campagne`.

## Les fichiers

- `core/baseCampagne.ts` · `server/scripts/base-campagne.ts` · `server/content/campagne/` — la base de la campagne : des milliers de QCM écrits et étiquetés d'avance, une catégorie par fichier, une question par ligne, ses métadonnées au format de l'étiquetage (`MetadonneesDeQuestion`) et relues par le même juge (`lireEtiquetage`, sous `lireQuestionDeLaBase`, qui refuse au premier défaut : confiance sous 3, fait à revoir, emoji, réponse dans l'intitulé…). Lue une fois par processus, en fond vingt secondes après le démarrage (`PRECHAUFFAGE_CAMPAGNE_MS`, `CampagneStore.prechauffer`) — à la première série, elle faisait attendre 3,5 s le premier joueur après un déploiement —, par tranches qui rendent la main (`lireLaBaseSansBloquer`) : d'un bloc, elle figeait 0,4 s toutes les soirées du serveur. Elle grandit par son script : `consigne` (ce qu'on donne à une IA pour un lot, avec les intitulés que la catégorie a déjà), `verifier` (ce que le rangement refuserait), `fiche` et `appliquer` (la relecture des faits : une fiche compacte, puis ses décisions — retirer, ou corriger une phrase), `ranger` (les identifiants, les doublons écartés — la base, les quiz livrés), `voisines`, `stats`. Deux agents du projet font ce travail sobrement (`.claude/agents/`) : `redacteur-campagne` (Sonnet, réflexion basse) écrit un lot, `relecteur-campagne` (Opus, réflexion basse) en relit la fiche — la première vague, au niveau de réflexion hérité de la session, coûtait quatre mille jetons de sortie par question. Elle grandit aussi chaque matin, sans déploiement : la routine de la réserve du quiz du jour, avec le même jeton, demande ce qui manque (`GET /api/campagne/base` : cinq questions par catégorie et par jour, là où sous-thèmes et difficultés manquent le plus — `commandeDeLaCategorie` —, et la consigne, `core/consigneCampagne.ts`, la même que celle du script) puis dépose (`POST`), chaque entrée relue par le même juge, chaque refus rendu avec son motif — la routine n'a pas le dépôt, ni `verifier` ni ses agents : sa consigne ne lui fait rien lancer (`TravailDUnLot`) ; rangée dans `campagne_ajouts`, jouable aussitôt (`CampagneStore.base`), relisible et retirable à `/admin#campagne` (`campagne-routine.test.ts`)

## Les pièges

- **Une question de la base de la campagne garde son identifiant** : ses
  réponses, ses signalements et son retrait s'y rattachent. Une coquille se
  corrige dans son fichier, l'identifiant ne bouge pas ; une correction de
  fond — la bonne réponse change — la retire et en range une neuve, sous un
  identifiant neuf (`ranger`), pour que les mesures d'avant ne la suivent
  pas. « Corriger », à `/admin#campagne`, suit la même règle sans toucher
  au dépôt : la version corrigée se range dans Turso (`campagne_corrections`,
  sous l'identifiant de la question corrigée), relue par le juge de la base,
  ses leurres refaits (`leurresApres`), et l'emporte sur la ligne de son
  fichier (`appliquerLesCorrections`) ; une autre bonne réponse
  (`bonneReponseChange`, la même règle à l'écran et au serveur) lui tire un
  identifiant neuf et retire l'ancienne. Les séries déjà tirées, le défi de
  la semaine compris, gardent la version qu'elles ont lue. Un lot se
  vérifie avant d'entrer (`verifier`), et une épreuve qui joue la campagne
  donne sa base (`baseDEssai`, `banc.ts`) : celle du dépôt grandit à chaque
  lot rangé.
