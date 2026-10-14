// La trace aller par aller de quelques routes, à 30 ms : les vagues (ce qui
// part ensemble) et ce que chaque aller-retour demande — de quoi voir ce qui
// pourrait partir ensemble, et ce qui se relit deux fois dans la même requête.
// Sur une copie de la base peuplée par `routes.ts` (TAG=aujourdhui).
//
//   cd server && node --import tsx ../retours/2026-10-14/reproductions/trace.ts
import { copyFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { DEPOT, DONNEES, RACINE, fauxTurso, attendre, vagues as enVagues, type Aller } from './outils.ts'

const { demarrer, inscrireProfil, ecrire } = await import(`${DEPOT}/server/test/banc.ts`)
const require = createRequire(path.join(RACINE, 'server/package.json'))
const Database = require('better-sqlite3')
const fichier = path.join(DONNEES, 'permanente-trace.db')
for (const s of ['', '-wal', '-shm']) {
  try {
    copyFileSync(path.join(DONNEES, `permanente-${process.env.TAG ?? 'aujourdhui'}.db${s}`), `${fichier}${s}`)
  } catch {}
}
const faux = await fauxTurso(fichier, { neuf: false })
const banc = await demarrer({ quizDbUrl: faux.url, prechauffageCampagneMs: 600_000, rappels: { intervalleMs: 3_600_000 } })
const lireBase = <T>(f: (db: any) => T): T => {
  const db = new Database(fichier, { readonly: true })
  try {
    return f(db)
  } finally {
    db.close()
  }
}
// joueur1 a joué : connexion par son mot de passe.
const cx = await ecrire(banc.url, '/api/joueur/connexion', { login: 'joueur1', password: 'motdepasse1' })
const cookie = /qz_joueur=([^;]+)/.exec(cx.headers.get('set-cookie') ?? '')![0]
const lire = (chemin: string) => fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie, 'X-Requested-With': 'quizz' } }).then(r => r.json())
const poster = (c: string, chemin: string, corps: unknown = {}) => ecrire(banc.url, chemin, corps, c).then(r => r.json())

await faux.latence(30)
async function tracer(quoi: string, f: () => Promise<unknown>) {
  await faux.etiquette(quoi)
  const t = performance.now()
  await f()
  const ms = performance.now() - t
  await attendre(150)
  await faux.etiquette('(entre)')
  const allers = (await faux.releve()).allers.filter(a => a.etiquette === quoi)
  const vagues: Aller[][] = enVagues(allers)
  console.log(`\n## ${quoi} — ${Math.round(ms)} ms, ${allers.length} allers-retours en ${vagues.length} vagues`)
  const debut = allers.length ? Math.min(...allers.map(a => a.t)) : 0
  for (const v of vagues) {
    console.log(`  +${String(v[0].t - debut).padStart(4)} ms ×${v.length}`)
    for (const a of v) console.log(`      [${a.instructions}] ${a.sqls.filter(s => !/^(BEGIN|COMMIT|ROLLBACK)/.test(s)).map(s => s.replace(/\s+/g, ' ').slice(0, 95)).join(' ‖ ').slice(0, 400)}`)
  }
}
// Chauffer les caches comme un serveur réveillé depuis un moment.
for (const c of ['/api/joueur/moi?accueil', '/api/joueur/moi', '/api/jour', '/api/campagne']) await lire(c)

await tracer('GET /api/joueur/moi (profil)', () => lire('/api/joueur/moi'))
await tracer('GET /api/joueur/moi?accueil', () => lire('/api/joueur/moi?accueil'))
await tracer('GET /api/joueur/carte', () => lire('/api/joueur/carte'))

// Le quiz du jour d'un nouveau venu.
const neuf = await inscrireProfil(banc.url, 'trace-jour', 'Trace', '🦊')
let etat: any
await tracer('POST /api/jour/commencer', async () => (etat = await poster(neuf, '/api/jour/commencer')))
const questions = lireBase(db => JSON.parse(db.prepare('SELECT questions FROM jour_tirages WHERE jour = ?').get(etat.jour).questions)) as { bonne: number }[]
await tracer('POST /api/jour/repondre', () => poster(neuf, '/api/jour/repondre', { jour: etat.jour, index: 0, choix: questions[0].bonne }))
await tracer('POST /api/jour/suivante', async () => (etat = await poster(neuf, '/api/jour/suivante')))
for (let i = 1; i < questions.length - 1; i++) {
  await poster(neuf, '/api/jour/repondre', { jour: etat.jour, index: i, choix: questions[i].bonne })
  etat = await poster(neuf, '/api/jour/suivante')
}
const der = questions.length - 1
await tracer('POST /api/jour/repondre (dernière)', () => poster(neuf, '/api/jour/repondre', { jour: etat.jour, index: der, choix: questions[der].bonne }))
await tracer('POST /api/jour/suivante (fin de partie)', () => poster(neuf, '/api/jour/suivante'))
await tracer('GET /api/campagne/carnet', () => lire('/api/campagne/carnet'))
await banc.close()
faux.fermer()
process.exit(0)
