# Le classement des collections — la maquette (9 novembre 2026)

« Je m'aperçois qu'on regarde souvent le classement des joueurs et ce qu'ils
ont dans leur collection. Est-ce que ça serait pas intelligent de faire un
classement des joueurs en fonction de leur progression mais aussi de la
collection qu'ils ont, comme ça on pourrait voir plein de choses sur eux et
savoir si on a une meilleure collection qu'eux, qui a le plus de maîtres dans
le sentier, le Cabinet, etc. Donner une valeur à la collection. Fais-moi 3
propositions de maquettes » (le propriétaire).

Une maquette : les trois propositions sont posées dans le vrai client — ses
avatars peints, ses finitions, ses bordures de ligue, sa feuille, son menu —,
derrière une page de maquette (`/classement?p=1`, `2`, `3`), photographiées
au téléphone en 360 × 640 sur un serveur jetable, puis rangées sur une
planche. Le prototype vit dans `maquette/prototype.patch` : sans lui, le code
d'aujourd'hui, rien n'a changé.

Les joueurs sont inventés (`client/src/views/classement/donnees.ts`, dans le
patch), à l'échelle de la production du début novembre : quatorze du haut du
classement, sur 87. « Toi », c'est Léa, l'habituée des maquettes de la carte —
niveau 23, le Phénix porté, maîtresse des mythologies et du grand écran :
**12ᵉ sur 87, 559 carats**. Zoé mène d'un cheveu (1678), devant Max (1669),
qui porte Hélios — un Divin, qui ne compte pas (plus bas).

## La planche

Tout se regarde sur la planche Design, privée :
<https://claude.ai/artifact/DL7Mmm4FgDZ1zHctHpJFbP>

- **En un coup d'œil** — l'entrée par « Mon profil », et le premier écran de
  chaque proposition.
- **La valeur d'une collection** — le barème commun, ce qui ne se compte pas,
  ce qui deviendrait public, ce qui reste à trancher.
- **Proposition 1, 2, 3** — chacune dans ses états : la page entière, ce qui
  s'ouvre au toucher, et sous Ivoire.

Les photos n'existent que là (et dans `export/`, qui ne se committe pas).

## La valeur — commune aux trois

Un seul barème pour les trois, pour qu'on compare leur façon de la montrer,
pas trois règles. **Chaque pièce vaut sa gemme**, celle que l'album lui donne
déjà (`shared/album.ts`, les couleurs de `client/src/gemmes.ts`) : une
échelle que tout le monde a déjà vue, plutôt qu'une de plus à apprendre. Des
**carats** : un mot à elle — ni les points d'un quiz, ni les confettis qu'on
dépense : une collection ne se vend pas.

| Ce qu'on a | Carats |
|---|---|
| Un avatar de l'album — légendaire, portrait d'un sentier, forme d'un compagnon, emoji de collection —, à sa gemme : commune, peu commune, rare, épique, légendaire | 1 · 2 · 5 · 10 · 25 |
| Un Éclat, la version rare d'un avatar | +5 |
| Un maître de sentier — il vaut un légendaire | 25 |
| Un défi d'une carte du Cabinet, au métal de son rang le plus haut : bronze, argent, or | 2 · 5 · 10 |
| Un autre trophée — une étape de piste, un exploit, un prix —, un timbre du carnet des fêtes | 2 |
| Un thème, à sa gemme ; un fond ; une gerbe ; une finition | 1 à 25 · 3 · 3 · 2 |
| Une bordure de ligue, du bronze aux maîtres | 1 · 2 · 5 · 10 · 25 · 50 |

Léa : 351 en avatars, 131 en trophées, 77 en style. Tout ce qui se gagne
aujourd'hui vaut un peu plus de 3 300 carats — les 167 avatars comptés en
font 1 864.

**Ce qui ne se compte pas.**

- **Les Divins** (invariant 21) : un nombre public qui bouge quand l'un d'eux
  descend serait « un compte qui bouge ». Ni la valeur, ni un rang, ni un
  départage, ni « ce qu'il a et pas toi » ne les compte, et le barème ne leur
  donne pas de prix. Celui qu'on porte se voit sur son avatar, comme partout
  (Max porte Hélios). La maquette les a d'abord comptés à 50 : retirés avant
  la première photo.
- Les emojis de l'inscription, à tout le monde ; les trouvailles, privées ;
  l'Expédition, dont le départ est fermé (`EXPEDITION_REMPLACEE`).

