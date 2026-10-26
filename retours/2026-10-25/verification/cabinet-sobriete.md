# Contre-expertise — `cabinet-sobriete` (base, quota et processeur du Cabinet)

## En bref

Les sept constats tiennent : chaque reproduction rouge a été relancée et rougit pour la raison annoncée, et le chemin du code, relu depuis sa porte d'entrée, n'a aucune garde que l'expert aurait manquée. Je n'en réfute aucun et n'en rétrograde aucun. Ce que j'ajoute porte sur les corrections :

- **Constat 1** : il y a mieux que les tranches seules. Les trois cribles ne dépendent que de la question, et une liste de jouables neuve garde les mêmes objets (`campagne.ts:1600`). Avec leurs verdicts gardés par question, la liste neuve (l'apport du matin, un retrait) ne coûte plus que **0,3 à 1,1 ms par catégorie, contre 53 à 153 ms** aujourd'hui. Seule la première préparation d'un processus reste à couper en tranches : 13,6 ms pour la tranche de 200 la plus chère.
- **Constat 2** : la piste de l'expert (`ORDER BY +commencee_le`) fait de la recherche du défi une lecture de **toutes les tentatives de la semaine, de tous les joueurs** (`idx_campagne_series_defi`). Pour un joueur neuf, c'est 14 → 615 pas sur une salle fictive de 400 profils. `AND +semaine = ?` en plus la mène à l'index des sentiers : seulement ses défis à lui, 177 pas contre 2 993 pour le fidèle. `tentativeDuDuel` retombe dans un piège déjà écrit (`duels.md`, « par le code de son duel, jamais par son profil ») ; sa forme `+profile_id` existe déjà. Et le parcours n'a pas lieu que « sans défi cette semaine » : il a lieu chaque fois, parce que le tri croissant lit d'abord les parties les plus anciennes.

Le constat confirmé le plus grave est le n° 1 (P2). Il ne vit pas en production aujourd'hui, où le Cabinet est fermé (`CABINET_EN_PRODUCTION = false`, `shared/cabinet/ouverture.ts:17`), mais il est à corriger **avant l'ouverture**.

| Constat | Gravité annoncée | Verdict | Gravité retenue | Pourquoi, en une ligne |
|---|---|---|---|---|
| 1 · les tas figent la boucle, douze blocs de 49 à 113 ms | P2 | confirmé | P2 | Rejoué : 3 263 questions en un tour, gel de 84 ms, premier départ d'une liste neuve 1,1 s contre 5 ms. Une fois par jour au moins, à l'ouverture. Correction meilleure : verdicts gardés par question |
| 2 · le défi de l'accueil, `tentativeDuDefi` et `tentativeDuDuel` parcourent toutes les parties du profil | P2 | confirmé | P2 | Rejoué, et le plan est le même sous SQLite 3.45.1 et 3.53.2. La piste de l'expert échange un parcours contre un autre ; `+semaine` et `+profile_id` font mieux |
| 3 · les missions relisent les parties du Cabinet à chaque bilan | P3 | confirmé | P3 | Rejoué (131). Borné par la fenêtre de 14 à 21 jours. `mode IN (…)` ne suffit pas sans l'index `(profile_id, mode, commencee_le)` : vérifié, 3 753 → 126 pas |
| 4 · une partie finie se relit de la base | P3 | confirmé | P3 | Rejoué (2 épreuves). Conforme à la référence et à `cabinet-charge.test.ts:433` : c'est une amélioration, pas une promesse rompue |
| 5 · la fin avec un compagnon fait 5 allers-retours | P3 | confirmé | P3 | Rejoué : le journal est relu 3 fois, l'historique 1 fois |
| 6 · le tirage grandit avec l'histoire ; l'Éclair parcourt une catégorie épuisée | P3 | confirmé | P3 | Rejoué : 7 658 questions contre 25 cette fois-ci, 12 809 contre 31 chez l'expert (la catégorie est tirée au hasard) |
| 7 · le départ figé recopie les questions, les pièces les recopient encore | P3 (idée) | confirmé | P3 | Lu : `ecriture.ts:106-113` et `:186-189`, `mesures/taille.json`. Une idée à mesurer, qui tient |

## Méthode

J'ai relu le rapport et ses tests (`tas-gel`, `defi-accueil`, `missions`, `partie-finie`, `fin-compagnon`, `tirage-parcours`), puis le code depuis ses portes d'entrée : `server.ts:1245-1258` (le préchauffage), `core/cabinet/magasin.ts:670-696` et `:1190-1223`, `core/cabinet/tirages/tas.ts`, `core/cabinet/contenu.ts:104-111`, `core/campagne.ts` (`jouables` :1595-1602, `base` :1190-1209, `appliquerLesCorrections` :10338, `tentativeDuDefi` :3584, `defi` :3642, `tentativeDuDuel` :3899 et ses huit appels, `defiDAccueil` :6172, `activiteDepuis` :3156, les index :1243-1429), `core/jour.ts:740-789` (la réserve qui change le matin), `auth/profileRoutes.ts:203`, `games/quiz.ts:144` et `:1161`, `shared/missions.ts:160-180`, `client/src/components/Gains.tsx:270`, `client/src/views/cabinet/Bilan.tsx:182`, et `server/test/campagne-index.test.ts:43-51`. J'ai aussi relu les règles `cabinet.md`, `campagne.md` (« Une étape de fond par tour de boucle », `LA_PLUS_RECENTE`), `duels.md` (`PAR_SON_CODE`), `jour.md`, `missions.md`, `journaux-et-miroir.md` et `exploitation.md`, `docs/exploitation/exploiter.md` (le quota de Turso), « Les partis pris », et les constats de `retours/2026-10-14/` et `retours/2026-10-16/` pour les précédents de gravité.

Le code a avancé depuis l'expertise (HEAD `3034028`, l'expert lisait `50c327c`). `tas.ts` et `campagne.ts` n'ont pas bougé. `magasin.ts` n'a gagné que la lecture de l'accueil (`accueil`, sans aller-retour), sans rapport avec ces constats.

