import { useEffect, useState } from 'react'
import { currentMe } from '../api'
import { pageContext } from '../routes'
import { Sortie } from './Pieces'

/**
 * Le retour des pages publiques d'une soirée — le souvenir, le bilan,
 * l'historique de l'espace : « ← », en haut à gauche, comme partout.
 *
 * Elles portaient un fil (Souvenir · Bilan · Historique) et, pour
 * l'animateur, « Accueil » et « Mon compte » : on passait du souvenir au
 * bilan sans savoir d'où l'on venait, et aucun ne ramenait à l'historique
 * qui les avait ouvertes (la remarque du propriétaire du 3 octobre 2026).
 * Chacune s'ouvre maintenant depuis une liste qui offre les deux — son
 * historique, la fin de soirée, « Mes soirées », « La dernière soirée » —, et
 * y revient.
 */
export type SpaceTab = 'souvenir' | 'bilan' | 'soirees'

/** Vrai si le visiteur est l'animateur de cet espace, connecté. Un invité : faux, sans bruit. */
export function useIsHost(slug: string): boolean {
  const [host, setHost] = useState(false)
  useEffect(() => {
    let alive = true
    currentMe().then(me => {
      if (alive) setHost(me?.account.slug === slug)
    })
    return () => {
      alive = false
    }
  }, [slug])
  return host
}

/** Les pas que la page a empilés elle-même (le bilan : un invité, la salle) : le retour les saute. */
const PROFONDEUR = 'profondeurDeLaPage'

/** Un pas de plus dans la page, que la flèche saute pour revenir d'où l'on venait. */
export function pousserDansLaPage(adresse: string) {
  const avant = Number((history.state as Record<string, unknown> | null)?.[PROFONDEUR] ?? 0)
  history.pushState({ [PROFONDEUR]: avant + 1 }, '', adresse)
}

/** Ce que la page qui nous a ouverts s'appelle, vue d'ici — ce que dit la flèche. */
function nomDeLaProvenance(chemin: string): string {
  if (chemin === '/') return 'Accueil'
  if (chemin === '/compte' || chemin.endsWith('/soirees')) return 'Historique'
  if (chemin === '/profil') return 'Mes soirées'
  if (chemin === '/host') return 'L’écran commun'
  return 'Retour'
}

/**
 * Où mène la flèche. Ouverte depuis l'application — la même origine, une
 * entrée derrière —, elle y revient : l'historique du compte, la fin de
 * soirée, « Mes soirées ». Ouverte d'un lien ou d'un QR, ou dans un onglet
 * neuf, il n'y a rien derrière : l'animateur de l'espace va à son
 * historique, l'invité à l'accueil.
 */
export function retourDesPages(
  provenance: string,
  origine: string,
  entrees: number,
  hote: boolean,
): { reculer: true; vers: string } | { reculer: false; vers: string; href: string } {
  try {
    const d = provenance ? new URL(provenance) : null
    if (d && d.origin === origine && entrees > 1) return { reculer: true, vers: nomDeLaProvenance(d.pathname) }
  } catch {
    // Une provenance illisible ne vient pas de chez nous.
  }
  return hote ? { reculer: false, vers: 'Historique', href: '/compte#historique' } : { reculer: false, vers: 'Accueil', href: '/' }
}

export function RetourDeLaSoiree() {
  const { slug } = pageContext()
  const hote = useIsHost(slug)
  // Lue à l'arrivée : la provenance ne change pas, le nombre d'entrées si.
  const [arrivee] = useState(() => ({ provenance: document.referrer, entrees: history.length }))
  const r = retourDesPages(arrivee.provenance, window.location.origin, arrivee.entrees, hote)
  if (!r.reculer) return <Sortie vers={r.vers} href={r.href} />
  return (
    <Sortie
      vers={r.vers}
      href="/"
      onClick={() => history.go(-1 - Number((history.state as Record<string, unknown> | null)?.[PROFONDEUR] ?? 0))}
    />
  )
}

/** Le motif d'une page d'espace dont l'adresse ne mène à rien — pas une panne. */
export const INTROUVABLE = 'Il n’y a pas de soirée à cette adresse — ou plus. Vérifie le lien avec ton hôte.'

/** Vrai si la lecture a échoué parce que la soirée n'existe pas (un 404), et non sur une panne. */
export function estIntrouvable(e: unknown): boolean {
  return e instanceof Error && e.message === '404'
}

/**
 * Une page publique qui n'a pas pu se charger : le message, et la flèche.
 * Introuvable, le fil de l'espace menait trois fois à la même erreur ; la
 * flèche, elle, ramène d'où l'on venait — l'accueil, ouvert d'un lien.
 */
export function SpaceError({ message }: { current?: SpaceTab; message: string }) {
  return (
    <div className="recap">
      <header className="admin-ecran-tete">
        <RetourDeLaSoiree />
      </header>
      <main className="page-corps">
        <p className={message === INTROUVABLE ? 'warn center' : 'error center'}>{message}</p>
      </main>
    </div>
  )
}
