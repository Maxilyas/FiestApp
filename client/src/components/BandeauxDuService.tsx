import { useLayoutEffect, useRef } from 'react'
import { CLASSE_DU_BANDEAU } from '../../../shared/maintenance'

/** Un bandeau que le serveur a posé avant la racine (`ecrireLeService`) : ses classes et son texte, déjà typographié. */
interface BandeauLu {
  classe: string
  texte: string
}

let lus: { poses: HTMLElement[]; bandeaux: BandeauLu[] } | null = null

/** Lus une fois : la page ne change pas sous les yeux, et la reprise les ôte. */
function lire(): { poses: HTMLElement[]; bandeaux: BandeauLu[] } {
  if (lus) return lus
  try {
    // Ceux d'avant la racine seulement : l'aperçu du QG en porte la classe, dans la page.
    const poses = [...document.querySelectorAll<HTMLElement>(`body > .${CLASSE_DU_BANDEAU}`)]
    lus = { poses, bandeaux: poses.map(b => ({ classe: b.className, texte: b.textContent ?? '' })) }
  } catch {
    // Hors d'une vraie page — un rendu de test —, aucun bandeau.
    lus = { poses: [], bandeaux: [] }
  }
  return lus
}

/**
 * Le bandeau rouge, et la ligne de l'administrateur sur une page fermée,
 * repris dans la racine une fois la page là. Le serveur les pose avant
 * `#root` : là dès la première image, sans un script. Mais un thème peint
 * pose son décor en couches fixes et remonte `#root` d'un niveau, et son voile
 * de nuit, une couche de `#root`, couvrait ce qui vit hors de lui : sous Le
 * Sommet, le bandeau n'était plus qu'une barre sombre, son texte effacé (le
 * retour du propriétaire du 19 octobre 2026). Dans la racine, il passe devant
 * le voile, et reste sous ce que la page pose par-dessus — un dialogue, une
 * feuille, la bannière d'un duel terminé. Il prend la place exacte de ceux du
 * serveur, dans la même image (`useLayoutEffect`) : rien ne bouge. La niche
 * du compagnon, fixée au coin, descend de sa hauteur tant que la page n'a pas
 * défilé (`--haut-du-bandeau`) — mesurée à chaque changement : une ligne de
 * plus à l'écran tourné, rien pendant une question, où il se tait.
 */
export function BandeauxDuService() {
  const { poses, bandeaux } = lire()
  const boite = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const ici = boite.current
    if (!ici) return
    for (const b of poses) b.remove()
    document.body.classList.add('avec-bandeau')
    const mesurer = () => document.body.style.setProperty('--haut-du-bandeau', `${ici.offsetHeight}px`)
    mesurer()
    if (typeof ResizeObserver !== 'function') return
    const suivi = new ResizeObserver(mesurer)
    suivi.observe(ici)
    return () => suivi.disconnect()
  }, [poses])
  if (bandeaux.length === 0) return null
  return (
    <div ref={boite}>
      {bandeaux.map((b, i) => (
        <div key={i} className={b.classe} role="status">
          {b.texte}
        </div>
      ))}
    </div>
  )
}
