# Les adresses

> Chaque adresse de page de FiestApp : la page qu'elle ouvre, pour qui, et le fichier qui la rend ; puis ce que le serveur fait d'une adresse avant de servir la page — statuts, redirections, 404 — et les noms qu'un espace ne peut pas porter. `server/test/documentation.test.ts` exige une ligne ici pour chaque page que `shared/adresses.ts` ouvre.

**Dans cette page** : [la lecture](#comment-une-adresse-se-lit) · [les pages sans espace](#les-pages-sans-espace) · [les écrans d'une page](#les-écrans-dune-page) · [les pages d'un espace](#les-pages-dun-espace) · [ce que le serveur répond](#ce-que-le-serveur-répond) · [les adresses d'avant](#les-adresses-davant-les-espaces) · [ce qui n'est pas une page](#ce-qui-nest-pas-une-page) · [les noms d'espace](#les-noms-despace)

## Comment une adresse se lit

Une seule fonction, `parseRoute` (`shared/adresses.ts`), lit l'adresse des deux côtés : le client y choisit sa page (`client/src/main.tsx`), le serveur son statut et ses balises (`decrirePage`, `server/src/core/apercus.ts`). Elle range l'adresse en cinq sortes, dans cet ordre :

1. **Rien** (`/`) : l'accueil.
2. **Un premier segment qui est une page sans espace** (`ACCOUNT_PAGES`) — lu tel quel, à la lettre : `/profil` est une page, `/Profil` n'en est pas une.
3. Sinon, **un nom d'espace** : le segment tel quel s'il en a la forme, sinon ce qu'on a voulu taper (`slugTape` : décodé, puis `normalizeSlug`). Un nom qui n'a pas la forme d'un espace, ou qui est réservé (`RESERVED_SLUGS`), rend l'adresse inconnue.
4. **Un seul segment** : l'entrée de cet espace, le téléphone de l'invité.
5. **Une suite** : une page publique de l'espace — `souvenir`, `stats`, `bilan`, `bilan/fiches`, `soirees` —, de la soirée en cours, ou d'une soirée archivée (`soirees/<id>/…`, l'identifiant fait de lettres, chiffres, `_` et `-`). Toute autre suite est inconnue, et l'inconnue ouvre `client/src/views/LandingApp.tsx` : « Rejoindre une soirée ».

## Les pages sans espace

Treize pages, dont l'adresse ne porte pas d'espace : celui d'une page d'animateur vient de sa session, celui d'une page de joueur de son profil.

| Adresse | Page | Pour qui | Fichier |
|---|---|---|---|
| `/` | L'accueil : sans profil, trois gros boutons (« Jouer sans compte », « Me connecter », « Créer un profil ») ; avec un profil, ses gros boutons de jeu | tout le monde | `client/src/views/ProfilApp.tsx` |
| `/profil` | « Mon profil » : sa ligne, puis « M'habiller », « Ma collection », « Mes soirées », « Ma carrière » ; sans profil, les trois gros boutons | profil | `client/src/views/ProfilApp.tsx` |
| `/boutique` | La boutique : les thèmes, les compagnons, les objets | profil | `client/src/views/ProfilApp.tsx` |
| `/jour` | Le quiz du jour ; sans profil, une page qui le présente | profil | `client/src/views/JourApp.tsx` |
| `/campagne` | La campagne : les séries, les sentiers, le défi de la semaine, le carnet | profil | `client/src/views/CampagneApp.tsx` |
| `/duels` | Les duels : la cote, la ligue, les défis entre amis — joués sur l'écran de la campagne | profil | `client/src/views/CampagneApp.tsx`, `client/src/views/Duels.tsx` |
| `/salon` | « Nouveau salon » : créer et ouvrir son salon depuis son profil (`?quiz=<id>` le prépare avec un quiz) | profil | `client/src/views/SalonApp.tsx` |
| `/host` | L'écran commun et sa console ; sans session, la connexion et le code de la télé | animateur | `client/src/views/HostApp.tsx` |
| `/tele` | La télé : sans session, le code qui la branche ; branchée, l'écran de la salle | une télé | `client/src/views/HostApp.tsx` |
| `/edit` | « Mes quiz » : la bibliothèque et l'éditeur | animateur, profil | `client/src/views/EditorApp.tsx` |
| `/compte` | « Mon compte » : les réglages de l'espace, son profil, son historique | animateur, profil | `client/src/views/AccountApp.tsx` |
| `/admin` | Le QG de l'administrateur ; sans session, la connexion ; à un autre, « Cette page est réservée à l'administrateur. » | administrateur | `client/src/views/AdminApp.tsx` |
| `/connexion` | « Espace animateur » : ouvrir une console, puis revenir à la page demandée (`?next=`), sinon à `/host` | animateur, profil | `client/src/views/LoginApp.tsx` |
| `/activer` | Choisir le mot de passe d'un compte d'animateur d'avant, par son lien | qui a reçu le lien | `client/src/views/ActivateApp.tsx` |

Chaque page sans espace pose le titre de son onglet dès le premier rendu (« Mes quiz · FiestApp », `TITRES`, `client/src/titres.ts`). Les pages et leurs gestes, côté produit : [FiestApp en une page](../produit/vue-d-ensemble.md).

## Les écrans d'une page

À l'intérieur d'une page, un écran a son adresse dans le fragment : un lien, un favori ou le retour du navigateur y ramènent. Le serveur ne voit jamais le fragment ; ce qu'un écran demande d'emblée, la page le précharge elle-même ([Le client](../architecture/client.md)).

| Adresse | Écran |
|---|---|
| `/profil#avatar`, `#titre`, `#vitrine`, `#fond`, `#theme`, `#gerbe` | la loge (« M'habiller »), ouverte sur une pièce ; avec `?essayer=<clé>` (`/profil?essayer=nuit#fond`), l'objet qu'une fin de partie propose sous « À porter » déjà essayé sur la carte — seulement s'il est au profil, et la requête s'efface aussitôt de l'adresse (`essaiDemande`) |
| `/profil#collection` (et `#collection-<ligne>`, `#collection-avatars-<rareté>`, `#collection-trophees-<mode>`), `#soirees`, `#carriere` | « Ma collection » (sur une ligne, une page de l'album des avatars — `#collection-avatars-rare` — ou de l'album des trophées — `#collection-trophees-jour`, où mène chaque ligne de « Nouveaux trophées »), « Mes soirées », « Ma carrière » |
| `/#missions` | l'accueil, la feuille des missions du jour ouverte — la fin d'une partie et la fiche d'un objet du trésor y mènent ; le fragment s'efface une fois lu |
| `/boutique#compagnons`, `#fonds`, `#objets`, `#objet-<objet>`, `#theme-<clé>`, `#compagnon-<clé>`, `#fond-<clé>` | un rayon de la boutique, la fiche d'un objet ; `#theme-aurore`, le rayon des thèmes ouvert sur sa rareté, sa fiche dépliée (le bandeau « À la une » de l'accueil y mène) ; `#compagnon-tortue`, la vitrine des compagnons tournée vers lui (« À la une » et l'album des avatars y mènent) ; `#fond-jazz`, le rayon des fonds, sa fiche dépliée (la fiche d'un fond des savoirs, dans « Ma collection », y mène) |
| `/jour#classement`, `#classement-hier`, `#classement-mois`, `#correction` | le classement d'une période, la correction de sa partie |
| `/campagne#sentiers`, `#sentier-<branche>`, `#defi`, `#carnet` | les sentiers, un sentier, le défi de la semaine, le carnet |
| `/duels#duel-<code>`, `#defier`, `#defier-<id>` | un duel entre amis, en préparer un, défier quelqu'un |
| `/compte#historique` | l'historique de l'espace, dans la page |
| `/admin#profils`, `#salons`… | une page du QG par sujet |
| `/<espace>/souvenir#stats` | le souvenir ouvert sur ses chiffres |
| `/<espace>/bilan#p=<invité>`, `#salle` | le bilan d'un invité, le bilan de la soirée |
| `/activer#t=<jeton>` | le jeton d'activation, que le navigateur garde pour lui |

Les fragments d'avant mènent à l'écran qui les a repris : sur `/profil`, `#avatars`, `#style-…`, `#carte-…`, `#trophees` (et `#mes-themes`, vers `/boutique`) ; dans « Ma collection », les trois lignes d'avatars d'avant (`#collection-legendaires`, `#collection-savoir`, `#collection-emojis`) mènent à leur page de l'album des avatars, et les dix lignes de trophées d'avant (`#collection-paliers`, `#collection-jour`…) à la page de leur mode dans l'album des trophées ; sur `/campagne`, `#duel-<code>` et `#defier`, réécrits sur `/duels` ; sur `/boutique`, `#vies`, la fiche de la vie.

## Les pages d'un espace

| Adresse | Page | Pour qui | Fichier |
|---|---|---|---|
| `/<espace>` | Le téléphone de l'invité : l'entrée, la salle d'attente, le quiz, la fin de soirée | invités | `client/src/views/PlayerApp.tsx` |
| `/482157` (six chiffres) | Le code d'un salon : le serveur redirige vers l'adresse de son espace | invités | `server/src/core/apercus.ts` |
| `/<espace>/souvenir` | Le souvenir de la soirée en cours — entre deux soirées, celui de la dernière close | public | `client/src/views/RecapApp.tsx` |
| `/<espace>/stats` | L'adresse d'avant des chiffres : réécrite en `/<espace>/souvenir#stats`, le souvenir ouvert sur son tableau | public | `client/src/views/RecapApp.tsx` |
| `/<espace>/bilan` | Le bilan, question par question : « Mon bilan », « La soirée » | public | `client/src/views/BilanApp.tsx` |
| `/<espace>/bilan/fiches` | Les fiches à imprimer, une par invité, en Ivoire | public (son lien, à l'animateur) | `client/src/views/BilanApp.tsx` |
| `/<espace>/soirees` | L'historique de l'espace : la soirée en cours, puis chaque soirée close | public | `client/src/views/ArchivesApp.tsx` |
| `/<espace>/soirees/<id>` | Le souvenir d'une soirée archivée | public | `client/src/views/RecapApp.tsx` |
| `/<espace>/soirees/<id>/souvenir`, `…/stats`, `…/bilan`, `…/bilan/fiches` | Les mêmes pages, tournées vers cette archive — une adresse qui ne change plus | public | `client/src/views/RecapApp.tsx`, `client/src/views/BilanApp.tsx` |

Les pages d'une soirée sont publiques, faites pour se partager, et cloisonnées : un nom d'espace inconnu vaut « introuvable », sans rien dire des autres (invariant 3). Ce qu'elles montrent : [Après la soirée](../produit/apres-la-soiree.md).

## Ce que le serveur répond

Avant tout script, le serveur décide du statut et des balises de la page (`decrirePage`, puis `servirPage` dans `server/src/server.ts`) :

| L'adresse | Le serveur |
|---|---|
| `/` (et `/index.html`) | 200, indexable : « FiestApp · le quiz de soirée » |
| une page sans espace | 200, « FiestApp », non indexée — la page pose ensuite son titre |
| `/<espace>`, au nom exact | 200 : le titre de l'espace, « Rejoins le quiz depuis ton téléphone : un prénom, et c’est parti. », l'en-tête de l'entrée et son attente déjà écrite |
| une page publique, au nom exact | 200 : « ‹titre de l'espace› · Souvenir » (« · Bilan », « · Les soirées ») |
| une soirée archivée | 200 si elle existe ; 404 si la base permanente répond qu'elle n'existe pas ; 200 quand même si la base se tait plus d'1,5 seconde (`DELAI_VERIFICATION_ARCHIVE_MS`) ou tombe en panne — la page dira ce qu'elle peut lire |
| un nom tapé autrement — majuscules, accents, espaces : « /Chez-Bruno », « /chez%20bruno », « /chez.nadia » | 302 vers le nom exact, la suite de l'adresse et la requête gardées |
| un nom inconnu dont `chez-‹saisie›` existe : « /nadia » | 302 vers `/chez-nadia` — la seule devinette permise, jamais un nom voisin |
| six chiffres, le code d'un salon ouvert | 302 vers l'espace du salon, la suite de l'adresse et la requête gardées ; le code vaut encore une demi-heure après la clôture |
| six chiffres qui ne mènent à aucun salon | 404 |
| six chiffres, quand l'adresse a épuisé ses essais | 429, « Trop d’essais · FiestApp » : vingt codes manqués d'affilée, puis deux par minute — même le bon code ne se cherche plus |
| une adresse inconnue, un espace inconnu | 404, « Soirée introuvable · FiestApp » — « Cette adresse ne mène à aucune soirée. » ; la page propose « Rejoindre une soirée » |

Sur toute page : `Cache-Control: no-cache` ; hors de l'accueil, la balise `robots` (`noindex, nofollow`) et l'en-tête `X-Robots-Tag`. Les balises d'aperçu ne nomment jamais un invité : leur titre vient des réglages de l'espace. Sans client construit, toute page répond 404 : « Client non compilé (npm run build) » quand `client/dist/` existe sans sa page, la réponse nue d'Express (« Cannot GET … ») quand le dossier manque.

Le serveur de développement de Vite (`npm run dev`, port 5173) ne fait rien de tout cela : il sert la page telle quelle, et l'application lit l'adresse seule ([Le client](../architecture/client.md)).

## Les adresses d'avant les espaces

Les liens partagés et les QR imprimés avant les espaces mènent à l'espace de l'administrateur, par une redirection 302 (`server/src/server.ts`) :

- `/souvenir`, `/stats`, `/bilan`, `/bilan/fiches`, `/soirees`, `/soirees/<id>` et `/soirees/<id>/souvenir` (`…/stats`, `…/bilan`, `…/bilan/fiches`) : la même adresse, sous `/<espace>` ;
- `/recap.json`, `/bilan.json`, `/soirees.json`, `/soirees/<id>/recap.json`, `/soirees/<id>/bilan.json` : la même, sous `/s/<espace>`.

## Ce qui n'est pas une page

| Chemin | Ce que c'est |
|---|---|
| `/s/<espace>/…` | les données des pages d'un espace : `space.json`, `entree.json`, `recap.json`, `bilan.json`, `soirees.json`, `joueurs/<id>.json`, et celles d'une soirée archivée — [L'API HTTP](api-http.md) |
| `/api/…` | l'API — [L'API HTTP](api-http.md) |
| `/media/image/<id>`, `/media/quiz/…` | les photos des quiz |
| `/socket.io` | la liaison temps réel — [Les événements temps réel](evenements-temps-reel.md) |
| `/healthz` | l'état du serveur — [Exploiter](../exploitation/exploiter.md) |
| `/assets/…` | le paquet du client, à empreinte : un an de cache sans revalider, précompressé |
| `/fonts/…` | les polices : trente jours de cache |
| `/portraits/…`, `/medaillons/…`, `/compagnons/…`, `/decors/…` | les images peintes, à empreinte : un an de cache |
| `/sw.js`, `/manifest.webmanifest`, `/icone.svg`, `/icone-180.png`, `/icone-192.png`, `/icone-512.png`, `/favicon.ico` | les fichiers de `client/public/`, servis à la racine : une heure de cache |
| `/robots.txt` | écrit par le serveur : seul l'accueil se laisse indexer, `/s/`, `/api/` et `/media/` sont fermés aux robots |

Les 404 qui ne sont pas des pages :

- un chemin inconnu sous `/api`, `/media` ou `/s` répond en JSON, `{ "error": "Introuvable" }` : un client qui attend du JSON ne reçoit jamais la page ;
- un fichier absent dont l'extension est de celles que le serveur sert — `.ico`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`, `.js`, `.mjs`, `.css`, `.map`, `.json`, `.webmanifest`, `.txt`, `.xml`, `.woff`, `.woff2` — répond 404 en texte, « Introuvable » : le `favicon.ico` d'une vieille version ne reçoit pas l'accueil ;
- un point qui n'est pas une extension (« /chez.nadia », dicté au téléphone) ouvre l'application, et le serveur redirige vers `/chez-nadia`.

## Les noms d'espace

Un espace a un nom dans l'adresse (`chez-nadia`). `isValidSlug` (`shared/space.ts`) l'accepte s'il a la forme `SLUG` — 2 à 24 caractères, minuscules sans accent, chiffres et tirets —, s'il n'est pas réservé, et s'il n'est pas fait de six chiffres (`CODE_DU_SALON` : ce serait le code d'un salon). Seul l'administrateur choisit l'adresse d'un espace ; un salon tire la sienne, `s-` et six signes.

Ce qu'on tape se corrige par `normalizeSlug` : accents retirés, minuscules, tout autre signe — espace, ponctuation — changé en tiret, 24 caractères au plus (« Les Salseras ! » devient `les-salseras`).

### Les noms réservés

`RESERVED_SLUGS` (`shared/space.ts`) : les premiers segments que l'application emploie elle-même — un espace qui s'appellerait « host » masquerait l'écran commun. La liste, telle qu'elle est :

| Ce qu'ils protègent | Noms |
|---|---|
| des pages sans espace | `host`, `edit`, `compte`, `admin`, `connexion`, `activer`, `profil`, `jour`, `salon`, `tele`, `boutique`, `campagne` |
| les pages publiques, à la racine (leurs adresses d'avant) | `stats`, `souvenir`, `bilan`, `soirees` |
| les chemins du serveur | `s`, `api`, `media`, `assets`, `fonts`, `healthz`, `socket.io` |
| des fichiers de la racine | `manifest.webmanifest`, `icone.svg`, `recap.json`, `bilan.json`, `soirees.json`, `index.html` |
| deux noms gardés de côté | `joueur`, `deconnexion` |

Les noms à point n'ont de toute façon pas la forme d'un nom d'espace.

> [!WARNING]
> **Une page, ou un dossier servi avant la page, de plus rejoint cette liste — et rien ne l'impose** : le typecheck force une page nouvelle dans `ACCOUNT` (`client/src/main.tsx`) et `TITRES` (`client/src/titres.ts`), pas ici. Aujourd'hui, `duels` — une page — et les dossiers des images peintes — `portraits`, `medaillons`, `compagnons`, `decors` — n'y sont pas : un espace de l'un de ces noms se créerait, mais son adresse ouvrirait la page des duels, ou un dossier (`/decors` répond 301, puis 404). Seul l'administrateur choisissant les adresses, le risque tient à ses gestes.

## Pour aller plus loin

- [Le client](../architecture/client.md) — le routage, le chargement, ce que le serveur pose dans la page
- [L'API HTTP](api-http.md) — les routes des données (`/s/…`) et de l'API
- [Jouer](../guides/jouer.md) — rejoindre une soirée, vu de l'invité
- [La sécurité](../architecture/securite.md) — le cloisonnement des espaces, les sessions
