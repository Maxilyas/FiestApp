# Où le serveur dépense son temps (`perf-serveur`)

**Ton angle** : ingénieur performance, côté serveur. **Ta question** : où le
serveur dépense-t-il son temps et sa mémoire pendant une soirée, et que
coûteraient une salle de 300 invités ou dix salles de 30 — sur l'offre
gratuite de Render (une instance modeste, qui s'endort) ?

**Ta méthode** : lis les chemins chauds — `core/engine.ts` (les vues
filtrées, leur diffusion), `core/space.ts` (l'instantané dédoublonné et
regroupé, invariant 4), `games/quiz.ts` (les vues, `vctx.memo`),
`core/answers.ts` et `core/scores.ts` (les écritures SQLite, synchrones),
`core/backup.ts` (la file du miroir), `core/recalcul.ts` (au démarrage),
`core/archive.ts`, et les routes qui servent `recap.json`, `bilan.json`,
`soirees.json` (calculées à chaque requête ?). Puis **mesure**, sur ton
propre serveur jetable, avec des scripts à toi : le temps de démarrage selon
la taille de l'historique (fabrique des dizaines de soirées archivées) ; le
temps de réponse des JSON publics selon l'historique ; le coût d'une
diffusion de vues à 50, 200, 500 invités ; la mémoire par invité ; ce que
coûte le miroir quand Turso répond lentement.

La machine est partagée (voir les consignes) : répète chaque mesure, donne
la charge, préfère les comptes (octets, appels, allocations) aux
chronomètres. Les mesures de latence de bout en bout sous charge sont la
mission de `perf-temps-reel`, qui passe après : toi, tu vas au code.

**Ce que tu rends, en plus du modèle** : les chemins chauds, chiffrés ; les
optimisations proposées avec le gain attendu et leur risque pour les
invariants (instantané dédoublonné, dérivations pures, file du miroir).
