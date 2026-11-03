// Ce que « Mes quiz » (`GET /api/quizzes`) coûte au processeur, sur une
// bibliothèque au volume de la plus grosse de la production le 3 novembre
// 2026 : 43 quiz, 1 160 questions, 420 Ko de questions en JSON (des totaux lus
// en lecture seule, sans un mot de leur contenu). La sonde des gels l'y a
// relevée seule pendant quatre gels de 1,5 à 2,4 s ce jour-là — 242 à 392 ms
// de processeur au dixième de cœur de l'hébergeur. Les questions sont celles
// des modèles livrés, recopiées et allongées d'une anecdote jusqu'à la taille
// moyenne de la production (360 octets).
//
// Derrière le faux Turso des bancs d'avant, au transport léger et au client
// que la production lit (`CLIENT=libsql` pour l'autre). `N` lectures par
// passage, `PASSAGES` passages, la médiane gardée ; le client du banc vit dans
// le même processus, son `fetch` compte avec le serveur. `PROFIL=chemin` :
// le profileur sur les lectures mesurées, résumé par fonction.
//
// `FROID=1` : un processus neuf sur la bibliothèque que le premier passage a
// laissée — le code jamais compilé, comme une route rare en production —, ses
// huit premières lectures. Avec les drapeaux du ramasse-miettes de la
// production (`DRAPEAUX_DU_RAMASSE_MIETTES`) devant `--import`.
//
//   cd server && N=40 node --import tsx ../retours/2026-11-03/reproductions/liste-des-quiz.ts
//   cd server && FROID=1 node --single-threaded-gc --no-memory-reducer --max-old-space-size=320 --import tsx ../retours/2026-11-03/reproductions/liste-des-quiz.ts
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { Session } from 'node:inspector/promises'
import path from 'node:path'
import { fauxTurso, attendre, DONNEES, RACINE } from '../../2026-10-14/reproductions/outils.ts'
import { connexionAnimateur, demarrer, ecrire } from '../../../server/test/banc.ts'
import { choisirLeClient, choisirLeTransport } from '../../../server/src/core/distante.ts'

choisirLeTransport('leger')
choisirLeClient(process.env.CLIENT === 'libsql' ? 'libsql' : 'minimal')
const QUIZ = 43
const QUESTIONS = 1160
const FROID = process.env.FROID === '1'

const fichier = path.join(DONNEES, 'permanente-liste-des-quiz.db')
const faux = await fauxTurso(fichier, { neuf: !FROID })
const banc = await demarrer({ quizDbUrl: faux.url, prechauffageCampagneMs: 3_600_000, rappels: { intervalleMs: 3_600_000 } })
const admin = await connexionAnimateur(banc.url)
const lire = async () => {
  const r = await fetch(`${banc.url}/api/quizzes`, { headers: { Cookie: admin } })
  if (!r.ok) throw new Error(`GET /api/quizzes : ${r.status}`)
  return (await r.json()) as { questionCount: number }[]
}

if (FROID) {
  await attendre(2000)
  const mesures: string[] = []
  for (let i = 0; i < 8; i++) {
    const avant = process.cpuUsage()
    const t = performance.now()
    await lire()
    const d = process.cpuUsage(avant)
    mesures.push(`${((d.user + d.system) / 1000).toFixed(1)} ms (${(performance.now() - t).toFixed(0)} ms)`)
  }
  console.log(`Un processus neuf, ses lectures l'une après l'autre — processeur (durée) : ${mesures.join(' · ')}`)
  await banc.close()
  faux.fermer()
  process.exit(0)
}

// Les questions des modèles livrés, chacune allongée d'une anecdote : 360 octets en moyenne, comme en production.
const dossier = path.join(RACINE, 'server/content/quiz')
const modeles = readdirSync(dossier)
  .filter(f => f.endsWith('.json'))
  .flatMap(f => (JSON.parse(readFileSync(path.join(dossier, f), 'utf8')) as { questions: Record<string, unknown>[] }).questions)
