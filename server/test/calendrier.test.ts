// La suite ne dépend pas du jour où elle tourne.
//
// Une soirée se date à sa première question jouée, à l'horloge de la machine
// (`laureatsDeSaison`, `core/saisons.ts`) — une horloge que rien ne règle.
// Du 25 octobre au 1er novembre, du 20 au 26 décembre et du 30 décembre au
// 2 janvier, chaque soirée close à deux ouvrait donc son légendaire de
// saison, jusque dans les épreuves : `cloture.test.ts` attendait
// ['lg:chouette'] et recevait la Citrouille avec, `soiree.test.ts` comptait
// deux lauréats de trop. La CI de toutes les PR serait passée au rouge le
// 24 octobre 2026 à 22 h UTC, dix-neuf jours par an, sans que rien ait changé.
//
// Le banc ferme le calendrier des soirées, comme il neutralise l'Éclat ;
// `saisons.test.ts`, qui date ses soirées lui-même, le rouvre. Ici, une
// soirée redatée du soir d'Halloween — ce que ferait l'horloge le 31 octobre —
// ne doit rien ouvrir.
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
  type Socket,
} from './banc'
import { ProfileStore } from '../src/auth/profiles'
import { calendrierDesSoirees } from '../src/core/saisons'

ProfileStore.tirageEclat = () => false

test('sous le banc, le calendrier des soirées est fermé', () => {
  assert.equal(calendrierDesSoirees.periodeDu('2026-10-31'), null)
  assert.equal(calendrierDesSoirees.periodeDu('2026-12-24'), null)
  assert.equal(calendrierDesSoirees.periodeDu('2027-01-01'), null)
})

test('une soirée close le soir d’Halloween n’ouvre pas la Citrouille dans une épreuve', async () => {
  const banc = await demarrer()
  try {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [qcm('On y est ?')])
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    let host: Socket = await ecranCommun(banc.url, cookie)
    const salle = [await invite(banc.url, 'Alice', '', { cookie: alice }), await invite(banc.url, 'Bob', '🐻')]

    const vue = (sessionId: string, pred: (v: any) => boolean, label: string) =>
      attendre<any>(host, 'session:view', p => p.sessionId === sessionId && pred(p.view), label, 15_000)
    const sessionId = await lancerQuiz(host, quiz)
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

    // Le journal redaté du 31 octobre au soir, comme l'aurait daté l'horloge
    // de la machine ce jour-là ; relu au réveil, comme un disque retrouvé.
    host.close()
    const db = new Database(banc.dbPath)
    db.prepare('UPDATE answer_log SET created_at = ?').run(Date.UTC(2026, 9, 31, 20, 0))
    db.close()
    await banc.redemarrer()
    host = await ecranCommun(banc.url, cookie)
    const toast = attendre<any>(host, 'toast', () => true, 'la soirée close', 15_000)
    ;(host as any).emit('host:closeParty', {})
    assert.equal((await toast).kind, 'info')

    const moi = (await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: alice } })).json()) as any
    assert.ok(!moi.profile.legendaires.includes('lg:citrouille'), 'le calendrier des soirées est fermé : pas de Citrouille')
    const permanente = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true })
    try {
      const lignes = permanente.prepare(`SELECT COUNT(*) AS n FROM profile_badges WHERE badge LIKE 'saison:%'`).get() as { n: number }
      assert.equal(lignes.n, 0, 'aucune saison rangée')
    } finally {
      permanente.close()
    }
  } finally {
    await banc.close()
  }
})
