---
paths:
  - "server/scripts/tablee/**"
  - "client/src/games/quiz/PlayerView.tsx"
  - "client/src/components/{FinDeSoiree,Entree}.tsx"
  - "client/src/views/{HostApp,PlayerApp}.tsx"
  - ".claude/skills/tablee/**"
  - ".claude/agents/convive.md"
  - "server/test/tablee.test.ts"
---

# La tablée lit l'écran par ses classes

Pour faire jouer une soirée par des agents, suis la skill `tablee`.

## Les fichiers

- `server/scripts/tablee/regie.ts` · `pilote.mjs` — la tablée : un serveur jetable, un Chromium, et les gestes des agents qui y jouent une soirée — ou plusieurs à la fois, un salon par animateur (`chez <animateur>`) — la marche à suivre, les personnages, les experts et leurs consignes dans `.claude/skills/tablee/` (`/tablee`), l'agent des personnages dans `.claude/agents/convive.md`
- `server/scripts/tablee/gestes.ts` — ce que la régie lit sans navigateur : où toucher (`lireLeToucher`, `pointVise`), le nom que vise une lettre seule (`nomDUnSigneSeul`), le refus d'écrire dans un curseur (`UN_CURSEUR_NE_SE_TAPE_PAS`), le dé (`lireLeDe`, `lancerLeDe` : sa sortie et ce que le journal en garde), la partie du Cabinet que la page reçoit (`partieDeLaReponse`, `retenirLaPartie`) et la marche de ce qu'il faut savoir dans sa manche (`marchesASavoir`, `ligneDeLaMarche`) · `server/test/tablee.test.ts` — eux, leurs branchements dans la régie, la marche lue par le vrai serveur, la chronologie des dés, et chaque geste de la régie dit dans l'aide du pilote et dans les consignes ; les personnages du Cabinet, leurs domaines d'ignorance, et les seuils du dé recalculés du modèle du calibrage — ceux des consignes au joueur « tablée », ceux d'Ophélie à l'occasionnel
- `server/scripts/tablee/chronologie.mjs` — le journal d'une tablée en une page, les dés de chacun compris ; sans argument, celle que désigne `export/tablee/courante.json` : une seconde régie (`--fiche`) se lit en lui donnant son dossier

## Les pièges

- **La tablée lit l'écran par ses classes** (`.quiz-player`, `.ans-btn`,
  `.guess-form`, `.result-banner`, `.fin-tete`, `.player-shell`… et
  `.join-url`, l'adresse du QR que `scanner` lit sur `/host`, dans
  `HostApp.tsx`) : en renommer une casse ses raccourcis `question`,
  `repondre` et `scanner` sans que le typecheck le voie. Une tablée courte
  le dit. Ses autres gestes visent un texte par le rôle et le nom
  accessible (`toucher "Jouer sans compte"`) : un bouton renommé fait
  échouer les consignes et les fiches qui le citent.
- **Un geste se dit à trois endroits** : son `case` dans `regie.ts`,
  l'aide de `pilote.mjs` (`AIDE`, écrite à la main) et les consignes ou les
  fiches qui l'emploient. `tablee.test.ts` relit que l'aide nomme chaque
  geste de la régie, à sa place (en tête de ligne, après « · » ou
  « regie ») : n'importe où, « voir » et « texte » passaient leur ligne
  effacée. Il cherche dans les consignes du Cabinet `--a`, Tab et le dé, et
  dans la régie ce qui branche `gestes.ts` — la visée jusqu'à `tap` et
  `click`, le dé avant l'appareil allumé d'office et au journal : lu juste
  mais pas branché, le pilote aurait encore touché le centre.
