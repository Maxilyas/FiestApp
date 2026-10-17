---
paths:
  - "shared/{expedition,jokers}.ts"
  - "server/src/expedition.ts"
  - "client/src/views/ExpeditionApp.tsx"
  - "client/src/components/{Balise,Vies}.tsx"
  - "server/scripts/{rendu-expedition,calibrage-expedition}.ts"
  - "server/test/{expedition,expedition-carte,expedition-pli,expedition-legendaires,expedition-jokers,expedition-mesure,expedition-charge,expedition-tirage}.test.ts"
---

# L'Expédition : la carte, les escales, les gardiens, les jokers

Trois actes, chacun une carte tirée au sort — six étages de quatre colonnes, deux campements, un gardien au bout —, et au bout du troisième un des trois gardiens vaincus à garder : un légendaire ; en main, des jokers. Le brief validé par le propriétaire le 17 octobre 2026 (« on fait que rajouter des choses mais on ne sait plus quoi choisir ») : `retours/2026-10-17/expedition.md`. **Les étapes 1 et 2 sont faites** — la carte et une expédition de bout en bout, puis les jokers ; les formes de question (3), les écus et l'échoppe (4) suivent. Ouverte en production depuis ses jokers (`EXPEDITION_EN_PRODUCTION`) : avec une équipée de deux, le joueur moyen arrive au bout 26 à 29 fois sur cent, le fort 67 à 79 — la cible du brief, une fois sur trois et huit sur dix, approchée.

## Les fichiers

