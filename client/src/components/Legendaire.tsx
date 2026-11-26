import { useId, useMemo, useRef, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import type { Finition } from '../../../shared/profil'
import { legendaire as legendaireDe } from '../../../shared/legendaires'
import { inscrireDessin } from './medaillons'
import { Sceau } from './Sceau'
import { Cercle, OR } from './Cercle'
import { IMAGES } from './legendaires-peints'
import { MATRICE_DE_LA_LUMIERE, enMatiere, tablesDeLaMatiere, type Matiere } from '../../../shared/matieres'

/**
 * Les avatars légendaires : trente-deux cartes peintes, qui ne se gagnent que
 * par un haut fait (`shared/legendaires.ts`) — et celles des Grands Prix,
 * secrètes, que seul un Grand Prix donne.
 *
 * Un emoji est à tout le monde ; un légendaire, non — et il doit se voir de
 * loin, au-dessus même de la forme ultime d'une branche. Chacun est une
 * illustration de carte légendaire, pleine page, peinte à la feuille d'or,
 * dans un seul style pour les trente-deux — une collection —, sous une
 * pellicule holographique : un arc-en-ciel qui glisse et un reflet qui passe,
 * et qui n'allument que ce qui est déjà clair, comme une vraie carte. Un
 * vernis, pas un filtre : c'est la peinture qu'on regarde. En grand, la
 * peinture reste nette et l'arc-en-ciel la traverse de temps en temps, en une
 * bande, comme une carte qu'on incline sous la lampe — sous le doigt, la
 * bande et le reflet le suivent, et la carte penche un peu ; ailleurs, la
 * lumière passe seule ; dans une liste, tout s'arrête (`styles.css`).
 *
 * Les quatre légendes de l'ombre (le Kraken, le Fantôme et le Trou Noir, qui
 * se gagnent en jouant mal, et la Chauve-souris, qui ne joue qu'à minuit
 * moins le quart) ont une pellicule noire aux reflets violets, sous un anneau
 * d'ombre.
 *
 * Éclaté, il porte sa version rare — la même pose repeinte dans ses couleurs
 * rares, le Phénix de glace, le Dragon d'argent —, avec des paillettes fines,
 * une gerbe de lumière derrière, et la créature qui sort de son cadre,
 * par-dessus l'anneau — holo jusqu'au bout des ailes : la pellicule la suit
 * hors du disque. C'est sa peinture qui dit l'Éclat : un second arc-en-ciel
 * croisé, une seconde trame de paillettes et une pellicule aux deux tiers
 * délavaient le Phénix de glace en tache blanche et faisaient du Dragon
 * d'argent un arc-en-ciel (le retour du propriétaire du 3 novembre 2026 :
 * « on ne profite pas en fait de l'image »).
 *
 * Taillé dans une matière par d'autres Éclats (`shared/matieres.ts`), sa
 * version rare passe dans la matière — sa lumière devient la porcelaine, le
 * jade… — sous son seul reflet : ni arc-en-ciel, ni paillettes. Une matière
 * est un objet, pas une carte.
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
  'lg:rose': ['#b0365a', '#4c0f27', '#15040b'],
  'lg:oeuf': ['#f0c96a', '#5f8a3c', '#152410'],
  'lg:gramophone': ['#e0a64f', '#1f5f66', '#06191c'],
  'lg:coquillage': ['#7fe0e0', '#1e8a9c', '#06262e'],
  'lg:cartable': ['#ffc07a', '#b0502a', '#2e0f05'],
  'lg:aigle': ['#ffd88f', '#d0784a', '#3f1622'],
  'lg:ouroboros': ['#2f9a6e', '#0d3a3a', '#030a12'],
  'lg:scarabee': ['#ffcf8a', '#e0705a', '#4a1430'],
  'lg:coq': ['#ffb36b', '#b8455a', '#2e1030'],
  'lg:chauve-souris': ['#6f5fb8', '#2a1f5c', '#0a0718'],
  'lg:salamandre': ['#ffb347', '#c73a1a', '#2e0606'],
  'lg:elephant': ['#4a6fc0', '#18285a', '#050b1e'],
  'lg:serpent': ['#f2dc8a', '#3f9a5c', '#0a2a1a'],
  'lg:chimere': ['#ffa64d', '#a82a18', '#2a0505'],
  'lg:janus': ['#f4dfa6', '#6a5fa8', '#121032'],
  'lg:djinn': ['#58d0d8', '#1a4f9c', '#061030'],
  // Les Grands Prix : un cheval d'étoiles sur la nuit (`shared/grandPrix.ts`).
  'lg:pegase': ['#3a5a9e', '#14234f', '#050a1c'],
  'lg:pegase-couronne': ['#6a6fae', '#1c2552', '#060a1e'],
  // Les légendaires offerts (`Legendaire.offert`) : le Serpent du monde, sous la lumière qui tombe dans la mer du Nord.
  'lg:jormungandr': ['#4fa8a0', '#0f3f4a', '#03121a'],
  'lg:baleine': ['#5fc3d0', '#14506a', '#041726'],
  'lg:drakkar': ['#c9a35a', '#1f4a46', '#06161a'],
}

/**
 * Les mêmes, éclatés : chacun a sa version rare — le Phénix de glace, le
 * Dragon d'argent, la Chouette d'or, le Tigre blanc, la Licorne noire, l'Aigle
 * d'argent sur la pourpre, le Scarabée qui pousse la lune…
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
  'lg:rose': ['#5a86d8', '#1c3470', '#060f26'],
  'lg:oeuf': ['#c8b0ec', '#5b3f8f', '#170d2b'],
  'lg:gramophone': ['#b49ae6', '#4a2a8a', '#130828'],
  'lg:coquillage': ['#7fd0b8', '#2a3f8a', '#070c26'],
  'lg:cartable': ['#a9c0f0', '#2c3f8a', '#080e2a'],
  'lg:aigle': ['#c9a6f0', '#6a2fa3', '#1c0733'],
  'lg:ouroboros': ['#3fbf7f', '#0f4a2c', '#02100a'],
  'lg:scarabee': ['#a9c8ff', '#2a4fa8', '#081436'],
  'lg:coq': ['#b8d4ff', '#33589e', '#0a1530'],
  'lg:chauve-souris': ['#3faa78', '#0f3d2b', '#020d08'],
  'lg:salamandre': ['#a8ecff', '#2a86d6', '#061c42'],
  'lg:elephant': ['#b0c8ff', '#2c4aa8', '#081233'],
  'lg:serpent': ['#ffa36b', '#a3305f', '#2c0a24'],
  'lg:chimere': ['#9ccfff', '#2a56b0', '#071533'],
  'lg:janus': ['#dde8f8', '#6f86b0', '#18213a'],
  'lg:djinn': ['#f0e6c6', '#7a8aa8', '#141b30'],
  'lg:pegase': ['#b48ae6', '#4a2596', '#12082e'],
  'lg:pegase-couronne': ['#c49ef0', '#55309e', '#150a32'],
  // Sa nuit polaire : l'aurore, verte et violette, sous la banquise.
  'lg:jormungandr': ['#6fe0b0', '#2e3f8a', '#070b24'],
  // Le couchant, la nacre et l'or rose.
  'lg:baleine': ['#ffd2b8', '#c0566e', '#2e0c1e'],
  // La braise d'une source volcanique sous l'obsidienne.
  'lg:drakkar': ['#ffb25a', '#8a2a14', '#1a0504'],
}

/**
 * Ceux qui s'enroulent autour de leur cercle (`.lg-enroule`, le 26 novembre
 * 2026) : sortis tout entiers (`artPerso`), ils passent aussi derrière
 * l'anneau, sur les arcs que leur feuille de style leur donne
 * (`--lg-derriere`, lus sur leur peinture) — la fausse 3D d'un serpent qui
 * s'enroule autour du médaillon, d'un masque, sans une image de plus.
 */
const ENROULES: ReadonlySet<string> = new Set(['lg:jormungandr'])

const OMBRE: [string, string, string] =['#d9c9ff', '#6d4fb3', '#1d1233']

interface Props {
  /** La clé du légendaire (`lg:phenix`…). */
  cle: string
  /** Pas encore gagné : une silhouette dorée sur un disque sombre. */
  verrouille?: boolean
  /** La finition de celui qui le porte : elle devient son cercle. Absente, l'or (ou le violet de l'ombre) d'origine. */
  finition?: Finition
  /** L'Éclat est tombé sur lui : il porte sa version rare — ou la matière qu'il en porte. */
  eclat?: boolean | Matiere
  /** Regardé en grand — sa révélation, la clôture — : ses grands fichiers, l'arc-en-ciel qui passe en bande, et la lumière qui suit le doigt. */
  grand?: boolean
  className?: string
}

/**
 * La pellicule : l'arc-en-ciel, la diffraction, le reflet — et, éclaté, les
 * paillettes. La même sur le disque et sur ce qui en sort : ses calques se
 * placent dans le repère du médaillon, pas dans celui de leur cadre
 * (`styles.css`), et l'aile qui passe le bord du cercle reste holo sans
 * raccord.
 */
function Pellicule({ eclate, matiere }: { eclate: boolean; matiere: boolean }) {
  // Taillé, il n'est plus une carte : son reflet seul passe sur la matière.
  if (matiere) return <span className="lg-reflet" />
  return (
    <>
      <span className="lg-feuille" />
      <span className="lg-diffraction" />
      {eclate && <span className="lg-paillettes" />}
      <span className="lg-reflet" />
    </>
  )
}

/**
 * Ceux qui ondulent sous l'eau, en grand (`ONDULANTS`, le 27 novembre 2026 :
 * l'effet D de la page des médaillons vivants, validé par le propriétaire —
 * les créatures marines offertes) : une vague douce passe sur leur peinture,
 * le disque et ce qui en sort ensemble. Un filtre SVG, comme les matières
 * (jamais un `filter` CSS sur du HTML, que Safari ne tient pas partout) : une
 * carte de vagues de 32 pixels qui se répète sans raccord (`VAGUES`, des sinus
 * à périodes entières, R pour l'écart horizontal, G pour le vertical), posée en
 * tuiles (`feTile`) et qui glisse d'une période par boucle (SMIL), puis
 * `feDisplacementMap`. Ni WebGL ni image de plus : la vraie 3D et le relief
 * ont été écartés, et une carte de vagues générée par la page aurait demandé
 * un canevas. Seulement en grand, jamais dans une liste, et rien si le système
 * demande moins de mouvement.
 */
const ONDULANTS: ReadonlySet<string> = new Set(['lg:jormungandr', 'lg:baleine', 'lg:drakkar'])
const VAGUES = 'data:image/png;base64,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'
/** Une période de la vague, en pour cent du médaillon ; son écart le plus grand ; le temps d'une boucle. */
const PERIODE_DE_LA_VAGUE = 38
const AMPLITUDE_DE_LA_VAGUE = 0.55
const DUREE_DE_LA_VAGUE = '8s'
/** Où se pose chaque calque, en pour cent du médaillon (son début, sa taille) : le disque (`inset: 5%`) et ce qui en sort (`.lg-debord`). */
type Cadre = readonly [number, number]
const CADRE_DU_DISQUE: Cadre = [5, 90]
const CADRE_DU_DEBORD: Cadre = [-13, 126]

/**
 * Le filtre d'une image peinte : sa vague (`onde`, dans le repère de son
 * calque), puis sa matière — sa lumière devient la matière, du sombre au
 * clair (`tablesDeLaMatiere`). La tuile de la vague part de l'origine du
 * médaillon, à la même échelle dans les deux calques : à la lisière du disque,
 * ce qui en sort continue la même vague, sans raccord.
 */
function Filtre({ id, cadre, onde, matiere }: { id: string; cadre: Cadre; onde: boolean; matiere: Matiere | null }) {
  const [debut, taille] = cadre
  const k = 100 / taille
  const tuile = PERIODE_DE_LA_VAGUE * k
  const depart = ((-debut * k) % tuile) - tuile
  const tables = matiere ? tablesDeLaMatiere(matiere) : null
  return (
    <filter id={id} x="-2" y="-2" width="104" height="104" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
      {onde && (
        <>
          <feImage href={VAGUES} x={depart} y={depart} width={tuile} height={tuile} preserveAspectRatio="none" result="vague">
            <animate attributeName="x" from={depart} to={depart + tuile} dur={DUREE_DE_LA_VAGUE} repeatCount="indefinite" />
            <animate attributeName="y" from={depart} to={depart + tuile} dur={DUREE_DE_LA_VAGUE} repeatCount="indefinite" />
          </feImage>
          <feTile in="vague" result="vagues" />
          <feDisplacementMap in="SourceGraphic" in2="vagues" scale={2 * AMPLITUDE_DE_LA_VAGUE * k} xChannelSelector="R" yChannelSelector="G" result="ondule" />
        </>
      )}
      {tables && (
        <>
          <feColorMatrix in={onde ? 'ondule' : 'SourceGraphic'} type="matrix" values={MATRICE_DE_LA_LUMIERE} />
          <feComponentTransfer>
            <feFuncR type="table" tableValues={tables[0]} />
            <feFuncG type="table" tableValues={tables[1]} />
            <feFuncB type="table" tableValues={tables[2]} />
          </feComponentTransfer>
        </>
      )}
    </filter>
  )
}

/**
 * Une image peinte sous un filtre — sa matière, sa vague : un SVG à la place
 * de l'`<img>`, posé au même endroit (un filtre SVG ne se pose que sur du SVG,
 * partout). `defs` porte les filtres : ceux du disque et de ce qui en sort
 * vivent dans le même SVG, celui du disque — une seule horloge pour leurs
 * vagues, qui restent en phase.
 */
function ImageFiltree({ src, filtre, defs, className }: { src: string; filtre: string; defs?: ReactNode; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
      {defs && <defs>{defs}</defs>}
      <image href={src} x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid slice" filter={`url(#${filtre})`} />
    </svg>
  )
}

/** Le système demande-t-il moins de mouvement ? Lu une fois par médaillon. */
function moinsDeMouvement(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/** Le médaillon d'un avatar légendaire, à la taille du texte qui l'entoure (1 em). */
export function Legendaire({ cle, verrouille, finition, eclat, grand, className }: Props) {
  const brut = useId()
  const racine = useRef<HTMLSpanElement>(null)
  const l = legendaireDe(cle)
  const images = IMAGES[cle]
  // Verrouillé, il n'a ni version éclatée ni cercle : il n'est pas encore à lui.
  const eclate = !!eclat && !verrouille
  const matiere = eclate && typeof eclat === 'string' ? eclat : null
  const cercle = !!finition && !verrouille
  const calme = useMemo(moinsDeMouvement, [])
  // En grand seulement, là où il se prend en main : dans une liste, sur un podium, il ne bouge pas.
  const onde = !!grand && !verrouille && ONDULANTS.has(cle) && !calme
  const fond = (eclate ? FONDS_ECLAT : FONDS)[cle]
  if (!l || !images || !fond) return null
  // Pégase sort tout entier de son cercle, ordinaire comme éclaté (`artPerso`, livré pour lui seul) ; les autres ne
  // débordent qu'éclatés, et par le haut. Verrouillé, il reste sa silhouette dans le disque.
  const entier = !!images.artPerso && !verrouille
  const debord = eclate ? images.rarePerso : entier ? images.artPerso : null
  // `useId` rend des deux-points, que `url(#…)` n'aime pas. La clé du
  // légendaire et ce qui change ses dégradés — sa version, éclatée ou non, la
  // finition de son cercle — entrent dans l'identifiant : deux racines React
  // numérotent chacune depuis zéro, et le premier dégradé d'un nom gagne.
  // Sans eux, l'Argent d'une planche prenait l'Or posé avant lui, et
  // l'éclaté le disque de l'ordinaire.
  const etat = (eclate ? 'e' : 'n') + (matiere ? 'm' + matiere : '') + (cercle ? 'c' + finition : '') + (onde ? 'o' : '')
  const base = `${cle.replace(':', '-')}-${etat}${brut.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const id = (nom: string) => `${base}-${nom}`
  const bord = l.ton === 'ombre' ? OMBRE : OR
  const taille = grand ? 0 : 1
  const classes = ['lg', `lg-${l.ton}`, `lg-${cle.slice(3)}`]
  if (verrouille) classes.push('lg-verrou')
  if (eclate) classes.push('lg-eclate')
  if (entier) classes.push('lg-entier')
  // Il s'enroule autour de son cercle : l'anneau passe par-dessus sa queue, sur les arcs que sa feuille lui donne.
  if (entier && ENROULES.has(cle)) classes.push('lg-enroule')
  if (matiere) classes.push('lg-matiere')
  if (grand && !verrouille) classes.push('lg-touche-libre')
  if (className) classes.push(className)
  const titre = verrouille ? `${l.nom} — pas encore gagné` : matiere ? `${l.nom}, ${enMatiere(matiere)}` : eclate ? `${l.nom}, éclaté` : l.nom

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
  // Une matière, une vague : la peinture passe par un filtre SVG, le disque et ce qui en sort par le même.
  const filtre = !!matiere || onde
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
      {/* Éclaté ou non, la carte se refait d'un bloc : les calques du disque
          et ceux de ce qui en sort partent ensemble, et leurs animations
          restent en phase — sinon l'arc-en-ciel se décalait au bord du cercle. */}
      <span className="lg-carte" key={eclate ? 'rare' : 'art'}>
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
          {cercle ? (
            <Cercle finition={finition} id={id} />
          ) : (
            <circle className="lg-bord" cx="50" cy="50" r="49" fill={`url(#${id('bord')})`} />
          )}
          <circle className="lg-fond" cx="50" cy="50" r="45" fill={`url(#${id('fond')})`} />
          {/* Un légendaire de l'ombre garde son filet violet quand la finition
              prend son cercle : on doit voir d'un coup d'œil qu'il s'est gagné
              en jouant mal. */}
          {cercle && l.ton === 'ombre' && (
            <circle cx="50" cy="50" r="45.3" fill="none" stroke="#b48cff" strokeWidth="1.3" />
          )}
        </svg>
        <span className="lg-disque">
          {verrouille ? (
            <span className="lg-silhouette" style={silhouette} />
          ) : (
            <>
              {filtre ? (
                <ImageFiltree
                  className="lg-art"
                  src={art}
                  filtre={id('filtre')}
                  defs={
                    <>
                      <Filtre id={id('filtre')} cadre={CADRE_DU_DISQUE} onde={onde} matiere={matiere} />
                      {/* Sa vague : celui de ce qui en sort vit ici aussi, sous la même horloge. */}
                      {debord && onde && <Filtre id={id('filtre-debord')} cadre={CADRE_DU_DEBORD} onde matiere={matiere} />}
                    </>
                  }
                />
              ) : (
                <img className="lg-art" src={art} alt="" decoding="async" draggable={false} />
              )}
              <Pellicule eclate={eclate} matiere={!!matiere} />
            </>
          )}
        </span>
        {debord && (
          // La créature détourée donne sa forme au cadre (`--lg-forme`) : la
          // pellicule, posée par-dessus, ne se voit que sur elle.
          <span className="lg-debord" style={{ '--lg-forme': `url(${debord[taille]})` } as CSSProperties}>
            {onde ? (
              <ImageFiltree src={debord[taille]} filtre={id('filtre-debord')} />
            ) : matiere ? (
              <ImageFiltree src={debord[taille]} filtre={id('filtre-debord')} defs={<Filtre id={id('filtre-debord')} cadre={CADRE_DU_DEBORD} onde={false} matiere={matiere} />} />
            ) : (
              <img src={debord[taille]} alt="" decoding="async" draggable={false} />
            )}
            <Pellicule eclate={eclate} matiere={!!matiere} />
          </span>
        )}
      </span>
    </span>
  )
}

// Évalué, le dessin est là pour tout `Avatar` de la page (voir `medaillons.ts`) — et le
// sceau avec lui : il ne se porte que sur un légendaire.
inscrireDessin({ Legendaire, Sceau })
