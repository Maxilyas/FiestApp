---
paths:
  - "server/src/core/{hautsfaits,recalcul,divins,saisons,progress}.ts"
  - "shared/{hautsfaits,legendaires,divins,saisons,badges,ecussons,profil,pistes,gains}.ts"
  - "server/src/auth/profiles.ts"
  - "server/scripts/calibrage.ts"
  - "client/src/components/{Ecusson,Trophees,Trophies,Carriere,CarriereAtlas,Niveau,Gains,Etoiles}.tsx"
  - "server/test/{hautsfaits,legendaires,divins,eclat,eclat-hors-soiree,experience,niveaux,recalcul,saisons,saisons-relues,sphinx,ecussons,bareme,recompenses-montrees,gains}.test.ts"
---

# L'expérience, les hauts faits, les légendaires, les Divins, le recalcul

## Les fichiers

- `core/hautsfaits.ts` — les hauts faits d'une soirée, invité par invité — dérivation pure, jouée à la clôture et sur les archives
- `core/recalcul.ts` — au démarrage, relit l'historique au barème du jour (`VERSION_BAREME`) : expérience, prix, hauts faits, Divins, saisons, paliers
- `shared/hautsfaits.ts` `shared/legendaires.ts` — le catalogue des hauts faits (soirée, carrière en trois paliers — ceux du quiz du jour, `duJour`, et de la campagne, `deCampagne` — ceux des sentiers aussi, `surLesSentiers` —, que la clôture d'une soirée ne décerne pas ; et ceux qui se regagnent hors des soirées, `HAUTS_FAITS_DU_JOUR`, `HAUTS_FAITS_DE_CAMPAGNE` et `HAUTS_FAITS_DES_SENTIERS`, payés depuis le 6 octobre 2026 dans la ligne des paliers (`xpHorsDesSoirees`), rangés sous leur jour, leur série, leur épreuve ou leur semaine ; où se gagne chacun, une seule règle : `origineDe`, que lisent la page de l'album, les lieux des avatars et du style, et la page du profil) et les avatars légendaires qui s'en débloquent — sur la durée : une vingtaine de quiz au premier qui en décroche un ; le Sphinx, treizième, au quiz du jour, par l'une de ses deux voies (`aussi`), et trois de saison (`saison`) ; puis dix du quiz du jour et de la campagne (l'Aigle, l'Ouroboros, le Scarabée, le Coq, la Chauve-souris, la Salamandre, l'Éléphant, le Serpent, et la Chimère et Janus, qui demandent tout un ensemble — `toutes`), et neuf légendaires des soirées qu'un haut fait du jour ouvre aussi (`aussi`, `voiesDe` : la page montre la voie la plus avancée) ; et depuis le 17 octobre 2026, ceux qui ont leur joker se gagnent aussi en les gardant au bout de l'expédition — vingt d'abord, vingt-trois depuis le 18 octobre 2026 : les trois de saison y gardent l'acte 3 à leur saison seulement (`avecLExpedition`, `voiesMontrees` : cachée quand elle est fermée en production — elle est ouverte depuis ses jokers — ou remplacée par le Cabinet, `EXPEDITION_REMPLACEE` ; règle `expedition.md`) — ; et depuis le 25 octobre 2026, vingt d'entre eux en réveillant leur gardien au Cabinet de curiosités (`avecLeCabinet`, `LEGENDAIRES_DU_CABINET`, la ligne `cabinet:<clé>` rangée sous `#cabinet`, `RANGEMENT_DU_CABINET` — règle `cabinet.md`), tue dans l'album tant qu'il est fermé en production (`voiesMontrees`) — un légendaire ou une voie de plus ne reprend rien à personne ; ce qui touche aux Divins se lit dans `core/divins.ts`, et nulle part ailleurs (invariant 21) ; et la rareté mesurée de chaque haut fait (`PART_DES_JOUEURS`), qui choisit les trois plus beaux de la carte (`plusBeaux`)
- `shared/saisons.ts` · `core/saisons.ts` — les saisons (Halloween, Noël, le Nouvel An, à la date de Paris — `periodeDu`) et leur légendaire : quelques jours de quiz du jour dans la période (`JourStore.accorderSaison`), ou une soirée qui compte ces jours-là, datée à sa première question (`laureatsDeSaison`, à la clôture comme au recalcul) ; rangées `saison:…`, hors de l'étagère et du compte des badges — et depuis le 18 octobre 2026, une expédition partie ces jours-là, qui le fait garder l'acte 3 : gardé au bout, il tombe par sa voie d'expédition, pas par un `saison:…` (`calendrierDesExpeditions`, règle `expedition.md`) ; et depuis le 25 octobre 2026, la première œuvre gagnée en jouant au Cabinet de curiosités pendant la fête, qui range la saison même sous `#cabinet` (`calendrierDuCabinet`, au jour du départ de la partie ; ni un achat, ni une dorure, ni une œuvre de départ)
- `shared/ecussons.ts` · `client/src/components/Ecusson.tsx` — les écussons de savoir : les bonnes réponses d'une catégorie dans tous les modes de jeu — soirées (`Carriere.categories`), quiz du jour (`JourStore.savoirDe`), campagne : tous ses modes sauf les révisions du carnet — séries, épreuves, parcours, défis, duels (`CampagneStore.savoirDe`, la catégorie que la série a gardée de sa question) —, au bronze, à l'argent, à l'or (`SEUILS_ECUSSON`) — dérivation pure, sans expérience ; ce que chaque mode sait (`Savoir` : ses catégories, et la base de sa précision — ses QCM répondus, classés ou non), lu en une requête par mode (`savoirDesLignes`), et la part hors des soirées d'un coup (`ProfileStore.savoirHorsSoirees`) par la page du profil et par la carte ; « Ma carrière » par catégorie (`additionnerCategories`, `PublicProfileDetail.categories`) et la précision de la fiche (`ficheDe(carriere, ailleurs)` — le réflexe et le flair gardent la base des soirées) font la même addition ; les trois plus hauts sur la carte (`plusBeauxEcussons`), les douze sur la page du profil
- `shared/divins.ts` · `core/divins.ts` — les six Divins — Chronos, le sixième, descend au quiz du jour : le nom, public ; les règles et les légendes, **secrètes**, côté serveur seulement
- `server/scripts/calibrage.ts` — combien de quiz demande chaque légendaire, combien de soirées chaque niveau, et la rareté de chaque haut fait (que `PART_DES_JOUEURS` recopie) : des bandes d'amis inventées jouent des soirées entières sur le vrai code des hauts faits et de l'expérience (`npx tsx scripts/calibrage.ts`, format réglable) — les soirées seulement : ce qui se gagne au quiz du jour, en campagne ou à sa saison n'y est pas simulé, et sa part dans `PART_DES_JOUEURS` est estimée
- `shared/pistes.ts` — les pistes : un trophée de carrière, ses trois métaux, et ce que chaque étape ouvre en chemin — laurier, gerbe, fond, thème, légendaire (`etapesDeLaPiste`, `ceQuIlOuvre`, `ditLaRecompense`) ; les maîtres des sentiers et les pages du calendrier ont la leur (`PisteAPart`). Une dérivation des règles qui ouvrent chaque chose — les gerbes, les thèmes et les légendaires disent les leurs ; les fonds n'ont qu'une fonction, leur étape est écrite ici (`ETAPES_DES_FONDS`), et `trophees.test.ts` la vérifie contre `fondsOuverts`. Une victoire au quiz du jour faisait tomber Le Laurier et un palier du Champion du jour, aux mêmes seuils sous deux noms : la piste l'absorbe (`ABSORBES`), une seule ligne partout. Rien n'y change au barème : on montre autrement ce qui existe (l'album : règle `profil.md`)
- `shared/gains.ts` · `client/src/components/Gains.tsx` — l'écran des gains, le même à la fin de chaque mode (l'écran A choisi par le propriétaire le 13 octobre 2026) — la soirée (`FinDeSoiree`, règle `cloture-et-archives.md`), le quiz du jour, la série, la révision, le défi, le duel, l'épreuve d'un sentier, l'étape d'un parcours, l'expédition (`FinDeLExpedition`) : « Ce que tu gagnes » (`CeQueTuGagnes`) — l'expérience en un total, ses parts quand il y en a plusieurs (`partsDeLXp` : « ta partie +124 · ta série de 7 jours +70 · tes trophées +175 » ; jamais un « +0 »), les confettis, le niveau, relu après la partie (`useNiveauRelu`, la barre seulement quand le serveur dit où il en est) et comparé à celui que la page a retenu en lisant le profil (`retenirLeNiveau`, `client/src/niveauVu.ts`, hors de l'écran des gains : le musée du Cabinet le retient sans le télécharger ; une page qui l'oublie tait la montée de sa première fin), sa nouvelle finition —, « Nouveaux trophées » (`NouveauxTrophees`, `tropheesTombes`) — trois au plus (`TROPHEES_MONTRES`), les exploits avant les coups du sort, les plus rares d'abord, les métaux d'une piste fondus (« L'Alpiniste · Bronze → Or »), chacun menant à sa page de l'album —, et « À porter » (`APorter`, `aPorterDesTrophees`, `emojisAPorter`) : ce que ses paliers ouvrent et les emojis de collection d'un niveau gagné, chacun son « Essayer », qui ouvre la loge avec l'objet essayé (`/profil?essayer=<clé>#<pièce>`, `essaiDemande`, `shared/loge.ts` : rien qu'il n'ait). Seul un palier dit à coup sûr ce qu'il ouvre — un exploit qui se regagne ouvre à un compte que la fin ne connaît pas. Les duels gardent leur carte du verdict : « Ce que tu gagnes » n'y paraît qu'à un niveau gagné (`GainsDeCampagne` `duel`, règle `duels.md`) ; la fin de chaque quiz d'une soirée, son expérience seule (invariant 10). `gains.test.ts` rend chaque fin et vérifie qu'elle passe par ces pièces

## Les pièges

- **Les mots des récompenses sont fixés, partout** (le 13 octobre 2026, avec
  l'album et l'écran des gains) : un **trophée**, tout ce qui se gagne par
  un exploit — hauts faits, paliers, prix, maîtres, ligues ; **Bronze ·
  Argent · Or**, les étapes d'une piste, et rien d'autre ; **★ ★★ ★★★**, la
  note d'une partie — le quiz du jour (`ETOILES_DE_LA_MEDAILLE`,
  `NOM_DE_LA_NOTE`, `phraseDesEtoiles` ; sa « médaille d'or » se lisait
  comme un palier d'or), les sentiers, les parcours (`Etoiles.tsx`) ; un
  **palier**, à l'écran, l'étape d'un sentier — le code garde `palierDe` et
  `clePalier` pour les métaux d'une piste. Une « médaille » ou un « badge »
  de plus rendrait l'écran confus que ce lexique a remplacé.
- **Un haut fait ou un prix de plus a sa place ailleurs.** Un haut fait
  prend sa rareté dans `PART_DES_JOUEURS` (mesurée par `calibrage.ts`) :
  sans elle, il passerait pour le plus courant de tous et ne paraîtrait
  jamais sur une carte (`hautsfaits.test.ts` la réclame). Un prix qu'une
  personne peut remporter rejoint `PRIX_INDIVIDUELS` (`core/stats.ts`) :
  sans lui, la collection mentirait (« 14 sur 20 ») — `fin-de-soiree.test.ts`
  relit les clés du calcul.
- **Un Éclat tombé sur un avatar déjà éclaté attend en réserve** (le 20 octobre
  2026) : une ligne de `profile_eclats` sous `reserve:<uuid>`
  (`PREFIXE_DE_LA_RESERVE`), tenue à part des Éclats éclatés
  (`ProfileStore.reserves`, `reserveOf`) — `eclats` ne compte, ne montre et ne
  fait briller que ce qui a éclaté, et `eclatsHors` écarte la réserve : elle
  ne compte pour La Pluie d'Éclats qu'une fois dépensée. Tout tirage passe par
  `donnerUnEclat` (la soirée comme `tirerUnEclat`), jamais par `grantEclat`
  seul, qui rend faux et perdait l'Éclat. La dépense (`PUT /api/joueur/moi`
  `eclatDeReserve`, `depenserUnEclat`) prend la mémoire avant la base, d'un
  seul tenant, et remplace la clé par l'avatar : la ligne garde sa soirée, un
  essai effacé la reprend. Définitive, donc jamais un essai de la loge ; ni
  Divin, ni avatar qu'il n'a pas (`eclat-reserve.test.ts`). Un champ qui lit
  `profile_eclats` ligne à ligne doit écarter `estEnReserve`.
- **Une voie rangée n'est pas un trophée, et se filtre par une seule liste**
  (`PREFIXES_DES_VOIES_RANGEES` — `saison:`, `expedition:`, `cabinet:` —,
  `estUneVoieRangee`, `sqlHorsDesVoiesRangees`, le 25 octobre 2026) :
  l'étagère, le compte des badges, les pistes et « le plus proche » la
  lisent. Chacun recopiait `saison:` et `expedition:` : la voie du Cabinet
  oubliée d'un seul, sa ligne serait passée pour un trophée à l'étagère, ou
  pour une piste à ouvrir. Sa tenue se lit des légendaires qu'il a, jamais
  des hauts faits que la page reçoit, qui ne la portent pas (`shared/album.ts`).
  Un préfixe de plus s'y ajoute, avec son étiquette (`etiquetteDe`) et son
  lieu dans l'album (`lieuDuHautFait`, `shared/album.ts`) : oubliée là, la
  voie du Cabinet se disait « En soirée : « cabinet:phenix » ». L'album dit ce
  que le Cabinet demande, sans jauge — il ne reçoit pas le musée —, d'après
  ses salles (`ceQueDemandeLeCabinet` : « Au Cabinet : compléter la salle du
  Rempart », « dorer… », le Vestibule et ses œuvres offertes à l'arrivée ; la
  série et le musée entier dans les mots du Cabinet, `conditionDuGardien`) ;
  un gardien de saison n'y a pas de voie, sa règle dit l'œuvre gagnée à sa fête.
- **Un trophée réservé à certains serveurs se tait aux deux bouts**
  (`montreParLeServeur` — L'Explorateur, le 19 octobre 2026, là où les
  rencontres de l'expédition s'ouvrent) : ce qu'il compte vaut 0 ailleurs,
  il n'y tombe donc pas ; `hautsFaitsVus` ne le cite pas ; l'album ne lui
  fait de case que cité (`albumDesTrophees`), sans quoi chaque collection
  de la production le compterait « 0 sur 3 ». Un drapeau du code
  (`voiesMontrees`) ne suffit pas quand la préproduction doit le montrer :
  elle sert le même code — c'est le serveur qui sait (`rencontresOuvertes`,
  posé au démarrage sur `ProfileStore.rencontres` et `CampagneStore`).
