# La lecture de la base de production

La consigne qu'a reçue, le 14 octobre 2026, la session qui a lu la base de
production pour cette revue — telle quelle. Les deux variables de lecture
ne se voient que d'une session ouverte après leur ajout : on ouvre une
session neuve sur le dépôt, dans le même environnement, et on lui colle le
texte ci-dessous.

Ce que la session ne peut pas dire : la tenue des connexions vers Turso.
Elle passe par un proxy de sortie qui rouvre le TLS, et c'est lui qu'elle
mesure (le point 2 décrit le proxy, pas Turso). Les temps des requêtes,
moins celui d'un `SELECT 1`, restent comparables d'une lecture à l'autre.

À relire après le prochain déploiement : l'économie (`JOIN` contre `CROSS
JOIN`) et les séries du QG (`UNION` contre `UNION ALL`) sur leurs index
(`idx_campagne_series_commencee`, `idx_profile_xp_quand`, que la production
n'avait pas), et le modèle du savoir, qui n'y tournait pas encore.

---

Mesure la base Turso de PRODUCTION de FiestApp, en LECTURE SEULE, pour la revue de performance de la PR #211. Deux variables d'environnement y donnent accès : celle dont le nom contient « lecture » et « url » est l'adresse libsql, l'autre le jeton.

RÈGLES ABSOLUES
- Uniquement des lectures : SELECT, EXPLAIN QUERY PLAN, PRAGMA table_info, sqlite_master. Jamais d'INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, ni de batch en mode 'write'.
- N'affiche jamais le jeton ni l'adresse complète (seulement le segment de région de l'hôte).
- Aucune donnée personnelle dans la sortie : ni prénom, ni identifiant, ni id de profil, ni contenu de quiz. Des comptes, des tailles, des plans, des temps.
- Ne modifie rien dans le dépôt, ni branche, ni commit, ni PR. Scripts dans /tmp. Chaque requête sous try/catch, délai de 60 s.

COMMENT
Un script Node ESM dans /tmp : `createRequire('<racine du dépôt>/server/package.json')('@libsql/client')`, puis `createClient({ url, authToken, fetch: avecTrace })`, où `avecTrace` chronomètre chaque aller-retour et garde les en-têtes de la première réponse.

À MESURER
1. La région (segment de l'hôte) et les en-têtes de la première réponse de Turso : `keep-alive`, `connection`, `server`, tout en-tête de région.
2. `SELECT 1` cinq fois espacés de 6 s, puis dix fois d'affilée (médiane, pire). Puis, avec le dispatcher global remplacé par un agent au `keepAliveTimeout` de 120 s (`const CLE = Symbol.for('undici.globalDispatcher.1'); globalThis[CLE] = new globalThis[CLE].constructor({ keepAliveTimeout: 120_000, keepAliveMaxTimeout: 600_000 })`, après un premier fetch) : `SELECT 1` après 10, 30, 60 et 90 s de calme — réussi ou non, son temps, connexion neuve ou non (canal `diagnostics_channel` 'undici:client:connected'), erreur éventuelle (`other side closed`, `UND_ERR_SOCKET`).
3. Les tables et le `COUNT(*)` de chacune ; si `qg_sante` et `qg_demarrages` existent.
4. Les index (`SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index'`).
5. Plan, temps (médiane de trois, moins `SELECT 1`), lignes et octets de : la mesure des difficultés (`mesures`), la lecture du savoir (`LECTURE_DU_SAVOIR`), le carnet (`suivisDe`) tel quel et réécrit en `EXISTS`, les vues d'un joueur (`lectureDesVues`), les duels de tous (`lectureDesDuels(null)`), la réserve du jour (`etatDeLaReserve` et `avanceDeLaReserve`), l'économie en `JOIN` puis `CROSS JOIN`, les victoires du jour (`lecturesDesStats`), les séries du QG en `UNION` puis `UNION ALL`, et ce que lit chaque réveil (quizzes, soirees, profile_xp `NOT LIKE '{"v":7,%'`, party_*, accounts, sessions) — octets seulement. Les requêtes exactes sont dans `server/src/core/campagne.ts`, `jour.ts`, `auth/profiles.ts` et dans `retours/2026-10-14/reproductions/plans.mjs`. Pour celles qui prennent un profil : celui qui a le plus de réponses de campagne, ou de parties du jour, sans afficher son id.

RÉPONSE : un seul bloc ```json``` avec tout, puis cinq lignes de commentaire en français.
