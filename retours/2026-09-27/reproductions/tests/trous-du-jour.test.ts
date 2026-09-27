// Épreuves proposées : ce que les mutants survivants du lot D ont montré.
// Chacune passe sur le code d'aujourd'hui et tue un mutant que la suite
// laissait vivre (export/evaluations/tests/mutants.py) :
//
//   M04  statsDuJour compte toute marche du podium comme une victoire
//   M05  resumeDe (la carte) fait de même
//   M06  le laurier va aussi au deuxième
//   M09  une soirée de saison se date à sa dernière question
//   M10  un jour de moins suffit pour la saison
//   M12  les seuils des écussons changent sans que rien ne le dise
//
// Le trou commun : chaque épreuve existante n'a que des ex æquo en tête ou
// un troisième sans podium (trois joueurs n'ont que deux marches). Un
// deuxième seul, sur le podium, n'y paraît jamais.
//
//   cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/tests/trous-du-jour.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { ADMIN, demarrer, ecrire, inscrireProfil, invite, type Banc } from '../../../server/test/banc'
import { ProfileStore } from '../../../server/src/auth/profiles'
import { laureatsDeSaison } from '../../../server/src/core/saisons'
import { gainVide } from '../../../shared/profil'
import { SEUILS_ECUSSON } from '../../../shared/ecussons'

ProfileStore.tirageEclat = () => false

const UN_JOUR = 24 * 3600 * 1000

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

/** Joue toute la partie du jour ; `juste(i)` dit s'il trouve la question i. */
async function jouer(banc: Banc, cookie: string, juste: (i: number) => boolean) {
  let etat = (await poster(banc, cookie, '/api/jour/commencer')).corps
  const questions = base(banc, db =>
    JSON.parse((db.prepare('SELECT questions FROM jour_tirages WHERE jour = ?').get(etat.jour) as { questions: string }).questions),
  ) as { bonne: number; reponses: string[] }[]
  while (etat.question) {
    const i = etat.question.index
    const bonne = questions[i].bonne
    const choix = juste(i) ? bonne : (bonne + 1) % questions[i].reponses.length
    const r = await poster(banc, cookie, '/api/jour/repondre', { jour: etat.jour, index: i, choix })
    assert.equal(r.status, 200, r.corps.error)
    etat = (await poster(banc, cookie, '/api/jour/suivante')).corps
  }
  return etat
}

test('un deuxième seul sur le podium du jour : ni victoire, ni Champion du jour, ni laurier (M04, M05, M06)', async () => {
  // Samedi 26 septembre 2026, 10 h à Paris.
  const horloge = { t: Date.UTC(2026, 8, 26, 8, 0) }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t })
  try {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    const carole = await inscrireProfil(banc.url, 'carole', 'Carole', '🐼')
    const dan = await inscrireProfil(banc.url, 'dan', 'Dan', '🐸')
    // Quatre joueurs, trois marches : Alice 1re, Bob 2e, Carole 3e, Dan rien.
    await jouer(banc, alice, () => true)
    await jouer(banc, bob, i => i !== 3)
    await jouer(banc, carole, i => i !== 3 && i !== 5)
    await jouer(banc, dan, i => i < 2)

    // Le lendemain : la nuit se clôt à la première visite.
    horloge.t += UN_JOUR
    await lire(banc, bob, '/api/jour')
    const podium = base(banc, db => db.prepare('SELECT rang FROM jour_podiums ORDER BY rang').all() as { rang: number }[])
    assert.deepEqual(podium.map(p => p.rang), [1, 2, 3], 'trois marches, sans ex æquo')

    // M04 : seul le premier est Champion du jour.
    const champions = base(banc, db =>
      (db.prepare(`SELECT p.login FROM profile_badges b JOIN profiles p ON p.id = b.profile_id WHERE b.badge = 'hf:champion-du-jour:1' ORDER BY p.login`).all() as { login: string }[]).map(r => r.login),
    )
    assert.deepEqual(champions, ['alice'])

    // M06 : seul le premier porte le laurier.
    const lignes = (await lire(banc, bob, '/api/jour/classement?jour=2026-09-26')).corps.lignes as { nom: string; laurier?: boolean }[]
    assert.deepEqual(lignes.filter(l => l.laurier).map(l => l.nom), ['Alice'])
    assert.ok(!('laurier' in (await lire(banc, bob, '/api/joueur/moi')).corps.profile))

    // M05 : la carte de Bob dit un jour joué, aucune victoire.
    const b = await invite(banc.url, 'Bob', '', { cookie: bob })
    const a = await invite(banc.url, 'Alice', '', { cookie: alice })
    const carte = (id: string) => fetch(`${banc.url}/s/${ADMIN.slug}/joueurs/${id}.json`).then(r => r.json() as Promise<any>)
    assert.deepEqual((await carte(b.playerId)).profil.jour, { joues: 1, victoires: 0 })
    assert.deepEqual((await carte(a.playerId)).profil.jour, { joues: 1, victoires: 1 })
  } finally {
    await banc.close()
  }
})

test('deux jours de quiz du jour pendant Halloween ne suffisent pas : il en faut trois (M10)', async () => {
  // Jeudi 29 octobre 2026, 10 h à Paris ; un jour déjà joué le 26.
  const banc = await demarrer({ horlogeDuJour: () => Date.UTC(2026, 9, 29, 9, 0) })
  try {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const id = base(banc, db => (db.prepare('SELECT id FROM profiles WHERE login = ?').get('alice') as { id: string }).id)
    base(banc, db =>
      db
        .prepare(`INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, '2026-10-26', 1, 10, NULL, 0, 0, 1, 0)`)
        .run(id),
    )
    const fin = await jouer(banc, alice, () => true)
    assert.equal(fin.legendaires, undefined, 'deux jours sur trois : pas encore la Citrouille')
    assert.equal((await lire(banc, alice, '/api/jour')).corps.saison?.joues, 2)
    const moi = (await lire(banc, alice, '/api/joueur/moi')).corps.profile
    assert.ok(!moi.legendaires.includes('lg:citrouille'))
  } finally {
    await banc.close()
  }
})

test('une soirée commencée le soir du 1er novembre et finie après minuit est d’Halloween (M09)', () => {
  const gains = [{ profileId: 'alice', gain: { ...gainVide(), reponses: 12 } }]
  // 23 h 50 puis 0 h 20, heure de Paris (UTC+1 en novembre).
  const premiere = Date.UTC(2026, 10, 1, 22, 50)
  const derniere = Date.UTC(2026, 10, 1, 23, 20)
  const journal = [
    { answered: true, createdAt: derniere },
    { answered: true, createdAt: premiere },
  ]
  assert.deepEqual(
    laureatsDeSaison(journal, gains).map(l => l.badge),
    ['saison:halloween'],
    'datée à sa première question, comme son nom',
  )
})

test('les seuils des écussons sont ceux que RECOMPENSES.md annonce (M12)', () => {
  // Un choix de produit : le changer se dit, ici et dans RECOMPENSES.md.
  assert.deepEqual([...SEUILS_ECUSSON], [20, 75, 200])
})
