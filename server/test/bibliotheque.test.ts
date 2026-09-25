// La bibliothèque (rapport du 25 septembre 2026, lot 4) : retrouver un quiz
// parmi quarante par ce qu'il contient — sans rien avoir à saisir de plus —,
// le ranger à l'écart sans le perdre, et tout emporter d'un seul fichier.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { dureeEstimeeS, normalizeQuestions, pourChercher, rechercherDans, resumerQuiz, type QuizDef } from '../../shared/library'
import { FORMAT_BIBLIOTHEQUE, emporterBibliotheque, importerFichier, nomDeBibliotheque } from '../../shared/echange'
import {
  attendre,
  connexionAnimateur,
  cookieDe,
  creerQuiz,
  demarrer,
  ecranCommun,
  ecrire,
  estimation,
  qcm,
  type Banc,
} from './banc'

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

const quizDe = (title: string, questions: unknown[], extra: Partial<QuizDef> = {}): QuizDef => ({
  id: title,
  title,
  questions: normalizeQuestions(questions),
  updatedAt: 1,
  ...extra,
})

const bancs: Banc[] = []
after(async () => {
  for (const b of bancs) await b.close()
})

// ── Ce que la liste dérive des questions ───────────────────────────────────

test('le résumé d’un quiz se dérive de ses questions : photos, estimations, catégories, durée', () => {
  const quiz = quizDe('Années 90', [
    { kind: 'choice', text: 'Qui chantait la Macarena ?', answers: ['Los del Río', 'Ricky Martin'], correct: 0, category: 'Musique', image: '/media/image/a' },
    { kind: 'choice', text: 'Le Tamagotchi vient de…', answers: ['Japon', 'Corée'], correct: 0, category: 'Jeux & pop culture' },
    { kind: 'number', text: 'Année de sortie de Titanic ?', target: 1997, category: 'Cinéma & séries' },
    { kind: 'choice', text: 'Qui chantait Wannabe ?', answers: ['Spice Girls', 'All Saints'], correct: 0, category: 'Musique' },
    // Une photo seulement annoncée : la question est à compléter, pas illustrée.
    { kind: 'choice', text: 'Qui est sur la photo ?', answers: ['Moi', 'Toi'], correct: 0, photoAttendue: 'photo-de-classe.jpg' },
  ])
  const r = resumerQuiz(quiz)
  assert.equal(r.questionCount, 5)
  assert.equal(r.readyCount, 4)
  assert.equal(r.photos, 1)
  assert.equal(r.estimations, 1)
  assert.deepEqual(r.categories, ['Musique', 'Cinéma & séries', 'Jeux & pop culture'], 'la plus fréquente d’abord, puis l’alphabet')
  assert.equal(r.dureeS, dureeEstimeeS(quiz.questions))
  assert.equal(r.archivedAt, null)
  assert.equal(resumerQuiz({ ...quiz, archivedAt: 42 }).archivedAt, 42)
})

test('la recherche lit le titre, les intitulés et les réponses — sans casse, sans accent, dans n’importe quel ordre', () => {
  const quiz = quizDe('Spécial années 90', [
    { kind: 'choice', text: 'Qui chantait la Macarena ?', answers: ['Los del Río', 'Ricky Martin'], correct: 0 },
    { kind: 'number', text: 'Combien de Tamagotchi vendus ?', target: 82, unit: 'millions' },
    { kind: 'choice', text: '', answers: ['Zinedine', 'Fabien'], correct: 0 },
  ])
  assert.equal(pourChercher('  Élève  L’ÉTÉ '), "eleve l'ete")
  assert.equal(rechercherDans(quiz, ''), true, 'rien à chercher : tout se garde')
  assert.equal(rechercherDans(quiz, 'SPECIAL 90'), true, 'le titre, sans accent ni casse')
  assert.equal(rechercherDans(quiz, 'macarena'), 'Qui chantait la Macarena ?', 'l’intitulé qui l’a fait trouver')
  assert.equal(rechercherDans(quiz, 'rio los'), 'Qui chantait la Macarena ?', 'une réponse, les mots dans le désordre')
  assert.equal(rechercherDans(quiz, 'millions'), 'Combien de Tamagotchi vendus ?', 'l’unité d’une estimation')
  assert.equal(rechercherDans(quiz, 'zinedine'), true, 'une question sans intitulé trouve son quiz sans rien citer')
  assert.equal(rechercherDans(quiz, 'macarena titanic'), null, 'chaque mot doit y être')
  assert.equal(rechercherDans(quiz, 'pokemon'), null)
})

