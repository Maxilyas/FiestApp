// Un quiz tout prêt (le 11 octobre 2026) : l'animateur choisit ses
// catégories ou un sujet, la difficulté, le nombre de questions, si des
// enfants jouent — et la base de la campagne compose le quiz, rangé dans sa
// bibliothèque. Les soirées n'avaient que les onze quiz livrés.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { BaseDeLaCampagne, lireQuestionDeLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { composerUnQuiz, dejaDansLEspace, idDansLeQuiz, lireChoixDuQuiz, planDuQuiz, titreDuQuizToutPret, type DejaDansLEspace } from '../src/core/quizToutPret'
import { sujetsDeLaQuestion } from '../src/core/campagne'
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

const choix = (c: Partial<ChoixDuQuiz> = {}): ChoixDuQuiz => ({ categories: [], sujet: null, difficulte: 'progressive', nombre: 10, enfants: false, ...c })
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

test('le titre dit ce qu’on a choisi, et tient sur une ligne', () => {
  assert.equal(titreDuQuizToutPret(choix(), 15), 'Un peu de tout · 15 questions')
  assert.equal(titreDuQuizToutPret(choix({ categories: ['Histoire'], difficulte: 'facile' }), 10), 'Histoire · 10 questions faciles')
  assert.equal(titreDuQuizToutPret(choix({ categories: ['Histoire', 'Sport'], difficulte: 'corsee' }), 20), 'Histoire et Sport · 20 questions corsées')
  assert.equal(titreDuQuizToutPret(choix({ categories: ['Histoire', 'Géographie', 'Sciences', 'Sport'] }), 30), 'Histoire, Géographie et 2 autres · 30 questions')
  assert.equal(titreDuQuizToutPret(choix({ sujet: 'animaux' }), 10), 'Les animaux · 10 questions')
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
