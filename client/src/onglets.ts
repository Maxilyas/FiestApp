// Les onglets de l'animateur.
//
// Chaque lien de la console ouvrait un onglet neuf (`_blank`) : trois clics
// sur « Mes quiz », trois éditeurs. Et « Écran commun », dans l'éditeur ou
// sur « Mon compte », s'ouvrait dans l'onglet courant — un onglet ouvert par
// la console y devenait une seconde console, qui doublait la première.
//
// Les liens de la console visent donc des onglets nommés, qu'un second clic
// retrouve au lieu d'en ouvrir un autre ; et une page ouverte par la console
// y ramène, au lieu d'en ouvrir une deuxième. Sans `noopener` : c'est le lien
// d'ouverture qui permet au navigateur de retrouver l'onglet par son nom,
// entre pages de la même origine.

export const ONGLETS = {
  quiz: 'fiestapp-quiz',
  compte: 'fiestapp-compte',
  soiree: 'fiestapp-soiree',
  jouer: 'fiestapp-jouer',
} as const

/** La console qui a ouvert cet onglet, si c'en est une et qu'elle est encore là. */
export function consoleOuvreuse(): Window | null {
  try {
    const ouvreuse = window.opener as Window | null
    return ouvreuse && !ouvreuse.closed && ouvreuse.location.pathname === '/host' ? ouvreuse : null
  } catch {
    // Une autre origine, ou un navigateur qui refuse d'en dire plus.
    return null
  }
}

/**
 * Revient à la console qui a ouvert cet onglet : il se ferme, et elle
 * reprend la main. Rend `false` s'il n'y a pas de console à retrouver —
 * le lien ouvre alors l'écran commun normalement.
 */
export function revenirALaConsole(siResteOuvert: () => void): boolean {
  const console_ = consoleOuvreuse()
  if (!console_) return false
  try {
    console_.focus()
  } catch {
    // Certains navigateurs refusent de passer au premier plan : fermer suffit.
  }
  window.close()
  // Un onglet où l'on a déjà navigué ne se ferme pas par script. On ne
  // rouvre pas l'écran commun pour autant — ce serait la seconde console :
  // on dit où est la première.
  setTimeout(() => {
    if (!window.closed) siResteOuvert()
  }, 300)
  return true
}
