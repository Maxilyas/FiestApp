# L'accueil compact : tout sur un écran — la maquette (9 novembre 2026)

« J'aimerais revoir la visualisation de l'accueil pour qu'elle soit plus
compacte. Je ne veux pas revoir le style car je trouve cela bien mais
j'aimerais que tout soit visible sans avoir à scroll plus bas » (le
propriétaire).

Une maquette : deux dispositions compactes posées dans le vrai code de
l'accueil, derrière un drapeau du téléphone (`quizz.maquette` : `lignes`,
`tuiles`), photographiées sur un serveur jetable du petit téléphone de
référence (360 × 640) au grand (412 × 915), puis rangées sur une planche. Le
prototype vit dans `maquette/prototype.patch` ; le code de l'application ne
change pas tant que rien n'est choisi.

Léa, la joueuse photographiée, est une habituée : son loup dans sa niche,
douze jours de quiz du jour, un sentier qu'elle avance, sa ligue aux duels, un
coffre qui l'attend, le défi de la semaine relevé par neuf joueurs.

## L'état des lieux

Ce qui reste sous la barre du menu aujourd'hui — le contenu qu'il faut faire
défiler pour voir :

| Écran | Contenu | Visible | Sous le menu |
|---|---|---|---|
| 360 × 640 | 1096 px | 575 px | **521 px** — le quiz du jour à moitié, les duels, le Cabinet, tout « Entre amis » |
| 360 × 740 | 1096 px | 675 px | **421 px** |
| 390 × 844 | 992 px | 779 px | **213 px** — tout « Entre amis » |
| 412 × 915 | 973 px | 850 px | **123 px** — « Créer un salon », « Rejoindre une soirée » |

Où part la hauteur, en 360 × 640 :

| Bloc (px) | Aujourd'hui | Lignes | Tuiles |
|---|---|---|---|
| Soi et « Amis » | 77 | 59 | 59 |
| À la une | 80 | 54 | 54 |
| Missions du jour | 76 | 44 | 44 |
| La campagne | 94 | 48 | 49 |
| Quiz du jour · défi de la semaine | 162 | 98 | 86 |
| Duels · Cabinet | 234 | 98 | 86 |
| Entre amis | 200 | 51 | 54 |
| Titres de section, écarts, marges | 173 | 110 | 130 |
| **Total** | **1096** | **562** | **562** |

Deux causes. Le haut — soi, « À la une », les missions — prend 285 des 575
pixels visibles avant le premier bouton. Et chaque gros bouton passe sur deux
ou trois lignes de texte en 360 de large : 94 à 162 pixels chacun, pour 76
prévus.

## La planche

Tout se regarde sur la planche Design, privée :
<https://claude.ai/artifact/VCoqAJ3XwzQG7wArRmutTB>

- **En un coup d'œil** — l'accueil d'aujourd'hui et les deux propositions, en
  360 × 640.
- **Aujourd'hui, en entier** — la page déroulée, le haut du menu marqué d'un
  trait, et les deux tableaux d'au-dessus.
- **Proposition 1 — Les lignes** et **Proposition 2 — Les tuiles** — chacune
  à quatre tailles : 360 × 640, 360 × 740, 390 × 844, 412 × 915.
- **Débutant et Ivoire** — Tom, qui vient de créer son profil, sans
  compagnon ; Léa sous l'Ivoire.
- **Une journée chargée** — une soirée où revenir, un duel joué, le carnet,
  le défi commencé, le Cabinet en route.
- **Navigateur et texte agrandi** — ce qui défile encore.

Les photos n'existent que là (et dans `export/`, qui ne se committe pas).

## Dans les deux cas

- **Rien du style ne change** : la ligne de soi, « À la une », la ligne des
  missions, des boutons à pastille ronde et titre en serif, les pastilles
  d'or, le compteur rouge. Les mêmes composants, les mêmes jetons — l'Ivoire
  s'habille sans une règle de plus —, d'autres mesures et une autre place.
- **Les mêmes boutons, les mêmes noms, les mêmes adresses**, dans le même
  ordre : la tablée et les tests qui les touchent par leur nom les
  retrouvent.