Relancés un à un sous `nice -n 10`, charge entre 0,05 et 0,3 : `tas-gel`, `defi-accueil`, `missions`, `partie-finie`, `fin-compagnon` et `tirage-parcours`, tous rouges pour la raison annoncée. Ce que j'ai écrit, dans `export/evaluations/verification/cabinet-sobriete/` :

| Fichier | Ce qu'il fait | Résultat |
|---|---|---|
| `tas-memo.test.ts` | les verdicts des trois cribles gardés par question (`WeakMap`) : la première préparation, une liste neuve de 50 questions de moins (l'apport du matin), la tranche de 200 la plus chère ; les tas d'une liste neuve comparés à ceux que donnent les cribles repassés | passe — `rejeu/tas-memo.json` |
| `defi-plans.py` | sur une copie de `mesures/fidele.db` (une base d'essai de l'expert, jamais une vraie), agrandie d'une salle fictive (400 profils de 100 parties, 30 semaines de défis à 100 tentatives, 120 cette semaine, des duels), sans statistiques comme en production : le plan et les pas de SQLite des trois recherches, aujourd'hui, avec la piste de l'expert et avec la mienne | `defi-plans.json` |
| `rejeu/*.json` | les mesures des reproductions relancées | — |

`python3 -I` lie SQLite 3.45.1, la version d'où libsql est parti, et `better-sqlite3` lie la 3.53.2. Les deux choisissent les mêmes plans pour chaque variante.

## 1. Les tas figent la boucle — confirmé, P2

**La reproduction.** L'épreuve 1 de `tas-gel.test.ts` rougit : « un seul tour de boucle passe 3263 questions aux trois cribles du Cabinet ». Elle appelle `preparerLesTas` comme le magasin l'appelle (`magasin.ts:1216`), sur la vraie base (26 394 jouables), à travers la vraie porte. Ce qu'elle épie, `deLaCategorie`, ne change rien au calcul. Mon rejeu, à charge 0,05 : gel de boucle maximal 84 ms, 95ᵉ centile 65 ms (`monitorEventLoopDelay`). Le crible des QCM coûte 66 ms pour Culture générale, celui des mots 27 et celui des valeurs 2. La piste, l'intitulé découpé une fois, ramène 599 ms à 295 et donne les mêmes QCM. Le premier départ d'une liste neuve prend 1 126 ms de mur et 1 193 ms de processeur, contre 5 ms au départ suivant. L'expert avait trouvé 96 ms de gel, 543 → 332 ms et 963 ms, à une charge plus haute.

**Le chemin.** La page du Cabinet lance `cabinet.prechauffer()` après sa réponse (`server.ts:1252-1255`, seulement là où le Cabinet est ouvert). `tasDe` prépare toute liste qui n'est pas la dernière (`magasin.ts:1214-1222`), et le départ l'attend (`:688`). `preparerLesTas` ne rend la main qu'entre deux catégories (`tas.ts:232-235`). `estUnQcmDuCabinet` appelle `ecritDans(q.texte, r)` pour chacune des quatre réponses, et `ecritDans` refait `motsDe(texte)` à chaque appel (`contenu.ts:105`). Aucune garde n'y échappe. La règle de la campagne ne laisse d'un seul tenant que 20 à 30 ms (`campagne.md`, « Une étape de fond par tour de boucle »), et ces étapes durent de 49 à 113 ms. La règle du Cabinet, « une catégorie par tour de boucle », est un choix d'écriture qui n'avait pas mesuré ses étapes. Ce n'est pas un parti pris, et il n'y a pas de tension.

**La réalité.** Une liste neuve naît quand la base, la réserve du jour ou les retraits changent (`campagne.ts:1599`). La réserve change chaque matin, avec l'apport de la routine (`jour.ts:764`, « une réserve qui ne change qu'au matin », `:783`). Elle change aussi à chaque correction ou retrait au QG, et à chaque ajout de la routine à la base (`campagne.ts:1190-1209`). Une fois le Cabinet ouvert, c'est donc au moins une fois par jour, plus chaque réveil. Au dixième de cœur, la préparation fait de l'ordre de neuf secondes de serveur saturé, en blocs de 0,5 à 1,1 s, et le premier joueur à toucher « Commencer » attend ce qu'il en reste. Une soirée n'y passe que par un concours de circonstances : la première page du Cabinet de la journée, ou un retrait au QG, pendant qu'elle se joue. Même alors, `GRACE_MS` (1,5 s, `quiz.ts:144`) absorbe presque tout. Seul un gel qui chevauche la fin de la grâce peut faire juger trop tard une réponse de la dernière seconde, puisque la minuterie passe avant les entrées de la boucle. Les précédents vont dans le même sens : 1,6 s de processeur à chaque réveil a été classé P2 (`retours/2026-10-16`, perf-gel-9), et les sujets comptés d'un bloc au réveil, P1 (perf-gel-7). En production, aujourd'hui, rien ne se passe : le Cabinet est fermé, et `server.ts:1252` ne monte pas son préchauffage. En préproduction, cela arrive à chaque réveil. P2 tient, comme condition de l'ouverture.

