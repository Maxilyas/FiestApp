# Les mots de l'application — rapport de l'expert rédaction UX

## En bref

Les PR #58 et #59 ont ajouté environ 455 textes neufs (sur ~2 850 dans tout
le dépôt) : le quiz du jour, le profil en trois onglets, et tout un lot de
récompenses (paliers du jour, Sphinx, légendaires de saison, laurier,
écussons, fonds de carte). L'écriture y est du même niveau que le reste de
l'appli — tu, phrases courtes, jargon expliqué en ligne — et plusieurs
corrections de l'audit du 24 septembre ont visiblement tenu : le pitch du
profil (`PITCH_PROFIL`) est repris tel quel jusque dans la nouvelle fin de
soirée, l'unité « XP » est maintenant écrite sous la barre de niveau, et
`shared/glossaire.ts` s'est enrichi de « écusson » et « laurier ». Le défaut
principal est nouveau : le glossaire posé sous `/profil` ne suit pas le
jargon qui a essaimé ailleurs. La carte d'un joueur (`CarteJoueur.tsx`) —
l'écran le plus touché *pendant* la partie, par n'importe quel invité, avec
ou sans profil — affiche « Écussons de savoir », « Réflexe moyen », « Hauts
faits », « Prix de soirée » sans un seul renvoi ; le laurier, lui, reste une
icône muette pour quiconque tient une souris (animateur à la console) faute
d'un `<title>` que le même lot pose déjà ailleurs (`Carriere.tsx`). Les trois
correctifs les plus rentables : **(1)** glisser le `<Glossaire>` déjà écrit
dans `CarteJoueur.tsx` ; **(2)** ajouter un `<title>` au laurier ; **(3)**
achever la phrase épicène de l'Éclat, corrigée sur deux avatars sur trois
mais pas sur le troisième, dans le même fichier neuf.

## Méthode

- **Isoler le texte neuf** : un script (`export/evaluations/mots/scripts/lignes-ajoutees.mjs`)
  lit `git diff -U0 a6fc98b..HEAD` et calcule, fichier par fichier, les
  plages de lignes ajoutées (7 756 lignes, 60 fichiers — le compte exact du
  `git diff --stat`). Un second script (`inventaire.mjs`, repris tel quel de
  l'audit du 24 septembre) relève tous les textes montrés à quelqu'un
  (JSX, `title`/`aria-label`/`placeholder`, `new Error('…')`, chaînes et
  gabarits qui ressemblent à une phrase) dans `client/src`, `shared`,
  `server/src` : 2 844 textes au total. Un troisième script (`croiser.mjs`)
  garde seulement ceux dont la ligne tombe dans une plage ajoutée : **455
  textes neufs**, dans 29 fichiers — la liste complète est dans
  `export/evaluations/mots/inventaire-neuf.tsv`. J'ai lu les 455 dans leur
  fichier source (pas seulement la ligne isolée), pour voir si le jargon
  qu'ils emploient est expliqué à côté.
- **Vérifié dans le code** : chaque constat cite son `fichier:ligne` et a été
  relu dans le fichier entier, pas seulement le grep. Pour « le glossaire ne
  suit pas », j'ai cherché tous les appels à `<Glossaire` du dépôt (trois
  seulement : `ProfilApp.tsx`, `BilanApp.tsx`, `RecapApp.tsx`) et vérifié
  qu'aucun des sept fichiers neufs n'y figure. Pour « la phrase épicène
  corrigée deux fois sur trois », j'ai retrouvé le commit qui avait corrigé
  les deux premières occurrences (`468d295`, antérieur à `a6fc98b`, donc déjà
  en place avant ces deux PR) et confirmé qu'à `a6fc98b` la troisième
  occurrence portait déjà l'ancienne formulation — la reprise dans
  `Apparence.tsx` n'a donc rien cassé, elle a simplement déplacé un défaut
  jamais corrigé.
