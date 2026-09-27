---
name: tablee
description: Fait jouer une soirée entière de FiestApp à des agents — des invités aux profils variés (grand-mère au petit téléphone, ado pressé, joueuse à profil, retardataire au réseau capricieux, homonymes, daltonienne, lecteur d'écran) et une animatrice qui découvre l'application — sur de vrais navigateurs, puis rassemble leurs retours en axes d'amélioration. À utiliser quand on demande des retours d'utilisateurs, un test d'usage, des personas, « faire jouer des agents », « simuler une soirée » ou « la tablée ».
---

# La tablée

Une soirée jouée par des agents qui incarnent des invités et un animateur,
chacun sur son appareil, dans un vrai navigateur, sur un vrai serveur aux
bases jetables. À la fin, chacun écrit ce qui lui a plu, ce qui l'a gêné, les
bugs vus ; tu recoupes, tu vérifies, et tu en tires des axes d'amélioration.

Ce que les tests ne disent pas, la tablée le montre : un bouton caché par le
clavier du téléphone, un mot que la grand-mère ne comprend pas, un écran que
le lecteur d'écran lit dans le désordre, une animatrice qui cherche comment
régler le temps de toutes ses questions d'un coup.

## Les pièces

| Pièce | Rôle |
|---|---|
| `server/scripts/tablee/regie.ts` | la régie : serveur jetable, Chromium, et la porte que poussent les agents (`npm run tablee`) |
| `server/scripts/tablee/pilote.mjs` | le geste d'un agent : `node server/scripts/tablee/pilote.mjs <qui> <geste> …` (`… aide` les liste) |
| `consignes-invite.md`, `consignes-animateur.md` | ce que chaque agent doit savoir, commun à tous |
| `personas/*.md` | une fiche par personnage : qui, quel appareil, quel scénario, quoi regarder |
| `modele-retour.md` | le plan du retour que chaque agent écrit |
| `consignes-expert.md`, `experts/*.md`, `modele-rapport.md` | les experts : une mission chacun (parcours, design, mots, accessibilité, performance…), leur atelier, le plan de leur rapport |
| `consignes-audit.md` | les experts du code (sécurité, jeu solo, récompenses, moteur, données, courses…) : leur banc, leurs reproductions, leurs constats en JSON — « Les audits de code » plus bas |
| `consignes-contre-expertise.md` | le contre-expert, qui essaie de réfuter chaque constat avant la synthèse |
| `server/scripts/tablee/chronologie.mjs` | le journal d'une tablée en une page : gestes ratés, délais de réponse, paroles, retours manquants |
| `export/tablee/<date-heure>/` | tout ce que la soirée laisse (ignoré par git) : `journal.jsonl`, `regie.log`, `captures/`, `retours/`, `bases/` |

## Le déroulé

### 1. Démarrer la régie

En arrière-plan (elle tourne jusqu'à `regie arreter`) :

```bash
npm run tablee -- --profil "Camille/camille.d/🦊" > <scratchpad>/regie.log 2>&1
```

Elle reconstruit le client s'il est plus vieux que ses sources, crée le compte
de l'animatrice (Nadia, espace `chez-nadia`, à activer par son lien) et les
profils demandés. Attends la ligne « La tablée est prête », puis lis
`export/tablee/courante.json` : le dossier de la soirée, le lien d'activation,
l'adresse de l'espace. `node server/scripts/tablee/pilote.mjs regie etat` dit
à tout moment qui est où.

La fiche de Camille D. suppose ce profil déjà inscrit ; retire-la de la
tablée, ou retire l'option, pas l'un sans l'autre.

### 2. Lancer les agents

Un agent par fiche, **tous dans le même message**, en arrière-plan
(`run_in_background: true`), type `general-purpose`. Chacun lit lui-même ses
consignes — le prompt ne fait que les désigner, avec les valeurs du jour :

```
Tu es un agent de la tablée de FiestApp : <un invité | l'animatrice> d'une
soirée quiz, joué(e) dans un vrai navigateur. Commence par lire, dans cet
ordre, et suis-les à la lettre :
1. <racine>/.claude/skills/tablee/consignes-invite.md (ou consignes-animateur.md)
2. <racine>/.claude/skills/tablee/personas/<nom>.md — ton personnage
3. <racine>/.claude/skills/tablee/modele-retour.md — le plan de ton retour
Ne lis aucun autre fichier du dépôt : ni les autres fiches, ni le code, ni la
documentation.

Les valeurs du jour :
- ton identifiant pour le pilote : <nom>
- le dossier de la tablée : <dossier> — ton retour : <dossier>/retours/<nom>.md
- (l'animatrice) ton lien d'activation : <lien>
- lance tes commandes depuis <racine>
```

Modèle : un modèle rapide pour les invités (`sonnet`) — le chronomètre
n'attend pas ; le modèle par défaut pour l'animatrice, dont les retours sur
l'éditeur et la console demandent le plus de discernement.

Les invités attendent d'eux-mêmes que l'écran commun s'allume (`scanner`) et
que les questions arrivent (`question`) : l'animatrice peut prendre une
demi-heure à écrire son quiz, c'est prévu.

### 3. Pendant la soirée

Ne pilote rien toi-même : c'est leur soirée. Tu peux regarder
(`regie etat`, `regie salle`, `chronologie.mjs`, `tail export/tablee/<…>/regie.log`)
pour repérer un agent bloqué ou une régie tombée. Si un agent s'est arrêté
trop tôt, relance-le avec SendMessage plutôt qu'un nouvel agent : il garde
sa mémoire de la soirée. Un message ne lui parvient qu'à son geste suivant :
un agent pris dans une attente de neuf minutes l'entendra dans neuf minutes.

Ne lance pas `npm run build` (ni `verify`) pendant une tablée : il réécrit le
client que la régie sert aux agents. Pour vérifier avant un commit,
construis le client ailleurs (`npx vite build --outDir <ailleurs>` depuis
`client/`) et lance le smoke à part.

### 4. Recueillir et vérifier

Chaque agent écrit `export/tablee/<…>/retours/<nom>.md`. Commence par
`node server/scripts/tablee/chronologie.mjs` : qui a fait quoi, quels gestes
ont échoué et pourquoi, en combien de temps chacun a répondu. Puis, avant de
tirer quoi que ce soit des retours, **vérifie** :

- un bug annoncé se rejoue (avec le pilote, ou en lisant le code) — sinon
  il reste « non confirmé » ;
- recoupe avec `journal.jsonl` (qui a fait quoi, quand, en combien de temps)
  et `regie.log` (les erreurs du serveur à la même heure) ;
- écarte ce qui vient de la tablée et non de l'application : la lenteur de
  réaction des agents, le clavier simulé, un geste mal visé — et quand
  plusieurs agents rapportent le même « bug » sans trace dans le journal ni
  la console, soupçonne d'abord le banc (la première tablée en a trouvé un
  ainsi : `retours/2026-09-23/synthese.md`, « Écarté ») ;
- un retour qui contredit un parti pris du dépôt (README, « La direction » ;
  CLAUDE.md, invariants) se note comme tel : c'est une tension à arbitrer,
  pas une correction à faire.

### 5. La synthèse

Dans `retours/<AAAA-MM-JJ>/` à la racine du dépôt :

- `synthese.md` — les axes d'amélioration, du plus important au moins
  important. Pour chacun : ce qui se passe, qui l'a vécu (personnages,
  captures), ce que ça coûte à la soirée, la piste de correction, et son
  statut (bug confirmé, friction, idée, tension avec un parti pris). Puis ce
  qui plaît et qu'il ne faut pas casser, et les limites de la tablée ;
