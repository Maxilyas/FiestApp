import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { Icon } from './Icon'
import { Trouvaille, boiteDeLaTrouvaille } from './Trouvaille'
import { COUR, ECHELLE, ETENDUE, NICHE, PLAN, POSITIONS, decalage, herbes, largeurDuTerrain } from './jardin'
import { PLACES_DU_JARDIN, TERRAINS, placesOuvertes, trouvailleDe } from '../../../shared/trouvailles'

// Son jardin, autour de sa niche (la maquette validée le 20 octobre 2026) :
// la pelouse, ses trouvailles posées à leur place, et ce qui se fait d'un
// toucher — un « + » sur une place libre, une trouvaille à ranger dans
// l'éditeur. Le même dessin sur sa page et dans « Décorer ». Quand il dépasse
// l'écran — le jardin à droite, le domaine à gauche —, il défile, et deux
// flèches le disent : hors champ, le domaine passait inaperçu.

/** Ce que la scène mesure : sa largeur sur celle de la cour, bornée — la colonne d'une tablette ne fait pas une niche géante. */
const echelleDe = (largeur: number) => Math.max(0.8, Math.min(1.25, largeur / COUR))

/** L'échelle d'une scène, lue sur sa largeur et suivie quand elle change (un téléphone qu'on tourne). */
export function useEchelle<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  // Avant la mesure, la colonne du téléphone telle qu'elle sera : rien ne saute au premier rendu.
  const [k, setK] = useState(() => echelleDe(typeof window === 'undefined' ? COUR : Math.min(560, window.innerWidth) - 40))
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const lire = () => setK(echelleDe(el.clientWidth))
    lire()
    const suivi = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(lire)
    suivi?.observe(el)
    return () => suivi?.disconnect()
  }, [])
  return [ref, k]
}

const arrondi = (n: number) => Math.round(n * 10) / 10

