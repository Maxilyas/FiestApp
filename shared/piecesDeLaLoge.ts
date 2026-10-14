// Les six pièces de la loge, sans rien d'autre : la page du profil les montre
// dès qu'elle a le profil — sa carte et sa rangée —, avant que les règles de
// l'essai (`shared/loge.ts`, qui tire tous les catalogues) n'arrivent avec
// ses panneaux. Dans `shared/loge.ts`, elles faisaient attendre toute la
// carte au profil qui s'ouvre.

export type PieceDeLaLoge = 'avatar' | 'titre' | 'vitrine' | 'fond' | 'theme' | 'gerbe'

/**
 * Les six pièces, dans l'ordre de leur rangée : ce que la salle voit d'abord,
 * puis ce que lui seul voit. `qui` le redit sous la rangée, en une ligne :
 * qui le voit, et où.
 */
export const PIECES_DE_LA_LOGE: readonly { id: PieceDeLaLoge; nom: string; groupe: 'salle' | 'moi'; qui: string }[] = [
  { id: 'avatar', nom: 'Avatar', groupe: 'salle', qui: 'La salle le voit, à côté de ton prénom.' },
  { id: 'titre', nom: 'Titre', groupe: 'salle', qui: 'Sous ton prénom, sur ta carte.' },
  { id: 'vitrine', nom: 'Vitrine', groupe: 'salle', qui: 'Trois trophées, sur ta carte.' },
  { id: 'fond', nom: 'Fond', groupe: 'salle', qui: 'Derrière ta carte : rien d’autre ne change.' },
  { id: 'theme', nom: 'Thème', groupe: 'moi', qui: 'Toi seul le vois : il habille tes pages.' },
  { id: 'gerbe', nom: 'Gerbe', groupe: 'moi', qui: 'Toi seul la vois, à tes bonnes réponses.' },
]

export function estUnePieceDeLaLoge(x: unknown): x is PieceDeLaLoge {
  return PIECES_DE_LA_LOGE.some(p => p.id === x)
}

// ── Ce qu'il a déjà vu, et ce qui est nouveau ────────────────────────────
// Ici plutôt que dans `shared/loge.ts` : la barre du menu compte les
// nouveautés sur chaque page du profil, et n'a que faire des catalogues.

/**
 * Ce que le profil a déjà vu de chaque pièce, retenu par le serveur
 * (`profile_loge_vus`) : vu sur l'ordinateur, il ne se redit pas sur le
 * téléphone. Une pièce absente n'a jamais été vue : rien n'y est nouveau.
 */
export type VusDeLaLoge = Partial<Record<PieceDeLaLoge, readonly string[]>>

/** Ce que comptent la barre du menu et « M'habiller » (`GET /api/joueur/nouveautes`). */
export interface NouveautesDeLaLoge {
  /** Ce qui est neuf, toutes pièces ensemble — un haut fait neuf, titre et vitrine à la fois, ne compte qu'une fois. */
  nouveautes: number
  /** Pièce par pièce, celles qui ont du neuf. */
  pieces: Partial<Record<PieceDeLaLoge, number>>
}

/**
 * Bien plus de clés qu'aucune pièce n'en aura (deux cent cinquante avatars au
 * plus, le 14 octobre 2026), et pas plus longues qu'aucune : ce qu'une page
 * envoie à retenir n'emplit pas la base.
 */
export const CLES_VUES_MAX = 600
const LONGUEUR_D_UNE_CLE_MAX = 80

/**
 * Ce qui arrive d'une page ou de la base, réduit à ce qu'une loge retient :
 * ses six pièces, des clés en texte. null si rien ne s'y lit.
 */
export function lireLesVus(brut: unknown): VusDeLaLoge | null {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return null
  const vus: { [P in PieceDeLaLoge]?: string[] } = {}
  for (const { id } of PIECES_DE_LA_LOGE) {
    const liste = (brut as Record<string, unknown>)[id]
    if (!Array.isArray(liste)) continue
    const cles = liste.filter((k): k is string => typeof k === 'string' && k.length > 0 && k.length <= LONGUEUR_D_UNE_CLE_MAX)
    vus[id] = [...new Set(cles)].slice(0, CLES_VUES_MAX)
  }
  return Object.keys(vus).length > 0 ? vus : null
}

/** Ce qui est neuf, compté : la pastille rouge du menu, de « M'habiller » et de chaque pièce. */
export function compteDesNouveautes(neufs: Readonly<Record<PieceDeLaLoge, readonly string[]>>): NouveautesDeLaLoge {
  const pieces: Partial<Record<PieceDeLaLoge, number>> = {}
  const toutes = new Set<string>()
  for (const { id } of PIECES_DE_LA_LOGE) {
    const cles = neufs[id] ?? []
    if (cles.length > 0) pieces[id] = cles.length
    for (const k of cles) toutes.add(k)
  }
  return { nouveautes: toutes.size, pieces }
}

/** Ce que la pastille dit au lecteur d'écran : « 3 nouveautés à porter ». */
export function nouveautesAPorter(n: number): string {
  return `${n} nouveauté${n > 1 ? 's' : ''} à porter`
}

/** La première pièce, dans l'ordre de la rangée, qui a du neuf : « M'habiller » y ouvre la loge. */
export function premierePieceNeuve(compte: NouveautesDeLaLoge): PieceDeLaLoge | null {
  return PIECES_DE_LA_LOGE.find(p => (compte.pieces[p.id] ?? 0) > 0)?.id ?? null
}
