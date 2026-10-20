// Les ornements de la niche, peints (le souhait du propriétaire, le 19
// octobre 2026 : « Dessinés comme sur la maquette, sans peinture payante et
// aussi des versions vraiment très jolies avec des peintures payantes de
// différents styles ») : dessinés d'abord (`client/src/components/Ornements.tsx`),
// chacun aura ses versions peintes, un style chacune, qu'on choisira dans
// « Ma niche » (`StyleDOrnement`, `shared/ornements.ts`).
//
// Un ornement se peint sur un calque, dans le repère de la niche : son arche
// tracée d'un magenta plus sombre sur un fond magenta uni (`CROQUIS`), il en
// épouse la courbe — la guirlande suit le haut de l'arche, le lierre son
// rebord — sans qu'on ait à l'y recaler. Le magenta détouré (`pixels.ts`), le
// tracé avec lui, il reste ce qui se pose par-dessus la niche : un carré de
// 120 × 120 dans les unités de la niche (54 × 62, au centre, `REPERE`), que
// le client posera de même (`--l`).
//
// L'essai d'abord (`--essai`) : un ornement — la guirlande, d'office —, en
// quelques styles (`STYLES`), au prix plein, en direct ; puis la planche
// (`--planche`, sans rien payer) : chaque style posé sur la niche de chaque
// compagnon à sa forme ultime, à la taille de « Ma niche » et à celle du coin
// de la page, à côté du dessin d'aujourd'hui — de quoi choisir. Les originaux,
// les calques détourés, la planche et le journal des coûts vivent dans
// `../export/ornements/`, hors du dépôt ; une image payée n'est jamais jetée
// (`mettreDeCote`). La livraison viendra avec le style choisi.
//
//   NODE_USE_ENV_PROXY=1 npx tsx scripts/anime/ornements.ts --essai [--ornement=guirlande] [--styles=conte,orfevre] [--regenerer]
//   npx tsx scripts/anime/ornements.ts --planche [--ornement=guirlande]   (client construit d'abord)
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import React from 'react'
import { coutDUneImage, coutEstime, enPartie, formatDe, generer, type Rendu } from './gemini'
import { dansLaPage, deDataUrl, pagePixels } from './pixels'
import { ORNEMENTS, type CleDOrnement } from '../../../shared/ornements'

const args = process.argv.slice(2)
const liste = (nom: string) => (args.find(a => a.startsWith(`--${nom}=`))?.slice(nom.length + 3) ?? '').split(',').filter(Boolean)
const MODELE = process.env.MODELE ?? 'gemini-3-pro-image'
/** Le plafond de toute la chaîne, journal compris : au-delà, rien ne part. L'essai en coûte moins d'un dollar. */
const BUDGET = Number(process.env.BUDGET ?? 1.5)
const racine = path.resolve('../export/ornements')

/**
 * Le repère d'un calque : un carré de 120 unités de niche, la niche (54 × 62)
 * au centre — de quoi laisser sortir l'étoile de l'arche, les feuilles, un
 * halo. Le client le posera à `--l × -33 / 54`, `--l × -29 / 54`, large de
 * `--l × 120 / 54`.
 */
const REPERE = { cote: 120, gauche: 33, haut: 29, largeur: 54, hauteur: 62 }
const PX = 1024 / REPERE.cote

/** L'arche de la niche dans le croquis : son haut en demi-cercle, ses coins du bas arrondis à 12 unités (`styles.css`, `.niche-cadre`). */
function arche(): string {
  const g = REPERE.gauche * PX
  const h = REPERE.haut * PX
  const l = REPERE.largeur * PX
  const H = REPERE.hauteur * PX
  const r = l / 2
  const b = 12 * PX
  return `M${g},${h + r} A${r},${r} 0 0 1 ${g + l},${h + r} L${g + l},${h + H - b} Q${g + l},${h + H} ${g + l - b},${h + H} L${g + b},${h + H} Q${g},${h + H} ${g},${h + H - b} Z`
}

/**
 * Le croquis que reçoit le modèle : la niche tracée d'un magenta sombre — son
 * arche et son rebord — sur le magenta du fond. Le détourage efface l'un et
 * l'autre (un magenta franc, même assombri, est du fond : `pixels.ts`) : il
 * ne reste que ce qu'il a peint autour.
 */
