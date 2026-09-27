// Une clôture refusée par le miroir, puis reprise, raconte la même soirée.
//
// La clôture crédite avant d'effacer : quand le miroir refuse d'effacer,
// l'animateur lit « Rien n'a été effacé — réessaie », la soirée continue
// (invariant 18)… mais ses hauts faits, ses paliers, ses légendaires sont
// déjà rangés. La clôture reprise comparait « ce qui est neuf » à un profil
// qui avait déjà tout : la fin de chaque téléphone et l'écran de clôture se
// taisaient sur la Chouette, sur le palier et sur le niveau qu'ils avaient
// fait gagner. Ce qu'on raconte se relit désormais en base, sous le nom de
// la soirée (`rangesSousLaSoiree`, `avantLaSoiree`).
//
// Chaque test a son propre serveur jetable.
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
} from './banc'
import { ProfileStore, VERSION_BAREME } from '../src/auth/profiles'
import { gainVide, niveauPour, releveVide, totalGain } from '../../shared/profil'

ProfileStore.tirageEclat = () => false

const RAPIDE = { reessaisMs: [40, 80, 160], alerteMs: 400, delaiExtinctionMs: 3000 }
const TABLES_DU_MIROIR = ['party_players', 'party_teams', 'party_bonus', 'party_answers', 'party_scores', 'party_sessions', 'party_soiree']

function avecLaBase(banc: Banc, fn: (db: Database.Database) => void) {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    fn(db)
  } finally {
    db.close()
  }
}

