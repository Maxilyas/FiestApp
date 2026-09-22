// Les suites de la première vague : ce que les chantiers précédents avaient
// laissé hors de leur périmètre. Chaque point est petit, et chacun mentait à
// la salle ou lâchait l'animateur :
//
// · un « 4 » sur l'écran commun pour un troisième ex æquo, un bilan qui ne
//   nommait qu'un vainqueur sur deux, deux cartes pour un même quiz gagné ;
// · un « � » au bout d'un nom d'équipe ou d'une unité ;
// · un export pendu cinq minutes devant une base muette, et un magasin que
//   l'arrêt du serveur ne refermait jamais ;
// · une soirée en cours datée de l'arrivée du mauvais invité ;
// · un téléphone prêté qui suffisait à voler un profil.
//
// Chaque test échouait avant sa correction. Les pages du client se vérifient
// par leur rendu HTML : deux de ces bogues n'existaient qu'à l'affichage, et
// c'est l'affichage que la salle lit.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo, Socket as TcpSocket } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  ADMIN,
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
} from './banc'
import type { QuizServerOptions } from '../src/server'
import { quizModule } from '../src/games/quiz'
import { buildReview } from '../src/core/review'
import { buildRecap } from '../src/core/recap'
import { initDb } from '../src/core/db'
import { Teams } from '../src/core/teams'
import { reviewFromDatabase } from '../src/core/export'
import { ProfileStore } from '../src/auth/profiles'
import type { AnswerRow } from '../src/core/answers'
import type { ScoreEntry } from '../src/core/scores'
import { toPlayable, type QuizQuestionDef } from '../../shared/library'
import type { PublicPlayer } from '../../shared/types'

// ── Le rendu des pages ────────────────────────────────────────────────────

/**
 * Charge un module du client, tel que la page le compile.
 *
 * Les composants sont écrits pour le navigateur. tsx les compile ici avec les
 * réglages du serveur, qui ne connaît pas le JSX : il le traduit en
 * `React.createElement`, d'où le React posé sur l'objet global. Le chemin est
 * calculé pour que le typecheck du serveur ne relise pas le client — celui-ci
 * a le sien.
 */
async function moduleDuClient(fichier: string): Promise<any> {
  Object.assign(globalThis, { React: (await import('react')).default })
  return import(new URL(`../../client/src/${fichier}.tsx`, import.meta.url).href)
}

/** Le HTML qu'un composant du client produit : ce que la salle lirait. */
async function rendu(fichier: string, composant: string, props: object): Promise<string> {
  const module = await moduleDuClient(fichier)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const React = (await import('react')).default
  return renderToStaticMarkup(React.createElement(module[composant], props))
}

/** Le texte d'un rendu, balises remplacées par des blancs : ce que l'œil lit. */
const texteDe = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

// ── 1. Le podium de l'écran commun ────────────────────────────────────────

/** Une fin de quiz jouée par ces invités, avec ces totaux — l'état tel que le module le garde. */
function finDeQuiz(totaux: Record<string, number>, noms: Record<string, string>) {
  // Le mémo d'une diffusion, comme le moteur le pose : né avec elle.
  const memo = new Map<string, unknown>()
  const vctx = {
    playerName: (id: string) => noms[id],
    player: (id: string): PublicPlayer => ({
      id,
      name: noms[id],
      avatar: '🦊',
      connected: true,
      score: totaux[id],
      teamId: null,
    }),
    memo: <T>(cle: string, calculer: () => T): T => {
      if (!memo.has(cle)) memo.set(cle, calculer())
      return memo.get(cle) as T
    },
  }
  const sess = {
    id: 'fin',
    spaceId: 'podium',
    status: 'running' as const,
    participantIds: Object.keys(totaux),
    state: {
      phase: 'finished',
      pack: { id: 'p', title: 'Fin', questions: [] },
      qIndex: 0,
      responses: {},
      lastAwards: {},
      totals: totaux,
      playFrom: {},
      multiplier: 1,
    },
  }
  return { sess: sess as any, vctx }
}

/** Les lignes d'un classement rendu : le rang affiché, puis le prénom. */
const lignesDuClassement = (html: string) =>
  [...html.matchAll(/<span class="lb-rank[^"]*">(\d+)<\/span>.*?<span class="lb-name">([^<]*)<\/span>/g)].map(m => [
    Number(m[1]),
    m[2],
  ])

