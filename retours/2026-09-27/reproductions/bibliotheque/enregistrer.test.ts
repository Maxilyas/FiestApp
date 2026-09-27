// Mission « bibliothèque » — ce que l'enregistrement et le ménage des photos
// font perdre à l'animateur. Chaque épreuve décrit le comportement voulu :
// elle échoue sur le code d'aujourd'hui, et passera le jour où c'est corrigé.
//
//   cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/bibliotheque/enregistrer.test.ts
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@libsql/client'
import { connexionAnimateur, cookieDe, creerQuiz, demarrer, ecrire, patienter, qcm } from '../../../server/test/banc'
import { emballerBrouillon, lireBrouillon, photosAVerifier } from '../../../shared/brouillon'
import { MAX_QUESTIONS, emptyQuestion, type QuizDef, type QuizQuestionDef } from '../../../shared/library'

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
/** Quelques octets suffisent : le serveur vérifie le type annoncé, pas le son. */
const MP3 = 'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA'

const banc = await demarrer()
after(() => banc.close())
const cookie = await connexionAnimateur(banc.url)

const lire = async (id: string) => (await (await fetch(`${banc.url}/api/quizzes/${id}`, { headers: { Cookie: cookie } })).json()) as QuizDef
const enregistrer = (id: string, corps: Record<string, unknown>, c = cookie) => ecrire(banc.url, `/api/quizzes/${id}`, corps, c, 'PUT')
const envoyer = async (dataUrl: string) => {
  const res = await ecrire(banc.url, '/api/images', { dataUrl }, cookie)
  assert.equal(res.status, 201)
  return ((await res.json()) as { url: string }).url
}
const servie = async (adresse: string) => (await fetch(`${banc.url}${adresse}`)).status

/** Fait vieillir toutes les photos d'une heure et plus : le délai de grâce du ménage est passé. */
async function vieillirLesPhotos() {
  const base = createClient({ url: banc.quizDbUrl })
  try {
    await base.execute('UPDATE quiz_images SET created_at = 0')
  } finally {
    base.close()
  }
}

// ── 1. Plus de cent questions ────────────────────────────────────────────
//
// L'éditeur n'a aucune borne au nombre de questions (« Ajouter une
// question », « Coller une liste », « Dupliquer » : EditorApp.tsx:1816-1824,
// :1857-1865, :1385-1393) ; le serveur coupe à MAX_QUESTIONS en silence
// (`normalizeQuestions`, shared/library.ts:785), répond 200, et l'éditeur
// remplace ses questions par celles de la réponse (`poser(saved)`,
// EditorApp.tsx:1435) puis oublie le brouillon : la 101ᵉ et les suivantes
// disparaissent sans un mot.

const cent20 = () =>
  Array.from({ length: 120 }, (_, i) => ({ ...emptyQuestion(), text: `Question n° ${i + 1} ?`, answers: ['Oui', 'Non', '', ''], correct: 0 }))

test('« Enregistrer » avec 120 questions : refusé en le disant, jamais coupé en silence', async () => {
  const id = await creerQuiz(banc.url, cookie, [qcm('Une ?')], 'Grande banque')
  const ouvert = await lire(id)
  const res = await enregistrer(id, { title: ouvert.title, questions: cent20(), base: ouvert.updatedAt, jeton: 'j-1', essai: 1 })
  const corps = (await res.json()) as QuizDef & { error?: string }
  const gardees = res.status === 200 ? corps.questions.length : null
  assert.ok(
    res.status === 400 || gardees === 120,
    `statut ${res.status}, questions gardées : ${gardees} sur 120 — la dernière gardée : « ${corps.questions?.at(-1)?.text} »`,
  )
})

test('un fichier importé de 120 questions ne perd pas les vingt dernières sans le dire', async () => {
  // Le chemin de « Importer un fichier » : `importerQuiz` → `api.create(titre, questions)`.
  const res = await ecrire(banc.url, '/api/quizzes', { title: 'Importé', questions: cent20() }, cookie)
  const corps = (await res.json()) as QuizDef
  assert.ok(res.status === 400 || corps.questions.length === 120, `statut ${res.status}, ${corps.questions?.length} questions sur 120 (MAX_QUESTIONS = ${MAX_QUESTIONS})`)
})

