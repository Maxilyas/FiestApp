// Le catalogue des énigmes à livre ouvert : celles dont tout se voit sur le
// plateau. Leur règle est ici, dans `shared/`, parce que le téléphone les joue
// sans attendre le serveur — qui rejoue ensuite la partie pour la juger.
//
// Les énigmes à secret (une sonde, une preuve, une lettre) n'y sont pas : leur
// fiche porte la réponse, et vit au serveur seulement (`server/src/core/puits/`).
// Un moule de plus s'ajoute en une ligne ici, et son plateau dans
// `client/src/puits/plateaux.ts`.
import type { Fiche, MouleQuelconque, Niveau } from './socle'
import { cruches, CRUCHES } from './moules/cruches'
import { traversee, TRAVERSEES } from './moules/traversee'

export const MOULES_OUVERTS: Readonly<Record<string, MouleQuelconque>> = { traversee, cruches }
export const FICHES_OUVERTES: readonly Fiche[] = [...TRAVERSEES, ...CRUCHES]

/**
 * Ce qui refait une énigme : le nom d'une fiche écrite, ou la graine d'une
 * énigme tirée. C'est tout ce qu'une partie retient de son énigme — une énigme
 * tirée ne se garde nulle part, elle se retire à l'identique.
 */
export type Corde = { id: string } | { moule: string; graine: number; niveau: Niveau }

const PAR_ID = new Map(FICHES_OUVERTES.map(f => [f.id, f]))
/** L'énigme à livre ouvert que cette corde désigne, ou rien : le téléphone et le serveur la refont de la même façon. */
export function ficheOuverte(c: Corde): Fiche | null {
  if ('id' in c) return PAR_ID.get(c.id) ?? null
  const m = MOULES_OUVERTS[c.moule]
  return m?.tirer ? m.tirer(c.graine, c.niveau) : null
}
