---
paths:
  - "shared/grandPrix.ts"
  - "server/src/grandPrix.ts"
  - "server/src/core/grandPrix.ts"
  - "client/src/views/GrandPrixApp.tsx"
  - "client/src/components/{GrandPrix,QgGrandPrix}.tsx"
  - "server/test/grand-prix.test.ts"
  - "server/scripts/rendu-grand-prix.ts"
---

# Le Grand Prix

Le jour d'un joueur, programmé au QG (`/admin#grand-prix`) : tout le monde
court dix obstacles contre son fantôme, ses vraies réponses rejouées ; qui le
bat gagne son flot. La page produit : `docs/produit/le-grand-prix.md` ; la
maquette et les décisions du propriétaire : `retours/2026-11-19/grand-prix/`.

## Les fichiers

- `shared/grandPrix.ts` — les règles pures : le score (`scoreDe` — une barre
  ou un refus, `PENALITE_D_UNE_BARRE` ; le chrono d'un saut plafonné à
  l'obstacle), qui bat qui (`bat`, `valeurDeLaCourse` : moins de points, puis
  moins de temps), le parcours (`tirerLeParcours` : les thèmes à tour de rôle,
  le jamais couru d'abord, le déjà vu en dernier), le rythme du fantôme (`tirerUnRythme`),
  les clés rangées (`cleDuFlot`, `flotDe`, `flotsDe`, `cleDuPrix`), les vues
- `server/src/core/grandPrix.ts` — `GrandPrixStore` : programmer (le vivier
  figé, `grand_prix_questions`), ouvrir le jour (`ouvrirLeJour` : l'avatar du
  fantôme figé, son flot d'honneur et `prixFete` rangés), la course, le bilan
  du fantôme, le carnet, le QG. `server/src/grandPrix.ts`, ses routes
- `client/src/views/GrandPrixApp.tsx` · `components/GrandPrix.tsx` — la page
  (`?essai=<id>` pour l'essai du QG), les chevaux en constellations, le flot,
  le bandeau de l'accueil et la feuille de la fêtée ; `QgGrandPrix.tsx`, le QG

## Les pièges

- **Le fantôme court sur son terrain, et rien du quiz du jour** : les thèmes
  de campagne où il a passé le plus de temps (`themesDuFantome`, par
  `campagne_series.sujet`), trois au plus (`THEMES_DU_TERRAIN`), cochés au QG
  — le propriétaire l'a voulu ainsi le 19 novembre 2026 : « là où elle a passé
  le plus de temps », pour la mettre en valeur, pas ses meilleures catégories
  au pourcentage, où l'on joue peu. Le quiz du jour, que tout le monde a joué
  le même jour, n'en donne que ses temps (`tirerUnRythme`). Le vivier se
  partage à parts égales entre les thèmes, et chaque question garde son thème
  et sa question de la réserve (`theme`, `reserveId`, dans le JSON de
  `grand_prix_questions`) : le thème s'écrit au-dessus de l'obstacle, et ce
  qu'un coureur a déjà joué en campagne passe en dernier (`dejaVuesPar`) —
  sans quoi un habitué des mêmes thèmes courait sur ses propres réponses.
- **Le chrono est au serveur, et l'expiration se lit** : un obstacle se date
  quand il se montre (`servie_le`, posé par `depart` et `suivante`, jamais
  pendant une révélation) ; une réponse se mesure à `maintenant - servie_le`,
  la marge du quiz comprise (`GRACE_MS`). Aucune minuterie : un obstacle laissé
  au temps devient un refus à la lecture suivante (`expirer`), et la page
  relit après l'échéance (`insister`). Une réponse renvoyée pour un obstacle
  passé rend la même révélation sans rien écrire (invariant 7).
- **La bonne réponse ne part qu'à la révélation** (invariant 1) : `ObstacleVu`
  n'a ni `bonne` ni anecdote, et du fantôme, pendant l'obstacle, seulement le
  moment où il saute (`fantomeMs`) — jamais ce qu'il a répondu.
- **Rien ne s'y gagne en jeu** (invariant 8) : ni expérience ni confettis, et
  ce qu'il fait tomber se range comme une voie (`#grand-prix:<id>`, préfixes
  `flot:` et `grandprix:` dans `PREFIXES_DES_VOIES_RANGEES`) — jamais un
  trophée, ni l'étagère. Un flot vaut un timbre (`flotsDe`, le carnet des
  fêtes, `releveDeLaCollection`) : `VERSION_DU_RELEVE` monte si sa valeur change.
- **Ses avatars sont des légendaires secrets** (`secret`, `PRIX_DES_GRANDS_PRIX`,
  `lg:pegase`, `lg:pegase-couronne`) : ni case ni silhouette à qui ne les a
  pas (`taitA`, `legendairesVisibles`, `shared/album.ts`). Un avatar de plus
  pour les Grands Prix est un légendaire `secret` de plus, peint par la chaîne
  (`server/scripts/anime/legendaires.ts`, skill `peindre`) ; jamais un prix hors de la liste,
  que le serveur refuse. **Pégase sort tout entier de son cercle**, ordinaire
  comme éclaté (`entier` dans la chaîne, qui livre `artPerso` — la créature
  ordinaire dans le cadre large de la rare —, `.lg-entier` dans
  `Legendaire.tsx`) : les autres légendaires ne débordent qu'éclatés, par le
  haut ; dans une liste, il reste dans son disque comme eux.
- **Le code ne connaît personne** : le fantôme, le jour, le mot sont au QG.
  Le dépôt est public — ni le nom ni la date d'un vrai joueur dans le code,
  les tests, les rendus ou la documentation : Léa, Nina, Hugo.
- **Un jour couru ne se change plus** : `programmer` et `retirer` refusent un
  Grand Prix dont le jour est venu — ses flots sont rangés. Un seul par jour.
- **L'essai du QG** court avec le profil de l'administrateur (son cookie de
  joueur sous la porte du QG), hors classement, sans flot ni prix ; le bilan
  du fantôme écarte les essais, les abandons et ses propres courses.
- **Sur l'accueil, il prend la place de l'affiche** (`BandeauDuGrandPrix`, les
  classes `.affiche .affiche-bandeau`) : l'accueil tient sur un écran (règle
  `profil.md`). La feuille de la fêtée s'ouvre par-dessus, une fois par
  téléphone (`feteVue`) — dans la page, elle faisait défiler l'accueil.
  `server/scripts/rendu-grand-prix.ts` photographie tout, le QG compris.
