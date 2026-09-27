import { useId } from 'react'
import type { Finition } from '../../../shared/profil'
import { portrait as portraitDe, type CleDeBranche } from '../../../shared/branches'
import { Cercle } from './Cercle'
import { dessinDuPortrait, useDessins } from './medaillons'

/**
 * Les portraits des branches : soixante-douze avatars dessinés, qui se
 * gagnent en répondant juste (`shared/branches.ts`).
 *
 * Un même style pour tous, validé sur maquette : un disque teinté de sa
 * branche, un personnage de face, la lumière en haut à gauche. Pas d'anneau
 * d'or : il reste aux légendaires. Ils ne bougent pas — soixante-douze
 * dessins dans une grille, une salle qui en porte vingt : c'est la finition
 * qui tourne, pas eux.
 *
 * Chaque dessin vit dans le fichier de sa branche (`portraits/`) ; ici, le
 * cadre qu'ils partagent :
 *
 * - **porté**, il prend le cercle de la finition de son porteur, comme un
 *   légendaire (`Cercle.tsx`) — sauf en Mat, qui n'a pas de halo non plus
 *   sous un emoji ;
 * - **éclaté**, il passe sous le ciel rare de sa branche : le personnage
 *   garde ses couleurs — faire tourner les teintes comme celles d'un emoji
 *   rendait les visages verts —, c'est tout ce qui l'entoure qui change, et
 *   les paillettes de l'Éclat font le reste (`.av-eclat`) ;
 * - **pas encore gagné**, il n'en reste que la forme, en silhouette dorée
 *   sur un disque sombre, comme un légendaire : on sait ce qu'on veut avant
 *   de l'avoir.
 */

/**
 * Le ciel de l'Éclat, branche par branche : la couleur que la branche n'a
 * jamais, et que ses personnages n'ont pas non plus. La forêt passe à la
 * nuit violette — l'automne doré noyait l'écureuil et le cerf, roux comme
 * lui —, les océans aux abysses, la scène sous un projecteur turquoise.
 */
const CIELS_RARES: Record<CleDeBranche, [string, string, string]> = {
  monde: ['#f5a3ff', '#8e2fa8', '#260833'],
  mythes: ['#ff9a7a', '#a8182e', '#33040c'],
  oceans: ['#c9a4ff', '#4b1f8f', '#12052b'],
  espace: ['#ff9ad5', '#8a1f7a', '#260521'],
  foret: ['#b8a6ff', '#4a34a8', '#120a36'],
  ecran: ['#bfe3ff', '#2f5f9e', '#0a1a33'],
  scene: ['#8ff5e6', '#1f8f8a', '#06282a'],
  contes: ['#a8c8ff', '#2a4aa8', '#0a1438'],
  stade: ['#8fe0ff', '#1f6fb0', '#071f3a'],
  brigade: ['#c8f7c5', '#3f9a6a', '#0d2e1f'],
  arcade: ['#ff8ae2', '#9b1fa8', '#2a0633'],
  carnaval: ['#ffd36e', '#b0337a', '#2e0a26'],
}

/** Le disque d'un portrait qu'on n'a pas encore : sombre, sans ciel. */
const NUIT: [string, string, string] = ['#3a2c24', '#221a16', '#120d0b']

interface Props {
  /** La clé du portrait (`br:cerf`…). */
  cle: string
  /** Pas encore gagné : une silhouette dorée sur un disque sombre. */
  verrouille?: boolean
  /** La finition de celui qui le porte : elle devient son cercle. Absente, ou Mat, un simple filet. */
  finition?: Finition
  /** L'Éclat est tombé sur lui : il passe sous le ciel rare de sa branche. */
  eclat?: boolean
  className?: string
}

/** Un portrait des branches, à la taille du texte qui l'entoure (1 em). Rien, tant que son dessin n'est pas arrivé. */
export function Portrait({ cle, verrouille, finition, eclat, className }: Props) {
  const brut = useId()
  const dessin = dessinDuPortrait(useDessins(), cle)
  const p = portraitDe(cle)
  if (!p || !dessin) return null
  // Verrouillé, il n'a ni version éclatée ni cercle : il n'est pas encore à lui.
  const eclate = !!eclat && !verrouille
  const cercle = !!finition && finition !== 'mat' && !verrouille
  // `useId` rend des deux-points, que `url(#…)` n'aime pas. La clé du
  // portrait et son état entrent dans le préfixe : deux racines React
  // numérotent chacune depuis zéro, et le cerf éclaté de l'une prenait le
  // ciel du cerf ordinaire de l'autre — le premier dégradé d'un nom gagne.
  const etat = (verrouille ? 'v' : eclate ? 'e' : 'n') + (cercle ? 'c' : '')
  const u = `pt-${cle.slice(3)}-${etat}-${brut.replace(/[^a-zA-Z0-9-]/g, '')}-`
  const [a, b, c] = verrouille ? NUIT : eclate ? CIELS_RARES[p.branche] : dessin.fond
  const corps = dessin.corps(u)
  // Le disque, sa découpe — plus étroite sous un cercle, qui prend le bord —
  // et, verrouillé, la silhouette : le personnage passé en blanc sert de
  // masque à un dégradé d'or. Ses propres dégradés restent : une forme
  // remplie d'un dégradé absent ne se dessine pas, et manquerait au masque.
  let defs =
    `<radialGradient id="${u}_fond" cx="50%" cy="30%" r="80%"><stop offset="0" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></radialGradient>` +
    `<clipPath id="${u}_clip"><circle cx="50" cy="50" r="${cercle ? 45 : 48}"/></clipPath>` +
    (dessin.defs?.(u) ?? '')
  let scene = `<rect width="100" height="100" fill="url(#${u}_fond)"/>`
  if (verrouille) {
    defs +=
      `<linearGradient id="${u}_or" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3dca0"/><stop offset="1" stop-color="#a47c33"/></linearGradient>` +
      `<filter id="${u}_blanc" x="0" y="0" width="100" height="100" filterUnits="userSpaceOnUse"><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"/></filter>` +
      `<mask id="${u}_forme" x="0" y="0" width="100" height="100" maskUnits="userSpaceOnUse"><g filter="url(#${u}_blanc)">${corps}</g></mask>`
    scene += `<rect width="100" height="100" fill="url(#${u}_or)" mask="url(#${u}_forme)" opacity=".42"/>`
  } else {
    scene += (dessin.decor?.(u) ?? '') + corps
  }
  const classes = ['pt', `pt-${p.branche}`]
  if (verrouille) classes.push('pt-verrou')
  if (eclate) classes.push('pt-eclate')
  if (className) classes.push(className)
  const titre = verrouille ? `${p.nom} — pas encore gagné` : eclate ? `${p.nom}, éclaté` : p.nom
  return (
    <svg className={classes.join(' ')} viewBox="0 0 100 100" role="img" aria-label={titre}>
      <title>{titre}</title>
      {/* Des chaînes écrites à la main dans `portraits/`, jamais une donnée
          d'invité : posées d'un bloc, soixante-douze dessins d'une
          cinquantaine de formes ne font pas autant d'éléments React à
          comparer à chaque instantané de la salle. */}
      <defs dangerouslySetInnerHTML={{ __html: defs }} />
      {cercle && <Cercle finition={finition} id={nom => `${u}_${nom}`} />}
      <g clipPath={`url(#${u}_clip)`} dangerouslySetInnerHTML={{ __html: scene }} />
      {!cercle && <circle cx="50" cy="50" r="47.5" fill="none" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="0.9" />}
    </svg>
  )
}
