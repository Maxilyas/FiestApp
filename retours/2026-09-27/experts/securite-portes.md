# securite-portes — rapport de l'expert sécurité applicative (portes HTTP)

## En bref

Les portes HTTP sont, dans l'ensemble, bien tenues : mots de passe scrypt avec
sel et comparaison en temps constant, `dummyHash` contre l'oracle de temps,
protection anti-requête-forgée à deux étages (en-tête maison + origine en
ligne) posée **avant** la lecture du corps, cookies `HttpOnly`/`SameSite=Lax`/
`Secure`, CSP sans script tiers avec `frame-ancestors 'none'`, photos servies
par UUID seul (SVG refusé, pas de traversée), jeton de la réserve comparé en
temps constant. Le cloisonnement inter-espaces a déjà été éprouvé (rapport
`robustesse-espaces` du 24) et la réserve d'inscriptions est désormais par
`(adresse, espace)`.

La faille que je rapporte tient à **une seule idée** : une session créée pour
un usage limité — une **télé appairée** (24 h, « souvent celle de quelqu'un
d'autre : le bar, les parents, la salle louée ») ou une **console ouverte par
le cookie d'un profil** (un an, « un téléphone se prête en soirée ») — a, au
niveau des routes, **tous les pouvoirs d'une console de gestion**, y compris
les gestes **irréversibles** que l'invariant 16 s'échine à contenir : rattacher
un profil à l'espace, et (pour un administrateur) réinitialiser le mot de passe
du compte. Les trois améliorations les plus rentables : (1) refuser les routes
d'identité et d'administration aux sessions appairées (`fin_max` posé) ; (2)
refuser un lien d'activation pour son propre compte, comme la désactivation et
la suppression le font déjà ; (3) documenter/arbitrer le verrou de compte par
identifiant, ouvert « d'où que viennent les essais ».

## Méthode

- **Lecture** (env. 3 h) : `server/src/server.ts` (ordre des `app.use`, en-têtes,
  CSP, injection dans `index.html`), `api.ts`, tout `auth/` (`store.ts`,
  `routes.ts`, `profileRoutes.ts`, `http.ts`, `password.ts`, `appairage.ts`),
  `partages.ts` + `core/partages.ts`, `quizDuJour.ts` + les routes de
  `core/jour.ts`, `core/http.ts`, `core/apercus.ts`, `core/page.ts`,
  `core/precompresse.ts`, `core/budget.ts`, `core/inscriptions.ts`,
  `core/export.ts`, `core/quizStore.ts` (photos), `core/pages.ts`,
  `shared/securite.ts`, `shared/adresses.ts`, `shared/space.ts`,
  `shared/partage.ts`, `shared/library.ts` ; côté client `api.ts`, `AdminApp.tsx`,
  `HostApp.tsx`, `EditorApp.tsx`, `LoginApp.tsx`, et une recherche
  `dangerouslySetInnerHTML`/`innerHTML`/SVG construit (aucune occurrence).
- **Reproductions** (`node:test` sur le banc jetable, `nice -n 10`, un fichier à
  la fois ; charge machine `uptime` ≈ 0,2) :
  - `export/evaluations/securite-portes/sessions.test.ts` — 4 épreuves, **toutes
    en échec aujourd'hui** (elles décrivent le comportement voulu après
    correction) ;
  - `export/evaluations/securite-portes/defenses.test.ts` — 9 épreuves, **toutes
    vertes** : elles constatent les contrôles qui tiennent.
- **Non couvert** : le vrai proxy de Render (`x-forwarded-for` réel, un ou
  plusieurs sauts), `npm audit` (réseau non tenté), les sockets et l'étanchéité
  temps réel (angle `securite-temps-reel`), la triche du quiz du jour (angle
  `jour-regles`).

## Constats

### 1. Une session appairée (ou de profil) garde tous les pouvoirs d'une console — dont le rattachement d'un profil, irréversible

