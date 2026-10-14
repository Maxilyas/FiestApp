// Le banc des routes : une activité réaliste jouée par les vraies routes —
// quatorze profils au quiz du jour, deux séries chacun, une épreuve de
// sentier, un duel contre Automate, le défi de la semaine, des compagnons, des
// duels classés entre eux, une vraie soirée close —, puis un réveil à disque
// effacé, et chaque route mesurée à froid puis à chaud, à 0 puis à 30 ms par
// aller-retour : ses allers-retours vers Turso, ses instructions, son temps.
// L'écart entre 30 et 0 ms, divisé par 30, dit combien d'allers-retours elle
// attend l'un derrière l'autre (« série≈ »).
//
//   cd server && TAG=aujourdhui node --import tsx ../retours/2026-10-14/reproductions/routes.ts [joueurs]
//   (DEPOT=<un autre arbre> TAG=hier … pour mesurer un autre commit)
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { DEPOT, DONNEES, RACINE, fauxTurso, attendre, vagues, type Aller } from './outils.ts'
const TAG = process.env.TAG ?? 'aujourdhui'
const { demarrer, connexionAnimateur, inscrireProfil, ecrire, creerQuiz, ecranCommun, invite, lancerQuiz, qcm, emitAck, attendre: attendreEvt, patienter } = await import(`${DEPOT}/server/test/banc.ts`)

const require = createRequire(path.join(RACINE, 'server/package.json'))
const Database = require('better-sqlite3')

const JOUEURS = Number(process.argv[2] ?? 14)
const fichier = path.join(DONNEES, `permanente-${TAG}.db`)
const faux = await fauxTurso(fichier)
const banc = await demarrer({ quizDbUrl: faux.url, prechauffageCampagneMs: 1_000, rappels: { intervalleMs: 3_600_000 } })
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
  return { status: r.status, corps: await r.json().catch(() => null) }
}

let graine = 7
const hasard = () => (graine = (graine * 16807) % 2147483647) / 2147483647

// ── La préparation ────────────────────────────────────────────────────────
await faux.etiquette('(préparation)')
const t0 = performance.now()
const admin = await connexionAnimateur(banc.url)
const BRANCHES = ['mythes', 'foret', 'monde', 'espace']
const joueurs: { login: string; cookie: string; id: string }[] = []
for (let k = 0; k < JOUEURS; k++) {
  const login = `joueur${k}`
  const cookie = await inscrireProfil(banc.url, login, `Joueur ${k}`, ['🦊', '🐸', '🦄', '🐙', '🐼', '🐯', '🦁', '🐨'][k % 8])
  const id = (await lire(cookie, '/api/joueur/moi')).corps.profile.id
  joueurs.push({ login, cookie, id })
}
console.log(`${JOUEURS} profils en ${Math.round(performance.now() - t0)} ms`)

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

for (const [k, j] of joueurs.entries()) {
  const force = 0.45 + (k % 5) * 0.1
  await essayer(`jour ${j.login}`, () => jouerLeJour(j.cookie, force))
  for (let s = 0; s < 2; s++) await essayer(`série ${j.login}`, async () => jouerLaSerie(j.cookie, await poster(j.cookie, '/api/campagne/serie', {}), force))
  await essayer(`épreuve ${j.login}`, async () => {
    const e = await poster(j.cookie, '/api/campagne/sentiers/epreuve', { branche: BRANCHES[k % BRANCHES.length], palier: 1 })
    return jouerLaSerie(j.cookie, e.epreuve ?? e, force + 0.2, 'epreuve', 16)
  })
  await essayer(`rencontre ${j.login}`, async () => {
    const r = await poster(j.cookie, '/api/campagne/rencontre')
    return jouerLaSerie(j.cookie, r.serie ?? r, force)
  })
  await essayer(`défi ${j.login}`, async () => jouerLaSerie(j.cookie, await poster(j.cookie, '/api/campagne/defi'), force))
  if (k % 2 === 0) {
    await essayer(`compagnon ${j.login}`, async () => {
      await poster(admin, `/api/admin/profils/${j.id}/confettis`, { confettis: 500, mot: 'banc' })
      await poster(admin, `/api/admin/profils/${j.id}/confettis`, { confettis: 500, mot: 'banc' })
      await poster(j.cookie, '/api/joueur/compagnons', { compagnon: 'loup', porter: true })
    })
  }
}
console.log(`activité solo en ${Math.round(performance.now() - t0)} ms`)

