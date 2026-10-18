---
paths:
  - "shared/{expedition,jokers}.ts"
  - "server/src/expedition.ts"
  - "client/src/views/ExpeditionApp.tsx"
  - "client/src/components/{Balise,Vies}.tsx"
  - "server/scripts/{rendu-expedition,calibrage-expedition}.ts"
  - "server/test/{expedition,expedition-carte,expedition-carte-ecran,expedition-pli,expedition-legendaires,expedition-jokers,expedition-mesure,expedition-charge,expedition-tirage,expedition-formes,expedition-ecus,expedition-echoppe,expedition-themes,expedition-passeport,expedition-saison}.test.ts"
---

# L'Expédition : la carte, les escales, les gardiens, les jokers, les écus, le passeport, les saisons

Trois actes, chacun une carte tirée au sort — six étages de quatre colonnes, deux campements, un gardien au bout —, et au bout du troisième un des trois gardiens vaincus à garder : un légendaire ; en main, des jokers ; en poche, des écus. Le brief validé par le propriétaire le 17 octobre 2026 (« on fait que rajouter des choses mais on ne sait plus quoi choisir ») : `retours/2026-10-17/expedition.md`. **Les quatre étapes sont faites** — la carte et une expédition de bout en bout, les jokers, les formes de question, puis les écus : l'échoppe, l'inconnu, les talismans. Puis, le 18 octobre 2026, le passeport — un tampon par thème pointu trouvé, le Globe-trotter — et la saison des fêtes — sa fête sur les cartes, son légendaire à l'acte 3. Ouverte en production depuis ses jokers (`EXPEDITION_EN_PRODUCTION`) : avec une équipée de deux, le joueur moyen arrive au bout 25 à 31 fois sur cent, le fort 67 à 77 — la cible du brief, une fois sur trois et huit sur dix, approchée.

## Les fichiers

