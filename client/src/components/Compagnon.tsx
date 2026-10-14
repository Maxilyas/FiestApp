import { useId, useMemo } from 'react'
import type { Finition } from '../../../shared/profil'
import { formeDeCompagnon, type CleDeCompagnon } from '../../../shared/compagnons'
import { Cercle } from './Cercle'
import { dessinDuCompagnon, useDessins } from './medaillons'

/**
 * Les compagnons : des avatars peints qu'on achète en boutique, et qui
 * grandissent avec les bonnes réponses données en les portant
 * (`shared/compagnons.ts`).
 *
 * Quatre formes du même individu, et la rareté monte avec elles : la
 * première, seule sur son disque teinté, sous un simple filet ; la deuxième
 * dans son décor, sous l'anneau rare ; la troisième qui sort du cercle par le
 * haut, sous l'anneau épique ; la forme ultime sous l'anneau légendaire, dans
 * une aura qui respire — et son monde prend vie : des couches peintes à part,
 * de la lumière (les rubans d'étoiles du loup, les feux d'artifice du chat)
 * ou des envols (les oiseaux de la tortue), qui bougent seules et sortent du
 * cercle. Le chat et la tortue en sortent tout entiers, leur monde avec eux.
 *
 * Il se dessine dans le cadre d'un portrait des branches (`.pt`) : un disque
 * peint, ce qui en sort (`.pt-debord`), son aura (`.pt-aura`), ses étoiles
 * (`.pt-etoile`) — il en prend les tailles, et tout ce qui le fige ou le
 * resserre dans une liste, où il tient dans son disque. Son monde vivant
 * passe avec ce qui déborde : jamais dans une liste. Porté, la finition
 * devient son cercle, comme un portrait ; pas encore à lui, sa silhouette
 * dorée sur un disque sombre.
 */

export interface DessinDeCompagnon {
  /**
   * Le décor de la forme, sur le carré 0 → 100 que le disque découpe.
   * Absent à la première forme, peinte seule : le disque teinté la reçoit.
   */
  disque?: [string, string]
  /** L'animal seul, détouré, dans son cadre (`CADRE`) : sa forme fait la silhouette, et c'est lui qui sort du disque. */
  perso: [string, string]
  /** Le monde vivant de la forme ultime, couche par couche (`ALLURES`). */
  vivant?: Record<string, [string, string]>
}

/**
 * Une couche du monde vivant : comment elle bouge, où elle se pose. Sa
 * lumière, peinte sur du noir, arrive sans lui (`livrer-compagnons.ts`) :
 * posée en `screen`, son noir ne s'effaçait que dans le calque où elle était
 * peinte, et la carte d'un joueur, isolée, montrait son carré noir.
 */
interface Couche {
  cle: string
  mouvement: 'tourne' | 'pulse' | 'monte' | 'derive' | 'vole'
  /** Son côté, en unités du disque (100) : elle en sort. */
  taille: number
  /** Devant l'animal, ou derrière lui. */
  devant: boolean
}

/** Ce que chaque compagnon a à lui : le disque de sa première forme, l'aura et le monde de sa forme ultime. */
interface Allure {
  fond: [string, string, string]
  aura: string
  /** Sa forme ultime sort du disque tout entière, son monde avec elle. */
  entiere: boolean
  vivant: Couche[]
}

const ALLURES: Record<CleDeCompagnon, Allure> = {
  loup: {
    fond: ['#9fc1e6', '#2b4470', '#0c1630'],
    aura: '#9ec8ff',
    entiere: false,
    vivant: [{ cle: 'rubans', mouvement: 'tourne', taille: 170, devant: true }],
  },
  chat: {
    fond: ['#f6c48f', '#7a3b52', '#22101a'],
    aura: '#ffb36b',
    entiere: true,
    vivant: [
      { cle: 'feux', mouvement: 'pulse', taille: 176, devant: false },
      { cle: 'lanternes', mouvement: 'monte', taille: 166, devant: true },
    ],
  },
  tortue: {
    fond: ['#9fe0d6', '#1f6f78', '#0a2a33'],
    aura: '#9ff0e0',
    entiere: true,
    vivant: [
      { cle: 'brume', mouvement: 'derive', taille: 176, devant: true },
      { cle: 'oiseaux', mouvement: 'vole', taille: 168, devant: true },
    ],
  },
}

