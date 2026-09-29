import { useId, useRef, type CSSProperties, type PointerEvent } from 'react'
import type { Finition } from '../../../shared/profil'
import { legendaire as legendaireDe } from '../../../shared/legendaires'
import { inscrireDessin } from './medaillons'
import { Cercle, OR } from './Cercle'
import { IMAGES } from './legendaires-peints'

/**
 * Les avatars légendaires : seize cartes peintes, qui ne se gagnent que par
 * un haut fait (`shared/legendaires.ts`).
 *
 * Un emoji est à tout le monde ; un légendaire, non — et il doit se voir de
 * loin, au-dessus même de la forme ultime d'une branche. Chacun est une
 * illustration de carte légendaire, pleine page, peinte à la feuille d'or,
 * dans un seul style pour les seize — une collection —, sous une pellicule
 * holographique : un arc-en-ciel qui glisse et un reflet qui passe, et qui
 * n'allument que ce qui est déjà clair, comme une vraie carte. En grand, le
 * reflet suit le doigt et la carte penche un peu ; ailleurs, la lumière passe
 * seule ; dans une liste, tout s'arrête (`styles.css`).
 *
 * Les trois légendes de l'ombre (le Kraken, le Fantôme, le Trou Noir, qui se
 * gagnent en jouant mal) ont une pellicule noire aux reflets violets, sous un
 * anneau d'ombre.
 *
 * Éclaté, il porte sa version rare — la même pose repeinte dans ses couleurs
 * rares, le Phénix de glace, le Dragon d'argent — sous un prisme de deux
 * arcs-en-ciel croisés, avec des paillettes, une gerbe de lumière derrière,
 * et la créature qui sort de son cadre, par-dessus l'anneau.
 *
 * Pas encore gagné, il n'en reste que la forme, en silhouette dorée sur un
 * disque sombre : on sait ce qu'on veut avant de l'avoir.
 *
 * Porté, son cercle prend la matière de la finition du joueur — bronze,
 * argent, or, irisé, prisme, aurore, nuit étoilée : une seule bordure, et
 * c'est elle qui dit le niveau.
 *
 * Tout est en calques que le navigateur compose : l'image, la pellicule,
 * le reflet ; ils ne bougent que par `transform` et `opacity`. Le disque se
 * découpe par un vrai cercle (`clip-path`) : sous une inclinaison qui se
 * redresse, un simple `overflow` oubliait son arrondi, et la pellicule —
 * un grand carré qui glisse — apparaissait un instant en entier.
 */

/**
 * Le disque, du centre vers le bord : il tient la place de l'image le temps
 * qu'elle arrive — la couleur de chacun, sa version rare comprise.
 */
const FONDS: Record<string, [string, string, string]> = {
  'lg:phenix': ['#ffcf6e', '#e8512a', '#4a0b27'],
  'lg:dragon': ['#2f8f68', '#0d3b2c', '#03130d'],
  'lg:oracle': ['#5b36a8', '#221047', '#08030f'],
  'lg:chouette': ['#3a4f8a', '#16203f', '#070b18'],
  'lg:tigre': ['#5fdcff', '#1461c4', '#07183a'],
  'lg:licorne': ['#9a6ae6', '#3f2186', '#12082a'],
  'lg:lion': ['#ff7a70', '#b0122d', '#3a040f'],
  'lg:renard': ['#3d63a8', '#172a57', '#060b1a'],
  'lg:comete': ['#2a3f96', '#0c1540', '#03050f'],
  'lg:kraken': ['#168091', '#073944', '#020c10'],
  'lg:fantome': ['#5b48a6', '#211848', '#07050f'],
  'lg:trou-noir': ['#2d1450', '#0a0418', '#000000'],
  'lg:sphinx': ['#f6c26b', '#b3561f', '#2e0f05'],
  'lg:citrouille': ['#7b4bb8', '#2d1250', '#0b0416'],
  'lg:sapin': ['#3d63a8', '#142552', '#050b1c'],
  'lg:bouquet': ['#4a3598', '#1a0f47', '#06031a'],
}

