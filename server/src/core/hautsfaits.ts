import type { ProgressInput } from './progress'
import { relevesDeSoiree } from './progress'
import { indexerJournal, questionsDe, type QuizJoue } from './journal'
import { SEUILS } from '../../../shared/profil'
import { HAUTS_FAITS_DE_SOIREE, hautFaitDeSoiree } from '../../../shared/hautsfaits'
import { rangPartage } from '../../../shared/classement'

/**
 * Les hauts faits d'une soirée, invité par invité.
 *
 * Fonction pure, comme l'expérience, le souvenir et le bilan : elle lit les
 * journaux et ne décide de rien d'autre. Elle se joue à la clôture de la
 * soirée — un « dernier du quiz » ou un « premier de la soirée » ne se juge
 * qu'une fois tout joué —, et se rejoue sur les soirées archivées : un haut
 * fait inventé aujourd'hui tombe aussi pour une soirée d'il y a un an.
 *
 * Une salle de moins de quatre joueurs n'en décerne aucun (`SEUILS.salleHautsFaits`),
 * même si l'expérience, elle, se gagne dès deux : un haut fait se mesure à
 * la salle, et à deux, « la Lanterne Rouge » tomberait à chaque partie.
 */
export function hautsFaitsDeSoiree(live: ProgressInput): Map<string, string[]> {
  const inscrits = new Set(live.players.map(p => p.id))
  const scores = live.scores.filter(s => inscrits.has(s.playerId))
  const answers = live.answers.filter(r => inscrits.has(r.playerId))
  const quiz = indexerJournal(answers, scores)
  const questions = questionsDe(quiz)
  const releves = relevesDeSoiree({ players: live.players, scores, answers }, { cloture: true })
  const joueurs = new Set(answers.filter(r => r.answered).map(r => r.playerId))
  const resultat = new Map<string, string[]>()
  if (joueurs.size < SEUILS.salleHautsFaits) return resultat

  const quizValide = (q: QuizJoue) => q.joueurs.size >= SEUILS.salleHautsFaits
  /** Ses lignes dans un quiz. */
  const lignesDe = (q: QuizJoue, id: string) =>
    q.questions.flatMap(qu => {
      const r = qu.parJoueur.get(id)
      return r ? [r] : []
    })

  // Le classement de la soirée après chaque quiz : c'est lui qui dit qui a
  // mené avant de tomber.
  const cumuls: Map<string, number>[] = []
  const courant = new Map<string, number>()
  for (const q of quiz) {
    for (const [id, pts] of q.points) courant.set(id, (courant.get(id) ?? 0) + pts)
    cumuls.push(new Map(courant))
  }
  const premiersApres = cumuls.map(cumul => {
    const positifs = [...cumul.values()].filter(p => p > 0)
    return new Set([...cumul].filter(([, p]) => p > 0 && rangPartage(p, positifs) === 1).map(([id]) => id))
  })

  for (const id of joueurs) {
    const x = releves.get(id)
    if (!x) continue
    const rel = x.releve
    const faits = new Set<string>()

    // ── Les éclats ──
    for (const q of quiz) {
      if (!quizValide(q)) continue
      const qcm = lignesDe(q, id).filter(l => l.kind === 'choice')
      if (qcm.length >= 8 && qcm.every(l => l.answered && l.correct === true)) faits.add('hf:grand-chelem')
    }
    for (const q of quiz) {
      if (q.questions.filter(qu => qu.premiers.has(id)).length >= 3) faits.add('hf:foudre')
    }
    for (let k = 1; k < quiz.length; k++) {
      const avant = quiz[k - 1]
      const q = quiz[k]
      if (!quizValide(avant) || !quizValide(q) || !avant.joueurs.has(id)) continue
      const rangAvant = avant.rangs.get(id) ?? 0
      const basse = rangAvant === 0 || rangAvant > avant.joueurs.size / 2
      if (basse && q.rangs.get(id) === 1) faits.add('hf:phenix')
    }
    if (rel.seulJuste >= 1) faits.add('hf:seul-contre-tous')
    if (rel.estimationsExactes >= 2) faits.add('hf:oracle')
    if (rel.quizGagnes >= 3) faits.add('hf:triple')
    else if (rel.quizGagnes === 2) faits.add('hf:double')
    if (rel.rang === 1 && joueurs.size >= 8 && questions.length >= SEUILS.questionsSoiree) faits.add('hf:roi')
    if (rel.meilleureSerie >= 10) faits.add('hf:increvable')
    if (rel.derniereSeconde >= 3) faits.add('hf:buzzer-or')
    if (rel.flair >= 3) faits.add('hf:flair')

    // ── Les ombres ──
    for (const q of quiz) {
      if (!quizValide(q) || q.questions.length < SEUILS.questionsQuiz) continue
      const miennes = lignesDe(q, id)
      if (miennes.length === 0 || !miennes.every(l => l.answered)) continue
      const points = [...q.joueurs].map(j => q.points.get(j) ?? 0)
      const moi = q.points.get(id) ?? 0
      const min = Math.min(...points)
      const max = Math.max(...points)
      if (moi === min && min < max) faits.add('hf:lanterne-rouge')
      if (miennes.length >= SEUILS.questionsQuiz && moi <= 0) faits.add('hf:zero-pointe')
    }
    for (const q of quiz) {
      if (!quizValide(q) || q.rangs.get(id) !== 2) continue
      const meilleur = Math.max(...[...q.participants].map(j => q.points.get(j) ?? 0))
      if (meilleur - (q.points.get(id) ?? 0) <= 20) faits.add('hf:presque')
    }
    if (quiz.length >= 2 && (rel.rang === 0 || rel.rang > joueurs.size / 2)) {
      for (let k = 0; k < quiz.length - 1; k++) {
        if (premiersApres[k].has(id)) faits.add('hf:ascenseur')
      }
    }

    let kamikaze = 0
    let contreCourant = 0
    let absences = 0
    let pireAbsence = 0
    for (const qu of questions) {
      const r = qu.parJoueur.get(id)
      if (!r) continue
      if (!r.answered) {
        pireAbsence = Math.max(pireAbsence, ++absences)
        continue
      }
      absences = 0
      if (qu.kind === 'choice') {
        if (r.correct !== true) {
          if ((r.ms ?? Infinity) < 2000) kamikaze++
          if (r.changes >= 3) faits.add('hf:girouette')
          if (r.choice !== null && qu.choix.get(r.choice) === 1 && qu.repondues.length >= 6) contreCourant++
        }
      } else if (r.value !== null && r.target !== null && estCosmique(r.value, r.target)) {
        faits.add('hf:cosmique')
      }
    }
    if (kamikaze >= 5) faits.add('hf:kamikaze')
    if (contreCourant >= 3) faits.add('hf:contre-courant')
    if (pireAbsence >= 5) faits.add('hf:somnambule')

    if (faits.size > 0) resultat.set(id, HAUTS_FAITS_DE_SOIREE.map(h => h.key).filter(k => faits.has(k)))
  }
  return resultat
}

/**
 * Un facteur dix d'écart : « 19940 » pour 1994, ou « 199 ». Quand la vérité
 * est nulle ou que les signes diffèrent, un écart de neuf fois la vérité (au
 * moins neuf unités) en tient lieu.
 */
export function estCosmique(value: number, target: number): boolean {
  if (value !== 0 && target !== 0 && Math.sign(value) === Math.sign(target)) {
    const rapport = Math.abs(value) / Math.abs(target)
    return rapport >= 10 || rapport <= 0.1
  }
  return Math.abs(value - target) >= 9 * Math.max(1, Math.abs(target))
}

/** L'expérience que ces hauts faits de soirée rapportent. */
export function xpDesHautsFaits(cles: readonly string[]): number {
  return cles.reduce((xp, cle) => xp + (hautFaitDeSoiree(cle)?.xp ?? 0), 0)
}
