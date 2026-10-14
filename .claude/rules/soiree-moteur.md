---
paths:
  - "server/src/games/**"
  - "server/src/core/{engine,teams,programmes}.ts"
  - "shared/{classement,course,teams,hasard,programme}.ts"
  - "shared/games/**"
  - "client/src/games/**"
  - "client/src/components/{Shape,Rank,PastilleEquipe}.tsx"
  - "server/test/{moteur,variantes,hasard,programme,equipes,equipes-choisies,classement-en-cours,resultats,enchainement,regie,scene,chef-hors-classement,bareme,console,entourage,salle-vide,protocole,grande-salle}.test.ts"
---

# Le quiz : ses règles, son barème, ses vues

## Les fichiers

- `core/engine.ts` — une partie à la fois par espace : route actions/commandes/timers vers le module de jeu, persiste, rediffuse les vues filtrées. Ses participants sont les invités connectés au lancement, puis ceux qui arrivent (`joinLate`) ; ses chronomètres s'écrivent avec la partie et se réarment au redémarrage (`restore`, invariant 5)
- `games/quiz.ts` — **toutes** les règles : phases (l'intertitre, `cible` — la mesure d'une estimation en direct), chronomètres, barème (le temps de lecture offert au QCM, l'estimation payée à la distance, `reponseJuste` pour « plusieurs » et « ordre », tout ou rien), vues — et la place de chacun entre deux questions (`placeAuQuiz`). Il tient trois mémoires par espace — la bibliothèque jouable, le programme actif, la dernière pose de chaque question (`setQuizLibrary`, `setProgramme`, `setQuestionsPosees`) —, rechargées après chaque écriture, même en pleine partie : la partie joue sa copie (`st.pack`), tirée au `selectPack`, qui relit la bibliothèque à l'instant ; la liste du choix (`st.packs`), elle, est figée au lancement
- `shared/hasard.ts` — le hasard d'une partie : les réglages du quiz (réponses mélangées, questions dans le désordre, tirage de N questions, les jamais posées d'abord) et `preparerPartie`, qui tire **une fois** la copie jouée — l'ordre à retrouver toujours mélangé, jamais tel qu'écrit. Les index d'une réponse sont ceux de la copie : c'est elle que le journal numérote et que l'archive range
- `shared/programme.ts` · `core/programmes.ts` — le programme de la soirée : les quiz de ce soir dans l'ordre, leur multiplicateur, le prochain à lancer — aux écrans d'animateur seulement ; il se choisit en créant le salon (`SalonApp`, `quizDuSalon`), plus dans « Mes quiz ». Est « joué ce soir » tout quiz choisi dans une partie de la soirée, même interrompue (`lancementDeQuiz`, `core/space.ts`) : le programme ne le repropose plus
- `shared/classement.ts` — la seule règle des ex æquo : rang partagé, vainqueurs, ordre d'affichage — et l'écart d'une estimation (`ecartEstimation`), les groupes d'ex æquo d'où se lisent les voisins (`groupesDExAequo`), le rang lu par dichotomie (`rangDansLesTries`)
- `shared/course.ts` · `client/src/games/quiz/Course.tsx` — sa place dans la course, à chaque révélation : « Ce quiz · encore 6 questions », « 5ᵉ place sur 12 · 450 pts ↑ 2 », « À 40 pts d'Hugo » — les bonnes nouvelles seulement, pas de rang à zéro, une phrase pour le lecteur d'écran ; au podium, le podium des équipes, celui des joueurs, puis le classement de tous et leurs points (`classement`, le même pour toute la salle, borné à `CLASSEMENT_DE_FIN`), l'emoji de son équipe à côté de chaque prénom (`PastilleEquipe`), et sa place à la soirée. La même règle au quiz du jour, au défi et aux duels (`placeDuJour`)
- `shared/teams.ts` — la seule règle des équipes : la moyenne question par question des lignes jouées pour l'équipe — chaque ligne du journal fige la sienne (`team_id`) — (`questionsDesEquipes`, `moyenneAuProrata`) ; les points d'équipe sont cette moyenne, prix en plus (`finalPoints`, plus de points au rang 6-5-4… — le choix du 4 octobre 2026) ; un prix se remet pour le plaisir, à 0 point par défaut — cent jusqu'au 12 octobre 2026, la remise renversait la victoire qu'on venait d'annoncer : un choix de produit (`POINTS_D_UN_PRIX`, `PRIX_MAX` pour qui lui en donne) —, et au podium d'un quiz « Quiz suivant » passe devant « Remise des prix » ; la phrase qui l'explique (`regleDesEquipes`), l'effet d'un prix avant le clic, et « Prix à points compris » sous le podium seulement s'il y en a (`mentionDesPrix`, `equipes.test.ts`)

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
- **Qui compte passe par les mêmes filtres** : `joueurs()` — sans le chef
  qui anime seulement, dont les réponses vont à `horsReponses` —,
  `playFrom` — le retardataire arrivé quand sa question était close :
  révélée, en mesure, finie, la salle qui avait fini, ou moins de temps
  qu'il n'en faut pour la lire (`onPlayerJoin`) — et `dispenses` — le
  hors-ligne qu'on n'attend plus. L'attente (`awaited`), le journal
  (`logQuestion`) et le classement les appliquent tous : un compte de plus
  qui en oublie un fait attendre la salle pour un fantôme, ou baisser la
  moyenne d'une équipe. Les candidats d'un sondage, eux, ne passent que par
  `playFrom` (`startQuestion`) : le chef qui anime seulement et un
  téléphone qu'on n'attend plus y restent désignables.
- **Un geste qui fait avancer la partie porte sa visée** (invariant 12) :
  `perimee` ne juge que `next`, `cancel`, `replay` et `cible` ; les réponses
  portent `qIndex` et `round`, jamais la phase. Une commande de plus qui
  change la phase s'y range, sinon un double clic la joue deux fois. Et
  `cancel` désarme l'enchaînement : la révélation d'une question annulée
  attend le clic.
- **Le barème des QCM sert aussi le quiz du jour** : `core/jour.ts` importe
  `pointsDuChoix`, `tempsDeLecture`, `GRACE_MS`, `bonusDeRapidite` et
  `POINTS_MAX_PAR_QUESTION`, la base de son expérience. Retoucher
  `CHOICE_POINTS`, `SPEED_BONUS` ou `LECTURE_MS…` change ses parties à venir
  — un choix de produit des deux côtés. Les points d'une soirée, eux, sont
  figés au journal : `VERSION_BAREME` n'y change rien.
- **La place d'un invité se lit, elle ne se trie pas** (`placeAuQuiz`) :
  à la révélation, chaque vue de téléphone porte l'identifiant, les points et
  le rang de ses voisins, lus dans le classement que la diffusion trie une
  fois (`indexDesPlaces`, `vctx.memo`) — et le téléphone les décore avec
  l'instantané. Rien pendant la question. Le retardataire qui n'a encore
  rien joué n'y tient pas de place : compté, il rejoindrait les ex æquo à
  zéro, et chaque arrivée pendant une révélation renverrait leur vue à
  tous. « Sur combien » se lit dans l'instantané pour la même raison : dans
  la place, une exclusion renvoyait sa vue à chaque téléphone
  (`classement-en-cours.test.ts` y veille, pour les deux gestes).
