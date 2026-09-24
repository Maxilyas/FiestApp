// Sonde de cloisonnement entre deux espaces (invariant 3) — à rejouer contre
// n'importe quel serveur où deux animateurs existent déjà :
//
//   npx tsx retours/2026-09-24/experts/scripts/admin-animateurs/sonde-cloisonnement.ts \
//     <base> <slugA> <loginA> <mdpA> <slugB> <loginB> <mdpB>
//
// A (Sarah) crée un quiz à photo, le joue à deux figurants, clôt la soirée
// (une archive), puis rouvre une soirée où Emma attend. B (Tom) essaie
// ensuite d'atteindre tout ce qui est à A, par HTTP et par socket.
import {
  attendre,
  connecter,
  connexionAnimateur,
  creerQuiz,
  ecranCommun,
  ecrire,
  emitAck,
  instantane,
  invite,
  lancerQuiz,
  patienter,
  qcm,
} from '../../../../../server/test/banc'

const [base, slugA, loginA, mdpA, slugB, loginB, mdpB] = process.argv.slice(2)
const lignes: string[] = []
const note = (ok: boolean, quoi: string, detail = '') => {
  lignes.push(`${ok ? '✓' : '✗ FUITE'}  ${quoi}${detail ? ' — ' + detail : ''}`)
}

// Un PNG 1×1, pour qu'il y ait une photo à chercher.
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const a = await connexionAnimateur(base, loginA, mdpA)
const b = await connexionAnimateur(base, loginB, mdpB)

const img = (await (await ecrire(base, '/api/images', { dataUrl: PNG }, a)).json()) as { url: string }
const questions = [
  { ...qcm('Photo ?', ['Oui', 'Non'], 0, 20), image: img.url },
  ...[2, 3, 4, 5].map(n => qcm(`Question ${n} ?`)),
]
const quizA = await creerQuiz(base, a, questions, 'Le quiz secret de A')

// A joue son quiz à deux, puis clôt : une archive.
const hostA = await ecranCommun(base, a)
const bob = await invite(base, 'Bob', '🐻', { slug: slugA })
const dora = await invite(base, 'Dora', '🐙', { slug: slugA })
const vue = (sid: string, pred: (v: any) => boolean, label: string) =>
  attendre<any>(hostA, 'session:view', p => p.sessionId === sid && pred(p.view), label, 20_000)
const sid = await lancerQuiz(hostA, quizA)
let suivante = vue(sid, v => v.phase === 'question' && v.qIndex === 0, 'q1')
for (let q = 0; q < questions.length; q++) {
  await suivante
  const rev = vue(sid, v => v.phase === 'reveal' && v.qIndex === q, 'rev')
  await emitAck(bob.socket, 'player:action', { sessionId: sid, action: { type: 'answer', choice: 0 } })
  await emitAck(dora.socket, 'player:action', { sessionId: sid, action: { type: 'answer', choice: 1 } })
  await rev
  suivante = q + 1 < questions.length ? vue(sid, v => v.phase === 'question' && v.qIndex === q + 1, 'q') : vue(sid, v => v.phase === 'finished', 'podium')
  ;(hostA as any).emit('host:command', { sessionId: sid, command: { type: 'next' } })
}
await suivante
;(hostA as any).emit('host:endSession', { sessionId: sid })
await patienter(1500)
const close = attendre<any>(hostA, 'toast', () => true, 'clôture', 20_000)
;(hostA as any).emit('host:closeParty', {})
await close
const hist = (await (await fetch(`${base}/s/${slugA}/soirees.json`)).json()) as any
const archiveA: string = hist.archives[0]?.id
// Une nouvelle soirée où Emma attend, et un quiz ouvert au choix.
const emma = await invite(base, 'Emma', '🦉', { slug: slugA })
const sidA2 = await lancerQuiz(hostA, quizA)
await patienter(800)

