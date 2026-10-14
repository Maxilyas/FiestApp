// Ce que coûte un téléphone qui arrive : les fichiers du paquet, servis déjà
// compressés.
//
// Recompressés à chaque arrivée, en brotli rapide — plus gros que gzip —,
// ils prenaient la moitié du processeur d'un scan de QR. Le build les
// compresse une fois (`client/vite.config.ts`) ; le serveur choisit la bonne
// version (`core/precompresse.ts`). On le monte ici sur un dossier jetable,
// comme `server.ts` le monte sur `client/dist/assets` : le paquet n'est pas
// encore construit quand les tests passent.
//
// Et ce que coûte un téléphone qui repart avant la fin : rien. Le dernier
// filet du serveur et le relevé de l'heure ne vivent que dans le vrai
// serveur : ce test-là démarre le banc, sur un paquet d'un seul fichier.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import net from 'node:net'
import { randomBytes } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { brotliCompressSync, brotliDecompressSync, gunzipSync, gzipSync } from 'node:zlib'
import express from 'express'
import compression from 'compression'
import { demarrer } from './banc'
import { releve } from '../src/core/pouls'

/** Une requête telle que le téléphone l'envoie, sans la décompression de `fetch` — et qui ne s'attend pas sans fin. */
function get(url: string, headers: Record<string, string> = {}) {
  return new Promise<{ status: number; headers: http.IncomingHttpHeaders; corps: Buffer }>((resolve, reject) => {
    http
      .get(url, { headers, signal: AbortSignal.timeout(10_000) }, res => {
        const morceaux: Buffer[] = []
        res.on('data', m => morceaux.push(m))
        res.on('end', () => resolve({ status: res.statusCode!, headers: res.headers, corps: Buffer.concat(morceaux) }))
      })
      .on('error', reject)
  })
}

test('un fichier du paquet part tel que le build l’a compressé, selon ce que le téléphone accepte', async () => {
  const { servirPrecompresse } = await import('../src/core/precompresse')
  const dossier = mkdtempSync(path.join(tmpdir(), 'quizz-paquet-'))
  const js = Buffer.from(`export const salle = ${JSON.stringify(Array.from({ length: 400 }, (_, i) => `invité ${i}`))}\n`)
  writeFileSync(path.join(dossier, 'index-abc.js'), js)
  // Des marqueurs plutôt que la vraie compression du fichier : on voit
  // ainsi quelle version est partie, et qu'aucune n'a été refaite.
  writeFileSync(path.join(dossier, 'index-abc.js.br'), brotliCompressSync(Buffer.from('// br\n' + js)))
  writeFileSync(path.join(dossier, 'index-abc.js.gz'), gzipSync(Buffer.from('// gz\n' + js)))
  writeFileSync(path.join(dossier, 'sans-version.css'), 'body{}'.repeat(400))

  const app = express()
  app.use(compression())
  app.use('/assets', servirPrecompresse(dossier, { maxAge: '1y', immutable: true }))
  app.use('/assets', express.static(dossier, { maxAge: '1y', immutable: true, fallthrough: false }))
  const serveur = app.listen(0)
  await new Promise(r => serveur.once('listening', r))
  const base = `http://localhost:${(serveur.address() as { port: number }).port}/assets`
  try {
    // Chrome annonce gzip avant br : c'est quand même br qui part.
    const br = await get(`${base}/index-abc.js`, { 'Accept-Encoding': 'gzip, deflate, br, zstd' })
    assert.equal(br.status, 200)
    assert.equal(br.headers['content-encoding'], 'br')
    assert.match(String(br.headers['content-type']), /javascript/)
    assert.match(String(br.headers['cache-control']), /immutable/)
    assert.match(String(br.headers.vary), /Accept-Encoding/)
    assert.equal(brotliDecompressSync(br.corps).toString(), '// br\n' + js.toString(), 'la version du build')

    const gz = await get(`${base}/index-abc.js`, { 'Accept-Encoding': 'gzip' })
    assert.equal(gz.headers['content-encoding'], 'gzip')
    assert.equal(gunzipSync(gz.corps).toString(), '// gz\n' + js.toString())

    const nu = await get(`${base}/index-abc.js`, { 'Accept-Encoding': 'identity' })
    assert.equal(nu.headers['content-encoding'], undefined)
    assert.deepEqual(nu.corps, js, 'sans compression acceptée, le fichier nu')

    // Un fichier que le build n'a pas compressé passe par le chemin d'avant.
    const autre = await get(`${base}/sans-version.css`, { 'Accept-Encoding': 'gzip' })
    assert.equal(autre.status, 200)
    assert.equal(autre.headers['content-encoding'], 'gzip', 'compressé à la volée, comme avant')

    // Rien d'autre ne s'ouvre par là.
    const detour = await get(`${base}/index-abc.js.br/..%2F..%2Fetc%2Fpasswd`, { 'Accept-Encoding': 'br' })
    assert.ok([403, 404].includes(detour.status), `refusé (${detour.status})`)
    assert.equal((await get(`${base}/absent.js`, { 'Accept-Encoding': 'br' })).status, 404)
  } finally {
    serveur.close()
    rmSync(dossier, { recursive: true, force: true })
  }
})

