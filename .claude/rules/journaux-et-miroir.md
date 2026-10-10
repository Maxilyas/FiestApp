---
paths:
  - "server/src/core/{scores,answers,backup,distante,db}.ts"
  - "server/src/server.ts"
  - "server/test/{miroir,demarrage,relecture,reprise-rafale,enregistrement,categories}.test.ts"
---

# Les deux bases, les journaux et le miroir Turso

## Les fichiers

- `core/scores.ts` — journal des gains, en ajout seul
- `core/answers.ts` — une ligne par invité et par question posée, y compris sans réponse
- `core/backup.ts` — le miroir de la soirée dans Turso : une file par espace, ordonnée, qui insiste ; la resynchronisation après une panne ; sa santé
- `core/distante.ts` — le client libsql, avec un délai : une base muette se dit en dix secondes, pas en cinq minutes ; et `ajouterColonne()`, qui lit le schéma avant de migrer — une fois par table — et laisse toute panne arrêter le démarrage

## Les pièges

- **Une colonne de plus au journal des réponses** se pose dans trois
  fichiers : `addColumn` dans `db.ts` (la locale) ; `COLUMNS`, l'insertion
  et `toRow` dans `answers.ts` ; `ajouterColonne` (le miroir), l'écriture
  (`SQL.reponse`, `ligneReponse`) et la restauration dans `backup.ts`. Une
  seule oubliée, et la colonne se perd au premier réveil sur disque effacé.
- **Le démarrage ouvre ses magasins de front** (`deFront`, `server.ts`) :
  après les comptes, le miroir, les profils, le quiz du jour, la
  bibliothèque, les programmes, les partages et l'historique partent
  ensemble — soixante allers-retours en série faisaient trois secondes à
  chaque réveil. Un magasin qui aurait besoin d'un autre s'ouvre après lui,
  dans la même branche ; ce qui les relie (`profiles.statsDuJour`, le
  laurier) se branche après. Un échec ne remonte qu'une fois toutes les
  branches arrivées au bout (`demarrage.test.ts`).
- **Un serveur qu'on ferme doit éteindre ses chronomètres** et vider son
  miroir avant de fermer la base locale, que la resynchronisation relit.
  Un chrono de question qui sonne après `close()` révèle sur une base fermée —
  c'est ce que fait `GameEngine.stop()`. Allonger le smoke suffit à réveiller
  ce genre de fantôme : le symptôme (« The database connection is not open »)
  ne désigne jamais la section qui l'a déclenché.
