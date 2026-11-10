---
paths:
  - "client/src/**/*.css"
  - "shared/typographie.ts"
  - "server/test/{design,typographie,feuilles,calques-des-listes,hauteur-des-pages,marge-du-bout}.test.ts"
---

# Le CSS du client, et la typographie

## Les jetons

- **Côté client** : `--accent-text` pour ce qui s'écrit, `--accent-text-hover`
  pour son survol, `--accent` pour les aplats (le contraste d'Ivoire en
  dépend) ; les trois métaux d'un palier écrivent en `--bronze-text`,
  `--argent-text` et `--or-text` ; les petites boîtes prennent
  `--radius-xs`, et l'or du décor des fonds se lit dans `--fond-or`, posé
  sur `.carte-fond` (`design.test.ts` y veille) ; le focus n'a qu'un
  anneau, `--focus`, posé une fois pour tout élément
  (`:where(…):focus-visible`) — un composant n'en règle que
  l'`outline-offset`. **Sur l'or pâle (`--accent-soft`), un texte s'écrit
  en `--accent-text-hover`** : `--accent-text`, fait pour le fond de la
  page, y tombe à 4,09:1 sous le Film noir, 4,26 sous la Forêt rousse,
  4,35 sous le Carnet (le rendu du Cabinet, le 25 octobre 2026) ;
  `design.test.ts` le mesure sous chaque thème, et tient la liste des
  dix-neuf règles qui l'écrivent encore à l'or du texte hors du Cabinet
  (`.pill-btn.active`, `.onglet.actif`, `.titre-choix.selected`, les
  `.quoi-*.active`, `.exp-pastille-or`…) : chacune se corrige à son écran,
  regardée, et en sort ; aucune n'y entre. La garde ne lit qu'une règle à
  la fois : l'or pâle posé par l'une et le texte par une autre lui
  échappent — `.corrige-bonne` et sa légende (« La bonne réponse · la
  tienne »), relevées au Cabinet seulement. Aucun texte ne descend sous `--t-label` (0,6875 rem,
  les 11 px de `.label`, en `rem` pour suivre le texte agrandi) : la garde
  ne relit que sa liste de sélecteurs, et `.chiffre dt` (10 px) comme
  `.bilan-you` (0,68 rem) y échappent encore.
- **Une convention s'écrit en dur**, et aucun thème ne la repeint : le
  compteur des gros boutons, blanc sur rouge (`.gros-compteur`,
  `design.test.ts`) — `--alert` vire au jaune sous Braises ; les couleurs
  de piste des sentiers, comme au ski (`.balise-verte`, `-bleue`, `-rouge`,
  `-noire`, un liseré blanc pour la noire des thèmes sombres, et une forme
  chacune pour qui ne distingue pas les couleurs). `.piste` est pris : la
  piste d'un trophée, dans l'album.

## Le texte

- **La typographie se pose à l'affichage, jamais en base**
  (`shared/typographie.ts`) : `espacesFines` ne remplace que les espaces
  déjà là devant ? ! ; : — « Why? » reste tel quel —, en pose toujours dans
  « », colle l'inversion (« a-t-il ») par un gluon U+2060, et se repasse
  sans rien changer — le trait d'union insécable U+2011 n'est ni dans
  Figtree ni dans Cormorant : il viendrait d'une autre police, ou en carré
  sous Windows 10.
  `formatNumber` s'écrit sans `Intl` (règle `client.md`) et ne groupe les
  milliers qu'à cinq chiffres : « 1889 » reste une année. Un rang s'écrit
  au féminin (« 1ʳᵉ place »). `typographie.test.ts` compare `formatNumber`
  à `toLocaleString('fr-FR')` sur des milliers de nombres.

## Les pièges

- **Le coin haut droit d'une page du téléphone est à la niche du
  compagnon** quand le profil en a un (`body.avec-niche`) : la première
  ligne s'y arrête — le bloc « Sa place, page par page » de `styles.css`,
  règle `profil.md` —, et `server/scripts/rendu-niche.ts` dit ce qui passe
  encore dessous.
