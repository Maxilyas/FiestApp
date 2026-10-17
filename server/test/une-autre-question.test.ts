// « Une autre », dans l'éditeur (l'animatrice exigeante, le 11 octobre 2026,
// constat 8) : retirer d'un quiz tout prêt la question qu'on n'aime pas — le
// Tarantino du quiz des enfants — le laissait à quatorze, et rien ne tirait sa
// voisine dans la base. Une question tirée de la base laisse maintenant sa
// place à une voisine : même catégorie, même marche, même sorte, pas plus
// vieille d'âge, hors de la bibliothèque et du quiz, pas la jumelle d'une
// autre de ses questions.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { BaseDeLaCampagne, lireQuestionDeLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { idDansLeQuiz, uneAutreQuestion, type DejaDansLEspace } from '../src/core/quizToutPret'
import { sujetsDeLaQuestion } from '../src/core/campagne'
import { suiteFixe } from '../../shared/hasard'
import { niveauDeQuestion } from '../../shared/campagne'
import { SOUS_THEMES } from '../../shared/etiquettes'
import type { Categorie } from '../../shared/categories'
import { connexionAnimateur, demarrer, ecrire, type Banc } from './banc'

const bancs: Banc[] = []
after(async () => {
  for (const b of bancs) await b.close()
})

/** Une question de la base : ce que le tirage lit, réglé ; sa bonne réponse un nombre si `nombre` est donné. */
function question(
  n: number,
  {
    categorie = 'Histoire',
    difficulte = 2,
    ageMin = 10,
    nombre,
    texte,
    reponses,
    date = null,
    sousTheme,
  }: {
    categorie?: Categorie
    difficulte?: number
    ageMin?: number
    nombre?: number
    texte?: string
    reponses?: string[]
    date?: { valeur: string; precision: 'annee' } | null
    /** Le premier de sa catégorie, d'office. */
    sousTheme?: string
  } = {},
): QuestionDeLaBase {
  const autres = [1, 2, 3, 4, 5, 6].map(d => (nombre === undefined ? `Autre ${d}-${n}` : String(nombre + d * 7)))
  const lu = lireQuestionDeLaBase({
    id: `u${String(n).padStart(7, '0')}`,
    texte: texte ?? (nombre === undefined ? `La question ${n}, laquelle est la bonne ?` : `En quelle année le fait numéro ${n} a-t-il eu lieu ?`),
    reponses: reponses ?? [nombre === undefined ? `Bonne ${n}` : String(nombre), ...autres.slice(0, 3)],
    bonne: 0,
    anecdote: `L'anecdote de ${n}.`,
    categorie,
    sousTheme: sousTheme ?? SOUS_THEMES[categorie][0].cle,
    etiquettes: [],
    difficulte,
    ageMin,
    date,
    entites: [],
    portee: 'monde',
    valeur: nombre === undefined ? null : { nombre, unite: '' },
    leurres: reponses ? reponses.slice(1) : autres,
    dureeDeVie: 'stable',
    explication: '',
    source: null,
    confiance: 3,
    aRelire: [],
  })
  if ('refus' in lu) throw new Error(`question ${n} : ${lu.refus}`)
  return lu.question
}

const rien: DejaDansLEspace = { ids: new Set(), empreintes: new Set(), posees: new Map() }
const autre = (base: QuestionDeLaBase[], remplacee: QuestionDeLaBase, quiz: QuestionDeLaBase[] = [remplacee], deja = rien, kind: 'choice' | 'number' = 'choice', graine = 3) =>
  uneAutreQuestion(base, sujetsDeLaQuestion, new Map(), { id: idDansLeQuiz(remplacee.id), kind }, quiz.map(q => idDansLeQuiz(q.id)), deja, suiteFixe(graine))

test('la voisine : même catégorie, même marche, même sorte, pas plus vieille d’âge — jamais la même, ni du quiz, ni de la bibliothèque', () => {
  const remplacee = question(1, { ageMin: 6 })
  const dansLeQuiz = question(2, { ageMin: 6 })
  const dejaRangee = question(3, { ageMin: 6 })
  const bonne = question(4, { ageMin: 6 })
  const base = [
    remplacee,
    dansLeQuiz,
    dejaRangee,
    bonne,
    question(5, { categorie: 'Sport', ageMin: 6 }), // une autre catégorie
    question(6, { difficulte: 5, ageMin: 6 }), // une autre marche
    question(7, { ageMin: 14 }), // trop vieille pour un quiz d'enfants
  ]
  const deja: DejaDansLEspace = { ...rien, ids: new Set([idDansLeQuiz(dejaRangee.id)]) }
  for (let graine = 1; graine <= 8; graine++) {
    assert.equal(autre(base, remplacee, [remplacee, dansLeQuiz], deja, 'choice', graine)?.id, idDansLeQuiz(bonne.id), `graine ${graine}`)
  }
  // Plus rien de semblable : null, l'éditeur le dit.
  assert.equal(autre([remplacee, dansLeQuiz], remplacee, [remplacee, dansLeQuiz]), null)
  // Une question qui ne vient pas de la base : rien à tirer.
  assert.equal(uneAutreQuestion(base, sujetsDeLaQuestion, new Map(), { id: 'q-maison', kind: 'choice' }, [], rien), null)
})

