// Un quiz qui voyage d'une bibliothèque à l'autre — photos comprises.
//
// Deux animateurs ne pouvaient se passer un quiz qu'en le recopiant, photos
// une à une. Il s'exporte maintenant en un fichier, et s'importe dans un autre
// espace — ou sur un autre serveur. Le navigateur et ces tests passent par le
// même chemin (`shared/echange.ts`) : à l'import, chaque photo repasse par
// l'envoi d'image, et le quiz par sa création. Chaque test échouait avant.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { connexionAnimateur, cookieDe, creerQuiz, demarrer, ecrire, estimation, qcm, type Banc } from './banc'
import { FORMAT_QUIZ, VERSION_QUIZ, deballerQuiz, emporterQuiz, importerQuiz, nomDeFichier } from '../../shared/echange'

/** Une photo d'un pixel, telle que le navigateur l'envoie. */
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

// ── 1. Le fichier ─────────────────────────────────────────────────────────

test('un fichier porte les questions et leurs photos en clair, et se déballe à l’identique', async () => {
  const quiz = {
    title: 'Culture générale',
    questions: [
      { id: 'q1', kind: 'choice' as const, text: 'Capitale ?', answers: ['Sydney', 'Canberra', '', ''], correct: 1, target: null, unit: '', duration: 20, image: '/media/image/a', observeSeconds: 5, category: 'Géographie' },
      { id: 'q2', kind: 'number' as const, text: 'Combien ?', answers: ['', '', '', ''], correct: 0, target: 27, unit: 'pays', duration: 30, image: '/media/image/a', observeSeconds: null, category: null },
    ],
  }
  const lues: string[] = []
  const fichier = await emporterQuiz(quiz, async adresse => {
    lues.push(adresse)
    return PNG
  })
  assert.deepEqual(lues, ['/media/image/a'], 'une photo servant deux fois ne se lit qu’une fois')
  assert.equal(fichier.format, FORMAT_QUIZ)
  assert.equal(fichier.version, VERSION_QUIZ)
  assert.equal(fichier.titre, 'Culture générale')
  assert.ok(fichier.questions.every(q => q.image === PNG && !('id' in q)), 'les photos en clair, sans les identifiants de l’éditeur')

  const deballe = deballerQuiz(JSON.parse(JSON.stringify(fichier)))
  assert.ok(!('erreur' in deballe))
  assert.equal(deballe.titre, 'Culture générale')
  assert.deepEqual(deballe.photos, [PNG, PNG])
  assert.equal(deballe.questions[0].category, 'Géographie')
  assert.equal(deballe.questions[1].target, 27)
  assert.ok(deballe.questions.every(q => !('image' in q)), 'une photo ne vaut qu’une fois envoyée au serveur')
  assert.equal(nomDeFichier('Culture générale'), 'culture-generale.quiz.json')
  assert.equal(nomDeFichier('🎉'), 'quiz.quiz.json')
})

test('ce qui n’est pas un quiz de l’application se refuse en une phrase', () => {
  const erreur = (brut: unknown) => {
    const d = deballerQuiz(brut)
    return 'erreur' in d ? d.erreur : null
  }
  assert.match(erreur({ title: 'Un quiz', questions: [] }) ?? '', /pas un quiz exporté/)
  assert.match(erreur(null) ?? '', /pas un quiz exporté/)
  assert.match(erreur({ format: FORMAT_QUIZ, version: VERSION_QUIZ + 1, titre: 'x', questions: [{}] }) ?? '', /plus récente/)
  assert.match(erreur({ format: FORMAT_QUIZ, version: VERSION_QUIZ, titre: 'x', questions: [] }) ?? '', /aucune question/)
})

test('une photo dans un format que le serveur refuse est laissée de côté — pas le quiz', () => {
  const d = deballerQuiz({
    format: FORMAT_QUIZ,
    version: VERSION_QUIZ,
    titre: 'Piège',
    questions: [
      { text: 'Une ?', image: 'data:image/svg+xml;base64,PHN2Zz48c2NyaXB0Lz48L3N2Zz4=' },
      { text: 'Deux ?', image: 'https://ailleurs.example/pixel.png' },
      { text: 'Trois ?', image: PNG },
    ],
  })
  assert.ok(!('erreur' in d))
  assert.deepEqual(d.photos, [null, null, PNG])
  assert.equal(d.photosIgnorees, 2)
})

// ── 2. D'un espace à l'autre ──────────────────────────────────────────────

async function avecBanc(scenario: (banc: Banc) => Promise<void>) {
  const banc = await demarrer()
  try {
    await scenario(banc)
  } finally {
    await banc.close()
  }
}

