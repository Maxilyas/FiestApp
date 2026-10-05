# Notes pour Claude

Quiz de soirée façon Kahoot, auto-hébergé. Les invités jouent depuis leur
téléphone, un écran commun anime la salle. Plusieurs animateurs partagent le
serveur : chacun a **son compte et son espace**, et ne voit rien de ceux des
autres.

Le `README.md` explique le produit à un humain. Ce fichier-ci explique le code
à un agent : ce qu'il faut savoir avant de toucher quoi que ce soit.

## Les commandes

```bash
npm run verify     # typecheck + tests + build + test de bout en bout — À LANCER AVANT DE COMMITTER
npm run dev        # serveur + client, http://localhost:5173
npm test           # les tests ciblés de server/test/ (node:test, quatre à cinq minutes)
npm run smoke      # le test de bout en bout seul (~90 s)
npm run sauvegarde # la base permanente en SQL daté, dans export/sauvegardes/
npm run tablee     # une soirée jouée par des agents (régie + /tablee) : voir .claude/skills/tablee/
```

Deux suites, aucune dépendance de plus, et toujours ni linter ni formateur.
`npm run smoke` boote un vrai serveur sur une base jetable et rejoue une
soirée entière : c'est la référence du chemin normal. `npm test` lance
`server/test/*.test.ts` avec `node:test` : ce qu'une soirée rejouée d'un bout
à l'autre ne provoque jamais — pannes, courses, messages malformés,
redémarrages. Chaque fichier qui a besoin d'un serveur démarre le sien,
jetable, avec `server/test/banc.ts` ; le moteur seul, horloge à la main,
se joue avec `server/test/salle.ts` — pour viser un instant qu'un vrai
serveur ne laisse pas choisir (le souffle, une pause, un intertitre) ; les
dérivations pures se testent directement. **Un nouveau comportement arrive avec son test dans
`server/test/`**, qui échoue avant la correction : on n'allonge plus le smoke.

## La carte du code

```
shared/     types et fonctions PURES, partagés client ↔ serveur ↔ test
server/src/core/    les registres et le moteur
server/src/games/   les règles du quiz
client/src/views/   une page = un fichier
server/test/        un fichier par thème, un serveur jetable chacun
```

