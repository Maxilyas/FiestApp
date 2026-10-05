import { useId } from 'react'
import type { Finition } from '../../../shared/profil'
import { portrait as portraitDe, type CleDeBranche } from '../../../shared/branches'
import { Cercle } from './Cercle'
import { dessinDuPortrait, useDessins } from './medaillons'
import type { ImageDePortrait } from './portraits/outils'

/**
 * Les portraits des branches : soixante-douze avatars peints, qui se
 * gagnent sur les sentiers du savoir de la campagne (`shared/branches.ts`,
 * `shared/sentiers.ts`).
 *
 * Un style d'image par branche — l'affiche de voyage, l'anime, l'estampe… —
 * et un ingrédient de plus à chaque palier (« La montée en puissance ») : le
 * visage, détouré sur le disque teinté de sa branche ; puis le décor, peint
 * derrière lui ; le geste ; la lumière, sous un anneau d'argent ; le débord,
 * qui sort du disque par le haut ; et la forme ultime, sous l'anneau d'or,
 * dans une aura qui respire. Chaque portrait vit dans le fichier de sa
 * branche (`portraits/`, écrit par `server/scripts/anime/livrer.ts`) ; ici,
 * le cadre qu'ils partagent :
 *
 * - **porté**, il prend le cercle de la finition de son porteur, comme un
 *   légendaire (`Cercle.tsx`) — sauf en Mat, qui n'a pas de halo non plus
 *   sous un emoji : l'anneau du palier reste ; ce qui déborde passe
 *   par-dessus l'un comme l'autre ;
 * - **éclaté**, il passe sous le ciel rare de sa branche : le personnage
 *   garde ses couleurs — faire tourner les teintes comme celles d'un emoji
 *   rendait les visages verts —, c'est tout ce qui l'entoure qui change, et
 *   les paillettes de l'Éclat font le reste (`.av-eclat`) ;
 * - **pas encore gagné**, il n'en reste que la forme, en silhouette dorée
 *   sur un disque sombre, comme un légendaire — qui déborde déjà : on sait
 *   ce qu'on veut avant de l'avoir.
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

// ── Les portraits peints ──────────────────────────────────────────────────

/**
 * Le cadre du personnage peint, palier par palier (origine, côté, dans le
 * repère du disque) : le carré du disque, ou plus large aux deux derniers,
 * dont il sort. Ce sont ceux de `server/scripts/anime/portraits.ts`.
 */
const CADRE_PERSO: readonly [number, number][] = [[0, 100], [0, 100], [0, 100], [0, 100], [-20, 140], [-20, 140]]

/**
 * La zone d'où il sort du disque, aux deux derniers paliers (x, y, largeur,
 * hauteur) : tout le haut, jusqu'aux épaules — jusqu'au buste pour la forme
 * ultime, dont les ailes s'ouvrent plus bas. Le buste, lui, reste dans le
 * disque. Son bord s'estompe (`_fondu`) et finit avant celui de l'image
 * peinte (de −15,8 à 115,8 au cinquième palier, de −9,5 à 109,5 au sixième) :
 * au-delà, les runes du mage et la cape du chevalier s'arrêtaient net, en
 * ligne droite.
 */
const DEBORD: readonly ([number, number, number, number] | null)[] = [null, null, null, null, [-10, -10, 120, 74], [-4, -4, 108, 84]]

/** Les anneaux des paliers : l'argent de la lumière et du débord, l'or de la forme ultime. */
const METAL: Record<'argent' | 'or', [string, string, string]> = {
  argent: ['#ffffff', '#c3ccd8', '#5f6a7c'],
  or: ['#fff4c7', '#e3b04b', '#8a5a10'],
}

/** Une étoile à quatre branches, centrée en (x, y) : celles de la forme ultime scintillent. */
const etoile = (x: number, y: number, r: number) => {
  const t = r * 0.25
  return `<path class="pt-etoile" d="M${x},${y - r} L${x + t},${y - t} L${x + r},${y} L${x + t},${y + t} L${x},${y + r} L${x - t},${y + t} L${x - r},${y} L${x - t},${y - t} Z" fill="#fff4c7" opacity=".95"/>`
}

