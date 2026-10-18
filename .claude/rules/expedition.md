---
paths:
  - "shared/{expedition,jokers,rencontres}.ts"
  - "server/src/expedition.ts"
  - "client/src/views/{ExpeditionApp,RencontresDExpedition}.tsx"
  - "client/src/components/{Balise,Vies}.tsx"
  - "server/scripts/{rendu-expedition,calibrage-expedition,rendu-rencontres,calibrage-rencontres}.ts"
  - "server/test/{expedition,expedition-carte,expedition-carte-ecran,expedition-question-ecran,expedition-pli,expedition-legendaires,expedition-jokers,expedition-mesure,expedition-charge,expedition-tirage,expedition-formes,expedition-ecus,expedition-echoppe,expedition-themes,expedition-passeport,expedition-saison,expedition-rencontres,expedition-rencontres-routes,expedition-rencontres-ecran,expedition-partir}.test.ts"
---

# L'Expédition : la carte, les escales, les gardiens, les jokers, les écus, le passeport, les saisons

Trois actes, chacun une carte tirée au sort — six étages de quatre colonnes, deux campements, un gardien au bout —, et au bout du troisième un des trois gardiens vaincus à garder : un légendaire ; en main, des jokers ; en poche, des écus. Le brief validé par le propriétaire le 17 octobre 2026 (« on fait que rajouter des choses mais on ne sait plus quoi choisir ») : `retours/2026-10-17/expedition.md`. **Les quatre étapes sont faites** — la carte et une expédition de bout en bout, les jokers, les formes de question, puis les écus : l'échoppe, l'inconnu, les talismans. Puis, le 18 octobre 2026, le passeport — un tampon par thème pointu trouvé, le Globe-trotter — et la saison des fêtes — sa fête sur les cartes, son légendaire à l'acte 3. Ouverte en production depuis ses jokers (`EXPEDITION_EN_PRODUCTION`) : avec une équipée de deux, le joueur moyen arrive au bout 25 à 31 fois sur cent, le fort 67 à 77 — la cible du brief, une fois sur trois et huit sur dix, approchée. **Le prototype des rencontres** (la version 5 du départ, le 18 octobre 2026 — la proposition « L'Expédition en cartes », `retours/2026-10-18/rencontres.md`) : hors de la production seulement, une escale à question devient un adversaire à faire tomber question après question, le courage remplace les vies, des cartes les jokers — la préparation, la mise, le cycle de Slay the Spire.

## Les fichiers

