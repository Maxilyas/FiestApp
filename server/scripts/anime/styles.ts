// Un style d'image par branche : l'essai avant les cent trente-deux images.
// Une image par branche — sa forme ultime, en illustration complète, le
// sujet et son fond dans le style de sa branche —, posée dans le cadre du
// sixième palier (l'aura, l'anneau d'or, le disque), en 260, 44 et 26 px,
// les douze sur une planche.
//
//   NODE_USE_ENV_PROXY=1 npx tsx scripts/anime/styles.ts [branche…]
//   … --references        # les références et la planche, sans un appel
//   … --regenerer         # repayer les images des branches nommées
//   … --lot               # à moitié prix, rendu quand Google l'a fait
//
// Sans branche nommée, toutes celles qui n'ont pas encore leur image. Une
// image payée n'est jamais redemandée sans --regenerer. Les consignes vivent
// dans consignes.ts ; Athéna prend pour référence le prototype de l'artifact
// (athena-croquis.svg), qui a déjà la pose de la forme ultime.
//
// Le test ne sépare pas le personnage de son fond (un appel par branche au
// lieu de deux) : ni débord ni silhouette ici, c'est le style qu'on juge.
// Chaque image est payée ; le journal (journal-styles.json) en garde les
// jetons et le coût estimé, pour tenir le budget.
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import React from 'react'
import { STYLES } from './consignes'
import { coutEstime, enPartie, formatDe, generer, lancerLot, lireLot, type Demande, type Rendu } from './gemini'

Object.assign(globalThis, { React })
const { renderToStaticMarkup } = await import('react-dom/server')
const duClient = (fichier: string) => import(new URL(`../../../client/src/${fichier}`, import.meta.url).href)
const { Portrait } = await duClient('components/Portrait.tsx')
const { BRANCHES } = await import('../../../shared/branches')
for (const b of BRANCHES) await duClient(`components/portraits/${b.key}.ts`)

const args = process.argv.slice(2)
const REFERENCES = args.includes('--references')
const REGENERER = args.includes('--regenerer')
/** À moitié prix, mais Google rend le lot quand il l'a fait : on l'attend au plus ATTENTE secondes. */
const LOT = args.includes('--lot')
const ATTENTE = Number(process.env.ATTENTE ?? 900)
const voulues = args.filter(a => !a.startsWith('--'))
const sortie = path.resolve('../export/styles')
const MODELE = process.env.MODELE ?? 'gemini-3-pro-image'
// 1K : le disque de 320 px, à trois pixels par point, en demande 960.
const TAILLE = process.env.TAILLE ?? '1K'
mkdirSync(sortie, { recursive: true })
const fichier = (nom: string) => path.join(sortie, nom)

// ── Les consignes ─────────────────────────────────────────────────────────
// En anglais, comme celles d'essai.ts. Aucun nom d'artiste, de studio ni
// d'œuvre : des techniques et des époques. Chaque style dit aussi comment
// sa forme ultime se distingue — c'est elle qu'on essaie.

// « Pour un recadrage en cercle » faisait dessiner le cercle au modèle : le
// panda roux est revenu dans un rond sur fond crème, qui laissait un
// liseré clair au bord du disque. L'app découpe elle-même ; le modèle peint
// jusqu'aux bords.
const COMMUN =
  'Square avatar illustration for a party quiz game. The app will crop it into a circle itself, so paint the scene edge to edge over the whole square, ' +
  'with no round vignette, no drawn circle and no border; keep the subject centered, and its face, hands and key props within the central 90% of the canvas. ' +
  'It must read instantly even as a tiny round icon: a strong silhouette, big clear shapes, the face well lit. ' +
  'No text, no letters, no numbers, no signature, no watermark, no border, no circular frame. Output one square image (1:1 aspect ratio).'

const ULTIME =
  'This is the ultimate form, the rarest avatar of its series: a dynamic pose frozen at its most dramatic instant, a signature effect around the subject, ' +
  'rich detail and a sense of power — expressed only with the means of the style below.'

const REFERENCE =
  'The attached image is the current flat vector avatar of this subject: use it only to know who the subject is, its colors and its props. ' +
  'Change the pose, the framing and the rendering freely.'

// ── Les outils ────────────────────────────────────────────────────────────

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'styles.js'))('playwright')
}
const { chromium } = chargerPlaywright()

const existant = (nom: string) => ['png', 'jpg', 'webp'].map(e => fichier(`${nom}.${e}`)).find(f => existsSync(f))
const enDataUrl = (f: string) => {
  const b = readFileSync(f)
  return `data:${formatDe(b).mime};base64,${b.toString('base64')}`
}

/**
 * La référence d'une branche : sa forme ultime d'aujourd'hui, par le vrai
 * composant — sauf Athéna, dont le prototype de l'artifact a déjà la pose
 * de la forme ultime.
 */
