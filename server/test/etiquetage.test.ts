// Les métadonnées des questions de la réserve, et la difficulté mesurée.
//
// Une routine décrit chaque question avec la consigne d'étiquetage (essayée
// en cinq versions, le 3 octobre 2026) : sous-thème, étiquettes, difficulté
// estimée, public, leurres, d'où vérifier. Le catalogue partagé écrit ses
// listes et relit ce qu'elle rend : une clé inconnue refuse l'entrée. Et la
// consigne du quiz du jour apprend enfin ce que disent les joueurs : une IA
// qui écrit sans retour juge facile ce qu'elle sait.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { demarrer, ecrire, type Banc } from './banc'
import { consigneDEtiquetage } from '../src/core/etiquetage'
import { EXEMPLES_MESURES, ceQueDisentLesJoueurs, consigneDuJour, exemplesEtales } from '../src/core/consigne'
import { ETIQUETTES, SOUS_THEMES, lireEtiquetage } from '../../shared/etiquettes'
import { CATEGORIES } from '../../shared/categories'

/** Une entrée telle que la consigne la demande — l'exemple de Canberra. */
const CANBERRA = {
  id: 'q1',
  categorie: 'Géographie',
  sousTheme: 'capitales',
  etiquettes: ['piege'],
  difficulte: 4,
  ageMin: 10,
  date: null,
  entites: [{ nom: 'Canberra', type: 'lieu', description: 'ville d’Australie' }],
  portee: 'monde',
  valeur: null,
  leurres: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adélaïde', 'Hobart'],
  dureeDeVie: 'stable',
  explication: 'Canberra a été bâtie pour départager Sydney et Melbourne, qui se disputaient le titre.',
  source: { titre: 'Canberra', site: 'wikipedia-fr' },
  confiance: 3,
  aRelire: [],
}

// ── Le catalogue et sa consigne ────────────────────────────────────────────

