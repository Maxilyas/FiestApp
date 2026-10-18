// Le codex de l'Expédition : toutes les cartes des rencontres, de la commune
// à la légendaire, qu'on débloque en jouant. « Est-ce que l'on ferait pas un
// codex de carte global aussi, avec de commun à légendaire et on en débloque
// au fur et à mesure qu'on avance dans l'aventure ? Ça permettrait d'avoir des
// niveaux plus difficiles au début mais en jouant on débloque des cartes plus
// puissantes ce qui nous permet de plus avancer » (le propriétaire, le 18
// octobre 2026 ; la proposition tranchée le soir même, « Go tout faire avec
// tes recommandations »).
//
// La renommée se gagne à chaque expédition — perdue ou abandonnée aussi : sans
// quoi un joueur qui tombe à l'acte 1 resterait toujours au même niveau —, de
// ce qu'elle a fait : ses escales, ses adversaires, ses élites, ses gardiens,
// le bout. Elle fait le niveau d'explorateur ; chaque niveau ouvre des cartes,
// les premiers des règles — la première expédition n'a ni pari, ni talisman,
// ni catégorie fétiche. Un légendaire qu'on a ouvre sa carte.
//
// Pur. Ce qu'une expédition a fait se compte de son pli (`bilanDuPli`,
// `shared/expedition.ts`) — invariant 14 : la renommée d'une expédition finie
// et celle qu'on joue passent par le même chemin ; le serveur garde le bilan
// de chacune à sa fin, et le départ fige le codex qu'il ouvre
// (`DepartDExpedition.codex`) : un barème changé ne change pas les cartes
// d'une expédition partie. Ses constantes sont des choix de produit
// (`docs/reference/baremes.md`).

import { CARTES_DES_RENCONTRES, CARTES_PAR_OFFRE, VERSION_DU_CODEX, carteDeRencontre, carteDuLegendaire, type CarteDeRencontre, type PoidsDesRaretes } from './rencontres'
import { hasardDe } from './missions'

// ── La renommée ─────────────────────────────────────────────────────────────

/** Ce qu'une expédition a fait, que la renommée compte. */
export interface BilanDUneExpedition {
  /** Les escales où il est entré, gardiens compris. */
  escales: number
  /** Les adversaires tombés — aux règles d'avant, les questions d'escale trouvées. */
  adversaires: number
  /** Les élites tombées — trouvées, aux règles d'avant. */
  elites: number
  gardiens: number
  /** Allée au bout : le troisième gardien vaincu. */
  auBout: boolean
}

/**
 * Le bilan gardé à la fin d'une expédition (`campagne_series.bilan`), à sa
 * version : un bilan d'une version d'avant se refait du pli. Elle monte quand
 * le bilan compte une chose de plus.
 */
export const VERSION_DU_BILAN = 1

/**
 * Ce que rapporte chaque chose faite, en renommée. Une première expédition
 * perdue à l'acte 1 en rapporte une vingtaine — de quoi passer le niveau 2 —,
 * une menée au bout cent cinquante environ.
 */
export const RENOMMEE: Readonly<Record<keyof BilanDUneExpedition, number>> = {
  escales: 1,
  adversaires: 3,
  elites: 6,
  gardiens: 12,
  auBout: 25,
}

/** La renommée d'une expédition, de ce qu'elle a fait. */
export function renommeeDe(b: BilanDUneExpedition): number {
  return (
    b.escales * RENOMMEE.escales +
    b.adversaires * RENOMMEE.adversaires +
    b.elites * RENOMMEE.elites +
    b.gardiens * RENOMMEE.gardiens +
    (b.auBout ? RENOMMEE.auBout : 0)
  )
}

/** Un bilan relu de la base : ses nombres, ou rien — d'une autre version, ou qui ne se lit pas. */
export function lireLeBilan(brut: unknown): BilanDUneExpedition | null {
  if (typeof brut !== 'string') return null
  try {
    const b = JSON.parse(brut)
    if (b?.v !== VERSION_DU_BILAN) return null
    const n = (x: unknown) => (typeof x === 'number' && Number.isInteger(x) && x >= 0 ? x : null)
    const lu = { escales: n(b.escales), adversaires: n(b.adversaires), elites: n(b.elites), gardiens: n(b.gardiens), auBout: b.auBout === true }
    return lu.escales === null || lu.adversaires === null || lu.elites === null || lu.gardiens === null ? null : (lu as BilanDUneExpedition)
  } catch {
    return null
  }
}

/** Le bilan tel que la base le garde, à sa version. */
export const ecrireLeBilan = (b: BilanDUneExpedition) => JSON.stringify({ v: VERSION_DU_BILAN, ...b })

