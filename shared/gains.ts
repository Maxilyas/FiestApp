// L'écran de gains, le même dans chaque mode (l'écran A, choisi par le
// propriétaire le 13 octobre 2026) : ce qu'on gagne — l'expérience en un
// total, ce qui la fait, les confettis, le niveau —, les nouveaux trophées,
// trois au plus, les plus rares d'abord, et ce qu'ils ouvrent à porter.
//
// Chaque fin le disait à sa façon : le quiz du jour en lignes « Nouveau
// palier : … », la campagne en cartes, la soirée en « Nouveau » puis
// « Plus », les sentiers en « +18 XP, dont 10 pour le palier » ; un palier
// et Le Laurier tombés de la même victoire faisaient deux lignes, et rien ne
// disait que L'Assidu · Argent venait d'ouvrir la Nuit étoilée (le retour reçu
// par le propriétaire : « c'est très confus, les trophées que les gens
// gagnent »). Ici, les règles pures de cet écran ; les fins le montrent par
// les mêmes pièces (`client/src/components/Gains.tsx`).

import { NOM_PALIER, PART_DES_JOUEURS, clePalier, hautFait, hautFaitDeSoiree, palierDe, regleDuPalier, titreDePalier, xpDe, type Ton } from './hautsfaits'
import { ABSORBES, ceQuIlOuvre, rareteMesuree, type Recompense } from './pistes'
import { pageDuTrophee, type PageDesTrophees } from './pagesDesTrophees'
import type { Rarete } from './badges'

/** Une part de l'expérience gagnée : « ta partie +124 », « ta série de 7 jours +70 », « tes trophées +175 ». */
export interface PartDeLXp {
  nom: string
  xp: number
}

/** Les parts qui comptent — un « +0 » ressemblait à une panne —, dans l'ordre donné. */
export function partsDeLXp(parts: readonly (PartDeLXp | false | null | undefined)[]): PartDeLXp[] {
  return parts.filter((p): p is PartDeLXp => !!p && p.xp > 0)
}

export const totalDeLXp = (parts: readonly PartDeLXp[]) => parts.reduce((n, p) => n + p.xp, 0)

/** L'expérience des trophées tombés : chaque palier une fois, chaque haut fait chaque fois — un prix, jamais (invariant 19). */
export const xpDesTrophees = (cles: readonly string[]) => cles.reduce((n, k) => n + xpDe(k), 0)

/** Ce qu'une fin de partie reçoit de ce qui est tombé : un palier, un haut fait, un prix et ce qui le justifie. */
export interface Tombe {
  key: string
  emoji: string
  title: string
  /** Un prix du palmarès : le chiffre qui le justifie (« 2,4 s de moyenne »). */
  detail?: string
}

/** Un trophée tel que l'écran de gains le montre : une ligne par piste, les métaux d'une même fin réunis. */
export interface TropheeTombe {
  /** La clé du plus haut de ce qui est tombé : `hf:assidu:2`, `hf:leve-tot`, `eclair`. */
  cle: string
  emoji: string
  /** « L'Assidu · Argent », « L'Alpiniste · Bronze → Or », « Le Lève-tôt ». */
  titre: string
  /** Ce qu'il a fallu : « 30 jours de quiz du jour », sa règle, ou le chiffre d'un prix. */
  detail: string
  /** Ce qu'il rapporte, tout compris ; un prix, rien. */
  xp: number
  rarete: Rarete | null
  ton: Ton
  /** Une piste : son plus haut métal atteint, de 1 à 3 — ses pastilles. */
  metaux?: number
  prix?: true
  /** La page de l'album où le retrouver. */
  page: PageDesTrophees
}

/** Combien l'écran en montre : trois tiennent sous le total ; les autres se comptent, et l'album les a. */
export const TROPHEES_MONTRES = 3

/**
 * Les trophées d'une fin, en lignes : les métaux d'une même piste réunis
 * (« L'Alpiniste · Bronze → Or », une ligne au lieu de trois), Le Laurier sur
 * la ligne du Champion du jour quand la même victoire en fait tomber un
 * palier (`ABSORBES`) ; les exploits d'abord, les coups du sort ensuite, et
 * dans chacun les plus rares — ce que le moins de joueurs ont —, puis ce qui
 * rapporte le plus. Un prix va à une personne de la salle : sa rareté est
 * d'un sur la salle (`joueurs`).
 */
