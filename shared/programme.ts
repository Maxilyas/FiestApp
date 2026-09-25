// Le programme de la soirée (rapport du 25 septembre 2026, lot 3) : les quiz
// de ce soir, dans l'ordre, chacun avec son multiplicateur — la finale en ×2.
//
// Sans lui, chaque manche se lançait en cherchant la bonne carte parmi toute
// la bibliothèque, à l'écran commun, devant la salle, en se souvenant de
// l'ordre et du ×2 de la finale. Le programme est nommé et reste après la
// soirée : c'est le seul regroupement de la bibliothèque — un « dossier »
// ordonné, où un quiz peut figurer dans plusieurs. Un seul est celui de ce
// soir (`actif`) : la console propose son prochain quiz.
//
// Il ne quitte jamais les écrans d'animateur : il annonce les titres à venir.

import { tronquer } from './avatars'

/** Au-delà, ce n'est plus une soirée. */
export const MAX_ENTREES = 30
export const MAX_TITRE_PROGRAMME = 60
/** Assez pour ranger les soirées d'une année, pas de quoi remplir la base. */
export const MAX_PROGRAMMES = 50

export type Multiplicateur = 1 | 2 | 3

export interface EntreeDeProgramme {
  quizId: string
  /** Réglé d'avance : la finale en ×2, sans y penser au moment de la lancer. */
  multiplier: Multiplicateur
}

export interface Programme {
  id: string
  titre: string
  entrees: EntreeDeProgramme[]
  /** Le programme de ce soir : un seul à la fois par espace. */
  actif: boolean
  updatedAt: number
}

/** Les identifiants que le serveur donne à un quiz : un UUID, ou le nom d'un modèle livré. */
const ID = /^[\w-]{1,64}$/

/** Les entrées telles qu'on les garde : chaque quiz une fois, un multiplicateur permis, trente au plus. */
export function normaliserEntrees(brut: unknown): EntreeDeProgramme[] {
  if (!Array.isArray(brut)) return []
  const vus = new Set<string>()
  const entrees: EntreeDeProgramme[] = []
  for (const e of brut) {
    const quizId = (e as { quizId?: unknown } | null)?.quizId
    if (typeof quizId !== 'string' || !ID.test(quizId) || vus.has(quizId)) continue
    vus.add(quizId)
    const m = Number((e as { multiplier?: unknown }).multiplier)
    entrees.push({ quizId, multiplier: m === 2 || m === 3 ? m : 1 })
    if (entrees.length === MAX_ENTREES) break
  }
  return entrees
}

/** Le nom d'un programme, sans espaces en trop ; celui qu'il prend si on ne lui en donne pas. */
export function titreDeProgramme(brut: unknown): string {
  const titre = typeof brut === 'string' ? tronquer(brut.trim().replace(/\s+/g, ' '), MAX_TITRE_PROGRAMME).trim() : ''
  return titre || 'Programme de la soirée'
}

/** « Soirée du 25 septembre » : le nom d'un programme qu'on commence sans le nommer, à la date de l'animateur. */
export function titreDuJour(date: Date): string {
  return `Soirée du ${date.getDate() === 1 ? '1er' : date.getDate()} ${MOIS[date.getMonth()]}`
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

/**
 * Où en est le programme ce soir. Seuls comptent les quiz qui se jouent
 * encore — un quiz supprimé, archivé ou sans question prête sort du compte,
 * et « 2 sur 3 » compte ce qui se lancera. Le prochain est le premier qu'on
 * n'a pas joué ce soir : un quiz lancé hors programme, puis le programme
 * repris, ne fait rien sauter.
 */
export function avancementDuProgramme(
  entrees: readonly EntreeDeProgramme[],
  jouables: ReadonlySet<string>,
  joues: ReadonlySet<string>,
): { entrees: EntreeDeProgramme[]; prochain: EntreeDeProgramme | null; ensuite: EntreeDeProgramme | null } {
  const restantes = entrees.filter(e => jouables.has(e.quizId))
  const aJouer = restantes.filter(e => !joues.has(e.quizId))
  return { entrees: restantes, prochain: aJouer[0] ?? null, ensuite: aJouer[1] ?? null }
}
