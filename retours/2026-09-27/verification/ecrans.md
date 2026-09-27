# Contre-expertise du groupe `ecrans` — accessibilité, design des récompenses, mots

Le code relu est celui de `main` (`b57035c`). Le client applicatif de `HEAD` (`a9ddd7f`) est identique : seuls des fichiers de `.claude/` ont changé depuis. J'ai construit le client dans mon dossier (`verification/ecrans/dist`). Ses empreintes d'assets sont identiques à celles du `dist` de design-recompenses, ce qui permet de rejouer leurs épreuves telles quelles.

Tout a été rejoué sur mes propres bancs jetables, un Chromium à la fois, sous `nice -n 10`. Je n'ai pas touché à la régie du port 35825. Rien n'est resté allumé.

## En bref

Sur 30 constats :

| Verdict | Nombre |
|---|---|
| confirmé | 19 |
| confirmé, gravité revue | 5 |
| doublon | 5 |
| tension | 1 |
| réfuté | 0 |
| incertain | 0 |

**Le seul P2 propre à ce groupe qui tienne** est `design-recompenses-2` (le classement du téléphone qui perd les prénoms). Il est même **plus large qu'annoncé**. Ce ne sont pas seulement les lauréats qui perdent leur prénom : c'est toute ligne à pastille de niveau. En fin de soirée, au texte à 130 %, un profil ordinaire n'a plus **aucune** lettre, et un anonyme n'en a plus qu'une.

`accessibilite-1` est aussi P2, mais c'est un doublon de `jour-ecran-3`, déjà confirmé.

Quatre P2 descendent en P3 :
- **`design-recompenses-1`** : « Carrière » dépasse bien de l'écran, mais **un doigt l'ouvre**. À 277 px, les 42 px visibles de l'onglet suffisent. L'échec venait du point central que vise Playwright, pas d'un toucher.
- **`accessibilite-2`** et **`accessibilite-3`** : ils sont réels et rejoués, mais ne touchent que des joueurs au lecteur d'écran ou au clavier matériel, sur un écran secondaire.
- **`mots-1`** et **`mots-2`** : ce sont des frictions de vocabulaire. En plus, la correction proposée pour `mots-2` casse ce que `Laurier.tsx:34` protège : un `<title>` **entre** dans le `textContent` du nom (prouvé ci-dessous).

## Le tableau

