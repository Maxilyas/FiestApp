// Ce qui réveille un gardien, en mots, et ce que la page garde des réveils à
// dire — pur et léger : la page du musée le lit sans télécharger l'annonce
// elle-même (`Reveil.tsx`, à la demande), ni les cartes qu'elle fait venir.
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
import type { ReveilDesGardiens } from '../../../../shared/cabinet/vues'
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

/**
 * Deux réveils qui se suivent avant qu'on ait lu le premier — la page d'une
 * dépense, puis celle du retour au premier plan, qui dit la partie d'hier
 * close — : les deux, chaque gardien une fois, neuf s'il l'était dans l'un. Le
 * serveur ne le dit qu'une fois : la page le garde jusqu'à ce qu'on le ferme.
 */
export function fondreDesReveils(a: ReveilDesGardiens | null | undefined, b: ReveilDesGardiens | null | undefined): ReveilDesGardiens | null {
  if (!a) return b ?? null
  if (!b) return a
  const neufs = new Map<string, boolean>()
  for (const g of [...a.gardiens, ...b.gardiens]) neufs.set(g.legendaire, (neufs.get(g.legendaire) ?? false) || g.neuf)
  const compagnon = a.compagnon ?? b.compagnon
  return { gardiens: [...neufs].map(([legendaire, neuf]) => ({ legendaire, neuf })), ...(compagnon && { compagnon }) }
}
