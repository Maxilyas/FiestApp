# Le Cabinet de curiosités — rapport de l'expert base, quota et processeur (`cabinet-sobriete`)

## En bref

Le Cabinet tient sa promesse de sobriété **pour ce qu'il lit lui-même** : chaque route compte exactement les allers-retours que promet `docs/reference/api-http.md` (la page chaude zéro, froide un lot ; un départ un ; un geste un, son verdict compris ; la fin, son lot et le rituel ; l'achat, la dorure, l'échange un chacun, rejoués zéro), chaque lecture part de la clé du profil — sans statistiques comme en production, et sous des statistiques de mille profils —, le lot froid d'un fidèle de 310 parties et 84 œuvres reste borné (96 lignes rendues, contre 3 pour un joueur neuf), le réveil ne paie pas un aller-retour de plus, et chaque écriture est gardée (aucun `UPDATE` ni `DELETE` de `campagne_reponses`, un geste rejoué n'écrit rien). Ce qui ne tient pas est **à côté** : (1) la préparation des tas, « en fond », fige la boucle d'un bloc par catégorie — 49 à 113 ms de processeur ici, de l'ordre d'une seconde au dixième de cœur de l'hébergeur, douze fois de suite, à chaque réveil et à chaque liste de jouables neuve, pour tout le serveur, soirées comprises ; (2) les parties du Cabinet, dix par jour pour un régulier, gonflent des lectures d'autres pages qui parcourent toutes les parties d'un profil — la recherche du défi de la semaine, à chaque accueil, en lit toute l'histoire (le piège `LA_PLUS_RECENTE`, sans son `+`), et les missions, que chaque bilan redemande, relisent trois semaines de parties du Cabinet pour n'en compter aucune ; (3) une partie finie ne se garde pas : l'image de la dernière révélation du Détail, « Mes réponses », un cartel rouvert relisent chaque fois de la base la partie que la mémoire tenait l'instant d'avant. Les trois améliorations qui rapporteraient le plus : **découper chaque catégorie des tas en tranches de deux cents questions** (et lire l'intitulé une fois par question), **mettre le `+` devant `commencee_le`** dans les trois recherches de tentative du défi et du duel, **garder quelques dizaines de parties finies en mémoire**.

## Méthode

Lecture du code du Cabinet sur la branche `ccr-95f7b600-x1amjl` (HEAD `50c327c`, depuis `1babf7d` ; la dernière vérification complète, verte, date de `757855b`) : `server/src/core/cabinet/{magasin,tables,ecriture,gardiens,vue}.ts`, `tirages/{tas,index,communs,eclair,pari}.ts`, `server/src/cabinet.ts`, `server/src/core/porteDeLaCampagne.ts`, les passages de `core/campagne.ts` que la porte et le rituel traversent (`init`, `porte()`, `lireAvecLeJournal`, `rattraperLeJournal`, `ecrireDesReponses`, `statsDe`, `jouables`, `activiteDepuis`, `defiDAccueil`, `tentativeDuDefi`, `tentativeDuDuel`, `rencontresEtDuels`, `compagnonsDe`), `core/tirageALaPiece.ts` (`tirerPourUneEscale`), `core/journalDesReponses.ts` (`vuesDe`, les déclencheurs des tranches), `auth/profiles.ts` (`ranger`, `offrirUnCompagnon`, `faireGrandir`, `compagnonsDe`, `historiqueOf`), `core/missions.ts`, `shared/missions.ts`, `shared/cabinet/{musee,vues,pieces}.ts`, `client/src/views/cabinet/Bilan.tsx` et `jeux/Detail.tsx` (ce que la page redemande). Les règles `cabinet.md`, `campagne.md`, `journaux-et-miroir.md`, `missions.md`, `tests.md`, `exploitation.md` ; `docs/reference/api-http.md` (section du Cabinet) ; les tests `cabinet-charge`, `cabinet-index`, `demarrage`, `campagne-charge` (relancés : `cabinet-charge` et `cabinet-index` passent). Les retours de la tablée du 25 octobre (`export/tablee/2026-10-25-22h07/retours/`) : aucun ne parle de lenteur ; rien n'en est redit.

**L'instrument.** Le client libsql local ne dit pas les lignes que Turso compte (`rows_read`, ce qu'une requête parcourt). J'ai donc compté trois choses : les allers-retours, les lignes rendues et écrites (`rowsAffected`), instruction par instruction (`compteur.ts`, qui enveloppe `Sqlite3Client` comme `cabinet-charge.test.ts`) ; puis, rejouées sur une copie de la base, **les pas de la machine virtuelle de SQLite** de chaque instruction et son plan (`lignes-parcourues.py`, Python, `set_progress_handler(f, 1)` — environ cinq pas par ligne parcourue), sans statistiques, avec celles de la base d'essai, et avec des statistiques d'une base de mille profils écrites à la main (`--stats-production`). Les temps de processeur viennent de `process.cpuUsage()`, en médiane de trois à cinq essais, la charge de la machine rangée avec (entre 0,5 et 5 : d'autres experts tournaient) ; je les lis en rapport, et ce qui fonde un constat est un compte.