/**
 * Le cadre de l'animal peint, forme par forme (origine, côté, dans le repère
 * du disque) : le carré du disque, ou plus large aux deux dernières, dont il
 * sort. Ce sont ceux de `server/scripts/anime/compagnons.ts` ; une forme
 * ultime entière a le sien (`ENTIERE`).
 */
const CADRE: readonly [number, number][] = [
  [0, 100],
  [0, 100],
  [-20, 140],
  [-20, 140],
]
const ENTIERE: [number, number] = [-22, 144]

/**
 * La zone d'où il sort du disque (x, y, largeur, hauteur) : la tête et les
 * oreilles de l'adulte, jusqu'au poitrail pour la forme ultime. Estompée
 * avant le bord de l'image peinte, comme celle d'un portrait.
 */
const DEBORD: readonly ([number, number, number, number] | null)[] = [null, null, [-10, -10, 120, 74], [-4, -4, 108, 84]]

/** L'anneau de chaque forme : la couleur de sa rareté — celle des gemmes de la boutique et de l'album. */
const ANNEAU: readonly (string | null)[] = [null, '#5fa8ff', '#b77bff', '#f2b84b']

/** Le disque d'une forme qu'on n'a pas encore : sombre, sans décor. */
const NUIT: [string, string, string] = ['#3a2c24', '#221a16', '#120d0b']

/** Les étoiles de la forme ultime du loup, autour de son anneau : (x, y, rayon). */
const ETOILES: readonly [number, number, number][] = [
  [9, 20, 3.4],
  [91, 27, 2.6],
  [4, 64, 2.2],
  [96, 72, 2.8],
  [27, 1, 2],
]

const etoile = (x: number, y: number, r: number) => {
  const t = r * 0.25
  return `<path class="pt-etoile" d="M${x},${y - r} L${x + t},${y - t} L${x + r},${y} L${x + t},${y + t} L${x},${y + r} L${x - t},${y + t} L${x - r},${y} L${x - t},${y - t} Z" fill="#fff4c7" opacity=".95"/>`
}

interface EtatPeint {
  verrouille: boolean
  /** Un cercle de finition le porte : il remplace l'anneau de la forme. */
  cercle: boolean
  grand: boolean
}

/**
 * Un compagnon peint, calque par calque, comme un portrait : `avant`
 * derrière tout (l'aura, le monde qui passe derrière lui), `scene` dans le
 * disque, `apres` par-dessus (l'anneau, ce qui sort, le monde devant lui, les
 * étoiles). Tout en chaînes : des fichiers du dépôt, jamais une donnée d'invité.
 */
