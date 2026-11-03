// Les routes que la sonde des gels de la production relevait seules, ou avec
// le seul fond qu'elles attendent, une fois le recalcul des difficultés et du
// modèle du savoir passé à six heures (les versions du 3 novembre 2026 après
// 15 h) : la page des sentiers, l'accueil, la page de la campagne, le départ
// d'une série, l'abandon d'une épreuve, les pages du QG. Chacune mesurée sur
// la base du banc grossie au volume de la production (35 000 réponses,
// `../../2026-11-02/reproductions/gels-rejoues.ts` la fabrique), derrière le
// faux Turso, pour le joueur qui a le plus joué : la première fois qu'un
// processus la sert — le code jamais compilé, comme une route rare en
// production —, puis `N` fois, la médiane. Entre deux appels, le serveur se
// tait : ce qu'un appel lance en fond ne compte pas au suivant.
//
// Compilé comme le paquet de production (`../../2026-10-16/reproductions/compiler.ts`) :
//
//   cd server && node --import tsx ../retours/2026-10-16/reproductions/compiler.ts \
//     ../retours/2026-11-03/reproductions/routes-qui-gelent.ts ../export/banc/routes-qui-gelent.mjs
//   node ../export/banc/routes-qui-gelent.mjs
//
// `GEL=1` (root, cgroup v1) : au dixième de cœur, comme l'offre gratuite de
// Render, le faux Turso dehors à 30 ms l'aller-retour, avec les drapeaux du
// ramasse-miettes de la production — chaque route dit alors les gels que la
// sonde du serveur relève (`core/gels.ts`), comme la page « Le serveur » du QG :
//
//   GEL=1 node --single-threaded-gc --no-memory-reducer --max-old-space-size=320 ../export/banc/routes-qui-gelent.mjs
//
// `PROFIL=sentiers` (un bout du nom de la route) : le profileur de V8 sur ses
// appels chauds — `PROFIL_FROID=1`, sur le premier —, le temps propre de
// chaque fonction et celle qui l'appelait, puis le temps cumulé de celles du dépôt.
// `SEULES=sentiers,accueil` : ces routes seulement.
//
// `VIDER=1` (avec `--expose-gc`) : avant chaque appel chaud, huit passes
// entières du ramasse-miettes — V8 jette le code d'une fonction qui n'a pas
// tourné depuis six (`--bytecode-old-age`), et la recompile à son appel
// suivant. Une route qu'on n'appelle qu'une fois de temps en temps, en
// production, le paierait chaque fois ; `--no-flush-bytecode` le garde.
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Session } from 'node:inspector/promises'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'
import { fauxTurso, attendre, DONNEES } from '../../2026-10-14/reproductions/outils.ts'
import { connexionAnimateur, cookieDe, demarrer, ecrire } from '../../../server/test/banc.ts'
import { choisirLeClient, choisirLeTransport } from '../../../server/src/core/distante.ts'
import { releve } from '../../../server/src/core/pouls.ts'
import type { GelDeLaBoucle } from '../../../shared/santeDuServeur.ts'

const GEL = process.env.GEL === '1'
const N = Number(process.env.N ?? 5)
const VIDER = process.env.VIDER === '1'
const ramasser = (globalThis as { gc?: () => void }).gc
if (VIDER && !ramasser) throw new Error('VIDER=1 demande --expose-gc')
const PROFIL = process.env.PROFIL ?? null
const SEULES = (process.env.SEULES ?? '').split(',').filter(Boolean)
choisirLeTransport('leger')
choisirLeClient('minimal')

