// Le Sphinx, treizième légendaire : il se gagne au quiz du jour, par cent
// jours joués (L'Assidu · Or) ou par dix sans-faute (Le Sans-Faute · Or) —
// l'une des deux voies suffit. La page du quiz du jour le fête le jour où il
// s'ouvre, et une seule fois : pas quand l'autre voie l'avait déjà ouvert.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { ProfileStore, cleDuJour } from '../src/auth/profiles'
import { clePalier } from '../../shared/hautsfaits'
import { legendaire, legendairesDebloques, legendairesOuvertsPar, progresVers } from '../../shared/legendaires'

ProfileStore.tirageEclat = () => false

/** Samedi 26 septembre 2026, 10 h à Paris. */
const DEBUT = Date.UTC(2026, 8, 26, 8, 0)

/** Les paliers 1 à `n` d'un haut fait de carrière, rangés une fois chacun. */
const paliers = (hautFait: string, n: number) =>
  Array.from({ length: n }, (_, i) => [clePalier(hautFait, i + 1), 1] as [string, number])

test('le Sphinx s’ouvre par l’une ou l’autre voie, et sa jauge suit la plus avancée', () => {
  const sphinx = legendaire('lg:sphinx')!
  assert.ok(legendairesDebloques(new Map(paliers('hf:assidu', 3))).includes('lg:sphinx'), 'cent jours joués')
  assert.ok(legendairesDebloques(new Map(paliers('hf:sans-faute', 3))).includes('lg:sphinx'), 'ou dix sans-faute')
  assert.ok(
    !legendairesDebloques(new Map([...paliers('hf:assidu', 2), ...paliers('hf:sans-faute', 2)])).includes('lg:sphinx'),
    'deux Argents ne font pas un Or',
  )
  assert.deepEqual(progresVers(sphinx, new Map([...paliers('hf:assidu', 1), ...paliers('hf:sans-faute', 2)])), {
    acquis: 2,
    requis: 3,
  })
  assert.deepEqual(progresVers(sphinx, new Map(paliers('hf:assidu', 2))), { acquis: 2, requis: 3 })
  assert.deepEqual(progresVers(sphinx, new Map()), { acquis: 0, requis: 3 })

  // Ouvert par les paliers du jour : seulement s'il ne l'était pas sans eux.
  const dixSansFautes = new Map(paliers('hf:sans-faute', 3))
  assert.deepEqual(legendairesOuvertsPar(['hf:sans-faute:3'], dixSansFautes), ['lg:sphinx'])
  assert.deepEqual(
    legendairesOuvertsPar(['hf:assidu:3'], new Map([...dixSansFautes, ...paliers('hf:assidu', 3)])),
    [],
    'le centième jour ne le rouvre pas',
  )
  assert.deepEqual(legendairesOuvertsPar([], dixSansFautes), [])
})

async function avecBanc(scenario: (banc: Banc) => Promise<void>) {
  const banc = await demarrer({ horlogeDuJour: () => DEBUT })
  try {
    await scenario(banc)
  } finally {
    await banc.close()
  }
}

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

/** Quatre-vingt-dix-neuf jours déjà joués, écrits en base : le centième se joue aujourd'hui. */
function quatreVingtDixNeufJours(banc: Banc, login: string) {
  const id = idDe(banc, login)
  base(banc, db => {
    const insert = db.prepare(
      `INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp)
       VALUES (?, ?, 1, 10, NULL, 0, 0, 1, 0)`,
    )
    for (let j = 1; j <= 99; j++) insert.run(id, new Date(DEBUT - j * 24 * 3600 * 1000).toISOString().slice(0, 10))
  })
}

/** Joue toute la partie du jour, avec une faute : ni sans-faute, ni podium à chercher. */
async function jouer(banc: Banc, cookie: string) {
  let etat = (await poster(banc, cookie, '/api/jour/commencer')).corps
  while (etat.question) {
    const r = await poster(banc, cookie, '/api/jour/repondre', { jour: etat.jour, index: etat.question.index, choix: 0 })
    assert.equal(r.status, 200, r.corps.error)
    etat = (await poster(banc, cookie, '/api/jour/suivante')).corps
  }
  return etat
}

test('le centième jour l’ouvre à la fin de la partie, et il se porte ; pas une seconde fois pour qui l’avait déjà', () =>
  avecBanc(async banc => {
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob', '🐻')
    quatreVingtDixNeufJours(banc, 'alice')
    quatreVingtDixNeufJours(banc, 'bob')
    // Bob a déjà ses dix sans-faute : le Sphinx est à lui depuis longtemps.
    base(banc, db => {
      const insert = db.prepare(
        `INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, ?, ?, '', '💯', ?, 1)`,
      )
      for (const [cle] of paliers('hf:sans-faute', 3)) insert.run(idDe(banc, 'bob'), cle, cleDuJour('2026-06-01'), cle)
    })
    await banc.redemarrer()

    const fin = await jouer(banc, alice)
    assert.equal(fin.etat, 'finie')
    assert.ok(fin.paliers.some((p: any) => p.key === 'hf:assidu:3'), 'L’Assidu · Or tombe')
    // Le centième jour ouvre aussi le Renard (L'Assidu · Argent tombe avec :
    // les jours sont écrits en base) et l'Ouroboros (cent jours d'affilée).
    assert.deepEqual(fin.legendaires, ['lg:renard', 'lg:sphinx', 'lg:ouroboros'], 'la fin de la partie annonce le Sphinx')
    const porte = await ecrire(banc.url, '/api/joueur/moi', { legendaire: 'lg:sphinx' }, alice, 'PUT')
    assert.equal(porte.status, 200)
    assert.equal(((await porte.json()) as any).profile.legendaire, 'lg:sphinx')

    const finBob = await jouer(banc, bob)
    assert.ok(finBob.paliers.some((p: any) => p.key === 'hf:assidu:3'), 'son Or de L’Assidu tombe aussi')
    assert.ok(!finBob.legendaires.includes('lg:sphinx'), 'mais le Sphinx était déjà à lui')
  }))