- **Une page à menu qui doit tenir sur l'écran retranche la barre de sa
  hauteur — et toute coquille de page le fait d'elle-même**, depuis le
  10 novembre 2026. `.player-shell` prenait au moins l'écran
  (`min-height: 100dvh`) et la barre du menu pose son retrait sur le corps
  (`body.avec-menu`, 72 px et l'encoche du bas) : l'un sur l'autre, toute
  page à menu défilait de la hauteur de la barre, même à moitié vide —
  « Mes soirées » d'un nouveau venu de 72 px, avec 325 px de libre
  au-dessus du menu —, et de 58 px de plus sous le bandeau du service,
  jusque sur l'écran d'une page en maintenance, qui n'a pas de menu. Le
  bloc « Une page prend l'écran, pas plus », en fin de `styles.css` : le
  corps dit ce que la barre lui prend (`--haut-du-menu`, la valeur même de
  son `padding-bottom`, le panier de la boutique compris), le bandeau sa
  hauteur mesurée (`--haut-du-bandeau`, `BandeauxDuService`), et les quatre
  coquilles qui prennent l'écran (`.center-page`, `.join`, `.player-shell`,
  `.filet`) les retranchent : `calc(100dvh - var(--haut-du-menu, 0px) -
  var(--haut-du-bandeau, 0px))`. Une règle à une seule classe, à la force
  de leur règle d'origine : elle la remplace, et toute règle plus précise
  garde la main — une question (`.player-shell:has(.ans-grid)`), le QG, un
  formulaire posé dans une autre page. Une page longue défile de ce qui
  dépasse, comme avant. Trois choses la tiennent. **Une hauteur qui lit
  une variable se replie sous `@supports`, jamais en seconde
  déclaration** : une déclaration qui contient `var()` est tenue pour
  valide à la lecture, et le navigateur qui ne connaît pas `dvh` ne retombe
  pas sur le `vh` écrit au-dessus — il la jette au calcul, et la coquille
  n'a plus de hauteur du tout (vérifié dans Chromium, sur une unité
  inconnue). **La barre pose sa classe avant que la page ne se dessine**
  (`MenuBarre`, `useLayoutEffect`) : posée après, une page qui partage
  l'écran entre ses lignes se mesurait une image sans elle, puis se
  reprenait sous le doigt. **Et le bandeau que le serveur écrit avant la
  racine n'est pas encore mesuré** le temps du chargement : tant qu'il est
  l'enfant direct du corps, la racine prend ce qu'il laisse
  (`body:has(> .bandeau-du-service)`) — l'attente écrite dans la page
  défilait de 58 px, et « Chargement… » remontait de 29 à l'arrivée de la
  page. L'accueil d'un profil et le carrefour du profil, qui tiennent sur
  un écran (règle `profil.md`), prennent l'écran moins la barre et le
  bandeau, jusqu'à un plafond (`body.avec-menu .accueil`,
  `body.avec-menu .profil-carrefour`), en `svh`, pas `dvh` : la barre
  d'adresse du navigateur dépliée, tout tient encore. Ce qui s'y partage la
  hauteur garde sa base à son contenu (`flex: 1 0 auto`, jamais `flex: 1`),
  et ce qu'ils resserrent d'un composant partagé se règle en fin de
  feuille, sous leur propre cadre (`.accueil-gestes`, `.profil-boutons`) :
  les pièges de la règle `profil.md`. `hauteur-des-pages.test.ts` garde la
  feuille ; ce qui défile ne se voit qu'au navigateur —
  `server/scripts/rendu-carrefour.ts` ouvre ces pages aux deux tailles et
  sort en erreur si l'une défile alors que sa coquille n'est pas plus haute
  que son minimum. Une barre de plus au bas d'une page dit sa hauteur dans
  `--haut-du-menu`, à côté du retrait qu'elle pose sur le corps.