test('la consigne d’étiquetage propose tout le catalogue, et rien d’autre', () => {
  const consigne = consigneDEtiquetage(50)
  assert.match(consigne, /^L'ÉTIQUETAGE DES QUESTIONS DE FIESTAPP — 50 QUESTIONS À DÉCRIRE/)
  assert.deepEqual(Object.keys(SOUS_THEMES), [...CATEGORIES], 'chaque catégorie a ses sous-thèmes')
  for (const [categorie, liste] of Object.entries(SOUS_THEMES)) {
    for (const s of liste) assert.ok(consigne.includes(`${s.cle} (${s.nom})`), `${categorie} : ${s.cle}`)
  }
  for (const f of ETIQUETTES) for (const e of f.etiquettes) assert.ok(new RegExp(`\\b${e.cle}\\b`).test(consigne), e.cle)
  assert.match(consigneDEtiquetage(12), /— 12 QUESTIONS À DÉCRIRE/)
})

test('ce que rend l’IA se relit au catalogue : une clé inconnue refuse l’entrée entière', () => {
  const lu = lireEtiquetage(CANBERRA)
  assert.ok('meta' in lu)
  assert.equal(lu.meta.sousTheme, 'capitales')
  assert.deepEqual(lu.meta.etiquettes, ['piege'])
  assert.equal(lu.meta.leurres.length, 6)

  // Un sous-thème qui n'est pas de sa catégorie, une étiquette inventée, une difficulté hors de l'échelle.
  assert.match((lireEtiquetage({ ...CANBERRA, sousTheme: 'rugby' }) as { refus: string }).refus, /hors de Géographie/)
  assert.match((lireEtiquetage({ ...CANBERRA, etiquettes: ['exotique'] }) as { refus: string }).refus, /étiquette inconnue/)
  assert.ok('refus' in lireEtiquetage({ ...CANBERRA, difficulte: 6 }))
  assert.ok('refus' in lireEtiquetage({ ...CANBERRA, etiquettes: ['piege', 'insolite', 'record', 'premiere'] }), 'quatre étiquettes')

  // Hors de la base : la question se répond sur sa photo.
  assert.deepEqual(lireEtiquetage({ id: 'q2', aRelire: ['hors-base'], raison: 'support' }), { horsBase: 'support' })

  // Les règles de prudence s'appliquent, même oubliées : l'alcool, c'est 18 ans, et à relire.
  const vin = lireEtiquetage({ ...CANBERRA, categorie: 'Cuisine', sousTheme: 'boissons', etiquettes: ['alcool'], ageMin: 10 })
  assert.ok('meta' in vin)
  assert.equal(vin.meta.ageMin, 18)
  assert.deepEqual(vin.meta.aRelire, ['sensible'])
  // Une explication trop longue se coupe sans casser un emoji.
  const long = lireEtiquetage({ ...CANBERRA, explication: 'é'.repeat(199) + '🦘🦘' })
  assert.ok('meta' in long)
  assert.equal(Array.from(long.meta.explication).length, 200, 'deux cents caractères')
  assert.ok(long.meta.explication.endsWith('🦘'), 'l’emoji gardé entier')
})

test('la consigne du quiz du jour dit ce que disent les joueurs — et alerte quand c’est trop facile', () => {
  assert.equal(ceQueDisentLesJoueurs({ facile: 3, moyen: 2, difficile: 1, expert: 0 }), null, 'six questions mesurées ne disent rien')
  const trop = ceQueDisentLesJoueurs({ facile: 30, moyen: 15, difficile: 4, expert: 1, part: 0.8 })!
  assert.match(trop, /sur les 50 dernières questions posées, mesurées sur leurs réponses : 30 faciles .* 15 moyennes, 5 difficiles/)
  assert.match(trop, /en moyenne, 80 % des joueurs trouvent la bonne réponse\. La cible : de 60 % à 75 %/)
  assert.match(trop, /C’est trop facile : écris un peu plus difficile — un peu seulement/)
  assert.doesNotMatch(trop, /plus difficile que tu ne le crois/, 'pousser fort a fait un lot à 48 % le 11 octobre 2026')
  assert.match(trop, /corrige d’un pas, jamais d’un bond/)
  const bon = ceQueDisentLesJoueurs({ facile: 25, moyen: 20, difficile: 5, expert: 0, part: 0.68 })!
  assert.match(bon, /C’est le bon niveau/)
  assert.doesNotMatch(bon, /trop facile|trop difficile/)
  // Sans la part, elle s'estime sur les niveaux.
  assert.match(ceQueDisentLesJoueurs({ facile: 50, moyen: 0, difficile: 0, expert: 0 })!, /85 % .*trop facile/)
  const consigne = consigneDuJour({ n: 40, aPrivilegier: [], deja: [], mesure: { facile: 30, moyen: 15, difficile: 4, expert: 1 } })
  assert.ok(consigne.indexOf('CE QUE DISENT LES JOUEURS') > consigne.indexOf('CE QUI FAIT UNE BONNE QUESTION'))
  assert.ok(consigne.indexOf('CE QUE DISENT LES JOUEURS') < consigne.indexOf('LE FORMAT'))
  assert.doesNotMatch(consigneDuJour({ n: 40, aPrivilegier: [], deja: [] }), /CE QUE DISENT LES JOUEURS/)
})

test('la consigne dit aussi quand c’est trop difficile, questions mesurées à l’appui', () => {
  // Fin octobre 2026 : les questions trouvées à 48 % faisaient des parties
  // de 850 points, et la consigne ne savait dire que « trop facile ».
  const questions = Array.from({ length: 20 }, (_, i) => ({ texte: `Question ${i}`, part: i / 20 }))
  const dur = ceQueDisentLesJoueurs({ facile: 4, moyen: 8, difficile: 4, expert: 4, part: 0.48, questions })!
  assert.match(dur, /48 % des joueurs/)
  assert.match(dur, /C’est trop difficile : .*Écris plus facile que tu ne le crois/)
  assert.doesNotMatch(dur, /trop facile/)
  // Une échelle de la plus dure à la plus facile, pas les vingt.
  const montrees = dur.split('\n').filter(l => l.startsWith('- Question'))
  assert.equal(montrees.length, EXEMPLES_MESURES)
  assert.equal(montrees[0], '- Question 0 — 0 %')
  assert.equal(montrees.at(-1), '- Question 19 — 95 %')
  assert.deepEqual(exemplesEtales(questions.slice(0, 3)).map(q => q.texte), ['Question 0', 'Question 1', 'Question 2'])
})

// ── Sur un vrai serveur ────────────────────────────────────────────────────

const JETON = 'jeton-de-la-reserve-pour-le-banc-1234567890'

function metadonnees(banc: Banc, id: string): unknown {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true, fileMustExist: true })
  try {
    const r = db.prepare('SELECT metadonnees FROM jour_reserve WHERE id = ?').get(id) as { metadonnees: string | null }
    return r.metadonnees ? JSON.parse(r.metadonnees) : null
  } finally {
    db.close()
  }
}

