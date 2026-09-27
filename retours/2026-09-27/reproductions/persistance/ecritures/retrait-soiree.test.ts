// « Retirer une soirée de l'historique » quand la base permanente hoquette
// au mauvais moment.
//
// La route (`api.ts`, DELETE /api/soirees/:id) efface d'abord l'archive, puis
// reprend aux profils ce que la soirée leur avait crédité
// (`retirerSoireeEntiere`) — deux écritures séparées. Si la seconde échoue
// (Turso muet dix secondes, un redéploiement), l'archive est déjà partie :
// l'animateur la voit disparaître de la liste, et un second essai répond
// « Soirée introuvable » sans jamais rien reprendre. L'expérience, les prix,
// les hauts faits et les paliers de la soirée restent aux profils — pour
// toujours : plus rien ne la désigne.
//
// La panne est simulée comme dans `server/test/miroir.test.ts` : un
// déclencheur RAISE(ABORT) dans le fichier `file:` qui tient lieu de Turso,
// armé le temps d'un essai.
//
// Écrite pour passer le jour où c'est corrigé : après un essai raté puis un
// second essai, soit l'archive est encore là (on peut réessayer), soit plus
// rien de la soirée ne reste aux profils.
//
//   cd server && nice -n 10 node --import tsx --test --test-timeout=120000 ../export/evaluations/persistance/ecritures/retrait-soiree.test.ts
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
  patienter,
  qcm,
  type Banc,
  type Invite,
  type Socket,
} from '../../../../server/test/banc'
import { ProfileStore } from '../../../../server/src/auth/profiles'

ProfileStore.tirageEclat = () => false

const permanente = (banc: Banc) => banc.quizDbUrl.replace(/^file:/, '')

function lire<T = any>(banc: Banc, sql: string, ...args: unknown[]): T[] {
  const db = new Database(permanente(banc), { readonly: true, fileMustExist: true })
  try {
    return db.prepare(sql).all(...args) as T[]
  } finally {
    db.close()
  }
}

