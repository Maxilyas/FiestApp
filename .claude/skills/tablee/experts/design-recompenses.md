# Les récompenses à l'écran : carte, fonds, écussons, laurier (`design-recompenses`)

**Ton angle** : designer d'interfaces de jeu, du téléphone à la télé. **Ta
question** : ce que #58 et #59 ont ajouté à l'écran — le profil en trois
onglets, la grille des avatars et la collection, la vitrine, le titre sous le
prénom, les fonds de carte, les écussons, le laurier jusque dans les
soirées, le Sphinx et les légendaires de saison — est-il beau, lisible, et
tient-il dans les pires cas, sur un petit téléphone comme sur la télé ?
Consignes : `consignes-audit.md` (et `consignes-expert.md` si tu passes par
l'atelier).

**Où regarder** : `client/src/components/Apparence.tsx`, `Trophees.tsx`,
`Carriere.tsx`, `CarteJoueur.tsx`, `Ecusson.tsx`, `Laurier.tsx`,
`Legendaire.tsx`, `Divin.tsx`, `Icon.tsx`, `Podium.tsx`, `Leaderboard.tsx`,
`FinDeSoiree.tsx`, `views/ProfilApp.tsx`, `games/quiz/Course.tsx`,
`HostView.tsx`, `PlayerView.tsx`, les 325 lignes ajoutées à
`client/src/styles.css` (`git diff a6fc98b..HEAD -- client/src/styles.css`),
et `server/scripts/rendu-ecran.ts` (le pire cas de l'écran commun, qui sait
maintenant poser des lauriers).

**Ta méthode** : ton serveur jetable et le client construit dans ton dossier
(`consignes-audit.md`, « Un navigateur ») ; fabrique des profils riches
(niveaux hauts, légendaires, un fond de chaque sorte, douze écussons, un
titre long, une vitrine pleine) en écrivant dans la base permanente du banc
comme le font `collection.test.ts`, `fonds.test.ts`, `ecussons.test.ts`,
`laurier.test.ts` ; des lauréats d'hier aux prénoms longs dans une soirée de
dix invités. Capture en 360 × 640 (Velours et Ivoire, texte agrandi à 130 %,
mouvement réduit), et l'écran commun en 1366 × 768 et 1920 × 1080 — le
podium, le classement, la victoire avec des lauriers. `rendu-ecran.ts`
(`MESURE=1`) te donne l'écran commun d'un coup.

**Ce que tu évalues** : ce qui déborde, se coupe ou passe sous le pli ; le
laurier dans les listes coupées de la télé (`Coupe`) ; les contrastes des
nouveaux textes (or sur ivoire, texte sur un fond de carte animé) ; les
animations (coût, `prefers-reduced-motion`, un fond qui bouge sous un texte
qu'on lit) ; la cohérence avec le reste (tailles, rayons, ombres, jetons de
couleur) ; les états vides (un profil tout neuf : que montrent Trophées et
Carrière ?) ; les emojis de collection sous Windows 10.

**Hors de ton angle** : qui a le droit de porter quoi
(`recompenses-vitrine`), l'accessibilité fine (`accessibilite`).

**Ce que tu rends, en plus du modèle** : une planche par écran (captures,
ce qui va, ce qui ne va pas), et les corrections classées.