- **La marge du bas d'une coquille se resserre : un ressort et une rallonge,
  jamais une marge réécrite** (« Ce qui reste », la revue des écrans du
  10 novembre 2026). `padding-bottom` vit dans la boîte : un contenu qui
  tenait sur l'écran, à moins d'une marge de son bord, faisait défiler la
  page d'autant, pour ne montrer que du vide — en 360 × 640, la révélation
  d'une soirée de 25 et 26 px, « Pas cette fois » de 20, une étape de
  parcours et la question bonus de 28, « Ton équipe » de 25, un duel reçu
  de 17 ; en 390 × 844, « Palier validé » de 22. Une marge ne sait pas
  rétrécir, et une coquille à hauteur libre ne rétrécit rien : le bloc « La
  marge du bout se resserre », en fin de `styles.css`, laisse chaque marge où
  sa règle la pose et lui ajoute deux pièces. **Le ressort** (`::after`, le
  dernier de la colonne) la reprend par sa marge négative
  (`--marge-du-bout`) et la rend en grandissant, avant quiconque
  (`flex: 9999 1 0px`, jamais plus qu'elle) : large, la page est au pixel
  celle d'avant — ce qui s'étire, ce qui est poussé en bas s'arrête où il
  s'arrêtait — ; juste, la marge se resserre jusqu'à rien et la coquille
  garde sa hauteur d'écran. **La rallonge** (`::before`, en absolu sous la
  coquille, qui en devient le repère) rend au bout d'une page plus longue
  que l'écran ce dont elle dépasse, jusqu'à la marge entière : 3 px de trop
  font défiler de 6, et passé une marge tout est comme avant. Ce qui le
  tient. **L'écart de la colonne** : une colonne en `flex` sépare aussi ses
  enfants du ressort, qui reprend cet écart (`--ecart-de-la-colonne`) — une
  coquille, ou une classe posée à côté de `player-shell`, qui pose son `gap`
  le redit dans le bloc, à la même valeur et dans le même ordre ; plus
  petit, la page finit trop bas, plus grand, la coquille est plus courte
  que son contenu. **Ce qu'une marge rend** : jamais l'encoche du bas d'un
  téléphone, ni la barre du chef, que sa coquille compte dans sa marge ; une
  règle de plus qui pose la marge du bas ou la hauteur d'une coquille dit
  dans le bloc ce qu'elle rend, ou rejoint celles qui gardent leur marge
  telle quelle — une question (sa marge porte « Réponse enregistrée »), le
  pied d'une partie du Cabinet (il reprend déjà la marge à son compte),
  l'accueil et le carrefour du profil, le QG, l'Expédition, un formulaire
  posé dans une autre page. Le départ d'une série, resserré le même jour sur
  un téléphone (16 px de marge, un écart de 12 puis de 10), le redit au
  ressort dans sa règle même, pas dans le bloc : sous les mêmes requêtes
  d'écran, des jumelles y auraient fait quatre pas de hauteur là où
  `heros.test.ts` en compte deux. L'épreuve a rougi pour lui dès que les deux
  se sont croisés — sans ces deux variables, le ressort lui reprenait 28 px,
  et sa page finissait douze pixels avant son contenu — ; elle vérifie aussi
  qu'une règle qui parle au ressort hors du bloc l'emporte par sa force sur
  chacune de ses jumelles, sa place dans la feuille n'étant plus la leur.
  **Une page qui pose sa propre marge du bas la dit au ressort.** Celle du
  compagnon, resserrée le même jour, n'en a plus sur un téléphone
  (`--chez-bas`, de rien à 24 px passé 800 px de haut, règle `profil.md`) :
  le ressort lui en reprenait 24, et ce dont son contenu dépassait l'écran,
  jusqu'à 24 px, passait derrière le menu sans que la page défile — le cadre
  de « Tes compagnons » d'un vétéran, 5 px, en 360 × 740 (mesuré à
  l'intégration : `rendu-compagnon.ts` sort en erreur dès que ce qui passe
  sous le menu dépasse ce dont la page défile). Sa jumelle lit la même
  variable ; la loge et le classement des collections, resserrés ce jour-là
  aussi, ont la leur pour leur écart (10 puis 8 px sans compagnon,
  `--cl-ecart`). L'épreuve ne voyait pas la page du compagnon : sa coquille
  choisit ses classes (`className={… ? 'player-shell chez-page' :
  'player-shell'}`), et elle ne lisait que le premier texte d'un
  `className` — elle les lit tous ; une coquille dont les classes viennent
  d'une variable lui échapperait encore.
  **Les deux pseudo-éléments sont pris** sur une coquille à ressort : le
  verdict d'un duel, qui tient son halo dans `::before`, garde sa marge.
  **Et tout le bloc vit sous `@supports`**
  (`selector(:has(a)) and (min-height: 100dvh)`) : sans `:has()`, les
  exceptions ne se liraient pas ; un navigateur d'avant garde la page
  d'avant, entière. `marge-du-bout.test.ts` garde la feuille ; la loi
  se rejoue au pixel, sans serveur, dans Chromium
  (`retours/2026-11-10/ecrans/reproductions/marge-du-bout.cjs`, le client
  construit d'abord ; `--avant=<dépôt>` compare deux feuilles : jamais plus de
  défilement, aucun bloc qui bouge). **La sonde de la revue lit le dernier
  texte, pas la dernière boîte** : la révélation à quatre lignes et titre
  sur deux, sous la niche, « tenait » à 639 px quand sa carte finit à 659,5
  — elle dépasse vraiment de 19,5 px, et défile de 39 au lieu de 47. **Et
  d'un relevé à l'autre, des pages changent toutes seules** : la carte
  « Mission accomplie » d'une fin de duel suit les missions tirées pour son
  profil, neuf à chaque lancement (`rendu-duels.ts`, `rendu-niche.ts` : 241 px
  de plus ou de moins sous un verdict), et une traversée du Cabinet tire son
  jeu et ses questions — un avant/après ne se lit qu'à contenu égal, la
  coquille et ses enfants comparés. Ce qui reste : cette révélation-là ; une
  question du Cabinet sous une carte-bonus, dont la quatrième réponse passe
  sous le pied collé (61 px, « Le Pari ») ; et sous l'encoche d'un iPhone,
  l'application installée, la marge d'un invité, qui est l'encoche même.
