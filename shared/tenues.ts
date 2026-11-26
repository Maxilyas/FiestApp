// Les tenues de la loge (le 26 novembre 2026, la maquette
// `retours/2026-11-26/la-piece-avatar/` et le choix du propriétaire :
// « calques + tenues c'est le top », puis, devant le paquet de cartes,
// « Je valide »). Une tenue, c'est le look, pas le palmarès : l'avatar et ses
// calques — sa version, sa finition, sa bordure et son motif, son sceau — et
// le fond de la carte. Le titre et la vitrine disent ce qu'il a fait : ils le
// suivent d'une tenue à l'autre ; le thème et la gerbe ne sont pas sur la
// carte. Elles se gardent dans la colonne `tenues` du profil, six au plus.
//
// Un module léger : la tête de la loge (`LogeTete.tsx`), qui ne charge aucun
// catalogue, y lit laquelle il porte pour poser ses points sur la carte.

import { eclatChez, type PublicProfileDetail } from './profil'
import { tronquer } from './avatars'

/** Combien de tenues il garde, au plus : la soirée, les duels, une fête — pas une seconde collection (un choix de produit). */
export const TENUES_MAX = 6
/** Le nom d'une tenue, en caractères au plus : il tient sur la carte, à la place d'« Aperçu ». */
export const NOM_D_UNE_TENUE_MAX = 20

/** Ce qu'une tenue remet : les champs de son profil qui habillent la carte, tels qu'il les a choisis. */
export interface LookDUneTenue {
  /** L'emoji sous l'avatar : seul montré quand `legendaire` est null. */
  avatar: string
  /** Le légendaire, le Divin, le portrait ou la forme de compagnon qu'il porte ; null, son emoji. */
  legendaire: string | null
  /** `auto`, ou une finition (`FinitionChoisie`). */
  finition: string
  /** `auto`, `aucune`, ou la ligue d'une bordure (`ChoixDeBordure`). */
  bordure: string
  /** Le motif de sa bordure ; null, accordé à l'avatar. */
  motif: string | null
  /** Le sceau de ses légendaires se montre-t-il ? */
  sceau: boolean
  /** Le fond de sa carte ; null, celui de tous. */
  fond: string | null
  /** La version de l'avatar montré, s'il a éclaté pour lui : rare ou d'origine, et la matière qu'il y porte. */
  eclat: { cle: string; brille: boolean; matiere: string | null } | null
}

/** Une tenue gardée : son nom, et ce qu'elle remet. */
export interface TenueGardee {
  id: string
  nom: string
  look: LookDUneTenue
}

const chaine = (x: unknown): string | null => (typeof x === 'string' && x ? x : null)

/** Un look lu de la base ou d'une requête : ce qui n'a pas sa forme vaut null, jamais une exception. */
export function lireUnLook(brut: unknown): LookDUneTenue | null {
  if (!brut || typeof brut !== 'object') return null
  const l = brut as Record<string, unknown>
  const avatar = chaine(l.avatar)
  if (!avatar) return null
  const e = l.eclat as Record<string, unknown> | null | undefined
  return {
    avatar,
    legendaire: chaine(l.legendaire),
    finition: chaine(l.finition) ?? 'auto',
    bordure: chaine(l.bordure) ?? 'auto',
    motif: chaine(l.motif),
    sceau: l.sceau !== false,
    fond: chaine(l.fond),
    eclat: e && chaine(e.cle) ? { cle: String(e.cle), brille: e.brille !== false, matiere: chaine(e.matiere) } : null,
  }
}

/** Les tenues d'un profil, de la colonne `tenues` (du JSON) : une ligne illisible se tait, la suivante se lit. */
export function lireLesTenues(brut: unknown): TenueGardee[] {
  let liste: unknown
  try {
    liste = typeof brut === 'string' ? JSON.parse(brut) : brut
  } catch {
    return []
  }
  if (!Array.isArray(liste)) return []
  const tenues: TenueGardee[] = []
  for (const t of liste.slice(0, TENUES_MAX)) {
    const look = lireUnLook((t as { look?: unknown })?.look)
    const id = chaine((t as { id?: unknown })?.id)
    const nom = chaine((t as { nom?: unknown })?.nom)
    if (look && id && nom) tenues.push({ id, nom: tronquer(nom, NOM_D_UNE_TENUE_MAX), look })
  }
  return tenues
}

/** Deux looks qui habillent la carte de la même façon. */
export function memeLook(a: LookDUneTenue, b: LookDUneTenue): boolean {
  const memeEclat = a.eclat === b.eclat || (!!a.eclat && !!b.eclat && a.eclat.cle === b.eclat.cle && a.eclat.brille === b.eclat.brille && a.eclat.matiere === b.eclat.matiere)
  return (
    (a.legendaire ? a.legendaire === b.legendaire : !b.legendaire && a.avatar === b.avatar) &&
    a.finition === b.finition &&
    a.bordure === b.bordure &&
    a.motif === b.motif &&
    a.sceau === b.sceau &&
    a.fond === b.fond &&
    memeEclat
  )
}

/** Ce que la carte porte, tel que la tête de la loge le lit. */
export type CeQueLaCartePorte = Pick<PublicProfileDetail, 'avatar' | 'legendaire' | 'finitionChoisie' | 'eclats'> &
  Partial<Pick<PublicProfileDetail, 'bordureChoisie' | 'motifChoisi' | 'sceauMasque' | 'fond' | 'eclatsEteints' | 'matieres' | 'matieresPortees'>>

/**
 * La tenue qu'il porte, parmi les siennes : celle dont le look est le sien,
 * sinon aucune (-1). La version d'un Éclat se compare à celle qu'il montre de
 * cet avatar (`eclatChez`) — sans lire la cible de l'Éclat, que la tête de la
 * loge ne connaît pas.
 */
export function laTenuePortee(tenues: readonly TenueGardee[], porte: CeQueLaCartePorte): number {
  return tenues.findIndex(({ look: l }) => {
    if (l.legendaire ? l.legendaire !== porte.legendaire : porte.legendaire || l.avatar !== porte.avatar) return false
    if (l.finition !== porte.finitionChoisie || l.bordure !== (porte.bordureChoisie ?? 'auto') || l.motif !== (porte.motifChoisi ?? null)) return false
    if (l.sceau !== !porte.sceauMasque || l.fond !== (porte.fond ?? null)) return false
    if (!l.eclat) return true
    const montre = eclatChez(porte, l.eclat.cle)
    return l.eclat.brille ? montre === (l.eclat.matiere ?? true) : montre === false
  })
}