| Constat | Annoncé | Verdict | Retenu | Pourquoi, en une ligne |
|---|---|---|---|---|
| accessibilite-1 | P2 | doublon | P2 | C'est `jour-ecran-3` (confirmé P2 par la contre-expertise `jour`). L'extension est vraie à la lecture : ni `.focus()` ni `aria-live` dans `JourApp.tsx`, et les réponses passent `disabled` à l'échéance (`PlayerView.tsx:705`). |
| accessibilite-2 | P2 | confirmé, gravité revue | P3 | Rejoué : « 2007 » (juste) et « La France » (sans réponse) donnent le même `listitem`. Mais seul l'écran de relecture est touché, pour une population rare. |
| accessibilite-3 | P2 | confirmé, gravité revue | P3 | Rejoué : le 2ᵉ Tab sort de la carte ; Échap et « Fermer » rendent le focus à `body`. Chrome garde le fond dans l'arbre malgré `aria-modal`. Seuls le clavier matériel et le lecteur sont touchés, sur un écran social. Meilleure correction : `inert` ou `<dialog>.showModal()`. |
| accessibilite-4 | P2 | tension | P3 | Arbitrage déjà ouvert le 24 (A3). L'exception « essentiel » de 2.2.1 se défend pour un quiz classé et payé à la vitesse. Un temps de lecture est déjà offert. |
| accessibilite-5 | P3 | confirmé | P3 | Lecture : `disabled={busy}` ×6 (`Apparence.tsx`), `ul role="group"` (`Trophees.tsx:65`). |
| accessibilite-6 | P3 | confirmé | P3 | Rejoué : 324 px de page pour 320. Le motif ARIA (flèches, `aria-controls` vers des panneaux absents) se voit à la lecture. Le débordement est le même que `design-recompenses-1`, et sa piste CSS donne un 2 + 1 bancal à 320 px (mesuré). |
| accessibilite-7 | P3 | confirmé | P3 | Lecture : le palier n'est qu'en `sr-only` (`Ecusson.tsx:36-38`) ; la carte n'a pas de légende. |
| accessibilite-8 | P3 | doublon | P3 | C'est la moitié « aurore » de `design-recompenses-6` (mêmes textes, même lueur). |
| accessibilite-9 | P3 | confirmé | P3 | Lecture : `<Laurier />` suivi du même texte en clair (`CarteJoueur.tsx:107`, `ProfilApp.tsx:228`) ; laurier avant le bouton du prénom (`HostApp.tsx:205`). |
| accessibilite-10 | P3 | confirmé | P3 | Lecture : `aria-label` sur des `div` sans rôle (`CarteJoueur.tsx:129,138,173`), etc. |
| design-recompenses-1 | P2 | confirmé, gravité revue | P3 | Rejoué : la page fait 324 px dès 320. Mais à 277 px, un toucher sur la partie visible (42 px) ouvre « Carrière » et « Identifiant et mot de passe ». La piste proposée déborde encore à 150 %. |
| design-recompenses-2 | P2 | confirmé | **P2** | Rejoué (l'épreuve échoue sur 12 lignes). Le défaut est plus large qu'annoncé : à 277 px, un profil ordinaire a 11 px de prénom (4 chiffres) puis **0 px** (5 chiffres), un anonyme une lettre. |
| design-recompenses-3 | P3 | confirmé | P3 | Rejoué : 1,1:1 (épreuve 3). « niv. N » porte l'information, la silhouette n'est qu'une promesse. |
| design-recompenses-4 | P3 | confirmé | P3 | Non remesuré. Le commentaire de `styles.css:4640` cite « le profil » parmi les lieux animés : la piste garde l'esprit de la règle (le porté et l'ouvert bougent). |
| design-recompenses-5 | P3 | confirmé | P3 | Lecture : l'ordre avatar, niveau, laurier, prénom (`HostApp.tsx:203-205`) ; `plancherDuPrenom` ignore le laurier. |
| design-recompenses-6 | P3 | confirmé | P3 | Captures et mesure cohérentes avec celles d'accessibilité. Seuls les porteurs d'un fond gagné sont touchés. |
| design-recompenses-7 | P3 | confirmé | P3 | Lecture : `<Avatar avatar={profil.avatar} finition={f} …/>` sans `legendaire` (`Apparence.tsx:252,271`). |
| design-recompenses-8 | P3 | confirmé | P3 | Juste comme argument de design. Mais WCAG 1.4.3 exempte les composants inactifs : ce n'est pas un échec de conformité. |
| design-recompenses-9 | P3 | doublon | P3 | Même défaut qu'`accessibilite-7`. |
| design-recompenses-10 | P3 | confirmé | P3 | Dette, sans effet visible. |
| design-recompenses-11 | P3 | confirmé | P3 | Idée, affaire de goût. |
| design-recompenses-12 | P3 | confirmé | P3 | Idée. |
| design-recompenses-13 | P3 | confirmé | P3 | Lecture : 🐝 et 🐢 (index 6 et 7) sont donnés aux anonymes (`rendu-ecran.ts:104`) ; `sockets.ts:408` les vide, d'où 🎉. |
| mots-1 | P2 | confirmé, gravité revue | P3 | La carte ne s'ouvre qu'en salle d'attente (`PlayerApp.tsx:637-640`), pas « en pleine partie ». Les hauts faits disent déjà « ce qu'il a fallu ». |
| mots-2 | P2 | confirmé, gravité revue | P3 | Pas de survol sur une télé. Et la correction proposée est **fausse** : un `<title>` entre dans le `textContent` (« Alicevainqueur du quiz du jour d'hier »), ce que `Laurier.tsx:34` interdit. |
| mots-3 | P3 | doublon | P3 | Même ligne dans le rapport `mots` du 24 (constat 8, tableau l. 466 : « `ProfilApp.tsx:216` …toi seul l'as comme ça ») : jamais appliquée, puis déplacée. |
| mots-4 | P3 | confirmé | P3 | Lecture : `JourApp.tsx:519`. La série compte bien les soirées (`jour.ts:1161-1174`). |
| mots-5 | P3 | confirmé | P3 | Très mineur : « réserve de questions » se comprend. |
| mots-6 | P3 | confirmé | P3 | Lecture : aucun `fond` dans `Mot` ; utile seulement avec `mots-1`. |
| mots-7 | P3 | doublon | P3 | 24 septembre, constat 11. Les apostrophes droites de `consigne.ts` sont celles d'une consigne pour une IA : aucun invité ne les lit. Les cas visibles sont `ProfilForm.tsx:349` et les quiz livrés (« s'appelle », « l'eau » dans la correction du jour). |

## La réalité : qui a 320 px, 130 % de texte, un lecteur d'écran ?

- **320 px CSS n'est pas marginal**, même sans vieux téléphone. Sur un iPhone de 390 pt (12 à 16), le « Zoom de l'affichage » (le réglage « Texte plus grand » proposé dès la mise en service) donne 320 px. Chrome Android applique maintenant la taille de texte du téléphone comme un **zoom de page** : un téléphone de 412 px devient une page de ~320 px, un 360 à 130 % en devient une de 277. L'émulation par un viewport réduit, choisie par les deux experts, est donc la bonne.
- **130 % de texte** : environ un utilisateur Android sur quatre agrandit le texte (statistiques Appt, Pays-Bas, cinq millions d'utilisateurs) ; la part à 130 % et plus est moindre. Dans une salle de quinze invités où il y a des grands-parents, c'est un à trois téléphones.
- **Un lecteur d'écran pendant un quiz en soirée** : c'est rare. Les chronos, la télé et le bruit de la salle s'y prêtent mal, et je ne connais aucun témoignage dans les retours. Le **quiz du jour**, solitaire et joué chez soi, est l'endroit où il est le plus plausible. Les constats d'accessibilité qui ne touchent que le lecteur ou le clavier matériel sont donc, sauf blocage du jeu, des P3 pour la salle.
- **Les partis pris** : aucun des constats ne heurte les quatre partis pris de « La direction ». `accessibilite-4` touche au chrono, qui est le jeu lui-même : c'est une tension, déjà ouverte le 24 (A3). `mots-1` pose un glossaire sur la carte, que voient aussi les anonymes : c'est neutre face au parti pris n° 1.

## Constat par constat

### design-recompenses-2 — confirmé, P2 (et plus large qu'annoncé)

- **Rejoué** : `design-recompenses.test.ts`, épreuve 2. Elle échoue sur 12 lignes, par exemple « classement, 277 px : Marie-Charlotte Lefebvre — 0 px de prénom sur 38 pour trois lettres, laurier coupé ». Les deux autres épreuves échouent aussi, pour la raison annoncée.
- **Ma sonde, sans aucun laurier** (`verification/ecrans/sonde.ts`, partie B, notes `notes-sonde.json`). Une salle ordinaire : quatre anonymes, et Zoé, un profil de niveau 2. Après un quiz de six questions (1 200 points), puis avec des points de fin de soirée (« 12 450 ») :

  | Largeur | Anonyme (prénom visible) | Profil ordinaire à pastille | Avec « 12 450 » : anonyme / profil |
  |---|---|---|---|
  | 360 | 123 px | 94 px | 109 / 80 px |
  | 320 | 83 px (« Jean-Bap… ») | 54 px | 69 / 40 px |
  | 277 (130 %) | 40 px | **11 px** | 26 / **0 px** |

  Capture : `verification/ecrans/captures/classement-ordinaire-277.png`. La ligne de Zoé n'a que son avatar, « 2 » et « 12 450 » ; les autres montrent « J… », « G… », « K… ».
- **Ce qui change** : le défaut vient de la rangée unique de `.lb-row` (`styles.css:818-860`) et de la pastille de niveau. Il date d'avant #59. Le laurier y retire 23 px à un à trois lauréats par jour (le podium d'hier). Tout profil, lauréat ou non, perd son prénom en fin de soirée au texte à 130 %. La marque « Camille (2) » tombe dans la même ellipse (`Leaderboard.tsx:77`, une seule chaîne) : c'est l'invariant 17 rendu muet à 320 px.
- **Gravité** : P2 tient. Cela touche quelques invités, ceux au texte agrandi et les iPhone en zoom d'affichage, à chaque classement de la soirée. La télé compense en partie, mais c'est au téléphone qu'on touche un nom pour ouvrir une carte.
- **Correction** : la piste (une requête de conteneur à 250 px, deux rangs) est la bonne. **L'épreuve doit aussi mesurer une ligne de profil ordinaire à cinq chiffres et « Camille (2) »**, pas seulement les lauréats : sinon elle ne garde pas le cas le plus fréquent.

### design-recompenses-1 — confirmé, gravité revue P2 → P3 (le doigt l'atteint)

- **Rejoué** : l'épreuve 1 échoue (« 320 px : Carrière sort de sa barre (324 > 300) »). Ma sonde confirme que la page fait **324 px** de large dès 320 px (`notes-sonde.json`, `onglets`).
- **Ce qui ne tient pas** : « le toucher ne l'atteint plus », « trois choses deviennent inaccessibles au doigt ».
  - À 277 px, `locator.tap()` de Playwright échoue parce qu'il vise le **centre** de l'onglet (x = 280, hors écran).
  - Un doigt touche ce qu'il voit : `sonde-onglets.ts` fait défiler la page jusqu'aux onglets, sans décalage horizontal (`visualViewport.offsetLeft = 0`), puis touche x = 247.
  - Résultat : « Carrière » s'ouvre (`aria-selected = true`) et « Identifiant et mot de passe » s'affiche. Il en va de même à 260 px (25 px visibles) et à 240 px (150 %, 5 px visibles).
  - La mise en page s'élargit aussi à 324 px (`innerWidth = 324` pour un `visualViewport` de 277) : la page se fait glisser de côté.
  - Capture `captures/onglets-277-avant.png` : on voit « Apparence · Trophées · 📊 Ca », hors de la pilule.
- **Ce qui reste** : un onglet coupé à « Ca », qu'une grand-mère peut ne pas reconnaître ; une page qui flotte de 4 à 47 px sur tout le profil ; 1.4.10 échoue. C'est réel et laid, mais rien n'est perdu.
- **Correction** : la piste proposée tient à 320 et 277 px, mais « Apparence » **déborde encore de son onglet à 240 px** (150 %). La piste d'`accessibilite-6` empile les onglets, mais en 2 + 1 dès 320 px (mesuré, `notes-sonde-onglets-pistes.json`). Les deux ensemble tiennent partout (mesuré) :
  ```css
  .onglets { grid-auto-columns: minmax(0, 1fr); }
  .onglet { min-width: 0; padding-inline: 4px; }
  @media (max-width: 340px) { .onglets-profil .onglet .icon { display: none; } }
  /* Au-delà de 150 % de texte, un onglet par ligne plutôt qu'un libellé qui déborde. */
  @media (max-width: 250px) { .onglets { grid-auto-flow: row; grid-template-columns: 1fr; border-radius: 22px; } }
  ```
  Le message de l'épreuve 1 devrait dire « sort de l'écran », pas « le toucher ne l'atteint plus ».

### accessibilite-3 — confirmé, gravité revue P2 → P3 (et une meilleure correction)

- **Rejoué** (`sonde.ts`, partie C, carte ouverte au clavier depuis le classement) :
  - ouverture : `div.card « Carte de Jean-Baptiste »` ;
  - Tab 1 : « Fermer » ;
  - **Tab 2** : « Le souvenir de la soirée », HORS DE LA CARTE ;
  - Tab 3 : « Gagner des niveaux : créer un profil », HORS DE LA CARTE ;
  - Échap : `body`.
- `sonde-carte-modale.ts` ferme la carte par son bouton « Fermer », le seul geste d'un lecteur d'écran au téléphone : le focus va à `body`.
- Surtout, **Chrome ne retire pas le fond de l'arbre d'accessibilité** malgré `aria-modal="true"`. Avec la carte ouverte, `Accessibility.getFullAXTree` garde « button: Gagner des niveaux : créer un profil » et « La carte de Jean-Baptiste », non ignorés. TalkBack glisse donc hors de la carte comme le Tab.
- **Gravité** : P3. C'est un écran social, ouvert en salle d'attente ; le clavier matériel au téléphone est quasi absent en soirée, et le lecteur d'écran rare (ci-dessus). Le défaut se paie à chaque carte ouverte, en revenant du haut de la page.
- **Correction** : un crochet qui boucle Tab (celui de `Dialog.tsx`) ne suffit pas pour TalkBack. Mieux :
  - soit un `<dialog>` natif ouvert par `showModal()` : le fond devient `inert` pour le clavier **et** pour le lecteur, Échap est géré, et le navigateur rend le focus ;
  - soit `inert` posé sur la page derrière la carte le temps qu'elle est ouverte ;
  - dans les deux cas, rendre le focus à la ligne `.lb-ouvrable` touchée (`PlayerApp.tsx:640`).

  `Dialog.tsx` a le même trou pour TalkBack (hors de ce groupe).

### accessibilite-2 — confirmé, gravité revue P2 → P3

- **Rejoué** (`sonde-correction.ts`). Une partie jouée par l'API : 0 juste, 1 faux, 2 laissée au temps (horloge avancée), le reste juste. `ariaSnapshot` de `/jour#correction` donne :
  ```
  - listitem: En quelle année le premier iPhone est-⁠il sorti ? 2007                     ← juste
  - listitem: "Quel oiseau … ? Le martinet Tu avais dit : Le hibou"                      ← faux
  - listitem: Quel pays a remporté la Coupe du monde de football 2018 ? La France        ← sans réponse
  ```
  « Juste » et « sans réponse » s'entendent exactement pareil. À l'œil, la coche d'or et la croix rouge font la différence (`captures/correction-360.png`).
- **Gravité** : P3. Seul l'écran de relecture est touché, pas le jeu ; pour un joueur au lecteur, c'est rare mais plausible au quiz du jour. La correction proposée est bonne, S.

### accessibilite-1 — doublon de jour-ecran-3 (P2)

Même cause : `JourApp.tsx` n'a ni `.focus()` ni `aria-live`, contrairement à la soirée (`PlayerApp.tsx:455`). La contre-expertise `jour` l'a confirmé P2.

Les trois ajouts se lisent sans ambiguïté :
- l'échéance : `disabled={v.paused || closes}`, `PlayerView.tsx:705`, fait tomber le focus ;
- la fin, le classement et la correction n'ont pas de focus non plus.

Une seule correction pour les deux : la piste d'accessibilite-1, le focus sur l'intitulé et sur le bandeau, est plus précise que celle de jour-ecran-3.

### accessibilite-4 — tension, P3

Tout est exact :
- 20 s d'office (`library.ts:13`), 15 s dans quelques quiz livrés ;
- la consigne n'écrit pas de durée (déjà relevé par `jour-regles-12`).

Mais :
- l'exception « essentiel » de WCAG 2.2.1 couvre un quiz **classé, primé et payé à la vitesse** ;
- un temps de lecture est déjà offert (`lectureMs: tempsDeLecture(p)`, `jour.ts:555`) : une bonne réponse à 12 s vaut encore 153 points sur 200 ;
- le 24 (A3), le même arbitrage est resté ouvert pour les soirées.

La « partie tranquille » (hors classement, sans bonus de vitesse) est une bonne proposition de produit, à arbitrer. En attendant, l'alerte « 5 secondes » dite une fois (S) ne coûte rien.

### mots-2 — confirmé, gravité revue P2 → P3 ; correction réfutée

- Le constat tient à la lettre : `aria-label` ne fait pas d'infobulle.
- Mais **personne ne survole la télé**, et le glossaire du profil explique déjà le laurier (`glossaire.ts:62`).
- La correction proposée affirme qu'un `<title>` dans le `<svg>` « ne pose pas ce risque » pour le `textContent` du bouton. C'est faux. Sonde D (`notes-sonde.json`, `titreDansLeLaurier`) :
  - `textContent` du nom : « Alicevainqueur du quiz du jour d'hier » ;
  - celui du bouton, pareil ;
  - `innerText` : « Alice ».

  C'est précisément ce que `Laurier.tsx:34-35` a écarté.
- **Mieux** :
  - une ligne de légende sous la salle d'attente de l'écran commun quand un lauréat est là (« ✦ vainqueur du quiz du jour d'hier », piste d'accessibilite-9). Elle sert la salle, pas seulement la souris de l'animateur ;
  - à défaut, un attribut `title` sur un `span` qui enveloppe le SVG. Il ne compte pas dans le `textContent`, mais il est à vérifier au lecteur (description en double possible).

### mots-1 — confirmé, gravité revue P2 → P3

- La carte ne s'ouvre qu'en salle d'attente : le seul `Leaderboard` qui reçoit `onOuvrir` est à `PlayerApp.tsx:637`, jamais pendant une question. « L'écran le plus touché en pleine partie » est donc inexact.
- Plusieurs mots s'y expliquent déjà sur place :
  - chaque haut fait porte « ce qu'il a fallu » (`CarteJoueur.tsx:163`) ;
  - « Réflexe moyen » s'écrit avec ses secondes ;
  - « Prix de soirée : 9 sur 20 » se comprend.
- Un `<Glossaire>` replié ne coûte qu'une ligne, mais allonge une carte déjà longue à 130 % (`design-recompenses-12`). À poser, en ne gardant que les mots que la carte porte vraiment (`p.ecussons`, `p.prix`, `carte.laurier`…), comme le suggère l'expert.

### Les autres (P3)

- **accessibilite-5, 7, 9, 10, design-recompenses-5, 7** : les chemins cités sont exacts et je les ai relus (voir tableau). Ils tiennent.
- **design-recompenses-3** : l'épreuve 3 échoue à 1,1:1. La capture montre des formes sombres encore devinables, et « niv. N » porte l'information. La promesse de RECOMPENSES.md § 5.5 (« une silhouette ») est faible, pas rompue. Une ligne de CSS suffit.
- **design-recompenses-4** : non remesuré. Le commentaire de `styles.css:4640-4650` range « le profil » parmi les lieux où les médaillons bougent : c'est un choix. La piste (ne faire bouger que le porté et l'ouvert) le respecte. P3.
- **design-recompenses-6** : théâtre et aurore, cohérents avec les mesures d'accessibilité (p10 de 3,98 à 4,31 sous le titre doré). Seuls les porteurs d'un fond gagné, au niveau 20 et plus, sont touchés.
- **design-recompenses-8** : le 2,26:1 est vrai, mais un bouton `disabled` est exempté par 1.4.3. L'argument de design tient : c'est justement la règle qu'on vient lire.
- **design-recompenses-13** : les index 6 et 7 de `rendu-ecran.ts:104` (🐝, 🐢) sont des anonymes (`i < 6` seulement a un profil). `sockets.ts:408` vide un emoji de collection que `peutPorter` refuse. Confirmé à la lecture.
- **mots-3** : doublon du 24 septembre (constat 8, tableau des corrections, l. 466, qui citait cette phrase même). La correction n'a jamais été appliquée, puis la phrase a été déplacée dans `Apparence.tsx:224`. À corriger en une ligne.
- **mots-7** : doublon du 24 septembre (constat 11). Voir le tableau pour ce qui se voit vraiment.

## Méthode

**Lus** :
- les six rapports (`.md` et `.json`) de mes trois experts ;
- `jour-ecran.json`, `recompenses-vitrine.json`, et `verification/jour.json` et `recompenses.json` ;
- `retours/2026-09-24/experts/{accessibilite,mots,design-telephone}.md`, `retours/2026-09-24/synthese.md` (A3, T4) ;
- README « La direction » ;
- `CarteJoueur.tsx`, `Dialog.tsx`, `Laurier.tsx`, `Leaderboard.tsx`, `Ecusson.tsx`, `Glossaire.tsx`, `shared/glossaire.ts`, `Apparence.tsx` (grille, finitions), `ProfilApp.tsx` (onglets, Carrière), `JourApp.tsx` (révélation, question, correction, fin), `PlayerView.tsx:695-712`, `PlayerApp.tsx:590-640`, `HostApp.tsx:96-112, 190-215`, `HostView.tsx:975-1000` ;
- `styles.css` : onglets, `.lb-row`, gel des médaillons ;
- `server/src/core/jour.ts` (durée, série), `quizDuJour.ts`, `sockets.ts:400-410`, `server/scripts/rendu-ecran.ts:95-125`, `server/scripts/tablee/regie.ts:478-520`.

**Rejoué** :
- `design-recompenses.test.ts` : 3 échecs sur 3, pour les raisons annoncées ; charge 1,8 à 2,2.

**Écrit**, dans `export/evaluations/verification/ecrans/` (captures dans `captures/`, notes en `notes-*.json`) :

| Fichier | Rôle |
|---|---|
| `sonde.ts` | onglets sur 11 largeurs ; classement d'une salle ordinaire à 360 / 320 / 277 px, à 4 puis 5 chiffres ; carte au clavier ; `textContent` d'un laurier à `<title>` |
| `sonde-onglets.ts` | le toucher d'un doigt sur la partie visible de « Carrière », à 277, 260 et 240 px |
| `sonde-echelle.ts` | `innerWidth` et `visualViewport` quand la page déborde |
| `sonde-onglets-pistes.ts` | les deux pistes CSS, seules et ensemble, à 320, 277 et 240 px |
| `sonde-correction.ts` | une partie du jour jouée par l'API puis l'arbre de la correction |
| `sonde-carte-modale.ts` | l'arbre CDP carte ouverte, et le focus après « Fermer » |

**Pas rejoué** :
- les scripts d'accessibilité branchés sur la régie (`jour.mjs`, `profil.mjs`) : je n'y touche pas ;
- `scene.ts` : ses constats sont vérifiables à la lecture ou rejoués par mes sondes ;
- les mesures d'animation (`design-recompenses-4`).

## Hors mission

« En tête du quiz » à la télé (`HostView.tsx:994`, dans `Coupe`) peut cacher un co-leader dans « et 3 autres » (hors mission de design-recompenses). C'est un classement **en cours** de quiz, pas un verdict : l'invariant 15 ne vise que les podiums, où rien n'est coupé. P3 au plus, non rejoué.

## Limites

- Chromium seulement, en émulation mobile. Aucun vrai TalkBack ou VoiceOver, aucun vrai appareil : le comportement du zoom de page de Chrome Android est pris aux sources ci-dessous, pas mesuré.
- Je n'ai pas vérifié si VoiceOver sous Safari retire le fond d'un `aria-modal` (WebKit le fait, en principe). Seul Chrome, donc TalkBack, est mesuré ici.

## Sources

- [Font size | Appt](https://appt.org/en/stats/font-size) — part des utilisateurs Android et iOS qui agrandissent le texte (lu par le résumé de recherche, le site est bloqué par le proxy).
- [Accessible Text Scaling for Android (Medium)](https://sigute.medium.com/accessible-text-scaling-for-android-6a62e0b14006).
- [PSA: Browser text zoom on Android will now work like it does on desktop (blink-dev)](https://groups.google.com/a/chromium.org/g/blink-dev/c/rTNCw0lHmZk) et [Change text, image & video sizes (zoom) - Android - Chrome Help](https://support.google.com/chrome/answer/96810?hl=en&co=GENIE.Platform%3DAndroid) — la taille de texte du téléphone appliquée comme zoom de page (un 412 px devient ~320).
