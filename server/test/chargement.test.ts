// Ce que coûte un téléphone qui arrive : les fichiers du paquet, servis déjà
// compressés.
//
// Recompressés à chaque arrivée, en brotli rapide — plus gros que gzip —,
// ils prenaient la moitié du processeur d'un scan de QR. Le build les
// compresse une fois (`client/vite.config.ts`) ; le serveur choisit la bonne
// version (`core/precompresse.ts`). On le monte ici sur un dossier jetable,
// comme `server.ts` le monte sur `client/dist/assets` : le paquet n'est pas
// encore construit quand les tests passent.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { brotliCompressSync, brotliDecompressSync, gunzipSync, gzipSync } from 'node:zlib'
import express from 'express'
import compression from 'compression'

/** Une requête telle que le téléphone l'envoie, sans la décompression de `fetch`. */
function get(url: string, headers: Record<string, string> = {}) {
  return new Promise<{ status: number; headers: http.IncomingHttpHeaders; corps: Buffer }>((resolve, reject) => {
    http
      .get(url, { headers }, res => {
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
