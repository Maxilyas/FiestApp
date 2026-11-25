// Les périodes du QG 2 (la proposition du 3 novembre 2026,
// `retours/2026-11-03/le-qg.md`, que le propriétaire a fait sienne le 4 :
// « suis tes recommandations ») : une barre règle le temps de toute la page —
// la dernière heure, les dernières 24 heures, les sept derniers jours, les
// trente derniers — au lieu des trente jours figés de la vue d'ensemble.
// Chaque période a son pas, sa participation seau par seau, ses totaux, et la
// période d'avant arrêtée au même instant, pour l'écart d'une tuile et le
// filet du graphique.
//
// Des dérivations pures, sur les journaux que la vue d'ensemble garde déjà
// (`lesTrenteJours`, `server/src/qg.ts`) : aucune lecture de plus. Trente
// jours gardés ne disent pas les trente d'avant : la période « 30 j » n'a pas
// de période d'avant (`avant: null`).
//
// Et tout l'historique, au poste de commande seulement (le souhait du
// propriétaire du 24 novembre 2026 : « j'aimerais avoir une vue totale et pas
// uniquement sur 30 jours dans le QG ») : les trente derniers jours des mêmes
// journaux, et chaque jour d'avant tel que la mémoire du QG l'a figé
// (`qg_jours`, `qg_presences` — `activiteDeLHistorique`). Rien ne se relit des
// journaux au-delà des trente jours : la mémoire se lit une fois par jour,
// quelques centaines de lignes par an.

import { formatNumber } from './typographie'
import { jourAvant, jourDe } from './jour'
import {
  HABITUDE_EN_POURCENTS,
  MODES_DU_QG,
  ecartEnPourcents,
  jourDeLInstant,
  joursDesMinuits,
  minuitDe,
  participationsParSeau,
  type EcartALHabitude,
  type ModeDuQg,
  type PartieDesParticipations,
  type SeauDeParticipations,
  type SoireeDesParticipations,
} from './qg'
import { BIT_DU_MODE, lundiDe, minuitDuJour, type ChiffresDUnJour, type Presence } from './qgJoueurs'

/** Les périodes que les trente jours de journaux disent : celles de toutes les pages qui suivent la barre. */
export const PERIODES_DU_QG = ['1h', '24h', '7j', '30j'] as const
export type PeriodeDuQg = (typeof PERIODES_DU_QG)[number]

/**
 * Les périodes du poste de commande : les mêmes, et tout l'historique, que
 * seule la mémoire du QG sait au-delà des trente jours — les modes côte à côte
 * aussi, depuis que la mémoire garde la réussite et les durées de chaque jour
 * (la mémoire v3, le 25 novembre 2026, `modesSurTout`). Les pages d'un mode
 * s'arrêtent à trente : leur entonnoir et leur période d'avant se tirent des
 * journaux, que la mémoire ne garde pas partie par partie — la période retenue
 * s'y lit à sa plus longue (`periodeDeLaPage`, `AdminApp.tsx`).
 */
export const PERIODES_DU_POSTE = [...PERIODES_DU_QG, 'tout'] as const
export type PeriodeDuPoste = (typeof PERIODES_DU_POSTE)[number]

/** À l'ouverture, la journée ; puis la dernière choisie, que le navigateur retient. */
export const PERIODE_PAR_DEFAUT: PeriodeDuQg = '24h'

export const NOM_DE_LA_PERIODE: Record<PeriodeDuPoste, string> = { '1h': '1 h', '24h': '24 h', '7j': '7 j', '30j': '30 j', tout: 'Tout' }

/** Ce que la période regarde, en toutes lettres : le titre d'un graphique, l'écart d'une tuile — après « sur ». */
export const PERIODE_EN_TOUTES_LETTRES: Record<PeriodeDuPoste, string> = {
  '1h': 'la dernière heure',
  '24h': 'les dernières 24 heures',
  '7j': 'les sept derniers jours',
  '30j': 'les trente derniers jours',
  tout: 'tout l’historique',
}

const MINUTE = 60_000
const HEURE = 60 * MINUTE
const JOUR = 24 * HEURE

