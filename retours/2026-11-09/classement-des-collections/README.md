# Le classement des collections — la maquette (9 novembre 2026)

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
justement en avoir un devrait être vraiment mis en avant » — la synthèse,
plus bas.

Une maquette : les propositions sont posées dans le vrai client — ses avatars
peints, ses finitions, ses bordures de ligue, ses Divins, sa feuille, son
menu —, derrière une page de maquette (`/classement?p=1`, `2`, `3`, et `4`
pour la synthèse), photographiées au téléphone en 360 × 640 sur un serveur
jetable, puis rangées sur une planche. Le prototype vit dans
`maquette/prototype.patch` : sans lui, le code d'aujourd'hui, rien n'a
changé.

Les joueurs sont inventés (`client/src/views/classement/donnees.ts`, dans le
patch), à l'échelle de la production du début novembre : quatorze du haut du
classement, sur 87. « Toi », c'est Léa, l'habituée des maquettes de la carte —
niveau 23, le Phénix porté, maîtresse des mythologies et du grand écran :
**12ᵉ sur 87, 559 carats**. Max mène (1869, dont 200 pour Hélios et Chronos),
devant Zoé (1778, dont 100 pour le Lotus Sacré) et Nadia (1222).

## La planche

Tout se regarde sur la planche Design, privée :
<https://claude.ai/artifact/DL7Mmm4FgDZ1zHctHpJFbP>

- **La synthèse · Les collectionneurs** — la page recommandée, entière, puis
  chacun de ses moments : l'entrée, le premier écran, la salle des Divins, les
  records, le classement, entre amis, le barème, sous Ivoire ; la vitrine de
  Max et de Zoé, la bataille contre Malik et contre Max, un record ouvert.
- **Les trois propositions, en un coup d'œil** et **la valeur d'une
  collection** — le barème, les Divins comptés, ce qui deviendrait public, ce
  qui reste à trancher.
- **Proposition 1, 2, 3** — chacune dans ses états, telles que photographiées
  d'abord (les Divins encore hors de la valeur).

Les photos n'existent que là (et dans `export/`, qui ne se committe pas).

## La synthèse — Les collectionneurs (recommandée)

Une seule page, ce que chacune des trois faisait le mieux (`Collectionneurs.tsx`,
`/classement?p=4`) :

- **ta place en tête** — la tête du tableau d'honneur (2), resserrée : « Tu es
  12ᵉ sur 87 ▲2 », 559 carats, ton rang de collection (« La vitrine »), et ce
  qu'il te manque pour passer le suivant (« Encore 16 carats pour passer
  Malik ») ;
- **le podium en cartes à collectionner** — de la galerie (3), ce qui rendait
  le mieux : le cadre de sa ligue, son avatar dans l'illustration, son rang en
  gemme, sa valeur ; l'opale autour de qui garde un Divin ;
- **la salle des Divins**, sous le podium (plus bas) ;
- **« Qui a le plus de… »** — les records du tableau d'honneur (2) sur une
  étagère qui glisse de côté dans son cadre, comme celles de la boutique :
  maîtres, légendaires, Cabinet, niveau, quiz du jour, thèmes, Éclats ; une
  tuile ouvre son classement entier ;
- **le classement** — la liste du palmarès (1) et « Tous · Mes amis », du 4ᵉ
  au 10ᵉ (le podium dit les trois premiers), puis toi et tes voisins ;
- **toucher un joueur ouvre sa vitrine** (3) : ses Divins d'abord, sur leurs
  socles d'opale, puis ses plus belles pièces, sa collection gemme par gemme
  à côté de la tienne, ses maîtres et ses sceaux ; « Confronter » ouvre **la
  bataille** (3) — une manche par ligne, le verdict — et dessous, s'il est
  devant toi, **ce qu'il te manque pour le passer** (2) : « Il te manque 16
  carats : une seule de ces pièces suffit », chaque pièce à sa valeur et où
  elle se gagne.

Ce qu'elle laisse : les six puces du palmarès (l'étagère des records dit
« qui a le plus de… » d'un coup d'œil, sans changer la liste), le face-à-face
en barres (la bataille le remplace), le mur de cartes au-delà du podium (une
liste se lit mieux à quatre-vingt-sept).

## Les Divins, comptés et mis en avant

« C'est uniquement la condition d'obtention qui ne doit pas être dévoilée,
mais justement en avoir un devrait être vraiment mis en avant » (le
propriétaire, le 9 novembre 2026). Les trois premières propositions les
laissaient hors de la valeur, par prudence (invariant 21 : « pas même un
compte de badges qui bougerait ») ; la synthèse les compte :

- **cent carats chacun**, la plus haute gemme — quatre légendaires : six en
  tout, et il fait changer de place ;
- **la salle des Divins**, sous le podium, de nuit sous tous les thèmes :
  « Les Divins · 3 descendus sur 6 · 100 carats chacun » ; ceux qui sont
  descendus, peints, rayons compris, leur nom et qui les a (le toucher ouvre
  sa vitrine) ; les autres sous leur voile, sans nom, « Pas encore
  descendu », comme dans l'album ; « Comment ils descendent ne se dit pas » ;
