---
paths:
  - "shared/duels.ts"
  - "server/src/core/{campagne,modeleDuSavoir}.ts"
  - "server/src/campagne.ts"
  - "client/src/views/{Duels,Duel,LancerUnDefi,Joueurs,Amis}.tsx"
  - "client/src/views/{Rencontre.tsx,adressesDesDuels.ts}"
  - "client/src/components/{Blason,GestesDuJoueur,CarteDUnProfil,FeuilleDesAmisADemande}.tsx"
  - "server/scripts/{rendu-duels,rendu-bordures,duelsDEssai,calibrage-automate}.ts"
  - "server/test/{duels,duels-attente,duels-contre,duels-historique,duels-page,duels-place,campagne-amis,campagne-duel,campagne-rencontre,amis,amis-feuille,joueurs-croises,tirage-sans-redite,bordures,modele-du-savoir}.test.ts"
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

- `shared/duels.ts` — tout ce qui se calcule, pur : la cote ELO
  (`coteDuScore`, `chancesDeGagner`, `ecartContre`, `enjeuContre`, le
  placement `DUELS_DE_PLACEMENT`), les ligues (`LIGUES`, `ligueDe`), la
  relecture du journal (`releverLesDuels` : la cote, chaque semaine, les
  crans des bordures), la récompense du lundi (`recompenseDeLaSemaine`,
  `confettisDesLigues`, dans le solde par `CampagneStore.confettisDe`), la
  bordure portée (`bordurePortee`), le bilan et l'historique
  (`bilanDesDuels`, `pageDeLHistoire`), les types de la page
  (`EtatDesDuels`, `DuelsDAccueil`). Ses constantes de cote et de ligues sont
  des choix de produit (CLAUDE.md).
- `core/campagne.ts` — sa moitié duels, dans `CampagneStore` : le dé
  (`commencerUneRencontre`, `automatePour`, `partieDAutomate`, `AUTOMATE`,
  `ECART_D_AUTOMATE`) ; les duels contre quelqu'un et les défis d'avant
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
  permanente : `campagne_duels` (les deux cotes figées au lancement, `vu_le`),
  `campagne_envois`, `campagne_envois_prevus`, `campagne_amis_ajoutes`,
  `campagne_amis_retires`
- `core/modeleDuSavoir.ts` — le modèle du savoir, que seul Automate lit
  (les marches des séries, des sentiers et du quiz tout prêt gardent
  `tauxLisse`) : une force par joueur et par catégorie, une difficulté par
  question, ajustées sur la première réponse de chacun (`PREMIERE_REPONSE`) ;
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
  `VerdictDuDuel`, `DuelEnvoye`), la page d'un duel (`PageDuDuel`,
  `DuelFaceCachee`) et le défi d'avant (`FinDuDuel`, `EnvoyerAuxAmis`,
  `MesDuels`) ; `views/LancerUnDefi.tsx` — la préparation (`/duels#defier`,
  `#defier-<id>`) ; `views/Joueurs.tsx` — la recherche et `LigneDeJoueur` ;
  `views/Amis.tsx` — la feuille des amis ; `views/Rencontre.tsx` et
  `views/adressesDesDuels.ts` — ce que l'écran de jeu écrit d'un duel, et les
  adresses
- `components/GestesDuJoueur.tsx` · `components/CarteDUnProfil.tsx` ·
  `components/FeuilleDesAmisADemande.tsx` · `components/Blason.tsx` — les
  gestes au pied de la carte d'un profil hors d'une soirée (« Défier »,
  l'ajouter, le retirer, lus de `GET /api/duels/joueurs/:id`), la carte et la
  feuille des amis à la demande, « Amis » sur l'accueil, le blason d'une ligue
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
- `shared/qgDuels.ts` · `CampagneStore.suiviDesDuelsAuQg` · `annulerUnDuel` — les duels vus du QG (`/admin#duels`, règle `qg.md`) : les duels par jour, les ligues et le classement — « Masquer » —, les duels classés qui attendent leur adversaire. L'administrateur peut **annuler un duel classé que l'adversaire n'a pas commencé** (le choix du 13 octobre 2026, « Annuler un duel pas joué ») : il se ferme tout de suite, comme à son expiration, et ne compte pour personne — l'adversaire ne peut plus le relever (« Ce défi est fermé »). Commencé de l'autre côté, il compte déjà : il ne s'annule plus (`qg-duels.test.ts`)

## Les pièges

- **Rien ne s'écrit que le journal.** La cote, les ligues, les semaines,
  leurs confettis et les crans des bordures se relisent à chaque lecture
  (`releverLesDuels` sur `lectureDesDuels`) : une donnée de plus se dérive du
  journal, jamais d'une colonne tenue à côté. Changer une constante de la
  cote ou des ligues change donc tout, pour tous, rétroactivement — solde de
  confettis compris —, sauf `cote_auteur` et `cote_adversaire`, figées en
  base au lancement d'un duel contre quelqu'un et qui ne se recalculent pas.
- **Contre quelqu'un, seule la cote d'en face est figée.** Chacun bouge
  contre la cote de l'autre au lancement (`DuelJoue.coteAdverse`), jamais
  contre son score — un second profil qui rejouerait les questions,
  réponses connues, choisirait son score, pas sa cote —, mais depuis sa
  propre cote au moment où le duel compte : l'enjeu dit au lancement peut
  différer de l'écart final. Un défi entre amis d'avant ne touche jamais la
  cote : `lectureDesDuels` ne lit que `adversaire IS NOT NULL`.
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
  télécharger à chaque ouverture de la campagne. Ce que la partie écrit d'un
  duel tient dans `Rencontre.tsx` et `adressesDesDuels.ts`, qui n'importent
  rien.
