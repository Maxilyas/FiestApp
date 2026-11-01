// Le Quiz : quatre questions classiques d'un même thème — une catégorie
// (« Histoire »), un sujet de la base (« Les animaux », « Les années 80 »,
// « Harry Potter »), une rubrique (« Le football ») —, quatre réponses chacune,
// sous un seul chrono. Le jeu que le propriétaire voulait le 1er novembre
// 2026 : « des questions classiques sur des thèmes type QCM, avec tous les
// thèmes disponibles », pour que la carte d'une traversée ne promette pas
// toujours les douze mêmes catégories.
//
// Il joue comme l'Éclair : les questions arrivent ensemble, la page les montre
// une à une, tient les réponses et les envoie ensemble — à la dernière, ou
// d'elle-même à l'échéance, avec celles qu'il a eu le temps de dire. Elle ne
// compte pas les justes en route, et le serveur ne sait rien de la manche
// avant l'envoi (invariant 1) : Changer, jusque-là, ne perd rien.
//
// Une pièce pour les quatre, hors de la base (`cab:quiz:…`, `idDuQuiz`) : le
// pli n'écrit qu'une pièce par verdict et par étape, et le Quiz n'a qu'une
// étape. Ni carnet ni signalement, donc — l'écran le dit —, et le Cabinet la
// déplie pour ne pas reposer ses questions avant sept jours (`deplier`).

import { DUREES_DES_JEUX, JUSTES_DU_QUIZ } from '../bareme'
import { idDuQuiz } from '../pieces'
import { effacablesAuPlus } from '../pouvoirs'
import {
  GESTE_A_JUGER,
  SANS_REPONSE,
  auHasard,
  champsDuGeste,
  estUnIndex,
  etoilesAuxJustes,
  marcheLaPlusHaute,
  reponseEnvoyee,
  rienAEclairer,
  type QuestionTiree,
} from './outils'
import { justeDeLaPiece, type RegleDuJeu, type VerdictDUneManche } from './regle'

/** Les questions d'une manche du Quiz, tirées au départ, et le thème qu'elles partagent. */
export interface QuizTire {
  jeu: 'quiz'
  /**
   * Ce que la manche pose, en mots : la catégorie, le sujet ou la rubrique que
   * le tireur a trouvés — celui que la carte a promis, d'ordinaire ; sans assez
   * de questions jamais vues, un autre, et l'écran dit lequel.
   */
  theme: string | null
  questions: readonly QuestionTiree[]
}

/** Ce que le serveur sait d'une manche du Quiz avant l'envoi : ce qu'Éclairer a effacé, question par question. */
export interface EtatDuQuiz {
  /** Les réponses effacées de chaque question : jamais la bonne, deux au plus (`effacablesAuPlus`). */
  effacees: readonly (readonly number[])[]
}

/** Les réponses, dans l'ordre des questions : un index de ses réponses, ou `null`, pas répondue. */
export type GesteDuQuiz = { quoi: 'repondre'; choix: readonly (number | null)[] }

export interface QuizMontre {
  jeu: 'quiz'
  theme: string | null
  /** Chaque question et ses réponses, jamais la bonne. */
  questions: { texte: string; reponses: string[]; categorie: string | null }[]
  /** Les réponses effacées de chaque question, dans l'ordre des questions. */
  effacees: number[][]
}

export interface QuizRevele {
  jeu: 'quiz'
  /** « 3 sur 4 ». */
  titre: string
  justes: number
  /** Chaque question, ses réponses, la bonne et la sienne — `null` s'il n'y a pas répondu. */
  questions: { texte: string; reponses: string[]; bonne: number; choix: number | null }[]
  /** « Le savais-tu ? » de la première ratée, sinon de la première qui en a un. */
  savais: string | null
}

/**
 * « 02.1 » : ce qu'il a répondu à chacune, l'index de sa réponse ou `.` pas
 * répondue. Le journal le garde, la révélation le relit. Un chiffre par
 * question : un QCM du Cabinet a quatre réponses (`estUnQcmDuCabinet`).
 */
const composeeDe = (choix: readonly (number | null)[]) => choix.map(c => (c === null ? SANS_REPONSE : String(c))).join('')
const lireLaComposee = (composee: string | null | undefined, n: number): (number | null)[] =>
  Array.from({ length: n }, (_, i) => {
    const c = composee?.[i]
    return c !== undefined && /^\d$/.test(c) ? Number(c) : null
  })

/**
 * La question dont la révélation et le cartel disent « Le savais-tu ? » : ce
 * qu'il a raté s'apprend d'abord — la première ratée qui en a un —, sinon la
 * première qui en a un.
 */
function questionAApprendre(t: QuizTire, choix: readonly (number | null)[]): QuestionTiree | undefined {
  const sue = (i: number) => (choix[i] === t.questions[i].bonne ? 1 : 0)
  return t.questions
    .map((q, i) => ({ q, i }))
    .filter(({ q }) => q.anecdote)
    .sort((x, y) => sue(x.i) - sue(y.i) || x.i - y.i)[0]?.q
}

