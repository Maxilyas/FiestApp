# La tablée du Cabinet de curiosités — 25 octobre 2026

Six joueurs au téléphone, chacun dans son Chromium, sur un serveur jetable où le
Cabinet est ouvert (`npm run tablee -- --sans-animateur`, skill `tablee`, « Le
Cabinet de curiosités ») : pas d'animatrice ni d'écran commun, le Cabinet se joue
seul. Ils ont joué de 22 h 08 à 22 h 24, sur le client construit au lancement de
la régie, à 22 h 07 — **avant les lots F1 (b56586c, 22 h 36) et D6 (87ed79a,
3034028)**. Leurs retours ont ensuite été vérifiés un à un, au pilote et dans un
Chromium à part, en six familles (navigation, règles, écran, jeux au doigt,
accessibilité, difficulté : 54 défauts), et quatre experts ont lu le code
(triche, sobriété, équilibre, tenue : 37 constats), chacun contre-expertisé. Cette
synthèse a été relue au commit 3034028 : ce qui a été corrigé depuis est marqué.

Seul ce qui a résisté entre dans les axes. Les lignes citées sont celles du
commit 3034028 quand je les ai relues ; les autres sont celles des vérifications
et peuvent avoir glissé de quelques lignes (la section du Cabinet de
`styles.css`, d'une quinzaine).

| Qui | Appareil | Ce qu'il cherchait | Comprendre | Lisibilité | Revenir demain | Progresser |
|---|---|---|---|---|---|---|
| Jeanne, 71 ans | 360 × 640, texte à 130 %, profil créé sur place | « le musée » dont parle son petit-fils | 3 | 3 | 4 | 3 |
| Théo, 27 ans, complétionniste | 412 × 915 | tout compter, tout posséder | 5 | 4 | 4 | 4 |
| Camille, 45 ans, deutéranope | 412 × 915 | rien qui repose sur la couleur | 4 | 4 | 4 | 3 |
| Hugo, 30 ans, aveugle | TalkBack (l'arbre de Chrome) | jouer à l'oreille | 4 | 3,5 | 4 | 4 |
| Lucas, 16 ans | iPhone 390 × 844 | la faille | 4 | 4 | 3 | 3 |
| Ophélie, 34 ans | 412 × 915, dans le métro, profil créé sur place | trois parties de deux minutes | 4 | 4 | 4 | 3 |

## En bref

- **Le Cabinet plaît.** Cinq sur six reviendraient demain (4/5), tous ont compris
  le principe en quelques touches, et personne n'a eu à deviner une couleur. Le
  serveur a tenu tout ce que Lucas lui a fait (deux onglets, réseau coupé,
  double toucher) et ce que l'expert de la triche lui a forgé.
- **Le pire défaut est déjà corrigé** : « Revenir au musée » ouvrait une salle au
  hasard (P1, cinq joueurs sur six), arrêté depuis à la capture du document.
- **Ce qui pèse le plus aujourd'hui** : une partie rechargée qu'on croit perdue ;
  le petit téléphone à texte agrandi, où la tête d'une partie se chevauche et où
  la question et ce qu'on manipule (la carte, la grille, le tableau) ne tiennent
  jamais ensemble ; les fenêtres et les feuilles qui laissent filer le focus.
- **Avant l'ouverture** : le serveur se fige pendant la préparation des tas, et
  l'accueil lit toutes les parties d'un profil.
- **Six sur six trouvent des jeux trop faciles pour qui sait.** C'est d'abord le
  savoir des agents ; mais le calibrage, qui a servi à régler les barèmes, ne
  fait pas progresser le joueur fort aux Indices et au Détail, et deux cartes-bonus
  et les leurres du Détail font gagner sans rien savoir. Les choix de barème
  reviennent au propriétaire, une fois le calibrage corrigé.

## Les axes en un coup d'œil

| # | L'axe | Gravité | Statut | Lot |
|---|---|---|---|---|
| 1 | « Revenir au musée » ouvrait une salle sans rapport | P1 | bug confirmé, **corrigé** (3034028) | — |
| 2 | Une partie rechargée se croit perdue | P2 | bug confirmé | `page-du-cabinet` |
| 3 | La tête d'une partie et ses boutons se chevauchent, texte agrandi | P2 | bugs confirmés, en partie corrigé (87ed79a) | `page-du-cabinet` |
| 4 | La question et ce qu'on manipule ne tiennent pas ensemble au petit téléphone | P2 | un bug, des frictions | `page-du-cabinet` |
| 5 | Les fenêtres et les feuilles laissent filer le focus | P2 | bugs confirmés | `fenetres` |
| 6 | Le serveur se fige et lit trop | P2 | confirmé, latent en production | `serveur-sobre` |
| 7 | Les règles se taisent au moment où elles comptent | P2 | un bug, des frictions | `regles-du-serveur`, `page-du-cabinet` |
| 8 | « Retenter » promis n'existe pas, et sa demande forgée fait fuir l'œuvre visée | P2 | bug confirmé | `regles-du-serveur`, `page-du-cabinet` |
| 9 | Gagner sans savoir : les leurres du Détail, Éclairer à l'Épingle, Miser | P2 | confirmés ; barème à arbitrer | `leurres-du-detail`, `vues-depliees`, `calibrage` |
| 10 | Presque tout à 9 sur 9 pour qui sait | P2 | un bug du calibrage ; tensions | `calibrage` |
| 11 | Quitter, la pause et Protéger | P2 | confirmé ; tensions | `page-du-cabinet`, `regles-du-serveur` |
| 12 | Les jeux à l'œil et au doigt | P2 | frictions ; le reste vient du banc | `page-du-cabinet`, `banc-de-la-tablee` |
| 13 | Le chemin vers le musée, et ce qu'il dit | P2 corrigé, P3 | corrigé (b56586c) ; bugs P3 | `page-du-cabinet`, `accueil-du-profil` |
| 14 | Ce que l'oreille et l'œil daltonien perdent encore | P3 | bugs et frictions | `page-du-cabinet` |
| 15 | La tenue du code | P3 | dette de construction | `regle-du-cabinet`, d'autres |

Les captures sont dans `captures/` ; tous les constats, leur verdict, leur axe et
leur lot dans `constats.json` (93 : les 54 défauts vérifiés de la tablée, deux
vérifiés à la synthèse, les 37 des experts).

---

## 1. « Revenir au musée » ouvrait une salle sans rapport — P1, corrigé depuis

**Ce qui se passe.** Au bas du bilan, « Revenir au musée » agit au lever du doigt
(`toucher`) : le musée paraît sur-le-champ, remis en haut, et le `click` que le
navigateur fait suivre tombe sur ce qui est venu sous le doigt — la tuile « Le
prochain gardien », une porte de salle, la visite du jour. Ces liens ne passent
pas par `toucher` et ne reconnaissent pas l'écho. Avec un bilan court, le doigt
tombe entre deux tuiles : d'où les « parfois, ça marche ».

**Qui l'a vécu.** Théo (`#salle-devin` six fois de suite, `#salle-metamorphe`
après la Frise), Hugo (`#salle-devin` trois fois, dont une pour une œuvre du
Rempart), Lucas (`#salle-erudit`, `#salle-devin`, `#visite`), Ophélie (deux fois),
Camille. Le journal le dit : « ouvrir /cabinet » dans la seconde qui suit.

**Ce que ça coûte.** Le fil perdu à chaque fin de partie : « j'ai peur de croire
que ma victoire n'a pas été comptée » (Théo).

**Statut.** Bug confirmé : reproduit au pilote (`verif-nav`, la tuile du prochain
gardien à y ≈ 540 sous « Revenir au musée ») et isolé dans Chromium au doigt
(`export/evaluations/tablee-cabinet/reproductions/echo-du-doigt.mjs`). **Corrigé
après la tablée** par le lot D6 (3034028) : `arreterLEcho` (`client/src/toucher.ts`),
posé à la capture du document par `client/src/views/CabinetApp.tsx`, éprouvé par
`server/test/toucher.test.ts` ; `server/scripts/rendu-cabinet.ts` guette l'écho.
Reste à le rejouer au pilote à la prochaine tablée (la séquence de
`export/evaluations/tablee-cabinet/navigation.md` § 1 doit finir sur `/cabinet`).
La garde ne vit que dans la page du Cabinet : une autre page qui change d'écran
au lever du doigt garderait la même classe de bug (règle `client.md`) — non
vérifié hors du Cabinet.

## 2. Une partie rechargée se croit perdue — P2, bug confirmé

**Ce qui se passe.** Rechargée en pleine manche depuis la visite, les jeux libres
ou une œuvre, la page efface la marque de la partie
(`effacerLaMarqueAuChargement`, `CabinetApp.tsx:295`) sans rouvrir la partie que
la page relue porte (`page.enCours`) : on retombe sur l'écran du dessous. La
visite y dit « 1 sur 3 faite », une case « Faite · Commencée » sans bouton — le
serveur la dit faite dès le départ (`caseCommencee`, `server/src/core/cabinet/vue.ts`,
`shared/cabinet/musee.ts`), et `Visite.tsx:39` l'écrit « Commencée » —, les deux
autres « Jouer » éteints, et « Ta partie à la Frise t'attend : reprends-la ou
quitte-la d'abord » en texte nu. Seul l'accueil du musée a le bouton « Reprends-la
où tu l'as laissée » (`Musee.tsx:176-184`). Le chrono court au serveur pendant
le détour (rechargée à 60 s, la Frise reprise du musée n'avait plus que 14 s).

**Qui l'a vécu.** Lucas (la Réplique, 4 s restantes à la reprise), Ophélie (le
Pari : « 3 sur 3 faites », elle a cru sa partie perdue ; 25 s au lieu de 45).
Capture `05-visite-apres-rechargement.png`.

**Ce que ça coûte.** Un joueur qui ne remonte pas au musée abandonne sa partie
sans le savoir. La page produit promet « Recharger reprend la partie au même
instant de son chrono » (`docs/produit/le-cabinet.md:51`).

**La piste.** (a) `CabinetApp.tsx` lit au montage
`partieDansLEntree(window.history.state)` ; à la première page reçue, si elle
portait la marque et que `p.enCours` existe, il rouvre la partie sur la même
entrée — sinon il efface la marque comme aujourd'hui. (b) La ligne « Ta partie …
t'attend » du musée devient un composant partagé (`PartieQuiAttend`), rendu à la
place de la raison en texte dans `Visite.tsx` (la visite et `JouerLibrement`),
`Oeuvre.tsx` et `Annonce.tsx`. (c) Une case faite sans issue est la partie en
cours : surtitre « En cours », bouton « Reprendre » ; les comptes ne retiennent
que les cases qui ont une issue (`Visite.tsx`, `Musee.tsx:107`).

Le chrono, lui, ne s'arrête pas : c'est voulu (invariant 6 ; la seule pause est
celle, bornée, de « Quitter ? »), et un rechargement qui suspendrait la manche
rouvrirait la porte que la pause bornée ferme. La perte réelle venait du détour.

**L'épreuve.** `server/test/cabinet-ecran.test.ts` : la visite d'une page dont
`enCours` est la Frise de la case 0, la case faite sans issue, dit « 0 sur 3
faite », « En cours » et un seul « Reprendre » ; les jeux libres de même ; la
page rechargée sur l'entrée d'une partie qui attend la rouvre, sans partie la
marque s'efface (l'épreuve des lignes 673-682 s'étend). Au pilote : « Commencer »
depuis `#visite`, recharger, et la manche revient à l'écran.

## 3. La tête d'une partie et ses boutons se chevauchent, texte agrandi — P2, bugs confirmés

**Ce qui se passe.**

- **« Quitter » se pose sur « 0 / 9 ★ ».** `.cab-tete-ligne` est un flex sans
  retour à la ligne ; `.cab-total { flex: 1; min-width: 0; white-space: nowrap }`
  laisse sa boîte se réduire à 26 px pendant que son texte de 72 px déborde sous
  « Quitter » (`flex: none`). Mesuré (`reproductions/ecran-130.mjs`) : 44 px de
  chevauchement en 360 × 640 avec le zoom de la tablée (78 la niche posée), 34 px
  en 277 × 492 — le vrai zoom de page de Chrome Android à 130 % —, 60 la niche
  posée. Le lot D6 (87ed79a) a réglé la niche à 100 % en serrant la rangée ;
  reste le texte agrandi. Capture `01-epingle-130-quitter-sur-le-compteur-sans-carte.png`.
- **« Répondre » des Indices coupé en « épondr ».** `.cab-gestes-du-nom
  { grid-template-columns: auto minmax(0, 1fr) }` (`styles.css:10790`) donne d'abord
  toute la ligne à « Un indice de plus » ; « Répondre », un seul mot, déborde de
  13 px de chaque côté, et sur l'accent du bouton actif on lit « épondr ». Dès
  qu'une mise en page fait moins de 298 px CSS : en 360 de large dès 121 %, en 412
  dès 138 %. Capture `03-indices-130-epondr.png`.

**Qui l'a vécu.** Jeanne, à chaque manche (020, 045, 061, 067, 081). Personne n'a
joué aux Indices à 130 % : trouvé en rejouant son réglage.

**Ce que ça coûte.** « Quand on a peur de casser quelque chose, un bouton qui
chevauche autre chose fait peur, d'autant que quitter compte la partie »
(Jeanne) ; un bouton qu'on ne lit pas.

**La piste.** « Quitter » devient une icône suivie du mot (`<span
class="cab-quitter-mot">`, `aria-label="Quitter"` gardé pour la tablée,
`Partie.tsx:327`) ; la tête une requête de conteneur (`.cab-tete-partie
{ container: tete / inline-size }`, `@container tete (max-width: 290px)` cache le
mot et serre les cercles, 350 px sous `body.avec-niche`) — elle suit aussi le
`zoom` de la tablée, ce qu'une media query ne ferait pas — ; et un filet pour le
cas extrême (`flex-wrap`, `.cab-total { flex: 1 0 auto; min-width: max-content }`) :
mieux vaut une ligne de plus que deux textes l'un sur l'autre. Aux Indices,
`grid-template-columns: minmax(0, auto) minmax(max-content, 1fr)` : glissé dans la
page, rien ne bouge à 100 %, et à 130 % c'est « Un indice de plus » qui passe sur
deux lignes.

**L'épreuve.** `rendu-cabinet.ts` exige le bord droit du texte du total au plus au
bord gauche de « Quitter », en 360 × 640, 277 × 492 et zoom 130, avec et sans
niche ; `cabinet-ecran-neufs.test.ts` exige `max-content` pour la colonne de
« Répondre » (rouge aujourd'hui) ; `ZOOMS=130 node
export/evaluations/tablee-cabinet/reproductions/jeux-au-doigt.mjs indices`
n'écrit plus « LE TEXTE DÉBORDE DU BOUTON ».

## 4. La question et ce qu'on manipule ne tiennent pas ensemble au petit téléphone — P2

La cause commune : la tête collée (100 px en 277 × 492, le chrono sur sa ligne) et
le pied collé (82 à 115 px) prennent 40 % de la hauteur, et la validation en
360 × 640 s'est faite à 100 %.

- **Le Mot mystère, un bug.** Au premier essai, la ligne à taper reste sous le
  clavier collé (0 % visible à 130 %) : l'effet de `MotMystere.tsx:211` sort par
  `if (m.essais.length === 0) return`, et `scrollIntoView({ block: 'center' })`
  centre la ligne dans la fenêtre, pas entre la tête et le clavier — dès le
  deuxième essai, c'est la question qui passe sous la tête. Jeanne a tapé
  C-O-U-L-E-U-R sans rien voir s'écrire (journal, 22:15:45-48). Capture
  `02-mot-mystere-130-ligne-sous-le-clavier.png`.
- **L'Épingle.** La question et la carte de France ne tiennent jamais ensemble à
  130 % (381 px demandés pour une bande de 277) : la carte amenée au-dessus du
  pied, la question est sortie. Jeanne devait faire défiler sous 45 s (capture 01).
- **Le Détail, même à 100 %.** Le tableau et ses quatre titres ne se voient pas
  ensemble en 360 × 640 (688 px pour 540) : des allers-retours pendant 55 s
  (Jeanne, 040, 078, 079). Capture `04-detail-130-titres-hors-ecran.png`.
- **La révélation** (P3, à arbitrer). Le pied collé « Manche suivante » couvre la
  fin à son premier écran — « Le savais-tu ? », « Ta réponse » au Pari (Lucas,
  011 et 032 ; Jeanne, 024 et 025). Rien n'est inaccessible, mais la page semble
  finie. Décoller ce pied (aucun chrono ne court entre deux manches) mettrait le
  bouton sous le bord de l'écran à 130 % ; l'autre voie est de faire remonter
  au-dessus de lui ce qui compte.
- **Les Indices, clavier levé** (P3, à arbitrer). Le champ et « Répondre »
  restent en vue — Théo a raison —, mais aucun indice ne se lit pendant qu'on
  tape à 130 % (une fenêtre de 59 px). La règle `cabinet.md` accepte cette
  limite ; cacher la ligne des manches sous le focus ne suffit qu'à 100 %.

**Ce que ça coûte.** Jeanne tapait à l'aveugle, oubliait « Lip » ou « Trenet » en
allant chercher la carte, et a perdu l'œuvre de l'Épingle de la visite — en
partie aussi par le pilote (axe 12). « Un bouton qu'on ne voit pas n'existe pas. »

**La piste.** Une seule variable, `--cab-tete`, posée par un `ResizeObserver` de
`Partie.tsx` sur `.cab-tete-partie`, pour coller sous la tête ce qui doit rester :
la question de l'Épingle (`.cab-manche:has(.cab-carte-jouable) .cab-question
{ position: sticky; top: var(--cab-tete) }`, la carte bornée à ce qui reste), le
cadre du Détail (`.cab-detail-cadre { position: sticky }`, sa hauteur fixe ne
change pas : aucun titre ne saute sous le doigt), et « Ta réponse vaut ★★★ » sur
la ligne de la question du Détail. Le pied de l'Épingle se réduit à « Planter
ici » : « où est l'épingle » prend la place de la consigne au-dessus de la carte,
qui garde déjà ses deux lignes (`Epingle.tsx:53-63`, `100-108`). Au Mot, l'effet
tourne dès le premier essai et défile juste assez, par une fonction pure
(`defilementPourLaLigne(ligne, bande)`, la bande du bas de la tête au haut du
pied), une image plus tard ; la légende passe sous la grille. Les trois se
mesurent ensemble, avec la tête compacte de l'axe 3.

**L'épreuve.** `rendu-cabinet.ts`, en 277 × 492 et 360 × 640 zoom 130 : la ligne du
Mot entière entre la tête et le clavier à l'ouverture et après chaque essai ; un
défilement où la question et la carte entière sont dans la bande ; chaque titre
du Détail amené au bas de l'écran avec le tableau entier sous la tête.
`defilementPourLaLigne` éprouvée sur les boîtes mesurées (ligne {350, 393}, bande
{100, 328} → 69 ; une ligne déjà dans la bande → 0) et la source relue sans
`essais.length === 0` ; `cabinet-ecran-neufs.test.ts` relit la règle collée et
l'absence de `.cab-ou-est` dans le pied rendu.

## 5. Les fenêtres et les feuilles laissent filer le focus — P2, bugs confirmés

**Ce qui se passe.**

- **« Quitter cette partie ? », et toute confirmation** (`client/src/components/Dialog.tsx`).
  À la révélation, « Quitter » ouvre la fenêtre au lever du doigt ; le
  `mousedown` qui suit tombe sur le voile, qui ne l'arrête pas, et le focus part
  sur `body`. Rien n'est inerte hors du voile, et le piège ne fait boucler Tab que
  depuis le premier ou le dernier bouton : Tab, Tab, Entrée joue « Manche
  suivante » derrière la fenêtre, ou quitte la partie.
- **Les feuilles** (`Feuille`, `client/src/components/Pieces.tsx:67-97` : « Comment
  ça marche ? », « Ta carte-bonus », « Mes réponses », le réveil d'un gardien) se
  disent `role="dialog" aria-modal="true"` mais n'appellent pas `useModale` : le
  focus reste derrière, 17 éléments restent exposés derrière les règles, Échap ne
  ferme rien, et Tab, Entrée depuis « Choisir une carte-bonus » lance « Commencer »
  derrière la feuille (`carte-bonus-tab-entree.mjs` : « partie commencée : true »).

**Qui l'a vécu.** Hugo (le Filet libre : la manche 3 a démarré derrière la
fenêtre, journal 22:19:56 → 22:20:21) ; Camille, qui n'a pas pu toucher le second
« Quitter », du même nom que celui de l'en-tête.

**Ce que ça coûte.** Une manche jouée ou une partie lancée sans le vouloir ; et ce
n'est pas propre au Cabinet : 105 appels à `confirmDialog`, `promptDialog` et
`choixDialog`, une vingtaine d'écrans à `Feuille`.

**La piste.** `DialogBox` rend inerte ce qui est hors du voile (`horsDeLaBoite`,
`client/src/modale.ts`, retiré au nettoyage avant de rendre le focus), arrête le
`mousedown` sur le voile même, et ramène dans la boîte un Tab parti dehors.
`Feuille` appelle `useModale(boite, onFermer)` avec `tabIndex={-1}`, comme
`MonCompagnon.tsx` et `Decorer.tsx` : le focus dans la feuille, le reste inerte,
Échap, le focus rendu. Le bouton de la confirmation se nomme « Quitter la partie »
(`Partie.tsx`, `confirmLabel`), et les consignes de la tablée suivent.

**L'épreuve.** Les épreuves n° 1 et n° 2 de
`export/evaluations/tablee-cabinet/accessibilite/accessibilite.test.ts`, rouges,
posées dans `server/test/petit-ecran.test.ts` et `server/test/feuilles.test.ts` ;
sur le client construit, `dialogue.mjs` (« doigt » et « hugo » : le focus sur
Continuer, des éléments inertes, Tab, Tab, Entrée → « fenêtre fermée · partie en
cours »), `feuilles.mjs` (« exposés derrière : 0 », Échap ferme et rend le focus à
« Choisir une carte-bonus ») et `carte-bonus-tab-entree.mjs` (« partie commencée :
false »). `server/test/toucher.test.ts:78` lit la balise du voile mot pour mot : à
reprendre avec elle.

## 6. Le serveur se fige et lit trop — P2, à corriger avant l'ouverture

Latent : le Cabinet est fermé en production (`CABINET_EN_PRODUCTION`) ; la
préproduction le sert.

- **La préparation des tas fige tout le serveur** (`cabinet-sobriete-1`, P2).
  `preparerLesTas` (`server/src/core/cabinet/tirages/tas.ts`) rend la main entre
  deux catégories, mais passe chacune d'un seul tenant — 1 776 à 3 263 questions —
  aux trois cribles, l'intitulé redécoupé à chaque réponse : 84 ms de gel rejoué
  ici, de l'ordre d'une seconde au dixième de cœur, douze fois à chaque réveil et
  à chaque liste de jouables neuve (chaque matin, avec la réserve du jour) ; le
  premier départ d'une liste neuve attend 1 126 ms. Les soirées des autres
  espaces gèlent avec. Retenu par la contre-expertise : garder le verdict des trois
  cribles par question (une `WeakMap` : une liste neuve est un filtre des mêmes
  objets, 0,3 à 1,1 ms par catégorie), des tranches de `QUESTIONS_PAR_TRANCHE`
  par `rendreLaMain`, l'intitulé lu une fois par une fonction exportée de
  `server/src/core/cabinet/contenu.ts`, et un tour à lui pour `contenuDuCabinet()`.
- **L'accueil lit toutes les parties d'un profil** (`cabinet-sobriete-2`, P2).
  `defiDAccueil`, `tentativeDuDefi` et `tentativeDuDuel`
  (`server/src/core/campagne.ts`) passent par l'index du profil et lisent toutes
  ses parties, tous modes — 2 993 pas pour un fidèle —, que le Cabinet augmente de
  dix par jour. La piste de l'expert échangeait un parcours contre un autre ;
  retenu : `+semaine` et `ORDER BY +commencee_le` pour le défi (177 pas), la forme
  « par le code de son duel » pour le duel (20 à 82 pas, règle `duels.md`), un
  `EXISTS` corrélé au lieu de `profile_id IN (SELECT …)`. Au bout d'un an de
  Cabinet, de l'ordre de 7 à 22 % du quota de lectures de Turso pour 30 à 100
  réguliers.
- **P3** : chaque bilan redemande les missions, qui relisent trois semaines de
  parties pour n'en compter aucune du Cabinet (un index `(profile_id, mode,
  commencee_le)` : 3 753 → 126 pas) ; la fin d'une partie, un compagnon dans la
  niche, fait cinq allers-retours en série (`rattraperLeJournal(this.derniereReponse)`
  dans `CampagneStore.compagnonsDe`, l'historique des soirées passé plutôt que
  relu) ; l'Éclair d'un fidèle parcourt quinze fois une catégorie épuisée (ses
  catégories ordonnées par ce qui leur reste de jamais vu). Plus tard : une table
  bornée de parties finies (`cabinet-sobriete-4`), le poids du départ figé, à
  mesurer (`cabinet-sobriete-7`).

**L'épreuve.** Les reproductions de `export/evaluations/cabinet-sobriete/`, rouges
pour la raison annoncée, en épreuves : `tas-gel.test.ts` dans
`cabinet-charge.test.ts`, comptant les appels aux cribles par tour de boucle
(pas les questions rendues) ; `defi-accueil.test.ts` et `missions.test.ts` par
l'extension de `campagne-index.test.ts` à toute recherche « un profil, un mode,
`ORDER BY commencee_le` », avec ou sans `finie_le`, et de `duels-index.test.ts`
à `tentativeDuDuel` ; `fin-compagnon.test.ts` et `tirage-parcours.test.ts`
comptés dans `cabinet-charge.test.ts`.

## 7. Les règles se taisent au moment où elles comptent — P2

**Ce qui se passe.**

- **Un bug** : une partie libre qui paie, finie à zéro étoile, dit « Les cinq
  parties libres du jour ont payé : celle-ci se joue pour le plaisir », et la
  page d'après « Tes 4 prochaines parties rapportent de la poussière d'or ».
  `bilanDit` (`server/src/core/cabinet/vue.ts:179`) décide sur `b.poussiere > 0`
  au lieu de `d.payee`, et écrit « cinq » en dur. Trois sources le disent : Hugo à
  sa deuxième libre, `cabinet-code-2`, `cabinet-equilibre-6` ; 52 libres sur 80
  finies sans étoile dans la base de la tablée. Au passage, une libre payée se
  dit deux fois au bilan (« 14 poussières d'or pour ta partie libre » puis
  « +14 », Lucas et Théo).
- **La mise** : plafonnée à 9 sur la partie et ôtant le cadre doré, sans que
  l'écran le dise ; « sinon, rien » (`shared/cabinet/pouvoirs.ts:47`) ne dit pas
  que la manche imparfaite vaut alors zéro, et « +2 : mise gagnée » se lit comme
  un gain même mangé par le plafond (Théo : misé, 9/9, l'œuvre sans cadre doré).
- **Le cadre doré** : Prendre son temps ne l'ôte que s'il a servi — c'est la
  règle, et le « bug » de Théo n'en est pas un —, mais la feuille dit « sans
  qu'un pouvoir ait servi », l'annonce d'une œuvre à gagner ne parle pas du
  cadre, la carte emportée ne dit pas ce qui l'ôte, et un 9/9 non doré titre
  « Une œuvre de plus ! » sans raison. « +10 s à chaque manche » vaut en fait à
  chaque étape — au Pari et à la Réplique, 20 s par manche (`cabinet-equilibre-9`).
- **Une case de la visite se joue une fois** : perdue, elle est « Faite », et
  rien ne le dit avant « Commencer » (Camille ; l'annonce rassure même : « Rien
  ne compte avant Commencer »).
- **Le seuil disparaît en partie** : l'annonce dit « Il faut 5 étoiles sur 9 », la
  tête ne dit que « 2 / 9 ★ » alors que la vue porte `seuil` (Camille n'a su ni
  s'il fallait parier, ni que l'œuvre était perdue).
- **Dorer** : au Pari, le cadre doré en jouant demande trois paris gagnés (0,3 à
  3,5 % des parties), et l'annonce d'une case « pour dorer » tait le seuil du
  double (`cabinet-equilibre-10`).

**Ce que ça coûte.** Une phrase fausse au bilan, des dorures perdues sans le
savoir, et des choix — parier, miser, emporter une carte — faits à l'aveugle.

**La piste.** Au serveur (`vue.ts`, `pouvoirs.ts`, `vues.ts`) : `bilanDit` décide
sur `d.payee` et dit `LIBRES_QUI_PAIENT` — non payée, la phrase des libres ;
payée sans poussière, « Aucune étoile cette fois : pas de poussière d'or. Encore
N parties libres qui paient aujourd'hui » ; Miser : « parfaite, elle rapporte
des étoiles en plus, jusqu'à 9 sur la partie ; sinon, elle ne vaut rien », et la
note « +2 : mise gagnée, au-delà de 9 » quand le plafond l'a mangée ; Prendre son
temps : « il ne compte que si tu t'en sers », « à chaque question » ; une note
par manche aidée (« temps en plus », « éclairée », « changée ») et un bilan « …
sans cadre doré : Prendre son temps a servi » ; `CaseVue.seuil` et le seuil du
double, que la page ne redérive plus (`Annonce.tsx:53`, `cabinet-code-8`). À la
page : l'annonce dit le cadre doré d'une œuvre à gagner et, sous la carte
emportée, ce qui l'ôte ; l'écran de la mise « Une mise jouée ôte le cadre doré »
(et « Tu vises le cadre doré : miser le perdrait » quand la partie est encore
parfaite) ; une case de la visite « se joue une fois aujourd'hui — manquée, son
œuvre se retente au même jeu pour une chasse » ; la tête « 2 / 9 ★ · il en faut
6 » ; le bilan sans son doublon. Une ligne chacune, comme le veut la feuille.

**L'épreuve.** `cabinet-poussiere.test.ts` : une libre payée quittée d'emblée,
puis une jouée jusqu'au bout à zéro, ne disent pas « ont payé », et il reste
`LIBRES_QUI_PAIENT − 1` libres qui paient ; la sixième dit la phrase — rouge
aujourd'hui (les reproductions `cabinet-equilibre/libre-a-zero.test.ts`,
`cabinet-code/libre-sans-etoile.test.ts`, `verification/cabinet-code/libre-ratee.test.ts`).
`cabinet-pouvoirs.test.ts` : une partie misée parfaite ailleurs a la note
« au-delà de 9 », Prendre son temps servi la note « temps en plus ».
`cabinet-ecran.test.ts` : l'écran de la mise dit « 9 sur la partie » et « cadre
doré », l'annonce d'une chasse à gagner « cadre doré », le bilan d'un 9/9 aidé
« sans cadre doré », l'annonce d'une case « se joue une fois », la tête d'une
chasse à seuil 6 « il en faut 6 » et celle d'une libre rien.

## 8. « Retenter » promis n'existe pas, et sa demande forgée fait fuir l'œuvre visée — P2, bug confirmé

**Ce qui se passe.** Après une partie de la visite manquée, le bilan n'offre que
« Revenir au musée » et « Mes réponses », et la case dit « L'œuvre reste à
gagner », sans bouton. « Retenter cette œuvre au même jeu, pour une chasse » est
promis par la page produit (`docs/produit/le-cabinet.md:90`), les barèmes
(`docs/reference/baremes.md:673`) et la proposition validée
(`retours/2026-10-24/le-cabinet.md:102-103` ; la maquette avait le bouton). Le
serveur sait le faire, mais la demande vise l'œuvre par sa clé, que la page ne
reçoit pas d'une case manquée — et ne doit pas recevoir (invariant 1).

Pire, cette demande, forgée, devient un oracle (`cabinet-triche-4`) : l'ordre des
refus de `cadreDuDepart` désigne l'œuvre visée parmi trois candidates (dix au
Vestibule). Juger la carte d'abord ne ferme rien : la contre-expertise a montré
que la bonne part alors seule.

**Qui l'a vécu.** Camille (le Filet et le Pari de la visite perdus : « seules les
deux chasses permettent de retenter une œuvre »).

**La piste, une pour les deux.** Viser la case, pas l'œuvre :
`{ origine: 'chasse', case, retente: true }` ; `cadreDuDepart`
(`shared/cabinet/musee.ts`) retrouve la cible dans la visite figée du jour ; une
demande « Retenter » qui nomme une œuvre se refuse pour toutes dans les mêmes
mots ; `CaseVue.retenter` et `BilanVu.retenter` (`{ possible, refus }` : plus de
chasse, déjà gagnée ailleurs). La page montre « Retenter cette œuvre {au jeu} ·
une chasse », en sourdine avec sa raison quand le serveur la refuse ; l'annonce
de la retente dit l'enjeu de la case, jamais l'œuvre.

**L'épreuve.** `cabinet-poussiere.test.ts` : après une visite manquée, la retente
par la case part au jeu de la case et prend une chasse ; `cabinet-secret.test.ts` :
rien de la vue ne nomme l'œuvre, et la retente nommée se refuse pareil pour
toutes (`export/evaluations/cabinet-triche/retente-oracle.test.ts`,
`verification/cabinet-triche/retente-sans-carte.test.ts`) ;
`cabinet-ecran.test.ts` : le bilan d'une visite manquée montre « Retenter », en
sourdine une fois les chasses prises.

## 9. Gagner sans savoir : les leurres du Détail, Éclairer à l'Épingle, Miser — P2, barème à arbitrer

Personne ne l'a joué ainsi à la tablée : les experts l'ont mesuré, et la
contre-expertise l'a rejoué. Le dommage reste dans le musée du joueur — c'est un
jeu seul —, mais il retire au musée ce qu'il veut dire : ce que tu sais.

- **Les leurres du Détail** (`cabinet-triche-2`, P2). Trois leurres pris parmi les
  cinq voisins en années de la bonne : elle est le seul titre dont les voisins
  contiennent toujours les trois autres. 52 % de justes sans regarder l'image,
  41 % avec les seules années des quatre titres — et 78 % pour qui se souvient des
  tableaux déjà nommés, puisque seule la bonne s'écrit vue (`laMoinsVue`). Retenu :
  quatre tableaux consécutifs en années, pris parmi ceux du même statut de
  fraîcheur que la bonne (`shared/cabinet/jeux/detail.ts`,
  `server/src/core/cabinet/tirages/detail.ts`) ; le plan figé garde ses titres,
  aucune version à monter.
- **Éclairer à l'Épingle** (`cabinet-equilibre-1`, P2). Le centre de la zone est à
  40-140 km du lieu : planter au centre vaut ★★ quatre fois sur cinq, et trois
  zones (une carte de force 3) font gagner une commune 91 fois sur 100 sans rien
  savoir — 93 en plantant au milieu de la terre que la zone couvre. La piste de
  l'expert ([120, 165] km) ne tient pas : la couronne et la mer se lisent encore
  (45 à 56 %). Il faut d'abord un joueur sans savoir qui lit la terre et la
  couronne au calibrage ; et `RAYON_D_ECLAIRER_KM`, relu à chaque relecture, doit
  se figer avec le décalage.
- **Miser** (`cabinet-equilibre-2`, P2). `BONUS_DE_MISE` à 2, 3, 4 fait d'une manche
  misée parfaite exactement le seuil de sa rareté : au Détail, deviner au premier
  coup d'œil et miser à la force 3 gagne une épique une partie sur quatre — plus
  que le complétionniste sans carte —, avec neuf cartes qui misent à la force 3.
  La racine est le un sur quatre du Détail (`cabinet-equilibre-8`, une tension :
  cinq titres ?) et ses leurres : trancher après eux. Pour ne fermer que la
  loterie des épiques, `{ 1: 2, 2: 3, 3: 3 }` suffit ; la version du départ monte,
  et `baremes.md` change dans le même commit.
- **Hors du Cabinet** (`cabinet-triche-3`, P3). Les questions de la base que
  révèlent l'Éclair, le Détail et la frise d'un sujet restent « jamais vues »
  pour la campagne — duels classés compris, où l'on joue contre d'autres :
  l'invariant 8 veut que rien n'en sorte. Déplier les composés dans
  `JournalDesReponses.vuesDe` pour les vues seulement (jamais pour les premières
  réponses), le Détail par les questions de son tableau, et récrire la décision
  « la série ne déplie pas » (`docs/architecture/decisions.md:1685-1687`), née
  d'une prémisse fausse.

**L'épreuve.** `detail-par-les-voisins.ts` et `detail-jamais-vu.ts`
(`export/evaluations/cabinet-triche/`, `verification/cabinet-triche/`) retombent
vers 25 %, et `cabinet-jeux-images.test.ts` le garde ;
`epingle-zone.test.ts` et `pouvoirs-equilibre.test.ts`
(`export/evaluations/cabinet-equilibre/`) mesurent le barème qu'on choisira ;
`eclair-hors-des-vues.test.ts`, et une épreuve contre le SQL d'avant dans
`journal-des-reponses.test.ts`.

## 10. Presque tout à 9 sur 9 pour qui sait — P2 (le calibrage), tensions à arbitrer

**Ce qui se passe.** Six sur six trouvent des jeux trop faciles — les Indices, le
Mot mystère, l'Éclair et la Frise surtout. Dans la base : 47 parties finies et
non quittées, 24 à 9 sur 9 ; la Frise 4 sur 4, les Indices 4 sur 4, le Mot 8 sur
9, la Réplique 3 sur 4 ; le Détail et le Pari 0 sur 5.

D'abord, le banc : les agents savent l'année du diapason de John Shore et le
10,49 s de Griffith-Joyner (voir « Les limites »). Mais la vérification a trouvé
un **bug du calibrage**, qui a servi à régler les barèmes du 25 octobre :

- aux Indices et au Détail, le rang où l'on reconnaît ne dépend pas de la force
  du joueur (`server/scripts/calibrage-cabinet.ts:298`, `:890` ; `:287`, `:806`) :
  le modèle plafonne aux Indices à 6,45 étoiles sur 9 pour toute force, quand la
  tablée en fait 8,75 — et ce modèle a servi à élargir `INDICES_DES_ETOILES` de
  2/3 à 3/4 ;
- au Filet, ce que le joueur sait ignore la marche de la question
  (`--essai MARCHES_DU_FILET=moyen/difficile` rend la même sortie) ;
- l'équilibre se mesure sans les quatre cartes offertes, Changer aux Indices
  décide sur ce qu'il ne saurait qu'au cinquième indice (78 % de communes contre
  37), et une question du Pari compte 9 s quand une question de série en compte
  20 (`cabinet-equilibre-5`).

**Les tensions, au propriétaire, une fois le calibrage corrigé.**

- **La marche suit l'enjeu** (P2) : le Mot, l'Éclair, le Filet et la première
  question du Pari ne tirent que du facile et du moyen — 47 % de la base,
  difficile ou expert, n'y sort jamais —, et une rare tire les mêmes marches
  qu'une commune. Proposition : une table `MARCHES_DES_ENJEUX` (l'épique et la
  chasse pour dorer y ajoutent le difficile), qui ne touche ni un barème de
  manche, ni un seuil, ni une version. Durcir pour tous fermerait l'occasionnel
  plus que cela ne tend le joueur fort.
- Les Indices à 2/4 (★★★ en un ou deux indices) ; le leurre de l'Éclair choisi par
  la campagne plutôt qu'au hasard (29 affirmations fausses sur 29 dites fausses) ;
  la Frise serrée pour l'épique (« Les rois de France » ont 109 ans d'écart
  minimal, « L'aviation » 3) ; le Pari, où garder trois fois suffit à une rare ;
  le Mot, où les cinq essais ne servent qu'à qui ne sait pas.
- Le rythme des gardiens (`cabinet-equilibre-4`, P3) : la visite remplit les neuf
  salles à la fois, et l'occasionnel attend son premier gardien au 38ᵉ jour ; une
  case par jour vers la salle du prochain gardien le ramènerait au 14ᵉ, sans rien
  coûter à « tout posséder ».
- Faux positif : raccourcir les chronos ne durcit rien pour qui sait (il ne s'en
  approche jamais), et prend le lent de court.

**Ce que ça coûte.** « 9 sur 9 sans effort ne donne pas envie de rejouer »
(Lucas, revenir demain 3/5) ; et des barèmes décidés sur un modèle faux.

**La piste.** Dans `calibrage-cabinet.ts` : `rangSelonLaForce` (un logit ordinal
sur les cumulés de `indicesAuRang`), aux lignes 806 et 890 ; le Filet selon la
marche ; une colonne « = 9 » ; la section des cartes, les quatre offertes
comprises ; Changer sans oracle ; le joueur sans savoir de l'Épingle (la terre et
la couronne) et du Détail (la mise au premier cadrage) ; la chasse vers le
prochain gardien ; un joueur « tablée » (θ ≈ +2,5). Puis récrire « Le calibrage
du Cabinet » de `docs/reference/baremes.md`.

**L'épreuve.** `cabinet-calibrage.test.ts` : aux Indices, le complétionniste
dépasse 6,45 ★/9 ; `--essai MARCHES_DU_FILET=moyen/difficile` change la ligne du
Filet. Les deux échouent aujourd'hui.

## 11. Quitter, la pause et Protéger — P2 (la pause), le reste à arbitrer

- **La pause de « Quitter ? » vend du temps** (`cabinet-triche-1`, P2). La vue
  garde la manche entière, l'échéance recule de trente secondes par manche — 25 s
  deviennent 55 à la Réplique —, et rien ne marque la réponse ni n'ôte le cadre
  doré, quand la carte qui vend du temps, elle, le ferme. Cela contredit la
  décision (« la pause ne vend pas le temps que Prendre son temps vend »,
  `decisions.md:1834`). Ophélie a aimé cette pause, dans le métro : la corriger
  sans perdre sa franchise. Retenu par la contre-expertise : borner
  `PAUSE_MAX_MS` à quelques secondes, le temps de lire la confirmation (figé au
  départ, sans version) — ou une marque à part, sous une version du départ.
  Un choix de barème : au propriétaire.
- **Le voile ment après trente secondes** (bug, P3). Passé la pause, le chrono
  repart sous la confirmation (Lucas : 96, 83, 69) mais le voile dit toujours
  « En pause » (`VoileDeLaPause`, `Partie.tsx:418`). Il reçoit `repris` — « Le
  chrono a repris · Ta manche reste cachée : réponds à « Quitter ? » » —, en
  `aria-live`. Épreuve : `reproductions/pause-voile.test.ts`, rouge, posée dans
  le test « la pause de « Quitter ? » » de `cabinet-ecran.test.ts`.
- **Protéger relève la manche quittée** (P3). Quitter juge la manche à zéro, et
  Protéger prend la première manche jugée sous trois : avec Prudence, quitter
  d'emblée vaut une étoile et quatre poussières (Lucas), quand « Quitter ? »
  promet « les étoiles déjà gagnées ». Quitter n'est jamais meilleur que répondre
  faux : garder la règle, dire vrai — `VueDeLaPartie.siTuQuittes` (`{ total,
  poussiere }`, calculé au serveur en jouant `quitter` sur l'état), et « Tu repars
  avec 1 étoile, Protéger compris, et 4 poussières d'or ; ta chasse est
  utilisée ». Épreuve : `cabinet-pouvoirs.test.ts` (une chasse sous Prudence,
  manche 0 ouverte : `{ total: 1, poussiere: 4 }`, puis le bilan de `quitter`
  pareil) et `cabinet-ecran.test.ts` (le message dit « 1 étoile »).
- **Les tensions.** Quitter d'emblée rapporte quatre poussières : c'est
  `POUSSIERE_MIN`, « une partie fait toujours avancer », et la chasse ou la case
  est brûlée. Une visite commencée puis quittée chaque jour réveille le Scarabée
  au trentième (`cabinet-triche-5`). Prudence, offerte, vaut une rare du Rempart
  (`cabinet-equilibre-7`). « Sans carte-bonus », proposé d'office, n'est jamais le
  bon choix (`cabinet-equilibre-3`, P2 rétrogradé P3 : 57 des 65 séries sans carte
  venaient des profils de vérification, les six personnages en ont pris une 47
  fois sur 54) — mais ne pas proposer Prudence d'office tant qu'elle relève une
  manche quittée. Si l'on tranche, une seule montée de version : Protéger et la
  série ne comptent qu'une manche tranchée par une réponse.

## 12. Les jeux à l'œil et au doigt — P2, frictions

- **Le Détail ne dit pas qu'il se joue à l'œil.** Le nom de l'image se tait, et
  c'est voulu (« Rien ne nomme le tableau avant le verdict », invariant 1), mais
  rien ne le dit : Hugo a joué au hasard, 0 sur 9. Un `avertissement` dans
  `JEUX.detail` (`shared/cabinet/jeux/regle.ts`) — « Un jeu qui se joue à l'œil :
  les tableaux ne sont pas décrits au lecteur d'écran — la description soufflerait
  la réponse » —, dit à l'annonce, dans les règles, et en `sr-only` sur la case de
  la visite et le jeu libre, avec « Changer de jeu » rappelé. Décrire le tableau
  reste une tension : jamais pendant la manche ; à la révélation et au cartel, une
  phrase de description (un champ de contenu neuf) — à arbitrer, comme laisser un
  profil écarter le Détail de sa visite.
- **L'Épingle sans clavier.** Sous TalkBack, un double toucher plante au centre
  de la carte, et seules les flèches la déplacent. Quatre boutons « Vers le
  nord / le sud / l'ouest / l'est » et une bascule « Grands pas / Petits pas »
  (`deplacer`, `MILIEU_DE_LA_FRANCE`), au-dessus de « Planter ici » — à mesurer avec
  l'axe 4, qui veut ce pied plus court. Épreuve : la manche rendue a les quatre
  boutons ; de `MILIEU_DE_LA_FRANCE` à Corte en moins de vingt grands pas.
- **Le Filet sans glisser.** « Un cran de plus » fait un cran : 60 touchers pour
  Camille (une manche à zéro, une partie de la visite perdue), la ramette (500)
  hors d'atteinte pour Hugo. « Un grand pas », d'un dixième de la piste au cran
  près, comme PageUp du curseur natif. Un choix de produit léger — le Filet reste
  un jeu de visée — : à dire au propriétaire. Épreuve : toute valeur de la piste
  en cinq grands pas et dix crans au plus.
- **Ce qui vient du banc** (limites). « L'Épingle aux flèches seulement », « le
  Filet ne bouge que par un cran », « Malformed value » : le pilote touche au
  centre de l'élément, vide un curseur avant d'y écrire (`fill('')`, que
  Playwright refuse), et Chromium ne donne pas le focus à un curseur touché. Au
  vrai doigt, l'épingle tombe à 0,0 km du point visé, et le curseur se glisse
  (`reproductions/jeux-au-doigt.mjs`). Les notes du Filet (2 et 3 sur 5) et
  l'Épingle perdue de Jeanne en sont faussées. Au banc : `toucher <cible> --a
  x%[,y%]`, et `ecrire` refusé en mots sur un curseur.

## 13. Le chemin vers le musée, et ce qu'il dit — P2 corrigé, P3

- **« Tes murs » n'avaient pas de porte** (P2) : Théo et Camille ont tapé `#murs` à
  la main, Jeanne et Hugo les ont trouvés au fond de l'aide — « c'est ce que je
  préfère » (Jeanne). **Corrigé pendant la tablée** par le lot F1 (b56586c) : un
  gros bouton « Tes murs » au musée, sous les gardiens.
- **« Comment ça marche ? » est un mur** (P3) : 33 lignes en six sections, le
  lexique replié tout au bout (Jeanne, compréhension 3/5 ; Ophélie : « le genre de
  texte qui me ferait lâcher une appli »). Théo et Hugo la trouvent complète : à
  garder pour qui veut tout. Un « En bref » de trois lignes en tête (« La visite
  du jour : 3 parties, une œuvre à gagner chacune. » « Assez d'étoiles, et l'œuvre
  entre dans ton musée. » « Une salle complète réveille son gardien. »), « Les mots
  du Cabinet » juste après, toujours repliés, et « Les neuf jeux et leurs étoiles »
  repliés — chaque annonce les redit (`Regles.tsx`). Épreuve : l'ordre, dans
  `cabinet-ecran.test.ts`, et un rendu en 360 × 640 à 130 % où l'« En bref » et le
  titre du lexique tiennent au premier écran.
- **Après « C'est noté », l'accueil s'ouvre défilé au milieu** (bug, P3) en
  360 × 640 : `ProfilApp.tsx` (le `onDone` de `ProfilForm`) ne remet pas le
  défilement à zéro, comme le font ses autres changements d'écran (l. 167, 180).
  Jeanne a dû remonter, puis descendre trois fois.
- **Le bandeau de la fête se vide** (bug, P3, vérifié à la synthèse). Cinq sur six
  l'ont dit (Jeanne 049, Théo 063, Camille 032, Lucas 037, Ophélie 017) : la
  Citrouille réveillée, il ne reste que « Halloween » et une icône. `feteVue`
  (`vue.ts:494`) ne pose sa phrase que tant que le légendaire manque, et
  `Musee.tsx:157-162` rend le bandeau dès qu'il y a une fête. Il ne paraît que
  s'il a une phrase. Capture `06-musee-halloween-sans-phrase.png`.
- **« Faite : reviens demain, ou pars à la chasse », sans chasse** (bug, P3,
  vérifié à la synthèse) : `Musee.tsx:190-192` n'y lit pas `page.chasses.restent`,
  que la même page affiche (Lucas, 037).
- **Le Cabinet est la cinquième tuile de « Seul »** (limite), sous l'Expédition et
  à moitié sous la barre du menu (Jeanne, Camille) : l'Expédition y est encore
  (`EXPEDITION_REMPLACEE = false`) ; à l'ouverture, le Cabinet prend sa place.
  Regarder alors l'accueil en 360 × 640 à 130 %. Le mot « musée » est dans son
  sous-titre.
- **L'accueil sans profil ne parle pas du musée** (tension) : l'anonyme n'en voit
  rien, et les trois boutons doivent rester visibles sans défiler. Si le
  propriétaire le veut, « … le quiz du jour, ton musée et ton salon » dans la même
  phrase, sous `cabinetIci()`, sans ligne de plus.

## 14. Ce que l'oreille et l'œil daltonien perdent encore — P3

- **Le chrono qui presse ne change que de couleur, à 5 s** (Camille) : en
  deutéranopie, le rouge devient un kaki plus sombre que l'or ; sous « réduire les
  animations », la pulsation s'arrête. Un sablier devant les secondes (comme
  l'icône de la pause), une graisse plus forte, une barre plus épaisse, et un
  seuil `urgence` que le Cabinet porte à 10 s — pour des manches de 45 à 130 s,
  cinq secondes arrivent tard. `TimerBar` sert aussi les téléphones d'une soirée :
  les regarder, et l'écran commun (règle `ecran-commun.md`).
- **Un indice de plus n'est pas annoncé** : la zone de statut ne dit que le nom
  refusé (`Indices.tsx:117`). Elle dit aussi « Indice 2 : … ».
- **Des étoiles en glyphes** : « Garder ★★ », « Parier → ★★★ », les barèmes de
  l'annonce et des règles se lisent « étoile noire, étoile noire ». Un `EnEtoiles`
  (les glyphes `aria-hidden`, « 2 étoiles » en `sr-only`), et les boutons du Pari
  nommés « Garder 2 étoiles ».
- **Trois « Jouer » et trois « Changer de jeu » de même nom** dans la visite :
  `aria-label` « Jouer aux Indices », « Changer de jeu : Les Indices » — le texte à
  l'écran ne change pas, et `toucher "Jouer"` de la tablée doit encore les trouver.
- **L'Éclair corrigé dit « Faux… Vrai · tu as dit faux »** : la marque s'appelle
  du mot du jeu. Le verdict en mots (« Raté », « Juste », « Sans réponse »), et
  `Corrige` reçoit un `dit` facultatif.
- **« Le moyen filet ★★☆ » après un filet raté** se lit « 2 étoiles sur 3 » :
  « Ton filet : le moyen, qui valait … ».
- **Le titre de l'onglet ne suit pas l'écran**, et une manche n'a pas de titre de
  niveau 1 : `document.title` par écran (« La visite du jour · Le Cabinet ·
  FiestApp », « Le Détail, manche 1 sur 3 · … »).
- **Le contour d'une porte reste sous le doigt** (Camille a cru à une salle
  conseillée) : le `:hover` collant d'un écran tactile ; `.cab-porte:hover` sous
  `@media (hover: hover)` (`styles.css:10405`).
- **Tension** : au début d'une manche des Indices, le focus est sur la question,
  pas dans le champ, et une lettre tapée se perd (Hugo). C'est voulu — le clavier
  levé cacherait les indices. Pour un clavier physique seulement, porter la lettre
  au champ comme le fait le Mot (une fonction pure `versLeChamp`) : à arbitrer.
- **Faux positif** : « Rare » et « Épique » ont la même pastille, mais se disent en
  mots — Camille le note elle-même.

## 15. La tenue du code — P3

Le verdict de l'expert : le code du Cabinet « se lit comme un seul code (un
barème, un moule pour les neuf jeux, la porte vers la campagne, des écrans de jeu
qui ne téléchargent aucune règle qui juge, tests rapides et stables) ; ce qui
reste est de la dette de construction ». Douze confirmés, deux tensions, un
doublon.

