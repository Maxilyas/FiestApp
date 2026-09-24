// Une vraie salle contre un vrai serveur, lancé en processus enfant
// (`node --import tsx src/index.ts`, la commande de Render) sur deux bases
// jetables. On lit le processus du serveur dans /proc : sa mémoire (RSS) et
// son temps processeur (utime + stime), phase par phase. Côté téléphones, on
// compte ce qu'ils reçoivent : instantanés, vues, octets.
//
//   node retours/2026-09-24/experts/scripts/perf-serveur/salle.mjs 200 [--churn 20]
//
// Phases : inscription de N invités (vague), une salle au repos 5 s, un quiz
// lancé, trois questions où tout le monde répond, révélations, podium ; puis
// `--churn k` : k téléphones se coupent et reviennent (la veille d'écran).
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { io } from 'socket.io-client'

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..')
const N = Number(process.argv[2] ?? 100)
const iChurn = process.argv.indexOf('--churn')
const CHURN = iChurn > 0 ? Number(process.argv[iChurn + 1]) : 0
const PORT = 3900 + Math.floor(Math.random() * 90)
const URL_ = `http://localhost:${PORT}`
const dir = mkdtempSync(path.join(tmpdir(), 'perf-salle-'))
const HZ = 100 // _SC_CLK_TCK sous Linux

const serveur = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
  cwd: path.join(racine, 'server'),
  env: {
    ...process.env,
    PORT: String(PORT),
    DB_PATH: path.join(dir, 'locale.db'),
    QUIZ_DB_URL: `file:${path.join(dir, 'permanente.db')}`,
    ADMIN_LOGIN: 'perf',
    ADMIN_PASSWORD: 'perf-pass-1',
    ADMIN_SLUG: 'perf',
    PUBLIC_URL: URL_,
    MAX_PLAYERS: '500',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let journal = ''
serveur.stdout.on('data', d => (journal += d))
serveur.stderr.on('data', d => (journal += d))

serveur.on('exit', code => {
  if (!fini) console.error(`[serveur] sorti (code ${code}) :\n${journal.slice(-3000)}`)
})
let fini = false
const pid = serveur.pid
const proc = () => {
  const stat = readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].split(' ')
  const status = readFileSync(`/proc/${pid}/status`, 'utf8')
  const rss = Number(/VmRSS:\s+(\d+)/.exec(status)[1]) / 1024
  return { cpuMs: ((Number(stat[11]) + Number(stat[12])) * 1000) / HZ, rssMo: rss }
}
const attendre = ms => new Promise(r => setTimeout(r, ms))

const t0 = Date.now()
for (;;) {
  try {
    if ((await fetch(`${URL_}/healthz`)).ok) break
  } catch {}
  if (Date.now() - t0 > 60000) throw new Error('le serveur ne démarre pas\n' + journal)
  await attendre(100)
}
const demarrage = Date.now() - t0
const phases = []
let avant = proc()
const phase = (nom, extra = {}) => {
  const p = proc()
  phases.push({ phase: nom, 'CPU serveur ms': Math.round(p.cpuMs - avant.cpuMs), 'RSS Mo': Math.round(p.rssMo), ...extra })
  avant = p
}
phase('démarré', { 'démarrage ms': demarrage })

