---
paths:
  - "server/src/auth/**"
  - "server/src/core/{inscriptions,budget}.ts"
  - "server/src/profilsAdmin.ts"
  - "shared/{securite,space}.ts"
  - "client/src/views/{AdminApp,AccountApp,LoginApp,ActivateApp}.tsx"
  - "client/src/components/{AdminProfils,AdminSalons,Appairage,Tele,MotDePasse,ChangerMotDePasse,Secours,LienConsole}.tsx"
  - "server/test/{admin-seulement,administration,appairage,profil-unique,profils-admin,securite,espaces,emprunts}.test.ts"
---

# Les comptes, les profils, les sessions, la télé, l'administration

## Les fichiers

- `auth/store.ts` — comptes d'animateurs — c'est-à-dire **des espaces** : `accounts.id` EST le `space_id` — leurs sessions (l'empreinte du jeton, jamais le jeton) et leurs liens d'activation, tout en mémoire, la base écrite d'abord ; ses drapeaux vont dans `meta`, table que partagent aussi les profils et la bibliothèque
- `auth/profiles.ts` — profils de joueurs (autre table, autre cookie)
- `auth/profilUnique.ts` — un seul profil (le choix du 3 octobre 2026) : au premier démarrage qui le connaît (`DRAPEAU`, une fois — une base neuve le pose sans rien parcourir), chaque compte d'animateur d'avant, à mot de passe et sans profil, reçoit le sien — même identifiant, même haché (`ProfileStore.adopter`), un code de secours tiré et jamais montré — et s'y rattache ; un identifiant déjà pris ne se devine pas, l'administrateur le rattache (« Les salons », `POST /api/admin/espaces/:id/titulaire`, qui recopie dans l'espace gardé les quiz de l'espace que le profil tenait, et détache celui-ci). Les portes de console — `/connexion`, l'écran commun — essaient le profil d'abord (`seConnecter`, `client/src/api.ts`) et lui ouvrent son salon s'il n'en a pas (`/api/joueur/espace`, comme « Mes quiz » et « Compte » par `ouvrirParLeProfil`), et « Mon compte » parle du profil dès qu'un profil tient l'espace
- `auth/profileRoutes.ts` — la porte d'entrée : se connecter à son profil ouvre aussi la console de l'espace rattaché
- `auth/http.ts` — cookies, adresse du client, le garde anti-CSRF (`csrfGuard`), les portes (`requireAccount`, `requireAdmin`) et `loginBudgetOf(app)` : la réserve d'essais commune à toutes les portes, où un essai compte comme un échec jusqu'à son jugement ; `refuserLesTeles`, ce qu'une télé branchée ne fait pas
- `auth/appairage.ts` — brancher la télé : le code court qu'elle affiche, validé depuis une console ouverte, et la session d'une soirée qu'elle en reçoit ; `/attente` dit `perime` dans une réponse, jamais dans une erreur. Un écran de salle ne fait aucun geste qui relirait sa session : sa connexion tombe à l'heure de sa fin (`fin_max`, un minuteur posé à `host:hello`, `sockets.ts`) — allumée chez un ami, la télé recevait encore ses soirées des jours plus tard (`appairage.test.ts`)
- `core/inscriptions.ts` — la réserve d'inscriptions des invités, par adresse **et par espace**, plus une large par adresse ; et sa mesure (au refus, à la clôture) qui dira en ligne si l'adresse lue est celle d'un proxy
- `shared/securite.ts` — la page de retour après connexion : jamais ailleurs que chez soi
- `client/src/views/AdminApp.tsx` · `server/src/profilsAdmin.ts` · `client/src/components/AdminProfils.tsx` · `AdminSalons.tsx` — `/admin`, le QG de l'administrateur (règle `qg.md`) : la vue d'ensemble, puis une page par sujet, chacune à son adresse (`/admin#salons`) et ses feuilles — la campagne comprise (`AdminCampagne.tsx` : ses sentiers palier par palier, sa base, la routine du matin), et les signalements des deux modes (`AdminSignalements.tsx`) — plus de création de compte : chacun ouvre son salon par son profil (`POST /api/admin/accounts`, sans page, reste pour les tests, le smoke et la tablée, qui fabriquent un compte à activer, celui d'avant). « Les salons » : tous les espaces, chacun nommé par son titulaire (`/api/admin/espaces`, `estUnSalon`), les renommer, les désactiver, les supprimer une fois désactivés. « Les profils » : les chercher, ouvrir la fiche d'un joueur (`QgFicheJoueur.tsx`, règle `qg.md`) et y agir — lui offrir des confettis — l'administrateur s'en offre aussi, sur son propre profil —, lui tirer un code de secours neuf, lever le verrou de sa connexion, libérer son épreuve de sentier, changer son prénom, le remettre au classement s'il est masqué, le suspendre ou le réactiver, le supprimer (`DELETE /api/admin/profils/:id`). Un profil suspendu (`disabled_at`) ne se connecte plus — le bon mot de passe le lui dit, un 403 —, perd ses sessions et les consoles qu'elles ouvraient, et disparaît de tout ce que lisent `byId` et `byIds` — `byLogin` compris : son code de secours se dit « incorrect » ; rien ne s'efface, et la réactivation lui rend tout, sauf ses sessions. La suppression emporte tout ce qui n'était qu'à lui — sa fiche, ses sessions et les consoles qu'elles ouvraient, ses lignes d'expérience, son étagère, ses éclats, ses achats (thèmes, vies, sabliers, compagnons), les confettis qu'on lui a offerts, ses parties du quiz du jour et de la campagne, ses épreuves et ses paliers repris, ses duels, ses amis, ses rappels du soir (`ProfileStore.supprimer`, `JourStore.oublierProfil`, `RappelStore.oublierProfil`, `CampagneStore.oublierProfil`, composés par `supprimerProfil` dans `server.ts`) ; l'espace qu'il tenait — son salon (`estSalonDuProfil`) ou un compte d'animateur à mot de passe — se détache et reste, pour que les souvenirs des soirées qu'on y a jouées s'ouvrent toujours (l'administrateur le supprime à part, dans « Les salons »). Jamais le profil de l'administrateur, jamais pendant qu'il joue une soirée pas encore close (`soireesPasCloses`), son salon compris : sa clôture le créditerait sous un identifiant disparu. Les archives le nomment pour toujours : le recalcul ne recrédite que les profils qui existent (`idsExistants`), et `profils-admin.test.ts` relit chaque table qui porte un `profile_id`

## Les pièges

- **Une route de l'administration qui change quelque chose dit sa phrase au
  journal du QG** (`noterLeGeste`, règle `qg.md`) — un profil supprimé, un
  espace renommé, une question retirée : `journal.test.ts` lit les routes
  dans le routeur et rougit tant qu'une seule n'en a pas.
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
- **Un profil qui n'est pas en mémoire se charge d'un aller-retour** : sa
  fiche, ses Éclats et ses récompenses ensemble (`byId` passe par `byIds`).
  L'un après l'autre, ils coûtaient trois allers-retours à la première
  requête de chacun après chaque réveil de l'hébergeur (le 13 octobre 2026,
  `duels-attente.test.ts`). Une fiche lue avant un changement n'écrase pas
  celle qui est arrivée à jour pendant l'aller-retour (`jour-charge.test.ts`).
