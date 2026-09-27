// Un palier de carrière qui tombe à la clôture pendant un hoquet de Turso.
//
// `accorderPaliers` (auth/profiles.ts) range le badge du palier, puis — dans
// d'autres requêtes — réécrit la ligne d'expérience des paliers (`#paliers`)
// et le total. Si la base se tait entre les deux, la clôture échoue (la
// soirée reste, l'animateur réessaie) ; mais au second essai, le palier est
// déjà sur l'étagère : `neufs` est vide, la ligne `#paliers` ne se réécrit
// jamais, et l'expérience du palier (10, 25 ou 50) n'est jamais créditée —
// ni annoncée : la fin de soirée ne dit plus qu'il est tombé. Même motif dans
// `accorderPaliersDuJour` (les paliers du quiz du jour).
//
// Écrite pour passer le jour où c'est corrigé.
//
//   cd server && nice -n 10 node --import tsx --test --test-timeout=120000 ../export/evaluations/persistance/ecritures/paliers.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import {
  ADMIN,
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
import { ProfileStore, VERSION_BAREME } from '../../../../server/src/auth/profiles'
import { gainVide, releveVide } from '../../../../shared/profil'
import { XP_PALIER } from '../../../../shared/hautsfaits'

ProfileStore.tirageEclat = () => false

const permanente = (banc: Banc) => banc.quizDbUrl.replace(/^file:/, '')

function base<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(permanente(banc), { fileMustExist: true })
  try {
    return fn(db)
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

test('un palier tombé pendant un hoquet de Turso : au second essai de clôture, son expérience est créditée', async () => {
  const banc = await demarrer()
  try {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, Array.from({ length: 5 }, (_, i) => qcm(`Question ${i + 1} ?`)))
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    // Deux soirées closes derrière elle : la troisième fait tomber L'Habitué (3 soirées).
    base(banc, db => {
      const espace = (db.prepare('SELECT id FROM accounts WHERE slug = ?').get(ADMIN.slug) as { id: string }).id
      const profil = (db.prepare('SELECT id FROM profiles WHERE login = ?').get('alice') as { id: string }).id
      for (const [i, soiree] of ['avant-hier', 'hier'].entries()) {
        db.prepare(
          `INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, ?, ?, 20, ?, ?)`,
        ).run(profil, soiree, espace, JSON.stringify({ v: VERSION_BAREME, gain: { ...gainVide(), reponses: 20 }, releve: { ...releveVide(), reponses: 20 } }), Date.now() - (2 - i) * 86_400_000)
      }
      // Turso se taira, le moment venu, quand on réécrira la ligne des paliers.
      db.exec('CREATE TABLE panne_temoin (armee INTEGER)')
      db.exec(`CREATE TRIGGER panne_paliers BEFORE INSERT ON profile_xp
               WHEN NEW.soiree_id = '#paliers' AND EXISTS (SELECT 1 FROM panne_temoin)
               BEGIN SELECT RAISE(ABORT, 'base permanente muette'); END`)
    })
    const host = await ecranCommun(banc.url, cookie)
    const alice = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    const eve = await invite(banc.url, 'Eve', '🐸')
    await jouerQuiz(host, quiz, Array.from({ length: 5 }, () => [[alice, 0], [eve, 1]] as [Invite, number][]))
    await patienter(500)

    base(banc, db => db.exec('INSERT INTO panne_temoin VALUES (1)'))
    const premier = attendre<any>(host, 'toast', () => true, 'la première clôture', 15_000)
    ;(host as any).emit('host:closeParty', { title: 'La troisième' })
    console.log('première clôture :', await premier)
    base(banc, db => db.exec('DELETE FROM panne_temoin'))

    const fin = attendre<any>(alice.socket, 'soiree:fin', () => true, 'la fin d’Alice', 15_000)
    const second = attendre<any>(host, 'toast', () => true, 'la seconde clôture', 15_000)
    ;(host as any).emit('host:closeParty', { title: 'La troisième' })
    const t2 = await second
    console.log('seconde clôture :', t2)
    assert.equal(t2.kind, 'info')
    const annonce = (await fin).profil?.paliers ?? []
    const etat = base(banc, db => ({
      palier: db.prepare("SELECT badge FROM profile_badges WHERE badge LIKE 'hf:habitue:%'").all(),
      lignePaliers: db.prepare("SELECT xp FROM profile_xp WHERE soiree_id = '#paliers'").all(),
      total: (db.prepare("SELECT xp FROM profiles WHERE login = 'alice'").get() as { xp: number }).xp,
      somme: (db.prepare("SELECT SUM(xp) AS s FROM profile_xp WHERE profile_id = (SELECT id FROM profiles WHERE login = 'alice')").get() as { s: number }).s,
    }))
    console.log('palier sur l’étagère :', etat.palier, '— ligne #paliers :', etat.lignePaliers, '— annoncé :', annonce.map((p: any) => p.key), `— total ${etat.total} (somme des lignes ${etat.somme})`)
    assert.equal(etat.palier.length, 1, 'L’Habitué est sur l’étagère')
    assert.deepEqual(etat.lignePaliers, [{ xp: XP_PALIER[0] }], `L’Habitué rapporte ses ${XP_PALIER[0]} XP`)
  } finally {
    await banc.close()
  }
})
