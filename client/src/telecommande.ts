/**
 * La console tenue en télécommande : les gestes de la soirée en grand, sans
 * la scène qu'on projette. Par défaut sur un écran étroit — un téléphone
 * tenu droit n'est pas la télé —, mais c'est l'animateur qui décide : un
 * téléphone qu'on recopie sur la télé doit pouvoir rester l'écran de salle.
 */
const KEY = 'quizz-telecommande'

/** Sous cette largeur, un écran d'animateur est une télécommande tant qu'on n'a rien choisi. */
const ETROIT = '(max-width: 600px)'

export function telecommandeParDefaut(): boolean {
  try {
    const choisi = localStorage.getItem(KEY)
    if (choisi === '1') return true
    if (choisi === '0') return false
  } catch {
    // Stockage bloqué : on s'en tient à la largeur.
  }
  try {
    return window.matchMedia(ETROIT).matches
  } catch {
    return false
  }
}

export function retenirTelecommande(active: boolean) {
  try {
    localStorage.setItem(KEY, active ? '1' : '0')
  } catch {
    // Stockage bloqué : le choix vaut pour cette page seulement.
  }
}
