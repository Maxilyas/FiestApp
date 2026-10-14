# Les conventions

> Comment le code de FiestApp s'écrit : la langue, les commentaires, les dépendances, les textes que lisent les invités, et les quelques fonctions par lesquelles tout passe. Pour qui modifie le code, humain ou agent.

Ces conventions ne sont pas des goûts : chacune est née d'un bug, d'une plainte d'invité ou d'une mesure. Les agents les retrouvent dans `CLAUDE.md` ; cette page les explique.

## La langue et les noms

- **Le domaine se nomme en français**, l'infrastructure historique en anglais. On lit donc `Party`, `ScoreLedger`, `GameEngine` ou `SpaceRuntime` à côté de `Finition`, `niveauPour`, `Carriere`, `cloreLaSoiree` ou `recopierSoiree`. Un module neuf du domaine prend un nom français, comme les mots que l'application montre.
- **Les commentaires sont en français**, comme les messages de commit, les propositions de modification et cette documentation.
- **Les identifiants disent la chose comme l'application la dit** : une « soirée » est une `soiree`, un « salon » un salon, une « épreuve » une `epreuve`. Le [glossaire](../reference/glossaire.md) fait le lien entre les deux vocabulaires.

## Les commentaires disent pourquoi

Un commentaire qui paraphrase le code est du bruit. Un commentaire qui raconte la décision, ou le bug qu'il évite, vaut de l'or : c'est la marque du dépôt. On y écrit ce qu'on aurait voulu savoir avant de toucher la ligne :

```ts
// Une échéance se lit à l'heure du serveur, jamais à celle du téléphone :
// une horloge qui dérive affichait du temps qui n'existait plus, et la
// réponse envoyée dans ce temps-là était perdue.
```

Un commentaire peut dater un choix (« le choix du 3 octobre 2026 ») ou renvoyer au rapport qui l'a motivé (`retours/2026-10-05/affichage-des-pages.md`) : c'est ce qui permet, des mois plus tard, de savoir si la raison tient encore.

## Peu de dépendances, et c'est voulu

Le serveur dépend de six paquets (`@libsql/client`, `better-sqlite3`, `compression`, `express`, `socket.io`, `tsx`), le client de quatre (`react`, `react-dom`, `socket.io-client`, `qrcode.react`) — voir `server/package.json` et `client/package.json`. Le Web Push du rappel du soir est écrit sans bibliothèque (`server/src/core/pousser.ts`), les nombres s'écrivent sans `Intl` (`formatNumber`, `shared/typographie.ts`).

Une dépendance de plus se justifie : chacune pèse sur le téléphone d'un invité en 4G, sur le réveil d'un serveur gratuit, et sur la maintenance. Il n'y a ni linter ni formateur : le typage, les tests et le test de bout en bout tiennent lieu de filet, la relecture fait le reste.

## Les textes que lisent les invités

- **Courts, en français, et ils disent quoi faire.** Un message d'erreur est lu dans le noir, sur un téléphone, par quelqu'un qui n'a pas lu de documentation : « Le serveur redémarre — patiente une minute, puis réessaie », pas « Erreur 503 ».
- **Le tutoiement**, partout où l'application parle à quelqu'un.
- **Une erreur faite pour être lue se lève avec un `new Error('…')` nu**, sans code. Toute autre erreur — une panne de base, une exception de bibliothèque — devient un message neutre : un 500 « Erreur serveur — réessaie dans un instant » dans une route (`repondreErreur`), le même dans un toast de l'écran commun (`messagePourEcran`), et son détail part au journal. Les deux portes vivent dans `server/src/core/http.ts`.
- **La typographie française** est gardée par des fonctions (`shared/typographie.ts` : élision de « de », rangs, espaces insécables) et par `server/test/typographie.test.ts`.

## Les emojis antérieurs à Unicode 13

L'écran commun tourne souvent sous Windows 10, qui affiche les emojis plus récents en carré vide. Seuls les emojis antérieurs à Unicode 13 sont permis, dans `client/`, `shared/`, `server/src/` et les quiz livrés de `server/content/` ; `server/test/emojis.test.ts` y veille, et l'éditeur prévient l'animateur sur la carte d'une question. Les avatars proposés à l'inscription (`AVATARS`, `shared/avatars.ts`) suivent la même règle.

Dans l'interface, les icônes sont des SVG au trait ; les emojis restent là où ce sont les invités qui les choisissent — un avatar, une équipe — ou là où ils sont du contenu, comme l'emoji d'un prix.

## Les fonctions par lesquelles tout passe

Chacune remplace une façon naïve d'écrire qui a déjà cassé quelque chose.

