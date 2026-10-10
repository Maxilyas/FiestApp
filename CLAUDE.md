# Notes pour Claude

Quiz de soirée façon Kahoot, auto-hébergé. Les invités jouent depuis leur
téléphone, un écran commun anime la salle. Plusieurs animateurs partagent le
serveur : chacun a **son compte et son espace**, et ne voit rien de ceux des
autres.

Le `README.md` explique le produit à un humain. Ce fichier-ci dit à un agent ce
qui vaut partout dans le code ; le détail de chaque domaine vit dans sa règle
(`.claude/rules/`), qui arrive d'elle-même quand tu ouvres un de ses fichiers.

## Comment travailler ici

- **Lis le code avec l'outil Read, modifie-le avec Edit ou Write**, jamais par le shell (`cat`, `head`, `sed`, une redirection) : c'est Read qui charge la règle du domaine (son `paths:`), et par le shell elle n'arrive pas. Pour un domaine sans fichier ouvert, lis sa règle directement (la carte plus bas).
- **Les gros documents se fouillent, ils ne se lisent pas d'un bloc** : `README.md`, `RECOMPENSES.md`, `MISE-EN-LIGNE.md` et `PARCOURS-ENTREE.md` font chacun plus de 40 Ko — Grep d'abord, puis Read sur la section.
- **Une recherche large passe par l'agent Explore** : il ne charge pas ce fichier et garde le contexte principal propre.
- **`npm run verify` dure une dizaine de minutes** : lance-le en arrière-plan. Lancés par Claude Code (`CLAUDECODE=1`), les tests de `npm test` répondent en points (`dot`) et n'impriment en entier que les échecs ; pour les journaux d'un fichier en échec, relance-le seul : `cd server && node --import tsx --test --test-reporter=spec test/<fichier>.test.ts`.
- **Regarde le rendu** : plusieurs bugs de cette base n'étaient visibles qu'à l'écran — la skill `regarder-le-rendu` dit les tailles et les scripts. Les autres procédures en plusieurs étapes sont aussi des skills : `peindre`, `base-campagne`, `tablee`.
- **Une connaissance nouvelle va dans la règle de son domaine**, pas ici : ce fichier ne change que pour une commande, un invariant ou une convention de tout le dépôt (`notes-pour-claude.test.ts` le garde sous 200 lignes et vérifie les chemins des règles).

## Les commandes

```bash
npm run verify     # typecheck + tests + build + test de bout en bout — À LANCER AVANT DE COMMITTER
npm run dev        # serveur + client, http://localhost:5173
npm test           # les tests ciblés de server/test/ (node:test, quatre à cinq minutes)
npm run smoke      # le test de bout en bout seul (~90 s)
npm run sauvegarde # la base permanente en SQL daté, dans export/sauvegardes/
npm run tablee     # une soirée jouée par des agents (régie + /tablee) : voir .claude/skills/tablee/
npm run mesure     # ce que chaque page fait attendre à un téléphone (client construit d'abord) : voir server/scripts/mesure-pages.ts
```

Deux suites, aucune dépendance de plus, et toujours ni linter ni formateur.
`npm run smoke` boote un vrai serveur sur une base jetable et rejoue une
soirée entière : c'est la référence du chemin normal. `npm test` lance
`server/test/*.test.ts` avec `node:test` : ce qu'une soirée rejouée d'un bout
à l'autre ne provoque jamais — pannes, courses, messages malformés,
redémarrages. Chaque fichier qui a besoin d'un serveur démarre le sien,
jetable, avec `server/test/banc.ts` ; le moteur seul, horloge à la main,
se joue avec `server/test/salle.ts` — pour viser un instant qu'un vrai
serveur ne laisse pas choisir (le souffle, une pause, un intertitre) ; les
dérivations pures se testent directement. **Un nouveau comportement arrive avec son test dans
`server/test/`**, qui échoue avant la correction : on n'allonge plus le smoke.

