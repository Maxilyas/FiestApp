// Reprendre ce qu'une soirée avait crédité, même quand la base hoquette.
//
// « Retirer une soirée de l'historique » effaçait l'archive, puis reprenait
// aux profils ce que la soirée leur avait crédité : si la seconde écriture
// échouait, l'archive était partie, un second essai répondait « Soirée
// introuvable », et l'expérience, les prix, les hauts faits et les paliers
// restaient aux profils pour toujours. « C'était un essai » interrompu après
// l'effacement, lui, ne recalculait plus le total au second clic. Et un
// invité à profil exclu pendant un hoquet gardait l'expérience de la
// soirée : rien ne rejouait ce qu'il devait rendre (invariant 10).
//
// La panne est un déclencheur `RAISE(ABORT)` dans le fichier `file:` qui
// tient lieu de Turso, armé le temps d'un essai (`miroir.test.ts`).
//
// Chaque test a son propre serveur jetable.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import {
  attendre,
  connexionAnimateur,
  cookieDe,
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
} from './banc'
import { ProfileStore } from '../src/auth/profiles'

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

/** Turso refuse ces écritures tant que la panne est armée. */
function panne(banc: Banc, declencheurs: Record<string, string>, armee: boolean) {
  const db = new Database(permanente(banc))
  try {
    db.exec('CREATE TABLE IF NOT EXISTS panne_temoin (armee INTEGER)')
    db.exec('DELETE FROM panne_temoin')
    if (armee) db.exec('INSERT INTO panne_temoin VALUES (1)')
    for (const [nom, quand] of Object.entries(declencheurs)) {
      db.exec(
        `CREATE TRIGGER IF NOT EXISTS panne_${nom} ${quand}
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

test('retirer une soirée pendant un hoquet : l’archive reste, et un second essai reprend tout aux profils', async () => {
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
    const credite = () => ({
      xp: lire(banc, 'SELECT 1 FROM profile_xp WHERE soiree_id = ?', soiree.id).length,
      badges: lire(banc, 'SELECT 1 FROM profile_badges WHERE soiree_id = ?', soiree.id).length,
      totaux: lire<{ xp: number }>(banc, 'SELECT xp FROM profiles ORDER BY login').map(p => p.xp),
    })
    const avant = credite()
    assert.ok(avant.xp === 2 && avant.totaux.every(x => x > 0), `la soirée a crédité ses deux profils : ${JSON.stringify(avant)}`)

    // Premier essai : la base se tait pendant qu'on reprend aux profils.
    const effacements = {
      profile_xp: 'BEFORE DELETE ON profile_xp',
      profile_badges: 'BEFORE DELETE ON profile_badges',
      profile_eclats: 'BEFORE DELETE ON profile_eclats',
    }
    panne(banc, effacements, true)
    const premier = await ecrire(banc.url, `/api/soirees/${soiree.id}`, {}, cookie, 'DELETE')
    assert.equal(premier.status, 500)
    panne(banc, {}, false)
    // Rien n'a bougé : l'archive est là, les profils gardent tout — on peut réessayer.
    assert.equal(lire(banc, 'SELECT 1 FROM soirees WHERE id = ?', soiree.id).length, 1, 'l’archive est encore là')
    assert.deepEqual(credite(), avant)

    // Second essai, la base revenue : tout part.
    const second = await ecrire(banc.url, `/api/soirees/${soiree.id}`, {}, cookie, 'DELETE')
    assert.equal(second.status, 200)
    assert.equal(lire(banc, 'SELECT 1 FROM soirees WHERE id = ?', soiree.id).length, 0)
    assert.deepEqual(credite(), { xp: 0, badges: 0, totaux: [0, 0] })
  } finally {
    await banc.close()
  }
})

test('« C’était un essai » interrompu : rien n’est effacé à moitié, et le second clic reprend tout', async () => {
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

    // La base refuse de réécrire le total : le premier clic échoue…
    panne(banc, { profiles_xp: 'BEFORE UPDATE OF xp ON profiles' }, true)
    const premier = attendre<any>(host, 'toast', () => true, 'le premier essai', 15_000)
    ;(host as any).emit('host:discardParty')
    assert.equal((await premier).kind, 'error')
    panne(banc, {}, false)
    // … sans rien avoir effacé à moitié : la ligne et le total vont ensemble.
    const lignes = lire(banc, "SELECT 1 FROM profile_xp WHERE profile_id = (SELECT id FROM profiles WHERE login = 'alice')")
    assert.equal(lignes.length, 1, 'la ligne d’expérience est encore là, avec son total')
    assert.equal(lire<{ xp: number }>(banc, "SELECT xp FROM profiles WHERE login = 'alice'")[0].xp, avant)

    const second = attendre<any>(host, 'toast', () => true, 'le second essai', 15_000)
    ;(host as any).emit('host:discardParty')
    assert.deepEqual(await second, { kind: 'info', message: 'Essai effacé — rien n’a été gardé' })
    assert.equal(lire<{ xp: number }>(banc, "SELECT xp FROM profiles WHERE login = 'alice'")[0].xp, 0)
  } finally {
    await banc.close()
  }
})

test('un invité à profil exclu pendant un hoquet rend l’expérience de la soirée à la clôture', async () => {
  const banc = await demarrer()
  try {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, Array.from({ length: 5 }, (_, i) => qcm(`Question ${i + 1} ?`)))
    const malikCookie = await inscrireProfil(banc.url, 'malik', 'Malik', '🦊')
    const noraCookie = await inscrireProfil(banc.url, 'nora', 'Nora', '🐼')
    const host = await ecranCommun(banc.url, cookie)
    const malik = await invite(banc.url, 'Malik', '🦊', { cookie: malikCookie })
    const nora = await invite(banc.url, 'Nora', '🐼', { cookie: noraCookie })
    const eve = await invite(banc.url, 'Eve', '🐸')
    await jouerQuiz(host, quiz, Array.from({ length: 5 }, () => [[malik, 0], [nora, 1], [eve, 1]] as [Invite, number][]))
    const deMalik = () =>
      lire<{ soiree_id: string; xp: number }>(banc, "SELECT soiree_id, xp FROM profile_xp WHERE profile_id = (SELECT id FROM profiles WHERE login = 'malik')")
    for (let i = 0; i < 50 && deMalik().length === 0; i++) await patienter(100)
    assert.equal(deMalik().length, 1, 'le podium du quiz a crédité Malik (invariant 10)')

    // L'animateur l'exclut — et Turso refuse, à cet instant, d'effacer sa ligne.
    panne(banc, { profile_xp: 'BEFORE DELETE ON profile_xp' }, true)
    ;(host as any).emit('host:removePlayer', { playerId: malik.playerId })
    await attendre<any>(host, 'party:snapshot', s => !s.players.some((p: any) => p.id === malik.playerId), 'Malik exclu')
    await patienter(500)
    panne(banc, {}, false)

    // La soirée continue, puis la clôture : elle reprend ce que Malik devait rendre.
    const toast = attendre<any>(host, 'toast', () => true, 'la clôture', 15_000)
    ;(host as any).emit('host:closeParty', { title: 'La soirée' })
    assert.equal((await toast).kind, 'info')
    await patienter(300)
    assert.deepEqual(deMalik(), [], 'Malik, exclu, ne garde rien de la soirée')
    assert.equal(lire<{ xp: number }>(banc, "SELECT xp FROM profiles WHERE login = 'malik'")[0].xp, 0)
  } finally {
    await banc.close()
  }
})

test('supprimer un compte : l’administrateur garde aux joueurs ce qu’ils ont gagné, ou le leur reprend', async () => {
  // Il effaçait les soirées et laissait tout ce qu'elles avaient crédité, et
  // « Mes soirées » gardait des lignes sans lieu ni titre. L'arbitrage du 27
  // septembre 2026 : le demander à chaque suppression [recompenses-comptes-8].
  const banc = await demarrer()
  try {
    const admin = await connexionAnimateur(banc.url)
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const brunoCookie = await inscrireProfil(banc.url, 'bruno', 'Bruno', '🐼')

    /** Un compte d'animateur, sa soirée jouée par Alice et Bruno, close ; le compte désactivé. */
    async function compteJoue(login: string, slug: string): Promise<string> {
      const cree = await ecrire(banc.url, '/api/admin/accounts', { login, name: login, slug }, admin)
      const { account, activation } = (await cree.json()) as { account: { id: string }; activation: { token: string } }
      const cookie = cookieDe(await ecrire(banc.url, '/api/auth/activate', { token: activation.token, password: `${login}-pass-1` }))
      const quiz = await creerQuiz(banc.url, cookie, [qcm('Un ?'), qcm('Deux ?')], `Chez ${login}`)
      const host = await ecranCommun(banc.url, cookie)
      const alice = await invite(banc.url, 'Alice', '', { slug, cookie: aliceCookie })
      const bruno = await invite(banc.url, 'Bruno', '', { slug, cookie: brunoCookie })
      await jouerQuiz(host, quiz, [
        [
          [alice, 0],
          [bruno, 1],
        ],
        [
          [alice, 0],
          [bruno, 0],
        ],
      ])
      await patienter(500)
      const toast = attendre<any>(host, 'toast', () => true, 'la clôture', 15_000)
      ;(host as any).emit('host:closeParty', { title: `La soirée de ${login}` })
      assert.equal((await toast).kind, 'info')
      for (const s of [host, alice.socket, bruno.socket]) s.close()
      assert.equal((await ecrire(banc.url, `/api/admin/accounts/${account.id}/disable`, {}, admin)).status, 200)
      return account.id
    }
    const credite = (spaceId: string) => lire(banc, 'SELECT profile_id FROM profile_xp WHERE space_id = ?', spaceId).length
    const xpDAlice = () => lire<{ xp: number }>(banc, `SELECT xp FROM profiles WHERE login = 'alice'`)[0].xp

    const carla = await compteJoue('carla', 'chez-carla')
    const dora = await compteJoue('dora', 'chez-dora')
    assert.ok(credite(carla) > 0 && credite(dora) > 0, 'les deux soirées ont crédité leurs joueurs')
    const avant = xpDAlice()

    // Carla fabriquait des soirées : tout ce qu'elles avaient crédité part avec elle.
    assert.equal((await ecrire(banc.url, `/api/admin/accounts/${carla}?credits=reprendre`, {}, admin, 'DELETE')).status, 200)
    assert.equal(credite(carla), 0)
    assert.ok(xpDAlice() < avant, 'l’expérience d’Alice redescend')
    assert.equal(lire(banc, 'SELECT 1 FROM profile_badges WHERE space_id = ?', carla).length, 0)

    // Dora s'en va : ses joueurs gardent ce qu'ils ont gagné, et « Mes soirées » dit pourquoi la ligne n'a plus de lieu.
    const xpAvantDora = xpDAlice()
    assert.equal((await ecrire(banc.url, `/api/admin/accounts/${dora}?credits=garder`, {}, admin, 'DELETE')).status, 200)
    assert.ok(credite(dora) > 0)
    assert.equal(xpDAlice(), xpAvantDora)
    const moi = (await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: aliceCookie } })).json()) as any
    const ligne = moi.profile.soirees.find((s: any) => s.xp > 0)
    assert.equal(ligne.espaceFerme, true)
    assert.equal(ligne.slug, null)
  } finally {
    await banc.close()
  }
})
