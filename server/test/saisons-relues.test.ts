// Les saisons d'une soirée déjà rangée se relisent : `VERSION_BAREME` 7.
//
// #59 a ajouté une récompense tirée des journaux d'une soirée — la saison,
// promise « à la clôture comme au recalcul » — sans monter `VERSION_BAREME`
// (invariant 20 ; les Divins l'avaient monté à 4 pour la même raison). Une
// soirée jouée le soir d'Halloween et close avant #59 n'ouvrait donc jamais
// sa Citrouille, jusqu'au prochain changement de barème, qui l'aurait fait
// tomber d'un coup, sans que personne sache pourquoi. Monté à 7, il relit
// l'historique une fois, au démarrage qui apporte les saisons.
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
} from './banc'
import { ProfileStore } from '../src/auth/profiles'
import { calendrierDesSoirees } from '../src/core/saisons'
import { periodeDu } from '../../shared/saisons'

ProfileStore.tirageEclat = () => false
// Ce fichier date lui-même ses soirées : il rouvre le calendrier que le banc ferme.
calendrierDesSoirees.periodeDu = periodeDu

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

test('une soirée d’Halloween close avant les saisons ouvre la Citrouille au démarrage qui les apporte (invariant 20)', async () => {
  const banc = await demarrer()
  try {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [qcm('On y est ?')])
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    let host = await ecranCommun(banc.url, cookie)
    const salle = [await invite(banc.url, 'Alice', '', { cookie: alice }), await invite(banc.url, 'Bob', '🐻')]
    await jouerUneQuestion(host, quiz, salle)
    host.close()
    // Jouée le soir d'Halloween 2025.
    const locale = new Database(banc.dbPath)
    locale.prepare('UPDATE answer_log SET created_at = ?').run(Date.UTC(2025, 9, 31, 20, 0))
    locale.close()
    await banc.redemarrer()
    host = await ecranCommun(banc.url, cookie)
    const toast = attendre<any>(host, 'toast', () => true, 'la soirée close', 15_000)
    ;(host as any).emit('host:closeParty', {})
    await toast
    host.close()
    // Ce qu'un serveur d'avant les saisons en aurait gardé : aucune ligne de
    // saison, et ses lignes d'expérience au barème d'alors.
    assert.ok((await lire(banc, alice, '/api/joueur/moi')).profile.legendaires.includes('lg:citrouille'), 'témoin : la clôture la range')
    base(banc, d => {
      d.prepare(`DELETE FROM profile_badges WHERE badge LIKE 'saison:%'`).run()
      d.prepare(`UPDATE profile_xp SET detail = json_set(detail, '$.v', 6) WHERE soiree_id NOT LIKE '#%'`).run()
    })

    // Le démarrage qui apporte les saisons relit l'historique.
    await banc.redemarrer()
    const moi = (await lire(banc, alice, '/api/joueur/moi')).profile
    assert.ok(moi.legendaires.includes('lg:citrouille'), `légendaires = ${JSON.stringify(moi.legendaires)}`)
  } finally {
    await banc.close()
  }
})
