// Le banc du gel : une activité jouée par les vraies routes, multipliée
// jusqu'au volume de la production (≈ 1 400 séries, ≈ 14 000 réponses de
// campagne, ≈ 110 duels, onze jours de quiz du jour), puis un réveil à disque
// effacé et chaque route, chaque tâche de fond, mesurée : son temps, le
// processeur du processus, le plus long gel de la boucle, les pauses du
// ramasse-miettes, et — `PROFILER=1` — les fonctions qui ont pris le
// processeur (le profileur de V8, qui coûte lui-même : ses chiffres de
// processeur ne valent qu'entre eux).
//
//   cd server && node --import tsx ../retours/2026-10-16/reproductions/banc-gel.ts           (≈ 3 min)
//   cd server && GEL=1 node --import tsx ../retours/2026-10-16/reproductions/banc-gel.ts     (≈ 15 min)
//
// `GEL=1` met le serveur au dixième de cœur, comme l'offre gratuite de
// Render — dix millisecondes de processeur par dixième de seconde —, par un
// cgroup v1 (`/sys/fs/cgroup/cpu/gel`, il faut être root) ; le faux Turso
// reste dehors, comme la vraie base, à 30 ms l'aller-retour. La machine du
// banc étant elle-même partagée, ses gels sont plus longs que ceux de
// Render : les rapports comptent, pas les valeurs.
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { monitorEventLoopDelay, PerformanceObserver } from 'node:perf_hooks'
import { Session } from 'node:inspector/promises'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fauxTurso, attendre, DONNEES } from '../../2026-10-14/reproductions/outils.ts'
import { demarrer, connexionAnimateur, inscrireProfil, ecrire } from '../../../server/test/banc.ts'
const GEL = process.env.GEL === '1'
const PROFILER = process.env.PROFILER === '1'
const ATTENTE = GEL ? 4 : 1

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const require = createRequire(path.join(RACINE, 'server/package.json'))
const Database = require('better-sqlite3')

const JOUR_MS = 86_400_000
let decalage = 0
const horloge = () => Date.now() + decalage

const fichier = path.join(DONNEES, 'permanente-gel.db')
const faux = await fauxTurso(fichier)
const banc = await demarrer({ quizDbUrl: faux.url, prechauffageCampagneMs: 1_000, horlogeDuJour: horloge, rappels: { intervalleMs: 3_600_000 } })

const erreurs: string[] = []
const essayer = async <T>(quoi: string, f: () => Promise<T>): Promise<T | null> => {
  try {
    return await f()
  } catch (e) {
    erreurs.push(`${quoi} : ${(e as Error).message}`)
    return null
  }
}
const lireBase = <T>(f: (db: any) => T): T => {
  const db = new Database(fichier, { readonly: true })
  try {
    return f(db)
  } finally {
    db.close()
  }
}
const poster = async (cookie: string, chemin: string, corps: unknown = {}) => {
  const r = await ecrire(banc.url, chemin, corps, cookie)
  const texte = await r.text()
  let json: any = null
  try {
    json = JSON.parse(texte)
  } catch {}
  if (!r.ok) throw new Error(`${chemin} → ${r.status} ${json?.error ?? texte.slice(0, 80)}`)
  return json
}
const lire = async (cookie: string, chemin: string) => {
  const r = await fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } })
  const texte = await r.text()
  return { status: r.status, octets: texte.length, corps: (() => { try { return JSON.parse(texte) } catch { return null } })() }
}
let graine = 11
const hasard = () => (graine = (graine * 16807) % 2147483647) / 2147483647

