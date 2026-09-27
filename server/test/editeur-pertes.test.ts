// Ce que l'éditeur perdait sans le dire.
//
// L'audit du 27 septembre 2026 (mission « bibliothèque », `retours/2026-09-27/`)
// l'a rejoué dans Chromium et par l'API : la cent-unième question et les
// suivantes coupées à l'enregistrement, réponse 200 et brouillon oublié ; une
// photo envoyée pendant qu'on déplaçait sa question tombée sur la voisine ;
// « Garder la mienne », après un conflit, réenregistrant une photo que le
// ménage venait d'effacer ; le brouillon repris qui ne vérifiait que la photo
// de la question — pas celle de la révélation, ni l'extrait d'un blind test.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createClient } from '@libsql/client'
import { connexionAnimateur, creerQuiz, demarrer, ecrire, patienter, qcm } from './banc'
import { brouillonUtile, emballerBrouillon, lireBrouillon, photosAVerifier, piecesPerdues, sansPhotosDisparues } from '../../shared/brouillon'
import { MAX_QUESTIONS, emptyQuestion, type QuizDef, type QuizQuestionDef } from '../../shared/library'

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
/** Quelques octets suffisent : le serveur vérifie le type annoncé, pas le son. */
const MP3 = 'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA'

const banc = await demarrer()
after(() => banc.close())
const cookie = await connexionAnimateur(banc.url)

const lire = async (id: string) => (await (await fetch(`${banc.url}/api/quizzes/${id}`, { headers: { Cookie: cookie } })).json()) as QuizDef
const enregistrer = (id: string, corps: Record<string, unknown>) => ecrire(banc.url, `/api/quizzes/${id}`, corps, cookie, 'PUT')
const envoyer = async (dataUrl: string) => {
  const res = await ecrire(banc.url, '/api/images', { dataUrl }, cookie)
  assert.equal(res.status, 201)
  return ((await res.json()) as { url: string }).url
}
const servie = async (adresse: string) => (await fetch(`${banc.url}${adresse}`)).status

/** La base permanente, pour faire vieillir ce que le ménage regarde. */
async function base(sql: string) {
  const client = createClient({ url: banc.quizDbUrl })
  try {
    await client.execute(sql)
  } finally {
    client.close()
  }
}

const cent20 = () =>
  Array.from({ length: 120 }, (_, i) => ({ ...emptyQuestion(), text: `Question n° ${i + 1} ?`, answers: ['Oui', 'Non', '', ''], correct: 0 }))

// ── 1. Plus de cent questions ─────────────────────────────────────────────

test('« Enregistrer » avec cent vingt questions est refusé en le disant, et rien n’est coupé', async () => {
  const id = await creerQuiz(banc.url, cookie, [qcm('Une ?')], 'Grande banque')
  const ouvert = await lire(id)
  const res = await enregistrer(id, { title: ouvert.title, questions: cent20(), base: ouvert.updatedAt, jeton: 'j-1', essai: 1 })
  assert.equal(res.status, 400)
  assert.match(((await res.json()) as { error: string }).error, new RegExp(`${MAX_QUESTIONS} questions au plus.*120.*retires-en 20`))
  assert.deepEqual((await lire(id)).questions.map(q => q.text), ['Une ?'], 'la version enregistrée n’a pas bougé')
})

test('un fichier importé de cent vingt questions est refusé en le disant, au lieu de perdre les vingt dernières', async () => {
  // Le chemin de « Importer un fichier » : `importerQuiz` → `api.create(titre, questions)`.
  const res = await ecrire(banc.url, '/api/quizzes', { title: 'Importé', questions: cent20() }, cookie)
  assert.equal(res.status, 400)
  assert.match(((await res.json()) as { error: string }).error, /retires-en 20/)
})

test('le brouillon garde toutes ses questions, et n’est pas pris pour la version enregistrée', () => {
  const quiz = { id: 'q', title: 'Grande banque', questions: cent20() }
  const brouillon = lireBrouillon(emballerBrouillon(quiz, 1, 2), 'q')!
  assert.equal(brouillon.questions.length, 120)
  // Le serveur n'aurait gardé que les cent premières : ce brouillon-là n'est pas identique à lui.
  const serveur: QuizDef = { ...quiz, questions: brouillon.questions.slice(0, MAX_QUESTIONS), updatedAt: 1 }
  assert.equal(brouillonUtile(brouillon, serveur), true)
})

// ── 2. « Garder la mienne » après le ménage de l'autre appareil ───────────

