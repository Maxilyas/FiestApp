// Les motifs des bordures de ligue : ce qui pousse à chaque victoire, au
// choix depuis le 26 novembre 2026 (la planche
// `retours/2026-11-26/bordures-au-choix/`, et le propriétaire : « Fait selon
// tes recommandations », puis « Ça ne me dérange pas d'avoir plus de motifs
// dans la boutique. Je suis preneur de plusieurs motifs dans le coffre de la
// semaine aussi »).
//
// La ligue se gagne, le motif se choisit. Une bordure dit trois choses de la
// ligue — son métal, son insigne, ses douze crans (`shared/duels.ts`) — et une
// de goût : le motif. Acheter un motif n'achète ni la ligue, ni un cran : il
// se dessine au métal de la ligue où l'on est, et ne pousse qu'à chaque
// victoire (`client/src/components/dessinDesBordures.ts`).
//
// D'office, la bordure est « accordée » : le motif suit l'avatar porté
// (`shared/motifAccorde.ts`), et le légendaire prête le sien — porté avec lui,
// il ne s'achète pas. Un motif choisi à la main se tient : offert, prêté par
// une bordure sertie, gagné aux duels, acheté — en boutique ou à sa fête —, ou
// tiré du coffre de la semaine. Rien ne se tient à côté que les achats
// (`profile_motifs`) et les coffres (`profile_coffres`) : le reste se relit
// des duels (`motifsTenus`), et ne fait que s'ajouter — une bordure sertie le
// reste, une ligue atteinte aussi, une victoire au dé ne se reprend pas.
import type { Rarete } from './badges'
import { LIGUES, NOM_DE_LA_BORDURE, ouSeGagnentSesCrans, type BordureDeLigue, type CleDeLigue } from './duels'
import { SAISONS, type CleDeSaison } from './saisons'
import { dansSaPeriode, type PeriodeDeBoutique } from './themes'

/** Le prix d'un motif de la boutique, en confettis : celui d'un thème rare — une bordure se voit partout où l'on te voit. */
export const PRIX_D_UN_MOTIF = 400

/** Le prix d'un motif de saison, pendant sa fête : celui d'un thème peu commun. */
export const PRIX_D_UN_MOTIF_DE_SAISON = 250

/** Les victoires contre Automate, au dé, qui ouvrent les Rouages. */
export const VICTOIRES_POUR_LES_ROUAGES = 50

/** Le réglage d'office : le motif suit l'avatar porté. Rien ne s'écrit en base (`profiles.motif` NULL). */
export const MOTIF_ACCORDE = 'accorde'

/** Comment un motif s'obtient. */
export type VoieDuMotif =
  | { sorte: 'offert' }
  /** Le brin d'une ligue, prêté à toutes les autres une fois sa bordure sertie. */
  | { sorte: 'feuille'; ligue: CleDeLigue }
  | { sorte: 'duel'; regle: 'argent-serti' | 'automate' | 'maitres' }
  | { sorte: 'boutique' }
  | { sorte: 'saison'; fete: CleDeSaison }
  | { sorte: 'coffre'; rarete: Rarete }

export interface MotifDeBordure {
  key: string
  nom: string
  /** Ce qu'on voit, en quelques mots. */
  dit: string
  voie: VoieDuMotif
}

const offert = (key: string, nom: string, dit: string): MotifDeBordure => ({ key, nom, dit, voie: { sorte: 'offert' } })
const enBoutique = (key: string, nom: string, dit: string): MotifDeBordure => ({ key, nom, dit, voie: { sorte: 'boutique' } })
const auCoffre = (key: string, nom: string, dit: string, rarete: Rarete): MotifDeBordure => ({ key, nom, dit, voie: { sorte: 'coffre', rarete } })

/** Ce que dit le brin de chaque ligue, prêté. */
const BRINS: Record<CleDeLigue, string> = {
  bronze: 'le laurier du bronze',
  argent: 'l’olivier de l’argent',
  or: 'la feuille d’or et ses rubis',
  platine: 'les cristaux du givre',
  diamant: 'les marquises du diamant',
  maitre: 'les flammes d’émail noir',
}

/**
 * Le catalogue, dans l'ordre de la loge et de la collection : les offerts, les
 * brins des ligues, ceux des duels, de la boutique, de saison, du coffre.
 */