- **En situation**, sur l'atelier (espace `chez-helene`, un profil créé
  depuis l'accueil, 360 × 640) : compte activé, quiz lancé à partir du modèle
  « Culture générale », profil joueur créé (« Margot »), page `/profil`
  parcourue onglet par onglet, glossaire déplié — capture à l'appui
  (`export/tablee/2026-09-26-atelier/captures/helene-tel1/001-profil-apparence.png`).
  L'atelier a été redémarré en cours de mission (limite d'usage) ; je n'ai
  pas rouvert d'appareil ensuite, la machine étant chargée et mes preuves de
  lecture de code étant sans ambiguïté pour les constats restants.
- **Pas couvert** : la lecture réelle au lecteur d'écran (l'expert
  accessibilité couvre cet angle en détail — je ne reprends pas ses
  constats) ; le mode équipes du quiz du jour (il n'existe pas) ; les
  1920 × 1080 ; une partie du quiz du jour jouée jusqu'à la médaille.
- **Ce que je ne refais pas** : les constats de l'audit du 24 septembre
  (`retours/2026-09-24/experts/mots.md`) sur le code d'avant ces deux PR, ni
  ceux des rapports arrivés en parallèle dans `export/evaluations/rapports/`
  (accessibilité, design, invariants…) — je signale seulement quand l'un de
  leurs sujets croise le mien sans le répéter.

## Constats

### 1. La carte d'un joueur — l'écran le plus touché en pleine partie — n'explique aucun de ses mots
- **Où** : `client/src/components/CarteJoueur.tsx:181-206` (les cases
  « Hauts faits », « Réflexe moyen », « Écussons de savoir », « Prix de
  soirée », « Quiz du jour »).
- **Constat** : toucher un nom pendant une soirée — un geste que le README
  décrit comme ouvert à tout le monde, y compris à l'invité anonyme —, ouvre
  cette carte. Elle empile en une seule fois presque tout le jargon des deux
  PR : « Ses plus beaux hauts faits », « Écussons de savoir », « Réflexe
  moyen », « Prix de soirée : 9 sur 20 », « Quiz du jour : 4 jours joués ».
  Aucun de ces mots n'a de définition sur cet écran : ni `<Glossaire>` (le
  composant existe, `client/src/components/Glossaire.tsx`, mais n'est monté
  que dans trois fichiers : `ProfilApp.tsx`, `BilanApp.tsx`, `RecapApp.tsx` —
  jamais `CarteJoueur.tsx`), ni renvoi textuel comme en ont « Ma finition »
  ou « Le fond de ma carte » sur `/profil`. Une grand-mère qui touche le nom
  d'un petit-fils pour la première fois lit cinq mots maison d'un coup, sans
  filet.
- **Preuve** : lecture complète de `CarteJoueur.tsx` (219 lignes) — aucune
  occurrence de `Glossaire` ; comparaison avec `grep -rln "<Glossaire"
  client/src/` (trois fichiers, pas celui-ci).
- **Qui ça touche, ce que ça coûte** : tous les invités, profil ou non — la
  carte est justement le seul endroit où un anonyme aperçoit ce système.
  C'est aussi l'écran le plus visité de tous ceux qu'ajoutent ces deux PR :
  on la touche plusieurs fois par soirée, contre une visite occasionnelle de
  `/profil`.
- **Statut** : confirmé (lecture).
- **Piste** : poser le même `<Glossaire>` qu'utilise `/profil`, avant le
  bouton « Fermer » (ligne 211) :
  ```tsx
  <Glossaire mots={['hautsFaits', 'ecusson', 'prix', 'laurier', 'legendaire', 'divin', 'reflexe']} />
  ```
  La liste peut se réduire à ce que `p` porte réellement (pas de « prix » si
  `p.prix` est vide), sur le modèle de ce que fait déjà `ProfilApp.tsx`.
- **Priorité · effort** : P2 · S.

