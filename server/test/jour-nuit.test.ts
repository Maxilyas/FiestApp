// Ce que la nuit du quiz du jour décerne (le 5 octobre 2026) : ce qui se
// mesure aux autres, quand tout le monde a joué. Le Laurier à chaque
// vainqueur, qui fait grandir le laurier du lendemain ; le Triomphe à trois
// victoires d'affilée, qui ouvre le Dragon d'Or par sa voie du jour ; et
// dans une salle de huit : le Phénix du jour, Seul au monde, l'Éclair du
// jour, la Lanterne du jour, l'Élite — et le Courant d'air à qui laisse sa
// partie en route. Les jours d'avant se relisent au démarrage, une fois.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { ProfileStore, cleDuJour } from '../src/auth/profiles'

ProfileStore.tirageEclat = () => false

/** Samedi 26 septembre 2026, 10 h à Paris. */
const DEBUT = Date.UTC(2026, 8, 26, 8, 0)
const JOUR = '2026-09-26'
const VEILLE = '2026-09-25'
const AVANT_VEILLE = '2026-09-24'
const JOUR_MS = 24 * 3600 * 1000

interface Horloge {
  t: number
}

async function avecBanc(scenario: (banc: Banc, horloge: Horloge) => Promise<void>) {
  const horloge = { t: DEBUT }
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

/** Ce qui est rangé sous un jour pour ce profil. */
const rangesSous = (banc: Banc, login: string, sous: string) =>
  base(banc, db =>
    (db.prepare('SELECT badge FROM profile_badges WHERE profile_id = ? AND soiree_id = ? ORDER BY badge').all(idDe(banc, login), sous) as {
      badge: string
    }[]).map(r => r.badge),
  )

/**
 * Joue la partie du jour au rythme qu'on lui dit : pour chaque question, juste
 * ou non, et le temps mis — l'horloge du quiz du jour avance d'autant avant
 * la réponse. `null` : il pose le téléphone et s'en va, la partie laissée là.
 */
async function jouer(banc: Banc, horloge: Horloge, cookie: string, coup: (i: number) => { juste: boolean; ms: number } | null) {
  let etat = (await poster(banc, cookie, '/api/jour/commencer')).corps
  const questions = base(banc, db =>
    JSON.parse((db.prepare('SELECT questions FROM jour_tirages WHERE jour = ?').get(etat.jour) as { questions: string }).questions),
  ) as { bonne: number; reponses: string[] }[]
  while (etat.question) {
    const i = etat.question.index
    const c = coup(i)
    if (!c) return etat
    horloge.t += c.ms
    const bonne = questions[i].bonne
    const r = await poster(banc, cookie, '/api/jour/repondre', { jour: etat.jour, index: i, choix: c.juste ? bonne : (bonne + 1) % questions[i].reponses.length })
    assert.equal(r.status, 200, r.corps.error)
    etat = (await poster(banc, cookie, '/api/jour/suivante')).corps
  }
  return etat
}

test('la nuit sacre le vainqueur : son laurier grandit, et trois victoires d’affilée font le Triomphe — et le Dragon d’Or', () =>
  avecBanc(async (banc, horloge) => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    const id = idDe(banc, 'alice')
    // Alice a gagné l'avant-veille et la veille, et quatre fois déjà avant :
    // sa cinquième victoire fera son laurier d'or.
    base(banc, db => {
      const podium = db.prepare('INSERT INTO jour_podiums (jour, profile_id, rang, points, xp) VALUES (?, ?, 1, 1500, 25)')
      podium.run(AVANT_VEILLE, id)
      podium.run(VEILLE, id)
      const laurier = db.prepare(
        `INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, 'hf:laurier', ?, '', '🌿', 'Le Laurier', 1)`,
      )
      for (const j of ['2026-09-10', '2026-09-12', AVANT_VEILLE, VEILLE]) laurier.run(id, cleDuJour(j))
    })
    await jouer(banc, horloge, alice, () => ({ juste: true, ms: 1500 }))
    await jouer(banc, horloge, bob, i => ({ juste: i > 2, ms: 4000 }))

    horloge.t = DEBUT + JOUR_MS
    const lendemain = (await lire(banc, alice, '/api/jour')).corps
    assert.deepEqual(rangesSous(banc, 'alice', cleDuJour(JOUR)).filter(c => !c.includes(':1')), ['hf:laurier', 'hf:triomphe'])
    assert.deepEqual(rangesSous(banc, 'bob', cleDuJour(JOUR)), [], 'le second ne gagne rien à la nuit')
    assert.deepEqual(
      lendemain.sonHier.hautsFaits.map((h: any) => h.key),
      ['hf:laurier', 'hf:triomphe'],
      'le lendemain raconte ce que la nuit a décerné',
    )
    assert.deepEqual(lendemain.sonHier.legendaires, ['lg:dragon'], 'le Triomphe ouvre le Dragon d’Or par sa voie du jour')
    const moi = (await lire(banc, alice, '/api/joueur/moi')).corps.profile
    assert.ok(moi.legendaires.includes('lg:dragon'))
    assert.equal(moi.laurier, 2, 'cinq victoires : le laurier d’or')
    assert.ok(!('laurier' in (await lire(banc, bob, '/api/joueur/moi')).corps.profile))
    // Rejouée — une nuit reprise après une panne —, elle ne double rien.
    base(banc, db => db.prepare('DELETE FROM jour_clotures WHERE jour = ?').run(JOUR))
    await banc.redemarrer()
    await lire(banc, alice, '/api/jour')
    assert.equal(
      base(banc, db => (db.prepare(`SELECT COUNT(*) AS n FROM profile_badges WHERE profile_id = ? AND badge = 'hf:laurier'`).get(id) as { n: number }).n),
      5,
    )
  }))