// Des duels classés entre joueurs, et des amis.
for (let k = 0; k + 1 < joueurs.length; k += 2) {
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

// Une vraie soirée : six invités dont quatre profils, un quiz de six questions, close.
await essayer('soirée', async () => {
  const quiz = await creerQuiz(banc.url, admin, Array.from({ length: 6 }, (_, i) => qcm(`Question de soirée ${i + 1} ?`, ['A', 'B', 'C', 'D'], i % 4, 10)), 'Quiz du banc perf')
  const host = await ecranCommun(banc.url, admin)
  const invites = [] as Awaited<ReturnType<typeof invite>>[]
  for (let k = 0; k < 6; k++) invites.push(await invite(banc.url, `Invité ${k}`, '🦊', k < 4 ? { cookie: joueurs[k].cookie } : {}))
  const vue = (sessionId: string, pred: (v: any) => boolean, label: string) => attendreEvt<any>(host, 'session:view', p => p.sessionId === sessionId && pred(p.view), label, 20_000)
  const sessionId = await lancerQuiz(host, quiz)
  let suivante = vue(sessionId, v => v.phase === 'question' && v.qIndex === 0, 'q1')
  for (let q = 0; q < 6; q++) {
    await suivante
    const revelee = vue(sessionId, v => v.phase === 'reveal' && v.qIndex === q, `rev ${q}`)
    for (const [i, inv] of invites.entries()) await emitAck(inv.socket, 'player:action', { sessionId, action: { type: 'answer', choice: (q + i) % 3 === 0 ? q % 4 : (q + 1) % 4 } })
    await revelee
    suivante = q + 1 < 6 ? vue(sessionId, v => v.phase === 'question' && v.qIndex === q + 1, `q${q + 2}`) : vue(sessionId, v => v.phase === 'finished', 'podium')
    ;(host as any).emit('host:command', { sessionId, command: { type: 'next' } })
  }
  await suivante
  ;(host as any).emit('host:endSession', { sessionId })
  await patienter(500)
  const toast = attendreEvt<any>(host, 'toast', () => true, 'clôture', 20_000)
  ;(host as any).emit('host:closeParty', {})
  const t = await toast
  if (t.kind !== 'info') throw new Error(`clôture : ${t.message}`)
  for (const inv of invites) inv.socket.disconnect()
  host.disconnect()
})
await patienter(2_000)
console.log(`préparation finie en ${Math.round(performance.now() - t0)} ms ; ${erreurs.length} erreurs`)
for (const e of erreurs.slice(0, 20)) console.log('  !', e)

const volumes = lireBase(db =>
  Object.fromEntries(
    (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map(t => [t.name, (db.prepare(`SELECT COUNT(*) AS n FROM "${t.name}"`).get() as { n: number }).n]),
  ),
)

// ── Les mesures ───────────────────────────────────────────────────────────
const moi = joueurs[1]
const autre = joueurs[2]
const jourDuJour = lireBase(db => (db.prepare('SELECT jour FROM jour_tirages ORDER BY jour DESC LIMIT 1').get() as { jour: string }).jour)
const uneSerie = lireBase(db => (db.prepare("SELECT id FROM campagne_series WHERE profile_id = ? AND COALESCE(mode,'serie') = 'serie' AND finie_le IS NOT NULL LIMIT 1").get(moi.id) as { id: string } | undefined)?.id)
const uneSoiree = lireBase(db => (db.prepare('SELECT id FROM soirees ORDER BY held_at DESC LIMIT 1').get() as { id: string } | undefined)?.id)

type Appel = [qui: 'joueur' | 'admin' | 'public', chemin: string]
const ROUTES: Appel[] = [
  ['joueur', '/api/joueur/moi?accueil'],
  ['joueur', '/api/joueur/moi?leger'],
  ['joueur', '/api/joueur/moi'],
  ['joueur', '/api/joueur/theme'],
  ['joueur', '/api/joueur/carte'],
  ['joueur', `/api/joueur/carte/${autre.id}`],
  ['joueur', '/api/jour'],
  ['joueur', '/api/jour/classement'],
  ['joueur', `/api/jour/correction/${jourDuJour}`],
  ['joueur', '/api/campagne'],
  ['joueur', '/api/campagne/sentiers'],
  ['joueur', '/api/campagne/carnet'],
  ['joueur', '/api/campagne/carnet/appris'],
  ['joueur', '/api/campagne/choix'],
  ['joueur', '/api/campagne/sujets'],
  ['joueur', '/api/campagne/defi'],
  ['joueur', '/api/campagne/duels'],
  ['joueur', '/api/campagne/rencontres'],
  ['joueur', '/api/campagne/amis'],
  ['joueur', ...(uneSerie ? [`/api/campagne/serie/${uneSerie}/correction`] : ['/api/campagne'])] as Appel,
  ['joueur', '/api/duels'],
  ['joueur', '/api/duels/amis'],
  ['joueur', '/api/duels/croises'],
  ['joueur', '/api/duels/historique'],
  ['joueur', '/api/duels/joueurs'],
  ['joueur', `/api/duels/joueurs/${autre.id}`],
  ['public', '/s/banc/entree.json'],
  ['public', '/s/banc/recap.json'],
  ['public', '/s/banc/bilan.json'],
  ['public', '/s/banc/soirees.json'],
  ...(uneSoiree ? ([['public', `/s/banc/soirees/${uneSoiree}/bilan.json`], ['public', `/s/banc/soirees/${uneSoiree}/recap.json`]] as Appel[]) : []),
  ['admin', '/api/admin/qg/direct'],
  ['admin', '/api/admin/qg'],
  ['admin', '/api/admin/serveur'],
  ['admin', '/api/admin/soirees'],
  ['admin', '/api/admin/jour'],
  ['admin', '/api/admin/jour/suivi'],
  ['admin', '/api/admin/campagne'],
  ['admin', '/api/admin/campagne/suivi'],
  ['admin', '/api/admin/campagne/sentiers'],
  ['admin', '/api/admin/duels/suivi'],
  ['admin', '/api/admin/economie'],
  ['admin', `/api/admin/profils/${moi.id}`],
  ['admin', '/api/admin/gestes'],
  ['admin', '/api/admin/profils'],
  ['public', '/healthz'],
]

interface Mesure { route: string; latence: number; temps: 'froid' | 'chaud'; ms: number; statut: number; allers: number; instructions: number; sqliteMs: number; octets: number }
const mesures: Mesure[] = []
let adminCookie = admin
const cookieDe = (qui: Appel[0]) => (qui === 'joueur' ? moi.cookie : qui === 'admin' ? adminCookie : '')

async function passe(latence: number, temps: 'froid' | 'chaud') {
  await faux.latence(latence)
  for (const [qui, chemin] of ROUTES) {
    const etiquette = `${latence}|${temps}|${chemin}`
    await faux.etiquette(etiquette)
    const debut = performance.now()
    const r = await fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookieDe(qui), 'X-Requested-With': 'quizz' } })
    await r.arrayBuffer()
    const ms = performance.now() - debut
    // Ce qui part après la réponse (écritures en fond) compte pour la route.
    await attendre(latence * 3 + 40)
    mesures.push({ route: chemin, latence, temps, ms, statut: r.status, allers: 0, instructions: 0, sqliteMs: 0, octets: 0 })
  }
  await faux.etiquette('(entre deux)')
}

