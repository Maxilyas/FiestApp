// Ce que la production a vu geler le 2 novembre 2026 (`gels-de-la-production.ts`),
// rejoué au profileur de V8 sur la base du banc du gel grossie au volume de la
// production — 35 000 réponses de campagne ce soir-là, `REPONSES` pour un
// autre —, la base derrière le faux Turso (`../../2026-10-14/reproductions/`) :
// SQLite hors du processus, comme Turso. Les scènes des gels de l'après-midi,
// dans l'ordre : la page des sentiers à froid et le fond qui suit ; des
// épreuves du Cabinet entrées et quittées, l'horloge avancée de onze minutes
// une fois sur deux — la mesure des difficultés se refait alors en fond, comme
// en production — ; la page des sentiers et une épreuve de sentier après les
// mesures neuves ; les signalements du QG, une question reclassée puis une
// corrigée — la base se refait —, et le départ du Cabinet qui suit ; la vue
// d'ensemble du QG ; enfin un réveil. Pour chaque étape : son temps, son
// processeur, ce qui a pris le processeur (la fonction du dépôt la plus
// profonde de chaque échantillon, et celle qui l'appelait), et les plus longs
// trous de la boucle avec ce qui tournait pendant.
//
// `banc-gel.ts` d'abord (la base du banc), `npm run build` (la base de la
// campagne vérifiée au build), puis, compilé comme le paquet de production :
//
//   cd server && node --import tsx ../retours/2026-10-16/reproductions/compiler.ts \
//     ../retours/2026-11-02/reproductions/gels-rejoues.ts ../export/banc/gels-rejoues.mjs
//   node ../export/banc/gels-rejoues.mjs
//
// Sur un vrai cœur : les durées se lisent entre elles. En production, un
// processeur plus lent et le dixième de cœur de l'hébergeur font d'une
// milliseconde ici de l'ordre de trente à cinquante de gel.
//
// `GEL=1` (root, cgroup v1) met le banc au dixième de cœur, comme l'offre
// gratuite de Render — dix millisecondes de processeur par dixième de
// seconde —, le faux Turso dehors à 30 ms l'aller-retour, comme `banc-gel.ts` ;
// à lancer avec les drapeaux de la production :
//
//   GEL=1 node --single-threaded-gc --no-memory-reducer --max-old-space-size=320 ../export/banc/gels-rejoues.mjs
//
// Sans profileur ni sonde de deux millisecondes, qui prendraient le dixième de
// cœur pour eux : chaque étape dit ses gels comme la production les relève —
// la sonde du serveur (`core/gels.ts`), au-delà d'une demi-seconde, avec ce
// qui tournait pendant — et ceux d'au moins 150 ms, d'une sonde à elle.
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Session } from 'node:inspector/promises'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'
import { DONNEES, attendre, fauxTurso } from '../../2026-10-14/reproductions/outils.ts'
import { connexionAnimateur, cookieDe, demarrer, ecrire } from '../../../server/test/banc.ts'
import { releve } from '../../../server/src/core/pouls.ts'
import type { GelDeLaBoucle } from '../../../shared/santeDuServeur.ts'

const GEL = process.env.GEL === '1'
// Chaque gel que la sonde du serveur relève, en entier : l'heure n'en garde que cinq en détail.
const gelsReleves: GelDeLaBoucle[] = []
const noterAuReleve = releve.gel.bind(releve)
releve.gel = g => {
  gelsReleves.push(g)
  noterAuReleve(g)
}

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const require = createRequire(path.join(RACINE, 'server/package.json'))
const Database = require('better-sqlite3')
const CIBLE = Number(process.env.REPONSES ?? 35_000)
const JOUR_MS = 86_400_000

