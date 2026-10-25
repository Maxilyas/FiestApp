// Un quiz tout prêt (le 11 octobre 2026) : l'animateur choisit ses
// catégories ou un sujet, la difficulté, le nombre de questions, si des
// enfants jouent — et la base de la campagne compose le quiz, rangé dans sa
// bibliothèque. Les soirées n'avaient que les onze quiz livrés.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { BaseDeLaCampagne, lireQuestionDeLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import {
  cibleDeLEstimation,
  composerUnQuiz,
  dejaDansLEspace,
  idDansLeQuiz,
  lireChoixDuQuiz,
  lireLEstimation,
  placesDesEstimations,
  planDuQuiz,
  souffleeParLEpoque,
  titreDuQuizToutPret,
  type DejaDansLEspace,
} from '../src/core/quizToutPret'
import { sujetsDeLaQuestion } from '../src/core/campagne'
import { consigneDEcriture } from '../src/core/consigneCampagne'
import { niveauDeQuestion } from '../../shared/campagne'
import { suiteFixe } from '../../shared/hasard'
import { SOUS_THEMES } from '../../shared/etiquettes'
import type { Categorie } from '../../shared/categories'
import type { ChoixDuQuiz } from '../../shared/quizToutPret'
import { attendre, connexionAnimateur, demarrer, ecranCommun, ecrire, emitAck, invite, lancerQuiz, patienter, type Banc, type Invite, type Socket } from './banc'

const bancs: Banc[] = []
after(async () => {
  for (const b of bancs) await b.close()
})

/** Une question de la base, valide, dont on règle ce que le tirage lit. */
function question(
  id: string,
  { categorie = 'Histoire', sousTheme = 0, difficulte = 1, ageMin = 10 }: { categorie?: Categorie; sousTheme?: number; difficulte?: number; ageMin?: number } = {},
): QuestionDeLaBase {
  const autres = ['A', 'B', 'C', 'D', 'E', 'F'].map(l => `Autre ${l}${id}`)
  const lu = lireQuestionDeLaBase({
    id,
    texte: `La question ${id}, laquelle est la bonne ?`,
    reponses: [`Bonne ${id}`, ...autres.slice(0, 3)],
    bonne: 0,
    anecdote: `L'anecdote de ${id}.`,
    categorie,
    sousTheme: SOUS_THEMES[categorie][sousTheme].cle,
    etiquettes: [],
    difficulte,
    ageMin,
    date: null,
    entites: [],
    portee: 'monde',
    valeur: null,
    leurres: autres,
    dureeDeVie: 'stable',
    explication: '',
    source: null,
    confiance: 3,
    aRelire: [],
  })
  if ('refus' in lu) throw new Error(`question ${id} : ${lu.refus}`)
  return lu.question
}

/**
 * Une question de la base dont la bonne réponse est un nombre — et sa
 * valeur, ce nombre, sauf à en dire une autre : de quoi la jouer en
 * estimation.
 */
function aNombre(
  id: string,
  nombre: number,
  { texte, valeur = nombre, unite = '', difficulte = 2 }: { texte?: string; valeur?: number; unite?: string; difficulte?: number } = {},
): QuestionDeLaBase {
  const ecrit = (n: number) => String(n).replace('.', ',')
  const autres = [1, 2, 3, 4, 5, 6].map(d => ecrit(Math.round((nombre + d * 7) * 100) / 100))
  const lu = lireQuestionDeLaBase({
    id,
    texte: texte ?? `En quelle année le fait numéro ${id} a-t-il eu lieu ?`,
    reponses: [ecrit(nombre), ...autres.slice(0, 3)],
    bonne: 0,
    anecdote: `L'anecdote de ${id}.`,
    categorie: 'Histoire',
    sousTheme: SOUS_THEMES.Histoire[0].cle,
    etiquettes: [],
    difficulte,
    ageMin: 10,
    date: null,
    entites: [],
    portee: 'monde',
    valeur: { nombre: valeur, unite },
    leurres: autres,
    dureeDeVie: 'stable',
    explication: '',
    source: null,
    confiance: 3,
    aRelire: [],
  })
  if ('refus' in lu) throw new Error(`question ${id} : ${lu.refus}`)
  return lu.question
}

