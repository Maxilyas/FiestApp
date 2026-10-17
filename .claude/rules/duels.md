---
paths:
  - "shared/duels.ts"
  - "server/src/core/{campagne,modeleDuSavoir}.ts"
  - "server/src/campagne.ts"
  - "client/src/views/{Duels,Duel,LancerUnDefi,Joueurs,Amis}.tsx"
  - "client/src/views/{Rencontre.tsx,adressesDesDuels.ts}"
  - "client/src/components/{Blason,GestesDuJoueur,CarteDUnProfil,FeuilleDesAmisADemande}.tsx"
  - "server/scripts/{rendu-duels,rendu-bordures,duelsDEssai,calibrage-automate,calibrage-duels}.ts"
  - "server/test/{duels,duels-attente,duels-contre,duels-de,duels-enjeu,duels-historique,duels-montee,duels-page,duels-place,campagne-amis,campagne-duel,campagne-rencontre,amis,amis-feuille,joueurs-croises,tirage-sans-redite,bordures,modele-du-savoir,calibrage-duels}.test.ts"
---

# Les duels : la cote, les ligues, Automate, défier quelqu'un, les amis

Trois sortes de parties, toutes des séries de la campagne d'un autre mode
(`campagne_series.mode`) : le duel au dé contre Automate (`'rencontre'`), le
duel classé contre quelqu'un (`'duel'`, `campagne_duels.adversaire` posé), et
le défi entre amis d'avant (`'duel'`, `adversaire` NULL — amical, plus lancé
par la page depuis le 11 octobre 2026, encore joué et lu jusqu'à sa
fermeture). Rien ne se joue en direct, et rien ne sonne : seul le quiz du
jour a sa notification (règle `rappel-et-installation.md`).

## Les fichiers

- `shared/duels.ts` — tout ce qui se calcule, pur : les deux cotes — la
  cachée, l'ELO seul (`coteDuScore`, `chancesDeGagner`, `ecartContre`, le
  placement `DUELS_DE_PLACEMENT`), et celle qu'on voit, la montée
  (`ecartDeLaMontee` — 24 × E² en Or, l'ELO dès la Platine, `LIGUE_DE_L_ELO`
  —, `apresLeDuel`, `plancherApres`, `MONTEE` et ses constantes,
  `LIGUES_GARDEES` — la Platine comprise ; la force d'en face,
  `forceQuOnVoit` — au dé, sa propre cote ; ce qu'un duel mettrait en jeu :
  `enjeuContre`, `enjeuDuDe`) —, le nom d'Automate (`AUTOMATE`, que la
  feuille du dé montre avant de tirer), les ligues (`LIGUES`, `ligueDe`), la
  relecture du journal (`releverLesDuels` : les deux cotes, le plancher,
  chaque semaine, les crans des bordures), la récompense du lundi (`recompenseDeLaSemaine`,
  `confettisDesLigues`, dans le solde par `CampagneStore.confettisDe`), la
  bordure portée (`bordurePortee`), le bilan et l'historique
  (`bilanDesDuels`, `pageDeLHistoire`), les types de la page
  (`EtatDesDuels`, `DuelsDAccueil`). Ses constantes de cote et de ligues sont
  des choix de produit (CLAUDE.md).
- `core/campagne.ts` — sa moitié duels, dans `CampagneStore` : le dé
  (`commencerUneRencontre` — sur ses catégories ou un sujet, comme une
  série —, `automatePour`, `partieDAutomate`, `ECART_D_AUTOMATE`) ; les
  duels contre quelqu'un et les défis d'avant
  (`creerUnDuel`, `adversaireDuDuel`, `releverUnDuel`, `duel`,
  `envoyerLesPrevus`, `fermerLeDuel`) ; la fin d'une partie qui compte
  (`repondre` : `scoreABattre`, le journal relu dans le lot qui écrit la
  dernière réponse) ; les amis (`idsDesAmis`, `cercleDe`, `mesAmis`,
  `amisDeLaFeuille`, `ajouterUnAmi`, `retirerUnAmi`, `aRetire`) ; la recherche
  et les joueurs croisés (`chercherDesJoueurs`, `joueursCroises`,
  `choisirLesCroises`) ; le classement (`toutesLesCotes`,
  `classementDesDuels`, `rangsAuLundi`, `aSaPortee`, `rangAuxDuels`) ; la page
  et l'accueil (`etatDesDuels`, `duelsContre`, `bilanEtHistoire`,
  `accueilDesDuels`) ; les bordures tenues en mémoire pour la salle
  (`borduresEnMemoire`, `connaitreLesBordures`) ; les lectures du journal
  (`lectureDesDuels`, `lectureDesAdversaires`, `sesDuelsContre`,
  `lecturesDesDuelsContre`, `lectureDesDefisRecus`). Ses tables, dans la base
  permanente : `campagne_duels` (les cotes de chacun figées au lancement —
  `cote_auteur`, `cote_adversaire`, et depuis la montée leurs cachées
  `cote_cachee_auteur`, `cote_cachee_adversaire` —, `vu_le`),
  `campagne_envois`, `campagne_envois_prevus`, `campagne_amis_ajoutes`,
  `campagne_amis_retires`
