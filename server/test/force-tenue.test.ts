// La force d'un joueur sur les sentiers, tenue à jour de ses seules réponses
// nouvelles (`core/forceTenue.ts`, le 8 novembre 2026) : la même, au bit près,
// que relue de toutes ses premières réponses (`forceDuJoueur`) — à chaque
// réponse, dans l'ordre ou en retard, aidée, revue ou hors de la base —, sans
// relire celles d'avant. Relue de toutes à chaque retour d'une épreuve, elle
// gelait la production 0,9 à 1,9 s (`retours/2026-11-08/`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CATEGORIES } from '../../shared/categories'
import { JournalDesReponses, type ReponseDuJournal } from '../src/core/journalDesReponses'
import { forceDuJoueur, indiceDeCategorie, type ForceDUnJoueur } from '../src/core/modeleDuSavoir'
import { ForceTenue, type LesQuestions } from '../src/core/forceTenue'

const HEURE = 3_600_000
const JOUR = 24 * HEURE
const MAINTENANT = Date.UTC(2026, 10, 8, 12, 30)
const DEPUIS = MAINTENANT - 7 * JOUR
const FORCE_DE_DEPART = -0.4
const SEUIL = 20
const C = CATEGORIES.length

/** Trois cents questions sur les douze catégories, chacune sa difficulté ; ce qui n'est pas là est hors de la base (`cab:`…). */
const BASE = new Map<string, { categorie: string; difficulte: number }>()
for (let i = 0; i < 300; i++) BASE.set(`q${i}`, { categorie: CATEGORIES[i % C], difficulte: ((i * 37) % 13) / 4 - 1.5 })
const question = (id: string) => BASE.get(id)

/** Ce que la force lit d'une question, et combien de difficultés elle a lues : une réponse de plus n'en relit pas d'autres. */
function lesQuestions(): LesQuestions & { lues: number } {
  const q = {
    lues: 0,
    categorie: (id: string) => {
      const b = BASE.get(id)
      return b ? indiceDeCategorie(b.categorie) : -1
    },
    difficulte: (id: string) => {
      q.lues++
      return BASE.get(id)!.difficulte
    },
  }
  return q
}

/** Sa force au modèle du savoir : d'où sa force part, comme à la page. */
const DU_MODELE: ForceDUnJoueur = { force: 0.35, ecarts: CATEGORIES.map((_, c) => ((c % 5) - 2) / 10), reponses: 400 }

let rowid = 0
function reponse(id: string, le: number, juste: boolean, aidee = false): ReponseDuJournal {
  rowid++
  return {
    n: rowid,
    qui: 'lea',
    serie: `serie-${Math.floor(rowid / 16)}`,
    question: id,
    juste,
    le,
    repondue: true,
    aidee,
    joker: null,
    forme: aidee ? 'vrai-faux' : null,
    mode: 'serie',
    commencee: le,
    semaine: null,
    duel: null,
    fermeLe: null,
    carnet: null,
    categorie: BASE.get(id)?.categorie ?? null,
    niveau: null,
    montre: null,
    compagnon: null,
    epreuve: null,
    choisie: null,
    composee: null,
  }
}
const lire = (journal: JournalDesReponses, reponses: ReponseDuJournal[]) => journal.appliquer({ reponses, jusqua: rowid, aSuivre: false })

/** Ce que disait la page avant : sa force relue de toutes ses premières réponses, sa semaine de même. */
function relueDeZero(journal: JournalDesReponses) {
  const premieres = journal.premieresDe('lea')
  const lui = forceDuJoueur(new Map([...premieres].map(([id, p]) => [id, p.juste])), question, FORCE_DE_DEPART, DU_MODELE)
  const avant = new Map([...premieres].filter(([, p]) => p.le < DEPUIS).map(([id, p]) => [id, p.juste]))
  const luiAvant = lui.reponses < SEUIL ? null : forceDuJoueur(avant, question, FORCE_DE_DEPART, lui)
  const anciennes = new Array<number>(C).fill(0)
  const recentes = new Array<number>(C).fill(0)
  for (const [id, p] of premieres) {
    const c = BASE.has(id) ? indiceDeCategorie(BASE.get(id)!.categorie) : -1
    if (c < 0) continue
    if (p.le < DEPUIS) anciennes[c]++
    else recentes[c]++
  }
  return { lui, luiAvant, anciennes, recentes }
}

function tenir(tenue: ForceTenue, questions: LesQuestions) {
  const lui = tenue.tenir('lea', questions, FORCE_DE_DEPART, DU_MODELE)
  tenue.saSemaine(Math.floor(MAINTENANT / HEURE), DEPUIS, FORCE_DE_DEPART, SEUIL)
  return { lui, luiAvant: tenue.luiAvant, anciennes: [...tenue.anciennes], recentes: [...tenue.recentes] }
}

