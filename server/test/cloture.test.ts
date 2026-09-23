// La fin d'une soirée : « Clore la soirée », « C'était un essai », et ce que
// l'historique garde — ou rend.
//
// Il y avait deux gestes, « Sauvegarder » et « Nouvelle soirée », et aucun ne
// disait la fin : le téléphone restait sur « En attente du prochain quiz… »,
// une soirée d'essai gardait son expérience, et un « Nouvelle soirée » cliqué
// sans « Sauvegarder » d'abord perdait les prix. La soirée se range
// maintenant toute seule après chaque quiz ; la clôture est le seul geste de
// fin, et elle se raconte — à chaque téléphone la sienne, à la salle la
// sienne. Un essai s'efface sans rien laisser.
//
// Chaque test a son propre serveur jetable.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import {
  ADMIN,
  attendre,
  connecter,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  ecrire,
  emitAck,
  inscrireProfil,
  instantane,
  invite,
  lancerQuiz,
  patienter,
  qcm,
  type Banc,
  type Invite,
  type Socket,
} from './banc'
import { ProfileStore, VERSION_BAREME } from '../src/auth/profiles'
import { xpDesHautsFaits } from '../src/core/hautsfaits'
import { XP, niveauPour } from '../../shared/profil'

// L'Éclat se tire une chance sur quarante par soirée, et le premier fait
// tomber un palier de carrière — dix points de plus à la clôture. Ici, le
// hasard ne décide de rien : les tests qui en ont besoin le forcent.
ProfileStore.tirageEclat = () => false

// ── Outils ────────────────────────────────────────────────────────────────

async function avecBanc(scenario: (banc: Banc) => Promise<void>) {
  const banc = await demarrer()
  try {
    await scenario(banc)
  } finally {
    await banc.close()
  }
}

type Reponses = [Invite, number][][]

/** Joue un quiz de bout en bout depuis l'écran commun, puis le referme. */
async function jouerQuiz(host: Socket, quizId: string, questions: Reponses): Promise<string> {
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
  return sessionId
}

/** « Clore la soirée », sous ce titre. */
async function clore(host: Socket, title?: string) {
  const toast = attendre<any>(host, 'toast', () => true, 'la soirée close', 15_000)
  ;(host as any).emit('host:closeParty', title ? { title } : {})
  const t = await toast
  assert.equal(t.kind, 'info', `la clôture a échoué : ${t.message}`)
  return t.message as string
}

/** L'historique de l'espace : la soirée en cours à part, les soirées closes ensuite. */
async function historique(banc: Banc): Promise<{ current: any; archives: any[] }> {
  return (await (await fetch(`${banc.url}/s/${ADMIN.slug}/soirees.json`)).json()) as any
}

/** Attend que la soirée en cours se soit rangée d'elle-même, et rend son identifiant. */
async function rangee(banc: Banc): Promise<string> {
  for (const limite = Date.now() + 8000; ; await patienter(100)) {
    const { current } = await historique(banc)
    if (current?.id) return current.id
    if (Date.now() > limite) assert.fail('la soirée aurait dû se ranger toute seule après son quiz')
  }
}

/** Trois figurants anonymes. */
async function figurants(banc: Banc, n = 3): Promise<Invite[]> {
  const noms: [string, string][] = [
    ['Bob', '🐻'],
    ['Dora', '🐙'],
    ['Eve', '🐝'],
  ]
  const salle: Invite[] = []
  for (const [nom, avatar] of noms.slice(0, n)) salle.push(await invite(banc.url, nom, avatar))
  return salle
}

const faux = (salle: Invite[]): [Invite, number][] => salle.map(i => [i, 1])

const permanente = (banc: Banc) => banc.quizDbUrl.replace(/^file:/, '')

function lire<T = any>(banc: Banc, sql: string, ...args: unknown[]): T[] {
  const db = new Database(permanente(banc), { readonly: true, fileMustExist: true })
  try {
    return db.prepare(sql).all(...args) as T[]
  } finally {
    db.close()
  }
}

