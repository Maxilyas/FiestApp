// Lit les classements à l'aveugle d'agents (`classer.consigne.md`) : l'accord de chaque agent sur ses étalons, puis, selon le cas,
//  - `faits` : les faits candidats classés (`faits-classes.json`, par catégorie : combien « chacun ») ;
//  - `questions --verser` : les questions neuves, versées à `../../../2026-11-09/vivier-du-filet.json` (une ligne par question,
//    triées par identifiant, comme les autres).
//
//   cd server && ICI=/chemin node --import tsx ../retours/2026-11-12/reproductions/acte-i/lire-le-classement.mts faits <faits-N-lu.json…>
//   cd server && ICI=/chemin node --import tsx ../retours/2026-11-12/reproductions/acte-i/lire-le-classement.mts questions [--verser] <classer-N-lu.json…>
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const NEUF = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../2026-11-09')
const SORTIE = process.env.ICI ?? '/home/user/FiestApp/.lots-campagne/notation'
const [genre, ...reste] = process.argv.slice(2)
const PREFIXE = process.env.PREFIXE ?? 'faits'
const verser = reste.includes('--verser')
const fichiers = reste.filter(a => !a.startsWith('--'))
const attendu = JSON.parse(fs.readFileSync(path.join(SORTIE, genre === 'faits' ? `${PREFIXE}-etalons.json` : 'classer-etalons.json'), 'utf8')) as Record<string, { chacun: boolean; ancrage: string; calcul: boolean }>
const lus = new Map<string, any>()
for (const f of fichiers) {
  const rows = JSON.parse(fs.readFileSync(f, 'utf8')) as any[]
  const et = rows.filter(r => attendu[r.id])
  const accord = et.filter(r => !!r.chacun === attendu[r.id].chacun).length
  const dedans = et.filter(r => r.chacun && attendu[r.id].chacun).length
  console.log(`${path.basename(f)} : ${rows.length} lignes, ${rows.length - et.length} neuves ; étalons : accord ${accord}/${et.length} sur « chacun » (${dedans}/${et.filter(r => attendu[r.id].chacun).length} des vrais « chacun » retrouvés, ${et.filter(r => r.chacun && !attendu[r.id].chacun).length} à tort), ancrage ${et.filter(r => r.ancrage === attendu[r.id].ancrage).length}/${et.length}, calcul ${et.filter(r => !!r.calcul === attendu[r.id].calcul).length}/${et.length}`)
  for (const r of rows) if (!attendu[r.id]) lus.set(r.id, r)
}
const neuves = [...lus.values()]
console.log(`${neuves.length} lignes neuves : ${neuves.filter(r => r.chacun).length} « chacun », ${neuves.filter(r => r.calcul).length} qui se calculent`)
if (genre === 'faits') {
  const faits = JSON.parse(fs.readFileSync(path.join(SORTIE, `${PREFIXE}.json`), 'utf8')) as any[]
  const par: Record<string, { n: number; chacun: number }> = {}
  const classes: any[] = []
  for (const f of faits) {
    const r = lus.get(f.id)
    if (!r) continue
    const x = (par[f.categorie] ??= { n: 0, chacun: 0 }); x.n++
    if (r.chacun && !r.calcul) { x.chacun++; classes.push({ ...f, source: r.source ?? f.source, pourquoi: r.pourquoi }) }
  }
  fs.writeFileSync(path.join(SORTIE, `${PREFIXE}-chacun.json`), JSON.stringify(classes, null, 1))
  for (const [c, x] of Object.entries(par).sort()) console.log(`  ${c.padEnd(20)} ${String(x.chacun).padStart(3)} « chacun » sur ${x.n}`)
  console.log(`→ ${PREFIXE}-chacun.json : ${classes.length}`)
} else if (verser) {
  const chemin = path.join(NEUF, 'vivier-du-filet.json')
  const rows = JSON.parse(fs.readFileSync(chemin, 'utf8')) as any[]
  const dejas = new Set(rows.map(r => r.id))
  let ajoutees = 0
  for (const r of neuves) {
    if (dejas.has(r.id)) continue
    const ligne: any = { id: r.id, chacun: !!r.chacun, ancrage: r.ancrage, calcul: !!r.calcul }
    if (r.chacun) { ligne.source = r.source; ligne.pourquoi = r.pourquoi }
    rows.push(ligne); ajoutees++
  }
  rows.sort((a, b) => (a.id < b.id ? -1 : 1))
  fs.writeFileSync(chemin, `[\n${rows.map(r => JSON.stringify(r)).join(',\n')}\n]\n`)
  console.log(`${ajoutees} lignes versées à vivier-du-filet.json (${rows.length} en tout)`)
}
