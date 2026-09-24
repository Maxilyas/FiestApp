// Test de charge à plusieurs espaces : plusieurs soirées en même temps sur un
// même serveur, un écran commun et ses invités par espace.
//
//   node charge.mjs --espaces 400,20,20,20 [--questions 4] [--port 4100]
//                   [--etiquette voisin] [--cpu-prof] [--etalement 0]
//
// Sur le modèle de server/scripts/load-test.mjs, mais :
//   · il démarre lui-même un serveur jetable (serveur.ts), dans un autre
//     processus, et lit son retard de boucle, son CPU et sa mémoire ;
//   · il crée un compte d'animateur par espace (comme la régie de la tablée :
//     /api/admin/accounts, puis l'activation), lui ouvre 500 places et un quiz ;
//   · il mesure, espace par espace : l'inscription, le geste de l'animateur
//     (« Suivant ») → la question sur les téléphones, l'accusé d'une réponse,
//     la dernière réponse → la révélation, les octets et les messages reçus ;
//   · il vérifie qu'aucun téléphone ne reçoit jamais la vue ou l'instantané
//     d'un autre espace.
// Le résultat part en JSON dans export/evaluations/perf-temps-reel/.
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { monitorEventLoopDelay } from 'node:perf_hooks'
import { io } from 'socket.io-client'

const ici = path.dirname(fileURLToPath(import.meta.url))
const racine = path.resolve(ici, '../../../../..')
const arg = (nom, defaut) => {
  const i = process.argv.indexOf(`--${nom}`)
  return i >= 0 ? process.argv[i + 1] : defaut
}
const tailles = String(arg('espaces', '50')).split(',').map(Number)
const nbQuestions = Number(arg('questions', 4))
const port = Number(arg('port', 4100))
const etiquette = arg('etiquette', tailles.join('x'))
const etalement = Number(arg('etalement', 0))
// Des téléphones qui s'endorment et se réveillent en salle d'attente : chacun
// bascule `connected` dans l'instantané, qui repart à toute la salle.
const veille = Number(arg('veille', 0))
const cpuProf = process.argv.includes('--cpu-prof')
const sortie = path.join(racine, 'export/evaluations/perf-temps-reel')
const BASE = `http://localhost:${port}`
const STATS = `http://localhost:${port + 1}/stats`
const SETTLE_MS = 700 // le souffle avant une révélation (games/quiz.ts)

// ── Le serveur, dans son processus ─────────────────────────────────────────
mkdirSync(sortie, { recursive: true })
const dossierServeur = path.join(sortie, `serveur-${etiquette}`)
const serveur = spawn(
  process.execPath,
  [
    ...(cpuProf ? ['--cpu-prof', '--cpu-prof-dir', path.join(sortie, 'profils', etiquette)] : []),
    '--import',
    'tsx',
    path.join(ici, 'serveur.ts'),
  ],
  { cwd: racine, env: { ...process.env, PORT: String(port), DOSSIER: dossierServeur }, stdio: ['ignore', 'pipe', 'pipe'] },
)
const journalServeur = []
serveur.stderr.on('data', d => journalServeur.push(String(d)))
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('le serveur ne démarre pas')), 60000)
  serveur.stdout.on('data', d => {
    journalServeur.push(String(d))
    if (String(d).includes('PRET')) {
      clearTimeout(t)
      resolve()
    }
  })
  serveur.on('exit', c => reject(new Error(`serveur arrêté (${c}) : ${journalServeur.join('')}`)))
})
// Le quota CPU d'un hébergeur (Render gratuit : un dixième de cœur) est un
// quota CFS — tant de millisecondes par période de 100 ms, puis le processus
// attend la période suivante. On le rejoue à l'identique : SIGCONT au début de
// chaque période, SIGSTOP après `quota × 100` ms. Un processus arrêté ne
// consomme rien : c'est un plafond, pas une moyenne (plus dur que CFS quand
// le serveur n'a rien à faire, identique quand il est saturé).
const quota = Number(arg('quota', 0))
if (quota > 0 && quota < 1) {
  const periode = 100
  setInterval(() => {
    try {
      process.kill(serveur.pid, 'SIGCONT')
    } catch {}
    setTimeout(() => {
      try {
        process.kill(serveur.pid, 'SIGSTOP')
      } catch {}
    }, periode * quota)
  }, periode).unref()
  process.on('exit', () => {
    try {
      process.kill(serveur.pid, 'SIGCONT')
    } catch {}
  })
}
const statsServeur = async (reset = false) => (await fetch(STATS + (reset ? '?reset=1' : ''))).json()

