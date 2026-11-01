import { Icon, type IconName } from './Icon'
import { IMAGES } from './legendaires-peints'
import type { PageALAffiche } from '../../../shared/affiches'

// Ce que l'affiche d'une nouveauté montre au-dessus de son titre
// (`AfficheDeLaNouveaute`), à la demande : les peintures des gardiens ne
// partent qu'avec une affiche à montrer — l'accueil anonyme n'en télécharge
// rien (`medaillons.test.ts`).

/**
 * Les trois gardiens du Cabinet, un par acte de la traversée — le Renard,
 * le Sphinx, le Dragon (`GARDIENS_DES_ACTES`, recopiés ici : la traversée ne
 * descend pas jusqu'à l'accueil) —, dans leur version rare, comme l'écran
 * des gardiens les montre : « trois gardiens, un légendaire au bout ».
 */
const GARDIENS_DE_L_AFFICHE = ['lg:renard', 'lg:sphinx', 'lg:dragon'] as const

/** L'icône d'une page sans peinture à elle : celle de son gros bouton. */
const ICONES: Record<Exclude<PageALAffiche, 'cabinet'>, IconName> = {
  campagne: 'target',
  jour: 'sun',
  duels: 'swords',
  boutique: 'bag',
}

/** Le visuel d'une page : décoratif, tu à l'oreille par la scène qui le porte. */
export function VisuelDeLAffiche({ page }: { page: PageALAffiche }) {
  if (page === 'cabinet') {
    return (
      <>
        {GARDIENS_DE_L_AFFICHE.map((cle, i) => {
          const image = IMAGES[cle]
          return (
            <span key={cle} className={`affiche-medaillon affiche-medaillon-${i + 1}`}>
              {image && <img src={image.rare[1]} alt="" />}
            </span>
          )
        })}
      </>
    )
  }
  return (
    <span className="affiche-medaillon affiche-medaillon-seul">
      <Icon name={ICONES[page]} />
    </span>
  )
}
