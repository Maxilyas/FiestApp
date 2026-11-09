// Les repères de la maquette disent-ils l'époque de la réponse ? (`../le-nouveau-filet.md`, § 3.5) On sort `epoques` et
// `reperesDe` du script de la page — leur texte même — et on les joue mille fois par question : un repère tombe-t-il
// aussi souvent dans l'époque de la réponse que dans les trois autres ? À la première version, choisis parmi ceux qui
// s'écartent de la réponse : 0,34 contre 0,56 par manche, pour les années.
//
//   node retours/2026-11-09/reproductions/reperes-par-epoque.cjs
const fs = require('fs')
const path = require('path')
const M = path.join(__dirname, '../maquette-filet')
const src = fs.readFileSync(path.join(M, 'jeu.js'), 'utf8')
global.window = {}
require(path.join(M, 'donnees.js'))
const D = window.FILET
const morceau = nom => { const i = src.indexOf(`  function ${nom}(`); const j = src.indexOf('\n  }\n', i); return src.slice(i, j + 4) }
const code = [
  'const ANNEE = 2026',
  'const melanger = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] } return b }',
  'const auHasard = a => a[Math.floor(Math.random() * a.length)]',
  'const borneDuDemi = k => (k % 2 === 0 ? Math.pow(10, k / 2) : 3 * Math.pow(10, (k - 1) / 2))',
  morceau('epoques'), morceau('reperesDe'),
  'return { epoques, reperesDe }',
].join('\n')
const { epoques, reperesDe } = new Function('D', 'memo', code)(D, { reperes: [] })
for (const genre of ['années', 'grandeurs']) {
  let dansLaBonne = 0, ailleurs = 0, manches = 0
  for (const q of D.questions.filter(q => !q.calcul && (genre === 'années') === q.an)) {
    for (let n = 0; n < 1000; n++) {
      const ep = epoques(q)
      manches++
      for (const r of reperesDe(q, ep)) (ep.bonnes.includes(r.j) ? dansLaBonne++ : ailleurs++)
    }
  }
  console.log(`${genre} : ${manches} manches — ${(dansLaBonne / manches).toFixed(3)} repère par manche dans l'époque de la réponse, ${(ailleurs / manches / 3).toFixed(3)} dans chacune des trois autres`)
}