- `core/modeleDuSavoir.ts` — le modèle du savoir, qu'Automate lit, et la
  page des sentiers pour dire à chacun sa chance (`chanceDeLEpreuve`, règle
  `sentiers.md`) — les marches des séries, des sentiers et du quiz tout prêt
  gardent `tauxLisse` : une force par joueur et par catégorie, une
  difficulté par question, ajustées sur la première réponse de chacun
  (`PREMIERE_REPONSE`), et ce que vaut chaque difficulté estimée, en bloc
  (`decalages`, `ECART_DES_ESTIMATIONS` ; la 3 tient l'échelle — le
  15 octobre 2026, les 5 se trouvaient à 42 %, pas à 10 %) ;
  `ajusterSansBloquer`, `forceDuJoueur`, `serieDeReference`,
  `forcePourLeNiveau`, `chancesSurLaSerie`. Refait en fond par
  `CampagneStore.modeleDuSavoir` (`MODELE_GARDE_MS`), dit à `/healthz` sans un
  nom (`santeDuSavoir`) ; `scripts/calibrage-automate.ts` le mesure sur des
  joueurs simulés
- `server/src/campagne.ts` — les routes, toutes derrière une session de
  profil : `/api/duels` (la page), `/api/duels/historique`,
  `/api/duels/joueurs` (la recherche, et `/:id` — ce que la carte d'un joueur
  en dit), `/api/duels/amis`, `/api/duels/croises` ; `/api/campagne/rencontre`
  (le dé), `/api/campagne/duel` (lancer, lire, relever, `/envoi`),
  `/api/campagne/amis` (`/:id/ajout`, `/:id/retrait`), `/api/campagne/choix`
  (ce que la préparation propose). Les réponses passent par celles de la
  série (`/api/campagne/serie/:id/…`)
- `client/src/views/Duels.tsx` — la page (`/duels`, `PageDesDuels`) :
  cadran, semaine, « Défier » et le dé, les onglets (`lignesEnCours`,
  `PanneauHistorique`, `PanneauClassement`) et ses feuilles ;
  `views/Duel.tsx` — les pièces (`Anneau`, `SemaineEnLosanges`,
  `VerdictDuDuel`, `DuelEnvoye`, la feuille du dé `FeuilleDuDe` et ce qui la
  mène jusqu'au tirage, `LeDe` — la feuille du choix à sa place), la
  page d'un duel (`PageDuDuel`, `DuelFaceCachee`) et le défi d'avant
  (`FinDuDuel`, `EnvoyerAuxAmis`, `MesDuels`) ; `views/LancerUnDefi.tsx` — la
  préparation (`/duels#defier`, `#defier-<id>`) ; `views/Joueurs.tsx` — la
  recherche et `LigneDeJoueur` ; `views/Amis.tsx` — la feuille des amis ;
  `views/Rencontre.tsx` et `views/adressesDesDuels.ts` — ce que l'écran de
  jeu écrit d'un duel, et les adresses. Ce qu'un duel met en jeu se dit d'une
  seule façon, partout où l'on choisit un adversaire (le souhait du
  propriétaire du 14 octobre 2026 : « voir ce que je gagne / perds ») — la
  phrase (`phraseDeLEnjeu` : l'échelle du classement, le nom d'un bouton),
  la ligne « En jeu » (`EnJeu` : la partie, la carte d'un joueur sous
  « Défier »), les deux jetons (`JetonsDeLEnjeu` : un duel reçu, la feuille
  du dé, petits sous l'adversaire choisi d'une préparation) — dans
  `Rencontre.tsx` (`duels-enjeu.test.ts`) ; un duel déjà ouvert entre eux aussi, que la
  carte et la préparation disent des mêmes mots (`DIT_DU_DUEL_OUVERT`)
