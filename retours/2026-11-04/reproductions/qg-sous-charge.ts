// Le QG 2 sous charge (la question du propriétaire, le 4 novembre 2026 : « est-ce
// que le QG est optimisé, et peut-il geler le serveur pour les autres
// joueurs ? »). Chaque page du QG mesurée sur la base du banc au volume de la
// production (35 000 réponses, `../../2026-11-02/reproductions/gels-rejoues.ts`
// la grossit), derrière le faux Turso, la semaine du serveur écrite d'un relevé
// horaire réel — celui que ce processus a relevé en servant joueurs et QG,
// complété de ce que le banc ne fait pas vivre (le quota de Turso, les
// téléphones, le temps réel) —, sur seize heures éveillées par jour pendant huit
// jours, comme la production. Pour chaque page : à froid, puis à chaud (la
// médiane de `N`) — son temps, le processeur du processus, le plus long bloc de
// la boucle (une sonde à 2 ms), les gels que la sonde du serveur relève
// (`GEL=1`), les allers-retours vers la base, et les lignes que Turso compterait
// au quota (estimées : une table parcourue en entier compte toutes ses lignes,
// sinon les lignes rendues). Puis le fond : une minute sans rien, et une minute
// le direct ouvert (le flux du poste de commande).
//
//   cd server && node --import tsx ../retours/2026-10-16/reproductions/compiler.ts \
//     ../retours/2026-11-04/reproductions/qg-sous-charge.ts ../export/banc/qg-sous-charge.mjs
//   node ../export/banc/qg-sous-charge.mjs
//   GEL=1 node --single-threaded-gc --no-memory-reducer --max-old-space-size=320 ../export/banc/qg-sous-charge.mjs
//
// `SEULES=serveur,qg` : ces pages seulement (un bout de leur chemin). `ROUTES=70` : autant de routes servies dans
// l'heure du relevé, comme la production ; `SOIREES=300` : autant de soirées archivées ; `ATTENTE_MS=61000` : une
// attente avant chaque appel, et la page du serveur relit sa semaine à chaque fois ; `REGLES_MS` : le tour des règles
// des alertes ; `PROFIL=<dossier>` : le profil du processeur de chaque appel. Les mesures du 4 novembre 2026 :
// `../performance-du-qg.md`.
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { Session } from 'node:inspector/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { monitorEventLoopDelay, performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'
import { fauxTurso, attendre, DONNEES } from '../../2026-10-14/reproductions/outils.ts'
import { connexionAnimateur, cookieDe, demarrer, ecrire } from '../../../server/test/banc.ts'
import { choisirLeClient, choisirLeTransport } from '../../../server/src/core/distante.ts'
import { releve } from '../../../server/src/core/pouls.ts'
import { familleDeLaRequete } from '../../../server/src/core/quotaDeTurso.ts'
import { PAGES_MESUREES } from '../../../shared/telephones.ts'
import type { GelDeLaBoucle } from '../../../shared/santeDuServeur.ts'

const GEL = process.env.GEL === '1'
const N = Number(process.env.N ?? 3)
const SEULES = (process.env.SEULES ?? '').split(',').filter(Boolean)
choisirLeTransport('leger')
choisirLeClient('minimal')

const gels: GelDeLaBoucle[] = []
const noter = releve.gel.bind(releve)
releve.gel = g => {
  gels.push(g)
  noter(g)
}

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const require = createRequire(path.join(RACINE, 'server/package.json'))
const Database = require('better-sqlite3')
const H = 3_600_000
const JOUR = 24 * H

