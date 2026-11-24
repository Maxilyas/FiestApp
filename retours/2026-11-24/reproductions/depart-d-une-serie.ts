// Le départ d'une série (`POST /api/campagne/serie`), que la production a vu geler le serveur neuf fois du 16 au
// 24 novembre 2026 — jusqu'à 2,9 s le samedi 21 à 20 h 11, rien d'autre ne tournant, 457 ms de processeur pendant
// (`../bilan-de-la-production.md`). Le chemin d'un joueur assidu : il part sur toutes les catégories, sur une, sur un
// choix de plusieurs qu'il n'avait jamais pris, sur un sujet ; et il en laisse une en route pour en commencer une
// autre — la série laissée fait alors tomber ses hauts faits (`recompenserLaSerie`). Le serveur sur le faux Turso —
// un autre processus, 30 ms l'aller-retour —, le transport léger et le client minimal de la production, la base livrée
// de la campagne, le modèle du savoir ajusté. Chaque départ dit son temps, le processeur du processus pendant lui et
// les gels relevés.
//
//   cd server && SERIES=600 node --single-threaded-gc --no-memory-reducer --max-old-space-size=320 \
//     --import tsx ../retours/2026-11-24/reproductions/depart-d-une-serie.ts [tours]
//
// `SERIES=600` : son histoire — 600 séries de quinze réponses, 9 000 réponses comme la plus assidue de la production,
// et 20 000 pour dix autres —, écrite derrière le dos du serveur, qui la relit au redémarrage. `GEL=1` (root, cgroup
// v1) : ce processus au dixième de cœur une fois le modèle ajusté. `PROFIL=1` : le profileur de V8 sur chaque départ.
// La bonne réponse se lit dans la base, et elle répond juste deux fois sur trois.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { Session } from 'node:inspector/promises'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'
import { DONNEES, attendre, fauxTurso } from '../../2026-10-14/reproductions/outils.ts'
import { demarrer, inscrireProfil } from '../../../server/test/banc.ts'
import { choisirLeClient, choisirLeTransport } from '../../../server/src/core/distante.ts'
import { releve } from '../../../server/src/core/pouls.ts'
import { LECTURES_GARDEES_MS } from '../../../server/src/core/lecturesGardees.ts'
import { CATEGORIES } from '../../../shared/categories.ts'
import type { GelDeLaBoucle } from '../../../shared/santeDuServeur.ts'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const TOURS = Number(process.argv[2] ?? 3)
/**
 * `REPOS=12` : des minutes sans une requête avant chaque départ. En production, les gels tombaient sur le premier
 * départ après dix à trente minutes de calme (le 18 à 10 h 17, le 21 à 20 h 11, le 22 à 21 h 53) : enchaînés toutes
 * les trois secondes, les départs du banc ne gelaient jamais.
 */
const REPOS_MS = Number(process.env.REPOS ?? 0) * 60_000
const GEL = process.env.GEL === '1'
const SERIES = Number(process.env.SERIES ?? 0)
const PROFIL = process.env.PROFIL === '1'
choisirLeTransport('leger')
choisirLeClient('minimal')

const gels: GelDeLaBoucle[] = []
const noterLeGel = releve.gel.bind(releve)
releve.gel = g => {
  gels.push(g)
  noterLeGel(g)
}

const fichier = path.join(DONNEES, 'depart-d-une-serie.db')
mkdirSync(DONNEES, { recursive: true })
const faux = await fauxTurso(fichier)
await faux.latence(30)
function brider() {
  if (!GEL) return
  mkdirSync('/sys/fs/cgroup/cpu/gel', { recursive: true })
  writeFileSync('/sys/fs/cgroup/cpu/gel/cpu.cfs_quota_us', '10000')
  writeFileSync('/sys/fs/cgroup/cpu/gel/cgroup.procs', String(process.pid))
  writeFileSync('/sys/fs/cgroup/cpu/cgroup.procs', String(faux.enfant.pid))
}
const t0 = performance.now()
const banc = await demarrer({ quizDbUrl: faux.url, prechauffageCampagneMs: 200, fraicheurDesLecturesMs: LECTURES_GARDEES_MS, fraicheurDesDuelsMs: 30_000 })