function ecrireEnBase(banc: Banc, fn: (db: Database.Database) => void) {
  const db = new Database(permanente(banc))
  try {
    fn(db)
  } finally {
    db.close()
  }
}

const profilDe = (banc: Banc, login: string): string =>
  lire<{ id: string }>(banc, 'SELECT id FROM profiles WHERE login = ?', login)[0].id

const moi = async (banc: Banc, cookie: string) =>
  ((await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: cookie } })).json()) as any).profile

/** Un téléphone qui se réveille et se re-présente avec le jeton qu'il gardait. */
async function reveil(banc: Banc, token: string) {
  const tel = connecter(banc.url)
  await emitAck(tel, 'party:watch', { slug: ADMIN.slug })
  return emitAck<any>(tel, 'player:join', { slug: ADMIN.slug, token })
}

// ── 1. « Clore la soirée » ────────────────────────────────────────────────

test('clore la soirée : chaque téléphone reçoit sa fin, l’écran commun la sienne, et un téléphone qui dormait la retrouve', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const huit = await creerQuiz(banc.url, cookie, Array.from({ length: 8 }, (_, i) => qcm(`Question ${i + 1} ?`)), 'Huit')
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const host = await ecranCommun(banc.url, cookie)
    const alice = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    const salle = await figurants(banc)
    const [bob, dora] = salle

    // Alice trouve tout, seule : un Grand Chelem. La salle ne marque rien.
    await jouerQuiz(host, huit, Array.from({ length: 8 }, () => [[alice, 0], ...faux(salle)]))
    await rangee(banc)

    const finAlice = attendre<any>(alice.socket, 'soiree:fin', () => true, 'la fin de soirée d’Alice', 15_000)
    const finBob = attendre<any>(bob.socket, 'soiree:fin', () => true, 'la fin de soirée de Bob', 15_000)
    const cloture = attendre<any>(host, 'soiree:cloture', () => true, 'la clôture sur l’écran commun', 15_000)
    const message = await clore(host, 'La soirée des tests')
    assert.match(message, /La soirée des tests/, 'l’écran commun dit ce qu’il vient de clore')

    // Le téléphone d'Alice : sa soirée, et ce que son profil y a gagné.
    const fa = await finAlice
    assert.equal(fa.rang, 1)
    assert.equal(fa.joueurs, 4)
    assert.equal(fa.soiree.titre, 'La soirée des tests')
    assert.equal(fa.soiree.slug, ADMIN.slug, 'et où la relire')
    // Juste huit fois quand la salle se trompait : le Flair, en plus.
    assert.deepEqual(fa.hautsFaits.map((h: any) => h.key), ['hf:grand-chelem', 'hf:flair'])
    // Huit réponses justes, la première place du quiz, le sans-faute, puis
    // le Grand Chelem et le Flair à la clôture.
    const xp = 8 * (XP.reponse + XP.juste) + XP.podiumQuiz[0] + XP.sansFaute + xpDesHautsFaits(['hf:grand-chelem', 'hf:flair'])
    assert.equal(fa.profil?.xp, xp)
    assert.equal(fa.profil?.niveauAvant, 1)
    assert.equal(fa.profil?.niveauApres, niveauPour(xp))
    assert.ok(fa.profil?.finitions.includes('argent'), 'la finition Argent tombe avec le niveau 3')
    assert.deepEqual(fa.profil?.legendaires, ['lg:chouette'], 'le Grand Chelem débloque la Chouette')

    // Celui de Bob, anonyme : sa soirée, ses ombres, et rien de plus.
    const fb = await finBob
    assert.equal(fb.profil, undefined, 'l’absence, pas l’infériorité')
    assert.ok(fb.hautsFaits.some((h: any) => h.key === 'hf:lanterne-rouge' && h.ton === 'ombre'))

    // L'écran commun annonce la salle.
    const c = await cloture
    assert.equal(c.podium[0]?.nom, 'Alice')
    assert.deepEqual(c.legendaires.map((l: any) => [l.nom, l.gagne]), [['Alice', 'lg:chouette']])
    assert.deepEqual(c.montees.map((m: any) => [m.nom, m.avant, m.apres]), [['Alice', 1, niveauPour(xp)]])
    assert.equal(c.hautsFaits.length, 4, 'chacun ses hauts faits : un éclat pour Alice, des ombres pour la salle')

    // La soirée est dans l'historique, sous son titre, et plus en cours.
    const { current, archives } = await historique(banc)
    assert.equal(current, null)
    assert.deepEqual(archives.map(a => a.title), ['La soirée des tests'])

    // Le téléphone de Dora dormait pendant la clôture : il se re-présente
    // avec son jeton, et reçoit sa fin de soirée comme s'il avait été là.
    const reveille = await reveil(banc, dora.token)
    assert.equal(reveille.ok, false)
    assert.equal(reveille.reason, 'soiree-close')
    assert.equal(reveille.fin?.nom, 'Dora')

    // La page du profil range le Grand Chelem et le légendaire.
    const profil = await moi(banc, aliceCookie)
    assert.equal(profil.xp, xp)
    assert.ok(profil.legendaires.includes('lg:chouette'))
    assert.equal(profil.hautsFaits.find((h: any) => h.key === 'hf:grand-chelem')?.fois, 1)
    assert.ok(profil.vitrine.some((b: any) => b.key === 'hf:grand-chelem'))
  }))