- **La règle `cabinet.md` (68 Ko) se coupe** à la ligne 69 quand on la lit
  directement — l'outil le signale ; quatre règles dépassent (expedition, qg,
  cabinet, profil). La couper en `cabinet.md` et `cabinet-page.md`, et borner les
  règles avec une liste d'exceptions à vider.
- **L'envoi à l'échéance n'est gardé que par son texte** : un mutant qui ne répond
  plus jamais passe les 137 épreuves des quatre fichiers qui lisent `Partie.tsx`.
  L'ordonnancement en fonction pure (`aEnvoyerALEcheance(vue, t, pret)`).
- **Soixante renvois à « la conception »** (§, « Dn »), un document resté dans un
  bloc-notes de session : les titres de `decisions.md`, puis une épreuve qui
  refuse le motif — après tous les lots, il touche une quarantaine de fichiers.
- **La page produit décrit encore deux jeux** et un crochet des paliers branché
  qui ne l'est pas (`docs/produit/le-cabinet.md:152`, `:158`, `:186`).
- **Des copies** : la page redérive le seuil (`Annonce.tsx:53`) et « Change avant
  de répondre » ; des refus écrits deux fois au serveur ; le juge du contenu
  n'ouvre que œ et æ quand la saisie des Indices ouvre aussi ø, ł, đ… (« Walesa »
  passerait contre « Wałęsa ») ; `ETOILES_PAR_MANCHE` écrit 3 à douze endroits ;
  `AnnonceEnAttente` et des registres `Partial` morts ; un drapeau toujours vrai,
  deux fonctions sans appelant ; `fondreLesReveils` éprouvé trois fois.
