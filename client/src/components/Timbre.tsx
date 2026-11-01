import { useId, type ReactNode } from 'react'
import { saison, type CleDeSaison } from '../../../shared/saisons'
import { timbreDe, type EtatDuTimbre } from '../../../shared/timbres'

// Le timbre d'une fête (`shared/timbres.ts`) : dessiné, pas peint — la
// maquette des fêtes, validée par le propriétaire le 1er novembre 2026 (« un
// timbre dessiné, gratuit »). Un objet imprimé : ses couleurs s'écrivent en
// dur, comme les pistes des sentiers, et aucun thème ne le repeint. Sa
// dentelure est un masque — de vrais trous, sous Velours comme sous Ivoire —,
// son cachet dit l'année où il a été gagné. Tout est dans un seul SVG, sans
// image à télécharger : le carnet en montre huit par année.

/** Le fond de chaque fête, et l'encre qui écrit dessus. */
const COULEURS: Readonly<Record<CleDeSaison, { fond: string; encre: string }>> = {
  'nouvel-an': { fond: '#1f2440', encre: '#e8cb8a' },
  'saint-valentin': { fond: '#f4d7d3', encre: '#8a2e2b' },
  paques: { fond: '#e3edd5', encre: '#3f6630' },
  musique: { fond: '#d9dcef', encre: '#2f3a78' },
  ete: { fond: '#cfe6ee', encre: '#1f5f7a' },
  rentree: { fond: '#f6efdc', encre: '#7a4e22' },
  halloween: { fond: '#2b2140', encre: '#f3d27a' },
  noel: { fond: '#d7e8dc', encre: '#245236' },
}

const LARGEUR = 150
const HAUTEUR = 184
/** Le papier autour de l'image, en unités du dessin. */
const MARGE = 9
/** Un trou de la dentelure tous les 12 unités, sur chaque bord. */
const PAS = 12

/** Les trous de la dentelure : centrés sur les bords, coins compris. */
const TROUS: readonly (readonly [number, number])[] = [
  ...Array.from({ length: Math.floor(LARGEUR / PAS) + 1 }, (_, i) => i * PAS + (LARGEUR % PAS) / 2).flatMap(x => [
    [x, 0] as const,
    [x, HAUTEUR] as const,
  ]),
  ...Array.from({ length: Math.floor(HAUTEUR / PAS) + 1 }, (_, i) => i * PAS + (HAUTEUR % PAS) / 2).flatMap(y => [
    [0, y] as const,
    [LARGEUR, y] as const,
  ]),
]

