// Un rang s'écrit devant « place » (« 1ʳᵉ place ») : « 1ᵉʳ sur 7 » mettait au
// masculin la victoire de n'importe qui. Voir `shared/typographie.ts`.
export { deNom, espacesFines, formatNumber, place, rang } from '../../shared/typographie'
import { formatNumber } from '../../shared/typographie'

/** Une part en pour cent, « — » tant qu'il n'y a rien à diviser. */
export const pourcent = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)} %`)

/** Une durée au dixième de seconde, à la française : « 2,4 s ». */
export const secondes = (ms: number | null) => (ms === null ? '—' : `${(ms / 1000).toFixed(1).replace('.', ',')} s`)

/** « 62 estimations », « 1 estimation ». */
export const estimations = (n: number) => `${formatNumber(n)} estimation${n > 1 ? 's' : ''}`

/**
 * La base d'une précision, « 1 sur 2 QCM » : sans elle, 50 % sur deux
 * questions se lisait comme sur deux cents.
 */
export const surQcm = (justes: number, qcm: number) => `${formatNumber(justes)} sur ${formatNumber(qcm)} QCM`

/**
 * Ce qu'on a répondu, par type de question : « 1/2 justes · 62 estimations,
 * coup d’œil 83 % ». Une estimation n'est ni juste ni fausse : comptée avec
 * les QCM, elle faisait lire « 1/64 justes » — ou « 64 réponses, 1 juste » —
 * à qui en avait joué soixante-deux. Sans `compte`, le coup d'œil se passe
 * du nombre d'estimations : une ligne d'historique tient sur un téléphone.
 * Vide sans réponse.
 */
export function reponsesParType(
  r: { qcm: number; justes: number; estimations: number; coupDOeil: number | null },
  { compte = true }: { compte?: boolean } = {},
): string {
  const morceaux: string[] = []
  if (r.qcm > 0) morceaux.push(`${formatNumber(r.justes)}/${formatNumber(r.qcm)} justes`)
  if (r.coupDOeil !== null) {
    morceaux.push(`${compte ? `${estimations(r.estimations)}, ` : ''}coup d’œil ${pourcent(r.coupDOeil)}`)
  } else if (r.estimations > 0) {
    morceaux.push(estimations(r.estimations))
  }
  return morceaux.join(' · ')
}
