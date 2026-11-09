// Le moteur de difficulté, mis à l'épreuve (`../le-nouveau-filet.md`, « Le moteur de difficulté ») : ce qui prédit
// le mieux qu'une question sera réussie — la difficulté écrite, des critères de la base, la notoriété du sujet,
// l'avis d'un panel d'IA (`../maquette-filet/panel-ia.json`) — contre les vraies réponses de la production. En
// lecture seule, des totaux : chaque profil devient un numéro en mémoire, jamais écrit.
//
//   cd server && NODE_USE_ENV_PROXY=1 node --import tsx ../retours/2026-11-09/reproductions/moteur-de-difficulte.ts [panel|criteres] [notoriete.json]
//
//   panel      le panel de l'IA contre la difficulté écrite : en QCM (premières réponses, corrigées de la force de
//              qui a joué) et au Filet (« il savait » : le curseur à 2 % de la piste près ; « à 9 % près »)
//   criteres   un modèle logistique « force du joueur − difficulté de la question », la difficulté prédite par les
//              critères de la base, jugé sur des questions qu'il n'a jamais vues (cinq plis) ; avec, en second
//              argument, un cache de notoriété (entité → vues sur 60 jours, langues) pour l'ajouter aux critères
//
// Jamais `QUIZ_DB_URL` : `PROD_LECTURE_URL` et `PROD_LECTURE_TOKEN`, un jeton en lecture seule.
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { lireLaBase } from '../../../server/src/core/baseCampagne.ts'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(path.resolve(ICI, '../../../server/package.json'))
const quoi = process.argv[2] ?? 'panel'
const url = process.env.PROD_LECTURE_URL, authToken = process.env.PROD_LECTURE_TOKEN
if (!url || !authToken) throw new Error('PROD_LECTURE_URL et PROD_LECTURE_TOKEN, un jeton en lecture seule — jamais QUIZ_DB_URL')
const db = require('@libsql/client').createClient({ url: url.replace(/^libsql:/, 'https:'), authToken })
const parId = new Map(((lireLaBase() as any).questions as any[]).map(q => [q.id, q]))

/** Les premières réponses de chaque joueur à chaque question de la base, hors Cabinet et révision. */
async function premieres(): Promise<[number, string, number][]> {
  const { rows } = await db.execute(`
    WITH r AS (
      SELECT s.profile_id AS p, r.reserve_id AS q, r.juste AS j,
             ROW_NUMBER() OVER (PARTITION BY s.profile_id, r.reserve_id ORDER BY r.repondue_le) AS n
        FROM campagne_reponses r JOIN campagne_series s ON s.id = r.serie_id
       WHERE s.mode IN ('serie', 'sentier', 'sujet', 'defi', 'duel', 'rencontre')
         AND r.reserve_id NOT LIKE 'cab:%' AND r.reserve_id NOT LIKE 'frise:%' AND r.reserve_id NOT LIKE 'rebus:%')
    SELECT p, q, j FROM r WHERE n = 1`)
  const numero = new Map<unknown, number>()
  return (rows as Record<string, unknown>[])
    .filter(r => parId.has(String(r.q)))
    .map(r => [numero.has(r.p) ? numero.get(r.p)! : (numero.set(r.p, numero.size), numero.size - 1), String(r.q), Number(r.j)])
}
function auc(s: number[], y: number[]) {
  const idx = s.map((_, i) => i).sort((a, b) => s[a] - s[b])
  let r = 0, sp = 0, np = 0
  for (const i of idx) { r++; if (y[i]) { sp += r; np++ } }
  return (sp - (np * (np + 1)) / 2) / (np * (y.length - np))
}
function pearson(x: number[], y: number[]) {
  const mx = x.reduce((a, b) => a + b, 0) / x.length, my = y.reduce((a, b) => a + b, 0) / y.length
  let sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2 }
  return sxy / Math.sqrt(sxx * syy)
}
const rangs = (v: number[]) => { const o = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]); const r = new Array(v.length); o.forEach(([, i], k) => (r[i] = k)); return r }
const spearman = (x: number[], y: number[]) => pearson(rangs(x), rangs(y))
const logit = (p: number) => Math.log(p / (1 - p))
const borne = (p: number) => Math.min(0.97, Math.max(0.03, p))

