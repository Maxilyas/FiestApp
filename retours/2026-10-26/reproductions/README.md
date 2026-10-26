# Les reproductions de la relecture des régressions

Chaque fichier rejoue un constat de `../constats.json` (famille
`regressions-serveur` ou `regressions-page`) contre le code du 26 octobre 2026
(`68e3d31`) : rouge ce jour-là, il prouve le constat. Les corrections en ont
tiré leurs épreuves dans `server/test/` ; ces fichiers-ci ne sont lancés par
aucune suite.

```bash
cd server && node --import tsx --test --test-timeout=120000 ../retours/2026-10-26/reproductions/<fichier>.test.ts
```
