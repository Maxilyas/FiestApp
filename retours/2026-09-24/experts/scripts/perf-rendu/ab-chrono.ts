// A/B sur une vraie page : pendant UNE question longue, on change seulement la
// feuille de style du chronomètre, dix secondes par variante, et on compte ce
// que chaque variante coûte au fil principal.
//
//   A  tel quel : `width` réécrit tous les dixièmes, `transition: width .12s`
//   B  `transition: none` : la largeur saute, plus d'animation de mise en page
//   C  chronomètre masqué : le plancher (ce que coûte le reste de l'écran)
//   D  le correctif proposé, simulé : la barre posée en `transform: scaleX`
//      par une animation CSS unique — la largeur ne bouge plus.
//
// Avec MODE=deco : une salle d'habitués (finitions hautes, un tiers de
// légendaires, un quart d'Éclats — les dérivations sont forcées, comme dans
// soiree.ts), l'écran commun et le téléphone en salle d'attente, et l'on
// éteint les animations décoratives une famille à la fois.
//
//   cd server && npx tsx ../retours/2026-09-24/experts/scripts/perf-rendu/ab-chrono.ts
//   cd server && MODE=deco npx tsx ../retours/2026-09-24/experts/scripts/perf-rendu/ab-chrono.ts
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { io } from 'socket.io-client'
import { createQuizServer } from '../../../../../server/src/server'
import { ProfileStore } from '../../../../../server/src/auth/profiles'
import { LEGENDAIRES } from '../../../../../shared/legendaires'

const DECO = process.env.MODE === 'deco'
const AVATARS = ['🦊', '🐼', '🐸', '🦁', '🐙', '🦄', '🐯', '🐨', '🐵', '🦉']
if (DECO) {
  const P = ProfileStore.prototype as any
  const h = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
  P.niveauOf = (p: any) => 10 + (h(p.id) % 40)
  P.legendairePorte = (p: any) => (h(p.id) % 3 === 0 ? LEGENDAIRES[h(p.id) % LEGENDAIRES.length].key : null)
  P.eclatsOf = (id: string) => (h(id) % 4 === 0 ? [...AVATARS, ...LEGENDAIRES.map(l => l.key)] : [])
}

const ICI = path.dirname(fileURLToPath(import.meta.url))
const RACINE = path.resolve(ICI, '../../../../..')
const SORTIE = path.join(RACINE, 'export/evaluations/perf-rendu', DECO ? 'ab-deco' : 'ab-chrono')
rmSync(SORTIE, { recursive: true, force: true })
mkdirSync(SORTIE, { recursive: true })
const patienter = (ms: number) => new Promise(r => setTimeout(r, ms))
const ADMIN = { login: 'perf', password: 'perf-pass-1', slug: 'perf', name: 'Perf' }
const serveur = await createQuizServer({ port: 0, dbPath: path.join(SORTIE, 'l.db'), quizDbUrl: `file:${path.join(SORTIE, 'p.db')}`, admin: ADMIN })
const BASE = `http://localhost:${serveur.port}`
const post = async (c: string, b: unknown, cookie?: string, method = 'POST') => {
  const r = await fetch(BASE + c, { method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'quizz', ...(cookie && { Cookie: cookie }) }, body: JSON.stringify(b) })
  return { json: (await r.json().catch(() => null)) as any, sc: r.headers.get('set-cookie') ?? '' }
}
const cookie = /qz_session=[^;]+/.exec((await post('/api/auth/login', { login: ADMIN.login, password: ADMIN.password })).sc)![0]
const q = await post('/api/quizzes', { title: 'Long' }, cookie)
await post(`/api/quizzes/${q.json.id}`, { title: 'Long', questions: [{ kind: 'choice', text: 'Quel est le plus long fleuve de France ?', answers: ['La Loire', 'La Seine', 'Le Rhône', 'La Garonne'], correct: 0, duration: 120, image: null }] }, cookie, 'PUT')

const g = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
const pw = createRequire(path.join(g, 'x.js'))('playwright')
const nav = await pw.chromium.launch({ headless: true })

// Un joueur pour le téléphone, par son jeton.
const s = io(BASE, { transports: ['websocket'], forceNew: true })
await new Promise(r => s.once('connect', r))
await new Promise(r => s.emit('party:watch', { slug: ADMIN.slug }, r))
const me: any = await new Promise(r => s.emit('player:join', { slug: ADMIN.slug, name: 'Jeanne', avatar: '🐢' }, r))
s.close()

async function page(viewport: any, mobile: boolean, cpu: number, url: string, init?: string) {
  const ctx = await nav.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 })
  await ctx.addCookies([{ name: 'qz_session', value: cookie.split('=')[1], url: BASE }])
  if (init) await ctx.addInitScript(init)
  const p = await ctx.newPage()
  const cdp = await ctx.newCDPSession(p)
  await cdp.send('Performance.enable')
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
  await p.goto(BASE + url)
  return { p, cdp }
}
const ecran = await page({ width: 1366, height: 768 }, false, 2, '/host')
const tel = await page({ width: 360, height: 640 }, true, 6, `/${ADMIN.slug}`, `localStorage.setItem('quizz.me.perf', ${JSON.stringify(JSON.stringify({ playerId: me.playerId, token: me.token }))})`)

