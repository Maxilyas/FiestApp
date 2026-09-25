// Les petits gestes de la gestion des quiz (rapport du 25 septembre 2026,
// `retours/2026-09-25/gestion-des-quiz.md`, lot 1).
//
// · Un modèle à personnaliser ne se dit plus « prêt » avec ses crayons, et
//   « Pour qui ? » remplace ses prénoms d'un geste.
// · La liste collée nomme ce qu'elle laisse : les blocs ignorés, la réponse
//   en trop ; et elle lit le titre annoncé en tête.
// · La durée d'un quiz s'estime, un quiz neuf abandonné se reconnaît, et la
//   demande pour une IA part avec le format.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  TITRE_PAR_DEFAUT,
  dureeEstimeeS,
  ecrireDuree,
  emptyQuestion,
  normalizeQuestions,
  parseImportedQuestions,
  questionProblem,
  quizAbandonne,
  toPlayable,
  trouDans,
  type QuizQuestionDef,
} from '../../shared/library'
import { lirePourQui, personnaliser, pourQuiLeTexte } from '../../shared/modeles'
import { EXEMPLE_DU_FORMAT, FORMAT_DE_LISTE, demandePourIA, ecrireListe } from '../../shared/liste'
import { connexionAnimateur, demarrer, ecrire, type Banc } from './banc'

const modele = JSON.parse(readFileSync(new URL('../content/quiz/qui-le-connait.json', import.meta.url), 'utf8'))

// ── Les trous d'un modèle ─────────────────────────────────────────────────

test('un modèle copié tel quel n’a aucune question prête, et chaque carte dit quoi écrire', () => {
  const questions = normalizeQuestions(modele.questions)
  assert.equal(questions.filter(q => toPlayable(q) !== null).length, 0, 'aucune question ne part au mur avec ses crayons')
  assert.match(questionProblem(questions[0])!, /Écris le prénom à la place de « \[Prénom\] »/)
  // Le prénom écrit, restent les réponses marquées.
  const julie = { ...questions[0], text: 'Où Julie est-elle née ?' }
  assert.equal(questionProblem(julie), 'Remplace ce qui est marqué ✏️')
  assert.equal(toPlayable(julie), null)
  // Les réponses écrites, la bonne reste à choisir : seul l'animateur la connaît.
  const ecrite = { ...julie, answers: ['Lyon', 'Brest', 'Nice', 'Metz'] }
  assert.equal(questionProblem(ecrite), 'Choisis la bonne réponse')
  const prete = { ...ecrite, correct: 2 }
  assert.equal(questionProblem(prete), null)
  assert.ok(toPlayable(prete))
  // Même le vrai ou faux et les emojis, qui n'ont pas de crayon, attendent leur bonne réponse.
  for (const q of questions) assert.equal(q.correct, -1, q.text)
})

test('un crochet ordinaire n’est pas un trou : « Je [...] la vie en rose »', () => {
  assert.equal(trouDans('Complète : « Je [...] la vie en rose »', '[A] ou [B] ?'), null)
  assert.equal(trouDans('Qui est [prénom 2] ?'), 'Écris le prénom à la place de « [prénom 2] »')
  assert.equal(trouDans('Réponse', 'Ville ✏'), 'Remplace ce qui est marqué ✏️', 'le crayon sans sélecteur de variante')
  // L'unité d'une estimation compte aussi.
  const q: QuizQuestionDef = { ...emptyQuestion(), kind: 'number', text: 'Combien ?', target: 3, unit: '✏️' }
  assert.equal(questionProblem(q), 'Remplace ce qui est marqué ✏️')
})

test('« Pour qui ? » remplace les prénoms et accorde, titre compris, et laisse les crayons', () => {
  const pourJulie = lirePourQui({ prenoms: [' Julie '], accord: 'elle' }, 1)!
  const fait = personnaliser(modele.title, modele.questions, pourJulie)
  assert.equal(fait.titre, '⭐ Qui connaît le mieux Julie ?')
  assert.equal(fait.questions[0].text, 'Où Julie est-elle née ?')
  assert.equal(fait.questions[3].text, 'Quelle chanson Julie chante-t-elle sous la douche ?')
  assert.equal(fait.questions[6].text, 'À quel âge Julie a-t-elle eu son premier téléphone ?')
  assert.deepEqual(fait.questions[0].answers, ['Ville A ✏️', 'Ville B ✏️', 'Ville C ✏️', 'Ville D ✏️'])
  // Plus aucun prénom à écrire : seules les réponses restent à remplir.
  const questions = normalizeQuestions(fait.questions)
  for (const q of questions) assert.doesNotMatch(questionProblem(q) ?? '', /prénom/, q.text)

  const pourTom = lirePourQui({ prenoms: ['Tom'], accord: 'il' }, 1)!
  assert.equal(pourQuiLeTexte('Où [Prénom] est-il/elle né·e ?', pourTom), 'Où Tom est-il né ?')
  const neutre = lirePourQui({ prenoms: ['Sam'], accord: 'autre chose' }, 1)!
  assert.equal(neutre.accord, 'neutre')
  assert.equal(pourQuiLeTexte('Où [Prénom] est-il/elle né·e ?', neutre), 'Où Sam est-il/elle né·e ?')
})

