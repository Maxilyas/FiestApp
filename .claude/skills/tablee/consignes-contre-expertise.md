# Consignes — contre-expert

Un ou plusieurs experts ont rendu leur rapport (`export/evaluations/rapports/<mission>.md`
et `.json`). Toi, tu ne cherches rien de neuf : tu essaies de **réfuter** ce
qu'ils ont trouvé. Un faux positif envoyé à l'équipe lui coûte une journée ;
un vrai bug écarté à tort coûte une soirée à une salle entière. Sois
sceptique, pas expéditif.

## Ce que tu relis

Tous les constats **P1 et P2**, et les P3 de nature `bug`, `securite` ou
`donnees` ; les autres P3 (frictions, idées), un coup d'œil suffit — dis
seulement s'ils tiennent.

Pour chacun :

1. **La reproduction** : relance-la (`cd server && nice -n 10 node --import tsx
   --test --test-timeout=120000 ../export/evaluations/<mission>/<nom>.test.ts`).
   Échoue-t-elle, et **pour la raison annoncée** ? Lis-la : teste-t-elle ce
   qu'elle prétend ? Appelle-t-elle le code comme l'application l'appelle,
   ou par un chemin qu'aucun client ne prend (une méthode interne, une
   charge que le vrai client n'envoie jamais — ce qui peut rester une faille
   si un client forgé peut l'envoyer) ? Une course rejouée par un `await`
   rallongé à la main peut-elle se produire avec les vrais temps ?
2. **Le chemin du code** : relis-le toi-même, depuis la porte d'entrée
   (route, message socket, minuterie). Cherche la garde que l'expert a
   manquée : une validation en amont, une vérification d'espace, un verrou,
   une contrainte d'unicité, un invariant qui l'empêche.
3. **La réalité** : sur la vraie production (Render, une seule instance,
   Turso, des invités au téléphone), qui le vivrait, combien de fois, avec
   quel dommage ? La gravité annoncée est-elle la bonne ?
4. **Les partis pris** : un constat qui heurte « La direction » du README ou
   un invariant voulu du `CLAUDE.md` est une **tension**, pas un bug.
5. **Les doublons** : le même défaut vu par un autre expert (lis les autres
   JSON de `export/evaluations/rapports/`), ou déjà rapporté et corrigé
   (`retours/2026-09-2*/`).

## Tes verdicts

- **confirmé** : rejoué et réel, la gravité annoncée tient ;
- **confirmé, gravité revue** : réel, mais plus ou moins grave qu'annoncé
  (dis laquelle et pourquoi) ;
- **réfuté** : faux, ou impossible en production — dis ce qui l'empêche,
  `fichier:ligne` ;
- **incertain** : tu ne peux pas trancher — dis ce qu'il faudrait pour le
  faire ;
- **tension** : c'est un parti pris à arbitrer, pas une correction ;
- **doublon** : cite l'autre constat.

Si tu vois une meilleure correction que celle proposée, donne-la.

## Les règles

Celles de `consignes-audit.md` : aucun fichier suivi par git modifié, un
fichier de test à la fois sous `nice -n 10`, rien laissé allumé. Tu peux
écrire tes propres reproductions dans `export/evaluations/verification/<groupe>/`.

## Ce que tu rends

- `export/evaluations/verification/<groupe>.md` : un tableau (constat ·
  gravité annoncée · verdict · gravité retenue · en une ligne pourquoi), puis
  pour chaque constat relu ton raisonnement, avec ses preuves ;
- `export/evaluations/verification/<groupe>.json` : un tableau d'objets
  `{ "id", "verdict", "gravite", "raison", "repro_rejouee": true|false,
  "correction": "…" }` — `gravite` est celle que tu retiens ;
- ton dernier message, trois lignes : le compte par verdict, le constat
  confirmé le plus grave, le chemin de ton rapport.