// Chaque gel que la sonde du serveur relève, en entier.
const gels: GelDeLaBoucle[] = []
const noter = releve.gel.bind(releve)
releve.gel = g => {
  gels.push(g)
  noter(g)
}

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const require = createRequire(path.join(RACINE, 'server/package.json'))
const Database = require('better-sqlite3')
const grossie = path.join(DONNEES, 'permanente-gel-35k.db')
if (!existsSync(grossie)) throw new Error(`pas de base au volume de la production (${grossie}) : lance d'abord gels-rejoues.ts`)
// Ses réponses rangées dans l'ordre du temps, leur `rowid` suivant leur date, comme en production : recopiées en
// arrière par `gels-rejoues.ts`, trente-six se suivaient à rebours, et une seule rend le carnet d'un joueur incertain —
// relu de la base à chaque lecture (`suivisDeLaBase`), ce que la production ne fait qu'exceptionnellement.
const source = path.join(DONNEES, 'permanente-gel-35k-ordre.db')
if (!existsSync(source)) {
  for (const s of ['', '-wal', '-shm']) if (existsSync(grossie + s)) copyFileSync(grossie + s, source + s)
  const db = new Database(source)
  const declencheurs = db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'campagne_reponses'").all() as { name: string; sql: string }[]
  const index = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'campagne_reponses' AND sql IS NOT NULL").all() as { sql: string }[]
  const { sql: table } = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'campagne_reponses'").get() as { sql: string }
  db.transaction(() => {
    for (const d of declencheurs) db.exec(`DROP TRIGGER ${d.name}`)
    db.exec('ALTER TABLE campagne_reponses RENAME TO campagne_reponses_avant')
    db.exec(table)
    db.exec('INSERT INTO campagne_reponses SELECT * FROM campagne_reponses_avant ORDER BY repondue_le, rowid')
    db.exec('DROP TABLE campagne_reponses_avant')
    for (const i of index) db.exec(i.sql)
    for (const d of declencheurs) db.exec(d.sql)
    // Les tranches gardées du journal citent les `rowid` d'avant.
    db.exec('DELETE FROM campagne_tranches')
  })()
  db.close()
}
const dossier = mkdtempSync(path.join(tmpdir(), 'routes-qui-gelent-'))
const copie = path.join(dossier, 'permanente.db')
for (const s of ['', '-wal', '-shm']) if (existsSync(source + s)) copyFileSync(source + s, copie + s)

// Le joueur qui a le plus répondu en campagne, et sa branche la plus avancée : l'épreuve qu'il relance et abandonne.
const lu = new Database(copie, { readonly: true })
const { login, reponses } = lu
  .prepare(
    `SELECT p.login AS login, COUNT(*) AS reponses FROM campagne_reponses r JOIN campagne_series s ON s.id = r.serie_id JOIN profiles p ON p.id = s.profile_id
     GROUP BY s.profile_id ORDER BY reponses DESC LIMIT 1`,
  )
  .get() as { login: string; reponses: number }
lu.close()

const faux = await fauxTurso(copie, { neuf: false })
// Le faux Turso tient la sortie de ce processus : arrêté en route, il ne doit pas lui survivre.
process.on('exit', () => faux.fermer())
if (GEL) {
  mkdirSync('/sys/fs/cgroup/cpu/gel', { recursive: true })
  writeFileSync('/sys/fs/cgroup/cpu/gel/cpu.cfs_quota_us', '10000')
  writeFileSync('/sys/fs/cgroup/cpu/gel/cgroup.procs', String(process.pid))
  await faux.latence(30)
}
const banc = await demarrer({
  quizDbUrl: faux.url,
  cabinet: true,
  expeditionRemplacee: true,
  prechauffageCampagneMs: 500,
  // Comme la production, qui garde ses lectures dix minutes et ses duels trente secondes — le banc, d'office, rien.
  fraicheurDesLecturesMs: 10 * 60_000,
  fraicheurDesDuelsMs: 30_000,
})
const cpu = () => {
  const u = process.cpuUsage()
  return (u.user + u.system) / 1000
}
/** Attend que le serveur se taise : moins de 3 % d'un cœur trois secondes de suite (au dixième de cœur, le dixième de cela). */
const silence = async (auPlusMs = GEL ? 300_000 : 60_000) => {
  const fin = Date.now() + auPlusMs
  let calmes = 0
  while (Date.now() < fin && calmes < 3) {
    const avant = cpu()
    await attendre(1000)
    calmes = cpu() - avant < (GEL ? 3 : 30) ? calmes + 1 : 0
  }
}
const joueur = cookieDe(await ecrire(banc.url, '/api/joueur/connexion', { login, password: 'motdepasse1' }), 'qz_joueur')
const admin = await connexionAnimateur(banc.url)
await silence()
console.log(
  `${GEL ? 'Au dixième de cœur' : 'Sur un vrai cœur'} — le joueur ${login}, ${reponses} réponses de campagne ; ${N} appels chauds par route` +
    `${VIDER ? ', chacun après huit passes du ramasse-miettes' : ''}.\n`,
)

const lire = async (cookie: string, chemin: string) => {
  const r = await fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie, 'X-Requested-With': 'quizz' } })
  const corps = await r.text()
  if (!r.ok) throw new Error(`${chemin} : ${r.status} ${corps.slice(0, 120)}`)
  return corps.length
}
const poster = async (cookie: string, chemin: string, corps: unknown) => {
  const r = await ecrire(banc.url, chemin, corps, cookie)
  const texte = await r.text()
  if (!r.ok) throw new Error(`${chemin} : ${r.status} ${texte.slice(0, 120)}`)
  return JSON.parse(texte) as any
}