- `components/GestesDuJoueur.tsx` · `components/CarteDUnProfil.tsx` ·
  `components/FeuilleDesAmisADemande.tsx` · `components/Blason.tsx` — les
  gestes au pied de la carte d'un profil hors d'une soirée (« Défier »,
  l'ajouter, le retirer, lus de `GET /api/duels/joueurs/:id` — un duel déjà
  ouvert entre eux prend la place de « Défier » : où il en est, et de quoi le
  rouvrir), la carte et la feuille des amis à la demande, « Amis » sur
  l'accueil, le blason d'une ligue
- Ailleurs : les parties et leurs fins se jouent dans
  `client/src/views/CampagneApp.tsx`, qui sert `/duels` — la carte du
  verdict, puis ce qui est tombé par l'écran des gains de toute la campagne
  (`GainsDeCampagne` `duel`, règle `recompenses.md` : ses trophées et ce
  qu'ils ouvrent à porter ; « Ce que tu gagnes » seulement à un niveau
  gagné, le verdict disant déjà ce que le duel a fait) ; la tuile et la
  bannière de l'accueil dans `components/AccueilDesRoles.tsx`
  (`boutonDesDuels`, `BanniereDuResultat`) ; la bordure portée dans
  `ProfileStore` (`update` la valide, `bordureDe` la lit de mémoire), son
  choix dans la loge (règle `profil.md`), son dessin (règle `medaillons.md`) ;
  sa ligue sur la carte (`core/carte.ts`)
- `scripts/rendu-duels.ts` (`ECRAN=390x844`, `THEME=ivoire`, `CALME=1`) ·
  `scripts/rendu-bordures.ts` · `scripts/duelsDEssai.ts` (des duels écrits au
  journal pour les rendus, `rendu-ecran.ts` compris) — client construit
  d'abord
- `scripts/calibrage-duels.ts` — les duels mesurés sur une vraie base, en
  lecture seule (le 14 octobre 2026 : « avoir exactement les métriques
  utilisateur » avant de toucher à la cote, dont l'échelle — 1000 = 8 bonnes
  réponses, 50 points chacune — avait été posée sans mesure) : les scores par
  série — allées au bout : une série abandonnée garde des vies —, l'état des
  duels relu par `releverLesDuels` sur `lectureDesDuels` et `duelsLus`
  (exportées pour lui), puis tous les vrais duels rejoués ensemble, dans
  l'ordre où ils ont fini : à l'ELO seul d'avant la montée, aux règles du
  code, et la montée à l'essai sur d'autres échelles ou une autre
  participation (`--echelles 7/50,7/75,7/100`, `--participation`), avec la
  vraie formule (`apresLeDuel` et ses réglages, `ReglagesDeLaMontee`). Son
  contrôle : aux règles du code, sur les cotes figées, le rejeu retrouve les
  deux cotes de chacun — une règle copiée dans le script s'en écarterait
  sans un mot. Il lit
  `PROD_LECTURE_URL` et `PROD_LECTURE_TOKEN` (un jeton en lecture seule),
  **jamais `QUIZ_DB_URL`** : posée pour mesurer, le serveur, `npm run dev` et
  le smoke la liraient et y écriraient dès leur démarrage. Dans le cloud,
  `NODE_USE_ENV_PROXY=1` devant : sans, le `fetch` de Node ignore le proxy et
  ne trouve pas l'hôte (`ENOTFOUND`) — le script le dit. Rien que des SELECT,
  dans une transaction en lecture seule, et des totaux sans un nom — ni
  l'adresse d'une base distante, dont le nom d'hôte peut porter un prénom
  (`calibrage-duels.test.ts`)
- `shared/qgDuels.ts` · `CampagneStore.suiviDesDuelsAuQg` · `annulerUnDuel` — les duels vus du QG (`/admin#duels`, règle `qg.md`) : les duels par jour, les ligues et le classement — « Masquer », et les masqués à y remettre —, les duels classés qui attendent leur adversaire. L'administrateur peut **annuler un duel classé que l'adversaire n'a pas commencé** (le choix du 13 octobre 2026, « Annuler un duel pas joué ») : il se ferme tout de suite, comme à son expiration, et ne compte pour personne — l'adversaire ne peut plus le relever (« Ce défi est fermé »). Commencé de l'autre côté, il compte déjà : il ne s'annule plus (`qg-duels.test.ts`)

## Les pièges