// ── Le générateur se mesure aussi : il partage les quatre cœurs ─────────────
const boucleGen = monitorEventLoopDelay({ resolution: 1 })
boucleGen.enable()
let cpuGen0 = process.cpuUsage()
let tGen0 = Date.now()
const statsGenerateur = (reset = false) => {
  const c = process.cpuUsage(cpuGen0)
  const d = Date.now() - tGen0
  const r = {
    boucle: { p99: +(boucleGen.percentile(99) / 1e6).toFixed(1), max: +(boucleGen.max / 1e6).toFixed(1) },
    coeurs: +((c.user + c.system) / 1000 / d).toFixed(2),
  }
  if (reset) {
    boucleGen.reset()
    cpuGen0 = process.cpuUsage()
    tGen0 = Date.now()
  }
  return r
}

// ── Comptes, réglages et quiz, un par espace ───────────────────────────────
async function appeler(chemin, corps, cookie, methode = 'POST') {
  const res = await fetch(BASE + chemin, {
    method: methode,
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'quizz', ...(cookie && { Cookie: cookie }) },
    body: JSON.stringify(corps),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`${chemin} : ${res.status} ${json?.error ?? ''}`)
  const m = /qz_session=([^;]+)/.exec(res.headers.get('set-cookie') ?? '')
  return { json, cookie: m ? `qz_session=${m[1]}` : cookie }
}

const admin = await appeler('/api/auth/login', { login: 'admin', password: 'perf-admin-1' })
const questions = Array.from({ length: nbQuestions }, (_, i) =>
  i % 2 === 0
    ? { kind: 'choice', text: `Question ${i + 1} : quelle couleur ?`, answers: ['Rouge', 'Vert', 'Bleu', 'Jaune'], correct: 1, duration: 20, image: null }
    : { kind: 'number', text: `Question ${i + 1} : combien ?`, target: 50, unit: '', duration: 20, image: null, answers: [], correct: 0 },
)
const espaces = []
for (const [i, taille] of tailles.entries()) {
  const slug = `espace-${i + 1}`
  const cree = await appeler('/api/admin/accounts', { login: `anim${i + 1}`, name: `Anim ${i + 1}`, slug }, admin.cookie)
  const active = await appeler('/api/auth/activate', { token: cree.json.activation.token, password: 'perf-anim-mdp-1' })
  await appeler('/api/space/settings', { maxPlayers: 500 }, active.cookie, 'PUT')
  const quiz = await appeler('/api/quizzes', { title: `Quiz ${slug}` }, active.cookie)
  await appeler(`/api/quizzes/${quiz.json.id}`, { title: `Quiz ${slug}`, questions }, active.cookie, 'PUT')
  espaces.push({
    i, slug, taille, cookie: active.cookie, packId: quiz.json.id,
    sessionId: null, hostPhase: null, hostQ: -1,
    gesteNext: {}, // qIndex → instant du « Suivant » de l'animateur
    derniereReponse: {}, // qIndex → accusé de la dernière réponse
    mesures: { join: [], retour: [], question: [], diffusion: [], accuse: [], revelation: [] },
    fini: false, octetsJeu: 0, messagesJeu: 0, fuites: 0, refus: 0, joueurs: [],
  })
}

// ── Les écrans communs ─────────────────────────────────────────────────────
const connecter = cookie =>
  io(BASE, { transports: ['websocket'], forceNew: true, reconnection: false, ...(cookie && { extraHeaders: { Cookie: cookie } }) })