// Un téléphone qui change de page, qu'on ferme ou qui perd le réseau laisse
// son téléchargement en route : `sendFile` le dit par ECONNABORTED, et le
// dernier filet (`erreurDeRequete`) le prenait pour une panne — une ligne au
// journal, une « requête illisible » aux erreurs serveur du QG, de quoi faire
// sonner « À traiter » pour une salle qui scanne et repart.
test('un téléchargement abandonné n’est pas une panne : rien au journal, rien au relevé', async () => {
  const dist = mkdtempSync(path.join(tmpdir(), 'quizz-dist-'))
  mkdirSync(path.join(dist, 'assets'))
  writeFileSync(path.join(dist, 'index.html'), '<!doctype html><html><head><title>FiestApp</title></head><body></body></html>')
  writeFileSync(path.join(dist, 'assets', 'index-abc.js'), 'export {}\n')
  // Deux mégaoctets, que personne ne décompresse : le serveur les lit par
  // morceaux, et le téléphone a le temps de partir avant la fin.
  const br = randomBytes(2_000_000)
  writeFileSync(path.join(dist, 'assets', 'index-abc.js.br'), br)
  const banc = await demarrer({ clientDist: dist })
  const ABANDONS = 10
  // L'erreur tombait juste après que le serveur avait refermé la réponse : on
  // attend chaque fermeture, plutôt qu'un délai.
  const fermees: Promise<unknown>[] = []
  let toutesArrivees!: () => void
  const arrivees = new Promise<void>(r => (toutesArrivees = r))
  banc.server.httpServer.prependListener('request', (_req, res) => {
    fermees.push(new Promise(r => res.once('close', r)))
    if (fermees.length === ABANDONS) toutesArrivees()
  })
  const journal: string[] = []
  const errorAvant = console.error
  const warnAvant = console.warn
  console.error = console.warn = (...args: unknown[]) => {
    journal.push(args.map(a => (a instanceof Error ? `${a.name} ${(a as NodeJS.ErrnoException).code ?? ''} : ${a.message}` : String(a))).join(' '))
  }
  try {
    const { port } = new URL(banc.url)
    /** Un téléphone qui demande le paquet et s'en va : sitôt la demande partie, ou aux premiers octets reçus. */
    const abandonner = (quand: 'à la demande' | 'aux premiers octets') =>
      new Promise<void>((resolve, reject) => {
        const socket = net.connect(Number(port), 'localhost', () => {
          socket.write('GET /assets/index-abc.js HTTP/1.1\r\nHost: localhost\r\nAccept-Encoding: br\r\n\r\n', () => {
            if (quand !== 'à la demande') return
            socket.destroy()
            resolve()
          })
        })
        if (quand === 'aux premiers octets') {
          socket.once('data', () => {
            socket.destroy()
            resolve()
          })
        }
        socket.on('error', reject)
      })
    // Sitôt la demande partie, la réponse n'a pas encore d'en-têtes : la panne
    // comptait au relevé. Aux premiers octets, ils sont partis : Express
    // écrivait la pile au journal.
    for (let i = 0; i < ABANDONS / 2; i++) await abandonner('à la demande')
    for (let i = 0; i < ABANDONS / 2; i++) await abandonner('aux premiers octets')
    await arrivees
    await Promise.all(fermees)
    // Un téléchargement mené au bout passe derrière : le serveur en a fini
    // avec les autres, et le paquet part toujours tel que le build l'a compressé.
    const complet = await get(`${banc.url}/assets/index-abc.js`, { 'Accept-Encoding': 'br' })
    assert.equal(complet.status, 200)
    assert.equal(complet.headers['content-encoding'], 'br')
    assert.ok(complet.corps.equals(br), 'la version du build, entière')
    // Toute autre erreur suit son chemin : un fichier du build disparu depuis
    // le démarrage reçoit sa réponse, pas une attente sans fin.
    rmSync(path.join(dist, 'assets', 'index-abc.js.br'))
    assert.equal((await get(`${banc.url}/assets/index-abc.js`, { 'Accept-Encoding': 'br' })).status, 404)
  } finally {
    console.error = errorAvant
    console.warn = warnAvant
    await banc.close()
    rmSync(dist, { recursive: true, force: true })
  }
  assert.deepEqual(Object.assign({}, ...releve.lignes('banc').map(l => l.erreurs)), {}, 'aucune erreur serveur au relevé de l’heure')
  assert.deepEqual(journal, [], 'rien au journal du serveur')
})
