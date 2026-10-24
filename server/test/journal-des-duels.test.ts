// Le journal des duels (`core/journalDesDuels.ts`) : les duels classés de tout
// le monde, gardés en mémoire. Relus de la base à chaque dé, chaque page des
// duels, chaque solde de confettis, ils faisaient 13 % du quota de Turso le
// 23 octobre 2026 — toute l'histoire du joueur à chaque fois, et celle de tous
// pour le classement.
//
// Il se compare ici à la lecture d'avant — `lectureDesDuels` d'un joueur, la
// règle même que la cote relit —, sur une base tirée au hasard : des
// rencontres finies, en route, au gardé illisible ; des duels classés finis
// des deux côtés, commencés d'un seul, jamais relevés, ouverts ou fermés ; des
// défis entre amis, qui n'en sont pas. Puis l'horloge passe leur fermeture —
// leurs tentatives commencées comptent, sans que rien ne s'écrive —, des
// séries finissent sous ses yeux — relues par leur clé, comme dans le lot qui
// écrit leur dernière réponse —, et d'autres s'écrivent sans lui passer par
// les mains : il les lit par différence.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { createClient, type Client } from '@libsql/client'
import { baseDEssai } from './banc'
import { CampagneStore, duelsLus, lectureDesDuels } from '../src/core/campagne'
import type { DuelsARelire, JournalDesDuels } from '../src/core/journalDesDuels'
import { DUREE_D_UN_DUEL_MS } from '../../shared/campagne'

const MAINTENANT = Date.UTC(2026, 9, 22, 12)
const JOUR_MS = 24 * 3600_000
const PROFILS = Array.from({ length: 6 }, (_, i) => `p${i}`)

function hasardDe(graine: number) {
  let g = graine
  return () => (g = (g * 16807) % 2147483647) / 2147483647
}

/**
 * Ce qu'une série laisse en base, à la main : `n` rencontres et `n` duels,
 * autour de `maintenant` — dont `bientot` fermant dans la demi-heure, leurs
 * deux tentatives commencées.
 */
function remplir(fichier: string, hasard: () => number, { depart, n, maintenant, bientot = 0 }: { depart: number; n: number; maintenant: number; bientot?: number }) {
  const db = new Database(fichier)
  const tire = <T>(liste: readonly T[]) => liste[Math.floor(hasard() * liste.length)]
  const entre = (a: number, b: number) => a + Math.floor(hasard() * (b - a))
  try {
    const serie = db.prepare(
      `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, adversaire, duel)
       VALUES (?, ?, '[]', 0, 0, ?, ?, ?, ?, ?, ?)`,
    )
    const duel = db.prepare(
      `INSERT INTO campagne_duels (code, auteur, questions, cree_le, ferme_le, adversaire, cote_auteur, cote_adversaire, cote_cachee_auteur, cote_cachee_adversaire)
       VALUES (?, ?, '[]', ?, ?, ?, ?, ?, ?, ?)`,
    )
    db.transaction(() => {
      for (let k = 0; k < n; k++) {
        // Une rencontre au dé : finie ou en route, son gardé lisible ou non.
        const commencee = entre(maintenant - 20 * JOUR_MS, maintenant - 60_000)
        const reponses = Array.from({ length: entre(3, 12) }, () => hasard() < 0.6)
        const garde = hasard() < 0.9 ? JSON.stringify({ serie: `x${k}`, profil: '', simule: true, reponses }) : 'illisible'
        serie.run(`r${depart + k}`, tire(PROFILS), entre(0, 15), commencee, hasard() < 0.85 ? entre(commencee, maintenant) : null, 'rencontre', garde, null)

        // Un duel classé — ou un défi entre amis, sans adversaire — et ses tentatives.
        const code = `d${depart + k}`
        const auteur = tire(PROFILS)
        const adversaire = hasard() < 0.15 ? null : tire(PROFILS.filter(p => p !== auteur))
        const cree = entre(maintenant - 14 * JOUR_MS, maintenant - 60_000)
        const ferme = cree + DUREE_D_UN_DUEL_MS
        const cote = () => entre(900, 1600)
        duel.run(code, auteur, cree, ferme, adversaire, cote(), cote(), hasard() < 0.7 ? cote() : null, hasard() < 0.7 ? cote() : null)
        for (const [qui, chance] of [
          [auteur, 0.9],
          [adversaire, 0.7],
        ] as const) {
          if (!qui || hasard() > chance) continue
          const debut = entre(cree, Math.min(ferme, maintenant))
          const finie = hasard() < 0.7 ? entre(debut, Math.min(ferme, maintenant)) : null
          serie.run(`t${depart + k}-${qui}`, qui, entre(0, 12), debut, finie, 'duel', null, code)
        }
      }
      for (let k = 0; k < bientot; k++) {
        const code = `b${depart + k}`
        const [auteur, adversaire] = [PROFILS[k % PROFILS.length], PROFILS[(k + 1) % PROFILS.length]]
        const cree = maintenant + 30 * 60_000 - DUREE_D_UN_DUEL_MS
        duel.run(code, auteur, cree, cree + DUREE_D_UN_DUEL_MS, adversaire, 1200, 1300, 1150, 1250)
        serie.run(`t${code}-a`, auteur, entre(0, 12), cree + 60_000, hasard() < 0.5 ? cree + 120_000 : null, 'duel', null, code)
        serie.run(`t${code}-b`, adversaire, entre(0, 12), cree + 60_000, null, 'duel', null, code)
      }
    })()
  } finally {
    db.close()
  }
}

