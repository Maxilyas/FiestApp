// Où part le processeur d'une requête : la base du banc du gel reprise telle
// quelle (`banc-gel.ts` l'a laissée dans export/perf-turso/), chaque route
// rejouée à chaud — ses allers-retours vers la base comptés par le faux
// Turso, son processeur rangé par couche (le client libsql, le fetch, Express,
// le code de l'application, le ramasse-miettes…). Le client du banc vit
// dans le même processus : son propre `fetch` vers le serveur compte dans
// la couche du fetch, une milliseconde par requête environ.
//
//   cd server && node --import tsx ../retours/2026-10-16/reproductions/banc-gel-profil.ts   (après banc-gel.ts)
import path from 'node:path'
import { Session } from 'node:inspector/promises'
import { fauxTurso, attendre, DONNEES, vagues } from '../../2026-10-14/reproductions/outils.ts'
import { demarrer, ecrire, cookieDe } from '../../../server/test/banc.ts'

const fichier = path.join(DONNEES, 'permanente-gel.db')
const faux = await fauxTurso(fichier, { neuf: false })
const banc = await demarrer({ quizDbUrl: faux.url, prechauffageCampagneMs: 500, rappels: { intervalleMs: 3_600_000 } })
await attendre(15_000)

const joueurs: string[] = []
for (const k of [0, 2, 5, 9]) {
  const res = await ecrire(banc.url, '/api/joueur/connexion', { login: `joueur${k}`, password: 'motdepasse1' })
  joueurs.push(cookieDe(res, 'qz_joueur'))
}
const lire = async (cookie: string, chemin: string) => {
  const r = await fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } })
  return (await r.text()).length
}
const poster = async (cookie: string, chemin: string, corps: unknown = {}) => (await (await ecrire(banc.url, chemin, corps, cookie)).text()).length

const ROUTES: [string, (c: string) => Promise<number>][] = [
  ['GET /api/joueur/moi?accueil', c => lire(c, '/api/joueur/moi?accueil')],
  ['GET /api/joueur/nouveautes', c => lire(c, '/api/joueur/nouveautes')],
  ['GET /api/joueur/missions', c => lire(c, '/api/joueur/missions')],
  ['GET /api/joueur/moi', c => lire(c, '/api/joueur/moi')],
  ['GET /api/duels', c => lire(c, '/api/duels')],
  ['GET /api/campagne', c => lire(c, '/api/campagne')],
  ['GET /api/campagne/sentiers', c => lire(c, '/api/campagne/sentiers')],
  ['GET /api/campagne/carnet', c => lire(c, '/api/campagne/carnet')],
  ['GET /api/jour', c => lire(c, '/api/jour')],
  ['GET /api/auth/me', c => lire(c, '/api/auth/me')],
]
// Chauffe : chaque route deux fois pour chacun.
for (const c of joueurs) for (const [, f] of ROUTES) for (let i = 0; i < 2; i++) await f(c)

// 1. Les allers-retours de chaque route, comptés par le faux Turso.
await faux.remise()
for (const [nom, f] of ROUTES) {
  await faux.etiquette(nom)
  await f(joueurs[0])
  await attendre(300)
}
await faux.etiquette('(fin)')
const { allers } = await faux.releve()
console.log('\nRoute                              allers  vagues  octets reçus')
for (const [nom] of ROUTES) {
  const a = allers.filter((x: any) => x.etiquette === nom)
  console.log(`${nom.padEnd(34)} ${String(a.length).padStart(6)}  ${String(vagues(a).length).padStart(6)}  ${String(Math.round(a.reduce((s: number, x: any) => s + x.octets, 0) / 1024)).padStart(6)} Ko`)
}

// 2. Le processeur de chaque route, par couche.
const session = new Session()
session.connect()
await session.post('Profiler.enable')
await session.post('Profiler.setSamplingInterval', { interval: 200 })