- les retours des agents, recopiés tels quels (`<nom>.md`) ;
- quelques captures, seulement celles qui montrent un problème mieux que des
  mots (PNG en taille CSS : quelques dizaines de Ko chacune).

Puis `node server/scripts/tablee/pilote.mjs regie arreter`.

## Plusieurs salons

Plusieurs soirées en même temps sur **le même serveur**, chez des animateurs
différents : ce que vit un hébergement partagé un samedi soir. `--animateur`
se répète (`--animateur Nadia --animateur Marc --animateur Léa`) : un compte,
un espace et un salon par animateur. Le salon d'un animateur porte son
identifiant (`nadia`) ; un invité dit où il est par `chez nadia`, juste après
`appareil` — `scanner`, `tele`, `attendre --tele` ne visent plus que l'écran
commun de ce salon, et `dire` ne s'entend que là. Un invité sans salon entend
tout le monde, et son `scanner` refuse de choisir entre deux écrans allumés.
Un invité qui passe d'une fête à l'autre refait `chez <l'autre>`. Une
animatrice qui projette depuis un second appareil (`lea-tele`) y fait
`chez lea` : l'écran commun d'un salon est celui qui n'est pas dans une main.

Les personnages des salons de Marc (`marc`, `ines`, `bertrand`, `maelle`,
`rachid`) et de Léa (`lea`, `zoe`, `malik`, `liam`) jouent à côté de ceux de
Nadia ; Inès passe de l'un à l'autre. Leur régie :

