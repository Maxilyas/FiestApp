import { useContext } from 'react'
import { Icon, type IconName } from '../../components/Icon'
import { RetourAuMusee, adresseDe, type EcranDuMusee } from './ecrans'

// La barre du Cabinet : ses quatre pièces sous le pouce, comme la barre du
// menu de l'accueil (`.menu-barre`) — « est-ce qu'on pourrait avoir une barre
// de menu en bas comme on a à l'accueil ? » (le propriétaire, le 31 octobre
// 2026). Sans elle, le musée, les gardiens et la visite ne se trouvaient qu'en
// bas de la tour, et chaque page annexe ne ramenait qu'à elle. La pièce où
// l'on est se dit en gras et par un filet, jamais par sa seule couleur, et ses
// noms gardent les dix-sept pixels du Cabinet.

export type PieceDuCabinet = 'tour' | 'musee' | 'gardiens' | 'jouer'

const PIECES: readonly { piece: PieceDuCabinet; nom: string; icone: IconName }[] = [
  { piece: 'tour', nom: 'La tour', icone: 'chateau' },
  { piece: 'musee', nom: 'Musée', icone: 'landmark' },
  { piece: 'gardiens', nom: 'Gardiens', icone: 'crown' },
  { piece: 'jouer', nom: 'Jouer', icone: 'dice' },
]

/** La pièce d'un écran : une salle et une œuvre sont du musée ; la visite, les jeux libres et tes murs, de « Jouer ». */
export function pieceDe(ecran: EcranDuMusee): PieceDuCabinet {
  switch (ecran.e) {
    case 'tour':
      return 'tour'
    case 'musee':
    case 'salle':
    case 'oeuvre':
      return 'musee'
    case 'gardiens':
      return 'gardiens'
    default:
      return 'jouer'
  }
}

export function BarreDuCabinet({ ici }: { ici: PieceDuCabinet }) {
  // La tour n'a pas de fragment : y revenir passe par la page même, sans recharger (`RetourAuMusee`) ; sans elle, un lien.
  const versLaTour = useContext(RetourAuMusee)
  return (
    <nav className="cab-barre" aria-label="Le Cabinet">
      {PIECES.map(p => (
        <a
          key={p.piece}
          href={p.piece === 'tour' ? '/cabinet' : adresseDe({ e: p.piece })}
          aria-current={ici === p.piece ? 'page' : undefined}
          onClick={
            p.piece === 'tour' && versLaTour
              ? e => {
                  e.preventDefault()
                  versLaTour()
                }
              : undefined
          }
        >
          <Icon name={p.icone} />
          {p.nom}
        </a>
      ))}
    </nav>
  )
}
