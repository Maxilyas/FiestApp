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

/**
 * Coupe un texte à `max` points de code sans jamais couper un caractère : ni
 * une paire de substitution — `slice` compte en unités UTF-16, et « …X🎉 »
 * coupé au 24ᵉ gardait une moitié d'emoji, affichée « � » sur le mur —, ni,
 * quand le moteur sait les reconnaître, un emoji composé : un drapeau, un
 * pouce et sa couleur de peau partent ensemble ou pas du tout.
 *
 * La borne compte des points de code, pas des graphèmes : un seul graphème
 * peut empiler des dizaines d'accents, et c'est la longueur réelle qu'on
 * borne — celle qui part à toute la salle à chaque diffusion.
 */
export function tronquer(texte: string, max: number): string {
  const points = Array.from(texte)
  if (points.length <= max) return texte
  // Absent de quelques navigateurs anciens : on coupe alors par points de
  // code, ce qui ne laisse jamais de demi-caractère.
  if (typeof Intl.Segmenter !== 'function') return points.slice(0, max).join('')
  let garde = ''
  let compte = 0
  for (const { segment } of new Intl.Segmenter('fr', { granularity: 'grapheme' }).segment(texte)) {
    const n = Array.from(segment).length
    if (compte + n > max) break
    garde += segment
    compte += n
  }
  // Un premier graphème plus long que la borne à lui seul (une lettre sous
  // trente accents) : on le coupe plutôt que de tout perdre.
  return garde || points.slice(0, max).join('')
}

/** Un prénom sans caractères invisibles ni espaces en rafale, borné en longueur. */
export function cleanName(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return tronquer(raw.replace(INVISIBLE, '').replace(/\s+/g, ' ').trim(), MAX_NAME_LENGTH).trim()
}
