# Le glossaire

> Les mots de FiestApp — ceux de l'écran et ceux du code —, chacun avec son sens en une phrase et le nom qu'il porte dans le code : 398 termes, du moteur du quiz à la boutique. Pour qui découvre le dépôt, ou cherche ce que recouvre un mot.

FiestApp nomme les choses comme l'application les montre : une **soirée**, la **salle**, un **salon**, un **trophée**. Le code garde parfois un nom plus ancien ou plus technique — un compte d'animateur est un **espace** (`accounts`), et son identifiant cloisonne tout le reste — : la dernière colonne le donne, pour qu'on le retrouve d'une recherche. Les termes se rangent sans leur article (« Le Laurier » sous L, « L'Éclat » sous E).

**Dans cette page** : [A](#a) · [B](#b) · [C](#c) · [D](#d) · [E](#e) · [F](#f) · [G](#g) · [H](#h) · [I](#i) · [J](#j) · [L](#l) · [M](#m) · [N](#n) · [O](#o) · [P](#p) · [Q](#q) · [R](#r) · [S](#s) · [T](#t) · [U](#u) · [V](#v)

## A

| Terme | Ce que c'est | Dans le code |
|---|---|---|
| À compléter | Une question à qui il manque de quoi se jouer : elle s'enregistre telle quelle, dit sur sa carte ce qui lui manque, et la partie la saute | `questionProblem` |
| « À gagner : où ? » | Le lien sous ce qu'une pièce de la loge laisse choisir (« 3 fonds à gagner : où ? ») : la loge ne montre que ce qu'on a, et il mène à la ligne de « Ma collection » où se lit ce qui reste, et ce qu'il faut pour l'ouvrir | `AGagner` (`client/src/components/LigneDeCollection.tsx`) |
| À ta portée | Les 3 classés juste au-dessus de sa cote, avec ce que les battre rapporterait | `aSaPortee` |
| À traiter | La liste de ce qui attend un geste de l'administrateur, le plus pressé d'abord | `lesChosesATraiter` |
| Accusé | La réponse du serveur à un message qui l'attend : retenu, ou refusé avec son motif et son message | `ecouter`, `ActionAck`, `JoinAck` |
| Administrateur | Le compte créé au premier démarrage, seul à entrer au QG | `role: 'admin'` |
| Adresse inconnue | Une adresse qui ne mène à aucune page : le serveur répond 404 et la page propose « Rejoindre une soirée » | `parseRoute` (sorte `unknown`), `client/src/views/LandingApp.tsx` |
| Album des avatars | La partie avatars de « Ma collection » : une page par rareté, de « Commune » à « Divin » | `shared/album.ts` |
| Album du style | La partie de « Ma collection » qui range les fonds de carte, les gerbes, les finitions et les bordures de ligue (les thèmes ont leur album) : en couleur ce qu'on a, éteint le reste, ce qu'il faut sous chaque case, et au toucher sa fiche — comment l'avoir, où l'on en est, et « Essayer » pour ce qu'on a sans le porter | `AlbumDuStyle` (`client/src/components/AlbumDuStyle.tsx`), `objetsDuStyle` (`shared/style.ts`) |
| Allure (d'une gerbe) | Son nombre de particules, leur taille et leur durée : un ballon flotte, une étincelle file | `AllureDeGerbe` |
| Ami | Un profil qu'on a mis dans sa liste, sans demande, ou avec qui on a joué un défi entre amis | `idsDesAmis` |
| Amorce (de la bibliothèque) | Les deux modèles marqués `"amorce": true`, qui entrent une seule fois, au premier démarrage d'une base, dans la bibliothèque de l'administrateur | `seedLibrary` |
| Amorce (de la réserve du jour) | Le premier remplissage de la réserve, au tout premier démarrage, avec les questions des quiz livrés qui se jouent seules ; elles ne sortent qu'en dernier recours | `amorcer` |
| Annonce de la clôture | Ce que l'écran commun montre à la salle quand la soirée est close : son nom, le QR du souvenir, les podiums, ce qui est tombé | `soiree:cloture`, `ClotureDeSoiree` (`shared/fin.ts`) |
| Annuler (un duel) | Le geste du QG qui ferme tout de suite un duel classé que l'adversaire n'a pas commencé, comme à son expiration : il ne compte pour personne ; commencé de l'autre côté, il ne s'annule plus | `CampagneStore.annulerUnDuel`, `POST /api/admin/duels/:code/annuler` |
| Annuler (une question) | Retirer une question du jour pour tous, le jour même seulement : chaque joueur se recompte | `JourStore.annuler` |
| Aperçu (d'un thème) | L'écran d'une question photographié dans l'application sous ce thème, que montrent la boutique et la collection | `apercuDe` |
| Application installée | FiestApp ajoutée à l'écran d'accueil du téléphone, seule à pouvoir recevoir le rappel du soir | `estInstallee` |
| Apprise | Une question retrouvée à ses trois rendez-vous. Une erreur la renvoie au premier | `apresUnPassage` |
| Archive | La copie brute d'une soirée close — invités, équipes, prix remis, les deux journaux, les quiz joués —, relue avec le code du jour | `PartyArchive` (`shared/archive.ts`), `ArchiveStore` (`server/src/core/archive.ts`) |
| Arrêt net | Un arrêt sans extinction propre — processus tué, mémoire épuisée —, qui perd la file du miroir | `arreteNet` |
| Atelier | La seconde régie où travaillent les experts, à côté de la tablée en direct ; leurs gestes la visent par sa fiche | `TABLEE`, `server/scripts/tablee/pilote.mjs` |
| Attente écrite | L'écran d'attente que le serveur écrit dans la page avant tout script — le nom de la soirée et « On arrive… », ou « Chargement… » —, que React remplace sans que rien ne bouge | `ecrireAttente` (`server/src/core/page.ts`), `Patience` (`client/src/annonce.tsx`) |
| Automate | L'adversaire simulé du dé, 🤖, qui joue comme le joueur d'après le modèle du savoir, son score tenu à 2 bonnes réponses de ce qu'on attend de lui | `AUTOMATE` |
| Une autre | La voisine d'une question tirée de la base — même catégorie, même marche, même sorte —, qui la remplace sans rien écrire | `uneAutreQuestion` |
| Avatar en grand | L'avatar d'une carte, touché : ouvert en grand, sa peinture, sa finition et son Éclat entiers | `AvatarEnGrand` |
| Avatar légendaire | Un des vingt-six avatars peints qu'ouvrent des hauts faits répétés ou les étapes d'une piste, sur la durée ; il prend la place de l'emoji | `shared/legendaires.ts` |
| Avatar peint | Un avatar qui prend la place de l'emoji — légendaire, Divin, portrait du savoir ou forme de compagnon —, un seul à la fois | `legendairePorte` |

## B

| Terme | Ce que c'est | Dans le code |
|---|---|---|
| Banc | Le serveur jetable des tests : un vrai serveur sur deux bases temporaires, redémarrable sur disque effacé, et de quoi lui parler comme un téléphone, l'écran commun ou la page d'un animateur | `server/test/banc.ts` (`demarrer`) |
| Barème du solo | Le recompte unique de l'expérience des jeux solo, fait au démarrage sous son drapeau | `server/src/core/baremeDuSolo.ts` |
| Barre du chef | Les gestes d'animateur en bas du téléphone qui a ouvert le salon, passés par une seconde liaison | `client/src/components/BarreDuChef.tsx`, `client/src/socketDuChef.ts` |
| Base de la campagne | Les QCM écrits et étiquetés d'avance, un fichier par catégorie, où puisent la campagne et le quiz tout prêt | `server/content/campagne/` |
| Base locale | La base SQLite, jetable, qui tient la soirée en cours de chaque espace, et rien d'autre | `server/src/core/db.ts` |
| Base muette | Une base permanente qui ne répond pas dans les dix secondes | `BaseMuette` |
| Base permanente | La base libSQL — Turso en ligne, un fichier chez soi — qui garde tout ce qui doit survivre, et le miroir de la soirée | `QUIZ_DB_URL` |
| Bibliothèque | Les quiz d'un espace — « Mes quiz », à l'adresse `/edit` —, que les autres espaces ne voient pas | `QuizStore` |
| Bibliothèque en mémoire | La copie des quiz jouables de chaque espace que lit le moteur, relue après chaque écriture ; de deux relectures croisées, la dernière partie gagne | `derniereRelecture` |
| Bilan | La soirée de chacun, question par question, et celle de toute la salle | `buildReview` (`server/src/core/review.ts`) |
| Bonus de série | L'expérience versée dès qu'une partie commence : dix par jour de série, cent au plus | `xpDeSerie` |
| Bordure de ligue | L'anneau cranté autour de l'avatar d'un profil, une par ligue atteinte, porté d'office ou choisi dans la loge | `BordureDeLigue` |
| Boutique | La page `/boutique`, où l'on dépense ses confettis, en trois rayons : « Thèmes », « Compagnons », « Objets » | `PanneauBoutique` |
| Branche | Une des douze familles de portraits, une par catégorie de questions, chacune son style peint | `BRANCHES` |
| Brouillon | Ce que l'éditeur garde dans le navigateur tant que le serveur n'a pas enregistré, relu comme le serveur relit | `shared/brouillon.ts` |

## C

| Terme | Ce que c'est | Dans le code |
|---|---|---|
| « C'était un essai » | Effacer la soirée sans rien garder, en reprenant aux profils tout ce qu'elle avait crédité | `host:discardParty`, `retirerSoireeEntiere` |
| Calendrier des Heures | Douze pages enluminées, une par mois, ouvertes à vingt jours joués dans le mois et dorées pour son champion | `shared/calendrier.ts` |
| Calibrage | La simulation de bandes d'amis jouant des soirées sur le vrai code, qui mesure les niveaux, les légendaires et la rareté des hauts faits | `server/scripts/calibrage.ts` |
| Campagne | Le jeu solo des profils, sans chronomètre, à `/campagne` : la série, les sentiers, le défi de la semaine, le carnet, et les duels sur le même écran | `CampagneStore` |
| Carnet de révision | Ce qu'on a raté en campagne, qui revient à des rendez-vous espacés jusqu'à être appris | `shared/revision.ts` |
| Carte à fond | Une carte qui porte un fond : elle garde les couleurs du Velours sous tous les thèmes | `.carte-fond` |
| Carte de joueur | La feuille qui s'ouvre en touchant un nom : ce qu'il fait ce soir et, pour un profil, ce qu'il a gagné | `CarteDeJoueur` |
| Catalogue | Les copies relues et publiées par l'administrateur, offertes à chaque espace sous « Partir d'un modèle » | `EntreeDuCatalogue` |
| Cercle | La finition dessinée autour d'un avatar peint, à la place de l'anneau de son palier ou de sa forme | `client/src/components/Cercle.tsx` |
| Cette question | La carte du téléphone à la révélation d'un QCM : qui a trouvé, en combien de temps, et sa place à soi | `laQuestion` |
| Champion du mois | Le premier du classement d'un mois, à deux joueurs au moins : un titre daté, salué tout le mois suivant | `cleDuChampion` |
| Chapitre | Deux paliers d'un même thème, fait d'un à trois sous-thèmes de la catégorie, du premier au huitième palier | `shared/chapitres.ts` |
| Chargement à la demande | Un module qui ne part qu'au moment où un écran en a besoin, sans `lazy` ni suspension | `aLaDemande` (`client/src/aLaDemande.ts`) |
| Chef | Le profil qui tient l'espace et anime depuis son téléphone de joueur, par sa barre | `chefIci` (`client/src/chef.ts`), `accounts.profile_id` |
| Choix local | Le prénom et l'avatar retenus sur un téléphone pour un espace — une commodité de l'appareil, sans rapport avec un profil | `ChoixLocal`, `quizz.profile.<espace>` (`client/src/state.ts`) |
| Chronologie | Le journal d'une tablée en une page : qui a fait quoi, les gestes ratés, les délais de réponse, ce qui s'est dit, les retours attendus | `server/scripts/tablee/chronologie.mjs` |
| Circulation (des confettis) | « En circulation », sur la page de l'économie du QG : tous les soldes relus une fois par jour — leur somme, la médiane de ceux qui ont joué ces trente jours, les profils par tranche, ceux qui ont de quoi s'offrir un compagnon | `circulationDes` (`shared/qgEconomie.ts`) |
| Clés VAPID | La paire de clés du serveur qui signe ses envois aux services de push, tirée une fois et gardée dans la base permanente | `jour_rappels_cles` |
| Cloche | Le bouton de la page du jour qui allume ou coupe le rappel du soir, seulement dans l'application installée | `client/src/components/RappelDuJour.tsx` |
| Clôture | Le seul geste de fin d'une soirée : dernier rangement, crédits de fin, effacement (le miroir, puis la base locale), puis la fin de soirée à chacun | `cloreLaSoiree` (`server/src/sockets.ts`), `SpaceRuntime.closeParty` |
| Clôture du défi | La fin d'une semaine de défi, faite à la première demande de la semaine suivante : vainqueurs, laurier d'argent, correction ouverte | `cloreLesDefis` |
| Code de partage | Six caractères, valables sept jours, qui donnent une copie d'un quiz à un autre espace du même serveur | `lireCode` |
| Code de secours | Seize signes, donnés une fois, la seule porte de retour d'un profil qui a perdu son mot de passe ; il se consomme et se renouvelle | `useRecovery` |
| Code du salon | Six chiffres tirés à l'ouverture du salon, qu'on tape dans « Rejoindre une soirée » ou qu'on suit par `/<code>` ; il vaut encore une demi-heure après la clôture | `SalonStore.ouvrir`, `CODE_DU_SALON` (`shared/space.ts`) |
| Collection de prix | Les prix du palmarès qu'un profil a remportés, sur vingt | `PRIX_INDIVIDUELS`, `CATALOGUE_DES_PRIX` (`server/src/core/stats.ts`) |
| Commande du jour | Ce que la routine doit écrire aujourd'hui pour chaque catégorie : combien de questions, quels sous-thèmes et quelles difficultés | `commandeDuJour` |
| Compagnon | Un avatar peint acheté en boutique, qui grandit avec les bonnes réponses données en le portant | `COMPAGNONS` |
| Compte | Un espace, vu du serveur : son identifiant cloisonne ses quiz, sa soirée et son historique ; il ne bouge jamais | `accounts`, `AuthStore` |
| Compte d'avant | Un espace à identifiant et mot de passe, d'avant les salons ouverts par les profils — celui de l'administrateur en est un | `AccountRec.passwordHash` |
| Confetti | La monnaie des profils : une bonne réponse, un confetti — en soirée qui compte, au quiz du jour, en campagne —, plus les étoiles des sentiers, les ligues des duels et les dons de l'administrateur | `confettisDeSoiree` |
| Conflit | Le refus (409) d'« Enregistrer » quand le quiz a été enregistré ailleurs depuis la version d'où l'éditeur part : « Garder la mienne » ou « Prendre l'autre version » | `conflit` |
| Consigne | Le texte donné à une IA ou à un rédacteur pour écrire des questions : celle de la réserve du quiz du jour — la même pour la routine du matin et pour « Copier la consigne pour une IA » —, et celle d'un lot de la base de la campagne | `consigneDuJour` |
| Console | La session d'un espace, qui ouvre l'écran commun et les pages de l'animateur | `qz_session`, `auth_sessions` |
| Contre-expertise | L'agent qui essaie de réfuter chaque constat d'un audit de code avant qu'il entre dans la synthèse | `.claude/skills/tablee/consignes-contre-expertise.md` |
| Convive | L'agent du projet qui joue un personnage de la tablée, sans connaître le code ni recevoir `CLAUDE.md` | `.claude/agents/convive.md` |
| Copie jouée | Le quiz tel qu'il se joue ce soir — questions tirées, réponses mélangées, ordre à retrouver —, tirée une fois pour toute la salle, et que le journal numérote | `preparerPartie` |
| Copier en liste | L'inverse de la liste collée : le quiz écrit dans ce format, qui se recolle à l'identique, sauf ce qui ne voyage pas en texte | `ecrireListe` |
| Correction | La relecture d'un jour question par question, ouverte à qui a fini sa partie, puis à tous une fois le jour clos | `JourStore.correction` |
| Correction (d'une partie) | « Mes réponses » : chaque question d'une partie finie, avec la bonne réponse et celle du joueur | `client/src/components/SerieCorrigee.tsx` |
| Correction (d'une question) | La version corrigée d'une question, rangée dans la base permanente. Elle remplace la ligne du fichier, sans déploiement | `campagne_corrections` |
| Cote | Le nombre de type ELO d'un joueur aux duels, 1 000 au départ, relu de tout son journal de duels à chaque lecture | `releverLesDuels` |
| Cote figée | La cote de chacun des deux joueurs, écrite au lancement d'un duel contre quelqu'un : l'autre bouge contre elle | `campagne_duels.cote_auteur` |
| Coulisses | Ce que l'écran projeté laisse à la télécommande : la liste des quiz, la grille des prix | `coulissesAilleurs` (`client/src/views/HostApp.tsx`) |
| Coup d'œil | La part de la salle qu'une estimation bat ou égale ; celui d'un joueur est la moyenne des siens | `coupDOeil` (`server/src/core/journal.ts`) |
| Cran (d'une bordure) | Un duel gagné dans une ligue, serti sur sa bordure ; douze la sertissent | `CRANS_D_UNE_BORDURE` |
| Cran (d'une estimation) | L'unité du dernier chiffre de la bonne réponse d'une estimation (1 pour 1 994, 0,1 pour 7,5) | `CRANS_TOLERES` |

## D

| Terme | Ce que c'est | Dans le code |
|---|---|---|
| Décor peint | Le décor d'un thème ou d'un fond qui est un tableau, livré sous empreinte dans `client/public/decors/` | `--decor-…` |
| Défi de la semaine | La même série pour tout le serveur, du lundi au dimanche (heure de Paris), avec une tentative par joueur | `commencerLeDefi` |
| Défi entre amis | L'ancien duel amical, à plusieurs et par lien ou par code, qui ne touche jamais la cote ; la page ne le lance plus | `campagne_duels` (`adversaire` NULL) |
| Demande pour une IA | La commande toute faite — thème, nombre de questions, public, niveau, part d'estimations — qui précède le format complet | `demandePourIA` |
| Démarrage de front | L'ouverture des magasins en parallèle, après les comptes, pour qu'un réveil n'attende pas soixante allers-retours en série | `deFront` |
| La dernière soirée | La soirée close que le souvenir et le bilan de l'espace montrent jusqu'à la première question de la suivante, et que le téléphone propose sept jours | `derniere` (`server/src/server.ts`), `DERNIERE_MS` (`client/src/state.ts`) |
| Désactiver (un espace) | Fermer un espace sans rien effacer : ni console, ni invités ; ses pages publiques restent lisibles | `accounts.disabled_at` |
| Difficulté estimée | La note de 1 à 5 donnée à une question quand on l'écrit. Elle sert d'a priori à sa marche | `TAUX_A_PRIORI` |
| Distinctions du souvenir | Le plus beau coup, le plus régulier, le vainqueur de chaque quiz, au souvenir | `client/src/components/Trophies.tsx` |
| Divin | Un des six avatars à part, dont les règles et les récits sont secrets : les règles ne quittent jamais le serveur, et le récit n'est dit qu'à son porteur | `server/src/core/divins.ts` |
| Don (de confettis) | Des confettis que l'administrateur offre depuis la fiche d'un joueur, avec un mot, annoncés une fois sur son accueil et jamais repris | `offrirDesConfettis` |
| Données de départ | Ce qu'une page demande dès son code arrivé, et que le serveur fait précharger avec la page, à la même adresse | `donneesDeDepart`, `DEPART` (`shared/depart.ts`) |
| Duel | Une série de la campagne que deux adversaires jouent sur les mêmes questions, chacun à son heure ; le plus de bonnes réponses gagne | `shared/duels.ts` |
| Duel au dé | Le duel tout de suite contre Automate, toujours sur toutes les catégories ; une série de mode `rencontre` (« rencontre » dans le code) | `commencerUneRencontre` |
| Duel classé | À l'écran, le duel contre quelqu'un ; dans le code, tout duel qui compte pour la cote, celui du dé compris | `lectureDesDuels` |
| Duel contre quelqu'un | Le duel lancé contre un joueur à profil : son auteur joue d'abord, l'autre le reçoit à sa dernière réponse et peut le jouer jusqu'à 7 jours après son lancement | `creerUnDuel` |
| Duels (au QG) | La page « Les duels » de l'administrateur (`/admin#duels`) : les chiffres d'aujourd'hui, les duels par jour sur trente jours — contre Automate, classés —, les ligues, le classement tel que les joueurs le voient et son « Masquer », puis les duels classés « En attente » de leur adversaire, chacun son « Annuler » | `SuiviDesDuels` (`shared/qgDuels.ts`), `CampagneStore.suiviDesDuelsAuQg` |
| Durcissement | La règle d'avant d'un légendaire ou de la courbe, gardée sous un drapeau pour que la durcir ne reprenne rien à personne | `DURCISSEMENTS` |

## E

| Terme | Ce que c'est | Dans le code |
|---|---|---|
| Écart (d'un duel) | Ce qu'un duel joué a fait à la cote, en points entiers | `ecartContre` |
| Écart (d'une estimation) | La distance d'une estimation à la bonne réponse, comptée sur les nombres tapés | `ecartEstimation` |
| Écart typique | La médiane des écarts de la salle à une estimation, bornée par deux crans et par la bonne réponse : la moitié de la proximité s'y gagne | `pointsDesEstimations` |
| Échec passager | Un échec qui passe tout seul — le réseau qui revient, l'hébergeur qui se réveille — et qu'une écriture rejouable peut attendre | `statutPassager`, `echecPassager` (`shared/erreurs.ts`), `auReveil` (`client/src/api.ts`) |
| Éclat | Un tirage — une chance sur quarante en soirée et au quiz du jour, sur vingt au défi de la semaine — qui change pour toujours les couleurs de l'avatar porté | `profile_eclats` |
| Économie (au QG) | La page « L'économie » de l'administrateur (`/admin#economie`), à lire, sans geste : les confettis gagnés et dépensés jour par jour, d'où ils viennent — « Tes dons » compris — et où ils partent, ce qui est en circulation, les meilleures ventes, les Éclats tombés et les légendaires portés | `PageDeLEconomie` (`shared/qgEconomie.ts`), `economieDuQg` (`server/src/economie.ts`) |
| Écran commun | La page de l'animateur projetée à la salle, sa console en bas | `/host`, `client/src/views/HostApp.tsx` |
| Écran d'animateur | Toute connexion présentée par une session d'animateur : écran commun, télécommande, télé branchée, liaison du chef | `host:hello`, `hosts:<espace>` |
| Écran des gains | La fin de chaque partie, la même partout : « Ce que tu gagnes », « Nouveaux trophées », « À porter » | `shared/gains.ts` |
| Écran utile | Le premier élément qui dit qu'une page est là, celui que `npm run mesure` chronomètre | `server/scripts/mesure-pages.ts` |
| Écusson de savoir | La maîtrise d'une des douze catégories : bronze, argent, or à 20, 75 et 200 bonnes réponses, tous modes confondus | `shared/ecussons.ts` |
| Emoji de collection | Un des douze emojis réservés aux profils, chacun ouvert par un niveau qui n'ouvre pas de finition | `COLLECTION` |
| Emoji récent | Un emoji d'Unicode 13 ou après, que l'écran commun sous Windows 10 dessine en carré vide | `emojisRecents` |
| En ligne | Un ami réciproque passé ces 5 dernières minutes, tenu en mémoire seulement | `EN_LIGNE_MS` |
| Enchaînement | La question suivante qui part seule après la révélation, au délai choisi (5, 10 ou 20 secondes) ; suspendu après une question sans une seule réponse | `autoNextSeconds`, `PALIERS_ENCHAINEMENT` |
| Enjeu | Ce qu'un duel ferait à la cote — gagné, à égalité ou perdu —, dit avant et pendant la partie | `enjeuContre` |
| Entourage | Ce qui entoure une question jouée : l'anecdote, la note, l'intertitre, la photo de la révélation, l'extrait — le moteur décide qui les reçoit, et quand | `Entourage` |
| Entrée de départ | L'état de l'entrée d'un invité — l'instantané des téléphones, le profil du cookie —, servi avant la liaison temps réel | `EntreeDeDepart` (`shared/depart.ts`), `/s/<espace>/entree.json` |
| Épreuve (d'un sentier) | La partie de seize questions qui valide un palier : une série de la campagne d'un autre mode | `campagne_series.mode = 'sentier'` |
| Épreuve (d'un test) | Un `test(…)` de `node:test` dans un fichier de `server/test/` : ce qu'il vérifie, dit par son titre | `server/test/` |
| Épreuve en jeu | Une épreuve ni validée ni rejouée : ratée, elle coûte une vie, et tant qu'elle attend, aucune autre ne commence | `commencerEpreuve` |
| Espace | Tout ce qui appartient à un animateur — quiz, photos, soirée en cours, historique, réglages —, désigné par son adresse | `space_id` |
| Espace fine | L'espace insécable étroite posée à l'affichage devant ? ! ; et à l'intérieur des guillemets « » | `shared/typographie.ts` |
| Espace par défaut | Celui de l'administrateur, où mènent les anciennes adresses ; il ne se supprime pas | `default_space` (`meta`) |
| Essai | Ce qu'on a touché dans la loge sans l'enregistrer : la carte le montre, « Porter » l'enregistre d'un seul envoi, tout ou rien | `essayer` |
| « Essayer » | Le bouton qui ouvre la loge avec un objet déjà sur la carte, sans rien enregistrer : sous « À porter » à la fin d'une partie, et dans la fiche d'un avatar ou d'un objet du style de « Ma collection » qu'on a sans le porter ; une adresse n'essaie que ce qui est à lui | `essaiDemande` (`shared/loge.ts`), `?essayer=finition:or#avatar` |
| Estimation en direct | Une estimation dont la bonne réponse se mesure après les réponses — le gâteau pesé — et se tape pour révéler | `enDirect` |
| Étagère | Ce qu'un profil a rangé — prix du palmarès, hauts faits, étapes de piste, Divins, saisons —, une ligne par récompense et par rangement | `profile_badges` |
| Étape | Un des six paliers d'un parcours de thème : dix questions, sept pour passer | `PALIERS_DES_SUJETS` |
| Étape (d'une piste) | Bronze, argent ou or : elle tombe une fois, paie son expérience et ouvre parfois un laurier, une gerbe, un fond, un thème ou un légendaire ; le code dit « palier », un mot qu'à l'écran seuls les sentiers emploient | `clePalier` |
| Étiquetage | Les descriptions d'une question de la réserve (sous-thème, étiquettes, difficulté estimée, âge, portée…), écrites par une IA et relues au catalogue ; rien ne les lit encore | `lireEtiquetage` |
| Étoiles | La note d'une épreuve validée : une au seuil, deux à treize bonnes réponses, trois sans faute ; la meilleure de chaque palier paie des confettis | `etoilesDe` |
| Étoiles du jour | La note d'une partie du quiz du jour : une étoile dès 60 % des questions qui comptent, deux dès 80 %, trois au sans-faute — la « médaille » d'avant, dont le code garde le nom | `medailleDe`, `NOM_DE_LA_NOTE` |
| Expérience (XP) | Les points qu'un profil garde d'une fois à l'autre — en soirée, au quiz du jour, en campagne — et qui font son niveau ; elle ne donne aucun avantage de jeu | `profile_xp` |
| Expert | Un agent qui pose un regard sur une soirée — parcours, mots, accessibilité, performance — ou audite le code, et rend un rapport | `.claude/skills/tablee/experts/` |
| Exploit, coup du sort | Les deux sortes de hauts faits : ce qu'on a réussi, ou ce qu'on assume en riant — un coup du sort rapporte peu, et la carte ne le montre que s'il est choisi (dans le code, le ton `eclat` ou `ombre`) | `Ton` |
| Export | La soirée en fichiers : le bilan en JSON et trois CSV pour Excel | `exportFiles` (`server/src/core/export.ts`), `npm run export` |
| Extinction propre | L'arrêt sur signal qui vide la file du miroir et s'inscrit dans les démarrages | `qg_demarrages` |
| Extrait | Le son d'un blind test, que l'écran commun joue seul pendant la question — jamais les téléphones | `son` |

## F

| Terme | Ce que c'est | Dans le code |
|---|---|---|
| Famille (de faits) | Une sorte de faits tirés de Wikidata (tableaux, films, prix Goncourt…), dont un script fait des fiches à rédiger | `FAMILLES`, `server/scripts/faits-wikidata.ts` |
| Faute de trop | La faute qui franchit la ligne d'or et rate l'épreuve : la septième, la huitième au maître | `issueDe` |
| Feuille du choix | La feuille « Sur quoi ? » où l'on choisit les catégories ou le sujet d'une série | `FeuilleDuChoix` |
| Fiche | Un invité de la soirée : son prénom, son avatar, son équipe, son profil éventuel et son jeton | `PlayerRec` (`server/src/core/party.ts`) |
| Fiche d'un quiz | L'écran d'un quiz dans « Mes quiz » : ce qu'il contient, « Lancer » et « Modifier les questions » en grand, les gestes rares sous « Plus » | `FicheDeQuiz` |
| Fiche de l'historique | Les faits bruts d'une soirée, rangés à côté de son archive, que la liste de l'historique lit sans ouvrir l'archive | la colonne `summary` de `soirees`, `summarize` (`server/src/core/archive.ts`) |
| Fiche de relecture | La version compacte d'un lot que lit le correcteur | `ficheDUneEntree` |
| Fiches | Le bilan de chaque invité, une page chacun, à imprimer ou à garder en PDF | `Fiches` (`client/src/views/BilanApp.tsx`), `/<espace>/bilan/fiches` |
| Fil rouge | Un sujet défini par les étiquettes ou la portée d'une question (La France, Les pièges, Les records…) | `FAMILLES_DE_SUJETS` |
| File du miroir (voie) | La file ordonnée d'un espace, par laquelle chaque écriture de la soirée part au miroir, réessayée jusqu'au succès | `Voie` |
| Filet (de la page) | L'écran de dernier recours d'une erreur d'affichage : « Oups », « Un souci d’affichage — rien n’est perdu. », « Touche pour recharger » | `Filet` (`client/src/main.tsx`) |
| Filet (du serveur) | Ce qui consigne une exception échappée sans éteindre le serveur, posé une fois le serveur prêt | `poserLeFilet` |
| Fin de soirée | Ce que chaque téléphone reçoit à la clôture : sa place, ses points, ce qu'il a gagné, ses liens | `soiree:fin`, `FinDeSoiree` (`shared/fin.ts`) |
| Fin gardée | La fin de soirée rangée sur le téléphone : elle se rouvre quand on revient sur la page (douze heures), jamais quand on y arrive | `SoireeGardee` (`client/src/state.ts`), `estUnRetour` |
| Finition | L'habillage de l'avatar d'un profil, de Mat à Constellation, ouvert par le niveau ; « Auto » porte la plus belle | `NIVEAU_FINITION` |
| Fond de carte | Ce qu'on voit derrière la carte d'un joueur quand on touche son nom ; il se gagne, ne s'achète pas | `shared/fonds.ts` |
| Force d'en face | Ce contre quoi la cote bouge : la cote du score d'Automate au dé, la cote figée de l'adversaire contre quelqu'un | `DuelJoue.coteAdverse` |
| Format complet | Les règles de la liste collée, écrites à partir des bornes et des catégories, avec un exemple de chaque possibilité : ce qu'on donne à un ami ou à une IA | `FORMAT_DE_LISTE` |
| Forme | Un des quatre âges d'un compagnon, de celle qu'on achète à la forme ultime ; une forme atteinte ne se perd jamais | `FORMES_DES_COMPAGNONS` |
| Forme (d'un compagnon) | L'un de ses quatre états, de rareté montante, ouverts à l'achat puis à 100, 300 et 500 bonnes réponses ; atteinte, elle ne se perd jamais | `JUSTES_DES_FORMES` |
| Fraîcheur | L'ordre de tirage propre à un joueur : d'abord les questions jamais vues, puis celles vues il y a longtemps, et en dernier celles des dernières 24 heures | `parFraicheur` |

## G

| Terme | Ce que c'est | Dans le code |
|---|---|---|
| Garder cet ordre | Une question dont les réponses restent telles qu'écrites dans un quiz qui les mélange | `ordreFixe` |
| Gemmes | Les onglets de ce qui se range par rareté, une gemme par page avec son compte : les mêmes dans l'album des avatars de « Ma collection » et dans la grille des avatars de la loge | `Gemmes` (`client/src/components/Gemmes.tsx`) |
| Gerbe | Ce qui éclate sur le téléphone d'un joueur à profil à chaque bonne réponse, pour lui seul ; les confettis d'office | `shared/gerbes.ts` |
| Geste (du QG) | Ce que l'administrateur a changé, noté en une phrase au journal des gestes, jamais modifié | `qg_gestes`, `noterLeGeste` |
| Gluon | Le caractère invisible U+2060 qui empêche de couper « a-t-il » en fin de ligne, sans dépendre d'une police | `espacesFines` |

## H

| Terme | Ce que c'est | Dans le code |
|---|---|---|
| Haut fait | Un trophée qui se regagne — vingt en soirée, dix au quiz du jour, cinq en campagne —, compté autant de fois qu'il tombe | `shared/hautsfaits.ts` |
| Haut fait du jour | Une distinction qui se regagne, une fois par jour au plus, et paie son expérience à chaque fois (Le Laurier, Le Lève-tôt, Le Courant d'air…) | `HAUTS_FAITS_DU_JOUR` |
| Heure du serveur | L'horloge que lisent tous les chronomètres d'un écran, mesurée sur sa liaison | `serverNow`, `bestSample` (`shared/clock.ts`) |
| Hook de démarrage | Le script qui installe les dépendances au début d'une session de Claude Code sur le web, et ne fait rien en local | `.claude/hooks/session-start.sh` |
| Hors classement | Le chef d'un salon qui anime seulement : il répond pour le plaisir, et rien de lui ne compte | `horsClassement` |
| Hors ligne | Un invité dont aucune connexion n'est ouverte ; seul l'instantané des écrans d'animateur le dit | `Party.isConnected`, `connected` |

## I

| Terme | Ce que c'est | Dans le code |
|---|---|---|
| Identifiant discret | L'identifiant d'un profil qui naît, déduit du prénom et montré sur une ligne (« Pour te reconnecter : camille »), modifiable d'un toucher | `IdentifiantDiscret`, `identifiantPour` |
| Ils te talonnent | Pour qui est en tête du classement, les 3 classés qui le suivent, à la place d'« À ta portée » | `ClassementDesDuels.enTete` |
| Instantané (d'un partage) | La copie d'un quiz prise au moment d'un partage — code ou catalogue —, que les retouches d'après ne suivent pas | `Instantane` |
| Instantané (de la salle) | L'état de la salle — invités, équipes, prix, partie en cours, code —, diffusé en deux versions, dédoublonné et regroupé | `party:snapshot`, `PartySnapshot` |
| Intertitre | Une diapo sans réponse ni points avant une question (« Manche 2 : le cinéma ») | `intertitre` |
| Invité fantôme | Un invité simulé qui rejoint une soirée et répond au hasard, faute de second téléphone | `server/scripts/fake-player.mjs` |
| Ivoire | Le Velours passé sur papier crème, pour un vidéoprojecteur qui délave les noirs ; l'écran commun y passe par « Fond clair », et il est offert aux profils | `client/src/theme.ts` |

## J

| Terme | Ce que c'est | Dans le code |
|---|---|---|
| Jeton | Le secret qu'un téléphone garde pour retrouver sa fiche, qui ne vaut que dans son espace | `token`, `quizz.me.<espace>` |
| Jeton de la réserve | Le secret qui ouvre les six routes de la routine du matin, et rien d'autre — mais qui lit les bonnes réponses à venir | `porteDeLaReserve` |
| Joué ce soir | Un quiz choisi dans une partie de la soirée, même interrompue : le programme ne le repropose plus | `lancementDeQuiz` |
| Joueurs croisés | Des profils rencontrés en soirée, en duel, au défi de la semaine, ou de cote proche, proposés à défier ou à ajouter | `joueursCroises` |
| Jours d'avance | Les questions prêtes de la réserve divisées par dix, arrondi en dessous ; le QG s'inquiète sous sept | `etatDeLaReserve` |
| Juge de la base | Le contrôle qui accepte une question de la base, ou la refuse au premier défaut | `lireQuestionDeLaBase` |
| Jumelles | Deux questions de même forme d'intitulé, ou avec deux réponses en commun, qu'une série évite de poser ensemble | `server/src/core/jumelles.ts` |

## L

| Terme | Ce que c'est | Dans le code |
|---|---|---|
| Laissée en plan | Une soirée sans un signe de vie depuis six heures, que le QG peut clore | `EN_PLAN_MS` |
| Laurier | La marque des vainqueurs d'hier, portée près du prénom jusque dans les soirées, qui grandit avec les victoires | `niveauDuLaurier` |
| Laurier d'argent | La marque du vainqueur du défi, portée près de son prénom toute la semaine suivante, y compris en soirée | `vainqueursDuDefi` |
| Libérer une épreuve | Le geste du QG qui referme l'épreuve qui attend un joueur, sans lui coûter de vie ni compter un échec | `libererEpreuve` |
| Lien d'activation | Le lien qui donne son mot de passe à un compte d'avant : sept jours, une seule fois | `createActivation`, `activations` |
| Ligne `#campagne` | La ligne d'expérience qui porte toute l'expérience de campagne. Elle est réécrite en entier à chaque bonne réponse | `LIGNE_CAMPAGNE` |
| Ligne `#jour` | La ligne d'expérience du quiz du jour : elle compte dans le total et le niveau, pas dans l'historique des soirées | `LIGNE_JOUR` |
| Ligne d'expérience | Une ligne par profil et par soirée, remplacée à chaque crédit et jamais ajoutée, plus quatre lignes à part (`#paliers`, `#jour`, `#campagne`, `#rattrapage`) ; le total en est la somme | `LIGNES_A_PART` |
| Ligne d'or | Sur la barre d'une épreuve, la limite que les fautes ne doivent pas franchir | `BarreDEpreuve` |
| Ligue | Une tranche de cote, une tous les 100 points, du bronze aux maîtres, qui paie ses confettis chaque lundi | `LIGUES` |
| Liste collée | Un quiz écrit en texte — un bloc par question, l'étoile devant la bonne réponse —, que « Coller une liste » lit | `parseImportedQuestions` |
| La loge | L'écran « M'habiller » : tout ce qu'un profil porte, en six pièces qu'on essaie avant de les porter | `client/src/components/Loge.tsx` |
| Lot (d'écritures) | Ce qu'un passage du moteur envoie au miroir en une seule transaction : gains, réponses, effacements et état de la partie | `ouvrirLot`, `fermerLot` |
| Lot (de questions) | Un fichier de questions écrit par un agent, qui attend sa relecture et son rangement dans `.lots-campagne/` | `server/scripts/lots-campagne.ts` |
| Lumière | Ce qui déborde autour de l'avatar aux trois dernières finitions : le Diamant (Prisme), les Voiles (Aurore), l'Astrolabe (Constellation) | `client/src/components/Lumiere.tsx` |

## M

| Terme | Ce que c'est | Dans le code |
|---|---|---|
| Ma collection | L'écran de tout ce qui se gagne — ce qu'on a, ce qui reste et où le gagner —, où l'on ne porte rien | `shared/collection.ts` |
| Marche | La difficulté d'une question tirée de la base — facile, moyen, difficile, expert —, que le quiz ne garde pas : sa mémoire la porte | `MemoireDuQuiz` |
| Marge | Les 1,5 s pendant lesquelles une question reste ouverte après l'échéance affichée, pour les réponses en route | `GRACE_MS` |
| Marque d'homonymie | « (2) », ajouté à l'affichage au second invité de même prénom et de même avatar qu'on voit — le dessin porté, sinon l'emoji —, jamais écrit en base | `nomsAffiches`, `visageDe` (`shared/homonymes.ts`), `nomAffiche` |
| Masquer (un profil) | Retirer un profil des classements et des récompenses de la nuit du quiz du jour, sans qu'il en soit averti ; il se voit toujours | `jour_masques` |
| Meilleures ventes | Les thèmes et les compagnons les plus vendus, ces trente jours d'abord puis depuis toujours, sur la page de l'économie du QG — huit au plus ; un thème à prix nul n'est pas une vente | `meilleuresVentes` (`shared/qgEconomie.ts`) |
| Mélange | La répartition des seize questions d'un palier entre faciles, moyennes, difficiles et expertes : celle du code, ou celle que l'administrateur règle au QG pour les douze sentiers | `Melange`, `PALIERS`, `sentier_melanges` |
| Même fait | Deux intitulés différents qui posent le même fait. Ils sont refusés comme un doublon | `memeFait` |
| Mémoire des quiz | Ce que l'historique sait de chaque quiz et de chaque question — joué combien de fois, trouvée par combien —, dérivé des fiches des soirées | `server/src/core/memoire.ts` |
| Ménage | L'effacement des pièces que plus aucun quiz ne cite, une heure après, jamais celles d'une partie, d'une soirée archivée ou d'un partage vivant | `pruneImages` |
| « Mes trophées » | Le panneau de la pièce « Vitrine » de la loge : les trophées gagnés, à toucher jusqu'à trois, dans l'ordre où la carte les montrera — « Mes hauts faits » jusqu'au 13 octobre 2026 | `MaVitrine` (`client/src/components/Trophees.tsx`) |
| Mesure | La phase où une estimation en direct, close, attend la valeur que l'animateur tape | `cible` |
| Mesure des pages | Ce que chaque page fait attendre à un téléphone bridé, cache vide puis plein, avant et après une retouche | `server/scripts/mesure-pages.ts` |
| Miroir | La copie de la soirée en cours dans la base permanente (les tables `party_*`), d'où elle se recharge quand le disque est reparti vide | `PartyBackup` |
| Mise de côté | Une question gardée dans le quiz sans être jouée — ni prête, ni à compléter | `deCote` |
| Mode (d'une partie) | Ce que joue une ligne de `campagne_series` : une série, une révision, un défi, une épreuve de sentier, un parcours, un duel ou une rencontre | `campagne_series.mode` |
| Mode « en ligne » | Ce que le serveur active quand `RENDER` est posée ou que `NODE_ENV` vaut `production` : refus sans base permanente, cookies `Secure`, origine publique imposée | `online` |
| Modèle | Un des onze quiz livrés, fichier de `server/content/quiz/`, qu'on copie dans sa bibliothèque | `lireModeles` |
| Modèle du savoir | L'ajustement, sur la première réponse de chacun, des forces des joueurs, de leurs écarts par catégorie et des difficultés des questions ; seul Automate le lit | `server/src/core/modeleDuSavoir.ts` |
| Module de jeu | Les règles d'un jeu branchées sur le moteur : phases, chronomètres, barème et vues | `quizModule` |
| Mois complet | Le haut fait de qui a joué chaque jour de quiz d'un mois qui en a eu vingt-huit au moins | `JOURS_D_UN_MOIS_COMPLET` |
| Motif | Le message en français qu'une page montre quand une requête échoue, et qui dit quoi faire | `MOTIFS` (`shared/erreurs.ts`) |
| Multiplicateur | ×1, ×2 ou ×3 sur tout ce que rapporte un quiz, choisi au lancement ou réglé au programme | `multiplier` |

## N

| Terme | Ce que c'est | Dans le code |
|---|---|---|
| Ne plus l'attendre | Le geste de l'animateur qui dispense un téléphone mort d'être attendu à chaque question | `dispenses` |
| Niveau | Ce que l'expérience donne sur la courbe 60 × (n − 1)², ou celui qu'une courbe d'avant avait donné, s'il est plus haut et qu'elle le donne encore | `niveauDuProfil` |
| Niveau d'Automate | Le score qu'Automate vise sur une série : le niveau de campagne du joueur pendant son placement, puis celui de sa cote | `niveauPourLeDuel` |
| Niveau de campagne | Le score qu'un joueur ferait en moyenne sur une série tirée pour lui, d'après ses réponses de campagne | `scoreDeReference` |
| Nom d'espace | Le nom d'un espace dans l'adresse (`chez-nadia`) : 2 à 24 minuscules, chiffres ou tirets, ni réservé ni fait de six chiffres | `isValidSlug`, `SLUG` (`shared/space.ts`) |
| Nom d'une soirée | Son identifiant figé : le jour et l'instant de sa première question jouée, et une empreinte de l'espace | `archiveIdOf`, `soireeEnCours` |
| Nom réservé | Un premier segment d'adresse que l'application emploie elle-même, et qu'aucun espace ne peut porter | `RESERVED_SLUGS` (`shared/space.ts`) |
| « Nouveau » | La pastille de ce qu'une pièce a gagné depuis le dernier passage, sur ce téléphone | `nouveautes` |
| La nuit | La clôture des jours passés — classement relu, podium payé, hauts faits de la nuit, laurier passé — faite à la première demande du lendemain, rien ne tournant à minuit | `clorePasses` |

## O

| Terme | Ce que c'est | Dans le code |
|---|---|---|
| Objet | Ce qui s'achète en confettis et sert en jeu : la vie des sentiers et le sablier de la série | `OBJETS` |
| Onglets nommés | Les onglets que la console ouvre et réutilise : trois clics sur « Mes quiz » n'ouvrent qu'un éditeur, et jamais une seconde console | `ONGLETS` (`client/src/onglets.ts`) |
| Orpheline | Une pièce que plus aucun quiz ne cite, en attente du ménage ; son heure de grâce compte depuis ce moment | `orpheline_depuis` |

## P

| Terme | Ce que c'est | Dans le code |
|---|---|---|
| Page sans espace | Une page dont l'adresse ne porte pas d'espace (`/host`, `/profil`, `/jour`…) : treize, lues avant les noms d'espace | `ACCOUNT_PAGES` (`shared/adresses.ts`) |
| Palier | Une marche d'un sentier, validée par une épreuve ; le douzième est le sommet, le treizième celui du maître | `PALIERS` |
| Palier de maître | Le palier facultatif d'après le sommet : seize expertes, neuf pour valider, un titre au bout | `PALIER_DU_MAITRE` |
| Palmarès | Les prix que les chiffres désignent, un lauréat chacun, remis ou non : vingt individuels, deux d'équipe | `computeStats`, `SPECS` (`server/src/core/stats.ts`) |
| Paquet | Le serveur construit en un seul fichier, que Render démarre sans traduire de TypeScript | `server/scripts/empaqueter.ts` |
| Parcours de thème | Un sujet de la campagne monté en six étapes de dix questions, sans vies, dans l'onglet « Apprendre » ; un « sentier à thème » dans le code | `shared/sentiersDeSujets.ts` |
| Partie | Un quiz joué dans un espace, du choix du quiz à son podium — une seule à la fois par espace | `GameEngine` |
| Partie du jour | Ce qu'un profil a joué un jour donné : commencée, ses questions servies une à une, finie ou laissée | `jour_parties` |
| Pastille d'environnement | La marque de chaque page servie hors production : une pastille en bas à gauche, le nom de l'environnement devant le titre de l'onglet | `APP_ENV`, `<meta name="app-env">` (`server/src/server.ts`, `client/src/main.tsx`) |
| PC de secours | Un PC qui reprend une soirée depuis la base de production quand l'hébergeur ne revient pas, sur une base locale neuve | `DB_PATH` |
| Personnage | La fiche d'un invité ou d'une animatrice de la tablée : qui, quel appareil, quelle arrivée, quel scénario, ce qu'il regarde | `.claude/skills/tablee/personas/` |
| Phase | L'étape où en est une partie : choix du quiz, compte à rebours, intertitre, photo à mémoriser, question, mesure, révélation, podium | `QuizState.phase` |
| Photo à mémoriser | Une photo montrée seule avant la question, puis retirée : ni l'intitulé ni les réponses ne partent pendant ce temps | `observeSeconds` |
| Photo attendue | La photo qu'une liste collée annonce par son nom de fichier ou ce qu'elle montre ; tant qu'elle n'est pas jointe, la question ne se joue pas | `photoAttendue` |
| Photo de la révélation | Une seconde photo, montrée à la révélation — « le bébé, puis l'adulte » | `imageRevelation` |
| Pièce (d'une question) | Ce qu'une question garde à part, sous une adresse `/media/image/…` : sa photo, la photo de la révélation, l'extrait d'un blind test | `PIECES_DE_QUESTION` |
| Pièce (de la loge) | Une des six choses qu'on porte : Avatar, Titre, Vitrine, Fond (ce que la salle voit), Thème, Gerbe (ce que soi seul voit) | `PIECES_DE_LA_LOGE` |
| Pilote | La commande par laquelle un agent de la tablée fait un geste — voir, toucher, écrire, répondre —, un geste par commande | `server/scripts/tablee/pilote.mjs` |
| Piste | Un trophée qui se cumule sur la carrière et monte en trois étapes — bronze, argent, or —, chacune disant ce qu'elle ouvre ; le code dit « haut fait de carrière » | `shared/pistes.ts` |
| Piste du jour | Un trophée de carrière en trois étapes que seul le quiz du jour décerne (L'Assidu, Le Champion du jour, Le Sans-Faute, L'Élite, L'Infatigable) ; le code appelle chaque étape un palier | `accorderPaliersDuJour` |
| Placement | Les 10 premiers duels d'un joueur, qui comptent double ; Automate y vise son niveau de campagne | `DUELS_DE_PLACEMENT` |
| Planche | Une image où chaque dessin peint paraît dans tous ses états, rendue par les vrais composants, sans serveur | `server/scripts/planche-medaillons.ts` |
| Les plus beaux | Les trois trophées qu'une carte montre quand son profil n'a pas choisi sa vitrine — exploits et plus hautes étapes de piste, les plus rares d'après une rareté mesurée d'avance | `plusBeaux` |
| Les plus proches | Les trois objectifs commencés les plus avancés : un légendaire, ou l'étape suivante d'une piste | `lesPlusProches` |
| Podium du jour | Les trois marches d'un jour clos, payées 75, 45 et 30 d'expérience, toujours une marche de moins que la salle | `jour_podiums` |
| Points d'équipe | La moyenne, question par question, des lignes du journal jouées pour l'équipe, plus les prix | `finalPoints` |
| Portrait (avatar du savoir) | Un des six avatars peints d'une branche, ouvert par un palier pair de son sentier | `PALIER_DU_PORTRAIT` |
| Portrait du savoir | Un des soixante-douze avatars peints des sentiers du savoir, six par branche, un tous les deux paliers | `PORTRAITS` |
| Pouls | Les mesures de la dernière minute que `/healthz` publie, agrégées et sans un nom | `pouls` |
| Pour qui ? | Le geste qui remplit le prénom — ou les deux — et l'accord d'un modèle de fête en le copiant | `personnaliser` |
| Précision | La part de bonnes réponses parmi les QCM répondus, dite sur combien — jamais les estimations | `accuracy` (`PlayerStat`, `shared/types.ts`), `surQcm` (`client/src/format.ts`) |
| Précompression | Les fichiers du client compressés une fois pour toutes au build, et servis tels quels selon ce que le navigateur accepte | `server/src/core/precompresse.ts` |
| Préproduction | Le second service, déployé à chaque fusion sur `main`, sur sa propre base Turso | `APP_ENV` |
| Preuve fraîche | Le mot de passe redemandé pour remplacer ou détacher le profil qui tient un espace, même console ouverte | `prouver` |
| Prix | Une distinction remise à une équipe à l'écran, pour le plaisir : 0 point d'office | `POINTS_D_UN_PRIX` |
| Prix libre | Un prix remis à une équipe pour ce qui ne se calcule pas, avec un motif ; il n'existe que dans « Remis ce soir-là » | `TeamBonus` (`shared/types.ts`) |
| Prix remis | Un prix que l'animateur annonce à l'écran, à zéro point d'équipe d'office | `TeamBonus` (`shared/types.ts`), `host:awardTeam` |
| Profil | Une personne qui joue, d'une soirée et d'un animateur à l'autre : un prénom, un avatar, son expérience et ce qu'elle porte — jamais un avantage de jeu | `ProfileStore` |
| Profil léger | Ce qu'une page de jeu lit d'un profil — prénom, avatar, niveau, ce qu'il porte —, sans l'historique ni l'étagère de sa propre page | `PublicProfile` |
| Programme de la soirée | Les quiz de ce soir dans l'ordre, chacun avec son multiplicateur ; seuls les écrans d'animateur le connaissent | `shared/programme.ts` |

## Q

| Terme | Ce que c'est | Dans le code |
|---|---|---|
| QG | La page de l'administrateur : la vue d'ensemble, le journal, la santé du serveur, une page par sujet | `client/src/views/AdminApp.tsx` |
| Question prête | Une question que la partie jouera : un intitulé, ses réponses et sa bonne réponse, sa photo attendue jointe, ses temps dans les bornes | `toPlayable` |
| Question servie | La question montrée au joueur : son chronomètre part à cet instant, et passé l'échéance elle se compte sans réponse à la lecture suivante | `expirer` |
| Qui dans la salle ? | Une question dont les réponses sont les invités : un vote, sans points ni ligne au journal | `sondage` |
| Quiz du jour | Dix questions, les mêmes pour tout le serveur, à jouer une fois par jour de Paris avec son profil, chronométrées par le serveur | `server/src/core/jour.ts` |
| Quiz tout prêt | Un quiz composé à la demande dans la base de la campagne, rien de la bibliothèque, rangé comme une copie de modèle | `composerUnQuiz` |

## R

| Terme | Ce que c'est | Dans le code |
|---|---|---|
| Rang partagé | 1 + le nombre de concurrents strictement devant : deux premiers ex æquo, puis un troisième | `rangPartage` |
| Rangement | Ce sous quoi une récompense est rangée — le nom d'une soirée, un jour, un mois, une série, une semaine — et qui l'emporte s'il est retiré | `soiree_id` |
| Ranger | Faire entrer un lot vérifié dans le dépôt, sous des identifiants neufs | `server/scripts/base-campagne.ts` |
| Rappel du soir | La seule notification de FiestApp : vers 18 h, aux téléphones abonnés dont la partie du jour n'est pas finie | `server/src/core/rappels.ts` |
| Rareté | La part des profils non suspendus qui ont un trophée, de « Commune » à « Légendaire », muette sous dix profils | `rareteDe` |
| Rareté (d'un thème) | Son rang, de Commune à Légendaire, décrété avec son prix plutôt que mesuré | `PRIX_DES_THEMES` |
| Rattrapage | L'expérience versée une fois aux profils dont le niveau gardé dépassait la courbe du jour, pour qu'elle le leur donne | `rattraperLesNiveauxGeles` |
| Rayon | Le rangement des modèles : « Pour une fête — tu écris les réponses » (`fete`) et « Pour jouer tout de suite » (`jeu`) | `rayon` |
| Re-présentation | Un `player:join` qui porte un jeton reconnu : la fiche du serveur fait foi, et prénom et avatar envoyés sont ignorés | `player:join` (`server/src/sockets.ts`) |
| Recalcul de l'historique | La relecture de toutes les soirées archivées, au démarrage, quand `VERSION_BAREME` a monté | `recalculerHistorique` |
| Récompense du lundi | Les confettis de la meilleure ligue qu'a vue une semaine finie d'au moins 3 duels, relus dans le solde | `recompenseDeLaSemaine` |
| Record battu | Ce qu'une fin de soirée fête quand un profil dépasse toutes ses soirées d'avant : série, bonnes réponses, précision | `recordsBattus` (`server/src/core/objectifs.ts`) |
| Record par catégorie | La meilleure série finie jouée sur une seule catégorie. Il compte pour Le Tour du monde | `recordsParCategorie` |
| Régie (de la tablée) | Le programme qui tient la tablée : le serveur jetable, les navigateurs, et la porte locale que poussent les agents | `server/scripts/tablee/regie.ts` |
| Régie (de la télécommande) | Ce que la télécommande montre d'une question : le temps, qui l'on attend, puis la répartition | `client/src/games/quiz/Regie.tsx` |
| Réglages du quiz | Le hasard d'un quiz — réponses mélangées, questions dans un autre ordre, tirage de N questions —, tiré une fois au lancement, le même pour toute la salle | `ReglagesDuQuiz` |
| Règle (de Claude) | Le détail d'un domaine pour Claude Code, chargé quand il ouvre un fichier que désigne son en-tête `paths:` | `.claude/rules/` |
| Rejeu | Une épreuve sur un palier déjà validé : aucune vie en jeu, pour les étoiles et leurs confettis | `campagne_series.rejeu` |
| Relais | Un relais TCP devant le serveur, qu'on change en trou noir pour rejouer une liaison morte que socket.io croit vivante | `server/test/relais.ts` (`trouNoir`) |
| Relecture des séries | Le recalcul, au démarrage, des hauts faits des séries et des étapes des pistes de la campagne, une fois par version | `relireLesSeries` |
| Relevé de l'heure | Les mesures d'une heure, réécrites toutes les dix minutes dans la base permanente, que relit la page « Le serveur » du QG | `releve` |
| Remise à zéro | L'effacement du miroir d'un espace, avant celui de la base locale, à la clôture, à l'essai effacé ou à la suppression de l'espace | `remettreAZero` |
| Rencontre d'avant | Un duel au dé d'avant Automate, qui rejouait la série finie d'un autre joueur, dont les réponses restent recopiées | `AdversaireGarde` |
| Rendez-vous | Le jour où une question ratée revient : le lendemain, trois jours après, puis une semaine après | `INTERVALLES_DE_REVISION` |
| Rendre sa place | Le code de six chiffres, valable trois minutes, que l'animateur fait paraître pour qu'un invité au téléphone mort reprenne sa fiche, avec un jeton neuf | `PlacesRendues` (`server/src/core/places.ts`), `player:reprendre` |
| Réponse soufflée | Une bonne réponse dont l'intitulé partage la racine. Elle est acceptée, mais le quiz tout prêt ne la pose qu'en dernier recours | `souffleeParSaRacine` |
| Reprise des portraits | Le passage, une fois, des portraits gagnés avant les sentiers en paliers validés, deux par portrait, sans étoiles | `server/src/core/repriseDesPortraits.ts` |
| Réserve (de vies) | Les vies achetées en confettis : elles ne périment pas et servent après celles du jour | `profile_vies` |
| Réserve (du quiz du jour) | Les questions à choix qui attendent d'être tirées, une seule réserve pour tout le serveur | `jour_reserve` |
| Réserve d'essais | La limite commune à toutes les portes qui vérifient un secret : par adresse, puis par secret visé | `loginBudgetOf`, `LoginBudget` |
| Réserve d'inscriptions | Ce qu'une même adresse peut inscrire d'invités, d'un coup puis par minute, par espace et sur tout le serveur | `ReserveDInscriptions` |
| Restauration | Le rechargement de toutes les soirées depuis le miroir, au démarrage, quand la base locale n'a ni invité ni équipe | `restoreInto` |
| Résultat vu | Un duel lancé, joué par l'autre, dont l'auteur a retourné la carte du verdict : l'accueil ne le compte plus | `campagne_duels.vu_le` |
| Resynchronisation | La relecture d'un espace dans la base locale, renvoyée au miroir pour ce qui y manque ou a changé — sans jamais rien y effacer | `resynchroniser` |
| Retardataire | Un invité arrivé pendant une partie : il joue à partir de la question qu'il a encore le temps de lire | `playFrom` |
| Retirer un ami | Le seul blocage : ses duels et ses défis ne parviennent plus, sans qu'il le sache | `aRetire` |
| Retrait | La sortie définitive d'une question de la campagne, pour tous | `campagne_retraits` |
| Réveil | Le démarrage d'un service endormi, sur un disque effacé ; la page « Le serveur » le distingue d'une mise en ligne, d'une relance et d'un redémarrage après un arrêt net | `sorteDuDemarrage` |
| Révision | Une partie sans vies de dix questions au plus, tirées du carnet, les plus en retard d'abord | `commencerRevision` |
| Routine du matin | La routine Claude Code qui remplit chaque matin la réserve du quiz du jour et la base de la campagne, et réveille la production au passage | `RESERVE_TOKEN` |

## S

| Terme | Ce que c'est | Dans le code |
|---|---|---|
| Sa place dans la course | Les trois lignes du téléphone à chaque révélation : l'étiquette, la place, la cible nommée — les bonnes nouvelles seulement | `ligneDeCourse` |
| Sablier | L'objet qui couvre un jour manqué au quiz du jour : la série tient, sans compter ce jour-là | `PRIX_D_UN_SABLIER` |
| Saison | Halloween, Noël ou le Nouvel An : une période qui ouvre son légendaire, par quelques jours de quiz du jour ou une soirée jouée ces jours-là | `shared/saisons.ts` |
| Salle des tests | Le moteur du quiz joué seul, sans serveur, sur une base en mémoire et une horloge qu'on avance à la main, pour viser un instant précis | `server/test/salle.ts` (`salle`, `horloge`) |
| Salle du jour | Les joueurs d'un jour, masqués et suspendus écartés ; certains hauts faits demandent qu'ils soient huit au moins | `SALLE_DU_JOUR` |
| Salle socket.io | Un groupe de connexions auquel le serveur émet : tout l'espace, ses écrans d'animateur, ou les connexions d'un invité | `space:<espace>`, `hosts:<espace>`, `player:<invité>` |
| Salon | La soirée d'un espace, ouverte par son animateur — depuis son téléphone (« Créer un salon ») ou son écran commun —, avec son code | `SalonStore` (`server/src/core/salons.ts`) |
| Salon (l'espace) | L'espace qu'un profil ouvre par « Créer un salon » : identifiant `p-…`, adresse `s-…`, aucun mot de passe | `estUnSalon` |
| Sauvegarde en retard | L'état d'un espace dont le miroir échoue depuis dix secondes, que seuls l'écran commun et le QG affichent | `sauvegardeEnRetard` |
| Scène | L'écran de fin que montrent ensemble tous les écrans d'animateur — podium, remise des prix, victoire, clôture —, tenu par le serveur | `poserScene`, `Scene` (`shared/types.ts`) |
| Script de rendu | Un script qui rejoue un écran sur un serveur jetable et le photographie dans Chromium : l'œil avant et après une retouche, pas un test | `server/scripts/rendu-ecran.ts` |
| Second « Rachid » | La fiche qu'un invité au téléphone mort a créée sur un téléphone emprunté avant de reprendre sa place : effacée s'il n'a rien joué, laissée et plus attendue sinon | `laisserPlace` (`server/src/core/space.ts`) |
| Sentier (du savoir) | Le chemin d'une branche, douze paliers puis un palier de maître, où se gagnent ses six portraits ; le deuxième onglet de la campagne | `shared/sentiers.ts` |
| Série | Les jours d'affilée joués — quiz du jour commencé ou soirée —, que seul minuit casse | `serieDe` |
| Série (à trois vies) | Une partie de campagne qui monte de marche en marche jusqu'à la troisième erreur, avec 60 questions au plus | `tirerUneSerie` |
| `SERVEUR` | Le dossier `server/`, d'où se compte tout chemin du serveur, en sources comme dans le paquet | `server/src/racine.ts` |
| Service worker | Le script du navigateur qui affiche la notification et ouvre sa page — sans cache ni interception des requêtes | `client/public/sw.js` |
| Seuil | Les bonnes réponses qui valident un palier — dix sur seize, neuf au maître —, figé dans l'épreuve à son départ | `SEUIL_DES_PALIERS` |
| Une seule fin à la fois | Un second « Clore » attend le premier et en reçoit l'issue ; le geste contraire est refusé | `finEnRoute` |
| Signalement | Une phrase qu'un joueur écrit sur une question qu'il croit fausse, relue par l'administrateur | `campagne_signalements` |
| Skill | Une procédure en plusieurs étapes — la tablée, les rendus, la base de la campagne, les images peintes — que Claude Code charge quand la tâche la demande | `.claude/skills/` |
| Smoke | Le test de bout en bout : de vrais serveurs sur des bases jetables, une soirée entière rejouée, arrêtée à la première assertion fausse | `server/scripts/smoke.ts` |
| Soirée laissée en plan | Une soirée pas close, sans un geste depuis six heures, que l'administrateur peut clore depuis le QG | `EN_PLAN_MS` (`shared/qg.ts`) |
| Soirée qui compte | Une soirée où le profil a répondu à une question posée à deux joueurs au moins ; jouée seul, elle reste dans l'historique sans compter pour la carrière, l'Éclat, les confettis ni les saisons | `soireeQuiCompte` |
| Solde (de confettis) | Ce qu'un profil a gagné moins ce qu'il a dépensé, recompté à chaque lecture et jamais écrit ; il peut passer sous zéro | `ProfileStore.boutiqueEtDons` |
| Sonde | La demande d'heure qui vérifie qu'une liaison vit encore, et la rouvre si elle se tait deux secondes | `verifierLiaison` (`client/src/socket.ts`) |
| Souffle | Les 0,7 s entre la dernière réponse attendue et la révélation, relancées par un changement d'avis | `SETTLE_MS` |
| Souvenir | La page publique d'une soirée : podium, équipes, prix remis, palmarès, trophées, chiffres | `buildRecap` (`server/src/core/recap.ts`) |
| Suivi du jour | Ce que la page du quiz du jour au QG montre à côté de la réserve : le tirage d'aujourd'hui question par question, le classement du mois, les séries qui tiennent, le rappel du soir | `SuiviDuJour` |
| Sujet | Un choix de série qui traverse les catégories : un thème, une époque ou un fil rouge | `shared/sujets.ts` |
| Suspendre (un profil) | Fermer un profil sans rien effacer : ni connexion, ni place aux classements, jusqu'à sa réactivation | `profiles.disabled_at` |
| Synthèse | Les axes d'amélioration tirés d'une tablée ou d'un audit, vérifiés un à un, archivés avec les retours bruts | `retours/2026-09-24/synthese.md` |

## T

| Terme | Ce que c'est | Dans le code |
|---|---|---|
| Tablée | Une soirée jouée par des agents qui incarnent des invités et une animatrice, chacun dans un vrai navigateur, pour recueillir leurs retours | `.claude/skills/tablee/SKILL.md` |
| Taux lissé | La part de joueurs qui trouvent une question, mêlée de vingt réponses fictives tirées de sa difficulté estimée | `tauxLisse` |
| Télé branchée | Une télé ouverte sur `/tele` et validée par un code d'appairage depuis un téléphone : un écran de salle, sans console, pour 24 heures au plus | `ecranDeSalle`, `server/src/auth/appairage.ts` |
| Télécommande | La console tenue sur un petit écran : l'étape, les gestes en grand, la régie — jamais la réponse avant la salle | `host:telecommande`, `client/src/telecommande.ts` |
| Temps de lecture offert | Les premières secondes d'un QCM, pendant lesquelles le bonus de rapidité ne fond pas | `tempsDeLecture` |
| Test de charge | Une salle entière simulée contre un serveur qui tourne, ses temps d'inscription, de diffusion et de révélation mesurés | `server/scripts/load-test.mjs` |
| Thème | L'habillage de toutes les pages d'un profil — couleurs, polices, décor —, sur tout appareil où il est connecté ; jamais celui de l'écran commun | `shared/themes.ts` |
| Thème de saison | Un thème en boutique pendant sa période seulement (Halloween, le Nouvel An…), gardé toute l'année une fois acheté | `enBoutique` |
| Thème gagné | L'un des cinq thèmes légendaires qui ne se vendent pas : un exploit les ouvre, et ils se relisent à chaque lecture | `themeGagne` |
| Thème offert | Velours ou Ivoire, à tous les profils, sans rien payer | `THEMES_OFFERTS` |
| Tirage | Les questions d'un jour, choisies à sa première demande puis figées pour tous, réponses mélangées par une graine tirée du jour | `jour_tirages` |
| Titre | Le nom d'un haut fait ou d'une piste gagnés, d'un titre de champion du mois ou de maître d'un sentier, porté sous le prénom | `titrePorte` |
| Titre de maître | « Maître de la forêt » : le titre que donne le palier de maître, porté sous le prénom comme celui d'un haut fait | `cleDeMaitre` |
| Titulaire | Le profil qui tient un espace : se connecter à lui ouvre la console de cet espace | `accounts.profile_id` |
| Tour | Le numéro de pose d'une question, qui avance aussi quand on la repose : il dit quelle pose un geste ou une réponse visait | `round` |
| Tour de rôle | La règle qui fait alterner les catégories, puis leurs sous-thèmes, dans une série | `TourDeRole` |
| Tournée | Le passage du rappel du soir, une fois par jour entre 18 h et 22 h, chaque téléphone réservé en base avant l'envoi ; son bilan du soir se garde pour le QG | `jour_rappels_tournees` |
| Tout revoir | Une révision qui repasse aussi les questions en attente de leur rendez-vous et celles déjà apprises | `commencerRevision` (`tout`) |
| Toute la catégorie | La règle des paliers 9 à 13 : chaque sous-thème de la catégorie a sa question avant qu'un autre en ait deux | `touteLaCategorie` |
| Trois gros boutons | Le premier écran de l'entrée d'une soirée et de l'accueil sans profil : « Jouer sans compte » d'abord, puis « Me connecter » et « Créer un profil », de même taille | `client/src/components/Entree.tsx`, `client/src/components/ProfilForm.tsx` |
| Trophée | Tout ce qui se gagne par un exploit : les hauts faits, les pistes, les prix du palmarès, les maîtres des sentiers, les ligues des duels ; l'album de « Ma collection » les range par mode | `shared/trophees.ts` |
| Trou | Ce qui reste à écrire dans un modèle de fête — une réponse marquée ✏️, un « [Prénom] » — : la question n'est pas prête tant qu'il reste | `trouDeLaQuestion` |
| « Trouvée par » | La part des joueurs du jour qui ont trouvé une question, dite à partir de trois réponses | `TROUVEE_PAR_DES` |
| « Tu t'en approches » | Deux objectifs au plus, avancés ce soir et passés à moitié : un avatar légendaire, l'étape suivante d'une piste | `approchesDeLaSoiree` (`server/src/core/objectifs.ts`) |

## U

| Terme | Ce que c'est | Dans le code |
|---|---|---|
| `uid` | L'identifiant d'un gain ou d'une réponse, tiré à l'écriture locale, qui rend une recopie rejouée sans doublon | `server/src/core/scores.ts` |

## V

| Terme | Ce que c'est | Dans le code |
|---|---|---|
| Variante | Ce qu'un QCM devient : « plusieurs » (toutes les bonnes, et elles seules), « ordre » (le bon ordre entier), « sondage » (Qui dans la salle ?) | `Variante` |
| Veille | L'endormissement d'un service gratuit après quinze minutes sans trafic, qu'une tâche de cron-job.org empêche de 7 h à minuit | `render.yaml` |
| Velours | L'habit de FiestApp — un noir chaud, du champagne, une serif — : celui de l'écran commun, de l'invité sans profil et de toute page sans thème | `client/src/styles.css` |
| Verify | La chaîne à lancer avant chaque commit — typecheck, tests, build, smoke —, arrêtée à la première étape qui échoue | `package.json` (`verify`) |
| Verrou de connexion | Un secret fermé un quart d'heure après cinq échecs ; l'administrateur peut le lever | `ECHECS_AVANT_VERROU`, `rouvrir` |
| Version rare | L'apparence d'un avatar éclaté ; on peut porter à la place sa version d'origine, l'Éclat restant compté | `brilleChez` |
| Vies du jour | Les douze vies que partagent tous les sentiers, rendues à minuit, heure de Paris | `VIES_PAR_JOUR` |
| Visée | La phase, la question et le tour que porte un geste de l'animateur (la question et le tour pour une réponse) ; périmée, le geste est ignoré | `perimee` |
| Vitrine | Les un à trois hauts faits gagnés qu'un profil choisit de montrer sur sa carte | `vitrineChoisie` |
| Voie | Une des façons d'ouvrir un légendaire — une seule suffit ; une voie « toutes » demande plusieurs conditions à la fois | `voiesDe` |
| Voisines | Des intitulés presque pareils dans un même sous-thème, montrés sans être refusés | `presquePareils` |
| Vue | La partie calculée pour un destinataire : la sienne pour chaque participant, celle de l'animateur pour les écrans | `session:view`, `playerView`, `hostView` |
| Vue filtrée | Ce qu'un écran reçoit de la partie, calculé pour lui — jamais l'état brut, donc jamais la bonne réponse avant la révélation | `playerView` · `hostView` |

## Pour aller plus loin

- [FiestApp en une page](../produit/vue-d-ensemble.md) — les modes de jeu et les gens, d'un coup d'œil
- [L'architecture](../architecture/vue-d-ensemble.md) — comment ces notions tiennent ensemble
- [Les barèmes](baremes.md) — les chiffres derrière les mots
