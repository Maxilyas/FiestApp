// Le protocole de jeu : ce que visent les gestes, et ce que coûtent les
// diffusions.
//
// Une commande d'animateur et une réponse d'invité disent maintenant quelle
// question elles visaient. Avant, le serveur les lisait à la lumière de la
// phase COURANTE : un « Révéler » arrivé juste après la révélation automatique
// devenait « Question suivante », et la salle ne voyait jamais la bonne
// réponse ; une réponse retenue par une coupure s'inscrivait sur une question
// que l'invité n'avait jamais vue.
//
// Chaque scénario a son serveur : une partie jouée ne doit rien laisser à la
// suivante, et ils tournent ainsi en même temps — l'essentiel de leur durée
// est le compte à rebours de trois secondes avant la première question.
import { after, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import {
  ADMIN,
  attendre,
  connecter,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  emitAck,
  estimation,
  lancerQuiz,
  qcm,
  type Banc,
  type Invite,
  type Socket,
} from './banc'
import { initDb } from '../src/core/db'
import { Party } from '../src/core/party'
import { ScoreLedger } from '../src/core/scores'
import { quizModule, setQuizLibrary } from '../src/games/quiz'
import type { GameContext, GameSessionRec, ViewContext } from '../src/core/types'
import type { QuizDef, QuizQuestionDef } from '../../shared/library'

const bancs: Banc[] = []

after(async () => {
  // Pas de fermeture test par test : `close()` referme toutes les connexions
  // ouvertes par le banc, y compris celles d'un scénario voisin encore en cours.
  for (const banc of bancs) await banc.close()
})

// ── Suivre les vues ───────────────────────────────────────────────────────

/** La dernière vue de partie reçue par chaque connexion. */
const vues = new WeakMap<Socket, any>()

function suivre(socket: Socket) {
  socket.on('session:view', (p: any) => vues.set(socket, p.view))
}

/** La dernière vue reçue si elle convient — sinon la prochaine qui conviendra. */
function vue(socket: Socket, pred: (v: any) => boolean, label: string): Promise<any> {
  const deja = vues.get(socket)
  if (deja && pred(deja)) return Promise.resolve(deja)
  return attendre<any>(socket, 'session:view', p => pred(p.view), label).then(p => p.view)
}

/** Ce qu'un écran avait sous les yeux : c'est ce que ses gestes emportent. */
const viseeDe = (v: any) => ({ phase: v.phase, qIndex: v.qIndex, round: v.round })

function commande(host: Socket, sessionId: string, command: unknown) {
  ;(host as any).emit('host:command', { sessionId, command })
}

let reglage = 30
/**
 * Les commandes de l'animateur n'ont pas d'accusé : pour savoir qu'une
 * commande a été traitée — ou ignorée —, on en envoie une seconde dont l'effet
 * se voit sur l'écran commun. Le serveur traite les messages d'une connexion
 * dans l'ordre : quand la seconde est visible, la première est passée.
 */
async function barriere(host: Socket, sessionId: string): Promise<any> {
  const seconds = reglage--
  commande(host, sessionId, { type: 'autoNext', seconds })
  return vue(host, v => v.autoNextSeconds === seconds, 'la barrière')
}

/** Une réponse telle que la page l'envoie : avec la question qu'elle vise. */
function repondre(qui: Invite, sessionId: string, v: any, choice: number) {
  return emitAck<any>(qui.socket, 'player:action', {
    sessionId,
    action: { type: 'answer', choice, qIndex: v.qIndex, round: v.round },
  })
}

/** Un invité dont on suit les vues dès la connexion — la première arrive derrière l'accusé. */
async function arrivee(url: string, name: string, avatar = '🦊'): Promise<Invite> {
  const socket = connecter(url)
  suivre(socket)
  const watched = await emitAck<any>(socket, 'party:watch', { slug: ADMIN.slug })
  assert.ok(watched.ok, `suivre la soirée : ${watched.error}`)
  const res = await emitAck<any>(socket, 'player:join', { slug: ADMIN.slug, name, avatar })
  assert.ok(res.ok, `${name} n’a pas pu rejoindre : ${res.error}`)
  return { socket, playerId: res.playerId, token: res.token }
}

/** Un serveur à soi, un quiz, un écran commun, des invités — et le quiz lancé. */
async function soiree(questions: Partial<QuizQuestionDef>[], prenoms: string[]) {
  const banc = await demarrer()
  bancs.push(banc)
  const cookie = await connexionAnimateur(banc.url)
  const quiz = await creerQuiz(banc.url, cookie, questions)
  const host = await ecranCommun(banc.url, cookie)
  suivre(host)
  const invites: Invite[] = []
  for (const [i, prenom] of prenoms.entries()) invites.push(await arrivee(banc.url, prenom, ['🦊', '🐼', '🐸', '🦁'][i % 4]))
  const sessionId = await lancerQuiz(host, quiz)
  return { banc, host, invites, sessionId }
}

// ── Les gestes portent la question qu'ils visaient ────────────────────────

describe('la question visée', { concurrency: true }, () => {
  test('la course : le souffle a révélé, le « Révéler » qui arrive après ne passe pas à la suite', async () => {
    const { host, invites, sessionId } = await soiree([qcm('Première ?'), qcm('Seconde ?')], ['Alice'])
    const [alice] = invites
    const question = await vue(host, v => v.phase === 'question', 'la question à l’écran')
    const posee = await vue(alice.socket, v => v.phase === 'question', 'la question sur le téléphone')

    assert.equal((await repondre(alice, sessionId, posee, 0)).ok, true)
    // Toute la salle a répondu : le souffle révèle tout seul…
    await vue(host, v => v.phase === 'reveal', 'la révélation par le souffle')
    // … et le clic « Révéler », parti quand la question était encore à
    // l'écran, arrive après. C'est un doublon, pas un « Question suivante ».
    commande(host, sessionId, { type: 'next', ...viseeDe(question) })

    const apres = await barriere(host, sessionId)
    assert.equal(apres.phase, 'reveal', 'la révélation doit rester à l’écran')
    assert.equal(apres.qIndex, 0)
    assert.equal(vues.get(alice.socket).phase, 'reveal', 'le téléphone aussi doit rester sur la révélation')
  })

  test('double clic : deux « Question suivante » identiques n’avancent qu’une fois', async () => {
    const { host, sessionId } = await soiree([qcm('Une ?'), qcm('Deux ?'), qcm('Trois ?')], ['Alice'])
    const question = await vue(host, v => v.phase === 'question', 'la question')
    commande(host, sessionId, { type: 'next', ...viseeDe(question) })
    const revelation = await vue(host, v => v.phase === 'reveal', 'la révélation')

    commande(host, sessionId, { type: 'next', ...viseeDe(revelation) })
    commande(host, sessionId, { type: 'next', ...viseeDe(revelation) })

    const apres = await barriere(host, sessionId)
    assert.equal(apres.qIndex, 1, 'une seule question de plus')
    assert.equal(apres.phase, 'question', 'la question suivante ne doit pas être révélée dans la foulée')
  })

  test('« Passer à la question » juste après la fin de la photo ne révèle pas la question', async () => {
    const photo = {
      ...qcm('Combien de bougies ?'),
      image: '/media/image/00000000-0000-4000-8000-000000000000',
      observeSeconds: 2,
    }
    const { host, sessionId } = await soiree([photo, qcm('Et ensuite ?')], ['Alice'])
    const observation = await vue(host, v => v.phase === 'observe', 'la photo à mémoriser')
    // Le temps d'observation s'achève de lui-même…
    await vue(host, v => v.phase === 'question', 'la question après la photo')
    // … pendant que le doigt de l'animateur descendait sur le bouton.
    commande(host, sessionId, { type: 'next', ...viseeDe(observation) })

    const apres = await barriere(host, sessionId)
    assert.equal(apres.phase, 'question', 'la question doit rester ouverte')
  })

  test('une annulation qui visait la question d’avant ne touche pas celle-ci', async () => {
    const { host, invites, sessionId } = await soiree([qcm('Une ?'), qcm('Deux ?')], ['Alice'])
    const [alice] = invites
    const q0 = await vue(alice.socket, v => v.phase === 'question' && v.qIndex === 0, 'Q1')
    await repondre(alice, sessionId, q0, 0)
    const revelation0 = await vue(host, v => v.phase === 'reveal' && v.qIndex === 0, 'révélation Q1')

    commande(host, sessionId, { type: 'next', ...viseeDe(revelation0) })
    const q1 = await vue(alice.socket, v => v.phase === 'question' && v.qIndex === 1, 'Q2')
    await repondre(alice, sessionId, q1, 0)
    const gagne = await vue(alice.socket, v => v.phase === 'reveal' && v.qIndex === 1, 'révélation Q2')
    assert.ok(gagne.yourPoints > 0)

    // « Annuler les points » confirmé trop tard : la boîte de dialogue était
    // restée ouverte pendant que la partie avançait.
    commande(host, sessionId, { type: 'cancel', ...viseeDe(revelation0) })

    await barriere(host, sessionId)
    const apres = vues.get(alice.socket)
    assert.equal(apres.yourPoints, gagne.yourPoints, 'les points de la question 2 doivent rester')
    assert.equal(apres.yourQuizTotal, gagne.yourQuizTotal)
    assert.equal(apres.cancelled, undefined)
  })

  test('une réponse qui visait la question d’avant est refusée, avec son motif', async () => {
    const { host, invites, sessionId } = await soiree([qcm('Une ?'), qcm('Deux ?')], ['Alice', 'Bob'])
    const [alice, bob] = invites
    const q0 = await vue(alice.socket, v => v.phase === 'question' && v.qIndex === 0, 'Q1')
    const ecranQ0 = await vue(host, v => v.phase === 'question', 'Q1 à l’écran')
    commande(host, sessionId, { type: 'next', ...viseeDe(ecranQ0) })
    const revelation = await vue(host, v => v.phase === 'reveal', 'révélation Q1')
    commande(host, sessionId, { type: 'next', ...viseeDe(revelation) })
    const q1 = await vue(bob.socket, v => v.phase === 'question' && v.qIndex === 1, 'Q2')

    // Tapée sur la question 1, retenue par une coupure, délivrée sur la 2.
    const perimee = await repondre(alice, sessionId, q0, 0)
    assert.equal(perimee.ok, false, 'la réponse à la question d’avant ne doit pas passer')
    assert.equal(perimee.reason, 'too-late')

    assert.equal((await repondre(bob, sessionId, q1, 1)).ok, true)
    const ecran = await vue(host, v => v.answeredCount === 1, 'la réponse de Bob comptée')
    assert.equal(ecran.qIndex, 1)
    assert.equal(ecran.answeredCount, 1, 'seule la réponse de Bob compte sur la question 2')
    assert.equal(vues.get(alice.socket).yourChoice, null, 'Alice n’a pas répondu à la question 2')

    // La même chose sur une question reposée : même numéro, autre tour.
    commande(host, sessionId, { type: 'next', ...viseeDe(ecran) })
    const revelation1 = await vue(host, v => v.phase === 'reveal' && v.qIndex === 1, 'révélation Q2')
    commande(host, sessionId, { type: 'replay', ...viseeDe(revelation1) })
    const reposee = await vue(bob.socket, v => v.phase === 'question' && v.round !== q1.round, 'Q2 reposée')
    assert.equal(reposee.qIndex, 1)
    const avantReplay = await repondre(bob, sessionId, q1, 0)
    assert.equal(avantReplay.reason, 'too-late', 'une réponse à la question avant qu’on la repose est périmée')
    assert.equal((await repondre(bob, sessionId, reposee, 0)).ok, true)
  })

  test('un téléphone resté sur l’ancienne page répond et commande comme avant', async () => {
    const { host, invites, sessionId } = await soiree([qcm('Une ?'), qcm('Deux ?')], ['Alice', 'Bob'])
    const [alice] = invites
    await vue(alice.socket, v => v.phase === 'question', 'Q1')
    // Ni question ni tour : c'est un téléphone qui n'a pas rechargé sa page.
    const ack = await emitAck<any>(alice.socket, 'player:action', { sessionId, action: { type: 'answer', choice: 1 } })
    assert.equal(ack.ok, true, 'une réponse sans question visée reste acceptée')
    await vue(alice.socket, v => v.yourChoice === 1, 'la réponse retenue')

    commande(host, sessionId, { type: 'next' })
    await vue(host, v => v.phase === 'reveal' && v.qIndex === 0, 'révélation sans question visée')
    commande(host, sessionId, { type: 'next' })
    await vue(host, v => v.phase === 'question' && v.qIndex === 1, 'suivante sans question visée')
  })

  test('question reposée : le retardataire arrivé pendant la révélation y joue, au journal comme aux points', async () => {
    const { banc, host, invites, sessionId } = await soiree([qcm('Une ?', ['Oui', 'Non'], 0), qcm('Deux ?')], ['Alice'])
    const [alice] = invites
    const q0 = await vue(alice.socket, v => v.phase === 'question', 'Q1')
    await repondre(alice, sessionId, q0, 0)
    const revelation = await vue(host, v => v.phase === 'reveal', 'révélation Q1')

    // Bob arrive pendant la révélation : il attend la question suivante…
    const bob = await arrivee(banc.url, 'Bob', '🐼')
    const accueil = await vue(bob.socket, v => v.phase === 'reveal', 'l’accueil de Bob')
    assert.equal(accueil.justArrived, true)

    // … mais l'animateur repose celle-ci : Bob la voit, il y joue.
    commande(host, sessionId, { type: 'replay', ...viseeDe(revelation) })
    const reposee = await vue(bob.socket, v => v.phase === 'question' && v.qIndex === 0, 'Q1 reposée chez Bob')
    assert.equal((await repondre(bob, sessionId, reposee, 0)).ok, true)
    const encore = await vue(alice.socket, v => v.phase === 'question' && v.round === reposee.round, 'Q1 reposée')
    await repondre(alice, sessionId, encore, 1)

    const bilanBob = await vue(bob.socket, v => v.phase === 'reveal', 'la révélation chez Bob')
    assert.ok(!bilanBob.justArrived, 'il a joué la question : plus de « bienvenue »')
    assert.ok(bilanBob.yourPoints > 100, 'sa bonne réponse rapporte des points')

    const bilan = (await (await fetch(`${banc.url}/s/${ADMIN.slug}/bilan.json`)).json()) as any
    for (const joueur of bilan.players) {
      const auJournal = joueur.answers.reduce((s: number, a: any) => s + a.points, 0)
      assert.equal(auJournal, joueur.points, `${joueur.name} : le journal et les points doivent concorder`)
    }
    const deBob = bilan.players.find((p: any) => p.id === bob.playerId)
    assert.equal(deBob.answers.length, 1, 'Bob figure au journal de la question qu’il a jouée')
    assert.equal(deBob.answers[0].points, bilanBob.yourPoints)
  })

  test('ex æquo : même nombre de points, même rang sur le téléphone', async () => {
    const { host, invites, sessionId } = await soiree([qcm('Qui ?', ['A', 'B'], 0)], ['Alice', 'Bob', 'Chloé'])
    const [alice, bob, chloe] = invites
    const q = await vue(alice.socket, v => v.phase === 'question', 'la question')
    await repondre(alice, sessionId, q, 0)
    await repondre(bob, sessionId, q, 1)
    await repondre(chloe, sessionId, q, 1)
    const revelation = await vue(host, v => v.phase === 'reveal', 'la révélation')

    const rangs = async (phase: string) =>
      Promise.all(invites.map(i => vue(i.socket, v => v.phase === phase, `${phase} sur un téléphone`))).then(vs =>
        vs.map(v => v.yourQuizRank),
      )
    assert.deepEqual(await rangs('reveal'), [1, 2, 2], 'Bob et Chloé, à zéro tous les deux, sont deuxièmes ensemble')

    commande(host, sessionId, { type: 'next', ...viseeDe(revelation) })
    assert.deepEqual(await rangs('finished'), [1, 2, 2], 'au podium aussi')
  })

  test('points annulés : le téléphone le sait, au lieu d’afficher « + pts »', async () => {
    const { host, invites, sessionId } = await soiree([qcm('Une ?', ['Oui', 'Non'], 0), qcm('Deux ?')], ['Alice'])
    const [alice] = invites
    const q = await vue(alice.socket, v => v.phase === 'question', 'la question')
    await repondre(alice, sessionId, q, 0)
    const revelation = await vue(host, v => v.phase === 'reveal', 'la révélation')
    assert.ok((await vue(alice.socket, v => v.phase === 'reveal', 'le gain')).yourPoints > 0)

    commande(host, sessionId, { type: 'cancel', ...viseeDe(revelation) })
    const annulee = await vue(alice.socket, v => v.yourQuizTotal === 0, 'les points retirés')
    assert.equal(annulee.cancelled, true, 'le téléphone doit savoir que les points sont annulés')
    assert.equal(annulee.yourPoints, null)
    assert.equal((await vue(host, v => v.cancelled === true, 'l’écran commun le sait aussi')).phase, 'reveal')
  })

  test('une estimation renvoyée à l’identique n’est pas un changement d’avis', async () => {
    const { banc, invites, sessionId } = await soiree([estimation('Combien ?', 42)], ['Alice', 'Bob'])
    const [alice, bob] = invites
    const q = await vue(alice.socket, v => v.phase === 'question', 'la question')
    const guess = (qui: Invite, value: number) =>
      emitAck<any>(qui.socket, 'player:action', {
        sessionId,
        action: { type: 'guess', value, qIndex: q.qIndex, round: q.round },
      })
    assert.equal((await guess(alice, 40)).ok, true)
    // Le renvoi d'une réponse dont l'accusé s'est perdu : la même, un peu plus tard.
    await new Promise(r => setTimeout(r, 150))
    assert.equal((await guess(alice, 40)).ok, true)
    assert.equal((await guess(bob, 50)).ok, true)
    await vue(alice.socket, v => v.phase === 'reveal', 'la révélation')

    const bilan = (await (await fetch(`${banc.url}/s/${ADMIN.slug}/bilan.json`)).json()) as any
    const reponse = bilan.players.find((p: any) => p.id === alice.playerId).answers[0]
    assert.equal(reponse.value, 40)
    assert.equal(reponse.changes, 0, 'un renvoi n’est pas une hésitation')
  })
})

// ── Le coût des diffusions ────────────────────────────────────────────────
//
// Directement sur le module, avec le contexte de vue du moteur : le vrai
// registre des invités, et un mémo neuf à chaque diffusion. Mesuré avant la
// correction : à 150 invités, 2 s pour diffuser le podium ; à 500, plus d'une
// minute — l'hébergeur gratuit n'a qu'un dixième de processeur.

const NB_QUESTIONS = 5

function partieSimulee(n: number) {
  const spaceId = `banc-diffusion-${n}`
  const quiz: QuizDef = {
    id: 'diffusion',
    title: 'Diffusion',
    updatedAt: 0,
    questions: Array.from({ length: NB_QUESTIONS }, (_, i) => ({
      kind: 'choice' as const,
      text: `Question ${i + 1} : une question de longueur ordinaire ?`,
      answers: ['Première', 'Deuxième', 'Troisième', 'Quatrième'],
      correct: i % 4,
      target: null,
      unit: '',
      duration: 20,
      image: null,
      observeSeconds: null,
    })),
  }
  setQuizLibrary(spaceId, [quiz])
  const db = initDb(':memory:')
  const party = new Party(db, spaceId)
  const ledger = new ScoreLedger(db, spaceId)
  const prenoms = ['Camille', 'Léa', 'Hugo', 'Jules', 'Emma', 'Louise', 'Gabriel', 'Chloé']
  const ids: string[] = []
  for (let i = 0; i < n; i++) {
    // Quelques homonymes parfaits, comme dans une vraie salle : « Camille (2) ».
    const p = party.join(i % 9 === 0 ? prenoms[i % 8] : `${prenoms[i % 8]} ${i}`, ['🦊', '🐼', '🐸'][i % 3])
    if ('error' in p) throw new Error(p.error)
    party.socketConnected(p.id)
    ids.push(p.id)
  }

  const compte = { player: 0 }
  let memo: Map<string, unknown> | null = null
  const vctx: ViewContext = {
    playerName: id => party.nomAffiche(id) ?? '???',
    player: id => {
      compte.player++
      return party.publicOne(id, ledger.total(id))
    },
    memo: <T>(cle: string, calculer: () => T): T => {
      if (!memo) return calculer()
      if (!memo.has(cle)) memo.set(cle, calculer())
      return memo.get(cle) as T
    },
  }
  let now = 1_000_000
  const ctx: GameContext = {
    award: (id, points, reason) => ledger.award(id, points, reason, 'diffusion'),
    logAnswers: () => {},
    dropAnswers: () => {},
    setTimer: () => {},
    clearTimer: () => {},
    end: () => {},
    participants: () => [],
    playerName: id => vctx.playerName(id),
    now: () => (now += 13),
  }
  const sess: GameSessionRec<any> = {
    id: 'diffusion',
    spaceId,
    status: 'running',
    participantIds: ids,
    state: quizModule.createInitialState(spaceId, ids, undefined),
  }
  /** Une diffusion comme celle du moteur : toutes les vues, sérialisées pour être comparées. */
  const diffuser = (): number => {
    memo = new Map()
    const t0 = performance.now()
    for (const id of sess.participantIds) JSON.stringify(quizModule.playerView(sess, id, vctx))
    JSON.stringify(quizModule.hostView(sess, vctx))
    memo = null
    return performance.now() - t0
  }
  quizModule.onHostCommand!(sess, { type: 'selectPack', packId: 'diffusion' }, ctx)
  quizModule.onTimer!(sess, 'ready', ctx)
  return { sess, ctx, ids, diffuser, compte }
}

test('diffusions : le classement se calcule une fois pour toute la salle, pas une fois par téléphone', t => {
  const N = 300
  const { sess, ctx, ids, diffuser, compte } = partieSimulee(N)

  // Une question complète : chaque réponse déclenche une diffusion. Avant, chaque
  // vue y triait tous les totaux pour un rang que personne ne lisait encore —
  // six secondes à 300 invités.
  const t0 = performance.now()
  for (const [i, id] of ids.entries()) {
    quizModule.onPlayerAction(sess, id, { type: 'answer', choice: i % 4 }, ctx)
    diffuser()
  }
  const question = performance.now() - t0
  t.diagnostic(`question complète à ${N} invités : ${Math.round(question)} ms`)
  assert.ok(question < 3000, `une question complète à ${N} invités : ${Math.round(question)} ms (borne 3 s)`)

  for (let q = 0; q < NB_QUESTIONS; q++) {
    if (q > 0) for (const [i, id] of ids.entries()) if ((i + q) % 3) quizModule.onPlayerAction(sess, id, { type: 'answer', choice: (i * q) % 4 }, ctx)
    quizModule.onHostCommand!(sess, { type: 'next' }, ctx) // révélation
    quizModule.onHostCommand!(sess, { type: 'next' }, ctx) // suivante, ou podium
  }
  assert.equal(sess.state.phase, 'finished')

  // Le meilleur de trois essais : c'est le coût du calcul qu'on borne, pas
  // l'humeur d'une machine partagée. Avant : quinze secondes.
  compte.player = 0
  const podium = Math.min(diffuser(), diffuser(), diffuser())
  t.diagnostic(`diffusion du podium à ${N} invités : ${Math.round(podium)} ms`)
  assert.ok(podium < 300, `le podium à ${N} invités se diffuse en ${Math.round(podium)} ms (borne 300 ms)`)
  // L'écran commun affiche tout le classement (N lignes) ; les téléphones, le
  // même podium de trois : une fois par diffusion, pas une fois par téléphone.
  assert.ok(compte.player <= 3 * (N + 3), `${compte.player} joueurs décorés pour trois diffusions`)
})
