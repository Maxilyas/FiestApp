import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { Icon } from './Icon'
import { DESSINS } from './compagnons-peints'
import { regardeADroite, silhouetteDe } from './Niche'
import { useModale } from '../modale'
import { espacesFines } from '../format'
import { DUREE_DE_LA_CUEILLETTE_S, ETOILES_DE_LA_CUEILLETTE, etoilesDeLaCueillette, type CueilletteEcrite } from '../../../shared/soins'
import { trouvailleDe } from '../../../shared/trouvailles'
import type { CleDeCompagnon, Compagnon, FormeDeCompagnon } from '../../../shared/compagnons'

// La cueillette, son jeu (la maquette validée le 20 octobre 2026 : « un seul
// jeu au début ») : trente secondes pour attraper ses friandises au vol, en
// le guidant du doigt. Une friandise vaut un, une étoile trois ; un nuage le
// mouille et le ralentit un instant. Trois étoiles à 10, 20 et 30 points, son
// record avec chaque compagnon ; la première partie du jour comble son envie
// de jouer, les suivantes sont pour le plaisir — et pour l'étoile filante,
// dix parties à trois étoiles. Rien n'y donne d'avantage de jeu.

/** Sa friandise : ce qu'il mange au goûter, ce qui tombe à la cueillette. */
export interface Friandise {
  /** Au pluriel, après un nombre : « 31 os ». */
  unite: string
  un: string
  des: string
  /** « avant qu’elles ne touchent le sol » : les fraises et les gouttes sont au féminin. */
  feminin: boolean
}

export const FRIANDISES: Readonly<Record<CleDeCompagnon, Friandise>> = {
  loup: { unite: 'os', un: 'son os', des: 'ses os', feminin: false },
  chat: { unite: 'poissons', un: 'son poisson', des: 'ses poissons', feminin: false },
  tortue: { unite: 'fraises', un: 'sa fraise', des: 'ses fraises', feminin: true },
  // La luciole butine : une goutte de miel, plutôt qu'un os qu'elle n'aurait pas su porter.
  luciole: { unite: 'gouttes de miel', un: 'sa goutte de miel', des: 'ses gouttes de miel', feminin: true },
}

/** Sa friandise, dessinée : ce qui s'envole jusqu'à lui au goûter, ce qui tombe à la cueillette. */
export function DessinDeFriandise({ cle }: { cle: CleDeCompagnon }) {
  if (cle === 'chat')
    return (
      <svg viewBox="0 0 60 30" aria-hidden="true">
        <path d="M42 15 58 4l-3 11 3 11z" fill="#7fa6dd" />
        <ellipse cx="25" cy="15" rx="21" ry="11" fill="#9fc1e6" />
        <path d="M25 4c-5 3-5 19 0 22" stroke="#7fa6dd" strokeWidth="1.6" fill="none" />
        <circle cx="12" cy="12" r="2.2" fill="#1a1412" />
      </svg>
    )
  if (cle === 'tortue')
    return (
      <svg viewBox="0 0 40 44" aria-hidden="true">
        <path d="M20 42C6 32 3 18 9 12c4-4 18-4 22 0 6 6 3 20-11 30z" fill="#e8534f" />
        <path d="M10 10c3 2 6 2 10 0 4 2 7 2 10 0-2-4-6-6-10-4-4-2-8 0-10 4z" fill="#6fcf8a" />
        <g fill="#ffe7a3">
          <circle cx="15" cy="20" r="1.1" />
          <circle cx="25" cy="20" r="1.1" />
          <circle cx="20" cy="26" r="1.1" />
          <circle cx="14" cy="29" r="1.1" />
          <circle cx="26" cy="29" r="1.1" />
          <circle cx="20" cy="34" r="1.1" />
        </g>
      </svg>
    )
  if (cle === 'luciole')
    return (
      <svg viewBox="0 0 40 44" aria-hidden="true">
        <path d="M20 3C14 14 8 21 8 29a12 12 0 0 0 24 0c0-8-6-15-12-26z" fill="#f2a93b" />
        <path d="M14 28c0 4 2 7 5 8" stroke="#ffd98a" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      </svg>
    )
  return (
    <svg viewBox="0 0 60 30" aria-hidden="true">
      <g fill="#f3ead6">
        <circle cx="10" cy="9" r="7" />
        <circle cx="10" cy="21" r="7" />
        <circle cx="50" cy="9" r="7" />
        <circle cx="50" cy="21" r="7" />
        <rect x="10" y="9" width="40" height="12" rx="3" />
      </g>
      <rect x="12" y="17.5" width="36" height="3" rx="1.5" fill="#dccfb0" />
    </svg>
  )
}

