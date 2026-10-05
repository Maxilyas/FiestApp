// Ce que la partie et le mois du quiz du jour décernent (le 5 octobre
// 2026) : le Lève-tôt et le Dernier Métro à l'heure de Paris ; la page du
// calendrier au vingtième jour joué du mois ; Chronos, le Divin du quiz du
// jour, après une série sans une faute ; et, quand un mois se clôt, son
// champion — un titre daté, une marque que la salle verra — et ses mois
// complets, qui ouvrent le Scarabée solaire. Et la série, que des sabliers
// gardent d'un jour manqué.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { connexionAnimateur, demarrer, ecranCommun, ecrire, inscrireProfil, instantane, invite, type Banc } from './banc'
import { ProfileStore, cleDuJour, cleDuMois } from '../src/auth/profiles'
import { PRIX_D_UN_SABLIER, SABLIERS_MAX, serieAvecSabliers } from '../../shared/jour'

ProfileStore.tirageEclat = () => false

const JOUR_MS = 24 * 3600 * 1000

interface Horloge {
  t: number
}

async function avecBanc(debut: number, scenario: (banc: Banc, horloge: Horloge) => Promise<void>) {
  const horloge = { t: debut }
  const banc = await demarrer({ horlogeDuJour: () => horloge.t })
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

const rangesSous = (banc: Banc, login: string, sous: string) =>
  base(banc, db =>
    (db.prepare('SELECT badge FROM profile_badges WHERE profile_id = ? AND soiree_id = ? ORDER BY badge').all(idDe(banc, login), sous) as {
      badge: string
    }[]).map(r => r.badge),
  )

/** Joue toute la partie du jour ; `juste(i)` dit s'il trouve la question i. Chaque réponse prend deux secondes. */
async function jouer(banc: Banc, horloge: Horloge, cookie: string, juste: (i: number) => boolean = () => true) {
  let etat = (await poster(banc, cookie, '/api/jour/commencer')).corps
  const questions = base(banc, db =>
    JSON.parse((db.prepare('SELECT questions FROM jour_tirages WHERE jour = ?').get(etat.jour) as { questions: string }).questions),
  ) as { bonne: number; reponses: string[] }[]
  while (etat.question) {
    const i = etat.question.index
    horloge.t += 2000
    const bonne = questions[i].bonne
    const r = await poster(banc, cookie, '/api/jour/repondre', { jour: etat.jour, index: i, choix: juste(i) ? bonne : (bonne + 1) % questions[i].reponses.length })
    assert.equal(r.status, 200, r.corps.error)
    etat = (await poster(banc, cookie, '/api/jour/suivante')).corps
  }
  return etat
}

/** Des jours déjà joués, écrits en base : `justes` sur dix, un tirage de dix questions pour chacun. */
function joues(banc: Banc, login: string, jours: readonly string[], { justes = 10, points = 1000 } = {}) {
  const id = idDe(banc, login)
  base(banc, db => {
    const tirage = db.prepare(`INSERT OR IGNORE INTO jour_tirages (jour, questions, annulees, tire_le) VALUES (?, ?, '[]', 1)`)
    const partie = db.prepare(
      `INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, ?, ?, 10, NULL, ?, ?, ?, 0)`,
    )
    const questions = JSON.stringify(Array.from({ length: 10 }, () => ({ reponses: ['a', 'b'], bonne: 0 })))
    for (const jour of jours) {
      // Joué à midi, à Paris : ni Lève-tôt ni Dernier Métro.
      const midi = Date.UTC(Number(jour.slice(0, 4)), Number(jour.slice(5, 7)) - 1, Number(jour.slice(8, 10)), 10, 0)
      tirage.run(jour, questions)
      partie.run(id, jour, midi, points, justes, midi + 120_000)
    }
  })
}

const septembre = (de: number, a: number) => Array.from({ length: a - de + 1 }, (_, i) => `2026-09-${String(de + i).padStart(2, '0')}`)

test('à l’heure de Paris : le Lève-tôt finit avant huit heures, le Dernier Métro commence après 23 h 30', () =>
  // Samedi 26 septembre 2026, 6 h 30 à Paris (heure d'été, UTC+2).
  avecBanc(Date.UTC(2026, 8, 26, 4, 30), async (banc, horloge) => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    const fin = await jouer(banc, horloge, alice)
    assert.deepEqual(fin.hautsFaits.map((h: any) => h.key), ['hf:leve-tot'], 'sa fin le fête')
    // 23 h 40 : Bob commence au dernier métro.
    horloge.t = Date.UTC(2026, 8, 26, 21, 40)
    const finBob = await jouer(banc, horloge, bob)
    assert.deepEqual(finBob.hautsFaits.map((h: any) => h.key), ['hf:dernier-metro'])
    assert.deepEqual(rangesSous(banc, 'bob', cleDuJour('2026-09-26')).filter(c => c.startsWith('hf:') && !/:[123]$/.test(c)), ['hf:dernier-metro'])
    // Un titre, comme tout haut fait.
    assert.equal((await ecrire(banc.url, '/api/joueur/moi', { titre: 'hf:leve-tot' }, alice, 'PUT')).status, 200)
  }))