const profileur = new Session()
profileur.connect()
await profileur.post('Profiler.enable')
await profileur.post('Profiler.setSamplingInterval', { interval: 100 })
const profils: any[] = []

type Mesure = { quoi: string; ms: number; cpu: number; gelMs: number }
const mesures: Mesure[] = []
const cookie = await inscrireProfil(banc.url, 'assidue', 'Assidue')
const entete = { Cookie: cookie, 'Content-Type': 'application/json', 'X-Requested-With': 'quizz', Origin: banc.url }
const lire = async (chemin: string) => {
  const r = await fetch(`${banc.url}${chemin}`, { headers: entete })
  const corps = await r.json()
  if (r.status !== 200) throw new Error(`${chemin} : ${r.status} ${JSON.stringify(corps).slice(0, 300)}`)
  return corps as any
}
const poster = async (chemin: string, corps: unknown = {}) => {
  const r = await fetch(`${banc.url}${chemin}`, { method: 'POST', headers: entete, body: JSON.stringify(corps) })
  const lu = await r.json()
  if (r.status !== 200) throw new Error(`${chemin} : ${r.status} ${JSON.stringify(lu).slice(0, 300)}`)
  return lu as any
}

/** Un départ, mesuré — et sous le profileur si `PROFIL=1`. */
async function partir(quoi: string, corps: unknown): Promise<any> {
  const avant = gels.length
  if (PROFIL) await profileur.post('Profiler.start')
  const c0 = process.cpuUsage()
  const debut = performance.now()
  let serie: any
  try {
    serie = await poster('/api/campagne/serie', corps)
  } finally {
    const ms = Math.round(performance.now() - debut)
    const c = process.cpuUsage(c0)
    if (PROFIL) profils.push({ quoi, profil: (await profileur.post('Profiler.stop')).profile })
    const gelMs = gels.slice(avant).reduce((s, g) => s + g.dureeMs, 0)
    const cpu = Math.round((c.user + c.system) / 1000)
    mesures.push({ quoi, ms, cpu, gelMs })
    console.log(`${String(Math.round(performance.now() - t0)).padStart(7)}  ${quoi.padEnd(44)} ${String(ms).padStart(6)} ms  cpu ${String(cpu).padStart(5)}${gelMs ? `  GEL ${gelMs} ms` : ''}`)
  }
  return serie
}

const dossier = path.join(RACINE, 'server/content/campagne')
const questions: any[] = readdirSync(dossier)
  .filter(f => f.endsWith('.json'))
  .flatMap(f => JSON.parse(readFileSync(path.join(dossier, f), 'utf8')))
const bonnes = new Map<string, string>(questions.map(q => [q.texte, q.reponses[q.bonne]]))
let x = 7
const hasard = () => (x = (x * 16807) % 2147483647) / 2147483647

/** Quelques réponses, puis la série laissée en route — ou finie, si elle tombe avant. */
async function jouer(s: any, reponses: number) {
  let q = s.question
  for (let n = 0; q && n < reponses; n++) {
    await attendre(300)
    const bonne = q.reponses.indexOf(bonnes.get(q.texte))
    const juste = bonne >= 0 && hasard() < 2 / 3
    const choix = juste ? bonne : (Math.max(0, bonne) + 1 + Math.floor(hasard() * (q.reponses.length - 1))) % q.reponses.length
    const r = await poster(`/api/campagne/serie/${s.id}/reponse`, { index: q.index, choix })
    q = r.finie ? null : r.suivante
  }
}

