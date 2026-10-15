// Ce que les réponses contredisent (`/admin#campagne`) : les questions jouées
// cinq fois au moins dont la part de bonnes réponses dit une autre marche que
// la leur, les plus nettes d'abord, et « Reclasser » qui propose la
// difficulté qu'elles disent. Le souhait du propriétaire du 15 octobre 2026 :
// « la liste des moyennes que personne ne trouve » — en production, ce
// jour-là, quatorze moyennes que moins de 30 % des joueurs trouvaient
// restaient moyennes.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { baseDEssai, connexionAnimateur, demarrer, ecrire, type Banc } from './banc'
import { CONTREDITES_MONTREES, difficultePourLaPart, marcheContredite, type AdminDeLaCampagne } from '../../shared/campagne'

// ── Les règles pures ───────────────────────────────────────────────────────

test('une question contredite : assez jouée, sa part dit une autre marche que la sienne', () => {
  assert.equal(marcheContredite(3, { justes: 0, total: 4 }), null, 'quatre réponses ne disent rien')
  assert.equal(marcheContredite(3, undefined), null)
  assert.equal(marcheContredite(3, { justes: 3, total: 6 }), null, 'une moyenne trouvée une fois sur deux est à sa place')
  const personne = marcheContredite(3, { justes: 0, total: 6 })!
  assert.deepEqual([personne.niveau, personne.niveauMesure, personne.difficulteProposee], ['moyen', 'expert', 5])
  // Une facile ratée deux fois sur trois : l'écart est plus net qu'une moyenne que personne ne trouve.
  const facile = marcheContredite(2, { justes: 2, total: 6 })!
  assert.deepEqual([facile.niveau, facile.niveauMesure, facile.difficulteProposee], ['moyen', 'difficile', 4])
  assert.ok(marcheContredite(2, { justes: 0, total: 6 })!.force > personne.force, 'le plus net d’abord')
  // Sa famille la disait déjà dure : la contredire demande davantage.
  assert.ok(marcheContredite(3, { justes: 0, total: 6, depart: 0.35 })!.force < personne.force)
})

test('la difficulté proposée est celle de la marche que disent ses réponses', () => {
  assert.deepEqual([0.95, 0.75, 0.5, 0.3, 0.05].map(difficultePourLaPart), [1, 2, 3, 4, 5])
})

// ── Sur un vrai serveur ────────────────────────────────────────────────────

/** Samedi 26 septembre 2026, 10 h à Paris. */
const DEBUT = Date.UTC(2026, 8, 26, 8, 0)

test('le QG liste ce que les réponses contredisent, et une question reclassée en sort', async () => {
  // Dix moyennes d'histoire : la même famille.
  const base = baseDEssai(10, { difficultes: [3] })
  const [personne, tous] = [base.questions[0], base.questions[1]]
  const horloge = { t: DEBUT }
  const banc: Banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: base })
  try {
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    const reponse = db.prepare('INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le) VALUES (?, 0, ?, 0, ?, ?)')
    for (let i = 0; i < 6; i++) {
      reponse.run(`ailleurs-a-${i}`, personne.id, 0, DEBUT)
      reponse.run(`ailleurs-b-${i}`, tous.id, 1, DEBUT)
    }
    db.close()
    horloge.t += 11 * 60_000
    const admin = await connexionAnimateur(banc.url)
    const lire = async () => (await (await fetch(`${banc.url}/api/admin/campagne`, { headers: { Cookie: admin } })).json()) as AdminDeLaCampagne

    const avant = await lire()
    assert.equal(avant.contreditesEnTout, 2)
    assert.ok(avant.contredites.length <= CONTREDITES_MONTREES)
    assert.deepEqual(
      avant.contredites.map(q => [q.questionId, q.niveauMesure, q.difficulteProposee]),
      [
        [personne.id, 'expert', 5],
        [tous.id, 'facile', 1],
      ],
      'la plus nette d’abord : personne ne la trouve, et sa famille la disait plutôt facile',
    )
    const [premiere] = avant.contredites
    assert.deepEqual(premiere.mesure, { justes: 0, total: 6 })
    assert.equal(premiere.niveau, 'moyen')
    assert.equal(premiere.reponses[premiere.bonne], personne.reponses[personne.bonne])

    // « Reclasser » à la difficulté proposée : elle sort de la liste, l'autre y reste.
    const r = await ecrire(
      banc.url,
      '/api/admin/campagne/reclasser',
      { questionId: personne.id, classement: { categorie: premiere.categorie, sousTheme: premiere.sousTheme, difficulte: premiere.difficulteProposee } },
      admin,
    )
    assert.equal(r.status, 200)
    const apres = await lire()
    assert.deepEqual(
      apres.contredites.map(q => q.questionId),
      [tous.id],
    )
  } finally {
    await banc.close()
  }
})
