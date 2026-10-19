import { useEffect, type ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import { nouveautesAPorter } from '../../../shared/piecesDeLaLoge'

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
 * Le geste du bas d'une partie de la campagne — recommencer une série ou une
 * révision, abandonner une épreuve —, le même partout : une pilule pleine
 * largeur, son icône devant, comme « Recommencer une révision » au carnet.
 * Partir, lui, est en haut, comme toute sortie (`Sortie`, « ← Partir »). Un
 * bouton fantôme de 36 px sous la question, hors de l'écran au téléphone,
 * ne disait pas comment partir (la remarque du propriétaire du 11 octobre
 * 2026).
 */
export function GesteDuBas({ icone, children, onClick, busy, danger }: { icone: IconName; children: ReactNode; onClick: () => void; busy?: boolean; /** Ce qui coûte quelque chose — une vie : le filet d'alerte. */ danger?: boolean }) {
  return (
    <button type="button" className={'btn btn-block geste-du-bas' + (danger ? ' geste-qui-coute' : '')} aria-disabled={busy || undefined} onClick={onClick}>
      <Icon name={icone} />
      {children}
    </button>
  )
}

/**
 * Une feuille qui monte du bas, « Fermer » toujours en vue : choisir un quiz,
 * ranger. Le voile la ferme aussi ; le reste de la page ne bouge pas.
 */
export function Feuille({
  titre,
  onFermer,
  pied,
  className,
  children,
}: {
  titre: string
  onFermer: () => void
  /** Collé en bas, toujours en vue. */
  pied?: ReactNode
  /** Sa mise en page à elle — une hauteur fixe, quand son contenu change sous le doigt. */
  className?: string
  children: ReactNode
}) {
  return (
    <div className="carte-voile" onClick={onFermer}>
      <div className={'carte-feuille' + (className ? ` ${className}` : '')} role="dialog" aria-modal="true" aria-label={titre} onClick={e => e.stopPropagation()}>
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
  compteur,
  principal,
  allume,
  jauge,
  compte,
  ferme,
  href,
  onClick,
}: {
  icone: ReactNode
  titre: ReactNode
  detail?: ReactNode
  /** Ce qui attend : « À jouer », « 3 nouveaux ». */
  pastille?: ReactNode
  /**
   * Ce que d'autres lui ont envoyé et qui l'attend, compté comme des
   * messages : un chiffre blanc sur rouge à cheval sur le coin en haut à
   * droite — 9 au plus, puis « 9+ » : un rond, pas une bulle qui s'allonge —,
   * et une phrase au lecteur d'écran (« un défi à relever »).
   */
  compteur?: { n: number; label: string }
  /** Le geste du moment : plein. */
  principal?: boolean
  /**
   * Ce qui vient d'arriver et qu'il n'a pas vu — le résultat d'un duel : le
   * bord d'or, un halo qui luit, la ligne dorée (la maquette A4, choisie par
   * le propriétaire le 12 octobre 2026).
   */
  allume?: boolean
  /** Où il en est, de 0 à 1 : une jauge fine sous le titre — sa collection. */
  jauge?: number
  /** Le compte au bout de la jauge (« 27 sur 308 ») ; sa place est gardée tant qu'il n'est pas arrivé. */
  compte?: string
  /**
   * Sa page est en maintenance (`/admin#maintenance`) : le bouton s'éteint, sa
   * ligne le dit. Il mène encore à sa page, qui dit qu'on la répare — et où
   * l'administrateur, lui, entre encore.
   */
  ferme?: boolean
  href?: string
  onClick?: () => void
}) {
  const classe = 'gros-bouton' + (principal ? ' gros-principal' : '') + (allume ? ' gros-allume' : '') + (ferme ? ' gros-ferme' : '')
  const contenu = (
    <>
      <span className="gros-icone">{icone}</span>
      <span className="gros-texte">
        <b>{titre}</b>
        {jauge !== undefined && (
          <span className="gros-jauge">
            <span className="jauge-fine" aria-hidden="true">
              <span style={{ width: `${Math.round(Math.max(0, Math.min(1, jauge)) * 100)}%` }} />
            </span>
            {compte && <span className="gros-compte">{compte}</span>}
          </span>
        )}
        {detail && <span className="gros-detail">{detail}</span>}
      </span>
      {/* La pastille prend la place du chevron : les deux serraient le titre, et
          « Le quiz du jour » laissait « jour » seul sur sa ligne en 360 de large. */}
      {pastille ? <span className="pastille-attente">{pastille}</span> : <Icon name="chevron-down" className="chevron" />}
      {/* Hors du rang : posé sur le coin, il ne serre ni le titre ni le chevron. */}
      {compteur && compteur.n > 0 && (
        <>
          <span className="gros-compteur" aria-hidden="true">
            {compteur.n > 9 ? '9+' : compteur.n}
          </span>
          <span className="sr-only">{`, ${compteur.label}`}</span>
        </>
      )}
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
/** La couleur de chaque pièce (`--zone`, `styles.css`) : l'accueil garde le champagne. */
const ZONE: Record<Piece, string> = { accueil: 'zone-jouer', quiz: 'zone-quiz', profil: 'zone-profil', boutique: 'zone-boutique', compte: 'zone-compte' }

export function MenuBarre({
  ici,
  nouveautes = 0,
}: {
  ici: Piece | null
  /**
   * Ce qu'il a de neuf à porter : sur « Profil », le compteur des messages,
   * blanc sur rouge, comme les défis reçus des duels (`useNouveautesDuMenu`,
   * ou la page du profil qui le recompte).
   */
  nouveautes?: number
}) {
  useEffect(() => {
    // La page ne passe jamais sous la barre ; et elle prend la couleur de sa
    // pièce — son titre, ses icônes, le filet de la barre —, sans que chaque
    // page la pose elle-même.
    const zone = ici ? ZONE[ici] : null
    document.body.classList.add('avec-menu')
    if (zone) document.body.classList.add(zone)
    return () => {
      document.body.classList.remove('avec-menu')
      if (zone) document.body.classList.remove(zone)
    }
  }, [ici])
  return (
    <nav className="menu-barre" aria-label="Menu">
      {PIECES.map(p => (
        <a key={p.piece} href={p.href} aria-current={ici === p.piece ? 'page' : undefined}>
          {p.icone}
          {p.nom}
          {p.piece === 'profil' && nouveautes > 0 && (
            <>
              <span className="menu-compteur" aria-hidden="true">
                {nouveautes > 9 ? '9+' : nouveautes}
              </span>
              <span className="sr-only">{`, ${nouveautesAPorter(nouveautes)}`}</span>
            </>
          )}
        </a>
      ))}
    </nav>
  )
}
