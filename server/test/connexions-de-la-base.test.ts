// Les connexions vers la base permanente (la revue du 14 octobre 2026,
// `retours/2026-10-14/`, perf-turso-13). En production, un aller-retour vers
// Turso coûtait 29 ms sur une connexion gardée et 225 ms sur une connexion à
// rouvrir — le `fetch` de Node referme une connexion inactive au bout de 4 s
// —, et rien ne disait laquelle des deux on payait. Le serveur compte ce que
// font ses connexions — ouvertes, refermées par la base, tombées en route —
// et peut les garder plus longtemps (`QUIZ_DB_KEEPALIVE_MS`).
//
// Le faux Turso ne dit pas son délai (aucun en-tête `Keep-Alive`), comme le
// vrai : c'est la garde du client qui décide, ou la base qui referme.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type IncomingMessage } from 'node:http'
import type { AddressInfo, Socket } from 'node:net'
import { avecDelai, BaseMuette, clientDistant } from '../src/core/distante'
import { GARDE_MAX_MS, GARDE_MIN_MS, gardeAnnoncee, gardeDeLaBase, gardeDemandee, reglerLaGarde } from '../src/core/connexions'
import { pouls, releve } from '../src/core/pouls'
import { GARDE_DE_NODE_MS } from '../../shared/santeDuServeur'

const attendre = (ms: number) => new Promise(r => setTimeout(r, ms))

/**
 * Un faux Turso qui répond `{}` à tout. `refermeApresMs` : il referme une
 * connexion restée inactive aussi longtemps, comme une base qui a son délai ;
 * `coupe` : il coupe la connexion sous chaque requête ; `annonce` : l'en-tête
 * `Keep-Alive` qu'il envoie, s'il en dit un.
 */
async function fauxTurso(reglage: { refermeApresMs?: number; coupe?: boolean; annonce?: string } = {}) {
  const minuteries = new Map<Socket, NodeJS.Timeout>()
  const serveur = createServer((req: IncomingMessage, res) => {
    clearTimeout(minuteries.get(req.socket))
    if (reglage.coupe) return void req.socket.destroy()
    if (reglage.annonce) res.setHeader('Keep-Alive', reglage.annonce)
    req.resume()
    req.on('end', () => res.end('{}'))
    res.on('finish', () => {
      if (reglage.refermeApresMs !== undefined) minuteries.set(req.socket, setTimeout(() => req.socket.end(), reglage.refermeApresMs))
    })
  })
  // Sans délai à lui, Node n'envoie pas d'en-tête `Keep-Alive` : comme Turso, il ne dit rien.
  serveur.keepAliveTimeout = 0
  await new Promise<void>(r => serveur.listen(0, r))
  const port = (serveur.address() as AddressInfo).port
  return {
    adresse: `http://127.0.0.1:${port}`,
    port,
    fermer: () =>
      new Promise<void>(r => {
        for (const m of minuteries.values()) clearTimeout(m)
        serveur.closeAllConnections()
        serveur.close(() => r())
      }),
  }
}

const allerRetour = (adresse: string, delaiMs = 5_000) =>
  avecDelai(delaiMs)(new Request(`${adresse}/v2/pipeline`, { method: 'POST', body: '{}' })).then(async r => {
    await r.arrayBuffer()
    return r
  })

/** Les comptes de l'heure — et de celle d'avant, si l'heure a tourné pendant le test. */
function comptes() {
  return releve.lignes('banc').reduce(
    (t, l) => ({
      ouvertes: t.ouvertes + (l.connexions?.ouvertes ?? 0),
      refermees: t.refermees + (l.connexions?.refermeesParLaBase ?? 0),
      echecs: t.echecs + (l.connexions?.echecs ?? 0),
    }),
    { ouvertes: 0, refermees: 0, echecs: 0 },
  )
}

// Le premier de ce fichier : la plus jeune connexion refermée par la base est la sienne.
test('une connexion que la base referme d’elle-même se compte, avec son âge — et la suivante se rouvre sans tomber', async () => {
  const turso = await fauxTurso({ refermeApresMs: 300 })
  // `clientDistant` suit l'hôte de son adresse : ses connexions comptent désormais.
  clientDistant(turso.adresse).close()
  // Une garde plus longue que le délai de la base : c'est elle qui referme.
  reglerLaGarde(5_000)
  try {
    const avant = comptes()
    await allerRetour(turso.adresse)
    await attendre(800)
    assert.equal(comptes().refermees - avant.refermees, 1, 'la base a refermé la connexion gardée')
    const age = releve.lignes('banc').at(-1)!.connexions!.plusJeuneRefermeeMs
    assert.ok(age !== null && age >= 250 && age < 800, `refermée à ${age} ms, la base referme à 300`)
    assert.ok(pouls.refermeesParLaBase.lire().n >= 1, '/healthz la compte aussi')
    // Le client l'a vue se fermer : la requête suivante en ouvre une autre, et passe.
    assert.equal((await allerRetour(turso.adresse)).status, 200)
    assert.equal(comptes().ouvertes - avant.ouvertes, 2)
    assert.equal(comptes().echecs, avant.echecs)
  } finally {
    reglerLaGarde()
    await turso.fermer()
  }
})

