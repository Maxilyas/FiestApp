import { useId, useRef, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { HAUTEUR_DE_LA_CARTE, LARGEUR_DE_LA_CARTE, type Point } from '../../../../shared/cabinet/france'
import { CONTOUR_DE_LA_CORSE, CONTOUR_DE_LA_FRANCE, MILIEU_DE_LA_FRANCE, VILLES_REPERES, deplacer, estUneFleche, pointDuToucher, surLeDessin, traceDe } from './contourDeLaFrance'

// La carte de France du Cabinet (§ 3.1, § 3.10) : l'Épingle y plante la sienne,
// ses murs y posent les lieux qu'il a trouvés. Un SVG dessiné ici, sans
// bibliothèque : le contour de la métropole et de la Corse, sept villes
// repères, la projection de `shared/cabinet/france.ts` — celle-là même qui
// relit le toucher. Ce qui se pose dessus — l'épingle, la zone d'Éclairer, le
// lieu, le trait qui les joint, les lieux d'un mur —, chaque écran le pose
// (`children`), par les pièces d'en bas : la carte ne sait rien d'une manche, ni
// d'aucune réponse (invariant 1).
//
// Jouable, elle se touche au doigt — au lever, comme une réponse (`toucher`) :
// un doigt qui fait défiler la page la traverse sans rien planter, le
// navigateur lui retire son geste —, se clique à la souris, et se joue au
// clavier : les flèches mènent l'épingle, Maj à grands pas, Entrée la plante.
// Toute la largeur de l'écran : en 360 × 640, 324 pixels pour un dessin de 362,
// un pixel du doigt fait quatre kilomètres, et la grand-mère vise à quarante.

/** Le `click` qui suit un doigt déjà pris au lever n'est que son écho : il ne replante pas. La durée de `toucher`. */
const ECHO_MS = 800

/** Le dessin entier, et ce qu'il couvre : `pointDuToucher` relit un toucher à ses mesures. */
const DESSIN = { largeur: LARGEUR_DE_LA_CARTE, hauteur: HAUTEUR_DE_LA_CARTE } as const

/** Ce qu'une carte jouable fait d'un toucher, d'une flèche, d'Entrée. */
export interface CarteJouable {
  /** L'épingle d'à présent : d'où la mène une flèche — du milieu de la France, s'il n'y en a pas encore. */
  epingle: Point | null
  poser: (p: Point) => void
  planter: () => void
  /** Ce que l'oreille entend de la carte, et de l'épingle : la consigne, puis où elle est. */
  aide: string
}

/**
 * La carte de France, et ce que l'écran pose dessus. `nom` : ce qu'elle dit à
 * l'oreille quand elle ne se joue pas (« Ta carte de France : 3 lieux
 * épinglés ») ; jouable, elle s'annonce comme une carte qu'on touche, et dit
 * où est l'épingle (`CarteJouable.aide`).
 */
export function CarteDeFrance({ nom, jouable, children }: { nom: string; jouable?: CarteJouable; children?: ReactNode }) {
  const aide = useId()
  const dernierDoigt = useRef(Number.NEGATIVE_INFINITY)
  const dessin = (
    <svg className="cab-carte-dessin" viewBox={`0 0 ${LARGEUR_DE_LA_CARTE} ${HAUTEUR_DE_LA_CARTE}`} {...(jouable ? { 'aria-hidden': true } : { role: 'img', 'aria-label': nom })}>
      <rect className="cab-carte-mer" x="0" y="0" width={LARGEUR_DE_LA_CARTE} height={HAUTEUR_DE_LA_CARTE} rx="12" />
      <polygon className="cab-carte-terre" points={traceDe(CONTOUR_DE_LA_FRANCE)} />
      <polygon className="cab-carte-terre" points={traceDe(CONTOUR_DE_LA_CORSE)} />
      {VILLES_REPERES.map(v => {
        const { x, y } = surLeDessin(v)
        return (
          <g key={v.nom} className="cab-carte-ville">
            <circle cx={x} cy={y} r="3" />
            {v.nomA === 'droite' ? (
              <text x={x + 6} y={y - 5}>
                {v.nom}
              </text>
            ) : (
              <text x={x} y={y + 22} textAnchor="middle">
                {v.nom}
              </text>
            )}
          </g>
        )
      })}
      {children}
    </svg>
  )
  if (!jouable) return <div className="cab-carte-de-france">{dessin}</div>

  /** Un toucher, un clic : le point du dessin qu'il vise, dans le cadre de la France — mesuré sur le dessin même, pas sur son cadre. */
  const viser = (e: { clientX: number; clientY: number; currentTarget: Element }) =>
    jouable.poser(pointDuToucher({ x: e.clientX, y: e.clientY }, (e.currentTarget.querySelector('svg') ?? e.currentTarget).getBoundingClientRect(), DESSIN))
  const auLever = (e: PointerEvent<HTMLDivElement>) => {
    // La souris garde son clic ; un doigt levé hors de la carte (un toucher capturé suit le doigt) ne plante rien.
    if (e.pointerType === 'mouse' || e.button > 0) return
    const r = e.currentTarget.getBoundingClientRect()
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return
    dernierDoigt.current = e.timeStamp
    viser(e)
  }
  const auClic = (e: MouseEvent<HTMLDivElement>) => {
    if (e.timeStamp - dernierDoigt.current < ECHO_MS) return
    viser(e)
  }
  const auClavier = (e: KeyboardEvent<HTMLDivElement>) => {
    if (estUneFleche(e.key)) {
      e.preventDefault()
      jouable.poser(jouable.epingle ? deplacer(jouable.epingle, e.key, e.shiftKey) : MILIEU_DE_LA_FRANCE)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      jouable.planter()
    }
  }
  return (
    <>
      {/* Une carte qu'on touche et qu'on mène aux flèches : `application`, pour que le lecteur d'écran lui laisse ses flèches. */}
      <div
        className="cab-carte-de-france cab-carte-jouable"
        role="application"
        tabIndex={0}
        aria-label="La carte de France"
        aria-describedby={aide}
        onPointerUp={auLever}
        onClick={auClic}
        onKeyDown={auClavier}
        // L'appui long ouvrait le menu de l'image (l'enregistrer, la partager) par-dessus la carte.
        onContextMenu={e => e.preventDefault()}
      >
        {dessin}
      </div>
      <p id={aide} className="sr-only">
        {jouable.aide}
      </p>
    </>
  )
}

// ── Ce qui se pose sur la carte ───────────────────────────────────────────

/**
 * L'épingle : une goutte dont la pointe touche le point visé — le doigt la
 * cache en la plantant, sa tête dépasse au-dessus de lui. Son trou à la couleur
 * de la terre : elle se lit sur la mer comme sur la côte.
 */
export function DessinDeLEpingle({ point }: { point: Point }) {
  const { x, y } = surLeDessin(point)
  return <Goutte transform={`translate(${x} ${y})`} />
}

/** La goutte de l'épingle, sa pointe à l'origine : la carte la pose sur un point, une légende la montre seule. */
function Goutte({ transform }: { transform?: string }) {
  return (
    <g className="cab-carte-epingle" transform={transform}>
      <path d="M0 0 L-8.5 -19 A10.5 10.5 0 1 1 8.5 -19 Z" />
      <circle cx="0" cy="-23.5" r="3.8" />
    </g>
  )
}

/** L'épingle hors de la carte, à la taille d'une ligne de texte : ce que la légende et le pied de l'Épingle en disent. */
export function IconeDeLEpingle() {
  return (
    <svg className="cab-icone-carte" viewBox="-12 -36 24 38" aria-hidden="true">
      <Goutte />
    </svg>
  )
}

/** Le lieu, à la révélation et sur les murs : un point plein cerclé — sa forme, jamais sa seule couleur, le distingue de l'épingle. */
export function DessinDuLieu({ point, petit = false }: { point: Point; petit?: boolean }) {
  const { x, y } = surLeDessin(point)
  return <circle className="cab-carte-lieu" cx={x} cy={y} r={petit ? 5 : 7} />
}

/** Le lieu hors de la carte, pour la légende. */
export function IconeDuLieu() {
  return (
    <svg className="cab-icone-carte" viewBox="-9 -9 18 18" aria-hidden="true">
      <circle className="cab-carte-lieu" r="6" />
    </svg>
  )
}

/** Le trait de l'épingle au lieu, en tirets : la distance qu'il dit. */
export function DessinDuTrait({ de, a }: { de: Point; a: Point }) {
  const p = surLeDessin(de)
  const q = surLeDessin(a)
  return <line className="cab-carte-trait" x1={p.x} y1={p.y} x2={q.x} y2={q.y} />
}

/** La zone qu'Éclairer entoure, par son tour : un cercle de la Terre, que la projection ne dessine pas tout à fait rond. */
export function DessinDeLaZone({ tour }: { tour: readonly Point[] }) {
  return (
    <polygon
      className="cab-carte-zone"
      points={tour
        .map(p => {
          const { x, y } = surLeDessin(p)
          return `${x},${y}`
        })
        .join(' ')}
    />
  )
}
