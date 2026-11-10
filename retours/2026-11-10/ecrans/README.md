# La revue des écrans : ce qui défile au téléphone

> « J'aimerais que tu passes en revue tous les écrans de l'application et que
> tu modifies ceux que tu trouves trop longs, ou [où] ça serait logique de tout
> voir sans scroller. » — le propriétaire, le 10 novembre 2026, au lendemain de
> l'accueil en lignes (`retours/2026-11-09/accueil-compact/`).

## Comment c'est mesuré

Chaque script de rendu de `server/scripts/` a été lancé tel quel, une sonde
préchargée (`reproductions/sonde.cjs`, par `NODE_OPTIONS=--require`) : à
chaque photo d'une page, elle note ce dont l'écran défile — le bas de ce que
la page montre vraiment (ce qu'un cadre coupe ou fait défiler en lui-même ne
compte pas, ni ce qui est fixe), comparé au pli : le bas de l'écran, moins la
barre du menu. Pour une feuille ouverte, ce dont elle défile en elle-même ;
pour le geste principal d'un écran, s'il se voit en entier.

Trente et un scripts (tous, sauf le QG, les thèmes et la vitrine), près de
sept cents photos de téléphone, presque toutes en 360 × 640 — le petit
téléphone de référence. Ce que la sonde ne voit pas : la barre d'adresse d'un
navigateur et l'encoche (Chromium sans écran n'en a pas), et un écran
qu'aucun script ne visite. Elle compte aussi ce qui est dans la page sans se
voir (le glossaire replié du profil) : un chiffre surprenant se vérifie sur
la photo.

```bash
npm run build -w client
retours/2026-11-10/ecrans/reproductions/releve.sh export/releve rendu-campagne.ts rendu-duels.ts
node retours/2026-11-10/ecrans/reproductions/ecrans.cjs export/releve/sonde   # écran par écran
node retours/2026-11-10/ecrans/reproductions/pouces.cjs export/releve/sonde   # le geste principal : vu, collé, caché
```

## Le critère

- **Un carrefour** (où aller), **un écran où l'on décide** (préparer un duel,
  ouvrir un salon) et **l'écran d'après une réponse** : ce qu'on vient y
  faire se voit sans défiler.
- **Une liste, un album, un catalogue, un classement, un historique, une
  correction, le récapitulatif de ce qu'une partie rapporte, un tableau du
  QG** défilent par nature : leur longueur est leur contenu. On n'y touche
  pas — mais le geste qui les suit ne doit pas se cacher dessous.

## Ce qui a été changé

