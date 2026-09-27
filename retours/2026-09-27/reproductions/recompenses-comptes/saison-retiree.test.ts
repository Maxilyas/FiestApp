// La Citrouille a deux voies : une soirée d'Halloween, ou trois jours de quiz
// du jour dans la période. Gagnée d'abord en soirée, elle n'est plus rangée
// sous le jour qui la mérite aussi (`ProfileStore.accorderSaison` rend faux :
// « déjà là »). Retirer ensuite la soirée de l'historique l'emporte — alors
// que les trois jours de quiz du jour, eux, sont toujours là. La période
// passée, rien ne la rend.
//
// cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
//   ../export/evaluations/recompenses-comptes/saison-retiree.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import {
  attendre,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  ecrire,
  emitAck,
  inscrireProfil,
  invite,
  lancerQuiz,
  qcm,
  type Banc,
  type Invite,
  type Socket,
} from '../../../server/test/banc'
import { ProfileStore } from '../../../server/src/auth/profiles'

ProfileStore.tirageEclat = () => false

const permanente = (banc: Banc) => banc.quizDbUrl.replace(/^file:/, '')
function base<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(permanente(banc))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const moi = async (banc: Banc, cookie: string) =>
  ((await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: cookie } })).json()) as any).profile

async function jouerLeJour(banc: Banc, cookie: string) {
  let etat = (await poster(banc, cookie, '/api/jour/commencer')).corps
  while (etat.question) {
    const r = await poster(banc, cookie, '/api/jour/repondre', { jour: etat.jour, index: etat.question.index, choix: 0 })
    assert.equal(r.status, 200, r.corps.error)
    etat = (await poster(banc, cookie, '/api/jour/suivante')).corps
  }
  return etat
}

async function jouerUneQuestion(host: Socket, quizId: string, salle: Invite[]) {
  const vue = (sessionId: string, pred: (v: any) => boolean, label: string) =>
    attendre<any>(host, 'session:view', p => p.sessionId === sessionId && pred(p.view), label, 15_000)
  const sessionId = await lancerQuiz(host, quizId)
  await vue(sessionId, v => v.phase === 'question', 'la question')
  const revelee = vue(sessionId, v => v.phase === 'reveal', 'la révélation')
  for (const qui of salle) {
    const ack = await emitAck<any>(qui.socket, 'player:action', { sessionId, action: { type: 'answer', choice: 0 } })
    assert.equal(ack.ok, true, ack.error)
  }
  await revelee
  const podium = vue(sessionId, v => v.phase === 'finished', 'le podium')
  ;(host as any).emit('host:command', { sessionId, command: { type: 'next' } })
  await podium
  ;(host as any).emit('host:endSession', { sessionId })
}

test('la Citrouille méritée par trois jours de quiz du jour survit au retrait de la soirée qui l’avait ouverte la première', async () => {
  // Jeudi 29 octobre 2026, 10 h à Paris : en pleine période d'Halloween.
  const horloge = { t: Date.UTC(2026, 9, 29, 9, 0) }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t })
  try {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [qcm('On y est ?')])
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')

    // 1. Une soirée d'Halloween (son journal redaté du 26 octobre, comme dans
    //    `saisons.test.ts`) : la Citrouille tombe, rangée sous la soirée.
    let host = await ecranCommun(banc.url, cookie)
    await jouerUneQuestion(host, quiz, [await invite(banc.url, 'Alice', '', { cookie: alice }), await invite(banc.url, 'Bob', '🐻')])
    host.close()
    const locale = new Database(banc.dbPath)
    locale.prepare('UPDATE answer_log SET created_at = ?').run(Date.UTC(2026, 9, 26, 19, 0))
    locale.close()
    await banc.redemarrer()
    host = await ecranCommun(banc.url, cookie)
    const close = attendre<any>(host, 'toast', () => true, 'la soirée close', 15_000)
    ;(host as any).emit('host:closeParty', {})
    assert.equal((await close).kind, 'info')
    const [{ soiree_id: soiree }] = base(banc, db =>
      db.prepare(`SELECT soiree_id FROM profile_badges WHERE badge = 'saison:halloween'`).all(),
    ) as { soiree_id: string }[]
    assert.ok(!soiree.startsWith('#jour'), 'rangée sous la soirée')
    assert.ok((await moi(banc, alice)).legendaires.includes('lg:citrouille'))

    // 2. Au quiz du jour, Alice joue trois jours de la période (le 26, le 28,
    //    puis aujourd'hui) : de quoi mériter la Citrouille par l'autre voie.
    const id = base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get('alice') as { id: string }).id)
    base(banc, db => {
      const partie = db.prepare(
        `INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, ?, 1, 10, NULL, 0, 0, 1, 0)`,
      )
      for (const jour of ['2026-10-26', '2026-10-28']) partie.run(id, jour)
    })
    await jouerLeJour(banc, alice)
    const sousLeJour = base(banc, db =>
      db.prepare(`SELECT soiree_id FROM profile_badges WHERE badge = 'saison:halloween' AND soiree_id LIKE '#jour:%'`).all(),
    )

    // 3. Le 3 novembre, Halloween fini, l'animateur retire la soirée de son historique.
    horloge.t = Date.UTC(2026, 10, 3, 9, 0)
    const retrait = await ecrire(banc.url, `/api/soirees/${soiree}`, {}, cookie, 'DELETE')
    assert.equal(retrait.status, 200)
    const jours = base(banc, db =>
      (db.prepare(`SELECT COUNT(*) AS n FROM jour_parties WHERE profile_id = ? AND jour BETWEEN '2026-10-25' AND '2026-11-01'`).get(id) as { n: number }).n,
    )
    assert.equal(jours, 3, 'ses trois jours de quiz du jour dans la période sont toujours là')

    const legendaires = (await moi(banc, alice)).legendaires as string[]
    assert.deepEqual(
      { rangeeSousLeJour: sousLeJour.length, citrouille: legendaires.includes('lg:citrouille') },
      { rangeeSousLeJour: 1, citrouille: true },
      'la soirée retirée n’emporte que ce qu’elle seule avait donné : les trois jours de quiz du jour gardent la Citrouille',
    )
  } finally {
    await banc.close()
  }
})
