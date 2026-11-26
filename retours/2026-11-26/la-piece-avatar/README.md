# La pièce « Avatar » de la loge, repensée : des propositions

Le 26 novembre 2026. Le propriétaire, d'abord sur les motifs : « Dans
l'habillage, je pense qu'il ne faut pas afficher toutes les bordures que l'on
a mais uniquement celle sélectionnée, car il y en a 29, ça va surcharger la
page. Par contre ce que j'aimerais c'est pouvoir cliquer sur un bouton et
choisir la bordure que je possède » ; puis : « Finition / bordure fonctionne
de la même manière et potentiellement même le choix d'avatars. Tu pourrais me
faire une maquette innovante qui revoit la façon dont on gère cet onglet ? »

Ce dossier est une maquette : rien de `client/` ne bouge. `planche.ts` monte
chaque écran avec les vrais composants — la carte de la loge
(`CarteDeLaLoge`), la rangée des pièces, `Avatar` et ses finitions, ses
bordures, ses motifs, et pour « Aujourd'hui » les vrais panneaux
(`MesFinitions`, `MesBordures`, `MesMotifs`, `MonSceau`, `MesAvatars`) — sous
la vraie feuille de style, dans un cadre de 360 × 640 où les pas de hauteur
de la loge jouent comme sur un téléphone. Ce qui est neuf vit dans
`maquette.css`, préfixé `mq-`.

    cd server && npx tsx ../retours/2026-11-26/la-piece-avatar/planche.ts

