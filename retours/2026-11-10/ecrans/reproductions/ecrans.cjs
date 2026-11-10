// Le relevé, écran par écran : les photos de téléphone regroupées par page (adresse, classe, titre), ce dont elle défile au moins et au plus.
const fs = require('fs'), path = require('path')
const dir = path.resolve(process.argv[2] ?? 'export/releve/sonde')
const sauf = (process.argv[3] ?? '').split(',').filter(Boolean)
for (const f of fs.readdirSync(dir).sort()) {
  const nom = f.replace('.jsonl', '')
  if (sauf.includes(nom)) continue
  const lignes = fs.readFileSync(path.join(dir, f), 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(l => !l.erreur && l.w <= 430)
  const groupes = new Map()
  for (const l of lignes) {
    const url = l.url.replace(/[0-9a-f]{8}-[0-9a-f-]{20,}/g, '<id>').replace(/\/s\/[^/]+/, '/s/<salon>').slice(0, 40)
    const cle = [url, l.classe.replace('player-shell', '').trim().slice(0, 26), l.titre.slice(0, 34), l.voile ? 'feuille' : 'page', l.h].join(' | ')
    const g = groupes.get(cle) ?? { n: 0, min: Infinity, max: 0, photos: [], dernier: '' }
    const d = l.voile ? l.feuille : l.depasse
    g.n++; g.min = Math.min(g.min, d)
    if (d >= g.max) { g.max = d; g.dernier = l.dernier.slice(0, 44) }
    if (g.photos.length < 2) g.photos.push(String(l.photo).replace('.png', ''))
    groupes.set(cle, g)
  }
  console.log(`\n== ${nom}`)
  for (const [cle, g] of groupes) console.log(`  ${String(g.min).padStart(4)}–${String(g.max).padEnd(5)} ×${String(g.n).padEnd(2)} ${cle}  [${g.photos.join(', ')}]  ↓ ${g.dernier}`)
}