/** Le miroir accepte d'écrire, mais refuse d'effacer — comme dans `miroir.test.ts`. */
function refuserLesEffacements(banc: Banc, refuse: boolean) {
  avecLaBase(banc, db => {
    db.exec('CREATE TABLE IF NOT EXISTS panne_miroir (operation TEXT PRIMARY KEY)')
    for (const table of TABLES_DU_MIROIR) {
      db.exec(
        `CREATE TRIGGER IF NOT EXISTS panne_${table}_delete BEFORE DELETE ON ${table}
         WHEN EXISTS (SELECT 1 FROM panne_miroir WHERE operation = 'DELETE')
         BEGIN SELECT RAISE(ABORT, 'panne simulée du miroir'); END`,
      )
    }
    if (refuse) db.prepare("INSERT OR IGNORE INTO panne_miroir (operation) VALUES ('DELETE')").run()
    else db.prepare('DELETE FROM panne_miroir').run()
  })
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

/**
 * Ce qu'Alice a gagné chez l'autre hôte : huit réponses, dans une salle —
 * jouée seul, cette soirée ne compterait pas pour la carrière, ni donc pour
 * Le Globe-trotteur.
 */
const AILLEURS = { ...gainVide(), reponses: 8 }

/**
 * Alice a déjà joué chez un autre hôte — « Le Globe-trotteur » tombera ce
 * soir, un palier — et fait un Grand Chelem dans une salle de quatre : la
 * Chouette d'Argent tombe aussi.
 */
async function soireeDuGrandChelem(banc: Banc) {
  const cookie = await connexionAnimateur(banc.url)
  const huit = await creerQuiz(banc.url, cookie, Array.from({ length: 8 }, (_, i) => qcm(`Question ${i + 1} ?`)), 'Huit')
  const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
  avecLaBase(banc, db => {
    const id = (db.prepare('SELECT id FROM profiles WHERE login = ?').get('alice') as { id: string }).id
    db.prepare(
      `INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, 'une-soiree-ailleurs', 'un-autre-hote', ?, ?, ?)`,
    ).run(id, totalGain(AILLEURS), JSON.stringify({ v: VERSION_BAREME, gain: AILLEURS, releve: releveVide() }), Date.now() - 86_400_000)
  })
  const host = await ecranCommun(banc.url, cookie)
  const alice = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
  const salle = [await invite(banc.url, 'Bob', '🐻'), await invite(banc.url, 'Dora', '🐙'), await invite(banc.url, 'Eve', '🐝')]
  await jouerQuiz(
    host,
    huit,
    Array.from({ length: 8 }, () => [[alice, 0] as [Invite, number], ...salle.map(i => [i, 1] as [Invite, number])]),
  )
  await patienter(800)
  return { host, alice }
}

async function cloreEtLire(host: Socket, alice: Invite) {
  const fin = attendre<any>(alice.socket, 'soiree:fin', () => true, 'la fin de soirée d’Alice', 20_000)
  const cloture = attendre<any>(host, 'soiree:cloture', () => true, 'la clôture de la salle', 20_000)
  const toast = attendre<any>(host, 'toast', () => true, 'la soirée close', 20_000)
  ;(host as any).emit('host:closeParty', {})
  const t = await toast
  assert.equal(t.kind, 'info', `la clôture a échoué : ${t.message}`)
  return { fin: await fin, cloture: await cloture }
}

/** Ce que la fin raconte de ce que la soirée a rapporté. */
const recit = (fin: any) => ({
  paliers: (fin.profil.paliers as { key: string }[]).map(p => p.key),
  legendaires: fin.profil.legendaires as string[],
})

test('témoin : close du premier coup, la soirée annonce la Chouette et le palier', async () => {
  const banc = await demarrer({ miroir: RAPIDE })
  try {
    const { host, alice } = await soireeDuGrandChelem(banc)
    const { fin, cloture } = await cloreEtLire(host, alice)
    assert.deepEqual(fin.profil.legendaires, ['lg:chouette'])
    assert.deepEqual(fin.profil.paliers.map((p: any) => p.key), ['hf:globe-trotteur:1'])
    assert.ok(fin.profil.xpPaliers > 0)
    assert.deepEqual(cloture.legendaires.map((l: any) => l.gagne), ['lg:chouette'])
  } finally {
    await banc.close()
  }
})

test('refusée par le miroir puis reprise : la clôture raconte encore la Chouette, le palier et le niveau', async () => {
  const banc = await demarrer({ miroir: RAPIDE })
  try {
    const { host, alice } = await soireeDuGrandChelem(banc)

    // Le miroir refuse d'effacer : « Rien n'a été effacé », la soirée continue…
    refuserLesEffacements(banc, true)
    const refus = attendre<any>(host, 'toast', () => true, 'le refus', 20_000)
    ;(host as any).emit('host:closeParty', {})
    const t = await refus
    assert.equal(t.kind, 'error', `la première clôture devait échouer : ${t.message}`)
    assert.match(t.message, /^Rien n’a été effacé/)
    // … mais la première tentative a déjà tout rangé.
    avecLaBase(banc, db => {
      const paliers = db.prepare("SELECT badge FROM profile_badges WHERE badge GLOB 'hf:*:[123]'").all() as { badge: string }[]
      assert.deepEqual(paliers.map(p => p.badge), ['hf:globe-trotteur:1'])
    })

    // La panne levée, l'animateur reclôt : la fin est celle d'une clôture
    // du premier coup.
    refuserLesEffacements(banc, false)
    const { fin, cloture } = await cloreEtLire(host, alice)
    assert.deepEqual(recit(fin).legendaires, ['lg:chouette'], 'la Chouette que la soirée a ouverte')
    assert.deepEqual(recit(fin).paliers, ['hf:globe-trotteur:1'], 'le palier qu’elle a fait tomber')
    assert.deepEqual(cloture.legendaires.map((l: any) => l.gagne), ['lg:chouette'], 'la salle voit la Chouette tomber')
    // L'expérience racontée est celle de la soirée, palier compris, et le
    // niveau d'avant est celui d'avant la soirée — pas celui que la première
    // tentative avait déjà donné.
    let lignes: { soiree_id: string; xp: number }[] = []
    avecLaBase(banc, db => {
      lignes = db.prepare("SELECT soiree_id, xp FROM profile_xp WHERE soiree_id <> 'une-soiree-ailleurs'").all() as typeof lignes
    })
    const ceSoir = lignes.find(l => !l.soiree_id.startsWith('#'))!.xp
    const desPaliers = lignes.find(l => l.soiree_id === '#paliers')!.xp
    assert.ok(desPaliers > 0)
    assert.equal(fin.profil.xpPaliers, desPaliers)
    assert.equal(fin.profil.xp, ceSoir + desPaliers)
    assert.equal(fin.profil.niveauAvant, niveauPour(totalGain(AILLEURS)))
  } finally {
    await banc.close()
  }
})