for (const e of espaces) {
  e.host = connecter(e.cookie)
  await new Promise((resolve, reject) => {
    e.host.on('connect', () => e.host.emit('host:hello', {}, r => (r?.ok ? resolve() : reject(new Error('host:hello refusé')))))
  })
  e.host.on('session:view', ({ sessionId, view }) => {
    e.sessionId = sessionId
    const nouveau = view.phase !== e.hostPhase || view.qIndex !== e.hostQ
    e.hostPhase = view.phase
    e.hostQ = view.qIndex
    if (view.phase === 'finished') e.fini = true
    // L'animateur clique « Suivant » une seconde après la révélation.
    if (nouveau && view.phase === 'reveal') {
      setTimeout(() => {
        e.gesteNext[view.qIndex + 1] = Date.now()
        e.host.emit('host:command', { sessionId, command: { type: 'next', phase: 'reveal', qIndex: view.qIndex, round: view.round } })
      }, 1000)
    }
  })
}

// ── Les invités ────────────────────────────────────────────────────────────
let phaseJeu = false
const octetsDe = args => Buffer.byteLength(JSON.stringify(args))
function inviter(e, n) {
  const j = { e, n, token: null, octets: 0, messages: 0, parEvenement: {}, vus: new Set(), reveles: new Set() }
  e.joueurs.push(j)
  return brancher(j)
}

// Un téléphone qui (re)vient : avec son jeton, c'est une re-présentation.
function brancher(j) {
  const e = j.e
  const socket = connecter()
  j.socket = socket
  socket.onAny((evenement, ...args) => {
    const o = octetsDe(args) + evenement.length + 6
    j.parEvenement[evenement] ??= { n: 0, octets: 0, max: 0 }
    const pe = j.parEvenement[evenement]
    pe.n++
    pe.octets += o
    pe.max = Math.max(pe.max, o)
    if (phaseJeu) {
      j.octets += o
      j.messages++
    }
  })
  // L'isolation : rien d'un voisin, jamais.
  socket.on('party:snapshot', s => {
    if (s?.space?.slug && s.space.slug !== e.slug) e.fuites++
  })
  socket.on('session:view', ({ sessionId, view }) => {
    const maintenant = Date.now()
    if (e.sessionId && sessionId !== e.sessionId) e.fuites++
    const q = view.qIndex
    if (!j.vus.has(q) && (view.phase === 'observe' || view.phase === 'question')) {
      j.vus.add(q)
      if (e.gesteNext[q]) e.mesures.question.push(maintenant - e.gesteNext[q])
    }
    if (view.phase === 'question' && !j.vus.has(`r${q}`)) {
      j.vus.add(`r${q}`)
      // Le chronomètre lecture → question : l'écart avec l'heure de départ
      // écrite dans la vue (même horloge, même machine).
      if (view.deadline && view.duration) e.mesures.diffusion.push(maintenant - (view.deadline - view.duration * 1000))
      setTimeout(() => {
        const action =
          view.kind === 'number'
            ? { type: 'guess', value: Math.round(Math.random() * 100) }
            : { type: 'answer', choice: Math.floor(Math.random() * (view.answers?.length ?? 4)) }
        const t0 = Date.now()
        socket.emit('player:action', { sessionId, action: { ...action, phase: 'question', qIndex: q, round: view.round } }, r => {
          const t1 = Date.now()
          e.mesures.accuse.push(t1 - t0)
          if (!r?.ok) e.refus++
          e.derniereReponse[q] = Math.max(e.derniereReponse[q] ?? 0, t1)
        })
      }, 300 + Math.random() * 2500)
    }
    if (view.phase === 'reveal' && !j.reveles.has(q)) {
      j.reveles.add(q)
      if (e.derniereReponse[q]) e.mesures.revelation.push(maintenant - e.derniereReponse[q] - SETTLE_MS)
    }
  })
  return new Promise(resolve => {
    const t0 = Date.now()
    socket.on('connect', () =>
      socket.emit('party:watch', { slug: e.slug }, () =>
        socket.emit('player:join', j.token ? { slug: e.slug, token: j.token } : { slug: e.slug, name: `Invité ${j.n + 1}`, avatar: '📱' }, r => {
          ;(j.token ? e.mesures.retour : e.mesures.join).push(Date.now() - t0)
          if (!r?.ok) e.refus++
          else j.token = r.token
          resolve()
        }),
      ),
    )
  })
}