if (SERIES > 0) {
  const Database = createRequire(path.join(RACINE, 'server/package.json'))('better-sqlite3')
  const moi = (await lire('/api/joueur/moi?leger')).profile.id
  const db = new Database(fichier)
  const serie = db.prepare("INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, categories) VALUES (?, ?, ?, 15, 0, ?, ?, ?, 'serie', ?)")
  const reponse = db.prepare('INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le) VALUES (?, ?, ?, ?, ?, ?)')
  const maintenant = Date.now()
  const aEcrire = [{ profil: moi, nombre: SERIES }, ...Array.from({ length: 10 }, (_, k) => ({ profil: `autre-joueur-${k}`, nombre: 133 }))]
    .flatMap(({ profil, nombre }) => Array.from({ length: nombre }, (_, s) => ({ profil, s, le: maintenant - Math.floor(hasard() * 30 * 86_400_000) - 3_600_000 })))
    .sort((a, b) => a.le - b.le)
  db.transaction(() => {
    for (const { profil, s, le } of aEcrire) {
      const id = `histoire-${profil}-${s}`
      const qs = Array.from({ length: 15 }, () => questions[Math.floor(hasard() * questions.length)])
      const justes = qs.map(() => hasard() < 0.6)
      // Un tiers de ses séries sur une catégorie : ses records par catégorie, que la fin d'une série relit.
      const categories = s % 3 === 0 ? JSON.stringify([CATEGORIES[s % CATEGORIES.length]]) : null
      serie.run(id, profil, JSON.stringify(qs.map(q => ({ id: q.id, categorie: q.categorie, niveau: q.difficulte, reponses: q.reponses }))), justes.filter(Boolean).length, le, le + 600_000, categories)
      qs.forEach((q, k) => reponse.run(id, k, q.id, justes[k] ? q.bonne : (q.bonne + 1) % q.reponses.length, justes[k] ? 1 : 0, le + k * 30_000))
    }
  })()
  db.close()
  console.log(`son histoire : ${SERIES * 15} réponses, et ${10 * 133 * 15} pour dix autres — le serveur redémarre`)
  await banc.redemarrer()
}

// Le modèle du savoir ajusté, et le préchauffage passé, comme en production une heure après son réveil.
await lire('/api/joueur/moi?accueil')
await lire('/api/campagne')
const fin = Date.now() + 600_000
for (;;) {
  const sante = (await (await fetch(`${banc.url}/healthz`)).json()) as any
  if (sante.campagne?.savoir?.ajusteLe) break
  if (Date.now() > fin) throw new Error('le modèle du savoir ne s’ajuste pas')
  await attendre(1_000)
}
await attendre(3_000)
brider()
console.log(GEL ? 'bridé au dixième de cœur' : 'sans bride')
gels.length = 0

// Les choix d'un tour : toutes les catégories, une seule, deux puis trois jamais prises, un sujet. Chaque tour change
// ses choix de plusieurs : un choix neuf se prépare à son premier départ.
const sujets = ['animaux', 'inventions', 'mythes-legendes', 'terre-espace', 'grands-rendez-vous']
for (let k = 0; k < TOURS; k++) {
  const c = (i: number) => CATEGORIES[(k * 3 + i) % CATEGORIES.length]
  const choix: [string, unknown][] = [
    ['toutes les catégories', { categories: [] }],
    [`une : ${c(0)}`, { categories: [c(0)] }],
    [`deux, neuves : ${c(1)} + ${c(2)}`, { categories: [c(1), c(2)] }],
    [`trois, neuves : ${c(0)} + ${c(1)} + ${c(4)}`, { categories: [c(0), c(1), c(4)] }],
    [`le sujet ${sujets[k % sujets.length]}`, { sujet: sujets[k % sujets.length] }],
  ]
  for (const [quoi, corps] of choix) {
    if (REPOS_MS > 0) {
      console.log(`  ${REPOS_MS / 60_000} minutes de calme…`)
      await attendre(REPOS_MS)
    }
    const s = await partir(quoi, corps)
    // Six réponses, puis la suivante part : celle-ci est laissée en route, et ses hauts faits tombent au départ suivant.
    await jouer(s, 6)
    await attendre(1_000)
  }
  console.log(`  tour ${k + 1} fini`)
}
// La dernière laissée : un départ de plus la referme.
await partir('après une laissée, toutes', { categories: [] })

