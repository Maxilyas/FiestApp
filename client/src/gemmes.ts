import type { CSSProperties } from 'react'
import type { RareteDeTheme } from '../../shared/themes'

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