// ── A. L'activité, par les vraies routes ─────────────────────────────────
const t0 = performance.now()
const admin = await connexionAnimateur(banc.url)
const PROFILS = 32
const ACTIFS = 17
const BRANCHES = ['mythes', 'foret', 'monde', 'espace']
const joueurs: { login: string; cookie: string; id: string }[] = []
for (let k = 0; k < PROFILS; k++) {
  const cookie = await inscrireProfil(banc.url, `joueur${k}`, `Joueur ${k}`, ['🦊', '🐸', '🦄', '🐙', '🐼', '🐯', '🦁', '🐨'][k % 8])
  const id = (await lire(cookie, '/api/joueur/moi')).corps.profile.id
  joueurs.push({ login: `joueur${k}`, cookie, id })
}
const jouerLeJour = async (cookie: string, force: number) => {
  let etat = await poster(cookie, '/api/jour/commencer')
  const questions = lireBase(db => JSON.parse(db.prepare('SELECT questions FROM jour_tirages WHERE jour = ?').get(etat.jour).questions)) as { bonne: number; reponses: string[] }[]
  while (etat.question) {
    const i = etat.question.index
    const bonne = questions[i].bonne
    await poster(cookie, '/api/jour/repondre', { jour: etat.jour, index: i, choix: hasard() < force ? bonne : (bonne + 1) % questions[i].reponses.length })
    etat = await poster(cookie, '/api/jour/suivante')
  }
}
const jouerLaSerie = async (cookie: string, serie: { id: string }, force: number, chemin = 'serie', max = 40) => {
  const questions = lireBase(db => JSON.parse(db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(serie.id).questions)) as { bonne: number; reponses: string[] }[]
  let fin: any = null
  for (let i = 0; i < Math.min(questions.length, max) && !fin?.finie && !fin?.epreuve?.finie; i++) {
    const q = questions[i]
    fin = await poster(cookie, `/api/campagne/${chemin}/${serie.id}/reponse`, { index: i, choix: hasard() < force ? q.bonne : (q.bonne + 1) % q.reponses.length })
  }
  return fin
}
for (const [k, j] of joueurs.slice(0, ACTIFS).entries()) {
  const force = 0.5 + (k % 5) * 0.08
  await essayer(`jour ${j.login}`, () => jouerLeJour(j.cookie, force))
  for (let s = 0; s < 3; s++) await essayer(`série ${j.login}`, async () => jouerLaSerie(j.cookie, await poster(j.cookie, '/api/campagne/serie', {}), force))
  await essayer(`épreuve ${j.login}`, async () => {
    const e = await poster(j.cookie, '/api/campagne/sentiers/epreuve', { branche: BRANCHES[k % BRANCHES.length], palier: 1 })
    return jouerLaSerie(j.cookie, e.epreuve ?? e, force + 0.2, 'epreuve', 16)
  })
  await essayer(`rencontre ${j.login}`, async () => {
    const r = await poster(j.cookie, '/api/campagne/rencontre')
    return jouerLaSerie(j.cookie, r.serie ?? r, force)
  })
}
for (let k = 0; k + 1 < ACTIFS; k += 2) {
  const [a, b] = [joueurs[k], joueurs[k + 1]]
  await essayer(`ami ${a.login}`, () => poster(a.cookie, `/api/campagne/amis/${b.id}/ajout`))
  await essayer(`duel ${a.login}`, async () => {
    const d = await poster(a.cookie, '/api/campagne/duel', { adversaire: b.id })
    const code = d.code ?? d.duel?.code
    const serie = d.serie ?? (await poster(a.cookie, `/api/campagne/duel/${code}`))
    await jouerLaSerie(a.cookie, serie.serie ?? serie, 0.6)
    const s2 = await poster(b.cookie, `/api/campagne/duel/${code}`)
    await jouerLaSerie(b.cookie, s2.serie ?? s2, 0.5)
  })
}
const compter = () =>
  lireBase(db => ({
    series: db.prepare('SELECT COUNT(*) n FROM campagne_series').get().n,
    reponses: db.prepare('SELECT COUNT(*) n FROM campagne_reponses').get().n,
    duels: db.prepare('SELECT COUNT(*) n FROM campagne_duels WHERE adversaire IS NOT NULL').get().n,
    jour: db.prepare('SELECT COUNT(*) n FROM jour_reponses').get().n,
    profils: db.prepare('SELECT COUNT(*) n FROM profiles').get().n,
  }))
console.log(`A. activité jouée en ${Math.round((performance.now() - t0) / 1000)} s :`, compter(), `— ${erreurs.length} échec(s)`)
for (const e of erreurs.slice(0, 8)) console.log('   ', e)

