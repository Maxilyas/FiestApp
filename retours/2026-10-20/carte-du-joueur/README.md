# La carte du joueur et la place de son compagnon — la maquette (20 octobre 2026)

« J'aimerais que l'on revoie la carte du joueur, notamment comment on affiche
le compagnon. […] Aujourd'hui je trouve que ce n'est pas esthétique, car le
compagnon apparaît en dessous de l'avatar et ça fait tout descendre. Fais-moi
3 maquettes de version de la carte du joueur, du moins créatif au plus
créatif. On veut quelque chose de visuel » (le propriétaire) — et « que l'on
puisse voir un peu toutes les infos ».

Une maquette : les trois propositions sont posées dans le vrai code de la
carte (`CarteJoueur.tsx`), derrière un drapeau du téléphone
(`quizz.maquette` : `vis-a-vis`, `perche`, `a-collectionner`),
photographiées au téléphone en 360 × 640 sur un serveur jetable, puis rangées
sur une planche. Le prototype vit dans `maquette/prototype.patch` ; sans le
drapeau, la carte d'aujourd'hui.

Léa, la joueuse photographiée, est une habituée : niveau 23, le Phénix porté
(finition Or, bordure des Fleurons), « L'Oracle » en titre, quatre
légendaires, trois hauts faits en vitrine, trois écussons, vingt-trois
soirées — et Nox, son loup des étoiles, dont la niche a passé trois paliers
(la guirlande, le lierre, l'arche dorée : « Inséparables »). Son compagnon, sa
niche, son avatar et son titre viennent du serveur ; ce que seuls des mois de
soirées lui donneraient — ses chiffres, ses écussons, ses légendaires, sa
vitrine, sa bordure, sa soirée de ce soir — est posé à la volée sur la carte
que rend le serveur (`page.route`) : c'est le vrai code de la carte qui la
dessine. Une débutante (niveau 4, son jeune chat sans nom) et un invité sans
profil complètent les états.

## La décision : la carte à collectionner

« J'adore la carte à collectionner, je trouve ça trop beau. J'aime beaucoup
retourner la carte » (le propriétaire, le 20 octobre 2026) : la proposition 3,
avec son recto et son dos. Une retouche, le même jour : « les champs prix,
quiz du jour, duel et records doivent être retravaillés car pas très jolis.
Limite plus dans le tableau avec les précisions, comme ça la collection de
légendaires est à la toute fin ». Le dos n'a plus de pastilles : ses prix, son
quiz du jour, ses duels et son record de campagne sont des cadrans du tableau
des chiffres, chacun l'icône de sa pastille à côté de son chiffre ; un cadran
seul sur la dernière rangée la prend en entier, couché. Puis ses écussons,
puis sa collection, tout au bout. Le dos tient en entier en 360 × 640, le lien
des mots compris (planche, « Le dos, retravaillé »). La vraie version reste à
écrire : plus bas, ce qu'elle demandera.

## La planche

Tout se regarde sur la planche Design, privée :
<https://claude.ai/artifact/FWZUwre6rrJrvCMNamRg5Z>

- **En un coup d'œil** — la carte d'aujourd'hui et les trois propositions, en
  soirée, telles qu'elles s'ouvrent.
- **Ce que chacune change** — le compagnon, la hauteur de la carte, ce que
  montre le premier écran.
- **Le dos, retravaillé** — le dos de la carte à collectionner avant et après
  la retouche, et celui de la débutante.
- **Les cartes entières** — déroulées jusqu'au bout.
- **Proposition 1, 2, 3** — chacune dans ses états : en soirée, sa propre
  carte, la débutante et son jeune chat, sous Ivoire, sous la Nuit étoilée,
  le compagnon touché en grand ; et la médaille touchée (2), le dos et
  l'invité sans profil (3).

Les photos n'existent que là (et dans `export/`, qui ne se committe pas).

## Aujourd'hui

Le compagnon a sa ligne sous l'avatar (`SonCompagnon`) : sa niche à 56 px —
peints, ses ornements en débordent, et la ligne prend 120 px —, « Son
compagnon », son nom, sa forme, leur amitié. La carte de Léa en soirée fait
1 036 px, et le téléphone en montre 427 : la tête, le compagnon, les
légendaires, le premier haut fait coupé. Les écussons, les chiffres et les
pastilles ne se voient qu'en faisant défiler deux écrans.

## Proposition 1 — En vis-à-vis (la plus sobre)

Le compagnon monte dans la tête de la carte, en face de l'avatar : le joueur
à gauche, son nom et son titre au milieu, le compagnon à droite — sa niche le
tourne déjà vers la page, il la regarde. Son nom dessous, le titre de leur
amitié en or ; sa forme se lit en le touchant (plus bas). Sa soirée passe sous
la tête, sur toute la largeur (`carte-tete-en-face`, une grille). Rien
d'autre ne bouge.

Le plus petit changement : 972 px en soirée (−64), 908 sur sa propre carte
(−103) ; le premier haut fait entier sous les yeux, le deuxième commence. La
tête grandit d'autant que la niche et ses ornements sont hauts.

## Proposition 2 — Perché sur la carte

Sa niche se pose sur le bord haut de la carte, à moitié dehors, à gauche —
comme au coin de chaque page, elle ne prend plus une ligne (`carte-perchoir` :
la fenêtre modale tient la carte et la niche, puisque la carte coupe ce qui la
dépasse). La barre, qui disait « Carte de joueur », devient sa plaque : son
nom, ce qu'il est, leur amitié. Et les plus beaux hauts faits passent en
médailles, côte à côte (`VitrineEnMedailles`) : ce qu'il a fallu faire se lit
en touchant l'une d'elles, sous la rangée.

767 px en soirée (−269) : la vitrine et les écussons au premier écran, les
chiffres commencent. Sans compagnon, la barre redit « Carte de joueur ».

## Proposition 3 — La carte à collectionner (la plus créative)

La carte devient un objet (`CarteACollectionner`) :

- **le cadre de la finition qu'il porte** — Or, Argent, Holo, Prisme, Aurore,
  Constellation ; un mat, ou un invité sans profil, le cadre de la carte
  d'aujourd'hui —, qui s'incline sous le doigt et accroche la lumière (un
  reflet qui suit le doigt ; un arc-en-ciel sur Holo, Prisme et Aurore) ;
