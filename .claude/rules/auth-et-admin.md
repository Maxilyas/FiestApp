---
paths:
  - "server/src/auth/**"
  - "server/src/core/inscriptions.ts"
  - "server/src/profilsAdmin.ts"
  - "shared/securite.ts"
  - "client/src/views/{AdminApp,AccountApp,LoginApp,ActivateApp}.tsx"
  - "client/src/components/{AdminProfils,AdminSalons,Appairage,Tele,MotDePasse,ChangerMotDePasse,Secours,LienConsole}.tsx"
  - "server/test/{admin-seulement,administration,appairage,profil-unique,profils-admin,securite,espaces,emprunts,console}.test.ts"
---

# Les comptes, les profils, les sessions, la télé, l'administration

## Les fichiers

- `auth/store.ts` — comptes d'animateurs — c'est-à-dire **des espaces** : `accounts.id` EST le `space_id`
- `auth/profiles.ts` — profils de joueurs (autre table, autre cookie)
- `auth/profilUnique.ts` — un seul profil (le choix du 3 octobre 2026) : au premier démarrage qui le connaît (`DRAPEAU`, une fois — une base neuve le pose sans rien parcourir), chaque compte d'animateur d'avant, à mot de passe et sans profil, reçoit le sien — même identifiant, même haché (`ProfileStore.adopter`) — et s'y rattache ; un identifiant déjà pris ne se devine pas, l'administrateur le rattache (« Les salons », `POST /api/admin/espaces/:id/titulaire`, qui recopie dans l'espace gardé les quiz du salon que le profil tenait). Les portes de console — `/connexion`, l'écran commun — essaient le profil d'abord (`seConnecter`, `client/src/api.ts`), et « Mon compte » parle du profil dès qu'un profil tient l'espace
- `auth/profileRoutes.ts` — la porte d'entrée : se connecter à son profil ouvre aussi la console de l'espace rattaché
- `auth/http.ts` — cookies, adresse du client, et `loginBudgetOf(app)` : la réserve d'essais commune à toutes les portes, où un essai compte comme un échec jusqu'à son jugement ; `refuserLesTeles`, ce qu'une télé branchée ne fait pas
- `auth/appairage.ts` — brancher la télé : le code court qu'elle affiche, validé depuis une console ouverte, et la session d'une soirée qu'elle en reçoit ; `/attente` dit `perime` dans une réponse, jamais dans une erreur
- `core/inscriptions.ts` — la réserve d'inscriptions des invités, par adresse **et par espace**, plus une large par adresse ; et sa mesure (au refus, à la clôture) qui dira en ligne si l'adresse lue est celle d'un proxy
- `shared/securite.ts` — la page de retour après connexion : jamais ailleurs que chez soi
- `client/src/views/AdminApp.tsx` · `server/src/profilsAdmin.ts` · `client/src/components/AdminProfils.tsx` · `AdminSalons.tsx` — `/admin`, à la manière de « Mon compte » : un tableau de bord (profils, salons, copies à relire, jours d'avance du quiz du jour), puis une ligne par sujet, chacune son écran à son adresse (`/admin#salons`) et ses feuilles — la campagne comprise (`AdminCampagne.tsx` : ses sentiers palier par palier, sa base, la routine du matin, ses signalements) — plus de création de compte : chacun ouvre son salon par son profil. « Les salons » : tous les espaces, chacun nommé par son titulaire (`/api/admin/espaces`, `estUnSalon`), les renommer, les désactiver, les supprimer une fois désactivés. « Les profils » : les chercher, en supprimer un (`DELETE /api/admin/profils/:id`). La suppression emporte tout ce qui n'était qu'à lui — sa fiche, ses sessions, ses lignes d'expérience, son étagère, ses éclats, ses achats (thèmes, vies), ses parties du quiz du jour et de la campagne, ses épreuves et ses paliers repris (`ProfileStore.supprimer`, `JourStore.oublierProfil`, `CampagneStore.oublierProfil`) ; l'espace qu'il tenait — son salon (`estSalonDuProfil`) ou un compte d'animateur à mot de passe — se détache et reste, pour que les souvenirs des soirées qu'on y a jouées s'ouvrent toujours (l'administrateur le supprime à part, dans « Les salons »). Jamais le profil de l'administrateur, jamais pendant qu'il joue une soirée pas encore close (`soireesPasCloses`), son salon compris : sa clôture le créditerait sous un identifiant disparu. Les archives le nomment pour toujours : le recalcul ne recrédite que les profils qui existent (`idsExistants`), et `profils-admin.test.ts` relit chaque table qui porte un `profile_id`

## Les pièges

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