// ── La base au volume de la production ────────────────────────────────────
const source = path.join(DONNEES, 'permanente-gel.db')
const grossie = path.join(DONNEES, 'permanente-gel-35k.db')
if (!existsSync(source)) throw new Error(`pas de base du banc (${source}) : lance d'abord banc-gel.ts`)
if (!existsSync(grossie)) {
  // La recette de `gels-rejoues.ts` : ses séries finies et leurs réponses recopiées en arrière, douze jours à la fois.
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
    for (let k = 1; n() < 35_000 && k <= 20; k++) {
      const ms = k * 12 * JOUR + k * 61_000
      for (const d of duels) duel(decaler({ ...d, code: `${d.code}g${k}` }, ms))
      for (const s of series) {
        serie(decaler({ ...s, id: `${s.id}-g${k}`, duel: s.duel ? `${s.duel}g${k}` : s.duel }, ms))
        for (const r of reponsesDe.all(s.id) as Record<string, unknown>[]) reponse(decaler({ ...r, serie_id: `${s.id}-g${k}` }, ms))
        if (n() >= 35_000) break
      }
    }
  })()
  console.log(`base grossie : ${n()} réponses de campagne`)
  db.close()
}
const dossier = mkdtempSync(path.join(tmpdir(), 'qg-sous-charge-'))
const copie = path.join(dossier, 'permanente.db')
for (const s of ['', '-wal', '-shm']) if (existsSync(grossie + s)) copyFileSync(grossie + s, copie + s)

const lu = new Database(copie, { readonly: true })
const { login, profil } = lu
  .prepare(
    `SELECT p.login AS login, p.id AS profil FROM campagne_reponses r JOIN campagne_series s ON s.id = r.serie_id JOIN profiles p ON p.id = s.profile_id
     GROUP BY s.profile_id ORDER BY COUNT(*) DESC LIMIT 1`,
  )
  .get() as { login: string; profil: string }
const volumes = Object.fromEntries(
  ['profiles', 'campagne_series', 'campagne_reponses', 'campagne_duels', 'jour_parties', 'jour_reponses', 'soirees', 'profile_xp'].map(t => [
    t,
    (lu.prepare(`SELECT COUNT(*) n FROM ${t}`).get() as { n: number }).n,
  ]),
)
lu.close()

const faux = await fauxTurso(copie, { neuf: false })
process.on('exit', () => faux.fermer())
if (GEL) {
  mkdirSync('/sys/fs/cgroup/cpu/gel', { recursive: true })
  writeFileSync('/sys/fs/cgroup/cpu/gel/cpu.cfs_quota_us', '10000')
  writeFileSync('/sys/fs/cgroup/cpu/gel/cgroup.procs', String(process.pid))
  await faux.latence(30)
}
// `REGLES_MS` : le tour des règles des alertes (une minute d'office) ; une heure, et le fond se mesure presque sans elles.
const banc = await demarrer({
  quizDbUrl: faux.url,
  cabinet: true,
  expeditionRemplacee: true,
  prechauffageCampagneMs: 500,
  fraicheurDesLecturesMs: 10 * 60_000,
  fraicheurDesDuelsMs: 30_000,
  ...(process.env.REGLES_MS && { reglesDuQgMs: Number(process.env.REGLES_MS) }),
})
const cpu = () => {
  const u = process.cpuUsage()
  return (u.user + u.system) / 1000
}
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
const lire = async (cookie: string, chemin: string) => {
  const r = await fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie, 'X-Requested-With': 'quizz' } })
  const corps = await r.text()
  if (!r.ok) throw new Error(`${chemin} : ${r.status} ${corps.slice(0, 120)}`)
  return corps.length
}

