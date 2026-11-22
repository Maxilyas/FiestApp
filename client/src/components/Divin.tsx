import { useId, type CSSProperties } from 'react'
import { divin as divinDe } from '../../../shared/divins'
import { inscrireDessin } from './medaillons'
import { BADGES } from './divins-peints'

/**
 * Les avatars divins : dix-huit bijoux au-dessus des légendaires
 * (`shared/divins.ts`). Personne ne sait ce qui les fait descendre.
 *
 * Un légendaire est une carte peinte, ronde, tenue dans son cadre. Un Divin,
 * lui, n'est pas un rond : c'est un bijou sacré — or, émail, pierres —, peint
 * chacun à sa silhouette (le disque solaire d'Hélios, les six ailes du
 * Séraphin, les pétales du Lotus, la couronne de l'Arbre-Monde, l'auréole
 * brisée de l'Ange Déchu, le sablier de Chronos ; et, depuis le 22 novembre
 * 2026, le casque d'Athéna, l'ibis de Thot, le labyrinthe d'Ariane, le temple
 * du Panthéon…). À vingt pixels dans un classement, sa forme seule dit ce
 * qu'il est — le Panthéon, sorti d'abord en médaillon rond, a été repeint
 * pour ça.
 *
 * Et il vit : sa lumière tourne derrière lui, sa lueur respire, un éclat
 * glisse sur son or, des étincelles gravitent. Rien que des `transform` et
 * des `opacity`, et aucun filtre — le PC du vidéoprojecteur en fait tourner
 * plusieurs ; figé dans les listes, comme les médaillons.
 *
 * Il a sa propre lumière, et la garde tant que son joueur n'épingle aucune
 * finition (`finitionSur`, `shared/profil.ts`). Depuis le 22 novembre 2026
 * (la maquette validée par le propriétaire, `retours/2026-11-22/divins-habilles/` :
 * « C'est pas un peu dommage de ne pas pouvoir mettre les finitions /
 * bordures etc. dessus ? »), il s'habille à sa façon : un métal — Argent, Or,
 * Holo — ne trace pas de cercle autour d'un bijou qui n'est pas rond, il
 * teinte sa lumière ; une lumière du 15 au 50 prend la place de ses rayons
 * (`Avatar.tsx`) ; et sous une bordure de ligue, ses rayons passent derrière
 * elle et en sortent entre les feuilles — sa gloire (`Gloire`). Toujours ni
 * Éclat ni matière : un filtre de couleur sur un bijou peint lui ferait
 * perdre ses émaux.
 *
 * Verrouillé, un Divin ne montre rien de lui : un voile, une lueur de sa
 * couleur, et c'est tout — ni silhouette, ni règle. Son nom seul se dit,
 * depuis le 22 novembre 2026 (l'album, la salle des collectionneurs).
 */

interface Theme {
  /** Le fond du voile, du centre vers le bord. */
  fond: [string, string, string]
  /** L'anneau du voile : du clair au sombre. */
  anneau: [string, string, string]
  /** Sa lumière : celle qui déborde du voile, et les rayons du bijou. */
  aura: string
}

