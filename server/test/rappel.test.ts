// Le rappel du soir du quiz du jour : une notification, une seule par
// téléphone et par jour, vers 18 h à Paris, à ceux qui l'ont demandée dans
// l'application installée et n'ont pas fini leur partie (`core/rappels.ts`).
//
// Le protocole (`core/pousser.ts`) se prouve sur l'exemple de la RFC 8291,
// octet pour octet, et sur sa signature VAPID ; la tournée, sur un vrai
// serveur et un faux service de push, sur la machine, qui déchiffre ce qu'il
// reçoit comme le ferait un téléphone. Le service worker et la page se
// rejouent sans navigateur, comme la page du jour (`jour-telephone.test.ts`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type IncomingHttpHeaders } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createDecipheriv, createECDH, createPublicKey, hkdfSync, randomBytes, verify, type ECDH } from 'node:crypto'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import Database from 'better-sqlite3'
import React from 'react'
import { demarrer, ecrire, inscrireProfil, patienter, type Banc } from './banc'
import { ProfileStore } from '../src/auth/profiles'
import { chiffrer, enteteVapid, lireAbonnement, nouvellesCles } from '../src/core/pousser'
import { messageDuRappel, type BilanDeTournee } from '../src/core/rappels'

ProfileStore.tirageEclat = () => false

// Le client compile son JSX pour un `React` global : posé avant tout import d'un composant.
Object.assign(globalThis, { React })

const b64 = (octets: Uint8Array) => Buffer.from(octets).toString('base64url')

// ── 1. Le protocole ───────────────────────────────────────────────────────

test('le chiffrement reproduit l’exemple de la RFC 8291, octet pour octet', () => {
  // L'annexe A de la RFC : ses clés, son sel, son secret, et le message qui en sort.
  const corps = chiffrer(
    Buffer.from('When I grow up, I want to be a watermelon'),
    {
      p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
      auth: 'BTBZMqHH6r4Tts7J_aSIgg',
    },
    { ephemere: Buffer.from('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw', 'base64url'), sel: Buffer.from('DGv6ra1nlYgDCS1FRnbzlw', 'base64url') },
  )
  assert.equal(
    b64(corps),
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
  )
})

