# Le classement au fil du quiz — rapport d'expert, 25 septembre 2026

La demande de l'animateur : « Des joueurs m'ont rapporté qu'ils aimeraient
bien voir, au fur et à mesure du quiz, leur classement et leur position par
rapport aux autres — sans que ça dégrade les performances de l'appli. » Un
expert en game design et en expérience des jeux de soirée a été consulté
pendant que la mécanique serveur s'écrivait : ce qu'il dit du « chantier »,
c'est la première version, une échelle de trois joueurs à chaque révélation,
qu'il a mesurée et fait abandonner. Le rapport est rangé tel qu'il l'a rendu ;
ses captures vivaient dans son atelier, trois planches en restent ici
(`captures/15-classement-avant-apres.jpg`, et les écrans de l'application
livrée : `16-classement-revelation-trois-cas.jpg`,
`17-classement-podium-et-soiree.jpg`). Ce qui en a été retenu est à la fin,
« Suite donnée ».

## En bref

Aujourd'hui, entre deux questions, le téléphone dit « Total quiz : 450 pts · 3ᵉ place » : une ligne grise sous l'anecdote. Elle ne dit rien des autres, ni de ce qui a bougé. Dans le pire cas, elle tombe même sous la ligne de flottaison d'un Android (y = 552–575, pour environ 560 px visibles). Le chantier en cours dans l'arbre de travail a la bonne mécanique côté serveur : quelques octets par téléphone, lus dans un classement trié une fois. Son écran, en revanche, prend 215 px mesurés avec sa propre CSS (un titre, trois lignes pleines, une phrase) et chasse du premier écran le tableau des équipes, qui décide de la soirée.

**Ma recommandation : une « ligne de course » de trois lignes courtes (95 px), juste sous le résultat, à chaque révélation.** Elle dit sa place, les places gagnées, et un seul nom à rattraper. L'échelle devant / toi / derrière va au podium du quiz et en salle d'attente, là où les listes existent déjà. Le classement de la soirée tient en une ligne au podium du quiz. Les trois gains les plus rentables :

1. **Une cible nommée** : « À 40 pts d'Hugo », et pour le meneur « Hugo te suit à 40 pts ». C'est un duel par invité, là où 47 invités sur 50 regardaient une course perdue d'avance.
2. **La phrase plutôt que l'échelle** au moment de la révélation. Au premier écran, les quatre équipes restent visibles, contre aucune avec l'échelle.
3. **On ne dit que les bonnes nouvelles** :
   - la flèche ne monte que vers le haut ;
   - « Tu prends la tête ! » ;
   - « sur 12 » pour la moitié haute seulement ;
   - aucun rang à zéro point (fini le « 0 pt · 1ʳᵉ place »).

## Méthode