- **Durcir la règle d'un haut fait de soirée, d'un prix ou d'un Divin, puis
  monter `VERSION_BAREME`, reprend le passé** : le recalcul remplace les
  lignes de chaque soirée (`remplacerRecompensesDeSoiree`), et ce que la
  règle neuve ne donne plus tombe — le titre, la vitrine et le légendaire
  qui en dépendaient avec. `DURCISSEMENTS` ne garde que la règle d'un
  légendaire : retiens d'abord ce que chacun avait. Les paliers, eux, ne se
  reprennent qu'avec leur soirée.
- **Une source d'expérience de plus doit faire juger La Légende**
  (`paliersDuNiveau`) : la clôture d'une soirée et le quiz du jour
  (`accorderPaliersDuJour`) le font, la campagne non — qui n'y joue
  qu'elle passe le niveau 10 sans son palier jusqu'à sa prochaine partie du
  jour ou soirée close.

## L'invariant 19, en entier

19. **L'expérience se mérite, et ne redescend jamais en cours de soirée.**
    En soirée, rien pour la présence, rien seul : tout se gagne dès deux
    joueurs, un podium de quiz à cinq questions, celui de la soirée à quinze
    (`SEUILS`), et un podium a toujours une marche de moins que la salle — le
    quiz du jour, lui, se joue seul, et sa partie s'arrête à 200, plus son
    bonus de série, son podium et ses hauts faits.
    L'animateur qui joue chez lui gagne comme tout le monde. Les hauts faits
    gardent leur salle de quatre (`salleHautsFaits`). Les gains d'un quiz sont
    définitifs : ce qui peut se renverser d'un quiz à l'autre attend la
    clôture. Une soirée jouée seul reste dans l'historique mais ne compte
    pas (`soireeQuiCompte`) : ni tirage de l'Éclat, ni rien de la carrière
    — écussons, fiche, paliers (`carriereDe`) —, ni soirée pour L'Habitué
    — dix « soirées » d'une question faisaient le Renard Lunaire. **Un prix
    ne rapporte jamais d'expérience** : ni ceux du palmarès (une ligne
    d'étagère, rien de plus), ni ceux remis à l'écran, prix libres compris
    (des points d'équipe, jamais le score d'un joueur) — l'un se juge sur
    une seule soirée, l'autre se donne à la main.