/**
 * Les seaux de tout l'historique, au plus : un jour chacun tant qu'il en
 * tient soixante, puis une semaine, puis un mois — cinquante-six barres
 * tiennent au téléphone (la semaine en seaux de trois heures), cent
 * soixante-huit n'y faisaient que des fils.
 */
export const SEAUX_DE_L_HISTORIQUE = 60

/** La largeur d'un seau de l'historique, quand il passe à la semaine, puis au mois — trente jours, pour dire son nom : un mois en a vingt-huit à trente et un. */
export const PAS_D_UNE_SEMAINE = 7 * JOUR
export const PAS_D_UN_MOIS = 30 * JOUR

/**
 * La largeur d'un seau : cinq minutes sur une heure, une heure sur un jour,
 * trois heures sur une semaine — cinquante-six barres, quand cent
 * soixante-huit n'en faisaient que des fils au téléphone —, un jour de Paris
 * sur trente.
 */
export const PAS_DE_LA_PERIODE: Record<PeriodeDuQg, number> = { '1h': 5 * MINUTE, '24h': HEURE, '7j': 3 * HEURE, '30j': 24 * HEURE }

/**
 * Le pas d'un graphique en mots : son titre (« Heure par heure ») et ce qu'il
 * compte (« une fois par heure »). « Seau par seau » ne se lisait que de qui
 * l'avait écrit (la revue d'ergonomie du 4 novembre 2026) ; le pas, lui, est
 * connu.
 */
export const PAS_EN_MOTS: Record<PeriodeDuQg, { titre: string; par: string }> = {
  '1h': { titre: 'Cinq minutes par cinq minutes', par: 'par tranche de cinq minutes' },
  '24h': { titre: 'Heure par heure', par: 'par heure' },
  '7j': { titre: 'Trois heures par trois heures', par: 'par tranche de trois heures' },
  '30j': { titre: 'Jour par jour', par: 'par jour' },
}

/** Le pas d'une période en mots : celui de tout l'historique dépend de sa longueur — le jour, la semaine, le mois. */
export function pasEnMots(periode: PeriodeDuPoste, pas: number): { titre: string; par: string } {
  if (periode !== 'tout') return PAS_EN_MOTS[periode]
  if (pas >= PAS_D_UN_MOIS) return { titre: 'Mois par mois', par: 'par mois' }
  if (pas >= PAS_D_UNE_SEMAINE) return { titre: 'Semaine par semaine', par: 'par semaine' }
  return PAS_EN_MOTS['30j']
}

/** Les seaux d'une semaine : trois heures, comptées depuis chaque minuit de Paris. */
const HEURES_D_UN_SEAU_DE_LA_SEMAINE = 3

/** Ce qu'une période compte en tout. Les joueurs se comptent une fois sur toute la période, pas seau par seau. */
export interface TotauxDUnePeriode {
  /** Les personnes : un profil une fois, quoi qu'il ait joué ; un invité sans profil une fois par soirée. */
  joueurs: number
  /** Les joueurs de chaque mode — qui joue à deux modes compte dans les deux. */
  modes: Record<ModeDuQg, number>
  /** Les participations de chaque mode, qui que ce soit. */
  parties: Record<ModeDuQg, number>
  /**
   * Les parties jouées seul commencées sur la période et finies avant sa fin,
   * mode par mode : l'entonnoir d'une page de mode, d'une partie commencée à sa
   * fin (`entonnoirDuSolo`, `shared/qgModes.ts`) — la période d'avant arrêtée au
   * même instant, comme le reste. En soirée, zéro : une soirée se clôt, ses quiz
   * ne se finissent pas ici. Absent d'un serveur d'avant le QG 2, lot 5.
   */
  finies?: Record<ModeDuQg, number>
  nouveauxProfils: number
  achats: number
}

