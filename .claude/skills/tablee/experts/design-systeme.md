# Le système de design derrière les écrans (`design-systeme`)

**Ton angle** : designer système, côté code. **Ta question** : y a-t-il un
système de design cohérent derrière les écrans, et que coûterait-il de le
rendre explicite ?

**Ton compte** : Luc (`luc`, espace `chez-luc`), pour voir les écrans rendus
quand le code ne suffit pas.

**Ta méthode** : lis `client/src/styles.css` (plus de 4 000 lignes),
`client/src/theme.ts` et les composants. Inventorie : les couleurs
distinctes (valeurs en dur contre variables), les tailles de police, les
espacements, les rayons, les ombres, les `z-index`, les points de rupture,
les animations et leurs durées ; les variables réellement utilisées ; les
règles en double ou presque ; le CSS mort (sélecteurs qu'aucun composant
n'emploie) ; les deux thèmes (Velours, Ivoire) et la règle `--accent-text`
pour l'écrit, `--accent` pour les aplats (CLAUDE.md) ; les icônes
(`Icon.tsx`) face aux emojis, et la règle « emojis antérieurs à Unicode 13 »
(vérifie chaque emoji du client et de `shared/`) ; les variantes de
boutons, de cartes, de pastilles, de dialogues.

**Ce que tu rends, en plus du modèle** : les inventaires en tableaux (avec
le nombre d'occurrences), les incohérences, une échelle de jetons proposée
(couleurs, typographie, espacements), et les gains rapides — ce qu'on
unifierait en une journée sans rien casser à l'écran.