function peint(dessin: DessinDeCompagnon, rang: number, allure: Allure, u: string, e: EtatPeint) {
  const taille = e.grand ? 0 : 1
  const entiere = rang === 3 && allure.entiere
  const [o, cote] = entiere ? ENTIERE : CADRE[rang]
  const perso = `<image href="${dessin.perso[taille]}" x="${o}" y="${o}" width="${cote}" height="${cote}"/>`
  const anneau = ANNEAU[rang]
  // Le disque cède son bord au cercle d'une finition, ou à l'anneau de la forme.
  const rayon = e.cercle ? 45 : anneau ? 46.4 : 48
  const grand = 'x="-60" y="-60" width="220" height="220"'
  let defs = ''
  let avant = ''
  let apres = ''
  // Verrouillé, la silhouette : l'animal passé en blanc sert de masque à un
  // dégradé d'or. Le masque couvre aussi ce qui déborde.
  const silhouette = `<rect ${grand} fill="url(#${u}_or)" mask="url(#${u}_forme)" opacity=".42"/>`
  if (e.verrouille) {
    defs +=
      `<linearGradient id="${u}_or" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3dca0"/><stop offset="1" stop-color="#a47c33"/></linearGradient>` +
      `<filter id="${u}_blanc" ${grand} filterUnits="userSpaceOnUse"><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"/></filter>` +
      `<mask id="${u}_forme" ${grand} maskUnits="userSpaceOnUse"><g filter="url(#${u}_blanc)">${perso}</g></mask>`
  }
  const [a, b, c] = e.verrouille ? NUIT : allure.fond
  defs += `<radialGradient id="${u}_fond" cx="50%" cy="40%" r="62%"><stop offset="0" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></radialGradient>`
  let scene = `<rect ${grand} fill="url(#${u}_fond)"/>`
  if (e.verrouille) scene += silhouette
  else scene += (dessin.disque ? `<image href="${dessin.disque[taille]}" x="0" y="0" width="100" height="100"/>` : '') + perso
  const ultime = rang === 3 && !e.verrouille
  if (ultime) {
    defs += `<radialGradient id="${u}_aura" gradientUnits="userSpaceOnUse" cx="50" cy="52" r="64"><stop offset=".58" stop-color="${allure.aura}" stop-opacity=".5"/><stop offset="1" stop-color="${allure.aura}" stop-opacity="0"/></radialGradient>`
    avant += `<circle class="pt-aura" cx="50" cy="52" r="64" fill="url(#${u}_aura)"/>`
  }
  // Le monde vivant, chaque couche estompée en cercle : sans quoi le carré
  // peint se voyait.
  const couche = (v: Couche, image: [string, string]) => {
    const t = v.taille
    const x = 50 - t / 2
    const id = `${u}_v${v.cle}`
    defs +=
      `<radialGradient id="${id}g" gradientUnits="userSpaceOnUse" cx="50" cy="50" r="${t / 2}"><stop offset=".7" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient>` +
      `<mask id="${id}" maskUnits="userSpaceOnUse" x="${x}" y="${x}" width="${t}" height="${t}"><rect x="${x}" y="${x}" width="${t}" height="${t}" fill="url(#${id}g)"/></mask>`
    return `<g class="pt-debord cp-vivant cp-${v.mouvement}"><g mask="url(#${id})"><image href="${image[taille]}" x="${x}" y="${x}" width="${t}" height="${t}"/></g></g>`
  }
  const couches = ultime ? allure.vivant.filter(v => dessin.vivant?.[v.cle]) : []
  for (const v of couches) if (!v.devant) avant += couche(v, dessin.vivant![v.cle])
  // Le cercle d'une finition prend la place de l'anneau (le composant le pose).
  if (!e.cercle) {
    apres += !anneau
      ? `<circle cx="50" cy="50" r="47.5" fill="none" stroke="#ffffff" stroke-opacity=".22" stroke-width=".9"/>`
      : e.verrouille
        ? `<circle cx="50" cy="50" r="47.2" fill="none" stroke="#d9b56a" stroke-width=".9" opacity=".45"/>`
        : `<circle cx="50" cy="50" r="47.2" fill="none" stroke="${anneau}" stroke-width="2.2"/>`
  }
  const zone = entiere ? null : DEBORD[rang]
  if (zone) {
    const [x, y, l, h] = zone
    // Ce qui sort, par-dessus l'anneau. Moins le disque, net, avec un
    // demi-point de recouvrement : sinon l'anticrénelage des deux découpes
    // laissait un fil au ras de l'anneau (`Portrait.tsx`).
    defs +=
      `<filter id="${u}_fondu" ${grand} filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="3"/></filter>` +
      `<mask id="${u}_dehors" ${grand} maskUnits="userSpaceOnUse"><g filter="url(#${u}_fondu)"><rect x="${x}" y="${y}" width="${l}" height="${h}" fill="#fff"/></g>` +
      `<circle cx="50" cy="50" r="${rayon - 0.5}" fill="#000"/></mask>`
    apres += `<g class="pt-debord" mask="url(#${u}_dehors)">${e.verrouille ? silhouette : perso}</g>`
  } else if (entiere) {
    // Tout entier hors du disque, son monde avec lui : par-dessus le disque
    // où il se tient aussi, que la liste garde seul. Ses lanternes, ses
    // flammes, le pied de son île touchent le bord de l'image peinte : estompé
    // avant lui, sans quoi la coupe traçait un carré autour de lui — de sa
    // silhouette surtout, dans l'album.
    defs +=
      `<filter id="${u}_bord" ${grand} filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="2.5"/></filter>` +
      `<mask id="${u}_entier" ${grand} maskUnits="userSpaceOnUse"><g filter="url(#${u}_bord)"><rect x="${o + 5}" y="${o + 5}" width="${cote - 10}" height="${cote - 10}" fill="#fff"/></g></mask>`
    apres += `<g class="pt-debord" mask="url(#${u}_entier)">${e.verrouille ? silhouette : perso}</g>`
  }
  for (const v of couches) if (v.devant) apres += couche(v, dessin.vivant![v.cle])
  if (ultime && !allure.entiere) apres += ETOILES.map(([x, y, r]) => etoile(x, y, r)).join('')
  return { defs, avant, scene, apres, rayon }
}

