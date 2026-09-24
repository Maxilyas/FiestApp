// Tenir une grande salle : ce que coûte une réponse, une veille, une arrivée.
// Rien n'est chronométré ici — une machine chargée ferait échouer un test qui
// mesure des millisecondes. On compte : les vues calculées, les écritures de
// l'état, les messages que reçoit chacun.
import { after, afterEach, before, mock, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  ADMIN,
  attendre,
  connecter,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  emitAck,
  inscrireProfil,
  instantane,
  invite,
  lancerQuiz,
  patienter,
  qcm,
  type Banc,
  type Socket,
} from './banc'
import { initDb, type DB } from '../src/core/db'
import { Party } from '../src/core/party'
import { ScoreLedger } from '../src/core/scores'
import { AnswerLog } from '../src/core/answers'
import { GameEngine } from '../src/core/engine'
import { quizModule, setQuizLibrary } from '../src/games/quiz'
import type { GameModule } from '../src/core/types'
import { ProfileStore } from '../src/auth/profiles'
import { enParallele } from '../src/core/space'

// ── Le moteur seul, sur une vraie base et un faux `io` qui écoute ─────────

const QUIZ = {
  id: 'salle',
  title: 'Grande salle',
  updatedAt: 0,
  questions: [0, 1, 2].map(i => ({
    id: `q${i}`,
    kind: 'choice',
    text: `Question ${i + 1} ?`,
    answers: ['A', 'B', 'C', 'D'],
    correct: i % 4,
    target: null,
    unit: '',
    duration: 20,
    image: null,
    observeSeconds: null,
    category: null,
  })),
}

interface Salle {
  engine: GameEngine
  ids: string[]
  sid: string
  db: DB
  /** Ce que chaque salon a reçu, dans l'ordre (`player:<rang>`, `hosts`). */
  recu: Map<string, unknown[]>
  /** Vues de téléphone calculées depuis le début. */
  vuesCalculees(): number
  /** Écritures de l'état de la partie dans la base locale. */
  ecritures(): number
  fermer(): void
}

/**
 * Une salle de `n` invités au compte à rebours d'un quiz. Les horloges sont
 * simulées : deux salles jouées côte à côte voient les mêmes heures, donc les
 * mêmes vues.
 */
