---
paths:
  - "server/scripts/anime/**"
  - "server/scripts/{planche-portraits,planche-medaillons}.ts"
---
# Les images peintes

Un portrait, un légendaire, un Divin, un compagnon, un ornement de sa niche,
un décor ou une carte de l'Expédition peints se refont par leur chaîne (`server/scripts/anime/`),
jamais à la main : lis d'abord la skill `peindre`
(`.claude/skills/peindre/SKILL.md`) — générer (en lot ; un compagnon, en
direct), juger la planche, livrer.

Les 84 cartes peintes des rencontres sont aussi **les œuvres du Cabinet de
curiosités** (`shared/cabinet/oeuvres.ts`, règle `cabinet.md`) : une carte
repeinte ne change que son image ; une carte de plus devient une œuvre, à
ranger dans sa salle et à son jeu — `cabinet-catalogue.test.ts` le réclame —,
et une carte retirée reprendrait une œuvre à qui l'a (invariant 22).
