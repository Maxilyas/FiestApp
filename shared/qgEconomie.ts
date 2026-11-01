// L'économie au QG (`/admin#economie`, le choix du 13 octobre 2026, sur
// maquettes : « Gagnés et dépensés », « Les meilleures ventes », « En
// circulation », « Éclats et légendaires »). Les confettis ne s'écrivent
// nulle part : un solde se relit à chaque lecture (`ProfileStore.boutiqueDe`).
// La page relit donc chaque source à ses règles — une bonne réponse, un
// confetti ; les étoiles des sentiers et les ligues des duels, qui ne
// laissent aucune ligne, se datent ici, à l'épreuve qui atteint la note et
// au lundi qui paie la semaine.
import { BRANCHES } from './branches'
import { PRIX_D_UN_COMPAGNON, COMPAGNONS } from './compagnons'
import { recompenseDeLaSemaine, type SemaineJouee } from './duels'
import { fond } from './fonds'
import { jourAvant } from './jour'
import { LEGENDAIRES } from './legendaires'
import { compteDuJour, JOURS_DE_L_HABITUDE, JOURS_DES_TUILES, jourDeLInstant, joursDesMinuits, minuitDe, type CompteDuJour } from './qg'
import { confettisDeLaNouvelleNote, etoilesDe, regleDuPalier } from './sentiers'
import { NOM_DE_RARETE, THEMES } from './themes'

/** D'où viennent les confettis, dans l'ordre de la page. */
export const SOURCES_DE_CONFETTIS = ['campagne', 'jour', 'soirees', 'ligues', 'etoiles', 'defis', 'missions', 'coffres', 'dons'] as const
export type SourceDeConfettis = (typeof SOURCES_DE_CONFETTIS)[number]

export const NOM_DE_LA_SOURCE: Record<SourceDeConfettis, string> = {
  campagne: 'Campagne',
  jour: 'Quiz du jour',
  soirees: 'Soirées',
  ligues: 'Ligues des duels',
  etoiles: 'Étoiles des sentiers',
  // Les rangs des défis de tes cartes, au Cabinet de curiosités (le 1er novembre 2026), datés à la ligne qui les range.
  defis: 'Défis du Cabinet',
  missions: 'Missions du jour',
  coffres: 'Coffres de la semaine et du mois',
  // Le QG tutoie l'administrateur, comme son journal : ces dons sont les siens.
  dons: 'Tes dons',
}

/** Où ils partent : tout ce que la boutique vend. */
export const DEPENSES_DE_CONFETTIS = ['themes', 'compagnons', 'fonds', 'vies', 'sabliers', 'eclats'] as const
export type DepenseDeConfettis = (typeof DEPENSES_DE_CONFETTIS)[number]

export const NOM_DE_LA_DEPENSE: Record<DepenseDeConfettis, string> = {
  themes: 'Thèmes',
  compagnons: 'Compagnons',
  fonds: 'Fonds de carte',
  vies: 'Vies',
  sabliers: 'Sabliers',
  eclats: 'Éclats',
}

/** Des confettis qui bougent à un instant : une heure de bonnes réponses, une partie, une soirée, un don. */
export interface Mouvement {
  quand: number
  confettis: number
}

/** Un achat : son prix payé, ses objets — une ligne de vies en achète jusqu'à dix —, et l'article d'un thème ou d'un compagnon. */
export interface Achat extends Mouvement {
  sorte: DepenseDeConfettis
  objets: number
  article: string | null
}

/** Ce que les magasins disent d'une période : ce que chaque source a payé, et chaque achat. */
export interface MouvementsDeConfettis {
  gagnes: Record<SourceDeConfettis, Mouvement[]>
  achats: Achat[]
}

/** Des mouvements vides, à remplir source par source. */
export const sansMouvement = (): MouvementsDeConfettis => ({
  gagnes: { campagne: [], jour: [], soirees: [], ligues: [], etoiles: [], defis: [], missions: [], coffres: [], dons: [] },
  achats: [],
})