/** Une question de la base écrite à la main : ses réponses, ses leurres, sa date. */
function ecrite(
  id: string,
  { texte, reponses, leurres, difficulte = 2, date = null }: { texte: string; reponses: string[]; leurres: string[]; difficulte?: number; date?: { valeur: string; precision: 'annee' } | null },
): QuestionDeLaBase {
  const lu = lireQuestionDeLaBase({
    id,
    texte,
    reponses,
    bonne: 0,
    anecdote: `L'anecdote de ${id}.`,
    categorie: 'Histoire',
    sousTheme: SOUS_THEMES.Histoire[0].cle,
    etiquettes: [],
    difficulte,
    ageMin: 10,
    date,
    entites: [],
    portee: 'monde',
    valeur: null,
    leurres,
    dureeDeVie: 'stable',
    explication: '',
    source: null,
    confiance: 3,
    aRelire: [],
  })
  if ('refus' in lu) throw new Error(`question ${id} : ${lu.refus}`)
  return lu.question
}

const choix = (c: Partial<ChoixDuQuiz> = {}): ChoixDuQuiz => ({
  categories: [],
  sujet: null,
  difficulte: 'progressive',
  nombre: 10,
  enfants: false,
  estimations: false,
  ...c,
})
const rien: DejaDansLEspace = { ids: new Set(), empreintes: new Set(), posees: new Map() }
const composer = (base: readonly QuestionDeLaBase[], c: ChoixDuQuiz, deja = rien, graine = 7) =>
  composerUnQuiz(base, sujetsDeLaQuestion, new Map(), c, deja, suiteFixe(graine))
const niveauDe = (base: readonly QuestionDeLaBase[]) => {
  const parId = new Map(base.map(q => [idDansLeQuiz(q.id), q]))
  return (id: string | undefined) => niveauDeQuestion(parId.get(id!)!.meta.difficulte)
}

/** Un identifiant de la base, huit caractères : `id('h', 3)` vaut `h0000003`. */
const id = (prefixe: string, i: number) => `${prefixe}${String(i).padStart(8 - prefixe.length, '0')}`

test('le plan monte de marche en marche, et compte toujours ce qu’on a demandé', () => {
  assert.deepEqual(planDuQuiz('facile', 15), [{ niveau: 'facile', n: 15 }])
  assert.deepEqual(planDuQuiz('progressive', 15), [
    { niveau: 'facile', n: 6 },
    { niveau: 'moyen', n: 6 },
    { niveau: 'difficile', n: 3 },
  ])
  assert.deepEqual(planDuQuiz('corsee', 15), [
    { niveau: 'moyen', n: 3 },
    { niveau: 'difficile', n: 9 },
    { niveau: 'expert', n: 3 },
  ])
  for (const difficulte of ['facile', 'progressive', 'corsee'] as const) {
    for (let n = 5; n <= 50; n++) {
      const plan = planDuQuiz(difficulte, n)
      assert.equal(
        plan.reduce((s, m) => s + m.n, 0),
        n,
        `${difficulte}, ${n} questions`,
      )
      if (difficulte !== 'corsee') assert.ok(plan.every(m => m.niveau !== 'expert'), 'une experte seulement dans un quiz corsé')
    }
  }
})

test('le choix d’un navigateur se lit, ou se refuse en entier', () => {
  assert.deepEqual(lireChoixDuQuiz({}), choix({ nombre: 15 }), 'ce qui manque prend sa valeur par défaut')
  assert.deepEqual(lireChoixDuQuiz({ categories: ['Sport', 'Histoire', 'Sport'], nombre: 20, enfants: true })?.categories, ['Histoire', 'Sport'], 'dans l’ordre de la liste, sans doublon')
  assert.equal(lireChoixDuQuiz({ sujet: 'animaux' })?.sujet, 'animaux')
  assert.equal(lireChoixDuQuiz({ estimations: true })?.estimations, true)
  for (const brut of [
    null,
    [],
    'Histoire',
    { categories: ['Astrologie'] },
    { categories: 'Histoire' },
    { sujet: 'inconnu' },
    { difficulte: 'extreme' },
    { nombre: 4 },
    { nombre: 51 },
    { nombre: 12.5 },
    { nombre: '15' },
    { enfants: 'oui' },
    { estimations: 1 },
  ]) {
    assert.equal(lireChoixDuQuiz(brut), null, JSON.stringify(brut))
  }
})

