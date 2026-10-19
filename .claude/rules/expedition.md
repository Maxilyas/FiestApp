---
paths:
  - "shared/{expedition,jokers,rencontres,codex}.ts"
  - "server/src/expedition.ts"
  - "client/src/views/{ExpeditionApp,RencontresDExpedition}.tsx"
  - "client/src/components/{Balise,Vies}.tsx"
  - "client/src/components/cartes-peintes.ts"
  - "server/scripts/{rendu-expedition,calibrage-expedition,rendu-rencontres,calibrage-rencontres}.ts"
  - "server/test/{expedition,expedition-carte,expedition-carte-ecran,expedition-question-ecran,expedition-pli,expedition-legendaires,expedition-jokers,expedition-mesure,expedition-charge,expedition-tirage,expedition-formes,expedition-ecus,expedition-echoppe,expedition-themes,expedition-passeport,expedition-saison,expedition-rencontres,expedition-rencontres-routes,expedition-rencontres-ecran,expedition-partir,cartes-peintes,codex,expedition-codex}.test.ts"
---

# L'Expédition : la carte, les escales, les gardiens, les jokers, les écus, le passeport, les saisons

Trois actes, chacun une carte tirée au sort — six étages de quatre colonnes, deux campements, un gardien au bout —, et au bout du troisième un des trois gardiens vaincus à garder : un légendaire ; en main, des jokers ; en poche, des écus. Le brief validé par le propriétaire le 17 octobre 2026 (« on fait que rajouter des choses mais on ne sait plus quoi choisir ») : `retours/2026-10-17/expedition.md`. **Les quatre étapes sont faites** — la carte et une expédition de bout en bout, les jokers, les formes de question, puis les écus : l'échoppe, l'inconnu, les talismans. Puis, le 18 octobre 2026, le passeport — un tampon par thème pointu trouvé, le Globe-trotter — et la saison des fêtes — sa fête sur les cartes, son légendaire à l'acte 3. Ouverte en production depuis ses jokers (`EXPEDITION_EN_PRODUCTION`) : avec une équipée de deux, le joueur moyen arrive au bout 25 à 31 fois sur cent, le fort 67 à 77 — la cible du brief, une fois sur trois et huit sur dix, approchée. **Les rencontres** (la version 5 du départ, le 18 octobre 2026 — la proposition « L'Expédition en cartes », `retours/2026-10-18/rencontres.md`) : un prototype de la préproduction, puis le jeu partout depuis le 19 octobre 2026 (« ne plus demander ça, c'est vraiment le jeu maintenant ») ; une escale à question devient un adversaire à faire tomber question après question, le courage remplace les vies, des cartes les jokers — la préparation, la mise, le cycle de Slay the Spire. **Le codex** (la version 7, le 18 octobre 2026 au soir — « Go tout faire avec tes recommandations ») : chaque expédition finie rapporte de la renommée, la renommée fait le niveau d'explorateur, chaque niveau ouvre des cartes à gagner et, aux premiers, le pari, les talismans et la catégorie fétiche ; plus d'équipe à choisir, l'invité du jour prête sa carte, et le trésor d'un gardien propose la carte d'un légendaire qu'on a. Puis les exploits — un but précis, fait une fois : Banco, Lancée, Échauffement et le dos doré du paquet ne s'ouvrent que par eux. Puis les objets, le 19 octobre 2026 : les fioles — courage, énergie, clairvoyance, à boire quand on veut, deux au plus —, une règle du niveau 3, et les dos de cartes ; puis le trophée L'Explorateur, une piste de la campagne au niveau d'explorateur (4, 7, 10), réservé aux serveurs où les rencontres s'ouvrent. Puis l'Ascension, le même jour : une expédition menée au bout ouvre cinq crans de difficulté qui s'ajoutent l'un à l'autre — les points des adversaires, leur frappe, le repos, l'énergie de chaque question, les gardiens —, chacun ouvert par une victoire à celui d'en dessous, choisi au départ.

## Les fichiers

- `shared/expedition.ts` — tout ce qui se calcule, pur. Le générateur (`carteDUnActe`, de la graine du n-ième départ du profil — `graineDe`, `hasardDe` : la même graine redonne la même carte) : cinq chemins qui montent sans se croiser, leurs pas font les escales et les liens ; la sorte de chaque escale (`POIDS_DES_ESCALES` ; plus d'adversaires en rencontres, `POIDS_DES_ESCALES_DES_RENCONTRES`), son thème — une catégorie, un mélange de deux ou trois, un sujet pointu (`PART_DES_MELANGES`, `PART_DES_THEMES_POINTUS` ; ses sujets, le serveur les donne : piège plus bas ; la fête d'une saison en tient la moitié, `PART_DE_LA_FETE`) —, sa forme (`POIDS_DES_FORMES`, `FORMES_OUVERTES` : toutes depuis l'étape 3) ; toutes les sortes depuis l'étape 4. Les écus (`ECUS_DES_PISTES`, `ecusDeLaReponse` — la couleur de la chance annoncée, `chanceAnnoncee`, celle du Commandement comprise —, `prixDeLEscale`, `ecusEsperes`), l'échoppe (`PRIX_DE_L_ECHOPPE`, `prixDeLArticle`, `refusDeLAchat`), l'inconnu (`contenuDeLInconnu`, `legendaireDePassage`), les talismans des offres (`talismanDeLOffre`, `CHANCE_D_UN_TALISMAN`), la fiole d'un coffre (`fioleDeLOffre`) et pourquoi une fiole ne se boit pas (`refusDeLaFiole` — la seule règle), le siècle de la loupe (`siecleDeLaQuestion`). Le dévoilement (`MS_PAR_MOT`, `ARRET_SUR_IMAGE_MS`, `MOTS_DU_DEVOILEMENT`, `motsDe`, `motsDits`, `instantDuMot` : combien de mots sont dits à l'heure du serveur, et quand se dit le suivant). Les marches (`MARCHES_DES_ACTES`, `marcheDe` : jamais d'experte), les gardiens (`gardiensDe`, jamais l'invité du jour ; le légendaire d'une saison à l'acte 3, `deSaison`), le passeport par famille (`passeportParFamille`), l'invité du jour (`inviteDuJour`) et l'équipée (`refusDeLEquipee`), les offres (`offreDeJokers`, parmi les jokers que la version du départ connaît — `Joker.depuis`), les chances (`chanceSelonLaForme`, `chanceDeVaincre`, `viesAuBout`, `chancesDuTrace`, `traceLePlusSur`, `escalesAtteignables`), le pli (`pliDeLExpedition` — la main, le paquet, la défausse, les posés, l'offre, le campement, les jokers de route —, `escalesPermises`, `carteEnJeu` et `maisonAOuvrir` — la carte que Il connaît la maison change —, `questionsDuGardien`), pourquoi un joker ne se joue pas maintenant (`refusDuJoker`), ce qu'un joker montre d'une question (`reponsesEffacees`, `indiceDeLEnigme`, `sensDeLOracle` : ils lisent la bonne réponse, le serveur seul les appelle), les types de la page (`VueDeLExpedition`, `JokersEnJeu`, `PageDeLExpedition`), le nom d'un gardien dans une phrase (`leGardien`, `auGardien`, `gardienAuFeminin` : « vers le Kraken », « à la Chouette d’Argent »). Ses constantes sont des choix de produit (`docs/reference/baremes.md`)
- `shared/jokers.ts` — `EXPEDITION_EN_PRODUCTION`, le catalogue (`JOKERS_DES_LEGENDAIRES`, vingt-trois — la lanterne de la Citrouille et la boule du Sapin venues avec l'inconnu —, `JOKERS_SANS_LEGENDAIRE`, neuf ; `joker`, `jokerDuLegendaire`), les talismans (`TALISMANS`, `talisman`), `LEGENDAIRES_A_JOKER` — eux seuls gardent un acte, s'emmènent et ont la voie —, et les règles du paquet : `PAQUET_DE_DEPART`, `MAIN_MAX`, `MAIN_MAX_DES_TROIS_TETES`, `PLACES_DE_L_EQUIPEE`, `JOKERS_PAR_OFFRE`, `POIDS_DES_RARETES`, `EFFACE`, `JOKERS_QUI_AIDENT`. Il n'importe rien : `shared/legendaires.ts` le lit, l'album et l'accueil aussi, sans tirer toute l'expédition
- `CampagneStore` (`core/campagne.ts`, « L'Expédition ») · `server/src/expedition.ts` — une expédition est une série `mode = 'expedition'` : son départ dans `campagne_series.expedition` (`DepartDExpedition`, versionné — la version 2, ses jokers : son équipée, l'invité de son départ, sa chance sur chaque marche de chaque catégorie et sur une source), ses gestes dans `expedition_gestes` (`serie_id`, `rang`, `geste`), ses réponses dans `campagne_reponses` — aidées, la clé de leur joker (`joker`) —, comme toute partie : l'expérience, les confettis, le carnet et « jamais vues d'abord » la comptent sans rien en savoir. Les routes, pour les profils (`GET` et `POST /api/expedition`, `POST /api/expedition/:id/geste`, `…/reponse`, `…/abandon`) ; sa correction et ses signalements par celles de la série (« en expédition » au QG). `pageDeLExpedition` (celle en route, sinon la prochaine : son numéro, ses gardiens, ceux qu'il a déjà — `aLui` —, l'invité du jour, ses légendaires qui ont leur joker — `equipables`), `partirEnExpedition` (une à la fois, son équipée), `chancesDeLExpedition`, `gesteDExpedition` (`gesteRecevable` : avancer, jouer, prendre, camper, acheter — écrit avec son prix ; garder, `garderUnGardien` ; un piège qui prend la dernière vie finit l'expédition d'un geste), `completerLExpedition` (ce que le pli demande de tirer, `aTirer` — la question d'une escale, celles du gardien, l'autre d'Échange ou de Deux visages, la reprise de La boucle —, tiré dans le lot du geste), `repondreEnExpedition` (Double chance : deux réponses ; `jokerQuiAide`), `abandonnerLExpedition`, `tirerPourLExpedition` (sur le thème de l'escale — ou la catégorie du Commandement —, par `tirerPourUneEscale`, le rang d'une épreuve lu dans un ordre tiré à mesure), `expeditions` (l'expédition en route en mémoire, `ExpeditionGardee` : `expeditionAJouer`, `garderLExpedition`, `ecrireLExpedition`, `vuAilleurs`), `aSaForme` (la forme posée au tirage : six choix et ses leurres, `leurresDuSixChoix` ; un vrai ou faux et sa réponse proposée ; un dévoilement et l'heure de son premier mot — ce qu'une question doit avoir pour s'y prêter, `seLaissePoser`), `devoilement` (les mots d'un dévoilement et où il en est, pour sa route `GET /api/expedition/:id/devoilement`, qui les écrit chacun à son heure), `vueDeLExpedition` (ce que la page reçoit : la carte en jeu — l'inconnu dévoilé seul —, les jokers et leurs refus, ce qu'un joker montre, le siècle de la loupe, les écus, les talismans, l'échoppe, l'inconnu où il entre), `questionsPosees` et `devoileA` (le mot où un dévoilement en était à l'heure de sa réponse, `ExpeditionLue.reponduesLe` : ses écus en dépendent), `recompenserLExpedition` (les paliers de la campagne : Le Marathonien ; ni record ni haut fait de série). `oublierProfil` efface ses gestes
- `client/src/views/ExpeditionApp.tsx` — la page (`/expedition`, à la demande dans `main.tsx`, préchargée par `shared/depart.ts`, réservée dans `shared/space.ts` ; un gros bouton sur l'accueil d'un profil, `AccueilDesRoles.tsx`, tant que le drapeau l'ouvre) : le départ (`Depart` : le numéro de la carte, les trois gardiens annoncés, ceux qu'il a déjà, l'équipée — `Places`, « Changer » —, retenue sur le téléphone, `quizz.expedition.equipee`), sa feuille (`FeuilleDeLEquipee` : la grille des légendaires qu'il peut emmener, la fiche du dernier touché, `TousLesJokers` déplié à la demande), la carte d'un acte (`CarteDeLActe`, revue deux fois le 18 octobre 2026 — seule l'escale où il est s'éclaire, puis « de vrais cartes en bas » ; l'écran tient en un écran : `lireLaCarte` une fois pour tout, `etatDeLEscale` et `liensDuPlan` pour le plan ; en haut l'acte en petit, `PetitPlan` — ses rangées en pour cent de sa hauteur, `EN_PETIT`, ses colonnes en pour cent de sa largeur, `COLONNES_X` ; depuis le 19 octobre 2026 (« une fusion entre carte et l'interface, car là le zoom est séparé »), ses escales se touchent sur place, des boutons dont la cible déborde le dessin (`.exp-point::before`) : une proposée se choisit comme sa carte, une autre s'entoure de gris, `exp-regardee` — ; l'escale où il est, seule éclairée — `exp-ici`, le départ aussi —, les escales permises entourées — `exp-a-portee` —, la touchée — `exp-choisie`, son trait doré —, le reste en retrait — `exp-plus-loin`, `exp-loin`, `exp-passee` — ; en bas le panneau collé : les escales permises en cartes, de gauche à droite, `CarteDEscale` — sa sorte, son emblème, son nom, sa chance, ses gains, `faceDeLEscale` ; un mélange, les emblèmes de ses catégories côte à côte, `exp-embleme-melange`, `categoriesDuMelange` —, la plus sûre à son ruban, `laPlusSureDesProposees`, depuis les escales permises sous Le détour ou Le raccourci ; ce que dit l'escale touchée, sur le plan ou en carte, sous les cartes — `ceQueDitLEscale`, `exp-vu`, la description courte, sans chance ni écus (`decrire` `court`) ; un mélange y nomme ses catégories (`enumerer`) — ; sa main en petit en tête, « Y aller ». Plus de feuille du plan : la légende est au « ? », « Abandonner l'expédition » au départ), l'escale (`Escale` : ce qu'un joker montre, la main sous les réponses ; ses réponses, `ReponsesDeLEscale` — effacées, montrée à l'Oracle, choisies sous Double chance, cochées), la main (`Main`, revue le 18 octobre 2026 — « ma main c'est pas ouf » : les jokers en cartes au cadre de leur rareté, `gemmeDuJoker`, la gemme de l'album, `client/src/gemmes.ts` ; posées au bas de l'écran, leur haut seul en vue ; la pioche au bout, sa feuille `FeuilleDuPaquet` ; sur la carte, en petit, `enPetit` — ; la carte levée, `JokerLeve` : en grand, ce qu'il fait, « Jouer » ou son refus, le Commandement et sa catégorie, une modale, `useModale`), la révélation (`Revelation`, `verdictDe` : ce que la réponse a coûté, lu de l'écart avec la vue d'avant), l'offre (`Offre` : un talisman parfois, et le coffre qu'on passe pour ses écus), le campement (`Campement`), l'échoppe (`Echoppe` : un article choisi puis acheté ; « Reprendre la route » la laisse sans geste, `echoppeLaissee`, et le panneau de la carte la rouvre), l'inconnu dévoilé (`Inconnu`), la barre du haut (`Barre` : le « ? » des règles, `BoutonDesRegles` et leur feuille ; les écus, les vies ; puis ce qu'il porte, d'un bloc qui passe à la ligne, `exp-sac` — les jokers posés, en rencontre les cartes posées pour toute la rencontre, `exp-posees`, qui se lèvent au toucher, les talismans en petit, les fioles), le gardien vaincu (`GardienVaincu`), le choix du légendaire (`ChoixDuLegendaire`), la fin (`FinDeLExpedition`, l'écran des gains de la campagne, `gains.test.ts`). `components/Balise.tsx` (la couleur de piste d'une chance, venue des sentiers) et `components/Vies.tsx` (les cœurs, venus de la campagne) se partagent. Sa section de `styles.css` : « L'Expédition », classes `exp-*`
- `shared/rencontres.ts` — les rencontres, pures : `RENCONTRES_EN_PRODUCTION`, ses règles chiffrées (le courage, l'inspiration, les cinq cartes de la version 5 et la main qui grandit avec les actes de la version 6 — `CARTES_DES_ACTES`, `cartesDesActes`, `cartesParQuestion` —, les mises et `PART_GAGNEE_D_UNE_MISE`, le savoir de chaque marche, les multiplicateurs des formes, les sceaux et la frappe de chaque sorte d'adversaire, ce que rendent une source, un campement, l'échoppe, ce que prend un piège, les offres et leurs raretés — celles de l'acte 1 depuis la version 6, `RARETES_DE_L_ACTE_1`, `raretesDeLOffre` ; l'épique depuis le jeu complet, `RareteDOffre`, `RARETES_DU_JEU_COMPLET`, `RARETES_DE_L_ACTE_1_DU_JEU_COMPLET` ; l'énergie de chaque acte, `ENERGIE_DES_ACTES`, `energieDesActes` — `docs/reference/baremes.md`), le catalogue (`CARTES_DES_RENCONTRES` : dix-sept neutres, quarante-huit cartes de famille — huit par famille depuis le jeu complet, `VERSION_DU_JEU_COMPLET`, chacune venue avec lui marquée `depuis` ; Panacée, `unique` —, les vingt-trois jokers des légendaires réécrits, gardant leur clé ; `carteDeRencontre`, `carteDuLegendaire`, `estDeRoute`, `cartesDeCombat`, `PAQUET_DES_RENCONTRES`, `paquetDesRencontres`), les familles (`FAMILLES_DE_CARTES`, `famillesDeLEquipee` : les légendaires de l'équipée choisissent celles des offres), les offres (`offreDeCartes`), les adversaires (`ADVERSAIRES`, `adversaireDe`), ce qu'une bonne réponse brise et ce qu'une erreur coûte (`brisesDUneBonneReponse`, `frappeDUneErreur`, `multiplicateurDeLaForme`, `enJeu`, `gainDeLaMise`, `effaceesDuTour` — `EFFACE_DES_CARTES`, `POUVOIRS_QUI_EFFACENT` —, et ce que les cartes du jeu complet y ajoutent : `siJuste`, `frappeEnPlus`, `pariPerdu`, `riposte`, `suiteDUneBonneReponse`, `enPlusDesPouvoirs`, `enPlusApresLaForme`), les cartes qui visent la question ou en changent (`viseLaQuestion`, `CHANGENT_LA_QUESTION`, `CHANGENT_DE_QUESTION`, `FORME_DE_LA_CARTE`), les fioles (`CleDeFiole`, `FIOLES`, `fioleDe`, `FIOLES_MAX`, `COURAGE_D_UNE_FIOLE`, `ENERGIE_D_UNE_FIOLE`, `CLAIRVOYANCE_SUR_LA_QUESTION`), ce qu'une carte change aux chiffres du tour et à la forme de la question (`chiffresApresLaCarte`, `formeApresLaCarte` — la seule règle : le pli l'applique, la carte levée l'annonce), pourquoi une carte ne se joue pas (`refusDeLaCarte` — la seule règle), l'annonce et l'aperçu du verdict (`AnnonceDuTour`, `apercuDuTour`), les types de la rencontre (`RencontreEnCours`, `TourDeRencontre`, `CoupDeRencontre`, `VueDeLaRencontre`). Le pli (`pliDeLExpedition`, `depart.v >= 5`) en fait l'état ; `shared/expedition.ts` y ajoute `routeDisponible`, `refusDeLaMise`, `questionDuTour`, `contexteDeLaCarte`, `refusDUneCarte`, `vueDeLaRencontre`
- `shared/codex.ts` — le codex (la version 7), pur : les exploits (`EXPLOITS`, `CleDExploit`, `exploitDe`, `PARI_DE_L_EXPLOIT`, `BONNES_D_AFFILEE` ; le pli les relève, `EtatDeLExpedition.exploits` et `affilee`, `RencontreEnCours.perdu`), le bilan d'une expédition (`BilanDUneExpedition` — ses exploits depuis la version 2 —, `VERSION_DU_BILAN`, `lireLeBilan`, `ecrireLeBilan` ; le pli le compte, `EtatDeLExpedition.bilan`, `bilanDuPli` — aux règles d'avant, une question trouvée vaut un adversaire tombé), la renommée (`RENOMMEE`, `renommeeDe`), les niveaux d'explorateur (`NIVEAUX`, `NIVEAU_MAX`, `niveauDe`, `progressionDe`), l'échelle — ce que chaque niveau ouvre, cartes, règles et dos (`ECHELLE`, `RegleDuCodex` : `pari`, `fioles`, `talismans`, `fetiche` ; `niveauDeLaRegle`, `ouvertureDe`) —, les dos de cartes (`DosDuPaquet`, `DOS_DES_CARTES`, `dosDe`, `ouvertureDuDos`, `dosOuverts` : l'étoilé à l'échelle, le doré par son exploit, `Exploit.dos`), le codex d'un départ (`CodexDuDepart`, `codexDuNiveau` : l'échelle jusqu'à son niveau, la carte de chaque exploit qu'il a fait et de chaque légendaire qu'il a, ses exploits, ses dos ; `regleOuverte`, `REGLES_D_AVANT_LE_CODEX`), les offres (`offreDuCodex` : parmi les cartes ouvertes, une famille pèse ce que le paquet en tient ; le trésor d'un gardien, `legendaire`), l'Ascension (`ASCENSION` — ses cinq crans et leur phrase —, `ASCENSION_MAX`, ses constantes — `POINTS_EN_ASCENSION`, `FRAPPE_EN_ASCENSION`, `REPOS_EN_ASCENSION`, `ENERGIE_EN_ASCENSION`, `GARDIENS_EN_ASCENSION` —, ce que chaque cran change, une seule règle pour le pli et la page : `pointsDeLAdversaire`, `frappeDeLAdversaire`, `reposALAscension`, `energieDesActesALAscension`, `energieDuTour` — l'énergie de chaque acte à son cran ; ce que les victoires ouvrent, `ascensionOuverte`, et ce qu'une victoire ouvre, `cranOuvertParLaVictoire` ; son cran au bilan, `BilanDUneExpedition.ascension`). Dans `shared/rencontres.ts`, `VERSION_DU_CODEX` et les cartes retouchées par lui (`CarteDeRencontre.avantLeCodex`, `carteALaVersion`, `ContexteDesChiffres`, `enPlusDeLaBibliotheque`). Le serveur lit la renommée, les exploits et le cran ouvert dans le lot de la page et du départ (`lecturesDeLaRenommee`, `renommeeLue`, `codexLu`, la colonne `campagne_series.bilan`) et la page les reçoit (`PageDeLExpedition.prochaine.codex` — `CodexDeLaPage.ascension` —, `CartesEnJeu.codex` — ses exploits d'alors, le cran qu'il avait ouvert, `ascensionOuverte` —, `CartesEnJeu.ascension` — le cran de l'expédition, que le pli lit par `ascensionDuDepart`, `EtatDeLExpedition.ascension` —, `VueDeLExpedition.renommee`, `VueDeLExpedition.exploits` — ceux de l'expédition)
- Le serveur des rencontres : `rencontresOuvertes`, calculées une fois par `server.ts` — l'option `rencontres` du serveur les ferme — et données aux routes comme à L'Explorateur, et les options du départ (`server/src/expedition.ts` : `rencontres`, `fetiche`, accordées là où elles s'ouvrent — partout, leur drapeau ouvert), la page qui les prend (`PageDeLExpedition.prochaine.rencontres`), le geste `voir` (sa mise, `gesteRecevable`), `questionsApresLeGeste` (Corser, Simplifier : la question reposée de la base à sa forme neuve, dans le lot du geste ; voir un dévoilement lance ses mots), le tirage d'une question à la fois (`tirerPourLExpedition` : `tiree`, `six`, `reponseEn`), la question cachée tant qu'il prépare (`vueDeLExpedition`, `repondreEnExpedition`, `devoilement`), la colonne `joker` du premier indice joué (`jokerQuiAide` — la fiole de clairvoyance aussi), le coup de la réponse (`ReponseDExpedition.coup`) ; les objets : le geste `boire` (`gesteRecevable` : la règle ouverte, sa position, `refusDeLaFiole`), la fiole d'un coffre prise ou celle de l'échoppe achetée, le dos du départ (`partirEnExpedition`, `dos` : celui demandé s'il l'a, sinon le plus rare) ; son cran de l'Ascension (`ascension` : borné à ceux qu'il a ouverts, aucun sans le demander)
- `client/src/views/RencontresDExpedition.tsx` — les pièces des rencontres, que `ExpeditionApp.tsx` assemble, revues le 18 octobre 2026 pour qui découvre (« je veux que ce soit bien compréhensible pour des novices ») : le courage dans la barre (`Courage`), l'énergie — l'inspiration du code — en orbe chiffré (`Energie`), une carte dessinée comme une vraie (`CarteDessinee`, revue le même soir — « les cartes c'est des rectangles pas très jolis » — : son cadre de rareté, l'orbe de son coût au coin, rouge s'il manque d'énergie, son illustration sur la teinte de sa famille, `TEINTE_DE_LA_FAMILLE`, son chiffre en médaillon, `CarteDeRencontre.valeur`, son nom au bandeau, la gemme de sa rareté ; trois tailles, `TailleDeCarte` : `main` — sans un mot —, `rangee` — son nom, serré s'il a un mot de onze lettres, `serre` —, `levee` — sa phrase ; son illustration peinte, `CARTES_PEINTES` — `client/src/components/cartes-peintes.ts`, écrit par `server/scripts/anime/cartes.ts`, skill `peindre` —, la grande levée, la petite ailleurs ; une carte de légendaire, son médaillon), sa main (`VisageDeLaCarte`, `MainDeRencontre` — ses cartes dessinées, sans un mot ; ce qu'elles font se dit à l'oreille (`FaceDeLaCarte`, `CarteDeRencontre.resume`) et levées ; avant la question, celles de maintenant puis, à part et éteintes, celles de pendant ; la question vue, celles-là seules ; sur la carte, en petit, `enPetit` —, `CarteLevee` — en grand, ce qu'elle fait, quand, et ce qu'elle changerait, « Avec cette carte » (`changementDeLaCarte`) ; sans `onJouer`, on ne fait que la regarder —, `FeuilleDesCartes` : chaque tas en vraies cartes qui défilent, `RangeeDeCartes` — la pioche déduite, la défausse, les épuisées, tout le paquet ; `choisie`, la carte qu'on retire au campement —, la règle du cycle), le codex (`FeuilleDuCodex`, le 18 octobre 2026 — « un codex de carte global, avec de commun à légendaire » — : toutes les cartes des rencontres en vraies cartes, une page par rareté en puces qui comptent, `onglets-puces`, ouvert de « Ton codex » au départ ; les fermées en gris, le niveau qui les ouvre dessous, `exp-codex-fermee`, et levées, `CarteLevee` `ouverture`), le niveau d'explorateur au départ (`NiveauDExplorateur`, sa jauge) et la renommée gagnée à la fin (`RenommeeGagnee` : « Tu passes au niveau N », les cartes qui rejoignent le codex, les règles qui s'ouvrent, chaque exploit neuf et ce qu'il ouvre — `exploitsNeufs`, `recompenseDe`), les exploits au pied du codex (`exp-exploits`) et dans les règles, ses dos dessous (`exp-un-dos`), le dos de la pioche sur le plan (`dosDuPaquet` — celui du départ, `CartesEnJeu.dos` —, `MainDeRencontre` `dos`, `classeDuDos` : `exp-dos-etoile`, `exp-dos-dore`) et son choix au départ (`ChoixDuDos`, dès deux dos ; retenu sur le téléphone, `dosRetenu`, `retenirLeDos`, `quizz.expedition.dos`), l'Ascension au départ (`ChoixDeLAscension`, dès une victoire : ses crans ouverts, ce que le choisi ajoute ; retenu sur le téléphone, `ascensionRetenue`, `retenirLAscension`, `quizz.expedition.ascension` — `haut` au plus haut), dans les règles (la section `ascension`, et le repos à son cran) et à la fin (`RenommeeGagnee` `ascension` : le cran que la victoire ouvre) — la page la dit aussi au titre du plan (`exp-pastille-cran`), sous « Reprendre » et en tête de la fin —, les fioles (`SesFioles` dans la barre, `FioleLevee`, `VerreDeFiole` à la teinte de chacune, `TEINTE_DE_LA_FIOLE` ; `BoireUneFiole`, posé par `aSaVersion` — nul à la révélation, où une fiole ne fait que se regarder), la version des cartes que la page montre (`VersionDesCartes`, `useCarte` : une expédition d'avant le codex les montre à ses chiffres d'alors ; `ExpeditionApp` pose la version de la vue, `aSaVersion`), l'offre en trois vraies cartes côte à côte (`CartesAPrendre` : la phrase de la touchée dessous, rien avant), l'adversaire (`Adversaire` : ses points en jauge, la question qu'il pose sans son texte ; compact la question sous les yeux), ce que la réponse fera (`Apercu` : deux tuiles, « Si tu as juste », « Si tu te trompes », refaites à la mise et à la carte levée par `apercuALaMise`), la préparation entière (`PreparationDeLaRencontre` : l'adversaire, l'aperçu, la main, le pari, « Voir la question » ; à la première, les règles en feuille, retenues sur le téléphone, `quizz.expedition.guide-rencontres`), les règles (`FeuilleDesRegles` — en rencontres, `reglesDesRencontres`, ce que tire chaque acte lu de la vue ; aux règles d'avant, `reglesDesJokers` ; `debut`, la section à lire d'abord — et `BoutonDesRegles`, le « ? » du haut de chaque page), la révélation (`verdictDeLaRencontre`), le départ (`FeticheDuDepart` — sa catégorie fétiche, une fois son niveau atteint, retenue sur le téléphone, `quizz.expedition.fetiche` ; plus d'interrupteur depuis le 19 octobre 2026 : `quizz.expedition.rencontres` n'est plus lu —, `FeuilleDeLaFetiche`), les cartes dépliées de l'équipe (`ToutesLesCartes`), la ligne d'une carte à l'échoppe (`LigneDeCarte`). Sa section de `styles.css` suit celle de l'expédition (« Les rencontres »)
- `server/scripts/rendu-rencontres.ts` (client construit d'abord) · `server/scripts/calibrage-rencontres.ts` (`--expeditions`, `--cas`, `--version` — la 8 d'office, le jeu complet —, `--niveau`, `--sans-fioles`, `--sans-ameliorations` — le même joueur, qui n'améliore rien lui-même —, `--ascension`, `--ascensions` : chaque cran au codex entier ; `--seule`, `--cartes`, `--part` : chaque carte seule contre rien) — les écrans des rencontres en 360 × 640, d'un départ à la fin — au codex, un débutant au niveau 1 et Léa au niveau 6, le trésor d'un gardien, ses fioles, ses dos, la renommée de la fin — ; la chance d'aller au bout, la durée, les écus et la renommée de trois joueurs simulés, niveau par niveau d'explorateur, puis leur carrière du niveau 1, expédition après expédition (`PREFERENCE_DU_CODEX` : le joueur qui a appris ne prend que ce qui vaut). `expedition-rencontres.test.ts` (les règles et le pli) · `expedition-rencontres-routes.test.ts` (par les routes : le départ, la question cachée en préparation, la mise, le verdict, la victoire, le dévoilement, Corser, Simplifier ; une fiole achetée puis bue, sa réponse effacée et la colonne `joker`) · `expedition-rencontres-ecran.test.ts` (l'écran, rendu : ni sceaux, ni Charge, ni Garde, ni inspiration ; chaque résumé et chaque chiffre tiennent sur leur carte ; la carte levée annonce ce que le serveur fait ; la préparation dans l'ordre où l'on joue, la main sans un mot ; les règles à la première, et ce que tire chaque acte ; l'aperçu ; la main de pendant la question ; les cartes posées en haut, à côté du « ? » ; l'énergie et le coût au coin des cartes ; les tas en rangées de vraies cartes ; l'offre en trois cartes, rien dessous avant le toucher ; la carte à retirer au campement ; le codex, ses puces et ses cartes ; « le plan », jamais « la carte » de l'acte, dans tout ce que lit le joueur ; les fioles dans la barre et levées, leurs règles ; la barre qui passe à la ligne, ce qu'il porte d'un bloc ; les dos au codex, à la fin et au départ ; l'Ascension au départ — ses crans, le retenu —, dans les règles, à la fin) · `expedition-partir.test.ts` (« ← Partir » mène au départ, qui garde l'expédition en route ; de là, elle s'abandonne ; un débutant n'y choisit pas de légendaires ; « Ton équipe », sa feuille comprise ; le départ sans paragraphes, les gardiens côte à côte, les règles au « ? » ; « Ton codex » aux rencontres ; l'Ascension, rien avant une victoire, aucun cran d'office) · `cartes-peintes.test.ts` (chaque carte sans légendaire a sa peinture, en deux tailles sous empreinte, d'un poids qu'un téléphone porte ; aucun fichier que plus personne ne cite ; la carte dessinée la montre ; `/cartes` servi un an)
- La voie : `shared/legendaires.ts` (`avecLExpedition`, `cleDeLExpedition`, `estUneVoieDExpedition`, `legendaireDeLExpedition`, `voiesMontrees`) — chaque légendaire qui a son joker se gagne aussi en le gardant au bout — ceux de saison à leur saison seulement, le 18 octobre 2026 — (une voie `aussi`, la ligne `expedition:<clé>` de `profile_badges`, rangée sous `#campagne:<série>`, comme une saison) ; l'album lui donne son lieu (`shared/album.ts`, `expedition` ; `ouIlSeGagne` se dit voie par voie), les pistes et « le plus proche » l'écartent (`shared/pistes.ts`, `shared/proches.ts`), l'étagère et le compte des badges aussi (`ProfileStore.etagereDe`, `badges`)
- `server/scripts/rendu-expedition.ts` (client construit d'abord ; `ivoire` en argument : six légendaires rangés sur le profil, le Dragon d'Or en invité du jour par `horlogeDuJour`, puis l'horloge à Halloween et `calendrierDesExpeditions` rouvert pour la cinquième) · `server/scripts/calibrage-expedition.ts` (`--expeditions`, deux mille par défaut ; `--garder`, le joueur qui garde ses jokers rares et légendaires pour le gardien) — tous les écrans en 360 × 640, chaque joker qui passe compris ; la chance d'aller au bout de trois joueurs simulés, sur le vrai générateur et le vrai pli, sans jokers, avec le paquet de départ, avec deux équipées
- Les tests : `expedition.test.ts` (les routes de bout en bout, la source, les gardiens qu'il a, l'ouverture en production), `expedition-carte.test.ts` (le générateur, les chances, le tracé), `expedition-carte-ecran.test.ts` (l'écran de la carte, rendu : une seule escale éclairée sur l'acte en petit, ses escales des boutons qui se disent à l'oreille, sans feuille où l'ouvrir en grand, les escales permises seules en cartes, de gauche à droite, la plus sûre à son ruban, ce que chaque carte rapporte, un mélange et ses emblèmes, la ligne de l'escale touchée, le gardien choisi d'office au campement ; la main en cartes au cadre de leur rareté, en petit sur la carte, les posés dans la barre ; la carte levée, son geste ou son refus), `expedition-question-ecran.test.ts` (une question à l'écran : les deux réponses de Double chance cochées, leur filet tenu sous le survol collé du téléphone), `expedition-pli.test.ts` (le pli), `expedition-legendaires.test.ts` (la voie, les jokers, la voie montrée), `expedition-jokers.test.ts` (chaque joker dans le pli : la main, la défausse, les posés, les offres, le campement, l'équipée), `expedition-mesure.test.ts` (par les routes : l'équipée et l'invité, ce qu'un joker montre sans la bonne réponse, la colonne `joker`, la mesure, la précision, le carnet, Échange et Passe-muraille, aucun joker hors de l'expédition), `expedition-charge.test.ts` (les allers-retours de chaque geste, comptés ; ce qu'il a vu relu après une réponse ailleurs ; une écriture ratée oubliée), `expedition-tirage.test.ts` (le tirage d'une escale : ce qu'il lit, ses règles), `expedition-formes.test.ts` (six choix, vrai ou faux, le dévoilement et sa route, Arrêt sur image, ce qu'une autre forme ne mesure pas, les offres d'avant), `expedition-ecus.test.ts` (les écus dans le pli : les pistes, le dévoilement, l'élite, le gardien, le coffre passé, Quitte ou double, l'échoppe, les talismans, l'inconnu, la lanterne et la boule, une expédition d'avant les écus), `expedition-echoppe.test.ts` (par les routes : les écus qui meurent avec l'expédition, l'échoppe et ses refus, l'inconnu caché jusqu'à son dévoilement, le piège qui finit d'un geste, la loupe), `expedition-themes.test.ts` (sur la vraie base : les thèmes pointus d'une carte, jamais une rubrique ni une époque remplacée), `expedition-passeport.test.ts` (le tampon d'un thème pointu trouvé, la carte qui signale les autres, le Globe-trotter), `expedition-saison.test.ts` (la fête sur les cartes, son légendaire à l'acte 3, le calendrier rouvert), `codex.test.ts` (l'échelle et les exploits, la renommée et les niveaux, le codex d'un niveau et ses règles, les offres et le poids des familles, les cartes retouchées à leur version, le pli au niveau 1 — ni pari, ni talisman —, le trésor d'un gardien, le bilan ; chaque exploit dans le pli — vingt d'affilée et le gardien de l'acte 3 intact de trois actes sans faute, l'erreur qui les coûte, le pari de 40, l'élite tombée d'une seule réponse et pas un adversaire ordinaire, les règles d'avant ; les fioles — leur règle au niveau 3, celle d'un coffre, l'échoppe et les deux places, chaque effet — et les dos ; l'Ascension — les crans que les victoires ouvrent, ce que chacun durcit dans le pli, une expédition d'avant qui l'ignore), `expedition-codex.test.ts` (par les routes : le bilan écrit à chaque fin, abandon compris ; la renommée relue des bilans, le codex figé au départ ; les bilans absents, illisibles ou d'une autre version — la 1 comprise — refaits une fois ; les exploits relus, leur carte ouverte, figés au départ ; la carte des légendaires qu'il a, l'invité seul en équipe ; le dos du départ ; le cran ouvert par une victoire, borné et figé au départ, gardé par le bilan), `expedition-jeu-complet.test.ts` (le jeu complet : l'énergie de chaque acte, les offres et leurs épiques, une expédition d'avant qui n'en tire aucune ; chaque carte neuve levée puis jouée — sa promesse tenue par le pli —, ses chiffres et ses refus ; ce qui tient toute la rencontre, ce qu'une bonne réponse laisse à la suivante, les formes, les indices, les écus et le courage des cartes ; la gemme de l'épique et celle de la maudite, l'aperçu, les règles) · `expedition-ameliorations.test.ts` (les cartes améliorées : le catalogue des soixante et une et ce que chacune gagne, aucune qui fasse moins que sa carte, chacune levée puis jouée — sa promesse tenue par le pli —, ses refus, le campement et l'échoppe, les offres des actes 2 et 3 et leur fil, une version 7 qui n'en améliore aucune, la garde des clés cherchées seules, le « + » à l'écran, avant et après, les règles) · `expedition-journal.ts` (pas un fichier de tests : le journal écrit comme le serveur et les plans faits à la main — la forge, un campement avant l'élite —, et les pièces de la page rendues, que les deux précédents partagent)

## Les pièges

- **Rien ne s'écrit que le départ, les gestes et les réponses** (invariant
  14) : l'état — les vies, la main, le paquet, la défausse, les posés, l'offre
  — se replie à chaque lecture (`pliDeLExpedition`), le même pli pour
  l'expédition qu'on joue et pour une finie. Les colonnes `position`, `vies`
  et `justes` de sa série ne sont qu'un reflet pour les lectures de la
  campagne : ne les relis jamais pour jouer. Une question attend sa réponse :
  seuls l'abandon et un joker qui la vise passent, un autre geste ne se joue
  pas par-dessus.
- **Un geste dit le rang qu'il croit suivre** (invariant 12, porté au
  solo) : `VueDeLExpedition.rang` compte les gestes faits, le suivant porte
  ce rang plus un ; une réponse, le rang de sa question (`enAttente`, ou
  l'autre de Deux visages). Un double toucher, un second onglet sont
  refusés, et rien ne bouge.
- **Un joker joué sur une question porte sa position** : le pli juge la
  question qui attend avant tout geste qui ne la vise pas (`vise`) — sans
  elle, un joker posé juste après une réponse se serait compté avant elle
  (L'aube, une erreur faite avant d'être posée). Passe-muraille écrit la
  réponse traversée dans le lot de son geste. Et le pli ne juge que jusqu'à
  la question que le geste vise (`jugerTout(g)`) : jugées d'un coup, les
  questions répondues du gardien passaient toutes avant le joker joué sur la
  deuxième, qui revenait dans la main au repli — Tout ou rien n'y coûtait
  qu'une vie (le 18 octobre 2026, `expedition-jokers.test.ts`).
- **Le hasard vient de la graine et du rang du tirage** : la pioche
  (`graine:pioche:n`), les offres (`graine:offre:n`), la maison qu'on ouvre,
  les réponses effacées (`graine:efface:position`). Recharger ne retire rien ;
  un tirage de plus décale les suivants — `tirages` et `offres` se comptent
  dans le pli, jamais à côté.
- **Pourquoi un joker ne se joue pas, une seule règle** (`refusDuJoker`) :
  le pli l'applique, le serveur la renvoie en refus, la vue la porte pour
  chaque joker de la main (`JokersEnJeu.refus`), et la page n'en recopie
  rien. Une condition neuve s'y ajoute, nulle part ailleurs.
- **Ce qu'un joker montre se calcule dans la vue, au serveur** (invariant
  1) : les réponses effacées, l'indice, l'Oracle lisent la bonne réponse.
  Jamais plus de deux réponses effacées sur quatre ; aucune sur un vrai ou
  faux, ni Double chance, ni la Prédiction ailleurs que sur une année ou un
  nombre (`QuestionPosee.nombre`).
- **Une réponse aidée ne mesure rien** : `campagne_reponses.joker` porte la
  clé de son joker (`JOKERS_QUI_AIDENT`) ; la mesure des difficultés, le
  modèle du savoir, les écussons, la précision et L'Érudit ne lisent que
  les réponses nues (`REPONSE_NUE`, `PREMIERE_REPONSE` nulle quand la
  première était aidée), et une bonne réponse aidée ne retrouve rien au
  carnet — une erreur aidée y entre. Échange et La mue posent une autre
  question, nue. Une lecture neuve de `campagne_reponses` qui mesure un
  savoir écarte les réponses aidées.
- **Les cartes et leurs chances se figent au départ.** Une retouche du
  générateur, des marches ou du modèle du savoir ne vaut que pour les
  expéditions qui commencent : elle ne déplace pas une escale sous les pieds
  de qui joue. Un champ neuf de `DepartDExpedition` se lit absent dans les
  anciens — ou monte `v` ; une expédition de la version 1 n'a pas de jokers,
  et son campement rend sa vie d'office (`lireDepartDExpedition` lit les
  deux).
- **Un thème pointu est un sujet de l'onglet des thèmes** (`SUJETS`), jamais
  ce que compte `sujetsComptes` : depuis la refonte des sujets du 17 octobre
  2026, il compte aussi les rubriques — chaque sous-thème, « sport/football »
  — et les époques remplacées. Une rubrique n'est qu'un morceau de sa
  catégorie, à son emblème : la carte la ferait passer pour une escale de la
  catégorie, payée double ; une époque remplacée ne se propose plus nulle
  part (`partirEnExpedition`, `expedition-themes.test.ts`). Un sujet ajouté
  à `SUJETS` arrive de lui-même sur les cartes, avec son icône
  (`iconeDuSujet`).
- **Les chances viennent du modèle du savoir, au départ** (le chemin de la
  chance d'une épreuve : `forceSurLesSentiers`, `chanceSurLaMarche`, sur
  ses premières réponses). Sous vingt premières réponses, ou sans modèle,
  celles d'un joueur moyen (`TAUX_DU_CALIBRAGE`), et la page le dit
  (`moyen`). Une source se lit sur toutes les catégories (−1) : sa question
  n'est choisie qu'en y marchant. Le Commandement relit la chance d'une
  escale dans `chances`, gardées au départ : pas un appel au modèle de plus.
  Elles y sont à quatre choix : l'escale garde sa forme, et sa chance s'y
  ramène (`chanceSelonLaForme`) — lue telle quelle, un vrai ou faux
  commandé annonçait sa chance à quatre choix.
  Sous L'écholocation, la carte ne dit plus aucune chance — ni la page, ni
  son panneau.
- **Une source repose une erreur du carnet**, la plus en retard d'abord,
  sinon une facile. Sa question porte `carnet: true` : comme une révision,
  ni la mesure des difficultés, ni la précision et les écussons
  (`savoirDe`), ni L'Érudit, ni les catégories des missions ne comptent sa
  réponse, déjà lue (`HORS_DU_CARNET`, et le filtre de `mesuresBrutes`) ;
  l'expérience, les confettis, Le Marathonien et le carnet, si.
- **L'expédition en route vit en mémoire** (`expeditions`, le 17 octobre
  2026 : une escale coûtait trois allers-retours de suite, une réponse deux
  ou trois). Un geste la prend là (`expeditionAJouer`), sinon la relit, et
  la garde après son écriture (`garderLExpedition`) ; une écriture ratée
  l'oublie (`ecrireLExpedition`) — écrite ou non, on ne le sait pas, et la
  base fait foi —, comme une expédition finie et un profil supprimé. Une
  écriture neuve de l'expédition passe par `ecrireLExpedition`, puis garde
  ou oublie ce qu'elle a écrit : laissée en mémoire telle qu'avant,
  l'expédition rejouerait un geste au rang déjà pris. Ce qu'il a vu se garde
  avec elle (`ExpeditionGardee.vues`), lu dans le lot du départ ; une
  réponse écrite ailleurs dans la campagne — la série et ses modes,
  l'épreuve, le parcours — l'oublie (`vuAilleurs`). Une porte neuve qui
  écrit une réponse de campagne l'appelle aussi, ou l'expédition pourrait
  reposer, comme jamais vue, la question qu'il vient de voir.
  `expedition-charge.test.ts` compte : partir, deux allers-retours ; une
  escale, un geste, une mauvaise réponse, un ; une bonne, deux.
- **Le tirage d'une escale ne bat pas son tas** (`tirerPourUneEscale`) : il
  le lit dans un ordre tiré à mesure (`OrdreParesseux`) et s'arrête à la
  première question qui ne peut être battue — jamais vue, d'un sous-thème
  encore à servir, sans jumelle. Le battage entier d'une épreuve
  (`tirerUneEpreuve`) coûtait 15 ms au gardien, sur les vingt-cinq mille de
  la base ; 0,1 ms ainsi. Ses rangs sont ceux d'une épreuve, plus les
  jumelles de ce que l'expédition a posé (`posees`). Un rang neuf qui
  n'atteint presque jamais zéro — le sous-thème servi dans toute
  l'expédition, par exemple — ferait relire tout le tas à chaque escale.
  `expedition-tirage.test.ts` compte ce qu'il lit.
- **Le gardien tire ses questions d'avance** (`questionsDuGardien` : de
  quoi aller au bout de ses vies, sans vrai ou faux) ; vaincu, ses
  questions de reste ne se posent pas — le pli les saute. Une vie rendue en
  plein combat — Le réveil, La boucle, Remonter des abysses — en fait tirer
  une de plus : le pli la demande (`aTirer`).
- **Garder un gardien range le légendaire avant de clore** : un rangement
  qui échoue laisse l'expédition au bout, et le geste se rejoue. Un gardien
  qu'il a déjà se garde aussi — gagné ailleurs en route, ou tiré faute
  d'autres (`gardiensDe`) — et ne rapporte que l'expérience de ses
  réponses : le départ et l'en-tête le disent (`aLui`).
- **Un légendaire de saison ne garde qu'à sa saison** (le 18 octobre 2026) :
  jamais tiré parmi les gardiens (`gardiensDe` les écarte), il ne prend
  l'acte 3 que d'une expédition partie à sa saison — `deSaison`, de
  `saisonDuDepart` —, s'il ne l'a pas et s'il n'est pas l'invité du jour. Sa
  voie est celle de tous (`expedition:<clé>`) : vingt-trois légendaires
  l'ont, et la sienne ne s'ouvre qu'à sa saison. Partie à temps,
  l'expédition se finit quand il veut : la saison se lit au départ, jamais à
  la fin. Son joker, lui, s'emmène et peut être l'invité du jour.
- **La saison se lit à `calendrierDesExpeditions`**, jamais à `periodeDu`
  directement : le banc et le smoke le ferment, comme celui des soirées —
  sans quoi, du 25 octobre au 1er novembre, chaque test d'expédition aurait
  sa Citrouille à l'acte 3 ; `expedition-saison.test.ts` le rouvre. La fête
  ne passe au générateur que si une carte peut la tirer (`sujets`), et sans
  fête, `carteDUnActe` ne tire rien de plus : une graine hors saison redonne
  la carte d'avant.
- **Le passeport se relit du journal** : la réponse d'une question tirée du
  tas d'un thème pointu écrit son thème (`campagne_reponses.sujet`, gardé
  par la question à son tirage, `QuestionDeSerie.sujet`) ; ni le
  Commandement, ni le tirage de secours dans toute la base, ni la question
  que La boucle repose n'en portent. `lectureDuPasseport` rejoint le lot qui
  lit déjà — l'expédition (`lireLExpedition`), la page, le départ, les
  paliers (`statsDe`) — : pas un aller-retour de plus ; l'expédition gardée
  tient ses tampons (`ExpeditionLue.tampons`), et une réponse qui en gagne un
  l'y ajoute. La carte gardée n'en sait rien : la vue pose `aTamponner`.
