import type { CSSProperties } from 'react'
import type { CleDOrnement } from '../../../shared/ornements'

// Les ornements de sa niche (le choix du 19 octobre 2026, `shared/ornements.ts`) :
// après sa forme ultime, chaque palier en ajoute un, que la niche garde — une
// guirlande de petites lampes, du lierre et des fleurs au rebord, l'arche
// dorée et son étoile, un halo et son ciel qui scintille. Dessinés comme sur
// la maquette que le propriétaire a vue
// (`retours/2026-10-16/compagnon/maquette/paliers.js`), dans le repère d'une
// niche de 54 × 62 : ils suivent sa taille (`--l`), du coin de la page à sa
// fiche. Ce qui sort de l'arche — l'étoile, les feuilles, le halo — passe
// par-dessus son cadre, qui coupe tout le reste. Des versions peintes
// viendront, en plusieurs styles. Ni identifiant ni dégradé SVG : la même
// niche se dessine plusieurs fois par page (règle `medaillons.md`).

const L = 54
const H = 62

const arrondi = (n: number) => Math.round(n * 100) / 100

/** Une étoile à quatre branches, centrée sur (x, y). */
function etoile(x: number, y: number, r: number): string {
  const t = r * 0.28
  return `M${arrondi(x)},${arrondi(y - r)} L${arrondi(x + t)},${arrondi(y - t)} L${arrondi(x + r)},${arrondi(y)} L${arrondi(x + t)},${arrondi(y + t)} L${arrondi(x)},${arrondi(y + r)} L${arrondi(x - t)},${arrondi(y + t)} L${arrondi(x - r)},${arrondi(y)} L${arrondi(x - t)},${arrondi(y - t)} Z`
}

// La guirlande : un fil qui suit l'arche, une cubique d'un flanc à l'autre,
// et ses lampes posées sur la même courbe, un peu sous lui.
const FIL = `M-2,${arrondi(H * 0.42)} C-2,-8 ${L + 2},-8 ${L + 2},${arrondi(H * 0.42)}`
const COULEURS_DES_LAMPES = ['#ffd27a', '#ffb3a7', '#bfe8ff', '#ffd27a', '#d9f5a6', '#ffb3a7', '#ffd27a']
const LAMPES = [0.08, 0.22, 0.36, 0.5, 0.64, 0.78, 0.92].map((t, k) => {
  const u = 1 - t
  const x = u * u * u * -2 + 3 * u * u * t * -2 + 3 * u * t * t * (L + 2) + t * t * t * (L + 2)
  const y = u * u * u * (H * 0.42) + 3 * u * u * t * -8 + 3 * u * t * t * -8 + t * t * t * (H * 0.42)
  return { x: arrondi(x), y: arrondi(y + 2.4), couleur: COULEURS_DES_LAMPES[k], delai: `${arrondi(k * 0.45)}s` }
})

/** Une feuille de lierre, de sa tige à sa pointe : `l` de long, tournée de `angle`. */
function Feuille({ x, y, angle, l = 7 }: { x: number; y: number; angle: number; l?: number }) {
  return (
    <path
      transform={`translate(${x} ${y}) rotate(${angle})`}
      d={`M0,0 C${arrondi(l * 0.35)},-${arrondi(l * 0.45)} ${arrondi(l * 0.8)},-${arrondi(l * 0.35)} ${l},0 C${arrondi(l * 0.8)},${arrondi(l * 0.35)} ${arrondi(l * 0.35)},${arrondi(l * 0.45)} 0,0 Z`}
      fill="#6fae5c"
    />
  )
}

/** Une petite fleur : cinq pétales et son cœur d'or. */
function Fleur({ x, y, r, couleur }: { x: number; y: number; r: number; couleur: string }) {
  return (
    <>
      {[0, 72, 144, 216, 288].map(a => (
        <circle key={a} cx={arrondi(x + Math.cos((a * Math.PI) / 180) * r)} cy={arrondi(y + Math.sin((a * Math.PI) / 180) * r)} r={arrondi(r * 0.82)} fill={couleur} />
      ))}
      <circle cx={x} cy={y} r={arrondi(r * 0.6)} fill="#ffd36a" />
    </>
  )
}