### 2. Le laurier reste une icône muette pour qui tient une souris
- **Où** : `client/src/components/Laurier.tsx:36` (le `<svg>`), vu sur le mur
  (`HostApp.tsx:205`, `:1300`), le podium (`Podium.tsx:104`), la course
  (`Course.tsx:114`), la salle d'attente, et le classement du téléphone
  (`Leaderboard.tsx:77`, `JourApp.tsx:712`).
- **Constat** : le composant porte `role="img"` et `aria-label={LAURIER_TEXTE}`
  — une bonne annonce pour un lecteur d'écran — mais aucun `<title>` enfant.
  Sur une image SVG, c'est ce dernier qui produit l'infobulle native au
  survol : `aria-label` seul n'en affiche aucune dans Chrome ni Firefox.
  L'animateur qui pilote la console à la souris, ou qui a le nez sur l'écran
  commun, voit une petite couronne dorée après un prénom sans aucun moyen de
  savoir ce qu'elle veut dire — sauf à toucher le nom pour ouvrir sa carte
  (constat 1), ce qu'on ne fait pas d'une souris posée sur un vidéoprojecteur.
  Le même lot de PR pose pourtant déjà le bon motif ailleurs : les points de
  courbe de `Carriere.tsx` (`<circle>…<title>{...}</title></circle>`,
  lignes 400-409) ont une infobulle au survol *et* une annonce lue.
- **Preuve** : lecture de `Laurier.tsx` (aucun `<title>`) ; comparaison avec
  `Carriere.tsx:400-409` (le motif `<title>` employé dans le même lot).
- **Qui ça touche, ce que ça coûte** : l'animateur, qui doit deviner ou
  expliquer de mémoire un symbole qui revient toute la soirée dès qu'un
  lauréat d'hier joue ce soir.
- **Statut** : confirmé (lecture).
- **Piste** :
  ```tsx
  <svg className="laurier" viewBox="0 0 24 24" role="img" aria-label={LAURIER_TEXTE}>
    <title>{LAURIER_TEXTE}</title>
    …
  </svg>
  ```
  (le commentaire actuel, « Pas de `<title>` : il entrerait dans le texte du
  prénom… », visait le texte accessible d'un lien parent — un `<title>` posé
  ICI, dans le `<svg>` lui-même et non dans un lien englobant, ne pose pas ce
  risque : `titres.test.ts`/`la tablée` le confirmeraient en relisant le
  `textContent` du bouton, qui reste inchangé.)
- **Priorité · effort** : P2 · S.

