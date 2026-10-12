// Les réponses soufflées par leur racine (l'expert du quiz tout prêt, le 11
// octobre 2026, constat 6) : le juge refuse la réponse écrite dans
// l'intitulé, mot pour mot, mais pas sa racine — « Qui a peint *Les Deux
// Fridas* ? → Frida Kahlo », « …la reine d'Égypte ? → L'Égypte ». 1,4 % de
// la base. Pas un refus : une étymologie est souvent voulue, et une sur
// quatre environ ne souffle rien. `verifier` avertit, `racines` les liste,
// et le quiz tout prêt ne les prend qu'en dernier recours.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { lireQuestionDeLaBase, souffleeParSaRacine, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { composerUnQuiz, idDansLeQuiz, uneAutreQuestion, type DejaDansLEspace } from '../src/core/quizToutPret'
import { sujetsDeLaQuestion } from '../src/core/campagne'
import { suiteFixe } from '../../shared/hasard'
import { SOUS_THEMES } from '../../shared/etiquettes'

const r = (texte: string, reponses: string[]) => souffleeParSaRacine({ texte, reponses, bonne: 0 })

test('la racine de la bonne réponse dans l’intitulé, qu’aucun leurre ne partage ; jamais le nom que la question demande', () => {
  assert.deepEqual(r('Qui a peint « Les Deux Fridas » en 1939 ?', ['Frida Kahlo', 'Diego Rivera', 'Leonora Carrington', 'Tamara de Lempicka']), ['frida'])
  assert.deepEqual(r('Dans quel pays se déroule l’album d’Astérix qui porte le nom de la reine d’Égypte ?', ['L’Égypte', 'La Grèce', 'La Bretagne', 'L’Helvétie']), ['egypt'])
  // Une racine qu'un leurre partage ne souffle rien : toutes les réponses l'ont.
  assert.deepEqual(r('Pour quelle épouse l’empereur Shah Jahan a-t-il fait bâtir le Taj Mahal ?', ['Mumtaz Mahal', 'Nur Jahan', 'Jahanara Begum', 'Roshanara Begum']), ['mahal'])
  // Le nom demandé n'est pas un indice : « Quel studio… ? → Studio Ghibli ».
  assert.deepEqual(r('Quel studio japonais a produit « Princesse Mononoké » ?', ['Studio Ghibli', 'Toei Animation', 'Madhouse', 'Sunrise']), [])
  assert.deepEqual(r('Quel super-héros porte un costume bleu et une cape rouge ?', ['Superman', 'Batman', 'Flash', 'Aquaman']), [])
  // Les racines que deux mots sans parenté partagent : « roi de France » ne souffle pas François Ier.
  assert.deepEqual(r('Quel roi de France est fait prisonnier à la bataille de Pavie, en 1525 ?', ['François Ier', 'Louis XII', 'Henri II', 'Charles VIII']), [])
  assert.deepEqual(r('Quel lac d’Amérique du Nord couvre la plus grande superficie ?', ['Le lac Supérieur', 'Le lac Michigan', 'Le lac Huron', 'Le lac Érié']), [])
  // Un vrai ou faux ne souffle rien : ses deux réponses sont toujours les mêmes.
  assert.deepEqual(souffleeParSaRacine({ texte: 'Frida Kahlo a-t-elle peint « Les Deux Fridas » ?', reponses: ['Vrai', 'Faux'], bonne: 0 }), [])
})

