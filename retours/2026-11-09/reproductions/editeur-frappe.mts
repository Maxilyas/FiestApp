// Reproduction de la tablée du 9 novembre 2026 : des lettres perdues en
// tapant dans l'éditeur au téléphone, avec « Minified React error #185 ».
// Verdict : à 0 ms entre deux touches, des lettres tombent et React lève
// trois fois #185 ; à 10, 25, 40, 60 et 150 ms, rien. Pas un bug pour un
// doigt — mais une frappe déclenche une cascade de rendus dans l'éditeur.
// Depuis server/, client construit : node --import tsx <ce fichier> [délai entre touches, ms]
import os from 'node:os'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { connexionAnimateur, creerQuiz, demarrer, qcm } from '../../../server/test/banc.ts'

const { chromium } = createRequire(import.meta.url)('playwright')
const sortie = os.tmpdir()
const delai = Number(process.argv[2] ?? 0)

const banc = await demarrer({ clientDist: fileURLToPath(new URL('../../../client/dist', import.meta.url)) })
const navigateur = await chromium.launch()
try {
  const cookie = await connexionAnimateur(banc.url)
  await creerQuiz(banc.url, cookie, [qcm('Une ?'), qcm('Deux ?')], 'Spécial Sam')
  const [nom, ...valeur] = cookie.split('=')
  const contexte = await navigateur.newContext({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true })
  await contexte.addCookies([{ name: nom, value: valeur.join('='), url: banc.url }])
  const page = await contexte.newPage()
  const erreurs: string[] = []
  page.on('pageerror', (e: Error) => erreurs.push(`[exception] ${e.message.slice(0, 160)}`))
  page.on('console', (m: any) => m.type() === 'error' && erreurs.push(`[console] ${m.text().slice(0, 160)}`))
  await page.goto(`${banc.url}/edit`)
  await page.waitForTimeout(1500)
  const dire = async (quoi: string) => console.log(`— ${quoi} :`, (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 300))
  const champ = page.getByRole('textbox', { name: 'Intitulé de la question 1' })
  if (!(await champ.count())) {
    await page.getByText('Spécial Sam').first().click()
    await page.waitForTimeout(800)
  }
  if (!(await champ.count())) {
    const modifier = page.getByRole('button', { name: /Modifier les questions/ }).or(page.getByRole('link', { name: /Modifier les questions/ }))
    if (await modifier.count()) await modifier.first().click()
    await page.waitForTimeout(800)
  }
  if (!(await champ.count())) {
    await dire('pas de champ')
    process.exitCode = 2
  } else {
    const phrases = [
      'Un soir, Sam a confondu deux ingrédients dans son tiramisu : du sel à la place du sucre. Qui a fini son assiette sans rien dire ?',
      'Pour les 60 ans de maman, elle a tout mangé sans rien dire, et elle a même repris une part de son assiette pour faire plaisir.',
    ]
    for (const [i, phrase] of phrases.entries()) {
      const c = page.getByRole('textbox', { name: `Intitulé de la question ${i + 1}` })
      await c.tap()
      await c.fill('')
      await c.pressSequentially(phrase, { delay: delai })
      await page.waitForTimeout(400)
      const lu = await c.inputValue()
      console.log(`question ${i + 1} : ${lu === phrase ? 'entière' : `ALTÉRÉE — « ${lu} »`}`)
    }
    const anecdote = page.getByRole('textbox', { name: /saviez-vous|Anecdote/i })
    console.log('champs « Le saviez-vous » :', await anecdote.count())
    console.log(`erreurs (${erreurs.length}) :`, erreurs.slice(0, 6).join(' | ') || 'aucune')
    await page.screenshot({ path: `${sortie}/editeur-frappe.png` })
  }
} finally {
  await navigateur.close()
  await banc.close()
}
