# L'accueil compact : tout sur un écran — la maquette (9 novembre 2026)

« J'aimerais revoir la visualisation de l'accueil pour qu'elle soit plus
compacte. Je ne veux pas revoir le style car je trouve cela bien mais
j'aimerais que tout soit visible sans avoir à scroll plus bas » (le
propriétaire).

## La décision : les lignes

« Je valide les lignes, tu peux les implémenter. Suit tes recommandations »
(le propriétaire, le 9 novembre 2026). C'est fait, le lendemain : la
proposition 1 est dans l'application — plus derrière le drapeau
`quizz.maquette`, que le code livré n'a pas. Tout ce qui suit cette section
est la maquette telle qu'elle a été présentée, gardée comme trace, sous un
titre ajouté pour l'en séparer (« La maquette ») ; une seule phrase y a été
corrigée, et elle le dit (« Les lignes courtes »).

Deux suites, le 10 novembre 2026, sur ce que la livraison avait mesuré (le
propriétaire : « applique aussi tes recommandations ») : la ligne des duels
dit d'abord ce que la semaine attend encore (le point 3), et l'affiche d'une
nouveauté se couche en bandeau sur un téléphone (« L'affiche, couchée en
bandeau », sous le tableau des mesures).

Ce que les cinq points « À trancher » sont devenus, par les recommandations :

1. **Les lignes.** Une carte par section (`.jouer-carte`), ses boutons
   dedans, un filet entre eux, une seule ligne de texte sous chaque titre ;
   « Entre amis », une carte coupée en deux (`.jouer-carte.jouer-duo`) :
   « Créer un salon » et « Rejoindre une soirée » côte à côte, leur nom seul
   sous 720 pixels de haut — leur ligne cachée à l'œil, encore lue par le
   lecteur d'écran —, leur ligne au-delà. Mêmes boutons, mêmes noms, mêmes
   adresses, même ordre.
2. **Les onglets s'en vont.** Le quiz du jour et le défi de la semaine sont
   deux lignes de la carte « Seul », toutes deux visibles, chacune sa
   pastille (« À jouer », « À relever », « À finir »). La tuile à deux
   onglets (`components/JourEtDefi.tsx`, `.jour-defi`) est supprimée, avec le
   point d'or d'un onglet (`Onglet.point`, `.onglet-point`), qui n'avait pas
   d'autre lecteur. La décision du 19 octobre 2026 — montrer le défi sans
   prendre un bouton de plus — est tenue autrement : en lignes, les deux
   tiennent dans la place de la tuile, sans onglet à toucher. Le défi fermé
   seul (maintenance) éteint sa ligne, sans pastille.