test('un quiz progressif : les faciles, puis les moyennes, puis les difficiles — les catégories à tour de rôle', () => {
  const categories: Categorie[] = ['Histoire', 'Sport', 'Cuisine']
  const base = categories.flatMap((categorie, c) => Array.from({ length: 30 }, (_, i) => question(id(`c${c}`, i), { categorie, sousTheme: i % 3, difficulte: 1 + (i % 5) })))
  const quiz = composer(base, choix({ nombre: 10 }))
  const niveau = niveauDe(base)
  assert.deepEqual(
    quiz.map(q => niveau(q.id)),
    ['facile', 'facile', 'facile', 'facile', 'moyen', 'moyen', 'moyen', 'moyen', 'difficile', 'difficile'],
  )
  assert.equal(new Set(quiz.map(q => q.id)).size, 10, 'jamais une question deux fois')
  // Trois catégories : chacune trois ou quatre fois, et les trois premières toutes différentes.
  const parCategorie = new Map<string, number>()
  for (const q of quiz) parCategorie.set(q.category!, (parCategorie.get(q.category!) ?? 0) + 1)
  assert.deepEqual([...parCategorie.values()].sort(), [3, 3, 4])
  assert.equal(new Set(quiz.slice(0, 3).map(q => q.category)).size, 3)

  // Telle que le quiz la garde : un QCM ordinaire, la bonne réponse suivie, sa catégorie, son anecdote.
  const [premiere] = quiz
  const source = base.find(q => idDansLeQuiz(q.id) === premiere.id)!
  assert.deepEqual(premiere, {
    id: idDansLeQuiz(source.id),
    kind: 'choice',
    text: source.texte,
    answers: source.reponses,
    correct: source.bonne,
    target: null,
    unit: '',
    duration: 20,
    image: null,
    observeSeconds: null,
    category: source.meta.categorie,
    anecdote: source.anecdote,
  })
})

test('les catégories choisies, un sujet, des enfants : le tirage ne prend que ce qu’on demande', () => {
  const base = [
    ...Array.from({ length: 20 }, (_, i) => question(id('h', i), { categorie: 'Histoire', difficulte: 1 + (i % 4) })),
    // Une sur deux pour les plus de quatorze ans ; les autres, de chaque marche.
    ...Array.from({ length: 40 }, (_, i) => question(id('n', i), { categorie: 'Nature', sousTheme: 0, difficulte: 1 + (Math.floor(i / 2) % 4), ageMin: i % 2 ? 14 : 10 })),
    ...Array.from({ length: 20 }, (_, i) => question(id('s', i), { categorie: 'Sport', difficulte: 1 + (i % 4) })),
  ]
  assert.ok(composer(base, choix({ categories: ['Histoire', 'Sport'] })).every(q => q.category === 'Histoire' || q.category === 'Sport'))
  // Les animaux : la Nature, ses mammifères — pas l'histoire.
  assert.ok(composer(base, choix({ sujet: 'animaux' })).every(q => q.category === 'Nature'))
  // Des enfants : rien qu'un enfant de dix ans ne puisse connaître.
  const pourEnfants = composer(base, choix({ categories: ['Nature'], enfants: true }))
  const ageDe = new Map(base.map(q => [idDansLeQuiz(q.id), q.meta.ageMin]))
  assert.equal(pourEnfants.length, 10)
  assert.ok(pourEnfants.every(q => ageDe.get(q.id!)! <= 10))
})

test('rien de la bibliothèque ne revient ; ce que les soirées ont posé passe en dernier, le plus ancien d’abord', () => {
  const base = Array.from({ length: 12 }, (_, i) => question(id('f', i), { difficulte: 1 }))
  const dejaLa = base[0]
  const dupliquee = base[1]
  // Six posées en soirée, à des dates différentes : il en reste quatre jamais posées.
  const posees = new Map(base.slice(2, 8).map((q, i) => [idDansLeQuiz(q.id), 1000 + i]))
  const deja = dejaDansLEspace(
    [
      { questions: [{ id: idDansLeQuiz(dejaLa.id), kind: 'choice', text: dejaLa.texte, answers: [], correct: 0, target: null, unit: '', duration: 20, image: null, observeSeconds: null }] },
      // Un quiz dupliqué : un autre identifiant, le même intitulé — à la casse près.
      { questions: [{ id: 'copie-1', kind: 'choice', text: dupliquee.texte.toUpperCase(), answers: [], correct: 0, target: null, unit: '', duration: 20, image: null, observeSeconds: null }] },
    ],
    posees,
  )
  const quiz = composer(base, choix({ difficulte: 'facile', nombre: 6 }), deja)
  const ids = quiz.map(q => q.id)
  assert.ok(!ids.includes(idDansLeQuiz(dejaLa.id)) && !ids.includes(idDansLeQuiz(dupliquee.id)), 'ni la question de la bibliothèque, ni sa copie')
  const jamais = base.slice(8).map(q => idDansLeQuiz(q.id))
  assert.deepEqual([...ids].filter(i => jamais.includes(i!)).sort(), [...jamais].sort(), 'les quatre jamais posées')
  assert.deepEqual(
    ids.filter(i => posees.has(i!)).sort(),
    base.slice(2, 4).map(q => idDansLeQuiz(q.id)).sort(),
    'puis les deux posées il y a le plus longtemps',
  )
})