- **Le haut a trois tailles**, selon la hauteur de l'écran. Serré sous 720
  pixels : soi en 59 (sa niche tient le coin jusqu'à 82 pixels du haut, la
  ligne s'arrête avec elle), « À la une » en 54 — son dessin à l'échelle, ses
  trois lignes serrées, sa flèche retirée : son nom, coupé aujourd'hui (« Le
  Chat des lanter… »), tient —, les missions en 44, leur seconde ligne coupée
  au bout. Moyen de 720 à 819. À partir de 820, celui d'aujourd'hui, à ses
  mesures.
- **Une ligne courte par bouton** (plus bas) : une seule ligne sous le titre
  dans une rangée, deux au plus dans une tuile.
- **Le quiz du jour et le défi de la semaine se montrent tous les deux.** La
  tuile à onglets (le 19 octobre 2026) faisait voir le défi sans prendre un
  bouton de plus ; compacts, les deux tiennent dans sa place, et le défi se
  voit sans toucher un onglet.
- **« Entre amis » : deux boutons côte à côte**, leur nom seul sous 720
  pixels de haut, leur ligne au-delà.
- **Des rangées élastiques.** La page prend la hauteur de l'écran, au-dessus
  de la barre du menu ; ses rangées partent de leur minimum (48 pixels, une
  cible de doigt) et se partagent ce qui reste, jusqu'à un plafond (800
  pixels de page pour les lignes, 744 pour les tuiles : au-delà, le fond
  continue). Ce qui s'ajoute — une soirée où revenir, la ligne du lendemain,
  l'application à installer — les resserre d'abord, et sur un grand écran
  ramène le haut à sa taille moyenne ; la page ne défile que si leur minimum
  même ne tient plus.

### Les lignes courtes

| Bouton | Aujourd'hui | Compact |
|---|---|---|
| La campagne | Vers le palier 5 de la forêt · 12 vies | Palier 5 de la forêt · 12 vies |
| | Une série sans fin, ou des portraits à gagner | Une série sans fin, des portraits |
| | 7 questions de ton carnet t'attendent : revois-les pour les apprendre | 7 questions de ton carnet — sa pastille dit « À revoir » |
| | Ton épreuve t'attend : palier 5 de la forêt · 12 vies | Épreuve en cours · 12 vies |
| Le quiz du jour | Dix questions, les mêmes pour tous · série de 12 jours | Série de 12 jours — sans série : Dix questions pour tous |
| | Joué aujourd'hui · série de 13 jours | Joué · série de 13 jours |
| | 🎃 Halloween : un timbre à gagner · série de 12 jours | 🎃 Un timbre à gagner |
| Le défi de la semaine | 9 joueurs l'ont relevé · jusqu'à dimanche | 9 joueurs l'ont relevé |
| | 4 bonnes réponses : reprends-le | 4 bonnes réponses — sa pastille dit « À finir » |
| | 8 bonnes réponses · 4ᵉ place sur 10 | Relevé · 4ᵉ place sur 10 |
| Les duels | Ligue d'or · cote 1084 · encore 3 duels pour ta récompense | Ligue d'or · cote 1084 |
| | +30 confettis pour ta semaine en ligue d'or · encore 3 duels pour la prochaine | Ligue d'or · +30 confettis reçus |
| | Hugo te défie, et 2 autres : à toi de jouer | Hugo te défie, et 2 autres |
| | Ton duel contre Hugo t'attend | Contre Hugo : à finir |
| | Défie qui tu veux, ou Automate : monte de ligue | Défie qui tu veux |
| Le Cabinet de curiosités | Trois actes, trois gardiens, un légendaire au bout | Un légendaire au bout |
| Créer un salon | Tu lances les quiz : tu joues, ou tu animes | Tu lances les quiz |
| Rejoindre une soirée | Avec son code, ou le QR de l'hôte | Code ou QR de l'hôte |

Ce qui se perd : « jusqu'à dimanche », « les mêmes pour tous », « reprends-le »,
et surtout « encore 3 duels pour ta récompense » — ce que la semaine attend
encore de lui. Une rangée de 390 de large a la place de le redire ; une tuile,
non.

## Proposition 1 — Les lignes

Une carte par section, ses boutons en lignes, un filet entre eux : le cadre de
la tuile à onglets (`.jour-defi`), étendu à toute la section. Chaque ligne
garde la forme d'un gros bouton — sa pastille ronde, son titre sur une ligne,
ce qui s'y passe dessous, sa pastille ou son chevron à droite. « Entre amis »
est une carte elle aussi, coupée en deux. Le compteur rouge se pose sur
l'épaule de la pastille ronde, comme celui de « Profil » dans le menu ; la
ligne allumée garde son or, sans son halo, qui mordrait sur ses voisines.

