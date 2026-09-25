// Ce qu'une soirée crédite, et comment l'historique se relit : les prix
// remis à l'écran, que le souvenir et le bilan relisent et qui ne rapportent
// jamais d'expérience ; l'animateur qui joue chez lui ; et, au démarrage, la
// relecture de l'historique au barème du jour.
//
// Ces épreuves vivaient dans `cloture.test.ts`, qui en comptait dix-sept :
// sous Node 22, `--test-timeout` vaut aussi pour un fichier entier, et ses
// deux minutes ne suffisaient plus sur la machine de la CI.
//
// Chaque test a son propre serveur jetable.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import {
  ADMIN,
  attendre,
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
import { ArchiveStore } from '../src/core/archive'
import { XP } from '../../shared/profil'

// L'Éclat se tire une chance sur quarante par soirée, et le premier fait
// tomber un palier de carrière — dix points de plus à la clôture. Ici, le
// hasard ne décide de rien.
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

// ── 1. Les prix remis ─────────────────────────────────────────────────────

// Le lendemain racontait les prix que l'application avait calculés, et pas
// ceux que l'animateur avait remis : « Le coup de cœur de Sam », un prix
// libre au motif inventé, ne se relisait nulle part. Le souvenir et le bilan
// portent maintenant les prix remis, de la soirée en cours comme de
// l'archive — le même chemin, relu à la même source.

test('le souvenir et le bilan relisent les prix remis, prix libres compris, en cours comme archivés', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [qcm('Un ?'), qcm('Deux ?')])
    const host = await ecranCommun(banc.url, cookie)
    ;(host as any).emit('host:createTeam', { name: 'Les Carbonara', emoji: '🍝' })
    ;(host as any).emit('host:createTeam', { name: 'Les Randonneurs', emoji: '🥾' })
    const snap = await instantane<any>(host, s => s.teams.length === 2, 'les deux équipes')
    const [carbo, rando] = [...snap.teams].sort((a: any, b: any) => a.position - b.position).map((t: any) => t.id as string)
    const salle = await figurants(banc, 2)
    ;(host as any).emit('host:assignPlayer', { playerId: salle[0].playerId, teamId: carbo })
    ;(host as any).emit('host:assignPlayer', { playerId: salle[1].playerId, teamId: rando })
    await jouerQuiz(host, quiz, [[[salle[0], 0], [salle[1], 1]], [[salle[0], 0], [salle[1], 1]]])
    const soiree = await rangee(banc)

    // Deux prix, dans cet ordre : un calculé, puis un prix libre. Le registre
    // les rend du plus récent au plus ancien ; le lendemain, dans l'ordre vécu.
    ;(host as any).emit('host:awardTeam', { teamId: carbo, points: 2, reason: "L'Éclair" })
    await instantane<any>(host, s => s.bonuses.length === 1, 'le premier prix')
    await patienter(5)
    ;(host as any).emit('host:awardTeam', { teamId: rando, points: 3, reason: 'Le coup de cœur de Sam' })
    await instantane<any>(host, s => s.bonuses.length === 2, 'le prix libre')
    const attendu = [
      [carbo, 2, "L'Éclair"],
      [rando, 3, 'Le coup de cœur de Sam'],
    ]
    const remis = (page: any) => (page.bonuses ?? []).map((b: any) => [b.teamId, b.points, b.reason])
    const lire = async (chemin: string) => {
      const res = await fetch(`${banc.url}/s/${ADMIN.slug}/${chemin}`)
      assert.equal(res.status, 200, chemin)
      return (await res.json()) as any
    }

    for (const fichier of ['recap.json', 'bilan.json']) {
      assert.deepEqual(remis(await lire(fichier)), attendu, `${fichier}, la soirée en cours`)
    }
    await clore(host, 'Les 40 ans de Sam')
    for (const fichier of ['recap.json', 'bilan.json']) {
      assert.deepEqual(remis(await lire(`soirees/${soiree}/${fichier}`)), attendu, `${fichier}, la soirée archivée`)
    }
  }))

// Un prix ne rapporte jamais d'expérience : celui du palmarès se juge sur une
// seule soirée, celui qu'on remet à l'écran se donne à la main — prix libre
// compris. La même soirée, jouée deux fois, avec et sans prix remis, laisse
// donc au profil la même expérience.