// ── B. Multipliée jusqu'au volume de la production ───────────────────────
{
  const db = new Database(fichier)
  const colonnes = (t: string) => (db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map(c => c.name)
  const avant = compter()
  const K = Math.min(40, Math.max(1, Math.ceil(13_400 / avant.reponses) - 1))
  const decaler = (v: unknown, ms: number) => (typeof v === 'number' && v > 1e12 ? v - ms : v)
  const jourDecale = (v: unknown, jours: number) => {
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
    const d = new Date(`${v}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() - jours)
    return d.toISOString().slice(0, 10)
  }
  // Les lignes d'origine, lues une fois : relues à chaque tour, les copies se recopiaient.
  const originaux = new Map<string, Record<string, unknown>[]>()
  const cloner = (table: string, where: string, transformer: (r: Record<string, unknown>) => Record<string, unknown> | null) => {
    const cols = colonnes(table)
    const inserer = db.prepare(`INSERT OR IGNORE INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    const cle = `${table} ${where}`
    if (!originaux.has(cle)) originaux.set(cle, db.prepare(`SELECT * FROM ${table} WHERE ${where}`).all() as Record<string, unknown>[])
    let n = 0
    for (const r of originaux.get(cle)!) {
      const t = transformer({ ...r })
      if (t) n += inserer.run(...cols.map(c => t[c] ?? null)).changes
    }
    return n
  }
  const tx = db.transaction(() => {
    const series = db.prepare("SELECT id FROM campagne_series WHERE finie_le IS NOT NULL AND mode NOT IN ('defi')").all() as { id: string }[]
    const ids = new Set(series.map(s => s.id))
    for (let k = 1; k <= K; k++) {
      // Étalées sur douze jours, comme la production.
      const ms = Math.round((k * 12 * JOUR_MS) / K) + k * 61_000
      const tsDecale = (r: Record<string, unknown>) => {
        for (const c of Object.keys(r)) if (/_le$/.test(c)) r[c] = decaler(r[c], ms)
        return r
      }
      cloner('campagne_duels', 'adversaire IS NOT NULL', r => tsDecale({ ...r, code: `${r.code}k${k}` }))
      cloner("campagne_envois", '1', r => (r.code ? tsDecale({ ...r, code: `${r.code}k${k}` }) : r.duel ? tsDecale({ ...r, duel: `${r.duel}k${k}` }) : null))
      cloner('campagne_series', "finie_le IS NOT NULL AND mode NOT IN ('defi')", r => tsDecale({ ...r, id: `${r.id}-k${k}`, duel: r.duel ? `${r.duel}k${k}` : r.duel }))
      cloner('campagne_reponses', '1', r => (ids.has(String(r.serie_id)) ? tsDecale({ ...r, serie_id: `${r.serie_id}-k${k}` }) : null))
    }
    // Le quiz du jour : douze jours passés, comme les onze tirages de la production.
    for (let k = 1; k <= 11; k++) {
      const jr = (r: Record<string, unknown>) => {
        for (const c of Object.keys(r)) {
          if (c === 'jour') r[c] = jourDecale(r[c], k)
          else if (/_le$/.test(c)) r[c] = decaler(r[c], k * JOUR_MS)
        }
        return r
      }
      cloner('jour_tirages', '1', jr)
      cloner('jour_parties', '1', jr)
      cloner('jour_reponses', '1', jr)
    }
  })
  tx()
  db.close()
  console.log(`B. multipliée ×${K + 1} :`, compter())
}

// ── C. Le réveil, puis chaque route et chaque tâche de fond ─────────────
const session = new Session()
session.connect()
await session.post('Profiler.enable')
await session.post('Profiler.setSamplingInterval', { interval: 1000 })
// Les pauses du ramasse-miettes, étape par étape.
let gcs: { kind: number; ms: number }[] = []
new PerformanceObserver(l => {
  for (const e of l.getEntries()) gcs.push({ kind: (e as any).detail?.kind ?? 0, ms: e.duration })
}).observe({ entryTypes: ['gc'] })
if (GEL) {
  // Le serveur au dixième de cœur, comme sur Render ; le faux Turso, lui, reste dehors : c'est la base distante.
  mkdirSync('/sys/fs/cgroup/cpu/gel', { recursive: true })
  writeFileSync('/sys/fs/cgroup/cpu/gel/cpu.cfs_quota_us', '10000')
  writeFileSync('/sys/fs/cgroup/cpu/gel/cgroup.procs', String(process.pid))
  writeFileSync('/sys/fs/cgroup/cpu/cgroup.procs', String(faux.enfant.pid))
  await faux.latence(30)
  console.log('— au dixième de cœur, 30 ms par aller-retour vers la base —')
}

interface Mesure { etape: string; ms: number; cpuMs: number; blocageMs: number; gcMax: number; gcTotal: number; gcN: number; tasMo: number; octets?: number; haut: string[] }
const mesures: Mesure[] = []
const profils: Record<string, unknown> = {}

/** Le profil de V8 réduit à ce qui a pris le processeur : la fonction de l'application la plus profonde de chaque échantillon. */
function lesPlusChers(profile: any, combien = 5): string[] {
  const parId = new Map<number, any>(profile.nodes.map((n: any) => [n.id, n]))
  const parent = new Map<number, number>()
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id)
  const temps = new Map<string, number>()
  const nom = (cf: any) => `${cf.functionName || '(anonyme)'} ${cf.url.replace(/^.*\/(server|shared|node_modules)\//, '$1/').replace(/^file:\/\//, '')}:${cf.lineNumber + 1}`
  for (let i = 0; i < profile.samples.length; i++) {
    const dt = (profile.timeDeltas[i + 1] ?? 0) / 1000
    let id: number | undefined = profile.samples[i]
    const feuille = parId.get(id!)
    if (!feuille || ['(idle)', '(program)'].includes(feuille.callFrame.functionName)) continue
    let cle = feuille.callFrame.functionName === '(garbage collector)' ? '(ramasse-miettes)' : null
    // La fonction du code de l'application (server/src, shared) la plus profonde ;
    // sinon la feuille elle-même (une bibliothèque, un décodage).
    while (!cle && id !== undefined) {
      const cf = parId.get(id)?.callFrame
      if (cf && /\/(server\/src|shared)\//.test(cf.url)) cle = nom(cf)
      id = parent.get(id)
    }
    cle ??= `[${nom(feuille.callFrame)}]`
    temps.set(cle, (temps.get(cle) ?? 0) + dt)
  }
  return [...temps].sort((a, b) => b[1] - a[1]).slice(0, combien).filter(([, ms]) => ms >= 2).map(([c, ms]) => `${Math.round(ms)} ms ${c}`)
}

async function mesurer(etape: string, f: () => Promise<number | void>, { profiler = PROFILER } = {}) {
  gcs = []
  const h = monitorEventLoopDelay({ resolution: 5 })
  h.enable()
  if (profiler) await session.post('Profiler.start')
  const cpu = process.cpuUsage()
  const debut = performance.now()
  const octets = await f()
  const ms = performance.now() - debut
  const c = process.cpuUsage(cpu)
  h.disable()
  let haut: string[] = []
  if (profiler) {
    const { profile } = await session.post('Profiler.stop')
    haut = lesPlusChers(profile)
    profils[etape] = profile
  }
  await new Promise(r => setImmediate(r))
  const gcMax = Math.round(Math.max(0, ...gcs.map(g => g.ms)))
  const gcTotal = Math.round(gcs.reduce((s, g) => s + g.ms, 0))
  const tasMo = Math.round(process.memoryUsage().heapUsed / 1048576)
  const m: Mesure = { etape, ms: Math.round(ms), cpuMs: Math.round((c.user + c.system) / 1000), blocageMs: Math.max(0, Math.round(h.max / 1e6 - 5)), gcMax, gcTotal, gcN: gcs.length, tasMo, ...(typeof octets === 'number' && { octets }), haut }
  mesures.push(m)
  console.log(`${etape.padEnd(50)} ${String(m.ms).padStart(6)} ms  cpu ${String(m.cpuMs).padStart(5)}  bloc ${String(m.blocageMs).padStart(5)}  gc ${m.gcN}×, max ${m.gcMax}, tot ${m.gcTotal}  tas ${m.tasMo} Mo${m.octets ? `  ${Math.round(m.octets / 1024)} Ko` : ''}`)
  for (const l of haut) console.log(`      ${l}`)
  await attendre(400 * ATTENTE)
}

// Le réveil : disque effacé, rien en mémoire.
await mesurer('réveil (redemarrer, disque effacé)', () => banc.redemarrer({ disqueEfface: true }))
await mesurer(`préchauffage (les ${12 * ATTENTE} s qui suivent)`, () => attendre(12_000 * ATTENTE))

// Le joueur le plus actif et un joueur moyen.
const parReponses = lireBase(db => db.prepare('SELECT s.profile_id AS p, COUNT(*) AS n FROM campagne_reponses r JOIN campagne_series s ON s.id = r.serie_id GROUP BY 1 ORDER BY 2 DESC').all()) as { p: string; n: number }[]
const lourd = joueurs.find(j => j.id === parReponses[0].p)!
const moyen = joueurs.find(j => j.id === parReponses[Math.floor(parReponses.length / 2)].p)!
console.log(`joueur lourd : ${parReponses[0].n} réponses ; moyen : ${parReponses[Math.floor(parReponses.length / 2)].n}`)

const ROUTES = [
  '/api/joueur/moi?leger',
  '/api/joueur/moi?accueil',
  '/api/joueur/nouveautes',
  '/api/joueur/missions',
  '/api/joueur/moi',
  '/api/duels',
  '/api/campagne',
  '/api/campagne/sentiers',
  '/api/campagne/carnet',
  '/api/jour',
]
for (const [qui, j] of [['lourd', lourd], ['moyen', moyen]] as const) {
  for (const passe of ['froid', 'chaud']) {
    for (const r of ROUTES) await mesurer(`${qui} ${passe} GET ${r}`, async () => (await lire(j.cookie, r)).octets)
  }
  await mesurer(`${qui} carte d'un autre joueur`, async () => (await lire(j.cookie, `/api/joueur/carte/${joueurs[20].id}`)).octets)
  await mesurer(`${qui} POST /api/campagne/serie (tirage)`, async () => JSON.stringify(await poster(j.cookie, '/api/campagne/serie', {})).length)
  await mesurer(`${qui} POST /api/campagne/rencontre (dé)`, async () => JSON.stringify(await poster(j.cookie, '/api/campagne/rencontre')).length)
}

// Les tâches de fond qui reviennent : mesure des difficultés (10 min),
// classement des duels (10 min), modèle du savoir (30 min). L'horloge avance,
// un geste les relance, puis le fond tourne seul.
decalage += 31 * 60_000
await mesurer('après 31 min : un tirage (relance mesure + modèle)', async () => JSON.stringify(await poster(moyen.cookie, '/api/campagne/serie', {})).length)
await mesurer(`   … le fond qui suit (${8 * ATTENTE} s)`, () => attendre(8_000 * ATTENTE))
await mesurer('après 31 min : GET /api/duels (classement relu)', async () => (await lire(moyen.cookie, '/api/duels')).octets)
decalage += 31 * 60_000
await mesurer('après 62 min : un dé (relance mesure + modèle)', async () => JSON.stringify(await poster(lourd.cookie, '/api/campagne/rencontre')).length)
await mesurer(`   … le fond qui suit (${8 * ATTENTE} s)`, () => attendre(8_000 * ATTENTE))

// Une vague : l'accueil d'un téléphone lance ses requêtes de front.
const VAGUE = ['/api/joueur/moi?accueil', '/api/joueur/nouveautes', '/api/joueur/missions', '/api/jour', '/api/duels', '/api/campagne']
await mesurer('vague de l’accueil, 1 joueur (6 de front)', async () => (await Promise.all(VAGUE.map(r => lire(moyen.cookie, r)))).reduce((s, x) => s + x.octets, 0))
await mesurer('vague de l’accueil, 4 joueurs de front', async () => (await Promise.all(joueurs.slice(0, 4).flatMap(j => VAGUE.map(r => lire(j.cookie, r))))).reduce((s, x) => s + x.octets, 0))

writeFileSync(path.join(DONNEES, `banc-gel${GEL ? '-dixieme' : ''}.json`), JSON.stringify(mesures, null, 1))
console.log(`\n${erreurs.length} échec(s) au total`)
await banc.close()
faux.fermer()
process.exit(0)