| L'écran | Avant, en 360 × 640 | Après |
|---|---|---|
| L'accueil, l'affiche d'une nouveauté à la place d'« À la une » | la page défilait de 179 px (67 en 390 × 844) | l'affiche se couche en bandeau : 0 px sous le menu aux quatre tailles de téléphone (`rendu-accueil.ts`, les cas `affiche`) |
| L'accueil, la ligne des duels | « · encore 3 duels pour ta récompense » ne se montrait que sur tablette | la relance passe devant : « Encore 3 duels pour ta récompense » |
| « Mon profil », le carrefour (`/profil`) | ses six gros boutons empilés : la page défilait de 285 px, « Mes soirées » et « Ma carrière » sous le menu (72 px en 390 × 844) | en lignes dans une carte, comme à l'accueil : tout tient — 13 px au-dessus du menu en 360 × 640, 165 en 390 × 844 (`rendu-carrefour.ts`) |
| « Ma collection », le carrefour (`/profil#collection`) | ses huit lignes hautes de 84 à 125 px, trois lignes d'explication au-dessus : la dernière finissait à 1 162 px pour 575 visibles (587 px sous le menu, 319 en 390 × 844) | en lignes : le nom, le compte et la jauge, la phrase de chaque ligne sur un grand écran seulement, l'explication sous les listes — ses huit lignes au-dessus du menu, 9 px de libre en 360 × 640, 14 en 390 × 844 (`rendu-carrefour.ts`, les cas `collection`) |
| Toute page à menu, et toute page sous le bandeau du service | défilait de 72 px même à moitié vide (« Mes soirées » d'un nouveau venu, avec 325 px de libre), et de 58 de plus sous le bandeau — jusque sur l'écran d'une page en maintenance | la coquille de la page retranche la barre et le bandeau : une page dont le contenu tient ne défile plus, une page longue défile de ce qui dépasse |
| Après une réponse — révision, série, duel au dé ou contre quelqu'un, épreuve de sentier, étape de parcours, quiz du jour | « Question suivante » sous le pli : 122 px de page en trop en révision, 129 contre Automate, 139 en épreuve | le geste reste sous le pouce (`SousLePouce`) : collé au bas de l'écran quand la page est plus longue, à sa place sinon |
| « Défier Tom » (préparer un duel) | « Jouer le duel » au pli, 113 à 158 px de page en trop ; sous toute la liste des amis tant qu'on choisit (666 à 785 px) | sous le pouce |
| « Nouveau salon » | « Ouvrir le salon » à 365 px sous l'écran, 800 les équipes préparées | sous le pouce |
| La fin d'un duel (le verdict) | « Un autre duel », « Revanche » : de 54 à 656 px sous l'écran selon ce que le duel rapporte | sous le pouce |
| « Duel envoyé » | « Accueil » de 64 à 336 px sous l'écran | sous le pouce |
| La fin d'une série, d'une révision, d'un défi | « Rejouer », « Réviser encore », « Le classement du défi » : de 41 à 1356 px de page en trop selon les gains | sous le pouce |
| La fin d'une épreuve de sentier, d'une étape de parcours | « Jouer le palier 10 », « Le porter », « Jouer l'étape 2 » : 196 à 527 px de page en trop | sous le pouce |
| La campagne, l'onglet « Série » (le départ d'une série) | la ligne « Sur Toutes les catégories · Changer » sous l'écran : de 22 px pour qui n'a jamais joué, de 77 après ses bonnes réponses du jour, de 139 une série à reprendre — où « Une nouvelle série » y passait aussi, de 29 px (43 avec la niche du compagnon) | rien n'y change de place — les règles restent dans le panneau : sorties le matin dans une carte sous les gestes, le propriétaire les a voulues comme avant, « sobre », sans « un bloc en plus » — ; la page se resserre sur un téléphone et la ligne du choix ne grandit plus avec son texte : tout tient pour un nouveau venu et une habituée, « Mes records par catégorie » compris, de 360 × 640 à 412 × 915 ; une série à reprendre, le gros bouton et la ligne du choix partout, les records dès 740 px de haut (`rendu-serie.ts`) ; et l'attente a la forme de la page : plus rien n'y descend de 64 px à son arrivée |
| Le classement des collections | son podium finissait sous le menu partout, sauf sur le plus grand téléphone : de 289 px en 360 × 640, de 230 en 390 × 664, de 189 en 360 × 740, de 82 en 412 × 800, de 50 en 390 × 844 | rien n'y change de place : sa place, les Divins, les puces et le podium au-dessus du menu aux six tailles — 21 px de libre en 360 × 640, 86 en 390 × 844 (35 sous l'encoche) ; les sept puces sur deux rangées au lieu de trois, le titre sur une ligne ; sa liste, elle, défile par nature (`rendu-collectionneurs.ts`, les états `25-…`) |
| « M'habiller » (la loge), la pièce « Avatar » | une habituée ne voyait pas un seul de ses avatars sans défiler, sur aucun téléphone : ses gemmes finissaient à 802 px et la première rangée de sa grille à 886, pour 575 visibles en 360 × 640 (779 en 390 × 844, 850 en 412 × 915) | rien n'y change de place : sa finition, sa bordure, son sceau et ses gemmes tiennent partout (à 2 px du menu en 360 × 640, 227 dessous avant), puis une rangée de ses avatars en 360 × 740 et en 412 × 800, deux en 390 × 844, trois en 412 × 915 ; ce que la bordure et le sceau disent tient sur une ligne, en morceaux entiers (`rendu-loge.ts`) |
| « Mon compagnon » | 951 px de page en 360 × 640 pour 575 visibles : 407 px à faire défiler — ses envies coupées de 4 px, son chemin et « Tes compagnons » dessous ; 973 pour 850 en 412 × 915 | rien n'y change de place : tout tient et la page ne défile plus dès 360 × 740 (8 px de libre, 51 en 390 × 844, 16 sous l'encoche, 44 en 412 × 915) ; en 360 × 640 et en 390 × 664, sa scène, ses envies et son chemin tiennent, « Tes compagnons » se lit dessous (99 et 90 px à faire défiler). Sa scène ne rapetisse pas : son cadre se rogne par le bas (`rendu-compagnon.ts`, la passe `tailles`) |
| Le choix des cartes d'une traversée du Cabinet (« Avant de partir — Choisis trois cartes ») | ses dix lignes de 90 à 112 px, leur description sur deux ou trois lignes : l'écran, 1 212 px pour 640, défilait de 652 px dans son cadre — on y voyait trois cartes —, de 426 en 390 × 844, de 333 encore en 412 × 915 | rien n'y change de place : les dix cartes et le bouton du pied sur un écran aux six tailles, des lignes de 47 px en 360 × 640 (7 px de jeu en tout), de 60 en 390 × 844 (52 sous l'encoche) ; la description d'une carte sur une ligne, coupée au bout — neuf sur dix en 360 de large, six en 390 —, sur deux dès 412 × 800 où toutes se lisent entières ; sa phrase entière reste dans « Voir » et à l'oreille ; aucun texte sous 17 px (`rendu-traversee.ts`, `SEULEMENT=cartes`) |
| Une page dont le contenu tient, à moins d'une marge du bas de l'écran — la révélation d'une soirée au téléphone d'un invité, « Pas cette fois », une étape de parcours, la question bonus du quiz du jour, « Ton équipe », un duel reçu, une question du Cabinet | défilait de sa marge du bas, pour ne montrer que du vide : de 25 et 26 px à la révélation, 20 à « Pas cette fois », 28 à l'étape et à la question bonus, 25 à « Ton équipe », 17 au duel reçu, 19 au Cabinet (en 390 × 844, 22 à « Palier validé », 25 à « Entre amis ») | la marge se resserre — un ressort et une rallonge, la règle `.claude/rules/css.md` les raconte, `server/test/marge-du-bout.test.ts` les garde, `reproductions/marge-du-bout.cjs` rejoue la loi au pixel : 0 px dès que le contenu tient, et une page plus longue que l'écran garde sa marge au bout. Restent : la révélation à quatre lignes, qui dépasse vraiment de 19,5 px (39 px au lieu de 47 — la sonde lit le dernier texte, pas la dernière boîte) ; « Le Pari » du Cabinet sous une carte-bonus, sa quatrième réponse sous le pied collé (61 px) ; et sous l'encoche d'un iPhone, la marge d'un invité, qui est l'encoche même |

