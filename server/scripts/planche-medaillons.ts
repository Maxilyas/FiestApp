// La planche des légendaires et des Divins peints : chaque médaillon, dans
// tous ses états, rendu par les vrais composants (`Legendaire.tsx`,
// `Divin.tsx`, `Avatar.tsx`) sous la vraie feuille de style, puis
// photographié.
//
// Grand, comme sa révélation ; à la taille de la grille du profil ; à celle
// d'un classement de l'écran commun, où il doit encore se reconnaître. Et
// verrouillé (la silhouette, le voile), éclaté (la version rare qui sort du
// cadre), porté sous les cercles des finitions. Une planche des légendaires,
// une des Divins, et le catalogue, en Velours puis en Ivoire :
//
//   npx tsx scripts/planche-medaillons.ts ../export/planches
//
// Ce n'est pas un test : c'est l'œil qu'on pose sur un médaillon avant de le
// livrer (« Regarde le rendu », CLAUDE.md). Leur lumière bouge : chaque
// photographie en est un instant.
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import React from 'react'

// Le client compile son JSX pour un `React` global : posé avant tout import d'un composant.
Object.assign(globalThis, { React })

const { renderToStaticMarkup } = await import('react-dom/server')
const { LEGENDAIRES } = await import('../../shared/legendaires')
const { DIVINS } = await import('../../shared/divins')
/** Un module du client, par son adresse : le serveur ne compile pas le JSX du client, tsx si. */
const duClient = (fichier: string) => import(new URL(`../../client/src/${fichier}`, import.meta.url).href)
// Chaque dessin s'inscrit en s'évaluant, comme dans la page : `Avatar` les trouve.
const { Legendaire } = await duClient('components/Legendaire.tsx')
const { Divin } = await duClient('components/Divin.tsx')
await duClient('components/Lumiere.tsx')
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
const localiser = (html: string) => html.replaceAll('/medaillons/', `${PUBLIC}medaillons/`).replaceAll("url('/fonts/", `url('${PUBLIC}fonts/`)
const FEUILLE = localiser(readFileSync(new URL('../../client/src/styles.css', import.meta.url), 'utf8'))

/** Un médaillon rendu, dans une boîte de cette taille (1 em). */
const case_ = (composant: unknown, props: Record<string, unknown>, taille: number, legende = '', classe = '') =>
  `<figure style="width:${Math.max(taille, 64)}px"><span class="boite ${classe}" style="font-size:${taille}px">${localiser(
    renderToStaticMarkup(React.createElement(composant as any, props)),
  )}</span>${legende ? `<figcaption>${legende}</figcaption>` : ''}</figure>`

/** Un avatar dans un classement : la vraie classe de la liste, et ce qu'elle fige ou cache. */
const classement = (props: Record<string, unknown>, legende: string) =>
  case_(Avatar, { avatar: '🦊', className: 'lb-avatar', ...props }, 22, legende)

const STYLE = `
  body { margin: 0; padding: 24px; background: var(--bg); color: var(--ink); font: 14px system-ui, sans-serif; min-height: 0; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p.sous { margin: 0 0 18px; color: var(--muted); }
  .ligne { display: flex; align-items: flex-end; gap: 22px; padding: 44px 0 12px; border-top: 1px solid rgba(var(--accent-rgb), 0.2); }
  .nom { width: 150px; flex: none; align-self: center; font-weight: 600; }
  .nom small { display: block; font-weight: 400; color: var(--muted); }
  figure { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 8px; }
  figcaption { font-size: 11px; color: var(--muted); }
  .boite { display: inline-block; line-height: 0; }
  .grille { display: grid; grid-template-columns: repeat(8, 1fr); gap: 34px 18px; padding: 30px 0; }
`

const page = (titre: string, sous: string, corps: string, theme = '') =>
  `<!doctype html><html${theme ? ` data-theme="${theme}"` : ''}><meta charset="utf-8"><style>${FEUILLE}${STYLE}</style>
  <body><h1>${titre}</h1><p class="sous">${sous}</p>${corps}</body></html>`