// ── La base du banc, grossie au volume de la production ───────────────────
// Ses séries finies et leurs réponses recopiées en arrière, comme le banc du
// gel les a multipliées (`banc-gel.ts`, B), jusqu'à la cible : la mesure, le
// modèle du savoir et le journal des réponses lisent autant qu'en production.
const source = path.join(DONNEES, 'permanente-gel.db')
const grossie = path.join(DONNEES, `permanente-gel-${Math.round(CIBLE / 1000)}k.db`)
if (!existsSync(source)) throw new Error(`pas de base du banc (${source}) : lance d'abord banc-gel.ts`)
if (!existsSync(grossie)) {
  for (const s of ['', '-wal', '-shm']) if (existsSync(source + s)) copyFileSync(source + s, grossie + s)
  const db = new Database(grossie)
  const n = () => (db.prepare('SELECT COUNT(*) n FROM campagne_reponses').get() as { n: number }).n
  const colonnes = (t: string) => (db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map(c => c.name)
  const inserer = (t: string) => {
    const cols = colonnes(t)
    const st = db.prepare(`INSERT OR IGNORE INTO ${t} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    return (r: Record<string, unknown>) => st.run(...cols.map(c => r[c] ?? null)).changes
  }
  const decaler = (r: Record<string, unknown>, ms: number) => {
    for (const c of Object.keys(r)) if (/_le$/.test(c) && typeof r[c] === 'number' && (r[c] as number) > 1e12) r[c] = (r[c] as number) - ms
    return r
  }
  const series = db.prepare("SELECT * FROM campagne_series WHERE finie_le IS NOT NULL AND mode NOT IN ('defi')").all() as Record<string, unknown>[]
  const reponsesDe = db.prepare('SELECT * FROM campagne_reponses WHERE serie_id = ?')
  const duels = db.prepare('SELECT * FROM campagne_duels WHERE adversaire IS NOT NULL').all() as Record<string, unknown>[]
  const [serie, reponse, duel] = [inserer('campagne_series'), inserer('campagne_reponses'), inserer('campagne_duels')]
  db.transaction(() => {
    for (let k = 1; n() < CIBLE && k <= 20; k++) {
      const ms = k * 12 * JOUR_MS + k * 61_000
      for (const d of duels) duel(decaler({ ...d, code: `${d.code}g${k}` }, ms))
      for (const s of series) {
        serie(decaler({ ...s, id: `${s.id}-g${k}`, duel: s.duel ? `${s.duel}g${k}` : s.duel }, ms))
        for (const r of reponsesDe.all(s.id) as Record<string, unknown>[]) reponse(decaler({ ...r, serie_id: `${s.id}-g${k}` }, ms))
        if (n() >= CIBLE) break
      }
    }
  })()
  console.log(`base grossie : ${n()} réponses de campagne (${grossie})`)
  db.close()
}
// Une copie par passage : chaque passage part de la même base.
const dossier = mkdtempSync(path.join(tmpdir(), 'gels-rejoues-'))
const copie = path.join(dossier, 'permanente.db')
for (const s of ['', '-wal', '-shm']) if (existsSync(grossie + s)) copyFileSync(grossie + s, copie + s)

const faux = await fauxTurso(copie, { neuf: false })
if (GEL) {
  // Le serveur au dixième de cœur, comme sur Render ; le faux Turso, lancé avant, reste dehors : c'est la base distante.
  mkdirSync('/sys/fs/cgroup/cpu/gel', { recursive: true })
  writeFileSync('/sys/fs/cgroup/cpu/gel/cpu.cfs_quota_us', '10000')
  writeFileSync('/sys/fs/cgroup/cpu/gel/cgroup.procs', String(process.pid))
  await faux.latence(30)
  console.log('— au dixième de cœur, 30 ms par aller-retour vers la base —')
}
const horloge = { t: Date.now() }
const banc = await demarrer({ quizDbUrl: faux.url, cabinet: true, expeditionRemplacee: true, horlogeDuJour: () => horloge.t, prechauffageCampagneMs: 500 })
const lire = async (cookie: string, chemin: string) => {
  const r = await fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie, 'X-Requested-With': 'quizz' } })
  return { status: r.status, corps: (await r.json().catch(() => null)) as any }
}
const poster = async (cookie: string, chemin: string, corps: unknown) => {
  const r = await ecrire(banc.url, chemin, corps, cookie)
  return { status: r.status, corps: (await r.json().catch(() => null)) as any }
}
const connecter = async () => cookieDe(await ecrire(banc.url, '/api/joueur/connexion', { login: 'joueur3', password: 'motdepasse1' }), 'qz_joueur')
let joueur = await connecter()
let admin = await connexionAnimateur(banc.url)
const moi = (await lire(joueur, '/api/joueur/moi')).corps?.profile?.id as string
// Au dixième de cœur, tout dure dix fois plus : le réveil, et le fond qui suit chaque étape.
const ATTENTE = GEL ? 4 : 1
await attendre(GEL ? 90_000 : 20_000)

// ── Le profileur, et les trous de la boucle ───────────────────────────────
const session = new Session()
if (!GEL) {
  session.connect()
  await session.post('Profiler.enable')
  await session.post('Profiler.setSamplingInterval', { interval: 500 })
}
// Compilé, le dépôt tient dans un seul fichier : le module d'une ligne se lit
// dans le commentaire qu'esbuild pose en tête de chacun (comme `banc-gel.ts`).
const PAQUET = process.argv[1]
const modules: { ligne: number; module: string }[] = []
if (PAQUET.endsWith('.mjs'))
  readFileSync(PAQUET, 'utf8')
    .split('\n')
    .forEach((l, i) => {
      const m = /^\/\/ (\S+\.m?[tj]s)$/.exec(l)
      if (m) modules.push({ ligne: i, module: m[1].replace(/^(\.\.\/)+/, '') })
    })
const moduleDe = (cf: any): string | null => {
  const url = String(cf.url)
  if (PAQUET.endsWith('.mjs') && url.endsWith(path.basename(PAQUET))) {
    let bas = 0
    let haut = modules.length - 1
    let m: string | null = null
    while (bas <= haut) {
      const mi = (bas + haut) >> 1
      if (modules[mi].ligne <= cf.lineNumber) {
        m = modules[mi].module
        bas = mi + 1
      } else haut = mi - 1
    }
    return m
  }
  return url.replace(`file://${RACINE}/`, '')
}
// Compilé depuis `server/`, un module du serveur se dit `src/…`, un module partagé `shared/…`.
const DU_DEPOT = /^((server\/)?src|shared)\//
function cleur(profile: any) {
  const parId = new Map<number, any>(profile.nodes.map((n: any) => [n.id, n]))
  const parent = new Map<number, number>()
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id)
  return (id: number): string | null => {
    const feuille = parId.get(id)
    const nom = feuille?.callFrame.functionName
    if (!feuille || nom === '(idle)' || nom === '(program)') return null
    if (nom === '(garbage collector)') return '(ramasse-miettes)'
    const siens: string[] = []
    for (let i: number | undefined = id; i !== undefined && siens.length < 2; i = parent.get(i)) {
      const cf = parId.get(i)?.callFrame
      const m = cf && moduleDe(cf)
      if (m && DU_DEPOT.test(m)) siens.push(`${cf.functionName || '(anonyme)'} ${path.basename(m)}`)
    }
    return siens.length ? siens.join(' ← ') : `[${nom || '(anonyme)'}]`
  }
}
const trous: { a: number; b: number }[] = []
async function etape(nom: string, f: () => Promise<unknown>) {
  trous.length = 0
  const gelsAvant = gelsReleves.length
  // Sur un vrai cœur, une sonde de 2 ms trouve les trous de la boucle ; au dixième de cœur, une de 100 ms, comme celle du serveur.
  const pas = GEL ? 100 : 2
  let dernier = process.hrtime.bigint()
  const minuterie = setInterval(() => {
    const t = process.hrtime.bigint()
    if (t - dernier > BigInt(GEL ? 150_000_000 + pas * 1_000_000 : 6_000_000)) trous.push({ a: Number(dernier / 1000n), b: Number(t / 1000n) })
    dernier = t
  }, pas)
  if (!GEL) await session.post('Profiler.start')
  const cpu = process.cpuUsage()
  const debut = performance.now()
  let dit = ''
  try {
    dit = String((await f()) ?? '')
  } catch (e) {
    dit = `ÉCHEC ${(e as Error).message}`
  }
  const ms = performance.now() - debut
  const c = process.cpuUsage(cpu)
  clearInterval(minuterie)
  if (GEL) {
    console.log(`\n${nom.padEnd(60)} ${String(Math.round(ms)).padStart(6)} ms  processeur ${String(Math.round((c.user + c.system) / 1000)).padStart(5)} ms${dit ? `  — ${dit}` : ''}`)
    const longs = [...trous].map(x => Math.round((x.b - x.a) / 1000) - pas).sort((x, y) => y - x)
    if (longs.length) console.log(`   retards ≥ 150 ms : ${longs.length} — ${longs.slice(0, 8).join(', ')} ms`)
    for (const g of gelsReleves.slice(gelsAvant)) {
      const noms = g.enCours.map(e => (e.n > 1 ? `${e.quoi} ×${e.n}` : e.quoi))
      console.log(`   gel ${String(g.dureeMs).padStart(5)} ms  processeur ${String(g.processeurMs).padStart(4)}  ramasse-miettes ${String(g.ramasseMiettesMs).padStart(4)}  — ${noms.join(', ') || 'rien de nommé'}`)
    }
    await attendre(500)
    return
  }
  const { profile } = await session.post('Profiler.stop')
  const cle = cleur(profile)
  const instants: number[] = []
  let t = profile.startTime
  for (let i = 0; i < profile.samples.length; i++) instants.push((t += profile.timeDeltas[i] ?? 0))
  const temps = (a: number, b: number) => {
    const parCle = new Map<string, number>()
    for (let i = 0; i < instants.length; i++) {
      if (instants[i] < a || instants[i] > b) continue
      const k = cle(profile.samples[i])
      if (k) parCle.set(k, (parCle.get(k) ?? 0) + (profile.timeDeltas[i + 1] ?? 0) / 1000)
    }
    return [...parCle].sort((x, y) => y[1] - x[1])
  }
  console.log(`\n${nom.padEnd(60)} ${String(Math.round(ms)).padStart(6)} ms  processeur ${String(Math.round((c.user + c.system) / 1000)).padStart(5)} ms${dit ? `  — ${dit}` : ''}`)
  const tout = temps(-Infinity, Infinity).filter(([, v]) => v >= 2)
  if (tout.length) console.log(`   en tout : ${tout.slice(0, 7).map(([k, v]) => `${Math.round(v)} ${k}`).join(' · ')}`)
  for (const trou of [...trous].sort((x, y) => y.b - y.a - (x.b - x.a)).slice(0, 4)) {
    if (trou.b - trou.a < 10_000) continue
    const qui = temps(trou.a, trou.b).slice(0, 5)
    console.log(`   trou ${String(Math.round((trou.b - trou.a) / 1000)).padStart(4)} ms : ${qui.map(([k, v]) => `${Math.round(v)} ${k}`).join(' · ') || '(rien du dépôt)'}`)
  }
  await attendre(200)
}

// ── Les scènes ────────────────────────────────────────────────────────────
let page: any = null
async function traverseeEnRoute(): Promise<any> {
  page = (await lire(joueur, '/api/cabinet/traversee')).corps
  let t = page?.traversee
  if (t && !t.fin && t.atteignables.length === 0 && t.ou?.sorte === 'carte') {
    await poster(joueur, `/api/cabinet/traversee/${t.id}/geste`, { rang: t.rang, geste: { quoi: 'abandonner' } })
    t = null
  }
  if (!t || t.fin) {
    page = (await poster(joueur, '/api/cabinet/traversee', {})).corps
    t = page.traversee
  }
  if (t.ou?.sorte === 'cartes') t = (await poster(joueur, `/api/cabinet/traversee/${t.id}/geste`, { rang: t.rang, geste: { quoi: 'cartes', cartes: ['coup-d-oeil', 'echange', 'panacee'] } })).corps.traversee
  return t
}
async function uneEpreuve(): Promise<string> {
  let t = await traverseeEnRoute()
  for (let essai = 0; essai < 3; essai++) {
    const etapes = t.actes.flatMap((a: any) => a.etapes)
    const cible = t.atteignables.map((x: string) => etapes.find((e: any) => e.id === x)).find((e: any) => e && ['epreuve', 'gardien'].includes(e.sorte))
    if (cible) {
      const entree = await poster(joueur, `/api/cabinet/traversee/${t.id}/geste`, { rang: t.rang, geste: { quoi: 'aller', etape: cible.id, ...(cible.choix && { theme: 0 }) } })
      const partie = entree.corps?.traversee?.partie
      if (partie) await poster(joueur, `/api/cabinet/partie/${partie.id}/geste`, { rang: partie.rang, geste: { quoi: 'quitter' } })
      return `${cible.sorte} ${partie?.jeu ?? '—'} (${entree.status}${entree.corps?.error ? ` ${entree.corps.error}` : ''})`
    }
    // Rien à jouer d'ici : une autre traversée.
    await poster(joueur, `/api/cabinet/traversee/${t.id}/geste`, { rang: t.rang, geste: { quoi: 'abandonner' } })
    t = await traverseeEnRoute()
  }
  return 'aucune épreuve atteignable'
}
const fond = (s: number) => etape(`   … le fond qui suit (${s * ATTENTE} s)`, () => attendre(s * ATTENTE * 1000))

// `REVEIL=1` : le réveil seul, sans les scènes de l'après-midi.
if (process.env.REVEIL !== '1') {
await etape('la page des sentiers, à froid', async () => (await lire(joueur, '/api/campagne/sentiers')).status)
await fond(5)
await etape('la page du Cabinet', async () => (await lire(joueur, '/api/cabinet/traversee')).status)
await fond(3)
for (let k = 0; k < 6; k++) {
  if (k % 2 === 1) horloge.t += 11 * 60_000
  await etape(`épreuve du Cabinet ${k + 1}${k % 2 === 1 ? ' (mesure périmée)' : ''}`, uneEpreuve)
  await fond(3)
}
await etape('la page des sentiers, après les mesures neuves', async () => (await lire(joueur, '/api/campagne/sentiers')).status)
await etape('une épreuve de sentier', async () => {
  const e = await poster(joueur, '/api/campagne/sentiers/epreuve', { branche: 'monde', palier: 1 })
  const id = e.corps?.epreuve?.id ?? e.corps?.id
  if (id) await poster(joueur, `/api/campagne/epreuve/${id}/abandon`, {})
  return `${e.status}${e.corps?.error ? ` ${e.corps.error}` : ''}`
})
await fond(3)

// Trois questions signalées d'une série finie du joueur, lue dans la base.
{
  const db = new Database(copie, { readonly: true })
  const s = db.prepare("SELECT id FROM campagne_series WHERE profile_id = ? AND mode = 'serie' AND finie_le IS NOT NULL AND position >= 3 ORDER BY commencee_le DESC LIMIT 1").get(moi) as { id: string } | undefined
  db.close()
  if (s) for (let i = 0; i < 3; i++) await poster(joueur, `/api/campagne/serie/${s.id}/signalement`, { index: i, texte: 'La réponse me semble fausse' })
}
let signales: any[] = []
await etape('le QG : les signalements', async () => {
  const p = await lire(admin, '/api/admin/signalements')
  signales = p.corps?.campagne ?? []
  return `${p.status}, ${signales.length} à relire`
})
if (signales[0]) {
  const q = signales[0]
  await etape('le QG : une question reclassée', async () => (await poster(admin, '/api/admin/campagne/reclasser', { questionId: q.questionId, classement: { categorie: q.categorie, sousTheme: q.sousTheme, difficulte: q.difficulte >= 5 ? 4 : q.difficulte + 1 } })).status)
  await etape('le QG : les signalements, la base refaite', async () => (await lire(admin, '/api/admin/signalements')).status)
}
if (signales[1]) {
  const q = signales[1]
  await etape('le QG : une question corrigée', async () => (await poster(admin, '/api/admin/campagne/corriger', { questionId: q.questionId, correction: { texte: q.texte, reponses: q.reponses, bonne: q.bonne, anecdote: `${q.anecdote ?? ''} Relue.`.trim() } })).status)
  await etape('le QG : les signalements, la base refaite', async () => (await lire(admin, '/api/admin/signalements')).status)
}
await etape('épreuve du Cabinet après la correction', uneEpreuve)
await fond(3)
await etape('le QG : la vue d’ensemble', async () => (await lire(admin, '/api/admin/qg')).status)
await etape('le QG : le direct', async () => (await lire(admin, '/api/admin/qg/direct')).status)
}

// Un réveil : le serveur redémarre sur la même base, son disque effacé comme chez l'hébergeur.
await etape('le réveil', () => banc.redemarrer({ disqueEfface: true }))
joueur = await connecter()
admin = await connexionAnimateur(banc.url)
await etape('l’accueil d’un profil au réveil', async () => {
  const r = await Promise.all(['/api/joueur/moi', '/api/joueur/missions', '/api/joueur/nouveautes'].map(c => lire(joueur, c)))
  return r.map(x => x.status).join(' ')
})
await fond(10)
await etape('le QG au réveil', async () => (await lire(admin, '/api/admin/qg')).status)
await fond(10)
await banc.close()
faux.fermer()
process.exit(0)
