# Le client : ce qui casse dans le navigateur (`client`)

**Ton angle** : ingénieur front-end React, spécialiste des applications
temps réel qui restent ouvertes des heures. **Ta question** : qu'est-ce qui,
dans le code du navigateur, peut laisser un téléphone ou l'écran commun dans
un état faux — une page blanche, une vue périmée, un bouton mort, une fuite
de mémoire au bout de trois heures, un geste envoyé deux fois ? Consignes :
`consignes-audit.md`.

**Où regarder** : `client/src/main.tsx`, `routes.ts`, `state.ts`, `socket.ts`,
`api.ts`, `onglets.ts`, `brouillon.ts`, `format.ts`, les vues
(`PlayerApp.tsx`, `HostApp.tsx`, `ProfilApp.tsx`, `AccountApp.tsx`,
`AdminApp.tsx`, `ArchivesApp.tsx`, `RecapApp.tsx`, `BilanApp.tsx`, et
`EditorApp.tsx` pour ses effets et ses fuites), les composants de la soirée
(`Entree.tsx`, `Liaison.tsx`, `Absents.tsx`, `Reprendre.tsx`,
`FinDeSoiree.tsx`, `Lendemain.tsx`, `Programme.tsx`, `Cloture.tsx`,
`Coupe.tsx`, `ChampNombre`), `games/quiz/*`. Pièges « Pas de `socket.on`
direct » (côté client : `watchParty` et `helloHost` rejettent sur délai,
`joinAsPlayer` et `setMyTeam` résolvent un refus), « L'éditeur n'envoie rien
pendant qu'on écrit » (`auReveil`), et la convention « tout accès au
stockage du navigateur sous try/catch ».

**Ce que tu cherches** :
- **Les effets** : un écouteur, un intervalle, un socket ou un
  `requestAnimationFrame` sans nettoyage ; un `setState` après démontage ;
  une fermeture qui garde un état périmé dans un rappel de socket ; une
  boucle de rendus ; des clés de liste par index là où l'ordre change.
- **Les réponses qui se croisent** : deux requêtes dont la plus ancienne
  arrive la dernière et écrase la plus récente ; une navigation pendant un
  chargement ; un rejeu `auReveil` d'une écriture qui n'est pas rejouable
  sans dommage.
- **La liaison** : reconnexion de socket.io, re-présentation du jeton
  (invariant 9), `host:hello` rejoué, veille et réveil (`visibilitychange`,
  `pageshow` et le cache avant/arrière de Safari), ce que voit l'invité
  quand ça tombe (`Liaison.tsx`).
- **Le temps** : un compte à rebours calculé à `Date.now()` sans le décalage
  de l'horloge du serveur (invariant 6, côté écran).
- **Les pages blanches** : une exception de rendu sans limite d'erreur
  (`ErrorBoundary`) ; un JSON inattendu (champ absent d'une page d'avant, ou
  d'un serveur plus récent) ; un stockage bloqué (convention).
- **La mémoire** : l'écran commun ouvert trois heures, trente questions,
  deux quiz — ce qui grossit sans fin (listes d'événements, caches, images).
- **Le double geste** : un bouton d'envoi qui se touche deux fois, un
  formulaire qui part deux fois, Entrée et clic ensemble.
Quand un soupçon demande à voir, construis le client dans ton dossier et
rejoue-le dans Chromium (`consignes-audit.md`, « Un navigateur »).

**Hors de ton angle** : le quiz du jour à l'écran (`jour-ecran`), le
protocole d'enregistrement des quiz (`bibliotheque`), le dessin
(`design-recompenses`), l'accessibilité (`accessibilite`).

**Ce que tu rends, en plus du modèle** : la liste des défauts par fichier,
chacun avec le scénario qui le déclenche et la correction proposée.
