// Que garde un joueur quand l'administrateur supprime l'espace où il a joué ?
//
//   npx tsx retours/2026-09-24/experts/scripts/admin-animateurs/sonde-suppression.ts \
//     <base> <loginAdmin> <mdpAdmin> <idCompte> <slug> <login> <mdp>
//
// Le compte visé est réactivé, Léa (profil) joue un quiz de cinq questions
// chez lui avec un figurant, la soirée est close ; on lit son profil, puis
// l'administrateur désactive et supprime le compte, et on relit son profil.
import { attendre, connexionAnimateur, creerQuiz, ecranCommun, ecrire, emitAck, inscrireProfil, invite, lancerQuiz, patienter, qcm } from '../../../../../server/test/banc'

const [base, loginAdmin, mdpAdmin, idCompte, slug, login, mdp] = process.argv.slice(2)
const admin = await connexionAnimateur(base, loginAdmin, mdpAdmin)
await ecrire(base, `/api/admin/accounts/${idCompte}/enable`, {}, admin)
const hote = await connexionAnimateur(base, login, mdp)
const quiz = await creerQuiz(base, hote, [1, 2, 3, 4, 5].map(n => qcm(`Q${n} ?`)), 'Cinq questions')
const lea = await inscrireProfil(base, `lea${Date.now() % 100000}`, 'Léa', '🦊')
const host = await ecranCommun(base, hote)
const joueuse = await invite(base, 'Léa', '🦊', { slug, cookie: lea })
const bob = await invite(base, 'Bob', '🐻', { slug })
const vue = (sid: string, pred: (v: any) => boolean) => attendre<any>(host, 'session:view', p => p.sessionId === sid && pred(p.view), 'vue', 20_000)
const sid = await lancerQuiz(host, quiz)
let suivante = vue(sid, v => v.phase === 'question' && v.qIndex === 0)
for (let q = 0; q < 5; q++) {
  await suivante
  const rev = vue(sid, v => v.phase === 'reveal' && v.qIndex === q)
  await emitAck(joueuse.socket, 'player:action', { sessionId: sid, action: { type: 'answer', choice: 0 } })
  await emitAck(bob.socket, 'player:action', { sessionId: sid, action: { type: 'answer', choice: 1 } })
  await rev
  suivante = q < 4 ? vue(sid, v => v.phase === 'question' && v.qIndex === q + 1) : vue(sid, v => v.phase === 'finished')
  ;(host as any).emit('host:command', { sessionId: sid, command: { type: 'next' } })
}
await suivante
;(host as any).emit('host:endSession', { sessionId: sid })
await patienter(1500)
const close = attendre<any>(host, 'toast', () => true, 'clôture', 20_000)
;(host as any).emit('host:closeParty', {})
await close
await patienter(1500)

const moi = async () => ((await (await fetch(`${base}/api/joueur/moi`, { headers: { Cookie: lea } })).json()) as any).profile
const avant = await moi()
const soirees = (p: any) => JSON.stringify(p.soirees ?? p.historique ?? p.parties ?? Object.keys(p))
console.log('avant  : xp', avant.xp, '· soirées', soirees(avant).slice(0, 300))

await ecrire(base, `/api/admin/accounts/${idCompte}/disable`, {}, admin)
const del = await ecrire(base, `/api/admin/accounts/${idCompte}`, {}, admin, 'DELETE')
console.log('suppression :', del.status)
const apres = await moi()
console.log('après  : xp', apres.xp, '· soirées', soirees(apres).slice(0, 300))
process.exit(0)
