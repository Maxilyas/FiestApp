// Lit un ou plusieurs mesures.json (soiree.ts) et rend les tableaux du
// rapport, par appareil et par moment de la soirée.
//
//   node analyse.mjs export/evaluations/perf-rendu/anonyme-1 [autre-run…]
//
// Les métriques CDP sont cumulées : on travaille sur les écarts d'une
// seconde à la suivante. Les secondes d'un ramassage forcé (gc) sont
// écartées des cadences — elles ne servent qu'à la mémoire.
import { readFileSync } from 'node:fs'
import path from 'node:path'

const runs = process.argv.slice(2).map(d => JSON.parse(readFileSync(path.join(d, 'mesures.json'), 'utf8')))
const ORDRE = ['lobby', 'getReady', 'observe', 'question-choice', 'question-choice-photo', 'question-number', 'reveal-choice', 'reveal-number', 'finished', 'lobby-apres', 'cloture']
const med = a => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : NaN)
const p05 = a => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length * 0.05)] : NaN)
const somme = a => a.reduce((x, y) => x + y, 0)
const f = (n, d = 0) => (Number.isFinite(n) ? n.toFixed(d).replace('.', ',') : '—')

function secondes(app) {
  const out = []
  const ms = app.mesures.filter(m => !m.erreur)
  for (let i = 1; i < ms.length; i++) {
    const a = ms[i - 1]
    const b = ms[i]
    const dt = (b.m.Timestamp - a.m.Timestamp) || (b.t - a.t) / 1000
    const d = k => (b.m[k] - a.m[k]) / dt
    const msgs = Object.entries(b.s?.msgs ?? {}).filter(([k]) => k !== 'autre' && k !== 'ack')
    out.push({
      moment: b.moment,
      qIndex: b.qIndex,
      gc: b.gc || a.gc,
      premiere: a.moment !== b.moment || a.qIndex !== b.qIndex,
      fps: b.s.frames / ((b.t - a.t) / 1000),
      maxGap: b.s.maxGap,
      gaps50: b.s.gaps50,
      longTasks: b.s.longTasks,
      longTaskMs: b.s.longTaskMs,
      loafBlockingMs: b.s.loafBlockingMs,
      cls: b.s.cls,
      commits: b.s.commits / dt,
      msgs: somme(msgs.map(([, v]) => v.n)) / dt,
      octets: somme(msgs.map(([, v]) => v.octets)) / dt,
      style: d('RecalcStyleCount'),
      layout: d('LayoutCount'),
      styleMs: d('RecalcStyleDuration') * 1000,
      layoutMs: d('LayoutDuration') * 1000,
      scriptMs: d('ScriptDuration') * 1000,
      taskMs: d('TaskDuration') * 1000,
      composants: b.s.composants,
    })
  }
  return out
}