test('le podium de l’écran commun porte le rang partagé : le quatrième ex æquo du troisième est troisième', async () => {
  const noms = { a: 'Alice', b: 'Bruno', c: 'Chloé', d: 'David', e: 'Emma' }
  const { sess, vctx } = finDeQuiz({ a: 300, b: 200, c: 100, d: 100, e: 50 }, noms)

  const classement = (quizModule.hostView(sess, vctx) as any).standings
  assert.deepEqual(
    classement.map((r: any) => [r.name, r.rank]),
    [
      ['Alice', 1],
      ['Bruno', 2],
      ['Chloé', 3],
      ['David', 3],
      ['Emma', 5],
    ],
    'chaque ligne porte son rang, calculé sur tout le classement',
  )
  // Les téléphones reçoivent le même podium de trois, rangs compris.
  const telephone = quizModule.playerView(sess, 'e', vctx) as any
  assert.deepEqual(
    telephone.podium.map((r: any) => r.rank),
    [1, 2, 3],
  )

  // Ce que l'écran commun affiche sous les trois marches : la liste reprend au
  // quatrième et déduisait son rang de sa seule position — « 4 » pour David,
  // pourtant troisième ex æquo avec Chloé.
  const sousLePodium = await rendu('components/Podium', 'Standings', { rows: classement.slice(3), offset: 3 })
  assert.deepEqual(lignesDuClassement(sousLePodium), [
    [3, 'David'],
    [5, 'Emma'],
  ])
})

// ── 2. Tous les vainqueurs, au bilan comme au souvenir ────────────────────

let horloge = 1_000
/** Chaque ligne arrive après la précédente : l'ordre du journal compte. */
const tic = () => ++horloge

function joueur(id: string, name: string, extra: Partial<PublicPlayer> = {}): PublicPlayer {
  return { id, name, avatar: '🦊', connected: false, score: 0, teamId: null, ...extra }
}

/** Une ligne du journal des réponses : par défaut, un QCM juste en 5 s au quiz « Culture ». */
function reponse(playerId: string, extra: Partial<AnswerRow> = {}): AnswerRow {
  return {
    sessionId: 's1',
    quizTitle: 'Culture',
    qIndex: 0,
    kind: 'choice',
    playerId,
    answered: true,
    correct: true,
    choice: 0,
    value: null,
    target: null,
    ms: 5_000,
    changes: 0,
    points: 0,
    durationMs: 20_000,
    observed: false,
    createdAt: tic(),
    ...extra,
  }
}

const faux = (playerId: string, extra: Partial<AnswerRow> = {}) => reponse(playerId, { correct: false, choice: 1, ...extra })

function gain(playerId: string, points: number, sessionId: string, reason: string): ScoreEntry {
  return { playerId, sessionId, points, reason, createdAt: tic() }
}

test('le bilan nomme tous les ex æquo d’un quiz, joueurs comme équipes', async () => {
  // Zoé marque à la première question, Alice à la seconde : 300 partout, et
  // chacune seule dans son équipe — les deux équipes finissent à égalité.
  const teams = [
    { id: 'zebres', name: 'Les Zèbres', emoji: '🦓', position: 0 },
    { id: 'aigles', name: 'Les Aigles', emoji: '🦅', position: 1 },
  ]
  const players = [
    joueur('zoe', 'Zoé', { avatar: '🐼', score: 300, teamId: 'zebres' }),
    joueur('alice', 'Alice', { score: 300, teamId: 'aigles' }),
  ]
  const rows = [
    reponse('zoe', { qIndex: 0, points: 300 }),
    faux('alice', { qIndex: 0 }),
    faux('zoe', { qIndex: 1 }),
    reponse('alice', { qIndex: 1, points: 300 }),
  ]
  const review = buildReview({ rows, players, teams, bonuses: [], packsBySession: new Map(), library: [] })
  const [quiz] = review.quizzes as any[]
  assert.deepEqual(
    quiz.winners,
    [
      { playerId: 'alice', points: 300 },
      { playerId: 'zoe', points: 300 },
    ],
    'les deux ex æquo, dans l’ordre commun',
  )
  assert.deepEqual(quiz.teamWinners, [
    { teamId: 'aigles', average: 300 },
    { teamId: 'zebres', average: 300 },
  ])
  // Une page restée ouverte pendant la mise à jour lit encore l'ancien champ.
  assert.equal(quiz.winner?.playerId, 'alice')

  const { makeCtx } = await moduleDuClient('components/BilanQuestion')
  const bilan = texteDe(await rendu('components/BilanRoom', 'RoomReview', { ctx: makeCtx(review) }))
  assert.match(bilan, /🦊 Alice et 🐼 Zoé remportent ce quiz ex æquo avec 300 pts/)
  assert.match(bilan, /meilleures équipes ex æquo : 🦅 Les Aigles et 🦓 Les Zèbres \(300 pts de moyenne\)/)
})

