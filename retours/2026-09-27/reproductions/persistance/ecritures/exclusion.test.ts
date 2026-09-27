// Un invité à profil exclu pendant que la base permanente hoquette.
//
// L'exclusion est locale et immédiate (`SpaceRuntime.exclure`) ; ce que la
// soirée avait déjà crédité à son profil — la ligne (profil, soirée), l'Éclat
// — part ensuite, au loin, par `rendreCredit`, lancé sans attendre et dont
// l'échec ne fait qu'un journal (`.catch(e => console.error('[xp]', e))`).
// Personne ne le rejoue : les crédits suivants ne réécrivent que les
// profils encore là, et la clôture aussi. Un hoquet de Turso à cet instant,
// et l'exclu garde pour toujours l'expérience d'une soirée dont il a été
// retiré — invariant 10 : « Un invité exclu rend la sienne ».
//
// Écrite pour passer le jour où c'est corrigé.
//
//   cd server && nice -n 10 node --import tsx --test --test-timeout=120000 ../export/evaluations/persistance/ecritures/exclusion.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import {
  attendre,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  emitAck,
  inscrireProfil,
  invite,
  lancerQuiz,
  patienter,
  qcm,
  type Banc,
  type Invite,
  type Socket,
} from '../../../../server/test/banc'
import { ProfileStore } from '../../../../server/src/auth/profiles'

ProfileStore.tirageEclat = () => false

const permanente = (banc: Banc) => banc.quizDbUrl.replace(/^file:/, '')

function lire<T = any>(banc: Banc, sql: string, ...args: unknown[]): T[] {
  const db = new Database(permanente(banc), { readonly: true, fileMustExist: true })
  try {
    return db.prepare(sql).all(...args) as T[]
  } finally {
    db.close()
  }
}

function panne(banc: Banc, armee: boolean) {
  const db = new Database(permanente(banc))
  try {
    db.exec('CREATE TABLE IF NOT EXISTS panne_temoin (armee INTEGER)')
    db.exec('DELETE FROM panne_temoin')
    if (armee) db.exec('INSERT INTO panne_temoin VALUES (1)')
    db.exec(
      `CREATE TRIGGER IF NOT EXISTS panne_profile_xp BEFORE DELETE ON profile_xp
       WHEN EXISTS (SELECT 1 FROM panne_temoin) BEGIN SELECT RAISE(ABORT, 'base permanente muette'); END`,
    )
  } finally {
    db.close()
  }
}

async function jouerQuiz(host: Socket, quizId: string, questions: [Invite, number][][]) {
  const vue = (sessionId: string, pred: (v: any) => boolean, label: string) =>
    attendre<any>(host, 'session:view', p => p.sessionId === sessionId && pred(p.view), label, 15_000)
  const sessionId = await lancerQuiz(host, quizId)
  let suivante = vue(sessionId, v => v.phase === 'question' && v.qIndex === 0, 'la première question')
  for (let q = 0; q < questions.length; q++) {
    await suivante
    const revelee = vue(sessionId, v => v.phase === 'reveal' && v.qIndex === q, `la révélation ${q + 1}`)
    for (const [qui, choice] of questions[q]) await emitAck(qui.socket, 'player:action', { sessionId, action: { type: 'answer', choice } })
    await revelee
    suivante =
      q + 1 < questions.length
        ? vue(sessionId, v => v.phase === 'question' && v.qIndex === q + 1, `la question ${q + 2}`)
        : vue(sessionId, v => v.phase === 'finished', 'le podium')
    ;(host as any).emit('host:command', { sessionId, command: { type: 'next' } })
  }
  await suivante
  ;(host as any).emit('host:endSession', { sessionId })
}

test('un invité à profil exclu pendant un hoquet de Turso ne garde pas l’expérience de la soirée', async () => {
  const banc = await demarrer()
  try {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, Array.from({ length: 5 }, (_, i) => qcm(`Question ${i + 1} ?`)))
    const malikCookie = await inscrireProfil(banc.url, 'malik', 'Malik', '🦊')
    const noraCookie = await inscrireProfil(banc.url, 'nora', 'Nora', '🐼')
    const host = await ecranCommun(banc.url, cookie)
    const malik = await invite(banc.url, 'Malik', '🦊', { cookie: malikCookie })
    const nora = await invite(banc.url, 'Nora', '🐼', { cookie: noraCookie })
    const eve = await invite(banc.url, 'Eve', '🐸')
    await jouerQuiz(host, quiz, Array.from({ length: 5 }, () => [[malik, 0], [nora, 1], [eve, 1]] as [Invite, number][]))
    const deMalik = () => lire<{ soiree_id: string; xp: number }>(banc, "SELECT soiree_id, xp FROM profile_xp WHERE profile_id = (SELECT id FROM profiles WHERE login = 'malik')")
    for (let i = 0; i < 50 && deMalik().length === 0; i++) await patienter(100)
    const credit = deMalik()
    console.log('crédité à Malik au podium :', credit)
    assert.equal(credit.length, 1, 'le podium du quiz a crédité Malik (invariant 10)')

    // L'animateur l'exclut — et Turso refuse, à cet instant, d'effacer sa ligne.
    panne(banc, true)
    ;(host as any).emit('host:removePlayer', { playerId: malik.playerId })
    await attendre<any>(host, 'party:snapshot', s => !s.players.some((p: any) => p.id === malik.playerId), 'Malik exclu')
    await patienter(500)
    panne(banc, false)

    // La soirée continue, un second quiz, puis la clôture : rien ne revient sur Malik.
    const quiz2 = await creerQuiz(banc.url, cookie, Array.from({ length: 5 }, (_, i) => qcm(`Encore ${i + 1} ?`)), 'Second')
    await jouerQuiz(host, quiz2, Array.from({ length: 5 }, () => [[nora, 0], [eve, 1]] as [Invite, number][]))
    await patienter(500)
    const toast = attendre<any>(host, 'toast', () => true, 'la clôture', 15_000)
    ;(host as any).emit('host:closeParty', { title: 'La soirée' })
    assert.equal((await toast).kind, 'info')
    await patienter(300)

    const reste = deMalik()
    const total = lire<{ xp: number }>(banc, "SELECT xp FROM profiles WHERE login = 'malik'")[0].xp
    console.log('après la clôture, Malik garde :', reste, '— total', total)
    assert.deepEqual(reste, [], `Malik, exclu, garde ${total} XP d’une soirée dont il a été retiré`)
  } finally {
    await banc.close()
  }
})
