// Test de charge : simule une salle entière qui se connecte et joue.
//
//   node server/scripts/load-test.mjs http://localhost:3001 50 [--slug demo]
//
// Le script joue lui-même le rôle de l'écran commun — il se connecte comme
// l'animateur (ADMIN_LOGIN / ADMIN_PASSWORD) et ses invités rejoignent
// l'espace de cet animateur (`--slug`, sinon QUIZ_SLUG, sinon « demo »).
// Il lance un quiz, enchaîne les questions, et mesure ce qui compte le soir J —
//   · le temps d'inscription quand tout le monde scanne le QR en même temps
//   · le délai entre l'affichage d'une question et sa réception sur les téléphones
//   · le délai entre la dernière réponse et la révélation
import { io } from 'socket.io-client'
import { hostSocket, loginCookie, slugArg } from './login.mjs'

const positional = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && all[i - 1] !== '--slug')
const url = positional[0] ?? 'http://localhost:3001'
const count = Number(positional[1] ?? 50)
const slug = slugArg()

// Mode sonde : on mesure seulement la connexion de N téléphones, sans les
// inscrire. Utile pour tester l'hébergement réel sans laisser cinquante faux
// invités dans le classement de la soirée.
const probeOnly = process.argv.includes('--sonde')

const stats = { join: [], question: [], reveal: [], connexion: [], premierEcran: [] }
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

const health = async () => {
  try {
    return await (await fetch(`${url}/healthz`)).json()
  } catch {
    return null
  }
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

console.log(`⚡ Test de charge : ${count} invités sur ${url} (espace « ${slug} »)`)

if (probeOnly) {
  console.log('   mode sonde : connexion seule, aucun invité créé')
  const started = Date.now()
  const sockets = await Promise.all(
    Array.from({ length: count }, () => {
      const t0 = Date.now()
      const socket = connect()
      return new Promise(resolve => {
        socket.on('connect', () => {
          stats.connexion.push(Date.now() - t0)
          // Le premier écran utile : la soirée suivie, son instantané reçu.
          socket.emit('party:watch', { slug }, () => {})
        })
        socket.once('party:snapshot', () => {
          stats.premierEcran.push(Date.now() - t0)
          resolve(socket)
        })
      })
    }),
  )
  const total = Date.now() - started
  console.log('')
  console.log(summarize('connexion'))
  console.log(summarize('premierEcran'))
  console.log(`
${count} téléphones connectés en ${total} ms`)
  const sante = await health()
  if (sante) console.log(`serveur : ${sante.rssMo} Mo, ${sante.players} invités connectés`)
  console.log('')
  console.log('connexion    = ouverture de la liaison temps réel')
  console.log('premierEcran = premier affichage utile sur le téléphone')
  for (const s of sockets) s.disconnect()
  setTimeout(() => process.exit(0), 300)
} else {
  // ── Écran commun ──────────────────────────────────────────────────────────
  let cookie
  try {
    cookie = await loginCookie(url)
  } catch (e) {
    console.error(`❌ ${e.message}`)
    process.exit(1)
  }
  const host = hostSocket(url, cookie)
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
      host.emit('host:hello', {}, res => {
        clearTimeout(giveUp)
        if (res.ok && res.slug !== slug) {
          console.log(`   ⚠️  la session est celle de l’espace « ${res.slug} », les invités visent « ${slug} »`)
        }
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
            socket.emit('player:join', { slug, name: `Invité ${i + 1}`, avatar: '📱' }, res => {
              stats.join.push(Date.now() - t0)
              resolve(res.ok)
            }),
          )
        })
      }),
    )
    return Date.now() - started
  }

  try {
    if (!(await hostReady)) {
      console.error('❌ session animateur refusée — vérifie ADMIN_LOGIN et ADMIN_PASSWORD')
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
}