test('une marche qui manque emprunte à sa voisine, et un choix trop étroit rend ce qu’il a', () => {
  // Pas une facile : la marche facile prend des moyennes plutôt que rien.
  const base = Array.from({ length: 20 }, (_, i) => question(id('m', i), { difficulte: 3 + (i % 2) }))
  const quiz = composer(base, choix({ nombre: 10 }))
  assert.equal(quiz.length, 10)
  const niveau = niveauDe(base)
  assert.deepEqual(quiz.slice(0, 4).map(q => niveau(q.id)), ['moyen', 'moyen', 'moyen', 'moyen'])
  // Trois questions de sport en tout : trois, pas une de plus ni une d'ailleurs.
  const etroite = [...base, ...Array.from({ length: 3 }, (_, i) => question(id('s', i), { categorie: 'Sport', difficulte: 2 }))]
  assert.equal(composer(etroite, choix({ categories: ['Sport'], nombre: 10 })).length, 3)
})

test('une estimation vise le nombre de sa bonne réponse — plus de dix, et un intitulé qui se lit sans les choix', () => {
  assert.deepEqual(cibleDeLEstimation(aNombre('e0000001', 1955)), { target: 1955, unit: '' })
  assert.deepEqual(cibleDeLEstimation(aNombre('e0000002', 1.21, { unite: 'gigawatt', texte: 'Quelle puissance faut-il à la DeLorean pour voyager dans le temps ?' })), {
    target: 1.21,
    unit: 'gigawatt',
  })
  // Une unité trop longue pour l'écran s'efface : l'intitulé la dit déjà.
  assert.deepEqual(cibleDeLEstimation(aNombre('e0000003', 24, { unite: 'images par seconde', texte: 'Combien d’images par seconde défilent dans un film ?', difficulte: 3 })), {
    target: 24,
    unit: '',
  })
  assert.equal(cibleDeLEstimation(aNombre('e0000004', 6, { texte: 'Combien de cordes compte une guitare classique ?' })), null, 'six se devine, ne s’estime pas')
  assert.equal(cibleDeLEstimation(aNombre('e0000005', 1955, { valeur: 1985 })), null, 'une valeur qui n’est pas la bonne réponse')
  assert.equal(cibleDeLEstimation(aNombre('e0000006', 1955, { texte: 'Parmi ces années, laquelle a vu naître le rock ?' })), null, 'un intitulé qui suppose des choix')
  assert.equal(cibleDeLEstimation(question('e0000007')), null, 'pas de valeur')
  assert.deepEqual(placesDesEstimations(15, 3), [3, 7, 10])
})

// Douze estimations sur dix-neuf posaient un problème dans les quiz composés
// par l'expert du quiz tout prêt (le 11 octobre 2026), contre une question
// sur huit des QCM.
test('ni un numéro, ni un petit entier que tout le monde sait, ni une unité que l’intitulé tait', () => {
  // Un numéro : 814 n'est pas « presque » le vol 815.
  assert.equal(cibleDeLEstimation(aNombre('e0000011', 815, { texte: 'Quel numéro de vol porte l’avion qui s’écrase dans « Lost » ?', difficulte: 4 })), null)
  assert.equal(cibleDeLEstimation(aNombre('e0000012', 33, { texte: 'Quel est l’indicatif téléphonique de la France ?', difficulte: 3 })), null)
  // Au milieu de l'intitulé aussi : le maillot de l'arrière n'est pas « presque » le 14.
  assert.equal(cibleDeLEstimation(aNombre('e0000019', 15, { texte: 'Au rugby, quel numéro de maillot porte l’arrière ?', difficulte: 3 })), null)
  // Compter des chiffres n'est pas un numéro.
  assert.deepEqual(cibleDeLEstimation(aNombre('e0000013', 15, { texte: 'Combien de chiffres compte un numéro de Sécurité sociale ?', unite: 'chiffres', difficulte: 4 })), {
    target: 15,
    unit: 'chiffres',
  })
  // Une facile qui tient en un petit entier : toute la salle tape le même nombre.
  assert.equal(cibleDeLEstimation(aNombre('e0000014', 42, { texte: 'Combien font 6 × 7 ?', difficulte: 1 })), null)
  assert.equal(cibleDeLEstimation(aNombre('e0000015', 26, { texte: 'Combien de lettres compte l’alphabet français ?', unite: 'lettres', difficulte: 2 })), null)
  // Moins sue, elle s'estime ; facile mais au-delà de cent, aussi.
  assert.deepEqual(cibleDeLEstimation(aNombre('e0000016', 88, { texte: 'Combien de touches compte un piano ?', unite: 'touches', difficulte: 3 })), { target: 88, unit: 'touches' })
  assert.deepEqual(cibleDeLEstimation(aNombre('e0000017', 1789, { difficulte: 1 })), { target: 1789, unit: '' })
  // « Millions d'années » ne tient pas à l'écran, et l'intitulé ne le dit pas : 66 seul trompait la salle.
  assert.equal(cibleDeLEstimation(aNombre('e0000018', 66, { unite: 'millions d’années', texte: 'Il y a combien de temps les dinosaures non aviens ont-ils disparu ?', difficulte: 3 })), null)
})