/**
 * Les mêmes, éclatés : chacun a sa version rare — le Phénix de glace, le
 * Dragon d'argent, la Chouette d'or, le Tigre blanc, la Licorne noire…
 */
const FONDS_ECLAT: Record<string, [string, string, string]> = {
  'lg:phenix': ['#c4f4ff', '#2f86d6', '#0a1d4d'],
  'lg:dragon': ['#7a58d0', '#2a1566', '#0b0426'],
  'lg:oracle': ['#2aa37e', '#0c4535', '#03140f'],
  'lg:chouette': ['#b03a52', '#4a0f22', '#16030a'],
  'lg:tigre': ['#c9a4ff', '#5a2aa8', '#170838'],
  'lg:licorne': ['#ffb8d2', '#b8386e', '#3a0a22'],
  'lg:lion': ['#86b6ff', '#1d3f9e', '#07122e'],
  'lg:renard': ['#7458c8', '#281a66', '#0a0622'],
  'lg:comete': ['#c23a62', '#4a0a26', '#12030a'],
  'lg:kraken': ['#6a34a8', '#240f40', '#0a0414'],
  'lg:fantome': ['#22845f', '#08301f', '#010a06'],
  'lg:trou-noir': ['#11566b', '#031a24', '#000000'],
  'lg:sphinx': ['#5a8cff', '#1a2f8f', '#060b2e'],
  'lg:citrouille': ['#2f9a70', '#0e3d2c', '#03120c'],
  'lg:sapin': ['#9cc4e0', '#34607c', '#0c1c29'],
  'lg:bouquet': ['#a32a66', '#3a0c27', '#10030b'],
}

const OMBRE: [string, string, string] = ['#d9c9ff', '#6d4fb3', '#1d1233']

interface Props {
  /** La clé du légendaire (`lg:phenix`…). */
  cle: string
  /** Pas encore gagné : une silhouette dorée sur un disque sombre. */
  verrouille?: boolean
  /** La finition de celui qui le porte : elle devient son cercle. Absente, l'or (ou le violet de l'ombre) d'origine. */
  finition?: Finition
  /** L'Éclat est tombé sur lui : il porte sa version rare. */
  eclat?: boolean
  /** Regardé en grand — sa révélation, la clôture — : ses grands fichiers, et le reflet qui suit le doigt. */
  grand?: boolean
  className?: string
}

