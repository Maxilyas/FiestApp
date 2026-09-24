// Les portes d'entrée : ce que le serveur répond à une adresse avant que le
// client ne s'ouvre — son statut, ses balises d'aperçu, son indexation — et
// les adresses tapées à la main (« /Chez-Bruno », « /nadia »).
//
// Le client compilé n'existe qu'après le build, que `npm run verify` lance
// après les tests : le banc sert une page de trois lignes, qui suffit à lire
// ce que le serveur y pose.
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { connexionAnimateur, demarrer, ecrire, type Banc } from './banc'
import { decrirePage } from '../src/core/apercus'
import { parseRoute } from '../../shared/adresses'

let banc: Banc
let admin: string

before(async () => {
  const dist = mkdtempSync(path.join(tmpdir(), 'quizz-dist-'))
  writeFileSync(path.join(dist, 'index.html'), '<!doctype html><html><head><title>FiestApp</title></head><body></body></html>')
  banc = await demarrer({ clientDist: dist })
  admin = await connexionAnimateur(banc.url)
  const cree = await ecrire(banc.url, '/api/admin/accounts', { login: 'nadia', name: 'Nadia', slug: 'chez-nadia' }, admin)
  assert.equal(cree.status, 201)
  const bruno = await ecrire(banc.url, '/api/admin/accounts', { login: 'bruno', name: 'Bruno', slug: 'chez-bruno' }, admin)
  assert.equal(bruno.status, 201)
})

after(async () => {
  await banc.close()
})

const lire = (chemin: string) => fetch(banc.url + chemin, { redirect: 'manual' })