Les mesures plus bas sont celles de ces cadres (le bas des gemmes, de la
première rangée d'avatars, le haut du menu à 573 px), que le script imprime.

## Le choix

Le même jour, devant la planche : « Je suis d'accord calques + tenues c'est
le top. Par contre je mettrais pas les tenues ici, mais plus dans un panneau
latéral rétractable. Pour les questions c'est quoi tes recommandations ?
J'aimerais bien voir une maquette du rendu final. » Les réponses et le rendu
final sont plus bas (« Le rendu final »).

## Le constat

La pièce empile un réglage par rangée — la finition, la bordure, le motif,
le sceau — et chaque rangée montre **tout** ce qu'on a. Elle tient pour une
habituée (ses gemmes à 513 px en 360 × 640, `rendu-loge.ts`), pas pour qui
collectionne : chaque niveau ouvre une finition, chaque ligue une bordure,
chaque coffre un motif.

Léa, la collectionneuse de la planche — niveau 38, neuf finitions, trois
bordures serties, vingt-deux motifs, quatre légendaires — : **ses gemmes
finissent à 765 px, 192 sous le menu, et sa première rangée d'avatars à
833** ; la page fait 983 px. Ses motifs prennent quatre lignes de pastilles,
ses finitions deux. Et ce sont les avatars — ce qu'on vient changer le plus
souvent — qui descendent (`planche-aujourdhui.jpg`).

Relevé en passant, vrai aujourd'hui : **sous un Phénix éclaté, les pastilles
de motif se ressemblent toutes** — ses ailes et sa gerbe, qui sortent du
médaillon, couvrent le haut de la bordure, là où le motif se lit. Les grilles
de la maquette les taisent là où la bordure est le sujet (`.mq-sujet`, comme
une liste le fait déjà) ; la rangée d'aujourd'hui le mériterait aussi, quelle
que soit la piste.

## Piste 1 · Les calques (`planche-calques.jpg`)

Sous la rangée des pièces, **un rail de cinq calques** : Avatar, Version,
Finition, Bordure, Sceau. Chacun montre ce qu'elle porte — l'avatar d'origine,
sa version rare, la teinte de sa finition, sa bordure avec son motif, son
étoile —, et une étincelle d'or dit ce que l'application choisit pour elle
(« Auto », « Accordé »). Le rail est à la fois **le résumé de la tenue** et
**le sélecteur**.

On touche un calque : **sa grille seule** s'ouvre dessous, la même pour tous —
des cases comme celles des avatars, l'avatar porté en grand dans chacune, son
nom dessous, « Auto » ou « Accordé » d'abord, « +N à gagner » au bout.
« Avatar » d'office : ses gemmes et ses cases, comme aujourd'hui. « Bordure »
réunit la ligue (six pastilles, une ligne) et le motif (sa grille) : c'est la
même chose à l'œil, une bordure. Toucher une case l'essaie sur la carte, le
calque prend le pointillé de l'essai, la barre « Annuler · Porter » prend la
place du menu — le geste de toute la loge, inchangé.

- Ses gemmes à **367 px** au lieu de 765, sa première rangée à **435** : la
  place de deux rangées d'avatars au-dessus du menu en 360 × 640, là où
  l'habituée d'aujourd'hui n'en voit aucune.
- **Elle ne grandit plus jamais** : trente-deux motifs, douze finitions, ce
  sont des rangées de plus dans la grille de leur calque, pas des lignes de
  plus au-dessus des avatars.
- Rien de neuf à apprendre : la grille est celle des avatars, l'essai celui
  de la loge. « Version rare », sur la carte, devient un calque (d'origine,
  rare, chaque matière taillée) : la feuille « Sa version » d'aujourd'hui
  rejoint la règle commune. Il ne paraît que pour un avatar éclaté, comme
  le bouton.
- Ce qu'on perd : on ne voit plus, d'un coup d'œil, les finitions **et** les
  motifs à la fois. Le rail dit ce qu'on porte ; pour comparer, on change de
  calque.
- Le neuf suit le rouge jusqu'à sa case, comme aujourd'hui : le point rouge
  passe sur le calque qui a du nouveau (la règle de `profil.md`).

## Piste 2 · La fiche de tenue (`planche-fiche.jpg`)

Ce que tu proposais pour les motifs, à chaque réglage : **une tuile par
réglage** — Finition, Bordure, Motif, Sceau —, qui ne montre que ce qu'elle
porte (« Orage › », « Or › », « Flammes › », « Montré › »). La toucher ouvre
**sa feuille** : ce qu'elle a, **rangé par provenance** (les offerts, le brin
d'une ligue sertie, les duels, la boutique, le trésor, la saison) — la feuille
a la place de le dire. **La carte reste au-dessus de la feuille, sans voile** :
l'essai se voit pendant qu'on choisit, et « Porter » est au pied de la
feuille. Les avatars restent dans la pièce, sous les tuiles.

- Ses gemmes à **388 px**, sa première rangée à **456** : la place de deux
  rangées d'avatars, comme les calques.
- Le plus proche de ton idée, et le plus sobre : la pièce ne montre que la
  tenue, le choix vit ailleurs.
- La variante (troisième écran) met aussi **l'avatar en fiche** : six cases —
  Avatar, Version, Finition, Bordure, Motif, Sceau —, chacune sa feuille. La
  pièce tient alors en 240 px, quoi qu'on ait. Mais l'avatar, ce qu'on change
  le plus, passe derrière un toucher de plus.
- Ce qu'elle coûte : **deux gestes de plus** à chaque changement (ouvrir,
  fermer), et une feuille qui couvre la moitié de l'écran. Comparer deux
  motifs, c'est toucher, regarder la carte en haut, toucher l'autre — comme
  les calques, mais dans une boîte.

## Piste 3 · Le miroir (`planche-miroir.jpg`)

La plus neuve. Dans la pièce « Avatar », **la carte se fait miroir** :
l'avatar en grand sur son fond, et autour de lui six épingles — Version,
Finition, Avatar, Sceau, Bordure, Motif. On touche une épingle, et **une
bande défile dessous** : ce qu'elle a, un seul au centre, en grand, essayé à
mesure qu'on glisse (« Étoiles, 10 sur 23 »). Le cœur du médaillon ouvre ses
avatars — gemmes et grille, sous le miroir.

- Ce qu'elle fait le mieux : **voir en grand ce qu'on essaie**. Une lumière
  d'Abysses, un motif de Comètes se jugent à 140 px, pas à 28.
- Ce qu'elle coûte : le miroir prend 230 px. Ses gemmes finissent à 435 px,
  sa première rangée d'avatars à 503 — une seule au-dessus du menu —, et la
  carte, la même dans toutes les autres pièces, change de forme quand on
  vient sur celle-ci.
- Glisser un à un dans vingt-trois motifs est plus long que de les voir tous
  dans une grille : bien pour flâner, moins pour retrouver.
