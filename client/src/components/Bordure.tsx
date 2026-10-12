import type { Finition } from '../../../shared/profil'
import { CRANS_D_UNE_BORDURE, type CleDeLigue } from '../../../shared/duels'
import { dessinDeBordure } from './dessinDesBordures'
import { inscrireDessin } from './medaillons'

// La bordure de ligue d'un avatar (la maquette des alliages, validée par le
// propriétaire le 12 octobre 2026) : douze crans autour de lui, la forme et la
// pierre de sa ligue, le métal de sa finition.
//
// Elle se pose derrière l'avatar : ce qui sort d'un médaillon — les ailes d'un
// légendaire éclaté, la lance d'un portrait — passe par-dessus elle, comme
// par-dessus son anneau. Et devant la lumière des finitions 15, 20 et 25,
// dont elle remplace les anneaux (`Lumiere.tsx`, `bordure`) : leurs voiles,
// leurs arcs-en-ciel et leur étoile en orbite passent autour d'elle.
//
// Chargée à la demande (`medaillons.ts`) : une salle, une liste où personne
// n'en porte ne la télécharge jamais.

/** La bordure, derrière l'avatar : son cadre, les rayons des maîtres, le reflet de l'argent et du diamant. */
export function Bordure({ ligue, crans, finition }: { ligue: CleDeLigue; crans: number; finition: Finition }) {
  const { cadre, rayons } = dessinDeBordure(ligue, crans, finition)
  // Le Perlé a son reflet qui fait le tour, la Couronne sa vague de scintillement.
  const reflet = ligue === 'argent' || ligue === 'diamant'
  return (
    <span className={`bo bo-${ligue}${crans >= CRANS_D_UNE_BORDURE ? ' bo-sertie' : ''}`} aria-hidden="true">
      {rayons && <img className="bo-rayons" src={rayons} alt="" draggable={false} />}
      <img className="bo-cadre" src={cadre} alt="" draggable={false} />
      {reflet && <i className="bo-reflet" />}
    </span>
  )
}

// Évalué, le dessin est là pour tout `Avatar` de la page (voir `medaillons.ts`).
inscrireDessin({ Bordure })
