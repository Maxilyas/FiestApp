// La planche des bordures de ligue : chaque parure sous chaque finition — six
// ligues, douze finitions —, rendue par les vrais composants (`Avatar.tsx`,
// `Bordure.tsx`, `Lumiere.tsx`) sous la vraie feuille de style, puis
// photographiée. Le métal est celui de la ligue : d'une finition à l'autre,
// la bordure ne change pas — c'est ce qui l'entoure qu'on regarde, le halo,
// le cercle du médaillon, la lumière.
//
// En grand, comme sur la carte ; à la taille d'une ligne du classement des
// duels et d'une pastille de la loge, où elle doit encore se reconnaître. Ses
// crans, du premier au douzième. Et autour de ce qui déborde : un légendaire
// éclaté, un portrait à sa forme ultime, sous la lumière des finitions, du 15
// au 50. Et les Divins, qui s'habillent à leur façon depuis le 22 novembre
// 2026 : en gloire sous chaque ligue, les dix-huit, les métaux qui teintent
// leur lumière, les lumières qui prennent sa place, une liste.
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
const { FINITIONS, NIVEAU_FINITION, NOM_FINITION } = await import('../../shared/profil')
const { PORTRAITS } = await import('../../shared/branches')
const { DIVINS } = await import('../../shared/divins')
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
const case_ = (props: Record<string, unknown>, taille: number, legende = '', large = 2.1) =>
  `<figure style="width:${Math.max(taille * large, 64)}px"><span class="boite" style="font-size:${taille}px${large > 2.1 ? `;min-height:${taille * (large - 0.3)}px` : ''}">${localiser(
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

const crans = `<h2>Chaque cran est une victoire</h2>${LIGUES.map(
  l => `<div class="ligne"><div class="nom">${NOM_DE_LA_BORDURE[l.cle]}<small>finition Or</small></div>
    ${[0, 1, 2, 3, 5, 8, 11, 12].map(n => case_({ finition: 'or', bordure: { ligue: l.cle, crans: n } }, 44, `${n} sur 12`)).join('')}</div>`,
).join('')}`

const ultime = PORTRAITS.filter(p => p.branche === 'mythes').at(-1)!.key
const debords = `<h2>Ce qui déborde passe par-dessus</h2><div class="ligne">
    <div class="nom">Médaillons<small>la carte, le profil</small></div>
    ${case_({ legendaire: 'lg:phenix', finition: 'or', eclat: true, bordure: { ligue: 'or', crans: 12 }, className: 'av-sujet' }, 64, 'Phénix éclaté · Feuilles d’or')}
    ${case_({ legendaire: ultime, finition: 'argent', bordure: { ligue: 'platine', crans: 9 }, className: 'av-sujet' }, 64, 'Portrait ultime · Givre')}
    ${case_({ legendaire: 'lg:kraken', finition: 'constellation', bordure: { ligue: 'maitre', crans: 12 }, className: 'av-sujet' }, 64, 'Kraken · Soleil noir')}
    ${case_({ legendaire: 'lg:phenix', finition: 'or', sceau: true, bordure: { ligue: 'or', crans: 7 }, className: 'av-sujet' }, 64, 'Phénix scellé : son étoile')}
  </div>
  <div class="ligne">
    <div class="nom">Lumières<small>du 15 au 50</small></div>
    ${FINITIONS.filter(f => NIVEAU_FINITION[f] >= 15)
      .map(f => case_({ finition: f, bordure: { ligue: 'diamant', crans: 12 }, className: 'av-sujet' }, 64, `${NOM_FINITION[f]} · Couronne`))
      .join('')}
    ${case_({ finition: 'prisme', className: 'av-sujet' }, 64, 'Prisme, sans bordure')}
  </div>`

// Un Divin : sa finition n'arrive que s'il l'a épinglée (`finitionSur`) — `mat`, ici, c'est sa propre lumière.
const LUMIERES = FINITIONS.filter(f => NIVEAU_FINITION[f] >= 15)
/** Une case assez large pour sa gloire, qui déborde plus qu'une bordure : sa légende reste dessous. */
const enGloire = (props: Record<string, unknown>, taille: number, legende: string) => case_({ ...props, className: 'av-sujet' }, taille, legende, 2.8)
const divins = `<h2>Les Divins, en gloire</h2><div class="ligne">
    <div class="nom">Les six ligues<small>le Séraphin, sa lumière</small></div>
    ${enGloire({ legendaire: 'dv:seraphin' }, 60, 'sans bordure')}
    ${LIGUES.map(l => enGloire({ legendaire: 'dv:seraphin', bordure: { ligue: l.cle, crans: 12 } }, 60, NOM_DE_LA_BORDURE[l.cle])).join('')}
  </div>
  <div class="ligne" style="flex-wrap:wrap">
    <div class="nom">Les dix-huit<small>chacun sa couleur</small></div>
    ${DIVINS.map((d, i) => enGloire({ legendaire: d.key, bordure: { ligue: LIGUES[(i + 2) % LIGUES.length].cle, crans: [12, 9, 5, 12, 3, 8][i % 6] } }, 52, d.nom)).join('')}
  </div>
  <div class="ligne">
    <div class="nom">Les métaux<small>ils teintent sa lumière</small></div>
    ${(['mat', 'argent', 'or', 'holo'] as const).map(f => enGloire({ legendaire: 'dv:hecate', finition: f }, 60, f === 'mat' ? 'Hécate, sa lumière' : NOM_FINITION[f])).join('')}
    ${(['argent', 'or', 'holo'] as const).map(f => enGloire({ legendaire: 'dv:chronos', finition: f, bordure: { ligue: 'platine', crans: 12 } }, 60, `Chronos · ${NOM_FINITION[f]}`)).join('')}
  </div>
  <div class="ligne">
    <div class="nom">Les lumières<small>à la place de sa gloire</small></div>
    ${LUMIERES.map((f, i) => enGloire({ legendaire: ['dv:athena', 'dv:artemis', 'dv:lotus', 'dv:osiris', 'dv:dechu', 'dv:seraphin', 'dv:pantheon', 'dv:helios'][i], finition: f, bordure: i % 2 ? { ligue: LIGUES[i % LIGUES.length].cle, crans: 12 } : null }, 60, NOM_FINITION[f])).join('')}
  </div>
  <div class="ligne">
    <div class="nom">Classement<small>ni rayons, ni étincelles</small></div>
    ${DIVINS.slice(0, 6).map((d, i) => case_({ legendaire: d.key, bordure: { ligue: LIGUES[i].cle, crans: 8 }, className: 'lb-avatar' }, 19, d.nom)).join('')}
    ${case_({ legendaire: 'dv:seraphin', className: 'lb-avatar' }, 19, 'sans bordure')}
    ${case_({ legendaire: 'lg:phenix', finition: 'or', bordure: { ligue: 'or', crans: 8 }, className: 'lb-avatar' }, 19, 'un Phénix')}
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
  ['bordures', page('Les bordures de ligue', 'Six ligues, douze finitions : une parure au métal de sa ligue, la finition autour d’elle', alliages + crans + debords + listes)],
  ['bordures-ivoire', page('Les bordures de ligue, en Ivoire', 'Le thème clair', alliages + listes, 'ivoire')],
  ['divins-habilles', page('Les Divins habillés', 'Sous une bordure, en gloire ; un métal teinte sa lumière ; une lumière prend sa place', divins)],
  ['divins-habilles-ivoire', page('Les Divins habillés, en Ivoire', 'Le thème clair : sa lumière s’assombrit pour s’y lire', divins, 'ivoire')],
]

const navigateur = await chromium.launch({ headless: true, args: ['--allow-file-access-from-files'] })
try {
  for (const [nom, html] of PLANCHES) {
    const fichier = path.join(sortie, `planche-${nom}.html`)
    writeFileSync(fichier, html)
    // Douze finitions par ligue depuis le 1er novembre 2026 : la ligne la plus large décide de la planche.
    const onglet = await navigateur.newPage({ viewport: { width: 1760, height: 900 }, deviceScaleFactor: 1 })
    const erreurs: string[] = []
    onglet.on('pageerror', (e: Error) => erreurs.push(e.message))
    onglet.on('requestfailed', (r: any) => erreurs.push(`${r.url()} : ${r.failure()?.errorText}`))
    await onglet.goto('file://' + fichier)
    await onglet.waitForLoadState('networkidle')
    // Du code pour la page, en texte : le serveur se compile sans le DOM.
    await onglet.setViewportSize({ width: 1760, height: await onglet.evaluate('document.body.scrollHeight') })
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