async function reference(page: any, cle: string, cible: string) {
  const svg =
    cle === 'br:athena'
      ? readFileSync(new URL('./athena-croquis.svg', import.meta.url), 'utf8').replace(/<!--[\s\S]*?-->/, '')
      : renderToStaticMarkup(React.createElement(Portrait, { cle }))
  await page.setContent(`<!doctype html><body style="margin:0"><div style="width:1024px;height:1024px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body>`)
  await page.screenshot({ path: cible, omitBackground: true, clip: { x: 0, y: 0, width: 1024, height: 1024 } })
}

// ── Le cadre du sixième palier ────────────────────────────────────────────

let compteur = 0

/** L'illustration dans le disque, sous l'anneau d'or et dans l'aura de la forme ultime (celles du prototype). */
function cadre(href: string) {
  const u = `st${++compteur}`
  return (
    `<svg class="pt" viewBox="0 0 100 100"><defs>` +
    `<radialGradient id="${u}a" gradientUnits="userSpaceOnUse" cx="50" cy="52" r="66"><stop offset=".55" stop-color="#ffd76a" stop-opacity=".55"/><stop offset="1" stop-color="#ffd76a" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="${u}o" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff4c7"/><stop offset=".5" stop-color="#e3b04b"/><stop offset="1" stop-color="#8a5a10"/></linearGradient>` +
    `<clipPath id="${u}c"><circle cx="50" cy="50" r="46.4"/></clipPath></defs>` +
    `<circle cx="50" cy="52" r="66" fill="url(#${u}a)"/>` +
    `<g clip-path="url(#${u}c)"><image href="${href}" x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid slice"/></g>` +
    `<circle cx="50" cy="50" r="47.2" fill="none" stroke="url(#${u}o)" stroke-width="2.2"/><circle cx="50" cy="50" r="45" fill="none" stroke="#fff4c7" stroke-width=".45" opacity=".5"/>` +
    `</svg>`
  )
}

function planche(journal: any[]) {
  const cout = journal.reduce((n, e) => n + (e.cout ?? 0), 0)
  const cartes = BRANCHES.map((b: any) => {
    const p = b.portraits[5]
    const image = existant(`style-${b.key}`)
    const style = STYLES[b.key]?.nom
    const ref = `<span class="boite" style="width:44px;height:44px">${renderToStaticMarkup(React.createElement(Portrait, { cle: p.key }))}</span>`
    const corps = image
      ? `<div class="grand"><span class="boite" style="width:250px;height:250px">${cadre(path.basename(image))}</span></div>
         <div class="petits">
           <span class="boite" style="width:44px;height:44px">${cadre(path.basename(image))}</span>
           <span class="boite" style="width:26px;height:26px">${cadre(path.basename(image))}</span>
           <img class="brut" src="${path.basename(image)}" alt="" width="64" height="64">
           <span class="sep"></span>${ref}<small>aujourd’hui</small>
         </div>`
      : `<div class="grand vide">${ref.replace('44px;height:44px', '120px;height:120px')}<p>Pas encore généré</p></div>`
    return `<section class="carte"><p class="branche">${b.nom}</p><h2>${style ?? ''}</h2><p class="sujet">${p.nom} · ${p.seuil} bonnes réponses</p>${corps}</section>`
  }).join('')
  const html = `<!doctype html><html lang="fr"><meta charset="utf-8"><title>Styles des branches</title><style>
    body { margin: 0; padding: 28px 30px 40px; background: #16110f; color: #f3ece2; font: 14px/1.4 system-ui, sans-serif; width: 1180px; box-sizing: border-box; }
    h1 { font-size: 22px; margin: 0 0 4px; } .sous { margin: 0 0 22px; color: #a89b8a; }
    .grille { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
    .carte { border: 1px solid rgba(217,181,106,.22); border-radius: 16px; padding: 16px 16px 14px; display: grid; gap: 4px; background: rgba(255,255,255,.02); }
    .branche { margin: 0; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #d9b56a; }
    h2 { margin: 0; font-size: 18px; } .sujet { margin: 0; color: #a89b8a; font-size: 12.5px; }
    .grand { display: grid; place-items: center; padding: 34px 0 30px; min-height: 300px; }
    .grand.vide { gap: 10px; color: #a89b8a; }
    .petits { display: flex; align-items: center; gap: 14px; }
    .petits small { color: #a89b8a; font-size: 11px; }
    .sep { width: 1px; height: 36px; background: rgba(217,181,106,.25); margin-left: auto; }
    .brut { border-radius: 6px; border: 1px solid rgba(217,181,106,.25); }
    .boite { display: inline-block; line-height: 0; flex: none; }
    .boite svg { width: 100%; height: 100%; overflow: visible; display: block; }
  </style><h1>Un style par branche · l’essai</h1>
  <p class="sous">Une image par branche, sa forme ultime en illustration complète, dans le cadre du sixième palier (aura, anneau d’or, disque), en 250, 44 et 26 px ; à côté, l’image entière et le portrait d’aujourd’hui. ${MODELE}, ${TAILLE}. Coût estimé des images générées : ${cout.toFixed(2).replace('.', ',')} $.</p>
  <div class="grille">${cartes}</div></html>`
  writeFileSync(fichier('styles.html'), html)
}

