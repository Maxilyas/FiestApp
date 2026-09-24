// Un serveur FiestApp jetable, instrumenté pour la mesure de bout en bout.
//
//   PORT=4100 DOSSIER=export/evaluations/perf-temps-reel/run-x npx tsx serveur.ts
//
// Il démarre le vrai `createQuizServer` sur deux bases neuves (la locale, et
// la « permanente » en `file:` qui tient aussi le rôle du miroir Turso), et
// ouvre à côté, sur PORT+1, une petite page de mesures que lit le générateur
// de charge — dans un AUTRE processus, pour que le CPU de l'un ne se compte
// pas chez l'autre :
//   GET /stats          retard de boucle (p50/p99/max depuis la dernière remise
//                       à zéro), CPU consommé, mémoire
//   GET /stats?reset=1  lit puis remet les compteurs à zéro (début d'une phase)
import { createServer } from 'node:http'
import { mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { monitorEventLoopDelay, performance } from 'node:perf_hooks'
import { createQuizServer } from '../../../../../server/src/server'

const port = Number(process.env.PORT ?? 4100)
const dossier = path.resolve(process.env.DOSSIER ?? 'export/evaluations/perf-temps-reel/serveur')
rmSync(dossier, { recursive: true, force: true })
mkdirSync(dossier, { recursive: true })

const ADMIN = { login: 'admin', password: 'perf-admin-1', slug: 'regie', name: 'Admin' }
const serveur = await createQuizServer({
  port,
  dbPath: path.join(dossier, 'locale.db'),
  quizDbUrl: `file:${path.join(dossier, 'permanente.db')}`,
  admin: ADMIN,
  publicUrl: `http://localhost:${port}`,
})

// Résolution de 1 ms : le p50 au repos vaut donc ~1 ms, pas zéro.
const boucle = monitorEventLoopDelay({ resolution: 1 })
boucle.enable()
let cpu0 = process.cpuUsage()
let t0 = performance.now()
let rssMax = 0
setInterval(() => {
  rssMax = Math.max(rssMax, process.memoryUsage().rss)
}, 200).unref()

const ms = (ns: number) => Math.round(ns / 1e4) / 100
createServer((req, res) => {
  const cpu = process.cpuUsage(cpu0)
  const duree = performance.now() - t0
  const mem = process.memoryUsage()
  rssMax = Math.max(rssMax, mem.rss)
  const corps = {
    dureeMs: Math.round(duree),
    boucle: { p50: ms(boucle.percentile(50)), p99: ms(boucle.percentile(99)), max: ms(boucle.max), moyenne: ms(boucle.mean) },
    // Le CPU en « cœurs » : 1 = un cœur plein pendant toute la phase.
    cpu: { userMs: Math.round(cpu.user / 1000), systemMs: Math.round(cpu.system / 1000), coeurs: +((cpu.user + cpu.system) / 1000 / duree).toFixed(2) },
    memoire: { rssMo: Math.round(mem.rss / 2 ** 20), tasMo: Math.round(mem.heapUsed / 2 ** 20), rssMaxMo: Math.round(rssMax / 2 ** 20) },
  }
  if (req.url?.includes('reset=1')) {
    boucle.reset()
    cpu0 = process.cpuUsage()
    t0 = performance.now()
    rssMax = 0
  }
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(corps))
}).listen(port + 1)

console.log(`PRET ${serveur.port}`)

// SIGTERM : on éteint proprement, pour que `--cpu-prof` écrive son profil.
const eteindre = async () => {
  await serveur.close()
  process.exit(0)
}
process.on('SIGTERM', eteindre)
process.on('SIGINT', eteindre)
