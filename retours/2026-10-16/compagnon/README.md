# Le compagnon qui suit — la maquette (16 octobre 2026)

Une maquette : la niche du compagnon et ses réactions sont posées dans les
vrais écrans d'une soirée jouée (Playwright, `addInitScript`) pour décider où
il vit et comment il accompagne le joueur, avant d'écrire une ligne du vrai
code. La niche elle-même est dans l'application depuis le 18 octobre 2026
(plus bas) ; ses réactions, pas encore.

## La planche

Tout se regarde sur la planche Design, privée : <https://claude.ai/artifact/Uq6R2zKDJwWThp9chfrPGL>

- **L'améliorer** — cinq expériences filmées, la recherche, la recommandation,
  et le film d'un quiz de soirée entier (43 s, sous-titré).
- **Sa niche** — la niche en haut à droite, sur dix pages, et son film.
- **Sa place** — les quatre propositions d'avant (perchoir, sol, loge, scène).
- **Avec nous** et **Les écrans** — le compagnon vivant, posé par-dessus les
  écrans, et les premières captures.

Les films et les images n'existent que là (et dans `export/`, qui ne se
committe pas).

## Le 18 octobre, la nuit : la niche dans l'application

Le point 1 du principe (`principe.md`, § 10) est construit pour de vrai, plus
une maquette : `client/src/components/Niche.tsx`, posée sur chaque page qui lit
le profil, au coin haut droit de la colonne du téléphone ; le décor peint de
sa forme et lui en buste, cadré forme par forme sur le dessin livré ; sa
fiche au toucher — sa forme, sa jauge, « Le caresser », « Ses formes » ; son
repli quand la page défile. Le serveur retient le compagnon de la niche
(`profiles.niche`) : l'adoption l'y installe, la boutique en change d'un
toucher, et **c'est lui qui grandit**, qu'on le porte ou non — qui n'a jamais
choisi garde celui qu'il porte. Chaque page lui laisse son coin
(`body.avec-niche`) ; `server/scripts/rendu-niche.ts` la photographie sur
vingt-quatre écrans et dit ce qui passerait dessous : rien, en 360 × 640 comme
en 390 × 844. Les humeurs à la révélation, Lumi et les paliers après 500
attendent leur tour (§ 10, points 2 à 6).

## Le 18 octobre, le soir : la niche, son décor peint, et Lumi

« Je préfère la niche au médaillon […] je veux garder cette continuité »
(le propriétaire). La niche reste donc, mais son fond devient le **décor
peint de l'avatar** (`niche.js`, `o.fond`) : la pleine lune derrière le loup
adulte, la forêt sous la neige du jeune — la déco ne se perd plus. Page
« Lumi, la luciole » de la planche :

- **Lumi, la luciole** — la compagne de l'Expédition, peinte par la chaîne
  (`server/scripts/anime/compagnons.ts luciole --style=lumineux`) : 24 images,
  3,37 $. Ses fichiers sont gardés dans `luciole-peinte/` — `app/` (ce que
  `livrer-compagnons.ts` attend dans `export/compagnons/luciole/app`), les
  originaux des cinq illustrations, les consignes et le journal des coûts :
  recopiés dans `export/compagnons/luciole/`, la chaîne les reprend sans
  repayer. Le reflet rose de l'adulte (ses ailes et sa traînée, translucides
  sur le magenta) est corrigé : sa découpe les rend opaques (`opaque`, une
  consigne de plus à la chaîne) — 3,92 $ en tout.
  Le film d'un quiz entier avec elle : `COMPAGNON=luciole … quiz-entier.ts film`.
- **Après 500** — rien n'existe aujourd'hui. La proposition : la niche
  s'embellit, et garde chaque ornement (`paliers.js`) — 1 500 une guirlande,
  4 000 du lierre et des fleurs, 10 000 l'arche dorée et son étoile, 25 000 un
  halo et un ciel qui scintille : recalés sur le rythme lu en production.
- **Les avatars** — la proposition : on garde aussi chaque forme atteinte en
  avatar, comme aujourd'hui ; on ne reprend rien à qui porte déjà le sien.

Les trois planches se refont sans serveur : `planche-niche.ts`. **Le principe,
consolidé** — tout ce qui est décidé, les chiffres de production et ce qui
reste à construire : `principe.md` (et la page « Le principe » de la planche).

## Le 18 octobre : le médaillon plutôt que la niche (écarté le soir même)

