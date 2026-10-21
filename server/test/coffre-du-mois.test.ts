// Le coffre du mois (le souhait du propriétaire du 21 octobre 2026 : « à la
// fin du mois, une récompense du coffre, comme celui de la semaine ») : à la
// clôture du mois du quiz du jour, la place de chacun au classement fait le
// rang de son coffre — premier, royal ; deuxième à quatrième, d'or ;
// cinquième à dixième, d'argent ; au-delà, de bois — et il s'ouvre comme celui
// de la semaine, une seule fois.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { ProfileStore } from '../src/auth/profiles'
import { PLACES_DU_COFFRE_DU_MOIS, moisDuCoffreValide, rangDuCoffreDuMois } from '../../shared/coffre'

ProfileStore.tirageEclat = () => false

interface Horloge {
  t: number
}

async function avecBanc(debut: number, scenario: (banc: Banc, horloge: Horloge) => Promise<void>) {
  const horloge = { t: debut }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t, hasardDuCoffre: () => 0 })
  try {
    await scenario(banc, horloge)
  } finally {
    await banc.close()
  }
}

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

function base<T>(banc: Banc, fn: (db: Database.Database) => T): T {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

const idDe = (banc: Banc, login: string) =>
  base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id)

/** Une partie du quiz du jour finie, écrite en base : de quoi classer le mois sans la jouer. */
function jouee(banc: Banc, login: string, jour: string, points: number) {
  const id = idDe(banc, login)
  base(banc, db => {
    const midi = Date.UTC(Number(jour.slice(0, 4)), Number(jour.slice(5, 7)) - 1, Number(jour.slice(8, 10)), 10, 0)
    db.prepare(`INSERT OR IGNORE INTO jour_tirages (jour, questions, annulees, tire_le) VALUES (?, ?, '[]', 1)`).run(
      jour,
      JSON.stringify(Array.from({ length: 10 }, () => ({ reponses: ['a', 'b'], bonne: 0 }))),
    )
    db.prepare(
      `INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, ?, ?, 10, NULL, ?, 5, ?, 0)`,
    ).run(id, jour, midi, points, midi + 120_000)
  })
}

const NOV_1 = Date.UTC(2026, 10, 1, 9, 0)

test('la place au classement du mois fait le rang du coffre — royal, d’or, d’argent, de bois', () => {
  assert.deepEqual(PLACES_DU_COFFRE_DU_MOIS, { royal: 1, or: 4, argent: 10 })
  const rangs = [1, 2, 4, 5, 10, 11, 200].map(rangDuCoffreDuMois)
  assert.deepEqual(rangs, ['royal', 'or', 'or', 'argent', 'argent', 'bois', 'bois'])
  assert.ok(moisDuCoffreValide('2026-10') && !moisDuCoffreValide('2026-13') && !moisDuCoffreValide('2026-10-12'))
})

