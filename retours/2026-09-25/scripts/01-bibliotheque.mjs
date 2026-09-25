// Une bibliothèque d'un an : une quarantaine de quiz, homonymes, copies,
// « Nouveau quiz » abandonnés. Ce que voient « Mes quiz » et le choix du quiz.
import { chromium, nouveauContexte, connecter, api, capture, hauteur, PORTABLE, TELEPHONE } from './outils.mjs'

const CATS = ['Culture générale', 'Histoire', 'Géographie', 'Sciences', 'Cinéma & séries', 'Musique', 'Sport', 'Cuisine']
function questions(n, prefixe, cat) {
  return Array.from({ length: n }, (_, i) => ({
    kind: 'choice',
    text: `${prefixe} — question ${i + 1} ?`,
    answers: ['Réponse A', 'Réponse B', 'Réponse C', 'Réponse D'],
    correct: i % 4,
    target: null,
    unit: '',
    duration: 20,
    image: null,
    observeSeconds: null,
    category: cat,
  }))
}

const TITRES = [
  ['Anniversaire Julie — 30 ans', 22],
  ['Anniversaire Julie — 30 ans (copie)', 22],
  ['Noël 2025 — en famille', 30],
  ['Noël 2025 — les enfants', 12],
  ['Nouvel an 2026 — manche 1', 15],
  ['Nouvel an 2026 — manche 2', 15],
  ['Nouvel an 2026 — manche 3 (finale)', 10],
  ['EVJF Camille', 25],
  ['Mariage Léa & Tom — les mariés', 20],
  ['Séminaire boulot — brise-glace', 12],
  ['Cinéma culte', 30],
  ['Séries', 18],
  ['Géo — capitales du monde', 40],
  ['Géo — drapeaux', 25],
  ['Sport — Coupe du monde', 15],
  ['Harry Potter', 20],
  ['Disney', 20],
  ['Années 80', 20],
  ['Années 90', 20],
  ['Années 2000', 20],
  ['Estimations folles', 10],
  ['Photos de vacances — Bretagne', 14],
  ['Cuisine du monde', 16],
  ['Sciences pour les nuls', 12],
  ['Quiz des enfants (8-12 ans)', 15],
  ['Culture G — niveau difficile', 30],
  ['Culture G — niveau facile', 30],
  ['Musique — qui chante ?', 20],
  ['Animaux', 12],
  ['Histoire de France', 25],
  ['Test', 2],
  ['Nouveau quiz', 0],
  ['Nouveau quiz', 1],
  ['Nouveau quiz', 0],
  ['Quiz sans titre', 3],
  ['Spécial Bretagne (brouillon)', 6],
  ['Anniv papa 60 ans', 18],
  ['Pot de départ Marc', 10],
]

const browser = await chromium.launch()
const ctx = await nouveauContexte(browser, PORTABLE)
const page = await ctx.newPage()
await connecter(page, '/edit')

// La bibliothèque d'origine : les deux quiz livrés.
await capture(page, '01a-mes-quiz-2-quiz-1366')

for (const [i, [titre, n]] of TITRES.entries()) {
  const r = await api(page, '/api/quizzes', 'POST', { title: titre, questions: questions(n, titre, CATS[i % CATS.length]) })
  if (r.status !== 201) console.log('échec', titre, r.status, r.json)
}
await page.reload()
await page.waitForLoadState('networkidle')
const liste = await api(page, '/api/quizzes')
console.log('quiz en bibliothèque :', liste.json.length)
console.log('hauteur de Mes quiz (1366) :', await hauteur(page), 'px, soit', ((await hauteur(page)) / 768).toFixed(1), 'écrans')
await capture(page, '01b-mes-quiz-40-quiz-1366')
await capture(page, '01c-mes-quiz-40-quiz-1366-page-entiere', true)
// Combien de boutons dans la page ?
const boutons = await page.locator('button:visible, a.btn:visible').count()
console.log('boutons visibles sur Mes quiz :', boutons)

// Au téléphone.
const ctxTel = await nouveauContexte(browser, TELEPHONE, true)
const tel = await ctxTel.newPage()
await connecter(tel, '/edit')
console.log('hauteur de Mes quiz (360) :', await hauteur(tel), 'px, soit', ((await hauteur(tel)) / 640).toFixed(1), 'écrans')
await capture(tel, '01d-mes-quiz-40-quiz-360')
// L'en-tête seul, au téléphone : combien d'écrans avant le premier quiz ?
const premier = await tel.locator('.quiz-row').first().boundingBox()
console.log('premier quiz, au téléphone, à y =', premier?.y)

await browser.close()
