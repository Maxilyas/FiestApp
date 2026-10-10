---
paths:
  - "shared/{themes,fonds,gerbes}.ts"
  - "client/src/{themeJoueur,theme,gerbe}.ts"
  - "client/src/themes/**"
  - "client/src/components/{Boutique,Objets,Gerbe}.tsx"
  - "client/public/fonts/**"
  - "server/scripts/{apercus-themes,rendu-themes}.ts"
  - "server/test/{themes,fonds,gerbes,boutique,heros,decors-peints}.test.ts"
---

# Les thèmes, les fonds, les gerbes, la boutique

## Les fichiers

- `shared/themes.ts` · `client/src/themeJoueur.ts` · `client/src/themes/` · `components/Boutique.tsx` — les thèmes et leurs confettis : une bonne réponse, un confetti — les soirées qui comptent (`confettisDeSoiree`, sur les relevés), le quiz du jour (`JourStore.justesDe`) et la campagne, avec les étoiles de ses sentiers (`CampagneStore.confettisDe`, `CONFETTIS_DES_ETOILES`) —, moins les achats (`profile_achats`, et les vies des sentiers, `profile_vies`), relus à chaque lecture (`ProfileStore.boutiqueDe`) : rétroactifs, un solde qui peut passer sous zéro, un achat jamais repris ; trente thèmes à l'échelle de rareté (`PRIX_DES_THEMES`), six de saison (`enBoutique`), achetés d'un geste — portés aussitôt (« Acheter et porter ») ou gardés pour plus tard (« L'acheter seulement », `porter: false` ; sans le drapeau, une page d'avant porte), la boutique disant alors où il est passé (le choix du 10 octobre 2026) — (`POST /api/joueur/themes`) ; la rareté choisie à la main se quitte quand on en achète le dernier thème (`rareteDuRayon` : la page tombait sur le prix d'un thème parti) — et cinq qui ne se vendent pas, ils se gagnent (`gagne`, jamais `enBoutique`, possédés par `boutiqueDe` — `themeGagne`) : Babel aux douze paliers de maître des sentiers, l'Horloge astronomique à cinquante victoires au quiz du jour, le Ciel du jour à L'Infatigable · Argent, les Très Riches Heures aux douze pages du calendrier, le Sommet à L'Alpiniste · Or ; chacun dit où il se gagne (`gagne.ou` : les sentiers, le quiz du jour, la série) ; la boutique ne les montre plus — rien ne s'y achète (la remarque du 6 octobre 2026) —, « Ma collection » si, sans prix (`etatDuTheme` : `a-gagner`), et leur fiche mène au lieu qui les donne — le lien d'avant menait les cinq aux sentiers. Le thème suit la personne (le choix du 4 octobre 2026) : toutes les pages du profil connecté ici — l'accueil, sa page, la boutique, ses quiz, son compte, son salon, la soirée, le quiz du jour, la campagne, le souvenir et le bilan — le portent, celui retenu au démarrage (`poserThemeRetenu`, `main.tsx`), puis celui que dit le serveur : lu avec le profil par la page qui le lit (`porterTheme`, `LISENT_LE_PROFIL`), demandé seul sinon (`confirmerTheme`, `GET /api/joueur/theme`, lu en mémoire) ; jamais l'écran commun ni la télé — l'aperçu de l'écran commun, dans « Mes quiz », prend son habit le temps de s'ouvrir (`commeLEcranCommun`) —, ni les fiches imprimées du bilan, en Ivoire, et l'anonyme joue en Velours. Chaque thème a sa feuille, chargée à la demande (`import.meta.glob`) — ses jetons sous `:root[data-theme='<clé>']`, son décor dans les couches fixes (`body::before`…, `#root::after`), ses animations à son nom, arrêtées si le système demande moins de mouvement —, et ses polices (`client/public/fonts/themes`, licences jointes) ; `design.test.ts` en mesure les contrastes. La boutique (`/boutique`) a deux rayons sous une barre fine (`PanneauBoutique`, `onglets-fins` — les pilules restent aux choix qui changent tout l'écran) : les thèmes (`RayonDesThemes`), qui ne vendent que ce qu'on n'a pas, une rareté à la fois, et les objets (`/boutique#objets`, `RayonDesObjets`) — une vie des sentiers, un sablier pour la série du quiz du jour, et ce qui viendra (`OBJETS`, `components/Objets.tsx`) —, en icônes : toucher une case déplie sa fiche — ce qu'il fait, ce qu'on en a, combien on en prend, le total —, d'où l'on achète ; l'adresse d'un objet ouvre sa fiche (`adresseDeLObjet`, `#objet-sablier`), et `#vies`, celle d'avant, celle de la vie ; ceux qu'on a se portent dans « Mon thème » (`/profil#theme`, `MesThemes`) — les mêmes cartes, le geste de « Mon avatar » — toucher un thème ouvre sa fiche sous sa rangée, on le porte ou on l'achète de là (`DetailTheme`), jamais d'un toucher —, et le thème porté s'y lit dans `PublicProfile.theme`, que chaque enregistrement rend, jamais dans `boutique.porte`, figé à la lecture de la page (`themes.test.ts` y veille) ; le solde en tête du profil, les confettis de ce soir à la fin de soirée (`FinDeSoiree.profil.confettis`)
- `shared/fonds.ts` — les fonds de carte (nuit étoilée, aurore boréale, kintsugi, grand théâtre, cabinet de curiosités — au troisième palier de maître des sentiers, `maitres` —, et deux peints : le Triomphe, au champion du mois, le Cadran solaire, à L'Élite · Argent) : ce qu'on voit derrière sa carte, rien ailleurs ; ceux qu'il a gagnés (`fondsOuverts`), celui qu'il porte relu à chaque affichage (`fondPorte`), comme un titre. Le décor tient au cadre de la carte (`.carte-fond`), son contenu défile par-dessus (`.carte-defile`) ; nocturne sous tous les thèmes de celui qui regarde : la carte reprend les couleurs du Velours (`:root, .carte-fond`), et aucune règle d'un thème n'y peint (`fonds.test.ts`) — le `.card` de Héros la repeignait en blanc
- `shared/gerbes.ts` · `client/src/gerbe.ts` · `components/Gerbe.tsx` — la gerbe : ce qui éclate sur son téléphone à une bonne réponse — en soirée, au quiz du jour, en campagne, sur les sentiers, au défi. Dix gerbes, les confettis pour tout profil, les autres ouvertes par un haut fait ou un palier (`gerbesOuvertes`) ; celle qu'il porte se relit à chaque affichage (`gerbePortee`, la colonne `profiles.gerbe`), se choisit dans « Mon thème » (`MaGerbe`), et ne part qu'à lui (`PublicProfile.gerbe`) : ni la salle ni l'écran commun n'en savent rien, l'anonyme n'en a pas (invariant 8). La page qui lit le profil la retient (`porterGerbe`, comme le thème) ; elle éclate dans un portail sur `body` — une carte à `backdrop-filter` devenait le repère de son `position: fixed` et la rognait —, par `transform` et `opacity`, et se tait si le système demande moins de mouvement (`gerbes.test.ts`)
- `server/scripts/apercus-themes.ts` — les aperçus de la boutique : l'écran d'une question photographié dans l'application sous chaque thème (client construit d'abord), rogné à la question et réduit en WebP dans `client/src/themes/apercus/` ; `themes.test.ts` refuse un thème sans le sien

## Les pièges

- **Un thème de plus** entre au catalogue (`shared/themes.ts`) avec sa
  feuille (`client/src/themes/<clé>.css` : ses jetons sous
  `:root[data-theme='<clé>']`, ses `@keyframes` préfixées de sa clé, un bloc
  `prefers-reduced-motion`), ses polices dans `client/public/fonts/themes`
  et leur ligne dans `LICENCES.txt`, et son aperçu
  (`scripts/apercus-themes.ts <clé>`) : `design.test.ts` mesure ses
  contrastes aux seuils d'Ivoire et `themes.test.ts` réclame son aperçu.
  Une règle qui peindrait une carte à fond ou ce qu'elle montre — `.card`,
  `.label`, `.niveau`, un halo sur `.muted` — s'en écarte par
  `:where(:not(.carte-fond, .carte-fond *))` (sans rien changer à sa
  force) : le décor d'un fond reste nocturne, et `fonds.test.ts` relit
  chaque feuille.
  Ivoire, lui, vit dans `styles.css` : l'écran commun le porte aussi. Un
  thème **peint** cite ses images dans le bloc que `decors.ts --livrer`
  réécrit entre ses deux repères (`--decor-…`), jamais ailleurs, et rend
  opaques `--surface` et ce qui se pose en `--accent-soft` : translucides,
  ils laissaient passer le tableau sous le texte. Sa lisibilité se mesure
  sur ce qui est vraiment peint derrière chaque ligne
  (`scripts/rendu-themes.ts <clé> --contraste`), pas sur `--bg` seul.
