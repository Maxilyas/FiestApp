// La campagne au QG (`/admin#campagne`) : ce que la page montre au-dessus des
// sentiers et de la base — les chiffres d'aujourd'hui, ce qu'on joue sous-mode
// par sous-mode sur trente jours, le défi de la semaine, les parcours de
// thème, les vies (le choix du 13 octobre 2026, sur maquettes). Les
// dérivations sont pures : le serveur les applique, la page et les tests les
// relisent.

import { compteDuJour, jourDeLInstant, joursDesMinuits, type CompteDuJour } from './qg'
import { VIES_PAR_JOUR } from './sentiers'
import type { ApparenceDeLAvatar } from './profil'

/**
 * Les parties de la campagne que le QG suit, sous-mode par sous-mode — les
 * duels ont leur page. Le Cabinet de curiosités en est un : il compte en
 * campagne (`modeDeLaSerie`), ses parties à part des séries, dès avant son
 * ouverture — une page du QG à lui n'est pas de sa première version.
 */
export const SOUS_MODES_DE_CAMPAGNE = ['serie', 'sentier', 'sujet', 'revision', 'defi', 'cabinet'] as const
export type SousModeDeCampagne = (typeof SOUS_MODES_DE_CAMPAGNE)[number]

/** Leurs noms, tels que les joueurs les lisent : un sentier à thème est un parcours de thème. */
export const NOM_DU_SOUS_MODE: Record<SousModeDeCampagne, string> = {
  serie: 'Séries',
  sentier: 'Sentiers',
  sujet: 'Parcours de thème',
  revision: 'Révisions',
  defi: 'Défi de la semaine',
  cabinet: 'Cabinet',
}

/** Le sous-mode d'une ligne de `campagne_series` : sans mode, une série ; null, un duel, une rencontre ou une expédition. */
export function sousModeDe(mode: string | null): SousModeDeCampagne | null {
  if (mode === null) return 'serie'
  return (SOUS_MODES_DE_CAMPAGNE as readonly string[]).includes(mode) ? (mode as SousModeDeCampagne) : null
}

/** La campagne dans la vue d'ensemble : ses trente jours, lus avec les autres modes (`lesTrenteJours`). */
export interface CampagneDeLaVue {
  /** Les parties commencées chaque jour, sous-mode par sous-mode, le plus ancien d'abord. */
  parJour: { jour: string; modes: Record<SousModeDeCampagne, number> }[]
  /** Ceux qui ont joué aujourd'hui, tous sous-modes, comparés à la même heure des sept jours d'avant. */
  joueurs: CompteDuJour
  /** Aujourd'hui, sous-mode par sous-mode : ses parties, et ses joueurs. */
  aujourdhui: Record<SousModeDeCampagne, { parties: number; joueurs: number }>
}

const parSousMode = <T>(f: () => T): Record<SousModeDeCampagne, T> =>
  Object.fromEntries(SOUS_MODES_DE_CAMPAGNE.map(m => [m, f()])) as Record<SousModeDeCampagne, T>

/**
 * Ce que la vue d'ensemble dit de la campagne, tiré des séries qu'elle a déjà
 * lues (`seriesDepuis`) : rien ne se relit pour la page de la campagne. Une
 * partie compte au jour où elle a commencé, rejeux compris — c'est ce qu'on
 * joue, pas ce qu'on gagne.
 */
export function campagneDeLaVue(series: readonly { quand: number; qui: string; mode: string | null }[], minuits: readonly number[], maintenant: number): CampagneDeLaVue {
  const jours = joursDesMinuits(minuits)
  const parJour = minuits.map(() => parSousMode(() => 0))
  const aujourdhui = parSousMode(() => ({ parties: 0, qui: new Set<string>() }))
  const dernier = minuits.length - 1
  const campagne: { quand: number; qui: string }[] = []
  for (const s of series) {
    const m = sousModeDe(s.mode)
    if (!m || s.quand > maintenant) continue
    const i = jourDeLInstant(minuits, s.quand)
    if (i < 0) continue
    campagne.push(s)
    parJour[i][m]++
    if (i === dernier) {
      aujourdhui[m].parties++
      aujourdhui[m].qui.add(s.qui)
    }
  }
  return {
    parJour: jours.map((jour, i) => ({ jour, modes: parJour[i] })),
    joueurs: compteDuJour(campagne, minuits, maintenant, { distincts: true }),
    aujourdhui: Object.fromEntries(SOUS_MODES_DE_CAMPAGNE.map(m => [m, { parties: aujourdhui[m].parties, joueurs: aujourdhui[m].qui.size }])) as CampagneDeLaVue['aujourdhui'],
  }
}

// ── Le suivi : ce que la page lit à son ouverture ───────────────────────────

/** Une question du défi se juge à partir de cinq réponses : en dessous, une seule faute la ferait « la plus ratée ». */
export const REPONSES_POUR_JUGER = 5
export const QUESTIONS_RATEES_MONTREES = 3
export const PARCOURS_AU_QG = 5

/** Une question du défi, et ce que ses réponses en disent. */
export interface QuestionDuDefiAuQg {
  /** Sa place dans la série, à partir de 0. */
  index: number
  texte: string
  categorie: string | null
  reponses: number
  justes: number
}

/**
 * Le défi de la semaine, au QG : ce que ses tentatives disent — sans jamais
 * le tirer (le premier joueur qui l'ouvre le tire) ni clore la semaine
 * passée (la première demande de la semaine le fait).
 */