- **Où** : `server/src/auth/routes.ts:204` (`POST /api/space/profil` : `account`,
  aucun garde `fin_max`) ; `server/src/auth/store.ts:257` (`linkProfile` remplace
  `accounts.profile_id`) ; `server/src/auth/appairage.ts:198` (la session de la
  télé, `dureeMax: TELE_BRANCHEE_MS`).
- **Constat** : la télé appairée reçoit une vraie session d'animateur de
  l'espace (invariant 16 : « elle tient comme l'écran commun »). Au niveau des
  routes, rien ne la distingue d'une console : `requireAccount` la laisse passer
  partout. Or `/api/space/profil` ne demande que la session **plus** un
  identifiant/mot de passe **de profil** — ceux de qui est devant la télé, pas
  ceux du compte. Un profil quelconque se rattache ainsi à l'espace, ce qui
  **remplace** le profil de l'animateur : dès lors, l'intrus ouvre la console de
  l'espace **quand il veut** avec son propre profil (`/api/joueur/console`, un an
  de session), bien après que la télé (24 h) est tombée. La chaîne d'appairage
  n'est pas plafonnée non plus : une télé encore ouverte en branche une autre,
  qui repart pour 24 h, indéfiniment.
- **Preuve** : `sessions.test.ts`, épreuve « une télé branchée ne rattache pas… »
  → `rattachement depuis la télé : 200 · console de l'intrus à t0+48 h : 200
  (chez-bruno)` ; épreuve « une télé branchée par une télé… » →
  `fin_max … : 47 [heures] · seconde télé à t0+25 h : 200`.
- **Qui ça touche, ce que ça coûte** : l'animateur qui branche une télé ailleurs
  qu'à demeure (le scénario même que l'appairage vise). Un tiers présent devant
  la télé prend l'espace pour de bon, et l'animateur ne le récupère qu'en
  reconnaissant son mot de passe **de compte** (celui que la « porte unique »
  l'encourageait justement à ne plus retenir) pour détacher l'intrus.
- **Statut** : bug confirmé (rejoué) — tension avec l'invariant 16, dont
  l'esprit (une télé branchée ne dure qu'une soirée) est contourné.
- **Piste** : marquer les sessions à `fin_max` (télé) comme « écran » et leur
  refuser les routes d'identité/administration — au minimum `/api/space/profil`,
  `/api/space/profil` (DELETE), `/api/admin/*` et `/api/auth/appairage/valider` :
  ```ts
  // auth/http.ts — à côté de requireAccount
  export const refuserEcran = (req, res, next) =>
    (res.locals as AuthedLocals).session?.finMax != null
      ? res.status(403).json({ error: 'Cet écran ne peut pas gérer le compte — fais-le depuis ton téléphone' })
      : next()
  ```
  (il faut alors exposer la `SessionRec` dans `res.locals`, que `requireAccount`
  a déjà en main via `resolveSession`).
- **Priorité · effort** : P2 · S–M.

### 2. Une session d'administrateur réinitialise le mot de passe de son propre compte via un lien d'activation, sans l'actuel

