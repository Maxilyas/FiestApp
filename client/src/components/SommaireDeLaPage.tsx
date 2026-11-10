import { useEffect, useState } from 'react'
import { Icon } from './Icon'

/** Un titre de section de la page : son ancre et ce qu'il dit. */
export interface TitreDeSection {
  id: string
  texte: string
}

/** En deçà, la page se lit d'un coup d'œil : pas de sommaire. */
const SECTIONS_POUR_UN_SOMMAIRE = 4

/**
 * Les titres de la page ouverte, lus dans la page elle-même : chaque section
 * du QG titre sa console d'un `h2` à ancre (`aria-labelledby`), et une section
 * de plus entre dans le sommaire sans rien déclarer. Relus quand la page
 * change — ses données arrivent après elle. La page se trouve par un
 * sélecteur, pas par une `ref` : posée sur le repère (`main.page-corps`), elle
 * le faisait sortir de la forme que la garde des repères relit
 * (`design.test.ts`).
 */
export function useSommaire(selecteur: string, cle: unknown): TitreDeSection[] {
  const [titres, setTitres] = useState<TitreDeSection[]>([])
  useEffect(() => {
    const racine = document.querySelector<HTMLElement>(selecteur)
    if (!racine) return
    let image = 0
    const lire = () => {
      image = 0
      // Ni le titre d'une fenêtre, ni celui d'un aperçu (`aria-hidden`) : l'affiche que la page des nouveautés montre telle
      // que les joueurs la verront titre comme une section, et son titre entrait au sommaire — deux fois depuis qu'elle a
      // deux aperçus.
      const lus = [...racine.querySelectorAll<HTMLHeadingElement>('h2[id]')]
        .filter(h => !h.closest('[role="dialog"], [aria-hidden="true"]'))
        .map(h => ({ id: h.id, texte: (h.textContent ?? '').trim() }))
        .filter(t => t.texte)
      setTitres(avant => (avant.length === lus.length && avant.every((t, i) => t.id === lus[i].id && t.texte === lus[i].texte) ? avant : lus))
    }
    lire()
    const veille = new MutationObserver(() => {
      if (!image) image = requestAnimationFrame(lire)
    })
    veille.observe(racine, { childList: true, subtree: true, characterData: true })
    return () => {
      veille.disconnect()
      if (image) cancelAnimationFrame(image)
    }
  }, [selecteur, cle])
  return titres
}

/**
 * Le sommaire d'une longue page du QG (la revue d'ergonomie du 4 novembre
 * 2026 : le Cabinet faisait sept mille pixels en 1366, douze mille au
 * téléphone, et « Régler » un palier de la campagne était au milieu, sans une
 * ancre). À l'ordinateur, une rangée de liens sous la tête ; au téléphone,
 * replié sous « Sur cette page ». Rien sous quatre sections.
 */
export function SommaireDeLaPage({ titres }: { titres: readonly TitreDeSection[] }) {
  if (titres.length < SECTIONS_POUR_UN_SOMMAIRE) return null
  // Des boutons, pas des liens : l'ancre d'une page du QG est dans l'adresse (`/admin#serveur`), et un `#titre` l'aurait
  // remplacée par une page qui n'existe pas.
  const aller = (id: string) => (e: { currentTarget: HTMLElement }) => {
    const cible = document.getElementById(id)
    if (!cible) return
    cible.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    // Le titre atteint prend le focus, sans anneau : le lecteur d'écran l'annonce, le Tab suivant part de là.
    if (!cible.hasAttribute('tabindex')) cible.setAttribute('tabindex', '-1')
    cible.focus({ preventScroll: true })
    e.currentTarget.closest('details')?.removeAttribute('open')
  }
  const liens = titres.map(t => (
    <li key={t.id}>
      <button type="button" className="qg-sommaire-lien" onClick={aller(t.id)}>
        {t.texte}
      </button>
    </li>
  ))
  return (
    <nav className="qg-sommaire-page" aria-label="Sur cette page">
      <div className="qg-sommaire-rangee">
        <span className="qg-sommaire-titre" aria-hidden="true">
          Sur cette page
        </span>
        <ul>{liens}</ul>
      </div>
      <details className="qg-sommaire-pli">
        <summary>
          <Icon name="list" />
          Sur cette page · {titres.length} sections
        </summary>
        <ul>{liens}</ul>
      </details>
    </nav>
  )
}
