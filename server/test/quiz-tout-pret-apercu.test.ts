// La feuille du quiz tout prêt dit ce qu'il composera vraiment (l'animatrice
// exigeante, le 11 octobre 2026, constat 9) : « Des estimations », cochées
// d'office, promettaient une question sur cinq, et dix-huit réglages sur cent
// trois en livraient moins sans rien dire — « Les records » aucune ; et le
// résumé disait « 3 catégories » sans dire lesquelles. Un aperçu du serveur —
// le même tirage, rien d'écrit — donne le nombre de questions et
// d'estimations, et le résumé le dit.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { BaseDeLaCampagne, lireQuestionDeLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { connexionAnimateur, demarrer, ecrire, type Banc } from './banc'
import { SOUS_THEMES } from '../../shared/etiquettes'
import type { ApercuDuQuiz, ChoixDuQuiz } from '../../shared/quizToutPret'

const memoire = new Map<string, string>()
Object.assign(globalThis, {
  React,
  window: { location: { pathname: '/', search: '', hash: '', origin: 'http://banc', host: 'banc' }, addEventListener: () => {} },
  document: { addEventListener: () => {}, visibilityState: 'visible', hidden: false },
  localStorage: { getItem: (k: string) => memoire.get(k) ?? null, setItem: (k: string, v: string) => memoire.set(k, v), removeItem: (k: string) => memoire.delete(k) },
})

const bancs: Banc[] = []
after(async () => {
  for (const b of bancs) await b.close()
})

/** Une question d'histoire, facile ; avec `nombre`, sa bonne réponse est ce nombre : de quoi la jouer en estimation. */
function question(i: number, nombre?: number): QuestionDeLaBase {
  const autres = [1, 2, 3, 4, 5, 6].map(d => (nombre === undefined ? `Autre ${d}-${i}` : String(nombre + d * 7)))
  const lu = lireQuestionDeLaBase({
    id: `a${String(i).padStart(7, '0')}`,
    texte: nombre === undefined ? `La question ${i}, laquelle est la bonne ?` : `En quelle année le fait numéro ${i} a-t-il eu lieu ?`,
    reponses: [nombre === undefined ? `Bonne ${i}` : String(nombre), ...autres.slice(0, 3)],
    bonne: 0,
    anecdote: `L'anecdote de ${i}.`,
    categorie: 'Histoire',
    sousTheme: SOUS_THEMES.Histoire[i % 3].cle,
    etiquettes: [],
    difficulte: 2,
    ageMin: 10,
    date: null,
    entites: [],
    portee: 'monde',
    valeur: nombre === undefined ? null : { nombre, unite: '' },
    leurres: autres,
    dureeDeVie: 'stable',
    explication: '',
    source: null,
    confiance: 3,
    aRelire: [],
  })
  if ('refus' in lu) throw new Error(`question ${i} : ${lu.refus}`)
  return lu.question
}

const choix = (c: Partial<ChoixDuQuiz> = {}): ChoixDuQuiz => ({ categories: [], sujet: null, difficulte: 'facile', nombre: 15, enfants: false, estimations: true, ...c })

test('l’aperçu compte ce que « Composer » rangera — sans rien ranger', async () => {
  // Trente QCM et une seule question à nombre : un quiz de quinze en voudrait trois.
  const base = new BaseDeLaCampagne([...Array.from({ length: 30 }, (_, i) => question(i)), question(100, 1789)])
  const banc = await demarrer({ baseDeLaCampagne: base })
  bancs.push(banc)
  const cookie = await connexionAnimateur(banc.url)
  const apercu = async (c: ChoixDuQuiz) => {
    const r = await ecrire(banc.url, '/api/quiz-tout-pret/apercu', c, cookie)
    return { status: r.status, corps: (await r.json()) as ApercuDuQuiz & { error?: string } }
  }
  assert.equal((await ecrire(banc.url, '/api/quiz-tout-pret/apercu', choix())).status, 401, 'sans session, rien')
  assert.equal((await apercu({ nombre: 3 } as ChoixDuQuiz)).status, 400)

  const lu = await apercu(choix())
  assert.equal(lu.status, 200)
  assert.deepEqual(lu.corps, { questions: 15, estimations: 1 }, 'une seule estimation : la base n’en a pas plus')
  assert.deepEqual((await apercu(choix({ estimations: false }))).corps, { questions: 15, estimations: 0 })
  assert.deepEqual((await apercu(choix({ nombre: 30 }))).corps, { questions: 30, estimations: 1 })
  // Rien de rangé : « Mes quiz » reste vide…
  const avant = (await (await fetch(`${banc.url}/api/quizzes`, { headers: { Cookie: cookie } })).json()) as unknown[]
  // … et le quiz composé a ce que l'aperçu avait dit.
  const compose = (await (await ecrire(banc.url, '/api/quiz-tout-pret', choix(), cookie)).json()) as { questions: { kind: string }[] }
  assert.equal(compose.questions.length, 15)
  assert.equal(compose.questions.filter(q => q.kind === 'number').length, 1)
  const apres = (await (await fetch(`${banc.url}/api/quizzes`, { headers: { Cookie: cookie } })).json()) as unknown[]
  assert.equal(apres.length, avant.length + 1, 'seul « Composer » range un quiz')
})

test('le résumé nomme ses catégories et dit ses estimations — « seulement », ou aucune, quand la base en a moins', async () => {
  const { resumeDuQuiz } = await import(new URL('../../client/src/components/QuizToutPret.tsx', import.meta.url).href)
  const p = choix({ difficulte: 'progressive' })
  // Avant l'aperçu, ce qu'elle disait.
  assert.equal(resumeDuQuiz(p, null), 'Toutes les catégories · progressive · ≈ 8 min')
  assert.equal(resumeDuQuiz({ ...p, categories: ['Histoire', 'Sport', 'Cuisine'] }, null), 'Histoire, Sport et Cuisine · progressive · ≈ 8 min')
  assert.equal(resumeDuQuiz({ ...p, categories: ['Histoire', 'Sport', 'Cuisine', 'Musique'] }, null), 'Histoire, Sport et 2 autres · progressive · ≈ 8 min')
  assert.equal(resumeDuQuiz({ ...p, sujet: 'records' }, null), 'Les records · progressive · ≈ 8 min')
  // L'aperçu venu : ses estimations, comptées.
  assert.equal(resumeDuQuiz(p, { questions: 15, estimations: 3 }), 'Toutes les catégories · progressive · ≈ 8 min · dont 3 estimations')
  assert.equal(resumeDuQuiz({ ...p, sujet: 'insolite' }, { questions: 15, estimations: 1 }), 'L’insolite · progressive · ≈ 7 min · 1 estimation seulement')
  assert.equal(resumeDuQuiz({ ...p, sujet: 'records' }, { questions: 15, estimations: 0 }), 'Les records · progressive · ≈ 7 min · aucune estimation ici')
  // Un choix étroit : moins de questions, dites — et la durée qui va avec.
  assert.equal(resumeDuQuiz({ ...p, categories: ['Cuisine'] }, { questions: 12, estimations: 2 }), 'Cuisine · progressive · ≈ 6 min · 12 questions seulement · dont 2 estimations')
  // Sans estimations demandées, rien à en dire.
  assert.equal(resumeDuQuiz({ ...p, estimations: false }, { questions: 15, estimations: 0 }), 'Toutes les catégories · progressive · ≈ 7 min · que des QCM')
})
