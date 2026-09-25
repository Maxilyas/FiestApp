// Sa place au classement, au fil du quiz.
//
// Les invités le demandaient : entre deux questions, le téléphone ne disait
// que « Total quiz : 450 pts · 3ᵉ place », en petit, et rien des autres. À
// chaque révélation, il apprend maintenant qui le précède et qui le suit —
// strictement : un ex æquo n'est ni devant ni derrière —, de combien, et s'il
// a gagné des places depuis la question d'avant.
//
// Sans rien coûter à la salle : le classement se trie une fois par diffusion,
// chaque téléphone y lit ses voisins en temps constant et les décore lui-même
// avec l'instantané qu'il a déjà ; rien ne se calcule pendant la question ; et
// un retardataire qui entre pendant la révélation ne renvoie sa vue à
// personne d'autre.
import { afterEach, mock, test } from 'node:test'
import assert from 'node:assert/strict'
import { initDb } from '../src/core/db'
import { Party } from '../src/core/party'
import { ScoreLedger } from '../src/core/scores'
import { AnswerLog } from '../src/core/answers'
import { GameEngine } from '../src/core/engine'
import { quizModule, setQuizLibrary } from '../src/games/quiz'
import type { GameContext, GameSessionRec, ViewContext } from '../src/core/types'
import { classer, groupesDExAequo, rangDansLesTries, rangPartage } from '../../shared/classement'
import type { PlaceAuQuiz, QuizPlayerView } from '../../shared/games/quiz'
import { ecartAuPodium, ligneDeCourse, ligneDeSoiree, moitieHaute, type EntreeDeCourse } from '../../shared/course'
import type { QuizDef } from '../../shared/library'

// ── Les règles pures ───────────────────────────────────────────────────────

test('le rang d’une valeur se lit par dichotomie comme en comptant ceux qui sont devant', () => {
  for (let essai = 0; essai < 300; essai++) {
    // Des paliers de 50 : beaucoup d'ex æquo, comme à zéro après une question ratée.
    const valeurs = Array.from({ length: essai % 40 }, () => Math.floor(Math.random() * 6) * 50)
    const tries = [...valeurs].sort((a, b) => b - a)
    for (const v of [...valeurs, -1, 25, 1000]) {
      assert.equal(rangDansLesTries(v, tries), rangPartage(v, valeurs), `${v} parmi ${valeurs.join(', ')}`)
    }
  }
})

test('les groupes d’ex æquo bornent chaque position : devant et derrière soi, jamais un ex æquo', () => {
  const classes = classer(
    [
      { id: 'a', points: 300 },
      { id: 'b', points: 200 },
      { id: 'c', points: 200 },
      { id: 'd', points: 0 },
    ],
    x => x.points,
    x => x.id,
    x => x.id,
  )
  assert.deepEqual(groupesDExAequo(classes), { premier: [0, 1, 1, 3], dernier: [0, 2, 2, 3] })
  assert.deepEqual(groupesDExAequo([]), { premier: [], dernier: [] })
})

// ── Une partie, jouée sur le module ────────────────────────────────────────

const QUESTIONS = ['Un ?', 'Deux ?', 'Trois ?', 'Quatre ?'].map(text => ({
  kind: 'choice' as const,
  text,
  answers: ['Oui', 'Non'],
  correct: 0,
  target: null,
  unit: '',
  duration: 20,
  image: null,
  observeSeconds: null,
}))

/**
 * Une partie de quiz sur le module seul, avec le vrai registre des invités et
 * une horloge qu'on avance à la main : le temps de chaque réponse, donc ses
 * points, est celui qu'on choisit.
 */