test('un avatar légendaire se porte une fois débloqué — pas avant — et se voit de toute la salle', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const huit = await creerQuiz(banc.url, cookie, Array.from({ length: 8 }, (_, i) => qcm(`Question ${i + 1} ?`)), 'Huit')
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const host = await ecranCommun(banc.url, cookie)
    const porter = (legendaire: string | null) => ecrire(banc.url, '/api/joueur/moi', { legendaire }, aliceCookie, 'PUT')

    const refuse = await porter('lg:chouette')
    assert.equal(refuse.status, 400, 'un légendaire pas encore gagné ne se porte pas')
    assert.match(((await refuse.json()) as any).error, /pas encore à toi/)

    const alice = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    const salle = await figurants(banc)
    await jouerQuiz(host, huit, Array.from({ length: 8 }, () => [[alice, 0], ...faux(salle)]))
    await rangee(banc)
    await clore(host)

    const porte = await porter('lg:chouette')
    assert.equal(porte.status, 200)
    assert.equal(((await porte.json()) as any).profile.legendaire, 'lg:chouette')
    assert.equal((await porter('lg:dragon')).status, 400, 'le Dragon demande un Triplé')

    // À la soirée suivante, toute la salle le voit.
    const retour = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    const snap = await instantane<any>(host, s => s.players.some((p: any) => p.id === retour.playerId), 'Alice dans la salle')
    assert.equal(snap.players.find((p: any) => p.id === retour.playerId)?.legendaire, 'lg:chouette')

    // Choisir un emoji ôte le légendaire : on porte l'un ou l'autre.
    const emoji = await ecrire(banc.url, '/api/joueur/moi', { avatar: '🐯' }, aliceCookie, 'PUT')
    assert.equal(((await emoji.json()) as any).profile.legendaire, null)
  }))

// ── 2. « C'était un essai » ───────────────────────────────────────────────