// ── La semaine du serveur, d'un relevé horaire réel ───────────────────────
// Ce processus est le serveur : son relevé de l'heure a servi ce qui précède. Le banc ne fait pas vivre le quota de
// Turso (le faux ne le dit pas), ni les téléphones, ni le temps réel : ils s'y ajoutent, au volume d'une heure de soirée.
const JOUEUR = ['/api/joueur/moi?accueil', '/api/joueur/missions', '/api/joueur/nouveautes', '/api/campagne/sentiers', '/api/campagne', '/api/campagne/carnet', '/api/campagne/sujets', '/api/jour', '/api/duels', '/api/boutique']
// Les joueurs seulement : une page du QG lue ici ne se mesurerait plus à froid.
for (let k = 0; k < 3; k++) for (const c of JOUEUR) await lire(joueur, c).catch(() => 0)
const { plans } = await faux.releve()
// Soixante requêtes suivies, comme la production en tient : celles du banc, puis des sœurs — nommées de lettres : les
// chiffres, `familleDeLaRequete` les fond en un seul « # ».
const textes = plans.map(p => p.sql)
const lettres = (k: number) => [...String(k)].map(c => 'abcdefghij'[Number(c)]).join('')
for (let k = 0; textes.length < 60; k++) textes.push(`${plans[k % plans.length].sql} /* soeur ${lettres(k)} */`)
// Les routes d'une heure de production : le banc n'en fait passer qu'une dizaine, la production plusieurs dizaines.
const ROUTES = Number(process.env.ROUTES ?? 0)
for (let i = 0; i < ROUTES; i++) {
  const modele = `${i % 3 === 0 ? 'POST' : 'GET'} /api/${['campagne', 'jour', 'joueur', 'duels', 'cabinet', 'profil', 'admin'][i % 7]}/route-${lettres(i)}/:id`
  for (let k = 0; k < 20 + (i % 9) * 15; k++) releve.route(modele, 20 + ((k * 37 + i * 11) % 400), k % 50 === 0 ? 400 : 200)
}
for (const [i, t] of textes.slice(0, 60).entries()) {
  for (let k = 0; k < 5; k++) releve.quota({ lues: 300 + i * 40, ecrites: k === 0 ? 2 : 0, lourdes: [{ requete: familleDeLaRequete(t), lues: 300 + i * 40 }] } as any)
}
for (const page of PAGES_MESUREES) {
  for (let k = 0; k < 100; k++) {
    releve.telephone({ page, lcp: 900 + k * 23, inp: 40 + (k % 17) * 9, cls: (k % 9) / 100, erreurs: k % 31 === 0 ? 1 : 0, appareil: (['android', 'iphone', 'ordinateur'] as const)[k % 3], installee: k % 5 === 0 } as any)
  }
}
const MESSAGES = ['player:action', 'time:sync', 'player:join', 'party:watch', 'host:command', 'host:launch', 'host:endSession', 'host:scene', 'host:hello', 'player:setTeam', 'host:awardTeam']
for (const [i, m] of MESSAGES.entries()) for (let k = 0; k < 40; k++) releve.message(m, 5 + ((i * 7 + k) % 40), k % 23 === 0 ? 'refus' : 'ok')
for (let k = 0; k < 3; k++) releve.gel({ a: Date.now(), dureeMs: 600 + k * 300, processeurMs: 80, ramasseMiettesMs: 20, enCours: [{ quoi: 'GET /api/campagne/sentiers', n: 1 }, { quoi: 'fond · modèle du savoir', n: 1 }] } as any)
const modele = releve.lignes('modele').at(-1)!
const { heure: _h, demarrage: _d, ...reste } = modele
const texte = JSON.stringify(reste)
const parts = Object.entries(reste).map(([k, v]) => `${k} ${JSON.stringify(v ?? null).length}`).join(', ')
console.log(`Le relevé d'une heure : ${texte.length} octets (${parts}).`)

