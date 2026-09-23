import type { AnswerRow } from './answers'
import type { ScoreEntry } from './scores'
import { ecartEstimation, rangPartage } from '../../../shared/classement'
import { SEUILS } from '../../../shared/profil'

/**
 * Le journal des réponses, rangé question par question et quiz par quiz.
 *
 * L'expérience (`progress.ts`) et les hauts faits (`hautsfaits.ts`) lisent
 * les mêmes choses — qui a trouvé, qui le plus vite, qui était seul, qui
 * visait le plus juste, qui a fini devant dans chaque quiz. Deux lectures
 * écrites chacune de son côté finiraient par ne plus dire la même chose, et
 * un joueur « le plus rapide » pour l'une ne le serait pas pour l'autre. Ce
 * module est la seule : pur, sans base, comme le souvenir et le bilan.
 */

/** Une question telle qu'elle a été jouée : ses lignes, et ce qu'on en tire. */
export interface QuestionJouee {
  sessionId: string
  qIndex: number
  kind: 'choice' | 'number'
  /** Sa catégorie, si elle en portait une. */
  categorie: string | null
  /** Une ligne par joueur à qui elle a été posée, réponse ou non. */
  lignes: AnswerRow[]
  /** La même, par joueur : les hauts faits la consultent pour chacun, à 500 invités. */
  parJoueur: Map<string, AnswerRow>
  repondues: AnswerRow[]
  /** Questions à choix : les bonnes réponses, de la plus rapide à la plus lente. */
  justes: AnswerRow[]
  /** Questions à choix : combien ont choisi chaque réponse. */
  choix: Map<number, number>
  /**
   * Les plus rapides à trouver : la plus rapide, et celles arrivées au même
   * instant. Vide avec moins de trois bonnes réponses — être « le plus
   * rapide » de deux ne veut rien dire.
   */
  premiers: Set<string>
  /** Justes, et parmi le tiers le plus rapide des bonnes réponses (trois au moins). */
  reflexes: Set<string>
  /** La majorité de la salle s'est trompée (quatre réponses au moins). */
  majoriteFausse: boolean
  /** Estimations : le rang partagé de chacun, par l'écart à la vérité (1 = le plus proche). */
  rangsEstimation: Map<string, number>
  /** Estimations : le rang sous lequel on est « dans le tiers le plus proche ». */
  tiersEstimation: number
}

/** Un quiz tel qu'il a été joué : ses questions, et les points de chacun. */
export interface QuizJoue {
  sessionId: string
  questions: QuestionJouee[]
  /** Ceux à qui au moins une question a été posée. */
  participants: Set<string>
  /** Ceux qui ont répondu au moins une fois. */
  joueurs: Set<string>
  /** Points de chacun sur ce quiz, lignes d'annulation comprises. */
  points: Map<string, number>
  /** Le rang partagé de chaque participant, sur ses points ; 0 pour qui n'a pas marqué. */
  rangs: Map<string, number>
}

const cleDe = (r: { sessionId: string; qIndex: number }) => `${r.sessionId}#${r.qIndex}`

/** Le tiers d'un effectif, arrondi au-dessus : trois bonnes réponses en font une, quatre en font deux. */
export const tiers = (n: number) => Math.ceil(n / 3)

/**
 * Range le journal par question, dans l'ordre où elles ont été posées, et les
 * gains par quiz. Les joueurs qu'on ne connaît plus (exclus) sont déjà
 * retirés par l'appelant.
 */