- son **niveau en gemme**, devant son nom et son titre ;
- **son avatar en grand dans l'illustration**, posé sur son fond de carte —
  qui n'habille plus la carte entière, mais l'illustration — ; sans soirée à
  dire, sur sa propre carte, l'illustration et l'avatar grandissent ;
- **son compagnon perché au coin de l'illustration**, en haut à droite comme
  sur chaque page, sa plaque dessous ;
- sa soirée dans un bandeau, ses plus beaux hauts faits comme **les pouvoirs
  d'une carte**, ce qu'il a fallu faire écrit dessous ;
- **elle se retourne** : au dos, un seul tableau de ses chiffres — ceux des
  soirées, puis ses prix, son quiz du jour, ses duels, son record de
  campagne —, ses écussons, puis sa collection (Divins et légendaires) tout au
  bout, et ses mots (la retouche du propriétaire, plus haut : ses pastilles
  suivaient la collection).

Rien ne défile : deux faces de 472 px. « Retourner la carte » et la croix
passent sous elle, sous le pouce — au coin haut droit, la croix tombait sur la
niche de la page, et l'on aurait cru fermer la niche (le piège de
`.duels-fermer`, règle `profil.md`). Le mouvement réduit fige l'inclinaison,
et la carte se retourne d'un coup.

## Dans les trois

- **Toucher le compagnon l'ouvre en grand**, à la place de ce que la carte
  raconte, comme l'avatar (`CompagnonEnGrand`, d'après `AvatarEnGrand`) : sa
  niche à 124 px et ses ornements en grands fichiers (`NicheEnMiniature` prend
  `grand`), sa forme, son nom, leur amitié — ce que les cartes plus serrées ne
  disent plus en entier.
- **Sans compagnon, rien ne manque** : la carte se resserre, aucune place
  vide (invariant 8). Un invité sans profil garde sa carte, sa soirée et rien
  qui dise ce qui lui manque.