/** Le médaillon d'un avatar légendaire, à la taille du texte qui l'entoure (1 em). */
export function Legendaire({ cle, verrouille, finition, eclat, grand, className }: Props) {
  const brut = useId()
  const racine = useRef<HTMLSpanElement>(null)
  const l = legendaireDe(cle)
  const images = IMAGES[cle]
  // Verrouillé, il n'a pas de version éclatée : il n'est pas encore à lui.
  const eclate = !!eclat && !verrouille
  const fond = (eclate ? FONDS_ECLAT : FONDS)[cle]
  if (!l || !images || !fond) return null
  // `useId` rend des deux-points, que `url(#…)` n'aime pas. La clé du
  // légendaire entre dans l'identifiant : deux médaillons différents ne
  // partagent jamais un dégradé, même rendus par deux racines React.
  const base = `${cle.replace(':', '-')}${brut.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const id = (nom: string) => `${base}-${nom}`
  const bord = l.ton === 'ombre' ? OMBRE : OR
  const taille = grand ? 0 : 1
  const classes = ['lg', `lg-${l.ton}`, `lg-${cle.slice(3)}`]
  if (verrouille) classes.push('lg-verrou')
  if (eclate) classes.push('lg-eclate')
  if (grand && !verrouille) classes.push('lg-touche-libre')
  if (className) classes.push(className)
  const titre = verrouille ? `${l.nom} — pas encore gagné` : eclate ? `${l.nom}, éclaté` : l.nom

  // Le reflet suit le doigt — ou la souris —, en grand seulement : la
  // position, de 0 à 1, part en variables CSS, sans un rendu React.
  const suivre = (e: PointerEvent<HTMLSpanElement>) => {
    const el = racine.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--px', Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)).toFixed(3))
    el.style.setProperty('--py', Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)).toFixed(3))
  }
  const toucher = (e: PointerEvent<HTMLSpanElement>) => {
    racine.current?.classList.add('lg-touche')
    suivre(e)
  }
  const lacher = () => {
    const el = racine.current
    if (!el) return
    el.classList.remove('lg-touche')
    el.style.removeProperty('--px')
    el.style.removeProperty('--py')
  }
  const interactif = grand && !verrouille
  const gestes = interactif
    ? {
        onPointerDown: (e: PointerEvent<HTMLSpanElement>) => {
          try {
            e.currentTarget.setPointerCapture(e.pointerId)
          } catch {
            // Un pointeur déjà relâché : le reflet suit quand même.
          }
          toucher(e)
        },
        onPointerMove: (e: PointerEvent<HTMLSpanElement>) => {
          if (e.pointerType === 'mouse' || racine.current?.classList.contains('lg-touche')) toucher(e)
        },
        onPointerUp: (e: PointerEvent<HTMLSpanElement>) => {
          if (e.pointerType !== 'mouse') lacher()
        },
        onPointerCancel: lacher,
        onPointerLeave: lacher,
      }
    : {}

  const art = eclate ? images.rare[taille] : images.art[taille]
  // Verrouillé, la silhouette : sa forme, en or, sur la nuit.
  const silhouette = { WebkitMaskImage: `url(${images.perso})`, maskImage: `url(${images.perso})` } as CSSProperties
  return (
    <span ref={racine} className={classes.join(' ')} role="img" aria-label={titre} {...gestes}>
      {eclate && (
        <>
          <span className="lg-gerbe" />
          <span className="lg-gerbe lg-gerbe-2" />
        </>
      )}
      <span className="lg-carte">
        <svg className="lg-cadre" viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <radialGradient id={id('fond')} cx="50%" cy="38%" r="68%">
              <stop offset="0%" stopColor={fond[0]} />
              <stop offset="55%" stopColor={fond[1]} />
              <stop offset="100%" stopColor={fond[2]} />
            </radialGradient>
            <linearGradient id={id('bord')} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={bord[0]} />
              <stop offset="50%" stopColor={bord[1]} />
              <stop offset="100%" stopColor={bord[2]} />
            </linearGradient>
          </defs>
          {finition && !verrouille ? (
            <Cercle finition={finition} id={id} />
          ) : (
            <circle className="lg-bord" cx="50" cy="50" r="49" fill={`url(#${id('bord')})`} />
          )}
          <circle className="lg-fond" cx="50" cy="50" r="45" fill={`url(#${id('fond')})`} />
          {/* Un légendaire de l'ombre garde son filet violet quand la finition
              prend son cercle : on doit voir d'un coup d'œil qu'il s'est gagné
              en jouant mal. */}
          {finition && !verrouille && l.ton === 'ombre' && (
            <circle cx="50" cy="50" r="45.3" fill="none" stroke="#b48cff" strokeWidth="1.3" />
          )}
        </svg>
        <span className="lg-disque">
          {verrouille ? (
            <span className="lg-silhouette" style={silhouette} />
          ) : (
            <>
              <img className="lg-art" src={art} alt="" decoding="async" draggable={false} />
              <span className="lg-feuille" />
              {eclate && <span className="lg-feuille lg-feuille-2" />}
              <span className="lg-diffraction" />
              {eclate && (
                <>
                  <span className="lg-paillettes" />
                  <span className="lg-paillettes lg-paillettes-2" />
                </>
              )}
              <span className="lg-reflet" />
            </>
          )}
        </span>
        {eclate && <img className="lg-debord" src={images.rarePerso[taille]} alt="" decoding="async" draggable={false} />}
      </span>
    </span>
  )
}

// Évalué, le dessin est là pour tout `Avatar` de la page (voir `medaillons.ts`).
inscrireDessin({ Legendaire })
