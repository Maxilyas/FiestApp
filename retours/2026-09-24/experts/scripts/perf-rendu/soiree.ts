// Une soirée mesurée : un serveur jetable, un quiz de trente questions joué
// d'affilée par un animateur scripté et des invités fantômes, et trois
// navigateurs instrumentés — l'écran commun (processeur ×2) et deux
// téléphones (×4 et ×6). Chaque seconde, chaque page rend ses compteurs
// (sonde.js) et ses métriques CDP ; tout part dans un JSON que lit analyse.mjs.
//
//   cd server && npx tsx ../retours/2026-09-24/experts/scripts/perf-rendu/soiree.ts
//
// Variables : RUN (nom du dossier de sortie), SALLE=anonyme|decoree (des
// fantômes à profil, niveaux hauts, légendaires et Éclats), FANTOMES (30),
// QUESTIONS (30), ATTRIB=1 (nomme les composants rendus : client non minifié),
// ECRAN=1366x768|1920x1080, CPU_ECRAN (2), CPU_TEL (4,6).
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { io, type Socket } from 'socket.io-client'
import { createQuizServer } from '../../../../../server/src/server'
import { ProfileStore } from '../../../../../server/src/auth/profiles'
import { LEGENDAIRES } from '../../../../../shared/legendaires'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const RACINE = path.resolve(ICI, '../../../../..')
const RUN = process.env.RUN ?? `run-${Date.now()}`
const SORTIE = path.join(RACINE, 'export/evaluations/perf-rendu', RUN)
const SALLE = process.env.SALLE ?? 'anonyme'
const N_FANTOMES = Number(process.env.FANTOMES ?? 30)
const N_QUESTIONS = Number(process.env.QUESTIONS ?? 30)
const ATTRIB = process.env.ATTRIB === '1'
const [ECRAN_L, ECRAN_H] = (process.env.ECRAN ?? '1366x768').split('x').map(Number)
const CPU_ECRAN = Number(process.env.CPU_ECRAN ?? 2)
const CPU_TEL = (process.env.CPU_TEL ?? '4,6').split(',').map(Number)
const GC_TOUTES = 5 // un ramassage forcé (et une mesure de tas propre) toutes les 5 questions

rmSync(SORTIE, { recursive: true, force: true })
mkdirSync(SORTIE, { recursive: true })
const patienter = (ms: number) => new Promise(r => setTimeout(r, ms))
const t0 = Date.now()
const log = (...a: unknown[]) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a)

// ── Une salle d'habitués : des profils aux distinctions les plus riches ────
// Le serveur jetable est le nôtre : on force les dérivations plutôt que de
// jouer cent soirées pour décrocher des légendaires.
if (SALLE === 'decoree') {
  const P = ProfileStore.prototype as any
  const h = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
  P.niveauOf = function (p: any) {
    return 10 + (h(p.id) % 40)
  }
  P.legendairePorte = function (p: any) {
    return h(p.id) % 3 === 0 ? LEGENDAIRES[h(p.id) % LEGENDAIRES.length].key : null
  }
  // `cibleEclat` rend l'emoji ou le légendaire porté : un profil sur quatre
  // a vu éclater tout ce qu'il pourrait porter.
  P.eclatsOf = function (id: string) {
    return h(id) % 4 === 0 ? [...AVATARS, ...LEGENDAIRES.map(l => l.key)] : []
  }
}

const AVATARS = ['🦊', '🐼', '🐸', '🦁', '🐙', '🦄', '🐯', '🐨', '🐵', '🦉']

const ADMIN = { login: 'perf', password: 'perf-pass-1', slug: 'perf', name: 'Perf' }
const serveur = await createQuizServer({
  port: 0,
  dbPath: path.join(SORTIE, 'locale.db'),
  quizDbUrl: `file:${path.join(SORTIE, 'permanente.db')}`,
  admin: ADMIN,
  publicUrl: 'http://localhost',
})
const BASE = `http://localhost:${serveur.port}`
log('serveur', BASE, 'salle', SALLE)

async function poster(chemin: string, corps: unknown, cookie?: string, method = 'POST') {
  const res = await fetch(BASE + chemin, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'quizz', ...(cookie && { Cookie: cookie }) },
    body: JSON.stringify(corps),
  })
  const json: any = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`${chemin} ${res.status} ${JSON.stringify(json)}`)
  return { json, setCookie: res.headers.get('set-cookie') ?? '' }
}
const login = await poster('/api/auth/login', { login: ADMIN.login, password: ADMIN.password })
const cookieHote = /qz_session=[^;]+/.exec(login.setCookie)![0]

