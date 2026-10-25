import { espacesFines } from '../../format'
import { ETOILES_D_UNE_PARTIE } from '../../../../shared/cabinet/bareme'
import { JEUX } from '../../../../shared/cabinet/jeux/regle'
import type { Cartel } from '../../../../shared/cabinet/vues'
import { enDebutDeLigne } from './Musee'

// Le cartel d'une œuvre : la plaque crème sous la peinture, comme au musée.
// Il garde ce que la partie qui l'a fait entrer lui a appris — la question
// telle que la partie l'a lue, sa réponse, « Le savais-tu ? », le jeu, les
// étoiles, le jour —, relu par le serveur au même pli que la partie
// (invariant 14, `cartelDe`) ; sinon ce qui l'a fait entrer (« Rapportée de
// l'Expédition », « Achetée avec ta poussière d'or… »), dit par le serveur
// lui aussi : la page ne recopie aucune de ces phrases. Il arrive sous la
// peinture, qui s'ouvre sans l'attendre.

/** Le cartel, en chemin, lu, ou perdu : sa place se garde, son motif se dit. */
export type EtatDuCartel = { etat: 'chargement' } | { etat: 'lu'; cartel: Cartel } | { etat: 'perdu'; motif: string }

/**
 * Les cartels que la page garde, sans les perdus : seul un cartel lu vaut
 * d'être gardé. Gardé, un échec — une coupure d'un instant — restait sur la
 * plaque jusqu'au rechargement ; oublié, il se redemande à la réouverture de
 * l'œuvre et à chaque page relue. Rien de perdu : le même objet, et la page
 * ne se redessine pas pour rien.
 */
export function sansLesPerdus(cartels: Readonly<Record<string, EtatDuCartel>>): Record<string, EtatDuCartel> {
  const perdus = Object.keys(cartels).filter(cle => cartels[cle].etat === 'perdu')
  if (perdus.length === 0) return cartels as Record<string, EtatDuCartel>
  const gardes = { ...cartels }
  for (const cle of perdus) delete gardes[cle]
  return gardes
}

export function CartelDeLOeuvre({ lu }: { lu: EtatDuCartel }) {
  if (lu.etat === 'chargement') return <div className="cab-cartel cab-cartel-attente" aria-busy="true" />
  if (lu.etat === 'perdu') {
    return (
      <div className="cab-cartel">
        <p className="cab-cartel-ligne">{espacesFines(lu.motif)}</p>
      </div>
    )
  }
  const { cartel } = lu
  const p = cartel.partie
  if (!p) {
    return (
      <div className="cab-cartel">
        {cartel.dit && <p className="cab-cartel-phrase">{espacesFines(cartel.dit)}</p>}
      </div>
    )
  }
  return (
    <div className="cab-cartel">
      <span className="cab-cartel-titre">Ce que tu as appris en la gagnant</span>
      <p className="cab-cartel-sujet">{espacesFines(p.sujet)}</p>
      <p className="cab-cartel-reponse">{espacesFines(p.reponse)}</p>
      {p.anecdote && <p className="cab-cartel-phrase">{espacesFines(p.anecdote)}</p>}
      {/* Le jour sur sa ligne : à la suite, « · le 25 octobre 2026 » passait à la ligne son point en tête. */}
      <span className="cab-cartel-ligne">
        {espacesFines(`Gagnée ${JEUX[p.jeu].a}${p.theme ? ` · ${p.theme}` : ''} · ${p.total} sur ${ETOILES_D_UNE_PARTIE}`)}
        <span className="sr-only">, </span>
        <span className="cab-cartel-jour">{enDebutDeLigne(p.jour)}</span>
      </span>
    </div>
  )
}