describe('les adresses inconnues', () => {
  test('un espace inconnu répond 404, avec la page qui redemande le nom de la soirée', async () => {
    const r = await lire('/personne-ici')
    assert.equal(r.status, 404)
    const html = await r.text()
    assert.match(html, /<title>Soirée introuvable/)
    // Rien des autres espaces : ni leur nom, ni leur titre.
    assert.doesNotMatch(html, /nadia|bruno|banc/i)
  })

  test('une page inconnue d’un espace connu répond 404', async () => {
    assert.equal((await lire('/banc/nimportequoi')).status, 404)
  })

  test('une soirée archivée inconnue répond 404', async () => {
    assert.equal((await lire('/banc/soirees/nexiste-pas')).status, 404)
    assert.equal((await lire('/banc/soirees/nexiste-pas/bilan')).status, 404)
  })

  test('un fichier absent répond 404, pas la page d’accueil', async () => {
    const r = await lire('/icone-inconnue.png')
    assert.equal(r.status, 404)
    assert.doesNotMatch(await r.text(), /<html/)
  })

  test('robots.txt existe, et écarte les données', async () => {
    const r = await lire('/robots.txt')
    assert.equal(r.status, 200)
    assert.match(r.headers.get('content-type') ?? '', /text\/plain/)
    assert.match(await r.text(), /Disallow: \/s\//)
  })

  test('les pages connues répondent 200', async () => {
    for (const chemin of ['/', '/profil', '/host', '/connexion', '/banc', '/banc/souvenir', '/banc/bilan', '/banc/soirees']) {
      assert.equal((await lire(chemin)).status, 200, chemin)
    }
  })
})

describe('les aperçus de lien et l’indexation', () => {
  test('l’entrée d’une soirée porte le titre de l’espace, sans aucun prénom d’invité', async () => {
    const html = await (await lire('/chez-nadia')).text()
    assert.match(html, /<meta property="og:title" content="La soirée de Nadia">/)
    assert.match(html, /<title>La soirée de Nadia<\/title>/)
    assert.match(html, /<meta property="og:image" content="http:\/\/localhost:\d+\/icone-512\.png">/)
    assert.match(html, /og:description/)
  })

  test('le souvenir dit ce qu’il est', async () => {
    const html = await (await lire('/banc/souvenir')).text()
    assert.match(html, /og:title" content="La soirée d’Antoine · Souvenir"/)
  })

  test('un titre choisi par l’animateur est échappé', async () => {
    const reglage = await ecrire(banc.url, '/api/space/settings', { title: 'Les "40" <ans> & Sam' }, admin, 'PUT')
    assert.equal(reglage.status, 200)
    const html = await (await lire('/banc')).text()
    assert.match(html, /og:title" content="Les &quot;40&quot; &lt;ans&gt; &amp; Sam"/)
    assert.doesNotMatch(html, /<ans>/)
    // `String.replace` lit « $& », « $` », « $' » et « $$ » dans une chaîne de
    // remplacement : « $& » recopiait le `<title>` d'origine au milieu du titre.
    const dollars = await ecrire(banc.url, '/api/space/settings', { title: "Soirée $& $` $' $$" }, admin, 'PUT')
    assert.equal(dollars.status, 200)
    const page = await (await lire('/banc')).text()
    assert.match(page, /<title>Soirée \$&amp; \$` \$&#39; \$\$<\/title>/)
    assert.match(page, /og:title" content="Soirée \$&amp; \$` \$&#39; \$\$"/)
    assert.equal(page.match(/<title>/g)?.length, 1)
  })

  test('seul l’accueil se laisse indexer', async () => {
    const accueil = await lire('/')
    assert.equal(accueil.headers.get('x-robots-tag'), null)
    assert.doesNotMatch(await accueil.text(), /noindex/)
    for (const chemin of ['/banc', '/banc/souvenir', '/host', '/personne-ici']) {
      const r = await lire(chemin)
      assert.match(r.headers.get('x-robots-tag') ?? '', /noindex/, chemin)
      assert.match(await r.text(), /<meta name="robots" content="noindex/, chemin)
    }
  })
})

describe('les adresses tapées à la main', () => {
  test('une majuscule mène à l’espace, sous son vrai nom', async () => {
    const r = await lire('/Chez-Bruno')
    assert.equal(r.status, 302)
    assert.equal(r.headers.get('location'), '/chez-bruno')
    const souvenir = await lire('/Chez-Bruno/souvenir')
    assert.equal(souvenir.headers.get('location'), '/chez-bruno/souvenir')
  })

  test('« chez bruno » tapé comme on le dit mène à « chez-bruno »', async () => {
    const r = await lire('/chez%20bruno')
    assert.equal(r.status, 302)
    assert.equal(r.headers.get('location'), '/chez-bruno')
  })

  test('« nadia » mène à « chez-nadia », et rien d’autre n’est deviné', async () => {
    const r = await lire('/Nadia?x=1')
    assert.equal(r.status, 302)
    assert.equal(r.headers.get('location'), '/chez-nadia?x=1')
    // Ni préfixe, ni ressemblance : « nad » ne mène nulle part.
    assert.equal((await lire('/nad')).status, 404)
    assert.equal((await lire('/chez-nad')).status, 404)
  })

  test('le client lit les mêmes adresses', () => {
    assert.deepEqual(parseRoute('/Chez-Bruno'), { kind: 'join', slug: 'chez-bruno' })
    assert.deepEqual(parseRoute('/Chez%20Bruno/souvenir'), { kind: 'public', slug: 'chez-bruno', page: 'souvenir', archiveId: null })
    assert.deepEqual(parseRoute('/host'), { kind: 'account', page: 'host' })
  })

  test('la décision ne cherche jamais qu’un nom exact', () => {
    const demandes: string[] = []
    decrirePage('/sam', slug => {
      demandes.push(slug)
      return undefined
    })
    assert.deepEqual(demandes, ['sam', 'chez-sam'])
  })
})

describe('les icônes', () => {
  const publics = path.resolve(import.meta.dirname, '../../client/public')

  test('favicon.ico et les trois PNG sont livrés avec le client', () => {
    const ico = readFileSync(path.join(publics, 'favicon.ico'))
    assert.deepEqual([...ico.subarray(0, 4)], [0, 0, 1, 0], 'un en-tête ICO')
    for (const taille of [180, 192, 512]) {
      const png = readFileSync(path.join(publics, `icone-${taille}.png`))
      assert.equal(png.subarray(1, 4).toString(), 'PNG')
      assert.equal(png.readUInt32BE(16), taille, `icone-${taille}.png fait ${taille} de large`)
    }
  })

  test('le manifeste les annonce', () => {
    const manifeste = JSON.parse(readFileSync(path.join(publics, 'manifest.webmanifest'), 'utf8'))
    const tailles = manifeste.icons.map((i: { sizes: string }) => i.sizes)
    assert.ok(tailles.includes('192x192') && tailles.includes('512x512'))
  })
})

describe('la porte des animateurs', () => {
  test('un compte en pause se dit en pause — à qui connaît son mot de passe seulement', async () => {
    const cree = await ecrire(banc.url, '/api/admin/accounts', { login: 'lea', name: 'Léa', slug: 'chez-lea' }, admin)
    const { account, activation } = (await cree.json()) as any
    assert.equal((await ecrire(banc.url, '/api/auth/activate', { token: activation.token, password: 'motdepasse-lea' })).status, 200)
    assert.equal((await ecrire(banc.url, `/api/admin/accounts/${account.id}/disable`, {}, admin)).status, 200)

    const juste = await ecrire(banc.url, '/api/auth/login', { login: 'lea', password: 'motdepasse-lea' })
    assert.equal(juste.status, 403)
    assert.match(((await juste.json()) as any).error, /en pause/)
    assert.equal(juste.headers.get('set-cookie'), null, 'aucune session ouverte')

    // Un mot de passe faux ne dit rien de plus qu'ailleurs.
    const faux = await ecrire(banc.url, '/api/auth/login', { login: 'lea', password: 'pas-le-bon' })
    assert.equal(faux.status, 401)
    assert.match(((await faux.json()) as any).error, /incorrect/)
  })

  test('un compte en pause ne reçoit pas de lien d’activation', async () => {
    const liste = (await (await fetch(`${banc.url}/api/admin/accounts`, { headers: { Cookie: admin } })).json()) as any[]
    const lea = liste.find(a => a.login === 'lea')
    const lien = await ecrire(banc.url, `/api/admin/accounts/${lea.id}/activation`, {}, admin)
    assert.equal(lien.status, 400)
    assert.equal((await ecrire(banc.url, `/api/admin/accounts/${lea.id}/enable`, {}, admin)).status, 200)
    assert.equal((await ecrire(banc.url, `/api/admin/accounts/${lea.id}/activation`, {}, admin)).status, 200)
  })
})

describe('le lien d’activation', () => {
  test('il dit l’identifiant et l’espace qu’il ouvre, sans se consommer, puis qu’il a servi', async () => {
    const cree = await ecrire(banc.url, '/api/admin/accounts', { login: 'marc', name: 'Marc', slug: 'agence' }, admin)
    const { activation } = (await cree.json()) as any
    const lire = async () => ecrire(banc.url, '/api/auth/activation', { token: activation.token })
    const avant = await lire()
    assert.equal(avant.status, 200)
    assert.deepEqual(await avant.json(), { login: 'marc', name: 'Marc', slug: 'agence', etat: 'valide' })
    // Lu deux fois, il sert encore.
    assert.equal(((await (await lire()).json()) as any).etat, 'valide')
    assert.equal((await ecrire(banc.url, '/api/auth/activate', { token: activation.token, password: 'motdepasse-marc' })).status, 200)
    assert.equal(((await (await lire()).json()) as any).etat, 'servi')
  })

  test('un jeton inconnu ne dit rien', async () => {
    const r = await ecrire(banc.url, '/api/auth/activation', { token: 'x'.repeat(43) })
    assert.equal(r.status, 404)
    assert.doesNotMatch(JSON.stringify(await r.json()), /marc|nadia|agence/)
  })
})

describe('partir d’un modèle', () => {
  test('un nouvel espace copie un quiz livré dans sa bibliothèque, et seulement la sienne', async () => {
    const marc = await connexionAnimateur(banc.url, 'marc', 'motdepasse-marc')
    const lister = async (cookie: string) => (await (await fetch(`${banc.url}/api/quizzes`, { headers: { Cookie: cookie } })).json()) as any[]
    assert.deepEqual(await lister(marc), [], 'un nouvel espace part vide')
    const avantAdmin = (await lister(admin)).length

    const modeles = (await (await fetch(`${banc.url}/api/modeles`, { headers: { Cookie: marc } })).json()) as any[]
    assert.ok(modeles.length >= 1, 'des modèles sont proposés')
    assert.ok(modeles.every(m => m.id && m.title && m.questionCount > 0))

    const copie = await ecrire(banc.url, `/api/modeles/${modeles[0].id}`, {}, marc)
    assert.equal(copie.status, 201)
    const quiz = (await copie.json()) as any
    assert.equal(quiz.title, modeles[0].title)
    assert.equal(quiz.questions.length, modeles[0].questionCount)
    assert.notEqual(quiz.id, modeles[0].id, 'une copie à soi, pas le quiz de l’administrateur')

    assert.equal((await lister(marc)).length, 1)
    assert.equal((await lister(admin)).length, avantAdmin, 'rien ne bouge chez les autres')
  })

  test('un modèle inconnu vaut introuvable, et il faut une session', async () => {
    const marc = await connexionAnimateur(banc.url, 'marc', 'motdepasse-marc')
    assert.equal((await ecrire(banc.url, '/api/modeles/../../etc', {}, marc)).status, 404)
    assert.equal((await ecrire(banc.url, '/api/modeles/nexiste-pas', {}, marc)).status, 404)
    assert.equal((await fetch(`${banc.url}/api/modeles`)).status, 401)
  })
})
