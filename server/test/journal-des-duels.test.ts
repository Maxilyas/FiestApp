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
import { createClient, type Client, type InStatement } from '@libsql/client'
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
  const interne = campagne as unknown as {
    lesDuels(): Promise<JournalDesDuels>
    relireLesDuels(cible: DuelsARelire): Promise<void>
    duelsEnLecture: Promise<JournalDesDuels> | null
  }
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
      await comparer(client, await interne.lesDuels(), horloge.t, 'des séries finies sous ses yeux')

      // Une fin écrite sans lui — l'ancien serveur, le temps d'une mise en
      // ligne — : sur sa ligne, sans `rowid` neuf, le rattrapage par différence
      // ne la voit pas. La première relecture d'ensemble du démarrage, trois
      // minutes après sa première lecture, si.
      const ailleurs = db.prepare("SELECT id FROM campagne_series WHERE mode = 'rencontre' AND finie_le IS NULL AND json_valid(adversaire) ORDER BY id LIMIT 1").get() as { id: string }
      finir.run(horloge.t, ailleurs.id)
      horloge.t = MAINTENANT + 4 * 60_000
      await interne.lesDuels()
      await interne.duelsEnLecture
      await comparer(client, await interne.lesDuels(), horloge.t, 'une fin écrite ailleurs, la relecture du démarrage passée')
    } finally {
      db.close()
    }

    // Quarante minutes après le démarrage — avant la relecture d'ensemble
    // suivante, une heure après la première — : six duels ont fermé, leurs
    // tentatives commencées comptent sans que rien s'écrive.
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

// ── Ce que les relectures ne perdent pas en route ───────────────────────────
//
// Ce qu'une relecture lit peut arriver trop tard, ou pas du tout : un lot
// qui écrit sa fin et ne répond pas, une réponse écrite juste après la
// fermeture de son duel, une relecture qui tombe, un profil qui part pendant
// qu'elle revient (la revue du 24 octobre 2026). Chaque cas, la fraîcheur de
// la production — rien ne se rattrape par différence —, l'horloge à la main,
// et ce qui revient trop tard retenu par une porte : jamais une pause.

interface Interne {
  lesDuels(): Promise<JournalDesDuels>
  duelsEnLecture: Promise<JournalDesDuels> | null
  client: Client
}

const DUEL = "INSERT INTO campagne_duels (code, auteur, questions, cree_le, ferme_le, adversaire, cote_auteur, cote_adversaire) VALUES (?, ?, '[]', ?, ?, ?, 1000, 1000)"
const SERIE =
  'INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, duel, adversaire) VALUES (?, ?, ?, ?, 3, ?, ?, ?, ?, ?, ?)'
/** Trois questions à jouer, la bonne réponse la première. */
const QUESTIONS = JSON.stringify(['q1', 'q2', 'q3'].map(id => ({ id, question: '?', reponses: ['oui', 'non'], bonne: 0 })))

async function surUneBase(
  faire: (o: { campagne: CampagneStore; interne: Interne; horloge: { t: number }; ecrire: (sql: string, args: (string | number | null)[]) => Promise<unknown>; attendu: (p: string) => Promise<unknown> }) => Promise<void>,
) {
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-duels-'))
  const url = `file:${path.join(dir, 'permanente.db').replace(/\\/g, '/')}`
  const horloge = { t: MAINTENANT }
  const campagne = new CampagneStore(url, undefined, { base: baseDEssai(30), maintenant: () => horloge.t, fraicheurDesDuelsMs: 3_600_000 })
  const client = createClient({ url })
  try {
    await campagne.init()
    await faire({
      campagne,
      interne: campagne as unknown as Interne,
      horloge,
      ecrire: (sql, args) => client.execute({ sql, args }),
      attendu: async p => duelsLus((await client.execute(lectureDesDuels(p, horloge.t))).rows),
    })
  } finally {
    client.close()
    campagne.close()
    rmSync(dir, { recursive: true, force: true })
  }
}

