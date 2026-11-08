// Un réveil de la production, au dixième de cœur (`../stabilite-des-joueurs.md`) : le 6 novembre 2026 à 6 h 52, un
// accueil a attendu 27,8 s ; le 7 à 0 h 29, 29,3 s — le journal des réponses, le modèle du savoir, les sujets et les
// tirages, la mesure et la base lancés ensemble, sept gels en cinq minutes.
//
//   cd server && npm run build   # le paquet, comme la production le démarre
//   cd server && GEL=1 node --import tsx ../retours/2026-11-08/reproductions/reveil-au-dixieme.ts
//
// D'abord, sur un vrai cœur et dans ce processus : le banc derrière le faux Turso — un autre processus, 30 ms
// l'aller-retour —, vingt-huit profils et leur histoire au volume de la production (40 000 réponses de campagne, la plus
// assidue 9 750), le journal lu, ses tranches gardées, le modèle du savoir ajusté et gardé — puis vieilli de sept
// heures : au réveil du matin, la production le réajuste.
//
// Puis le réveil : le paquet de la production (`server/dist/index.mjs`), dans un processus à lui, avec ses drapeaux et
// ses variables (le transport léger, le client minimal, l'entretien, la patience), au dixième de cœur dès sa naissance
// (`GEL=1`, root, cgroup v1). Dès qu'il écoute, deux téléphones ouvrent l'accueil — l'accueil et les missions, de
// front —, un troisième dix secondes après, la plus assidue ouvre ses sentiers à trente secondes, et un départ du
// Cabinet part à quarante-cinq. Chaque requête dit son temps ; `/healthz`, quand le modèle est ajusté ; le processeur du
// serveur, tous ses fils, au fil du réveil.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'
import { DONNEES, attendre, fauxTurso } from '../../2026-10-14/reproductions/outils.ts'
import { demarrer, inscrireProfil } from '../../../server/test/banc.ts'
import { CLE_DU_MODELE } from '../../../server/src/core/campagne.ts'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const GEL = process.env.GEL === '1'
const JOUEURS = 28
const SERIES_DE_L_ASSIDUE = 650
const SERIES_DES_AUTRES = 75
const JOUR = 86_400_000
const Database = createRequire(path.join(RACINE, 'server/package.json'))('better-sqlite3')

// ── La préparation, sur un vrai cœur ──────────────────────────────────────
// `REUTILISER=1` : la base du passage d'avant, telle que sa préparation l'a laissée — ses profils, leurs sessions,
// leur histoire, ses tranches —, sans sa traversée du Cabinet : de quoi comparer deux paquets passage après passage.
const fichier = path.join(DONNEES, 'reveil-au-dixieme.db')
const fichierDesCookies = path.join(DONNEES, 'reveil-au-dixieme.cookies.json')
const REUTILISER = process.env.REUTILISER === '1' && existsSync(fichier) && existsSync(fichierDesCookies)
mkdirSync(DONNEES, { recursive: true })
const faux = await fauxTurso(fichier, { neuf: !REUTILISER })
await faux.latence(30)
const cookies: string[] = REUTILISER ? JSON.parse(readFileSync(fichierDesCookies, 'utf8')) : await preparer()
{
  const db = new Database(fichier)
  // Gardé il y a sept heures : au réveil du matin, la production le réajuste à partir de lui.
  db.prepare("UPDATE campagne_meta SET valeur = json_set(valeur, '$.a', ?) WHERE cle = ?").run(Date.now() - 7 * 3_600_000, CLE_DU_MODELE)
  // Le départ du Cabinet d'un passage d'avant : celui-ci part de nouveau, il ne reprend pas.
  for (const table of ['cabinet_traversee_gestes', 'cabinet_traversees']) {
    if (db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table)) db.prepare(`DELETE FROM ${table}`).run()
  }
  db.close()
}
if (REUTILISER) console.log('la base du passage d’avant, réutilisée')