test('une estimation pour une estimation ; d’abord ses sujets, puis la jamais posée ; pas la jumelle d’une autre question du quiz', () => {
  // Une estimation se remplace par une question à nombre, jouée en estimation.
  const annee = question(10, { nombre: 1789 })
  const qcm = question(11)
  const autreAnnee = question(12, { nombre: 1815 })
  const estimation = autre([annee, qcm, autreAnnee], annee, [annee], rien, 'number')
  assert.equal(estimation?.id, idDansLeQuiz(autreAnnee.id))
  assert.equal(estimation?.kind, 'number')
  assert.equal(estimation?.target, 1815)

  // Une question des années 80 : sa voisine en est aussi, avant toute autre.
  const des80 = question(20, { date: { valeur: '1985', precision: 'annee' } })
  const aussi80 = question(21, { date: { valeur: '1982', precision: 'annee' } })
  const sans = [22, 23, 24, 25].map(n => question(n))
  for (let graine = 1; graine <= 8; graine++) assert.equal(autre([des80, aussi80, ...sans], des80, [des80], rien, 'choice', graine)?.id, idDansLeQuiz(aussi80.id), `graine ${graine}`)

  // La jamais posée avant celle que ses soirées ont posée.
  const remplacee = question(30)
  const posee = question(31)
  const fraiche = question(32)
  const deja: DejaDansLEspace = { ...rien, posees: new Map([[idDansLeQuiz(posee.id), Date.UTC(2026, 8, 1)]]) }
  for (let graine = 1; graine <= 8; graine++) assert.equal(autre([remplacee, posee, fraiche], remplacee, [remplacee], deja, 'choice', graine)?.id, idDansLeQuiz(fraiche.id))

  // Pas la jumelle d'une autre question du quiz quand il y a mieux : « Qui a réalisé le film… » déjà là.
  const realise = (n: number, film: string) => question(n, { texte: `Qui a réalisé le film « ${film} » ?`, reponses: [`Réalisateur ${n}`, `R${n}b`, `R${n}c`, `R${n}d`] })
  const dejaLa = realise(40, 'Amélie')
  const aRemplacer = question(41)
  const jumelle = realise(42, 'Léon')
  const neuve = question(43)
  for (let graine = 1; graine <= 8; graine++) assert.equal(autre([dejaLa, aRemplacer, jumelle, neuve], aRemplacer, [dejaLa, aRemplacer], rien, 'choice', graine)?.id, idDansLeQuiz(neuve.id))
})

// Les rubriques (le 17 octobre 2026) : un quiz tout prêt composé sur le
// football le reste quand on en remplace une question ; un quiz de toutes les
// catégories y garde ses sous-thèmes à tour de rôle.
test('la voisine garde la rubrique de la remplacée, mais pas au prix d’une jumelle', () => {
  const remplacee = question(50, { categorie: 'Sport' })
  const rugby = question(51, { categorie: 'Sport', sousTheme: 'rugby' })
  const football = question(52, { categorie: 'Sport' })
  for (let graine = 1; graine <= 8; graine++) assert.equal(autre([remplacee, rugby, football], remplacee, [remplacee], rien, 'choice', graine)?.id, idDansLeQuiz(football.id), `graine ${graine}`)
  // De la même rubrique, mais la jumelle d'une autre question du quiz : une autre rubrique passe devant.
  const finale = (n: number, annee: number) =>
    question(n, { categorie: 'Sport', texte: `Qui a gagné la finale de la Coupe de l’année ${annee} ?`, reponses: [`Équipe ${n}`, `E${n}b`, `E${n}c`, `E${n}d`] })
  const dejaLa = finale(60, 1998)
  const aRemplacer = question(61, { categorie: 'Sport' })
  const jumelle = finale(62, 2018)
  const ailleurs = question(63, { categorie: 'Sport', sousTheme: 'rugby' })
  for (let graine = 1; graine <= 8; graine++) assert.equal(autre([dejaLa, aRemplacer, jumelle, ailleurs], aRemplacer, [dejaLa, aRemplacer], rien, 'choice', graine)?.id, idDansLeQuiz(ailleurs.id))
})

