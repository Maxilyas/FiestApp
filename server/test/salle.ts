// Une salle et son moteur, sans serveur : le vrai `GameEngine`, le vrai
// module du quiz et les vrais registres (invités, gains, journal) sur une
// base en mémoire, une horloge qu'on avance à la main (`mock.timers`), et
// une diffusion qui retient tout ce qui part, salon par salon.
//
// Ce que `SpaceRuntime` fait autour du moteur — exclure, rejoindre — est
// rejoué ici geste pour geste, dans le même ordre (`space.ts`, `sockets.ts`).
// Pour ce qui se joue entre deux instants précis — le souffle de 700 ms, une
// pause, un intertitre — qu'un vrai serveur ne laisse pas viser.
import { mock } from 'node:test'
import { initDb } from '../src/core/db'
import { Party } from '../src/core/party'
import { ScoreLedger } from '../src/core/scores'
import { AnswerLog } from '../src/core/answers'
import { GameEngine } from '../src/core/engine'
import { quizModule, setQuizLibrary } from '../src/games/quiz'
import type { QuizDef } from '../../shared/library'
import type { QuizHostView, QuizPlayerView } from '../../shared/games/quiz'

export function qcm(text: string, extra: Record<string, unknown> = {}) {
  return { kind: 'choice', text, answers: ['Oui', 'Non', 'Peut-être'], correct: 0, duration: 20, image: null, ...extra }
}

export function sondage(text: string, extra: Record<string, unknown> = {}) {
  return { kind: 'choice', text, variante: 'sondage', answers: [], correct: 0, duration: 20, image: null, ...extra }
}

/** L'horloge de la salle : les chronomètres du moteur la suivent. À arrêter après chaque épreuve (`arreter`). */
export function horloge(now = 1_000_000) {
  mock.timers.enable({ apis: ['setTimeout', 'setImmediate', 'Date'], now })
  return {
    avancer: (ms: number) => mock.timers.tick(ms),
    arreter: () => mock.timers.reset(),
  }
}

/** Une salle, un moteur, les quiz `{ id, title, questions }` de son espace. */
export function salle(quiz: { id: string; title: string; questions: unknown[] }[]) {
  const spaceId = `salle-${Math.random().toString(36).slice(2)}`
  setQuizLibrary(
    spaceId,
    quiz.map(q => ({ id: q.id, title: q.title, updatedAt: 0, questions: q.questions }) as unknown as QuizDef),
  )
  const db = initDb(':memory:')
  const party = new Party(db, spaceId)
  const ledger = new ScoreLedger(db, spaceId)
  const answers = new AnswerLog(db, spaceId)
  const emissions: { salle: string; ev: string; payload: any }[] = []
  const io = {
    to: (salle: string) => ({
      emit: (ev: string, payload: unknown) => void emissions.push({ salle, ev, payload: JSON.parse(JSON.stringify(payload)) }),
    }),
  }
  const engine = new GameEngine(
    {
      db,
      io: io as any,
      spaceId,
      party,
      ledger,
      answers,
      onScoresChanged: () => {},
      onSessionChanged: () => {},
      onSessionEnded: () => {},
      onVerdict: () => {},
    },
    quizModule,
  )
  const ids = new Map<string, string>()
  const idDe = (nom: string) => {
    const id = ids.get(nom)
    if (!id) throw new Error(`inconnu : ${nom}`)
    return id
  }
  const session = () => (engine as any).session as { id: string; participantIds: string[]; state: any } | null

  const s = {
    party,
    answers,
    engine,
    idDe,
    get st() {
      return session()?.state
    },
    /** Un invité inscrit et connecté, avant le lancement. */
    inscrire(nom: string, avatar = '🦊') {
      const p = party.join(nom, avatar)
      if ('error' in p) throw new Error(p.error)
      party.socketConnected(p.id, `s-${p.id}`)
      ids.set(nom, p.id)
      return p.id
    },
    /** Un invité qui arrive en cours de partie, comme `player:join`. */
    rejoindre(nom: string, avatar = '🦊') {
      const id = s.inscrire(nom, avatar)
      engine.joinLate(id)
      engine.resendViews(id)
      return id
    },
    deconnecter(nom: string) {
      party.socketDisconnected(idDe(nom), `s-${idDe(nom)}`)
      engine.rafraichirAnimateur()
    },
    /** Rejoue `SpaceRuntime.exclure` : chaque registre efface ses lignes, puis le moteur. */
    exclure(nom: string) {
      const id = idDe(nom)
      party.remove(id)
      ledger.removePlayer(id)
      answers.removePlayer(id)
      engine.dropParticipant(id)
    },
    /** Lance la partie, choisit le premier quiz, et passe le compte à rebours. */
    lancer(avancer: (ms: number) => void, config?: unknown, quizId = quiz[0].id) {
      engine.launch(config)
      s.commande({ type: 'selectPack', packId: quizId, multiplier: 1 })
      avancer(3000)
    },
    commande(command: Record<string, unknown>) {
      const sess = session()
      if (!sess) throw new Error('pas de partie')
      engine.handleHostCommand(sess.id, command)
    },
    /** La visée qu'une console enverrait : ce qu'elle a sous les yeux. */
    visee() {
      const st = s.st
      return { phase: st.phase, qIndex: st.qIndex, round: st.round }
    },
    repondre(nom: string, action: Record<string, unknown>) {
      const sess = session()!
      return engine.handlePlayerAction(sess.id, idDe(nom), { qIndex: sess.state.qIndex, round: sess.state.round, ...action })
    },
    /** La dernière vue de partie reçue par ce téléphone. */
    vueDe(nom: string): QuizPlayerView | undefined {
      const salle = `player:${idDe(nom)}`
      for (let i = emissions.length - 1; i >= 0; i--) {
        const e = emissions[i]
        if (e.salle === salle && e.ev === 'session:view') return e.payload.view
      }
      return undefined
    },
    /** La dernière vue partie aux écrans d'animateur. */
    vueHote(): QuizHostView | undefined {
      for (let i = emissions.length - 1; i >= 0; i--) {
        const e = emissions[i]
        if (e.salle.startsWith('hosts:') && e.ev === 'session:view') return e.payload.view
      }
      return undefined
    },
    fermer() {
      engine.stop()
      db.close()
    },
  }
  return s
}
