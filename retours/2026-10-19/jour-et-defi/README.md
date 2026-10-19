# Le quiz du jour et le défi de la semaine, au même endroit — la maquette (19 octobre 2026)

« J'aimerais mettre le quiz du jour et le défi de la semaine au même endroit.
Je veux bouger le défi de la semaine sur la page d'accueil et faire comme une
sorte d'onglet avec le quiz du jour, tout en gardant par défaut le quiz du
jour. Je pense que beaucoup de gens ne savent pas qu'il y a le défi de la
semaine car il est caché dans la campagne » (le propriétaire).

Une maquette, pas encore une décision : les onglets sont posés dans le vrai
code de l'accueil, derrière un drapeau du téléphone (`quizz.maquette`),
photographiés au téléphone en 360 × 640 sur un serveur jetable, puis rangés
sur une planche. Rien de l'application ne change : le prototype vit dans
`maquette/prototype.patch`.

Léa, la joueuse photographiée, joue le quiz du jour depuis douze jours et n'a
jamais ouvert la campagne ; neuf joueurs ont relevé le défi. C'est le cas où,
aujourd'hui, le défi ne paraît **nulle part** sur l'accueil : le bouton de la
campagne n'en parle qu'à qui l'a déjà jouée (`defiDAccueil`), et il se tait
aussi une fois le défi fini.

## La planche

Tout se regarde sur la planche Design, privée :
<https://claude.ai/artifact/KSJnkkM3FuQpf98GQ6zvbj>

- **En un coup d'œil** — l'accueil d'aujourd'hui et les deux propositions, le
  quiz du jour ouvert d'office.
- **Les accueils entiers** — ce que chacune pousse sous le premier écran.
- **Proposition 1** et **Proposition 2** — chacune dans ses cinq états : le
  quiz du jour d'office, le défi à relever, commencé, relevé, le quiz joué.
- **Dans les deux cas** — le défi quitte la campagne.

Les photos n'existent que là (et dans `export/`, qui ne se committe pas).

## Proposition 1 — la tuile à deux onglets

La tuile du quiz du jour garde sa place et sa forme ; deux onglets fins la
coiffent, « Quiz du jour » et « Défi de la semaine » (`onglets-fins`). L'onglet
du défi montre une tuile faite comme les autres : « 9 joueurs l'ont relevé ·
jusqu'à dimanche », « À relever » ; commencé, « 4 bonnes réponses :
reprends-le », « À finir » ; relevé, sa place. Le plus petit changement : la
page grandit de 48 pixels, et les duels passent sous le menu. Mais l'onglet
du défi en dit peu : la découverte tient à son nom et à son point.

## Proposition 2 — le classeur

Deux onglets de classeur (`onglets-classeur` : celui qu'on regarde est de
l'étoffe de la carte et couvre son trait, l'autre reste en retrait), et une
carte qui en dit plus : le chiffre du moment en grand, comme au héros du défi
(« 12 jours de série — joue avant minuit pour la garder », « 9 joueurs l'ont
relevé — clôture dans 4 jours ») ; une ligne qui dit où en est la salle et
ouvre le classement (« Déjà 6 joueurs aujourd'hui », « Hugo mène le
classement · 11 ») ; un bouton qui fait jouer. Plus haute (115 pixels de
plus), elle passe **en tête de « Seul »** : à la place du quiz du jour, son
bouton tombait sous le menu en 360 × 640, et c'est la campagne qui passe sous
le pli. Elle s'écarte de la règle de l'accueil — des gros boutons qu'on lit
d'un coup d'œil, chacun ouvrant sa page (`AccueilJouer`).

## Dans les deux cas

- **Le quiz du jour d'office**, toujours : rien ne se retient d'une visite à
  l'autre.
- **Un point d'or** sur l'onglet où quelque chose attend — le quiz à jouer, le
  défi à relever ou à finir —, qui s'éteint une fois fait. L'or de la
  pastille « À jouer », pas le rouge des défis reçus, qui dit ce que d'autres
  ont envoyé.
- **Rien ne saute** quand on change d'onglet : les deux panneaux tiennent la
  même case, l'autre caché, et le bloc garde la hauteur du plus grand.
- **Le défi quitte la campagne** : trois onglets — Série, Sentiers, Apprendre —,
  et le bouton de la campagne ne parle plus de lui. Il garde sa page — son
  classement, la semaine passée, sa correction —, « ← Accueil » en tête, sans
  les onglets de la campagne.

## À trancher

1. La proposition 1 ou la 2 — ou l'allure du classeur sur la tuile de la 1.
2. Le quiz du jour joué, l'accueil s'ouvre-t-il sur le défi s'il reste à
   relever ? La maquette garde le quiz du jour, comme demandé.
3. « Relever le défi », à l'accueil, ouvre la page du défi, où un second
   bouton lance la partie : la lancer d'un seul toucher ?

## Ce que la vraie version demandera

Le prototype ne cherche que le rendu ; la vraie version, une fois choisie :

- **L'accueil lit le défi de front avec son en-tête** (`ProfilDAccueil`) :
  `defiDAccueil` ne dit rien à qui n'a jamais joué la campagne, ni une fois le
  défi fini, et ne connaît pas la tête du classement. Le prototype demande
  `GET /api/campagne/defi` en plus — et, pour la proposition 2,
  `GET /api/jour`, que seule la page du jour précharge (règle `client.md`).
- **Rien du quiz du jour dans le code de l'accueil** : le prototype importe
  `Jour.tsx` pour `ontGagneHier`, et l'accueil anonyme partage ce fichier.
- **La page du défi** a son adresse (`/campagne#defi` aujourd'hui, que la
  mission du défi ouvre aussi, `shared/missions.ts`) : une page à elle passe
  par `ACCOUNT_PAGES`, `TITRES` et `RESERVED_SLUGS` (règle `client.md`), et
  `docs/reference/adresses.md` ; l'ancienne adresse y mène encore. La partie
  se joue toujours sur l'écran de la série (`CampagneApp`).
- **Le défi fermé** (`/admin#maintenance`) : son onglet le dit, comme le
  bouton éteint d'aujourd'hui.
- **Les mots** : la tablée touche les boutons par leur nom (règle
  `tablee.md`), et `docs/produit/la-campagne.md` dit où vit le défi ; les
  règles `profil.md` et `campagne.md` racontent le bouton de la campagne.
- **Les tests** : le point de chaque onglet et l'onglet ouvert d'office, la
  campagne à trois onglets (`campagne-ouverture.test.ts`), le bouton de la
  campagne sans le défi.

## Rejouer la maquette

Depuis la racine, avec le Chromium de Playwright (`npm root -g`) :

```bash
git apply retours/2026-10-19/jour-et-defi/maquette/prototype.patch
npm run build -w client
cd server && npx tsx ../retours/2026-10-19/jour-et-defi/maquette/photos.ts ../export/jour-et-defi
```

Le patch posé, l'accueil d'un téléphone essaie une proposition par
`localStorage.setItem('quizz.maquette', 'tuile')` (ou `'carte'`). `git apply
-R` du même patch le retire.

| Fichier | Ce qu'il est |
|---|---|
| `maquette/prototype.patch` | les onglets dans l'accueil (`JourEtDefi.tsx`), le point d'un onglet (`Onglets.tsx`), la campagne à trois onglets et la page du défi à elle (`CampagneApp.tsx`), leur feuille |
| `maquette/photos.ts` | le serveur jetable, la salle et Léa, et les dix-sept photos de la planche (`avant` : les trois d'aujourd'hui seulement, sans le patch) |