- `shared/expedition.ts` — tout ce qui se calcule, pur. Le générateur (`carteDUnActe`, de la graine du n-ième départ du profil — `graineDe`, `hasardDe` : la même graine redonne la même carte) : cinq chemins qui montent sans se croiser, leurs pas font les escales et les liens ; la sorte de chaque escale (`POIDS_DES_ESCALES` ; plus d'adversaires en rencontres, `POIDS_DES_ESCALES_DES_RENCONTRES`), son thème — une catégorie, un mélange de deux ou trois, un sujet pointu (`PART_DES_MELANGES`, `PART_DES_THEMES_POINTUS` ; ses sujets, le serveur les donne : piège plus bas ; la fête d'une saison en tient la moitié, `PART_DE_LA_FETE`) —, sa forme (`POIDS_DES_FORMES`, `FORMES_OUVERTES` : toutes depuis l'étape 3) ; toutes les sortes depuis l'étape 4. Les écus (`ECUS_DES_PISTES`, `ecusDeLaReponse` — la couleur de la chance annoncée, `chanceAnnoncee`, celle du Commandement comprise —, `prixDeLEscale`, `ecusEsperes`), l'échoppe (`PRIX_DE_L_ECHOPPE`, `prixDeLArticle`, `refusDeLAchat`), l'inconnu (`contenuDeLInconnu`, `legendaireDePassage`), les talismans des offres (`talismanDeLOffre`, `CHANCE_D_UN_TALISMAN`), le siècle de la loupe (`siecleDeLaQuestion`). Le dévoilement (`MS_PAR_MOT`, `ARRET_SUR_IMAGE_MS`, `MOTS_DU_DEVOILEMENT`, `motsDe`, `motsDits`, `instantDuMot` : combien de mots sont dits à l'heure du serveur, et quand se dit le suivant). Les marches (`MARCHES_DES_ACTES`, `marcheDe` : jamais d'experte), les gardiens (`gardiensDe`, jamais l'invité du jour ; le légendaire d'une saison à l'acte 3, `deSaison`), le passeport par famille (`passeportParFamille`), l'invité du jour (`inviteDuJour`) et l'équipée (`refusDeLEquipee`), les offres (`offreDeJokers`, parmi les jokers que la version du départ connaît — `Joker.depuis`), les chances (`chanceSelonLaForme`, `chanceDeVaincre`, `viesAuBout`, `chancesDuTrace`, `traceLePlusSur`, `escalesAtteignables`), le pli (`pliDeLExpedition` — la main, le paquet, la défausse, les posés, l'offre, le campement, les jokers de route —, `escalesPermises`, `carteEnJeu` et `maisonAOuvrir` — la carte que Il connaît la maison change —, `questionsDuGardien`), pourquoi un joker ne se joue pas maintenant (`refusDuJoker`), ce qu'un joker montre d'une question (`reponsesEffacees`, `indiceDeLEnigme`, `sensDeLOracle` : ils lisent la bonne réponse, le serveur seul les appelle), les types de la page (`VueDeLExpedition`, `JokersEnJeu`, `PageDeLExpedition`), le nom d'un gardien dans une phrase (`leGardien`, `auGardien`, `gardienAuFeminin` : « vers le Kraken », « à la Chouette d’Argent »). Ses constantes sont des choix de produit (`docs/reference/baremes.md`)
- `shared/jokers.ts` — `EXPEDITION_EN_PRODUCTION`, le catalogue (`JOKERS_DES_LEGENDAIRES`, vingt-trois — la lanterne de la Citrouille et la boule du Sapin venues avec l'inconnu —, `JOKERS_SANS_LEGENDAIRE`, neuf ; `joker`, `jokerDuLegendaire`), les talismans (`TALISMANS`, `talisman`), `LEGENDAIRES_A_JOKER` — eux seuls gardent un acte, s'emmènent et ont la voie —, et les règles du paquet : `PAQUET_DE_DEPART`, `MAIN_MAX`, `MAIN_MAX_DES_TROIS_TETES`, `PLACES_DE_L_EQUIPEE`, `JOKERS_PAR_OFFRE`, `POIDS_DES_RARETES`, `EFFACE`, `JOKERS_QUI_AIDENT`. Il n'importe rien : `shared/legendaires.ts` le lit, l'album et l'accueil aussi, sans tirer toute l'expédition
- `CampagneStore` (`core/campagne.ts`, « L'Expédition ») · `server/src/expedition.ts` — une expédition est une série `mode = 'expedition'` : son départ dans `campagne_series.expedition` (`DepartDExpedition`, versionné — la version 2, ses jokers : son équipée, l'invité de son départ, sa chance sur chaque marche de chaque catégorie et sur une source), ses gestes dans `expedition_gestes` (`serie_id`, `rang`, `geste`), ses réponses dans `campagne_reponses` — aidées, la clé de leur joker (`joker`) —, comme toute partie : l'expérience, les confettis, le carnet et « jamais vues d'abord » la comptent sans rien en savoir. Les routes, pour les profils (`GET` et `POST /api/expedition`, `POST /api/expedition/:id/geste`, `…/reponse`, `…/abandon`) ; sa correction et ses signalements par celles de la série (« en expédition » au QG). `pageDeLExpedition` (celle en route, sinon la prochaine : son numéro, ses gardiens, ceux qu'il a déjà — `aLui` —, l'invité du jour, ses légendaires qui ont leur joker — `equipables`), `partirEnExpedition` (une à la fois, son équipée), `chancesDeLExpedition`, `gesteDExpedition` (`gesteRecevable` : avancer, jouer, prendre, camper, acheter — écrit avec son prix ; garder, `garderUnGardien` ; un piège qui prend la dernière vie finit l'expédition d'un geste), `completerLExpedition` (ce que le pli demande de tirer, `aTirer` — la question d'une escale, celles du gardien, l'autre d'Échange ou de Deux visages, la reprise de La boucle —, tiré dans le lot du geste), `repondreEnExpedition` (Double chance : deux réponses ; `jokerQuiAide`), `abandonnerLExpedition`, `tirerPourLExpedition` (sur le thème de l'escale — ou la catégorie du Commandement —, par `tirerPourUneEscale`, le rang d'une épreuve lu dans un ordre tiré à mesure), `expeditions` (l'expédition en route en mémoire, `ExpeditionGardee` : `expeditionAJouer`, `garderLExpedition`, `ecrireLExpedition`, `vuAilleurs`), `aSaForme` (la forme posée au tirage : six choix et ses leurres, `leurresDuSixChoix` ; un vrai ou faux et sa réponse proposée ; un dévoilement et l'heure de son premier mot — ce qu'une question doit avoir pour s'y prêter, `seLaissePoser`), `devoilement` (les mots d'un dévoilement et où il en est, pour sa route `GET /api/expedition/:id/devoilement`, qui les écrit chacun à son heure), `vueDeLExpedition` (ce que la page reçoit : la carte en jeu — l'inconnu dévoilé seul —, les jokers et leurs refus, ce qu'un joker montre, le siècle de la loupe, les écus, les talismans, l'échoppe, l'inconnu où il entre), `questionsPosees` et `devoileA` (le mot où un dévoilement en était à l'heure de sa réponse, `ExpeditionLue.reponduesLe` : ses écus en dépendent), `recompenserLExpedition` (les paliers de la campagne : Le Marathonien ; ni record ni haut fait de série). `oublierProfil` efface ses gestes
- `client/src/views/ExpeditionApp.tsx` — la page (`/expedition`, à la demande dans `main.tsx`, préchargée par `shared/depart.ts`, réservée dans `shared/space.ts` ; un gros bouton sur l'accueil d'un profil, `AccueilDesRoles.tsx`, tant que le drapeau l'ouvre) : le départ (`Depart` : le numéro de la carte, les trois gardiens annoncés, ceux qu'il a déjà, l'équipée — `Places`, « Changer » —, retenue sur le téléphone, `quizz.expedition.equipee`), sa feuille (`FeuilleDeLEquipee` : la grille des légendaires qu'il peut emmener, la fiche du dernier touché, `TousLesJokers` déplié à la demande), la carte d'un acte (`CarteDeLActe`, revue deux fois le 18 octobre 2026 — seule l'escale où il est s'éclaire, puis « de vrais cartes en bas » ; l'écran tient en un écran : `lireLaCarte` une fois pour tout, `etatDeLEscale` et `liensDuPlan` pour les deux plans ; en haut l'acte en petit, `PetitPlan` — ses rangées en pour cent de sa hauteur, `EN_PETIT`, un bouton qui ouvre la carte en grand ; l'escale où il est, seule éclairée — `exp-ici`, le départ aussi —, les escales permises entourées — `exp-a-portee` —, la touchée — `exp-choisie`, son trait doré —, le reste en retrait — `exp-plus-loin`, `exp-loin`, `exp-passee` — ; en bas le panneau collé : les escales permises en cartes, de gauche à droite, `CarteDEscale` — sa sorte, son emblème, son nom, sa chance, ses gains, `faceDeLEscale` —, la plus sûre à son ruban, `laPlusSureDesProposees`, depuis les escales permises sous Le détour ou Le raccourci ; sa main en petit en tête, « Y aller » ; la carte en grand dans sa feuille, `FeuilleDeLaCarte` — `GrandPlan` : les colonnes en pour cent, les étages en pixels, `COLONNES_X`, `Y_HAUT`, `PAS_D_ETAGE`, les proposées et leur chance, `exp-sa-chance`, l'escale touchée décrite au pied —, la légende, et « Abandonner l’expédition »), l'escale (`Escale` : ce qu'un joker montre, la main sous les réponses ; ses réponses, `ReponsesDeLEscale` — effacées, montrée à l'Oracle, choisies sous Double chance, cochées), la main (`Main`, revue le 18 octobre 2026 — « ma main c'est pas ouf » : les jokers en cartes au cadre de leur rareté, `gemmeDuJoker`, la gemme de l'album, `client/src/gemmes.ts` ; posées au bas de l'écran, leur haut seul en vue ; la pioche au bout, sa feuille `FeuilleDuPaquet` ; sur la carte, en petit, `enPetit` — ; la carte levée, `JokerLeve` : en grand, ce qu'il fait, « Jouer » ou son refus, le Commandement et sa catégorie, une modale, `useModale`), la révélation (`Revelation`, `verdictDe` : ce que la réponse a coûté, lu de l'écart avec la vue d'avant), l'offre (`Offre` : un talisman parfois, et le coffre qu'on passe pour ses écus), le campement (`Campement`), l'échoppe (`Echoppe` : un article choisi puis acheté ; « Reprendre la route » la laisse sans geste, `echoppeLaissee`, et le panneau de la carte la rouvre), l'inconnu dévoilé (`Inconnu`), la barre du haut (`Barre` : le « ? » des règles, `BoutonDesRegles` et leur feuille ; les jokers posés — en rencontre les cartes posées pour toute la rencontre, `exp-posees`, qui se lèvent au toucher — et les talismans en petit, les écus, les vies), le gardien vaincu (`GardienVaincu`), le choix du légendaire (`ChoixDuLegendaire`), la fin (`FinDeLExpedition`, l'écran des gains de la campagne, `gains.test.ts`). `components/Balise.tsx` (la couleur de piste d'une chance, venue des sentiers) et `components/Vies.tsx` (les cœurs, venus de la campagne) se partagent. Sa section de `styles.css` : « L'Expédition », classes `exp-*`
- `shared/rencontres.ts` — le prototype des rencontres, pur : `RENCONTRES_EN_PRODUCTION`, ses règles chiffrées (le courage, l'inspiration, les cinq cartes de la version 5 et la main qui grandit avec les actes de la version 6 — `CARTES_DES_ACTES`, `cartesDesActes`, `cartesParQuestion` —, les mises et `PART_GAGNEE_D_UNE_MISE`, le savoir de chaque marche, les multiplicateurs des formes, les sceaux et la frappe de chaque sorte d'adversaire, ce que rendent une source, un campement, l'échoppe, ce que prend un piège, les offres et leurs raretés — celles de l'acte 1 depuis la version 6, `RARETES_DE_L_ACTE_1`, `raretesDeLOffre` — `docs/reference/baremes.md`), le catalogue (`CARTES_DES_RENCONTRES` : onze neutres, douze cartes de famille — deux par famille, le prototype —, les vingt-trois jokers des légendaires réécrits, gardant leur clé ; `carteDeRencontre`, `carteDuLegendaire`, `estDeRoute`, `cartesDeCombat`, `PAQUET_DES_RENCONTRES`, `paquetDesRencontres`), les familles (`FAMILLES_DE_CARTES`, `famillesDeLEquipee` : les légendaires de l'équipée choisissent celles des offres), les offres (`offreDeCartes`), les adversaires (`ADVERSAIRES`, `adversaireDe`), ce qu'une bonne réponse brise et ce qu'une erreur coûte (`brisesDUneBonneReponse`, `frappeDUneErreur`, `multiplicateurDeLaForme`, `enJeu`, `gainDeLaMise`, `effaceesDuTour`), ce qu'une carte change aux chiffres du tour et à la forme de la question (`chiffresApresLaCarte`, `formeApresLaCarte` — la seule règle : le pli l'applique, la carte levée l'annonce), pourquoi une carte ne se joue pas (`refusDeLaCarte` — la seule règle), l'annonce et l'aperçu du verdict (`AnnonceDuTour`, `apercuDuTour`), les types de la rencontre (`RencontreEnCours`, `TourDeRencontre`, `CoupDeRencontre`, `VueDeLaRencontre`). Le pli (`pliDeLExpedition`, `depart.v >= 5`) en fait l'état ; `shared/expedition.ts` y ajoute `routeDisponible`, `refusDeLaMise`, `questionDuTour`, `contexteDeLaCarte`, `refusDUneCarte`, `vueDeLaRencontre`
- Le serveur des rencontres : `rencontresOuvertes` et les options du départ (`server/src/expedition.ts` : `rencontres`, `fetiche`, accordées hors de la production seulement), la page qui les propose (`PageDeLExpedition.prochaine.rencontres`), le geste `voir` (sa mise, `gesteRecevable`), `questionsApresLeGeste` (Corser, Simplifier : la question reposée de la base à sa forme neuve, dans le lot du geste ; voir un dévoilement lance ses mots), le tirage d'une question à la fois (`tirerPourLExpedition` : `tiree`, `six`, `reponseEn`), la question cachée tant qu'il prépare (`vueDeLExpedition`, `repondreEnExpedition`, `devoilement`), la colonne `joker` du premier indice joué (`jokerQuiAide`), le coup de la réponse (`ReponseDExpedition.coup`)
- `client/src/views/RencontresDExpedition.tsx` — les pièces des rencontres, que `ExpeditionApp.tsx` assemble, revues le 18 octobre 2026 pour qui découvre (« je veux que ce soit bien compréhensible pour des novices ») : le courage dans la barre (`Courage`), l'énergie — l'inspiration du code — en orbe chiffré (`Energie`), une carte dessinée comme une vraie (`CarteDessinee`, revue le même soir — « les cartes c'est des rectangles pas très jolis » — : son cadre de rareté, l'orbe de son coût au coin, rouge s'il manque d'énergie, son illustration sur la teinte de sa famille, `TEINTE_DE_LA_FAMILLE`, son chiffre en médaillon, `CarteDeRencontre.valeur`, son nom au bandeau, la gemme de sa rareté ; trois tailles, `TailleDeCarte` : `main` — sans un mot —, `rangee` — son nom —, `levee` — sa phrase), sa main (`VisageDeLaCarte`, `MainDeRencontre` — ses cartes dessinées, sans un mot ; ce qu'elles font se dit à l'oreille (`FaceDeLaCarte`, `CarteDeRencontre.resume`) et levées ; avant la question, celles de maintenant puis, à part et éteintes, celles de pendant ; la question vue, celles-là seules ; sur la carte, en petit, `enPetit` —, `CarteLevee` — en grand, ce qu'elle fait, quand, et ce qu'elle changerait, « Avec cette carte » (`changementDeLaCarte`) ; sans `onJouer`, on ne fait que la regarder —, `FeuilleDesCartes` : chaque tas en vraies cartes qui défilent, `RangeeDeCartes` — la pioche déduite, la défausse, les épuisées, tout le paquet ; `choisie`, la carte qu'on retire au campement —, la règle du cycle), l'offre en trois vraies cartes côte à côte (`CartesAPrendre` : la phrase de la touchée dessous, rien avant), l'adversaire (`Adversaire` : ses points en jauge, la question qu'il pose sans son texte ; compact la question sous les yeux), ce que la réponse fera (`Apercu` : deux tuiles, « Si tu as juste », « Si tu te trompes », refaites à la mise et à la carte levée par `apercuALaMise`), la préparation entière (`PreparationDeLaRencontre` : l'adversaire, l'aperçu, la main, le pari, « Voir la question » ; à la première, les règles en feuille, retenues sur le téléphone, `quizz.expedition.guide-rencontres`), les règles (`FeuilleDesRegles` — en rencontres, `reglesDesRencontres`, ce que tire chaque acte lu de la vue ; aux règles d'avant, `reglesDesJokers` ; `debut`, la section à lire d'abord — et `BoutonDesRegles`, le « ? » du haut de chaque page), la révélation (`verdictDeLaRencontre`), le départ (`AuDepart` — l'interrupteur, retenu sur le téléphone, `quizz.expedition.rencontres`, `quizz.expedition.fetiche` —, `FeuilleDeLaFetiche`), les cartes dépliées de l'équipe (`ToutesLesCartes`), la ligne d'une carte à l'échoppe (`LigneDeCarte`). Sa section de `styles.css` suit celle de l'expédition (« Les rencontres »)
- `server/scripts/rendu-rencontres.ts` (client construit d'abord) · `server/scripts/calibrage-rencontres.ts` (`--expeditions`, `--cas`) — les écrans du prototype en 360 × 640, d'un départ à la fin ; la chance d'aller au bout, la durée et les écus de trois joueurs simulés, avec le paquet de départ et deux équipées. `expedition-rencontres.test.ts` (les règles et le pli) · `expedition-rencontres-routes.test.ts` (par les routes : le départ, la question cachée en préparation, la mise, le verdict, la victoire, le dévoilement, Corser, Simplifier) · `expedition-rencontres-ecran.test.ts` (l'écran, rendu : ni sceaux, ni Charge, ni Garde, ni inspiration ; chaque résumé et chaque chiffre tiennent sur leur carte ; la carte levée annonce ce que le serveur fait ; la préparation dans l'ordre où l'on joue, la main sans un mot ; les règles à la première, et ce que tire chaque acte ; l'aperçu ; la main de pendant la question ; les cartes posées en haut, à côté du « ? » ; l'énergie et le coût au coin des cartes ; les tas en rangées de vraies cartes ; l'offre en trois cartes, rien dessous avant le toucher ; la carte à retirer au campement) · `expedition-partir.test.ts` (« ← Partir » mène au départ, qui garde l'expédition en route ; de là, elle s'abandonne ; un débutant n'y choisit pas de légendaires ; « Ton équipe » ; le départ sans paragraphes, les gardiens côte à côte, les règles au « ? »)
- La voie : `shared/legendaires.ts` (`avecLExpedition`, `cleDeLExpedition`, `estUneVoieDExpedition`, `legendaireDeLExpedition`, `voiesMontrees`) — chaque légendaire qui a son joker se gagne aussi en le gardant au bout — ceux de saison à leur saison seulement, le 18 octobre 2026 — (une voie `aussi`, la ligne `expedition:<clé>` de `profile_badges`, rangée sous `#campagne:<série>`, comme une saison) ; l'album lui donne son lieu (`shared/album.ts`, `expedition` ; `ouIlSeGagne` se dit voie par voie), les pistes et « le plus proche » l'écartent (`shared/pistes.ts`, `shared/proches.ts`), l'étagère et le compte des badges aussi (`ProfileStore.etagereDe`, `badges`)
- `server/scripts/rendu-expedition.ts` (client construit d'abord ; `ivoire` en argument : six légendaires rangés sur le profil, le Dragon d'Or en invité du jour par `horlogeDuJour`, puis l'horloge à Halloween et `calendrierDesExpeditions` rouvert pour la cinquième) · `server/scripts/calibrage-expedition.ts` (`--expeditions`, deux mille par défaut ; `--garder`, le joueur qui garde ses jokers rares et légendaires pour le gardien) — tous les écrans en 360 × 640, chaque joker qui passe compris ; la chance d'aller au bout de trois joueurs simulés, sur le vrai générateur et le vrai pli, sans jokers, avec le paquet de départ, avec deux équipées
- Les tests : `expedition.test.ts` (les routes de bout en bout, la source, les gardiens qu'il a, l'ouverture en production), `expedition-carte.test.ts` (le générateur, les chances, le tracé), `expedition-carte-ecran.test.ts` (l'écran de la carte, rendu : une seule escale éclairée sur l'acte en petit, les escales permises seules en cartes, de gauche à droite, la plus sûre à son ruban, ce que chaque carte rapporte, le gardien choisi d'office au campement ; la main en cartes au cadre de leur rareté, en petit sur la carte, les posés dans la barre ; la carte levée, son geste ou son refus), `expedition-question-ecran.test.ts` (une question à l'écran : les deux réponses de Double chance cochées, leur filet tenu sous le survol collé du téléphone), `expedition-pli.test.ts` (le pli), `expedition-legendaires.test.ts` (la voie, les jokers, la voie montrée), `expedition-jokers.test.ts` (chaque joker dans le pli : la main, la défausse, les posés, les offres, le campement, l'équipée), `expedition-mesure.test.ts` (par les routes : l'équipée et l'invité, ce qu'un joker montre sans la bonne réponse, la colonne `joker`, la mesure, la précision, le carnet, Échange et Passe-muraille, aucun joker hors de l'expédition), `expedition-charge.test.ts` (les allers-retours de chaque geste, comptés ; ce qu'il a vu relu après une réponse ailleurs ; une écriture ratée oubliée), `expedition-tirage.test.ts` (le tirage d'une escale : ce qu'il lit, ses règles), `expedition-formes.test.ts` (six choix, vrai ou faux, le dévoilement et sa route, Arrêt sur image, ce qu'une autre forme ne mesure pas, les offres d'avant), `expedition-ecus.test.ts` (les écus dans le pli : les pistes, le dévoilement, l'élite, le gardien, le coffre passé, Quitte ou double, l'échoppe, les talismans, l'inconnu, la lanterne et la boule, une expédition d'avant les écus), `expedition-echoppe.test.ts` (par les routes : les écus qui meurent avec l'expédition, l'échoppe et ses refus, l'inconnu caché jusqu'à son dévoilement, le piège qui finit d'un geste, la loupe), `expedition-themes.test.ts` (sur la vraie base : les thèmes pointus d'une carte, jamais une rubrique ni une époque remplacée), `expedition-passeport.test.ts` (le tampon d'un thème pointu trouvé, la carte qui signale les autres, le Globe-trotter), `expedition-saison.test.ts` (la fête sur les cartes, son légendaire à l'acte 3, le calendrier rouvert)

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
  (`flex`, au moins 170 pixels), ses escales en pour cent de sa hauteur
  (`EN_PETIT`) — rien ne défile, et la page n'a plus à se faire défiler
  jusqu'à l'escale où il est. Ce qui grandit le panneau rapetisse l'acte :
  posée au bas du panneau, la main lui prenait 90 pixels et le panneau,
  collé, en couvrait le bas — elle vit en petit en tête du panneau ; quatre
  cartes gardent leur nom sur une ligne parce que le panneau va de bord à
  bord. Une ligne de plus dans le panneau se regarde en 360 × 640, au
  départ (quatre cartes) et au campement (la règle du gardien). Seule la
  carte en grand défile, dans sa feuille, jusqu'à l'escale où il est
  (`GrandPlan`, par le cadre qui défile, jamais la page de dessous).
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
  l'échoppe, d'un joker posé dans la barre (`gemmeDuJoker` : le maudit
  prend le pourpre de l'épique). Pas de couleur de rareté à part.
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
  surtout qu'au début on n'a pas forcément ça » (le 18 octobre 2026) ; le
  codex de cartes proposé le même soir en fera peut-être autre chose.
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
  (« Ton équipée » se lisait comme une faute), l'inspiration l'**énergie** —
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
- **Le prototype ne s'ouvre qu'hors de la production**
  (`RENCONTRES_EN_PRODUCTION`, `rencontresOuvertes`) : demandées ailleurs,
  les rencontres se taisent — le départ reste celui des jokers, sans refus
  pour une page d'avance. La page les propose d'office là où elles
  s'ouvrent : `rendu-expedition.ts` coupe l'interrupteur pour photographier
  les jokers. Les vies d'une expédition en rencontres ne sont qu'un reflet
  du courage, pour les lectures de la campagne ; une expédition partie en
  version 4 finit sous ses règles.
