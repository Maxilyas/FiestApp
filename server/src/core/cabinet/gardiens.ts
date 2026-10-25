// Les gardiens du Cabinet de curiosités : comment un gardien se réveille.
//
// Un gardien n'est écrit nulle part dans le Cabinet. Ce que le musée lui doit
// se dérive (`gardiensDus`, `shared/cabinet/musee.ts`) — une salle complète
// son premier gardien, tous ses cadres dorés le second, les 84 œuvres le Trou
// noir, trente jours d'affilée le Scarabée, une œuvre gagnée en jouant pendant
// une fête son gardien de saison —, et se compare à ce que l'étagère du profil
// a déjà rangé, en mémoire (`recompensesOf` ; une saison, sous `#cabinet`
// seulement, que le lot froid relit) : seul ce qui manque se range,
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
import { COMPAGNON_DE_L_EXPEDITION, type CleDeCompagnon } from '../../../../shared/compagnons'
import { gardiensDus, sallesCompletes, type GardienDu, type Musee } from '../../../../shared/cabinet/musee'
import { GARDIENS_DE_SAISON, RANGEMENT_DU_CABINET } from '../../../../shared/cabinet/salles'
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

/**
 * Les gardiens dus dont la voie n'est pas encore rangée, dans leur ordre. Celle
 * d'un gardien de saison (`saison:halloween`) se gagne aussi en soirée et au
 * quiz du jour : tenue sous une soirée, elle s'en irait avec elle — « C'était
 * un essai », une archive effacée, un barème relu —, et la Citrouille que le
 * musée doit encore avec. Elle ne se lit donc rangée que sous `#cabinet`
 * (`sousLeCabinet`, que le lot froid relit) ; les autres, que le Cabinet seul
 * range, à l'étagère en mémoire.
 */
export const voiesQuiManquent = (dus: readonly GardienDu[], rangees: ReadonlyMap<string, number>, sousLeCabinet: ReadonlySet<string> = new Set()): GardienDu[] =>
  dus.filter(d => !(GARDIENS_DE_SAISON.includes(d.legendaire) ? sousLeCabinet.has(d.voie) : rangees.has(d.voie)))

/**
 * Réveille ce que le musée doit et que l'étagère n'a pas : ranger ce qui
 * manque, d'un lot, puis offrir la luciole s'il a une salle complète. Chaque
 * pas qui tombe se dit au journal du serveur et laisse passer le suivant :
 * une étagère muette ne fait jamais échouer ce qui la réveillait — la partie
 * est écrite, l'achat payé —, et l'appelant refera la réconciliation à la page
 * suivante (`echec`). Ne rejette jamais. `sousLeCabinet`, les saisons que ce
 * musée sait rangées sous `#cabinet`, se tient à jour : ce que le lot vient de
 * ranger s'y ajoute. Sans lui, une saison due se range à chaque passage :
 * idempotente par la clé, mais une écriture chaque fois.
 */
export async function reconcilier(
  etagere: Partial<EtagereDuCabinet>,
  profileId: string,
  musee: Musee,
  quand: number,
  sousLeCabinet: Set<string> = new Set(),
): Promise<IssueDuReveil> {
  if (!etagere.recompensesOf || !etagere.ranger) return { reveil: null, echec: false }
  const manquent = voiesQuiManquent(gardiensDus(musee), etagere.recompensesOf(profileId), sousLeCabinet)
  const salleComplete = sallesCompletes(musee).length > 0
  if (manquent.length === 0 && !salleComplete) return { reveil: null, echec: false }
  let echec = false
  const gardiens: ReveilDesGardiens['gardiens'] = []
  if (manquent.length > 0) {
    try {
      const neuves = await etagere.ranger(profileId, RANGEMENT_DU_CABINET, manquent.map(d => d.voie), quand)
      for (const d of manquent) if (GARDIENS_DE_SAISON.includes(d.legendaire)) sousLeCabinet.add(d.voie)
      const ouverts = new Set(etagere.legendairesOuverts?.(profileId, neuves) ?? [])
      // Déjà en base — rangée par l'autre serveur d'une mise en ligne, ou par un lot d'ici dont la réponse s'est
      // perdue : l'étagère s'est relue (`ranger`) —, une voie n'est pas neuve ici. L'autre serveur l'a annoncée ; la
      // panne l'a tue, comme toute réconciliation ratée qui se rattrape. Annoncée ici, elle le serait deux fois.
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