const legendaires = LEGENDAIRES.map(l => {
  const c = l.key
  return `<div class="ligne">
    <div class="nom">${l.nom}<small>${l.ton === 'ombre' ? 'de l’ombre' : ''}</small></div>
    ${case_(Legendaire, { cle: c, grand: true }, 180, 'gagné')}
    ${case_(Legendaire, { cle: c, grand: true, eclat: true }, 180, 'éclaté')}
    ${case_(Legendaire, { cle: c, verrouille: true }, 120, 'à gagner')}
    ${case_(Legendaire, { cle: c, finition: 'or' }, 72, 'or')}
    ${case_(Legendaire, { cle: c, finition: 'constellation' }, 72, 'constellation')}
    ${case_(Legendaire, { cle: c }, 30, 'grille')}
    ${classement({ legendaire: c, finition: 'argent' }, 'classement')}
    ${classement({ legendaire: c, finition: 'argent', eclat: true }, 'éclaté')}
  </div>`
}).join('')

const divins = DIVINS.map(d => {
  const c = d.key
  return `<div class="ligne">
    <div class="nom">${d.nom}</div>
    ${case_(Divin, { cle: c, grand: true }, 180, 'descendu')}
    ${case_(Divin, { cle: c }, 72, '72 px')}
    ${case_(Divin, { cle: c }, 30, 'grille')}
    ${classement({ legendaire: c }, 'classement')}
    ${case_(Divin, { cle: c, verrouille: true }, 120, 'pas descendu')}
  </div>`
}).join('')

/**
 * Sur le podium, là où ils sont le sujet (`av-sujet`) : portés, avec la
 * lumière des derniers niveaux autour — le pire cas de l'écran commun.
 */
const podium = `<div class="ligne">
    <div class="nom">Sur le podium<small>portés, avec leur finition</small></div>
    ${[
      { legendaire: 'lg:phenix', finition: 'aurore', eclat: true },
      { legendaire: 'lg:kraken', finition: 'constellation' },
      { legendaire: 'lg:licorne', finition: 'prisme', eclat: true },
      { legendaire: 'lg:sapin', finition: 'or' },
      { legendaire: 'dv:seraphin', finition: 'constellation' },
    ]
      .map(props => case_(Avatar, { avatar: '🦊', className: 'podium-avatar av-sujet', ...props }, 16, `${props.legendaire.slice(3)} · ${props.finition}`))
      .join('')}
  </div>`

const catalogue = `<div class="grille">${LEGENDAIRES.map(l => case_(Legendaire, { cle: l.key, grand: true }, 116, l.nom)).join('')}</div>
  <div class="grille">${LEGENDAIRES.map(l => case_(Legendaire, { cle: l.key, grand: true, eclat: true }, 116, `${l.nom}, éclaté`)).join('')}</div>
  <div class="grille">${DIVINS.map(d => case_(Divin, { cle: d.key, grand: true }, 116, d.nom)).join('')}</div>`

const PLANCHES: [string, string][] = [
  ['legendaires', page('Les légendaires', 'Seize cartes peintes sous leur pellicule holo · gagnés, éclatés, à gagner, portés', podium + legendaires)],
  ['divins', page('Les Divins', 'Cinq bijoux peints, habités de lumière', divins)],
  ['catalogue-medaillons', page('Les médaillons', 'Les seize, leurs versions rares, les cinq Divins', catalogue)],
  ['catalogue-medaillons-ivoire', page('Les médaillons, en Ivoire', 'L’écran commun, sur demande de l’animateur', catalogue, 'ivoire')],
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
    // Les médaillons peints sont des images : on attend qu'elles soient là.
    await onglet.waitForLoadState('networkidle')
    await onglet.waitForTimeout(600)
    await onglet.screenshot({ path: path.join(sortie, `planche-${nom}.png`), fullPage: true })
    await onglet.close()
    if (erreurs.length) console.error(`[${nom}]`, erreurs)
    console.log(path.join(sortie, `planche-${nom}.png`))
  }
} finally {
  await navigateur.close()
}
