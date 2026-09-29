// Un style d'image par branche : l'essai avant les cent trente-deux images.
// Une image par branche — sa forme ultime, en illustration complète, le
// sujet et son fond dans le style de sa branche —, posée dans le cadre du
// sixième palier (l'aura, l'anneau d'or, le disque), en 260, 44 et 26 px,
// les douze sur une planche.
//
//   NODE_USE_ENV_PROXY=1 npx tsx scripts/anime/styles.ts [branche…]
//   … --references        # les références et la planche, sans un appel
//   … --regenerer         # repayer les images des branches nommées
//
// Sans branche nommée, toutes celles qui n'ont pas encore leur image. Une
// image payée n'est jamais redemandée sans --regenerer. Les mythologies ne
// se génèrent pas : leur style est validé par essai.ts, et la planche
// reprend son Athéna, décor et personnage recomposés.
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
import { coutEstime, enPartie, formatDe, generer } from './gemini'

Object.assign(globalThis, { React })
const { renderToStaticMarkup } = await import('react-dom/server')
const duClient = (fichier: string) => import(new URL(`../../../client/src/${fichier}`, import.meta.url).href)
const { Portrait } = await duClient('components/Portrait.tsx')
const { BRANCHES } = await import('../../../shared/branches')
for (const b of BRANCHES) await duClient(`components/portraits/${b.key}.ts`)

const args = process.argv.slice(2)
const REFERENCES = args.includes('--references')
const REGENERER = args.includes('--regenerer')
const voulues = args.filter(a => !a.startsWith('--'))
const sortie = path.resolve('../export/styles')
const ESSAI = path.resolve('../export/essai-anime')
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

interface Style {
  /** Le style, tel qu'on le dit à l'utilisateur. */
  nom: string
  style: string
  sujet: string
}