// La base n'avait que vingt-sept estimations faciles : un quiz facile d'une
// catégorie n'en avait plus aucune. Une part à nombre se commande
// (`consigne --nombres`), et `verifier --nombres` dit au rédacteur pourquoi
// une question ne se jouerait pas au plus près — la règle même du tirage.
test('une part à nombre : la consigne dit les règles de l’estimation, et le vérificateur pourquoi une question n’en est pas une', () => {
  const part = consigneDEcriture('Géographie', [{ cle: 'reliefs', n: 10 }], { sorte: 'lots', lot: 'nb', dossier: '/tmp' }, [], { nombres: true })
  assert.match(part, /TA PART SE JOUE AUSSI AU PLUS PRÈS/)
  assert.match(part, /Jamais un numéro/)
  assert.match(part, /verifier --nombres/)
  assert.doesNotMatch(part, /environ 10 % de 1, 25 % de 2/, 'sa difficulté à elle, pas la répartition d’un lot ordinaire')
  assert.doesNotMatch(consigneDEcriture('Géographie', [{ cle: 'reliefs', n: 10 }], { sorte: 'lots', lot: 'nb', dossier: '/tmp' }), /AU PLUS PRÈS/)
  assert.deepEqual(lireLEstimation(aNombre('e0000021', 4810, { texte: 'Quelle est l’altitude du mont Blanc, en mètres ?', unite: 'm', difficulte: 2 })), { cible: { target: 4810, unit: 'm' } })
  assert.deepEqual(lireLEstimation(aNombre('e0000022', 42, { texte: 'Combien font 6 × 7 ?', difficulte: 1 })), { refus: 'un petit entier à la difficulté 1 : tout le monde le sait, la salle finirait ex æquo' })
  assert.deepEqual(lireLEstimation(aNombre('e0000023', 815, { texte: 'Quel numéro de vol porte l’avion de « Lost » ?', difficulte: 4 })), { refus: 'un numéro ne s’estime pas' })
  assert.deepEqual(lireLEstimation(question('e0000024')), { refus: 'pas de valeur : la bonne réponse n’est pas un nombre' })
  assert.deepEqual(placesDesEstimations(10, 2), [2, 6])
})

test('des estimations : une question sur cinq, réparties, jamais la première ; rien sans les demander', () => {
  const base = [
    ...Array.from({ length: 30 }, (_, i) => question(id('q', i), { difficulte: 1 + (i % 3) })),
    ...Array.from({ length: 6 }, (_, i) => aNombre(id('n', i), 1900 + i * 10)),
  ]
  const avec = composer(base, choix({ nombre: 10, estimations: true }))
  assert.equal(avec.length, 10)
  assert.deepEqual(
    avec.map((q, i) => (q.kind === 'number' ? i : -1)).filter(i => i >= 0),
    [2, 6],
  )
  const estimation = avec[2]
  const source = base.find(q => idDansLeQuiz(q.id) === estimation.id)!
  assert.deepEqual(
    { kind: estimation.kind, target: estimation.target, unit: estimation.unit, duration: estimation.duration, answers: estimation.answers },
    { kind: 'number', target: source.meta.valeur!.nombre, unit: '', duration: 30, answers: [] },
  )
  assert.ok(composer(base, choix({ nombre: 10 })).every(q => q.kind === 'choice'), 'sans les demander, que des QCM')
  // Une seule question à nombre : une estimation, et neuf QCM.
  const une = composer([...base.slice(0, 30), base[30]], choix({ nombre: 10, estimations: true }))
  assert.deepEqual([une.length, une.filter(q => q.kind === 'number').length], [10, 1])
})

