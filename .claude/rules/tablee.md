---
paths:
  - "server/scripts/tablee/**"
  - "client/src/games/quiz/PlayerView.tsx"
  - "client/src/components/{FinDeSoiree,Entree}.tsx"
  - "client/src/views/{HostApp,PlayerApp}.tsx"
  - ".claude/skills/tablee/**"
  - ".claude/agents/convive.md"
---

# La tablée lit l'écran par ses classes

Pour faire jouer une soirée par des agents, suis la skill `tablee`.

## Les fichiers

- `server/scripts/tablee/regie.ts` · `pilote.mjs` — la tablée : un serveur jetable, un Chromium, et les gestes des agents qui y jouent une soirée — ou plusieurs à la fois, un salon par animateur (`chez <animateur>`) — la marche à suivre, les personnages, les experts et leurs consignes dans `.claude/skills/tablee/` (`/tablee`), l'agent des personnages dans `.claude/agents/convive.md`
- `server/scripts/tablee/chronologie.mjs` — le journal d'une tablée en une page ; sans argument, celle que désigne `export/tablee/courante.json` : une seconde régie (`--fiche`) se lit en lui donnant son dossier

## Les pièges

- **La tablée lit l'écran par ses classes** (`.quiz-player`, `.ans-btn`,
  `.guess-form`, `.result-banner`, `.fin-tete`, `.player-shell`… et
  `.join-url`, l'adresse du QR que `scanner` lit sur `/host`, dans
  `HostApp.tsx`) : en renommer une casse ses raccourcis `question`,
  `repondre` et `scanner` sans que le typecheck le voie. Une tablée courte
  le dit. Ses autres gestes visent un texte par le rôle et le nom
  accessible (`toucher "Jouer sans compte"`) : un bouton renommé fait
  échouer les consignes et les fiches qui le citent.
- **Un geste se dit à trois endroits** : son `case` dans `regie.ts`,
  l'aide de `pilote.mjs` (`AIDE`, écrite à la main) et les consignes ou les
  fiches qui l'emploient.
- **L'animatrice arrive par un compte à activer** (`/api/admin/accounts`,
  puis son lien `/activer`), le chemin d'avant le 3 octobre 2026 :
  aujourd'hui, un animateur ouvre son salon depuis son profil (« Créer un
  salon »), et `/admin` ne crée plus de compte. Ses retours sur son arrivée
  parlent de ce chemin-là.
- **Ce que signalent les navigateurs ne s'écrit nulle part** : seul le geste
  `console` le lit, et le vide. Le dossier de la tablée garde
  `journal.jsonl` (les gestes, sans leur sortie), `regie.log` (le serveur et
  la régie), `regie.json`, `captures/`, `retours/`, `bases/`, `photos/` et
  `telechargements/`.
