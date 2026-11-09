# La chaîne des indices du Filet

Comment les indices du nouveau Filet (`../../indices-du-vivier.json`, une ligne par question) ont été écrits et jugés,
et comment refaire une vague : pour des questions neuves de la base, pour une année de plus (des questions récentes
deviennent posables), ou pour réécrire des indices refusés.

Un **rédacteur** (un agent, `consigne-redacteur.md`) écrit l'indice de chaque question : une phrase qui mène à la
bonne tranche, toute la tranche, et jamais à la valeur. Son lot passe le **juge à la lettre** du serveur
(`refusDeLIndiceALaLettre`), qui refuse tout nombre trop près de la réponse, en chiffres comme en lettres. Puis un
**juge à l'aveugle** (un autre agent, `consigne-juge.md`) lit l'indice comme le joueur qui l'a payé. Il voit la
question et les quatre tranches de l'écran, mais pas la réponse, et dit la fourchette qu'il en tire et la tranche
qu'il choisirait. Ce qu'il en lit, comparé au corrigé, donne le verdict.

## Le dossier de travail

Les lots, les sorties des agents et les corrigés vivent hors du dépôt, puisqu'ils portent les réponses. Ils sont
dans `ICI`, ou à défaut dans un dossier temporaire (`commun.mts`). Les tranches se calculent à l'année `ANNEE`
(2026 par défaut). Toutes les commandes se lancent depuis `server/` :

```bash
export ICI=/chemin/du/dossier/de/travail
```

## Les étapes d'une vague

| | Script ou agent | Il lit | Il écrit |
|---|---|---|---|
| 1 | `posables.mts` | la base, `vivier-du-filet.json`, `panel-du-vivier.json` | `posables.json` : chaque question posable, son acte, sa tranche |
| 2 | `lots-des-redacteurs.mts <vague> <acte> <lots>` | `posables.json`, les indices déjà écrits (maquette et vivier) | `<vague>-lot-<k>.json` |
| 3 | un **rédacteur** par lot | `consigne-redacteur.md`, son lot | `<vague>-lot-<k>-indices.json`, passé à `verifier-un-lot.mts` jusqu'à « ✓ » |
| 4 | `lots-des-juges.mts <vague> <juges> <indices…>` | `posables.json`, les fichiers d'indices | `<vague>-juge-<k>.json` (mêlés, sans la réponse), `<vague>-corrige.json` |
| 5 | un **juge à l'aveugle** par lot | `consigne-juge.md`, son lot, **et rien d'autre** | `<vague>-juge-<k>-lu.json` |
| 6 | `verdicts.mts <vague> <juges>` | le corrigé, les lectures | `<vague>-verdicts.json` |
| 7 | `verser-une-vague.mts <vague>-verdicts.json <indices…>` | les verdicts, les indices | `../../indices-du-vivier.json`, `<vague>-a-reecrire.json` |
| 8 | un **rédacteur** sur `<vague>-a-reecrire.json` | la consigne, chaque refus et ce que le juge en a lu | puis les étapes 3 à 7 sous `<vague>b` |
| 9 | `../contenu-du-filet.mts` | le classement, le panel, la maquette, le vivier | `server/content/cabinet/filet.json` |

```bash
node --import tsx ../retours/2026-11-09/reproductions/indices/posables.mts
node --import tsx ../retours/2026-11-09/reproductions/indices/lots-des-redacteurs.mts vague4 2 6
node --import tsx ../retours/2026-11-09/reproductions/indices/verifier-un-lot.mts $ICI/vague4-lot-1.json $ICI/vague4-lot-1-indices.json
node --import tsx ../retours/2026-11-09/reproductions/indices/lots-des-juges.mts vague4 6 $ICI/vague4-lot-*-indices.json
node --import tsx ../retours/2026-11-09/reproductions/indices/verdicts.mts vague4 6
node --import tsx ../retours/2026-11-09/reproductions/indices/verser-une-vague.mts $ICI/vague4-verdicts.json $ICI/vague4-lot-*-indices.json
node --import tsx ../retours/2026-11-09/reproductions/contenu-du-filet.mts
```

Puis les épreuves du contenu et de l'écran : `cabinet-contenu`, `cabinet-filet-en-deux-temps`, `cabinet-ecran-filet`.