async function reveil(latence: number) {
  await faux.latence(latence)
  await faux.etiquette(`${latence}|réveil`)
  const debut = performance.now()
  await banc.redemarrer({ disqueEfface: true })
  const ms = performance.now() - debut
  await attendre(200)
  adminCookie = await connexionAnimateur(banc.url)
  return ms
}

const reveils: Record<number, number> = {}
for (const latence of [0, 30]) {
  reveils[latence] = await reveil(latence)
  await passe(latence, 'froid')
  await passe(latence, 'chaud')
}
// Au repos : ce que le serveur fait sans qu'on lui demande rien, une minute et quart.
await faux.latence(30)
await faux.etiquette('(au repos)')
await attendre(75_000)

const releve = await faux.releve()
const parEtiquette = new Map<string, Aller[]>()
for (const a of releve.allers) parEtiquette.set(a.etiquette, [...(parEtiquette.get(a.etiquette) ?? []), a])
for (const m of mesures) {
  const a = parEtiquette.get(`${m.latence}|${m.temps}|${m.route}`) ?? []
  m.allers = a.length
  m.instructions = a.reduce((n, x) => n + x.instructions, 0)
  m.sqliteMs = Math.round(a.reduce((n, x) => n + x.sqliteMs, 0) * 10) / 10
  m.octets = a.reduce((n, x) => n + x.octets, 0)
}
const resume = {
  joueurs: JOUEURS,
  volumes,
  erreurs,
  reveils: Object.fromEntries(Object.entries(reveils).map(([l, ms]) => [l, { ms: Math.round(ms), allers: (parEtiquette.get(`${l}|réveil`) ?? []).length, instructions: (parEtiquette.get(`${l}|réveil`) ?? []).reduce((n, x) => n + x.instructions, 0) }])),
  auRepos: (parEtiquette.get('(au repos)') ?? []).map(a => ({ t: a.t, sqls: a.sqls.map(s => s.slice(0, 100)) })),
  mesures,
  plans: releve.plans.filter(p => p.scans.length > 0).map(p => ({ sql: p.sql.replace(/\s+/g, ' ').slice(0, 400), scans: p.scans, plan: p.plan, n: p.n, ms: Math.round(p.ms * 10) / 10, lignes: p.lignes, etiquettes: [...new Set(p.etiquettes.map(e => e.replace(/^\d+\|(froid|chaud)\|/, '')))].slice(0, 12) })),
  tousLesPlans: releve.plans.map(p => ({ sql: p.sql.replace(/\s+/g, ' ').slice(0, 300), plan: p.plan, n: p.n, ms: Math.round(p.ms * 10) / 10 })),
}
writeFileSync(path.join(DONNEES, `resultats-${TAG}.json`), JSON.stringify(resume, null, 2))