- À développer : la carte qui se fait miroir est une animation à elle, et
  le doigt qui glisse sur la bande, un geste qui n'existe nulle part ailleurs
  dans la loge.

## En plus · Les tenues (`planche-tenues.jpg`)

Avec n'importe quelle piste. Ce qui se règle calque par calque **se garde** :
une tenue, c'est tout l'avatar — l'avatar, sa version, sa finition, sa
bordure, son motif, son sceau — sous un nom (« Duels », « La mer »,
« Hiver »), remis d'un toucher. La rangée se pose au-dessus des calques ;
« Garder » retient ce qu'elle porte. Une tenue touchée s'essaie comme le
reste : tout change sur la carte, les calques prennent le pointillé, la barre
dit « La mer · Avatar · Finition · Bordure · Motif », « Porter » la garde.

Elle coûte une table (`profile_tenues` : le profil, un nom, ce qu'elle
porte), une route, et une règle : une tenue dont une pièce n'est plus à elle
— une soirée retirée qui reprend un légendaire — se porte sans elle, comme le
serveur le fait déjà pour l'avatar. Elle prend 80 px au-dessus du rail : avec
elle, une seule rangée d'avatars au-dessus du menu en 360 × 640.

## Sous l'Ivoire (`planche-ivoire.jpg`)

Les calques sous le thème clair : le rail, ses étincelles, le pointillé de
l'essai et les cases se lisent sans retouche.

## Ce que je recommande

**Les calques (piste 1)**, et les tenues plus tard, si l'envie revient.

- Ils règlent le problème pour de bon : la pièce ne grandit plus, et ce qu'on
  vient changer le plus — l'avatar — remonte de 400 px.
- Ils ne demandent rien de neuf : la grille des avatars, l'essai, la barre,
  le point rouge, déjà appris. La fiche ajoute une feuille par réglage, le
  miroir un geste et une carte qui change de forme.
- Ils parlent ta langue : pas une phrase, des images. Le rail se lit d'un
  coup d'œil ; chaque case est l'avatar lui-même, à la taille des cases
  des avatars, au lieu de pastilles de 28 px.
- Ils gardent la porte ouverte : les tenues se posent au-dessus du rail sans
  rien changer, et la grande vue du miroir peut venir plus tard comme un
  appui long sur une case.

Ce qu'il faudrait trancher avant de l'écrire :

1. **La ligue et le motif dans un même calque « Bordure »** (la planche), ou
   deux calques — six au rail, plus serrés.
2. **« Version rare » quitte la carte** pour devenir un calque, ou reste où
   elle est.
3. **Le calque retenu** quand on revient : celui qu'on a quitté, ou toujours
   « Avatar ».
4. **Les tenues** : maintenant, plus tard, jamais.

Ce que l'écrire toucherait : les panneaux de `Apparence.tsx` (un rail, et
chaque réglage en grille — `MesFinitions`, `MesBordures`, `MesMotifs`,
`MonSceau` gardent leurs règles d'essai), la feuille « Sa version » de
`Loge.tsx`, le bloc « La loge » de `styles.css`, les épreuves qui comptent
les pastilles (`style.test.ts`, `un-seul-avatar.test.ts`, `loge.test.ts`,
`nouveautes.test.ts`) et ce que `rendu-loge.ts` doit voir tenir
(`DOIT_TENIR` : deux rangées d'avatars en 360 × 640 au lieu d'aucune).

## Le rendu final (`planche-final-*.jpg`)

Les calques, et les tenues dans un tiroir à droite. Léa a ici huit
légendaires, deux matières taillées dans son Phénix, et les Comètes tout
juste sorties de son coffre ; Tom vient de créer son profil.

### Les quatre réponses

1. **La ligue et le motif dans un même calque « Bordure ».** À l'œil, c'est
   une seule chose ; la ligue tient sur une ligne (huit choix au plus), le
   motif a sa grille dessous. Le rail garde cinq calques de 63 px en 360 de
   large ; à six, chacun n’en aurait plus que 52.