**Ce qui deviendrait public.** La carte d'un autre ne dit aujourd'hui que ses
légendaires, ses Divins descendus et ses sentiers (`CarteDeJoueur`,
`core/carte.ts`). Le classement dirait **combien** il a de thèmes, de fonds,
de sceaux du Cabinet — jamais lesquels, ni le thème et la gerbe qu'il porte,
qui ne partent qu'à lui.

## L'entrée

Un gros bouton de plus sur « Mon profil », entre « Ma collection » et « Mes
soirées » : son nom (« Le palmarès », « Les collectionneurs », « La
galerie »), « 12ᵉ sur 87 · ta collection vaut 559 carats », « Nouveau » le
temps de le découvrir. Le même pour les trois : seul ce qu'il ouvre change.

## Proposition 1 — Le palmarès (la plus sobre)

Le classement des duels tourné vers la collection, avec ses pièces — les
lignes `.lb-row`, la feuille, les onglets fins, les puces :

- **sa place en tête**, et ce qu'il faut pour passer le suivant (« Encore 16
  carats pour passer Malik ») — à 60 lignes de là, on ne la trouvait pas ;
- **« Tous · 87 » ou « Mes amis · 6 »** ;
- **six puces** qui changent ce qu'on classe : la collection (en carats), le
  niveau, les maîtres des sentiers (douze points sous le prénom, d'or pour
  chaque maître, et les paliers sur 144), les légendaires (les premiers,
  peints, puis « +17 »), le Cabinet (les dix cartes, au métal de leur défi),
  le style (les thèmes sur 35) ;
- **ex æquo, même rang** (invariant 15) ; à zéro, « Pas encore au
  classement » et ce qui l'y fait entrer (« Ton premier défi de carte tenu à
  l'Or te place ici ») — jamais « 87ᵉ avec 0 » ;
- **toucher un nom ouvre le face-à-face** : ta collection contre la sienne,
  ligne à ligne, l'or à qui mène (« Hugo mène sur 6 lignes, toi sur 1 · une
  égalité ») — ce que personne n'a ne s'affiche pas —, puis ce qu'il a et
  pas toi, ce que tu as et pas lui : légendaires peints et maîtres. « Sa
  carte » et « Défier » au pied ;
- le barème replié sous la liste, « Comment se compte la valeur ? ».

## Proposition 2 — Le tableau d'honneur

La valeur d'abord, comme un relevé, puis « qui a le plus de… » :

- **ta collection** : 559 carats, 12ᵉ sur 87, ▲2 depuis lundi ; un **rang de
  collection**, nommé d'après ce qu'elle remplit — le tiroir, le coffret, la
  vitrine, la galerie, le musée, le palais : il se dit de Léa comme de Max,
  sans accord à faire — et sa jauge (« La galerie à 600 : encore 41 ») ; ce
  qui la fait, en trois couleurs : avatars, trophées, style ;
- **les records**, une tuile chacun : la plus belle collection, le plus de
  maîtres, de légendaires, de sceaux d'or du Cabinet, le plus haut niveau, le
  plus de victoires au quiz du jour, d'Éclats, de thèmes — qui le tient, son
  chiffre, ses couronnes ou ses sceaux, et où tu en es (« Toi : 2 · 7ᵉ ») ;
- **une tuile ouvre son classement entier** (Inès et Sacha, ex æquo, se
  partagent la 5ᵉ place des maîtres) ; **« Autour de toi »**, tes voisins ;
