# La maquette jouable du nouveau Filet

La maquette du cahier des charges `../le-nouveau-filet.md` : une épreuve de
trois manches, au nouveau Filet ou au Filet d'aujourd'hui, sur les 156 vraies
questions que la production a posées du 1er au 8 novembre 2026. Chaque
question porte la note du moteur, un indice et un repère. Une page hors de
l'application : rien ici n'est servi par FiestApp.

- `index.html` : la page et ses styles, aux jetons de FiestApp (Velours, et
  Ivoire en clair).
- `jeu.js` : les deux Filets, les époques, les anneaux, les repères, les
  aides, le tirage du moteur par acte, la révélation, le bilan, les pages
  « Ce que disent les lancers » et « Les règles ».
- `donnees.js` : écrit par `extraire.mts`.
- `extraire.mts` : il lit la base livrée par la règle du tireur
  (`valeurDuFilet`) et rassemble :
  - les questions posées (`questions-posees.json`) ;
  - la note du panel de l'IA (`panel-ia.json` : 518 questions, au Filet et en
    QCM) ;
  - l'indice et le repère de chacune (`indices.json`, écrits par trois agents
    puis relus) ;
  - des repères vérifiés ;
  - les chiffres de la production.

  Il passe aussi chaque indice au juge : aucun nombre à moins de 15 ans
  d'une année, ni à moins de 20 % d'une grandeur.

Le téléphone retient au profil de la page (le `localStorage`, sous try/catch) :
- les repères gagnés ;
- les questions vues, pour qu'elles ne reviennent pas tout de suite ;
- les réglages : la carte Coup d'œil, le chrono et les coulisses du moteur.

```bash
cd server && node --import tsx ../retours/2026-11-09/maquette-filet/extraire.mts   # au besoin
```

```bash
retours/2026-11-09/maquette-filet/construire.sh /tmp/filet
```

```bash
cd /tmp/filet && python3 -m http.server 8765   # puis http://localhost:8765/local.html
```

Elle est aussi publiée en artefact privé : le lien est dans la conversation du
9 novembre 2026.