- **En CSS, `transform` se compose APRÈS `rotate`**, et une animation qui pose
  `transform` écrase celui de l'élément : le toast, centré par
  `translateX(-50%)`, partait sur la droite. Centre par marges.
- **Cormorant (`--serif`) écrit ses chiffres à l'ancienne** : un nombre qu'on
  lit seul — un score, une place, un solde — pose `lining-nums`, sans quoi
  « 0 bonne réponse » se lisait « O bonne réponse ». Et
  `font-variant-numeric` est une seule propriété : `tabular-nums` seul efface
  le `lining-nums` d'une règle plus large — écris les deux
  (`design.test.ts`).
- **Chaque taille de police d'un emoji se met en forme à part** : des
  particules à vingt-deux tailles tirées au hasard coûtaient 100 à 230 ms de
  mise en forme à la révélation, au processeur ×4 ; à une seule taille,
  réduites par `transform: scale()`, 20 ms (la gerbe, règle `themes.md`).
  Une taille qui varie d'un élément à l'autre passe par `scale()`, jamais
  par `font-size` — et se réduit, sans s'agrandir : l'emoji reste net. Un
  emoji dans un `content:` compte pour `emojis.test.ts`, comme un texte.
- **Rien ne déborde de côté, même le temps d'une animation** : au téléphone,
  un élément poussé hors de l'écran élargit la page, et tout ce qui est
  fixe — la barre du menu, un voile — grandit et saute. L'affiche d'« À la
  une », qui entrait de 28 pixels à droite, faisait la page large de 368
  pixels sur 360, et la barre du menu sautait de 15 pixels à chaque objet
  (le 15 octobre 2026). Ce qui glisse de côté reste dans son cadre
  (`overflow-x: clip`, qui laisse déborder en hauteur) ou dans les 20 pixels
  du bord de la page ; une sonde le mesure à chaque image
  (`document.documentElement.scrollWidth`, la boîte de `.menu-barre`).
  La lumière d'une finition se mesure en `em` (`Lumiere.tsx`) : sous un
  avatar en grand, elle dépasse l'écran — la bague du Diamant fait 391
  pixels sous l'Éclat du quiz du jour (`.fin-apparition`, 170 px), et la
  niche partait hors champ (le 3 novembre 2026) ; la carte qui pose un
  avatar en grand garde la sienne (`.fin-eclat`, `design.test.ts`).