function couche(cf: { functionName: string; url: string }): string {
  const u = cf.url
  if (cf.functionName === '(garbage collector)') return 'ramasse-miettes'
  if (/@libsql|hrana/.test(u)) return 'client libsql (Hrana : encodage, décodage)'
  if (/undici|webstreams|internal\/fetch|internal\/deps\/undici/.test(u)) return 'fetch (undici) vers la base'
  if (/express|body-parser|cookie|router|send|serve-static|finalhandler|on-finished|compression/.test(u)) return 'Express'
  if (/\/(server\/src|shared)\//.test(u)) return 'code de l’application'
  if (/node:(net|tls|_http|http|internal\/(stream|net|http|streams|tls|url|timers|process|perf))/.test(u) || /^(writev|writeUtf8String|writeBuffer|writeLatin1String)$/.test(cf.functionName)) return 'sockets, flux, minuteurs de Node'
  if (u === '' && /^(parse|stringify)$/.test(cf.functionName)) return 'JSON natif'
  if (u === '') return `natif : ${cf.functionName || '?'}`
  return `autre : ${u.replace(/^.*\/node_modules\//, '')}`
}
function ranger(profile: any) {
  const parId = new Map<number, any>(profile.nodes.map((n: any) => [n.id, n]))
  const parent = new Map<number, number>()
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id)
  const parCouche = new Map<string, number>()
  const parFonction = new Map<string, number>()
  let total = 0
  for (let i = 0; i < profile.samples.length; i++) {
    const dt = (profile.timeDeltas[i + 1] ?? 0) / 1000
    const feuille = parId.get(profile.samples[i])
    if (!feuille || ['(idle)', '(program)'].includes(feuille.callFrame.functionName)) continue
    total += dt
    // La couche : la feuille, sauf un natif appelé depuis une couche connue (JSON.parse du client libsql → libsql).
    let id: number | undefined = profile.samples[i]
    let c = couche(feuille.callFrame)
    if (c.startsWith('natif') || c === 'JSON natif') {
      let p = parent.get(id!)
      while (p !== undefined) {
        const cp = couche(parId.get(p).callFrame)
        if (!cp.startsWith('natif') && cp !== 'JSON natif' && !cp.startsWith('autre')) {
          c = `${cp} — ${c}`
          break
        }
        p = parent.get(p)
      }
    }
    parCouche.set(c, (parCouche.get(c) ?? 0) + dt)
    // La fonction de l'application la plus profonde.
    let f: string | null = null
    while (id !== undefined && !f) {
      const cf = parId.get(id)?.callFrame
      if (cf && /\/(server\/src|shared)\//.test(cf.url)) f = `${cf.functionName || '(anonyme)'} ${cf.url.replace(/^.*\/(server\/src|shared)\//, '$1/')}`
      id = parent.get(id)
    }
    if (f) parFonction.set(f, (parFonction.get(f) ?? 0) + dt)
  }
  return { total, parCouche, parFonction }
}

const N = 15
const cumul = new Map<string, number>()
let cumulTotal = 0
for (const [nom, f] of ROUTES) {
  await session.post('Profiler.start')
  const cpu = process.cpuUsage()
  for (let i = 0; i < N; i++) await f(joueurs[i % joueurs.length])
  const c = process.cpuUsage(cpu)
  const { profile } = await session.post('Profiler.stop')
  const { total, parCouche, parFonction } = ranger(profile)
  cumulTotal += total
  for (const [k, v] of parCouche) cumul.set(k, (cumul.get(k) ?? 0) + v)
  console.log(`\n${nom} — ${((c.user + c.system) / 1000 / N).toFixed(1)} ms de processeur par requête (échantillonné : ${(total / N).toFixed(1)})`)
  for (const [k, v] of [...parCouche].sort((a, b) => b[1] - a[1]).slice(0, 7)) console.log(`   ${(v / N).toFixed(1).padStart(5)} ms  ${Math.round((v / total) * 100)} %  ${k}`)
  const app = [...parFonction].sort((a, b) => b[1] - a[1]).slice(0, 4).filter(([, v]) => v / N >= 0.3)
  if (app.length) console.log(`   dont l’application : ${app.map(([k, v]) => `${k} ${(v / N).toFixed(1)} ms`).join(' · ')}`)
  await attendre(300)
}
console.log(`\nToutes routes confondues (${Math.round(cumulTotal)} ms échantillonnés) :`)
for (const [k, v] of [...cumul].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`   ${Math.round((v / cumulTotal) * 100).toString().padStart(3)} %  ${k}`)

await banc.close()
faux.fermer()
process.exit(0)
