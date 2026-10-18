// Maquette — trois planches de la niche, en grand, sans serveur : sa niche et
// son décor peint (celui de son avatar), sa niche sur la durée (ses paliers
// après 500 bonnes réponses), et la luciole dans la sienne, forme par forme.
//
//   cd server && npx tsx ../retours/2026-10-16/compagnon/maquette/planche-niche.ts
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ici = path.dirname(fileURLToPath(import.meta.url))
const REPO = fileURLToPath(new URL('../../../..', import.meta.url))
const SORTIE = path.join(ici, 'captures', 'planches')
mkdirSync(SORTIE, { recursive: true })
const PUBLIC = path.join(REPO, 'client/public/compagnons')
const LUCIOLE = path.join(ici, 'humeurs-luciole')

const { chromium } = createRequire(path.join(spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim(), 'rendu.js'))('playwright')
const nav = await chromium.launch({ headless: true })

/** Le décor peint d'une forme, tel que l'appli le sert (sa grande taille). */
const decor = (cle: string) => {
  const f = readdirSync(PUBLIC).find(n => n.startsWith(`${cle}-disque-512.`))
  return f ? `/compagnons/${f}` : undefined
}
const POLICES = {
  figtree: readFileSync(path.join(REPO, 'client/public/fonts/figtree-variable.woff2')).toString('base64'),
  cormorant: readFileSync(path.join(REPO, 'client/public/fonts/cormorant-garamond-600.woff2')).toString('base64'),
}

interface Case {
  niche: Record<string, unknown>
  titre: string
  sous?: string
  palier?: string
}