- **Un voile ouvert fige la page de dessous, sans la toucher** — une feuille
  (`.carte-voile`, `Feuille`, vingt-six écrans), la carte d'un joueur ou un
  dialogue (`.dialog-backdrop`) : le voile ne laisse passer aucun geste
  (`touch-action: none`, qui s'arrête au cadre qui défile), et ce cadre garde
  les siens (`overscroll-behavior: contain` sur `.carte-corps`,
  `.carte-defile`). Arrivé au bout d'une feuille, le geste suivant faisait
  défiler la page de l'accueil, et au téléphone la barre d'adresse se
  repliait : l'écran grandissait, la feuille posée en bas d'un voile fixe
  sautait d'un coup. Jamais `html { overflow: hidden }` (essayé le même jour) :
  le défilement de la page changé à l'ouverture, la barre d'adresse peut
  revenir, et tout l'écran se redimensionne le temps qu'elle glisse. Et le
  voile s'assombrit au pas de la feuille, par sa couleur (`voile-tombe`),
  jamais par son opacité : posé noir d'un coup sous une feuille encore
  transparente, il faisait clignoter tout l'écran ; en fondu d'opacité, il
  emportait la feuille, tout l'écran repartait de transparent, et au
  téléphone l'accueil reparaissait le temps d'une image (« la page de
  dessous qui s'affiche une micro seconde », le 15 octobre 2026,
  `feuilles.test.ts`). Une feuille, une carte ou un dialogue reste opaque dès
  sa première image : `.dialog-backdrop` s'assombrit de même.
  Chromium sans écran ne montrait ni cette image-là, ni la barre
  d'adresse : la sonde mesure `scrollY` sous la feuille, au doigt
  (`Input.dispatchTouchEvent` — `synthesizeScrollGesture` n'y fait rien
  défiler), et filme l'ouverture (`Page.startScreencast`) pour la
  luminosité de chaque image.
- **Les deux voiles sont modaux** — celui d'une feuille et celui d'un
  dialogue, comme la carte d'un joueur : ce qu'ils couvrent devient `inert`
  (`useModale`, `horsDeLaBoite`, règle `client.md`), eux restent vivants. Le
  CSS n'y est pour rien : `touch-action` arrête le doigt, pas le clavier ni le
  lecteur d'écran, qui lisait dix-sept liens du musée sous « Comment ça
  marche ? » (la tablée du 25 octobre 2026). La boîte reçoit le focus par
  programme (`tabindex="-1"`), sans aucun anneau : celui de l'application
  l'écarte, et `useModale` la focalise `focusVisible: false` (`SANS_ANNEAU`,
  `modale.ts`). Sans l'option, `:focus-visible` lui donnait le filet blanc du
  navigateur (`outline: auto`) ouverte au clavier, ou sans geste encore — la
  feuille des missions à l'arrivée sur `/#missions`, le réveil d'un gardien à
  l'arrivée au Cabinet —, et `.cab-page [tabindex='-1']:focus` ne l'effaçait
  que sous trois feuilles du Cabinet sur cinq. Au premier Tab, l'anneau d'or
  passe sur « Fermer ». Un navigateur qui ignore l'option garde son filet :
  la carte d'un joueur, la feuille, la fiche de la niche et le coffre
  l'effacent aussi en CSS (`.carte-joueur:focus`, `.carte-feuille:focus`,
  `.niche-fiche:focus`, `.coffre-boite:focus`, `petit-ecran.test.ts`).
- **Ce qui se pose sur la page a un sol plein, sous tous les thèmes.**
  Chaque thème repeint `.card` d'un verre fait pour laisser voir son décor —
  translucide sous vingt-cinq d'entre eux, de 82 à 95 % —, d'un sélecteur
  (0,3,0) plus fort que celui d'un dialogue (`.dialog`, 0,1,0) ou de la carte
  d'un joueur (0,2,0), un `.card` jusqu'au 20 octobre 2026 : ouverte depuis
  la liste des amis, la carte d'un ami laissait lire toute la liste au
  travers d'elle (« une histoire de transparence avec le thème qui passe
  par-dessus », le 19 octobre 2026). Leur sol se reprend, plus fort que le
  thème et sa couleur seule
  (`:root .card.dialog:not(.carte-fond)`, `--bg-raised`) : le dégradé, la
  bordure et l'ombre du thème restent. Une surface de plus posée sur un voile
  prend un sol plein qu'aucun thème ne repeint — une feuille n'a pas `.card`,
  elle pose `--bg` ; la carte à collectionner non plus, ses faces posent
  `--bg-raised`, et sa croix et « Retourner la carte », sous elle, aussi :
  translucides, ils laissaient lire la page ; `feuilles.test.ts` lit chaque
  thème.