function partie(noms: string[], questions: unknown[] = QUESTIONS) {
  const spaceId = `classement-${Math.random().toString(36).slice(2)}`
  setQuizLibrary(spaceId, [{ id: 'quiz', title: 'Le classement', updatedAt: 0, questions } as unknown as QuizDef])
  const db = initDb(':memory:')
  const party = new Party(db, spaceId)
  const ledger = new ScoreLedger(db, spaceId)
  const ids = new Map<string, string>()
  const entrer = (nom: string) => {
    const p = party.join(nom, '🦊')
    if ('error' in p) throw new Error(p.error)
    party.socketConnected(p.id, `socket-${p.id}`)
    ids.set(nom, p.id)
    return p.id
  }
  noms.forEach(entrer)
  const compte = { decores: 0, noms: 0 }
  let memo: Map<string, unknown> | null = null
  const vctx: ViewContext = {
    playerName: id => {
      compte.noms++
      return party.nomAffiche(id) ?? '???'
    },
    connected: id => party.isConnected(id),
    player: id => {
      compte.decores++
      return party.publicOne(id, ledger.total(id))
    },
    memo: <T>(cle: string, calculer: () => T): T => {
      if (!memo) return calculer()
      if (!memo.has(cle)) memo.set(cle, calculer())
      return memo.get(cle) as T
    },
  }
  let now = 1_000_000
  const journal: { playerId: string; qIndex: number }[] = []
  const ctx: GameContext = {
    award: (id, points, reason) => ledger.award(id, points, reason, 'classement'),
    logAnswers: rows => journal.push(...rows.map(r => ({ playerId: r.playerId, qIndex: r.qIndex }))),
    dropAnswers: () => {},
    setTimer: () => {},
    clearTimer: () => {},
    end: () => {},
    verdict: () => {},
    participants: () => [],
    playerName: id => vctx.playerName(id),
    connected: id => party.isConnected(id),
    now: () => now,
  }
  const sess: GameSessionRec<any> = {
    id: 'classement',
    spaceId,
    status: 'running',
    participantIds: [...ids.values()],
    state: quizModule.createInitialState(spaceId, [...ids.values()], undefined),
  }
  const id = (nom: string) => ids.get(nom)!
  quizModule.onHostCommand!(sess, { type: 'selectPack', packId: 'quiz' }, ctx)
  quizModule.onTimer!(sess, 'ready', ctx)
  return {
    sess,
    compte,
    journal,
    id,
    /** Répond `apresMs` après l'ouverture de la question : c'est ce temps qui fait les points. */
    repondre(nom: string, choice: number, apresMs: number) {
      now = sess.state.questionStartAt + apresMs
      assert.equal(quizModule.onPlayerAction(sess, id(nom), { type: 'answer', choice }, ctx), undefined, `la réponse de ${nom}`)
    },
    /** Une estimation, de même. */
    estimer(nom: string, value: number, apresMs: number) {
      now = sess.state.questionStartAt + apresMs
      assert.equal(quizModule.onPlayerAction(sess, id(nom), { type: 'guess', value }, ctx), undefined, `l’estimation de ${nom}`)
    },
    commande(command: Record<string, unknown>) {
      now += 50
      quizModule.onHostCommand!(sess, command, ctx)
    },
    /** Un retardataire : il entre dans la partie comme le moteur l'y fait entrer. */
    arriver(nom: string) {
      const nouveau = entrer(nom)
      sess.participantIds.push(nouveau)
      quizModule.onPlayerJoin!(sess, nouveau, ctx)
    },
    /** Une diffusion, comme celle du moteur : toutes les vues, un mémo pour toutes. */
    vues(): Record<string, QuizPlayerView> {
      memo = new Map()
      try {
        return Object.fromEntries([...ids.keys()].map(n => [n, quizModule.playerView(sess, id(n), vctx) as QuizPlayerView]))
      } finally {
        memo = null
      }
    },
    /** La vue d'un seul téléphone, hors diffusion — celle qu'un réveil renvoie. */
    vueSeule(nom: string): QuizPlayerView {
      return quizModule.playerView(sess, id(nom), vctx) as QuizPlayerView
    },
  }
}

/**
 * Ce que chaque place doit dire, vérifié sur toute la salle : le voisin de
 * devant est le plus proche strictement devant, avec ses vrais points et son
 * vrai rang ; celui de derrière, le plus proche strictement derrière ; les ex
 * æquo se comptent. `ids` relie un identifiant à son invité.
 */
function verifierLesPlaces(vues: Record<string, QuizPlayerView>, ids: (nom: string) => string) {
  const joueurs = Object.entries(vues)
    .filter(([, v]) => v.place)
    .map(([nom, v]) => ({ nom, id: ids(nom), total: v.yourQuizTotal!, rang: v.yourQuizRank!, place: v.place! }))
  const parId = new Map(joueurs.map(j => [j.id, j]))
  for (const j of joueurs) {
    const { devant, derriere, exAequo } = j.place
    const plusHauts = joueurs.filter(o => o.total > j.total).map(o => o.total)
    const plusBas = joueurs.filter(o => o.total < j.total).map(o => o.total)
    if (devant) {
      const lui = parId.get(devant.id)!
      assert.ok(lui, `${j.nom} : son voisin de devant est dans la salle`)
      assert.equal(devant.points, lui.total, `${j.nom} : les points de ${lui.nom}`)
      assert.equal(devant.rang, lui.rang, `${j.nom} : le rang de ${lui.nom}`)
      assert.equal(devant.points, Math.min(...plusHauts), `${j.nom} : le plus proche devant`)
    } else {
      assert.equal(plusHauts.length, 0, `${j.nom} : personne devant, il mène`)
      assert.equal(j.rang, 1)
    }
    if (derriere) {
      const lui = parId.get(derriere.id)!
      assert.equal(derriere.points, lui.total, `${j.nom} : les points de ${lui.nom}`)
      assert.equal(derriere.rang, lui.rang, `${j.nom} : le rang de ${lui.nom}`)
      assert.equal(derriere.points, Math.max(...plusBas), `${j.nom} : le plus proche derrière`)
    } else {
      assert.equal(plusBas.length, 0, `${j.nom} : personne derrière`)
    }
    assert.equal(exAequo ?? 0, joueurs.filter(o => o !== j && o.total === j.total).length, `${j.nom} : ses ex æquo`)
  }
}

