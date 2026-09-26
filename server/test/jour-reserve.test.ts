// La réserve du quiz du jour, remplie par une routine : la consigne qu'on
// donne à une IA (pure), et la porte de la routine — `/api/jour/reserve`,
// derrière `RESERVE_TOKEN` —, qui lit la consigne et dépose les questions.
// Le jeton ne sait faire que ça ; sans lui, la porte n'existe pas.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { connexionAnimateur, demarrer, inscrireProfil, type Banc } from './banc'
import { raisonDEcarter } from '../src/core/jour'
import {
  A_ECRIRE_MAX,
  CATEGORIES_DU_JOUR,
  EXEMPLE_DU_JOUR,
  JOURS_VISES,
  aEcrirePour,
  categoriesAPrivilegier,
  consigneDuJour,
} from '../src/core/consigne'
import { parseImportedQuestions } from '../../shared/library'

const JETON = 'jeton-de-la-reserve-pour-les-tests-0123456789'

/** Ce que fait la routine : son jeton en en-tête, et l'en-tête de toute écriture de l'application. */
function reserve(banc: Banc, { methode = 'GET', corps, jeton = JETON, csrf = true }: { methode?: string; corps?: unknown; jeton?: string | null; csrf?: boolean } = {}) {
  return fetch(`${banc.url}/api/jour/reserve`, {
    method: methode,
    headers: {
      ...(jeton && { Authorization: `Bearer ${jeton}` }),
      ...(corps !== undefined && { 'Content-Type': 'application/json' }),
      ...(csrf && { 'X-Requested-With': 'quizz' }),
    },
    ...(corps !== undefined && { body: JSON.stringify(corps) }),
  }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
}

const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

async function avecBanc(opts: { jetonDeLaReserve?: string }, scenario: (banc: Banc) => Promise<void>) {
  const banc = await demarrer(opts)
  try {
    await scenario(banc)
  } finally {
    await banc.close()
  }
}

test('l’exemple de la consigne se colle tel quel : deux questions que la réserve accepte', () => {
  const lu = parseImportedQuestions(EXEMPLE_DU_JOUR)
  assert.deepEqual(lu.ignores, [])
  assert.equal(lu.questions.length, 2)
  assert.deepEqual(
    lu.questions.map(q => [q.category, q.answers[q.correct], q.answers.length, !!q.anecdote]),
    [
      ['Géographie', 'Canberra', 4, true],
      ['Nature', 'Trois', 4, true],
    ],
  )
  for (const q of lu.questions) assert.equal(raisonDEcarter(q), null, q.text)
})

test('la consigne dit combien, quoi privilégier, ce qui est déjà là — et jamais la catégorie de la fête', () => {
  assert.ok(!CATEGORIES_DU_JOUR.includes('Autour de la fête' as never))
  const consigne = consigneDuJour({ n: 42, aPrivilegier: ['Sport', 'Cuisine'], deja: ['Quelle est la capitale de\nl’Australie ?'] })
  assert.match(consigne, /42 QUESTIONS À ÉCRIRE/)
  assert.match(consigne, /CATÉGORIES À PRIVILÉGIER — les moins fournies de la réserve : Sport, Cuisine\./)
  assert.match(consigne, /^- Quelle est la capitale de l’Australie \?$/m, 'un intitulé tient sur une ligne')
  assert.match(consigne, new RegExp(CATEGORIES_DU_JOUR.join(', ')))
  assert.doesNotMatch(consigne, /Autour de la fête/)
  assert.ok(consigne.includes(EXEMPLE_DU_JOUR))
  // Sans rien à rappeler, pas de rubrique vide.
  assert.doesNotMatch(consigneDuJour({ n: 10, aPrivilegier: [], deja: [] }), /DÉJÀ DANS LA RÉSERVE/)
})

test('trois semaines d’avance, cent questions au plus par passage ; les catégories les moins fournies d’abord', () => {
  assert.equal(JOURS_VISES, 21)
  assert.equal(aEcrirePour(3), A_ECRIRE_MAX, 'dix-huit jours manquent : cent, pas cent quatre-vingts')
  assert.equal(aEcrirePour(14), 70)
  assert.equal(aEcrirePour(20.9), 10)
  assert.equal(aEcrirePour(21), 0)
  assert.equal(aEcrirePour(40), 0)
  const parCategorie = Object.fromEntries(CATEGORIES_DU_JOUR.map(c => [c, 10]))
  parCategorie.Sport = 0
  parCategorie.Musique = 2
  parCategorie['Autour de la fête'] = 0
  const choisies = categoriesAPrivilegier(parCategorie)
  assert.deepEqual(choisies.slice(0, 2), ['Sport', 'Musique'])
  assert.equal(choisies.length, 4)
  assert.ok(!choisies.includes('Autour de la fête'))
})

test('sans RESERVE_TOKEN, la porte de la routine n’existe pas', () =>
  avecBanc({}, async banc => {
    assert.equal((await reserve(banc)).status, 404)
    assert.equal((await reserve(banc, { methode: 'POST', corps: { liste: 'Une ?\n* Oui\nNon' } })).status, 404)
    const admin = await connexionAnimateur(banc.url)
    assert.deepEqual((await lire(banc, admin, '/api/admin/jour')).corps.remplissage, { automatique: false })
  }))

test('la routine lit la consigne et dépose ses questions : son jeton ne sait faire que ça', () =>
  avecBanc({ jetonDeLaReserve: JETON }, async banc => {
    assert.equal((await reserve(banc, { jeton: null })).status, 401)
    assert.equal((await reserve(banc, { jeton: `${JETON}x` })).status, 401)
    const lu = await reserve(banc)
    assert.equal(lu.status, 200)
    const { joursDAvance, aEcrire, parEnvoi, consigne } = lu.corps
    assert.ok(joursDAvance >= 3, 'les quiz livrés amorcent la réserve')
    assert.equal(aEcrire, aEcrirePour(joursDAvance))
    assert.equal(parEnvoi, A_ECRIRE_MAX)
    assert.match(consigne, new RegExp(`${aEcrire} QUESTIONS À ÉCRIRE`))
    assert.match(consigne, /DÉJÀ DANS LA RÉSERVE/)

    // Sans l'en-tête de toute écriture, refusée comme n'importe quelle requête forgée.
    const liste = [
      '# Histoire',
      '',
      'En quelle année a eu lieu la prise de la Bastille ?',
      '* 1789',
      '1793',
      '1815',
      '1848',
      'Anecdote : Elle ne comptait plus que sept prisonniers ce jour-là.',
      '',
      'En quelle année a été construite la tour Eiffel ?',
      '= 1889',
      '',
      'Quelle est la capitale de l’Australie ?',
      '* Canberra',
      'Sydney',
    ].join('\n')
    assert.equal((await reserve(banc, { methode: 'POST', corps: { liste }, csrf: false })).status, 403)
    assert.equal((await reserve(banc, { methode: 'POST', corps: { liste }, jeton: 'faux' })).status, 401)
    // La porte avant le corps : sans le bon jeton, le serveur ne lit même pas le JSON.
    const illisible = await fetch(`${banc.url}/api/jour/reserve`, {
      method: 'POST',
      headers: { Authorization: 'Bearer faux', 'X-Requested-With': 'quizz', 'Content-Type': 'application/json' },
      body: '{',
    })
    assert.equal(illisible.status, 401)

    const depot = await reserve(banc, { methode: 'POST', corps: { liste } })
    assert.equal(depot.status, 200)
    assert.equal(depot.corps.ajoutees, 2)
    assert.deepEqual(depot.corps.ecartees.map((e: any) => e.raison), ['une estimation'])
    // Redéposée, elle est déjà là : une routine qui rejoue son envoi ne double rien.
    const encore = await reserve(banc, { methode: 'POST', corps: { liste } })
    assert.equal(encore.corps.ajoutees, 0)
    assert.deepEqual(encore.corps.ecartees.map((e: any) => e.raison).sort(), ['déjà dans la réserve', 'déjà dans la réserve', 'une estimation'])

    // La prochaine consigne la rappelle, et l'administration voit d'où elle vient.
    assert.match((await reserve(banc)).corps.consigne, /^- En quelle année a eu lieu la prise de la Bastille \?$/m)
    const admin = await connexionAnimateur(banc.url)
    const etat = (await lire(banc, admin, '/api/admin/jour')).corps
    assert.deepEqual(etat.remplissage, { automatique: true })
    assert.equal(etat.reserve.apports[0].source, 'ia')
    assert.equal(etat.reserve.apports[0].ajoutees, 0)
    assert.equal(etat.reserve.apports[1].ajoutees, 2)

    // Trop d'un coup : la routine coupe sa liste.
    const tropLongue = Array.from({ length: A_ECRIRE_MAX + 1 }, (_, i) => `Question numéro ${i} ?\n* Oui\nNon`).join('\n\n')
    const refus = await reserve(banc, { methode: 'POST', corps: { liste: tropLongue } })
    assert.equal(refus.status, 400)
    assert.match(refus.corps.error, /au plus par envoi/)
    assert.equal((await reserve(banc, { methode: 'POST', corps: {} })).status, 400)
  }))

test('« Copier la consigne pour une IA » : la même, trente questions, pour l’administrateur seul', () =>
  avecBanc({ jetonDeLaReserve: JETON }, async banc => {
    const joueur = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    assert.equal((await lire(banc, joueur, '/api/admin/jour/consigne')).status, 401)
    const admin = await connexionAnimateur(banc.url)
    const { status, corps } = await lire(banc, admin, '/api/admin/jour/consigne')
    assert.equal(status, 200)
    assert.match(corps.consigne, /^LE QUIZ DU JOUR DE FIESTAPP — 30 QUESTIONS À ÉCRIRE$/m)
    assert.ok(corps.consigne.includes(EXEMPLE_DU_JOUR))
  }))
