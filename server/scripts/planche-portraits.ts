// La planche des portraits des branches : chaque dessin, dans tous ses états,
// rendu par le vrai composant (`client/src/components/Portrait.tsx`) puis
// photographié.
//
// Grand, pour le détail ; à la taille de la grille du profil ; à celle d'un
// classement de l'écran commun, où il doit encore se reconnaître. Et
// verrouillé (la silhouette), éclaté (le ciel rare), porté sous les cercles
// des finitions. Une planche par branche, dans le dossier donné :
//
//   npx tsx scripts/planche-portraits.ts ../export/planches            # toutes
//   npx tsx scripts/planche-portraits.ts ../export/planches foret oceans
//
// Ce n'est pas un test : c'est l'œil qu'on pose sur un dessin avant de le
// livrer (« Regarde le rendu », CLAUDE.md).
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import React from 'react'

// Le client compile son JSX pour un `React` global : posé avant tout import d'un composant.
Object.assign(globalThis, { React })

const { renderToStaticMarkup } = await import('react-dom/server')
const { BRANCHES } = await import('../../shared/branches')
/** Un module du client, par son adresse : le serveur ne compile pas le JSX du client, tsx si. */
const duClient = (fichier: string) => import(new URL(`../../client/src/${fichier}`, import.meta.url).href)
const { Portrait } = await duClient('components/Portrait.tsx')

const sortie = path.resolve(process.argv[2] ?? 'planches')
const voulues = process.argv.slice(3)
const branches = BRANCHES.filter(b => voulues.length === 0 || voulues.includes(b.key))
if (branches.length === 0) throw new Error(`Aucune branche parmi : ${voulues.join(', ')}`)
mkdirSync(sortie, { recursive: true })

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'planche.js'))('playwright')
}
const { chromium } = chargerPlaywright()

/**
 * Les fichiers des portraits peints, là où le build les copiera
 * (`client/public/portraits`) : la planche est une page locale, sans serveur.
 */
const PUBLICS = new URL('../../client/public/portraits/', import.meta.url).href

/** Un portrait rendu, dans une boîte de cette taille — en grand au-delà de 100 px, comme la page choisirait. */
const case_ = (props: Record<string, unknown>, taille: number, legende = '') =>
  `<figure style="width:${Math.max(taille, 64)}px"><span class="boite" style="width:${taille}px;height:${taille}px">${renderToStaticMarkup(
    React.createElement(Portrait, { grand: taille > 100, ...props } as any),
  ).replaceAll('href="/portraits/', `href="${PUBLICS}`)}</span>${legende ? `<figcaption>${legende}</figcaption>` : ''}</figure>`

const STYLE = `
  body { margin: 0; padding: 24px; background: #17131c; color: #eee7f5; font: 14px system-ui, sans-serif; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p.sous { margin: 0 0 18px; color: #a99fb8; }
  .ligne { display: flex; align-items: flex-end; gap: 14px; padding: 44px 0 12px; border-top: 1px solid #2c2535; }
  .nom { width: 150px; flex: none; align-self: center; font-weight: 600; }
  .nom small { display: block; font-weight: 400; color: #a99fb8; }
  figure { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 4px; }
  figcaption { font-size: 11px; color: #a99fb8; }
  .boite { display: inline-block; line-height: 0; }
  .boite svg { width: 100%; height: 100%; overflow: visible; }
  .clair { background: #f4efe6; border-radius: 10px; padding: 6px; }
`

// Chaque branche s'inscrit en s'évaluant, comme dans la page.
for (const b of branches) await duClient(`components/portraits/${b.key}.ts`)

const navigateur = await chromium.launch({ headless: true })
try {
  for (const b of branches) {
    const lignes = b.portraits
      .map(p => {
        const c = p.key
        return `<div class="ligne">
          <div class="nom">${p.nom}<small>${p.seuil} bonnes réponses</small></div>
          ${case_({ cle: c }, 180, 'gagné')}
          ${case_({ cle: c, eclat: true }, 120, 'éclaté')}
          ${case_({ cle: c, verrouille: true }, 120, 'à gagner')}
          ${case_({ cle: c, finition: 'or' }, 72, 'or')}
          ${case_({ cle: c, finition: 'prisme' }, 72, 'prisme')}
          ${case_({ cle: c, finition: 'constellation' }, 72, 'constellation')}
          ${case_({ cle: c }, 44, 'grille')}
          ${case_({ cle: c, finition: 'argent' }, 26, 'classement')}
          <figure class="clair">${case_({ cle: c }, 44)}</figure>
        </div>`
      })
      .join('')
    const html = `<!doctype html><meta charset="utf-8"><style>${STYLE}</style>
      <h1>${b.nom}</h1><p class="sous">${b.categorie} · ${b.portraits.length} portraits</p>${lignes}`
    const fichier = path.join(sortie, `planche-${b.key}.html`)
    writeFileSync(fichier, html)
    const page = await navigateur.newPage({ viewport: { width: 1160, height: 900 }, deviceScaleFactor: 1 })
    const erreurs: string[] = []
    page.on('pageerror', (e: Error) => erreurs.push(e.message))
    await page.goto('file://' + fichier)
    // Les portraits peints sont des images : on attend qu'elles soient là.
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: path.join(sortie, `planche-${b.key}.png`), fullPage: true })
    await page.close()
    if (erreurs.length) console.error(`[${b.key}]`, erreurs)
    console.log(path.join(sortie, `planche-${b.key}.png`))
  }
} finally {
  await navigateur.close()
}
