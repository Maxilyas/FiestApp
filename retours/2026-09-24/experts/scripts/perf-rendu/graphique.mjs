// Le graphique du rapport : ce que coûtent au fil principal le chronomètre et
// les légendaires, tels quels puis corrigés (moyenne des deux tours d'A/B,
// ab-chrono.ts). Dessiné en SVG, photographié par Chromium.
//
//   node graphique.mjs <sortie.png>
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import path from 'node:path'

const sortie = process.argv[2]
// ms de fil principal par seconde — export/evaluations/perf-rendu/ab-*/ab.md
const lignes = [
  { groupe: 'Question en cours · chronomètre', appareil: 'Écran commun 1366 × 768, CPU ×2', actuel: 122, corrige: 24 },
  { groupe: '', appareil: 'Téléphone 360 × 640, CPU ×6', actuel: 196, corrige: 49 },
  { groupe: 'Salle d’attente · 30 habitués, 1 sur 3 en légendaire', appareil: 'Écran commun 1366 × 768, CPU ×2', actuel: 188, corrige: 27 },
  { groupe: '', appareil: 'Téléphone 360 × 640, CPU ×6', actuel: 149, corrige: 17 },
]
const W = 820
const gauche = 250
const max = 220
const x = v => gauche + (v / max) * (W - gauche - 60)
const H_LIGNE = 58
let y = 96
let corps = ''
for (const l of lignes) {
  if (l.groupe) {
    corps += `<text x="24" y="${y}" class="groupe">${l.groupe}</text>`
    y += 16
  }
  corps += `<text x="24" y="${y + 17}" class="app">${l.appareil}</text>`
  corps += `<rect x="${gauche}" y="${y + 2}" width="${x(l.actuel) - gauche}" height="16" rx="4" fill="var(--s2)"/>`
  corps += `<text x="${x(l.actuel) + 8}" y="${y + 15}" class="val">${l.actuel}</text>`
  corps += `<rect x="${gauche}" y="${y + 22}" width="${x(l.corrige) - gauche}" height="16" rx="4" fill="var(--s1)"/>`
  corps += `<text x="${x(l.corrige) + 8}" y="${y + 35}" class="val">${l.corrige}</text>`
  y += H_LIGNE
}
const grille = [0, 50, 100, 150, 200]
  .map(v => `<line x1="${x(v)}" x2="${x(v)}" y1="80" y2="${y - 8}" class="grille"/><text x="${x(v)}" y="${y + 8}" class="axe" text-anchor="middle">${v}</text>`)
  .join('')
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${y + 44}" viewBox="0 0 ${W} ${y + 44}">
<style>
  :root { --s1: #2a78d6; --s2: #eb6834; }
  text { font-family: 'DejaVu Sans', Arial, sans-serif; fill: #0b0b0b; }
  .titre { font-size: 17px; font-weight: 700; }
  .sous { font-size: 12.5px; fill: #52514e; }
  .groupe { font-size: 13px; font-weight: 700; }
  .app { font-size: 12px; fill: #52514e; }
  .val { font-size: 12px; fill: #0b0b0b; }
  .axe { font-size: 11px; fill: #52514e; }
  .grille { stroke: #e4e3df; stroke-width: 1; }
</style>
<rect width="100%" height="100%" fill="#fcfcfb"/>
<text x="24" y="30" class="titre">Temps de fil principal par seconde (ms) : tel quel, puis corrigé</text>
<text x="24" y="50" class="sous">Chromium sans tête, CPU ralenti · moyenne de deux tours de 8 à 10 s · un fil à 1000 ms/s ne rend plus une image</text>
<rect x="24" y="62" width="12" height="12" rx="3" fill="var(--s2)"/><text x="42" y="72" class="app">Tel quel (main, 2026-09-24)</text>
<rect x="256" y="62" width="12" height="12" rx="3" fill="var(--s1)"/><text x="274" y="72" class="app">Corrigé (barre en transform: scaleX · légendaires figés dans les listes)</text>
${grille}${corps}
<text x="${W - 30}" y="${y + 30}" class="axe" text-anchor="end">ms / s</text>
</svg>`

const pw = createRequire(path.join(execSync('npm root -g').toString().trim(), 'x.js'))('playwright')
const nav = await pw.chromium.launch()
const page = await nav.newPage({ viewport: { width: W, height: y + 44 }, deviceScaleFactor: 1.5 })
await page.setContent(`<body style="margin:0">${svg}</body>`)
await page.screenshot({ path: sortie, fullPage: true })
await nav.close()
