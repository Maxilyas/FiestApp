import type { CSSProperties } from 'react'
import type { Finition } from '../../../shared/profil'
import { metalDeLaFinition, type Metal } from './metaux'

// Le sceau d'un légendaire : l'étoile du zénith (la planche validée par le
// propriétaire le 9 novembre 2026, `retours/2026-11-09/sceau/`). Le légendaire
// qu'on tient par sa voie d'origine — pas seulement par le raccourci du
// Cabinet — la porte au sommet de son cercle : une étoile de navigation
// taillée, sa pierre au cœur, dans le métal de la finition portée, celui que
// la bordure de ligue prend déjà (`metaux.ts`). Sur une bordure, elle la
// couronne. Elle fait partie de la tenue : le haut du cercle était le seul
// endroit libre — l'Éclat a son coin en bas, la gemme du niveau et le
// compagnon les coins de la carte.
//
// Des images faites une fois par finition et gardées, comme les bordures :
// quarante scellés d'une salle partagent la même, sans un identifiant de
// dégradé qu'un avatar caché garderait pour lui. Ce qui bouge — le halo qui
// respire, les rayons qui tournent, la lueur qui fait le tour du cercle — est
// un calque à part, qui ne bouge que par `transform` et `opacity` (`styles.css`),
// se fige dans une liste et s'arrête si le système demande moins de mouvement.
//
// Vient avec le dessin des légendaires (`Legendaire.tsx` l'inscrit) : un
// sceau ne se porte que sur un légendaire, et une salle d'anonymes n'en
// télécharge rien.

/** Les branches d'une étoile de navigation, autour de (40, 40) : quatre longues, quatre moyennes, et leurs creux. */
function branches(r: number, moyenne: number, creux: number): string {
  const p: string[] = []
  for (let i = 0; i < 16; i++) {
    const a = (Math.PI / 8) * i - Math.PI / 2
    const rr = i % 4 === 0 ? r : i % 2 === 0 ? moyenne : creux
    p.push(`${(40 + Math.cos(a) * rr).toFixed(2)},${(40 + Math.sin(a) * rr).toFixed(2)}`)
  }
  return p.join(' ')
}

const degrade = (id: string, mt: Metal) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">${mt.m.map((c, i) => `<stop offset="${i * 25}%" stop-color="${c}"/>`).join('')}</linearGradient>`

/** L'étoile taillée : ses branches au métal, l'arête de chacune dans l'ombre, la pierre au cœur à la lueur de la finition. */
export function svgDeLEtoile(finition: Finition): string {
  const mt = metalDeLaFinition(finition)
  // Les arêtes : la moitié de chaque grande branche dans l'ombre — l'étoile est taillée, pas plate.
  const aretes = [0, 1, 2, 3]
    .map(k => {
      const a = (Math.PI / 2) * k - Math.PI / 2
      const b = a + Math.PI / 8
      return `<polygon points="40,40 ${(40 + Math.cos(a) * 25).toFixed(2)},${(40 + Math.sin(a) * 25).toFixed(2)} ${(40 + Math.cos(b) * 5.6).toFixed(2)},${(40 + Math.sin(b) * 5.6).toFixed(2)}" fill="${mt.bord}" opacity="0.4"/>`
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><defs>${degrade('m', mt)}
    <radialGradient id="p" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#fff"/><stop offset="0.4" stop-color="${mt.lueur}"/><stop offset="1" stop-color="${mt.m[2]}"/></radialGradient></defs>
    <polygon points="${branches(25, 11, 5.4)}" fill="url(#m)" stroke="${mt.bord}" stroke-width="1.4" stroke-linejoin="round"/>
    ${aretes}
    <polygon points="${branches(12, 7.5, 3.6)}" transform="rotate(22.5 40 40)" fill="url(#m)" stroke="${mt.bord}" stroke-width="0.9" stroke-linejoin="round" opacity="0.95"/>
    <circle cx="40" cy="40" r="6" fill="url(#p)" stroke="${mt.bord}" stroke-width="1.1"/></svg>`
}

/** Ses rayons : seize traits de lumière, longs et courts, qui tournent lentement là où l'avatar est le sujet. */
export function svgDesRayons(finition: Finition): string {
  const { lueur } = metalDeLaFinition(finition)
  const traits = Array.from({ length: 16 }, (_, i) => {
    const a = (Math.PI / 8) * i
    const r = i % 2 === 0 ? 39 : 31
    return `<line x1="${(40 + Math.cos(a) * 9).toFixed(2)}" y1="${(40 + Math.sin(a) * 9).toFixed(2)}" x2="${(40 + Math.cos(a) * r).toFixed(2)}" y2="${(40 + Math.sin(a) * r).toFixed(2)}" stroke="${lueur}" stroke-width="${i % 2 === 0 ? 1.1 : 0.7}" stroke-linecap="round" opacity="0.55"/>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">${traits}</svg>`
}

const enImage = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`
const etoiles = new Map<Finition, string>()
const rayons = new Map<Finition, string>()
const garde = (cache: Map<Finition, string>, finition: Finition, faire: (f: Finition) => string) => {
  let src = cache.get(finition)
  if (!src) cache.set(finition, (src = enImage(faire(finition))))
  return src
}

/**
 * L'étoile du zénith, posée dans la boîte d'un médaillon (`Avatar`) : au
 * sommet de son cercle, ou de sa bordure. Décorative : ce qu'elle dit — le
 * légendaire tenu par son exploit — se dit en mots là où on le lit (la carte,
 * l'album).
 */
export function Sceau({ finition }: { finition: Finition }) {
  const { lueur } = metalDeLaFinition(finition)
  return (
    <>
      <i className="sc-tour" style={{ '--sc-lueur': lueur } as CSSProperties} aria-hidden="true" />
      <span className="sc" style={{ '--sc-lueur': lueur } as CSSProperties} aria-hidden="true">
        <i className="sc-halo" />
        <img className="sc-rayons" src={garde(rayons, finition, svgDesRayons)} alt="" draggable={false} />
        <img className="sc-etoile" src={garde(etoiles, finition, svgDeLEtoile)} alt="" draggable={false} />
      </span>
    </>
  )
}