/** Les mauvaises réponses qu'Éclairer peut encore effacer à cette question : aucune une fois ses deux effacées (`effacablesAuPlus`). */
function encoreEffacables(t: QuizTire, e: EtatDuQuiz, i: number): number[] {
  const q = t.questions[i]
  const deja = e.effacees[i] ?? []
  if (deja.length >= effacablesAuPlus(q.reponses.length)) return []
  return q.reponses.map((_, k) => k).filter(k => k !== q.bonne && !deja.includes(k))
}

export const REGLE_DU_QUIZ: RegleDuJeu<QuizTire, EtatDuQuiz, GesteDuQuiz, QuizMontre, QuizRevele> = {
  cle: 'quiz',
  etapes: 1,
  dureeMs: () => DUREES_DES_JEUX.quiz * 1000,

  ouvrir: t => ({ effacees: t.questions.map(() => []) }),

  lireLeGeste(brut, t) {
    const g = champsDuGeste(brut)
    if (!g || g.quoi !== 'repondre') return null
    const n = t.questions.length
    const r = reponseEnvoyee(g, 'quiz')
    if (r === undefined) return { quoi: 'repondre', choix: Array(n).fill(null) }
    if (r === null) return null
    // À l'échéance, la page envoie celles qu'il a eu le temps de dire : les autres ne sont pas répondues.
    const brutes = r.choix
    if (!Array.isArray(brutes) || brutes.length > n) return null
    const choix = Array.from({ length: n }, (_, i): unknown => brutes[i] ?? null)
    if (!choix.every((c, i) => c === null || estUnIndex(c, t.questions[i].reponses.length))) return null
    return { quoi: 'repondre', choix: choix as (number | null)[] }
  },

  // Un seul geste au Quiz, l'envoi — `repondre`, qui tranche : la règle commune suffit (`trancheLaManche`).
  apresLeGeste: () => GESTE_A_JUGER,

  juger(t, _e, reponse): VerdictDUneManche {
    const choix = typeof reponse === 'object' ? reponse.choix : []
    const justes = t.questions.filter((q, i) => choix[i] === q.bonne).length
    // Le barème : au moins tant de justes pour ★★★, ★★, ★ (`JUSTES_DU_QUIZ`).
    const naturel = etoilesAuxJustes(justes, JUSTES_DU_QUIZ)
    if (!choix.some(c => c !== null && c !== undefined)) return { naturel, pieces: [{ juste: false, choix: null, composee: null }] }
    const juste = justeDeLaPiece(naturel, 'quiz') === true
    return { naturel, pieces: [{ juste, choix: juste ? 0 : -1, composee: composeeDe(t.questions.map((_, i) => choix[i] ?? null)) }] }
  },

  eclairer(t, e, hasard, cible) {
    // D'abord ce qui reste à effacer dans la manche : c'est ce que le pli demande pour griser Éclairer.
    if (t.questions.every((_, i) => encoreEffacables(t, e, i).length === 0)) return rienAEclairer('quiz')
    if (cible === undefined || !Number.isInteger(cible) || cible < 0 || cible >= t.questions.length) return 'Choisis la question à éclairer'
    const mauvaises = encoreEffacables(t, e, cible)
    if (mauvaises.length === 0) return 'Plus rien à effacer à cette question'
    return { effacees: t.questions.map((_, i) => (i === cible ? [...(e.effacees[i] ?? []), auHasard(mauvaises, hasard)] : [...(e.effacees[i] ?? [])])) }
  },

  montrer(t, e) {
    return {
      jeu: 'quiz',
      theme: t.theme,
      questions: t.questions.map(q => ({ texte: q.texte, reponses: [...q.reponses], categorie: q.categorie })),
      effacees: t.questions.map((_, i) => [...(e.effacees[i] ?? [])]),
    }
  },

  reveler(t, _e, v) {
    const choix = lireLaComposee(v.pieces[0]?.composee, t.questions.length)
    const questions = t.questions.map((q, i) => ({ texte: q.texte, reponses: [...q.reponses], bonne: q.bonne, choix: choix[i] }))
    const justes = questions.filter(q => q.choix === q.bonne).length
    return {
      jeu: 'quiz',
      titre: `${justes} sur ${t.questions.length}`,
      justes,
      questions,
      savais: questionAApprendre(t, choix)?.anecdote ?? null,
    }
  },

  piece(t, _e, v, i) {
    const qs = t.questions
    return {
      id: idDuQuiz(qs.map(q => q.id)),
      // Ce qu'il demandait, et la bonne réponse de chacune : la version jouée, même quand la base aura changé.
      texte: qs.map(q => q.texte).join(' · '),
      reponses: [qs.map(q => q.reponses[q.bonne]).join(' · ')],
      bonne: 0,
      categorie: qs[0]?.categorie ?? null,
      anecdote: questionAApprendre(t, lireLaComposee(v.pieces[0]?.composee, qs.length))?.anecdote ?? null,
      // La marche la plus haute de ses questions : celle que sa pièce garde.
      niveau: marcheLaPlusHaute(qs.map(q => q.niveau)),
      forme: 'quiz',
      cabinet: { jeu: 'quiz', manche: i.manche, tirage: i.tirage },
    }
  },

  cartel(t, v) {
    const q = questionAApprendre(t, lireLaComposee(v.pieces[0]?.composee, t.questions.length)) ?? t.questions[0]
    return { sujet: q.texte, reponse: q.reponses[q.bonne], anecdote: q.anecdote }
  },
}
