import { useEffect, useState, type MouseEvent } from 'react'
import { Icon } from './Icon'
import { texteTabule } from '../../../shared/tableur'

/**
 * Le tableau que le bouton annonce : le premier qui le suit dans sa section,
 * sa carte ou son panneau. Posé dans la barre d'outils ou la tête d'un
 * tableau, il le trouve sans qu'on le lui passe — une page à plusieurs
 * tableaux en pose un devant chacun.
 */
function leTableauQuiSuit(bouton: HTMLElement): HTMLTableElement | null {
  const cadre = bouton.closest('section, .qg-carte, .qg-panneau') ?? document.body
  for (const table of cadre.querySelectorAll('table')) {
    if (bouton.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING) return table
  }
  return null
}

/**
 * Les cellules d'un tableau telles que la page les montre : ce qui ne se dit
 * qu'au lecteur d'écran (`.sr-only`) et les icônes (`aria-hidden`) n'y
 * passent pas ; une cellule qui en couvre plusieurs laisse les suivantes
 * vides, pour que les colonnes restent alignées.
 */
function lignesDuTableau(table: HTMLTableElement): string[][] {
  return [...table.rows].map(ligne =>
    [...ligne.cells].flatMap(cellule => {
      const copie = cellule.cloneNode(true) as HTMLElement
      for (const cache of copie.querySelectorAll('.sr-only, [aria-hidden="true"]')) cache.remove()
      return [copie.textContent ?? '', ...Array<string>(Math.max(0, cellule.colSpan - 1)).fill('')]
    }),
  )
}

/**
 * « Copier » : le tableau qui suit, tel que la page le montre — ses en-têtes,
 * ses lignes triées et filtrées —, à coller dans un tableur (la revue
 * d'expert du 4 novembre 2026, P2.10 : de quoi faire hors du QG ce qu'il ne
 * fait pas encore). Il se dit copié deux secondes. Sans presse-papier (une
 * page en http, un navigateur ancien), il ne s'affiche pas, comme « Copier le
 * lien ».
 */
export function CopierLeTableau({ nom = 'ce tableau' }: { nom?: string }) {
  const [copie, setCopie] = useState(false)
  useEffect(() => {
    if (!copie) return
    const t = setTimeout(() => setCopie(false), 2000)
    return () => clearTimeout(t)
  }, [copie])
  if (typeof navigator === 'undefined' || !navigator.clipboard) return null
  const copier = (e: MouseEvent<HTMLButtonElement>) => {
    const table = leTableauQuiSuit(e.currentTarget)
    if (!table) return
    navigator.clipboard.writeText(texteTabule(lignesDuTableau(table))).then(
      () => setCopie(true),
      () => {},
    )
  }
  return (
    <button type="button" className="qg-copier" onClick={copier} title={`Copier ${nom}, à coller dans un tableur`}>
      <Icon name={copie ? 'check' : 'copy'} />
      <span aria-live="polite">{copie ? 'Copié' : 'Copier'}</span>
      <span className="sr-only"> {nom}, à coller dans un tableur</span>
    </button>
  )
}
