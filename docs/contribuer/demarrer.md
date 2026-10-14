# Démarrer dans le code

> Installer FiestApp, le lancer en développement, faire le tour du dépôt, puis le cycle d'une modification — de la branche à la mise en ligne. Pour qui va écrire du code ici, humain ou agent. Pour seulement l'essayer chez toi, [la première soirée](../guides/premiere-soiree.md) suffit.

## Installer

- **Node.js 20 ou plus** (`engines`, `package.json`) ; la CI tourne en Node 22. npm et git.
- `npm install` à la racine installe les deux espaces de travail npm, `client` et `server`. `shared/` n'est pas un paquet : les deux `tsconfig.json` l'incluent.
- Très peu de dépendances, et c'est voulu : n'en ajoute pas sans raison forte ([les conventions](conventions.md)).
- Pour les scripts qui photographient l'application, la chaîne des images peintes, la tablée et `npm run mesure` seulement : Playwright et son Chromium, installés globalement (`npm install -g playwright`). Ce n'est pas une dépendance du dépôt.

> [!WARNING]
> `package-lock.json` bouge tout seul selon la version de npm. Ne le committe pas si ce n'est pas le sujet.

## Lancer

```bash
npm run dev
```

Le serveur (`tsx watch`, port 3001, relancé à chaque retouche de son code) et Vite (port 5173, qui recharge la page) démarrent ensemble. Vite relaie vers le port 3001 le temps réel (`/socket.io`), `/api`, `/media`, `/s/` et les adresses d'avant les espaces (`client/vite.config.ts`) : le serveur doit rester sur 3001. Les deux bases vivent dans `server/data/`, que git ignore — `quizz.db`, la locale, jetable, et `quizzes.db`, qui tient le rôle de la base permanente (Turso, en ligne). Au premier démarrage, le serveur y crée le compte de l'administrateur, `antoine` / `demo`, son espace `demo`, et deux quiz dans sa bibliothèque.

| Adresse | Ce qu'on y trouve |
|---|---|
| `http://localhost:5173/` | L'accueil : se connecter à son profil, rejoindre une soirée, animer |
| `http://localhost:5173/host` | L'écran commun, qui demande l'animateur |
| `http://localhost:5173/edit` | « Mes quiz », la bibliothèque et l'éditeur |
| `http://localhost:5173/admin` | Le QG de l'administrateur |
| `http://localhost:5173/demo` | L'entrée des invités dans l'espace `demo` |

Toutes les pages : [les adresses](../reference/adresses.md).

**Ce que `npm run dev` ne montre pas.** À 5173, Vite sert la page telle quelle : rien de ce que le serveur fait d'une page avant tout script — son statut, ses redirections (un code de salon à six chiffres, une adresse tapée de travers), son aperçu, ses données préchargées, son attente déjà écrite, la pastille de la préproduction. Cela se vérifie sur le client construit (`npm run build -w client`), servi par le serveur à son port, ou au banc des tests ([les tests](tests.md)). Et le QR de l'écran commun mène au port du serveur, qui ne sert que le client construit : pour jouer avec de vrais téléphones, voir [la première soirée](../guides/premiere-soiree.md).

D'autres façons de lancer :

- `npm run build`, puis `npm start` : le client construit et le serveur seul, sans Vite ni rechargement.
- `npm run start:qa -w server` : le vrai serveur sur des bases jetables, dans un dossier temporaire, avec un wifi de démonstration pour le QR.
- Des invités simulés contre un serveur qui tourne : `node server/scripts/fake-player.mjs` (un invité qui répond au hasard), `npm run load` (toute une salle).

Chaque commande, ses options et ses variables : [les commandes](../reference/commandes.md).

## Le tour du dépôt

