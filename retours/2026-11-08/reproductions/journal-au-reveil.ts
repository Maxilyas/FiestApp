// Ce que coûte la lecture du journal des réponses au réveil, sur un vrai cœur (`../stabilite-des-joueurs.md`) : les
// tranches gardées de la base du réveil (`reveil-au-dixieme.ts`, à lancer d'abord — 40 000 réponses), décodées
// (`lireLeJournal`) puis appliquées (`JournalDesReponses.appliquer`), comme `reprendreLesTranches` les relit. Le
// réveil attend tout le journal avant le premier accueil : au dixième de cœur, chaque milliseconde ici en coûte dix
// à vingt d'attente.
//
//   cd server && node --single-threaded-gc --max-old-space-size=320 --import tsx \
//     ../retours/2026-11-08/reproductions/journal-au-reveil.ts [passages]
//
// `PROFIL=1` : le profileur de V8 sur le dernier passage — le temps propre et inclus des fonctions du dépôt.
import { createRequire } from 'node:module'
import path from 'node:path'
import { Session } from 'node:inspector/promises'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'
import { DONNEES } from '../../2026-10-14/reproductions/outils.ts'
import { JournalDesReponses, VERSION_DES_TRANCHES, lireLeJournal } from '../../../server/src/core/journalDesReponses.ts'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const Database = createRequire(path.join(RACINE, 'server/package.json'))('better-sqlite3')
const PASSAGES = Number(process.argv[2] ?? 6)
const PROFIL = process.env.PROFIL === '1'

const db = new Database(path.join(DONNEES, 'reveil-au-dixieme.db'), { readonly: true })
const tranches = db.prepare('SELECT debut, jusqua, lues, lignes FROM campagne_tranches WHERE version = ? ORDER BY debut').all(VERSION_DES_TRANCHES)
db.close()
const octets = tranches.reduce((s: number, t: any) => s + String(t.lignes).length, 0)
console.log(`${tranches.length} tranches, ${tranches.reduce((s: number, t: any) => s + Number(t.lues), 0)} réponses, ${Math.round(octets / 1e6)} Mo de texte`)

const profileur = new Session()
profileur.connect()
await profileur.post('Profiler.enable')
await profileur.post('Profiler.setSamplingInterval', { interval: 100 })
const maintenant = Date.now()
const mediane = (xs: number[]) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)]
const decoder: number[] = []
const appliquer: number[] = []
let profil: any = null
for (let k = 0; k < PASSAGES; k++) {
  const dernier = PROFIL && k === PASSAGES - 1
  if (dernier) await profileur.post('Profiler.start')
  const journal = new JournalDesReponses(() => maintenant)
  let d = 0
  let a = 0
  for (const t of tranches) {
    const t0 = performance.now()
    const lu = lireLeJournal(t)
    const t1 = performance.now()
    journal.appliquer(lu)
    a += performance.now() - t1
    d += t1 - t0
  }
  if (dernier) profil = (await profileur.post('Profiler.stop')).profile
  decoder.push(d)
  appliquer.push(a)
  console.log(`passage ${k + 1} : décoder ${Math.round(d)} ms, appliquer ${Math.round(a)} ms — ${journal.reponses} réponses`)
}
console.log(`\nmédiane : décoder ${Math.round(mediane(decoder))} ms, appliquer ${Math.round(mediane(appliquer))} ms (le premier passage, le code pas encore optimisé : ${Math.round(decoder[0])} + ${Math.round(appliquer[0])} ms)`)

if (profil) {
  const parId = new Map<number, any>(profil.nodes.map((n: any) => [n.id, n]))
  const parent = new Map<number, number>()
  for (const n of profil.nodes) for (const c of n.children ?? []) parent.set(c, n.id)
  const cle = (n: any) => `${n.callFrame.functionName || '(anonyme)'} ${n.callFrame.url.replace(/^.*\/FiestApp\//, '').replace(/^file:\/\//, '')}:${n.callFrame.lineNumber + 1}`
  const propre = new Map<string, number>()
  const inclus = new Map<string, number>()
  for (let i = 0; i < profil.samples.length; i++) {
    const feuille = parId.get(profil.samples[i])
    if (!feuille) continue
    propre.set(cle(feuille), (propre.get(cle(feuille)) ?? 0) + (profil.timeDeltas[i] ?? 0))
    const vus = new Set<string>()
    for (let n = feuille; n; n = parent.has(n.id) ? parId.get(parent.get(n.id)!) : undefined) {
      const k = cle(n)
      if (!vus.has(k)) inclus.set(k, (inclus.get(k) ?? 0) + (profil.timeDeltas[i] ?? 0))
      vus.add(k)
    }
  }
  console.log('\n== Temps propre, ms')
  for (const [k, us] of [...propre].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`${String(Math.round(us / 100) / 10).padStart(8)}  ${k}`)
  console.log('\n== Temps inclus, ms (fonctions du dépôt)')
  for (const [k, us] of [...inclus].filter(([k]) => /(server|shared)\//.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`${String(Math.round(us / 100) / 10).padStart(8)}  ${k}`)
}
profileur.disconnect()