- **Le drapeau ouvre tout d'un coup** (`EXPEDITION_EN_PRODUCTION`) : les
  routes en production (`expeditionOuverte`), le bouton de l'accueil, la voie
  dans l'album (`voiesMontrees`). Repassé à `false`, tout se referme, et
  `legendairesDebloques` lit toujours toutes les voies — un légendaire gardé
  le reste. L'album dit ses voies une par une (`ouIlSeGagne`) : un seul mot
  pour tous ses lieux faisait de la Chimère un légendaire « en soirée, au
  quiz du jour, en campagne ou en expédition ».
  Pour la garder à quelques testeurs sans toucher au code, le QG l'annonce
  pour bientôt (`/admin#maintenance`, le souhait du propriétaire du
  19 octobre 2026, règle `qg.md`) : sa page et `POST /api/expedition`
  fermés à tous sauf à ses testeurs et à l'administrateur, son bouton de
  l'accueil éteint sur « Bientôt disponible » — le drapeau, lui, reste
  ouvert. La voie de l'album ne se referme pas avec : elle dit d'où vient un
  légendaire, pas ce qu'on peut jouer ce soir.
- **Les escales de la carte portent la classe de leur sorte**
  (`exp-question`, `exp-elite`, `exp-source`, `exp-coffre`,
  `exp-campement`, `exp-gardien`) : une règle CSS de ce nom, faite pour
  autre chose, les habille aussi — celle du paragraphe d'une source rendait
  ses escales carrées et décalées (`exp-regle`). Un style d'escale s'écrit
  `.exp-escale.exp-<sorte>` en grand, `.exp-point.exp-<sorte>` sur l'acte
  en petit, `.exp-carte-escale.exp-<sorte>` sur sa carte ; l'écran du
  campement s'appelle `exp-camper`. Une classe d'état de la carte aussi :
  `exp-proposee` est la réponse proposée d'un vrai ou faux, et sa règle
  faisait des escales proposées des cartes carrées (le 18 octobre 2026) —
  elles portent `exp-a-portee`.
