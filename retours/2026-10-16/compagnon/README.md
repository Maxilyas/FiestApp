# Le compagnon qui suit — la maquette (16 octobre 2026)

Rien de ceci n'est dans l'application. C'est une maquette : la niche du
compagnon et ses réactions sont posées dans les vrais écrans d'une soirée
jouée (Playwright, `addInitScript`) pour décider où il vit et comment il
accompagne le joueur, avant d'écrire une ligne du vrai code.

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

## Ce qui est décidé

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