/** Les étoiles de la forme ultime, autour de son anneau : (x, y, rayon). */
const ETOILES: readonly [number, number, number][] = [
  [9, 20, 3.4],
  [91, 27, 2.6],
  [4, 64, 2.2],
  [96, 72, 2.8],
  [27, 1, 2],
]

interface EtatPeint {
  verrouille: boolean
  eclate: boolean
  /** Un cercle de finition le porte : il remplace l'anneau du palier. */
  cercle: boolean
  grand: boolean
  /** Le ciel rare de sa branche, pour l'Éclat. */
  rare: [string, string, string]
}

const canal = (hex: string, k: number) => (parseInt(hex.slice(1 + 2 * k, 3 + 2 * k), 16) / 255).toFixed(3)

/**
 * Un portrait peint, calque par calque : `avant` derrière tout (l'aura),
 * `scene` dans le disque, `apres` par-dessus (l'anneau, le débord, les
 * étoiles). Tout en chaînes, comme les dessins : des fichiers du dépôt,
 * jamais une donnée d'invité.
 */
function peint(image: ImageDePortrait, palier: number, u: string, e: EtatPeint) {
  const taille = e.grand ? 0 : 1
  const [o, cote] = CADRE_PERSO[palier] ?? CADRE_PERSO[0]
  const perso = `<image href="${image.perso[taille]}" x="${o}" y="${o}" width="${cote}" height="${cote}"/>`
  const metal = palier === 5 ? 'or' : palier >= 3 ? 'argent' : null
  const anneau = !!metal && !e.cercle
  // Le disque cède son bord au cercle d'une finition, ou à l'anneau du palier.
  const rayon = e.cercle ? 45 : anneau ? 46.4 : 48
  const grand = 'x="-40" y="-40" width="180" height="180"'
  let defs = ''
  let avant = ''
  let apres = ''
  // Verrouillé, la silhouette : le personnage passé en blanc sert de masque
  // à un dégradé d'or. Le masque couvre aussi ce qui déborde.
  const silhouette = `<rect ${grand} fill="url(#${u}_or)" mask="url(#${u}_forme)" opacity=".42"/>`
  if (e.verrouille) {
    defs +=
      `<linearGradient id="${u}_or" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3dca0"/><stop offset="1" stop-color="#a47c33"/></linearGradient>` +
      `<filter id="${u}_blanc" ${grand} filterUnits="userSpaceOnUse"><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"/></filter>` +
      `<mask id="${u}_forme" ${grand} maskUnits="userSpaceOnUse"><g filter="url(#${u}_blanc)">${perso}</g></mask>`
  }
  let scene = `<rect ${grand} fill="url(#${u}_fond)"/>`
  if (e.verrouille) scene += silhouette
  else if (!image.disque) scene += perso
  else if (!e.eclate) scene += `<image href="${image.disque[taille]}" x="0" y="0" width="100" height="100"/>`
  else {
    // Éclaté, le décor passe sous le ciel rare de sa branche — sa lumière
    // devient ses couleurs, du sombre au clair —, et le personnage, posé
    // par-dessus, garde les siennes.
    const [clair, moyen, sombre] = e.rare
    const table = (k: number) => `tableValues="${canal(sombre, k)} ${canal(moyen, k)} ${canal(clair, k)}"`
    defs +=
      `<filter id="${u}_rare" x="0" y="0" width="100" height="100" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">` +
      `<feColorMatrix type="matrix" values=".2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 0 0 0 1 0"/>` +
      `<feComponentTransfer><feFuncR type="table" ${table(0)}/><feFuncG type="table" ${table(1)}/><feFuncB type="table" ${table(2)}/></feComponentTransfer></filter>`
    scene += `<image href="${image.disque[taille]}" x="0" y="0" width="100" height="100" filter="url(#${u}_rare)"/>` + perso
  }
  if (palier === 5 && !e.verrouille) {
    defs += `<radialGradient id="${u}_aura" gradientUnits="userSpaceOnUse" cx="50" cy="52" r="62"><stop offset=".6" stop-color="#ffd76a" stop-opacity=".55"/><stop offset="1" stop-color="#ffd76a" stop-opacity="0"/></radialGradient>`
    avant += `<circle class="pt-aura" cx="50" cy="52" r="62" fill="url(#${u}_aura)"/>`
  }
  if (anneau) {
    const [a, b, c] = METAL[metal]
    defs += `<linearGradient id="${u}_anneau" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".5" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient>`
    apres += e.verrouille
      ? `<circle cx="50" cy="50" r="47.2" fill="none" stroke="#d9b56a" stroke-width=".9" opacity=".45"/>`
      : `<circle cx="50" cy="50" r="47.2" fill="none" stroke="url(#${u}_anneau)" stroke-width="2.2"/>`
  } else if (!e.cercle) {
    apres += `<circle cx="50" cy="50" r="47.5" fill="none" stroke="#ffffff" stroke-opacity="0.18" stroke-width="0.9"/>`
  }
  const zone = DEBORD[palier]
  if (zone) {
    const [x, y, l, h] = zone
    // Ce qui sort, par-dessus l'anneau — le trident le perce. Moins le
    // disque, net, avec un demi-point de recouvrement : sinon l'anticrénelage
    // des deux découpes laissait un fil au ras de l'anneau.
    defs +=
      `<filter id="${u}_fondu" ${grand} filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="3"/></filter>` +
      `<mask id="${u}_dehors" ${grand} maskUnits="userSpaceOnUse"><g filter="url(#${u}_fondu)"><rect x="${x}" y="${y}" width="${l}" height="${h}" fill="#fff"/></g>` +
      `<circle cx="50" cy="50" r="${rayon - 0.5}" fill="#000"/></mask>`
    apres += `<g class="pt-debord" mask="url(#${u}_dehors)">${e.verrouille ? silhouette : perso}</g>`
  }
  if (palier === 5 && !e.verrouille) apres += ETOILES.map(([x, y, r]) => etoile(x, y, r)).join('')
  return { defs, avant, scene, apres, rayon }
}

