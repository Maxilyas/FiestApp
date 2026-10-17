---
paths:
  - "shared/{expedition,jokers}.ts"
  - "server/src/expedition.ts"
  - "client/src/views/ExpeditionApp.tsx"
  - "client/src/components/{Balise,Vies}.tsx"
  - "server/scripts/{rendu-expedition,calibrage-expedition}.ts"
  - "server/test/{expedition,expedition-carte,expedition-pli,expedition-legendaires}.test.ts"
---

# L'Expédition : la carte, les escales, les gardiens, les jokers

Trois actes, chacun une carte tirée au sort — six étages de quatre colonnes, deux campements, un gardien au bout —, et au bout du troisième un des trois gardiens vaincus à garder : un légendaire. Le brief validé par le propriétaire le 17 octobre 2026 (« on fait que rajouter des choses mais on ne sait plus quoi choisir ») : `retours/2026-10-17/expedition.md`. **Seule l'étape 1 est faite** — la carte, une expédition de bout en bout ; les jokers (2), les formes de question (3), les écus et l'échoppe (4) suivent. Fermée en production tant qu'elle n'a pas ses jokers : sans eux, le joueur moyen n'arrive au bout que cinq fois sur cent (`EXPEDITION_EN_PRODUCTION`).

## Les fichiers

