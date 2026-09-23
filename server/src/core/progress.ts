import type { PlayerRec } from './party'
import type { ScoreEntry } from './scores'
import type { AnswerRow } from './answers'
import { indexerJournal, questionsDe } from './journal'
import { SEUILS, XP, gainVide, releveVide, totalGain, type GainSoiree, type ReleveSoiree } from '../../../shared/profil'
import { rangPartage } from '../../../shared/classement'

/**
 * Ce qu'une soirée rapporte aux profils qui l'ont jouée.
 *
 * Fonction pure, dérivée des journaux — même famille que `recap.ts`,
 * `stats.ts` et `review.ts`, et même lecture du journal que les hauts faits
 * (`journal.ts`). Elle ne lit aucune base et n'écrit nulle part : la
 * consolidation se fait dans `space.ts`, après chaque quiz puis à la clôture.
 *
 * Le barème (`shared/profil.ts`) récompense le mérite : répondre rapporte un
 * peu, viser juste, vite et finir devant beaucoup plus. Chaque gain d'un quiz
 * est définitif dès son podium ; le podium de la soirée et l'assiduité ne se
 * décident qu'à la clôture (`cloture`), si bien que l'expérience d'un profil
 * ne redescend jamais pendant une soirée — elle le faisait, en silence.
 */
export interface ProgressInput {
  players: PlayerRec[]
  scores: ScoreEntry[]
  answers: AnswerRow[]
}

export interface ProgressOptions {
  /** La soirée se clôt : le podium de la soirée et l'assiduité se décident maintenant. */
  cloture?: boolean
  /** L'expérience que les hauts faits de la soirée rapportent, par invité — calculée à part. */
  hautsFaits?: ReadonlyMap<string, number>
}

export interface SoireeGain {
  profileId: string
  playerId: string
  /** L'emoji joué ce soir-là — celui qui peut éclater. */
  avatar: string
  gain: GainSoiree
  /** Les chiffres bruts, que la carrière additionne. */
  releve: ReleveSoiree
  xp: number
}

/** L'écart relatif d'une estimation, borné : une touche restée enfoncée ne fausse pas la moyenne. */
const ecartRelatif = (value: number, target: number) => Math.min(10, Math.abs(value - target) / Math.max(1, Math.abs(target)))

