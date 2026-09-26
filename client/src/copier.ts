/**
 * Copie ce texte dans le presse-papiers ; faux si le navigateur refuse. Hors
 * https — le wifi de repli —, le presse-papiers moderne n'existe pas :
 * l'ancienne commande marche encore presque partout.
 */
export async function copierTexte(texte: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texte)
    return true
  } catch {
    const avant = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const zone = document.createElement('textarea')
    zone.value = texte
    zone.setAttribute('readonly', '')
    zone.style.position = 'fixed'
    zone.style.opacity = '0'
    document.body.appendChild(zone)
    zone.select()
    try {
      return document.execCommand('copy')
    } catch {
      return false
    } finally {
      zone.remove()
      // Le clavier revient au bouton qui a copié.
      avant?.focus()
    }
  }
}