test('au vingtième jour joué du mois, la page du calendrier s’ouvre — une seule fois par mois', () =>
  avecBanc(Date.UTC(2026, 8, 26, 10, 0), async (banc, horloge) => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    joues(banc, 'alice', septembre(1, 19), { justes: 5 })
    const fin = await jouer(banc, horloge, alice)
    assert.equal(fin.page, '09', 'la fin de la partie annonce la page de septembre')
    assert.deepEqual(rangesSous(banc, 'alice', cleDuMois('2026-09')), ['heures:09'])
    // Le lendemain, le vingt et unième jour, rien de plus.
    horloge.t += JOUR_MS
    const lendemain = await jouer(banc, horloge, alice)
    assert.equal(lendemain.page, undefined)
    assert.deepEqual(rangesSous(banc, 'alice', cleDuMois('2026-09')), ['heures:09'])
    // Ni sur l'étagère, ni dans le compte des badges : elle a sa page.
    const moi = (await lire(banc, alice, '/api/joueur/moi')).corps.profile
    assert.ok(!moi.vitrine.some((b: any) => b.key.startsWith('heures:')))
  }))

test('Chronos descend sur le septième jour d’affilée sans une faute — à lui seul, avec son récit', () =>
  avecBanc(Date.UTC(2026, 8, 26, 10, 0), async (banc, horloge) => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    joues(banc, 'alice', septembre(20, 25))
    // Bob : six jours aussi, mais une faute l'avant-veille.
    joues(banc, 'bob', septembre(20, 23))
    joues(banc, 'bob', ['2026-09-24'], { justes: 9 })
    joues(banc, 'bob', ['2026-09-25'])
    const fin = await jouer(banc, horloge, alice)
    assert.deepEqual(fin.divins.map((d: any) => d.key), ['dv:chronos'])
    assert.ok(fin.divins[0].legende, 'son récit, à lui seul')
    const finBob = await jouer(banc, horloge, bob)
    assert.equal(finBob.divins, undefined)
    const moi = (await lire(banc, alice, '/api/joueur/moi')).corps.profile
    assert.deepEqual(moi.divins.map((d: any) => d.key), ['dv:chronos'])
    // Un Divin ne va pas sur l'étagère, et se porte comme les autres.
    assert.ok(!moi.vitrine.some((b: any) => b.key.startsWith('dv:')))
    assert.equal((await ecrire(banc.url, '/api/joueur/moi', { legendaire: 'dv:chronos' }, alice, 'PUT')).status, 200)
  }))