- `shared/expedition.ts` — tout ce qui se calcule, pur. Le générateur (`carteDUnActe`, de la graine du n-ième départ du profil — `graineDe`, `hasardDe` : la même graine redonne la même carte) : cinq chemins qui montent sans se croiser, leurs pas font les escales et les liens ; la sorte de chaque escale (`POIDS_DES_ESCALES`), son thème — une catégorie, un mélange de deux ou trois, un sujet pointu (`PART_DES_MELANGES`, `PART_DES_THEMES_POINTUS`) —, sa forme (`POIDS_DES_FORMES`) ; ce que l'étape ne sait pas jouer devient une question (`SORTES_OUVERTES` : l'échoppe et l'inconnu ; `FORMES_OUVERTES`), après le tirage : la carte garde ses proportions d'une étape à l'autre. Les marches (`MARCHES_DES_ACTES`, `marcheDe` : jamais d'experte), les gardiens (`gardiensDe`, jamais l'invité du jour), l'invité du jour (`inviteDuJour`) et l'équipée (`refusDeLEquipee`), les offres (`offreDeJokers`), les chances (`chanceSelonLaForme`, `chanceDeVaincre`, `viesAuBout`, `chancesDuTrace`, `traceLePlusSur`, `escalesAtteignables`), le pli (`pliDeLExpedition` — la main, le paquet, la défausse, les posés, l'offre, le campement, les jokers de route —, `escalesPermises`, `carteEnJeu` et `maisonAOuvrir` — la carte que Il connaît la maison change —, `questionsDuGardien`), pourquoi un joker ne se joue pas maintenant (`refusDuJoker`), ce qu'un joker montre d'une question (`reponsesEffacees`, `indiceDeLEnigme`, `sensDeLOracle` : ils lisent la bonne réponse, le serveur seul les appelle), les types de la page (`VueDeLExpedition`, `JokersEnJeu`, `PageDeLExpedition`), le nom d'un gardien dans une phrase (`leGardien`, `auGardien`, `gardienAuFeminin` : « vers le Kraken », « à la Chouette d’Argent »). Ses constantes sont des choix de produit (`docs/reference/baremes.md`)
- `shared/jokers.ts` — `EXPEDITION_EN_PRODUCTION`, le catalogue (`JOKERS_DES_LEGENDAIRES`, vingt et un, `JOKERS_SANS_LEGENDAIRE`, sept ; `joker`, `jokerDuLegendaire`), `LEGENDAIRES_A_JOKER` — eux seuls gardent un acte, s'emmènent et ont la voie —, et les règles du paquet : `PAQUET_DE_DEPART`, `MAIN_MAX`, `MAIN_MAX_DES_TROIS_TETES`, `PLACES_DE_L_EQUIPEE`, `JOKERS_PAR_OFFRE`, `POIDS_DES_RARETES`, `EFFACE`, `JOKERS_QUI_AIDENT`. Il n'importe rien : `shared/legendaires.ts` le lit, l'album et l'accueil aussi, sans tirer toute l'expédition
- `CampagneStore` (`core/campagne.ts`, « L'Expédition ») · `server/src/expedition.ts` — une expédition est une série `mode = 'expedition'` : son départ dans `campagne_series.expedition` (`DepartDExpedition`, versionné — la version 2, ses jokers : son équipée, l'invité de son départ, sa chance sur chaque marche de chaque catégorie et sur une source), ses gestes dans `expedition_gestes` (`serie_id`, `rang`, `geste`), ses réponses dans `campagne_reponses` — aidées, la clé de leur joker (`joker`) —, comme toute partie : l'expérience, les confettis, le carnet et « jamais vues d'abord » la comptent sans rien en savoir. Les routes, pour les profils (`GET` et `POST /api/expedition`, `POST /api/expedition/:id/geste`, `…/reponse`, `…/abandon`) ; sa correction et ses signalements par celles de la série (« en expédition » au QG). `pageDeLExpedition` (celle en route, sinon la prochaine : son numéro, ses gardiens, ceux qu'il a déjà — `aLui` —, l'invité du jour, ses légendaires qui ont leur joker — `equipables`), `partirEnExpedition` (une à la fois, son équipée), `chancesDeLExpedition`, `gesteDExpedition` (`gesteRecevable` : avancer, jouer, prendre, camper ; garder, `garderUnGardien`), `completerLExpedition` (ce que le pli demande de tirer, `aTirer` — la question d'une escale, celles du gardien, l'autre d'Échange ou de Deux visages, la reprise de La boucle —, tiré dans le lot du geste), `repondreEnExpedition` (Double chance : deux réponses ; `jokerQuiAide`), `abandonnerLExpedition`, `tirerPourLExpedition` (sur le thème de l'escale — ou la catégorie du Commandement —, par `tirerPourUneEscale`, le rang d'une épreuve lu dans un ordre tiré à mesure), `expeditions` (l'expédition en route en mémoire, `ExpeditionGardee` : `expeditionAJouer`, `garderLExpedition`, `ecrireLExpedition`, `vuAilleurs`), `vueDeLExpedition` (ce que la page reçoit : la carte en jeu, les jokers et leurs refus, ce qu'un joker montre), `recompenserLExpedition` (les paliers de la campagne : Le Marathonien ; ni record ni haut fait de série). `oublierProfil` efface ses gestes
- `client/src/views/ExpeditionApp.tsx` — la page (`/expedition`, à la demande dans `main.tsx`, préchargée par `shared/depart.ts`, réservée dans `shared/space.ts` ; un gros bouton sur l'accueil d'un profil, `AccueilDesRoles.tsx`, tant que le drapeau l'ouvre) : le départ (`Depart` : le numéro de la carte, les trois gardiens annoncés, ceux qu'il a déjà, l'équipée — `Places`, « Changer » —, retenue sur le téléphone, `quizz.expedition.equipee`), sa feuille (`FeuilleDeLEquipee` : la grille des légendaires qu'il peut emmener, la fiche du dernier touché, `TousLesJokers` déplié à la demande), la carte d'un acte (`CarteDeLActe` : les colonnes en pour cent, les étages en pixels — `COLONNES_X`, `Y_HAUT`, `PAS_D_ETAGE` —, les liens en SVG, le tracé le plus sûr redessiné à chaque escale touchée — depuis les escales permises sous Le détour ou Le raccourci, `lePlusSurDepuis` —, le panneau collé en bas, sa main en une ligne et sa légende, « Abandonner l’expédition »), l'escale (`Escale` : ce qu'un joker montre, la main sous les réponses), la main (`MainDeJokers`, `FeuilleDeLaMain`, le Commandement et sa catégorie), la révélation (`Revelation`, `verdictDe` : ce que la réponse a coûté, lu de l'écart avec la vue d'avant), l'offre (`Offre`), le campement (`Campement`), le gardien vaincu (`GardienVaincu`), le choix du légendaire (`ChoixDuLegendaire`), la fin (`FinDeLExpedition`, l'écran des gains de la campagne, `gains.test.ts`). `components/Balise.tsx` (la couleur de piste d'une chance, venue des sentiers) et `components/Vies.tsx` (les cœurs, venus de la campagne) se partagent. Sa section de `styles.css` : « L'Expédition », classes `exp-*`
- La voie : `shared/legendaires.ts` (`avecLExpedition`, `cleDeLExpedition`, `estUneVoieDExpedition`, `legendaireDeLExpedition`, `voiesMontrees`) — chaque légendaire qui a son joker, hors saison, se gagne aussi en le gardant au bout (une voie `aussi`, la ligne `expedition:<clé>` de `profile_badges`, rangée sous `#campagne:<série>`, comme une saison) ; l'album lui donne son lieu (`shared/album.ts`, `expedition` ; `ouIlSeGagne` se dit voie par voie), les pistes et « le plus proche » l'écartent (`shared/pistes.ts`, `shared/proches.ts`), l'étagère et le compte des badges aussi (`ProfileStore.etagereDe`, `badges`)
- `server/scripts/rendu-expedition.ts` (client construit d'abord ; `ivoire` en argument : six légendaires rangés sur le profil, le Dragon d'Or en invité du jour par `horlogeDuJour`) · `server/scripts/calibrage-expedition.ts` (`--expeditions`, deux mille par défaut ; `--garder`, le joueur qui garde ses jokers rares et légendaires pour le gardien) — tous les écrans en 360 × 640, chaque joker qui passe compris ; la chance d'aller au bout de trois joueurs simulés, sur le vrai générateur et le vrai pli, sans jokers, avec le paquet de départ, avec deux équipées
- Les tests : `expedition.test.ts` (les routes de bout en bout, la source, les gardiens qu'il a, l'ouverture en production), `expedition-carte.test.ts` (le générateur, les chances, le tracé), `expedition-pli.test.ts` (le pli), `expedition-legendaires.test.ts` (la voie, les jokers, la voie montrée), `expedition-jokers.test.ts` (chaque joker dans le pli : la main, la défausse, les posés, les offres, le campement, l'équipée), `expedition-mesure.test.ts` (par les routes : l'équipée et l'invité, ce qu'un joker montre sans la bonne réponse, la colonne `joker`, la mesure, la précision, le carnet, Échange et Passe-muraille, aucun joker hors de l'expédition), `expedition-charge.test.ts` (les allers-retours de chaque geste, comptés ; ce qu'il a vu relu après une réponse ailleurs ; une écriture ratée oubliée), `expedition-tirage.test.ts` (le tirage d'une escale : ce qu'il lit, ses règles)

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
- **Les chances viennent du modèle du savoir, au départ** (le chemin de la
  chance d'une épreuve : `forceSurLesSentiers`, `chanceSurLaMarche`, sur
  ses premières réponses). Sous vingt premières réponses, ou sans modèle,
  celles d'un joueur moyen (`TAUX_DU_CALIBRAGE`), et la page le dit
  (`moyen`). Une source se lit sur toutes les catégories (−1) : sa question
  n'est choisie qu'en y marchant. Le Commandement relit la chance d'une
  escale dans `chances`, gardées au départ : pas un appel au modèle de plus.
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
- **Jamais un légendaire de saison** : ni gardien, ni voie — il ne se gagne
  qu'à sa saison, par elle seule. Vingt légendaires ont la voie, pas vingt
  et un : le Bouquet a son joker, pas la voie. Son joker, lui, s'emmène et
  peut être l'invité du jour.
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
- **Un geste remonte la page en haut** (`setEcran`) : sur la carte, son
  effet recentre l'escale où il est à chaque geste (`vue.rang`) — un joker
  joué sur la carte la laissait en haut, loin de lui.
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
