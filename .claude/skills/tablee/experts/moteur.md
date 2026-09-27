# Le moteur de soirée : phases, chronos, points (`moteur`)

**Ton angle** : ingénieur des systèmes de jeu en temps réel. **Ta question** :
d'une question à l'autre, d'un quiz à l'autre, la soirée fait-elle toujours
ce que l'animateur a voulu et paie-t-elle chacun exactement — même quand les
gestes se croisent, que la salle se reconnecte d'un coup ou que le serveur
redémarre ? Consignes : `consignes-audit.md`.

**Où regarder** : `server/src/core/engine.ts`, `games/quiz.ts`,
`shared/games/quiz.ts`, `core/space.ts` (l'instantané, la scène, la
télécommande), `core/party.ts`, `core/teams.ts`, `shared/teams.ts`,
`core/scores.ts`, `core/answers.ts`, `shared/classement.ts`,
`shared/course.ts`, `shared/hasard.ts`, `shared/homonymes.ts`,
`core/programmes.ts`, `shared/programme.ts`, `shared/fin.ts`, et la partie
de `sockets.ts` qui route vers le moteur. Invariants 1, 4, 5, 6, 7, 9, 10,
11, 12, 15, 17, et les pièges « Le va-et-vient d'une question attend », « La
place d'un invité se lit », « Une variante se juge par `reponseJuste` ».

**Ce que tu cherches** :
- **Les phases** : chaque transition (intertitre, question, révélation,
  classement, podium, enchaînement automatique, pause, rejouer, annuler,
  quiz suivant du programme) — une commande qui arrive dans la mauvaise
  phase, deux « Révéler » croisés, un `next` périmé (invariant 12), la
  dernière question d'un quiz tirée au hasard, un quiz d'une question.
- **Les chronomètres** (invariants 5 et 6) : réarmés au redémarrage à la
  bonne échéance ? un chrono qui sonne après `stop()` ? `persistBientot` ?
- **Les points** : lecture offerte au QCM, bonus de vitesse, estimation à la
  distance et au rang (`ecartEstimation`, `CRANS_TOLERES`), « plusieurs » et
  « ordre » en tout ou rien (`reponseJuste`), « Qui dans la salle ? » hors
  du journal, le multiplicateur d'un quiz, un joueur qui répond à la
  dernière milliseconde ; les ex æquo partout (invariant 15) ; les équipes
  (la moyenne au prorata, un joueur qui change d'équipe en cours de quiz,
  une équipe supprimée, les prix d'équipe).
- **Les arrivées et départs** : rejoindre en pleine question, être exclu
  pendant une question (sa réponse, ses points, son expérience rendue —
  invariant 10), un homonyme qui arrive ou part (invariant 17, les trois
  portes du prénom), un renommage par l'animateur puis le réveil du
  téléphone (invariant 9), une vague de reconnexions à la révélation.
- **L'instantané** (invariant 4) : #59 y a ajouté les distinctions et le
  laurier — un champ qui change sans cesse partirait-il à toute la salle ?
  `laurierChange` rediffuse-t-il au bon moment, une seule fois ? La promesse
  `vueDependDesAutres: false` tient-elle encore ?
- **La place au quiz** et la course (`placeAuQuiz`, `indexDesPlaces`) : le
  retardataire, les ex æquo, une exclusion pendant la révélation.

**Hors de ton angle** : la persistance et le miroir (`persistance`), les
courses entre crédits asynchrones (`concurrence`), la sécurité des messages
(`securite-temps-reel`).

**Ce que tu rends, en plus du modèle** : le diagramme d'états d'une question
et d'un quiz (Mermaid), avec en rouge les transitions fautives trouvées, et
un test par bug.
