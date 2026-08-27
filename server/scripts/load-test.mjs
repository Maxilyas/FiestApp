// Test de charge : simule une salle entière qui se connecte et joue.
//
//   node server/scripts/load-test.mjs http://localhost:3001 50
//
// Le script joue lui-même le rôle de l'écran commun : il lance un quiz,
// enchaîne les questions, et mesure ce qui compte le soir J —
//   · le temps d'inscription quand tout le monde scanne le QR en même temps
//   · le délai entre l'affichage d'une question et sa réception sur les téléphones
//   · le délai entre la dernière réponse et la révélation
import { io } from 'socket.io-client'

const url = process.argv[2] ?? 'http://localhost:3001'
const count = Number(process.argv[3] ?? 50)
const hostKey = process.env.HOST_KEY ?? 'romane'

const stats = { join: [], question: [], reveal: [] }
let messages = 0 // total des vues reçues par l'ensemble des téléphones

const percentile = (values, p) => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))]
}

const summarize = label => {
  const values = stats[label]
  if (values.length === 0) return `${label}: aucune mesure`
  const avg = values.reduce((a, b) => a + b, 0) / values.length
  return `${label.padEnd(9)} n=${String(values.length).padStart(4)}  moy ${avg.toFixed(0).padStart(5)} ms  médiane ${percentile(values, 0.5).toFixed(0).padStart(5)} ms  p95 ${percentile(values, 0.95).toFixed(0).padStart(5)} ms  max ${Math.max(...values).toFixed(0).padStart(5)} ms`
}

const connect = () => io(url, { transports: ['websocket'], forceNew: true })

// ── Écran commun ──────────────────────────────────────────────────────────
const host = connect()
let sessionId = null
let hostView = null
let phase = null
let answeredAt = 0
let finished = false

// Sans garde-fou, un serveur éteint laisserait le script attendre sans fin.
const hostReady = new Promise((resolve, reject) => {
  const giveUp = setTimeout(
    () => reject(new Error(`aucune réponse de ${url} — le serveur est-il démarré ?`)),
    10000,
  )
  host.on('connect_error', e => {
    clearTimeout(giveUp)
    reject(new Error(`connexion à ${url} impossible : ${e.message}`))
  })
  host.on('connect', () =>
    host.emit('host:hello', { key: hostKey }, res => {
      clearTimeout(giveUp)
      resolve(res.ok)
    }),
  )
})

host.on('session:view', ({ sessionId: id, view }) => {
  sessionId = id
  hostView = view
  if (view.phase === 'reveal' && phase === 'question' && answeredAt) {
    stats.reveal.push(Date.now() - answeredAt)
  }
  phase = view.phase
  if (view.phase === 'finished') finished = true
})

// ── Les invités ───────────────────────────────────────────────────────────
const players = []

async function joinAll() {
  const started = Date.now()
  await Promise.all(
    Array.from({ length: count }, (_, i) => {
      const socket = connect()
      players.push(socket)
      const answered = new Set()

      socket.on('session:view', ({ sessionId: id, view }) => {
        messages++
        if (view.phase !== 'question') return
        const key = `${id}:${view.qIndex}`
        if (answered.has(key)) return
        answered.add(key)
        // La question a démarré à `deadline - duration` : l'écart avec la
        // première réception ici, c'est le temps mis par le serveur pour
        // diffuser. On ne mesure que la première : les suivantes ne sont plus
        // l'affichage de la question mais des mises à jour.
        if (view.deadline && view.duration) {
          stats.question.push(Date.now() - (view.deadline - view.duration * 1000))
        }
        // Réponses étalées : personne n'appuie exactement en même temps.
        setTimeout(() => {
          answeredAt = Date.now()
          const action =
            view.kind === 'number'
              ? { type: 'guess', value: Math.round(Math.random() * 100) }
              : { type: 'answer', choice: Math.floor(Math.random() * (view.answers?.length ?? 4)) }
          socket.emit('player:action', { sessionId: id, action })
        }, 200 + Math.random() * 1500)
      })

      return new Promise(resolve => {
        const t0 = Date.now()
        socket.on('connect', () =>
          socket.emit('player:join', { name: `Invité ${i + 1}`, avatar: '📱' }, res => {
            stats.join.push(Date.now() - t0)
            resolve(res.ok)
          }),
        )
      })
    }),
  )
  return Date.now() - started
}

const waitFor = (predicate, label, timeoutMs = 20000) =>
  new Promise((resolve, reject) => {
    const t0 = Date.now()
    const id = setInterval(() => {
      if (predicate()) {
        clearInterval(id)
        resolve()
      } else if (Date.now() - t0 > timeoutMs) {
        clearInterval(id)
        reject(new Error(`timeout : ${label}`))
      }
    }, 50)
  })

const health = async () => {
  try {
    return await (await fetch(`${url}/healthz`)).json()
  } catch {
    return null
  }
}

console.log(`⚡ Test de charge : ${count} invités sur ${url}`)

try {
  if (!(await hostReady)) {
    console.error("❌ clé animateur refusée — passez la bonne valeur via HOST_KEY")
    process.exit(1)
  }
} catch (e) {
  console.error(`❌ ${e.message}`)
  process.exit(1)
}

const joinMs = await joinAll()
console.log(`   ${count} inscriptions en ${joinMs} ms`)

const before = await health()

host.emit('host:launch')
await waitFor(() => phase === 'pickPack', 'liste des quiz')

const pack = (hostView?.packs ?? [])[0]
if (!pack) {
  console.error('❌ aucun quiz dans la bibliothèque')
  process.exit(1)
}
console.log(`   quiz : ${pack.title} (${pack.questionCount} questions)`)

host.emit('host:command', { sessionId, command: { type: 'selectPack', packId: pack.id } })

// On enchaîne les questions dès que la révélation est affichée.
const driver = setInterval(() => {
  if (phase === 'reveal') host.emit('host:command', { sessionId, command: { type: 'next' } })
}, 700)

await waitFor(() => finished, 'fin du quiz', 120000)
clearInterval(driver)

const after = await health()

console.log('')
console.log(summarize('join'))
console.log(summarize('question'))
console.log(summarize('reveal'))
console.log('')
console.log(`vues reçues par les téléphones : ${messages} au total (${(messages / count).toFixed(1)} par invité)`)
if (before && after) {
  console.log('')
  console.log(`mémoire serveur : ${before.rssMo} Mo → ${after.rssMo} Mo`)
}
console.log('')
console.log('join     = inscription (scan du QR) · question = diffusion vers les téléphones')
console.log('reveal   = dernière réponse → révélation')

host.emit('host:endSession', { sessionId })
setTimeout(() => process.exit(0), 500)