| Fichier | Ce qu'il porte |
|---|---|
| `core/engine.ts` | route actions/commandes/timers vers le module de jeu, persiste, rediffuse les vues filtrées |
| `games/quiz.ts` | **toutes** les règles : phases (l'intertitre, `cible` — la mesure d'une estimation en direct), chronomètres, barème (le temps de lecture offert au QCM, l'estimation payée à la distance, `reponseJuste` pour « plusieurs » et « ordre », tout ou rien), vues — et la place de chacun entre deux questions (`placeAuQuiz`) |
| `core/space.ts` | la soirée d'un espace : ses registres, ses salons socket, ses diffusions, son nom figé, ses crédits — et la scène des écrans d'animateur (`poserScene` : podium, prix, victoire, clôture), que la télé suit quand on anime à la télécommande |
| `core/party.ts` | le registre des invités (identité par jeton, rattachement au profil, marques d'homonymie, connexions par socket) |
| `core/salons.ts` | le code d'un salon : six chiffres tirés à son ouverture — au premier écran d'animateur qui se présente, ou par « Créer un salon » (`POST /api/joueur/salon`, qui crée l'espace du profil la première fois, à une adresse neutre `s-…`, sans compte d'animateur à demander) —, dans la base permanente et en mémoire ; il vaut encore une demi-heure après la clôture (`SURSIS_APRES_CLOTURE_MS`), puis le salon suivant en tire un neuf. `/<code>` redirige vers l'adresse de l'espace (`decrirePage`) ; vingt codes manqués par adresse, puis deux par minute, et même le bon ne se cherche plus. Six chiffres ne sont jamais le nom d'un espace (`isValidSlug`) |
| `core/places.ts` | « Rendre sa place » : les codes à usage unique qui rendent sa fiche à un invité dont le téléphone est mort — en mémoire, vite périmés, cinq essais manqués par minute (la console est prévenue quand des codes faux la ferment) ; jamais pour une fiche à profil, et la reprise renouvelle le jeton |
| `core/scores.ts` | journal des gains, en ajout seul |
| `core/answers.ts` | une ligne par invité et par question posée, y compris sans réponse |
| `core/backup.ts` | le miroir de la soirée dans Turso : une file par espace, ordonnée, qui insiste ; la resynchronisation après une panne ; sa santé |
| `core/distante.ts` | le client libsql, avec un délai : une base muette se dit en dix secondes, pas en cinq minutes ; et `ajouterColonne()`, qui lit le schéma avant de migrer — une fois par table — et laisse toute panne arrêter le démarrage |
| `core/archive.ts` | l'historique : une fiche par soirée, relue avec les règles du jour ; `Soiree`, le nom figé |
| `core/recap.ts` `review.ts` `stats.ts` `progress.ts` | **dérivations pures** des journaux |
| `core/journal.ts` | le journal rangé question par question et quiz par quiz : la seule lecture qu'en font l'expérience et les hauts faits — et le coup d'œil de chaque estimation (`coupDOeil`), que lisent aussi le souvenir, le bilan et la carte |
| `core/hautsfaits.ts` | les hauts faits d'une soirée, invité par invité — dérivation pure, jouée à la clôture et sur les archives |
| `core/recalcul.ts` | au démarrage, relit l'historique au barème du jour (`VERSION_BAREME`) : expérience, prix, hauts faits, paliers |
| `shared/hautsfaits.ts` `shared/legendaires.ts` | le catalogue des hauts faits (soirée, carrière en trois paliers — ceux du quiz du jour, `duJour`, et de la campagne, `deCampagne`, que la clôture d'une soirée ne décerne pas ; et ceux qui se regagnent hors des soirées, `HAUTS_FAITS_DU_JOUR` et `HAUTS_FAITS_DE_CAMPAGNE`, sans expérience, rangés sous leur jour, leur série ou leur semaine) et les avatars légendaires qui s'en débloquent — sur la durée : une vingtaine de quiz au premier qui en décroche un ; le Sphinx, treizième, au quiz du jour, par l'une de ses deux voies (`aussi`), et trois de saison (`saison`) ; puis dix du quiz du jour et de la campagne (l'Aigle, l'Ouroboros, le Scarabée, le Coq, la Chauve-souris, la Salamandre, l'Éléphant, le Serpent, et la Chimère et Janus, qui demandent tout un ensemble — `toutes`), et neuf légendaires des soirées qu'un haut fait du jour ouvre aussi (`aussi`, `voiesDe` : la page montre la voie la plus avancée) — un légendaire de plus ne reprend rien à personne : ce qu'il change aux Divins se lit dans `core/divins.ts`, et nulle part ailleurs (invariant 21) ; et la rareté mesurée de chaque haut fait (`PART_DES_JOUEURS`), qui choisit les trois plus beaux de la carte (`plusBeaux`) |
| `shared/fin.ts` | ce que la soirée annonce : au podium d'un quiz, à la clôture — au téléphone (`soiree:fin`) et à la salle (`soiree:cloture`) ; la soirée suivante, que la fin ne propose qu'une fois commencée — un invité inscrit, un quiz lancé (`suivanteCommencee`). Au téléphone (`FinDeSoiree.tsx`), l'essentiel dans le cadre du tableau de bord — sa place, ses points, l'expérience et les confettis en cadrans —, trois nouveautés, deux boutons (« Mon bilan », « Accueil »), et tout le reste replié sous « Plus » (`fin-allegee.test.ts`) |
| `shared/liens.ts` · `client/src/components/Lendemain.tsx` | les liens d'une soirée close, à l'adresse de son archive (`/<espace>/souvenir` change de soirée à la suivante) ; et « La dernière soirée », que le téléphone garde (`garderFin`, `client/src/state.ts`) pour l'entrée et l'accueil — sa fin ne se rouvre qu'au retour sur la page, rechargement ou retour du navigateur, jamais à une arrivée (`estUnRetour`) : un lien, le QR, « Jouer depuis cet appareil » ouvrent l'entrée (`entre-deux-soirees.test.ts`) |
| `shared/carte.ts` · `core/carte.ts` | la carte d'un joueur, ouverte en touchant son nom (`/s/<espace>/joueurs/<id>.json`) — et la sienne, depuis sa page (« Voir ma carte », `/api/joueur/carte`, sans « ce soir ») : son titre, sa vitrine — celle qu'il a choisie, sinon ses trois plus beaux hauts faits —, ses trois écussons les plus hauts, sa collection de prix, son quiz du jour en une ligne. La moitié profil se calcule une fois pour les deux (`profilDeCarte`). Au téléphone (`CarteJoueur.tsx`), dans le cadre du tableau de bord, jamais plus haute que les trois quarts de l'écran : sa barre ne défile pas et la croix qui la ferme y reste, ses chiffres en cadrans, trois par rangée |
| `shared/saisons.ts` · `core/saisons.ts` | les saisons (Halloween, Noël, le Nouvel An, à la date de Paris — `periodeDu`) et leur légendaire : quelques jours de quiz du jour dans la période (`JourStore.accorderSaison`), ou une soirée qui compte ces jours-là, datée à sa première question (`laureatsDeSaison`, à la clôture comme au recalcul) ; rangées `saison:…`, hors de l'étagère et du compte des badges |
| `shared/fonds.ts` | les fonds de carte (nuit étoilée, aurore boréale, kintsugi, grand théâtre, cabinet de curiosités — au troisième palier de maître des sentiers, `maitres` —, et deux peints : le Triomphe, au champion du mois, le Cadran solaire, à L'Élite · Argent) : ce qu'on voit derrière sa carte, rien ailleurs ; ceux qu'il a gagnés (`fondsOuverts`), celui qu'il porte relu à chaque affichage (`fondPorte`), comme un titre. Le décor tient au cadre de la carte (`.carte-fond`), son contenu défile par-dessus (`.carte-defile`) |
| `shared/themes.ts` · `client/src/themeJoueur.ts` · `client/src/themes/` · `components/Boutique.tsx` | les thèmes et leurs confettis : une bonne réponse, un confetti — les soirées qui comptent (`confettisDeSoiree`, sur les relevés) et le quiz du jour (`JourStore.justesDe`) —, moins les achats (`profile_achats`, et les vies des sentiers, `profile_vies`), relus à chaque lecture (`ProfileStore.boutiqueDe`) : rétroactifs, un solde qui peut passer sous zéro, un achat jamais repris ; trente thèmes à l'échelle de rareté (`PRIX_DES_THEMES`), six de saison (`enBoutique`), achetés et portés d'un geste (`POST /api/joueur/themes`) — et cinq qui ne se vendent pas, ils se gagnent (`gagne`, jamais `enBoutique`, possédés par `boutiqueDe` — `themeGagne`) : Babel aux douze paliers de maître des sentiers, l'Horloge astronomique à cinquante victoires au quiz du jour, le Ciel du jour à L'Infatigable · Argent, les Très Riches Heures aux douze pages du calendrier, le Sommet à L'Alpiniste · Or. Le thème suit la personne (le choix du 4 octobre 2026) : toutes les pages du profil connecté ici — l'accueil, sa page, la boutique, ses quiz, son compte, son salon, la soirée, le quiz du jour, la campagne, le souvenir et le bilan — le portent, celui retenu au démarrage (`poserThemeRetenu`, `main.tsx`), puis celui que dit le serveur : lu avec le profil par la page qui le lit (`porterTheme`, `LISENT_LE_PROFIL`), demandé seul sinon (`confirmerTheme`, `GET /api/joueur/theme`, lu en mémoire) ; jamais l'écran commun ni la télé — l'aperçu de l'écran commun, dans « Mes quiz », prend son habit le temps de s'ouvrir (`commeLEcranCommun`) —, ni les fiches imprimées du bilan, en Ivoire, et l'anonyme joue en Velours. Chaque thème a sa feuille, chargée à la demande (`import.meta.glob`) — ses jetons sous `:root[data-theme='<clé>']`, son décor dans les couches fixes (`body::before`…, `#root::after`), ses animations à son nom, arrêtées si le système demande moins de mouvement —, et ses polices (`client/public/fonts/themes`, licences jointes) ; `design.test.ts` en mesure les contrastes. La boutique (`/boutique`) a deux rayons sous une barre fine (`PanneauBoutique`, `onglets-fins` — les pilules restent aux choix qui changent tout l'écran) : les thèmes (`RayonDesThemes`), qui ne vendent que ce qu'on n'a pas, une rareté à la fois, et les vies des sentiers, à leur adresse (`/boutique#vies`, `RayonDesVies`) ; ceux qu'on a se portent dans « Mon style › Thème » (`/profil#style-theme`, `MesThemes`) — les mêmes cartes, le geste de « Mes avatars » — toucher un thème ouvre sa fiche sous sa rangée, on le porte ou on l'achète de là (`DetailTheme`), jamais d'un toucher —, et le thème porté s'y lit dans `PublicProfile.theme`, que chaque enregistrement rend, jamais dans `boutique.porte`, figé à la lecture de la page (`themes.test.ts` y veille) ; le solde en tête du profil, les confettis de ce soir à la fin de soirée (`FinDeSoiree.profil.confettis`) |
| `shared/calendrier.ts` · `client/src/components/Calendrier.tsx` · `calendrier-peint.ts` | le calendrier des Heures du quiz du jour : douze enluminures, une par mois ; vingt jours joués dans un mois ouvrent sa page (`JOURS_POUR_UNE_PAGE`, rangée `heures:<mois>` sous le mois, hors du compte des badges), le champion du mois la reçoit dorée — la dorure se lit sur ses titres de champion (`pagesDorees`) —, les douze ouvrent le thème des Très Riches Heures ; `calendrier-peint.ts` est écrit par `decors.ts --livrer`, jamais à la main |
| `shared/gerbes.ts` · `client/src/gerbe.ts` · `components/Gerbe.tsx` | la gerbe : ce qui éclate sur son téléphone à une bonne réponse — en soirée, au quiz du jour, en campagne, sur les sentiers, au défi. Dix gerbes, les confettis pour tout profil, les autres ouvertes par un haut fait ou un palier (`gerbesOuvertes`) ; celle qu'il porte se relit à chaque affichage (`gerbePortee`, la colonne `profiles.gerbe`), se choisit dans « Mon style » (`MaGerbe`), et ne part qu'à lui (`PublicProfile.gerbe`) : ni la salle ni l'écran commun n'en savent rien, l'anonyme n'en a pas (invariant 8). La page qui lit le profil la retient (`porterGerbe`, comme le thème) ; elle éclate dans un portail sur `body` — une carte à `backdrop-filter` devenait le repère de son `position: fixed` et la rognait —, par `transform` et `opacity`, et se tait si le système demande moins de mouvement (`gerbes.test.ts`) |
| `client/src/components/Ouverts.tsx` · `EntreeEnScene.tsx` | ce qu'une partie vient d'ouvrir et qu'on porte d'ici — les emojis de collection, un légendaire (`LegendaireOuvert`), un haut fait ou un palier tombé (`RecompenseTombee`) —, à la fin d'une soirée, du quiz du jour, d'une série, d'une épreuve ou du défi ; et l'entrée en scène du champion du mois à l'écran commun : un bandeau d'or, quelques secondes, à son arrivée seulement — jamais pour ceux qui sont déjà là quand l'écran s'ouvre, ni par-dessus une question |
| `server/scripts/rendu-recompenses.ts` | les écrans des récompenses du quiz du jour et de la campagne, photographiés sur un serveur jetable : les records par catégorie, une fin de série qui fait tomber hauts faits, paliers et légendaire, le défi de la semaine de bout en bout, le laurier d'argent, la gerbe, et l'entrée en scène du champion du mois en 1366 × 768 |
| `server/scripts/apercus-themes.ts` | les aperçus de la boutique : l'écran d'une question photographié dans l'application sous chaque thème (client construit d'abord), rogné à la question et réduit en WebP dans `client/src/themes/apercus/` ; `themes.test.ts` refuse un thème sans le sien |
| `shared/ecussons.ts` · `client/src/components/Ecusson.tsx` | les écussons de savoir : les bonnes réponses d'une catégorie, soirées (`Carriere.categories`) et quiz du jour (`JourStore.categoriesDe`) ensemble, au bronze, à l'argent, à l'or (`SEUILS_ECUSSON`) — dérivation pure, sans expérience ; les trois plus hauts sur la carte (`plusBeauxEcussons`), les douze sur la page du profil |
| `core/objectifs.ts` | ce que la fin de soirée raconte en plus de ce qu'elle rapporte : les records battus, « Tu t'en approches » — dérivations pures de l'historique, lues à la clôture après les crédits |
| `shared/jour.ts` · `core/jour.ts` · `server/src/quizDuJour.ts` · `client/src/views/JourApp.tsx` | le quiz du jour, pour les profils : dix questions tirées à minuit (Paris) et figées, une partie chronométrée au serveur, dans la base permanente ; l'expérience (75 au plus, podium 25/15/10) dans la ligne `#jour` ; la nuit qui clôt la veille à la première demande (`clorePasses`) ; ses trois paliers (L'Assidu, Le Champion du jour, Le Sans-Faute), décernés dès la partie commencée (L'Assidu, la saison : une partie commencée compte), à sa fin (Le Sans-Faute) ou à la nuit (la victoire) (`accorderPaliersDuJour`) et rangés sous le jour (`cleDuJour`), jamais sous une soirée ; le laurier des vainqueurs d'hier (`laureats`), qui suit leur prénom jusque dans les soirées (`Distinctions.laurier`, `components/Laurier.tsx`) et grandit avec leurs victoires (`niveauDuLaurier` : vert, d'or, serti, étoilé) — l'argent du défi de la semaine se porte au même endroit (`LaurierPorte`), celui d'hier passant devant ; les hauts faits du jour (le Lève-tôt à la fin de la partie, le reste à la nuit — `decernerLaNuit` —, rangés sous le jour, annoncés le lendemain), le mois qui se clôt à son tour (`cloreLesMois`, `jour_meta`) — son champion (un titre daté, `mois:2026-10`, sa marque tout le mois suivant, `champions`, que l'écran commun salue, `EntreeEnScene`), le Mois complet —, la page du calendrier des Heures à vingt jours joués, les sabliers de la série (`profile_sabliers`, `serieAvecSabliers`) et Chronos (`core/divins.ts`) ; tout cela relu une fois sur les jours d'avant, sous sa version (`relireLesJours`, `VERSION_DES_JOURS`) ; la réserve, ses signalements et les profils masqués, à `/admin`. La page s'ouvre sur le profil léger (`/api/joueur/moi?leger` : prénom, niveau, thème — la campagne aussi), sa partie demandée en même temps : le détail coûtait huit allers-retours à la base. Au téléphone, sans liaison temps réel, la page redemande ce que le serveur décide seul jusqu'à l'avoir (`client/src/insister.ts`), et chaque écran commence en haut, rend le focus perdu (`client/src/focus.ts`) et n'accepte aucun toucher dans sa première demi-seconde (`gesteAccepte`) ; « ← Retour », en tête du classement ou de la correction comme en bas, ramène d'où l'on vient (`retourDuJour`) — l'écran qui les a ouverts, marqué dans l'historique (jamais par `location.hash =`), ou la page qui a ouvert `/jour` ; chaque période du classement a son adresse (`#classement-mois`), réécrite sur la même entrée |
| `shared/jour.ts` (`HEURE_DU_RAPPEL`) · `core/rappels.ts` · `core/pousser.ts` · `client/public/sw.js` · `client/src/rappel.ts` · `components/RappelDuJour.tsx` | le rappel du soir du quiz du jour : dans l'application installée seulement (`estInstallee`, `installation.ts`), une petite cloche en haut de la page du jour, à côté de la sortie (`BarreDuJour`, `ClocheVue`), abonne le téléphone au service de push de son navigateur, et la coupe d'un second toucher — au toucher même, rien d'attendu avant : l'iPhone ne demande la permission qu'au geste (`activerLeRappel`) ; pas de bouton en pleine page (le choix du 4 octobre 2026) ; vers 18 h à Paris (`HEURE_DU_RAPPEL`, jusqu'à `FIN_DU_RAPPEL`), une notification, une seule par téléphone et par jour, à qui n'a pas fini sa partie (`JourStore.pourLeRappel`), réservée en base avant l'envoi (`dernier_jour`) — un redémarrage ou un second serveur ne la renvoie pas. Attachée à la session qui l'a demandée (une déconnexion la défait, la page du jour la rattache à chaque visite), cinq téléphones par profil, et seulement vers les services de push des navigateurs (`serviceDePushConnu`). Le Web Push sans bibliothèque (`pousser.ts` : VAPID et aes128gcm, prouvés sur l'exemple de la RFC 8291), les clés du serveur tirées au premier démarrage et gardées dans Turso (`jour_rappels_cles`) ; `/healthz` dit la dernière tournée (`rappel.test.ts`) |
| `client/src/installation.ts` · `components/Installer.tsx` | l'application sur l'écran d'accueil : au pied de l'accueil d'un téléphone (`telephoneDe` : l'iPhone et l'iPad ensemble, Android ; rien sur un ordinateur, rien dans l'application installée — `estInstallee`, que le rappel du soir lit aussi), une ligne repliée — l'icône, « Installer l'application », une flèche — qu'un toucher déroule : ce qu'elle apporte, les gestes de chaque téléphone, un onglet chacun, le sien d'abord ; sur Android, l'invitation de Chrome (`beforeinstallprompt`), gardée dès le démarrage de chaque page hors de l'écran commun (`ecouterLInstallation`, `main.tsx`) — elle ne surgit plus d'elle-même en pleine soirée —, s'offre d'un toucher (`installer`, une fois) ; « Ne plus afficher » la masque sur ce téléphone. Petite, exprès (le choix du 4 octobre 2026). Sans profil, elle passe sous les trois gros boutons (`ProfilForm`, `pied`), qui restent visibles sans défiler (`installation.test.ts`) |
| `shared/campagne.ts` · `core/campagne.ts` · `server/src/campagne.ts` · `client/src/views/CampagneApp.tsx` | la campagne solo (`/campagne`), pour les profils : une série qui monte de marche en marche (cinq faciles, cinq moyennes, cinq difficiles, puis l'expert — `ordreDeSerie`), trois vies, sans chronomètre ; ses questions viennent de sa base à elle (`core/baseCampagne.ts`), jamais de la réserve du quiz du jour — elle en reposait les questions, vues et corrigées chaque matin (le choix du 3 octobre 2026) — : les deux restent disjointes par l'intitulé, dans les deux sens (`JourStore.empreintes`, `dansLaCampagne`). Chaque marche tire d'abord ce que le joueur n'a jamais vu ; le niveau d'une question part de sa difficulté estimée à l'écriture, lissée par les réponses de campagne (`tauxLisse`, vingt réponses fictives — `niveauDeQuestion`). Le serveur compte les vies et ne donne la bonne réponse qu'après la sienne (invariant 1) ; la fin de série dit le record d'avant et la marche atteinte (`recordAvant`, `niveauAtteint`), la correction redonne l'anecdote. La page s'ouvre sans attendre le serveur (`CampagneEnChemin` : le défi et les règles, le record et les boutons dès sa réponse), et l'accueil d'un profil en télécharge le code en fond, avec celui du quiz du jour (`campagne-ouverture.test.ts`). Une question se signale après sa réponse, et se relit à `/admin#campagne` : la garder, ou la retirer pour tous (`campagne_retraits`). Une bonne réponse vaut un confetti (`ProfileStore.justesDeCampagne`) et l'expérience d'une bonne réponse en soirée (`XP_PAR_JUSTE`), sans plafond — chacun monte à son rythme (le choix du 3 octobre 2026) —, dans sa ligne à part (`LIGNE_CAMPAGNE`, `#campagne`), relue de ses réponses à chaque bonne réponse — comptées par heure, dans le lot qui écrit la réponse (`lectureDesJustes`) : Paris change de jour à une heure pile —, sous le verrou du profil ; la série en cours se garde en mémoire (`enCours`), oubliée au moindre échec d'écriture (`campagne-charge.test.ts`). Une série finie fait tomber ses hauts faits (le Funambule, Sans une égratignure, la Grande Série, le Tour du monde — `hautsFaitsDeLaSerie`, rangés sous la série, `cleDeSerie`), puis les paliers de la campagne (L'Alpiniste, L'Érudit, Le Marathonien — `statsDe`) et les légendaires qu'ils ouvrent ; la page tient ses records par catégorie (`recordsParCategorie`, la colonne `categories`) ; les séries d'avant se relisent une fois (`relireLesSeries`, `VERSION_DES_SERIES`). À côté, son second onglet : les sentiers du savoir (ligne suivante) ; et le troisième, le défi de la semaine (`client/src/views/Defi.tsx`, `#defi`) : la même série pour tous du lundi au dimanche, tirée au premier qui l'ouvre et figée (`campagne_defis`, `tirageDuDefi`), une série d'un autre mode (`mode = 'defi'`, `semaine`) — une seule tentative, qui se reprend ; le record des séries ne la compte pas, et sa correction attend la clôture. Rien ne tourne le lundi : la première demande clôt les semaines passées (`cloreLesDefis`) — Le Vainqueur du défi rangé sous la semaine (`cleDuDefi`), tous les ex æquo à deux joueurs au moins — et le laurier d'argent se lit en mémoire, comme celui du jour (`vainqueursDuDefi`, `ProfileStore.argentDe`, `campagne-defi.test.ts`) |
| `shared/sentiers.ts` · `CampagneStore` (les sentiers) · `client/src/views/Sentiers.tsx` · `core/repriseDesPortraits.ts` | les sentiers du savoir (`/campagne#sentiers`, `#sentier-foret`), où se gagnent les avatars du savoir — et nulle part ailleurs (le choix du 5 octobre 2026) : un sentier par branche, douze paliers, une épreuve de seize questions de sa catégorie par palier, **douze bonnes réponses pour valider, partout** — ce sont les mélanges qui durcissent (`PALIERS`, des faciles aux difficiles, jamais d'experte sur un palier à portrait), sans vrai ou faux dès le cinquième, toute la catégorie dès le neuvième (`tirerUneEpreuve`) ; un portrait tous les deux paliers (`PALIER_DU_PORTRAIT`), puis le palier de maître, facultatif (seize expertes, neuf à trouver, un titre `maitre:<branche>` qui se porte comme un haut fait — `nomDuTitre` écrit tout titre). L'épreuve s'arrête à la faute de trop, ou va au bout une fois validée, pour les étoiles (`etoilesDe`). Une épreuve est une série d'un autre mode, dans les mêmes tables (`campagne_series.mode = 'sentier'`, sa branche, son palier, son seuil figé, `rejeu`, `issue`) : l'expérience, les confettis, la mesure des difficultés et « jamais vues d'abord » les comptent sans rien en savoir ; toute requête des séries filtre son mode (`SERIES`). Douze vies par jour pour tous les sentiers, rendues à minuit (Paris), sans cumul : seul un palier raté en coûte une, quitter une épreuve en jeu aussi ; rejouer un palier validé est libre ; une épreuve à la fois. Au-delà, des vies achetées en confettis (`PRIX_D_UNE_VIE`, `ProfileStore.acheterVies`, `profile_vies`), dans une réserve qui ne périme pas — à la boutique, dans son onglet (`/boutique#vies`, `RayonDesVies`), et sur « Plus de vies ». Rien ne se compte à côté : vies (`viesDe`), paliers et étoiles se relisent dans le journal des épreuves et dans `sentier_acquis`, les paliers que la reprise a retenus des portraits d'avant (deux par portrait, aux seuils d'avant, `SEUILS_D_AVANT` — une fois, sous son drapeau). Un palier ne se perd jamais : le portrait et le titre de maître se vérifient quand on les prend (`ProfileStore.update`, `paliersDesSentiers`), puis se croient (`legendairePorte`, `titrePorte`). Le haut des sentiers est un seul bloc (`HautDesSentiers`, le choix du 5 octobre 2026) : le sentier montré en panorama — ses douze paliers en lacet, placés en pourcentages, la couronne au bout (`PanoramaDuSentier`) —, les vies en cœurs, et les règles, dépliées tant qu'on n'a pas gagné trois paliers en jouant (`PALIERS_DU_DEBUTANT` : les paliers repris, sans étoiles, n'y comptent pas), puis sous « Comment ça marche ? ». Il montre le sentier qu'une tuile a touché, sinon celui qu'on avance (`sentierMontre`) : une tuile ne fait plus entrer tout droit — touchée, son sentier monte dans le bloc ; touchée quand il y est, ou par le bouton du bloc, on y entre (`sentiers-panorama.test.ts`). Dans un sentier, ce que le palier à jouer ouvre se lit sous lui, jamais dans l'en-tête collé : en bulle, il se posait sur le chemin. Un refus, lui, s'y écrit — sous lui, il restait en haut de la page pendant que le chemin montrait le palier. Et une épreuve à la fois : celle laissée en jeu ailleurs, le serveur refuse toute autre, rejeu compris (`epreuveQuiBloque` — un rejeu laissé, ou une épreuve validée qui continuait, il les referme) ; la fiche d'un palier le dit et mène à elle au lieu de « Jouer », le bloc du haut la rappelle quand il montre un autre sentier (`sentiers-une-epreuve.test.ts`). `/admin#campagne` lit chaque palier sur les vraies épreuves (`adminDesSentiers` : premier essai, essais, vies perdues avant de valider ; les rejeux à part — un palier repris des portraits d'avant, joué pour la première fois, en est un), `server/scripts/calibrage-sentiers.ts` le calcule d'avance ; `rendu-sentiers.ts` photographie tous les écrans (`sentiers.test.ts`, `sentiers-vies.test.ts`, `sentiers-reprise.test.ts`, `sentiers-panorama.test.ts`, `sentiers-une-epreuve.test.ts`) |
| `core/baseCampagne.ts` · `server/scripts/base-campagne.ts` · `server/content/campagne/` | la base de la campagne : des milliers de QCM écrits et étiquetés d'avance, une catégorie par fichier, une question par ligne, ses métadonnées au format de l'étiquetage (`MetadonneesDeQuestion`) et relues par le même juge (`lireEtiquetage`, sous `lireQuestionDeLaBase`, qui refuse au premier défaut : confiance sous 3, fait à revoir, emoji, réponse dans l'intitulé…). Lue une fois par processus, en fond vingt secondes après le démarrage (`PRECHAUFFAGE_CAMPAGNE_MS`, `CampagneStore.prechauffer`) — à la première série, elle faisait attendre 3,5 s le premier joueur après un déploiement —, par tranches qui rendent la main (`lireLaBaseSansBloquer`) : d'un bloc, elle figeait 0,4 s toutes les soirées du serveur. Elle grandit par son script : `consigne` (ce qu'on donne à une IA pour un lot, avec les intitulés que la catégorie a déjà), `verifier` (ce que le rangement refuserait), `fiche` et `appliquer` (la relecture des faits : une fiche compacte, puis ses décisions — retirer, ou corriger une phrase), `ranger` (les identifiants, les doublons écartés — la base, les quiz livrés), `voisines`, `stats`. Deux agents du projet font ce travail sobrement (`.claude/agents/`) : `redacteur-campagne` (Sonnet, réflexion basse) écrit un lot, `relecteur-campagne` (Opus, réflexion basse) en relit la fiche — la première vague, au niveau de réflexion hérité de la session, coûtait quatre mille jetons de sortie par question. Elle grandit aussi chaque matin, sans déploiement : la routine de la réserve du quiz du jour, avec le même jeton, demande ce qui manque (`GET /api/campagne/base` : cinq questions par catégorie et par jour, là où sous-thèmes et difficultés manquent le plus — `commandeDeLaCategorie` —, et la consigne, `core/consigneCampagne.ts`, la même que celle du script) puis dépose (`POST`), chaque entrée relue par le même juge, chaque refus rendu avec son motif — la routine n'a pas le dépôt, ni `verifier` ni ses agents : sa consigne ne lui fait rien lancer (`TravailDUnLot`) ; rangée dans `campagne_ajouts`, jouable aussitôt (`CampagneStore.base`), relisible et retirable à `/admin#campagne` (`campagne-routine.test.ts`) |
| `shared/etiquettes.ts` · `core/etiquetage.ts` | les métadonnées d'une question de la réserve — sous-thème (une liste fermée par catégorie), étiquettes, difficulté estimée, âge, portée, leurres, source… : la consigne qu'on donne à une IA pour les écrire (`consigneDEtiquetage`, cinq versions essayées le 3 octobre 2026), et la relecture de ce qu'elle rend (`lireEtiquetage`), qui refuse l'entrée entière sur une clé inconnue et applique les règles de prudence. Par la porte de la réserve, avec son jeton (`/api/jour/reserve/etiquetage`) ; rangées dans `jour_reserve.metadonnees` |
| `core/consigne.ts` | la consigne qu'on donne à une IA pour écrire la réserve du quiz du jour — avec ce que disent les joueurs de la difficulté des dernières questions posées (`ceQueDisentLesJoueurs`), qu'une IA qui écrit sans retour ne sait pas juger — la routine Claude Code qui la remplit derrière `RESERVE_TOKEN` (`/api/jour/reserve` : la consigne, puis le dépôt ; MISE-EN-LIGNE.md, étape 8), ou « Copier la consigne pour une IA » à `/admin` : une seule pour les deux. Le serveur ne détient aucune clé d'IA |
| `shared/glossaire.ts` · `client/src/components/Glossaire.tsx` | les mots maison (souvenir, bilan, coup d'œil, finition…), une phrase chacun, dépliée au toucher sous les pages qui les emploient — des Divins, le nom et le mystère seulement |
| `shared/categories.ts` | la liste fixe des catégories de questions, la même chez tous les animateurs |
| `shared/echange.ts` | un quiz qu'on emporte : le fichier d'export (questions, et toutes leurs pièces en clair — photos, extraits), sa lecture, et l'import, qui repasse par l'envoi d'image et la création de quiz — le navigateur et les tests par le même chemin |
| `shared/hasard.ts` | le hasard d'une partie : les réglages du quiz (réponses mélangées, questions dans le désordre, tirage de N questions, les jamais posées d'abord) et `preparerPartie`, qui tire **une fois** la copie jouée — l'ordre à retrouver toujours mélangé, jamais tel qu'écrit. Les index d'une réponse sont ceux de la copie : c'est elle que le journal numérote et que l'archive range |
| `shared/programme.ts` · `core/programmes.ts` | le programme de la soirée : les quiz de ce soir dans l'ordre, leur multiplicateur, le prochain à lancer — aux écrans d'animateur seulement ; il se choisit en créant le salon (`SalonApp`, `quizDuSalon`), plus dans « Mes quiz » |
| `core/memoire.ts` | la mémoire des quiz : « joué 3 fois », « trouvée par 3 sur 13 », le tirage des jamais posées — dérivée des fiches des soirées (`jeux`), jamais des archives entières |
| `shared/partage.ts` · `core/partages.ts` · `server/src/partages.ts` | partager, par copie seulement : un code court (sept jours, annulable, dix essais manqués par quart d'heure) et le catalogue que l'administrateur relit ; la copie reçue recopie toutes les pièces de ses questions (`copierPhotos`) |
| `shared/modeles.ts` · `shared/emojis.ts` | les modèles livrés, leurs rayons et « Pour qui ? » ; la règle des emojis d'avant Unicode 13, que l'éditeur dit sur la carte et que `emojis.test.ts` garde |
| `shared/liste.ts` | « Coller une liste » vue d'ailleurs : le format complet qu'on copie pour un ami ou une IA, écrit à partir des bornes et des catégories, et les photos jointes qui rejoignent leur question par leur nom de fichier (`photoAttendue` en attendant) ; et l'inverse, `ecrireListe` (« Copier en liste »), que `liste.test.ts` recolle |
| `client/src/components/Legendaire.tsx` · `legendaires-peints.ts` | les vingt-six légendaires, des cartes peintes à la feuille d'or — un seul style, une collection — sous une pellicule holo : un arc-en-ciel en `color-dodge`, qui n'allume que ce qui est clair — ses couleurs n'ont aucun canal plein : à 255, il poussait au maximum tout pixel non noir, et la Licorne noire éclatée virait au vert —, une diffraction, un reflet ; des calques que le navigateur compose, qui ne bougent que par `transform` et `opacity`, dans un disque découpé par `clip-path` (sous l'inclinaison, un `overflow` oubliait son arrondi). En grand (`grand` : sa révélation, la clôture), ses grands fichiers, et le reflet suit le doigt ; éclatés, leur version rare, repeinte sur la même pose, sous deux arcs-en-ciel, des paillettes, une gerbe derrière et la créature qui sort du cadre (`.lg-debord`), holo jusqu'au bout des ailes : la même pellicule la suit hors du disque, ses calques posés dans le repère du médaillon (`--f`, `--s`), sans raccord au bord du cercle ; de l'ombre, une pellicule noire ; verrouillés, la silhouette dorée de leur créature détourée, immobile — un Divin verrouillé aussi (`.dv-voile *`) ; portés, la finition devient leur cercle ; figés dans les listes, sans gerbe ni débord — halos des finitions et paillettes de l'Éclat compris —, animés là où ils sont le sujet — dans la grille du profil, les aperçus des finitions et les galeries de la carte, seuls le porté, l'ouvert et le survolé bougent. Leurs fichiers vivent dans `client/public/medaillons`, nommés par leur empreinte et servis un an (`/medaillons`, `server.ts`) ; `legendaires-peints.ts` est écrit par `legendaires.ts --livrer`, jamais à la main — et la livraison fusionne : les originaux restent dans `export/`, hors du dépôt, et une machine qui ne les a pas ajoute un médaillon sans rien perdre des autres |
| `client/src/components/medaillons.ts` | les dessins des légendaires, des Divins et des branches, chargés à la demande : un invité anonyme ne les télécharge que si quelqu'un, dans la salle, en porte un — ne les importe pas statiquement sur son chemin (`Avatar`, `PlayerApp`, la carte ; `medaillons.test.ts` y veille), et un échec vaut pour toute la page ; chaque sorte à part (`sortesDe`) : un légendaire ne fait pas venir les Divins, le cerf ne fait venir que la forêt ; `chargerDessins()` sans argument ne fait venir que les médaillons (légendaires, Divins), jamais les douze branches ; la lumière des finitions aussi (`lumiere`, `sortesDesAvatars`) : une salle sans niveau 15 ne la télécharge pas, et un Divin ne la fait pas venir |
| `client/src/components/Lumiere.tsx` | la lumière des trois dernières finitions — le Diamant (Prisme), les Voiles (Aurore), l'Astrolabe (Constellation) —, que `Avatar` pose autour de l'emoji comme du médaillon, jamais d'un Divin : des calques derrière et devant lui (`.lu-arriere`, `.lu-avant`), des images `data:` faites une fois pour toute la salle ; ce qui fait anneau autour d'un emoji est, autour d'un médaillon, son cercle (`Cercle.tsx`). Elle ne bouge que par `rotate`, `scale`, `translate` et `opacity`, se resserre et se fige dans les listes, s'arrête si le système demande moins de mouvement (`lumieres.test.ts`) ; en l'attendant, l'emoji garde son halo d'avant (`:not(.av-lumiere)`) |
| `shared/branches.ts` · `client/src/components/Portrait.tsx` · `portraits/` | les avatars du savoir : douze branches, une par catégorie, six portraits peints chacune, ouverts par les paliers de leur sentier du savoir (`PALIER_DU_PORTRAIT`, `portraitsOuverts` sur les `Paliers` du profil — `PublicProfileDetail.sentiers`) ; ni les soirées ni le quiz du jour n'en ouvrent ni n'en annoncent plus (le choix du 5 octobre 2026), et chacun a gardé les siens, repris en paliers (ligne des sentiers). Un portrait se révèle à la fin de l'épreuve qui le donne, d'où on le porte. Un style d'image par branche, un ingrédient de plus par palier : le visage (détouré, sur le disque teinté de la branche), le décor, le geste, la lumière (anneau d'argent), le débord — ce qui sort du disque par le haut, par-dessus l'anneau, estompé avant le bord de l'image (`DEBORD`) —, la forme ultime (anneau d'or, aura qui respire, étoiles). Porté, le cercle de la finition (`Cercle.tsx`) remplace l'anneau, sauf en Mat ; éclaté, le décor passe sous le ciel rare de sa branche (`CIELS_RARES`, un filtre de sa lumière) et le personnage détouré, posé par-dessus, garde ses couleurs ; verrouillé, sa silhouette dorée (le personnage en masque), qui déborde déjà. Dans une liste, il tient dans son disque : ni débord, ni aura, ni étoiles (`.pt-debord`). Chaque portrait a deux fichiers WebP — le disque (`disque`, absent au visage) et le personnage (`perso`) —, en deux tailles : la petite partout, la grande pour ce qu'on regarde (`grand`, `Dessin`). Ils vivent dans `client/public/portraits`, nommés par leur empreinte et servis un an (`/portraits`, `server.ts`) ; le module de chaque branche (`portraits/<branche>.ts`) est écrit par `livrer.ts`, jamais à la main ; `server/scripts/planche-portraits.ts` les photographie tous, dans tous leurs états |
| `shared/divins.ts` · `core/divins.ts` | les six Divins — Chronos, le sixième, descend au quiz du jour : le nom, public ; les règles et les légendes, **secrètes**, côté serveur seulement |
| `client/src/components/Divin.tsx` · `divins-peints.ts` | les six Divins, des bijoux peints (or, émail, pierres), chacun sa silhouette, habités de lumière : des rayons qui tournent, une lueur qui respire, un éclat qui glisse sur l'or — le bijou lui sert de masque —, des étincelles ; `transform` et `opacity`, jamais un filtre. Dans une liste, ni rayons ni étincelles ; sur le podium et la carte, à la taille d'un légendaire ; verrouillés, une nébuleuse sans nom, rien de leur bijou |
| `core/inscriptions.ts` | la réserve d'inscriptions des invités, par adresse **et par espace**, plus une large par adresse ; et sa mesure (au refus, à la clôture) qui dira en ligne si l'adresse lue est celle d'un proxy |
| `core/pages.ts` | le souvenir et le bilan, en cours ou archivés, calculés **une fois** pour toute la salle qui scanne le QR : gardés sous une empreinte des journaux (`revision` de chaque registre, `ArchiveStore.revision`, `empreinteDesPages`), la rafale attend la promesse du premier calcul ; compressés une fois, avec leur ETag |
| `core/pouls.ts` | ce que `/healthz` dit de la charge — processeur, boucle, chronomètres, pages, miroir, réserve d'inscriptions —, agrégé, sans un nom, lu sans rien parcourir ; et le ressenti en production : chaque aller-retour vers Turso (`base`, mesuré au seul `fetch` de `distante.ts`) et chaque route d'API sous son modèle — `POST /api/campagne/serie/:id/reponse`, jamais l'adresse (`routes`) —, médiane et 95ᵉ centile (`ressenti.test.ts`) |
| `core/precompresse.ts` | les fichiers du paquet servis tels que le build les a compressés (`.br` en brotli 11, `.gz`), selon ce que le téléphone accepte — la précompression est un greffon de `client/vite.config.ts` |
| `core/http.ts` | ce qu'une erreur laisse lire : `wrap`, `erreurMontrable`, `messagePourEcran`, `erreurDeRequete` |
| `auth/store.ts` | comptes d'animateurs — c'est-à-dire **des espaces** : `accounts.id` EST le `space_id` |
| `auth/profiles.ts` | profils de joueurs (autre table, autre cookie) |
| `auth/profilUnique.ts` | un seul profil (le choix du 3 octobre 2026) : au premier démarrage qui le connaît (`DRAPEAU`, une fois — une base neuve le pose sans rien parcourir), chaque compte d'animateur d'avant, à mot de passe et sans profil, reçoit le sien — même identifiant, même haché (`ProfileStore.adopter`) — et s'y rattache ; un identifiant déjà pris ne se devine pas, l'administrateur le rattache (« Les salons », `POST /api/admin/espaces/:id/titulaire`, qui recopie dans l'espace gardé les quiz du salon que le profil tenait). Les portes de console — `/connexion`, l'écran commun — essaient le profil d'abord (`seConnecter`, `client/src/api.ts`), et « Mon compte » parle du profil dès qu'un profil tient l'espace |
| `auth/profileRoutes.ts` | la porte d'entrée : se connecter à son profil ouvre aussi la console de l'espace rattaché |
| `client/src/views/AdminApp.tsx` · `server/src/profilsAdmin.ts` · `client/src/components/AdminProfils.tsx` · `AdminSalons.tsx` | `/admin`, à la manière de « Mon compte » : un tableau de bord (profils, salons, copies à relire, jours d'avance du quiz du jour), puis une ligne par sujet, chacune son écran à son adresse (`/admin#salons`) et ses feuilles — la campagne comprise (`AdminCampagne.tsx` : ses sentiers palier par palier, sa base, la routine du matin, ses signalements) — plus de création de compte : chacun ouvre son salon par son profil. « Les salons » : tous les espaces, chacun nommé par son titulaire (`/api/admin/espaces`, `estUnSalon`), les renommer, les désactiver, les supprimer une fois désactivés. « Les profils » : les chercher, en supprimer un (`DELETE /api/admin/profils/:id`). La suppression emporte tout ce qui n'était qu'à lui — sa fiche, ses sessions, ses lignes d'expérience, son étagère, ses éclats, ses achats (thèmes, vies), ses parties du quiz du jour et de la campagne, ses épreuves et ses paliers repris (`ProfileStore.supprimer`, `JourStore.oublierProfil`, `CampagneStore.oublierProfil`) ; l'espace qu'il tenait — son salon (`estSalonDuProfil`) ou un compte d'animateur à mot de passe — se détache et reste, pour que les souvenirs des soirées qu'on y a jouées s'ouvrent toujours (l'administrateur le supprime à part, dans « Les salons »). Jamais le profil de l'administrateur, jamais pendant qu'il joue une soirée pas encore close (`soireesPasCloses`), son salon compris : sa clôture le créditerait sous un identifiant disparu. Les archives le nomment pour toujours : le recalcul ne recrédite que les profils qui existent (`idsExistants`), et `profils-admin.test.ts` relit chaque table qui porte un `profile_id` |
| `auth/http.ts` | cookies, adresse du client, et `loginBudgetOf(app)` : la réserve d'essais commune à toutes les portes, où un essai compte comme un échec jusqu'à son jugement ; `refuserLesTeles`, ce qu'une télé branchée ne fait pas |
| `auth/appairage.ts` | brancher la télé : le code court qu'elle affiche, validé depuis une console ouverte, et la session d'une soirée qu'elle en reçoit ; `/attente` dit `perime` dans une réponse, jamais dans une erreur |
| `client/src/views/ProfilApp.tsx` · `components/AccueilDesRoles.tsx` · `components/Pieces.tsx` | l'accueil (`/`), le profil (`/profil`) et la boutique (`/boutique`) : la même page, qui lit son adresse (`VUE`). L'accueil : qui l'on est en une ligne — ses confettis au bout —, lu en léger (`/api/joueur/moi?accueil`, `ProfilDAccueil` : l'en-tête, sa série, son solde, ses sentiers — ses vies et celui qu'il avance, `CampagneStore.accueilDesSentiers`, lus de front ; le détail reste au profil et à la boutique, `jour-charge.test.ts`), puis des gros boutons (`AccueilJouer`) : une soirée où l'on joue déjà d'abord, la campagne (`boutonDeLaCampagne` : le sentier qu'il avance et ses vies ; il ouvre la campagne sur ses sentiers, jamais un sentier seul), le quiz du jour, créer un salon, rejoindre une soirée ; « J'anime » dessous pour qui anime (l'écran commun, ses quiz, son compte). Le profil : cinq tuiles (avatars, style, trophées, carrière, soirées), chacune ouvrant son écran à son adresse (`/profil#trophees`, `ANCIENNES` pour celles d'avant) ; avatars, style, trophées et boutique à la demande (`PanneauxDuProfil`). Sans profil ni console, la porte discrète des animateurs (« J'anime une soirée »). La barre du menu (`MenuBarre` : Accueil · Mes quiz · Profil · Boutique · Compte) sur ces pages, « Mes quiz » et « Compte » — qui s'ouvrent par le profil (`ouvrirParLeProfil`), et dont le Compte parle du profil quand l'espace est le sien (`parLeProfil`) |
| `client/src/views/SalonApp.tsx` · `components/BarreDuChef.tsx` · `socketDuChef.ts` · `chef.ts` | « Créer un salon » (`/salon`) : les quiz de ce soir (le programme), où l'on voit les questions — une télé se branche par son code (`/tele`) —, si le chef joue ou anime seulement — anime seulement, il suit la soirée sur la même interface, sa barre en bas, et répond sans que rien de lui ne compte : ni points, ni journal, ni attente, ni classement (`LancementDeQuiz.horsClassement`, `joueurs()` dans `games/quiz.ts`, redit à chaque `player:join` par son seul téléphone, écouté de lui seul) —, le rythme, les équipes, les points ; puis la barre du chef en bas de son téléphone de joueur, chargée à la demande sur le seul téléphone qui a ouvert le salon (`chefIci`) : le code et son QR, le quiz lancé au programme, la pause, révéler, la suite, et à l'écart, dans « ⋯ », ce qui défait quelque chose — et les équipes : deux d'office, un toucher en renomme une, « Ajouter une équipe » en crée une (`FeuilleDEquipe`, son nom et son emoji). Ses gestes passent par une seconde liaison, celle de l'animateur (`socketDuChef`) — une seule ne tient pas les deux rôles —, et elle ne lit de la vue d'animateur que sa phase (`barre-du-chef.test.ts`). « Ouvrir le salon » le fait entrer dans sa soirée sans « Entrer dans la soirée » (`demanderEntree`, une fois), et une soirée effacée sans rien de joué le ramène à l'accueil, pas à l'entrée (`party:reset`, `client/src/socket.ts` ; `chef-entree.test.ts`). Le dernier quiz joué, sa barre dit « Terminer la soirée », et le podium reste jusqu'à ce geste — rien ne se décompte. Sous sa fin de soirée, une ligne « Ton salon » ouvre sa feuille : « Encore un quiz, avec eux », « C'était un essai » — un seul « Accueil » sur la page |
| `client/src/components/SpaceNav.tsx` | la flèche des pages publiques d'une soirée — le souvenir, le bilan, l'historique de l'espace : ni fil de l'une à l'autre, ni « Accueil » ni « Mon compte » ; chacune s'ouvre d'une liste qui offre les deux (l'historique du compte, la fin de soirée, « Mes soirées », « La dernière soirée ») et la flèche y revient (`retourDesPages`) — ouverte d'un lien ou d'un QR, l'animateur va à son historique, l'invité à l'accueil. Les pas que la page empile (le bilan : un invité, la salle) passent par `pousserDansLaPage`, que la flèche saute (`pages-de-soiree.test.ts`) |
| `client/src/components/HistoriqueDuCompte.tsx` | l'historique de son espace, dans « Mon compte » (`/compte#historique`) : une ligne par soirée — celle en cours d'abord —, son souvenir et son bilan sous chacune, renommer et retirer dans sa feuille ; la flèche ramène au compte, la barre du menu reste. La page publique `/<espace>/soirees` reste, pour les invités |
| `client/src/components/NavAnimateur.tsx` | la barre des pages de l'animateur — Accueil · Écran commun · Mes quiz · Mon compte · Historique · Les comptes —, la même en tête de « Mes quiz », de « Mon compte » et des comptes, la page courante à sa place, sans lien ; l'écran commun a « Accueil » dans la bande de sa salle d'attente, et les pages publiques le donnent à l'animateur de l'espace |
| `client/src/components/Apparence.tsx` · `Trophees.tsx` · `shared/proches.ts` | les onglets du profil : ce que la salle voit, « Mes avatars » en trois familles sur une rangée — Branches, Emojis (ceux de collection dessous), Légendaires (les Divins dessous), chaque partie son titre et son compte —, ouverts sur la famille de ce qu'il porte (`familleDe`) ; les branches en accordéon, la dépliée en tête, les autres sur une ligne — sa catégorie, ce qui manque ; un anneau pour ce qui est rare ; un seul geste pour tous : la case touchée ouvre sa fiche juste sous sa rangée — un légendaire ou un Divin s'y montre en grand, le reflet au doigt (`dessin`, posé par `Apparence` : `Carriere.tsx` est sur le chemin de l'accueil anonyme) —, et l'avatar se porte de là — éclaté, dans sa version rare ou d'origine, au choix (`ChoixDeLEclat`, `eclatsEteints`, la colonne `eteint` de `profile_eclats`) : l'Éclat reste à lui et compte partout, seule l'apparence lit le choix (`brilleChez`, la même règle au serveur et au client) —, « Le porter » — jamais d'un toucher, `grille-avatars.test.ts` y veille —, la finition, le titre ; la vitrine de la carte, qu'on choisit, le quiz du jour, les hauts faits les plus proches (`lesPlusProches`, dérivation pure), la collection de prix (`CATALOGUE_DES_PRIX`, `core/stats.ts`). Un titre et une vitrine ne sont que des hauts faits gagnés (`hautsFaitsGagnes`), relus à chaque affichage (`titrePorte`, `vitrineChoisie`) : une soirée retirée les emporte |
| `shared/avatars.ts` | les avatars de l'inscription et le nettoyage de ce qui arrive du téléphone (`cleanAvatar`, `cleanName`, `tronquer`) ; et les douze emojis de collection (`COLLECTION`), un par niveau sans finition, réservés aux profils — `niveauRequis` lit le niveau qu'un avatar demande, doublé ou suivi d'un sélecteur de variante compris |
| `shared/adresses.ts` · `core/apercus.ts` | une adresse lue une seule fois pour le client et le serveur ; le serveur y pose le statut (404 d'un espace, d'une page ou d'une archive inconnus), les balises d'aperçu (le titre de l'espace, **jamais un prénom**), `noindex` hors de l'accueil, et les seules corrections permises : ce que `normalizeSlug` fait de la saisie (casse, accents, espaces et ponctuation en tirets, 24 caractères au plus), puis la seule forme `chez-‹saisie›` — jamais un nom voisin (invariant 3) |
| `client/src/onglets.ts` | les onglets nommés de la console, et « Revenir à la console » d'une page qu'elle a ouverte — l'accueil compris : jamais une seconde console |
| `sockets.ts` | tout le protocole temps réel — chaque message passe par `ecouter()`, et chaque geste d'animateur relit la session de sa poignée de main (`requireHost`) |
| `shared/events.ts` | le contrat socket, typé des deux côtés |
| `shared/homonymes.ts` | « Camille (2) » : la dérivation pure qui distingue deux invités identiques |
| `shared/classement.ts` | la seule règle des ex æquo : rang partagé, vainqueurs, ordre d'affichage — et l'écart d'une estimation (`ecartEstimation`), les groupes d'ex æquo d'où se lisent les voisins (`groupesDExAequo`), le rang lu par dichotomie (`rangDansLesTries`) |
| `shared/course.ts` · `client/src/games/quiz/Course.tsx` | sa place dans la course, à chaque révélation : « Ce quiz · encore 6 questions », « 5ᵉ place sur 12 · 450 pts ↑ 2 », « À 40 pts d'Hugo » — les bonnes nouvelles seulement, pas de rang à zéro, une phrase pour le lecteur d'écran ; au podium, le podium des équipes, celui des joueurs, puis le classement de tous et leurs points (`classement`, le même pour toute la salle, borné à `CLASSEMENT_DE_FIN`), l'emoji de son équipe à côté de chaque prénom (`PastilleEquipe`), et sa place à la soirée. La même règle au quiz du jour (`placeDuJour`) |
| `shared/teams.ts` | la seule règle des équipes : la moyenne question par question des lignes jouées pour l'équipe — chaque ligne du journal fige la sienne (`team_id`) — (`questionsDesEquipes`, `moyenneAuProrata`) ; les points d'équipe sont cette moyenne, prix en plus (`finalPoints`, plus de points au rang 6-5-4… — le choix du 4 octobre 2026), un prix valant 100 points par défaut (`POINTS_D_UN_PRIX`, `PRIX_MAX`) ; la phrase qui l'explique (`regleDesEquipes`) et l'effet d'un prix avant le clic |
| `shared/nombres.ts` | un nombre tapé par un humain, lu comme on l'écrit en France (« 35 000 », « 0,8 », « −40 ») : l'estimation au téléphone, la cible de l'éditeur, l'import d'une liste — une seule lecture |
| `shared/securite.ts` | la page de retour après connexion : jamais ailleurs que chez soi |
| `shared/erreurs.ts` | les motifs que le client montre quand ça coince (réseau, serveur qui redémarre…), et ce qui passe tout seul (`statutPassager`, `echecPassager`) — à l'inverse, un refus du serveur, qu'on ne retouche pas (`refusDuServeur`, `client/src/api.ts`) |
| `shared/reveil.ts` | une écriture qui attend le réveil de l'hébergeur au lieu d'échouer à vingt secondes (`auReveil`, dans `client/src/api.ts`) |
| `shared/brouillon.ts` · `client/src/brouillon.ts` | le brouillon d'un quiz : ce que l'éditeur garde dans le navigateur tant que le serveur n'a pas enregistré, relu comme le serveur relit (`normalizeQuestions`, `shared/library.ts`) |
| `client/src/components/Entree.tsx` · `IdentifiantDiscret.tsx` | tout ce qu'on traverse entre le scan du QR et la salle d'attente — trois gros boutons d'abord, comme l'accueil sans profil (`ProfilForm`) ; et l'identifiant d'un profil qui naît, déduit du prénom, sur une ligne (« Pour te reconnecter : camille · modifier ») : pris par un autre, il prend celui que le serveur propose (`inscrireAvecRepli`), jamais s'il a été tapé à la main |
| `client/src/components/Liaison.tsx` | ce que voit l'invité quand la liaison tombe |
| `client/src/components/Absents.tsx` · `Reprendre.tsx` | le téléphone perdu : « Qui manque ? » à la console (ne plus l'attendre, rendre sa place), et le code tapé par l'invité |
| `client/src/components/Coupe.tsx` | une liste de l'écran commun coupée à ce qui tient, « et 2 autres » dessous : personne ne fait défiler une télé |
| `server/scripts/rendu-ecran.ts` | le pire cas de l'écran commun, rejoué sur un serveur jetable et photographié à chaque phase en 1366 × 768, 1920 × 1080 et au téléphone (`MESURE=1` : ce qui ne grandit pas en 1920) |
| `server/scripts/sauvegarde.ts` | la sauvegarde SQL de la base permanente, restaurable par `turso db shell` |
| `server/scripts/empaqueter.ts` · `server/src/racine.ts` | le serveur en un seul fichier (`server/dist/index.mjs`), que `npm run build` construit avec le client et que la commande de démarrage lance sans tsx — un réveil de l'offre gratuite ne traduit plus le TypeScript ; et `SERVEUR`, d'où se compte tout chemin du serveur |
| `server/scripts/calibrage.ts` | combien de quiz demande chaque légendaire, combien de soirées chaque niveau, et la rareté de chaque haut fait (que `PART_DES_JOUEURS` recopie) : des bandes d'amis inventées jouent des soirées entières sur le vrai code des hauts faits et de l'expérience (`npx tsx scripts/calibrage.ts`, format réglable) |
| `server/scripts/anime/styles.ts` · `gemini.ts` · `consignes.ts` · `athena-croquis.svg` | un style d'image par branche, essayé sur sa forme ultime en illustration complète — la planche dans le cadre du sixième palier, le coût estimé de chaque image (`journal-styles.json`, pour tenir le budget), Athéna d'après le prototype de l'artifact (`athena-croquis.svg`) ; le client Nano Banana (un appel, ou un lot à moitié prix qui se reprend par son nom) ; et les consignes : le style de chaque branche et son échelle, les sujets, ce que chaque découpe garde et retire |
| `server/scripts/anime/portraits.ts` · `pixels.ts` · `livrer.ts` | la chaîne des portraits peints : le visage sur un fond uni (magenta pour qui porte du vert), puis une illustration entière par palier, et sa découpe — le personnage repeint sur un fond uni, qui en donne la forme — ; la forme ultime est l'image validée par l'essai des styles. Deux passes en lot, un journal des coûts (`journal-portraits.json`), un `⚠` sur la découpe qui ne retombe pas sur son illustration ; `--regenerer` et `--redecouper` repaient, l'ancienne image mise de côté. `pixels.ts` détoure, aligne et assemble dans Chromium ; `livrer.ts` pose les fichiers sous leur empreinte et réécrit le module de la branche. Le filtre de Google refuse ce qui ressemble à un personnage protégé (`PROHIBITED_CONTENT`, Thor) : la consigne en garde la trace |
| `server/scripts/anime/legendaires.ts` · `server/scripts/planche-medaillons.ts` | la chaîne des légendaires et des Divins peints : pour chaque légendaire, son illustration (une créature colossale dans sa scène, la feuille d'or que la pellicule attrape), sa version rare repeinte sur la même pose et sa découpe ; pour chaque Divin, son bijou sur un fond uni (magenta pour l'Arbre-Monde et ses feuilles d'émeraude). En lot, un journal des coûts (`journal-legendaires.json`), un `⚠` sur la découpe douteuse ; `--regenerer`, `--rare` et `--redecouper` repaient, l'ancienne image mise de côté ; `--livrer` pose les fichiers sous leur empreinte et réécrit `legendaires-peints.ts` et `divins-peints.ts`. Le modèle peint parfois un cadre de carte autour de l'illustration : le disque le laisse dehors, et la consigne du Fantôme le lui interdit en toutes lettres. La planche les photographie tous, dans tous leurs états et sur le podium, sous la vraie feuille de style, en Velours et en Ivoire |
| `server/scripts/anime/decors.ts` · `client/src/components/calendrier-peint.ts` · `server/scripts/rendu-themes.ts` | les décors peints : les douze pages du Calendrier des Heures et leur dorée (repeinte sur la même composition), les quatre thèmes peints (l'Horloge astronomique — un cadran repeint en deux temps, ses aiguilles et ses engrenages détourés et recentrés sur leur pivot —, le Ciel du jour en quatre lumières du même paysage, le folio des Très Riches Heures, le Sommet et ses drapeaux) et les fonds du Triomphe et du Cadran solaire. Rien ne se paie sans `--groupe`, `--seulement` ou `--tout` ; un journal des coûts (`journal-decors.jsonl`) et un budget (`BUDGET`) ; `--livrer` pose les fichiers dans `client/public/decors` sous leur empreinte (`/decors`, servis un an), écrit `calendrier-peint.ts` et réécrit le bloc de chaque feuille qui les cite. L'heure de Paris que lisent l'Horloge, le Ciel et les Heures (`data-ciel`, `data-mois`, les angles des aiguilles) vient de `themeJoueur.ts`, une fois par minute, seulement sous ces trois thèmes (`decors-peints.test.ts`). `rendu-themes.ts` photographie un thème dans l'application à l'heure voulue et mesure le contraste de chaque ligne sur ce qui est peint derrière elle |
| `server/scripts/tablee/regie.ts` · `pilote.mjs` | la tablée : un serveur jetable, un Chromium, et les gestes des agents qui y jouent une soirée — ou plusieurs à la fois, un salon par animateur (`chez <animateur>`) — la marche à suivre, les personnages, les experts et leurs consignes dans `.claude/skills/tablee/` (`/tablee`) |
| `retours/<date>/synthese.md` | ce qu'une tablée a trouvé : les axes d'amélioration, vérifiés un à un, et les retours bruts des agents — à lire avant de retoucher un écran qu'ils citent. Un audit de code y range aussi tous ses constats et leur verdict (`constats.json`) et les épreuves qui les prouvent (`reproductions/`) : `retours/2026-09-27/` pour #58 et #59 |

## Les invariants — à ne jamais casser

1. **La logique de jeu est 100 % serveur.** Les clients reçoivent
   `playerView` / `hostView`, jamais l'état brut : sinon la bonne réponse
   arrive dans le téléphone avant la révélation. Ce qui la trahit aussi :
   l'anecdote, la photo de la révélation, les bonnes réponses de
   « plusieurs » et le bon ordre n'arrivent qu'à la révélation ; la note de
   l'animateur, l'extrait d'un blind test et le programme de la soirée ne
   partent jamais aux téléphones.
2. **Deux bases, deux rôles.** La locale (SQLite) est **jetable** et « Nouvelle
   soirée » la vide. Ce qui doit survivre — comptes, quiz, archives, profils —
   va dans la permanente (libsql/Turso).
3. **Tout est cloisonné par `space_id`.** Un identifiant qui n'est pas du sien
   vaut « introuvable », et le voisin n'en sait rien.
4. **L'instantané est dédoublonné et regroupé** (`space.ts`). N'y mets jamais
   un champ qui change à chaque tick : il partirait à toute la salle. Il en
   part deux versions, chacune dédoublonnée : celle des écrans d'animateur,
   qui porte en plus le wifi, la scène et la télécommande
   (`enPlusPourLesEcrans`) — la salle ne reçoit rien quand seule la scène
   change —, et celle des téléphones, **sans `connected`**
   (`pourLesTelephones`) — une veille d'écran ne repart qu'à l'écran commun. Le regroupement des
   téléphones grandit avec la salle (120 ms + 2 ms par invité), celui des
   écrans communs reste à 120 ms ; et celui qui fait le geste (`join`,
   `setTeam`) reçoit le sien sur-le-champ — au `join`, une fois compté dans
   la partie et avant sa première vue. Ce qui change la salle sans veille
   (réglages, parures, un prénom) diffuse de lui-même : la veille des autres
   ne le porte plus.
5. **Les chronomètres sont persistés** et réarmés au redémarrage.
6. **Une échéance se lit à `serverNow()`**, jamais à `Date.now()` : l'horloge
   d'un téléphone dérive, et on a déjà perdu des réponses pour ça. Elle
   saute aussi : deux mesures qui ne peuvent pas être vraies ensemble font
   gagner la plus récente, même plus lente (`bestSample`, `shared/clock.ts`).
7. **Toute réponse d'invité reçoit un accusé**, et **tout message d'un client
   passe par `ecouter()`** (`sockets.ts`) : la charge devient un objet,
   l'accusé une fonction, l'exception un journal. Un seul `player:action` sans
   charge, un seul `party:watch` sans accusé tuait le processus — et les
   soirées de tous les espaces avec.
8. **Un profil ne donne aucun avantage de jeu**, et un invité anonyme
   n'affiche **rien** : ni « Niv. 0 », ni pastille grise. L'absence, pas
   l'infériorité. Un profil reconnu, en revanche, **ne rechoisit jamais** son
   prénom ni son avatar : `player:join` sans `name` ni `avatar` les prend
   dans le profil.
9. **La fiche du serveur fait foi.** Un `player:join` qui porte un jeton est
   une re-présentation : prénom et avatar envoyés sont ignorés — sinon le
   renommage d'un pseudo par l'animateur tombait au réveil du téléphone. Le
   second appareil d'un profil déjà là, sans jeton, ne redéclare pas non
   plus le prénom de sa fiche — seulement son avatar, que l'animateur ne
   change pas. Un
   jeton qui ne désigne plus personne (exclu, essai effacé) est refusé
   (`unknown-token`), **jamais recréé** : le téléphone repasse par l'entrée,
   pré-remplie. Celui d'une soirée qu'on vient de clore reçoit sa fin de
   soirée (`soiree-close`) — que le téléphone n'affiche que réveillé sur la
   page où il jouait : arrivé pour jouer, il la garde pour l'entrée
   (`recevoirFinRendue`) ; après un redémarrage qui l'a oubliée, un
   `unknown-token` qui porte la soirée close à revoir (`derniere`). Un
   nouveau téléphone ne prend le jeton d'une fiche que par le code que
   l'animateur fait paraître (`player:reprendre`), jamais sur un prénom
   retapé.
10. **L'expérience d'un quiz se crédite dès qu'il rend son verdict** (son
    podium s'affiche), à la fin de la partie si quelque chose a changé depuis
    (`dernierCredit`, l'empreinte des gains arrivés en base), puis une
    dernière fois à la clôture, toujours, avant tout effacement. C'est
    l'idempotence qui le permet : la ligne `(profil, soirée)` est remplacée,
    jamais ajoutée. Un invité **exclu** rend la sienne, et l'Éclat tiré ce
    soir-là (`exclure()`, à la file des crédits) : le crédit suivant ne
    réécrit que les profils encore là — et la clôture reprend ce qu'un
    hoquet de la base aurait laissé à l'exclu (`retirerAbsents`). Ce qui ne se juge qu'une fois tout
    joué — le podium de la soirée, l'assiduité, les **prix** du palmarès, les
    **hauts faits**, les **paliers** de carrière — ne se décide **qu'à la
    clôture** (La Légende, qui ne lit que le niveau, se juge aussi au quiz
    du jour), en un seul lot (`remplacerRecompensesDeSoiree`) : un
    rangement à mi-soirée ne fige rien. Un palier ne se reprend que si la
    soirée qui l'a fait tomber est retirée (essai effacé, soirée supprimée de
    l'historique) — et tout ce qu'elle avait rapporté part avec elle.
11. **Le nom d'une soirée se tire une fois** (`soireeEnCours`) et ne se
    recalcule jamais : exclure le premier arrivé ou redémarrer ne le change
    pas, seules la clôture et l'essai effacé l'oublient (`viderSoiree`).
    Toute écriture permanente sous ce nom passe d'abord par `recopierSoiree`.
    Recalculé, il comptait l'expérience deux fois et dédoublait l'archive.
    Il se date à sa **première question jouée** (`soireeDesInvites`, l'heure
    de la révélation au journal), jamais avant : l'invitée revenue relire la
    veille, ou le QR testé la veille, datait sinon la soirée suivante de
    l'arrivée d'un invité, pour toujours.
12. **Un geste dit ce qu'il visait.** Les commandes `next`, `cancel`, `replay`
    et les réponses portent la phase, la question et le tour (`host:scene`,
    l'écran qu'il quittait ; `host:launch`, la partie qu'il remplace) : une commande
    périmée est ignorée en silence, une réponse périmée reçoit `too-late`, et
    un champ absent (une page d'avant) garde l'ancien comportement. Sans ça,
    un « Révéler » qui croisait la révélation automatique sautait la
    révélation.
13. **Rien ne se perd en route vers le miroir.** Chaque écriture de la soirée
    rejoint la file de son espace, ordonnée, qui insiste jusqu'au succès ;
    gains et réponses portent un `uid` tiré en local, pour un rejeu sans
    doublon ; un `run()` envoie l'état de la partie **avec** ses gains et ses
    réponses, en un seul lot (`ouvrirLot` / `fermerLot`) — sinon un arrêt
    brutal faisait payer une question deux fois. La clôture efface le miroir
    **avant** la base locale.
14. **Les dérivations restent pures.** La soirée en cours et une archive
    passent par le même chemin — une amélioration profite aux soirées passées.
15. **Un classement passe par `shared/classement.ts`.** Rang = 1 + le nombre
    de concurrents strictement devant ; tous les ex æquo en tête gagnent.
    Cinq règles de départage différentes donnaient trois vainqueurs à un même
    quiz. Deux estimations se comparent par `ecartEstimation`, jamais par
    `Math.abs(valeur - cible)` : la virgule flottante séparait 0,7 et 0,9
    pour 0,8, et le barème au rang payait l'un 200 points et l'autre 30.
16. **Une personne, deux tables — et `accounts.id` ne bouge jamais.** Un
    compte est un **espace** (slug, réglages, et l'identifiant qui cloisonne
    tout le reste) ; un profil est une **personne** (prénom, avatar,
    expérience). `accounts.profile_id` dit qui tient l'espace : se connecter
    à son profil ouvre alors la console sans rien redemander, et la
    déconnexion la referme — mais seulement celle que CE profil avait
    ouverte : chaque session d'animateur retient le profil qui l'a ouverte
    (`auth_sessions.profile_id`), et toutes celles-là tombent quand son mot
    de passe change, que son code de secours sert ou qu'il perd l'espace —
    détaché, ou remplacé par un autre profil —, sauf la console d'où l'on
    fait ce geste. Celles du mot de passe du compte ne bougent pas : c'est
    l'écran commun de la soirée. Une télé branchée par un code d'appairage
    hérite de la porte de la console qui l'a validé (`auth/appairage.ts`) :
    elle tombe avec ce profil, ou tient comme l'écran commun — et jamais
    plus de 24 heures (`fin_max`, qui plafonne le glissement), même sans
    avoir décroché : chaque geste relit la session. Pour poser
    le lien, il faut prouver les deux identités — le profil ouvert sur ce
    navigateur n'y redit pas son identifiant, son mot de passe le confirme ;
    après, une seule porte suffit — seul l'administrateur rattache sans
    preuve, pour fusionner deux identités d'avant (`auth/profilUnique.ts`).
    Pour le changer ou le détacher, une preuve fraîche — le mot de
    passe du profil rattaché, ou celui du compte (`prouver`) —, et jamais
    depuis une télé branchée (`refuserLesTeles`) : le téléphone prêté y
    rattachait l'emprunteur, qui gardait la console. Ne fusionne pas les
    deux tables : l'identifiant d'un compte est la clé de partition de dix
    tables et de toutes les archives.
17. **Les homonymes se règlent à l'affichage, jamais à la saisie.** On ne
    refuse personne et on ne renomme personne : `nomsAffiches()` marque
    « Camille (2) » quand le prénom **et** l'avatar sont partagés, et cette
    marque n'est **jamais** écrite en base — elle s'efface d'elle-même quand
    l'homonyme s'en va. Un prénom sort par trois portes (`publicPlayers`,
    `publicOne`, `ViewContext.playerName`) : c'est la troisième qu'on oublie,
    et c'est elle qui écrit sur le vidéoprojecteur.
18. **L'historique s'écrit tout seul, et la soirée n'a qu'un geste de fin.**
    Elle se range après chaque quiz (`apresQuiz`) ; `host:closeParty` la clôt
    — dernier rangement, crédits de clôture, fin de soirée à chaque téléphone
    et à la salle, puis la page blanche. Pour un salon ouvert depuis un
    téléphone (`SalonStore.clotureAuto`), le verdict du dernier quiz de son
    programme n'arme rien : il annonce la fin du programme
    (`considererCloture`, `finDuProgramme` dans l'instantané), et la barre
    du chef propose « Terminer la soirée » — le podium reste jusque-là, c'est
    l'animateur qui l'enlève (le choix du 4 octobre 2026) ; un quiz relancé
    ou un programme allongé la défait, et « Terminer le quiz » sur le
    dernier clôt tout de suite ; `host:discardParty` efface un essai
    avec tout ce qu'il avait crédité. **Une seule fin à la fois**
    (`finEnRoute`) : un second « Clore » attend le premier et en reçoit
    l'issue, le geste contraire est refusé — deux clôtures croisées
    recréditaient, réannonçaient au podium vide et effaçaient l'invité entré
    entre les deux. Ce que la clôture raconte se relit en base
    (`rangesSousLaSoiree`) : reprise après un refus du miroir, elle se taisait
    sur ce que la tentative d'avant avait rangé. La fin de soirée ne part
    **qu'une fois la soirée effacée** : un miroir qui refuse d'effacer ne doit
    pas faire lire « c'est fini » à une soirée qui continue. `host:resetParty` et
    `host:archiveParty` restent compris des pages d'avant. Entre deux
    soirées, `recap.json` et `bilan.json` désignent la dernière soirée close
    (`derniere`), que le souvenir et le bilan de l'espace montrent à sa place
    (`lecteurDePage`) — sans redirection : la page revient d'elle-même à la
    suivante dès sa première question jouée.
19. **L'expérience se mérite, et ne redescend jamais en cours de soirée.**
    En soirée, rien pour la présence, rien seul : tout se gagne dès deux
    joueurs, un podium de quiz à cinq questions, celui de la soirée à quinze
    (`SEUILS`), et un podium a toujours une marche de moins que la salle — le
    quiz du jour, lui, se joue seul, et son expérience s'arrête à 75.
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
21. **Les règles des Divins ne quittent jamais le serveur.** Elles vivent
    dans `core/divins.ts`, avec leurs légendes — qui en disent presque
    autant —, et ni `shared/` ni `client/` ne l'importent ni n'en recopient
    une ligne (`divins.test.ts` y veille). Le serveur n'envoie que la liste
    des Divins descendus, le récit à leur seul porteur — pas de jauge, pas
    de progression, pas de ligne d'étagère (`badgesOf` les écarte), pas même
    un compte de badges qui bougerait. Un Divin ne prend ni finition ni
    Éclat.
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

## Les conventions

- **Commentaires en français**, et ils disent **pourquoi**, pas *quoi*. Un
  commentaire qui paraphrase le code est du bruit ; un commentaire qui raconte
  la décision ou le bug évité vaut de l'or. C'est la marque du dépôt : garde-la.
- Noms : anglais pour l'infrastructure historique (`Party`, `ScoreLedger`),
  français pour le domaine récent (`Finition`, `niveauPour`, `Carriere`).
- **Très peu de dépendances**, et c'est voulu. N'en ajoute pas sans raison forte.
- **Emojis antérieurs à Unicode 13 uniquement** : l'écran commun tourne sous
  Windows 10, les plus récents s'y affichent en carré vide (`emojis.test.ts`
  y veille, pour `client/`, `shared/`, `server/src/` et les quiz livrés de
  `server/content/`).
- Les messages d'erreur sont lus par des invités dans le noir : courts, en
  français, et ils disent quoi faire.
- **Une erreur faite pour être lue se lève avec un `new Error('…')` nu**, sans
  `code`. Toute autre classe (LibsqlError, TypeError…) devient un 500 neutre
  dans une route (`repondreErreur`) ou « Erreur serveur » dans un toast de
  l'écran commun (`messagePourEcran`), et son détail part au journal.
- **Un texte se coupe avec `tronquer()`** (`shared/avatars.ts`), jamais avec
  `slice()` : un emoji à la frontière laissait sa moitié en base.
- **Un nombre tapé se lit avec `lireNombre()`** (`shared/nombres.ts`), jamais
  avec `Number()` : « 35 000 » valait NaN au téléphone, et l'éditeur, qui
  relisait sa cible à chaque touche, faisait 8 de « 0,8 ». Le champ garde le
  texte tapé ; seule la valeur lue part en base. Un entier borné se tape dans
  `ChampNombre` (`client/src/components/`) : vidé, `Number('')` valait 0, la
  valeur revenait, et le 45 tapé derrière faisait « 2045 » — les bornes
  s'appliquent en quittant le champ, jamais à chaque frappe.
- **Une précision ne compte que les QCM, et dit sur combien** (« 50 % ·
  1 sur 2 QCM ») : une estimation n'est jamais « juste », et comptée au
  dénominateur elle faisait lire « 1/64 justes ». **Une estimation se juge
  au coup d'œil** (`coupDOeil`, `core/journal.ts`) — la part de la salle
  qu'elle bat ou égale —, jamais à l'écart en pour cent : trois ans sur 1994
  font 0,15 %, trois sur 54 en font 6 %, et une faute de frappe triplait la
  moyenne. Les deux ne se fondent jamais en un seul chiffre.
- **Ce qui ne dépend pas du destinataire d'une vue** — un classement, un
  podium — passe par `vctx.memo` : un tri par vue coûtait une demi-minute par
  question à 500 invités. Et **une réponse ne recalcule que deux vues** —
  la sienne et celle de l'écran commun — parce que le quiz le promet
  (`vueDependDesAutres: false`) : une vue de téléphone qui lirait la réponse
  d'un autre en pleine question doit retirer cette promesse.
- **Côté client** : `--accent-text` pour ce qui s'écrit, `--accent-text-hover`
  pour son survol, `--accent` pour les aplats (le contraste d'Ivoire en
  dépend) ; les trois métaux d'un palier écrivent en `--bronze-text`,
  `--argent-text` et `--or-text` ; aucun texte ne descend sous `--t-label`
  (11 px, celui de `.label`, en `rem` pour suivre le texte agrandi), les
  petites boîtes prennent `--radius-xs`, et l'or du décor des fonds se lit
  dans `--fond-or`, posé sur `.carte-fond` (`design.test.ts` y veille) ; le
  focus n'a qu'un anneau, `--focus`, posé une fois pour tout
  élément (`:where(…):focus-visible`) — un composant n'en règle que
  l'`outline-offset` ; tout accès au stockage du
  navigateur sous try/catch — des cookies bloqués donnaient une page noire.

## Les deux environnements

Deux services Render : la production (déployée à la main) et la
préproduction (déployée à chaque fusion sur `main`). Ils ne diffèrent que par
`QUIZ_DB_URL` — tout le précieux est dans Turso, la base locale est jetable.
Les services ont été créés à la main : c'est leur tableau de bord qui fait
foi, commandes de build et de démarrage comprises, et `render.yaml` n'en est
que la référence. Leur commande de démarrage lance le paquet (`cd server
&& exec node dist/index.mjs`) ; l'ancienne, `node --import tsx
src/index.ts`, marche toujours — un service qui n'est pas encore passé au
paquet, ou le repli.

**Les noms** : `fiestapp-quizz` (production) et `fiestapp-quizz-preprod`,
les mêmes que dans `render.yaml` — les services ont été renommés. L'adresse
`onrender.com` d'un service, elle, se fixe à sa création : le renommer ne la
change pas, le recréer si, et c'est elle que portent les QR imprimés. Ne
synchronise aucun blueprint : Render n'adopte pas un service créé à la main,
il en créerait des copies à de nouvelles adresses (MISE-EN-LIGNE.md, étape 7).

**La veille** : l'offre gratuite endort un service après 15 minutes sans
trafic entrant — les sondes de Render n'en sont pas. Une tâche de
cron-job.org, hors du dépôt, appelle `/healthz` en production toutes les dix
minutes, de 7 h à minuit (Paris), après le réveil de 6 h 55 : la routine
Claude Code de la réserve du quiz du jour, tous les jours, dont la première
requête attend le réveil — un appel coupé à trente secondes ne réveille
rien, et le workflow GitHub qui s'en chargeait arrivait toujours trop tard.
La production ne dort plus que la nuit, la préproduction dès qu'on la
laisse, et chaque réveil reste un démarrage. Le rappel du soir compte
dessus : à 18 h, la production est debout. Jamais 24 h/24 ni en
préproduction : les 750 heures gratuites du mois sont communes aux deux
services, et le quota épuisé les suspend tous jusqu'au 1er
(MISE-EN-LIGNE.md, étapes 5 et 8).

**Jamais la même base Turso pour les deux** : un « C'était un essai » en
préproduction effacerait de vraies soirées archivées. Hors production,
`APP_ENV` pose un bandeau sur toutes les pages (injecté dans `index.html` par
`server.ts`, affiché par `main.tsx`). En ligne, le serveur refuse de démarrer
sans `QUIZ_DB_URL`.

## Les pièges de ce dépôt

- **`smoke.ts` est stateful de bout en bout.** Une soirée jouée insérée au
  milieu casse les assertions d'après (statistiques, bilan, archives). C'est
  pourquoi les nouveaux tests vont dans `server/test/`, un serveur jetable par
  fichier ; ceux qui vivent encore en fin de smoke (sections 32 à 35) y ont
  chacun le leur.
- **Un fichier de tests a deux minutes, pas seulement une épreuve** : sous
  Node 22, `--test-timeout` (120 s) vaut aussi pour le fichier entier, et la
  CI est plus lente qu'ici. Dix-sept épreuves à serveur jetable dans
  `cloture.test.ts` l'ont dépassé (« test timed out after 120000ms » sur le
  fichier) : un fichier qui approche la minute et demie se coupe par thème
  (`credits.test.ts`), sans rien changer à ses épreuves.
- **Le serveur envoie l'instantané juste derrière l'accusé** de `host:hello`
  ou de `party:watch`, souvent dans le même paquet : un écouteur posé après
  avoir attendu l'accusé le rate. `banc.ts` retient le dernier pour ça
  (`instantane()`).
- **Le démarrage ouvre ses magasins de front** (`deFront`, `server.ts`) :
  après les comptes, le miroir, les profils, le quiz du jour, la
  bibliothèque, les programmes, les partages et l'historique partent
  ensemble — soixante allers-retours en série faisaient trois secondes à
  chaque réveil. Un magasin qui aurait besoin d'un autre s'ouvre après lui,
  dans la même branche ; ce qui les relie (`profiles.statsDuJour`, le
  laurier) se branche après. Un échec ne remonte qu'une fois toutes les
  branches arrivées au bout (`demarrage.test.ts`).
- **Un chemin du serveur se compte depuis `SERVEUR`** (`src/racine.ts`),
  jamais depuis l'`import.meta.url` d'un module : le serveur empaqueté n'est
  qu'un fichier, `dist/index.mjs`, et `seed.ts` y cherchait les quiz livrés
  hors du dépôt — ni amorce, ni modèles, ni réserve du jour, et pas une
  erreur. `exploitation.test.ts` démarre le paquet.
- **Un serveur qu'on ferme doit éteindre ses chronomètres** et vider son
  miroir avant de fermer la base locale, que la resynchronisation relit.
  Un chrono de question qui sonne après `close()` révèle sur une base fermée —
  c'est ce que fait `GameEngine.stop()`. Allonger le smoke suffit à réveiller
  ce genre de fantôme : le symptôme (« The database connection is not open »)
  ne désigne jamais la section qui l'a déclenché.
- **Pas de `socket.on` direct pour un message client** : `ecouter()` le fait
  pour toi, charge normalisée et accusé optionnel compris. Côté client,
  `watchParty` et `helloHost` rejettent sur délai (`demander`), alors que
  `joinAsPlayer` et `setMyTeam` résolvent un refus. Un geste de la partie
  part par `envoyerCommande` (accusé, sonde, un renvoi — il porte sa
  visée), une réponse sonde la liaison avant son renvoi (`verifierLiaison`
  rend la sonde en cours), et un prix se remet avec l'identifiant de son
  geste (`remise`, `client/src/remise.ts`) : un double clic ne le remet
  qu'une fois.
- **`loginBudgetOf(app)`, jamais `new LoginBudget()`** : toutes les portes qui
  ouvrent une console partagent la même réserve d'essais. Et tout essai
  qu'`allow(ip, clé)` accepte se juge — `failed`, `succeeded`, ou `abandon`
  pour une saisie refusée avant le hachage, sorties anticipées comprises :
  jusque-là il vole, compté comme un échec — lu avant scrypt et compté
  après, le verrou laissait passer vingt essais partis ensemble. Une
  session s'ouvre sur le haché qu'on a vérifié (`verifier`) : un
  changement de mot de passe parti entre-temps la referme. Celle des
  inscriptions d'invités, elle, se compte **par espace**
  (`core/inscriptions.ts`) : commune à tout le serveur, la vague d'une salle
  fermait la porte à la salle voisine derrière la même box.
- **Le nom d'une soirée porte une empreinte de son espace** (`archiveIdOf`),
  mais les soirées d'avant n'en ont pas : l'expérience, les paliers et les
  Éclats se rangent sous le nom seul, alors une soirée se désigne par
  `(espace, nom)` partout où l'on en compare plusieurs (`cleDeSoiree`). Et un
  palier ne compte que les soirées closes : `accorderPaliers` écarte celles
  qui se jouent encore ailleurs — leurs lignes, leur expérience dans le
  niveau et leurs Éclats (`careerOf`) —, mais compte celles dont la clôture
  est en cours (`cloturesEnCours`).
- **Reprendre une soirée aux profils** — un essai effacé, une soirée retirée
  de l'historique — se fait en un seul lot (`retirerSoireeEntiere` : les
  lignes, la ligne des paliers et les totaux ensemble), l'archive en
  dernier : effacée d'abord, une panne au milieu laissait ce que la soirée
  avait crédité sans plus aucun geste pour le reprendre.
- **Les crédits lisent les journaux avant le premier `await`** et passent par
  `enFile` : une clôture cliquée pendant un rangement viderait sinon ce
  qu'ils lisent. Les profils s'y créditent huit à la fois (`enParallele`),
  qui attend qu'ils aient tous fini, échec compris : un crédit qui écrirait
  encore après avoir rendu passerait derrière le travail suivant de la file.
- **Le va-et-vient d'une question attend** : l'écran commun reçoit le
  compteur de réponses quatre fois par seconde au plus (le dernier compte
  toujours), et l'état d'une simple réponse s'écrit à la fin du tour de
  boucle (`persistBientot`) — `stop()` écrit celui qui attendait. Les
  téléphones qui tombent et reviennent passent par la même fenêtre
  (`rafraichirAnimateur`), qui compte depuis le dernier calcul, parti ou
  non : une vague de reconnexions à la révélation recalculait sinon la vue
  deux fois par téléphone. Un test qui lit le compteur ou les « hors
  ligne » de l'écran commun attend la vue qui porte le bon état, pas la
  suivante.
- **L'Éclat est un tirage** (une chance sur quarante) et le premier fait
  tomber un palier de carrière : un test qui compte l'expérience au point
  près après une clôture neutralise `ProfileStore.tirageEclat`, sinon il
  échoue une fois sur quarante. **Le calendrier aussi** : une soirée se date
  à l'horloge de la machine, et close pendant Halloween, Noël ou le Nouvel
  An, elle ouvrait son légendaire de saison — la CI rougissait dix-neuf
  jours par an. `banc.ts` et `smoke.ts` ferment donc le calendrier des
  soirées (`calendrierDesSoirees`, `core/saisons.ts`) ; un test qui date ses
  soirées lui-même le rouvre (`saisons.test.ts`).
- **Un joueur seul ne rapporte rien.** Un test qui veut de l'expérience
  invite un figurant au moins (`figurants()`, `faux()` dans
  `soiree.test.ts`) ; un test de hauts faits, quatre joueurs au moins. Et
  deux bonnes réponses font un réflexe au plus rapide, à la milliseconde
  près : un test qui compte l'expérience au point près fait se tromper
  l'autre.
- **Une colonne de plus au journal des réponses** se pose dans trois
  fichiers : `addColumn` dans `db.ts` (la locale) ; `COLUMNS`, l'insertion
  et `toRow` dans `answers.ts` ; `ajouterColonne` (le miroir), l'écriture
  (`SQL.reponse`, `ligneReponse`) et la restauration dans `backup.ts`. Une
  seule oubliée, et la colonne se perd au premier réveil sur disque effacé.
- **Toute mutation de `Party` qui touche un prénom, un avatar ou la
  composition invalide le cache des marques** d'homonymie.
- **L'avatar d'un profil se lit par `avatarPorte`**, jamais par
  `profil.avatar` : un emoji de collection au-dessus de son niveau (une
  soirée retirée l'a fait redescendre) ne se montre pas. Et un avatar
  n'entre dans une soirée que par `player:join`, qui demande
  `peutPorter` sur l'avatar **nettoyé** (`cleanAvatar` : ni demi-paire, ni
  emoji d'Unicode 13) : l'invité anonyme n'y porte aucun emoji de
  collection. La fiche de la soirée se relit ensuite à chaque diffusion
  (`Party.relireAvatars`) : un niveau qui redescend en pleine soirée lui
  rend l'avatar du profil, marques d'homonymie refaites. Ce que la salle
  voit de lui — légendaire, finition, Éclat — passe par une seule règle,
  `ProfileStore.badgeDe`, que l'instantané lit en mémoire et que les pages
  d'une soirée archivée lisent aussi, leurs profils chargés d'un coup
  (`byIds`) : l'archive ne garde que l'emoji de l'inscription, et le bilan
  montrait un emoji à qui portait un légendaire. Le souvenir et le bilan
  n'en recopient que l'avatar (`apparenceDeLAvatar`) : ni niveau, ni
  laurier, qui mentirait sur une soirée d'il y a un mois.
- **L'éditeur n'envoie rien pendant qu'on écrit** : le serveur s'endort sous
  les doigts de l'animateur. Une écriture de l'éditeur qui se rejoue sans
  dommage passe par `auReveil` ; et une réponse qui arrive après deux minutes
  d'attente ne remplace l'éditeur que si rien n'a bougé depuis
  (`modifications`). L'envoi d'une photo n'y passe pas, et elle rejoint sa
  question par son identifiant (`changerParId`) : par sa position, elle
  tombait sur la voisine qu'on avait déplacée entre-temps. « Enregistrer » envoie
  la version d'où il part (`base`), un `jeton` que ses essais au réveil
  reprennent et le numéro de l'essai (`essai`) : le serveur répond 409 si le
  quiz a été enregistré ailleurs depuis — l'autre appareil —, jamais à un
  essai rejoué de son propre clic. Il enregistre un quiz à la fois, et un
  essai plus ancien que le dernier écrit ne réécrit rien : il rend le quiz
  en base.
- **Un réglage de plus à la liste collée** se lit dans
  `parseImportedQuestions`, s'annonce dans `FORMAT_DE_LISTE` et paraît dans
  son exemple, que `liste.test.ts` relit : le format copié pour une IA ne
  doit rien promettre que la liste ne sache lire. Et « Copier en liste »
  (`ecrireListe`) écrit ce qu'elle relira à l'identique : une ligne que la
  relecture lirait autrement prend une puce qu'elle retire
  (`ligneDeReponse`) — « - de 5 » perdait son signe.
- **La bibliothèque en mémoire se relit après chaque écriture** d'un espace
  (`refreshLibrary`, `server.ts`), et c'est elle que « Lancer » joue. Deux
  écritures lancent deux relectures, qui reviennent de Turso à leur rythme :
  seule la dernière partie pose ce qu'elle a lu (`derniereRelecture`) —
  sinon la plus ancienne, revenue la dernière, remettait la version d'avant
  la correction. Le programme et la mémoire des quiz passent par la même.
- **Une question a trois pièces à part** — sa photo, celle de la
  révélation, l'extrait d'un blind test (`PIECES_DE_QUESTION`,
  `shared/library.ts`) —, chacune sous une adresse `/media/image/…`. Ce qui
  emporte une question — l'export, un code de partage, le catalogue — les
  emporte toutes, et ce qui les vérifie — la reprise d'un brouillon — les
  vérifie toutes : la photo de la révélation oubliée restait l'adresse de
  l'autre espace, et partait au premier ménage du sien. Une quatrième pièce
  rejoint cette liste. Le ménage n'efface une pièce qu'une heure après
  qu'aucun quiz ne la cite plus (`orpheline_depuis`, posé par
  l'enregistrement qui la retire) : comptée depuis son envoi, la grâce
  laissait « Garder la mienne », sur l'autre appareil, citer une photo
  effacée.
- **Une variante se juge par `reponseJuste`**, jamais par
  `r.choice === q.correct` : « plusieurs » et « ordre » envoient leurs cases
  (`choix`), et le journal n'en garde que le verdict (`choice` à null) — le
  bilan n'a donc pas de répartition pour elles. « Qui dans la salle ? »
  n'entre pas au journal : ni juste ni faux, il ferait baisser la précision
  de ceux qui votent.
- **Un fichier absent est un 404, pas la page d'accueil** : le serveur répond
  404 à tout chemin qui finit par une extension qu'il sert (`.ico`, `.png`,
  `.js`… — `favicon.ico` d'une vieille version) et qu'aucun fichier ne sert.
  Une nouvelle sorte de fichier dans `client/public` rejoint cette liste
  (`server.ts`). Un autre point (« /chez.nadia ») ouvre l'application,
  qui y lit `chez-nadia`. Et la page se sert en 404 pour un
  espace inconnu : un test qui lit du HTML démarre son banc avec
  `clientDist` (`portes.test.ts`) — `client/dist` n'existe qu'après le build.
- **`/healthz` doit rester un 200** : sur un échec, Render redémarre
  l'instance — disque effacé, file du miroir perdue. La santé du miroir se lit
  dans son bloc `miroir`, et la resynchronisation **n'efface jamais** : un PC
  de secours lancé sur de vieux essais viderait sinon la vraie soirée. Ce
  qu'on y ajoute reste agrégé, **sans un nom** (la route est publique), et se
  lit sans parcourir de journal ; une sonde de retard de boucle ne descend
  jamais sous 20 ms de résolution (à 1 ms, elle doublait le processeur
  qu'elle mesurait).
- **La place d'un invité se lit, elle ne se trie pas** (`placeAuQuiz`) :
  à la révélation, chaque vue de téléphone porte l'identifiant, les points et
  le rang de ses voisins, lus dans le classement que la diffusion trie une
  fois (`indexDesPlaces`, `vctx.memo`) — et le téléphone les décore avec
  l'instantané. Rien pendant la question. Le retardataire qui n'a encore
  rien joué n'y tient pas de place : compté, il rejoindrait les ex æquo à
  zéro, et chaque arrivée pendant une révélation renverrait leur vue à
  tous. Un champ de la place qui dépendrait de toute la salle ferait de
  même : « sur combien » y était, et une exclusion renvoyait sa vue à chaque
  téléphone — il se lit maintenant dans l'instantané, que l'arrivée et
  l'exclusion renvoient déjà (`classement-en-cours.test.ts` y veille, pour
  les deux gestes).
- **Les pages publiques se gardent** (`core/pages.ts`) tant que leur
  empreinte ne bouge pas. Une écriture d'un journal (`Party`, `Teams`,
  `ScoreLedger`, `AnswerLog`) qui change vraiment quelque chose fait monter
  sa `revision` — pas un téléphone qui se re-présente au réveil, sinon toute
  la salle qui sort de veille refait le souvenir —, une écriture de
  l'historique passe par `ArchiveStore.ecrire` : une nouvelle écriture qui
  les contournerait laisserait le souvenir en retard — une minute au plus en
  cours de soirée —, et une nouvelle source d'une page publique entre dans
  `empreinteDesPages`. La place d'une page porte toujours l'espace.
- **Simuler une panne** : un déclencheur `RAISE(ABORT)` sur le fichier `file:`
  qui tient lieu de Turso (`miroir.test.ts`) ; un vrai démarrage, un SIGTERM
  ou un SIGKILL, en lançant `src/index.ts` dans un processus enfant
  (`exploitation.test.ts`) ; une liaison morte que socket.io croit vivante
  — le wifi sans internet —, par le relais de `relais.ts`, devant le vrai
  module du client chargé dans Node (`liaison-morte.test.ts`).
- **Le quiz du jour a son horloge** (`horlogeDuJour`, `JourStore.maintenant`) :
  les tests la font passer minuit (`jour-partie.test.ts`). Sa ligne
  d'expérience (`LIGNE_JOUR`, `#jour`) compte dans le total et le niveau
  mais pas dans l'historique : tout ce qui lit `profile_xp` comme des
  soirées écarte les lignes à part (`#paliers`, `#jour`, `#campagne` —
  `HORS_LIGNES_A_PART`, `auth/profiles.ts`) — la série du jour les écarte
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
- **La consigne du quiz du jour ne promet rien que la réserve refuse.**
  Elle décrit le format de « Coller une liste » réduit à ce que
  `raisonDEcarter` accepte, et son exemple se relit dans
  `jour-reserve.test.ts`. Quand la réserve apprendra une nouvelle sorte de
  question (les estimations à tolérance), la consigne la décrit dans le
  même commit — sinon la routine écrit pour rien, ou jamais ce qu'on veut.
  Et le jeton de la réserve ne sait que lire la consigne et ajouter : une
  route de plus derrière lui ne lit ni n'efface rien. La consigne rappelle
  pourtant les intitulés des prochains jours (l'IA ne les réécrit pas) : le
  jeton les vaut, et se change des deux côtés s'il fuit.
- **Une question de la base de la campagne garde son identifiant** : ses
  réponses, ses signalements et son retrait s'y rattachent. Une coquille se
  corrige dans son fichier, l'identifiant ne bouge pas ; une correction de
  fond — la bonne réponse change — la retire et en range une neuve, sous un
  identifiant neuf (`ranger`), pour que les mesures d'avant ne la suivent
  pas. Un lot se vérifie avant d'entrer (`verifier`), et une épreuve qui
  joue la campagne donne sa base (`baseDEssai`, `banc.ts`) : celle du dépôt
  grandit à chaque lot rangé.
- **Un thème de plus** entre au catalogue (`shared/themes.ts`) avec sa
  feuille (`client/src/themes/<clé>.css` : ses jetons sous
  `:root[data-theme='<clé>']`, ses `@keyframes` préfixées de sa clé, un bloc
  `prefers-reduced-motion`), ses polices dans `client/public/fonts/themes`
  et leur ligne dans `LICENCES.txt`, et son aperçu
  (`scripts/apercus-themes.ts <clé>`) : `design.test.ts` mesure ses
  contrastes aux seuils d'Ivoire et `themes.test.ts` réclame son aperçu.
  Ivoire, lui, vit dans `styles.css` : l'écran commun le porte aussi. Un
  thème **peint** cite ses images dans le bloc que `decors.ts --livrer`
  réécrit entre ses deux repères (`--decor-…`), jamais ailleurs, et rend
  opaques `--surface` et ce qui se pose en `--accent-soft` : translucides,
  ils laissaient passer le tableau sous le texte. Sa lisibilité se mesure
  sur ce qui est vraiment peint derrière chaque ligne
  (`scripts/rendu-themes.ts <clé> --contraste`), pas sur `--bg` seul.
- **Un haut fait ou un prix de plus a sa place ailleurs.** Un haut fait
  prend sa rareté dans `PART_DES_JOUEURS` (mesurée par `calibrage.ts`) :
  sans elle, il passerait pour le plus courant de tous et ne paraîtrait
  jamais sur une carte (`hautsfaits.test.ts` la réclame). Un prix qu'une
  personne peut remporter rejoint `PRIX_INDIVIDUELS` (`core/stats.ts`) :
  sans lui, la collection mentirait (« 14 sur 20 ») — `fin-de-soiree.test.ts`
  relit les clés du calcul.
- **Une nouvelle commande `host:*`** s'ajoute à la liste de
  `garde-fous.test.ts`, qui vérifie qu'un téléphone ne peut pas la jouer — le
  typecheck le rappelle. **Une route d'administration vit sous
  `/api/admin`** : gardée d'un bloc (`api.ts`, administrateur seul, jamais
  une télé branchée), elle entre d'elle-même dans `admin-seulement.test.ts`.
- **`package-lock.json` bouge tout seul** selon la version de npm. Ne le
  committe pas si ce n'est pas le sujet (le hook installe en `--no-save`).
- **En CSS, `transform` se compose APRÈS `rotate`**, et une animation qui pose
  `transform` écrase celui de l'élément : le toast, centré par
  `translateX(-50%)`, partait sur la droite. Centre par marges.
- **Le service worker (`client/public/sw.js`) ne fait que le rappel du
  soir** : ni cache, ni `fetch`. Inscrit depuis l'application installée, il
  couvre toute l'origine, onglets compris : un cache servirait une vieille
  application à toute une salle, et un `fetch` qui échoue ferait une page
  blanche. Il s'écrit à la main, hors du paquet (son adresse décide de ce
  qu'il couvre), et se rejoue sans navigateur (`rappel.test.ts`, dans un bac
  à sable `vm`).
- **Ce qui ne sert qu'après l'entrée vient à la demande, par `aLaDemande`**
  (`client/src/aLaDemande.ts`), jamais par `lazy` : un composant paresseux
  suspend au moins une fois, même son fichier déjà téléchargé, et React
  retient alors 300 ms ce qui sort de l'attente — la grille du profil, la fin
  de soirée, la carte d'un joueur. L'écran d'entrée ne télécharge ni la
  carte, ni la fin de soirée, ni le quiz du jour (elles viennent une fois
  entré), l'accueil anonyme ni les dessins ni les onglets du profil, et le quiz du jour
  ni la fin de soirée (ses cartes de fin vivent dans `components/Ouverts.tsx`) :
  `medaillons.test.ts` y veille, et un import statique de plus sur ces
  chemins les y remettrait.
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
- **Sur grand écran, `/host` compte en `rem`.** Sa taille racine suit la
  hauteur de l'écran (16 px en 768, 22,5 en 1080) : une taille de scène
  écrite en pixels ne grandit pas en 1920 × 1080, et la même télé la montre
  30 % plus petite. Les composants partagés avec les téléphones y ont leurs
  mesures en `rem` (le bloc en tête de « Écran commun », `styles.css`).
  Une liste de la scène passe par `Coupe`, jamais par un cadre qui défile,
  et son cadre tient sa hauteur de la mise en page, pas de son contenu.
  Et 1920 × 1080 fait 48 rem de haut, comme 1366 × 768 : une règle réservée
  à l'un (`max-height: 820px`) donne moins de place à l'autre. Tout ce qui
  grossit la scène vit dans `@media (min-width: 1101px)` : l'animateur tient
  aussi `/host` au téléphone, où rien ne grossit, où la page défile et où
  `Coupe` ne coupe rien (`overflow: visible`). `ecran.test.ts` y veille.
- **Un portrait peint se refait par la chaîne, jamais à la main** :
  `portraits.ts <branche> --lot --regenerer=br:x` (l'image d'avant mise de
  côté, jamais jetée : elle a été payée), un coup d'œil à sa planche
  (`planche-portraits.ts`), puis `livrer.ts`, qui pose ses fichiers sous
  leur nouvelle empreinte, retire les anciens et réécrit le module de sa
  branche — `branches.test.ts` refuse un fichier que plus personne ne cite.
  Une découpe se juge à l'œil : le modèle garde parfois le décor (le papier
  découpé de la forêt, les vagues, les montagnes du low poly) — le champ
  `retirer` de sa consigne le lui nomme, `--redecouper` la repaie seule. Et
  le sujet se relit sur l'ancien dessin (sa référence, `ref-*.png`) : de
  longs cheveux blancs lus comme une barbe avaient fait de la mage un vieux
  magicien. Les originaux (1024 px) restent dans `export/`, hors du dépôt.
  Un légendaire ou un Divin de même : `legendaires.ts --lot
  --regenerer=lg:x`, un coup d'œil à sa planche (`planche-medaillons.ts`),
  puis `--livrer` — `medaillons-peints.test.ts` refuse un fichier que plus
  personne ne cite.
- **La tablée lit l'écran par ses classes** (`.quiz-player`, `.ans-btn`,
  `.guess-form`, `.join-url`, `.fin-tete`…) : en renommer une casse ses
  raccourcis `question`, `repondre` et `scanner` sans que le typecheck le
  voie. Une tablée courte le dit.

## Ce qu'il ne faut pas faire

- Toucher aux barèmes (`CHOICE_POINTS`, `SPEED_BONUS`, `LECTURE_MS…`,
  `PROXIMITY_POINTS`, `CRANS_TOLERES`, `XP`, `SEUILS`, `XP_PAR_PALIER`,
  `XP_PALIER`, l'expérience des hauts faits, `CHANCE_ECLAT`…) sans le dire :
  ce sont des choix de produit, pas des constantes techniques — et sans
  incrémenter `VERSION_BAREME`, l'historique garderait l'ancien. Les points
  d'une question, eux, sont écrits au journal et ne se recalculent jamais :
  une soirée jouée garde le barème de son soir, et `VERSION_BAREME` relit
  seulement ce qui s'en dérive. `calibrage.ts` joue avec les vraies
  formules (`pointsDuChoix`, `pointsDesEstimations`) : il mesure ce qu'un
  nouveau barème fait aux niveaux et aux légendaires.
- Changer les prix des thèmes (`PRIX_DES_THEMES`) ou la règle des
  confettis (`confettisDeSoiree`) sans le dire : des choix de produit. Les
  confettis se relisent à chaque lecture — une règle changée change d'un
  coup, rétroactivement, le solde de tout le monde —, et un achat garde le
  prix qu'il a payé.
- Changer les mélanges ou les seuils des paliers des sentiers (`PALIERS`,
  `SEUIL_DES_PALIERS`, `SEUIL_DU_MAITRE`), les vies du jour ou le prix d'une
  vie (`VIES_PAR_JOUR`, `PRIX_D_UNE_VIE`) sans le dire : des choix de
  produit, calculés par `calibrage-sentiers.ts` et relus sur les vraies
  épreuves (`/admin#campagne`). Un seuil changé ne vaut que pour les
  épreuves qui commencent — celle en cours garde le sien —, et un palier
  validé ne se reprend jamais.
- Changer les seuils des récompenses du quiz du jour et de la campagne
  (`SEUILS_DU_LAURIER`, `JOURS_POUR_UNE_PAGE`, `SALLE_DU_JOUR`,
  `PRIX_D_UN_SABLIER`, `SABLIERS_MAX`, `FUNAMBULE`, `GRANDE_SERIE`,
  `RECORD_DU_TOUR_DU_MONDE`, `JOUEURS_POUR_LE_DEFI`, les paliers de L'Élite,
  de L'Infatigable, de L'Alpiniste, de L'Érudit et du Marathonien) sans le
  dire : des choix de produit. Les jours et les séries d'avant ne se
  relisent qu'à leur version (`VERSION_DES_JOURS`, `VERSION_DES_SERIES`) :
  une règle changée la fait monter, ou l'historique garde l'ancienne.
- Bouger le seuil d'un légendaire ou la courbe des niveaux
  (`XP_PAR_PALIER`) sans le mesurer ni le dire. Ce sont aussi des choix de
  produit, mesurés par `calibrage.ts` ; ils se relisent à chaque lecture,
  sans `VERSION_BAREME`, et ne se durcissent jamais sans leur entrée à
  `DURCISSEMENTS` ou à `COURBES_D_AVANT` (invariant 22).
- Rendre la connexion obligatoire. L'entrée d'une soirée **est** un écran de
  connexion, et l'accueil (`/`) en est un aussi : c'est un choix assumé — mais
  tous deux s'ouvrent sur trois gros boutons du même format, « Jouer sans
  compte » d'abord, puis « Me connecter » et « Créer un profil » (les champs
  ne viennent qu'avec le choix), qui se voient **sans défiler** en 360 × 640
  (`connexion-claire.test.ts`). Un profil naît d'un prénom et d'un mot de
  passe : l'identifiant s'en déduit (`IdentifiantDiscret`).
  Aucun champ de l'entrée ni de `ProfilForm` n'a d'`autoFocus` : le clavier
  pousserait le bouton hors de l'écran. **Le chemin anonyme reste la valeur de
  l'application** ; les profils s'y greffent, ne le remplacent pas.
- Supprimer ou désactiver une assertion — du smoke ou d'un test — pour la
  faire passer.
