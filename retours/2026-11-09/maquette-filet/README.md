# La maquette jouable du nouveau Filet

La maquette du cahier des charges `../le-nouveau-filet.md` : une épreuve de
trois manches, au nouveau Filet ou au Filet d'aujourd'hui, sur les 156 vraies
questions que la production a posées du 1er au 8 novembre 2026 — 155
aujourd'hui : l'une, doublon d'une autre, a quitté la base depuis. Chaque
question porte la note du moteur, un indice et un repère. Une page hors de
l'application : rien ici n'est servi par FiestApp.

Elle a été retouchée après trois tours de tablée, le 9 novembre 2026
(`../la-tablee-du-filet.md`) : quatre joueurs ont joué la première version,
trois chaque version corrigée, un joueur aveugle deux fois au lecteur
d'écran, et chaque retouche dit, dans le code, qui l'a demandée. Puis le
propriétaire l'a jouée, au matin : l'écran s'est épuré, le curseur se pose
au milieu de l'époque choisie, et l'acte I ne pose plus que ce que chaque
Français sait placer. Sa page « Ce que la tablée a changé » en fait la
liste.

- `index.html` : la page et ses styles, aux jetons de FiestApp (Velours, et
  Ivoire en clair) ; aucun texte d'une manche sous dix-sept pixels.
- `jeu.js` : les deux Filets — le nouveau, et celui d'aujourd'hui recopié de
  la production, ses mots compris —, les époques, la piste en crans ronds, les
  anneaux, les repères, les aides, le tirage du moteur par acte, la
  révélation, le bilan, les pages « Ce que la tablée a changé », « Ce que
  disent les lancers » et « Les règles ».
- `donnees.js` : écrit par `extraire.mts`.
- `extraire.mts` : il lit la base livrée par la règle du tireur
  (`valeurDuFilet`) et rassemble :
  - les questions posées (`questions-posees.json`), et marque celles qui se
    calculent, que le nouveau Filet ne pose pas ;
  - la note du panel de l'IA (`panel-ia.json` : 518 questions, au Filet et en
    QCM) ;
  - ce que chaque Français sait placer, et l'ancrage de chaque question — un
    sujet français, du monde ou de l'étranger (`ancrage.json` : les 591
    questions que le panel a notées, classées par des agents qui ne voyaient
    ni le panel ni les lancers) ;
  - les seize années que 25 ans de recul rendent à l'acte I, de 1981 à 2001,
    avec leur indice et leur repère (`recentes.json`, l'indice relu à
    l'aveugle) — le Filet d'aujourd'hui de la maquette ne les pose pas ;
  - les poids de la place de la réponse parmi les quatre époques, par le
    calcul même de `../reproductions/place-de-la-reponse.mts` ;
  - l'indice et le repère de chacune (`indices.json`) ;
  - des repères vérifiés ;
  - les chiffres de la production.

  Il passe aussi chaque indice au juge de la lettre : aucun nombre à moins de
  15 ans d'une année, ni à moins de 20 % d'une grandeur.
- `juge-des-indices.json` : l'histoire de chaque indice — écrit par des
  agents, relu par un juge à l'aveugle qui se met à la place d'un profane,
  réécrit, rejugé — d'abord sur la valeur, puis sur la tranche du jeu —,
  chaque passe avec son verdict et ce que le profane en tirait. Un indice
  vide est un choix : l'énoncé donne déjà l'époque.

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

La page locale demande ses scripts sous une version : un navigateur déjà venu
ne rejoue pas l'ancien `jeu.js`. Elle est aussi publiée en artefact privé : le
lien est dans la conversation du 9 novembre 2026.
