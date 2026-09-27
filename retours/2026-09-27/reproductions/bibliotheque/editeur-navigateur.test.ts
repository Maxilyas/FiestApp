// Mission « bibliothèque » — deux pertes rejouées dans un vrai Chromium, sur
// l'éditeur construit (`cd client && npx vite build --outDir
// ../export/evaluations/bibliotheque/dist`).
//
//   cd server && PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers nice -n 10 node --import tsx \
//     --test --test-timeout=120000 ../export/evaluations/bibliotheque/editeur-navigateur.test.ts
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { connexionAnimateur, creerQuiz, demarrer, qcm, type Banc } from '../../../server/test/banc'
import type { QuizDef } from '../../../shared/library'

const ici = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const { chromium } = require('/opt/node22/lib/node_modules/playwright') as typeof import('playwright')

let banc: Banc
let cookie: string
let navigateur: Awaited<ReturnType<typeof chromium.launch>>
const PHOTO = path.join(ici, 'photo-de-test.png')

before(async () => {
  writeFileSync(
    PHOTO,
    Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'),
  )
  banc = await demarrer({ clientDist: path.join(ici, 'dist') })
  cookie = await connexionAnimateur(banc.url)
  navigateur = await chromium.launch()
})
after(async () => {
  await navigateur?.close()
  await banc?.close()
})

async function page(largeur = 1366, hauteur = 768) {
  const contexte = await navigateur.newContext({ viewport: { width: largeur, height: hauteur } })
  const [nom, valeur] = cookie.split('=')
  await contexte.addCookies([{ name: nom, value: valeur, url: banc.url }])
  return contexte.newPage()
}
const lire = async (id: string) => (await (await fetch(`${banc.url}/api/quizzes/${id}`, { headers: { Cookie: cookie } })).json()) as QuizDef

// ── 1. La photo rejoint la question qui est à sa place, pas la sienne ────
//
// `pickImage` (EditorApp.tsx:2794) attend l'envoi, puis appelle `onChange` —
// `fn => actions.changer(index, fn)` (:2641), avec l'index de la carte au
// moment du clic. Une question déplacée, insérée ou supprimée pendant
// l'envoi, et la photo tombe sur la question qui occupe maintenant cette
// place — « photoAttendue » effacée avec. L'envoi dure ce que dure la 4G de
// l'animateur : on le ralentit ici à 3 s.

test('une photo envoyée pendant qu’on déplace sa question reste à sa question', async () => {
  const id = await creerQuiz(banc.url, cookie, [qcm('Première ?'), qcm('Quel est ce monument ?', ['Big Ben', 'Tour Eiffel']), qcm('Troisième ?')], 'Monuments')
  const p = await page()
  await p.route('**/api/images', async route => {
    await new Promise(r => setTimeout(r, 3000))
    await route.continue()
  })
  await p.goto(`${banc.url}/edit?quiz=${id}`)
  const cartes = p.locator('.question-card')
  await cartes.nth(2).waitFor()
  // La photo pour « Quel est ce monument ? » (question 2)…
  await cartes.nth(1).locator('input[type=file][accept="image/*"]').first().setInputFiles(PHOTO)
  await p.getByRole('button', { name: 'Envoi…' }).waitFor()
  // … et, pendant l'envoi, on la monte en tête.
  await p.getByRole('button', { name: 'Monter la question 2' }).click()
  await p.locator('.question-card .thumb').first().waitFor({ timeout: 15000 })
  await p.getByRole('button', { name: 'Enregistrer' }).click()
  await p.getByRole('button', { name: /Enregistré/ }).waitFor()
  const quiz = await lire(id)
  const avecPhoto = quiz.questions.filter(q => q.image).map(q => q.text)
  await p.context().close()
  assert.deepEqual(avecPhoto, ['Quel est ce monument ?'], `la photo est allée à : ${JSON.stringify(avecPhoto)}`)
})

// ── 2. Cent vingt questions collées, cent enregistrées ───────────────────
//
// Ni « Coller une liste » ni « Ajouter une question » ne bornent le nombre
// de questions ; « Enregistrer » répond 200 avec les cent premières, et
// l'éditeur les prend pour lui (`poser(saved)`), brouillon oublié.

test('coller 120 questions puis enregistrer : aucune ne disparaît sans un mot', async () => {
  const id = await creerQuiz(banc.url, cookie, [], 'Grande banque')
  const p = await page()
  await p.goto(`${banc.url}/edit?quiz=${id}`)
  await p.getByRole('button', { name: 'Coller une liste' }).first().click()
  const liste = Array.from({ length: 120 }, (_, i) => `Question n° ${i + 1} ?\n* Oui\nNon`).join('\n\n')
  await p.locator('textarea.import-area').fill(liste)
  const annonce = await p.locator('.import-panel p').filter({ hasText: 'reconnue' }).first().innerText()
  await p.getByRole('button', { name: 'Ajouter au quiz' }).click()
  const avant = await p.locator('.question-card').count()
  await p.getByRole('button', { name: 'Enregistrer' }).click()
  await p.getByRole('button', { name: /Enregistré/ }).waitFor()
  const apres = await p.locator('.question-card').count()
  const alertes = await p.locator('.editor-alerte, .warn').allInnerTexts()
  const enBase = (await lire(id)).questions.length
  await p.context().close()
  assert.equal(
    enBase,
    120,
    `panneau : « ${annonce} » · cartes avant « Enregistrer » : ${avant} · après : ${apres} · en base : ${enBase} · alertes : ${JSON.stringify(alertes)}`,
  )
})
