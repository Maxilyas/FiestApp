// Invariant 20 : après un barème monté, `recalculerHistorique` remet à la
// version du jour les lignes qu'il ne relit pas — « sinon il relirait tout à
// chaque démarrage ». La ligne du quiz du jour (`#jour`) y passe par
// `json_set(detail, '$.v', ?)` : le nombre JS part lié en flottant (REAL,
// en local comme chez Turso, hrana `type: float`), et SQLite écrit
// `{"v":6.0,…}`. `aRecalculer` cherche `{"v":6,%` : la ligne reste « d'une
// version d'avant », et TOUT l'historique se relit à chaque démarrage —
// chaque réveil de l'hébergeur —, tant que le profil ne rejoue pas au quiz
// du jour.
//
// Latent aujourd'hui (les lignes `#jour` sont nées à la version 6) ; certain
// au prochain `VERSION_BAREME`.
//
// cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
//   ../export/evaluations/recompenses-comptes/recalcul-perpetuel.test.ts
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
} from '../../../server/test/banc'
import { ProfileStore, VERSION_BAREME } from '../../../server/src/auth/profiles'

ProfileStore.tirageEclat = () => false

const permanente = (banc: Banc) => banc.quizDbUrl.replace(/^file:/, '')

/** Redémarre, et rend ce que le serveur a écrit au journal pendant ce temps. */
async function redemarrer(banc: Banc): Promise<string[]> {
  const lignes: string[] = []
  const log = console.log
  console.log = (...a: unknown[]) => void lignes.push(a.map(String).join(' '))
  try {
    await banc.redemarrer()
  } finally {
    console.log = log
  }
  return lignes
}

test('après un barème monté, le démarrage suivant ne relit plus tout l’historique', async () => {
  const banc = await demarrer({ horlogeDuJour: () => Date.UTC(2026, 8, 26, 8, 0) })
  try {
    const cookie = await connexionAnimateur(banc.url)
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')

    // Une question du quiz du jour : Alice a sa ligne `#jour`.
    const etat = (await (await ecrire(banc.url, '/api/jour/commencer', {}, alice)).json()) as any
    await ecrire(banc.url, '/api/jour/repondre', { jour: etat.jour, index: 0, choix: 0 }, alice)

    // Une soirée close : une archive, que chaque recalcul relit.
    const quiz = await creerQuiz(banc.url, cookie, [qcm('On y est ?')])
    const host = await ecranCommun(banc.url, cookie)
    const a = await invite(banc.url, 'Alice', '', { cookie: alice })
    const b = await invite(banc.url, 'Bob', '🐻')
    const vue = (sessionId: string, pred: (v: any) => boolean, label: string) =>
      attendre<any>(host, 'session:view', p => p.sessionId === sessionId && pred(p.view), label, 15_000)
    const sessionId = await lancerQuiz(host, quiz)
    await vue(sessionId, v => v.phase === 'question', 'la question')
    const revelee = vue(sessionId, v => v.phase === 'reveal', 'la révélation')
    for (const qui of [a, b]) await emitAck(qui.socket, 'player:action', { sessionId, action: { type: 'answer', choice: 0 } })
    await revelee
    ;(host as any).emit('host:endSession', { sessionId })
    const close = attendre<any>(host, 'toast', () => true, 'la soirée close', 15_000)
    ;(host as any).emit('host:closeParty', {})
    assert.equal((await close).kind, 'info')
    host.close()

    // Le barème monte : toutes les lignes sont d'une version d'avant.
    const db = new Database(permanente(banc))
    db.prepare(`UPDATE profile_xp SET detail = json_set(detail, '$.v', ${VERSION_BAREME - 1})`).run()
    db.close()

    const premier = await redemarrer(banc)
    assert.ok(premier.some(l => l.includes('expérience recalculée')), 'le premier démarrage relit l’historique')

    const lu = new Database(permanente(banc), { readonly: true })
    const jour = lu.prepare(`SELECT detail FROM profile_xp WHERE soiree_id = '#jour'`).get() as { detail: string }
    lu.close()

    const second = await redemarrer(banc)
    const relu = second.filter(l => l.includes('expérience recalculée'))
    assert.deepEqual(
      { ligneDuJour: jour.detail.startsWith(`{"v":${VERSION_BAREME},`), recalculAuSecondDemarrage: relu },
      { ligneDuJour: true, recalculAuSecondDemarrage: [] },
      `la ligne du quiz du jour lit ${jour.detail} : le démarrage suivant relit tout l’historique`,
    )
  } finally {
    await banc.close()
  }
})