- **Le pilote touche le centre d'un élément, sauf `--a`** (`toucher <cible>
  --a 30%`, ou `--a 60%,55%` : en pour cent de sa boîte) : au centre, l'épingle
  tombait au milieu de la carte de France et le curseur du Filet, son bouton
  au milieu, ne bougeait pas — la tablée du 25 octobre 2026 a pris le banc
  pour les jeux (« l'Épingle aux flèches seulement », « le Filet ne bouge que
  par un cran »). Deux nombres portent chacun leur « % » : « 62,5% », une
  décimale à la française, se lisait 62 % de large et 5 % de haut, l'épingle
  au bord nord de la carte ; `--a` pris dans les guillemets de la cible se
  refuse en mots. Chromium pose un curseur sous le doigt sans lui donner le
  focus : au clavier, il s'atteint par Tab — au Filet, depuis « Un cran de
  moins », qu'on touche et qui recule d'un cran. `ecrire` et `coller`
  refusent un curseur en mots, avant de le toucher : Playwright le vide
  d'abord (`fill('')`), qu'il y refuse — « Malformed value », lu comme un bug
  du Filet.
- **Une lettre seule ne cherche jamais un nom qui la contient**
  (`nomDUnSigneSeul`) : après les noms exacts, `localiser` prenait le premier
  nom qui contienne la cible, et une touche du Mot, une fois colorée,
  s'appelle « R , bien placée » — « R » touchait « Quitter », le premier
  bouton de la page, et les gestes suivants tombaient derrière sa fenêtre (la
  tablée du 26 octobre 2026). Une lettre ou un chiffre vise son nom, ou lui
  suivi d'une virgule ; un emoji garde la recherche d'avant — l'avatar 🦊
  s'appelle « Avatar 🦊 ».
- **Une photo attend ses polices et ses images** (`attendreSesImages`, trois
  secondes au plus, `ATTENTE_DES_IMAGES_MS`, comme les rendus) : le décodage
  d'une image hors de l'écran est asynchrone, et la page entière
  photographiée sans défiler montrait la Citrouille en disque irisé vide au
  bilan, chez trois personnages. Une image paresseuse hors de l'écran ne se
  charge pas : elle ne s'attend pas, sans quoi chaque photo d'une page qui en
  a (les portes du musée) paierait les trois secondes.
- **Un agent sait tout** : la tablée du Cabinet a fini 24 parties sur 47 à
  9 sur 9 (le diapason de John Shore, Pelé au premier indice). Chaque fiche
  du Cabinet dit ce que son personnage ignore, dans les mots des catégories
  (« Sport », « Cinéma & séries ») — la catégorie que la manche affiche,
  sinon son sujet (un tableau, « Arts & lettres » : cinq jeux n'en affichent
  pas) —, et hors de là le dé décide (`de 12`, aux parts du joueur « tablée »
  du calibrage, θ ≈ +2,5 — les consignes du Cabinet, « Répondre comme ton
  personnage »), un tirage par chose à savoir, qui dit aussi au Détail le
  cadrage, aux Indices l'indice, et ne se refait pas : relancé au tableau
  plus grand, le Détail se reconnaissait presque toujours, au-dessus de sa
  ligne. Une question de la base se sait à sa marche, comme au calibrage
  (`sait`, `filetSait`) : un seuil par marche — un seul pour toutes, et
  Ophélie faisait 9 sur 9 à un Mot épique aux questions difficiles. L'écran
  ne montre pas la marche, la vue n'en porte rien : la régie lit au passage
  chaque partie que la page reçoit (`partieDeLaReponse`, sans un
  aller-retour de plus), relit le plan figé à l'indice que la vue dit
  (`VueDeLaPartie.tirage`, `planDe`, une lecture par partie) et pose la
  marche seule en tête de l'écran d'une manche (« 🎲 Pour ton dé, la
  marche … ») — celle du pari après « Parier » seulement : avant, elle
  aurait dit s'il vaut la peine. Jamais la catégorie du plan : aux Indices,
  elle dirait d'avance qui chercher. Ce joueur n'ignore rien : la synthèse
  ne compare à sa ligne que les manches hors des domaines d'ignorance, que
  chaque retour désigne (la skill, « Le Cabinet de curiosités »). Il est du
  dernier centile : Ophélie joue au dé de l'occasionnel (sa fiche, « Son
  dé »), et se compare à sa ligne. Lancés d'avance à l'annonce (`de 12 9`) :
  un geste coûte quelques secondes, et la manche a son chrono. Le journal
  des gestes garde chaque tirage (`faces`, `tirages`), la chronologie les
  range (« Les dés »). Chaque seuil est une part du modèle du calibrage au
  douzième le plus proche, et `tablee.test.ts` les recalcule tous de
  `calibrage-cabinet.ts` : une part qui change, un joueur qui bouge, une
  chose à savoir qui prend sa marche se recopient dans les consignes et dans
  la fiche d'Ophélie ; le nombre de dés d'un Éclair suit son barème
  (`AFFIRMATIONS_DE_L_ECLAIR` × `MANCHES_PAR_PARTIE`).
- **La confirmation de « Quitter » dit « Quitter la partie »** : deux
  boutons « Quitter » se confondaient au pilote, la tête de la manche et la
  question. Les consignes et les fiches touchent « Quitter », puis
  « Quitter la partie » ou « Continuer ».
- **L'animatrice arrive par un compte à activer** (`/api/admin/accounts`,
  puis son lien `/activer`), le chemin d'avant le 3 octobre 2026 :
  aujourd'hui, un animateur ouvre son salon depuis son profil (« Créer un
  salon »), et `/admin` ne crée plus de compte. Ses retours sur son arrivée
  parlent de ce chemin-là.
- **Ce que signalent les navigateurs ne s'écrit nulle part** : seul le geste
  `console` le lit, et le vide. Le dossier de la tablée garde
  `journal.jsonl` (les gestes, sans leur sortie — sauf les tirages du dé,
  `faces` et `tirages`), `regie.log` (le serveur et
  la régie), `regie.json`, `captures/`, `retours/`, `bases/`, `photos/` et
  `telechargements/`.