/** La prochaine lecture que `vise` reconnaît : lue tout de suite, sa réponse ne revient qu'à `laisser()`. */
function retenir(client: Client, vise: (stmt: InStatement) => boolean) {
  const execute = client.execute.bind(client) as (stmt: InStatement) => ReturnType<Client['execute']>
  let laisser!: () => void
  let signaler!: () => void
  const porte = new Promise<void>(r => (laisser = r))
  const lue = new Promise<void>(r => (signaler = r))
  client.execute = (async (stmt: InStatement) => {
    const res = await execute(stmt)
    if (vise(stmt)) {
      signaler()
      await porte
    }
    return res
  }) as Client['execute']
  return { lue, laisser }
}

const relitLeDuel = (code: string) => (stmt: InStatement) => typeof stmt !== 'string' && stmt.sql.includes('d.code IN') && (stmt.args as unknown[]).includes(code)

/** Le journal relu en entier trois minutes après le démarrage : la relecture suivante est dans une heure. */
async function apresLaRelectureDuDemarrage(interne: Interne, horloge: { t: number }) {
  await interne.lesDuels()
  horloge.t = MAINTENANT + 4 * 60_000
  await interne.lesDuels()
  await interne.duelsEnLecture
}

test('une relecture lue avant le départ d’un profil ne le remet pas dans le journal refait, et qui l’attendait lit le neuf', () =>
  surUneBase(async ({ campagne, interne, horloge, ecrire, attendu }) => {
    // Un duel fini des deux côtés entre p3 et p4 ; un entre p3 et p7 qui ferme dans dix minutes, commencé des deux côtés.
    await ecrire(DUEL, ['d34', 'p3', MAINTENANT - 7200_000, MAINTENANT + 5 * JOUR_MS, 'p4'])
    await ecrire(SERIE, ['a3', 'p3', '[]', 0, 6, MAINTENANT - 7100_000, MAINTENANT - 7000_000, 'duel', 'd34', null])
    await ecrire(SERIE, ['a4', 'p4', '[]', 0, 3, MAINTENANT - 6900_000, MAINTENANT - 6800_000, 'duel', 'd34', null])
    await ecrire(DUEL, ['d37', 'p3', MAINTENANT - 7 * JOUR_MS + 600_000, MAINTENANT + 600_000, 'p7'])
    await ecrire(SERIE, ['b3', 'p3', '[]', 0, 4, MAINTENANT - 3600_000, null, 'duel', 'd37', null])
    await ecrire(SERIE, ['b7', 'p7', '[]', 0, 2, MAINTENANT - 3500_000, null, 'duel', 'd37', null])
    await apresLaRelectureDuDemarrage(interne, horloge)
    assert.equal((await interne.lesDuels()).duelsDe('p4').length, 1)

    // La fermeture de d37 se relit, lue tout de suite ; sa réponse revient
    // après que p3 est parti et que le journal s'est relu sans lui.
    const { lue, laisser } = retenir(interne.client, relitLeDuel('d37'))
    horloge.t = MAINTENANT + 11 * 60_000
    const premiere = interne.lesDuels()
    await lue
    await campagne.oublierProfil('p3')
    const neuve = interne.lesDuels()
    await interne.duelsEnLecture
    laisser()
    const [rendu, refait] = await Promise.all([premiere, neuve])
    for (const p of ['p4', 'p7']) {
      const sql = await attendu(p)
      assert.deepEqual(rendu.duelsDe(p), sql, `qui attendait la relecture lit le journal refait · ${p}`)
      assert.deepEqual(refait.duelsDe(p), sql, `les lignes lues avant son départ ne le remettent pas · ${p}`)
    }
  }))