test('le mois se clôt : son champion reçoit un titre daté et la marque du mois suivant, qui a joué chaque jour le Mois complet', () =>
  // Lundi 30 novembre 2026, 10 h à Paris (heure d'hiver, UTC+1).
  avecBanc(Date.UTC(2026, 10, 30, 9, 0), async (banc, horloge) => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    const novembre = Array.from({ length: 30 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`)
    // Alice joue les trente jours ; Bob en manque un, mais marque plus.
    joues(banc, 'alice', novembre, { points: 1000 })
    joues(banc, 'bob', novembre.filter(j => j !== '2026-11-15'), { points: 1500 })
    assert.equal((await lire(banc, alice, '/api/jour')).corps.moisDernier, undefined, 'novembre n’est pas fini')
    // Mardi 1er décembre : la première visite clôt la veille, puis le mois.
    horloge.t = Date.UTC(2026, 11, 1, 9, 0)
    const vueAlice = (await lire(banc, alice, '/api/jour')).corps
    assert.deepEqual(rangesSous(banc, 'bob', cleDuMois('2026-11')), ['mois:2026-11'], 'Bob, champion de novembre')
    assert.deepEqual(rangesSous(banc, 'alice', cleDuMois('2026-11')), ['hf:mois-complet'], 'Alice a joué chaque jour')
    // La première semaine de décembre raconte novembre.
    assert.equal(vueAlice.moisDernier.mois, '2026-11')
    assert.equal(vueAlice.moisDernier.rang, 2)
    assert.deepEqual(vueAlice.moisDernier.recompenses.map((r: any) => r.key), ['hf:mois-complet'])
    assert.deepEqual(vueAlice.moisDernier.legendaires, ['lg:scarabee'], 'le Mois complet ouvre le Scarabée solaire')
    const vueBob = (await lire(banc, bob, '/api/jour')).corps
    assert.deepEqual(vueBob.moisDernier.recompenses.map((r: any) => r.title), ['Champion de novembre 2026'])
    // Son titre daté se porte ; le Triomphe orne sa carte ; la salle le voit champion tout le mois.
    assert.equal((await ecrire(banc.url, '/api/joueur/moi', { titre: 'mois:2026-11' }, bob, 'PUT')).status, 200)
    assert.equal((await ecrire(banc.url, '/api/joueur/moi', { titre: 'mois:2026-10' }, bob, 'PUT')).status, 400, 'pas un mois qu’il n’a pas gagné')
    const moiBob = (await lire(banc, bob, '/api/joueur/moi')).corps.profile
    assert.equal(moiBob.champion, '2026-11')
    assert.ok(moiBob.fonds.includes('triomphe'))
    assert.ok(!('champion' in (await lire(banc, alice, '/api/joueur/moi')).corps.profile))
    // À la soirée, l'écran commun le sait champion — il le salue à son entrée
    // (`EntreeEnScene`) ; Alice entre sans fanfare.
    const ecran = await ecranCommun(banc.url, await connexionAnimateur(banc.url))
    const invites = [await invite(banc.url, 'Bob', '🐻', { cookie: bob }), await invite(banc.url, 'Alice', '🦊', { cookie: alice })]
    const salle = await instantane<any>(ecran, s => s.players?.length === 2, 'Bob et Alice dans la salle')
    assert.equal(salle.players.find((p: any) => p.name === 'Bob').champion, '2026-11')
    assert.ok(!('champion' in salle.players.find((p: any) => p.name === 'Alice')))
    for (const i of invites) i.socket.close()
    ecran.close()
    // Passé la première semaine, le mois d'avant ne se raconte plus ; passé le mois, la marque tombe.
    horloge.t += 7 * JOUR_MS
    assert.equal((await lire(banc, alice, '/api/jour')).corps.moisDernier, undefined)
    horloge.t = Date.UTC(2027, 0, 2, 9, 0)
    await lire(banc, alice, '/api/jour')
    assert.ok(!('champion' in (await lire(banc, bob, '/api/joueur/moi')).corps.profile))
  }))

test('la série et ses sabliers : un jour manqué en prend un, et la série tient sans compter ce jour-là', () => {
  const jours = new Set(['2026-09-20', '2026-09-21', '2026-09-23'])
  // Sans sablier, le 22 casse la série.
  assert.deepEqual(serieAvecSabliers(jours, [], '2026-09-23'), { serie: 1, record: 2, tenue: true, sabliers: 0, couverts: [] })
  // Acheté le 21, il couvre le 22.
  assert.deepEqual(serieAvecSabliers(jours, ['2026-09-21'], '2026-09-23'), { serie: 3, record: 3, tenue: true, sabliers: 0, couverts: ['2026-09-22'] })
  // Acheté le 22 même, avant minuit : il couvre ce jour qu'on ne jouera pas.
  assert.deepEqual(serieAvecSabliers(jours, ['2026-09-22'], '2026-09-23'), { serie: 3, record: 3, tenue: true, sabliers: 0, couverts: ['2026-09-22'] })
  // Acheté le 23, trop tard pour le 22 : il attend le prochain jour manqué.
  assert.deepEqual(serieAvecSabliers(jours, ['2026-09-23'], '2026-09-23'), { serie: 1, record: 2, tenue: true, sabliers: 1, couverts: [] })
  // Aujourd'hui, pas encore joué, ne coûte rien.
  assert.deepEqual(serieAvecSabliers(new Set(['2026-09-22']), ['2026-09-20'], '2026-09-23'), {
    serie: 1,
    record: 1,
    tenue: false,
    sabliers: 1,
    couverts: [],
  })
  // Deux au plus dans la réserve.
  assert.equal(serieAvecSabliers(jours, ['2026-09-19', '2026-09-19', '2026-09-19'], '2026-09-20').sabliers, SABLIERS_MAX)
})

test('un sablier s’achète en confettis — deux au plus — et garde la série d’un jour manqué', () =>
  avecBanc(Date.UTC(2026, 8, 23, 10, 0), async (banc, horloge) => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    // Deux jours joués, de quoi payer trois sabliers (une bonne réponse, un confetti).
    joues(banc, 'alice', ['2026-09-22', '2026-09-23'], { justes: 10 })
    base(banc, db => db.prepare(`UPDATE jour_parties SET justes = ? WHERE profile_id = ?`).run((3 * PRIX_D_UN_SABLIER) / 2, idDe(banc, 'alice')))
    const achat = await poster(banc, alice, '/api/jour/sablier')
    assert.equal(achat.status, 200, achat.corps.error)
    assert.equal(achat.corps.sabliers, 1)
    assert.equal(achat.corps.confettis.solde, 2 * PRIX_D_UN_SABLIER)
    assert.equal((await poster(banc, alice, '/api/jour/sablier')).corps.sabliers, 2)
    const trop = await poster(banc, alice, '/api/jour/sablier')
    assert.equal(trop.status, 400)
    assert.match(trop.corps.error, /déjà 2 sabliers/)
    // Le 24 passe sans partie ; le 25, la série tient : un sablier a couvert le 24.
    horloge.t = Date.UTC(2026, 8, 25, 10, 0)
    const vue = (await lire(banc, alice, '/api/jour')).corps
    assert.equal(vue.serie, 2, 'la série tient, sans compter le jour manqué')
    assert.equal(vue.sabliers, 1, 'il en reste un')
  }))

test('les sabliers s’achètent aussi à plusieurs, d’un seul lot — jamais plus que la place', () =>
  avecBanc(Date.UTC(2026, 8, 23, 10, 0), async banc => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    const carole = await inscrireProfil(banc.url, 'carole', 'Carole', '🐱')
    for (const login of ['alice', 'bob', 'carole']) joues(banc, login, ['2026-09-22', '2026-09-23'])
    // Trois sabliers de confettis pour Alice et Bob, un et un peu plus pour Carole.
    const confettis = (login: string, n: number) =>
      base(banc, db => db.prepare(`UPDATE jour_parties SET justes = ? WHERE profile_id = ?`).run(n / 2, idDe(banc, login)))
    confettis('alice', 3 * PRIX_D_UN_SABLIER)
    confettis('bob', 3 * PRIX_D_UN_SABLIER)
    confettis('carole', PRIX_D_UN_SABLIER + 20)

    // La boutique en prend deux d'un coup, au prix des deux.
    const trois = await poster(banc, alice, '/api/jour/sablier', { nombre: SABLIERS_MAX + 1 })
    assert.equal(trois.status, 400)
    assert.match(trois.corps.error, /à la fois/)
    const deux = await poster(banc, alice, '/api/jour/sablier', { nombre: 2 })
    assert.equal(deux.status, 200, deux.corps.error)
    assert.equal(deux.corps.sabliers, 2)
    assert.equal(deux.corps.confettis.solde, PRIX_D_UN_SABLIER)
    assert.equal(base(banc, db => (db.prepare(`SELECT COUNT(*) AS n FROM profile_sabliers WHERE profile_id = ?`).get(idDe(banc, 'alice')) as { n: number }).n), 2)

    // Un sablier déjà là : la place d'un autre, pas de deux.
    assert.equal((await poster(banc, bob, '/api/jour/sablier', { nombre: 1 })).corps.sabliers, 1)
    const pasLaPlace = await poster(banc, bob, '/api/jour/sablier', { nombre: 2 })
    assert.equal(pasLaPlace.status, 400)
    assert.match(pasLaPlace.corps.error, /place que pour un autre/)
    assert.equal((await poster(banc, bob, '/api/jour/sablier', { nombre: 1 })).corps.sabliers, 2)

    // Pas de quoi payer les deux : rien n'est pris, pas même le premier.
    const manque = await poster(banc, carole, '/api/jour/sablier', { nombre: 2 })
    assert.equal(manque.status, 400)
    assert.match(manque.corps.error, new RegExp(`Il te manque ${PRIX_D_UN_SABLIER - 20} confettis pour 2 sabliers`))
    assert.equal(base(banc, db => (db.prepare(`SELECT COUNT(*) AS n FROM profile_sabliers WHERE profile_id = ?`).get(idDe(banc, 'carole')) as { n: number }).n), 0)
  }))