test('à la révélation, chaque téléphone apprend qui le précède et qui le suit — strictement', () => {
  const p = partie(['Alice', 'Bruno', 'Chloé', 'David', 'Emma'])
  // Passé le temps de lecture, plus on attend, moins on marque.
  p.repondre('Alice', 0, 3000)
  p.repondre('Bruno', 0, 6000)
  p.repondre('Chloé', 0, 9000)
  p.repondre('David', 1, 4000)
  p.commande({ type: 'next' })
  const v = p.vues()
  assert.deepEqual(
    Object.values(v).map(x => x.yourQuizRank),
    [1, 2, 3, 4, 4],
    'David et Emma, à zéro tous les deux, sont quatrièmes ensemble',
  )
  assert.equal(v.Alice.place!.devant, undefined, 'Alice mène')
  assert.deepEqual(v.Alice.place!.derriere, { id: p.id('Bruno'), points: v.Bruno.yourQuizTotal, rang: 2 })
  assert.equal(v.Bruno.place!.devant!.id, p.id('Alice'))
  assert.equal(v.Chloé.place!.derriere!.id, p.id('David'), 'le premier des ex æquo, dans l’ordre d’affichage')
  assert.deepEqual(v.David.place, { sur: 5, devant: { id: p.id('Chloé'), points: v.Chloé.yourQuizTotal, rang: 3 }, exAequo: 1 })
  assert.deepEqual(v.Emma.place, v.David.place, 'un ex æquo n’est ni devant ni derrière')
  verifierLesPlaces(v, p.id)
  // À zéro, tout le monde était premier ex æquo : personne n'a « perdu » de place.
  assert.ok(Object.values(v).every(x => x.place!.avant === undefined), 'rien d’où l’on vient à la première question')
})

test('la question suivante dit d’où chacun vient — et seulement s’il a bougé', () => {
  const p = partie(['Alice', 'Bruno', 'Chloé', 'David', 'Emma'])
  p.repondre('Alice', 0, 3000)
  p.repondre('Bruno', 0, 6000)
  p.repondre('Chloé', 0, 9000)
  p.commande({ type: 'next' })
  const q1 = p.vues()
  p.commande({ type: 'next' })
  // Emma, à zéro, répond la première et vite ; Alice et Bruno se trompent.
  p.repondre('Emma', 0, 2000)
  p.repondre('Chloé', 0, 2500)
  p.repondre('Alice', 1, 3000)
  p.repondre('Bruno', 1, 3000)
  p.commande({ type: 'next' })
  const q2 = p.vues()
  for (const nom of Object.keys(q2)) {
    const { avant } = q2[nom].place!
    assert.equal(avant ?? q2[nom].yourQuizRank, q1[nom].yourQuizRank, `${nom} : son rang d’avant la question`)
    assert.notEqual(avant, q2[nom].yourQuizRank, `${nom} : un rang inchangé ne se dit pas`)
  }
  assert.ok(q2.Emma.place!.avant! > q2.Emma.yourQuizRank!, 'Emma a gagné des places')
  assert.ok(q2.Chloé.yourQuizRank! < q1.Chloé.yourQuizRank!, 'Chloé aussi')
  verifierLesPlaces(q2, p.id)

  // Des points annulés ne font gagner ni perdre de place à personne.
  p.commande({ type: 'cancel', phase: 'reveal', qIndex: 1, round: p.sess.state.round })
  const annulee = p.vues()
  assert.ok(Object.values(annulee).every(x => x.place!.avant === undefined), 'rien n’a bougé')
  verifierLesPlaces(annulee, p.id)
})

test('rien ne se calcule ni ne part pendant la question', () => {
  const p = partie(['Alice', 'Bruno', 'Chloé'])
  p.repondre('Alice', 0, 3000)
  p.commande({ type: 'next' })
  p.commande({ type: 'next' })
  assert.equal(p.sess.state.phase, 'question')
  // La question est ouverte, Alice a des points : son téléphone n'en dit rien.
  p.repondre('Bruno', 0, 2000)
  for (const v of [...Object.values(p.vues()), p.vueSeule('Bruno')]) {
    assert.equal(v.place, undefined, 'pas de place pendant la question')
    assert.equal(v.yourQuizRank, undefined, 'ni de rang')
  }
  // Une réponse ne relit que les noms de la vue de son auteur : aucun classement ne se trie pour elle.
  p.compte.noms = 0
  p.repondre('Chloé', 1, 2500)
  p.vueSeule('Chloé')
  assert.equal(p.compte.noms, 0, 'aucun nom relu, donc aucun classement')
})