/** L'illustration de chaque fête, dans un carré de 100 unités : quelques formes pleines, lisibles à la taille d'une vignette. */
const DESSINS: Readonly<Record<CleDeSaison, ReactNode>> = {
  'nouvel-an': (
    <>
      <g strokeWidth={3} strokeLinecap="round">
        <line x1={60} y1={42} x2={78} y2={42} stroke="#d9b56a" />
        <line x1={57.1} y1={49.1} x2={69.8} y2={61.8} stroke="#e79bb0" />
        <line x1={50} y1={52} x2={50} y2={70} stroke="#7fc8d8" />
        <line x1={42.9} y1={49.1} x2={30.2} y2={61.8} stroke="#d9b56a" />
        <line x1={40} y1={42} x2={22} y2={42} stroke="#e79bb0" />
        <line x1={42.9} y1={34.9} x2={30.2} y2={22.2} stroke="#7fc8d8" />
        <line x1={50} y1={32} x2={50} y2={14} stroke="#d9b56a" />
        <line x1={57.1} y1={34.9} x2={69.8} y2={22.2} stroke="#e79bb0" />
        <line x1={80} y1={72} x2={80} y2={66} stroke="#d9b56a" />
        <line x1={86} y1={78} x2={92} y2={78} stroke="#d9b56a" />
        <line x1={80} y1={84} x2={80} y2={90} stroke="#d9b56a" />
        <line x1={74} y1={78} x2={68} y2={78} stroke="#d9b56a" />
      </g>
      <circle cx={81} cy={42} r={2.5} fill="#d9b56a" />
      <circle cx={50} cy={73} r={2.5} fill="#7fc8d8" />
      <circle cx={19} cy={42} r={2.5} fill="#e79bb0" />
      <circle cx={50} cy={11} r={2.5} fill="#d9b56a" />
      <circle cx={16} cy={88} r={1.5} fill="#f3ece2" />
      <circle cx={90} cy={12} r={1.5} fill="#f3ece2" />
      <circle cx={24} cy={12} r={1.2} fill="#f3ece2" />
    </>
  ),
  'saint-valentin': (
    <>
      <line x1={14} y1={74} x2={86} y2={24} stroke="#8a2e2b" strokeWidth={3} strokeLinecap="round" />
      <path d="M86 24 L75 25 L81 33 Z" fill="#8a2e2b" />
      <path d="M50 84 C22 64 10 46 22 31 C32 19 46 23 50 34 C54 23 68 19 78 31 C90 46 78 64 50 84 Z" fill="#b8403c" />
      <path d="M33 44 C31 38 34 33 40 32" stroke="#f4d7d3" strokeWidth={3} fill="none" strokeLinecap="round" />
      <path d="M14 74 L8 70 M18 72 L12 67 M14 74 L11 80 M18 72 L16 78" stroke="#8a2e2b" strokeWidth={2} strokeLinecap="round" />
    </>
  ),
  paques: (
    <>
      <path d="M4 96 Q10 80 14 96 Q20 78 26 96 Q32 82 36 96 Q44 76 50 96 Q56 82 62 96 Q68 78 74 96 Q80 82 86 96 Q92 80 96 96 Z" fill="#5f8a4a" />
      <ellipse cx={50} cy={52} rx={26} ry={33} fill="#f6efe0" stroke="#5f8a4a" strokeWidth={2} />
      <polyline points="25,50 31,43 37,50 43,43 49,50 55,43 61,50 67,43 75,50" fill="none" stroke="#e79bb0" strokeWidth={4} strokeLinejoin="round" />
      <circle cx={39} cy={66} r={3.5} fill="#e8b84a" />
      <circle cx={50} cy={69} r={3.5} fill="#e8b84a" />
      <circle cx={61} cy={66} r={3.5} fill="#e8b84a" />
      <path d="M44 28 Q50 24 56 28" stroke="#e8b84a" strokeWidth={3} fill="none" strokeLinecap="round" />
    </>
  ),
  musique: (
    <>
      <circle cx={40} cy={60} r={31} fill="#2a2e4a" />
      <circle cx={40} cy={60} r={24} fill="none" stroke="#4a5590" strokeWidth={1.2} />
      <circle cx={40} cy={60} r={18} fill="none" stroke="#4a5590" strokeWidth={1.2} />
      <circle cx={40} cy={60} r={9} fill="#d9b56a" />
      <circle cx={40} cy={60} r={2} fill="#2a2e4a" />
      <path d="M70 22 L86 16 L86 23 L70 29 Z" fill="#3d4a8a" />
      <line x1={71.5} y1={22} x2={71.5} y2={56} stroke="#3d4a8a" strokeWidth={3} />
      <line x1={84.5} y1={16} x2={84.5} y2={50} stroke="#3d4a8a" strokeWidth={3} />
      <ellipse cx={66} cy={57} rx={7} ry={5} fill="#3d4a8a" transform="rotate(-20 66 57)" />
      <ellipse cx={79} cy={51} rx={7} ry={5} fill="#3d4a8a" transform="rotate(-20 79 51)" />
    </>
  ),
  ete: (
    <>
      <g stroke="#f0b03c" strokeWidth={3.5} strokeLinecap="round">
        <line x1={72} y1={40} x2={80} y2={40} />
        <line x1={65.6} y1={24.4} x2={71.2} y2={18.8} />
        <line x1={50} y1={18} x2={50} y2={10} />
        <line x1={34.4} y1={24.4} x2={28.8} y2={18.8} />
        <line x1={28} y1={40} x2={20} y2={40} />
        <line x1={34.4} y1={55.6} x2={28.8} y2={61.2} />
        <line x1={65.6} y1={55.6} x2={71.2} y2={61.2} />
      </g>
      <circle cx={50} cy={40} r={16} fill="#f0b03c" />
      <path d="M0 68 Q12 60 25 68 T50 68 T75 68 T100 68 V100 H0 Z" fill="#5aa3bf" />
      <path d="M0 80 Q12 72 25 80 T50 80 T75 80 T100 80 V100 H0 Z" fill="#2f7a99" />
      <path d="M70 94 C66 86 82 84 82 92 Z" fill="#f6efe0" />
    </>
  ),
  rentree: (
    <>
      <g stroke="#b7cde0" strokeWidth={1}>
        <line x1={0} y1={20} x2={100} y2={20} />
        <line x1={0} y1={34} x2={100} y2={34} />
        <line x1={0} y1={48} x2={100} y2={48} />
        <line x1={0} y1={62} x2={100} y2={62} />
      </g>
      <line x1={16} y1={0} x2={16} y2={100} stroke="#e0a49c" strokeWidth={1.5} />
      <g transform="rotate(-35 50 46)">
        <rect x={14} y={38} width={8} height={16} rx={2} fill="#e79bb0" />
        <rect x={22} y={38} width={5} height={16} fill="#9aa4ae" />
        <rect x={27} y={38} width={45} height={16} fill="#e8b84a" />
        <line x1={27} y1={46} x2={72} y2={46} stroke="#d29a2e" strokeWidth={1.5} />
        <path d="M72 38 L88 46 L72 54 Z" fill="#f3d9a8" />
        <path d="M83 43.5 L88 46 L83 48.5 Z" fill="#3a2a1a" />
      </g>
      <circle cx={72} cy={80} r={12} fill="#c24a3a" />
      <path d="M72 68 Q74 61 80 60" stroke="#5f8a4a" strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <path d="M66 75 Q67 71 70 70" stroke="#f4d7d3" strokeWidth={2} fill="none" strokeLinecap="round" />
    </>
  ),
  halloween: (
    <>
      <circle cx={80} cy={20} r={9} fill="#f3d27a" />
      <circle cx={85} cy={16} r={8} fill="#2b2140" />
      <rect x={46} y={32} width={8} height={12} rx={2} fill="#5f8a4a" />
      <ellipse cx={50} cy={64} rx={34} ry={25} fill="#e07a2e" />
      <ellipse cx={50} cy={64} rx={15} ry={25} fill="#f08f3e" />
      <path d="M35 60 L41 51 L47 60 Z" fill="#2b2140" />
      <path d="M53 60 L59 51 L65 60 Z" fill="#2b2140" />
      <path d="M34 68 Q50 84 66 68 Q50 75 34 68 Z" fill="#2b2140" />
    </>
  ),
  noel: (
    <>
      <rect x={45} y={76} width={10} height={14} fill="#8a5a2b" />
      <path d="M50 14 L73 46 H60 L80 76 H20 L40 46 H27 Z" fill="#2f6b47" />
      <polygon points="50,3 52.6,9.4 59,10 54.2,14.2 55.6,21 50,17.6 44.4,21 45.8,14.2 41,10 47.4,9.4" fill="#d9b56a" />
      <circle cx={44} cy={38} r={3.5} fill="#b8403c" />
      <circle cx={57} cy={56} r={3.5} fill="#d9b56a" />
      <circle cx={38} cy={66} r={3.5} fill="#b8403c" />
      <circle cx={66} cy={70} r={3.5} fill="#d9b56a" />
    </>
  ),
}

