# Plusieurs soirées à la fois : étanches et solides ? (`robustesse-espaces`)

**Ton angle** : ingénieur fiabilité. **Ta question** : deux, trois, dix
soirées en même temps sur un serveur — restent-elles **étanches** (invariant
3 : un identifiant qui n'est pas du sien vaut « introuvable »), et le
serveur tient-il leurs croisements ?

**Ta méthode** : lis `server/src/core/space.ts`, `core/engine.ts`,
`sockets.ts`, `core/party.ts`, `auth/`, et démarre **ton propre serveur**
jetable (voir les consignes) sur lequel des scripts à toi (socket.io-client,
sur le modèle de `server/scripts/load-test.mjs` et `fake-player.mjs`) font
jouer trois espaces en même temps. Puis cherche la faille :
- **les fuites** : le socket d'un animateur A qui envoie une commande avec
  l'identifiant de session de B ; un jeton d'invité de A présenté dans B
  (`player:join` avec jeton et slug de B) ; `party:watch` de B depuis une
  page de A ; les JSON publics de B avec un identifiant de soirée archivée
  de A ; la carte d'un joueur de A lue sous l'adresse de B ; un invité de A
  reçoit-il jamais une vue de B ?
- **les homonymes d'un espace à l'autre** : même prénom et même avatar chez
  A et chez B — aucune marque « (2) » ne doit traverser.
- **les croisements** : un même profil qui joue dans deux soirées **en même
  temps** (deux téléphones) — l'expérience créditée aux deux clôtures
  (idempotence `(profil, soirée)`, invariant 10) ; deux clôtures à la même
  seconde ; « C'était un essai » chez A pendant que B crédite ; un
  redémarrage (SIGTERM, puis SIGKILL) en pleine question dans deux espaces
  — les deux reprennent-elles, chronos réarmés (invariant 5) ?
Chaque faille trouvée : un script qui la rejoue, dans ton dossier.

**Ce que tu rends, en plus du modèle** : la liste des essais (ce qui a
tenu, ce qui a cédé), chaque faille avec son script de reproduction, et
**les tests à ajouter à `server/test/`** — écrits dans ton rapport, sur le
modèle des tests existants (`banc.ts`), pas dans le dépôt.
