---
paths:
  - "server/src/core/{scores,answers,backup,distante,db,connexions}.ts"
  - "server/src/server.ts"
  - "server/test/{miroir,demarrage,relecture,categories,compagnons,connexions-de-la-base}.test.ts"
---

# Les deux bases, les journaux et le miroir Turso

## Les fichiers

- `core/db.ts` — la base locale (SQLite), jetable : les sept tables de la soirée en cours (`players`, `teams`, `team_bonus`, `answer_log`, `score_entries`, `sessions`, `soiree`), chacune rangée par `space_id` ; `addColumn`, pour une colonne venue après coup ; `lireSoireeLocale`, ce que la resynchronisation renvoie d'un espace — les gains et les réponses sans `uid`, d'avant la colonne, n'en sont pas ; `stampLegacySpace`, les lignes d'avant les espaces rattachées à celui de l'administrateur ; `wipeSpace`, un espace effacé avec son compte
- `core/scores.ts` — journal des gains, en ajout seul
- `core/answers.ts` — une ligne par invité et par question posée, y compris sans réponse
- `core/backup.ts` — le miroir de la soirée dans Turso (les sept tables `party_*`) : une file par espace, ordonnée, qui insiste ; la resynchronisation après une panne ; sa santé
- `core/distante.ts` — le client libsql, avec un délai : une base muette se dit en dix secondes, pas en cinq minutes — et chaque aller-retour referme d'abord les connexions attardées (`refermerLesAttardees`, plus bas) ; et `ajouterColonne()`, qui lit le schéma avant de migrer — une fois par table — et laisse toute panne arrêter le démarrage
- `core/connexions.ts` — les connexions vers la base (la revue du 14 octobre 2026, `retours/2026-10-14/` : en production, 225 ms l'aller-retour sur une connexion à rouvrir, 29 sur une connexion gardée) : celles qui s'ouvrent — le canal `undici:client:connected` du `fetch` de Node, filtré sur les hôtes que `clientDistant` suit —, celles que la base referme d'elle-même et leur âge, les allers-retours tombés en route, le délai qu'elle annonce (`Keep-Alive: timeout=…`), tout cela à `/healthz` (`base.connexions`) et au relevé de l'heure ; et l'entretien qui les garde chaudes tant que des joueurs jouent (`QUIZ_DB_KEEPWARM`, perf-turso-13) : chaque route d'API hors de `/api/admin` dit qu'un joueur est là (`noterUneDemande`, le minutage de `server.ts`), et une minute durant (`CHAUDES_MS`), avant que la plus anciennement servie des connexions qu'il garde ait trois secondes de calme (`BATTEMENT_MS` — compté connexion par connexion, de la fin de sa dernière réponse : les canaux `undici:client:sendHeaders`, `undici:request:trailers` et `undici:request:error`), un `SELECT 1` part sur chaque connexion libre, six au plus (`CHAUDES_AU_PLUS`), par un client à lui (`clientDistant(…, { battement: true })`) : ses battements ne comptent ni dans le temps de Turso, ni dans ses échecs, ni parmi les connexions neuves d'un joueur — à part, avec ceux qui tombent et les connexions qu'ils ouvrent (`connexions-de-la-base.test.ts`). Une base en fichier n'en a pas
- `server/src/server.ts` — le démarrage dans l'ordre (les comptes, puis tout le reste de front, puis ce qui relie les magasins) et l'arrêt (`close`)

## Les pièges

- **Une colonne de plus au journal des réponses** se pose dans trois
  fichiers : `addColumn` dans `db.ts` (la locale) ; `COLUMNS`, l'insertion
  et `toRow` dans `answers.ts` ; `ajouterColonne` (le miroir), l'écriture
  (`SQL.reponse`, `ligneReponse`) et la restauration dans `backup.ts`. Une
  seule oubliée, et la colonne se perd au premier réveil sur disque effacé.
  La dernière venue, `compagnon` — celui de sa niche quand la ligne s'est
  écrite (`Party.compagnonDe`, `ProfileStore.compagnonDeLaNiche` ; jusqu'au
  18 octobre 2026, celui qu'il portait), qui grandit de ses bonnes réponses
  (règle `profil.md`) —, a ses sœurs hors des soirées :
  `jour_reponses.compagnon` et `campagne_reponses.compagnon`, posées par
  `ajouterColonne` dans `jour.ts` et `campagne.ts` (`compagnons.test.ts`,
  `niche.test.ts`).
- **Le démarrage ouvre ses magasins de front** (`deFront`, `server.ts`) :
  après les comptes, treize branches partent ensemble — le miroir et sa
  restauration, les profils, le quiz du jour, le rappel du soir, la
  bibliothèque et ses quiz livrés, les programmes, les partages, les salons,
  la campagne, le journal des gestes, la santé du serveur, la maintenance et
  l'historique —
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
- **Turso referme une connexion après 5 s de calme, sans le dire** : lu en
  production le 14 octobre 2026, la garde des connexions portée à 30 s
  (`QUIZ_DB_KEEPALIVE_MS`, retirée depuis) — 838 connexions sur 839
  refermées par lui en une heure, la plus jeune à 5,0 s, et six
  allers-retours tombés : une requête partie juste à 5 s emprunte la
  connexion qu'il ferme (« other side closed »), et une écriture n'est pas
  rejouée — la réponse d'un joueur en a fait les frais. Une garde plus longue
  que 4 s ne gagne donc rien et fait tomber des requêtes ; seul un aller-retour
  garde une connexion, d'où l'entretien. Son battement part avant les 4 s de
  Node, jamais après : à 5 s, il tomberait avec la connexion. Un délai que
  Turso annoncerait passerait avant tout : undici le préfère, et c'est lui
  que `/healthz` dirait (`gardeAnnonceeMs`) ; des connexions refermées par
  Turso diraient qu'il referme plus tôt qu'à 5 s.
- **Une boucle gelée fait manquer sa garde à Node** : la seconde entre ses
  4 s et les 5 de Turso ne protège que si la boucle tourne. Gelée par un
  calcul, la garde de Node ne sonnait qu'après, et la première requête
  partie reprenait la connexion que Turso avait fermée pendant le gel —
  « fetch failed ← other side closed », sous `GET /api/joueur/missions`, en
  production le 18 octobre 2026 (sans doute aussi `GET /api/admin/espaces`
  la veille, règle `qg.md`). Avant chaque aller-retour, `avecDelai` referme
  donc les connexions libres depuis plus longtemps que la garde d'undici
  (`refermerLesAttardees` : 4 s, ou le délai annoncé moins deux) : la
  requête en ouvre une neuve, comme sans le gel. Libre se lit à la fin de
  la réponse (`undici:request:trailers`, `undici:request:error`), jamais à
  son dernier morceau reçu : une longue réponse lue par morceaux — les
  bibliothèques du réveil — aurait été coupée sous elle. Un test qui gèle la
  boucle met son faux Turso dans un autre fil (`Worker`) : dans le même, sa
  minuterie gèlerait avec le serveur (`connexions-de-la-base.test.ts`).
- **Le calme se compte connexion par connexion** : compté sur toutes à la
  fois, une réponse toutes les deux secondes ne laissait jamais trois
  secondes de calme, et les connexions qu'elle n'empruntait pas se
  refermaient sous l'entretien — la page suivante les repayait (le banc,
  `retours/2026-10-14/reproductions/connexions-chaudes.ts`). Les battements
  partent donc quand la plus vieille des gardées approche les 4 s de Node,
  et deux tours ne se suivent pas à moins d'une seconde et demie.
- **Un battement n'est pas un aller-retour qu'on attend** : ses trente
  millisecondes feraient passer Turso pour plus rapide qu'il ne l'est pour un
  joueur, et ses échecs pour une panne. `avecDelai` ne les compte qu'au
  client des battements, et `unAllerRetourPart` tient le compte des vrais en
  vol — une connexion ouverte pendant un battement, sans vrai aller-retour
  en vol, est à l'entretien. Le `fetch` donne à chaque requête la première
  connexion libre (mesuré) : autant de battements de front que de
  connexions libres les touche toutes. Un aller-retour qui part pendant ce
  tour les trouve donc toutes occupées, et en ouvre une de plus, comptée
  au joueur : un test qui compte des connexions fait partir ses requêtes
  entre les tours — à trois secondes de calme, la troisième réponse d'une
  par seconde tombait sur le premier, trois fois sur dix sur une machine
  chargée (`connexions-de-la-base.test.ts`, la CI du 17 octobre 2026).
- **Deux allers-retours enchaînés ouvrent deux connexions** : quand la
  requête suivante part dans la même tâche, le `fetch` de Node n'a pas encore
  rendu la première (mesuré : deux connexions pour dix, une seule dès qu'une
  milliseconde les sépare). Une chaîne d'`await` après une pause paie donc
  deux poignées de main, pas une — et un test qui compte des connexions
  espace ses requêtes.
- **Un aller-retour coûte aussi du processeur au serveur**, pas seulement
  du temps : le `fetch` de Node, le décodage du client libsql et ses
  sockets — 1 à 2 ms chacun sur un vrai cœur, une poignée de main TLS
  deux de plus —, soit dix à vingt au dixième de cœur de l'hébergeur, où
  le processeur se distribue par tranches de dix millisecondes. Le banc du
  16 octobre 2026 (`retours/2026-10-16/`) : 60 % du processeur d'une
  requête partait là, l'accueil de quatre joueurs à la fois figeait la
  boucle deux secondes, et chaque aller-retour en vol pendant le gel
  paraissait lent à `avecDelai` — qui chronomètre le `fetch` entier : un
  Turso « lent » au relevé peut être un serveur gelé. Lire à quoi s'en
  tenir : le gel de l'hébergeur au relevé (`sondeDuGel`, règle
  `exploitation.md`). D'où : une lecture partagée par page plutôt que
  relue par chacun de ses morceaux (`CampagneStore.duProfil`), des lots, et
  jamais une colonne de questions qu'on ne montre pas.
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
