// Les légendaires de saison : la Citrouille (Halloween), le Sapin (Noël), le
// Bouquet final (le Nouvel An). Ils ne se gagnent qu'à leur période : des
// jours joués au quiz du jour, ou une soirée qui compte ces jours-là — à la
// date de Paris.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import {
  attendre,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecrire,
  ecranCommun,
  emitAck,
  inscrireProfil,
  invite,
  lancerQuiz,
  qcm,
  type Banc,
  type Invite,
  type Socket,
} from './banc'
import { ProfileStore } from '../src/auth/profiles'
import { laureatsDeSaison } from '../src/core/saisons'
import { periodeDu, saison } from '../../shared/saisons'
import { gainVide } from '../../shared/profil'
import { legendairesDebloques } from '../../shared/legendaires'

ProfileStore.tirageEclat = () => false

test('les périodes, à la date de Paris — le Nouvel An enjambe l’année', () => {
  const de = (jour: string) => periodeDu(jour)?.saison.key ?? null
  assert.equal(de('2026-10-24'), null)
  assert.equal(de('2026-10-25'), 'halloween')
  assert.equal(de('2026-11-01'), 'halloween')
  assert.equal(de('2026-11-02'), null)
  assert.equal(de('2026-12-19'), null)
  assert.equal(de('2026-12-20'), 'noel')
  assert.equal(de('2026-12-26'), 'noel')
  assert.equal(de('2026-12-29'), null)
  const nouvelAn = { saison: saison('nouvel-an'), debut: '2026-12-30', fin: '2027-01-02' }
  assert.deepEqual(periodeDu('2026-12-31'), nouvelAn)
  assert.deepEqual(periodeDu('2027-01-02'), nouvelAn, 'le 2 janvier est encore du Nouvel An de l’année d’avant')
  assert.equal(de('2027-01-03'), null)
})

test('une soirée qui compte, jouée pendant la saison, l’ouvre à ses profils — datée à sa première question', () => {
  // Le 31 octobre 2026, 21 h à Paris.
  const soir = Date.UTC(2026, 9, 31, 20, 0)
  const gains = [
    { profileId: 'alice', gain: { ...gainVide(), reponses: 12 } },
    { profileId: 'seule', gain: gainVide() },
  ]
  const joue = (createdAt: number) => [{ answered: true, createdAt }]
  assert.deepEqual(
    laureatsDeSaison([...joue(soir + 60_000), ...joue(soir)], gains).map(l => [l.profileId, l.badge]),
    [['alice', 'saison:halloween']],
    'qui n’a rien joué à deux ne la gagne pas',
  )
  // Le 1er novembre à 23 h 50 : encore Halloween. Le 2 au matin : fini.
  assert.equal(laureatsDeSaison(joue(Date.UTC(2026, 10, 1, 22, 50)), gains).length, 1)
  assert.deepEqual(laureatsDeSaison(joue(Date.UTC(2026, 10, 2, 9, 0)), gains), [])
  assert.deepEqual(laureatsDeSaison([{ answered: false, createdAt: soir }], gains), [], 'rien de joué, rien de daté')
  assert.ok(legendairesDebloques(new Map([['saison:halloween', 1]])).includes('lg:citrouille'))
})

// ── Au quiz du jour ─────────────────────────────────────────────────────

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

function base<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

async function jouer(banc: Banc, cookie: string) {
  let etat = (await poster(banc, cookie, '/api/jour/commencer')).corps
  while (etat.question) {
    const r = await poster(banc, cookie, '/api/jour/repondre', { jour: etat.jour, index: etat.question.index, choix: 0 })
    assert.equal(r.status, 200, r.corps.error)
    etat = (await poster(banc, cookie, '/api/jour/suivante')).corps
  }
  return etat
}

