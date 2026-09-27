// Les outils communs des reproductions de la mission `jour-regles` : un banc
// dont l'horloge du quiz du jour est celle du test, et de quoi jouer comme
// le ferait le téléphone. Calqués sur `server/test/jour-partie.test.ts`.
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { demarrer, ecrire, patienter, type Banc } from '../../../server/test/banc'

export interface Horloge {
  t: number
}

/** Samedi 26 septembre 2026, 10 h à Paris. */
export const DEBUT = Date.UTC(2026, 8, 26, 8, 0)
export const JOUR = '2026-09-26'
export const LENDEMAIN = '2026-09-27'

export async function avecBanc(scenario: (banc: Banc, horloge: Horloge) => Promise<void>, debut = DEBUT) {
  const horloge = { t: debut }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t })
  try {
    await scenario(banc, horloge)
  } finally {
    await banc.close()
  }
}

export const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

export const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

/** La base permanente, le temps d'une lecture ou d'une écriture. */
export function base<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

/** Le tirage d'un jour, lu en base : les bonnes réponses que le téléphone ne voit jamais. */
export function tirage(banc: Banc, jour = JOUR): { bonne: number; reponses: string[]; texte: string; duree: number }[] {
  return base(banc, db => {
    const r = db.prepare('SELECT questions FROM jour_tirages WHERE jour = ?').get(jour) as { questions: string } | undefined
    return r ? JSON.parse(r.questions) : []
  })
}

export const idDe = (banc: Banc, login: string) =>
  base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id)

/** Attend que `condition` soit vraie — cinq secondes au plus. */
export async function jusqua(condition: () => boolean, quoi: string) {
  for (let essai = 0; essai < 500; essai++) {
    if (condition()) return
    await patienter(10)
  }
  throw new Error(`jamais arrivé : ${quoi}`)
}

/**
 * Joue toute la partie : `choix(i, bonne)` dit ce qu'il touche à la question
 * i, chaque réponse `delai` ms après l'affichage. Rend la dernière vue et les
 * révélations.
 */
export async function jouer(
  banc: Banc,
  horloge: Horloge,
  cookie: string,
  juste: (i: number) => boolean,
  delai = 0,
) {
  let etat = (await poster(banc, cookie, '/api/jour/commencer')).corps
  const questions = tirage(banc, etat.jour)
  const revelations: any[] = []
  while (etat.question) {
    const i = etat.question.index
    horloge.t += delai
    const bonne = questions[i].bonne
    const choix = juste(i) ? bonne : (bonne + 1) % questions[i].reponses.length
    const r = await poster(banc, cookie, '/api/jour/repondre', { jour: etat.jour, index: i, choix })
    assert.equal(r.status, 200, r.corps.error)
    revelations.push(r.corps)
    etat = (await poster(banc, cookie, '/api/jour/suivante')).corps
  }
  return { etat, revelations }
}
