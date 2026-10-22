---
paths:
  - "shared/{jour,calendrier}.ts"
  - "server/src/core/jour.ts"
  - "server/src/quizDuJour.ts"
  - "client/src/views/JourApp.tsx"
  - "client/src/{insister,focus}.ts"
  - "client/src/components/{Jour,Calendrier,Laurier,Corrige,SerieCorrigee}.tsx"
  - "client/src/components/calendrier-peint.ts"
  - "server/test/{coffre-du-mois,jour,jour-charge,jour-justesse,jour-mois,jour-nuit,jour-paliers,jour-partie,jour-telephone,laurier,soiree-et-jour,corrige}.test.ts"
  - "server/scripts/rendu-jour.ts"
---

# Le quiz du jour

## Les fichiers

- `shared/jour.ts` · `core/jour.ts` · `server/src/quizDuJour.ts` · `client/src/views/JourApp.tsx` — le quiz du jour, pour les profils : dix questions tirées à minuit (Paris) et figées, une partie chronométrée au serveur, dans la base permanente ; l'expérience (200 au plus, podium 75/45/30, et le bonus de série — `xpDeSerie`, `jour_parties.xp_serie`, payé dès la partie commencée) dans la ligne `#jour` ; la nuit qui clôt la veille à la première demande (`clorePasses`) ; ses paliers (L'Assidu, Le Champion du jour, Le Sans-Faute, L'Élite, L'Infatigable), décernés dès la partie commencée (L'Assidu, L'Infatigable, la saison : une partie commencée compte), à sa fin (Le Sans-Faute) ou à la nuit (la victoire, le premier quart) (`accorderPaliersDuJour`) et rangés sous le jour (`cleDuJour`), jamais sous une soirée ; le laurier des vainqueurs d'hier (`laureats`), qui suit leur prénom jusque dans les soirées (`Distinctions.laurier`, `components/Laurier.tsx`) et grandit avec leurs victoires (`niveauDuLaurier` : vert, d'or, serti, étoilé) — l'argent du défi de la semaine se porte au même endroit (`LaurierPorte`), celui d'hier passant devant ; les hauts faits du jour (le Lève-tôt à la fin de la partie, le Dernier Métro à son début, le reste à la nuit — `decernerLaNuit` —, rangés sous le jour, annoncés le lendemain, payés dans la ligne des paliers — `xpHorsDesSoirees`), l'Éclat — une chance sur quarante à chaque partie finie (`CHANCE_ECLAT_DU_JOUR`, `ProfileStore.tirerUnEclat`), tiré dans `enregistrer`, jamais dans `decernerALaFin`, que la relecture des jours rejoue, rangé sous le jour avec les paliers de La Pluie d'Éclats qu'il fait tomber et relu par la fin de la partie —, le mois qui se clôt à son tour (`cloreLesMois`, `jour_meta`) — son coffre à chaque joueur classé (`poserLesCoffresDuMois`, `jour_coffres_du_mois` : règle `missions.md`), son champion (un titre daté, `mois:2026-10`, sa marque tout le mois suivant, `champions`, que l'écran commun salue, `EntreeEnScene`), le Mois complet —, la page du calendrier des Heures à vingt jours joués, les sabliers de la série (`profile_sabliers`, `serieAvecSabliers` — dans la pastille de la série, en haut de la page à côté de la cloche, `SerieDuJour`, qui ouvre leur feuille ; achetés à la boutique, un ou deux d'un coup) et Chronos (`core/divins.ts`) ; tout cela relu une fois sur les jours d'avant, sous sa version (`relireLesJours`, `VERSION_DES_JOURS`) ; la réserve et les profils masqués, à `/admin#jour` — avec ce que le QG en suit : le tirage question par question, le classement du mois, les séries en cours, le rappel du soir (`suiviDAujourdhui`, `seriesEnCours`, règle `qg.md`) ; ses signalements, à `/admin#signalements`, avec ceux de la campagne : les corriger — le jour qui l'a posée aussi quand la bonne réponse ne change pas (`corrigeAussiLeJour`) —, les reclasser, annuler leurs points pour tous, les retirer, les garder (`JourStore.corriger`, `reclasser`, `refermer`, règle `qg.md`). Une partie se note en étoiles — une, deux, trois au sans-faute (`ETOILES_DE_LA_MEDAILLE`, `NOM_DE_LA_NOTE`, `phraseDesEtoiles`, `NoteDuJour`) : sa « médaille d'or » se lisait comme un palier d'or (les mots : règle `recompenses.md`) ; sa fin passe par l'écran des gains de tous les modes, et le lendemain dit en lignes de trophées ce que la nuit a décerné. La page s'ouvre sur le profil léger (`/api/joueur/moi?leger` : prénom, niveau, thème — la campagne aussi), sa partie demandée en même temps : le détail coûtait huit allers-retours à la base. Au téléphone, sans liaison temps réel, la page redemande ce que le serveur décide seul jusqu'à l'avoir (`client/src/insister.ts`), et chaque écran commence en haut, rend le focus perdu (`client/src/focus.ts`) et n'accepte aucun toucher dans sa première demi-seconde (`gesteAccepte`) ; « ← Retour », en tête du classement ou de la correction comme en bas, ramène d'où l'on vient (`retourDuJour`) — l'écran qui les a ouverts, marqué dans l'historique (jamais par `location.hash =`), ou la page qui a ouvert `/jour` ; chaque période du classement a son adresse (`#classement-mois`), réécrite sur la même entrée
- `client/src/components/Corrige.tsx` · `SerieCorrigee.tsx` — le corrigé d'une question, le même partout où l'on relit ses réponses — la correction du jour, et en campagne la série, le défi, le duel, les sentiers, les parcours : la marque du verdict (`verdictDe`), l'intitulé, puis la bonne réponse centrée dans son cadre d'or, sa légende (« La bonne réponse », « · la tienne » quand c'était la sienne), et la sienne fausse dessous, barrée dans un pointillé d'alerte (« Ta réponse ») — la coche, la croix, le plein et le pointillé pour qui distingue mal les couleurs. Elles se lisaient en petit sous l'intitulé, en campagne sur une seule ligne grise, et l'on prenait l'une pour l'autre (un retour utilisateur du 13 octobre 2026 : « j'aimerais que la bonne réponse soit centrée aussi »). Au quiz du jour, chaque question dit en plus ce qu'elle a rapporté, en tête, en combien de secondes la réponse est partie sur combien (`ms`, `duree` de `JourStore.correction`) et son bonus de rapidité (`rapidite`, lu dans ses points par `bonusDeRapidite`, `games/quiz.ts` : le client ne connaît pas le barème) — le même retour : « savoir le nombre de points par réponse, et si on a répondu vite ou pas » ; sans réponse, pourquoi : le temps écoulé, la sienne arrivée après la fin (`tropTard`, comme à la révélation), ou la partie arrêtée avant. La campagne, sans chrono, n'a ni points ni temps. Elle corrige par une seule liste (`SerieCorrigee`, qui seule importe `shared/campagne.ts` : `Corrige` reste léger pour la page du jour) — cinq copies vivaient dans ses pages (`corrige.test.ts`, `jour-telephone.test.ts` ; `server/scripts/rendu-jour.ts` photographie la correction du jour, `rendu-recompenses.ts` celle du défi)
- `shared/calendrier.ts` · `client/src/components/Calendrier.tsx` · `calendrier-peint.ts` — le calendrier des Heures du quiz du jour : douze enluminures, une par mois ; vingt jours joués dans un mois ouvrent sa page (`JOURS_POUR_UNE_PAGE`, rangée `heures:<mois>` sous le mois, hors du compte des badges), le champion du mois la reçoit dorée — la dorure se lit sur ses titres de champion (`pagesDorees`) —, les douze ouvrent le thème des Très Riches Heures ; `calendrier-peint.ts` est écrit par `decors.ts --livrer`, jamais à la main

## Les pièges

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
  places en retard. Son hier aussi, par profil (`sonsHier`), sous la révision de
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
