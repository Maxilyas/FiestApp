# Le podium peint — une marche par thème

Le 19 novembre 2026, au lendemain de l'écrin et du podium
(`retours/2026-11-18/plaques/trois-propositions/`).

## La demande

> Le podium, la plaque peut on la rendre plus jolie quand c'est sur le
> podium ? Sans rien faire donne moi des idées et fait différentes
> propositions Visuel

Quatre pistes en CSS sur le vrai classement du jour
(`maquette/1-quatre-pistes-en-css.jpg`) : le socle sculpté, l'écrin qui
grandit, le ruban de médaille, la tenture. Puis :

> J'avais en tête un vrai décors de podium détaillé, par exemple des petits
> oiseaux avec de la verdure sur un, l'autre neon robotique cité cyberpunk
> etc. Tu peux me faire une visualisation de ça ? Je veux garder ce qu'on a
> des thèmes cadres (écrin)

La maquette peinte (`maquette/2-…` à `4-…`) : sept marches peintes à part,
détourées et posées sur le vrai écran — l'avatar debout sur sa marche, le
prénom et le score au-dessus de lui, le rang dans le médaillon peint ; sans
plaque, une marche de velours plutôt que le métal, qui faisait pauvre à côté
des autres. Les écrins de la liste restent tels quels. Elle a coûté 1,87 $ :
un premier passage en colonnes hautes, trop étroites pour une marche, puis des
marches larges et basses.

> C'est magnifique, je veux ça. Fait tous les thèmes, je veux qu'il soit tous
> jolies mais évidemment par rapport à ceux qui sont dur à obtenir je veux que
> ce soit encore plus beau

## Le code

- **Trente-cinq marches**, une par thème du catalogue, Velours compris
  (`le-code/0-les-35-marches.jpg`), peintes par la chaîne des décors
  (`server/scripts/anime/decors.ts`, le groupe `podium`) sur un croquis
  (`server/scripts/anime/gabarit-marche.ts`, `le-code/croquis.png`) : la face
  avant, le dessus vu d'un peu au-dessus, le médaillon, les deux cases du
  décor et la case barrée du milieu, où le gagnant se tient. Sans lui, le
  modèle peignait des colonnes, des boîtes en perspective, des médaillons où
  il voulait ; avec lui, 28 sur 35 sont tombées juste du premier coup
  (`le-code/1-les-35-marches-premier-passage.jpg` : le cercle et la ligne du
  gabarit tracés par-dessus), les sept autres au deuxième ou au troisième —
  la consigne a appris « orthographique », « coupée par le bas de l'image »,
  « le médaillon exactement le cercle ». 7,0 $, repeints compris.
- **Plus belles à mesure que le thème est dur à obtenir** (`FINITIONS`) :
  simples pour les offerts et les communs, plus riches pour les peu communs,
  précieuses pour les rares, spectaculaires et serties pour les épiques, un
  chef-d'œuvre pour les légendaires, cerné d'or pour les cinq qui se gagnent.
- **Posées par le gabarit, jamais par ce qu'une image a peint** : la feuille
  tire ses pourcents de la géométrie du croquis (`.pdc-socle::before`). Le
  rang est une pièce d'or, d'argent ou de bronze sertie dans le médaillon :
  la marche dit le thème, la pièce la place.
- **Sur une tablette** (`le-code/4-tablette.jpg`) : la marche s'élargit et
  grandit avec — à hauteur fixe, le sol coupait le médaillon de la troisième —,
  et la case de l'avatar monte avec le décor, qui sinon touchait le score.
- `server/scripts/rendu-podium.ts` photographie les trente-cinq trois par
  trois, sous le Velours et l'Ivoire (`le-code/2-planche-des-podiums.jpg`,
  `le-code/3-l-ecran.jpg`), et sort en erreur si une marche n'a pas sa
  peinture, si un avatar ou un décor touche le score, ou si la pièce du rang
  sort de sa marche.

Les originaux en 1K (33 Mo, les repeints mis de côté compris) restent dans
`export/decors/originaux/`, hors du dépôt, sur la machine qui les a peints.