const CROQUIS = () => {
  const g = REPERE.gauche * PX
  const l = REPERE.largeur * PX
  const bas = (REPERE.haut + REPERE.hauteur) * PX
  const rebord = 7 * PX
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">` +
    `<rect width="1024" height="1024" fill="#ff00ff"/>` +
    `<path d="${arche()}" fill="none" stroke="#8a008a" stroke-width="${(1.6 * PX).toFixed(1)}"/>` +
    `<rect x="${g}" y="${bas - rebord}" width="${l}" height="${rebord}" fill="none" stroke="#8a008a" stroke-width="${(1 * PX).toFixed(1)}"/>` +
    `</svg>`
  )
}

/** Les styles de l'essai : chacun une phrase pour le modèle. */
const STYLES: Record<string, { nom: string; consigne: string }> = {
  conte: {
    nom: 'Conte aquarellé',
    consigne:
      "a children's storybook illustration: delicate hand-inked outlines, soft transparent watercolor washes, gentle and whimsical, the paper texture faintly visible in the color",
  },
  orfevre: {
    nom: 'Orfèvre',
    consigne:
      "a jeweler's masterpiece: the string is a fine gold chain, and each lamp a tiny cabochon gem — amber, topaz, aquamarine, peridot, citrine — set in gold filigree with touches of enamel, rich specular highlights, like a precious necklace",
  },
  lanternes: {
    nom: 'Lanternes de papier',
    consigne:
      'tiny round Japanese washi paper lanterns hung on a thin twine, warm candlelight glowing through the paper, painterly, cozy festival-night mood, soft edges on the paper',
  },
  feerique: {
    nom: 'Féerique',
    consigne:
      'a luminous high-end fantasy digital painting, as in a premium mobile game: glass bulbs with a bright warm core, rich saturated colors, crisp clean edges, a subtle golden rim light on the string',
  },
}

/** Ce que chaque ornement demande au modèle, dans le repère du croquis. */
const SUJETS: Partial<Record<CleDOrnement, string>> = {
  guirlande:
    'Paint ONLY a garland of seven tiny glowing lamps draped along the OUTSIDE of the top curve of this arch: the string follows the curved edge ' +
    'from the left side to the right side, starting and ending about a third of the way down each side, and the seven lamps hang evenly spaced ' +
    'just below the string, slightly overlapping the edge. The lamps are warm gold, amber, pale sky blue, soft lime green and white — no pink, no ' +
    'purple, no magenta.',
}

const consigne = (ornement: CleDOrnement, style: string) =>
  'The attached image is a layout guide on a flat chroma-key magenta background (#FF00FF): the darker magenta line traces the edge of a small ' +
  'arched niche — a window with a semicircular top — and the thin rectangle at its bottom marks its ledge. ' +
  `${SUJETS[ornement]} Style: ${STYLES[style].consigne}. ` +
  'Do not draw the niche itself, its frame, its ledge or anything inside it: the inside of the arch stays the same flat magenta as the background, ' +
  'and the guide lines must stay exactly as they are. Keep the whole background a single perfectly flat, uniform chroma-key magenta (#FF00FF) ' +
  'edge to edge — no shadow, no glow or light halo on the background, no sparkles, no scenery. Do not use any pink, purple or magenta on the ' +
  'ornament. No text, no letters. Output one square image (1:1 aspect ratio).'

// ── Le journal ────────────────────────────────────────────────────────────

const cheminJournal = path.join(racine, 'journal-ornements.jsonl')
const lireJournal = (): { nom: string; cout?: number }[] =>
  existsSync(cheminJournal)
    ? readFileSync(cheminJournal, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map(l => JSON.parse(l))
    : []
const depense = () => lireJournal().reduce((n, e) => n + (e.cout ?? 0), 0)

/** Met une image payée de côté, datée : on ne jette jamais ce qui a coûté. */
function mettreDeCote(f: string) {
  if (!existsSync(f)) return
  const ext = path.extname(f)
  renameSync(f, f.slice(0, -ext.length) + `.ancien-${Date.now()}${ext}`)
}

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'rendu.js'))('playwright')
}

const original = (ornement: string, style: string) => path.join(racine, 'originaux', `${ornement}-${style}`)
const calque = (ornement: string, style: string) => path.join(racine, 'calques', `${ornement}-${style}.png`)
const trouve = (base: string) => ['png', 'jpg', 'webp'].map(e => `${base}.${e}`).find(f => existsSync(f))