export function indexerJournal(answers: AnswerRow[], scores: ScoreEntry[]): QuizJoue[] {
  const parQuestion = new Map<string, AnswerRow[]>()
  const ordre: string[] = []
  for (const r of answers) {
    const cle = cleDe(r)
    let lignes = parQuestion.get(cle)
    if (!lignes) {
      parQuestion.set(cle, (lignes = []))
      ordre.push(cle)
    }
    lignes.push(r)
  }

  const quiz = new Map<string, QuizJoue>()
  const quizDe = (sessionId: string) => {
    let q = quiz.get(sessionId)
    if (!q) {
      q = { sessionId, questions: [], participants: new Set(), joueurs: new Set(), points: new Map(), rangs: new Map() }
      quiz.set(sessionId, q)
    }
    return q
  }

  for (const cle of ordre) {
    const lignes = parQuestion.get(cle)!
    const premiere = lignes[0]
    const repondues = lignes.filter(r => r.answered)
    const question: QuestionJouee = {
      sessionId: premiere.sessionId,
      qIndex: premiere.qIndex,
      kind: premiere.kind,
      categorie: premiere.category ?? null,
      lignes,
      parJoueur: new Map(lignes.map(r => [r.playerId, r])),
      repondues,
      justes: [],
      choix: new Map(),
      premiers: new Set(),
      reflexes: new Set(),
      majoriteFausse: false,
      rangsEstimation: new Map(),
      tiersEstimation: 0,
    }
    if (premiere.kind === 'choice') {
      question.justes = repondues.filter(r => r.correct === true).sort((a, b) => (a.ms ?? 0) - (b.ms ?? 0))
      for (const r of repondues) if (r.choice !== null) question.choix.set(r.choice, (question.choix.get(r.choice) ?? 0) + 1)
      const n = question.justes.length
      // À deux bonnes réponses, le plus vite des deux a un vrai réflexe : un
      // duel se joue aussi à la vitesse.
      if (n >= SEUILS.reflexeJustes) {
        const plusRapide = question.justes[0].ms ?? 0
        for (const r of question.justes) if ((r.ms ?? 0) === plusRapide) question.premiers.add(r.playerId)
        // Le tiers le plus rapide — et ceux qui sont arrivés au même instant
        // que le dernier de ce tiers : une égalité ne se tranche pas au hasard.
        const limite = question.justes[tiers(n) - 1].ms ?? 0
        for (const r of question.justes) if ((r.ms ?? 0) <= limite) question.reflexes.add(r.playerId)
      }
      question.majoriteFausse = repondues.length >= 4 && repondues.length - n > repondues.length / 2
    } else {
      const estimees = repondues.filter(r => r.value !== null && r.target !== null)
      const ecarts = estimees.map(r => ecartEstimation(r.value!, r.target!))
      // Le rang se partage à égalité d'écart : deux « 1994 » exacts sont
      // premiers tous les deux, quelle que soit la seconde où ils sont arrivés
      // — et 0,7 et 0,9 pour 0,8 aussi, que la virgule flottante séparait.
      estimees.forEach((r, i) => question.rangsEstimation.set(r.playerId, rangPartage(-ecarts[i], ecarts.map(e => -e))))
      question.tiersEstimation = tiers(estimees.length)
    }
    const q = quizDe(premiere.sessionId)
    q.questions.push(question)
    for (const r of lignes) q.participants.add(r.playerId)
    for (const r of repondues) q.joueurs.add(r.playerId)
  }

  // Les points de chaque quiz viennent du journal des gains : les lignes
  // d'annulation y sont négatives, la somme suffit.
  for (const s of scores) {
    if (!s.sessionId) continue
    const q = quiz.get(s.sessionId)
    if (!q) continue
    q.points.set(s.playerId, (q.points.get(s.playerId) ?? 0) + s.points)
  }
  for (const q of quiz.values()) {
    const positifs = [...q.participants].map(id => q.points.get(id) ?? 0).filter(p => p > 0)
    for (const id of q.participants) {
      const pts = q.points.get(id) ?? 0
      q.rangs.set(id, pts > 0 ? rangPartage(pts, positifs) : 0)
    }
  }

  return [...quiz.values()]
}

/** Toutes les questions, dans l'ordre où elles ont été posées. */
export function questionsDe(quiz: QuizJoue[]): QuestionJouee[] {
  return quiz.flatMap(q => q.questions)
}
