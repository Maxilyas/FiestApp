# La maquette jouable du Cabinet de curiosités

La maquette de la proposition `../le-cabinet.md`, troisième version, après
trois tours de tests par des agents. Une page, sans dépendance, hors de
l'application : rien ici n'est servi par FiestApp.

- `cabinet.html` : la page et ses styles.
- `jeu.js` : les règles, les écrans, les neuf mini-jeux. L'état vit dans le
  `localStorage` du navigateur. En bas de l'accueil, des outils de maquette :
  passer au jour suivant, charger un joueur avancé, ajouter de la poussière.
- `contenu.js` : le contenu écrit à la main (les lieux de l'Épingle, les
  frises, les « Qui suis-je ? », les répliques, le contour de la France).
- `donnees.js` : les cartes, et un échantillon de la base de la campagne et
  des tableaux, tirés par `extraire.cjs` et `cartes.mts`.

Les images ne sont pas recopiées ici : elles viennent du dépôt. Pour jouer en
local, depuis la racine du dépôt :

```bash
retours/2026-10-24/maquette/construire.sh /tmp/cabinet   # assemble la page et ses images
cd /tmp/cabinet && python3 -m http.server 8765           # puis http://localhost:8765/local.html
```

Elle est aussi publiée en artefact (privé) : le lien est dans la conversation
du 24 octobre 2026.
