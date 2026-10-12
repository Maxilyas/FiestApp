// La planche des bordures de ligue : chaque alliage — six ligues, sept
// finitions —, rendu par les vrais composants (`Avatar.tsx`, `Bordure.tsx`,
// `Lumiere.tsx`) sous la vraie feuille de style, puis photographié.
//
// En grand, comme sur la carte ; à la taille d'une ligne du classement des
// duels et d'une pastille de la loge, où elle doit encore se reconnaître. Ses
// crans, du premier au douzième. Et autour de ce qui déborde : un légendaire
// éclaté, un portrait à sa forme ultime, sous la lumière des finitions 15, 20
// et 25 — un Divin n'en prend aucune.
//
//   npx tsx scripts/planche-bordures.ts ../export/planches
//
// Ce n'est pas un test : c'est l'œil qu'on pose sur une bordure avant de la
// livrer (« Regarde le rendu », CLAUDE.md).
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import React from 'react'

// Le client compile son JSX pour un `React` global : posé avant tout import d'un composant.
Object.assign(globalThis, { React })

const { renderToStaticMarkup } = await import('react-dom/server')
const { LIGUES, NOM_DE_LA_BORDURE } = await import('../../shared/duels')
const { FINITIONS, NOM_FINITION } = await import('../../shared/profil')
const { PORTRAITS } = await import('../../shared/branches')
/** Un module du client, par son adresse : le serveur ne compile pas le JSX du client, tsx si. */
const duClient = (fichier: string) => import(new URL(`../../client/src/${fichier}`, import.meta.url).href)
// Chaque dessin s'inscrit en s'évaluant, comme dans la page : `Avatar` les trouve.
await duClient('components/Legendaire.tsx')
await duClient('components/Divin.tsx')
await duClient('components/Portrait.tsx')
await duClient('components/portraits/mythes.ts')
await duClient('components/Lumiere.tsx')
await duClient('components/Bordure.tsx')
const { Avatar } = await duClient('components/Avatar.tsx')

const sortie = path.resolve(process.argv[2] ?? 'planches')
mkdirSync(sortie, { recursive: true })

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'planche.js'))('playwright')
}
const { chromium } = chargerPlaywright()

/** Les fichiers servis par l'application, là où le build les prend : la planche est une page locale, sans serveur. */
const PUBLIC = new URL('../../client/public/', import.meta.url).href
const localiser = (html: string) =>
  html.replaceAll('/medaillons/', `${PUBLIC}medaillons/`).replaceAll('/portraits/', `${PUBLIC}portraits/`).replaceAll("url('/fonts/", `url('${PUBLIC}fonts/`)
const FEUILLE = localiser(readFileSync(new URL('../../client/src/styles.css', import.meta.url), 'utf8'))

/** Un avatar rendu, à cette taille (1 em), dans une case qui laisse la place à sa bordure. */
const case_ = (props: Record<string, unknown>, taille: number, legende = '') =>
  `<figure style="width:${Math.max(taille * 2.1, 64)}px"><span class="boite" style="font-size:${taille}px">${localiser(
    renderToStaticMarkup(React.createElement(Avatar, { avatar: '🦊', ...props })),
  )}</span>${legende ? `<figcaption>${legende}</figcaption>` : ''}</figure>`

const STYLE = `
  body { margin: 0; padding: 24px; background: var(--bg); color: var(--ink); font: 14px system-ui, sans-serif; min-height: 0; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 26px 0 0; color: var(--accent-text); }
  p.sous { margin: 0 0 18px; color: var(--muted); }
  .ligne { display: flex; align-items: center; gap: 14px; padding: 26px 0 12px; border-top: 1px solid rgba(var(--accent-rgb), 0.2); }
  .nom { width: 150px; flex: none; font-weight: 600; }
  .nom small { display: block; font-weight: 400; color: var(--muted); }
  figure { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 10px; }
  figcaption { font-size: 11px; color: var(--muted); text-align: center; }
  .boite { display: inline-flex; align-items: center; justify-content: center; line-height: 0; }
  .boite > .av { line-height: 1; }
`

const page = (titre: string, sous: string, corps: string, theme = '') =>
  `<!doctype html><html${theme ? ` data-theme="${theme}"` : ''}><meta charset="utf-8"><style>${FEUILLE}${STYLE}</style>
  <body><h1>${titre}</h1><p class="sous">${sous}</p>${corps}</body></html>`