- **Seule l'escale où il est s'éclaire** (le 18 octobre 2026, « uniquement
  illuminer la node sur laquelle on est et pas tout le chemin ») : la carte
  ne dessine plus le tracé le plus sûr — dix escales et leurs liens dorés,
  où celle où l'on était se perdait. Les escales permises sont entourées ;
  le reste attend en retrait, sans nom ni chance ; la plus sûre ne se dit
  que sur sa carte, à son ruban (`laPlusSureDesProposees`). Un état neuf sur
  la carte ne remplit ni ne dore une escale : le plein, c'est « tu es
  ici » ; l'anneau doré, celle qu'il a touchée — sur le plan comme sur sa
  carte. `expedition-carte-ecran.test.ts` rend l'écran.
- **L'écran de la carte tient en un écran** (le même jour, « de vrais
  cartes en bas ») : l'acte en petit prend ce que le panneau lui laisse
  (`flex`, au moins 180 pixels — 170 jusqu'au 19 octobre 2026, où deux
  étages de points de dix-huit pixels se chevauchaient), ses escales en pour cent de sa hauteur
  (`EN_PETIT`) — rien ne défile, et la page n'a plus à se faire défiler
  jusqu'à l'escale où il est. Ce qui grandit le panneau rapetisse l'acte :
  posée au bas du panneau, la main lui prenait 90 pixels et le panneau,
  collé, en couvrait le bas — elle vit en petit en tête du panneau ; quatre
  cartes gardent leur nom sur une ligne parce que le panneau va de bord à
  bord. Une ligne de plus dans le panneau se regarde en 360 × 640, au
  départ (quatre cartes) et au campement (la règle du gardien) : la ligne de
  l'escale touchée (`exp-vu`) en garde deux, trois au plus, pour que le plan
  ne saute pas d'un toucher à l'autre. Rien ne défile : le plan ne s'ouvre
  plus en grand dans une feuille (le 19 octobre 2026), ses escales se
  touchent sur place — une rangée d'escales fait une vingtaine de pixels en
  360 × 640, leur cible déborde de côté, où les voisines sont à quatre-vingts.
