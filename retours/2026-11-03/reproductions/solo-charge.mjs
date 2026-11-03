// Combien de joueurs en solo, en même temps, le dixième de cœur tient-il ?
//
//   cd server && node --import tsx ../retours/2026-10-16/reproductions/compiler.ts \
//     ../retours/2026-11-03/reproductions/solo-serveur.ts ../export/banc/solo-serveur.mjs
//   cd .. && node --import tsx retours/2026-11-03/reproductions/solo-charge.mjs --paliers 8,16,32 --duree 90
//
// Le serveur compilé comme le paquet, dans son processus, au dixième de cœur
// (cgroup v1, root), avec les drapeaux du ramasse-miettes de la production,
// sur la base du banc grossie au volume de la production (35 000 réponses,
// 32 profils qui ont leur histoire), derrière le faux Turso à 30 ms. Les
// joueurs, dehors : chacun son profil, le quiz du jour une fois, puis des
// séries, des dés, des épreuves de sentier et des épreuves du Cabinet au
// hasard, quatre à neuf secondes de réflexion avant chaque réponse. Par
// palier : ce que chaque requête a fait attendre, les refus, les erreurs, et
// ce que le serveur dit de sa charge (`/healthz`). Ses chiffres du 3 novembre
// 2026 et ce qu'ils valent en production : `docs/exploitation/capacite.md`.
//
// La base : celle du banc du gel grossie à 35 000 réponses
// (`export/perf-turso/permanente-gel-35k.db`), que
// `retours/2026-11-02/reproductions/gels-rejoues.ts` fabrique à son premier
// passage. Les joueurs se connectent avant la bride : la réserve d'essais
// de connexion en laisse passer vingt d'un coup par adresse, puis attend.
import { spawn } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'
import { fauxTurso } from '../../2026-10-14/reproductions/outils.ts'
import { jourDe } from '../../../shared/jour.ts'

const ici = path.dirname(fileURLToPath(import.meta.url))
const racine = path.resolve(ici, '../../..')
const arg = (nom, d) => {
  const i = process.argv.indexOf(`--${nom}`)
  return i >= 0 ? process.argv[i + 1] : d
}
const PALIERS = String(arg('paliers', '8,16,32')).split(',').map(Number)
const DUREE = Number(arg('duree', 90)) * 1000
const ATTENTE = Number(arg('attente', 150)) * 1000
const [REFLEXION_MIN, REFLEXION_MAX] = String(arg('reflexion', '4,9')).split(',').map(Number)
const BRIDE = !process.argv.includes('--libre')

// ── La base, le faux Turso, le serveur ─────────────────────────────────────
const source = path.join(racine, 'export/perf-turso/permanente-gel-35k.db')
const dossier = mkdtempSync(path.join(tmpdir(), 'solo-'))
const copie = path.join(dossier, 'permanente.db')
for (const s of ['', '-wal', '-shm']) if (existsSync(source + s)) copyFileSync(source + s, copie + s)
const faux = await fauxTurso(copie, { neuf: false })
await faux.latence(30)

const serveur = spawn(
  process.execPath,
  ['--single-threaded-gc', '--no-memory-reducer', '--max-old-space-size=320', path.join(racine, 'export/banc/solo-serveur.mjs')],
  { cwd: path.join(racine, 'server'), env: { ...process.env, BASE_URL: faux.url }, stdio: ['ignore', 'pipe', 'pipe'] },
)
const journalServeur = []
serveur.stderr.on('data', d => journalServeur.push(String(d)))
let url = null
await new Promise((ok, ko) => {
  const t = setTimeout(() => ko(new Error(`le serveur ne démarre pas : ${journalServeur.join('')}`)), 180_000)
  serveur.stdout.on('data', d => {
    journalServeur.push(String(d))
    const m = /PRET (\S+)/.exec(String(d))
    if (m) {
      url = m[1]
      clearTimeout(t)
      ok()
    }
  })
  serveur.on('exit', c => ko(new Error(`serveur arrêté (${c}) : ${journalServeur.join('')}`)))
})