/** Ce que l'état du timbre ajoute à son nom, à l'oreille. */
const ETAT_DIT: Readonly<Record<EtatDuTimbre, string>> = {
  gagne: ', gagné',
  'en-cours': ', sa fête en cours',
  'a-venir': ', à venir',
  manque: ', manqué',
}

/** Le cachet de la poste, sur un timbre gagné : un cercle, son année, des ondes — penché, comme tamponné à la main. */
function Cachet({ millesime }: { millesime: number }) {
  return (
    <g className="timbre-cachet" transform="rotate(-14 104 128)">
      <circle cx={104} cy={128} r={24} fill="none" stroke="#2a201b" strokeWidth={2} />
      <circle cx={104} cy={128} r={18} fill="none" stroke="#2a201b" strokeWidth={1} />
      <text x={104} y={125} textAnchor="middle" className="timbre-cachet-mot">
        GAGNÉ
      </text>
      <text x={104} y={136} textAnchor="middle" className="timbre-cachet-annee">
        {millesime}
      </text>
      <path d="M50 118 Q56 114 62 118 T74 118 T80 118" fill="none" stroke="#2a201b" strokeWidth={1.6} />
      <path d="M50 128 Q56 124 62 128 T74 128 T80 128" fill="none" stroke="#2a201b" strokeWidth={1.6} />
      <path d="M50 138 Q56 134 62 138 T74 138 T80 138" fill="none" stroke="#2a201b" strokeWidth={1.6} />
    </g>
  )
}

