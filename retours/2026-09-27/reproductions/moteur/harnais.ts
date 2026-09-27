// Le harnais de la mission « moteur » : le vrai moteur (`GameEngine`), le vrai
// module du quiz et les vrais registres (invités, gains, journal), sur une base
// en mémoire, avec une horloge qu'on avance à la main (`mock.timers`) et une
// fausse diffusion qui retient tout ce qui part, salon par salon.
//
// Ce que `SpaceRuntime` fait autour du moteur — exclure, rejoindre, renommer —
// est rejoué ici geste pour geste, dans le même ordre (`space.ts`, `sockets.ts`).
import { mock } from 'node:test'
import { initDb } from '../../../server/src/core/db'
import { Party } from '../../../server/src/core/party'
import { ScoreLedger } from '../../../server/src/core/scores'
import { AnswerLog } from '../../../server/src/core/answers'
import { GameEngine } from '../../../server/src/core/engine'
import { quizModule, setQuizLibrary } from '../../../server/src/games/quiz'
import type { QuizDef } from '../../../shared/library'
import type { QuizHostView, QuizPlayerView } from '../../../shared/games/quiz'

export interface Emission {
  salle: string
  ev: string
  payload: any
}

export function qcm(text: string, extra: Record<string, unknown> = {}) {
  return { kind: 'choice', text, answers: ['Oui', 'Non', 'Peut-être'], correct: 0, duration: 20, image: null, ...extra }
}

export function estimation(text: string, target: number, extra: Record<string, unknown> = {}) {
  return { kind: 'number', text, target, unit: '', duration: 20, image: null, answers: [], correct: 0, ...extra }
}

export function sondage(text: string, extra: Record<string, unknown> = {}) {
  return { kind: 'choice', text, variante: 'sondage', answers: [], correct: 0, duration: 20, image: null, ...extra }
}

/**
 * Une salle, un moteur. `quiz` : une liste de quiz { id, title, questions }.
 * L'horloge démarre à `debut` ; `mock.timers` doit être activé par l'appelant
 * (voir `horloge()`), pour que les chronomètres du moteur la suivent.
 */
