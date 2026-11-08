---
paths:
  - "shared/{jour,calendrier,propositions,signalement}.ts"
  - "server/src/core/jour.ts"
  - "server/src/quizDuJour.ts"
  - "client/src/views/JourApp.tsx"
  - "client/src/{insister,focus}.ts"
  - "client/src/components/{Jour,Calendrier,Laurier,Corrige,SerieCorrigee,LaPlume,QuestionBonus,SignalerLaQuestion,QgQuestionsDuPublic}.tsx"
  - "client/src/components/calendrier-peint.ts"
  - "server/test/{coffre-du-mois,jour,jour-charge,jour-justesse,jour-mois,jour-nuit,jour-paliers,jour-partie,jour-telephone,laurier,soiree-et-jour,corrige,jour-propositions,jour-question-du-public,jour-question-bonus,signalement-en-points}.test.ts"
  - "server/scripts/{rendu-jour,rendu-plume}.ts"
---

# Le quiz du jour

## Les fichiers

- `shared/jour.ts` · `core/jour.ts` · `server/src/quizDuJour.ts` · `client/src/views/JourApp.tsx` — le quiz du jour, pour les profils : dix questions tirées à minuit (Paris) et figées, une partie chronométrée au serveur, dans la base permanente ; l'expérience (200 au plus, podium 75/45/30, et le bonus de série — `xpDeSerie`, `jour_parties.xp_serie`, payé dès la partie commencée) dans la ligne `#jour` ; la nuit qui clôt la veille à la première demande (`clorePasses`) ; ses paliers (L'Assidu, Le Champion du jour, Le Sans-Faute, L'Élite, L'Infatigable), décernés dès la partie commencée (L'Assidu, L'Infatigable, la saison et le timbre de l'année — `accorderSaison`, règle `recompenses.md` : une partie commencée compte), à sa fin (Le Sans-Faute) ou à la nuit (la victoire, le premier quart) (`accorderPaliersDuJour`) et rangés sous le jour (`cleDuJour`), jamais sous une soirée ; le laurier des vainqueurs d'hier (`laureats`), qui suit leur prénom jusque dans les soirées (`Distinctions.laurier`, `components/Laurier.tsx`) et grandit avec leurs victoires (`niveauDuLaurier` : vert, d'or, serti, étoilé) — l'argent du défi de la semaine se porte au même endroit (`LaurierPorte`), celui d'hier passant devant ; les hauts faits du jour (le Lève-tôt à la fin de la partie, le Dernier Métro à son début, le reste à la nuit — `decernerLaNuit` —, rangés sous le jour, annoncés le lendemain, payés dans la ligne des paliers — `xpHorsDesSoirees`), l'Éclat — une chance sur quarante à chaque partie finie (`CHANCE_ECLAT_DU_JOUR`, `ProfileStore.tirerUnEclat`), tiré dans `enregistrer`, jamais dans `decernerALaFin`, que la relecture des jours rejoue, rangé sous le jour avec les paliers de La Pluie d'Éclats qu'il fait tomber et relu par la fin de la partie —, le mois qui se clôt à son tour (`cloreLesMois`, `jour_meta`) — son coffre à chaque joueur classé (`poserLesCoffresDuMois`, `jour_coffres_du_mois` : règle `missions.md`), son champion (un titre daté, `mois:2026-10`, sa marque tout le mois suivant, `champions`, que l'écran commun salue, `EntreeEnScene`), le Mois complet —, la page du calendrier des Heures à vingt jours joués, les sabliers de la série (`profile_sabliers`, `serieAvecSabliers` — dans la pastille de la série, en haut de la page à côté de la cloche, `SerieDuJour`, qui ouvre leur feuille ; achetés à la boutique, un ou deux d'un coup) et Chronos (`core/divins.ts`) ; tout cela relu une fois sur les jours d'avant, sous sa version (`relireLesJours`, `VERSION_DES_JOURS`) ; la réserve, à `/admin#reserves` (le QG 2, lot 7 : la page du jour n'en garde que ses jours d'avance, d'une ligne), et les profils masqués, à `/admin#jour` — avec ce que le QG en suit : le tirage question par question, le classement du mois, les séries en cours, le rappel du soir (`suiviDAujourdhui`, `seriesEnCours`, règle `qg.md`) ; ses signalements, à `/admin#signalements`, avec ceux de la campagne : les corriger — le jour qui l'a posée aussi quand la bonne réponse ne change pas (`corrigeAussiLeJour`) —, les reclasser, annuler leurs points pour tous, les retirer, les garder (`JourStore.corriger`, `reclasser`, `refermer`, règle `qg.md`). Une partie se note en étoiles — une, deux, trois au sans-faute (`ETOILES_DE_LA_MEDAILLE`, `NOM_DE_LA_NOTE`, `phraseDesEtoiles`, `NoteDuJour`) : sa « médaille d'or » se lisait comme un palier d'or (les mots : règle `recompenses.md`) ; sa fin passe par l'écran des gains de tous les modes, et le lendemain dit en lignes de trophées ce que la nuit a décerné. La page s'ouvre sur le profil léger (`/api/joueur/moi?leger` : prénom, niveau, thème — la campagne aussi), sa partie demandée en même temps : le détail coûtait huit allers-retours à la base. Au téléphone, sans liaison temps réel, la page redemande ce que le serveur décide seul jusqu'à l'avoir (`client/src/insister.ts`), et chaque écran commence en haut, rend le focus perdu (`client/src/focus.ts`) et n'accepte aucun toucher dans sa première demi-seconde (`gesteAccepte`) ; « ← Retour », en tête du classement ou de la correction comme en bas, ramène d'où l'on vient (`retourDuJour`) — l'écran qui les a ouverts, marqué dans l'historique (jamais par `location.hash =`), ou la page qui a ouvert `/jour` ; chaque période du classement a son adresse (`#classement-mois`), réécrite sur la même entrée
- `client/src/components/Corrige.tsx` · `SerieCorrigee.tsx` — le corrigé d'une question, le même partout où l'on relit ses réponses — la correction du jour, et en campagne la série, le défi, le duel, les sentiers, les parcours : la marque du verdict (`verdictDe`), l'intitulé, puis la bonne réponse centrée dans son cadre d'or, sa légende (« La bonne réponse », « · la tienne » quand c'était la sienne), et la sienne fausse dessous, barrée dans un pointillé d'alerte (« Ta réponse ») — la coche, la croix, le plein et le pointillé pour qui distingue mal les couleurs. Elles se lisaient en petit sous l'intitulé, en campagne sur une seule ligne grise, et l'on prenait l'une pour l'autre (un retour utilisateur du 13 octobre 2026 : « j'aimerais que la bonne réponse soit centrée aussi »). Au quiz du jour, chaque question dit en plus ce qu'elle a rapporté, en tête, en combien de secondes la réponse est partie sur combien (`ms`, `duree` de `JourStore.correction`) et son bonus de rapidité (`rapidite`, lu dans ses points par `bonusDeRapidite`, `games/quiz.ts` : le client ne connaît pas le barème) — le même retour : « savoir le nombre de points par réponse, et si on a répondu vite ou pas » ; sans réponse, pourquoi : le temps écoulé, la sienne arrivée après la fin (`tropTard`, comme à la révélation), ou la partie arrêtée avant. La campagne, sans chrono, n'a ni points ni temps. Elle corrige par une seule liste (`SerieCorrigee`, qui seule importe `shared/campagne.ts` : `Corrige` reste léger pour la page du jour) — cinq copies vivaient dans ses pages (`corrige.test.ts`, `jour-telephone.test.ts` ; `server/scripts/rendu-jour.ts` photographie la correction du jour, `rendu-recompenses.ts` celle du défi)
- `shared/calendrier.ts` · `client/src/components/Calendrier.tsx` · `calendrier-peint.ts` — le calendrier des Heures du quiz du jour : douze enluminures, une par mois ; vingt jours joués dans un mois ouvrent sa page (`JOURS_POUR_UNE_PAGE`, rangée `heures:<mois>` sous le mois, hors du compte des badges), le champion du mois la reçoit dorée — la dorure se lit sur ses titres de champion (`pagesDorees`) —, les douze ouvrent le thème des Très Riches Heures ; `calendrier-peint.ts` est écrit par `decors.ts --livrer`, jamais à la main
- `shared/propositions.ts` · `client/src/components/LaPlume.tsx` · `QgQuestionsDuPublic.tsx` — les questions du public (le choix du propriétaire du 2 novembre 2026, le quiz du jour d'abord) : la plume au bout du résultat du jour et du défi (`JUSTES_POUR_LA_PLUME`) — et au jour joué, à chaque retour et pour tous (`JourJoue` : la fin ne se voit qu'une fois, le souhait du propriétaire du 2 novembre 2026) —, « Ta question » écrite dans la carte du jeu — son anecdote facultative comprise (`ANECDOTE_DU_PUBLIC_MAX`, recopiée de `MAX_ANECDOTE` pour ne pas tirer `shared/library.ts` dans chaque page qui lit un profil, jamais plus haute ; le QG la reçoit pré-remplie dans « Accepter ») —, que le téléphone conseille et que le serveur relit aux mêmes règles (`conseilDeLaProposition`, `lireLaProposition` ; `POST /api/jour/propositions`, trois en relecture au plus, comptées dans l'`INSERT … SELECT` qui l'écrit), « Tes questions » sous la carte (`sesPropositions`) ; au QG, `/admin#jour`, l'accepter — retouchée, sa catégorie obligatoire — dans le lot de l'apport à la réserve (`accepterLaProposition`, `ajouter(…, 'public', avecLui, auteur)` : `source = 'public'`, `jour_reserve.auteur`), ou la refuser d'un motif (`refuserLaProposition`), « À traiter » qui les compte (`propositionsATraiter`) ; son auteur l'apprend sur son accueil — acceptée, jouée, refusée —, lu dans le lot de l'accueil avec les mercis (`lectureDesPropositionsRelues`, `AnnonceDeLAdministrateur` `proposition`). Au quiz du jour, une par jour au plus, sa file à elle (`QUESTIONS_DU_PUBLIC_PAR_JOUR`, `tirer`), signée à la révélation (`signee`), et son auteur ne la joue pas (plus bas). Ce qu'elle lui rapporte : ses confettis, acceptée puis jouée (`CONFETTIS_D_UNE_QUESTION_ACCEPTEE`, `…_JOUEE`), comptés avec ceux du quiz du jour partout où ils se lisent — son solde (`lectureDesJustes`), la circulation et les flux du QG (`justesDeTous`, `confettisDepuis`, sur la même union, `CONFETTIS_DES_PROPOSITIONS`) : une lecture qui les oublierait ferait mentir l'économie du QG, que `qg-economie.test.ts` compare aux soldes ; et La Plume, une piste du jour comme L'Assidu, comptée par ses questions jouées (`StatsDuJour.questions`, une lecture de plus dans le lot des paliers, `lecturesDesStats`) — à son « Jouer » suivant : la relecture des jours n'a rien à rattraper. Une question annulée pour tous le jour où elle passe ne compte plus pour son auteur, comme pour personne : ni les confettis de son jour, ni La Plume — une seule règle, `JOUEE_ET_COMPTEE` (son tirage à sa clé, puis `ANNULEE_POUR_TOUS`), que ces quatre lectures partagent —, et son accueil remplace « au quiz du jour : +25 » par « Ta question a été annulée » (`IssueDUneProposition` `annulee`, une carte à son nom : déjà vue, la première ne la tait pas). Son acceptation reste payée, et une étape de La Plume déjà tombée reste (invariant 22) (`jour-propositions.test.ts`, `jour-question-du-public.test.ts` ; `server/scripts/rendu-plume.ts` la photographie). Avant même de jouer, sous la carte du jour, la bulle de la plume (`BulleDeLaPlume`, « Plus tard » la range une semaine, `quizz.plume.bulle`)
- `client/src/components/QuestionBonus.tsx` — la question bonus (le choix du propriétaire du 8 novembre 2026, « 1 + 2 + 4 », `shared/propositions.ts`) : la question du public ne se mêle plus aux dix — on la jouait à la course sans voir qu'un joueur l'avait écrite, et l'administrateur qui l'avait relue la jouait en en sachant la réponse. Tirée avec le jour, à part (`jour_bonus`, `Tirage.bonus`, `questionBonus` : réponses mélangées, `DUREE_DE_LA_QUESTION_BONUS`), elle se joue après les dix, sa partie finie (`servirLeBonus`, `repondreAuBonus`, `expirerLeBonus` dans `aJour` — `POST /api/jour/bonus`, `/repondre` ; chaque réponse rend le bonus seul, `BonusDuJour`, jamais la partie : servir ne relit pas la fin, sinon son chrono courrait pendant les lectures), hors des points, du classement et des étoiles ; trouvée, ses confettis relus de sa colonne (`bonus_juste`, `CONFETTIS_D_UNE_PARTIE`, dans les trois lectures des confettis) et son expérience figée (`xp_bonus`, dans `lecturesDeLExperience` et la carrière). Son auteur et l'administrateur qui l'a relue ne la jouent pas (`neLaJouePas`, `tienne`, `relue` : `jour_reserve.relecteur`, le profil que tient la console qui l'accepte). Le pouce (`voterPourLeBonus`, `bonus_vote`, jusqu'à minuit) ; le défi de l'auteur, jugé le jour clos (`BIEN_DOSEE`, la troisième part de `CONFETTIS_DES_PROPOSITIONS`, `dosageDe`), et son bilan le lendemain (`IssueDUneProposition` `bilan`, à la place de la carte du jour) ; ce que la salle en fait au QG (`salleDuBonus` : `PropositionAuQg.salle`, `SuiviDuJour.bonus`) et dans « Tes questions ». À l'écran : l'annonce avant les dix (`AnnonceDuBonus`), l'écran qui la présente juste après elles (`EcranDuBonus`, « Plus tard » mène au résultat), sa question et sa révélation dans le parchemin (`QuestionDuBonusEnJeu`, `RevelationDuBonusVue` — la niche y réagit, `niche-reactions.test.ts`), sa carte sur la fin et le jour joué (`CarteDuBonus`), la correction au bout (`BonusCorrige`) ; jamais `.card` : chaque thème en repeint le verre (`jour-question-bonus.test.ts`)

## Les pièges

- **La question bonus vit à part des dix** (`jour_bonus`, jamais dans
  `jour_tirages.questions`) : tant de lectures parcourent les dix — leurs
  points possibles, `comptees`, les annulées, « Question par question »,
  les signalements par leur index, `json_each(t.questions)` — qu'une
  onzième y aurait compté partout. Elle n'a donc ni index, ni signalement,
  ni annulation pour tous ; rien de la partie ne la lit, sauf ce qu'elle
  rapporte, et une lecture des confettis ou de l'expérience du quiz du jour
  de plus passe par `CONFETTIS_D_UNE_PARTIE` et `xp_bonus`, sinon elle
  mentirait au solde que `qg-economie.test.ts` compare. Pendant les dix,
  sa vue ne lit rien (`bonusVu` : ni signature ni salle tant que la partie
  est en cours). Les tirages d'avant le 8 novembre 2026 n'ont pas de
  `jour_bonus` : leur question du public est l'une des dix, et le piège
  suivant vaut pour eux seuls (`commeAvant`, `jour-question-du-public.test.ts`).

- **Sa propre question compte à sa moyenne, partout où ses points se
  font** — les tirages d'avant la question bonus (`partDeLAuteur`, « moyenne personnelle ») : rien ne s'écrit pour
  elle dans `jour_reponses` — ni « trouvée par », ni la difficulté mesurée,
  ni ses écussons ne le comptent —, la partie avance par le chemin d'une
  réponse (`passerLaSienne`, dans `commencer` et `suivante`, jamais servie
  ni chronométrée), et ses points et ses bonnes réponses se refont de ses
  lignes relues (`brutDe`) plus sa part, sous son verrou : dans
  `enregistrer`, dans `recompter` (une annulation : une autre recompte sa
  moyenne, la sienne la retire) et dans `correction`. Un chemin de plus
  qui écrit `jour_parties.points` ou `justes` en les additionnant fait de
  même, sinon l'auteur perd sa part — ou la garde d'une question annulée.
  Elles comptent pour la médaille et le sans-faute, qui lisent `justes`
  contre les questions du jour : ni `comptees` ni le SQL de L'Élite n'ont à
  connaître l'auteur. Ses questions du public n'entrent ni dans les jours
  d'avance, ni dans « Voir les prochains jours », ni parmi les anciennes
  qu'une réserve à sec repose : leur file dit une par jour.

- **Aucun formateur au chargement de `shared/jour.ts`** : ses
  `Intl.DateTimeFormat` se créent à leur première lecture
  (`aLaPremiereLecture`). Presque toutes les pages l'importent pour une
  constante — le nom d'un laurier, un type —, et le premier `Intl` d'une page
  charge les données ICU : 20 à 80 ms au processeur d'un téléphone moyen,
  avant son premier écran (`jour.test.ts`). Et `jourDe` se garde par heure
  (`joursDesHeures`) : les missions et le carnet le demandaient à `Intl`
  pour chaque réponse d'un joueur — quatre millisecondes par page, dix fois
  plus au dixième de cœur de l'hébergeur (le banc du 16 octobre 2026). Une
  heure se lit une fois, à son début, et ne se garde que si Paris y tombe à
  une heure pile — vrai depuis 1911 ; un seul appel à `Intl` par heure,
  que `jour-charge.test.ts` borne pour le laurier. Une autre façon de dire
  le jour de Paris passe par `jourDe`, jamais par un `Intl` à elle.
- **Le quiz du jour a son horloge** (`horlogeDuJour`, `JourStore.maintenant`) :
  les tests la font passer minuit (`jour-partie.test.ts`). Sa ligne
  d'expérience (`LIGNE_JOUR`, `#jour`) compte dans le total et le niveau
  mais pas dans l'historique : tout ce qui lit `profile_xp` comme des
  soirées écarte les lignes à part (`#paliers`, `#jour`, `#campagne`,
  `#rattrapage` — `HORS_LIGNES_A_PART`, `auth/profiles.ts`) — la série du jour les écarte
  aussi. Une ligne de plus rejoint `LIGNES_A_PART` et les deux listes
  écrites à la main de `recalculerHistorique` (`core/recalcul.ts`) et de
  `remettreAuBareme` : oubliée là, le recalcul la relirait comme une
  soirée. Rien ne tourne à minuit : une clôture passe par
  `clorePasses`, à la première demande du jour — ou à la première diffusion
  d'une soirée qui réclame les lauriers (`laureats`) : lus en mémoire, ils
  se taisent à minuit, la nuit se clôt en arrière-plan, et la salle où
  joue un lauréat se rediffuse (`laurierChange`). Ses paliers sont des hauts
  faits de carrière marqués `duJour` : la carrière les compte (`jour`, pour
  la page du profil), mais `paliersAtteints` — la clôture d'une soirée, le
  recalcul — les écarte ; seul le quiz du jour les décerne — et La Légende
  avec eux (`paliersDuNiveau`) : son expérience entre dans le niveau. Et tout ce qui écrit les
  points ou l'expérience d'un profil passe sous son verrou, le tirage relu
  dedans — sa partie, le recompte d'une annulation, le podium de la nuit :
  recomptée d'un coup pour tout le jour, une annulation laissait payée la
  question qu'une réponse en route écrivait derrière elle. Le tirage se relit
  en mémoire (`tiragesGardes`) : seule une annulation le change, et elle
  remet le sien à jour sous le verrou `#tirage` — une nouvelle écriture de
  `jour_tirages` en ferait autant. Les joueurs d'un classement se chargent
  d'un coup (`ProfileStore.byIds`), et les points des jours se gardent sous
  la révision de leur jour (`pointsGardes`, comme les classements) : une
  écriture de `jour_parties` qui contournerait `reviser` laisserait les
  places en retard. Une partie qui commence et une réponse ne font pas
  relire le classement du jour : il les suit en mémoire, sous la révision
  neuve, s'il était à jour jusque-là (`suivreAuClassement`, le 3 novembre
  2026 — chaque réponse de n'importe qui le faisait relire en entier à la vue
  suivante de chacun : à cent joueurs, quinze relectures de cent lignes par
  seconde) ; ce qu'il y écrit est ce que la base vient d'écrire — les
  points, la fin. Une écriture de plus qui touche aux points d'un joueur
  passe par lui, ou par `reviser` qui fait tout relire ; une annulation, une
  relecture des jours, un profil parti passent par `reviser`, et une
  suspension ou une réactivation fait relire chaque classement gardé
  (`suspensionChangee`) : il ne se relit plus de lui-même à la réponse
  suivante, et le suspendu y serait resté (`lectures-gardees.test.ts`
  compare la place, le nombre de joueurs et l'écart à la base). Son hier aussi, par profil (`sonsHier`), sous la révision de
  ce jour et la version des masquages (`versionDesMasques`) — un masquage
  qui ne la monterait pas le laisserait en retard —, et les vainqueurs
  d'hier se lisent dans les lauriers. « Question suivante » lit sa vue
  d'abord (`contexteDeVue`), puis sert sa question au dernier aller-retour :
  le chronomètre du joueur ne court pas pendant les lectures. « Commencer »
  aussi : la partie naît sans question servie, ses paliers tombent, puis la
  première se sert — et une partie qu'une panne a laissée là la reçoit au
  « Commencer » suivant.
- **`VERSION_DES_JOURS` ne relit pas tout** (`relireLesJours`) : la nuit
  des jours clos, le début et la fin de chaque partie, les paliers — mais
  ni les mois déjà clos (`cloreLesMois` saute ceux dont `jour_meta` a le
  `mois_clos:`), ni le podium (`jour_podiums`, payé une fois par `clore`),
  ni l'Éclat. Une règle de mois ou de podium qui change demande sa propre
  relecture, sous un drapeau — comme le barème du solo
  (`core/baremeDuSolo.ts`), puisque les parties figent leur expérience.
  Et un haut fait de la nuit de plus entre dans `CLES_DE_LA_NUIT`
  (`estDeLaNuit`) : sinon la fin de la partie l'annonce, et le lendemain
  ne le raconte pas.
- **Pas de chronomètre au serveur** : une question montrée expire à la
  lecture suivante (`expirer`), que le téléphone demande de lui-même
  `GRACE_MS` + 0,6 s après l'échéance — une marge recopiée en dur
  (`APRES_ECHEANCE_MS`, `JourApp.tsx`) : changée au serveur, elle se
  change là aussi.
- **Les intitulés de la réserve gardent leur ensemble tant qu'ils ne
  changent pas** (`empreintes`, relus toutes les dix minutes) : la campagne
  le compare par identité (`jouablesGardees`), et un ensemble neuf à chaque
  relecture lui faisait refaire ses jouables, leurs sujets et la
  préparation de ses tirages (`tirage-prepare.test.ts`). Un apport ou une
  correction l'efface (`empreintesGardees = null`) : la relecture suivante
  en fait un neuf.
- **L'Élite se compte une fois par nuit close** (`elitesGardees`,
  `EliteGardee`) : ses jours dans le premier quart, comptés jusqu'à la
  dernière nuit close (`MAX(jour)` de `jour_clotures`, lu dans le même
  lot), puis seulement ceux d'après. Relus en entier, ils parcouraient
  chaque jour qu'il avait joué avec tous ses joueurs — 2 400 lignes au
  quota de Turso pour le plus assidu, à chaque page du profil, chaque
  partie, chaque nuit (le 22 octobre 2026). Ce qui le tient : une nuit
  close ne se réécrit plus (`annuler` refuse un jour clos), les nuits se
  closent dans l'ordre (`clorePasses`), et ce qui change la salle d'un
  jour passé monte une version — un masquage ou une suppression
  `versionDesMasques`, une suspension ou une réactivation
  `versionDesSuspensions` (le crochet `ProfileStore.suspensionChangee`,
  branché par `server.ts`). Un geste de plus qui ferait bouger le rang d'un
  jour clos — rouvrir une nuit, recompter ses points — monte l'une
  d'elles, ou L'Élite de chacun resterait à l'ancien compte
  (`jour-nuit.test.ts`).
- **Ce que ses pages relisaient de lui se garde, et sa réponse l'oublie**
  (`LecturesGardees`, `core/lecturesGardees.ts`, le 3 novembre 2026 : 13 %
  de ce que la production lisait au quota de Turso) : ses bonnes réponses
  de ses trente derniers jours, que sa carrière lit à chaque accueil
  (`justesGardees`), ce que le quiz du jour sait de lui, que sa carte et sa
  page lisent (`savoirsGardes`, `savoirDe`), et ses bonnes réponses par
  catégorie depuis le lundi d'avant, que ses missions jugent
  (`categoriesGardees`, sous la semaine lue). `enregistrer` les oublie
  après son lot, même s'il échoue — son savoir à chaque réponse, les deux
  autres à une bonne —, un tirage qui change pour tous les oublie pour
  chacun (`tirageChange` : `annuler`, `corriger` quand il touche le jour),
  et `oublierProfil` ; rien ne se croit à jour plus de dix minutes
  (`LECTURES_GARDEES_MS`). Une annulation se lit encore de ses parties,
  relues à chaque fois (`joursJoues`), et une partie qui commence n'écrit
  aucune bonne réponse. Une écriture de plus dans `jour_reponses` ou dans
  les questions et les annulées de `jour_tirages` oublie ce qui en dépend,
  ou la page montrerait l'état d'avant jusqu'à dix minutes
  (`lectures-gardees.test.ts`).
- **Sa série se garde d'une question à l'autre** (`joursDeSerieGardes`,
  `serieGardee`, le 3 novembre 2026) : chaque vue (`contexteDeVue`) relisait
  ses jours joués des 400 derniers jours, ses soirées et ses sabliers — dix
  fois par partie. Ils ne bougent qu'avec lui : la partie qu'il commence
  (`commencer`, après son lot, même s'il échoue), une soirée créditée,
  remise au barème ou retirée (`ProfileStore.oublierSesSoirees`), un sablier
  acheté (`acheterSablier`) — le magasin des profils le dit par
  `serieChangee`, que `server.ts` branche sur `oublierLaSerie` —, et le jour
  qui change (sa variante). Une écriture de plus dans `profile_sabliers`, une
  ligne de soirée de plus dans `profile_xp` le dit aussi, ou la vue
  montrerait la série d'avant jusqu'à dix minutes. L'achat d'un sablier,
  lui, relit toujours la base (`sabliersDe`, `serieDe`) : c'est une écriture,
  pas une vue.
- **Ses bonnes réponses avec chaque compagnon se gardent**
  (`compagnonsGardes`, `JourStore.compagnonsDe`, le 23 octobre 2026 : relues
  de la base à chaque fin de partie, chaque boutique, chaque niche, 2,4 % du
  quota de Turso) : elles ne bougent qu'à une bonne réponse comptée avec un
  compagnon dans sa niche (`enregistrer`, quand la ligne s'écrit vraiment),
  à l'annulation d'une question — tous oubliés, sous le verrou du tirage —
  et au départ d'un profil (`oublierSesCompagnons`). Une lecture en route
  quand l'un d'eux tombe ne sert plus à la suivante : oubliée, ou d'une
  version d'avant (`versionDesCompagnons`, l'annulation). Un
  geste de plus qui écrit ou efface une ligne de `jour_reponses` portant un
  compagnon l'oublie aussi (`compagnons.test.ts`).
