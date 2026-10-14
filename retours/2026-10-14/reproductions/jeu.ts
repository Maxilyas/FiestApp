// Les gestes de jeu et le réveil, sur la base peuplée par `routes.ts` (même
// TAG) : la chronologie d'un réveil à 30 ms par aller-retour, ce que le
// préchauffage de la campagne lit, puis un quiz du jour entier, une série, un
// duel contre Automate et une épreuve, chaque geste mesuré à 0 et à 30 ms.
//
//   cd server && TAG=aujourdhui node --import tsx ../retours/2026-10-14/reproductions/jeu.ts
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { DEPOT, DONNEES, RACINE, fauxTurso, attendre, vagues, type Aller } from './outils.ts'
const TAG = process.env.TAG ?? 'aujourdhui'
const { demarrer, inscrireProfil, ecrire } = await import(`${DEPOT}/server/test/banc.ts`)

const require = createRequire(path.join(RACINE, 'server/package.json'))
const Database = require('better-sqlite3')
const fichier = path.join(DONNEES, `permanente-${TAG}.db`)
const faux = await fauxTurso(fichier, { neuf: false })
const lireBase = <T>(f: (db: any) => T): T => {
  const db = new Database(fichier, { readonly: true })
  try {
    return f(db)
  } finally {
    db.close()
  }
}

// Le réveil, à 30 ms : chaque aller-retour, quand il part, combien il dure.
await faux.latence(30)
await faux.etiquette('réveil')
const t0 = Date.now()
const banc = await demarrer({ quizDbUrl: faux.url, prechauffageCampagneMs: 3_000, rappels: { intervalleMs: 3_600_000 } })
const pret = Date.now() - t0
await faux.etiquette('préchauffage')
await attendre(12_000)

interface Geste { quoi: string; latence: number; ms: number; allers: number; instructions: number }
const gestes: Geste[] = []
let n = 0
async function geste<T>(quoi: string, latence: number, f: () => Promise<T>): Promise<T> {
  const etiquette = `${latence}|${quoi}|${n++}`
  await faux.etiquette(etiquette)
  const debut = performance.now()
  const r = await f()
  const ms = performance.now() - debut
  await attendre(latence * 3 + 40)
  gestes.push({ quoi: `${quoi}`, latence, ms, allers: 0, instructions: 0, ...{ etiquette } } as Geste & { etiquette: string })
  return r
}
const poster = async (cookie: string, chemin: string, corps: unknown = {}) => {
  const r = await ecrire(banc.url, chemin, corps, cookie)
  const j = await r.json().catch(() => null)
  if (!r.ok) throw new Error(`${chemin} → ${r.status} ${j?.error}`)
  return j
}

async function partie(latence: number, login: string) {
  await faux.latence(latence)
  const cookie = await inscrireProfil(banc.url, login, login, '🦊')
  // Le quiz du jour, en entier.
  let etat = await geste('POST /api/jour/commencer', latence, () => poster(cookie, '/api/jour/commencer'))
  const questions = lireBase(db => JSON.parse(db.prepare('SELECT questions FROM jour_tirages WHERE jour = ?').get(etat.jour).questions)) as { bonne: number; reponses: string[] }[]
  while (etat.question) {
    const i = etat.question.index
    await geste('POST /api/jour/repondre', latence, () => poster(cookie, '/api/jour/repondre', { jour: etat.jour, index: i, choix: i % 3 ? questions[i].bonne : (questions[i].bonne + 1) % questions[i].reponses.length }))
    etat = await geste(i === questions.length - 1 ? 'POST /api/jour/suivante (fin)' : 'POST /api/jour/suivante', latence, () => poster(cookie, '/api/jour/suivante'))
  }
  // Une série de campagne.
  const serie = await geste('POST /api/campagne/serie', latence, () => poster(cookie, '/api/campagne/serie', {}))
  const qs = lireBase(db => JSON.parse(db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(serie.id).questions)) as { bonne: number; reponses: string[] }[]
  let fin: any = null
  for (let i = 0; i < 12 && !fin?.finie; i++) {
    fin = await geste(i === 0 ? 'POST /api/campagne/serie/:id/reponse (1re)' : 'POST /api/campagne/serie/:id/reponse', latence, () =>
      poster(cookie, `/api/campagne/serie/${serie.id}/reponse`, { index: i, choix: i < 9 ? qs[i].bonne : (qs[i].bonne + 1) % qs[i].reponses.length }),
    )
  }
  // Un duel contre Automate (le dé).
  const r = await geste('POST /api/campagne/rencontre', latence, () => poster(cookie, '/api/campagne/rencontre'))
  const s = r.serie ?? r
  const qr = lireBase(db => JSON.parse(db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(s.id).questions)) as { bonne: number; reponses: string[] }[]
  fin = null
  for (let i = 0; i < qr.length && !fin?.finie; i++) {
    fin = await geste(i === qr.length - 1 ? 'POST rencontre réponse (dernière)' : 'POST rencontre réponse', latence, () =>
      poster(cookie, `/api/campagne/serie/${s.id}/reponse`, { index: i, choix: i % 2 ? qr[i].bonne : (qr[i].bonne + 1) % qr[i].reponses.length }),
    )
  }
  // Une épreuve de sentier.
  const e = await geste('POST /api/campagne/sentiers/epreuve', latence, () => poster(cookie, '/api/campagne/sentiers/epreuve', { branche: 'mythes', palier: 1 }))
  const ep = e.epreuve ?? e
  const qe = lireBase(db => JSON.parse(db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(ep.id).questions)) as { bonne: number; reponses: string[] }[]
  fin = null
  for (let i = 0; i < 4; i++) {
    fin = await geste('POST /api/campagne/epreuve/:id/reponse', latence, () => poster(cookie, `/api/campagne/epreuve/${ep.id}/reponse`, { index: i, choix: qe[i].bonne }))
  }
}

