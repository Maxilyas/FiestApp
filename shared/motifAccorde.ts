// Le motif d'une bordure « accordée » : celui qui va à l'avatar qu'elle
// entoure (le choix du propriétaire du 26 novembre 2026, sur la planche
// `retours/2026-11-26/bordures-au-choix/` : « en fonction de l'avatar, peut
// être que les plumes ne vont pas trop » — puis « Fait selon tes
// recommandations »). Ses flammes au Phénix, ses écailles au Dragon, ses
// vagues au Kraken ; un emoji, un Divin gardent les feuilles de leur ligue.
//
// Le légendaire prête son motif : porté avec lui, il ne s'achète pas. Pour le
// porter avec autre chose, il se gagne ou s'achète (`shared/motifs.ts`).
//
// Un module léger, à part du catalogue : `Avatar.tsx` le lit sur le chemin de
// l'invité anonyme, pour toute bordure qu'il dessine, sans faire venir les
// noms, les voies et les prix de tous les motifs. Ce qu'il lit des portraits
// et des compagnons y est déjà.
import { portrait } from './branches'
import { formeDeCompagnon } from './compagnons'
import type { CleDeBranche } from './branches'

/** Le motif d'office : le brin de la ligue (la parure du 17 novembre 2026). */
export const MOTIF_D_OFFICE = 'feuilles'

/** Les trente-quatre légendaires, chacun ce qui lui va. Un légendaire absent garde les feuilles. */
const DES_LEGENDAIRES: Readonly<Record<string, string>> = {
  'lg:aigle': 'plumes',
  'lg:bouquet': 'serpentins',
  'lg:chauve-souris': 'epines',
  'lg:chimere': 'flammes',
  'lg:chouette': 'plumes',
  'lg:citrouille': 'epines',
  'lg:comete': 'etoiles',
  'lg:coq': 'plumes',
  'lg:coquillage': 'vagues',
  'lg:djinn': 'nuages',
  'lg:dragon': 'ecailles',
  'lg:elephant': 'perles',
  'lg:fantome': 'nuages',
  'lg:gramophone': 'notes',
  'lg:janus': 'grecque',
  // Les légendaires offerts : la mer du Nord, ses vagues et ses écailles.
  'lg:jormungandr': 'vagues',
  'lg:baleine': 'vagues',
  'lg:drakkar': 'ecailles',
  'lg:kraken': 'vagues',
  'lg:licorne': 'etoiles',
  'lg:lion': 'rayons',
  'lg:oeuf': 'fleurs',
  'lg:oracle': 'grecque',
  'lg:ouroboros': 'ecailles',
  'lg:pegase': 'plumes',
  'lg:pegase-couronne': 'plumes',
  'lg:phenix': 'flammes',
  'lg:rose': 'fleurs',
  'lg:salamandre': 'flammes',
  'lg:sapin': 'houx',
  'lg:scarabee': 'rayons',
  'lg:serpent': 'ecailles',
  'lg:sphinx': 'rayons',
  'lg:tigre': 'flammes',
  'lg:trou-noir': 'etoiles',
}

/** Les douze branches des portraits : l'allure de leur sentier. */
const DES_BRANCHES: Readonly<Record<CleDeBranche, string>> = {
  monde: 'feuilles',
  mythes: 'grecque',
  oceans: 'vagues',
  espace: 'etoiles',
  foret: 'feuilles',
  ecran: 'rayons',
  scene: 'notes',
  contes: 'etoiles',
  stade: 'feuilles',
  brigade: 'perles',
  arcade: 'pixels',
  carnaval: 'serpentins',
}

/** Les portraits qui n'ont pas l'allure de leur branche. */
const DES_PORTRAITS: Readonly<Record<string, string>> = {
  'br:robot': 'rouages',
  'br:poseidon': 'vagues',
  'br:sirene': 'vagues',
  'br:griffon': 'plumes',
  'br:vampire': 'epines',
}

/** Les cinq compagnons, toutes leurs formes : le monde de chacun. */
const DES_COMPAGNONS: Readonly<Record<string, string>> = {
  loup: 'etoiles',
  chat: 'lanternes',
  tortue: 'vagues',
  panda: 'fleurs',
  luciole: 'lanternes',
}

/**
 * Le motif qui va à ce qu'il montre : la clé d'un légendaire, d'un portrait,
 * d'un compagnon, ou un emoji. Ce qui n'a pas d'allure à soi — un emoji, un
 * Divin — garde les feuilles de sa ligue.
 */
export function motifAccorde(montre: string | null | undefined): string {
  if (!montre) return MOTIF_D_OFFICE
  const du = DES_LEGENDAIRES[montre] ?? DES_PORTRAITS[montre]
  if (du) return du
  const p = portrait(montre)
  if (p) return DES_BRANCHES[p.branche] ?? MOTIF_D_OFFICE
  const forme = formeDeCompagnon(montre)
  if (forme) return DES_COMPAGNONS[forme.compagnon] ?? MOTIF_D_OFFICE
  return MOTIF_D_OFFICE
}

/** Les accords écrits, pour les épreuves : chaque motif nommé doit exister au catalogue. */
export const ACCORDS_ECRITS: readonly string[] = [...Object.values(DES_LEGENDAIRES), ...Object.values(DES_BRANCHES), ...Object.values(DES_PORTRAITS), ...Object.values(DES_COMPAGNONS)]