test('une estimation experte ne vient que dans un quiz corsé', () => {
  const base = [
    ...Array.from({ length: 40 }, (_, i) => question(id('q', i), { difficulte: 1 + (i % 5) })),
    ...Array.from({ length: 6 }, (_, i) => aNombre(id('x', i), 1500 + i * 10, { difficulte: 5 })),
  ]
  assert.ok(composer(base, choix({ difficulte: 'facile', estimations: true })).every(q => q.kind === 'choice'))
  assert.ok(composer(base, choix({ difficulte: 'progressive', estimations: true })).every(q => q.kind === 'choice'))
  assert.equal(composer(base, choix({ difficulte: 'corsee', estimations: true })).filter(q => q.kind === 'number').length, 2)
})

// Tirées au hasard des marches permises, puis placées à intervalles : un
// quiz corsé recevait « Combien font 6 × 7 ? », un quiz facile la guerre
// des Six Jours, et la quatrième question des « faciles d'abord » était une
// estimation difficile une fois sur trois (l'expert du quiz tout prêt, le
// 11 octobre 2026).
test('les estimations montent avec le quiz, sans sortir de ses marches', () => {
  const base = [
    ...Array.from({ length: 80 }, (_, i) => question(id('q', i), { difficulte: 1 + (i % 5) })),
    ...[1, 3, 4, 5].flatMap(d => Array.from({ length: 6 }, (_, i) => aNombre(id(`e${d}`, i), 1500 + d * 100 + i * 7, { difficulte: d }))),
  ]
  const niveau = niveauDe(base)
  const estimations = (b: readonly QuestionDeLaBase[], difficulte: ChoixDuQuiz['difficulte'], graine = 7) =>
    composer(b, choix({ difficulte, nombre: 15, estimations: true }), rien, graine)
      .filter(q => q.kind === 'number')
      .map(q => niveau(q.id))
  for (let graine = 1; graine <= 20; graine++) {
    assert.deepEqual(estimations(base, 'facile', graine), ['facile', 'facile', 'facile'], 'un quiz facile : que des faciles')
    assert.deepEqual(estimations(base, 'progressive', graine), ['facile', 'moyen', 'difficile'], 'la première dans les faciles d’abord')
    assert.deepEqual(estimations(base, 'corsee', graine), ['moyen', 'difficile', 'expert'], 'jamais une facile dans un quiz corsé')
  }
  // Sans estimation facile : le quiz progressif emprunte à la marche voisine, le quiz facile s'en passe.
  const sansFacile = base.filter(q => !q.id.startsWith('e1'))
  assert.deepEqual(estimations(sansFacile, 'progressive'), ['moyen', 'moyen', 'difficile'])
  assert.deepEqual(estimations(sansFacile, 'facile'), [])
})

test('des enfants jouent : ce qu’un enfant connaît d’abord, même déjà posé ; le reste de dix ans pour compléter', () => {
  const base = [
    // Six ans : ce qu'un enfant connaît avant de bien lire.
    ...Array.from({ length: 6 }, (_, i) => question(id('p', i), { difficulte: 1 + (i % 2), ageMin: 6 })),
    // Dix ans, et facile entre les faciles.
    ...Array.from({ length: 4 }, (_, i) => question(id('f', i), { difficulte: 1, ageMin: 10 })),
    // Dix ans : compréhensible, pas forcément connu — Tati, Nougaro, Tarantino.
    ...Array.from({ length: 20 }, (_, i) => question(id('d', i), { difficulte: 2, ageMin: 10 })),
    ...Array.from({ length: 10 }, (_, i) => question(id('a', i), { difficulte: 1, ageMin: 14 })),
  ]
  const famille = (q: { id?: string }) => q.id!.slice('base-'.length)[0]
  const compter = (quiz: readonly { id?: string }[]) => {
    const n: Record<string, number> = {}
    for (const q of quiz) n[famille(q)] = (n[famille(q)] ?? 0) + 1
    return n
  }
  assert.deepEqual(compter(composer(base, choix({ difficulte: 'facile', nombre: 15, enfants: true }))), { p: 6, f: 4, d: 5 })
  // Déjà posées en soirée, elles passent encore devant : un enfant les connaît.
  const posees = new Map(base.slice(0, 3).map((q, i) => [idDansLeQuiz(q.id), 1000 + i]))
  assert.deepEqual(compter(composer(base, choix({ difficulte: 'facile', nombre: 15, enfants: true }), { ...rien, posees })), { p: 6, f: 4, d: 5 })
})

