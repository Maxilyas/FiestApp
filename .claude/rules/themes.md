---
paths:
  - "shared/{themes,fonds,gerbes,plaques}.ts"
  - "client/src/{themeJoueur,theme,gerbe,apercus}.ts"
  - "client/src/themes/**"
  - "client/src/components/{Boutique,Objets,Comptoir,Gerbe,RayonDesCompagnons,RayonDesFonds,PanneauxDuProfil,LaBoutique,Presentoir,PanierDeLaBoutique,Plaque,MaPlaque,PodiumDuClassement}.tsx"
  - "shared/{panier,rayons,envie}.ts"
  - "client/public/fonts/**"
  - "server/scripts/{apercus-themes,rendu-themes,rendu-boutique,emblemes-des-plaques}.ts"
  - "server/test/{themes,fonds,gerbes,boutique,envie,decors-peints,loge,plaques}.test.ts"
---

# Les thèmes, les fonds, les gerbes, la boutique

## Les fichiers

- `shared/themes.ts` · `client/src/themeJoueur.ts` · `client/src/theme.ts` · `client/src/themes/` — trente-cinq thèmes (`THEMES`) : Velours et Ivoire offerts, vingt-huit à vendre du Commun au Légendaire (`PRIX_DES_THEMES` : 150, 250, 400, 650, 1000 — une rareté décrétée avec son prix), dont six de saison, en boutique pendant leur période seulement (`enBoutique` ; le Nouvel An enjambe l'année), et cinq qui ne se vendent pas, ils se gagnent (`gagne`, relus à chaque lecture par `themeGagne`) : Babel aux douze paliers de maître des sentiers, l'Horloge astronomique à cinquante victoires au quiz du jour, le Ciel du jour à L'Infatigable · Argent, les Très Riches Heures aux douze pages du calendrier, le Sommet à L'Alpiniste · Or — ces quatre-là peints. Chacun dit où il se gagne (`gagne.ou`) : la boutique ne les montre pas — rien ne s'y achète (la remarque du 6 octobre 2026) —, « Ma collection » si, sans prix (`etatDuTheme` : `a-gagner`). Le thème suit la personne (le choix du 4 octobre 2026 : les pièces du menu changeaient d'habit d'un toucher à l'autre) : toute page, sur tout appareil où son profil est connecté, sauf l'écran commun et la télé (`HostApp`, en Velours ou en Ivoire : `theme.ts`), les fiches imprimées du bilan, en Ivoire, et le QG (`AdminApp`), une salle de contrôle nocturne sous tous les thèmes — le choix du 4 novembre 2026 : les couleurs de ses graphiques et de ses voyants ne sont vérifiées que sur sa nuit, ses jetons sur `:root:has(.player-shell.qg)` (règle `qg.md`) ; l'anonyme joue en Velours. La page pose le dernier thème porté ici (`poserThemeRetenu`, `quizz.theme-joueur`), puis celui du serveur : lu avec le profil par les pages qui le lisent (`porterTheme`, `LISENT_LE_PROFIL` — `themes.test.ts` la compare aux vues), demandé seul ailleurs (`confirmerTheme`, `GET /api/joueur/theme`, lu en mémoire). L'aperçu de l'écran commun, dans « Mes quiz », passe devant l'essai de la loge, l'essai devant le thème porté (`commeLEcranCommun`, `essayerTheme`, `finirLEssai`), et une feuille arrivée en retard ne remplace pas une demande plus récente. Chaque thème hors Velours et Ivoire (dans `styles.css`) a sa feuille, chargée à la demande (`import.meta.glob`) — ses jetons sous `:root[data-theme='<clé>']`, son décor dans les couches fixes (`body::before`…, `#root::after`), ses animations à son nom, arrêtées si le système demande moins de mouvement —, et ses polices (`client/public/fonts/themes`, licences jointes) ; l'Horloge, le Ciel et les Heures lisent l'heure de Paris, posée sur `<html>` à la minute tant qu'ils sont portés (`SUIVENT_L_HEURE`). Le thème porté se lit dans `PublicProfile.theme`, que chaque enregistrement rend, jamais dans `boutique.porte`, figé à la lecture de la page (`themes.test.ts`)
- `shared/plaques.ts` · `components/Plaque.tsx` · `MaPlaque.tsx` — les plaques de nom (le choix du propriétaire du 10 novembre 2026, la maquette validée, `retours/2026-11-10/plaques/` : il s'était vendu six thèmes pour seize compagnons, et trente-deux profils sur quarante et un jouaient en Velours — un thème ne se voyait que chez soi, et l'on achète ce que les autres voient) : la part d'un thème que les autres voient, aux couleurs d'un thème qu'il possède. **Une par thème, sauf Velours, et rien à part** : ni article de la boutique, ni pièce de la collection, ni prix — la plaque vient avec son thème, l'Ivoire offert donne la sienne à tous, et qui avait un thème a eu sa plaque sans rien faire. La colonne `profiles.plaque` : NULL, celle du thème qu'il porte, d'office (`plaquePortee` — comme la gerbe de tous : une pièce qui ne se montre qu'une fois choisie ne se montrait chez personne) ; `aucune` ; ou la clé d'un thème à lui, vérifiée à l'écriture par la porte du thème (`verifierQuIlALeTheme`, `PUT /api/joueur/moi` `plaque`), puis crue. Le serveur la dit de mémoire (`ProfileStore.plaqueDe`, comme `bordureDe`) sur chaque ligne de classement (`LigneDuJour`, `LigneDuDefi`, `LigneDesDuels` : `plaque`, absente sans plaque), avec ce qu'un joueur porte partout ailleurs hors d'une soirée (`SonApparence.plaque`, `sonApparence` dans `core/campagne.ts` : les amis, la recherche, les joueurs croisés, ses duels en cours et joués, les deux joueurs d'un duel classé, celui d'en face à la fin — jamais d'un masqué ni d'Automate), aux collections, posée à la lecture (`FicheDeCollectionneur.plaque`, `avecSaPlaque` : le relevé gardé ne la porte pas), et sur le profil (`PublicProfile.plaque`, `plaqueChoisie`). **L'écrin et le podium depuis le soir du 18 novembre 2026** (trois propositions reparties de zéro, `retours/2026-11-18/plaques/trois-propositions/` — « L'écrin combiné au podium est une bonne idée », le propriétaire ; avant elles, le même jour, la ligne entière au podium — la « vitrine » — et un trait sous le prénom plus bas — le « paraphe » —, et depuis le 10 novembre toute ligne à ses couleurs : une mosaïque) : **l'écrin** — l'avatar posé sur une tuile à ses couleurs, son double filet, son emblème en filigrane (`Ecrin`, `Plaque.tsx`, `.ecrin.plaque`) —, partout où un joueur se montre hors d'une soirée : les classements du jour, du mois, du défi, des duels et des collections, « à ta portée », le Top 3, « Entre amis », « En cours », l'historique, les face-à-face, les amis, la recherche, les joueurs croisés ; sans plaque, la même place, vide (les avatars restent alignés). **Le podium** — les trois premiers d'un classement sortent de la liste et montent sur leur marche, à leurs couleurs ou à leur métal, leur rang au fronton (`PodiumDuClassement`, `surLePodium`, `PLACES_DU_PODIUM`) — : le jour et le mois, le défi de la semaine et entre amis (`ClassementDuDefi`), le classement entier des duels, ses ligues dessous ; pas de scène sous trois joueurs ni quand plus de trois se partagent les trois premières places — la liste les garde tous. Les collections gardent leur podium en cartes : l'illustration de la carte est l'écrin (`.cl-carte-illu.plaque`). Le prénom, le niveau et le score restent ceux de tous. `Plaque.tsx` n'importe aucun catalogue : la clé seule choisit la règle de la feuille (`classeDeLaPlaque`, la clé filtrée). Les emblèmes, un dessin par thème, s'écrivent par leur script (`server/scripts/emblemes-des-plaques.ts --ecrire`, entre deux repères de `styles.css`, jamais à la main). Elle se choisit dans la loge, pièce « Thème », dans son onglet « Ma plaque » (`OngletsDuTheme`, `Boutique.tsx` : « Mes thèmes » d'office, « Ma plaque » à côté, son échantillon sur l'onglet ; un œil sur l'onglet « Ma plaque » — les autres la voient, quand la pièce est rangée sous « Toi seul » —, dit à l'oreille, « les autres la voient » ; sans phrase : le propriétaire ne veut plus de texte qui explique, le 17 novembre 2026) : sa ligne de classement une seule fois, son avatar dans l'écrin de la plaque montrée (`LigneDePlaque`), puis chaque choix en petite plaque (`MaPlaque`, `plaquesDeLaLoge`, `EchantillonDePlaque`) — « Comme mon thème », « Aucune », puis une par thème à lui ; un toucher essaie, `essai.plaque`, `shared/loge.ts`, sa ligne dans la barre sous la pièce « Thème » ; pas de septième pièce : la rangée de la loge tient à quelques pixels, règle `profil.md`. Jusqu'au 17 novembre 2026, elle vivait sous la liste des thèmes, une ligne de classement entière par choix : la plaque d'une habituée commençait à 1180 px en 360 × 640, et personne ne savait qu'elle existait (« la plaque des thèmes qui est caché tout en bas et donc impossible pour des utilisateurs de savoir que ça existe », le propriétaire). La fiche d'un thème la montre à la boutique (`LigneDePlaque`, « Sa plaque · les autres te verront ainsi »). **Et la grande plaque des duels** (le même 18 novembre 2026, la maquette sur les vrais écrans, `retours/2026-11-18/plaques/duels/`) : à un contre un, au duel classé, le duel à relever habille chaque carte de la plaque de son joueur (`DuelFaceCachee` : `.duels-carte.plaque`, son fond, un double filet, son emblème en semis, le nom d'en face sur sa plaque, `.duels-carte-son-nom`), et le verdict pose chacun sur son socle (`VerdictDuDuel` : `.duels-face-joueur.plaque`, son nom sur sa plaque, son emblème au bout). Ni en soirée, ni sur l'écran commun, ni chez l'anonyme (invariant 8). `plaques.test.ts`
- Les confettis (`ProfileStore.boutiqueEtDons`) — une bonne réponse, un confetti, relus à chaque lecture, jamais écrits : les soirées qui comptent (`confettisDeSoiree`, sur les relevés : QCM justes et estimations du tiers le plus proche — ni points ni multiplicateur), le quiz du jour (`JourStore.justesDe`), la campagne — tous ses modes, les étoiles des sentiers et les ligues des duels (`CampagneStore.duProfil`, `CONFETTIS_DES_ETOILES`, `confettisDesLigues` ; la même lecture rend ses paliers et sa cote, et la page du profil la partage : `boutiqueDe` la reçoit) —, et les dons de l'administrateur (`profile_dons`, règle `qg.md`), les missions du jour et les coffres de la semaine (`profile_missions`, `profile_coffres`, règle `missions.md`) ; moins les achats, chacun au prix qu'il a payé, écrit avec lui : thèmes (`profile_achats`), vies des sentiers (`profile_vies`), sabliers (`profile_sabliers`), Éclats (`profile_eclats_achetes`), compagnons (`profile_compagnons`), fonds des savoirs (`profile_fonds`). Rétroactifs : une règle changée change d'un coup le solde de tous, une soirée retirée reprend les siens et le solde peut passer sous zéro ; un achat ne se reprend jamais. Ceux de ce soir se disent à la fin de soirée (`FinDeSoiree.profil.confettis`)
- `components/LaBoutique.tsx` · `Presentoir.tsx` · `PanierDeLaBoutique.tsx` · `Boutique.tsx` · `Comptoir.tsx` · `Objets.tsx` · `RayonDesCompagnons.tsx` · `RayonDesFonds.tsx` · `shared/rayons.ts` · `shared/envie.ts` · `shared/panier.ts` — la boutique (`/boutique`), en grilles (la refonte du 10 novembre 2026, la maquette validée par le propriétaire, `retours/2026-11-10/boutique/` : « J'ai l'impression que les utilisateurs ont du mal et ne voient pas grand-chose sur leur téléphone » — celle du 1er novembre, « À la une » en grandes cartes, une étagère par rareté qui glissait de côté, la grande carte des fonds et ses pastilles, montrait un article entier à l'arrivée en 360 × 640 et faisait 3587 px de haut, 6,2 écrans ; celle-ci neuf thèmes, en 3,7 écrans) : rien n'y glisse de côté. De haut en bas (`PanneauBoutique`) : le titre et son solde, un bouton qui ouvre « Tes confettis » (`FeuilleDesConfettis` : d'où ils viennent, et « Jouer le quiz du jour ») ; la rangée des rayons collée en haut, un sélecteur segmenté qui y descend (`.boutique-rayons`, des liens à `aria-current`, l'adresse réécrite sans entrée d'historique ; ses quatre rayons tiennent en 360 de large à côté de la niche repliée, règle `profil.md`) ; son envie ; puis les quatre rayons à la suite (`.rayon-de-la-boutique`, `#rayon-<rayon>`), chacun son nom et, à droite, ce qu'on vient y chercher en une ligne (`ligneDesThemes` : « 22, dont 9 à ta portée », « 22 · le premier à 150 » ; `ligneDesCompagnons`, `LIGNE_DES_FONDS`, `LIGNE_DU_COMPTOIR`) — un paragraphe par rayon prenait la place de deux rangées. **« À la une » n'y est plus** : elle redisait sur l'écran d'arrivée trois articles que les rayons montrent ; elle reste à l'accueil, d'où elle amène ici (règle `missions.md`). Les thèmes (`RayonDesThemes`, `themesEnRayon`) — ce qu'on n'a pas et que la saison permet, une seule grille, trois par rangée sur un téléphone (quatre dès 520 px), du moins cher au plus cher : le haut de son aperçu, son nom entier, la gemme de sa rareté devant son prix (`TuileDeTheme`, `.article-boutique`) ; un prix se lit à l'or quand son solde le paie, en gris sinon (`PrixDeLaTuile`) ; les compagnons (`#compagnons`, règle `profil.md`) — les cinq qui se vendent (`COMPAGNONS_DE_LA_BOUTIQUE` : la luciole comprise depuis le 31 octobre 2026, l'Expédition qui l'amenait effacée) sur une seule rangée, chacun dans son médaillon, son nom en un mot, son prix ou sa coche (1000 confettis, `PRIX_D_UN_COMPAGNON`) ; les fonds (`#fonds`, `RayonDesFonds`, `fondsEnRayon`) — les douze des savoirs moins les siens, quatre par rangée, sa carte en petit sur chaque décor, son avatar dessus (on habille sa carte, on n'achète pas un décor), 250 confettis (`PRIX_D_UN_FOND`) ; le trésor n'y paraît pas, la collection dit d'où il vient ; les objets (`#objets`, `RayonDesObjets`, `useComptoir`, `OBJETS`) — la vie des sentiers (25), le sablier de la série (50, deux au plus) et l'Éclat (3000, un à la fois, `PRIX_D_UN_ECLAT`, `acheterUnEclat`, `POST /api/joueur/eclat` : en réserve dans la loge, rangé sous `#achat:`) —, au comptoir, trois lignes dans une carte : ce qu'il change pour lui (`Objet.accroche`), ce qu'il en a, son prix. **Le présentoir** (`Presentoir`, une `Feuille` à `barre`) : une seule feuille pour tout ce qui se vend — son image à gauche (l'aperçu d'un thème ; un compagnon dans son médaillon, qui bondit au toucher, ses quatre formes dessous, chacune montrée à sa place au toucher, puis, à lui, sa jauge, « L'installer dans ma niche », « Le porter en avatar » — la loge, sa forme à l'essai ; on ne le porte pas d'ici —, `FicheDuCompagnon` ; sa carte posée sur le fond, son prénom dessus, `SaCarte` ; le dessin d'un objet, l'Éclat sur son avatar, avant et après — `avatarDeLApercu` ; sur un compagnon, sa métamorphose : `formesDeLEclat`), ce qu'il est et son prix à droite (« Il t'en restera… », « Encore… à gagner »), ses gestes au pied. Sa barre feuillette le rayon sans la refermer (‹ ›, « 3 sur 22 », `voisinDansLeRayon`) et porte l'étoile de son envie. **L'achat en deux touchers, au même endroit** (`gestesDuPresentoir`, pure, `shared/rayons.ts`) : « L'acheter », qui ne dépense rien, puis « Confirmer » — les deux gestes gardent leurs parts d'une étape à l'autre (`.presentoir-gestes`, deux pour trois), et le focus suit le geste attendu — ; seul « Confirmer » appelle le serveur, sans porter (`porter: false` ; sans le drapeau, une page d'avant porte) ; puis « Le porter » ou « Plus tard » — un compagnon s'installe (« L'installer ») quand un autre vit dans sa niche ; vide, elle l'accueille d'office (le 19 octobre 2026 : la niche est sa maison, l'avatar une autre affaire, règle `profil.md`) ; un fond se pose ; un objet n'a rien à choisir, et dit l'écran où il sert. Un dialogue posé sur la feuille — « Acheter et porter », « L'acheter seulement », « Plus tard » — se lisait avant d'avoir rien acheté (le choix du 10 octobre 2026, tenu autrement). Trop cher, « J'en ai envie » prend la place de l'achat : un bouton éteint, « Encore 580 confettis », n'offrait rien à faire de sa visite. Hors de sa saison, un thème qui se gagne, un sablier de trop : sa fiche dit pourquoi rien ne s'y achète. Les adresses passent par une règle (`ceQueLAdresseOuvre`) : `#theme-<clé>`, `#compagnon-<clé>`, `#fond-<clé>`, `#objet-<objet>` ouvrent leur présentoir (`adresseDeLObjet` ; `#vies`, l'adresse d'avant, celui de la vie). **Son envie** (`shared/envie.ts`, pure : `refusDeLEnvie`, `envieTenue`, `ouEnEstLEnvie`) : l'article pour lequel il économise, un à la fois, de toute sorte — la plupart des visites se font sans de quoi acheter. Posée par l'étoile du présentoir ou « J'en ai envie » (`PUT /api/joueur/envie`, `ProfileStore.poserEnvie`, la colonne `profiles.envie`, « theme:aurore »), elle ne donne ni ne réserve rien, et se relit à chaque lecture de sa boutique (`BoutiqueDuProfil.envie`, absente dès qu'elle ne tient plus : achetée, sortie de sa saison — rien ne s'efface, et une envie de saison jamais achetée se remontre à la saison suivante) ; un objet se rachète : acheté, c'est la page qui la retire. En tête de la boutique, sa carte (`CarteDeLEnvie`) : sa jauge, « encore 🎊 170 » ou « À ta portée » ; sa tuile la marque. **L'essai** : un thème habille toute la page (`essayerTheme`, `finirLEssai`, comme dans la loge), un compagnon sa niche, à sa première forme (`essayerNiche`, règle `profil.md`) — un de chaque sorte, rien n'est écrit, quitter la page rend tout ; un fond ne s'essaie plus à part, son présentoir le montre sur sa carte. Ce qu'on essaie et qui s'achète encore (`lignesDuPanier`) attend dans une barre juste au-dessus du menu (`BarreDuPanier`, `body.avec-panier`) : sa vignette, son prix et son nom, la croix qui le retire, « Garder », qui ouvre son présentoir sur « Confirmer » ; à plusieurs, « Voir », et la feuille de ce qu'on essaie (`FeuilleDuPanier`) : chaque ligne et sa croix, le total, ce qui manque (`ceQuiManque`), « Tout retirer », « Tout garder » — qui achète ligne après ligne par les routes de toujours, porte ce qu'il garde, et s'arrête au premier refus, dit dans la feuille ; un thème gardé devient le sien sans repasser par l'ancien (`finirLEssai(true)`). Le serveur compte chaque achat et le refuse en clair — pas assez, hors saison, déjà à toi, ne se vend pas —, un à la fois par profil (`unAchatALaFois` : deux onglets dépensaient deux fois le même solde) ; la page montre le solde qu'il rend. Ce qui tient à l'écran se mesure (`server/scripts/rendu-boutique.ts`, le piège « La boutique tient en grilles », plus bas) ; `boutique.test.ts` garde sa structure, ses gestes et son envie, `envie.test.ts` les règles de l'envie et sa route. Ce qu'on a se porte dans la loge, pièce « Thème » (`/profil#theme`, `MesThemes` ; règle `profil.md`), en vignettes depuis le 17 novembre 2026 (`CaseDeTheme` : le haut de l'aperçu, la gemme de sa rareté et son nom, celui qu'il porte d'abord ; la fiche qui s'ouvrait sous la case dans la loge est partie — elle poussait la grille sous le doigt, et la page entière montrait déjà le thème) : toucher un thème l'**essaie** sur toute la page, rien n'est enregistré, « Porter », dans la barre de la loge, le garde (`loge.test.ts`) — il s'enregistrait d'un toucher : on ne voyait un thème qu'en le portant pour de bon
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
  sous empreinte —, son aperçu (`scripts/apercus-themes.ts <clé>`), et sa
  plaque de nom : sa règle de couleurs dans `styles.css` (`.plaque-<clé>`,
  plus bas), son dessin dans `EMBLEMES` (`scripts/emblemes-des-plaques.ts`,
  puis `--ecrire`) ; `plaques.test.ts` réclame l'un et l'autre.
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
- **Une plaque ne suit jamais celui qui regarde.** Ses couleurs s'écrivent
  en dur dans `styles.css` (`.plaque-<clé>` : `--p-bg`, `--p-ink`,
  `--p-muted`, `--p-or`, `--p-trait` — le `--bg`, l'`--ink`, le `--muted`,
  l'`--accent-text` et l'`--accent` de son thème) ; l'écrin, la marche, la
  carte d'un duel et l'échantillon de la loge les lisent eux-mêmes. **Un
  thème de plus prend sa plaque et son emblème, un thème dont les jetons
  changent les change là aussi** : `plaques.test.ts` compare chaque règle aux
  jetons de sa feuille, mesure l'encre, l'encre atténuée et l'or sur son fond
  (4,5:1), et refuse une plaque sans emblème ou un bloc d'emblèmes qui n'est
  pas celui du script. **L'emblème ne passe jamais sous un prénom** — la leçon
  du Kintsugi du 10 novembre 2026, dont les fêlures passaient sous les
  lignes : en filigrane sous l'avatar d'un écrin (16 %), sous le rang d'une
  marche (10 %), et en semis sur une carte d'un duel (le piège suivant). Le
  rang d'une marche s'y mesure, son ombre et son filigrane compris (3:1, un
  grand chiffre) : l'ombre à 18 % et le filigrane à 12 % de la maquette
  tombaient à 2,85:1 sous le rang de l'Ivoire. Chaque emblème a deux tons
  (`--p-clair`, `--p-sombre` : son or ou son trait, éclaircis ou assombris
  jusqu'à 3:1 sur le fond de chaque thème et sur sa propre plaque —
  dessinés pour suivre le prénom sur le fond de celui qui regarde, ils se
  lisent encore sur la plaque où l'écrin les pose). Un thème qui change de
  `clair`, ou dont le fond change, se relit par le script (`--ecrire`). Des
  images aux couleurs écrites dedans, ni masque ni filtre ni mouvement : dans
  une liste, rien ne garde un calque, et un SVG du DOM se tracerait en
  multi-échantillonnage dans le calque de sa ligne (règle `css.md`). **Un
  écran de plus où un joueur se montre** envoie ce qu'il porte par
  `sonApparence` (la plaque y est), ou `plaque` sur sa ligne (`plaqueDe`),
  pose son avatar dans un `Ecrin`, et rejoint l'épreuve qui compte les écrins
  de chaque vue ; **un classement de plus** passe ses lignes par
  `surLePodium` et `PodiumDuClassement` — le nom de chaque marche est celui
  de sa ligne, rang et score compris. L'écrin a la même place avec ou sans
  plaque (42 px, `margin-block: -5px` : une ligne y gagne 6 px), et prend
  celle de l'avatar sur deux étages (`:is(.lb-avatar, .ecrin)`) ; autour d'un
  anneau des duels ou d'un avatar d'échelon, 52 px. Le podium n'a pas
  `.podium` : c'est la classe du podium d'une soirée (`Podium.tsx`), qui ne
  montre jamais de plaque (invariant 8) — ses classes sont en `pdc-`. Dans la
  colonne du classement du jour (`.classement-periode`, un écart de 18 px),
  la liste se resserre sous le sol du podium : les marges s'ajoutaient à
  l'écart, 40 px de vide. **L'échantillon de la loge n'est ni un écrin ni une
  ligne** (`EchantillonDePlaque`, `.loge-plaque-echantillon`) : la vignette de
  l'onglet « Ma plaque », et le petit carré sur l'onglet lui-même ; un jeton
  de plaque de plus qu'il montre, il le lit lui-même.
- **La carte d'un duel est la seule où l'emblème passe sous un texte**, en
  semis, et chaque texte s'y mesure sur ce qu'il y a vraiment dessous
  (`.duels-carte.plaque::before`, le bloc « La grande plaque des duels » de
  `styles.css`) : le semis à 8 %, le reflet du haut de la carte, le dégradé
  de la plaque du nom et du socle. À 10 %, l'encre atténuée de quatre
  plaques — la Game Boy, l'Ivoire, la Licorne ; l'or de la Forêt — tombait
  sous 4,5:1 : la case qui l'écrit en petit (« à jouer ») a pris un sol
  plein, et l'or n'écrit sur la carte qu'en grand (le « ? », le score joué,
  3:1). Le semis est le premier de la carte (`::before`) : en dernier,
  positionné, il se peignait par-dessus tout ce qu'elle porte.
  `plaques.test.ts` relit les dosages dans la feuille et mesure chaque
  plaque ; un texte de plus sur la carte ou le socle entre dans la mesure.
  Pas `.carte-plaque` : la plaque du compagnon sur la carte d'un joueur, en
  absolu — la maquette l'avait empruntée, et la carte d'en face sautait au
  coin de l'écran.
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
