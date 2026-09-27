// Mission « bibliothèque » — le tableau des allers-retours.
//
// Un quiz qui porte tout ce que l'éditeur sait écrire — chaque sorte de
// question, chaque réglage, les trois pièces — passe par chaque chemin qui
// l'emporte : duplication, code de partage, catalogue, fichier exporté (un
// quiz, puis toute la bibliothèque), brouillon du navigateur. On compare ce
// qui arrive, champ par champ, pièces comprises (par leurs octets).
//
//   cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/bibliotheque/allers-retours.test.ts
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { connexionAnimateur, cookieDe, demarrer, ecrire } from '../../../server/test/banc'
import { PIECES_DE_QUESTION, emptyQuestion, type QuizDef, type QuizQuestionDef } from '../../../shared/library'
import { emporterBibliotheque, emporterQuiz, importerFichier } from '../../../shared/echange'
import { emballerBrouillon, lireBrouillon } from '../../../shared/brouillon'
import type { ReglagesDuQuiz } from '../../../shared/hasard'

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const PNG2 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const MP3 = 'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA'

const banc = await demarrer()
after(() => banc.close())
const admin = await connexionAnimateur(banc.url)

async function animateur(login: string): Promise<string> {
  const cree = await ecrire(banc.url, '/api/admin/accounts', { login, name: login, slug: `chez-${login}` }, admin)
  const { activation } = (await cree.json()) as { activation: { token: string } }
  return cookieDe(await ecrire(banc.url, '/api/auth/activate', { token: activation.token, password: `${login}-pass-1` }))
}
const voisin = await animateur('voisin')

const lire = async (id: string, c = admin) => (await (await fetch(`${banc.url}/api/quizzes/${id}`, { headers: { Cookie: c } })).json()) as QuizDef
const envoyer = async (dataUrl: string, c = admin) => ((await (await ecrire(banc.url, '/api/images', { dataUrl }, c)).json()) as { url: string }).url
/** Ce que fait `photoEnClair` (EditorApp.tsx:123) : le fichier servi, rendu en clair avec son type. */
const enClair = async (adresse: string): Promise<string | null> => {
  const res = await fetch(`${banc.url}${adresse}`)
  if (!res.ok) return null
  return `data:${res.headers.get('content-type')};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`
}
/** L'empreinte d'une pièce : ses octets, où qu'elle soit servie. */
const octets = async (adresse: string | null | undefined) => (adresse ? ((await enClair(adresse)) ?? 'introuvable') : null)

// ── Le quiz complet ──────────────────────────────────────────────────────

const photo = await envoyer(PNG)
const revelation = await envoyer(PNG2)
const son = await envoyer(MP3)
const q = (x: Partial<QuizQuestionDef>): QuizQuestionDef => ({ ...emptyQuestion(), ...x })
const QUESTIONS: QuizQuestionDef[] = [
  q({ text: 'Qui est ce bébé ?', answers: ['Julie', 'Marc', 'Léa', ''], correct: 2, image: photo, observeSeconds: 7, imageRevelation: revelation, category: 'Personnalités', duration: 30, anecdote: 'Elle avait deux ans.', note: 'Montre-la à Julie', intertitre: 'Manche 2 : les bébés' }),
  q({ text: 'Quel est ce titre ?', answers: ['Macarena', 'Mambo n° 5', '', ''], correct: 1, son, category: 'Musique', ordreFixe: true }),
  q({ text: 'Lesquels sont des fleuves ?', variante: 'plusieurs', answers: ['La Loire', 'Le Rhin', 'Le Léman', 'La Seine'], bonnes: [0, 1, 3], correct: 0, category: 'Géographie' }),
  q({ text: 'Dans l’ordre, du plus ancien :', variante: 'ordre', answers: ['Imprimerie', 'Vapeur', 'Téléphone', 'Internet'], correct: -1 }),
  q({ text: 'Qui s’endormira le premier ?', variante: 'sondage', answers: ['', '', '', ''], correct: -1 }),
  q({ text: 'Altitude de l’Everest ?', kind: 'number', target: 8849, unit: 'm', duration: 45 }),
  q({ text: 'Record de froid ?', kind: 'number', target: -41.5, unit: '°C' }),
  q({ text: 'Poids du gâteau ?', kind: 'number', enDirect: true, target: null, unit: 'g' }),
  q({ text: 'Quel est ce monument ?', answers: ['Big Ben', 'Tour Eiffel', '', ''], correct: 1, photoAttendue: 'tour-eiffel.jpg' }),
  q({ text: 'Trop dure pour ce soir ?', answers: ['a', 'b', '', ''], correct: 0, deCote: true }),
  q({ text: 'Sans bonne réponse ?', answers: ['Oui', 'Non', '', ''], correct: -1 }),
]
const REGLAGES: ReglagesDuQuiz = { melangerReponses: true, melangerQuestions: true, tirage: 6 }
const TITRE = 'Le quiz complet'

const cree = (await (await ecrire(banc.url, '/api/quizzes', { title: TITRE, questions: QUESTIONS, reglages: REGLAGES }, admin)).json()) as QuizDef
const original = await lire(cree.id)

/** Ce qui doit arriver entier, question par question — pièces par leurs octets. */
async function empreinte(quiz: Pick<QuizDef, 'title' | 'questions' | 'reglages'>) {
  return {
    titre: quiz.title,
    reglages: quiz.reglages ?? {},
    questions: await Promise.all(
      quiz.questions.map(async x => {
        const { id: _id, image, imageRevelation, son: s, ...reste } = x
        return { ...reste, image: await octets(image), imageRevelation: await octets(imageRevelation), son: await octets(s) }
      }),
    ),
  }
}
const reference = await empreinte(original)

