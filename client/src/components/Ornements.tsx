import type { CSSProperties } from 'react'
import type { CleDOrnement, OrnementMontre, StyleDOrnement } from '../../../shared/ornements'
import { ORNEMENTS_PEINTS, type CalquePeint, type PlanDUnCalque } from './ornements-peints'

// Les ornements de sa niche (le choix du 19 octobre 2026, `shared/ornements.ts`) :
// après sa forme ultime, chaque palier en ajoute un, que la niche garde — une
// guirlande de petites lampes, du lierre et des fleurs au rebord, l'arche
// dorée et son étoile, un halo et son ciel qui scintille. Peints d'office
// (`ornements-peints.ts`, le Féerique), ou dessinés comme sur la maquette que
// le propriétaire a vue (`retours/2026-10-16/compagnon/maquette/paliers.js`) :
// l'un et l'autre dans le repère d'une niche de 54 × 62, ils suivent sa taille
// (`--l`), du coin de la page à sa fiche. Ce qui sort de l'arche — l'étoile,
// les feuilles, le halo — passe par-dessus son cadre, qui coupe tout le
// reste ; ce qui se pose derrière elle passe dessous. Le tout dans des SVG à
// la taille de la niche, qui débordent sans rien élargir : une image à la
// taille de son calque, posée de travers, aurait agrandi la feuille qui
// défile. Ni identifiant ni dégradé SVG : la même niche se dessine plusieurs
// fois par page (règle `medaillons.md`).

const L = 54
const H = 62

/** Le repère d'un calque peint : un carré de 120 unités, la niche au centre (`server/scripts/anime/ornements.ts`). */
const CALQUE = { x: -33, y: -29, cote: 120 }

/** Les calques peints de ces ornements posés à ces plans, chacun avec son ornement, dans l'ordre où ils se posent. */
function calquesA(montres: readonly OrnementMontre[], plans: readonly PlanDUnCalque[]): { cle: CleDOrnement; calque: CalquePeint }[] {
  return plans.flatMap(plan => montres.flatMap(m => (m.style === 'dessin' ? [] : ORNEMENTS_PEINTS[m.style][m.cle].filter(c => c.plan === plan).map(calque => ({ cle: m.cle, calque })))))
}

/** Les calques peints, dans le repère de la niche. `grand` : leurs grands fichiers, là où la niche se regarde. */
function Calques({ calques, grand }: { calques: readonly { cle: CleDOrnement; calque: CalquePeint }[]; grand: boolean }) {
  return (
    <>
      {calques.map(({ cle, calque }) => (
        <image
          key={calque.fichiers[1]}
          className={`orne-peint orne-peint-${cle}`}
          href={calque.fichiers[grand ? 0 : 1]}
          x={CALQUE.x}
          y={CALQUE.y}
          width={CALQUE.cote}
          height={CALQUE.cote}
        />
      ))}
    </>
  )
}

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
 * Ce qui se pose derrière sa niche — posé avant son cadre, il passe dessous :
 * le halo, dessiné ou peint, au fond, puis ce qui se peint derrière elle (le
 * lierre, touffu, qui déborde autour d'elle sans rien cacher d'elle).
 */
export function DerriereLaNiche({ montres, grand = false }: { montres: readonly OrnementMontre[]; grand?: boolean }) {
  const peints = calquesA(montres, ['fond', 'derriere'])
  return (
    <>
      {montres.some(m => m.cle === 'halo' && m.style === 'dessin') && <HaloDeLaNiche />}
      {peints.length > 0 && (
        <svg className="niche-ornements" viewBox={`0 0 ${L} ${H}`} aria-hidden="true" focusable="false">
          <Calques calques={peints} grand={grand} />
        </svg>
      )}
    </>
  )
}

/**
 * Ce qui se pose par-dessus sa niche, dans l'ordre : l'or peint de l'arche sur
 * son cadre, les ornements dessinés, son ciel qui scintille — peint ou
 * dessiné, le halo l'allume —, puis ce qui se peint devant elle (la guirlande,
 * l'étoile de l'arche par-dessus tout). L'arche dorée garde aussi l'or de son
 * cadre (`orne-or`).
 */
export function DevantLaNiche({ montres, grand = false }: { montres: readonly OrnementMontre[]; grand?: boolean }) {
  const cles = montres.filter(m => m.style === 'dessin').map(m => m.cle)
  const scintille = montres.some(m => m.cle === 'halo')
  const surLeCadre = calquesA(montres, ['cadre'])
  const devant = calquesA(montres, ['devant'])
  if (cles.length === 0 && !scintille && surLeCadre.length === 0 && devant.length === 0) return null
  return (
    <svg className="niche-ornements" viewBox={`0 0 ${L} ${H}`} aria-hidden="true" focusable="false">
      <Calques calques={surLeCadre} grand={grand} />
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
      {scintille && (
        <g className="orne orne-halo">
          {SCINTILLEMENTS.map(([x, y, r, d]) => (
            <path key={d} className="orne-scintille" d={etoile(x, y, r * 2)} fill="#fffbe6" style={{ animationDelay: `${d}s` }} />
          ))}
        </g>
      )}
      <Calques calques={devant} grand={grand} />
    </svg>
  )
}

/** Le halo de la légende, dessiné, qui respire à peine derrière sa niche : posé avant elle, il passe dessous. */
function HaloDeLaNiche() {
  return <span className="niche-halo" aria-hidden="true" />
}

/**
 * Un ornement seul, sur une petite niche vide, dans un style : ce que montre
 * son choix dans « Sa niche s'embellit » — caché, la niche vide. `taille` : la
 * largeur de la niche, en pixels.
 */
export function ApercuDOrnement({ cle, style, taille = 40 }: { cle: CleDOrnement; style: StyleDOrnement; taille?: number }) {
  const montres: OrnementMontre[] = style === 'cache' ? [] : [{ cle, style }]
  return (
    <span className="niche-apercu" style={{ '--l': `${taille}px` } as CSSProperties} aria-hidden="true">
      <DerriereLaNiche montres={montres} />
      <span className={'niche-cadre niche-cadre-vide' + (cle === 'arche' && style !== 'cache' ? ' orne-or' : '')}>
        <span className="niche-rebord" />
      </span>
      <DevantLaNiche montres={montres} />
    </span>
  )
}