async function preparer(): Promise<string[]> {
const banc = await demarrer({ quizDbUrl: faux.url, cabinet: true, prechauffageCampagneMs: 200 })

const cookies: string[] = []
for (let k = 0; k < JOUEURS; k++) {
  // La réserve des inscriptions en laisse passer une vingtaine d'un coup par adresse, puis attend.
  for (let essai = 0; ; essai++) {
    try {
      cookies.push(await inscrireProfil(banc.url, k === 0 ? 'assidue' : `joueur${k}`, k === 0 ? 'Assidue' : `Joueur ${k}`))
      break
    } catch (e) {
      if (essai > 30) throw e
      await attendre(5_000)
    }
  }
}
const lire = async (url: string, cookie: string, chemin: string) => {
  const r = await fetch(`${url}${chemin}`, { headers: { Cookie: cookie, 'X-Requested-With': 'quizz' } })
  return { status: r.status, corps: (await r.json().catch(() => null)) as any }
}
const ids: string[] = []
for (const c of cookies) ids.push((await lire(banc.url, c, '/api/joueur/moi?leger')).corps.profile.id)

// Leur histoire : des séries de campagne sur la vraie base, écrites derrière le dos du serveur, qui la relit au redémarrage.
const dossier = path.join(RACINE, 'server/content/campagne')
const questions: any[] = readdirSync(dossier)
  .filter(f => f.endsWith('.json'))
  .flatMap(f => JSON.parse(readFileSync(path.join(dossier, f), 'utf8')))
let x = 7
const hasard = () => (x = (x * 16807) % 2147483647) / 2147483647
{
  const db = new Database(fichier)
  const serie = db.prepare("INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode) VALUES (?, ?, ?, 15, 0, ?, ?, ?, 'serie')")
  const reponse = db.prepare('INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le) VALUES (?, ?, ?, ?, ?, ?)')
  const maintenant = Date.now()
  db.transaction(() => {
    ids.forEach((profil, k) => {
      for (let s = 0; s < (k === 0 ? SERIES_DE_L_ASSIDUE : SERIES_DES_AUTRES); s++) {
        const id = `histoire-${k}-${s}`
        const qs = Array.from({ length: 15 }, () => questions[Math.floor(hasard() * questions.length)])
        const le = maintenant - Math.floor(hasard() * 30 * JOUR) - 3_600_000
        const justes = qs.map(() => hasard() < 0.6)
        serie.run(id, profil, JSON.stringify(qs.map(q => ({ id: q.id, categorie: q.categorie, niveau: q.difficulte, reponses: q.reponses }))), justes.filter(Boolean).length, le, le + 600_000)
        qs.forEach((q, i) => reponse.run(id, i, q.id, justes[i] ? q.bonne : (q.bonne + 1) % q.reponses.length, justes[i] ? 1 : 0, le + i * 30_000))
      }
    })
  })()
  const n = db.prepare('SELECT COUNT(*) AS n FROM campagne_reponses').get().n
  // Le modèle que le premier démarrage a gardé ne connaît aucune réponse : vieilli, le redémarrage le réajuste sur elles.
  db.prepare("UPDATE campagne_meta SET valeur = json_set(valeur, '$.a', ?) WHERE cle = ?").run(Date.now() - 7 * 3_600_000, CLE_DU_MODELE)
  db.close()
  console.log(`leur histoire : ${n} réponses de campagne, ${JOUEURS} profils — le banc redémarre et la lit`)
}
await banc.redemarrer()
await lire(banc.url, cookies[0], '/api/joueur/moi?accueil')
// Le journal lu, ses tranches gardées en fond, deux mille réponses chacune ; le modèle du savoir ajusté, puis gardé.
for (const fin = Date.now() + 900_000; ; ) {
  const db = new Database(fichier, { readonly: true })
  const tranches = db.prepare('SELECT COUNT(*) AS n FROM campagne_tranches').get().n
  const garde = db.prepare("SELECT COUNT(*) AS n FROM campagne_meta WHERE cle = ? AND json_extract(valeur, '$.reponses') > 0").get(CLE_DU_MODELE).n
  db.close()
  const sante = (await (await fetch(`${banc.url}/healthz`)).json()) as any
  if (tranches >= 19 && garde === 1 && sante.campagne?.savoir?.reponses > 0) {
    console.log(`prêt pour le réveil : ${tranches} tranches gardées, le modèle ajusté (${sante.campagne.savoir.reponses} réponses) et gardé`)
    break
  }
  if (Date.now() > fin) throw new Error(`la préparation n'aboutit pas : ${tranches} tranches, modèle ${garde ? 'gardé' : 'pas gardé'}`)
  await attendre(2_000)
}
await banc.close()
writeFileSync(fichierDesCookies, JSON.stringify(cookies))
return cookies
}

