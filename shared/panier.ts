// L'essai de la boutique et son panier (la piste A de la refonte, et le
// panier de la piste B, choisis par le propriétaire le 1er novembre 2026 :
// « J'aimerais […] pouvoir essayer sans acheter pour les éléments qui s'y
// prêtent »). On essaie un thème — toute la page le porte —, un fond — sa
// carte le porte —, un compagnon — il passe dans sa niche —, un de chaque
// sorte à la fois, sans rien écrire ; puis on prend tout d'un coup, ou ce
// qu'on coche. Rien de ce qui se décide ici n'est un prix : chaque achat
// reste compté par le serveur, un à la fois (`unAchatALaFois`), au solde
// qu'il relit — la page ne fait qu'additionner ce qu'elle va demander.

import { COMPAGNONS_DE_LA_BOUTIQUE, PRIX_D_UN_COMPAGNON, compagnon as leCompagnon } from './compagnons'
import { PRIX_D_UN_FOND, fond as leFond } from './fonds'
import { NOM_DE_RARETE, enBoutique, prixDe, theme as leTheme } from './themes'

/** Ce qu'on essaie à la boutique : un thème, un fond, un compagnon — leurs clés, une de chaque sorte au plus. */
export interface EssaiDeLaBoutique {
  theme?: string
  fond?: string
  compagnon?: string
}

export type SorteDEssai = keyof EssaiDeLaBoutique

/** Les sortes, dans l'ordre où le panier les montre et les achète : ce qui habille la page, la carte, puis la niche. */
export const SORTES_DU_PANIER: readonly SorteDEssai[] = ['theme', 'fond', 'compagnon']

/** Une ligne du panier : ce qui s'achète, ce qu'il est, son prix. */
export interface LigneDuPanier {
  sorte: SorteDEssai
  cle: string
  nom: string
  /** Ce qu'il est, en court : « Thème · Rare », « Fond · Musique », « Compagnon ». */
  detail: string
  prix: number
}

/** Ce qu'il a déjà, ce jour-là : un essai de ce qu'il a ne s'achète pas. */
export interface CeQuIlADeja {
  /** Ses thèmes, les offerts compris (`BoutiqueDuProfil.possedes`). */
  themes: readonly string[]
  /** Ses fonds, tous — gagnés, tirés au coffre ou achetés (`PublicProfileDetail.fonds`). */
  fonds: readonly string[]
  /** Les compagnons qu'il a adoptés. */
  compagnons: readonly string[]
  /** Le jour de Paris : un thème de saison ne s'achète que pendant la sienne. */
  jour: string
}

/**
 * Ce que le panier achèterait : ce qu'on essaie et qui se vend encore à lui
 * ce jour-là. Un fond qu'il a déjà s'essaie sur sa carte — le regarder, c'est
 * l'essayer — mais ne s'achète pas : il n'entre pas au panier ; un thème hors
 * de sa saison, un fond du trésor, un compagnon qui se gagnerait non plus.
 */
export function lignesDuPanier(essai: EssaiDeLaBoutique, deja: CeQuIlADeja): LigneDuPanier[] {
  const lignes: LigneDuPanier[] = []
  const t = leTheme(essai.theme)
  if (t && t.rarete !== 'offert' && enBoutique(t, deja.jour) && !deja.themes.includes(t.key)) {
    lignes.push({ sorte: 'theme', cle: t.key, nom: t.nom, detail: `Thème · ${NOM_DE_RARETE[t.rarete]}`, prix: prixDe(t) })
  }
  const f = leFond(essai.fond)
  if (f?.savoir && !deja.fonds.includes(f.key)) {
    lignes.push({ sorte: 'fond', cle: f.key, nom: f.nom, detail: `Fond · ${f.savoir}`, prix: PRIX_D_UN_FOND })
  }
  const c = leCompagnon(essai.compagnon)
  if (c && COMPAGNONS_DE_LA_BOUTIQUE.includes(c) && !deja.compagnons.includes(c.key)) {
    lignes.push({ sorte: 'compagnon', cle: c.key, nom: c.nom, detail: 'Compagnon', prix: PRIX_D_UN_COMPAGNON })
  }
  return lignes
}

/** Ce que coûtent ces lignes ensemble. */
export function totalDuPanier(lignes: readonly LigneDuPanier[]): number {
  return lignes.reduce((total, l) => total + l.prix, 0)
}

/**
 * Ce qui manque à son solde pour ces lignes ; zéro s'il en a de quoi. Un
 * solde sous zéro — une soirée retirée a repris ses confettis — manque d'autant.
 */
export function ceQuiManque(lignes: readonly LigneDuPanier[], solde: number): number {
  return Math.max(0, totalDuPanier(lignes) - solde)
}

/** L'essai sans une sorte : ce qu'on vient de prendre, ou de rendre. */
export function sansLaSorte(essai: EssaiDeLaBoutique, ...sortes: SorteDEssai[]): EssaiDeLaBoutique {
  const reste = { ...essai }
  for (const s of sortes) delete reste[s]
  return reste
}