if (quoi === 'panel') {
  const notes = new Map((JSON.parse(fs.readFileSync(path.resolve(ICI, '../maquette-filet/panel-ia.json'), 'utf8')) as any[]).map(n => [n.id, n]))
  const lignes = await premieres()
  // La force de chaque joueur (son taux de premières réponses justes), pour corriger le taux d'une question.
  const parJoueur = new Map<number, number[]>()
  for (const [p, , j] of lignes) parJoueur.set(p, [...(parJoueur.get(p) ?? []), j])
  const force = new Map([...parJoueur].map(([p, js]) => [p, js.reduce((a, b) => a + b, 0) / js.length]))
  const parQ = new Map<string, { n: number; j: number; attendu: number }>()
  for (const [p, q, j] of lignes) { const a = parQ.get(q) ?? { n: 0, j: 0, attendu: 0 }; a.n++; a.j += j; a.attendu += force.get(p)!; parQ.set(q, a) }
  const qs = [...notes.keys()].filter(id => (parQ.get(id)?.n ?? 0) >= 4)
  const observe = qs.map(id => { const a = parQ.get(id)!; return logit(borne((a.j + 0.5) / (a.n + 1))) - logit(borne(a.attendu / a.n)) })
  console.log(`QCM : ${qs.length} questions notées par le panel, jouées 4 fois au moins (${qs.reduce((s, id) => s + parQ.get(id)!.n, 0)} premières réponses) — corrélation de rang avec la réussite :`)
  console.log(`  la difficulté écrite  ${spearman(qs.map(id => -Number(parId.get(id).meta.difficulte)), observe).toFixed(2)}`)
  console.log(`  le panel de l'IA       ${spearman(qs.map(id => notes.get(id).qcm), observe).toFixed(2)}`)
  console.log(`  calibration : le panel prédit ${(qs.reduce((s, id) => s + notes.get(id).qcm, 0) / qs.length).toFixed(0)} % en moyenne, les joueurs font ${((100 * qs.reduce((s, id) => s + parQ.get(id)!.j / parQ.get(id)!.n, 0)) / qs.length).toFixed(0)} %`)
  // Le Filet : chaque lancer réel, son curseur, sa valeur, sa piste.
  const series = (await db.execute(`SELECT id, cabinet FROM campagne_series WHERE mode = 'cabinet' AND cabinet LIKE '%"jeu":"filet"%'`)).rows as Record<string, unknown>[]
  const gestes = new Map<unknown, any[]>()
  for (let i = 0; i < series.length; i += 50) {
    const lot = series.slice(i, i + 50).map(s => s.id)
    const r = await db.execute({ sql: `SELECT serie_id, geste FROM cabinet_gestes WHERE serie_id IN (${lot.map(() => '?').join(',')}) ORDER BY serie_id, rang`, args: lot })
    for (const g of r.rows as Record<string, unknown>[]) gestes.set(g.serie_id, [...(gestes.get(g.serie_id) ?? []), JSON.parse(String(g.geste))])
  }
  const lancers: { id: string; e: number }[] = []
  for (const s of series) {
    const d = JSON.parse(String(s.cabinet))
    for (const g of gestes.get(s.id) ?? []) {
      const t = d.tirages?.[g.manche]
      if (g.quoi === 'repondre' && t?.jeu === 'filet' && g.reponse?.filet) lancers.push({ id: t.question.id, e: Math.abs(g.reponse.filet.x - t.valeur) / (t.piste.max - t.piste.min) })
    }
  }
  const avec = lancers.filter(l => notes.get(l.id)?.estimation != null && parId.has(l.id))
  const savait = avec.map(l => (l.e <= 0.02 ? 1 : 0)), pres = avec.map(l => (l.e <= 0.09 ? 1 : 0))
  const ecrite = avec.map(l => -Number(parId.get(l.id).meta.difficulte)), panel = avec.map(l => notes.get(l.id).estimation)
  console.log(`\nFilet : ${avec.length} lancers — AUC de « il savait » (2 %) · « à 9 % près »`)
  console.log(`  la difficulté écrite  ${auc(ecrite, savait).toFixed(2)} · ${auc(ecrite, pres).toFixed(2)}`)
  console.log(`  le panel de l'IA       ${auc(panel, savait).toFixed(2)} · ${auc(panel, pres).toFixed(2)}`)
  for (const [a, b] of [[0, 25], [25, 50], [50, 101]]) {
    const ls = avec.filter(l => notes.get(l.id).estimation >= a && notes.get(l.id).estimation < b)
    console.log(`  panel ${String(a).padStart(2)}–${Math.min(100, b - 1)} % : ${ls.length} lancers, ${Math.round((100 * ls.filter(l => l.e <= 0.02).length) / ls.length)} % savaient`)
  }
} else if (quoi === 'criteres') {
  const notoriete: Record<string, any> = process.argv[3] ? JSON.parse(fs.readFileSync(process.argv[3], 'utf8')) : {}
  const avecNotoriete = Object.keys(notoriete).length > 0
  const CATEGORIES = [...new Set([...parId.values()].map(q => q.meta.categorie))].sort()
  function criteres(q: any, jeu: 'ecrite' | 'complet'): number[] {
    const d = Number(q.meta.difficulte ?? 3)
    const x = [d === 1 ? 1 : 0, d === 2 ? 1 : 0, d === 4 ? 1 : 0, d === 5 ? 1 : 0]
    if (jeu === 'ecrite') return x
    const es = (q.meta.entites ?? []).map((e: any) => notoriete[String(e.nom).trim()]).filter((e: any) => e?.trouve)
    if (avecNotoriete) x.push(es.length ? Math.max(...es.map((e: any) => Math.log10(1 + (e.vues60j ?? 0)))) - 3.3 : 0, es.length ? 0 : 1)
    const annee = q.meta.date && /^\s*(En quelle année|Quelle année)/i.test(q.texte), nombre = typeof q.meta.valeur?.nombre === 'number'
    x.push(annee ? 1 : 0, !annee && nombre ? 1 : 0, q.meta.portee === 'france' ? 1 : 0)
    x.push(...CATEGORIES.slice(1).map(c => (q.meta.categorie === c ? 1 : 0)))
    x.push((Number(q.meta.ageMin ?? 10) - 10) / 4, Math.min(q.texte.length, 200) / 100 - 0.8)
    return x
  }
  // P(juste) = σ(force du joueur − β·critères − c), ajusté par descente de gradient, sans bibliothèque.
  function ajuster(lignes: [number, string, number][], jeu: 'ecrite' | 'complet') {
    const nJ = 1 + Math.max(...lignes.map(r => r[0]))
    const X = new Map(lignes.map(([, q]) => [q, criteres(parId.get(q), jeu)]))
    const k = X.values().next().value!.length
    const theta = new Float64Array(nJ), beta = new Float64Array(k)
    let c = 0
    for (let e = 0; e < 60; e++) {
      const gT = new Float64Array(nJ), nT = new Float64Array(nJ), gB = new Float64Array(k)
      let gC = 0
      for (const [p, q, j] of lignes) {
        const x = X.get(q)!
        let z = theta[p] - c
        for (let i = 0; i < k; i++) z -= beta[i] * x[i]
        const err = j - 1 / (1 + Math.exp(-z))
        gT[p] += err; nT[p]++; gC -= err
        for (let i = 0; i < k; i++) gB[i] -= err * x[i]
      }
      for (let p = 0; p < nJ; p++) if (nT[p]) theta[p] += (gT[p] - 0.5 * theta[p]) / (nT[p] + 50)
      c += (0.5 * gC) / lignes.length
      for (let i = 0; i < k; i++) beta[i] += (0.5 * gB[i]) / lignes.length - 0.0005 * beta[i]
    }
    return (p: number, q: string) => { const x = criteres(parId.get(q), jeu); let z = theta[p] - c; for (let i = 0; i < x.length; i++) z -= beta[i] * x[i]; return 1 / (1 + Math.exp(-z)) }
  }
  const lignes = await premieres()
  const qs = [...new Set(lignes.map(r => r[1]))]
  const pli = new Map(qs.map((q, i) => [q, (i * 2654435761) % 5]))
  console.log(`${lignes.length} premières réponses, ${qs.length} questions${avecNotoriete ? ', notoriété comprise' : ''} — sur des questions jamais vues :`)
  for (const jeu of ['ecrite', 'complet'] as const) {
    const preds: number[] = [], ys: number[] = []
    for (let f = 0; f < 5; f++) {
      const predire = ajuster(lignes.filter(r => pli.get(r[1]) !== f), jeu)
      for (const [p, q, j] of lignes.filter(r => pli.get(r[1]) === f)) { preds.push(predire(p, q)); ys.push(j) }
    }
    console.log(`  ${jeu === 'ecrite' ? 'la difficulté écrite seule' : 'tous les critères        '}  AUC ${auc(preds, ys).toFixed(3)}`)
  }
} else {
  throw new Error(`« ${quoi} » : panel ou criteres`)
}