- **Le cookie, lui, ne glisse pas** : `setSessionCookie` et `setPlayerCookie`
  posent un `Max-Age` fixe (trente jours, un an) à l'ouverture ; seule
  l'échéance en base glisse (`resolveSession`, `sessionProfileId`). Une
  console ouverte au mot de passe du compte se reperd trente jours après la
  connexion, même servie chaque soir ; une porte du profil en rouvre une
  neuve — une session de plus en base — à chaque `/api/joueur/espace`.
- **Un geste d'administration ne doit jamais rouvrir sa propre porte** :
  pas de lien d'activation pour soi (n'importe quelle session
  d'administrateur, le téléphone prêté compris, en tirait une console de
  trente jours), ni prénom, suspension ou suppression sur son propre
  profil (`estLeSien`) — s'offrir des confettis, si (le 14 octobre 2026). Un geste de plus sur un profil se pose la
  même question.
- **Une page de plus à la racine rejoint `RESERVED_SLUGS`** (`shared/space.ts`) :
  `parseRoute` lit `ACCOUNT_PAGES` avant les espaces, et un espace nommé
  comme une page — `duels` aujourd'hui, ou un dossier servi (`portraits`,
  `medaillons`, `compagnons`, `decors`) — n'aurait plus d'adresse. Seul
  l'administrateur choisit une adresse (« Renommer ») ; un salon tire la
  sienne (`s-…`).

## L'invariant 16, en entier

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
    fait ce geste (gardée au détachement, rouverte aussitôt à un changement
    de secret). Celles du mot de passe du compte ne bougent pas : c'est
    l'écran commun de la soirée. Une télé branchée par un code d'appairage
    hérite de la porte de la console qui l'a validé (`auth/appairage.ts`) :
    elle tombe avec ce profil, ou tient comme l'écran commun — et jamais
    plus de 24 heures (`fin_max`, qui plafonne le glissement) : chaque geste
    relit la session, et sa connexion tombe à l'heure dite même sans un
    geste (le minuteur de `host:hello`). Pour poser
    le lien, il faut prouver les deux identités — le profil ouvert sur ce
    navigateur n'y redit pas son identifiant, son mot de passe le confirme ;
    après, une seule porte suffit — seul l'administrateur rattache sans
    preuve, pour fusionner deux identités d'avant
    (`POST /api/admin/espaces/:id/titulaire`, `profilsAdmin.ts` ; le pourquoi
    dans `auth/profilUnique.ts`).
    Pour le changer ou le détacher, une preuve fraîche — le mot de
    passe du profil rattaché, ou celui du compte (`prouver`) —, et jamais
    depuis une télé branchée (`refuserLesTeles`) : le téléphone prêté y
    rattachait l'emprunteur, qui gardait la console. Ne fusionne pas les
    deux tables : l'identifiant d'un compte est la clé de partition d'une
    vingtaine de tables, locales et permanentes, et de toutes les archives.
