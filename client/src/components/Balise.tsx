import type { CouleurDePiste } from '../../../shared/sentiers'

/**
 * La couleur d'une chance, comme une piste de ski (`couleurDePiste`) — et sa
 * forme, pour qui ne distingue pas les couleurs : le rond vert, le carré
 * bleu, le triangle rouge, le losange noir. Une convention, écrite en dur
 * (`.balise-*`) : aucun thème ne repeint une piste noire. Les sentiers la
 * posent sur un palier, l'expédition sur chaque escale de sa carte : ici,
 * l'expédition ne télécharge pas tout le code des sentiers pour un dessin.
 */
export function Balise({ couleur }: { couleur: CouleurDePiste }) {
  return (
    <svg className={`balise balise-${couleur}`} viewBox="0 0 16 16" aria-hidden="true">
      {couleur === 'verte' ? (
        <circle cx="8" cy="8" r="6" />
      ) : couleur === 'bleue' ? (
        <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
      ) : couleur === 'rouge' ? (
        <path d="M8 2 14.5 13.5h-13Z" />
      ) : (
        <path d="M8 1.5 14.5 8 8 14.5 1.5 8Z" />
      )}
    </svg>
  )
}