export const MOTIFS: readonly MotifDeBordure[] = [
  offert('feuilles', 'Les Feuilles', 'le brin de ta ligue, de victoire en victoire'),
  offert('jonc', 'Le Jonc serti', 'un anneau large, une pierre sertie par victoire'),
  offert('nu', 'Le Fil nu', 'la ligue seule et son insigne'),
  ...LIGUES.map(
    (l): MotifDeBordure => ({ key: `feuilles-${l.cle}`, nom: NOM_DE_LA_BORDURE[l.cle], dit: BRINS[l.cle], voie: { sorte: 'feuille', ligue: l.cle } }),
  ),
  { key: 'perles', nom: 'Les Perles', dit: 'un trio de perles par victoire, à la pierre de ta ligue', voie: { sorte: 'duel', regle: 'argent-serti' } },
  { key: 'rouages', nom: 'Les Rouages', dit: 'l’atelier d’Automate : un engrenage et son pignon', voie: { sorte: 'duel', regle: 'automate' } },
  { key: 'flammes', nom: 'Les Flammes', dit: 'les flammes du Soleil noir, à toutes les ligues', voie: { sorte: 'duel', regle: 'maitres' } },
  enBoutique('etoiles', 'Les Étoiles', 'une étoile par victoire, reliées en constellation'),
  enBoutique('ecailles', 'Les Écailles', 'deux écailles par victoire : une armure'),
  enBoutique('vagues', 'Les Vagues', 'une vague qui s’enroule vers le haut, son écume'),
  enBoutique('rayons', 'Les Rayons', 'un soleil art déco, trois rais par victoire'),
  enBoutique('fleurs', 'Les Fleurs', 'une fleur de bijou et son bouton'),
  enBoutique('plumes', 'Les Plumes', 'une rémige par victoire : deux ailes qui se referment'),
  enBoutique('serpentins', 'Les Serpentins', 'un ruban qui frise et ses confettis : la fête'),
  enBoutique('notes', 'Les Notes', 'une croche par victoire : la musique'),
  enBoutique('pixels', 'Les Pixels', 'un cœur de huit bits par victoire : l’arcade'),
  enBoutique('grecque', 'La Grecque', 'la frise d’un temple, qui court sur le fil'),
  enBoutique('epines', 'Les Épines', 'une ronce qui se recourbe, sa goutte de pierre'),
  enBoutique('nuages', 'Les Nuages', 'un nuage bombé par victoire : la douceur'),
  { key: 'coeurs', nom: 'Les Cœurs', dit: 'un cœur d’émail rose, ourlé du métal de ta ligue', voie: { sorte: 'saison', fete: 'saint-valentin' } },
  { key: 'houx', nom: 'Le Houx', dit: 'une feuille d’émail vert et ses baies', voie: { sorte: 'saison', fete: 'noel' } },
  auCoffre('flocons', 'Les Flocons', 'un cristal de neige par victoire', 'peucommune'),
  auCoffre('papillons', 'Les Papillons', 'un papillon par victoire, ses ailes à la pierre de ta ligue', 'rare'),
  auCoffre('lanternes', 'Les Lanternes', 'une lanterne de papier qui luit', 'rare'),
  auCoffre('joyaux', 'Les Joyaux', 'une grande pierre taillée dans ses griffes', 'epique'),
  auCoffre('cometes', 'Les Comètes', 'une étoile filante et sa traîne', 'epique'),
  auCoffre('couronne', 'La Couronne royale', 'un fleuron et sa perle : sertie, une couronne', 'legendaire'),
]

const PAR_CLE = new Map(MOTIFS.map(m => [m.key, m]))

/** Un motif par sa clé. */
export const motif = (key: unknown): MotifDeBordure | undefined => (typeof key === 'string' ? PAR_CLE.get(key) : undefined)

/** Les motifs de la boutique, toute l'année. */
export const MOTIFS_EN_BOUTIQUE: readonly MotifDeBordure[] = MOTIFS.filter(m => m.voie.sorte === 'boutique')

/** Les motifs que seul le coffre de la semaine donne. */
export const MOTIFS_DU_TRESOR: readonly MotifDeBordure[] = MOTIFS.filter(m => m.voie.sorte === 'coffre')

/** La période de boutique d'une fête à dates fixes (celle des thèmes de saison). */
function periodeDe(fete: CleDeSaison): PeriodeDeBoutique {
  const s = SAISONS.find(x => x.key === fete)!
  if (!('debut' in s)) throw new Error(`${fete} : une fête sans dates fixes ne tient pas une période de boutique`)
  return { debut: s.debut, fin: s.fin, periode: s.periode }
}

/** La fête d'un motif de saison, et sa période : « du 20 au 26 décembre ». */
export function saisonDuMotif(m: MotifDeBordure): { nom: string; periode: PeriodeDeBoutique; legendaire: string } | null {
  if (m.voie.sorte !== 'saison') return null
  const fete = m.voie.fete
  const s = SAISONS.find(x => x.key === fete)!
  return { nom: s.nom, periode: periodeDe(fete), legendaire: s.legendaire }
}