export function salle(quiz: { id: string; title: string; questions: unknown[]; reglages?: unknown }[]) {
  const spaceId = `moteur-${Math.random().toString(36).slice(2)}`
  setQuizLibrary(
    spaceId,
    quiz.map(q => ({ id: q.id, title: q.title, updatedAt: 0, questions: q.questions, ...(q.reglages ? { reglages: q.reglages } : {}) }) as unknown as QuizDef),
  )
  const db = initDb(':memory:')
  const party = new Party(db, spaceId)
  const ledger = new ScoreLedger(db, spaceId)
  const answers = new AnswerLog(db, spaceId)
  const emissions: Emission[] = []
  const io = {
    to: (salleNom: string) => ({
      emit: (ev: string, payload: unknown) => {
        emissions.push({ salle: salleNom, ev, payload: JSON.parse(JSON.stringify(payload)) })
      },
    }),
  }
  const evenements = { verdicts: 0, fins: 0, scores: 0 }
  const engine = new GameEngine(
    {
      db,
      io: io as any,
      spaceId,
      party,
      ledger,
      answers,
      onScoresChanged: () => evenements.scores++,
      onSessionChanged: () => {},
      onSessionEnded: () => evenements.fins++,
      onVerdict: () => evenements.verdicts++,
    },
    quizModule,
  )
  const ids = new Map<string, string>()
  const noms = new Map<string, string>()

  const idDe = (nom: string) => {
    const id = ids.get(nom)
    if (!id) throw new Error(`inconnu : ${nom}`)
    return id
  }

  const h = {
    spaceId,
    db,
    party,
    ledger,
    answers,
    engine,
    emissions,
    evenements,
    idDe,
    /** Un invité inscrit et connecté — hors partie (voir `rejoindre`). */
    inscrire(nom: string, avatar = '🦊') {
      const p = party.join(nom, avatar)
      if ('error' in p) throw new Error(p.error)
      party.socketConnected(p.id, `s-${p.id}`)
      ids.set(nom, p.id)
      noms.set(p.id, nom)
      return p.id
    },
    /** Un invité qui arrive, comme `player:join` : inscrit, puis la partie en cours l'accueille. */
    rejoindre(nom: string, avatar = '🦊') {
      const id = h.inscrire(nom, avatar)
      engine.joinLate(id)
      engine.resendViews(id)
      return id
    },
    deconnecter(nom: string) {
      party.socketDisconnected(idDe(nom), `s-${idDe(nom)}`)
      engine.rafraichirAnimateur()
    },
    reconnecter(nom: string) {
      party.socketConnected(idDe(nom), `s-${idDe(nom)}`)
      engine.joinLate(idDe(nom))
      engine.resendViews(idDe(nom))
    },
    /** Rejoue `SpaceRuntime.exclure` : chaque registre efface ses lignes, puis le moteur. */
    exclure(nom: string) {
      const id = idDe(nom)
      party.remove(id)
      ledger.removePlayer(id)
      answers.removePlayer(id)
      engine.dropParticipant(id)
    },
    renommer(nom: string, nouveau: string) {
      party.rename(idDe(nom), nouveau)
      engine.rafraichirVues()
    },
    lancer(config?: unknown) {
      return engine.launch(config)
    },
    get session() {
      return (engine as any).session as { id: string; participantIds: string[]; state: any; timers: Map<string, { deadline: number }> } | null
    },
    get st() {
      return h.session?.state
    },
    /** Les chronomètres armés, et leur échéance relative à maintenant. */
    chronos(): Record<string, number> {
      const s = h.session
      if (!s) return {}
      return Object.fromEntries([...s.timers.entries()].map(([k, t]) => [k, t.deadline - Date.now()]))
    },
    commande(command: Record<string, unknown>) {
      const s = h.session
      if (!s) throw new Error('pas de partie')
      engine.handleHostCommand(s.id, command)
    },
    /** La visée qu'une console enverrait : ce qu'elle a sous les yeux maintenant. */
    visee() {
      const st = h.st
      return { phase: st.phase, qIndex: st.qIndex, round: st.round }
    },
    choisir(packId: string, multiplier = 1) {
      h.commande({ type: 'selectPack', packId, multiplier })
    },
    repondre(nom: string, action: Record<string, unknown>) {
      const s = h.session
      if (!s) return 'pas-de-partie'
      return engine.handlePlayerAction(s.id, idDe(nom), { qIndex: s.state.qIndex, round: s.state.round, ...action })
    },
    /** La dernière vue de partie reçue par ce téléphone. */
    vueDe(nom: string): QuizPlayerView | undefined {
      const salleNom = `player:${idDe(nom)}`
      for (let i = emissions.length - 1; i >= 0; i--) {
        const e = emissions[i]
        if (e.salle === salleNom && e.ev === 'session:view') return e.payload.view
      }
      return undefined
    },
    /** La dernière vue d'animateur partie aux écrans. */
    vueHote(): QuizHostView | undefined {
      for (let i = emissions.length - 1; i >= 0; i--) {
        const e = emissions[i]
        if (e.salle.startsWith('hosts:') && e.ev === 'session:view') return e.payload.view
      }
      return undefined
    },
    /** La vue d'animateur calculée maintenant, sans rien envoyer. */
    vueHoteMaintenant(): QuizHostView {
      const s = h.session!
      return quizModule.hostView(s as any, (engine as any).vctx) as QuizHostView
    },
    vueJoueurMaintenant(nom: string): QuizPlayerView {
      const s = h.session!
      return quizModule.playerView(s as any, idDe(nom), (engine as any).vctx) as QuizPlayerView
    },
    nomDe(id: string) {
      return noms.get(id)
    },
    fermer() {
      engine.stop()
      db.close()
    },
  }
  return h
}

/** L'horloge de la salle : les chronomètres du moteur la suivent. */
export function horloge(now = 1_000_000) {
  mock.timers.enable({ apis: ['setTimeout', 'setImmediate', 'Date'], now })
  return {
    avancer(ms: number) {
      mock.timers.tick(ms)
    },
    arreter() {
      mock.timers.reset()
    },
  }
}

/**
 * Le redémarrage d'une salle : le moteur s'arrête (ce qui attendait s'écrit),
 * puis un moteur neuf relit la base — registres compris — et réarme ses
 * chronomètres. Rend la salle reprise, sur la même base et la même horloge.
 */
export function redemarrer(s: ReturnType<typeof salle>) {
  s.engine.stop()
  const party = new Party(s.db, s.spaceId)
  const ledger = new ScoreLedger(s.db, s.spaceId)
  const answers = new AnswerLog(s.db, s.spaceId)
  const emissions: Emission[] = []
  const io = {
    to: (salleNom: string) => ({
      emit: (ev: string, payload: unknown) => {
        emissions.push({ salle: salleNom, ev, payload: JSON.parse(JSON.stringify(payload)) })
      },
    }),
  }
  const engine = new GameEngine(
    {
      db: s.db,
      io: io as any,
      spaceId: s.spaceId,
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
  engine.restore()
  return { engine, party, ledger, answers, emissions }
}