- **l'opale** — la gemme des Divins dans l'album — autour de la carte du
  podium, en filet autour de la ligne, et en pastille, ses Divins peints en
  petit, à côté de son prénom ;
- **la vitrine** : « 2 Divins veillent sur sa collection », ses Divins
  d'abord, sur des socles d'opale ;
- **la bataille** s'ouvre sur la manche des Divins dès que l'un des deux en a
  un ; et dans « Pour passer Max », ses Divins d'abord, chacun « Comment il
  descend ne se dit pas ».

Ce qui reste secret, partout : comment ils descendent, et quand — ni jauge,
ni progression, ni date, ni récit (le récit, à son seul porteur, comme
aujourd'hui). La carte d'un joueur montre déjà quels Divins il a : la valeur
n'en dit pas plus. Pas de fil d'actualité non plus (« Max a reçu un Divin
hier » dirait le quand).

## La valeur

Un seul barème. **Chaque pièce vaut sa gemme**, celle que l'album lui donne
déjà (`shared/album.ts`, les couleurs de `client/src/gemmes.ts`) : une
échelle que tout le monde a déjà vue, plutôt qu'une de plus à apprendre. Des
**carats** : un mot à elle — ni les points d'un quiz, ni les confettis qu'on
dépense : une collection ne se vend pas.

| Ce qu'on a | Carats |
|---|---|
| Un avatar de l'album — légendaire, portrait d'un sentier, forme d'un compagnon, emoji de collection —, à sa gemme : commune, peu commune, rare, épique, légendaire | 1 · 2 · 5 · 10 · 25 |
| Un Divin | 100 |
| Un Éclat, la version rare d'un avatar | +5 |
| Un maître de sentier — il vaut un légendaire | 25 |
| Un défi d'une carte du Cabinet, au métal de son rang le plus haut : bronze, argent, or | 2 · 5 · 10 |
| Un autre trophée — une étape de piste, un exploit, un prix —, un timbre du carnet des fêtes | 2 |
| Un thème, à sa gemme ; un fond ; une gerbe ; une finition | 1 à 25 · 3 · 3 · 2 |
| Une bordure de ligue, du bronze aux maîtres | 1 · 2 · 5 · 10 · 25 · 50 |

Léa : 351 en avatars, 131 en trophées, 77 en style. Tout ce qui se gagne
aujourd'hui vaut un peu plus de 3 900 carats — les 173 avatars de l'album en
font 2 464, dont 600 pour les six Divins.

**Ce qui ne se compte pas** : les emojis de l'inscription, à tout le monde ;
les trouvailles, privées ; l'Expédition, dont le départ est fermé
(`EXPEDITION_REMPLACEE`).

**Ce qui deviendrait public.** La carte d'un autre ne dit aujourd'hui que ses
légendaires, ses Divins descendus et ses sentiers (`CarteDeJoueur`,
`core/carte.ts`). Le classement dirait **combien** il a de thèmes, de fonds,
de sceaux du Cabinet — jamais lesquels, ni le thème et la gerbe qu'il porte,
qui ne partent qu'à lui.

## L'entrée

Un gros bouton de plus sur « Mon profil », entre « Ma collection » et « Mes
soirées » : « Les collectionneurs », « 12ᵉ sur 87 · ta collection vaut 559
carats », « Nouveau » le temps de le découvrir.

## Les trois propositions d'abord

Photographiées avant la décision sur les Divins : ils n'y comptaient pas.

### Proposition 1 — Le palmarès (la plus sobre)

Le classement des duels tourné vers la collection, avec ses pièces — les
lignes `.lb-row`, la feuille, les onglets fins, les puces :

- **sa place en tête**, et ce qu'il faut pour passer le suivant ;
- **« Tous · 87 » ou « Mes amis · 6 »** ;
- **six puces** qui changent ce qu'on classe : la collection, le niveau, les
  maîtres des sentiers (douze points sous le prénom, d'or pour chaque maître),
  les légendaires (les premiers, peints), le Cabinet (les dix cartes, au
  métal de leur défi), le style ;
- **ex æquo, même rang** (invariant 15) ; à zéro, « Pas encore au
  classement » et ce qui l'y fait entrer — jamais « 87ᵉ avec 0 » ;
- **toucher un nom ouvre le face-à-face** : ligne à ligne, l'or à qui mène,
  puis ce qu'il a et pas toi.

### Proposition 2 — Le tableau d'honneur

- **ta collection** : la valeur, le rang, ▲ depuis lundi ; un **rang de
  collection**, nommé d'après ce qu'elle remplit — le tiroir, le coffret, la
  vitrine, la galerie, le musée, le palais : il se dit de Léa comme de Max,
  sans accord à faire — et sa jauge ; ce qui la fait, en trois couleurs ;
- **les records**, une tuile chacun, qui ouvre son classement ;
- **un nom ouvre la comparaison** : les familles en miroir, l'écart, puis ce
  qu'il manque pour le passer, avec où le gagner (`ouIlSeGagne`).

### Proposition 3 — La galerie (la plus créative)

- **un mur de cartes à collectionner**, au cadre de sa ligue, les trois
  premiers sur un podium ;
- **une carte ouvre sa vitrine** : ses pièces maîtresses sur leurs socles ;
- **« Confronter »** : sept manches, la manche à qui a le plus, rien de tiré
  au sort — on peut être derrière au classement et gagner la bataille.

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
| La synthèse | 2 236 px ; ta place et le podium au premier écran, la salle des Divins au deuxième | une vitrine défile de 126 à 206 px, la bataille de 328 px (Malik) à 421 px (Max) |
| 1 · Le palmarès | 1 547 px | le face-à-face défile de 539 px |
| 2 · Le tableau d'honneur | 1 684 px | un record, 550 px de liste ; la comparaison, 47 px |
| 3 · La galerie | 1 192 px | la vitrine défile de 126 px, la bataille de 187 px |

## À trancher

1. **La synthèse** — la garder telle quelle, ou y reprendre une pièce des
   trois (les puces du palmarès, le mur de cartes).
2. **L'unité** — des carats, ou « points de collection ».
3. **Le barème** — un Divin vaut-il bien quatre légendaires ? un maître, un
   légendaire ? un Éclat, une rare ?
4. **Qui est classé** — ceux qui ont joué ces quatre dernières semaines,
   comme aux duels (la maquette dit « sur 87 »), ou tous les profils.

## Ce que la vraie version demandera

- **L'invariant 21 réécrit** (`CLAUDE.md`, règle `recompenses.md`) : les
  Divins descendus comptent dans la valeur d'une collection, et ce compte
  bouge — le choix du propriétaire du 9 novembre 2026 ; restent secrets leur
  règle, leur légende (au seul porteur), toute jauge, toute progression, toute
  date. `divins.test.ts` le garde : aucune ligne de `core/divins.ts` hors du
  serveur, et rien dans la valeur ni dans le classement qui dise quand l'un
  d'eux est descendu.
- **La valeur au serveur.** `compteDeLaCollection` ne se calcule aujourd'hui
  que chez le propriétaire, sur sa page. La valeur de chaque profil se
  compterait d'une règle pure (`shared/`, à côté de `shared/collection.ts`),
  en fond et gardée, comme la moyenne des joueurs (`moyennesDesJoueurs`) —
  ses thèmes achetés, ses paliers des sentiers, ses bordures du journal des
  duels, ses badges, ses Éclats, ses fonds, ses gerbes, ses Divins —, jamais
  attendue par la page.
- **Une route** (et sa ligne dans `docs/reference/api-http.md`), réservée aux
  profils ; **ses constantes**, des choix de produit, dans
  `docs/reference/baremes.md`.
- **Les classements par `shared/classement.ts`** (invariant 15), les
  homonymes par `nomsAffiches` (invariant 17), chaque ligne avec ce que le
  joueur porte (`un-seul-avatar.test.ts`).
- **Une page de plus** (`/classement`) : `ACCOUNT_PAGES`, `ACCOUNT`, `TITRES`,
  `RESERVED_SLUGS`, `pageDeLAdresse` pour que le QG la ferme, `LISENT_LE_PROFIL`
  et le préchargement de l'accueil d'un profil (règle `client.md`).
- **Des tests** : un Divin compté une fois, ni masqué ni anonyme au
  classement, les ex æquo.

## Rejouer la maquette

Le patch s'applique sur le code du 9 novembre 2026 (le commit `7fb947c`).
Depuis la racine, avec le Chromium de Playwright (`npm root -g`) :

```bash
git apply retours/2026-11-09/classement-des-collections/maquette/prototype.patch
npm run build -w client
cd server && npx tsx ../retours/2026-11-09/classement-des-collections/maquette/photos.ts ../export/classement-des-collections
```

Le patch posé, `npm run dev` puis `http://localhost:5173/classement?p=4` (la
synthèse ; `1`, `2`, `3` pour les premières) ; `?vue=entree&p=4`, le profil
où l'on y entre ; `&vitrine=max`, `&bataille=malik`, `&record=maitres`,
`&amis` ouvrent ce qui s'ouvre au toucher. `git apply -R` du même patch le
retire. Les trois premières, rephotographiées, comptent maintenant les Divins
comme la synthèse : leurs photos de la planche sont celles d'avant.

| Fichier | Ce qu'il est |
|---|---|
| `maquette/prototype.patch` | la page de maquette (`client/src/views/classement/` : `ClassementMaquette.tsx` — l'entrée et l'aiguillage —, `Collectionneurs.tsx` — la synthèse —, `Palmares.tsx`, `TableauDHonneur.tsx`, `Galerie.tsx`, `donnees.ts` — les joueurs inventés, le barème, les classements —, `classement.css`), son adresse (`shared/adresses.ts`, `main.tsx`, `titres.ts`) |
| `maquette/photos.ts` | le serveur jetable et les trente-six états photographiés en 360 × 640 — le premier écran, la page entière, le bas des feuilles, défilée jusqu'à une section, sous Ivoire —, et `mesures.txt` (`s-` : la synthèse) |