export function tropheesTombes(tombes: readonly Tombe[], { prix = [], joueurs }: { prix?: readonly Tombe[]; joueurs?: number } = {}): TropheeTombe[] {
  const pistes = new Map<string, { metaux: number[]; absorbes: Tombe[] }>()
  const seuls: Tombe[] = []
  for (const t of tombes) {
    const p = palierDe(t.key)
    const piste = p ? p.hautFait.key : ABSORBES[t.key]
    if (!piste) {
      seuls.push(t)
      continue
    }
    let groupe = pistes.get(piste)
    if (!groupe) pistes.set(piste, (groupe = { metaux: [], absorbes: [] }))
    if (p) groupe.metaux.push(p.palier)
    else groupe.absorbes.push(t)
  }
  const lignes: (TropheeTombe & { part: number })[] = []
  for (const [piste, { metaux, absorbes }] of pistes) {
    // Le Laurier seul, sans palier de sa piste : il garde sa ligne et son nom.
    if (metaux.length === 0) {
      seuls.push(...absorbes)
      continue
    }
    const h = hautFait(piste)
    if (h?.famille !== 'carriere') continue
    const haut = Math.max(...metaux)
    const bas = Math.min(...metaux)
    const cle = clePalier(piste, haut)
    lignes.push({
      cle,
      emoji: h.emoji,
      titre: bas === haut ? titreDePalier(h, haut) : `${h.title} · ${NOM_PALIER[bas - 1]} → ${NOM_PALIER[haut - 1]}`,
      detail: regleDuPalier(h, haut),
      xp: xpDesTrophees([...metaux.map(m => clePalier(piste, m)), ...absorbes.map(a => a.key)]),
      rarete: rareteMesuree(cle),
      ton: 'eclat',
      metaux: haut,
      page: pageDuTrophee(cle),
      part: PART_DES_JOUEURS[cle] ?? 1,
    })
  }
  for (const t of seuls) {
    const h = hautFaitDeSoiree(t.key)
    lignes.push({
      cle: t.key,
      emoji: t.emoji,
      titre: t.title,
      detail: h?.rule ?? t.detail ?? '',
      xp: xpDe(t.key),
      rarete: rareteMesuree(t.key),
      ton: h?.ton ?? 'eclat',
      page: pageDuTrophee(t.key),
      part: PART_DES_JOUEURS[t.key] ?? 1,
    })
  }
  for (const t of prix) {
    lignes.push({
      cle: t.key,
      emoji: t.emoji,
      titre: t.title,
      detail: t.detail ?? '',
      xp: 0,
      rarete: null,
      ton: 'eclat',
      prix: true,
      page: 'soiree',
      part: joueurs && joueurs > 0 ? 1 / joueurs : 1,
    })
  }
  lignes.sort((a, b) => (a.ton === b.ton ? 0 : a.ton === 'eclat' ? -1 : 1) || a.part - b.part || b.xp - a.xp)
  return lignes.map(({ part: _part, ...t }) => t)
}

/** Ce qu'une fin peut proposer d'essayer : ce qui se porte et s'essaie dans la loge. */
export type PieceAPorter = 'fond' | 'gerbe' | 'theme'

/** Un objet que la partie vient d'ouvrir, sous « À porter » : son nom, sa pièce, et ce qui l'a ouvert. */
export interface ObjetAPorter {
  piece: PieceAPorter
  cle: string
  nom: string
  /** « L'Assidu · Argent », « 3 maîtres des sentiers ». */
  par: string
}

const PIECE: Partial<Record<Recompense['sorte'], PieceAPorter>> = { fond: 'fond', gerbe: 'gerbe', theme: 'theme' }

/**
 * Ce que des récompenses ouvrent à porter : les fonds, les gerbes et les
 * thèmes — un laurier se porte tout seul, un légendaire a sa carte, une
 * bordure sa ligue —, chacun une fois, avec ce qui l'a ouvert.
 */
export function objetsAPorter(ouverts: readonly { recompense: Recompense; par: string }[]): ObjetAPorter[] {
  const vus = new Set<string>()
  const objets: ObjetAPorter[] = []
  for (const { recompense: r, par } of ouverts) {
    const piece = PIECE[r.sorte]
    if (!piece || vus.has(`${piece}:${r.cle}`)) continue
    vus.add(`${piece}:${r.cle}`)
    objets.push({ piece, cle: r.cle, nom: r.nom, par })
  }
  return objets
}

/**
 * Ce que des trophées tombés ouvrent à porter. Seuls les paliers le disent à
 * coup sûr : ils ne tombent qu'une fois, ce qu'ils ouvrent est neuf. Un
 * exploit qui se regagne n'ouvre quelque chose qu'à un nombre de fois que la
 * fin ne connaît pas (`ceQuIlOuvre`) — annoncé, il l'aurait été deux fois.
 */
export function aPorterDesTrophees(cles: readonly string[]): ObjetAPorter[] {
  return objetsAPorter(
    cles.flatMap(cle => {
      const p = palierDe(cle)
      return p ? ceQuIlOuvre(cle).map(recompense => ({ recompense, par: titreDePalier(p.hautFait, p.palier) })) : []
    }),
  )
}