export interface ActiviteDUnePeriode {
  periode: PeriodeDuPoste
  /**
   * La largeur d'un seau, en millisecondes — un jour de Paris en a vingt-trois
   * ou vingt-cinq deux fois l'an ; un seau de tout l'historique, un jour, une
   * semaine ou un mois (`PAS_D_UNE_SEMAINE`, `PAS_D_UN_MOIS`).
   */
  pas: number
  /** La participation seau par seau ; le dernier finit maintenant. */
  seaux: SeauDeParticipations[]
  totaux: TotauxDUnePeriode
  /**
   * La période d'avant, de même longueur et arrêtée au même instant — hier
   * à la même heure, la semaine d'avant au même jour — : un soir à 21 h ne se
   * lit pas en baisse contre une journée entière. Null sur trente jours : les
   * journaux gardés ne disent pas le mois d'avant ; et sur tout l'historique,
   * qui n'a pas d'avant.
   */
  avant: { seaux: SeauDeParticipations[]; totaux: TotauxDUnePeriode } | null
  /**
   * Tout l'historique : le minuit de son premier jour qui a vu quelque chose —
   * son premier seau d'une semaine ou d'un mois commence avant lui. Absent des
   * autres périodes.
   */
  depuis?: number
}

/** Ce qui se compte d'une période sans dire qui : une inscription, un achat — leurs heures. */
export interface FaitsDeLaPeriode {
  inscriptions: readonly number[]
  achats: readonly number[]
}

/** Les débuts des seaux de trois heures de quelques jours de Paris, jusqu'à une fin. */
function seauxDeTroisHeures(minuits: readonly number[], fin: number): number[] {
  const debuts: number[] = []
  minuits.forEach((m, i) => {
    // Le minuit suivant borne le jour : celui d'après, ou demain pour aujourd'hui (un jour en a vingt-trois à vingt-cinq).
    const suivant = minuits[i + 1] ?? minuitDe(m + 26 * HEURE)
    for (let d = m; d < suivant && d <= fin; d += HEURES_D_UN_SEAU_DE_LA_SEMAINE * HEURE) debuts.push(d)
  })
  return debuts
}

/** Les débuts de `n` seaux de largeur `pas`, le dernier contenant `fin`. */
function seauxReguliers(fin: number, pas: number, n: number): number[] {
  const dernier = Math.floor(fin / pas) * pas
  return Array.from({ length: n }, (_, i) => dernier - (n - 1 - i) * pas)
}

/**
 * Les seaux d'une période qui finit maintenant, et ceux de la période d'avant
 * avec l'instant qui l'arrête. `minuits` vient de `minuitsDeParis`, aujourd'hui
 * en dernier : trente jours gardés, quatorze au moins pour une semaine et la
 * précédente.
 */
export function cadreDeLaPeriode(
  periode: PeriodeDuQg,
  minuits: readonly number[],
  maintenant: number,
): { debuts: number[]; avant: { debuts: number[]; fin: number } | null } {
  const n = minuits.length
  switch (periode) {
    case '1h':
    case '24h': {
      const pas = PAS_DE_LA_PERIODE[periode]
      const nombre = periode === '1h' ? 12 : 24
      const duree = nombre * pas
      return { debuts: seauxReguliers(maintenant, pas, nombre), avant: { debuts: seauxReguliers(maintenant - duree, pas, nombre), fin: maintenant - duree } }
    }
    case '7j': {
      const jours = minuits.slice(-7)
      const avant = minuits.slice(-14, -7)
      // Le même instant de la semaine d'avant : l'écart de deux minuits de Paris, heure d'été comprise.
      const fin = avant.length === 7 ? maintenant - (minuits[n - 1] - minuits[n - 8]) : null
      return { debuts: seauxDeTroisHeures(jours, maintenant), avant: fin === null ? null : { debuts: seauxDeTroisHeures(avant, fin), fin } }
    }
    case '30j':
      return { debuts: [...minuits.slice(-30)], avant: null }
  }
}

/** Les totaux d'une période, de son début à sa fin, bornes comprises. */
export function totauxEntre(
  solo: readonly PartieDesParticipations[],
  soirees: readonly SoireeDesParticipations[],
  faits: FaitsDeLaPeriode,
  debut: number,
  fin: number,
): TotauxDUnePeriode {
  const [tout] = participationsParSeau(solo, soirees, [debut], fin)
  const dans = (quand: number) => quand >= debut && quand <= fin
  // Finie avant la fin de la période : celle d'avant, arrêtée au même instant, n'a pas eu plus de temps que celle-ci.
  const finies = Object.fromEntries(MODES_DU_QG.map(m => [m, 0])) as Record<ModeDuQg, number>
  for (const p of solo) if (p.fin != null && dans(p.quand) && p.fin <= fin) finies[p.mode]++
  return {
    joueurs: tout.joueurs,
    modes: tout.modes,
    parties: tout.parties,
    finies,
    nouveauxProfils: faits.inscriptions.filter(dans).length,
    achats: faits.achats.filter(dans).length,
  }
}