// ── Les appels, mesurés ────────────────────────────────────────────────────
let mesures = null
async function appel(cookie, methode, chemin, corps, route) {
  const t0 = performance.now()
  let status = -1
  let json = null
  try {
    const r = await fetch(url + chemin, {
      method: methode,
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'quizz', ...(cookie && { Cookie: cookie }) },
      body: corps === undefined ? undefined : JSON.stringify(corps),
    })
    status = r.status
    json = await r.json().catch(() => null)
  } catch {
    status = -1
  }
  mesures?.push({ route: route ?? `${methode} ${chemin}`, ms: performance.now() - t0, status })
  return { status, json }
}

// Chaque joueur se connecte avant la bride : un mot de passe se vérifie au scrypt, et la mesure porte sur le jeu.
const joueurs = []
for (let k = 0; k < Math.max(...PALIERS); k++) {
  // Vingt connexions d'un coup par adresse, puis la réserve se recharge (`LoginBudget`) : sur un 429, on attend.
  for (let essai = 0; ; essai++) {
    const r = await fetch(`${url}/api/joueur/connexion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'quizz' },
      body: JSON.stringify({ login: `joueur${k}`, password: 'motdepasse1' }),
    })
    const m = /qz_joueur=([^;]+)/.exec(r.headers.get('set-cookie') ?? '')
    if (m) {
      joueurs.push({ k, cookie: `qz_joueur=${m[1]}`, actif: false })
      break
    }
    if (r.status !== 429 || essai > 30) throw new Error(`joueur${k} : connexion refusée (${r.status})`)
    await new Promise(r => setTimeout(r, 5000))
  }
}

if (BRIDE) {
  mkdirSync('/sys/fs/cgroup/cpu/gel', { recursive: true })
  writeFileSync('/sys/fs/cgroup/cpu/gel/cpu.cfs_quota_us', '10000')
  writeFileSync('/sys/fs/cgroup/cpu/gel/cgroup.procs', String(serveur.pid))
}
console.log(`⚡ joueurs en solo ${BRIDE ? 'au dixième de cœur' : 'sur un vrai cœur'}, paliers ${PALIERS.join(' → ')}, ${DUREE / 1000} s chacun — ${journalServeur.length} lignes au démarrage`)
// Le préchauffage d'après le démarrage — la base, le journal des réponses, le modèle du savoir —, bridé lui aussi.
await new Promise(r => setTimeout(r, ATTENTE))

// ── Ce qu'un joueur fait ───────────────────────────────────────────────────
const dormir = ms => new Promise(r => setTimeout(r, ms))
const reflechir = () => dormir((REFLEXION_MIN + Math.random() * (REFLEXION_MAX - REFLEXION_MIN)) * 1000)
const auHasard = n => Math.floor(Math.random() * n)
let fini = false

async function jouerUneSerie(j, route, depart) {
  let s = depart
  let q = s?.question
  while (q && !fini) {
    await reflechir()
    const r = await appel(j.cookie, 'POST', `/api/campagne/serie/${s.id}/reponse`, { index: q.index, choix: auHasard(q.reponses?.length ?? 4) }, `POST ${route} · réponse`)
    if (r.status !== 200 || r.json?.finie) return
    q = r.json?.suivante
    await dormir(1000 + Math.random() * 2000)
  }
}

async function uneEpreuveDeSentier(j) {
  const e = await appel(j.cookie, 'POST', '/api/campagne/sentiers/epreuve', { branche: ['monde', 'foret', 'stade', 'espace'][auHasard(4)], palier: 1 }, 'POST sentiers/epreuve')
  let ep = e.json?.epreuve ?? e.json
  while (ep?.question && !ep.finie && !fini) {
    await reflechir()
    const r = await appel(j.cookie, 'POST', `/api/campagne/epreuve/${ep.id}/reponse`, { index: ep.question.index, choix: auHasard(ep.question.reponses?.length ?? 4) }, 'POST épreuve · réponse')
    if (r.status !== 200) return
    ep = r.json?.epreuve
    await dormir(1000 + Math.random() * 2000)
  }
}

async function uneEpreuveDuCabinet(j) {
  let page = (await appel(j.cookie, 'GET', '/api/cabinet/traversee', undefined, 'GET cabinet/traversee')).json
  let t = page?.traversee
  if (!t || t.fin) {
    await reflechir()
    t = (await appel(j.cookie, 'POST', '/api/cabinet/traversee', {}, 'POST cabinet/traversee')).json?.traversee
  }
  if (!t) return
  if (t.ou?.sorte === 'cartes') {
    await reflechir()
    t = (await appel(j.cookie, 'POST', `/api/cabinet/traversee/${t.id}/geste`, { rang: t.rang, geste: { quoi: 'cartes', cartes: ['coup-d-oeil', 'echange', 'panacee'] } }, 'POST cabinet · geste')).json?.traversee ?? t
  }
  const etapes = (t.actes ?? []).flatMap(a => a.etapes)
  const cible = (t.atteignables ?? []).map(x => etapes.find(e => e.id === x)).find(e => e && ['epreuve', 'gardien'].includes(e.sorte))
  if (!cible) {
    await appel(j.cookie, 'POST', `/api/cabinet/traversee/${t.id}/geste`, { rang: t.rang, geste: { quoi: 'abandonner' } }, 'POST cabinet · geste')
    return
  }
  await reflechir()
  const entree = await appel(j.cookie, 'POST', `/api/cabinet/traversee/${t.id}/geste`, { rang: t.rang, geste: { quoi: 'aller', etape: cible.id, ...(cible.choix && { theme: 0 }) } }, 'POST cabinet · entrer dans une épreuve')
  const partie = entree.json?.traversee?.partie
  if (!partie) return
  // Trois manches, à peu près : le temps de les jouer, puis « Quitter » — le pli de chaque jeu n'est pas joué ici.
  await dormir(3 * (REFLEXION_MIN + REFLEXION_MAX) * 500)
  if (!fini) await appel(j.cookie, 'POST', `/api/cabinet/partie/${partie.id}/geste`, { rang: partie.rang, geste: { quoi: 'quitter' } }, 'POST cabinet · geste de partie')
}

async function jouer(j) {
  await Promise.all([
    appel(j.cookie, 'GET', '/api/joueur/moi?accueil', undefined, 'GET accueil'),
    appel(j.cookie, 'GET', '/api/joueur/missions', undefined, 'GET missions'),
  ])
  // Le quiz du jour, une fois.
  let e = (await appel(j.cookie, 'POST', '/api/jour/commencer', {}, 'POST jour/commencer')).json
  for (let i = 0; i < 10 && e?.question && !fini; i++) {
    await reflechir()
    await appel(j.cookie, 'POST', '/api/jour/repondre', { jour: jourDe(Date.now()), index: e.question.index, choix: auHasard(4) }, 'POST jour/repondre')
    await dormir(1000 + Math.random() * 2000)
    e = (await appel(j.cookie, 'POST', '/api/jour/suivante', {}, 'POST jour/suivante')).json
  }
  // Puis la campagne et le Cabinet, au hasard.
  while (!fini) {
    await dormir(1000 + Math.random() * 3000)
    const x = Math.random()
    if (x < 0.45) {
      await appel(j.cookie, 'GET', '/api/campagne', undefined, 'GET campagne')
      const s = (await appel(j.cookie, 'POST', '/api/campagne/serie', {}, 'POST campagne/serie')).json
      await jouerUneSerie(j, 'série', s)
    } else if (x < 0.65) {
      const r = (await appel(j.cookie, 'POST', '/api/campagne/rencontre', {}, 'POST campagne/rencontre')).json
      await jouerUneSerie(j, 'dé', r?.serie)
    } else if (x < 0.85) {
      await appel(j.cookie, 'GET', '/api/campagne/sentiers', undefined, 'GET campagne/sentiers')
      await uneEpreuveDeSentier(j)
    } else await uneEpreuveDuCabinet(j)
  }
}

// ── Les paliers ────────────────────────────────────────────────────────────
const pc = (v, p) => {
  if (!v.length) return 0
  const s = [...v].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor((s.length - 1) * p))]
}
const enCours = []
const resultats = []
for (const palier of PALIERS) {
  for (const j of joueurs.slice(0, palier)) {
    if (j.actif) continue
    j.actif = true
    enCours.push(jouer(j).catch(e => console.error(`joueur${j.k} :`, e.message)))
    await dormir(200)
  }
  // Le temps que les nouveaux arrivent au jeu, puis la mesure.
  await dormir(15_000)
  mesures = []
  const t0 = Date.now()
  await dormir(DUREE)
  const lues = mesures
  mesures = null
  const sante = await (await fetch(`${url}/healthz`)).json().catch(() => null)
  const ms = lues.map(m => m.ms)
  const erreurs = lues.filter(m => m.status >= 500 || m.status < 0).length
  const refus = lues.filter(m => m.status >= 400 && m.status < 500).length
  const parRoute = new Map()
  for (const m of lues) parRoute.set(m.route, [...(parRoute.get(m.route) ?? []), m.ms])
  const r = {
    joueurs: palier,
    requetes: lues.length,
    parSeconde: +(lues.length / ((Date.now() - t0) / 1000)).toFixed(2),
    p50: Math.round(pc(ms, 0.5)),
    p95: Math.round(pc(ms, 0.95)),
    max: Math.round(Math.max(0, ...ms)),
    plusDe2s: lues.filter(m => m.ms > 2000).length,
    erreurs,
    refus,
    charge: sante?.charge ?? null,
    routes: [...parRoute].map(([route, v]) => ({ route, n: v.length, p50: Math.round(pc(v, 0.5)), p95: Math.round(pc(v, 0.95)), max: Math.round(Math.max(...v)) })).sort((a, b) => b.p95 - a.p95),
  }
  resultats.push(r)
  console.log(`\n${palier} joueurs : ${r.requetes} requêtes (${r.parSeconde}/s) — attente p50 ${r.p50} ms, p95 ${r.p95} ms, max ${r.max} ms ; ${r.plusDe2s} au-delà de 2 s ; ${r.erreurs} erreurs, ${r.refus} refus`)
  if (r.charge) console.log(`   serveur : processeur ${r.charge.cpuPct} %, gelé ${r.charge.geleePct} % (pire ${r.charge.geleeMaxPct} %), boucle p99 ${r.charge.retardBoucleP99Ms} ms, max ${r.charge.retardBoucleMaxMs} ms`)
  for (const x of r.routes.slice(0, 6)) console.log(`   ${x.route.padEnd(42)} n ${String(x.n).padStart(4)}  p50 ${String(x.p50).padStart(5)}  p95 ${String(x.p95).padStart(5)}  max ${String(x.max).padStart(5)} ms`)
}
fini = true
const sortie = path.join(racine, 'export/evaluations/solo')
mkdirSync(sortie, { recursive: true })
writeFileSync(path.join(sortie, `solo-${BRIDE ? 'bride' : 'libre'}-${Date.now()}.json`), JSON.stringify(resultats, null, 2))
await Promise.race([Promise.all(enCours), dormir(20_000)])
serveur.kill('SIGTERM')
await Promise.race([new Promise(r => serveur.on('exit', r)), dormir(10_000)])
faux.fermer()
process.exit(0)