for (const nomApp of runs[0].appareils.map(a => a.nom)) {
  const toutes = runs.flatMap(r => secondes(r.appareils.find(a => a.nom === nomApp)))
  console.log(`\n### ${nomApp} (${runs.map(r => r.run).join(' + ')})\n`)
  console.log('| Moment | s | i/s méd. | i/s p5 | s < 50 i/s | pire image ms | longues tâches (ms/s) | occupé ms/s (méd · max) | script ms/s | style n/s · ms/s | layout n/s · ms/s | rendus React/s | msg/s | rendus/msg | CLS |')
  console.log('|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|')
  for (const mo of ORDRE) {
    const s = toutes.filter(x => x.moment === mo && !x.gc)
    if (!s.length) continue
    const st = s.filter(x => !x.premiere)
    const msgs = somme(s.map(x => x.msgs))
    console.log(
      `| ${mo} | ${s.length} | ${f(med(s.map(x => x.fps)))} | ${f(p05(s.map(x => x.fps)))} | ${f((100 * s.filter(x => x.fps < 50).length) / s.length)} % | ${f(Math.max(...s.map(x => x.maxGap)))} | ${f(somme(s.map(x => x.longTaskMs)) / s.length, 1)} | ${f(med(s.map(x => x.taskMs)))} · ${f(Math.max(...s.map(x => x.taskMs)))} | ${f(med(s.map(x => x.scriptMs)), 1)} | ${f(med(s.map(x => x.style)))} · ${f(med(s.map(x => x.styleMs)), 1)} | ${f(med(s.map(x => x.layout)))} · ${f(med(s.map(x => x.layoutMs)), 1)} | ${f(med(s.map(x => x.commits)), 1)} | ${f(msgs / s.length, 2)} | ${msgs ? f(somme(s.map(x => x.commits)) / msgs, 1) : '—'} | ${f(somme(s.map(x => x.cls)), 3)} |`,
    )
  }
  // L'entrée dans chaque moment : la seconde où l'écran change.
  console.log('\nPremière seconde de chaque moment (médiane · pire) :\n')
  console.log('| Moment | occupé ms | longues tâches ms | pire image ms | style ms | layout ms | script ms |')
  console.log('|---|--:|--:|--:|--:|--:|--:|')
  for (const mo of ORDRE) {
    const s = toutes.filter(x => x.moment === mo && x.premiere && !x.gc)
    if (!s.length) continue
    const c = k => `${f(med(s.map(x => x[k])))} · ${f(Math.max(...s.map(x => x[k])))}`
    console.log(`| ${mo} | ${c('taskMs')} | ${c('longTaskMs')} | ${c('maxGap')} | ${c('styleMs')} | ${c('layoutMs')} | ${c('scriptMs')} |`)
  }
  // Les composants qui rendent, par moment (run d'attribution seulement).
  if (toutes.some(x => x.composants && Object.keys(x.composants).length)) {
    console.log('\nComposants rendus par seconde (médiane des moments, les 8 premiers) :\n')
    for (const mo of ORDRE) {
      const s = toutes.filter(x => x.moment === mo && !x.gc && !x.premiere)
      if (!s.length) continue
      const tot = {}
      for (const x of s) for (const [k, v] of Object.entries(x.composants ?? {})) tot[k] = (tot[k] ?? 0) + v
      const top = Object.entries(tot).sort((a, b) => b[1] - a[1]).slice(0, 8)
      console.log(`- **${mo}** : ${top.map(([k, v]) => `${k} ${f(v / s.length, 1)}`).join(' · ')}`)
    }
    console.log('\nPremière seconde de chaque moment (rendus par composant, moyenne) :\n')
    for (const mo of ORDRE) {
      const s = toutes.filter(x => x.moment === mo && !x.gc && x.premiere)
      if (!s.length) continue
      const tot = {}
      for (const x of s) for (const [k, v] of Object.entries(x.composants ?? {})) tot[k] = (tot[k] ?? 0) + v
      const top = Object.entries(tot).sort((a, b) => b[1] - a[1]).slice(0, 10)
      console.log(`- **${mo}** : ${top.map(([k, v]) => `${k} ${f(v / s.length, 1)}`).join(' · ')}`)
    }
  }
}

// ── La mémoire, aux ramassages forcés ─────────────────────────────────────
console.log('\n### Mémoire après ramassage forcé (tas JS Mo · nœuds DOM · écouteurs)\n')
for (const r of runs) {
  console.log(`\n**${r.run}** (${r.salle})\n`)
  const noms = r.appareils.map(a => a.nom)
  console.log(`| Point | ${noms.join(' | ')} |`)
  console.log(`|---|${noms.map(() => '--:').join('|')}|`)
  const points = r.appareils[0].mesures.filter(m => m.gc && !m.erreur)
  for (const [i, p] of points.entries()) {
    const cells = r.appareils.map(a => {
      const m = a.mesures.filter(x => x.gc && !x.erreur)[i]
      return m ? `${f(m.m.JSHeapUsedSize / 1048576, 2)} · ${m.m.Nodes} · ${m.m.JSEventListeners}` : '—'
    })
    console.log(`| ${p.moment} Q${p.qIndex + 1} | ${cells.join(' | ')} |`)
  }
}