test('le souvenir accorde « 1 question marquée », et réunit les ex æquo d’un quiz sur une seule carte', async () => {
  // « Culture » : Alice et Zoé à 300, ex æquo. « Musique » : Bob, seul.
  const players = [
    joueur('alice', 'Alice', { score: 300 }),
    joueur('zoe', 'Zoé', { avatar: '🐼', score: 300 }),
    joueur('bob', 'Bob', { avatar: '🐸', score: 250 }),
  ]
  const scores = [
    gain('alice', 300, 's1', 'Quiz « Culture » — Q1'),
    gain('zoe', 300, 's1', 'Quiz « Culture » — Q2'),
    gain('bob', 250, 's2', 'Quiz « Musique » — Q1'),
  ]
  const answers = [
    reponse('alice', { qIndex: 0, points: 300 }),
    faux('zoe', { qIndex: 0 }),
    faux('alice', { qIndex: 1 }),
    reponse('zoe', { qIndex: 1, points: 300 }),
    reponse('bob', { sessionId: 's2', quizTitle: 'Musique', points: 250 }),
  ]
  const recap = buildRecap({ players, teams: [], bonuses: [], scores, answers })
  assert.equal(recap.steadiest?.count, 1, 'chacun n’a marqué qu’une fois')

  const souvenir = texteDe(await rendu('components/Trophies', 'Trophies', { recap }))
  assert.match(souvenir, /🦊 Alice — 1 question marquée /)
  assert.doesNotMatch(souvenir, /1 questions/)
  assert.equal(souvenir.match(/de ce quiz/g)?.length, 2, `une carte par quiz, pas une par vainqueur : ${souvenir}`)
  assert.match(souvenir, /Culture 🦊 Alice et 🐼 Zoé — 300 points Vainqueurs ex æquo de ce quiz/)
  assert.match(souvenir, /Musique 🐸 Bob — 250 points Vainqueur de ce quiz/)
})

// ── 3. Couper un texte sans couper un caractère ───────────────────────────