// Huit jours, de 7 h à minuit : un démarrage par jour, une version neuve il y a trois jours.
const ecrit = new Database(copie)
const maintenant = Date.now()
const debutDuJour = (d: number) => Math.floor((maintenant - d * JOUR) / JOUR) * JOUR
const unDemarrage = ecrit.prepare('INSERT OR REPLACE INTO qg_demarrages (id, demarre_le, pret_en_ms, version, env, vu_le, arrete_le) VALUES (?, ?, ?, ?, ?, ?, ?)')
const uneHeure = ecrit.prepare('INSERT OR REPLACE INTO qg_sante (heure, demarrage, releve, maj_le) VALUES (?, ?, ?, ?)')
let heures = 0
ecrit.transaction(() => {
  for (let d = 8; d >= 1; d--) {
    const debut = debutDuJour(d) + 6 * H
    const fin = debut + 17 * H
    const id = `jour-${d}`
    unDemarrage.run(id, debut, 1100, d > 3 ? 'a1b2c3d' : 'e4f5a6b', 'production', fin, fin)
    for (let h = debut; h < fin; h += H) {
      // Récrite pour la dernière fois à la fin de son heure, comme le relevé l'écrit (`maj_le`) : datée de l'instant,
      // toute la semaine tombait dans la marge de relecture de la semaine gardée, et chaque remise à jour la relisait
      // entière. Le serveur ne doit donc pas l'avoir lue avant ces lignes : `REGLES_MS=3600000`, et les règles des
      // alertes, qui la liraient à leur première minute, attendent.
      uneHeure.run(h, id, texte, h + H - 1)
      heures++
    }
  }
})()
// Des soirées archivées, que la base du banc n'a pas : `SOIREES` sur quatre-vingt-dix jours, dans douze salons, douze
// invités chacune — une fiche comme la production les écrit (`v: 3`, ses invités et leurs profils).
const SOIREES = Number(process.env.SOIREES ?? 0)
if (SOIREES > 0) {
  const ecritSoirees = new Database(copie)
  const profils = (ecritSoirees.prepare('SELECT id FROM profiles').all() as { id: string }[]).map(p => p.id)
  const uneSoiree = ecritSoirees.prepare("INSERT OR REPLACE INTO soirees (space_id, id, title, held_at, archived_at, summary, data) VALUES (?, ?, 'Une soirée', ?, ?, ?, '{}')")
  ecritSoirees.transaction(() => {
    for (let s = 0; s < SOIREES; s++) {
      const quand = maintenant - Math.round(((s + 0.5) * 90 * JOUR) / SOIREES)
      const invites = Array.from({ length: 12 }, (_, i) => ({ id: `i-${i}`, joue: true, ...(i < 4 && { profileId: profils[(s + i) % profils.length] }) }))
      const fiche = { v: 3, invites, profils: true, quiz: 2, questions: 24, jouees: invites.length * 24 }
      uneSoiree.run(`salon-${s % 12}`, `soiree-${s}`, quand, quand + 150 * 60_000, JSON.stringify(fiche))
    }
  })()
  ecritSoirees.close()
}
const semaine = (texte.length * heures) / 1e6
console.log(
  `La base : ${Object.entries(volumes).map(([t, n]) => `${t} ${n}`).join(', ')} ; la semaine du serveur, ${heures} heures, ${semaine.toFixed(1)} Mo de relevés.\n` +
    `${GEL ? 'Au dixième de cœur' : 'Sur un vrai cœur'} ; ${N} appels chauds par page.\n`,
)
// Le cache de la page du serveur (une minute) a lu la semaine vide au démarrage : il passe.
await attendre(61_000)
await silence()
// Les gels d'avant la première page : le réveil, et la première lecture de la semaine par les règles des alertes.
console.log(
  `Les gels avant la première page : ${gels.map(g => `${g.dureeMs} ms (${g.enCours.map(c => c.quoi).join(', ') || 'rien de nommé'})`).join(' · ') || 'aucun'}.\n`,
)

