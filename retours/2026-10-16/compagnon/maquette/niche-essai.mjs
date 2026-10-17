// Planche d'essai du cadrage : chaque forme dans sa niche, et les humeurs du loup adulte.
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const ici = path.dirname(fileURLToPath(import.meta.url))
const { chromium } = createRequire(path.join(spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim(), 'rendu.js'))('playwright')
const nav = await chromium.launch()
const page = await nav.newPage({ viewport: { width: 760, height: 420 }, deviceScaleFactor: 3 })
await page.route('http://maquette.local/**', r => {
  const u = new URL(r.request().url())
  if (u.pathname.startsWith('/mq-humeurs/')) return r.fulfill({ path: path.join(ici, 'humeurs', u.pathname.split('/').pop()), contentType: 'image/webp' })
  return r.fulfill({ contentType: 'text/html', body: '<html><body style="margin:0;background:#1a1412;padding:24px;font:12px Figtree,sans-serif;color:#a89b8a"><div id="g" style="display:grid;grid-template-columns:repeat(8,80px);gap:22px 10px"></div></body></html>' })
})
await page.goto('http://maquette.local/')
await page.addScriptTag({ path: path.join(ici, 'niche.js') })
await page.evaluate(() => {
  const g = document.getElementById('g')
  const cles = Object.keys(window.__niche.CADRAGE)
  const cases = [...cles.map(c => [c, 'neutre']), ...['ravi', 'depite', 'triomphe'].map(h => ['loup-adulte', h])]
  for (const [cle, humeur] of cases) {
    const d = document.createElement('div')
    d.style.cssText = 'height:96px'
    g.appendChild(d)
    window.__niche.poser({ cle, humeur, dans: d, garder: true, base: '/mq-humeurs/' })
    const t = document.createElement('div')
    t.textContent = cle.replace('loup-', '').replace('chat-', 'ch ').replace('tortue-', 'to ') + (humeur !== 'neutre' ? ' ' + humeur : '')
    d.appendChild(t)
  }
})
await page.waitForTimeout(1200)
await page.screenshot({ path: path.join(ici, 'controle', 'niche-essai.png') })
await nav.close()
