// Le ressenti : chaque page, chargée à froid (sans cache) dans un Chromium
// profil téléphone, réseau « 4G moyenne » (150 ms, 1,6 Mb/s descendant,
// 750 kb/s montant) et processeur ralenti ×N, N passages, la médiane.
// Usage : node mesure.mjs <base> <cookie animateur> [cpu=4] [n=5] [pages=invite,accueil,...]
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
const require = createRequire(execSync('npm root -g').toString().trim() + '/x.js')
const { chromium } = require('playwright')

const [base, cookie, cpuArg = '4', nArg = '5', filtre] = process.argv.slice(2)
const CPU = Number(cpuArg), N = Number(nArg)
const RESEAU = { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 }
const TEL = { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 11; SM-A125F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36' }
const TV = { viewport: { width: 1366, height: 768 } }

// Les jalons : l'instant (performance.now) où chaque sélecteur apparaît.
const PAGES = {
  invite: { url: '/banc', ctx: TEL, jalons: { entree: '.entree .btn-accent', lobby: '.me-header' }, parcours: true },
  accueil: { url: '/', ctx: TEL, jalons: { pret: 'form input, .profil input, button.btn-primary' } },
  host: { url: '/host', ctx: TV, auth: true, jalons: { pret: '.join-url' } },
  edit: { url: '/edit', ctx: TV, auth: true, jalons: { pret: '.quiz-list .quiz-row-main' } },
  souvenir: { url: '/banc/souvenir', ctx: TEL, jalons: { pret: '.recap-header' } },
  bilan: { url: '/banc/bilan', ctx: TEL, jalons: { pret: '.bilan-tabs, .recap.bilan .card' } },
}

const initScript = jalons => {
  const m = (window.__m = { lcp: 0, cls: 0, longues: [], jalons: {} })
  new PerformanceObserver(l => { for (const e of l.getEntries()) m.lcp = e.startTime }).observe({ type: 'largest-contentful-paint', buffered: true })
  new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) m.cls += e.value }).observe({ type: 'layout-shift', buffered: true })
  new PerformanceObserver(l => { for (const e of l.getEntries()) m.longues.push([e.startTime, e.duration]) }).observe({ type: 'longtask', buffered: true })
  const voir = () => { for (const [k, s] of Object.entries(jalons)) if (!m.jalons[k] && document.querySelector(s)) m.jalons[k] = performance.now() }
  new MutationObserver(voir).observe(document, { subtree: true, childList: true, attributes: true })
}

async function unPassage(nav, nom, p) {
  const ctx = await nav.newContext({ ...p.ctx, locale: 'fr-FR' })
  if (p.auth) await ctx.addCookies([{ name: cookie.split('=')[0], value: cookie.split('=').slice(1).join('='), url: base }])
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
  await cdp.send('Network.emulateNetworkConditions', RESEAU)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
  const reqs = []; const octets = {}; let ws = 0
  cdp.on('Network.requestWillBeSent', e => reqs.push({ id: e.requestId, url: e.request.url.replace(base, ''), t: e.timestamp }))
  cdp.on('Network.loadingFinished', e => { octets[e.requestId] = e.encodedDataLength })
  cdp.on('Network.webSocketCreated', () => ws++)
  let ttfbCdp = null
  cdp.on('Network.responseReceived', e => { if (e.type === 'Document' && ttfbCdp == null) ttfbCdp = (e.timestamp - reqs[0].t) * 1000 })
  await page.addInitScript(initScript, p.jalons)
  await page.goto(base + p.url, { waitUntil: 'commit' })
  const [premier] = Object.keys(p.jalons)
  await page.waitForFunction(k => window.__m?.jalons[k], premier, { timeout: 60_000 })
  let parcours = {}
  if (p.parcours) {
    // L'invité : « Jouer sans compte », son prénom, « Continuer »… jusqu'à la salle d'attente.
    const t0 = await page.evaluate(() => performance.now())
    await page.click('.entree .btn-accent')
    await page.waitForSelector('#join-name')
    parcours.prenom = (await page.evaluate(() => performance.now())) - t0
    await page.fill('#join-name', 'Mesure' + Math.floor(Math.random() * 1e4))
    const t1 = await page.evaluate(() => performance.now())
    for (let i = 0; i < 4 && !(await page.$('.me-header')); i++) {
      const b = await page.$('form .btn-primary:not([disabled])')
      if (b) await b.click()
      await page.waitForTimeout(300)
    }
    await page.waitForSelector('.me-header', { timeout: 30_000 })
    parcours.rejoindre = (await page.evaluate(() => performance.now())) - t1
  }
  await page.waitForTimeout(1500)
  const r = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0]
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]
    const m = window.__m
    const tbt = m.longues.filter(([s]) => s > (fcp?.startTime ?? 0)).reduce((a, [, d]) => a + Math.max(0, d - 50), 0)
    return { ttfb: nav.responseStart, fcp: fcp?.startTime, lcp: m.lcp, cls: m.cls, tbt, longues: m.longues.length,
      longueMax: Math.max(0, ...m.longues.map(l => l[1])), jalons: m.jalons, dcl: nav.domContentLoadedEventEnd }
  })
  const t0 = reqs[0]?.t
  const avantPret = reqs.filter(q => (q.t - t0) * 1000 <= (r.jalons[premier] ?? 1e9))
  const total = Object.values(octets).reduce((a, b) => a + b, 0)
  const pret = avantPret.reduce((a, q) => a + (octets[q.id] ?? 0), 0)
  await ctx.close()
  return { ...r, ttfb: ttfbCdp, ...parcours, requetes: reqs.length, requetesAvantPret: avantPret.length, octets: total, octetsAvantPret: pret, ws,
    liste: reqs.map(q => `${((q.t - t0) * 1000).toFixed(0)}ms ${q.url} ${octets[q.id] ?? '?'}`) }
}

const med = a => { const s = a.filter(x => x != null).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null }
const nav = await chromium.launch({ headless: true,  })
const sortie = {}
for (const [nom, p] of Object.entries(PAGES)) {
  if (filtre && !filtre.split(',').includes(nom)) continue
  const runs = []
  for (let i = 0; i < N; i++) runs.push(await unPassage(nav, nom, p))
  const cles = ['ttfb', 'fcp', 'lcp', 'cls', 'tbt', 'longues', 'longueMax', 'dcl', 'prenom', 'rejoindre', 'requetes', 'requetesAvantPret', 'octets', 'octetsAvantPret', 'ws']
  const m = Object.fromEntries(cles.map(k => [k, med(runs.map(r => r[k]))]))
  for (const k of Object.keys(p.jalons)) m['jalon_' + k] = med(runs.map(r => r.jalons[k]))
  m.serie = Object.fromEntries(['fcp', 'lcp', ...Object.keys(p.jalons).map(k => 'jalon_' + k)].map(k => [k, runs.map(r => Math.round(k.startsWith('jalon_') ? r.jalons[k.slice(6)] : r[k]))]))
  m.cascade = runs[0].liste
  sortie[nom] = m
  console.error(nom, JSON.stringify({ ...m, cascade: undefined }))
}
await nav.close()
console.log(JSON.stringify({ cpu: CPU, n: N, reseau: RESEAU, pages: sortie }, null, 1))
