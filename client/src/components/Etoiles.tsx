/**
 * La note d'une partie, en étoiles — une, deux, trois —, la même partout :
 * sur les sentiers, les parcours, et au quiz du jour, dont la médaille d'or,
 * d'argent ou de bronze se lisait sur un autre dessin, avec trois métaux que
 * les pistes des trophées emploient aussi (le lexique de la maquette du
 * 13 octobre 2026 : « ★ ★★ ★★★, la note d'une partie »).
 */
export function Etoiles({ n, grandes }: { n: number; grandes?: boolean }) {
  return (
    <span className={'sentier-etoiles' + (grandes ? ' sentier-etoiles-grandes' : '')} role="img" aria-label={`${n} étoile${n > 1 ? 's' : ''} sur 3`}>
      {[1, 2, 3].map(i => (
        <svg key={i} viewBox="0 0 24 24" className={i <= n ? 'pleine' : undefined} aria-hidden="true">
          <path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" />
        </svg>
      ))}
    </span>
  )
}
