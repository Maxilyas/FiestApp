---
paths:
  - "shared/{expedition,jokers,rencontres,codex,lettres,curiosites,frise}.ts"
  - "server/src/core/{curiosites,frises,details}.ts"
  - "server/src/expedition.ts"
  - "client/src/views/{ExpeditionApp,RencontresDExpedition}.tsx"
  - "client/src/components/{Balise,Vies,TableauDuDetail,TableauEntier,OeuvrePeinte}.tsx"
  - "client/src/components/cartes-peintes.ts"
  - "server/scripts/{rendu-expedition,calibrage-expedition,rendu-rencontres,calibrage-rencontres,rendu-question-au-centre,rendu-curiosites,rendu-frise,rendu-detail,frises}.ts"
  - "server/test/{expedition,expedition-carte,expedition-carte-ecran,expedition-question-ecran,expedition-pli,expedition-legendaires,expedition-jokers,expedition-mesure,expedition-charge,expedition-tirage,expedition-formes,expedition-ecus,expedition-echoppe,expedition-themes,expedition-passeport,expedition-saison,expedition-rencontres,expedition-rencontres-routes,expedition-rencontres-ecran,expedition-partir,cartes-peintes,codex,expedition-codex,expedition-styles,expedition-question-au-centre,expedition-coups-de-pouce,expedition-curiosites,expedition-frise,expedition-detail}.test.ts"
---

# L'Expédition : la carte, les escales, les gardiens, les jokers, les écus, le passeport, les saisons