test('un retardataire n’a pas de place avant d’avoir joué, et ne change celle de personne', () => {
  const p = partie(['Alice', 'Bruno', 'Chloé', 'David'])
  p.repondre('Alice', 0, 3000)
  p.commande({ type: 'next' })
  const avant = p.vues()
  // Il entre pendant la révélation : il jouera la question suivante.
  p.arriver('Zoé')
  const apres = p.vues()
  assert.equal(apres.Zoé.justArrived, true)
  assert.equal(apres.Zoé.place, undefined, '« Bienvenue », pas « dernier, à 180 pts d’Alice »')
  // Son rang reste celui de la règle commune : derrière tous ceux qui ont marqué.
  assert.equal(apres.Zoé.yourQuizRank, rangPartage(0, Object.values(avant).map(v => v.yourQuizTotal!)))
  for (const nom of Object.keys(avant)) {
    // Trois invités à zéro : comptée, Zoé deviendrait leur quatrième ex æquo,
    // et chacun des trois recevrait sa vue une fois de plus.
    assert.equal(JSON.stringify(apres[nom]), JSON.stringify(avant[nom]), `${nom} : sa vue n’a pas bougé, rien ne lui repart`)
  }
  // À la question suivante, elle a joué : elle tient sa place, comme tout le monde.
  p.commande({ type: 'next' })
  p.repondre('Zoé', 0, 2000)
  p.commande({ type: 'next' })
  const q2 = p.vues()
  assert.ok(q2.Zoé.place, 'elle a joué : sa place')
  verifierLesPlaces(q2, p.id)
})

test('arrivé pendant qu’on mesure une estimation, on n’y a pas joué : « Bienvenue », et rien au journal', () => {
  const direct = { kind: 'number', text: 'Le poids du gâteau ?', target: null, unit: 'g', duration: 20, image: null, observeSeconds: null, enDirect: true }
  const p = partie(['Alice', 'Bruno'], [direct, ...QUESTIONS])
  p.estimer('Alice', 1200, 3000)
  p.commande({ type: 'next' })
  assert.equal(p.sess.state.phase, 'cible', 'on pèse le gâteau')
  p.arriver('Zoé')
  p.commande({ type: 'cible', value: 1250, phase: 'cible', qIndex: 0, round: p.sess.state.round })
  assert.equal(p.sess.state.phase, 'reveal')
  const v = p.vues()
  assert.equal(v.Zoé.justArrived, true, 'elle n’a jamais vu la question')
  assert.equal(v.Zoé.place, undefined)
  assert.ok(!p.journal.some(l => l.playerId === p.id('Zoé')), 'ni au journal d’une question qu’elle n’a pas vue')
  assert.ok(p.journal.some(l => l.playerId === p.id('Bruno')), 'Bruno, lui, l’a laissée passer')
})

test('au podium, chacun sait qui l’encadre et sur combien ; qui arrive après la fin, rien', () => {
  const p = partie(['Alice', 'Bruno', 'Chloé', 'David', 'Emma'], QUESTIONS.slice(0, 1))
  p.repondre('Alice', 0, 3000)
  p.repondre('Bruno', 0, 6000)
  p.repondre('Chloé', 0, 9000)
  p.repondre('David', 0, 12000)
  p.commande({ type: 'next' })
  p.commande({ type: 'next' })
  assert.equal(p.sess.state.phase, 'finished')
  p.arriver('Zoé')
  const v = p.vues()
  for (const nom of ['Alice', 'Bruno', 'Chloé']) {
    assert.notEqual(v[nom].yourPodiumIndex, undefined, `${nom} monte sur le podium`)
    assert.equal(v[nom].place?.sur, 5, `${nom} lit « sur 5 »`)
    assert.equal(v[nom].place?.avant, undefined, 'au podium, rien d’où l’on vient : la dernière question n’est pas le quiz')
  }
  assert.deepEqual(v.David.place, {
    sur: 5,
    devant: { id: p.id('Chloé'), points: v.Chloé.yourQuizTotal, rang: 3 },
    derriere: { id: p.id('Emma'), points: 0, rang: 5 },
  })
  assert.deepEqual(v.Emma.place, { sur: 5, devant: { id: p.id('David'), points: v.David.yourQuizTotal, rang: 4 } })
  assert.equal(v.Zoé.place, undefined, 'arrivée au podium, elle n’a rien joué')
  assert.ok(!v.Emma.place!.derriere, 'et elle n’est derrière personne')
  verifierLesPlaces(v, p.id)
  // Premier quiz de la soirée : son classement est celui de la soirée.
  assert.ok(Object.values(v).every(x => x.soireeEntamee === undefined))
})