export interface DefiAuQg {
  semaine: string
  /** Quelqu'un l'a ouvert cette semaine : il est tiré, et figé. */
  tire: boolean
  minutesRestantes: number
  /** Ceux qui ont répondu à une question au moins — comme son classement : ni les masqués ni les suspendus. */
  joueurs: number
  finies: number
  /** Les tentatives finies, par bonnes réponses : `scores[k]` en ont trouvé k. */
  scores: number[]
  /** Le meilleur score de la semaine, en route ou fini, et qui le tient ; ceux qui l'égalent, à part. */
  meilleur: ({ justes: number; nom: string; avatar: string; quand: number | null; exAequo: number } & ApparenceDeLAvatar) | null
  /** Les questions les plus ratées, sur assez de réponses (`REPONSES_POUR_JUGER`). */
  ratees: QuestionDuDefiAuQg[]
  /** La semaine d'avant : ses joueurs, et ses vainqueurs — null tant qu'elle n'est pas close. Null : pas de défi. */
  passee: { semaine: string; joueurs: number; vainqueurs: number | null } | null
}

/** Un parcours de thème sur trente jours : qui l'a commencé, ses étapes validées, qui l'a fini. */
export interface LigneDeParcoursAuQg {
  sujet: string
  nom: string
  /** Ceux qui y ont joué une étape au moins. */
  joueurs: number
  /** Les étapes validées, une fois par joueur : une étape rejouée pour ses étoiles ne compte pas deux fois. */
  etapes: number
  /** Ceux qui en ont validé la dernière étape. */
  finis: number
}

export interface ParcoursAuQg {
  /** Les plus suivis, les plus joueurs d'abord (`PARCOURS_AU_QG`). */
  lignes: LigneDeParcoursAuQg[]
  /** Les parcours commencés : un par joueur et par thème. */
  commences: number
  /** Les thèmes ouverts au moins une fois. */
  sujets: number
}

/** Les vies des sentiers, jour par jour sur trente jours. */
export interface ViesAuQg {
  achetees: number[]
  /** Les vies perdues, et celles qui l'ont été au-delà des douze du jour : prises dans la réserve achetée. */
  perdues: number[]
  auDela: number[]
  /** Ce que les vies achetées ont coûté, en confettis. */
  confettis: number
}

export interface SuiviDeLaCampagne {
  maintenant: number
  /** Les trente jours des vies, le plus ancien d'abord, aujourd'hui en dernier. */
  jours: string[]
  /** Les paliers validés aujourd'hui, hors rejeu, et ceux du premier coup. */
  paliers: { valides: number; premierCoup: number }
  defi: DefiAuQg
  parcours: ParcoursAuQg
  vies: ViesAuQg
}

/** La médiane des tentatives d'après leur répartition : la moyenne des deux du milieu quand elles sont en nombre pair. */
export function medianeDesScores(scores: readonly number[]): number | null {
  const total = scores.reduce((n, x) => n + x, 0)
  if (total === 0) return null
  const rang = (k: number) => {
    let vus = 0
    for (let s = 0; s < scores.length; s++) {
      vus += scores[s]
      if (vus > k) return s
    }
    return scores.length - 1
  }
  return (rang(Math.floor((total - 1) / 2)) + rang(Math.floor(total / 2))) / 2
}

/** Les questions les plus ratées, sur assez de réponses ; à part égale, la première posée. */
export function lesPlusRatees(questions: readonly QuestionDuDefiAuQg[], n = QUESTIONS_RATEES_MONTREES): QuestionDuDefiAuQg[] {
  return questions
    .filter(q => q.reponses >= REPONSES_POUR_JUGER)
    .sort((a, b) => a.justes / a.reponses - b.justes / b.reponses || a.index - b.index)
    .slice(0, n)
}

/**
 * Les vies perdues jour par jour, et celles perdues au-delà des douze du
 * jour : chaque joueur a les siennes, rendues à minuit — trois cents vies
 * perdues par vingt-cinq joueurs n'en prennent aucune à la réserve, trente
 * par un seul en prennent dix-huit. `echecs` : une épreuve ratée par ligne,
 * datée de sa fin (`lectureDesEchecs`).
 */
export function viesPerduesParJour(
  echecs: readonly { qui: string; quand: number }[],
  minuits: readonly number[],
  maintenant: number,
): { perdues: number[]; auDela: number[] } {
  const parJour = minuits.map(() => new Map<string, number>())
  for (const e of echecs) {
    if (e.quand > maintenant) continue
    const i = jourDeLInstant(minuits, e.quand)
    if (i >= 0) parJour[i].set(e.qui, (parJour[i].get(e.qui) ?? 0) + 1)
  }
  return {
    perdues: parJour.map(m => [...m.values()].reduce((n, x) => n + x, 0)),
    auDela: parJour.map(m => [...m.values()].reduce((n, x) => n + Math.max(0, x - VIES_PAR_JOUR), 0)),
  }
}

/** Ce que coûtent les vies achetées, jour par jour : le nombre, et le prix payé — un prix changé ne refait payer personne. */
export function viesAcheteesParJour(
  achats: readonly { quand: number; nombre: number; prix: number }[],
  minuits: readonly number[],
  maintenant: number,
): { achetees: number[]; confettis: number } {
  const achetees = minuits.map(() => 0)
  let confettis = 0
  for (const a of achats) {
    if (a.quand > maintenant) continue
    const i = jourDeLInstant(minuits, a.quand)
    if (i < 0) continue
    achetees[i] += a.nombre
    confettis += a.prix
  }
  return { achetees, confettis }
}