/**
 * Le timbre d'une fête et d'une année, dans l'un de ses quatre états : gagné
 * (en couleurs, tamponné), sa fête en cours (en couleurs), à venir ou manqué
 * (éteint). Il prend la largeur que la page lui donne (`.timbre`).
 */
export function Timbre({ fete, millesime, etat, className }: { fete: CleDeSaison; millesime: number; etat: EtatDuTimbre; className?: string }) {
  const brut = useId()
  const s = saison(fete)
  if (!s) return null
  // `useId` rend des deux-points, que `url(#…)` n'aime pas ; le masque ne dépend de rien d'autre que sa forme.
  const masque = `timbre-trous-${brut.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const c = COULEURS[fete]
  // Un nom long — « Fête de la musique » — s'écrit plus petit : il tient dans le cadre.
  const taille = s.court.length > 12 ? 12.5 : 16
  return (
    <span className={`timbre timbre-${etat}${className ? ` ${className}` : ''}`} role="img" aria-label={`Timbre ${s.court} ${millesime}${ETAT_DIT[etat]}`}>
      <svg viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`} aria-hidden="true" focusable="false">
        <defs>
          <mask id={masque}>
            <rect width={LARGEUR} height={HAUTEUR} fill="#fff" />
            {TROUS.map(([x, y]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r={4.5} fill="#000" />
            ))}
          </mask>
        </defs>
        <g mask={`url(#${masque})`}>
          <rect width={LARGEUR} height={HAUTEUR} fill="#fbf6ea" />
          <rect x={MARGE} y={MARGE} width={LARGEUR - 2 * MARGE} height={HAUTEUR - 2 * MARGE} fill={c.fond} />
          <text x={17} y={24} fill={c.encre} className="timbre-marque">
            FIESTAPP
          </text>
          <text x={LARGEUR - 17} y={24} textAnchor="end" fill={c.encre} className="timbre-marque">
            {millesime}
          </text>
          <g transform="translate(28 32) scale(0.94)">{DESSINS[fete]}</g>
          <text x={LARGEUR / 2} y={HAUTEUR - 20} textAnchor="middle" fill={c.encre} className="timbre-nom" fontSize={taille}>
            {s.court}
          </text>
        </g>
        {etat === 'gagne' && <Cachet millesime={millesime} />}
      </svg>
    </span>
  )
}

/**
 * Le timbre qu'une partie vient de faire tomber — au quiz du jour, à la fin
 * d'une soirée : il rejoint son carnet, qu'un lien ouvre dans « Ma
 * collection ».
 */
export function TimbreGagne({ timbre }: { timbre: string }) {
  const t = timbreDe(timbre)
  if (!t) return null
  return (
    <section className="card timbre-tombe">
      <Timbre fete={t.saison.key} millesime={t.millesime} etat="gagne" />
      <div className="timbre-tombe-texte">
        <span className="label">Le carnet des fêtes</span>
        <b>{`Ton timbre ${t.saison.court} ${t.millesime}`}</b>
        <span className="muted small">Il rejoint ton carnet : un timbre par fête, chaque année.</span>
        <a className="link-inline" href="/profil#collection-timbres">
          Ouvrir mon carnet
        </a>
      </div>
    </section>
  )
}
