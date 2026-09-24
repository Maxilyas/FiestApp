// Coût d'une diffusion, mesuré sur le vrai moteur : GameEngine + quizModule +
// Party + ScoreLedger + AnswerLog sur une vraie base SQLite, avec un faux `io`
// qui compte les messages et les octets (une salle = son nombre de sockets).
// Et l'instantané de la soirée (`SpaceRuntime.buildSnapshot`) reconstitué à
// l'identique : sa taille, et ce qu'il pèse envoyé à toute la salle.
//
//   cd server && npx tsx ../retours/2026-09-24/experts/scripts/perf-serveur/diffusion.ts 50 200 500
//
// Chaque taille : un quiz de 10 QCM + 2 estimations, chaque invité répond à
// chaque question, l'animateur révèle et enchaîne. Aucun chronomètre n'est
// attendu sauf « ready » (3 s) au début.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { initDb } from '../../../../../server/src/core/db'
import { Party } from '../../../../../server/src/core/party'
import { ScoreLedger } from '../../../../../server/src/core/scores'
import { AnswerLog } from '../../../../../server/src/core/answers'
import { GameEngine } from '../../../../../server/src/core/engine'
import { quizModule, setQuizLibrary } from '../../../../../server/src/games/quiz'
import { teamScores } from '../../../../../shared/teams'

const tailles = process.argv.slice(2).map(Number).filter(n => n > 0)
if (tailles.length === 0) tailles.push(50, 200, 500)

const PRENOMS = ['Camille', 'Léa', 'Hugo', 'Zoé', 'Lucas', 'Chloé', 'Nathan', 'Inès', 'Louis', 'Jade', 'Gabriel', 'Emma']
const AVATARS = ['🦊', '🐼', '🐸', '🐙', '🦁', '🐯', '🐨', '🐧']

function quiz() {
  const questions = []
  for (let i = 0; i < 12; i++) {
    const estimation = i === 4 || i === 9
    questions.push({
      id: `q${i}`,
      kind: estimation ? 'number' : 'choice',
      text: `Question numéro ${i + 1} : une phrase d'une longueur ordinaire pour un quiz de soirée ?`,
      answers: estimation ? [] : ['Réponse A assez longue', 'Réponse B', 'Réponse C', 'Réponse D'],
      correct: estimation ? 0 : i % 4,
      target: estimation ? 1789 : null,
      unit: estimation ? 'ans' : '',
      duration: 30,
      image: null,
      observeSeconds: null,
      category: null,
    })
  }
  return { id: 'bench', title: 'Banc de diffusion', questions, updatedAt: Date.now() }
}

type Compte = { messages: number; octets: number }
const zero = (): Compte => ({ messages: 0, octets: 0 })

