// Un ami reçoit son compte : sa bibliothèque vide, et le quiz qu'Antoine lui
// passe (export → fichier → import), au portable puis au téléphone.
import { existsSync } from 'node:fs'
import { chromium, nouveauContexte, connecter, api, capture, PORTABLE, TELEPHONE, SCR, BASE } from './outils.mjs'

const browser = await chromium.launch()
const admin = await (await nouveauContexte(browser, PORTABLE, false)).newPage()
await connecter(admin, '/edit')
let bob = await api(admin, '/api/admin/accounts', 'POST', { login: 'bob', name: 'Bob', slug: 'chez-bob' })
if (bob.status !== 201) console.log('compte :', bob.status, JSON.stringify(bob.json))
const jeton = bob.json?.activation?.token
// Activation de Bob, dans son propre navigateur.
const ctxBob = await nouveauContexte(browser, PORTABLE)
const pBob = await ctxBob.newPage()
await pBob.goto(BASE + '/edit')
if (jeton) {
  const r = await api(pBob, '/api/auth/activate', 'POST', { token: jeton, password: 'motdepasse-bob-123' })
  console.log('activation de Bob :', r.status)
}
await pBob.goto(BASE + '/edit')
await pBob.waitForLoadState('networkidle')
await pBob.waitForTimeout(600)
await capture(pBob, '06a-bob-bibliotheque-vide-1366')

// Antoine exporte « Soirée années 90 ».
const ligne = admin.locator('.quiz-row').filter({ hasText: 'Soirée années 90' })
const [telechargement] = await Promise.all([
  admin.waitForEvent('download'),
  ligne.getByRole('button', { name: /Exporter/ }).click(),
])
const fichier = `${SCR}/annees-90.quiz.json`
await telechargement.saveAs(fichier)
await admin.waitForTimeout(400)
await capture(admin, '06b-export-message')
console.log('fichier exporté :', existsSync(fichier), telechargement.suggestedFilename())

// Bob l'importe.
await pBob.locator('input[type="file"][accept*="json"]').setInputFiles(fichier)
await pBob.waitForTimeout(2500)
await capture(pBob, '06c-bob-apres-import')
const listeBob = (await api(pBob, '/api/quizzes')).json
console.log('bibliothèque de Bob :', listeBob.map(q => `${q.title} (${q.readyCount}/${q.questionCount})`).join(' · '))

// Au téléphone, la bibliothèque vide d'un autre ami.
let zoe = await api(admin, '/api/admin/accounts', 'POST', { login: 'zoe', name: 'Zoé', slug: 'chez-zoe' })
const ctxZoe = await nouveauContexte(browser, TELEPHONE, true)
const pZoe = await ctxZoe.newPage()
await pZoe.goto(BASE + '/edit')
await api(pZoe, '/api/auth/activate', 'POST', { token: zoe.json.activation.token, password: 'motdepasse-zoe-123' })
await pZoe.goto(BASE + '/edit')
await pZoe.waitForLoadState('networkidle')
await pZoe.waitForTimeout(600)
await capture(pZoe, '06d-zoe-bibliotheque-vide-360')
await capture(pZoe, '06e-zoe-bibliotheque-vide-360-entiere', true)
await browser.close()