/** Les mouvements d'avant un instant : les jours finis, que le QG garde jusqu'à minuit. */
export function mouvementsAvant(m: MouvementsDeConfettis, minuit: number): MouvementsDeConfettis {
  const gagnes = sansMouvement().gagnes
  for (const s of SOURCES_DE_CONFETTIS) gagnes[s] = m.gagnes[s].filter(x => x.quand < minuit)
  return { gagnes, achats: m.achats.filter(a => a.quand < minuit) }
}

/** Deux périodes bout à bout : les jours finis gardés, et aujourd'hui relu. */
export function mouvementsBoutABout(a: MouvementsDeConfettis, b: MouvementsDeConfettis): MouvementsDeConfettis {
  const gagnes = sansMouvement().gagnes
  for (const s of SOURCES_DE_CONFETTIS) gagnes[s] = [...a.gagnes[s], ...b.gagnes[s]]
  return { gagnes, achats: [...a.achats, ...b.achats] }
}

/**
 * Une somme du jour, comme `compteDuJour` compte : aujourd'hui jusqu'à
 * maintenant, et la moyenne des sept jours d'avant, chacun arrêté à la même
 * heure. Une heure de bonnes réponses compte à son début, une soirée à sa
 * première ligne de crédit : d'habitude, le chiffre de la même heure est
 * donc un peu plus haut qu'il ne serait à la minute.
 */
export function sommeDuJour(mouvements: readonly Mouvement[], minuits: readonly number[], maintenant: number): CompteDuJour {
  const n = minuits.length
  const ecart = maintenant - minuits[n - 1]
  const entiers = minuits.map(() => 0)
  const memeHeure = minuits.map(() => 0)
  for (const m of mouvements) {
    if (m.quand > maintenant) continue
    const i = jourDeLInstant(minuits, m.quand)
    if (i < 0) continue
    entiers[i] += m.confettis
    if (m.quand - minuits[i] <= ecart) memeHeure[i] += m.confettis
  }
  const avant = memeHeure.slice(Math.max(0, n - 1 - JOURS_DE_L_HABITUDE), n - 1)
  return {
    aujourdhui: entiers[n - 1],
    habituel: avant.length > 0 ? Math.round(avant.reduce((s, x) => s + x, 0) / avant.length) : null,
    parJour: entiers.slice(-JOURS_DES_TUILES),
  }
}

/** Un jour de confettis : ce qui s'est gagné, ce qui s'est dépensé. */
export interface JourDeConfettis {
  jour: string
  gagnes: number
  depenses: number
}

/** Les flux de trente jours, tels que la page les montre. */
export interface FluxDeConfettis {
  aujourdhui: {
    gagnes: CompteDuJour
    depenses: CompteDuJour
    achats: CompteDuJour
    /** Les achats d'aujourd'hui, sorte par sorte : « 19 thèmes · 2 compagnons ». */
    achatsParSorte: Record<DepenseDeConfettis, number>
  }
  jours: JourDeConfettis[]
  /** Ce que chaque source a payé ces trente jours. */
  sources: Record<SourceDeConfettis, number>
  /** Ce que chaque sorte d'achat a coûté ces trente jours, et ses objets. */
  depenses: Record<DepenseDeConfettis, { objets: number; confettis: number }>
}

/**
 * Les flux d'une période, jour par jour : gagnés, dépensés, source par
 * source et sorte par sorte. Ce qui tombe avant le premier minuit ou après
 * maintenant ne compte pas.
 */