- **Lu** : le README (Déroulé d'une partie, Faire durer le suspense, Les équipes, La direction) et le CLAUDE.md (invariants 1, 4, 8, 15, 17, 19, conventions). Côté code : `PlayerView.tsx`, `HostView.tsx`, `Leaderboard.tsx`, `PlayerApp.tsx`, `server/src/games/quiz.ts`, `core/engine.ts` (mémo par diffusion, dédoublonnage), `core/space.ts` (instantané, regroupement), `shared/classement.ts`, `shared/teams.ts`, `shared/fin.ts`, `format.ts`, `typographie.ts`. Côté retours : les tablées des 23 et 24 septembre (Karim, Sofia, Maëlle, Lucas) et le rapport d'accessibilité.
- **Le chantier en cours** est apparu dans l'arbre de travail pendant l'étude. Il n'est pas commité, je l'ai lu sans rien y toucher :
  - `PlaceAuQuiz` dans `shared/games/quiz.ts:97` ;
  - `indexDesPlaces`, `rangDAvant` et `placeAuQuiz` dans `server/src/games/quiz.ts:654-720` ;
  - `rangDansLesTries` et `groupesDExAequo` dans `shared/classement.ts` ;
  - `client/src/games/quiz/TaPlace.tsx` et `server/test/classement-en-cours.test.ts`.
- **Mesuré** : des maquettes statiques de l'écran de révélation, avec la vraie feuille de style (`client/src/styles.css`) et les polices livrées. Rendu par le Chromium de Playwright en 360 × 640, pixel ratio 2. J'ai comparé trois versions (aujourd'hui, le chantier, la proposition) sur quatre contenus : juste, raté, zéro point, pire cas (réponse de 110 caractères, anecdote de 280, six équipes).
  - Script : `maquettes/rendre.mjs`, dans l'atelier de l'expert (non versé au dépôt).
  - Mesures : `…/maquettes/mesures.json`. Captures : `…/maquettes/captures/`, dont `planche-trois-cas.png` et `planche-avant-apres.png`.
  - Aucun build, aucun serveur, rien d'écrit dans le dépôt.
- **Benchmark** : recherches en ligne le 25/09/2026. Le proxy a refusé d'ouvrir les pages d'aide (kahoot.com, support.kahoot.com, help.mentimeter.com…). Les faits cités viennent donc des extraits que le moteur de recherche donne de ces pages, avec leur source ; ce qui vient de ma mémoire est signalé.
- **Pas couvert** : un vrai lecteur d'écran, un vrai téléphone (avec les barres du navigateur), l'écran commun remesuré en 1366 × 768, une salle de 500.

## Constats

### 1. Le rang se lit en petit, seul, et parfois pas du tout
- **Où** : téléphone, révélation, `client/src/games/quiz/PlayerView.tsx:403` (HEAD).
- **Constat** : une ligne grise de 22 px, « Total quiz : 450 pts · 3ᵉ place », placée sous l'anecdote. Elle ne dit ni combien on est, ni qui est devant, ni de combien, ni ce qui a bougé.
- **Preuve** : avec une anecdote courte, la ligne est à y = 333–355. Dans le pire cas, elle est à y = 552–575, sous les ~560 px que Chrome Android laisse voir quand sa barre d'adresse est affichée (`captures/actuel-3-pire-cas.png`).
- **Qui ça touche, ce que ça coûte** : toute la salle, à chaque question. Dans une salle de 50, la télé montre 5 noms : pour les 45 autres, cette ligne est la seule nouvelle de leur course. Les invités l'ont remarqué, et l'animateur le rapporte.
- **Statut** : friction (c'est la demande).
- **Piste** : la ligne de course (voir « La recommandation »).
- **Priorité · effort** : P1 · S. Le serveur est déjà écrit dans le chantier.

### 2. « Premier de rien » : 0 point et 1ʳᵉ place
- **Où** : `PlayerView.tsx:403` (HEAD) ; dans le chantier, `TaPlace.tsx:89`.
- **Constat** : quand toute la salle rate la première question, chaque téléphone lit « 0 pt · 1ʳᵉ place ». Le chantier écrirait « En tête, ex æquo avec 11 autres » : sa `phrase()` le dit dès que personne n'est devant, points ou pas. Or le reste de l'application refuse déjà un rang à zéro :
  - l'en-tête de la salle d'attente (`scoreEtRang`, `client/src/format.ts:24`) ;
  - la carte (`server/src/core/space.ts:604`) ;
  - la fin de soirée, qui dit « 0 point · 12 joueurs » (`FinDeSoiree.tsx:334`).
- **Preuve** : la transcription du lecteur d'écran, `retours/2026-09-24/experts/accessibilite.md:296` : « Raté… tu avais dit Sydney La bonne réponse : Canberra Total quiz : 0 pts · 1ʳᵉ place ». Et la lecture de `phrase()` dans le chantier.
- **Statut** : bug confirmé (lecture du code, transcription).
- **Piste** : à 0 point, pas de rang. Si personne n'a marqué : « Personne n'a encore marqué ».
- **Priorité · effort** : P2 · S.

### 3. L'échelle du chantier chasse les équipes du premier écran
- **Où** : `client/src/games/quiz/TaPlace.tsx` (chantier), placé sous le bandeau par `BetweenQuestions`.
- **Constat** : l'échelle empile un titre « Ta place » et sa pastille, trois lignes pleines (rang, avatar, prénom, niveau, points), puis une phrase qui redit l'écart que les lignes montrent déjà. Total : 215 px, mesurés avec la CSS `.ta-place` que le chantier vient d'ajouter à `styles.css`.
- **Preuve** (maquettes 360 × 640, réponse juste, anecdote courte, 4 équipes) :

  | Écran | Hauteur du bloc | Équipes visibles à 640 | à 560 |
  |---|---|---|---|
  | Aujourd'hui (« Total quiz ») | 22 px | 3 / 4 | 2 |
  | Chantier : titre + 3 lignes + phrase | 215 px | **0 / 4** | 0 |
  | Échelle seule, sans titre ni phrase | 166 px | 3 / 4 | 1 |
  | **Proposé : la ligne de course** | **95 px** | **4 / 4** | **3** |

  Dans le pire cas, l'échelle du chantier, pourtant placée sous le bandeau comme dans son code, s'étend de y = 344 à y = 579 : sa phrase passe sous le pli d'un Android, et aucune équipe n'est visible (0 / 6). La ligne de course, au même endroit, finit à y = 439 : elle est toujours visible. Captures : `planche-avant-apres.png`, `chantier-2-sous-le-bandeau.png`, `chantier-4-pire-cas-sous-le-bandeau.png`.
- **Qui ça touche, ce que ça coûte** : toute la salle, dès qu'il y a des équipes. Le README promet que « chaque téléphone montre au même moment son total, son rang, et où en est son équipe » (README:299). Avec l'échelle, l'équipe passerait sous le pouce à chaque question.
- **Statut** : tension avec deux partis pris : rien ne doit pousser l'essentiel hors de l'écran en 360 × 640, et les équipes décident de la soirée.
- **Piste** :
  - à la révélation, la phrase ;
  - l'échelle au podium du quiz, sous les trois marches (le pendant de « La suite du classement » à la télé), et en salle d'attente ;
  - garder tout le serveur du chantier, qui sert les deux.
- **Priorité · effort** : P1 · S.

### 4. À l'oreille, une échelle n'est qu'une suite de nombres
- **Où** : la révélation est lue d'une traite par la région vivante du téléphone (`PlayerApp.tsx:455`, `aria-live="polite"`).
- **Constat** :
  - l'échelle se lirait « Rang 4 renard Hugo 490 points Rang 5 panda Sofia toi 450 points Rang 6 grenouille Léa 430 points À 40 pts d'Hugo » ;
  - la pastille « ↑ 2 places » perd sa flèche, qui est une icône décorative, et ne dit plus que « 2 places » ;
  - « 5ᵉ » porte une lettre modificative (U+1D49), que plusieurs synthèses vocales épellent.
- **Statut** : non confirmé sur un vrai lecteur d'écran. C'est une reconstitution d'après le DOM, comme dans le rapport d'accessibilité.
- **Piste** : une phrase `sr-only` qui dit tout, et le visuel en `aria-hidden` (voir « Ce qu'entend le lecteur d'écran »).
- **Priorité · effort** : P2 · S.

### 5. Deux classements sur le même écran, un seul étiqueté
- **Où** : la révélation, au téléphone.
- **Constat** : le rang individuel est celui du quiz ; le tableau des équipes est celui de la soirée (`teamScores` sur tout le journal, `space.ts:1061`).
  - À la télé, le titre « En tête du quiz » le dit. Au téléphone, « 3ᵉ place » ne dit pas de quel classement il s'agit.
  - Le multiplicateur promet qu'« un écart de 400 points redevient jouable » (README:275), et cette promesse porte sur la soirée. Pendant la finale, le téléphone ne montre pourtant rien de la soirée.
  - Il ne montre pas non plus le « ×2 » au moment de la révélation, là où l'on lit les écarts : la pastille disparaît avec la question.
- **Statut** : friction.
- **Piste** :
  - l'étiquette « Ce quiz ×2 · encore 6 questions » ;
  - la soirée, en une ligne, au podium du quiz ;
  - pendant une finale multipliée, une ligne « Soirée » à chaque révélation (P3).
- **Priorité · effort** : P2 · S.

### 6. Un seul nom pour tout un groupe
- **Où** : `TaPlace.tsx:85-91` (chantier).
- **Constat** :
  - « À 40 pts d'Hugo » quand Hugo, Léa et Paul sont ex æquo devant ;
  - « Tu mènes, 180 pts devant Hugo » quand les onze autres sont à zéro : Hugo n'est que le premier dans l'ordre alphabétique.
- **Statut** : friction.
- **Piste** :
  - la taille du groupe de devant se lit déjà dans les données : c'est `mon rang − devant.rang`. D'où « À 40 pts d'Hugo et 2 autres » ;
  - quand ceux de derrière sont à zéro (`derriere.points === 0`) : « Personne d'autre n'a encore marqué ».
- **Priorité · effort** : P3 · S.

### 7. La télé ne raconte pas la course
- **Où** : `HostView.tsx:975-996`, le tableau « En tête du quiz ».
- **Constat** : le top 5 s'affiche sans rien de ce qui a bougé ; l'animateur n'a que le premier à commenter. Kahoot, lui, fête à l'écran « quelqu'un qui gagne trois places ou plus ».
- **Statut** : idée.
- **Piste** :
  - « ↑ 2 » dans la ligne de qui monte, sans hauteur de plus ;
  - quand la tête change, le titre devient « En tête du quiz · Hugo prend la tête ». Le prénom passe par `vctx.playerName` (invariant 17).
- **Priorité · effort** : P3 · S.

## La recommandation

### Quel classement, à quel moment

| Moment | Téléphone | Télé |
|---|---|---|
| Question (et 3-2-1, intertitre, photo, mesure en direct) | rien | rien de plus |
| Révélation | **la ligne de course**, sur le classement du quiz, étiquetée « Ce quiz » | top 5 inchangé ; + ↑ et prise de tête (P3) |
| Révélation d'une finale ×2 ou ×3, dès le 2ᵉ quiz | + une ligne « Soirée : 3ᵉ place ↑ 1 » (P3) | — |
| Podium du quiz | « Tu finis 5ᵉ sur 12 avec 450 pts » ; sous le podium, l'échelle devant / toi / derrière pour qui n'y monte pas ; dès le 2ᵉ quiz, « Soirée : tu passes 2ᵉ » | inchangé |
| Salle d'attente | classement de la soirée : les 8 premiers, puis ⋯, puis **ses deux voisins** autour de sa ligne | inchangé |
| Fin de soirée | inchangé (« 5ᵉ place sur 12 », « 0 point · 12 joueurs ») | inchangé |

**Pourquoi le classement du quiz pendant le quiz :**
- c'est celui que la télé affiche au même instant : un seul « en tête » dans la salle ;
- il repart de zéro à chaque quiz, donc tout le monde y a sa chance ;
- c'est lui que récompensent le podium du quiz et le prix « vainqueur du quiz ».

La soirée, elle, bouge peu d'une question à l'autre, sauf pendant la finale multipliée, dont c'est toute la promesse. Deux règles : jamais deux rangs dans la même phrase, jamais un rang sans son étiquette.

**Pendant la question, rien.** Le classement ne peut pas y bouger, puisque les points tombent à la révélation. L'écran appartient aux réponses et au pouce, et c'est le seul moment où l'on ne doit penser qu'à la question. Kahoot, Wayground, Mentimeter et AhaSlides montrent aussi le classement après la réponse, jamais pendant.

### La ligne de course : trois lignes, juste sous le résultat

```
CE QUIZ ×2 · ENCORE 6 QUESTIONS        ← étiquette (.label) : quel classement, et ce qui reste à jouer
5ᵉ place sur 12 · 450 pts        ↑ 2   ← sa place ; la flèche seulement quand elle monte
À 40 pts d'Hugo                        ← UNE cible : le plus proche strictement devant
```

**Les règles, par position :**

- **En tête.**
  - On fête une fois : « Tu prends la tête ! ».
  - Ensuite, on nomme la menace : « Hugo te suit à 40 pts ». Le meneur joue pour défendre, et un poursuivant nommé en fait un duel.
  - Pas de « sur 12 » : « Tu mènes » suffit.
- **Au milieu.**
  - Sa place ; « sur 12 » s'il est dans la moitié haute ; la flèche s'il monte ; le plus proche devant.
  - On ne cite ni le premier, souvent hors d'atteinte, ni celui de derrière, qui ajoute de la peur.
  - C'est le gradient d'objectif : une cible proche et nommée fait accélérer (Kivetz, Urminsky et Zheng, 2006, de mémoire). C'est aussi ce que mesurent les études sur les classements relatifs (voir « Mesures et cartes »).
- **Dans la moitié basse, dernier compris.**
  - Sa place **sans** « sur 12 », et la cible devant.
  - Jamais « dernier », jamais de flèche vers le bas.
  - Karim a aimé voir son rang en ratant trois questions sur quatre (`retours/2026-09-24/karim.md:58-60`) : on ne lui cache pas sa place, on ne la lui souligne pas.
- **À zéro point.**
  - Pas de rang, comme l'en-tête de la salle d'attente et la fin de soirée.
  - Mais une cible : « À 100 pts de Léa », le plus petit score au-dessus de zéro.
  - Si personne n'a encore marqué : « Personne n'a encore marqué ».
- **Les flèches : vers le haut seulement.**
  - Le bandeau vient de dire « Raté… » : une flèche rouge punirait deux fois, et une perte pèse environ le double d'un gain (aversion à la perte, Kahneman et Tversky, de mémoire).
  - La place elle-même dit la descente à qui s'en souvient.
  - Le chantier a déjà tranché ainsi : « Monter se fête ; descendre, la ligne le montre déjà assez. »
- **« Sur combien » : à la moitié haute seulement** (rang ≤ moitié des joueurs, arrondie au-dessus).
  - « 5ᵉ sur 12 » situe ; « 11ᵉ sur 12 » ne dit rien d'autre qu'« avant-dernier ».
  - La taille de la salle se lit déjà sur la télé, dont le compteur « 12 / 12 » s'affiche à chaque question.
  - C'est la même asymétrie que la flèche : la bonne nouvelle avec son contexte, la mauvaise sous forme de cible.
- **Ex æquo.**
  - Rang partagé, selon la règle de `shared/classement.ts` (invariant 15) : « 5ᵉ ex æquo sur 12 ».
  - La cible est le groupe strictement devant, jamais « à 0 pt de Paul ».
- **Retardataire.**
  - Rien à la révélation de son arrivée : « Bienvenue ! » dit tout, et le chantier l'écarte déjà.
  - Ensuite, comme tout le monde. Sa cible, le plus proche devant, reste atteignable même s'il est parti en retard.
- **Question annulée** : la place d'avant, sans flèche. Rien n'a bougé, et le chantier le teste.
- **Multiplicateur** : il s'affiche dans l'étiquette, parce que c'est là qu'on lit l'écart. À 300 pts en ×2, une seule question suffit à combler l'écart.
- **Dernière question révélée** : « Ce quiz · c'était la dernière ».
- **Équipes** : le tableau vient juste après le bloc. Le bloc dit « Ce quiz », parce que les équipes, elles, sont comptées sur la soirée.
- **Taille de la salle.**
  - À 5, la télé montre tout le monde : le bloc n'ajoute que la flèche et l'écart.
  - À 50, c'est lui qui fait jouer les 45 que la télé ne montre pas.
  - À 500, les voisins sont des inconnus, mais une cible reste une cible, et « 37ᵉ sur 500 » se lit avec plaisir.

### Les mots exacts

Une fonction pure dans `shared/` produit tous ces textes, et la phrase du lecteur d'écran avec. C'est le modèle de `ligneDeRang` dans `shared/fin.ts`, testé dans `server/test/`.

**L'étiquette** (petites capitales, `.label`)

| Cas | Texte |
|---|---|
| en cours | Ce quiz · encore 6 questions |
| une seule restante | Ce quiz · encore 1 question |
| la dernière vient d'être révélée | Ce quiz · c'était la dernière |
| multiplicateur | Ce quiz ×2 · encore 6 questions |

**Sa place**

| Cas | Texte |
|---|---|
| prend la tête, seul (`avant` > 1) | **Tu prends la tête !** · 630 pts (en or) |
| rejoint la tête (ex æquo, `avant` > 1) | **Tu rejoins la tête !** · 630 pts |
| mène, seul | Tu mènes · 630 pts |
| mène, ex æquo | En tête ex æquo · 630 pts |
| moitié haute | 5ᵉ place sur 12 · 450 pts, avec `↑ 2` à droite s'il monte |
| moitié haute, ex æquo | 5ᵉ ex æquo sur 12 · 450 pts |
| moitié basse | 9ᵉ place · 200 pts, avec `↑ 1` s'il monte |
| moitié basse, ex æquo | 9ᵉ ex æquo · 200 pts |
| zéro point, d'autres ont marqué | Pas encore de points |
| personne n'a marqué | Personne n'a encore marqué |

**La cible**

| Cas | Texte |
|---|---|
| un joueur devant | À 40 pts d'Hugo |
| un groupe devant (taille = `mon rang − devant.rang`) | À 40 pts d'Hugo et 2 autres |
| mène seul | Hugo te suit à 40 pts |
| mène ex æquo | Léa vous suit à 40 pts |
| mène, tous les autres à zéro | Personne d'autre n'a encore marqué |
| personne n'a marqué | *(rien)* |

« d'Hugo » suit la règle maison (`de()`, `shared/typographie.ts`). Les prénoms viennent de l'instantané (`nomAffiche`) : « Camille (2) » y est (invariant 17).

**Au podium du quiz**

| Cas | Texte |
|---|---|
| moitié haute (podium compris) | Quiz terminé ! Tu finis 5ᵉ sur 12 avec 450 pts |
| juste au pied du podium (`devant.rang` ≤ 3) | + « À 20 pts du podium » |
| moitié basse | Quiz terminé ! Tu finis 9ᵉ avec 200 pts |
| zéro point | Quiz terminé ! Pas de points cette fois |
| la soirée, dès le 2ᵉ quiz | Soirée : tu passes 2ᵉ · Soirée : tu prends la tête ! · Soirée : tu restes en tête · Soirée : 4ᵉ place |

### Ce qu'entend le lecteur d'écran

Une seule phrase `sr-only`, en tête du bloc, et le visuel en `aria-hidden`. Elle est lue juste après le bandeau, dans la région vivante :

- Milieu : « Ce quiz : rang 5 sur 12, 450 points, 2 places gagnées. À 40 points d'Hugo. Encore 6 questions. »
- Tête : « Ce quiz : tu prends la tête, 630 points. Hugo te suit à 40 points. Encore 6 questions. »
- Moitié basse : « Ce quiz : rang 11, 80 points. À 20 points de Léa. Encore 6 questions. »
- Zéro : « Ce quiz : pas encore de points. À 100 points de Léa. »
- Ex æquo et multiplicateur : « …rang 5 sur 12, ex æquo avec 1 autre… Encore 6 questions, points doublés. »

Trois choix derrière ces phrases :
- « rang 5 » plutôt que « 5ᵉ » : le composant `Rank` dit déjà « Rang » à l'oreille, et la lettre ᵉ se lit mal ;
- « points » plutôt que « pts » ;
- « 2 places gagnées » porte la flèche, que l'icône décorative ne dit pas.

### Les trois écrans, en 360 × 640

Positions mesurées sur les maquettes (y en px). L'ordre : **résultat → ta place → équipes → anecdote**.

```
EN TÊTE — juste, vient de passer devant Hugo      AU MILIEU — juste, gagne 2 places        DANS LA MOITIÉ BASSE — raté
┌──────────────────────────────────┐ 24          ┌──────────────────────────────────┐ 24   ┌──────────────────────────────────┐ 24
│               +186               │             │               +152               │      │               (x)                │
│            Bien joué !           │             │            Bien joué !           │      │   Raté… tu avais dit ▲ Sydney    │
│   La bonne réponse : ■ Canberra  │             │   La bonne réponse : ■ Canberra  │      │   La bonne réponse : ■ Canberra  │
└──────────────────────────────────┘ 189         └──────────────────────────────────┘ 189  └──────────────────────────────────┘ 185
┌──────────────────────────────────┐ 207         ┌──────────────────────────────────┐ 207  ┌──────────────────────────────────┐ 203
│ CE QUIZ · ENCORE 6 QUESTIONS     │             │ CE QUIZ · ENCORE 6 QUESTIONS     │      │ CE QUIZ · ENCORE 6 QUESTIONS     │
│ Tu prends la tête ! · 630 pts    │             │ 5ᵉ place sur 12 · 450 pts    ↑ 2 │      │ 11ᵉ place · 80 pts               │
│ Hugo te suit à 40 pts            │             │ À 40 pts d'Hugo                  │      │ À 20 pts de Léa                  │
└──────────────────────────────────┘ 299         └──────────────────────────────────┘ 302  └──────────────────────────────────┘ 298
┌──────────────────────────────────┐ 317         ┌──────────────────────────────────┐ 320  ┌──────────────────────────────────┐ 316
│ Les équipes                      │             │ Les équipes                      │      │ Les équipes                      │
│ 1 🎸 Guitaristes       6 pts d'éq.│             │  (4 lignes, la sienne surlignée)│      │  (4 lignes, la sienne surlignée)│
│ 2 🍝 Arrabbiata        5         │             │                                  │      │                                  │
│ 3 🥾 Randonneurs ◀     4         │             │                                  │      │                                  │
│ 4 🦉 Hiboux            3         │             │                                  │      │                                  │
└──────────────────────────────────┘ 636         └──────────────────────────────────┘ 639  └──────────────────────────────────┘ 635
──────────────── 640 ────────────────           ──────────────── 640 ────────────────     ──────────────── 640 ────────────────
│ Le saviez-vous ? …               │ 654         (l'anecdote, sous le pli : la télé la montre en grand)
```

Captures : `captures/propose-1-tete.png`, `propose-2-milieu.png`, `propose-3-dernier.png` (réunies dans `planche-trois-cas.png`), plus `propose-4-pire-cas.png` et `propose-5-zero.png`.

**Ce qu'il faut retirer ou raccourcir pour que ça tienne :**
1. **La ligne « Total quiz »** : le bloc l'absorbe.
2. **À la révélation, ni titre, ni avatars, ni pastilles de niveau, ni trois lignes, ni phrase qui répète l'écart.** L'échelle part au podium du quiz. C'est 120 px de gagnés sur le chantier.
3. **L'anecdote passe après les équipes.** La télé la montre en grand au même moment, et le téléphone la garde pour qui fait défiler. C'est le seul élément qui quitte le premier écran dans le cas courant.
4. **Le bandeau du résultat ne rétrécit pas.** C'est le moment d'émotion, et il peut atteindre 300 px avec une réponse longue : c'est justement pourquoi le bloc vient juste sous lui, et non en bas.
5. **Chiffres en Cormorant : `font-variant-numeric: lining-nums`**, comme `.lb-rank`. Sans cela, dans la première version de la maquette, « 11ᵉ » se lisait « IIᵉ » en chiffres elzéviriens.

Résultat mesuré : dans le cas courant (réponse juste, anecdote, 4 équipes), le résultat, sa place et les quatre équipes tiennent en 640 px, dont trois équipes sur quatre avant le pli d'un Android. Dans le pire cas, le bloc finit à y = 439 : il est toujours visible.

### La télé : seulement ce qui fait parler l'animateur

- **Garder** l'ordre actuel : les équipes d'abord, puis « En tête du quiz » (top 5, `Coupe`).
- **Ajouter**, sans hauteur de plus :
  - `↑ 2` en or dans la ligne de qui monte ;
  - quand la tête change, le titre « En tête du quiz · Hugo prend la tête ».
- **Ne rien montrer d'autre** : ni le bas du classement, ni les descentes, ni les voisins de chacun. À 500 invités, ce travail-là revient au téléphone.

### Ce que ça coûte

| Poste | Coût | Quand |
|---|---|---|
| Tri du classement du quiz | déjà fait, une fois par diffusion (mémo `quiz:classement`) | révélation, podium |
| Rang d'avant la question | un tri des totaux d'avant par diffusion, puis une recherche par dichotomie par téléphone (`rangDAvant`, chantier) | révélation |
| Voisins | temps constant par téléphone (`groupesDExAequo`, chantier) | révélation, podium |
| Octets | ~100 o par téléphone (`place`) : ≈ 55 Ko par révélation à 500 invités. À comparer à l'instantané (toute la salle, ~100 o par invité) qui part déjà à chaque révélation : ≈ 25 Mo à 500. Soit ~0,2 % de plus | révélation |
| Pendant la question | rien : la promesse `vueDependDesAutres: false` tient | — |
| Prénoms des voisins | décorés au téléphone depuis l'instantané, donc un renommage et « Camille (2) » suivent | — |
| « sur 12 » | un nombre de plus dans `place` (`joueurs` = les lignes de `indexDesPlaces`, ceux qui ont pu jouer) | révélation, podium |
| La soirée au podium | calculée au téléphone depuis l'instantané, à jour à ce moment : les derniers points sont tombés à la dernière révélation | podium |
| La soirée pendant la finale (P3) | au serveur, dans la vue. Calculée au téléphone, elle montrerait l'ancien rang jusqu'à l'instantané suivant (120 ms + 2 ms par invité, ~1,1 s à 500) | révélation |
| Télé | le rang d'avant des 5 lignes montrées | révélation |

## Mesures et cartes

### Hauteurs mesurées (360 × 640, vraie feuille de style)

| Maquette | Bandeau (bas) | Bloc (y, hauteur) | Équipes à 640 | Bloc visible à 560 | Page |
|---|---|---|---|---|---|
| actuel — juste, sans anecdote | 211 | 229–252 (22) | 4 / 4 | oui | 640 |
| actuel — juste, anecdote | 189 | 333–355 (22) | 3 / 4 | oui | 721 |
| actuel — pire cas | 326 | 552–575 (22) | 0 / 6 | **non** | 1067 |
| chantier — sous le bandeau (sa vraie CSS) | 189 | 207–422 (215) | **0 / 4** | oui | 914 |
| chantier — pire cas, sous le bandeau | 326 | 344–579 (235) | 0 / 6 | **non** (sa phrase) | 1279 |
| échelle compacte | 189 | 207–373 (166) | 3 / 4 | oui | 864 |
| **proposé — tête** | 189 | 207–299 (92) | **4 / 4** | oui | 790 |
| **proposé — milieu** | 189 | 207–302 (95) | **4 / 4** | oui | 793 |
| **proposé — moitié basse** | 185 | 203–298 (95) | **4 / 4** | oui | 789 |
| **proposé — pire cas** | 326 | 344–439 (95) | 2 / 6 | **oui** | 1139 |
| proposé — zéro point | 185 | 203–295 (92) | 4 / 4 | oui | 660 |

### Benchmark : son rang, sur son téléphone et à l'écran

| Outil | Sur le téléphone | À l'écran commun | Quand | Source (consultée le 25/09/2026) |
|---|---|---|---|---|
| **Kahoot**, mode Classic | juste ou faux, points gagnés, série de bonnes réponses, et sa place : « You're on the podium! » dans le top 3, sinon « 15th place, 7 points behind ‹pseudo› ». Pas de « sur N » | top 5 après chaque question, qu'on ne peut pas désactiver en Classic. Messages de fête : une série, ou « quelqu'un qui gagne trois places ou plus » | après chaque question ; podium à la fin | aide Kahoot « Tips for hosting a live game » ; fil « Option to show/hide leaderboards between questions » (extraits de recherche) ; captures relayées (iFunny : « Answer Streak 5 You're on the podium! » ; Scribd : « Incorrect… Answer streak lost… 15th place… 7 points behind ») ; le reste de mémoire |
| Kahoot, modes Accuracy (2025), Lecture et Presentation (ou Professional) | Accuracy : ni points ni classement | podium simplifié, en nombre de bonnes réponses ; en Lecture et Presentation, tableaux masqués sauf si l'animateur les montre | — | aide Kahoot « Accuracy experience », « Tips for hosting » (extraits) |
| **Wayground** (ex-Quizizz) | avec le réglage « Show leaderboard », un classement après chaque question, et son rang pendant et après | tableau de l'enseignant | après chaque question ; désactivable « si l'on ne veut pas de compétition » | help.wayground.com, « Navigate Session Settings » (extrait) |
| **Mentimeter** | juste ou faux | top 10, sur une diapo de classement placée où l'on veut (après chaque question, ou à la fin seulement) | au choix de l'animateur | help.mentimeter.com, « How to create a Quiz Competition » (extrait). Sa place au téléphone : de mémoire, non vérifié |
| **AhaSlides** | d'abord une phrase seule (« You are 17th out of 60 players »), remplacée par le classement entier, sa ligne surlignée, qu'on fait défiler | top 5 par diapo de classement | aux diapos de classement | blog AhaSlides « Improvements to Quiz Features » ; docs « Add and delete a quiz leaderboard » (extraits) |
| **Blooket**, Gold Quest | son or ; on regarde le classement pour choisir à qui voler ou avec qui échanger | classement en direct | en continu | help.blooket.com, « Game Overview: Gold Quest » (extrait) |
| **Gimkit** | son argent ; le classement s'ouvre au téléphone par la croix directionnelle (modes non 2D) | classement projeté en direct | en continu | help.gimkit.com, « Host a live game », et un guide tiers (extraits) |
| **Jackbox** | une manette : rien du classement | les scores entre les manches. Quiplash 3 triple les points de la dernière manche. En finale de Trivia Murder Party, les « fantômes » ont trois choix contre deux et peuvent voler la place du meneur | entre les manches | Jackboxpedia, wiki Fandom Jackbox (extraits) |

**Ce que j'en retiens :**
1. **Tous ceux qui mettent un rang au téléphone le montrent après la réponse, jamais pendant** (Kahoot, Wayground, Mentimeter, AhaSlides). Les classements en direct de Blooket et Gimkit servent des modes continus, pas un quiz question par question.
2. **La référence des quiz de salle, Kahoot, donne sa place et une cible nommée** (« 7 points behind ‹pseudo› »), sans « sur N ». C'est le classement relatif dans sa forme la plus courte, et c'est la ligne de course.
3. **AhaSlides a essayé la phrase nue** (« 17th out of 60 ») **et l'a remplacée par la liste entière**. FiestApp ne peut pas envoyer la liste entière (500 × 500 lignes), et ne doit pas la montrer à la révélation, faute de place. La liste va au podium, en échelle.
4. **Personne ne montre les descentes.** Kahoot ne fête que les montées de trois places ou plus.
5. **Ceux qui sont derrière supportent l'affichage parce qu'ils peuvent revenir** : dernière manche triplée chez Jackbox, fantômes de Trivia Murder Party, pouvoirs chez Wayground (de mémoire). FiestApp a son multiplicateur ; le téléphone doit le montrer là où se lit l'écart.

### Ce que dit la recherche (contextes d'apprentissage, pas de soirée)

- **Classement relatif contre absolu** : Bai, Hew, Sailer et Jia, 2021, *Computers & Education* 173, 104297. Avec un classement absolu, les premiers sont plus motivés que les derniers. Un classement relatif, qui ne montre que ses voisins, soutient l'engagement à tous les niveaux.
- **La position change tout** : Jia, Liu, Yu et Voida, CHI 2017, « Designing Leaderboards for Gamification ». Le rang qu'on occupe pèse sur la façon dont on perçoit le classement et l'application ; les extravertis l'apprécient quel que soit leur rang.
- **Un classement n'est pas toujours un plus** : « Leaderboard Effects on Player Performance in a Citizen Science Game », arXiv 1707.03704, 2017. Sans classement, les joueurs ont parfois fait mieux qu'avec un top 5 ou un classement relatif.
- **Le local l'emporte sur le total** : Kahoot, « Experimenting with Answer Streaks », Medium, juin 2016. Les joueurs tenaient davantage à leur série qu'à leur score total. D'où l'étiquette, la flèche et la cible, plutôt qu'un chiffre de plus.

## Ce qui marche — à ne pas casser

- **Le serveur du chantier est exactement ce qu'il faut** :
  - la vue n'envoie que des identifiants, des points et des rangs ; le téléphone décore avec l'instantané, donc un renommage et « Camille (2) » suivent ;
  - le classement est trié une fois par diffusion ;
  - les voisins se lisent en temps constant ;
  - rien n'est calculé ni envoyé pendant la question ;
  - le retardataire qui arrive pendant la révélation n'a pas de place, ce qui évite de renvoyer la vue à toute la salle à chaque arrivée ;
  - `avant` est absent tant que personne n'a marqué, et quand rien n'a bougé ;
  - une question annulée ne fait bouger personne.

  Tout cela sert la phrase de la révélation comme l'échelle du podium. **Le garder tel quel.**
- **Le rang partagé** (`shared/classement.ts`) : deux ex æquo lisent le même chiffre.
- **L'ordre de la télé**, les équipes d'abord, et **`Coupe`** : rien n'y défile.
- **« Bienvenue ! Tu joues à partir de la prochaine question »** : pas de rang pour qui n'a encore rien joué.
- **La règle « pas de rang à zéro »** de la salle d'attente et de la fin de soirée : l'étendre, pas la contourner.
- **Ce que les invités ont aimé** :
  - Karim voyait son rang même quand tout ratait (`karim.md:58-60`) ;
  - Sofia a « adoré » le double classement individuel et équipe (`sofia.md:31-33`, `:55`) ;
  - Maëlle, dernière du classement, a trouvé que le prix du Coup de Pouce remis à son équipe « ne se moque pas de moi, ça sourit avec moi » (`maelle.md:42-44`) : c'est le ton à garder pour le bas du classement.

## Recommandations, dans l'ordre

1. **La ligne de course à chaque révélation**, juste sous le bandeau : étiquette, place, cible. Elle remplace l'échelle du chantier à ce moment-là et garde son serveur. **P1 · S.**
2. **L'ordre de l'écran de révélation : résultat → ta place → équipes → anecdote.** Les quatre équipes restent au premier écran. **P1 · S.**
3. **Pas de rang à zéro point, ni de « tête » à zéro** : « Pas encore de points », « Personne n'a encore marqué ». Et les groupes nommés sans arbitraire : « Hugo et 2 autres », « Personne d'autre n'a encore marqué ». **P2 · S.**
4. **Une phrase pour l'oreille**, `sr-only`, avec le visuel en `aria-hidden` ; « rang 5 », « points », « places gagnées ». **P2 · S.**
5. **Le podium du quiz** :
   - « Tu finis 5ᵉ sur 12 » ;
   - l'échelle devant / toi / derrière sous les trois marches, pour qui n'y monte pas ;
   - « Soirée : tu passes 2ᵉ » dès le 2ᵉ quiz.

   **P2 · S.**
6. **L'étiquette « Ce quiz ×2 · encore N questions »**, qui dit à la fois de quel classement il s'agit et ce qui reste à rattraper. **P2 · S** (compris dans le 1).
7. **La salle d'attente** : ses deux voisins autour de sa ligne, après les 8 premiers (`Leaderboard.tsx:32-50`). **P3 · S.**
8. **La télé** : `↑ N` dans le top 5 et « Hugo prend la tête » dans le titre. **P3 · S.**
9. **La finale ×2 ou ×3**, dès le 2ᵉ quiz : une ligne « Soirée » à chaque révélation, calculée au serveur pour ne pas afficher un instant l'ancien rang. **P3 · M.**
10. **« sur N » à la moitié haute** : un nombre de plus dans `place`. **P3 · S**, et c'est l'élément qu'on peut abandonner sans rien perdre d'essentiel.

**Les tensions avec les partis pris, une par une :**
- **« sur N » réservé à la moitié haute, contre « une seule règle ».** La fin de soirée dit « sur 12 » à tous. Je le justifie comme la flèche : pendant le jeu, on garde le contexte flatteur ; au bilan de fin de soirée, la vérité entière. Repli acceptable : aucun « sur N » pendant le quiz, comme chez Kahoot.
- **L'anecdote passe sous le pli, contre le moment « Le saviez-vous ? ».** Elle reste au téléphone pour qui fait défiler, et en grand sur la télé au même instant.
- **Le téléphone met sa place avant l'équipe, alors que la télé met les équipes d'abord.** Le téléphone est l'écran de chacun, la télé celui de tous. Mesuré : les équipes restent au premier écran, donc le parti pris tient sur le fond.
- **Nommer le voisin.** Les prénoms sont déjà publics : top 5 de la télé, classement de la salle d'attente, cartes des joueurs. Le prénom passe par l'instantané (invariant 17).
- **Montrer un rang au bas du classement, contre « l'absence, pas l'infériorité ».** On garde le rang, que Karim voulait voir. On retire ce qui marque l'infériorité (« sur 12 », « dernier », la flèche vers le bas), et aucun rang à zéro.
- **Invariants 1 et 4.** Rien avant la révélation, rien pendant la question. La promesse `vueDependDesAutres: false` tient, et l'instantané n'y gagne aucun champ qui change à chaque tick.

## Limites

- **Pas de vrai téléphone.** Les maquettes sont des reconstitutions statiques, faites avec la vraie feuille de style et les vraies polices, pas avec les composants React. Le chantier y est reproduit d'après son balisage et sa CSS du 25 septembre, qui bougent encore. Le pli de 560 px est une estimation pour Chrome Android avec sa barre d'adresse ; Safari sur un iPhone SE en laisse moins.
- **Pas de vrai lecteur d'écran.** La lecture de « 5ᵉ » et de l'échelle est à écouter sur TalkBack et VoiceOver.
- **Benchmark de seconde main.** Les pages d'aide n'ont pas pu être ouvertes (proxy). Les faits viennent des extraits du moteur de recherche, et le texte exact du téléphone Kahoot vient de captures relayées et de ma mémoire. À vérifier en jouant une partie Kahoot gratuite.
- **La recherche vient des classes et des plateformes en ligne**, pas des soirées. Aucun test en salle : une tablée avec Karim et Maëlle (bas du classement) et Sofia (haut du classement) dirait si « À 40 pts d'Hugo » donne envie, et si l'absence de « sur 12 » se remarque.
- **L'écran commun n'a pas été remesuré** en 1366 × 768 : les ajouts proposés n'y prennent aucune hauteur, mais le titre allongé est à vérifier dans `rendu-ecran.ts`.
- **Une salle de 500 n'a pas été jouée.** Les coûts en octets sont des estimations, faites sur la taille d'un invité dans l'instantané.

## Suite donnée

Livré dans la même branche que ce rapport :

- **La ligne de course à chaque révélation** (recommandations 1, 2, 3, 4, 6 et 10), telle que proposée : l'étiquette « Ce quiz ×2 · encore 6 questions », la place (« 5ᵉ place sur 12 · 450 pts », « sur 12 » à la moitié haute seulement), la flèche vers le haut seulement, une cible nommée — « et 2 autres » pour un groupe d'ex æquo, « Hugo te suit à 40 pts » pour le meneur, « Tu prends la tête ! » la question où il passe devant —, pas de rang à zéro, une phrase pour le lecteur d'écran. L'ordre de la révélation est devenu résultat → place → équipes → anecdote. Les textes sont une dérivation pure (`shared/course.ts`), testée dans `server/test/classement-en-cours.test.ts`.
- **Le podium du quiz** (recommandation 5) : « Tu finis à la 5ᵉ place sur 12 », « Pas de points cette fois » à zéro, l'échelle devant / toi / derrière pour qui n'y monte pas, « À 20 pts du podium » juste au pied des marches, et une ligne « Soirée : 4ᵉ place » dès le deuxième quiz. Écart à la proposition : la soirée dit sa place, pas son mouvement (« tu passes 2ᵉ ») — le téléphone n'a pas la soirée d'avant le quiz, et la lui envoyer coûterait plus que la ligne ne rapporte.
- **Deux choix de plus**, venus en l'écrivant : un voisin que l'instantané ne connaît pas encore (un arrivant, le temps d'un regroupement) se dit par son rang, « À 40 pts de la 4ᵉ place » ; et un invité arrivé pendant la mesure d'une estimation en direct, ou au podium, commence à la question suivante — il entrait au journal d'une question qu'il n'avait jamais vue.

Laissé pour plus tard, faute de demande et pour garder ce lot lisible : la salle d'attente et ses deux voisins (7), la télé et ses flèches (8), la ligne « Soirée » à chaque révélation d'une finale multipliée (9).
