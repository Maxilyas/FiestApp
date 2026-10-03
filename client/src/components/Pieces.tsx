import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

// Les petites pièces des pages du téléphone : l'en-tête d'une page, le lien
// qui en sort, une feuille qui monte du bas et ses lignes de choix. Sans
// rien de lourd : le chemin d'un invité peut les charger.

/** L'en-tête d'une page : ce qu'elle est en surtitre, puis son titre. */
export function PieceTete({ piece, titre, icone, children }: { piece: string; titre: ReactNode; icone?: IconName; children?: ReactNode }) {
  return (
    <header className="piece-tete">
      <span className="label">{piece}</span>
      <h1>
        {icone && <Icon name={icone} />}
        {titre}
      </h1>
      {children}
    </header>
  )
}

/**
 * Le retour en tête d'une page qui n'est pas une pièce du menu : « ← Accueil »,
 * en haut à gauche, comme partout — le seul. Un lien : il s'ouvre dans un
 * onglet, il se copie.
 */
export function Sortie({ vers = 'Accueil', href = '/' }: { vers?: string; href?: string }) {
  return (
    <a className="lien-discret jour-sortie" href={href}>
      <Icon name="arrow-left" />
      {vers}
    </a>
  )
}

/**
 * Une feuille qui monte du bas, « Fermer » toujours en vue : choisir un quiz,
 * ranger. Le voile la ferme aussi ; le reste de la page ne bouge pas.
 */
export function Feuille({ titre, onFermer, pied, children }: { titre: string; onFermer: () => void; /** Collé en bas, toujours en vue. */ pied?: ReactNode; children: ReactNode }) {
  return (
    <div className="carte-voile" onClick={onFermer}>
      <div className="carte-feuille" role="dialog" aria-modal="true" aria-label={titre} onClick={e => e.stopPropagation()}>
        <header className="carte-barre">
          <b className="feuille-titre">{titre}</b>
          <button type="button" className="carte-fermer" onClick={onFermer}>
            <Icon name="x" />
            Fermer
          </button>
        </header>
        <div className="carte-corps">{children}</div>
        {pied && <footer className="carte-pied">{pied}</footer>}
      </div>
    </div>
  )
}

/** Une ligne de choix dans une feuille : une icône, ce qu'elle fait, une ligne pour dire comment. */
export function Choix({ icone, titre, detail, onClick, disabled }: { icone: IconName; titre: string; detail: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="choix-ligne" onClick={onClick} aria-disabled={disabled || undefined}>
      <span className="gros-icone">
        <Icon name={icone} />
      </span>
      <span className="gros-texte">
        <b>{titre}</b>
        <span className="gros-detail">{detail}</span>
      </span>
    </button>
  )
}