- **Une carte qui passe sur le voile est opaque** : levée, une carte de
  joker se pose sur `.carte-voile`, et les surfaces des thèmes sont
  translucides (`--surface-strong`) — sous Ivoire, la carte et son refus
  devenaient gris, l'encre ne s'y lisait plus. Elles se posent sur
  `--bg-raised` (`linear-gradient(var(--surface-strong), …), var(--bg-raised)`).
- **Ce qui est choisi tient sous le doigt** : le téléphone garde le survol
  de la dernière réponse touchée, et `.ans-btn:not(:disabled):hover`
  repeint son filet — sous Double chance, on ne voyait plus la seconde
  réponse choisie (« on ne voit pas les réponses que l'on choisit », le
  18 octobre 2026). Un état choisi couvre aussi `:hover`, et porte sa
  coche : un fond à peine doré ne se voit pas.
- **La main ne colle pas par-dessus la question** : collée au bas de
  l'écran, elle couvrait la quatrième réponse sous une question de gardien
  trop longue. Elle reste au bout de la page, ses cartes coupées au bord ;
  si la page défile, la main avec.
- **Une rareté a une couleur dans toute l'application** : celle de l'album
  et de la boutique (`gemme`, `client/src/gemmes.ts`), posée en `--gemme`
  sur le cadre d'une carte de joker, de son visage dans une offre ou à
  l'échoppe, d'un joker posé dans la barre, d'une carte des rencontres
  (`gemmeDuJoker`, `gemmeDeLaCarte`). Pas de couleur de rareté à part — sauf
  la maudite : elle prenait le pourpre de l'épique tant que les cartes n'en
  avaient pas ; depuis le jeu complet, une maudite qui ressemblerait à une
  épique se prendrait pour une récompense, et elle a son rouge
  (`GEMME_MAUDITE`, `expedition-jeu-complet.test.ts`).
