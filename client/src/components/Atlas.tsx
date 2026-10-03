import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { Icon } from './Icon'
import type { CleDeBranche } from '../../../shared/branches'

// Le langage de l'atlas, pour tout ce qui se collectionne : un rail d'orbes
// — l'anneau de chacun se remplit avec ce qu'on a —, puis un panneau sur une
// trame fine, teinté de la lueur de ce qu'on regarde. Les avatars, les
// trophées et la carrière le parlent tous : on apprend à lire une fois.

/**
 * La lueur de chaque branche du savoir : l'anneau de son orbe, son chemin, et
 * la pastille d'un quiz de sa catégorie dans « Mes quiz ». Une teinte de
 * fond ou de trait, jamais un texte long : aucun contraste n'en dépend.
 */
export const LUEUR: Record<CleDeBranche, string> = {
  monde: '#5fb8ff',
  mythes: '#e8b04a',
  oceans: '#3fd0d4',
  espace: '#a08bff',
  foret: '#7ccf6a',
  ecran: '#ff6b8a',
  scene: '#ff9f5a',
  contes: '#c48bff',
  stade: '#4fd18b',
  brigade: '#f2c14e',
  arcade: '#ff5fd2',
  carnaval: '#ffb347',
}

/** L'or des exploits, le ciel du savoir, le lilas des Divins : les lueurs des panneaux. */
export const OR = '#e3b04b'
export const CIEL = '#7fd6ff'
export const LILAS = '#b9a6ff'

export const lueur = (couleur: string) => ({ '--lueur': couleur }) as CSSProperties

/** Le rail : les orbes qu'on fait glisser ; le choisi vient au milieu, sans faire défiler la page. */
export function Rail({ choisi, label, grille, compact, children }: { choisi: string; label: string; /** Tout tient à l'écran, sur deux rangées : rien à faire glisser. */ grille?: boolean; /** Douze petits orbes en deux rangées, sans leur nom : le panneau le dit. */ compact?: boolean; children: ReactNode }) {
  const rail = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const r = rail.current
    const orbe = r?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!r || !orbe) return
    const calme = r.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches
    r.scrollTo({ left: orbe.offsetLeft - (r.clientWidth - orbe.offsetWidth) / 2, behavior: calme ? 'auto' : 'smooth' })
  }, [choisi])
  return (
    <div className={compact ? 'atlas-rail rail-compact' : grille ? 'atlas-rail rail-grille' : 'atlas-rail'} ref={rail} role="tablist" aria-label={label}>
      {children}
    </div>
  )
}

/** Un orbe du rail : son visuel dans un anneau qui se remplit, son nom, son compte. */
export function Orbe({
  nom,
  compte,
  part,
  couleur,
  choisi,
  compact,
  nouveau,
  onClick,
  children,
}: {
  nom: string
  compte: string
  /** De 0 à 1 : l'anneau. */
  part: number
  couleur: string
  choisi: boolean
  /** Petit, sans nom ni compte à l'écran (le lecteur d'écran les entend). */
  compact?: boolean
  /** Ce qu'une fin y a rangé sans l'annoncer : un point lumineux. */
  nouveau?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={choisi}
      aria-label={`${nom}, ${compte}${nouveau ? ', du nouveau' : ''}`}
      className="atlas-orbe"
      title={`${nom} · ${compte}`}
      style={{ ...lueur(couleur), '--part': part } as CSSProperties}
      onClick={onClick}
    >
      <span className="atlas-anneau">
        <span className="atlas-coeur">{children}</span>
        {nouveau && <span className="orbe-nouveau" aria-hidden="true" />}
      </span>
      {!compact && <span className="atlas-orbe-nom">{nom}</span>}
      {!compact && <span className="atlas-orbe-compte">{compte}</span>}
    </button>
  )
}

/** Un trait entre deux familles d'orbes, dans le rail. */
export function Separation({ nom }: { nom: string }) {
  return (
    <span className="rail-separe" aria-hidden="true">
      <span>{nom}</span>
    </span>
  )
}

/** Le panneau : trame, lueur, et en tête son surtitre, son nom, son compte — et des flèches pour passer au voisin. */
export function Panneau({
  couleur,
  surtitre,
  titre,
  compteur,
  objectif,
  onPrecedent,
  onSuivant,
  children,
}: {
  couleur: string
  surtitre?: string
  titre: string
  compteur?: ReactNode
  /** Ce qui vient : « Encore 28 bonnes réponses pour… ». */
  objectif?: ReactNode
  onPrecedent?: () => void
  onSuivant?: () => void
  children: ReactNode
}) {
  return (
    <section className="atlas-branche" style={lueur(couleur)} aria-label={titre}>
      <header className="atlas-tete">
        {onPrecedent ? (
          <button type="button" className="atlas-fleche" aria-label="Précédent" onClick={onPrecedent}>
            <Icon name="chevron-down" />
          </button>
        ) : (
          <span />
        )}
        <div>
          {surtitre && <span className="atlas-categorie">{surtitre}</span>}
          <h3>{titre}</h3>
          {compteur && <span className="atlas-compteur">{compteur}</span>}
        </div>
        {onSuivant ? (
          <button type="button" className="atlas-fleche atlas-fleche-suivante" aria-label="Suivant" onClick={onSuivant}>
            <Icon name="chevron-down" />
          </button>
        ) : (
          <span />
        )}
      </header>
      {objectif && <p className="atlas-objectif">{objectif}</p>}
      {children}
    </section>
  )
}

/** Une case d'une grille de collection : allumée si on l'a, en silhouette sinon. */
export function Case({
  gagne,
  porte,
  ouverte,
  label,
  marque,
  onClick,
  children,
}: {
  gagne: boolean
  porte?: boolean
  ouverte: boolean
  label: string
  /** Un petit mot sous la case : « ×14 », « niv. 15 ». */
  marque?: ReactNode
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={'hud-case' + (gagne ? ' hud-gagne' : ' hud-ferme') + (porte ? ' hud-porte' : '') + (ouverte ? ' hud-ouverte' : '')}
      aria-expanded={ouverte}
      aria-label={label}
      onClick={onClick}
    >
      <span className="hud-medaillon">{children}</span>
      {marque !== undefined && <span className="hud-marque">{marque}</span>}
    </button>
  )
}

/** Une jauge circulaire : un pourcentage qui se lit d'un coup d'œil. */
export function Jauge({ part, valeur, nom, detail, couleur }: { part: number; valeur: string; nom: string; detail?: string; couleur: string }) {
  const r = 42
  const tour = 2 * Math.PI * r
  return (
    <figure className="hud-jauge" style={lueur(couleur)}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={r} className="hud-jauge-fond" />
        <circle cx="50" cy="50" r={r} className="hud-jauge-plein" strokeDasharray={`${tour * Math.max(0, Math.min(1, part))} ${tour}`} />
      </svg>
      <span className="hud-jauge-valeur">{valeur}</span>
      <figcaption>
        <b>{nom}</b>
        {detail && <span>{detail}</span>}
      </figcaption>
    </figure>
  )
}
