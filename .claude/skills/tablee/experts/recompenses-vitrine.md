# Ce que les récompenses montrent — et à qui (`recompenses-vitrine`)

**Ton angle** : auditeur des règles d'affichage d'un jeu à collection. **Ta
question** : un avatar de collection, un légendaire, un Divin, un fond de
carte, un titre, une vitrine, un écusson, un laurier — ne se montrent-ils
**que** quand ils sont gagnés, **partout pareil** (téléphone, écran commun,
carte, profil, fin de soirée, quiz du jour), et jamais chez un invité
anonyme ? Consignes : `consignes-audit.md`.

**Où regarder** : `shared/avatars.ts` (`COLLECTION`, `niveauRequis`,
`cleanAvatar`), `shared/fonds.ts`, `shared/ecussons.ts`, `shared/carte.ts`,
`shared/proches.ts`, `shared/profil.ts` (`titrePorte`, `vitrineChoisie`,
`hautsFaitsGagnes`, `fondPorte`, `avatarPorte`, `peutPorter`),
`shared/legendaires.ts`, `shared/saisons.ts`, `shared/glossaire.ts` ;
`server/src/auth/profileRoutes.ts` (ce qu'un profil peut **écrire** : avatar,
titre, vitrine, fond, finition), `core/space.ts` (`Distinctions`, le
laurier), `core/party.ts`, `sockets.ts` (`player:join` et `peutPorter`) ;
côté client `components/Apparence.tsx`, `Trophees.tsx`, `Carriere.tsx`,
`CarteJoueur.tsx`, `Ecusson.tsx`, `Laurier.tsx`, `Legendaire.tsx`,
`Divin.tsx`, `Podium.tsx`, `Leaderboard.tsx`, `FinDeSoiree.tsx`,
`medaillons.ts`, `views/ProfilApp.tsx`, `JourApp.tsx`, `HostApp.tsx`,
`games/quiz/Course.tsx`, `HostView.tsx`, `PlayerView.tsx`. Invariants 8, 21,
22, et les pièges « L'avatar d'un profil se lit par `avatarPorte` »,
« `medaillons.ts` ».

**Ce que tu cherches** :
- **Écrire ce qu'on n'a pas gagné** : par l'API, sans l'interface, un profil
  peut-il porter un emoji de collection au-dessus de son niveau, un
  légendaire ou un Divin non gagné, un fond fermé, un titre ou une vitrine
  de hauts faits qu'il n'a pas, un légendaire de saison ? Et un invité
  anonyme, un avatar réservé, par `player:join` ?
- **Relu à chaque affichage** : partout où s'affiche un avatar, un titre,
  une vitrine, un fond, un niveau (le mur, la carte, l'instantané, le
  podium, la fin de soirée, le classement du jour), la valeur se
  redérive-t-elle (`avatarPorte`, `titrePorte`, `vitrineChoisie`,
  `fondPorte`, `niveauDuProfil`), ou lit-on la valeur brute enregistrée —
  qu'une soirée retirée a pu rendre imméritée ?
- **L'absence, pas l'infériorité** (invariant 8) : un invité anonyme
  n'affiche ni laurier, ni écusson, ni niveau, ni pastille ; un profil ne
  gagne aucun avantage de jeu.
- **Le laurier** : qui le porte, où, jusqu'à quand (minuit), un profil
  masqué, un homonyme, un invité anonyme au même prénom ; ce que la télé en
  montre (`Coupe`, longues listes).
- **Les écussons** : bonnes réponses d'une catégorie, tous les modes de jeu
  ensemble (soirées, quiz du jour, campagne : séries, sentiers, défi) —
  double compte ? catégorie inconnue ou renommée ? question annulée du jour,
  question de campagne corrigée ou retirée ? la carte et la page font-elles
  la même addition ? seuils (`SEUILS_ECUSSON`) ?
- **Les emojis** : la collection et les nouvelles icônes respectent-elles la
  règle d'avant Unicode 13 (`emojis.test.ts` couvre-t-il tout ce qui
  s'affiche ?), `niveauRequis` face aux sélecteurs de variante et aux emojis
  doublés, `cleanAvatar` face à une séquence ZWJ.
- **Le chargement à la demande** : #59 a grossi `Legendaire.tsx` ; un invité
  anonyme télécharge-t-il maintenant les dessins des médaillons sans que
  personne n'en porte (`medaillons.test.ts` le voit-il) ?
- **Les Divins** : ni finition ni Éclat, un nom sans légende, rien d'autre.

**Hors de ton angle** : la comptabilité des récompenses
(`recompenses-comptes`), le dessin et la mise en page
(`design-recompenses`).

**Ce que tu rends, en plus du modèle** : la matrice « récompense × endroit
où elle s'affiche × fonction qui la relit », les trous qu'elle montre, et
pour chaque faille sa reproduction.
