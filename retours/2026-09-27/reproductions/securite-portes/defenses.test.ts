// Audit securite-portes — vérifie que les contrôles défensifs documentés
// tiennent : en-têtes de durcissement, protection anti-requête-forgée,
// attributs des cookies, bornes des fichiers, adresses de photos. Toutes ces
// épreuves PASSENT sur le code d'aujourd'hui : elles constatent ce qui marche
// et servent de garde-fou si quelque chose se relâche.
//
//   cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/securite-portes/defenses.test.ts
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { ADMIN, connexionAnimateur, demarrer, type Banc } from '../../../server/test/banc'

let banc: Banc // hors ligne : cookies sans Secure, tout passe
let enLigne: Banc // en ligne : Secure, origine contrôlée
before(async () => {
  banc = await demarrer()
  enLigne = await demarrer({ online: true, publicUrl: 'https://exemple.test' })
})
after(async () => {
  await banc.close()
  await enLigne.close()
})

describe('les en-têtes de durcissement', () => {
  test('chaque page porte CSP, nosniff, Referrer-Policy et Permissions-Policy', async () => {
    const res = await fetch(`${banc.url}/api/auth/me`)
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(res.headers.get('referrer-policy'), 'same-origin')
    assert.match(res.headers.get('permissions-policy') ?? '', /geolocation=\(\)/)
    const csp = res.headers.get('content-security-policy') ?? ''
    assert.match(csp, /default-src 'self'/)
    assert.match(csp, /frame-ancestors 'none'/)
    assert.match(csp, /object-src 'none'/)
    // Pas de script tiers : la CSP ne laisse pas 'unsafe-inline' aux scripts.
    assert.match(csp, /script-src 'self'(;| )/)
    assert.doesNotMatch(csp, /script-src[^;]*unsafe-inline/)
  })

  test('les JSON privés ne se mettent pas en cache', async () => {
    const cookie = await connexionAnimateur(banc.url)
    const res = await fetch(`${banc.url}/api/quizzes`, { headers: { Cookie: cookie } })
    assert.match(res.headers.get('cache-control') ?? '', /no-store/)
  })
})

describe('la protection contre les requêtes forgées', () => {
  test('une écriture sans l’en-tête maison est refusée avant d’être lue', async () => {
    // Un formulaire d'un autre site ne peut pas poser X-Requested-With.
    const res = await fetch(`${banc.url}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: ADMIN.login, password: ADMIN.password }),
    })
    assert.equal(res.status, 403)
  })

  test('en ligne, une écriture d’une autre origine est refusée', async () => {
    const res = await fetch(`${enLigne.url}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'quizz', Origin: 'https://pirate.test' },
      body: JSON.stringify({ login: ADMIN.login, password: ADMIN.password }),
    })
    assert.equal(res.status, 403)
  })

  test('les routes montées avant la porte des animateurs sont aussi derrière le garde', async () => {
    for (const chemin of ['/api/joueur/inscription', '/api/jour/commencer', '/api/auth/appairage', '/api/auth/activate']) {
      const res = await fetch(`${banc.url}${chemin}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      assert.equal(res.status, 403, `${chemin} exige l’en-tête maison`)
    }
  })
})

describe('les cookies', () => {
  test('la session d’animateur est HttpOnly, SameSite=Lax, et Secure en ligne', async () => {
    const local = (await fetch(`${banc.url}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'quizz' },
      body: JSON.stringify({ login: ADMIN.login, password: ADMIN.password }),
    }).then(r => r.headers.get('set-cookie'))) as string
    assert.match(local, /qz_session=/)
    assert.match(local, /HttpOnly/i)
    assert.match(local, /SameSite=Lax/i)
    assert.doesNotMatch(local, /Secure/i) // hors ligne : http, pas de Secure

    const distant = (await fetch(`${enLigne.url}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'quizz', Origin: 'https://exemple.test' },
      body: JSON.stringify({ login: ADMIN.login, password: ADMIN.password }),
    }).then(r => r.headers.get('set-cookie'))) as string
    assert.match(distant, /Secure/i)
  })
})

describe('les adresses de photos', () => {
  test('une photo se sert par son identifiant seul, jamais par un chemin', async () => {
    // Ni traversée de répertoire, ni fichier arbitraire : la route n'accepte
    // que /media/image/:id, et l'identifiant est une clé en base.
    for (const chemin of [
      '/media/image/..%2f..%2f..%2fetc%2fpasswd',
      '/media/image/../../package.json',
      '/media/quiz/../../../package.json',
    ]) {
      const res = await fetch(`${banc.url}${chemin}`)
      const corps = await res.text()
      assert.ok(res.status === 404 || res.status === 400, `${chemin} → ${res.status}`)
      assert.doesNotMatch(corps, /"dependencies"|root:.*:0:0/, `${chemin} ne sert aucun fichier du serveur`)
    }
  })

  test('un identifiant inconnu répond 404, sans révéler l’espace', async () => {
    const res = await fetch(`${banc.url}/media/image/00000000-0000-4000-8000-000000000000`)
    assert.equal(res.status, 404)
  })
})

describe('l’injection d’une image : le type est vérifié par le contenu', () => {
  test('un SVG (qui porterait du script) est refusé à l’envoi', async () => {
    const cookie = await connexionAnimateur(banc.url)
    const svg = 'data:image/svg+xml;base64,' + Buffer.from('<svg onload="alert(1)"/>').toString('base64')
    const res = await fetch(`${banc.url}/api/images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'quizz', Cookie: cookie },
      body: JSON.stringify({ dataUrl: svg }),
    })
    assert.equal(res.status, 400, 'le SVG est refusé : seuls JPEG, PNG, WebP')
  })
})
