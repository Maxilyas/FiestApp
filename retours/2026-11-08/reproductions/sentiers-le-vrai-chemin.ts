// La page des sentiers sur le vrai chemin d'un joueur (`../stabilite-des-joueurs.md`) : la page, une épreuve
// jouée jusqu'au bout, la page de nouveau — et encore. Le banc du 6 novembre 2026
// (`../../2026-11-06/reproductions/sentiers-au-dixieme.ts`) enchaînait huit visites sans jouer entre elles : la force
// gardée y servait sept fois sur huit, et la production, où l'on revient sur la page au sortir d'une épreuve, la
// refaisait à chaque retour — cinq gels de 0,9 à 1,9 s l'après-midi du 6 novembre. Le serveur sur le faux Turso — un
// autre processus, 30 ms l'aller-retour —, le transport léger et le client minimal de la production, la base livrée de
// la campagne, le modèle du savoir ajusté. Chaque requête dit son temps, le processeur du processus pendant elle (le
// serveur tourne ici même) et les gels que la sonde du serveur relève.
//
//   cd server && GEL=1 SERIES=600 node --single-threaded-gc --no-memory-reducer --max-old-space-size=320 \
//     --import tsx ../retours/2026-11-08/reproductions/sentiers-le-vrai-chemin.ts [épreuves]
//
// `SERIES=600` : son histoire — 600 séries de quinze réponses sur la vraie base, 9 000 réponses comme la plus assidue de
// la production, et 20 000 pour dix autres —, écrite derrière le dos du serveur, qui la relit au redémarrage.
// `GEL=1` (root, cgroup v1) : ce processus au dixième de cœur — 10 ms sur 100 — une fois le modèle ajusté, le faux Turso
// dehors. `PROFIL=1` : le profileur de V8 sur chaque retour sur la page et chaque départ d'épreuve — le temps inclus des
// fonctions du dépôt. Elle répond juste deux fois sur trois, la bonne réponse lue dans la base par l'intitulé.
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
import type { GelDeLaBoucle } from '../../../shared/santeDuServeur.ts'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const EPREUVES = Number(process.argv[2] ?? 6)
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

const fichier = path.join(DONNEES, 'sentiers-le-vrai-chemin.db')
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
const fetchDOrigine = globalThis.fetch
let etiquette = ''
globalThis.fetch = (async (entree: any, init?: any) => {
  const adresse = typeof entree === 'string' ? entree : entree.url
  if (!adresse.startsWith(banc.url)) return fetchDOrigine(entree, init)
  const chemin = adresse.slice(banc.url.length).replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/g, ':id')
  const quoi = `${(init?.method ?? 'GET').padEnd(4)} ${chemin}${etiquette ? ` · ${etiquette}` : ''}`
  const profiler = PROFIL && (etiquette === 'retour' || etiquette === 'départ')
  if (profiler) await profileur.post('Profiler.start')
  const avant = gels.length
  const c0 = process.cpuUsage()
  const debut = performance.now()
  const r = await fetchDOrigine(entree, init)
  const corps = await r.arrayBuffer()
  const ms = Math.round(performance.now() - debut)
  const c = process.cpuUsage(c0)
  if (profiler) profils.push((await profileur.post('Profiler.stop')).profile)
  const gelMs = gels.slice(avant).reduce((s, g) => s + g.dureeMs, 0)
  mesures.push({ quoi, ms, cpu: Math.round((c.user + c.system) / 1000), gelMs })
  if (etiquette !== 'réponse' || ms > 300 || gelMs > 0) {
    console.log(`${String(Math.round(performance.now() - t0)).padStart(7)}  ${quoi.padEnd(56)} ${String(ms).padStart(6)} ms  cpu ${String(Math.round((c.user + c.system) / 1000)).padStart(5)}${gelMs ? `  GEL ${gelMs} ms` : ''}`)
  }
  return new Response(corps, { status: r.status, statusText: r.statusText, headers: r.headers })
}) as typeof fetch

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

