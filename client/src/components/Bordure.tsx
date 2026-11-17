import { CRANS_D_UNE_BORDURE, type CleDeLigue } from '../../../shared/duels'
import { dessinDeBordure } from './dessinDesBordures'
import { inscrireDessin } from './medaillons'

// La bordure de ligue d'un avatar : une parure qui pousse (la planche du
// 17 novembre 2026, `retours/2026-11-17/bordures/`) — un fil de métal,
// l'insigne de sa ligue en bas, un brin de feuilles par duel gagné. Au métal
// de sa ligue, quelle que soit la finition : elle ne la reçoit plus.
//
// Elle se pose derrière l'avatar : ce qui sort d'un médaillon — les ailes d'un
// légendaire éclaté, la lance d'un portrait — passe par-dessus elle, comme
// par-dessus son anneau. Et devant la lumière des finitions, dont les anneaux
// s'effacent sous elle (`Lumiere.tsx`, `bordure`) : leurs voiles, leurs
// arcs-en-ciel et leur étoile en orbite passent autour d'elle.
//
// Chargée à la demande (`medaillons.ts`) : une salle, une liste où personne
// n'en porte ne la télécharge jamais.

/**
 * La bordure, derrière l'avatar : son cadre, et l'éclat qui fait le tour de
 * l'argent, du diamant et des maîtres — un pinceau de lumière qui tourne dans
 * un calque découpé à la forme de son métal (le masque ne tourne pas : c'est
 * l'enfant qui tourne dedans).
 */
export function Bordure({ ligue, crans }: { ligue: CleDeLigue; crans: number }) {
  const { cadre, silhouette } = dessinDeBordure(ligue, crans)
  const masque = silhouette ? `url("${silhouette}")` : null
  return (
    <span className={`bo bo-${ligue}${crans >= CRANS_D_UNE_BORDURE ? ' bo-sertie' : ''}`} aria-hidden="true">
      <img className="bo-cadre" src={cadre} alt="" draggable={false} />
      {masque && (
        <i className="bo-reflet" style={{ WebkitMaskImage: masque, maskImage: masque }}>
          <i />
        </i>
      )}
    </span>
  )
}

// Évalué, le dessin est là pour tout `Avatar` de la page (voir `medaillons.ts`).
inscrireDessin({ Bordure })