test('« Garder la mienne » après un conflit ne cite pas une photo que le ménage a effacée', async () => {
  const photo = await envoyer(PNG)
  const id = await creerQuiz(banc.url, cookie, [{ ...qcm('Qui est-ce ?', ['Mamie', 'Papi']), image: photo }, qcm('Deux ?')], 'Famille')
  const ouvert = await lire(id)
  // Envoyée il y a longtemps : le délai de grâce compté depuis l'envoi est passé.
  await base('UPDATE quiz_images SET created_at = 0')

  // Le téléphone retire la photo et enregistre ; le ménage passe derrière lui.
  const telephone = await enregistrer(id, {
    title: ouvert.title,
    questions: [{ ...ouvert.questions[0], image: null }, ouvert.questions[1]],
    base: ouvert.updatedAt,
    jeton: 'telephone',
    essai: 1,
  })
  assert.equal(telephone.status, 200)
  await patienter(400)
  assert.equal(await servie(photo), 200, 'tout juste retirée, la photo a son délai de grâce')

  // Le portable, parti de la même version, change la question 2 : conflit, puis « Garder la mienne ».
  const mienne = { title: ouvert.title, questions: [ouvert.questions[0], { ...ouvert.questions[1], text: 'Deux, retouchée ?' }] }
  const refus = await enregistrer(id, { ...mienne, base: ouvert.updatedAt, jeton: 'portable-1', essai: 1 })
  assert.equal(refus.status, 409)
  const { conflit } = (await refus.json()) as { conflit: { updatedAt: number } }
  const garde = await enregistrer(id, { ...mienne, base: conflit.updatedAt, jeton: 'portable-2', essai: 1 })
  assert.equal(garde.status, 200)
  assert.equal(((await garde.json()) as QuizDef).questions[0].image, photo)
  await patienter(400)
  assert.equal(await servie(photo), 200, 'la question gardée cite une photo que le serveur sert encore')
})

test('une photo retirée depuis plus d’une heure part toujours au ménage', async () => {
  const photo = await envoyer(PNG)
  const id = await creerQuiz(banc.url, cookie, [{ ...qcm('Où est-ce ?'), image: photo }], 'Vacances')
  const ouvert = await lire(id)
  assert.equal((await enregistrer(id, { title: ouvert.title, questions: [{ ...ouvert.questions[0], image: null }], base: ouvert.updatedAt })).status, 200)
  await patienter(300)
  assert.equal(await servie(photo), 200)
  // Une heure plus tard : le prochain enregistrement de l'espace fait le ménage.
  await base('UPDATE quiz_images SET created_at = 0, orpheline_depuis = 1')
  const suivant = await lire(id)
  assert.equal((await enregistrer(id, { title: 'Vacances d’été', questions: suivant.questions, base: suivant.updatedAt })).status, 200)
  for (let i = 0; i < 20 && (await servie(photo)) === 200; i++) await patienter(100)
  assert.equal(await servie(photo), 404)
})

// ── 3. Le brouillon repris : ses trois pièces ─────────────────────────────

test('le brouillon repris vérifie ses trois pièces, les retire mortes, et dit lesquelles', async () => {
  const id = await creerQuiz(banc.url, cookie, [qcm('Qui est ce bébé ?', ['Julie', 'Marc'])], 'Bébés')
  const serveur = await lire(id)
  // Trois pièces envoyées dans l'éditeur, puis l'onglet fermé sans enregistrer.
  const [photo, revelation, son] = [await envoyer(PNG), await envoyer(PNG), await envoyer(MP3)]
  const q: QuizQuestionDef = { ...serveur.questions[0], image: photo, imageRevelation: revelation, son, observeSeconds: 5 }
  const brouillon = lireBrouillon(emballerBrouillon({ ...serveur, questions: [q] }, serveur.updatedAt, Date.now()), id)!
  assert.deepEqual(photosAVerifier(brouillon, serveur).sort(), [photo, revelation, son].sort())

  // Le lendemain, les trois sont parties au ménage : la reprise les retire toutes.
  const { questions, pieces } = sansPhotosDisparues(brouillon.questions, new Set([revelation, son]))
  assert.deepEqual([questions[0].image, questions[0].imageRevelation, questions[0].son], [photo, null, null])
  assert.equal(questions[0].observeSeconds, 5, 'la photo de la question reste : son observation aussi')
  assert.deepEqual(pieces, { [q.id!]: ['imageRevelation', 'son'] })
  assert.equal(
    piecesPerdues(pieces[q.id!]),
    'La photo de la révélation et l’extrait de cette question n’existent plus sur le serveur : ajoute-les de nouveau.',
  )
  assert.equal(piecesPerdues(['image']), 'La photo de cette question n’existe plus sur le serveur : ajoute-la de nouveau.')
})

// ── 4. Une pièce arrive après un déplacement ──────────────────────────────

test('une photo envoyée pendant qu’on déplace sa question rejoint sa question, pas la voisine', () => {
  // La carte envoyait la pièce par sa place au moment du clic : montée,
  // insérée ou supprimée pendant l'envoi, la question voisine la recevait.
  // Pas de navigateur ici : la mécanique se lit dans l'éditeur.
  const editeur = readFileSync(new URL('../../client/src/views/EditorApp.tsx', import.meta.url), 'utf8')
  assert.match(editeur, /onChangePiece=\{fn => actions\.changerParId\(reste\.question\.id, fn\)\}/)
  const envois = [...editeur.matchAll(/const \{ url \} = await api\.uploadImage\([^)]*\)\)?\s*\n\s*(?:\/\/[^\n]*\n\s*)*(\w+)\(/g)].map(m => m[1])
  assert.deepEqual(envois, ['onChangePiece', 'onChangePiece'], 'la photo et l’extrait arrivent par l’identifiant de leur question')
  assert.match(editeur, /item\.id === id \? fn\(item\) : item/)
})
