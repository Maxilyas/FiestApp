# L'affichage des pages — mesure du 5 octobre 2026

La demande : « un test de perf pour l'affichage des pages, le rendu. Je veux
que ça s'affiche rapidement. Dis-moi comment on peut améliorer ça. » Ce
rapport dit ce que chaque page fait attendre à un téléphone aujourd'hui, où
passe ce temps, et ce que rapporterait chaque piste — **mesurée sur une
variante, pas devinée**. L'outil reste au dépôt : `npm run mesure`
(`server/scripts/mesure-pages.ts`), la même mesure avant et après chaque
retouche. Rien n'a été changé à l'application pour l'écrire.

## En bref

- **Suite donnée le jour même** : les pistes 1 à 4 sont faites, dans la même
  PR — −8 à −28 % sur l'écran utile des pages qui attendent des données à la
  première visite, jusqu'à −45 % au retour, et le premier affichage 0,13 à
  0,26 s plus tôt partout (« Suite donnée », plus bas). Le reste de ce
  rapport décrit l'état d'avant.
- **Un invité qui scanne le QR attend 1,4 s en 4G avant l'écran d'entrée,
  4,2 s en 4G lente.** Les autres pages : 1,2 à 1,5 s en 4G et 3,8 à 4,7 s en
  4G lente à la première visite ; 1,0 à 1,3 s et 1,8 à 2,5 s au retour.
- **Le temps ne passe pas à dessiner** — un téléphone moyen exécute 0,25 à
  0,45 s de script par page. Il passe **à attendre, en file** : la page, puis
  le script et la feuille de style, puis le code de la page, puis ses données,
  chaque étape partant quand la précédente est arrivée et exécutée. Quatre à
  cinq allers-retours : les trois quarts de l'attente en 4G lente.
- **La piste qui rapporte le plus est la plus simple** : que la page demande
  ses données en même temps que son script, au lieu d'attendre son code
  (`<link rel="preload" as="fetch">`, posé par le serveur qui connaît
  l'adresse et le cookie). Mesuré : **−14 à −29 % en 4G, −14 à −26 % en 4G
  lente à la première visite, −15 à −47 % au retour** — davantage sur les
  sentiers, le souvenir et le bilan, qui enchaînent aujourd'hui deux demandes
  de données. Aucune perte sur le premier affichage.
- **Le chemin du QR a regrossi depuis le 27 septembre** (environ +270 ms à
  méthode égale) : la feuille de style commune a presque doublé (39 Ko
  compressés, 253 bruts ; l'invité en sert 2 %), et l'accueil d'un profil
  télécharge socket.io (13 Ko) pour deux fonctions d'une ligne.
- Le reste, mesuré : enchaîner moins de demandes (sentiers, souvenir, bilan :
  un aller-retour de moins chacun), écrire l'attente dans la page (le nom de
  la soirée paraît 0,16 s plus tôt en 4G, 0,26 s en 4G lente), couper la
  feuille de style par vue (−4 à −8 %), sortir socket.io de l'accueil (−1 à
  −5 %). **Preact à la place de React** rapporte beaucoup (−7 à −12 % à la
  première visite, −11 à −26 % au retour, −37 % sur l'écran commun) mais
  change le socle : à décider après le reste. Précharger les morceaux de la
  route ne vaut qu'en 4G lente, au prix d'un premier affichage plus tardif :
  pas maintenant.

## Ce que chaque page fait attendre

Écran utile, en secondes — médiane de trois essais, processeur ralenti ×4,
HTTP/2 (méthode plus bas). « 1ʳᵉ visite » : rien en cache ; « retour » : la
même page ouverte juste avant.

| Page | 4G, 1ʳᵉ visite | 4G, retour | 4G lente, 1ʳᵉ visite | 4G lente, retour | 1er affichage (4G, 1ʳᵉ visite) | Ko avant l'écran | requêtes |
|---|---|---|---|---|---|---|---|
| Entrée d'un invité (QR) | 1,4 | 1,2 | 4,2 | 2,2 | 0,7 | 215 | 40 |
| Salle d'attente (retour d'un invité) | 1,5 | 1,3 | 4,4 | 2,5 | 0,7 | 215 | 40 |
| Accueil sans profil | 1,2 | 1,0 | 3,8 | 1,8 | 0,7 | 232 | 37 |
| Accueil d'un profil | 1,3 | 1,0 | 3,9 | 1,8 | 0,7 | 232 | 37 |
| Profil (tuiles) | 1,3 | 1,0 | 3,9 | 1,9 | 0,7 | 236 | 37 |
| Mes avatars | 1,5 | 1,1 | 4,7 | 1,9 | 0,7 | 270 | 49 |
| Boutique | 1,5 | 1,0 | 4,7 | 1,9 | 0,7 | 270 | 49 |
| Quiz du jour | 1,2 | 1,0 | 3,8 | 1,8 | 0,7 | 230 | 41 |
| Campagne (série) | 1,3 | 1,0 | 3,8 | 1,8 | 0,7 | 202 | 36 |
| Sentiers du savoir | 1,5 | 1,2 | 4,4 | 2,5 | 0,7 | 202 | 37 |
| Souvenir de la soirée | 1,5 | 1,3 | 4,4 | 2,5 | 0,7 | 208 | 32 |
| Bilan de la soirée | 1,4 | 1,3 | 4,2 | 2,5 | 0,7 | 206 | 27 |
| Mes quiz | 1,3 | 1,0 | 3,8 | 1,8 | 0,7 | 223 | 30 |
| Écran commun (wifi, processeur ×2) | 0,7 | 0,6 | — | — | 0,2 | 257 | 45 |

