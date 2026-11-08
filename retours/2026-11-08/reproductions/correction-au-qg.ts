// Une correction du QG en pleine soirée (`../stabilite-des-joueurs.md`, « Ce qui reste ») : le 6 novembre 2026 à
// 20 h 10, trois questions corrigées (`POST /api/admin/campagne/corriger`) ont refait la base, puis les tas du Cabinet
// — deux gels de 2,1 et 1,8 s sous « fond · tas du Cabinet », 328 et 275 ms de processeur, pendant une traversée en
// cours. Ici, les magasins seuls, sur la base livrée telle que le paquet la relit (`server/dist/index.campagne.ndjson` :
// `npm run build` d'abord, sinon le dossier relu et jugé) : le préchauffage du réveil, puis chaque correction et ce
// qu'elle refait — la page de la campagne, la base, les tas du Cabinet. Chaque tour de boucle de plus de `SEUIL` ms
// se relève avec ce qui tournait (la sonde des gels du serveur), et le profileur de V8 dit ce qui a calculé
// (`PROFIL=1`).
//
//   cd server && node --single-threaded-gc --no-memory-reducer --max-old-space-size=320 --import tsx \
//     ../retours/2026-11-08/reproductions/correction-au-qg.ts [corrections]
//
// `GEL=1` (root, cgroup v1) : au dixième de cœur une fois le préchauffage passé ; le seuil passe alors à 300 ms.
// `ATTENTE` : le temps entre une correction et la page du joueur qui suit (une seconde, cinq au dixième de cœur).
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { Session } from 'node:inspector/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { monitorEventLoopDelay, performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'
import { BaseDeLaCampagne, DOSSIER_DE_LA_BASE, type QuestionDeLaBase } from '../../../server/src/core/baseCampagne.ts'
import { CampagneStore } from '../../../server/src/core/campagne.ts'
import { REVEIL_DU_CABINET } from '../../../server/src/core/cabinet/tables.ts'
import { CabinetStore } from '../../../server/src/core/cabinet/magasin.ts'
import { SondeDesGels } from '../../../server/src/core/gels.ts'
import type { GelDeLaBoucle } from '../../../shared/santeDuServeur.ts'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const CORRECTIONS = Number(process.argv[2] ?? 3)
const GEL = process.env.GEL === '1'
const PROFIL = process.env.PROFIL === '1'
const SEUIL = Number(process.env.SEUIL ?? (GEL ? 300 : 20))
/** Le temps entre une correction et la page d'un joueur qui suit. */
const ATTENTE = Number(process.env.ATTENTE ?? (GEL ? 5_000 : 1_000))

const preparee = path.join(RACINE, 'server/dist/index.campagne.ndjson')
const t0 = performance.now()
const base = await BaseDeLaCampagne.depuisLeDossier(DOSSIER_DE_LA_BASE, existsSync(preparee) ? preparee : null)
console.log(`la base : ${base.questions.length} questions, ${existsSync(preparee) ? 'préparée au build' : 'relue et jugée'} — ${Math.round(performance.now() - t0)} ms`)
const dir = mkdtempSync(path.join(tmpdir(), 'correction-au-qg-'))
const campagne = new CampagneStore(`file:${path.join(dir, 'permanente.db')}`, undefined, { base })
await campagne.init(REVEIL_DU_CABINET)
const cabinet = new CabinetStore(campagne.porte(), { legendairesOf: () => [] } as never, { maintenant: Date.now, calendrier: { periodeDu: () => null } } as never)
// Comme `server.ts` : la base prête, le Cabinet prépare ses tas en fond.
campagne.baseRenouvelee = () => cabinet.preparerSesTas()
await campagne.prechauffer()
await cabinet.preparerSesTas()
await campagne.etat('assidue')
// Le modèle du savoir, lancé au bout du préchauffage sans être attendu : ajusté, il ne tourne plus sous les corrections.
for (const fin = Date.now() + 60_000; campagne.santeDuSavoir().ajusteLe === null && Date.now() < fin; ) await new Promise(r => setTimeout(r, 100))
console.log(`le préchauffage passé — ${Math.round(performance.now() - t0)} ms`)

if (GEL) {
  mkdirSync('/sys/fs/cgroup/cpu/gel', { recursive: true })
  writeFileSync('/sys/fs/cgroup/cpu/gel/cpu.cfs_quota_us', '10000')
  writeFileSync('/sys/fs/cgroup/cpu/gel/cgroup.procs', String(process.pid))
  console.log('bridé au dixième de cœur')
}

const gels: GelDeLaBoucle[] = []
const sonde = new SondeDesGels(g => gels.push(g), { seuilMs: SEUIL })
const boucle = monitorEventLoopDelay({ resolution: 10 })
const profileur = new Session()
profileur.connect()
await profileur.post('Profiler.enable')
await profileur.post('Profiler.setSamplingInterval', { interval: 100 })

// Chaque tour de boucle, par un `setImmediate` qui se repose à chaque tour : ceux de plus de `TOUR` ms, et ce que le
// profileur a vu calculer pendant chacun d'eux.
const TOUR = Number(process.env.TOUR ?? (GEL ? 100 : 8))
const tours: { debut: number; fin: number; correction: number }[] = []
let correction = 0
let dernier = performance.now()
let tourne = true
const tourner = () => {
  const t = performance.now()
  if (t - dernier > TOUR) tours.push({ debut: dernier, fin: t, correction })
  dernier = t
  if (tourne) setImmediate(tourner)
}
setImmediate(tourner)

