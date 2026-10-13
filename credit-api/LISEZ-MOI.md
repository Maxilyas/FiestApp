# credit-api — le crédit de l'API, dépensé une fois

Le propriétaire a reçu 200 $ de crédit sur l'API d'Anthropic, et ne s'en
servira qu'une fois (13 octobre 2026). Ce dossier les dépense sur la base de
la campagne, puis **s'en va avant la fusion** : le dépôt n'a ni clé ni SDK
d'Anthropic, et les garde ainsi. Seul le résultat reste — la base relue,
corrigée, reclassée, agrandie — et son compte rendu dans `retours/`.

Ce qu'on fait, dans l'ordre :

1. **Relire toute la base** (11 059 questions) par Opus, une seconde fois :
   les faits faux, périmés, ambigus, les réponses soufflées par leur racine
   (141), et **le classement** — catégorie, sous-thème, étiquettes — d'après
   les règles de partage de la consigne. Les doutes sont vérifiés sur le web,
   sources à l'appui (`relire.ts`).
2. **Écrire des questions à nombre** pour les estimations du quiz tout prêt :
   il n'y en a que 9 de difficulté 1 et 137 de difficulté 2 sur 647
   (`generer.ts preparer --nombres`).
3. **Agrandir la base** avec ce qui reste du crédit, par la génération du
   dépôt (`generer.ts preparer --questions`).

Tout passe par des lots (Message Batches) : moitié prix, rendus en général
dans l'heure, vingt-quatre heures au pire. Rien ne touche au forfait Claude :
la routine du matin n'en pâtit pas.

## Avant tout

- La clé est dans **`FIESTAPP_ANTHROPIC_KEY`**, une variable de
  l'environnement cloud — jamais `ANTHROPIC_API_KEY`, que Claude Code lirait
  pour ses propres appels. Une session ne lit que les variables présentes à
  son démarrage. Vérifie sans l'afficher :
  `test -n "$FIESTAPP_ANTHROPIC_KEY" && echo clé présente`.
- Le SDK s'installe ici seulement, hors des workspaces :
  `cd credit-api && npm install --workspaces=false && cd ..`
- Les épreuves, sans réseau ni dépense :
  `node --import tsx --test credit-api/essais.test.ts` (14 épreuves).
- Le dossier des lots, s'il manque : `mkdir -p .lots-campagne`.
- Les commandes se lancent **depuis la racine du dépôt**. Celles qui appellent
  l'API demandent `NODE_USE_ENV_PROXY=1` dans le cloud. `avancer --attendre`
  peut tourner des heures : lance-le en arrière-plan.

L'état de chaque relecture et génération, les brouillons et le carnet des
dépenses (`carnet.json` : chaque lot, son coût prévu puis mesuré) vivent dans
`credit-api/etat/`. **Commite-le à chaque étape** : un conteneur qui s'en va
n'emporte pas les identifiants des lots payés. Les lots écrits, eux,
attendent dans `.lots-campagne/` (jamais committé) : range-les avant de
laisser la session.

## 1. Le pilote de la relecture (≈ 1 $)

```bash
npx tsx credit-api/relire.ts preparer --limite=300 --nom=pilote
NODE_USE_ENV_PROXY=1 npx tsx credit-api/relire.ts avancer pilote --attendre
```

Avant d'appliquer, **lis ses décisions** (`credit-api/etat/relecture-pilote.json`) :
les retraits sont-ils justes ? Les doutes, les reclassements, raisonnables ?
Un correcteur qui retire ou reclasse trop se reprend dans
`systemeDuRelecteur` (`consignes.ts`) ; refais alors un pilote sur un autre
tirage. Puis :

```bash
npx tsx credit-api/relire.ts appliquer pilote
cd server && node --import tsx --test test/campagne-base.test.ts && cd ..
```

