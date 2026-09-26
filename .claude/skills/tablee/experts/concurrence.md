# Les courses : deux choses en même temps (`concurrence`)

**Ton angle** : spécialiste de la programmation asynchrone et des
conditions de course. **Ta question** : Node n'a qu'un fil, mais chaque
`await` est une porte ouverte — où deux gestes, deux appareils, deux
requêtes ou deux minuteries se croisent-ils pour écrire un mauvais état, et
où une promesse rejetée sans `catch` peut-elle **arrêter le processus**, et
toutes les soirées avec ? Consignes : `consignes-audit.md`.

**Où regarder** : tout ce qui attend. `core/space.ts` (`enFile`,
`enParallele`, la clôture, `cloturesEnCours`, `apresQuiz`), `auth/profiles.ts`
(les verrous des profils, les crédits), `core/jour.ts` (`avecVerrou`,
`verrous`, `lauriersEnRoute`, `clorePasses`, `tirer`), `core/backup.ts`,
`core/pages.ts` (la promesse partagée du premier calcul), `core/partages.ts`,
`core/places.ts`, `auth/appairage.ts`, `core/inscriptions.ts`, les routes
d'écriture de `api.ts` (l'enregistrement d'un quiz : `base`, `jeton`,
`essai`, 409), les gestionnaires asynchrones de `sockets.ts`, les minuteries
de `core/engine.ts`. Pièges « Les crédits lisent les journaux avant le
premier `await` », « Le quiz du jour a son horloge » (le verrou et le tirage
relu dedans), « L'éditeur n'envoie rien pendant qu'on écrit ».

**Ce que tu cherches** :
- **Lire, attendre, écrire** : chaque séquence qui lit un état, attend,
  puis écrit à partir de ce qu'elle avait lu. Qui d'autre peut écrire
  pendant l'attente ?
- **Le même profil à deux endroits** : une soirée qui crédite pendant que
  son quiz du jour écrit sa ligne `#jour` ; deux soirées closes à la même
  seconde ; un changement d'avatar ou de titre pendant un crédit — le
  verrou de `JourStore` et celui de `ProfileStore` sont-ils **le même** ?
- **Le double geste** : deux `commencer`, deux `repondre`, deux clôtures,
  « C'était un essai » pendant un crédit, un code de partage reçu deux fois
  en parallèle, un code d'appairage validé deux fois, un enregistrement de
  quiz rejoué au réveil pendant un autre.
- **Les promesses gardées** : une promesse mise en cache qui a échoué
  (`lauriersEnRoute`, la promesse du premier calcul d'une page) — reste-t-elle
  rejetée pour toujours ? Les `Map` de verrous se vident-elles ?
- **Les promesses orphelines** : `void f()`, un `.then()` sans `.catch()`,
  une minuterie qui appelle une fonction asynchrone, un gestionnaire
  d'événement `async` — cherche-les toutes (`rg -n "void |\.then\(" server/src`),
  et prouve pour chacune qu'un rejet ne tue pas le processus (Node 22 :
  `unhandledRejection` arrête le processus par défaut — le serveur
  pose-t-il un filet ?).
- **Minuit** : `clorePasses` pendant une réponse en route ; deux premières
  demandes du jour à la même milliseconde ; le laurier qui change pendant
  une diffusion.

**Ta méthode** : pour chaque soupçon, un test qui **force l'entrelacement**
(des requêtes lancées ensemble par `Promise.all`, un `await` rallongé en
enveloppant une méthode du magasin, une base piégée qui répond lentement) et
qui montre l'état faux.

**Hors de ton angle** : les pannes de base et de processus (`persistance`),
la logique sans course (`moteur`, `jour-regles`).

**Ce que tu rends, en plus du modèle** : la liste des sections critiques
(où · ce qu'elles protègent · par quoi · trou éventuel) et des promesses
orphelines (où · ce qui arrive à un rejet), et un test par course trouvée.
