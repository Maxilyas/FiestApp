// L'activité au QG (`/admin#activite`, le souhait du propriétaire du
// 17 octobre 2026 : « voir la quantité de ce que font les joueurs, nombre de
// duels / questions sur les différents modes et pas forcément uniquement la
// participation par joueur […] sur quoi une personne s'acharne ou pas ») :
// les questions jouées et les parties, mode par mode et jour par jour, et ce
// que chaque profil a joué. La participation de la vue d'ensemble compte des
// personnes ; celle-ci compte ce qu'elles ont fait.
//
// Une question jouée est partout la même chose : une question posée à un
// joueur, qu'il y ait répondu ou l'ait laissée au temps — en soirée, une
// ligne du journal des réponses par invité et par question (`jouees`, la
// fiche de la soirée) ; au quiz du jour, celles de sa partie
// (`jour_parties.question`) ; en campagne et en duel, celles de sa série
// (`campagne_series.position`). Une partie : un quiz de soirée, une partie du
// jour, une série de campagne, un duel — chaque côté d'un duel classé compte
// le sien, comme les « Duels joués » de la vue d'ensemble. Une partie se date
// à son début : celle qui court sur deux jours compte au premier.
//
// Des dérivations pures : le serveur les calcule sur les journaux que la vue
// d'ensemble garde déjà (`lesTrenteJours`, `server/src/qg.ts`), les tests les
// jouent l'horloge à la main.

import { MODES_DU_QG, jourDeLInstant, joursDesMinuits, type ModeDuQg } from './qg'

/** Un chiffre par mode. */
export type ParMode = Record<ModeDuQg, number>

export const parModeVide = (): ParMode => ({ soiree: 0, campagne: 0, jour: 0, duel: 0 })

/** Tous les modes ensemble. */
export const totalDesModes = (p: ParMode) => MODES_DU_QG.reduce((n, m) => n + p[m], 0)

/**
 * Les joueurs que la page montre, au plus, dans chaque vue — tous les modes,
 * puis chacun : le serveur envoie les premiers de chacune, et chaque vue dit
 * juste ses cinquante premiers.
 */
export const JOUEURS_DE_L_ACTIVITE = 50

/** Un jour : les questions jouées et les parties, mode par mode. */
export interface ActiviteDuJour {
  jour: string
  questions: ParMode
  parties: ParMode
}

/** Ce qu'un profil a joué sur la période, mode par mode. */
export interface ActiviteDUnJoueur {
  questions: ParMode
  parties: ParMode
  /** Les jours où il a joué, tous modes confondus. */
  jours: number
}

/** Une ligne de « Qui joue à quoi » : de quoi le reconnaître et ouvrir sa fiche, et ce qu'il a joué. */
export interface JoueurDeLActivite extends ActiviteDUnJoueur {
  id: string
  nom: string
  login: string
  suspendu: boolean
}

export interface PageDeLActivite {
  maintenant: number
  /** Les trente jours, le plus ancien d'abord, aujourd'hui en dernier. */
  parJour: ActiviteDuJour[]
  /**
   * Les trente jours en tout, mode par mode : les questions, les parties, et
   * les joueurs — des profils distincts seuls ; en soirée, chaque invité qui
   * a joué, avec ou sans profil, une fois par soirée, comme la participation.
   */
  totaux: { questions: ParMode; parties: ParMode; joueurs: ParMode; soirees: number }
  /** Les profils qui ont joué : les premiers de tous les modes, puis de chacun (`JOUEURS_DE_L_ACTIVITE`). */
  joueurs: JoueurDeLActivite[]
  /** Tous les profils qui ont joué sur la période : la liste en montre moins quand ils sont nombreux. */
  profilsActifs: number
}

// ── Ce que les journaux en disent ────────────────────────────────────────

/** Une partie jouée seul — du jour, de campagne, de duel — : qui, quand, combien de questions. */
export interface PartieSeule {
  qui: string
  quand: number
  mode: Exclude<ModeDuQg, 'soiree'>
  questions: number
}

/** Une soirée : quand elle a commencé, ses quiz, ses invités qui ont joué et les questions qu'ils ont jouées. */
export interface SoireeJouee {
  quand: number
  quiz: number
  joueurs: number
  jouees: number
}

/** La soirée d'un profil, lue dans sa ligne d'expérience : quand, les quiz qu'il y a joués, les questions qu'on lui a posées. */
export interface SoireeDUnProfil {
  qui: string
  quand: number
  quiz: number
  questions: number
}

/** L'indice du jour d'un instant, -1 hors de la période ou après maintenant. */
const indiceDuJour = (minuits: readonly number[], quand: number, maintenant: number) => (quand <= maintenant ? jourDeLInstant(minuits, quand) : -1)