Des lignes de 49 pixels en 360 × 640, 58 en 360 × 740, 64 en 390 × 844, 69 en
412 × 915.

- Pour : c'est l'accueil d'aujourd'hui, resserré — même ordre, titres sur une
  ligne, pastilles au même endroit, rien à réapprendre. Elle tient le mieux
  au texte agrandi, aux noms longs, et à un mode de plus (une ligne de 48
  pixels).
- Contre : une liste, plus sage que des gros boutons ; sur le petit
  téléphone, les lignes sont à leur minimum.

## Proposition 2 — Les tuiles

La campagne garde sa rangée, en tête comme aujourd'hui ; les autres modes
vont deux par deux — le quiz du jour à côté du défi, la paire que tenaient les
onglets, puis les duels et le Cabinet. Dans une tuile, la pastille ronde et le
titre sur une ligne, ce qui s'y passe dessous sur toute la largeur ; ce qui
attend (« À jouer », « À relever », « Résultat », « En route ») se pose à
cheval sur le bord du haut, comme le compteur rouge sur le coin. Une tuile
seule sur sa rangée — un mode fermé, un de plus — la prend entière. Une tuile
est étroite : sa pastille ronde et son titre se règlent sur la largeur de
l'écran (plus grands dès 384 pixels), pas sur sa hauteur — réglés sur la
hauteur, « Le Cabinet de curiosités » passait sur trois lignes en 360 × 740.

Des tuiles de 86 pixels en 360 × 640, 101 en 360 × 740, 107 en 390 × 844 et
au-delà.

- Pour : plus de relief, des cibles plus larges, plus près des gros boutons ;
  la page remplit l'écran.
- Contre : en 360 de large, les titres passent sur deux lignes (« Le quiz /
  du jour ») ; la pastille à cheval est une place nouvelle ; les lignes sont
  plus courtes encore ; et c'est elle qui tient le moins bien au texte
  agrandi.

## Ce qui défile encore

Le contenu sous la barre du menu, en pixels — zéro : tout se voit sans
défiler.

| Cas | Écran | Aujourd'hui | Lignes | Tuiles |
|---|---|---|---|---|
| Léa, l'habituée | 360 × 640 | 521 | 0 | 0 |
| | 360 × 740 | 421 | 0 | 0 |
| | 390 × 844 | 213 | 0 | 0 |
| | 412 × 915 | 123 | 0 | 0 |
| Tom, le débutant | 360 × 640 | 475 | 0 | 0 |
| | 390 × 844 | 202 | 0 | 0 |
| Léa sous l'Ivoire | 360 × 640 | 521 | 0 | 0 |
| Une journée chargée | 360 × 640 | 600 | 39 | 22 |
| | 390 × 844 | 317 | 0 | 0 |
| Dans un navigateur, au lendemain d'une soirée | 360 × 640 | 638 | 65 | 61 |
| | 390 × 844 | 331 | 0 | 0 |
| Le texte agrandi à 130 % | 360 × 640 | 835 | 112 | 212 |

- **Une journée chargée** : « Revenir chez Hugo » ajoute une rangée ; sur le
  petit téléphone, le bas de « Entre amis » passe sous le menu.
- **Dans un navigateur** : tous les boutons tiennent ; la ligne du lendemain
  (« Chez Hugo : le souvenir · mon bilan », sept jours) et « Installer
  l'application » (jusqu'à l'installation, ou « Ne plus afficher ») passent
  dessous.
- **Le texte agrandi** : la page défile, comme aujourd'hui — sept fois moins
  sous les lignes, quatre fois moins sous les tuiles.

Là où tout tient, il reste 13 pixels entre le dernier bouton et le menu. Sur
aucune photo la page ne déborde en largeur.

## Ma recommandation

Les lignes. C'est la disposition la plus fidèle à ce qu'on a — « je ne veux
pas revoir le style » —, la plus solide quand le texte grandit ou qu'un mode
s'ajoute, et la moins chère à faire : ni titres sur deux lignes, ni pastille à
une place nouvelle. Les tuiles se défendent si l'on veut garder du relief ;
elles demandent des lignes plus courtes encore.

## À trancher