- `shared/expedition.ts` — tout ce qui se calcule, pur. Le générateur (`carteDUnActe`, de la graine du n-ième départ du profil — `graineDe`, `hasardDe` : la même graine redonne la même carte) : cinq chemins qui montent sans se croiser, leurs pas font les escales et les liens ; la sorte de chaque escale (`POIDS_DES_ESCALES`), son thème — une catégorie, un mélange de deux ou trois, un sujet pointu (`PART_DES_MELANGES`, `PART_DES_THEMES_POINTUS`) —, sa forme (`POIDS_DES_FORMES`) ; ce que l'étape ne sait pas jouer devient une question ou une source (`SORTES_OUVERTES`, `FORMES_OUVERTES`), après le tirage : la carte garde ses proportions d'une étape à l'autre. Les marches (`MARCHES_DES_ACTES`, `marcheDe` : jamais d'experte), les gardiens (`gardiensDe`), les chances (`chanceSelonLaForme`, `chanceDeVaincre`, `viesAuBout`, `chancesDuTrace`, `traceLePlusSur`, `escalesAtteignables`), le pli (`pliDeLExpedition`, `escalesPermises`, `questionsDuGardien`), les types de la page (`VueDeLExpedition`, `PageDeLExpedition`), le nom d'un gardien dans une phrase (`leGardien`, `auGardien`, `gardienAuFeminin` : « vers le Kraken », « à la Chouette d’Argent »). Ses constantes sont des choix de produit (`docs/reference/baremes.md`)
- `shared/jokers.ts` — `EXPEDITION_EN_PRODUCTION`, le catalogue des jokers (des données à l'étape 1 : `JOKERS_DES_LEGENDAIRES`, vingt et un, `JOKERS_SANS_LEGENDAIRE`), `LEGENDAIRES_A_JOKER` : eux seuls gardent un acte et ont la voie. Il n'importe rien : `shared/legendaires.ts` le lit, et l'album sans tirer toute l'expédition
- `CampagneStore` (`core/campagne.ts`, « L'Expédition ») · `server/src/expedition.ts` — une expédition est une série `mode = 'expedition'` : son départ dans `campagne_series.expedition` (`DepartDExpedition`, versionné : sa graine, son numéro, ses gardiens, ses trois cartes et leurs chances, gardés tels quels), ses gestes dans `expedition_gestes` (`serie_id`, `rang`, `geste`), ses réponses dans `campagne_reponses`, comme toute partie — l'expérience, les confettis, le carnet et « jamais vues d'abord » la comptent sans rien en savoir. Les routes, pour les profils (`GET` et `POST /api/expedition`, `POST /api/expedition/:id/geste`, `…/reponse`, `…/abandon`) ; sa correction et ses signalements par celles de la série (« en expédition » au QG). `pageDeLExpedition` (celle en route, sinon la prochaine : son numéro, ses gardiens, ceux qu'il a déjà — `aLui`), `partirEnExpedition` (une à la fois), `chancesDeLExpedition`, `gesteDExpedition` (avancer, sa question tirée dans le lot du geste ; garder, `garderUnGardien`), `repondreEnExpedition`, `abandonnerLExpedition`, `tirerPourLEscale` (le tirage des sentiers, `tirerUneEpreuve`, sur le thème de l'escale), `recompenserLExpedition` (les paliers de la campagne : Le Marathonien ; ni record ni haut fait de série). `oublierProfil` efface ses gestes
- `client/src/views/ExpeditionApp.tsx` — la page (`/expedition`, à la demande dans `main.tsx`, préchargée par `shared/depart.ts`, réservée dans `shared/space.ts`) : le départ (`Depart` : le numéro de la carte, les trois gardiens annoncés, ceux qu'il a déjà), la carte d'un acte (`CarteDeLActe` : les colonnes en pour cent, les étages en pixels — `COLONNES_X`, `Y_HAUT`, `PAS_D_ETAGE` —, les liens en SVG, le tracé le plus sûr redessiné à chaque escale touchée, le panneau collé en bas et sa légende, « Abandonner l’expédition »), l'escale (`Escale`), la révélation, le gardien vaincu (`GardienVaincu`), le choix du légendaire (`ChoixDuLegendaire`), la fin (`FinDeLExpedition`, l'écran des gains de la campagne, `gains.test.ts`). `components/Balise.tsx` (la couleur de piste d'une chance, venue des sentiers) et `components/Vies.tsx` (les cœurs, venus de la campagne) se partagent. Sa section de `styles.css` : « L'Expédition », classes `exp-*`
- La voie : `shared/legendaires.ts` (`avecLExpedition`, `cleDeLExpedition`, `estUneVoieDExpedition`, `legendaireDeLExpedition`, `voiesMontrees`) — chaque légendaire qui a son joker, hors saison, se gagne aussi en le gardant au bout (une voie `aussi`, la ligne `expedition:<clé>` de `profile_badges`, rangée sous `#campagne:<série>`, comme une saison) ; l'album lui donne son lieu (`shared/album.ts`, `expedition`), les pistes et « le plus proche » l'écartent (`shared/pistes.ts`, `shared/proches.ts`), l'étagère et le compte des badges aussi (`ProfileStore.etagereDe`, `badges`)
- `server/scripts/rendu-expedition.ts` (client construit d'abord ; `ivoire` en argument) · `server/scripts/calibrage-expedition.ts` (`--expeditions`, deux mille par défaut) — tous les écrans en 360 × 640 ; la chance d'aller au bout de trois joueurs simulés, sans jokers, sur le vrai générateur et le vrai pli : faible 0 %, moyen 5 %, fort 42 % (le 17 octobre 2026)
- Les tests : `expedition.test.ts` (les routes de bout en bout, la source, les gardiens qu'il a, la fermeture en production), `expedition-carte.test.ts` (le générateur, les chances, le tracé), `expedition-pli.test.ts` (le pli), `expedition-legendaires.test.ts` (la voie, les jokers)

## Les pièges

- **Rien ne s'écrit que le départ, les gestes et les réponses** (invariant
  14) : l'état se replie à chaque lecture (`pliDeLExpedition`), le même pli
  pour l'expédition qu'on joue et pour une finie. Les colonnes `position`,
  `vies` et `justes` de sa série ne sont qu'un reflet pour les lectures de
  la campagne : ne les relis jamais pour jouer. Une question attend sa
  réponse : seul l'abandon passe, un geste de plus ne se joue pas
  par-dessus.
- **Un geste dit le rang qu'il croit suivre** (invariant 12, porté au
  solo) : `VueDeLExpedition.rang` compte les gestes faits, le suivant porte
  ce rang plus un ; une réponse, le rang de sa question (`enAttente`). Un
  double toucher, un second onglet sont refusés, et rien ne bouge.
- **Les cartes et leurs chances se figent au départ.** Une retouche du
  générateur, des marches ou du modèle du savoir ne vaut que pour les
  expéditions qui commencent : elle ne déplace pas une escale sous les pieds
  de qui joue. Un champ neuf de `DepartDExpedition` se lit absent dans les
  anciens — ou monte `v`.
- **Les chances viennent du modèle du savoir, au départ** (le chemin de la
  chance d'une épreuve : `forceSurLesSentiers`, `chanceSurLaMarche`, sur
  ses premières réponses). Sous vingt premières réponses, ou sans modèle,
  celles d'un joueur moyen (`TAUX_DU_CALIBRAGE`), et la page le dit
  (`moyen`). Une source se lit sur toutes les catégories (−1) : sa question
  n'est choisie qu'en y marchant.
- **Une source repose une erreur du carnet**, la plus en retard d'abord,
  sinon une facile. Sa question porte `carnet: true` : comme une révision,
  ni la mesure des difficultés, ni la précision et les écussons
  (`savoirDe`), ni L'Érudit, ni les catégories des missions ne comptent sa
  réponse, déjà lue (`HORS_DU_CARNET`, et le filtre de `mesuresBrutes`) ;
  l'expérience, les confettis, Le Marathonien et le carnet, si. Une lecture
  neuve de `campagne_reponses` qui mesure un savoir l'écarte aussi.
- **Le gardien tire ses questions d'avance** (`questionsDuGardien` : de
  quoi aller au bout de ses vies, sans vrai ou faux) ; vaincu, ses
  questions de reste ne se posent pas — le pli les saute. Une vie rendue en
  plein combat (les jokers, à l'étape 2) en tire une de plus
  (`repondreEnExpedition`).
- **Garder un gardien range le légendaire avant de clore** : un rangement
  qui échoue laisse l'expédition au bout, et le geste se rejoue. Un gardien
  qu'il a déjà se garde aussi — gagné ailleurs en route, ou tiré faute
  d'autres (`gardiensDe`) — et ne rapporte que l'expérience de ses
  réponses : le départ et l'en-tête le disent (`aLui`).
- **Jamais un légendaire de saison** : ni gardien, ni voie — il ne se gagne
  qu'à sa saison, par elle seule. Vingt légendaires ont la voie, pas vingt
  et un : le Bouquet a son joker, pas la voie.
- **Fermée en production, mais sa voie compte** : les routes répondent 404
  (`expeditionOuverte` : hors ligne, ou `APP_ENV` hors de la production,
  elles répondent) et l'album ne la montre pas (`voiesMontrees`), mais
  `legendairesDebloques` lit toutes les voies — un légendaire gardé en
  préproduction y est gagné, sur sa base à elle. L'ouvrir, c'est passer
  `EXPEDITION_EN_PRODUCTION` à `true`, avec ses jokers.
- **Les escales de la carte portent la classe de leur sorte**
  (`exp-question`, `exp-source`, `exp-campement`, `exp-gardien`) : une
  règle CSS de ce nom, faite pour autre chose, les habille aussi — celle du
  paragraphe d'une source rendait ses escales carrées et décalées
  (`exp-source-regle`). Un style d'escale s'écrit `.exp-escale.exp-<sorte>`.
- **Les jokers ne sortent jamais de l'expédition** (invariant 8) : ni
  soirée, ni quiz du jour, ni défi, ni duel. Un Divin n'en a aucun
  (invariant 21).
- **Le QG ne la lit pas encore à part** : sa page de la campagne ignore le
  mode (`sousModeDe` le rend nul), la vue d'ensemble et « L'activité » la
  comptent en campagne (`modeDeLaSerie`). « L'activité » compte ses
  réponses, pas sa `position` (`seriesDepuis`) : la position saute les
  questions de reste d'un gardien vaincu, tirées d'avance et jamais posées —
  six de trop pour une expédition sans faute. Une lecture neuve de ses
  questions jouées fait de même.