test('« C’était un essai » : tout s’efface, archive, expérience et Éclat compris — et les téléphones repassent par l’entrée', () =>
  avecBanc(async banc => {
    const tirage = ProfileStore.tirageEclat
    ProfileStore.tirageEclat = () => true
    try {
      const cookie = await connexionAnimateur(banc.url)
      const quiz = await creerQuiz(banc.url, cookie, [qcm('On y est ?')])
      const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
      const aliceId = profilDe(banc, 'alice')
      const host = await ecranCommun(banc.url, cookie)
      const alice = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
      const salle = await figurants(banc, 2)

      const creditee = attendre<any>(alice.socket, 'player:profil', p => p.xp > 0, 'le crédit du quiz', 15_000)
      await jouerQuiz(host, quiz, [[[alice, 0], ...faux(salle)]])
      await creditee
      const soiree = await rangee(banc)
      assert.equal(lire(banc, 'SELECT 1 FROM profile_eclats WHERE profile_id = ?', aliceId).length, 1, 'l’Éclat est tombé')

      const renvoyee = attendre(alice.socket, 'party:reset', () => true, 'le téléphone d’Alice renvoyé à l’entrée')
      const toast = attendre<any>(host, 'toast', () => true, 'l’essai effacé', 15_000)
      ;(host as any).emit('host:discardParty')
      assert.equal((await toast).kind, 'info')
      await renvoyee

      const { current, archives } = await historique(banc)
      assert.equal(current, null)
      assert.deepEqual(archives, [], 'l’archive que l’essai s’était faite repart avec lui')
      assert.deepEqual(lire(banc, 'SELECT soiree_id FROM profile_xp WHERE profile_id = ?', aliceId), [])
      assert.deepEqual(lire(banc, 'SELECT avatar FROM profile_eclats WHERE profile_id = ?', aliceId), [])
      assert.deepEqual(lire(banc, 'SELECT badge FROM profile_badges WHERE soiree_id = ?', soiree), [])
      const profil = await moi(banc, aliceCookie)
      assert.equal(profil.xp, 0, 'son total est recalculé')
      assert.deepEqual(profil.eclats, [])

      // Un essai n'a pas de fin à raconter : le jeton ne désigne plus personne.
      const reveille = await reveil(banc, alice.token)
      assert.equal(reveille.reason, 'unknown-token')
      assert.equal(reveille.fin, undefined)
    } finally {
      ProfileStore.tirageEclat = tirage
    }
  }))

// ── 3. L'historique ───────────────────────────────────────────────────────

test('retirer une soirée de l’historique reprend ce qu’elle avait crédité ; la soirée en cours ne se retire pas', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const trois = await creerQuiz(banc.url, cookie, [qcm('Un ?'), qcm('Deux ?'), qcm('Trois ?')])
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const aliceId = profilDe(banc, 'alice')
    const host = await ecranCommun(banc.url, cookie)
    const retirer = (id: string) => ecrire(banc.url, `/api/soirees/${id}`, {}, cookie, 'DELETE')

    const alice = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    const salle = await figurants(banc, 2)
    await jouerQuiz(host, trois, Array.from({ length: 3 }, () => [[alice, 0], ...faux(salle)]))
    const soiree = await rangee(banc)

    // En cours, elle s'efface depuis l'écran commun, pas depuis l'historique.
    const enCours = await retirer(soiree)
    assert.equal(enCours.status, 409)
    assert.match(((await enCours.json()) as any).error, /essai/)

    await clore(host)
    assert.ok((await moi(banc, aliceCookie)).xp > 0)
    assert.ok(lire(banc, 'SELECT 1 FROM profile_badges WHERE profile_id = ?', aliceId).length > 0, 'des prix à la clôture')

    assert.equal((await retirer(soiree)).status, 200)
    assert.deepEqual((await historique(banc)).archives, [])
    assert.deepEqual(lire(banc, 'SELECT soiree_id FROM profile_xp WHERE profile_id = ?', aliceId), [])
    assert.deepEqual(lire(banc, 'SELECT badge FROM profile_badges WHERE profile_id = ?', aliceId), [])
    const profil = await moi(banc, aliceCookie)
    assert.equal(profil.xp, 0, 'une soirée retirée ne compte plus nulle part')
    assert.equal(profil.badges, 0)
  }))

// ── 4. L'animateur joue aussi ─────────────────────────────────────────────

