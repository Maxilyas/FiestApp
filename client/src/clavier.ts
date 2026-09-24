/**
 * Le clavier du téléphone, sur les écrans d'entrée.
 *
 * Ces écrans ancrent leur bouton en bas (`.join-grow`) : clavier ouvert, il
 * passait dessous — Jeanne a cru que « Continuer » avait disparu, Sofia et
 * Camille ont cherché le leur. Deux gestes, pour tous les navigateurs :
 *
 * - tant qu'un champ a le clavier, l'espace d'ancrage se replie
 *   (`html.clavier`, voir le CSS) : le bouton suit le formulaire au lieu
 *   d'attendre au fond de la page, sous le clavier ;
 * - une fois le clavier levé, la page défile pour montrer le bouton avec le
 *   champ, quand les deux tiennent ensemble au-dessus du clavier. Sinon, le
 *   navigateur garde le champ en vue, et c'est très bien ainsi.
 *
 * Chrome Android fait en plus remonter la page au-dessus du clavier
 * (`interactive-widget=resizes-content`, dans `index.html`) ; Safari
 * l'ignore, et c'est ce module qui fait le travail.
 */
const CHAMP = 'input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]), textarea'

function champDeSaisie(el: EventTarget | null): HTMLElement | null {
  if (!(el instanceof HTMLElement) || !el.matches(CHAMP)) return null
  return el.closest('.join') ? el : null
}

/** Montre le bouton principal avec le champ, s'ils tiennent ensemble à l'écran. */
function rapprocher(champ: HTMLElement) {
  if (document.activeElement !== champ) return
  const bouton = champ.closest('.join')?.querySelector<HTMLElement>('.btn-primary')
  if (!bouton) return
  const vv = window.visualViewport
  const hauteur = vv?.height ?? window.innerHeight
  const visibleEnBas = (vv?.offsetTop ?? 0) + hauteur
  const haut = (champ.closest('.field') ?? champ).getBoundingClientRect().top
  const bas = bouton.getBoundingClientRect().bottom
  const marge = 12
  if (bas - haut + 2 * marge > hauteur) return
  if (bas + marge > visibleEnBas) window.scrollBy(0, bas + marge - visibleEnBas)
}

export function installerClavier() {
  // À la souris, pas de clavier qui monte : rien à replier.
  if (!window.matchMedia?.('(pointer: coarse)').matches) return
  const racine = document.documentElement
  let enCours: HTMLElement | null = null

  document.addEventListener('focusin', e => {
    const champ = champDeSaisie(e.target)
    if (!champ) return
    enCours = champ
    racine.classList.add('clavier')
    // Le clavier met un instant à monter : on attend qu'il ait pris sa
    // place. Sans `visualViewport`, un délai tient lieu de signal.
    setTimeout(() => rapprocher(champ), 350)
  })

  document.addEventListener('focusout', () => {
    // D'un champ à l'autre, le clavier reste levé : on ne replie qu'une fois
    // le focus parti ailleurs.
    setTimeout(() => {
      if (champDeSaisie(document.activeElement)) return
      enCours = null
      racine.classList.remove('clavier')
    }, 0)
  })

  window.visualViewport?.addEventListener('resize', () => {
    if (enCours) rapprocher(enCours)
  })
}
