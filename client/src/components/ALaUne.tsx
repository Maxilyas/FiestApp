import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { Icon } from './Icon'
import { Dessin } from './Avatar'
import { apercuDe } from '../apercus'
import { gemme } from '../gemmes'
import { espacesFines, formatNumber } from '../format'
import { aLaUne, jusquAuBoutDeSaSaison, type ALaUne } from '../../../shared/aLaUne'
import { compagnon, PRIX_D_UN_COMPAGNON } from '../../../shared/compagnons'
import { fond as fondDe, PRIX_D_UN_FOND } from '../../../shared/fonds'
import { prixDe, theme as themeDe, type BoutiqueDuProfil, type RareteDeTheme } from '../../../shared/themes'

// Le bandeau « À la une » de l'accueil (la maquette C, `shared/aLaUne.ts`) :
// un objet de la boutique à la fois, son dessin qui déborde du bandeau par la
// gauche — le compagnon qui flotte, l'écran du thème ou la carte du fond
// penchés —, et un toucher mène à sa place dans la boutique. Il passe au
// suivant toutes les quelques secondes, jamais sous le doigt ni sous le
// focus, et pas du tout si le système demande moins de mouvement : il
// intrigue sans rien bousculer. Il se glisse aussi du doigt, et ses points se
// touchent (la question du propriétaire du 15 octobre 2026 : « c'est fait
// exprès qu'il ne puisse pas être slidé ? ») : on ne pouvait ni revenir à
// celui qu'on venait de manquer, ni voir les autres sous « moins de
// mouvement ».

/** Le temps d'un objet à la une, avant le suivant. */
const TOUR_MS = 6500

/** Ce qu'un doigt doit parcourir de côté pour changer d'objet ; en deçà, il revient à sa place. */
const PAS_DU_GESTE = 40

/** Ce qu'un doigt peut bouger avant que le geste soit une glissade et plus un toucher. */
const JEU_DU_TOUCHER = 8

function sansMouvement(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return true
  }
}

/**
 * Ce que fait un geste fini, de son déplacement : l'objet suivant (vers la
 * gauche), le précédent (vers la droite), ou rien — trop court, ou plus
 * vertical qu'horizontal : la page défilait.
 */
export function pasDuGeste(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dx) < PAS_DU_GESTE || Math.abs(dx) <= Math.abs(dy)) return 0
  return dx < 0 ? 1 : -1
}

/** Ce qu'est un thème, à son genre : les raretés s'écrivent au féminin, la boutique dit « Peu commune ». */
const UN_THEME: Readonly<Record<RareteDeTheme, string>> = {
  offert: 'Un thème offert',
  commune: 'Un thème commun',
  peucommune: 'Un thème peu commun',
  rare: 'Un thème rare',
  epique: 'Un thème épique',
  legendaire: 'Un thème légendaire',
}

/** Le surtitre : la saison qui va partir d'abord, puis ce que son solde paie déjà — le chiffre seul ne disait pas à quoi il sert. */
function surtitre(prix: number, solde: number, saison = false): string {
  if (saison) return 'De saison'
  return solde >= prix ? 'À ta portée' : 'À la une'
}

