---
paths:
  - "shared/{themes,fonds,gerbes}.ts"
  - "client/src/{themeJoueur,theme,gerbe,apercus}.ts"
  - "client/src/themes/**"
  - "client/src/components/{Boutique,Objets,Gerbe,RayonDesCompagnons,PanneauxDuProfil}.tsx"
  - "client/public/fonts/**"
  - "server/scripts/{apercus-themes,rendu-themes}.ts"
  - "server/test/{themes,fonds,gerbes,boutique,decors-peints,loge}.test.ts"
---

# Les thèmes, les fonds, les gerbes, la boutique

## Les fichiers

- `shared/themes.ts` · `client/src/themeJoueur.ts` · `client/src/theme.ts` · `client/src/themes/` — trente-cinq thèmes (`THEMES`) : Velours et Ivoire offerts, vingt-huit à vendre du Commun au Légendaire (`PRIX_DES_THEMES` : 150, 250, 400, 650, 1000 — une rareté décrétée avec son prix), dont six de saison, en boutique pendant leur période seulement (`enBoutique` ; le Nouvel An enjambe l'année), et cinq qui ne se vendent pas, ils se gagnent (`gagne`, relus à chaque lecture par `themeGagne`) : Babel aux douze paliers de maître des sentiers, l'Horloge astronomique à cinquante victoires au quiz du jour, le Ciel du jour à L'Infatigable · Argent, les Très Riches Heures aux douze pages du calendrier, le Sommet à L'Alpiniste · Or — ces quatre-là peints. Chacun dit où il se gagne (`gagne.ou`) : la boutique ne les montre pas — rien ne s'y achète (la remarque du 6 octobre 2026) —, « Ma collection » si, sans prix (`etatDuTheme` : `a-gagner`). Le thème suit la personne (le choix du 4 octobre 2026 : les pièces du menu changeaient d'habit d'un toucher à l'autre) : toute page, sur tout appareil où son profil est connecté, sauf l'écran commun et la télé (`HostApp`, en Velours ou en Ivoire : `theme.ts`) et les fiches imprimées du bilan, en Ivoire ; l'anonyme joue en Velours. La page pose le dernier thème porté ici (`poserThemeRetenu`, `quizz.theme-joueur`), puis celui du serveur : lu avec le profil par les pages qui le lisent (`porterTheme`, `LISENT_LE_PROFIL` — `themes.test.ts` la compare aux vues), demandé seul ailleurs (`confirmerTheme`, `GET /api/joueur/theme`, lu en mémoire). L'aperçu de l'écran commun, dans « Mes quiz », passe devant l'essai de la loge, l'essai devant le thème porté (`commeLEcranCommun`, `essayerTheme`, `finirLEssai`), et une feuille arrivée en retard ne remplace pas une demande plus récente. Chaque thème hors Velours et Ivoire (dans `styles.css`) a sa feuille, chargée à la demande (`import.meta.glob`) — ses jetons sous `:root[data-theme='<clé>']`, son décor dans les couches fixes (`body::before`…, `#root::after`), ses animations à son nom, arrêtées si le système demande moins de mouvement —, et ses polices (`client/public/fonts/themes`, licences jointes) ; l'Horloge, le Ciel et les Heures lisent l'heure de Paris, posée sur `<html>` à la minute tant qu'ils sont portés (`SUIVENT_L_HEURE`). Le thème porté se lit dans `PublicProfile.theme`, que chaque enregistrement rend, jamais dans `boutique.porte`, figé à la lecture de la page (`themes.test.ts`)
- Les confettis (`ProfileStore.boutiqueEtDons`) — une bonne réponse, un confetti, relus à chaque lecture, jamais écrits : les soirées qui comptent (`confettisDeSoiree`, sur les relevés : QCM justes et estimations du tiers le plus proche — ni points ni multiplicateur), le quiz du jour (`JourStore.justesDe`), la campagne — tous ses modes, les étoiles des sentiers et les ligues des duels (`CampagneStore.duProfil`, `CONFETTIS_DES_ETOILES`, `confettisDesLigues` ; la même lecture rend ses paliers et sa cote, et la page du profil la partage : `boutiqueDe` la reçoit) —, et les dons de l'administrateur (`profile_dons`, règle `qg.md`), les missions du jour et les coffres de la semaine (`profile_missions`, `profile_coffres`, règle `missions.md`) ; moins les achats, chacun au prix qu'il a payé, écrit avec lui : thèmes (`profile_achats`), vies des sentiers (`profile_vies`), sabliers (`profile_sabliers`), compagnons (`profile_compagnons`), fonds des savoirs (`profile_fonds`). Rétroactifs : une règle changée change d'un coup le solde de tous, une soirée retirée reprend les siens et le solde peut passer sous zéro ; un achat ne se reprend jamais. Ceux de ce soir se disent à la fin de soirée (`FinDeSoiree.profil.confettis`)
- `components/Boutique.tsx` · `Objets.tsx` · `RayonDesCompagnons.tsx` · `RayonDesFonds.tsx` · `PanneauxDuProfil.tsx` — la boutique (`/boutique`), quatre rayons sous une barre fine (`PanneauBoutique`, `onglets-fins` — les pilules restent aux choix qui changent tout l'écran) : les thèmes (`RayonDesThemes`) — ce qu'on n'a pas et que la saison permet, une rareté à la fois, la plus belle à sa portée d'office ; la rareté choisie se quitte quand on en achète le dernier (`rareteDuRayon` : la page tombait sur le prix d'un thème parti) ; toucher une carte ouvre sa fiche, « L'acheter » ouvre le choix — « Acheter et porter » ou « L'acheter seulement » (`porter: false` ; sans le drapeau, une page d'avant porte), et la boutique dit alors où il est passé (le choix du 10 octobre 2026) — ; les compagnons (`#compagnons`, `#compagnon-<clé>` tourne la vitrine vers lui, règle `profil.md`) — une scène chacun, qu'on fait défiler : sa forme du moment en grand, qui bondit au toucher, ses quatre formes en couleur, chacune montrée en grand au toucher, puis 1000 confettis (`PRIX_D_UN_COMPAGNON`) et « L'adopter », ou sa jauge et « Le porter en avatar » (la loge, sa forme à l'essai ; on ne le porte pas d'ici) ; adopté, il s'installe dans sa niche sans devenir son avatar — quand un autre y vit, l'y installer ou l'adopter seulement (le 19 octobre 2026 : la niche est sa maison, l'avatar une autre affaire, règle `profil.md`) — ; les fonds (`#fonds`, `RayonDesFonds`) — les douze des savoirs, chacun sous sa propre carte (son avatar, son prénom, le savoir qu'il habille : on habille sa carte, on n'achète pas un décor), 250 confettis (`PRIX_D_UN_FOND`) ; `#fond-<clé>` ouvre sa fiche, la carte en grand, et l'achat, comme un thème ; le trésor n'y paraît pas, la collection dit d'où il vient — ; les objets (`#objets`, `RayonDesObjets`, `OBJETS`) — la vie des sentiers (25) et le sablier de la série (50, deux au plus) —, en icônes, chacune sa fiche ; `#objet-sablier` ouvre sa fiche (`adresseDeLObjet`), `#vies`, l'adresse d'avant, celle de la vie. Le serveur compte chaque achat et le refuse en clair — pas assez, hors saison, déjà à toi, ne se vend pas —, un à la fois par profil (`unAchatALaFois` : deux onglets dépensaient deux fois le même solde) ; la page montre le solde qu'il rend. Ce qu'on a se porte dans la loge, pièce « Thème » (`/profil#theme`, `MesThemes` ; règle `profil.md`) : toucher un thème l'**essaie** sur toute la page, rien n'est enregistré, « Porter », dans la barre de la loge, le garde (`loge.test.ts`) — il s'enregistrait d'un toucher : on ne voyait un thème qu'en le portant pour de bon
- `shared/fonds.ts` — vingt-cinq fonds de carte — dont six du trésor, peints, que seul le coffre de la semaine donne (`tresor`, `FONDS_DU_TRESOR`, règle `missions.md`), et douze des savoirs, peints, un par catégorie de questions (`savoir`), les seuls qui s'achètent, tous au même prix (`FONDS_EN_BOUTIQUE`, `PRIX_D_UN_FOND`, `ProfileStore.acheterFond`, `POST /api/joueur/fonds`, `profile_fonds` ; le choix du 15 octobre 2026 : ni le trésor en vente, ni les savoirs au coffre) — : Nuit étoilée, Aurore boréale, Kintsugi, Grand théâtre, Cabinet de curiosités (trois paliers de maître des sentiers, `MAITRES_DU_CABINET`), et deux peints : le Triomphe, au champion du mois, le Cadran solaire, à L'Élite · Argent. Ce qu'on voit derrière sa carte, rien ailleurs ; ceux qu'il a gagnés, tirés ou achetés (`fondsOuverts`, `achetes`), celui qu'il porte relu à chaque affichage (`fondPorte`), comme un titre. Le décor tient au cadre de la carte (`.carte-fond`), son contenu défile par-dessus (`.carte-defile`) ; nocturne sous tous les thèmes de celui qui regarde : la carte reprend les couleurs du Velours (`:root, .carte-fond`), et aucune règle d'un thème n'y peint (`fonds.test.ts`) — le `.card` de Héros la repeignait en blanc
- `shared/gerbes.ts` · `client/src/gerbe.ts` · `components/Gerbe.tsx` — la gerbe : ce qui éclate sur son téléphone à une bonne réponse — en soirée (QCM, « plusieurs » et « ordre » trouvés, et l'estimation pile-poil : pas celle du tiers le plus proche, qui paie pourtant un confetti), au quiz du jour, en série, au défi, aux duels, sur les sentiers et les parcours. Seize gerbes — dont six du trésor, que seul le coffre de la semaine donne (`par: { tresor }`, `GERBES_DU_TRESOR`) —, les confettis pour tout profil, les autres ouvertes par un haut fait ou un palier (`gerbesOuvertes` ; un palier plus haut vaut le sien) ; celle qu'il porte se relit à chaque affichage (`gerbePortee`, la colonne `profiles.gerbe`) — sans choix, ou celle choisie qu'il ne mérite plus, ce sont les confettis (`GERBE_PAR_DEFAUT` : rien n'éclatait tant qu'on n'était pas allé en choisir une, le choix du 10 octobre 2026), et qui n'en veut aucune le range (`AUCUNE_GERBE`) —, se choisit dans la loge, pièce « Gerbe » (`/profil#gerbe`, `MaGerbe` : les siennes, qui éclatent et s'essaient au toucher — celles à gagner éclatent dans la collection) ; chacune a son allure (`allure` : nombre, taille, durée — un ballon flotte, une étincelle file), et ne part qu'à lui (`PublicProfile.gerbe`) : ni la salle ni l'écran commun n'en savent rien, l'anonyme n'en a pas (invariant 8). La page qui lit le profil la retient (`porterGerbe`, comme le thème) ; elle éclate dans un portail sur `body` — une carte à `backdrop-filter` devenait le repère de son `position: fixed` et la rognait —, par `transform` et `opacity`, et se tait si le système demande moins de mouvement ; toutes ses particules à la police de la plus grande (`--taille`), chacune réduite par son `--echelle` à chaque image du mouvement (`GerbeVue`, `gerbes.test.ts` ; le pourquoi, règle `css.md`)
- `server/scripts/apercus-themes.ts` · `client/src/apercus.ts` — les aperçus : l'écran d'une question photographié dans l'application sous chaque thème (client construit d'abord), rogné et réduit en WebP dans `client/src/themes/apercus/`, chargé quand sa case se montre ; `themes.test.ts` refuse un thème sans le sien. `server/scripts/rendu-themes.ts` photographie les thèmes au téléphone — accueil, profil, sa carte (ouverte de sa ligne en tête du profil), question, boutique, jour, campagne (`--ecrans=`) ; `HEURES=` pour ceux qui suivent l'heure, `--fond=`, `--contraste`