| Dossier | Ce qu'il contient |
|---|---|
| `shared/` | Les types et les fonctions **pures**, partagés par le client, le serveur et les tests : les adresses, le classement, les équipes, le profil, les hauts faits, les thèmes… |
| `server/src/` | `index.ts` (le démarrage, depuis l'environnement), `server.ts` (le serveur HTTP et le démarrage dans l'ordre), `sockets.ts` (tout le temps réel), les routes de chaque mode (`api.ts`, `campagne.ts`, `quizDuJour.ts`, `partages.ts`, `profilsAdmin.ts`, `qg.ts`), et `racine.ts`, d'où se compte tout chemin du serveur |
| `server/src/core/` | Les registres de la soirée, le moteur, les magasins (quiz du jour, campagne, archives…), le miroir vers Turso, les dérivations |
| `server/src/auth/` | Les comptes, les profils, les sessions, la télé branchée |
| `server/src/games/` | Les règles du quiz (`quiz.ts`) : phases, chronomètres, barème, vues |
| `server/content/` | Les onze quiz livrés (`server/content/quiz/`) et la base de la campagne, une catégorie par fichier (`server/content/campagne/`) |
| `server/scripts/` | Le smoke, `tests.mjs`, les rendus, la tablée, les calibrages, la sauvegarde, l'export, la base de la campagne, les images peintes |
| `server/test/` | Un fichier par thème, un serveur jetable par fichier ou par épreuve |
| `client/src/` | L'application React : `views/` (une page, un fichier), `components/`, `games/quiz/` (ce que l'écran commun et le téléphone montrent d'un quiz), `themes/` (une feuille par thème) |
| `client/public/` | Ce qui est servi tel quel : le manifeste, le service worker du rappel du soir, les polices, les images peintes |
| `docs/` | Cette documentation ; `docs/vitrine/`, la page qui présente FiestApp |
| `.claude/` | La mémoire et les outils de Claude Code ([travailler avec Claude](outillage-claude.md)) |
| `.github/workflows/` | La CI |
| `retours/` | Les archives des tablées et des audits |

À la racine aussi : `CLAUDE.md` (la mémoire de Claude), `render.yaml` (la référence des deux services Render, dont le tableau de bord fait foi). Git ignore `node_modules/`, `dist/`, `server/data/`, `export/` (sauvegardes, rendus, tablées), `.lots-campagne/` et `.faits-wikidata/` (la base de la campagne en cours d'écriture).

Le code se lit d'abord par ses commentaires : un module s'ouvre souvent sur ce qui l'a fait naître, et les commentaires disent **pourquoi** — la décision prise, le bug évité. Lis-les avant de toucher un fichier.

## Le cycle d'une modification

1. **Une branche.** Jamais directement sur `main`.
2. **Comprends le domaine** : sa page de [`docs/`](../README.md), et le commentaire de tête des fichiers que tu touches. Un agent Claude lit la règle du domaine, qui arrive d'elle-même quand il ouvre un de ses fichiers.
3. **Le test d'abord.** Un nouveau comportement arrive avec son épreuve dans `server/test/`, qui échoue avant la correction ([les tests](tests.md)). Le smoke ne s'allonge plus.
4. **Le code**, ses commentaires en français, qui disent pourquoi ([les conventions](conventions.md)).
5. **Regarde le rendu** si la retouche se voit : au téléphone en 360 × 640, l'écran commun en 1366 × 768 et en 1920 × 1080 — les scripts de rendu le font ([les commandes](../reference/commandes.md#photographier-lapplication)).
6. **La documentation dans le même commit.** Une route, un événement temps réel, une table, une variable d'environnement, une adresse ou un barème qui change met sa page de `docs/reference/` à jour : `server/test/documentation.test.ts` relit la référence contre le code. Un barème est un choix de produit : il se dit, et certains font monter une version pour que l'historique se relise ([les barèmes](../reference/baremes.md)).
7. **`npm run verify` avant de committer** : typecheck, tests, build, smoke — une dizaine de minutes, la première étape qui échoue arrête tout.
8. **La PR.** La CI, « Vérification », rejoue les quatre étapes sur Node 22 ; une poussée plus récente sur la même branche annule l'exécution en cours.
9. **La fusion sur `main`** déploie la préproduction d'elle-même ; la production se déploie à la main ([la mise en ligne](../exploitation/mise-en-ligne.md)).

## Où trouver quoi

| Tu cherches | Va voir |
|---|---|
| Ce que fait l'application, sans le code | [`docs/produit/`](../produit/vue-d-ensemble.md) |
| Comment le système tient debout | [l'architecture](../architecture/vue-d-ensemble.md), puis [le serveur](../architecture/serveur.md), [le temps réel](../architecture/temps-reel.md), [les données](../architecture/donnees.md), [le client](../architecture/client.md) |
| Ce qu'il ne faut jamais casser, et pourquoi | [les décisions](../architecture/decisions.md) et les invariants de `CLAUDE.md` |
| Une route, un événement, une table, une variable, une constante | [la référence](../README.md#la-référence) |
| Comment ajouter une sorte de question, un haut fait, un thème | [les recettes](recettes.md) |
| Ce qui a été livré, et quand | [l'historique](historique.md) |
| Ce que des agents ont trouvé en jouant | `retours/` ([travailler avec Claude](outillage-claude.md)) |

## Pour aller plus loin

- [Les tests](tests.md) — `npm run verify`, le banc, écrire une épreuve, les pièges
- [Les conventions](conventions.md) — les commentaires, les noms, les textes, le CSS, les dépendances
- [Travailler avec Claude](outillage-claude.md) — la mémoire du dépôt, les skills, la tablée
- [Les commandes](../reference/commandes.md) — chaque script, ses options, ses variables
