import type { PartyArchive } from '../../../shared/archive'
import type { SouvenirDeQuestion } from '../../../shared/library'

/**
 * La mémoire des quiz (rapport du 25 septembre 2026, lot 5) : ce que
 * l'historique sait de chaque quiz de la bibliothèque et de chacune de ses
 * questions — quand on les a jouées, combien de fois, et qui a trouvé.
 *
 * Aucune ligne de « Mes quiz » ne disait « joué le 14 mars », et pour ne pas
 * reposer les mêmes questions aux mêmes amis, il fallait s'en souvenir. La
 * copie jouée porte désormais l'identifiant de son quiz (`ArchivedPack.quizId`)
 * et celui de chaque question (`PlayableQuestion.id`) : la fiche de chaque
 * soirée en garde le relevé, quelques octets par question, et la
 * bibliothèque lit ces fiches — jamais les archives. Les soirées d'avant n'en
 * ont pas : « jamais joué » y vaut « pas depuis que l'historique s'en
 * souvient ».
 *
 * Dérivations pures (invariant 14) : la soirée en cours, rangée après chaque
 * quiz, passe par le même chemin qu'une archive.
 */

/**
 * Une partie de la soirée, telle que la fiche la garde : le quiz joué, et
 * pour chaque question posée `[identifiant, invités à qui elle a été posée,
 * bonnes réponses]` — null pour une estimation, qui n'est jamais « juste ».
 */
export interface Jeu {
  quizId: string
  questions: [string, number, number | null][]
}

/** Le relevé d'une archive : ses parties dont on connaît le quiz. */
export function jeuxDeLArchive(a: PartyArchive): Jeu[] {
  const lignes = new Map<string, Map<number, { posees: number; justes: number }>>()
  for (const r of a.answers) {
    let parQuestion = lignes.get(r.sessionId)
    if (!parQuestion) lignes.set(r.sessionId, (parQuestion = new Map()))
    const q = parQuestion.get(r.qIndex) ?? { posees: 0, justes: 0 }
    q.posees++
    if (r.correct === true) q.justes++
    parQuestion.set(r.qIndex, q)
  }
  const jeux: Jeu[] = []
  for (const [sessionId, pack] of Object.entries(a.packs)) {
    if (!pack.quizId) continue
    const questions: Jeu['questions'] = []
    for (const [qIndex, releve] of [...(lignes.get(sessionId) ?? [])].sort((x, y) => x[0] - y[0])) {
      const q = pack.questions[qIndex]
      if (!q?.id) continue
      questions.push([q.id, releve.posees, q.kind === 'choice' ? releve.justes : null])
    }
    jeux.push({ quizId: pack.quizId, questions })
  }
  return jeux
}

export interface MemoireDesQuiz {
  quiz: Map<string, { fois: number; dernier: number }>
  questions: Map<string, SouvenirDeQuestion>
}

/**
 * La mémoire d'un espace, depuis les fiches de ses soirées. Un quiz joué deux
 * fois le même soir compte deux parties ; une question garde le relevé de sa
 * dernière soirée — deux parties ce soir-là s'additionnent.
 */
export function memoireDesSoirees(soirees: readonly { heldAt: number; jeux?: readonly Jeu[] }[]): MemoireDesQuiz {
  const quiz = new Map<string, { fois: number; dernier: number }>()
  const questions = new Map<string, SouvenirDeQuestion>()
  for (const s of [...soirees].sort((a, b) => a.heldAt - b.heldAt)) {
    for (const jeu of s.jeux ?? []) {
      const q = quiz.get(jeu.quizId)
      quiz.set(jeu.quizId, { fois: (q?.fois ?? 0) + 1, dernier: Math.max(q?.dernier ?? 0, s.heldAt) })
      for (const [id, posees, justes] of jeu.questions) {
        const avant = questions.get(id)
        // Les soirées se lisent dans l'ordre : la plus récente remplace, la même s'additionne.
        const memeSoiree = avant?.dernier === s.heldAt
        questions.set(id, {
          fois: (avant?.fois ?? 0) + 1,
          dernier: s.heldAt,
          posees: (memeSoiree ? avant!.posees : 0) + posees,
          justes: justes === null ? null : (memeSoiree && avant!.justes !== null ? avant!.justes : 0) + justes,
        })
      }
    }
  }
  return { quiz, questions }
}

/** Le moment où chaque question a été posée pour la dernière fois : ce que le tirage lit. */
export function dernieresFois(m: MemoireDesQuiz): Map<string, number> {
  return new Map([...m.questions].map(([id, q]) => [id, q.dernier]))
}