// ── Le tout ───────────────────────────────────────────────────────────────

const cheminJournal = fichier('journal-styles.json')
const journal: any[] = existsSync(cheminJournal) ? JSON.parse(readFileSync(cheminJournal, 'utf8')) : []

/** Range une image payée, et son coût au journal — écrit à chaque image : une panne au milieu ne perd pas le compte. */
function ranger(branche: string, r: Rendu, lot: boolean) {
  writeFileSync(fichier(`style-${branche}.${formatDe(r.image).ext}`), r.image)
  const cout = coutEstime(r.jetons, { lot })
  journal.push({ branche, date: new Date().toISOString(), modele: MODELE, taille: TAILLE, lot, secondes: r.secondes, jetons: r.jetons, cout })
  writeFileSync(cheminJournal, JSON.stringify(journal, null, 2) + '\n')
  const total = journal.reduce((n, e) => n + (e.cout ?? 0), 0)
  console.log(`${branche} : environ ${cout.toFixed(3)} $${lot ? ' (lot)' : ''} (total ${total.toFixed(2)} $)`)
}
const nav = await chromium.launch({ headless: true })
try {
  const page = await nav.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 })
  await page.setContent('<!doctype html><body style="margin:0"></body>')
  const branches = BRANCHES.filter((b: any) => voulues.length === 0 || voulues.includes(b.key))
  const aFaire: Demande[] = []
  for (const b of branches) {
    const p = b.portraits[5]
    const ref = fichier(`reference-${b.key}.png`)
    await reference(page, p.key, ref)
    const s = STYLES[b.key]
    const consigne = [COMMUN, ULTIME, REFERENCE, s.style, s.ultime].join('\n\n')
    writeFileSync(fichier(`consigne-${b.key}.txt`), consigne + '\n')
    if (REFERENCES) continue
    const deja = existant(`style-${b.key}`)
    if (deja && !REGENERER) {
      console.log(`${b.key} : déjà généré, gardé (--regenerer pour le repayer)`)
      continue
    }
    if (LOT) {
      aFaire.push({ cle: b.key, parties: [enPartie(ref), { text: consigne }] })
      continue
    }
    console.log(`${b.key} : ${s.nom}, ${MODELE} ${TAILLE}…`)
    ranger(b.key, await generer([enPartie(ref), { text: consigne }], { modele: MODELE, taille: TAILLE }), false)
  }
  if (aFaire.length) {
    // Un lot à moitié prix : on l'attend ici, et un lot qui tarde se reprend
    // par son nom au lancement suivant (lots-en-cours.json).
    const cheminLots = fichier('lots-en-cours.json')
    const enCours = existsSync(cheminLots) ? readFileSync(cheminLots, 'utf8').trim() : ''
    const nom = enCours ? JSON.parse(enCours).nom : await lancerLot(aFaire, { modele: MODELE, taille: TAILLE, nom: 'fiestapp-styles' })
    writeFileSync(cheminLots, JSON.stringify({ nom, cles: aFaire.map(d => d.cle) }) + '\n')
    console.log(`lot ${nom} : ${aFaire.length} image(s), en attente…`)
    const t0 = Date.now()
    for (;;) {
      const l = await lireLot(nom)
      if (l.fini) {
        console.log(`lot ${nom} : ${l.etat} en ${((Date.now() - t0) / 1000).toFixed(0)} s`)
        for (const [cle, r] of l.resultats) typeof r === 'string' ? console.log(`${cle} : ${r}`) : ranger(cle, r, true)
        writeFileSync(cheminLots + '.fini', readFileSync(cheminLots))
        writeFileSync(cheminLots, '')
        break
      }
      if (Date.now() - t0 > ATTENTE * 1000) {
        console.log(`lot ${nom} : ${l.etat} après ${ATTENTE} s ; relance plus tard pour le reprendre.`)
        break
      }
      await new Promise(ok => setTimeout(ok, 15_000))
    }
  }
  await page.close()
  planche(journal)
  const photo = await nav.newPage({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 2 })
  await photo.goto('file://' + fichier('styles.html'))
  await photo.waitForLoadState('networkidle')
  await photo.screenshot({ path: fichier('styles.png'), fullPage: true })
  console.log(fichier('styles.png'))
} catch (e) {
  console.error((e as Error).message)
  process.exitCode = 1
} finally {
  await nav.close()
}