- **Les jokers ne sortent jamais de l'expédition** (invariant 8) : ni
  soirée, ni quiz du jour, ni défi, ni duel — `expedition-mesure.test.ts`
  relit leurs routes. Un Divin n'en a aucun (invariant 21).
- **Le QG ne la lit pas encore à part** : sa page de la campagne ignore le
  mode (`sousModeDe` le rend nul), la vue d'ensemble et « L'activité » la
  comptent en campagne (`modeDeLaSerie`). « L'activité » compte ses
  réponses, pas sa `position` (`seriesDepuis`) : la position saute les
  questions de reste d'un gardien vaincu, tirées d'avance et jamais posées —
  six de trop pour une expédition sans faute. Une lecture neuve de ses
  questions jouées fait de même.
- **Une forme se pose au tirage, et la question la garde** (`aSaForme`,
  l'étape 3) : ses réponses et sa bonne sont celles de la forme — six
  choix, deux leurres de `meta.leurres` qui ne redisent aucune réponse ; un
  vrai ou faux, « Vrai », « Faux » et `proposee` ; un dévoilement,
  `devoileLe`. Une forme qu'aucune question du thème ne prend se pose à
  quatre choix, et une question née vrai ou faux telle qu'elle est écrite :
  sa forme vide. Une réponse porte la forme de sa question
  (`campagne_reponses.forme`), que `REPONSE_NUE`, la mesure et
  `PREMIERE_REPONSE` écartent ; le carnet n'écarte que la bonne réponse
  d'un vrai ou faux tiré d'une autre. **Une comparaison à une forme se fait
  sans NULL** : `forme = 'vrai-faux'`, vide, rendait NULL tout le filtre du
  carnet, et chaque bonne réponse nue en sortait — `COALESCE`, ou `IS`.
  Ce qui relit une question jouée pour la comparer à la base la lit à sa
  forme (`memeVersion`, `lireLaVersionJouee`, la correction et `proposee`) :
  sinon chaque signalement d'une autre forme passerait pour une version
  d'avant.
- **Un dévoilement ne part jamais entier** (invariant 1) : la vue ne porte
  que son compte de mots (`devoilement.mots`, `texte` vide), et ses mots
  partent par leur route, chacun à son heure — celle du serveur
  (invariant 6) : le premier dès son tirage, puis un tous les `MS_PAR_MOT`.
  La route relit à chaque mot l'heure d'Arrêt sur image dans l'expédition
  gardée (`arretLe`) : joué en route, il arrête aussi les mots qui partent
  déjà. Elle ne se compresse pas et ne se minute pas — `Cache-Control:
  no-transform`, `res.locals.auFilDuTemps` : `compression()` garderait les
  mots jusqu'au dernier, et le minutage des routes la prendrait pour une
  attente. La réponse lit les mots dits à l'heure où elle arrive
  (`devoile`), jamais une heure du téléphone. Deux visages ne s'y joue pas,
  Arrêt sur image ne se joue que là (`refusDuJoker`).
- **Un joker de plus au catalogue des offres change les offres rejouées.**
  Une offre se tire de la graine parmi les jokers sans légendaire : en
  ajouter un aurait changé celles d'une expédition partie avant, et le
  joker qu'elle y a pris. Un joker neuf des offres dit la version du départ
  qui le connaît (`Joker.depuis`, `offreDeJokers(…, v)`) — Arrêt sur image,
  la 3 ; Quitte ou double, la 4 —, et le départ monte sa version
  (`DepartDExpedition.v`). Tout ce qui est venu avec les écus — l'échoppe et
  l'inconnu sur la carte, les talismans des offres, les écus eux-mêmes — ne
  joue que pour un départ en version 4 : une expédition d'avant se rejoue
  telle qu'elle s'est jouée.
- **Les écus ne s'écrivent nulle part** (l'étape 4) : le pli les compte à
  chaque lecture, des réponses et des gestes. Ceux d'un dévoilement se lisent
  au mot où sa réponse est arrivée — `repondue_le`, relu avec les réponses
  (`ExpeditionLue.reponduesLe`, `devoileA`), jamais une heure du téléphone.
  Un achat garde le prix payé dans son geste (`prix`) : un barème changé ne
  refait pas un achat. Ils meurent avec l'expédition : ni confetti, ni
  expérience, ni rien au profil — `expedition-echoppe.test.ts` relit le solde.