test('une relecture ratée ne fait échouer personne, et se refait à la lecture suivante', () =>
  surUneBase(async ({ interne, horloge, ecrire, attendu }) => {
    await ecrire(DUEL, ['d12', 'p1', MAINTENANT - 7 * JOUR_MS + 600_000, MAINTENANT + 600_000, 'p2'])
    await ecrire(SERIE, ['b1', 'p1', '[]', 0, 4, MAINTENANT - 3600_000, null, 'duel', 'd12', null])
    await ecrire(SERIE, ['b2', 'p2', '[]', 0, 2, MAINTENANT - 3500_000, null, 'duel', 'd12', null])
    await apresLaRelectureDuDemarrage(interne, horloge)
    const client = interne.client
    const execute = client.execute.bind(client) as (stmt: InStatement) => ReturnType<Client['execute']>
    client.execute = ((stmt: InStatement) => {
      if (relitLeDuel('d12')(stmt)) {
        client.execute = execute as Client['execute']
        return Promise.reject(new Error('fetch failed'))
      }
      return execute(stmt)
    }) as Client['execute']
    horloge.t = MAINTENANT + 11 * 60_000
    // Deux demandes de front — le solde et le dé — : la relecture tombe, elles lisent le journal qu'il y a.
    await assert.doesNotReject(Promise.all([interne.lesDuels(), interne.lesDuels()]))
    assert.deepEqual((await interne.lesDuels()).duelsDe('p1'), await attendu('p1'), 'relue à la lecture suivante')
    assert.equal((await attendu('p1') as unknown[]).length, 1)
  }))

test('une fin de partie dont le lot n’a pas répondu — écrite ou non — se relit à la lecture suivante', () =>
  surUneBase(async ({ campagne, interne, ecrire, attendu }) => {
    // Une rencontre au dé, sa dernière question à jouer ; Automate n'en a trouvé aucune.
    const automate = JSON.stringify({ serie: 'x', profil: '', simule: true, reponses: [false, false, false] })
    await ecrire(SERIE, ['r1', 'p1', JSON.stringify([JSON.parse(QUESTIONS)[0]]), 0, 0, MAINTENANT - 60_000, null, 'rencontre', null, automate])
    assert.deepEqual((await interne.lesDuels()).duelsDe('p1'), [])
    // Le lot de sa dernière réponse s'écrit, puis ne répond pas.
    const client = interne.client
    const batch = client.batch.bind(client)
    client.batch = (async (...args: Parameters<Client['batch']>) => {
      client.batch = batch
      await batch(...args)
      throw new Error('fetch failed')
    }) as Client['batch']
    await assert.rejects(campagne.repondre('p1', 'r1', 0, 0))
    // Sa ligne n'est pas neuve : le rattrapage par différence ne la verrait pas. Relue par sa clé.
    assert.equal((await attendu('p1') as unknown[]).length, 1)
    assert.deepEqual((await interne.lesDuels()).duelsDe('p1'), await attendu('p1'))
  }))

test('une réponse acceptée juste avant la fermeture de son duel, écrite juste après, se relit', () =>
  surUneBase(async ({ campagne, interne, horloge, ecrire, attendu }) => {
    // Un duel qui ferme dans dix minutes : p1 en est à sa deuxième question, p2 a commencé.
    const ferme = MAINTENANT + 10 * 60_000
    await ecrire(DUEL, ['d12', 'p1', ferme - 7 * JOUR_MS, ferme, 'p2'])
    await ecrire(SERIE, ['t1', 'p1', QUESTIONS, 1, 1, MAINTENANT - 3600_000, null, 'duel', 'd12', null])
    await ecrire(SERIE, ['t2', 'p2', QUESTIONS, 1, 0, MAINTENANT - 3500_000, null, 'duel', 'd12', null])
    await apresLaRelectureDuDemarrage(interne, horloge)
    // Acceptée une milliseconde avant la fermeture ; pendant que son lot part,
    // la fermeture passe et une autre demande relit le duel — avant elle.
    horloge.t = ferme - 1
    const client = interne.client
    const batch = client.batch.bind(client)
    client.batch = (async (...args: Parameters<Client['batch']>) => {
      client.batch = batch
      horloge.t = ferme + 1
      await interne.lesDuels()
      return batch(...args)
    }) as Client['batch']
    await campagne.repondre('p1', 't1', 1, 0)
    assert.deepEqual((await interne.lesDuels()).duelsDe('p1'), await attendu('p1'), 'sa bonne réponse comptée')
  }))
