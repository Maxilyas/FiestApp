// Un joueur n'a qu'un avatar : son emoji, ou ce qui le remplace — un
// légendaire, un portrait, un compagnon, un Divin. Le propriétaire, le
// 14 octobre 2026 : « il y a encore une confusion entre emoji et légendaire,
// maintenant cela doit être une seule entité » — il portait un légendaire, et
// la rangée des bordures de la loge, les albums des finitions et des
// bordures de « Ma collection » le montraient en emoji. Ce module dit, pour
// les écrans qui le dessinent, ce qu'il porte.

import { divin } from './divins'
import { cibleEclat } from './legendaires'
import { brilleChez, type PublicProfile } from './profil'

/** Ce qu'il faut savoir d'un profil pour dessiner son avatar. */
export type CeQuIlPorte = Pick<PublicProfile, 'avatar' | 'legendaire' | 'eclats' | 'eclatsEteints'>

/** Les propriétés de `Avatar` : l'emoji dessous, ce qui le remplace, son Éclat. */
export interface SonAvatar {
  avatar: string
  legendaire?: string
  eclat: boolean
}

/**
 * Son avatar, tel qu'il le porte : l'emoji dessous — il tient la place le
 * temps que le dessin arrive —, ce qui le remplace, et l'Éclat s'il brille
 * sur lui (`cibleEclat` : sur ce qu'il porte, l'emoji sous un Divin).
 */
export function sonAvatar(p: CeQuIlPorte): SonAvatar {
  return { avatar: p.avatar, ...(p.legendaire && { legendaire: p.legendaire }), eclat: brilleChez(p, cibleEclat(p.legendaire, p.avatar)) }
}

/**
 * Ce qui porte une finition ou une bordure dans un aperçu — la loge, « Ma
 * collection » — : son avatar. Sous un Divin, qui n'en prend aucune, rien :
 * l'aperçu les montre seules, plutôt que l'emoji d'un avatar qu'il ne porte
 * pas.
 */
export function avatarDeLApercu(p: CeQuIlPorte): SonAvatar {
  return divin(p.legendaire) ? { avatar: '', eclat: false } : sonAvatar(p)
}