- **Ce que cache l'inconnu ne part jamais avant d'être dévoilé** (invariant
  1) : il se tire de la graine et de l'escale (`contenuDeLInconnu`), que le
  serveur seul connaît ; la carte gardée ne le porte jamais (`contenu`), la
  vue le pose — la boussole, toute la carte ; la lanterne, ses pièges ; et
  l'inconnu où il est passé. Le tracé le plus sûr y compte un piège sur
  trois.
- **Un piège peut finir l'expédition d'un geste** : `gesteDExpedition` la
  clôt alors comme une réponse — `finie_le`, `issue`, les récompenses, la
  forme du compagnon —, et la page montre le piège, puis la fin. Renaissance
  posée le relève, comme d'une erreur.
- **Un légendaire de passage s'en va avec l'acte** (`passages`) : son joker
  va dans la main, même pleine, et quitte la main, le paquet ou la défausse
  au gardien vaincu — joué ou non. Le gardien du même légendaire, lui, reste.
  Retiré — au campement, à l'échoppe —, c'est celui de passage qui part
  (`retirer`) : sinon l'acte prenait encore le même, glissé par un gardien.
- **L'échoppe ne retient pas** : rien ne la ferme que le pas suivant. La
  page la laisse sans geste (« Reprendre la route », gardée par l'acte et
  l'escale) : un geste de plus pour la fermer coûterait un aller-retour à
  chaque échoppe.
- **« ← Partir » mène au départ, pas à l'expédition** (`ecranDeLaPage`,
  `enPartant`) : la page relue s'ouvre, à l'arrivée, sur l'expédition en
  route ; partir la relisait de même, et la rouvrait sur l'écran même qu'on
  quittait — de l'étape 1 au 18 octobre 2026, on n'en sortait que par le
  navigateur (« Je ne peux pas partir de l'expédition »). Le départ la garde,
  avec « Reprendre » — et, dessous, « Abandonner cette expédition », confirmé
  (« J'aimerais pouvoir abandonner une expédition » : le geste ne vivait
  qu'au fond de la feuille de la carte) —, et « ← Accueil » quitte la page
  (`expedition-partir.test.ts` ; `rendu-rencontres.ts` part et reprend).
- **Un débutant ne choisit pas de légendaires au départ** : sans légendaire
  à lui (`equipables` vide), l'équipe n'est que l'invité du jour — une
  ligne le dit, `exp-invite-seul`, à la place de deux places dont une libre.
  « C'est pas clair de devoir mettre des légendaires sur la première page,
  surtout qu'au début on n'a pas forcément ça » (le 18 octobre 2026). Aux
  rencontres, depuis le codex, personne ne choisit plus d'équipe : le
  serveur pose l'invité du jour (`equipee: [invite]`), et ce que la page
  envoie ne compte plus — `refusDeLEquipee` ne lit que les départs aux
  jokers. Les légendaires qu'il a ouvrent leur carte au codex, que le
  trésor d'un gardien propose.
- **Les pages ne disent plus leurs règles : le « ? » du haut les dit**
  (la revue du 18 octobre 2026 : « Trop d'infos écrites sur la page on s'y
  perd […] il faudrait juste un onglet règles qu'on peut consulter de
  n'importe quelle page »). Le départ ne dit plus ce que fait un gardien,
  combien dure une expédition, d'où viennent les tampons ni les familles ;
  la carte, à qui sont les chances ; le campement, pourquoi retirer une
  carte ; l'offre, ce que devient la carte prise — en rencontres ; aux règles
  d'avant, la carte et le campement gardent leurs lignes. Tout est dans
  `FeuilleDesRegles`, ouverte d'elle-même à la première rencontre, puis au
  « ? » de la barre et du départ (`BoutonDesRegles`). Une règle neuve
  s'écrit là, une ligne, pas en paragraphe sur sa page. La garde du jargon
  (`expedition-rencontres-ecran.test.ts`) lit les règles : « garde », même
  en minuscule et en verbe, y passe pour l'ancienne Garde — « ← Partir »
  « ne perd rien », il ne « garde » pas ta place.
- **La main ne dit pas un mot** (la même revue : « trop de détails écrits
  en dessous de chaque icône, ne pas les mettre direct mais les faire
  apparaître si on clique dessus ») : une carte de la main n'a que son
  dessin, son coût et son chiffre (`CarteDeRencontre.valeur` — « +4 »,
  « 5 », « ×2 » ; rien quand le dessin suffit) ; dans une rangée, son nom en
  plus ; sa phrase, levée. Son résumé (`resume`) se dit à l'oreille. Les
  cartes posées pour toute la rencontre ne se disent plus sous la main : en
  haut, dans la barre, comme les talismans (`exp-posees`), et touchées,
  elles se lèvent.
- **La version 6 change ce que le pli tire** (la même revue : « peut-être
  qu'on en a trop au début, mettre des basiques seulement et obtenir des
  rares plus tard ») : la main grandit avec les actes (`CARTES_DES_ACTES`),
  l'acte 1 n'offre ni rare après une rencontre ni maudite
  (`raretesDeLOffre`, `offreDeCartes` `stricte`), et les cartes d'un départ
  en rencontres ont plus d'adversaires (`POIDS_DES_ESCALES_DES_RENCONTRES`).
  Un réglage qui change ce qu'une expédition tire monte la version du
  départ : rejouée à la règle neuve, une expédition partie avant changerait
  de main sous les pieds de qui joue. Mesuré (`calibrage-rencontres.ts
  --version`) : la main plus courte seule ne change presque rien — l'énergie
  bornait déjà ce qu'on joue —, les adversaires de plus ramènent le moyen
  à une fois sur trois et le fort à huit sur dix, la cible du brief.
- **En rencontre, la question se tire mais ne part pas tant qu'il prépare**
  (invariant 1) : tirée au lot du pas — le pli la demande —, elle reste au
  serveur ; la vue n'en porte que l'annonce et son rang
  (`VueDeLaRencontre.position`), et la réponse comme la route du
  dévoilement la refusent avant `voir`. Son dévoilement ne court qu'une fois
  vue : `questionsApresLeGeste` repose son heure au geste `voir`
  (invariant 6) — tirée en préparation, ses premiers mots seraient partis
  pendant qu'il choisissait ses cartes.
- **Corser et Simplifier reposent la question au serveur**, de sa question
  de la base (`aSaForme`), dans le lot du geste ; la bonne réponse reste
  celle de la base. La règle des cartes lit la forme du tirage
  (`QuestionPosee.tiree`), jamais celle d'à présent : rejouée, la question
  déjà simplifiée refuserait Simplifier qui l'a faite, et le pli divergerait.
- **La page ne recopie aucune règle des rencontres** : les refus des cartes
  et des mises arrivent avec la vue (`refus`, `mises`), et l'aperçu se refait
  à la mise choisie par `apercuDuTour`, sur ce que l'annonce dit
  (`reponses`, `mots` — rien que la question ne dise déjà). Une condition
  neuve s'écrit dans `refusDeLaCarte` ou `refusDeLaMise`, nulle part
  ailleurs.
- **Une carte levée promet ce que le serveur fera** : « Avec cette carte :
  si tu as juste, il perd 6 › il perd 10 » se calcule par la règle même du
  pli — ses chiffres (`chiffresApresLaCarte` : l'inspiration, la Charge, la
  Garde, la série), la forme où elle repose la question
  (`formeApresLaCarte`), puis `apercuDuTour` (`apercuALaMise`,
  `changementDeLaCarte`). Une carte neuve qui change un chiffre du tour
  s'écrit dans `chiffresApresLaCarte`, jamais dans le `switch` de
  `jouerEnRencontre` — qui ne garde que ce qui ne se chiffre pas : piocher,
  reposer une question, remélanger — : écrite là, la carte levée
  promettrait autre chose que ce qu'elle fait (`expedition-rencontres-ecran.test.ts`).
- **Les mots de l'écran ne sont pas ceux du code** (le 18 octobre 2026,
  « je veux que ce soit bien compréhensible pour des novices ») : les
  sceaux sont des **points** que l'adversaire perd, la Garde un
  **bouclier** qui pare son attaque, la Charge se dit « +4 si juste » ou
  « il perd 4 de plus », la mise un **pari**, l'équipée une **équipe**
  (« Ton équipée » se lisait comme une faute — sa feuille comprise), la
  carte d'un acte le **plan** (le même soir, le codex : « le même mot désigne
  la carte de l'acte et les cartes de la main, sur le même écran » — les
  jokers de la production aussi, et `CarteDUnActe`, `CarteDeLActe`,
  `sorte: 'carte'` gardent leur nom), l'inspiration l'**énergie** —
  un orbe cyan et son chiffre, le même au coin de chaque carte : en
  étincelles allumées et éteintes, « l'histoire de l'inspiration n'est pas du
  tout claire ». Le code garde ses noms — `sceaux`, `charge`, `garde`,
  `mise`, `inspiration` — ; un texte que lit le joueur — l'effet d'une
  carte, un refus, une ligne de l'aperçu ou du verdict — prend ceux de
  l'écran, et la garde du test refuse « sceaux », « Charge », « Garde » et
  « inspiration ». L'éclair (`zap`) est à l'énergie : aucune carte ne le
  prend pour dessin.
  Le résumé d'une carte (`resume`) tient en deux lignes de neuf signes : la
  largeur d'une carte sur cinq en 360 pixels — « 2 questions » s'y lisait
  « 2 questio… ». Une perte de courage se dit toujours, même nulle
  (« Tu perds 0 ») : « Tu ne perds rien » à côté de « −10 écus de ton
  pari » se contredisait.
- **Une rangée qui défile est le cadre de ce qu'elle porte**
  (`.exp-rangee`, `position: relative`) : le texte dit à l'oreille d'une
  carte (`.sr-only`, en position absolue) prenait son cadre plus haut, la
  rangée ne le coupait plus, et le paquet de l'offre élargissait toute la
  page — à 672 pixels, puis 1144 avec un paquet plus long (le 18 octobre
  2026). Sa largeur de contenu ne compte pour personne non plus
  (`width: 0; min-width: 100%`). `rendu-rencontres.ts` nomme ce qui élargit
  la page : une boîte trop large, ou ce qui est posé en absolu au-delà du
  bord.
- **Une mise ne rapporte que la moitié de ce qu'elle engage**
  (`PART_GAGNEE_D_UNE_MISE`) : à un contre un, miser rapportait dès une
  chance sur deux — toujours, en facile —, et le calibrage finissait sur six
  cents à mille écus (le 18 octobre 2026). Le trésor et Quitte ou double la
  font rapporter triple ; Doubler la mise engage le double, perte comprise.
- **Une carte que les jokers n'ont pas se paie à sa rareté** :
  `prixDeLArticle` lit le catalogue des jokers, puis celui des rencontres —
  Banco, rare, se vendait au prix d'une commune. Une clé des deux
  catalogues garde la rareté du joker : elles sont les mêmes.
- **Les rencontres sont le jeu, et leur drapeau reste un filet**
  (`RENCONTRES_EN_PRODUCTION`, `rencontresOuvertes`, le 19 octobre 2026 :
  « ne plus demander ça, c'est vraiment le jeu maintenant ») : ouvert, le
  départ les prend partout, la production comprise, sans rien demander —
  l'interrupteur « prototype » et son choix retenu sont partis. Repassé à
  `false`, la production repartirait aux jokers : demandées là où elles sont
  fermées, les rencontres se taisent — le départ reste celui des jokers,
  sans refus pour une page d'avance. Le serveur les calcule une fois
  (`server.ts`), pour ses routes et L'Explorateur ; son option `rencontres`
  les ferme — `rendu-expedition.ts` démarre ainsi le sien pour photographier
  les jokers, et `expedition-codex.test.ts` y vérifie le filet. Les vies
  d'une expédition en rencontres ne sont qu'un reflet du courage, pour les
  lectures de la campagne ; une expédition partie en version 4 finit sous
  ses règles.
- **La renommée se relit des bilans, et un bilan n'est qu'un reflet**
  (invariant 14, le codex) : chaque fin — un geste, garder, une réponse,
  l'abandon — écrit le bilan du pli avec `finie_le` (`campagne_series.bilan`,
  en JSON, `ecrireLeBilan`), et la renommée en est la somme au barème du
  jour (`renommeeDe`), lue dans le lot de la page et du départ
  (`lecturesDeLaRenommee`) : pas un aller-retour de plus. Une expédition
  finie sans bilan — d'avant le codex —, au bilan illisible ou d'une autre
  version, se replie de ses gestes et de ses réponses, lus dans le même lot
  pour elles seules, et l'écrit une fois (`codexLu`) ; raté, il se refait à
  la lecture suivante. `json_extract` sur un texte qui n'est pas du JSON
  lève une erreur, et tout le lot tombait : la requête le garde derrière
  `json_valid`. Une fin neuve écrit son bilan comme les autres — sinon la
  page suivante la replie —, et monter `VERSION_DU_BILAN` — la 2, les
  exploits — fait replier une fois toutes les expéditions finies de chacun.
  Un bilan de la bonne version mais mal formé ne se replie pas (la requête
  ne lit que sa version) : il ne compte rien — seul `ecrireLeBilan` en écrit.
- **Un exploit se relève, il ne se joue pas** (le codex) : le pli le note
  (`exploit`, `deSuite`) sans rien changer au jeu — aucune version du départ
  à monter, et il se relève aussi pour les expéditions d'avant, qui le
  comptent au repli de leur bilan (la version 2). Le gros pari se lit à ce
  qu'il engage (`enJeu`, Doubler la mise compris) ; « d'une seule
  réponse », à la première question jugée d'une élite, juste
  (`RencontreEnCours.questions`) ; le gardien de l'acte 3 sans perdre de
  courage, à ce que ses frappes lui ont pris (`RencontreEnCours.perdu`) — un
  bouclier qui pare tout ne coûte rien, Remonter des abysses, qu'on paie, ne
  compte pas ; vingt d'affilée, dans toute l'expédition (`affilee`) — une
  source ratée repart de zéro, une question traversée ne compte pas. **Un
  exploit se mesure avant de se régler** : un adversaire ordinaire,
  n'importe quel gardien, dix d'affilée — la proposition —, le joueur moyen
  les faisait tous à sa première expédition (la carrière de
  `calibrage-rencontres.ts`, qui dit quand chacun tombe). Fait en route, il
  ne s'ouvre qu'à la suivante : le codex est figé. La page dit neufs ceux
  que son codex n'avait pas au départ (`exploitsNeufs`) ; un départ d'avant
  les exploits, sans leur liste, n'en dit aucun : il dirait neuf un exploit
  déjà fait. Un exploit de plus au catalogue monte `VERSION_DU_BILAN`.
- **Le codex se fige au départ** (`DepartDExpedition.codex` : le niveau, les
  cartes ouvertes, les règles, les exploits, la renommée d'alors) : les
  offres, l'étal de l'échoppe, le trésor, le pari, les fioles, les
  talismans, la fétiche et le dos le lisent,
  jamais le niveau du jour — un barème changé, un légendaire gagné ailleurs
  ne changent pas ce qu'une expédition en route a tiré, et le pli rejoué
  redonne le même. Un départ d'avant la version 7 a les règles d'alors —
  le pari, les talismans, la fétiche (`REGLES_D_AVANT_LE_CODEX`,
  `regleOuverte`) —, jamais une règle venue après : une règle neuve du
  codex se ferme d'elle-même aux départs partis avant elle, en version 7
  comme avant, sans monter `v`. Une règle fermée se refuse au même endroit que les
  autres (`refusDeLaMise` pour le pari, sur `EtatDeLExpedition.pari` ; la
  page ne le propose pas, `VueDeLaRencontre.pari`) ; un talisman fermé ne
  se tire pas — `talismanDeLOffre` a son propre hasard, et
  ne pas le tirer ne décale rien. La fétiche n'est gardée au départ qu'à
  son niveau : envoyée plus tôt, le serveur l'ignore.
- **Une carte retouchée garde ses chiffres d'avant** (`VERSION_DU_CODEX`,
  `CarteDeRencontre.avantLeCodex`, `carteALaVersion`) : Parade, Troisième
  œil, Lucidité, Lancée, Échauffement, Plume, la Bibliothèque ont changé avec
  le codex, et une expédition partie avant les joue telles qu'elle les a
  tirées — son énergie et ses refus se replieraient autrement sous ses pieds.
  Le pli, `refusDeLaCarte`, `chiffresApresLaCarte` (`ContexteDesChiffres.v`),
  `enPlusDeLaBibliotheque` et `apercuDuTour` reçoivent la version du départ ;
  la page la lit de la vue (`CartesEnJeu.v`, `VueDeLaRencontre.v`) et la
  pose pour ses pièces (`VersionDesCartes`) : une pièce qui montre un coût,
  un résumé ou un chiffre passe par `useCarte`, jamais par
  `carteDeRencontre`, qui rend celle du codex. Une retouche de plus garde de
  même ses chiffres d'avant, sous une version neuve (`expedition-rencontres-ecran.test.ts`
  rend la même carte aux deux versions).