- **Une feuille ouverte retire le décor du thème** (`.carte-voile`,
  `.dialog-backdrop`, `.coffre-scene` : `content: none !important` sur ses
  couches fixes, `html::before`, `body::before`, `body::after`,
  `#root::before`, `#root::after`). Plein écran à la densité d'un téléphone,
  ces couches prennent la mémoire des tuiles : sous Le Sommet, au téléphone
  Android, la feuille des amis ouverte par-dessus ne se dessinait pas, ou à
  moitié, et le décor restait à sa place (« le thème qui passe
  par-dessus », le 19 octobre 2026). Assombri aux trois quarts et couvert, il
  ne s'y voyait guère. Une couche fixe de plus dans un thème rejoint cette
  règle (`feuilles.test.ts` les lit toutes). Le Chromium des rendus ne le
  montre pas tel quel — il a toute la mémoire qu'il veut : lancé en
  `channel: 'chromium'`, carte graphique émulée (`--use-angle=swiftshader
  --enable-unsafe-swiftshader --enable-gpu-rasterization`) et sa mémoire
  bornée à celle d'un téléphone (`--force-gpu-mem-available-mb=64`, en
  412 × 915 à la densité 2,625), il ne dessinait plus la feuille une seconde
  après son ouverture, et la dessine depuis.
- **Dans une liste, rien ne garde un calque de la carte graphique.** Un
  calque que le téléphone n'a plus la mémoire de dessiner laisse un trou à sa
  taille — ou de la friture : au classement du quiz du jour, sous Le Ciel,
  la ligne d'un joueur manquait, le médaillon de son légendaire seul à sa
  place (le retour du propriétaire du 9 novembre 2026, un téléphone Android).
  Trois choses en faisaient vingt-cinq pour huit joueurs, sur un décor qui
  prend déjà quatre plein-écrans. **Une animation qui garde sa fin garde son
  calque** : l'entrée d'une ligne (`slide-in … both`) le tenait pour toujours
  — `backwards` quand la dernière image est l'élément au repos, et jamais
  `both` ni `forwards` sur ce qui se répète. **Une transformation en 3D en
  fait un même à plat** : la perspective qui fait pencher un légendaire sous
  le doigt (`.lg-carte`) ne se pose plus que là où il se prend en main
  (`.lg-touche-libre`). **Et ce qui passe devant un calque en devient un** :
  la gemme de l'Éclat, les bulles des Abysses, devant le médaillon. Les puces
  de la salle d'attente gardent encore le leur (`.player-chip`, `pop … both`)
  — et son `opacity: 1`, qui écrase l'estompe d'une puce hors ligne
  (`.player-chip.offline` ne s'est jamais vue) : les corriger change ce que
  la salle voit, à décider avec le propriétaire. `calques-des-listes.test.ts`
  garde les deux règles ; ce qu'elles font à l'écran se compte et se
  photographie par
  `retours/2026-11-09/reproductions/classement-sans-sa-ligne.ts` — les
  calques de la page et leurs raisons (`LayerTree`, par CDP), puis le
  classement à plusieurs budgets de mémoire : d'une à cinq lignes perdues dès
  56 Mo avant, selon l'essai, les huit dessinées jusqu'à 40 depuis. Sous
  52 Mo, c'est un bout de la page qui manque — son titre, son bouton du bas :
  elle pèse encore 48 Mo à la densité 2,625 sous Le Ciel, dont 37 pour le
  décor — et 10 en tout sous le Velours.
- **Une couche du décor qui bouge se taille à ce qu'elle montre, et le
  voile se peint sur le tableau.** Une couche fixe animée (`opacity`,
  `transform`) garde un calque de la carte graphique à sa taille, et tout ce
  qui passe au-dessus d'elle en devient un : au classement du quiz du jour, à
  la densité 2,625, Le Sommet en tenait 82 Mo — la montagne, ses quatre
  lueurs dans une couche à la taille de la montagne, le voile à part, la
  neige débordant de 280 px — et les Très Riches Heures 42, un plein écran
  pour huit points d'or (le 10 novembre 2026, relevé par
  `retours/2026-11-09/reproductions/classement-sans-sa-ligne.ts`,
  `THEME=sommet MEMS=512`). Depuis, 56 et 33
  (`decors-peints.test.ts`). Ce qui a servi : le voile dans le `background`
  du tableau, au-dessus de l'image, l'alpha dans ses couleurs ; une couche
  animée à son cadre — ses dessins gardent leurs places mesurées par
  `background-size` et `-position`, ou `mask-size` et `-position` — ; deux
  petites couches plutôt qu'une grande quand ce qu'elles montrent est épars
  (les camps de l'arête et le camp de base, les deux bords des Heures : même
  animation, elles battent ensemble). **Une couche que le voile couvrait le
  porte elle-même** : le voile par-dessus sa couleur, le tout découpé à sa
  forme (`mask`), donne au pixel ce que le voile posé au-dessus donnait —
  l'alpha de la forme, la couleur voilée. Pour une image, la poser plusieurs
  fois sous le voile : découpé par elle, un bord à demi transparent comptait
  deux fois sa transparence, et le liseré des drapeaux s'amincissait. Un
  `mask` ne coûte pas de calque de plus au relevé. Le plancher : 31 Mo, le
  document, un décor fixe et le contenu, trois plein-écrans — une couche
  fixe garde son calque même quand rien ne bouge. Ce qui reste au Sommet,
  c'est la neige, 21 Mo : un motif qui glisse d'un pas couvre l'écran plus
  ce pas (240 px, en haut et à droite), et rien ne la réduit sans changer ce
  qu'on voit — un motif plus petit, une neige moins haute : au propriétaire
  d'en décider. Un avant/après se compare animations figées
  (`reducedMotion: 'reduce'` au contexte de Playwright) : il ne reste que
  quelques niveaux d'écart, le tableau recalé d'une fraction de pixel.