Le geste « sous le pouce » : la règle `.claude/rules/css.md` le raconte,
`server/test/sous-le-pouce.test.ts` le garde. Mesuré après : sur les
quarante-sept écrans photographiés qui en ont un, il se voit en entier
partout — collé sur trente-trois, à sa place sur quatorze, où rien n'a
changé au pixel.

## Ce qui défile par nature (relevé, laissé)

- **Les listes et les albums** : la boutique (2 900 px), les albums de « Ma
  collection », une ligne dépliée (900 à 3 900 ; son carrefour, replié, tient
  depuis), la liste des collectionneurs (470 à 1 260 — ce qui la précède,
  podium compris, tient depuis), l'historique et
  le classement des duels, le carnet et les parcours de thème, la carte des
  douze sentiers (530 à 800 — son bloc du haut tient l'écran, son geste
  compris) et un sentier (1 090), « Mes quiz » et l'éditeur, les grilles de
  la loge (ce qui les précède tient depuis).
- **Les récapitulatifs** : la fin du quiz du jour (1 100 à 1 700 : sa note, ses
  gains, le classement, la plume), le défi relevé, les corrections (« Mes
  réponses », 2 200 à 3 000), le souvenir d'une soirée.
- **La salle** : la salle d'attente, le podium d'un quiz, la révélation d'une
  question aux textes les plus longs (les « pires cas » de `rendu-ecran.ts`) ;
  un invité y suit l'écran commun, et rien ne s'y décide en bas de page.