/** Ce qu'un objet à la une montre : son dessin, ce qu'il est, son nom, sa ligne, son adresse. */
function contenuDe(u: ALaUne, solde: number): { href: string; classe: string; style?: CSSProperties; visuel: ReactNode; sur: string; nom: string; detail: string } | null {
  if (u.sorte === 'compagnon') {
    const c = compagnon(u.cle)
    const forme = c?.formes[0]
    if (!c || !forme) return null
    return {
      // La vitrine s'ouvre sur lui, pas sur le premier des trois.
      href: `/boutique#compagnon-${c.key}`,
      classe: `une-compagnon une-${c.key}`,
      visuel: <Dessin cle={forme.key} />,
      sur: surtitre(PRIX_D_UN_COMPAGNON, solde),
      nom: c.nom,
      detail: `${c.le === 'la' ? 'Elle' : 'Il'} grandit avec toi · 🎊 ${formatNumber(PRIX_D_UN_COMPAGNON)}`,
    }
  }
  if (u.sorte === 'fond') {
    const f = fondDe(u.cle)
    if (!f?.savoir) return null
    return {
      // Sa fiche s'ouvre dépliée dans le rayon : sa carte en grand, et l'achat.
      href: `/boutique#fond-${f.key}`,
      classe: 'une-fond',
      visuel: <span className={`une-carte carte-fond fond-${f.key}`} />,
      sur: surtitre(PRIX_D_UN_FOND, solde),
      nom: f.nom,
      // Comme un thème, ce qu'il est et son prix, sur une ligne : son savoir
      // y ajoutait une seconde ligne — « Cinéma & / séries » — et celui des
      // jeux en aurait poussé le prix hors du bandeau. Son nom le dit déjà.
      detail: `Un fond de carte · 🎊 ${formatNumber(PRIX_D_UN_FOND)}`,
    }
  }
  const t = themeDe(u.cle)
  if (!t) return null
  const image = apercuDe(t.key)
  const fin = u.saison ? jusquAuBoutDeSaSaison(t) : null
  return {
    href: `/boutique#theme-${t.key}`,
    classe: 'une-theme',
    style: gemme(t.rarete),
    visuel: image ? <img src={image} alt="" width={48} height={60} decoding="async" draggable={false} /> : <Icon name="palette" />,
    sur: surtitre(prixDe(t), solde, u.saison),
    nom: t.nom,
    detail: `${UN_THEME[t.rarete]} · 🎊 ${formatNumber(prixDe(t))}${fin ? ` · ${fin}` : ''}`,
  }
}

/**
 * Le bandeau : l'objet du moment, en lien vers lui, qui se glisse du doigt
 * — ou des flèches du clavier —, et des points qui disent qu'il y en a
 * d'autres, et y mènent. Rien s'il a tout ce que la boutique vend.
 */
