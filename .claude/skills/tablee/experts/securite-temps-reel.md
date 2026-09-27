# Le temps réel : ce qu'un socket peut faire et apprendre (`securite-temps-reel`)

**Ton angle** : auditeur de sécurité des applications temps réel, et
ingénieur fiabilité multi-espaces. **Ta question** : avec un simple client
socket.io, que peut faire ou apprendre un invité, un curieux ou un animateur
voisin — commander une soirée qui n'est pas la sienne, lire la bonne réponse
avant la révélation, suivre un joueur d'un espace à l'autre, ou faire tomber
le processus qui porte toutes les soirées ? Consignes : `consignes-audit.md`.

**Où regarder** : `server/src/sockets.ts` (tout message passe-t-il par
`ecouter()` ? chaque accusé est-il appelé ?), `shared/events.ts`,
`core/space.ts` (les deux instantanés : `enPlusPourLesEcrans`,
`pourLesTelephones` ; les `Distinctions` et le laurier ajoutés par #59),
`core/engine.ts` et `games/quiz.ts` (`playerView`, `hostView`), `core/party.ts`,
`core/places.ts`, `core/inscriptions.ts`, `auth/appairage.ts`, `core/pages.ts`
et les pages publiques de `server.ts` (`/s/<espace>/…`, `recap.json`,
`bilan.json`, `soirees.json`, la carte d'un joueur `shared/carte.ts`).
`garde-fous.test.ts`, `protocole.test.ts`, `espaces.test.ts` disent ce qui est
déjà gardé : cherche à côté.

**Ce que tu cherches** :
- **Commander ailleurs** : un socket d'animateur de A qui envoie des
  `host:*` avec les identifiants de B (joueur, équipe, soirée) ;
  `host:telecommande`, `host:scene` ; un téléphone qui joue une commande
  d'animateur ; un `player:action` qui vise la partie d'un autre espace.
- **Lire avant la révélation** (invariant 1) : tout ce que reçoit un
  téléphone pendant une question — vue, instantané, `party:watch`, et les
  **JSON publics en cours de soirée** (souvenir, bilan : portent-ils la
  question en cours, sa bonne réponse, son anecdote ?) — pour chaque sorte de
  question (QCM, vrai/faux, estimation et sa cible, « plusieurs », « ordre »
  et l'ordre d'origine, photo de révélation, extrait de blind test, note de
  l'animateur, programme). Les adresses des médias se devinent-elles ?
- **Suivre quelqu'un** (invariant 8, et la vie privée) : ce que la carte
  d'un joueur (`/s/<espace>/joueurs/<id>.json`), le laurier, les écussons et
  l'instantané disent d'un profil — ses autres espaces, ses soirées
  ailleurs, son identifiant de connexion ? Les identifiants se devinent-ils
  ou s'énumèrent-ils ? Un profil **masqué** par l'administration
  reste-t-il visible ? Un invité **anonyme** n'affiche-t-il vraiment rien ?
- **L'étanchéité** (invariant 3) : un jeton d'invité de A présenté dans B,
  `party:watch` de B, l'identifiant d'une soirée archivée de A lu sous
  l'adresse de B, les marques d'homonymie qui traversent (invariant 17), un
  même profil qui joue dans deux espaces à la fois.
- **L'identité** (invariant 9) : jeton rejoué, `unknown-token`,
  `soiree-close` ; `player:reprendre` — le code à usage unique se
  devine-t-il (cinq essais par minute : par quoi comptés ? un attaquant
  peut-il épuiser ceux d'un autre ?) ; l'appairage de la télé (code court,
  session héritée, 24 heures au plus).
- **Tuer ou étouffer le processus** : une charge malformée sur chaque
  message (absente, `null`, tableau, nombre géant, chaîne d'un mégaoctet),
  un accusé absent, une avalanche de `player:join` (la réserve
  d'inscriptions par adresse et par espace), mille sockets par adresse,
  `maxHttpBufferSize`, un `player:action` répété mille fois par seconde, une
  exception dans un gestionnaire asynchrone (promesse rejetée sans
  `catch` : Node 22 arrête le processus).

**Hors de ton angle** : l'authentification HTTP (`securite-portes`), la
justesse des règles du jeu (`moteur`).

**Ce que tu rends, en plus du modèle** : le tableau des messages socket
(message · qui peut l'envoyer · contrôle d'espace · validation de la charge ·
accusé), la liste des essais (tenu, cédé), et pour chaque faille un script
qui la rejoue.
