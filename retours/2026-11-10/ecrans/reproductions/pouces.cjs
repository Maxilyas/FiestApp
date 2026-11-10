// Le geste sous le pouce, photo par photo : où il est, s'il est collé, s'il se voit en entier.
const fs = require('fs'), path = require('path')
const dir = path.resolve(process.argv[2] ?? 'export/releve/sonde')
let n = 0, caches = 0
for (const f of fs.readdirSync(dir).sort()) {
  const lignes = fs.readFileSync(path.join(dir, f), 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(l => !l.erreur && l.w <= 430 && !l.voile && l.pouces && l.pouces.length)
  if (!lignes.length) continue
  console.log('== ' + f.replace('.jsonl', ''))
  for (const l of lignes) for (const p of l.pouces) {
    n++; if (!p.vu) caches++
    console.log(`  ${p.vu ? 'vu    ' : 'CACHÉ '} ${p.colle ? 'collé ' : 'à sa place'.padEnd(6)} bas ${String(p.bas).padStart(4)}/${l.h} y=${String(l.y).padStart(4)} défile ${String(l.defile).padStart(4)}  ${String(l.photo).padEnd(36)} « ${p.texte} »`)
  }
}
console.log(`${n} gestes sous le pouce photographiés, ${caches} hors de l'écran`)