test('au podium d’un quiz qui en suit un autre, la soirée a son propre classement', () => {
  const spaceId = `classement-soiree-${Math.random().toString(36).slice(2)}`
  setQuizLibrary(spaceId, [{ id: 'quiz', title: 'Le classement', updatedAt: 0, questions: QUESTIONS } as unknown as QuizDef])
  // Ce que la soirée transmet au quiz qu'on lance : les quiz déjà joués ce soir.
  assert.equal(quizModule.createInitialState(spaceId, [], { joues: [] }).soireeEntamee, undefined)
  assert.equal(quizModule.createInitialState(spaceId, [], { joues: ['un-autre'] }).soireeEntamee, true)
  const vue = quizModule.playerView(
    { id: 's', spaceId, status: 'running', participantIds: [], state: { ...quizModule.createInitialState(spaceId, [], { joues: ['x'] }), phase: 'finished' } },
    'personne',
    { playerName: () => '', player: () => undefined, connected: () => false, memo: (_c, f) => f() },
  ) as QuizPlayerView
  assert.equal(vue.soireeEntamee, true)
})

// ── Ce que ça coûte ────────────────────────────────────────────────────────

test('la place se lit dans un classement trié une fois pour toute la salle, et ne décore personne', () => {
  const N = 300
  const noms = Array.from({ length: N }, (_, i) => `Invité ${i}`)
  const p = partie(noms)
  for (let q = 0; q < 3; q++) {
    for (let i = 0; i < N; i++) if ((i + q) % 4) p.repondre(noms[i], (i + q) % 3 ? 0 : 1, 2000 + ((i * 37) % 15000))
    p.commande({ type: 'next' })
    if (q < 2) p.commande({ type: 'next' })
  }
  p.compte.noms = 0
  p.compte.decores = 0
  const v = p.vues()
  verifierLesPlaces(v, p.id)
  // Trier le classement relit chaque nom une fois ; le trier pour chaque
  // téléphone les relirait N fois chacun.
  assert.ok(p.compte.noms <= N + 10, `${p.compte.noms} noms relus pour ${N} téléphones`)
  // Le téléphone décore ses voisins avec l'instantané : ici, personne.
  assert.equal(p.compte.decores, 0, 'aucun invité décoré pour les téléphones')
  // Quelques octets par téléphone : jamais le classement entier.
  const octets = Math.max(...Object.values(v).map(x => JSON.stringify(x.place ?? {}).length))
  assert.ok(octets <= 200, `${octets} octets de place au plus par téléphone`)
  assert.ok(Object.values(v).some(x => x.place?.avant), 'des places gagnées ou perdues se disent')
})

// ── Dans le moteur : une arrivée ne renvoie rien à la salle ────────────────

afterEach(() => mock.timers.reset())

test('dans le moteur, une arrivée pendant la révélation n’envoie sa vue qu’à elle', () => {
  mock.timers.enable({ apis: ['setTimeout', 'setImmediate', 'Date'], now: 1_000_000 })
  const spaceId = `classement-moteur-${Math.random().toString(36).slice(2)}`
  setQuizLibrary(spaceId, [{ id: 'quiz', title: 'Le classement', updatedAt: 0, questions: QUESTIONS } as unknown as QuizDef])
  const db = initDb(':memory:')
  const party = new Party(db, spaceId)
  const ids: string[] = []
  for (let i = 0; i < 20; i++) {
    const p = party.join(`Invité ${i}`, '🦊')
    if ('error' in p) throw new Error(p.error)
    party.socketConnected(p.id, `socket-${i}`)
    ids.push(p.id)
  }
  const recu = new Map<string, unknown[]>()
  const io = {
    to: (salon: string) => ({
      emit: (_evenement: string, charge: unknown) => recu.set(salon, [...(recu.get(salon) ?? []), charge]),
    }),
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
    quizModule,
  )
  try {
    const sid = engine.launch()
    engine.handleHostCommand(sid, { type: 'selectPack', packId: 'quiz' })
    mock.timers.tick(3000) // le compte à rebours
    // Cinq bonnes réponses : quinze invités restent à zéro, ex æquo.
    for (let i = 0; i < 5; i++) assert.equal(engine.handlePlayerAction(sid, ids[i], { type: 'answer', choice: 0 }), null)
    engine.handleHostCommand(sid, { type: 'next' })
    const derniere = (id: string) => (recu.get(`player:${id}`)?.at(-1) as any)?.view as QuizPlayerView
    assert.equal(derniere(ids[10]).phase, 'reveal')
    assert.equal(derniere(ids[10]).place?.exAequo, 14, 'quinze à zéro')
    const envoisAvant = ids.map(id => recu.get(`player:${id}`)?.length ?? 0)

    const zoe = party.join('Zoé', '🐼')
    if ('error' in zoe) throw new Error(zoe.error)
    party.socketConnected(zoe.id, 'socket-zoe')
    engine.joinLate(zoe.id)
    engine.resendViews(zoe.id)
    assert.equal(derniere(zoe.id).justArrived, true)
    assert.deepEqual(
      ids.map(id => recu.get(`player:${id}`)?.length ?? 0),
      envoisAvant,
      'aucun des vingt téléphones ne reçoit sa vue une fois de plus',
    )
  } finally {
    engine.stop()
    db.close()
  }
})

