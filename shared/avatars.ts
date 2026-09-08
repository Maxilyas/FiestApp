// Les avatars proposés à l'inscription, et le nettoyage de ce qui arrive du
// téléphone. Partagé : le serveur ne fait confiance à rien de ce qu'il reçoit,
// mais il doit proposer exactement la même liste que l'écran d'inscription.

// Tous antérieurs à Unicode 13 : les emojis récents s'affichent en carré vide
// sur Windows 10, qui pilote l'écran commun.
export const AVATARS = [
  '🦊', '🐸', '🦄', '🐙', '🐼', '🐯',
  '🦁', '🐨', '🐷', '🐶', '🐱', '🐵',
  '🦉', '🦖', '🍕', '🌮', '🍩', '🎸',
  '🚀', '⚽', '🎲', '👑', '🌵', '🍉',
]

export const DEFAULT_AVATAR = '🎉'
export const MAX_NAME_LENGTH = 24

/** Caractères de contrôle et de mise en forme invisibles : rien à faire sur un mur. */
const INVISIBLE = /[\p{Cc}\p{Cf}]/gu

/**
 * Un avatar est un emoji de la liste, ou à défaut quelques caractères : un
 * script de test envoie « 📱 », ça reste lisible. Au-delà de quatre points de
 * code, ce n'est plus un avatar mais une charge utile qui casse la mise en
 * page de l'écran commun et gonfle chaque diffusion à toute la salle.
 */
export function cleanAvatar(raw: unknown): string {
  if (typeof raw !== 'string') return DEFAULT_AVATAR
  if (AVATARS.includes(raw)) return raw
  const short = Array.from(raw.replace(INVISIBLE, '').trim()).slice(0, 4).join('')
  return short || DEFAULT_AVATAR
}

/** Un prénom sans caractères invisibles ni espaces en rafale, borné en longueur. */
export function cleanName(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw.replace(INVISIBLE, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH).trim()
}