```bash
npm run tablee -- --animateur Nadia --animateur Marc --animateur Léa \
  --profil "Camille/camille.d/🦊" --profil "Inès/ines/🦉" --profil "Malik/malik/🐺"
```

Donne à chaque invité son salon dans ses valeurs du jour (« ton salon :
`chez marc` ») ; la chronologie range alors les réponses salon par salon.

## Les experts

À côté des personnages, des **experts** : pas un invité, un regard — le
parcours de l'animateur et ses allers-retours, celui de l'invité, le liant
entre les pages, l'écran commun vu du canapé, les mots, l'accessibilité, la
performance… Une fiche par mission dans `experts/`, des consignes communes
(`consignes-expert.md`) et un plan de rapport (`modele-rapport.md`). Un
expert peut lire le code et la documentation, écrire des scripts dans son
dossier (`export/evaluations/<mission>/`), démarrer son propre serveur
jetable ; il rend `export/evaluations/rapports/<mission>.md`.

Ils travaillent dans **l'atelier**, une seconde régie à côté de la tablée en
direct, avec un compte d'animateur préparé pour chacun :

```bash
npm run tablee -- --sans-build --fiche export/tablee/atelier.json \
  --dossier export/tablee/<date>-atelier --animateur Aline --animateur Bruno …
```

