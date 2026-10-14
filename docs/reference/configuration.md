# La configuration

> Chaque variable d'environnement que lit le serveur de FiestApp : son rôle,
> sa valeur par défaut, quand elle est obligatoire, et où le code la lit. Pour
> qui installe, met en ligne ou dépanne un serveur.

**Dans cette page** : [Où se règle la configuration](#où-se-règle-la-configuration) ·
[Le mode « en ligne »](#le-mode--en-ligne-) ·
[Les bases](#les-bases) ·
[L'adresse et le réseau](#ladresse-et-le-réseau) ·
[Le premier démarrage](#le-premier-démarrage) ·
[La salle et la routine du matin](#la-salle-et-la-routine-du-matin) ·
[Ce que pose l'hébergeur](#ce-que-pose-lhébergeur) ·
[Les deux services en ligne](#les-deux-services-en-ligne) ·
[Ce que le serveur ne lit pas](#ce-que-le-serveur-ne-lit-pas)

## Où se règle la configuration

Tout passe par l'environnement du processus, et presque tout est lu une seule
fois, au démarrage, par `server/src/index.ts` — qui la transmet à
`createQuizServer` (`server/src/server.ts`). Seules `WIFI_SSID` et `WIFI_PASS`
sont lues ailleurs, au moment où le serveur construit la salle
(`server/src/server.ts`). Ni le client, ni `shared/`, ne lisent de variable
d'environnement : ce que la page doit savoir de l'environnement, le serveur
l'écrit dans la page qu'il sert (la balise `app-env`, voir `APP_ENV`).

Aucun fichier `.env` n'est lu : chez soi, les variables se posent dans le
terminal qui lance le serveur ; en ligne, sur le tableau de bord de
l'hébergeur ([La mise en ligne](../exploitation/mise-en-ligne.md)). Une
variable changée ne vaut qu'au démarrage suivant.

Les variables propres à un outil de `server/scripts/` — la source d'un
transfert de bibliothèque, l'espace visé par un test de charge, les réglages
des scripts de rendu — sont décrites avec leur commande, dans
[Les commandes](commandes.md). Celles qu'un script lit **et** le serveur aussi
sont ici, et leur ligne dit ce que le script en fait.

## Le mode « en ligne »

Le serveur se tient **en ligne** quand `RENDER` est posée (non vide) ou que
`NODE_ENV` vaut `production` (`online`, `server/src/index.ts`). Ce mode ne
change pas une chose, mais cinq :

| Effet | Pourquoi | Où |
|---|---|---|
| Refus de démarrer sans `QUIZ_DB_URL` (« ❌ QUIZ_DB_URL manquant… ») | le disque de l'hébergeur gratuit s'efface à chaque réveil : sans base permanente, comptes, quiz et soirées disparaissaient au premier réveil | `server/src/index.ts` |
| Un vrai `ADMIN_PASSWORD` exigé tant que la base n'a aucun compte (ni absent, ni `demo`) | l'administrateur ne se crée pas en ligne avec le mot de passe par défaut ; exigé à chaque démarrage, il empêchait la production de se réveiller une fois la variable retirée | `server/src/server.ts` |
| Cookies de session `Secure`, pour l'animateur comme pour le joueur | un cookie de session ne voyage qu'en HTTPS | `server/src/auth/http.ts`, `server/src/auth/routes.ts`, `server/src/auth/profileRoutes.ts` |
| `trust proxy` à un saut : l'adresse d'un client est la **dernière** entrée de `x-forwarded-for`, celle qu'écrit le proxy de l'hébergeur | la réserve d'inscriptions et les limites d'essais se comptent par adresse | `server/src/server.ts`, `server/src/sockets.ts` |
| Seule l'origine publique (`PUBLIC_URL`, sinon `RENDER_EXTERNAL_URL`) est admise pour la liaison temps réel (« origine refusée ») et pour toute écriture de l'API (403 « Requête refusée ») | une page d'un autre site ne doit ni ouvrir une liaison, ni écrire au nom d'un visiteur ; les scripts, qui n'envoient pas d'en-tête `Origin`, passent | `server/src/server.ts` (`allowRequest`), `server/src/auth/http.ts` (`csrfGuard`) |

> [!WARNING]
> Ne pose jamais `NODE_ENV=production` sur un PC servi en HTTP : les
> téléphones refusent les cookies `Secure`, et plus personne ne garde sa
> connexion. Ni pendant la construction : `npm ci` saute alors les
> `devDependencies`, Vite et esbuild manquent, et `npm run build` échoue.
> Render n'en a pas besoin : `RENDER` suffit.

## Les bases

| Variable | Rôle | Défaut | Obligatoire | Où le code la lit |
|---|---|---|---|---|
| `QUIZ_DB_URL` | L'adresse de la base permanente — comptes, profils, quiz, historique, quiz du jour, campagne, miroir de la soirée. `libsql://…` ou `https://…` pour Turso, `file:…` pour un fichier ; les espaces autour sont retirés. Les scripts `npm run sauvegarde`, `npm run export` et `npm run migrate` (sa destination) la lisent aussi | `file:` suivi du dossier de `DB_PATH` et de `quizzes.db` (chez soi : `server/data/quizzes.db`) | **en ligne, oui** : le serveur refuse de démarrer sans elle ; un `file:` donné exprès reste permis, pour qui s'héberge sur un disque durable | `server/src/index.ts` |
| `QUIZ_DB_TOKEN` | Le jeton de la base permanente. Jamais écrit au journal : une base injoignable s'y dit par son seul hôte. Les mêmes scripts la lisent | aucun | si la base l'exige (Turso, oui ; un fichier, non) | `server/src/index.ts` |
| `QUIZ_DB_KEEPALIVE_MS` | Combien de temps garder une connexion inactive vers la base permanente, en millisecondes, de 1 000 à 600 000, lue comme un humain l'écrit (`30000`, `30 000`) : sans elle, chaque requête qui suit une pause de plus de 4 s repaie sa poignée de main — 225 ms l'aller-retour contre 29 sur une connexion gardée, en production, le 14 octobre 2026 (`server/src/core/connexions.ts`). Plus longue que le délai de Turso, une requête tomberait sur une connexion déjà fermée : elle s'essaie en préproduction, la page « Le serveur » du QG ouverte — des connexions refermées par Turso ou des allers-retours tombés en route disent qu'elle est trop longue. Un délai que Turso annonce (`Keep-Alive`) passe avant elle. Illisible ou hors des bornes, le journal du démarrage le dit (« [base] … ») ; `/healthz` dit celle qui vaut (`base.connexions.gardeMs`) | aucun : les 4 s du `fetch` de Node (`GARDE_DE_NODE_MS`) | non | `server/src/index.ts` |
| `DB_PATH` | Le fichier SQLite de la base locale, jetable : la soirée en cours de chaque espace. Le dossier est créé au besoin. `npm run start:qa -w server` la pose dans un dossier temporaire | `server/data/quizz.db` | non | `server/src/index.ts`, `server/scripts/qa-start.ts` |

Le détail des deux bases et de chacune de leurs tables :
[Les données](../architecture/donnees.md) et
[La base de données](base-de-donnees.md).

## L'adresse et le réseau

| Variable | Rôle | Défaut | Obligatoire | Où le code la lit |
|---|---|---|---|---|
| `PORT` | Le port d'écoute ; `0` en prend un libre (les tests) | `3001` | non | `server/src/index.ts` |
| `PUBLIC_URL` | L'adresse publique du serveur. Elle fait quatre choses : la base de l'adresse que porte le QR de l'écran commun (`<adresse>/<espace>`) ; en ligne, la seule origine admise pour la liaison temps réel et les écritures de l'API ; la base des balises d'aperçu d'une page partagée ; et, si elle est en `https://`, le contact que le serveur donne aux services de push du rappel du soir | `RENDER_EXTERNAL_URL` ; sinon, chez soi, `http://<adresse du PC>:<port>` — la première IPv4 du réseau local, `192.168.*` d'abord, puis `10.*` | non ; **oui pour un domaine à soi** : sans elle, l'origine admise reste l'adresse `onrender.com`, et les connexions venues du domaine sont refusées | `server/src/index.ts`, `server/src/server.ts` |
| `WIFI_SSID` | Le nom d'un réseau wifi à rejoindre : l'écran commun — lui seul, jamais les téléphones — affiche alors un second QR, « 1 · Wi-Fi », à côté de « 2 · Le quiz ». `npm run start:qa -w server` pose `QuizzDemo` | aucun : pas de QR wifi | non | `server/src/server.ts`, `server/scripts/qa-start.ts` |
| `WIFI_PASS` | Son mot de passe ; vide, le QR décrit un réseau ouvert. `npm run start:qa -w server` pose `demo1234` | vide | non | `server/src/server.ts`, `server/scripts/qa-start.ts` |

L'adresse du PC est devinée : un VPN ou une carte réseau virtuelle peuvent
l'emporter sur le wifi. `PUBLIC_URL=http://<adresse>:3001` la force.

## Le premier démarrage

Ces quatre variables ne servent qu'une fois : sur une base permanente qui n'a
encore **aucun compte**, le serveur crée l'administrateur et son espace avec
elles (`ensureDefaultSpace`, `server/src/auth/store.ts`). Ensuite, plus rien
ne s'en sert — sauf les scripts qui se connectent comme l'animateur, et le
journal du démarrage, qui recopie `ADMIN_SLUG` et `ADMIN_LOGIN` tels qu'ils
sont posés (ou leur défaut) dans ses adresses. Le mot de
passe se change depuis « Mon compte », et `ADMIN_PASSWORD` peut être retirée
de l'hébergeur.

| Variable | Rôle | Défaut | Obligatoire | Où le code la lit |
|---|---|---|---|---|
| `ADMIN_LOGIN` | L'identifiant de l'administrateur : 2 à 32 caractères, lettres, chiffres, point, tiret ou tiret bas, mis en minuscules. `server/scripts/login.mjs` s'en sert pour connecter le test de charge et l'écran commun en ligne de commande | `antoine` | non | `server/src/index.ts`, `server/scripts/login.mjs` |
| `ADMIN_PASSWORD` | Son mot de passe d'amorçage. Les mêmes scripts s'en servent | `demo` | **en ligne sur une base sans compte, oui**, et différent de `demo` : sinon le serveur refuse de démarrer (« ❌ ADMIN_PASSWORD manquant… ») | `server/src/index.ts`, `server/src/server.ts`, `server/scripts/login.mjs` |
| `ADMIN_SLUG` | Le nom de son espace dans l'adresse (`/chez-antoine`) : 2 à 24 caractères, minuscules, chiffres, tirets, ni un mot réservé (une page de l'application), ni six chiffres (un code de salon) | `demo` | non | `server/src/index.ts` |
| `ADMIN_NAME` | Son prénom, affiché partout, titre de soirée par défaut compris | `Antoine` | non | `server/src/index.ts` |

Un identifiant ou un nom d'espace invalide fait échouer ce premier démarrage :
« ❌ Démarrage impossible », suivi de la règle qui n'est pas tenue.

## La salle et la routine du matin

| Variable | Rôle | Défaut | Obligatoire | Où le code la lit |
|---|---|---|---|---|
| `MAX_PLAYERS` | Le plafond d'invités d'une soirée, pour **chaque** espace — pas leur somme : le réglage « Invités au plus » d'un espace ne le dépasse jamais. Le journal du démarrage et `/healthz` (`maxPlayers`) disent la valeur en vigueur. Une valeur illisible ou `0` vaut le défaut | `500` (`MAX_PLAYERS_CEILING`) ; un espace neuf se règle à 150 (`DEFAULT_MAX_PLAYERS`) | non ; `150` est posé en ligne, au-delà le dixième de processeur de l'offre gratuite ne suit plus | `server/src/index.ts`, `server/src/core/space.ts` |
| `APP_ENV` | Le nom de l'environnement, quand ce n'est pas la production (`preprod`). Il devient un badge en bas de chaque page et un préfixe du titre de l'onglet (`[preprod]`), via la balise `<meta name="app-env">` que le serveur glisse dans chaque page servie ; `/healthz` le dit (`env`), le journal du démarrage aussi, et la page « Le serveur » du QG le range avec chaque démarrage | aucun : `/healthz` dit `production` | non | `server/src/index.ts`, `server/src/server.ts`, `client/src/main.tsx` |
| `RESERVE_TOKEN` | Le jeton de la routine du matin. Il ouvre six routes, et rien d'autre : la consigne et le dépôt de la réserve du quiz du jour (`/api/jour/reserve`), son étiquetage (`/api/jour/reserve/etiquetage`), la commande et le dépôt de la base de la campagne (`/api/campagne/base`). Il n'efface rien ; mais l'étiquetage rend les questions à venir **avec leur bonne réponse** : il se garde comme un mot de passe, chaque service le sien | aucun : ces routes répondent 404 « Le dépôt automatique n’est pas ouvert sur ce serveur » | non ; sous **32 caractères**, la porte reste fermée et le journal du démarrage le dit (« [jour] RESERVE_TOKEN fait moins de 32 caractères… ») | `server/src/index.ts`, `server/src/quizDuJour.ts` (`porteDeLaReserve`) |

Le jeton se présente en `Authorization: Bearer <jeton>` ; le serveur compare
les empreintes en temps constant, et un jeton faux reçoit un 401 « Jeton de la
réserve refusé ». La routine elle-même :
[La mise en ligne](../exploitation/mise-en-ligne.md).

## Ce que pose l'hébergeur

Render pose ces variables dans l'environnement de chaque service ; ailleurs,
elles manquent, et le serveur s'en passe.

| Variable | Rôle | Défaut | Obligatoire | Où le code la lit |
|---|---|---|---|---|
| `RENDER` | Posée à `true` sur chaque service : met le serveur en ligne | absente : hors ligne | non | `server/src/index.ts` |
| `NODE_ENV` | `production` met aussi le serveur en ligne ; Render ne la pose pas, et c'est voulu (l'encadré plus haut) | absente | non | `server/src/index.ts` |
| `RENDER_EXTERNAL_URL` | L'adresse `onrender.com` du service : le repli de `PUBLIC_URL` | absente | non | `server/src/index.ts` |
| `RENDER_GIT_COMMIT` | Le commit déployé : ses sept premiers caractères deviennent la version que disent `/healthz` (`version`), le journal (« [serveur] prêt en … — version abc1234 ») et la page « Le serveur » du QG | absente : pas de version | non | `server/src/index.ts` |
| `NODE_VERSION` | La version de Node que Render installe : `22`, celle de l'intégration continue. Le code ne la lit pas | celle de Render | non | `render.yaml` |

## Les deux services en ligne

`render.yaml` décrit les deux services, la production et la préproduction ;
leur tableau de bord fait foi. Les variables marquées « à saisir » y portent
`sync: false` : leur valeur ne vit que sur le tableau de bord, jamais dans le
dépôt.

| Variable | Production (`fiestapp-quizz`) | Préproduction (`fiestapp-quizz-preprod`) |
|---|---|---|
| `NODE_VERSION` | `22` | `22` |
| `MAX_PLAYERS` | `150` | `150` |
| `APP_ENV` | absente | `preprod` |
| `QUIZ_DB_URL`, `QUIZ_DB_TOKEN` | à saisir : la base Turso de production | à saisir : **sa base à elle**, jamais celle de la production |
| `ADMIN_LOGIN`, `ADMIN_SLUG` | à saisir | à saisir |
| `ADMIN_PASSWORD` | à saisir, le temps du premier démarrage | à saisir, différent de celui de la production |
| `RESERVE_TOKEN` | à saisir, avec le bouton « Generate » | à saisir, un autre |

`ADMIN_NAME` n'y figure pas : sans elle, l'administrateur s'appelle
« Antoine ». `PUBLIC_URL` non plus : `RENDER_EXTERNAL_URL` en tient lieu,
jusqu'à un domaine à soi.

## Ce que le serveur ne lit pas

- **Les variables des scripts** : la source d'un transfert de bibliothèque
  (`QUIZ_DB_URL_FROM`, `QUIZ_DB_TOKEN_FROM`), l'espace d'un test de charge
  (`QUIZ_SLUG`), le dossier où une commande a été tapée (`INIT_CWD`, que npm
  pose), le rapporteur des tests sous Claude Code (`CLAUDECODE`), et les
  réglages des scripts de rendu et des peintures — voir
  [Les commandes](commandes.md).
- **L'environnement de la routine du matin**, côté Claude Code : `RESERVE_TOKEN`
  (la même valeur que sur le service) et `FIESTAPP_URL` (l'adresse du service
  qu'elle remplit). Le serveur ne les voit jamais.
- **Le hook de session de Claude Code** (`.claude/hooks/session-start.sh`) lit
  `CLAUDE_CODE_REMOTE` et `CLAUDE_PROJECT_DIR` : il n'installe les
  dépendances que dans une session sur le web, et en `--no-save`, pour ne pas
  réécrire `package-lock.json`.
- **Un fichier `.env`** : `.gitignore` l'écarte, mais rien ne le lit.

## Pour aller plus loin

- [La mise en ligne](../exploitation/mise-en-ligne.md) — où poser chaque variable sur Render, et dans quel ordre
- [Exploiter](../exploitation/exploiter.md) — ce que `/healthz` et le journal disent des valeurs en vigueur
- [Les commandes](commandes.md) — les commandes npm, les scripts et leurs variables
- [La sécurité](../architecture/securite.md) — les sessions, les cookies, l'origine, les limites d'essais
