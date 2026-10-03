import { useEffect, type ReactNode } from 'react'
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
export function Sortie({ vers = 'Accueil', href = '/', onClick }: { vers?: string; href?: string; /** Un retour dans la même page — la fiche d'un quiz : le lien reste pour l'onglet. */ onClick?: () => void }) {
  return (
    <a
      className="lien-discret jour-sortie"
      href={href}
      onClick={e => {
        if (!onClick || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
        e.preventDefault()
        onClick()
      }}
    >
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

/**
 * Un gros bouton : une icône dans sa pastille, ce qu'il ouvre, et une ligne
 * de ce qu'on y trouve. Un toucher de plus qu'une carte qui montrait tout,
 * mais un écran qu'on lit d'un coup d'œil. Un lien s'il mène à une page —
 * il s'ouvre dans un onglet, il se copie —, un bouton sinon.
 */
export function GrosBouton({
  icone,
  titre,
  detail,
  pastille,
  principal,
  href,
  onClick,
}: {
  icone: ReactNode
  titre: ReactNode
  detail?: ReactNode
  /** Ce qui attend : « À jouer », « 3 nouveaux ». */
  pastille?: ReactNode
  /** Le geste du moment : plein. */
  principal?: boolean
  href?: string
  onClick?: () => void
}) {
  const classe = 'gros-bouton' + (principal ? ' gros-principal' : '')
  const contenu = (
    <>
      <span className="gros-icone">{icone}</span>
      <span className="gros-texte">
        <b>{titre}</b>
        {detail && <span className="gros-detail">{detail}</span>}
      </span>
      {pastille && <span className="pastille-attente">{pastille}</span>}
      <Icon name="chevron-down" className="chevron" />
    </>
  )
  return href ? (
    <a className={classe} href={href}>
      {contenu}
    </a>
  ) : (
    <button type="button" className={classe} onClick={onClick}>
      {contenu}
    </button>
  )
}

/** Une tuile du profil : plus haute qu'un bouton, deux par rangée. */
export function Tuile({ icone, titre, detail, pastille, onClick }: { icone: IconName; titre: string; detail?: ReactNode; pastille?: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="tuile" onClick={onClick}>
      {pastille && <span className="pastille-attente">{pastille}</span>}
      <span className="gros-icone">
        <Icon name={icone} />
      </span>
      <b>{titre}</b>
      {detail && <span className="gros-detail">{detail}</span>}
    </button>
  )
}

/** Au trait des icônes de l'application : une silhouette, pour « Profil ». */
function IconePersonne() {
  return (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c.9-4 4-6 8-6s7.1 2 8 6" />
    </svg>
  )
}

/** Au trait des icônes de l'application : un sac, pour « Boutique ». */
function IconeSac() {
  return (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 8h14l-1 12.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20.5L5 8Z" />
      <path d="M9 10V6.5a3 3 0 0 1 6 0V10" />
    </svg>
  )
}

/** Au trait des icônes de l'application : un engrenage, pour « Compte ». */
function IconeEngrenage() {
  return (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  )
}

export type Piece = 'accueil' | 'quiz' | 'profil' | 'boutique' | 'compte'

const PIECES: { piece: Piece; nom: string; href: string; icone: ReactNode }[] = [
  { piece: 'accueil', nom: 'Accueil', href: '/', icone: <Icon name="home" /> },
  { piece: 'quiz', nom: 'Mes quiz', href: '/edit', icone: <Icon name="edit" /> },
  { piece: 'profil', nom: 'Profil', href: '/profil', icone: <IconePersonne /> },
  { piece: 'boutique', nom: 'Boutique', href: '/boutique', icone: <IconeSac /> },
  { piece: 'compte', nom: 'Compte', href: '/compte', icone: <IconeEngrenage /> },
]

/**
 * La barre du menu : les cinq pièces, sous le pouce, toujours au même
 * endroit. Des liens, pas des onglets : chacune a son adresse, qu'on garde en
 * favori ou qu'on partage. Chaque bouton a son icône et son nom — une icône
 * seule ne dit pas « Mes quiz » à qui ne l'a jamais vue —, et la page
 * courante se dit en gras, pas par sa seule couleur. Elle se retire pendant
 * une partie : on ne quitte pas une question d'un toucher perdu.
 */
export function MenuBarre({ ici }: { ici: Piece | null }) {
  useEffect(() => {
    // La page ne passe jamais sous la barre.
    document.body.classList.add('avec-menu')
    return () => document.body.classList.remove('avec-menu')
  }, [])
  return (
    <nav className="menu-barre" aria-label="Menu">
      {PIECES.map(p => (
        <a key={p.piece} href={p.href} aria-current={ici === p.piece ? 'page' : undefined}>
          {p.icone}
          {p.nom}
        </a>
      ))}
    </nav>
  )
}
