---
paths:
  - "client/src/main.tsx"
  - "client/index.html"
  - "client/vite.config.ts"
  - "client/src/{aLaDemande,api,routes,onglets,state,retour,titres,clavier,toucher,modale,copier,decompte,egalite,format,apercus}.ts"
  - "client/src/annonce.tsx"
  - "client/src/views/LandingApp.tsx"
  - "client/src/components/{Entree,IdentifiantDiscret,ProfilForm,NavAnimateur,Glossaire,Dialog,Icon,Invitation,Limite,Onglets}.tsx"
  - "client/src/components/inscription.ts"
  - "shared/{depart,adresses,erreurs,reveil,glossaire}.ts"
  - "server/src/core/{page,apercus}.ts"
  - "server/scripts/mesure-pages.ts"
  - "server/test/{depart,chargement,navigation,connexion-claire,client,page,medaillons,portes}.test.ts"
---

# Ce que la page charge : les adresses, l'entrée, la navigation

## Les fichiers

- `shared/adresses.ts` · `client/src/routes.ts` · `client/src/main.tsx` — une adresse lue une seule fois, pour le client et le serveur (`parseRoute`) : l'accueil, les quinze pages sans espace (`ACCOUNT_PAGES`), l'entrée d'un invité (`/<espace>`), les cinq pages publiques d'une soirée et de ses archives, et l'inconnue. L'accueil, `/profil` et `/boutique` sont une seule page (`ProfilApp`, règle `profil.md`) ; `views/LandingApp.tsx` ne sert que l'adresse inconnue (« Rejoindre une soirée », par le code du salon), et un espace qui n'existe pas passe par la page de l'invité, qui montre le même formulaire au refus de `party:watch`. `main.tsx` charge le code de la page avant son premier rendu, ne rend qu'une fois, sous un filet (`Filet`), pose le thème, la niche du compagnon retenue sur les pages qui lisent le profil (`poserNicheRetenue`, `NicheHost` à côté des dialogues — règle `profil.md`), et hors production la pastille d'environnement et le préfixe du titre de l'onglet (`<meta name="app-env">`, que `server/src/server.ts` glisse dans les pages qu'il sert). Une page que l'administrateur a mise en maintenance, ou annoncée pour bientôt sans en faire tester qui la demande (`<meta name="maintenance">`, `bientot`, `avant-premiere`, `client/src/maintenance.ts`), se remplace par l'écran qui le dit (`MaintenanceApp`) — son code ne part pas, elle ne précharge rien ; le bandeau rouge, lui, est déjà dans la page, au-dessus de `#root`, et `main.tsx` le reprend dans la racine (`BandeauxDuService` : hors d'elle, le voile d'un thème peint l'effaçait), d'où il mesure sa hauteur pour la niche (règle `qg.md`)
- `client/src/components/Entree.tsx` · `IdentifiantDiscret.tsx` · `components/inscription.ts` — tout ce qu'on traverse entre le scan du QR et la salle d'attente : neuf étapes (`Etape`) et quatre départs — les trois gros boutons pour un téléphone qui n'a rien, « Te revoilà » pour un profil reconnu, le prénom et l'avatar pré-remplis pour un choix retenu sur cet espace, l'équipe d'abord pour le chef qui vient d'ouvrir son salon en équipes (`equipeDAbord`) ; un jeton de la soirée n'en voit aucun, il se re-présente. Un profil y naît en deux écrans, le prénom puis « Garder ma progression » : un mot de passe, et l'identifiant déduit du prénom, sur une ligne (« Pour te reconnecter : **camille** modifier ») ; deviné et pris, il prend celui que le serveur propose (`inscrireAvecRepli`) — tapé à la main, jamais. Ce que l'entrée partage avec le formulaire du profil (`tirage`, `identifiantPour`, `refusDeLIdentifiant`, `refusDuMotDePasse`) vit dans `inscription.ts` : pris à `Entree.tsx`, il faisait télécharger toute la liaison temps réel à l'accueil (`medaillons.test.ts`). Un refus de l'inscription va au champ qu'il vise : le mot de passe refusé se dit sous le sien (`aria-describedby`) et s'efface à la frappe ; seul un refus de l'identifiant — pris, mal formé — en ouvre le champ. Tout refus l'ouvrait : « mimosa » se lisait sous l'identifiant, et le champ de plus poussait « Créer mon profil » sous le clavier d'un petit téléphone à 130 % (la tablée du 26 octobre 2026). Les deux règles lisent le motif du serveur, que `connexion-claire.test.ts` relit par la vraie route : un motif retouché au serveur se retouche ici
- `client/src/components/ProfilForm.tsx` — le même choix sur l'accueil sans profil, puis la connexion ou la création ; rien de ce qu'on a tapé pour se connecter ne passe dans la création — un essai raté, puis « Je n’en ai pas encore », y ouvrait l'identifiant de l'essai et le mot de passe refusé : « une page de profil ancienne », le retour du propriétaire du 13 octobre 2026 (`champsAuChangement`, `connexion-claire.test.ts`). L'entrée d'une soirée n'a pas encore cette règle (les pièges). À la création, la règle du mot de passe se dit d'avance, dans la tête du champ (« 8 caractères au moins ») ; la limite du prénom, elle, quand elle approche (`Limite`). L'accueil lui donne son nom (`titreDeLaPage`) : un `h1` caché à chaque écran — en `h1`, la marque aurait pris la serif des titres, et la feuille n'a pas de quoi l'en défaire —, la marque visible tue à l'oreille (`aria-hidden`), et l'onglet qui suit l'écran (`ongletDuFormulaire`) ; la salle d'attente ne le donne pas, sa page a les siens
- `shared/depart.ts` · `core/page.ts` — ce que la page servie apporte avant son script : ce que sa vue demandera dès son code arrivé, préchargé (`donneesDeDepart`, `prechargerDonnees`) aux adresses mêmes que la page demande (`DEPART`, `adresseDesDonnees`) — un aller-retour de moins à chaque ouverture ; et son attente déjà écrite dans `#root` (`ecrireAttente`) : le balisage de `Patience` (`annonce.tsx`), que React remplace sans que rien ne bouge — le nom de la soirée et « On arrive… » à l'entrée d'un invité (`pageDEntree`), « Chargement… » ailleurs. L'entrée d'un invité a sa donnée de départ, ce que `party:watch` lui dirait (`/s/<espace>/entree.json`, `EntreeDeDepart`) : elle paraît sans attendre la liaison temps réel si le téléphone n'a rien à reprendre (`entreeUtilisable` ; la salle : règle `soiree-salle.md`). Le fragment, que le serveur ne voit pas, `main.tsx` le précharge (`donneesDuFragment` : `#sentiers`, `#carnet`), et la campagne s'ouvre sur les sentiers par la même règle (`versLesSentiers`). La partie du jour préchargée le dit (`prechargee`) : son heure se mesure sur le préchargement (`mesureDeLaReponse`, `client/src/clock.ts`), pas autour d'un `fetch` qui la trouve déjà là (`depart.test.ts`)
- `core/apercus.ts` · `servirPage` (`server/src/server.ts`) — ce que le serveur pose sur une page avant tout script : son statut (`decrirePage`) — 404 d'un espace, d'une page ou d'une archive inconnus (l'archive vérifiée en 1,5 s au plus, sinon 200) ; 302 vers le nom exact d'un espace tapé autrement, vers `chez-‹saisie›` s'il existe, et de six chiffres vers l'espace du salon ; 429 quand l'adresse a épuisé ses codes de salon (`salons.test.ts`) —, ses balises d'aperçu (`habillerPage` : le titre de l'espace, **jamais un prénom**), `noindex` et `X-Robots-Tag` hors de l'accueil, `Cache-Control: no-cache`. Les seules corrections permises : ce que `normalizeSlug` fait de la saisie (casse, accents, espaces et ponctuation en tirets, 24 caractères au plus), puis la seule forme `chez-‹saisie›` — jamais un nom voisin (invariant 3). Une page sans espace se lit telle quelle : `/Profil` est inconnue, quand `/Chez-Bruno` mène à `/chez-bruno` (`portes.test.ts`)
- `client/src/api.ts` · `client/src/state.ts` — toute route du client passe par `req` : `X-Requested-With: quizz`, qu'exige le garde anti-CSRF sur toute écriture, `Content-Type: application/json` avec un corps seulement — une lecture qui s'annonçait en JSON faisait chercher au serveur un corps qu'elle n'a pas (« Requête illisible » au QG, le 14 octobre 2026 ; le serveur ne lit plus celui d'un `GET`, `server/src/api.ts`) —, l'abandon à vingt secondes, un échec rendu en `ApiError` à motif français (`UnauthorizedError`, `ConflitError`) ; `seConnecter` essaie le profil avant un compte d'avant. Une réponse qui sert un chrono passe par `avecLHeure`, qui remesure l'heure du serveur qu'elle porte (`maintenant`, et `prechargee` préchargée) — le quiz du jour, et tout mode à chrono : sans elle, `serverNow()` lit l'heure du téléphone (invariant 6 ; `depart.test.ts`). Les pages du QG portent aussi `maintenant`, sans rien chronométrer : elles n'y passent pas. L'état d'une page tient dans un magasin à abonnés (`useAppState`) ; sur celle d'un invité, son jeton, son choix et la dernière soirée close (`quizz.me.<espace>`, `quizz.profile.<espace>`, `quizz.fin.<espace>`, rouverte au retour sur la page, jamais à une arrivée : `estUnRetour`), écrits par `writeSafe`
- `client/src/onglets.ts` — les onglets nommés de la console, et « Revenir à la console » d'une page qu'elle a ouverte — l'accueil compris : jamais une seconde console
- `client/src/components/NavAnimateur.tsx` — la ligne des pages de l'animateur — Accueil · Écran commun · Mes quiz · Mon compte · Historique · Le QG, à l'administrateur —, la page courante à sa place, sans lien : en tête de « Mon compte » et du QG, pour un espace **sans profil** seulement ; tous y ont en bas la barre du menu (`MenuBarre`, `components/Pieces.tsx`), et « Mes quiz » n'a qu'elle (`navigation.test.ts`). L'écran commun a « Accueil » dans la bande de sa salle d'attente
- `components/Dialog.tsx` · `Onglets.tsx` · `client/src/{modale,clavier,retour,decompte}.ts` — un seul dialogue à la fois (`confirmDialog`, `promptDialog`, `choixDialog`), qu'une page ferme comme un renoncement quand ce qu'il demandait ne se demande plus (`fermerLeDialogue` : le « Quitter ? » d'une manche du Cabinet que la réponse partie à l'échéance a dépassé, ou que la partie démontée emporte) ; des onglets à un seul arrêt de Tab, parcourus aux flèches, et des fenêtres modales — un dialogue, une feuille (`Feuille`, `components/Pieces.tsx`), la carte d'un joueur, tout ce qui passe par `useModale` — qui rendent le reste de la page `inert` (`horsDeLaBoite` : leur voile, qui les porte, reste vivant ; `couvrir` compte les fenêtres qui couvrent chaque élément, qui ne revit qu'au départ de la dernière — chacune écartait ce qui était déjà inerte, et la feuille d'une équipe que la barre du chef referme d'elle-même rendait vivant, derrière la confirmation ouverte sur elle, ce qu'elle avait endormi), prennent le focus sans anneau (`SANS_ANNEAU`) et le rendent en partant (`petit-ecran.test.ts`, `feuilles.test.ts`) ; Échap ne ferme que celle du dessus (`poserUneFenetre`) : la plus ancienne l'entend la première, et une feuille se serait fermée avec la carte d'un ami ouverte sur elle ; sur un écran d'entrée, la page défile pour garder le bouton principal au-dessus du clavier ; « Quitter la soirée ? » au geste retour, dès la salle d'attente — ou la question de la page (`useGardeRetour(actif, auRetour)`, qui rend `'parti'` ou `'reste'` : rester repose la garde). Une page qui dit sa question marque sa garde d'un jeton tiré à son montage (`marqueDeLaGarde`) : une garde laissée par un rechargement ne passe pas pour la sienne. La soirée garde `true`, pour reprendre celle d'un rechargement sans en empiler une autre. La garde vit hors de React (`garder`, `porteLaGarde`), jouée sur un faux historique (`cabinet-ecran.test.ts`) ; levée, elle ne se repose plus quand sa question finit après elle — au Cabinet, la question attend le réseau, et une entrée orpheline faisait tomber le retour suivant dans le vide (règle `cabinet.md`). La ligne `if (demandes === 0 && gardee()) history.back()` est relue telle quelle (`chef-entree.test.ts`) ; un décompte lu à `serverNow()`
- `shared/erreurs.ts` — les motifs que le client montre quand ça coince (réseau, serveur qui redémarre…), et ce qui passe tout seul (`statutPassager`, `echecPassager`) — à l'inverse, un refus du serveur, qu'on ne retouche pas (`refusDuServeur`, `client/src/api.ts`)
- `shared/reveil.ts` — une écriture qui attend le réveil de l'hébergeur au lieu d'échouer à vingt secondes (`auReveil`, dans `client/src/api.ts`)
- `shared/glossaire.ts` · `client/src/components/Glossaire.tsx` — les mots maison (souvenir, bilan, coup d'œil, finition…), une phrase chacun, dépliée au toucher sous les pages qui les emploient — des Divins, le nom et le mystère seulement
- `server/scripts/mesure-pages.ts` — ce que chaque page fait attendre à un téléphone (`npm run mesure`) : un serveur jetable, une soirée jouée et une expédition partie — Max la rouvre sur le plan de l'acte (`explorateur`) —, puis chaque page ouverte dans Chromium bridé (4G, 4G lente ou la 4G moyenne des audits de septembre, processeur ×4), cache vide puis plein ; le premier affichage, l'écran utile, les octets et requêtes avant lui, le processeur, et les préchargements qu'elle n'a pas repris. Derrière un relais HTTP/2, comme chez l'hébergeur : en HTTP/1.1, les trente morceaux d'une route font la queue sur six connexions, et toute conclusion sur le nombre de requêtes s'inverse. La mesure d'avant et d'après une retouche, pas un test (`retours/2026-10-05/affichage-des-pages.md`)

## Les pièges

- **Ce qui ne sert qu'après l'entrée vient à la demande, par `aLaDemande`**
  (`client/src/aLaDemande.ts`), jamais par `lazy` : un composant paresseux
  suspend au moins une fois, même son fichier déjà téléchargé, et React
  retient alors 300 ms ce qui sort de l'attente. Les pages non plus : sous
  `lazy`, un joueur qui revenait, tout en cache, attendait 120 à 265 ms de
  plus (mesuré le 11 octobre 2026 ; `depart.test.ts`). L'écran d'entrée ne
  télécharge ni la carte, ni la fin de soirée, ni le quiz du jour ;
  l'accueil anonyme ni les dessins, ni les onglets du profil, ni la liaison
  temps réel ; le quiz du jour pas la fin de soirée (ses cartes de fin vivent
  dans `components/Ouverts.tsx`) : `medaillons.test.ts` y veille, et un
  import statique de plus sur ces chemins les y remettrait.
- **Une donnée préchargée se demande à l'ouverture, par tout visiteur, à
  l'adresse exacte.** Le navigateur garde la réponse préchargée pour le
  premier `fetch` de la même adresse, sans regarder son âge ni `no-store` —
  essayé : douze secondes après, il rendait encore celle du chargement. Une
  adresse que la page ne demanderait qu'après une connexion y lirait la
  réponse d'avant, celle d'un invité. Une page qui cesse de demander une
  adresse d'emblée, ou la demande autrement (une lettre, un paramètre), la
  retire de `donneesDeDepart` dans le même commit. Et `/api/jour` demandé
  sans `X-Requested-With` (que `req` pose toujours) se dit préchargé.
- **Le premier `Intl` d'une page charge les données du français** : 94 ms au
  processeur d'un téléphone moyen (mesuré le 11 octobre 2026), quel qu'il
  soit — retiré d'un endroit, il passe au suivant. Un nombre s'écrit à la
  main (`formatNumber`, `shared/typographie.ts` : le texte de
  `toLocaleString('fr-FR')`, milliers groupés à cinq chiffres seulement —
  « 1889 », « 35 000 » ; `typographie.test.ts`), et l'accueil reçoit le jour
  de Paris du serveur (`ProfilDAccueil.aujourdhui`). Une date passe par
  `shared/jour.ts`, dont les formateurs naissent à leur première lecture
  (règle `jour.md`) ; les `toLocaleDateString` de `client/src/format.ts` ne
  servent qu'aux pages d'animateur.
- **Ce qui ne se voit pas ne se rend pas d'avance, et ce qui se voit ne
  s'avance pas sans mesure.** Un `<details>` replié ne rend que son titre
  (`ParcoursDeTheme`). Les dessins des branches demandés dès le profil connu
  retardaient la carte de 0,1 à 0,3 s en 4G ; la fusion des petits morceaux
  du paquet (`experimentalMinChunkSize`) ajoutait du script sans gain : ni
  l'un ni l'autre retenu. Le bruit fait ±120 ms d'une série de
  `npm run mesure` à l'autre : une retouche se juge en séries entrelacées, ou
  au travail du fil principal (une trace, processeur ×4).
- **`npm run dev` ne passe pas par le serveur des pages** : à 5173, Vite sert
  `client/index.html` tel quel et ne relaie que `/socket.io`, `/api`,
  `/media`, `/s/` et les anciennes adresses (`client/vite.config.ts`). Ni
  statut, ni redirection (`/482157` y finit en « Le code 482 157 ne mène à
  aucun salon »), ni aperçus, ni préchargement, ni attente écrite, ni
  pastille d'environnement, ni bandeau, ni page en maintenance : ils se
  vérifient sur le client construit, servi par le serveur, ou au banc
  (`clientDist`, `portes.test.ts`, `maintenance.test.ts`).
- **Une page sans espace de plus** entre dans `ACCOUNT_PAGES`, `ACCOUNT`
  (`main.tsx`) et `TITRES` (`client/src/titres.ts`) — le typecheck force ces
  deux-là —, dans `donneesDeDepart` si elle demande une donnée dès son
  arrivée, et dans `RESERVED_SLUGS` (`shared/space.ts`), que rien ne force :
  un espace du même nom n'aurait plus d'adresse. `duels` y manque, comme les
  dossiers servis avant la page (`portraits`, `medaillons`, `compagnons`,
  `decors`) — règle `auth-et-admin.md`. Et, s'il y a lieu, dans
  `pageDeLAdresse` (`shared/maintenance.ts`) pour que le QG la ferme, dans
  `LISENT_LE_PROFIL` (`main.tsx`) si elle porte le thème du profil
  (`themes.test.ts`), et dans le préchargement de l'accueil d'un profil
  (`precharger`, `ProfilApp.tsx`) si un gros bouton y mène. Une page qui
  ne s'ouvre pas partout lit ce que le serveur en dit, jamais un drapeau du
  code — la préproduction sert le même : le Cabinet de curiosités
  (`/cabinet`), sa balise (`<meta name="cabinet">`, `cabinetIci`,
  `client/src/maintenance.ts`), lue une fois ; `cabinet-ecran.test.ts`
  relit tout son chemin.
- **L'entrée d'une soirée garde le mot de passe d'une connexion ratée** :
  `Entree.tsx` n'a qu'un état `password` pour « Me connecter » et pour
  « Garder ma progression », et « ← Retour » ne le vide pas : refusé, puis
  « Créer un profil », il attend dans le champ. L'écart que
  `champsAuChangement` a fermé dans `ProfilForm` reste ouvert ici.
- **Un bouton voisin de cases prises au lever du doigt passe lui aussi par
  `toucher`** (`client/src/toucher.ts`). Prise au lever du doigt, une case
  change la page avant le `click` que le navigateur fait suivre, et ce
  `click` tombe sur ce qui a glissé sous le doigt : un bouton au seul
  `onClick` le reçoit. La frise de l'expédition effaçait ainsi tout ce qu'on
  y posait — une rangée de cartes vidée, « Effacer » remontait sous le
  doigt —, et « Valider » aurait jugé une frise qu'on ne lui avait pas
  donnée (le retour du propriétaire du 20 octobre 2026). `toucher` ignore
  cet écho pendant 800 ms, pour tout bouton qui passe par lui
  (`toucher.test.ts`) — et le voile d'un dialogue aussi
  (`estLEchoDUnDoigt`, `Dialog.tsx`) : ouvert au lever du doigt — « Quitter »
  entre deux manches du Cabinet, sans pause à demander d'abord —, il se
  refermait aussitôt sous l'écho, et rien ne s'ouvrait au doigt. Il arrête
  aussi son propre `mousedown` (`retenirLeFocus`) : le `mousedown` que le
  doigt fait suivre tombait sur lui, qui ne se focalise pas, et le focus
  posé sur « Continuer » partait sur la page — Tab, Tab, Entrée jouait
  « Manche suivante » derrière la fenêtre (la tablée du 25 octobre 2026). Les
  deux voiles, celui d'un dialogue et celui d'une feuille (`Feuille`,
  `.carte-voile`), sont modaux : ce qu'ils couvrent est `inert`, eux restent
  vivants et se touchent pour renoncer. Celui d'une feuille arrête son
  `mousedown` de même (`retenirLeFocus`, `modale.ts`) : « Mes réponses », au
  bilan du Cabinet, s'ouvre au lever du doigt. Il ne reconnaît pas l'écho :
  au Cabinet, `arreterLEcho` l'arrête à la capture (plus bas) ; ailleurs,
  aucune feuille ne s'ouvre au lever du doigt — une qui le ferait, le doigt
  sur son voile, se refermerait aussitôt. Ce
  qui prend le doigt au lever sans passer par `toucher` marque la même
  heure (`prendreLeDoigt`) — la carte de France de l'Épingle : avec une
  heure à elle, elle ignorait son écho, mais pas le bouton venu sous lui.
  Un lien, lui, ne lit pas l'heure : le Cabinet arrête l'écho à la capture
  du document (`arreterLEcho`, posé par `CabinetApp.tsx`) — le premier
  `click` qui suit le doigt, dans les 800 ms, jamais un `click` du code —,
  sans quoi « Revenir au musée » ouvrait la tuile du musée venue sous le
  doigt. Les autres pages ne l'ont pas : un lien qui y paraît sous un
  doigt pris au lever reçoit encore son écho.
- **Une clé du stockage du navigateur se lit et s'écrit sous try/catch**
  (comme `writeSafe`) : un stockage refusé au chargement d'un module rendait
  la page de jeu noire, et rien ne le vérifie partout. Les clés commencent
  par `quizz.`, sauf `quizz-telecommande` et `fiestappTriDesQuiz`.

## Ce qu'il ne faut pas faire

- Rendre la connexion obligatoire. L'entrée d'une soirée **est** un écran de
  connexion, et l'accueil (`/`) en est un aussi : c'est un choix assumé —
  mais, à qui n'a pas de profil (ni, à l'entrée, de choix retenu), tous deux
  s'ouvrent sur trois gros boutons de même taille, « Jouer sans compte »
  d'abord, en accent, puis « Me connecter » et « Créer un profil » — les
  champs ne viennent qu'avec le choix. Ils se voient **sans défiler** en
  360 × 640 : ça se regarde à l'écran (skill `regarder-le-rendu`), car
  `connexion-claire.test.ts` ne garde que leur ordre, leur format et
  l'absence de champ. Un profil naît d'un prénom et d'un mot de passe :
  l'identifiant s'en déduit (`IdentifiantDiscret`). Aucun champ de l'entrée
  ni de `ProfilForm` n'a d'`autoFocus` : le clavier pousserait le bouton hors
  de l'écran. **Le chemin anonyme reste la valeur de l'application** ; les
  profils s'y greffent, ne le remplacent pas.
- Renommer un bouton de l'entrée ou de l'accueil sans chercher son texte :
  la tablée le touche par son nom (règle `tablee.md`), et des tests le lisent.
