// Les illustrations du modèle « Le quiz de mémoire »
// (server/content/quiz/memoire-photo.json) : des scènes simples, dessinées
// ici en SVG et photographiées par Chromium — libres de droits puisque
// faites pour le dépôt. 960 × 540, JPEG. Chaque scène dit, en commentaire,
// la question qu'elle sert et sa réponse : une scène retouchée doit rester
// d'accord avec son modèle.
//
//   node retours/2026-09-25/scripts/dessiner-memoire.mjs server/content/quiz/images
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { readFileSync } from 'node:fs'
const require = createRequire(path.join(execSync('npm root -g').toString().trim(), '/'))
const { chromium } = require('playwright')

const SORTIE = process.argv[2] ?? 'server/content/quiz/images'
// Les polices de l'application, en clair : une page vierge n'a pas le droit de lire le disque.
const police = f => `data:font/woff2;base64,${readFileSync(new URL(`../../../client/public/fonts/${f}`, import.meta.url)).toString('base64')}`
const W = 960
const H = 540

const fond = (couleur = '#f4ede2') => `<rect width="${W}" height="${H}" fill="${couleur}"/>`
const rond = (x, y, r, c) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="#2b211b" stroke-width="4"/>`
const carre = (x, y, s, c, a = 0) =>
  `<rect x="${x - s / 2}" y="${y - s / 2}" width="${s}" height="${s}" rx="6" fill="${c}" stroke="#2b211b" stroke-width="4" transform="rotate(${a} ${x} ${y})"/>`
const triangle = (x, y, s, c, a = 0) =>
  `<polygon points="${x},${y - s * 0.6} ${x - s * 0.55},${y + s * 0.4} ${x + s * 0.55},${y + s * 0.4}" fill="${c}" stroke="#2b211b" stroke-width="4" stroke-linejoin="round" transform="rotate(${a} ${x} ${y})"/>`
const texte = (x, y, t, taille = 44, attrs = '') =>
  `<text x="${x}" y="${y}" font-family="Figtree" font-weight="700" font-size="${taille}" fill="#2b211b" ${attrs}>${t}</text>`

const ROUGE = '#d9534f'
const BLEU = '#4a7fd6'
const JAUNE = '#f2c14e'
const VERT = '#5bb56f'
const VIOLET = '#9a6fd6'
const ORANGE = '#f08a3c'

const scenes = {
  // 1. Combien de triangles jaunes ? — 4
  'memoire-1-formes': [
    fond(),
    rond(130, 120, 50, ROUGE),
    rond(520, 400, 46, ROUGE),
    rond(820, 150, 52, ROUGE),
    carre(330, 180, 90, BLEU, 12),
    carre(700, 330, 84, BLEU, -8),
    triangle(160, 390, 120, JAUNE, 8),
    triangle(420, 110, 110, JAUNE, -10),
    triangle(640, 140, 100, JAUNE, 20),
    triangle(850, 420, 116, JAUNE, -4),
  ],
  // 2. Quelle heure indiquait l'horloge ? — 2 h 45
  'memoire-2-horloge': (() => {
    const cx = W / 2
    const cy = H / 2
    const r = 200
    const graduations = Array.from({ length: 12 }, (_, i) => {
      const a = (i * Math.PI) / 6
      const x1 = cx + Math.sin(a) * (r - 22)
      const y1 = cy - Math.cos(a) * (r - 22)
      const x2 = cx + Math.sin(a) * (r - 6)
      const y2 = cy - Math.cos(a) * (r - 6)
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#2b211b" stroke-width="${i % 3 === 0 ? 10 : 5}" stroke-linecap="round"/>`
    })
    // 2 h 45 : la petite aiguille aux trois quarts entre le 2 et le 3 — le
    // piège, c'est « 3 h 45 » —, la grande sur le 9.
    const heure = ((2 + 45 / 60) * Math.PI) / 6
    const minute = (45 * Math.PI) / 30
    const aiguille = (a, long, larg) =>
      `<line x1="${cx}" y1="${cy}" x2="${cx + Math.sin(a) * long}" y2="${cy - Math.cos(a) * long}" stroke="#2b211b" stroke-width="${larg}" stroke-linecap="round"/>`
    return [
      fond('#e8dcc8'),
      `<circle cx="${cx}" cy="${cy}" r="${r + 18}" fill="#8a5a3c"/>`,
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fffaf2"/>`,
      ...graduations,
      aiguille(heure, 110, 16),
      aiguille(minute, 165, 9),
      `<circle cx="${cx}" cy="${cy}" r="14" fill="${ROUGE}"/>`,
    ]
  })(),
  // 3. Quel article n'était PAS sur la liste ? — le beurre
  'memoire-3-liste': [
    fond('#cfd8c8'),
    `<rect x="300" y="40" width="360" height="460" rx="10" fill="#fffdf6" stroke="#2b211b" stroke-width="4" transform="rotate(-3 480 270)"/>`,
    `<g transform="rotate(-3 480 270)">`,
    texte(350, 110, 'À acheter', 46, 'font-family="Cormorant Garamond" font-weight="600"'),
    ...['Pain', 'Tomates', 'Fromage', 'Lait', 'Pommes', 'Café'].map((t, i) => texte(360, 180 + i * 52, `– ${t}`, 38, 'font-weight="500"')),
    `</g>`,
  ],
  // 4. De quelle couleur était la troisième bande ? — violet
  'memoire-4-bandes': [
    fond(),
    ...[VERT, ORANGE, VIOLET, BLEU, ROUGE].map((c, i) => `<rect x="${60 + i * 172}" y="70" width="152" height="400" rx="12" fill="${c}" stroke="#2b211b" stroke-width="4"/>`),
  ],
  // 5. Combien de fenêtres avait la maison ? — 7
  'memoire-5-maison': (() => {
    const fenetre = (x, y) =>
      `<rect x="${x}" y="${y}" width="70" height="70" fill="#bfe0f2" stroke="#2b211b" stroke-width="4"/><line x1="${x + 35}" y1="${y}" x2="${x + 35}" y2="${y + 70}" stroke="#2b211b" stroke-width="3"/><line x1="${x}" y1="${y + 35}" x2="${x + 70}" y2="${y + 35}" stroke="#2b211b" stroke-width="3"/>`
    return [
      fond('#bfe3c4'),
      `<rect x="0" y="470" width="${W}" height="70" fill="#7fb77e"/>`,
      `<polygon points="200,210 480,60 760,210" fill="#a0413c" stroke="#2b211b" stroke-width="5" stroke-linejoin="round"/>`,
      `<rect x="230" y="210" width="500" height="270" fill="#f2e3c6" stroke="#2b211b" stroke-width="5"/>`,
      fenetre(445, 110),
      fenetre(265, 240),
      fenetre(385, 240),
      fenetre(505, 240),
      fenetre(625, 240),
      fenetre(265, 360),
      fenetre(625, 360),
      `<rect x="440" y="360" width="80" height="120" rx="6" fill="${ROUGE}" stroke="#2b211b" stroke-width="4"/>`,
      `<circle cx="505" cy="425" r="6" fill="#2b211b"/>`,
    ]
  })(),
  // 6. Où était l'étoile ? — au milieu, à droite
  'memoire-6-grille': (() => {
    const cases = []
    for (let l = 0; l < 3; l++) {
      for (let c = 0; c < 4; c++) cases.push(`<rect x="${150 + c * 170}" y="${50 + l * 150}" width="150" height="130" rx="12" fill="#fffaf2" stroke="#2b211b" stroke-width="4"/>`)
    }
    const cx = 150 + 3 * 170 + 75
    const cy = 50 + 150 + 65
    const pts = Array.from({ length: 10 }, (_, i) => {
      const a = (i * Math.PI) / 5 - Math.PI / 2
      const r = i % 2 ? 22 : 52
      return `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`
    }).join(' ')
    return [fond('#d8d3ea'), ...cases, `<polygon points="${pts}" fill="${JAUNE}" stroke="#2b211b" stroke-width="4" stroke-linejoin="round"/>`]
  })(),
  // 7. Quel était le plus grand nombre ? — 31
  'memoire-7-nombres': [
    fond('#f2dfd3'),
    texte(120, 150, '12', 110),
    texte(420, 120, '7', 110),
    texte(700, 170, '31', 110),
    texte(220, 380, '18', 110),
    texte(520, 330, '25', 110),
    texte(770, 450, '4', 110),
  ],
  // 8. Combien de ballons en tout ? — 9
  'memoire-8-ballons': (() => {
    const ballon = (x, y, c) =>
      `<path d="M${x},${y + 62} q-14,40 8,90" stroke="#2b211b" stroke-width="3" fill="none"/><ellipse cx="${x}" cy="${y}" rx="48" ry="60" fill="${c}" stroke="#2b211b" stroke-width="4"/>`
    const couleurs = [ROUGE, BLEU, ROUGE, VERT, ROUGE, BLEU, ROUGE, BLEU, ROUGE]
    const places = [
      [110, 150],
      [230, 250],
      [330, 120],
      [450, 230],
      [560, 110],
      [660, 260],
      [770, 140],
      [860, 280],
      [380, 360],
    ]
    return [fond('#cfe6f5'), ...places.map(([x, y], i) => ballon(x, y, couleurs[i]))]
  })(),
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
for (const [nom, formes] of Object.entries(scenes)) {
  await page.setContent(`<!doctype html><html><head><style>
    @font-face { font-family: Figtree; src: url(${police('figtree-variable.woff2')}) format('woff2'); font-weight: 300 900; }
    @font-face { font-family: 'Cormorant Garamond'; src: url(${police('cormorant-garamond-600.woff2')}) format('woff2'); font-weight: 600; }
    html, body { margin: 0; }
  </style></head><body><svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${formes.join('')}</svg></body></html>`)
  await page.evaluate(async () => {
    await Promise.all([document.fonts.load('700 40px Figtree'), document.fonts.load('600 40px "Cormorant Garamond"')])
    await document.fonts.ready
  })
  await page.screenshot({ path: `${SORTIE}/${nom}.jpg`, type: 'jpeg', quality: 80 })
  console.log(nom)
}
await browser.close()
