// Minuit : une réponse acceptée avant minuit, écrite après le podium de la nuit.
//
// `repondre` vérifie « Minuit est passé » AVANT d'écrire (`enregistrer`, un
// aller-retour vers Turso). La nuit, elle, se clôt à la première demande
// d'après minuit (`clorePasses` → `clore`) et lit le classement sans prendre
// le verrou des joueurs : la réponse encore en route n'y est pas. Le podium
// (`jour_podiums`, INSERT OR IGNORE) et le laurier se figent sur un
// classement d'une réponse en retard, et le classement « figé » du jour —
// lu dans `jour_parties` — dit autre chose que son podium.
//
// Ce que ce test attend (il échoue aujourd'hui) : le podium payé par la nuit
// est celui du classement final du jour.
//
// Lancer depuis `server/` :
//   nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/concurrence/minuit-reponse-en-route.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { demarrer, ecrire, inscrireProfil, patienter, type Banc } from '../../../server/test/banc'
import { ProfileStore } from '../../../server/src/auth/profiles'
import { JourStore } from '../../../server/src/core/jour'

ProfileStore.tirageEclat = () => false

/** Samedi 26 septembre 2026, 23 h 59 à Paris (UTC+2). */
const AVANT_MINUIT = Date.UTC(2026, 8, 26, 21, 59, 0)
/** Dimanche 27, 0 h 00 min 30 s à Paris. */
const APRES_MINUIT = Date.UTC(2026, 8, 26, 22, 0, 30)
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

/** Joue les questions `de` à `a` (exclu) : `juste(i)` dit s'il la trouve. */
async function jouer(banc: Banc, cookie: string, de: number, a: number, juste: (i: number) => boolean) {
  const b = bonnes(banc)
  for (let i = de; i < a; i++) {
    const choix = juste(i) ? b[i] : (b[i] + 1) % 2
    const r = await poster(banc, cookie, '/api/jour/repondre', { jour: JOUR, index: i, choix })
    assert.equal(r.status, 200, r.corps.error)
    await poster(banc, cookie, '/api/jour/suivante')
  }
}

test('minuit : la réponse acceptée à 23 h 59 compte au podium de la nuit', async () => {
  const horloge = { t: AVANT_MINUIT }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t })
  const proto = JourStore.prototype as any
  const enregistrer = proto.enregistrer
  try {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    await poster(banc, alice, '/api/jour/commencer')
    await jouer(banc, alice, 0, 10, i => i > 0) // 9 sur 10 : 1 800 points
    await poster(banc, bob, '/api/jour/commencer')
    await jouer(banc, bob, 0, 9, i => i > 0) // 8 sur 9 : 1 600 points, la dixième montrée

    // Sa dixième réponse passe la vérification de minuit, puis attend son
    // aller-retour vers la base — le temps que minuit sonne.
    let entrer!: () => void
    const entree = new Promise<void>(r => (entrer = r))
    let relacher!: () => void
    const porte = new Promise<void>(r => (relacher = r))
    proto.enregistrer = async function (this: JourStore, partie: { question: number }, ...reste: unknown[]) {
      if (partie.question === 9) {
        entrer()
        await porte
      }
      return enregistrer.call(this, partie, ...reste)
    }
    const derniere = poster(banc, bob, '/api/jour/repondre', { jour: JOUR, index: 9, choix: bonnes(banc)[9] })
    await entree

    // Minuit passe ; Alice ouvre le quiz du lendemain : la nuit se clôt.
    horloge.t = APRES_MINUIT
    const matin = await lire(banc, alice, '/api/jour')
    assert.equal(matin.status, 200)
    relacher()
    const r = await derniere
    assert.equal(r.status, 200, `la réponse de 23 h 59 : ${JSON.stringify(r.corps)}`)
    await patienter(300)

    const parties = base(banc, 'SELECT profile_id, points FROM jour_parties WHERE jour = ? ORDER BY points DESC', JOUR)
    const podium = base(banc, 'SELECT profile_id, rang, points, xp FROM jour_podiums WHERE jour = ? ORDER BY rang', JOUR)
    const idDe = async (cookie: string) => (await lire(banc, cookie, '/api/joueur/moi')).corps.profile.id as string
    const [idAlice, idBob] = [await idDe(alice), await idDe(bob)]
    const nom = (id: string) => (id === idAlice ? 'Alice' : id === idBob ? 'Bob' : id)
    console.log('classement final du jour :', JSON.stringify(parties.map(p => [nom(p.profile_id), p.points])))
    console.log('podium payé par la nuit  :', JSON.stringify(podium.map(p => [nom(p.profile_id), p.rang, p.points, p.xp])))
    const laureats = (await lire(banc, alice, '/api/jour')).corps.vainqueursDHier.map((v: any) => v.nom)
    console.log('vainqueurs d’hier annoncés :', JSON.stringify(laureats))

    // Alice et Bob finissent à 1 800 : ex æquo en tête, ils gagnent tous les deux.
    assert.deepEqual(
      { podium: podium.map(p => [nom(p.profile_id), p.rang, p.points]).sort(), vainqueurs: [...laureats].sort() },
      { podium: [['Alice', 1, 1800], ['Bob', 1, 1800]], vainqueurs: ['Alice', 'Bob'] },
      'le podium de la nuit s’est figé sans la réponse de 23 h 59',
    )
  } finally {
    proto.enregistrer = enregistrer
    await banc.close()
  }
})