/** Ce qu'il coûte en boutique ce jour-là (le jour de Paris), ou null : il ne s'y vend pas — pas encore, ou jamais. */
export function prixDuMotif(m: MotifDeBordure, jour: string): number | null {
  if (m.voie.sorte === 'boutique') return PRIX_D_UN_MOTIF
  if (m.voie.sorte === 'saison') return dansSaPeriode(periodeDe(m.voie.fete), jour) ? PRIX_D_UN_MOTIF_DE_SAISON : null
  return null
}

/** Ce qui ouvre ses motifs : ses bordures, ses victoires au dé, ses achats, ses coffres, ses légendaires. */
export interface CeQuiOuvreLesMotifs {
  bordures?: readonly BordureDeLigue[]
  victoiresAuDe?: number
  /** Ses achats (`profile_motifs`), par clé. */
  achetes?: ReadonlySet<string>
  /** Ce que ses coffres lui ont donné (`profile_coffres.objet`) : `motif:<clé>`. */
  tresors?: ReadonlySet<string>
  /** Ses légendaires : celui d'une fête ouvre son motif de saison. */
  legendaires?: readonly string[]
}

/** Il tient ce motif : offert, prêté, gagné, acheté, tiré du coffre. */
export function motifTenu(m: MotifDeBordure, c: CeQuiOuvreLesMotifs): boolean {
  const v = m.voie
  switch (v.sorte) {
    case 'offert':
      return true
    case 'feuille':
      return (c.bordures ?? []).some(b => b.ligue === v.ligue && b.crans >= 12)
    case 'duel':
      if (v.regle === 'argent-serti') return (c.bordures ?? []).some(b => b.ligue === 'argent' && b.crans >= 12)
      if (v.regle === 'maitres') return (c.bordures ?? []).some(b => b.ligue === 'maitre')
      return (c.victoiresAuDe ?? 0) >= VICTOIRES_POUR_LES_ROUAGES
    case 'boutique':
      return c.achetes?.has(m.key) ?? false
    case 'saison':
      return (c.achetes?.has(m.key) ?? false) || (c.legendaires ?? []).includes(saisonDuMotif(m)!.legendaire)
    case 'coffre':
      return c.tresors?.has(`motif:${m.key}`) ?? false
  }
}

/** Les motifs qu'il tient, dans l'ordre du catalogue. */
export const motifsTenus = (c: CeQuiOuvreLesMotifs): string[] => MOTIFS.filter(m => motifTenu(m, c)).map(m => m.key)

/** Un motif choisi, tel qu'il arrive d'une page ou de la base : une clé du catalogue, ou null — accordé à l'avatar. */
export function choixDeMotif(brut: unknown): string | null {
  return motif(brut) ? (brut as string) : null
}

/** Ce que l'avancée vers un motif des duels dit : « 31 sur 50 », ou null s'il n'y a pas de compte. */
export function avanceeVersLeMotif(m: MotifDeBordure, c: CeQuiOuvreLesMotifs): string | null {
  if (m.voie.sorte === 'duel' && m.voie.regle === 'automate') return `${Math.min(c.victoiresAuDe ?? 0, VICTOIRES_POUR_LES_ROUAGES)} sur ${VICTOIRES_POUR_LES_ROUAGES}`
  const ligue = m.voie.sorte === 'feuille' ? m.voie.ligue : m.voie.sorte === 'duel' && m.voie.regle === 'argent-serti' ? 'argent' : null
  if (!ligue) return null
  const b = (c.bordures ?? []).find(x => x.ligue === ligue)
  return b ? `${Math.min(b.crans, 12)} sur 12` : null
}

/** Comment l'avoir, en une phrase — la loge, la collection, un refus. */
export function regleDuMotif(m: MotifDeBordure): string {
  const v = m.voie
  switch (v.sorte) {
    case 'offert':
      return 'Offert à tous'
    case 'feuille':
      return `Douze duels gagnés ${ouSeGagnentSesCrans(v.ligue)} : sa bordure sertie`
    case 'duel':
      return v.regle === 'argent-serti'
        ? `Douze duels gagnés ${ouSeGagnentSesCrans('argent')} : l’Olivier serti`
        : v.regle === 'maitres'
          ? 'Atteindre la ligue des maîtres'
          : `Battre Automate ${VICTOIRES_POUR_LES_ROUAGES} fois, au dé`
    case 'boutique':
      return `${PRIX_D_UN_MOTIF} confettis en boutique`
    case 'saison': {
      const s = saisonDuMotif(m)!
      return `En boutique ${s.periode.periode}, ou avec le légendaire de ${s.nom}`
    }
    case 'coffre':
      return 'Au coffre de la semaine'
  }
}