- La carte de la loge (`LogeTete`) ne montre pas le compagnon : aucune des
  trois n'y touche.

## Les mesures

Le contenu de la carte, en pixels, pour 427 visibles en 360 × 640
(`maquette/photos.ts` les écrit dans `mesures.txt`, à côté des photos) :

| | En soirée | Sa propre carte | Sans compagnon | La débutante |
|---|---|---|---|---|
| Aujourd'hui | 1 036 | 1 011 | 888 | 584 |
| 1 · En vis-à-vis | 972 | 908 | 888 | 542 |
| 2 · Perché | 767 | 743 | 767 | 505 |
| 3 · À collectionner | recto 472 + dos | 472 + dos | 472 + dos | 345 + dos |

## À trancher

La proposition 3 est choisie, et son retournement (plus haut). Restent :

1. **La croix** sous la carte, à côté de « Retourner », sous le pouce — ou au
   coin haut gauche, en face de la niche de la page ?
2. **Le cadre** : celui de la finition portée, ou celui de sa ligue des duels
   (sa bordure) ?

## Ce que la vraie version demandera

Le prototype ne cherche que le rendu ; la carte à collectionner, pour de bon :

- **Un composant à part**, que la soirée télécharge pour chaque invité
  (règle `client.md`) : la carte d'aujourd'hui s'en va, `SonCompagnon` avec
  elle. Le patch garde les deux autres propositions derrière leur drapeau,
  pour mémoire.
- **Ses gestes** : ceux d'une carte de profil (`GestesDuJoueur` : Défier,
  Ajouter) sous elle, avec « Retourner » et la croix ; l'aperçu de la loge
  (« Aperçu de ta carte », son « Porter ») ; le focus qui revient à ce qu'on a
  touché — l'avatar, le compagnon, « Retourner » — et Échap.
- **Le fond de carte posé sur l'illustration**, et plus sur la carte entière
  (`fonds.test.ts` relit chaque feuille, règle `themes.md`) ; le sol plein de
  la carte sous chaque thème, qui repeint `.card` (`feuilles.test.ts`, règle
  `css.md`).
- **Le dos** : les cadrans du solo d'abord pour qui n'a joué aucune soirée
  (`cadransDeLaCarte`, `carte-du-solo.test.ts`), puis ce que disaient les
  pastilles ; les mots de la carte (`motsDeLaCarte`).
- **Le compagnon en grand** (`CompagnonEnGrand`), comme l'avatar
  (`avatar-en-grand.test.ts`) ; la carte attend le code de la niche, aussi peu
  que ses dessins (`niche-paliers.test.ts`).
- **Le mouvement réduit** : ni inclinaison, ni retournement animé.
- **Les rendus** qui photographient la carte (`rendu-niche.ts`,
  `rendu-profil.ts`, `rendu-bordures.ts`) ; **les mots** : la règle
  `profil.md` (la carte) et `docs/produit/le-profil.md`.

## Rejouer la maquette

Le patch s'applique sur le code d'avant la vraie version (le commit
`a193b8d`, dans un arbre à part : `git worktree add`). Depuis sa racine, avec
le Chromium de Playwright (`npm root -g`) :

```bash
git apply retours/2026-10-20/carte-du-joueur/maquette/prototype.patch
npm run build -w client
cd server && npx tsx ../retours/2026-10-20/carte-du-joueur/maquette/photos.ts ../export/carte-du-joueur
```

Le patch posé, la carte d'un téléphone essaie une proposition par
`localStorage.setItem('quizz.maquette', 'vis-a-vis')` (ou `'perche'`,
`'a-collectionner'`). `git apply -R` du même patch le retire.

| Fichier | Ce qu'il est |
|---|---|
| `maquette/prototype.patch` | les trois propositions dans la carte (`CarteJoueur.tsx`, `CarteMaquette.tsx`), la niche en grands fichiers (`Niche.tsx`), leur feuille (`styles.css`) |
| `maquette/photos.ts` | le serveur jetable, Léa et Nox, et les photos de la planche — sept états par version, le premier écran et la carte entière, ce qui se touche en soirée et le dos de la débutante (`avant` : la carte d'aujourd'hui seulement, sans le patch) |