Ce que j'ai écrit, tout dans `export/evaluations/cabinet-sobriete/` (un fichier à la fois, `nice -n 10`) :

| Fichier | Ce qu'il fait | Aujourd'hui |
|---|---|---|
| `routes.test.ts` | chaque route, chaud et froid, les neuf jeux geste par geste, la poussière, les relectures, le réveil, la fin qui réveille un gardien | passe — mesure (`mesures/routes.json`) |
| `fidele.test.ts` | un fidèle de 31 jours (310 parties, 858 gestes, 84 œuvres) contre un neuf, après un réveil ; instructions et copie de la base pour le Python | passe — mesure (`mesures/fidele*.json`, `fidele.db`) |
| `lignes-parcourues.py` | rejoue chaque instruction : pas de SQLite, plan, sans/avec statistiques | mesure (`mesures/fidele-pas*.json`) |
| `reveil.test.ts` | le premier lot d'`init` avec et sans le Cabinet ; la première page et le premier départ d'un réveil, préchauffage ouvert | passe |
| `processeur.test.ts` | vraie base : chaque étape des tas, chaque départ des neuf jeux (neuf / quinze mille vues), la page chaude, la partie relue, le poids du départ figé | passe — mesure |
| `tirage-histoire.test.ts` | le processeur d'un départ pour 0, 3 000, 8 000, 15 000 questions vues | passe — mesure |
| `taille.test.ts` | le poids d'une partie finie, jeu par jeu, vraie base | passe — mesure |
| `tas-gel.test.ts` | ce que chaque tour de boucle des tas passe au crible, le gel de la boucle, chaque crible, la piste, le premier départ d'une liste neuve (constat 1) | **échoue** (1 épreuve sur 4) |
| `defi-accueil.test.ts` | le plan de la recherche du défi de la semaine sur l'accueil (constat 2) | **échoue** |
| `missions.test.ts` | les parties du Cabinet que les missions relisent à chaque bilan (constat 3) | **échoue** |
| `partie-finie.test.ts` | l'image de la dernière révélation du Détail, « Mes réponses », un cartel rouvert (constat 4) | **échoue** (2 épreuves) |
| `fin-compagnon.test.ts` | la fin d'une partie avec un compagnon dans la niche (constat 5) | **échoue** |
| `tirage-parcours.test.ts` | les questions qu'un départ examine selon l'histoire du joueur (constat 6) | **échoue** |

Lancer : `cd server && nice -n 10 node --import tsx --test --test-timeout=120000 ../export/evaluations/cabinet-sobriete/<fichier>.test.ts` (ceux de la vraie base : `--test-timeout=600000`) ; puis `python3 -I lignes-parcourues.py mesures/fidele-instructions.json sortie.json [--analyze [--stats-production]]`. Les épreuves rouges sont écrites pour passer le jour où c'est corrigé. Rien n'est resté allumé.

Pas couvert : un vrai Turso (les `rows_read` exacts, les connexions), le dixième de cœur de l'hébergeur (je n'ai pas bridé un processus : les « ×10 » ci-dessous sont l'extrapolation que les règles du dépôt font elles-mêmes), deux serveurs pendant une mise en ligne (les gardes D9 ont leurs épreuves à deux magasins dans `cabinet-charge.test.ts`, que j'ai relancées sans les refaire), la page au navigateur.

## Constats

### 1. La préparation des tas « en fond » fige la boucle d'un bloc par catégorie : douze gels de 49 à 113 ms, de l'ordre d'une seconde chacun au dixième de cœur