**Une meilleure correction.** Les trois cribles ne dépendent que de la question. Une liste neuve est `base.questions.filter(…)` (`campagne.ts:1600`), faite des mêmes objets, sauf la question corrigée, qui en est un neuf (`appliquerLesCorrections`, `:10338-10346`). `BaseDeLaCampagne` garde les objets tels quels (`baseCampagne.ts:489-492`). Il suffit donc de garder le verdict de chaque question :

```ts
const VERDICTS = new WeakMap<QuestionDeLaBase, { qcm: boolean; mot: boolean; valeur: boolean }>()
const verdictDe = (q: QuestionDeLaBase) => {
  let v = VERDICTS.get(q)
  if (!v) VERDICTS.set(q, (v = { qcm: estUnQcmDuCabinet(q), mot: motDeLaQuestion(q) !== null, valeur: valeurDuFilet(q) !== null }))
  return v
}
```

`tas-memo.test.ts` le mesure : une liste neuve ne coûte plus que 0,3 à 1,1 ms par catégorie, contre 53 à 153 ms, et donne des tas identiques. Seule la première préparation d'un processus passe encore toute la base au crible. Celle-là, on la coupe en tranches de `QUESTIONS_PAR_TRANCHE` par `rendreLaMain` (la piste de l'expert) : 13,6 ms pour la tranche la plus chère, dans le budget. On garde aussi l'intitulé découpé une fois, mais par une fonction exportée de `contenu.ts` (`ecritDansLesMots(mots, nom)`), pas par une copie de `motsDe`, que `cabinet-code-10` relève déjà. `contenuDuCabinet()` (46 ms, avec `tableauxDuDetail()` dans le même tour, `tas.ts:236-238`) mérite son tour à lui. **L'épreuve de l'expert** compte les questions remises à chaque tour, pas le travail fait. Avec cette correction, elle resterait rouge alors qu'une liste neuve coûterait moins de 2 ms. Mieux vaut compter les appels aux cribles par tour.

## 2. Les trois recherches de tentative — confirmé, P2 (une autre correction)