const ANECDOTE = 'Une anecdote de banc, qui raconte ce que la salle apprend à la révélation, assez longue pour peser ce que pèse une vraie. '
let k = 0
for (let i = 0; i < QUIZ; i++) {
  const combien = Math.round(QUESTIONS / QUIZ) + ((i % 5) - 2)
  const questions = Array.from({ length: combien }, () => ({ ...modeles[k % modeles.length], id: `banc-${k}`, anecdote: ANECDOTE.repeat(1 + (k++ % 2)) }))
  const cree = await ecrire(banc.url, '/api/quizzes', { title: `Quiz du banc ${i + 1}`, questions }, admin)
  if (cree.status !== 201) throw new Error(`création refusée (${cree.status})`)
}
const liste = await lire()
const octets = (await (await fetch(`${banc.url}/api/quizzes`, { headers: { Cookie: admin } })).text()).length
console.log(`${liste.length} quiz, ${liste.reduce((n, q) => n + q.questionCount, 0)} questions, la réponse ${Math.round(octets / 1000)} Ko`)
for (let i = 0; i < 5; i++) await lire()

// La première lecture d'un réveil, dans le même processus : le code déjà compilé, ce que le serveur garde à refaire.
await banc.redemarrer()
const auReveil = process.cpuUsage()
await lire()
const r = process.cpuUsage(auReveil)
console.log(`GET /api/quizzes, la première d'un réveil : ${((r.user + r.system) / 1000).toFixed(1)} ms de processeur`)
for (let i = 0; i < 5; i++) await lire()

const session = process.env.PROFIL ? new Session() : null
if (session) {
  session.connect()
  await session.post('Profiler.enable')
  await session.post('Profiler.setSamplingInterval', { interval: 100 })
  await session.post('Profiler.start')
}
const N = Number(process.env.N ?? 40)
const PASSAGES = Number(process.env.PASSAGES ?? 3)
const passages: number[] = []
for (let p = 0; p < PASSAGES; p++) {
  await faux.remise()
  const avant = process.cpuUsage()
  for (let i = 0; i < N; i++) await lire()
  const d = process.cpuUsage(avant)
  passages.push((d.user + d.system) / 1000 / N)
  await attendre(200)
}
if (session) {
  const { profile } = await session.post('Profiler.stop')
  writeFileSync(process.env.PROFIL!, JSON.stringify(profile))
  // Le temps propre de chaque fonction : où part le processeur d'une lecture.
  const parId = new Map(profile.nodes.map(n => [n.id, n]))
  const propre = new Map<string, number>()
  const pas = (profile.timeDeltas ?? []).reduce((a, b) => a + b, 0) / Math.max(1, profile.samples?.length ?? 1)
  for (const id of profile.samples ?? []) {
    const n = parId.get(id)!
    const cle = `${n.callFrame.functionName || '(anonyme)'} · ${n.callFrame.url.replace(/^.*FiestApp\//, '').replace(/^file:\/\//, '')}:${n.callFrame.lineNumber + 1}`
    propre.set(cle, (propre.get(cle) ?? 0) + pas)
  }
  const total = [...propre.values()].reduce((a, b) => a + b, 0)
  console.log(`\nLe profileur, temps propre par fonction (${(total / 1000).toFixed(0)} ms en tout) :`)
  for (const [cle, us] of [...propre].sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(`  ${((100 * us) / total).toFixed(1).padStart(5)} %  ${cle}`)
}
const releve = await faux.releve()
passages.sort((a, b) => a - b)
console.log(
  `GET /api/quizzes : ${passages[Math.floor(passages.length / 2)].toFixed(1)} ms de processeur (passages : ${passages.map(x => x.toFixed(1)).join(' · ')}) · ` +
    `${(releve.allers.length / N).toFixed(1)} allers-retours · ${Math.round(releve.allers.reduce((n: number, a: { octets: number }) => n + a.octets, 0) / releve.allers.length / 1000)} Ko par aller-retour`,
)
await banc.close()
faux.fermer()
process.exit(0)