// ── Ce que dit le téléphone ────────────────────────────────────────────────
//
// Le parti pris du rapport (retours/2026-09-25/classement-en-cours.md) : une
// cible nommée, les bonnes nouvelles seulement, pas de rang à zéro, et une
// étiquette qui dit de quel classement il s'agit.

const NOMS: Record<string, string> = { h: 'Hugo', l: 'Léa', k: 'Karim', p: 'Paul' }
const HUGO = { id: 'h', points: 490, rang: 4 }
const LEA = { id: 'l', points: 430, rang: 6 }

function course(e: Partial<Omit<EntreeDeCourse, 'place'>> & { place?: Partial<PlaceAuQuiz> } = {}) {
  const { place, ...reste } = e
  return ligneDeCourse({
    rang: 5,
    points: 450,
    qIndex: 3,
    qCount: 10,
    multiplier: 1,
    nomDe: id => NOMS[id],
    ...reste,
    place: { sur: 12, devant: HUGO, derriere: LEA, ...place },
  })
}

test('au milieu : sa place sur combien, les places gagnées, une cible nommée', () => {
  const l = course({ place: { avant: 7 } })
  assert.equal(l.etiquette, 'Ce quiz · encore 6 questions')
  assert.equal(l.rang, '5ᵉ')
  assert.equal(l.place, 'place sur 12')
  assert.equal(l.points, '450 pts')
  assert.equal(l.gagnees, 2)
  assert.deepEqual(l.cible, { avant: 'À 40 pts d’', nom: 'Hugo' })
  assert.equal(l.oreille, 'Ce quiz : rang 5 sur 12, 450 points, 2 places gagnées. À 40 points d’Hugo. Encore 6 questions.')
  // Talonner un groupe d'ex æquo : son rang moins le leur dit combien ils sont.
  assert.deepEqual(course({ place: { devant: { ...HUGO, rang: 2 } } }).cible, { avant: 'À 40 pts d’', nom: 'Hugo', apres: ' et 2 autres' })
  // Ex æquo soi-même.
  const egal = course({ place: { exAequo: 1 } })
  assert.equal(egal.place, 'ex æquo sur 12')
  assert.match(egal.oreille, /rang 5 sur 12, ex æquo avec 1 autre, 450 points\./)
  assert.deepEqual(course({ place: { devant: { id: 'k', points: 460, rang: 4 } } }).cible, { avant: 'À 10 pts de ', nom: 'Karim' })
})

test('dans la moitié basse : ni « sur 12 », ni flèche vers le bas, jamais « dernier »', () => {
  const l = course({ rang: 11, points: 80, place: { devant: { id: 'l', points: 100, rang: 10 }, derriere: undefined, avant: 9 } })
  assert.equal(l.place, 'place', '« 11ᵉ sur 12 » ne dirait qu’« avant-dernier »')
  assert.equal(l.gagnees, 0, 'descendre ne se dit pas')
  assert.equal(l.oreille, 'Ce quiz : rang 11, 80 points. À 20 points de Léa. Encore 6 questions.')
  assert.equal(course({ rang: 6 }).place, 'place sur 12', 'la moitié haute, arrondie au-dessus')
  assert.equal(course({ rang: 7 }).place, 'place')
  assert.equal(moitieHaute(7, 13), true)
  for (const l2 of [l, course({ rang: 12, points: 10, place: { derriere: undefined } })]) {
    assert.ok(!/dernier/i.test(`${l2.place} ${l2.cible?.avant} ${l2.oreille.replace('C’était la dernière question', '')}`), l2.oreille)
  }
})