« On va perdre l'avatar et surtout la déco, ils sont super jolis si on met ça
sur l'avatar » (le propriétaire). Le compagnon reste donc un avatar qu'on
porte, comme aujourd'hui, et c'est **son médaillon** — le SVG même que l'appli
dessine, décor, anneau et débord compris — qui suit en haut à droite pendant
un quiz (`maquette/medaillon.js`, film : `maquette/medaillon.ts`, page « Son
médaillon » de la planche). Les humeurs peintes se posent au pixel près sur le
dessin livré (`humeurs-perso/`, aucun pixel ne dépasse) ; à 58 px son visage
est petit, alors il grandit (×1,3) à la révélation le temps de sa réaction.
Au podium, il sort, et le médaillon garde sa lune.

Sur la même page : la luciole, un compagnon que donne un haut fait de
l'Expédition (sa première traversée), et la technique pour l'animer davantage
sans perdre la peinture ni la fluidité.

## Ce qui était décidé avant

- Il ne se porte pas comme avatar ; aucun bonus en solo ; à l'écran commun,
  seulement l'arrivée, le podium et la métamorphose ; il a un nom (Nox, le
  loup de Léa).
- Sa place : une **niche** de 54 × 62 en arche, toujours en haut à droite, sur
  toutes les pages du téléphone ; la première ligne de chaque page s'arrête
  avant elle. Sans compagnon (l'invité anonyme, un profil qui n'en a pas), pas
  de niche : la ligne va jusqu'au bord (invariant 8).

## Ce que je recommande — « calme, rare, de ton côté »

C'est ce que montre le film du quiz entier (`maquette/quiz-entier.ts`) :

1. Pendant la question, il ne bouge pas.
2. Quand on touche une réponse, il retient son souffle — le téléphone ne sait
   pas encore si elle est juste (invariant 1).
3. Une bonne réponse le nourrit : des étincelles vont des points à sa niche,
   sa jauge paraît le temps du repas, « +1 », il sautille.
4. Une ratée : dépité avec toi, jamais déçu de toi — la pluie reste chez lui.
5. Une bonne réponse rare (peu l'ont trouvée) : une bulle de cœurs en plus.
6. Une forme atteinte, un podium : il sort de sa niche, une fois par quiz au
   plus ; dehors, près du pouce, on peut le caresser.
7. Toucher la niche ouvre sa fiche ; la caresse ne rapporte rien. La niche se
   replie quand la page défile.

## Ce qui reste

- **Le vrai test** : montrer le film, ou jouer une vraie soirée, et demander
  après « que faisait ton compagnon ? ». Sans réponse, il est devenu un décor.
  Une tablée d'agents ne le dirait pas : ils ne s'habituent pas.
- Au podium, le « +50 XP » de l'appli et sa sortie arrivent ensemble : les
  enchaîner, l'expérience d'abord.
- Pas encore filmé : le réveil qui rapporte la carte postale de la soirée,
  « Le laisser dormir » (les volets comme sourdine), deux ou trois peintures
  par humeur contre l'usure, la forme de l'ombre présentée comme un cadeau.
- La recherche (`recherche.md`) : quatorze jeux à compagnon, ce qu'ils font,
  ce qui les fait détester, et des idées pour la niche.

## Rejouer la maquette

Depuis `server/`, avec le Chromium de Playwright (`npm root -g`) et ffmpeg :

```bash
npx tsx ../retours/2026-10-16/compagnon/maquette/quiz-entier.ts film     # le quiz entier, sous-titré
npx tsx ../retours/2026-10-16/compagnon/maquette/quiz-entier.ts essai    # le même, en images de contrôle
npx tsx ../retours/2026-10-16/compagnon/maquette/experiences.ts tout     # les cinq expériences
npx tsx ../retours/2026-10-16/compagnon/maquette/niches.ts photos        # la niche sur toutes les pages (ou film)
```

Ils écrivent dans `maquette/films/`, `captures/` et `controle/`, que git
ignore.

| Fichier | Ce qu'il est |
|---|---|
| `niche.js` | la niche : son cadre, son décor, ses humeurs, la place que chaque page lui laisse |
| `niche-plus.js` | les expériences : jauge, nourrir, bulle, sortie, volets, repli, fiche — et le calme, le souffle retenu, la sortie qu'on caresse |
| `quiz-entier.ts` | le film du quiz entier, sous-titré |
| `experiences.ts` | les cinq films d'expériences |
| `niches.ts` | la niche photographiée et filmée sur toutes les pages |
| `places.js` · `places.ts` | les quatre places réservées d'avant |
| `page.js` · `vivant.js` · `solo.ts` · `soiree.ts` · `films.ts` | le premier essai : le compagnon posé par-dessus les écrans, puis vivant |
| `humeurs/` · `humeurs.py` | les quatre humeurs peintes de chaque forme, recadrées au même cadre |
| `preparer.py` · `niche-essai.mjs` | le recadrage des captures, la planche d'essai du cadrage |