| Pour… | Passe par | Jamais par | Pourquoi |
|---|---|---|---|
| couper un texte | `tronquer()`, `shared/avatars.ts` | `slice()` | un emoji coupé à la frontière laissait sa moitié en base |
| lire un nombre tapé | `lireNombre()`, `shared/nombres.ts` | `Number()` | « 35 000 » valait `NaN` au téléphone, « 0,8 » devenait 8 dans l'éditeur |
| saisir un entier borné | `ChampNombre`, `client/src/components/ChampNombre.tsx` | un `<input type="number">` borné à chaque frappe | vidé, le champ valait 0 et le 45 tapé derrière faisait « 2045 » |
| classer des joueurs | `shared/classement.ts` | un tri maison | cinq règles de départage donnaient trois vainqueurs à un même quiz |
| comparer deux estimations | `ecartEstimation()`, `shared/classement.ts` | `Math.abs(valeur - cible)` | la virgule flottante séparait 0,7 et 0,9 pour 0,8 |
| lire une échéance | `serverNow()`, `client/src/clock.ts` (son écart : `shared/clock.ts`) | `Date.now()` | l'horloge d'un téléphone dérive : des réponses se perdaient |
| écouter un message d'un client | `ecouter()`, `server/src/sockets.ts` | `socket.on` nu | un message sans charge ou sans accusé faisait tomber le serveur, et les soirées de tous les espaces avec |
| afficher un prénom | `nomsAffiches()`, `shared/homonymes.ts` | le prénom brut | deux « Camille » au même avatar ne se distinguaient pas — la marque « (2) » ne s'écrit jamais en base |
| écrire dans le stockage du navigateur | un `try`/`catch` (par exemple `writeSafe`, `client/src/state.ts`) | un accès nu | des cookies bloqués donnaient une page noire |

Deux règles de lecture complètent le tableau :

- **Une précision ne compte que les QCM, et dit sur combien** (« précision 50 % (1 sur 2 QCM) » ; un tableau de chiffres la met en pour cent à côté des justes et des fausses) : une estimation n'est jamais juste ni fausse.
- **Une estimation se juge au coup d'œil** (`coupDOeil`, `server/src/core/journal.ts`) — la part de la salle qu'elle bat ou égale —, jamais à l'écart en pour cent. Les deux ne se fondent jamais en un seul chiffre. Voir [Après la soirée](../produit/apres-la-soiree.md).

## Le CSS et la typographie

### Des jetons, pas des couleurs
- Le client tient dans `client/src/styles.css`, ses couleurs dans des jetons posés sur `:root, .carte-fond` — le Velours : `--bg`, `--ink`, `--muted`, `--accent`… Une règle lit un jeton, jamais une couleur en dur : Ivoire (`:root[data-theme='ivoire']`) et les thèmes redéfinissent surtout des jetons.
- Ce qui s'écrit prend `--accent-text` (`--accent-text-hover` au survol), un aplat `--accent` : écrit sur la crème d'Ivoire, l'or des aplats ne tenait que 3,1:1. Les métaux écrivent en `--bronze-text`, `--argent-text`, `--or-text`.
- Le focus n'a qu'un anneau, `--focus`, posé une fois pour tout élément (`:where(…):focus-visible`) ; un composant n'en règle que l'`outline-offset`.
- Les petites boîtes prennent `--radius-xs`, l'or du décor des fonds `--fond-or`. Aucun texte ne descend sous `--t-label` (0,6875 rem, les 11 px de `.label`, en `rem` pour suivre le texte agrandi) — sauf `.chiffre dt` (10 px) et `.bilan-you` (0,68 rem), que la garde ne relit pas.
- Une convention s'écrit en dur, et aucun thème ne la repeint : le compteur des gros boutons reste blanc sur rouge (`.gros-compteur`) — `--alert` vire au jaune sous Braises, au violet sous Héros.

### Une feuille de thème
- `client/src/themes/<clé>.css`, chargée à la demande, porte ses jetons sous `:root[data-theme='<clé>']`, dont `color-scheme` (`light` pour un thème `clair`) : les contrôles natifs suivent.
- Son décor vit dans les couches fixes (`body::before`, `#root::after`…), sans pointeur, animées par `transform` et `opacity` ; ses `@keyframes` portent sa clé en préfixe — deux feuilles chargées ne se disputent rien — et s'arrêtent sous `prefers-reduced-motion: reduce`.
- Ses seules adresses : ses polices (`/fonts/themes/…woff2`) et, s'il est peint, ses images sous empreinte (`/decors/…`), citées sous `--decor-…` dans le bloc que `server/scripts/anime/decors.ts --livrer` réécrit entre ses deux repères.
- Une règle qui peindrait une carte à fond ou ce qu'elle montre (`.card`, `.label`, `.niveau`…) s'en écarte par `:where(:not(.carte-fond, .carte-fond *))`, sans changer sa spécificité : le décor d'un fond reste nocturne.
- La page charge la feuille avant de poser `data-theme` sur `<html>` (`client/src/themeJoueur.ts`) : sinon, ses couleurs passaient un instant sur le décor du Velours.