test('le brouillon relu garde toutes ses questions', () => {
  const brouillon = lireBrouillon(emballerBrouillon({ id: 'q', title: 'Grande banque', questions: cent20() }, 1, 2), 'q')!
  assert.equal(brouillon.questions.length, 120, `le brouillon relu n’en rend que ${brouillon.questions.length}`)
})

// ── 2. « Garder la mienne » après le ménage de l'autre appareil ───────────
//
// Le téléphone retire la photo de la question 1 et enregistre : le ménage
// part aussitôt (api.ts:263) et efface la photo, envoyée il y a plus d'une
// heure et que plus rien ne cite. Le portable, parti de la même version,
// reçoit 409 ; « Garder la mienne » (EditorApp.tsx:1699) réenregistre sa
// version, qui cite la photo effacée. Rien ne le vérifie ici (la reprise du
// brouillon, elle, vérifie : EditorApp.tsx:1515) — la question est « prête »,
// et la photo manque en pleine soirée.

test('« Garder la mienne » après un conflit ne garde pas une photo que le ménage a effacée', async () => {
  const photo = await envoyer(PNG)
  const id = await creerQuiz(banc.url, cookie, [{ ...qcm('Qui est-ce ?', ['Mamie', 'Papi']), image: photo }, qcm('Deux ?')], 'Famille')
  const ouvert = await lire(id)
  await vieillirLesPhotos()

  // Le téléphone retire la photo et enregistre.
  const telephone = await enregistrer(id, {
    title: ouvert.title,
    questions: [{ ...ouvert.questions[0], image: null }, ouvert.questions[1]],
    base: ouvert.updatedAt,
    jeton: 'telephone',
    essai: 1,
  })
  assert.equal(telephone.status, 200)
  await patienter(400)
  const apresMenage = await servie(photo)

  // Le portable, parti de la même version, change la question 2 : conflit.
  const mienne = { title: ouvert.title, questions: [ouvert.questions[0], { ...ouvert.questions[1], text: 'Deux, retouchée ?' }] }
  const refus = await enregistrer(id, { ...mienne, base: ouvert.updatedAt, jeton: 'portable-1', essai: 1 })
  assert.equal(refus.status, 409)
  const { conflit } = (await refus.json()) as { conflit: { updatedAt: number } }
  // « Garder la mienne » : la même version, repartie de celle du téléphone.
  const garde = await enregistrer(id, { ...mienne, base: conflit.updatedAt, jeton: 'portable-2', essai: 1 })
  assert.equal(garde.status, 200)
  const gardee = (await garde.json()) as QuizDef
  assert.equal(gardee.questions[0].image, photo, 'la version gardée cite la photo')
  assert.equal(
    await servie(photo),
    200,
    `la question 1 est « prête » et cite une photo que le serveur ne sert plus (après le ménage du téléphone : ${apresMenage})`,
  )
})

// ── 3. Le brouillon repris : trois pièces, une seule vérifiée ────────────
//
// `photosAVerifier` et `sansPhotosDisparues` (shared/brouillon.ts:98, :108)
// ne regardent que `image`. La photo de la révélation et l'extrait d'un
// blind test envoyés puis jamais enregistrés partent au ménage comme elle —
// `photosCitees` lit toute adresse /media/image/… — mais reviennent tels
// quels à la reprise : la révélation montre une image cassée, le blind test
// se joue muet. Piège du CLAUDE.md : « Une question a trois pièces à part ».

