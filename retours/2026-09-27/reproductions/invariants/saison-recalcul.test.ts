// Invariant 20 (CLAUDE.md) : « quand le barème ou un haut fait change,
// incrémente VERSION_BAREME — au démarrage, recalculerHistorique relit toutes
// les soirées de l'historique avec les règles du jour ».
//
// #59 a ajouté une récompense tirée des journaux d'une soirée : la saison
// (`laureatsDeSaison`, « à la clôture comme au recalcul »). VERSION_BAREME est
// resté à 6 : le recalcul ne relit donc jamais les soirées déjà rangées. Une
// soirée jouée le soir d'Halloween et close avant #59 n'ouvre pas la
// Citrouille — jusqu'au jour où un autre changement montera VERSION_BAREME,
// et la fera tomber d'un coup, sans que personne sache pourquoi.
//
// Le premier test échoue sur le code d'aujourd'hui ; il passera quand les
// soirées d'avant la saison seront relues (VERSION_BAREME 7, ou une relecture
// à drapeau dans `meta`). Le second montre que la récompense n'est que
// différée : il passe aujourd'hui.
//
//   cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/invariants/saison-recalcul.test.ts
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
  qcm,
  type Banc,
  type Invite,
  type Socket,
} from '../../../server/test/banc'
import { ProfileStore } from '../../../server/src/auth/profiles'

ProfileStore.tirageEclat = () => false

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => (await r.json()) as any)

function base<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

/** Un quiz d'une question, que tous les invités jouent, puis que l'écran commun termine (comme `saisons.test.ts`). */
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

/**
 * Une soirée jouée le soir d'Halloween 2025, close, puis ramenée à ce qu'un
 * serveur d'avant #59 en aurait gardé : aucune ligne de saison, et ses
 * lignes d'expérience au barème 6 — celui que #59 a livré.
 */
async function soireeDHalloweenDAvant(): Promise<{ banc: Banc; alice: string }> {
  const banc = await demarrer()
  const cookie = await connexionAnimateur(banc.url)
  const quiz = await creerQuiz(banc.url, cookie, [qcm('On y est ?')])
  const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
  let host = await ecranCommun(banc.url, cookie)
  const salle = [await invite(banc.url, 'Alice', '', { cookie: alice }), await invite(banc.url, 'Bob', '🐻')]
  await jouerUneQuestion(host, quiz, salle)
  host.close()
  const db = new Database(banc.dbPath)
  db.prepare('UPDATE answer_log SET created_at = ?').run(Date.UTC(2025, 9, 31, 20, 0))
  db.close()
  await banc.redemarrer()
  host = await ecranCommun(banc.url, cookie)
  const toast = attendre<any>(host, 'toast', () => true, 'la soirée close', 15_000)
  ;(host as any).emit('host:closeParty', {})
  await toast
  host.close()
  // Le serveur de #59 range la Citrouille à la clôture : on vérifie qu'elle y
  // est, puis on la retire — c'est l'état d'une soirée close avant #59.
  const avant = (await lire(banc, alice, '/api/joueur/moi')).profile
  assert.ok(avant.legendaires.includes('lg:citrouille'), 'témoin : la clôture de #59 la range bien')
  base(banc, d => {
    d.prepare(`DELETE FROM profile_badges WHERE badge LIKE 'saison:%'`).run()
    d.prepare(`UPDATE profile_xp SET detail = json_set(detail, '$.v', 6) WHERE soiree_id NOT LIKE '#%'`).run()
  })
  await banc.redemarrer()
  return { banc, alice }
}

test('une soirée d’Halloween close avant #59 ouvre la Citrouille au démarrage qui apporte les saisons (invariant 20)', async () => {
  const { banc, alice } = await soireeDHalloweenDAvant()
  try {
    const moi = (await lire(banc, alice, '/api/joueur/moi')).profile
    const lignes = base(banc, d => d.prepare(`SELECT count(*) AS n FROM profile_badges WHERE badge = 'saison:halloween'`).get()) as { n: number }
    assert.ok(
      moi.legendaires.includes('lg:citrouille'),
      `la soirée du 31 octobre 2025 est dans l’historique, mais le recalcul ne l’a pas relue ` +
        `(VERSION_BAREME inchangé) : ${lignes.n} ligne de saison, légendaires = ${JSON.stringify(moi.legendaires)}`,
    )
  } finally {
    await banc.close()
  }
})

test('témoin : la Citrouille n’est que différée — le prochain barème la fera tomber, sans lien avec lui', async () => {
  const { banc, alice } = await soireeDHalloweenDAvant()
  try {
    // N'importe quel changement futur du barème (ici simulé : les lignes
    // redescendent d'une version) relit l'historique…
    base(banc, d => d.prepare(`UPDATE profile_xp SET detail = json_set(detail, '$.v', 5) WHERE soiree_id NOT LIKE '#%'`).run())
    await banc.redemarrer()
    // … et la Citrouille d'il y a un an tombe à ce moment-là.
    const moi = (await lire(banc, alice, '/api/joueur/moi')).profile
    assert.ok(moi.legendaires.includes('lg:citrouille'), 'le recalcul, lui, sait la décerner')
  } finally {
    await banc.close()
  }
})