// ── Le réveil, au dixième de cœur ─────────────────────────────────────────
const port = 41_000 + Math.floor(Math.random() * 2_000)
const url = `http://127.0.0.1:${port}`
const local = path.join(mkdtempSync(path.join(tmpdir(), 'reveil-')), 'quiz.db')
const t0 = performance.now()
const depuis = () => String(Math.round(performance.now() - t0)).padStart(7)
// `PROFIL=1` : le profileur de V8 sur tout le réveil, écrit quand le serveur s'arrête — le temps inclus de chaque fonction.
const PROFIL = process.env.PROFIL === '1'
const profils = mkdtempSync(path.join(tmpdir(), 'reveil-profil-'))
const drapeaux = ['--single-threaded-gc', '--no-memory-reducer', '--max-old-space-size=320', ...(PROFIL ? ['--cpu-prof', `--cpu-prof-dir=${profils}`, '--cpu-prof-interval=1000'] : [])]
// `SERVEUR_DIR` : le dossier `server/` d'un autre arbre — le paquet d'une version d'avant, construit là (`npm run build`).
const serveur = spawn(process.execPath, [...drapeaux, 'dist/index.mjs'], {
  cwd: process.env.SERVEUR_DIR ?? path.join(RACINE, 'server'),
  env: {
    PATH: process.env.PATH,
    PORT: String(port),
    DB_PATH: local,
    QUIZ_DB_URL: faux.url,
    QUIZ_DB_TRANSPORT: 'leger',
    QUIZ_DB_CLIENT: 'minimal',
    QUIZ_DB_KEEPWARM: '1',
    QUIZ_DB_PATIENCE_MS: '150',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})
// `QUOTA=5000` : cinq millisecondes sur cent, la production — dont une requête coûte deux fois le processeur du banc
// (`docs/exploitation/capacite.md`) ; d'office, dix, le dixième de cœur du banc.
const QUOTA = Number(process.env.QUOTA ?? 10_000)
if (GEL) {
  mkdirSync('/sys/fs/cgroup/cpu/gel', { recursive: true })
  writeFileSync('/sys/fs/cgroup/cpu/gel/cpu.cfs_quota_us', String(QUOTA))
  writeFileSync('/sys/fs/cgroup/cpu/gel/cgroup.procs', String(serveur.pid))
}
console.log(`\n== le réveil ${GEL ? `à ${QUOTA / 1000} ms de processeur sur 100` : 'sur un vrai cœur'}`)
const processeur = () => {
  let ns = 0
  for (const fil of readdirSync(`/proc/${serveur.pid}/task`)) {
    try {
      ns += Number(readFileSync(`/proc/${serveur.pid}/task/${fil}/schedstat`, 'utf8').split(' ')[0])
    } catch {}
  }
  return Math.round(ns / 1e6)
}
const journal: string[] = []
const ecouter = (d: Buffer) => {
  for (const ligne of String(d).split('\n')) {
    if (!ligne.trim()) continue
    journal.push(ligne)
    if (/prêt en|\[campagne\]|\[cabinet\]|\[http\]|\[base\]|\[veille\]|erreur|Error/i.test(ligne)) console.log(`${depuis()}  · ${ligne.slice(0, 150)}`)
  }
}
serveur.stdout.on('data', ecouter)
serveur.stderr.on('data', ecouter)
await new Promise<void>((ok, ko) => {
  const t = setTimeout(() => ko(new Error(`le serveur ne démarre pas : ${journal.join('\n')}`)), 300_000)
  const voir = () => {
    if (journal.some(l => l.includes('prêt en'))) {
      clearTimeout(t)
      ok()
    } else setTimeout(voir, 50)
  }
  voir()
  serveur.on('exit', c => ko(new Error(`serveur arrêté (${c}) : ${journal.join('\n')}`)))
})

type Mesure = { quoi: string; ms: number; status: number }
const mesures: Mesure[] = []
async function appel(qui: string, cookie: string, methode: 'GET' | 'POST', chemin: string, corps?: unknown) {
  const debut = performance.now()
  const r = await fetch(`${url}${chemin}`, {
    method: methode,
    headers: { Cookie: cookie, 'X-Requested-With': 'quizz', 'Content-Type': 'application/json', Origin: url },
    body: corps === undefined ? undefined : JSON.stringify(corps),
  })
  const lu = (await r.json().catch(() => null)) as any
  const ms = Math.round(performance.now() - debut)
  mesures.push({ quoi: `${methode} ${chemin.replace(/\?.*$/, '')} · ${qui}`, ms, status: r.status })
  console.log(`${depuis()}  ${`${methode} ${chemin} · ${qui}`.padEnd(52)} ${String(ms).padStart(6)} ms  ${r.status}  (processeur du serveur : ${processeur()} ms)`)
  return lu
}
const ouvrirLAccueil = (qui: string, cookie: string) =>
  Promise.all([appel(qui, cookie, 'GET', '/api/joueur/moi?accueil'), appel(qui, cookie, 'GET', '/api/joueur/missions')])

let modeleAjuste: number | null = null
const sonde = setInterval(async () => {
  try {
    const s = (await (await fetch(`${url}/healthz`)).json()) as any
    if (!modeleAjuste && s.campagne?.savoir?.ajusteLe) {
      modeleAjuste = performance.now() - t0
      console.log(`${depuis()}  · le modèle du savoir est ajusté (processeur du serveur : ${processeur()} ms)`)
    }
  } catch {}
}, 2_000)

// `CABINET_A=180` : le premier départ du Cabinet trois minutes après le réveil, le préchauffage fini — en production, le
// premier de la journée part bien plus tard (le 6 novembre 2026, 1 h 19 après la mise en ligne).
const CABINET_A = Number(process.env.CABINET_A ?? 45) * 1000
const scenes = [
  ouvrirLAccueil('la plus assidue', cookies[0]),
  attendre(500).then(() => ouvrirLAccueil('un joueur', cookies[5])),
  attendre(10_000).then(() => ouvrirLAccueil('un autre', cookies[9])),
  attendre(30_000).then(() => appel('la plus assidue', cookies[0], 'GET', '/api/campagne/sentiers')),
  attendre(CABINET_A).then(async () => {
    await appel('au Cabinet', cookies[12], 'GET', '/api/cabinet/traversee')
    await attendre(2_000)
    await appel('au Cabinet', cookies[12], 'POST', '/api/cabinet/traversee', {})
  }),
]
await Promise.all(scenes)
for (const fin = Date.now() + 300_000; !modeleAjuste && Date.now() < fin; ) await attendre(1_000)
await attendre(5_000)
clearInterval(sonde)
console.log(`\n== ${mesures.length} requêtes ; le modèle ajusté ${modeleAjuste ? `à ${Math.round(modeleAjuste / 1000)} s` : 'jamais'} ; processeur du serveur en tout : ${processeur()} ms`)
const arrete = new Promise(ok => serveur.on('exit', ok))
serveur.kill('SIGTERM')
await Promise.race([arrete, attendre(30_000)])
faux.fermer()
if (PROFIL) {
  const fichiers = readdirSync(profils).filter(f => f.endsWith('.cpuprofile'))
  if (fichiers.length === 0) console.log('pas de profil écrit')
  for (const f of fichiers) {
    const p = JSON.parse(readFileSync(path.join(profils, f), 'utf8'))
    const parId = new Map<number, any>(p.nodes.map((n: any) => [n.id, n]))
    const parent = new Map<number, number>()
    for (const n of p.nodes) for (const c of n.children ?? []) parent.set(c, n.id)
    const inclus = new Map<string, number>()
    const propre = new Map<string, number>()
    for (let i = 0; i < p.samples.length; i++) {
      const vus = new Set<string>()
      const feuille = parId.get(p.samples[i])
      const cle = (n: any) => n.callFrame.functionName || '(anonyme)'
      if (feuille) propre.set(cle(feuille), (propre.get(cle(feuille)) ?? 0) + (p.timeDeltas[i] ?? 0))
      for (let n = feuille; n; n = parent.has(n.id) ? parId.get(parent.get(n.id)!) : undefined) {
        const k = cle(n)
        if (!vus.has(k)) inclus.set(k, (inclus.get(k) ?? 0) + (p.timeDeltas[i] ?? 0))
        vus.add(k)
      }
    }
    console.log(`\n== Le réveil au profileur — temps inclus, ms (le processeur réel ; au dixième de cœur, dix fois plus d'attente)`)
    for (const [k, us] of [...inclus].sort((a, c) => c[1] - a[1]).slice(0, 45)) console.log(`${String(Math.round(us / 100) / 10).padStart(8)}  ${k}`)
    console.log(`\n== Temps propre, ms`)
    for (const [k, us] of [...propre].sort((a, c) => c[1] - a[1]).slice(0, 25)) console.log(`${String(Math.round(us / 100) / 10).padStart(8)}  ${k}`)
  }
}