/** Son ciel qui scintille, à la légende : quatre étincelles, chacune à son heure. */
const SCINTILLEMENTS = [
  [L * 0.18, H * 0.2, 1.8, 0],
  [L * 0.84, H * 0.3, 1.5, 0.8],
  [L * 0.3, H * 0.52, 1.2, 1.5],
  [L * 0.74, H * 0.6, 1.6, 2.1],
] as const

/**
 * Les ornements dessinés sur sa niche, dans l'ordre de leurs paliers. Le halo
 * se pose derrière elle (`HaloDeLaNiche`), et l'arche dorée sur son cadre
 * (`orne-or`) : ici, ce qui se dessine par-dessus.
 */
export function DessinDesOrnements({ cles }: { cles: readonly CleDOrnement[] }) {
  if (cles.length === 0) return null
  return (
    <svg className="niche-ornements" viewBox={`0 0 ${L} ${H}`} aria-hidden="true" focusable="false">
      {cles.includes('guirlande') && (
        <g className="orne orne-guirlande">
          <path d={FIL} fill="none" stroke="#5a4632" strokeWidth={1} />
          {LAMPES.map(l => (
            <g key={l.x} className="orne-lampe" style={{ animationDelay: l.delai }}>
              <circle cx={l.x} cy={l.y} r={3.6} fill={l.couleur} opacity={0.35} />
              <circle cx={l.x} cy={l.y} r={1.8} fill={l.couleur} />
            </g>
          ))}
        </g>
      )}
      {cles.includes('lierre') && (
        <g className="orne orne-lierre">
          <Feuille x={-3} y={H - 4} angle={200} />
          <Feuille x={-1} y={H - 1} angle={150} l={6} />
          <Fleur x={3} y={H - 6} r={2.2} couleur="#f7a8c4" />
          <Feuille x={L + 3} y={H - 4} angle={-20} />
          <Feuille x={L + 1} y={H - 1} angle={30} l={6} />
          <Fleur x={L - 4} y={H - 6} r={2.2} couleur="#c9b6ff" />
        </g>
      )}
      {cles.includes('arche') && (
        <g className="orne orne-arche">
          {/* Sa lueur en deux voiles à peine posés : un seul, plus franc, se lisait comme un disque gris derrière l'étoile. */}
          <circle cx={L / 2} cy={-9} r={8} fill="#ffe9a8" opacity={0.06} />
          <circle cx={L / 2} cy={-9} r={5.5} fill="#ffe9a8" opacity={0.1} />
          <path d={etoile(L / 2, -9, 5.5)} fill="#ffe9a8" />
        </g>
      )}
      {cles.includes('halo') && (
        <g className="orne orne-halo">
          {SCINTILLEMENTS.map(([x, y, r, d]) => (
            <path key={d} className="orne-scintille" d={etoile(x, y, r * 2)} fill="#fffbe6" style={{ animationDelay: `${d}s` }} />
          ))}
        </g>
      )}
    </svg>
  )
}

/** Le halo de la légende, qui respire à peine derrière sa niche : posé avant elle, il passe dessous. */
export function HaloDeLaNiche() {
  return <span className="niche-halo" aria-hidden="true" />
}

/**
 * Un ornement seul, sur une petite niche vide : ce que montre ou cache sa
 * case dans « Ma niche ». `taille` : la largeur de la niche, en pixels.
 */
export function ApercuDOrnement({ cle, taille = 40 }: { cle: CleDOrnement; taille?: number }) {
  return (
    <span className="niche-apercu" style={{ '--l': `${taille}px` } as CSSProperties} aria-hidden="true">
      {cle === 'halo' && <HaloDeLaNiche />}
      <span className={'niche-cadre niche-cadre-vide' + (cle === 'arche' ? ' orne-or' : '')}>
        <span className="niche-rebord" />
      </span>
      <DessinDesOrnements cles={[cle]} />
    </span>
  )
}