// ── Le navigateur ──────────────────────────────────────────────────────────
function chargerPlaywright(): any {
  const g = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  for (const base of [RACINE, g]) {
    try {
      return createRequire(path.join(base, 'x.js'))('playwright')
    } catch {}
  }
  throw new Error('playwright introuvable')
}
const pw = chargerPlaywright()
const navigateur = await pw.chromium.launch({
  headless: true,
  args: ['--enable-precise-memory-info', '--js-flags=--expose-gc'],
})

const PHOTO = `(function (g) {
    var c = document.createElement('canvas'); c.width = 1280; c.height = 960
    var x = c.getContext('2d'); var s = g
    function r() { s = (s * 16807) % 2147483647; return s / 2147483647 }
    var grad = x.createLinearGradient(0, 0, 1280, 960)
    grad.addColorStop(0, 'hsl(' + g * 40 + ',60%,40%)'); grad.addColorStop(1, 'hsl(' + (g * 40 + 120) + ',60%,60%)')
    x.fillStyle = grad; x.fillRect(0, 0, 1280, 960)
    for (var i = 0; i < 1500; i++) {
      x.fillStyle = 'hsla(' + r() * 360 + ',70%,' + (30 + r() * 50) + '%,' + (0.3 + r() * 0.5) + ')'
      x.beginPath(); x.arc(r() * 1280, r() * 960, 2 + r() * 40, 0, 7); x.fill()
    }
    var img = x.getImageData(0, 0, 1280, 960)
    for (var k = 0; k < img.data.length; k += 4) img.data[k] += (r() * 30) | 0
    x.putImageData(img, 0, 0)
    return c.toDataURL('image/webp', 0.82)
  })`

// Une vraie photo de téléphone, recompressée comme l'éditeur le fait (1280 px, WebP 0,82).
async function photo(graine: number): Promise<string> {
  const p = await navigateur.newPage()
  // En texte : tsx ajoute des `__name()` aux fonctions, inconnus de la page.
  const url = await p.evaluate(PHOTO + '(' + graine + ')')
  await p.close()
  return url
}

// ── Le quiz : trente questions courtes, de tous les genres ─────────────────
const photos: string[] = []
for (let i = 0; i < 3; i++) photos.push((await poster('/api/images', { dataUrl: await photo(i + 1) }, cookieHote)).json.url)
const questions: any[] = []
for (let i = 0; i < N_QUESTIONS; i++) {
  if (i % 5 === 3) {
    questions.push({ kind: 'number', text: `Combien de kilomètres entre Paris et la ville n° ${i} ?`, target: 400 + i * 7, unit: 'km', duration: 8, answers: [], correct: 0, image: null })
  } else if (i % 7 === 5) {
    questions.push({
      kind: 'choice',
      text: `Sur cette photo, combien de ballons rouges ? (question ${i + 1})`,
      answers: ['Trois', 'Quatre', 'Cinq', 'Aucun'],
      correct: 1,
      duration: 7,
      image: photos[i % photos.length],
      observeSeconds: i % 2 ? 3 : null,
    })
  } else {
    questions.push({
      kind: 'choice',
      text: i % 3 ? `Question ${i + 1} : quel est le plus long fleuve de France métropolitaine ?` : `Q${i + 1} — Qui a peint « La Liberté guidant le peuple », exposé au Louvre depuis 1874 ?`,
      answers: i % 4 === 0 ? ['Vrai', 'Faux'] : ['La Loire', 'La Seine', 'Le Rhône', 'La Garonne, qui traverse Toulouse et Bordeaux'],
      correct: 0,
      duration: 7,
      image: null,
      category: i % 2 ? 'Géographie' : undefined,
    })
  }
}
const cree = await poster('/api/quizzes', { title: 'Trente d’affilée' }, cookieHote)
await poster(`/api/quizzes/${cree.json.id}`, { title: 'Trente d’affilée', questions }, cookieHote, 'PUT')
const packId = cree.json.id

