import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import { LienConsole } from './LienConsole'

/** Les pages qui portent la barre : celle où l'on est ne se propose pas. */
export type PageAnimateur = 'quiz' | 'compte' | 'admin'

/**
 * Les pages de l'animateur, dans le même ordre et sous les mêmes noms
 * partout : l'accueil, l'écran commun, ses quiz, son compte, l'historique de
 * son espace — et les comptes, pour l'administrateur.
 *
 * Chaque page avait sa barre : « Mes quiz » manquait à /admin, l'accueil à
 * toutes, et les mêmes pages y changeaient d'ordre et de taille. Qui animait
 * et jouait ne retrouvait plus son chemin entre elles (lot 12). Une ligne
 * fine, comme celle de « Mes quiz » : sept boutons de même poids prenaient
 * six lignes au téléphone.
 */
export function NavAnimateur({ ici, slug, admin }: { ici: PageAnimateur; slug: string | null; admin: boolean }) {
  return (
    <nav className="nav-animateur" aria-label="Pages de l’animateur">
      <a className="lien-discret" href="/">
        <Icon name="home" />
        Accueil
      </a>
      <LienConsole className="lien-discret" />
      <Page ici={ici === 'quiz'} href="/edit" icone="edit">
        Mes quiz
      </Page>
      <Page ici={ici === 'compte'} href="/compte" icone="users">
        Mon compte
      </Page>
      {slug && (
        <a className="lien-discret" href={`/${slug}/soirees`}>
          <Icon name="book" />
          Historique
        </a>
      )}
      {admin && (
        <Page ici={ici === 'admin'} href="/admin" icone="sparkles">
          Les comptes
        </Page>
      )}
    </nav>
  )
}

/** La page où l'on est reste dans la ligne, à sa place, mais ne mène nulle part. */
function Page({ ici, href, icone, children }: { ici: boolean; href: string; icone: IconName; children: ReactNode }) {
  if (ici) {
    return (
      <span className="lien-discret ici" aria-current="page">
        <Icon name={icone} />
        {children}
      </span>
    )
  }
  return (
    <a className="lien-discret" href={href}>
      <Icon name={icone} />
      {children}
    </a>
  )
}