test('sur un vrai serveur : la voisine se demande, rien ne s’écrit ; et l’éditeur ne la propose qu’aux questions de la base', async () => {
  const base = new BaseDeLaCampagne(Array.from({ length: 12 }, (_, i) => question(100 + i)))
  const banc = await demarrer({ baseDeLaCampagne: base })
  bancs.push(banc)
  const cookie = await connexionAnimateur(banc.url)
  const bibliotheque = async () => ((await (await fetch(`${banc.url}/api/quizzes`, { headers: { Cookie: cookie } })).json()) as { id: string }[]).map(q => q.id)
  const avant = await bibliotheque()
  const premiere = idDansLeQuiz(base.questions[0].id)
  assert.equal((await ecrire(banc.url, '/api/quiz-tout-pret/une-autre', { id: premiere, kind: 'choice', quiz: [premiere] })).status, 401, 'sans session, rien')
  const maison = await ecrire(banc.url, '/api/quiz-tout-pret/une-autre', { id: 'q-maison', kind: 'choice', quiz: [] }, cookie)
  assert.equal(maison.status, 400)
  assert.match(((await maison.json()) as { error: string }).error, /pas tirée de la base/)
  const r = await ecrire(banc.url, '/api/quiz-tout-pret/une-autre', { id: premiere, kind: 'choice', quiz: [premiere] }, cookie)
  assert.equal(r.status, 200)
  const voisine = (await r.json()) as { id: string; kind: string; category: string; anecdote: string }
  assert.notEqual(voisine.id, premiere)
  assert.ok(voisine.id.startsWith('base-') && voisine.kind === 'choice' && voisine.category === 'Histoire' && voisine.anecdote)
  // Tout le reste dans le quiz : plus rien de semblable.
  const tout = base.questions.map(q => idDansLeQuiz(q.id))
  const plus = await ecrire(banc.url, '/api/quiz-tout-pret/une-autre', { id: premiere, kind: 'choice', quiz: tout }, cookie)
  assert.equal(plus.status, 404)
  assert.match(((await plus.json()) as { error: string }).error, /écris-en une toi-même/)
  assert.deepEqual(await bibliotheque(), avant, 'rien de rangé : la carte la prend, « Enregistrer » la range')

  // L'éditeur : « Une autre » sur les seules questions tirées de la base ; la voisine prend sa place par l'identifiant, sa durée et son intertitre gardés.
  const editeur = readFileSync(new URL('../../client/src/views/EditorApp.tsx', import.meta.url), 'utf8')
  assert.match(editeur, /onUneAutre=\{id\?\.startsWith\('base-'\) \? \(\) => actions\.uneAutre\(id\) : undefined\}/)
  assert.match(editeur, /questions: d\.questions\.map\(q => \(q\.id === id \? \{ \.\.\.autre, duration: q\.duration, \.\.\.\(q\.intertitre && \{ intertitre: q\.intertitre \}\) \} : q\)\)/)
  assert.match(editeur, /\{autreEnRoute \? 'Je cherche…' : 'Une autre'\}/)
})

// La marche de chaque question tirée de la base (l'animatrice exigeante, le
// 11 octobre 2026, constat 8) : le quiz ne la garde pas, l'éditeur ne la
// disait pas, et l'ordre d'un quiz progressif est sa montée — le changer la
// cassait sans le savoir. La mémoire du quiz la porte ; la carte la montre à
// côté de son numéro ; la voisine que tire « Une autre » garde la sienne.
test('l’éditeur dit la marche des questions tirées de la base : la mémoire du quiz la porte, la carte la montre', async () => {
  const faciles = Array.from({ length: 6 }, (_, i) => question(200 + i, { difficulte: 1 }))
  const dures = Array.from({ length: 6 }, (_, i) => question(300 + i, { difficulte: 4 }))
  const base = new BaseDeLaCampagne([...faciles, ...dures])
  const banc = await demarrer({ baseDeLaCampagne: base })
  bancs.push(banc)
  const cookie = await connexionAnimateur(banc.url)
  const lire = async (chemin: string) => (await fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } })).json() as Promise<any>
  const choix = { categories: ['Histoire'], sujet: null, difficulte: 'progressive', nombre: 10, enfants: false, estimations: false }
  const quiz = (await (await ecrire(banc.url, '/api/quiz-tout-pret', choix, cookie)).json()) as { id: string; questions: { id: string }[] }
  assert.equal(quiz.questions.length, 10)
  const memoire = await lire(`/api/quizzes/${quiz.id}/memoire`)
  const attendue = (id: string) => niveauDeQuestion(base.parId.get(id.slice('base-'.length))!.meta.difficulte)
  assert.deepEqual(memoire.marches, Object.fromEntries(quiz.questions.map(q => [q.id, attendue(q.id)])))
  assert.ok(new Set(Object.values(memoire.marches)).size > 1, 'des marches différentes : le quiz monte')
  // Un quiz écrit à la main n'a rien de la base : pas de marches.
  const autres = ((await lire('/api/quizzes')) as { id: string }[]).filter(q => q.id !== quiz.id)
  assert.ok(autres.length > 0)
  assert.equal((await lire(`/api/quizzes/${autres[0].id}/memoire`)).marches, undefined)

  // La carte la montre à côté de son numéro ; la voisine de « Une autre » garde celle de la question qu'elle remplace.
  const editeur = readFileSync(new URL('../../client/src/views/EditorApp.tsx', import.meta.url), 'utf8')
  assert.match(editeur, /marche=\{\(question\.id && memoire\?\.marches\?\.\[question\.id\]\) \|\| null\}/)
  assert.match(editeur, /<span className="pill pill-marche"[^>]*>\s*\{NOM_NIVEAU\[marche\]\}\s*<\/span>/)
  assert.match(editeur, /marches: \{ \.\.\.m\.marches, \[voisine\]: m\.marches\[id\] \}/)
})
