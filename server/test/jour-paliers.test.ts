// Les paliers du quiz du jour : L'Assidu (jours joués), Le Champion du jour
// (victoires), Le Sans-Faute (jours sans une faute).
//
// Ils tombent à la fin d'une partie, ou à la nuit qui clôt un jour — jamais à
// la clôture d'une soirée, qui ne sait rien du quiz du jour —, rangés sous
// ce jour : aucune soirée ne les porte. Ils rapportent ce que rapporte tout
// palier, et la page du quiz du jour les annonce.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { ProfileStore, cleDuJour } from '../src/auth/profiles'
import { AUCUN_JOUR, carriereDe } from '../../shared/profil'
import { XP_PALIER, paliersAtteints, paliersDuJourAtteints } from '../../shared/hautsfaits'

ProfileStore.tirageEclat = () => false

/** Samedi 26 septembre 2026, 10 h à Paris. */
const DEBUT = Date.UTC(2026, 8, 26, 8, 0)
const JOUR = '2026-09-26'
const LENDEMAIN = '2026-09-27'

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

/** La base permanente, le temps d'une lecture ou d'une écriture. */
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

/** Ses paliers rangés, et sous quel nom. */
const paliersDe = (banc: Banc, login: string) =>
  base(banc, db =>
    db
      .prepare(`SELECT badge, soiree_id FROM profile_badges WHERE profile_id = ? AND badge GLOB 'hf:*:[123]' ORDER BY badge`)
      .all(idDe(banc, login)) as { badge: string; soiree_id: string }[],
  )

/** Sa ligne d'expérience des paliers. */
const xpDesPaliers = (banc: Banc, login: string) =>
  base(banc, db => {
    const r = db.prepare(`SELECT xp FROM profile_xp WHERE profile_id = ? AND soiree_id = '#paliers'`).get(idDe(banc, login)) as
      | { xp: number }
      | undefined
    return r?.xp ?? 0
  })

test('les paliers du quiz du jour ont leur moment : jamais celui d’une soirée', () => {
  const stats = { joues: 100, victoires: 5, sansFautes: 2 }
  assert.deepEqual(paliersDuJourAtteints(stats), [
    'hf:assidu:1',
    'hf:assidu:2',
    'hf:assidu:3',
    'hf:champion-du-jour:1',
    'hf:champion-du-jour:2',
    'hf:sans-faute:1',
  ])
  assert.deepEqual(paliersDuJourAtteints(AUCUN_JOUR), [])
  // La clôture d'une soirée lit une carrière qui compte le quiz du jour — pour
  // la page du profil —, mais n'en décerne rien.
  const carriere = carriereDe([], { eclats: 0, niveau: 1, jour: stats })
  assert.equal(carriere.jour.joues, 100)
  assert.deepEqual(
    paliersAtteints(carriere).filter(cle => /assidu|champion-du-jour|sans-faute/.test(cle)),
    [],
  )
})

test('un sans-faute tombe à la fin de la partie ; la nuit sacre les premiers Champions du jour, ex æquo compris', () =>
  avecBanc(async (banc, horloge) => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    const carole = await inscrireProfil(banc.url, 'carole', 'Carole', '🐼')

    // Alice et Bob font dix sur dix, au même rythme : ex æquo. Carole se
    // trompe une fois.
    const finAlice = await jouer(banc, alice, () => true)
    assert.equal(finAlice.etat, 'finie')
    assert.equal(finAlice.medaille, 'or')
    assert.deepEqual(
      finAlice.paliers.map((p: any) => [p.key, p.title]),
      [['hf:sans-faute:1', 'Le Sans-Faute · Bronze']],
      'la fin de la partie l’annonce',
    )
    await jouer(banc, bob, () => true)
    const finCarole = await jouer(banc, carole, i => i !== 3)
    assert.equal(finCarole.paliers, undefined, 'une faute : pas de sans-faute')

    // Rangé sous le jour, jamais sous une soirée ; payé comme tout palier.
    assert.deepEqual(paliersDe(banc, 'alice'), [{ badge: 'hf:sans-faute:1', soiree_id: cleDuJour(JOUR) }])
    assert.equal(xpDesPaliers(banc, 'alice'), XP_PALIER[0])
    assert.deepEqual(paliersDe(banc, 'carole'), [])

    // La page du profil suit sa progression : un jour sur les sept de L'Assidu.
    const hautsFaits = (await lire(banc, alice, '/api/joueur/moi')).corps.profile.hautsFaits as any[]
    const assidu = hautsFaits.find(h => h.key === 'hf:assidu')
    assert.equal(assidu.fois, 0)
    assert.equal(assidu.valeur, 1)
    assert.equal(assidu.prochain, 7)
    assert.equal(hautsFaits.find(h => h.key === 'hf:sans-faute').fois, 1)

    // Le lendemain, la première visite clôt la veille : Alice et Bob, premiers
    // ex æquo, sont tous deux Champions du jour ; Carole non.
    horloge.t += 24 * 3600 * 1000
    const lendemain = (await lire(banc, alice, '/api/jour')).corps
    assert.equal(lendemain.jour, LENDEMAIN)
    assert.deepEqual(
      lendemain.sonHier.paliers.map((p: any) => p.title),
      ['Le Champion du jour · Bronze'],
      'le lendemain raconte la victoire',
    )
    assert.deepEqual(
      paliersDe(banc, 'alice').map(p => p.badge),
      ['hf:champion-du-jour:1', 'hf:sans-faute:1'],
    )
    assert.deepEqual(paliersDe(banc, 'bob').map(p => p.badge), ['hf:champion-du-jour:1', 'hf:sans-faute:1'])
    assert.deepEqual(paliersDe(banc, 'carole'), [])
    assert.equal(xpDesPaliers(banc, 'alice'), 2 * XP_PALIER[0])
    assert.equal(lendemain.sonHier.paliers.length, 1, 'le sans-faute d’hier, déjà annoncé, ne revient pas')
    // Titres et vitrine : un palier du jour en ouvre un, comme les autres.
    const titre = await ecrire(banc.url, '/api/joueur/moi', { titre: 'hf:champion-du-jour' }, alice, 'PUT')
    assert.equal(titre.status, 200)
  }))

test('L’Assidu tombe à la fin de la septième partie', () =>
  avecBanc(async banc => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    // Six jours déjà joués, écrits en base : le septième se joue aujourd'hui.
    const id = idDe(banc, 'alice')
    base(banc, db => {
      const insert = db.prepare(
        `INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp)
         VALUES (?, ?, 1, 10, NULL, 0, 0, 1, 0)`,
      )
      for (let j = 20; j <= 25; j++) insert.run(id, `2026-09-${j}`)
    })
    const fin = await jouer(banc, alice, i => i !== 0)
    assert.deepEqual(
      fin.paliers.map((p: any) => p.key),
      ['hf:assidu:1'],
    )
    assert.deepEqual(paliersDe(banc, 'alice'), [{ badge: 'hf:assidu:1', soiree_id: cleDuJour(JOUR) }])
  }))
