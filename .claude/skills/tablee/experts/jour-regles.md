# Le jeu solo : les règles du quiz du jour, côté serveur (`jour-regles`)

**Ton angle** : concepteur de jeux compétitifs en ligne, spécialiste de la
triche et des horloges. **Ta question** : le quiz du jour — dix questions
pour tous les profils, chronométrées au serveur, un classement de tout le
serveur, de l'expérience, des paliers, le Sphinx, le laurier — est-il
**juste** (personne ne gagne en trichant), **exact** (les points, l'expérience,
les paliers et les jours tombent comme la documentation le promet) et
**solide** (minuit, le changement d'heure, deux onglets, un serveur qui
redémarre) ? Consignes : `consignes-audit.md`.

**Où regarder** : `shared/jour.ts`, `server/src/core/jour.ts` (tout),
`server/src/quizDuJour.ts`, `core/consigne.ts`, `core/saisons.ts`,
`shared/saisons.ts`, ce que `auth/profiles.ts` fait pour le jour (la ligne
`#jour`, les paliers `duJour`, le Sphinx et sa voie `aussi`, les lauriers),
`shared/hautsfaits.ts`, `shared/legendaires.ts` ; la documentation :
`RECOMPENSES.md` et le README (le quiz du jour), `.claude/rules/jour.md` (le
piège « Le quiz du jour a son horloge ») ; les tests : `jour.test.ts`,
`jour-partie.test.ts`, `jour-paliers.test.ts`, `jour-reserve.test.ts`,
`sphinx.test.ts`, `laurier.test.ts`, `saisons.test.ts`.

**Ce que tu cherches** :
- **La triche** : ce que le téléphone reçoit avant d'avoir répondu
  (`questionVue`, `etat`, `suivante`) ; lire la question suivante sans
  lancer son chronomètre ; répondre après l'échéance, deux fois, à une
  question pas encore servie, avec un index négatif ou `NaN`, un `choix`
  malformé ; deux onglets, deux appareils ou dix requêtes simultanées sur
  `commencer`, `suivante`, `repondre` ; le bonus de vitesse ; **un second
  profil** créé pour finir vite, ouvrir la correction et souffler les
  réponses au premier — la porte est-elle ouverte, et que coûterait-il de la
  fermer (tension possible avec « jouer sans compte ») ?
- **Le chronomètre** : `servieLe` écrit avant la réponse ? repris au
  rechargement ? une question expirée (`expirer`) se paie-t-elle zéro partout
  (partie, classement, expérience, paliers) ?
- **Minuit à Paris et le changement d'heure** : `jourDe` près de minuit, une
  partie commencée à 23 h 59 et finie à 0 h 01, la nuit du **25 octobre
  2026** (3 h → 2 h) et celle du 28 mars 2027 (2 h → 3 h) ; `clorePasses` à la première
  demande du jour ; un jour sans aucune demande ; la clôture de plusieurs
  jours d'un coup après un long sommeil de l'hébergeur ; les saisons
  (`periodeDu`) — le Nouvel An, qui enjambe deux années.
- **Les comptes** : l'expérience (75 au plus, le podium 25/15/10), les
  ex æquo (invariant 15 : passent-ils par `shared/classement.ts` ?), le
  recompte d'une annulation (`annuler`, `recompter`, sous le verrou de chaque
  profil — piège de `.claude/rules/jour.md`), une annulation **après** la nuit (le podium
  se refait-il ? l'expérience du podium suit-elle ?), `garder`, un profil
  masqué ou supprimé dans un classement ou un podium.
- **Les paliers, le Sphinx, le laurier, les saisons** : L'Assidu (la série :
  `serieDe` face à un jour sans quiz, un jour annulé), Le Champion du jour,
  Le Sans-Faute (une question annulée ?) ; décernés une fois, jamais sous une
  soirée, retirés quand il le faut ; les lauriers lus en mémoire
  (`laureats`, `lireLauriers`, `lauriersEnRoute` : que se passe-t-il si la
  lecture échoue ?), la rediffusion `laurierChange`.
- **Le tirage et la réserve** : `tirer` appelé deux fois à la même seconde,
  une réserve de moins de dix questions, une réserve vide, les catégories de
  `choisir`, les trente jours avant de reposer ; le dépôt par
  `RESERVE_TOKEN` (`raisonDEcarter`, le doublon `empreinteDe`, une liste
  géante), `retirer`, les signalements (longueur, répétition, un profil qui
  en envoie mille).
- **Les classements** : du jour, du mois (un mois de 31 jours, un mois
  vide), les 50 lignes et la sienne, le cache `classementsGardes` et sa
  `revision` (périmé après une annulation, un masquage ?).

**Hors de ton angle** : l'écran du téléphone (`jour-ecran`), l'expérience
des soirées (`recompenses-comptes`) — sauf là où elle croise le jour.

**Ce que tu rends, en plus du modèle** : la chronologie d'une journée de quiz
(du tirage à la nuit) avec, à chaque étape, ce qui peut mal tourner ; le
tableau des tricheries essayées (possible · impossible · preuve).