/** Le journal et la lecture d'avant, joueur par joueur, à l'heure dite. */
async function comparer(client: Client, journal: JournalDesDuels, maintenant: number, nom: string): Promise<number> {
  let duels = 0
  for (const p of PROFILS) {
    const attendus = duelsLus((await client.execute(lectureDesDuels(p, maintenant))).rows)
    duels += attendus.length
    assert.deepEqual(journal.duelsDe(p), attendus, `${nom} · ${p}`)
  }
  return duels
}

test('le journal des duels dit ce que disait la lecture de chacun — lu une fois, puis ce qui ferme, ce qui finit et ce qui arrive', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-duels-'))
  const fichier = path.join(dir, 'permanente.db')
  const url = `file:${fichier.replace(/\\/g, '/')}`
  const horloge = { t: MAINTENANT }
  const campagne = new CampagneStore(url, undefined, { base: baseDEssai(30), maintenant: () => horloge.t, fraicheurDesDuelsMs: 0 })
  const interne = campagne as unknown as { lesDuels(): Promise<JournalDesDuels>; relireLesDuels(cible: DuelsARelire): Promise<void> }
  const client = createClient({ url })
  try {
    await campagne.init()
    const hasard = hasardDe(11)
    remplir(fichier, hasard, { depart: 0, n: 120, maintenant: MAINTENANT, bientot: 6 })
    const journal = await interne.lesDuels()
    assert.ok((await comparer(client, journal, horloge.t, 'la base entière')) > 60, 'assez de duels pour comparer')

    // Des séries finissent sous ses yeux : relues par leur clé, comme dans le lot qui écrit leur dernière réponse.
    const db = new Database(fichier)
    // Pas ceux qui ferment dans la demi-heure : leur fermeture se compte plus bas.
    const enRoute = (mode: string) =>
      db.prepare(`SELECT id, duel FROM campagne_series WHERE mode = ? AND finie_le IS NULL AND (duel IS NULL OR duel NOT LIKE 'b%') ORDER BY id LIMIT 3`).all(mode) as {
        id: string
        duel: string | null
      }[]
    const finir = db.prepare('UPDATE campagne_series SET finie_le = ?, justes = justes + 1 WHERE id = ?')
    try {
      for (const r of enRoute('rencontre')) {
        finir.run(horloge.t, r.id)
        await interne.relireLesDuels({ rencontre: r.id })
      }
      const tentatives = enRoute('duel')
      for (const t of tentatives) finir.run(horloge.t, t.id)
      await interne.relireLesDuels({ duels: tentatives.map(t => t.duel!) })
    } finally {
      db.close()
    }
    await comparer(client, await interne.lesDuels(), horloge.t, 'des séries finies sous ses yeux')

    // Quarante minutes plus tard — avant sa relecture d'ensemble — : six duels
    // ont fermé, leurs tentatives commencées comptent sans que rien s'écrive.
    const avant = await comparer(client, await interne.lesDuels(), horloge.t, 'avant leur fermeture')
    horloge.t = MAINTENANT + 40 * 60_000
    assert.equal(await comparer(client, await interne.lesDuels(), horloge.t, 'les duels fermés dans la demi-heure'), avant + 12)

    // Une semaine plus tard : tous les duels ouverts ont fermé, leurs tentatives commencées comptent.
    horloge.t = MAINTENANT + 8 * JOUR_MS
    await comparer(client, await interne.lesDuels(), horloge.t, 'leurs fermetures passées')

    // Des séries écrites sans lui, finies ou non, de nouveaux duels : lues par différence.
    remplir(fichier, hasard, { depart: 120, n: 40, maintenant: horloge.t })
    await comparer(client, await interne.lesDuels(), horloge.t, 'des séries écrites sans lui')
    // Et leurs duels ouverts ferment à leur tour.
    horloge.t += 8 * JOUR_MS
    await comparer(client, await interne.lesDuels(), horloge.t, 'les fermetures des duels arrivés depuis')
  } finally {
    client.close()
    campagne.close()
    rmSync(dir, { recursive: true, force: true })
  }
})