// L'épreuve qu'il relance : le palier qui l'attend sur son premier sentier ouvert.
const sentiers = JSON.parse(await (await fetch(`${banc.url}/api/campagne/sentiers`, { headers: { Cookie: joueur } })).text())
const ouvert = (sentiers.sentiers as { branche: string; paliers: number }[]).find(s => s.paliers < 12) ?? { branche: 'foret', paliers: 0 }
const [branche, palier] = [ouvert.branche, ouvert.paliers + 1]

/** Ce qu'un appel laisse à défaire après sa mesure — l'épreuve qu'il a commencée. */
let horsMesure: (() => Promise<unknown>) | null = null
const ROUTES: { nom: string; avant?: () => Promise<unknown>; appel: (prepare?: unknown) => Promise<unknown> }[] = [
  {
    nom: "l'accueil (son en-tête et ses missions de front, puis ses nouveautés)",
    appel: async () => {
      await Promise.all(['/api/joueur/moi?accueil', '/api/joueur/missions'].map(c => lire(joueur, c)))
      await lire(joueur, '/api/joueur/nouveautes')
    },
  },
  { nom: 'GET /api/campagne/sentiers', appel: () => lire(joueur, '/api/campagne/sentiers') },
  { nom: 'la campagne (campagne, carnet, sujets de front)', appel: () => Promise.all(['/api/campagne', '/api/campagne/carnet', '/api/campagne/sujets'].map(c => lire(joueur, c))) },
  { nom: 'GET /api/campagne/carnet', appel: () => lire(joueur, '/api/campagne/carnet') },
  { nom: 'GET /api/campagne/sujets', appel: () => lire(joueur, '/api/campagne/sujets') },
  { nom: 'POST /api/campagne/serie (une série neuve)', appel: () => poster(joueur, '/api/campagne/serie', {}) },
  // Le départ d'une épreuve, puis son abandon, chacun mesuré seul : l'autre se fait hors de la mesure (`horsMesure`).
  {
    nom: 'POST /api/campagne/sentiers/epreuve (le départ)',
    appel: async () => {
      const e = await poster(joueur, '/api/campagne/sentiers/epreuve', { branche, palier })
      horsMesure = () => poster(joueur, `/api/campagne/epreuve/${e.epreuve?.id ?? e.id}/abandon`, {})
    },
  },
  {
    nom: 'POST /api/campagne/epreuve/:id/abandon',
    avant: async () => {
      const e = await poster(joueur, '/api/campagne/sentiers/epreuve', { branche, palier })
      return e.epreuve?.id ?? e.id
    },
    appel: (id?: unknown) => poster(joueur, `/api/campagne/epreuve/${String(id)}/abandon`, {}),
  },
  { nom: 'GET /api/admin/qg', appel: () => lire(admin, '/api/admin/qg') },
  { nom: 'GET /api/admin/campagne/suivi', appel: () => lire(admin, '/api/admin/campagne/suivi') },
  { nom: 'GET /api/admin/campagne (la page)', appel: () => lire(admin, '/api/admin/campagne') },
  { nom: 'GET /api/admin/campagne/sentiers', appel: () => lire(admin, '/api/admin/campagne/sentiers') },
  { nom: 'GET /api/admin/activite', appel: () => lire(admin, '/api/admin/activite') },
]

const mesurer = async (route: (typeof ROUTES)[number]) => {
  const prepare = route.avant ? await route.avant() : undefined
  const premier = gels.length
  const c0 = cpu()
  const t0 = performance.now()
  await route.appel(prepare)
  const mesure = { ms: performance.now() - t0, cpu: cpu() - c0, gels: gels.slice(premier) }
  if (horsMesure) await horsMesure()
  horsMesure = null
  return mesure
}
const ditLesGels = (g: GelDeLaBoucle[]) =>
  g.length === 0 ? '' : `  gels : ${g.map(x => `${x.dureeMs} ms (${x.enCours.map(c => c.quoi).join(', ') || 'rien de nommé'})`).join(' · ')}`
const mediane = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]