## La carte du code

```
shared/     types et fonctions PURES, partagés client ↔ serveur ↔ test
server/src/core/    les registres et le moteur
server/src/games/   les règles du quiz
client/src/views/   une page = un fichier
server/test/        un fichier par thème, un serveur jetable chacun
```

Dans les règles, `core/`, `games/` et `auth/` sont sous `server/src/` ; `components/` et `views/` sous `client/src/`.

| Le domaine | Sa règle, dans `.claude/rules/` |
|---|---|
| Le quiz : ses règles, son barème, ses vues, le classement, les équipes | `soiree-moteur.md` |
| La salle : la liaison temps réel, les invités, les salons, la barre du chef | `soiree-salle.md` |
| La fin de soirée, les crédits, l'historique, le souvenir et le bilan | `cloture-et-archives.md` |
| Les deux bases, les journaux, le miroir Turso, le démarrage | `journaux-et-miroir.md` |
| L'expérience, les hauts faits, les légendaires, les Divins, le recalcul | `recompenses.md` |
| Les avatars peints, la lumière, les portraits des branches | `medaillons.md` |
| Le profil, l'accueil, la carte d'un joueur, la collection | `profil.md` |
| Les thèmes, les fonds, les gerbes, la boutique · le CSS | `themes.md` · `css.md` |
| L'écran commun (`/host`) | `ecran-commun.md` |
| Ce que la page charge : l'entrée, la navigation, le préchargement | `client.md` |
| Le quiz du jour · sa réserve · le rappel du soir et l'installation | `jour.md` · `jour-reserve.md` · `rappel-et-installation.md` |
| La campagne et le défi · sa base · les sentiers du savoir | `campagne.md` · `campagne-base.md` · `sentiers.md` |
| Les quiz : l'éditeur, la liste collée, l'import, le partage | `bibliotheque.md` |
| Les comptes, les profils, les sessions, la télé, l'administration | `auth-et-admin.md` |
| La mise en ligne : Render, le paquet, `/healthz` | `exploitation.md` |
| Les tests · la tablée · les images peintes | `tests.md` · `tablee.md` · `peintures.md` |

## Les invariants — à ne jamais casser

