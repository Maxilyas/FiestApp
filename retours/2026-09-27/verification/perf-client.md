# Contre-expertise — perf-client (relue par le coordinateur)

La contre-expertise du groupe `mesures` devait reprendre ce rapport ; la
limite d'usage l'a coupée avant. Pour ne pas relancer un agent, le
coordinateur l'a relu lui-même : **à la lecture du code seulement, sans
rejeu des mesures**. Les verdicts ci-dessous sont donc plus prudents que ceux
des autres groupes.

| Constat | Annoncé | Verdict | Retenu | Pourquoi |
|---|---|---|---|---|
| perf-client-1 · les Divins verrouillés tournent sans fin dans « Apparence » | P2 | confirmé, gravité revue | P3 | Le mécanisme est exact ; l'ampleur (≈ 45 % d'un processeur ×4) est mesurée sans GPU, et la page du profil n'est pas celle qu'on garde ouverte en soirée |
| perf-client-2 · le chemin du QR a repris +69 à +259 ms | P3 | confirmé (sur mesure de l'expert) | P3 | Mesures A/B contre `a6fc98b` ; la piste (carte, fin de soirée, fête à la demande) garde le chemin de l'invité — à vérifier par `chemins.test.ts` |
| perf-client-3 · l'accueil d'un profil saute de 233 px (CLS 0,175) | P3 | confirmé (lecture) | P3 | `CarteDuJour` rend `null` jusqu'à `/api/jour/etat` (`Jour.tsx:71-84`), au-dessus des onglets |
| perf-client-4 · une galerie anime tous ses médaillons | P3 | confirmé (lecture) | P3 | Même famille que design-recompenses-4 (219 animations, confirmé P3 par la contre-expertise `ecrans`) |
| perf-client-5 · coût de recompenses-vitrine-9 | P3 | doublon (mesure) | P3 | Mesure de recompenses-vitrine-9, pas un constat neuf ; le revers (la grille du profil 228 ms plus tard) est à peser |
| perf-client-6 · un légendaire fait venir les cinq Divins | P3 | confirmé (lecture) | P3 | `medaillons.ts` importe les deux morceaux ensemble |
| perf-client-7 · paillettes et halos dans les listes | P3 | non confirmé | P3 | L'expert lui-même demande une mesure sur un vrai Android |

## perf-client-1

Le code confirme le mécanisme :

- `Divin.tsx:872` pose `dv-voile` sur un Divin verrouillé, et le dessine
  quand même avec sa nébuleuse tournante (`dv-nebuleuse`, 40 s), six étoiles
  qui scintillent (`dv-scintille`), une brume qui respire (`dv-brume`, 6 s)
  et une étoile qui bat (`dv-pouls`) — `Divin.tsx:925-942`.
- Les légendaires verrouillés, eux, sont figés : `.lg-verrou * { animation:
  none !important; }` (`styles.css:4347`). Aucune règle ne fait de même pour
  `.dv-voile`.
- Le gel des listes (`styles.css:4650-4657`) ne vise que les avatars des
  listes et des pastilles, pas la grille d'`Apparence`, onglet ouvert par
  défaut (`ProfilApp.tsx:421`).

Chaque profil, même neuf, a donc cinq Divins verrouillés qui s'animent en
permanence sur son onglet par défaut. Des animations SVG sur des éléments
enfants ne passent pas par le compositeur : le coût est réel. Mais la mesure
(420–430 ms/s de fil principal à ×4) est faite sans GPU, et la page du
profil se consulte, elle ne reste pas ouverte pendant une soirée. **P3**, et
la correction tient en une ligne :
`.dv-voile * { animation: none !important; }` — « rien pour le deviner »
vaut aussi pour le mouvement.
