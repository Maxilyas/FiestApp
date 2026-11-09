# Le classement des collections — la maquette, puis la page (9 novembre 2026)

« Je m'aperçois qu'on regarde souvent le classement des joueurs et ce qu'ils
ont dans leur collection. Est-ce que ça serait pas intelligent de faire un
classement des joueurs en fonction de leur progression mais aussi de la
collection qu'ils ont, comme ça on pourrait voir plein de choses sur eux et
savoir si on a une meilleure collection qu'eux, qui a le plus de maîtres dans
le sentier, le Cabinet, etc. Donner une valeur à la collection. Fais-moi 3
propositions de maquettes » (le propriétaire).

Puis, sur les trois : « Fais-moi une maquette selon tes recommandations de ce
qui rend le mieux. J'aimerais que les Divins soient comptabilisés aussi, c'est
uniquement la condition d'obtention qui ne doit pas être dévoilée, mais
justement en avoir un devrait être vraiment mis en avant » — la synthèse.

Puis, sur la synthèse : « Comment on voit le détail pour chaque catégorie
(Cabinet, maître, etc.) ? J'aimais bien celui du palmarès. Aussi l'histoire
de gagner sur quelqu'un en fonction des thèmes, je ne suis pas fan. Je
préfère en termes de design le face-à-face du palmarès. Est-ce que les
matières des légendaires, que l'on peut avoir en utilisant un Éclat, comptent
bien aussi comme un légendaire ? Est-ce que légendaire et Éclat ont la même
valeur ? » — la synthèse retouchée, plus bas.

Puis, sur la synthèse retouchée : « Passe-le à 200 et tu peux commencer
l'intégration, c'est parfait. Attention à la performance pour ne pas geler le
serveur, etc. Requête. » — le Divin à deux cents carats, et la page faite :
`/collectionneurs` (« La page, intégrée », plus bas).

Puis, le même jour, l'étoile du zénith arrivée sur `main` — le sceau d'un
légendaire gagné par sa voie d'origine, pas seulement par le raccourci du
Cabinet : « il faudrait du coup pouvoir récompenser dans le classement
cela ». Un légendaire scellé vaut deux légendaires de plus (`CARATS_DU_ZENITH`,
50 carats : « c'est souvent des légendaires durs à obtenir, donc j'aimerais
que ce soit 50 », d'abord 25), masqué ou non dans la loge ; ses légendaires scellés passent en
tête de sa ligne, leur étoile au sommet, et se comptent (« 3 scellés ») ; sa
pièce le dit sur son socle ; le face-à-face a sa ligne, « Légendaires
scellés », et compte l'étoile d'un légendaire que les deux ont parmi ce que
l'un a et pas l'autre.

Puis, sur la page fusionnée : « Fais une septième catégorie scellés stp ;
tout le monde est classé, c'est bien ; fais un “Nouveau” sur le bouton, par
le QG ; rajoute la valeur de la collection sur la carte joueur avec un style
très joli, et permettre de cliquer dessus et de renvoyer sur la page
collectionneur. » — faits le même jour (« La page, intégrée », plus bas) :
- les scellés, septième puce, sur les vingt légendaires qui se scellent ; la
  valeur seule sur sa rangée, les six autres trois par trois ;
- `/collectionneurs` à l'affiche du QG — la première page à l'affiche qui ne
  se ferme pas (`pageALAfficheDeLAdresse`) —, « Nouveau » sur son gros bouton
  de « Mon profil » jusqu'à la visite, son effet compté à ses visiteurs ;
- sur la carte d'un joueur, un cartouche serti dans le métal du cadre : sa
  pierre d'or, ses carats, le nom de sa collection et sa place ; hors d'une
  soirée, il mène aux collectionneurs — à sa vitrine pour la carte d'un
  autre.

Puis : « “Les collectionneurs” comme nom, je n'aime pas trop pour le titre
dans le profil. Je verrais quelque chose qui fait plus penser à “Classement
des collections”, mais c'est peut-être trop long » — « Classement des
collections » partout où le nom se lit (`TITRE_DES_COLLECTIONNEURS`) : le
gros bouton, en 360 de large, le coupe net après « Classement », sur deux
lignes ; « Les collections » aurait tenu sur une. L'adresse reste
`/collectionneurs`.

Une maquette : les propositions sont posées dans le vrai client — ses avatars
peints, ses finitions, ses bordures de ligue, ses Divins, ses matières, sa
feuille, son menu —, derrière une page de maquette (`/classement?p=1`, `2`,
`3`, et `4` pour la synthèse), photographiées au téléphone en 360 × 640 sur un
serveur jetable, puis rangées sur une planche. Le prototype vit dans
`maquette/prototype.patch` : sans lui, le code d'aujourd'hui, rien n'a
changé.

Les joueurs sont inventés (`client/src/views/classement/donnees.ts`, dans le
patch), à l'échelle de la production du début novembre : quatorze du haut du
classement, sur 87. « Toi », c'est Léa, l'habituée des maquettes de la carte —
niveau 23, le Phénix porté, maîtresse des mythologies et du grand écran :
**12ᵉ sur 87, 579 carats**. Max mène (2049, dont 200 pour Hélios et Chronos
et 225 pour ses neuf Éclats), devant Zoé (1898) et Nadia (1282).

## La planche

Tout se regarde sur la planche Design, privée :
<https://claude.ai/artifact/DL7Mmm4FgDZ1zHctHpJFbP>

- **La synthèse, retouchée · Les collectionneurs** — la page recommandée :
  quatre catégories en pleine page (la collection, les maîtres, le Cabinet,
  les légendaires), puis chacun de ses moments — l'entrée, le premier écran,
  les Éclats, le niveau, entre amis, la salle des Divins, la vitrine de Max
  et de Zoé, le face-à-face avec Malik et avec Max, le barème, sous Ivoire.
- **Les trois propositions, en un coup d'œil** et **la valeur d'une
  collection** — le barème, les Divins et les Éclats comptés, ce qui
  deviendrait public, et ce qui a été tranché.
- **Proposition 1, 2, 3** — chacune dans ses états, telles que photographiées
  d'abord (les Divins hors de la valeur, l'Éclat à 5).

