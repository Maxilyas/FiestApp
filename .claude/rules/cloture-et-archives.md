---
paths:
  - "server/src/core/{archive,recap,review,stats,progress,journal,objectifs,pages,export}.ts"
  - "shared/{fin,liens,archive,review}.ts"
  - "client/src/derniere.ts"
  - "client/src/views/{RecapApp,BilanApp,ArchivesApp}.tsx"
  - "client/src/components/{FinDeSoiree,Lendemain,SpaceNav,HistoriqueDuCompte,MesSoirees,Cloture,BilanPlayer,BilanQuestion,BilanRoom,AwardsBoard,StatsTable,PrixRemis,Trophies,Chiffres}.tsx"
  - "server/scripts/export-party.ts"
  - "server/test/{cloture,cloture-auto,cloture-reprise,credits,fin-allegee,fin-de-soiree,fin-gardee,une-fin,entre-deux-soirees,pages-de-soiree,liens,historique-compte,retrait,soiree,resultats,chiffres}.test.ts"
---

# La fin de soirée : les crédits, l'historique, le souvenir et le bilan

## Les fichiers

- `core/archive.ts` — l'historique (table `soirees`) : l'archive entière (`data`) et sa fiche de faits bruts (`summary`), relues avec les règles du jour ; `Soiree`, le nom figé — le jour et l'heure de la première réponse jouée, plus une empreinte de l'espace (`soireeDesInvites`, `archiveIdOf`)
- `core/recap.ts` `review.ts` `stats.ts` `progress.ts` — **dérivations pures** des journaux ; `stats.ts` tient aussi le palmarès et la collection de prix (`PRIX_INDIVIDUELS`)
- `core/journal.ts` — le journal rangé question par question et quiz par quiz : la seule lecture qu'en font l'expérience, les hauts faits et les Divins — et le coup d'œil de chaque estimation (`coupDOeil`), que lisent aussi le souvenir, le bilan et la carte
- `shared/fin.ts` — ce que la soirée annonce : au podium d'un quiz, à la clôture — au téléphone (`soiree:fin`) et à la salle (`soiree:cloture`) ; la soirée suivante, que la fin ne propose qu'une fois commencée — un invité inscrit, un quiz lancé (`suivanteCommencee`). Au téléphone (`FinDeSoiree.tsx`), l'écran des gains de tous les modes (l'écran A validé le 13 octobre 2026 ; ses pièces : règle `recompenses.md`) : en tête, sa place et ses points en cadrans, ses records battus ; puis « Ce que tu gagnes » — l'expérience en un total, « ta soirée » et « tes pistes » comme « Mes soirées » les compte (`xpPaliers`), ses confettis, son niveau —, ses Divins, son Éclat et ses légendaires, « Nouveaux trophées » — trois au plus, les plus rares d'abord ; un prix du palmarès s'y mesure à la salle, une part d'un sur ses joueurs —, « À porter », deux boutons (« Mon bilan » — « Revoir la soirée » pour l'arrivé après la dernière question, absent de l'archive —, « Accueil »), et tout le reste replié sous « Plus » (`fin-allegee.test.ts`). L'expérience des cadrans, puis les six nouveautés en vrac — hauts faits, paliers, prix, à égalité — ne disaient ni d'où elle venait, ni lesquelles comptaient (le retour reçu par le propriétaire le 13 octobre 2026 : « très confus, les trophées que les gens gagnent »). La célébration de la fin de chaque quiz ne garde que son expérience : les trophées ne se décident qu'à la clôture (invariant 10)
- `shared/liens.ts` · `client/src/components/Lendemain.tsx` — les liens d'une soirée close, à l'adresse de son archive (`/<espace>/souvenir` change de soirée à la suivante) ; et « La dernière soirée », que le téléphone garde sept jours (`garderFin`, `DERNIERE_MS`, `client/src/state.ts`) pour l'entrée et l'accueil — sa fin ne se rouvre qu'au retour sur la page, rechargement ou retour du navigateur, dans les douze heures (`FIN_ROUVERTE_MS`), jamais à une arrivée (`estUnRetour`) : un lien, le QR, « Jouer depuis cet appareil » ouvrent l'entrée (`entre-deux-soirees.test.ts`)
- `components/PrixRemis.tsx` · `Trophies.tsx` · `Chiffres.tsx` — à côté du palmarès : les prix remis à l'écran, prix libres compris, dans l'ordre de remise (`prixRemis`) ; le plus beau coup, le plus régulier, les vainqueurs de chaque quiz ; la précision qui dit sur combien de QCM, le coup d'œil sur combien d'estimations (`justesses`)
- `core/export.ts` · `server/scripts/export-party.ts` — `npm run export` : le bilan en JSON et trois CSV, lu au serveur ou dans la base (`--db` : les copies exactes des parties d'abord). Entre deux soirées, la soirée en cours est vide : sans `--soiree`, rien à exporter. Une cellule qui commence comme une formule prend une apostrophe (`toCsv`)
- `core/objectifs.ts` — ce que la fin de soirée raconte en plus de ce qu'elle rapporte : les records battus, « Tu t'en approches » — dérivations pures de l'historique, lues à la clôture après les crédits
- `core/pages.ts` — le souvenir et le bilan, en cours ou archivés, calculés **une fois** pour toute la salle qui scanne le QR : gardés sous une empreinte des journaux (`revision` de chaque registre, `ArchiveStore.revision`, `empreinteDesPages`), la rafale attend la promesse du premier calcul ; compressés une fois, avec leur ETag. Une page qui en porte une autre — celle de la dernière soirée close, sous la page de l'espace — la lit par `lire`, avec son `provisoire` : la page lue provisoire, celle qui la porte l'est aussi — gardée, elle l'aurait montrée amputée jusqu'à son échéance
- `client/src/components/SpaceNav.tsx` — la flèche des pages publiques d'une soirée — le souvenir, le bilan, l'historique de l'espace : ni fil de l'une à l'autre, ni « Accueil » ni « Mon compte » ; chacune s'ouvre d'une liste qui offre les deux (l'historique du compte, la fin de soirée, « Mes soirées », « La dernière soirée ») et la flèche y revient (`retourDesPages`) — ouverte d'un lien ou d'un QR, l'animateur va à son historique, l'invité à l'accueil. Les pas que la page empile (le bilan : un invité, la salle) passent par `pousserDansLaPage`, que la flèche saute (`pages-de-soiree.test.ts`)
- `client/src/components/HistoriqueDuCompte.tsx` — l'historique de son espace, dans « Mon compte » (`/compte#historique`) : une ligne par soirée — celle en cours d'abord —, son souvenir et son bilan sous chacune, renommer et retirer dans sa feuille ; la flèche ramène au compte, la barre du menu reste. La page publique `/<espace>/soirees` reste, pour les invités

