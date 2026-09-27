// Une clôture refusée par le miroir, puis rejouée : la fin de soirée n'annonce
// plus les paliers que la première tentative a déjà rangés.
//
// `closeParty` crédite AVANT d'effacer (`crediterCloture`, puis
// `viderSoiree`) : quand le miroir refuse d'effacer, l'animateur lit « Rien
// n'a été effacé — réessaie », et la soirée continue… mais les paliers de
// carrière sont déjà tombés, rangés sous le nom de la soirée. Au second clic,
// `accorderPaliers` ne rend que ce qui est NEUF — plus rien —, et la fin de
// chaque téléphone, comme l'écran de clôture, se tait sur eux. C'est le même
// ressort que deux clôtures croisées (`double-cloture.test.ts`) : ce que la
// clôture raconte se calcule en écrivant, et ne se relit pas.
//
// Ce que ce test attend (il échoue aujourd'hui) : la fin reçue après la
// clôture rejouée annonce le palier que la soirée a fait tomber.
//
// Lancer depuis `server/` :
//   nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/concurrence/cloture-rejouee.test.ts
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
} from '../../../server/test/banc'
import { ProfileStore, VERSION_BAREME } from '../../../server/src/auth/profiles'
import { gainVide, releveVide } from '../../../shared/profil'

ProfileStore.tirageEclat = () => false

const TABLES_DU_MIROIR = ['party_players', 'party_teams', 'party_bonus', 'party_answers', 'party_scores', 'party_sessions', 'party_soiree']

test('clôture refusée par le miroir puis rejouée : la fin annonce encore le palier tombé', async () => {
  const banc = await demarrer({ miroir: { reessaisMs: [40, 80, 160], alerteMs: 400, delaiExtinctionMs: 3000 } })
  const fichier = banc.quizDbUrl.replace(/^file:/, '')
  const sql = (fn: (db: Database.Database) => void) => {
    const db = new Database(fichier)
    try {
      fn(db)
    } finally {
      db.close()
    }
  }
  try {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [qcm('Q1 ?'), qcm('Q2 ?')], 'Deux')
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    // Alice a déjà joué chez un autre hôte : ce soir, « Le Globe-trotteur » tombe.
    sql(db => {
      const id = (db.prepare('SELECT id FROM profiles WHERE login = ?').get('alice') as { id: string }).id
      db.prepare(
        `INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, 'une-soiree-ailleurs', 'un-autre-hote', 0, ?, ?)`,
      ).run(id, JSON.stringify({ v: VERSION_BAREME, gain: gainVide(), releve: releveVide() }), Date.now() - 86_400_000)
    })
    const tele = await ecranCommun(banc.url, cookie)
    const alice = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    const bob = await invite(banc.url, 'Bob', '🐻')
    const sessionId = await lancerQuiz(tele, quiz)
    for (let q = 0; q < 2; q++) {
      await attendre<any>(tele, 'session:view', p => p.sessionId === sessionId && p.view.phase === 'question' && p.view.qIndex === q, `question ${q + 1}`, 15_000)
      const revelee = attendre<any>(tele, 'session:view', p => p.sessionId === sessionId && p.view.phase === 'reveal' && p.view.qIndex === q, `révélation ${q + 1}`, 15_000)
      await emitAck(alice.socket, 'player:action', { sessionId, action: { type: 'answer', choice: 0 } })
      await emitAck(bob.socket, 'player:action', { sessionId, action: { type: 'answer', choice: 1 } })
      await revelee
      ;(tele as any).emit('host:command', { sessionId, command: { type: 'next' } })
    }
    await attendre<any>(tele, 'session:view', p => p.sessionId === sessionId && p.view.phase === 'finished', 'le podium', 15_000)
    ;(tele as any).emit('host:endSession', { sessionId })
    await patienter(500)

    // Le miroir accepte d'écrire, pas d'effacer : la première clôture échoue.
    sql(db => {
      db.exec('CREATE TABLE IF NOT EXISTS panne_miroir (operation TEXT PRIMARY KEY)')
      for (const table of TABLES_DU_MIROIR) {
        db.exec(
          `CREATE TRIGGER IF NOT EXISTS panne_${table}_delete BEFORE DELETE ON ${table}
           WHEN EXISTS (SELECT 1 FROM panne_miroir WHERE operation = 'DELETE')
           BEGIN SELECT RAISE(ABORT, 'panne simulée du miroir'); END`,
        )
      }
      db.prepare("INSERT OR IGNORE INTO panne_miroir (operation) VALUES ('DELETE')").run()
    })
    const refus = attendre<any>(tele, 'toast', () => true, 'le refus', 15_000)
    ;(tele as any).emit('host:closeParty', { title: 'Rejouée' })
    const t1 = await refus
    console.log('première clôture :', t1.kind, t1.message)
    assert.equal(t1.kind, 'error')

    // La panne levée, l'animateur réessaie, comme le message le lui dit.
    sql(db => db.prepare('DELETE FROM panne_miroir').run())
    const fin = attendre<any>(alice.socket, 'soiree:fin', () => true, 'la fin d’Alice', 15_000)
    const annonce = attendre<any>(tele, 'soiree:cloture', () => true, 'l’annonce de clôture', 15_000)
    ;(tele as any).emit('host:closeParty', { title: 'Rejouée' })
    const [f, a] = await Promise.all([fin, annonce])
    console.log('écran de clôture, hauts faits et montées :', JSON.stringify({ hautsFaits: a.hautsFaits, montees: a.montees }))
    let paliersEnBase: string[] = []
    sql(db => (paliersEnBase = db.prepare("SELECT badge FROM profile_badges WHERE badge GLOB 'hf:*:[123]'").all().map((r: any) => r.badge)))
    console.log('paliers rangés en base :', JSON.stringify(paliersEnBase))
    console.log('fin d’Alice :', JSON.stringify({ xp: f.profil?.xp, xpPaliers: f.profil?.xpPaliers, paliers: f.profil?.paliers?.map((p: any) => p.key) }))
    assert.deepEqual(
      f.profil?.paliers?.map((p: any) => p.key),
      ['hf:globe-trotteur:1'],
      'la fin de la clôture rejouée se tait sur le palier que la soirée a fait tomber',
    )
  } finally {
    await banc.close()
  }
})
