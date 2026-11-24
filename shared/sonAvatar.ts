// Un joueur n'a qu'un avatar : son emoji, ou ce qui le remplace — un
// légendaire, un portrait, un compagnon, un Divin. Le propriétaire, le
// 14 octobre 2026 : « il y a encore une confusion entre emoji et légendaire,
// maintenant cela doit être une seule entité » — il portait un légendaire, et
// la rangée des bordures de la loge, les albums des finitions et des
// bordures de « Ma collection » le montraient en emoji. Ce module dit, pour
// les écrans qui le dessinent, ce qu'il porte.

import { cibleEclat, eclatEnReserveDOffice } from './legendaires'
import { eclatChez, type PublicProfile } from './profil'
import type { EclatPorte } from './matieres'

/** Ce qu'il faut savoir d'un profil pour dessiner son avatar. */
export type CeQuIlPorte = Pick<PublicProfile, 'avatar' | 'legendaire' | 'eclats' | 'eclatsEteints' | 'matieres' | 'matieresPortees'>

/** Les propriétés de `Avatar` : l'emoji dessous, ce qui le remplace, son Éclat. */
export interface SonAvatar {
  avatar: string
  legendaire?: string
  /** Sa version rare, la matière qu'il en porte, ou rien. */
  eclat: false | EclatPorte
}

/**
 * Son avatar, tel qu'il le porte : l'emoji dessous — il tient la place le
 * temps que le dessin arrive —, ce qui le remplace, et l'Éclat s'il brille
 * sur lui (`cibleEclat` : sur ce qu'il porte, l'emoji sous un Divin).
 */
export function sonAvatar(p: CeQuIlPorte): SonAvatar {
  return { avatar: p.avatar, ...(p.legendaire && { legendaire: p.legendaire }), eclat: eclatChez(p, cibleEclat(p.legendaire, p.avatar)) }
}

/**
 * Ce sur quoi un Éclat se montre dans un aperçu — le présentoir de la
 * boutique — : son avatar. Sous un Divin, qui n'éclate pas, rien : l'aperçu
 * se tait, plutôt que de faire briller l'emoji d'un avatar qu'il ne porte
 * pas ; sur l'avatar par défaut non plus, qu'aucun Éclat ne fait éclater
 * (`eclatEnReserveDOffice`, le 24 novembre 2026). L'aperçu d'une finition ou
 * d'une bordure, lui, entoure ce qu'il porte, Divin compris, depuis le
 * 22 novembre 2026 (`sonAvatar`).
 */
export function avatarQuiEclate(p: CeQuIlPorte): SonAvatar {
  return eclatEnReserveDOffice(p.legendaire, p.avatar) ? { avatar: '', eclat: false } : sonAvatar(p)
}