// Des QCM de quatre réponses, loin les uns des autres : chacun change son anecdote, sa bonne réponse gardée.
const aCorriger: QuestionDeLaBase[] = base.questions.filter((q, i) => i % 997 === 0 && q.reponses.length === 4).slice(0, CORRECTIONS)
const profils: { profil: any; debut: number }[] = []
for (const [k, q] of aCorriger.entries()) {
  const avant = gels.length
  correction = k + 1
  boucle.reset()
  boucle.enable()
  const debutDuProfil = performance.now()
  if (PROFIL) await profileur.post('Profiler.start')
  const debut = performance.now()
  const c0 = process.cpuUsage()
  await campagne.corriger(q.id, { texte: q.texte, reponses: [...q.reponses], bonne: q.bonne, anecdote: `${q.anecdote ?? 'Une anecdote.'} Corrigée au QG.` })
  // Ce que la soirée demande ensuite, `ATTENTE` ms plus tard : la page de la campagne d'un joueur, et le Cabinet d'une
  // traversée en cours.
  await new Promise(r => setTimeout(r, ATTENTE))
  const page = performance.now()
  await campagne.etat('assidue')
  const pageMs = Math.round(performance.now() - page)
  const tas = performance.now()
  await cabinet.preparerSesTas()
  const tasMs = Math.round(performance.now() - tas)
  const ms = Math.round(performance.now() - debut)
  const c = process.cpuUsage(c0)
  if (PROFIL) profils.push({ profil: (await profileur.post('Profiler.stop')).profile, debut: debutDuProfil })
  // Les gels du dernier tour se relèvent au tour d'après de la sonde.
  await new Promise(r => setTimeout(r, 250))
  boucle.disable()
  console.log(
    `correction ${k + 1} : ${ms} ms en tout, processeur ${Math.round((c.user + c.system) / 1000)} ms ; ${ATTENTE} ms après, la page de la campagne ${pageMs} ms, ` +
      `les tas du Cabinet ${tasMs} ms ; le plus long tour ${Math.round(boucle.max / 1e6)} ms — ${gels.length - avant} tour(s) de plus de ${SEUIL} ms`,
  )
  for (const g of gels.slice(avant)) console.log(`    ${g.dureeMs} ms, cpu ${g.processeurMs}, gc ${g.ramasseMiettesMs} — ${g.enCours.map(e => e.quoi + (e.n > 1 ? '×' + e.n : '')).join(', ') || 'rien de nommé'}`)
  await new Promise(r => setTimeout(r, 500))
}

tourne = false
console.log(`\n== Les tours de plus de ${TOUR} ms : ${tours.length}`)
const cle = (n: any) => `${n.callFrame.functionName || '(anonyme)'} ${n.callFrame.url.replace(/^.*\/FiestApp\//, '').replace(/^file:\/\//, '')}:${n.callFrame.lineNumber + 1}`
const duDepot = (k: string) => /(server|shared)\//.test(k) && !k.includes('node_modules')
/** Le temps inclus des fonctions du dépôt, sur les échantillons pris entre `de` et `a` (en ms de `performance.now()`). */
function inclusEntre(de: number, a: number): Map<string, number> {
  const inclus = new Map<string, number>()
  for (const { profil: p, debut } of profils) {
    const parId = new Map<number, any>(p.nodes.map((n: any) => [n.id, n]))
    const parent = new Map<number, number>()
    for (const n of p.nodes) for (const c of n.children ?? []) parent.set(c, n.id)
    // Les instants du profileur partent de son départ, pris juste après `debut`.
    let t = debut
    for (let i = 0; i < p.samples.length; i++) {
      t += (p.timeDeltas[i] ?? 0) / 1000
      if (t < de || t > a) continue
      const vus = new Set<string>()
      for (let n = parId.get(p.samples[i]); n; n = parent.has(n.id) ? parId.get(parent.get(n.id)!) : undefined) {
        const k = cle(n)
        if (!vus.has(k)) inclus.set(k, (inclus.get(k) ?? 0) + (p.timeDeltas[i] ?? 0))
        vus.add(k)
      }
    }
  }
  return inclus
}
for (const t of tours.sort((a, b) => b.fin - b.debut - (a.fin - a.debut)).slice(0, 15)) {
  const ce = [...inclusEntre(t.debut, t.fin)].filter(([k]) => duDepot(k)).sort((a, c) => c[1] - a[1]).slice(0, 6)
  console.log(`  ${Math.round(t.fin - t.debut)} ms (correction ${t.correction}) — ${ce.map(([k, us]) => `${k.replace(/ .*:/, ':')} ${Math.round(us / 1000)}`).join(' · ') || '—'}`)
}
if (profils.length > 0) {
  console.log(`\n== Après ${profils.length} correction(s) — temps inclus des fonctions du dépôt, ms`)
  for (const [k, us] of [...inclusEntre(-Infinity, Infinity)].filter(([k]) => duDepot(k)).sort((a, c) => c[1] - a[1]).slice(0, 45)) {
    console.log(`${String(Math.round(us / 100) / 10).padStart(8)}  ${k}`)
  }
}
sonde.arreter()
profileur.disconnect()
campagne.close()
rmSync(dir, { recursive: true, force: true })
