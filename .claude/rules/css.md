---
paths:
  - "client/src/**/*.css"
  - "server/test/{design,typographie}.test.ts"
---

# Le CSS du client

## Les jetons

- **Côté client** : `--accent-text` pour ce qui s'écrit, `--accent-text-hover`
  pour son survol, `--accent` pour les aplats (le contraste d'Ivoire en
  dépend) ; les trois métaux d'un palier écrivent en `--bronze-text`,
  `--argent-text` et `--or-text` ; aucun texte ne descend sous `--t-label`
  (11 px, celui de `.label`, en `rem` pour suivre le texte agrandi), les
  petites boîtes prennent `--radius-xs`, et l'or du décor des fonds se lit
  dans `--fond-or`, posé sur `.carte-fond` (`design.test.ts` y veille) ; le
  focus n'a qu'un anneau, `--focus`, posé une fois pour tout
  élément (`:where(…):focus-visible`) — un composant n'en règle que
  l'`outline-offset`.

## Les pièges

- **En CSS, `transform` se compose APRÈS `rotate`**, et une animation qui pose
  `transform` écrase celui de l'élément : le toast, centré par
  `translateX(-50%)`, partait sur la droite. Centre par marges.