// ── Tout emporter, tout reprendre ──────────────────────────────────────────

test('une bibliothèque entière s’emporte en un fichier et se relit — titres dédoublonnés, photos envoyées une fois', async () => {
  const photo = '/media/image/p1'
  const quizzes = [
    { title: 'Blind test', questions: normalizeQuestions([{ ...qcm('Qui chante ?'), image: photo }]), reglages: { melangerReponses: true } },
    { title: 'Blind test', questions: normalizeQuestions([{ ...qcm('Et là ?'), image: photo }]) },
    { title: 'Géographie', questions: normalizeQuestions([estimation('Hauteur de l’Everest ?', 8849, 'm')]) },
  ]
  const avancees: string[] = []
  const fichier = await emporterBibliotheque(quizzes, async () => PNG, (faits, total) => avancees.push(`${faits}/${total}`))
  assert.equal(fichier.format, FORMAT_BIBLIOTHEQUE)
  assert.equal(fichier.quiz.length, 3)
  assert.deepEqual(avancees, ['1/3', '2/3', '3/3'])
  assert.equal(fichier.quiz[0].questions[0].image, PNG, 'la photo voyage en clair')
  assert.deepEqual(fichier.quiz[0].reglages, { melangerReponses: true })

  // Un quiz abîmé dans le fichier se compte, sans arrêter les autres.
  const relu = JSON.parse(JSON.stringify({ ...fichier, quiz: [...fichier.quiz, { format: 'autre chose' }] }))
  const envois: string[] = []
  const crees: { titre: string; questions: number; reglages: unknown }[] = []
  const fait = await importerFichier(relu, {
    envoyerPhoto: async enClair => {
      envois.push(enClair)
      return `/media/image/neuve-${envois.length}`
    },
    creer: async (titre, questions, reglages) => {
      crees.push({ titre, questions: questions.length, reglages })
      return { title: titre }
    },
    titresPris: ['Géographie'],
  })
  assert.deepEqual(
    crees.map(c => c.titre),
    ['Blind test', 'Blind test (2)', 'Géographie (2)'],
    'deux quiz du même nom dans le fichier ne se confondent pas, ni avec la bibliothèque',
  )
  assert.deepEqual(crees[0].reglages, { melangerReponses: true }, 'les réglages suivent chaque quiz')
  assert.equal(envois.length, 1, 'la photo commune à deux quiz ne s’envoie qu’une fois')
  assert.equal(fait.photos, 1)
  assert.equal(fait.questions, 3)
  assert.equal(fait.illisibles, 1)
  assert.equal(fait.quiz.length, 3)

  // Un quiz seul passe par le même chemin.
  const seul = await importerFichier(relu.quiz[2], {
    envoyerPhoto: async () => 'x',
    creer: async titre => ({ title: titre }),
  })
  assert.deepEqual(seul.quiz, [{ title: 'Géographie' }])

  await assert.rejects(
    importerFichier({ format: FORMAT_BIBLIOTHEQUE, version: 99, quiz: [] }, { envoyerPhoto: async () => 'x', creer: async () => ({}) }),
    /version plus récente/,
  )
  await assert.rejects(
    importerFichier({ format: FORMAT_BIBLIOTHEQUE, version: 1, quiz: [{ format: 'rien' }] }, { envoyerPhoto: async () => 'x', creer: async () => ({}) }),
    /Aucun quiz de cette bibliothèque ne se lit/,
  )
  assert.equal(nomDeBibliotheque(new Date(2026, 8, 5)), 'mes-quiz-2026-09-05.bibliotheque.json')
})

// ── Le serveur : chercher, archiver, chacun chez soi ──────────────────────