- **Une classe assemblée couvre tout son préfixe** : la garde des classes
  mortes (S7, `design.test.ts`) tient pour vivante toute classe qui commence
  par un préfixe construit dans le code (`gerbe-${…}`) — `.gerbe-a-gagner`
  n'est plus posée par rien et passe. Une classe qu'on retire se cherche à
  la main.
- **Le Cabinet de curiosités préfixe ses classes en `cab-`** : deux fonds de
  carte s'appellent déjà `.fond-cabinet` et `.fond-musee`, et un nom court
  (`.cabinet`, `.musee`) serait un modificateur de plus à chercher dans la
  feuille (règle `profil.md`). Sa section de `styles.css` (« Le Cabinet de
  curiosités ») ne vise que des `cab-` — la carte peinte et les pièces
  partagées qu'elle pose, sous `.cab-page` — et n'écrit aucun texte sous
  dix-sept pixels : `cabinet-ecran.test.ts` relit chaque sélecteur et chaque
  taille (règle `cabinet.md`).
- **Le geste principal d'un écran plus long que le téléphone reste sous le
  pouce** (`SousLePouce`, `components/Pieces.tsx`, `.sous-le-pouce` — la revue
  de tous les écrans du 10 novembre 2026, en 360 × 640 : « Question
  suivante » passait sous le pli après chaque réponse d'une révision, d'une
  épreuve ou d'un duel, 122 à 139 px de page en trop ; « Jouer le duel »
  était au pli sous « Défier Tom », « Ouvrir le salon » à 365 px sous
  l'écran, « Un autre duel » à 656 sous ce qu'un duel venait de rapporter).
  Une anecdote, une liste de gains, une liste d'amis ne se bornent pas :
  c'est le geste qui reste en vue. À sa place tant que la page tient — ni
  marge, ni fond, rien n'y change —, collé au bas de l'écran sinon
  (`position: sticky`), où il prend son voile, le fond de la page fondu vers
  le haut (`.colle`, que la pièce pose quand le navigateur le dit collé) ;
  jamais à sa place : sur un thème peint, une bande unie y couperait le
  décor, comme sous la carte de la loge. Ce qui le tient : **un seul geste
  par cadre**, le principal — deux boutons collés prendraient le quart d'un
  petit écran — ; **enfant direct de la colonne de la page** — collé dans un
  cadre plus petit, il ne peut pas en sortir : le geste d'un duel fini a
  quitté la colonne des gestes du bas pour ça (`.duels-geste-principal`) — ;
  et **aucune coquille de page ne coupe ni ne fait défiler ce qu'elle
  contient** (`.player-shell`, `.quiz-player` : un `overflow` sur l'une
  d'elles, et chaque geste se collerait à elle, pas à l'écran).
  `sous-le-pouce.test.ts` garde la pièce, sa feuille et chaque écran qui le
  tient ; ce qui se voit — le bouton entier dans l'écran — se mesure au
  navigateur. Un écran de plus dont le geste principal peut passer sous le
  pli le prend, et entre dans l'épreuve.