Chaque geste d'un expert commence alors par `TABLEE=<fiche de l'atelier>` —
sans lui, il piloterait la tablée en direct. Les mesures de performance qui
chargent la machine (`perf-chargement`, `perf-temps-reel`, `perf-rendu`)
attendent la fin des soirées en direct : quatre cœurs partagés par une
trentaine d'agents faussent un chronomètre, et un test de charge ferait
rater des questions aux invités.

## Les audits de code

D'autres experts ne regardent pas la soirée : ils lisent **le code**, et
cherchent ce qui casse — failles, tricheries, courses, pertes de données,
règles du `CLAUDE.md` qui ne tiennent plus. Leurs fiches sont dans
`experts/` avec les autres ; leurs consignes communes, dans
`consignes-audit.md` (un serveur jetable par le banc des tests, une
reproduction qui est déjà un test, le rapport et ses constats en JSON).

| Fiche | L'angle |
|---|---|
| `securite-portes` | les routes HTTP : authentification, droits, requêtes forgées, fichiers, en-têtes |
| `securite-temps-reel` | les sockets : commander ailleurs, lire avant la révélation, suivre quelqu'un, tuer le processus |
| `jour-regles` · `jour-ecran` | le jeu solo : les règles du quiz du jour (triche, minuit, comptes), puis son écran au téléphone |
| `recompenses-comptes` · `recompenses-vitrine` | la progression : ce qui se crédite et se reprend, puis ce qui s'affiche et à qui |
| `design-recompenses` | les récompenses à l'écran, du téléphone à la télé |
| `moteur` | les phases, les chronos, les points d'une soirée |
| `persistance` | les deux bases, le miroir, les migrations, la sauvegarde |
| `concurrence` | les courses entre deux `await`, les promesses orphelines |
| `invariants` | les règles du `CLAUDE.md`, relues une à une dans le code |
| `client` | les effets, la liaison, les pages blanches du navigateur |
| `bibliotheque` | les quiz qu'on écrit, colle, importe, partage |
| `exploitation` | la mise en ligne, l'heure, la durée, `/healthz` |
| `tests` | ce que le filet prouve vraiment (mutants, épreuves fragiles, trous) |

Ils n'ont pas besoin de la régie : lance-les comme les autres experts (un
agent par fiche, en arrière-plan, qui lit `consignes-audit.md` puis sa
fiche), **sept au plus à la fois** — un nouveau dès qu'un autre rend son
rapport : la lecture d'abord, les mesures ensuite, quand la machine est
calme. Quinze en parallèle ont épuisé la réserve d'usage de cinq heures en
moins d'une heure, le 26 septembre ; un agent coupé se reprend par
`SendMessage`, son dossier est sur disque (`retours/2026-09-27/synthese.md`).
Donne à chacun le chemin de la dernière vérification complète, s'il y en a
une, et la liste des rapports déjà rendus, pour qu'il ne les refasse pas.
Les experts de l'atelier (accessibilité, mots, parcours) qui ont besoin
d'un profil de joueur le créent eux-mêmes depuis l'accueil.

Leurs constats passent ensuite par une **contre-expertise**
(`consignes-contre-expertise.md`) : un agent par domaine — deux ou trois
rapports voisins ensemble, pour qu'il voie les doublons —, chargé de
**réfuter** chaque constat P1 et P2 : relancer la reproduction, relire le
chemin du code, chercher la garde qui l'empêche. Lance-la dès qu'un domaine
a rendu ses rapports, sans attendre les autres.
Seul ce qui résiste entre dans la synthèse, avec son statut (bug confirmé,
non reproduit, faux positif, tension avec un parti pris) :
`retours/<AAAA-MM-JJ>/synthese.md`, les rapports dans `experts/`, les
contre-expertises dans `verification/`, tous les constats et leur verdict
dans un seul `constats.json`, et les épreuves qui les prouvent dans
`reproductions/` — la première ébauche de l'épreuve de chaque correction.

## Adapter la tablée

- **Une autre soirée** : une fiche de plus dans `personas/`, sur le modèle des
  autres — qui, appareil, arrivée, scénario, ce qu'il regarde. Les meilleures
  fiches ont un **angle** : un usage, une contrainte, une question précise
  sur l'application.
- **Une page précise** : donne à chaque agent une mission ciblée (« l'éditeur
  de quiz, en créant trois quiz différents ») plutôt qu'une soirée entière.
- **Après une correction** : rejoue la même tablée et compare les retours —
  c'est la mesure de l'amélioration.
- **Les options de la régie** : `--animateur <Prénom>[/<espace>]` (répétable :
  un salon par animateur), `--espace <nom>`,
  `--sans-animateur` (l'animateur utilise l'administrateur et ses deux quiz
  livrés), `--profil <Prénom/identifiant/avatar>` (répétable),
  `--dossier <chemin>`, `--sans-build`, et `--fiche <chemin>` pour une
  seconde tablée à côté d'une autre (ses pilotes la visent avec
  `TABLEE=<chemin>`).

## Les limites à garder en tête

- Un agent réagit en plusieurs secondes : les questions de la tablée durent
  45 à 60 s (consigne de l'animatrice), et le temps de réaction qu'on mesure
  est celui de l'outil, pas celui d'un humain.
- Le clavier du téléphone est simulé : il prend 40 % de la hauteur et la
  page rétrécit au-dessus, comme le fait Chrome Android à la demande de
  FiestApp (`interactive-widget=resizes-content`) — Safari, lui, ne rétrécit
  que ce qu'il montre. La veille aussi est simulée (page figée, réseau
  coupé, visibilité cachée).
- `ecrire` tape touche par touche, sans pause entre deux touches : un champ
  qui se relit à chaque frappe s'y trahit, pas une saisie qui dépend du
  rythme. `coller` remplit d'un coup, comme un texte copié ailleurs.
- Chromium seulement : ni Safari, ni Firefox. Le profil « iphone » n'en a
  que la taille et l'identité.
- La salle (`dire`) est commune à toute la tablée — ou à tout un salon, s'il y
  en a plusieurs : c'est une pièce, pas un espace de l'application.
- **Le nombre d'agents et la réserve d'usage.** Une session ne mène que vingt
  agents à la fois : les experts de trop vont dans des sessions cloud à part,
  qui poussent leur rapport sur la branche. Et 35 agents en parallèle ont
  épuisé en vingt-cinq minutes la réserve d'usage de cinq heures, coupant
  tout le monde d'un coup (`retours/2026-09-24/synthese.md`) : échelonne les
  vagues, garde un modèle rapide pour les invités, et reprends un agent coupé
  par `SendMessage` (il garde sa mémoire de la soirée) — une session cloud, par
  une routine ponctuelle attachée à elle.
- **`voir` n'est pas ce qu'entend un lecteur d'écran** : il liste des icônes
  `aria-hidden` et lit un `<th>` comme une case. Pour juger l'accessibilité,
  `lecteur` lit l'arbre tel que Chrome l'expose.