interface Props {
  /** La clé de la forme (`cp:loup-adulte`). */
  cle: string
  /** Pas encore à lui : une silhouette dorée sur un disque sombre. */
  verrouille?: boolean
  /** La finition de celui qui le porte : elle devient son cercle. Absente, ou Mat, l'anneau de sa forme. */
  finition?: Finition
  /** Regardé en grand — la carte, la fiche de l'album — : il prend ses grands fichiers. */
  grand?: boolean
  className?: string
}

/** Un compagnon, à la taille du texte qui l'entoure (1 em). Rien, tant que son dessin n'est pas arrivé. */
export function Compagnon({ cle, verrouille, finition, grand, className }: Props) {
  const brut = useId()
  const dessin = dessinDuCompagnon(useDessins(), cle)
  const f = formeDeCompagnon(cle)
  // Verrouillé, il n'a pas de cercle : il n'est pas encore à lui.
  const cercle = !!finition && finition !== 'mat' && !verrouille
  // `useId` rend des deux-points, que `url(#…)` n'aime pas ; la clé et l'état
  // — la finition de son cercle comprise — entrent dans le préfixe, comme
  // pour un portrait : deux racines React numérotent chacune depuis zéro, et
  // le premier dégradé d'un nom gagne. Sur une planche, l'Or d'un compagnon
  // prenait le dégradé de l'Argent posé avant lui.
  const etat = (verrouille ? 'v' : 'n') + (cercle ? 'c' + finition : '') + (grand ? 'g' : '')
  const u = `cp-${cle.slice(3)}-${etat}-${brut.replace(/[^a-zA-Z0-9-]/g, '')}-`
  // Peint une fois par état (`useMemo`) : React réécrit un `innerHTML` dès
  // que l'objet `__html` change, même à texte égal (`Portrait.tsx`).
  const peinture = useMemo(() => {
    if (!f || !dessin) return null
    const { defs, avant, scene, apres, rayon } = peint(dessin, f.rang, ALLURES[f.compagnon], u, { verrouille: !!verrouille, cercle, grand: !!grand })
    return {
      defs: { __html: `<clipPath id="${u}_clip"><circle cx="50" cy="50" r="${rayon}"/></clipPath>` + defs },
      avant: avant ? { __html: avant } : null,
      scene: { __html: scene },
      apres: apres ? { __html: apres } : null,
    }
  }, [f, dessin, verrouille, cercle, grand, u])
  if (!f || !peinture) return null
  const classes = ['pt', 'cp', `cp-${f.compagnon}`]
  if (className) classes.push(className)
  const titre = verrouille ? `${f.nom} — pas encore à toi` : f.nom
  return (
    <svg className={classes.join(' ')} viewBox="0 0 100 100" role="img" aria-label={titre}>
      <title>{titre}</title>
      <defs dangerouslySetInnerHTML={peinture.defs} />
      {peinture.avant && <g dangerouslySetInnerHTML={peinture.avant} />}
      <g clipPath={`url(#${u}_clip)`} dangerouslySetInnerHTML={peinture.scene} />
      {cercle && <Cercle finition={finition} id={nom => `${u}_${nom}`} />}
      {peinture.apres && <g dangerouslySetInnerHTML={peinture.apres} />}
    </svg>
  )
}