const THEMES: Record<string, Theme> = {
  'dv:helios': { fond: ['#3b52c4', '#17227a', '#060a2b'], anneau: ['#fff4c7', '#e3b04b', '#8a5a10'], aura: '#ffc94a' },
  'dv:seraphin': { fond: ['#c92d4c', '#630c2a', '#18030d'], anneau: ['#ffffff', '#f1d9a6', '#b9873a'], aura: '#ffe2b0' },
  'dv:lotus': { fond: ['#3a1d5c', '#1d1446', '#070a1f'], anneau: ['#ffe3ec', '#e8a0b8', '#9a4a6a'], aura: '#ffb0cc' },
  'dv:arbre': { fond: ['#11604a', '#062a1f', '#010a07'], anneau: ['#fff2c4', '#d4a64a', '#6f4a10'], aura: '#7dffc0' },
  'dv:dechu': { fond: ['#4a1d6b', '#1d0a2d', '#07020d'], anneau: ['#d9b8ff', '#7a3aa8', '#2a0f3d'], aura: '#c0306a' },
  // Sa lumière est l'azur de son anneau d'émail et de sa lune : l'or est déjà celle d'Hélios.
  'dv:chronos': { fond: ['#2b5d7a', '#102a3d', '#040d14'], anneau: ['#fff1c9', '#d9b25a', '#7a5214'], aura: '#7fc8ff' },
  // Les douze du 21 novembre 2026 : la lumière de chacun est la couleur qui domine son bijou après l'or — le cimier
  // d'Athéna, la pierre de lune de Thot, le rubis d'Ariane, les braises du rocher de Sisyphe…
  'dv:athena': { fond: ['#2f4a8f', '#14224f', '#060a1f'], anneau: ['#fff2c4', '#d9b25a', '#7a5214'], aura: '#8fb4ff' },
  'dv:thot': { fond: ['#1f5a5e', '#0c2a2e', '#03100f'], anneau: ['#f4fbff', '#bcd3dc', '#5f7f8c'], aura: '#bfe9ff' },
  'dv:demiurge': { fond: ['#2a3fa8', '#111a5c', '#04061f'], anneau: ['#fff4c7', '#e3b04b', '#8a5a10'], aura: '#8f9bff' },
  'dv:ariane': { fond: ['#8f1f32', '#4a0c1a', '#170308'], anneau: ['#ffe9c2', '#e0a84a', '#8a4d10'], aura: '#ff7a8a' },
  'dv:mnemosyne': { fond: ['#3d2f7a', '#1b1446', '#080519'], anneau: ['#ffffff', '#e8dcc0', '#a8915a'], aura: '#e6d9ff' },
  'dv:heracles': { fond: ['#8a4a12', '#45210a', '#160903'], anneau: ['#ffe6a8', '#d99a2b', '#7a4a08'], aura: '#ffb84d' },
  'dv:sisyphe': { fond: ['#3a4656', '#1a212b', '#07090c'], anneau: ['#ffe9b8', '#c79a3a', '#5e4210'], aura: '#ff6a3d' },
  'dv:nike': { fond: ['#6b5a1f', '#33290c', '#110d03'], anneau: ['#ffffff', '#f3e3b0', '#b9953a'], aura: '#fff6d6' },
  'dv:osiris': { fond: ['#1d3f8a', '#0d1c47', '#040817'], anneau: ['#fff0c0', '#d8a93f', '#77500f'], aura: '#4fd1c5' },
  'dv:hecate': { fond: ['#3b2463', '#1a0f33', '#07030f'], anneau: ['#f2f4ff', '#b8bdd6', '#5d6285'], aura: '#9a6bff' },
  'dv:artemis': { fond: ['#1e3a5f', '#0c1b33', '#03080f'], anneau: ['#f5fbff', '#c3d2e6', '#6a7f9c'], aura: '#cfe6ff' },
  'dv:pantheon': { fond: ['#3a3f9a', '#191c52', '#06071c'], anneau: ['#fff4c7', '#e3b04b', '#8a5a10'], aura: '#fff0a8' },
}

const n = (v: number) => Number(v.toFixed(2))

/** Une étoile à quatre branches, centrée en (x, y). */
function etoile(x: number, y: number, r: number, key: string | number, className = 'dv-scintille', fill = '#fffbe6') {
  const t = r * 0.22
  return (
    <path
      key={key}
      className={className}
      d={`M${n(x)},${n(y - r)} L${n(x + t)},${n(y - t)} L${n(x + r)},${n(y)} L${n(x + t)},${n(y + t)} L${n(x)},${n(y + r)} L${n(x - t)},${n(y + t)} L${n(x - r)},${n(y)} L${n(x - t)},${n(y - t)} Z`}
      fill={fill}
    />
  )
}

/** Les étincelles qui gravitent autour du bijou : (x, y, rayon), sur un cercle un peu plus grand que lui. */
const ETINCELLES: [number, number, number][] = [
  [50, 2, 3.2],
  [93, 42, 2.4],
  [72, 94, 2.8],
  [9, 72, 2.2],
  [15, 17, 2],
]

/** « #ffc94a » → [255, 201, 74]. */
const canaux = (hex: string) => [1, 3, 5].map(k => parseInt(hex.slice(k, k + 2), 16))
/** « #ffc94a » → « 255, 201, 74 » : la lumière entre dans des `rgba()` sans `color-mix`, que tous les navigateurs n'ont pas. */
const rvb = (hex: string) => canaux(hex).join(', ')