test('dans une salle de huit, la nuit voit qui était seul, le plus rapide, le dernier, qui a filé — et le premier quart', () =>
  avecBanc(async (banc, horloge) => {
    const joueurs = ['alice', 'bob', 'carole', 'david', 'emma', 'farid', 'gaston', 'hugo']
    const cookies = new Map<string, string>()
    for (const login of joueurs) cookies.set(login, await inscrireProfil(banc.url, login, login[0].toUpperCase() + login.slice(1), '🦊'))
    // La veille, Alice a fini dans la moitié basse d'une salle de huit.
    base(banc, db => {
      const partie = db.prepare(
        `INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, ?, 1, 10, NULL, ?, 5, 1, 0)`,
      )
      joueurs.forEach((login, i) => partie.run(idDe(banc, login), VEILLE, login === 'alice' ? 100 : 400 + i * 100))
      db.prepare('INSERT INTO jour_clotures (jour, joueurs, close_le) VALUES (?, 8, 1)').run(VEILLE)
    })
    // Alice trouve tout, vite, et seule la première question ; Bob est le plus
    // rapide sur les trois suivantes ; quatre trouvent tout sauf la première
    // et la dernière, lentement — sous le temps de lecture offert, la vitesse
    // ne paie pas : c'est la dernière qui les met derrière Bob, ex æquo ;
    // Gaston file après deux questions ; Hugo répond à tout, faux.
    await jouer(banc, horloge, cookies.get('alice')!, () => ({ juste: true, ms: 1000 }))
    await jouer(banc, horloge, cookies.get('bob')!, i => ({ juste: i > 0, ms: i >= 1 && i <= 3 ? 800 : 2000 }))
    for (const login of ['carole', 'david', 'emma', 'farid']) await jouer(banc, horloge, cookies.get(login)!, i => ({ juste: i > 0 && i < 9, ms: 3000 }))
    await jouer(banc, horloge, cookies.get('gaston')!, i => (i < 2 ? { juste: i > 0, ms: 3000 } : null))
    await jouer(banc, horloge, cookies.get('hugo')!, () => ({ juste: false, ms: 2500 }))

    horloge.t = DEBUT + JOUR_MS
    await lire(banc, cookies.get('alice')!, '/api/jour')
    const sous = (login: string) => rangesSous(banc, login, cleDuJour(JOUR)).filter(c => !/:[123]$/.test(c))
    assert.deepEqual(sous('alice'), ['hf:eclair-du-jour', 'hf:laurier', 'hf:phenix-du-jour', 'hf:seul-au-monde'])
    assert.deepEqual(sous('bob'), ['hf:eclair-du-jour'], 'le plus rapide sur trois questions')
    assert.deepEqual(sous('carole'), [])
    assert.deepEqual(sous('gaston'), ['hf:courant-d-air'], 'il a laissé sa partie en route')
    assert.deepEqual(sous('hugo'), ['hf:lanterne-du-jour'], 'dernier, en ayant répondu à tout')
    // Le premier quart d'une salle de huit : les deux premiers.
    const elite = async (login: string) =>
      ((await lire(banc, cookies.get(login)!, '/api/joueur/moi')).corps.profile.hautsFaits as any[]).find(h => h.key === 'hf:elite').valeur
    assert.equal(await elite('alice'), 1)
    assert.equal(await elite('bob'), 1)
    assert.equal(await elite('carole'), 0)
  }))

