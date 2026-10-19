---
paths:
  - "client/src/**/*.css"
  - "shared/typographie.ts"
  - "server/test/{design,typographie,feuilles}.test.ts"
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
  l'`outline-offset`. Aucun texte ne descend sous `--t-label` (0,6875 rem,
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
- **Une classe assemblée couvre tout son préfixe** : la garde des classes
  mortes (S7, `design.test.ts`) tient pour vivante toute classe qui commence
  par un préfixe construit dans le code (`gerbe-${…}`) — `.gerbe-a-gagner`
  n'est plus posée par rien et passe. Une classe qu'on retire se cherche à
  la main.