// La bonne réponse de chaque question, par son intitulé : le serveur ne la dit qu'après la sienne.
const dossier = path.join(RACINE, 'server/content/campagne')
const questions: any[] = readdirSync(dossier)
  .filter(f => f.endsWith('.json'))
  .flatMap(f => JSON.parse(readFileSync(path.join(dossier, f), 'utf8')))
const bonnes = new Map<string, string>(questions.map(q => [q.texte, q.reponses[q.bonne]]))
let x = 7
const hasard = () => (x = (x * 16807) % 2147483647) / 2147483647

if (SERIES > 0) {
  // Son histoire, et celle des autres : des séries de campagne sur la vraie base, écrites derrière le dos du serveur.
  const Database = createRequire(path.join(RACINE, 'server/package.json'))('better-sqlite3')
  const moi = (await lire('/api/joueur/moi?leger')).profile.id
  const db = new Database(fichier)
  const serie = db.prepare("INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode) VALUES (?, ?, ?, 15, 0, ?, ?, ?, 'serie')")
  const reponse = db.prepare('INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le) VALUES (?, ?, ?, ?, ?, ?)')
  const maintenant = Date.now()
  const ecrire = db.transaction((profil: string, nombre: number) => {
    for (let s = 0; s < nombre; s++) {
      const id = `histoire-${profil}-${s}`
      const qs = Array.from({ length: 15 }, () => questions[Math.floor(hasard() * questions.length)])
      const le = maintenant - Math.floor(hasard() * 30 * 86_400_000) - 3_600_000
      const justes = qs.map(() => hasard() < 0.6)
      serie.run(id, profil, JSON.stringify(qs.map(q => ({ id: q.id, categorie: q.categorie, niveau: q.difficulte, reponses: q.reponses }))), justes.filter(Boolean).length, le, le + 600_000)
      qs.forEach((q, k) => reponse.run(id, k, q.id, justes[k] ? q.bonne : (q.bonne + 1) % q.reponses.length, justes[k] ? 1 : 0, le + k * 30_000))
    }
  })
  ecrire(moi, SERIES)
  for (let k = 0; k < 10; k++) ecrire(`autre-joueur-${k}`, 133)
  db.close()
  console.log(`son histoire : ${SERIES * 15} réponses, et ${10 * 133 * 15} pour dix autres — le serveur redémarre`)
  await banc.redemarrer()
}

// Le modèle du savoir ajusté, comme en production : sans lui, la page ne dit pas de chance, et ne la calcule pas.
etiquette = 'à froid'
await lire('/api/campagne/sentiers')
const fin = Date.now() + 600_000
for (;;) {
  const sante = (await (await fetchDOrigine(`${banc.url}/healthz`)).json()) as any
  if (sante.campagne?.savoir?.ajusteLe) {
    console.log(`modèle du savoir ajusté : ${sante.campagne.savoir.joueurs} joueurs, ${sante.campagne.savoir.reponses} réponses, ${sante.campagne.savoir.dureeMs} ms`)
    break
  }
  if (Date.now() > fin) throw new Error('le modèle du savoir ne s’ajuste pas')
  await attendre(1_000)
}
await lire('/api/campagne/sentiers')
await attendre(3_000)
brider()
console.log(GEL ? 'bridé au dixième de cœur' : 'sans bride')
mesures.length = 0
gels.length = 0