export function fluxDeConfettis(m: MouvementsDeConfettis, minuits: readonly number[], maintenant: number): FluxDeConfettis {
  const dedans = (quand: number) => quand <= maintenant && jourDeLInstant(minuits, quand) >= 0
  const gagnes = SOURCES_DE_CONFETTIS.flatMap(s => m.gagnes[s])
  const parJour = minuits.map(() => ({ gagnes: 0, depenses: 0 }))
  for (const x of gagnes) if (dedans(x.quand)) parJour[jourDeLInstant(minuits, x.quand)].gagnes += x.confettis
  for (const a of m.achats) if (dedans(a.quand)) parJour[jourDeLInstant(minuits, a.quand)].depenses += a.confettis
  const sources = Object.fromEntries(
    SOURCES_DE_CONFETTIS.map(s => [s, m.gagnes[s].reduce((n, x) => n + (dedans(x.quand) ? x.confettis : 0), 0)]),
  ) as Record<SourceDeConfettis, number>
  const depenses = Object.fromEntries(DEPENSES_DE_CONFETTIS.map(d => [d, { objets: 0, confettis: 0 }])) as FluxDeConfettis['depenses']
  const achatsParSorte = Object.fromEntries(DEPENSES_DE_CONFETTIS.map(d => [d, 0])) as Record<DepenseDeConfettis, number>
  const aujourdhui = minuits[minuits.length - 1]
  for (const a of m.achats) {
    if (!dedans(a.quand)) continue
    depenses[a.sorte].objets += a.objets
    depenses[a.sorte].confettis += a.confettis
    if (a.quand >= aujourdhui) achatsParSorte[a.sorte]++
  }
  const jours = joursDesMinuits(minuits)
  return {
    aujourdhui: {
      gagnes: sommeDuJour(gagnes, minuits, maintenant),
      depenses: sommeDuJour(m.achats, minuits, maintenant),
      achats: compteDuJour(m.achats, minuits, maintenant),
      achatsParSorte,
    },
    jours: parJour.map((j, i) => ({ jour: jours[i], ...j })),
    sources,
    depenses,
  }
}

// ── Les étoiles et les ligues, datées ───────────────────────────────────────

/** Une épreuve de sentier validée, telle que la campagne la garde. */
export interface EpreuveValidee {
  profil: string
  branche: string
  palier: number
  justes: number
  seuil: number | null
  quand: number
}

/**
 * Ce que les étoiles des sentiers ont payé, épreuve par épreuve : chaque
 * palier paie sa meilleure note (`confettisDesEtoiles`), une meilleure note
 * ne paie que la différence (`confettisDeLaNouvelleNote`) — à l'épreuve qui
 * l'atteint. Aux mêmes règles que `sentiersLus` : un palier sans règle, une
 * branche inconnue ne paient rien. La somme de chaque profil vaut donc ce
 * que son solde compte.
 */
export function etoilesDansLeTemps(epreuves: readonly EpreuveValidee[]): { mouvements: Mouvement[]; parProfil: Map<string, number> } {
  const branches = new Set<string>(BRANCHES.map(b => b.key))
  const meilleures = new Map<string, number>()
  const parProfil = new Map<string, number>()
  const mouvements: Mouvement[] = []
  for (const e of [...epreuves].sort((a, b) => a.quand - b.quand)) {
    const regle = regleDuPalier(e.palier)
    if (!regle || !branches.has(e.branche)) continue
    const cle = `${e.profil}|${e.branche}|${e.palier}`
    const avant = meilleures.get(cle) ?? 0
    const note = etoilesDe(e.justes, e.seuil ?? regle.seuil)
    const paye = confettisDeLaNouvelleNote(avant, note)
    meilleures.set(cle, Math.max(avant, note))
    if (paye <= 0) continue
    mouvements.push({ quand: e.quand, confettis: paye })
    parProfil.set(e.profil, (parProfil.get(e.profil) ?? 0) + paye)
  }
  return { mouvements, parProfil }
}

/** Le premier instant du lundi qui suit une semaine (« 2026-10-05 ») : celui qui la clôt, et la paie. */
export function lundiQuiPaie(semaine: string): number {
  const [a, m, j] = jourAvant(semaine, -7).split('-').map(Number)
  // Midi en temps universel tombe toujours dans le même jour de Paris.
  return minuitDe(Date.UTC(a, m - 1, j, 12))
}