test('une connexion neuve vers la base se compte, une connexion gardée non — et un autre hôte pas du tout', async () => {
  const turso = await fauxTurso()
  try {
    const avant = comptes()
    const avantMinute = pouls.connexions.lire().n
    // Trois allers-retours, une connexion gardée pour les deux suivants. Une
    // milliseconde les sépare : enchaînés dans la même tâche, le `fetch` de
    // Node en ouvre une seconde — la première n'est pas encore rendue quand la
    // requête suivante part (mesuré : deux connexions pour dix).
    for (let i = 0; i < 3; i++) {
      await allerRetour(turso.adresse)
      await attendre(10)
    }
    assert.equal(comptes().ouvertes - avant.ouvertes, 1)
    assert.equal(pouls.connexions.lire().n - avantMinute, 1, '/healthz dit la même')
    // Le même serveur sous un autre nom : ce n'est pas la base — les notifications du rappel du soir passent aussi par `fetch`.
    await allerRetour(`http://localhost:${turso.port}`)
    assert.equal(comptes().ouvertes - avant.ouvertes, 1)
  } finally {
    await turso.fermer()
  }
})

test('une garde réglée garde la connexion vers la base, ou la referme plus tôt ; sans réglage, c’est celle de Node', async () => {
  assert.equal(gardeDeLaBase(), GARDE_DE_NODE_MS)
  assert.equal(releve.lignes('banc').at(-1)!.connexions!.gardeMs, GARDE_DE_NODE_MS)
  const turso = await fauxTurso()
  try {
    // Une garde courte : la connexion se referme pendant la pause, et se rouvre.
    reglerLaGarde(200)
    let avant = comptes().ouvertes
    await allerRetour(turso.adresse)
    await attendre(500)
    await allerRetour(turso.adresse)
    assert.equal(comptes().ouvertes - avant, 2, 'refermée par la garde, puis rouverte')
    // Une garde longue : la même pause ne la referme plus.
    reglerLaGarde(5_000)
    assert.equal(gardeDeLaBase(), 5_000)
    avant = comptes().ouvertes
    await allerRetour(turso.adresse)
    await attendre(500)
    await allerRetour(turso.adresse)
    assert.equal(comptes().ouvertes - avant, 1, 'gardée pendant la pause')
    // Le relevé de l'heure écrit la garde en vigueur à côté de ses comptes.
    assert.equal(releve.lignes('banc').at(-1)!.connexions!.gardeMs, 5_000)
  } finally {
    reglerLaGarde()
    await turso.fermer()
  }
  assert.equal(gardeDeLaBase(), GARDE_DE_NODE_MS)
})

test('un aller-retour tombé en route se compte : la connexion coupée sous la requête, le délai dépassé', async () => {
  const coupe = await fauxTurso({ coupe: true })
  try {
    const avant = comptes().echecs
    await assert.rejects(allerRetour(coupe.adresse), TypeError)
    assert.equal(comptes().echecs - avant, 1)
  } finally {
    await coupe.fermer()
  }
  // Une base muette : le délai tombe, et compte aussi.
  const muette = createServer(() => {})
  await new Promise<void>(r => muette.listen(0, '127.0.0.1', r))
  try {
    const avant = comptes().echecs
    await assert.rejects(allerRetour(`http://127.0.0.1:${(muette.address() as AddressInfo).port}`, 100), BaseMuette)
    assert.equal(comptes().echecs - avant, 1)
    assert.ok(pouls.echecsDeLaBase.lire().n >= 2, '/healthz les compte aussi')
  } finally {
    muette.closeAllConnections()
    muette.close()
  }
})

test('le délai que la base annonce se lit à chaque aller-retour — undici le préfère à toute garde', async () => {
  const muette = await fauxTurso()
  const bavarde = await fauxTurso({ annonce: 'timeout=7, max=100' })
  try {
    await allerRetour(muette.adresse)
    assert.equal(gardeAnnoncee(), null, 'une base qui ne dit rien : la garde décide')
    await allerRetour(bavarde.adresse)
    assert.equal(gardeAnnoncee(), 7_000)
    assert.equal(releve.lignes('banc').at(-1)!.connexions!.annonceeMs, 7_000)
    await allerRetour(muette.adresse)
    assert.equal(gardeAnnoncee(), null, 'la dernière réponse fait foi')
    assert.equal(releve.lignes('banc').at(-1)!.connexions!.annonceeMs, 7_000, 'l’heure garde la plus longue')
  } finally {
    await muette.fermer()
    await bavarde.fermer()
  }
})

test('QUIZ_DB_KEEPALIVE_MS se lit comme un humain l’écrit, et se refuse hors de ses bornes en disant quoi écrire', () => {
  assert.equal(gardeDemandee(undefined), null)
  assert.equal(gardeDemandee('  '), null)
  assert.deepEqual(gardeDemandee('30000'), { ms: 30_000 })
  assert.deepEqual(gardeDemandee('30 000'), { ms: 30_000 })
  for (const illisible of ['500', String(GARDE_MAX_MS + 1), '30000.5', '30 s', 'trente']) {
    const lu = gardeDemandee(illisible)
    assert.ok(lu && 'refus' in lu, `« ${illisible} » se refuse`)
    assert.ok(lu.refus.includes(`entre ${GARDE_MIN_MS} et ${GARDE_MAX_MS}`) && lu.refus.includes('30000'), lu.refus)
  }
})