/** Un second animateur, son espace à lui, et sa session. */
async function voisin(banc: Banc, admin: string): Promise<string> {
  const cree = await ecrire(banc.url, '/api/admin/accounts', { login: 'voisin', name: 'Voisin', slug: 'chez-le-voisin' }, admin)
  assert.equal(cree.status, 201)
  const { activation } = (await cree.json()) as { activation: { token: string } }
  return cookieDe(await ecrire(banc.url, '/api/auth/activate', { token: activation.token, password: 'voisin-pass-1' }))
}

const lire = async (banc: Banc, cookie: string, chemin: string) => fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } })

test('un quiz passe d’un espace à l’autre, photos comprises — et personne n’emporte celui d’un autre', () =>
  avecBanc(async banc => {
    const admin = await connexionAnimateur(banc.url)
    const envoi = await ecrire(banc.url, '/api/images', { dataUrl: PNG }, admin)
    const { url: photo } = (await envoi.json()) as { url: string }
    const id = await creerQuiz(
      banc.url,
      admin,
      [{ ...qcm('Capitale de l’Australie ?', ['Sydney', 'Canberra'], 1), image: photo, category: 'Géographie' }, estimation('Pays de l’UE ?', 27, 'pays')],
      'Voyageur',
    )

    // L'export, comme le fait la page : le quiz, puis chacune de ses photos.
    const source = (await (await lire(banc, admin, `/api/quizzes/${id}`)).json()) as any
    const fichier = await emporterQuiz(source, async adresse => {
      const res = await fetch(`${banc.url}${adresse}`)
      if (!res.ok) return null
      return `data:${res.headers.get('content-type')};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`
    })
    assert.equal(fichier.questions[0].image, PNG, 'la photo voyage dans le fichier')

    // L'import, dans l'espace d'un autre animateur.
    const autre = await voisin(banc, admin)
    const fait = await importerQuiz(JSON.parse(JSON.stringify(fichier)), {
      envoyerPhoto: async enClair => ((await (await ecrire(banc.url, '/api/images', { dataUrl: enClair }, autre)).json()) as any).url,
      creer: async (titre, questions) => {
        const res = await ecrire(banc.url, '/api/quizzes', { title: titre, questions }, autre)
        assert.equal(res.status, 201)
        return (await res.json()) as any
      },
    })
    assert.deepEqual([fait.questions, fait.photos, fait.photosIgnorees], [2, 1, 0])

    const arrive = (await (await lire(banc, autre, `/api/quizzes/${fait.quiz.id}`)).json()) as any
    assert.equal(arrive.title, 'Voyageur')
    const contenu = (q: any) => ({ ...q, id: undefined, image: undefined })
    assert.deepEqual(arrive.questions.map(contenu), source.questions.map(contenu), 'les mêmes questions, réponses, catégories et estimations')
    assert.match(arrive.questions[0].image, /^\/media\/image\//)
    assert.notEqual(arrive.questions[0].image, photo, 'la photo est hébergée à nouveau, chez lui')
    const relue = await fetch(`${banc.url}${arrive.questions[0].image}`)
    assert.equal(Buffer.from(await relue.arrayBuffer()).toString('base64'), PNG.split(',')[1])

    // Chacun sa bibliothèque : l'import n'est que chez lui, et il n'emporte pas celle de l'autre.
    const chezAdmin = (await (await lire(banc, admin, '/api/quizzes')).json()) as any[]
    assert.ok(!chezAdmin.some(q => q.id === fait.quiz.id))
    assert.equal((await lire(banc, autre, `/api/quizzes/${id}`)).status, 404)
  }))

// ── 3. Deux quiz du même nom ──────────────────────────────────────────────
//
// Importé deux fois, « Spécial agence » faisait deux quiz homonymes, que
// seule l'heure distinguait — et « Supprimer « Spécial agence » ? » ne
// disait pas lequel (tablée du 24 septembre, ED-8). Le second arrive
// « Spécial agence (2) ».

test('un quiz importé sous un titre déjà pris prend le premier numéro libre', async () => {
  const quiz = { title: 'Spécial agence', questions: [qcm('Un ?')] }
  const fichier = await emporterQuiz(quiz as never, async () => null)
  const crees: string[] = []
  const importer = (titresPris: string[]) =>
    importerQuiz(fichier, {
      envoyerPhoto: async () => '/media/image/x',
      creer: async titre => {
        crees.push(titre)
        return titre
      },
      titresPris,
    })
  await importer([])
  await importer(['Spécial agence', 'Autre'])
  await importer(['Spécial agence', 'Spécial agence (2)'])
  await importer(['spécial agence ', 'Spécial agence (3)'])
  assert.deepEqual(crees, ['Spécial agence', 'Spécial agence (2)', 'Spécial agence (3)', 'Spécial agence (2)'])
})