### Les pièges
- Une animation qui pose `transform` écrase celui de l'élément (et `transform` se compose après `rotate`) : un toast centré par `translateX(-50%)` partait à droite. Centre par marges.
- Cormorant (`--serif`) écrit ses chiffres à l'ancienne : un nombre qu'on lit seul pose `lining-nums` (« 0 bonne réponse » se lisait « O »). `font-variant-numeric` est une seule propriété : `tabular-nums` seul efface le `lining-nums` d'une règle plus large — écris les deux.
- Une taille d'emoji qui varie passe par `transform: scale()`, jamais par `font-size` : chaque taille se met en forme à part — vingt-deux tailles retardaient la révélation de 100 à 230 ms, une seule coûte 20 ms. Réduit, jamais agrandi, l'emoji reste net.
- Une classe qu'on retire se cherche à la main : la garde des classes mortes tient pour vivante toute classe qui commence par un préfixe assemblé dans le code (`gerbe-${…}`).

### Le texte
- La typographie se pose à l'affichage, jamais en base (`shared/typographie.ts`) : `espacesFines` rend insécables les espaces déjà là devant ? ! ; : — « Why? » reste tel quel —, en pose toujours dans « », colle l'inversion (« a-t-il ») par un gluon U+2060 — le trait d'union insécable U+2011 n'est ni dans Figtree ni dans Cormorant —, et se repasse sans rien changer.
- `formatNumber` écrit un nombre à la française sans `Intl` — le premier `toLocaleString` coûtait 94 ms au processeur d'un téléphone moyen — et ne groupe les milliers qu'à cinq chiffres : « 1889 », « 35 000 ». Un rang s'écrit au féminin (« 1ʳᵉ place »).
- Un emoji, dans le code comme dans un `content:`, est antérieur à Unicode 13.

### Ce que les tests gardent
| Test | Ce qu'il garde |
|---|---|
| `server/test/design.test.ts` | un anneau de focus à 3:1, le survol à 4,5:1 ; pour chaque thème vendu ou gagné : sa feuille, ses textes, alertes et métaux à 4,5:1 sur `--bg`, le focus et les formes à 3:1, `color-scheme` selon `clair`, ses `@keyframes` préfixées, le mouvement réduit, ses seules adresses ; le compteur blanc sur rouge ; aucune classe morte ; `--fond-or`, `--radius-xs`, `--t-label` ; `lining-nums` en Cormorant |
| `server/test/fonds.test.ts` | aucune feuille, Ivoire comprise, ne peint une carte à fond, qui reprend les jetons du Velours |
| `server/test/decors-peints.test.ts` | les décors sous empreinte, leur bloc réécrit par la chaîne et rien hors de lui, leur poids |
| `server/test/typographie.test.ts` | l'élision, le rang au féminin, les espaces fines, le gluon, « 1889 », `formatNumber` égal à `toLocaleString('fr-FR')` |
| `server/test/emojis.test.ts` | aucun emoji d'après Unicode 12 dans les textes du client, de `shared/`, du serveur et de tout `server/content/`, base de la campagne comprise |

## Les choix de produit ne se changent pas en passant

Les barèmes, les seuils, les prix et les probabilités — les points d'une question, l'expérience, les seuils des hauts faits, le prix d'un thème, la chance de l'Éclat — sont des **choix de produit**, pas des constantes techniques. On ne les change pas sans le dire, et certains demandent un geste de plus pour que l'historique suive : monter `VERSION_BAREME`, ajouter une entrée à `DURCISSEMENTS` ou à `COURBES_D_AVANT`, un drapeau neuf pour le barème du solo. Chaque constante, sa valeur et ce que la changer implique : [les barèmes](../reference/baremes.md). Le pourquoi de ces mécanismes : [les récompenses](../produit/les-recompenses.md) et [les données](../architecture/donnees.md).

## Les tests et la documentation

- **Un nouveau comportement arrive avec son test** dans `server/test/`, qui échoue avant la correction. On n'allonge plus le test de bout en bout (`server/scripts/smoke.ts`), qui joue une seule soirée d'un bout à l'autre : un scénario de plus y fragilise ceux d'après. Voir [les tests](tests.md).
- **On ne supprime ni ne désactive une assertion** pour faire passer un test.
- **Une modification qui change un comportement change la page qui le décrit**, dans la même proposition de modification. `server/test/documentation.test.ts` vérifie ce qui peut l'être — chemins, liens, routes, événements, variables, tables, adresses, barèmes ; le reste tient à cette habitude.

## Git

- `npm run verify` avant de committer : le typage, les tests, la construction et la soirée de bout en bout, exactement ce que fait l'intégration continue.
- `package-lock.json` bouge tout seul selon la version de npm : on ne le committe que si c'est le sujet. Le hook de démarrage des sessions Claude Code installe d'ailleurs en `--no-save`.
- Une proposition de modification par sujet, décrite en français : ce qui change, pourquoi, et comment c'est vérifié.

## Pour aller plus loin

- [Les tests](tests.md) — écrire un test, les pièges
- [Les recettes](recettes.md) — les gestes complets pour faire évoluer un domaine
- [Travailler avec Claude](outillage-claude.md) — `CLAUDE.md`, les règles, les skills
- [La vue d'ensemble de l'architecture](../architecture/vue-d-ensemble.md) — les invariants et leur pourquoi