- **Où** : `server/src/core/cabinet/tirages/tas.ts:231-244` (`preparerLesTas`), `:127-137` (`tasDeLaCategorie`), `:44-47` (`estUnQcmDuCabinet`) ; appelé par `CabinetStore.tasDe` (`magasin.ts:1186`), derrière chaque page (`prechauffer`, `server.ts:1252-1256`) et sous le départ qui trouve une liste neuve (`magasin.ts:660`).
- **Constat** : la préparation rend la main *entre* deux catégories, mais chaque étape passe d'un seul tenant toutes les questions de sa catégorie aux trois cribles du Cabinet — 1 776 à 3 263 questions sur la vraie base. Le crible des QCM découpe l'intitulé en mots une fois **par réponse** (`ecritDans(q.texte, r)` refait `motsDe(q.texte)` quatre fois). La règle de la campagne (« Une étape de fond par tour de boucle ») ne laisse d'un tenant que vingt à trente millisecondes, la lecture de la base deux cents questions par tranche.
- **Preuve** : `tas-gel.test.ts`, épreuve 1, **rouge** : « un seul tour de boucle passe 3263 questions aux trois cribles du Cabinet » ; le plus long gel de la boucle pendant la préparation, 96 ms (`monitorEventLoopDelay`, charge 0,8). Par étape (processeur, médiane de trois, `mesures/processeur-tas.json`) : Culture générale 113 ms, Arts & lettres 90, Histoire 71…, la plus légère des douze catégories 49 ; quatorze étapes (les douze, les tableaux, les frises des sujets), **863 ms** en tout, plus `contenuDuCabinet()` 46 ms d'un bloc au premier passage du processus. Le crible des QCM pèse les deux tiers (66 ms sur 96 pour Culture générale, `mesures/tas-cribles.json`). Le premier départ d'une liste neuve attend tout : **963 ms** de mur, 1 008 ms de processeur, contre 5 ms au départ suivant (`mesures/tas-premier-depart.json`, charge 3,4).
- **Qui ça touche, ce que ça coûte** : à chaque réveil (la première page du Cabinet lance la préparation), et à chaque liste de jouables neuve — la réserve du jour qui reçoit ses questions chaque matin, un retrait au QG —, tout le serveur se fige douze fois ; au dixième de cœur, de l'ordre d'une seconde chacune, une dizaine de secondes au total, et le joueur dont le départ tombe sur une liste neuve attend autant. Une soirée qui se joue dans le même processus prend ces gels dans ses accusés et ses chronos.
- **Statut** : bug confirmé (rejoué).
- **Piste** : couper chaque catégorie en tranches de `QUESTIONS_PAR_TRANCHE`, un tour de boucle chacune, et relire ce qu'une autre a pu faire pendant l'attente (le patron de `rendreLaMain`) ; lire l'intitulé une fois par question — `tas-gel.test.ts` (épreuve « la piste ») vérifie que ce crible garde les mêmes 26 394 décisions, à 332 ms au lieu de 543 sur toute la base. Le tireur garde son chemin synchrone pour ce qui manquerait.
  ```ts
  for (const c of CATEGORIES) {
    const siennes = porte.deLaCategorie(jouables, c)
    const tas: TasDeLaCategorie = { qcm: [], mots: [], valeurs: [] }
    for (let i = 0; i < siennes.length; i += QUESTIONS_PAR_TRANCHE) {
      await rendreLaMain()
      for (const q of siennes.slice(i, i + QUESTIONS_PAR_TRANCHE)) { /* les trois cribles, l'intitulé découpé une fois */ }
    }
    const parCategorie = tasDe(jouables) ; if (!parCategorie.has(c)) parCategorie.set(c, tas)
  }
  ```
  et une épreuve qui compte les questions par tour (celle-ci) dans `cabinet-charge.test.ts`, à côté de celle qui compte les tours.
- **Priorité · effort** : P2 · S.

### 2. Sur l'accueil, la recherche du défi de la semaine parcourt toutes les parties du profil — et le Cabinet en ajoute dix par jour

