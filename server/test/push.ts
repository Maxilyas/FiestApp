// Un service de push sur la machine, et les téléphones qui s'y abonnent : ce
// que reçoit un vrai téléphone, déchiffré comme il le ferait (RFC 8291). Le
// rappel du soir (`rappel.test.ts`) et les alertes du QG (`qg-erreurs.test.ts`)
// s'en servent ; leur banc n'accepte que lui (`rappels.servicesDePush`).
import assert from 'node:assert/strict'
import { createServer, type IncomingHttpHeaders } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createDecipheriv, createECDH, hkdfSync, randomBytes, type ECDH } from 'node:crypto'

const b64 = (octets: Uint8Array) => Buffer.from(octets).toString('base64url')

/** Un téléphone abonné : sa clé et son secret, pour lire ce qu'on lui envoie. */
export interface Telephone {
  nom: string
  ecdh: ECDH
  auth: Buffer
  endpoint: string
}

/** Un service de push sur la machine : il garde ce qu'il reçoit, et dit morts les téléphones qu'on lui désigne. */
export async function serviceDePush() {
  const recus: { nom: string; entetes: IncomingHttpHeaders; corps: Buffer }[] = []
  const morts = new Set<string>()
  const serveur = createServer((req, res) => {
    const morceaux: Buffer[] = []
    req.on('data', (m: Buffer) => morceaux.push(m))
    req.on('end', () => {
      const nom = (req.url ?? '').replace('/push/', '')
      recus.push({ nom, entetes: req.headers, corps: Buffer.concat(morceaux) })
      res.statusCode = morts.has(nom) ? 410 : 201
      res.end()
    })
  })
  await new Promise<void>(resolve => serveur.listen(0, '127.0.0.1', resolve))
  const url = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`
  return {
    url,
    recus,
    morts,
    /** Les noms des téléphones qui ont reçu quelque chose, dans l'ordre d'arrivée, triés. */
    noms: () => recus.map(r => r.nom).sort(),
    telephone(nom: string): Telephone {
      const ecdh = createECDH('prime256v1')
      ecdh.generateKeys()
      return { nom, ecdh, auth: randomBytes(16), endpoint: `${url}/push/${nom}` }
    },
    fermer: () => new Promise<void>(resolve => serveur.close(() => resolve())),
  }
}

/** L'abonnement tel que le téléphone l'envoie (`PushSubscription.toJSON()`). */
export const abonnementDe = (t: Telephone) => ({
  endpoint: t.endpoint,
  expirationTime: null,
  keys: { p256dh: b64(t.ecdh.getPublicKey()), auth: b64(t.auth) },
})

/** Ce que fait le téléphone d'un message reçu : le déchiffrer avec sa clé et son secret (RFC 8291). */
export function dechiffrer(corps: Buffer, t: Telephone): any {
  const sel = corps.subarray(0, 16)
  const longueur = corps.readUInt8(20)
  const serveur = corps.subarray(21, 21 + longueur)
  const chiffre = corps.subarray(21 + longueur)
  const info = (texte: string, ...suite: Buffer[]) => Buffer.concat([Buffer.from(texte), Buffer.of(0), ...suite])
  const ikm = Buffer.from(hkdfSync('sha256', t.ecdh.computeSecret(serveur), t.auth, info('WebPush: info', t.ecdh.getPublicKey(), serveur), 32))
  const aes = createDecipheriv(
    'aes-128-gcm',
    Buffer.from(hkdfSync('sha256', ikm, sel, info('Content-Encoding: aes128gcm'), 16)),
    Buffer.from(hkdfSync('sha256', ikm, sel, info('Content-Encoding: nonce'), 12)),
  )
  aes.setAuthTag(chiffre.subarray(chiffre.length - 16))
  const clair = Buffer.concat([aes.update(chiffre.subarray(0, chiffre.length - 16)), aes.final()])
  assert.equal(clair[clair.length - 1], 2, 'un seul enregistrement, fermé par son délimiteur')
  return JSON.parse(clair.subarray(0, -1).toString())
}