Les photos n'existent que là (et dans `export/`, qui ne se committe pas).

## La synthèse, retouchée — Les collectionneurs (recommandée)

Une seule page (`Collectionneurs.tsx`, `/classement?p=4`) :

- **ta place en tête**, à la catégorie choisie : « Tu es 12ᵉ sur 87 ▲2 »,
  579 carats, « La vitrine », « Encore 16 carats pour passer Malik » — aux
  maîtres, « Tu es 7ᵉ · 2 maîtres sur 12 · Encore 2 maîtres pour passer
  Sacha » ; sans rien de la catégorie, « Pas encore au classement » et ce qui
  l'y fait entrer ;
- **les Divins en bandeau**, juste dessous (plus bas) ;
- **les six puces du palmarès** (1) — Collection, Niveau, Maîtres,
  Légendaires, Cabinet, Éclats —, à côté de « Tous · Mes amis » : elles
  changent **sur place** sa place, le podium et la liste, et chaque ligne dit
  sa catégorie — les douze couronnes des sentiers et ses paliers sur 144, les
  dix sceaux du Cabinet au métal de leur défi, ses premiers légendaires
  peints. Qui n'a rien de la catégorie n'est pas classé : ni sur le podium,
  ni « – » dans la liste — « Les autres n'ont pas encore de sceau d'or » ;
- **le podium en cartes à collectionner** (3), à la catégorie choisie — « 9
  sur 12 » aux maîtres —, l'opale autour de qui garde un Divin ;
- **la liste** (1), du 4ᵉ au 10ᵉ, puis toi et tes voisins ;
- **toucher un joueur ouvre sa vitrine** (3) : ses Divins d'abord, sur leurs
  socles d'opale, puis ses plus belles pièces — sa matière peinte et dite
  (« Légendaire · jade · 75 carats ») —, sa collection gemme par gemme à côté
  de la tienne, ses maîtres et ses sceaux ;
- **« Comparer » ouvre le face-à-face du palmarès** (1) : les deux avatars,
  « À égalité : 3 lignes chacun », ligne à ligne la barre de chacun et l'or à
  qui mène — les Divins d'abord, en opale ; **plus de thèmes** —, puis ce
  qu'il a et pas toi — ses Divins d'abord —, et ce qu'il te manque pour le
  passer (« une seule de ces pièces suffit »).

