// Un signalement en plusieurs points : ce que le joueur corrige d'une
// question, et la phrase qui part à l'administrateur.
//
// « Signaler une erreur » ne demandait qu'une phrase libre : une question qui
// avait deux défauts — la bonne réponse et une coquille, ou la faute et sa
// difficulté — ne se disait qu'à moitié, et l'administrateur devinait le
// reste (la remarque du propriétaire du 2 novembre 2026 : « si par exemple il
// y a plusieurs erreurs, comme corriger la question + difficulté »). Le
// joueur coche ce qui cloche, corrige chaque point à sa place, et tout part
// d'un seul envoi.
//
// Le serveur ne reçoit encore qu'un texte (`/api/jour/signaler`,
// `/api/campagne/serie/:id/signaler`, 280 caractères) : la phrase se compose
// ici, ses points d'abord, rangés comme le formulaire de correction du QG
// les relit — la bonne réponse, l'intitulé, l'anecdote, le classement —, et
// ce que le joueur en dit en dernier, seul à pouvoir être coupé.

import { tronquer } from './avatars'

/**
 * Un signalement tient en une phrase : celle de l'écran. Il vit ici, et la
 * campagne le reprend : la page du jour, qui signale aussi, ne charge pas
 * `shared/campagne.ts` pour une constante.
 */
export const SIGNALEMENT_MAX = 280

/** La question telle que le joueur l'a lue au moment de la signaler. */
export interface QuestionSignalee {
  texte: string
  reponses: readonly string[]
  /** La bonne réponse, en index de `reponses`, telle que la partie l'a dite. */
  bonne: number
  anecdote: string | null
  categorie: string | null
  /**
   * La marche qu'elle tenait, accordée à « une question » (« facile »,
   * « moyenne », « experte ») — la campagne la connaît, pas le quiz du jour.
   */
  marche?: string
}

/** Ce qu'il propose. Un champ absent n'est pas touché. */
export interface Proposition {
  /** La bonne réponse d'après lui, en index des réponses. */
  bonne?: number
  /** L'intitulé et l'anecdote, tels qu'il les a récrits. */
  texte?: string
  anecdote?: string
  difficulte?: 'trop-facile' | 'trop-dure'
  /** La catégorie qu'il lui donnerait. */
  categorie?: string
  /** Ce qui ne rentre dans aucune case, en une phrase. */
  autre?: string
  /** Comment il le sait : un lien, un livre, un souvenir. */
  preuve?: string
}

/**
 * Un point du signalement, dit comme la feuille le montre : ce qu'il touche,
 * et ce qui était écrit contre ce qu'il écrirait — ou, sans `avant`, ce qu'il
 * en dit (« trop dure pour une facile »).
 */
export interface Changement {
  ou: string
  avant: string | null
  apres: string
}

/**
 * Ce qui change d'un texte à l'autre, mot à mot : le début et la fin
 * communs écartés, il reste le passage récrit. Une coquille corrigée se lit
 * « Suise → Suisse », pas comme deux phrases entières à comparer de l'œil.
 */
export function ecartDesMots(avant: string, apres: string): { enleve: string; ajoute: string } | null {
  const a = avant.trim().split(/\s+/).filter(Boolean)
  const b = apres.trim().split(/\s+/).filter(Boolean)
  let debut = 0
  while (debut < a.length && debut < b.length && a[debut] === b[debut]) debut++
  let fin = 0
  while (fin < a.length - debut && fin < b.length - debut && a[a.length - 1 - fin] === b[b.length - 1 - fin]) fin++
  const enleve = a.slice(debut, a.length - fin).join(' ')
  const ajoute = b.slice(debut, b.length - fin).join(' ')
  return enleve || ajoute ? { enleve, ajoute } : null
}

/** Ce que la proposition change vraiment, point par point, dans l'ordre où le QG les relit. */
export function changementsProposes(q: QuestionSignalee, p: Proposition): Changement[] {
  const points: Changement[] = []
  if (p.bonne !== undefined && p.bonne !== q.bonne && q.reponses[p.bonne] !== undefined) {
    points.push({ ou: 'La bonne réponse', avant: q.reponses[q.bonne] ?? '', apres: q.reponses[p.bonne] })
  }
  if (p.texte !== undefined) {
    const e = ecartDesMots(q.texte, p.texte)
    if (e) points.push({ ou: 'La question', avant: e.enleve, apres: e.ajoute })
  }
  if (p.anecdote !== undefined) {
    const e = ecartDesMots(q.anecdote ?? '', p.anecdote)
    if (e) points.push({ ou: 'L’anecdote', avant: e.enleve, apres: e.ajoute })
  }
  if (p.difficulte) {
    const trop = p.difficulte === 'trop-dure' ? 'trop dure' : 'trop facile'
    points.push({ ou: 'La difficulté', avant: null, apres: q.marche ? `${trop} pour une ${q.marche}` : trop })
  }
  if (p.categorie && p.categorie !== q.categorie) {
    points.push({ ou: 'La catégorie', avant: q.categorie ?? '', apres: p.categorie })
  }
  const autre = p.autre?.trim()
  if (autre) points.push({ ou: 'Autre chose', avant: null, apres: autre })
  return points
}

/**
 * La phrase qui part au serveur : chaque point, puis ce qu'il en dit. Vide
 * quand rien ne change — la feuille n'envoie rien. Coupée par `tronquer`,
 * jamais au milieu d'un caractère, et toujours par la fin : ses points
 * passent avant sa preuve.
 */
export function texteDuSignalement(q: QuestionSignalee, p: Proposition): string {
  const points = changementsProposes(q, p).map(c => {
    if (c.avant === null) return `${c.ou} : ${c.apres}.`
    // Un mot ajouté là où rien n'était écrit : « L'anecdote : → … ».
    return c.avant ? `${c.ou} : « ${c.avant} » → « ${c.apres} ».` : `${c.ou} : ajouter « ${c.apres} ».`
  })
  if (points.length === 0) return ''
  const preuve = p.preuve?.trim()
  return tronquer([...points, preuve ? `Pourquoi : ${preuve}` : ''].filter(Boolean).join(' '), SIGNALEMENT_MAX)
}
