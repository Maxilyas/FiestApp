// Les gardiens du Cabinet de curiosités : comment un gardien se réveille.
//
// Un gardien n'est écrit nulle part dans le Cabinet. Ce que le musée lui doit
// se dérive (`gardiensDus`, `shared/cabinet/musee.ts`) — une salle complète
// son premier gardien, tous ses cadres dorés le second, les 84 œuvres le Trou
// noir, trente jours d'affilée le Scarabée, une œuvre gagnée en jouant pendant
// une fête son gardien de saison —, et se compare à ce que l'étagère du profil
// a déjà rangé, en mémoire (`recompensesOf`) : seul ce qui manque se range,
// sous la clé fixe `#cabinet` (`RANGEMENT_DU_CABINET`), la voie de chacun
// (`cabinet:phenix`, `saison:halloween`). Rien de dû et pas rangé — le cas
// ordinaire —, pas un aller-retour : une page, une fin, un achat ne paient
// qu'au changement.
//
// Une ligne rangée ne se reprend jamais (invariant 22) : une œuvre peinte de
// plus dans une salle complète la rouvre sans endormir son gardien. La clé
// fixe rend chaque rangement idempotent par la clé primaire, d'où qu'il vienne
// — la fin d'une partie, un achat, une dorure, la page froide, la migration —,
// et deux serveurs pendant une mise en ligne ne rangent rien deux fois.
//
// Ce que ce fichier annonce, ce sont les clés tout juste rangées
// (`legendairesOuverts`) : un légendaire déjà à lui par une autre voie veille
// déjà — le bilan le dit sans cérémonie —, un neuf s'annonce en grand. La
// luciole rejoint qui complète sa première salle (`offrirUnCompagnon`, qui ne
// change rien la seconde fois) : l'Expédition, qui l'amenait, ne l'amènera plus
// à personne de neuf. Rien d'un Divin, ni ici ni dans ce qu'il annonce
// (invariant 21) : `legendairesOuverts` ne rend que des légendaires.
//
// L'heure est celle du serveur (`quand`), jamais l'horloge de la machine
// (`cabinet-chronos.test.ts`).
import { RANGEMENT_DU_CABINET } from '../../auth/profiles'
import { COMPAGNON_DE_L_EXPEDITION, type CleDeCompagnon } from '../../../../shared/compagnons'
import { gardiensDus, sallesCompletes, type GardienDu, type Musee } from '../../../../shared/cabinet/musee'
import type { ReveilDesGardiens } from '../../../../shared/cabinet/vues'

/**
 * Ce que le Cabinet demande à l'étagère des profils (`ProfileStore`, branché
 * par `server.ts`) pour réveiller ses gardiens. Sans elle — un magasin
 * d'essai, sans profils —, rien ne se range.
 */
export interface EtagereDuCabinet {
  /** Ce qu'il a déjà rangé, et combien de fois — en mémoire. */
  recompensesOf(profileId: string): ReadonlyMap<string, number>
  /** Range des clés sous un rangement, d'un lot ; rend celles qui sont neuves. */
  ranger(profileId: string, sous: string, cles: readonly string[], quand: number): Promise<string[]>
  /** Les légendaires que ces clés, tout juste rangées, viennent d'ouvrir. */
  legendairesOuverts(profileId: string, tombes: readonly string[]): string[]
  /** Offre un compagnon qui ne s'achète pas ; vrai s'il est neuf. */
  offrirUnCompagnon(profileId: string, cle: CleDeCompagnon, quand: number): Promise<boolean>
}

/** Ce qu'une réconciliation a fait : ce qu'elle annonce — rien de neuf, null —, et si un pas a échoué, à refaire. */
export interface IssueDuReveil {
  reveil: ReveilDesGardiens | null
  echec: boolean
}

/** Les gardiens dus dont la voie n'est pas encore rangée, dans leur ordre. */
export const voiesQuiManquent = (dus: readonly GardienDu[], rangees: ReadonlyMap<string, number>): GardienDu[] => dus.filter(d => !rangees.has(d.voie))

/**
 * Réveille ce que le musée doit et que l'étagère n'a pas : ranger ce qui
 * manque, d'un lot, puis offrir la luciole s'il a une salle complète. Chaque
 * pas qui tombe se dit au journal du serveur et laisse passer le suivant :
 * une étagère muette ne fait jamais échouer ce qui la réveillait — la partie
 * est écrite, l'achat payé —, et l'appelant refera la réconciliation à la page
 * suivante (`echec`). Ne rejette jamais.
 */
export async function reconcilier(etagere: Partial<EtagereDuCabinet>, profileId: string, musee: Musee, quand: number): Promise<IssueDuReveil> {
  if (!etagere.recompensesOf || !etagere.ranger) return { reveil: null, echec: false }
  const manquent = voiesQuiManquent(gardiensDus(musee), etagere.recompensesOf(profileId))
  const salleComplete = sallesCompletes(musee).length > 0
  if (manquent.length === 0 && !salleComplete) return { reveil: null, echec: false }
  let echec = false
  const gardiens: ReveilDesGardiens['gardiens'] = []
  if (manquent.length > 0) {
    try {
      const neuves = await etagere.ranger(profileId, RANGEMENT_DU_CABINET, manquent.map(d => d.voie), quand)
      const ouverts = new Set(etagere.legendairesOuverts?.(profileId, neuves) ?? [])
      // Rangée ailleurs entre-temps — l'autre serveur d'une mise en ligne —, une voie n'est pas neuve ici : il l'annonce, pas nous.
      for (const d of manquent) if (neuves.includes(d.voie)) gardiens.push({ legendaire: d.legendaire, neuf: ouverts.has(d.legendaire) })
    } catch (e) {
      echec = true
      console.error(`[cabinet] gardiens de ${profileId} non rangés, la page suivante les réconciliera :`, e)
    }
  }
  let compagnon: CleDeCompagnon | null = null
  if (salleComplete && etagere.offrirUnCompagnon) {
    try {
      if (await etagere.offrirUnCompagnon(profileId, COMPAGNON_DE_L_EXPEDITION, quand)) compagnon = COMPAGNON_DE_L_EXPEDITION
    } catch (e) {
      echec = true
      console.error(`[cabinet] la luciole de ${profileId} n’est pas venue, la page suivante la redemandera :`, e)
    }
  }
  const reveil = gardiens.length > 0 || compagnon ? { gardiens, ...(compagnon && { compagnon }) } : null
  return { reveil, echec }
}