test('un prix remis, même libre, ne rapporte aucune expérience', async () => {
  const soiree = async (avecPrix: boolean) => {
    let xp = -1
    await avecBanc(async banc => {
      const cookie = await connexionAnimateur(banc.url)
      const quiz = await creerQuiz(banc.url, cookie, [qcm('Un ?'), qcm('Deux ?')])
      const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
      const host = await ecranCommun(banc.url, cookie)
      ;(host as any).emit('host:createTeam', { name: 'Les Carbonara', emoji: '🍝' })
      const snap = await instantane<any>(host, s => s.teams.length === 1, 'l’équipe')
      const alice = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
      const [bob] = await figurants(banc, 1)
      ;(host as any).emit('host:assignPlayer', { playerId: alice.playerId, teamId: snap.teams[0].id })
      await jouerQuiz(host, quiz, [[[alice, 0], [bob, 1]], [[alice, 0], [bob, 1]]])
      await rangee(banc)
      if (avecPrix) {
        ;(host as any).emit('host:awardTeam', { teamId: snap.teams[0].id, points: 5, reason: "L'Éclair" })
        ;(host as any).emit('host:awardTeam', { teamId: snap.teams[0].id, points: 3, reason: 'Le coup de cœur de Sam' })
        await instantane<any>(host, s => s.bonuses.length === 2, 'les deux prix')
      }
      await clore(host)
      xp = (await moi(banc, aliceCookie)).xp
    })
    return xp
  }
  const sans = await soiree(false)
  assert.ok(sans > 0, 'la soirée rapporte, elle')
  assert.equal(await soiree(true), sans)
})

// ── 2. L'animateur joue aussi ─────────────────────────────────────────────

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

// ── 3. Le recalcul ────────────────────────────────────────────────────────

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
      db.prepare('INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(aliceId, '2025-01-01-orpheline', espace, 145, ancien(10, 6), 1)
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
      db.prepare('INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(aliceId, '2026-09-22-veille', espace, 40, JSON.stringify(veille), 1)
      db.prepare('INSERT INTO profile_badges VALUES (?, ?, ?, ?, ?, ?, ?)').run(aliceId, 'hf:habitue:1', soiree, espace, '🎟️', 'L’Habitué', 2)
      db.prepare('INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(aliceId, '#paliers', '', 10, JSON.stringify({ v: 2, paliers: ['hf:habitue:1'] }), 3)
      db.prepare('UPDATE profiles SET xp = ? WHERE id = ?').run(XP.reponse + 40 + 10, aliceId)
    })

    await banc.redemarrer()
    // Lu en base avant toute visite : la page `/profil` rattraperait sinon
    // dans l'archive un joueur que la relecture aurait oublié d'écrire.
    assert.deepEqual(
      lire(banc, 'SELECT joueur_id FROM profile_xp WHERE profile_id = ? AND soiree_id = ?', animId, soiree),
      [{ joueur_id: anim.playerId }],
      'la ligne recréditée retient le joueur qu’il était ce soir-là',
    )
    assert.equal((await moi(banc, animCookie)).xp, juste, 'la soirée de l’historique se recrédite à l’animateur')
    const aliceApres = await moi(banc, aliceCookie)
    assert.equal(aliceApres.xp, XP.reponse + 40 + 10, 'la veille et le palier gardent leur expérience')
    // Lue comme une ligne de l'ancien barème, la veille perdait ses catégories.
    assert.deepEqual(aliceApres.categories, { Musique: { questions: 11, justes: 10 } })
    // Plus rien d'une version d'avant : le démarrage suivant n'a rien à relire.
    assert.deepEqual(lire(banc, `SELECT soiree_id FROM profile_xp WHERE detail NOT LIKE '{"v":${VERSION_BAREME},%'`), [])
  }))