## Les pièges

- **Le nom d'une soirée porte une empreinte de son espace** (`archiveIdOf`),
  mais les soirées d'avant n'en ont pas : l'expérience, les paliers et les
  Éclats se rangent sous le nom seul, alors une soirée se désigne par
  `(espace, nom)` partout où l'on en compare plusieurs (`cleDeSoiree`). Et un
  palier ne compte que les soirées closes : `accorderPaliers` écarte celles
  qui se jouent encore ailleurs — leurs lignes, leur expérience dans le
  niveau et leurs Éclats (`careerOf`) —, mais compte celles dont la clôture
  est en cours (`cloturesEnCours`).
- **Reprendre une soirée aux profils** — un essai effacé, une soirée retirée
  de l'historique — se fait en un seul lot (`retirerSoireeEntiere` : les
  lignes, la ligne des paliers et les totaux ensemble), l'archive en
  dernier : effacée d'abord, une panne au milieu laissait ce que la soirée
  avait crédité sans plus aucun geste pour le reprendre.
- **Les crédits lisent les journaux avant le premier `await`** et passent par
  `enFile` : une clôture cliquée pendant un rangement viderait sinon ce
  qu'ils lisent. Les profils s'y créditent huit à la fois (`enParallele`),
  qui attend qu'ils aient tous fini, échec compris : un crédit qui écrirait
  encore après avoir rendu passerait derrière le travail suivant de la file.
- **Les pages publiques se gardent** (`core/pages.ts`) tant que leur
  empreinte ne bouge pas. Une écriture d'un journal (`Party`, `Teams`,
  `ScoreLedger`, `AnswerLog`) qui change vraiment quelque chose fait monter
  sa `revision` — pas un téléphone qui se re-présente au réveil, sinon toute
  la salle qui sort de veille refait le souvenir —, une écriture de
  l'historique passe par `ArchiveStore.ecrire` : une nouvelle écriture qui
  les contournerait laisserait le souvenir en retard — une minute au plus en
  cours de soirée —, et une nouvelle source d'une page publique entre dans
  `empreinteDesPages`. La place d'une page porte toujours l'espace.
- **« Terminer le quiz » sur le dernier quiz du programme clôt hors de
  `cloreLaSoiree`** : `considererCloture` appelle `closeParty()` lui-même
  (`core/space.ts`), et la mesure des inscriptions, les adresses vues et la
  ligne de journal de la clôture n'y passent pas (le piège de `qg.md`). Une
  porte de clôture de plus passe par `cloreLaSoiree` — celle-ci reste à y
  ramener.
- **« Joueurs » ne compte pas la même chose partout** : la fiche de
  l'historique, la soirée en cours (`currentSummary`) et le QG comptent les
  invités à qui une question a été posée ; la fin de soirée et le relevé,
  ceux qui ont répondu (`relevesDeSoiree`) ; le souvenir, le plus grand des
  deux. Un chiffre de plus dit lequel il compte.

