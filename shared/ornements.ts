// Sa niche, sur la durée (le choix du 19 octobre 2026,
// `retours/2026-10-16/compagnon/principe.md`, § 4) : après sa forme ultime
// — 500 bonnes réponses données avec lui —, ce n'est plus lui qui change,
// c'est sa niche qui s'embellit, palier par palier, et garde chaque ornement
// gagné : la même niche, au même coin, un peu plus belle chaque fois. Jusque-là,
// sa jauge s'arrêtait à la forme ultime, et plus rien ne se gagnait avec lui.
//
// Les paliers sont recalés sur le rythme mesuré en production (lecture
// seule, le 18 octobre 2026 : 26 profils sur 23 jours, des bonnes réponses en
// solo par semaine — médiane 52, troisième quartile 244, neuvième décile
// 511) : la guirlande en six semaines au troisième quartile, la légende en
// deux ans. Des choix de produit, comme les formes (`JUSTES_DES_FORMES`).
//
// Ils appartiennent à chaque compagnon : c'est celui de la niche qui avance —
// une raison de lui rester fidèle —, et un palier atteint ne se perd jamais
// (`profile_compagnons.paliers` ne fait que monter, même quand une soirée
// retirée reprend des bonnes réponses). Chaque ornement gagné se montre
// d'office ; on choisit lesquels montrer, et comment (le propriétaire, le
// même jour : « Dessinés comme sur la maquette, sans peinture payante et aussi
// des versions vraiment très jolies avec des peintures payantes de différents
// styles. On choisit lesquels montrer ») : peint — d'office —, dessiné, ou
// caché. Dessinés d'après la maquette (`components/Ornements.tsx`,
// `retours/2026-10-16/compagnon/maquette/paliers.js`), peints par la chaîne
// des ornements (`server/scripts/anime/ornements.ts`) dans le style que le
// propriétaire a choisi sur la planche de l'essai, le Féerique (le 20 octobre
// 2026).
//
// Comme tout ce qui se porte, un ornement ne donne AUCUN avantage de jeu.

import { JUSTES_DES_FORMES } from './compagnons'

/** Les bonnes réponses données avec lui qui embellissent sa niche, après sa forme ultime (500). */
export const PALIERS_DE_LA_NICHE = [1500, 4000, 10000, 25000] as const

export type CleDOrnement = 'guirlande' | 'lierre' | 'arche' | 'halo'

export interface Ornement {
  key: CleDOrnement
  /** Son palier, de 1 à 4 : il s'ouvre quand la niche en a atteint autant. */
  palier: number
  /** Les bonnes réponses données avec lui qui l'ouvrent (`PALIERS_DE_LA_NICHE`). */
  justes: number
  /** Ce qu'ils sont devenus l'un pour l'autre, à ce palier : le titre de leur amitié. */
  titre: string
  /** Ce qui embellit sa niche, à écrire dans une phrase : « une guirlande de petites lampes ». */
  nom: string
}

/** Les quatre ornements, dans l'ordre de leurs paliers : les noms de la maquette que le propriétaire a vue. */
export const ORNEMENTS: readonly Ornement[] = (
  [
    ['guirlande', 'Amis pour la vie', 'une guirlande de petites lampes'],
    ['lierre', 'Complices', 'du lierre et des fleurs au rebord'],
    ['arche', 'Inséparables', 'l’arche dorée et son étoile'],
    ['halo', 'Légende', 'un halo, et son ciel qui scintille'],
  ] as const
).map(([key, titre, nom], i) => ({ key, palier: i + 1, justes: PALIERS_DE_LA_NICHE[i], titre, nom }))

const PAR_CLE = new Map(ORNEMENTS.map(o => [o.key as string, o]))

/** L'ornement de cette clé (`guirlande`) ; rien pour une autre. */
export function ornement(cle: unknown): Ornement | undefined {
  return typeof cle === 'string' ? PAR_CLE.get(cle) : undefined
}

/**
 * Les styles peints : chacun ses calques, peints et livrés par la chaîne des
 * ornements (`client/src/components/ornements-peints.ts`). Un style de plus
 * s'y ajoute, peint pour les quatre.
 */
export const STYLES_PEINTS = ['feerique'] as const

export type StylePeint = (typeof STYLES_PEINTS)[number]

/** Comment sa niche montre un ornement qu'il a gagné : peint, dessiné comme sur la maquette, ou caché. */
export type StyleDOrnement = StylePeint | 'dessin' | 'cache'

/** Les styles, dans l'ordre où « Sa niche s'embellit » les propose : les versions peintes, le dessin, rien. */
export const STYLES_D_ORNEMENT: readonly StyleDOrnement[] = [...STYLES_PEINTS, 'dessin', 'cache']

