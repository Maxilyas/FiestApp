// Deux instances sur le même miroir : le déploiement « sans coupure ».
//
// Un service web sans disque persistant, avec un `healthCheckPath`
// (render.yaml), se redéploie chez Render en démarrant la NOUVELLE instance
// pendant que l'ANCIENNE sert encore — elle ne reçoit son SIGTERM qu'une fois
// la nouvelle jugée en bonne santé. Le code, lui, suppose l'inverse
// (« l'hébergeur prévient avant de redémarrer : on laisse partir les
// dernières écritures », index.ts) : la nouvelle instance recharge le miroir
// à son démarrage (`restoreInto`), puis l'ancienne continue la soirée et y
// écrit encore — révélations, gains, réponses, arrivées —, et s'y vide en
// s'éteignant. La nouvelle, elle, reprend la partie telle qu'elle l'avait
// lue, et écrit à son tour. Rien ne sépare les deux écritures : le miroir
// garde les gains et les réponses des deux.
//
// Au réveil suivant sur disque effacé (le lendemain, ou un redémarrage),
// tout revient : la question révélée des deux côtés est payée deux fois, le
// journal a deux réponses du même invité à la même question, et l'invitée
// arrivée chez l'ancienne instance réapparaît dans une salle qui ne l'a
// jamais vue.
//
// Les trois serveurs tournent ici dans le même processus, chacun sur sa base
// locale, tous sur le même fichier `file:` qui tient lieu de Turso.
//
// Écrite pour passer le jour où c'est corrigé (un bail sur le miroir, que
// la nouvelle instance prend et qui fait refuser ses écritures à l'ancienne).
//
//   cd server && nice -n 10 node --import tsx --test --test-timeout=120000 ../export/evaluations/persistance/miroir/deux-instances.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { createQuizServer } from '../../../../server/src/server'
import { ProfileStore } from '../../../../server/src/auth/profiles'
import {
  ADMIN,
  attendre,
  connecter,
  connexionAnimateur,
  creerQuiz,
  emitAck,
  fermerTout,
  invite,
  lancerQuiz,
  patienter,
  qcm,
  type Invite,
  type Socket,
} from '../outils'

ProfileStore.tirageEclat = () => false

const dir = path.join(import.meta.dirname, 'deux-instances')
const quizDbUrl = `file:${path.join(dir, 'permanente.db')}`
const lancer = (nom: string) => createQuizServer({ port: 0, dbPath: path.join(dir, `${nom}.db`), quizDbUrl, admin: ADMIN })

function lire<T = any>(fichier: string, sql: string, ...args: unknown[]): T[] {
  const db = new Database(fichier, { readonly: true, fileMustExist: true })
  try {
    return db.prepare(sql).all(...args) as T[]
  } finally {
    db.close()
  }
}

async function hote(url: string, cookie: string, sessionId?: string): Promise<{ host: Socket; vue?: any }> {
  const host = connecter(url, cookie)
  const vue = sessionId ? attendre<any>(host, 'session:view', p => p.sessionId === sessionId, 'la partie', 15_000) : null
  const hello = await emitAck<any>(host, 'host:hello', {})
  assert.equal(hello.ok, true)
  return { host, vue: vue ? (await vue).view : undefined }
}

async function repondreEtReveler(host: Socket, sessionId: string, qIndex: number, joueurs: Invite[]) {
  const revelee = attendre<any>(host, 'session:view', p => p.sessionId === sessionId && p.view.phase === 'reveal' && p.view.qIndex === qIndex, `révélation ${qIndex + 1}`, 15_000)
  for (const j of joueurs) {
    const ack = await emitAck<any>(j.socket, 'player:action', { sessionId, action: { type: 'answer', choice: 0 } })
    assert.equal(ack.ok, true, `${j.playerId} : ${ack.error}`)
  }
  await revelee
}