/** Une période entière : ses seaux, ses totaux, et la période d'avant quand les journaux la disent. */
export function activiteDeLaPeriode(
  periode: PeriodeDuQg,
  solo: readonly PartieDesParticipations[],
  soirees: readonly SoireeDesParticipations[],
  faits: FaitsDeLaPeriode,
  minuits: readonly number[],
  maintenant: number,
): ActiviteDUnePeriode {
  const { debuts, avant } = cadreDeLaPeriode(periode, minuits, maintenant)
  return {
    periode,
    pas: PAS_DE_LA_PERIODE[periode],
    seaux: participationsParSeau(solo, soirees, debuts, maintenant),
    totaux: totauxEntre(solo, soirees, faits, debuts[0], maintenant),
    avant: avant && {
      seaux: participationsParSeau(solo, soirees, avant.debuts, avant.fin),
      totaux: totauxEntre(solo, soirees, faits, avant.debuts[0], avant.fin),
    },
  }
}

// ── Tout l'historique ─────────────────────────────────────────────────────

/**
 * Un jour de tout l'historique : ce qu'il compte, comme `participationsParSeau`
 * le compte sur un jour, et ses profils, chacun ses modes — de quoi compter une
 * personne une fois sur plusieurs jours. Un jour de plus de trente jours vient
 * de la mémoire du QG (ses chiffres, `ChiffresDUnJour`, et sa feuille de
 * présence), chacun des trente derniers des journaux (`joursDesJournaux`).
 */
export interface JourDeLHistorique {
  jour: string
  joueurs: number
  modes: Record<ModeDuQg, number>
  parties: Record<ModeDuQg, number>
  nouveauxProfils: number
  achats: number
  /** Ses profils, et les modes de chacun en bits (`BIT_DU_MODE`, comme la feuille de présence). */
  profils: ReadonlyMap<string, number>
}

const zeros = () => Object.fromEntries(MODES_DU_QG.map(m => [m, 0])) as Record<ModeDuQg, number>

/** Les jours que des minuits de Paris bornent — trente, d'ordinaire —, tels que tout l'historique les lit, aujourd'hui jusqu'à maintenant. */
export function joursDesJournaux(
  solo: readonly PartieDesParticipations[],
  soirees: readonly SoireeDesParticipations[],
  faits: FaitsDeLaPeriode,
  minuits: readonly number[],
  maintenant: number,
): JourDeLHistorique[] {
  const jours = joursDesMinuits(minuits)
  const profils = minuits.map(() => new Map<string, number>())
  const nouveaux = minuits.map(() => 0)
  const achats = minuits.map(() => 0)
  const indice = (quand: number) => (quand <= maintenant ? jourDeLInstant(minuits, quand) : -1)
  const noter = (quand: number, qui: string, mode: ModeDuQg) => {
    const du = profils[indice(quand)]
    if (du) du.set(qui, (du.get(qui) ?? 0) | BIT_DU_MODE[mode])
  }
  for (const p of solo) noter(p.quand, p.qui, p.mode)
  for (const s of soirees) for (const qui of s.profils ?? []) noter(s.quand, qui, 'soiree')
  for (const quand of faits.inscriptions) if (indice(quand) >= 0) nouveaux[indice(quand)]++
  for (const quand of faits.achats) if (indice(quand) >= 0) achats[indice(quand)]++
  return participationsParSeau(solo, soirees, minuits, maintenant).map((s, i) => ({
    jour: jours[i],
    joueurs: s.joueurs,
    modes: s.modes,
    parties: s.parties,
    nouveauxProfils: nouveaux[i],
    achats: achats[i],
    profils: profils[i],
  }))
}

/**
 * Les jours que la mémoire du QG a figés, tels que tout l'historique les lit :
 * leurs chiffres (`ChiffresDUnJour`), et les profils de leur feuille de
 * présence. Une ligne d'avant un mode — le Cabinet, venu le 2 novembre 2026 —
 * le compte zéro ; un profil supprimé a emporté sa feuille, ses chiffres le
 * comptent encore (`amasser`).
 */
