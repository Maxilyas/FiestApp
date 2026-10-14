// L'ancienne base de la campagne (11 059 questions, le 13 octobre au matin)
// contre la nouvelle (21 887, la PR #194 fusionnée le 14 à 0 h 06) : ce que
// coûte sa lecture — processeur, tas —, et le processeur de chaque route de
// la campagne, sur le même serveur. Latence nulle : on ne mesure que le calcul.
// L'ancienne base se tire de git d'abord :
//
//   mkdir -p export/perf-turso/base-ancienne && for f in $(git ls-tree -r --name-only f96c180 server/content/campagne); do git show f96c180:$f > export/perf-turso/base-ancienne/$(basename $f); done
//   cd server && node --expose-gc --import tsx ../retours/2026-10-14/reproductions/base.ts <ancienne|nouvelle>
import { copyFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { DONNEES, RACINE, fauxTurso, attendre } from './outils.ts'
import { demarrer, inscrireProfil, ecrire } from '../../../server/test/banc.ts'
import { BaseDeLaCampagne } from '../../../server/src/core/baseCampagne.ts'

const require = createRequire(path.join(RACINE, 'server/package.json'))
const Database = require('better-sqlite3')
const quelle = process.argv[2] === 'ancienne' ? 'ancienne' : 'nouvelle'
const dossier = quelle === 'ancienne' ? path.join(DONNEES, 'base-ancienne') : path.join(RACINE, 'server/content/campagne')
const gc = (globalThis as any).gc as (() => void) | undefined

// 1. La lecture de la base, seule.
gc?.()
const tas0 = process.memoryUsage().heapUsed
const cpu0 = process.cpuUsage()
const t0 = performance.now()
const base = await BaseDeLaCampagne.depuisLeDossier(dossier)
const lecture = { ms: Math.round(performance.now() - t0), cpuMs: Math.round((process.cpuUsage(cpu0).user + process.cpuUsage(cpu0).system) / 1000) }
gc?.()
const tasMo = Math.round((process.memoryUsage().heapUsed - tas0) / 1024 / 1024)
console.log(`${quelle} : ${base.questions.length} questions, lue en ${lecture.ms} ms (processeur ${lecture.cpuMs} ms), ${tasMo} Mo de tas`)

// 2. Les routes, sur une copie de la base peuplée par la première passe.
const fichier = path.join(DONNEES, `permanente-${quelle}.db`)
for (const s of ['', '-wal', '-shm']) {
  try {
    copyFileSync(path.join(DONNEES, `permanente-aujourdhui.db${s}`), `${fichier}${s}`)
  } catch {}
}
const faux = await fauxTurso(fichier, { neuf: false })
const banc = await demarrer({ quizDbUrl: faux.url, baseDeLaCampagne: base, prechauffageCampagneMs: 600_000, rappels: { intervalleMs: 3_600_000 } })
const lireBase = <T>(f: (db: any) => T): T => {
  const db = new Database(fichier, { readonly: true })
  try {
    return f(db)
  } finally {
    db.close()
  }
}
const mesures: { quoi: string; cpuMs: number; ms: number }[] = []
async function mesurer<T>(quoi: string, f: () => Promise<T>): Promise<T> {
  const c = process.cpuUsage()
  const t = performance.now()
  const r = await f()
  const u = process.cpuUsage(c)
  mesures.push({ quoi, cpuMs: (u.user + u.system) / 1000, ms: performance.now() - t })
  return r
}
const poster = async (cookie: string, chemin: string, corps: unknown = {}) => {
  const r = await ecrire(banc.url, chemin, corps, cookie)
  const j = await r.json().catch(() => null)
  if (!r.ok) throw new Error(`${chemin} → ${r.status} ${j?.error}`)
  return j
}
const lire = async (cookie: string, chemin: string) => {
  const r = await fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie, 'X-Requested-With': 'quizz' } })
  return r.json()
}

// Le premier appel paie ce que la base fait au premier passage (jouables, choix, sujets) : mesuré à part.
const premier = await inscrireProfil(banc.url, `chauffe-${quelle}`, 'Chauffe', '🦊')
await mesurer('1er GET /api/campagne (jouables, choix)', () => lire(premier, '/api/campagne'))
await mesurer('1er POST /api/campagne/serie', () => poster(premier, '/api/campagne/serie', {}))
await mesurer('1er POST /api/campagne/rencontre (dé)', () => poster(premier, '/api/campagne/rencontre'))
await attendre(3000) // le modèle du savoir s'ajuste en fond

for (let k = 0; k < 6; k++) {
  const cookie = await inscrireProfil(banc.url, `base-${quelle}-${k}`, `Base ${k}`, '🦊')
  await mesurer('GET /api/campagne', () => lire(cookie, '/api/campagne'))
  await mesurer('GET /api/campagne/choix', () => lire(cookie, '/api/campagne/choix'))
  await mesurer('GET /api/campagne/sujets', () => lire(cookie, '/api/campagne/sujets'))
  await mesurer('GET /api/campagne/sentiers', () => lire(cookie, '/api/campagne/sentiers'))
  const serie = await mesurer('POST /api/campagne/serie', () => poster(cookie, '/api/campagne/serie', {}))
  const qs = lireBase(db => JSON.parse(db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(serie.id).questions)) as { bonne: number }[]
  for (let i = 0; i < 3; i++) await mesurer('POST /api/campagne/serie/:id/reponse', () => poster(cookie, `/api/campagne/serie/${serie.id}/reponse`, { index: i, choix: qs[i].bonne }))
  await mesurer('POST /api/campagne/serie (avec catégorie)', () => poster(cookie, '/api/campagne/serie', { categories: ['Histoire'] }))
  await mesurer('POST /api/campagne/rencontre (dé)', () => poster(cookie, '/api/campagne/rencontre'))
  await mesurer('POST /api/campagne/sentiers/epreuve', () => poster(cookie, '/api/campagne/sentiers/epreuve', { branche: 'mythes', palier: 1 }))
  await mesurer('POST /api/campagne/defi', () => poster(cookie, '/api/campagne/defi'))
  await mesurer('GET /api/joueur/moi?accueil', () => lire(cookie, '/api/joueur/moi?accueil'))
  await mesurer('GET /api/jour', () => lire(cookie, '/api/jour'))
}
const sante = await (await fetch(`${banc.url}/healthz`)).json()
const parQuoi = new Map<string, { cpu: number[]; ms: number[] }>()
for (const m of mesures) {
  const e = parQuoi.get(m.quoi) ?? { cpu: [], ms: [] }
  e.cpu.push(m.cpuMs)
  e.ms.push(m.ms)
  parQuoi.set(m.quoi, e)
}
const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
const lignes = [...parQuoi].map(([quoi, e]) => ({ quoi, n: e.cpu.length, cpuMs: Math.round(med(e.cpu) * 10) / 10, ms: Math.round(med(e.ms) * 10) / 10 }))
for (const l of lignes) console.log(`${l.quoi.padEnd(44)} n=${l.n} processeur ${String(l.cpuMs).padStart(6)} ms   temps ${String(l.ms).padStart(6)} ms`)
console.log('modèle du savoir :', JSON.stringify(sante.campagne?.savoir))
writeFileSync(path.join(DONNEES, `base-${quelle}.json`), JSON.stringify({ quelle, questions: base.questions.length, lecture, tasMo, lignes, savoir: sante.campagne?.savoir }, null, 2))
await banc.close()
faux.fermer()
process.exit(0)
