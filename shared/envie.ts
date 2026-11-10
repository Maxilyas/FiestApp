// « Mon envie » : l'article de la boutique pour lequel on économise (le
// 10 novembre 2026, la maquette validée par le propriétaire —
// `retours/2026-11-10/boutique/`). La plupart des visites à la boutique se
// font sans de quoi acheter : un confetti par bonne réponse, des thèmes de
// 150 à 1000. On y choisit ce qu'on vise, et la boutique dit, en tête, ce qui
// manque encore.
//
// Une envie à la fois, sur n'importe quel article qui se vend : un thème, un
// compagnon, un fond des savoirs, un objet du comptoir. Elle ne donne rien et
// ne réserve rien — un choix, comme un titre — et se relit à chaque
// affichage : achetée, sortie de sa saison, elle ne se montre plus
// (`envieTenue`), sans qu'on ait rien à effacer.
//
// Pur : le serveur s'en sert pour refuser une envie qui ne tient pas, la
// page pour la montrer.

import { COMPAGNONS_DE_LA_BOUTIQUE, PRIX_D_UN_COMPAGNON } from './compagnons'
import { FONDS_EN_BOUTIQUE, PRIX_D_UN_FOND } from './fonds'
import { PRIX_D_UN_SABLIER } from './jour'
import { PRIX_D_UN_ECLAT } from './profil'
import { PRIX_D_UNE_VIE } from './sentiers'
import { enBoutique, prixDe, theme } from './themes'

export type SorteDEnvie = 'theme' | 'compagnon' | 'fond' | 'objet'

/** Ce qu'il vise : la sorte de l'article, et sa clé dans son catalogue. */
export interface Envie {
  sorte: SorteDEnvie
  cle: string
}

const SORTES: readonly SorteDEnvie[] = ['theme', 'compagnon', 'fond', 'objet']

/** Les objets du comptoir et leur prix : ils se rachètent, on n'en « a » jamais assez pour ne plus en vouloir. */
export const PRIX_DES_OBJETS: Readonly<Record<string, number>> = { vie: PRIX_D_UNE_VIE, sablier: PRIX_D_UN_SABLIER, eclat: PRIX_D_UN_ECLAT }

/** Telle qu'elle s'écrit en base : « theme:aurore ». */
export const ecrireEnvie = (e: Envie): string => `${e.sorte}:${e.cle}`

/**
 * Lire une envie d'où qu'elle vienne — le texte de la base (« theme:aurore »),
 * l'objet qu'envoie la page. Rend null pour tout ce qui n'en a pas la forme :
 * c'est `refusDeLEnvie` qui dit si l'article existe et se vend.
 */
export function lireEnvie(valeur: unknown): Envie | null {
  if (typeof valeur === 'string') {
    const coupe = valeur.indexOf(':')
    return coupe > 0 ? lireEnvie({ sorte: valeur.slice(0, coupe), cle: valeur.slice(coupe + 1) }) : null
  }
  if (!valeur || typeof valeur !== 'object') return null
  const { sorte, cle } = valeur as Record<string, unknown>
  if (typeof sorte !== 'string' || typeof cle !== 'string' || !SORTES.includes(sorte as SorteDEnvie)) return null
  // Une clé de catalogue : des lettres, des chiffres, des traits d'union. Rien d'autre ne va en base.
  if (!/^[a-z0-9-]{1,40}$/.test(cle)) return null
  return { sorte: sorte as SorteDEnvie, cle }
}

/** Son prix ; null quand l'article n'existe pas ou ne se vend pas. */
export function prixDeLEnvie(e: Envie): number | null {
  if (e.sorte === 'theme') {
    const t = theme(e.cle)
    return t && t.rarete !== 'offert' && !t.gagne ? prixDe(t) : null
  }
  if (e.sorte === 'compagnon') return COMPAGNONS_DE_LA_BOUTIQUE.some(c => c.key === e.cle) ? PRIX_D_UN_COMPAGNON : null
  if (e.sorte === 'fond') return FONDS_EN_BOUTIQUE.some(f => f.key === e.cle) ? PRIX_D_UN_FOND : null
  // Par `Object.hasOwn` : « constructor » a la forme d'une clé, et lu tel quel son « prix » était une fonction — l'envie tenait.
  return Object.hasOwn(PRIX_DES_OBJETS, e.cle) ? PRIX_DES_OBJETS[e.cle] : null
}

/** Ce qu'il a déjà de ce que la boutique vend : ses thèmes, ses compagnons, ses fonds. */
export interface CeQuIlADeLaBoutique {
  themes: readonly string[]
  compagnons: readonly string[]
  fonds: readonly string[]
}

/**
 * Pourquoi cette envie ne tient pas, en mots que le joueur lit — null quand
 * elle tient : l'article existe, se vend ce jour-là, et il ne l'a pas.
 */
export function refusDeLEnvie(e: Envie, a: CeQuIlADeLaBoutique, jour: string): string | null {
  if (prixDeLEnvie(e) === null) return 'Cet article ne se vend pas à la boutique : choisis-en un autre.'
  if (e.sorte === 'theme') {
    const t = theme(e.cle)!
    if (a.themes.includes(e.cle)) return `${t.nom} est déjà à toi.`
    if (!enBoutique(t, jour)) {
      // « qu’en février », « que du 25 octobre au 1er novembre » : « que » s'élide devant une voyelle.
      const periode = t.saison?.periode ?? 'pendant sa saison'
      return `${t.nom} n’est en boutique ${/^[aeiouy]/i.test(periode) ? 'qu’' : 'que '}${periode} : choisis-en un autre.`
    }
    return null
  }
  if (e.sorte === 'compagnon') return a.compagnons.includes(e.cle) ? 'Ce compagnon est déjà à toi.' : null
  if (e.sorte === 'fond') return a.fonds.includes(e.cle) ? 'Ce fond est déjà à toi.' : null
  return null
}

/** L'envie qu'on lui montre : celle qu'il a posée, tant qu'elle tient. */
export function envieTenue(e: Envie | null | undefined, a: CeQuIlADeLaBoutique, jour: string): Envie | null {
  return e && refusDeLEnvie(e, a, jour) === null ? e : null
}

/** Où il en est : ce qu'elle coûte, ce qui manque, sa part économisée (de 0 à 100). */
export function ouEnEstLEnvie(e: Envie, solde: number): { prix: number; manque: number; part: number } | null {
  const prix = prixDeLEnvie(e)
  if (prix === null) return null
  const acquis = Math.max(0, Math.min(solde, prix))
  return { prix, manque: Math.max(0, prix - solde), part: Math.floor((100 * acquis) / prix) }
}