test('un couple : deux prénoms, chacun à sa place ; un prénom manquant est refusé', () => {
  const couple = lirePourQui({ prenoms: ['Léa', 'Tom'], accord: 'neutre' }, 2)!
  assert.equal(pourQuiLeTexte('Qui de [Prénom 1] ou de [Prénom 2] cuisine ?', couple), 'Qui de Léa ou de Tom cuisine ?')
  assert.equal(lirePourQui({ prenoms: ['Léa'] }, 2), null)
  assert.equal(lirePourQui({ prenoms: ['   '] }, 1), null)
  assert.equal(lirePourQui({ prenoms: 'Léa' }, 1), null)
  // Un crochet tapé dans le prénom ne refait pas un trou.
  assert.equal(lirePourQui({ prenoms: ['[Prénom]'] }, 1)!.prenoms[0], 'Prénom')
})

// ── La liste collée nomme ce qu'elle laisse ──────────────────────────────

test('la liste collée nomme ses blocs ignorés et ses réponses en trop', () => {
  const lu = parseImportedQuestions(
    [
      'Quel est le vrai nom de famille de Joey dans « Friends » ?',
      '* Tribbiani',
      'Geller',
      'Bing',
      'Buffay',
      'Green',
      '',
      'Une question sans réponse ?',
      '',
      '# Astrologie',
      'Combien de pays dans l’Union ?',
      '= 10 93',
    ].join('\n'),
  )
  assert.equal(lu.questions.length, 1)
  assert.deepEqual(lu.enTrop, [{ question: 'Quel est le vrai nom de famille de Joey dans « Friends » ?', reponse: 'Green' }])
  assert.equal(lu.ignored, 3)
  assert.deepEqual(lu.ignores, ['Une question sans réponse ?', '# Astrologie', 'Combien de pays dans l’Union ?'])
})

test('« Titre : » en tête de liste nomme le quiz ; plus bas, ou suivi de choix, c’est une question', () => {
  const lu = parseImportedQuestions('Titre : Soirée années 90\n\n# Musique\nQui chante « Wannabe » ?\n* Spice Girls\nTLC')
  assert.equal(lu.titre, 'Soirée années 90')
  assert.equal(lu.ignored, 0)
  assert.equal(lu.questions[0].category, 'Musique')
  // Seule avec ses catégories et son temps, sur le même bloc.
  const serre = parseImportedQuestions('Titre : Le grand quiz\nTemps : 30 s\n# Sport\n\nQui a gagné ?\n* Nous\nEux')
  assert.equal(serre.titre, 'Le grand quiz')
  assert.equal(serre.questions[0].duration, 30)
  assert.equal(serre.questions[0].category, 'Sport')
  // « Titre : » suivi de ses choix est une question comme une autre.
  const question = parseImportedQuestions('Titre : quel film a gagné 11 Oscars ?\n* Titanic\nAvatar')
  assert.equal(question.titre, null)
  assert.equal(question.questions.length, 1)
  assert.equal(question.questions[0].text, 'Titre : quel film a gagné 11 Oscars ?')
  // Ailleurs qu'en tête, la ligne ne nomme rien.
  assert.equal(parseImportedQuestions('Q ?\n* a\nb\n\nTitre : trop tard').titre, null)
})

test('l’exemple du format annonce un titre, et « Copier en liste » écrit celui du quiz', () => {
  assert.equal(parseImportedQuestions(EXEMPLE_DU_FORMAT).titre, 'Le tour du monde en six questions')
  assert.match(FORMAT_DE_LISTE, /« Titre : » suivi du titre du quiz \(80 caractères au plus\)/)
  assert.match(FORMAT_DE_LISTE, /Des emojis courants seulement/)
  const q: QuizQuestionDef = { ...emptyQuestion(), text: 'Oui ?', answers: ['Oui', 'Non', '', ''], correct: 0 }
  const texte = ecrireListe([q], 'Mon   quiz')
  assert.match(texte, /^Titre : Mon quiz\n\n/)
  const relu = parseImportedQuestions(texte)
  assert.equal(relu.titre, 'Mon quiz')
  assert.equal(relu.questions.length, 1)
  assert.equal(ecrireListe([q]).startsWith('Titre'), false, 'sans titre, rien en tête')
})

// ── La durée, l'abandon, la demande pour une IA ──────────────────────────