/**
 * Les métaux qui teintent sa lumière : sur un fond sombre, puis sur un fond
 * clair. Le Holo n'est pas une couleur : ses rayons prennent l'arc-en-ciel
 * (`.dv-holo`, dans la feuille).
 */
const TEINTES: Record<string, readonly [string, string]> = {
  argent: ['#cee0ff', '#76859f'],
  or: ['#ffc654', '#b07c20'],
}

/**
 * Sa lumière sur un fond clair. Une lumière pâle — le crème du Séraphin, la
 * pierre de lune de Thot — ne s'y voit pas : elle tire vers le métal sombre
 * de son anneau, qui est déjà sa couleur. Relevé sur la maquette en Ivoire :
 * la gloire d'Hélios se lisait, celle du Panthéon presque pas.
 */
function surClair(theme: Theme): string {
  const [a, s] = [canaux(theme.aura), canaux(theme.anneau[2])]
  return a.map((c, i) => Math.round(c * 0.4 + s[i] * 0.6)).join(', ')
}

/** Sa lumière, celle de son bijou ou du métal que son joueur a épinglé : `--dv-rvb`, et `--dv-rvb-clair` que la feuille prend sur un fond clair. */
function lumiereDe(theme: Theme, finition: string | null | undefined): CSSProperties {
  const teinte = finition ? TEINTES[finition] : undefined
  return { '--dv-rvb': teinte ? rvb(teinte[0]) : rvb(theme.aura), '--dv-rvb-clair': teinte ? rvb(teinte[1]) : surClair(theme) } as CSSProperties
}

interface Props {
  /** La clé du Divin (`dv:helios`…). */
  cle: string
  /** Pas encore descendu : un voile, et rien d'autre. */
  verrouille?: boolean
  /** Regardé en grand — sa descente en fin de soirée, à la clôture — : le grand fichier du bijou. */
  grand?: boolean
  /** La finition que son joueur a épinglée, s'il en a épinglé une : un métal teinte sa lumière. Les autres ne changent rien ici. */
  finition?: string | null
  className?: string
}

