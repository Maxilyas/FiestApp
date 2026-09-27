// Ce qui doit tenir — et tient : la nuit close par dix demandes à la fois.
//
// Rien ne tourne à minuit : la première demande du jour clôt la veille
// (`clorePasses`). Dix téléphones qui ouvrent le quiz du jour à la même
// milliseconde, pendant qu'une soirée rediffuse sa salle (`laureats()`, qui
// lance aussi la nuit en arrière-plan), ne doivent payer le podium qu'une
// fois : verrou `#nuit`, `estClos` relu dedans, `INSERT OR IGNORE`.
//
// Lancer depuis `server/` :
//   nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/concurrence/nuit-en-rafale.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { demarrer, ecrire, inscrireProfil, patienter, type Banc } from '../../../server/test/banc'
import { ProfileStore } from '../../../server/src/auth/profiles'

ProfileStore.tirageEclat = () => false

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

test('dix premières demandes du jour à la même milliseconde : un seul podium, payé une fois', async () => {
  const horloge = { t: Date.UTC(2026, 8, 26, 8, 0) }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t })
  try {
    const joueurs = [
      await inscrireProfil(banc.url, 'alice', 'Alice', '🦊'),
      await inscrireProfil(banc.url, 'bob', 'Bob', '🐻'),
      await inscrireProfil(banc.url, 'chloe', 'Chloé', '🐙'),
    ]
    for (const [n, cookie] of joueurs.entries()) {
      let etat = (await poster(banc, cookie, '/api/jour/commencer')).corps
      const bonnes = JSON.parse(base(banc, 'SELECT questions FROM jour_tirages WHERE jour = ?', JOUR)[0].questions).map(
        (q: any) => q.bonne,
      )
      while (etat.question) {
        const i = etat.question.index
        // Alice trouve tout, Bob neuf, Chloé huit.
        const choix = i < 10 - n ? bonnes[i] : (bonnes[i] + 1) % 2
        await poster(banc, cookie, '/api/jour/repondre', { jour: JOUR, index: i, choix })
        etat = (await poster(banc, cookie, '/api/jour/suivante')).corps
      }
    }
    const xpAvant = await Promise.all(joueurs.map(async c => (await lire(banc, c, '/api/joueur/moi')).corps.profile.xp as number))

    horloge.t = Date.UTC(2026, 8, 27, 6, 0)
    const reponses = await Promise.all(
      Array.from({ length: 10 }, (_, i) => lire(banc, joueurs[i % 3], i % 2 ? '/api/jour' : '/api/jour/classement')),
    )
    assert.ok(reponses.every(r => r.status === 200), JSON.stringify(reponses.map(r => r.status)))
    await patienter(300)

    const podium = base(banc, 'SELECT rang, points, xp FROM jour_podiums WHERE jour = ? ORDER BY rang', JOUR)
    const clotures = base(banc, 'SELECT jour FROM jour_clotures')
    const xpApres = await Promise.all(joueurs.map(async c => (await lire(banc, c, '/api/joueur/moi')).corps.profile.xp as number))
    console.log('podium :', JSON.stringify(podium), '— clôtures :', clotures.length)
    console.log('expérience avant / après la nuit :', JSON.stringify(xpAvant), JSON.stringify(xpApres))
    assert.equal(clotures.length, 1)
    assert.deepEqual(podium.map(p => [p.rang, p.xp]), [[1, 25], [2, 15]])
    // Le podium de la nuit s'ajoute une fois, paliers du jour compris : pas deux.
    const gains = xpApres.map((x, i) => x - xpAvant[i])
    console.log('gagné à la nuit :', JSON.stringify(gains))
    assert.equal(gains[2], 0, 'Chloé, troisième sur trois, n’a pas de marche')
    assert.ok(gains[0] >= 25 && gains[0] < 50, `Alice : ${gains[0]}`)
    assert.ok(gains[1] >= 15 && gains[1] < 30, `Bob : ${gains[1]}`)
  } finally {
    await banc.close()
  }
})