// Le recalcul passe avant l'ouverture du port, et chaque profil de chaque
// soirée y coûtait deux allers-retours, en série : 101 soirées, 68 s de
// démarrage à 20 ms de latence — des minutes de 502 au premier déploiement
// d'un barème neuf. Une soirée se crédite maintenant d'un seul lot, quel que
// soit le nombre de ses profils. On compte les requêtes, on ne chronomètre
// rien.
test('le recalcul au barème du jour écrit une soirée d’un seul lot, quel que soit le nombre de ses profils', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const path = await import('node:path')
  const { Sqlite3Client } = await import('@libsql/client/sqlite3')
  const { ArchiveStore, buildArchive } = await import('../src/core/archive')
  const { recalculerHistorique } = await import('../src/core/recalcul')

  /** Un historique de `soirees` soirées, chacune jouée par `profils` profils, et une ligne d'un barème d'avant. */
  const historique = async (soirees: number, profils: number) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'quizz-recalcul-'))
    const url = `file:${path.join(dir, 'permanente.db').replace(/\\/g, '/')}`
    const profiles = new ProfileStore(url)
    await profiles.init()
    const archives = new ArchiveStore(url)
    await archives.init('espace')
    const ids: string[] = []
    for (let i = 0; i < profils; i++) {
      ids.push((await profiles.register({ login: `p${i}`, password: 'motdepasse1', name: `P${i}`, avatar: '🦊' })).profile.id)
    }
    for (let k = 0; k < soirees; k++) {
      const t0 = Date.UTC(2025, 0, 1) + k * 86_400_000
      const players = ids.map((profileId, i) => ({
        id: `j${k}-${i}`, name: `P${i}`, avatar: '🦊', token: '', teamId: null, profileId, createdAt: t0 + i,
      }))
      // Deux figurants anonymes : un joueur seul ne rapporte rien.
      for (const f of ['x', 'y']) players.push({ id: `j${k}-${f}`, name: f, avatar: '🐻', token: '', teamId: null, profileId: null as any, createdAt: t0 + 99 })
      const answers = players.map((p, i) => ({
        sessionId: `s${k}`, quizTitle: 'Quiz', qIndex: 0, kind: 'choice' as const, playerId: p.id, answered: true,
        correct: i % 2 === 0, choice: i % 2, value: null, target: null, ms: 1000 + i * 37, changes: 0,
        points: i % 2 === 0 ? 500 : 0, durationMs: 20_000, observed: false, category: null, createdAt: t0 + 1000,
      }))
      const scores = answers.filter(a => a.points > 0).map(a => ({ playerId: a.playerId, sessionId: a.sessionId, points: a.points, reason: 'Q1', createdAt: a.createdAt }))
      const a = buildArchive({
        soiree: { id: `soiree-${k}`, heldAt: t0 } as any, players: players as any, teams: [], bonuses: [], scores, answers: answers as any,
        packsBySession: new Map([[`s${k}`, { title: 'Quiz', questions: [{ kind: 'choice', text: 'Q ?', answers: ['A', 'B'], correct: 0, duration: 20, image: null }] as any }]]),
        library: [],
      })!
      await archives.save('espace', a.id, a.heldAt, a.archive)
    }
    const c = (profiles as any).client
    await c.execute({
      sql: `INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, 'soiree-0', 'espace', 1, '{"v":1}', 0)
            ON CONFLICT(profile_id, soiree_id) DO UPDATE SET detail = '{"v":1}'`,
      args: [ids[0]],
    })
    return { dir, profiles, archives, ids }
  }

  const proto = Sqlite3Client.prototype as any
  const origines = { execute: proto.execute, batch: proto.batch }
  let requetes = 0
  for (const m of ['execute', 'batch'] as const) {
    proto[m] = function (...args: unknown[]) {
      requetes++
      return origines[m].apply(this, args)
    }
  }
  const mesurer = async (soirees: number, profils: number) => {
    const h = await historique(soirees, profils)
    try {
      // Le recalcul d'abord ; puis les paliers, jugés profil par profil — hors du compte par soirée.
      requetes = 0
      const fait = await recalculerHistorique({ profiles: h.profiles, archives: h.archives, enCours: new Set() })
      assert.equal(fait?.soirees, soirees)
      // Chaque total dit la somme de ses lignes, en base comme en mémoire.
      const c = (h.profiles as any).client
      for (const id of h.ids) {
        const somme = Number((await c.execute({ sql: 'SELECT COALESCE(SUM(xp), 0) AS n FROM profile_xp WHERE profile_id = ?', args: [id] })).rows[0].n)
        assert.ok(somme > 0, 'chaque profil a gagné')
        assert.equal((await h.profiles.byId(id))?.xp, somme, 'le total suit ses lignes')
      }
      return requetes
    } finally {
      h.profiles.close()
      h.archives.close()
      rmSync(h.dir, { recursive: true, force: true })
    }
  }
  try {
    const peu = await mesurer(6, 3)
    const beaucoup = await mesurer(6, 12)
    // Neuf profils de plus dans chacune des six soirées : sur l'ancien
    // chemin, 6 × 9 × 2 = 108 requêtes de plus rien que pour les crédits.
    // Il ne reste que ce que chaque profil coûte une fois : ses paliers.
    assert.ok(
      beaucoup - peu <= 9 * 10,
      `neuf profils de plus coûtent ${beaucoup - peu} requêtes (${peu} → ${beaucoup}) : ils ne se paient plus par soirée`,
    )
    const plus = await mesurer(12, 3)
    console.log(`[recalcul] requêtes : 6 soirées × 3 profils ${peu}, × 12 profils ${beaucoup}, 12 soirées × 3 profils ${plus}`)
    assert.ok(plus - peu <= 6 * 4, `six soirées de plus coûtent ${plus - peu} requêtes : quelques-unes chacune, pas une par profil`)
  } finally {
    proto.execute = origines.execute
    proto.batch = origines.batch
  }
})
