// Ce que coûte une base permanente lente (Turso loin, ou encombré) à une
// soirée : la réponse d'un invité (son accusé), la révélation, le rangement
// après le quiz, et la clôture — jusqu'à la fin de soirée sur les téléphones.
//
//   cd server && TMPDIR=../export/evaluations/perf-serveur npx tsx \
//     ../retours/2026-09-24/experts/scripts/perf-serveur/miroir-lent.ts 0 100 400
//
// Un vrai serveur (`server/test/banc.ts`), 30 invités dont 12 avec un profil,
// un quiz de 10 QCM. Chaque `execute`/`batch` du client libsql attend `rtt` ms.
import { Sqlite3Client } from '@libsql/client/sqlite3'
import {
  attendre, connexionAnimateur, creerQuiz, demarrer, ecranCommun, emitAck, inscrireProfil, invite, lancerQuiz, patienter, qcm,
} from '../../../../../server/test/banc'

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

for (const r of process.argv.slice(2).map(Number)) {
  rtt = 0
  const banc = await demarrer()
  const cookie = await connexionAnimateur(banc.url)
  const packId = await creerQuiz(banc.url, cookie, Array.from({ length: 10 }, (_, i) => qcm(`Question ${i + 1} ?`, ['A', 'B', 'C', 'D'], i % 4, 30)))
  const host = await ecranCommun(banc.url, cookie)
  const invites = []
  for (let i = 0; i < 30; i++) {
    const c = i < 12 ? await inscrireProfil(banc.url, `perf${i}`, `Profil ${i}`) : undefined
    invites.push(await invite(banc.url, `Invité ${i}`, '🦊', { cookie: c }))
  }
  rtt = r
  appels = 0
  const sessionId = await lancerQuiz(host, packId)
  const acks: number[] = []
  let reveler = 0
  for (let q = 0; q < 10; q++) {
    const vue = await attendre<any>(host, 'session:view', p => p.view.phase === 'question' && p.view.qIndex === q, `question ${q}`, 20000)
    await Promise.all(
      invites.map(async (inv, i) => {
        const t = performance.now()
        await emitAck(inv.socket, 'player:action', { sessionId, action: { type: 'answer', choice: (i + q) % 4, qIndex: q, round: vue.view.round } })
        acks.push(performance.now() - t)
      }),
    )
    const t = performance.now()
    await attendre<any>(host, 'session:view', p => p.view.phase === 'reveal' && p.view.qIndex === q, `révélation ${q}`, 20000)
    reveler = Math.max(reveler, performance.now() - t)
    ;(host as any).emit('host:command', { sessionId, command: { type: 'next', phase: 'reveal', qIndex: q, round: vue.view.round } })
  }
  await attendre<any>(host, 'session:view', p => p.view.phase === 'finished', 'podium', 20000)
  const pendantLeQuiz = appels
  // Le rangement après le quiz et les crédits : on attend que la file du miroir soit vide.
  const t1 = performance.now()
  appels = 0
  ;(host as any).emit('host:endSession', { sessionId })
  // Jusqu'au calme : plus aucune requête distante pendant une seconde.
  for (let vu = -1; vu !== appels; ) {
    vu = appels
    await patienter(1000)
  }
  // La clôture : du clic à la fin de soirée sur le dernier téléphone.
  const t2 = performance.now()
  const rangement = t2 - t1 - 1000
  const avantCloture = appels
  appels = 0
  const fins = invites.map(inv => attendre<any>(inv.socket, 'soiree:fin', () => true, 'fin de soirée', 120000))
  ;(host as any).emit('host:closeParty', { title: 'Perf' })
  await Promise.all(fins)
  const cloture = performance.now() - t2
  acks.sort((a, b) => a - b)
  console.log(JSON.stringify({
    'rtt ms': r,
    'accusé de réponse, médiane ms': acks[acks.length >> 1].toFixed(1),
    'accusé de réponse, pire ms': acks[acks.length - 1].toFixed(1),
    'révélation après la dernière réponse, pire ms': Math.round(reveler),
    'requêtes distantes pendant le quiz (10 q.)': pendantLeQuiz,
    'rangement + crédits après le quiz': `${avantCloture} requêtes, ${Math.round(rangement)} ms`,
    'clôture → fin de soirée sur les 30 téléphones ms': Math.round(cloture),
    'requêtes distantes de la clôture': appels,
  }))
  for (const inv of invites) inv.socket.close()
  host.close()
  rtt = 0
  await banc.close()
}