test('chez lui aussi, l’animateur gagne de l’expérience — dès un duel', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [qcm('On y est ?')])
    const animCookie = await inscrireProfil(banc.url, 'anim', 'Antoine', '🦁')
    const lie = await ecrire(banc.url, '/api/space/profil', { login: 'anim', password: 'motdepasse1' }, cookie)
    assert.equal(lie.status, 200, 'le profil de l’animateur tient l’espace')
    const host = await ecranCommun(banc.url, cookie)
    const anim = await invite(banc.url, 'Antoine', '🦁', { cookie: animCookie })
    const bob = await invite(banc.url, 'Bob', '🐻')

    // On le tenait hors concours, parce qu'il connaît ses quiz : il ne
    // progressait jamais aux fêtes qu'il organise — souvent les seules.
    const credite = attendre<any>(anim.socket, 'player:profil', p => p.xp > 0, 'le crédit de l’animateur', 15_000)
    await jouerQuiz(host, quiz, [[[anim, 0], [bob, 1]]])
    await credite
    const finAnim = attendre<any>(anim.socket, 'soiree:fin', () => true, 'la fin de soirée de l’animateur', 15_000)
    await clore(host)
    assert.equal((await moi(banc, animCookie)).xp, XP.reponse + XP.juste, 'une question posée à deux rapporte')
    assert.ok((await finAnim).profil, 'sa fin de soirée compte pour son profil')
  }))

// ── 5. Le recalcul ────────────────────────────────────────────────────────

test('au démarrage, l’expérience d’avant le barème au mérite se relit sur l’historique', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const trois = await creerQuiz(banc.url, cookie, [qcm('Un ?'), qcm('Deux ?'), qcm('Trois ?')])
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const aliceId = profilDe(banc, 'alice')
    const host = await ecranCommun(banc.url, cookie)
    const alice = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    const salle = await figurants(banc, 2)
    await jouerQuiz(host, trois, Array.from({ length: 3 }, () => [[alice, 0], ...faux(salle)]))
    const soiree = await rangee(banc)
    await clore(host)
    const juste = (await moi(banc, aliceCookie)).xp
    assert.equal(juste, 3 * (XP.reponse + XP.juste))

    // On remonte le temps : la ligne de cette soirée a été écrite par
    // l'ancien barème — présence comprise —, une soirée qui n'est plus dans
    // l'historique a laissé la sienne, et le vieux catalogue de carrière a
    // rangé « La Première Fois ».
    const espace = lire<{ space_id: string }>(banc, 'SELECT space_id FROM profile_xp WHERE profile_id = ?', aliceId)[0].space_id
    const ancien = (reponses: number, justes: number) =>
      JSON.stringify({
        gain: { presence: 50, reponses, justesse: 2 * justes, podium: 60, quiz: 15 },
        releve: { reponses, justes, rang: 1, quiz: 1 },
      })
    ecrireEnBase(banc, db => {
      db.prepare('UPDATE profile_xp SET xp = 999, detail = ? WHERE profile_id = ? AND soiree_id = ?').run(ancien(3, 3), aliceId, soiree)
      db.prepare('INSERT INTO profile_xp VALUES (?, ?, ?, ?, ?, ?)').run(aliceId, '2025-01-01-orpheline', espace, 145, ancien(10, 6), 1)
      db.prepare('INSERT INTO profile_badges VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        aliceId,
        'carriere:premiere',
        soiree,
        espace,
        '🎉',
        'La Première Fois',
        2,
      )
      db.prepare('UPDATE profiles SET xp = 1144 WHERE id = ?').run(aliceId)
    })

    await banc.redemarrer()
    const lignes = lire<{ soiree_id: string; xp: number }>(
      banc,
      `SELECT soiree_id, xp FROM profile_xp WHERE profile_id = ? AND soiree_id NOT LIKE '#%' ORDER BY soiree_id`,
      aliceId,
    )
    assert.deepEqual(
      lignes,
      [
        // La soirée sans archive garde ce que son relevé dit encore : dix
        // réponses, six justes.
        { soiree_id: '2025-01-01-orpheline', xp: 10 * XP.reponse + 6 * XP.juste },
        // Celle de l'historique se relit entière, au barème du jour.
        { soiree_id: soiree, xp: juste },
      ],
    )
    assert.deepEqual(
      lire(banc, `SELECT badge FROM profile_badges WHERE badge LIKE 'carriere:%'`),
      [],
      'l’ancien catalogue de carrière laisse place aux paliers',
    )
    assert.equal((await moi(banc, aliceCookie)).xp, juste + 10 * XP.reponse + 6 * XP.juste, 'le total suit')

    // Un second démarrage n'a plus rien à relire.
    await banc.redemarrer()
    assert.equal((await moi(banc, aliceCookie)).xp, juste + 10 * XP.reponse + 6 * XP.juste)
  }))