test('à la clôture d’octobre, chacun reçoit le coffre de sa place, qu’il ouvre une seule fois', () =>
  // Samedi 31 octobre 2026, 10 h à Paris : le mois n'est pas clos.
  avecBanc(Date.UTC(2026, 9, 31, 9, 0), async (banc, horloge) => {
    const cookies: string[] = []
    // Douze joueurs aux points distincts : la première place a 12 000 points, la douzième 1 000.
    for (let i = 1; i <= 12; i++) {
      const login = `joueur${i}`
      cookies.push(await inscrireProfil(banc.url, login, `Joueur ${i}`, '🦊'))
      jouee(banc, login, '2026-10-05', 13_000 - i * 1000)
    }
    const avant = (await lire(banc, cookies[0], '/api/joueur/missions')).corps
    assert.deepEqual(avant.coffres, [], 'octobre n’est pas fini : pas de coffre du mois')
    const tot = await poster(banc, cookies[0], '/api/joueur/coffre', { semaine: '2026-10' })
    assert.equal(tot.status, 400)

    // Dimanche 1er novembre : la première visite clôt la veille, puis le mois.
    horloge.t = NOV_1
    const attendus = ['royal', 'or', 'or', 'or', 'argent', 'argent', 'argent', 'argent', 'argent', 'argent', 'bois', 'bois']
    for (let i = 0; i < 12; i++) {
      const coffres = (await lire(banc, cookies[i], '/api/joueur/missions')).corps.coffres
      assert.deepEqual(coffres, [{ semaine: '2026-10', tampons: 0, rang: attendus[i], place: i + 1 }], `la place ${i + 1}`)
    }

    // Le champion ouvre le sien : un tirage, une fois — rouvert, il redonne ce qu'il a donné.
    const ouvert = await poster(banc, cookies[0], '/api/joueur/coffre', { semaine: '2026-10' })
    assert.equal(ouvert.status, 200, ouvert.corps.error)
    assert.equal(ouvert.corps.coffre.rang, 'royal')
    assert.equal(ouvert.corps.coffre.place, 1)
    assert.equal(ouvert.corps.coffre.tampons, 0)
    const rouvert = await poster(banc, cookies[0], '/api/joueur/coffre', { semaine: '2026-10' })
    assert.deepEqual(rouvert.corps.coffre, ouvert.corps.coffre)
    assert.equal(base(banc, db => (db.prepare('SELECT COUNT(*) AS n FROM profile_coffres').get() as { n: number }).n), 1)
    assert.deepEqual((await lire(banc, cookies[0], '/api/joueur/missions')).corps.coffres, [], 'ouvert, il n’attend plus')

    // Celui de la douzième place est de bois, et ne s'ouvre pas à la place d'un autre.
    const bois = await poster(banc, cookies[11], '/api/joueur/coffre', { semaine: '2026-10' })
    assert.equal(bois.corps.coffre.rang, 'bois')
    const pasLeSien = await poster(banc, cookies[0], '/api/joueur/coffre', { semaine: '2026-09' })
    assert.equal(pasLeSien.status, 400, 'un mois où il n’était pas classé')
    assert.match(pasLeSien.corps.error, /pas de coffre/i)

    // Novembre commence : son coffre à lui ne s'ouvre qu'à sa clôture.
    const novembre = await poster(banc, cookies[1], '/api/joueur/coffre', { semaine: '2026-11' })
    assert.equal(novembre.status, 400)
    assert.match(novembre.corps.error, /fin du mois/)
  }))

test('les ex æquo en tête ont tous le coffre royal, le suivant la troisième place ; seul dans le mois, personne n’a de coffre', () =>
  avecBanc(Date.UTC(2026, 9, 31, 9, 0), async (banc, horloge) => {
    const a = await inscrireProfil(banc.url, 'ada', 'Ada', '🦊')
    const b = await inscrireProfil(banc.url, 'bea', 'Béa', '🐻')
    const c = await inscrireProfil(banc.url, 'cleo', 'Cléo', '🐼')
    jouee(banc, 'ada', '2026-10-05', 5000)
    jouee(banc, 'bea', '2026-10-05', 5000)
    jouee(banc, 'cleo', '2026-10-05', 0)
    horloge.t = NOV_1
    const coffre = async (cookie: string) => (await lire(banc, cookie, '/api/joueur/missions')).corps.coffres
    assert.deepEqual(await coffre(a), [{ semaine: '2026-10', tampons: 0, rang: 'royal', place: 1 }])
    assert.deepEqual(await coffre(b), [{ semaine: '2026-10', tampons: 0, rang: 'royal', place: 1 }])
    // Une partie à zéro point : le coffre de bois au mieux, jamais la place qu'un classement à zéro lui donnerait.
    assert.deepEqual(await coffre(c), [{ semaine: '2026-10', tampons: 0, rang: 'bois', place: 11 }])

    // Un mois à un seul joueur : pas de classement, pas de coffre.
    jouee(banc, 'ada', '2026-11-10', 5000)
    horloge.t = Date.UTC(2026, 11, 1, 9, 0)
    const decembre = await coffre(a)
    assert.deepEqual(decembre.map((x: any) => x.semaine), ['2026-10'], 'novembre n’avait qu’un joueur')
  }))
