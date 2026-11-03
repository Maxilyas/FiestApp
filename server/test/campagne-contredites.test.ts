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
import { baseDEssai, connexionAnimateur, demarrer, ecrire, relireJusqua, type Banc } from './banc'
import { CONTREDITES_MONTREES, difficultePourLaPart, marcheContredite, type AdminDeLaCampagne, type MesureDUneQuestion } from '../../shared/campagne'
import { CATEGORIES } from '../../shared/categories'
import { lireLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { MESURES_GARDEES_MS, tableauDeLaBase } from '../src/core/campagne'

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

/** La page d'avant le 3 novembre 2026, gardée ici : une passe par catégorie, et deux de plus, à chaque ouverture. */
function tableauDAvant(jouables: readonly QuestionDeLaBase[], mesure: ReadonlyMap<string, MesureDUneQuestion>) {
  const contredites = jouables
    .flatMap(q => {
      const c = marcheContredite(q.meta.difficulte, mesure.get(q.id))
      return c ? [{ q, c, m: mesure.get(q.id)! }] : []
    })
    .sort((a, b) => b.c.force - a.c.force)
  const compte = new Map<string, number>()
  for (const q of jouables) compte.set(q.meta.categorie, (compte.get(q.meta.categorie) ?? 0) + 1)
  return {
    contredites,
    parCategorie: CATEGORIES.filter(c => compte.has(c)).map(c => ({ categorie: c, questions: compte.get(c)! })),
    parDifficulte: CATEGORIES.map(categorie => {
      const difficultes = [0, 0, 0, 0, 0]
      for (const q of jouables) if (q.meta.categorie === categorie) difficultes[q.meta.difficulte - 1]++
      return { categorie, difficultes }
    }),
  }
}

test('la page du QG compte la base d’une seule passe, comme les quatorze d’avant, sur la vraie base', () => {
  const { questions } = lireLaBase()
  // Une mesure au hasard, la même à chaque fois : des questions jamais jouées, d'autres assez pour se
  // contredire, des forces égales — l'ordre des ex æquo compte aussi.
  let graine = 7
  // Park et Miller : le produit tient dans un flottant, chaque tirage est exact.
  const hasard = () => (graine = (graine * 48271) % 2147483647) / 2147483647
  const mesure = new Map<string, MesureDUneQuestion>()
  for (const q of questions) {
    if (hasard() < 0.4) continue
    const total = Math.floor(hasard() * 12)
    mesure.set(q.id, { justes: Math.floor(hasard() * (total + 1)), total, ...(hasard() < 0.5 && { depart: 0.2 + hasard() * 0.6 }) })
  }
  const avant = tableauDAvant(questions, mesure)
  assert.ok(avant.contredites.length > 1000, `${avant.contredites.length} contredites, pour que l’épreuve dise quelque chose`)
  assert.ok(new Set(avant.contredites.map(c => c.c.force)).size < avant.contredites.length, 'des forces égales')
  assert.deepStrictEqual(tableauDeLaBase(questions, mesure), avant)
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
    // Écrites derrière le dos du serveur : la mesure gardée ne les lirait qu'à sa relecture, au plus toutes les six heures.
    horloge.t += MESURES_GARDEES_MS + 60_000
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

    // Ce que la page tire de la base se garde tant que les jouables et la mesure restent les mêmes : une
    // mesure relue le refait, les jouables inchangés — gardé sur les seules jouables, il resterait d'avant.
    const troisieme = base.questions[2]
    const ecriture = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    const encore = ecriture.prepare('INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le) VALUES (?, 0, ?, 1, 0, ?)')
    for (let i = 0; i < 6; i++) encore.run(`ailleurs-c-${i}`, troisieme.id, horloge.t)
    ecriture.close()
    horloge.t += MESURES_GARDEES_MS + 60_000
    const relue = await relireJusqua(lire, a => a.contreditesEnTout === 2)
    assert.deepEqual(new Set(relue.contredites.map(q => q.questionId)), new Set([troisieme.id, tous.id]), 'la mesure relue, la page refaite')
  } finally {
    await banc.close()
  }
})
