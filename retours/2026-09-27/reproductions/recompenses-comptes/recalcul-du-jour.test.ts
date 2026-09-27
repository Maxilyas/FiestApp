// Au démarrage qui suit un barème monté (`VERSION_BAREME`), la relecture de
// l'historique réécrit les soirées : elle ne doit rien reprendre de ce que
// seul le quiz du jour décerne — ses paliers, le Sphinx par sa voie, une
// saison gagnée par des jours de quiz —, ni toucher à la ligne `#jour`.
//
// cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
//   ../export/evaluations/recompenses-comptes/recalcul-du-jour.test.ts
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
  patienter,
  qcm,
  type Banc,
  type Invite,
  type Socket,
} from '../../../server/test/banc'
import { ProfileStore, VERSION_BAREME } from '../../../server/src/auth/profiles'

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

/** Toute la partie du jour, sans une faute. */
async function sansFaute(banc: Banc, cookie: string) {
  let etat = (await poster(banc, cookie, '/api/jour/commencer')).corps
  const questions = base(banc, db =>
    JSON.parse((db.prepare('SELECT questions FROM jour_tirages WHERE jour = ?').get(etat.jour) as { questions: string }).questions),
  ) as { bonne: number }[]
  while (etat.question) {
    const i = etat.question.index
    const r = await poster(banc, cookie, '/api/jour/repondre', { jour: etat.jour, index: i, choix: questions[i].bonne })
    assert.equal(r.status, 200, r.corps.error)
    etat = (await poster(banc, cookie, '/api/jour/suivante')).corps
  }
  return etat
}

async function jouerQuiz(host: Socket, quizId: string, questions: [Invite, number][][]) {
  const vue = (sessionId: string, pred: (v: any) => boolean, label: string) =>
    attendre<any>(host, 'session:view', p => p.sessionId === sessionId && pred(p.view), label, 15_000)
  const sessionId = await lancerQuiz(host, quizId)
  let suivante = vue(sessionId, v => v.phase === 'question' && v.qIndex === 0, 'la première question')
  for (let q = 0; q < questions.length; q++) {
    await suivante
    const revelee = vue(sessionId, v => v.phase === 'reveal' && v.qIndex === q, `la révélation ${q + 1}`)
    for (const [qui, choice] of questions[q]) {
      const ack = await emitAck<any>(qui.socket, 'player:action', { sessionId, action: { type: 'answer', choice } })
      assert.equal(ack.ok, true, `réponse ${q + 1} refusée : ${ack.error}`)
    }
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

/** Ce que la base dit d'Alice, sans les dates d'écriture. */
const etatDe = (banc: Banc, id: string) =>
  base(banc, db => ({
    badges: db.prepare('SELECT badge, soiree_id FROM profile_badges WHERE profile_id = ? ORDER BY badge, soiree_id').all(id),
    lignes: db.prepare('SELECT soiree_id, xp FROM profile_xp WHERE profile_id = ? ORDER BY soiree_id').all(id),
    total: (db.prepare('SELECT xp FROM profiles WHERE id = ?').get(id) as { xp: number }).xp,
  }))

test('un barème monté relit les soirées sans rien reprendre au quiz du jour', async () => {
  // Jeudi 29 octobre 2026, 10 h à Paris : Halloween.
  const banc = await demarrer({ horlogeDuJour: () => Date.UTC(2026, 9, 29, 9, 0) })
  try {
    const cookie = await connexionAnimateur(banc.url)
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const id = base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get('alice') as { id: string }).id)
    // Deux jours de la période déjà joués, et neuf sans-faute d'avant : le
    // dixième, aujourd'hui, ouvre le Sphinx ; le troisième jour, la Citrouille.
    base(banc, db => {
      const partie = db.prepare(
        `INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, ?, 1, 10, NULL, 0, 0, 1, 0)`,
      )
      for (const jour of ['2026-10-26', '2026-10-28']) partie.run(id, jour)
      const palier = db.prepare(
        `INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, ?, ?, '', '💯', 'Le Sans-Faute', 1)`,
      )
      palier.run(id, 'hf:sans-faute:1', '#jour:2026-10-01')
      palier.run(id, 'hf:sans-faute:2', '#jour:2026-10-10')
    })
    await banc.redemarrer()
    // Le Sphinx par sa voie du jour : dix sans-faute. On range l'or à la main
    // (neuf parties d'avant ne se rejouent pas), la partie du jour fait le reste.
    base(banc, db =>
      db
        .prepare(`INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, 'hf:sans-faute:3', '#jour:2026-10-27', '', '💯', 'Le Sans-Faute · Or', 1)`)
        .run(id),
    )
    await banc.redemarrer()
    const fin = await sansFaute(banc, alice)
    assert.equal(fin.etat, 'finie')
    assert.equal(fin.medaille, 'or')

    // Une soirée close, à quatre.
    const quiz = await creerQuiz(banc.url, cookie, [qcm('Un ?'), qcm('Deux ?'), qcm('Trois ?')])
    const host = await ecranCommun(banc.url, cookie)
    const a = await invite(banc.url, 'Alice', '', { cookie: alice })
    const salle = [await invite(banc.url, 'Bob', '🐻'), await invite(banc.url, 'Dora', '🐙'), await invite(banc.url, 'Eve', '🐝')]
    await jouerQuiz(host, quiz, Array.from({ length: 3 }, () => [[a, 0] as [Invite, number], ...salle.map(i => [i, 1] as [Invite, number])]))
    await patienter(500)
    const close = attendre<any>(host, 'toast', () => true, 'la soirée close', 15_000)
    ;(host as any).emit('host:closeParty', {})
    assert.equal((await close).kind, 'info')
    await patienter(300)

    const avant = etatDe(banc, id)
    const legendairesAvant = (await moi(banc, alice)).legendaires as string[]
    assert.ok(legendairesAvant.includes('lg:citrouille'), 'la Citrouille, par le quiz du jour')
    assert.ok(legendairesAvant.includes('lg:sphinx'), 'le Sphinx, par ses sans-faute')
    assert.ok(avant.lignes.some((l: any) => l.soiree_id === '#jour'))

    // Le barème monte : toutes les lignes deviennent « d'une version d'avant ».
    base(banc, db => db.prepare(`UPDATE profile_xp SET detail = json_set(detail, '$.v', ?)`).run(VERSION_BAREME - 1))
    const journal: string[] = []
    const log = console.log
    console.log = (...a: unknown[]) => void journal.push(a.map(String).join(' '))
    try {
      await banc.redemarrer()
    } finally {
      console.log = log
    }
    assert.ok(journal.some(l => l.includes('expérience recalculée')), `le recalcul a tourné (journal : ${journal.join(' | ')})`)

    const apres = etatDe(banc, id)
    assert.deepEqual(apres, avant, 'ni une ligne ni une récompense ne bouge : le barème n’a pas changé')
    const legendairesApres = (await moi(banc, alice)).legendaires as string[]
    assert.deepEqual(legendairesApres, legendairesAvant)
    // Que la ligne `#jour` revienne bien à la version du jour (et ne relance
    // pas le recalcul au démarrage suivant) : voir `recalcul-perpetuel.test.ts`.
  } finally {
    await banc.close()
  }
})
