// Les deux passes de classement de l'ancrage s'accordent-elles ? (`../le-nouveau-filet.md`, § 4.1) Des agents ont dit,
// pour les 591 questions que le panel a notées et sans voir ni le panel ni les lancers, si chaque Français sait placer
// la réponse à ★★, et si le sujet est français, du monde ou de l'étranger. La première passe, plus large, rangeait sous
// « ailleurs » l'étranger et le savoir de spécialiste (`ancrage-premiere-passe.json`) ; la seconde, aux définitions
// serrées — environ 70 % des adultes à ★★ —, fait foi (`../maquette-filet/ancrage.json`). Sans ce qui se calcule, que le
// nouveau Filet ne pose pas. Le kappa de Cohen dit l'accord au-delà du hasard.
//
//   node retours/2026-11-09/reproductions/accord-des-passes.cjs
const fs = require('fs')
const path = require('path')
const lire = f => JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8'))
const premiere = new Map(lire('ancrage-premiere-passe.json').map(a => [a.id, a]))
const seconde = new Map(lire('../maquette-filet/ancrage.json').map(a => [a.id, a]))
const donnees = fs.readFileSync(path.join(__dirname, '../maquette-filet/donnees.js'), 'utf8')
const calculs = new Set(JSON.parse(donnees.slice(donnees.indexOf('{'), donnees.lastIndexOf('}') + 1)).questions.filter(q => q.calcul).map(q => q.id))
const ids = [...premiere.keys()].filter(id => seconde.has(id) && !calculs.has(id))
function kappa(a, b) {
  const n = a.length, cats = [...new Set([...a, ...b])]
  const accord = a.filter((x, i) => x === b[i]).length / n
  const hasard = cats.reduce((t, c) => t + (a.filter(x => x === c).length / n) * (b.filter(x => x === c).length / n), 0)
  return [accord, (accord - hasard) / (1 - hasard)]
}
const c1 = ids.map(id => premiere.get(id).chacun), c2 = ids.map(id => seconde.get(id).chacun)
const [accord, k] = kappa(c1, c2)
console.log(`${ids.length} questions, sans les ${calculs.size} qui se calculent`)
console.log(`Chaque Français la sait placer : la première passe ${c1.filter(Boolean).length}, la seconde ${c2.filter(Boolean).length}, les deux ${ids.filter(id => premiere.get(id).chacun && seconde.get(id).chacun).length} — accord ${(100 * accord).toFixed(0)} %, kappa ${k.toFixed(2)}`)
// L'« ailleurs » de la première passe mêlait l'étranger et le spécialiste : comparé à l'étranger de la seconde, il la
// contredit par construction ; l'accord se lit sur le français.
const anc = a => (a === 'ailleurs' ? 'etranger' : a)
const a1 = ids.map(id => anc(premiere.get(id).ancrage)), a2 = ids.map(id => seconde.get(id).ancrage)
const [accordA, kA] = kappa(a1, a2)
console.log(`L'ancrage : accord ${(100 * accordA).toFixed(0)} %, kappa ${kA.toFixed(2)}`)
for (const x of ['france', 'monde', 'etranger']) console.log(`  ${x.padEnd(9)} la première ${String(a1.filter(y => y === x).length).padStart(3)}, la seconde ${String(a2.filter(y => y === x).length).padStart(3)}, les deux ${ids.filter((id, i) => a1[i] === x && a2[i] === x).length}`)
const sources = {}
for (const id of ids) { const a = seconde.get(id); if (a.chacun) sources[a.source] = (sources[a.source] ?? 0) + 1 }
console.log(`D'où chaque Français le sait (la seconde passe) : ${Object.entries(sources).sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s} ${n}`).join(' · ')}`)