const pc = (v, p) => {
  if (!v.length) return null
  const s = [...v].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor((s.length - 1) * p))]
}
const resume = v => (v.length ? { n: v.length, p50: pc(v, 0.5), p95: pc(v, 0.95), max: Math.max(...v) } : null)
const attendre = (pred, label, max = 300000) =>
  new Promise((resolve, reject) => {
    const t0 = Date.now()
    const id = setInterval(() => {
      if (pred()) {
        clearInterval(id)
        resolve()
      } else if (Date.now() - t0 > max) {
        clearInterval(id)
        reject(new Error(`délai : ${label}`))
      }
    }, 20)
  })

const charge0 = os.loadavg()
console.log(`⚡ ${etiquette} : ${tailles.join(' + ')} invités, ${nbQuestions} questions — charge ${charge0.map(x => x.toFixed(2)).join(' ')}`)

// L'inscription : tous les espaces en même temps.
await statsServeur(true)
statsGenerateur(true)
const tJoin = Date.now()
await Promise.all(
  espaces.flatMap(e =>
    Array.from({ length: e.taille }, (_, n) =>
      new Promise(r => setTimeout(r, etalement ? Math.random() * etalement : 0)).then(() => inviter(e, n)),
    ),
  ),
)
const dureeJoin = Date.now() - tJoin
await new Promise(r => setTimeout(r, 1500)) // les instantanés regroupés
const serveurJoin = await statsServeur(true)
const generateurJoin = statsGenerateur(true)
const octetsJoin = espaces.map(e => {
  const snap = e.joueurs.map(j => j.parEvenement['party:snapshot'] ?? { n: 0, octets: 0, max: 0 })
  return {
    instantanesParTelephone: +(snap.reduce((a, s) => a + s.n, 0) / e.taille).toFixed(1),
    koParTelephone: +(snap.reduce((a, s) => a + s.octets, 0) / e.taille / 1024).toFixed(1),
    plusGrosKo: +(Math.max(...snap.map(s => s.max)) / 1024).toFixed(1),
  }
})
console.log(`   inscriptions : ${dureeJoin} ms`)

let resultatVeille = null
if (veille > 0) {
  const temoins = espaces.map(e => e.joueurs.slice(-1)[0]) // jamais endormis
  const avant = temoins.map(j => ({ ...(j.parEvenement['party:snapshot'] ?? { n: 0, octets: 0 }) }))
  const tV = Date.now()
  await Promise.all(
    espaces.flatMap(e =>
      e.joueurs.slice(0, Math.min(veille, e.taille - 1)).map(
        j =>
          new Promise(r => setTimeout(r, Math.random() * 10000)).then(async () => {
            j.socket.close()
            await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000))
            await brancher(j)
          }),
      ),
    ),
  )
  await new Promise(r => setTimeout(r, 1500))
  const serveurVeille = await statsServeur(true)
  statsGenerateur(true)
  resultatVeille = {
    dureeMs: Date.now() - tV,
    serveur: serveurVeille,
    parEspace: temoins.map((j, k) => {
      const apres = j.parEvenement['party:snapshot']
      return { instantanes: apres.n - avant[k].n, ko: +((apres.octets - avant[k].octets) / 1024).toFixed(1) }
    }),
  }
  console.log(`   veille : ${JSON.stringify(resultatVeille)}`)
}