test('en tête : on fête une fois, puis on nomme qui suit', () => {
  const prise = course({ rang: 1, points: 630, place: { devant: undefined, avant: 3, derriere: { id: 'h', points: 590, rang: 2 } } })
  assert.equal(prise.place, 'Tu prends la tête !')
  assert.equal(prise.fete, true)
  assert.equal(prise.gagnees, 0, 'la phrase le dit, pas de flèche en plus')
  assert.equal(prise.rang, undefined)
  assert.deepEqual(prise.cible, { avant: '', nom: 'Hugo', apres: ' te suit à 40 pts' })
  assert.equal(prise.oreille, 'Ce quiz : tu prends la tête, 630 points. Hugo te suit à 40 points. Encore 6 questions.')

  const mene = course({ rang: 1, points: 630, place: { devant: undefined, derriere: { id: 'h', points: 590, rang: 2 } } })
  assert.equal(mene.place, 'Tu mènes')
  assert.equal(mene.fete, undefined)
  const rejoint = course({ rang: 1, points: 630, place: { devant: undefined, exAequo: 1, avant: 2, derriere: { id: 'l', points: 590, rang: 3 } } })
  assert.equal(rejoint.place, 'Tu rejoins la tête !')
  assert.deepEqual(rejoint.cible, { avant: '', nom: 'Léa', apres: ' vous suit à 40 pts' }, 'ex æquo en tête, on est suivis à plusieurs')
  assert.equal(course({ rang: 1, points: 630, place: { devant: undefined, exAequo: 2, derriere: undefined } }).place, 'En tête ex æquo')
  // Mener quand personne d'autre n'a marqué : ce n'est pas un duel.
  const seul = course({ rang: 1, points: 180, place: { devant: undefined, derriere: { id: 'h', points: 0, rang: 2 } } })
  assert.deepEqual(seul.cible, { avant: 'Personne d’autre n’a encore marqué' })
})

test('à zéro point, pas de rang : une cible, ou personne', () => {
  const zero = course({ rang: 8, points: 0, place: { devant: { id: 'l', points: 100, rang: 7 }, derriere: undefined, exAequo: 4 } })
  assert.equal(zero.place, 'Pas encore de points')
  assert.equal(zero.rang, undefined, '« 8ᵉ ex æquo » à zéro, c’était dernier de rien')
  assert.equal(zero.points, undefined)
  assert.deepEqual(zero.cible, { avant: 'À 100 pts de ', nom: 'Léa' })
  assert.equal(zero.oreille, 'Ce quiz : pas encore de points. À 100 points de Léa. Encore 6 questions.')
  // Toute la salle a séché : premier de rien, et personne à rattraper.
  const personne = course({ rang: 1, points: 0, place: { devant: undefined, derriere: undefined, exAequo: 11 } })
  assert.equal(personne.place, 'Personne n’a encore marqué')
  assert.equal(personne.cible, undefined)
})

test('l’étiquette dit quel classement, et ce qui reste à jouer — multiplicateur compris', () => {
  assert.equal(course({ qIndex: 8 }).etiquette, 'Ce quiz · encore 1 question')
  const finale = course({ qIndex: 9, multiplier: 2 })
  assert.equal(finale.etiquette, 'Ce quiz ×2 · c’était la dernière')
  assert.match(finale.oreille, /C’était la dernière question, points doublés\.$/)
  assert.match(course({ multiplier: 3 }).oreille, /Encore 6 questions, points triplés\.$/)
})

test('un voisin que l’instantané ne connaît pas encore se dit par son rang', () => {
  const l = course({ nomDe: () => undefined })
  assert.deepEqual(l.cible, { avant: 'À 40 pts de la 4ᵉ place' })
  assert.match(l.oreille, /À 40 points du rang 4\./)
  const tete = course({ rang: 1, points: 630, nomDe: () => undefined, place: { devant: undefined, derriere: { id: 'x', points: 590, rang: 2 } } })
  assert.deepEqual(tete.cible, { avant: '40 pts d’avance' })
})

test('au podium : l’écart à la troisième marche, et la soirée — jamais de rang à zéro', () => {
  const place = (devant?: { points: number; rang: number }) => ({ sur: 12, ...(devant && { devant: { id: 'h', ...devant } }) })
  assert.equal(ecartAuPodium(4, 300, place({ points: 320, rang: 3 })), 20)
  assert.equal(ecartAuPodium(4, 300, place({ points: 320, rang: 2 })), 20, 'derrière deux deuxièmes ex æquo, le podium est à portée aussi')
  assert.equal(ecartAuPodium(5, 300, place({ points: 320, rang: 4 })), null, 'plus loin, l’échelle dit le reste')
  assert.equal(ecartAuPodium(3, 300, place({ points: 320, rang: 2 })), null, 'on y est')
  assert.equal(ecartAuPodium(6, 0, place({ points: 20, rang: 3 })), null)

  assert.equal(ligneDeSoiree(0, [0, 300, 200]), null)
  assert.equal(ligneDeSoiree(300, [0, 300, 200]), 'Soirée : tu mènes')
  assert.equal(ligneDeSoiree(300, [300, 300, 200]), 'Soirée : en tête ex æquo')
  assert.equal(ligneDeSoiree(200, [0, 300, 200, 250]), 'Soirée : 3ᵉ place')
})

// ── À l'écran ──────────────────────────────────────────────────────────────

/** Un composant du client, rendu en HTML — la recette d'`accessibilite.test.ts`. */
async function rendu(fichier: string, composant: string, props: object): Promise<string> {
  const React = (await import('react')).default
  Object.assign(globalThis, { React })
  const module = await import(new URL(`../../client/src/${fichier}.tsx`, import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[composant], props))
}

