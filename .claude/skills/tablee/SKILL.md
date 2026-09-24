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

## Adapter la tablée

- **Une autre soirée** : une fiche de plus dans `personas/`, sur le modèle des
  autres — qui, appareil, arrivée, scénario, ce qu'il regarde. Les meilleures
  fiches ont un **angle** : un usage, une contrainte, une question précise
  sur l'application.
- **Une page précise** : donne à chaque agent une mission ciblée (« l'éditeur
  de quiz, en créant trois quiz différents ») plutôt qu'une soirée entière.
- **Après une correction** : rejoue la même tablée et compare les retours —
  c'est la mesure de l'amélioration.
- **Les options de la régie** : `--animateur <Prénom>`, `--espace <nom>`,
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
- Chromium seulement : ni Safari, ni Firefox. Le profil « iphone » n'en a
  que la taille et l'identité.
- La salle (`dire`) est commune à toute la tablée : c'est une pièce, pas un
  espace de l'application.