// L'écran commun.
const login = await fetch(`${URL_}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'quizz' },
  body: JSON.stringify({ login: 'perf', password: 'perf-pass-1' }),
})
const cookie = /qz_session=([^;]+)/.exec(login.headers.get('set-cookie'))[0]
// 150 invités par défaut : on ouvre l'espace au plafond du serveur (MAX_PLAYERS).
await fetch(`${URL_}/api/space/settings`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'quizz', Cookie: cookie },
  body: JSON.stringify({ maxPlayers: 500 }),
}).then(r => {
  if (!r.ok) throw new Error(`réglages refusés (${r.status})`)
})
const host = io(URL_, { transports: ['websocket'], forceNew: true, extraHeaders: { Cookie: cookie } })
let hostView = null
let sessionId = null
host.on('session:view', m => {
  sessionId = m.sessionId
  hostView = m.view
})
await new Promise(r => host.on('connect', () => host.emit('host:hello', {}, r)))

// Les téléphones.
const recu = { snapshots: 0, snapOctets: 0, vues: 0, vueOctets: 0 }
const tels = []
const PRENOMS = ['Camille', 'Léa', 'Hugo', 'Zoé', 'Lucas', 'Chloé', 'Nathan', 'Inès']
function telephone(i) {
  return new Promise((resolve, reject) => {
    const s = io(URL_, { transports: ['websocket'], forceNew: true })
    const t = { s, i, view: null, token: null }
    s.on('party:snapshot', p => {
      recu.snapshots++
      recu.snapOctets += JSON.stringify(p).length
    })
    s.on('session:view', m => {
      recu.vues++
      recu.vueOctets += JSON.stringify(m).length
      t.view = m.view
      t.sessionId = m.sessionId
    })
    s.once('connect', () =>
      s.emit('party:watch', { slug: 'perf' }, () =>
        s.emit('player:join', { slug: 'perf', name: `${PRENOMS[i % 8]} ${i}`, avatar: '🦊' }, res => {
          if (!res?.ok) return reject(new Error(JSON.stringify(res)))
          t.token = res.token
          resolve(t)
        }),
      ),
    )
  })
}
const raz = () => Object.assign(recu, { snapshots: 0, snapOctets: 0, vues: 0, vueOctets: 0 })
const lu = () => ({
  'instantanés reçus (salle)': recu.snapshots,
  'octets d’instantanés (salle)': `${(recu.snapOctets / 1048576).toFixed(2)} Mo`,
  'vues reçues (salle)': recu.vues,
})

raz()
// `--un-par-un` : les invités arrivent comme dans une vraie salle, un toutes
// les 150 ms (plus que les 120 ms qui regroupent les instantanés).
const unParUn = process.argv.includes('--un-par-un')
for (let i = 0; i < N; i += unParUn ? 1 : 20) {
  const lot = []
  for (let k = i; k < Math.min(N, i + (unParUn ? 1 : 20)); k++) lot.push(telephone(k))
  tels.push(...(await Promise.all(lot)))
  if (unParUn) await attendre(150)
}
await attendre(500)
phase(`inscription de ${N}${unParUn ? ' (un par un)' : ' (par lots de 20)'}`, lu())
if (process.argv.includes('--inscription-seule')) {
  fini = true
  for (const t of tels) t.s.close()
  host.close()
  serveur.kill('SIGTERM')
  await new Promise(r => serveur.on('exit', r))
  rmSync(dir, { recursive: true, force: true })
  console.log(JSON.stringify({ invites: N, phases }, null, 1))
  process.exit(0)
}

raz()
await attendre(5000)
global.gc?.()
phase('salle au repos 5 s', lu())

// Un quiz : les trois premières questions de « Culture générale ».
raz()
host.emit('host:launch')
for (let k = 0; k < 50 && hostView?.phase !== 'pickPack'; k++) await attendre(100)
host.emit('host:command', { sessionId, command: { type: 'selectPack', packId: hostView.packs[0].id } })
for (let k = 0; k < 60 && hostView?.phase !== 'question'; k++) await attendre(100)
phase('lancement + prêt', lu())
for (let q = 0; q < 3; q++) {
  raz()
  const qIndex = hostView.qIndex
  for (const t of tels) {
    t.s.emit('player:action', {
      slug: 'perf',
      sessionId,
      action: { type: 'answer', choice: t.i % 4, qIndex, round: hostView.round },
    })
  }
  for (let k = 0; k < 300 && hostView?.phase !== 'reveal'; k++) await attendre(50)
  await attendre(400)
  phase(`question ${q + 1} : ${N} réponses → révélation`, lu())
  raz()
  host.emit('host:command', { sessionId, command: { type: 'next', phase: 'reveal', qIndex, round: hostView.round } })
  for (let k = 0; k < 100 && hostView?.phase === 'reveal'; k++) await attendre(50)
  await attendre(300)
  phase(`question ${q + 1} → suivante`, lu())
}
raz()
host.emit('host:endSession', { sessionId })
await attendre(1500)
phase('fin du quiz (rangement, crédits)', lu())

if (CHURN > 0) {
  raz()
  for (const t of tels.slice(0, CHURN)) t.s.disconnect()
  await attendre(400)
  for (const t of tels.slice(0, CHURN)) {
    t.s.connect()
    t.s.once('connect', () =>
      t.s.emit('party:watch', { slug: 'perf' }, () => t.s.emit('player:join', { slug: 'perf', token: t.token }, () => {})),
    )
  }
  await attendre(1500)
  phase(`${CHURN} téléphones coupés puis revenus`, lu())
}

// Les pages publiques, une fois la soirée jouée.
for (const page of ['recap.json', 'bilan.json', 'soirees.json']) {
  const ts = []
  let octets = 0
  for (let k = 0; k < 5; k++) {
    const t = performance.now()
    const r = await fetch(`${URL_}/s/perf/${page}`, { headers: { 'Accept-Encoding': 'identity' } })
    octets = (await r.arrayBuffer()).byteLength
    ts.push(performance.now() - t)
  }
  phase(`GET ${page} ×5`, { 'médiane ms': Math.round(ts.sort((a, b) => a - b)[2]), octets })
}

fini = true
for (const t of tels) t.s.close()
host.close()
serveur.kill('SIGTERM')
await new Promise(r => serveur.on('exit', r))
rmSync(dir, { recursive: true, force: true })
console.log(JSON.stringify({ invites: N, phases }, null, 1))