/** Un dossier jetable, effacé quoi qu'il arrive. */
async function dansUnDossier(fn: (dir: string) => Promise<void> | void) {
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-finitions-'))
  try {
    await fn(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** Un demi-emoji : la moitié d'une paire de substitution, que l'écran affiche « � ». */
const DEMI_CARACTERE = /[\ud800-\udfff]/u

test('les noms et les emojis d’équipe se coupent entre deux caractères, jamais dans un emoji', async () => {
  await dansUnDossier(dir => {
    const db = initDb(path.join(dir, 'locale.db'))
    try {
      const teams = new Teams(db, 'espace')
      const x19 = 'X'.repeat(19)
      const creee = teams.create(`${x19}🎉🎉`, '⭐🎉🎉')
      if ('error' in creee) throw new Error(creee.error)
      assert.equal(creee.name, `${x19}🎉`, 'vingt caractères tiennent, emoji compris')
      assert.equal(creee.emoji, '⭐🎉🎉', 'trois emojis tiennent dans quatre caractères')

      teams.update(creee.id, { name: `${'Y'.repeat(19)}🇫🇷`, emoji: '🏳️‍🌈' })
      const [modifiee] = teams.all()
      assert.equal(modifiee.name, 'Y'.repeat(19), 'un drapeau ne se coupe pas en deux lettres')
      assert.equal(modifiee.emoji, '🏳️‍🌈', 'le drapeau arc-en-ciel reste entier')

      // Et la base dit la même chose : c'est elle qu'on relit au réveil.
      const [relue] = new Teams(db, 'espace').all()
      assert.deepEqual([relue.name, relue.emoji], [modifiee.name, modifiee.emoji])
      for (const s of [creee.name, creee.emoji, modifiee.name, modifiee.emoji]) {
        assert.ok(!DEMI_CARACTERE.test(s), `demi-caractère dans « ${s} »`)
      }
    } finally {
      db.close()
    }
  })
})

test('l’unité d’une estimation jouée se coupe entre deux caractères', () => {
  const estimation: QuizQuestionDef = {
    kind: 'number',
    text: 'Combien de parts ?',
    answers: [],
    correct: 0,
    target: 8,
    unit: '',
    duration: 20,
    image: null,
    observeSeconds: null,
  }
  const unite = (unit: string) => {
    const jouable = toPlayable({ ...estimation, unit })
    assert.equal(jouable?.kind, 'number')
    return jouable?.kind === 'number' ? jouable.unit : ''
  }
  assert.equal(unite(`p${'🍕'.repeat(6)}`), `p${'🍕'.repeat(6)}`, 'sept caractères tiennent dans douze')
  assert.equal(unite(`parts de ${'🍕'.repeat(4)}`), `parts de ${'🍕'.repeat(3)}`, 'le treizième part entier')
  assert.ok(!DEMI_CARACTERE.test(unite(`parts de ${'🍕'.repeat(4)}`)))
})

// ── 4. L'export devant une base muette ────────────────────────────────────

test('l’export depuis une base muette échoue dans le délai, au lieu d’attendre cinq minutes', async () => {
  // Une fausse base Turso qui accepte la connexion et ne répond jamais : la
  // panne qu'on a mesurée, 301 secondes d'attente sans un mot.
  const ouvertes = new Set<TcpSocket>()
  const base: Server = createServer(() => {})
  base.on('connection', s => ouvertes.add(s))
  await new Promise<void>(r => base.listen(0, '127.0.0.1', r))
  const { port } = base.address() as AddressInfo
  try {
    const debut = Date.now()
    const issue = await Promise.race([
      reviewFromDatabase(`http://127.0.0.1:${port}`, 'jeton-essai', { slug: 'fete' }).then(
        () => 'répondu',
        (e: unknown) => e,
      ),
      new Promise(r => setTimeout(() => r('toujours en attente'), 15_000)),
    ])
    assert.ok(issue instanceof Error, `l’export devait échouer dans le délai ; il est : ${String(issue)}`)
    assert.match(issue.message, /n’a pas répondu/, 'un message qui dit ce qui se passe')
    assert.ok(Date.now() - debut < 14_000, `échec attendu en ~10 s, arrivé en ${Date.now() - debut} ms`)
  } finally {
    for (const s of ouvertes) s.destroy()
    await new Promise(r => base.close(r))
  }
})

// ── 5. Le magasin des profils se referme ──────────────────────────────────

test('le magasin des profils se ferme, et l’arrêt du serveur le ferme', async () => {
  await dansUnDossier(async dir => {
    const profils = new ProfileStore(`file:${path.join(dir, 'permanente.db').replace(/\\/g, '/')}`)
    await profils.init()
    const fermer = (profils as any).close
    assert.equal(typeof fermer, 'function', 'ProfileStore.close() doit exister')
    fermer.call(profils)
    await assert.rejects(profils.byLogin('personne'), /closed/i, 'un magasin fermé ne lit plus la base')
  })

  // Le serveur qui s'arrête le ferme, à côté des comptes.
  const prototype = ProfileStore.prototype as any
  const origine = prototype.close
  let fermetures = 0
  prototype.close = function (this: unknown) {
    fermetures++
    return origine?.call(this)
  }
  try {
    const banc = await demarrer()
    await banc.close()
  } finally {
    if (origine) prototype.close = origine
    else delete prototype.close
  }
  assert.equal(fermetures, 1, 'createQuizServer().close() ferme le magasin des profils')
})

// ── 6. Le début de la soirée en cours ─────────────────────────────────────

/** Un serveur jetable le temps d'un test, refermé quoi qu'il arrive. */
async function avecBanc(scenario: (banc: Banc) => Promise<void>, opts: Partial<QuizServerOptions> = {}) {
  const banc = await demarrer(opts)
  try {
    await scenario(banc)
  } finally {
    await banc.close()
  }
}

test('l’historique date la soirée en cours de son début figé, pas du premier invité encore là', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [qcm('On y est ?')])
    const host = await ecranCommun(banc.url, cookie)
    // Le téléphone d'essai de l'animateur arrive le premier — c'est toujours lui.
    const essai = await invite(banc.url, 'Test', '🤖')
    await patienter(20)
    const alice = await invite(banc.url, 'Alice')

    const sessionId = await lancerQuiz(host, quiz)
    await attendre(alice.socket, 'session:view', (p: any) => p.view.phase === 'question', 'la question')
    const revelee = attendre<any>(host, 'session:view', p => p.view.phase === 'reveal', 'la révélation')
    for (const qui of [alice, essai]) {
      assert.equal((await emitAck<any>(qui.socket, 'player:action', { sessionId, action: { type: 'answer', choice: 0 } })).ok, true)
    }
    await revelee
    ;(host as any).emit('host:endSession', { sessionId })

    // « Sauvegarder » fige le nom de la soirée, et son heure de début.
    const rangee = attendre<any>(host, 'toast', () => true, 'la soirée rangée', 15_000)
    ;(host as any).emit('host:archiveParty', {})
    assert.equal((await rangee).kind, 'info')
    // Puis l'animateur exclut son téléphone d'essai.
    const exclu = attendre(essai.socket, 'player:removed', () => true, 'l’exclusion du téléphone d’essai')
    ;(host as any).emit('host:removePlayer', { playerId: essai.playerId })
    await exclu

    const { current, archives } = (await (await fetch(`${banc.url}/s/${ADMIN.slug}/soirees.json`)).json()) as any
    assert.equal(archives.length, 1)
    assert.ok(current, 'la soirée continue après la sauvegarde')
    assert.equal(current.since, archives[0].heldAt, 'la soirée en cours et son archive disent la même heure de début')
  }))