console.log('\n== Les départs (processeur : médiane / pire ; temps : médiane / pire ; gel en tout)')
const parQuoi = new Map<string, Mesure[]>()
for (const m of mesures) {
  const genre = m.quoi.replace(/ : .*$/, '').replace(/le sujet .*/, 'un sujet')
  parQuoi.set(genre, [...(parQuoi.get(genre) ?? []), m])
}
const med = (xs: number[]) => xs.slice().sort((a, c) => a - c)[Math.floor(xs.length / 2)]
for (const [quoi, ms] of parQuoi) {
  console.log(
    `${quoi.padEnd(30)} n=${String(ms.length).padStart(3)}  cpu ${String(med(ms.map(m => m.cpu))).padStart(4)} / ${String(Math.max(...ms.map(m => m.cpu))).padStart(5)}  ms ${String(med(ms.map(m => m.ms))).padStart(5)} / ${String(Math.max(...ms.map(m => m.ms))).padStart(6)}  gel ${ms.reduce((s, m) => s + m.gelMs, 0)}`,
  )
}
console.log(`\n== Gels relevés par la sonde : ${gels.length}`)
for (const g of gels) console.log(`  ${g.dureeMs} ms, cpu ${g.processeurMs}, gc ${g.ramasseMiettesMs} — ${g.enCours.map(e => e.quoi + (e.n > 1 ? '×' + e.n : '')).join(', ') || 'rien de nommé'}`)

if (profils.length > 0) {
  // Le temps inclus et propre des fonctions du dépôt, sommé sur tous les départs.
  const inclus = new Map<string, number>()
  const propre = new Map<string, number>()
  for (const { profil: p } of profils) {
    const parId = new Map<number, any>(p.nodes.map((n: any) => [n.id, n]))
    const parent = new Map<number, number>()
    for (const n of p.nodes) for (const c of n.children ?? []) parent.set(c, n.id)
    const cle = (n: any) => `${n.callFrame.functionName || '(anonyme)'} ${n.callFrame.url.replace(/^.*\/FiestApp\//, '').replace(/^file:\/\//, '')}:${n.callFrame.lineNumber + 1}`
    for (let i = 0; i < p.samples.length; i++) {
      const feuille = parId.get(p.samples[i])
      if (!feuille) continue
      propre.set(cle(feuille), (propre.get(cle(feuille)) ?? 0) + (p.timeDeltas[i] ?? 0))
      const vus = new Set<string>()
      for (let n = feuille; n; n = parent.has(n.id) ? parId.get(parent.get(n.id)!) : undefined) {
        const k = cle(n)
        if (!vus.has(k)) inclus.set(k, (inclus.get(k) ?? 0) + (p.timeDeltas[i] ?? 0))
        vus.add(k)
      }
    }
  }
  console.log(`\n== Les départs (${profils.length}) — temps inclus des fonctions du dépôt, ms`)
  for (const [k, us] of [...inclus].filter(([k]) => /(server|shared)\//.test(k) && !k.includes('node_modules')).sort((a, c) => c[1] - a[1]).slice(0, 45)) {
    console.log(`${String(Math.round(us / 100) / 10).padStart(8)}  ${k}`)
  }
  console.log('\n== Temps propre, ms')
  for (const [k, us] of [...propre].sort((a, c) => c[1] - a[1]).slice(0, 25)) console.log(`${String(Math.round(us / 100) / 10).padStart(8)}  ${k}`)
}
profileur.disconnect()
await banc.close()
faux.fermer()