Le premier affichage est le « Chargement… » d'attente — pour l'invité, le nom
de la soirée et « On arrive… » (`annonce.tsx`) : il vient une fois React
exécuté, à 0,7 s en 4G, 2,0 s en 4G lente, 0,5 et 0,9 s au retour.

## Où passe le temps

L'accueil d'un profil, première visite :

| Jalon | 4G | 4G lente |
|---|---|---|
| la page reçue (HTML, 2 Ko) | 0,18 s | 0,58 s |
| + le script d'entrée et la feuille commune (61 + 40 Ko, la police du titre, 24 Ko) | 0,49 s | 1,87 s |
| premier affichage : « Chargement… », une fois React exécuté | 0,69 s | 2,02 s |
| + le code de la page (29 morceaux, ~60 Ko), demandé par ce script | 0,88 s | 3,05 s |
| + ses données (`/api/joueur/moi?accueil`), demandées une fois ce code exécuté | 1,18 s | 3,75 s |
| **écran utile** | **1,29 s** | **3,85 s** |

Toutes les pages ont ce profil, à une étape près :

- **l'entrée d'un invité** n'a pas de données à demander, mais une liaison
  temps réel à ouvrir une fois son code exécuté : la poignée de main, puis
  deux échanges (`connect`, `party:watch`) avant l'instantané qui la dessine —
  la liaison ouverte à 1,24 s en 4G, l'écran d'entrée à 1,43 s (3,83 et
  4,24 s en 4G lente) ;
