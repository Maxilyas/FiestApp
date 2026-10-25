// Le tireur de la Réplique : une réplique du contenu livré
// (`server/content/cabinet/repliques.json`), la jamais vue d'abord, puis la
// plus anciennement vue (`laMoinsVue`) — vue, c'est l'avoir jouée au Cabinet
// (`cab:replique:<id>`). Jamais deux fois la même dans une partie, rechanges
// comprises. Ses quatre mots, ses trois noms et l'ordre où Éclairer effacera
// se battent au départ, par la règle du jeu (`repliqueTiree`), du hasard du
// tireur — celui du serveur, jamais la graine de la partie : qui la saurait
// rebattrait les propositions et lirait la bonne.
import { laMoinsVue } from '../../tirageALaPiece'
import { contenuDuCabinet } from '../contenu'
import { repliqueTiree, type RepliqueTiree } from '../../../../../shared/cabinet/jeux/replique'
import { idDeLaReplique } from '../../../../../shared/cabinet/pieces'
import type { ContexteDuTirage, Posees } from './communs'

export function tirerUneReplique(ctx: ContexteDuTirage, posees: Posees): RepliqueTiree | null {
  const replique = laMoinsVue(
    contenuDuCabinet().repliques.filter(r => !posees.ids.has(idDeLaReplique(r.id))),
    r => idDeLaReplique(r.id),
    ctx.vues,
  )
  if (!replique) return null
  posees.ids.add(idDeLaReplique(replique.id))
  return repliqueTiree(replique, ctx.hasard)
}