function Etoile({ allumee = true }: { allumee?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" fill={allumee ? '#f4d58d' : 'rgba(243,236,226,.18)'} />
    </svg>
  )
}

function Nuage() {
  return (
    <svg viewBox="0 0 40 30" aria-hidden="true">
      <path d="M10 20h20a8 8 0 0 0 1-15.9A10 10 0 0 0 12.2 3 7.5 7.5 0 0 0 10 20Z" fill="#8a93a3" />
      <g stroke="#9cc8f5" strokeWidth="2" strokeLinecap="round">
        <path d="M14 23l-1 4" />
        <path d="M21 23l-1 4" />
        <path d="M28 23l-1 4" />
      </g>
    </svg>
  )
}

type Phase = 'intro' | 'compte' | 'joue' | 'envoi' | 'fin'
type Sorte = 'friandise' | 'etoile' | 'nuage'

interface Chute {
  id: number
  sorte: Sorte
  x: number
  y: number
  v: number
  a: number
}

interface Plus {
  id: number
  x: number
  y: number
  age: number
  texte: string
  froid: boolean
}

/** La partie en cours, tenue hors de React : elle change soixante fois par seconde. */
interface Partie {
  reste: number
  score: number
  x: number
  cible: number
  dir: 1 | -1
  chutes: Chute[]
  plus: Plus[]
  prochaine: number
  mouille: number
  ravi: number
  id: number
}

/** La hauteur de l'écran de la maquette : la vitesse des chutes s'y règle, et se ramène à chaque écran. */
const HAUTEUR_DE_REFERENCE = 844
/** Ce que le décompte montre, chaque cran : 3, 2, 1, puis « Attrape ! ». */
const CRAN_MS = 700