3. **Les mots du tableau, en deux temps** (`LigneDuBouton` ; `GrosBouton`
   `suite`) : `detail`, l'essentiel — une trentaine de caractères au plus, qui
   tiennent à côté d'une pastille en 360 de large — ; `suite`, ce que la
   phrase ajoute, morceau par morceau. Sur l'accueil, la feuille ne montre
   que les morceaux qui tiennent entiers sur la ligne — jamais une phrase
   coupée au milieu d'un mot —, et le lecteur d'écran lit toute la phrase.
   Une phrase d'avant dont le début disait l'essentiel est restée, coupée à
   ses jointures (« Ligue d'or · cote 1084 » | « · encore 3 duels pour ta
   récompense » — jusqu'au 10 novembre 2026, plus bas ; « 9 joueurs l'ont
   relevé » | « · jusqu'à dimanche » ; « Défie qui tu veux » | « , ou
   Automate » | « : monte de ligue » ; « En maintenance » | « : reviens un
   peu plus tard ») ; les autres ont pris les
   mots du tableau (« Palier 5 de la forêt » | « · 12 vies » ; « Une série
   sans fin, des portraits » | « à gagner » ; « Épreuve en cours » |
   « · 12 vies » | « · palier 5 de la forêt » ; « Série de 12 jours », « Dix
   questions pour tous », « Joué · série de 13 jours », « 🎃 Un timbre à
   gagner » | « · série de 12 jours » ; « Relevé · 4ᵉ place sur 10 » |
   « · 8 bonnes réponses », « À toi d'ouvrir le bal » | « · jusqu'à
   dimanche » ; « Un légendaire au bout » | « · trois actes, trois
   gardiens » ; « Tu lances les quiz » | « : tu joues, ou tu animes » ;
   « Code ou QR de l'hôte »). « encore 3 duels pour ta récompense » revenait
   donc là où la rangée a la place — mesuré : sur une tablette ou un
   ordinateur, pas sur un téléphone. **Corrigé le 10 novembre 2026**, à la
   demande du propriétaire : ce que la semaine attend encore ne se lisait
   sur aucun téléphone. Tant qu'il reste des duels à jouer pour la
   récompense de lundi, c'est elle que la ligne dit d'abord — « Encore
   3 duels pour ta récompense » | « · ligue d'or » | « · cote 1084 »
   (« Encore 1 duel… » au singulier) : le blason de la ligne dit déjà la
   ligue ; la récompense acquise, « Ligue d'or · cote 1084 » | « · +30
   confettis lundi », comme avant (`boutonDesDuels`).
4. **Dans un navigateur, sur le petit téléphone, la ligne du lendemain et
   « Installer l'application » restent sous les boutons** : des lignes de
   passage — sept jours pour l'une, jusqu'à l'installation pour l'autre. La
   page défile pour elles de 78 pixels en 360 × 640, de rien en 390 × 844.
5. **Une soirée où revenir, sur le petit téléphone** (moins de 720 pixels de
   haut) : « Revenir chez Hugo » prend la place d'« À la une » le temps de la
   soirée (`.accueil:has(.gros-principal) .une-cadre`) — avec elle, 39 pixels
   passaient sous le menu.

Où vit le code, maintenant :

- `client/src/components/AccueilDesRoles.tsx` — `AccueilJouer`, la ligne de
  chaque bouton (`LigneDuBouton`, `boutonDeLaCampagne`, `boutonDuJour`,
  `boutonDuDefi`, `boutonDesDuels`, `boutonDuCabinet`) ;
  `client/src/components/Pieces.tsx` — `GrosBouton` et sa `suite`.
- `client/src/styles.css`, le bloc « L'accueil compact », en fin de feuille :
  tout se règle par des variables posées sur `.accueil` (`--accueil-rang`,
  48 pixels, la hauteur minimale d'une ligne ; `--accueil-plafond`, 800…), à
  trois pas de hauteur — le petit téléphone, un écran moyen (720 et plus), un
  grand (820 et plus), où le haut reprend ses tailles d'avant tant que rien
  ne s'ajoute à la page. La page prend la hauteur de l'écran au-dessus de la
  barre du menu, et ses lignes, élastiques, se partagent ce qui reste.
- `server/test/accueil-compact.test.ts` — la structure en cartes, l'absence
  d'onglets, les mots de chaque ligne, les gardes de la feuille.
- `server/scripts/rendu-accueil.ts` — les photos et les mesures, à la place
  de `maquette/photos.ts` : `cd server && npx tsx scripts/rendu-accueil.ts
  ../export/accueil`, le client construit d'abord (`SEULEMENT=habituee,chargee`
  pour quelques cas). Il photographie chaque cas à chaque taille, dit ce qui
  passe sous le menu, la hauteur des lignes, ce qui est coupé au bout, les
  suites montrées, et sort en erreur si un cas qui doit tenir — l'habituée,
  le débutant, l'Ivoire, et depuis le 10 novembre 2026 l'affiche d'une
  nouveauté — défile ou déborde.
- `client/src/components/AfficheDeLaNouveaute.tsx` — l'affiche d'une
  nouveauté et ses deux formes (`forme`, `ECRAN_COURT`) ; son bandeau dans
  `client/src/styles.css` (« Couchée en bandeau ») ;
  `server/test/affiches.test.ts` garde ce que la feuille ne doit pas perdre
  en la couchant.
- La règle `.claude/rules/profil.md` en garde le détail et les pièges ; la
  décision, `docs/architecture/decisions.md` (« L'accueil d'un profil tient
  sur un écran, ses boutons en lignes »).

Mesuré au navigateur sur la version livrée (`rendu-accueil.ts`), en pixels.
« Avant » reprend le tableau « Ce qui défile encore », plus bas : le contenu
sous la barre du menu. « Livré » est ce dont la page défile : ce contenu, et
les 13 pixels de marge sous le dernier bloc.

| Cas | Écran | Avant | Livré |
|---|---|---|---|
| Léa, l'habituée | 360 × 640 | 521 | 0 — des lignes de 48-49 px |
| | 360 × 740 | 421 | 0 — 57-58 px |
| | 390 × 844 | 213 | 0 — 65-66 px |
| | 412 × 915 | 123 | 0 — 70-71 px, la page s'arrête à son plafond |
| Tom, le débutant | 360 × 640 | 475 | 0 |
| | 390 × 844 | 202 | 0 |
| Léa sous l'Ivoire | 360 × 640 | 521 | 0 |
| Une journée chargée | 360 × 640 | 600 | 0 — 39 à la maquette (le point 5) |
| | 390 × 844 | 317 | 0 |
| Dans un navigateur, au lendemain d'une soirée | 360 × 640 | 638 | 78 — les 65 de la maquette, et la marge (le point 4) |
| | 390 × 844 | 331 | 0 |
| Le texte agrandi à 130 % | 360 × 640 | 835 | 125 — les 112 de la maquette, et la marge |
| L'affiche d'une nouveauté, à la place d'« À la une » | 360 × 640 | pas mesuré | 179 — les duels à moitié, le Cabinet et « Entre amis » dessous ; 0 depuis le 10 novembre, en bandeau |
| | 390 × 844 | pas mesuré | 67 — « Entre amis » ; 0 depuis le 10 novembre, en bandeau |

L'affiche d'une nouveauté était le seul cas que la maquette n'avait pas
photographié, et le seul qui faisait encore défiler un téléphone
d'aujourd'hui : une grande affiche, voulue telle (le 1er novembre 2026), le
temps qu'on aille sur sa page ou qu'on la range (« Plus tard »). À côté de sa
pastille « Nouveau », « Le Cabinet de curiosités » passait aussi sur deux
lignes. La resserrer sur le petit téléphone restait à décider.

### L'affiche, couchée en bandeau (le 10 novembre 2026)

« Applique aussi tes recommandations » (le propriétaire, le 10 novembre
2026). Sous 940 pixels de haut ou 600 de large — tous les téléphones —,
l'affiche se couche en bandeau à la place d'« À la une »
(`AfficheDeLaNouveaute`, `forme`, `ECRAN_COURT` ; `.affiche-bandeau`) : la
même affiche — sa nuit, son or, ses gardiens, les mêmes mots, le même lien —
sur une rangée, sa scène et « Nouveau » à gauche, son titre et son geste à
droite, « Plus tard » au coin ; le bandeau entier mène à la page. Sa phrase
ne se montre qu'en grand, le lecteur d'écran la lit toujours ; ses confettis
se disent en deux temps (« +50 confettis », « à ta première visite »), des
morceaux entiers ou rien ; un titre n'est jamais coupé. Au-delà — une
tablette debout, un grand écran —, l'affiche entière.

Avec elle, sur l'accueil : la page se resserre de deux pixels entre ses blocs
quand le bandeau s'y montre (`.accueil:has(.affiche-bandeau)`, sous 820
pixels de haut) ; « Nouveau », sur la ligne d'une page à l'affiche, perd son
étincelle sous 412 pixels de large — avec elle, « Le Cabinet de curiosités »
passait sur deux lignes, et sa rangée poussait « Entre amis » sous le menu ;
et sur le petit téléphone, une soirée où revenir prend la place de l'affiche
comme celle d'« À la une ».

