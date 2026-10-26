// Ce qui réveille un gardien, en mots — pur et léger : la page du musée le lit
// sans télécharger l'annonce elle-même (`Reveil.tsx`, à la demande), ni les
// cartes qu'elle fait venir. Deux réveils qui se suivent avant qu'on ait lu le
// premier se fondent par la règle du serveur (`fondreLesReveils`,
// `shared/cabinet/vues.ts`) : la page en avait ici sa copie.
//
// Un gardien se réveille d'une salle complète, d'une salle toute dorée, du
// Cabinet entier, de trente jours d'affilée, ou d'une œuvre gagnée pendant sa
// fête (`GARDIENS_DES_SALLES`, `AUTRES_GARDIENS`). Neuf, il s'annonce en grand ;
// déjà à lui par une autre voie, il « veillait déjà » (le serveur le dit :
// `ReveilDesGardiens`, `neuf`). La phrase dit ce qui l'a réveillé : « Salle
// complète ! » s'écrivait pour tout gardien qui veillait déjà, le Scarabée de
// trente jours d'affilée compris.

import { JOURS_DU_SCARABEE } from '../../../../shared/cabinet/bareme'
import { AUTRES_GARDIENS, GARDIENS_DES_SALLES, salleDuGardien } from '../../../../shared/cabinet/salles'
import { legendaire } from '../../../../shared/legendaires'
import { SAISONS } from '../../../../shared/saisons'

/** Ce qui l'a réveillé, et sur quoi il veille : la salle, le Cabinet, toi. */
function raison(cle: string): { cause: string; sur: 'elle' | 'lui' | 'toi' } | null {
  const s = salleDuGardien(cle)
  if (s) return GARDIENS_DES_SALLES[s][0] === cle ? { cause: 'Salle complète !', sur: 'elle' } : { cause: 'Salle toute dorée !', sur: 'elle' }
  const reveil = AUTRES_GARDIENS.find(a => a.legendaire === cle)?.reveil
  if (!reveil) return null
  if ('tout' in reveil) return { cause: 'Le Cabinet entier !', sur: 'lui' }
  if ('serie' in reveil) return { cause: `${JOURS_DU_SCARABEE} jours d’affilée !`, sur: 'toi' }
  const fete = SAISONS.find(x => x.key === reveil.saison)
  return fete ? { cause: `Une œuvre gagnée pendant ${fete.nom} !`, sur: 'toi' } : null
}

/** Ce qui a réveillé ce gardien, en une exclamation ; null pour ce qui n'en est pas un — un légendaire de palier, un Divin. */
export const ceQuiLeReveille = (cle: string): string | null => raison(cle)?.cause ?? null

const nomDe = (cle: string) => legendaire(cle)?.nom ?? 'Son gardien'

/** « Salle complète ! Le Phénix veillait déjà sur elle. » : un gardien déjà à lui d'ailleurs, que le Cabinet range sans cérémonie. */
export function veillaitDeja(cle: string): string {
  const r = raison(cle)
  return r ? `${r.cause} ${nomDe(cle)} veillait déjà sur ${r.sur}.` : `${nomDe(cle)} veillait déjà.`
}

/** « Salle complète ! La Chouette d'Argent se réveille. » : la raison d'un gardien neuf, au-dessus de lui en grand. */
export function seReveille(cle: string): string {
  const r = raison(cle)
  return r ? `${r.cause} ${nomDe(cle)} se réveille.` : `${nomDe(cle)} se réveille.`
}