### 3. « Le fond de ma carte » : un jargon neuf, oublié du glossaire partagé
- **Où** : `shared/glossaire.ts` (le type `Mot` et `GLOSSAIRE`, ni l'un ni
  l'autre n'a d'entrée `fond`) ; `client/src/components/Apparence.tsx:348-397`
  (`MonFond`).
- **Constat** : les deux PR ajoutent quatre systèmes de jargon nouveaux —
  paliers du quiz du jour, Sphinx et légendaires de saison, écussons, fonds
  de carte. Les trois premiers rejoignent (ou réutilisent) une entrée du
  glossaire partagé ; les fonds de carte, non : `MonFond` explique bien la
  mécanique en une phrase locale (« Il se voit quand quelqu'un touche ton
  nom : c'est ta carte qui change d'allure, rien d'autre. »), mais le mot
  « fond » n'apparaît dans aucune des vingt entrées de `GLOSSAIRE` — la seule
  des quatre nouveautés dans ce cas.
- **Preuve** : lecture de `shared/glossaire.ts` (liste `Mot` : aucune valeur
  `fond`) et de `shared/fonds.ts`/`Apparence.tsx` (le concept existe bien,
  affiché, juste pas glossé).
- **Qui ça touche** : surtout mineur seul — `MonFond` s'explique déjà sur
  place —, mais si le constat 1 se corrige (poser `<Glossaire>` sur la
  carte), un fond vu sur la carte de quelqu'un d'autre restera sans
  définition centralisée tant que celle-ci manque.
- **Statut** : confirmé (lecture).
- **Piste** :
  ```ts
  fond: { terme: 'Fond de carte', sens: 'Le décor derrière ta carte, gagné sur la durée : rien d’autre ne change.' },
  ```
  puis l'ajouter à la liste `mots` du `<Glossaire>` de `ProfilApp.tsx:368`.
- **Priorité · effort** : P3 · S.

### 4. Une phrase épicène corrigée deux fois sur trois — la troisième vit dans le fichier neuf
- **Où** : `client/src/components/Apparence.tsx:224` (l'Éclat d'un simple
  emoji) contre `client/src/components/Carriere.tsx:55` et
  `client/src/components/FinDeSoiree.tsx:136` (l'Éclat d'un légendaire).
- **Constat** : les trois textes racontent la même chose (« ton avatar a
  éclaté, tu es seul·e à l'avoir comme ça ») à trois endroits. Deux disent
  déjà « … et **personne d'autre** ne l'a comme ça » — une correction de
  l'audit du 24 septembre (constat 8), appliquée par un commit antérieur à
  `a6fc98b` (`468d295`, « Les mots : ce qu'on lit au mur… ») pour le cas d'un
  avatar légendaire. Le troisième, à `Apparence.tsx:224` (le cas d'un simple
  emoji, extrait de l'ancien `ProfilApp.tsx` par la refonte en onglets), dit
  encore « … et **toi seul** l'as comme ça » : `a6fc98b` portait déjà cette
  version non corrigée avant les deux PR (`ProfilApp.tsx:298` à ce commit),
  qui l'a reprise telle quelle en la déplaçant. Un joueur qui débloque
  d'abord un emoji éclaté puis un légendaire éclaté lira les deux formes,
  l'une après l'autre, sur le même profil.
- **Preuve** : `grep -rn "seul.*comme ça\|comme ça" client/src/` (3
  occurrences, 2 corrigées, 1 non) ; `git show a6fc98b:client/src/views/ProfilApp.tsx | grep "toi seul"` (déjà présent avant ces deux PR, donc ni cassé ni corrigé par elles — simplement déplacé sans y toucher).
- **Qui ça touche** : la moitié féminine de la salle, comme le disait déjà
  l'audit précédent (constat 8) — ici, avec la preuve que la correction
  n'a pas suivi le code déplacé.
- **Statut** : confirmé (lecture) ; persistance d'un constat non corrigé de
  l'audit du 24 septembre, pas une régression des deux PR.
- **Piste** : `Apparence.tsx:224` → « il change de couleurs, et **personne
  d'autre** ne l'a comme ça. » (aligné sur les deux autres).
- **Priorité · effort** : P3 · S.

### 5. « Un soir de soirée compte aussi » — une formule qui trébuche sur elle-même
- **Où** : `client/src/views/JourApp.tsx:519` (la fin d'une partie du quiz du
  jour, quand une série de jours joués est en cours).
- **Constat** : « Série : 6 jours » puis, en dessous : « **Un soir de
  soirée** compte aussi : la fête ne casse jamais une série. » Le sens visé
  (jouer une vraie soirée FiestApp compte aussi pour la série du quiz du
  jour, même sans avoir ouvert `/jour` ce jour-là) est correct — mais « un
  soir de soirée » empile deux mots presque identiques (soir / soirée) dans
  une syntaxe bancale, à relire deux fois pour la comprendre.
- **Preuve** : lecture directe de la ligne ; confirmé par le code voisin
  (`server/src/core/jour.ts`, la série compte les jours où une soirée
  qualifiante a été jouée).
- **Qui ça touche** : les joueurs assidus du quiz du jour, à chaque fin de
  partie où une série est active — un des écrans les plus vus du quiz du
  jour.
- **Statut** : confirmé (lecture).
- **Piste** : « **Une soirée jouée** compte aussi : elle ne casse jamais ta
  série. » (ou « … compte aussi pour ta série : la fête ne la casse pas. »)
- **Priorité · effort** : P3 · S.

### 6. « La réserve », mot d'administration, s'affiche tel quel au joueur
- **Où** : `client/src/views/JourApp.tsx:292` (l'écran « Pas de quiz du jour
  aujourd'hui »).
- **Constat** : « Pas de quiz aujourd'hui : **la réserve de questions** est
  vide. Il revient demain. » « Réserve » est le mot que le CLAUDE.md et
  `core/jour.ts`/`AdminDuJour.tsx` réservent justement à l'administrateur
  (« jours d'avance », « ajouter à la réserve »…) ; côté joueur, c'est la
  première et seule fois que le mot apparaît — sans lien avec quoi que ce
  soit d'autre à l'écran. Le sens se devine (« il n'y a plus de questions
  prêtes »), mais le mot lui-même ne sert à rien ici : il ne s'explique nulle
  part côté joueur et n'est jamais repris ensuite.
- **Preuve** : lecture de `JourApp.tsx` ; recherche de « réserve » côté
  client — seule occurrence hors `AdminDuJour.tsx`.
- **Qui ça touche** : un joueur qui ouvre `/jour` un jour où
  l'administrateur a laissé filer les stocks — rare, mais déroutant sans
  raison : le mot n'ajoute rien à comprendre.
- **Statut** : confirmé (lecture) ; friction mineure.
- **Piste** : « Pas de quiz aujourd'hui : il n'y en a plus en attente. Il
  revient demain. »
- **Priorité · effort** : P3 · S.

### 7. Apostrophes mêlées dans le texte neuf — le constat 11 de l'audit précédent tient toujours
- **Où** : `server/src/core/consigne.ts` (toute la consigne pour une IA,
  36 occurrences relevées, apostrophes droites `'` à 100 %) contre le reste
  des textes neufs des deux PR (89 apostrophes courbes `'` contre 14 droites,
  toutes les 14 dans ce même fichier).
- **Constat** : ce n'est pas une nouveauté du fond — l'audit du 24 septembre
  l'avait déjà relevé (constat 11, « 126 droites contre 119 courbes ») et
  demandé un test sur l'inventaire —, mais le texte neuf de ces deux PR
  montre que ça continue : `server/src/core/consigne.ts` est un fichier
  entièrement neuf, cohérent avec lui-même (100 % droites), mais détonne du
  reste (89 courbes ailleurs dans le même diff). Preuve fraîche, en direct,
  que le mélange touche même une phrase déjà « corrigée » par l'audit
  précédent : le pitch du profil (`PITCH_PROFIL`, en courbes) est suivi,
  dans `ProfilForm.tsx` (hors du périmètre de ces deux PR, donc non recompté
  dans mon inventaire), d'une phrase en apostrophes droites, **dans le même
  paragraphe affiché à l'écran** — vu sur l'atelier, écran d'entrée, avant
  toute connexion : « Un profil garde ton niveau, tes prix et tes avatars
  d'une soirée à l'autre. Il ne change rien aux points d'un quiz — et
  rejoindre une soirée n'en demande aucun. » (première moitié courbe,
  seconde droite).
- **Preuve** : script de comptage sur les lignes ajoutées (`export/evaluations/mots/scripts/`,
  calcul inline) ; lecture de `client/src/components/ProfilForm.tsx:345-350`
  au `cat -A` (apostrophes distinctes confirmées caractère par caractère).
- **Qui ça touche** : personne concrètement gêné — c'est un défaut de
  typographie, pas de sens —, mais un signal que le test suggéré par l'audit
  précédent (« une vérification… qui parcourt l'inventaire ») n'existe pas
  encore : `server/test/mots.test.ts` ne teste que le glossaire
  (`GLOSSAIRE`), pas l'inventaire entier.
- **Statut** : tension avec une correction déjà proposée (constat 11,
  24 septembre) — ne tient pas encore.
- **Piste** : remplacement mécanique dans `consigne.ts` (un fichier neuf,
  aucune donnée en base à migrer) ; et, comme le suggérait déjà l'audit
  précédent, un test qui relit tout l'inventaire (pas seulement le
  glossaire) et échoue sur une apostrophe droite dans un texte affiché.
- **Priorité · effort** : P3 · S.

## Mesures et cartes

**Le texte neuf, par fichier** (455 textes qui tombent sur une ligne ajoutée
par `a6fc98b..HEAD`, sur 2 844 relevés dans tout `client/src` + `shared` +
`server/src`) :

| Fichier | Textes neufs |
|---|---|
| `client/src/views/JourApp.tsx` | 92 |
| `client/src/components/AdminDuJour.tsx` | 60 |
| `client/src/components/Trophees.tsx` | 39 |
| `client/src/components/Apparence.tsx` | 35 |
| `client/src/components/FinDeSoiree.tsx` | 26 |
| `server/src/core/consigne.ts` | 23 |
| `client/src/views/ProfilApp.tsx` | 23 |
| `client/src/components/Jour.tsx` | 23 |
| `client/src/components/CarteJoueur.tsx` | 23 |
| `client/src/components/Carriere.tsx` | 21 |
| `server/src/core/jour.ts` | 14 |
| `server/src/quizDuJour.ts` | 12 |
| `shared/legendaires.ts` / `shared/fonds.ts` / `server/src/core/stats.ts` | 8 chacun |
| le reste (15 fichiers) | 1 à 6 chacun |

**Où le glossaire (`<Glossaire>`) est-il monté ?**

| Écran | Jargon montré | `<Glossaire>` |
|---|---|---|
| `/profil` (Apparence, Trophées, Carrière) | XP, niveau, finition, Éclat, légendaire, Divin, hauts faits, paliers, écusson, laurier, précision, coup d'œil, réflexe, flair | **Oui**, un seul, sous les trois onglets |
| `/bilan`, `/souvenir` | coup d'œil, précision… | Oui (déjà en place avant ces deux PR) |
| Carte d'un joueur (`CarteJoueur.tsx`) | hauts faits, écusson, prix, réflexe, laurier, légendaire, Divin | **Non** (constat 1) |
| `/jour` (`JourApp.tsx`) | XP, palier, légendaire (Sphinx), série | Non — mais chaque écran de `/jour` explique son mot en ligne (seule l'unité XP reste nue, comme sur `/profil`) |
| `/admin` (`AdminDuJour.tsx`) | réserve, dépôt, signalement | Non — public restreint à l'animateur, jargon assumé |
| Fin de soirée (`FinDeSoiree.tsx`) | XP, palier, finition, légendaire, Éclat, collection | Non — mais reprend `PITCH_PROFIL` et explique chaque bloc en ligne |

**Ce que confirme `server/test/mots.test.ts`** (existant, relu pour ne pas
répéter ce qu'il couvre déjà) : le renommage des prix (« Le Devin » du
palmarès → « Le Compas dans l'Œil », « Le Sans-Faute » → « Le Plus Précis »),
« Garder les points » face à « Retirer les points », les messages d'erreur
« soirée complète », « propre compte », formats d'image, le glossaire (une
phrase courte, jamais de règle des Divins, apostrophe courbe *dans le
glossaire lui-même*), et le formatage des nombres (`pts()`, espace fine dès
cinq chiffres). Toutes ces corrections de l'audit du 24 septembre tiennent.

## Ce qui marche — à ne pas casser

- **`PITCH_PROFIL`, une seule constante, reprise partout** — y compris dans
  la nouvelle fin de soirée (`FinDeSoiree.tsx:310`) : la recommandation n°2
  de l'audit précédent a été suivie à la lettre, jusque dans du code écrit
  après elle.
- **L'unité XP écrite en toutes lettres** sous la barre de niveau (« 0 / 60
  **XP** vers le niveau 2 »), vérifié en situation sur l'atelier — l'ancien
  « 0 / 60 vers le niveau 2 » sans unité (constat 3 de l'audit précédent) a
  disparu.
- **Le glossaire partagé, étendu plutôt que dupliqué** : `écusson` et
  `laurier` rejoignent la même liste que `coup d'œil` et `XP`, avec la même
  contrainte (`mots.test.ts` : une phrase courte, jamais de règle des
  Divins) — la discipline tient, seule sa pose sur les nouveaux écrans
  manque (constats 1 et 3).
- **Chaque nouveau panneau de `/profil` explique son mot en une phrase
  locale avant de le montrer** (« Mon titre », « Le fond de ma carte », « Ma
  finition ») : c'est exactement le modèle que l'audit précédent recommandait
  de généraliser, et les auteurs des deux PR l'ont suivi spontanément.
- **La consigne pour l'IA** (`consigne.ts`) ne promet rien que la réserve
  refuserait (CLAUDE.md, piège dédié) — vérifié en relisant le format
  qu'elle décrit contre `parseImportedQuestions`.

## Recommandations, dans l'ordre

1. Poser `<Glossaire>` sur `CarteJoueur.tsx` — P2 · S.
2. Ajouter un `<title>` au `<svg>` du laurier — P2 · S.
3. Ajouter l'entrée `fond` au glossaire partagé — P3 · S.
4. Aligner `Apparence.tsx:224` sur ses deux jumeaux épicènes — P3 · S.
5. Reformuler « Un soir de soirée compte aussi » — P3 · S.
6. Reformuler l'écran vide du quiz du jour sans « réserve » — P3 · S.
7. Apostrophes droites de `consigne.ts`, et le test d'inventaire suggéré par
   l'audit précédent (toujours pas écrit) — P3 · S/M selon l'étendue du test.

Tout tient dans un seul lot d'une demi-journée : aucune règle touchée, aucun
barème, rien à `VERSION_BAREME` — seulement du texte et un `<title>`.

## Limites

- L'atelier a été redémarré en cours de mission (limite d'usage de la
  session) ; je n'ai vérifié en situation que la page `/profil` (capture à
  l'appui) avant la coupure. Les constats 1, 2, 5 et 6 sont vérifiés par
  lecture complète du fichier, sans ambiguïté de chemin de code, mais pas
  rejoués à l'écran après coup — la machine étant chargée, je n'ai pas rouvert
  d'appareil pour le seul confort d'une seconde capture.
- Le script d'inventaire hérité de l'audit précédent rate les titres d'un
  seul mot commençant par une élision (« L'Assidu », « L'Invincible ») : sa
  règle « ressemble à une phrase » exige soit un espace, soit une majuscule
  suivie d'une minuscule, ce qu'une apostrophe après la première lettre
  empêche. Je l'ai compensé par une relecture manuelle du diff de
  `shared/hautsfaits.ts` et `server/src/core/stats.ts`, mais un titre isolé
  de ce type ailleurs dans les 60 fichiers a pu m'échapper.
- Les constats d'accessibilité déjà réunis dans `export/evaluations/rapports/accessibilite.md`
  et `design-recompenses.md` touchent parfois les mêmes fichiers
  (`CarteJoueur.tsx`, `Ecusson.tsx`) sous un angle différent (contraste,
  piège de focus, rôle ARIA) : je ne les reprends pas ici, même quand ils
  citent la même ligne.
- Je n'ai pas joué le quiz du jour jusqu'à une médaille ni jusqu'à un palier
  qui tombe (L'Assidu, Le Champion du jour, Le Sans-Faute) : leurs textes
  sont vérifiés par lecture du composant `Palier` (`JourApp.tsx`), pas par
  un déclenchement réel.