Un juge ne relit jamais le lot d'un seul rédacteur : `lots-des-juges.mts` mêle les indices. Pour chaque question, il
tire la place de la réponse parmi celles que l'écran peut montrer, comme le jeu le ferait. Une vague déjà versée
garde ses lignes. `verser-une-vague.mts` ne remplace que les questions qu'elle réécrit, et `lots-des-redacteurs.mts`
ne propose que celles qui n'ont encore aucune ligne, ni à la maquette ni au vivier.

## Les verdicts

| Verdict | Ce que le juge a lu | |
|---|---|---|
| `tranche` | la bonne tranche, toute la bonne : le but | gardé |
| `large` | la bonne tranche, mais sans fourchette, ou une fourchette plus de deux fois et demie plus large qu'elle | gardé |
| `valeur` | une fourchette dont les deux bouts tiennent à deux étoiles de la réponse | refusé |
| `etroit` | plus serré que la tranche, et son milieu paie deux étoiles que le milieu de la tranche ne payait pas | refusé |
| `erreur` | une autre tranche que la bonne | refusé |
| `penche` | la bonne tranche, mais le milieu de la fourchette tombe dans la voisine, à plus de deux étoiles | refusé |

« Étroit » est le refus le plus fréquent, et le plus traître : l'indice a l'air juste, c'est son milieu qui paie.
Par exemple, « Plus large qu'un lit d'une place (90 cm), moins qu'un très grand lit (180 cm) », pour 140 cm dans la
tranche 100–300, se lit 90–180, et viser 135 rapporte trois étoiles. Ce verdict est né à la vague de l'acte II. Les
147 indices de la maquette ont alors été rejugés avec elle.

## Ce que les vagues ont donné

| Vague | Questions | Rédacteurs | Juges | Indices | Sans indice | Verdicts | Réécrits |
|---|---|---|---|---|---|---|---|
| Acte I | 228 | 8 | 7 | 208 | 20 | 181 gardés | 27, tous gardés au second jugement |
| Acte II, avec les 147 de la maquette | 375 + 147 | 8 | 9 | 366 + 147 | 9 | 475 gardés ; 31 étroits, 7 valeur | 38 : 36 gardés, 2 sans indice honnête |
| Acte III | 739 | 12 | 11 | 737 | 2 | 737 gardés (726 tranche, 11 large) | aucun |

Deux lignes ont été corrigées à la main, après les juges :
- **Bill Russell** (`5aiymlab`) est passé à « sans indice ». L'énoncé borne déjà à treize saisons : tout indice qui
  mène à 10–30 n'en laisse que 11 à 13, deux étoiles d'office.
- **Le haïku** (`9393y7iz`), un indice de la maquette, se terminait par « fais l'addition », ce que la consigne
  interdit. Le juge à l'aveugle l'avait gardé : il juge la fourchette, pas le calcul. Il a été réécrit, puis rejugé
  seul, en vague d'une question.

En 2026, le vivier compte 1 489 lignes : 1 455 indices et 34 questions sans indice honnête. Selon l'acte, 242
questions posables sur 264 ont leur indice à l'acte I, 413 sur 422 à l'acte II et 800 sur 803 à l'acte III.

## Ce que la chaîne ne vérifie pas

- **Les faits.** Le rédacteur doit vérifier ses dates (« rien de faux »). Le juge à l'aveugle ne le peut pas : il
  n'a ni la réponse ni le droit de se servir de sa mémoire.
- **Les autres interdits de la consigne** : un calcul (« fais l'addition »), une élimination qui ne laisse qu'une
  réponse, un fait daté de la même année, le sujet de la question redit. Le juge à la lettre ne voit que les
  nombres, et le juge à l'aveugle que la fourchette. Après chaque vague, une recherche sur « addition », « compte »,
  « moitié », « fois », « l'année » ou « le seul » dans le vivier, relue à la main, coûte une minute. C'est ainsi que
  le haïku a été trouvé.

## Ce que ça coûte

Un rédacteur qui écrit une soixantaine d'indices consomme 280 000 à 360 000 jetons. Un juge, pour un lot d'une
soixantaine de lectures, 120 000 à 150 000.

## Rejouer une vague

Les scripts du dépôt redonnent la vague de l'acte III octet pour octet à partir de ses fichiers de travail : les
onze lots des juges, le corrigé, les verdicts, et le vivier une fois reversé, sauf Bill Russell, corrigé après coup.