- **Une carte n'a de place dans le codex que si elle vaut d'être prise**
  (le calibrage du 18 octobre 2026) : prises sans compter, presque toutes
  les cartes à gagner faisaient perdre le joueur qui les prenait — les cartes
  de base valaient plus, et ouvrir des niveaux affaiblissait (le moyen de
  36 % au niveau 1 à 24 % au niveau 10). Une carte neuve se mesure seule
  contre ne rien prendre (`calibrage-rencontres.ts`, `PREFERENCE_DU_CODEX`,
  `A_RETIRER_DU_CODEX`) avant d'entrer dans l'échelle ; une carte qui ne
  sert qu'à la fétiche n'ouvre pas avant elle.
- **Une fiole n'est pas une carte** (les objets, le 19 octobre 2026) : ni
  énergie, ni pioche, ni main — le pli les tient à part
  (`EtatDeLExpedition.fioles`, deux au plus, `FIOLES_MAX`). Celle d'un
  coffre se tire sur son propre fil (`graine:fiole:rang`, `fioleDeLOffre`) :
  la tirer ne décale ni les offres ni la pioche, et un départ sans la règle
  n'en tire aucune. Prise, elle prend la place d'une carte — le coffre ne
  paie alors pas ses écus. **Boire porte sa position**, comme un joker joué
  sur une question (`vise`) : sans elle, une fiole bue juste après une
  réponse se compterait avant elle. Pourquoi une fiole ne se boit pas, une
  seule règle (`refusDeLaFiole`) : le pli l'applique, le serveur la renvoie,
  la vue la porte (`fioles.refus`) et la page n'en recopie rien.
- **La clairvoyance est une réponse aidée** : bue, elle se marque dans les
  cartes de la question (`CLAIRVOYANCE_SUR_LA_QUESTION`, dans
  `TourDeRencontre.surLaQuestion`), que `effaceesDuTour` compte pour une
  réponse effacée et que `jokerQuiAide` écrit en colonne `joker` — la
  réponse qu'elle aide ne mesure rien (invariant 1 : la réponse effacée se
  choisit au serveur, jamais la bonne). Jamais sur un vrai ou faux, ni quand
  il ne reste que deux réponses : elle répondrait à sa place.