async function mesurer(N: number) {
  const dir = mkdtempSync(path.join(tmpdir(), 'perf-diffusion-'))
  const db = initDb(path.join(dir, 'locale.db'))
  const spaceId = 'bench'
  setQuizLibrary(spaceId, [quiz() as any])
  const party = new Party(db, spaceId)
  const ledger = new ScoreLedger(db, spaceId)
  const answers = new AnswerLog(db, spaceId)
  const ids: string[] = []
  for (let i = 0; i < N; i++) {
    const rec = party.join(`${PRENOMS[i % PRENOMS.length]}${i % 3 === 0 ? '' : ' ' + i}`, AVATARS[i % AVATARS.length])
    if ('error' in rec) throw new Error(rec.error)
    ids.push(rec.id)
    party.socketConnected(rec.id, `sock-${i}`)
  }

  // Un io qui compte : un salon `player:x` = 1 socket, `hosts:` = 1 écran, `space:` = N + 1.
  let compte = zero()
  const taille = (salon: string) => (salon.startsWith('space:') ? N + 1 : 1)
  const io = {
    to: (salon: string) => ({
      emit: (_ev: string, payload: unknown) => {
        const n = taille(salon)
        compte.messages += n
        // socket.io sérialise une fois par diffusion, puis écrit n fois.
        compte.octets += n * Buffer.byteLength(JSON.stringify(payload))
      },
    }),
  }

  const engine = new GameEngine(
    {
      db,
      io: io as any,
      spaceId,
      party,
      ledger,
      answers,
      onScoresChanged: () => {},
      onSessionChanged: () => {},
      onSessionEnded: () => {},
      onVerdict: () => {},
    },
    quizModule,
  )

  // Le temps passé à persister (JSON de l'état + upsert SQLite) et à comparer
  // les vues (`changed` : un JSON.stringify par vue).
  const e = engine as any
  let tPersist = 0
  let tChanged = 0
  let nChanged = 0
  let octetsEtat = 0
  const persist = e.persist.bind(engine)
  e.persist = (sess: any, urgent?: boolean) => {
    const t = performance.now()
    persist(sess, urgent)
    tPersist += performance.now() - t
    octetsEtat = Buffer.byteLength(JSON.stringify(sess.state))
  }
  const changed = e.changed.bind(engine)
  e.changed = (k: string, v: unknown) => {
    const t = performance.now()
    const r = changed(k, v)
    tChanged += performance.now() - t
    nChanged++
    return r
  }

  const sid = engine.launch()
  engine.handleHostCommand(sid, { type: 'selectPack', packId: 'bench' })
  await new Promise(r => setTimeout(r, 3200)) // « ready » → première question

  const res = {
    N,
    questionMs: [] as number[],
    parReponseMaxMs: 0,
    revelerMs: [] as number[],
    finMs: 0,
    question: zero(),
    revelation: zero(),
    fin: zero(),
    persistMs: 0,
    changedMs: 0,
    changedN: 0,
    octetsEtat: 0,
    heapMo: 0,
  }
  const sess = () => e.session
  for (let q = 0; q < 12; q++) {
    const st = sess().state
    if (st.phase !== 'question') throw new Error(`phase inattendue ${st.phase} à la question ${q}`)
    const kind = st.pack.questions[q].kind
    compte = zero()
    const t0 = performance.now()
    for (let i = 0; i < N; i++) {
      const ti = performance.now()
      const action = kind === 'choice' ? { type: 'answer', choice: i % 4 } : { type: 'guess', value: 1700 + (i % 150) }
      const r = engine.handlePlayerAction(sid, ids[i], action)
      if (r) throw new Error(`refus ${r}`)
      res.parReponseMaxMs = Math.max(res.parReponseMaxMs, performance.now() - ti)
    }
    res.questionMs.push(performance.now() - t0)
    if (q === 0) res.question = compte
    // La salle a tout répondu : on n'attend pas le souffle, l'animateur révèle.
    compte = zero()
    const t1 = performance.now()
    engine.handleHostCommand(sid, { type: 'next' })
    res.revelerMs.push(performance.now() - t1)
    if (q === 0) res.revelation = compte
    compte = zero()
    const t2 = performance.now()
    engine.handleHostCommand(sid, { type: 'next' })
    if (q === 11) {
      res.finMs = performance.now() - t2
      res.fin = compte
    }
  }
  res.persistMs = tPersist
  res.changedMs = tChanged
  res.changedN = nChanged
  res.octetsEtat = octetsEtat
  res.heapMo = process.memoryUsage().heapUsed / 1048576

  // L'instantané, tel que `SpaceRuntime.buildSnapshot(false)` le compose
  // (l'espace et l'adresse en moins : quelques centaines d'octets).
  const t3 = performance.now()
  const players = party.publicPlayers(ledger.allTotals())
  const snapshot = { players, teams: teamScores([], players, []), bonuses: [], session: engine.summary(), joinUrl: 'https://x/y', wifi: null }
  const json = JSON.stringify(snapshot)
  const snapMs = performance.now() - t3
  engine.stop()
  db.close()
  rmSync(dir, { recursive: true, force: true })
  return { ...res, snapshotOctets: Buffer.byteLength(json), snapshotSalleOctets: Buffer.byteLength(json) * (N + 1), snapMs }
}

const f = (n: number) => Math.round(n).toLocaleString('fr-FR')
const ko = (n: number) => `${(n / 1024).toFixed(1)} Ko`
const mo = (n: number) => `${(n / 1048576).toFixed(2)} Mo`
for (const N of tailles) {
  const r = await mesurer(N)
  const moy = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  console.log(
    JSON.stringify({
      invites: N,
      'question complète (N réponses), moy ms': f(moy(r.questionMs)),
      'question complète, max ms': f(Math.max(...r.questionMs)),
      'une réponse, pire ms': r.parReponseMaxMs.toFixed(2),
      'révélation, moy ms': f(moy(r.revelerMs)),
      'podium final ms': f(r.finMs),
      'Q1 : messages / octets émis': `${f(r.question.messages)} / ${mo(r.question.octets)}`,
      'révélation Q1 : messages / octets': `${f(r.revelation.messages)} / ${mo(r.revelation.octets)}`,
      'podium : messages / octets': `${f(r.fin.messages)} / ${mo(r.fin.octets)}`,
      'persist total ms (12 q.)': f(r.persistMs),
      'état persisté, octets': ko(r.octetsEtat),
      'changed() total ms / appels': `${f(r.changedMs)} / ${f(r.changedN)}`,
      'instantané : octets / à toute la salle': `${ko(r.snapshotOctets)} / ${mo(r.snapshotSalleOctets)}`,
      'instantané : calcul ms': r.snapMs.toFixed(1),
      'tas Mo': r.heapMo.toFixed(0),
    }),
  )
}