- **Rien ne s'écrit que le journal.** Les deux cotes, le plancher, les
  ligues, les semaines, leurs confettis et les crans des bordures se relisent
  à chaque lecture (`releverLesDuels` sur `lectureDesDuels`) : une donnée de
  plus se dérive du journal, jamais d'une colonne tenue à côté — qui a lancé
  un duel aussi (`DuelJoue.lance`, lu de `campagne_duels.auteur`). Changer
  une constante de la cote, de la montée ou des ligues change donc tout, pour
  tous, rétroactivement — solde de confettis compris —, sauf les cotes figées
  en base au lancement d'un duel contre quelqu'un (`cote_auteur`,
  `cote_adversaire`, `cote_cachee_*`), qui ne se recalculent pas.
- **Deux cotes, et chacune son usage** (la montée, le choix du propriétaire
  du 14 octobre 2026 : « je veux que tout le monde monte en Or s'il joue,
  même s'il n'est pas très bon »). Celle qu'on voit — `ReleveDesDuels.cote` —
  fait les ligues, le classement, les bordures, les confettis et tout ce qui
  s'affiche ; la cachée — `cachee`, l'ELO seul — ne règle qu'Automate
  (`niveauPourLeDuel`) et ne part jamais au téléphone (`duels-montee.test.ts`).
  Automate réglé sur celle qu'on voit, qui monte au-dessus du niveau, se
  renforcerait : on perdrait la moitié des duels au lieu de quatre sur dix,
  et la promesse tomberait. Un enjeu se dit avec le plancher
  (`enjeuContre(moi: SaCote, …)`, `EtatDesDuels.plancher`,
  `FaceAFace.moi.plancher`) et la part du lanceur (`lance`) : sans eux, la
  page annonçait une perte que le plancher empêche, ou un point de moins.
- **Au dé, celle qu'on voit se joue contre elle-même** (`forceQuOnVoit`, le
  choix du propriétaire du 16 octobre 2026, après « je perds 17 pour gagner
  4 ») : Automate joue au niveau de la cachée, et lire son score contre la
  cote qu'on voit, portée 300 points plus haut par la montée, prêtait 88 %
  de chances contre un adversaire qu'on bat quatre fois sur dix. La cachée,
  elle, bouge toujours contre son score : c'est elle qui apprend. Le
  plancher d'un enjeu du dé se lit de la cote même (`enjeuDuDe`) : une ligue
  gardée atteinte, elle ne repasse jamais dessous.
- **L'Or fait monter, la Platine fait jouer** (le choix du propriétaire du
  17 octobre 2026 : « monter jusqu'en platine c'est bien comme ça […] à
  partir de platine c'est là que ça commence vraiment »). En Or, une défaite
  coûte 24 × E² : à chances égales, « +13 / −5 », quatre points par duel —
  qui joue monte en Platine, qui se garde (`LIGUES_GARDEES`). À partir
  d'elle (`LIGUE_DE_L_ELO`), l'ELO, 24 × E : au dé, où l'on gagne quatre
  duels sur dix, « +13 / −11 » ne fait plus monter, et l'on reste au
  plancher — on monte en battant des joueurs. L'ELO dès l'Or, proposé la
  veille, reprenait de 19 à 42 points aux joueurs en Or : le propriétaire
  l'a refusé. Et 24 × E² au-dessus de la Platine mènerait tout joueur
  assidu chez les maîtres pour avoir joué (`duels-de.test.ts`,
  `duels-montee.test.ts`).
- **Contre quelqu'un, seules les cotes d'en face sont figées.** Chacun bouge
  contre les cotes de l'autre au lancement — sa cote qu'on voit contre la
  sienne (`DuelJoue.coteAdverse`), sa cachée contre sa cachée
  (`coteCacheeAdverse` ; un duel d'avant la montée n'en a pas, la seule cote
  figée en tient lieu) —, jamais contre son score — un second profil qui
  rejouerait les questions, réponses connues, choisirait son score, pas sa
  cote —, mais depuis ses propres cotes au moment où le duel compte : l'enjeu
  dit au lancement peut différer de l'écart final. Un défi entre amis
  d'avant ne touche jamais la cote : `lectureDesDuels` ne lit que
  `adversaire IS NOT NULL`.
