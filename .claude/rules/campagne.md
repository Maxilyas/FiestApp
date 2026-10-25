---
paths:
  - "shared/{campagne,sujets,revision,nomDuChoix,horsDeLaBase}.ts"
  - "server/src/core/{campagne,baremeDuSolo,jumelles,journalDesReponses,tirageALaPiece,porteDeLaCampagne}.ts"
  - "server/src/campagne.ts"
  - "client/src/views/{CampagneApp,Defi,Carnet}.tsx"
  - "client/src/components/{ChoixDuTheme,SerieCorrigee}.tsx"
  - "client/src/iconeDuSujet.ts"
  - "server/scripts/rendu-campagne.ts"
  - "server/test/{campagne,campagne-abandon,campagne-carnet,campagne-charge,campagne-defi,campagne-en-tete,campagne-familles,campagne-index,campagne-mesure,campagne-modes,campagne-ouverture,campagne-recompenses,campagne-sujets,campagne-variete,tirage-sans-redite,tirage-prepare,tirage-a-la-piece,bareme-du-solo,journal-des-reponses,hors-de-la-base,porte-de-la-campagne}.test.ts"
---

# La campagne solo et le défi de la semaine

## Les fichiers

- `shared/campagne.ts` · `core/campagne.ts` · `server/src/campagne.ts` · `client/src/views/CampagneApp.tsx` — la campagne solo (`/campagne`), pour les profils : une série qui monte de marche en marche (cinq faciles, cinq moyennes, cinq difficiles, puis l'expert — `ordreDeSerie`), trois vies, sans chronomètre ; ses questions viennent de sa base à elle (`core/baseCampagne.ts`), jamais de la réserve du quiz du jour — elle en reposait les questions, vues et corrigées chaque matin (le choix du 3 octobre 2026) — : les deux restent disjointes par l'intitulé, dans les deux sens (`JourStore.empreintes`, `dansLaCampagne`). Chaque marche tire d'abord ce que le joueur n'a jamais vu, puis ce qu'il a vu il y a le plus longtemps — une question vue ces dernières vingt-quatre heures ne revient qu'en dernier recours, en série comme en épreuve (`parFraicheur`, `VUE_RECENTE_MS`, `vuesPar` lit la dernière réponse de chacune : le choix du 10 octobre 2026, après un joueur qui revoyait le soir même les questions qu'il venait de rater) ; à fraîcheur égale, ses catégories puis leurs sous-thèmes passent à tour de rôle, au défi de la semaine et entre amis aussi (`TourDeRole` — `aTourDeRole`, sa marche seule, ne sert qu'aux tests —, le choix du 11 octobre 2026 : tirée au hasard, une série reflétait la base — quatre expertes sur dix d'art ou de cinéma après les faits de Wikidata, « Depuis 2010 » à moitié du cinéma, une série de musique à un tiers de musiques de films —, `campagne-variete.test.ts`), d'une marche à l'autre — ses marches se tirent dans l'ordre où elle les pose et partagent leurs comptes (`tirerUneSerie`, `TourDeRole`) : chacune repartait de zéro, et une même catégorie pouvait ouvrir les quatre —, et sans deux jumelles quand la marche en a d'autres aussi fraîches — la même forme d'intitulé, ou deux réponses en commun (`core/jumelles.ts`, règle `sentiers.md`) : une série du petit écran posait onze paires de jumelles en vingt questions, cinq « Qui a créé la série… », une de géographie cinq paires, plus qu'une demi au plus (le 12 octobre 2026, `tirage-sans-redite.test.ts`) ; le niveau d'une question part de sa difficulté estimée à l'écriture, lissée par les réponses de campagne (`tauxLisse`, vingt réponses fictives — `niveauDeQuestion`) — et, de la 1 à la 3, de la part mesurée sur sa famille : sa catégorie et sa difficulté, ou, pour une année, un autre nombre, un vrai ou faux, sa forme toutes catégories ensemble (`mesuresEnFamille`, `DIFFICULTES_EN_FAMILLE`, `formeDeReponse` ; le choix du 15 octobre 2026 : vingt réponses fictives contre au plus sept vrais joueurs, aucune moyenne n'était jamais devenue difficile, et les 3 qui se répondent par une année ne se trouvaient qu'à 33 %). La mesure (`mesures`) les porte toutes, jouées ou non : chaque tirage les lit sans rien savoir des familles ; ses propres réponses ne comptent pas pour sa famille, et aucune question n'y pèse plus de vingt réponses ; les comptes se relisent toutes les dix minutes, les familles aussi quand la base change — un reclassement vaut au tirage suivant (`campagne-familles.test.ts`) ; le modèle du savoir (`core/modeleDuSavoir.ts`, règle `duels.md`) la mesure mieux — il sait qui a répondu, et qu'une experte n'est atteinte que des forts —, mais seuls Automate et la chance des sentiers le lisent (règle `sentiers.md`) : les marches gardent `tauxLisse`, sur laquelle les mélanges et les seuils ont été calibrés (le choix du 13 octobre 2026, à revoir après mesure). Le serveur compte les vies et ne donne la bonne réponse qu'après la sienne (invariant 1) ; chaque question dit, sous « Moyen · question 10 », les bonnes réponses de la série, qui montent dès la révélation — au défi aussi, de la semaine ou entre amis (`TeteDeLaQuestion`, le retour d'un joueur du 13 octobre 2026 : seul, le numéro se lisait comme un score, et chaque vie perdue en route le faisait mentir d'une ; une révision n'a pas de score, un duel dit le sien dessous — `campagne-en-tete.test.ts`) ; la fin de série dit le record d'avant et la marche atteinte (`recordAvant`, `niveauAtteint`), la correction redonne l'anecdote — la série, le défi, le duel, les sentiers et les parcours corrigent par la même liste, la bonne réponse centrée, la sienne barrée dessous (`SerieCorrigee`, le corrigé du quiz du jour : règle `jour.md`). Ce qu'elle joue se dit sur une ligne, sous le gros bouton — « Sur Toutes les catégories », « Changer › » au bout (`LigneDuChoix`, `components/ChoixDuTheme.tsx`) —, qui ouvre la feuille du choix (`FeuilleDuChoix`) : toutes d'un toucher, ou une, ou plusieurs des douze en deux colonnes, puis, dans l'onglet d'à côté, les sujets, chaque famille sa rangée et son allure — les thèmes en tuiles, leur emblème dans un médaillon, les époques en frise dans l'ordre du temps, les fils rouges en pastilles, leur emblème devant (`SujetsDuChoix` ; le souhait du propriétaire du 17 octobre 2026, « plus stylisé, plus agréable à voir » : trente-cinq pastilles pareilles faisaient un mur de mots) ; rien ne change avant « Choisir · Histoire et Sport », « Fermer » rend le choix d'avant. Une catégorie choisie seule s'affine en ses rubriques (`RubriquesDuChoix`, le choix du propriétaire du 17 octobre 2026 : « apporter beaucoup de choix »), incrustées sous sa case — le même soir, « un truc incrusté » à la place de pastilles « pas très jolies » : la case s'ouvre comme un onglet de classeur sur leur panneau, de toute la largeur de la grille, d'une teinte opaque qui recouvre le bord qu'elle traverse (`--teinte-ouverte`, `.ouverte` : sa marge et son fond se comptent sur l'écart de sa grille, `campagne-ouverture.test.ts`), deux colonnes de rubriques serties en creux, « Toute la catégorie » d'abord : chaque sous-thème seul est un sujet comme un autre (`RUBRIQUES`, `shared/sujets.ts`, clé « sport/football » — « france » n'est pas le même en cuisine et en géographie), que les sujets d'une question ne disent pas mais que le serveur y ajoute (`sujetsEtRubriqueDe`, dans `sujetsDeLaQuestion`) ; proposé dès cent questions (`QUESTIONS_POUR_UNE_RUBRIQUE`), compté au carnet, joué en série, en révision, en duel et au quiz tout prêt — dont la grille s'affine de même (`GrilleDesCategories` `rubriques`), et dont « Une autre » garde la rubrique de la remplacée, après la jumelle —, jamais en parcours ; sa catégorie se dit pressée avec elle, et la feuille s'ouvre sur les catégories. Un sujet qui ne lit qu'un sous-thème en tient la rubrique (`Sujet.categorie`, le souhait du propriétaire du 17 octobre 2026 : « modifier des thèmes s'il y en a qui se recoupent » — douze thèmes doublaient la leur) : la rubrique n'existe plus, `rubriquesDeLaCategorie` le range à sa place sous sa catégorie, `sujetsEtRubriqueDe` ne l'ajoute pas — `rubriqueDe` la dit encore, pour le sous-thème que garde « Une autre » —, et la feuille le rouvre sous sa catégorie s'il y a été touché, sa catégorie seule choisie avec lui (`sousSaCategorie`) ; touché parmi les thèmes, il y reste — au quiz tout prêt, sa catégorie s'ouvrait au-dessus de la tuile, sous le doigt. `campagne-sujets.test.ts` le garde sur la base livrée : un sujet qui partage les quatre cinquièmes de ses questions avec une rubrique la tient, et deux sujets hors époques et portées ne se contiennent pas à moitié. Les fêtes (`famille: 'fete'`, le même jour) ouvrent l'onglet des thèmes, en tuiles : Noël, le Nouvel An, Halloween, l'amour et les anniversaires, chacune son sous-thème d'« Autour de la fête » et l'étiquette qui la nomme ailleurs, de la plus proche à la plus lointaine au jour de l'appareil (`fetesDansLOrdre`, `jour`), sans parcours (`aUnParcours`) ; et la francophonie a rejoint les fils rouges, par sa portée. Les pays (`famille: 'pays'`, le même soir), en pastilles après les thèmes, tous du même repère (`iconeDuSujet`), dans l'ordre de l'alphabet sans l'article : chacun son étiquette (`ETIQUETTES`, « Les pays » — la règle que la consigne des rédacteurs, de la routine et de l'étiquetage donnent toutes), posée sur la base question par question par des agents qui relisaient les candidates de mots-clés à cette règle — leur mythologie, leur langue seule et ce qui s'y passe par hasard n'en sont pas (règle `campagne-base.md`). Un pays n'entre au catalogue qu'avec ses cent questions : l'Égypte, l'Inde et le Mexique, entre 83 et 93 à la relecture, ont reçu les leurs à l'écriture (`generer-campagne.ts --sujet=egypte:25`, règle `campagne-base.md`). Ni la France, ni la Belgique ou la Suisse : leurs fils rouges. Le soir même, le Canada (le Québec compris, aussi de la francophonie) et deux continents, l'Afrique sans l'Égypte et l'Amérique du Sud sans le Mexique — un pays qui a son sujet n'entre pas dans celui de son continent —, et des fils rouges : Paris, posé de même, l'outre-mer, les citations et le calcul mental, qui avaient leur étiquette (« rajouter ce qui te semble pertinent » : ce que la base posait sans qu'on puisse le choisir, mesuré sur elle ; pas les îles, où l'outre-mer et les pays-îles se seraient retrouvés). Puis, « n'hésite pas à compléter et rajouter des questions si ça permet d'avoir d'autres thèmes » : huit pays de plus — l'Asie du Sud-Est, l'Autriche, la Corée, l'Irlande, les Pays-Bas, la Pologne, le Portugal, la Turquie —, et des thèmes de leur seule étiquette, posée de même : les rois et reines de France et la mer et les marins (des fils rouges une heure), la Révolution et l'Empire, les présidents de la République, l'aviation, le polar et les détectives, mystères et trésors, les marques — un sujet d'histoire ou un genre vit dans quelques catégories, thème et pas fil rouge ; ce qui manquait à neuf d'entre eux pour leurs cent questions, écrit (`--sujet=coree:65,…`). Et les dinosaures, partis des animaux — qui en tenaient les quatre cinquièmes — pour un thème qui tient leur rubrique. Pas DC : l'écriture suit la répartition d'un sujet, il serait resté à moitié dans la BD ; ni les sports d'hiver, à 39 % dans les grands rendez-vous. Les univers (`famille: 'univers'`, le même soir), en tuiles après les thèmes, chacun son icône et son étiquette (« Les univers »), posée de même : les sagas qui traversent les livres, les films et les jeux — Disney et Pixar, Harry Potter, James Bond, Marvel, le Seigneur des anneaux, Star Wars. Pas Astérix, Tintin, Nintendo ni Pokémon : les trois quarts de leurs questions tenaient déjà dans la BD ou les jeux vidéo, et deux sujets ne se recoupent pas (`campagne-sujets.test.ts`). La grille dépliée sous les yeux — douze cases et vingt-cinq sujets — faisait trois écrans, et repoussait « Jouer le duel » tout en bas de « Défier quelqu'un », qui la partage (la remarque du propriétaire du 12 octobre 2026, « trop impressionnant » ; la proposition 1 de la maquette, validée le même jour) ; le quiz tout prêt garde la grille (`GrilleDesCategories`, `GrilleDesSujets`). Ses records par catégorie, repliés, sous la ligne. Sa fin la rejoue sur ses catégories (« Rejouer · Culture générale ») ou rouvre la campagne, la feuille du choix ouverte (`SuiteDeLaSerie`, « Changer de catégorie ») ; le choix se retient sur le téléphone (`categoriesRetenues`, sous try/catch), et une série reprise sait les siennes (`SerieDeCampagne.categories`). Ou un sujet qui traverse les douze catégories (`shared/sujets.ts`, le choix du 10 octobre 2026, après un joueur qui voulait jouer « au-delà des douze catégories ») : des époques par la date des questions — au siècle près, une date n'en fait aucune ; dix-sept depuis le 17 octobre 2026, quand « Avant 1800 », « 1900 à 1949 » et « Depuis 2010 » se sont redécoupées (de l'Antiquité aux Lumières, trois époques du premier XXe siècle, les années 2010 et depuis 2020) : les anciennes, à part (`SUJETS_REMPLACES`), se lisent encore — leur clé, leur nom, leurs questions — sans se proposer nulle part, et leur parcours reste à qui l'avait commencé, qui le finit (`etatDesSujets` ; ailleurs « Cette époque se joue maintenant en plusieurs »), un choix retenu sur le téléphone les oublie (`estRemplace`) —, quatorze fils rouges par leurs étiquettes ou leur portée (la France, Paris, les pionnières, les pièges, les citations…), pas une question de plus à écrire — sinon les rares que l'outre-mer n'avait pas ; chacun a cent questions au moins, de sept catégories, cinq de chaque marche — un thème, plus bas, est dispensé des sept catégories : Volcans et océans et le petit écran en ont deux (`campagne-sujets.test.ts`). Puis des thèmes (le souhait du propriétaire du 11 octobre 2026 : « prévoir de rajouter des thèmes ») — les animaux, les inventions, mythes et légendes, la Terre et l'espace, les grands rendez-vous du sport, puis le petit écran (les séries du cinéma et la télévision des jeux), puis la danse et les métiers de la santé (le 15 octobre 2026 : chacun ses sous-thèmes neufs et son inventaire, règle `campagne-base.md` ; le corps humain est des métiers de la santé), puis l'informatique et l'astronomie (le 17 octobre 2026 : le sous-thème `techno` et le sous-thème `espace` des sciences, qu'un autre thème lit aussi), les jeux vidéo, la BD et le manga, les monuments et l'architecture (le même jour, sur leurs sous-thèmes), puis la langue française (le même jour encore : un sous-thème neuf qui a repris à `langue` tout ce qui parlait du français, son inventaire et son étiquette — l'origine d'un nom de dinosaure reste à « L'origine des mots »), l'anglais et l'espagnol (de même, la langue vue de France : le mot à traduire, le verbe irrégulier, le faux ami) ; puis, le même soir, ceux qui se recoupaient se sont défaits : les inventions ont laissé l'informatique, la Terre et l'espace l'espace à l'astronomie — sous le nom de « Volcans et océans », la clé `terre-espace` gardée avec ses parcours —, les souvenirs d'enfance les contes et légendes aux mythes, et les métiers de la santé sont devenus « La santé », que le carnet confondait avec leur rubrique —, lus sur des sous-thèmes de leurs catégories et sur une étiquette qui les porte ailleurs (`Sujet.sousThemes`) : un thème peut tenir presque tout entier dans une catégorie, ou en joindre deux. En ajouter un tient en une ligne (règle `sentiers.md`). Une série à sujet garde ses catégories NULL et son sujet (`campagne_series.sujet`) : ni la Grande Série — une série de toutes les catégories — ni les records par catégorie ne la comptent, le record de la série si. Ses sujets se lisent une fois par question (`sujetsDeLaQuestion`), par l'index de ce qui y fait entrer (`sujetsDe` : une étiquette, une portée, un sous-thème, des années — `campagne-sujets.test.ts` le compare à la règle lue sujet par sujet), et en fond après le démarrage, par tranches qui rendent la main, avec la préparation des tirages (`preparerEnFond`, dans `prechauffer`) : à la première ouverture après un réveil, les vingt-quatre mille passaient d'un bloc, 1,5 s de serveur figé au dixième de cœur ; la page ne propose que ceux qui ont de quoi faire une série (`EtatDeCampagne.sujets`), dans l'onglet « Thèmes » de la feuille du choix, retient le dernier (`sujetRetenu`), et sa fin le rejoue (« Rejouer · Les années 80 », « Changer de sujet »). Chaque partie — série, révision, défi, défi entre amis, rencontre — se quitte d'un « ← Partir » en haut (`Sortie`, comme « ← Accueil » partout ; le souhait du propriétaire du 11 octobre 2026 : dans le carnet, « Recommencer » mais rien pour partir) : rien ne se perd, elle attend dans l'onglet d'où elle se reprend (`ouAttend`), et il disparaît une fois la dernière réponse donnée — sa fin d'abord. « Recommencer », sous chaque question — la même pilule partout (`GesteDuBas`, `components/Pieces.tsx`) —, abandonne la série (`abandonnerSerie`, `POST /api/campagne/serie/:id/abandon`) : elle finit là, comme perdue — son record et ses hauts faits lus sur ce qu'elle a joué —, puis une neuve repart, ou sa fin s'affiche (« Arrêter là ») ; « Une nouvelle série » qui referme une série laissée lui décerne de même ce qu'elle a joué ; le défi ne s'abandonne pas (`campagne-abandon.test.ts`, le choix du 10 octobre 2026). La page s'ouvre sans attendre le serveur (`CampagneEnChemin` : le défi et les règles, le record et les boutons dès sa réponse) — ouverte sur le défi ou le carnet, c'est leur page qui s'esquisse, ses chiffres en attente, et demande les siens tout de suite (`surSonOnglet` : l'attente de la série passait d'abord, « Jusqu'où iras-tu ? » et son gros bouton, et le compte du carnet partait deux fois — l'experte du jeu solo, le 11 octobre 2026) ; une partie commencée avant l'état garde son écran —, et l'accueil d'un profil en télécharge le code en fond, avec celui du quiz du jour (`campagne-ouverture.test.ts`). Une question se signale après sa réponse, et se relit à `/admin#signalements`, avec celles du quiz du jour — qui la signale, où il l'a jouée et ce qu'il y a répondu, lu dans la version que sa série a gardée (`rapportDe`), ceux déjà relus avec, et ce qu'en disent toutes les réponses (`mesures`) — : la garder, la corriger (`corriger`, `campagne_corrections` — règle `campagne-base.md`), la reclasser — sa catégorie, son sous-thème, sa difficulté estimée, rangés comme une correction sur place (`reclasser`) —, ou la retirer pour tous (`campagne_retraits`) ; chaque geste dit ce qui en a été fait, et le joueur dont la remarque a servi en est remercié sur son accueil (règle `qg.md` ; `campagne-signalements.test.ts`, `qg-signalements.test.ts`). Une bonne réponse vaut un confetti, dans tous les modes (`ProfileStore.campagneDuProfil` → `CampagneStore.duProfil`, qui compte aussi les étoiles des sentiers et les ligues des duels, et rend de la même lecture ses paliers et sa cote : le solde relisait ses sentiers à part, la page du profil quatre fois — `profil-charge.test.ts`), compte pour l'écusson de sa catégorie et pour sa précision (`CampagneStore.savoirDe`) et vaut cinq points d'expérience, dix parmi les vingt premières du jour (`XP_PAR_JUSTE`, `JUSTES_DOUBLEES_PAR_JOUR`), sans plafond — chacun monte à son rythme (le choix du 3 octobre 2026) —, dans sa ligne à part (`LIGNE_CAMPAGNE`, `#campagne`), avec les paliers des sentiers validés en jouant, une fois chacun (`xpDuPalier`), relue à chaque bonne réponse — ses réponses comptées par heure, dans le lot qui écrit la réponse (`lecturesDeLExperience`) : Paris change de jour à une heure pile —, sous le verrou du profil ; la série en cours se garde en mémoire (`enCours`), oubliée au moindre échec d'écriture (`campagne-charge.test.ts`). Une partie finie — série, défi, duel, rencontre ; pas une révision — fait tomber ses hauts faits (le Funambule, Sans une égratignure, la Grande Série — `hautsFaitsDeLaSerie` — et le Tour du monde, une fois : sa condition tenue le reste — `tourDuMondeFait`, dans `recompenserLaSerie` —, rangés sous la partie, `cleDeSerie`, payés dans la ligne des paliers), puis les paliers de la campagne (L'Alpiniste, L'Érudit, Le Marathonien, et ceux des sentiers que `statsDe` compte aussi — règle `sentiers.md`) et les légendaires qu'ils ouvrent ; la page tient ses records par catégorie (`recordsParCategorie`, la colonne `categories`) ; les séries d'avant se relisent une fois (`relireLesSeries`, `VERSION_DES_SERIES`) — celles de mode `serie` seulement : un haut fait gagné au défi, en duel ou en rencontre ne se redérive pas, et une relecture ajoute sans jamais rien reprendre. À côté, son second onglet : les sentiers du savoir (règle `sentiers.md`). Le défi de la semaine a sa page à lui (`client/src/views/Defi.tsx`, `#defi`, servie par `CampagneApp`, qui en joue la partie, sans ses onglets — « ← Accueil » en tête) : il a quitté le troisième onglet de la campagne pour le sien, à côté du quiz du jour sur l'accueil (`JourEtDefi`, règle `profil.md` ; le choix du propriétaire du 19 octobre 2026 : « beaucoup de gens ne savent pas qu'il y a le défi de la semaine car il est caché dans la campagne ») ; la même série pour tous du lundi au dimanche, tirée au premier qui la relève — pas à l'ouverture de sa page — et figée (`campagne_defis`, `tirageDuDefi`, que seul `commencerLeDefi` appelle), une série d'un autre mode (`mode = 'defi'`, `semaine`) — une seule tentative, qui se reprend ; le record des séries ne la compte pas, et sa correction attend la clôture. Sa tentative finie tire l'Éclat, une chance sur vingt (`CHANCE_ECLAT_DU_DEFI`), dans `repondre` — jamais dans `recompenserLaSerie`, que la relecture des séries rejoue ; une tentative que la clôture arrête en route n'en tire pas, ni ses hauts faits —, rangé sous la semaine (`cleDuDefi`) ; ni la série ni les sentiers, qui se rejouent à volonté, n'en tirent. Rien ne tourne le lundi : la première demande clôt les semaines passées (`cloreLesDefis`) — Le Vainqueur du défi rangé sous la semaine (`cleDuDefi`), tous les ex æquo, à deux joueurs au moins et une bonne réponse au moins, masqués écartés (`cloreLeDefi`) — et le laurier d'argent se lit en mémoire, comme celui du jour (`vainqueursDuDefi`, `ProfileStore.argentDe`, `campagne-defi.test.ts`). Son onglet de l'accueil le dit à tout profil, fini compris (`defiDAccueil`, lu de front avec le reste de l'accueil, `ProfilDAccueil.defi` ; `boutonDuDefi`) : ceux qui l'ont relevé, le sien à reprendre, sa place une fois relevé — comptés comme son classement : une réponse au moins, ni suspendus ni masqués sauf lui, rang partagé ; les tentatives de la semaine d'un texte (`json_group_array`), sans charger les profils. Ce que l'onglet dit, la page le montre (`campagne-defi.test.ts`). Le bouton de la campagne l'a dit d'abord, du 11 octobre 2026 (l'experte du jeu solo : neuf chaque lundi, il ne se trouvait qu'au troisième onglet) au 19, à qui avait déjà joué la campagne ; il ne parle plus que du carnet et des sentiers. Un nom de son classement se touche, comme au classement du jour : sa carte s'ouvre (`LigneDuDefiVue` et `useCarteDUnProfil`, ici et entre amis — le souhait du propriétaire du 11 octobre 2026 —, ses gestes au pied : le défier, l'ajouter à ses amis, règle `duels.md`), et `/api/joueur/carte/:id` s'ouvre, entière, pour tout profil non masqué (règle `duels.md`). Défier un joueur — les duels classés et les défis entre amis — a quitté la campagne pour sa page (`/duels`, le souhait du propriétaire du 11 octobre 2026 : règle `duels.md`) ; la partie s'y joue sur l'écran de la série (`CampagneApp`).
- `shared/revision.ts` · `CampagneStore` (le carnet) · `client/src/views/Carnet.tsx` — le carnet de révision (`/campagne#carnet`, le troisième onglet — le quatrième jusqu'au 19 octobre 2026, quand le défi a quitté les onglets —, « Apprendre » depuis le 12 octobre 2026 — « Le carnet » jusque-là — : le carnet, puis les parcours de thème, qui ont quitté les sentiers pour lui, règle `sentiers.md` ; le choix du 10 octobre 2026, après un joueur qui voulait « un mode qui incite à l'apprentissage, où l'on gagne toujours quelque chose, sans frustration ») : ce qu'il a raté en campagne, dans tous ses modes — série, épreuve, parcours, révision, duel au dé —, et au défi de la semaine, entre amis ou en duel classé une fois clos : ouverts, ils souffleraient leurs réponses (`suivisDe`) — revient le lendemain, puis trois jours après, puis une semaine (`INTERVALLES_DE_REVISION`, au jour de Paris, un choix de produit) ; retrouvé à chaque rendez-vous, c'est appris, et une erreur le remet au premier, même appris. Une bonne réponse ne compte qu'à son rendez-vous ou après : retrouvée cinq minutes après l'avoir ratée, elle ne prouve rien (`apresUnPassage`). Rien ne se tient à côté : le carnet se relit dans le journal des réponses à chaque lecture (`suivisDe`, `suiviDeLaQuestion`) — une règle changée vaut aussitôt pour tout ce qui a été joué —, parmi les questions que la campagne pose encore ; le journal en mémoire le tient (`JournalDesReponses.carnetDe`, le 22 octobre 2026 : relu de la base, il parcourait toute l'histoire du joueur à chaque accueil, 14 000 lignes au quota de Turso pour le plus assidu) — de chaque question ratée, ses passages depuis sa dernière erreur qui compte d'office : une erreur la remet au premier rendez-vous quoi qu'il en soit (`apresUnPassage`), ce qui la précède ne change plus rien ; ceux d'un défi ou d'un duel encore ouvert se gardent à l'écart, relus à chaque lecture (la semaine, la fermeture du duel — `fermerLeDuel`, qu'`annulerUnDuel` avance) —, et la base, la requête d'avant, pour un joueur dont une réponse est arrivée avant une plus ancienne à la même question (`carnetIncertain`, `suivisDeLaBase`) ou tant que le journal se charge au réveil. Une révision est une série d'un autre mode (`mode = 'revision'`) : dix questions au plus, les plus en retard d'abord (`QUESTIONS_PAR_REVISION`), sans vies, reprise si on l'a laissée — ou recommencée, comme une série : elle se referme, ses réponses restent au carnet (`recommencer`) —, chaque réponse disant où en est sa question (`QuestionDeSerie.etape`, `suiteDeLaRevision`) ; tout le carnet se revoit aussi (`tout`, « Revoir tout mon carnet » : rien à revoir aujourd'hui était une impasse — le choix du 11 octobre 2026) : après les dues, celles qui attendent leur rendez-vous, puis les apprises, la plus anciennement apprise d'abord (`QuestionDeSerie.enAvance`) — retrouvée en avance, une question garde sa place (`apresUnPassage`), ratée, elle revient demain ; elle vise aussi des catégories ou un sujet, comme une série (`categories`, `sujet`, gardés dans sa ligne — recommencée, elle vise ce que visait l'autre ; le retour d'un joueur du 14 octobre 2026 : « cibler un thème à revoir, et savoir combien ») : le carnet compte chaque catégorie et chaque sujet (`EtatDuCarnet.categories`, `sujets`, `partVisee`), la page le dit sous le gros bouton, sur une ligne coupée au bout (`LigneDuChoix` `uneLigne` : sur deux, sans « Sur », elle poussait les parcours de thème hors du premier écran en 360 × 640), et la feuille du choix de la série, case par case (`FeuilleDuChoix` `comptes`, `compteDe` : « 3 à revoir », ou « 5 au carnet ») ; un choix sans question due se revoit en avance, et la fin d'une révision visée révise encore sur le même choix, tant qu'il y reste à revoir (`vueDeSerie` dit la visée d'une révision) ; ses bonnes réponses paient comme en série — un confetti, l'expérience d'une bonne réponse, Le Marathonien —, mais ni la mesure des difficultés (`mesures`), ni la précision et les écussons (`savoirDe`), ni L'Érudit ne la comptent : elle ne repose que ce qu'il a raté, réponse lue la veille ; ni record ni haut fait de série. L'onglet compte ce qui est à revoir (`Onglet.pastille`, lu après la page — au téléphone, les onglets perdent leur article, `Onglet.court` ; « Apprendre » n'en a pas), le gros bouton de la campagne à l'accueil aussi (`SentiersDAccueil.aRevoir`, compté par `accueilDesSentiers` sur le même `suivisDe` : le carnet n'avait pas d'autre porte que son onglet, et l'on ne revenait pas réviser — l'experte du jeu solo, le 11 octobre 2026), la fin d'une série rappelle que ses erreurs y reviendront, et ce qu'il a appris se relit au dépli — jamais ce qui reste à revoir (`campagne-carnet.test.ts` ; `server/scripts/rendu-campagne.ts` photographie le carnet, l'horloge avancée à la main)
- `core/baremeDuSolo.ts` — le barème du solo (le choix du 6 octobre 2026 : le quiz du jour est ce qu'on joue le plus, les soirées sont rares — « que ça avance vite en solo ») : le quiz du jour à 200, son podium à 75/45/30, un bonus de série (`xpDeSerie`) ; la campagne à 5 par bonne réponse, 10 pour les vingt premières du jour, ses paliers de sentier (`xpDuPalier`) ; les hauts faits du jour et de la campagne qui paient (`xpHorsDesSoirees`, dans la ligne des paliers), les paliers de carrière à 50/100/200. Une fois, sous son drapeau, au démarrage qui l'apporte : tout ce qui s'était joué se recompte (`JourStore.revaloriser`, `CampagneStore.revaloriser`, `ProfileStore.revaloriserLesPaliers`), puis les niveaux gelés de l'ancienne courbe se rattrapent (`rattraperLesNiveauxGeles`, la ligne `#rattrapage`, écrite une fois et jamais recalculée) et La Légende tombe (`accorderLaLegende`) ; un étage de niveaux plus dur viendra (`bareme-du-solo.test.ts`, `docs/reference/baremes.md`)

## Les pièges

- **Le mode d'une partie se lit dans une seule liste** (`MODES_DE_SERIE`,
  `shared/campagne.ts`, le 25 octobre 2026, avant le Cabinet de
  curiosités) : le type d'une partie (`Serie.mode`), sa lecture
  (`versSerie`, `modeDeSerieLu`) et le lieu d'un signalement (`rapportDe`)
  se recopiaient leur liste, et un mode oublié dans la lecture s'y lisait en
  série — les routes de la série l'auraient répondu, abandonné, corrigé. Un
  mode neuf la rejoint avant sa première partie, écrit en toutes lettres
  dans son insertion : `campagne-modes.test.ts` relit chaque `INSERT INTO
  campagne_series` du serveur. Une partie du Cabinet (`cabinet`) a ses
  routes à elle : celles de la série la refusent (« Cette série est
  introuvable »), sa correction aussi (« Cette partie se relit au
  Cabinet ») ; seul le signalement d'une question de la base y passe, à sa
  position, et le QG la dit « au Cabinet ». Le QG la compte en campagne,
  sous-mode à part (`SOUS_MODES_DE_CAMPAGNE`, règle `qg.md`).
- **Les lectures des séries filtrent sur le mode même** (`SERIES = "mode =
  'serie'"`) : écrit `COALESCE(mode, 'serie') = 'serie'`, le filtre ne
  servait aucun index, et le record, la page, les records par catégorie, la
  série en cours relisaient toutes les parties du profil, de tous les modes
  — le Cabinet en ajoute une dizaine par jour et par joueur ; sur le mode,
  ils prennent l'index des sentiers `(profile_id, mode, branche, palier)`,
  qui ne mène qu'à ses séries. Le `COALESCE` n'attrapait aucune ligne, et
  le compte en production des modes NULL, que la conception du Cabinet
  demandait d'abord, se tient par le code : la colonne est née `NOT NULL
  DEFAULT 'serie'` dès son premier `ajouterColonne` (le commit 37fb2a81 du
  4 octobre 2026, « Les sentiers du savoir » ; celui d'avant sur
  `core/campagne.ts`, 4b301c20, ne parlait d'aucun mode ; un clone
  superficiel ne les a pas : `gh api repos/Maxilyas/FiestApp/commits/37fb2a81`
  les lit) — SQLite donne ce défaut
  aux lignes qui existaient à l'`ALTER` et refuse tout NULL écrit ensuite ;
  aucune écriture ne pose le mode à NULL, et une insertion sans lui fait
  une série (`commencer`).
- **La partie en cours d'un mode se cherche par le profil et le mode**
  (`LA_PLUS_RECENTE`, `ORDER BY +commencee_le DESC LIMIT 1`) : la série, la
  révision laissée, la rencontre du dé — l'accueil et le dé —, l'épreuve,
  l'étape d'un parcours, l'expédition en route. Triées par leur date, sans
  statistiques, elles partaient de l'index du profil, rangé par date, qui
  épargnait le tri à SQLite : sans partie en cours — le cas ordinaire —,
  elles relisaient toutes les parties du profil, de tous les modes, à
  chaque accueil (la relecture du lot A1 du Cabinet, le 25 octobre 2026).
  Le `+` les mène à l'index des sentiers, qui ne lit que les parties du
  mode. `campagne-index.test.ts` lit le plan de chaque lecture des séries
  telle que le magasin l'envoie, et celui de chaque recherche d'une partie
  en cours — profil, mode et `finie_le IS NULL` dans un même `WHERE` —
  telle que le serveur l'envoie, sans statistiques comme la production :
  une lecture de plus y passe d'elle-même. Seules les dernières rencontres
  de la page des duels (`rencontresEtDuels`, sans `finie_le`) gardent
  l'index du profil : il s'arrête aux plus récentes, quand celui des
  sentiers lirait toutes les rencontres d'un fidèle du dé — mais un joueur
  sans rencontre y relit toutes ses parties, celles du Cabinet comprises.
- **Un tirage ne repasse plus toute la base**, à chaque série, défi, duel
  ou dé : vingt-cinq mille questions (25 529 le 17 octobre 2026), au
  dixième de cœur de l'hébergeur. La liste des jouables se garde tant que
  la base, la réserve du jour et les retraits ne changent pas
  (`jouablesGardees`, comparés par identité : la réserve du jour relue
  inchangée garde son ensemble — `JourStore.empreintes` ; relue en un
  ensemble neuf toutes les dix minutes, elle faisait tout refaire — et un
  retrait ne se reprend jamais, leur nombre suffit à dire qu'il en est
  venu un : un geste qui en rendrait un devrait la refaire), ses catégories
  et ses sujets aussi (`choixDe`, `sujetsComptes`), la liste d'un sujet
  (`duSujet`), et celle d'un choix de catégories (`jouablesDesChoix`, rangée
  par les catégories triées, `CHOIX_GARDES` au plus : filtrée à neuf à chaque
  série, duel ou dé sur des catégories choisies — les trois quarts des
  séries, la moitié des duels en production —, la préparation de son tirage
  se refaisait pour une liste neuve, le 19 octobre 2026). Une liste tirée des
  jouables se garde donc toujours, comparée par identité : c'est d'elle que
  la préparation du tirage se range. Ce que le tirage relit de chaque question — sa marche, sa
  file (catégorie et sous-thème) — se prépare une fois par liste et par
  mesure (`PreparationDuTirage`, `CampagneStore.tirage` ; la mesure
  changée garde les files) : un tirage n'est plus qu'un battage sur des
  indices, ses vues marquées depuis ses vues, et une passe qui range les
  jamais vues dans leur file ; les vues ne se trient qu'à la marche qui en
  a besoin. 13 à 25 ms par tirage, 1,4 à 2,7 après (le banc du 16 octobre
  2026, compilé comme en production) ; la préparation, 15 ms. Une retouche
  du tirage se vérifie au même hasard contre l'ancien, question pour
  question : `tirage-prepare.test.ts` garde le tirage du 16 octobre 2026
  entier et le compare sur la vraie base — le battage tire le hasard comme
  `melanger`, et chaque rang ne se compare qu'à un rang de la même marche
  et de la même classe —, `duels-attente.test.ts` compare `parFraicheur`,
  l'ordre que le tirage suit, au tri d'avant.
- **Le tirage à la pièce vit à part** (`core/tirageALaPiece.ts`, le
  25 octobre 2026, pour que le Cabinet de curiosités tire sans
  `CampagneStore`) : la fraîcheur que tous les tirages partagent
  (`VUE_RECENTE_MS`, `classeDeFraicheur`, `fraicheurDe`), les emprunts
  (`EMPRUNTS`), le rang (`passeAvant`), le battage (`melanger`), une
  question de la base telle qu'une partie la garde (`versQuestionDeSerie`),
  le tirage d'une escale (`tirerPourUneEscale`) et celui du contenu hors de
  la base (`laMoinsVue`). `core/campagne.ts` le lit, jamais l'inverse, et
  réexporte `tirerPourUneEscale` et `VUE_RECENTE_MS` à ses lecteurs d'avant.
  Ce qu'il a appris ne vaut que pour qui le demande : une fenêtre à soi
  (`fenetreMs` — sept jours au Cabinet, les vingt-quatre heures de toute la
  campagne d'office) et des marches qui valent la sienne (`aussi`, « facile
  ou moyenne » : la fraîcheur départage, chacune sort à sa marche) ; sans
  eux, le tirage d'avant, au même hasard — `tirage-a-la-piece.test.ts` garde
  le code d'avant et l'y compare. `laMoinsVue` n'a pas de fenêtre : le plus
  anciennement vu d'abord ne repose rien de récent tant qu'il reste autre
  chose. Le tirage d'une escale ne bat pas son tas : il s'arrête à la
  première question au rang tout à zéro — jamais vue, d'un sous-thème
  encore à servir, sans jumelle. Une composante de rang neuve vaut donc 0
  pour une question jamais vue et pas encore servie, ou chaque tirage relit
  le tas entier — le gardien, vingt-cinq mille questions
  (`expedition-tirage.test.ts` compte ce qu'il lit, règle `expedition.md`).
  La frise n'y passe pas : elle se tire avec ses règles (`shared/frise.ts`).
  Les sept événements du Cabinet tiennent l'écart, ou ne se tirent pas
  (`choisirLaFriseSansRepli`) ; `choisirLaFrise`, celle de l'Expédition,
  resserre l'écart plutôt que de rendre null, et la Frise du Cabinet
  refuserait ensuite deux années trop proches (`friseEnVagues`). Une
  question tirée par une partie a un seul cœur (`QuestionDeLaPartie`) :
  `QuestionDeSerie` l'étend, et ce que le Cabinet en garde s'y lie par le
  typage, pas par une copie. Aucune fonction n'y prend de graine : le
  hasard d'un tirage est celui du serveur, et une graine que la page connaît
  lui dirait ce que la partie va poser (invariant 1). Les formes de
  l'Expédition (`aSaForme`, `seLaissePoser`) restent au magasin : le tirage
  à la pièce n'en sait rien, et l'Éclair du Cabinet récrit ses affirmations
  par sa règle à lui (`affirmationDe`).
- **Le journal des réponses se garde en mémoire, et se lit par
  différence** (`core/journalDesReponses.ts`, `JournalDesReponses`, le
  22 octobre 2026 : 333 millions de lignes lues au quota de Turso sur les
  500 du mois). Turso compte chaque ligne qu'une requête parcourt : la
  mesure relisait toutes les réponses deux fois toutes les dix minutes
  (172 000 lignes, et 3,2 s sur le chemin du duel qui la trouvait périmée),
  le modèle du savoir 87 000 à chaque ajustement, l'expérience d'un fidèle
  12 000 à chaque bonne réponse, ce qu'il a vu, ses premières réponses, ses
  écussons, ses missions à chaque page, son carnet à chaque accueil. Le
  journal lit tout une fois — au réveil, par tranches de deux mille
  (`chargerLeJournal`, `prechauffer`) —, puis seulement ce qui est arrivé
  depuis le plus grand `rowid` lu (`lectureDuJournal`), en un seul texte
  JSON — le client de Turso décode chaque ligne à coups de
  `defineProperty` —, au bout du lot de la requête qui en a besoin
  (`lireAvecLeJournal`) ou d'un aller-retour à lui (`rattraperLeJournal`).
  Il garde les dérivations mêmes que relisaient les requêtes d'avant, avec
  leurs filtres (`vuesDe`, `premieresDe`, `justesParHeureDe`, `savoirDe`,
  `expertesDe`, `recentesDe`, `mesures`, `premieresJustesDe`, `carnetDe` ;
  depuis le 24 octobre 2026, `compagnonsDe` — 38 % du quota de Turso à lui
  seul, la veille —, `justesDe` — la somme des `justes` des séries, égale en
  production, profil par profil et mode par mode, au compte de leurs bonnes
  réponses — et `reponsesDesEpreuves`, l'administration des sentiers, 150 000
  lignes par page) : une dérivation de plus s'y écrit, et se compare au SQL
  d'avant dans `journal-des-reponses.test.ts`, sur une base au hasard. Un
  test qui efface une réponse derrière le dos du serveur le redémarre
  (`banc.redemarrer()`) : le journal ne l'apprend pas. **Une lecture
  sait ce qu'on a écrit avant elle** : chaque lecture du journal prend un
  numéro en partant (`lecturesDuJournal`), le journal retient la dernière
  complète qu'il a reçue (`fraisDepuis`) ; une requête qui commence n'a
  rien à relire si une lecture est partie après elle, et chaque écriture
  d'une réponse prend son numéro (`reponseEcrite`) — une porte neuve qui
  écrit dans `campagne_reponses` l'appelle après son lot, comme
  `vuAilleurs`. Une réponse ne change jamais : seul `oublierProfil` en
  efface, et refait le journal entier.
- **Le réveil relit les tranches gardées du journal, pas toute la base**
  (`campagne_tranches`, le 24 octobre 2026 : la première lecture de chaque
  démarrage parcourait 47 000 lignes au quota de Turso, sept réveils par
  jour, deux fois plus à chaque doublement des réponses). Chaque tranche est
  une lecture du journal telle qu'elle est partie — deux mille réponses, le
  texte même de `lectureDuJournal`, 412 Ko — rangée sous le `rowid` d'où
  elle partait ; le réveil les relit dans l'ordre, quatre par aller-retour
  (`reprendreLesTranches`), puis la base pour ce qui suit, moins de deux
  mille réponses — sans tranche au démarrage (`tranchesAuDemarrage`, lu
  dans le lot d'`init`), il ne les cherche pas : la première demande d'un
  réveil n'attend pas un aller-retour de plus (`duels-attente.test.ts`) ;
  et ce que le journal lit au-delà s'y range en fond, deux
  mille à la fois, écrit par la base elle-même (`garderLesTranches`,
  `ecritureDUneTranche`). Elles ne valent que tant que la base dit la même
  chose : une réponse effacée ou modifiée, une série effacée les effacent
  toutes, par des déclencheurs (`DECLENCHEURS_DES_TRANCHES` — un test, une
  main, `oublierProfil`) ; les duels qu'elles disent ouverts se relisent au
  réveil, la fermeture d'un duel étant la seule chose que leurs lignes
  puissent avoir manquée (`annulerUnDuel`) ; une lecture qui change de forme
  ne relit pas celles d'avant (`VERSION_DES_TRANCHES`, l'empreinte de son
  texte : rien à monter) ; une tranche illisible ou hors du chemin arrête la
  relecture, et s'efface avec celles qui la suivent. Une colonne de plus que
  le journal lit d'une ligne qui peut changer — un champ d'une série qu'on
  modifie après coup — se relit au réveil comme les duels, ou ajoute son
  déclencheur. La sauvegarde n'en recopie pas les lignes : la restauration
  renumérote les `rowid` qu'elles citent (`REFAITES`,
  `scripts/sauvegarde.ts`). `journal-des-reponses.test.ts` réveille la
  campagne sur ses tranches et la compare au SQL d'avant.
- **Ce qui n'est pas une question de la base se lit dans une seule liste**
  (`PREFIXES_HORS_DE_LA_BASE`, `shared/horsDeLaBase.ts`, le 25 octobre
  2026, avant le Cabinet de curiosités) : un rébus (`rebus:`), une frise
  (`frise:`), ce qu'un jeu du Cabinet tire d'ailleurs (`cab:`). Ni carnet
  ni signalement : le carnet du journal (`auCarnet`, `horsDeLaBase`), le
  même en SQL (`suivisDeLaBase`, `sqlDansLaBase`) et le signalement
  (`signaler`, `refusDuSignalement` — les phrases du rébus et de la frise
  mot pour mot, le Cabinet la sienne) la lisent. Chacun recopiait ses
  préfixes : oublié des deux côtés du carnet, que
  `journal-des-reponses.test.ts` compare, un préfixe ne se serait pas vu —
  une pièce du Cabinet ratée y serait entrée, et « À revoir », sur
  l'accueil, l'aurait comptée chaque jour sans qu'aucune révision ne la
  repose (`compterARevoir` ne lit que les retraits). Un préfixe neuf la
  rejoint, avec sa phrase (le typage la réclame), en minuscules et fini par
  un deux-points : aucun identifiant de la base n'en porte, et `LIKE`, qui
  ignore la casse, ne lui prend rien (`hors-de-la-base.test.ts`). Une
  lecture neuve de `campagne_reponses` qui joint la base ou reprend une
  réponse pour la reposer écarte ce qui n'en est pas par `horsDeLaBase` en
  mémoire, par `sqlDansLaBase` en SQL — jamais par un préfixe recopié : le
  même test refuse, dans le code et pas dans un commentaire, un `LIKE` sur
  un préfixe de la liste et une phrase de refus, mais un `startsWith` lui
  échappe. La lecture du journal n'en dépend pas — le carnet les écarte au
  repli : un préfixe de plus ne relit rien au réveil
  (`VERSION_DES_TRANCHES` ne bouge pas).
- **Une réponse de campagne écrite prévient l'expédition** (`vuAilleurs`,
  avant le lot de la série et de ses modes, de l'épreuve, du parcours) :
  l'expédition en route garde en mémoire ce qu'il a vu, lu à son départ, et
  ne le relit qu'ainsi (règle `expedition.md`). Une porte neuve qui écrit
  dans `campagne_reponses` l'appelle aussi : sans, l'escale suivante
  pourrait reposer, comme jamais vue, la question qu'il vient de voir.
- **Le Cabinet de curiosités passe par une porte** (`core/porteDeLaCampagne.ts`,
  `CampagneStore.porte()`, le 25 octobre 2026) : il n'importe pas ce magasin,
  et ce magasin ne connaît de lui que trois crochets, déclarés dans ce
  fichier — son réveil (`init(REVEIL_DU_CABINET)` : ses trois tables et son
  secret dans le **premier** lot, sa colonne `campagne_series.cabinet` par
  `ajouterColonne`, qui garde le schéma déjà lu pour les nôtres : pas un
  aller-retour de plus au réveil, un `ALTER` au premier), ses paliers
  (`statsEnPlus` : ses lectures dans le lot de `statsDe`, et ce qu'il en tire
  — ses seuls champs, `ChampsDuCabinet` : aucun compte de la campagne, que le
  typage refuse et que `statsDe` étale par-dessus) et l'expédition qui part
  ou finit (`expeditionChange`, `partirEnExpedition` et
  `recompenserLExpedition`, où passe toute fin, écrite : en mémoire, sous le
  verrou du profil, pour la seule ligne « Ton expédition t'attend » de sa
  page ; ce qui y tombe se dit au journal sans faire tomber le geste). Rien
  ne s'en rapporte : la fin d'une expédition qui rapportait ses œuvres est
  partie avec la migration (abandonnée le 25 octobre 2026, `decisions.md`) —
  n'y remets ni lecture ni écriture. Le
  rituel d'une réponse y tient en une fonction (`ecrireDesReponses`), dans
  l'ordre de `repondre` : `vuAilleurs`, le lot — et à la fin d'une partie qui
  a des justes, les lectures de l'expérience au bout —, `reponseEcrite` même
  si le lot échoue (écrit ou non, on ne le sait pas), puis, à la fin
  seulement et si le lot l'a écrite (`FinDUnePartie.ecrite`, que le Cabinet
  lit sur la ligne de son geste : un rang déjà pris n'a rien écrit, et rien
  ne se refait), l'expérience créditée une fois pour toute la partie
  (`crediterLaLigne` ; ce que chaque juste rapporte se lit à son rang dans son
  jour, `xpDesJustes`, minuit compris), ses gardiens (`avantLesPaliers`), les
  paliers rangés sous la partie (`recompenser`), le compagnon qui grandit —
  chaque pas qui tombe dit son échec au journal, et le suivant passe. Une
  étape de plus au rituel s'écrit là (`CampagneStore.ecrireDesReponses`),
  jamais au Cabinet, et `porte-de-la-campagne.test.ts` compte ce que chacune
  coûte. Le journal seul
  de la porte (`lireAvecLeJournal([])`) ne se relit que si une réponse s'est
  écrite ici depuis la dernière lecture (`rattraperLeJournal(derniereReponse)`) :
  le tirage d'un départ du Cabinet ne paie alors rien ; celui de la campagne
  relit toujours. Le secret (`campagne_meta.secret_du_cabinet`) se propose à
  chaque réveil et ne s'écrit qu'une fois (`INSERT … ON CONFLICT DO
  NOTHING`, relu dans le même lot) ; une campagne ouverte sans lui le refuse
  en `TypeError` — un branchement oublié est une erreur du serveur, pas un
  refus à dire au joueur. `campagne_meta` naît donc au premier lot, pour que
  le secret s'y relise.
- **La mesure ne se fait jamais attendre** : demandée dès ses deux
  dernières minutes (`MESURE_EN_AVANCE_MS`), même périmée depuis des
  heures, la suivante part en fond — du journal, rattrapé d'un
  aller-retour —, puis ses familles et la préparation du tirage de toutes
  les catégories (`relireLaMesureEnFond`) ; qui la demande pendant ce temps
  reçoit celle qu'il y a — seule la première, au réveil, s'attend. La
  requête qui la trouvait périmée — un tirage, un dé, un duel — attendait
  l'aller-retour de toute la mesure et son calcul, 1,2 à 1,4 s au dixième
  de cœur (le banc du 16 octobre 2026), 2,9 s pour un duel en production
  (le 22 octobre). Une tentative toutes les deux minutes au plus
  (`MESURE_RETENTEE_MS`), ratée ou non : une base muette ne se fait pas
  relire à chaque requête. Un test qui avance l'horloge pour lire la mesure
  neuve relit après coup (`relireJusqua`, `banc.ts`) : la lecture qui la
  trouve périmée rend l'ancienne. Une mesure neuve coûte 19 à 23 ms de
  processeur, 30 à 37 avant (`banc-mesure.ts`, compilé) : la série de
  référence du dé lit ses marches de la préparation du tirage
  (`referencePour`, `PreparationDuTirage.marche`) et trie ses groupes en
  tableaux de nombres (`serieDeReference`) — `campagne-mesure.test.ts` les
  compare au code d'avant, gardé dans le test.
- **Une étape de fond par tour de boucle** (`rendreLaMain`,
  `core/tourniquet.ts`) : rendre la main par `setImmediate` ne suffit pas.
  Plusieurs calculs qui attendent la même promesse — la base au réveil, une
  mesure neuve — repartent dans la même phase, l'un derrière l'autre : les
  index de la base, ses familles (`mettreEnFamille`), la préparation des
  tirages et la série de référence faisaient un bloc de 130 ms au réveil,
  70 ms pour un dé tombé sur une mesure périmée — dix fois plus au dixième
  de cœur (le banc du gel compilé comme en production, le 19 octobre 2026).
  Une étape lourde passe donc son tour avant de calculer, relit ce qu'une
  autre a pu faire pendant qu'elle attendait, puis calcule d'une traite,
  sans `await` au milieu ; qui attendait une mesure neuve repart à son tour
  (`mesures`). Toute boucle de fond par tranches passe par lui : deux
  tranches de deux calculs dans le même tour, c'est encore un bloc.
  `travail-de-fond.test.ts` compte les tours de boucle — jamais deux étapes
  lourdes dans le même. Restent d'une traite, vingt à trente millisecondes
  chacune : les index d'une base (`BaseDeLaCampagne`) et la première
  préparation d'un tirage (`PreparationDuTirage`).
- **L'en-tête d'une partie passe à la ligne au téléphone** : en 360 de
  large, à côté des cœurs, « Contre Automate · question 1 » laissait le
  « 1 » seul sur sa seconde ligne (contre Tom, il tenait sur une). « question
  N » s'y écrit d'un bloc et chaque « · » se colle au mot d'avant, par des
  espaces insécables : coupé, il se lit « Contre Automate · », puis
  « question 1 », et le texte ne change pas (`TeteDeLaQuestion`,
  `campagne-en-tete.test.ts`). Une forme neuve de l'en-tête fait de même.