/** Ce que chaque style s'appelle, sous son aperçu. */
export const NOM_DU_STYLE: Readonly<Record<StyleDOrnement, string>> = { feerique: 'Féerique', dessin: 'Dessin', cache: 'Caché' }

/** Un style qui le montre. */
export type StyleMontre = Exclude<StyleDOrnement, 'cache'>

/**
 * D'office : peint, en Féerique — « des versions vraiment très jolies » ; le
 * dessin, plus léger, se choisit. Seul ce qui s'en écarte se retient
 * (`ReglageDesOrnements`).
 */
export const STYLE_D_OFFICE: StyleMontre = 'feerique'

/** Ce qu'il a réglé de ses ornements, quand ce n'est pas le style d'office : `{ guirlande: 'cache' }`. */
export type ReglageDesOrnements = Partial<Record<CleDOrnement, StyleDOrnement>>

/** Combien de paliers de sa niche ces bonnes réponses, données avec lui, font atteindre : de 0 à 4. */
export function paliersDeLaNicheAtteints(justes: number): number {
  return PALIERS_DE_LA_NICHE.filter(seuil => justes >= seuil).length
}

/**
 * Le prochain ornement de sa niche et ce qui reste pour l'atteindre ; null
 * quand elle les a tous. Avant sa forme ultime, c'est le premier : la fiche
 * l'annonce.
 */
export function prochainOrnement(a: { paliers?: number; justes: number }): { ornement: Ornement; encore: number } | null {
  const suivant = ORNEMENTS[a.paliers ?? 0]
  return suivant ? { ornement: suivant, encore: Math.max(0, suivant.justes - a.justes) } : null
}

/**
 * Ce qu'il a réglé de ses ornements, relu d'où qu'il vienne — la base, un
 * corps de requête, le stockage du téléphone : un ornement ou un style
 * inconnus ne passent pas, et le style d'office ne se retient pas.
 */
export function lireLesOrnements(brut: unknown): ReglageDesOrnements {
  let objet = brut
  if (typeof brut === 'string') {
    try {
      objet = JSON.parse(brut)
    } catch {
      return {}
    }
  }
  if (!objet || typeof objet !== 'object' || Array.isArray(objet)) return {}
  const lu: ReglageDesOrnements = {}
  for (const [cle, style] of Object.entries(objet)) {
    const o = ornement(cle)
    if (o && style !== STYLE_D_OFFICE && STYLES_D_ORNEMENT.includes(style as StyleDOrnement)) lu[o.key] = style as StyleDOrnement
  }
  return lu
}

/**
 * Le style d'un ornement, d'après ce qu'il a réglé : un style qui n'existe
 * pas — ou plus, ou d'une page d'avant — reprend celui d'office.
 */
export function styleDeLOrnement(ornements: Readonly<Partial<Record<string, string>>> | undefined, cle: CleDOrnement): StyleDOrnement {
  const regle = ornements?.[cle]
  return STYLES_D_ORNEMENT.includes(regle as StyleDOrnement) ? (regle as StyleDOrnement) : STYLE_D_OFFICE
}

/** Un ornement que sa niche montre, et comment. */
export interface OrnementMontre {
  cle: CleDOrnement
  style: StyleMontre
}

/**
 * Les ornements que sa niche montre, dans l'ordre de leurs paliers, chacun
 * dans son style : ceux qu'il a atteints, sauf ceux qu'il a cachés.
 */
export function ornementsMontres(a: { paliers?: number; ornements?: Readonly<Partial<Record<string, string>>> }): OrnementMontre[] {
  return ORNEMENTS.filter(o => o.palier <= (a.paliers ?? 0)).flatMap(o => {
    const style = styleDeLOrnement(a.ornements, o.key)
    return style === 'cache' ? [] : [{ cle: o.key, style }]
  })
}

/**
 * Le prochain but de qui vit dans sa niche, en bonnes réponses données avec
 * lui : sa forme suivante, puis, après sa forme ultime, le palier suivant de
 * sa niche — sa jauge ne s'arrête plus (le propriétaire, le 19 octobre 2026 :
 * « la jauge vise le palier suivant au lieu de s'arrêter »). Null quand sa
 * niche a tout.
 */
export function prochainSeuil(a: { rang: number; paliers?: number }): number | null {
  return JUSTES_DES_FORMES[a.rang + 1] ?? ORNEMENTS[a.paliers ?? 0]?.justes ?? null
}

/** Le titre de leur amitié : celui du plus haut palier atteint (« Complices ») ; rien avant le premier. */
export function titreDeLAmitie(paliers: number | undefined): string | undefined {
  return paliers ? ORNEMENTS[Math.min(paliers, ORNEMENTS.length) - 1]?.titre : undefined
}