**La reproduction.** `defi-accueil.test.ts` rougit. La lecture est trouvée dans ce que l'accueil envoie vraiment (`/api/joueur/moi?accueil`), et son plan est lu sur la base du banc : `SEARCH campagne_series USING INDEX idx_campagne_series_profil (profile_id=?)`. `defi-plans.py` le rejoue sur une salle fictive :

| La lecture | Aujourd'hui | `+commencee_le` (l'expert) | `+semaine` et `+commencee_le` |
|---|---|---|---|
| défi, le fidèle (580 parties), sans tentative | 2 993 pas · `idx_profil` | 628 · `idx_defi` (les 120 tentatives de la semaine) | **177** · `idx_sentiers (profile_id, mode)` |
| défi, sa semaine passée (la page du défi) | 2 979 | 533 | **178** |
| défi, un autre (101 parties), qui a sa tentative | 580 | 629 | **184** |
| défi, un neuf | 14 | **615** | 15 |
| duel, le fidèle, un de ses duels | 1 367 · `idx_profil` | 87 · `idx_duel` | 82 · `idx_duel` (`+profile_id`) |
| duel, un duel sans sa tentative | 2 994 | 20 | 20 |

Deux précisions. D'abord, le parcours n'a pas lieu que « sans défi cette semaine » : trié par `commencee_le` croissant, l'index du profil lit d'abord les parties les plus anciennes, avant la tentative de la semaine. Celui qui l'a la trouve donc en dernier. Ensuite, la piste de l'expert échange un parcours contre un autre. Elle mène à `(mode, semaine)` : chaque accueil lit toutes les tentatives de la semaine, de tous les joueurs (la première sous-requête les lit déjà), et le joueur neuf passe de 14 à 615 pas.

**Le chemin.** `defiDAccueil` part à chaque accueil, sans mémoire (`profileRoutes.ts:203`, `campagne.ts:6172-6188`). `tentativeDuDefi` part à chaque départ du défi (`:3601`) et deux fois par page du défi (`:3646`, `:3648`). `tentativeDuDuel` part à la page d'un duel (deux fois, `:4181`, `:4187`), au relevé (`:4146`), à la fin d'un duel classé (`enFaceDuDuel`, `:3889`), à la correction (`joueDesDeuxCotes`, `:3876`), et pour le score à battre (`:3865`, gardé ensuite). `campagne-index.test.ts` ne lit que les recherches qui portent `finie_le IS NULL` (`:51`), et `duels-index.test.ts` que les jointures. `tentativeDuDuel` est donc le piège de `duels.md` (« Une tentative se cherche par le code de son duel, jamais par son profil ») retombé sur un chemin que son test ne lit pas.

**La réalité.** Turso compte les lignes parcourues, et son quota gratuit de 500 millions par mois est commun à la production, à la préproduction et aux scripts (`docs/exploitation/exploiter.md`). Le 22 octobre, 333 millions avaient déjà été lus, par des lectures de cette sorte : « leur coût grandissait avec elle ». Le parti pris 5 (zéro euro) interdit d'en sortir par une offre payante. La lecture grandit avec toute l'histoire du joueur, tous modes confondus, en production déjà ; le Cabinet y ajoute dix parties par jour. Pour cent réguliers à dix accueils par jour, c'est de l'ordre de 22 % du quota mensuel au bout d'un an de Cabinet, et 7 % pour trente. Aucun joueur ne le sent, mais c'est la pente même qui a mené à l'incident. P2 tient.

**Une meilleure correction.** Pour le défi (`defiDAccueil` et `tentativeDuDefi`), `WHERE profile_id = ? AND mode = 'defi' AND +semaine = ? ORDER BY +commencee_le LIMIT 1` : l'index des sentiers ne mène qu'à ses défis, un par semaine au plus. Pour le duel, la forme de `duels.md` : `WHERE +profile_id = ? AND mode = 'duel' AND duel = ? ORDER BY +commencee_le LIMIT 1`, qui rend les deux tentatives du duel au plus. Une autre voie existe : un index `(profile_id, mode, commencee_le)` servirait le défi sans `+` et le constat 3 avec. Mais il changerait les plans d'autres lectures, que `cabinet-index.test.ts` et `campagne-index.test.ts` devraient relire, et le duel resterait mieux servi par `idx_duel`. Il faut aussi étendre `campagne-index.test.ts` à toute recherche « `profile_id = ?`, un mode, `ORDER BY commencee_le` », avec ou sans `finie_le`, et `duels-index.test.ts` à `tentativeDuDuel`.

