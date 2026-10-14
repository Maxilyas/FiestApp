import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import { lueur } from './Atlas'
import { espacesFines } from '../format'

// Les pièces des lignes de « Ma collection » : une jauge fine, une étape du
// chemin vers ce qu'on n'a pas, la ligne qui se déplie sur place, et le lien
// qui y mène depuis la loge. Les albums, le style, le rayon des compagnons,
// chaque ligne de la collection et chaque panneau de la loge les partagent.

/** Une jauge fine : où l'on en est, sans un chiffre de plus. */
export function JaugeFine({ part }: { part: number }) {
  return (
    <span className="jauge-fine" aria-hidden="true">
      <span style={{ width: `${Math.round(Math.max(0, Math.min(1, part)) * 100)}%` }} />
    </span>
  )
}

/**
 * « N à gagner : où ? », sous ce qu'un panneau de la loge laisse choisir :
 * la loge ne montre que ce qu'on a — des finitions et des bordures éteintes
 * s'y mêlaient à celles qu'on pouvait porter (le 13 octobre 2026) —, ce qui
 * reste vit dans « Ma collection », avec ce qu'il faut pour l'ouvrir. Un seul
 * lien, le même sous chaque pièce.
 */
export function AGagner({ n, un, plusieurs, href }: { n: number; un: string; plusieurs: string; href: string }) {
  if (n <= 0) return null
  return (
    <a className="loge-a-gagner" href={href}>
      {espacesFines(`${n} ${n > 1 ? plusieurs : un} à gagner : où ?`)}
      <Icon name="chevron-right" />
    </a>
  )
}

const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * Une étape du chemin vers un avatar ou un objet du style : son lieu en
 * icône — une coche si elle est tenue —, ce qu'il faut, sa règle, et où il
 * en est (`progres`, sa jauge et son compte).
 */
export function EtapeDuChemin({
  icone,
  titre,
  regle,
  tenue,
  progres,
}: {
  icone: IconName
  titre: string
  regle: string
  tenue: boolean
  progres: { acquis: number; requis: number; dit: string } | null
}) {
  return (
    <div className={'album-etape' + (tenue ? ' album-tenue' : '')}>
      <span className="album-etape-icone" aria-hidden="true">
        <Icon name={tenue ? 'check' : icone} />
      </span>
      <span className="album-etape-texte">
        <b>{espacesFines(titre)}</b>
        {regle && <span className="muted small">{espacesFines(`${majuscule(regle)}.`)}</span>}
        {progres && (
          <span className="album-progres">
            <JaugeFine part={progres.acquis / progres.requis} />
            <span>{progres.dit}</span>
          </span>
        )}
      </span>
    </div>
  )
}

/**
 * Une ligne d'une collection : son emblème, son nom, ce qu'on y trouve, son
 * compte et sa jauge — elle se déplie sur place, sous son nom.
 */
export function LigneDeCollection({
  id,
  emoji,
  nom,
  detail,
  compte,
  part,
  couleur,
  ouverte,
  onToucher,
  children,
}: {
  id?: string
  emoji: string
  nom: string
  detail: string
  compte: string
  part: number
  couleur: string
  ouverte: boolean
  onToucher: () => void
  children: ReactNode
}) {
  return (
    <li id={id} className={'trophee' + (ouverte ? ' trophee-ouvert' : '')} style={lueur(couleur)}>
      <button type="button" className="trophee-ligne" aria-expanded={ouverte} onClick={onToucher}>
        <span className="trophee-emoji" aria-hidden="true">
          {emoji}
        </span>
        <span className="trophee-texte">
          <b>{nom}</b>
          <span className="muted small">{detail}</span>
        </span>
        <span className="trophee-compte">
          {compte}
          <JaugeFine part={part} />
        </span>
        <Icon name="chevron-down" className="trophee-chevron" />
      </button>
      {ouverte && <div className="trophee-contenu">{children}</div>}
    </li>
  )
}