test('pendant un déploiement sans coupure, l’ancienne et la nouvelle instance ne dédoublent pas la soirée au miroir', async () => {
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })

  // ── L'ancienne instance sert la soirée ─────────────────────────────────
  const ancienne = await lancer('ancienne')
  const urlA = `http://localhost:${ancienne.port}`
  const cookie = await connexionAnimateur(urlA)
  const quiz = await creerQuiz(urlA, cookie, [1, 2, 3, 4].map(i => qcm(`Question ${i} ?`, ['Oui', 'Non'], 0, 90)))
  const { host: hoteA } = await hote(urlA, cookie)
  const salle = [await invite(urlA, 'Alice', '🦊'), await invite(urlA, 'Bob', '🐻'), await invite(urlA, 'Chloé', '🐼')]
  const sessionId = await lancerQuiz(hoteA, quiz)
  await attendre<any>(hoteA, 'session:view', p => p.sessionId === sessionId && p.view.phase === 'question' && p.view.qIndex === 0, 'Q1', 15_000)
  await repondreEtReveler(hoteA, sessionId, 0, salle)
  const q2 = attendre<any>(hoteA, 'session:view', p => p.sessionId === sessionId && p.view.phase === 'question' && p.view.qIndex === 1, 'Q2', 15_000)
  ;(hoteA as any).emit('host:command', { sessionId, command: { type: 'next' } })
  await q2
  await patienter(2500) // le miroir a suivi

  // ── La nouvelle démarre à côté, disque neuf : elle recharge le miroir ───
  const nouvelle = await lancer('nouvelle')
  const urlB = `http://localhost:${nouvelle.port}`

  // L'ancienne sert encore, le temps que la nouvelle soit jugée en bonne santé :
  // la question 2 se joue et se révèle chez elle, et Dora arrive.
  await repondreEtReveler(hoteA, sessionId, 1, salle)
  await invite(urlA, 'Dora', '🐸')
  await patienter(300)
  // Le trafic bascule ; l'ancienne reçoit son SIGTERM et vide sa file au miroir.
  fermerTout()
  await ancienne.close()

  // ── Les téléphones se reconnectent à la nouvelle ───────────────────────
  const { host: hoteB, vue } = await hote(urlB, cookie, sessionId)
  console.log(`la nouvelle instance reprend en phase ${vue.phase}, question ${vue.qIndex + 1}`)
  const salleB: Invite[] = []
  for (const j of salle) salleB.push(await invite(urlB, j.nom, '🎉', { token: j.token }))
  if (vue.phase === 'question' && vue.qIndex === 1) await repondreEtReveler(hoteB, sessionId, 1, salleB)
  await patienter(2500)
  const totauxB = lire<{ player_id: string; total: number }>(path.join(dir, 'nouvelle.db'), 'SELECT player_id, SUM(points) AS total FROM score_entries GROUP BY player_id ORDER BY player_id')
  fermerTout()
  await nouvelle.close()

  // ── Le réveil suivant, disque effacé : tout revient du miroir ──────────
  const reveil = await lancer('reveil')
  try {
    const local = path.join(dir, 'reveil.db')
    const invites = lire<{ name: string }>(local, 'SELECT name FROM players ORDER BY created_at').map(p => p.name)
    const doublons = lire<{ player_id: string; q_index: number; n: number }>(
      local,
      'SELECT player_id, q_index, COUNT(*) AS n FROM answer_log WHERE session_id = ? GROUP BY player_id, q_index HAVING n > 1',
      sessionId,
    )
    const totaux = lire<{ player_id: string; total: number }>(local, 'SELECT player_id, SUM(points) AS total FROM score_entries GROUP BY player_id ORDER BY player_id')
    console.log('invités au réveil :', invites)
    console.log('totaux chez la nouvelle instance :', totauxB)
    console.log('totaux au réveil :', totaux)
    console.log('réponses en double au journal :', doublons)
    assert.deepEqual(doublons, [], 'une seule réponse par invité et par question')
    assert.deepEqual(totaux, totauxB, 'le réveil rend les points que la salle avait, pas davantage')
    assert.ok(!invites.includes('Dora'), 'l’invitée arrivée chez l’ancienne instance ne réapparaît pas dans une salle qui ne l’a jamais vue')
  } finally {
    fermerTout()
    await reveil.close()
  }
})