// Le quiz, dans tous les espaces à la fois.
phaseJeu = true
const tJeu = Date.now()
for (const e of espaces) {
  e.host.emit('host:launch')
}
await attendre(() => espaces.every(e => e.hostPhase === 'pickPack'), 'liste des quiz', 30000)
for (const e of espaces) e.host.emit('host:command', { sessionId: e.sessionId, command: { type: 'selectPack', packId: e.packId } })
await attendre(() => espaces.every(e => e.fini), 'fin des quiz')
await new Promise(r => setTimeout(r, 1500)) // le podium, et ses instantanés
phaseJeu = false
const dureeJeu = Date.now() - tJeu
const serveurJeu = await statsServeur(true)
const generateurJeu = statsGenerateur(true)
const charge1 = os.loadavg()

const resultat = {
  etiquette,
  tailles,
  questions: nbQuestions,
  etalementMs: etalement,
  quota,
  chargeMachine: { avant: charge0, apres: charge1 },
  inscription: { dureeMs: dureeJoin, serveur: serveurJoin, generateur: generateurJoin },
  veille: resultatVeille,
  jeu: { dureeMs: dureeJeu, serveur: serveurJeu, generateur: generateurJeu },
  espaces: espaces.map((e, k) => ({
    slug: e.slug,
    invites: e.taille,
    fuites: e.fuites,
    refus: e.refus,
    join: resume(e.mesures.join),
    retour: resume(e.mesures.retour),
    question: resume(e.mesures.question),
    diffusion: resume(e.mesures.diffusion),
    accuse: resume(e.mesures.accuse),
    revelation: resume(e.mesures.revelation),
    inscriptionOctets: octetsJoin[k],
    jeuParTelephone: {
      messages: +(e.joueurs.reduce((a, j) => a + j.messages, 0) / e.taille).toFixed(1),
      ko: +(e.joueurs.reduce((a, j) => a + j.octets, 0) / e.taille / 1024).toFixed(1),
      koParQuestion: +(e.joueurs.reduce((a, j) => a + j.octets, 0) / e.taille / 1024 / nbQuestions).toFixed(1),
    },
    parEvenement: Object.fromEntries(
      [...new Set(e.joueurs.flatMap(j => Object.keys(j.parEvenement)))].map(ev => {
        const l = e.joueurs.map(j => j.parEvenement[ev] ?? { n: 0, octets: 0, max: 0 })
        return [ev, { parTelephone: +(l.reduce((a, s) => a + s.n, 0) / e.taille).toFixed(1), koParTelephone: +(l.reduce((a, s) => a + s.octets, 0) / e.taille / 1024).toFixed(1), plusGrosKo: +(Math.max(...l.map(s => s.max)) / 1024).toFixed(2) }]
      }),
    ),
  })),
}
const fichier = path.join(sortie, `${etiquette}-${Date.now()}.json`)
writeFileSync(fichier, JSON.stringify(resultat, null, 2))

const f = r => (r ? `${String(r.p50).padStart(5)} ${String(r.p95).padStart(5)} ${String(r.max).padStart(5)}` : '    —     —     —')
console.log(`   espace      invités | join p50/p95/max | question    | accusé      | révélation  | Ko/tél/q | fuites`)
for (const e of resultat.espaces) {
  console.log(`   ${e.slug.padEnd(11)} ${String(e.invites).padStart(7)} | ${f(e.join)} | ${f(e.question)} | ${f(e.accuse)} | ${f(e.revelation)} | ${String(e.jeuParTelephone.koParQuestion).padStart(8)} | ${e.fuites}`)
}
console.log(`   serveur (inscription) : ${JSON.stringify(serveurJoin)}`)
console.log(`   serveur (jeu)         : ${JSON.stringify(serveurJeu)}`)
console.log(`   générateur (jeu)      : ${JSON.stringify(generateurJeu)}`)
console.log(`   → ${path.relative(racine, fichier)}`)

for (const e of espaces) {
  e.host.close()
  for (const j of e.joueurs) j.socket.close()
}
if (quota) process.kill(serveur.pid, 'SIGCONT')
serveur.kill('SIGTERM')
await new Promise(r => serveur.on('exit', r))
process.exit(0)