- **un nom ouvre la comparaison** : les trois familles en miroir, l'écart
  (« 15 carats d'écart »), puis **« Pour passer Malik »** — ses pièces que tu
  n'as pas, leur valeur et où elles se gagnent, le texte même de l'album
  (`ouIlSeGagne`) : « Il te manque 16 carats : une seule de ces pièces
  suffit ».

## Proposition 3 — La galerie (la plus créative)

Le classement devient un mur de cartes à collectionner — la carte que le
propriétaire aime (le 20 octobre 2026), en petit :

- **chaque carte** : le cadre de sa ligue (`.cadre-<ligue>`, ceux de la vraie
  carte ; sans duel classé, le champagne de tous), son avatar dans
  l'illustration, son rang en gemme, son blason, la valeur de sa collection
  au pied ; la tienne cerclée d'or. Nocturnes sous tous les thèmes, comme la
  vraie ;
- **les trois premiers sur un podium**, puis le mur, trois par rangée ;
- **une carte ouvre sa vitrine** : ses pièces maîtresses sur leurs socles, à
  la couleur de leur gemme (« Le Dragon d'Or · Légendaire · éclaté · 30
  carats »), sa collection gemme par gemme à côté de la tienne, ses maîtres
  et ses sceaux ;
- **« Confronter »** pose les deux cartes face à face : **sept manches** —
  avatars, légendaires, maîtres, paliers, défis du Cabinet, thèmes, niveau —,
  la manche à qui a le plus, rien de tiré au sort, et le verdict. On peut être
  derrière au classement et gagner la bataille : Malik a 574 carats contre
  559, et Léa l'emporte 4 manches à 2 — « ses pièces valent plus, tu en as
  plus ».

## Dans les trois

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
| 1 · Le palmarès | 1 547 px ; deux lignes sous la tête et les puces | le face-à-face défile de 539 px (ses deux listes de pièces) |
| 2 · Le tableau d'honneur | 1 684 px ; la valeur au premier écran, les records dessous | un record, 550 px de liste ; la comparaison, 47 px |
| 3 · La galerie | 1 192 px ; le podium au premier écran | la vitrine défile de 126 px, la bataille de 187 px |

## À trancher

1. **La proposition** — 1, 2 ou 3, ou un mélange : le palmarès, avec la
   bataille de la 3 à la place du face-à-face ; ou la galerie, avec les
   records de la 2 en tête.
2. **L'unité** — des carats, ou « points de collection ».
3. **Le barème** — un maître vaut-il un légendaire ? un Éclat, une rare ? un
   thème légendaire autant qu'un légendaire ?
4. **Qui est classé** — ceux qui ont joué ces quatre dernières semaines, comme
   aux duels (la maquette dit « sur 87 »), ou tous les profils.
5. **Où l'on entre** — un gros bouton sur « Mon profil » ; et peut-être la
   valeur sur la carte d'un joueur, « Comparer » à son pied.

## Ce que la vraie version demandera

- **La valeur au serveur.** `compteDeLaCollection` ne se calcule aujourd'hui
  que chez le propriétaire, sur sa page. La valeur de chaque profil se
  compterait d'une règle pure (`shared/`, à côté de `shared/collection.ts`),
  en fond et gardée, comme la moyenne des joueurs (`moyennesDesJoueurs`) —
  ses thèmes achetés, ses paliers des sentiers, ses bordures du journal des
  duels, ses badges, ses Éclats, ses fonds, ses gerbes —, jamais attendue par
  la page.
- **Une route** (et sa ligne dans `docs/reference/api-http.md`), réservée aux
  profils ; **ses constantes**, des choix de produit, dans
  `docs/reference/baremes.md`.
- **Les classements par `shared/classement.ts`** (invariant 15), les
  homonymes par `nomsAffiches` (invariant 17), chaque ligne avec ce que le
  joueur porte (`un-seul-avatar.test.ts`).
- **Une page de plus** (`/classement`) : `ACCOUNT_PAGES`, `ACCOUNT`, `TITRES`,
  `RESERVED_SLUGS`, `pageDeLAdresse` pour que le QG la ferme, `LISENT_LE_PROFIL`
  et le préchargement de l'accueil d'un profil (règle `client.md`).
- **Des tests** : aucun Divin dans une valeur ni dans un rang, ni masqué ni
  anonyme, les ex æquo.

## Rejouer la maquette

Le patch s'applique sur le code du 9 novembre 2026 (le commit `7fb947c`).
Depuis la racine, avec le Chromium de Playwright (`npm root -g`) :

```bash
git apply retours/2026-11-09/classement-des-collections/maquette/prototype.patch
npm run build -w client
cd server && npx tsx ../retours/2026-11-09/classement-des-collections/maquette/photos.ts ../export/classement-des-collections
```

Le patch posé, `npm run dev` puis `http://localhost:5173/classement?p=1` (ou
`2`, `3`) ; `?vue=entree&p=1`, le profil où l'on y entre ; `&face=hugo`,
`&axe=maitres`, `&amis`, `&record=maitres`, `&vitrine=hugo`,
`&bataille=malik` ouvrent ce qui s'ouvre au toucher. `git apply -R` du même
patch le retire.

| Fichier | Ce qu'il est |
|---|---|
| `maquette/prototype.patch` | la page de maquette (`client/src/views/classement/` : `ClassementMaquette.tsx` — l'entrée et l'aiguillage —, `Palmares.tsx`, `TableauDHonneur.tsx`, `Galerie.tsx`, `donnees.ts` — les joueurs inventés, le barème, les classements —, `classement.css`), son adresse (`shared/adresses.ts`, `main.tsx`, `titres.ts`) |
| `maquette/photos.ts` | le serveur jetable et les vingt et un états photographiés en 360 × 640 — le premier écran, la page entière, le bas des feuilles, sous Ivoire —, et `mesures.txt` |
