# Modèle de rapport d'expert

À écrire dans `export/evaluations/rapports/<ta mission>.md`, en français.

```markdown
# <La mission> — rapport de l'expert <angle>

## En bref
Trois à cinq phrases : l'état des lieux, et les trois améliorations qui
rapporteraient le plus.

## Méthode
Ce que j'ai fait, sur quels appareils et tailles d'écran, avec quels outils
(pilote, scripts, lecture du code), en combien de temps ; ce que je n'ai pas
pu couvrir.

## Constats
Du plus important au moins important. Pour chacun :

### <n>. <Titre court>
- **Où** : la page, l'écran, le composant — et `fichier:ligne` si lu dans le code.
- **Constat** : ce qui se passe, précisément.
- **Preuve** : capture(s), mesure, extrait de `voir`, étapes pour le rejouer.
- **Qui ça touche, ce que ça coûte** : à la soirée, à l'invité, à l'animateur.
- **Statut** : bug confirmé · non confirmé · friction · idée · tension avec
  un parti pris (lequel).
- **Piste** : la correction proposée, concrète (un extrait de code, un texte,
  un schéma d'écran).
- **Priorité · effort** : P1 (abîme la soirée de toute une salle) · P2 (celle
  de quelques-uns) · P3 (confort) — S (quelques lignes) · M (une journée) ·
  L (un lot).

## Mesures et cartes
Les tableaux, décomptes et schémas propres à ta mission (Mermaid bienvenu) :
le parcours pas à pas, la carte des pages, les temps, les tailles…

## Ce qui marche — à ne pas casser
Ce qui est réussi, et pourquoi il faut le garder.

## Recommandations, dans l'ordre
Une liste numérotée, la plus rentable d'abord, chacune avec sa priorité et
son effort.

## Limites
Ce que ce rapport ne dit pas ; ce qui reste à vérifier sur un vrai appareil.
```
