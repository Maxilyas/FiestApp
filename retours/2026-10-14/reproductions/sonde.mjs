// Ce qu'un aller-retour vers Turso coûte à un serveur déployé, connexion
// rouverte ou gardée — mesuré par le serveur lui-même (`/healthz`, `base`).
// Une lecture publique, sans cache, d'un seul aller-retour : la page de
// l'historique d'un espace (`/s/:slug/soirees.json` → `archives.list`).
// D'abord douze lectures espacées de 6 s (au-delà des 4 s où le `fetch` du
// serveur referme sa connexion vers Turso), puis, la fenêtre de `/healthz`
// vidée, douze d'affilée. Le 14 octobre 2026, production au repos : 225 ms
// de médiane, puis 29.
//
// À lancer sur un serveur au repos, et rarement : chaque série compte dans
// la minute de `/healthz` et dans le relevé de l'heure.
//
//   BASE=https://<le service> SLUG=<un espace> node retours/2026-10-14/reproductions/sonde.mjs
const BASE = process.env.BASE
const SLUG = process.env.SLUG
if (!BASE || !SLUG) {
  console.error('BASE et SLUG sont à donner : l’adresse du service et un espace qui existe.')
  process.exit(1)
}
const attendre = ms => new Promise(r => setTimeout(r, ms))

// De notre côté, une connexion gardée : seul le côté du serveur change d'une série à l'autre.
const CLE = Symbol.for('undici.globalDispatcher.1')
await (await fetch(`${BASE}/healthz`)).text()
globalThis[CLE] = new globalThis[CLE].constructor({ keepAliveTimeout: 120_000, keepAliveMaxTimeout: 600_000 })
const sante = async () => (await fetch(`${BASE}/healthz`)).json()

async function serie(titre, n, ecartMs) {
  const temps = []
  for (let i = 0; i < n; i++) {
    const t = performance.now()
    const r = await fetch(`${BASE}/s/${SLUG}/soirees.json`)
    await r.arrayBuffer()
    temps.push(Math.round(performance.now() - t))
    if (ecartMs && i < n - 1) await attendre(ecartMs)
  }
  const h = await sante()
  const tri = [...temps].sort((a, b) => a - b)
  console.log(`\n## ${titre}`)
  console.log(`  côté client : médiane ${tri[Math.floor(tri.length / 2)]} ms, pire ${tri.at(-1)} ms`)
  console.log(`  côté serveur, Turso (la minute en cours et la précédente) : ${JSON.stringify(h.base)}`)
  console.log(`  charge : ${JSON.stringify(h.charge)} ; joueurs connectés : ${h.players} ; version ${h.version}`)
}

const avant = await sante()
console.log('avant :', JSON.stringify({ version: avant.version, base: avant.base, players: avant.players }))
await serie('douze lectures espacées de 6 s (la connexion vers Turso se rouvre à chacune)', 12, 6_000)
// La fenêtre de `/healthz` couvre la minute en cours et la précédente : on la laisse se vider.
await attendre(130_000)
await serie('douze lectures d’affilée (la connexion vers Turso est gardée)', 12, 0)