## Les pièges

- **Une source ou une dépense de confettis de plus s'ajoute aussi au QG**
  (`/admin#economie`, règle `qg.md`) : la page relit chaque source à ses
  règles, sans rien écrire — `SOURCES_DE_CONFETTIS` et
  `DEPENSES_DE_CONFETTIS` (`shared/qgEconomie.ts`), les mouvements des
  trois magasins (`economieDepuis`) et la part de chaque profil
  (`partsDesSoldes`, `justesDeTous`, `confettisDeTous`). Oubliée, sa
  circulation ne vaudrait plus la somme des soldes, que
  `qg-economie.test.ts` compare au confetti près.
- **Un thème de plus** entre au catalogue dans le bloc de sa rareté — le
  catalogue va du moins cher au plus cher, et `themes.test.ts` comme
  `ma-collection.test.ts` en figent les comptes —, avec sa feuille
  (`client/src/themes/<clé>.css` : ses jetons sous `:root[data-theme='<clé>']`,
  dont le `color-scheme` que dit `clair`, ses `@keyframes` préfixées de sa
  clé, un bloc `prefers-reduced-motion` s'il anime), ses polices dans
  `client/public/fonts/themes` et leur ligne dans `LICENCES.txt` — aucune
  autre adresse : `design.test.ts` n'admet que ses polices et les décors
  sous empreinte —, et son aperçu (`scripts/apercus-themes.ts <clé>`).
  `design.test.ts` mesure ses contrastes aux seuils d'Ivoire. Un thème qui se
  gagne prend `gagne` (`par`, `ou`) et la rareté légendaire ; un thème qui lit
  l'heure rejoint `SUIVENT_L_HEURE`. Velours s'écrit `null`, partout. Son
  décor posé hors de `#root` (`html::before`, `body::before`, `body::after`)
  reste sous le niveau 1 : le bandeau du QG, que le serveur pose avant la
  racine, passe au-dessus le temps du chargement (`maintenance.test.ts`,
  règle `qg.md`).
- **Une règle qui peindrait une carte à fond** ou ce qu'elle montre —
  `.card`, `.label`, `.niveau`, un halo sur `.muted` — s'en écarte par
  `:where(:not(.carte-fond, .carte-fond *))` (sans rien changer à sa
  force) : le décor d'un fond reste nocturne, et `fonds.test.ts` relit
  chaque feuille. Ivoire, lui, vit dans `styles.css` : l'écran commun le
  porte aussi.
- **Un thème peint** cite ses images dans le bloc que `decors.ts --livrer`
  réécrit entre ses deux repères (`--decor-…`), jamais ailleurs. Ses
  surfaces sont presque opaques, et ce qui se pose en or (la réponse
  choisie, le gros bouton, la pastille du niveau) reçoit un fond plein :
  translucides, ils laissaient passer le tableau sous le texte. Sa
  lisibilité se mesure sur ce qui est vraiment peint derrière chaque ligne
  (`scripts/rendu-themes.ts <clé> --contraste`), pas sur ses jetons
  (`--bg`, `--surface`, `--accent`…), les seuls que compare
  `design.test.ts`, jamais au décor peint.
- **Un achat de plus** s'écrit avec son prix, sur une ligne jamais
  modifiée, et touche cinq endroits de `ProfileStore` : sa table, `achatsDe`,
  les dépenses de `boutiqueEtDons`, `unAchatALaFois` et la liste de
  `supprimer` — oubliée, la suppression d'un profil laisserait ses lignes.
  Une source de confettis de plus rejoint les gains de `boutiqueEtDons` :
  rétroactive, elle crédite d'un coup tout ce qui a déjà été joué.
- **Un fond à vendre de plus** prend `savoir` — lui seul ouvre la vente
  (`acheterFond`) et la règle qui le donne (`achete`) —, sa peinture
  (`decors.ts --groupe=savoirs`, skill `peindre`), sa ligne dans le bloc
  des décors, son `background-color` et son voile (`decors-peints.test.ts`) ;
  il n'entre pas au coffre, dont les chances restent au trésor, et
  `ma-collection.test.ts`, `trophees.test.ts`, `boutique.test.ts` en figent
  les comptes. Un fond du trésor ne se vend jamais (le choix du 15 octobre
  2026).
- **`ChoixDuTheme.tsx` n'est pas un thème** : c'est le choix des catégories
  et des sujets de la campagne (règle `campagne.md`).
