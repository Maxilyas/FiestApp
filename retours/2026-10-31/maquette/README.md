# La maquette jouable du Cabinet en trois actes

La maquette de la proposition `../la-partie.md` : une partie de trois actes sur
une carte 3D, les neuf jeux, les dix cartes, l'or, les cœurs, le marchand, les
coffres, trois gardiens et le légendaire à choisir. Une page hors de
l'application : rien ici n'est servi par FiestApp.

- `index.html` : la page et ses styles.
- `jeu.js` : la partie (génération des actes, cartes, or, cœurs, marchand,
  coffre, gardiens, légendaire). Elle vit dans le `localStorage` du navigateur et
  se reprend où on l'a laissée. Le menu (☰) porte les outils de maquette.
- `jeux.js` : les neuf jeux, repris de la maquette du 24 octobre, jugés en or.
- `scene.js` : la carte 3D (three.js 0.160, chargé depuis jsDelivr comme la tour).
- `donnees.js` : un échantillon de la base de la campagne par thème et par
  difficulté, et les tableaux du Détail, écrits par `extraire.cjs`.
- `contenu.js` : le contenu écrit à la main de la maquette du 24 octobre.

Les images ne sont pas recopiées ici : `construire.sh` les prend dans le dépôt.

```bash
node retours/2026-10-31/maquette/extraire.cjs . retours/2026-10-31/maquette/donnees.js  # au besoin
retours/2026-10-31/maquette/construire.sh /tmp/cabinet
cd /tmp/cabinet && python3 -m http.server 8765   # puis http://localhost:8765/local.html
```

Elle est aussi publiée en artefact (privé) : le lien est dans la conversation du
31 octobre 2026.
