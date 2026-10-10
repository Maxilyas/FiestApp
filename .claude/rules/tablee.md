---
paths:
  - "server/scripts/tablee/**"
  - "client/src/games/quiz/PlayerView.tsx"
  - "client/src/components/{FinDeSoiree,Entree}.tsx"
---

# La tablée lit l'écran par ses classes

Pour faire jouer une soirée par des agents, suis la skill `tablee`.

## Les fichiers

- `server/scripts/tablee/regie.ts` · `pilote.mjs` — la tablée : un serveur jetable, un Chromium, et les gestes des agents qui y jouent une soirée — ou plusieurs à la fois, un salon par animateur (`chez <animateur>`) — la marche à suivre, les personnages, les experts et leurs consignes dans `.claude/skills/tablee/` (`/tablee`)

## Les pièges

- **La tablée lit l'écran par ses classes** (`.quiz-player`, `.ans-btn`,
  `.guess-form`, `.join-url`, `.fin-tete`…) : en renommer une casse ses
  raccourcis `question`, `repondre` et `scanner` sans que le typecheck le
  voie. Une tablée courte le dit.
