// Le hasard d'une partie : l'ordre des réponses, l'ordre des questions.
//
// En tapant une liste, on écrit la bonne réponse en premier : 6 QCM sur 10
// dans le quiz des années 90 du rapport du 25 septembre, 7 sur 7 dans le
// modèle personnalisé — et la salle finit par répondre ▲ sans lire. L'éditeur
// le disait ; le quiz peut maintenant le régler lui-même : ses réponses se
// mélangent une fois, au lancement de la partie, dans le même ordre pour
// toute la salle — l'écran commun et les téléphones montrent ▲◆●■ au même
// endroit, et la répartition des réponses se lit sur la même grille.
//
// C'est la copie jouée du quiz qui porte cet ordre : la partie la garde, le
// journal écrit ses numéros, l'archive la range. Le bilan, le souvenir et
// l'historique la relisent telle quelle — jamais la bibliothèque.

import { lireNombreEnTete } from './nombres'
import type { PlayableQuestion } from './library'

/** Ce qu'un quiz demande au hasard, réglé dans l'éditeur (« Régler tout le quiz »). */
export interface ReglagesDuQuiz {
  /** Les réponses de chaque QCM se mélangent au lancement de chaque partie. */
  melangerReponses?: boolean
  /** Les questions se jouent dans un ordre tiré au lancement de chaque partie. */
  melangerQuestions?: boolean
  /**
   * Ne jouer que ce nombre de questions, tirées parmi toutes — celles que
   * l'espace n'a jamais jouées d'abord. Null ou absent : toutes.
   */
  tirage?: number | null
}

/** Au moins cinq questions tirées : en dessous, le podium du quiz ne rapporte rien (`SEUILS.questionsQuiz`). */
export const TIRAGE_MIN = 5

/** Lit les réglages envoyés par un navigateur : ce qui ne se lit pas vaut « non ». */
export function normaliserReglages(brut: unknown): ReglagesDuQuiz {
  const r = brut && typeof brut === 'object' ? (brut as Record<string, unknown>) : {}
  const tirage = Number(r.tirage)
  return {
    ...(r.melangerReponses === true && { melangerReponses: true }),
    ...(r.melangerQuestions === true && { melangerQuestions: true }),
    ...(r.tirage !== null && r.tirage !== undefined && Number.isInteger(tirage) && tirage >= TIRAGE_MIN && tirage <= 100 && { tirage }),
  }
}

/** Un nombre au hasard dans [0, 1) : `Math.random` en soirée, une suite fixée dans les tests. */
export type Aleatoire = () => number

/** Une permutation de 0…n-1 tirée au hasard (Fisher-Yates). */
function permutation(n: number, aleatoire: Aleatoire): number[] {
  const ordre = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(aleatoire() * (i + 1))
    ;[ordre[i], ordre[j]] = [ordre[j], ordre[i]]
  }
  return ordre
}

/** « Vrai, Faux » : un ordre que tout le monde attend, qu'on ne mélange pas. */
function vraiOuFaux(answers: readonly string[]): boolean {
  const a = answers.map(r => r.trim().toLowerCase())
  return a.length === 2 && a.includes('vrai') && a.includes('faux')
}

/**
 * L'ordre dans lequel une question à choix montre ses réponses, en indices des
 * réponses écrites. Des réponses toutes chiffrées (« 3 500 / 12 000 / 35 000
 * / 60 000 », « 2 ans / 5 ans ») se rangent de la plus petite à la plus
 * grande : mélangées, elles se liraient mal. Un vrai ou faux, et une question
 * marquée « ordre fixe », gardent l'ordre écrit.
 */
export function ordreDesReponses(q: PlayableQuestion, aleatoire: Aleatoire): number[] {
  const n = q.kind === 'choice' ? q.answers.length : 0
  const tel = Array.from({ length: n }, (_, i) => i)
  if (q.kind !== 'choice' || q.ordreFixe || vraiOuFaux(q.answers)) return tel
  const nombres = q.answers.map(a => lireNombreEnTete(a)?.valeur ?? null)
  if (nombres.every(v => v !== null)) return tel.sort((i, j) => nombres[i]! - nombres[j]!)
  return permutation(n, aleatoire)
}

/** La question avec ses réponses dans cet ordre, sa bonne réponse suivie. */
function reordonner(q: PlayableQuestion, ordre: readonly number[]): PlayableQuestion {
  if (q.kind !== 'choice' || ordre.every((v, i) => v === i)) return q
  return { ...q, answers: ordre.map(i => q.answers[i]), correct: ordre.indexOf(q.correct) }
}

/**
 * La copie jouée d'un quiz : ses réponses et ses questions dans l'ordre que
 * ses réglages demandent. Sans réglage, le quiz tel qu'il est écrit — le même
 * tableau, pour qu'un quiz d'avant ne change en rien.
 */
export function preparerPartie(
  questions: readonly PlayableQuestion[],
  reglages: ReglagesDuQuiz | undefined,
  aleatoire: Aleatoire = Math.random,
): PlayableQuestion[] {
  let jouees = [...questions]
  if (reglages?.melangerQuestions) jouees = permutation(jouees.length, aleatoire).map(i => jouees[i])
  if (reglages?.melangerReponses) jouees = jouees.map(q => reordonner(q, ordreDesReponses(q, aleatoire)))
  return jouees
}

/**
 * Une suite de nombres qui se répète, pour les tests : le hasard de la soirée
 * ne s'y écrit pas, mais un geste doit s'y rejouer à l'identique.
 */
export function suiteFixe(graine: number): Aleatoire {
  let x = graine >>> 0 || 1
  return () => {
    // xorshift32 : assez pour mélanger quatre réponses, sans dépendance.
    x ^= x << 13
    x >>>= 0
    x ^= x >>> 17
    x ^= x << 5
    x >>>= 0
    return x / 0x1_0000_0000
  }
}
