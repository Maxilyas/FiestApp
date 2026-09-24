// Analyse du paquet : pour chaque route, les morceaux chargés (graphe d'import
// statique + lazy de la route) et leurs tailles brutes / gzip / brotli ; puis,
// pour les plus gros morceaux, la part de chaque module source (sourcemaps).
// Usage : node paquet.mjs <dist construit avec --sourcemap>
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const dist = process.argv[2]
const A = path.join(dist, 'assets')
const taille = f => {
  const b = fs.readFileSync(path.join(A, f))
  return { brut: b.length, gz: zlib.gzipSync(b, { level: 6 }).length, br: zlib.brotliCompressSync(b).length }
}
// Imports statiques d'un morceau (les `import … from "./x.js"` en tête)
const statiques = f => {
  const src = fs.readFileSync(path.join(A, f), 'utf8')
  return [...src.matchAll(/(?:import|from)\s*["']\.\/([\w.-]+\.js)["']/g)].map(m => m[1])
}
const fermeture = (depart) => {
  const vu = new Set(); const pile = [...depart]
  while (pile.length) { const f = pile.pop(); if (vu.has(f)) continue; vu.add(f); pile.push(...statiques(f)) }
  return vu
}
const fichiers = fs.readdirSync(A)
const entree = fichiers.find(f => /^index-.*\.js$/.test(f))
const css = fichiers.filter(f => f.endsWith('.css'))
const vue = n => fichiers.find(f => f.startsWith(n + '-') && f.endsWith('.js'))
const routes = {
  '/<espace> (invité)': 'PlayerApp', '/ et /profil': 'ProfilApp', '/host': 'HostApp', '/edit': 'EditorApp',
  '/<espace>/souvenir': 'RecapApp', '/<espace>/bilan': 'BilanApp', '/<espace>/soirees': 'ArchivesApp',
}
const base = fermeture([entree])
const somme = set => [...set].map(taille).reduce((a, t) => ({ brut: a.brut + t.brut, gz: a.gz + t.gz, br: a.br + t.br }), { brut: 0, gz: 0, br: 0 })
const k = n => (n / 1024).toFixed(1)
console.log('## Par route (JS, sans CSS ni polices)\n')
console.log('| Route | Morceaux JS | brut Ko | gzip Ko | brotli Ko |')
for (const [r, v] of Object.entries(routes)) {
  const set = fermeture([entree, vue(v)])
  const s = somme(set)
  console.log(`| ${r} | ${set.size} | ${k(s.brut)} | ${k(s.gz)} | ${k(s.br)} |  ${[...set].filter(x => !base.has(x)).join(' ')}`)
}
const c = css.map(taille)[0]
console.log(`\nCSS ${css}: ${k(c.brut)} / ${k(c.gz)} / ${k(c.br)} Ko`)
console.log(`Entrée seule: ${k(somme(base).brut)} / ${k(somme(base).gz)} / ${k(somme(base).br)} Ko (${[...base].join(' ')})`)

console.log('\n## Composition des gros morceaux (octets de sortie par source, approx.)\n')
for (const f of fichiers.filter(f => f.endsWith('.js') && taille(f).brut > 30000)) {
  const map = JSON.parse(fs.readFileSync(path.join(A, f + '.map'), 'utf8'))
  const code = fs.readFileSync(path.join(A, f), 'utf8').split('\n')
  // Décodage VLQ minimal des mappings : attribue chaque segment de sortie à sa source.
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const parts = {}; let src = 0
  map.mappings.split(';').forEach((ligne, li) => {
    let col = 0; const segs = []
    for (const seg of ligne.split(',')) {
      if (!seg) continue
      const vals = []; let v = 0, sh = 0
      for (const ch of seg) { let d = B64.indexOf(ch); const cont = d & 32; d &= 31; v += d << sh; if (cont) sh += 5; else { vals.push(v & 1 ? -(v >> 1) : v >> 1); v = 0; sh = 0 } }
      col += vals[0]; if (vals.length > 1) src += vals[1]
      segs.push([col, vals.length > 1 ? src : null])
    }
    segs.forEach(([c0, s], i) => { const c1 = i + 1 < segs.length ? segs[i + 1][0] : (code[li] || '').length; if (s != null) { const n = map.sources[s].replace(/.*node_modules\//, 'nm:').replace(/^(\.\.\/)+/, ''); parts[n] = (parts[n] || 0) + (c1 - c0) } })
  })
  const grp = {}
  for (const [n, o] of Object.entries(parts)) { const g = n.startsWith('nm:') ? n.split('/').slice(0, n.startsWith('nm:@') ? 2 : 1).join('/') : n; grp[g] = (grp[g] || 0) + o }
  console.log(`### ${f} (${k(taille(f).brut)} Ko)`)
  Object.entries(grp).sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([n, o]) => console.log(`  ${k(o).padStart(6)} Ko  ${n}`))
}
