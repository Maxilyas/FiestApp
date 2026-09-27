# Les reproductions

Ce que les experts et les contre-experts ont écrit pour **prouver** leurs
constats : une épreuve `node:test` par défaut, qui échoue sur le code de
`main` au 26 septembre 2026 (b57035c) et passe le jour où il est corrigé.
C'est le premier jet de l'épreuve de chaque correction : la règle du dépôt
(« un nouveau comportement arrive avec son test dans `server/test/`, qui
échoue avant la correction ») commence ici.

Elles ont été écrites pour tourner depuis `export/evaluations/<mission>/`,
le dossier de travail de la session (ignoré par git) : leurs chemins
relatifs vers le banc (`../../../server/test/banc`) en dépendent, et
quelques-unes citent encore des chemins absolus de la machine d'alors. Pour
en rejouer une :

```bash
mkdir -p export/evaluations
cp -r retours/2026-09-27/reproductions/* export/evaluations/
cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
  ../export/evaluations/<mission>/<nom>.test.ts
```

Celles qui pilotent un navigateur (`jour-ecran-navigateur`,
`design-recompenses`, `editeur-navigateur`, certaines de `client/`)
attendent un client construit dans leur dossier
(`cd client && npx vite build --outDir ../export/evaluations/<mission>/dist`)
et Playwright parmi les modules globaux.

Le constat que chaque épreuve prouve est dans `../constats.json` (champ
`reproduction`), avec le verdict de sa contre-expertise.

Quand une correction reprend une épreuve, elle la **déplace** dans
`server/test/` en l'adaptant au banc (chemins, noms) — pas l'inverse : ce
dossier est une archive, il ne tourne pas en intégration continue.