test('une petite salle ne mesure rien aux autres : pas de Seul au monde ni de Lanterne à trois', () =>
  avecBanc(async (banc, horloge) => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    const carole = await inscrireProfil(banc.url, 'carole', 'Carole', '🐼')
    await jouer(banc, horloge, alice, () => ({ juste: true, ms: 1000 }))
    await jouer(banc, horloge, bob, i => ({ juste: i > 0, ms: 3000 }))
    await jouer(banc, horloge, carole, () => ({ juste: false, ms: 3000 }))
    horloge.t = DEBUT + JOUR_MS
    await lire(banc, alice, '/api/jour')
    assert.deepEqual(rangesSous(banc, 'alice', cleDuJour(JOUR)).filter(c => !/:[123]$/.test(c)), ['hf:laurier'])
    assert.deepEqual(rangesSous(banc, 'carole', cleDuJour(JOUR)), [])
  }))

test('au démarrage, les jours d’avant se relisent une fois : la victoire d’avant les règles a son Laurier', () =>
  avecBanc(async banc => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const id = idDe(banc, 'alice')
    // Un jour clos d'avant les hauts faits du jour : Alice l'avait gagné.
    base(banc, db => {
      db.prepare(
        `INSERT INTO jour_tirages (jour, questions, annulees, tire_le) VALUES (?, ?, '[]', 1)`,
      ).run('2026-09-20', JSON.stringify(Array.from({ length: 10 }, () => ({ reponses: ['a', 'b'], bonne: 0 }))))
      // Joué à midi : ni Lève-tôt ni Dernier Métro.
      const midi = Date.UTC(2026, 8, 20, 10, 0)
      db.prepare(
        `INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, '2026-09-20', ?, 10, NULL, 1500, 8, ?, 50)`,
      ).run(id, midi, midi + 120_000)
      db.prepare(`INSERT INTO jour_clotures (jour, joueurs, close_le) VALUES ('2026-09-20', 2, 1)`).run()
      db.prepare(`INSERT INTO jour_podiums (jour, profile_id, rang, points, xp) VALUES ('2026-09-20', ?, 1, 1500, 25)`).run(id)
      db.prepare(`DELETE FROM jour_meta WHERE cle = 'relecture_des_jours'`).run()
    })
    await banc.redemarrer()
    assert.deepEqual(rangesSous(banc, 'alice', cleDuJour('2026-09-20')), ['hf:laurier'])
    assert.equal(
      base(banc, db => (db.prepare(`SELECT valeur FROM jour_meta WHERE cle = 'relecture_des_jours'`).get() as { valeur: string }).valeur),
      '1',
      'une fois : le drapeau est posé',
    )
    assert.equal((await lire(banc, alice, '/api/joueur/moi')).status, 200)
  }))
