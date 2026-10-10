---
paths:
  - "shared/{jour,calendrier}.ts"
  - "server/src/core/jour.ts"
  - "server/src/quizDuJour.ts"
  - "client/src/views/JourApp.tsx"
  - "client/src/{insister,focus}.ts"
  - "client/src/components/{Jour,Calendrier,Laurier}.tsx"
  - "client/src/components/calendrier-peint.ts"
  - "server/test/{jour,jour-charge,jour-justesse,jour-mois,jour-nuit,jour-paliers,jour-partie,jour-telephone,calendrier,laurier,soiree-et-jour}.test.ts"
---

# Le quiz du jour

## Les fichiers

- `shared/jour.ts` · `core/jour.ts` · `server/src/quizDuJour.ts` · `client/src/views/JourApp.tsx` — le quiz du jour, pour les profils : dix questions tirées à minuit (Paris) et figées, une partie chronométrée au serveur, dans la base permanente ; l'expérience (200 au plus, podium 75/45/30, et le bonus de série — `xpDeSerie`, `jour_parties.xp_serie`, payé dès la partie commencée) dans la ligne `#jour` ; la nuit qui clôt la veille à la première demande (`clorePasses`) ; ses trois paliers (L'Assidu, Le Champion du jour, Le Sans-Faute), décernés dès la partie commencée (L'Assidu, la saison : une partie commencée compte), à sa fin (Le Sans-Faute) ou à la nuit (la victoire) (`accorderPaliersDuJour`) et rangés sous le jour (`cleDuJour`), jamais sous une soirée ; le laurier des vainqueurs d'hier (`laureats`), qui suit leur prénom jusque dans les soirées (`Distinctions.laurier`, `components/Laurier.tsx`) et grandit avec leurs victoires (`niveauDuLaurier` : vert, d'or, serti, étoilé) — l'argent du défi de la semaine se porte au même endroit (`LaurierPorte`), celui d'hier passant devant ; les hauts faits du jour (le Lève-tôt à la fin de la partie, le reste à la nuit — `decernerLaNuit` —, rangés sous le jour, annoncés le lendemain, payés dans la ligne des paliers — `xpHorsDesSoirees`), l'Éclat — une chance sur quarante à chaque partie finie (`CHANCE_ECLAT_DU_JOUR`, `ProfileStore.tirerUnEclat`), tiré dans `enregistrer`, jamais dans `decernerALaFin`, que la relecture des jours rejoue, rangé sous le jour avec les paliers de La Pluie d'Éclats qu'il fait tomber et relu par la fin de la partie —, le mois qui se clôt à son tour (`cloreLesMois`, `jour_meta`) — son champion (un titre daté, `mois:2026-10`, sa marque tout le mois suivant, `champions`, que l'écran commun salue, `EntreeEnScene`), le Mois complet —, la page du calendrier des Heures à vingt jours joués, les sabliers de la série (`profile_sabliers`, `serieAvecSabliers` — dans la pastille de la série, en haut de la page à côté de la cloche, `SerieDuJour`, qui ouvre leur feuille ; achetés à la boutique, un ou deux d'un coup) et Chronos (`core/divins.ts`) ; tout cela relu une fois sur les jours d'avant, sous sa version (`relireLesJours`, `VERSION_DES_JOURS`) ; la réserve, ses signalements et les profils masqués, à `/admin`. La page s'ouvre sur le profil léger (`/api/joueur/moi?leger` : prénom, niveau, thème — la campagne aussi), sa partie demandée en même temps : le détail coûtait huit allers-retours à la base. Au téléphone, sans liaison temps réel, la page redemande ce que le serveur décide seul jusqu'à l'avoir (`client/src/insister.ts`), et chaque écran commence en haut, rend le focus perdu (`client/src/focus.ts`) et n'accepte aucun toucher dans sa première demi-seconde (`gesteAccepte`) ; « ← Retour », en tête du classement ou de la correction comme en bas, ramène d'où l'on vient (`retourDuJour`) — l'écran qui les a ouverts, marqué dans l'historique (jamais par `location.hash =`), ou la page qui a ouvert `/jour` ; chaque période du classement a son adresse (`#classement-mois`), réécrite sur la même entrée
- `shared/calendrier.ts` · `client/src/components/Calendrier.tsx` · `calendrier-peint.ts` — le calendrier des Heures du quiz du jour : douze enluminures, une par mois ; vingt jours joués dans un mois ouvrent sa page (`JOURS_POUR_UNE_PAGE`, rangée `heures:<mois>` sous le mois, hors du compte des badges), le champion du mois la reçoit dorée — la dorure se lit sur ses titres de champion (`pagesDorees`) —, les douze ouvrent le thème des Très Riches Heures ; `calendrier-peint.ts` est écrit par `decors.ts --livrer`, jamais à la main

## Les pièges

- **Le quiz du jour a son horloge** (`horlogeDuJour`, `JourStore.maintenant`) :
  les tests la font passer minuit (`jour-partie.test.ts`). Sa ligne
  d'expérience (`LIGNE_JOUR`, `#jour`) compte dans le total et le niveau
  mais pas dans l'historique : tout ce qui lit `profile_xp` comme des
  soirées écarte les lignes à part (`#paliers`, `#jour`, `#campagne`,
  `#rattrapage` — `HORS_LIGNES_A_PART`, `auth/profiles.ts`) — la série du jour les écarte
  aussi. Une ligne de plus rejoint `LIGNES_A_PART`, et `remettreAuBareme`
  la remet à la version du jour sans la relire comme une soirée. Rien ne tourne à minuit : une clôture passe par
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
