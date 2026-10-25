// Le tireur des Indices : une fiche « Qui suis-je ? » du contenu livré
// (`server/content/cabinet/indices.json`), la jamais vue d'abord, puis la plus
// anciennement vue (`laMoinsVue`) — vue, c'est l'avoir jouée au Cabinet
// (`cab:qui:<id>`). Jamais deux fois la même dans une partie, rechanges
// comprises, ni deux fiches dont l'une souffle l'autre (`uneFicheSouffleLAutre`).
// Rien ne s'y tire au hasard de plus : ses indices se montrent dans l'ordre de
// la fiche, du plus obscur au plus évident.
import { laMoinsVue } from '../../tirageALaPiece'
import { contenuDuCabinet } from '../contenu'
import type { Fiche } from '../../../../../shared/cabinet/contenu'
import { motsUtiles, type IndicesTires } from '../../../../../shared/cabinet/jeux/indices'
import { idDeLaFiche } from '../../../../../shared/cabinet/pieces'
import type { ContexteDuTirage, Posees } from './communs'

/**
 * Ce qu'une fiche écrit pendant sa manche et à sa révélation — ses cinq
 * indices, son nom, « Le savais-tu ? » —, mot à mot comme une saisie se lit
 * (`motsUtiles`), et les clés qui la désignent : lus une fois par fiche, le
 * contenu ne se lit qu'une fois par processus.
 */
const MOTS_DES_FICHES = new WeakMap<Fiche, { ecrits: ReadonlySet<string>; cles: readonly string[] }>()

function motsDeLaFiche(f: Fiche) {
  let mots = MOTS_DES_FICHES.get(f)
  if (!mots) MOTS_DES_FICHES.set(f, (mots = { ecrits: new Set(motsUtiles([...f.indices, f.reponse, f.savais].join(' '))), cles: f.cles.flatMap(motsUtiles) }))
  return mots
}

/**
 * L'une des deux écrit-elle une clé de l'autre ? La révélation d'une manche
 * montre les cinq indices et l'anecdote : celle de George Sand écrit
 * « Frédéric Chopin », et la manche suivante, Chopin, se jouait le nom sous les
 * yeux. Dans un sens ou dans l'autre : une rechange de Changer, tirée après
 * les trois manches, peut se jouer avant celle d'après. Une clé seule désigne
 * la personne (`bonneIdentite`) : elle suffit à la souffler.
 */
export function uneFicheSouffleLAutre(a: Fiche, b: Fiche): boolean {
  const [ma, mb] = [motsDeLaFiche(a), motsDeLaFiche(b)]
  return mb.cles.some(c => ma.ecrits.has(c)) || ma.cles.some(c => mb.ecrits.has(c))
}

export function tirerUneFiche(ctx: ContexteDuTirage, posees: Posees): IndicesTires | null {
  const fiches = contenuDuCabinet().fiches
  const tirees = fiches.filter(f => posees.ids.has(idDeLaFiche(f.id)))
  const fiche = laMoinsVue(
    fiches.filter(f => !posees.ids.has(idDeLaFiche(f.id)) && !tirees.some(t => uneFicheSouffleLAutre(t, f))),
    f => idDeLaFiche(f.id),
    ctx.vues,
  )
  if (!fiche) return null
  posees.ids.add(idDeLaFiche(fiche.id))
  return { jeu: 'indices', fiche }
}