const alliages = LIGUES.map(
  l => `<div class="ligne">
    <div class="nom">${NOM_DE_LA_BORDURE[l.cle]}<small>${l.nom}</small></div>
    ${FINITIONS.map(f => case_({ finition: f, bordure: { ligue: l.cle, crans: 12 }, className: 'av-sujet' }, 52, NOM_FINITION[f])).join('')}
  </div>`,
).join('')

const crans = `<h2>Chaque cran est une victoire</h2>${(['or', 'maitre'] as const)
  .map(
    ligue => `<div class="ligne"><div class="nom">${NOM_DE_LA_BORDURE[ligue]}<small>finition Or</small></div>
    ${[0, 1, 3, 6, 9, 11, 12].map(n => case_({ finition: 'or', bordure: { ligue, crans: n } }, 44, `${n} sur 12`)).join('')}</div>`,
  )
  .join('')}`

const ultime = PORTRAITS.filter(p => p.branche === 'mythes').at(-1)!.key
const debords = `<h2>Ce qui déborde passe par-dessus</h2><div class="ligne">
    <div class="nom">Médaillons<small>la carte, le profil</small></div>
    ${case_({ legendaire: 'lg:phenix', finition: 'or', eclat: true, bordure: { ligue: 'or', crans: 12 }, className: 'av-sujet' }, 64, 'Phénix éclaté · Fleurons')}
    ${case_({ legendaire: ultime, finition: 'argent', bordure: { ligue: 'platine', crans: 9 }, className: 'av-sujet' }, 64, 'Portrait ultime · Givre')}
    ${case_({ legendaire: 'lg:kraken', finition: 'constellation', bordure: { ligue: 'maitre', crans: 12 }, className: 'av-sujet' }, 64, 'Kraken · Soleil noir')}
    ${case_({ legendaire: 'dv:seraphin', finition: 'constellation', bordure: { ligue: 'maitre', crans: 12 }, className: 'av-sujet' }, 64, 'Divin : aucune')}
  </div>
  <div class="ligne">
    <div class="nom">Lumières<small>15, 20 et 25</small></div>
    ${(['prisme', 'aurore', 'constellation'] as const)
      .map(f => case_({ finition: f, bordure: { ligue: 'diamant', crans: 12 }, className: 'av-sujet' }, 64, `${NOM_FINITION[f]} · Couronne`))
      .join('')}
    ${case_({ finition: 'prisme', className: 'av-sujet' }, 64, 'Prisme, sans bordure')}
  </div>`

const listes = `<h2>En petit</h2><div class="ligne">
    <div class="nom">Classement<small>une ligne, 1,2 rem</small></div>
    ${LIGUES.map(l => case_({ finition: 'holo', bordure: { ligue: l.cle, crans: 8 }, className: 'lb-avatar' }, 19, l.court)).join('')}
  </div>
  <div class="ligne">
    <div class="nom">Loge<small>une pastille, 15 px</small></div>
    ${LIGUES.map(l => case_({ finition: 'or', bordure: { ligue: l.cle, crans: 12 } }, 15, l.court)).join('')}
  </div>`

const PLANCHES: [string, string][] = [
  ['bordures', page('Les bordures de ligue', 'Six ligues, sept finitions : la ligue donne la forme et la pierre, la finition le métal', alliages + crans + debords + listes)],
  ['bordures-ivoire', page('Les bordures de ligue, en Ivoire', 'Le thème clair', alliages + listes, 'ivoire')],
]

const navigateur = await chromium.launch({ headless: true, args: ['--allow-file-access-from-files'] })
try {
  for (const [nom, html] of PLANCHES) {
    const fichier = path.join(sortie, `planche-${nom}.html`)
    writeFileSync(fichier, html)
    const onglet = await navigateur.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 })
    const erreurs: string[] = []
    onglet.on('pageerror', (e: Error) => erreurs.push(e.message))
    onglet.on('requestfailed', (r: any) => erreurs.push(`${r.url()} : ${r.failure()?.errorText}`))
    await onglet.goto('file://' + fichier)
    await onglet.waitForLoadState('networkidle')
    // Du code pour la page, en texte : le serveur se compile sans le DOM.
    await onglet.setViewportSize({ width: 1280, height: await onglet.evaluate('document.body.scrollHeight') })
    await onglet.evaluate('Promise.all([...document.images].map(i => i.decode().catch(() => {})))')
    await onglet.waitForTimeout(600)
    await onglet.screenshot({ path: path.join(sortie, `planche-${nom}.png`), fullPage: true })
    await onglet.close()
    if (erreurs.length) console.error(`[${nom}]`, erreurs)
    console.log(path.join(sortie, `planche-${nom}.png`))
  }
} finally {
  await navigateur.close()
}