export function BandeauALaUne({ boutique }: { boutique: BoutiqueDuProfil }) {
  const cles = `${boutique.jour}|${boutique.possedes.join()}|${(boutique.compagnons ?? []).map(c => c.compagnon).join()}|${(boutique.fondsAchetes ?? []).join()}`
  const une = useMemo(() => aLaUne(boutique), [cles])
  const [i, setI] = useState(0)
  /** D'où vient l'objet montré : à côté, après un geste ou un tour ; rien, au premier. */
  const [vient, setVient] = useState<'suivant' | 'precedent' | null>(null)
  /** Chaque changement de main remet le compte à zéro : le suivant ne tombe pas une seconde après un geste. */
  const [tour, setTour] = useState(0)
  const [retenu, setRetenu] = useState(false)
  const [calme] = useState(sansMouvement)
  const lien = useRef<HTMLAnchorElement | null>(null)
  const geste = useRef<{ x: number; y: number; id: number } | null>(null)
  /** Le doigt a glissé : le clic qui suit ne mène nulle part. */
  const aGlisse = useRef(false)
  /** L'objet a changé au clavier : le lien, refait, reprend le focus. */
  const rendreLeFocus = useRef(false)
  const n = une.length
  const ici = n > 0 ? i % n : 0
  useEffect(() => {
    if (calme || retenu || n < 2) return
    const t = window.setInterval(() => {
      setVient('suivant')
      setI(x => (x + 1) % n)
    }, TOUR_MS)
    return () => window.clearInterval(t)
  }, [calme, retenu, n, tour])
  useEffect(() => {
    if (!rendreLeFocus.current) return
    rendreLeFocus.current = false
    lien.current?.focus()
  }, [ici])
  const c = n > 0 ? contenuDe(une[ici], boutique.confettis.solde) : null
  if (!c) return null

  const aller = (pas: -1 | 1) => {
    setVient(pas > 0 ? 'suivant' : 'precedent')
    setI(x => (((x % n) + pas) % n + n) % n)
    setTour(t => t + 1)
  }
  const montrer = (j: number) => {
    if (j === ici) return
    setVient(j > ici ? 'suivant' : 'precedent')
    setI(j)
    setTour(t => t + 1)
  }
  /** Le bandeau suit le doigt, de côté seulement : `translate`, que l'entrée en `transform` ne touche pas. */
  const suivre = (dx: number) => lien.current?.style.setProperty('--glisse', `${dx}px`)
  const lacher = () => {
    geste.current = null
    lien.current?.classList.remove('une-glisse')
    suivre(0)
  }
  const poser = (e: PointerEvent<HTMLAnchorElement>) => {
    if (n < 2 || (e.pointerType === 'mouse' && e.button !== 0)) return
    geste.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
    aGlisse.current = false
  }
  const bouger = (e: PointerEvent<HTMLAnchorElement>) => {
    const g = geste.current
    if (!g || g.id !== e.pointerId) return
    const dx = e.clientX - g.x
    if (!aGlisse.current) {
      if (Math.abs(dx) < JEU_DU_TOUCHER || Math.abs(dx) <= Math.abs(e.clientY - g.y)) return
      aGlisse.current = true
      lien.current?.classList.add('une-glisse')
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // Un pointeur déjà relâché : le geste finira sans lui.
      }
    }
    suivre(dx)
  }
  const relever = (e: PointerEvent<HTMLAnchorElement>) => {
    const g = geste.current
    if (!g || g.id !== e.pointerId) return
    const pas = aGlisse.current ? pasDuGeste(e.clientX - g.x, e.clientY - g.y) : 0
    lacher()
    // Le clic d'une souris suit son relâché dans la même tâche : il trouve le drapeau, puis il tombe.
    if (aGlisse.current) window.setTimeout(() => (aGlisse.current = false), 0)
    if (pas !== 0) aller(pas)
  }
  const touches = (e: KeyboardEvent<HTMLAnchorElement>) => {
    if (n < 2 || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return
    e.preventDefault()
    rendreLeFocus.current = true
    aller(e.key === 'ArrowRight' ? 1 : -1)
  }
  return (
    <div
      // Sa teinte se pose sur le cadre : les points, hors du lien, la lisent aussi.
      className={`une-cadre ${c.classe}`}
      style={c.style}
      onPointerEnter={() => setRetenu(true)}
      onPointerLeave={() => setRetenu(false)}
      onFocus={() => setRetenu(true)}
      onBlur={() => setRetenu(false)}
    >
      <a
        // Une clé par objet : son entrée se rejoue à chaque passage.
        key={ici}
        ref={lien}
        className={`une${vient ? ` une-vient-${vient}` : ''}`}
        href={c.href}
        // Glissé à la souris, un lien partait en glisser-déposer de son adresse.
        draggable={false}
        onPointerDown={poser}
        onPointerMove={bouger}
        onPointerUp={relever}
        onPointerCancel={lacher}
        onClick={e => {
          if (!aGlisse.current) return
          aGlisse.current = false
          e.preventDefault()
        }}
        onKeyDown={touches}
      >
        <span className="une-visuel" aria-hidden="true">
          {c.visuel}
        </span>
        <span className="une-texte">
          <span className="une-sur">{espacesFines(c.sur)}</span>
          <b className="une-nom">{c.nom}</b>
          <span className="une-detail">{espacesFines(c.detail)}</span>
        </span>
        <span className="une-aller" aria-hidden="true">
          <Icon name="chevron-right" />
        </span>
      </a>
      {n > 1 && (
        // Hors du lien : un bouton dans un lien n'est pas du HTML, et son toucher y menait.
        <div className="une-points">
          {une.map((u, j) => (
            <button
              key={`${u.sorte}-${u.cle}`}
              type="button"
              className={'une-point' + (j === ici ? ' une-point-ici' : '')}
              aria-label={contenuDe(u, boutique.confettis.solde)?.nom ?? `${j + 1} sur ${n}`}
              aria-current={j === ici || undefined}
              onClick={() => montrer(j)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