- **Où** : `server/src/auth/routes.ts:283` (`POST /api/admin/accounts/:id/activation` :
  ne vérifie que `target.disabledAt`, **sans** le garde `target.id ===
  accountOf(res).id` que portent la désactivation `:304` et la suppression
  `:343`) ; `:145` (`POST /api/auth/activate` : change le mot de passe **sans
  demander l'actuel**, puis ouvre une session **sans `fin_max`**, soit une
  console 30 jours) ; `client/src/views/AdminApp.tsx:137` (le bouton « Lien »
  s'affiche dès `status !== 'disabled'`, **y compris sur sa propre ligne**).
- **Constat** : `/api/auth/password` exige, à raison, le mot de passe actuel
  (`routes.ts:181`). Mais l'administrateur peut se forger un lien d'activation
  pour son propre `id`, puis l'échanger contre un nouveau mot de passe **sans
  connaître l'ancien**. Toute session d'administrateur suffit — y compris une
  **télé appairée** (24 h) ou une **console ouverte par le cookie du profil de
  l'administrateur** (borné par le constat 1). La session issue de `/activate`
  n'a pas de `fin_max` : une possession temporaire de 24 h devient une console
  de 30 jours, et le vrai propriétaire est mis dehors (son ancien mot de passe
  et sa console tombent).
- **Preuve** : `sessions.test.ts`, épreuve « une télé branchée par l'administrateur… »
  → `lien d'activation pour soi : 200 · activation : 200 · console d'Antoine
  ensuite : 401 · ancien mot de passe : 401 · nouveau : 200` ; épreuve « une
  console ouverte par le cookie d'un profil… » → `/api/auth/password sans
  l'actuel : 400 · lien d'activation pour soi : 200`.
- **Qui ça touche, ce que ça coûte** : l'administrateur, dont le compte régit
  **tous** les espaces (création, désactivation, suppression, catalogue,
  espace par défaut des anciennes adresses). Le rayon de souffle est donc le
  serveur entier ; seule la précondition (une session d'administrateur dans
  d'autres mains) le maintient en P2 plutôt qu'en P1.
- **Statut** : bug confirmé (rejoué).
- **Piste** : refuser l'auto-activation, comme les deux autres gestes de
  `/admin` :
  ```ts
  // routes.ts, POST /api/admin/accounts/:id/activation
  if (target.id === accountOf(res).id)
    return res.status(400).json({ error: 'Change ton propre mot de passe depuis « Mon compte »' })
  ```
  et masquer « Lien » sur sa propre ligne (`AdminApp.tsx`, `a.id !== me.account.id`).
  Cumuler avec le garde « écran » du constat 1 pour les télés appairées.
- **Priorité · effort** : P2 (rayon serveur) · S.

### 3. Le verrou d'un compte se pose par identifiant, d'où que viennent les essais

- **Où** : `server/src/auth/http.ts:154` (`LoginBudget.failed` : cinq échecs sur
  une clé `compte:<login>` / `joueur:<login>` la ferment 15 min) ; `:147`
  (`allow` refuse ensuite quelle que soit l'adresse).
- **Constat** : la réserve par adresse (20 d'un coup, 20/min) limite le débit,
  mais le verrou par identifiant, lui, ne regarde pas d'où viennent les essais.
  Un identifiant connu — celui des variables d'exemple, le prénom de l'espace —
  peut être fermé 15 minutes par cinq échecs, répétables. C'est une atteinte à
  la **disponibilité** (verrouillage de compte), pas à la confidentialité.
- **Preuve** : lecture. C'est le comportement décrit dans `CLAUDE.md` (« cinq
  échecs de suite sur un même identifiant … d'où que viennent les essais ») et
  `MISE-EN-LIGNE.md` : il est **voulu** comme garde-fou anti-force-brute.
- **Statut** : tension avec un parti pris (le verrou est assumé). À arbitrer :
  pour une application de fête à une poignée de comptes, le risque de
  verrouillage malveillant est faible, mais réel la veille d'une soirée.
- **Piste** (si l'on veut le lever) : ne verrouiller par identifiant que
  au-delà d'un seuil bien plus haut, en s'appuyant surtout sur la réserve par
  adresse ; ou n'appliquer le verrou qu'aux adresses déjà vues échouer, pas à la
  prochaine connexion de l'animateur. À ne pas faire sans le dire (c'est un choix
  de produit).
- **Priorité · effort** : P3 · S.

### 4. Les clés de limitation reposent sur la dernière entrée de `x-forwarded-for`

- **Où** : `server/src/auth/http.ts:79` (`clientIp = req.ip`, avec
  `trust proxy 1`) et `server/src/sockets.ts:124` (dernière entrée de
  `x-forwarded-for`).
- **Constat** : la réserve de connexion par adresse et la réserve
  d'inscriptions se comptent sur `req.ip`, qui vaut la **dernière** entrée de
  `x-forwarded-for` en supposant **exactement un** proxy devant le serveur. Si
  l'hébergeur en place plusieurs, ou si l'instance est jointe en direct, un
  client choisit son adresse (évasion des limites, ou consommation de la réserve
  d'une victime).
- **Preuve** : lecture. Déjà signalé comme question ouverte dans
  `MISE-EN-LIGNE.md` (« x-forwarded-for falsifiable ? », vérifiable au journal
  des clôtures : `x-forwarded-for : 1 entrée`).
- **Statut** : non confirmé en production (dépend du proxy réel de Render) —
  point de vigilance connu, pas un nouveau constat.
- **Piste** : garder la vérification par le journal (« toujours 1 entrée »
  = un seul proxy) ; sinon, compter les sauts et rejeter les en-têtes en trop.
- **Priorité · effort** : P3 · S.

## Mesures et cartes

### Carte des portes HTTP (méthode · chemin · qui · `space_id` · réserve · CSRF)

Toutes les routes `/api/*` passent d'abord par `csrfGuard` (en-tête maison +
origine en ligne). « avant la porte » = montée avant `requireAccount`.

| Méthode · chemin | Qui l'appelle | `space_id` | Réserve | CSRF |
|---|---|---|---|---|
| POST /api/auth/login | public | — | IP + `compte:<login>` | oui |
| POST /api/auth/activation, /activate | public | — | IP | oui |
| POST /api/auth/logout, /password | session | — | (password : IP+`compte`) | oui |
| POST/DELETE /api/space/profil | session | session | `joueur:<login>` (POST) | oui |
| PUT /api/space/settings | session | session | — | oui |
| GET /api/admin/accounts | admin | — | — | oui |
| POST /api/admin/accounts, …/activation, …/disable, …/enable, PUT …/:id, DELETE …/:id | admin | — | — | oui |
| POST /api/auth/appairage, …/attente | public (télé) | — | IP (demande) | oui |
| POST /api/auth/appairage/valider | session | session | IP+`appairage:<sid>` | oui |
| POST /api/joueur/inscription | avant la porte, public | — | IP (`Budget(10,5)`) | oui |
| POST /api/joueur/connexion, /secours, /mot-de-passe | avant la porte, public/cookie profil | — | IP + `joueur\|secours:<login>` | oui |
| GET/PUT /api/joueur/moi ; POST /api/joueur/console, /deconnexion | avant la porte, cookie profil | — | — | oui |
| /api/jour, /jour/commencer, /suivante, /repondre, /classement, /correction/:jour, /signaler | avant la porte, cookie profil | — | — | oui |
| GET/POST /api/jour/reserve | avant la porte, jeton `RESERVE_TOKEN` (temps constant) | — | — | oui |
| /api/admin/jour/*, /api/admin/catalogue/* | admin | — (serveur) | — | oui |
| GET/POST/PUT/DELETE /api/quizzes, /programmes, /soirees/:id, /images | session | **session** (jamais la requête) | — | oui |
| /api/quizzes/:id/partage(s), /catalogue, /partages/recevoir | session | session | recevoir : `10 / 15 min` par espace | oui |
| GET /api/modeles, /api/modeles/:id | session | session (copie) | — | oui |
| GET /media/image/:id | **public**, sans espace (UUID = permission) | — | — | GET |
| GET /media/quiz/* | public (livré avec le dépôt) | — | — | GET |
| GET /s/:slug/*.json | public | slug → espace | — | GET |
| GET /healthz, /robots.txt | public, agrégé sans nom | — | — | GET |

### Ce que `defenses.test.ts` a vérifié (tout vert)

en-têtes (CSP `default-src/script-src 'self'`, `frame-ancestors 'none'`,
`object-src 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`) ·
`Cache-Control: no-store` sur les JSON privés · écriture sans en-tête maison →
403 · écriture d'une autre origine en ligne → 403 · routes montées avant la
porte (inscription, jour, appairage, activate) derrière le garde CSRF ·
cookie `HttpOnly`+`SameSite=Lax`, `Secure` en ligne seulement · `/media/image`
traversée de répertoire → 404, aucun fichier du serveur servi · SVG refusé à
`/api/images`.

## Ce qui marche — à ne pas casser

- **Hachage** : scrypt (N=32768, r=8, p=1, sel 16 o, clé 64 o), `timingSafeEqual`,
  `dummyHash` pour l'oracle de temps, format auto-décrit (`password.ts`).
- **Anti-requête-forgée à deux étages, posé avant la lecture du corps**
  (`api.ts:77`, `csrfGuard`) : un JSON de 4 Mo ne s'analyse pas pour un inconnu.
- **Jeton de la réserve** comparé par empreinte en temps constant, longueur
  minimale imposée au démarrage (`quizDuJour.ts:113`, `index.ts`).
- **Lien d'activation** à usage unique et atomique (`consumeActivation`),
  expirant, qui ne révèle l'identifiant qu'à qui détient le jeton.
- **Erreurs** : seule une `Error` nue parle à l'utilisateur ; toute autre classe
  devient un 500 neutre, le détail au journal (`core/http.ts`).
- **Aperçus de lien** échappés, aucun prénom d'invité, `noindex` hors accueil
  (`core/apercus.ts`, `core/page.ts`).
- **Photos** par UUID v4, formats bornés par le contenu, jamais de SVG
  (`api.ts:459`, `quizStore.ts:274`).
- **CSV d'export** neutralise les formules (`=`,`+`,`-`,`@`) — anti-injection
  tableur (`core/export.ts`).
- **Réserve d'inscriptions** désormais par `(adresse, espace)` + une réserve
  large par adresse (`core/inscriptions.ts`) : le correctif E1 du 24 a été posé.

## Recommandations, dans l'ordre

1. **Refuser un lien d'activation pour son propre compte** (garde self, comme
   disable/delete) et masquer « Lien » sur sa propre ligne — constat 2. P2 · S.
2. **Marquer les sessions appairées (`fin_max`) comme « écran »** et leur
   refuser les routes d'identité/administration (`/api/space/profil`,
   `/api/admin/*`, `/api/auth/appairage/valider`) — constats 1 et 2. P2 · S–M.
3. **Plafonner la chaîne d'appairage** : une session appairée ne valide pas
   d'appairage (découle de la reco 2) — constat 1. P2 · S.
4. **Arbitrer le verrou de compte par identifiant** (disponibilité) et l'écrire
   dans le README si on le garde tel quel — constat 3. P3 · S.
5. **Confirmer le nombre de proxys de Render** au premier vrai déploiement
   (journal des clôtures) — constat 4. P3 · S.
6. **Porter ces épreuves dans `server/test/`** (elles échouent aujourd'hui pour
   1 et 2, passent pour le reste).

## Limites

- Aucun test contre le vrai proxy de Render : `x-forwarded-for` réel et le
  nombre de sauts restent à vérifier en préproduction (constat 4).
- `npm audit --omit=dev` non lancé (réseau non tenté) : versions à revoir
  (express 4, socket.io, @libsql/client, better-sqlite3).
- Les constats 1 et 2 supposent une session d'animateur dans d'autres mains
  (télé appairée ailleurs qu'à demeure, ou téléphone prêté avec la console de
  profil ouverte) : le scénario que ces fonctions visent, mais une précondition
  réelle.
- Rien sur les sockets (angle `securite-temps-reel`) ni sur la triche du quiz
  du jour (angle `jour-regles`).