2. **« Version rare » quitte la carte pour son calque « Version ».** Tout ce
   qui habille l'avatar est au même endroit, la feuille « Sa version »
   disparaît (ses matières ont leur grille), et la carte perd sa dernière
   cible de doigt sous 44 px (30, notée dans `profil.md`). À sa place, la
   languette des tenues. Le calque paraît dès qu'elle a un Éclat — il ne
   saute pas d'un avatar à l'autre : sur un avatar qui n'a pas éclaté, il
   s'éteint et ne montre que sa version d'origine. « Sceau » de même, dès
   un légendaire scellé. Un nouveau venu n'a que trois calques.
3. **La loge s'ouvre sur « Avatar »** — on vient surtout en changer —, sauf
   quand un calque a du neuf (il s'ouvre sur le premier, comme la loge sur
   la première pièce qui en a) ou qu'un lien « Essayer » en demande un — un
   motif de la boutique, du coffre ou de « Ma collection » ouvre « Bordure »,
   une finition « Finition ». Le temps d'une visite, une pièce quittée puis
   reprise retrouve le calque où l'on était.
4. **Les tenues, dans le tiroir, dès maintenant.** Ce que je propose d'en
   faire :
   - **Six au plus** (un choix de produit) : assez pour la soirée, les
     duels, une fête, sans devenir une seconde collection.
   - **« Garder » retient tout l'avatar** — l'avatar, sa version, sa
     finition, sa bordure et son motif, son sceau —, sous le nom de son
     avatar (« Le Kraken ») ; un appui long renomme ou retire.
   - **Une tenue s'essaie comme le reste** : touchée, tout change sur la
     carte, les calques prennent le pointillé, la barre dit ce qui change,
     « Porter » la garde. Celle qu'elle porte a sa coche.
   - **Une pièce qui n'est plus à elle** — un légendaire repris avec une
     soirée retirée — se porte sans elle : le serveur valide chaque champ
     comme aujourd'hui (`PUT /api/joueur/moi`), et la tenue garde le reste.
   - **Seulement ce qui se voit de l'avatar** : ni le titre, ni la vitrine,
     ni le fond, ni le thème — eux ont leur pièce.

### Ce que montre la planche

- **Les calques** (`planche-final-calques.jpg`) : « Avatar » d'office, ses
  gemmes à 367 px et ses deux rangées de légendaires au-dessus du menu ;
  « Version » — d'origine, rare, jade, obsidienne ; « Finition », chacune
  portée par son avatar, les Abysses à l'essai ; « Sceau », montré ou
  masqué. Le point rouge des Comètes est sur « Bordure » à chaque écran.
- **La bordure** (`planche-final-bordure.jpg`) : la ligue sur une ligne, les
  motifs dessous, les Étoiles à l'essai ; défilée jusqu'aux Comètes, la
  carte collée en haut et la languette avec elle ; Tom, ses trois calques,
  et sa bordure qui lui dit comment l'ouvrir — la phrase d'aujourd'hui, sans
  son petit titre : le calque le dit déjà.
- **Le tiroir** (`planche-final-tenues.jpg`) : sorti, 132 px de large, du
  haut de la carte au menu — l'avatar de la carte reste à découvert, à
  gauche — ; « Garder » en tête, puis ses tenues ; « La mer » touchée, le
  Kraken aux Abysses sur la carte, la barre « Porter » ; un grand téléphone
  (412 × 915), la place de cinq rangées d'avatars ; l'Ivoire.

### Ce que l'écrire toucherait

Le client : la pièce « Avatar » d'`Apparence.tsx` (le rail, et chaque
réglage en grille ; les règles de l'essai ne bougent pas), la carte de
`LogeTete.tsx` (sans « Version rare », la languette à sa place), la feuille
« Sa version » de `Loge.tsx` (partie), le tiroir (neuf), `essaiDemande`
(le calque qu'un lien demande), le bloc « La loge » de `styles.css`. Le
serveur : `profile_tenues` (le profil, le nom, ce qu'elle porte en JSON),
deux routes — garder, retirer ou renommer —, la documentation de la table et
des routes. Les épreuves : celles qui comptent les pastilles et lisent la
pièce (`style.test.ts`, `un-seul-avatar.test.ts`, `loge.test.ts`,
`nouveautes.test.ts`), une de plus pour les tenues ; et `rendu-loge.ts`, qui
devra voir tenir deux rangées d'avatars en 360 × 640 au lieu d'aucune, et le
tiroir sans rien passer sous la niche.