Le journal (`credit-api/etat/relecture-pilote.journal.md`) dit chaque
changement, avant et après. Si la base a reculé, baisse `AU_MOINS`
(`server/test/campagne-base.test.ts`) en disant pourquoi, comme son
commentaire le fait. Commite `server/content/campagne/` et `credit-api/etat/`.
`npx tsx credit-api/relire.ts etat pilote` dit ce que le pilote a coûté : de
quoi juger le reste.

## 2. Toute la base (≈ 40 $, et ≈ 0,10 $ par doute)

```bash
npx tsx credit-api/relire.ts preparer --nom=base      # sans les 300 du pilote
NODE_USE_ENV_PROXY=1 npx tsx credit-api/relire.ts avancer base --attendre
npx tsx credit-api/relire.ts appliquer base
```

La première passe part d'un lot (283 fiches de 40), puis les doutes d'un
second, avec la recherche web. Même vérification, même commit.

## 3. Les questions à nombre (≈ 8 $ les mille)

```bash
npx tsx credit-api/generer.ts preparer --nombres=1000 --nom=n1
NODE_USE_ENV_PROXY=1 npx tsx credit-api/generer.ts avancer n1 --attendre
cd server
npx tsx scripts/base-campagne.ts voisines ../.lots-campagne/n1-*.json
npx tsx scripts/base-campagne.ts ranger ../.lots-campagne/n1-*.json
node --import tsx --test test/campagne-base.test.ts
cd ..
```

Relève `AU_MOINS` avec l'histoire de la vague, et commite. `avancer` mène
toute la génération : l'écriture, deux tours de correction au plus de ce que
le juge refuse, le recueil de chaque vague, la relecture par Opus, ses
décisions — c'est `generer-campagne.ts suite`, ses missions parties en lot.

## 4. Ce qui reste du crédit

`npx tsx credit-api/generer.ts etat n1` dit ce qui est dépensé. Le reste,
moins une dizaine de dollars de marge, au coût mesuré des mille questions :

```bash
npx tsx credit-api/generer.ts preparer --questions=<n> --nom=a1
NODE_USE_ENV_PROXY=1 npx tsx credit-api/generer.ts avancer a1 --attendre
```

Par tranches de trois mille au plus, chacune rangée et commitée avant la
suivante : ce qui attend dans `.lots-campagne/` ne survit pas au conteneur.
`--redacteur=sonnet` écrit pour moitié prix (Opus relit toujours).

## 5. La fin

- `retours/<date>/credit-api.md` : ce qui a été fait, les chiffres (relues,
  retirées, corrigées, reclassées, doutes et leurs verdicts, questions
  écrites et rangées), ce que chaque étape a coûté (le carnet), et les
  journaux des relectures recopiés tels quels.
- Une ligne dans `.claude/rules/campagne-base.md` : la base relue en entier
  une seconde fois, le classement compris, et ce que la relecture a trouvé —
  sans citer un fichier de `credit-api/` entre accents graves :
  `notes-pour-claude.test.ts` vérifie que chaque fichier cité existe, et ce
  dossier s'en va.
- `git rm -r credit-api` — l'outillage ne fusionne pas.
- `npm run verify` en arrière-plan, puis la PR : sa description dit tout cela.

## Si ça se passe mal

- **Le processus s'est arrêté pendant un lot** : relance `avancer` ; il
  reprend le lot en route par son identifiant (dans `credit-api/etat/`).
- **Une demande échoue trois fois** (surcharge, réponse illisible) : elle ne
  repart plus. `relire.ts appliquer --forcer` applique sans elle (ses
  questions restent telles quelles) ; `generer.ts avancer --forcer` compte
  son lot pour vide, comme `suite --forcer`.
- **« Budget : … »** : le lot ferait passer `--budget` (190 $ par défaut).
  Réduis ce qu'on demande, ou relève `--budget` si la console d'Anthropic
  montre qu'il reste du crédit.
- **« Appel impossible : derrière un proxy »** : `NODE_USE_ENV_PROXY=1`.
- Les coûts du carnet sont des estimations au tarif public (`TARIFS`,
  `api.ts`) ; la console fait foi.
