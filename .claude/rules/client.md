---
paths:
  - "client/src/main.tsx"
  - "client/src/{aLaDemande,api,routes,onglets,state,retour}.ts"
  - "client/src/annonce.tsx"
  - "client/src/components/{Entree,IdentifiantDiscret,ProfilForm,NavAnimateur,Glossaire}.tsx"
  - "client/src/components/inscription.ts"
  - "shared/{depart,adresses,erreurs,reveil,glossaire}.ts"
  - "server/src/core/{page,apercus}.ts"
  - "server/scripts/mesure-pages.ts"
  - "server/test/{depart,chargement,navigation,connexion-claire,client,page,medaillons}.test.ts"
---

# Ce que la page charge : l'entrée, l'accueil, la navigation

## Les fichiers

- `client/src/components/Entree.tsx` · `IdentifiantDiscret.tsx` — tout ce qu'on traverse entre le scan du QR et la salle d'attente — trois gros boutons d'abord, comme l'accueil sans profil (`ProfilForm`) ; et l'identifiant d'un profil qui naît, déduit du prénom, sur une ligne (« Pour te reconnecter : camille · modifier ») : pris par un autre, il prend celui que le serveur propose (`inscrireAvecRepli`), jamais s'il a été tapé à la main. Ce que l'entrée partage avec le formulaire du profil (`tirage`, `identifiantPour`) vit dans `components/inscription.ts` : pris à `Entree.tsx`, il faisait télécharger toute la liaison temps réel à l'accueil (`medaillons.test.ts`)
- `shared/depart.ts` · `core/page.ts` — ce que la page servie apporte avant son script : ce que sa vue demandera dès son code arrivé, préchargé (`donneesDeDepart`, `<link rel="preload" as="fetch">`, `prechargerDonnees`) — la page attendait son code pour demander ses données, un aller-retour de plus à chaque ouverture —, aux adresses mêmes que la page demande (`DEPART`, `adresseDesDonnees`) ; et son attente déjà écrite (`ecrireAttente`) : le balisage de `Patience` (`annonce.tsx`), que React remplace sans que rien ne bouge — le nom de la soirée et « On arrive… » à l'entrée d'un invité (`pageDEntree`), « Chargement… » ailleurs. Ce que le serveur ne voit pas — le fragment, `#sentiers` —, le premier script le précharge (`donneesDuFragment`, `main.tsx`), et la campagne s'ouvre sur les sentiers par la même règle (`versLesSentiers`). La partie du jour préchargée le dit (`prechargee`) : son heure se mesure sur le préchargement (`mesureDeLaReponse`, `client/src/clock.ts`), pas autour d'un `fetch` qui la trouve déjà là (`depart.test.ts`)
- `shared/adresses.ts` · `core/apercus.ts` — une adresse lue une seule fois pour le client et le serveur ; le serveur y pose le statut (404 d'un espace, d'une page ou d'une archive inconnus), les balises d'aperçu (le titre de l'espace, **jamais un prénom**), `noindex` hors de l'accueil, et les seules corrections permises : ce que `normalizeSlug` fait de la saisie (casse, accents, espaces et ponctuation en tirets, 24 caractères au plus), puis la seule forme `chez-‹saisie›` — jamais un nom voisin (invariant 3)
- `client/src/onglets.ts` — les onglets nommés de la console, et « Revenir à la console » d'une page qu'elle a ouverte — l'accueil compris : jamais une seconde console
- `client/src/components/NavAnimateur.tsx` — la barre des pages de l'animateur — Accueil · Écran commun · Mes quiz · Mon compte · Historique · Les comptes —, la même en tête de « Mes quiz », de « Mon compte » et des comptes, la page courante à sa place, sans lien ; l'écran commun a « Accueil » dans la bande de sa salle d'attente, et les pages publiques le donnent à l'animateur de l'espace
- `shared/erreurs.ts` — les motifs que le client montre quand ça coince (réseau, serveur qui redémarre…), et ce qui passe tout seul (`statutPassager`, `echecPassager`) — à l'inverse, un refus du serveur, qu'on ne retouche pas (`refusDuServeur`, `client/src/api.ts`)
- `shared/reveil.ts` — une écriture qui attend le réveil de l'hébergeur au lieu d'échouer à vingt secondes (`auReveil`, dans `client/src/api.ts`)
- `shared/glossaire.ts` · `client/src/components/Glossaire.tsx` — les mots maison (souvenir, bilan, coup d'œil, finition…), une phrase chacun, dépliée au toucher sous les pages qui les emploient — des Divins, le nom et le mystère seulement
- `server/scripts/mesure-pages.ts` — ce que chaque page fait attendre à un téléphone (`npm run mesure`) : un serveur jetable et une soirée jouée, puis chaque page ouverte dans Chromium bridé — 4G, 4G lente ou la 4G moyenne des audits de septembre, processeur ×4 —, cache vide puis plein ; le premier affichage, l'écran utile (un sélecteur par page, guetté dans la page), les octets et requêtes avant lui, le processeur. Derrière un relais HTTP/2, comme chez l'hébergeur : en HTTP/1.1, les trente morceaux d'une route font la queue sur six connexions, et toute conclusion sur le nombre de requêtes s'inverse ; le relais retarde aussi les messages temps réel, que Chrome ne bride pas. `--cascade`, `--couverture`, `--client` (deux paquets comparés) ; et à chaque page, les préchargements qu'elle n'a pas repris (`shared/depart.ts`). La mesure d'avant et d'après une retouche, pas un test (`retours/2026-10-05/affichage-des-pages.md`)

## Les pièges

- **Ce qui ne sert qu'après l'entrée vient à la demande, par `aLaDemande`**
  (`client/src/aLaDemande.ts`), jamais par `lazy` : un composant paresseux
  suspend au moins une fois, même son fichier déjà téléchargé, et React
  retient alors 300 ms ce qui sort de l'attente — la grille du profil, la fin
  de soirée, la carte d'un joueur. L'écran d'entrée ne télécharge ni la
  carte, ni la fin de soirée, ni le quiz du jour (elles viennent une fois
  entré), l'accueil anonyme ni les dessins ni les onglets du profil, et le quiz du jour
  ni la fin de soirée (ses cartes de fin vivent dans `components/Ouverts.tsx`) :
  `medaillons.test.ts` y veille, et un import statique de plus sur ces
  chemins les y remettrait. L'accueil ne télécharge pas non plus la liaison
  temps réel : rien de `socket.ts` sur son chemin.
- **Une donnée préchargée se demande à l'ouverture, par tout visiteur.** La
  page servie précharge ce que sa vue demandera dès son code arrivé
  (`donneesDeDepart`, `shared/depart.ts`), et le navigateur garde la réponse
  pour le premier `fetch` de la même adresse, sans regarder son âge ni
  `no-store` — essayé : douze secondes après, il rendait encore celle du
  chargement. Une adresse que la page ne demanderait qu'après une connexion
  y lirait donc la réponse d'avant, celle d'un invité. Une page qui cesse de
  demander une adresse d'emblée, ou la demande autrement (une lettre, un
  paramètre), la retire de sa liste dans le même commit ; chaque mesure de
  `npm run mesure` relève les préchargements qu'une page n'a pas repris.
  Et `/api/jour` demandé sans l'en-tête maison (`X-Requested-With`, que
  `req` pose toujours) se dit préchargé (`prechargee`) : son heure se lit
  alors dans le préchargement.

## Ce qu'il ne faut pas faire

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