1. Les lignes ou les tuiles.
2. Les onglets du quiz du jour et du défi s'en vont, les deux se voient : la
   décision du 19 octobre 2026 est tenue autrement.
3. Les lignes courtes (le tableau) : leurs mots, et si « encore 3 duels pour
   ta récompense » revient là où la rangée a la place.
4. Sur le petit téléphone, dans un navigateur, la ligne du lendemain et
   « Installer l'application » restent sous le menu : les laisser là, ou leur
   trouver une place au-dessus.
5. Une soirée en cours sur le petit téléphone : 22 à 39 pixels dépassent.
   « Revenir chez Hugo » pourrait prendre la place d'« À la une » le temps de
   la soirée.

## Ce que la vraie version demandera

Le prototype ne cherche que le rendu ; la vraie version, une fois choisie :

- **Les lignes courtes** entrent dans `boutonDeLaCampagne`, `boutonDuDefi`,
  `boutonDesDuels`, `boutonDuCabinet` à la place des longues, ou à côté ; les
  épreuves qui rendent ces boutons ou lisent leurs mots suivent
  (`campagne-ouverture.test.ts`, `cabinet-ecran.test.ts`,
  `cabinet-ouverture.test.ts`, `maintenance.test.ts`, `affiches.test.ts`,
  `navigation.test.ts`, `connexion-claire.test.ts`, `installation.test.ts`).
- **`JourEtDefi.tsx` s'en va**, avec `.jour-defi` et son point d'onglet à
  l'accueil ; les rendus qui touchent l'onglet du défi
  (`rendu-recompenses.ts`, `rendu-maintenance.ts`), les règles `profil.md`
  et `campagne.md` et `docs/produit/` (la campagne, le quiz du jour, le
  profil) racontent les deux onglets.
- **Les boutons fermés** — en maintenance, bientôt disponibles, « En test »,
  « Nouveau » — n'ont pas été photographiés : leur ligne (« En maintenance :
  reviens un peu plus tard ») est longue pour une rangée.
- **La place gardée du haut** (`.haut-en-chemin`) suit les trois tailles :
  rien ne doit sauter quand « À la une » et les missions arrivent — à
  vérifier image par image.
- **La niche** : la ligne de soi s'arrête un pixel sous elle ;
  `rendu-niche.ts` doit encore dire « rien sous la niche », à 0 et à 47
  pixels d'encoche.
- **Les pas se règlent sur la hauteur de l'écran** (`min-height` : 720, 820)
  et la page sur `100svh` : à regarder sur de vrais téléphones, dans un
  navigateur — sa barre d'adresse prend de la hauteur — et dans l'application
  installée.
- **Un mode de plus** (l'Expédition, si elle revient) : une ligne de 48
  pixels, qui dépasse en 360 × 640 ; une tuile seule sur sa rangée.
- **`design.test.ts`** relit les classes, les tailles de texte (aucune sous
  `--t-label` : la plus petite ici fait 0,74 rem) et l'or sur or pâle.

## Rejouer la maquette

Le patch s'applique sur `main` au soir du 9 novembre 2026 (les commits
`d0d29f5` et `ab4b9de` ; plus tard, dans un arbre à part : `git worktree
add`). Depuis la racine, avec le Chromium de Playwright (`npm root -g`) :

```bash
git apply retours/2026-11-09/accueil-compact/maquette/prototype.patch
npm run build -w client
cd server && npx tsx ../retours/2026-11-09/accueil-compact/maquette/photos.ts ../export/accueil-compact
```

Le patch posé, l'accueil d'un téléphone essaie une disposition par
`localStorage.setItem('quizz.maquette', 'lignes')` (ou `'tuiles'`). `git apply
-R` du même patch le retire. `SEULEMENT=habituee,chargee` ne photographie que
ces cas ; le second argument `avant`, que l'accueil d'aujourd'hui, sans le
patch.

| Fichier | Ce qu'il est |
|---|---|
| `maquette/prototype.patch` | les deux dispositions dans l'accueil (`AccueilDesRoles.tsx` : les lignes courtes, la carte, la grille), le drapeau (`ProfilApp.tsx`), leur feuille (`styles.css`, « Maquette : l'accueil compact ») |
| `maquette/photos.ts` | le serveur jetable, Léa et Tom, chaque cas sous chaque disposition, et les mesures de chaque photo (`mesures.json`) — la journée chargée réécrit la réponse de l'accueil en route |
