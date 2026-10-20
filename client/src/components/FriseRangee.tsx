import { Icon } from './Icon'
import { espacesFines } from '../format'
import { anneeDite } from '../../../shared/frise'

/**
 * Une frise rangée (v13) : ses événements dans l'ordre du temps, chacun son
 * année — la révélation et « Mes réponses » la montrent de la même façon.
 * Ratée, chaque ligne dit où il l'avait mise : la coche à sa place, sinon son
 * rang à lui (« tu l'avais en 3ᵉ ») — une seconde liste dans l'ordre qu'il
 * avait donné ne se comparait qu'en allant de l'une à l'autre. `places[k]` :
 * le rang où il avait posé le k-ième événement du temps ; sans, la frise seule.
 */
export function FriseRangee({ evenements, annees, places }: { evenements: readonly string[]; annees: readonly number[]; places?: readonly (number | null)[] }) {
  return (
    <ol className="frise-rangee">
      {evenements.map((e, k) => {
        const p = places?.[k]
        const aSaPlace = p === k
        return (
          <li key={k} className={places ? (aSaPlace ? 'frise-a-sa-place' : 'frise-deplacee') : undefined}>
            <b className="frise-annee">{anneeDite(annees[k])}</b>
            <span className="frise-evenement">{espacesFines(e)}</span>
            {p !== undefined && p !== null && (
              <span className="frise-sa-place">
                {aSaPlace ? (
                  <span role="img" aria-label="À sa place">
                    <Icon name="check" />
                  </span>
                ) : (
                  `tu l’avais en ${p + 1}${p === 0 ? 'ʳᵉ' : 'ᵉ'}`
                )}
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}