function salle(n: number, module: GameModule = quizModule): Salle {
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-grande-salle-'))
  const db = initDb(path.join(dir, 'locale.db'))
  const spaceId = `salle-${Math.random().toString(36).slice(2)}`
  setQuizLibrary(spaceId, [QUIZ as any])
  const party = new Party(db, spaceId)
  const ids: string[] = []
  for (let i = 0; i < n; i++) {
    const rec = party.join(`Invité ${i}`, '🦊', undefined, null)
    if ('error' in rec) throw new Error(rec.error)
    ids.push(rec.id)
    party.socketConnected(rec.id, `sock-${i}`)
  }
  // Les salons se nomment par le rang de l'invité : deux salles se comparent.
  const rang = new Map(ids.map((id, i) => [`player:${id}`, `player:${i}`]))
  const recu = new Map<string, unknown[]>()
  const io = {
    to: (salon: string) => ({
      emit: (_event: string, payload: any) => {
        const cle = rang.get(salon) ?? (salon.startsWith('hosts:') ? 'hosts' : salon)
        const { sessionId: _sid, ...reste } = payload ?? {}
        recu.set(cle, [...(recu.get(cle) ?? []), JSON.parse(JSON.stringify(reste))])
      },
    }),
  }
  let vues = 0
  const compte: GameModule = {
    ...module,
    playerView: (sess, id, vctx) => {
      vues++
      return module.playerView(sess, id, vctx)
    },
  }
  let ecritures = 0
  const prepare = db.prepare.bind(db)
  ;(db as any).prepare = (sql: string) => {
    const st = prepare(sql)
    if (!sql.includes('INSERT INTO sessions')) return st
    const run = st.run.bind(st)
    ;(st as any).run = (...args: unknown[]) => {
      ecritures++
      return run(...(args as []))
    }
    return st
  }
  const engine = new GameEngine(
    {
      db,
      io: io as any,
      spaceId,
      party,
      ledger: new ScoreLedger(db, spaceId),
      answers: new AnswerLog(db, spaceId),
      onScoresChanged: () => {},
      onSessionChanged: () => {},
      onSessionEnded: () => {},
      onVerdict: () => {},
    },
    compte,
  )
  const sid = engine.launch()
  engine.handleHostCommand(sid, { type: 'selectPack', packId: 'salle' })
  return {
    engine,
    ids,
    sid,
    db,
    recu,
    vuesCalculees: () => vues,
    ecritures: () => ecritures,
    fermer() {
      engine.stop()
      db.close()
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

const derniere = (s: Salle, cle: string) => s.recu.get(cle)?.at(-1) as any
/** Le compte à rebours passe : la première question s'ouvre. */
const ouvrir = () => mock.timers.tick(3000)

afterEach(() => mock.timers.reset())

test('une réponse ne recalcule que la vue de son auteur', () => {
  mock.timers.enable({ apis: ['setTimeout', 'setImmediate', 'Date'], now: 1_000_000 })
  const s = salle(30)
  ouvrir()
  try {
    assert.equal(derniere(s, 'player:0')?.view.phase, 'question')
    for (let i = 0; i < 29; i++) {
      const avant = s.vuesCalculees()
      assert.equal(s.engine.handlePlayerAction(s.sid, s.ids[i], { type: 'answer', choice: i % 4 }), null)
      // Mesuré avant : 30 vues par réponse, soit 900 pour une question à 30,
      // et 250 000 à 500 invités — pour n'en envoyer qu'une.
      assert.equal(s.vuesCalculees() - avant, 1, `réponse ${i + 1} : une seule vue calculée`)
      assert.equal(derniere(s, `player:${i}`)?.view.yourChoice, i % 4, 'et son auteur la reçoit')
    }
    // Le dernier arme le souffle avant la révélation : un changement de
    // chronomètres, que toute la salle suit.
    const avant = s.vuesCalculees()
    s.engine.handlePlayerAction(s.sid, s.ids[29], { type: 'answer', choice: 1 })
    assert.equal(s.vuesCalculees() - avant, 30, 'le dernier à répondre repasse par le chemin complet')
  } finally {
    s.fermer()
  }
})

test('la salle reçoit exactement les mêmes vues, recalculées ou non', () => {
  mock.timers.enable({ apis: ['setTimeout', 'setImmediate', 'Date'], now: 1_000_000 })
  // La même soirée, jouée côte à côte : l'une par un module qui promet que la
  // vue d'un invité ne dépend pas des autres, l'autre par le chemin complet.
  const ciblee = salle(30)
  const complete = salle(30, { ...quizModule, vueDependDesAutres: undefined })
  ouvrir()
  const deux = [ciblee, complete]
  const jouer = (i: number, action: unknown) =>
    deux.map(s => s.engine.handlePlayerAction(s.sid, s.ids[i], action))
  const commande = (command: unknown) => deux.forEach(s => s.engine.handleHostCommand(s.sid, command))
  const comparer = (etape: string) => {
    for (let i = 0; i < 30; i++) {
      assert.deepEqual(ciblee.recu.get(`player:${i}`), complete.recu.get(`player:${i}`), `${etape} : invité ${i}`)
    }
    // L'écran commun reçoit moins de vues, mais la dernière est la même.
    assert.deepEqual(derniere(ciblee, 'hosts'), derniere(complete, 'hosts'), `${etape} : écran commun`)
  }
  try {
    for (let q = 0; q < 3; q++) {
      for (let i = 0; i < 25; i++) {
        mock.timers.tick(37)
        const refus = jouer(i, { type: 'answer', choice: (i + q) % 4, qIndex: q })
        assert.equal(refus[0], refus[1])
      }
      // Des invités qui se ravisent, qui retapent la même case, qui visent
      // une question passée, ou qui n'envoient rien de lisible.
      jouer(3, { type: 'answer', choice: 2, qIndex: q })
      jouer(4, { type: 'answer', choice: (4 + q) % 4, qIndex: q })
      jouer(5, { type: 'answer', choice: 1, qIndex: q - 1 })
      jouer(6, { type: 'answer', choice: 99 })
      mock.timers.tick(300)
      comparer(`question ${q + 1}`)
      commande({ type: 'next' }) // révéler
      mock.timers.tick(300)
      comparer(`révélation ${q + 1}`)
      commande({ type: 'next' }) // suivante, ou le podium
      mock.timers.tick(300)
      comparer(`après la révélation ${q + 1}`)
    }
    assert.equal(derniere(ciblee, 'player:0')?.view.phase, 'finished')
    assert.ok(ciblee.vuesCalculees() < complete.vuesCalculees() / 5, 'pour bien moins de vues calculées')
  } finally {
    ciblee.fermer()
    complete.fermer()
  }
})

test('l’écran commun reçoit le compteur de réponses quatre fois par seconde au plus, et le dernier compte', () => {
  mock.timers.enable({ apis: ['setTimeout', 'setImmediate', 'Date'], now: 1_000_000 })
  const s = salle(30)
  ouvrir()
  try {
    const avant = s.recu.get('hosts')?.length ?? 0
    mock.timers.tick(1000)
    // Vingt réponses dans la même seconde : l'écran commun se redessinait
    // vingt fois. Il en reçoit une tout de suite, puis une au bout de sa
    // fenêtre, avec le compte juste.
    for (let i = 0; i < 20; i++) s.engine.handlePlayerAction(s.sid, s.ids[i], { type: 'answer', choice: 0 })
    assert.ok((s.recu.get('hosts')?.length ?? 0) - avant <= 1, 'une vue au plus pendant la rafale')
    mock.timers.tick(250)
    const recues = (s.recu.get('hosts')?.length ?? 0) - avant
    assert.ok(recues <= 2, `deux vues en tout, pas vingt (vu : ${recues})`)
    assert.equal(derniere(s, 'hosts')?.view.answeredCount, 20, 'la dernière porte le compte juste')
    // Une révélation n'attend pas sa fenêtre.
    s.engine.handlePlayerAction(s.sid, s.ids[20], { type: 'answer', choice: 0 })
    s.engine.handleHostCommand(s.sid, { type: 'next' })
    assert.equal(derniere(s, 'hosts')?.view.phase, 'reveal', 'la révélation part sur-le-champ')
    assert.equal(derniere(s, 'hosts')?.view.answeredCount, 21)
  } finally {
    s.fermer()
  }
})

test('les réponses lues dans le même tour s’écrivent une fois, et l’arrêt n’en perd aucune', () => {
  mock.timers.enable({ apis: ['setTimeout', 'setImmediate', 'Date'], now: 1_000_000 })
  const s = salle(30)
  ouvrir()
  try {
    const avant = s.ecritures()
    for (let i = 0; i < 20; i++) s.engine.handlePlayerAction(s.sid, s.ids[i], { type: 'answer', choice: 1 })
    mock.timers.tick(0)
    // Mesuré avant : vingt écritures de l'état entier de la partie.
    assert.equal(s.ecritures() - avant, 1, 'une écriture pour la rafale')
    const etat = () => {
      const row = s.db.prepare('SELECT state FROM sessions WHERE id = ?').get(s.sid) as { state: string }
      return JSON.parse(row.state)
    }
    assert.equal(Object.keys(etat().responses).length, 20, 'et elle porte les vingt réponses')

    // Une réponse retenue, puis l'arrêt avant la fin du tour : elle est écrite.
    s.engine.handlePlayerAction(s.sid, s.ids[20], { type: 'answer', choice: 1 })
    s.engine.stop()
    assert.equal(Object.keys(etat().responses).length, 21, 'l’arrêt écrit la réponse qui attendait')
  } finally {
    s.fermer()
  }
})

test('une panne dans l’écriture regroupée ou dans la vue de l’écran commun se journalise, sans rien faire tomber', () => {
  mock.timers.enable({ apis: ['setTimeout', 'setImmediate', 'Date'], now: 1_000_000 })
  // Ces deux rappels partent hors de tout `ecouter()` : une exception y
  // remontait au filet global, et tuait le processus avant `poserLeFilet`.
  let casse = false
  const s = salle(30, {
    ...quizModule,
    hostView: (sess, vctx) => {
      if (casse) throw new Error('vue cassée')
      return quizModule.hostView(sess, vctx)
    },
  })
  const erreurs = mock.method(console, 'error', () => {})
  ouvrir()
  try {
    mock.timers.tick(1000)
    // L'écriture regroupée : la base locale refuse.
    ;(s.engine as any).persist = () => {
      throw new Error('disque plein')
    }
    s.engine.handlePlayerAction(s.sid, s.ids[0], { type: 'answer', choice: 0 })
    assert.doesNotThrow(() => mock.timers.tick(0), 'l’écriture en panne ne remonte pas')
    assert.equal(erreurs.mock.callCount(), 1, 'elle est journalisée')
    delete (s.engine as any).persist

    // La vue de l'écran commun, à la fin de sa fenêtre.
    s.engine.handlePlayerAction(s.sid, s.ids[1], { type: 'answer', choice: 0 })
    casse = true
    assert.doesNotThrow(() => mock.timers.tick(250), 'la vue en panne ne remonte pas')
    assert.equal(erreurs.mock.callCount(), 2, 'elle est journalisée')
  } finally {
    erreurs.mock.restore()
    s.fermer()
  }
})

test('une horloge qui recule ne bloque pas le compteur de l’écran commun', () => {
  mock.timers.enable({ apis: ['setTimeout', 'setImmediate', 'Date'], now: 1_000_000 })
  const s = salle(30)
  ouvrir()
  try {
    mock.timers.tick(1000)
    s.engine.handlePlayerAction(s.sid, s.ids[0], { type: 'answer', choice: 0 })
    assert.equal(derniere(s, 'hosts')?.view.answeredCount, 1)
    // L'heure de la machine recule de dix secondes (une synchronisation
    // NTP) : la fenêtre se calculait à dix secondes et quart.
    mock.timers.setTime(Date.now() - 10_000)
    s.engine.handlePlayerAction(s.sid, s.ids[1], { type: 'answer', choice: 0 })
    mock.timers.tick(250)
    assert.equal(derniere(s, 'hosts')?.view.answeredCount, 2, 'le compte part au bout de sa fenêtre, pas dix secondes plus tard')
  } finally {
    s.fermer()
  }
})

test('les crédits en parallèle : le premier échec remonte, les suivants se journalisent, et tous finissent', async () => {
  const erreurs = mock.method(console, 'error', () => {})
  try {
    const finis: number[] = []
    const lot = enParallele([0, 1, 2, 3, 4, 5], 2, async i => {
      await new Promise(r => setImmediate(r))
      finis.push(i)
      if (i % 2 === 1) throw new Error(`profil ${i} en panne`)
      return i
    })
    await assert.rejects(lot, /profil 1 en panne/, 'le premier échec va à qui a demandé le lot')
    assert.deepEqual([...finis].sort(), [0, 1, 2, 3, 4, 5], 'tous ont fini avant que le lot ne rende')
    // Mesuré avant : seul le premier était écrit quelque part.
    const lus = erreurs.mock.calls.map(c => c.arguments.map(a => String((a as Error)?.message ?? a)).join(' '))
    assert.ok(lus.some(l => l.includes('profil 3 en panne')), 'le deuxième est journalisé')
    assert.ok(lus.some(l => l.includes('profil 5 en panne')), 'le troisième aussi')
  } finally {
    erreurs.mock.restore()
  }
})

// ── Un vrai serveur : l'instantané de la salle ────────────────────────────

let banc: Banc
let cookie: string
const ouverts: Socket[] = []

before(async () => {
  banc = await demarrer()
  cookie = await connexionAnimateur(banc.url)
})

after(async () => {
  for (const s of ouverts) s.close()
  await banc.close()
})

test('la veille d’un téléphone ne repart qu’à l’écran commun', async () => {
  const host = await ecranCommun(banc.url, cookie)
  ouverts.push(host)
  const invites = []
  for (let i = 0; i < 6; i++) {
    const inv = await invite(banc.url, `Veilleur ${i}`, '🐼')
    ouverts.push(inv.socket)
    invites.push(inv)
  }
  const tel = invites[0].socket
  const snap = await instantane<any>(tel, s => s.players.length >= 6, 'la salle au complet')
  // Qui dort, qui veille : l'affaire de l'écran commun. Un téléphone qui le
  // recevait devait recevoir aussi chaque veille de chacun — à 300 invités,
  // un gigaoctet pour une vague d'arrivées.
  assert.ok(
    snap.players.every((p: any) => !('connected' in p)),
    'l’instantané d’un téléphone ne dit pas qui est connecté',
  )
  const hote = await instantane<any>(host, s => s.players.length >= 6)
  assert.ok(hote.players.every((p: any) => typeof p.connected === 'boolean'), 'celui de l’écran commun, si')

  // La salle au complet chez chacun, pas seulement chez le premier : la même
  // diffusion peut encore être en route vers les autres, et elle serait
  // comptée comme une veille.
  await Promise.all(invites.map(i => instantane<any>(i.socket, s => s.players.length >= 6, 'la salle au complet')))
  let recus = 0
  const compter = () => recus++
  for (const inv of invites.slice(0, 5)) inv.socket.on('party:snapshot', compter)
  const dormeur = invites[5]
  dormeur.socket.close()
  await instantane<any>(
    host,
    s => s.players.find((p: any) => p.id === dormeur.playerId)?.connected === false,
    'l’écran commun voit la veille',
  )
  await patienter(150)
  assert.equal(recus, 0, 'les autres téléphones ne reçoivent rien')

  // Le dormeur se réveille : connexion neuve, il se re-présente. La salle
  // n'a pas changé pour les téléphones, mais lui doit avoir la sienne.
  const reveil = await invite(banc.url, 'ignoré', '🐼', { token: dormeur.token })
  ouverts.push(reveil.socket)
  assert.equal(reveil.playerId, dormeur.playerId)
  const sien = await instantane<any>(reveil.socket, s => s.players.some((p: any) => p.id === dormeur.playerId))
  assert.equal(sien.players.length, 6, 'le réveillé retrouve toute la salle')
  await instantane<any>(host, s => s.players.find((p: any) => p.id === dormeur.playerId)?.connected === true)
  await patienter(150)
  assert.equal(recus, 0, 'et son retour ne repart pas non plus aux autres')

  // Une arrivée, elle, change la salle de tout le monde.
  const nouvelle = await invite(banc.url, 'Nouvelle', '🐸')
  ouverts.push(nouvelle.socket)
  await attendre<any>(tel, 'party:snapshot', s => s.players.length === 7, 'l’arrivée vue des téléphones')
})

test('un téléphone qui rejoint reçoit l’instantané de la salle, même sans l’avoir suivie', async () => {
  // Une page qui se re-présente sans repasser par `party:watch` : la salle
  // n'a pas bougé pour les téléphones, le regroupement n'envoie donc rien,
  // et c'est la réponse au `join` qui doit porter la salle.
  const premier = await invite(banc.url, 'Témoin', '🦁')
  ouverts.push(premier.socket)
  await instantane<any>(premier.socket, s => s.players.some((p: any) => p.id === premier.playerId), 'son arrivée')
  premier.socket.close()
  const host = await ecranCommun(banc.url, cookie)
  ouverts.push(host)
  await instantane<any>(
    host,
    s => s.players.find((p: any) => p.id === premier.playerId)?.connected === false,
    'l’écran commun voit la veille',
  )
  const socket = connecter(banc.url)
  ouverts.push(socket)
  const ack = await emitAck<any>(socket, 'player:join', { slug: ADMIN.slug, token: premier.token })
  assert.equal(ack.ok, true)
  const snap = await instantane<any>(socket, s => s.players.some((p: any) => p.id === premier.playerId), 'la salle')
  assert.ok(snap.players.length >= 1)
})

test('la clôture crédite plusieurs profils à la fois, et chacun a sa fin', async () => {
  // Chaque crédit attend quelques allers-retours vers la base permanente :
  // on les rend lents, comme un Turso lointain, et on compte combien sont
  // en vol en même temps. En série, cent profils à 30 ms faisaient attendre
  // quinze secondes la salle qui voulait lire « c'est fini ».
  const proto = ProfileStore.prototype as any
  const credit = proto.creditSoiree
  const tirage = ProfileStore.tirageEclat
  ProfileStore.tirageEclat = () => false
  let enVol = 0
  let auPlus = 0
  let credits = 0
  proto.creditSoiree = async function (...args: unknown[]) {
    enVol++
    auPlus = Math.max(auPlus, enVol)
    try {
      await patienter(20)
      return await credit.apply(this, args)
    } finally {
      enVol--
      credits++
    }
  }
  try {
    const host = await ecranCommun(banc.url, cookie)
    ouverts.push(host)
    const quiz = await creerQuiz(banc.url, cookie, [qcm('La clôture ?')], 'Clôture')
    const salle = []
    for (let i = 0; i < 10; i++) {
      const c = await inscrireProfil(banc.url, `cloture${i}`, `Profil ${i}`, '🐨')
      const inv = await invite(banc.url, `Profil ${i}`, '🐨', { cookie: c })
      ouverts.push(inv.socket)
      salle.push(inv)
    }
    const sessionId = await lancerQuiz(host, quiz)
    await attendre<any>(host, 'session:view', p => p.view.phase === 'question', 'la question', 15_000)
    const podium = attendre<any>(host, 'session:view', p => p.view.phase === 'finished', 'le podium', 15_000)
    for (const [i, inv] of salle.entries()) {
      await emitAck(inv.socket, 'player:action', { sessionId, action: { type: 'answer', choice: i % 2 } })
    }
    // Les téléphones des tests d'avant sont encore dans la salle : on
    // n'attend pas leurs réponses, on révèle.
    const revelee = attendre<any>(host, 'session:view', p => p.view.phase === 'reveal', 'la révélation', 15_000)
    ;(host as any).emit('host:command', { sessionId, command: { type: 'next' } })
    await revelee
    ;(host as any).emit('host:command', { sessionId, command: { type: 'next' } })
    await podium
    ;(host as any).emit('host:endSession', { sessionId })

    const fins = salle.map(inv => attendre<any>(inv.socket, 'soiree:fin', () => true, 'une fin de soirée', 30_000))
    auPlus = 0
    credits = 0
    ;(host as any).emit('host:closeParty', { title: 'Grande clôture' })
    const lues = await Promise.all(fins)
    assert.ok(credits >= 10, `chaque profil est crédité à la clôture (${credits} crédits)`)
    assert.ok(lues.every(f => f.profil), 'et sa fin de soirée le dit')
    // Mesuré avant : un seul à la fois.
    assert.ok(auPlus > 1, `des crédits en même temps (au plus ${auPlus} en vol)`)
    assert.ok(auPlus <= 8, `mais pas toute la salle d’un coup (${auPlus} en vol)`)
  } finally {
    proto.creditSoiree = credit
    ProfileStore.tirageEclat = tirage
  }
})