## 3. Les missions relisent les parties du Cabinet — confirmé, P3

`missions.test.ts` rougit : « les missions relisent 131 parties du Cabinet qu'elles ne comptent pas, à chaque bilan ». Le chemin tient. Le bilan pose `MissionsAccomplies` (`Bilan.tsx:182`, `Gains.tsx:270`), qui redemande les missions, et l'accueil aussi (`DEPART.missions`). `activiteDepuis` lit toutes les séries de la fenêtre (`campagne.ts:3159-3161`), et `activiteDesJours` n'en compte que cinq modes (`shared/missions.ts:172-180`). Les séries et les révisions y sont lues pour rien elles aussi : les réponses arrivent par ailleurs. La lecture est bornée par la fenêtre, de 14 à 21 jours, et ne grandit pas avec l'histoire : P3 tient. J'ai vérifié la piste sur une copie : `mode IN ('duel','rencontre','sentier','sujet','defi')` seul ne change rien, il garde l'index du profil (3 753 → 2 859 pas). Avec un index `(profile_id, mode, commencee_le)`, on tombe à 126 pas. L'expert a raison : il faut l'index.

## 4 à 7 — un coup d'œil : ils tiennent

- **4. La partie finie relue** : `partie-finie.test.ts` rougit sur ses deux épreuves (l'image d'après la fin, 1 aller-retour ; le cartel rouvert, 1 aller-retour). C'est le budget écrit, « finie, un, par sa clé », que `cabinet-charge.test.ts:433` garde : une amélioration, pas une promesse rompue. La mémoire des parties finies devra se vider avec `oublierProfil`, et rester bornée. Entre deux serveurs, elle ne risque rien : une partie finie ne change plus.
- **5. La fin avec un compagnon** : `fin-compagnon.test.ts` rougit (5 allers-retours, le journal relu 3 fois, l'historique 1 fois). `rattraperLeJournal(this.derniereReponse)` tient, sur le modèle de la porte.
- **6. Le tirage et l'Éclair** : `tirage-parcours.test.ts` rougit, à 7 658 questions examinées contre 25 cette fois (12 809 contre 31 chez l'expert : la catégorie de l'Éclair est tirée au hasard, d'où l'écart). Le versant fraîcheur touche l'angle de `cabinet-equilibre`, qui ne l'a pas relevé : ce n'est pas un doublon.
- **7. Le poids d'une partie** : lu, `ecriture.ts:106-113` (le départ figé dans `cabinet`) et `:186-189` (chaque pièce ajoutée à `questions`), plus `mesures/taille.json`. Une idée à mesurer, qui tient.

## Les doublons

Aucun. Rien de tel dans `cabinet-code`, `cabinet-equilibre` ni `cabinet-triche`. `cabinet-code-10` (les copies de `motsDe`) touche seulement la piste du constat 1 : à en tenir compte en la codant. `retours/2026-09-2*` à `2026-10-24` n'ont rien sur ces lectures. `LA_PLUS_RECENTE` (`campagne.md`) et `PAR_SON_CODE` (`duels.md`) sont des corrections voisines, qui ne couvrent pas ces trois recherches.

## Hors constat

- **La même lecture de l'accueil parcourt aussi tous les profils** : la première sous-requête de `defiDAccueil` (`profile_id IN (SELECT id FROM profiles WHERE disabled_at IS NULL)`, `campagne.ts:6177`) se joue `LIST SUBQUERY 1 / SCAN profiles`. Chaque accueil de chaque profil lit donc toute la table des profils, chez le neuf comme chez le fidèle. Un `EXISTS (SELECT 1 FROM profiles p WHERE p.id = s.profile_id AND p.disabled_at IS NULL)` corrélé n'y cherche que les profils des tentatives de la semaine, par leur clé : sur la salle fictive, 401 profils lus deviennent 120 recherches, et 4 265 pas deviennent 2 788 (`defi-plans.json`). À corriger avec le constat 2, dans la même instruction.
- **Les mesures de l'expert** : relancer `tas-gel.test.ts` a récrit `export/evaluations/cabinet-sobriete/mesures/tas-{gel,cribles,piste,premier-depart}.json` avec mes chiffres, et les siens restent dans son rapport. J'ai remis ses originaux pour `defi-accueil`, `missions`, `partie-finie`, `fin-compagnon` et `tirage-parcours`. Mes mesures sont dans `verification/cabinet-sobriete/rejeu/`.

Rien n'est resté allumé, et aucun fichier suivi par git n'a changé.