- **Le QG** : des tableaux de bord.
- **L'Expédition** : son départ est fermé (le Cabinet l'a remplacée) ; ses
  écrans ne sont plus servis à personne de neuf.
- **Le Cabinet de curiosités** : ses pages tiennent (0 px partout, son pied
  de partie collé). La sonde n'y mesurait que ce dont la page défile : le
  choix des cartes d'une traversée, lui, défilait dans son cadre — de 652 px
  en 360 × 640 —, et la revue l'avait dit tenu. Il est au tableau plus haut.

## Ce qui reste

- **Le départ d'une série, une série à reprendre** : sous 740 px de haut,
  « Mes records par catégorie » passe sous l'écran (47 px en 360 × 640, 23
  dans Safari sur un iPhone) — un bouton de plus au-dessus du gros. Et sous
  le bandeau du service (58 px, posé par l'administrateur en cas de panne),
  avec la niche du compagnon, la ligne du choix passe de 56 px sous l'écran
  en 360 × 640 ; le gros bouton reste entier.
- **Le « presque » des trois écrans du profil**, sur les plus petits
  téléphones : au classement des collections, sous un thème à police large,
  le podium passe encore sous le menu en 360 × 640 (de 11 px sous le Carnet à
  55 sous la Game Boy) ; dans la loge, la grille d'une habituée reste sous le
  menu en 360 × 640 et en 390 × 664, et sa pièce la plus longue — douze
  finitions, un Éclat en réserve, sept pages d'avatars — ne tient sur aucun
  téléphone (3 px sous le menu en 412 × 915, 209 avant) ; chez le compagnon,
  « Tes compagnons » reste dessous en 360 × 640 et en 390 × 664, et un
  vétéran au bout de son chemin, ses trois envies à combler, a une ligne de
  plus (« Amis pour la vie », sur deux) : en 360 × 740, le cadre de « Tes
  compagnons » passe de 5 px sous le menu, sans une ligne de texte (l'état
  `veteran` de `rendu-compagnon.ts`).
- **Le texte agrandi à 130 %**, en 360 × 640 : l'accueil défile encore de
  125 px, le carrefour du profil de 42. Leurs lignes grandissent avec le
  texte, c'est voulu ; elles ne tiennent plus toutes. Au départ d'une série,
  une série à reprendre, la ligne du choix passe de 52 px sous l'écran ; le
  gros bouton reste entier. Le choix des cartes du Cabinet défile encore de
  89 px (1 114 avant), son bouton collé au pied.
- **Le choix des cartes du Cabinet, sous 633 px de haut** en 360 de large —
  un petit téléphone dans un navigateur, ses barres dépliées — : la liste
  défile dans son cadre de ce qui manque. Et ses descriptions coupées au
  bout sur un téléphone étroit sont le prix du « tout sur un écran » : des
  phrases plus courtes, écrites pour la liste, tiendraient entières — un
  choix de mots, donc du propriétaire.
- **Sur un vrai téléphone** : la barre d'adresse d'un navigateur retire de la
  hauteur que Chromium sans écran ne retire pas. L'encoche, elle, se mesure
  (`ENCOCHE=47`) : l'accueil et le carrefour tiennent en 390 × 844,
  l'application installée. Les pas de hauteur de l'accueil (720, 820) et le
  bandeau (940) se regardent aussi dans le navigateur.
- **Relevé en passant, laissé** : sur un navigateur neuf, « Mon compagnon »
  arrive au carrefour une image après les autres boutons (la niche se pose
  après le premier dessin) ; le QG, à l'ordinateur, défile encore de la
  hauteur du bandeau du service ; avec l'encoche, un bouton du rayon des
  compagnons de la boutique passe sous la niche.
