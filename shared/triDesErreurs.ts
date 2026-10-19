import { tronquer } from './avatars'
import type { PanneDUnMode, TelephoneDuQg } from './pannes'
import type { ErreurDeLaSemaine } from './santeDuServeur'

/**
 * Le tri des erreurs serveur au QG (`/admin#erreurs`) — le souhait du
 * propriétaire du 19 octobre 2026 : « je trouve que je ne peux pas très bien
 * manager les erreurs que je vois ». La page « Le serveur » les détaillait
 * (le 17 octobre), mais rien n'y disait « vue », « réglée » ou « sans
 * gravité » : la même liste revenait à chaque visite, et l'alerte rouge de la
 * vue d'ensemble sonnait pour chacune, un hoquet de Turso déjà connu compris.
 *
 * Une erreur — ses semblables fondues (`cleDeLErreur`) — est à regarder tant
 * que l'administrateur ne l'a pas triée : réglée, elle sort de la liste ;
 * ignorée, elle ne sonne plus. Une réglée qui retombe sous une version qui ne
 * l'avait pas encore vue revient à regarder, d'elle-même : la réparation
 * n'a pas pris.
 */

export const ETATS_DU_TRI = ['a-regarder', 'reglee', 'ignoree'] as const
export type EtatDUneErreur = (typeof ETATS_DU_TRI)[number]

export const NOM_DE_L_ETAT: Record<EtatDUneErreur, string> = {
  'a-regarder': 'À regarder',
  reglee: 'Réglées',
  ignoree: 'Ignorées',
}

/** Le mot qui accompagne une erreur réglée ou ignorée, au plus : « PR #274 », « un hoquet de Turso ». */
export const NOTE_D_UNE_ERREUR_MAX = 80

/**
 * Ce que l'administrateur a dit d'une erreur, tel que la base le garde
 * (`qg_erreurs`). Sans ligne, elle est à regarder.
 */
export interface TriDUneErreur {
  etat: Exclude<EtatDUneErreur, 'a-regarder'>
  note: string | null
  /** Quand il l'a triée. */
  depuis: number
  /**
   * Les versions qui l'avaient vue tomber quand il l'a réglée : y retomber
   * n'est pas revenir — la réparation n'était pas encore en ligne.
   */
  versions: string[]
}

/** Une erreur de la semaine, son tri lu. */
export interface TriLu {
  etat: EtatDUneErreur
  /** Réglée, puis retombée sous une version qui ne l'avait pas vue avant : elle est revenue à regarder. */
  revenue: boolean
  /** Réglée, et retombée depuis sous une version qui l'avait déjà vue : sa réparation n'est pas encore en ligne. */
  encoreSousLAncienne: boolean
  note: string | null
  /** Quand elle a été triée ; null, jamais. */
  depuis: number | null
}

/** Ce que le tri lit d'une erreur de la semaine : la dernière fois qu'elle est tombée sous chaque version. */
export interface ParVersion {
  /** La version du démarrage qui l'a relevée ; null hors de l'hébergeur, qui ne la dit pas. */
  version: string | null
  n: number
  derniere: number
}

/**
 * Où en est une erreur. Retombée après qu'on l'a réglée, sous une version qui
 * ne l'avait jamais vue — la version mise en ligne avec la réparation —, elle
 * revient à regarder ; sous une de celles qui l'avaient vue, elle reste
 * réglée : la réparation attend sa mise en ligne. Hors de l'hébergeur, sans
 * version, toute rechute la fait revenir.
 */
export function lireLeTri(parVersion: readonly ParVersion[], tri: TriDUneErreur | undefined): TriLu {
  if (!tri) return { etat: 'a-regarder', revenue: false, encoreSousLAncienne: false, note: null, depuis: null }
  const apres = parVersion.filter(v => v.derniere > tri.depuis)
  const connue = (v: ParVersion) => v.version !== null && tri.versions.includes(v.version)
  const revenue = tri.etat === 'reglee' && apres.some(v => !connue(v))
  return {
    etat: revenue ? 'a-regarder' : tri.etat,
    revenue,
    encoreSousLAncienne: tri.etat === 'reglee' && !revenue && apres.some(connue),
    note: tri.note,
    depuis: tri.depuis,
  }
}

/** Le mot d'un tri, tel qu'il se garde : ses blancs resserrés, coupé à sa longueur, rien s'il est vide. */
export function lireLaNote(brut: unknown): string | null {
  if (typeof brut !== 'string') return null
  const net = tronquer(brut.replace(/\s+/g, ' ').trim(), NOTE_D_UNE_ERREUR_MAX)
  return net || null
}

// ── La page des erreurs ───────────────────────────────────────────────────

/** Une erreur de la semaine, et où elle en est. */
export interface ErreurATrier extends ErreurDeLaSemaine {
  tri: TriLu
}

export interface PageDesErreurs {
  maintenant: number
  /** Le démarrage qui répond : une réglée revient quand une autre version que les siennes la revoit. */
  enMarche: { depuis: number; version: string | null }
  /** Les erreurs de la semaine en détail, la plus récente d'abord (`ERREURS_MONTREES` au plus), chacune avec son tri. */
  erreurs: ErreurATrier[]
  /** Celles qui n'ont pas leur détail, par source : comptées, mais rien ne s'y trie. */
  sansDetail: { source: string; n: number }[]
  /** Les modes en panne à l'instant (`core/veille.ts`). */
  pannes: PanneDUnMode[]
  /** Les téléphones que la panne d'un mode fait sonner, et la clé que le service de push d'un nouveau demande. */
  alertes: { cle: string | null; telephones: TelephoneDuQg[] }
}

/** Les erreurs de la semaine, chacune lue sous son tri. */
export function lesErreursTriees(erreurs: readonly ErreurDeLaSemaine[], tri: ReadonlyMap<string, TriDUneErreur>): ErreurATrier[] {
  return erreurs.map(e => ({ ...e, tri: lireLeTri(e.parVersion, tri.get(e.cle)) }))
}

/** Combien dans chaque onglet de la page. */
export function compteDuTri(erreurs: readonly Pick<ErreurATrier, 'tri'>[]): Record<EtatDUneErreur, number> {
  const compte: Record<EtatDUneErreur, number> = { 'a-regarder': 0, reglee: 0, ignoree: 0 }
  for (const e of erreurs) compte[e.tri.etat]++
  return compte
}