export function Jardin({
  k,
  hauteur,
  niveau,
  dessine = niveau,
  jardin,
  nom,
  places,
  choisie = null,
  nouvelle = null,
  vise = null,
  onPlace,
  cour,
}: {
  k: number
  /** La hauteur de la scène, dans le repère de la cour (280 sur sa page, 242 dans l'éditeur). */
  hauteur: number
  /** Le terrain ouvert, en rang dans `TERRAINS`. */
  niveau: number
  /** Le terrain dessiné : l'éditeur montre le suivant, encore fermé, dans la brume. */
  dessine?: number
  jardin: Readonly<Record<string, string>>
  /** Son nom, pour « Le panneau à son nom ». */
  nom?: string | null
  /** « libres » : un « + » sur chaque place libre (sa page) ; « toutes » : chaque place se touche (l'éditeur) ; « aucune » : rien. */
  places: 'libres' | 'toutes' | 'aucune'
  choisie?: string | null
  /** La place d'une trouvaille qui vient d'arriver : elle s'y pose en tombant. */
  nouvelle?: string | null
  /** Une place à amener dans le champ, hors de la cour : l'éditeur ouvert sur elle. */
  vise?: string | null
  onPlace?: (place: string) => void
  /** Ce qui se pose dans la cour, dans son repère : la niche, sa plaque, ce qu'il fait. */
  cour?: ReactNode
}) {
  const off = decalage(dessine)
  const largeur = largeurDuTerrain(dessine)
  const ouvertes = placesOuvertes(niveau)
  const fermees = Object.keys(PLACES_DU_JARDIN).filter(p => PLACES_DU_JARDIN[p].terrain > niveau && PLACES_DU_JARDIN[p].terrain <= dessine)
  const pano = useRef<HTMLDivElement>(null)
  const [bords, setBords] = useState({ g: false, d: false })

  const mesurer = () => {
    const el = pano.current
    if (!el) return
    const g = el.scrollLeft > 6
    const d = el.scrollLeft < el.scrollWidth - el.clientWidth - 6
    setBords(b => (b.g === g && b.d === d ? b : { g, d }))
  }
  // Cadrée une fois — sur la niche, ou sur la place visée — puis laissée où
  // le doigt l'a mise : recadrée à chaque rendu, elle revenait au centre sous
  // le doigt. Un terrain qui grandit la recadre : la cour a bougé dedans.
  const cadree = useRef<string | null>(null)
  useLayoutEffect(() => {
    const el = pano.current
    if (!el) return
    const cle = vise && POSITIONS[vise] ? `p:${vise}:${dessine}` : `n:${dessine}`
    if (cadree.current === cle || (cadree.current?.startsWith('p:') && !vise && cadree.current.endsWith(`:${dessine}`))) return
    const premier = cadree.current === null
    cadree.current = cle
    const vue = el.clientWidth
    const x = vise && POSITIONS[vise] ? (POSITIONS[vise].cx + off) * k : (NICHE.milieu + off) * k
    const depart = Math.max(0, Math.min(el.scrollWidth - vue, x - vue / 2))
    if (premier || !el.scrollTo) el.scrollLeft = depart
    else el.scrollTo({ left: depart, behavior: 'smooth' })
    mesurer()
  }, [vise, dessine, k]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    mesurer()
  }, [largeur, k]) // eslint-disable-line react-hooks/exhaustive-deps
  const defiler = (sens: 1 | -1) => {
    const el = pano.current
    if (!el) return
    el.scrollBy({ left: sens * 230 * k, behavior: 'smooth' })
  }

  const objets = ouvertes.filter(p => jardin[p] && trouvailleDe(jardin[p]))
  const style = (p: string): CSSProperties => {
    const { cx, base } = POSITIONS[p]
    const e = ECHELLE[PLACES_DU_JARDIN[p].sorte]
    return {
      left: arrondi((cx + off - 32 * e) * k),
      top: arrondi((base - 60 * e) * k),
      width: arrondi(64 * e * k),
      height: arrondi(64 * e * k),
      zIndex: PLAN[PLACES_DU_JARDIN[p].sorte],
    }
  }
  // La brume du terrain qui vient, et son panneau : à droite le jardin, à gauche le domaine.
  const suivant = dessine > niveau ? TERRAINS[dessine] : null
  const brume: CSSProperties | null =
    dessine > niveau && dessine >= 2
      ? dessine === 2
        ? { left: arrondi((COUR - 28) * k), width: arrondi((ETENDUE + 28) * k) }
        : { left: 0, width: arrondi((ETENDUE + 28) * k) }
      : null
  return (
    <>
      <div className="jardin-panorama" ref={pano} onScroll={mesurer}>
        <div className="jardin-terrain" style={{ width: arrondi(largeur * k), height: arrondi(hauteur * k) }}>
          <span
            className="jardin-pelouse"
            style={
              niveau === 0 && dessine === 0
                ? { left: arrondi((off + 46) * k), width: arrondi(266 * k), top: arrondi(150 * k), height: arrondi(118 * k) }
                : { left: arrondi(-30 * k), width: arrondi((largeur + 60) * k), top: arrondi(150 * k), height: arrondi(118 * k) }
            }
          />
          {herbes(largeur, niveau === 0 && dessine === 0, off).map(h => (
            <svg key={h.x} className="jardin-herbe" style={{ left: arrondi(h.x * k), top: arrondi(h.y * k), width: arrondi(20 * k), height: arrondi(12 * k) }} viewBox="0 0 20 12" aria-hidden="true">
              <path d="M2 12C3 7 4 4 6 2M6 12c0-4 1-7 3-10M10 12c1-4 3-6 6-8M13 12c0-3 2-5 5-6" />
            </svg>
          ))}
          {objets.map(p => (
            <span key={`${p}-${jardin[p]}`} className={'jardin-objet' + (nouvelle === p ? ' nouveau' : '')} style={style(p)}>
              <Trouvaille cle={jardin[p]} nom={nom} />
            </span>
          ))}
          <div className="jardin-cour" style={{ left: arrondi(off * k), width: arrondi(COUR * k), height: arrondi(hauteur * k) }}>
            {cour}
          </div>
          {brume && <span className={'jardin-brume ' + (dessine === 2 ? 'droite' : 'gauche')} style={brume} aria-hidden="true" />}
          {fermees.map(p => {
            const { cx, base } = POSITIONS[p]
            return (
              <span
                key={p}
                className="jardin-verrou"
                style={{ left: arrondi((cx + off - 15) * k), top: arrondi((PLACES_DU_JARDIN[p].sorte === 'ciel' ? base - 50 : base - 36) * k) }}
                aria-hidden="true"
              >
                <Icon name="lock" />
              </span>
            )
          })}
          {suivant && brume && (
            <span className="jardin-panneau" style={{ left: arrondi((dessine === 2 ? COUR + 26 : 24) * k), top: arrondi(30 * k) }}>
              <b>
                <Icon name="lock" />
                {suivant.nom}
              </b>
              <span>{`${suivant.places} places · à ${suivant.jours} jours de complicité`}</span>
            </span>
          )}
          {places !== 'aucune' &&
            ouvertes.map(p => {
              const { cx, base } = POSITIONS[p]
              const sorte = PLACES_DU_JARDIN[p].sorte
              const cle = jardin[p]
              const t = cle ? trouvailleDe(cle) : null
              if (t) {
                if (places !== 'toutes') return null
                const e = ECHELLE[sorte]
                const [bx, by, bw, bh] = boiteDeLaTrouvaille(t.cle)
                return (
                  <button
                    key={p}
                    type="button"
                    className={'jardin-pleine' + (choisie === p ? ' choisie' : '')}
                    style={{
                      left: arrondi((cx + off - 32 * e + bx * e - 3) * k),
                      top: arrondi((base - 60 * e + by * e - 3) * k),
                      width: arrondi((bw * e + 6) * k),
                      height: arrondi((bh * e + 6) * k),
                    }}
                    aria-label={`${t.nom} : la ranger`}
                    onClick={() => onPlace?.(p)}
                  />
                )
              }
              const grande = places === 'toutes'
              const cote = grande ? 34 : 26
              // Son nom dit la place, jamais si elle est choisie : `aria-pressed` le dit (`design.test.ts`).
              const nomLu = sorte === 'ciel' ? 'Une place libre dans son ciel' : sorte === 'haut' ? 'Une grande place libre' : 'Une place libre au sol'
              return (
                <button
                  key={p}
                  type="button"
                  className={'jardin-libre' + (grande ? ' grande' : '') + (choisie === p ? ' choisie' : '')}
                  style={{
                    left: arrondi((cx + off) * k - cote / 2),
                    // Au sol, sur sa page, le « + » se pose où l'objet se tiendra, au-dessus de la plaque de son nom.
                    top: arrondi((sorte === 'ciel' ? base - (grande ? 52 : 46) : grande ? base - 38 : sorte === 'bas' ? base - 50 : base - 30) * k),
                    width: cote,
                    height: cote,
                  }}
                  aria-label={nomLu}
                  aria-pressed={grande ? choisie === p : undefined}
                  onClick={() => onPlace?.(p)}
                >
                  <Icon name="plus" />
                </button>
              )
            })}
        </div>
      </div>
      {bords.g && (
        <button type="button" className="jardin-fleche gauche" aria-label="Voir la gauche de son jardin" onClick={() => defiler(-1)}>
          <Icon name="chevron-right" />
        </button>
      )}
      {bords.d && (
        <button type="button" className="jardin-fleche droite" aria-label="Voir la droite de son jardin" onClick={() => defiler(1)}>
          <Icon name="chevron-right" />
        </button>
      )}
    </>
  )
}
