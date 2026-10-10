---
paths:
  - "server/src/games/**"
  - "server/src/core/{engine,teams,programmes}.ts"
  - "shared/{classement,course,teams,hasard,programme}.ts"
  - "shared/games/**"
  - "client/src/games/**"
  - "server/test/{moteur,variantes,hasard,programme,equipes,equipes-choisies,classement-en-cours,resultats,enchainement,gestes,regie,scene,chef-hors-classement}.test.ts"
---

# Le quiz : ses règles, son barème, ses vues

## Les fichiers

- `core/engine.ts` — route actions/commandes/timers vers le module de jeu, persiste, rediffuse les vues filtrées
- `games/quiz.ts` — **toutes** les règles : phases (l'intertitre, `cible` — la mesure d'une estimation en direct), chronomètres, barème (le temps de lecture offert au QCM, l'estimation payée à la distance, `reponseJuste` pour « plusieurs » et « ordre », tout ou rien), vues — et la place de chacun entre deux questions (`placeAuQuiz`)
- `shared/hasard.ts` — le hasard d'une partie : les réglages du quiz (réponses mélangées, questions dans le désordre, tirage de N questions, les jamais posées d'abord) et `preparerPartie`, qui tire **une fois** la copie jouée — l'ordre à retrouver toujours mélangé, jamais tel qu'écrit. Les index d'une réponse sont ceux de la copie : c'est elle que le journal numérote et que l'archive range
- `shared/programme.ts` · `core/programmes.ts` — le programme de la soirée : les quiz de ce soir dans l'ordre, leur multiplicateur, le prochain à lancer — aux écrans d'animateur seulement ; il se choisit en créant le salon (`SalonApp`, `quizDuSalon`), plus dans « Mes quiz »
- `shared/classement.ts` — la seule règle des ex æquo : rang partagé, vainqueurs, ordre d'affichage — et l'écart d'une estimation (`ecartEstimation`), les groupes d'ex æquo d'où se lisent les voisins (`groupesDExAequo`), le rang lu par dichotomie (`rangDansLesTries`)
- `shared/course.ts` · `client/src/games/quiz/Course.tsx` — sa place dans la course, à chaque révélation : « Ce quiz · encore 6 questions », « 5ᵉ place sur 12 · 450 pts ↑ 2 », « À 40 pts d'Hugo » — les bonnes nouvelles seulement, pas de rang à zéro, une phrase pour le lecteur d'écran ; au podium, le podium des équipes, celui des joueurs, puis le classement de tous et leurs points (`classement`, le même pour toute la salle, borné à `CLASSEMENT_DE_FIN`), l'emoji de son équipe à côté de chaque prénom (`PastilleEquipe`), et sa place à la soirée. La même règle au quiz du jour (`placeDuJour`)
- `shared/teams.ts` — la seule règle des équipes : la moyenne question par question des lignes jouées pour l'équipe — chaque ligne du journal fige la sienne (`team_id`) — (`questionsDesEquipes`, `moyenneAuProrata`) ; les points d'équipe sont cette moyenne, prix en plus (`finalPoints`, plus de points au rang 6-5-4… — le choix du 4 octobre 2026), un prix valant 100 points par défaut (`POINTS_D_UN_PRIX`, `PRIX_MAX`) ; la phrase qui l'explique (`regleDesEquipes`) et l'effet d'un prix avant le clic

## Les conventions et les pièges

- **Ce qui ne dépend pas du destinataire d'une vue** — un classement, un
  podium — passe par `vctx.memo` : un tri par vue coûtait une demi-minute par
  question à 500 invités. Et **une réponse ne recalcule que deux vues** —
  la sienne et celle de l'écran commun — parce que le quiz le promet
  (`vueDependDesAutres: false`) : une vue de téléphone qui lirait la réponse
  d'un autre en pleine question doit retirer cette promesse.
- **Le va-et-vient d'une question attend** : l'écran commun reçoit le
  compteur de réponses quatre fois par seconde au plus (le dernier compte
  toujours), et l'état d'une simple réponse s'écrit à la fin du tour de
  boucle (`persistBientot`) — `stop()` écrit celui qui attendait. Les
  téléphones qui tombent et reviennent passent par la même fenêtre
  (`rafraichirAnimateur`), qui compte depuis le dernier calcul, parti ou
  non : une vague de reconnexions à la révélation recalculait sinon la vue
  deux fois par téléphone. Un test qui lit le compteur ou les « hors
  ligne » de l'écran commun attend la vue qui porte le bon état, pas la
  suivante.
- **Une variante se juge par `reponseJuste`**, jamais par
  `r.choice === q.correct` : « plusieurs » et « ordre » envoient leurs cases
  (`choix`), et le journal n'en garde que le verdict (`choice` à null) — le
  bilan n'a donc pas de répartition pour elles. « Qui dans la salle ? »
  n'entre pas au journal : ni juste ni faux, il ferait baisser la précision
  de ceux qui votent.
- **La place d'un invité se lit, elle ne se trie pas** (`placeAuQuiz`) :
  à la révélation, chaque vue de téléphone porte l'identifiant, les points et
  le rang de ses voisins, lus dans le classement que la diffusion trie une
  fois (`indexDesPlaces`, `vctx.memo`) — et le téléphone les décore avec
  l'instantané. Rien pendant la question. Le retardataire qui n'a encore
  rien joué n'y tient pas de place : compté, il rejoindrait les ex æquo à
  zéro, et chaque arrivée pendant une révélation renverrait leur vue à
  tous. Un champ de la place qui dépendrait de toute la salle ferait de
  même : « sur combien » y était, et une exclusion renvoyait sa vue à chaque
  téléphone — il se lit maintenant dans l'instantané, que l'arrivée et
  l'exclusion renvoient déjà (`classement-en-cours.test.ts` y veille, pour
  les deux gestes).