const STYLES: Record<string, Style> = {
  monde: {
    nom: 'L’affiche de voyage des années 30',
    style:
      'Style: a 1930s travel poster printed in lithography — flat color planes, a limited palette of six inks plus a metallic gold ink, visible paper grain ' +
      'and slight ink misregistration, bold simplified shapes, a radiating sun and a stylized landscape.',
    sujet:
      'Subject: the red panda, as the mascot of the Himalayas: standing proudly on a mossy branch above misty mountains and a valley of pagoda roofs at sunrise, ' +
      'its bushy ringed tail curling around it, its round face with white markings, one paw raised to greet the traveler; golden sun rays burst behind it.',
  },
  oceans: {
    nom: 'L’estampe japonaise',
    style:
      'Style: a Japanese ukiyo-e woodblock print — bold confident outlines, flat colors with soft bokashi gradients, Prussian blue and indigo, ' +
      'stylized curling waves with claw-like foam, visible washi paper texture and wood grain, a hint of sparkling mica powder.',
    sujet:
      'Subject: the narwhal, bursting out of a towering curling wave, its long spiral tusk glowing and pointing to the sky, water spiraling around it, ' +
      'bioluminescent plankton sparkling like stars in the spray, a full moon behind.',
  },
  espace: {
    nom: 'La SF pulp des années 50',
    style:
      'Style: a 1950s pulp science-fiction paperback cover painted in gouache — bold saturated colors (cobalt, teal, tangerine, lemon yellow), glossy chrome highlights, ' +
      'dramatic rim lighting, a subtle halftone print texture and aged paper grain, retro-futurist design.',
    sujet:
      'Subject: the astronaut, in a rounded retro spacesuit with a big glass bubble helmet reflecting the Earth, launched through space with one arm outstretched, ' +
      'a jetpack at full thrust leaving a glowing plasma trail, ringed planets and stars behind.',
  },
  foret: {
    nom: 'Le papier découpé',
    style:
      'Style: a layered paper-cut diorama — the whole image is built from cut paper sheets stacked in depth, each layer a flat color with clean cut edges ' +
      'and soft drop shadows between layers, a subtle paper fiber texture, warm light glowing through the gaps, forest greens, moss, amber and cream.',
    sujet:
      'Subject: the stag, standing tall in a deep forest clearing, its huge antlers sprouting glowing leaves and blossoms, head raised in a mighty bellow, ' +
      'a storm of paper leaves swirling around it, sunbeams piercing the layered trees.',
  },
  ecran: {
    nom: 'L’affiche de cinéma en Technicolor',
    style:
      'Style: a hand-painted classic Hollywood movie poster in saturated three-strip color film hues (deep red, gold, teal) — glamorous and cinematic, ' +
      'dramatic spotlight lighting, soft painterly brushwork, film grain.',
    sujet:
      'Subject: the movie star, caught mid-leap in slow motion under a blazing spotlight, film reel ribbons unfurling around her, a lens flare, ' +
      'sequins sparkling, camera flashes blurred in the dark behind.',
  },
  scene: {
    nom: 'Le pop art',
    style:
      'Style: 1960s pop art — bold black outlines, flat primary colors (red, yellow, cyan, magenta), Ben-Day halftone dots, graphic comic-book shading, high contrast.',
    sujet:
      'Subject: the orchestra conductor, both arms raised high, the baton at the end of a sweeping gesture, tailcoat flaring, hair flying, ' +
      'a storm of musical notes and sound waves bursting from the baton, stage lights behind.',
  },
  contes: {
    nom: 'Le livre de contes, plume et aquarelle',
    style:
      'Style: a golden-age children’s storybook illustration — delicate pen-and-ink linework with warm watercolor washes, soft paper texture, ' +
      'whimsical and magical, with firm ink outlines on the main shapes so it stays readable.',
    sujet:
      'Subject: the griffin — eagle head and wings, lion body — diving from the sky with its wings spread wide, feathers turning into flying book pages, ' +
      'ink splashing like stars, a fairytale castle and rolling hills far below.',
  },
  stade: {
    nom: 'Le low poly',
    style:
      'Style: low-poly 3D art — the subject and the scene are made of crisp geometric facets, each facet a flat color with a subtle gradient, clean sharp edges, ' +
      'a vivid palette, dynamic motion trails made of triangles, soft studio lighting.',
    sujet:
      'Subject: the prima ballerina, suspended mid grand jeté with her legs in a full split, arms elegantly extended, tutu flaring, ' +
      'ribbons of stars trailing behind her movement, under a stage spotlight.',
  },
  brigade: {
    nom: 'La pâte à modeler',
    style:
      'Style: claymation — everything is sculpted from modeling clay with visible fingerprints and tool marks, soft rounded shapes, slightly glossy surfaces, ' +
      'warm studio lighting with soft shadows, the feel of a miniature stop-motion set.',
    sujet:
      'Subject: the chef, a jolly cook in a tall white toque flipping a pan high, a dragon made of clay flames rising from the pan, ' +
      'knives and vegetables flying in the air, a cozy kitchen set behind.',
  },
  arcade: {
    nom: 'Le pixel art',
    style:
      'Style: high-definition pixel art — a crisp pixel grid with no anti-aliasing, a limited but rich palette, dynamic lighting and glowing effects rendered ' +
      'with pixel shading and dithering, like the hero portrait of a modern pixel-art game.',
    sujet:
      'Subject: the knight, leaning forward with his hand on the hilt, the instant before drawing his sword, crackling lightning around him, eyes glowing ' +
      'under the helmet visor, a cape billowing, scattered pixel sparks.',
  },
  carnaval: {
    nom: 'L’art déco',
    style:
      'Style: Art Deco — elegant geometric design in black, ivory and metallic gold with jewel-tone accents (emerald, ruby), sunburst rays, ' +
      'stepped patterns and fan shapes, sleek stylized figures, the glamour of a 1920s party.',
    sujet:
      'Subject: the Venetian mask, worn by a masked dancer in a mid-spin volte, rapier extended, cape spread wide, the ornate feathered Venetian mask ' +
      'shining in gold, confetti and fireworks bursting behind.',
  },
}

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

/** La référence d'une branche : sa forme ultime d'aujourd'hui, par le vrai composant. */
async function reference(page: any, cle: string, cible: string) {
  const svg = renderToStaticMarkup(React.createElement(Portrait, { cle }))
  await page.setContent(`<!doctype html><body style="margin:0"><div style="width:1024px;height:1024px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body>`)
  await page.screenshot({ path: cible, omitBackground: true, clip: { x: 0, y: 0, width: 1024, height: 1024 } })
}