- **Tensions** : `POUVOIR_DES_GARDIENS` écrit plutôt que dérivé, gardé par un test ;
  la série et l'œuvre de fin tenues deux fois, en SQL et en mémoire — un choix de
  sobriété, dont l'épreuve « le musée gardé égale le musée relu à froid » reste à
  écrire.

---

## Ce qui plaît, et qu'il ne faut pas casser

- **Une action par écran, en gros.** Fond sombre, or, boutons dorés et gros,
  titres en serif (Théo, Lucas, Ophélie). « On comprend vite quoi faire. »
- **Chaque jeu s'explique à son annonce, en une phrase et son barème** — « Trouve
  le mot, avec la question pour indice : 5 essais. En 1 ou 2 essais ★★★ ».
  Ophélie a joué sans lire les règles. La tête d'une manche se lit d'un coup d'œil
  à une main : les trois ronds et leurs étoiles, « 3 / 9 ★ », le chrono chiffré.
- **La couleur ne dit jamais rien seule.** Le Mot mystère (un trait pour la bien
  placée, un point pour l'ailleurs, la touche absente barrée, chaque case dite à
  l'oreille), l'Éclair (✓ et ✗ et « Vrai · tu as dit faux »), le Pari, la Frise
  (« À sa place »), le Filet (« Dans le filet », « À côté »), les cadres dorés dits
  en mots. Camille n'a jamais eu à deviner ; Hugo entend « R, bien placée ».
- **La carte de France qui parle.** « Ton épingle : à 150 km au nord-ouest de
  Lyon », jouable au clavier, et une révélation à deux formes (le rond blanc du
  lieu, le repère doré de l'épingle) : Jeanne, Théo, Camille, Hugo, Lucas.
- **La Frise au lecteur d'écran** : « Poser ici, entre « Clisthène… » et « Jules
  César bat Vercingétorix à Alésia » » — Hugo lui donne 5/5.
- **Ce qu'on apprend reste.** « Le savais-tu ? » à chaque révélation, le cartel
  d'une œuvre gagnée (« comme sous un vrai tableau »), tes murs — six sur six.
- **Le bilan qui fête** : l'œuvre qui entre dans son cadre, son cartel, la
  Citrouille qui se réveille. « On a envie de la montrer à son amie » (Ophélie).
- **Un but visible** : « Le prochain gardien : encore 7 œuvres dans la salle du
  Rempart », les gardiens en silhouettes, « endormi » ou « réveillé » dit
  clairement. C'est ce qui fait revenir Théo, Camille et Hugo.
- **« Quitter ? » franc** : il dit ce qu'on perd, met le chrono en pause et cache
  la manche (Théo, Ophélie, Lucas). La correction de la pause (axe 11) doit garder
  cette franchise.
- **Le serveur tient.** Deux onglets : « Ce geste est passé : ta partie a
  continué sans lui », pas de double gain ; le réseau coupé : un message clair, la
  réponse rejouée passe ; une dépense au-delà du solde : « Il te manque 154
  poussières d'or ». L'expert de la triche : 8 000 parties tirées au hasard se
  relisent à l'identique, une cinquantaine de requêtes piégées sont toutes
  refusées en mots, sans rien écrire.
- **Les pouvoirs changent d'un jeu à l'autre** (Éclairer donne une lettre au Mot,
  la réponse à l'Éclair, efface un titre au Détail) : « c'est ce qui rend chaque
  jeu frais » (Théo). La carte-bonus retenue d'une partie à l'autre est pratique
  pour lui — et a surpris Jeanne : l'annonce la dit, il faut qu'elle continue.
- **Une économie qui tient** : Théo l'a recomptée de bout en bout (180 poussières
  au plus par jour, cinq à six semaines pour tout posséder et tout dorer), et
  l'expert de l'équilibre la trouve sous une série à la minute.

| Le plaisir, sur 5 | Jeanne | Théo | Camille | Hugo | Lucas | Ophélie |
|---|---|---|---|---|---|---|
| L'Épingle | 4 | 4 | 4 | 3 | 4 | — |
| La Frise | — | 3 | 4 | 5 | 3 | — |
| La Réplique | — | 4 | — | 4 | 4 | — |
| Le Détail | 4 | 4 | — | 1 | 3 | 4 |
| Le Mot mystère | 3 | 3 | 4 | 4 | 4 | 4 |
| Le Pari | — | 4 | 3 | 4 | 3 | 3 |
| L'Éclair | — | 3 | 3 | 3 | 4 | — |
| Les Indices | — | 3 | — | 4 | 4 | — |
| Le Filet | 3 | 3 | 2 | 2 | 3 | — |

Le Filet est le seul jeu sous 3 chez deux joueurs, et c'est le curseur, pas le
jeu (« le jeu est bon, avec un vrai choix petit, moyen ou grand filet »,
Camille) ; le Détail à 1, c'est Hugo, qui ne le voit pas.

## Les limites de la tablée

- **Des agents qui savent tout.** Ils connaissent des faits qu'aucun joueur ne
  sait d'ordinaire — le diapason de John Shore en 1711, Baudelaire mort à 46 ans,
  Pelé et Bocuse dès le premier indice — et leurs fiches leur promettent une
  « excellente culture générale ». Le taux de 9 sur 9 borne la difficulté par le
  haut ; elle se mesure au calibrage, à force égale. La consigne « réponds comme
  ton personnage » est suivie par endroits (Camille tape RUSSIE pour Écosse),
  jamais sur les faits exacts. La prochaine fois : des domaines d'ignorance par
  fiche, une règle mécanique hors d'eux, et un joueur « tablée » au calibrage pour
  comparer chaque jeu à sa ligne.
- **Le pilote.** `toucher` vise le centre de l'élément (l'Épingle, le Filet),
  `ecrire` vide un curseur avant d'y écrire, et un curseur touché ne prend pas le
  focus dans Chromium : les jeux de visée y sont faussés. `voir` ne donne pas de
  référence, deux boutons « Quitter » se confondent, et une touche du Mot se vise
  mal une fois colorée (« P, bien placée »). Trois joueurs ont vu « un premier
  toucher pas pris » juste après une révélation : c'est la demi-seconde de garde
  après un changement d'écran (`gesteAccepte`, voulue contre le double toucher),
  croisée par des gestes d'agent — non vérifié plus loin. Et un agent répond en
  plusieurs secondes : le chrono ne presse pas un agent comme un humain.
- **Chromium seulement.** Ni Safari (qui ne rapetisse pas la page sous son
  clavier), ni Firefox, ni un vrai TalkBack : Hugo entend l'arbre d'accessibilité
  de Chrome, et le réglage d'un curseur par balayage reste à essayer sur un vrai
  téléphone ; le profil « iphone » n'a que la taille. La daltonie, le clavier
  (40 % de la hauteur) et la veille sont simulés.
- **Le texte agrandi de la tablée est un `zoom` CSS sur `<html>`**, pas le zoom de
  page de Chrome Android à 130 % (une mise en page de 277 × 492) : la vérification
  a mesuré les deux, et les chevauchements valent dans les deux.
- **Une tablée sur un client d'avant les lots F1 et D6.** Ses vérifications ont
  rejoué le même client ; deux défauts sont corrigés depuis (axes 1 et 13), un
  troisième en partie (axe 3).
- **La base mêle les personnages et les profils de vérification** : 57 des 65
  séries sans carte-bonus venaient des six profils de vérification. Une mesure
  tirée de la base se lit personnage par personnage.
- **Restés hors de la vérification** — dits par un personnage, ni rejoués ni
  relus : le code de secours qui déborde (Jeanne, une page de 367 px pour 360),
  « Créer mon profil » et « Me connecter » sous le clavier (Jeanne, Lucas),
  l'expérience qui semble dégressive (Théo), « Métamorphe » et « Flambeur » collés
  et « Com-mune » coupé à 130 % (Jeanne), « Temps écoulé » absent au Mot (Camille —
  le cadre l'écrit pour une manche expirée : à rejouer), la date « 64 » sans « apr.
  J.-C. » (Hugo), Mango et Louis Vuitton en « Jeux & pop culture » (Théo), des
  confettis par-dessus l'Éclair (Camille), « Parier » en doré quand « Garder » est
  le prudent (Ophélie), le bilan de deux écrans (Ophélie), « La rejouer à la Frise
  pour la dorer » sous une œuvre gagnée aux Indices (Théo, Hugo : voulu, mais
  rien ne le dit).

## Ce que contient ce dossier

- `synthese.md` — ce texte ;
- `camille-d.md`, `hugo.md`, `jeanne.md`, `lucas.md`, `ophelie.md`, `theo.md` — les
  retours des six personnages, tels quels ;
- `experts/` — les quatre rapports du code (`cabinet-triche`, `cabinet-sobriete`,
  `cabinet-equilibre`, `cabinet-code`), en Markdown et leurs constats en JSON ;
- `verification/` — leurs contre-expertises ;
- `constats.json` — les 93 constats, leur verdict, leur état au commit 3034028,
  leur axe et leur lot ;
- `captures/` — six captures, chacune citée plus haut.

Les reproductions, les mesures et les captures complètes restent dans `export/`,
qui n'est pas versé : `export/tablee/2026-10-25-22h07/` (le journal, la régie,
les captures de chaque personnage et des vérifications),
`export/evaluations/tablee-cabinet/` (les vérifications de la tablée et leurs
reproductions) et `export/evaluations/cabinet-*/` (celles des experts et des
contre-expertises).
