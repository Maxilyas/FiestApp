---
name: regarder-le-rendu
description: Regarder une page ou un écran de FiestApp comme le verra un invité ou la salle — au téléphone en 360 × 640, l'écran commun en 1366 × 768 et 1920 × 1080 — avec Chromium et les scripts de rendu (rendu-ecran, rendu-jour, rendu-profil, rendu-recompenses…). À utiliser après toute retouche visible, avant de dire qu'un écran est fini.
---

# Regarder le rendu

- **Regarde le rendu.** Plusieurs bugs de cette base n'étaient visibles qu'à
  l'écran, pas au typecheck. Chromium et Playwright sont disponibles. Le
  téléphone se regarde en 360 × 640 ; l'écran commun en **1366 × 768** — le
  portable qu'on branche à la télé, où rien ne défile — et en 1920 × 1080,
  avec une question à photo et des réponses longues, des équipes, sept
  invités et plus (une estimation à six réponses, l'écran de victoire), et
  une clôture à hauts faits. `server/scripts/rendu-ecran.ts` rejoue tout ça
  en une commande (client construit d'abord). Dans un script Playwright,
  `waitForFunction` prend une fonction, jamais un texte : la politique de
  sécurité des pages refuse `eval`.
- **Un iPhone a une encoche, Chromium sans écran n'en a pas** :
  `env(safe-area-inset-top)` y vaut zéro, et ce qui s'accroche en haut — la
  niche, une croix, la première ligne de chaque page — ne s'y pose pas où le
  téléphone le pose ; une page peut passer à 0 et rater à 47, ou l'inverse.
  `Emulation.setSafeAreaInsetsOverride` (CDP, `ctx.newCDPSession(page)`) la
  pose : 47 pixels en haut pour un 390 × 844, 48 pour un 414 × 896, 34 en bas
  (`rendu-niche.ts`, `ENCOCHE=47`).
- **Un téléphone a peu de mémoire graphique, Chromium sans écran toute
  celle qu'il veut** : ce qu'un téléphone ne dessine pas faute de mémoire —
  une feuille sous les couches d'un thème peint, au téléphone Android (règle
  `css.md`) — s'y dessine toujours. Pour le voir : `chromium.launch({
  headless: true, channel: 'chromium', args: ['--use-angle=swiftshader',
  '--enable-unsafe-swiftshader', '--enable-gpu-rasterization',
  '--force-gpu-mem-available-mb=64'] })`, en 412 × 915 à la densité 2,625,
  la photo une seconde après le geste — quatre secondes après, la mémoire
  s'est libérée et tout est dessiné.
- **Un doigt n'est pas une souris** : au lever du doigt, le navigateur fait
  suivre un `click`, qui tombe sur ce qui a glissé sous lui ; la souris ne
  le rejoue pas. Un geste qui change la page sous le doigt — une carte
  posée, une rangée qui se vide — se regarde dans un contexte
  `hasTouch: true`, au `tap()` plutôt qu'au `click()` : la frise effaçait
  tout ce qu'on y posait au doigt, et `rendu-frise.ts`, qui posait à la
  souris, ne l'avait pas vu (le 20 octobre 2026 ; règle `client.md`).
- **Les lancer** : depuis `server/`, `npx tsx scripts/<script>.ts
  ../export/<dossier>` — sans dossier, les photos tombent dans un dossier
  de `server/` que git n'ignore pas (`rendu-themes.ts` écrit dans
  `export/rendus`, `apercus-themes.ts` dans `client/src/themes/apercus`).
  Le serveur jetable sert `client/dist` tel qu'il est : sans
  `npm run build -w client` d'abord, on photographie l'écran d'avant la
  retouche. Playwright n'est pas une dépendance du dépôt : les scripts le
  prennent parmi les modules globaux (`npm root -g`). Ce qu'ils évaluent
  dans la page part en texte dès qu'il nomme une fonction : `tsx` y
  glisserait des `__name` que la page ne connaît pas.

## Les scripts qui photographient

- `server/scripts/rendu-ecran.ts` — le pire cas de l'écran commun, rejoué sur un serveur jetable et photographié à chaque phase en 1366 × 768, 1920 × 1080 et au téléphone — les lumières des finitions, les médaillons, les portraits, un Divin et cinq bordures de ligue autour d'eux (`MESURE=1` : ce qui ne grandit pas en 1920 ; `DEBORDE=1` : ce qui dépasse de la scène)
- `server/scripts/rendu-tele.ts` — la télé qu'on branche, de bout en bout : `/tele` et son code, le téléphone du chef qui le tape au salon et y prépare ses équipes, la salle d'attente à la télé, une question et sa révélation, le téléphone du chef qui s'en va puis revient, la télé rechargée, le serveur qui redémarre, le podium, la clôture ; son journal dit à chaque moment si la télé montre la salle ou la console, et ce qui s'y toucherait (règle `ecran-commun.md`)
- `server/scripts/rendu-recompenses.ts` — les écrans des récompenses du quiz du jour et de la campagne, photographiés sur un serveur jetable : la série — sur quoi en une ligne, et la feuille du choix, ses catégories et ses thèmes —, les records par catégorie, une fin de série qui fait tomber hauts faits, paliers et légendaire, le défi de la semaine de bout en bout — son onglet à l'accueil, à côté du quiz du jour, à relever puis relevé ; sa correction comprise, ses fautes au bout —, le laurier d'argent, la gerbe, et l'entrée en scène du champion du mois en 1366 × 768
- `server/scripts/rendu-jour.ts` — le quiz du jour et le rayon des objets de la boutique, photographiés au téléphone sur un serveur jetable, sous le thème qu'on veut (`THEME=ivoire`) : l'accueil du jour avec une série et la veille à raconter, la feuille de la série, une partie mêlée jusqu'à sa fin — justes, fausses, une laissée au temps —, le jour joué, sa correction, et la fiche de chaque objet
- `server/scripts/rendu-fetes.ts` — les fêtes, l'horloge du quiz du jour posée à Pâques 2027 : la tuile de l'accueil qui annonce le timbre, la carte de la fête au quiz du jour, la fin qui ouvre L'Œuf d'or, son timbre et sa gerbe, le carnet des fêtes — l'année en cours, puis 2026 —, la page légendaire de l'album et deux fiches, les gerbes de la collection, puis Pâques 2028, le légendaire déjà à elle ; à chaque écran, ce qui élargit la page (`THEME=ivoire` ; règle `recompenses.md`)
- `server/scripts/rendu-profil.ts` — la page du profil photographiée au téléphone sur un serveur jetable : soi-même et ses quatre boutons, sa carte entière et son avatar en grand, la loge — sa carte et ses pièces avant ses panneaux, puis entière —, sur chaque pièce, un essai de trois pièces — un thème compris, qui habille la page — porté d'un coup, la pastille d'une nouveauté, chaque ligne de « Ma collection » dépliée — l'album des avatars page par page et trois fiches, l'album des trophées page par page et trois fiches, l'album des thèmes, la fiche de l'un —, le retour de la collection à « Mon thème », et la boutique — ses compagnons aussi (les fichiers `10-…`) : leur rayon neuf puis à soi, la loge qui les porte, l'album et trois fiches, la carte et le loup des étoiles en grand, où un monde vivant mal livré montrait son carré noir
- `server/scripts/rendu-coffre-du-mois.ts` — le coffre du mois du quiz du jour, au téléphone : douze joueurs au classement d'octobre, l'horloge au 1er novembre, puis pour la 1re, la 3e, la 7e et la 12e place la ligne des missions qui s'allume, la feuille, la scène du coffre au repos et révélé (règle `missions.md`).
- `server/scripts/rendu-carte.ts` — la carte d'un joueur, une carte à collectionner, dans tous ses états : en soirée, son dos, son avatar et son compagnon en grand ; sa propre carte, sans compagnon, une débutante, un invité sans profil, Ivoire, quatre fonds sur ses deux faces, le cadre de chaque ligue, tout au plus long, l'aperçu de la loge — et, à chaque photo, si la face montrée défile et si la croix reste en vue (`ECRAN=390x844` ; les états voulus en second argument ; règle `profil.md`). Une carte d'ami et ses gestes : `rendu-duels.ts`.
- `server/scripts/rendu-sentiers.ts` — tous les écrans des sentiers du savoir (règle `sentiers.md`).
- `server/scripts/rendu-traversee.ts` — la traversée du Cabinet de curiosités, au doigt, d'un bout à l'autre : l'écran-titre, les trois gardiens, le choix des cartes, la carte d'un acte en 3D et son chemin, l'annonce d'une épreuve, l'épreuve et sa tête, « Quitter ? », son bilan, « Comment ça marche ? », le coffre, le marchand, le gardien, le légendaire et la fin ; les étapes lointaines écrites à la main dans la base, le serveur relu ; à chaque photo, ce qui élargit la page (`ECRAN=1366x768`, `SORTIE` ; dans `export/rendus/` ; règle `cabinet.md`). La carte 3D demande la carte graphique émulée, que le script lance (`swiftshader`).
- `server/scripts/rendu-cloches.ts` — la cloche du rappel du soir, qui ne paraît que dans l'application installée, en haut de la page du jour ; puis le même endroit de la page des duels, qui n'en a plus — ce qui s'y trouve, et combien de cloches (règle `rappel-et-installation.md`).
- `server/scripts/rendu-niche.ts` — la niche du compagnon sur chaque page du téléphone où elle vit, de l'accueil au podium d'une soirée — les écrans d'un duel compris : le verdict et sa croix, un duel face cachée, « Duel envoyé » —, sa fiche, la bulle qui sort d'elle — une caresse, la niche touchée qui la referme, « Chez lui » depuis l'accueil et le profil, dépliée sur une page qui a défilé —, l'adoption d'un second à la boutique, le repli ; ses réactions dans la soirée — le souffle retenu, la bonne réponse qui le nourrit (« +1 », sa jauge), la ratée, la rare et sa bulle de cœurs, sa sortie au podium, une caresse dehors, son retour ; à chaque page, ce qui passe sous la niche, et leur compte à la fin — il doit dire « rien sous la niche » partout (`ECRAN=390x844`, `ENCOCHE=47`, `THEME=ivoire` ; règle `profil.md`). Ses réactions sont petites : regarde-les recadrées sur le coin de la niche, agrandies.
- `server/scripts/rendu-compagnon.ts` — « Mon compagnon », chez lui : il dort puis se réveille, ses trois envies (le goûter, le câlin du doigt, une cueillette entière), son grand cadeau et la trouvaille posée, « Décorer », la galerie et une adoption sur place, une forme de son chemin regardée, puis un domaine de dix places qui défile, et la page sans compagnon ; à chaque photo, ce qui déborde de côté (`ECRAN=390x844`, `ENCOCHE=47`, `THEME=ivoire`, `SEULEMENT=lea|max|zoe` ; règle `profil.md`). Une cueillette dure trente secondes : le tour de Léa en prend une minute et demie.
- `server/scripts/rendu-duels.ts` — les duels (`/duels`) : le bouton de l'accueil, la page d'un débutant, un duel classé — son enjeu, sa cote à la fin —, une montée de ligue, le classement ; puis défier quelqu'un touché au classement : la préparation — sur quoi, sa feuille —, une partie jusqu'à sa fin — à qui il est parti —, et celui qui le reçoit ; la feuille des amis et les joueurs croisés (`ECRAN=390x844`, `THEME=ivoire`, `CALME=1` ; règle `duels.md`).
- `server/scripts/rendu-bordures.ts` — les bordures de ligue dans l'application, six joueurs du bronze aux maîtres : sa ligne en tête de l'accueil et du profil, la loge et sa rangée « Bordure », une autre essayée, le classement des duels, la carte d'un maître et son avatar en grand (règle `duels.md`) ; `server/scripts/planche-bordures.ts`, leur planche — six ligues par sept finitions, leurs crans, ce qui déborde, les lumières, en petit, en Velours et en Ivoire (règle `medaillons.md`).
- `server/scripts/rendu-campagne.ts` — les écrans de la campagne qui se jouent sur plusieurs jours, l'horloge avancée à la main : le carnet de révision, ses révisions et leur fin, un duel au dé contre Automate et les défis entre amis, dans leur page `/duels` (règles `campagne.md`, `duels.md`), et les parcours de thème sous le carnet, dans « Apprendre » — une famille à la fois, la fiche d'un parcours, une étape et sa fin, le retour aux parcours (règle `sentiers.md`).
- `server/scripts/rendu-quiz-tout-pret.ts` — un quiz tout prêt, sur la vraie base de la campagne : « Créer un quiz », sa feuille réglée d'office puis choisie, le quiz composé dans l'éditeur, et le salon d'un profil où il rejoint ce soir (règle `bibliotheque.md`).
- `server/scripts/rendu-qg.ts` — le QG de l'administrateur (`/admin`) : trente jours d'activité inventée, une soirée en cours et une laissée en plan, au téléphone, en 1366 × 768 et en 1920 × 1080, sous le Velours et sous l'Ivoire, puis le journal des gestes, la page des soirées et la soirée en plan close d'un clic, la page « Le serveur » sur une semaine inventée, la page des erreurs — une réglée, un téléphone prévenu, le quiz du jour en panne — et la fiche d'une erreur, la page du quiz du jour — une question piège touchée —, la page de la campagne — le défi relevé par tous, un palier réglé, deux questions que leurs réponses contredisent — et « Régler » ouvert sur un palier, la page des duels — ses ligues peuplées, les duels qui attendent — et l'un d'eux annulé, la page de l'économie — trente jours d'achats et de soirées, des légendaires portés —, enfin la fiche d'une joueuse — le don qu'on prépare, le code de secours tiré — et son accueil qui annonce le don, une fois ; il dit si une page ou la fiche déborde en largeur (règle `qg.md`).
- `server/scripts/rendu-maintenance.ts` — le bandeau rouge, les pages en maintenance et celles bientôt disponibles (`/admin#maintenance`) : l'accueil sans profil sous le bandeau et s'il tient ses trois gros boutons sans défiler, l'accueil d'un profil et ses boutons éteints — l'Expédition sur « Bientôt disponible » —, sa niche sous le bandeau, l'écran d'une page fermée et celui d'une page qui arrive, l'onglet du défi fermé seul, une question où le bandeau se tait, la page fermée vue par l'administrateur, l'accueil d'un testeur (« En test ») et l'Expédition qui s'ouvre pour lui sous le bandeau, la page du QG — ses testeurs, la recherche d'un autre — au téléphone et en 1366 × 768 (`THEME=ivoire`, `THEME=sommet` — ses profils ont tous les thèmes, et le bandeau se regarde sous un décor peint, qui l'effaçait ; règle `qg.md`).
- `server/scripts/rendu-annonces.ts` — les annonces à tous (`/admin#annonces`) : la page du QG, un message et ses confettis pour chacun, son aperçu et sa confirmation, les annonces faites ; l'accueil d'un profil qui la lit, sa niche à côté, deux annonces l'une sous l'autre ; la ligne de la maintenance qui y mène ; en 1366 × 768 (`THEME=ivoire` ; règle `qg.md`).
- `server/scripts/rendu-themes.ts` et `server/scripts/apercus-themes.ts` — un thème dans l'application, son contraste, son aperçu (règle `themes.md`).
- `server/scripts/planche-portraits.ts`, `server/scripts/planche-medaillons.ts` — les images peintes dans tous leurs états (skill `peindre`).
- `server/scripts/mesure-pages.ts` (`npm run mesure`) — ce que chaque page fait attendre à un téléphone (règle `client.md`).
- `server/scripts/rendu-vitrine.ts` — les captures de la vitrine (`docs/vitrine/`) : le cas qu'on raconte, là où `rendu-ecran.ts` cherche le pire — un quiz de culture générale, dix amis dont six profils qui portent ce qu'ils ont gagné, trois équipes —, à l'écran commun en 1920 × 1080 (en Velours, la révélation aussi en Ivoire) et au téléphone d'une invitée en 390 × 844, en JPEG. Sans dossier, il réécrit celles de `docs/vitrine/captures` : c'est voulu quand l'écran a changé, à éviter pour un simple coup d'œil.
