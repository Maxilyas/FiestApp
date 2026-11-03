// Les matières de l'Éclat (le choix du propriétaire du 3 novembre 2026, sa
// maquette « Les matières de l'Éclat ») : l'Éclat rend un avatar rare, et
// chaque Éclat de plus sur le même avatar le taille dans une matière —
// porcelaine, corail, jade, obsidienne —, qu'il porte s'il la préfère. Les
// quatre réunies sur un même avatar ouvrent l'Opale, qu'aucun Éclat ne donne
// directement. « Quand on l'aime bien, on va vouloir des versions
// différentes » : la rareté reste celle de l'Éclat — une matière, un Éclat.
//
// Rien à repeindre : une matière est une carte de couleurs posée sur le
// dessin — sa lumière devient la matière, du sombre au clair, comme le ciel
// rare d'un portrait (`Portrait.tsx`) —, la même pour un emoji, un
// légendaire ou un portrait. Ni un compagnon, dont l'Éclat passe le monde
// sous son ciel rare et ouvre la métamorphose, une forme de plus
// (`Compagnon.tsx`), ni un Divin, qui n'éclate jamais (invariant 21)
// (`peutSeTailler`).
//
// Les noms sont pris ailleurs que dans l'application : « Givre » est la
// bordure du platine, « Braises » un thème, le saphir, l'améthyste et l'ambre
// les pierres du niveau.
//
// Léger, sans catalogue : l'avatar le lit dans chaque page, la soirée
// comprise.

import { divin } from './divins'
import { formeDeCompagnon } from './compagnons'

/** Les quatre matières qu'un Éclat taille, dans l'ordre où la loge les montre. */
export const MATIERES_A_TAILLER = ['porcelaine', 'corail', 'jade', 'obsidienne'] as const
export type MatiereTaillee = (typeof MATIERES_A_TAILLER)[number]

/** La cinquième : les quatre réunies l'ouvrent (`matieresOuvertes`). */
export const OPALE = 'opale' as const
export type Matiere = MatiereTaillee | typeof OPALE

/** Toutes, l'Opale au bout. */
export const MATIERES: readonly Matiere[] = [...MATIERES_A_TAILLER, OPALE]

/** Combien de matières d'un même avatar ouvrent l'Opale : les quatre. */
export const MATIERES_POUR_L_OPALE = MATIERES_A_TAILLER.length

/**
 * Ce qui brille sur un avatar éclaté : sa version rare (`true`), ou la
 * matière qu'il porte. Tout ce qui recopie l'Éclat d'un joueur recopie cette
 * valeur telle quelle — une ligne qui écrirait `true` lui ôterait sa matière.
 */
export type EclatPorte = true | Matiere

export const NOM_DE_LA_MATIERE: Record<Matiere, string> = {
  porcelaine: 'Porcelaine',
  corail: 'Corail',
  jade: 'Jade',
  obsidienne: 'Obsidienne',
  opale: 'Opale',
}

/** Dans une phrase : « le Phénix en jade », « taillé en obsidienne ». */
export const enMatiere = (m: Matiere) => `en ${NOM_DE_LA_MATIERE[m].toLowerCase()}`

export const estUneMatiere = (x: unknown): x is Matiere => typeof x === 'string' && (MATIERES as readonly string[]).includes(x)
export const estUneMatiereATailler = (x: unknown): x is MatiereTaillee => typeof x === 'string' && (MATIERES_A_TAILLER as readonly string[]).includes(x)

/**
 * La couleur de chaque matière, du sombre au clair : la lumière du dessin
 * s'y lit (`tablesDeLaMatiere`). Ce sont celles de la maquette validée.
 */