- `shared/expedition.ts` — tout ce qui se calcule, pur. Le générateur (`carteDUnActe`, de la graine du n-ième départ du profil — `graineDe`, `hasardDe` : la même graine redonne la même carte) : cinq chemins qui montent sans se croiser, leurs pas font les escales et les liens ; la sorte de chaque escale (`POIDS_DES_ESCALES`), son thème — une catégorie, un mélange de deux ou trois, un sujet pointu (`PART_DES_MELANGES`, `PART_DES_THEMES_POINTUS` ; ses sujets, le serveur les donne : piège plus bas ; la fête d'une saison en tient la moitié, `PART_DE_LA_FETE`) —, sa forme (`POIDS_DES_FORMES`, `FORMES_OUVERTES` : toutes depuis l'étape 3) ; toutes les sortes depuis l'étape 4. Les écus (`ECUS_DES_PISTES`, `ecusDeLaReponse` — la couleur de la chance annoncée, `chanceAnnoncee`, celle du Commandement comprise —, `prixDeLEscale`, `ecusEsperes`), l'échoppe (`PRIX_DE_L_ECHOPPE`, `prixDeLArticle`, `refusDeLAchat`), l'inconnu (`contenuDeLInconnu`, `legendaireDePassage`), les talismans des offres (`talismanDeLOffre`, `CHANCE_D_UN_TALISMAN`), le siècle de la loupe (`siecleDeLaQuestion`). Le dévoilement (`MS_PAR_MOT`, `ARRET_SUR_IMAGE_MS`, `MOTS_DU_DEVOILEMENT`, `motsDe`, `motsDits`, `instantDuMot` : combien de mots sont dits à l'heure du serveur, et quand se dit le suivant). Les marches (`MARCHES_DES_ACTES`, `marcheDe` : jamais d'experte), les gardiens (`gardiensDe`, jamais l'invité du jour ; le légendaire d'une saison à l'acte 3, `deSaison`), le passeport par famille (`passeportParFamille`), l'invité du jour (`inviteDuJour`) et l'équipée (`refusDeLEquipee`), les offres (`offreDeJokers`, parmi les jokers que la version du départ connaît — `Joker.depuis`), les chances (`chanceSelonLaForme`, `chanceDeVaincre`, `viesAuBout`, `chancesDuTrace`, `traceLePlusSur`, `escalesAtteignables`), le pli (`pliDeLExpedition` — la main, le paquet, la défausse, les posés, l'offre, le campement, les jokers de route —, `escalesPermises`, `carteEnJeu` et `maisonAOuvrir` — la carte que Il connaît la maison change —, `questionsDuGardien`), pourquoi un joker ne se joue pas maintenant (`refusDuJoker`), ce qu'un joker montre d'une question (`reponsesEffacees`, `indiceDeLEnigme`, `sensDeLOracle` : ils lisent la bonne réponse, le serveur seul les appelle), les types de la page (`VueDeLExpedition`, `JokersEnJeu`, `PageDeLExpedition`), le nom d'un gardien dans une phrase (`leGardien`, `auGardien`, `gardienAuFeminin` : « vers le Kraken », « à la Chouette d’Argent »). Ses constantes sont des choix de produit (`docs/reference/baremes.md`)
- `shared/jokers.ts` — `EXPEDITION_EN_PRODUCTION`, le catalogue (`JOKERS_DES_LEGENDAIRES`, vingt-trois — la lanterne de la Citrouille et la boule du Sapin venues avec l'inconnu —, `JOKERS_SANS_LEGENDAIRE`, neuf ; `joker`, `jokerDuLegendaire`), les talismans (`TALISMANS`, `talisman`), `LEGENDAIRES_A_JOKER` — eux seuls gardent un acte, s'emmènent et ont la voie —, et les règles du paquet : `PAQUET_DE_DEPART`, `MAIN_MAX`, `MAIN_MAX_DES_TROIS_TETES`, `PLACES_DE_L_EQUIPEE`, `JOKERS_PAR_OFFRE`, `POIDS_DES_RARETES`, `EFFACE`, `JOKERS_QUI_AIDENT`. Il n'importe rien : `shared/legendaires.ts` le lit, l'album et l'accueil aussi, sans tirer toute l'expédition
- `CampagneStore` (`core/campagne.ts`, « L'Expédition ») · `server/src/expedition.ts` — une expédition est une série `mode = 'expedition'` : son départ dans `campagne_series.expedition` (`DepartDExpedition`, versionné — la version 2, ses jokers : son équipée, l'invité de son départ, sa chance sur chaque marche de chaque catégorie et sur une source), ses gestes dans `expedition_gestes` (`serie_id`, `rang`, `geste`), ses réponses dans `campagne_reponses` — aidées, la clé de leur joker (`joker`) —, comme toute partie : l'expérience, les confettis, le carnet et « jamais vues d'abord » la comptent sans rien en savoir. Les routes, pour les profils (`GET` et `POST /api/expedition`, `POST /api/expedition/:id/geste`, `…/reponse`, `…/abandon`) ; sa correction et ses signalements par celles de la série (« en expédition » au QG). `pageDeLExpedition` (celle en route, sinon la prochaine : son numéro, ses gardiens, ceux qu'il a déjà — `aLui` —, l'invité du jour, ses légendaires qui ont leur joker — `equipables`), `partirEnExpedition` (une à la fois, son équipée), `chancesDeLExpedition`, `gesteDExpedition` (`gesteRecevable` : avancer, jouer, prendre, camper, acheter — écrit avec son prix ; garder, `garderUnGardien` ; un piège qui prend la dernière vie finit l'expédition d'un geste), `completerLExpedition` (ce que le pli demande de tirer, `aTirer` — la question d'une escale, celles du gardien, l'autre d'Échange ou de Deux visages, la reprise de La boucle —, tiré dans le lot du geste), `repondreEnExpedition` (Double chance : deux réponses ; `jokerQuiAide`), `abandonnerLExpedition`, `tirerPourLExpedition` (sur le thème de l'escale — ou la catégorie du Commandement —, par `tirerPourUneEscale`, le rang d'une épreuve lu dans un ordre tiré à mesure), `expeditions` (l'expédition en route en mémoire, `ExpeditionGardee` : `expeditionAJouer`, `garderLExpedition`, `ecrireLExpedition`, `vuAilleurs`), `aSaForme` (la forme posée au tirage : six choix et ses leurres, `leurresDuSixChoix` ; un vrai ou faux et sa réponse proposée ; un dévoilement et l'heure de son premier mot — ce qu'une question doit avoir pour s'y prêter, `seLaissePoser`), `devoilement` (les mots d'un dévoilement et où il en est, pour sa route `GET /api/expedition/:id/devoilement`, qui les écrit chacun à son heure), `vueDeLExpedition` (ce que la page reçoit : la carte en jeu — l'inconnu dévoilé seul —, les jokers et leurs refus, ce qu'un joker montre, le siècle de la loupe, les écus, les talismans, l'échoppe, l'inconnu où il entre), `questionsPosees` et `devoileA` (le mot où un dévoilement en était à l'heure de sa réponse, `ExpeditionLue.reponduesLe` : ses écus en dépendent), `recompenserLExpedition` (les paliers de la campagne : Le Marathonien ; ni record ni haut fait de série). `oublierProfil` efface ses gestes
- `client/src/views/ExpeditionApp.tsx` — la page (`/expedition`, à la demande dans `main.tsx`, préchargée par `shared/depart.ts`, réservée dans `shared/space.ts` ; un gros bouton sur l'accueil d'un profil, `AccueilDesRoles.tsx`, tant que le drapeau l'ouvre) : le départ (`Depart` : le numéro de la carte, les trois gardiens annoncés, ceux qu'il a déjà, l'équipée — `Places`, « Changer » —, retenue sur le téléphone, `quizz.expedition.equipee`), sa feuille (`FeuilleDeLEquipee` : la grille des légendaires qu'il peut emmener, la fiche du dernier touché, `TousLesJokers` déplié à la demande), la carte d'un acte (`CarteDeLActe`, revue le 18 octobre 2026 : les colonnes en pour cent, les étages en pixels — `COLONNES_X`, `Y_HAUT`, `PAS_D_ETAGE` —, les liens en SVG ; l'escale où il est, seule éclairée — `exp-ici`, le départ aussi —, les escales permises proposées — `exp-a-portee`, leur nom dessous, leur chance au-dessus, `exp-sa-chance` —, la touchée — `exp-choisie`, son trait doré —, le reste en retrait — `exp-plus-loin`, `exp-loin`, `exp-passee` — ; la plus sûre dite en mots, `laPlusSureDesProposees`, depuis les escales permises sous Le détour ou Le raccourci ; le panneau collé en bas — ce qu'il touche, `EscaleVue` —, sa main en une ligne, « Y aller », sa légende en feuille, `FeuilleDeLaCarte`, et « Abandonner l’expédition »), l'escale (`Escale` : ce qu'un joker montre, la main sous les réponses), la main (`MainDeJokers`, `FeuilleDeLaMain`, le Commandement et sa catégorie), la révélation (`Revelation`, `verdictDe` : ce que la réponse a coûté, lu de l'écart avec la vue d'avant), l'offre (`Offre` : un talisman parfois, et le coffre qu'on passe pour ses écus), le campement (`Campement`), l'échoppe (`Echoppe` : un article choisi puis acheté ; « Reprendre la route » la laisse sans geste, `echoppeLaissee`, et le panneau de la carte la rouvre), l'inconnu dévoilé (`Inconnu`), la barre du haut (`Barre` : les talismans en petit, les écus, les vies), le gardien vaincu (`GardienVaincu`), le choix du légendaire (`ChoixDuLegendaire`), la fin (`FinDeLExpedition`, l'écran des gains de la campagne, `gains.test.ts`). `components/Balise.tsx` (la couleur de piste d'une chance, venue des sentiers) et `components/Vies.tsx` (les cœurs, venus de la campagne) se partagent. Sa section de `styles.css` : « L'Expédition », classes `exp-*`
- La voie : `shared/legendaires.ts` (`avecLExpedition`, `cleDeLExpedition`, `estUneVoieDExpedition`, `legendaireDeLExpedition`, `voiesMontrees`) — chaque légendaire qui a son joker se gagne aussi en le gardant au bout — ceux de saison à leur saison seulement, le 18 octobre 2026 — (une voie `aussi`, la ligne `expedition:<clé>` de `profile_badges`, rangée sous `#campagne:<série>`, comme une saison) ; l'album lui donne son lieu (`shared/album.ts`, `expedition` ; `ouIlSeGagne` se dit voie par voie), les pistes et « le plus proche » l'écartent (`shared/pistes.ts`, `shared/proches.ts`), l'étagère et le compte des badges aussi (`ProfileStore.etagereDe`, `badges`)
- `server/scripts/rendu-expedition.ts` (client construit d'abord ; `ivoire` en argument : six légendaires rangés sur le profil, le Dragon d'Or en invité du jour par `horlogeDuJour`, puis l'horloge à Halloween et `calendrierDesExpeditions` rouvert pour la cinquième) · `server/scripts/calibrage-expedition.ts` (`--expeditions`, deux mille par défaut ; `--garder`, le joueur qui garde ses jokers rares et légendaires pour le gardien) — tous les écrans en 360 × 640, chaque joker qui passe compris ; la chance d'aller au bout de trois joueurs simulés, sur le vrai générateur et le vrai pli, sans jokers, avec le paquet de départ, avec deux équipées
- Les tests : `expedition.test.ts` (les routes de bout en bout, la source, les gardiens qu'il a, l'ouverture en production), `expedition-carte.test.ts` (le générateur, les chances, le tracé), `expedition-carte-ecran.test.ts` (l'écran de la carte, rendu : une seule escale éclairée, les escales permises seules proposées, ni nom ni chance en retrait, le gardien choisi d'office au campement), `expedition-pli.test.ts` (le pli), `expedition-legendaires.test.ts` (la voie, les jokers, la voie montrée), `expedition-jokers.test.ts` (chaque joker dans le pli : la main, la défausse, les posés, les offres, le campement, l'équipée), `expedition-mesure.test.ts` (par les routes : l'équipée et l'invité, ce qu'un joker montre sans la bonne réponse, la colonne `joker`, la mesure, la précision, le carnet, Échange et Passe-muraille, aucun joker hors de l'expédition), `expedition-charge.test.ts` (les allers-retours de chaque geste, comptés ; ce qu'il a vu relu après une réponse ailleurs ; une écriture ratée oubliée), `expedition-tirage.test.ts` (le tirage d'une escale : ce qu'il lit, ses règles), `expedition-formes.test.ts` (six choix, vrai ou faux, le dévoilement et sa route, Arrêt sur image, ce qu'une autre forme ne mesure pas, les offres d'avant), `expedition-ecus.test.ts` (les écus dans le pli : les pistes, le dévoilement, l'élite, le gardien, le coffre passé, Quitte ou double, l'échoppe, les talismans, l'inconnu, la lanterne et la boule, une expédition d'avant les écus), `expedition-echoppe.test.ts` (par les routes : les écus qui meurent avec l'expédition, l'échoppe et ses refus, l'inconnu caché jusqu'à son dévoilement, le piège qui finit d'un geste, la loupe), `expedition-themes.test.ts` (sur la vraie base : les thèmes pointus d'une carte, jamais une rubrique ni une époque remplacée), `expedition-passeport.test.ts` (le tampon d'un thème pointu trouvé, la carte qui signale les autres, le Globe-trotter), `expedition-saison.test.ts` (la fête sur les cartes, son légendaire à l'acte 3, le calendrier rouvert)

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
  réponse traversée dans le lot de son geste.
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
  `.exp-escale.exp-<sorte>` ; l'écran du campement s'appelle `exp-camper`.
  Une classe d'état de la carte aussi : `exp-proposee` est la réponse
  proposée d'un vrai ou faux, et sa règle faisait des escales proposées des
  cartes carrées (le 18 octobre 2026) — elles portent `exp-a-portee`.
- **Seule l'escale où il est s'éclaire** (le 18 octobre 2026, « uniquement
  illuminer la node sur laquelle on est et pas tout le chemin ») : la carte
  ne dessine plus le tracé le plus sûr — dix escales et leurs liens dorés,
  où celle où l'on était se perdait. Les escales permises sont proposées,
  entourées, leur nom et leur chance en clair ; le reste attend en retrait,
  sans nom ni chance ; la plus sûre ne se dit qu'en mots
  (`laPlusSureDesProposees`). Un état neuf sur la carte ne remplit ni ne
  dore une escale : le plein, c'est « tu es ici » ; l'anneau doré, celle
  qu'il a touchée. `expedition-carte-ecran.test.ts` rend la carte.
- **Un geste remonte la page en haut** (`setEcran`) : sur la carte, son
  effet fait défiler la page jusqu'à l'escale où il est et celles qu'elle
  propose, au-dessus du panneau collé en bas — à chaque geste aussi
  (`vue.rang`) : un joker joué sur la carte la laissait en haut, loin de
  lui. Centrée sur l'escale seule, la carte cachait sous le panneau les
  proposées du dessus.
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
