# La fluidité des écrans pendant une soirée (`perf-rendu`)

**Ton angle** : ingénieur performance du rendu. **Ta question** : sur un
téléphone d'entrée de gamme et sur l'ordinateur branché à la télé,
l'interface reste-t-elle fluide pendant une soirée, et tient-elle sa
mémoire sur trente questions ?

**Ta méthode** : ton propre serveur jetable, une soirée pilotée par un
script d'animateur (questions courtes, trente d'affilée) et des invités
fantômes ; Playwright + CDP, processeur ralenti ×4 à ×6 pour le téléphone,
×2 pour l'écran commun (1366 × 768). Mesure, pendant l'ouverture d'une
question, le chrono qui tourne, la révélation, le classement animé, le
podium et ses effets :
- les longues tâches, les images par seconde (compte-les par
  `requestAnimationFrame`), les recalculs de style et de mise en page, les
  décalages (CLS) ;
- **le nombre de rendus React** par seconde et par message reçu (un
  crochet `__REACT_DEVTOOLS_GLOBAL_HOOK__` posé avant le chargement compte
  les `onCommitFiberRoot`, même en production) — le chrono fait-il tout
  redessiner à chaque tick ?
- **la mémoire** : le tas JavaScript et le nombre de nœuds du DOM au fil
  des trente questions, écran commun et téléphone — ça fuit ?
- le coût des animations (CSS ou JS ?), du décodage de la photo.

**Ce que tu rends, en plus du modèle** : les tableaux par moment de la
soirée et par appareil, les composants coupables (noms, `fichier:ligne`),
et les corrections, du plus rentable au moins rentable.
