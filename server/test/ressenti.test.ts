// Ce que `/healthz` dit du ressenti : le temps des routes d'API et celui d'un
// aller-retour vers la base permanente, mesurés en production.
//
// Les mesures du 4 octobre 2026 supposaient Turso à 30 ms : seule la
// production dit ce qu'un aller-retour coûte vraiment depuis l'hébergeur, et
// donc ce qu'un aller-retour de moins vaut. La route est publique : tout y
// reste agrégé, et une route s'y range sous son modèle, jamais sous
// l'adresse qui porte un identifiant.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { demarrer, ecrire, inscrireProfil } from './banc'
import { avecDelai } from '../src/core/distante'
import { pouls } from '../src/core/pouls'

test('/healthz dit le temps de chaque route d’API, sous son modèle, jamais sous son adresse', async () => {
  const banc = await demarrer()
  try {
    const cookie = await inscrireProfil(banc.url, 'ressenti', 'Ressenti')
    for (let i = 0; i < 3; i++) await fetch(`${banc.url}/api/joueur/moi?leger`, { headers: { Cookie: cookie } })
    // Une série qui n'existe pas : la route répond, et son identifiant ne sort pas.
    const secret = 'serie-introuvable-0042'
    await ecrire(banc.url, `/api/campagne/serie/${secret}/reponse`, { index: 0, choix: 0 }, cookie)
    const brut = await (await fetch(`${banc.url}/healthz`)).text()
    const sante = JSON.parse(brut)
    const moi = sante.routes['GET /api/joueur/moi']
    assert.ok(moi, `la route lue est là : ${Object.keys(sante.routes).join(', ')}`)
    assert.equal(moi.parMin, 3)
    for (const cle of ['p50Ms', 'p95Ms', 'maxMs']) assert.equal(typeof moi[cle], 'number', cle)
    assert.ok(sante.routes['POST /api/campagne/serie/:id/reponse'], 'une adresse à identifiant se range sous son modèle')
    assert.ok(!brut.includes(secret), 'l’identifiant de l’adresse ne sort pas par /healthz')
    // Une base `file:` ne passe pas par le réseau : rien à mesurer, mais le bloc est là.
    assert.deepEqual(Object.keys(sante.base).sort(), ['allersRetoursParMin', 'maxMs', 'p50Ms', 'p95Ms'])
  } finally {
    await banc.close()
  }
})

test('chaque aller-retour vers la base distante se mesure, là où passe le délai', async () => {
  // Un Turso lent, à 40 ms.
  const serveur = createServer((_req, res) => setTimeout(() => res.end('{}'), 40))
  await new Promise<void>(r => serveur.listen(0, '127.0.0.1', r))
  try {
    const avant = pouls.base.lireAvecMediane().n
    const reponse = await avecDelai(5_000)(new Request(`http://127.0.0.1:${(serveur.address() as AddressInfo).port}/v2/pipeline`, { method: 'POST' }))
    assert.equal(reponse.status, 200)
    const apres = pouls.base.lireAvecMediane()
    assert.equal(apres.n, avant + 1)
    assert.ok(apres.max >= 35, `${apres.max} ms mesurées pour un aller-retour de 40 ms`)
  } finally {
    serveur.close()
  }
})