/** Turso refuse d'effacer dans ces tables tant que la panne est armée. */
function panne(banc: Banc, tables: string[], armee: boolean) {
  const db = new Database(permanente(banc))
  try {
    db.exec('CREATE TABLE IF NOT EXISTS panne_temoin (armee INTEGER)')
    db.exec('DELETE FROM panne_temoin')
    if (armee) db.exec('INSERT INTO panne_temoin VALUES (1)')
    for (const t of tables) {
      db.exec(
        `CREATE TRIGGER IF NOT EXISTS panne_${t} BEFORE DELETE ON ${t}
         WHEN EXISTS (SELECT 1 FROM panne_temoin) BEGIN SELECT RAISE(ABORT, 'base permanente muette'); END`,
      )
    }
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

test('retirer une soirée de l’historique pendant un hoquet de la base : un second essai reprend tout aux profils', async () => {
  const banc = await demarrer()
  try {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, Array.from({ length: 6 }, (_, i) => qcm(`Question ${i + 1} ?`)))
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const brunoCookie = await inscrireProfil(banc.url, 'bruno', 'Bruno', '🐼')
    const host = await ecranCommun(banc.url, cookie)
    const alice = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    const bruno = await invite(banc.url, 'Bruno', '🐼', { cookie: brunoCookie })
    const eve = await invite(banc.url, 'Eve', '🐸')
    const fred = await invite(banc.url, 'Fred', '🐷')
    await jouerQuiz(
      host,
      quiz,
      Array.from({ length: 6 }, (_, q) => [
        [alice, 0],
        [bruno, q % 2],
        [eve, 1],
        [fred, q % 3 === 0 ? 0 : 1],
      ]),
    )
    await patienter(500)
    const toast = attendre<any>(host, 'toast', () => true, 'la clôture', 15_000)
    ;(host as any).emit('host:closeParty', { title: 'L’essai qu’on a oublié d’effacer' })
    assert.equal((await toast).kind, 'info')
    await patienter(300)

    const [soiree] = lire<{ id: string }>(banc, 'SELECT id FROM soirees')
    const credite = (id: string) => ({
      xp: lire(banc, 'SELECT profile_id, xp FROM profile_xp WHERE soiree_id = ?', id).length,
      badges: lire(banc, 'SELECT badge FROM profile_badges WHERE soiree_id = ?', id).length,
      totaux: lire<{ xp: number }>(banc, 'SELECT xp FROM profiles ORDER BY login').map(p => p.xp),
    })
    const avant = credite(soiree.id)
    console.log('crédité par la soirée :', avant)
    assert.ok(avant.xp === 2 && avant.totaux.every(x => x > 0), 'la soirée a crédité ses deux profils')

    // Premier essai : l'archive part, puis la base se tait pendant qu'on reprend aux profils.
    panne(banc, ['profile_xp', 'profile_badges', 'profile_eclats'], true)
    const premier = await ecrire(banc.url, `/api/soirees/${soiree.id}`, {}, cookie, 'DELETE')
    console.log('premier essai :', premier.status, await premier.text())
    panne(banc, [], false)

    // Second essai, la base revenue — ce que ferait l'animateur, s'il voyait encore la soirée.
    const second = await ecrire(banc.url, `/api/soirees/${soiree.id}`, {}, cookie, 'DELETE')
    console.log('second essai :', second.status, await second.text())

    const archiveLa = lire(banc, 'SELECT 1 FROM soirees WHERE id = ?', soiree.id).length > 0
    const reste = credite(soiree.id)
    console.log('archive encore là :', archiveLa, '— reste aux profils :', reste)
    assert.ok(
      archiveLa || (reste.xp === 0 && reste.badges === 0 && reste.totaux.every(x => x === 0)),
      `la soirée a disparu de l’historique, mais ses profils gardent ${reste.xp} ligne(s) d’expérience, ` +
        `${reste.badges} récompense(s) et leurs totaux ${JSON.stringify(reste.totaux)} — et plus rien ne permet de les reprendre`,
    )
  } finally {
    await banc.close()
  }
})

/** Turso refuse de réécrire le total d'un profil tant que la panne est armée. */
function panneDesTotaux(banc: Banc, armee: boolean) {
  const db = new Database(permanente(banc))
  try {
    db.exec('CREATE TABLE IF NOT EXISTS panne_totaux (armee INTEGER)')
    db.exec('DELETE FROM panne_totaux')
    if (armee) db.exec('INSERT INTO panne_totaux VALUES (1)')
    db.exec(
      `CREATE TRIGGER IF NOT EXISTS panne_profiles_xp BEFORE UPDATE OF xp ON profiles
       WHEN EXISTS (SELECT 1 FROM panne_totaux) BEGIN SELECT RAISE(ABORT, 'base permanente muette'); END`,
    )
  } finally {
    db.close()
  }
}

test('« C’était un essai » interrompu après l’effacement : le second clic ne recalcule plus le total, et l’écran dit « Rien n’a été effacé »', async () => {
  const banc = await demarrer()
  try {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, Array.from({ length: 5 }, (_, i) => qcm(`Question ${i + 1} ?`)))
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const host = await ecranCommun(banc.url, cookie)
    const alice = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    const eve = await invite(banc.url, 'Eve', '🐸')
    await jouerQuiz(host, quiz, Array.from({ length: 5 }, () => [[alice, 0], [eve, 1]] as [Invite, number][]))
    // Le podium crédite l'expérience du quiz (invariant 10).
    for (let i = 0; i < 50 && lire(banc, 'SELECT 1 FROM profile_xp').length === 0; i++) await patienter(100)
    const avant = lire<{ xp: number }>(banc, "SELECT xp FROM profiles WHERE login = 'alice'")[0].xp
    assert.ok(avant > 0, 'l’essai a crédité Alice')

    panneDesTotaux(banc, true)
    const premier = attendre<any>(host, 'toast', () => true, 'le premier essai', 15_000)
    ;(host as any).emit('host:discardParty')
    const t1 = await premier
    console.log('premier clic :', t1)
    const lignesApresPremier = lire(banc, "SELECT soiree_id FROM profile_xp WHERE profile_id = (SELECT id FROM profiles WHERE login = 'alice')")
    console.log('lignes d’expérience d’Alice après le premier clic :', lignesApresPremier)
    panneDesTotaux(banc, false)

    const second = attendre<any>(host, 'toast', () => true, 'le second essai', 15_000)
    ;(host as any).emit('host:discardParty')
    const t2 = await second
    console.log('second clic :', t2)
    const apres = lire<{ xp: number }>(banc, "SELECT xp FROM profiles WHERE login = 'alice'")[0].xp
    const somme = lire<{ s: number }>(banc, "SELECT COALESCE(SUM(xp), 0) AS s FROM profile_xp WHERE profile_id = (SELECT id FROM profiles WHERE login = 'alice')")[0].s
    console.log(`total d’Alice : ${avant} avant, ${apres} après ; somme de ses lignes : ${somme}`)
    assert.ok(
      !(t1.kind === 'error' && /Rien n’a été effacé/.test(t1.message) && lignesApresPremier.length === 0),
      '« Rien n’a été effacé » alors que l’expérience de l’essai l’a été',
    )
    assert.equal(apres, somme, 'le total d’Alice est la somme de ses lignes — l’essai effacé ne lui laisse rien')
  } finally {
    await banc.close()
  }
})
