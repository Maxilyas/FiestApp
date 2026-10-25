// Le tireur des Indices : une fiche « Qui suis-je ? » du contenu livré
// (`server/content/cabinet/indices.json`), la jamais vue d'abord, puis la plus
// anciennement vue (`laMoinsVue`) — vue, c'est l'avoir jouée au Cabinet
// (`cab:qui:<id>`). Jamais deux fois la même dans une partie, rechanges
// comprises. Rien ne s'y tire au hasard de plus : ses indices se montrent
// dans l'ordre de la fiche, du plus obscur au plus évident.
import { laMoinsVue } from '../../tirageALaPiece'
import { contenuDuCabinet } from '../contenu'
import type { IndicesTires } from '../../../../../shared/cabinet/jeux/indices'
import { idDeLaFiche } from '../../../../../shared/cabinet/pieces'
import type { ContexteDuTirage, Posees } from './communs'

export function tirerUneFiche(ctx: ContexteDuTirage, posees: Posees): IndicesTires | null {
  const fiche = laMoinsVue(
    contenuDuCabinet().fiches.filter(f => !posees.ids.has(idDeLaFiche(f.id))),
    f => idDeLaFiche(f.id),
    ctx.vues,
  )
  if (!fiche) return null
  posees.ids.add(idDeLaFiche(fiche.id))
  return { jeu: 'indices', fiche }
}
