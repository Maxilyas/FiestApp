// Le classement du jour gardé sous un numéro qu'il n'a pas vu.
//
// `joueursDu` (`core/jour.ts:873`) garde le classement d'un jour tant que
// `revision` ne bouge pas. Mais il lit la base (`SELECT … FROM jour_parties`,
// puis chaque profil), et ne range le résultat qu'APRÈS ces attentes, sous
// le numéro du moment : `{ revision: this.revision, … }`. Une réponse écrite
// pendant la lecture fait monter le numéro — et la lecture, partie avant
// elle, se range sous le numéro neuf. Le classement périmé est alors servi à
// tous jusqu'à la prochaine réponse… et, pour la dernière réponse du jour,
// jusqu'à la nuit, qui paie son podium dessus (`clore`).
//
// Ici, la réponse gagnante de Bob est écrite à 22 h 30 — bien avant minuit,
// rien n'est en route quand la nuit se clôt —, pendant qu'Alice regardait le
// classement.
//
// Ce que ce test attend (il échoue aujourd'hui) : le podium de la nuit et le
// rang affiché suivent la dernière réponse écrite.
//
// Lancer depuis `server/` :
//   nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/concurrence/classement-garde-perime.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { demarrer, ecrire, inscrireProfil, patienter, type Banc } from '../../../server/test/banc'
import { ProfileStore } from '../../../server/src/auth/profiles'

ProfileStore.tirageEclat = () => false

/** Samedi 26 septembre 2026, 22 h 30 à Paris. */
const SOIR = Date.UTC(2026, 8, 26, 20, 30)
/** Dimanche 27, 8 h à Paris. */
const MATIN = Date.UTC(2026, 8, 27, 6, 0)
const JOUR = '2026-09-26'

const poster = (banc: Banc, cookie: string, chemin: string, corps: unknown = {}) =>
  ecrire(banc.url, chemin, corps, cookie).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
function base<T = any>(banc: Banc, sql: string, ...args: unknown[]): T[] {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true, fileMustExist: true })
  try {
    return db.prepare(sql).all(...args) as T[]
  } finally {
    db.close()
  }
}
const bonnes = (banc: Banc): number[] =>
  JSON.parse(base<{ questions: string }>(banc, 'SELECT questions FROM jour_tirages WHERE jour = ?', JOUR)[0].questions).map(
    (q: { bonne: number }) => q.bonne,
  )

async function jouer(banc: Banc, cookie: string, de: number, a: number, juste: (i: number) => boolean) {
  const b = bonnes(banc)
  for (let i = de; i < a; i++) {
    const r = await poster(banc, cookie, '/api/jour/repondre', { jour: JOUR, index: i, choix: juste(i) ? b[i] : (b[i] + 1) % 2 })
    assert.equal(r.status, 200, r.corps.error)
    await poster(banc, cookie, '/api/jour/suivante')
  }
}

test('une réponse écrite pendant qu’un autre lit le classement : ni le rang ni le podium de la nuit ne l’oublient', async () => {
  const horloge = { t: SOIR }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t })
  const byId = ProfileStore.prototype.byId
  try {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    const chloe = await inscrireProfil(banc.url, 'chloe', 'Chloé', '🐙')
    const idBob = (await lire(banc, bob, '/api/joueur/moi')).corps.profile.id as string
    await poster(banc, alice, '/api/jour/commencer')
    await jouer(banc, alice, 0, 10, i => i > 0) // 1 800
    await poster(banc, bob, '/api/jour/commencer')
    await jouer(banc, bob, 0, 9, i => i > 0) // 1 600, la dixième montrée

    // Chloé commence sa partie, puis répond à sa première question : sa
    // réponse fait monter le numéro du classement sans le relire.
    await poster(banc, chloe, '/api/jour/commencer')
    // Alice ouvre le classement ; sa lecture relit le profil de Bob au loin
    // (un aller-retour vers Turso) — pendant ce temps, Bob répond.
    let attenteUnique = true
    ProfileStore.prototype.byId = async function (this: ProfileStore, id: string) {
      const p = await byId.call(this, id)
      if (id === idBob && attenteUnique) {
        attenteUnique = false
        await patienter(300)
      }
      return p
    }
    await poster(banc, chloe, '/api/jour/repondre', { jour: JOUR, index: 0, choix: (bonnes(banc)[0] + 1) % 2 })
    const classementDAlice = lire(banc, alice, '/api/jour/classement')
    await patienter(50)
    const r = await poster(banc, bob, '/api/jour/repondre', { jour: JOUR, index: 9, choix: bonnes(banc)[9] })
    assert.equal(r.status, 200, r.corps.error)
    await classementDAlice
    ProfileStore.prototype.byId = byId

    // Plus aucune réponse ce soir-là. Bob regarde sa place ; puis la nuit passe.
    const deBob = (await lire(banc, bob, '/api/jour')).corps
    const classement = (await lire(banc, bob, '/api/jour/classement')).corps
    console.log('Bob après sa dernière réponse : rang', deBob.rang, '— classement :', JSON.stringify(classement.lignes.map((l: any) => [l.nom, l.points, l.rang])))
    horloge.t = MATIN
    const matin = (await lire(banc, alice, '/api/jour')).corps
    await patienter(300)
    const parties = base(banc, 'SELECT points FROM jour_parties WHERE jour = ? ORDER BY points DESC', JOUR).map(p => p.points)
    const podium = base(banc, 'SELECT profile_id, rang, points FROM jour_podiums WHERE jour = ? ORDER BY rang', JOUR)
    console.log('points en base :', JSON.stringify(parties), '— podium de la nuit :', JSON.stringify(podium.map(p => [p.profile_id === idBob ? 'Bob' : 'Alice', p.rang, p.points])))
    console.log('vainqueurs d’hier annoncés :', JSON.stringify(matin.vainqueursDHier.map((v: any) => v.nom)))

    assert.deepEqual(
      {
        rangDeBob: deBob.rang,
        classement: classement.lignes.map((l: any) => [l.nom, l.points, l.rang]),
        podium: podium.map(p => [p.profile_id === idBob ? 'Bob' : 'Alice', p.rang, p.points]).sort(),
      },
      {
        rangDeBob: 1,
        classement: [['Alice', 1800, 1], ['Bob', 1800, 1], ['Chloé', 0, 3]],
        podium: [['Alice', 1, 1800], ['Bob', 1, 1800]],
      },
      'le classement gardé est celui d’avant la dernière réponse de Bob',
    )
  } finally {
    ProfileStore.prototype.byId = byId
    await banc.close()
  }
})
