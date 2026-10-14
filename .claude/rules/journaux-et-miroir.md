---
paths:
  - "server/src/core/{scores,answers,backup,distante,db,connexions}.ts"
  - "server/src/server.ts"
  - "server/test/{miroir,demarrage,relecture,reprise-rafale,enregistrement,categories,compagnons,connexions-de-la-base}.test.ts"
---

# Les deux bases, les journaux et le miroir Turso

## Les fichiers

- `core/scores.ts` — journal des gains, en ajout seul
- `core/answers.ts` — une ligne par invité et par question posée, y compris sans réponse
- `core/backup.ts` — le miroir de la soirée dans Turso : une file par espace, ordonnée, qui insiste ; la resynchronisation après une panne ; sa santé
- `core/distante.ts` — le client libsql, avec un délai : une base muette se dit en dix secondes, pas en cinq minutes ; et `ajouterColonne()`, qui lit le schéma avant de migrer — une fois par table — et laisse toute panne arrêter le démarrage
- `core/connexions.ts` — les connexions vers la base (la revue du 14 octobre 2026, `retours/2026-10-14/` : en production, 225 ms l'aller-retour sur une connexion à rouvrir, 29 sur une connexion gardée) : celles qui s'ouvrent — le canal `undici:client:connected` du `fetch` de Node, filtré sur les hôtes que `clientDistant` suit —, celles que la base referme d'elle-même et leur âge, les allers-retours tombés en route, le délai qu'elle annonce (`Keep-Alive: timeout=…`), tout cela à `/healthz` (`base.connexions`) et au relevé de l'heure ; et la garde des connexions inactives, les 4 s de Node (`GARDE_DE_NODE_MS`) sauf `QUIZ_DB_KEEPALIVE_MS` — un agent de la classe de celui du `fetch`, pris sur son dispatcher global, sans dépendance (`connexions-de-la-base.test.ts`)

## Les pièges

- **Une colonne de plus au journal des réponses** se pose dans trois
  fichiers : `addColumn` dans `db.ts` (la locale) ; `COLUMNS`, l'insertion
  et `toRow` dans `answers.ts` ; `ajouterColonne` (le miroir), l'écriture
  (`SQL.reponse`, `ligneReponse`) et la restauration dans `backup.ts`. Une
  seule oubliée, et la colonne se perd au premier réveil sur disque effacé.
  La dernière venue, `compagnon` — celui qu'il portait quand la ligne s'est
  écrite (`Party.compagnonDe`), qui grandit de ses bonnes réponses (règle
  `profil.md`) —, a ses sœurs hors des soirées : `jour_reponses.compagnon`
  et `campagne_reponses.compagnon`, posées par `ajouterColonne` dans
  `jour.ts` et `campagne.ts` (`compagnons.test.ts`).
- **Le démarrage ouvre ses magasins de front** (`deFront`, `server.ts`) :
  après les comptes, le miroir, les profils, le quiz du jour, la
  bibliothèque, les programmes, les partages et l'historique partent
  ensemble — soixante allers-retours en série faisaient trois secondes à
  chaque réveil. Un magasin qui aurait besoin d'un autre s'ouvre après lui,
  dans la même branche ; ce qui les relie (`profiles.statsDuJour`, le
  laurier) se branche après. Un échec ne remonte qu'une fois toutes les
  branches arrivées au bout (`demarrage.test.ts`).
- **Une garde plus longue que le délai de Turso fait tomber des requêtes** :
  la connexion qu'il a fermée sans le dire part avec la suivante, et une
  écriture n'est pas rejouée (« other side closed »). `QUIZ_DB_KEEPALIVE_MS`
  s'essaie donc en préproduction, la page « Le serveur » ouverte : les
  connexions refermées par Turso — la plus jeune dit son délai — et les
  allers-retours tombés en route sont les deux comptes à regarder. Un délai
  que Turso annonce passe avant toute garde : undici le préfère, et c'est
  lui que `/healthz` dit (`gardeAnnonceeMs`).
- **Deux allers-retours enchaînés ouvrent deux connexions** : quand la
  requête suivante part dans la même tâche, le `fetch` de Node n'a pas encore
  rendu la première (mesuré : deux connexions pour dix, une seule dès qu'une
  milliseconde les sépare). Une chaîne d'`await` après une pause paie donc
  deux poignées de main, pas une — et un test qui compte des connexions
  espace ses requêtes.
- **Un serveur qu'on ferme doit éteindre ses chronomètres** et vider son
  miroir avant de fermer la base locale, que la resynchronisation relit.
  Un chrono de question qui sonne après `close()` révèle sur une base fermée —
  c'est ce que fait `GameEngine.stop()`. Allonger le smoke suffit à réveiller
  ce genre de fantôme : le symptôme (« The database connection is not open »)
  ne désigne jamais la section qui l'a déclenché.
