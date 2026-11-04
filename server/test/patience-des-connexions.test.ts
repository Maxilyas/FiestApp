// La patience des connexions vers la base (`QUIZ_DB_PATIENCE_MS`,
// `placeSurUneGardee`, `core/transportLeger.ts`). Le 4 novembre 2026, au
// Cabinet, chaque bilan d'épreuve ouvrait 2 à 4 connexions neuves, ~0,45 s de
// poignée de main chacune : les missions du bilan partent en un lot par
// magasin, de front avec la carte, quand l'entretien n'en gardait qu'une
// chaude depuis les manches (`retours/2026-11-04/`). Avec de la patience, un
// aller-retour qui ne trouve aucune connexion libre attend que l'une de
// celles qui servent se libère, puis en ouvre une si elle tarde ; à froid, la
// rafale s'ouvre de front, comme avant. On compte, on ne chronomètre pas.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { avecDelai, choisirLaPatience, choisirLeTransport, clientDistant, patienceDemandee, PATIENCE_AU_PLUS_MS } from '../src/core/distante'
import { pouls } from '../src/core/pouls'
import { demarrer } from './banc'

choisirLeTransport('leger')

/** Une base qui répond `{}` après `apresMs` — `/lente`, après `lenteMs` — et compte les connexions qu'on lui ouvre. */
async function uneBase({ apresMs = 30, lenteMs = 1_500 } = {}) {
  let connexions = 0
  const serveur = createServer((req: IncomingMessage, res: ServerResponse) => {
    req.resume()
    req.on('end', () => setTimeout(() => res.end('{}'), req.url === '/lente' ? lenteMs : apresMs))
  })
  serveur.on('connection', () => connexions++)
  // Comme Turso : aucun en-tête `Keep-Alive`, la garde du client décide.
  serveur.keepAliveTimeout = 0
  await new Promise<void>(r => serveur.listen(0, '127.0.0.1', r))
  const adresse = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`
  // `clientDistant` suit l'hôte de son adresse : ses connexions se comptent.
  clientDistant(adresse).close()
  return {
    adresse,
    connexions: () => connexions,
    fermer: () =>
      new Promise<void>(r => {
        serveur.closeAllConnections()
        serveur.close(() => r())
      }),
  }
}

/** Un aller-retour par le transport des clients de la base (`avecDelai`), sa réponse lue en entier. */
const allerRetour = (adresse: string, chemin = '/v2/pipeline') =>
  avecDelai(5_000)(new Request(`${adresse}${chemin}`, { method: 'POST', body: '{}' })).then(r => r.arrayBuffer())

const deFront = (adresse: string, n: number) => Promise.all(Array.from({ length: n }, () => allerRetour(adresse)))

test('trois allers-retours de front sur une connexion gardée l’attendent l’un derrière l’autre, au lieu d’ouvrir chacun la sienne', async () => {
  const base = await uneBase()
  try {
    choisirLaPatience(400)
    await allerRetour(base.adresse)
    assert.equal(base.connexions(), 1, 'une connexion, gardée')
    const attentes = pouls.attentesDUneConnexion.lire().n
    const lassees = pouls.attentesLassees.lire().n
    await deFront(base.adresse, 3)
    assert.equal(base.connexions(), 1, 'aucune poignée de main de plus')
    assert.equal(pouls.attentesDUneConnexion.lire().n - attentes, 2, 'deux ont attendu leur tour')
    assert.equal(pouls.attentesLassees.lire().n - lassees, 0, 'et l’ont eu, leur patience tenue')
    // Sans patience, comme avant : la gardée sert le premier, les deux autres ouvrent la leur.
    choisirLaPatience(0)
    await deFront(base.adresse, 3)
    assert.equal(base.connexions(), 3, 'sans patience, deux connexions de plus')
  } finally {
    choisirLaPatience(0)
    await base.fermer()
  }
})

test('à froid, rien à attendre : une poignée de main en cours ne se libère qu’après elle, la rafale s’ouvre de front', async () => {
  const base = await uneBase()
  try {
    choisirLaPatience(400)
    const attentes = pouls.attentesDUneConnexion.lire().n
    await deFront(base.adresse, 3)
    assert.equal(base.connexions(), 3, 'trois connexions de front, comme sans patience')
    assert.equal(pouls.attentesDUneConnexion.lire().n - attentes, 0, 'personne n’a attendu une connexion qui s’ouvrait')
  } finally {
    choisirLaPatience(0)
    await base.fermer()
  }
})

test('une connexion longtemps occupée ne retient pas au-delà de la patience : passée, l’aller-retour ouvre la sienne', async () => {
  const base = await uneBase({ lenteMs: 1_500 })
  try {
    choisirLaPatience(100)
    await allerRetour(base.adresse)
    const lassees = pouls.attentesLassees.lire().n
    // La gardée part sur une lecture longue ; celui qui suit la trouve occupée.
    const lente = allerRetour(base.adresse, '/lente')
    await new Promise(r => setTimeout(r, 20))
    await allerRetour(base.adresse)
    assert.equal(pouls.attentesLassees.lire().n - lassees, 1, 'il a attendu sa patience, en vain')
    assert.equal(base.connexions(), 2, 'puis ouvert sa connexion, sans attendre la lente')
    await lente
  } finally {
    choisirLaPatience(0)
    await base.fermer()
  }
})

test('deux attentes au plus par connexion qui sert : la troisième ouvre la sienne tout de suite', async () => {
  const base = await uneBase()
  try {
    choisirLaPatience(400)
    await allerRetour(base.adresse)
    const attentes = pouls.attentesDUneConnexion.lire().n
    await deFront(base.adresse, 5)
    // La gardée sert le premier ; deux l'attendent ; les deux derniers ouvrent chacun la leur.
    assert.equal(pouls.attentesDUneConnexion.lire().n - attentes, 2)
    assert.equal(base.connexions(), 3)
  } finally {
    choisirLaPatience(0)
    await base.fermer()
  }
})

test('QUIZ_DB_PATIENCE_MS se lit en millisecondes, bornées ; illisible, un refus qui dit quoi écrire', () => {
  assert.deepEqual(patienceDemandee(undefined), { patienceMs: 0 })
  assert.deepEqual(patienceDemandee(''), { patienceMs: 0 })
  assert.deepEqual(patienceDemandee(' 0 '), { patienceMs: 0 })
  assert.deepEqual(patienceDemandee('150'), { patienceMs: 150 })
  assert.deepEqual(patienceDemandee(String(PATIENCE_AU_PLUS_MS)), { patienceMs: PATIENCE_AU_PLUS_MS })
  for (const illisible of ['oui', '-5', '1.5', String(PATIENCE_AU_PLUS_MS + 1), '150ms']) {
    const lu = patienceDemandee(illisible)
    assert.ok('refus' in lu && lu.refus.includes('QUIZ_DB_PATIENCE_MS'), `« ${illisible} » se refuse`)
  }
})

test('/healthz dit la patience qui vaut, et ce qu’elle a fait — null sans elle', async () => {
  const banc = await demarrer()
  try {
    const lire = async () => ((await (await fetch(`${banc.url}/healthz`)).json()) as { base: { connexions: { patience: unknown } } }).base.connexions.patience
    choisirLaPatience(0)
    assert.equal(await lire(), null)
    choisirLaPatience(150)
    const patience = (await lire()) as { ms: number; attentesParMin: number; lasseesParMin: number }
    assert.equal(patience.ms, 150)
    assert.equal(typeof patience.attentesParMin, 'number')
    assert.equal(typeof patience.lasseesParMin, 'number')
  } finally {
    choisirLaPatience(0)
    await banc.close()
  }
})