// ── Les fantômes ───────────────────────────────────────────────────────────
const PRENOMS = ['Camille', 'Camille', 'Jean-Baptiste-Alexandre', 'Zoé', 'Léa', 'Hugo', 'Maëlys', 'Karim', 'Nadia', 'Lucas', 'Élodie', 'Sofia', 'Jeanne', 'Marc', 'Inès', 'Théo', 'Chloé', 'Noah', 'Anaïs', 'Bastien', 'Yasmine', 'Grégoire', 'Aurélie', 'Tom', 'Manon', 'Rémi', 'Clémence', 'Ali', 'Océane', 'Victor']
const fantomes: Socket[] = []
async function fantome(i: number) {
  let cookie: string | undefined
  if (SALLE === 'decoree') {
    const r = await poster('/api/joueur/inscription', { login: `f${i}x${Date.now() % 100000}`, password: 'motdepasse1', name: PRENOMS[i % 30], avatar: AVATARS[i % 10] })
    cookie = /qz_joueur=[^;]+/.exec(r.setCookie)![0]
  }
  const s = io(BASE, { transports: ['websocket'], forceNew: true, ...(cookie && { extraHeaders: { Cookie: cookie } }) })
  await new Promise(r => s.once('connect', r))
  await new Promise(r => s.emit('party:watch', { slug: ADMIN.slug }, r))
  const res: any = await new Promise(r => s.emit('player:join', { slug: ADMIN.slug, ...(cookie ? {} : { name: PRENOMS[i % 30], avatar: AVATARS[i % 10] }) }, r))
  if (!res.ok) throw new Error('fantôme refusé ' + JSON.stringify(res))
  const vus = new Set<string>()
  s.on('session:view', ({ sessionId, view }: any) => {
    if (view.phase !== 'question') return
    const k = `${view.qIndex}:${view.round}`
    if (vus.has(k)) return
    vus.add(k)
    setTimeout(
      () => {
        const action = view.kind === 'number' ? { type: 'guess', value: Math.round(Math.random() * 900) } : { type: 'answer', choice: Math.floor(Math.random() * (view.answers?.length ?? 4)) }
        s.emit('player:action', { sessionId, action: { ...action, qIndex: view.qIndex, round: view.round } }, () => {})
      },
      400 + Math.random() * 4500,
    )
  })
  fantomes.push(s)
}

// Les téléphones mesurés entrent par leur jeton, comme un téléphone qui se re-présente.
async function jetonPour(nom: string, avatar: string) {
  const s = io(BASE, { transports: ['websocket'], forceNew: true })
  await new Promise(r => s.once('connect', r))
  await new Promise(r => s.emit('party:watch', { slug: ADMIN.slug }, r))
  const res: any = await new Promise(r => s.emit('player:join', { slug: ADMIN.slug, name: nom, avatar }, r))
  s.close()
  return { playerId: res.playerId, token: res.token }
}

// ── Les appareils mesurés ──────────────────────────────────────────────────
const SONDE = readFileSync(path.join(ICI, 'sonde.js'), 'utf8')
interface Appareil {
  nom: string
  page: any
  cdp: any
  mesures: any[]
}
async function appareil(nom: string, opts: { viewport: { width: number; height: number }; mobile: boolean; cpu: number; url: string; cookie?: string; me?: any }): Promise<Appareil> {
  const ctx = await navigateur.newContext({
    viewport: opts.viewport,
    deviceScaleFactor: opts.mobile ? 2 : 1,
    isMobile: opts.mobile,
    hasTouch: opts.mobile,
    locale: 'fr-FR',
  })
  if (opts.cookie) {
    const [k, v] = opts.cookie.split('=')
    await ctx.addCookies([{ name: k, value: v, url: BASE }])
  }
  if (ATTRIB) await ctx.addInitScript('window.__PERF_ATTRIB__ = true')
  await ctx.addInitScript(SONDE)
  if (opts.me) await ctx.addInitScript(`try { localStorage.setItem('quizz.me.${ADMIN.slug}', ${JSON.stringify(JSON.stringify(opts.me))}); localStorage.setItem('quizz.profile.${ADMIN.slug}', '{"name":"x","avatar":"🦊"}') } catch {}`)
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Performance.enable', { timeDomain: 'timeTicks' })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: opts.cpu })
  await page.goto(BASE + opts.url)
  return { nom, page, cdp, mesures: [] }
}

const ecran = await appareil(`ecran-${ECRAN_L}-x${CPU_ECRAN}`, { viewport: { width: ECRAN_L, height: ECRAN_H }, mobile: false, cpu: CPU_ECRAN, url: '/host', cookie: cookieHote })
const tels: Appareil[] = []
for (const cpu of CPU_TEL) {
  const me = await jetonPour(cpu === CPU_TEL[0] ? 'Jeanne-Mesure' : 'Hugo-Mesure', '🐢')
  tels.push(await appareil(`tel-360-x${cpu}`, { viewport: { width: 360, height: 640 }, mobile: true, cpu, url: `/${ADMIN.slug}`, me }))
}
const appareils = [ecran, ...tels]
await patienter(2500)
for (let i = 0; i < N_FANTOMES; i++) await fantome(i)
log(`${N_FANTOMES} fantômes dans la salle`)

