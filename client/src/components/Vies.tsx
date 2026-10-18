import { VIES } from '../../../shared/campagne'

/**
 * Les vies d'une partie en trois cœurs — la série, le défi, un duel, et
 * l'expédition, qui en a autant : pleins, puis vides. Le nombre se dit au
 * lecteur d'écran, les cœurs ne se lisent pas.
 */
export function Vies({ restantes }: { restantes: number }) {
  return (
    <span className="vies" role="img" aria-label={`${restantes} vie${restantes > 1 ? 's' : ''} sur ${VIES}`}>
      {Array.from({ length: VIES }, (_, i) => (
        <svg key={i} className={'icon coeur' + (i >= restantes ? ' perdu' : '')} viewBox="0 0 24 24" fill={i >= restantes ? 'none' : 'currentColor'} stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" aria-hidden="true">
          <path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z" />
        </svg>
      ))}
    </span>
  )
}
