---
paths:
  - "server/src/core/{scores,answers,backup,distante,db}.ts"
  - "server/src/server.ts"
  - "server/test/{miroir,demarrage,relecture,categories,compagnons}.test.ts"
---

# Les deux bases, les journaux et le miroir Turso

## Les fichiers

- `core/db.ts` — la base locale (SQLite), jetable : les sept tables de la soirée en cours (`players`, `teams`, `team_bonus`, `answer_log`, `score_entries`, `sessions`, `soiree`), chacune rangée par `space_id` ; `addColumn`, pour une colonne venue après coup ; `lireSoireeLocale`, ce que la resynchronisation renvoie d'un espace — les gains et les réponses sans `uid`, d'avant la colonne, n'en sont pas ; `stampLegacySpace`, les lignes d'avant les espaces rattachées à celui de l'administrateur ; `wipeSpace`, un espace effacé avec son compte
- `core/scores.ts` — journal des gains, en ajout seul
- `core/answers.ts` — une ligne par invité et par question posée, y compris sans réponse
- `core/backup.ts` — le miroir de la soirée dans Turso (les sept tables `party_*`) : une file par espace, ordonnée, qui insiste ; la resynchronisation après une panne ; sa santé
- `core/distante.ts` — le client libsql, avec un délai : une base muette se dit en dix secondes, pas en cinq minutes ; et `ajouterColonne()`, qui lit le schéma avant de migrer — une fois par table — et laisse toute panne arrêter le démarrage
- `server/src/server.ts` — le démarrage dans l'ordre (les comptes, puis tout le reste de front, puis ce qui relie les magasins) et l'arrêt (`close`)

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
  après les comptes, douze branches partent ensemble — le miroir et sa
  restauration, les profils, le quiz du jour, le rappel du soir, la
  bibliothèque et ses quiz livrés, les programmes, les partages, les salons,
  la campagne, le journal des gestes, la santé du serveur et l'historique —
  soixante allers-retours en série faisaient trois secondes à chaque réveil.
  Un magasin qui aurait besoin d'un autre s'ouvre après lui, dans la même
  branche ; ce qui les relie (`profiles.statsDuJour`, le laurier) se branche
  après. Un échec ne remonte qu'une fois toutes les branches arrivées au
  bout (`demarrage.test.ts`).
- **Le miroir ne se recharge qu'au démarrage, et sur une base locale vide**
  (`restoreInto`) : sans un invité ni une équipe, tous espaces confondus. Le
  disque effacé d'un réveil se remplit ; un disque qui garde ne serait-ce
  qu'un invité d'essai fait foi tel quel, et ne reprend rien du miroir —
  c'est de lui que la resynchronisation relit chaque espace.
- **Le nom de la soirée ne fait pas la queue** (`saveSoiree`) : il part
  tout de suite, hors de la file, parce que son appelant l'attend pour
  écrire l'expérience ou l'archive (invariant 11), et qu'une file encombrée
  par une panne à peine levée le ferait patienter pour rien. Refusé, il le
  dit à l'appelant — rien ne s'écrit sous un nom qui n'est pas à l'abri — et
  repasse par la file. Pendant que le miroir d'un espace s'efface
  (`remettreAZero`), il attend l'issue : écrit avant, il ferait renaître au
  réveil la soirée qu'on efface.
- **Un serveur qu'on ferme doit éteindre ses chronomètres** et vider son
  miroir avant de fermer la base locale, que la resynchronisation relit.
  Un chrono de question qui sonne après `close()` révèle sur une base fermée —
  c'est ce que fait `GameEngine.stop()`. Allonger le smoke suffit à réveiller
  ce genre de fantôme : le symptôme (« The database connection is not open »)
  ne désigne jamais la section qui l'a déclenché. Et la file n'a que dix
  secondes (`delaiExtinctionMs`) : ce qui reste est abandonné et dit au
  journal (« [sauvegarde] extinction : … abandonnée(s) »), puis `index.ts`
  coupe tout deux secondes après. Un arrêt net perd la file entière :
  l'invariant 13 vaut tant que le processus vit.
