import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Une liste de l'écran commun coupée à ce qui tient, avec « et 2 autres »
 * dessous. Personne ne fait défiler une télé : les classements défilaient
 * dans leur cadre, et dès sept invités la salle ne voyait ni la sixième
 * estimation, ni les deux derniers de l'écran de victoire.
 *
 * Les lignes sont celles que la liste dessine (`.lb-row`) : on les mesure
 * toutes, puis on cache celles qui passent sous le bas du cadre — toujours
 * la fin de la liste, jamais une ligne coupée en deux. Le cadre doit avoir
 * sa hauteur de sa mise en page (`.coupe`, flexible) : s'il la tenait de son
 * contenu, cacher une ligne le rétrécirait, et il ne couperait jamais rien.
 */
export function Coupe({
  children,
  className = '',
  enPlus = 0,
}: {
  children: ReactNode
  className?: string
  /** Les lignes qu'on n'a même pas dessinées (au-delà des trente premières, par exemple). */
  enPlus?: number
}) {
  const zone = useRef<HTMLDivElement>(null)
  const [caches, setCaches] = useState(0)

  const mesurer = useCallback(() => {
    const el = zone.current
    if (!el) return
    const lignes = [...el.querySelectorAll<HTMLElement>('.lb-row')]
    for (const l of lignes) l.style.display = ''
    // La position de mise en page, pas celle de l'écran : les lignes entrent
    // en glissant, et une mesure prise pendant l'animation serait fausse.
    const bas = el.clientHeight
    let n = 0
    for (const l of lignes) {
      if (n > 0 || basDe(l, el) > bas + 0.5) {
        l.style.display = 'none'
        n++
      }
    }
    setCaches(n)
  }, [])

  // À chaque rendu : les lignes changent avec les scores. Le même compte ne
  // redessine rien.
  useLayoutEffect(mesurer)
  // Et chaque fois que le cadre ou sa liste changent de taille : une fenêtre
  // qu'on agrandit, mais aussi les polices qui arrivent après la première
  // mesure — la ligne qui tenait en police de secours dépassait à demi.
  useEffect(() => {
    const el = zone.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => mesurer())
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    document.fonts?.ready.then(mesurer).catch(() => {})
    return () => ro.disconnect()
  }, [mesurer])

  return (
    <div className={'coupe ' + className}>
      <div className="coupe-zone" ref={zone}>
        {children}
      </div>
      {caches + enPlus > 0 && (
        <p className="coupe-autres">
          et {caches + enPlus} autre{caches + enPlus > 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}

/** Le bas d'un élément, compté depuis le haut de la zone, transformations exclues. */
function basDe(e: HTMLElement, zone: HTMLElement): number {
  let haut = 0
  for (let x: HTMLElement | null = e; x && x !== zone; x = x.offsetParent as HTMLElement | null) haut += x.offsetTop
  return haut + e.offsetHeight
}
