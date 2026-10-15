// Les familles : une question de campagne part de la part que trouvent ses
// voisines — même catégorie, même difficulté estimée ; les années, les
// nombres et les vrai ou faux mis à part, toutes catégories ensemble —, et
// non plus de son estimation d'écriture seule. En production, le 15 octobre
// 2026, vingt réponses fictives contre au plus sept vrais joueurs : aucune
// moyenne n'était jamais devenue difficile, Lincoln compris (0 sur 5), alors
// que les 3 qui se répondent par une année ne se trouvaient qu'à 33 %.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import {
  DIFFICULTES_EN_FAMILLE,
  REPONSES_FICTIVES,
  TAUX_A_PRIORI,
  familleDeQuestion,
  formeDeReponse,
  mesuresEnFamille,
  niveauDeQuestion,
  tauxLisse,
  type Niveau,
} from '../../shared/campagne'
import type { Categorie } from '../../shared/categories'
import { SOUS_THEMES } from '../../shared/etiquettes'
import { BaseDeLaCampagne, lireQuestionDeLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'

// ── Les règles pures ───────────────────────────────────────────────────────

test('la forme d’une réponse : une année, un autre nombre, vrai ou faux, des mots', () => {
  assert.equal(formeDeReponse({ reponses: ['1861', '1863', '1865', '1868'], bonne: 2, valeur: { unite: '' } }), 'annee')
  assert.equal(formeDeReponse({ reponses: ['1920', '1280', '1024', '2048'], bonne: 0, valeur: { unite: 'pixels' } }), 'nombre', 'une unité : ce n’est pas une année')
  assert.equal(formeDeReponse({ reponses: ['11', '13', '15', '18'], bonne: 2, valeur: { unite: 'joueurs' } }), 'nombre')
  assert.equal(formeDeReponse({ reponses: ['800', '732', '987', '1066'], bonne: 0, valeur: null }), 'nombre', 'avant l’an mil, un nombre')
  assert.equal(formeDeReponse({ reponses: ['Vrai', 'Faux'], bonne: 1, valeur: null }), 'vrai-faux')
  assert.equal(formeDeReponse({ reponses: ['Le Sahara', 'Le Gobi', 'L’Atacama', 'Le Kalahari'], bonne: 0, valeur: null }), 'mots')
})

test('une famille : la catégorie et la difficulté, ou la forme toutes catégories ensemble — rien au-delà de la 3', () => {
  assert.deepEqual([...DIFFICULTES_EN_FAMILLE], [1, 2, 3])
  assert.equal(familleDeQuestion({ categorie: 'Sport', difficulte: 2, forme: 'mots' }), 'Sport|mots|2')
  assert.equal(familleDeQuestion({ categorie: 'Sport', difficulte: 3, forme: 'annee' }), familleDeQuestion({ categorie: 'Histoire', difficulte: 3, forme: 'annee' }))
  assert.notEqual(familleDeQuestion({ categorie: 'Histoire', difficulte: 3, forme: 'annee' }), familleDeQuestion({ categorie: 'Histoire', difficulte: 2, forme: 'annee' }))
  // Les 4 et les 5 ne sont atteintes que des forts : leur part dirait qui les a jouées.
  assert.equal(familleDeQuestion({ categorie: 'Sport', difficulte: 4, forme: 'mots' }), null)
  assert.equal(familleDeQuestion({ categorie: 'Sport', difficulte: 5, forme: 'annee' }), null)
})

test('une question part de la part de ses voisines de famille, jamais de ses propres réponses', () => {
  const q = (id: string, famille: string | null, difficulte = 3) => ({ id, difficulte, famille })
  const questions = [q('a', 'F'), q('b', 'F'), q('c', 'F'), q('jamais', 'F'), q('seule', 'G'), q('dure', null, 4)]
  const brutes = new Map([
    ['a', { justes: 0, total: 5 }],
    ['b', { justes: 1, total: 5 }],
    ['c', { justes: 1, total: 10 }],
    ['seule', { justes: 0, total: 6 }],
    ['dure', { justes: 6, total: 6 }],
  ])
  const m = mesuresEnFamille(questions, brutes)
  // Jamais jouée : toute la famille, lissée vers l'estimation d'écriture.
  assert.equal(m.get('jamais')!.depart, tauxLisse(3, 2, 20))
  assert.deepEqual([m.get('jamais')!.justes, m.get('jamais')!.total], [0, 0])
  // Jouée : ses voisines seules — ses cinq réponses ratées comptent déjà pour elle.
  assert.equal(m.get('a')!.depart, tauxLisse(3, 2, 15))
  assert.deepEqual([m.get('a')!.justes, m.get('a')!.total], [0, 5], 'ses réponses restent les siennes')
  // Seule mesurée de sa famille : ses voisines ne disent rien encore.
  assert.equal(m.get('seule')!.depart, undefined)
  // Une 4 n'a pas de famille : son estimation et ses réponses, comme avant.
  assert.equal(m.get('dure')!.depart, undefined)
  assert.equal(niveauDeQuestion(4, m.get('dure')), niveauDeQuestion(4, { justes: 6, total: 6 }))
  // Les comptes d'origine ne bougent pas.
  assert.equal(brutes.get('a')!.total, 5)
})

test('une famille se compte sur la première réponse de chacun : revue, une question a déjà montré sa correction', () => {
  const questions = [
    { id: 'revue', difficulte: 3, famille: 'F' },
    { id: 'jamais', difficulte: 3, famille: 'F' },
  ]
  // Toutes ses réponses : 4 sur 10 ; les premières de chacun : 0 sur 6 — ses quatre justes sont des redites.
  const m = mesuresEnFamille(questions, new Map([['revue', { justes: 4, total: 10 }]]), new Map([['revue', { justes: 0, total: 6 }]]))
  assert.equal(m.get('jamais')!.depart, tauxLisse(3, 0, 6))
  assert.deepEqual([m.get('revue')!.justes, m.get('revue')!.total], [4, 10], 'sa mesure à elle garde toutes ses réponses')
})

test('une question très jouée ne pèse dans sa famille que vingt réponses', () => {
  const questions = [
    { id: 'piege', difficulte: 2, famille: 'F' },
    { id: 'jamais', difficulte: 2, famille: 'F' },
  ]
  // Une question piège, ratée cent fois : elle seule ne fait pas d'une facile une experte.
  const m = mesuresEnFamille(questions, new Map([['piege', { justes: 0, total: 100 }]]))
  assert.equal(m.get('jamais')!.depart, tauxLisse(2, 0, REPONSES_FICTIVES))
  assert.equal(niveauDeQuestion(2, m.get('jamais')), 'moyen')
  // Plafonnée, elle garde sa part : 30 sur 60 pèse comme 10 sur 20.
  const moitie = mesuresEnFamille(questions, new Map([['piege', { justes: 30, total: 60 }]]))
  assert.ok(Math.abs(moitie.get('jamais')!.depart! - tauxLisse(2, 10, 20)) < 1e-12)
})

test('sans réponse dans sa famille, une question part de son estimation d’écriture', () => {
  const m = mesuresEnFamille([{ id: 'x', difficulte: 3, famille: 'F' }], new Map())
  assert.equal(m.get('x'), undefined)
  assert.deepEqual(
    [1, 2, 3, 4, 5].map(d => tauxLisse(d)),
    [1, 2, 3, 4, 5].map(d => TAUX_A_PRIORI[d]),
  )
})

// ── Sur un vrai serveur ────────────────────────────────────────────────────

/** Samedi 26 septembre 2026, 10 h à Paris. */
const DEBUT = Date.UTC(2026, 8, 26, 8, 0)

/** Une question de la base : son intitulé, sa bonne réponse et trois leurres, sa catégorie, sa difficulté. */
function question(id: string, categorie: Categorie, difficulte: number, bonne: string, leurres: readonly string[], valeur: { nombre: number; unite: string } | null = null): QuestionDeLaBase {
  const lu = lireQuestionDeLaBase({
    id,
    texte: `Quelle est la réponse attendue pour l'essai ${id} ?`,
    reponses: [bonne, ...leurres.slice(0, 3)],
    bonne: 0,
    anecdote: `L'anecdote de ${id}.`,
    categorie,
    sousTheme: SOUS_THEMES[categorie][0].cle,
    etiquettes: [],
    difficulte,
    ageMin: 10,
    date: null,
    entites: [],
    portee: 'monde',
    valeur,
    leurres: [...leurres],
    dureeDeVie: 'stable',
    explication: '',
    source: null,
    confiance: 3,
    aRelire: [],
  })
  if ('refus' in lu) throw new Error(`${id} : ${lu.refus}`)
  return lu.question
}

const annee = (id: string, categorie: Categorie, difficulte: number, n: number) =>
  question(id, categorie, difficulte, String(n), [String(n - 7), String(n + 3), String(n + 11), String(n - 2)], { nombre: n, unite: '' })
const mots = (id: string, categorie: Categorie, difficulte: number) => question(id, categorie, difficulte, `Bonne ${id}`, ['A', 'B', 'C', 'D'].map(l => `Autre ${l} ${id}`))

test('une année jamais jouée part de ses sœurs, d’une autre catégorie : ratées, elles la font difficile', async () => {
  const base = new BaseDeLaCampagne([
    // Dix faciles pour ouvrir la série.
    ...Array.from({ length: 10 }, (_, i) => mots(`facile${String(i).padStart(2, '0')}`, 'Histoire', 1)),
    // Six années d'histoire, de difficulté 3, que tout le monde rate.
    ...Array.from({ length: 6 }, (_, i) => annee(`annhis${String(i).padStart(2, '0')}`, 'Histoire', 3, 1800 + 13 * i)),
    // Une année du sport, jamais jouée : même forme, même difficulté.
    annee('annspo00', 'Sport', 3, 1966),
    // Une 3 d'histoire en mots, jamais jouée : une autre famille.
    mots('motshi00', 'Histoire', 3),
    // Une 4 qui se répond par une année : pas de famille au-delà de la 3.
    annee('annhis99', 'Histoire', 4, 1515),
  ])
  const horloge = { t: DEBUT }
  const banc: Banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: base })
  try {
    // Trente réponses ratées sur les années d'histoire, venues d'autres séries.
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    const ratee = db.prepare('INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le) VALUES (?, 0, ?, 1, 0, ?)')
    for (let i = 0; i < 6; i++) for (let k = 0; k < 5; k++) ratee.run(`ailleurs-${i}-${k}`, `annhis${String(i).padStart(2, '0')}`, DEBUT)
    db.close()
    // La mesure se relit au plus toutes les dix minutes.
    horloge.t += 11 * 60_000

    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    const serie = (await ecrire(banc.url, '/api/campagne/serie', {}, lea).then(r => r.json())) as { id: string }
    const lu = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true })
    const qs = JSON.parse((lu.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(serie.id) as { questions: string }).questions) as { id: string; niveau: Niveau }[]
    lu.close()
    const niveau = (id: string) => qs.find(q => q.id === id)?.niveau
    // Elle n'a jamais été jouée, et pas dans sa catégorie : c'est sa forme qui la dit dure.
    assert.equal(niveau('annspo00'), 'difficile', 'une année du sport, partie de ses sœurs d’histoire')
    assert.equal(niveauDeQuestion(3), 'moyen', 'son estimation seule la disait moyenne')
    // Une autre forme, une autre famille : rien ne la touche.
    assert.equal(niveau('motshi00'), 'moyen')
    // Une 4 garde son estimation, même parmi des années ratées.
    assert.equal(niveau('annhis99'), 'difficile')
  } finally {
    await banc.close()
  }
})
