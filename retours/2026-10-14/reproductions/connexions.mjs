// Le `fetch` de Node garde-t-il sa connexion vers Turso entre deux requêtes ?
// Un serveur qui ne dit pas combien de temps il la garde (pas d'en-tête
// `Keep-Alive`) : Node la referme au bout de 4 s de calme (`keepAliveTimeout`
// d'undici), et la requête suivante repaie TCP et TLS — deux allers-retours
// réseau de plus, et le chiffrement, au dixième de cœur. Le canal de
// diagnostic `undici:client:connected` les compte sans aucune dépendance ; et
// le dispatcher global de Node se remplace par un autre, au délai plus long.
//
//   node retours/2026-10-14/reproductions/connexions.mjs
import { createServer } from 'node:http'
import diagnostics from 'node:diagnostics_channel'

const attendre = ms => new Promise(r => setTimeout(r, ms))
let neuves = 0
diagnostics.channel('undici:client:connected').subscribe(() => neuves++)

async function essai(serveur, url, ecartMs, n = 4) {
  let connexions = 0
  const compter = () => connexions++
  serveur.on('connection', compter)
  for (let i = 0; i < n; i++) {
    await (await fetch(url, { method: 'POST', body: '{}' })).text()
    if (i < n - 1) await attendre(ecartMs)
  }
  serveur.off('connection', compter)
  return connexions
}

for (const [titre, delaiServeur] of [
  ['un serveur qui annonce « Keep-Alive: timeout=120 »', 120_000],
  ['un serveur qui ne dit rien de son délai', 0],
]) {
  const serveur = createServer((_req, res) => res.end('{}'))
  serveur.keepAliveTimeout = delaiServeur
  await new Promise(r => serveur.listen(0, '127.0.0.1', r))
  const url = `http://127.0.0.1:${serveur.address().port}/`
  console.log(`\n${titre} (en-tête : ${(await fetch(url)).headers.get('keep-alive')})`)
  for (const ecart of [100, 3_000, 4_500, 8_000]) console.log(`  quatre requêtes à ${ecart} ms d’écart : ${await essai(serveur, url, ecart)} connexion(s) neuve(s)`)
  serveur.close()
}

// Le délai porté à 60 s, sans dépendance : le dispatcher global de Node remplacé par un autre de sa classe.
const serveur = createServer((_req, res) => res.end('{}'))
serveur.keepAliveTimeout = 0
await new Promise(r => serveur.listen(0, '127.0.0.1', r))
const url = `http://127.0.0.1:${serveur.address().port}/`
await (await fetch(url)).text()
const CLE = Symbol.for('undici.globalDispatcher.1')
const Agent = globalThis[CLE].constructor
globalThis[CLE] = new Agent({ keepAliveTimeout: 60_000, keepAliveMaxTimeout: 600_000 })
console.log(`\nle même serveur muet, keepAliveTimeout porté à 60 s : ${await essai(serveur, url, 8_000)} connexion(s) neuve(s) pour quatre requêtes à 8 s d’écart`)
console.log(`(le canal undici:client:connected en a vu ${neuves} en tout)`)
serveur.close()
process.exit(0)