Mesuré le 10 novembre 2026 (`rendu-accueil.ts`, les cas `affiche`,
`affiche-duels`, `affiche-longue` et `affiche-entiere`), en pixels :

| Affiche | Écran | Sa hauteur | Sous le menu |
|---|---|---|---|
| Celle du Cabinet, telle que le QG la propose — un titre de 41 caractères, 50 confettis | 360 × 640 | 64, en bandeau — « · +50 confettis » à la suite de son geste | 0 — des lignes de 48-49 px |
| | 360 × 740 | 93 — « +50 confettis à ta première visite » dans son bouton d'or | 0 — 54-55 px |
| | 390 × 844 | 96 | 0 — 65-66 px |
| | 412 × 915 | 96 | 0 — 69-70 px |
| Celle des duels, sans peinture ni confettis | 360 × 640 | 64 | 0 |
| | 390 × 844 | 87 | 0 |
| La plus longue qu'on puisse écrire — un titre de 48 caractères en lettres larges, 500 confettis | 360 × 640 | 64 | 0 |
| | 390 × 844 | 118 — son titre sur trois lignes | 0 |
| En grand | 768 × 1024 | 237, l'affiche entière | 0 — il reste 132 px au-dessus du menu |

En 360 × 940, que le script photographie aussi, l'écran est haut mais
étroit : c'est encore le bandeau. Le script sort désormais en erreur si l'un
de ces cas défile ou déborde : l'affiche fait partie de ceux qui doivent
tenir.

Le prototype (`maquette/prototype.patch`) ne s'applique plus sur le code
livré : pour revoir les tuiles, la proposition écartée, « Rejouer la
maquette », en bas, dans un arbre à part aux commits qu'elle cite.

## La maquette

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
encore de lui. Une rangée de téléphone n'a pas la place de le redire, une
tuile encore moins : la phrase entière fait 58 caractères, et une rangée de
390 de large en montre une quarantaine. Il ne revient que sur une tablette ou
un ordinateur, où la rangée est assez large. (Corrigé à la livraison, le
9 novembre 2026, sur ce que `server/scripts/rendu-accueil.ts` a mesuré : la
maquette disait « Une rangée de 390 de large a la place de le redire ; une
tuile, non. » Et depuis le 10 novembre 2026, il ne se perd plus : c'est lui
que la ligne des duels dit d'abord — « La décision », le point 3.)

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