async function planche(nom: string, titre: string, sous: string, rangees: Case[][], zoom = 2.6) {
  const page = await nav.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 2 })
  await page.route('**/*', async (route: any) => {
    const u = new URL(route.request().url())
    const fichier = decodeURIComponent(u.pathname.split('/').pop()!)
    if (u.pathname.startsWith('/compagnons/')) return route.fulfill({ path: path.join(PUBLIC, fichier), contentType: 'image/webp' })
    if (u.pathname.startsWith('/mq-humeurs/')) {
      const dossier = fichier.startsWith('luciole-') ? LUCIOLE : path.join(ici, 'humeurs')
      return route.fulfill({ path: path.join(dossier, fichier), contentType: 'image/webp' })
    }
    return route.fulfill({ body: '', contentType: 'text/html' })
  })
  await page.goto('http://planche.local/')
  for (const f of ['niche.js', 'paliers.js']) await page.addScriptTag({ path: path.join(ici, f) })
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Figtree;src:url(data:font/woff2;base64,${POLICES.figtree}) format('woff2');font-weight:300 900}
@font-face{font-family:Cormorant;src:url(data:font/woff2;base64,${POLICES.cormorant}) format('woff2');font-weight:600}
html,body{margin:0;background:#1a1412;color:#f3ece2;font-family:Figtree,sans-serif}
.pl{padding:34px 40px 40px;display:inline-block}
h1{font:600 34px/1.1 Cormorant,serif;margin:0 0 4px;color:#f3ece2}
.sous{font-size:14px;color:#a89b8a;margin:0 0 26px;max-width:${rangees[0].length * 210}px}
.rangee{display:flex;gap:26px;margin-bottom:26px}
.case{width:184px;display:flex;flex-direction:column;align-items:center;gap:12px;background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.01));border:1px solid rgba(217,181,106,.16);border-radius:22px;padding:30px 8px 16px}
.scene{height:${Math.round(62 * zoom) + 26}px;display:flex;align-items:flex-end;justify-content:center}
.zoom{zoom:${zoom}}
.palier{font:700 11px/1 Figtree,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#d9b56a}
.titre{font:600 21px/1.1 Cormorant,serif;text-align:center}
.cas-sous{font-size:12.5px;line-height:1.35;color:#a89b8a;text-align:center;min-height:2.7em}
</style><div class="pl"><h1>${titre}</h1><p class="sous">${sous}</p>${rangees
    .map(
      (r, i) =>
        `<div class="rangee">${r
          .map(
            (c, j) =>
              `<div class="case">${c.palier ? `<span class="palier">${c.palier}</span>` : ''}<div class="scene"><div class="zoom" id="n${i}-${j}"></div></div><span class="titre">${c.titre}</span>${c.sous ? `<span class="cas-sous">${c.sous}</span>` : ''}</div>`,
          )
          .join('')}</div>`,
    )
    .join('')}</div>`)
  for (const [i, r] of rangees.entries())
    for (const [j, c] of r.entries()) {
      await page.evaluate(
        ([id, o, palier]: [string, any, string | undefined]) => {
          const el = (window as any).__niche.poser({ ...o, dans: document.getElementById(id) })
          if (palier) (window as any).__paliers.orner(el, palier)
        },
        [`n${i}-${j}`, { garder: true, ...c.niche }, (c.niche as any).ornement],
      )
    }
  await page.evaluate('Promise.all([...document.images].map(i => i.decode().catch(() => {})))')
  await page.waitForTimeout(1200)
  const boite = await page.locator('.pl').boundingBox()
  await page.screenshot({ path: path.join(SORTIE, `${nom}.png`), clip: boite })
  await page.close()
  console.log(`→ ${nom}.png`)
}

try {
  // 1 · La niche et son décor peint : la même que l'avatar, sans le médaillon.
  await planche(
    'niche-decor',
    'Sa niche, et son vrai décor',
    'Le ciel peint de son avatar passe dans la niche : la pleine lune derrière le loup adulte, la forêt sous la neige du jeune, les rubans d’étoiles de la forme ultime. Toujours la même arche, au même coin.',
    [
      [
        { niche: { cle: 'loup-louveteau' }, titre: 'Le louveteau', sous: 'pas encore de décor : son ciel de nuit' },
        { niche: { cle: 'loup-jeune', fond: decor('loup-jeune') }, titre: 'Le jeune loup', sous: 'la clairière sous la neige' },
        { niche: { cle: 'loup-adulte', fond: decor('loup-adulte') }, titre: 'Le loup adulte', sous: 'la pleine lune, au-dessus des nuages' },
        { niche: { cle: 'loup-ultime', fond: decor('loup-ultime') }, titre: 'Le loup des étoiles', sous: 'ses rubans d’étoiles' },
      ],
      [
        { niche: { cle: 'loup-adulte', fond: decor('loup-adulte') }, titre: 'Pendant la question', sous: 'immobile' },
        { niche: { cle: 'loup-adulte', fond: decor('loup-adulte'), humeur: 'ravi' }, titre: 'Bonne réponse', sous: 'il sautille, des cœurs' },
        { niche: { cle: 'loup-adulte', fond: decor('loup-adulte'), humeur: 'depite' }, titre: 'Ratée', sous: 'il pleut sur sa lune' },
        { niche: { cle: 'loup-adulte', fond: decor('loup-adulte'), humeur: 'triomphe' }, titre: 'Victoire', sous: 'il hurle sous les rayons' },
      ],
    ],
  )

  // 2 · Sur la durée : la même niche, un peu plus belle à chaque palier.
  const ultime = { cle: 'loup-ultime', fond: decor('loup-ultime') }
  await planche(
    'niche-duree',
    'Après 500 : sa niche s’embellit',
    'Sa forme ultime atteinte, ses bonnes réponses continuent de compter : à chaque palier, la niche gagne un ornement et le garde. Rien ne bouge de place, rien ne grandit — la même niche, plus belle.',
    [
      [
        { niche: { ...ultime }, palier: '500', titre: 'Sa forme ultime', sous: 'le bout des quatre formes' },
        { niche: { ...ultime, ornement: 'ami' }, palier: '1 000', titre: 'Amis pour la vie', sous: 'une guirlande de petites lampes' },
        { niche: { ...ultime, ornement: 'complice' }, palier: '2 500', titre: 'Complices', sous: 'du lierre et des fleurs au rebord' },
        { niche: { ...ultime, ornement: 'inseparable' }, palier: '5 000', titre: 'Inséparables', sous: 'l’arche dorée, son étoile' },
        { niche: { ...ultime, ornement: 'legende' }, palier: '10 000', titre: 'Légende', sous: 'un halo, et son ciel qui scintille' },
      ],
    ],
  )

  // 3 · La luciole, si la chaîne l'a peinte et que ses humeurs sont rognées.
  const cadrages = path.join(LUCIOLE, 'cadrages.json')
  if (existsSync(cadrages)) {
    const c = JSON.parse(readFileSync(cadrages, 'utf8')) as Record<string, { cadrage: object; ratio: number; fond?: string }>
    const luciole = (forme: string, humeur?: string) => ({ cle: `luciole-${forme}`, humeur, cadrage: c[forme].cadrage, ratio: c[forme].ratio, fond: c[forme].fond })
    await planche(
      'niche-luciole',
      'La luciole, dans sa niche',
      'La compagne de l’Expédition : on ne l’achète pas, un haut fait la donne. Elle grandit comme les autres, avec les bonnes réponses données en la portant.',
      [
        [
          { niche: luciole('ver'), titre: 'Le ver luisant', sous: 'sur sa feuille' },
          { niche: luciole('jeune'), titre: 'La jeune luciole', sous: 'le pré d’été, à la nuit tombée' },
          { niche: luciole('adulte'), titre: 'La luciole des sentiers', sous: 'la forêt, et sa traînée de lumière' },
          { niche: luciole('constellation'), titre: 'La luciole-constellation', sous: 'son essaim autour d’elle' },
        ],
        [
          { niche: luciole('adulte'), titre: 'Pendant la question', sous: 'immobile' },
          { niche: luciole('adulte', 'ravi'), titre: 'Bonne réponse', sous: 'sa lanterne s’allume' },
          { niche: luciole('adulte', 'depite'), titre: 'Ratée', sous: 'les antennes tombent' },
          { niche: luciole('adulte', 'triomphe'), titre: 'Victoire', sous: 'elle brille de tout son ventre' },
        ],
      ],
    )
  }
} finally {
  await nav.close()
}
process.exit(0)