// ── B essaie ─────────────────────────────────────────────────────────────
const statut = async (methode: string, chemin: string, corps?: unknown) => {
  const res =
    methode === 'GET' ? await fetch(base + chemin, { headers: { Cookie: b } }) : await ecrire(base, chemin, corps ?? {}, b, methode)
  return res.status
}
for (const [m, c, corps] of [
  ['GET', `/api/quizzes/${quizA}`],
  ['PUT', `/api/quizzes/${quizA}`, { title: 'volé', questions: [] }],
  ['POST', `/api/quizzes/${quizA}/duplicate`],
  ['DELETE', `/api/quizzes/${quizA}`],
  ['PUT', `/api/soirees/${archiveA}`, { title: 'volée' }],
  ['DELETE', `/api/soirees/${archiveA}`],
  ['GET', `/s/${slugB}/soirees/${archiveA}/recap.json`],
  ['GET', `/s/${slugB}/soirees/${archiveA}/bilan.json`],
  ['GET', `/s/${slugB}/joueurs/${emma.playerId}.json`],
  ['GET', `/api/admin/accounts`],
] as [string, string, unknown?][]) {
  const s = await statut(m, c, corps)
  note(s === 404 || s === 403, `${m} ${c}`, `HTTP ${s}`)
}
const listeB = (await (await fetch(base + '/api/quizzes', { headers: { Cookie: b } })).json()) as any[]
note(!listeB.some(q => q.id === quizA), 'la bibliothèque de B ne montre pas le quiz de A', `${listeB.length} quiz`)
// L'archive de A n'a pas bougé.
const relu = (await (await fetch(`${base}/s/${slugA}/soirees/${archiveA}/recap.json`)).json()) as any
note(relu.archive?.title !== 'volée', 'l’archive de A garde son titre', relu.archive?.title)

// Réglages : B ne peut pas prendre l'adresse ni le nom de A par ses réglages.
await ecrire(base, '/api/space/settings', { slug: slugA, name: 'usurpé', title: 'Chez B' }, b, 'PUT')
const spaceA = (await (await fetch(`${base}/s/${slugA}/space.json`)).json()) as any
note(spaceA.name !== 'usurpé', 'les réglages de B ne touchent pas l’espace de A', spaceA.name)

// Socket : l'écran commun de B vise la partie et les invités de A.
const hostB = await ecranCommun(base, b)
;(hostB as any).emit('host:command', { sessionId: sidA2, command: { type: 'selectPack', packId: quizA, multiplier: 1 } })
;(hostB as any).emit('host:renamePlayer', { playerId: emma.playerId, name: 'Pirate' })
;(hostB as any).emit('host:removePlayer', { playerId: emma.playerId })
;(hostB as any).emit('host:endSession', { sessionId: sidA2 })
await patienter(1500)
const snapA = await instantane<any>(hostA)
const emmaVue = snapA.players?.find((p: any) => p.id === emma.playerId)
note(!!emmaVue && emmaVue.name === 'Emma', 'Emma reste chez A, sous son prénom', emmaVue?.name ?? 'absente')

// Le jeton d'Emma présenté chez B.
const tel = connecter(base)
await emitAck(tel, 'party:watch', { slug: slugB })
const j = await emitAck<any>(tel, 'player:join', { slug: slugB, token: emma.token })
note(!j.ok || j.playerId !== emma.playerId, 'le jeton d’Emma ne vaut rien chez B', JSON.stringify({ ok: j.ok, reason: j.reason }))
const act = await emitAck<any>(connecter(base), 'player:action', { slug: slugB, token: emma.token, sessionId: sidA2, action: { type: 'answer', choice: 0 } })
note(!act.ok, 'une réponse d’Emma envoyée chez B est refusée', JSON.stringify(act))

// La photo de A : publique par son identifiant (exception assumée, api.ts).
// B peut-il l'attacher à un de ses quiz ? Si oui, son quiz dépend du ménage de A.
const quizB = await creerQuiz(base, b, [{ ...qcm('Emprunt ?'), image: img.url }], 'Le quiz de B')
const qb = (await (await fetch(`${base}/api/quizzes/${quizB}`, { headers: { Cookie: b } })).json()) as any
lignes.push(`ℹ  B peut citer la photo de A dans son quiz : ${qb.questions[0].image === img.url ? 'oui (' + img.url + ')' : 'non'}`)

console.log(lignes.join('\n'))
process.exit(0)