// ── Les niveaux ─────────────────────────────────────────────────────────────

/**
 * La renommée qu'il faut, au total, pour chaque niveau d'explorateur — le
 * premier d'office. Le joueur moyen gagne une centaine de renommée par
 * expédition, ses défaites comprises, le faible une soixantaine, le fort
 * cent vingt : le codex entier en une douzaine d'expéditions pour le moyen,
 * une vingtaine pour le faible (`calibrage-rencontres.ts`, la carrière). Un
 * premier acte joué jusqu'à son gardien, même perdu ensuite, passe le
 * niveau 2. Chaque niveau demande au moins autant que le précédent.
 */
export const NIVEAUX: readonly number[] = [0, 30, 100, 200, 320, 460, 620, 800, 1000, 1220]
export const NIVEAU_MAX = NIVEAUX.length

/** Son niveau d'explorateur, de 1 à `NIVEAU_MAX`. */
export function niveauDe(renommee: number): number {
  let n = 1
  while (n < NIVEAU_MAX && renommee >= NIVEAUX[n]) n++
  return n
}

/** Où il en est : son niveau, la renommée d'où il part, celle du suivant — null au dernier. */
export function progressionDe(renommee: number): { niveau: number; depuis: number; prochain: number | null } {
  const niveau = niveauDe(renommee)
  return { niveau, depuis: NIVEAUX[niveau - 1], prochain: niveau < NIVEAU_MAX ? NIVEAUX[niveau] : null }
}

/** Les règles qu'un niveau ouvre : la première expédition n'a que des cartes, l'énergie et le courage. */
export type RegleDuCodex = 'pari' | 'talismans' | 'fetiche'

/** Ce qu'un niveau ouvre : des cartes, et pour certains une règle. */
export interface MarcheDuCodex {
  niveau: number
  cartes: readonly string[]
  regle?: RegleDuCodex
}

/**
 * L'échelle : au niveau 1, six cartes simples, des communes — le paquet de
 * départ, La pioche et Arrêt sur image ; puis une ou deux cartes par niveau,
 * une famille entière à partir du troisième. Les déblocages ouvrent surtout
 * des façons de jouer, un peu de puissance : chaque carte plus forte rendrait
 * le début injouable et la fin trop facile. Les rares qui pèsent le plus
 * attendent — Sursis au niveau 6 : mesurée, elle seule ouverte au niveau 1
 * menait le joueur moyen au bout une fois sur deux, plus qu'avec tout le
 * codex (`calibrage-rencontres.ts`, le 18 octobre 2026). Toutes les cartes
 * sans légendaire y sont, une fois (`codex.test.ts`).
 */
export const ECHELLE: readonly MarcheDuCodex[] = [
  { niveau: 1, cartes: ['concentration', 'prudence', 'coup-d-oeil', 'echange', 'pioche', 'arret-sur-image'] },
  { niveau: 2, cartes: ['double-chance'], regle: 'pari' },
  { niveau: 3, cartes: ['parade', 'contre-attaque'] },
  { niveau: 4, cartes: ['detour', 'tout-ou-rien'], regle: 'talismans' },
  { niveau: 5, cartes: ['plume', 'bibliotheque'], regle: 'fetiche' },
  { niveau: 6, cartes: ['sursis', 'quitte-ou-double'] },
  { niveau: 7, cartes: ['doubler-la-mise', 'banco'] },
  { niveau: 8, cartes: ['corser', 'simplifier'] },
  { niveau: 9, cartes: ['echauffement', 'lancee'] },
  { niveau: 10, cartes: ['lucidite', 'troisieme-oeil'] },
]

/** Le niveau qui ouvre une règle. */
export const niveauDeLaRegle = (regle: RegleDuCodex) => ECHELLE.find(m => m.regle === regle)?.niveau ?? 1

/** Comment s'ouvre une carte : à son niveau, ou en ayant le légendaire qui la donne. */
export function ouvertureDe(cle: string): { niveau: number } | { legendaire: string } | null {
  const marche = ECHELLE.find(m => m.cartes.includes(cle))
  if (marche) return { niveau: marche.niveau }
  const legendaire = carteDeRencontre(cle)?.legendaire
  return legendaire ? { legendaire } : null
}

/**
 * Le codex d'un profil, tel que son départ le fige (v7) : son niveau, les
 * cartes qu'il ouvre — l'échelle jusqu'à lui, puis la carte de chaque
 * légendaire qu'il a —, dans l'ordre du catalogue, et les règles ouvertes.
 */
export interface CodexDuDepart {
  niveau: number
  cartes: string[]
  regles: RegleDuCodex[]
  /**
   * La renommée qu'il avait en partant : la fin y ajoute celle de
   * l'expédition, et dit le niveau qu'elle fait passer. Absente au calibrage.
   */
  renommee?: number
}