/** Le profileur de V8 sur ce qui suit ; `arreter` rend son résumé : le temps propre, puis le temps cumulé des fonctions du dépôt. */
const profiler = async () => {
  const session = new Session()
  session.connect()
  await session.post('Profiler.enable')
  await session.post('Profiler.setSamplingInterval', { interval: 100 })
  await session.post('Profiler.start')
  return {
    arreter: async () => {
      const { profile } = await session.post('Profiler.stop')
      session.disconnect()
      return (appels: number) => {
        const parId = new Map(profile.nodes.map(n => [n.id, n]))
        const parent = new Map<number, number>()
        for (const n of profile.nodes) for (const e of n.children ?? []) parent.set(e, n.id)
        const nom = (id: number | undefined) => {
          const n = id === undefined ? undefined : parId.get(id)
          if (!n) return '—'
          return `${n.callFrame.functionName || '(anonyme)'} · ${n.callFrame.url.replace(/^.*FiestApp\//, '').replace(/^file:\/\//, '')}:${n.callFrame.lineNumber + 1}`
        }
        const pas = (profile.timeDeltas ?? []).reduce((a, b) => a + b, 0) / Math.max(1, profile.samples?.length ?? 1)
        const propre = new Map<string, number>()
        const cumule = new Map<string, number>()
        for (const id of profile.samples ?? []) {
          if (parId.get(id)!.callFrame.functionName === '(idle)') continue
          const cle = `${nom(id)}   ← ${nom(parent.get(id))}`
          propre.set(cle, (propre.get(cle) ?? 0) + pas)
          // Le temps cumulé : chaque échantillon compte à chaque fonction du dépôt de sa pile, une fois — ce qu'un
          // sous-ensemble (les missions, le carnet, le décodage de la base) coûte en tout, quand le temps propre s'émiette.
          const vues = new Set<string>()
          for (let k: number | undefined = id; k !== undefined; k = parent.get(k)) {
            if (!parId.get(k)!.callFrame.url.includes('routes-qui-gelent')) continue
            const f = nom(k)
            if (vues.has(f)) continue
            vues.add(f)
            cumule.set(f, (cumule.get(f) ?? 0) + pas)
          }
        }
        const total = [...propre.values()].reduce((a, b) => a + b, 0)
        console.log(`  le profileur, ${(total / 1000 / appels).toFixed(1)} ms par appel hors attente — le temps propre :`)
        for (const [cle, us] of [...propre].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`    ${((100 * us) / total).toFixed(1).padStart(5)} %  ${cle}`)
        console.log('  — le temps cumulé, fonctions du dépôt :')
        for (const [cle, us] of [...cumule].sort((a, b) => b[1] - a[1]).slice(0, 40)) console.log(`    ${((100 * us) / total).toFixed(1).padStart(5)} %  ${cle}`)
      }
    },
  }
}

for (const route of ROUTES) {
  if (SEULES.length > 0 && !SEULES.some(s => route.nom.includes(s))) continue
  const auProfil = PROFIL !== null && route.nom.includes(PROFIL)
  // `PROFIL_FROID=1` : le profileur sur le premier appel, celui qui compile ; sinon sur les appels chauds.
  const auFroid = auProfil && process.env.PROFIL_FROID === '1' ? await profiler() : null
  const froid = await mesurer(route)
  // Arrêté sur-le-champ, son résumé dit après la ligne de la route.
  const profilDuFroid = auFroid ? await auFroid.arreter() : null
  await silence()
  const auChaud = auProfil && !auFroid ? await profiler() : null
  const chauds: { ms: number; cpu: number; gels: GelDeLaBoucle[] }[] = []
  for (let i = 0; i < N; i++) {
    if (VIDER) for (let k = 0; k < 8; k++) ramasser!()
    chauds.push(await mesurer(route))
    if (!auChaud) await silence()
  }
  console.log(
    `${route.nom}\n  à froid ${froid.ms.toFixed(0).padStart(6)} ms, processeur ${froid.cpu.toFixed(0).padStart(5)} ms${ditLesGels(froid.gels)}\n` +
      `  chaud   ${mediane(chauds.map(c => c.ms)).toFixed(0).padStart(6)} ms, processeur ${mediane(chauds.map(c => c.cpu)).toFixed(0).padStart(5)} ms (médiane de ${N})${ditLesGels(chauds.flatMap(c => c.gels))}`,
  )
  if (profilDuFroid) profilDuFroid(1)
  if (auChaud) (await auChaud.arreter())(N)
  await silence()
}
await banc.close()
faux.fermer()
// Ce qu'il a écrit d'abord, vers un tuyau : un `process.exit` sec en coupait parfois la fin (règle `tests.md`).
await new Promise(fini => process.stdout.write('', fini))
process.exit(0)