// ── Les pages ──────────────────────────────────────────────────────────────
const tailles = new Map<string, number>()
const db = new Database(copie, { readonly: true })
const lignesDe = (table: string) => {
  if (!tailles.has(table)) {
    try {
      tailles.set(table, (db.prepare(`SELECT COUNT(*) n FROM "${table}"`).get() as { n: number }).n)
    } catch {
      tailles.set(table, 0)
    }
  }
  return tailles.get(table)!
}
/** Les lignes que Turso compterait au quota, estimées : une table parcourue en entier les compte toutes, sinon les lignes rendues. */
const auQuota = (ps: { scans: string[]; n: number; lignes: number }[]) =>
  ps.reduce((s, p) => {
    const parcourues = p.scans.map(sc => /^SCAN (\S+)/.exec(sc)?.[1]).filter((t): t is string => !!t)
    return s + (parcourues.length > 0 ? p.n * parcourues.reduce((t, x) => t + lignesDe(x), 0) : p.lignes)
  }, 0)

const PAGES: string[] = [
  '/api/admin/qg',
  '/api/admin/qg/direct',
  '/api/admin/qg/hier',
  '/api/admin/regles',
  '/api/admin/serveur?periode=1h',
  '/api/admin/serveur?periode=24h',
  '/api/admin/serveur?periode=7j',
  '/api/admin/base',
  '/api/admin/erreurs',
  '/api/admin/reperes',
  `/api/admin/reperes/avant-apres?jour=${new Date(maintenant - 7 * JOUR).toISOString().slice(0, 10)}`,
  '/api/admin/gestes',
  '/api/admin/joueurs',
  '/api/admin/joueurs/segments',
  '/api/admin/joueurs/memoire.csv',
  '/api/admin/animateurs',
  '/api/admin/activite',
  '/api/admin/soirees',
  '/api/admin/jour/suivi',
  '/api/admin/jour',
  '/api/admin/jour/consigne',
  '/api/admin/campagne/suivi',
  '/api/admin/campagne',
  '/api/admin/campagne/sentiers',
  '/api/admin/duels/suivi',
  '/api/admin/cabinet',
  '/api/admin/economie',
  '/api/admin/questions',
  '/api/admin/reserves',
  '/api/admin/signalements',
  '/api/admin/annonces',
  '/api/admin/annonces/effets',
  '/api/admin/affiches/effets',
  '/api/admin/maintenance',
  '/api/admin/espaces',
  '/api/admin/profils',
  `/api/admin/profils/${profil}`,
]

