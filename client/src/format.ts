// Un rang s'écrit devant « place » (« 1ʳᵉ place ») : « 1ᵉʳ sur 7 » mettait au
// masculin la victoire de n'importe qui. Voir `shared/typographie.ts`.
import { formatNumber, place, pts } from '../../shared/typographie'
import { rangPartage } from '../../shared/classement'
export { deNom, espacesFines, formatNumber, place, pts, rang } from '../../shared/typographie'

/** Une part en pour cent, « — » tant qu'il n'y a rien à diviser. */
export const pourcent = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)} %`)

/** Une durée au dixième de seconde, à la française : « 2,4 s ». */
export const secondes = (ms: number | null) => (ms === null ? '—' : `${(ms / 1000).toFixed(1).replace('.', ',')} s`)

/**
 * L'en-tête du joueur : « 715 pts · 2ᵉ place » — le rang partagé, comme au
 * classement (`rangPartage`). Pas de rang tant que personne n'a marqué :
 * « 0 pts · 1ʳᵉ place » avant le premier quiz, c'était premier de rien.
 */
export function scoreEtRang(score: number, salle: readonly number[]): string {
  if (!salle.some(s => s > 0)) return pts(score)
  return `${pts(score)} · ${place(rangPartage(score, salle))}`
}

/**
 * « le 24 sept. à 17 h 10 », ou « à 17 h 10 » le jour même. Le format du
 * navigateur écrivait « Enregistré à 24 sept., 17:10 » : « à » devant une
 * date, et une heure à l'anglaise. `maintenant` : pour les tests.
 */
export function quand(ts: number, maintenant = Date.now()): string {
  const d = new Date(ts)
  const heure = `${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`
  if (d.toDateString() === new Date(maintenant).toDateString()) return `à ${heure}`
  return `le ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à ${heure}`
}

/**
 * « le 14 mars », « le 1er mars », « le 14 mars 2025 » d'une autre année,
 * « aujourd’hui » le jour même. `maintenant` : pour les tests.
 */
export function jour(ts: number, maintenant = Date.now()): string {
  const d = new Date(ts)
  const n = new Date(maintenant)
  if (d.toDateString() === n.toDateString()) return 'aujourd’hui'
  const date = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', ...(d.getFullYear() !== n.getFullYear() && { year: 'numeric' }) })
  return `le ${d.getDate() === 1 ? date.replace(/^1 /, '1er ') : date}`
}

/** « 62 estimations », « 1 estimation ». */
export const estimations = (n: number) => `${formatNumber(n)} estimation${n > 1 ? 's' : ''}`

/**
 * La base d'une précision, « 1 sur 2 QCM » : sans elle, 50 % sur deux
 * questions se lisait comme sur deux cents.
 */
export const surQcm = (justes: number, qcm: number) => `${formatNumber(justes)} sur ${formatNumber(qcm)} QCM`

/**
 * Ce qu'on a répondu, par type de question : « précision 50 % (1 sur 2 QCM)
 * · 62 estimations, coup d’œil 83 % ». Une estimation n'est ni juste ni
 * fausse : comptée avec les QCM, elle faisait lire « 1/64 justes » — ou
 * « 64 réponses, 1 juste » — à qui en avait joué soixante-deux. Sans
 * `compte`, le coup d'œil se passe du nombre d'estimations : une ligne
 * d'historique tient sur un téléphone.
 * Vide sans réponse.
 */
export function reponsesParType(
  r: { qcm: number; justes: number; estimations: number; coupDOeil: number | null },
  { compte = true }: { compte?: boolean } = {},
): string {
  const morceaux: string[] = []
  // « Précision », comme au profil et au bilan : « 4/6 justes » sur la carte,
  // « Réussite » au bilan, « Précision » au profil — un chiffre, trois noms.
  if (r.qcm > 0) morceaux.push(`précision ${pourcent(r.justes / r.qcm)} (${surQcm(r.justes, r.qcm)})`)
  if (r.coupDOeil !== null) {
    morceaux.push(`${compte ? `${estimations(r.estimations)}, ` : ''}coup d’œil ${pourcent(r.coupDOeil)}`)
  } else if (r.estimations > 0) {
    morceaux.push(estimations(r.estimations))
  }
  return morceaux.join(' · ')
}