interface Props {
  /** La clé du portrait (`br:cerf`…). */
  cle: string
  /** Pas encore gagné : une silhouette dorée sur un disque sombre. */
  verrouille?: boolean
  /** La finition de celui qui le porte : elle devient son cercle. Absente, ou Mat, l'anneau de son palier — un simple filet aux trois premiers. */
  finition?: Finition
  /** L'Éclat est tombé sur lui : il passe sous le ciel rare de sa branche. */
  eclat?: boolean
  /** Regardé en grand — la fin de soirée, la carte — : un portrait peint prend ses grands fichiers. */
  grand?: boolean
  className?: string
}

/** Un portrait des branches, à la taille du texte qui l'entoure (1 em). Rien, tant que son dessin n'est pas arrivé. */
export function Portrait({ cle, verrouille, finition, eclat, grand, className }: Props) {
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
  const classes = ['pt', `pt-${p.branche}`]
  if (verrouille) classes.push('pt-verrou')
  if (eclate) classes.push('pt-eclate')
  if (className) classes.push(className)
  const titre = verrouille ? `${p.nom} — pas encore gagné` : eclate ? `${p.nom}, éclaté` : p.nom
  const disque =
    `<radialGradient id="${u}_fond" cx="50%" cy="30%" r="80%"><stop offset="0" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></radialGradient>`
  const palier = p.rang
  classes.push(`pt-palier-${palier + 1}`)
  const { defs, avant, scene, apres, rayon } = peint(dessin.image, palier, u, {
    verrouille: !!verrouille,
    eclate,
    cercle,
    grand: !!grand,
    rare: CIELS_RARES[p.branche],
  })
  return (
    <svg className={classes.join(' ')} viewBox="0 0 100 100" role="img" aria-label={titre}>
      <title>{titre}</title>
      {/* Des chaînes écrites dans ce fichier et dans `portraits/`, jamais une
          donnée d'invité : posées d'un bloc, elles ne font pas autant
          d'éléments React à comparer à chaque instantané de la salle. */}
      <defs dangerouslySetInnerHTML={{ __html: disque + `<clipPath id="${u}_clip"><circle cx="50" cy="50" r="${rayon}"/></clipPath>` + defs }} />
      {avant && <g dangerouslySetInnerHTML={{ __html: avant }} />}
      {cercle && <Cercle finition={finition} id={nom => `${u}_${nom}`} />}
      <g clipPath={`url(#${u}_clip)`} dangerouslySetInnerHTML={{ __html: scene }} />
      {apres && <g dangerouslySetInnerHTML={{ __html: apres }} />}
    </svg>
  )
}