/** Une question de la base : d'histoire, facile, son intitulé et ses réponses donnés. */
function question(n: number, texte: string, reponses: string[]): QuestionDeLaBase {
  const lu = lireQuestionDeLaBase({
    id: `s${String(n).padStart(7, '0')}`,
    texte,
    reponses,
    bonne: 0,
    anecdote: `L'anecdote de ${n}.`,
    categorie: 'Histoire',
    sousTheme: SOUS_THEMES.Histoire[0].cle,
    etiquettes: [],
    difficulte: 1,
    ageMin: 10,
    date: null,
    entites: [],
    portee: 'monde',
    valeur: null,
    leurres: [...reponses.slice(1), `Leurre A ${n}`, `Leurre B ${n}`, `Leurre C ${n}`],
    dureeDeVie: 'stable',
    explication: '',
    source: null,
    confiance: 3,
    aRelire: [],
  })
  if ('refus' in lu) throw new Error(`question ${n} : ${lu.refus}`)
  return lu.question
}

const soufflee = (n: number) => question(n, `Quel empereur a donné son nom à Constantinople, numéro ${n} ?`, [`Constantin ${n}`, `Auguste ${n}`, `Néron ${n}`, `Trajan ${n}`])
const sobre = (n: number) => question(n, `Quel nom se cache derrière l’énigme numéro ${n} ?`, [`Alpha ${n}`, `Bêta ${n}`, `Gamma ${n}`, `Delta ${n}`])
const rien: DejaDansLEspace = { ids: new Set(), empreintes: new Set(), posees: new Map() }

test('lue avec la question ; le quiz tout prêt ne la prend qu’en dernier recours, « Une autre » non plus', () => {
  assert.equal(soufflee(1).soufflee, true, 'Constantinople souffle Constantin')
  assert.equal(sobre(2).soufflee, false)
  // Six sobres, quatre soufflées : un quiz de six n'en prend aucune, sous toutes les graines.
  const base = [...[1, 2, 3, 4].map(n => soufflee(10 + n)), ...[1, 2, 3, 4, 5, 6].map(n => sobre(20 + n))]
  const choix = { categories: ['Histoire' as const], sujet: null, difficulte: 'facile' as const, nombre: 6, enfants: false, estimations: false }
  for (let graine = 1; graine <= 8; graine++) {
    const quiz = composerUnQuiz(base, sujetsDeLaQuestion, new Map(), choix, rien, suiteFixe(graine))
    assert.equal(quiz.length, 6)
    assert.ok(quiz.every(q => q.answers[0].startsWith('Alpha')), `graine ${graine} : que des sobres`)
  }
  // Toute la base demandée : les soufflées viennent, en dernier recours — même après une question déjà posée.
  const posee: DejaDansLEspace = { ...rien, posees: new Map([[idDansLeQuiz(sobre(21).id), Date.UTC(2026, 8, 1)]]) }
  const tout = composerUnQuiz(base, sujetsDeLaQuestion, new Map(), { ...choix, nombre: 10 }, posee, suiteFixe(3))
  assert.equal(tout.length, 10)
  assert.equal(tout.filter(q => q.answers[0].startsWith('Constantin')).length, 4)
  // « Une autre » préfère une voisine sobre, même déjà posée.
  const remplacee = sobre(30)
  for (let graine = 1; graine <= 8; graine++) {
    const autre = uneAutreQuestion([remplacee, soufflee(31), sobre(32)], sujetsDeLaQuestion, new Map(), { id: idDansLeQuiz(remplacee.id), kind: 'choice' }, [idDansLeQuiz(remplacee.id)], { ...rien, posees: new Map([[idDansLeQuiz(sobre(32).id), Date.UTC(2026, 8, 1)]]) }, suiteFixe(graine))
    assert.equal(autre?.id, idDansLeQuiz(sobre(32).id), `graine ${graine}`)
  }
})

test('`verifier` avertit, `racines` les liste — pour les relire, pas les refuser', () => {
  const script = readFileSync(new URL('../scripts/base-campagne.ts', import.meta.url), 'utf8')
  assert.match(script, /const racines = souffleeParSaRacine\(q\)\s+if \(racines\.length > 0\) avertir\(/)
  assert.match(script, /\} else if \(commande === 'racines'\) \{\s+racines\(\)/)
  assert.match(script, /lireLaBase\(\)\.questions\.filter\(q => q\.soufflee\)/)
})