- **Un duel compte quand ses deux tentatives existent** : joué des deux
  côtés, ou, fermé, commencé des deux côtés (`lectureDesDuels` joint les deux
  séries) ; jamais commencé, il ne compte pas — personne ne perd de points en
  dormant. Corollaires : une rencontre laissée (`finie_le` NULL) ne compte
  pas et ne ferme jamais ; et `oublierProfil` efface les séries d'un profil
  supprimé, ses duels classés quittent donc le journal de ses adversaires,
  dont la cote se relit sans eux (les rencontres d'avant, elles, gardent ses
  réponses recopiées dans `adversaire`).
- **Le score d'en face d'un duel classé ne part jamais avant sa dernière
  réponse**, par aucune porte : `DuelEntreAmis.aBattre` et les lignes de sa
  page, `DuelContre.sesJustes`, `DefiRecu.score` (rempli pour les seuls
  défis d'avant), `AdversaireEnJeu` — le total d'Automate n'arrive qu'avec
  `CoupDeLaRencontre.enTout`. Au dé, le score courant d'Automate se dit après
  chaque réponse, c'est voulu. Un champ neuf qui porte un score d'en face
  attend comme eux : on le lisait avant la première question
  (`duels-contre.test.ts`, `duels-page.test.ts`).
- **Ce que l'accueil compte, la page le montre.** Le chiffre rouge du bouton
  des duels (`DuelsDAccueil.resultats`, `defisRecus`) et l'onglet « En cours »
  lisent la même règle : `sesDuelsContre` (la table `siens` : `ouvert`,
  `joue`, `a_voir`) et `RESULTATS_A_VOIR` pour les résultats, `DEFI_A_LUI`
  pour les défis reçus — un duel classé n'est qu'à qui il défie. La page lit
  tous ses duels en route, ses résultats à voir, puis les dix plus récents
  des autres (`lecturesDesDuelsContre`) : ne lisant que ses dix derniers,
  elle perdait un duel plus ancien encore compté en rouge. Un compteur neuf
  lit la règle de ce qu'il compte, jamais une requête à lui.
- **Un seul duel ouvert entre deux joueurs, et une seule règle pour le
  dire.** Le refus d'un second (`adversaireDuDuel`) et ce que les duels
  disent d'un joueur touché (`faceAFace` : `FaceAFace.enCours`,
  `OuEnEstLeDuel`) lisent `duelOuvertEntre` : la carte disait « Défier », et
  le refus ne tombait qu'au bout de la préparation (le retour du
  propriétaire du 15 octobre 2026). Sa carte le dit à la place de
  « Défier », la préparation sous celui qu'il choisit — elle lit chacun
  qu'il choisit, et « Jouer le duel » attend —, des mêmes mots
  (`DIT_DU_DUEL_OUVERT`, `Rencontre.tsx`). Le classement entier — un
  sablier, et sa légende —, l'échelle et ses amis — « En cours » — le
  marquent de `EtatDesDuels.contre` (`duelEnRouteAvec`, la règle d'« En
  cours ») : un duel lancé contre lui et pas encore parti n'y est pas, sa
  carte seule le dit. **Son code ne part qu'à qui il est** — lancé par lui,
  ou parvenu (`campagne_envois`) : `releverUnDuel` ne vérifie pas qu'un duel
  classé est parti, et son code en main, l'adversaire le jouerait avant
  celui qui l'a lancé (`duels-contre.test.ts`, `duels-page.test.ts`).
- **Lire la page d'un duel le retient vu.** La première lecture de son
  résultat par qui l'a lancé écrit `campagne_duels.vu_le` et répond
  `nouveau` : la carte se retourne, puis l'accueil, la bannière et « En
  cours » ne le comptent plus. Ne la précharge pas, ne la lis pas « pour
  voir » : le résultat serait vu sans l'avoir été.
- **Le dé : un aller-retour avant de répondre, pas un de plus** — un
  `batch` de lectures (sa rencontre laissée, son journal, ses vues et ses
  premières réponses d'un même texte, `lectureDesVues`). L'écriture de la
  rencontre part ensuite, sous le verrou du profil relâché seulement une fois
  écrite (`avecVerrouJusquALEcriture`) : relâché avant, sa première réponse
  chercherait une rencontre que la base n'a pas, et un second dé en tirerait
  une autre. Elle n'entre en mémoire (`enCours`) qu'écrite ; ratée, sa
  première réponse le dit (`rencontresPerdues`). La page s'ouvre aussi d'un
  aller-retour, et le profil d'Automate ne se demande jamais (son
  identifiant vide repartait vers la base, `rencontresEtDuels`).
  `duels-attente.test.ts` compte ceux qui se suivent.