- **Où** : `server/src/core/campagne.ts:6178-6179` (`defiDAccueil`, à chaque accueil), et la même forme à `:3586` (`tentativeDuDefi`) et `:3901` (`tentativeDuDuel`) : `WHERE profile_id = ? AND mode = … AND … ORDER BY commencee_le LIMIT 1`.
- **Constat** : sans statistiques — la production —, SQLite prend l'index `(profile_id, commencee_le)` pour s'épargner le tri, puis lit chaque ligne pour y vérifier le mode : sans défi cette semaine (le cas ordinaire), toutes les parties du profil, tous modes, y passent. C'est le piège que `campagne.md` décrit pour `LA_PLUS_RECENTE` (`ORDER BY +commencee_le DESC LIMIT 1`, `campagne.ts:740`) ; ces trois-là n'ont pas le `+`, et `campagne-index.test.ts` ne lit que les recherches qui portent `finie_le IS NULL`. Le Cabinet en multiplie le coût : une partie par case de la visite, par chasse, par libre.
- **Preuve** : `defi-accueil.test.ts`, **rouge** : après trente parties du Cabinet, le plan de la lecture telle que l'accueil l'envoie est `SEARCH campagne_series USING INDEX idx_campagne_series_profil (profile_id=?)`. Sur la base du fidèle (310 parties) : **1 631 pas** de SQLite pour cette lecture, contre 47 pour le neuf ; avec `ORDER BY +commencee_le LIMIT 1`, **77 pas** — le plan passe par `idx_campagne_series_defi (mode=? AND semaine=?)` (`lignes-parcourues.py` sur `mesures/fidele.db`) ; `tentativeDuDefi` et `tentativeDuDuel`, 1 582 pas chacune sans tentative ; celle du défi, 28 avec le `+`.
- **Qui ça touche, ce que ça coûte** : chaque accueil de chaque joueur du Cabinet lit au quota autant de lignes qu'il a de parties — 310 après un mois de visites, 3 650 après un an —, et la page du défi et le duel de même. Une lecture qui grandit avec l'histoire du joueur, la sorte même des 333 millions du 22 octobre.
- **Statut** : bug confirmé (rejoué) — dans `core/campagne.ts`, à la frontière de mon angle : c'est le volume du Cabinet qui le rend cher.
- **Piste** : `ORDER BY +commencee_le LIMIT 1` dans les trois ; et étendre `campagne-index.test.ts` à toute recherche « profil, mode, `ORDER BY commencee_le` » telle que le serveur l'envoie, avec ou sans `finie_le`.
- **Priorité · effort** : P2 · S.

### 3. Chaque bilan du Cabinet redemande les missions, qui relisent trois semaines de parties du Cabinet pour n'en compter aucune

- **Où** : `client/src/views/cabinet/Bilan.tsx:179` (`MissionsAccomplies` → `GET /api/joueur/missions`) ; `server/src/core/campagne.ts:3156-3161` (`activiteDepuis`) ; `shared/missions.ts:172-180` (`activiteDesJours`).
- **Constat** : la lecture des missions prend toutes les parties du profil commencées depuis le lundi d'il y a deux semaines moins sept jours de marge (quatorze à vingt et un jours), tous modes ; les missions n'en comptent que les duels, rencontres, épreuves, étapes de parcours et défis. Les parties du Cabinet se lisent, voyagent, se décodent et se jettent — à chaque bilan du Cabinet, et à chaque accueil.
- **Preuve** : `missions.test.ts`, **rouge** : quinze jours de Cabinet (dix parties par jour), puis une partie et le bilan qui redemande les missions : « les missions relisent 131 parties du Cabinet qu'elles ne comptent pas, à chaque bilan » ; sur la base du fidèle, 2 083 pas pour 130 lignes rendues (`mesures/fidele-pas.json`).
- **Qui ça touche, ce que ça coûte** : 130 à 210 lignes par bilan et par accueil pour un joueur régulier, bornées par la fenêtre — de l'ordre d'un pour cent du quota mensuel pour une centaine de réguliers ; et autant de lignes décodées par le client libsql, au dixième de cœur.
- **Statut** : bug confirmé (rejoué) — mesuré au Cabinet, corrigé dans la campagne.
- **Piste** : ne lire que les modes que les missions comptent. Le plus simple qui ne parcoure pas les autres lignes : une lecture par mode compté sur l'index des sentiers `(profile_id, mode, …)`, bornée par la date (`AND commencee_le >= ?`), ou un index `(profile_id, mode, commencee_le)` ; un `+mode IN (…)` ne suffirait pas, la ligne serait lue pour être écartée.
- **Priorité · effort** : P3 · S.

### 4. Une partie finie ne se garde pas : la dernière révélation du Détail, « Mes réponses », un cartel rouvert la relisent chaque fois de la base