const fantomes: any[] = []
if (DECO) {
  for (let i = 0; i < 30; i++) {
    const r = await post('/api/joueur/inscription', { login: `deco${i}`, password: 'motdepasse1', name: `Invité ${i}`, avatar: AVATARS[i % 10] })
    const ck = /qz_joueur=[^;]+/.exec(r.sc)![0]
    const f = io(BASE, { transports: ['websocket'], forceNew: true, extraHeaders: { Cookie: ck } })
    await new Promise(r => f.once('connect', r))
    await new Promise(r => f.emit('party:watch', { slug: ADMIN.slug }, r))
    await new Promise(r => f.emit('player:join', { slug: ADMIN.slug }, r))
    fantomes.push(f)
  }
  await patienter(3000)
  await ecran.p.screenshot({ path: path.join(SORTIE, 'ecran-salle.png') })
  await tel.p.screenshot({ path: path.join(SORTIE, 'tel-salle.png') })
  const compte = await ecran.p.evaluate(() => ({
    avatars: document.querySelectorAll('.av').length,
    legendaires: document.querySelectorAll('.av-legendaire').length,
    eclats: document.querySelectorAll('.av-eclat').length,
    animations: document.getAnimations().length,
  }))
  console.log('écran commun, salle d’attente :', JSON.stringify(compte))
  const compteTel = await tel.p.evaluate(() => ({ avatars: document.querySelectorAll('.av').length, animations: document.getAnimations().length }))
  console.log('téléphone, salle d’attente :', JSON.stringify(compteTel))
}

const hote = io(BASE, { transports: ['websocket'], forceNew: true, extraHeaders: { Cookie: cookie } })
await new Promise(r => hote.once('connect', r))
await new Promise(r => hote.emit('host:hello', {}, r))
hote.on('session:view', (p: any) => {
  if (p.view.phase === 'pickPack') hote.emit('host:command', { sessionId: p.sessionId, command: { type: 'selectPack', packId: q.json.id } })
})
if (!DECO) {
  hote.emit('host:launch')
  await ecran.p.waitForSelector('.timer-fill', { timeout: 20000 })
  await tel.p.waitForSelector('.timer-fill', { timeout: 20000 })
  await patienter(1500)
}

const VARIANTES: Record<string, string> = DECO ? {
  'tout': '',
  'sans légendaires': '.lg * { animation: none !important; }',
  'sans halos (holo, prisme, aurore, constellation)': '.av::before, .av::after { animation: none !important; }',
  'sans Éclat (filtre + paillettes)': '.av-eclat .av-emoji { filter: none !important; } .av-eclat::after { animation: none !important; }',
  'rien d’animé': '*, *::before, *::after { animation: none !important; }',
  // Pistes : borner la mise en page au médaillon, ou le poser sur son propre calque.
  'légendaires confinés (contain: strict)': '.av-legendaire .av-emoji, .av-divin .av-emoji { contain: strict; }',
  'légendaires sur calque (will-change)': '.av-legendaire svg, .av-divin svg { will-change: transform; }',
} : {
  A: '',
  B: '.timer-fill { transition: none !important; }',
  C: '.timer { display: none !important; }',
  // La barre ne change plus de largeur : une seule animation composée,
  // posée une fois pour la durée restante (ici, 60 s).
  D: '.timer-fill { width: 100% !important; transition: none !important; transform-origin: left; animation: ab-vide 60s linear forwards !important; } @keyframes ab-vide { from { transform: scaleX(1) } to { transform: scaleX(0) } }',
}
const lignes: string[] = []
const metr = async (cdp: any) => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m: any) => [m.name, m.value]))
for (let tour = 0; tour < 2; tour++) {
  for (const [nom, css] of Object.entries(VARIANTES)) {
    for (const [app, a] of [['ecran-1366-x2', ecran], ['tel-360-x6', tel]] as const) {
      await a.p.evaluate((c: string) => {
        let st = document.getElementById('ab') as HTMLStyleElement | null
        if (!st) {
          st = document.createElement('style')
          st.id = 'ab'
          document.head.appendChild(st)
        }
        st.textContent = c
      }, css)
    }
    await patienter(1000)
    const avant = await Promise.all([metr(ecran.cdp), metr(tel.cdp)])
    await patienter(DECO ? 8000 : 10000)
    const apres = await Promise.all([metr(ecran.cdp), metr(tel.cdp)])
    for (const [i, app] of ['ecran-1366-x2', 'tel-360-x6'].entries()) {
      const dt = apres[i].Timestamp - avant[i].Timestamp
      const d = (k: string) => (apres[i][k] - avant[i][k]) / dt
      const l = `| ${tour + 1} | ${nom} | ${app} | ${d('LayoutCount').toFixed(1)} | ${(d('LayoutDuration') * 1000).toFixed(1)} | ${d('RecalcStyleCount').toFixed(1)} | ${(d('RecalcStyleDuration') * 1000).toFixed(1)} | ${(d('ScriptDuration') * 1000).toFixed(1)} | ${(d('TaskDuration') * 1000).toFixed(1)} |`
      lignes.push(l)
      console.log(l)
    }
  }
}
writeFileSync(path.join(SORTIE, 'ab.md'), '| tour | variante | appareil | layouts/s | layout ms/s | styles/s | style ms/s | script ms/s | occupé ms/s |\n|---|---|---|--:|--:|--:|--:|--:|--:|\n' + lignes.join('\n') + '\n')
hote.close()
await nav.close()
await serveur.close()
process.exit(0)