/** Les questions jouées et les parties de chaque jour, mode par mode. */
export function activiteParJour(
  seules: readonly PartieSeule[],
  soirees: readonly SoireeJouee[],
  minuits: readonly number[],
  maintenant: number,
): ActiviteDuJour[] {
  const jours = joursDesMinuits(minuits).map(jour => ({ jour, questions: parModeVide(), parties: parModeVide() }))
  for (const p of seules) {
    const i = indiceDuJour(minuits, p.quand, maintenant)
    if (i < 0) continue
    jours[i].questions[p.mode] += p.questions
    jours[i].parties[p.mode]++
  }
  for (const s of soirees) {
    const i = indiceDuJour(minuits, s.quand, maintenant)
    if (i < 0) continue
    jours[i].questions.soiree += s.jouees
    jours[i].parties.soiree += s.quiz
  }
  return jours
}

/** La période en tout : les questions, les parties, les joueurs de chaque mode, et les soirées. */
export function totauxDeLActivite(
  seules: readonly PartieSeule[],
  soirees: readonly SoireeJouee[],
  minuits: readonly number[],
  maintenant: number,
): PageDeLActivite['totaux'] {
  const questions = parModeVide()
  const parties = parModeVide()
  const joueurs = parModeVide()
  const personnes = { campagne: new Set<string>(), jour: new Set<string>(), duel: new Set<string>() }
  let n = 0
  for (const p of seules) {
    if (indiceDuJour(minuits, p.quand, maintenant) < 0) continue
    questions[p.mode] += p.questions
    parties[p.mode]++
    personnes[p.mode].add(p.qui)
  }
  for (const s of soirees) {
    if (indiceDuJour(minuits, s.quand, maintenant) < 0) continue
    questions.soiree += s.jouees
    parties.soiree += s.quiz
    joueurs.soiree += s.joueurs
    n++
  }
  for (const m of ['campagne', 'jour', 'duel'] as const) joueurs[m] = personnes[m].size
  return { questions, parties, joueurs, soirees: n }
}

/**
 * Ce que chaque profil a joué sur la période, le plus assidu d'abord : le
 * plus de questions, puis de parties, puis de jours. Ses soirées se lisent
 * dans ses lignes d'expérience — un invité sans profil n'y est pas, il ne
 * compte qu'au volume des soirées.
 */
export function activiteDesJoueurs(
  seules: readonly PartieSeule[],
  soirees: readonly SoireeDUnProfil[],
  minuits: readonly number[],
  maintenant: number,
): ({ qui: string } & ActiviteDUnJoueur)[] {
  const parQui = new Map<string, { questions: ParMode; parties: ParMode; jours: Set<number> }>()
  const sien = (qui: string) => {
    let a = parQui.get(qui)
    if (!a) parQui.set(qui, (a = { questions: parModeVide(), parties: parModeVide(), jours: new Set() }))
    return a
  }
  for (const p of seules) {
    const i = indiceDuJour(minuits, p.quand, maintenant)
    if (i < 0) continue
    const a = sien(p.qui)
    a.questions[p.mode] += p.questions
    a.parties[p.mode]++
    a.jours.add(i)
  }
  for (const s of soirees) {
    const i = indiceDuJour(minuits, s.quand, maintenant)
    if (i < 0) continue
    const a = sien(s.qui)
    a.questions.soiree += s.questions
    a.parties.soiree += s.quiz
    a.jours.add(i)
  }
  return [...parQui]
    .map(([qui, a]) => ({ qui, questions: a.questions, parties: a.parties, jours: a.jours.size }))
    .sort(
      (a, b) =>
        totalDesModes(b.questions) - totalDesModes(a.questions) ||
        totalDesModes(b.parties) - totalDesModes(a.parties) ||
        b.jours - a.jours ||
        (a.qui < b.qui ? -1 : a.qui > b.qui ? 1 : 0),
    )
}

/**
 * Ceux que la page montre : les premiers de tous les modes, puis les premiers
 * de chaque mode — un joueur qui ne fait que des duels n'est pas parmi les
 * cinquante plus assidus, mais il est des cinquante premiers aux duels. Dans
 * l'ordre de `activiteDesJoueurs`, chacun une fois.
 */
export function joueursAMontrer<T extends ActiviteDUnJoueur>(classes: readonly T[], n = JOUEURS_DE_L_ACTIVITE): T[] {
  const retenus = new Set<T>(classes.slice(0, n))
  for (const m of MODES_DU_QG) {
    const duMode = classes.filter(a => a.questions[m] > 0 || a.parties[m] > 0).sort((a, b) => b.questions[m] - a.questions[m] || b.parties[m] - a.parties[m])
    for (const a of duMode.slice(0, n)) retenus.add(a)
  }
  return classes.filter(a => retenus.has(a))
}

/** Le mode où il joue le plus, et sa part de ses questions, en pour cent ; null s'il n'a rien joué. */
export function modePrefere(a: Pick<ActiviteDUnJoueur, 'questions'>): { mode: ModeDuQg; part: number } | null {
  const total = totalDesModes(a.questions)
  if (total === 0) return null
  const mode = MODES_DU_QG.reduce((meilleur, m) => (a.questions[m] > a.questions[meilleur] ? m : meilleur), MODES_DU_QG[0])
  return { mode, part: Math.round((a.questions[mode] / total) * 100) }
}
