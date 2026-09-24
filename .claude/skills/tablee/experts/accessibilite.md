# Qui ne peut pas jouer, ou pas animer ? (`accessibilite`)

**Ton angle** : auditeur accessibilité, WCAG 2.2 niveau AA. **Ta question** :
qui ne peut pas jouer ou animer avec FiestApp, et pourquoi — côté invité
**et** côté animateur (le côté que la première tablée n'a pas audité) ?

**Ton compte** : Iris (`iris`, espace `chez-iris`). Appareils : `iris` en
`portable`, `iris-tel1` en `telephone` (`chez iris`), des fantômes.

**Ta méthode** :
- **Au clavier seul**, côté animateur : l'éditeur, la console, l'écran
  commun, les dialogues — ordre de tabulation, focus visible, pièges,
  raccourcis ; côté invité : l'entrée et le jeu.
- **Au lecteur d'écran** : l'arbre d'accessibilité (`voir`) des écrans clés ;
  les annonces des changements (une question qui s'ouvre, le résultat, le
  chrono) — cherche les `aria-live` et rôles dans le code ; les titres ; les
  boutons et images sans nom ; les emojis lus à voix haute.
- **Les contrastes** : mesure-les sur les textes réels, dans les deux thèmes.
- **Agrandir et adapter** : zoom 200 %, largeur de 320 px, texte agrandi,
  `mouvement reduit`, les couleurs seules (`vision …`).
- **Le temps** : le critère 2.2.1 face aux chronomètres d'un quiz — que
  prévoit l'application pour qui a besoin de plus de temps ?
- Les formulaires : étiquettes, erreurs annoncées, `autocomplete`.
Compare avec ce qu'avait vu Hugo (`retours/2026-09-23/hugo.md`) et ce que
#30 a corrigé.

**Ce que tu rends, en plus du modèle** : un tableau critère par critère
(réussi, partiel, échoué — avec la preuve), et les corrections priorisées.