await partie(0, 'mesure0')
await partie(30, 'mesure30')

const releve = await faux.releve()
const par = new Map<string, Aller[]>()
for (const a of releve.allers) par.set(a.etiquette, [...(par.get(a.etiquette) ?? []), a])
for (const g of gestes as (Geste & { etiquette: string })[]) {
  const a = par.get(g.etiquette) ?? []
  g.allers = a.length
  g.instructions = a.reduce((k, x) => k + x.instructions, 0)
}
// Regroupés par geste : la moyenne à 0 et à 30, et les allers-retours en série estimés.
const sortes = [...new Set(gestes.map(g => g.quoi))]
console.log('geste | n | ms@0 | ms@30 | allers | instr | série≈')
for (const q of sortes) {
  const a0 = gestes.filter(g => g.quoi === q && g.latence === 0)
  const a30 = gestes.filter(g => g.quoi === q && g.latence === 30)
  const moy = (xs: Geste[], f: (g: Geste) => number) => (xs.length ? xs.reduce((k, g) => k + f(g), 0) / xs.length : NaN)
  const m0 = moy(a0, g => g.ms)
  const m30 = moy(a30, g => g.ms)
  console.log(`${q.padEnd(44)} ${String(a30.length).padStart(2)} | ${m0.toFixed(0).padStart(4)} | ${m30.toFixed(0).padStart(4)} | ${moy(a30, g => g.allers).toFixed(1).padStart(4)} | ${moy(a30, g => g.instructions).toFixed(0).padStart(3)} | ${((m30 - m0) / 30).toFixed(1)}`)
}

// Le réveil : la chronologie.
const reveil = par.get('réveil') ?? []
console.log(`\nréveil : prêt en ${pret} ms, ${reveil.length} allers-retours, ${reveil.reduce((k, a) => k + a.instructions, 0)} instructions`)
const debut = Math.min(...reveil.map(a => a.t))
// Les vagues : des allers-retours qui partent ensemble (à 5 ms près).
const lesVagues = vagues(reveil)
console.log(`${lesVagues.length} vagues (≈ allers-retours en série)`)
for (const v of lesVagues) console.log(`  +${String(v[0].t - debut).padStart(4)} ms ×${v.length} : ${v.map(a => a.sqls.filter(s => !/^(BEGIN|COMMIT|ROLLBACK)/.test(s))[0]?.replace(/\s+/g, ' ').slice(0, 70) ?? '(vide)').join(' ‖ ').slice(0, 260)}`)
const pre = par.get('préchauffage') ?? []
console.log(`\npréchauffage : ${pre.length} allers-retours`)
for (const a of pre) console.log(`  ${a.ms.toFixed(0)} ms, ${a.instructions} instr, ${a.octets} o : ${a.sqls.filter(s => !/^(BEGIN|COMMIT|ROLLBACK)/.test(s)).map(s => s.replace(/\s+/g, ' ').slice(0, 90)).join(' ‖ ')}`)
writeFileSync(path.join(DONNEES, `jeu-${TAG}.json`), JSON.stringify({ gestes, reveil, pre }, null, 2))
await banc.close()
faux.fermer()
process.exit(0)