Ce qu'elle a laissé, à la retouche : l'étagère des records (les puces le
disent, sur place), la bataille des collections (le face-à-face du palmarès
la remplace), et toute comparaison sur les thèmes — ils s'achètent, on ne se
mesure pas à ce qu'on a payé (le propriétaire, le 9 novembre 2026). Ils
restent dans la valeur, comme les fonds et les gerbes.

## Les Divins, comptés et mis en avant

« C'est uniquement la condition d'obtention qui ne doit pas être dévoilée,
mais justement en avoir un devrait être vraiment mis en avant » (le
propriétaire, le 9 novembre 2026). Les trois premières propositions les
laissaient hors de la valeur, par prudence (invariant 21 : « pas même un
compte de badges qui bougerait ») ; la synthèse les compte :

- **deux cents carats chacun**, la plus haute gemme — huit légendaires (cent
  sur les photos de la planche ; « Passe-le à 200 », le propriétaire, le même
  jour) ;
- **leur bandeau**, sous ta place, de nuit sous tous les thèmes : « Les
  Divins · 3 descendus sur 6 · 200 carats », les six, peints ou sous leur
  voile, et qui les a, en petit ; **leur salle**, au toucher : ceux qui sont
  descendus, peints, rayons compris, leur nom et qui les a (le toucher ouvre
  sa vitrine), les autres sous leur voile, sans nom, « Pas encore
  descendu », comme dans l'album ; « Comment ils descendent ne se dit pas » ;
- **l'opale** — la gemme des Divins dans l'album — autour de la carte du
  podium, en filet autour de la ligne, et en pastille, ses Divins peints en
  petit, à côté de son prénom ;
- **la vitrine** : « 2 Divins veillent sur sa collection », ses Divins
  d'abord ;
- **le face-à-face** s'ouvre sur la ligne des Divins, en opale, dès que l'un
  des deux en a un ; et dans « Ce que Max a et pas toi », ses Divins d'abord,
  puis « Comment un Divin descend ne se dit pas ».