test('la force tenue à jour est celle relue de toutes ses premières réponses, au bit près, à chaque lecture du journal', () => {
  let x = 11
  const hasard = () => (x = (x * 16807) % 2147483647) / 2147483647
  const journal = new JournalDesReponses(() => MAINTENANT)
  const tenue = new ForceTenue(journal)
  const questions = lesQuestions()
  // Trente jours de réponses, par lots de taille variable : une question neuve le plus souvent, une revue parfois (sa
  // première ne change pas), une première aidée (elle ne compte pas), une pièce hors de la base, et de loin en loin une
  // réponse plus ancienne lue en retard (sa première change en place : tout se relit).
  let t = MAINTENANT - 30 * JOUR
  const vues: string[] = []
  let retouches = 0
  for (let lot = 0; lot < 120; lot++) {
    const reponses: ReponseDuJournal[] = []
    const taille = 1 + Math.floor(hasard() * 25)
    for (let k = 0; k < taille; k++) {
      // Une cinquantaine de minutes au plus entre deux : un mois tout juste, de part et d'autre de sa semaine.
      t += Math.floor(hasard() * 50 * 60_000)
      const tirage = hasard()
      if (tirage < 0.15 && vues.length > 0) reponses.push(reponse(vues[Math.floor(hasard() * vues.length)], t, hasard() < 0.6))
      else if (tirage < 0.2) reponses.push(reponse(`cab:piece-${lot}-${k}`, t, hasard() < 0.5))
      else if (tirage < 0.22 && vues.length > 0) {
        reponses.push(reponse(vues[Math.floor(hasard() * vues.length)], t - 40 * JOUR, hasard() < 0.5))
        retouches++
      } else {
        const id = `q${Math.floor(hasard() * BASE.size)}`
        vues.push(id)
        reponses.push(reponse(id, t, hasard() < 0.6, hasard() < 0.05))
      }
    }
    lire(journal, reponses)
    assert.deepEqual(tenir(tenue, questions), relueDeZero(journal), `le lot ${lot}`)
  }
  assert.ok(retouches > 0 && journal.retouchesDe('lea') > 0, 'des réponses plus anciennes sont arrivées en retard')
  assert.ok(tenue.lui!.reponses > 200, `${tenue.lui!.reponses} premières réponses`)
  assert.ok(tenue.luiAvant !== null && tenue.anciennes.some(n => n > 0) && tenue.recentes.some(n => n > 0), 'sa semaine se dit')
})

test('une réponse de plus ne relit que sa question, une question revue rien, une réponse en retard tout', () => {
  const journal = new JournalDesReponses(() => MAINTENANT)
  const tenue = new ForceTenue(journal)
  const questions = lesQuestions()
  const depuis = MAINTENANT - 20 * JOUR
  lire(
    journal,
    Array.from({ length: 200 }, (_, i) => reponse(`q${i}`, depuis + i * HEURE, i % 3 !== 0)),
  )
  tenir(tenue, questions)
  assert.equal(questions.lues, 200, 'la première fois, chacune')

  // Rien de neuf : rien ne se relit, et sa force est la même.
  const avant = tenue.lui
  tenir(tenue, questions)
  assert.equal(questions.lues, 200)
  assert.equal(tenue.lui, avant)

  // Une question neuve : sa seule difficulté.
  lire(journal, [reponse('q250', MAINTENANT - HEURE, true)])
  tenir(tenue, questions)
  assert.equal(questions.lues, 201)
  assert.notEqual(tenue.lui, avant)
  assert.deepEqual(tenir(tenue, questions), relueDeZero(journal))

  // Une question revue : sa première ne change pas, ni sa force.
  const apres = tenue.lui
  lire(journal, [reponse('q5', MAINTENANT - HEURE / 2, false)])
  tenir(tenue, questions)
  assert.equal(questions.lues, 201)
  assert.equal(tenue.lui, apres)

  // Une réponse plus ancienne que la première d'une question, lue en retard : sa première change en place, tout se relit.
  lire(journal, [reponse('q7', depuis - JOUR, false)])
  tenir(tenue, questions)
  assert.equal(questions.lues, 201 + 201, 'toutes de nouveau')
  assert.deepEqual(tenir(tenue, questions), relueDeZero(journal))
})

test('sans une réponse, le joueur de la cote de départ ; une première aidée ne compte pas', () => {
  const journal = new JournalDesReponses(() => MAINTENANT)
  const tenue = new ForceTenue(journal)
  const questions = lesQuestions()
  assert.deepEqual(tenir(tenue, questions), relueDeZero(journal))
  assert.equal(tenue.lui!.reponses, 0)
  assert.equal(tenue.lui!.force, FORCE_DE_DEPART)
  // Aidée la première fois, une question ne dit rien de lui, même retrouvée ensuite.
  lire(journal, [reponse('q1', MAINTENANT - 2 * HEURE, true, true), reponse('q1', MAINTENANT - HEURE, true)])
  assert.deepEqual(tenir(tenue, questions), relueDeZero(journal))
  assert.equal(tenue.lui!.reponses, 0)
})