Trois actes, chacun une carte tirée au sort — six étages de quatre colonnes, deux campements, un gardien au bout —, et au bout du troisième un des trois gardiens vaincus à garder : un légendaire ; en main, des jokers ; en poche, des écus. Le brief validé par le propriétaire le 17 octobre 2026 (« on fait que rajouter des choses mais on ne sait plus quoi choisir ») : `retours/2026-10-17/expedition.md`. **Les quatre étapes sont faites** — la carte et une expédition de bout en bout, les jokers, les formes de question, puis les écus : l'échoppe, l'inconnu, les talismans. Puis, le 18 octobre 2026, le passeport — un tampon par thème pointu trouvé, le Globe-trotter — et la saison des fêtes — sa fête sur les cartes, son légendaire à l'acte 3. Ouverte en production depuis ses jokers (`EXPEDITION_EN_PRODUCTION`) : avec une équipée de deux, le joueur moyen arrive au bout 25 à 31 fois sur cent, le fort 67 à 77 — la cible du brief, une fois sur trois et huit sur dix, approchée. **Les rencontres** (la version 5 du départ, le 18 octobre 2026 — la proposition « L'Expédition en cartes », `retours/2026-10-18/rencontres.md`) : un prototype de la préproduction, puis le jeu partout depuis le 19 octobre 2026 (« ne plus demander ça, c'est vraiment le jeu maintenant ») ; une escale à question devient un adversaire à faire tomber question après question, le courage remplace les vies, des cartes les jokers — la préparation, la mise, le cycle de Slay the Spire. **Le codex** (la version 7, le 18 octobre 2026 au soir — « Go tout faire avec tes recommandations ») : chaque expédition finie rapporte de la renommée, la renommée fait le niveau d'explorateur, chaque niveau ouvre des cartes à gagner et, aux premiers, le pari, les talismans et la catégorie fétiche ; plus d'équipe à choisir, l'invité du jour prête sa carte, et le trésor d'un gardien propose la carte d'un légendaire qu'on a. Puis les exploits — un but précis, fait une fois : Banco, Génie, Inarrêtable et le dos doré du paquet ne s'ouvrent que par eux (Lancée et Échauffement jusqu'à « Ton style »). Puis les objets, le 19 octobre 2026 : les fioles — courage, énergie, clairvoyance, à boire quand on veut, deux au plus —, une règle du niveau 3, et les dos de cartes ; puis le trophée L'Explorateur, une piste de la campagne au niveau d'explorateur (4, 7, 10), réservé aux serveurs où les rencontres s'ouvrent. Puis l'Ascension, le même jour : une expédition menée au bout ouvre cinq crans de difficulté qui s'ajoutent l'un à l'autre — les points des adversaires, leur frappe, le repos, l'énergie de chaque question, les gardiens —, chacun ouvert par une victoire à celui d'en dessous, choisi au départ. Puis **« Ton style »**, le même jour (« Pour les cartes il faut vraiment plus de gameplay différents […] j'ai l'impression de piocher tout le temps la même chose et de pas avoir à choisir de style de jeu ») : une famille choisie au départ — ses deux cartes dans le paquet, à la place de deux cartes de base, une des siennes dans chaque offre —, la catégorie fétiche avec l'Érudit, et l'échelle qui ouvre la variété d'abord : trois styles au niveau 1, un de plus à chacun des trois suivants. Puis **les huit familles**, le même jour (la version 9 — « quitte à rajouter des communes aussi ») : deux styles qui gagnent autrement, chacun ses huit cartes peintes — le Sophiste au niveau 5, dont le doute fait perdre des points juste ou faux, le Téméraire au 6, qui paie en courage et frappe de ce qui lui manque. Puis **« La question au centre »**, le même jour (les retours d'un testeur : « faut exploiter davantage le système de question que le système de combat ») : un plan en six étapes validé par le propriétaire, la première faite — le vrai ou faux qui dit sa bonne réponse —, la deuxième — la question d'abord, la version 10 — faite le même jour, en préproduction d'abord, puis en production le 20 octobre 2026 avec la version 15, en accès anticipé (`QUESTION_AU_CENTRE_EN_PRODUCTION`, `questionAuCentreOuverte` ; le brief et ses décisions, `retours/2026-10-19/la-question-au-centre.md` — « Une carte par question. Les cartes reviennent à l'acte suivant. Rempart en pause. ») : l'adversaire en crans — des bonnes réponses —, son attaque fixe ; la question d'abord, l'annonce seulement avec le pari ou un dévoilement ; une carte par question, sans énergie, ni bouclier, ni soin, celles du pari en plus à l'annonce ; la main de l'acte, gardée, sa défausse rendue à l'acte suivant ; soixante-deux cartes, cinq styles — le Rempart attend l'étape 6, le Sophiste et le Téméraire en sortent. L'étape 6, la version 14 (le 20 octobre 2026), fait de chaque famille une façon de répondre et ramène le Rempart, avec un second essai. Puis la version 15, le même jour (« Je veux quelque chose de bien plus difficile, aussi met un offset […] Fait la forme du détail ») : le détail, un acte 3 plus dur — son gardien en experte —, le soin à moitié, les cartes plus rares qui parent l'attaque d'une erreur (« avec les cartes plus rares, et du coup le fait de jouer, ça aide vraiment à gagner »), l'Élan qui efface et revient, le second essai au carnet.

## Les fichiers

- `shared/expedition.ts` — tout ce qui se calcule, pur. Le générateur (`carteDUnActe`, de la graine du n-ième départ du profil — `graineDe`, `hasardDe` : la même graine redonne la même carte) : cinq chemins qui montent sans se croiser, leurs pas font les escales et les liens ; la sorte de chaque escale (`POIDS_DES_ESCALES` ; plus d'adversaires en rencontres, `POIDS_DES_ESCALES_DES_RENCONTRES`), son thème — une catégorie, un mélange de deux ou trois, un sujet pointu (`PART_DES_MELANGES`, `PART_DES_THEMES_POINTUS` ; ses sujets, le serveur les donne : piège plus bas ; la fête d'une saison en tient la moitié, `PART_DE_LA_FETE`) —, sa forme (`POIDS_DES_FORMES`, `FORMES_OUVERTES` : toutes depuis l'étape 3) ; toutes les sortes depuis l'étape 4. Les écus (`ECUS_DES_PISTES`, `ecusDeLaReponse` — la couleur de la chance annoncée, `chanceAnnoncee`, celle du Commandement comprise —, `prixDeLEscale`, `ecusEsperes`), l'échoppe (`PRIX_DE_L_ECHOPPE`, `prixDeLArticle`, `refusDeLAchat`), l'inconnu (`contenuDeLInconnu`, `legendaireDePassage`), les talismans des offres (`talismanDeLOffre`, `CHANCE_D_UN_TALISMAN`), la fiole d'un coffre (`fioleDeLOffre`) et pourquoi une fiole ne se boit pas (`refusDeLaFiole` — la seule règle), le siècle de la loupe (`siecleDeLaQuestion`). Le dévoilement (`MS_PAR_MOT`, `ARRET_SUR_IMAGE_MS`, `MOTS_DU_DEVOILEMENT`, `motsDe`, `motsDits`, `instantDuMot` : combien de mots sont dits à l'heure du serveur, et quand se dit le suivant). Les marches (`MARCHES_DES_ACTES`, `marcheDe` : jamais d'experte), les gardiens (`gardiensDe`, jamais l'invité du jour ; le légendaire d'une saison à l'acte 3, `deSaison`), le passeport par famille (`passeportParFamille`), l'invité du jour (`inviteDuJour`) et l'équipée (`refusDeLEquipee`), les offres (`offreDeJokers`, parmi les jokers que la version du départ connaît — `Joker.depuis`), les chances (`chanceSelonLaForme`, `chanceDeVaincre`, `viesAuBout`, `chancesDuTrace`, `traceLePlusSur`, `escalesAtteignables`), le pli (`pliDeLExpedition` — la main, le paquet, la défausse, les posés, l'offre, le campement, les jokers de route —, `escalesPermises`, `carteEnJeu` et `maisonAOuvrir` — la carte que Il connaît la maison change —, `questionsDuGardien`), pourquoi un joker ne se joue pas maintenant (`refusDuJoker`), ce qu'un joker montre d'une question (`reponsesEffacees`, `indiceDeLEnigme`, `sensDeLOracle` : ils lisent la bonne réponse, le serveur seul les appelle), les types de la page (`VueDeLExpedition`, `JokersEnJeu`, `PageDeLExpedition`), le nom d'un gardien dans une phrase (`leGardien`, `auGardien`, `gardienAuFeminin` : « vers le Kraken », « à la Chouette d’Argent »). Ses constantes sont des choix de produit (`docs/reference/baremes.md`)
- `shared/jokers.ts` — `EXPEDITION_EN_PRODUCTION`, le catalogue (`JOKERS_DES_LEGENDAIRES`, vingt-trois — la lanterne de la Citrouille et la boule du Sapin venues avec l'inconnu —, `JOKERS_SANS_LEGENDAIRE`, neuf ; `joker`, `jokerDuLegendaire`), les talismans (`TALISMANS`, `talisman`), `LEGENDAIRES_A_JOKER` — eux seuls gardent un acte, s'emmènent et ont la voie —, et les règles du paquet : `PAQUET_DE_DEPART`, `MAIN_MAX`, `MAIN_MAX_DES_TROIS_TETES`, `PLACES_DE_L_EQUIPEE`, `JOKERS_PAR_OFFRE`, `POIDS_DES_RARETES`, `EFFACE`, `JOKERS_QUI_AIDENT`. Il n'importe rien : `shared/legendaires.ts` le lit, l'album et l'accueil aussi, sans tirer toute l'expédition
- `CampagneStore` (`core/campagne.ts`, « L'Expédition ») · `server/src/expedition.ts` — une expédition est une série `mode = 'expedition'` : son départ dans `campagne_series.expedition` (`DepartDExpedition`, versionné — la version 2, ses jokers : son équipée, l'invité de son départ, sa chance sur chaque marche de chaque catégorie et sur une source), ses gestes dans `expedition_gestes` (`serie_id`, `rang`, `geste`), ses réponses dans `campagne_reponses` — aidées, la clé de leur joker (`joker`) —, comme toute partie : l'expérience, les confettis, le carnet et « jamais vues d'abord » la comptent sans rien en savoir. Les routes, pour les profils (`GET` et `POST /api/expedition`, `POST /api/expedition/:id/geste`, `…/reponse`, `…/abandon`) ; sa correction et ses signalements par celles de la série (« en expédition » au QG). `pageDeLExpedition` (celle en route, sinon la prochaine : son numéro, ses gardiens, ceux qu'il a déjà — `aLui` —, l'invité du jour, ses légendaires qui ont leur joker — `equipables`), `partirEnExpedition` (une à la fois, son équipée), `chancesDeLExpedition`, `gesteDExpedition` (`gesteRecevable` : avancer, jouer, prendre, camper, acheter — écrit avec son prix ; garder, `garderUnGardien` ; un piège qui prend la dernière vie finit l'expédition d'un geste), `completerLExpedition` (ce que le pli demande de tirer, `aTirer` — la question d'une escale, celles du gardien, l'autre d'Échange ou de Deux visages, la reprise de La boucle —, tiré dans le lot du geste), `repondreEnExpedition` (Double chance : deux réponses ; `jokerQuiAide`), `abandonnerLExpedition`, `tirerPourLExpedition` (sur le thème de l'escale — ou la catégorie du Commandement —, par `tirerPourUneEscale`, le rang d'une épreuve lu dans un ordre tiré à mesure), `expeditions` (l'expédition en route en mémoire, `ExpeditionGardee` : `expeditionAJouer`, `garderLExpedition`, `ecrireLExpedition`, `vuAilleurs`), `aSaForme` (la forme posée au tirage : six choix et ses leurres, `leurresDuSixChoix` ; un vrai ou faux, sa réponse proposée et la bonne des quatre, `bonneReponse` — que seuls le verdict et la correction disent, la proposée fausse : `bonneReponseDuVraiOuFaux` ; un dévoilement et l'heure de son premier mot — ce qu'une question doit avoir pour s'y prêter, `seLaissePoser`), `devoilement` (les mots d'un dévoilement et où il en est, pour sa route `GET /api/expedition/:id/devoilement`, qui les écrit chacun à son heure), `vueDeLExpedition` (ce que la page reçoit : la carte en jeu — l'inconnu dévoilé seul —, les jokers et leurs refus, ce qu'un joker montre, le siècle de la loupe, les écus, les talismans, l'échoppe, l'inconnu où il entre), `questionsPosees` et `devoileA` (le mot où un dévoilement en était à l'heure de sa réponse, `ExpeditionLue.reponduesLe` : ses écus en dépendent), `recompenserLExpedition` (les paliers de la campagne : Le Marathonien ; ni record ni haut fait de série). `oublierProfil` efface ses gestes
- `client/src/views/ExpeditionApp.tsx` — la page (`/expedition`, à la demande dans `main.tsx`, préchargée par `shared/depart.ts`, réservée dans `shared/space.ts` ; un gros bouton sur l'accueil d'un profil, `AccueilDesRoles.tsx`, tant que le drapeau l'ouvre) : le départ (`Depart` : le numéro de la carte, les trois gardiens annoncés, ceux qu'il a déjà, l'équipée — `Places`, « Changer » —, retenue sur le téléphone, `quizz.expedition.equipee`), sa feuille (`FeuilleDeLEquipee` : la grille des légendaires qu'il peut emmener, la fiche du dernier touché, `TousLesJokers` déplié à la demande), la carte d'un acte (`CarteDeLActe`, revue deux fois le 18 octobre 2026 — seule l'escale où il est s'éclaire, puis « de vrais cartes en bas » ; l'écran tient en un écran : `lireLaCarte` une fois pour tout, `etatDeLEscale` et `liensDuPlan` pour le plan ; en haut l'acte en petit, `PetitPlan` — ses rangées en pour cent de sa hauteur, `EN_PETIT`, ses colonnes en pour cent de sa largeur, `COLONNES_X` ; depuis le 19 octobre 2026 (« une fusion entre carte et l'interface, car là le zoom est séparé »), ses escales se touchent sur place, des boutons dont la cible déborde le dessin (`.exp-point::before`) : une proposée se choisit comme sa carte, une autre s'entoure de gris, `exp-regardee` — ; l'escale où il est, seule éclairée — `exp-ici`, le départ aussi —, les escales permises entourées — `exp-a-portee` —, la touchée — `exp-choisie`, son trait doré —, le reste en retrait — `exp-plus-loin`, `exp-loin`, `exp-passee` — ; en bas le panneau collé : les escales permises en cartes, de gauche à droite, `CarteDEscale` — sa sorte, son emblème, son nom, sa chance, ses gains, `faceDeLEscale` ; un mélange, les emblèmes de ses catégories côte à côte, `exp-embleme-melange`, `categoriesDuMelange` —, la plus sûre à son ruban, `laPlusSureDesProposees`, depuis les escales permises sous Le détour ou Le raccourci ; ce que dit l'escale touchée, sur le plan ou en carte, sous les cartes — `ceQueDitLEscale`, `exp-vu`, la description courte, sans chance ni écus (`decrire` `court`) ; un mélange y nomme ses catégories (`enumerer`) — ; sa main en petit en tête, « Y aller ». Plus de feuille du plan : la légende est au « ? », « Abandonner l'expédition » au départ), l'escale (`Escale` : ce qu'un joker montre, la main sous les réponses ; ses réponses, `ReponsesDeLEscale` — effacées, montrée à l'Oracle, choisies sous Double chance, cochées), la main (`Main`, revue le 18 octobre 2026 — « ma main c'est pas ouf » : les jokers en cartes au cadre de leur rareté, `gemmeDuJoker`, la gemme de l'album, `client/src/gemmes.ts` ; posées au bas de l'écran, leur haut seul en vue ; la pioche au bout, sa feuille `FeuilleDuPaquet` ; sur la carte, en petit, `enPetit` — ; la carte levée, `JokerLeve` : en grand, ce qu'il fait, « Jouer » ou son refus, le Commandement et sa catégorie, une modale, `useModale`), la révélation (`Revelation`, `verdictDe` : ce que la réponse a coûté, lu de l'écart avec la vue d'avant), l'offre (`Offre` : un talisman parfois, et le coffre qu'on passe pour ses écus), le campement (`Campement`), l'échoppe (`Echoppe` : un article choisi puis acheté ; « Reprendre la route » la laisse sans geste, `echoppeLaissee`, et le panneau de la carte la rouvre), l'inconnu dévoilé (`Inconnu`), la barre du haut (`Barre` : le « ? » des règles, `BoutonDesRegles` et leur feuille ; les écus, les vies ; puis ce qu'il porte, d'un bloc qui passe à la ligne, `exp-sac` — les jokers posés, en rencontre les cartes posées pour toute la rencontre, `exp-posees`, qui se lèvent au toucher, les talismans en petit, les fioles), le gardien vaincu (`GardienVaincu`), le choix du légendaire (`ChoixDuLegendaire`), la fin (`FinDeLExpedition`, l'écran des gains de la campagne, `gains.test.ts`) ; les cartes jouées sur place, gardées jusqu'au geste suivant (`CartesSurPlace`, `avecLesCartesSurPlace`), et les peintures du paquet demandées d'avance (`prechargerLesPeintures`, dans `RencontresDExpedition.tsx`). `components/Balise.tsx` (la couleur de piste d'une chance, venue des sentiers) et `components/Vies.tsx` (les cœurs, venus de la campagne) se partagent. Sa section de `styles.css` : « L'Expédition », classes `exp-*`
- `shared/rencontres.ts` — les rencontres, pures : `RENCONTRES_EN_PRODUCTION`, ses règles chiffrées (le courage, l'inspiration, les cinq cartes de la version 5 et la main qui grandit avec les actes de la version 6 — `CARTES_DES_ACTES`, `cartesDesActes`, `cartesParQuestion` —, les mises et `PART_GAGNEE_D_UNE_MISE`, le savoir de chaque marche, les multiplicateurs des formes, les sceaux et la frappe de chaque sorte d'adversaire, ce que rendent une source, un campement, l'échoppe, ce que prend un piège, les offres et leurs raretés — celles de l'acte 1 depuis la version 6, `RARETES_DE_L_ACTE_1`, `raretesDeLOffre` ; l'épique depuis le jeu complet, `RareteDOffre`, `RARETES_DU_JEU_COMPLET`, `RARETES_DE_L_ACTE_1_DU_JEU_COMPLET` ; l'énergie de chaque acte, `ENERGIE_DES_ACTES`, `energieDesActes` — `docs/reference/baremes.md`), le catalogue (`CARTES_DES_RENCONTRES` : dix-sept neutres, soixante-quatre cartes de famille — huit par famille depuis le jeu complet, `VERSION_DU_JEU_COMPLET`, chacune venue avec lui marquée `depuis` ; le Sophiste et le Téméraire depuis les huit familles, `VERSION_DES_HUIT_FAMILLES` ; Panacée, `unique` —, les vingt-trois jokers des légendaires réécrits, gardant leur clé ; `carteDeRencontre`, `carteDuLegendaire`, `estDeRoute`, `cartesDeCombat`, `PAQUET_DES_RENCONTRES`, `paquetDesRencontres`), les familles (`FAMILLES_DE_CARTES` — `jeu`, la façon de gagner d'un style en une phrase —, `famillesDeLEquipee` : les légendaires de l'équipée choisissent celles des offres), les styles (`StyleDeJeu`, `STYLES`, `estUnStyle`, `CARTES_DE_DEPART_DU_STYLE`, `BASES_REMPLACEES_PAR_LE_STYLE` : ce que `paquetDesRencontres` met dans le paquet d'un style, et à la place de quoi), les offres (`offreDeCartes`), les adversaires (`ADVERSAIRES`, `adversaireDe`), ce qu'une bonne réponse brise et ce qu'une erreur coûte (`brisesDUneBonneReponse`, `frappeDUneErreur`, `multiplicateurDeLaForme`, `enJeu`, `gainDeLaMise`, `effaceesDuTour` — `EFFACE_DES_CARTES`, `POUVOIRS_QUI_EFFACENT` —, et ce que les cartes du jeu complet y ajoutent : `siJuste`, `frappeEnPlus`, `pariPerdu`, `riposte`, `suiteDUneBonneReponse`, `enPlusDesPouvoirs`, `enPlusApresLaForme` ; le doute des huit familles — `rongeDuDoute`, `douteApresLaQuestion`, `douteDUneErreur`, `RencontreEnCours.doute` — et le courage qu'une carte coûte, `courageDeLaCarte`), les cartes qui visent la question ou en changent (`viseLaQuestion`, `CHANGENT_LA_QUESTION`, `CHANGENT_DE_QUESTION`, `FORME_DE_LA_CARTE`), les fioles (`CleDeFiole`, `FIOLES`, `fioleDe`, `FIOLES_MAX`, `COURAGE_D_UNE_FIOLE`, `ENERGIE_D_UNE_FIOLE`, `CLAIRVOYANCE_SUR_LA_QUESTION`), ce qu'une carte change aux chiffres du tour et à la forme de la question (`chiffresApresLaCarte`, `formeApresLaCarte` — la seule règle : le pli l'applique, la carte levée l'annonce), pourquoi une carte ne se joue pas (`refusDeLaCarte` — la seule règle), l'annonce et l'aperçu du verdict (`AnnonceDuTour`, `apercuDuTour`), les types de la rencontre (`RencontreEnCours`, `TourDeRencontre`, `CoupDeRencontre`, `VueDeLaRencontre`). Le pli (`pliDeLExpedition`, `depart.v >= 5`) en fait l'état ; `shared/expedition.ts` y ajoute `routeDisponible`, `refusDeLaMise`, `questionDuTour`, `contexteDeLaCarte`, `refusDUneCarte`, `vueDeLaRencontre`, et ce qui se joue sur place, dans la page (`seJoueSurPlace`, `ATTENDENT_LE_SERVEUR`, `jouerSurPlace`, `vueApresLaCarte`, `viesDuCourage`, `GesteAvecSesCartes`)
- `shared/codex.ts` — le codex (la version 7), pur : les exploits (`EXPLOITS`, `CleDExploit`, `exploitDe`, `PARI_DE_L_EXPLOIT`, `BONNES_D_AFFILEE` ; le pli les relève, `EtatDeLExpedition.exploits` et `affilee`, `RencontreEnCours.perdu`), le bilan d'une expédition (`BilanDUneExpedition` — ses exploits depuis la version 2 —, `VERSION_DU_BILAN`, `lireLeBilan`, `ecrireLeBilan` ; le pli le compte, `EtatDeLExpedition.bilan`, `bilanDuPli` — aux règles d'avant, une question trouvée vaut un adversaire tombé), la renommée (`RENOMMEE`, `renommeeDe`), les niveaux d'explorateur (`NIVEAUX`, `NIVEAU_MAX`, `niveauDe`, `progressionDe`), l'échelle — ce que chaque niveau ouvre, cartes, règles, styles et dos (`ECHELLE`, `RegleDuCodex` : `pari`, `fioles`, `talismans`, `fetiche` ; `niveauDeLaRegle`, `ouvertureDe` ; `MarcheDuCodex.styles`, `stylesDuNiveau`, `niveauDuStyle`) —, les dos de cartes (`DosDuPaquet`, `DOS_DES_CARTES`, `dosDe`, `ouvertureDuDos`, `dosOuverts` : l'étoilé à l'échelle, le doré par son exploit, `Exploit.dos`), le codex d'un départ (`CodexDuDepart`, `codexDuNiveau` : l'échelle jusqu'à son niveau, la carte de chaque exploit qu'il a fait et de chaque légendaire qu'il a, ses exploits, ses dos ; `regleOuverte`, `REGLES_D_AVANT_LE_CODEX`), les offres (`offreDuCodex` : parmi les cartes ouvertes, une famille pèse ce que le paquet en tient ; le trésor d'un gardien, `legendaire` ; un style, une de ses cartes d'abord — une que le paquet n'a pas encore, s'il en reste —, puis deux de partout, au même poids ; le style du départ, `styleDuDepart`, `shared/expedition.ts`), l'Ascension (`ASCENSION` — ses cinq crans et leur phrase —, `ASCENSION_MAX`, ses constantes — `POINTS_EN_ASCENSION`, `FRAPPE_EN_ASCENSION`, `REPOS_EN_ASCENSION`, `ENERGIE_EN_ASCENSION`, `GARDIENS_EN_ASCENSION` —, ce que chaque cran change, une seule règle pour le pli et la page : `pointsDeLAdversaire`, `frappeDeLAdversaire`, `reposALAscension`, `energieDesActesALAscension`, `energieDuTour` — l'énergie de chaque acte à son cran ; ce que les victoires ouvrent, `ascensionOuverte`, et ce qu'une victoire ouvre, `cranOuvertParLaVictoire` ; son cran au bilan, `BilanDUneExpedition.ascension`). Dans `shared/rencontres.ts`, `VERSION_DU_CODEX` et les cartes retouchées par lui (`CarteDeRencontre.avantLeCodex`, `carteALaVersion`, `ContexteDesChiffres`, `enPlusDeLaBibliotheque`). Le serveur lit la renommée, les exploits et le cran ouvert dans le lot de la page et du départ (`lecturesDeLaRenommee`, `renommeeLue`, `codexLu`, la colonne `campagne_series.bilan`) et la page les reçoit (`PageDeLExpedition.prochaine.codex` — `CodexDeLaPage.ascension` —, `CartesEnJeu.codex` — ses exploits d'alors, le cran qu'il avait ouvert, `ascensionOuverte` —, `CartesEnJeu.ascension` — le cran de l'expédition, que le pli lit par `ascensionDuDepart`, `EtatDeLExpedition.ascension` —, `VueDeLExpedition.renommee`, `VueDeLExpedition.exploits` — ceux de l'expédition)
- Le serveur des rencontres : `rencontresOuvertes`, calculées une fois par `server.ts` — l'option `rencontres` du serveur les ferme — et données aux routes comme à L'Explorateur, et les options du départ (`server/src/expedition.ts` : `rencontres`, `style`, `fetiche`, accordées là où elles s'ouvrent — partout, leur drapeau ouvert ; `partirEnExpedition` prend son style parmi ceux de son codex, sinon le premier des siens, et la fétiche avec l'Érudit seul), la page qui les prend (`PageDeLExpedition.prochaine.rencontres`), le geste `voir` (sa mise, `gesteRecevable`), `questionsApresLeGeste` (Corser, Simplifier : la question reposée de la base à sa forme neuve, dans le lot du geste ; voir un dévoilement lance ses mots), le tirage d'une question à la fois (`tirerPourLExpedition` : `tiree`, `six`, `reponseEn`), la question cachée tant qu'il prépare (`vueDeLExpedition`, `repondreEnExpedition`, `devoilement`), la colonne `joker` du premier indice joué (`jokerQuiAide` — la fiole de clairvoyance aussi), le coup de la réponse (`ReponseDExpedition.coup`) ; les objets : le geste `boire` (`gesteRecevable` : la règle ouverte, sa position, `refusDeLaFiole`), la fiole d'un coffre prise ou celle de l'échoppe achetée, le dos du départ (`partirEnExpedition`, `dos` : celui demandé s'il l'a, sinon le plus rare) ; son cran de l'Ascension (`ascension` : borné à ceux qu'il a ouverts, aucun sans le demander)
- `client/src/views/RencontresDExpedition.tsx` — les pièces des rencontres, que `ExpeditionApp.tsx` assemble, revues le 18 octobre 2026 pour qui découvre (« je veux que ce soit bien compréhensible pour des novices ») : le courage dans la barre (`Courage`), l'énergie — l'inspiration du code — en orbe chiffré (`Energie`), une carte dessinée comme une vraie (`CarteDessinee`, revue le même soir — « les cartes c'est des rectangles pas très jolis » — : l'œuvre peinte, `client/src/components/OeuvrePeinte.tsx` (`OeuvrePeinte`, le 25 octobre 2026 : le cadre sorti de la carte pour le Cabinet de curiosités, dont les œuvres sont ces cartes) — son cadre de rareté (`gemmeDeLaRarete`, `RARETE_DITE`), son illustration sur la teinte de sa famille, `TEINTE_DE_LA_FAMILLE`, son nom au bandeau, la gemme de sa rareté ; trois tailles, `TailleDOeuvre` : `main` — sans un mot —, `rangee` — son nom, serré s'il a un mot de onze lettres, `serre` —, `levee` — sa phrase ; son illustration peinte, `CARTES_PEINTES` — `client/src/components/cartes-peintes.ts`, écrit par `server/scripts/anime/cartes.ts`, skill `peindre` —, la grande levée, la petite ailleurs ; une carte de légendaire, son médaillon (`VisageDuLegendaire`) ; le cadre doré du Cabinet (`doree`) —, et ce que la rencontre y ajoute : l'orbe de son coût au coin, rouge s'il manque d'énergie, son chiffre en médaillon, `CarteDeRencontre.valeur`, sa phrase levée, le « + » d'une améliorée), sa main (`VisageDeLaCarte`, `MainDeRencontre` — ses cartes dessinées, sans un mot ; ce qu'elles font se dit à l'oreille (`FaceDeLaCarte`, `CarteDeRencontre.resume`) et levées ; avant la question, celles de maintenant puis, à part et éteintes, celles de pendant ; la question vue, celles-là seules ; sur la carte, en petit, `enPetit` —, `CarteLevee` — en grand, ce qu'elle fait, quand, et ce qu'elle changerait, « Avec cette carte » (`changementDeLaCarte`) ; sans `onJouer`, on ne fait que la regarder —, `FeuilleDesCartes` : chaque tas en vraies cartes qui défilent, `RangeeDeCartes` — la pioche déduite, la défausse, les épuisées, tout le paquet ; `choisie`, la carte qu'on retire au campement —, la règle du cycle), le codex (`FeuilleDuCodex`, le 18 octobre 2026 — « un codex de carte global, avec de commun à légendaire » — : toutes les cartes des rencontres en vraies cartes, une page par rareté en puces qui comptent, `onglets-puces`, ouvert de « Ton codex » au départ ; les fermées en gris, le niveau qui les ouvre dessous, `exp-codex-fermee`, et levées, `CarteLevee` `ouverture`), le niveau d'explorateur au départ (`NiveauDExplorateur`, sa jauge) et la renommée gagnée à la fin (`RenommeeGagnee` : « Tu passes au niveau N », les cartes qui rejoignent le codex, les règles qui s'ouvrent, chaque exploit neuf et ce qu'il ouvre — `exploitsNeufs`, `recompenseDe`), les exploits au pied du codex (`exp-exploits`) et dans les règles, ses dos dessous (`exp-un-dos`), le dos de la pioche sur le plan (`dosDuPaquet` — celui du départ, `CartesEnJeu.dos` —, `MainDeRencontre` `dos`, `classeDuDos` : `exp-dos-etoile`, `exp-dos-dore`) et son choix au départ (`ChoixDuDos`, dès deux dos ; retenu sur le téléphone, `dosRetenu`, `retenirLeDos`, `quizz.expedition.dos`), l'Ascension au départ (`ChoixDeLAscension`, dès une victoire : ses crans ouverts, ce que le choisi ajoute ; retenu sur le téléphone, `ascensionRetenue`, `retenirLAscension`, `quizz.expedition.ascension` — `haut` au plus haut), dans les règles (la section `ascension`, et le repos à son cran) et à la fin (`RenommeeGagnee` `ascension` : le cran que la victoire ouvre) — la page la dit aussi au titre du plan (`exp-pastille-cran`), sous « Reprendre » et en tête de la fin —, les fioles (`SesFioles` dans la barre, `FioleLevee`, `VerreDeFiole` à la teinte de chacune, `TEINTE_DE_LA_FIOLE` ; `BoireUneFiole`, posé par `aSaVersion` — nul à la révélation, où une fiole ne fait que se regarder), la version des cartes que la page montre (`VersionDesCartes`, `useCarte` : une expédition d'avant le codex les montre à ses chiffres d'alors ; `ExpeditionApp` pose la version de la vue, `aSaVersion`), l'offre en trois vraies cartes côte à côte (`CartesAPrendre` : la phrase de la touchée dessous, rien avant), l'adversaire (`Adversaire` : ses points en jauge, la question qu'il pose sans son texte ; compact la question sous les yeux), ce que la réponse fera (`Apercu` : deux tuiles, « Si tu as juste », « Si tu te trompes », refaites à la mise et à la carte levée par `apercuALaMise`), la préparation entière (`PreparationDeLaRencontre` : l'adversaire, l'aperçu, la main, le pari, « Voir la question » ; à la première, les règles en feuille, retenues sur le téléphone, `quizz.expedition.guide-rencontres`), les règles (`FeuilleDesRegles` — en rencontres, `reglesDesRencontres`, ce que tire chaque acte lu de la vue ; aux règles d'avant, `reglesDesJokers` ; `debut`, la section à lire d'abord — et `BoutonDesRegles`, le « ? » du haut de chaque page), la révélation (`verdictDeLaRencontre`), le départ (`ChoixDuStyle` — ses styles en tuiles à la teinte de leur famille, `ICONE_DU_STYLE`, celui qui partira, sa façon de gagner, ses deux cartes et ce qu'elles remplacent, le prochain à s'ouvrir ; retenu sur le téléphone, `styleRetenu`, `retenirLeStyle`, `quizz.expedition.style` ; avec l'Érudit, sa catégorie fétiche —, la section `style` des règles, `FeticheDuDepart` — sa catégorie fétiche seule, d'un serveur sans styles ; retenue sur le téléphone, `quizz.expedition.fetiche` ; plus d'interrupteur depuis le 19 octobre 2026 : `quizz.expedition.rencontres` n'est plus lu —, `FeuilleDeLaFetiche`), les cartes dépliées de l'équipe (`ToutesLesCartes`), la ligne d'une carte à l'échoppe (`LigneDeCarte`). Sa section de `styles.css` suit celle de l'expédition (« Les rencontres »)
- `server/scripts/rendu-rencontres.ts` (client construit d'abord) · `server/scripts/calibrage-rencontres.ts` (`--expeditions`, `--cas`, `--version` — la 9 d'office, les huit familles ; la 10, la question au centre, et son joueur à elle, qui voit la question d'abord, `PREFERENCE_EN_QUESTION` ; la 11, ses coups de pouce et ses questions à composer, `PREFERENCE_DES_COUPS_DE_POUCE` —, `--niveau`, `--sans-fioles`, `--sans-ameliorations` — le même joueur, qui n'améliore rien lui-même —, `--ascension`, `--ascensions` : chaque cran au codex entier ; `--seule`, `--cartes`, `--part` : chaque carte seule contre rien ; `--style`, `--styles` : chaque style suivi, contre le départ sans style, et la variété des cartes proposées et jouées ; `--avise` : le style sans le suivre) — les écrans des rencontres en 360 × 640, d'un départ à la fin — au codex, un débutant au niveau 1 et Léa au niveau 6, le trésor d'un gardien, ses fioles, ses dos, la renommée de la fin — ; la chance d'aller au bout, la durée, les écus et la renommée de trois joueurs simulés, niveau par niveau d'explorateur, puis leur carrière du niveau 1, expédition après expédition (`PREFERENCE_DU_CODEX` : le joueur qui a appris ne prend que ce qui vaut). `expedition-rencontres.test.ts` (les règles et le pli) · `expedition-rencontres-routes.test.ts` (par les routes : le départ, la question cachée en préparation, la mise, le verdict, la victoire, le dévoilement, Corser, Simplifier ; une fiole achetée puis bue, sa réponse effacée et la colonne `joker`) · `expedition-rencontres-ecran.test.ts` (l'écran, rendu : ni sceaux, ni Charge, ni Garde, ni inspiration ; chaque résumé et chaque chiffre tiennent sur leur carte ; la carte levée annonce ce que le serveur fait ; la préparation dans l'ordre où l'on joue, la main sans un mot ; les règles à la première, et ce que tire chaque acte ; l'aperçu ; la main de pendant la question ; les cartes posées en haut, à côté du « ? » ; l'énergie et le coût au coin des cartes ; les tas en rangées de vraies cartes ; l'offre en trois cartes, rien dessous avant le toucher ; la carte à retirer au campement ; le codex, ses puces et ses cartes ; « le plan », jamais « la carte » de l'acte, dans tout ce que lit le joueur ; les fioles dans la barre et levées, leurs règles ; la barre qui passe à la ligne, ce qu'il porte d'un bloc ; les dos au codex, à la fin et au départ ; l'Ascension au départ — ses crans, le retenu —, dans les règles, à la fin) · `expedition-partir.test.ts` (« ← Partir » mène au départ, qui garde l'expédition en route ; de là, elle s'abandonne ; un débutant n'y choisit pas de légendaires ; « Ton équipe », sa feuille comprise ; le départ sans paragraphes, les gardiens côte à côte, les règles au « ? » ; « Ton codex » aux rencontres ; l'Ascension, rien avant une victoire, aucun cran d'office) · `cartes-peintes.test.ts` (chaque carte sans légendaire a sa peinture, en deux tailles sous empreinte, d'un poids qu'un téléphone porte ; aucun fichier que plus personne ne cite ; la carte dessinée la montre ; l'œuvre peinte, à part — sa peinture, le cadre de la carte, le médaillon d'un gardien, le cadre doré, son chemin sans rien de l'Expédition — et la carte dessinée qui passe par elle ; `/cartes` servi un an)
- La question au centre (la version 10) : dans `shared/rencontres.ts`, ses cartes (`EN_QUESTION` — les mots neufs de chacune, son amélioration, `pari` pour celles du pari —, `carteEnQuestion`, lue par `carteALaVersion(cle, 10)` : undefined pour l'une des quarante-deux de `RETIREES_EN_QUESTION` ; `seJoueEnQuestion`, `estDuPari`, `tireEnPlusEnQuestion`), ses crans (`CRANS_DES_RENCONTRES`, `cransDe`, `cransDeLaForme`, `cransDesPouvoirs`, `cransDUneBonneReponse`, `attaqueEnQuestion`, `gainDuPariEnQuestion`, `chiffresEnQuestion` — les crans d'une carte vont à `charge` —, `apercuEnQuestion`, `frappeDeLaQuestion` qui ne grandit plus sous `RencontreEnCours.enCrans`), sa main (`MAIN_A_L_OUVERTURE_DE_L_ACTE`, `MAIN_MAX_EN_QUESTION`, `MAIN_MAX_SOUS_TROIS_TETES`), son paquet et ses styles (`PAQUET_EN_QUESTION`, `STYLES_EN_QUESTION`, `BASES_REMPLACEES_EN_QUESTION`, `paquetDesRencontres(…, v)`), ses fioles (`FIOLES_EN_QUESTION`, sans l'énergie), et la branche des refus (`refusDeLaCarte`) ; dans `shared/codex.ts`, son échelle (`ECHELLE_EN_QUESTION`, `echelleDe`, et la version que prennent `stylesDuNiveau`, `niveauDuStyle`, `niveauDeLaRegle`, `ouvertureDe`, `codexDuNiveau`) et son Ascension (`ASCENSION_EN_QUESTION`, `ascensionDe`, `cransDeLAdversaire`, `mainMaxEnQuestion`) ; dans le pli (`shared/expedition.ts`), la main de l'acte (`EtatDeLExpedition.cycle` : `ouvrirLeCycle`, `piocherEnQuestion`, `ajouterALActe`, `seTireDansLActe`), le tour (`nouveauTourEnQuestion`), le verdict (`jugerEnQuestion`), la carte jouée (`jouerEnQuestion`), Augure d'avance (`EtatDeLExpedition.dAvance`), et ce que la vue en dit (`VueDeLaRencontre.crans`, `mainMax`, `aubeEteinte` ; `CartesEnJeu.main`, `pioche`, `defausse`, `mainMax`) ; au serveur, `versionDuDepart`, `questionAuCentreOuverte`, `ExpeditionDeps.questionAuCentre`, la page qui la propose (`PageDeLExpedition.prochaine.questionAuCentre`) et le départ qui la prend (`partirEnExpedition`, `questionAuCentre`) ; à la page, `enQuestion`, `useEnQuestion`, `momentDit`, l'adversaire en crans (`Adversaire` : `exp-crans-pastilles`, `exp-cran-vise` — ce qu'une bonne réponse prendrait, de `r.apercu` —, `exp-attaque`), le verdict (`verdictEnCrans`), les règles (`reglesEnQuestion`), la main de l'acte sur le plan (`CarteDeLActe`, `mainDeLActe`, `FeuilleDesCartes` `acte`), « N bonnes réponses pour en venir à bout » (`aFaireTomber`). `server/scripts/rendu-question-au-centre.ts` (client construit d'abord) la photographie en 360 × 640 — un débutant jusqu'au plan de l'acte 2, une joueuse au pari, et une autre sur une base dont les réponses se composent : les coups de pouce et les lettres de la version 11 — et `expedition-question-au-centre.test.ts` la garde : ce qui reste et ce qui part, les crans, le tour, la main de l'acte, une carte par question, chaque carte levée puis jouée — sa promesse tenue, et les crans de sa bonne réponse —, Augure, Le réveil, Le feu d'artifice, Renaissance, l'Ascension, les routes et le drapeau, l'écran et les règles
- Les coups de pouce et les lettres (la version 11, l'étape 3 — le brief et ses écarts, `retours/2026-10-19/les-coups-de-pouce.md`) : `shared/lettres.ts` — ce qui se compose (`gabaritDe`, `seCompose` : deux mots de quatre à douze lettres, `MOTS_A_COMPOSER`, `LETTRES_A_COMPOSER_MIN`, `LETTRES_A_COMPOSER_MAX` ; l'article de tête, `sonArticle` ; l'intitulé qui parle de ses choix, `PARLE_DE_SES_CHOIX`), ses tuiles (`tuilesDe`, `LETTRES_EN_TROP`), ce que le téléphone envoie (`lireUneComposition`) et comment le dire (`compositionDite`, `signesDe`) ; dans `shared/rencontres.ts`, `VERSION_DES_COUPS_DE_POUCE`, les trois cartes (`initiale`, `repere`, `lettre`, `depuis: 11`, leurs améliorations dans `EN_QUESTION`) et leurs refus, la forme dans `effaceesDuTour` — les lettres de trop — et `cransDeLaForme` ; dans `shared/expedition.ts`, la forme `lettres` (`POIDS_DES_FORMES_A_COMPOSER`, `HASARD`), ce que la vue en montre (`QuestionAComposer`, `questionAComposer`, `casesPosees`) et ce que soufflent les cartes (`ceQueDitLInitiale`, `ceQueDitLeRepere`, `ceQueDitLaLettre`, `QuestionDExpedition.pouces`) ; dans `shared/codex.ts`, `ECHELLE_DES_COUPS_DE_POUCE` ; au serveur, `aSaForme` (les tuiles tirées et gardées, `QuestionDeSerie.tuiles`, `enTrop`), `repondreEnExpedition` (la composition jugée, `campagne_reponses.composee`), la correction ; à la page, `ComposerLaReponse`, les lignes des pouces (`exp-pouce`), `LaBonneReponse` (« Tu as composé X — c'était Y »). `expedition-coups-de-pouce.test.ts` la garde : le gabarit, ce qui se compose sur la vraie base, les tuiles, le générateur, les refus, les trois cartes et l'échelle, le pli, puis par les routes — la réponse qui ne part pas, la composition jugée, chaque coup de pouce et sa colonne `joker` — et l'écran ; `calibrage-rencontres.ts --version 11` la mesure
- Les curiosités (la version 12, l'étape 4 — le brief, ses décisions et ses écarts, `retours/2026-10-19/les-curiosites.md`) : `shared/curiosites.ts` — leurs sortes (`SorteDeCuriosite`, `NOM_DE_LA_CURIOSITE`), où elles se posent (`CURIOSITE_DES_L_ETAGE`, `PART_DU_REBUS`), ce que rapporte la récompense (`RARETES_D_UNE_CURIOSITE`, `ceQueRapporteUneCuriosite` — la carte, l'en-tête et les règles le disent des mêmes mots), les rébus (`Rebus`, `GenreDeRebus`, `QUESTION_DU_REBUS`, `emojisDe`, `refusDuRebus`, `EMOJIS_D_UN_REBUS_MIN`, `EMOJIS_D_UN_REBUS_MAX`, `PREFIXE_DU_REBUS`) ; dans `shared/rencontres.ts`, `VERSION_DES_CURIOSITES` ; dans `shared/expedition.ts`, la sorte `curiosite` (`EscaleDeLaCarte.curiosite`, `aUneQuestion`), le générateur (`carteDUnActe(…, curiosites)`, `poserLaCuriosite`), le pli (la réponse sans adversaire ; la récompense, `offrirUneCuriosite`, `OffreDeJokers.curiosite`), le refus des cartes (`refusDUneCarte`), ce que la vue montre (`QuestionDExpedition.rebus`) ; au serveur, `server/src/core/curiosites.ts` (`contenuDesCuriosites` : la liste des plats et les rébus de `server/content/curiosites/`, lus une fois, un rébus qui ne se pose pas écarté) et `core/campagne.ts` (`questionDeLaCuriosite`, `laMoinsVue` : jamais vu d'abord ; la correction et son `rebus`, le signalement refusé, le carnet qui l'écarte) ; à la page, la carte d'une curiosité (`faceDeLEscale`, `CarteDEscale` : sa sorte et son nom, son emblème), sa règle et son en-tête (`recompenseDeLaCuriosite`), ses emojis (`exp-rebus`), sa révélation (`verdictDe`), la récompense (`Offre` : « Curiosité trouvée », « Choisis ta récompense »), et « Mes réponses » (`SerieCorrigee`, `Corrige` `sous`, `.corrige-rebus`). `expedition-curiosites.test.ts` la garde : le générateur, les rébus et les plats livrés, le pli et la récompense, puis par les routes et à l'écran ; `calibrage-rencontres.ts --version 12` la mesure, `server/scripts/rendu-curiosites.ts` la photographie (client construit d'abord)
- La frise (la version 13, l'étape 5 — le brief, ses recommandations appliquées en l'absence du propriétaire et ses écarts, `retours/2026-10-20/la-frise.md`) : `shared/frise.ts` — l'événement (`EvenementDeLaFrise`), ses chiffres (`EVENEMENTS_D_UNE_FRISE`, `ECART_DE_LA_FRISE`, `LIBELLE_MIN`, `LIBELLE_MAX`), sa question (`QUESTION_DE_LA_FRISE`, `PREFIXE_DE_LA_FRISE`), ce qu'une ligne doit être (`refusDuLibelle` : rien qui la date), le choix de quatre événements (`choisirLaFrise`), l'ordre où la page les montre (`ordreMontre`), ce que le téléphone envoie et ce que le serveur juge (`lireUnOrdre`, `ordreDansLeTemps`, `friseJuste`, `ordreGarde`), l'année dite (`anneeDite`), ceux qu'une carte date (`evenementsDates`) ; dans `shared/rencontres.ts`, `VERSION_DE_LA_FRISE`, ses crans (`cransDeLaForme`) et ses refus (`refusDeLaCarte`, `enFrise`) ; dans `shared/expedition.ts`, la forme `frise` (`POIDS_DES_FORMES_A_LA_FRISE`, `HASARD`) et ce que la vue en montre (`FriseAPoser`, `FriseRevelee`, `QuestionDExpedition.frise`, `ReponseDExpedition.frise`) ; au serveur, `server/src/core/frises.ts` (`lignesDesFrises` : les lignes de `server/content/frises/evenements.json`, lues une fois, une ligne refusée écartée ; `evenementsDeLaBase` : leur année, de leur question) et `core/campagne.ts` (`friseDe` — son thème, sa marche, jamais rangés d'abord —, `QuestionDeSerie.frise`, `friseMontree`, `evenementsVus` ; la réponse jugée, la correction et son `frise`, le signalement refusé, le carnet qui l'écarte) ; à la page, `PoserLaFrise` (ses places et ses cartes, `exp-frise-*`) et `FriseRangee` (`client/src/components/FriseRangee.tsx` : la frise rangée, chaque année, et, ratée, où il avait mis chacun — à la révélation, `LaBonneReponse`, et dans « Mes réponses », `SerieCorrigee`, `Corrige` `corps`). `server/scripts/frises.ts` (`verifier`, `ranger`) range les lignes écrites par des agents, `expedition-frise.test.ts` la garde — les règles pures, le contenu livré, le générateur, les cartes, le pli, puis par les routes et à l'écran —, `calibrage-rencontres.ts --version 13` la mesure (`chanceDeLaFrise`), `server/scripts/rendu-frise.ts` la photographie (client construit d'abord)
- Les familles en façons de répondre (la version 14, l'étape 6 — le brief, les quatre choix du propriétaire, ce que le code en a fait et le calibrage, `retours/2026-10-20/les-familles.md`) : dans `shared/rencontres.ts`, `VERSION_DES_FAMILLES`, les cartes des familles (`EN_FAMILLES` — dix-sept reprises que la version 10 avait retirées, sous leur nom et leur peinture, onze retouchées —, lues par `carteALaVersion(cle, 14)`, `PAR_CLE_DES_FAMILLES`), la façon de répondre de chaque style (`JEU_DES_FAMILLES`, `jeuDuStyle`, `stylesDeLaVersion`, `STYLES_DES_FAMILLES` : le Rempart revient, `BASES_REMPLACEES_EN_QUESTION`), le second essai (`secondEssaiDuTour`, `ESSAI_SUR_LA_QUESTION`, `aDeQuoiEssayerEncore`, `effaceesAvecLEssai`), ce qui revient (`revientSiJuste`, `REVIENNENT_SI_JUSTE`), ce qui retombe à l'erreur (`RETOMBENT_A_L_ERREUR` : Troisième œil, Inarrêtable) et ce qui fait tirer (`cartesTireesDuTour`), la mise de Fortune (`MISE_DE_FORTUNE`, `ecusPerdusDesCartes`, `siJuste`), les formes (`FORME_DES_FAMILLES`, `formeDeLaCarte(cle, v)`), leurs crans (`chiffresEnQuestion`, `cransDesPouvoirs`, `cransDUneBonneReponse` — Troisième œil y plafonne —, `attaqueEnQuestion`) et leurs refus (`refusDesFamilles`) ; dans `shared/codex.ts`, leur échelle (`ECHELLE_DES_FAMILLES`, `REPRISES_DES_FAMILLES`) ; dans le pli (`shared/expedition.ts`), l'essai (`GesteDExpedition` `essai`, `essayer`, `secondEssaiEnAttente`, `choixDeLEssai`, `reponsesEffacees` — la réponse ratée d'abord), ce qui revient (`CoupDeRencontre.revenues`) et retombe (`retombees`), la fétiche de Leçon et de la Bibliothèque (`TourDeRencontre.categorie`, `aTirer`), la question qui se compose (`QuestionPosee.compose`) ; au serveur, `repondreEnExpedition` (l'essai écrit au journal des gestes, `ReponseDExpedition.essai`, `bonne: -1`), `jokerQuiAide` (la carte de l'essai, Troisième œil), `vueDeLExpedition` (la réponse ratée effacée, les pouces d'Astrolabe et de Troisième œil), `tirerPourLExpedition` (`compose`) ; à la page, la bannière de l'essai (`exp-essai`), l'aperçu (« Tu réponds encore », la mise), le verdict (`verdictEnCrans` : ce qui revient, ce qui retombe, la mise perdue), les règles et les styles (`reglesEnQuestion`, `ChoixDuStyle`). `expedition-familles.test.ts` la garde — les cartes et l'échelle, les six styles, les refus, le second essai, ce qui revient, tire ou mise, la fétiche, les formes, ce que souffle le Devin, la promesse de chaque carte levée, puis par les routes et à l'écran —, `calibrage-rencontres.ts --version 14` la mesure (`PREFERENCE_DES_FAMILLES`), `server/scripts/rendu-familles.ts` la photographie (client construit d'abord)
- Le détail (la version 15 — le brief, ses mesures et ses écarts, `retours/2026-10-20/le-detail.md`) : dans `shared/expedition.ts`, la forme `detail` (`POIDS_DES_FORMES_AU_DETAIL`, `CATEGORIE_DU_DETAIL` — posée sur l'escale après le tirage —, `HASARD`), ses cadrages (`CADRAGES_DU_DETAIL`, `MS_PAR_CADRAGE`, `cadragesMontres`, `instantDuCadrage` — Arrêt sur image compris —, `adresseDuCadrage`), sa question (`QUESTION_DU_DETAIL`), ce que la vue en montre et ce que révèle le verdict (`DetailAPoser`, `QuestionDExpedition.detail`, `TableauRevele`, `ReponseDExpedition.detail`), l'annonce avant de le voir (`nouveauTourEnQuestion`), et l'acte 3 plus dur (`MARCHES_PLUS_DURES`, `marchesDe`, `marcheDe(acte, escale, v)`) ; dans `shared/rencontres.ts`, `VERSION_DU_DETAIL`, ses crans (`cransDeLaForme`, l'aperçu `auPremierMot`), ses refus (`DETAIL_SANS_AUTRE_FORME`, Deux visages, Arrêt sur image qui s'y joue), l'Élan retouché (`EN_DETAIL`, `enQuestionALaVersion`, `PAR_CLE_DU_DETAIL` ; `effaceesDuTour(…, v)`, `pouvoirsQuiEffacent`, `retombentALErreur`), la rareté qui pare (`PARADE_DE_LA_RARETE`, dans `attaqueEnQuestion`), le soin à moitié (`SOIN_DU_DETAIL`, `soinALaVersion` — `soinALAscension` dans `shared/codex.ts` —, `effetDeLaFiole`), les offres plus riches en épiques (`RARETES_DU_DETAIL`) et les cartes du second essai que le carnet lit (`CARTES_DU_SECOND_ESSAI`) ; au serveur, `server/src/core/details.ts` (`tableauxDuDetail` : la fiche lue une fois, un tableau sans ses cadrages écarté ; `detailsDeLaBase`, `demandeLePeintre` ; `fichierDuCadrage`) et `core/campagne.ts` (`QuestionDeSerie.detail`, le tirage `detailPourUneEscale` — jamais vu d'abord, aucune de ses questions —, `devoileA` qui compte ses cadrages, la vue, le verdict, la correction et son `detail`, `cadrageDuDetail` et sa route `GET /api/expedition/:id/detail/:position/:cadrage`, le carnet `suivisDe`) ; à la page, `components/TableauDuDetail.tsx` (`useCadrage` à `serverNow()`, `DetailQuiSElargit` — le dernier cadrage chargé reste tant que le suivant se charge, un 425 se redemande) et `components/TableauEntier.tsx` (la révélation, `SerieCorrigee` — à part : « Mes réponses » ne charge pas les règles de l'expédition), l'annonce (`FORME_DITE`, sa consigne), les règles (`reglesEnQuestion` : sa ligne, l'acte 3 et son gardien expert, la parade de la rareté — `partDite`), le moment d'une carte qui retombe (`momentDeLaCarte`). `expedition-detail.test.ts` la garde — les cadrages, les crans, les tableaux livrés, le tirage, le générateur, l'acte 3, les cartes, le pli, l'Élan, puis par les routes et à l'écran, et le carnet —, `calibrage-rencontres.ts --version 15` la mesure, `server/scripts/rendu-detail.ts` la photographie (client construit d'abord)
- Les images du détail (`retours/2026-10-20/la-frise.md`, « Le détail, quand les images viendront ») : `server/content/details/` — `tableaux.json` (un tableau par ligne : Wikidata, titre, peintre, années, fichier Commons, quatre cadrages emboîtés en fractions, les questions de la base qui le demandent) et `<QID>-<1..4>.webp`, du détail au tableau entier. Hors de `client/public` (invariant 1) : la forme sert chaque cadrage à son heure (`cadrageDuDetail`). `server/scripts/details.ts` les refait — le détail de chaque tableau choisi à l'œil (`DETAILS`), les écartés et pourquoi (`ECARTES`) ; Wikimedia rationne la fabrique des miniatures 1920 jamais demandées (429), la 1280 passe —, `details.test.ts` garde la fiche
- La voie : `shared/legendaires.ts` (`avecLExpedition`, `cleDeLExpedition`, `estUneVoieDExpedition`, `legendaireDeLExpedition`, `voiesMontrees`) — chaque légendaire qui a son joker se gagne aussi en le gardant au bout — ceux de saison à leur saison seulement, le 18 octobre 2026 — (une voie `aussi`, la ligne `expedition:<clé>` de `profile_badges`, rangée sous `#campagne:<série>`, comme une saison) ; l'album lui donne son lieu (`shared/album.ts`, `expedition` ; `ouIlSeGagne` se dit voie par voie), les pistes et « le plus proche » l'écartent (`shared/pistes.ts`, `shared/proches.ts`), l'étagère et le compte des badges aussi (`ProfileStore.etagereDe`, `badges`)
- `server/scripts/rendu-expedition.ts` (client construit d'abord ; `ivoire` en argument : six légendaires rangés sur le profil, le Dragon d'Or en invité du jour par `horlogeDuJour`, puis l'horloge à Halloween et `calendrierDesExpeditions` rouvert pour la cinquième) · `server/scripts/calibrage-expedition.ts` (`--expeditions`, deux mille par défaut ; `--garder`, le joueur qui garde ses jokers rares et légendaires pour le gardien) — tous les écrans en 360 × 640, chaque joker qui passe compris ; la chance d'aller au bout de trois joueurs simulés, sur le vrai générateur et le vrai pli, sans jokers, avec le paquet de départ, avec deux équipées
- Les tests : `expedition.test.ts` (les routes de bout en bout, la source, les gardiens qu'il a, l'ouverture en production), `expedition-carte.test.ts` (le générateur, les chances, le tracé), `expedition-carte-ecran.test.ts` (l'écran de la carte, rendu : une seule escale éclairée sur l'acte en petit, ses escales des boutons qui se disent à l'oreille, sans feuille où l'ouvrir en grand, les escales permises seules en cartes, de gauche à droite, la plus sûre à son ruban, ce que chaque carte rapporte, un mélange et ses emblèmes, la ligne de l'escale touchée, le gardien choisi d'office au campement ; la main en cartes au cadre de leur rareté, en petit sur la carte, les posés dans la barre ; la carte levée, son geste ou son refus), `expedition-question-ecran.test.ts` (une question à l'écran : les deux réponses de Double chance cochées, leur filet tenu sous le survol collé du téléphone), `expedition-pli.test.ts` (le pli), `expedition-legendaires.test.ts` (la voie, les jokers, la voie montrée), `expedition-jokers.test.ts` (chaque joker dans le pli : la main, la défausse, les posés, les offres, le campement, l'équipée), `expedition-mesure.test.ts` (par les routes : l'équipée et l'invité, ce qu'un joker montre sans la bonne réponse, la colonne `joker`, la mesure, la précision, le carnet, Échange et Passe-muraille, aucun joker hors de l'expédition), `expedition-charge.test.ts` (les allers-retours de chaque geste, comptés ; ce qu'il a vu relu après une réponse ailleurs ; une écriture ratée oubliée), `expedition-sur-place.test.ts` (les cartes jouées sur place : chacune, puis des expéditions entières au hasard, donnent la vue du pli ; celles qui attendent le serveur ; par les routes, la vue entière que la page prédit, le lot écrit d'un aller-retour au journal de gestes partis un à un, un lot refusé qui n'écrit rien), `expedition-tirage.test.ts` (le tirage d'une escale : ce qu'il lit, ses règles), `expedition-formes.test.ts` (six choix, vrai ou faux, le dévoilement et sa route, Arrêt sur image, ce qu'une autre forme ne mesure pas, les offres d'avant), `expedition-ecus.test.ts` (les écus dans le pli : les pistes, le dévoilement, l'élite, le gardien, le coffre passé, Quitte ou double, l'échoppe, les talismans, l'inconnu, la lanterne et la boule, une expédition d'avant les écus), `expedition-echoppe.test.ts` (par les routes : les écus qui meurent avec l'expédition, l'échoppe et ses refus, l'inconnu caché jusqu'à son dévoilement, le piège qui finit d'un geste, la loupe), `expedition-themes.test.ts` (sur la vraie base : les thèmes pointus d'une carte, jamais une rubrique ni une époque remplacée), `expedition-passeport.test.ts` (le tampon d'un thème pointu trouvé, la carte qui signale les autres, le Globe-trotter), `expedition-saison.test.ts` (la fête sur les cartes, son légendaire à l'acte 3, le calendrier rouvert), `codex.test.ts` (l'échelle et les exploits, la renommée et les niveaux, le codex d'un niveau et ses règles, les offres et le poids des familles, les cartes retouchées à leur version, le pli au niveau 1 — ni pari, ni talisman —, le trésor d'un gardien, le bilan ; chaque exploit dans le pli — vingt d'affilée et le gardien de l'acte 3 intact de trois actes sans faute, l'erreur qui les coûte, le pari de 40, l'élite tombée d'une seule réponse et pas un adversaire ordinaire, les règles d'avant ; les fioles — leur règle au niveau 3, celle d'un coffre, l'échoppe et les deux places, chaque effet — et les dos ; l'Ascension — les crans que les victoires ouvrent, ce que chacun durcit dans le pli, une expédition d'avant qui l'ignore), `expedition-codex.test.ts` (par les routes : le bilan écrit à chaque fin, abandon compris ; la renommée relue des bilans, le codex figé au départ ; les bilans absents, illisibles ou d'une autre version — la 1 comprise — refaits une fois ; les exploits relus, leur carte ouverte, figés au départ ; la carte des légendaires qu'il a, l'invité seul en équipe ; le dos du départ ; le cran ouvert par une victoire, borné et figé au départ, gardé par le bilan), `expedition-styles.test.ts` (« Ton style » : l'échelle qui ouvre trois styles au niveau 1 puis un par niveau, chacun à ses trois communes ; le paquet d'un style et ce qu'il remplace ; les offres sans style, celles d'avant lui carte pour carte ; celles d'un style — une des siennes d'abord, une neuve s'il en reste, deux de partout au même poids — ; le pli ; le départ par les routes — un style fermé, ce qui n'en est pas un, la fétiche à l'Érudit seul — ; ses tuiles au départ et ses règles), `expedition-jeu-complet.test.ts` (le jeu complet : l'énergie de chaque acte, les offres et leurs épiques, une expédition d'avant qui n'en tire aucune ; chaque carte neuve levée puis jouée — sa promesse tenue par le pli —, ses chiffres et ses refus ; ce qui tient toute la rencontre, ce qu'une bonne réponse laisse à la suivante, les formes, les indices, les écus et le courage des cartes ; la gemme de l'épique et celle de la maudite, l'aperçu, les règles) · `expedition-huit-familles.test.ts` (les huit familles : leurs seize cartes, et aucune dans une expédition d'avant ; chacune levée puis jouée — sa promesse tenue par le pli — ; le doute avant le verdict, qui ne dure que sous Paranoïa, l'adversaire tombé de son doute qui n'attaque pas ; Engrenage, Hantise, Zizanie, Objection, Coup de grâce ; le courage qu'on paie et ce qui frappe de ce qui manque ; Adrénaline, Berserk ; la pastille du doute, l'aperçu, l'en-tête de la révélation, le verdict et les règles) · `expedition-ameliorations.test.ts` (les cartes améliorées : le catalogue des soixante-dix-sept et ce que chacune gagne, aucune qui fasse moins que sa carte, chacune levée puis jouée — sa promesse tenue par le pli —, ses refus, le campement et l'échoppe, les offres des actes 2 et 3 et leur fil, une version 7 qui n'en améliore aucune, la garde des clés cherchées seules, le « + » à l'écran, avant et après — ce que fait chacune —, les règles) · `expedition-journal.ts` (pas un fichier de tests : le journal écrit comme le serveur et les plans faits à la main — la forge, un campement avant l'élite —, et les pièces de la page rendues, que les deux précédents partagent)

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
- **Un vrai ou faux tiré d'une question à quatre choix garde sa bonne à
  part** (`QuestionDeSerie.bonneReponse`, posée par `aSaForme`) : ses
  réponses devenues « Vrai » et « Faux », la révélation ne disait que
  « « Eschyle » : faux » (un testeur, le 19 octobre 2026). Elle ne part
  qu'avec le verdict et la correction, la proposée fausse
  (`bonneReponseDuVraiOuFaux`) ; un vrai ou faux tiré avant elle la relit
  dans la base, tant que la base juge la proposée comme lui. La vue choisit
  les champs d'une question un à un (`montree`, `questionMontree`) : un champ
  neuf de la question gardée n'y part jamais de lui-même — ne l'étale pas.
- **Une réponse aidée ne mesure rien** : `campagne_reponses.joker` porte la
  clé de son joker (`JOKERS_QUI_AIDENT`) ; la mesure des difficultés, le
  modèle du savoir, les écussons, la précision et L'Érudit ne lisent que
  les réponses nues (`reponseNue`, `premiereReponse` nulle quand la
  première était aidée — le journal des réponses,
  `core/journalDesReponses.ts`), et une bonne réponse aidée ne retrouve
  rien au carnet — une erreur aidée y entre. Échange et La mue posent une
  autre question, nue. Une lecture neuve de `campagne_reponses`, ou une
  dérivation de plus du journal, qui mesure un savoir écarte les réponses
  aidées.
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
  escale, un geste, une mauvaise réponse, un ; une bonne, deux ;
  `expedition-sur-place.test.ts`, des cartes jouées sur place et la
  question vue, un.
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
  réponses : le départ et l'en-tête le disent (`aLui`). La luciole s'offre
  au même endroit, avant de clore (la Première traversée, le 20 octobre
  2026 : `ProfileStore.offrirUnCompagnon`, règle `profil.md`) : l'offrir deux
  fois ne change rien, et seule la première menée au bout l'annonce
  (`ApresUnGeste.compagnon`, `CompagnonRejoint` à la fin). Qui avait déjà
  mené une expédition au bout l'a reçue au démarrage, une fois
  (`rattraperLesPremieresTraversees`, `issue = 'legendaire'`, drapeau
  `campagne_meta.premieres_traversees`) : une autre façon d'aller au bout
  passerait par là aussi (`luciole.test.ts`).
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
  (`campagne_reponses.forme`), que `reponseNue`, la mesure et
  `premiereReponse` écartent ; le carnet n'écarte que la bonne réponse
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
  son niveau — le premier depuis « Ton style » — et, un style posé, avec
  l'Érudit seul : envoyée autrement, le serveur l'ignore.
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
- **Un style se fige au départ, et sans style une offre se tire comme avant
  lui** (« Ton style », le 19 octobre 2026) : le départ garde son style
  (`DepartDExpedition.style`) — parmi ceux que son codex ouvre ; un style
  qu'il n'a pas encore part au premier des siens, sans refus ; rien, ou ce
  qui n'est pas un style, aucun —, et le pli ne le lit qu'au codex
  (`styleDuDepart`). Un champ neuf, sans version : `offreDuCodex` sans style
  tire son hasard dans le même ordre qu'avant lui, et
  `expedition-styles.test.ts` garde six offres d'avant, carte pour carte —
  une retouche des offres qui décalerait un tirage sans style changerait
  celles d'une expédition en route. Le paquet d'un style se relit à chaque
  pli, de `CARTES_DE_DEPART_DU_STYLE` et de `BASES_REMPLACEES_PAR_LE_STYLE` :
  en changer une ligne change le paquet d'une expédition partie — une
  retouche monte la version du départ. Le trésor d'un gardien garde sa
  légendaire d'abord ; la carte du style vient ensuite.
- **Un style se mesure suivi** (`calibrage-rencontres.ts --styles`, le
  19 octobre 2026) : le joueur qui ne prend que les cartes de sa famille,
  pas celui qui a appris — avec un style, il fait autant que sans (`--avise`).
  Suivies à la lettre, les familles qui ne font qu'attaquer laissaient le
  paquet sans boucliers : prises à la place d'une Concentration et d'une
  Prudence, les cartes de départ de l'Érudit menaient le moyen au bout
  43 fois sur cent au niveau 3, le Flambeur 34, contre 72 sans style — d'où
  `BASES_REMPLACEES_PAR_LE_STYLE` (53 et 43 ensuite) ; au niveau 10, le
  Flambeur suivi reste à 35, le Rempart à 94. Un style neuf, ou une carte
  qui en change, se mesure ainsi avant d'entrer ; et le poids des familles
  du paquet ne joue plus sous un style — il tirait les deux autres cartes de
  l'offre vers lui, et les offres d'un style montraient un quart de cartes
  différentes de moins.
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
  **On lit ce qu'on améliore avant de le choisir** : la carte touchée se
  montre avant et après (`AvantApres`), chacune avec sa phrase, son coût,
  son moment et s'il ne sert qu'une fois (`CeQuElleFait`) — « +4 › +6 » et
  « +6 au lieu de +4 » ne disaient ni ce que fait la carte, ni ce que fera
  son amélioration (un retour du 19 octobre 2026). Une amélioration
  « Gratuite » ou qui la fait revenir garde la même phrase : c'est la ligne
  dessous qui change.
- **Le doute se compte à part, avant le verdict** (les huit familles, le
  19 octobre 2026) : le pli le prend aux points de l'adversaire avant de
  juger la réponse (`rongeDuDoute`), puis le fait retomber — Paranoïa le
  garde, Hantise et Engrenage en sèment pour la question suivante
  (`douteApresLaQuestion`, `douteDUneErreur`) —, et le coup le porte à part
  des points brisés (`CoupDeRencontre.doute`). Ce qui relit ce qu'une
  réponse a coûté à l'adversaire additionne les deux : lu des seuls points
  brisés, l'en-tête de la révélation gardait ce que le doute avait pris, et
  sa pastille (`adversaireALaRevelation`). Tombé de son doute, il n'attaque
  pas — le pari est perdu quand même. Une carte qui sème le doute s'écrit
  dans `chiffresApresLaCarte`, comme une autre : la carte levée le promet.
- **Un dégât sûr vaut cher** (le calibrage des huit familles) : ce que
  l'adversaire perd juste ou faux pèse bien plus qu'un « +N si juste ». Il
  baissait de 1 par question et s'additionnait : Insinuation menait le
  moyen au bout 90 fois sur cent contre 50 ; ne retombant plus qu'une fois,
  à 3, elle ajoutait encore quinze points, Engrenage vingt-trois, Hantise
  — 1 par carte jouée — trente et un. Réglées à 2, à 1 par erreur et à 1
  par question, elles en ajoutent six à huit. Une carte qui frappe juste ou
  faux se mesure seule (`--cartes`) avant d'entrer, et part du plus bas
  chiffre.
- **Une carte qui se paie en courage** (`courageDeLaCarte`) : le pli prend
  son prix quand elle est jouée, avant le verdict ; elle ne se joue pas s'il
  ne lui en reste pas plus que son prix (`refusDeLaCarte`) — elle
  l'achèverait — ; levée, elle dit ce qu'elle prend (« Ton courage, tout de
  suite »). Un style se mesure aussi joué par qui l'a choisi sans le suivre
  (`--avise`) : parti avec Fougue et Coup de sang, deux cartes qui se
  paient, le Téméraire avisé menait le joueur faible au bout 18 fois sur
  cent, contre 31 sans style — il part avec Fougue, à 1, et Cicatrices.
- **Une carte de préparation se joue sur place** (la phase d'optimisation,
  le 19 octobre 2026 — « optimisation des performances […] chargement des
  images / requêtes ») : chaque carte jouée coûtait un aller-retour, quatre
  ou cinq par question au réseau d'un téléphone. Celles dont tout l'effet se
  lit de la vue (`seJoueSurPlace` : ni de route, ni de pendant la question,
  ni de celles qui tirent, reposent la question ou rendent du courage —
  `ATTENDENT_LE_SERVEUR`, `formeDeLaCarte`) se jouent dans la page, par les
  règles mêmes du pli (`jouerSurPlace`, `vueApresLaCarte`), et partent avec
  le geste suivant — voir, une carte qui attend le serveur, une fiole —,
  d'un seul aller-retour (`GesteAvecSesCartes.avant`). Le serveur les
  rejoue une à une, toutes ou aucune, et écrit le journal que des gestes
  partis un à un auraient écrit : ni le pli ni le format ne changent, aucune
  version à monter. Une carte de plus dans le `switch` de
  `jouerEnRencontre` entre dans `ATTENDENT_LE_SERVEUR` ; un champ de la vue
  qu'une carte change se recalcule dans `jouerSurPlace`, par la règle que la
  vue du serveur lit — `expedition-sur-place.test.ts` joue chaque carte sur
  place et au pli, puis des expéditions entières au hasard, et refuse la
  moindre différence : L'écholocation, qui ôte la chance de l'annonce, l'a
  montré (`annonceSousLesPouvoirs`). La page garde ses cartes jouées sur
  place tant que la vue du serveur n'a pas bougé (`avecLesCartesSurPlace`) :
  « ← Partir » puis « Reprendre » les retrouve, un geste refusé les rend à
  la main, recharger aussi — rien n'en était parti. Une expédition jouée par
  l'API en faisait 4,5 requêtes par question, 2,6 ainsi : « voir » et la
  réponse restent, la question ne part qu'une fois vue (invariant 1).
- **Les petites peintures du paquet se demandent d'avance**
  (`prechargerLesPeintures`, le même jour) : tirée dans une main, une carte
  jamais vue arrivait sur sa teinte, sa peinture un aller-retour plus tard ;
  la page demande celles de son paquet, d'une offre et d'une échoppe quand
  elle respire, en basse priorité — la révélation qui précède une offre leur
  laisse le temps. Levée, la grande peinture se demande tout de suite, la
  petite dessous tient sa place (`.exp-vc-levee .exp-vc-peinture`). Gardées
  un an (`/cartes`, `immutable`), elles ne voyagent qu'une fois.
- **La carte dessinée est une œuvre peinte** (le 25 octobre 2026, pour le
  Cabinet de curiosités, dont les œuvres sont ces cartes) : son cadre — la
  fenêtre, la peinture ou le médaillon d'un légendaire, le nom au bandeau, la
  rareté dite, la gemme — ne se pose que dans `OeuvrePeinte`
  (`components/OeuvrePeinte.tsx`), et `CarteDessinee` n'y ajoute que ce que
  joue la rencontre, chacun à sa place dans la carte (`coin`, `repli`,
  `valeur`, `texte`, `marque`) : recopié dans `RencontresDExpedition.tsx`, un
  cadre retouché d'un côté ne l'aurait plus été de l'autre
  (`cartes-peintes.test.ts`). Ses classes restent celles de la carte
  (`exp-vc-*`) — à sa sortie, aucun rendu de carte n'a bougé d'un octet,
  chacune à ses trois tailles, avec et sans énergie, aux deux versions de la
  page. Elle n'importe de `shared/rencontres.ts` que des types : un import de
  valeur ferait télécharger ses cinq mille lignes, le codex et l'expédition à
  la page qui ne fait que montrer une œuvre (`cartes-peintes.test.ts` suit
  ses imports, `server/test/chemin-des-imports.ts`). Le cadre doré (`doree`)
  ne sert pas à l'Expédition : sa classe (`exp-vc-doree`), son or écrit en
  dur (`--dorure`), un second cadre d'or au-dedans de celui de la rareté, qui
  garde sa gemme (`.exp-vc-doree::after` : une forme de plus, jamais la
  couleur seule), et levée « cadre doré » à l'oreille — en petit, c'est au
  bouton qui la porte de le dire. Sa famille prend aussi la salle du Cabinet
  qui l'expose, telle quelle (`FamilleDOeuvre`) : le Vestibule y a la teinte
  des neutres ; forcé en famille, il n'en avait plus.
- **La question au centre se lit à sa version, partout** (la version 10, le
  19 octobre 2026) : une carte qui s'y montre ou s'y juge passe par
  `carteALaVersion(cle, v)` — `carteDeRencontre` rendrait ses points et son
  énergie d'avant —, et une carte qu'elle a retirée y vaut undefined : le
  codex, les offres, le paquet et `ouvertureDe` l'écartent d'eux-mêmes. Une
  carte neuve de la version 10 s'écrit dans `EN_QUESTION`, ses crans dans
  `chiffresEnQuestion` ou `cransDesPouvoirs` — jamais dans
  `jouerEnQuestion`, qui ne garde que ce qui ne se chiffre pas —, puis dans
  `ECHELLE_EN_QUESTION` : `expedition-question-au-centre.test.ts` lève et joue
  chacune, et vérifie que l'échelle les ouvre toutes une fois.
- **La main de l'acte est un seul tas** (`EtatDeLExpedition.cycle`) : la
  rencontre en tient les mêmes tableaux (`r.main === e.cycle.main`), pour
  que les règles d'avant — les refus, la vue — les lisent où elles les
  cherchaient. Un tas ne se réassigne jamais : il se vide et se remplit sur
  place (`splice`, `length = 0`), sinon la rencontre et l'acte divergent sans
  bruit. L'acte s'ouvre en rendant tout — la main d'avant comprise — et en
  tirant trois cartes : une carte de circonstance (Arrêt sur image, la
  Prédiction) ne dort pas plus d'un acte dans la main.
- **Le tour de la version 10 s'ouvre sur la question qui n'est pas encore
  tirée** : la rencontre commence au pas, sa question vient dans le lot du
  même geste (`aTirer`). C'est le pli d'après le tirage qui lit sa forme
  (`nouveauTourEnQuestion`) et ouvre l'annonce d'un dévoilement — un pli
  sans elle ouvrirait la question. Ce qui décide de la phase ne lit donc que
  la question qui attend, jamais un état d'avant son tirage.
- **Les cartes du pari dorment hors de l'acte tant que le pari est fermé**
  (`seTireDansLActe`) : tirées au niveau 1, elles prendraient une place de
  la main sans jamais se jouer. Le trésor d'un invité du jour reste au
  paquet, sans en sortir : le codex, figé au départ, n'ouvre pas le pari en
  route. Elles se jouent à l'annonce, en plus de la carte de la question
  (« plus, à l'annonce, celles du pari », le brief validé) : la règle « une
  par question » ne compte qu'elles exclues (`refusDeLaCarte`).
- **Augure d'avance traverse les rencontres** (`EtatDeLExpedition.dAvance`) :
  jouée, il attend la question suivante qui a de quoi effacer — plus de
  deux réponses —, fût-elle dans la rencontre d'après. Un vrai ou faux le
  laisse passer.
- **Le banc ferme la version 10** (`questionAuCentre: false`, `banc.ts`),
  comme le calendrier : les épreuves d'avant elle partent en version 9,
  telles que la production les jouait jusqu'au 20 octobre 2026 ; les siennes la rouvrent
  (`demarrer({ questionAuCentre: true })`). La page la demande par
  `questionAuCentre: true` dès que `prochaine.questionAuCentre` le dit ;
  demandée où elle est fermée, elle se tait.
- **Une question à composer ne dit jamais sa réponse** (invariant 1, la
  version 11) : la vue vide ses `reponses` et n'envoie que ses cases et ses
  tuiles (`composer`) ; ses tuiles — jamais dans l'ordre de la réponse — se
  tirent avec la question et se gardent avec elle (`tuiles`, `enTrop`), pour
  que recharger redonne les mêmes, et `questionsApresLeGeste` les retire d'une
  question reposée à une autre forme. Le serveur juge la composition, lettre
  pour lettre (`lireUneComposition`). Sa réponse écrit `choix` à la bonne
  réponse si elle est juste, à −1 sinon, et sa composition à part
  (`composee`) : un `choix` nul la ferait disparaître des lectures qui
  comptent les réponses données — les missions lisent `choix IS NOT NULL`.
- **Une carte de la version 11 se lit à sa version** : elle porte
  `depuis: 11`, et `carteALaVersion(cle, 10)` la rend undefined — le codex,
  les offres et `ouvertureDe` d'une expédition de la version 10 l'ignorent.
  Un test qui parcourt tout le catalogue pour une version d'avant le borne à
  ce qu'elle connaît (`depuis`), sinon il comptera les trois neuves. Son
  amélioration vient d'`EN_QUESTION` (`amelioration`), pas
  d'`AMELIORATIONS` : `AMELIOREES` la lit là pour une carte venue après la
  version 10.
- **Les coups de pouce lisent la bonne réponse** : le serveur seul les
  calcule (`pouces`, `composer.posees`). Le repère ne dit jamais l'époque
  d'une réponse qui est une année ou un nombre — elle la donnerait — : sans
  époque à dire, il efface, comme le Sphinx (`effaceesDuTour` — qui reçoit
  donc `nombre` avec `datee` : un appel qui l'oublierait compterait une
  époque là où la vue efface) ; mesuré quand il ne disait que le domaine, il
  faisait perdre des points. L'initiale et La lettre ne se jouent ni sur un
  vrai ou faux, ni sur une année ou un nombre ; sur une question à composer,
  elles posent leur lettre au lieu de la dire, `n − 2` lettres au plus.
- **Une curiosité se tire sur son propre fil, une fois le plan fait**
  (`poserLaCuriosite`, `graine:curiosite:acte`, la version 12) : une
  escale à question des étages 2 à 6 change de sorte, et rien d'autre — ni
  la sorte, ni le thème, ni la forme d'une autre escale. Une sorte de plus
  dans `POIDS_DES_ESCALES_DES_RENCONTRES` aurait décalé tout le tirage du
  plan. Une escale bonus neuve se pose de même, après le plan.
- **Un rébus n'est pas une question de la base** : sa réponse s'écrit sous
  `rebus:<id>` (`PREFIXE_DU_REBUS`), avec la forme `lettres`. La mesure
  l'écarte par sa forme ; le carnet par son identifiant, au journal en
  mémoire (`auCarnet`) comme en SQL (`suivisDeLaBase`) — `compterARevoir`
  compte sans relire la base, le filtre des « questions que la campagne
  pose encore » ne l'aurait pas vu — ; le signalement le refuse ; la
  correction porte ses emojis (`CorrectionDeCampagne.rebus`). Le carnet et
  le signalement lisent son préfixe dans une seule liste, avec celui de la
  frise et du Cabinet (`PREFIXES_HORS_DE_LA_BASE`, `shared/horsDeLaBase.ts`,
  règle `campagne.md`) : une lecture neuve de `campagne_reponses` qui joint
  la base ou reprend une réponse pour la reposer écarte ce qui n'en est pas
  par `horsDeLaBase` en mémoire, par `sqlDansLaBase` en SQL — jamais par un
  `rebus:` recopié, qui oublierait les deux autres.
- **Un champ neuf de la correction se lit aussi à la page** : le serveur
  envoyait les emojis du rébus, et « Mes réponses » ne les montrait pas —
  « Quel personnage se cache derrière ces emojis ? » sans emojis (vu au
  rendu, le 19 octobre 2026). `SerieCorrigee` est la seule liste ; ce que
  l'intitulé désigne se pose juste sous lui (`Corrige` `sous`).
- **La liste des plats se tient à la main**
  (`server/content/curiosites/plats.json`) : un « D'où vient… ? » neuf de
  la base n'est une curiosité qu'ajouté là — un fromage, une sauce, une
  marque, l'origine d'un nom n'en sont pas. Le plat reste une question de
  la base : sa réponse mesure, entre au carnet, se signale.
- **La récompense d'une curiosité n'est pas l'offre d'un combat**
  (`offrirUneCuriosite`) : une seule place à prendre — une rare, la fiole ou
  le talisman —, ni L'horizon, ni les écus d'un coffre laissé ; mais elle
  prend un rang d'offre (`offres`), comme les autres. Une curiosité se
  répond sans cartes (`refusDUneCarte`), et ni trouvée ni ratée elle ne
  touche la série d'affilée (`affilee`) : une escale sans adversaire ne fait
  pas l'exploit.
- **« Cran » dit deux choses** : les crans d'un adversaire (la version 10)
  et ceux de l'Ascension. Sur un même écran — le plan en Ascension, un
  adversaire —, l'adversaire dit ses crans en pastilles et en « N crans »,
  le plan l'Ascension en « Cran N » ; un texte neuf qui parlerait des deux
  les nomme : « les crans de l'adversaire », « le cran de l'Ascension ».
- **Une frise n'est pas une question de la base** (la version 13) : sa
  réponse s'écrit sous `frise:` suivi des identifiants de ses quatre
  questions dans l'ordre du temps (`PREFIXE_DE_LA_FRISE`), avec la forme
  `frise`. La mesure l'écarte par sa forme ; le carnet et le signalement par
  son préfixe, de la même liste que `rebus:` (`PREFIXES_HORS_DE_LA_BASE`,
  plus haut). Ce qu'il a déjà rangé se relit de ces identifiants
  (`evenementsVus`) : un champ de plus pour le dire serait une colonne à
  tenir.
- **L'ordre du temps ne part jamais avant le verdict** (invariant 1) : la
  vue n'envoie que les lignes, dans l'ordre tiré avec la question
  (`QuestionDeSerie.frise.montre`, jamais le bon), et l'année de celles
  qu'une carte a datées ; `reponses` y part vide. La page renvoie les cartes
  par leur rang à l'écran, le serveur les remet en rangs dans le temps
  (`ordreDansLeTemps`) et le journal garde ceux-là (`composee`, « 1032 ») :
  la correction les relit sans l'ordre montré. Une frise se tire et se garde
  avec sa question — recharger redonne les mêmes cartes, au même ordre.
- **Une ligne d'événement ne dit jamais quand** (`refusDuLibelle`) : ni
  nombre de trois ou quatre chiffres, ni siècle, ni décennie, ni « av.
  J.-C. » — la frise se jouerait sans rien savoir. Un nom propre qui porte
  un chiffre romain (« François Ier ») passe : un siècle s'écrit avec son
  mot, et un motif des seuls chiffres romains, insensible à la casse,
  prenait « le » pour le cinquantième. L'année vient toujours de la
  question (`evenementsDeLaBase`, `anneeDe`) : une ligne se récrit, sa date
  ne se tape jamais. Le chargement du serveur écarte une ligne refusée ou
  dont la question n'est plus jouable ; `expedition-frise.test.ts` relit le
  contenu livré et ce qu'il fait à chaque catégorie.
- **Sur une frise, les cartes qui effacent datent** : `effaceesDuTour` les
  compte comme sur quatre réponses — deux au plus —, et la vue date autant
  d'événements, au hasard de `graine:efface:position` comme les réponses
  effacées (`evenementsDates`). Le Sphinx et Le repère y datent sans un mot :
  « Elle ne se date pas » mentirait, elle a quatre années. Une carte neuve qui
  n'a pas de sens sans choix ni lettres s'y refuse dans `refusDeLaCarte`, en
  le disant (« Pas sur une frise : … »).
- **Un second essai n'est pas une réponse** (la version 14) : la clé de
  `campagne_reponses` n'a de place que pour une réponse par question — la
  première, fausse, s'écrit au journal des gestes (`{ quoi: 'essai',
  position, choix? }`), la seconde dans les réponses. Le serveur seul l'écrit
  (`repondreEnExpedition`, `secondEssaiEnAttente`) : `gesteGarde` le relit du
  journal, `lireGeste` le refuse d'une page — sinon un téléphone s'offrirait
  un second essai. Sa réponse ne dit rien de la bonne (invariant 1) :
  `bonne` −1, ni anecdote ni coup ; la vue efface la réponse ratée
  (`choixDeLEssai`, puis `reponsesEffacees`, qui l'efface d'abord) et la
  compte parmi les effacées (`effaceesAvecLEssai` — les refus, les chiffres,
  l'aperçu). La seconde réponse est aidée : la colonne `joker` porte la carte
  de l'essai — avant celle d'un indice joué avec (`jokerQuiAide`) —, et le
  carnet tient pour ratée une réponse juste qu'une carte d'essai a aidée
  (`CARTES_DU_SECOND_ESSAI`, `suivisDe`, la version 15) : il ne lit pas les
  gestes, la colonne lui dit que la première était fausse. Ni sur un vrai ou faux, ni quand il ne resterait que deux
  réponses, ni sous Double chance ou Deux visages (`secondEssaiDuTour`) ; à
  composer et sur une frise, on recompose, on reclasse : rien ne s'efface.
- **Ce qui donne un second essai se paie** (le calibrage des familles) : un
  second essai à chaque question de la rencontre menait le moyen au bout
  vingt-trois fois de plus sur cent. Bastion ne le donne qu'aux questions où
  il ne joue aucune autre carte (celles du pari mises à part) — et, rendue
  par lui, la question se rejoue sans carte (`refusDeLaCarte`) : jouée
  après, la carte l'aurait gardée pour le second essai. Cuirasse ne sert
  qu'une fois par rencontre (deux, améliorée : `RencontreEnCours.essais`).
- **Une carte qui souffle à chaque question se paie aussi** : Troisième œil
  posé, une bonne réponse ne fait perdre qu'un cran, quoi qu'on y joue
  (`cransDUneBonneReponse`), et sa prochaine erreur le rend à la défausse
  (`RETOMBENT_A_L_ERREUR` : le pli, `CoupDeRencontre.retombees`, et le
  verdict le dit) — une lettre partout menait le moyen au bout vingt-huit
  fois de plus sur cent, vingt-trois une fois plafonnée. Il ne frappe plus
  les indices des autres cartes, comme jusqu'à la version 13
  (`chiffresEnQuestion`).
- **Une carte posée prend la carte de sa question** (une par question) : un
  pouvoir qui n'aide que plus tard se mesure mort dans des rencontres de deux
  à quatre crans — Caméléon qui ne payait que les formes changées (−12 au
  moyen, sans cartes pour les changer), puis celles qui ne sont pas à quatre
  choix (−6), Vent arrière qui ne frappait que la série, le Rythme qui tirait
  ou effaçait d'avance. Une carte des familles vaut seule (`--cartes`) avant
  d'entrer : le Rythme et Caméléon se jouent sur la question — l'un efface et
  revient, l'autre frappe, plus fort hors des quatre choix —, Vent arrière
  frappe chaque bonne réponse de la rencontre dès la question où il se pose.
- **Les cartes du pari servent à l'aveugle** (la version 14) : posées à
  l'annonce, en plus de la carte de la question, elles ne servaient qu'à qui
  pariait — à deux chances sur trois au moins, puisqu'un pari ne rapporte
  qu'à moitié : mortes en main, Doubler la mise retirait six points au moyen.
  Doubler la mise y frappe un cran de plus si juste, Banco deux — trois son
  pari gagné —, pari ou non, Assurance pare l'attaque ; une fois chacune par
  question (`refusDesFamilles`). Pactole, posé à l'annonce, frappe chaque
  bonne réponse de la rencontre sans prendre la carte de la question : seul,
  il mène le moyen au bout vingt-quatre fois de plus sur cent, quand
  l'Encyclopédie, le même cran posé à la question, ne vaut rien. Le pari,
  lui, reste avant la question — le choix du propriétaire.
- **Ce qui pardonne une erreur se joue sur la question qu'on ne sait pas**
  (le calibrage) : Inarrêtable des familles, posé, rend la prochaine erreur
  gratuite puis retombe (`attaqueEnQuestion`, `RETOMBENT_A_L_ERREUR`) — le
  joueur simulé le joue comme Sursis, Muraille et Fortune. Posé quand il
  sait, comme les autres pouvoirs, il prenait la carte d'une bonne réponse
  et se mesurait mort (−2) : une carte se mesure à la façon dont on la joue.
- **Leçon et la Bibliothèque changent de question** (`changeDeQuestion(cle,
  v)`) : l'autre se tire dans la catégorie fétiche (`TourDeRencontre.categorie`
  pour Leçon, la Bibliothèque posée pour toutes les suivantes, `aTirer`), et
  la carte levée ne promet rien d'une question qu'elle ne connaît pas. Une
  version 13 garde sa Bibliothèque d'avant, posée pour les questions
  suivantes seulement.
- **Un détail est une question de la base, son intitulé non** (la version
  15) : il nomme le tableau. La vue envoie `QUESTION_DU_DETAIL` et l'heure de
  son premier cadrage ; le verdict ne renvoie pas l'intitulé (`texte`), même
  avec `devoile` — la révélation montre le tableau nommé. Ni le QID, ni le
  titre ne partent avant le verdict ; une route sert chaque cadrage, jamais
  `client/public`. Une carte qui reposerait la question de la base à une
  autre forme s'y refuse (`DETAIL_SANS_AUTRE_FORME`) : sans son tableau, la
  question se lirait nue.
- **Une règle de difficulté se lit à la version** (`marchesDe(depart.v)`,
  `marcheDe(acte, escale, v)`) : le pli, le tirage du serveur, la chance
  annoncée au départ et le simulateur passent la version. Un appel qui
  l'oublierait lirait les marches d'avant — une expédition de la version 15
  tirerait un gardien de l'acte 3 en difficile et l'annoncerait expert.
- **Une carte se mesure à la façon dont on la joue, encore** (la version
  15) : Vent arrière, posé comme un pouvoir sur une question que le joueur
  savait, se mesurait mort (−1 · −9) ; il efface dès la question où il se
  pose — joué sur celle qu'on ne sait pas, comme une aide, +2 · −1 (+3 · +4
  sous la parade de son épique).
- **Une règle de rareté se mesure sur ce qu'elle rattrape** (la version 15,
  « avec les cartes plus rares […] ça aide vraiment à gagner ») : face à
  des expertes, ce qui fait perdre des crans ne sert pas — trois crans de
  plus à l'épique ne déplaçaient rien —, ce qui fait trouver ou survivre
  si. Effacer deux réponses à l'épique ne déplaçait rien non plus : le
  joueur garde ses épiques pour l'élite et le gardien, et en a rarement une
  sous la main à la question qu'il ne sait pas ; une épique jouée en plus de
  la carte de la question non plus — il joue dix-sept cartes en quarante
  questions, la règle ne le bornait pas. La parade (`PARADE_DE_LA_RARETE`),
  qui pèse sur n'importe quelle question ratée, a pris. Et passé le niveau
  3, une carte de plus aide moins : une par question, et il en a déjà une
  qui sert — le haut du codex ne monte que par des cartes neuves qui valent
  plus que celles qu'il a.
- **Le départ a besoin de toute la base de la campagne** — ses thèmes
  pointus se comptent sur elle (`sujetsComptes`), ses chances sur ses
  mesures — : réveillé, le serveur ne la lisait que vingt secondes après son
  démarrage, et le premier départ parti avant les payait — 0,8 s de
  processeur au paquet, sept à huit secondes au dixième de cœur (« gros
  problème de latence en essayant de lancer une expédition », le
  20 octobre 2026). L'accueil d'un profil et la page de l'expédition lancent
  donc le préchauffage, la page servie (`prechauffageAuProfil`, `server.ts` ;
  règle `campagne-base.md`) : 0,06 s ensuite. Une page neuve d'où l'on part
  sans passer par elles rejoint leur liste.