## L'invariant 20, en entier

20. **Les récompenses sont des dérivations des journaux**, comme le
    souvenir : quand le barème ou un haut fait de soirée change, incrémente
    `VERSION_BAREME` (ceux du quiz du jour, de la campagne et des sentiers se
    relisent sous `VERSION_DES_JOURS`, `VERSION_DES_SERIES` et
    `VERSION_DES_EPREUVES`) — au démarrage, `recalculerHistorique` relit toutes les
    soirées de l'historique avec les règles du jour, et remet à la version
    du jour les lignes qu'il ne sait pas relire (la soirée en cours, les
    paliers, le quiz du jour, la campagne, le rattrapage) : sinon il
    relirait tout à chaque démarrage. `decodeDetail`
    reconnaît le format à `v ≥ 2`, jamais à la version du jour. Une version
    s'écrit en entier (`CAST(? AS INTEGER)` dans un `json_set`) : liée en
    flottant, `{"v":6.0,…}` n'était jamais « du jour », et tout l'historique
    se relisait à chaque réveil. Et une base qui hoquette pendant la
    relecture fait échouer le démarrage — l'hébergeur le relance — au lieu
    de passer une archive pour illisible et d'en remettre les lignes au
    barème sans les avoir relues.

## L'invariant 22, en entier

