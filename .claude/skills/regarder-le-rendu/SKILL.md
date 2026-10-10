---
name: regarder-le-rendu
description: Regarder une page ou un écran de FiestApp comme le verra un invité ou la salle — au téléphone en 360 × 640, l'écran commun en 1366 × 768 et 1920 × 1080 — avec Chromium et les scripts de rendu (rendu-ecran, rendu-jour, rendu-profil, rendu-recompenses…). À utiliser après toute retouche visible, avant de dire qu'un écran est fini.
---

# Regarder le rendu

- **Regarde le rendu.** Plusieurs bugs de cette base n'étaient visibles qu'à
  l'écran, pas au typecheck. Chromium et Playwright sont disponibles. Le
  téléphone se regarde en 360 × 640 ; l'écran commun en **1366 × 768** — le
  portable qu'on branche à la télé, où rien ne défile — et en 1920 × 1080,
  avec une question à photo et des réponses longues, des équipes, sept
  invités et plus (une estimation à six réponses, l'écran de victoire), et
  une clôture à hauts faits. `server/scripts/rendu-ecran.ts` rejoue tout ça
  en une commande (client construit d'abord). Dans un script Playwright,
  `waitForFunction` prend une fonction, jamais un texte : la politique de
  sécurité des pages refuse `eval`.

## Les scripts qui photographient

- `server/scripts/rendu-ecran.ts` — le pire cas de l'écran commun, rejoué sur un serveur jetable et photographié à chaque phase en 1366 × 768, 1920 × 1080 et au téléphone (`MESURE=1` : ce qui ne grandit pas en 1920)
- `server/scripts/rendu-recompenses.ts` — les écrans des récompenses du quiz du jour et de la campagne, photographiés sur un serveur jetable : les records par catégorie, une fin de série qui fait tomber hauts faits, paliers et légendaire, le défi de la semaine de bout en bout, le laurier d'argent, la gerbe, et l'entrée en scène du champion du mois en 1366 × 768
- `server/scripts/rendu-jour.ts` — le quiz du jour et le rayon des objets de la boutique, photographiés au téléphone sur un serveur jetable : l'accueil du jour avec une série et la veille à raconter, la feuille de la série, une partie jusqu'à sa fin, le jour joué, et la fiche de chaque objet
- `server/scripts/rendu-profil.ts` — la page du profil photographiée au téléphone sur un serveur jetable : ses tuiles en deux groupes, sa carte et son avatar en grand, chacun de ses écrans, chaque ligne de « Ma collection » dépliée — l'album des thèmes, la fiche de l'un —, le retour de la collection à « Mon thème », et la boutique
- `server/scripts/rendu-sentiers.ts` — tous les écrans des sentiers du savoir (règle `sentiers.md`).
- `server/scripts/rendu-themes.ts` et `server/scripts/apercus-themes.ts` — un thème dans l'application, son contraste, son aperçu (règle `themes.md`).
- `server/scripts/planche-portraits.ts`, `server/scripts/planche-medaillons.ts` — les images peintes dans tous leurs états (skill `peindre`).
- `server/scripts/mesure-pages.ts` (`npm run mesure`) — ce que chaque page fait attendre à un téléphone (règle `client.md`).
