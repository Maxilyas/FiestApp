---
paths:
  - "shared/{themes,fonds,gerbes}.ts"
  - "client/src/{themeJoueur,theme,gerbe,apercus}.ts"
  - "client/src/themes/**"
  - "client/src/components/{Boutique,Objets,Comptoir,Gerbe,RayonDesCompagnons,RayonDesFonds,PanneauxDuProfil,LaBoutique,Presentoir,PanierDeLaBoutique}.tsx"
  - "shared/{panier,rayons,envie}.ts"
  - "client/public/fonts/**"
  - "server/scripts/{apercus-themes,rendu-themes,rendu-boutique}.ts"
  - "server/test/{themes,fonds,gerbes,boutique,envie,decors-peints,loge}.test.ts"
---

# Les thèmes, les fonds, les gerbes, la boutique

## Les fichiers

- `shared/themes.ts` · `client/src/themeJoueur.ts` · `client/src/theme.ts` · `client/src/themes/` — trente-cinq thèmes (`THEMES`) : Velours et Ivoire offerts, vingt-huit à vendre du Commun au Légendaire (`PRIX_DES_THEMES` : 150, 250, 400, 650, 1000 — une rareté décrétée avec son prix), dont six de saison, en boutique pendant leur période seulement (`enBoutique` ; le Nouvel An enjambe l'année), et cinq qui ne se vendent pas, ils se gagnent (`gagne`, relus à chaque lecture par `themeGagne`) : Babel aux douze paliers de maître des sentiers, l'Horloge astronomique à cinquante victoires au quiz du jour, le Ciel du jour à L'Infatigable · Argent, les Très Riches Heures aux douze pages du calendrier, le Sommet à L'Alpiniste · Or — ces quatre-là peints. Chacun dit où il se gagne (`gagne.ou`) : la boutique ne les montre pas — rien ne s'y achète (la remarque du 6 octobre 2026) —, « Ma collection » si, sans prix (`etatDuTheme` : `a-gagner`). Le thème suit la personne (le choix du 4 octobre 2026 : les pièces du menu changeaient d'habit d'un toucher à l'autre) : toute page, sur tout appareil où son profil est connecté, sauf l'écran commun et la télé (`HostApp`, en Velours ou en Ivoire : `theme.ts`), les fiches imprimées du bilan, en Ivoire, et le QG (`AdminApp`), une salle de contrôle nocturne sous tous les thèmes — le choix du 4 novembre 2026 : les couleurs de ses graphiques et de ses voyants ne sont vérifiées que sur sa nuit, ses jetons sur `:root:has(.player-shell.qg)` (règle `qg.md`) ; l'anonyme joue en Velours. La page pose le dernier thème porté ici (`poserThemeRetenu`, `quizz.theme-joueur`), puis celui du serveur : lu avec le profil par les pages qui le lisent (`porterTheme`, `LISENT_LE_PROFIL` — `themes.test.ts` la compare aux vues), demandé seul ailleurs (`confirmerTheme`, `GET /api/joueur/theme`, lu en mémoire). L'aperçu de l'écran commun, dans « Mes quiz », passe devant l'essai de la loge, l'essai devant le thème porté (`commeLEcranCommun`, `essayerTheme`, `finirLEssai`), et une feuille arrivée en retard ne remplace pas une demande plus récente. Chaque thème hors Velours et Ivoire (dans `styles.css`) a sa feuille, chargée à la demande (`import.meta.glob`) — ses jetons sous `:root[data-theme='<clé>']`, son décor dans les couches fixes (`body::before`…, `#root::after`), ses animations à son nom, arrêtées si le système demande moins de mouvement —, et ses polices (`client/public/fonts/themes`, licences jointes) ; l'Horloge, le Ciel et les Heures lisent l'heure de Paris, posée sur `<html>` à la minute tant qu'ils sont portés (`SUIVENT_L_HEURE`). Le thème porté se lit dans `PublicProfile.theme`, que chaque enregistrement rend, jamais dans `boutique.porte`, figé à la lecture de la page (`themes.test.ts`)
- Les confettis (`ProfileStore.boutiqueEtDons`) — une bonne réponse, un confetti, relus à chaque lecture, jamais écrits : les soirées qui comptent (`confettisDeSoiree`, sur les relevés : QCM justes et estimations du tiers le plus proche — ni points ni multiplicateur), le quiz du jour (`JourStore.justesDe`), la campagne — tous ses modes, les étoiles des sentiers et les ligues des duels (`CampagneStore.duProfil`, `CONFETTIS_DES_ETOILES`, `confettisDesLigues` ; la même lecture rend ses paliers et sa cote, et la page du profil la partage : `boutiqueDe` la reçoit) —, et les dons de l'administrateur (`profile_dons`, règle `qg.md`), les missions du jour et les coffres de la semaine (`profile_missions`, `profile_coffres`, règle `missions.md`) ; moins les achats, chacun au prix qu'il a payé, écrit avec lui : thèmes (`profile_achats`), vies des sentiers (`profile_vies`), sabliers (`profile_sabliers`), Éclats (`profile_eclats_achetes`), compagnons (`profile_compagnons`), fonds des savoirs (`profile_fonds`). Rétroactifs : une règle changée change d'un coup le solde de tous, une soirée retirée reprend les siens et le solde peut passer sous zéro ; un achat ne se reprend jamais. Ceux de ce soir se disent à la fin de soirée (`FinDeSoiree.profil.confettis`)
- `components/LaBoutique.tsx` · `Presentoir.tsx` · `PanierDeLaBoutique.tsx` · `Boutique.tsx` · `Comptoir.tsx` · `Objets.tsx` · `RayonDesCompagnons.tsx` · `RayonDesFonds.tsx` · `shared/rayons.ts` · `shared/envie.ts` · `shared/panier.ts` — la boutique (`/boutique`), en grilles (la refonte du 10 novembre 2026, la maquette validée par le propriétaire, `retours/2026-11-10/boutique/` : « J'ai l'impression que les utilisateurs ont du mal et ne voient pas grand-chose sur leur téléphone » — celle du 1er novembre, « À la une » en grandes cartes, une étagère par rareté qui glissait de côté, la grande carte des fonds et ses pastilles, montrait un article entier à l'arrivée en 360 × 640 et faisait 3587 px de haut, 6,2 écrans ; celle-ci neuf thèmes, en 3,7 écrans) : rien n'y glisse de côté. De haut en bas (`PanneauBoutique`) : le titre et son solde, un bouton qui ouvre « Tes confettis » (`FeuilleDesConfettis` : d'où ils viennent, et « Jouer le quiz du jour ») ; la rangée des rayons collée en haut, un sélecteur segmenté qui y descend (`.boutique-rayons`, des liens à `aria-current`, l'adresse réécrite sans entrée d'historique ; ses quatre rayons tiennent en 360 de large à côté de la niche repliée, règle `profil.md`) ; son envie ; puis les quatre rayons à la suite (`.rayon-de-la-boutique`, `#rayon-<rayon>`), chacun son nom et, à droite, ce qu'on vient y chercher en une ligne (`ligneDesThemes` : « 22, dont 9 à ta portée », « 22 · le premier à 150 » ; `ligneDesCompagnons`, `LIGNE_DES_FONDS`, `LIGNE_DU_COMPTOIR`) — un paragraphe par rayon prenait la place de deux rangées. **« À la une » n'y est plus** : elle redisait sur l'écran d'arrivée trois articles que les rayons montrent ; elle reste à l'accueil, d'où elle amène ici (règle `missions.md`). Les thèmes (`RayonDesThemes`, `themesEnRayon`) — ce qu'on n'a pas et que la saison permet, une seule grille, trois par rangée sur un téléphone (quatre dès 520 px), du moins cher au plus cher : le haut de son aperçu, son nom entier, la gemme de sa rareté devant son prix (`TuileDeTheme`, `.article-boutique`) ; un prix se lit à l'or quand son solde le paie, en gris sinon (`PrixDeLaTuile`) ; les compagnons (`#compagnons`, règle `profil.md`) — les cinq qui se vendent (`COMPAGNONS_DE_LA_BOUTIQUE` : la luciole comprise depuis le 31 octobre 2026, l'Expédition qui l'amenait effacée) sur une seule rangée, chacun dans son médaillon, son nom en un mot, son prix ou sa coche (1000 confettis, `PRIX_D_UN_COMPAGNON`) ; les fonds (`#fonds`, `RayonDesFonds`, `fondsEnRayon`) — les douze des savoirs moins les siens, quatre par rangée, sa carte en petit sur chaque décor, son avatar dessus (on habille sa carte, on n'achète pas un décor), 250 confettis (`PRIX_D_UN_FOND`) ; le trésor n'y paraît pas, la collection dit d'où il vient ; les objets (`#objets`, `RayonDesObjets`, `useComptoir`, `OBJETS`) — la vie des sentiers (25), le sablier de la série (50, deux au plus) et l'Éclat (3000, un à la fois, `PRIX_D_UN_ECLAT`, `acheterUnEclat`, `POST /api/joueur/eclat` : en réserve dans la loge, rangé sous `#achat:`) —, au comptoir, trois lignes dans une carte : ce qu'il change pour lui (`Objet.accroche`), ce qu'il en a, son prix. **Le présentoir** (`Presentoir`, une `Feuille` à `barre`) : une seule feuille pour tout ce qui se vend — son image à gauche (l'aperçu d'un thème ; un compagnon dans son médaillon, qui bondit au toucher, ses quatre formes dessous, chacune montrée à sa place au toucher, puis, à lui, sa jauge, « L'installer dans ma niche », « Le porter en avatar » — la loge, sa forme à l'essai ; on ne le porte pas d'ici —, `FicheDuCompagnon` ; sa carte posée sur le fond, son prénom dessus, `SaCarte` ; le dessin d'un objet, l'Éclat sur son avatar, avant et après — `avatarDeLApercu` ; sur un compagnon, sa métamorphose : `formesDeLEclat`), ce qu'il est et son prix à droite (« Il t'en restera… », « Encore… à gagner »), ses gestes au pied. Sa barre feuillette le rayon sans la refermer (‹ ›, « 3 sur 22 », `voisinDansLeRayon`) et porte l'étoile de son envie. **L'achat en deux touchers, au même endroit** (`gestesDuPresentoir`, pure, `shared/rayons.ts`) : « L'acheter », qui ne dépense rien, puis « Confirmer » — les deux gestes gardent leurs parts d'une étape à l'autre (`.presentoir-gestes`, deux pour trois), et le focus suit le geste attendu — ; seul « Confirmer » appelle le serveur, sans porter (`porter: false` ; sans le drapeau, une page d'avant porte) ; puis « Le porter » ou « Plus tard » — un compagnon s'installe (« L'installer ») quand un autre vit dans sa niche ; vide, elle l'accueille d'office (le 19 octobre 2026 : la niche est sa maison, l'avatar une autre affaire, règle `profil.md`) ; un fond se pose ; un objet n'a rien à choisir, et dit l'écran où il sert. Un dialogue posé sur la feuille — « Acheter et porter », « L'acheter seulement », « Plus tard » — se lisait avant d'avoir rien acheté (le choix du 10 octobre 2026, tenu autrement). Trop cher, « J'en ai envie » prend la place de l'achat : un bouton éteint, « Encore 580 confettis », n'offrait rien à faire de sa visite. Hors de sa saison, un thème qui se gagne, un sablier de trop : sa fiche dit pourquoi rien ne s'y achète. Les adresses passent par une règle (`ceQueLAdresseOuvre`) : `#theme-<clé>`, `#compagnon-<clé>`, `#fond-<clé>`, `#objet-<objet>` ouvrent leur présentoir (`adresseDeLObjet` ; `#vies`, l'adresse d'avant, celui de la vie). **Son envie** (`shared/envie.ts`, pure : `refusDeLEnvie`, `envieTenue`, `ouEnEstLEnvie`) : l'article pour lequel il économise, un à la fois, de toute sorte — la plupart des visites se font sans de quoi acheter. Posée par l'étoile du présentoir ou « J'en ai envie » (`PUT /api/joueur/envie`, `ProfileStore.poserEnvie`, la colonne `profiles.envie`, « theme:aurore »), elle ne donne ni ne réserve rien, et se relit à chaque lecture de sa boutique (`BoutiqueDuProfil.envie`, absente dès qu'elle ne tient plus : achetée, sortie de sa saison — rien ne s'efface, et une envie de saison jamais achetée se remontre à la saison suivante) ; un objet se rachète : acheté, c'est la page qui la retire. En tête de la boutique, sa carte (`CarteDeLEnvie`) : sa jauge, « encore 🎊 170 » ou « À ta portée » ; sa tuile la marque. **L'essai** : un thème habille toute la page (`essayerTheme`, `finirLEssai`, comme dans la loge), un compagnon sa niche, à sa première forme (`essayerNiche`, règle `profil.md`) — un de chaque sorte, rien n'est écrit, quitter la page rend tout ; un fond ne s'essaie plus à part, son présentoir le montre sur sa carte. Ce qu'on essaie et qui s'achète encore (`lignesDuPanier`) attend dans une barre juste au-dessus du menu (`BarreDuPanier`, `body.avec-panier`) : sa vignette, son prix et son nom, la croix qui le retire, « Garder », qui ouvre son présentoir sur « Confirmer » ; à plusieurs, « Voir », et la feuille de ce qu'on essaie (`FeuilleDuPanier`) : chaque ligne et sa croix, le total, ce qui manque (`ceQuiManque`), « Tout retirer », « Tout garder » — qui achète ligne après ligne par les routes de toujours, porte ce qu'il garde, et s'arrête au premier refus, dit dans la feuille ; un thème gardé devient le sien sans repasser par l'ancien (`finirLEssai(true)`). Le serveur compte chaque achat et le refuse en clair — pas assez, hors saison, déjà à toi, ne se vend pas —, un à la fois par profil (`unAchatALaFois` : deux onglets dépensaient deux fois le même solde) ; la page montre le solde qu'il rend. Ce qui tient à l'écran se mesure (`server/scripts/rendu-boutique.ts`, le piège « La boutique tient en grilles », plus bas) ; `boutique.test.ts` garde sa structure, ses gestes et son envie, `envie.test.ts` les règles de l'envie et sa route. Ce qu'on a se porte dans la loge, pièce « Thème » (`/profil#theme`, `MesThemes` ; règle `profil.md`) : toucher un thème l'**essaie** sur toute la page, rien n'est enregistré, « Porter », dans la barre de la loge, le garde (`loge.test.ts`) — il s'enregistrait d'un toucher : on ne voyait un thème qu'en le portant pour de bon
- `shared/fonds.ts` — vingt-cinq fonds de carte — dont six du trésor, peints, que seul le coffre de la semaine donne (`tresor`, `FONDS_DU_TRESOR`, règle `missions.md`), et douze des savoirs, peints, un par catégorie de questions (`savoir`), les seuls qui s'achètent, tous au même prix (`FONDS_EN_BOUTIQUE`, `PRIX_D_UN_FOND`, `ProfileStore.acheterFond`, `POST /api/joueur/fonds`, `profile_fonds` ; le choix du 15 octobre 2026 : ni le trésor en vente, ni les savoirs au coffre) — : Nuit étoilée, Aurore boréale, Kintsugi, Grand théâtre, Cabinet de curiosités (trois paliers de maître des sentiers, `MAITRES_DU_CABINET`), et deux peints : le Triomphe, au champion du mois, le Cadran solaire, à L'Élite · Argent. Ce qu'on voit derrière sa carte, rien ailleurs ; ceux qu'il a gagnés, tirés ou achetés (`fondsOuverts`, `achetes`), celui qu'il porte relu à chaque affichage (`fondPorte`), comme un titre. Sur la carte d'un joueur, le décor tapisse ses deux faces, dans leur cadre de métal (`.carte-dedans.carte-fond` — la carte à collectionner, règle `profil.md`, ne le posait d'abord que dans son illustration : « et le fond ne peut pas couvrir recto et verso ? », le propriétaire, le 20 octobre 2026) : ce qui défile passe par-dessus, sans sol à soi, l'illustration le laisse voir — son cadre n'est qu'un anneau de métal —, et le lambrequin du théâtre pend derrière ce qu'elle raconte ; la carte de la loge et les vignettes, il les tapisse de même (`.carte-fond`) ; nocturne sous tous les thèmes de celui qui regarde : la carte reprend les couleurs du Velours (`:root, .carte-fond`), et aucune règle d'un thème n'y peint (`fonds.test.ts`) — le `.card` de Héros la repeignait en blanc
- `shared/gerbes.ts` · `client/src/gerbe.ts` · `components/Gerbe.tsx` — la gerbe : ce qui éclate sur son téléphone à une bonne réponse — en soirée (QCM, « plusieurs » et « ordre » trouvés, et l'estimation pile-poil : pas celle du tiers le plus proche, qui paie pourtant un confetti), au quiz du jour, en série, au défi, aux duels, sur les sentiers et les parcours. Vingt-cinq gerbes — dont six du trésor, que seul le coffre de la semaine donne (`par: { tresor }`, `GERBES_DU_TRESOR`), une des défis du Cabinet, ses cartes, à cinq défis tenus à l'Argent (`par: { defis }`, `ARGENTS_POUR_LA_GERBE` : ni piste ni étape non plus), et huit des fêtes, une chacune, qui s'ouvrent avec sa saison (`par: { fete }`, depuis le 1er novembre 2026 : ni piste ni étape, `shared/pistes.ts` les écarte ; la fin qui ouvre le légendaire de la fête la propose à essayer, `aPorterDesFetes`) —, les confettis pour tout profil, les autres ouvertes par un haut fait ou un palier (`gerbesOuvertes` ; un palier plus haut vaut le sien) ; celle qu'il porte se relit à chaque affichage (`gerbePortee`, la colonne `profiles.gerbe`) — sans choix, ou celle choisie qu'il ne mérite plus, ce sont les confettis (`GERBE_PAR_DEFAUT` : rien n'éclatait tant qu'on n'était pas allé en choisir une, le choix du 10 octobre 2026), et qui n'en veut aucune le range (`AUCUNE_GERBE`) —, se choisit dans la loge, pièce « Gerbe » (`/profil#gerbe`, `MaGerbe` : les siennes, qui éclatent et s'essaient au toucher — celles à gagner éclatent dans la collection) ; chacune a son allure (`allure` : nombre, taille, durée — un ballon flotte, une étincelle file), et ne part qu'à lui (`PublicProfile.gerbe`) : ni la salle ni l'écran commun n'en savent rien, l'anonyme n'en a pas (invariant 8). La page qui lit le profil la retient (`porterGerbe`, comme le thème) ; elle éclate dans un portail sur `body` — une carte à `backdrop-filter` devenait le repère de son `position: fixed` et la rognait —, par `transform` et `opacity`, et se tait si le système demande moins de mouvement ; toutes ses particules à la police de la plus grande (`--taille`), chacune réduite par son `--echelle` à chaque image du mouvement (`GerbeVue`, `gerbes.test.ts` ; le pourquoi, règle `css.md`)
- `server/scripts/apercus-themes.ts` · `client/src/apercus.ts` — les aperçus : l'écran d'une question photographié dans l'application sous chaque thème (client construit d'abord), rogné et réduit en WebP dans `client/src/themes/apercus/`, chargé quand sa case se montre ; `themes.test.ts` refuse un thème sans le sien. `server/scripts/rendu-themes.ts` photographie les thèmes au téléphone — accueil, profil, sa carte (ouverte de sa ligne en tête du profil), question, boutique, jour, campagne (`--ecrans=`) ; `HEURES=` pour ceux qui suivent l'heure, `--fond=`, `--contraste`

## Les pièges

- **La boutique tient en grilles — et sa troisième rangée de thèmes, à
  quelques pixels** (le 10 novembre 2026, la maquette validée :
  `retours/2026-11-10/boutique/`). Mesuré ce jour-là
  (`server/scripts/rendu-boutique.ts`, le client construit d'abord, depuis
  `server/` : `npx tsx scripts/rendu-boutique.ts ../export/boutique` ;
  `SEULEMENT=arrivee,presentoirs` pour quelques passes) : une habituée, sa
  niche au coin, voit neuf thèmes entiers à l'arrivée en 360 × 640 — la
  dernière rangée finit 8 px au-dessus du menu —, neuf en 390 × 664 et en
  360 × 740, douze en 412 × 800 et en 390 × 844, quinze en 412 × 915 ; un
  seul article entier avant, à toutes les tailles. Sa page fait 2102 px,
  3,7 écrans (3587 px et 6,2 avant) ; avec son envie en tête (62 px), une
  rangée de moins aux tailles où la dernière tenait de peu : six en
  360 × 640. Ce qui la ferait repasser sous le menu : une ligne de plus
  au-dessus de la grille, une tuile plus haute (son image fait 64 px, son
  nom deux lignes au plus sous le Velours), un haut de page moins serré —
  la page remonte de 12 px sous sa tête (`.la-boutique`, `margin-top`), et
  la rangée des rayons s'arrête 4 px sous la niche. Le script sort en
  erreur pour un compte de thèmes sous `THEMES_ENTIERS`, une page de plus
  de 4,2 écrans, des compagnons sur deux rangées, un nom coupé, la rangée
  des rayons sous la niche une fois la page défilée, « Confirmer » ailleurs
  que sous « L'acheter », un présentoir qui défile ou dont un geste sort
  de l'écran, la barre de l'essai sur le menu, une cible de doigt sous
  44 px (« Fermer », en tête de toute feuille, en fait 40 : d'avant), un
  texte sous 11. **Ses classes s'appellent `article-…`, jamais `tuile-…`** :
  `profil-atlas.test.ts` tient pour parties les tuiles du profil d'avant, et
  refuse toute règle `.tuile-`. **Un nom ne se coupe pas sur une tuile** : il
  passe à la ligne (`overflow-wrap: anywhere`), et sous une police large — le
  Carnet, la Game Boy — un mot de plus de dix lettres s'y coupe en deux ; au
  texte agrandi à 130 %, « Guinguette » aussi : c'est voulu, le nom reste
  entier. **Le présentoir d'un compagnon est le plus haut** (530 px en
  360 × 640, ses quatre formes et sa phrase) : une ligne de plus le ferait
  défiler sur le petit téléphone. Ce qui reste : la bulle « Touche-moi ! »
  de la niche couvre son solde les trois premières fois (d'avant) ; sous
  l'encoche d'un iPhone, rien n'est mesuré.
- **Un article de plus se range dans son rayon, pas à côté.** Une sorte de
  plus — un cinquième rayon — entre dans `RAYONS` et `RAYON_DE`
  (`shared/rayons.ts`), dans `SorteDEnvie` et `prixDeLEnvie`
  (`shared/envie.ts` : sans prix, son envie se refuse), dans
  `ceQueLAdresseOuvre`, dans les corps du présentoir et dans
  `VignetteDeLArticle` ; ses gestes viennent de `gestesDuPresentoir`, jamais
  d'un bouton posé dans sa fiche — un achat qui ne passerait pas par
  « Confirmer » se ferait d'un toucher.
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
  règle `qg.md`). Ses couches fixes — celles-là, et `#root::before`,
  `#root::after` — se retirent sous une feuille, une carte ou un dialogue
  ouverts : au téléphone, elles prenaient la mémoire que la feuille des amis
  attendait pour se dessiner (règle `css.md`). Une couche fixe ailleurs
  rejoint la règle qui les retire, ou `feuilles.test.ts` la refuse. Une barre
  du chrono qu'il borde (`.timer-track` à `border`) se garde telle quelle
  quand le temps presse (`.timer .timer-track.urgent { transform: none; }`) :
  le `scaleY` de l'urgence en épaississait le haut et le bas, pas les côtés ;
  le trait de ses secondes, s'il en pose un, reste le sien — celui de
  l'urgence est plus faible (`cabinet-ecran.test.ts` relit chaque feuille).
- **Une règle qui peindrait une carte à fond** ou ce qu'elle montre —
  `.card`, `.label`, `.niveau`, un halo sur `.muted` — s'en écarte par
  `:where(:not(.carte-fond, .carte-fond *))` (sans rien changer à sa
  force) : le décor d'un fond reste nocturne, et `fonds.test.ts` relit
  chaque feuille. Ivoire, lui, vit dans `styles.css` : l'écran commun le
  porte aussi. Le `.card` d'un thème habille aussi un dialogue — bordure, ombre,
  dégradé —, jamais son sol : posé sur la page, il le reprend plein, plus
  fort que lui (`--bg-raised`, règle `css.md`, `feuilles.test.ts`) —
  translucide, la carte d'un ami laissait lire la liste des amis au travers
  d'elle. La carte d'un joueur n'est plus un `.card` depuis qu'elle est une
  carte à collectionner : son cadre est celui de sa ligue, ses faces ont leur
  sol, et aucun thème n'y touche.
- **Un thème peint** cite ses images dans le bloc que `decors.ts --livrer`
  réécrit entre ses deux repères (`--decor-…`), jamais ailleurs. Ses
  surfaces sont presque opaques, et ce qui se pose en or (la réponse
  choisie, le gros bouton, la pastille du niveau) reçoit un fond plein :
  translucides, ils laissaient passer le tableau sous le texte. Sa
  lisibilité se mesure sur ce qui est vraiment peint derrière chaque ligne
  (`scripts/rendu-themes.ts <clé> --contraste`), pas sur ses jetons
  (`--bg`, `--surface`, `--accent`…), les seuls que compare
  `design.test.ts`, jamais au décor peint. La mesure vit dans
  `server/scripts/a-l-ecran.ts` (`contrasteDeLaPage`, que
  `rendu-niche.ts` partage) et, depuis le 25 octobre 2026, ne lit plus
  que ce que l'œil lit : la photo à la densité de l'écran (écrite à 2, elle
  mesurait un autre coin que la ligne en 1366 × 768), une ligne entière à
  l'écran et visible en entier — ni coupée par le bord (lue sur du vide,
  elle se disait illisible à 1,3:1), ni couverte même en partie, ni défilée
  hors de son cadre —, le fond derrière les lettres, pas dans tout
  l'interligne (le bas d'une ombre portée), et jamais un geste éteint
  (`aria-disabled`, `:disabled`), dont WCAG ne demande rien. Le Cabinet de
  curiosités pose ses lignes à même la page, hors des cartes — le compte des
  chasses, le nom d'une œuvre sous son cadre, la question d'une manche — :
  chaque thème peint pose son sol plein sous la colonne
  (`:root[data-theme='<clé>'] .cab-page { background: var(--bg) }`, les
  seules règles d'un thème qui nomment une classe de page), sans quoi son
  tableau passait sous elles — au Sommet, « 2 chasses aujourd'hui » à
  1,36:1 sur la neige ; aux Heures, la question d'un Pari à 1,58:1 sur la
  page du mois (les rendus des 25 et 26 octobre 2026). Le Film noir aussi,
  sans être peint : sa lampe et ses stores éclairent le haut de la page, où
  chaque écran du Cabinet pose son étiquette rouge (3,43:1) et son lien de
  retour (4,19:1). Le décor reste de chaque côté de la colonne.
  `cabinet-ecran.test.ts` le relit dans chaque feuille qui cite ses décors
  (`--decor-…`) et dans celle du Film noir — un décor de plus qui passe
  sous les lignes du Cabinet y prend son sol. La traversée, elle, ne prend
  aucun thème : sa nuit et son or s'écrivent en dur (règle `cabinet.md`),
  et l'épreuve, sur l'écran de partie, garde ce sol.
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
