# Les portes HTTP : qui entre, qui lit, qui écrit (`securite-portes`)

**Ton angle** : auditeur de sécurité applicative (OWASP ASVS niveau 2). **Ta
question** : par quelle porte HTTP un inconnu, un invité, un joueur à profil
ou un animateur peut-il lire ou écrire ce qui n'est pas à lui — ou faire
tomber le serveur de tous les espaces ? Consignes : `consignes-audit.md`.

**Où regarder** : `server/src/server.ts` (l'ordre des `app.use` : ce qui passe
avant ou après `csrfGuard` et `requireAccount`), `api.ts`, `auth/` (tout :
`store.ts`, `profiles.ts`, `profileRoutes.ts`, `routes.ts`, `http.ts`,
`password.ts`, `appairage.ts`), `partages.ts`, `quizDuJour.ts` (ses routes et
`mountReserve`), `core/http.ts`, `core/apercus.ts` (ce qui est injecté dans
`index.html`), `core/precompresse.ts`, `core/budget.ts`, `core/export.ts`,
`shared/securite.ts`, `shared/adresses.ts`, et côté client `client/src/api.ts`
ainsi que tout `dangerouslySetInnerHTML`, `innerHTML` ou SVG construit.

**Ce que tu cherches** :
- **L'authentification** : hachage des mots de passe (algorithme, coût,
  sel), comparaisons en temps constant, entropie et stockage des jetons de
  session, expiration et glissement (`fin_max`), déconnexion, changement de
  mot de passe et code de secours (invariant 16 : quelles sessions tombent,
  lesquelles restent), lien d'activation (réutilisable ? expirant ?), compte
  désactivé ou supprimé pendant qu'une console est ouverte.
- **Les réserves d'essais** : chaque porte qui vérifie un secret passe-t-elle
  par `loginBudgetOf(app)` ? La création de profils en masse
  (`/api/joueur/inscription`), les codes de partage (dix essais par quart
  d'heure), l'appairage de la télé, `/api/jour/*` et `/api/jour/signaler`
  (répétés mille fois ?). À quelle clé la réserve se compte-t-elle (adresse
  lue derrière le proxy de Render : `trust proxy`, `x-forwarded-for`
  falsifiable ?) — un attaquant peut-il **fermer la porte à un autre** ?
- **Les droits** : chaque route vérifie-t-elle la bonne identité (compte,
  profil, administrateur) et le **`space_id`** dans sa requête SQL
  (invariant 3) ? Essaie les identifiants d'un autre espace sur toutes les
  routes à `:id` (quiz, programmes, soirées, partages, catalogue, images,
  mémoire). Les routes `/api/admin/jour/*` (profils cherchés : que
  renvoient-elles ?), `/api/joueur/console`.
- **Les requêtes forgées** : toute écriture passe-t-elle derrière
  `csrfGuard` (les routes montées « avant la porte des animateurs » —
  profils, quiz du jour, appairage, réserve — aussi) ? Les attributs des
  cookies (`HttpOnly`, `Secure` derrière le proxy, `SameSite`, `Path`).
- **Ce qui entre** : limites de taille des corps, types (`Number(index)` qui
  vaut `NaN`, un tableau à la place d'une chaîne), longueurs (`tronquer`),
  **les fichiers** (image : type vérifié par le contenu ? SVG servi en ligne
  avec son script ? `X-Content-Type-Options` ? taille ?), les chemins
  (`/media/image/:id`, `/media/quiz`, `/s/<espace>/…`, les `.br`/`.gz`
  précompressés) — traversée de répertoire ?
- **Ce qui sort** : injection dans `index.html` (titre d'espace, balises
  d'aperçu, bandeau `APP_ENV`), XSS stockée par un prénom, un titre de quiz,
  un texte de question ou un signalement qui s'affiche chez l'administrateur ;
  redirection ouverte après connexion (`shared/securite.ts`) ; messages
  d'erreur qui trahissent l'intérieur (`erreurMontrable`) ; journaux qui
  écrivent un jeton, un mot de passe ou un cookie.
- **Les en-têtes** : CSP, `frame-ancestors` (la console dans un cadre ?),
  HSTS, `Referrer-Policy` (un lien d'activation ou d'appairage qui fuit par
  le référent), `Cache-Control` des JSON privés.
- **Le déni de service** : les routes publiques coûteuses sans
  authentification, les expressions rationnelles sur une saisie
  (retour arrière catastrophique), les corps JSON profonds.
- **Les dépendances** : `npm audit --omit=dev` si le réseau le permet ; sinon
  les versions de `express`, `socket.io`, `@libsql/client`, `better-sqlite3`.

**Hors de ton angle** : les sockets et l'étanchéité en temps réel
(`securite-temps-reel`), les règles et la triche du quiz du jour
(`jour-regles`) — sauf l'authentification, les requêtes forgées et les
réserves de ses routes, qui sont à toi.

**Ce que tu rends, en plus du modèle** : la carte des routes (méthode · chemin
· qui peut l'appeler · contrôle du `space_id` · réserve d'essais · CSRF), et
pour chaque faille sa reproduction.