## L'invariant 10, en entier

10. **L'expérience d'un quiz se crédite dès qu'il rend son verdict** (son
    podium s'affiche), à la fin de la partie si quelque chose a changé depuis
    (`dernierCredit`, l'empreinte des gains arrivés en base), puis une
    dernière fois à la clôture, toujours, avant tout effacement. C'est
    l'idempotence qui le permet : la ligne `(profil, soirée)` est remplacée,
    jamais ajoutée. Un invité **exclu** rend la sienne, et l'Éclat tiré ce
    soir-là (`exclure()`, à la file des crédits) : le crédit suivant ne
    réécrit que les profils encore là — et la clôture reprend ce qu'un
    hoquet de la base aurait laissé à l'exclu (`retirerAbsents`). Ce qui ne se juge qu'une fois tout
    joué — le podium de la soirée, l'assiduité, les **prix** du palmarès, les
    **hauts faits**, les **paliers** de carrière — ne se décide **qu'à la
    clôture** (La Légende, qui ne lit que le niveau, se juge aussi au quiz
    du jour) : le podium et l'assiduité dans la ligne d'expérience, les
    prix, les hauts faits, les Divins et les légendaires de saison en un
    seul lot (`remplacerRecompensesDeSoiree`), les paliers en dernier
    (`accorderPaliers`) — un rangement à mi-soirée ne fige rien. Un palier ne se reprend que si la
    soirée qui l'a fait tomber est retirée (essai effacé, soirée supprimée de
    l'historique) — et tout ce qu'elle avait rapporté part avec elle.

## L'invariant 11, en entier

11. **Le nom d'une soirée se tire une fois** (`soireeEnCours`) et ne se
    recalcule jamais : exclure le premier arrivé ou redémarrer ne le change
    pas, seules la clôture et l'essai effacé l'oublient (`viderSoiree`).
    Toute écriture permanente sous ce nom passe d'abord par `recopierSoiree`.
    Recalculé, il comptait l'expérience deux fois et dédoublait l'archive.
    Il se date à sa **première question jouée** (`soireeDesInvites`, l'heure
    de la révélation au journal), jamais avant : l'invitée revenue relire la
    veille, ou le QR testé la veille, datait sinon la soirée suivante de
    l'arrivée d'un invité, pour toujours.

## L'invariant 18, en entier

18. **L'historique s'écrit tout seul, et la soirée n'a qu'un geste de fin.**
    Elle se range après chaque quiz (`apresQuiz`) ; `host:closeParty` la clôt
    — dernier rangement, crédits de clôture, la soirée effacée (le miroir,
    puis la base locale), la salle vide, puis la fin de soirée à chaque
    téléphone et à la salle ; rien de joué, elle s'efface comme un essai.
    Laissée en plan — six heures sans un geste —, l'administrateur la clôt
    aussi depuis le QG (`POST /api/admin/soirees/:spaceId/clore`, règle
    `qg.md`), par le même chemin que l'écran commun et la barre du chef
    (`cloreLaSoiree`, `sockets.ts`) : une clôture qui contournerait ce chemin
    oublierait la mesure des inscriptions de l'espace — c'est le cas,
    aujourd'hui, de « Terminer le quiz » (piège plus haut). Pour un salon ouvert depuis un
    téléphone (`SalonStore.clotureAuto`), le verdict du dernier quiz de son
    programme n'arme rien : il annonce la fin du programme
    (`considererCloture`, `finDuProgramme` dans l'instantané), et la barre
    du chef propose « Terminer la soirée » — le podium reste jusque-là, c'est
    l'animateur qui l'enlève (le choix du 4 octobre 2026) ; un quiz relancé
    ou un programme allongé la défait, et « Terminer le quiz » sur le
    dernier clôt tout de suite ; `host:discardParty` efface un essai
    avec tout ce qu'il avait crédité. **Une seule fin à la fois**
    (`finEnRoute`) : un second « Clore » attend le premier et en reçoit
    l'issue, le geste contraire est refusé — deux clôtures croisées
    recréditaient, réannonçaient au podium vide et effaçaient l'invité entré
    entre les deux. Ce que la clôture raconte se relit en base
    (`rangesSousLaSoiree`) : reprise après un refus du miroir, elle se taisait
    sur ce que la tentative d'avant avait rangé. La fin de soirée ne part
    **qu'une fois la soirée effacée** : un miroir qui refuse d'effacer ne doit
    pas faire lire « c'est fini » à une soirée qui continue. `host:resetParty` et
    `host:archiveParty` restent compris des pages d'avant. Entre deux
    soirées, `recap.json` et `bilan.json` désignent la dernière soirée close
    (`derniere`), sa page jointe (`derniere.page`, gardée comme demandée
    seule), que le souvenir et le bilan de l'espace montrent à sa place
    (`lecteurDePage`) — sans redirection : la page revient d'elle-même à la
    suivante dès sa première question jouée.