test('la routine décrit la réserve par la même porte que ses dépôts : la consigne, les questions, puis ce qu’elle rend', async () => {
  const banc: Banc = await demarrer({ jetonDeLaReserve: JETON })
  try {
    const porte = { Authorization: `Bearer ${JETON}` }
    assert.equal((await fetch(`${banc.url}/api/jour/reserve/etiquetage`)).status, 401, 'sans jeton, rien')
    const lu = (await (await fetch(`${banc.url}/api/jour/reserve/etiquetage`, { headers: porte })).json()) as {
      consigne: string
      questions: { id: string; texte: string; reponses: string[]; bonne: number }[]
    }
    assert.ok(lu.questions.length > 3, 'la réserve amorcée a des questions à décrire')
    assert.ok(lu.questions.length <= 50)
    assert.match(lu.consigne, new RegExp(`— ${lu.questions.length} QUESTIONS À DÉCRIRE`))
    const [a, b, c] = lu.questions

    const envoyer = (etiquetage: unknown) =>
      fetch(`${banc.url}/api/jour/reserve/etiquetage`, {
        method: 'POST',
        headers: { ...porte, 'Content-Type': 'application/json', 'X-Requested-With': 'quizz' },
        body: JSON.stringify({ etiquetage }),
      }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))
    const fait = await envoyer([
      { ...CANBERRA, id: a.id },
      { ...CANBERRA, id: b.id, sousTheme: 'rugby' },
      { id: c.id, aRelire: ['hors-base'], raison: 'personnes' },
      { ...CANBERRA, id: 'inconnue' },
    ])
    assert.equal(fait.status, 200)
    assert.deepEqual([fait.corps.etiquetees, fait.corps.horsBase], [1, 1])
    assert.deepEqual(
      fait.corps.refusees.map((r: { id: string }) => r.id),
      [b.id, 'inconnue'],
    )
    assert.equal((metadonnees(banc, a.id) as { sousTheme: string }).sousTheme, 'capitales')
    assert.deepEqual(metadonnees(banc, c.id), { horsBase: 'personnes' })
    assert.equal(metadonnees(banc, b.id), null, 'refusée, elle attend une autre passe')

    // La passe suivante ne redemande que ce qui manque.
    const encore = (await (await fetch(`${banc.url}/api/jour/reserve/etiquetage`, { headers: porte })).json()) as { questions: { id: string }[] }
    const ids = new Set(encore.questions.map(q => q.id))
    assert.ok(!ids.has(a.id) && !ids.has(c.id) && ids.has(b.id))
    assert.equal((await envoyer('pas un tableau')).status, 400)
  } finally {
    await banc.close()
  }
})

test('sans le jeton, l’étiquetage ne s’écrit pas', async () => {
  const banc: Banc = await demarrer({ jetonDeLaReserve: JETON })
  try {
    const res = await ecrire(banc.url, '/api/jour/reserve/etiquetage', { etiquetage: [] })
    assert.equal(res.status, 401)
  } finally {
    await banc.close()
  }
})