/** Les champs qui diffèrent, question par question — ou [] si tout est arrivé. */
async function ecarts(arrivee: Pick<QuizDef, 'title' | 'questions' | 'reglages'>): Promise<string[]> {
  const e = await empreinte(arrivee)
  const dits: string[] = []
  if (e.titre !== reference.titre) dits.push(`titre : « ${reference.titre} » → « ${e.titre} »`)
  if (JSON.stringify(e.reglages) !== JSON.stringify(reference.reglages)) dits.push(`réglages : ${JSON.stringify(reference.reglages)} → ${JSON.stringify(e.reglages)}`)
  if (e.questions.length !== reference.questions.length) dits.push(`${reference.questions.length} questions → ${e.questions.length}`)
  reference.questions.forEach((r, i) => {
    const a = e.questions[i] as Record<string, unknown> | undefined
    if (!a) return
    for (const cle of new Set([...Object.keys(r), ...Object.keys(a)])) {
      const avant = JSON.stringify((r as Record<string, unknown>)[cle] ?? null)
      const apres = JSON.stringify(a[cle] ?? null)
      if (avant !== apres) dits.push(`q${i + 1}.${cle} : ${avant.slice(0, 40)} → ${apres.slice(0, 40)}`)
    }
  })
  return dits
}

const tableau: [string, string[]][] = []
after(() => {
  console.log('\n── Le tableau des allers-retours ──')
  for (const [chemin, perdu] of tableau) console.log(`${chemin} : ${perdu.length === 0 ? 'tout passe' : perdu.join(' · ')}`)
})

test('dupliquer', async () => {
  const copie = (await (await ecrire(banc.url, `/api/quizzes/${original.id}/duplicate`, {}, admin)).json()) as QuizDef
  const e = (await ecarts(copie)).filter(x => !x.startsWith('titre'))
  tableau.push(['Dupliquer', e])
  assert.deepEqual(e, [])
})

test('un code de partage, reçu dans un autre espace', async () => {
  const { code } = (await (await ecrire(banc.url, `/api/quizzes/${original.id}/partage`, {}, admin)).json()) as { code: string }
  const recu = (await (await ecrire(banc.url, '/api/partages/recevoir', { code }, voisin)).json()) as QuizDef
  const e = await ecarts(recu)
  tableau.push(['Code de partage', e])
  assert.deepEqual(e, [])
  for (const x of recu.questions) for (const champ of PIECES_DE_QUESTION) if (x[champ]) assert.ok(!original.questions.some(o => o[champ] === x[champ]), 'une pièce à lui')
})

test('le catalogue, copié dans un autre espace', async () => {
  const { id } = (await (await ecrire(banc.url, `/api/quizzes/${original.id}/catalogue`, { description: 'Tout y est.' }, admin)).json()) as { id: string }
  await ecrire(banc.url, `/api/admin/catalogue/${id}`, { statut: 'publie' }, admin)
  const recu = (await (await ecrire(banc.url, `/api/catalogue/${id}`, {}, voisin)).json()) as QuizDef
  const e = (await ecarts(recu)).filter(x => !x.startsWith('titre'))
  tableau.push(['Catalogue', e])
  assert.deepEqual(e, [])
})

const portes = (c: string, titresPris: string[] = []) => ({
  envoyerPhoto: (dataUrl: string) => envoyer(dataUrl, c),
  creer: async (titre: string, questions: Record<string, unknown>[], reglages: ReglagesDuQuiz) =>
    (await (await ecrire(banc.url, '/api/quizzes', { title: titre, questions, reglages }, c)).json()) as QuizDef,
  titresPris,
})

test('exporter un quiz, l’importer dans un autre espace', async () => {
  const fichier = JSON.parse(JSON.stringify(await emporterQuiz(original, enClair)))
  const fait = await importerFichier(fichier, portes(voisin))
  const e = (await ecarts(await lire(fait.quiz[0].id, voisin))).filter(x => !x.startsWith('titre'))
  tableau.push(['Exporter → importer', e])
  assert.deepEqual(e, [])
})

test('exporter toute la bibliothèque, la réimporter', async () => {
  const fichier = JSON.parse(JSON.stringify(await emporterBibliotheque([original], enClair)))
  const fait = await importerFichier(fichier, portes(voisin, [TITRE]))
  const e = (await ecarts(await lire(fait.quiz[0].id, voisin))).filter(x => !x.startsWith('titre'))
  tableau.push(['Toute la bibliothèque', e])
  assert.deepEqual(e, [])
})

test('le brouillon du navigateur, relu', async () => {
  const relu = lireBrouillon(emballerBrouillon(original, original.updatedAt, Date.now()), original.id)!
  const e = await ecarts({ title: relu.title, questions: relu.questions, reglages: relu.reglages })
  tableau.push(['Brouillon', e])
  assert.deepEqual(e, [])
})

test('un export dont une pièce ne se lit plus : la question attend, elle ne se joue pas sans', async () => {
  // `emporterQuiz` : « le quiz part alors sans elle plutôt que de ne pas partir »
  // (shared/echange.ts:67) — mais la question arrive « prête », sans rien qui manque.
  const { toPlayable } = await import('../../../shared/library')
  const fichier = JSON.parse(JSON.stringify(await emporterQuiz(original, async a => (a === photo ? null : enClair(a)))))
  const fait = await importerFichier(fichier, portes(voisin))
  const arrivee = await lire(fait.quiz[0].id, voisin)
  const q1 = arrivee.questions[0]
  tableau.push(['Export, photo illisible', [`q1.image : ${q1.image} · q1 prête : ${toPlayable(q1) !== null}`]])
  assert.equal(toPlayable(q1), null, '« Qui est ce bébé ? » arrive prête, sans son bébé')
})