// ── L'échantillonnage ──────────────────────────────────────────────────────
let moment = 'lobby'
let qIndex = -1
let gcAFaire = false
async function echantillonner(a: Appareil, gc: boolean) {
  const t = Date.now()
  try {
    if (gc) await a.cdp.send('HeapProfiler.collectGarbage')
    const { metrics } = await a.cdp.send('Performance.getMetrics')
    const m: Record<string, number> = {}
    for (const { name, value } of metrics) m[name] = value
    const s = await a.page.evaluate(() => (window as any).__perf?.prendre())
    a.mesures.push({ t, moment, qIndex, gc, m, s })
  } catch (e) {
    a.mesures.push({ t, moment, qIndex, erreur: String(e) })
  }
}
let enCours = true
const boucle = (async () => {
  while (enCours) {
    const debut = Date.now()
    const gc = gcAFaire
    gcAFaire = false
    await Promise.all(appareils.map(a => echantillonner(a, gc)))
    await patienter(Math.max(0, 1000 - (Date.now() - debut)))
  }
})()

// La salle d'attente, pleine, pendant 8 s (plus un ramassage).
await patienter(6000)
gcAFaire = true
await patienter(3000)

// ── L'animateur ────────────────────────────────────────────────────────────
const hote = io(BASE, { transports: ['websocket'], forceNew: true, extraHeaders: { Cookie: cookieHote } })
await new Promise(r => hote.once('connect', r))
await new Promise(r => hote.emit('host:hello', {}, r))
const chronologie: any[] = []
let sessionId = ''
let fini: () => void
const finiP = new Promise<void>(r => (fini = r))
let dejaAuto = false
hote.on('session:view', (p: any) => {
  const v = p.view
  sessionId = p.sessionId
  const m = v.phase === 'reveal' ? `reveal-${v.kind}` : v.phase === 'question' ? `question-${v.kind}${v.image ? '-photo' : ''}` : v.phase
  if (m !== moment || v.qIndex !== qIndex) {
    const changeQ = v.qIndex !== qIndex
    moment = m
    qIndex = v.qIndex ?? -1
    chronologie.push({ t: Date.now(), moment, qIndex })
    if (v.phase === 'reveal' && (qIndex + 1) % GC_TOUTES === 0) setTimeout(() => (gcAFaire = true), 3000)
    if (changeQ && v.phase === 'question') repondreAuxTelephones(v)
  }
  if (v.phase === 'pickPack') hote.emit('host:command', { sessionId, command: { type: 'selectPack', packId, multiplier: 1 } })
  if (!dejaAuto && v.phase === 'getReady') {
    dejaAuto = true
    hote.emit('host:command', { sessionId, command: { type: 'autoNext', seconds: 5 } })
  }
  if (v.phase === 'finished') fini()
})

// Les téléphones mesurés répondent comme des doigts : entre 1 et 3 s.
function repondreAuxTelephones(v: any) {
  for (const tel of tels) {
    setTimeout(
      async () => {
        try {
          if (v.kind === 'number') {
            await tel.page.fill('.guess-form input', String(300 + Math.round(Math.random() * 300)), { timeout: 1500 })
            await tel.page.click('.guess-form button.btn-primary', { timeout: 1500 })
          } else {
            await tel.page.locator('.ans-btn:not([disabled])').first().click({ timeout: 1500 })
          }
        } catch (e) {
          log(tel.nom, 'n’a pas pu répondre', qIndex, String(e).slice(0, 120))
        }
      },
      1000 + Math.random() * 2000,
    )
  }
}

hote.emit('host:launch')
await finiP
log('podium du quiz')
await patienter(10000)
gcAFaire = true
await patienter(2000)
moment = 'lobby-apres'
chronologie.push({ t: Date.now(), moment, qIndex: -1 })
hote.emit('host:endSession', { sessionId })
await patienter(6000)
moment = 'cloture'
chronologie.push({ t: Date.now(), moment, qIndex: -1 })
hote.emit('host:closeParty', { title: 'Soirée mesurée' })
await patienter(12000)
gcAFaire = true
await patienter(2000)
enCours = false
await boucle

// Les captures, pour regarder le rendu une fois mesuré.
for (const a of appareils) await a.page.screenshot({ path: path.join(SORTIE, `${a.nom}-fin.png`) })
writeFileSync(
  path.join(SORTIE, 'mesures.json'),
  JSON.stringify({ run: RUN, salle: SALLE, fantomes: N_FANTOMES, questions: N_QUESTIONS, attrib: ATTRIB, chronologie, appareils: appareils.map(a => ({ nom: a.nom, mesures: a.mesures })) }),
)
log('écrit', path.join(SORTIE, 'mesures.json'))
for (const s of fantomes) s.close()
hote.close()
await navigateur.close()
await serveur.close()
process.exit(0)