export function historiqueDeLaMemoire(jours: ReadonlyMap<string, ChiffresDUnJour>, presences: readonly Presence[]): JourDeLHistorique[] {
  const profils = new Map<string, Map<string, number>>()
  for (const p of presences) {
    let du = profils.get(p.jour)
    if (!du) profils.set(p.jour, (du = new Map()))
    du.set(p.qui, (du.get(p.qui) ?? 0) | p.modes)
  }
  const nombre = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0)
  const parMode = (r: unknown) => Object.fromEntries(MODES_DU_QG.map(m => [m, nombre((r as Partial<Record<ModeDuQg, unknown>> | undefined)?.[m])])) as Record<ModeDuQg, number>
  return [...jours].map(([jour, c]) => ({
    jour,
    joueurs: nombre(c.joueurs),
    modes: parMode(c.modes),
    parties: parMode(c.parties),
    nouveauxProfils: nombre(c.nouveauxProfils),
    achats: nombre(c.achats),
    profils: profils.get(jour) ?? new Map(),
  }))
}

/** Les jours qui séparent deux jours de Paris : comptés au calendrier, jamais en heures. */
function joursEntre(de: string, a: string): number {
  const utc = (jour: string) => {
    const [an, mois, j] = jour.split('-').map(Number)
    return Date.UTC(an, mois - 1, j)
  }
  return Math.round((utc(a) - utc(de)) / JOUR)
}

/** Le mois qui suit, « 2026-12 » → « 2027-01 ». */
function moisSuivant(mois: string): string {
  const [an, m] = mois.split('-').map(Number)
  return m === 12 ? `${an + 1}-01` : `${an}-${String(m + 1).padStart(2, '0')}`
}

/**
 * Les seaux de tout l'historique, du premier jour qui a vu quelque chose à
 * aujourd'hui : le premier jour de chacun, et leur pas. Un jour chacun tant
 * qu'il en tient `SEAUX_DE_L_HISTORIQUE`, puis une semaine de Paris — du lundi
 * au dimanche, la première commencée avant lui —, puis un mois du calendrier.
 */
export function seauxDeLHistorique(premier: string, aujourdhui: string): { debuts: string[]; pas: number } {
  const jours = joursEntre(premier, aujourdhui) + 1
  if (jours <= SEAUX_DE_L_HISTORIQUE) return { debuts: Array.from({ length: Math.max(1, jours) }, (_, i) => jourAvant(premier, -i)), pas: JOUR }
  const lundi = lundiDe(premier)
  const semaines = Math.floor(joursEntre(lundi, aujourdhui) / 7) + 1
  if (semaines <= SEAUX_DE_L_HISTORIQUE) return { debuts: Array.from({ length: semaines }, (_, i) => jourAvant(lundi, -7 * i)), pas: PAS_D_UNE_SEMAINE }
  const debuts: string[] = []
  for (let mois = premier.slice(0, 7); mois <= aujourdhui.slice(0, 7); mois = moisSuivant(mois)) debuts.push(`${mois}-01`)
  return { debuts, pas: PAS_D_UN_MOIS }
}

/** Ce qu'un seau de l'historique amasse jour après jour : ses profils une fois chacun, et ce qui ne se nomme pas, additionné. */
interface Amas {
  profils: Map<string, number>
  /** Les personnes sans profil de chaque jour — un invité, une fois par soirée —, et celles de chaque mode. */
  anonymes: number
  anonymesDuMode: Record<ModeDuQg, number>
  parties: Record<ModeDuQg, number>
  nouveauxProfils: number
  achats: number
}

const amasVide = (): Amas => ({ profils: new Map(), anonymes: 0, anonymesDuMode: zeros(), parties: zeros(), nouveauxProfils: 0, achats: 0 })

function amasser(a: Amas, j: JourDeLHistorique) {
  const profilsDuMode = zeros()
  for (const [qui, masque] of j.profils) {
    a.profils.set(qui, (a.profils.get(qui) ?? 0) | masque)
    for (const m of MODES_DU_QG) if (masque & BIT_DU_MODE[m]) profilsDuMode[m]++
  }
  // Ce que le jour compte au-delà de ses profils nommés : ses invités sans profil — et un profil supprimé depuis, que
  // sa feuille de présence a oublié et que ses chiffres comptent encore. Une personne par jour, faute de mieux.
  a.anonymes += Math.max(0, j.joueurs - j.profils.size)
  for (const m of MODES_DU_QG) {
    a.anonymesDuMode[m] += Math.max(0, j.modes[m] - profilsDuMode[m])
    a.parties[m] += j.parties[m]
  }
  a.nouveauxProfils += j.nouveauxProfils
  a.achats += j.achats
}

