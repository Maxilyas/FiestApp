// Le carnet des fêtes : un timbre par fête et par an (la maquette des fêtes,
// validée par le propriétaire le 1er novembre 2026 : « un timbre dessiné,
// gratuit »). Gagner sa fête — ses jours de quiz du jour, ou une soirée qui
// compte pendant elle — range le timbre de son année (`timbre:paques:2027`),
// sous le jour ou la soirée qui l'a fait tomber, comme sa saison. Le
// légendaire de la fête ne se gagne qu'une fois ; le timbre, chaque année :
// la fête revient, le carnet se remplit, et une fête manquée reste un trou
// dans sa page — on ne la rattrape pas.
//
// Ni étagère ni compte des badges : c'est une voie rangée
// (`PREFIXES_DES_VOIES_RANGEES`, `shared/legendaires.ts`), et le carnet a sa
// ligne dans « Ma collection ». Dérivation pure de ce que la page reçoit :
// ses timbres, et le jour de Paris du serveur.
//
// Ce module n'importe que les saisons : l'accueil et la page du quiz du jour
// le lisent sans tirer la collection.

import { SAISONS, fetee, millesimeDe, periodeDuMillesime, saison, type CleDeSaison, type Saison } from './saisons'

export const PREFIXE_DES_TIMBRES = 'timbre:'

/** La clé d'un timbre : une fête et son millésime, `timbre:paques:2027`. */
export const cleDuTimbre = (fete: CleDeSaison, millesime: number) => `${PREFIXE_DES_TIMBRES}${fete}:${millesime}`

/** Ce que la page reçoit d'un timbre : sa clé sans le préfixe, `paques:2027`. */
export const timbreDit = (fete: CleDeSaison, millesime: number) => `${fete}:${millesime}`

/**
 * La ligne d'un timbre sur l'étagère, d'où qu'il vienne — une soirée, le quiz
 * du jour : sa clé, l'emoji de sa fête, que rien n'affiche, et son titre,
 * recopiés comme ceux d'un prix.
 */
export const etiquetteDuTimbre = (s: Saison, millesime: number) => ({
  badge: cleDuTimbre(s.key, millesime),
  emoji: s.emoji,
  title: `Timbre : ${s.court} ${millesime}`,
})

/** La fête et le millésime d'une clé de timbre — rangée (`timbre:paques:2027`) ou dite (`paques:2027`) —, ou null. */
export function timbreDe(cle: unknown): { saison: Saison; millesime: number } | null {
  if (typeof cle !== 'string') return null
  const nue = cle.startsWith(PREFIXE_DES_TIMBRES) ? cle.slice(PREFIXE_DES_TIMBRES.length) : cle
  const m = /^([a-z-]+):(\d{4})$/.exec(nue)
  const s = m ? saison(m[1]) : undefined
  return s ? { saison: s, millesime: Number(m![2]) } : null
}

/** Ses timbres, de ses récompenses rangées, dits sans préfixe et triés : `['halloween:2026', 'paques:2027']`. */
export function timbresDe(recompenses: ReadonlyMap<string, number>): string[] {
  const dits: string[] = []
  for (const [cle, n] of recompenses) {
    if (n <= 0 || !cle.startsWith(PREFIXE_DES_TIMBRES)) continue
    const t = timbreDe(cle)
    if (t) dits.push(timbreDit(t.saison.key, t.millesime))
  }
  return dits.sort()
}

/**
 * Le premier jour du carnet : Halloween 2026, la première fête qui ait laissé
 * son timbre — celles des années d'avant n'en avaient pas. Une période finie
 * plus tôt n'y a pas de case : elle se dirait manquée à tout le monde.
 */
export const DEBUT_DU_CARNET = '2026-10-25'

/** Gagné ; sa fête en cours, pas encore gagné ; à venir ; ou passé sans lui. */
export type EtatDuTimbre = 'gagne' | 'en-cours' | 'a-venir' | 'manque'

export interface CaseDuCarnet {
  fete: CleDeSaison
  millesime: number
  /** Sa période cette année-là, bornes comprises. */
  debut: string
  fin: string
  etat: EtatDuTimbre
}