test('trois jours de quiz du jour pendant Halloween ouvrent la Citrouille ; la page dit ce qui manque, puis la fête', async () => {
  // Jeudi 29 octobre 2026, 10 h à Paris.
  const horloge = { t: Date.UTC(2026, 9, 29, 9, 0) }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t })
  try {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const saisonVue = async () => (await lire(banc, alice, '/api/jour')).corps.saison
    assert.deepEqual(await saisonVue(), {
      nom: 'Halloween',
      legendaire: 'lg:citrouille',
      joues: 0,
      requis: 3,
      periode: 'du 25 octobre au 1er novembre',
    })
    // Deux jours déjà joués dans la période, et un avant elle, qui ne compte pas.
    const id = base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get('alice') as { id: string }).id)
    base(banc, db => {
      const partie = db.prepare(
        `INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, ?, 1, 10, NULL, 0, 0, 1, 0)`,
      )
      for (const jour of ['2026-10-24', '2026-10-26', '2026-10-28']) partie.run(id, jour)
    })
    assert.equal((await saisonVue()).joues, 2)

    // Le troisième : la fin de la partie fête la Citrouille, et elle se porte.
    const fin = await jouer(banc, alice)
    assert.deepEqual(fin.legendaires, ['lg:citrouille'])
    assert.equal(fin.saison, undefined, 'gagnée, la saison ne s’annonce plus')
    assert.equal(fin.paliers, undefined, 'une saison n’est pas un palier')
    const porte = await ecrire(banc.url, '/api/joueur/moi', { legendaire: 'lg:citrouille' }, alice, 'PUT')
    assert.equal(porte.status, 200)
    // Rien sur l'étagère : elle ne se montre que par son légendaire.
    const moi = (await lire(banc, alice, '/api/joueur/moi')).corps.profile
    assert.ok(moi.legendaires.includes('lg:citrouille'))
    assert.ok(!moi.vitrine.some((b: any) => b.key.startsWith('saison:')))

    // Le 3 novembre, Halloween est fini : rien ne s'annonce.
    horloge.t = Date.UTC(2026, 10, 3, 9, 0)
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    assert.equal((await lire(banc, bob, '/api/jour')).corps.saison, undefined)
  } finally {
    await banc.close()
  }
})

// ── En soirée ───────────────────────────────────────────────────────────

/** Un quiz d'une question, que tous les invités jouent, puis que l'écran commun termine. */
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

test('une soirée jouée le soir d’Halloween ouvre la Citrouille à ses profils, à la clôture', async () => {
  const banc = await demarrer()
  try {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [qcm('On y est ?')])
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    let host = await ecranCommun(banc.url, cookie)
    const salle = [await invite(banc.url, 'Alice', '', { cookie: alice }), await invite(banc.url, 'Bob', '🐻')]
    await jouerUneQuestion(host, quiz, salle)

    // Le journal de la soirée, daté du soir d'Halloween — le serveur ne se
    // règle pas sur une autre horloge que la sienne : on le relit après
    // l'avoir redaté, comme au réveil d'un disque.
    host.close()
    const db = new Database(banc.dbPath)
    db.prepare('UPDATE answer_log SET created_at = ?').run(Date.UTC(2026, 9, 31, 20, 0))
    db.close()
    await banc.redemarrer()
    host = await ecranCommun(banc.url, cookie)
    const toast = attendre<any>(host, 'toast', () => true, 'la soirée close', 15_000)
    ;(host as any).emit('host:closeParty', {})
    assert.equal((await toast).kind, 'info')

    const moi = (await lire(banc, alice, '/api/joueur/moi')).corps.profile
    assert.ok(moi.legendaires.includes('lg:citrouille'), 'la Citrouille est à Alice')
    // Rangée sous la soirée : la retirer de l'historique l'emporterait avec elle.
    const lignes = base(banc, d => d.prepare(`SELECT soiree_id FROM profile_badges WHERE badge = 'saison:halloween'`).all()) as { soiree_id: string }[]
    assert.equal(lignes.length, 1)
    assert.ok(!lignes[0].soiree_id.startsWith('#jour'))
  } finally {
    await banc.close()
  }
})