// Le plus long bloc de la boucle, d'une sonde à 2 ms — sur un vrai cœur seulement : au dixième de cœur, elle prendrait
// le processeur pour elle, et la sonde du serveur dit les gels.
const sonde = monitorEventLoopDelay({ resolution: 2 })
// `ATTENTE_MS` : une attente avant chaque appel — 61 000, et la page du serveur relit sa semaine à chaque fois, comme
// les alertes chaque heure (son cache garde une minute).
const ATTENTE_MS = Number(process.env.ATTENTE_MS ?? 0)
// `PROFIL=<dossier>` : le profil du processeur de chaque appel, un `.cpuprofile` par appel (où passe le processeur
// d'une page : le client de Turso, le JSON, le calcul) — ses chiffres ne valent plus pour la mesure, la sonde pèse.
const PROFIL = process.env.PROFIL ?? ''
let profils = 0
const mesurer = async (chemin: string) => {
  if (ATTENTE_MS > 0) await attendre(ATTENTE_MS)
  await faux.remise()
  const premier = gels.length
  sonde.reset()
  if (!GEL) sonde.enable()
  const session = PROFIL ? new Session() : null
  if (session) {
    session.connect()
    await session.post('Profiler.enable')
    await session.post('Profiler.setSamplingInterval', { interval: 100 })
    await session.post('Profiler.start')
  }
  const c0 = cpu()
  const t0 = performance.now()
  let octets = 0
  let erreur = ''
  try {
    octets = await lire(admin, chemin)
  } catch (e) {
    erreur = (e as Error).message
  }
  const ms = performance.now() - t0
  const processeur = cpu() - c0
  if (session) {
    const { profile } = await session.post('Profiler.stop')
    mkdirSync(PROFIL, { recursive: true })
    writeFileSync(path.join(PROFIL, `${profils++}-${chemin.replace(/\W+/g, '_')}.cpuprofile`), JSON.stringify(profile))
    session.disconnect()
  }
  sonde.disable()
  const bloc = sonde.max / 1e6
  const r = await faux.releve()
  return { ms, processeur, bloc, octets, erreur, allers: r.allers.length, rendues: r.plans.reduce((s, p) => s + p.lignes, 0), quota: auQuota(r.plans), gels: gels.slice(premier) }
}
const mediane = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
const lignes: string[] = []
for (const chemin of PAGES) {
  if (SEULES.length > 0 && !SEULES.some(s => chemin.includes(s))) continue
  const froid = await mesurer(chemin)
  await silence()
  const chauds = []
  for (let i = 0; i < N; i++) {
    chauds.push(await mesurer(chemin))
    await silence()
  }
  const c = {
    ms: mediane(chauds.map(x => x.ms)),
    processeur: mediane(chauds.map(x => x.processeur)),
    bloc: mediane(chauds.map(x => x.bloc)),
    allers: mediane(chauds.map(x => x.allers)),
    quota: mediane(chauds.map(x => x.quota)),
  }
  const dits = [...froid.gels, ...chauds.flatMap(x => x.gels)].map(g => `${g.dureeMs} ms`).join(' · ')
  const ligne =
    `${chemin}${froid.erreur ? `  ⚠ ${froid.erreur}` : ''}\n` +
    `  à froid ${froid.ms.toFixed(0).padStart(6)} ms  processeur ${froid.processeur.toFixed(0).padStart(5)} ms  bloc ${froid.bloc.toFixed(0).padStart(4)} ms  ${String(froid.allers).padStart(3)} allers  ~${froid.quota} lignes au quota  ${Math.round(froid.octets / 1024)} Ko\n` +
    `  à chaud ${c.ms.toFixed(0).padStart(6)} ms  processeur ${c.processeur.toFixed(0).padStart(5)} ms  bloc ${c.bloc.toFixed(0).padStart(4)} ms  ${String(c.allers).padStart(3)} allers  ~${c.quota} lignes au quota` +
    (dits ? `\n  gels relevés : ${dits}` : '')
  console.log(ligne)
  lignes.push(ligne)
}

// ── Le fond : une minute sans rien, une minute le direct ouvert ──────────
if (SEULES.length === 0 || SEULES.includes('fond')) {
  await silence()
  const minute = async (quoi: string, pendant?: () => Promise<() => void>) => {
    await faux.remise()
    const arreter = pendant ? await pendant() : () => {}
    const premier = gels.length
    const c0 = cpu()
    await attendre(GEL ? 180_000 : 60_000)
    const processeur = cpu() - c0
    arreter()
    const r = await faux.releve()
    const parMinute = GEL ? 3 : 1
    console.log(
      `${quoi} : processeur ${(processeur / parMinute).toFixed(0)} ms la minute, ${(r.allers.length / parMinute).toFixed(1)} allers, ~${Math.round(auQuota(r.plans) / parMinute)} lignes au quota` +
        `${gels.length > premier ? `, gels ${gels.slice(premier).map(g => `${g.dureeMs} ms`).join(' · ')}` : ''}`,
    )
  }
  await minute('Le fond, rien d’ouvert')
  await minute('Le direct ouvert (le flux du poste)', async () => {
    const ac = new AbortController()
    const r = await fetch(`${banc.url}/api/admin/flux`, { headers: { Cookie: admin, Accept: 'text/event-stream' }, signal: ac.signal })
    const lecteur = r.body!.getReader()
    void (async () => {
      try {
        for (;;) if ((await lecteur.read()).done) break
      } catch {}
    })()
    return () => ac.abort()
  })
}
db.close()
await banc.close()
faux.fermer()
await new Promise(fini => process.stdout.write('', fini))
process.exit(0)