/** Un avatar divin, à la taille du texte qui l'entoure (1 em) — sa lumière en plus. */
export function Divin({ cle, verrouille, grand, finition, className }: Props) {
  const brut = useId()
  const d = divinDe(cle)
  const theme = THEMES[cle]
  const badge = BADGES[cle]
  if (!d || !theme || !badge) return null
  const classes = ['dv', `dv-${cle.slice(3)}`]
  if (className) classes.push(className)
  if (!verrouille) {
    const src = badge[grand ? 0 : 1]
    if (finition === 'holo') classes.push('dv-holo')
    const lumiere = lumiereDe(theme, finition)
    // L'éclat glisse sur l'or seul : le bijou lui-même lui sert de masque.
    const masque = { WebkitMaskImage: `url(${src})`, maskImage: `url(${src})` } as CSSProperties
    return (
      <span className={[...classes, 'dv-peint'].join(' ')} role="img" aria-label={d.nom} style={lumiere}>
        <span className="dv-rayons" />
        <span className="dv-rayons dv-rayons-2" />
        <span className="dv-lueur" />
        <img className="dv-bijou" src={src} alt="" decoding="async" draggable={false} />
        {/* L'éclat est un élément, pas un pseudo-élément : les règles qui
            figent un Divin dans une liste (`.dv *`) ne voient pas ceux-là. */}
        <span className="dv-or" style={masque}>
          <span className="dv-or-bande" />
        </span>
        <svg className="dv-etincelles" viewBox="0 0 100 100" aria-hidden="true">
          {ETINCELLES.map(([x, y, r], i) => etoile(x, y, r, i, 'dv-scintille', '#fff4c7'))}
        </svg>
      </span>
    )
  }
  // `useId` rend des deux-points, que `url(#…)` n'aime pas ; la clé entre
  // dans l'identifiant, comme pour les légendaires.
  const base = `${cle.replace(':', '-')}${brut.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const id = (nom: string) => `${base}-${nom}`
  classes.push('dv-voile')
  // Son nom se dit (le 22 novembre 2026 ; jusque-là, « Un Divin ») : c'est l'indice qu'on laisse, et le seul.
  const titre = `${d.nom} — personne ne sait ce qui le fait descendre`
  return (
    <svg className={classes.join(' ')} viewBox="0 0 100 100" role="img" aria-label={titre}>
      <title>{titre}</title>
      <defs>
        <radialGradient id={id('aura')} gradientUnits="userSpaceOnUse" cx="50" cy="50" r="62">
          <stop offset="0.62" stopColor={theme.aura} stopOpacity={0.12} />
          <stop offset="1" stopColor={theme.aura} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id('fond')} cx="50%" cy="42%" r="66%">
          <stop offset="0" stopColor="#2a2130" />
          <stop offset="0.55" stopColor="#15101a" />
          <stop offset="1" stopColor="#07050a" />
        </radialGradient>
        <linearGradient id={id('anneau')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={theme.anneau[0]} />
          <stop offset="0.5" stopColor={theme.anneau[1]} />
          <stop offset="1" stopColor={theme.anneau[2]} />
        </linearGradient>
        <radialGradient id={id('brume')} cx="50%" cy="55%" r="50%">
          <stop offset="0" stopColor={theme.aura} stopOpacity="0.35" />
          <stop offset="1" stopColor={theme.aura} stopOpacity="0" />
        </radialGradient>
        <clipPath id={id('disque')}>
          <circle cx="50" cy="50" r="45.6" />
        </clipPath>
      </defs>
      <circle className="dv-aura" cx="50" cy="50" r="62" fill={`url(#${id('aura')})`} />
      <circle className="dv-fond" cx="50" cy="50" r="46.6" fill={`url(#${id('fond')})`} />
      <g clipPath={`url(#${id('disque')})`}>
        {/* Une nébuleuse de sa couleur, quelques étoiles, un scellé de
            lumière : de quoi le désirer, rien pour le deviner. */}
        <g className="dv-nebuleuse">
          <circle cx="38" cy="42" r="26" fill={`url(#${id('brume')})`} />
          <circle cx="62" cy="60" r="22" fill={`url(#${id('brume')})`} />
        </g>
        <g>
          {[
            [24, 30, 0.9],
            [74, 24, 0.7],
            [80, 68, 0.8],
            [30, 76, 0.6],
            [58, 16, 0.5],
            [16, 56, 0.5],
          ].map(([x, y, r], i) => (
            <circle key={i} className="dv-scintille" cx={x} cy={y} r={r} fill={theme.anneau[0]} opacity="0.7" />
          ))}
        </g>
        <circle className="dv-brume" cx="50" cy="50" r="14" fill={`url(#${id('brume')})`} />
        {etoile(50, 50, 7, 'voile', 'dv-pouls', theme.anneau[0])}
      </g>
      <g className="dv-cadre">
        <circle cx="50" cy="50" r="47.2" fill="none" stroke={`url(#${id('anneau')})`} strokeWidth="2.2" />
        <circle cx="50" cy="50" r="44.9" fill="none" stroke={theme.anneau[0]} strokeWidth="0.45" opacity="0.55" />
      </g>
    </svg>
  )
}

/**
 * La gloire d'un Divin bordé : ses deux nappes de rayons, sorties du bijou.
 * `Avatar` la pose derrière la bordure de ligue — dans le bijou, elles
 * passeraient devant elle, et s'arrêteraient à son fil. Les mêmes rayons, la
 * même lumière (`--dv-rvb`), à la taille de ce qui les entoure (`.dv-gloire`,
 * dans la feuille) : dans une liste, ils s'effacent avec ceux du bijou.
 */
export function Gloire({ cle, finition }: { cle: string; finition?: string | null }) {
  const theme = THEMES[cle]
  if (!theme) return null
  return (
    <span className={finition === 'holo' ? 'dv-gloire dv-holo' : 'dv-gloire'} style={lumiereDe(theme, finition)} aria-hidden="true">
      <span className="dv-rayons" />
      <span className="dv-rayons dv-rayons-2" />
    </span>
  )
}

// Évalué, le dessin est là pour tout `Avatar` de la page (voir `medaillons.ts`).
inscrireDessin({ Divin, Gloire })