// Le tableau : chaque route, à 30 ms, à froid et à chaud, et les allers-retours en série estimés.
const cle = (m: Mesure) => m.route
const routesVues = [...new Set(mesures.map(cle))]
const trouve = (route: string, latence: number, temps: string) => mesures.find(m => m.route === route && m.latence === latence && m.temps === temps)
console.log('\nroute | statut | froid@30: ms allers instr | chaud@30: ms allers instr | chaud@0 ms | série≈ (chaud) | sqlite ms')
for (const route of routesVues) {
  const f30 = trouve(route, 30, 'froid')!
  const c30 = trouve(route, 30, 'chaud')!
  const c0 = trouve(route, 0, 'chaud')!
  const f0 = trouve(route, 0, 'froid')!
  const serieChaud = Math.max(0, Math.round((c30.ms - c0.ms) / 30))
  const serieFroid = Math.max(0, Math.round((f30.ms - f0.ms) / 30))
  console.log(
    `${route.padEnd(48)} ${c30.statut} | ${String(Math.round(f30.ms)).padStart(5)} ${String(f30.allers).padStart(3)} ${String(f30.instructions).padStart(4)} (série≈${serieFroid}) | ${String(Math.round(c30.ms)).padStart(5)} ${String(c30.allers).padStart(3)} ${String(c30.instructions).padStart(4)} | ${String(Math.round(c0.ms)).padStart(4)} | ${String(serieChaud).padStart(2)} | ${c30.sqliteMs}`,
  )
}
console.log('\nréveils :', JSON.stringify(resume.reveils))
console.log(`au repos (75 s) : ${resume.auRepos.length} allers`)
console.log(`requêtes avec SCAN : ${resume.plans.length}`)
await banc.close()
faux.fermer()
process.exit(0)
