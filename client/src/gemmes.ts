import type { CSSProperties } from 'react'
import type { RareteDeTheme } from '../../shared/themes'
import type { RareteDAvatar } from '../../shared/album'

// La couleur de chaque rareté — sa gemme —, à part de la boutique : la fin
// d'une partie cercle ses trophées de la même couleur que l'album, sans
// télécharger toute la boutique avec le quiz du jour.

/** La couleur de chaque rareté : sa gemme, le bord de ses cartes, son prix. Jamais un texte long. */
const GEMMES: Record<RareteDeTheme, string> = {
  offert: '#d9b56a',
  commune: '#a8b3bf',
  peucommune: '#6fcf8a',
  rare: '#5fa8ff',
  epique: '#b77bff',
  legendaire: '#f2b84b',
}

export const gemme = (r: RareteDeTheme) => ({ '--gemme': GEMMES[r] }) as CSSProperties

/**
 * La gemme d'une carte ou d'un joker maudit : un rouge sombre. Elle prenait
 * le pourpre de l'épique tant que les cartes n'avaient pas d'épique ; depuis
 * le jeu complet de l'Expédition (le 19 octobre 2026), une maudite qui
 * ressemblerait à une épique se prendrait pour une récompense.
 */
export const GEMME_MAUDITE = { '--gemme': '#d4506e' } as CSSProperties

/**
 * La gemme d'un avatar : celles des thèmes, une opale pour les Divins, que
 * la feuille irise, et une pierre grise pour les emojis de l'inscription, à
 * tout le monde : l'or des thèmes offerts, à côté de la gemme légendaire,
 * se lisait comme elle.
 */
export const gemmeDAvatar = (r: RareteDAvatar | 'offert'): CSSProperties =>
  r === 'divin' ? ({ '--gemme': '#c9b6ff' } as CSSProperties) : r === 'offert' ? ({ '--gemme': '#9a8f84' } as CSSProperties) : gemme(r)
