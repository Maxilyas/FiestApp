// Le démarrage selon la taille de l'historique, le recalcul au barème du jour
// (`recalculerHistorique`, au premier démarrage après un VERSION_BAREME
// incrémenté), et la salle qui scanne le QR du souvenir d'une soirée close.
//
//   cd server && npx tsx ../retours/2026-09-24/experts/scripts/perf-serveur/historique.ts [soirées=100] [rtt=20]
//
// La base « permanente » est un fichier `file:` ; pour lui donner la latence
// de Turso vu de Render, chaque `execute`/`batch` du client libsql attend
// `rtt` ms (le même module que celui du serveur : on patche son prototype).
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { monitorEventLoopDelay } from 'node:perf_hooks'
import { Sqlite3Client } from '@libsql/client/sqlite3'
import { createClient } from '@libsql/client'
import { createQuizServer } from '../../../../../server/src/server'
import { ArchiveStore, buildArchive } from '../../../../../server/src/core/archive'

const SOIREES = Number(process.argv[2] ?? 100)
const RTT = Number(process.argv[3] ?? 20)
const ADMIN = { login: 'perf', password: 'perf-pass-1', slug: 'perf', name: 'Perf' }

let rtt = 0
let appels = 0
const proto = Sqlite3Client.prototype as any
for (const m of ['execute', 'batch']) {
  const orig = proto[m]
  proto[m] = async function (...args: unknown[]) {
    appels++
    if (rtt > 0) await new Promise(r => setTimeout(r, rtt))
    return orig.apply(this, args)
  }
}

const dir = mkdtempSync(path.join(tmpdir(), 'perf-historique-'))
const quizDbUrl = `file:${path.join(dir, 'permanente.db')}`
const dbPath = path.join(dir, 'locale.db')
const lancer = () => createQuizServer({ port: 0, dbPath, quizDbUrl, admin: ADMIN })

/** Une soirée ordinaire : 30 invités dont 12 profils pris dans un groupe de 40 habitués, 40 questions. */
const HABITUES = Array.from({ length: 40 }, () => randomUUID())
function archive(k: number, N = 30, Q = 40) {
  const t0 = Date.UTC(2025, 0, 1) + k * 7 * 86400_000
  const players = Array.from({ length: N }, (_, i) => ({
    id: randomUUID(), name: `Invité ${i}`, avatar: '🦊', token: '', teamId: null,
    profileId: i < 12 ? HABITUES[(k * 7 + i) % 40] : null, createdAt: t0 + i,
  }))
  const answers: any[] = []
  const scores: any[] = []
  const packs = new Map<string, any>()
  for (let quiz = 0; quiz * 10 < Q; quiz++) {
    const sessionId = randomUUID()
    const title = `Quiz ${quiz + 1}`
    const questions: any[] = []
    for (let q = 0; q < 10; q++) {
      questions.push({ kind: 'choice', text: `Question ${q}`, answers: ['A', 'B', 'C', 'D'], correct: q % 4, duration: 20, image: null, observeSeconds: null })
      players.forEach((p, i) => {
        const choice = (i * 7 + q + k) % 4
        const correct = choice === q % 4
        const points = correct ? 500 + ((i * 31) % 500) : 0
        const createdAt = t0 + (quiz * 10 + q) * 60_000
        answers.push({ sessionId, quizTitle: title, qIndex: q, kind: 'choice', playerId: p.id, answered: true, correct, choice,
          value: null, target: null, ms: 1500 + ((i * 97) % 15000), changes: 0, points, durationMs: 20000, observed: false, category: null, createdAt })
        if (points > 0) scores.push({ playerId: p.id, sessionId, points, reason: `Quiz « ${title} » — Q${q + 1}`, createdAt })
      })
    }
    packs.set(sessionId, { title, questions })
  }
  return buildArchive({ soiree: { id: `soiree-${k}`, heldAt: t0 } as any, players: players as any, teams: [], bonuses: [], scores, answers, packsBySession: packs, library: [] })!
}

async function demarrage(label: string) {
  appels = 0
  const t = performance.now()
  const s = await lancer()
  const ms = performance.now() - t
  console.log(JSON.stringify({ etape: label, soirees: SOIREES, 'rtt ms': rtt, 'démarrage ms': Math.round(ms), 'requêtes distantes': appels }))
  return s
}

// 1. Une base neuve, puis l'historique.
let s = await demarrer0()
async function demarrer0() {
  return demarrage('base neuve')
}
const spaceId = (await (async () => {
  const c = createClient({ url: quizDbUrl })
  const r = await c.execute(`SELECT id FROM accounts WHERE slug = 'perf'`)
  c.close()
  return String(r.rows[0].id)
})())
await s.close()
const store = new ArchiveStore(quizDbUrl)
await store.init(spaceId)
let grosse = ''
for (let k = 0; k < SOIREES; k++) {
  const a = archive(k)
  await store.save(spaceId, a.id, a.heldAt, a.archive)
}
// Et une grande soirée : 300 invités, 40 questions — celle dont la salle scanne le QR.
{
  const a = archive(SOIREES, 300, 40)
  await store.save(spaceId, a.id, a.heldAt, a.archive)
  grosse = a.id
}
store.close()

// 2. Démarrages ordinaires (rien à recalculer), sans puis avec latence.
for (const r of [0, RTT]) {
  rtt = r
  s = await demarrage(`${SOIREES + 1} soirées, rien à recalculer`)
  await s.close()
}

// 3. Le premier démarrage après un barème changé : une ligne d'une version d'avant suffit à tout relire.
{
  const c = createClient({ url: quizDbUrl })
  await c.execute({
    sql: `INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, 'soiree-0', ?, 10, '{"v":1}', 0)
          ON CONFLICT(profile_id, soiree_id) DO UPDATE SET detail = '{"v":1}'`,
    args: [HABITUES[0], spaceId],
  })
  c.close()
}
rtt = RTT
s = await demarrage(`${SOIREES + 1} soirées, recalcul au barème du jour`)

// 4. La salle scanne le QR du souvenir d'une soirée close de 300 invités.
const base = `http://localhost:${s.port}`
const url = `${base}/s/perf/soirees/${grosse}/recap.json`
const h = monitorEventLoopDelay({ resolution: 10 })
for (const n of [1, 1, 50]) {
  h.reset()
  h.enable()
  const cpu = process.cpuUsage()
  const t = performance.now()
  let octets = 0
  appels = 0
  await Promise.all(
    Array.from({ length: n }, async () => {
      const r = await fetch(url, { headers: { 'Accept-Encoding': 'gzip' } })
      octets = (await r.arrayBuffer()).byteLength
    }),
  )
  const ms = performance.now() - t
  h.disable()
  const c = process.cpuUsage(cpu)
  console.log(JSON.stringify({
    etape: `souvenir archivé (300 invités × 40 q.), ${n} requête(s) simultanée(s)`,
    'rtt ms': rtt,
    'durée totale ms': Math.round(ms),
    'CPU ms': Math.round((c.user + c.system) / 1000),
    'boucle bloquée au pire ms': Math.round(h.max / 1e6),
    'requêtes distantes': appels,
    'octets gzip par réponse': octets,
  }))
}
await s.close()
rmSync(dir, { recursive: true, force: true })
