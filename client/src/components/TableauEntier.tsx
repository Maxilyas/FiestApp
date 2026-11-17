import { espacesFines } from '../format'

/**
 * Le tableau entier, révélé (v15) : à la révélation et dans « Mes réponses »,
 * de la même façon — l'image, puis son titre, son peintre, son année. Né à
 * part du détail de l'Expédition (`TableauDuDetail.tsx`, parti avec sa page) :
 * « Mes réponses » vit sur la page de la campagne, qui ne chargeait pas ses
 * règles.
 */
export function TableauEntier({ src, titre, peintre, annee }: { src: string; titre: string; peintre: string; annee: number }) {
  return (
    <figure className="tableau-entier">
      <img src={src} alt={espacesFines(`« ${titre} », ${peintre}`)} loading="lazy" />
      <figcaption>
        <b>{espacesFines(`« ${titre} »`)}</b>
        <span className="muted">{espacesFines(`${peintre}, ${annee}`)}</span>
      </figcaption>
    </figure>
  )
}
