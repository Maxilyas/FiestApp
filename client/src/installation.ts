// L'application sur l'écran d'accueil : ce que le téléphone en dit, et
// l'invitation à installer que Chrome fait sur Android — gardée pour la carte
// de l'accueil (`components/Installer.tsx`), qui l'offre d'un toucher.
//
// FiestApp n'est dans aucun store : c'est la page elle-même qui s'installe,
// d'après son manifeste (`client/public/manifest.webmanifest`). Android le
// propose ; l'iPhone jamais — il faut passer par « Partager », dans Safari.
// Installée, elle s'ouvre en plein écran, et elle seule peut recevoir le
// rappel du soir du quiz du jour sur un iPhone (`rappel.ts`).

/** Le téléphone, tel que la carte l'explique — l'iPad avec l'iPhone : les mêmes gestes. */
export type Telephone = 'iphone' | 'android'

/**
 * L'iPhone et l'iPad — que Safari fait passer pour un Mac depuis iPadOS 13,
 * mais un Mac n'a pas d'écran tactile —, ou Android ; null ailleurs : un
 * ordinateur n'a pas d'écran d'accueil où poser une icône.
 */
export function telephoneDe(agent: string, plateforme: string, pointsTactiles: number): Telephone | null {
  if (/iPhone|iPad|iPod/i.test(agent) || (plateforme === 'MacIntel' && pointsTactiles > 1)) return 'iphone'
  if (/Android/i.test(agent)) return 'android'
  return null
}

/** Ce téléphone-ci. */
export function telephone(): Telephone | null {
  try {
    return telephoneDe(navigator.userAgent, navigator.platform ?? '', navigator.maxTouchPoints ?? 0)
  } catch {
    return null
  }
}

/** L'application ouverte depuis l'écran d'accueil, et non dans un onglet. */
export function estInstallee(): boolean {
  try {
    // Safari sur iPhone le dit à sa façon ; les autres, par le mode d'affichage du manifeste.
    if ((navigator as { standalone?: boolean }).standalone === true) return true
    return ['standalone', 'fullscreen', 'minimal-ui'].some(mode => window.matchMedia(`(display-mode: ${mode})`).matches)
  } catch {
    return false
  }
}

/** L'invitation de Chrome (`beforeinstallprompt`) : sa fenêtre, une fois, et la réponse qu'on y donne. */
interface InvitationAInstaller extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let invitation: InvitationAInstaller | null = null
let installeeIci = false
const abonnes = new Set<() => void>()
const prevenir = () => abonnes.forEach(f => f())

/**
 * Écoute, dès le démarrage de la page (`main.tsx`), ce que Chrome propose :
 * son invitation arrive tôt, souvent avant que l'accueil soit dessiné, et ne
 * revient pas. Gardée, elle ne s'affiche plus d'elle-même en bas de l'écran
 * — un bandeau qui pouvait surgir en pleine question, en soirée — : la carte
 * de l'accueil l'offre quand on la touche.
 */
export function ecouterLInstallation(cible: Pick<Window, 'addEventListener'> = window) {
  cible.addEventListener('beforeinstallprompt', e => {
    e.preventDefault()
    invitation = e as InvitationAInstaller
    prevenir()
  })
  cible.addEventListener('appinstalled', () => {
    invitation = null
    installeeIci = true
    prevenir()
  })
}

/** Chrome a-t-il offert d'installer ? Alors un toucher suffit. */
export const invitationOfferte = (): boolean => invitation !== null

/** Installée pendant cette visite : la carte n'a plus rien à dire. */
export const installeeDepuisIci = (): boolean => installeeIci

/** Être prévenu quand l'invitation arrive, sert ou que l'application s'installe. */
export function suivreLInstallation(f: () => void): () => void {
  abonnes.add(f)
  return () => abonnes.delete(f)
}

/**
 * « Installer l'application » : la fenêtre de Chrome. L'invitation ne sert
 * qu'une fois — Chrome en refera une plus tard s'il le juge bon.
 */
export async function installer(): Promise<'acceptee' | 'refusee' | 'indisponible'> {
  const offerte = invitation
  if (!offerte) return 'indisponible'
  invitation = null
  prevenir()
  await offerte.prompt()
  const { outcome } = await offerte.userChoice
  return outcome === 'accepted' ? 'acceptee' : 'refusee'
}

const CLE_MASQUEE = 'quizz.installer.masquee'

/** La carte masquée d'un toucher sur sa croix : sur ce téléphone, elle ne revient pas. */
export function carteMasquee(): boolean {
  try {
    return localStorage.getItem(CLE_MASQUEE) === '1'
  } catch {
    return false
  }
}

export function masquerLaCarte() {
  try {
    localStorage.setItem(CLE_MASQUEE, '1')
  } catch {
    // Stockage refusé : masquée pour cette visite seulement.
  }
}