Ce qui reste secret, partout : comment ils descendent, et quand — ni jauge,
ni progression, ni date, ni récit (le récit, à son seul porteur, comme
aujourd'hui). La carte d'un joueur montre déjà quels Divins il a : la valeur
n'en dit pas plus. Pas de fil d'actualité non plus (« Max a reçu un Divin
hier » dirait le quand).

## L'Éclat et les matières

« Est-ce que les matières des légendaires comptent bien aussi comme un
légendaire ? Est-ce que légendaire et Éclat ont la même valeur ? » — la
maquette comptait l'Éclat comme une rare (5) et oubliait les matières. Le
code dit (règle `recompenses.md`) : un Éclat fait éclater un avatar ; tombé
sur un avatar déjà éclaté, il attend en réserve, d'où il en fait éclater un
autre ou **taille une matière** — porcelaine, corail, jade, obsidienne —
dans un avatar éclaté, jamais un Divin ni un compagnon ; les quatre réunies
offrent l'Opale, qu'aucun Éclat ne paie. La Pluie d'Éclats compte déjà
ensemble les avatars éclatés et les matières taillées (`eclatsPosesOf`).

D'où la règle de la synthèse :

- **un Éclat vaut un légendaire, 25 carats** — qu'il fasse éclater un avatar
  ou y taille une matière : chaque matière coûte un Éclat ;
- **une matière n'est pas un avatar de plus** : le Phénix en jade reste un
  légendaire dans les comptes (« 4 légendaires sur 32 ») ; il vaut ce qu'il a
  coûté — la Chouette d'Argent de Zoé, éclatée puis taillée dans le jade :
  25 + 25 + 25 = **75 carats** ;
- **l'Opale ne compte pas** : offerte par les quatre, aucun Éclat ne la paie
  — comme pour La Pluie d'Éclats.

Un légendaire taillé dans les quatre matières (cinq Éclats) vaut 150 carats :
à cent, un Divin valait moins que lui. Il passe à 200 — le choix du
propriétaire — et reste la pièce la plus chère.

## La valeur

Un seul barème. **Chaque pièce vaut sa gemme**, celle que l'album lui donne
déjà (`shared/album.ts`, les couleurs de `client/src/gemmes.ts`) : une
échelle que tout le monde a déjà vue, plutôt qu'une de plus à apprendre. Des
**carats** : un mot à elle — ni les points d'un quiz, ni les confettis qu'on
dépense : une collection ne se vend pas.

| Ce qu'on a | Carats |
|---|---|
| Un avatar de l'album — légendaire, portrait d'un sentier, forme d'un compagnon, emoji de collection —, à sa gemme : commune, peu commune, rare, épique, légendaire | 1 · 2 · 5 · 10 · 25 |
| Un Divin | 200 |
| Un Éclat — un avatar qui éclate, ou une matière taillée ; l'Opale, offerte, ne compte pas | 25 |
| Un maître de sentier — il vaut un légendaire | 25 |
| Un défi d'une carte du Cabinet, au métal de son rang le plus haut : bronze, argent, or | 2 · 5 · 10 |
| Un autre trophée — une étape de piste, un exploit, un prix —, un timbre du carnet des fêtes | 2 |
| Un thème, à sa gemme ; un fond ; une gerbe ; une finition | 1 à 25 · 3 · 3 · 2 |
| Une bordure de ligue, du bronze aux maîtres | 1 · 2 · 5 · 10 · 25 · 50 |

Léa : 371 en avatars et Éclats, 131 en trophées, 77 en style. Les 173
avatars de l'album font 3 064 carats, dont 1 200 pour les six Divins ; chaque
Éclat en ajoute 25. Les chiffres des joueurs inventés sont ceux des photos, le
Divin à cent : Max en a deux, et passe à 2 249 à deux cents.

**Ce qui ne se compte pas** : les emojis de l'inscription, à tout le monde ;
les trouvailles, privées ; l'Opale ; l'Expédition, dont le départ est fermé
(`EXPEDITION_REMPLACEE`).

**Ce qui deviendrait public.** La carte d'un autre ne dit aujourd'hui que ses
légendaires, ses Divins descendus et ses sentiers (`CarteDeJoueur`,
`core/carte.ts`). Le classement dirait **combien** il a de sceaux du Cabinet
ou d'Éclats, et sa valeur compterait ses thèmes, ses fonds — jamais lesquels,
ni le thème et la gerbe qu'il porte, qui ne partent qu'à lui.

## L'entrée

Un gros bouton de plus sur « Mon profil », entre « Ma collection » et « Mes
soirées » : « Les collectionneurs », « 12ᵉ sur 87 · ta collection vaut 579
carats », « Nouveau » le temps de le découvrir — intégré sans « Nouveau »
(« La page, intégrée », plus bas).

## Les trois propositions d'abord

Photographiées avant les décisions sur les Divins et l'Éclat : les Divins
n'y comptaient pas, l'Éclat valait 5.

### Proposition 1 — Le palmarès (la plus sobre)

Le classement des duels tourné vers la collection, avec ses pièces — les
lignes `.lb-row`, la feuille, les onglets fins, les puces : sa place en
tête ; « Tous » ou « Mes amis » ; six puces qui changent ce qu'on classe ; ex
æquo, même rang (invariant 15) ; à zéro, « Pas encore au classement » ;
toucher un nom ouvre le face-à-face. Ses puces et son face-à-face sont
passés dans la synthèse.

### Proposition 2 — Le tableau d'honneur

La valeur en relevé, un rang de collection nommé d'après ce qu'elle remplit
— le tiroir, le coffret, la vitrine, la galerie, le musée, le palais : il se
dit de Léa comme de Max, sans accord à faire —, les records en tuiles, une
comparaison en miroir et ce qu'il manque pour passer quelqu'un, avec où le
gagner (`ouIlSeGagne`). Sa tête et « pour le passer » sont passés dans la
synthèse.

### Proposition 3 — La galerie (la plus créative)

Un mur de cartes à collectionner, au cadre de sa ligue, les trois premiers sur
un podium ; une vitrine par joueur, ses pièces maîtresses sur leurs socles ;
« Confronter » : sept manches, la manche à qui a le plus. Le podium et la
vitrine sont passés dans la synthèse ; la bataille, non.

## Dans toutes

- **Des profils seulement** : un invité anonyme n'y paraît pas, et rien n'y
  dit ce qui lui manque (invariant 8). Les masqués du quiz du jour et les
  profils suspendus n'y sont pas, comme partout.
- **Aucun mot qui suppose un genre** : « Pas encore au classement », pas
  « classée » — l'application ne sait pas qui est une joueuse.
- Ce qui se touche ouvre ses gestes de toujours : « Sa carte », « Défier ».

## Les mesures

En 360 × 640 (`maquette/photos.ts` les écrit dans `mesures.txt`, à côté des
photos) : aucune page ne déborde de côté, aucun prénom n'est coupé.

| | La page | Ce qui s'ouvre |
|---|---|---|
| La synthèse, retouchée | 1 745 px à la collection (1 559 aux maîtres, 1 259 au Cabinet, 1 751 aux légendaires) ; ta place, les Divins et les puces au premier écran | la salle des Divins tient en entier ; une vitrine défile de 191 px ; le face-à-face de 443 px (Malik) à 563 px (Max) |
| 1 · Le palmarès | 1 547 px | le face-à-face défile de 539 px |
| 2 · Le tableau d'honneur | 1 684 px | un record, 550 px de liste ; la comparaison, 47 px |
| 3 · La galerie | 1 192 px | la vitrine défile de 126 px, la bataille de 187 px |

## Ce qui restait à trancher, tranché

1. **L'unité** — des carats, comme la maquette.
2. **Le barème** — un Divin, huit légendaires (« Passe-le à 200 », le
   propriétaire) : plus cher qu'un légendaire taillé dans les quatre
   matières ; un Éclat et un maître, un légendaire chacun.
3. **Qui est classé** — tous les profils qui ont quelque chose de la
   catégorie, pas seulement ceux des quatre dernières semaines : une
   collection ne s'use pas, celle d'un joueur parti reste la sienne. Un choix
   de l'intégration, à revoir si le classement se remplit de profils
   endormis.
4. **Les thèmes dans la valeur** — ils y restent, comme les fonds et les
   gerbes, sans puce ni ligne du face-à-face.

## La page, intégrée

Faite le même jour, sur la synthèse retouchée et le Divin à deux cents
carats. Le détail vit dans la règle du domaine (`.claude/rules/profil.md`,
« les collectionneurs ») et dans `docs/produit/le-profil.md` ; les barèmes et
les réglages, dans `docs/reference/baremes.md` ; les deux routes, dans
`docs/reference/api-http.md`.

- **La page** : `/collectionneurs` (`client/src/views/Collectionneurs.tsx`),
  plutôt que `/classement`, qu'on aurait lu pour celui des duels. Tout ce que
  la synthèse retouchée montrait — sa place, les Divins en bandeau et leur
  salle, les puces — sept depuis les scellés —, « Tous · Mes amis », le podium en cartes au cadre de
  leur ligue, la liste jusqu'au dixième puis ses voisins, la vitrine, le
  face-à-face, le barème. Sans profil, de quoi se connecter. Elle ne commence
  rien : comme le profil, elle ne se ferme pas au QG (`pageDeLAdresse`).
- **L'entrée** : le gros bouton, entre « Ma collection » et « Mes soirées »,
  dit sa place et sa valeur au dernier relevé
  (`PublicProfileDetail.collectionneur`). « Nouveau » s'y allume quand une
  affiche du QG montre les collectionneurs, jusqu'à sa visite
  (`PublicProfileDetail.affiches`) — la maquette le voulait le temps de le
  découvrir ; l'affiche du QG le décide.
- **La carte d'un joueur** dit ce que vaut sa collection, de mémoire
  (`CarteDeJoueur.profil.collection`) : un cartouche sous l'illustration, qui
  mène aux collectionneurs hors d'une soirée.
- **La règle, pure** (`shared/collectionneurs.ts`) : le barème, les rangs
  d'une collection, les sept catégories, leur classement par la règle de tous
  (invariant 15), celui à passer, les pièces maîtresses, le face-à-face. Ce
  que « Ma collection » compte, le serveur le relit aux mêmes règles
  (`ProfileStore.collectionDe`, `releveDeLaCollection`) ; les homonymes se
  marquent par `nomsAffiches` (invariant 17), et chaque ligne montre ce que
  le joueur porte, sa matière comprise.
- **L'invariant 21 réécrit** (`CLAUDE.md`, règle `recompenses.md`) : les
  Divins descendus comptent dans la valeur d'une collection ; leur règle,
  leur légende, toute jauge et toute date restent au serveur.
- **La performance** (« Attention à la performance pour ne pas geler le
  serveur ») : le relevé de tous ne se fait jamais sur le chemin d'une
  requête — en fond, derrière la réponse, au plus toutes les six heures, un à
  la fois ; les profils lus par paquets de cinquante, comptés par tranches de
  huit qui rendent la main à la boucle, jamais pendant qu'une question de
  soirée attend ses réponses, sous son nom pour la sonde des gels ; les
  épreuves validées de tous (par l'index partiel), leurs thèmes achetés et
  leur quiz du jour, un texte JSON chacun ; les ligues, de la mémoire des
  duels. Gardé dans `meta`, un réveil le reprend sans rien relire. La page
  lit la mémoire ; seule la fiche du visiteur se refait à sa visite, d'un
  aller-retour de front, gardée une minute.
- **Les tests** : `collectionneurs.test.ts` — le barème, la valeur, une
  matière comptée comme un Éclat et jamais comme un avatar, l'Opale qui ne
  coûte rien, un Divin sans Éclat, les ex æquo, qui n'a rien pas classé ;
  `collectionneurs-page.test.ts`, au banc — le premier relevé en fond, ni
  masqué ni suspendu, ni le récit d'un Divin ni le soir où il est descendu,
  les allers-retours comptés, le relevé repris au réveil, puis refait en fond
  quand il vieillit ; `collectionneurs-fond.test.ts` — huit collections par
  tour de boucle au plus, rien pendant une question, un relevé à la fois ;
  `collectionneurs-index.test.ts` — la lecture des épreuves par son index,
  sous des statistiques de production.
- **Le rendu** : `server/scripts/rendu-collectionneurs.ts` photographie la
  page au téléphone (360 × 640), sous le Velours et l'Ivoire, et dit ce qui
  déborde : rien, et aucun prénom coupé.

## Rejouer la maquette

Le patch s'applique sur le code du 9 novembre 2026 d'avant l'intégration (le
commit `7fb947c`) : l'intégration touche les mêmes lignes (`main.tsx`,
`titres.ts`, `shared/adresses.ts`), et il n'y passe plus. Dans un arbre de
travail à part, depuis la racine, avec le Chromium de Playwright
(`npm root -g`) :

