// La clôture efface le miroir, et la réponse de Turso se perd en route.
//
// `remettreAZero` (core/backup.ts) envoie l'effacement de la soirée au
// miroir ; au-delà de dix secondes, le client abandonne (`BaseMuette`) — mais
// la requête a pu aboutir chez Turso. Le code suppose alors que rien n'a
// bougé : l'écran commun lit « Rien n'a été effacé », la base locale garde la
// soirée, la file reprend. Or le miroir, lui, est vide, et rien ne le
// remplit de nouveau : aucune resynchronisation n'est demandée (l'échec de
// l'effacement ne passe pas par `echec()`). La soirée continue sur un miroir
// troué ; le prochain réveil sur disque effacé la rend amputée de tout ce
// qui s'était joué avant.
//
// La réponse perdue se simule en enveloppant le client libsql : le lot
// d'effacement s'exécute, puis l'appel lève `BaseMuette`, comme le ferait
// un `fetch` abandonné après que Turso a validé la transaction.
//
// Écrite pour passer le jour où c'est corrigé (après un effacement en échec,
// l'état du miroir est inconnu : une resynchronisation de l'espace).
//
//   cd server && nice -n 10 node --import tsx --test --test-timeout=120000 ../export/evaluations/persistance/miroir/effacement-perdu.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { Sqlite3Client } from '@libsql/client/sqlite3'
import {
  attendre,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  emitAck,
  invite,
  lancerQuiz,
  patienter,
  qcm,
  type Banc,
} from '../../../../server/test/banc'
import { BaseMuette } from '../../../../server/src/core/distante'

let reponsePerdue = false
const proto = Sqlite3Client.prototype as any
const batch = proto.batch
proto.batch = async function (stmts: any[], mode: unknown) {
  const premier = stmts?.[0]
  const sql = typeof premier === 'string' ? premier : premier?.sql
  const resultat = await batch.call(this, stmts, mode)
  if (reponsePerdue && typeof sql === 'string' && sql.startsWith('DELETE FROM party_players WHERE space_id')) {
    reponsePerdue = false
    throw new BaseMuette(10_000)
  }
  return resultat
}

const compter = (fichier: string, table: string) => {
  const db = new Database(fichier, { readonly: true, fileMustExist: true })
  try {
    return (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n
  } finally {
    db.close()
  }
}
const etat = (banc: Banc, local: boolean) => {
  const f = local ? banc.dbPath : banc.quizDbUrl.replace(/^file:/, '')
  return local
    ? { invites: compter(f, 'players'), gains: compter(f, 'score_entries'), reponses: compter(f, 'answer_log') }
    : { invites: compter(f, 'party_players'), gains: compter(f, 'party_scores'), reponses: compter(f, 'party_answers') }
}

test('un effacement du miroir dont la réponse se perd ne laisse pas la soirée continuer sur un miroir vide', async () => {
  const banc = await demarrer()
  try {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [qcm('Une ?', ['Oui', 'Non'], 0, 90), qcm('Deux ?', ['Oui', 'Non'], 0, 90)])
    const host = await ecranCommun(banc.url, cookie)
    const alice = await invite(banc.url, 'Alice', '🦊')
    const bob = await invite(banc.url, 'Bob', '🐻')
    const sessionId = await lancerQuiz(host, quiz)
    await attendre<any>(host, 'session:view', p => p.sessionId === sessionId && p.view.phase === 'question', 'Q1', 15_000)
    const revelee = attendre<any>(host, 'session:view', p => p.sessionId === sessionId && p.view.phase === 'reveal', 'la révélation', 15_000)
    for (const j of [alice, bob]) await emitAck(j.socket, 'player:action', { sessionId, action: { type: 'answer', choice: 0 } })
    await revelee
    await patienter(2500)

    // « Clore la soirée » : Turso efface, mais sa réponse n'arrive pas.
    reponsePerdue = true
    const toast = attendre<any>(host, 'toast', () => true, 'la clôture', 15_000)
    ;(host as any).emit('host:closeParty', { title: 'La soirée' })
    const t = await toast
    console.log('l’écran commun lit :', t)
    console.log('en local :', etat(banc, true), '— au miroir :', etat(banc, false))

    // On lui a dit que rien n'était effacé : la soirée continue.
    await invite(banc.url, 'Chloé', '🐼')
    await patienter(1500)
    const avantReveil = etat(banc, true)
    console.log('la soirée continue — en local :', avantReveil, '— au miroir :', etat(banc, false))

    // Le réveil suivant, disque effacé.
    await banc.redemarrer({ disqueEfface: true })
    const apresReveil = etat(banc, true)
    console.log('au réveil :', apresReveil)
    assert.deepEqual(apresReveil, avantReveil, 'le réveil rend la soirée entière que la salle jouait')
  } finally {
    reponsePerdue = false
    await banc.close()
  }
})
