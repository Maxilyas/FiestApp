import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Une liste de l'écran commun coupée à ce qui tient, avec « et 2 autres »
 * dessous. Personne ne fait défiler une télé : les classements défilaient
 * dans leur cadre, et dès sept invités la salle ne voyait ni la sixième
 * estimation, ni les deux derniers de l'écran de victoire.
 *
 * Les lignes sont celles que la liste dessine (`.lb-row`, ou les cartes
 * d'une grille — `lignes`) : on les mesure toutes, puis on cache celles qui
 * passent sous le bas du cadre — toujours la fin de la liste, jamais une
 * ligne coupée en deux. Le cadre doit avoir
 * sa hauteur de sa mise en page (`.coupe`, flexible) : s'il la tenait de son
 * contenu, cacher une ligne le rétrécirait, et il ne couperait jamais rien.
 */
export function Coupe({
  children,
  className = '',
  enPlus = 0,
  lignes = '.lb-row',
  autres = n => `et ${n} autre${n > 1 ? 's' : ''}`,
}: {
  children: ReactNode
  className?: string
  /** Les lignes qu'on n'a même pas dessinées (au-delà des trente premières, par exemple). */
  enPlus?: number
  /** Ce qui se coupe entier : les lignes d'un classement, ou les cartes d'une grille. */
  lignes?: string
  /** Ce qu'on écrit dessous pour ce qui ne tient pas. */
  autres?: (n: number) => string
}) {
  const zone = useRef<HTMLDivElement>(null)
  const pied = useRef<HTMLParagraphElement>(null)
  const [caches, setCaches] = useState(0)

  const mesurer = useCallback(() => {
    const el = zone.current
    if (!el) return
    const aCouper = [...el.querySelectorAll<HTMLElement>(lignes)]
    for (const l of aCouper) l.style.display = ''
    // Un cadre qui ne cache rien ne coupe rien : au téléphone, la page
    // défile, et la liste s'y lit en entier (la feuille de style ne cache
    // qu'au-delà de 1100 px).
    if (getComputedStyle(el).overflowY === 'visible') {
      if (pied.current) pied.current.hidden = enPlus === 0
      setCaches(0)
      return
    }
    // La position de mise en page, pas celle de l'écran : les lignes entrent
    // en glissant, et une mesure prise pendant l'animation serait fausse.
    // Deux mesures : sans « et 2 autres » d'abord — si tout tient, il n'a pas
    // à paraître, et mesurée avec lui, la dernière ligne disparaissait pour
    // laisser la place à « et 1 autre » —, puis avec, s'il faut couper.
    const bas = (avecPied: boolean) => {
      if (pied.current) pied.current.hidden = !avecPied
      return el.clientHeight
    }
    // `offsetTop` et `offsetHeight` sont arrondis au pixel, un par ligne : trois
    // rangées de 44,4 px, qu'un cadre à leur mesure contenait exactement,
    // dépassaient d'un pixel et demi, et la troisième disparaissait.
    const tient = (l: HTMLElement, h: number) => basDe(l, el) <= h + 2
    const sansPied = bas(enPlus > 0)
    let n = 0
    if (!aCouper.every(l => tient(l, sansPied))) {
      const avec = bas(true)
      for (const l of aCouper) {
        if (n > 0 || !tient(l, avec)) {
          l.style.display = 'none'
          n++
        }
      }
    }
    if (pied.current) pied.current.hidden = n + enPlus === 0
    setCaches(n)
  }, [lignes, enPlus])

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
      {/* Toujours là, caché s'il n'y a rien à dire : la mesure le fait
          paraître le temps de savoir ce qu'il coûte. */}
      <p className="coupe-autres" ref={pied} hidden={caches + enPlus === 0}>
        {autres(Math.max(1, caches + enPlus))}
      </p>
    </div>
  )
}

/** Le bas d'un élément, compté depuis le haut de la zone, transformations exclues. */
function basDe(e: HTMLElement, zone: HTMLElement): number {
  let haut = 0
  for (let x: HTMLElement | null = e; x && x !== zone; x = x.offsetParent as HTMLElement | null) haut += x.offsetTop
  return haut + e.offsetHeight
}