- **Où** : `server/src/core/cabinet/magasin.ts:501` (`garderLaPartie` ne garde qu'une partie en cours), `:847` (`ecrireUnGeste` l'oublie à sa fin), `:516-529` (`partieDe`), `:945-956` (`cadrage`), `:1112-1122` (`cartel`), `:1129-1134` (`partie`) ; `client/src/views/cabinet/jeux/Detail.tsx` (`RevelationDuDetail` demande le tableau entier).
- **Constat** : la réponse qui tranche la dernière manche finit la partie et l'ôte de la mémoire ; la page montre aussitôt la révélation de cette manche, dont le tableau entier (cadrage 4) n'a jamais été demandé — et la route relit la partie de la base, son départ figé et ses gestes, et rejoue son pli. « Mes réponses » d'un Détail fini, puis ses trois tableaux : quatre fois la même partie relue. Un cartel rouvert : relu encore. Une partie finie ne change plus jamais.
- **Preuve** : `partie-finie.test.ts`, **rouge** (2 épreuves) : « l'image d'une partie finie à l'instant : 1 aller-retour » ; « « Mes réponses » et ses trois tableaux : 4 allers-retours » (28 lignes) ; « le même cartel, rouvert : 1 aller-retour ». Chaque relecture : 0,4 à 0,7 ms de pli et de vue (`mesures/processeur-departs.json`).
- **Qui ça touche, ce que ça coûte** : un aller-retour (30 à 225 ms) à la fin de chaque Détail joué jusqu'au bout, sur l'écran même de la révélation ; trois ou quatre à chaque « Mes réponses » d'un Détail ; un par cartel ouvert, même déjà lu. Conforme à ce que dit la référence (« finie, un, par sa clé »), mais pas à la promesse « zéro aller-retour pour ce que la mémoire tient ».
- **Statut** : friction confirmée (rejoué).
- **Piste** : garder les parties finies dans une seconde table bornée (`PARTIES_FINIES_GARDEES`, quelques dizaines, la plus anciennement servie s'en va), remplie à la fin (`ecrireUnGeste`) et à la relecture (`partieDe`) ; `partieDe` la consulte avant la base. Aucune règle ne change : la base fait foi, et une partie finie n'a plus rien à recevoir.
- **Priorité · effort** : P3 · S.

### 5. La fin d'une partie, un compagnon dans la niche : cinq allers-retours en série, dont une relecture inutile du journal et toutes les soirées du joueur

- **Où** : `server/src/core/campagne.ts:2945` (`ecrireDesReponses` → `faireGrandir`), `:3223-3225` (`CampagneStore.compagnonsDe` → `rattraperLeJournal()` sans argument, `:1890`) ; `server/src/auth/profiles.ts:2113-2119`, `:2086-2090`, `:5123-5138` (`historiqueOf`, sans mémoire).
- **Constat** : la luciole entre dans la niche à la première salle complète ; dès lors, chaque fin du Cabinet fait grandir le compagnon : `historiqueOf` relit toutes les soirées du joueur (une ligne de `profile_xp` chacune, sans mémoire), et `compagnonsDe` de la campagne rattrape le journal des réponses à partir du numéro courant — ce qui demande toujours une lecture neuve —, alors que le lot de la fin et les paliers (`statsDe`) viennent de le relire, après les réponses de la partie.
- **Preuve** : `fin-compagnon.test.ts`, **rouge** : « la fin : 5 allers-retours, le journal relu 3 fois (son lot, les paliers — puis encore pour son compagnon), et 1 relecture de toutes ses soirées ». Sans compagnon, trois (`routes.test.ts`, comme `cabinet-charge.test.ts`). La première fin du réveil en ajoute un, le compagnon du quiz du jour (gardé ensuite).
- **Qui ça touche, ce que ça coûte** : la plupart des joueurs qui avancent au Cabinet — deux allers-retours en série de plus sur le bilan, soit 60 à 450 ms ; et une lecture qui grandit avec le nombre de soirées jouées, à chaque fin.
- **Statut** : friction confirmée (rejoué) — dans le rituel commun, que le Cabinet appelle dix fois par jour.
- **Piste** : `compagnonsDe` de la campagne rattrape le journal depuis la dernière réponse écrite ici (`rattraperLeJournal(this.derniereReponse)`, comme la porte), ce qui ne coûte rien après `statsDe` ; l'historique des soirées se garde par profil, oublié à chaque soirée créditée — ou se passe à `compagnonsDe` (`soirees`), comme le fait déjà le solde.
- **Priorité · effort** : P3 · S (le journal) · M (l'historique).

### 6. Le tirage d'un départ grandit avec ce que le joueur a vu ; l'Éclair d'un joueur qui a épuisé une catégorie la parcourt quinze fois

- **Où** : `server/src/core/cabinet/magasin.ts:665` (`vuesDuCabinet(journal.vuesDe(profileId).vues)`), `server/src/core/journalDesReponses.ts:561-570`, `shared/cabinet/vues.ts:363-370` ; `server/src/core/tirageALaPiece.ts:239-258` ; `server/src/core/cabinet/tirages/eclair.ts:15-17`.
- **Constat** : chaque départ refait trois `Map` de toute l'histoire du joueur (ses vues, ses premières réponses, les vues dépliées), puis chaque place du tirage parcourt le tas jusqu'à une question jamais vue, et la place suivante repart du début. L'Éclair tire sa catégorie au hasard parmi les douze, avant de regarder la fraîcheur : dans une catégorie épuisée, ses quinze places parcourent chacune tout le tas — alors que six catégories jamais vues l'attendent.
- **Preuve** : `tirage-parcours.test.ts`, **rouge** : « l'Éclair d'un joueur qui a épuisé six catégories examine 12 809 questions par départ, contre 31 pour un joueur neuf ». Au processeur (`mesures/tirage-histoire.json`, `processeur-departs.json`) : un départ 2,3 à 3,6 ms pour un neuf, 8 à 10 ms à quinze mille questions vues au hasard (dont 4,6 ms à refaire les `Map`), **45 ms** pour l'Éclair d'un joueur aux catégories épuisées (6,5 ms neuf). Le tirage ne rend pas la main.
- **Qui ça touche, ce que ça coûte** : les fidèles de la campagne (douze mille bonnes réponses pour le plus assidu) — 0,1 à 0,45 s de boucle figée par départ au dixième de cœur. Le même Éclair sert aussi des questions déjà vues quand d'autres catégories en ont de fraîches (l'angle de `cabinet-equilibre`).
- **Statut** : friction confirmée (rejoué).
- **Piste** : l'Éclair ordonne ses catégories par ce qui lui reste de jamais vu (le compte se lit en une passe du tas, ou de `PreparationDuTirage`, que la campagne a déjà) ; les vues dépliées se gardent par profil tant que le journal n'a rien reçu pour lui.
- **Priorité · effort** : P3 · M.

### 7. Le départ figé recopie les questions entières, puis les pièces les recopient encore

- **Où** : `server/src/core/cabinet/ecriture.ts:106-113` (le départ), `:186-190` (chaque pièce, `json_insert` dans `questions`) ; `shared/cabinet/pieces.ts` (`PieceDuCabinet` : texte, réponses, anecdote).
- **Constat** : une partie finie pèse 2,8 à 9,1 Ko dans `campagne_series` (le départ figé 1,4 à 6,4 Ko, 8,6 Ko à l'Éclair sous « Changer » ; les pièces 1 à 2,5 Ko, la même question une seconde fois), plus six à neuf gestes et trois réponses. C'est le choix des séries de la campagne, et il sert « Mes réponses » fidèlement.
- **Preuve** : `taille.test.ts` (`mesures/taille.json`), lecture d'`ecriture.ts`.
- **Qui ça touche, ce que ça coûte** : la place chez Turso — un million de parties (cent réguliers pendant trois ans) font de l'ordre de 5 Go.
- **Statut** : idée.
- **Piste** : à mesurer avant d'agir ; la pièce pourrait ne garder que l'identifiant et l'ordre des réponses quand le départ figé porte déjà la question.
- **Priorité · effort** : P3 · M.

## Mesures et cartes

**Chaque route, le banc du Cabinet** (`mesures/routes.json`, `fidele.json` ; un joueur sans compagnon ; AR = allers-retours, en série sauf mention) :

| Route | AR | Instructions | Lignes rendues · écrites | Promis par la référence |
|---|---|---|---|---|
| Page, musée froid (serveur chaud) | 1 | 8 (le lot froid, le journal au bout) | 3 · 0 (neuf) ; 96 · 0 (fidèle : 84 œuvres, 10 parties du jour) | un à froid ✔ |
| Page chaude, préchargée ou non | 0 | 0 | 0 | aucun ✔ |
| Départ (libre, visite, chasse) | 1 | 3 | 1 · 2 | un, deux si le journal n'est pas frais ✔ |
| Premier départ d'un réveil | 3 | 5 (la réserve du jour, le journal, le lot) | 40 · 2 | — |
| Geste sans verdict (ouvrir, parier, reculer, un indice, un essai faux, le mot, pause, reprendre) | 1 | 1 | 0 · 1 | un ✔ |
| Geste qui tranche (une pièce ; deux au Pari parié) | 1 | 3 ; 5 | 0 · 3 ; 0 · 5 | un, son verdict compris ✔ |
| Geste rejoué (double toucher, 409) | 0 | 0 | 0 | ✔ |
| Fin, avec justes · sans juste | 3 · 2 | 16 à 20 · 13 | 4 · 5 à 9 ; 2 · 5 | son lot et le rituel ✔ |
| Fin, compagnon dans la niche | **5** | 18 | 5 · 5 | (constat 5) |
| Fin qui réveille un gardien et la luciole | 9 | 28 | 7 · 12 | — (rare) |
| Cadrage du Détail, partie en cours · finie | 0 · **1** (chaque fois) | 0 · 2 | 0 · 5 | ✔ (constat 4) |
| Acheter · rejoué · dorer · échanger · refus du solde | 1 · 0 · 1 · 1 · 1 | 1 · 0 · 1 · 2 · 1 | — | ✔ |
| Cartel d'office · d'une partie (chaque fois) | 0 · **1** | 0 · 2 | 0 · 13 | ✔ (constat 4) |
| « Mes réponses », en cours · finie (chaque fois) | 0 · **1** | 0 · 2 | 0 · 13 | ✔ |
| Tes murs, journal frais · en retard | 0 · 1 | — | — | ✔ |
| Réveil : premier geste · première page · première fin | 3 · 3 · 3 | 9 · 14 · 16 | — | (la session du profil, la partie ou le lot, le journal) |

**Le fidèle contre le neuf, à froid après un réveil** (pas de SQLite, `lignes-parcourues.py`) : profil 18 pas (1 ligne) ; œuvres 1 186 pas (84) contre 11 ; parties du jour 249 pas (10) ; partie en cours, gestes, saisons, 22 à 60 pas ; l'expédition en route 24 pas sans expédition — 61, 261, 1 011 pas pour 10, 50, 200 expéditions finies (elle lit toutes celles du profil par l'index des sentiers, un compte gelé maintenant que leur départ ferme ; `EXPEDITION_ENCORE_LUE` l'ôtera). **Rien du Cabinet ne grandit avec l'histoire** : tout part d'une clé, et ce qui se lit est borné par 84 œuvres et les parties du jour. Ailleurs, pour le même fidèle : missions 2 083 pas (130 parties du Cabinet), défi sur l'accueil 1 631 pas, page des duels 1 575 pas (`rencontresEtDuels`, « Hors mission »).

**Les plans** : 35 instructions du Cabinet relevées ; avec des statistiques de mille profils (`--stats-production`), **aucune** ne change de plan. Avec celles de la base d'essai, où le fidèle tient presque toute la table, `cabinet_oeuvres` se parcourt en entier (`SCAN`) : un artefact de la base d'essai, que les statistiques de production démentent.

**Le réveil** (`reveil.test.ts`) : `init` avec le Cabinet, 8 allers-retours et 47 instructions ; sans, 8 et 42 — ses trois tables, l'`INSERT … ON CONFLICT DO NOTHING` du secret et sa lecture, dans le premier lot ; sa colonne sans `ALTER` au réveil ordinaire. Préchauffage ouvert : la première page lance tout derrière elle, le premier départ ne coûte plus qu'un aller-retour.

**Le processeur** (vraie base, cœur entier, `mesures/processeur-*.json`) : page chaude d'un musée plein 0,42 ms (18 Ko de JSON avant compression) ; partie relue et sa vue 0,4 à 0,7 ms ; départ 2,1 à 8,6 ms (neuf) ; 6,8 à 15,7 ms pour un joueur qui a vu les quinze mille premières questions de la base — des catégories entières —, sauf l'Éclair, 45 ms, et 49 ms sous « Changer » ; les tas, douze étapes de 49 à 113 ms (constat 1).

**Le poids d'une partie finie** (`mesures/taille.json`) :

| Jeu | Départ figé | Pièces | Bilan | Total | Gestes | Réponses |
|---|---|---|---|---|---|---|
| Pari | 2 597 | 1 322 | 109 | 4 028 | 9 | 3 |
| Éclair | 6 428 | 2 546 | 109 | 9 083 | 6 | 3 |
| Détail | 1 792 | 1 060 | 109 | 2 961 | 6 | 3 |
| Frise | 3 032 | 1 543 | 109 | 4 684 | 6 | 3 |
| Mot | 1 479 | 1 214 | 109 | 2 802 | 6 | 3 |
| Filet | 1 565 | 1 203 | 108 | 2 876 | 6 | 3 |
| Épingle | 2 344 | 1 246 | 108 | 3 698 | 6 | 3 |
| Indices | 2 186 | 974 | 108 | 3 268 | 6 | 3 |
| Réplique | 2 255 | 1 261 | 108 | 3 624 | 9 | 3 |

**Les écritures d'une partie** : le départ 3 lignes (le profil, la partie, l'ouverture) ; un geste 1, plus 2 par pièce (la réponse, la pièce au bout de `questions`) ; la fin 2 ou 3 (le bilan, la poussière et la partie rendue, l'œuvre) et l'expérience 2. Une partie de trois manches : une vingtaine de lignes écrites.

**La mémoire** : `MUSEES_GARDES` 500 et `PARTIES_GARDEES` 200, la plus anciennement servie s'en va ; `aAnnoncer` borné par `MUSEES_GARDES` ; `aReveiller` ne retient que les échecs, vidé au succès ; le plafond des départs s'élague à deux mille clés ; les tas, les tableaux et les frises des sujets se gardent par identité de la liste (`WeakMap`), une seule liste tenue. Une partie en mémoire pèse son départ figé (1,4 à 8,6 Ko) et ses gestes : 200 parties, quelques mégaoctets. Rien ne grandit sans borne.

## Ce qui marche — à ne pas casser

- **Le budget des allers-retours, tenu à la lettre.** Chaque route compte ce que la référence promet, et `cabinet-charge.test.ts` le garde ; le rang qui sert de garde (D9) rend un double toucher gratuit — zéro aller-retour, rien d'écrit.
- **Le lot froid d'un seul aller-retour, borné par construction** : 84 œuvres au plus, les parties du jour sans leur plan (cinq champs d'un seul `json_extract`), la partie en cours par la clé de sa ligne, les saisons par la clé primaire. Le `+mode` des parties du jour tient sous des statistiques qui feraient préférer les sentiers ; sous celles de mille profils, aucun plan ne bouge.
- **Le réveil ne paie rien pour le Cabinet** : ses tables et son secret dans le premier lot, sa colonne par le schéma déjà lu.
- **Les écritures gardées par la base même** : le départ sous `partie IS NULL` et ses droits recomptés dans l'instruction, la dépense sous `SOLDE` et `SANS_PARTIE`, la libre payée décidée par la base ; aucun `UPDATE` ni `DELETE` de `campagne_reponses` dans tout ce que j'ai relevé (les déclencheurs des tranches restent tranquilles).
- **Le journal frais ne se relit pas** au départ (`lireAvecLeJournal([])` sur `derniereReponse`) : c'est précisément ce qui manque à `compagnonsDe` (constat 5).
- **La page chaude ne coûte rien**, et ce qu'elle dérive (le musée, la visite, le prochain gardien) tient en moins d'une demi-milliseconde ; un geste joue le pli pas à pas, jamais de bout en bout.

## Recommandations, dans l'ordre

1. Découper les tas en tranches de deux cents questions, l'intitulé lu une fois — P2 · S (constat 1).
2. Le `+` devant `commencee_le` dans `defiDAccueil`, `tentativeDuDefi`, `tentativeDuDuel`, et `campagne-index.test.ts` étendu à ces formes — P2 · S (constat 2).
3. Les missions ne lisent que les modes qu'elles comptent — P3 · S (constat 3).
4. Garder quelques dizaines de parties finies — P3 · S (constat 4).
5. `compagnonsDe` de la campagne rattrape le journal depuis `derniereReponse` ; l'historique des soirées se garde ou se passe — P3 · S/M (constat 5).
6. L'Éclair ordonne ses catégories par ce qu'il leur reste de frais ; les vues dépliées se gardent par profil — P3 · M (constat 6).
7. Mesurer le poids des pièces avant de les alléger — P3 · M (constat 7).

## Limites

Pas un vrai Turso : les « lignes parcourues » sont des pas de SQLite rejoués sur une copie (environ cinq par ligne), pas les `rows_read` du protocole — l'ordre de grandeur et la pente sont sûrs, le chiffre exact non. Les temps de processeur sont ceux d'un cœur entier, machine partagée (charge 0,5 à 5) ; le dixième de cœur de l'hébergeur n'a pas été bridé ici, et les « ×10 » sont une extrapolation. Le fidèle est fabriqué par les routes sur la base d'essai (intitulés courts), ses œuvres posées à la main ; les poids et les tirages viennent de la vraie base. Deux serveurs pendant une mise en ligne ne sont pas rejoués ici. La page au navigateur n'est pas regardée : ce qu'elle redemande se lit dans son code (`Bilan.tsx`, `Detail.tsx`).

## Hors mission

- **La page des duels d'un joueur sans rencontre parcourt toutes ses parties** (`rencontresEtDuels`, `campagne.ts:5156-5159`) : 1 575 pas pour le fidèle, 19 pour le neuf. Connu de `campagne.md` (« celles du Cabinet comprises ») ; le Cabinet en fait le cas ordinaire.
- **Chaque page du Cabinet relance `porte.jouables()`**, qui relit la réserve du jour entière (`SELECT empreinte FROM jour_reserve`, un `SCAN`) dès que dix minutes ont passé (`JourStore.empreintes`) ; la lecture des missions part en sept allers-retours de front quand `missions.md` en annonce un.
