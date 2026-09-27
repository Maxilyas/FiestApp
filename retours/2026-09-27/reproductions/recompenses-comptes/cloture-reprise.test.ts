// Une clôture que le miroir refuse d'effacer a déjà TOUT crédité : hauts
// faits, paliers, légendaires, Divins. La soirée continue (invariant 18), et
// la clôture suivante recalcule « ce qui est neuf » en comparant à l'état du
// profil… qui contient déjà ce que la première tentative a écrit. Ce que la
// soirée a débloqué ne s'annonce alors plus : ni au téléphone, ni à la salle.
//
// Témoin : la même soirée, close du premier coup, annonce la Chouette.
//
// cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
//   ../export/evaluations/recompenses-comptes/cloture-reprise.test.ts
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
} from '../../../server/test/banc'
import { ProfileStore } from '../../../server/src/auth/profiles'

ProfileStore.tirageEclat = () => false

const RAPIDE = { reessaisMs: [40, 80, 160], alerteMs: 400, delaiExtinctionMs: 3000 }
const TABLES_DU_MIROIR = ['party_players', 'party_teams', 'party_bonus', 'party_answers', 'party_scores', 'party_sessions', 'party_soiree']
const permanente = (banc: Banc) => banc.quizDbUrl.replace(/^file:/, '')

/** Le miroir accepte d'écrire, mais refuse d'effacer — comme dans `miroir.test.ts`. */
function refuserLesEffacements(banc: Banc, refuse: boolean) {
  const db = new Database(permanente(banc))
  try {
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

async function cloreEtLire(host: Socket, alice: Invite) {
  const fin = attendre<any>(alice.socket, 'soiree:fin', () => true, 'la fin de soirée d’Alice', 20_000)
  const cloture = attendre<any>(host, 'soiree:cloture', () => true, 'la clôture de la salle', 20_000)
  const toast = attendre<any>(host, 'toast', () => true, 'la soirée close', 20_000)
  ;(host as any).emit('host:closeParty', {})
  const t = await toast
  assert.equal(t.kind, 'info', `la clôture a échoué : ${t.message}`)
  return { fin: await fin, cloture: await cloture }
}

/** Une soirée où Alice fait un Grand Chelem (huit QCM justes, salle de quatre) : la Chouette d'Argent tombe. */
async function soireeDuGrandChelem(banc: Banc) {
  const cookie = await connexionAnimateur(banc.url)
  const huit = await creerQuiz(banc.url, cookie, Array.from({ length: 8 }, (_, i) => qcm(`Question ${i + 1} ?`)), 'Huit')
  const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
  const host = await ecranCommun(banc.url, cookie)
  const alice = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
  const salle = [await invite(banc.url, 'Bob', '🐻'), await invite(banc.url, 'Dora', '🐙'), await invite(banc.url, 'Eve', '🐝')]
  await jouerQuiz(host, huit, Array.from({ length: 8 }, () => [[alice, 0] as [Invite, number], ...salle.map(i => [i, 1] as [Invite, number])]))
  await patienter(800)
  return { host, alice, aliceCookie }
}

const legendairesDe = async (banc: Banc, cookie: string) =>
  (((await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: cookie } })).json()) as any).profile.legendaires as string[])

test('témoin : close du premier coup, la soirée annonce la Chouette au téléphone et à la salle', async () => {
  const banc = await demarrer({ miroir: RAPIDE })
  try {
    const { host, alice } = await soireeDuGrandChelem(banc)
    const { fin, cloture } = await cloreEtLire(host, alice)
    assert.deepEqual(fin.profil.legendaires, ['lg:chouette'])
    assert.deepEqual(cloture.legendaires.map((l: any) => l.gagne), ['lg:chouette'])
  } finally {
    await banc.close()
  }
})

test('une clôture refusée par le miroir, puis reprise : la Chouette tombée à la première ne s’annonce plus', async () => {
  const banc = await demarrer({ miroir: RAPIDE })
  try {
    const { host, alice, aliceCookie } = await soireeDuGrandChelem(banc)

    // Le miroir refuse d'effacer : « Rien n'a été effacé », la soirée continue.
    refuserLesEffacements(banc, true)
    const refus = attendre<any>(host, 'toast', () => true, 'le refus', 20_000)
    ;(host as any).emit('host:closeParty', {})
    const t = await refus
    assert.equal(t.kind, 'error', `la première clôture devait échouer : ${t.message}`)
    assert.match(t.message, /^Rien n’a été effacé/)
    // … mais les crédits sont déjà écrits : la Chouette est à Alice.
    assert.deepEqual(await legendairesDe(banc, aliceCookie), ['lg:chouette'], 'la première tentative a tout crédité')

    // La panne levée, l'animateur reclôt : la fin de soirée est celle qu'on lit.
    refuserLesEffacements(banc, false)
    const { fin, cloture } = await cloreEtLire(host, alice)
    assert.deepEqual(
      fin.profil.legendaires,
      ['lg:chouette'],
      'la fin de soirée d’Alice doit annoncer la Chouette que cette soirée lui a ouverte',
    )
    assert.deepEqual(
      cloture.legendaires.map((l: any) => l.gagne),
      ['lg:chouette'],
      'la salle doit voir la Chouette tomber',
    )
  } finally {
    await banc.close()
  }
})

// Même cause, sans panne : deux écrans d'animateur (la télécommande et la
// console) qui cliquent « Clore » au même moment. Les deux clôtures lisent
// les mêmes journaux ; la seconde calcule « ce qui est neuf » après les
// crédits de la première, et c'est sa clôture — sans la Chouette — que la
// salle garde (`derniereCloture`, et la fin gardée d'un téléphone qui dormait).
test('deux « Clore » croisés : la dernière clôture reçue par la salle annonce encore la Chouette', async () => {
  const banc = await demarrer({ miroir: RAPIDE })
  try {
    const { host, alice } = await soireeDuGrandChelem(banc)
    const clotures: any[] = []
    host.on('soiree:cloture', (c: any) => clotures.push(c))
    const toasts: any[] = []
    host.on('toast', (t: any) => toasts.push(t))
    ;(host as any).emit('host:closeParty', {})
    ;(host as any).emit('host:closeParty', {})
    for (let i = 0; i < 100 && toasts.length < 2; i++) await patienter(100)
    await patienter(300)
    // Un téléphone qui dormait pendant la clôture se re-présente : il reçoit la fin gardée.
    const tel = (await import('../../../server/test/banc')).connecter(banc.url)
    await emitAck(tel, 'party:watch', { slug: 'banc' })
    const reveil = await emitAck<any>(tel, 'player:join', { slug: 'banc', token: alice.token })
    assert.deepEqual(
      {
        derniereClotureDeLaSalle: clotures.at(-1)?.legendaires.map((l: any) => l.gagne),
        finGardee: reveil.fin?.profil?.legendaires,
      },
      { derniereClotureDeLaSalle: ['lg:chouette'], finGardee: ['lg:chouette'] },
      `${clotures.length} clôture(s) reçue(s) par la salle ; toasts : ${toasts.map(t => t.kind).join(', ')}`,
    )
  } finally {
    await banc.close()
  }
})