// ── 7. Changer le mot de passe d'un profil ────────────────────────────────

/** Une écriture venue d'une adresse donnée, telle que le proxy de l'hébergeur la rapporte. */
function depuis(banc: Banc, ip: string, chemin: string, body: unknown, cookie?: string) {
  return fetch(`${banc.url}${chemin}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'quizz',
      'X-Forwarded-For': ip,
      ...(cookie && { Cookie: cookie }),
    },
    body: JSON.stringify(body),
  })
}

test('changer le mot de passe d’un profil demande l’actuel, ou le code de secours', () =>
  avecBanc(async banc => {
    const inscrite = await ecrire(banc.url, '/api/joueur/inscription', {
      login: 'lea',
      password: 'motdepasse1',
      name: 'Léa',
      avatar: '🦉',
    })
    assert.equal(inscrite.status, 201)
    const { recovery } = (await inscrite.json()) as { recovery: string }
    let cookie = cookieDe(inscrite, 'qz_joueur')
    const changer = (corps: object) => ecrire(banc.url, '/api/joueur/mot-de-passe', corps, cookie)
    const ouvre = async (password: string) =>
      (await ecrire(banc.url, '/api/joueur/connexion', { login: 'lea', password })).status

    // Le téléphone prêté en soirée : la session d'un an suffisait.
    const sans = await changer({ next: 'vole-pour-de-bon' })
    assert.equal(sans.status, 400, 'sans le mot de passe actuel, rien ne change')
    assert.match(((await sans.json()) as any).error, /mot de passe actuel/)
    const rate = await changer({ current: 'pas-le-bon', next: 'vole-pour-de-bon' })
    // 400 et pas 401 : la page lirait un 401 comme une session perdue.
    assert.equal(rate.status, 400, 'un mot de passe actuel faux non plus')
    assert.equal(await ouvre('vole-pour-de-bon'), 401)
    assert.equal(await ouvre('motdepasse1'), 200, 'l’ancien mot de passe ouvre toujours le profil')

    // Qui connaît le sien le change.
    const bon = await changer({ current: 'motdepasse1', next: 'nouveau-mdp-2' })
    assert.equal(bon.status, 200)
    cookie = cookieDe(bon, 'qz_joueur')
    assert.equal(await ouvre('motdepasse1'), 401)
    assert.equal(await ouvre('nouveau-mdp-2'), 200)

    // Qui l'a oublié passe par son code de secours — qui se consomme.
    const parCode = await changer({ code: recovery, next: 'troisieme-mdp-3' })
    assert.equal(parCode.status, 200)
    const { recovery: neuf } = (await parCode.json()) as { recovery?: string }
    assert.ok(neuf && neuf !== recovery, 'un code neuf remplace celui qui a servi')
    cookie = cookieDe(parCode, 'qz_joueur')
    assert.equal(await ouvre('troisieme-mdp-3'), 200)
    assert.equal((await changer({ code: recovery, next: 'quatrieme-mdp-4' })).status, 400, 'un code servi ne vaut plus rien')
  }))

test('les essais ratés comptent dans la réserve de la connexion au profil', () =>
  avecBanc(
    async banc => {
      const cookie = await inscrireProfil(banc.url, 'max', 'Max')
      for (let i = 0; i < 5; i++) {
        const rate = await depuis(banc, '203.0.113.70', '/api/joueur/mot-de-passe', { current: `essai-${i}`, next: 'nouveau-mdp-9' }, cookie)
        assert.equal(rate.status, 400, `essai ${i + 1} refusé`)
      }
      // Cinq échecs : le profil est fermé un quart d'heure, par quelque porte qu'on revienne.
      const connexion = await depuis(banc, '198.51.100.71', '/api/joueur/connexion', { login: 'max', password: 'motdepasse1' })
      assert.equal(connexion.status, 429, 'la connexion au profil paie les essais du changement')
      const change = await depuis(banc, '198.51.100.72', '/api/joueur/mot-de-passe', { current: 'motdepasse1', next: 'nouveau-mdp-9' }, cookie)
      assert.equal(change.status, 429, 'même le bon mot de passe attend son tour')
    },
    { online: true },
  ))

// ── 8. À l'intégration ────────────────────────────────────────────────────
//
// Trois restes, trouvés en réunissant les chantiers.

test('un même quiz rejoué et gagné au même score par quelqu’un d’autre garde deux cartes', async () => {
  // « Culture » joué deux fois : Alice gagne la première partie, Bob la
  // seconde, au même score. Regroupées par titre et par score, leurs deux
  // victoires devenaient une seule carte « ex æquo » — qu'elles n'étaient pas.
  const players = [joueur('alice', 'Alice', { score: 300 }), joueur('bob', 'Bob', { avatar: '🐸', score: 300 })]
  const scores = [gain('alice', 300, 's1', 'Quiz « Culture » — Q1'), gain('bob', 300, 's3', 'Quiz « Culture » — Q1')]
  const answers = [reponse('alice', { points: 300 }), reponse('bob', { sessionId: 's3', points: 300 })]
  const recap = buildRecap({ players, teams: [], bonuses: [], scores, answers })
  assert.deepEqual(
    recap.quizWinners.map(v => v.sessionId),
    ['s1', 's3'],
    'chaque vainqueur dit de quelle partie il vient',
  )
  const souvenir = texteDe(await rendu('components/Trophies', 'Trophies', { recap }))
  assert.equal(souvenir.match(/de ce quiz/g)?.length, 2, `deux parties, deux cartes : ${souvenir}`)
  assert.doesNotMatch(souvenir, /ex æquo/)
})

test('changer le mot de passe d’un compte compte ses échecs, comme la connexion', () =>
  avecBanc(
    async banc => {
      const cookie = await connexionAnimateur(banc.url)
      // Un portable resté ouvert sur « Mon compte » : la session est là, pas le mot de passe.
      for (let i = 0; i < 5; i++) {
        const rate = await depuis(banc, '203.0.113.80', '/api/auth/password', { current: `essai-${i}`, next: 'nouveau-mdp-9' }, cookie)
        assert.equal(rate.status, 400, `essai ${i + 1} refusé`)
      }
      const change = await depuis(banc, '198.51.100.81', '/api/auth/password', { current: ADMIN.password, next: 'nouveau-mdp-9' }, cookie)
      assert.equal(change.status, 429, 'même le bon mot de passe attend son tour')
      const connexion = await depuis(banc, '198.51.100.82', '/api/auth/login', { login: ADMIN.login, password: ADMIN.password })
      assert.equal(connexion.status, 429, 'la connexion paie les essais du changement')
    },
    { online: true },
  ))

test('ce qu’on range se coupe entre deux caractères : titre et unité d’un quiz', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    // Treize unités UTF-16 pour sept caractères : la coupe à douze unités
    // laissait une moitié d'emoji en base, que plus rien ne réparait.
    const unite = 'p' + '🍕'.repeat(6)
    // Quatre-vingt-un caractères, quatre-vingt-une paires moins une.
    const titre = 'T' + '🎉'.repeat(80)
    const id = await creerQuiz(
      banc.url,
      cookie,
      [{ kind: 'number', text: 'Combien ?', target: 3, unit: unite, duration: 20, image: null, answers: [], correct: 0 }],
      titre,
    )
    const quiz = (await (await fetch(`${banc.url}/api/quizzes/${id}`, { headers: { Cookie: cookie } })).json()) as any
    const demiCaractere = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/
    assert.doesNotMatch(quiz.title, demiCaractere, 'aucun demi-emoji au bout du titre')
    assert.equal(Array.from(quiz.title as string).length, 80, 'quatre-vingts caractères, pas quatre-vingts unités')
    assert.equal(quiz.questions[0].unit, unite, 'sept caractères tiennent dans douze')
  }))