- **Le dos ne passe pas par le pli** : il ne change rien au jeu. Il se fige
  au départ (`DepartDExpedition.dos` — celui demandé s'il l'a, sinon le plus
  rare) et la vue le rend (`CartesEnJeu.dos`) ; le codex de la page porte
  tous ceux qu'il a (`CodexDeLaPage.dos`), le codex du départ aucun. Un dos
  neuf s'ouvre par l'échelle (`MarcheDuCodex.dos`) ou par un exploit
  (`Exploit.dos`), jamais en dur dans la page.
- **La barre passe à la ligne, ce qu'il porte d'un bloc** (le 19 octobre
  2026) : les écus et le courage restent en haut à droite ; ce qu'il porte
  les suit (`exp-sac` : les cartes posées, les talismans, les fioles) et
  passe à la ligne entier quand il ne tient plus. Posé entre le « ? » et
  les écus, sur une ligne qui ne revenait pas, il poussait le courage hors
  de l'écran : trois cartes posées, trois talismans et deux fioles faisaient
  la page large de 509 pixels sur 360. Rien n'y est poussé par
  `margin-left: auto` (`justify-content: flex-end`, la marge à droite du
  « ? ») : à la ligne suivante, la marge couperait la barre en deux
  (`expedition-rencontres-ecran.test.ts`).
- **L'Explorateur ne vit que là où les rencontres s'ouvrent** (le 19 octobre
  2026) : une piste de la campagne au niveau d'explorateur
  (`StatsDeCampagne.explorateur`, `hf:explorateur`), qu'un serveur aux
  rencontres fermées ne montre nulle part — partout depuis qu'elles sont le
  jeu, le même jour. Une seule source, `rencontresOuvertes`,
  calculée au démarrage (`server.ts`) : `CampagneStore` ne lit la renommée
  dans `statsDe` que là (`rencontres` — ailleurs 0 : ni palier, ni lecture
  de plus) ; `ProfileStore` ne cite le trophée que là (`rencontres`,
  `hautsFaitsVus`), et l'album ne bâtit pas sa case sans lui
  (`montreParLeServeur`, `albumDesTrophees`) — un drapeau du code ne
  suffisait pas : la préproduction sert le même. Sans renommée, il vaut 0,
  jamais le niveau 1 que chacun a sans rien : « 1 sur 4 » se proposait
  comme le trophée le plus proche de qui n'est jamais parti. Les bilans que
  `statsDe` replie s'écrivent comme au codex (`ecrireLesBilansRefaits`) :
  sans, chaque page du profil replierait les mêmes expéditions
  (`expedition-codex.test.ts`, la production comprise).
- **L'Ascension se choisit, se fige au départ et ne se lit qu'au codex**
  (le 19 octobre 2026) : le cran part avec l'expédition
  (`DepartDExpedition.ascension`), borné par le serveur à ceux que ses
  victoires ont ouverts — un téléphone partagé retient celui d'un autre
  profil : il part au plus haut des siens, sans refus —, et le pli ne le lit
  qu'aux départs du codex (`ascensionDuDepart`). Ouvrir un cran en route ne
  durcit pas l'expédition qu'il joue. Rien de retenu, aucun cran :
  l'Ascension ne durcit personne d'office ; parti à son plus haut, il y reste
  quand le suivant s'ouvre (`haut`, `quizz.expedition.ascension`). Ce
  qu'elle ouvre se relit des bilans (`ascensionOuverte`,
  `BilanDUneExpedition.ascension`), comme la renommée : une victoire d'avant
  elle ouvre le cran 1, et le champ neuf du bilan ne monte pas
  `VERSION_DU_BILAN` — un bilan sans cran est une expédition sans cran. La
  fin dit le cran qu'une victoire ouvre d'après celui qu'il avait ouvert en
  partant (`CodexDuDepart.ascensionOuverte`, `cranOuvertParLaVictoire`) : un
  départ qui ne le sait pas n'en dit rien.
- **Un chiffre d'un cran passe par sa règle** : les points d'un adversaire,
  sa frappe, ce que rendent le campement et la source, l'énergie de chaque
  question (`pointsDeLAdversaire`, `frappeDeLAdversaire`,
  `reposALAscension`, `energieDuTour` — celle de l'acte, à la version du
  départ et à son cran) — le pli les applique, la page les annonce (le plan,
  son panneau, sa légende, le campement, les règles, la règle du cycle des
  cartes ; l'énergie de chaque acte, de la vue, `CartesEnJeu.energie`). Un
  `sceauxDe`, un `COURAGE_D_UN_CAMPEMENT` ou un `INSPIRATION_PAR_QUESTION`
  lu tel quel par la page dirait un chiffre que le serveur ne joue pas. Un cran se mesure avant de se régler
  (`calibrage-rencontres.ts --ascensions`) : aux premiers chiffres — 4
  points, 2 de frappe, 40 de courage au départ —, les crans 1, 2 et 4 ne
  retiraient au fort que 1 à 4 points chacun, et partir avec 30 de courage
  aucun — le campement et la source le remontaient avant qu'il en manque.
- **Le jeu complet monte la version du départ** (la 8, le 19 octobre 2026 —
  « Tu pourrais pas donner un jeu complet ? ») : quarante-deux cartes de plus,
  l'épique dans les offres, l'énergie de chaque acte. Une carte venue avec
  lui porte `depuis` : les offres d'avant le codex ne la tirent jamais
  (`NEUTRES_DES_OFFRES`, `FAMILLES_DES_OFFRES`) — rejouées, elles tireraient
  parmi plus de cartes, et une autre que celle d'alors —, et `refusDeLaCarte`
  la refuse à un départ d'avant elle ; un départ de la version 7 garde ses
  trois d'énergie (`energieDesActes`) et ses raretés sans épique
  (`raretesDeLOffre` : une rareté absente des poids ne se tire pas), son
  codex figé ne nomme aucune carte neuve. Une carte neuve de plus prend
  `depuis` à une version neuve. **Le serveur ne lit que les versions qu'il
  connaît** (`lireDepartDExpedition`) : la 8 oubliée là, chaque départ du
  jeu complet se lisait illisible — l'expédition en route repartait du
  niveau 5, les bilans ne se repliaient plus (`expedition-codex.test.ts`).
  Une version neuve s'y ajoute avec elle.
- **Ce qu'une carte ajoute au verdict, une seule règle** : les écus et le
  courage d'une bonne réponse (`siJuste`), l'attaque de plus
  (`frappeEnPlus`), le pari rendu (`pariPerdu`), la riposte (`riposte`), ce
  qu'une bonne réponse laisse à la question suivante
  (`suiteDUneBonneReponse`), ce que les pouvoirs ajoutent avant la forme
  (`enPlusDesPouvoirs`) et après (`enPlusApresLaForme`), la forme sous
  Métamorphose, Miroir et Polymorphe (`multiplicateurDeLaForme`, ses
  `cartes`) — le pli et `apercuDuTour` les lisent tous deux. Une carte neuve
  qui change le verdict s'écrit là, jamais dans le pli seul : la carte levée
  promettrait autre chose que ce qu'elle fait. `expedition-jeu-complet.test.ts`
  lève puis joue chaque carte du jeu complet, et compare.
- **Une carte qui vise la question se range sur elle**
  (`TourDeRencontre.surLaQuestion`, `viseLaQuestion`) : celles de pendant la
  question, et, dès la préparation, celles qui changent sa forme ou l'effacent
  d'avance — Corser, Simplifier, Miroir, Polymorphe, Augure. Une autre
  question — Échange, Volte-face, La mue (`CHANGENT_DE_QUESTION`) — repart
  sans elles, et la carte levée le sait (`apercuALaMise` lit les mêmes
  ensembles). Une seule forme par question : la deuxième carte qui la
  changerait se refuse (`FORME_DE_LA_CARTE`), et le serveur repose la question
  à la forme de la carte jouée (`questionsApresLeGeste`).
- **Une carte se mesure isolée** (`calibrage-rencontres.ts --seule`,
  `--cartes`) : parmi les soixante-cinq cartes du jeu complet, une carte
  donnée passait à peine une fois par expédition, et ce qu'elle valait se
  perdait dans le bruit. Sous `--seule`, ses offres ne proposent qu'elle — et
  les légendaires qu'il a —, prise deux fois au plus, contre `rien` aux mêmes
  graines — à ±5 points sur deux cent cinquante expéditions. Le joueur qui a
  appris ne prend que ce qui y vaut, à la version mesurée
  (`PREFERENCE_DU_CODEX` : `PREFERENCE_DU_JEU_COMPLET`, ou celle du codex
  d'avant) : une carte qu'il ignore dilue ses offres, et le jeu complet lui
  retirait jusqu'à huit points au niveau 6 tant qu'il n'en prenait aucune ;
  ses attaques se choisissent par ce qu'elles frappent par point d'énergie
  (`parEnergie`) — dans un ordre fixe, Fortune passait après Concentration
  même à deux cents écus.
- **Une carte améliorée porte sa clé suivie de « + »** (le 19 octobre 2026,
  « un système d'amélioration des cartes ») : `concentration+` dans tous les
  tas — le paquet, la main, la pioche, la défausse, les épuisées, les jouées,
  `surLaQuestion`, les pouvoirs, les offres —, une carte à part entière de
  `PAR_CLE` (`exemplaireAmeliore` : son nom « + », `amelioree`, ses chiffres
  d'`AMELIORATIONS`), jamais dans `CARTES_DES_RENCONTRES` — ni le codex, ni
  les offres de base ne la tirent. **Une règle reconnaît une carte par
  `baseDe` ou `parmi`, jamais par sa seule clé** : un `includes('bastion')`
  oubliait Bastion+, et la carte améliorée jouait moins que sa carte. Le
  `switch` d'une règle porte sur `baseDe(cle)`, ses chiffres sur
  `carte.amelioree` ou `amelioreeParmi` ; `expedition-ameliorations.test.ts`
  relit les fichiers de l'expédition — `shared/`, le serveur, le calibrage,
  la page — pour qu'aucune clé qui s'améliore n'y soit plus cherchée seule. La colonne `joker` d'une réponse aidée garde la
  clé de base (`jokerQuiAide`) : la mesure ne connaît pas les « + ».
- **Pourquoi une carte ne s'améliore pas, une seule règle**
  (`refusDeLAmelioration` : ni une maudite, ni la carte d'un légendaire, ni
  celle de route, ni deux fois) : le pli, le serveur et la page la lisent. La
  version, elle, se lit au pli (`ameliorations` : le jeu complet en
  rencontres) et au serveur (`gesteRecevable`) — une expédition de la
  version 7 n'améliore rien. Le campement fait **un** choix : le repos, une
  carte retirée ou une carte améliorée (`camper`, les deux à la fois :
  illisible) ; l'échoppe n'en améliore qu'une (`EchoppeOuverte.ameliorer`).
  Une offre des actes 2 et 3 en tire d'améliorées sur son propre fil
  (`graine:amelioree:rang`, `CHANCE_D_UNE_OFFRE_AMELIOREE`) : les cartes
  offertes restent celles qu'elle tirait, et rien d'autre ne se décale.