export const PALETTES: Record<Matiere, readonly [string, string, string, string, string]> = {
  porcelaine: ['#0a1630', '#24508f', '#7fb6e6', '#dff2ff', '#ffffff'],
  corail: ['#1a0607', '#6f1914', '#d4472a', '#ff9a6b', '#ffeede'],
  jade: ['#03140e', '#0d4a33', '#2a946c', '#97dcbc', '#f0fff7'],
  obsidienne: ['#050308', '#1d1430', '#4b3a86', '#a99ae0', '#f2eeff'],
  opale: ['#120c26', '#2f5aa8', '#c27fd0', '#ffd9a8', '#ffffff'],
}

/** La lumière d'un pixel, en sRGB : la colonne de `feColorMatrix` qui passe le dessin en gris. */
export const MATRICE_DE_LA_LUMIERE = '.2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 0 0 0 1 0'

/**
 * Les trois tables de la matière — rouge, vert, bleu —, pour les
 * `feFuncR`, `feFuncG` et `feFuncB` d'un `feComponentTransfer` posé après
 * `MATRICE_DE_LA_LUMIERE` : le gris du dessin devient la matière.
 */
export function tablesDeLaMatiere(m: Matiere): [string, string, string] {
  const canal = (k: number) => PALETTES[m].map(hex => (parseInt(hex.slice(1 + 2 * k, 3 + 2 * k), 16) / 255).toFixed(3)).join(' ')
  return [canal(0), canal(1), canal(2)]
}

// ── Ce qui se taille, et comment on le range ─────────────────────────────

/**
 * Un avatar qui prend une matière : celui qui a une version rare à choisir —
 * un emoji, un légendaire, un portrait. Un compagnon, non : l'Éclat ne change
 * pas son dessin, il lui ouvre sa métamorphose. Un Divin n'éclate jamais.
 */
export function peutSeTailler(cle: string): boolean {
  return !!cle && !divin(cle) && !formeDeCompagnon(cle)
}

/**
 * Une matière taillée se range dans `profile_eclats` comme l'Éclat qui l'a
 * taillée : la ligne de la réserve prend cette clé (`matiere:jade:lg:phenix`),
 * garde sa soirée, et suit son sort — une soirée effacée reprend la matière
 * avec l'Éclat.
 */
export const PREFIXE_DE_LA_MATIERE = 'matiere:'

export const cleDeMatiere = (m: MatiereTaillee, avatar: string) => `${PREFIXE_DE_LA_MATIERE}${m}:${avatar}`

export const estUneLigneDeMatiere = (cle: string) => cle.startsWith(PREFIXE_DE_LA_MATIERE)

/** La matière et l'avatar d'une clé de `profile_eclats`, ou null : ce n'est pas une matière. */
export function lireCleDeMatiere(cle: string): { matiere: MatiereTaillee; avatar: string } | null {
  if (!estUneLigneDeMatiere(cle)) return null
  const reste = cle.slice(PREFIXE_DE_LA_MATIERE.length)
  const deux = reste.indexOf(':')
  const matiere = reste.slice(0, deux)
  const avatar = reste.slice(deux + 1)
  return deux > 0 && avatar && estUneMatiereATailler(matiere) ? { matiere, avatar } : null
}

/**
 * Ce qu'il peut porter d'un avatar, ses matières taillées en main : elles,
 * dans l'ordre de la loge, et l'Opale quand les quatre sont là.
 */
export function matieresOuvertes(taillees: Iterable<string>): Matiere[] {
  const siennes = new Set(taillees)
  const ouvertes: Matiere[] = MATIERES_A_TAILLER.filter(m => siennes.has(m))
  if (ouvertes.length === MATIERES_POUR_L_OPALE) ouvertes.push(OPALE)
  return ouvertes
}

/** Peut-il porter cette matière sur cet avatar, ses matières taillées en main ? */
export const matiereOuverte = (taillees: Iterable<string>, m: Matiere) => matieresOuvertes(taillees).includes(m)

/** Celles qu'un Éclat peut encore tailler sur cet avatar. */
export const matieresATailler = (taillees: Iterable<string>): MatiereTaillee[] => {
  const siennes = new Set(taillees)
  return MATIERES_A_TAILLER.filter(m => !siennes.has(m))
}