test('chercher et archiver : chez soi seulement, et un quiz archivé ne se propose plus à la soirée', async () => {
  const banc = await demarrer()
  bancs.push(banc)
  const cookie = await connexionAnimateur(banc.url)
  const lire = async (chemin: string, c = cookie) => (await fetch(`${banc.url}${chemin}`, { headers: { Cookie: c } })).json() as Promise<any>
  const annees90 = await creerQuiz(
    banc.url,
    cookie,
    [qcm('Qui chantait la Macarena ?', ['Los del Río', 'Ricky Martin']), estimation('Tamagotchi vendus ?', 82, 'millions')],
    'Années 90',
  )
  const cinema = await creerQuiz(banc.url, cookie, [qcm('Qui a réalisé Titanic ?', ['Cameron', 'Spielberg'])], 'Cinéma')

  const tous = await lire('/api/quizzes')
  const resume = tous.find((q: any) => q.id === annees90)
  assert.equal(resume.estimations, 1)
  assert.equal(resume.readyCount, 2)
  assert.ok(resume.dureeS > 0)

  const trouves = await lire(`/api/quizzes?q=${encodeURIComponent('macaréna')}`)
  assert.deepEqual(
    trouves.map((q: any) => [q.id, q.trouve]),
    [[annees90, 'Qui chantait la Macarena ?']],
    'la recherche lit les intitulés, et dit lequel',
  )
  assert.deepEqual((await lire('/api/quizzes?q=cinema')).map((q: any) => [q.id, q.trouve]), [[cinema, undefined]], 'un titre ne cite rien')

  // Le voisin ne trouve rien chez nous, et n'archive rien.
  const cree = await ecrire(banc.url, '/api/admin/accounts', { login: 'voisin', name: 'Voisin', slug: 'chez-le-voisin' }, cookie)
  const { activation } = (await cree.json()) as { activation: { token: string } }
  const voisin = cookieDe(await ecrire(banc.url, '/api/auth/activate', { token: activation.token, password: 'voisin-pass-1' }))
  assert.deepEqual(await lire('/api/quizzes?q=macarena', voisin), [], 'la recherche ne sort pas de l’espace')
  assert.equal((await ecrire(banc.url, `/api/quizzes/${annees90}/archive`, { archive: true }, voisin)).status, 404)

  // Archivé : il reste dans la liste, marqué, à sa place — et sort du choix de la soirée.
  const avant = (await lire('/api/quizzes')).find((q: any) => q.id === annees90)
  assert.equal((await ecrire(banc.url, `/api/quizzes/${annees90}/archive`, { archive: true }, cookie)).status, 200)
  const apres = (await lire('/api/quizzes')).find((q: any) => q.id === annees90)
  assert.ok(apres.archivedAt > 0, 'le quiz est marqué archivé')
  assert.equal(apres.updatedAt, avant.updatedAt, 'archiver ne le fait pas remonter comme une modification')
  assert.ok((await lire(`/api/quizzes/${annees90}`)).archivedAt > 0)

  const host = await ecranCommun(banc.url, cookie)
  const choix = attendre<any>(host, 'session:view', p => p.view.phase === 'pickPack', 'la liste des quiz')
  ;(host as any).emit('host:launch')
  const propose = (await choix).view.packs.map((p: any) => p.id)
  assert.ok(propose.includes(cinema))
  assert.ok(!propose.includes(annees90), 'un quiz archivé ne se propose plus à la soirée')
  host.close()

  // Ressorti, il revient.
  assert.equal((await ecrire(banc.url, `/api/quizzes/${annees90}/archive`, { archive: false }, cookie)).status, 200)
  assert.equal((await lire('/api/quizzes')).find((q: any) => q.id === annees90).archivedAt, null)
  const host2 = await ecranCommun(banc.url, cookie)
  const choix2 = attendre<any>(host2, 'session:view', p => p.view.phase === 'pickPack', 'la liste des quiz')
  ;(host2 as any).emit('host:launch')
  assert.ok((await choix2).view.packs.some((p: any) => p.id === annees90), 'ressorti, il se propose de nouveau')
  host2.close()
})
