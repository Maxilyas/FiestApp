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
// de période d'avant (`avant: null`), jusqu'à la mémoire longue du plan.

import { formatNumber } from './typographie'
import {
  HABITUDE_EN_POURCENTS,
  MODES_DU_QG,
  ecartEnPourcents,
  minuitDe,
  participationsParSeau,
  type EcartALHabitude,
  type ModeDuQg,
  type PartieDesParticipations,
  type SeauDeParticipations,
  type SoireeDesParticipations,
} from './qg'

export const PERIODES_DU_QG = ['1h', '24h', '7j', '30j'] as const
export type PeriodeDuQg = (typeof PERIODES_DU_QG)[number]

/** À l'ouverture, la journée ; puis la dernière choisie, que le navigateur retient. */
export const PERIODE_PAR_DEFAUT: PeriodeDuQg = '24h'

export const NOM_DE_LA_PERIODE: Record<PeriodeDuQg, string> = { '1h': '1 h', '24h': '24 h', '7j': '7 j', '30j': '30 j' }

/** Ce que la période regarde, en toutes lettres : le titre d'un graphique, l'écart d'une tuile. */
export const PERIODE_EN_TOUTES_LETTRES: Record<PeriodeDuQg, string> = {
  '1h': 'la dernière heure',
  '24h': 'les dernières 24 heures',
  '7j': 'les sept derniers jours',
  '30j': 'les trente derniers jours',
}

const MINUTE = 60_000
const HEURE = 60 * MINUTE

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
  periode: PeriodeDuQg
  /** La largeur d'un seau, en millisecondes — un jour de Paris en a vingt-trois ou vingt-cinq deux fois l'an. */
  pas: number
  /** La participation seau par seau ; le dernier finit maintenant. */
  seaux: SeauDeParticipations[]
  totaux: TotauxDUnePeriode
  /**
   * La période d'avant, de même longueur et arrêtée au même instant — hier
   * à la même heure, la semaine d'avant au même jour — : un soir à 21 h ne se
   * lit pas en baisse contre une journée entière. Null sur trente jours : les
   * journaux gardés ne disent pas le mois d'avant.
   */
  avant: { seaux: SeauDeParticipations[]; totaux: TotauxDUnePeriode } | null
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