```bash
git worktree add ../maquette 7fb947c
mkdir -p ../maquette/retours/2026-11-09
cp -r retours/2026-11-09/classement-des-collections ../maquette/retours/2026-11-09/
cd ../maquette && npm install
git apply retours/2026-11-09/classement-des-collections/maquette/prototype.patch
npm run build -w client
cd server && npx tsx ../retours/2026-11-09/classement-des-collections/maquette/photos.ts ../export/classement-des-collections
```

Le patch posé, `npm run dev` puis `http://localhost:5173/classement?p=4` (la
synthèse ; `1`, `2`, `3` pour les premières) ; `?vue=entree&p=4`, le profil
où l'on y entre ; `&axe=maitres` (ou `cabinet`, `legendaires`, `eclats`,
`niveau`), `&amis`, `&vue=divins`, `&vitrine=zoe`, `&face=malik` ouvrent ce
qui s'ouvre au toucher. `git worktree remove ../maquette` efface le tout. La
maquette compte le Divin à cent, comme ses photos ; les trois premières,
rephotographiées, suivent le barème du jour de la synthèse : leurs photos de
la planche sont celles d'avant.

| Fichier | Ce qu'il est |
|---|---|
| `maquette/prototype.patch` | la page de maquette (`client/src/views/classement/` : `ClassementMaquette.tsx` — l'entrée et l'aiguillage —, `Collectionneurs.tsx` — la synthèse —, `Palmares.tsx`, `TableauDHonneur.tsx`, `Galerie.tsx`, `donnees.ts` — les joueurs inventés, le barème, les classements —, `classement.css`), son adresse (`shared/adresses.ts`, `main.tsx`, `titres.ts`) |
| `maquette/photos.ts` | le serveur jetable et les trente-neuf états photographiés en 360 × 640 — le premier écran, la page entière, le bas des feuilles, défilée jusqu'à une section, sous Ivoire —, et `mesures.txt` (`s-` : la synthèse) |