/**
 * Ce que les ligues des duels ont payé : chaque semaine close qui a eu ses
 * duels paie sa meilleure ligue (`confettisDesLigues`), au lundi qui la
 * clôt. Celle qui se joue encore ne paie rien : sa ligue peut monter.
 */
export function liguesDansLeTemps(
  releves: Iterable<readonly [string, { semaines: ReadonlyMap<string, Pick<SemaineJouee, 'duels' | 'meilleure'>> }]>,
  semaineEnCours: string,
): { mouvements: Mouvement[]; parProfil: Map<string, number> } {
  const mouvements: Mouvement[] = []
  const parProfil = new Map<string, number>()
  const lundis = new Map<string, number>()
  for (const [profil, r] of releves) {
    for (const [semaine, s] of r.semaines) {
      if (semaine >= semaineEnCours) continue
      const paye = recompenseDeLaSemaine(s)
      if (paye <= 0) continue
      let lundi = lundis.get(semaine)
      if (lundi === undefined) lundis.set(semaine, (lundi = lundiQuiPaie(semaine)))
      mouvements.push({ quand: lundi, confettis: paye })
      parProfil.set(profil, (parProfil.get(profil) ?? 0) + paye)
    }
  }
  return { mouvements, parProfil }
}

// ── En circulation ──────────────────────────────────────────────────────────

/** Les tranches de soldes : la dernière commence au prix d'un compagnon, l'achat le plus cher. */
export const TRANCHES_DE_SOLDE: readonly { de: number | null; a: number | null }[] = [
  { de: null, a: 100 },
  { de: 100, a: 500 },
  { de: 500, a: PRIX_D_UN_COMPAGNON },
  { de: PRIX_D_UN_COMPAGNON, a: null },
]

/** Ce que les joueurs ont en poche, tous profils, relu une fois par jour. */
export interface CirculationDesConfettis {
  /** Quand les soldes ont été relus : à la première ouverture de la page de la journée. */
  le: number
  total: number
  profils: number
  /** Les profils venus ces trente jours, et leur solde médian. */
  actifs: number
  medianeDesActifs: number | null
  tranches: { de: number | null; a: number | null; profils: number }[]
  /** Les profils qui ont de quoi s'offrir un compagnon. */
  deQuoiUnCompagnon: number
}

/** La médiane d'une liste : la moyenne des deux du milieu quand elle est paire. */
export function medianeDe(xs: readonly number[]): number | null {
  if (xs.length === 0) return null
  const tries = [...xs].sort((a, b) => a - b)
  const milieu = Math.floor(tries.length / 2)
  return tries.length % 2 === 1 ? tries[milieu] : (tries[milieu - 1] + tries[milieu]) / 2
}

/** La circulation de tous les soldes : leur somme, leurs tranches, la médiane de ceux qui jouent. */
export function circulationDes(soldes: readonly { solde: number; actif: boolean }[], le: number): CirculationDesConfettis {
  const dans = (s: number, t: { de: number | null; a: number | null }) => (t.de === null || s >= t.de) && (t.a === null || s < t.a)
  const actifs = soldes.filter(s => s.actif).map(s => s.solde)
  return {
    le,
    total: soldes.reduce((n, s) => n + s.solde, 0),
    profils: soldes.length,
    actifs: actifs.length,
    medianeDesActifs: medianeDe(actifs),
    tranches: TRANCHES_DE_SOLDE.map(t => ({ ...t, profils: soldes.filter(s => dans(s.solde, t)).length })),
    deQuoiUnCompagnon: soldes.filter(s => s.solde >= PRIX_D_UN_COMPAGNON).length,
  }
}

// ── Les meilleures ventes ───────────────────────────────────────────────────

/** Les articles que la page montre : de quoi voir ce qui se vend, sans tout le catalogue. */
export const VENTES_AU_QG = 8

/** Ce qui se vend à l'unité, et se compte aux meilleures ventes. */
export type SorteDeVente = 'theme' | 'compagnon' | 'fond'