/** Ce que vérifie un service de push : la signature, pour lui seul, et pas plus d'un jour. */
function lireVapid(entete: string) {
  const m = /^vapid t=([^,]+), k=(.+)$/.exec(entete)
  assert.ok(m, `un en-tête vapid t=…, k=… : ${entete}`)
  const [tete, charge, signature] = m[1].split('.')
  const publique = Buffer.from(m[2], 'base64url')
  const cle = createPublicKey({ format: 'jwk', key: { kty: 'EC', crv: 'P-256', x: b64(publique.subarray(1, 33)), y: b64(publique.subarray(33)) } })
  return {
    k: m[2],
    tete: JSON.parse(Buffer.from(tete, 'base64url').toString()),
    revendications: JSON.parse(Buffer.from(charge, 'base64url').toString()) as { aud: string; exp: number; sub: string },
    signee: verify('sha256', Buffer.from(`${tete}.${charge}`), { key: cle, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url')),
  }
}

test('la signature VAPID se vérifie avec la clé publique, pour ce service seulement, et moins d’un jour', () => {
  const cles = nouvellesCles()
  assert.equal(Buffer.from(cles.publique, 'base64url').length, 65)
  assert.equal(Buffer.from(cles.privee, 'base64url').length, 32)
  const lu = lireVapid(enteteVapid('https://fcm.googleapis.com/fcm/send/abc', cles, 'https://fiestapp.example'))
  assert.equal(lu.signee, true, 'signée par la clé privée qui va avec')
  assert.equal(lu.k, cles.publique)
  assert.deepEqual(lu.tete, { typ: 'JWT', alg: 'ES256' })
  assert.equal(lu.revendications.aud, 'https://fcm.googleapis.com', 'l’origine du service, sans chemin')
  assert.equal(lu.revendications.sub, 'https://fiestapp.example')
  const reste = lu.revendications.exp * 1000 - Date.now()
  assert.ok(reste > 3600_000 && reste <= 24 * 3600_000, 'une signature valable quelques heures, jamais plus d’un jour (RFC 8292)')
  const autre = nouvellesCles()
  assert.equal(lireVapid(enteteVapid('https://fcm.googleapis.com/x', cles, 'mailto:a@b.c').replace(cles.publique, autre.publique)).signee, false)
})

test('un abonnement se relit : un service de push connu, une clé sur la courbe, un secret de seize octets', () => {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  const cles = { p256dh: b64(ecdh.getPublicKey()), auth: b64(randomBytes(16)) }
  const abonnement = (endpoint: unknown, keys: Record<string, unknown> = cles) => lireAbonnement({ endpoint, expirationTime: null, keys })
  for (const endpoint of [
    'https://fcm.googleapis.com/fcm/send/dX9',
    'https://web.push.apple.com/QGx_3',
    'https://updates.push.services.mozilla.com/wpush/v2/gAAA',
    'https://wns2-par02p.notify.windows.com/w/?token=BQYA',
  ]) {
    assert.deepEqual(abonnement(endpoint), { endpoint, ...cles }, endpoint)
  }
  const inconnu = /service de notifications que FiestApp ne connaît pas/
  for (const endpoint of [
    'http://fcm.googleapis.com/fcm/send/x',
    'https://fcm.googleapis.com:8443/fcm/send/x',
    'https://fcm.googleapis.com.exemple.net/x',
    'https://exemple.net/web.push.apple.com',
    'https://169.254.169.254/latest/meta-data',
    'https://localhost/push',
    'https://moi:secret@fcm.googleapis.com/fcm/send/x',
  ]) {
    assert.match((abonnement(endpoint) as { refus: string }).refus, inconnu, endpoint)
  }
  const illisible = /n’a pas su s’abonner/
  const horsCourbe = Buffer.alloc(65, 7)
  horsCourbe[0] = 4
  for (const [cas, lu] of [
    ['sans adresse', abonnement(undefined)],
    ['une adresse qui n’en est pas une', abonnement('pas une adresse')],
    ['une clé hors de la courbe', abonnement('https://fcm.googleapis.com/x', { ...cles, p256dh: b64(horsCourbe) })],
    ['une clé compressée', abonnement('https://fcm.googleapis.com/x', { ...cles, p256dh: b64(ecdh.getPublicKey(null, 'compressed')) })],
    ['un secret trop court', abonnement('https://fcm.googleapis.com/x', { ...cles, auth: b64(randomBytes(8)) })],
    ['du base64 mal écrit', abonnement('https://fcm.googleapis.com/x', { ...cles, auth: `${cles.auth.slice(0, -2)}!!` })],
    ['rien', lireAbonnement(null)],
  ] as const) {
    assert.match((lu as { refus: string }).refus, illisible, cas)
  }
})

test('le texte du rappel : la partie à finir, la série à tenir, ou le quiz du jour — jamais un prénom', () => {
  assert.deepEqual(messageDuRappel({ total: 10, reste: 10, serie: 0, serieTenue: false }), {
    titre: 'Le quiz du jour t’attend',
    corps: '10 questions, les mêmes pour tout le monde, jusqu’à minuit.',
    url: '/jour',
  })
  assert.match(messageDuRappel({ total: 10, reste: 10, serie: 6, serieTenue: false }).corps, /^Ta série de 6 jours tient jusqu’à minuit : 10 questions, une seule partie\.$/)
  // Une soirée ce soir l'a déjà tenue : rien à sauver, le quiz tout court.
  assert.doesNotMatch(messageDuRappel({ total: 10, reste: 10, serie: 6, serieTenue: true }).corps, /série/)
  assert.doesNotMatch(messageDuRappel({ total: 10, reste: 10, serie: 1, serieTenue: false }).corps, /série/, 'une série d’un jour n’en est pas une')
  const commencee = messageDuRappel({ total: 10, reste: 1, serie: 3, serieTenue: true })
  assert.equal(commencee.titre, 'Ta partie du jour n’est pas finie')
  assert.match(commencee.corps, /^Encore 1 question avant minuit : reprends-la où tu l’as laissée\.$/)
})

// ── 2. La tournée du soir ─────────────────────────────────────────────────

/** Un téléphone abonné : sa clé et son secret, pour lire ce qu'on lui envoie. */
interface Telephone {
  nom: string
  ecdh: ECDH
  auth: Buffer
  endpoint: string
}

/** Un service de push sur la machine : il garde ce qu'il reçoit, et dit morts les téléphones qu'on lui désigne. */
async function serviceDePush() {
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

const abonnementDe = (t: Telephone) => ({
  endpoint: t.endpoint,
  expirationTime: null,
  keys: { p256dh: b64(t.ecdh.getPublicKey()), auth: b64(t.auth) },
})

/** Ce que fait le téléphone d'un message reçu : le déchiffrer avec sa clé et son secret (RFC 8291). */
function dechiffrer(corps: Buffer, t: Telephone): any {
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

/** La tournée de ce jour, faite par le serveur en cours, telle que `/healthz` la dit. */
async function tournee(banc: Banc, jour: string): Promise<BilanDeTournee> {
  const fin = Date.now() + 15_000
  while (Date.now() < fin) {
    const sante = (await (await fetch(`${banc.url}/healthz`)).json()) as { rappels: BilanDeTournee | null }
    if (sante.rappels?.jour === jour) return sante.rappels
    await patienter(20)
  }
  throw new Error(`la tournée du ${jour} n’est pas venue`)
}

/** Joue le quiz du jour — en entier, ou ses `n` premières questions, la suivante pas encore montrée. */
async function jouer(banc: Banc, cookie: string, n = Infinity) {
  const poster = (chemin: string, corps: unknown = {}) => ecrire(banc.url, chemin, corps, cookie).then(async r => (await r.json()) as any)
  let etat = await poster('/api/jour/commencer')
  for (let joue = 0; etat.question && joue < n; ) {
    await poster('/api/jour/repondre', { jour: etat.question.jour, index: etat.question.index, choix: 0 })
    if (++joue < n) etat = await poster('/api/jour/suivante')
  }
  return etat as { total: number }
}

/** Les téléphones abonnés, tels que la base permanente les garde. */
function abonnes(banc: Banc): string[] {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true })
  try {
    return (db.prepare('SELECT endpoint FROM jour_rappels ORDER BY endpoint').all() as { endpoint: string }[]).map(r => r.endpoint.replace(/^.*\/push\//, ''))
  } finally {
    db.close()
  }
}

/** Paris, l'heure qu'on veut : septembre, UTC+2. */
const aParis = (jour: number, heure: number, minute = 0) => Date.UTC(2026, 8, jour, heure - 2, minute)

test('à 18 h, une notification — une seule — à qui n’a pas fini sa partie, et pas même après un redémarrage', async () => {
  const push = await serviceDePush()
  const horloge = { t: aParis(25, 10) }
  const banc = await demarrer({
    horlogeDuJour: () => horloge.t,
    rappels: { intervalleMs: 20, servicesDePush: url => url.hostname === '127.0.0.1' },
  })
  try {
    const [lea, bob, cleo, dan, eve] = await Promise.all(
      [['lea', 'Léa'], ['bob', 'Bob'], ['cleo', 'Cléo'], ['dan', 'Dan'], ['eve', 'Ève']].map(([login, nom]) => inscrireProfil(banc.url, login, nom)),
    )
    const telephones = Object.fromEntries(['lea', 'bob', 'cleo', 'dan', 'eve'].map(nom => [nom, push.telephone(nom)]))
    const abonner = (cookie: string, nom: string) => ecrire(banc.url, '/api/jour/rappel', { abonnement: abonnementDe(telephones[nom]) }, cookie)

    // Bob joue la veille : il a une série.
    await jouer(banc, bob)
    horloge.t = aParis(26, 10)
    const cle = (await (await fetch(`${banc.url}/api/jour/rappel`, { headers: { Cookie: lea } })).json()) as { cle: string; heure: number }
    assert.equal(cle.heure, 18)
    assert.equal(Buffer.from(cle.cle, 'base64url').length, 65, 'la clé publique du serveur, que le téléphone donne à son service')
    for (const [cookie, nom] of [[lea, 'lea'], [bob, 'bob'], [cleo, 'cleo'], [dan, 'dan']] as const) assert.equal((await abonner(cookie, nom)).status, 200, nom)
    const { total } = await jouer(banc, bob)
    await jouer(banc, cleo, 3)
    push.morts.add('dan')

    await patienter(200)
    assert.deepEqual(push.noms(), [], 'rien avant 18 h')

    horloge.t = aParis(26, 18, 5)
    assert.deepEqual(await tournee(banc, '2026-09-26'), { jour: '2026-09-26', envoyes: 2, finis: 1, retires: 1, echecs: 0 })
    assert.deepEqual(push.noms(), ['cleo', 'dan', 'lea'], 'Bob a fini sa partie : rien pour lui')
    assert.deepEqual(abonnes(banc), ['bob', 'cleo', 'lea'], 'le service a dit Dan désabonné : il ne l’est plus ici non plus')

    const [pourLea] = push.recus.filter(r => r.nom === 'lea')
    assert.equal(pourLea.entetes['content-encoding'], 'aes128gcm')
    assert.equal(pourLea.entetes.ttl, String(355 * 60), 'gardé jusqu’à minuit pour un téléphone éteint, pas plus')
    assert.equal(pourLea.entetes.topic, 'quiz-du-jour')
    assert.equal(pourLea.entetes.urgency, 'normal')
    const vapid = lireVapid(String(pourLea.entetes.authorization))
    assert.equal(vapid.signee, true)
    assert.equal(vapid.k, cle.cle, 'signé de la clé que le téléphone connaît')
    assert.equal(vapid.revendications.aud, push.url)
    assert.equal(vapid.revendications.sub, 'mailto:fiestapp@example.com', 'sans adresse publique, de quoi joindre quand même')
    assert.deepEqual(dechiffrer(pourLea.corps, telephones.lea), {
      titre: 'Le quiz du jour t’attend',
      corps: `${total} questions, les mêmes pour tout le monde, jusqu’à minuit.`,
      url: '/jour',
    })
    const pourCleo = dechiffrer(push.recus.find(r => r.nom === 'cleo')!.corps, telephones.cleo)
    assert.equal(pourCleo.titre, 'Ta partie du jour n’est pas finie')
    assert.match(pourCleo.corps, new RegExp(`^Encore ${total - 3} questions avant minuit`))

    // Ève s'abonne après la tournée : son premier rappel sera pour demain.
    horloge.t = aParis(26, 18, 30)
    assert.equal((await abonner(eve, 'eve')).status, 200)
    await patienter(200)
    assert.equal(push.recus.length, 3, 'une seule tournée par jour')

    // Un redémarrage dans la soirée refait la tournée : chacun est déjà servi.
    await banc.redemarrer()
    assert.deepEqual(await tournee(banc, '2026-09-26'), { jour: '2026-09-26', envoyes: 0, finis: 1, retires: 0, echecs: 0 })
    assert.equal(push.recus.length, 3, 'rien de plus après le redémarrage')

    // Léa se déconnecte : son téléphone ne sonnera plus pour elle.
    assert.equal((await ecrire(banc.url, '/api/joueur/deconnexion', {}, lea)).status, 200)

    horloge.t = aParis(27, 18, 5)
    assert.deepEqual(await tournee(banc, '2026-09-27'), { jour: '2026-09-27', envoyes: 3, finis: 0, retires: 1, echecs: 0 })
    assert.deepEqual(
      push.recus.slice(3).map(r => r.nom).sort(),
      ['bob', 'cleo', 'eve'],
      'le lendemain : Bob et Cléo, qui n’ont pas joué, et Ève — pas Léa, déconnectée',
    )
    assert.deepEqual(abonnes(banc), ['bob', 'cleo', 'eve'])
    assert.equal(
      dechiffrer(push.recus.find(r => r.nom === 'bob' && push.recus.indexOf(r) >= 3)!.corps, telephones.bob).corps,
      `Ta série de 2 jours tient jusqu’à minuit : ${total} questions, une seule partie.`,
    )

    // Passé 22 h, plus rien ne part : un serveur réveillé tard ne fait pas sonner à l'heure de dormir.
    horloge.t = aParis(28, 22, 30)
    await patienter(200)
    assert.equal(push.recus.length, 6)
    assert.equal(((await (await fetch(`${banc.url}/healthz`)).json()) as { rappels: BilanDeTournee }).rappels.jour, '2026-09-27')
  } finally {
    await banc.close()
    await push.fermer()
  }
})

test('s’abonner demande un profil et un service connu ; on le coupe, et cinq téléphones au plus', async () => {
  const banc = await demarrer({ rappels: { servicesDePush: url => url.hostname === '127.0.0.1' } })
  try {
    const anonyme = await fetch(`${banc.url}/api/jour/rappel`)
    assert.equal(anonyme.status, 401)
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    const ecdh = createECDH('prime256v1')
    ecdh.generateKeys()
    const abonnement = (endpoint: string) => ({ endpoint, keys: { p256dh: b64(ecdh.getPublicKey()), auth: b64(randomBytes(16)) } })
    assert.equal((await ecrire(banc.url, '/api/jour/rappel', { abonnement: abonnement('http://127.0.0.1:9/push/1') })).status, 401, 'sans profil, rien')

    const refuse = await ecrire(banc.url, '/api/jour/rappel', { abonnement: abonnement('https://exemple.net/push') }, lea)
    assert.equal(refuse.status, 400)
    assert.match(((await refuse.json()) as { error: string }).error, /service de notifications que FiestApp ne connaît pas/)
    assert.equal((await ecrire(banc.url, '/api/jour/rappel', {}, lea)).status, 400)

    for (let i = 1; i <= 7; i++) {
      assert.equal((await ecrire(banc.url, '/api/jour/rappel', { abonnement: abonnement(`http://127.0.0.1:9/push/${i}`) }, lea)).status, 200)
      await patienter(2)
    }
    assert.deepEqual(abonnes(banc), ['3', '4', '5', '6', '7'], 'les cinq plus récents restent')
    // Le téléphone qui revient se rattache : il redevient le plus récent.
    await ecrire(banc.url, '/api/jour/rappel', { abonnement: abonnement('http://127.0.0.1:9/push/3') }, lea)
    await ecrire(banc.url, '/api/jour/rappel', { abonnement: abonnement('http://127.0.0.1:9/push/8') }, lea)
    assert.deepEqual(abonnes(banc), ['3', '5', '6', '7', '8'])

    // Couper : celui-là, et seulement s'il est à soi.
    const bob = await inscrireProfil(banc.url, 'bob', 'Bob')
    await ecrire(banc.url, '/api/jour/rappel', { endpoint: 'http://127.0.0.1:9/push/3' }, bob, 'DELETE')
    assert.deepEqual(abonnes(banc), ['3', '5', '6', '7', '8'], 'Bob ne coupe pas le téléphone de Léa')
    assert.equal((await ecrire(banc.url, '/api/jour/rappel', { endpoint: 'http://127.0.0.1:9/push/3' }, lea, 'DELETE')).status, 200)
    assert.deepEqual(abonnes(banc), ['5', '6', '7', '8'])
  } finally {
    await banc.close()
  }
})

// ── 3. Le service worker ──────────────────────────────────────────────────

/** `client/public/sw.js`, joué dans un bac à sable, avec ce que le navigateur lui donnerait. */
function serviceWorker(fenetres: string[] = []) {
  const ecouteurs = new Map<string, (evenement: any) => void>()
  const notifications: { titre: string; options: any }[] = []
  const ouvertes: string[] = []
  const focalisees: string[] = []
  const requetes: { url: string; init: any }[] = []
  const self = {
    addEventListener: (type: string, f: (evenement: any) => void) => ecouteurs.set(type, f),
    skipWaiting: () => Promise.resolve(),
    location: { origin: 'https://fiestapp.example' },
    clients: {
      claim: () => Promise.resolve(),
      matchAll: () => Promise.resolve(fenetres.map(url => ({ url: `https://fiestapp.example${url}`, focus: () => Promise.resolve(focalisees.push(url)) }))),
      openWindow: (url: string) => Promise.resolve(ouvertes.push(url)),
    },
    registration: {
      showNotification: (titre: string, options: any) => Promise.resolve(notifications.push({ titre, options })),
      pushManager: {
        subscribe: (options: any) => Promise.resolve({ toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/neuf', cle: [...options.applicationServerKey] }) }),
      },
    },
  }
  const fetch = (url: string, init: any) => {
    requetes.push({ url, init })
    return Promise.resolve(new Response(JSON.stringify({ cle: 'AQID' })))
  }
  vm.runInNewContext(readFileSync(new URL('../../client/public/sw.js', import.meta.url), 'utf8'), { self, fetch, URL, atob, Uint8Array, JSON })
  /** Un événement, et ce qu'il a confié à `waitUntil`. */
  const declencher = async (type: string, evenement: object) => {
    const attentes: Promise<unknown>[] = []
    ecouteurs.get(type)!({ ...evenement, waitUntil: (p: Promise<unknown>) => attentes.push(p) })
    await Promise.all(attentes)
  }
  return { declencher, notifications, ouvertes, focalisees, requetes }
}

test('le service worker montre le rappel — une seule notification à la fois — et ouvre le quiz du jour', async () => {
  const sw = serviceWorker(['/chez-nadia'])
  await sw.declencher('push', { data: { json: () => ({ titre: 'Le quiz du jour t’attend', corps: '10 questions.', url: '/jour' }) } })
  // Relue hors du bac à sable : ses objets n'ont pas notre prototype.
  assert.deepEqual(JSON.parse(JSON.stringify(sw.notifications)), [
    {
      titre: 'Le quiz du jour t’attend',
      options: { body: '10 questions.', lang: 'fr', icon: '/icone-192.png', tag: 'quiz-du-jour', data: { url: '/jour' } },
    },
  ])
  // Illisible, ou vide : un push montre toujours quelque chose.
  await sw.declencher('push', { data: { json: () => JSON.parse('{') } })
  await sw.declencher('push', { data: null })
  assert.deepEqual(
    sw.notifications.slice(1).map(n => [n.titre, n.options.tag]),
    [
      ['Le quiz du jour t’attend', 'quiz-du-jour'],
      ['Le quiz du jour t’attend', 'quiz-du-jour'],
    ],
  )

  // Touchée : la soirée ouverte dans l'application n'est pas menée ailleurs, le quiz s'ouvre.
  let fermee = false
  await sw.declencher('notificationclick', { notification: { data: { url: '/jour' }, close: () => (fermee = true) } })
  assert.equal(fermee, true)
  assert.deepEqual([sw.ouvertes, sw.focalisees], [['https://fiestapp.example/jour'], []])
  // Déjà ouvert : il passe devant, rien ne s'ouvre en double.
  const deja = serviceWorker(['/chez-nadia', '/jour'])
  await deja.declencher('notificationclick', { notification: { data: { url: '/jour' }, close: () => {} } })
  assert.deepEqual([deja.ouvertes, deja.focalisees], [[], ['/jour']])
})

test('un abonnement renouvelé par le service rejoint le serveur, avec l’en-tête des écritures', async () => {
  const sw = serviceWorker()
  await sw.declencher('pushsubscriptionchange', { newSubscription: { toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/renouvele' }) } })
  assert.equal(sw.requetes.length, 1)
  const [{ url, init }] = sw.requetes
  assert.equal(url, '/api/jour/rappel')
  assert.equal(init.method, 'POST')
  assert.equal(init.headers['X-Requested-With'], 'quizz', 'sans lui, la protection contre les requêtes forgées le refuserait')
  assert.deepEqual(JSON.parse(init.body), { abonnement: { endpoint: 'https://fcm.googleapis.com/fcm/send/renouvele' } })
  // Sans le nouveau (Chrome ne le donne pas), il se réabonne avec la clé du serveur, puis l'envoie.
  const seul = serviceWorker()
  await seul.declencher('pushsubscriptionchange', { oldSubscription: null })
  assert.deepEqual(
    seul.requetes.map(r => [r.url, r.init?.method ?? 'GET']),
    [
      ['/api/jour/rappel', 'GET'],
      ['/api/jour/rappel', 'POST'],
    ],
  )
  assert.deepEqual(JSON.parse(seul.requetes[1].init.body).abonnement.cle, [1, 2, 3], 'la clé du serveur, en octets')
})

// ── 4. La page ────────────────────────────────────────────────────────────

/** Un navigateur de téléphone, juste ce que le rappel en lit : l'application installée ou non, la permission, le service de push. */
function navigateur({ installee = true, permission = 'default' as 'default' | 'granted' | 'denied', refuse = false, abonne = false } = {}) {
  const journal: string[] = []
  const envois: { methode: string; corps: any }[] = []
  const options: any[] = []
  const etat = { permission }
  let abonnement: any = abonne ? fauxAbonnement('deja') : null
  function fauxAbonnement(nom: string) {
    return {
      endpoint: `https://fcm.googleapis.com/fcm/send/${nom}`,
      options: { applicationServerKey: null },
      toJSON: () => ({ endpoint: `https://fcm.googleapis.com/fcm/send/${nom}`, keys: { p256dh: 'x', auth: 'y' } }),
      unsubscribe: () => {
        journal.push('unsubscribe')
        abonnement = null
        return Promise.resolve(true)
      },
    }
  }
  const enregistrement = {
    pushManager: {
      getSubscription: () => Promise.resolve(abonnement),
      subscribe: (o: any) => {
        journal.push('subscribe')
        options.push(o)
        if (refuse) {
          etat.permission = 'denied'
          return Promise.reject(new Error('NotAllowedError'))
        }
        etat.permission = 'granted'
        abonnement = fauxAbonnement('neuf')
        return Promise.resolve(abonnement)
      },
    },
  }
  const globaux = {
    navigator: {
      serviceWorker: {
        register: (url: string) => {
          journal.push(`register ${url}`)
          return Promise.resolve(enregistrement)
        },
        ready: Promise.resolve(enregistrement),
      },
    },
    window: { matchMedia: (q: string) => ({ matches: installee && q === '(display-mode: standalone)' }) },
    PushManager: function PushManager() {},
    Notification: {
      get permission() {
        return etat.permission
      },
    },
    fetch: (chemin: string, init: RequestInit = {}) => {
      const methode = init.method ?? 'GET'
      journal.push(`${methode} ${chemin}`)
      if (methode !== 'GET') envois.push({ methode, corps: JSON.parse(String(init.body)) })
      return Promise.resolve(new Response(JSON.stringify(methode === 'GET' ? { cle: CLE, heure: 18 } : { ok: true })))
    },
  }
  return { globaux, journal, envois, options, etat }
}

const CLE = nouvellesCles().publique

/** Le module du rappel, neuf à chaque épreuve — il garde ce qu'il a préparé —, sous ce navigateur. */
async function sous<T>(nav: ReturnType<typeof navigateur>, faire: (rappel: any) => Promise<T>): Promise<T> {
  const avant = Object.fromEntries(Object.keys(nav.globaux).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]))
  for (const [k, v] of Object.entries(nav.globaux)) Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true })
  try {
    const rappel = await import(`${new URL('../../client/src/rappel.ts', import.meta.url).href}?${Math.random()}`)
    return await faire(rappel)
  } finally {
    for (const [k, d] of Object.entries(avant)) {
      if (d) Object.defineProperty(globalThis, k, d)
      else delete (globalThis as Record<string, unknown>)[k]
    }
  }
}

test('le rappel ne se propose que dans l’application installée, sur un navigateur qui sait pousser', async () => {
  assert.equal(await sous(navigateur(), async r => r.rappelPossible()), true)
  assert.equal(await sous(navigateur({ installee: false }), async r => r.rappelPossible()), false, 'dans un onglet : rien')
  const sansPush = navigateur()
  delete (sansPush.globaux as Partial<typeof sansPush.globaux>).PushManager
  assert.equal(await sous(sansPush, async r => r.rappelPossible()), false, 'un navigateur qui ne sait pas pousser : rien')
  const iphone = navigateur({ installee: false })
  Object.assign(iphone.globaux.navigator, { standalone: true })
  assert.equal(await sous(iphone, async r => r.rappelPossible()), true, 'Safari installé sur l’écran d’accueil le dit à sa façon')
})

test('« Me le rappeler » demande la permission au toucher même, puis donne l’abonnement au serveur', async () => {
  const nav = navigateur()
  await sous(nav, async rappel => {
    assert.equal(await rappel.preparerLeRappel(), 'inactif')
    assert.deepEqual(nav.journal, ['register /sw.js', 'GET /api/jour/rappel'], 'le service worker et la clé, préparés dès l’affichage')
    const enRoute = rappel.activerLeRappel()
    // Sans un aller-retour entre le toucher et la demande : l'iPhone n'y verrait plus le geste.
    assert.equal(nav.journal.at(-1), 'subscribe')
    assert.equal(await enRoute, 'actif')
  })
  assert.equal(nav.options[0].userVisibleOnly, true)
  assert.deepEqual([...nav.options[0].applicationServerKey], [...Buffer.from(CLE, 'base64url')], 'la clé du serveur, en octets')
  assert.deepEqual(nav.envois, [{ methode: 'POST', corps: { abonnement: { endpoint: 'https://fcm.googleapis.com/fcm/send/neuf', keys: { p256dh: 'x', auth: 'y' } } } }])

  // Refusée : bloqué, et les réglages du téléphone seuls la rouvrent.
  const refuse = navigateur({ refuse: true })
  assert.equal(await sous(refuse, async r => (await r.preparerLeRappel(), r.activerLeRappel())), 'bloque')
  assert.deepEqual(refuse.envois, [], 'rien au serveur')
  assert.equal(await sous(navigateur({ permission: 'denied' }), async r => r.preparerLeRappel()), 'bloque')
})

test('actif, il se rattache à chaque visite à la session du moment ; coupé, le serveur l’oublie avant le service', async () => {
  const nav = navigateur({ permission: 'granted', abonne: true })
  await sous(nav, async rappel => {
    assert.equal(await rappel.preparerLeRappel(), 'actif')
    assert.deepEqual(nav.envois.map(e => [e.methode, e.corps.abonnement?.endpoint]), [['POST', 'https://fcm.googleapis.com/fcm/send/deja']])
    assert.equal(await rappel.couperLeRappel(), 'inactif')
  })
  assert.deepEqual(nav.journal.slice(-2), ['DELETE /api/jour/rappel', 'unsubscribe'])
  assert.deepEqual(nav.envois.at(-1), { methode: 'DELETE', corps: { endpoint: 'https://fcm.googleapis.com/fcm/send/deja' } })
})

/** Un composant du client rendu en HTML, sous l'adresse de la page du jour : `state.ts` la lit au chargement. */
async function rendu(props: object): Promise<string> {
  const avant = (globalThis as { window?: unknown }).window
  Object.assign(globalThis, { window: { location: { pathname: '/jour', search: '', hash: '' } } })
  try {
    const { renderToStaticMarkup } = await import('react-dom/server')
    const { RappelVu } = await import(new URL('../../client/src/components/RappelDuJour.tsx', import.meta.url).href)
    return renderToStaticMarkup(React.createElement(RappelVu, { occupe: false, onActiver: () => {}, onCouper: () => {}, ...props }))
  } finally {
    Object.assign(globalThis, { window: avant })
  }
}

test('la page dit l’heure et la condition, propose de couper, ou dit où débloquer — et rien tant qu’elle ne sait pas', async () => {
  assert.equal(await rendu({ etat: null }), '')
  const inactif = await rendu({ etat: 'inactif' })
  assert.match(inactif, /Me le rappeler chaque soir/)
  assert.match(inactif, /Une notification vers 18 h, seulement les jours où tu n’as pas fini ta partie\./)
  const actif = await rendu({ etat: 'actif' })
  assert.match(actif, /Rappel du soir activé : vers 18 h, si tu n’as pas fini ta partie\./)
  assert.match(actif, />Le couper</)
  assert.match(await rendu({ etat: 'bloque' }), /bloquées : le rappel du soir se rouvre dans les réglages du téléphone/)

  // Sur les trois écrans du quiz du jour qu'on retrouve : à jouer, la fin, le jour joué.
  const page = readFileSync(new URL('../../client/src/views/JourApp.tsx', import.meta.url), 'utf8')
  assert.equal(page.match(/<RappelDuJour \/>/g)?.length, 3)
  assert.match(page, /partie\.etat !== 'aucun' && <RappelDuJour \/>/, 'un jour sans quiz n’a rien à rappeler')
})