test('un quiz d’époque écarte le QCM dont l’époque souffle l’année ; pas de vrai ou faux pour finir un quiz corsé', () => {
  const annee = (valeur: number) => ({ valeur: String(valeur), precision: 'annee' as const })
  // La création du GIEC parmi 1988, 1972, 1992 et 1997 : seule la bonne est des années 80.
  const giec = ecrite('g0000001', {
    texte: 'En quelle année le GIEC a-t-il été créé ?',
    reponses: ['1988', '1972', '1992', '1997'],
    leurres: ['1972', '1992', '1997', '1965', '2001', '1979'],
    date: annee(1988),
  })
  // Des années 80 parmi des années 80 : l'époque ne dit rien.
  const autres = Array.from({ length: 4 }, (_, i) =>
    ecrite(id('z', i), {
      texte: `En quelle année l’événement ${i} des années 80 a-t-il eu lieu ?`,
      reponses: [String(1981 + i), String(1985 + i), '1980', '1989'],
      leurres: [String(1985 + i), '1980', '1989', '1986', '1987', '1988'].filter((l, k, t) => t.indexOf(l) === k && l !== String(1981 + i)),
      date: annee(1981 + i),
    }),
  )
  assert.equal(souffleeParLEpoque(giec, [1980, 1989]), true)
  assert.ok(autres.every(q => !souffleeParLEpoque(q, [1980, 1989])))
  const base = [giec, ...autres]
  const ids = (quiz: readonly { id?: string }[]) => quiz.map(q => q.id).sort()
  assert.deepEqual(ids(composer(base, choix({ sujet: 'annees-80', difficulte: 'facile', nombre: 5 }))), ids(autres.map(q => ({ id: idDansLeQuiz(q.id) }))))
  // Hors de l'époque, son titre ne dit rien : elle se pose.
  assert.ok(ids(composer(base, choix({ categories: ['Histoire'], difficulte: 'facile', nombre: 5 }))).includes(idDansLeQuiz(giec.id)))

  // Un vrai ou faux expert : une chance sur deux pour clore un quiz corsé.
  const corsee = [
    ...Array.from({ length: 40 }, (_, i) => question(id('c', i), { difficulte: 3 + (i % 2) })),
    ...Array.from({ length: 3 }, (_, i) => question(id('x', i), { difficulte: 5 })),
    ...Array.from({ length: 3 }, (_, i) =>
      ecrite(id('v', i), { texte: `Vrai ou faux : le fait expert numéro ${i} est avéré.`, reponses: ['Vrai', 'Faux'], leurres: ['Faux'], difficulte: 5 }),
    ),
  ]
  const quiz = composer(corsee, choix({ difficulte: 'corsee', nombre: 15 }))
  assert.equal(quiz.filter(q => q.answers.length === 2).length, 0)
  assert.equal(quiz.length, 15, 'les marches voisines complètent')
})

test('le titre dit ce qu’on a choisi, et tient sur une ligne', () => {
  assert.equal(titreDuQuizToutPret(choix(), 15), 'Un peu de tout · 15 questions')
  assert.equal(titreDuQuizToutPret(choix({ categories: ['Histoire'], difficulte: 'facile' }), 10), 'Histoire · 10 questions faciles')
  assert.equal(titreDuQuizToutPret(choix({ categories: ['Histoire', 'Sport'], difficulte: 'corsee' }), 20), 'Histoire et Sport · 20 questions corsées')
  assert.equal(titreDuQuizToutPret(choix({ categories: ['Histoire', 'Géographie', 'Sciences', 'Sport'] }), 30), 'Histoire, Géographie et 2 autres · 30 questions')
  assert.equal(titreDuQuizToutPret(choix({ sujet: 'animaux' }), 10), 'Les animaux · 10 questions')
  // Des enfants jouent : on retrouve le quiz composé pour eux.
  assert.equal(titreDuQuizToutPret(choix({ difficulte: 'facile', enfants: true }), 15), 'Un peu de tout · 15 questions faciles · en famille')
})

// ── Sur un vrai serveur ─────────────────────────────────────────────────────

const vue = (host: Socket, pred: (v: any) => boolean, label: string) =>
  attendre<any>(host, 'session:view', p => pred(p.view), label, 15_000).then(p => p.view)

/** Joue une partie jusqu'au podium : Alice trouve, Bob se trompe. */
async function jouer(host: Socket, alice: Invite, bob: Invite, sessionId: string, n: number) {
  let v = await vue(host, x => x.phase === 'question' && x.qIndex === 0, 'question 1')
  for (let i = 0; i < n; i++) {
    const revelation = vue(host, x => x.phase === 'reveal' && x.qIndex === i, `révélation ${i + 1}`)
    for (const [joueur, choisi] of [
      [alice, 0],
      [bob, 1],
    ] as const) {
      const ack = await emitAck<any>(joueur.socket, 'player:action', { sessionId, action: { type: 'answer', choice: choisi, qIndex: i, round: v.round } })
      assert.equal(ack.ok, true)
    }
    const r = await revelation
    const suite = vue(host, x => (i + 1 < n ? x.phase === 'question' && x.qIndex === i + 1 : x.phase === 'finished'), 'la suite')
    ;(host as any).emit('host:command', { sessionId, command: { type: 'next', phase: 'reveal', qIndex: i, round: r.round } })
    v = await suite
  }
}