test('au démarrage d’un barème neuf, l’historique se relit — et la veille garde ses chiffres', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [{ ...qcm('Qui chante Thriller ?'), category: 'Musique' }])
    const animCookie = await inscrireProfil(banc.url, 'anim', 'Antoine', '🦁')
    const animId = profilDe(banc, 'anim')
    assert.equal((await ecrire(banc.url, '/api/space/profil', { login: 'anim', password: 'motdepasse1' }, cookie)).status, 200)
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const aliceId = profilDe(banc, 'alice')
    const host = await ecranCommun(banc.url, cookie)
    const anim = await invite(banc.url, 'Antoine', '🦁', { cookie: animCookie })
    const alice = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    // Alice se trompe : deux bonnes réponses feraient un réflexe, au plus
    // rapide des deux — à la milliseconde près.
    await jouerQuiz(host, quiz, [[[anim, 0], [alice, 1]]])
    const soiree = await rangee(banc)
    await clore(host)
    const juste = XP.reponse + XP.juste

    // On remonte le temps : le barème 2 tenait l'animateur hors concours —
    // aucune ligne pour lui —, Alice avait joué la veille une soirée sortie
    // depuis de l'historique, et un palier de carrière.
    const espace = lire<{ space_id: string }>(banc, 'SELECT space_id FROM profile_xp WHERE profile_id = ?', aliceId)[0].space_id
    const veille = {
      v: 2,
      gain: { reponses: 10, justesse: 30 },
      releve: { questions: 10, reponses: 10, qcm: 10, justes: 10, categories: { Musique: { questions: 10, justes: 10 } } },
    }
    ecrireEnBase(banc, db => {
      db.prepare('DELETE FROM profile_xp WHERE profile_id = ?').run(animId)
      db.prepare('UPDATE profiles SET xp = 0 WHERE id = ?').run(animId)
      const { detail } = db.prepare('SELECT detail FROM profile_xp WHERE profile_id = ? AND soiree_id = ?').get(aliceId, soiree) as any
      db.prepare('UPDATE profile_xp SET detail = ? WHERE profile_id = ? AND soiree_id = ?').run(
        String(detail).replace(/^\{"v":\d+,/, '{"v":2,'),
        aliceId,
        soiree,
      )
      db.prepare('INSERT INTO profile_xp VALUES (?, ?, ?, ?, ?, ?)').run(aliceId, '2026-09-22-veille', espace, 40, JSON.stringify(veille), 1)
      db.prepare('INSERT INTO profile_badges VALUES (?, ?, ?, ?, ?, ?, ?)').run(aliceId, 'hf:habitue:1', soiree, espace, '🎟️', 'L’Habitué', 2)
      db.prepare('INSERT INTO profile_xp VALUES (?, ?, ?, ?, ?, ?)').run(aliceId, '#paliers', '', 10, JSON.stringify({ v: 2, paliers: ['hf:habitue:1'] }), 3)
      db.prepare('UPDATE profiles SET xp = ? WHERE id = ?').run(XP.reponse + 40 + 10, aliceId)
    })

    await banc.redemarrer()
    assert.equal((await moi(banc, animCookie)).xp, juste, 'la soirée de l’historique se recrédite à l’animateur')
    const aliceApres = await moi(banc, aliceCookie)
    assert.equal(aliceApres.xp, XP.reponse + 40 + 10, 'la veille et le palier gardent leur expérience')
    // Lue comme une ligne de l'ancien barème, la veille perdait ses catégories.
    assert.deepEqual(aliceApres.categories, { Musique: { questions: 11, justes: 10 } })
    // Plus rien d'une version d'avant : le démarrage suivant n'a rien à relire.
    assert.deepEqual(lire(banc, `SELECT soiree_id FROM profile_xp WHERE detail NOT LIKE '{"v":${VERSION_BAREME},%'`), [])
  }))