1. **La logique de jeu est 100 % serveur.** Les clients reçoivent `playerView` / `hostView`, jamais l'état brut : sinon la bonne réponse arrive dans le téléphone avant la révélation. Ce qui la trahit aussi : l'anecdote, la photo de la révélation, les bonnes réponses de « plusieurs » et le bon ordre n'arrivent qu'à la révélation ; la note de l'animateur, l'extrait d'un blind test et le programme de la soirée ne partent jamais aux téléphones.
2. **Deux bases, deux rôles.** La locale (SQLite) est **jetable** et « Nouvelle soirée » la vide. Ce qui doit survivre — comptes, quiz, archives, profils — va dans la permanente (libsql/Turso).
3. **Tout est cloisonné par `space_id`.** Un identifiant qui n'est pas du sien vaut « introuvable », et le voisin n'en sait rien.
4. **L'instantané est dédoublonné et regroupé** (`space.ts`). N'y mets jamais un champ qui change à chaque tick : il partirait à toute la salle. Il en part deux versions — celle des écrans d'animateur (wifi, scène, télécommande) et celle des téléphones, sans `connected` —, regroupées (120 ms + 2 ms par invité pour les téléphones) ; celui qui fait le geste reçoit la sienne sur-le-champ. Le détail : `soiree-salle.md`.
5. **Les chronomètres sont persistés** et réarmés au redémarrage.
6. **Une échéance se lit à `serverNow()`**, jamais à `Date.now()` : l'horloge d'un téléphone dérive, et on a déjà perdu des réponses pour ça. Elle saute aussi : deux mesures qui ne peuvent pas être vraies ensemble font gagner la plus récente, même plus lente (`bestSample`, `shared/clock.ts`).
7. **Toute réponse d'invité reçoit un accusé**, et **tout message d'un client passe par `ecouter()`** (`sockets.ts`) : la charge devient un objet, l'accusé une fonction, l'exception un journal. Un seul `player:action` sans charge, un seul `party:watch` sans accusé tuait le processus — et les soirées de tous les espaces avec.
8. **Un profil ne donne aucun avantage de jeu**, et un invité anonyme n'affiche **rien** : ni « Niv. 0 », ni pastille grise. L'absence, pas l'infériorité. Un profil reconnu, en revanche, **ne rechoisit jamais** son prénom ni son avatar : `player:join` sans `name` ni `avatar` les prend dans le profil.
9. **La fiche du serveur fait foi.** Un `player:join` qui porte un jeton est une re-présentation : prénom et avatar envoyés sont ignorés. Un jeton qui ne désigne plus personne est refusé (`unknown-token`), **jamais recréé** ; un nouveau téléphone ne prend le jeton d'une fiche que par le code que l'animateur fait paraître (`player:reprendre`). Le détail (second appareil, soirée close) : `soiree-salle.md`.
10. **L'expérience d'un quiz se crédite dès qu'il rend son verdict**, à la fin de la partie si quelque chose a changé, puis une dernière fois à la clôture : la ligne `(profil, soirée)` est remplacée, jamais ajoutée. Un invité exclu rend la sienne. Ce qui ne se juge qu'une fois tout joué — podium de la soirée, assiduité, prix, hauts faits, paliers — ne se décide **qu'à la clôture**, en un seul lot (`remplacerRecompensesDeSoiree`). Le détail : `cloture-et-archives.md`.
11. **Le nom d'une soirée se tire une fois** (`soireeEnCours`) et ne se recalcule jamais — recalculé, il comptait l'expérience deux fois et dédoublait l'archive. Toute écriture permanente sous ce nom passe d'abord par `recopierSoiree`, et il se date à sa première question jouée. Le détail : `cloture-et-archives.md`.
12. **Un geste dit ce qu'il visait.** Les commandes `next`, `cancel`, `replay` et les réponses portent la phase, la question et le tour (`host:scene`, l'écran qu'il quittait ; `host:launch`, la partie qu'il remplace) : une commande périmée est ignorée en silence, une réponse périmée reçoit `too-late`, et un champ absent (une page d'avant) garde l'ancien comportement. Sans ça, un « Révéler » qui croisait la révélation automatique sautait la révélation.
13. **Rien ne se perd en route vers le miroir.** Chaque écriture de la soirée rejoint la file de son espace, ordonnée, qui insiste jusqu'au succès ; gains et réponses portent un `uid` tiré en local, pour un rejeu sans doublon ; un `run()` envoie l'état de la partie **avec** ses gains et ses réponses, en un seul lot (`ouvrirLot` / `fermerLot`) — sinon un arrêt brutal faisait payer une question deux fois. La clôture efface le miroir **avant** la base locale.
14. **Les dérivations restent pures.** La soirée en cours et une archive passent par le même chemin — une amélioration profite aux soirées passées.
15. **Un classement passe par `shared/classement.ts`.** Rang = 1 + le nombre de concurrents strictement devant ; tous les ex æquo en tête gagnent. Cinq règles de départage différentes donnaient trois vainqueurs à un même quiz. Deux estimations se comparent par `ecartEstimation`, jamais par `Math.abs(valeur - cible)` : la virgule flottante séparait 0,7 et 0,9 pour 0,8, et le barème au rang payait l'un 200 points et l'autre 30.
16. **Une personne, deux tables — et `accounts.id` ne bouge jamais.** Un compte est un **espace** (son identifiant cloisonne tout le reste), un profil une **personne** ; `accounts.profile_id` dit qui tient l'espace. Ne fusionne pas les deux tables : l'identifiant d'un compte est la clé de partition de dix tables et de toutes les archives. Les sessions, la télé branchée et les preuves à donner : `auth-et-admin.md`.
17. **Les homonymes se règlent à l'affichage, jamais à la saisie.** On ne refuse personne et on ne renomme personne : `nomsAffiches()` marque « Camille (2) » quand le prénom **et** l'avatar sont partagés, et cette marque n'est **jamais** écrite en base — elle s'efface d'elle-même quand l'homonyme s'en va. Un prénom sort par trois portes (`publicPlayers`, `publicOne`, `ViewContext.playerName`) : c'est la troisième qu'on oublie, et c'est elle qui écrit sur le vidéoprojecteur.
18. **L'historique s'écrit tout seul, et la soirée n'a qu'un geste de fin.** Elle se range après chaque quiz (`apresQuiz`) ; `host:closeParty` la clôt, `host:discardParty` efface un essai avec tout ce qu'il avait crédité. **Une seule fin à la fois** (`finEnRoute`), et la fin de soirée ne part qu'une fois la soirée effacée. Le détail (salon du chef, `recap.json`, reprise) : `cloture-et-archives.md`.
19. **L'expérience se mérite, et ne redescend jamais en cours de soirée.** En soirée, rien pour la présence, rien seul : tout se gagne dès deux joueurs, un podium de quiz dès cinq questions, celui de la soirée dès quinze (`SEUILS`), et un podium a toujours une marche de moins que la salle ; une soirée jouée seul ne compte pas (`soireeQuiCompte`). Les gains d'un quiz sont définitifs ; ce qui peut se renverser attend la clôture. **Un prix** — du palmarès ou remis à l'écran — **ne rapporte jamais d'expérience** ; un podium, si. Le détail : `recompenses.md`.
20. **Les récompenses sont des dérivations des journaux.** Quand le barème ou un haut fait change, incrémente `VERSION_BAREME` : au démarrage, `recalculerHistorique` relit l'historique avec les règles du jour. Une version s'écrit en entier (`CAST(? AS INTEGER)`), et une base qui hoquette pendant la relecture fait échouer le démarrage. Le détail : `recompenses.md`.
21. **Les règles des Divins ne quittent jamais le serveur.** Elles vivent dans `core/divins.ts`, avec leurs légendes — qui en disent presque autant —, et ni `shared/` ni `client/` ne l'importent ni n'en recopient une ligne (`divins.test.ts` y veille). Le serveur n'envoie que la liste des Divins descendus, le récit à leur seul porteur — pas de jauge, pas de progression, pas de ligne d'étagère (`badgesOf` les écarte), pas même un compte de badges qui bougerait. Un Divin ne prend ni finition ni Éclat.
22. **Durcir un légendaire, la courbe des niveaux ou les seuils des branches ne reprend rien à personne.** Une règle qui se durcit ajoute une entrée — à `DURCISSEMENTS`, à `COURBES_D_AVANT`, avec un drapeau neuf dans `meta` — et n'en modifie jamais une ; un palier validé ne se perd jamais. **Tout niveau d'un profil passe par `niveauDuProfil`.** Le détail : `recompenses.md`.

## Les conventions

- **Commentaires en français**, et ils disent **pourquoi**, pas *quoi*. Un commentaire qui paraphrase le code est du bruit ; un commentaire qui raconte la décision ou le bug évité vaut de l'or. C'est la marque du dépôt : garde-la.
- Noms : anglais pour l'infrastructure historique (`Party`, `ScoreLedger`), français pour le domaine récent (`Finition`, `niveauPour`, `Carriere`).
- **Très peu de dépendances**, et c'est voulu. N'en ajoute pas sans raison forte.
- **Emojis antérieurs à Unicode 13 uniquement** : l'écran commun tourne sous Windows 10, les plus récents s'y affichent en carré vide (`emojis.test.ts` y veille, pour `client/`, `shared/`, `server/src/` et les quiz livrés de `server/content/`).
- Les messages d'erreur sont lus par des invités dans le noir : courts, en français, et ils disent quoi faire.
- **Une erreur faite pour être lue se lève avec un `new Error('…')` nu**, sans `code`. Toute autre classe (LibsqlError, TypeError…) devient un 500 neutre dans une route (`repondreErreur`) ou « Erreur serveur » dans un toast de l'écran commun (`messagePourEcran`), et son détail part au journal.
- **Un texte se coupe avec `tronquer()`** (`shared/avatars.ts`), jamais avec `slice()` : un emoji à la frontière laissait sa moitié en base.
- **Un nombre tapé se lit avec `lireNombre()`** (`shared/nombres.ts`), jamais avec `Number()` : « 35 000 » valait NaN au téléphone, et l'éditeur, qui relisait sa cible à chaque touche, faisait 8 de « 0,8 ». Le champ garde le texte tapé ; seule la valeur lue part en base. Un entier borné se tape dans `ChampNombre` (`client/src/components/`) : vidé, `Number('')` valait 0, la valeur revenait, et le 45 tapé derrière faisait « 2045 » — les bornes s'appliquent en quittant le champ, jamais à chaque frappe.
- **Une précision ne compte que les QCM, et dit sur combien** (« 50 % · 1 sur 2 QCM ») : une estimation n'est jamais « juste », et comptée au dénominateur elle faisait lire « 1/64 justes ». **Une estimation se juge au coup d'œil** (`coupDOeil`, `core/journal.ts`) — la part de la salle qu'elle bat ou égale —, jamais à l'écart en pour cent : trois ans sur 1994 font 0,15 %, trois sur 54 en font 6 %, et une faute de frappe triplait la moyenne. Les deux ne se fondent jamais en un seul chiffre.
- **Tout accès au stockage du navigateur sous try/catch** — des cookies bloqués donnaient une page noire.
- Les conventions d'un seul domaine vivent dans sa règle : les jetons CSS (`css.md`), `vctx.memo` pour ce qui ne dépend pas du destinataire d'une vue (`soiree-moteur.md`).

## Les deux environnements

Deux services Render, la production (déployée à la main) et la préproduction (à chaque fusion sur `main`), qui ne diffèrent que par `QUIZ_DB_URL` : tout le précieux est dans Turso, la base locale est jetable. Leur tableau de bord fait foi, `render.yaml` n'en est que la référence. Leurs noms, leur démarrage, la veille et le quota : `exploitation.md`.

**Jamais la même base Turso pour les deux** : un « C'était un essai » en préproduction effacerait de vraies soirées archivées. Hors production, `APP_ENV` pose un bandeau sur toutes les pages (injecté dans `index.html` par `server.ts`, affiché par `main.tsx`). En ligne, le serveur refuse de démarrer sans `QUIZ_DB_URL`.

## Les pièges qui valent partout

- **`package-lock.json` bouge tout seul** selon la version de npm. Ne le committe pas si ce n'est pas le sujet (le hook installe en `--no-save`).
- `retours/<date>/synthese.md` — ce qu'une tablée a trouvé : les axes d'amélioration, vérifiés un à un, et les retours bruts des agents — à lire avant de retoucher un écran qu'ils citent. Un audit de code y range aussi tous ses constats et leur verdict (`constats.json`) et les épreuves qui les prouvent (`reproductions/`) : `retours/2026-09-27/` pour #58 et #59

## Ce qu'il ne faut pas faire

- Toucher aux barèmes (`CHOICE_POINTS`, `SPEED_BONUS`, `LECTURE_MS…`, `PROXIMITY_POINTS`, `CRANS_TOLERES`, `XP`, `SEUILS`, `XP_PAR_PALIER`, `XP_PALIER`, l'expérience des hauts faits, `CHANCE_ECLAT`, `CHANCE_ECLAT_DU_JOUR`, `CHANCE_ECLAT_DU_DEFI`…) sans le dire : ce sont des choix de produit, pas des constantes techniques — et sans incrémenter `VERSION_BAREME`, l'historique garderait l'ancien. Le barème du solo de même (`XP_MAX_DU_JOUR`, `XP_PODIUM_DU_JOUR`, `XP_PAR_JOUR_DE_SERIE`, `XP_DE_SERIE_MAX`, `XP_PAR_JUSTE`, `JUSTES_DOUBLEES_PAR_JOUR`, `XP_D_UN_PALIER`, `XP_DU_MAITRE`…) : la campagne et les paliers se relisent de leurs journaux, mais les parties du jour figent leur expérience — un barème changé se recompte une fois, sous un drapeau neuf (`core/baremeDuSolo.ts`), ou l'historique garde l'ancien. Les points d'une question, eux, sont écrits au journal et ne se recalculent jamais : une soirée jouée garde le barème de son soir, et `VERSION_BAREME` relit seulement ce qui s'en dérive. `calibrage.ts` joue avec les vraies formules (`pointsDuChoix`, `pointsDesEstimations`) : il mesure ce qu'un nouveau barème fait aux niveaux et aux légendaires.
- Changer les prix des thèmes (`PRIX_DES_THEMES`) ou la règle des confettis (`confettisDeSoiree`, `CONFETTIS_DES_ETOILES`) sans le dire : des choix de produit. Les confettis se relisent à chaque lecture — une règle changée change d'un coup, rétroactivement, le solde de tout le monde —, et un achat garde le prix qu'il a payé.
- Changer les mélanges ou les seuils des paliers des sentiers (`PALIERS`, `SEUIL_DES_PALIERS`, `SEUIL_DU_MAITRE`), les vies du jour ou le prix d'une vie (`VIES_PAR_JOUR`, `PRIX_D_UNE_VIE`) sans le dire : des choix de produit, calculés par `calibrage-sentiers.ts` et relus sur les vraies épreuves (`/admin#campagne`). Un seuil changé ne vaut que pour les épreuves qui commencent — celle en cours garde le sien —, et un palier validé ne se reprend jamais.
- Changer les seuils des récompenses du quiz du jour et de la campagne (`SEUILS_DU_LAURIER`, `JOURS_POUR_UNE_PAGE`, `SALLE_DU_JOUR`, `PRIX_D_UN_SABLIER`, `SABLIERS_MAX`, `FUNAMBULE`, `GRANDE_SERIE`, `RECORD_DU_TOUR_DU_MONDE`, `JOUEURS_POUR_LE_DEFI`, les paliers de L'Élite, de L'Infatigable, de L'Alpiniste, de L'Érudit et du Marathonien) sans le dire : des choix de produit. Les jours et les séries d'avant ne se relisent qu'à leur version (`VERSION_DES_JOURS`, `VERSION_DES_SERIES`) : une règle changée la fait monter, ou l'historique garde l'ancienne.
- Bouger le seuil d'un légendaire ou la courbe des niveaux (`XP_PAR_PALIER`) sans le mesurer ni le dire. Ce sont aussi des choix de produit, mesurés par `calibrage.ts` ; ils se relisent à chaque lecture, sans `VERSION_BAREME`, et ne se durcissent jamais sans leur entrée à `DURCISSEMENTS` ou à `COURBES_D_AVANT` (invariant 22).
- Rendre la connexion obligatoire. L'entrée d'une soirée et l'accueil s'ouvrent sur trois gros boutons du même format, « Jouer sans compte » d'abord, visibles **sans défiler** en 360 × 640 (`connexion-claire.test.ts`), et aucun champ n'a d'`autoFocus` : le clavier pousserait le bouton hors de l'écran. **Le chemin anonyme reste la valeur de l'application.** Le détail : `client.md`.
- Supprimer ou désactiver une assertion — du smoke ou d'un test — pour la faire passer.

## Quand la conversation se compacte

Garde la liste des fichiers modifiés, les tests lancés et leur verdict, et les invariants que la tâche touche.
