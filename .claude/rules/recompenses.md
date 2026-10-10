---
paths:
  - "server/src/core/{hautsfaits,recalcul,divins,saisons}.ts"
  - "shared/{hautsfaits,legendaires,divins,saisons,badges,ecussons}.ts"
  - "server/src/auth/profiles.ts"
  - "server/scripts/calibrage.ts"
  - "client/src/components/{Ecusson,Trophees,Trophies,Carriere,CarriereAtlas,Niveau,BarreDeNiveau}.tsx"
  - "server/test/{hautsfaits,legendaires,divins,eclat,eclat-hors-soiree,experience,niveaux,recalcul,saisons,saisons-relues,sphinx,ecussons,bareme,recompenses-montrees}.test.ts"
---

# L'expérience, les hauts faits, les légendaires, les Divins, le recalcul

## Les fichiers

- `core/hautsfaits.ts` — les hauts faits d'une soirée, invité par invité — dérivation pure, jouée à la clôture et sur les archives
- `core/recalcul.ts` — au démarrage, relit l'historique au barème du jour (`VERSION_BAREME`) : expérience, prix, hauts faits, paliers
- `shared/hautsfaits.ts` `shared/legendaires.ts` — le catalogue des hauts faits (soirée, carrière en trois paliers — ceux du quiz du jour, `duJour`, et de la campagne, `deCampagne`, que la clôture d'une soirée ne décerne pas ; et ceux qui se regagnent hors des soirées, `HAUTS_FAITS_DU_JOUR` et `HAUTS_FAITS_DE_CAMPAGNE`, sans expérience, rangés sous leur jour, leur série ou leur semaine) et les avatars légendaires qui s'en débloquent — sur la durée : une vingtaine de quiz au premier qui en décroche un ; le Sphinx, treizième, au quiz du jour, par l'une de ses deux voies (`aussi`), et trois de saison (`saison`) ; puis dix du quiz du jour et de la campagne (l'Aigle, l'Ouroboros, le Scarabée, le Coq, la Chauve-souris, la Salamandre, l'Éléphant, le Serpent, et la Chimère et Janus, qui demandent tout un ensemble — `toutes`), et neuf légendaires des soirées qu'un haut fait du jour ouvre aussi (`aussi`, `voiesDe` : la page montre la voie la plus avancée) — un légendaire de plus ne reprend rien à personne : ce qu'il change aux Divins se lit dans `core/divins.ts`, et nulle part ailleurs (invariant 21) ; et la rareté mesurée de chaque haut fait (`PART_DES_JOUEURS`), qui choisit les trois plus beaux de la carte (`plusBeaux`)
- `shared/saisons.ts` · `core/saisons.ts` — les saisons (Halloween, Noël, le Nouvel An, à la date de Paris — `periodeDu`) et leur légendaire : quelques jours de quiz du jour dans la période (`JourStore.accorderSaison`), ou une soirée qui compte ces jours-là, datée à sa première question (`laureatsDeSaison`, à la clôture comme au recalcul) ; rangées `saison:…`, hors de l'étagère et du compte des badges
- `shared/ecussons.ts` · `client/src/components/Ecusson.tsx` — les écussons de savoir : les bonnes réponses d'une catégorie dans tous les modes de jeu — soirées (`Carriere.categories`), quiz du jour (`JourStore.savoirDe`), campagne : séries, épreuves des sentiers, défis (`CampagneStore.savoirDe`, la catégorie que la série a gardée de sa question) —, au bronze, à l'argent, à l'or (`SEUILS_ECUSSON`) — dérivation pure, sans expérience ; ce que chaque mode sait (`Savoir` : ses catégories, et la base de sa précision — ses QCM répondus, classés ou non), lu en une requête par mode (`savoirDesLignes`), et la part hors des soirées d'un coup (`ProfileStore.savoirHorsSoirees`) par la page du profil et par la carte ; « Ma carrière » par catégorie (`additionnerCategories`, `PublicProfileDetail.categories`) et la précision de la fiche (`ficheDe(carriere, ailleurs)` — le réflexe et le flair gardent la base des soirées) font la même addition ; les trois plus hauts sur la carte (`plusBeauxEcussons`), les douze sur la page du profil
- `shared/divins.ts` · `core/divins.ts` — les six Divins — Chronos, le sixième, descend au quiz du jour : le nom, public ; les règles et les légendes, **secrètes**, côté serveur seulement
- `server/scripts/calibrage.ts` — combien de quiz demande chaque légendaire, combien de soirées chaque niveau, et la rareté de chaque haut fait (que `PART_DES_JOUEURS` recopie) : des bandes d'amis inventées jouent des soirées entières sur le vrai code des hauts faits et de l'expérience (`npx tsx scripts/calibrage.ts`, format réglable)

## Les pièges

- **Un haut fait ou un prix de plus a sa place ailleurs.** Un haut fait
  prend sa rareté dans `PART_DES_JOUEURS` (mesurée par `calibrage.ts`) :
  sans elle, il passerait pour le plus courant de tous et ne paraîtrait
  jamais sur une carte (`hautsfaits.test.ts` la réclame). Un prix qu'une
  personne peut remporter rejoint `PRIX_INDIVIDUELS` (`core/stats.ts`) :
  sans lui, la collection mentirait (« 14 sur 20 ») — `fin-de-soiree.test.ts`
  relit les clés du calcul.

## L'invariant 19, en entier

19. **L'expérience se mérite, et ne redescend jamais en cours de soirée.**
    En soirée, rien pour la présence, rien seul : tout se gagne dès deux
    joueurs, un podium de quiz à cinq questions, celui de la soirée à quinze
    (`SEUILS`), et un podium a toujours une marche de moins que la salle — le
    quiz du jour, lui, se joue seul, et son expérience s'arrête à 200, plus
    son bonus de série.
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
    souvenir : quand le barème ou un haut fait change, incrémente
    `VERSION_BAREME` — au démarrage, `recalculerHistorique` relit toutes les
    soirées de l'historique avec les règles du jour, et remet à la version
    du jour les lignes qu'il ne sait pas relire (la soirée en cours, les
    paliers) : sinon il relirait tout à chaque démarrage. `decodeDetail`
    reconnaît le format à `v ≥ 2`, jamais à la version du jour. Une version
    s'écrit en entier (`CAST(? AS INTEGER)` dans un `json_set`) : liée en
    flottant, `{"v":6.0,…}` n'était jamais « du jour », et tout l'historique
    se relisait à chaque réveil. Et une base qui hoquette pendant la
    relecture fait échouer le démarrage — l'hébergeur le relance — au lieu
    de passer une archive pour illisible et d'en remettre les lignes au
    barème sans les avoir relues.

## L'invariant 22, en entier

22. **Durcir un légendaire, la courbe des niveaux ou les seuils des
    branches ne reprend rien à personne.** Les légendaires et les niveaux se dérivent à chaque lecture :
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