export function Cueillette({
  c,
  forme,
  nom,
  record,
  onEcrire,
  onQuitter,
  onRamener,
}: {
  c: Compagnon
  forme: FormeDeCompagnon
  nom: string
  /** Son record avec lui, avant la partie. */
  record: number
  /** Écrit la partie finie : la première du jour comble son envie de jouer. */
  onEcrire: (score: number) => Promise<CueilletteEcrite>
  /** Quitter en route : rien ne s'écrit. */
  onQuitter: () => void
  /** La partie finie, il rentre chez lui. */
  onRamener: (ecrite: CueilletteEcrite | null) => void
}) {
  const boite = useRef<HTMLDivElement>(null)
  useModale(boite, onQuitter)
  const aire = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<Phase>('intro')
  const [compte, setCompte] = useState(3)
  const [, setImage] = useState(0)
  const [ecrite, setEcrite] = useState<CueilletteEcrite | null>(null)
  const [erreur, setErreur] = useState('')
  const [taille, setTaille] = useState({ l: 390, h: HAUTEUR_DE_REFERENCE })
  const partie = useRef<Partie>(nouvelle(195))
  const trame = useRef<number | null>(null)
  const minuteurs = useRef<number[]>([])
  const dessin = DESSINS[forme.key]
  const versLaDroite = regardeADroite(forme.key)
  const friandise = FRIANDISES[c.key]

  function nouvelle(x: number): Partie {
    return { reste: DUREE_DE_LA_CUEILLETTE_S, score: 0, x, cible: x, dir: 1, chutes: [], plus: [], prochaine: 0.45, mouille: 0, ravi: 0, id: 1 }
  }

  useLayoutEffect(() => {
    const el = aire.current
    if (!el) return
    const lire = () => setTaille({ l: el.clientWidth || 390, h: el.clientHeight || HAUTEUR_DE_REFERENCE })
    lire()
    const suivi = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(lire)
    suivi?.observe(el)
    return () => suivi?.disconnect()
  }, [])
  // Partir, c'est tout arrêter : une trame ou un décompte qui sonnerait après réécrirait l'écran fermé.
  useEffect(
    () => () => {
      if (trame.current !== null) cancelAnimationFrame(trame.current)
      for (const t of minuteurs.current) clearTimeout(t)
    },
    [],
  )

  const sol = taille.h - 46
  const corps = Math.min(170, Math.round(taille.h * 0.2))

  const lancer = () => {
    if (trame.current !== null) cancelAnimationFrame(trame.current)
    for (const t of minuteurs.current) clearTimeout(t)
    partie.current = nouvelle(taille.l / 2)
    setEcrite(null)
    setErreur('')
    setCompte(3)
    setPhase('compte')
    minuteurs.current = [1, 2, 3].map(n => window.setTimeout(() => setCompte(3 - n), CRAN_MS * n))
    minuteurs.current.push(
      window.setTimeout(() => {
        setPhase('joue')
        let avant: number | null = null
        const pas = (t: number) => {
          const dt = avant === null ? 1 / 60 : Math.min(0.05, Math.max(0, (t - avant) / 1000))
          avant = t
          if (avancer(dt)) trame.current = requestAnimationFrame(pas)
        }
        trame.current = requestAnimationFrame(pas)
      }, CRAN_MS * 3 + 450),
    )
  }

  /** Une image de la partie : il court vers le doigt, les chutes tombent, ce qu'il attrape compte. Rend faux à la fin. */
  const avancer = (dt: number): boolean => {
    const j = partie.current
    const { l, h } = taille
    const echelle = h / HAUTEUR_DE_REFERENCE
    j.reste = Math.max(0, j.reste - dt)
    const avance = 1 - j.reste / DUREE_DE_LA_CUEILLETTE_S
    // Mouillé, il traîne : le nuage ne retire rien, il fait perdre du temps.
    const lent = j.mouille > 0 ? 0.22 : 1
    const ecart = j.cible - j.x
    j.x += ecart * Math.min(1, dt * 10 * lent)
    if (Math.abs(ecart) > 4) j.dir = ecart > 0 ? 1 : -1
    j.mouille = Math.max(0, j.mouille - dt)
    j.ravi = Math.max(0, j.ravi - dt)
    j.prochaine -= dt
    j.plus = j.plus.map(p => ({ ...p, age: p.age + dt })).filter(p => p.age < 0.85)
    const haut = sol - corps * 0.95
    const bas = sol - corps * 0.35
    const restent: Chute[] = []
    for (const it of j.chutes) {
      const y = it.y + it.v * dt
      if (y > haut && y < bas && Math.abs(it.x - j.x) < Math.max(36, corps * 0.3)) {
        if (it.sorte === 'nuage') {
          j.mouille = 1.1
          j.plus.push({ id: j.id++, x: it.x, y: haut, age: 0, texte: 'Plouf !', froid: true })
        } else {
          const n = it.sorte === 'etoile' ? 3 : 1
          j.score += n
          j.ravi = 0.45
          j.plus.push({ id: j.id++, x: it.x, y: haut, age: 0, texte: `+${n}`, froid: false })
        }
        continue
      }
      if (y < h + 40) restent.push({ ...it, y, a: it.a + dt * 140 })
    }
    if (j.prochaine <= 0 && j.reste > 0.7) {
      j.prochaine = 0.7 - 0.3 * avance + Math.random() * 0.22
      const r = Math.random()
      const sorte: Sorte = r < 0.11 ? 'etoile' : r < 0.32 ? 'nuage' : 'friandise'
      restent.push({ id: j.id++, sorte, x: 36 + Math.random() * (l - 72), y: -26, v: (165 + 150 * avance + Math.random() * 45) * echelle, a: Math.random() * 360 })
    }
    j.chutes = restent
    setImage(n => n + 1)
    if (j.reste > 0) return true
    j.chutes = []
    j.plus = []
    trame.current = null
    setPhase('envoi')
    onEcrire(j.score).then(
      e => {
        setEcrite(e)
        setPhase('fin')
      },
      e => {
        setErreur((e as Error).message)
        setPhase('fin')
      },
    )
    return false
  }

  const viser = (e: PointerEvent<HTMLDivElement>) => {
    if (phase !== 'joue' && phase !== 'compte') return
    const r = e.currentTarget.getBoundingClientRect()
    partie.current.cible = Math.max(40, Math.min(r.width - 40, e.clientX - r.left))
  }
  // Au clavier aussi : les flèches le guident d'un pas.
  const auClavier = (e: KeyboardEvent<HTMLDivElement>) => {
    if (phase !== 'joue' || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return
    e.preventDefault()
    const j = partie.current
    j.cible = Math.max(40, Math.min(taille.l - 40, j.cible + (e.key === 'ArrowLeft' ? -48 : 48)))
  }

  const j = partie.current
  const humeurs = dessin?.humeurs
  const ravi = j.ravi > 0 && j.mouille <= 0 && !!humeurs
  const depite = j.mouille > 0 && !!humeurs
  // Il regarde où il court ; son dessin le tourne d'un côté, la course de l'autre.
  const retourne = j.dir > 0 ? !versLaDroite : versLaDroite
  const [sg, sh, sd, sb] = silhouetteDe(forme.key)
  const cote = corps / Math.max(0.3, sb - sh)
  const decor = dessin?.disque?.[1]
  const etoiles = etoilesDeLaCueillette(ecrite?.score ?? j.score)
  const Il = c.le === 'la' ? 'Elle' : 'Il'
  const exploit = ecrite?.exploit ? trouvailleDe(ecrite.exploit) : null
  return (
    <div className="cueillette-voile">
      <div
        ref={boite}
        className="cueillette"
        role="dialog"
        aria-modal="true"
        aria-label="La cueillette"
        tabIndex={-1}
        onKeyDown={auClavier}
        style={{ '--cote': `${Math.round(cote)}px` } as CSSProperties}
      >
        <span className={'cueillette-ciel' + (decor ? '' : ` niche-ciel niche-ciel-${c.key}`)} style={decor ? { backgroundImage: `url(${decor})` } : undefined} aria-hidden="true" />
        <span className="cueillette-sol" aria-hidden="true" />
        <div className="cueillette-haut">
          <button type="button" className="cueillette-rond" aria-label="Quitter la cueillette" onClick={onQuitter}>
            <Icon name="x" />
          </button>
          <span className="cueillette-chrono" aria-hidden="true">
            <i style={{ width: `${Math.round((j.reste / DUREE_DE_LA_CUEILLETTE_S) * 100)}%` }} />
          </span>
          <span className="cueillette-score" aria-label={`${j.score} points`}>
            <DessinDeFriandise cle={c.key} />
            <b>{j.score}</b>
          </span>
        </div>
        <div ref={aire} className="cueillette-aire" onPointerDown={viser} onPointerMove={viser}>
          {j.chutes.map(it => (
            <span
              key={it.id}
              className={`cueillette-chute ${it.sorte}`}
              style={{ transform: `translate(${Math.round(it.x)}px, ${Math.round(it.y)}px)${it.sorte === 'etoile' ? ` rotate(${Math.round(it.a)}deg)` : ''}` }}
              aria-hidden="true"
            >
              {it.sorte === 'friandise' ? <DessinDeFriandise cle={c.key} /> : it.sorte === 'etoile' ? <Etoile /> : <Nuage />}
            </span>
          ))}
          {j.plus.map(p => (
            <span
              key={p.id}
              className={'cueillette-plus' + (p.froid ? ' froid' : '')}
              style={{ transform: `translate(${Math.round(p.x)}px, ${Math.round(p.y - p.age * 50)}px)`, opacity: Math.max(0, 1 - p.age / 0.85) }}
              aria-hidden="true"
            >
              {p.texte}
            </span>
          ))}
          {dessin && phase !== 'fin' && (
            <span className="cueillette-heros" style={{ transform: `translateX(${Math.round(j.x)}px)`, top: sol - sb * cote, width: cote, height: cote, marginLeft: -(retourne ? 1 - (sg + sd) / 2 : (sg + sd) / 2) * cote }} aria-hidden="true">
              <span className={'cueillette-corps' + (retourne ? ' retourne' : '')}>
                <img className={ravi || depite ? undefined : 'on'} src={dessin.perso[0]} alt="" draggable={false} />
                {humeurs && <img className={ravi ? 'on' : undefined} src={humeurs.ravi[0]} alt="" draggable={false} />}
                {humeurs && <img className={depite ? 'on' : undefined} src={humeurs.depite[0]} alt="" draggable={false} />}
              </span>
              {j.mouille > 0 && (
                <span className="cueillette-pluie">
                  <Nuage />
                </span>
              )}
            </span>
          )}
        </div>
        {phase === 'intro' && (
          <div className="cueillette-carte">
            <h2>La cueillette</h2>
            <p className="muted">{espacesFines(`Attrape ${friandise.des} avant qu’${friandise.feminin ? 'elles' : 'ils'} ne touchent le sol.`)}</p>
            <div className="cueillette-regles">
              <span>
                <DessinDeFriandise cle={c.key} />
                <b>+1</b>
              </span>
              <span>
                <Etoile />
                <b>+3</b>
              </span>
              <span>
                <Nuage />
                <b>{`${c.le === 'la' ? 'elle' : 'il'} se mouille`}</b>
              </span>
            </div>
            <p className="muted small">{`Glisse le doigt pour ${c.le === 'la' ? 'la' : 'le'} guider · ${DUREE_DE_LA_CUEILLETTE_S} secondes`}</p>
            <button type="button" className="btn btn-primary cueillette-partir" onClick={lancer}>
              C’est parti !
            </button>
            {record > 0 && <p className="muted small">{`Son record : ${record}`}</p>}
          </div>
        )}
        {phase === 'compte' && (
          <span key={compte} className={'cueillette-decompte' + (compte > 0 ? '' : ' go')} aria-live="assertive">
            {compte > 0 ? compte : 'Attrape !'}
          </span>
        )}
        {(phase === 'envoi' || phase === 'fin') && (
          <div className="cueillette-carte fin" aria-live="polite">
            {dessin && (
              <span className="cueillette-triomphe" aria-hidden="true">
                <img src={humeurs?.triomphe[0] ?? dessin.perso[0]} alt="" className={versLaDroite ? undefined : 'retourne'} />
              </span>
            )}
            <h2>{`${nom} s’est régalé${c.le === 'la' ? 'e' : ''} !`}</h2>
            <p className="cueillette-total">
              <b>{j.score}</b>
              <span>{friandise.unite}</span>
            </p>
            <span className="cueillette-etoiles" role="img" aria-label={`${etoiles} étoile${etoiles > 1 ? 's' : ''} sur 3`}>
              {ETOILES_DE_LA_CUEILLETTE.map((seuil, i) => (
                <Etoile key={seuil} allumee={i < etoiles} />
              ))}
            </span>
            {phase === 'envoi' && <p className="muted small">…</p>}
            {ecrite?.nouveauRecord && ecrite.ancien > 0 && <p className="cueillette-record">{`Nouveau record ! Avant : ${ecrite.ancien}`}</p>}
            {ecrite && !ecrite.nouveauRecord && <p className="muted small">{`Son record : ${Math.max(ecrite.ancien, ecrite.score)}`}</p>}
            {ecrite?.envie && <p className="cueillette-envie">{espacesFines(`Son envie de jouer est comblée.`)}</p>}
            {exploit && (
              <p className="cueillette-exploit">
                <Icon name="star" />
                {espacesFines(`Dix parties à trois étoiles : ${exploit.nom.charAt(0).toLowerCase()}${exploit.nom.slice(1)} rejoint ses trouvailles !`)}
              </p>
            )}
            {erreur && (
              <p className="error" role="alert">
                {erreur}
              </p>
            )}
            <div className="cueillette-boutons">
              <button type="button" className="btn" disabled={phase === 'envoi'} onClick={lancer}>
                Rejouer
              </button>
              <button type="button" className="btn btn-primary" disabled={phase === 'envoi'} onClick={() => onRamener(ecrite)}>
                {c.le === 'la' ? 'Rentrer chez elle' : 'Rentrer chez lui'}
              </button>
            </div>
            <p className="muted small">{espacesFines(`La première partie du jour comble son envie ; les suivantes, pour le plaisir et le record. ${Il} ne perd rien à rater.`)}</p>
          </div>
        )}
      </div>
    </div>
  )
}