test('composé, le quiz rejoint « Mes quiz » ; joué puis supprimé, ses questions ne reviennent pas avant les autres', async () => {
  // Vingt questions d'histoire faciles : de quoi composer quatre quiz de cinq.
  const base = new BaseDeLaCampagne(Array.from({ length: 20 }, (_, i) => question(id('b', i), { sousTheme: i % 4, difficulte: 1 + (i % 2) })))
  const banc = await demarrer({ baseDeLaCampagne: base })
  bancs.push(banc)
  const cookie = await connexionAnimateur(banc.url)
  const lire = async (chemin: string) => {
    const r = await fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } })
    return { status: r.status, corps: (await r.json()) as any }
  }

  // Sans session, rien ; puis ce que la base offre.
  assert.equal((await fetch(`${banc.url}/api/quiz-tout-pret`)).status, 401)
  const offre = await lire('/api/quiz-tout-pret')
  assert.equal(offre.corps.total, 20)
  assert.deepEqual(offre.corps.categories, ['Histoire'])
  // Un choix qui ne se lit pas, et un choix sans assez de questions.
  assert.equal((await ecrire(banc.url, '/api/quiz-tout-pret', { nombre: 3 }, cookie)).status, 400)
  const vide = await ecrire(banc.url, '/api/quiz-tout-pret', { categories: ['Sport'] }, cookie)
  assert.equal(vide.status, 400)
  assert.match(((await vide.json()) as { error: string }).error, /pas assez de questions/)

  const compose = await ecrire(banc.url, '/api/quiz-tout-pret', { categories: ['Histoire'], difficulte: 'facile', nombre: 5 }, cookie)
  assert.equal(compose.status, 201)
  const quiz = (await compose.json()) as any
  assert.equal(quiz.title, 'Histoire · 5 questions faciles')
  assert.equal(quiz.questions.length, 5)
  assert.deepEqual(quiz.reglages, { melangerReponses: true }, 'ses réponses se mélangent à chaque partie')
  assert.ok(quiz.questions.every((q: any) => q.id.startsWith('base-') && q.category === 'Histoire' && q.anecdote))
  const liste = await lire('/api/quizzes')
  assert.equal(liste.corps.find((q: any) => q.id === quiz.id)?.readyCount, 5, 'prêt à jouer, dans « Mes quiz »')

  // Composé de nouveau : un autre titre, et rien du premier.
  const second = (await (await ecrire(banc.url, '/api/quiz-tout-pret', { categories: ['Histoire'], difficulte: 'facile', nombre: 5 }, cookie)).json()) as any
  assert.equal(second.title, 'Histoire · 5 questions faciles (2)')
  const premieres = new Set<string>(quiz.questions.map((q: any) => q.id))
  assert.ok(second.questions.every((q: any) => !premieres.has(q.id)))

  // Le premier se joue, puis l'animateur le supprime, et le second aussi.
  const alice = await invite(banc.url, 'Alice')
  const bob = await invite(banc.url, 'Bob', '🐻')
  const host = await ecranCommun(banc.url, cookie)
  const partie = await lancerQuiz(host, quiz.id)
  await jouer(host, alice, bob, partie, 5)
  ;(host as any).emit('host:endSession', { sessionId: partie })
  for (let essai = 0; essai < 60 && !(await lire('/api/quizzes')).corps.find((q: any) => q.id === quiz.id)?.joue; essai++) await patienter(150)
  assert.ok((await lire('/api/quizzes')).corps.find((q: any) => q.id === quiz.id)?.joue, 'la soirée a rangé la partie')
  for (const q of [quiz, second]) assert.equal((await ecrire(banc.url, `/api/quizzes/${q.id}`, {}, cookie, 'DELETE')).status, 200)

  // Quinze questions demandées : les quinze jamais posées d'abord — dont les cinq du second, supprimé sans être joué —, puis rien de joué.
  const troisieme = (await (await ecrire(banc.url, '/api/quiz-tout-pret', { categories: ['Histoire'], difficulte: 'facile', nombre: 15 }, cookie)).json()) as any
  assert.equal(troisieme.questions.length, 15)
  assert.ok(troisieme.questions.every((q: any) => !premieres.has(q.id)), 'les questions jouées attendent que les autres soient épuisées')
  host.close()
  alice.socket.close()
  bob.socket.close()
})