test('à la révélation : le résultat, sa place, les équipes, puis l’anecdote — et l’oreille entend une phrase', async () => {
  const joueurs = [
    { id: 'moi', name: 'Sofia', avatar: '🐼', score: 450, teamId: 't1' },
    { id: 'h', name: 'Hugo', avatar: '🦊', score: 490, teamId: 't2' },
  ]
  const view: QuizPlayerView = {
    phase: 'reveal',
    qIndex: 3,
    qCount: 10,
    kind: 'choice',
    text: 'La capitale de l’Australie ?',
    answers: ['Sydney', 'Canberra'],
    correct: 1,
    yourChoice: 1,
    yourPoints: 152,
    yourQuizTotal: 450,
    yourQuizRank: 5,
    anecdote: 'Canberra a été choisie en 1908.',
    place: { sur: 12, devant: HUGO, avant: 7 },
  }
  const html = await rendu('games/quiz/PlayerView', 'QuizPlayer', {
    view,
    send: () => {},
    teams: [{ id: 't1', name: 'Randonneurs', emoji: '🥾', position: 0, memberCount: 3, total: 900, average: 377, bonus: 0 }],
    myTeamId: 't1',
    players: joueurs,
    moi: joueurs[0],
  })
  const ordre = ['result-banner', 'class="card course"', 'Les équipes', 'anecdote'].map(repere => html.indexOf(repere))
  assert.ok(ordre.every(i => i >= 0), html)
  assert.deepEqual([...ordre].sort((a, b) => a - b), ordre, 'l’anecdote, que la télé montre en grand, passe après les équipes')
  assert.ok(!html.includes('Total quiz'), 'la ligne grise d’avant a laissé sa place')
  // L'œil lit trois lignes ; l'oreille, une phrase — « 5ᵉ » s'y épelait, et la flèche est muette.
  assert.match(html, /<p class="sr-only">Ce quiz : rang 5 sur 12, 450 points, 2 places gagnées\. À 40 points d’Hugo\. Encore 6 questions\.<\/p>/)
  assert.match(html, /<div class="course-lignes" aria-hidden="true">/)
  assert.match(html, /À 40 pts d’<strong>Hugo<\/strong>/)
})

test('au podium, qui n’y monte pas voit son échelle ; à zéro, ni rang ni échelle', async () => {
  const joueurs = [
    { id: 'moi', name: 'Sofia', avatar: '🐼', score: 450, teamId: null },
    { id: 'h', name: 'Hugo', avatar: '🦊', score: 490, teamId: null },
    { id: 'l', name: 'Léa', avatar: '🐸', score: 0, teamId: null },
  ]
  const podium = [
    { name: 'Alice', avatar: '🐯', points: 900, rank: 1 },
    { name: 'Bob', avatar: '🐻', points: 800, rank: 2 },
    { name: 'Chloé', avatar: '🐨', points: 500, rank: 3 },
  ]
  const fin = (surcharge: Partial<QuizPlayerView>) =>
    rendu('games/quiz/PlayerView', 'QuizPlayer', {
      view: { phase: 'finished', qIndex: 9, qCount: 10, yourChoice: null, podium, yourQuizTotal: 450, yourQuizRank: 5, ...surcharge },
      send: () => {},
      teams: [],
      myTeamId: null,
      players: joueurs,
      moi: joueurs[0],
    })
  const html = await fin({ place: { sur: 12, devant: { ...HUGO, rang: 4 }, derriere: { id: 'l', points: 0, rang: 6 } } })
  assert.match(html, /Tu finis à la <strong>5ᵉ place<\/strong> sur 12 avec 450 pts/)
  assert.match(html, /class="card echelle"/)
  assert.equal([...html.matchAll(/class="lb-row me"/g)].length, 1, 'sa ligne, surlignée')
  assert.ok(html.includes('Hugo'), 'celui qu’on talonnait')
  assert.ok(!html.includes('Léa'), 'personne n’y lit le zéro d’un autre')
  assert.ok(!html.includes('Soirée'), 'au premier quiz, la soirée et le quiz ne font qu’un')

  const zero = await fin({ yourQuizTotal: 0, yourQuizRank: 6, place: { sur: 12, devant: { ...HUGO, rang: 5 } } })
  assert.match(zero, /Quiz terminé ! Pas de points cette fois\./)
  assert.ok(!zero.includes('class="card echelle"'))
  assert.ok(!/6ᵉ place/.test(zero))

  const second = await fin({ soireeEntamee: true, place: { sur: 12, devant: { ...HUGO, rang: 4 } } })
  assert.match(second, /Soirée : 2ᵉ place/, 'la soirée, lue dans l’instantané')
})