/**
 * Athéna, recomposée en une image carrée : son décor peint, puis son
 * personnage détouré et recalé (essai.ts), le carré du disque seulement.
 */
async function athena(page: any, cible: string): Promise<boolean> {
  const decor = ['jpg', 'png'].map(e => path.join(ESSAI, `brut-decor-athena.${e}`)).find(f => existsSync(f))
  const perso = path.join(ESSAI, 'detoure-athena-1024.png')
  const journal = path.join(ESSAI, 'journal.json')
  if (!decor || !existsSync(perso) || !existsSync(journal)) return false
  const r = JSON.parse(readFileSync(journal, 'utf8'))['recalage-athena'] ?? { s: 1, dx: 0, dy: 0 }
  // En chaîne : tsx nomme les fonctions déclarées dans un `evaluate`, et
  // Chromium ne connaît pas l'aide qu'il y glisse (`__name`).
  const code = `(async ([d, p, s, dx, dy]) => {
    const [decor, perso] = await Promise.all([d, p].map(src => new Promise((ok, ko) => {
      const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = src
    })))
    const c = document.createElement('canvas')
    c.width = c.height = 1024
    const x = c.getContext('2d')
    x.drawImage(decor, 0, 0, 1024, 1024)
    // Le canevas du personnage couvre −30 → 130 ; le carré rendu, 0 → 100.
    const k = 1024 / 100
    x.drawImage(perso, (50 - 80 * s + dx) * k, (50 - 80 * s + dy) * k, 160 * s * k, 160 * s * k)
    return c.toDataURL('image/png')
  })`
  const png: string = await page.evaluate(`${code}(${JSON.stringify([enDataUrl(decor), enDataUrl(perso), r.s, r.dx, r.dy])})`)
  writeFileSync(cible, Buffer.from(png.slice(png.indexOf(',') + 1), 'base64'))
  return true
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
    const style = b.key === 'mythes' ? 'L’anime (validé)' : STYLES[b.key]?.nom
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
const nav = await chromium.launch({ headless: true })
try {
  const page = await nav.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 })
  await page.setContent('<!doctype html><body style="margin:0"></body>')
  if (await athena(page, fichier('style-mythes.png'))) console.log('mythes : Athéna recomposée')
  const branches = BRANCHES.filter((b: any) => b.key !== 'mythes' && (voulues.length === 0 || voulues.includes(b.key)))
  for (const b of branches) {
    const p = b.portraits[5]
    const ref = fichier(`reference-${b.key}.png`)
    await reference(page, p.key, ref)
    const s = STYLES[b.key]
    const consigne = [COMMUN, ULTIME, REFERENCE, s.style, s.sujet].join('\n\n')
    writeFileSync(fichier(`consigne-${b.key}.txt`), consigne + '\n')
    if (REFERENCES) continue
    const deja = existant(`style-${b.key}`)
    if (deja && !REGENERER) {
      console.log(`${b.key} : déjà généré, gardé (--regenerer pour le repayer)`)
      continue
    }
    console.log(`${b.key} : ${s.nom}, ${MODELE} ${TAILLE}…`)
    const r = await generer([enPartie(ref), { text: consigne }], { modele: MODELE, taille: TAILLE })
    writeFileSync(fichier(`style-${b.key}.${formatDe(r.image).ext}`), r.image)
    const cout = coutEstime(r.jetons)
    journal.push({ branche: b.key, date: new Date().toISOString(), modele: MODELE, taille: TAILLE, secondes: r.secondes, jetons: r.jetons, cout })
    // Écrit à chaque image : une panne au milieu ne perd pas le compte de ce qui a été payé.
    writeFileSync(cheminJournal, JSON.stringify(journal, null, 2) + '\n')
    const total = journal.reduce((n, e) => n + (e.cout ?? 0), 0)
    console.log(`${b.key} : ${r.secondes.toFixed(0)} s, environ ${cout.toFixed(3)} $ (total ${total.toFixed(2)} $)`)
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