test('la durée d’un quiz : ses questions jouables, leur observation et une révélation chacune', () => {
  const q = (duration: number, extra: Partial<QuizQuestionDef> = {}): QuizQuestionDef => ({
    ...emptyQuestion(),
    text: 'Q ?',
    answers: ['a', 'b', '', ''],
    correct: 0,
    duration,
    ...extra,
  })
  assert.equal(dureeEstimeeS([]), 0)
  // 3 s de départ, 15 s de podium, puis chaque question et sa révélation (8 s).
  assert.equal(dureeEstimeeS([q(20), q(30)]), 18 + 28 + 38)
  // Une photo qui disparaît ajoute son observation ; une question à compléter ne compte pas.
  assert.equal(dureeEstimeeS([q(20, { image: '/media/image/x', observeSeconds: 5 }), q(20, { text: '' })]), 18 + 33)
  assert.equal(ecrireDuree(18 + 28 + 38), '≈ 1 min')
  assert.equal(ecrireDuree(9 * 60 + 10), '≈ 9 min')
  assert.equal(ecrireDuree(65 * 60), '≈ 1 h 05')
  assert.equal(ecrireDuree(120 * 60), '≈ 2 h')
})

test('un quiz neuf quitté sans rien y écrire se reconnaît — pas un quiz nommé, ni un quiz qui a des questions', () => {
  assert.ok(quizAbandonne({ title: TITRE_PAR_DEFAUT, questions: [] }))
  assert.ok(quizAbandonne({ title: '  ', questions: [] }))
  assert.equal(quizAbandonne({ title: 'Noël', questions: [] }), false)
  assert.equal(quizAbandonne({ title: TITRE_PAR_DEFAUT, questions: [emptyQuestion()] }), false)
})

test('la demande pour une IA dit le thème, le public, le niveau et la part d’estimations, puis le format', () => {
  const demande = demandePourIA({ theme: '  les   années 90 ', nombre: 12, public: 'famille', niveau: 'facile', estimations: 'beaucoup' })
  assert.match(demande, /^Écris un quiz de 12 questions sur ce thème : « les années 90 »\./)
  assert.match(demande, /une famille/)
  assert.match(demande, /facile/)
  assert.match(demande, /la moitié en estimations/)
  assert.ok(demande.trimEnd().endsWith(EXEMPLE_DU_FORMAT), 'le format complet, exemple compris, suit la demande')
  // Des valeurs absurdes retombent sur des bornes lisibles.
  assert.match(demandePourIA({ theme: '', nombre: 5000, public: 'adultes', niveau: 'moyen', estimations: 'aucune' }), /^Écris un quiz de 100 questions sur ce thème : « culture générale/)
})

// ── « Pour qui ? » sur un vrai serveur ────────────────────────────────────

const bancs: Banc[] = []
after(async () => {
  for (const b of bancs) await b.close()
})

test('le modèle se copie pour Julie, ou tel quel, et l’API dit qu’il se personnalise', async () => {
  const banc = await demarrer()
  bancs.push(banc)
  const cookie = await connexionAnimateur(banc.url)
  const modeles = (await (await fetch(`${banc.url}/api/modeles`, { headers: { Cookie: cookie } })).json()) as any[]
  const quiLeConnait = modeles.find(m => m.id === 'qui-le-connait')
  assert.deepEqual(quiLeConnait.personnaliser, { prenoms: 1 })
  assert.ok(quiLeConnait.description)

  const res = await ecrire(banc.url, '/api/modeles/qui-le-connait', { prenoms: ['Julie'], accord: 'elle' }, cookie)
  assert.equal(res.status, 201)
  const quiz = (await res.json()) as any
  assert.equal(quiz.title, '⭐ Qui connaît le mieux Julie ?')
  assert.equal(quiz.questions[0].text, 'Où Julie est-elle née ?')

  // Un prénom vide est refusé en une phrase ; sans « Pour qui ? », le modèle arrive tel quel.
  const vide = await ecrire(banc.url, '/api/modeles/qui-le-connait', { prenoms: [''] }, cookie)
  assert.equal(vide.status, 400)
  assert.match(((await vide.json()) as any).error, /prénom/)
  const telQuel = (await (await ecrire(banc.url, '/api/modeles/qui-le-connait', {}, cookie)).json()) as any
  assert.equal(telQuel.title, '⭐ Qui connaît le mieux [Prénom] ?')

  // Ni l'un ni l'autre ne se proposent au choix du quiz : leurs réponses ont des crayons.
  const liste = (await (await fetch(`${banc.url}/api/quizzes`, { headers: { Cookie: cookie } })).json()) as any[]
  for (const id of [quiz.id, telQuel.id]) assert.equal(liste.find(q => q.id === id).readyCount, 0)
})