22. **Durcir un légendaire, la courbe des niveaux ou le palier d'un
    portrait ne reprend rien à personne.** Les légendaires et les niveaux se dérivent à chaque lecture :
    relever un seuil suffisait à reprendre le légendaire qu'on portait, et
    ce qui en dépendait, et durcir la courbe à faire redescendre de niveau,
    finitions comprises. Une règle qui se durcit ajoute donc une entrée —
    à `DURCISSEMENTS` pour un légendaire, à `COURBES_D_AVANT` pour la courbe
    (`auth/profiles.ts`), avec un drapeau neuf dans `meta` — et n'en modifie
    jamais une : au démarrage, chaque profil retient ce qu'il avait
    (`profile_legendaires`, `profile_niveaux`), et le garde tant que la
    règle d'alors le lui donne. Une soirée retirée de l'historique emporte
    donc encore ce qu'elle avait fait tomber. Les portraits des branches se
    dérivent des paliers des sentiers (`PALIER_DU_PORTRAIT`) : monter le
    palier d'un portrait, ou durcir le seuil d'un palier qui donne un
    portrait, demande d'abord de retenir ce que chacun avait, comme
    `profile_legendaires` — et un palier validé, lui, ne se perd jamais. Et **tout
    niveau d'un profil passe par `niveauDuProfil`** (`ProfileStore.niveauOf`, `gardesOf`) : un
    seul `niveauPour(profil.xp)` oublié, et le mur afficherait un autre
    niveau que sa page.
