// Le tireur de la Réplique : une réplique du contenu livré
// (`server/content/cabinet/repliques.json`), la jamais vue d'abord, puis la
// plus anciennement vue (`laMoinsVue`) — vue, c'est l'avoir jouée au Cabinet
// (`cab:replique:<id>`). Jamais deux fois la même dans une partie, rechanges
// comprises, ni deux répliques dont l'une souffle l'autre
// (`uneRepliqueSouffleLAutre`). Ses quatre mots, ses trois noms et l'ordre où
// Éclairer effacera se battent au départ, par la règle du jeu
// (`repliqueTiree`), du hasard du tireur — celui du serveur, jamais la graine
// de la partie : qui la saurait rebattrait les propositions et lirait la bonne.
import { laMoinsVue } from '../../tirageALaPiece'
import { contenuDuCabinet } from '../contenu'
import type { Replique } from '../../../../../shared/cabinet/contenu'
import { motsUtiles } from '../../../../../shared/cabinet/jeux/indices'
import { repliqueTiree, type RepliqueTiree } from '../../../../../shared/cabinet/jeux/replique'
import { idDeLaReplique } from '../../../../../shared/cabinet/pieces'
import type { ContexteDuTirage, Posees } from './communs'

/**
 * Ce qu'une réplique écrit à sa révélation — elle entière, qui l'a dite, sa
 * source, « Le savais-tu ? » —, mot à mot comme les Indices lisent un nom
 * (`motsUtiles`), et les mots de qui l'a dite. Les deux autres noms proposés
 * n'en sont pas : ils ne désignent personne. Lus une fois par réplique.
 */
const MOTS_DES_REPLIQUES = new WeakMap<Replique, { ecrits: ReadonlySet<string>; qui: readonly string[] }>()

function motsDeLaReplique(r: Replique) {
  let mots = MOTS_DES_REPLIQUES.get(r)
  if (!mots) MOTS_DES_REPLIQUES.set(r, (mots = { ecrits: new Set(motsUtiles([r.avant, r.mot, r.apres, r.qui, r.source, r.savais].join(' '))), qui: motsUtiles(r.qui) }))
  return mots
}

/**
 * La révélation de l'une nomme-t-elle qui a dit l'autre — chacun de ses mots ?
 * L'anecdote des Fourberies de Scapin nomme Cyrano de Bergerac, et « C'est une
 * péninsule ! » se jouait ensuite, son nom à peine lu. Deux répliques d'une
 * même personne aussi : la première l'a nommée. Dans un sens ou dans l'autre,
 * comme aux Indices : une rechange peut se jouer avant la manche d'après.
 */
export function uneRepliqueSouffleLAutre(a: Replique, b: Replique): boolean {
  const [ma, mb] = [motsDeLaReplique(a), motsDeLaReplique(b)]
  const nomme = (x: typeof ma, y: typeof mb) => y.qui.length > 0 && y.qui.every(m => x.ecrits.has(m))
  return nomme(ma, mb) || nomme(mb, ma)
}

export function tirerUneReplique(ctx: ContexteDuTirage, posees: Posees): RepliqueTiree | null {
  const repliques = contenuDuCabinet().repliques
  const tirees = repliques.filter(r => posees.ids.has(idDeLaReplique(r.id)))
  const replique = laMoinsVue(
    repliques.filter(r => !posees.ids.has(idDeLaReplique(r.id)) && !tirees.some(t => uneRepliqueSouffleLAutre(t, r))),
    r => idDeLaReplique(r.id),
    ctx.vues,
  )
  if (!replique) return null
  posees.ids.add(idDeLaReplique(replique.id))
  return repliqueTiree(replique, ctx.hasard)
}
