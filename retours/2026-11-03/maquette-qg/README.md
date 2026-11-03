# La maquette du QG 2

La maquette de la proposition `../le-qg.md` : le QG refait en salle de
contrôle, navigable de bout en bout, sur des chiffres inventés à l'échelle de
la production du début novembre 2026. Une page, sans dépendance, hors de
l'application : rien ici n'est servi par FiestApp.

- `index.html` : la page et sa feuille de style (les jetons en tête).
- `outils.js` : fabriquer le DOM, les nombres et les heures à la française,
  un hasard qui se répète (la même heure donne le même chiffre, zoomée ou non).
- `donnees.js` : les données inventées — le rythme d'une journée, les
  soirées, les cinq modes, le serveur heure par heure, les routes d'API, les
  joueurs et leurs cohortes, le Cabinet, les questions, Turso. L'histoire
  qu'elles racontent : le Cabinet ouvert le 31 octobre et son affiche le 1er
  novembre, un arrêt net hier à 23 h 02, la version `a41c9e2` qui ralentit
  `POST /api/cabinet/traversee/:id/geste`.
- `graphes.js` : les graphes, en SVG écrit à la main comme ceux du QG
  d'aujourd'hui — courbes, bande médiane–95ᵉ centile, colonnes empilées,
  viseur partagé entre graphes, glisser pour zoomer, événements posés sur
  les courbes, carte de chaleur, nuage, jauge.
- `pages.js` : le poste de commande, le direct, le serveur (signaux, routes,
  temps réel, gels, versions), la base et le miroir, les erreurs, les
  alertes, le journal, les téléphones.
- `pages-modes.js` : les joueurs, les profils, les salons, l'économie, les
  modes côte à côte, le gabarit commun des cinq modes (le Cabinet compris),
  les questions, les réserves, et les pages reprises.
- `qg.js` : la coque — le rail, la barre de commande (la période de toute la
  page, « Comparer »), l'adresse de chaque page (`#serveur-routes`), la
  palette ⌘K, le mur de contrôle.

Pour la regarder en local, depuis la racine du dépôt :

```bash
cd retours/2026-11-03/maquette-qg && python3 -m http.server 8766   # puis http://localhost:8766/
```

`index.html` n'a pas de `<!doctype>` (l'artefact l'ajoute) : ouverte telle
quelle, la page tourne en mode de compatibilité, et rien n'y change de
visible.

Elle est aussi publiée en artefact (privé) : le lien est dans la conversation
du 3 novembre 2026.