- **Le dé demande avant de tirer, et ne se relance pas.** Sa feuille
  (`LeDe`, `FeuilleDuDe`) dit l'enjeu — à chances égales, lu de la seule
  cote qu'on voit (`enjeuDuDe`) — et sur quoi il jouera ; rien ne part au
  serveur avant « Jouer le duel », et fermée, rien n'est en cours. Il tirait
  d'abord, son enjeu lu contre le score qu'Automate venait de jouer, et sa
  feuille fermée laissait en cours un duel que le joueur n'avait pas lancé
  (le retour du propriétaire du 16 octobre 2026). Ne refais pas dépendre
  l'enjeu du tirage : le dé devrait retirer d'abord. Tirée, la rencontre
  est à lui : laissée, le dé la reprend telle quelle, sur ce qu'elle jouait,
  sans feuille — elle ne s'abandonne pas, et on ne voit rien de la partie
  d'Automate avant sa première réponse. « Un autre duel », sous un verdict,
  passe par la même feuille, sur ce que jouait celui-ci, à sa cote d'après
  (`CampagneApp`). Sur un thème, Automate se règle sur une série de toutes
  les catégories (`automatePour` reçoit toutes les jouables, le tirage
  celles du choix) : réglé sur le thème, il effacerait les points faibles
  du joueur que ses écarts de catégorie font jouer.
- **L'enjeu d'une préparation se lit sur les deux cotes.** Sans la sienne —
  la revanche, qui ne porte que le prénom d'en face, la préparation ouverte
  à son adresse, « Défier » touché avant que la page ait dit la sienne —, la
  page relit ce que les duels savent de celui qu'il défie, sa cote à lui
  avec (`GET /api/duels/joueurs/:id` : `adversaireAttendu`, puis
  `LancerUnDefi` lui-même) : sans elle, rien ne se disait, ou l'enjeu se
  calculait contre une cote de 1000. `Rencontre.tsx`, que la carte d'un
  joueur importe aussi (`GestesDuJoueur`), a son propre morceau du paquet, à
  part de `Defi.tsx` : un petit morceau de plus sur la page de la campagne.
- **Le modèle du savoir se refait en fond, jamais sur le chemin du dé.** Le
  dé lit celui qu'il y a, et lance le suivant **avant** son `batch` s'il a
  vieilli : partie derrière, sa lecture serait un aller-retour de plus. Il
  rend la main par tranches (`CHANCES_PAR_TRANCHE`) : d'un bloc, cent mille
  réponses tiendraient le serveur une seconde.
- **Le classement relit toutes les rencontres finies** de tout le monde :
  gardé (`cotes`) dix minutes au plus (`COTES_GARDEES_MS`), vidé à chaque duel
  fini ici et au départ d'un profil — et la fin de chaque duel le relit
  aussitôt pour dire la place (`rangAuxDuels`). Une lecture de plus par fin
  de duel coûte tout le journal ; celle d'un joueur se lit d'une requête à
  lui.
- **Un masqué, un retiré, un homonyme : partout.** Toute liste de joueurs
  écarte les masqués du quiz du jour (`masque`) — sauf pour eux-mêmes — et
  marque les homonymes à l'affichage (`nomsAffiches`, invariant 17) ; la
  recherche ne renvoie jamais l'identifiant de connexion (elle le compare,
  `ProfileStore.chercher`). Retiré de ses amis, un joueur ne lui fait plus
  rien parvenir (`aRetire`, `lectureDesDefisRecus`) sans l'apprendre : sa fin
  reste la fin normale — « Duel envoyé » et « Chez » son prénom pour un duel
  classé (`DuelEnvoye`), « Parti à » pour un défi entre amis (`FinDuDuel`).
- **La page des duels est servie par le code de la campagne** (`CampagneApp`,
  `DUELS`) : ses parties se jouent sur l'écran de la série. Son code à elle
  (`Duels.tsx`, et ce qu'il tire : `Duel.tsx`) vient à la demande
  (`lesDuels`), demandé par `main.tsx` en même temps que la campagne sur
  `/duels` : un import statique de l'un d'eux dans `CampagneApp` le ferait
  télécharger à chaque ouverture de la campagne — la feuille du dé, sous un
  verdict, s'y rend par `laPageDesDuels.LeDe`. Ce que la partie écrit
  d'un duel tient dans `Rencontre.tsx` et `adressesDesDuels.ts`, qui
  n'importent rien que React.
