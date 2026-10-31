// Les monnaies de la traversée, dessinées une seule fois : les cœurs, l'or,
// les points de vie d'un gardien. La carte (`Traversee.tsx`) et la tête d'une
// épreuve (`Partie.tsx`) les posent ; chacune se dit en mots à l'oreille
// (`role="img"`), jamais par sa seule couleur.

const CHEMIN_DU_COEUR = 'M12 21.2s-7.6-4.7-9.7-9.4C.7 8.2 2.9 4.4 6.6 4.4c2.2 0 3.7 1.2 4.6 2.7.9-1.5 2.4-2.7 4.6-2.7 3.7 0 5.9 3.8 4.3 7.4-2.1 4.7-8.1 9.4-8.1 9.4z'

/** Les cœurs, pleins puis vides : sept ou huit (la Panacée améliorée) se serrent, la tête tient en 360 de large. */
export function Coeurs({ n, max }: { n: number; max: number }) {
  return (
    <span className={'cab-tv-coeurs' + (max >= 7 ? ' cab-tv-serres' : '')} role="img" aria-label={`${n} ${n > 1 ? 'cœurs' : 'cœur'} sur ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <svg key={i} className={'cab-tv-coeur' + (i < n ? '' : ' cab-tv-vide')} viewBox="0 0 24 24" aria-hidden="true">
          <path d={CHEMIN_DU_COEUR} />
        </svg>
      ))}
    </span>
  )
}

/** Une pièce d'or, dessinée en CSS. */
export const Piece = () => <i className="cab-tv-piece" aria-hidden="true" />

export function Bourse({ or }: { or: number }) {
  return (
    <span className="cab-tv-bourse" role="img" aria-label={`${or} pièces d’or`}>
      <Piece />
      <b>{or}</b>
    </span>
  )
}

/** Les points de vie d'un gardien, une barre chacun. */
export function PointsDeVie({ pv, max }: { pv: number; max: number }) {
  return (
    <span className="cab-tv-pv" role="img" aria-label={`${pv} ${pv > 1 ? 'points' : 'point'} de vie sur ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <i key={i} className={i < pv ? 'cab-tv-pv-plein' : undefined} />
      ))}
    </span>
  )
}
