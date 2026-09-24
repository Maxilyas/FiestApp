// Le serveur jetable des mesures : il sert client/dist (construit par
// `npx vite build` dans client/), ses deux bases dans export/evaluations/perf-chargement/bases,
// et joue une petite soirée (6 invités, un quiz de 6 questions) pour que le
// souvenir et le bilan aient de quoi s'afficher. Il reste ouvert jusqu'à Ctrl-C.
// Usage (depuis server/) : npx tsx ../retours/2026-09-24/experts/scripts/perf-chargement/serveur.ts [port]
import { mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { createQuizServer } from '../../../../../server/src/server'
import {
  ADMIN, attendre, connexionAnimateur, creerQuiz, ecranCommun, emitAck, estimation, invite, lancerQuiz, qcm,
} from '../../../../../server/test/banc'

const port = Number(process.argv[2]) || 4710
const dir = path.resolve('../export/evaluations/perf-chargement/bases')
rmSync(dir, { recursive: true, force: true })
mkdirSync(dir, { recursive: true })
const serveur = await createQuizServer({
  port, dbPath: path.join(dir, 'locale.db'), quizDbUrl: `file:${path.join(dir, 'permanente.db')}`, admin: ADMIN,
  publicUrl: `http://localhost:${port}`,
})
const url = `http://localhost:${port}`
const cookie = await connexionAnimateur(url)
const questions = [
  qcm('Capitale de l’Australie ?', ['Sydney', 'Canberra', 'Melbourne', 'Perth'], 1),
  qcm('Combien de pattes a une araignée ?', ['6', '8', '10', '12'], 1),
  estimation('Hauteur de la tour Eiffel (m) ?', 330, 'm'),
  qcm('Qui a peint la Joconde ?', ['Vinci', 'Monet', 'Picasso', 'Dalí'], 0),
  qcm('Plus grand océan ?', ['Atlantique', 'Indien', 'Pacifique', 'Arctique'], 2),
  estimation('Année du premier pas sur la Lune ?', 1969),
]
const quiz = await creerQuiz(url, cookie, questions, 'Culture G')
await creerQuiz(url, cookie, questions.slice(0, 3), 'Apéro')
const host = await ecranCommun(url, cookie)
const salle = await Promise.all(['Camille', 'Bob', 'Léa', 'Hugo', 'Inès', 'Jean-Baptiste'].map((n, i) => invite(url, n, ['🦊', '🐼', '🐸', '🦉', '🐙', '🐝'][i])))
const vue = (sid: string, pred: (v: any) => boolean, l: string) => attendre<any>(host, 'session:view', p => p.sessionId === sid && pred(p.view), l, 30_000)
const sid = await lancerQuiz(host, quiz)
let suivante = vue(sid, v => v.phase === 'question' && v.qIndex === 0, 'q1')
for (let q = 0; q < questions.length; q++) {
  await suivante
  const revelee = vue(sid, v => v.phase === 'reveal' && v.qIndex === q, 'reveal')
  for (const [i, qui] of salle.entries()) {
    const action = questions[q].kind === 'number' ? { type: 'answer', value: (questions[q] as any).target + (i - 2) * 7 } : { type: 'answer', choice: (i + q) % 3 === 0 ? 0 : (questions[q] as any).correct }
    await emitAck(qui.socket, 'player:action', { sessionId: sid, action })
  }
  await revelee
  suivante = q + 1 < questions.length ? vue(sid, v => v.phase === 'question' && v.qIndex === q + 1, 'q') : vue(sid, v => v.phase === 'finished', 'podium')
  ;(host as any).emit('host:command', { sessionId: sid, command: { type: 'next' } })
}
await suivante
;(host as any).emit('host:endSession', { sessionId: sid })
console.log(`PRET ${url} slug=${ADMIN.slug} cookie=${cookie}`)
process.on('SIGINT', async () => { for (const s of salle) s.socket.close(); host.close(); await serveur.close(); process.exit(0) })