test('le brouillon repris vérifie ses trois pièces : la photo, celle de la révélation, l’extrait', async () => {
  const id = await creerQuiz(banc.url, cookie, [qcm('Qui est ce bébé ?', ['Julie', 'Marc'])], 'Bébés')
  const serveur = await lire(id)
  // Dans l'éditeur, trois pièces envoyées… puis l'onglet fermé sans enregistrer.
  const [photo, revelation, son] = [await envoyer(PNG), await envoyer(PNG), await envoyer(MP3)]
  const q: QuizQuestionDef = { ...serveur.questions[0], image: photo, imageRevelation: revelation, son }
  const brouillon = lireBrouillon(emballerBrouillon({ ...serveur, questions: [q] }, serveur.updatedAt, Date.now()), id)!

  // Le lendemain : n'importe quel enregistrement de l'espace passe le ménage.
  await vieillirLesPhotos()
  const autre = await creerQuiz(banc.url, cookie, [qcm('Autre ?')], 'Autre')
  const a = await lire(autre)
  assert.equal((await enregistrer(autre, { title: a.title, questions: a.questions, base: a.updatedAt })).status, 200)
  await patienter(400)
  assert.deepEqual([await servie(photo), await servie(revelation), await servie(son)], [404, 404, 404], 'les trois sont parties au ménage')

  // La reprise ne vérifie que la première.
  assert.deepEqual(
    photosAVerifier(brouillon, serveur).sort(),
    [photo, revelation, son].sort(),
    'la photo de la révélation et l’extrait reviendraient tels quels, morts',
  )
})

// ── 4. Le catalogue : une nouvelle version publiée, l'ancienne reste ─────
//
// core/partages.ts:162 : « une copie déjà publiée reste en ligne jusqu'à ce
// que l'administrateur publie la nouvelle ». `changerStatut` ne touche que
// l'entrée publiée : l'ancienne reste « publie », et « Partir d'un modèle »
// montre le même quiz deux fois — l'ancienne version d'abord trouvée.

async function animateur(admin: string, login: string, name: string): Promise<string> {
  const cree = await ecrire(banc.url, '/api/admin/accounts', { login, name, slug: `chez-${login}` }, admin)
  assert.equal(cree.status, 201)
  const { activation } = (await cree.json()) as { activation: { token: string } }
  return cookieDe(await ecrire(banc.url, '/api/auth/activate', { token: activation.token, password: `${login}-pass-1` }))
}

test('publier la nouvelle version d’un quiz au catalogue retire l’ancienne', async () => {
  const nadia = await animateur(cookie, 'nadia', 'Nadia')
  const id = await creerQuiz(banc.url, nadia, [qcm('Capitale du Canada ?', ['Ottawa', 'Toronto'])], 'Géo facile')
  const v1 = (await (await ecrire(banc.url, `/api/quizzes/${id}/catalogue`, { description: 'Pour s’échauffer.' }, nadia)).json()) as { id: string }
  assert.equal((await ecrire(banc.url, `/api/admin/catalogue/${v1.id}`, { statut: 'publie' }, cookie)).status, 200)

  // Nadia corrige une faute, et propose sa nouvelle version.
  const q = (await (await fetch(`${banc.url}/api/quizzes/${id}`, { headers: { Cookie: nadia } })).json()) as QuizDef
  await enregistrer(id, { title: q.title, questions: [...q.questions, qcm('Plus long fleuve de France ?', ['La Loire', 'La Seine'])] }, nadia)
  const v2 = (await (await ecrire(banc.url, `/api/quizzes/${id}/catalogue`, { description: 'Pour s’échauffer, corrigé.' }, nadia)).json()) as { id: string }
  assert.notEqual(v2.id, v1.id, 'une nouvelle entrée : l’ancienne est publiée')
  assert.equal((await ecrire(banc.url, `/api/admin/catalogue/${v2.id}`, { statut: 'publie' }, cookie)).status, 200)

  const publies = (await (await fetch(`${banc.url}/api/catalogue`, { headers: { Cookie: cookie } })).json()) as { titre: string; questionCount: number }[]
  assert.deepEqual(
    publies.map(e => [e.titre, e.questionCount]),
    [['Géo facile', 2]],
    `« Partir d’un modèle » montre : ${JSON.stringify(publies.map(e => [e.titre, e.questionCount]))}`,
  )
})