export interface PageDuCarnet {
  millesime: number
  /** Ses fêtes, dans l'ordre de l'année : le Nouvel An d'abord, Noël au bout. */
  cases: CaseDuCarnet[]
  gagnes: number
}

const etatDe = (cle: string, debut: string, fin: string, siens: ReadonlySet<string>, aujourdhui: string): EtatDuTimbre =>
  siens.has(cle) ? 'gagne' : fin < aujourdhui ? 'manque' : debut <= aujourdhui ? 'en-cours' : 'a-venir'

/** Les cases d'une année : ses fêtes déjà nées (`depuis`), dans l'ordre de l'année, et finies au plus tôt au début du carnet. */
function casesDe(millesime: number, siens: ReadonlySet<string>, aujourdhui: string): CaseDuCarnet[] {
  return SAISONS.filter(s => fetee(s, millesime))
    .map(s => ({ s, ...periodeDuMillesime(s, millesime) }))
    .filter(c => c.fin >= DEBUT_DU_CARNET)
    .sort((a, b) => (a.debut < b.debut ? -1 : a.debut > b.debut ? 1 : 0))
    .map(({ s, debut, fin }) => ({ fete: s.key, millesime, debut, fin, etat: etatDe(timbreDit(s.key, millesime), debut, fin, siens, aujourdhui) }))
}

/**
 * Le carnet, au jour de Paris du serveur (`aujourdhui`) : une page par année,
 * de la première du carnet à celle d'aujourd'hui — et à la suivante dès
 * qu'une de ses fêtes a commencé : le Nouvel An du 31 décembre est déjà celui
 * de l'an qui vient. Un timbre d'une année sans page — l'horloge d'un serveur
 * qui retarde — ouvre la sienne : ce qui est gagné se montre.
 */
export function carnetDesFetes(timbres: readonly string[], aujourdhui: string): PageDuCarnet[] {
  const siens = new Set(timbres)
  const premiere = millesimeDe(DEBUT_DU_CARNET)
  const annee = Number(aujourdhui.slice(0, 4))
  const derniere = Math.max(
    Number.isInteger(annee) ? annee : premiere,
    ...timbres.map(t => timbreDe(t)?.millesime ?? premiere),
    ...(Number.isInteger(annee) ? SAISONS.filter(s => fetee(s, annee + 1) && periodeDuMillesime(s, annee + 1).debut <= aujourdhui).map(() => annee + 1) : []),
  )
  const pages: PageDuCarnet[] = []
  for (let m = premiere; m <= derniere; m++) {
    const cases = casesDe(m, siens, aujourdhui)
    if (cases.length > 0) pages.push({ millesime: m, cases, gagnes: cases.filter(c => c.etat === 'gagne').length })
  }
  return pages
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

/** Un jour dit à la française, sans `Intl` (règle `client.md`) : « 1er avril », « 28 mars ». */
export function jourDit(jour: string): string {
  const j = Number(jour.slice(8, 10))
  return `${j === 1 ? '1er' : j} ${MOIS[Number(jour.slice(5, 7)) - 1] ?? ''}`
}

/**
 * Une période de fête en toutes lettres, l'année qu'on regarde : « du 26 au
 * 29 mars », « du 30 décembre au 2 janvier ». Celle d'une saison se dit
 * aussi en mots fixes (`Saison.periode`) ; Pâques, qui suit la lune, ne se
 * date qu'ainsi.
 */
export function periodeDite(debut: string, fin: string): string {
  const memeMois = debut.slice(0, 7) === fin.slice(0, 7)
  return memeMois ? `du ${jourDit(debut).split(' ')[0]} au ${jourDit(fin)}` : `du ${jourDit(debut)} au ${jourDit(fin)}`
}

/**
 * Ce que le carnet compte dans « Ma collection » : ses timbres, sur les cases
 * de ses pages — l'année en cours entière, ses fêtes à venir comprises. Une
 * année neuve en ajoute d'un coup : une page de plus au carnet.
 */
export function compteDuCarnet(timbres: readonly string[], aujourdhui: string): { acquis: number; total: number } {
  const pages = carnetDesFetes(timbres, aujourdhui)
  return { acquis: pages.reduce((n, p) => n + p.gagnes, 0), total: pages.reduce((n, p) => n + p.cases.length, 0) }
}