export function codexDuNiveau(niveau: number, legendaires: readonly string[]): CodexDuDepart {
  const marches = ECHELLE.filter(m => m.niveau <= niveau)
  const ouvertes = new Set([...marches.flatMap(m => m.cartes), ...legendaires.flatMap(l => carteDuLegendaire(l)?.cle ?? [])])
  return {
    niveau,
    cartes: CARTES_DES_RENCONTRES.filter(c => ouvertes.has(c.cle)).map(c => c.cle),
    regles: marches.flatMap(m => (m.regle ? [m.regle] : [])),
  }
}

/** Une règle du codex est-elle ouverte à ce départ ? Une expédition d'avant le codex (v6 et moins) les a toutes. */
export function regleOuverte(depart: { v: number; codex?: CodexDuDepart }, regle: RegleDuCodex): boolean {
  return depart.v < VERSION_DU_CODEX || !!depart.codex?.regles.includes(regle)
}

// ── Les offres ──────────────────────────────────────────────────────────────

/** Ce que les offres ne proposent jamais : les cartes de base, comme Slay the Spire ses frappes — et les légendaires, que seul le coffre d'un gardien propose. */
const HORS_DES_OFFRES = new Set(['concentration', 'prudence'])

/**
 * Une offre du codex (v7) — une rencontre gagnée, une élite, un coffre,
 * l'échoppe : trois cartes distinctes parmi celles qu'il a ouvertes, chacune
 * à une rareté tirée à ses poids. Les familles ne viennent plus des
 * légendaires de l'équipe : une carte d'une famille pèse d'autant plus que
 * son paquet en tient déjà — prends deux cartes du Rempart, on t'en proposera
 * d'autres ; ton paquet prend une couleur sans qu'on te demande rien. Une
 * rareté qui n'a plus rien d'ouvert cède la place aux autres de l'offre. Le
 * coffre d'un gardien (`legendaire`) ouvre sur une carte légendaire de son
 * codex qu'il n'a pas déjà. Du hasard de la graine et du rang de l'offre :
 * recharger ne la change pas.
 */
export function offreDuCodex(
  graine: string,
  rang: number,
  ouvertes: readonly string[],
  paquet: readonly string[],
  poids: PoidsDesRaretes,
  legendaire = false,
): string[] {
  const r = hasardDe(`${graine}:offre:${rang}`)
  const prises: string[] = []
  if (legendaire) {
    const leurs = ouvertes.filter(cle => carteDeRencontre(cle)?.rarete === 'legendaire' && !paquet.includes(cle))
    if (leurs.length > 0) prises.push(leurs[Math.floor(r() * leurs.length)])
  }
  const parFamille = new Map<string, number>()
  for (const cle of paquet) {
    const f = carteDeRencontre(cle)?.famille
    if (f && f !== 'neutre') parFamille.set(f, (parFamille.get(f) ?? 0) + 1)
  }
  const offrables = ouvertes.map(cle => carteDeRencontre(cle)).filter((c): c is CarteDeRencontre => !!c && c.rarete !== 'legendaire' && !HORS_DES_OFFRES.has(c.cle))
  const raretes = (Object.entries(poids) as ['commun' | 'rare' | 'maudit', number][]).filter(([, p]) => p > 0)
  const poidsDe = (c: CarteDeRencontre) => 1 + (c.famille === 'neutre' ? 0 : (parFamille.get(c.famille) ?? 0))
  for (let essai = 0; prises.length < CARTES_PAR_OFFRE && essai < 30; essai++) {
    const u = r()
    let cumul = 0
    let rarete = raretes[0]?.[0]
    const total = raretes.reduce((n, [, p]) => n + p, 0)
    for (const [nom, p] of raretes) {
      cumul += p / total
      if (u < cumul) {
        rarete = nom
        break
      }
    }
    const libres = offrables.filter(c => !prises.includes(c.cle))
    const aSaRarete = libres.filter(c => c.rarete === rarete)
    const permises = new Set(raretes.map(([nom]) => nom))
    const candidates = aSaRarete.length > 0 ? aSaRarete : libres.filter(c => permises.has(c.rarete as 'commun' | 'rare' | 'maudit'))
    if (candidates.length === 0) break
    const somme = candidates.reduce((n, c) => n + poidsDe(c), 0)
    let t = r() * somme
    let choisie = candidates[candidates.length - 1]
    for (const c of candidates) {
      t -= poidsDe(c)
      if (t < 0) {
        choisie = c
        break
      }
    }
    prises.push(choisie.cle)
  }
  return prises
}