/** Peint l'essai : un ornement, chaque style qui n'a pas encore son image (ou tous, `--regenerer`). */
async function essai(ornement: CleDOrnement, styles: string[]) {
  mkdirSync(path.join(racine, 'originaux'), { recursive: true })
  const croquis = path.join(racine, 'croquis.png')
  const nav = await chargerPlaywright().chromium.launch()
  try {
    // Le croquis, photographié une fois : le modèle reçoit une image, pas un SVG.
    const page = await nav.newPage({ viewport: { width: 1024, height: 1024 } })
    await page.setContent(`<!doctype html><body style="margin:0">${CROQUIS()}</body>`)
    await page.screenshot({ path: croquis, clip: { x: 0, y: 0, width: 1024, height: 1024 } })
    await page.close()
  } finally {
    await nav.close()
  }
  const aFaire = styles.filter(s => args.includes('--regenerer') || !trouve(original(ornement, s)))
  const prevu = aFaire.length * coutDUneImage(MODELE)
  if (depense() + prevu > BUDGET) throw new Error(`Budget : ${depense().toFixed(2)} $ dépensés, ${prevu.toFixed(2)} $ prévus — au-delà de ${BUDGET} $.`)
  for (const style of aFaire) {
    const base = original(ornement, style)
    const avant = trouve(base)
    if (avant) mettreDeCote(avant)
    console.log(`  ${ornement} · ${STYLES[style].nom}…`)
    const r: Rendu = await generer([enPartie(croquis), { text: consigne(ornement, style) }], { modele: MODELE, taille: '1K', format: '1:1' })
    writeFileSync(`${base}.${formatDe(r.image).ext}`, r.image)
    const cout = coutEstime(r.jetons, { modele: MODELE })
    appendFileSync(cheminJournal, JSON.stringify({ nom: `${ornement}-${style}`, date: new Date().toISOString(), modele: MODELE, jetons: r.jetons, cout }) + '\n')
    console.log(`    ${r.secondes.toFixed(0)} s · ${cout.toFixed(3)} $ — ${depense().toFixed(2)} $ en tout`)
  }
}

/** Détoure chaque original de l'essai : le magenta et le tracé de la niche s'en vont, il reste l'ornement, dans son repère. */
async function detourer(ornement: CleDOrnement, styles: string[]) {
  mkdirSync(path.join(racine, 'calques'), { recursive: true })
  const nav = await chargerPlaywright().chromium.launch()
  try {
    const page = await pagePixels(nav)
    for (const style of styles) {
      const f = trouve(original(ornement, style))
      if (!f) continue
      const src = `data:${formatDe(readFileSync(f)).mime};base64,${readFileSync(f).toString('base64')}`
      const r = await dansLaPage<{ plein: string; transparents: number; bordFaux: boolean }>(page, 'detourer', src, null, [255, 0, 255], false)
      writeFileSync(calque(ornement, style), deDataUrl(r.plein))
      console.log(`  ${ornement} · ${STYLES[style].nom} : ${(r.transparents * 100).toFixed(0)} % transparent${r.bordFaux ? ' — ⚠ bord douteux' : ''}`)
    }
  } finally {
    await nav.close()
  }
}

/**
 * La planche : chaque compagnon à sa forme ultime, dans sa niche — le dessin
 * d'aujourd'hui, puis chaque style peint —, en grand (« Ma niche ») et au coin
 * de la page, sous la vraie feuille de style du client construit.
 */