/** Un article vendu : son nom et sa rareté, ses ventes depuis toujours et ces trente jours. */
export interface VenteDUnArticle {
  sorte: SorteDeVente
  article: string
  nom: string
  /** « Rare », « Épique » — ou « Compagnon », « Fond de carte ». */
  rarete: string
  ventes: number
  recentes: number
}

/**
 * Les meilleures ventes : les plus vendues ces trente jours d'abord, puis
 * depuis toujours. Un article que le catalogue ne connaît plus garde sa
 * clé pour nom.
 */
export function meilleuresVentes(lignes: readonly { sorte: SorteDeVente; article: string; ventes: number; recentes: number }[]): VenteDUnArticle[] {
  return lignes
    .map(l => {
      const theme = l.sorte === 'theme' ? THEMES.find(t => t.key === l.article) : undefined
      const compagnon = l.sorte === 'compagnon' ? COMPAGNONS.find(c => c.key === l.article) : undefined
      const leFond = l.sorte === 'fond' ? fond(l.article) : undefined
      return {
        ...l,
        nom: theme?.nom ?? compagnon?.nom ?? leFond?.nom ?? l.article,
        rarete: l.sorte === 'compagnon' ? 'Compagnon' : l.sorte === 'fond' ? 'Fond de carte' : theme ? NOM_DE_RARETE[theme.rarete] : '–',
      }
    })
    .sort((a, b) => b.recentes - a.recentes || b.ventes - a.ventes || a.nom.localeCompare(b.nom, 'fr'))
    .slice(0, VENTES_AU_QG)
}

// ── Les Éclats et les légendaires ───────────────────────────────────────────

/** Les légendaires que la page nomme : les plus portés. */
export const LEGENDAIRES_AU_QG = 6

export interface EclatsEtLegendaires {
  /** Les Éclats tombés ces trente jours, et où. */
  eclats: { total: number; jour: number; soirees: number; defi: number }
  /** Les profils qui portent un légendaire, et les plus portés. */
  legendaires: { porteurs: number; plusPortes: { cle: string; nom: string; porteurs: number }[] }
}

/**
 * Où un Éclat est tombé, d'après la ligne qui l'a tiré : `#jour:2026-10-13`
 * au quiz du jour, `#defi:2026-10-12` au défi de la semaine, sinon une
 * soirée (`profile_eclats.soiree_id`).
 */
export function sourceDeLEclat(soiree: string): 'jour' | 'defi' | 'soirees' {
  return soiree.startsWith('#jour:') ? 'jour' : soiree.startsWith('#defi:') ? 'defi' : 'soirees'
}

/** Les Éclats et les légendaires, des lignes lues : un Éclat par ligne, les légendaires portés par clé. */
export function eclatsEtLegendaires(eclats: readonly { soiree: string }[], portes: ReadonlyMap<string, number>): EclatsEtLegendaires {
  const parSource = { jour: 0, soirees: 0, defi: 0 }
  for (const e of eclats) parSource[sourceDeLEclat(e.soiree)]++
  const plusPortes = LEGENDAIRES.filter(l => (portes.get(l.key) ?? 0) > 0)
    .map(l => ({ cle: l.key, nom: l.nom, porteurs: portes.get(l.key)! }))
    .sort((a, b) => b.porteurs - a.porteurs || a.nom.localeCompare(b.nom, 'fr'))
  return {
    eclats: { total: eclats.length, ...parSource },
    legendaires: {
      porteurs: LEGENDAIRES.reduce((n, l) => n + (portes.get(l.key) ?? 0), 0),
      plusPortes: plusPortes.slice(0, LEGENDAIRES_AU_QG),
    },
  }
}

// ── La page ─────────────────────────────────────────────────────────────────

/** La page de l'économie (`GET /api/admin/economie`). */
export interface PageDeLEconomie extends FluxDeConfettis, EclatsEtLegendaires {
  maintenant: number
  /** Null quand la base ne répond pas : le reste de la page se montre. */
  circulation: CirculationDesConfettis | null
  ventes: VenteDUnArticle[]
}