function lireLAmas(a: Amas): Pick<SeauDeParticipations, 'joueurs' | 'modes' | 'parties'> {
  const modes = { ...a.anonymesDuMode }
  for (const masque of a.profils.values()) for (const m of MODES_DU_QG) if (masque & BIT_DU_MODE[m]) modes[m]++
  return { joueurs: a.profils.size + a.anonymes, modes, parties: a.parties }
}

/**
 * Les personnes de jours de l'historique, ensemble — un profil une fois, un
 * invité sans profil une fois par soirée : la règle de tout l'historique, que
 * les modes côte à côte lisent pour leurs joueurs (`modesSurTout`).
 */
export function joueursDeLHistorique(jours: readonly JourDeLHistorique[]): Pick<SeauDeParticipations, 'joueurs' | 'modes' | 'parties'> {
  const tout = amasVide()
  for (const j of jours) amasser(tout, j)
  return lireLAmas(tout)
}

const aVuQuelqueChose = (j: JourDeLHistorique) => j.joueurs > 0 || j.nouveauxProfils > 0 || j.achats > 0 || MODES_DU_QG.some(m => j.parties[m] > 0)

/**
 * Tout l'historique, du premier jour qui a vu quelque chose jusqu'à
 * maintenant : ses seaux (`seauxDeLHistorique`) et ses totaux. Un profil y
 * compte une fois, sur un seau comme sur tout l'historique, un invité sans
 * profil une fois par soirée — la règle de chaque période. Pas de période
 * d'avant : il n'y en a pas. Pas de parties finies non plus : la mémoire ne
 * garde pas les parties une à une, et l'entonnoir d'un mode s'arrête à trente
 * jours.
 */
export function activiteDeLHistorique(jours: readonly JourDeLHistorique[], maintenant: number): ActiviteDUnePeriode {
  const aujourdhui = jourDe(maintenant)
  const tries = jours.filter(j => j.jour <= aujourdhui).sort((a, b) => (a.jour < b.jour ? -1 : a.jour > b.jour ? 1 : 0))
  const premier = tries.find(aVuQuelqueChose)?.jour ?? aujourdhui
  const { debuts, pas } = seauxDeLHistorique(premier, aujourdhui)
  const amas = debuts.map(amasVide)
  const tout = amasVide()
  let k = 0
  for (const j of tries) {
    if (j.jour < premier) continue
    while (k + 1 < debuts.length && debuts[k + 1] <= j.jour) k++
    amasser(amas[k], j)
    amasser(tout, j)
  }
  const lu = lireLAmas(tout)
  return {
    periode: 'tout',
    pas,
    seaux: debuts.map((d, i) => ({ debut: minuitDuJour(d), ...lireLAmas(amas[i]) })),
    totaux: { ...lu, nouveauxProfils: tout.nouveauxProfils, achats: tout.achats },
    avant: null,
    depuis: minuitDuJour(premier),
  }
}

/**
 * Un chiffre comparé à la période d'avant, à la règle des tuiles d'aujourd'hui
 * (`ecartALHabitude`) : sous vingt avant, le chiffre d'avant plutôt qu'un
 * pourcentage — trois contre deux ne font pas « 50 % de plus ». Rien sans
 * période d'avant.
 */
export function ecartALaPeriodeDAvant(maintenant: number, avant: number | null | undefined): EcartALHabitude | null {
  if (avant === null || avant === undefined) return null
  const pareil = { sens: null, texte: 'comme avant', suite: '' }
  if (avant < HABITUDE_EN_POURCENTS) return maintenant === avant ? pareil : { sens: null, texte: `${formatNumber(avant)} avant`, suite: '' }
  const pourcents = Math.round(((maintenant - avant) / avant) * 100)
  if (pourcents === 0) return pareil
  return ecartEnPourcents(pourcents, 'que la période d’avant')
}