- **les sentiers** (où mène le bouton « La campagne » de l'accueil), **le
  souvenir et le bilan** entre deux soirées enchaînent **deux** demandes de
  données : `/api/campagne` puis `/api/campagne/sentiers` (le composant ne
  monte qu'après la première) ; `recap.json`, qui désigne la dernière soirée
  close, puis son archive (`client/src/derniere.ts`) ;
- **Mes avatars et la boutique**, ouverts sur un appareil neuf, attendent le
  profil pour demander leurs panneaux (`PanneauxDuProfil`, 18 Ko) : un tour de
  plus, +0,2 s en 4G, +0,8 s en 4G lente.

Au **retour**, les octets disparaissent mais pas la file : la page se
redemande (`no-cache`, un aller-retour), le script se réexécute (c'est lui
le premier affichage, à 0,48 s), puis les données partent — un aller-retour
encore. Rien ne fait gagner davantage au retour que de ne plus attendre le
code pour demander les données.

Les octets d'une première visite, avant l'écran utile : 200 à 270 Ko
compressés — 93 à 156 de script (61 pour l'entrée, dont 55 de React), **40 de
feuille de style**, 44 à 68 de polices —, en 27 à 49 requêtes. La couverture
dit ce qui en sert jusqu'à l'écran utile : **1 à 5 % de la feuille de style**
(253 Ko bruts, celle de toutes les pages) et 30 à 43 % du script. Le
processeur (×4) : 250 à 450 ms de script, 20 à 50 de styles, 20 à 120 de mise
en page ; les tâches longues bloquent moins de 60 ms, sauf le souvenir
(~140 ms).

## Depuis le 27 septembre : le chemin du QR a regrossi

L'audit perf-client (`retours/2026-09-27/experts/perf-client.md`) mesurait
l'entrée d'un invité à **1 828 ms** en 4G moyenne (150 ms, 1,6 Mbit/s,
processeur ×4, HTTP/2, cinq essais). Même profil aujourd'hui : **2 199 ms**,
dont une centaine tient à la méthode (ses messages temps réel n'étaient pas
retardés) : **environ +270 ms à méthode égale**. L'accueil sans profil passe
de 1 854 à 2 023 ms.

| Chemin du QR, avant l'écran d'entrée | 27 septembre | aujourd'hui |
|---|---|---|
| script (entrée + route), compressé | 111 Ko | **129 Ko** |
| feuille de style commune, compressée | 22,8 Ko (137 bruts) | **39,4 Ko (253 bruts)** |
| polices | 66–68 Ko (trois fichiers) | 44 Ko (l'italique arrive après) |
| requêtes | 28 | **40** |

La feuille de style a presque doublé — thèmes, sentiers, campagne, boutique,
calendrier —, et chaque page la paie entière avant son premier affichage.
C'était la piste 7 du 27 septembre (« le CSS par vue », P3), restée en
attente : c'est aujourd'hui la plus grosse part de la première vague après
React.

## Les pistes, mesurées

Chaque piste a été mesurée sur une variante : la page réécrite au vol par le
relais de la mesure (préchargements, feuille réduite, squelette), ou un client
construit autrement. Première visite, médiane de trois essais :

| Page | aujourd'hui | données dès la page | feuille réduite à ce que la page sert | morceaux de la route préchargés | les trois |
|---|---|---|---|---|---|
| **4G** | | | | | |
| Entrée (QR) | 1,39 | — | 1,36 (−2 %) | 1,43 (+3 %) | 1,38 (−1 %) |
| Accueil d'un profil | 1,34 | **1,14 (−15 %)** | 1,26 (−6 %) | 1,35 (0 %) | 1,11 (−17 %) |
| Profil | 1,33 | **1,14 (−14 %)** | 1,26 (−5 %) | 1,39 (+5 %) | 1,14 (−14 %) |
| Quiz du jour | 1,24 | **1,06 (−14 %)** | 1,18 (−5 %) | 1,29 (+4 %) | 1,04 (−16 %) |
| Sentiers | 1,55 | **1,11 (−29 %)** | 1,43 (−8 %) | 1,50 (−3 %) | 1,11 (−29 %) |
| Souvenir | 1,57 | **1,18 (−25 %)** | 1,47 (−6 %) | 1,58 (+1 %) | 1,17 (−25 %) |
| **4G lente** | | | | | |
| Entrée (QR) | 4,24 | — | 4,06 (−4 %) | 3,82 (−10 %) | 3,63 (−14 %) |
| Accueil d'un profil | 3,89 | **3,33 (−14 %)** | 3,71 (−5 %) | 3,49 (−10 %) | 2,72 (−30 %) |
| Profil | 3,90 | **3,33 (−14 %)** | 3,72 (−4 %) | 3,78 (−3 %) | 2,96 (−24 %) |
| Quiz du jour | 3,87 | **3,24 (−16 %)** | 3,60 (−7 %) | 3,45 (−11 %) | 2,68 (−31 %) |
| Sentiers | 4,45 | **3,34 (−25 %)** | 4,27 (−4 %) | 4,08 (−8 %) | 2,75 (−38 %) |
| Souvenir | 4,34 | **3,22 (−26 %)** | 4,16 (−4 %) | 3,97 (−9 %) | 2,67 (−39 %) |

Au retour (cache plein), seules les données restent à gagner :

| Page | 4G : aujourd'hui → données dès la page | 4G lente |
|---|---|---|
| Accueil d'un profil | 1,02 → **0,84 (−18 %)** | 1,83 → **1,30 (−29 %)** |
| Profil | 1,03 → 0,87 (−15 %) | 1,85 → 1,29 (−30 %) |
| Quiz du jour | 0,99 → 0,82 (−17 %) | 1,80 → 1,23 (−32 %) |
| Sentiers | 1,24 → 0,89 (−29 %) | 2,44 → 1,30 (−47 %) |
| Souvenir | 1,31 → 0,98 (−26 %) | 2,53 → 1,43 (−43 %) |

### 1. Demander les données dès la page — P1, effort S à M

**Ce que c'est.** Le serveur connaît, quand il sert la page (`servirPage`,
`server/src/server.ts`), l'adresse et les cookies : il sait ce que la page
demandera dès son code arrivé. Il le pose dans l'en-tête —
`<link rel="preload" as="fetch" href="/api/joueur/moi?accueil" crossorigin>` —
et le navigateur le demande avec le script, au lieu de 0,8 s (4G) ou 2,5 s
(4G lente) plus tard. Mesuré : le `fetch` de la page reprend la réponse
préchargée sans redemander, malgré `no-store` et l'en-tête `X-Requested-With`
(les GET n'en ont pas besoin, `csrfGuard`).

| Adresse | À précharger | À condition |
|---|---|---|
| `/` | `/api/joueur/moi?accueil` ; `/api/auth/me` | le cookie `qz_joueur` ; `qz_session` |
| `/profil`, `/boutique` | `/api/joueur/moi` ; `/api/auth/me` | idem |
| `/jour` | `/api/joueur/moi?leger`, `/api/jour` | `qz_joueur` — voir l'horloge plus bas |
| `/campagne` | `/api/campagne`, `/api/joueur/moi?leger` | `qz_joueur` |
| `/<espace>/souvenir`, `/bilan` | `recap.json` / `bilan.json`, et entre deux soirées l'archive que désigne `derniere` | — |
| `/edit` | `/api/quizzes`, `/api/auth/me` | `qz_session` |
| les pages qui ne lisent pas le profil | `/api/joueur/theme` | `qz_joueur` |

**À surveiller.** L'adresse doit être exactement celle que la page demande.
`/api/jour` passe par `avecLHeure` : un échantillon d'horloge pris sur une
réponse préchargée mentirait sur l'aller-retour (`bestSample` le croirait
parfait) — soit l'échantillon se lit dans le Resource Timing du préchargement,
soit `/api/jour` reste hors de la liste (le gain du quiz du jour tombe alors
à presque rien : la page attend les deux). Une épreuve dans `server/test/`
lit la page de `/` avec et sans cookie.

### 2. Plus de demande de données en file — P1, effort S

Trois pages font attendre un tour de plus, à chaque visite :

- **les sentiers** : lancer `/api/campagne/sentiers` avec `/api/campagne`
  quand l'adresse porte `#sentiers` (`CampagneApp.tsx`), plutôt qu'au montage
  de `Sentiers` ;
- **le souvenir et le bilan entre deux soirées** : le serveur sait déjà, en
  répondant `recap.json`, quelle soirée `derniere` désigne — il peut joindre
  sa page à la réponse (ou la précharger, piste 1), et `lecteurDePage` n'a
  plus de seconde demande à faire ;
- **Mes avatars et la boutique** sur un appareil neuf : lancer
  `panneaux.charger()` dès le module sur `/profil` et `/boutique`, sans
  attendre `profilConnuIci()`.

C'est un aller-retour de moins sur chacune : ~0,2 s en 4G, ~0,6 s en 4G
lente — la part de la piste 1 qui, sur les sentiers et le souvenir, double
leur gain.

### 3. socket.io hors de l'accueil — P2, effort S

`ProfilForm.tsx` importe deux fonctions d'une ligne d'`Entree.tsx`
(`identifiantPour`, `tirage`), et avec elles toute l'entrée d'un invité :
`Reprendre.tsx`, puis `socket.ts`, puis socket.io. L'accueil, le profil et la
boutique téléchargent et exécutent 13 Ko compressés (46 Ko de script) qu'ils
n'utilisent jamais. Déplacées dans un petit module, la route de l'accueil
passe de 29 morceaux et 59 Ko à 26 morceaux et 42 Ko. Mesuré sur un client
construit ainsi : 18 Ko et 3 requêtes de moins avant l'écran utile, −1 à
−5 % à la première visite (jusqu'à −0,2 s en 4G lente), rien au retour. Peu,
mais gratuit — et c'est la pente qui a fait regrossir le chemin du QR. Une
épreuve garde le gain : `socket.ts` ne figure pas dans les imports statiques
de `views/ProfilApp.tsx` (la recette de `medaillons.test.ts`).

### 4. Le squelette d'attente écrit dans la page — P2, effort S

Le premier affichage attend aujourd'hui le script d'entrée et React
exécutés. Le serveur peut écrire l'attente dans `<div id="root">` — pour
l'invité, le nom de la soirée et « On arrive… », qu'il glisse déjà dans ses
balises (`core/page.ts`) ; ailleurs, « Chargement… » —, exactement ce que
`Patience` (`annonce.tsx`) dessinera ensuite : React la remplace sans que
rien ne bouge. Mesuré sur l'entrée, la salle d'attente et l'accueil : le
premier affichage avance de **0,16 s en 4G** (0,68 → 0,52 s) et de **0,26 s
en 4G lente** (2,05 → 1,79 s) ; l'écran utile ne bouge pas. Il n'attend plus
que la feuille de style : avec la piste 5, il avancerait encore.

### 5. La feuille de style coupée par vue — P2, effort M

Réduite à ce que chaque page sert jusqu'à son écran utile, la feuille passe
de 39 Ko compressés à 2 ou 3 : −5 à −8 % en 4G, −4 à −7 % en 4G lente, et le
premier affichage avance de 40 à 80 ms en 4G, de 200 ms en 4G lente. C'est
un plafond : une vraie coupe garde une base commune (jetons, contrôles,
entrée, avatars). Elle se fait en déplaçant les familles de `styles.css` dans
des feuilles importées par leur vue — l'écran commun, l'éditeur et l'admin,
le quiz du jour et le calendrier, la campagne et les sentiers, la boutique,
la fin de soirée et la carte — : Vite en fait une feuille par morceau,
chargée avec lui. `design.test.ts` lit `styles.css` : il devra lire toutes
les feuilles.

### 6. Preact à la place de React — P3, effort M, à risque

Le script d'entrée pèse 61 Ko compressés, dont 55 de React ; `preact/compat`
en pèse une dizaine. Construit tel quel avec un alias (`react` →
`preact/compat`), le client a rendu les quatorze pages à l'identique
(captures comparées) — un premier signe, pas une preuve. Mesuré : l'entrée
passe de 61 à 17 Ko, le script exécuté au chargement de ~300 à ~160 ms (×4) :

| Page | 4G, 1ʳᵉ visite | 4G, retour | 4G lente, 1ʳᵉ visite | 4G lente, retour |
|---|---|---|---|---|
| Entrée (QR) | 1,40 → 1,28 | 1,15 → 0,93 | 4,22 → 3,92 | 2,15 → 1,91 |
| Accueil sans profil | 1,20 → 1,08 | 0,97 → 0,77 | 3,79 → 3,48 | 1,80 → 1,54 |
| Accueil d'un profil | 1,31 → 1,18 | 1,05 → 0,87 | 3,88 → 3,58 | 1,85 → 1,61 |
| Profil | 1,30 → 1,15 | 1,06 → 0,81 | 3,92 → 3,59 | 1,86 → 1,64 |
| Quiz du jour | 1,23 → 1,10 | 0,99 → 0,73 | 3,83 → 3,48 | 1,82 → 1,55 |
| Souvenir | 1,53 → 1,38 | 1,31 → 1,10 | 4,34 → 4,02 | 2,55 → 2,33 |
| Écran commun (wifi, ×2) | 0,66 → 0,41 | 0,62 → 0,38 | — | — |

Le gain le plus large après la piste 1, et le plus risqué : c'est le socle
qui change. Les écarts connus de `preact/compat` — des événements natifs,
un `StrictMode` qui ne double rien, les tests qui rendent des composants par
`react-dom/server` — demandent toute la vérification et une tablée avant d'y
croire. À décider une fois les pistes 1 à 4 faites, sur une mesure refaite.

### 7. Précharger les morceaux de la route — pas maintenant

`<link rel="modulepreload">` des morceaux de la route, posé par le serveur :
en 4G, rien (0 à +5 %), et le premier affichage recule de 0,1 s ; en 4G
lente, l'écran utile avance de 3 à 11 %, mais le premier affichage recule de
0,4 à 0,7 s — les morceaux prennent au script d'entrée la bande passante. La
conclusion de septembre (« c'est pire ») tient donc en 4G ; en 4G lente, et
une fois les pistes 1 à 4 faites, elle mérite d'être remesurée.

### 8. L'état de l'entrée dans la page — P2, effort M

L'écran d'entrée n'attend pas de données mais la liaison temps réel : entre
l'arrivée de son code et l'écran, 0,5 s en 4G (dont 0,35 de réseau : la
poignée de main et deux échanges) et 1,1 s en 4G lente (0,85 de réseau). Le
serveur, qui glisse déjà le nom de la soirée dans la page (`core/page.ts`),
connaît tout ce que l'entrée dessine : la soirée, s'il y a déjà des invités
ou un quiz en cours, et le profil que le cookie reconnaît. Écrit dans la page,
l'écran d'entrée paraîtrait dès son code exécuté, la liaison s'ouvrant
derrière : environ −0,3 s en 4G et −0,8 s en 4G lente sur la page de toute
la salle (estimé sur la cascade, pas mesuré). C'est `PlayerApp` qui doit
accepter un état de départ sans attendre `party:watch`.

### Écartée : différer les onglets du profil sur l'accueil

Au retour sur l'accueil, `PanneauxDuProfil` (70 Ko de script) part dès le
démarrage. Bloqué au navigateur : 1 035 contre 1 037 ms en 4G, 1 836 contre
1 830 en 4G lente — rien à gagner.

## Ce que je propose, dans l'ordre

D'abord les gestes simples, qui tiennent dans une même PR :

1. **Les données dès la page** (piste 1) et **plus de demande en file**
   (piste 2) : −15 à −30 % sur l'accueil, le profil, le quiz du jour, la
   campagne, le souvenir et le bilan, à chaque visite — sans rien changer à
   ce qu'on voit.
2. **Le squelette d'attente** (piste 4) : le nom de la soirée à l'écran
   0,2 s plus tôt, pour presque rien.
3. **socket.io hors de l'accueil** (piste 3), avec son épreuve.

Puis les deux chantiers :

4. **L'état de l'entrée dans la page** (piste 8) : la page que toute la salle
   ouvre en même temps.
5. **La feuille de style par vue** (piste 5), famille par famille.

Et une décision, sur une mesure refaite une fois le reste fait : Preact
(piste 6), les morceaux préchargés (piste 7).

En ligne, `/healthz` dit dans `ressenti` ce que coûtent les données côté
serveur (médiane et 95ᵉ centile par route, et chaque aller-retour vers
Turso) : c'est le complément de cette mesure, et ce qui dira si
`/api/joueur/moi?accueil` ou `recap.json` pèsent plus en ligne qu'ici.

## Suite donnée : les pistes 1 à 4, le jour même

Faites dans la même PR (#108), dans l'ordre proposé :

- **Les données dès la page** (piste 1). Le serveur précharge, en servant la
  page, ce que sa vue demandera dès son code arrivé
  (`<link rel="preload" as="fetch">`, `prechargerDonnees`,
  `server/src/core/page.ts`) ; la liste et la page lisent les mêmes adresses
  (`shared/depart.ts`). Trois écarts au plan :
  - **pour tout visiteur, pas selon les cookies.** La page demande ces
    adresses avec ou sans profil (un invité reçoit `null` ou 401). Et un
    préchargement que la page ne reprend pas n'est pas seulement perdu : le
    navigateur garde la réponse pour le premier `fetch` de la même adresse,
    sans regarder son âge — essayé, douze secondes après, il rendait encore
    celle du chargement. Une page qui ne demanderait une adresse qu'après une
    connexion y lirait la réponse d'un invité : la liste ne porte que ce que
    chaque page demande à l'ouverture, vérifié page par page (CLAUDE.md, les
    pièges) ;
  - **`/api/jour` reste dans la liste** : le serveur marque la réponse
    préchargée (`prechargee`), et le client lit son aller-retour dans le
    Resource Timing du préchargement (`mesureDeLaReponse`,
    `client/src/clock.ts`) ;
  - **les sentiers, le premier script les précharge** : `#sentiers` ne
    parvient pas au serveur. `main.tsx` pose le préchargement dès son
    exécution (`donneesDuFragment`), une demi-seconde avant que le code de la
    campagne n'arrive pour les demander ; la campagne s'ouvre sur eux par la
    même règle (`versLesSentiers`), et un sentier inconnu ouvre leur carte.
- **Plus de demande en file** (piste 2). Entre deux soirées, `recap.json` et
  `bilan.json` portent la page de la soirée close (`derniere.page`, gardée
  comme demandée seule — et provisoire avec elle : si les profils ne se
  lisent pas, ni l'une ni l'autre ne se garde) ; la campagne ouverte sur ses
  sentiers les demande avec son état ; la boutique et `/profil#…` demandent
  leurs onglets sans attendre le profil.
- **socket.io hors de l'accueil** (piste 3) : `components/inscription.ts`,
  et `medaillons.test.ts` garde le chemin — 17 Ko de script de moins sur
  l'accueil, le profil et la boutique.
- **L'attente écrite dans la page** (piste 4) : `ecrireAttente`, le balisage
  de `Patience` — une épreuve compare les deux rendus.

`npm run mesure` relève maintenant, à chaque page, les préchargements
qu'elle n'a pas repris (jamais demandés, ou redemandés au réseau) : aucun
sur les quatorze pages.

### Mesuré

Le commit d'avant (`dcd0ef0`) construit à part, puis celui-ci, mesurés à la
suite sur la même machine — trois essais par case, la médiane ; les
sentiers, remesurés après leur préchargement par la page. Écran utile, en
secondes (en gras, les gains de 10 % et plus) :

| Page | 4G, 1ʳᵉ visite | 4G, retour | 4G lente, 1ʳᵉ visite | 4G lente, retour |
|---|---|---|---|---|
| Entrée d’un invité (QR) | 1,37 → 1,35 (−1 %) | 1,13 → 1,15 (+2 %) | 4,26 → 4,18 (−2 %) | 2,16 → 2,19 (+1 %) |
| Salle d’attente (retour) | 1,49 → 1,48 (−1 %) | 1,22 → 1,30 (+6 %) | 4,46 → 4,39 (−2 %) | 2,34 → 2,41 (+3 %) |
| Accueil sans profil | 1,23 → **1,03 (−16 %)** | 0,98 → **0,86 (−12 %)** | 3,79 → **3,04 (−20 %)** | 1,78 → **1,24 (−30 %)** |
| Accueil d’un profil | 1,29 → **1,10 (−15 %)** | 1,02 → **0,89 (−12 %)** | 3,90 → **3,11 (−20 %)** | 1,84 → **1,29 (−30 %)** |
| Profil (tuiles) | 1,26 → **1,09 (−14 %)** | 1,06 → **0,89 (−16 %)** | 3,94 → **3,15 (−20 %)** | 1,87 → **1,29 (−31 %)** |
| Mes avatars | 1,53 → **1,25 (−18 %)** | 1,04 → **0,90 (−14 %)** | 4,69 → **3,98 (−15 %)** | 1,87 → **1,30 (−30 %)** |
| Boutique | 1,48 → **1,25 (−15 %)** | 1,07 → **0,90 (−15 %)** | 4,69 → **3,97 (−15 %)** | 1,88 → **1,33 (−29 %)** |
| Quiz du jour | 1,24 → **1,05 (−15 %)** | 0,98 → **0,84 (−14 %)** | 3,81 → **3,22 (−15 %)** | 1,79 → **1,28 (−29 %)** |
| Campagne (série) | 1,23 → 1,13 (−8 %) | 1,02 → **0,86 (−15 %)** | 3,83 → **3,26 (−15 %)** | 1,82 → **1,27 (−30 %)** |
| Sentiers du savoir | 1,46 → **1,13 (−23 %)** | 1,25 → **0,94 (−25 %)** | 4,47 → **3,22 (−28 %)** | 2,49 → **1,49 (−40 %)** |
| Souvenir de la soirée | 1,54 → **1,20 (−22 %)** | 1,33 → **1,00 (−25 %)** | 4,33 → **3,18 (−27 %)** | 2,58 → **1,44 (−44 %)** |
| Bilan de la soirée | 1,45 → **1,11 (−24 %)** | 1,24 → **0,92 (−26 %)** | 4,17 → **2,99 (−28 %)** | 2,48 → **1,36 (−45 %)** |
| Mes quiz | 1,23 → **1,09 (−11 %)** | 1,03 → **0,92 (−10 %)** | 3,77 → **3,11 (−17 %)** | 1,83 → **1,30 (−29 %)** |
| Écran commun (wifi, ×2) | 0,64 → 0,66 (+3 %) | 0,62 → 0,64 (+4 %) | — | — |

- **Toutes les pages qui attendent des données gagnent**, et autant que la
  variante l'annonçait : −11 à −24 % en 4G à la première visite, −15 à
  −28 % en 4G lente, et au retour jusqu'à −45 % — le souvenir et le bilan,
  qui enchaînaient deux demandes, gagnent le plus. La campagne gagne moins
  en 4G à la première visite (−8 % ; −12 % sur une seconde série) : ses
  données arrivent désormais 0,5 s avant son code, et c'est le rendu de sa
  page, 0,2 s au processeur ×4 une fois le code arrivé, qui la retient.
- **Le premier affichage avance partout** : de 0,66–0,71 s à 0,52–0,54 s en
  4G à la première visite, de 0,46–0,48 à 0,26–0,32 s au retour, de 2,03–2,06
  à 1,80–1,84 s en 4G lente ; l'écran commun, de 0,21 à 0,13 s. Pour
  l'invité, c'est le nom de la soirée et « On arrive… ».
- **L'entrée d'un invité et sa salle d'attente ne bougent pas** : elles
  attendent la liaison temps réel, pas une donnée — c'est la piste 8. Au
  retour, elles perdent même 20 à 80 ms : l'attente, peinte plus tôt, prend
  ce temps au processeur avant que la liaison ne s'ouvre (20 à 60 ms plus
  tard). Le nom de la soirée paraissant 0,16 s plus tôt, l'échange est
  gardé : c'est l'écran qui dit au téléphone que le QR a marché.
- **L'écran commun** : rien sur son écran utile (0,64 → 0,66 s, sous le
  seuil du bruit), le premier affichage 0,08 s plus tôt.

### Ce qui reste

Les deux chantiers, dans l'ordre : **l'état de l'entrée dans la page**
(piste 8) — la page que toute la salle ouvre en même temps, la seule que
cette PR n'avance pas —, puis **la feuille de style par vue** (piste 5).
Preact (piste 6) et les morceaux préchargés (piste 7) se décideront sur une
mesure refaite après eux.

## Méthode

- **L'outil** : `npm run mesure` (`server/scripts/mesure-pages.ts`). Un serveur
  jetable (`server/test/banc.ts`) sert le client construit de ce commit ; une
  soirée de six invités y est jouée puis close (le souvenir et le bilan la
  montrent, comme le lendemain d'une vraie soirée), Léa y gagne un profil, et
  Zoé attend le quiz suivant dans la soirée d'après (sa salle d'attente).
- **Quatorze pages**, chacune avec son « écran utile » : le premier élément
  qui dit que la page est là (les trois boutons de l'entrée, les tuiles du
  profil, la carte du quiz du jour…), guetté dans la page par un
  `MutationObserver` et compté une fois peint.
- **Un téléphone moyen** : Chromium 1194 sans tête (Playwright), 360 × 640,
  DPR 2, tactile, processeur ralenti quatre fois. L'écran commun : 1366 × 768,
  processeur ×2, en wifi.
- **Le réseau**, aux préréglages de Chrome : « 4G » (165 ms par requête,
  9 Mbit/s) et « 4G lente » (563 ms, 1,6 Mbit/s — celle que Lighthouse prête
  à un téléphone) ; la « 4G moyenne » des audits de septembre (150 ms,
  1,6 Mbit/s) pour comparer à leurs chiffres.
- **HTTP/2, comme en ligne** : le frontal de Render parle HTTP/2 (ou 3) au
  navigateur et HTTP/1.1 au service
  ([Render](https://feedback.render.com/features/p/connection-between-render-proxy-and-user-service-supports-http2)) ;
  la mesure pose un relais qui fait de même. En HTTP/1.1, le navigateur
  n'ouvre que six connexions, et les trente à quarante morceaux d'une route y
  font la queue, une latence de 4G à chaque tour : l'entrée y paraît à 2,0 s
  au lieu de 1,3 en 4G, à 6,5 s au lieu de 4,0 en 4G lente.
- **Le temps réel retardé** : Chrome ne bride que la poignée de main d'un
  WebSocket, pas ses messages ; le relais retarde chacun d'un demi
  aller-retour (60 ms en 4G, 150 en 4G lente). Sans ça, l'entrée d'un invité
  gagnait 150 ms qu'aucun téléphone ne gagne.
- **Cache vide** (un contexte neuf) et **cache plein** (la même page ouverte
  juste avant, dans le même navigateur). Le certificat du relais est cru par
  son empreinte : avec `ignoreHTTPSErrors`, Chrome ne met rien en cache, et le
  cache plein se mesurait comme le vide — un piège de cette mesure, corrigé
  avant les chiffres ci-dessus.
- **Trois essais par case, la médiane** (cinq pour la 4G moyenne). Machine :
  quatre cœurs Xeon 2,1 GHz, un seul navigateur à la fois. Les séries sont
  serrées ; un écart de moins de 50 ms entre deux variantes n'est pas un
  résultat.
- **Les variantes** : la page réécrite au vol par le relais (préchargements,
  feuille réduite à la couverture de la page, squelette), un accès bloqué
  au navigateur (les onglets du profil), ou un client construit autrement
  (`--client` : Preact, socket.io retiré). Rien n'en est versé au dépôt : ces
  bancs-là vivaient dans l'atelier de la mesure.

## Limites

- **Un bridage simulé, pas une vraie 4G** : une latence par requête et un
  débit plafonné, sur Chromium sans tête et sans GPU. Ni iOS/WebKit, ni un
  vrai Android d'entrée de gamme, où le processeur pèse plus que ×4. Les
  écarts entre variantes sont plus sûrs que les temps absolus.
- **Le serveur est en local** : ses réponses partent en quelques
  millisecondes. En ligne, chaque donnée paie aussi ses allers-retours vers
  Turso (`/healthz`, `ressenti`) : toute piste qui retire une demande de la
  file y gagne davantage.
- **Le réveil de l'hébergeur** n'est pas mesuré : la production ne dort plus
  que la nuit (MISE-EN-LIGNE.md), et un réveil reste un démarrage.
- **Des pages légères** : un profil récent, une soirée de six invités. Un
  habitué aux seize légendaires ou une salle de cinquante pèsent plus au
  rendu (l'audit du 27 septembre) ; leur premier affichage, lui, ne change
  guère.
- **Le service worker n'est pas une piste** : il ne fait que le rappel du
  soir, exprès (CLAUDE.md) — un cache servirait une vieille application à
  toute une salle.

## Rejouer

```bash
npm run build -w client
npm run mesure                                   # les quatorze pages, 4G et 4G lente, cache vide et plein (~1 h)
npm run mesure -- --pages=entree,accueil --essais=1 --cascade   # deux pages, les requêtes une à une
npm run mesure -- --reseaux=4g-moyenne --cache=froid --essais=5  # le profil des audits de septembre
npm run mesure -- --couverture                   # ce que chaque page sert de ce qu'elle charge
npm run mesure -- --client=../autre/dist         # un autre client construit, sur la même machine
```