async function planche(ornement: CleDOrnement, styles: string[]) {
  const client = path.resolve('../client')
  const css = readdirSync(path.join(client, 'dist/assets')).find(f => /^index-.*\.css$/.test(f))
  if (!css) throw new Error('Le client n’est pas construit : npm run build -w client')
  // Le vrai composant du client, rendu ici comme dans les tests : la planche montre la niche telle qu'elle est.
  Object.assign(globalThis, { React })
  const { NicheEnMiniature } = await import(new URL('../../../client/src/components/Niche.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const formes = [
    { compagnon: 'loup', rang: 3 },
    { compagnon: 'chat', rang: 3 },
    { compagnon: 'tortue', rang: 3 },
    { compagnon: 'luciole', rang: 3 },
  ]
  const publics = `file://${path.join(client, 'public')}`
  const niche = (vue: object, taille: number, peint?: string) => {
    const html = renderToStaticMarkup(React.createElement(NicheEnMiniature, { niche: vue as never, taille }))
    const posee = peint
      ? `<img class="ornement-peint" src="file://${peint}" alt="" style="position:absolute;left:calc(var(--l) * -${REPERE.gauche} / 54);top:calc(var(--l) * -${REPERE.haut} / 54);width:calc(var(--l) * ${REPERE.cote} / 54);height:calc(var(--l) * ${REPERE.cote} / 54);pointer-events:none">`
      : ''
    return html.replace(/<\/span>$/, `${posee}</span>`).replaceAll('src="/', `src="${publics}/`).replaceAll('url(/', `url(${publics}/`)
  }
  const colonnes = [{ titre: 'Dessin (aujourd’hui)', peint: undefined as string | undefined }, ...styles.filter(s => existsSync(calque(ornement, s))).map(s => ({ titre: STYLES[s].nom, peint: calque(ornement, s) }))]
  const o = ORNEMENTS.find(x => x.key === ornement)!
  const lignes = formes
    .map(
      f =>
        `<tr>${colonnes
          .map(c => {
            // Dessinée, la niche ne montre que cet ornement-là ; peinte, aucun dessin : le calque seul, par-dessus.
            const vue = c.peint ? { ...f } : { ...f, paliers: o.palier, ornements: Object.fromEntries(ORNEMENTS.filter(x => x.key !== ornement).map(x => [x.key, 'cache'])) }
            return `<td><div class="grand">${niche(vue, 108, c.peint)}</div><div class="petit">${niche(vue, 54, c.peint)}</div></td>`
          })
          .join('')}</tr>`,
    )
    .join('')
  const html =
    `<!doctype html><html lang="fr"><head><meta charset="utf-8"><link rel="stylesheet" href="file://${path.join(client, 'dist/assets', css)}">` +
    `<style>body{margin:0;padding:24px;background:#1c1512;color:#f3e6d0;font-family:system-ui,sans-serif}h1{font-size:20px;margin:0 0 4px}p{margin:0 0 18px;color:#c8b49a;font-size:13px}` +
    `table{border-collapse:separate;border-spacing:18px 22px}th{font-size:13px;font-weight:600;text-align:center;color:#f3d27a}td{vertical-align:middle;text-align:center}` +
    `.grand,.petit{display:inline-flex;align-items:center;justify-content:center;padding:26px 30px}.grand{min-width:150px}.petit{min-width:90px}` +
    `.niche-mini{display:inline-block}</style></head><body>` +
    `<h1>${o.titre} — ${o.nom} : l’essai des styles</h1><p>Chaque compagnon à sa forme ultime : en grand, comme dans « Ma niche » ; à côté, à la taille du coin de la page.</p>` +
    `<table><tr>${colonnes.map(c => `<th>${c.titre}</th>`).join('')}</tr>${lignes}</table></body></html>`
  const page_ = path.join(racine, `planche-${ornement}.html`)
  writeFileSync(page_, html)
  const nav = await chargerPlaywright().chromium.launch()
  try {
    const page = await nav.newPage({ viewport: { width: 330 * colonnes.length + 80, height: 900 }, deviceScaleFactor: 2 })
    await page.goto(`file://${page_}`)
    await page.waitForLoadState('networkidle')
    await page.evaluate('Promise.all([...document.images].map(i => i.decode().catch(() => {})))')
    await page.waitForTimeout(800)
    await page.screenshot({ path: path.join(racine, `planche-${ornement}.png`), fullPage: true })
  } finally {
    await nav.close()
  }
  console.log(`planche : ${path.join(racine, `planche-${ornement}.png`)}`)
}

const ornement = (liste('ornement')[0] ?? 'guirlande') as CleDOrnement
if (!SUJETS[ornement]) throw new Error(`Pas encore de consigne pour l’ornement « ${ornement} ».`)
const styles = liste('styles').length ? liste('styles') : Object.keys(STYLES)
for (const s of styles) if (!STYLES[s]) throw new Error(`Style inconnu : ${s}`)
mkdirSync(racine, { recursive: true })
if (args.includes('--essai')) {
  await essai(ornement, styles)
  await detourer(ornement, styles)
}
if (args.includes('--essai') || args.includes('--planche')) {
  if (args.includes('--planche') && !args.includes('--essai')) await detourer(ornement, styles)
  await planche(ornement, styles)
}
console.log(`${depense().toFixed(2)} $ dépensés en tout pour les ornements (budget ${BUDGET} $).`)