/** Le relevé et le gain de chaque invité de la soirée, profils ou non. */
export function relevesDeSoiree(
  live: ProgressInput,
  options: ProgressOptions = {},
): Map<string, { releve: ReleveSoiree; gain: GainSoiree }> {
  // Des gains et des réponses sans joueur — ceux d'un invité exclu — ne
  // comptent pour personne : en tête de la soirée, un fantôme faisait
  // descendre tout le podium d'une marche et raflait la victoire d'un quiz.
  const inscrits = new Set(live.players.map(p => p.id))
  const scores = live.scores.filter(s => inscrits.has(s.playerId))
  const answers = live.answers.filter(r => inscrits.has(r.playerId))
  const quiz = indexerJournal(answers, scores)
  const questions = questionsDe(quiz)

  const par = new Map<string, { releve: ReleveSoiree; gain: GainSoiree }>()
  const de = (playerId: string) => {
    let x = par.get(playerId)
    if (!x) par.set(playerId, (x = { releve: releveVide(), gain: gainVide() }))
    return x
  }

  // ── Question par question ─────────────────────────────────────────────
  const series = new Map<string, number>()
  for (const q of questions) {
    // Une question posée à un seul joueur ne rapporte rien : seul devant son
    // téléphone, on enchaînerait les quiz pour soi.
    const valide = q.lignes.length >= SEUILS.salleQuestion
    for (const r of q.lignes) {
      const { releve: rel, gain } = de(r.playerId)
      rel.questions++
      if (q.kind === 'choice' && q.categorie) {
        const cat = (rel.categories[q.categorie] ??= { questions: 0, justes: 0 })
        cat.questions++
        if (r.correct === true) cat.justes++
      }
      if (!r.answered) {
        // Laisser passer casse la série, sans en nourrir aucune.
        if (q.kind === 'choice') series.set(r.playerId, 0)
        continue
      }
      rel.reponses++
      rel.revirements += r.changes
      if (valide) gain.reponses += XP.reponse
      if (q.kind === 'choice') {
        rel.qcm++
        if (r.correct !== true) {
          series.set(r.playerId, 0)
          continue
        }
        const serie = (series.get(r.playerId) ?? 0) + 1
        series.set(r.playerId, serie)
        rel.meilleureSerie = Math.max(rel.meilleureSerie, serie)
        const ms = r.ms ?? 0
        rel.justes++
        rel.tempsJustesMs += ms
        if (rel.meilleurTempsMs === null || ms < rel.meilleurTempsMs) rel.meilleurTempsMs = ms
        if (ms >= r.durationMs - 1000) rel.derniereSeconde++
        if (q.premiers.has(r.playerId)) rel.premiers++
        if (q.justes.length === 1 && q.repondues.length >= 6) rel.seulJuste++
        if (q.majoriteFausse) rel.flair++
        if (valide) gain.justesse += XP.juste
        if (q.reflexes.has(r.playerId)) {
          rel.reflexes++
          if (valide) gain.reflexe += XP.reflexe
        }
      } else if (r.value !== null && r.target !== null) {
        rel.estimations++
        if (r.value === r.target) rel.estimationsExactes++
        rel.ecartRelatif += ecartRelatif(r.value, r.target)
        const rang = q.rangsEstimation.get(r.playerId)
        if (rang !== undefined && rang <= q.tiersEstimation) rel.estimationsProches++
        if (valide && rang !== undefined) {
          if (rang === 1) gain.estimation += XP.estimationMeilleure
          else if (rang <= q.tiersEstimation) gain.estimation += XP.estimationProche
        }
      }
    }
  }

  // ── Quiz par quiz ─────────────────────────────────────────────────────
  for (const q of quiz) {
    for (const id of q.participants) de(id).releve.quizJoues++
    // Un quiz d'une question entre deux joueurs n'a pas de podium : c'était
    // une victoire entière, et on recommençait.
    if (q.questions.length < SEUILS.questionsQuiz || q.joueurs.size < SEUILS.salleQuiz) continue
    for (const id of q.participants) {
      const { releve: rel, gain } = de(id)
      const rang = q.rangs.get(id) ?? 0
      // Une marche de moins que la salle : à deux, le second ne monte pas
      // sur le podium — il y aurait gagné quinze points à perdre un duel.
      if (rang >= 1 && rang <= XP.podiumQuiz.length && rang < q.joueurs.size) {
        rel.podiumsQuiz++
        gain.quiz += XP.podiumQuiz[rang - 1]
      }
      if (rang === 1) rel.quizGagnes++
      const qcm = q.questions.flatMap(question => {
        const l = question.kind === 'choice' ? question.parJoueur.get(id) : undefined
        return l ? [l] : []
      })
      if (qcm.length >= SEUILS.sansFauteQcm && qcm.every(l => l.answered && l.correct === true)) {
        gain.quiz += XP.sansFaute
      }
    }
  }

  // ── La soirée ─────────────────────────────────────────────────────────
  const totals = new Map<string, number>()
  for (const s of scores) totals.set(s.playerId, (totals.get(s.playerId) ?? 0) + s.points)
  const joueurs = new Set(answers.filter(r => r.answered).map(r => r.playerId))
  // Le podium se gagne contre toute la salle, pas contre les seuls inscrits :
  // un profil qui finit troisième derrière deux anonymes n'est pas deuxième.
  const positifs = [...totals.values()].filter(pts => pts > 0)
  const soireeValide = questions.length >= SEUILS.questionsSoiree && joueurs.size >= SEUILS.salleSoiree
  for (const [id, x] of par) {
    const pts = totals.get(id) ?? 0
    x.releve.points = pts
    x.releve.joueurs = joueurs.size
    x.releve.rang = pts > 0 ? rangPartage(pts, positifs) : 0
    if (!options.cloture || !soireeValide) continue
    if (x.releve.rang >= 1 && x.releve.rang <= XP.podiumSoiree.length && x.releve.rang < joueurs.size) {
      x.gain.soiree += XP.podiumSoiree[x.releve.rang - 1]
    }
    if (x.releve.questions >= SEUILS.questionsSoiree && x.releve.reponses >= x.releve.questions * SEUILS.assiduitePart) {
      x.gain.soiree += XP.assiduite
    }
  }
  for (const [id, xp] of options.hautsFaits ?? []) if (par.has(id)) par.get(id)!.gain.hautsFaits = xp
  return par
}

/**
 * Ce que la soirée rapporte à chaque profil qui l'a jouée : un gain par
 * profil, au plus.
 */
export function buildProgress(live: ProgressInput, options: ProgressOptions = {}): SoireeGain[] {
  const releves = relevesDeSoiree(live, options)
  const gains = live.players.flatMap(p => {
    // Un invité anonyme ne gagne rien — et c'est sans conséquence sur sa
    // soirée : l'expérience ne donne aucun avantage de jeu. L'animateur qui
    // joue chez lui gagne comme tout le monde : on l'avait mis hors concours
    // parce qu'il connaît ses quiz, et il ne progressait jamais aux fêtes
    // qu'il organise — les siennes, souvent les seules.
    if (!p.profileId) return []
    const x = releves.get(p.id)
    // Personne ne lui a posé de question : il n'a pas joué.
    if (!x || x.releve.questions === 0) return []
    const releve = { ...x.releve, avatar: p.avatar }
    return [{ profileId: p.profileId, playerId: p.id, avatar: p.avatar, gain: x.gain, releve, xp: totalGain(x.gain) }]
  })

  // Un gain par profil, au plus. Un profil ne tient qu'un joueur par soirée —
  // c'est à l'inscription de le garantir ; s'il en tenait deux quand même,
  // leurs deux lignes (profil, soirée) se remplaceraient l'une l'autre au
  // crédit, dans un ordre que personne ne choisit. On garde la meilleure, et
  // à égalité la première arrivée.
  const parProfil = new Map<string, SoireeGain>()
  for (const g of gains) {
    const deja = parProfil.get(g.profileId)
    if (!deja || g.xp > deja.xp) parProfil.set(g.profileId, g)
  }
  return [...parProfil.values()]
}