let justesEnTout = 0
let reponsesEnTout = 0
for (let k = 0; k <= EPREUVES; k++) {
  // La page : à son arrivée, puis au retour de chaque épreuve — ce que la production faisait geler.
  etiquette = k === 0 ? 'arrivée' : 'retour'
  const page = await lire('/api/campagne/sentiers')
  if (k === 0) console.log(`  ${page.sentiers.length} sentiers, sa chance ${page.pourToi ? `sur ${page.pourToi.length}` : 'non dite'}, ${page.vies.jour} vies`)
  if (k === EPREUVES) break
  await attendre(1_500)
  // Un sentier à tour de rôle, au palier qui l'attend.
  const s = page.sentiers[k % page.sentiers.length]
  etiquette = 'départ'
  let e = await poster('/api/campagne/sentiers/epreuve', { branche: s.branche, palier: Math.min(13, s.paliers + 1) })
  etiquette = 'réponse'
  while (!e.finie && e.question) {
    await attendre(700)
    const q = e.question
    const bonne = q.reponses.indexOf(bonnes.get(q.texte))
    const juste = bonne >= 0 && hasard() < 2 / 3
    const choix = juste ? bonne : (Math.max(0, bonne) + 1 + Math.floor(hasard() * (q.reponses.length - 1))) % q.reponses.length
    const r = await poster(`/api/campagne/epreuve/${e.id}/reponse`, { index: q.index, choix })
    e = r.epreuve
    reponsesEnTout++
    if (r.juste) justesEnTout++
  }
  console.log(`  épreuve ${k + 1} : ${s.branche}, palier ${e.palier}, ${e.justes} justes sur ${e.justes + e.fausses} — ${e.issue ?? 'en jeu'}`)
  // L'écran de fin, lu quelques secondes.
  await attendre(2_000)
}
console.log(`${reponsesEnTout} réponses, ${justesEnTout} justes`)

console.log('\n== Par sorte de requête (processeur : médiane / pire ; temps : médiane / pire ; gel en tout)')
const parQuoi = new Map<string, Mesure[]>()
for (const m of mesures) parQuoi.set(m.quoi, [...(parQuoi.get(m.quoi) ?? []), m])
const med = (xs: number[]) => xs.slice().sort((a, c) => a - c)[Math.floor(xs.length / 2)]
for (const [quoi, ms] of parQuoi) {
  console.log(
    `${quoi.padEnd(60)} n=${String(ms.length).padStart(3)}  cpu ${String(med(ms.map(m => m.cpu))).padStart(4)} / ${String(Math.max(...ms.map(m => m.cpu))).padStart(5)}  ms ${String(med(ms.map(m => m.ms))).padStart(5)} / ${String(Math.max(...ms.map(m => m.ms))).padStart(6)}  gel ${ms.reduce((s, m) => s + m.gelMs, 0)}`,
  )
}
console.log(`\n== Gels relevés par la sonde : ${gels.length}`)
for (const g of gels) console.log(`  ${g.dureeMs} ms, cpu ${g.processeurMs}, gc ${g.ramasseMiettesMs} — ${g.enCours.map(e => e.quoi + (e.n > 1 ? '×' + e.n : '')).join(', ') || 'rien de nommé'}`)

if (profils.length > 0) {
  // Le temps inclus des fonctions du dépôt, sommé sur les retours et les départs.
  const inclus = new Map<string, number>()
  for (const p of profils) {
    const parId = new Map<number, any>(p.nodes.map((n: any) => [n.id, n]))
    const parent = new Map<number, number>()
    for (const n of p.nodes) for (const c of n.children ?? []) parent.set(c, n.id)
    const cle = (n: any) => `${n.callFrame.functionName || '(anonyme)'} ${n.callFrame.url.replace(/^.*\/FiestApp\//, '').replace(/^file:\/\//, '')}`
    for (let i = 0; i < p.samples.length; i++) {
      const vus = new Set<string>()
      for (let n = parId.get(p.samples[i]); n; n = parent.has(n.id) ? parId.get(parent.get(n.id)!) : undefined) {
        const k = cle(n)
        if (!vus.has(k)) inclus.set(k, (inclus.get(k) ?? 0) + (p.timeDeltas[i] ?? 0))
        vus.add(k)
      }
    }
  }
  console.log(`\n== Retours sur la page et départs d'épreuve (${profils.length}) — temps inclus des fonctions du dépôt, ms`)
  for (const [k, us] of [...inclus].filter(([k]) => /(server|shared)\//.test(k) && !k.includes('node_modules')).sort((a, c) => c[1] - a[1]).slice(0, 35)) {
    console.log(`${String(Math.round(us / 100) / 10).padStart(8)}  ${k}`)
  }
}
profileur.disconnect()
await banc.close()
faux.fermer()
