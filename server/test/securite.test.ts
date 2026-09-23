// Les garde-fous de sécurité : où l'on revient après la connexion, ce que
// coûte un essai raté, ce qu'une panne laisse lire, et ce que la page a le
// droit de charger.
//
// Le serveur tourne « en ligne » : c'est derrière le proxy de l'hébergeur que
// l'adresse du client se lit dans `X-Forwarded-For`, et c'est la seule façon,
// depuis 127.0.0.1, de lui parler comme plusieurs adresses différentes.
// Chaque test prend les siennes (plages réservées à la documentation) : les
// réserves des uns n'entament pas celles des autres.
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { randomBytes } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import express from 'express'
import { createClient } from '@libsql/client'
import { ADMIN, connexionAnimateur, cookieDe, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { pageDeRetour } from '../../shared/securite'
import { messagePourEcran, wrap } from '../src/core/http'

let banc: Banc

before(async () => {
  banc = await demarrer({ online: true })
})

after(async () => {
  await banc.close()
})

/** Une écriture venue d'une adresse donnée, telle que le proxy de l'hébergeur la rapporte. */
function depuis(ip: string, chemin: string, body: unknown, cookie?: string, method = 'POST') {
  return fetch(`${banc.url}${chemin}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'quizz',
      'X-Forwarded-For': ip,
      ...(cookie && { Cookie: cookie }),
    },
    body: JSON.stringify(body),
  })
}

/**
 * Frappe à une porte jusqu'au premier refus : la réserve de cette adresse est
 * alors vide. Les portes choisies répondent sans calculer de haché, si bien
 * qu'il ne se recharge rien entre le dernier essai et la question qui suit.
 */
async function epuiser(ip: string, chemin: string, body: unknown) {
  for (let i = 0; i < 60; i++) {
    if ((await depuis(ip, chemin, body)).status === 429) return
  }
  throw new Error(`${chemin} ne refuse jamais rien`)
}

// ── La page de retour après connexion ───────────────────────────────────

describe('la page de retour après connexion', () => {
  const ORIGINE = 'https://quiz.example'
  /** `next` tel que la page le lit : décodé par le navigateur depuis la barre d'adresse. */
  const retour = (search: string) => pageDeRetour(new URLSearchParams(search).get('next'), ORIGINE)

  test('une page d’ici est suivie, avec sa requête et son ancre', () => {
    assert.equal(retour('?next=/compte'), '/compte')
    assert.equal(retour('?next=/admin'), '/admin')
    assert.equal(retour('?next=%2Fcompte%3Fonglet%3Dprofil%23mdp'), '/compte?onglet=profil#mdp')
    assert.equal(retour('?next=https://quiz.example/compte'), '/compte', 'une adresse complète, mais d’ici')
  })

  test('toute adresse qui mène ailleurs ramène à l’écran commun', () => {
    for (const piege of [
      // Les deux premières passaient l'ancien test (« commence par une barre,
      // pas par deux ») : le navigateur lit la contre-oblique comme une barre,
      // et efface la tabulation et le saut de ligne avant de résoudre.
      '?next=/\\evil.example',
      '?next=/%5Cevil.example',
      '?next=/%09/evil.example',
      '?next=/%0A/evil.example',
      '?next=/%0D/evil.example',
      '?next=//evil.example',
      '?next=%20//evil.example',
      '?next=\\\\evil.example',
      '?next=https://evil.example',
      '?next=https://quiz.example.evil.example/compte',
      '?next=javascript:alert(1)',
      '?next=JaVaScRiPt:alert(1)',
      '?next=data:text/html,<script>alert(1)</script>',
      '?next=',
      '',
    ]) {
      assert.equal(retour(piege), '/host', `${JSON.stringify(piege)} ne doit mener nulle part ailleurs`)
    }
  })

  test('un caractère de contrôle suffit à refuser, même sans quitter le site', () => {
    // Le navigateur l'effacerait sans rien dire : un lien honnête n'en porte pas.
    assert.equal(retour('?next=/com%09pte'), '/host')
    assert.equal(retour('?next=/compte%00'), '/host')
  })
})

// ── Les limites d'essais ────────────────────────────────────────────────

describe('l’activation d’un compte', () => {
  test('cinq liens invalides venus d’une adresse n’empêchent pas une activation depuis une autre', async () => {
    const admin = await connexionAnimateur(banc.url)
    const cree = await ecrire(banc.url, '/api/admin/accounts', { login: 'zoe', name: 'Zoé', slug: 'chez-zoe' }, admin)
    assert.equal(cree.status, 201, 'création du compte de Zoé')
    const { activation } = (await cree.json()) as { activation: { token: string } }

    for (let i = 0; i < 5; i++) {
      const faux = await depuis('203.0.113.10', '/api/auth/activate', {
        token: randomBytes(32).toString('base64url'),
        password: 'zoe-pass-12',
      })
      assert.equal(faux.status, 400, 'un lien inconnu est refusé')
    }

    const ok = await depuis('198.51.100.20', '/api/auth/activate', { token: activation.token, password: 'zoe-pass-12' })
    assert.equal(ok.status, 200, 'Zoé ne paie pas les essais d’un autre')
    cookieDe(ok)
  })

  test('ni depuis la même adresse : un jeton de 256 bits ne se devine pas, un verrou n’y ajouterait qu’une impasse', async () => {
    const admin = await connexionAnimateur(banc.url)
    const cree = await ecrire(banc.url, '/api/admin/accounts', { login: 'yann', name: 'Yann', slug: 'chez-yann' }, admin)
    const { activation } = (await cree.json()) as { activation: { token: string } }
    const ip = '203.0.113.11'
    for (let i = 0; i < 6; i++) {
      await depuis(ip, '/api/auth/activate', { token: randomBytes(32).toString('base64url'), password: 'yann-pass-12' })
    }
    const ok = await depuis(ip, '/api/auth/activate', { token: activation.token, password: 'yann-pass-12' })
    assert.equal(ok.status, 200, 'un vieux lien cliqué six fois ne ferme pas la porte au nouveau')
  })
})

describe('une seule réserve pour toutes les portes de la console', () => {
  // Le mot de passe du compte, celui du profil rattaché et son code de
  // secours ouvrent tous la même console : un débit par porte, c'était
  // trois fois plus d'essais pour qui les alterne.
  test('les essais épuisés côté compte comptent aussi côté profil', async () => {
    const ip = '203.0.113.30'
    await epuiser(ip, '/api/auth/activate', { token: 'x', password: 'court' })
    const res = await depuis(ip, '/api/joueur/connexion', { login: 'personne', password: 'motdepasse1' })
    assert.equal(res.status, 429)
  })

  test('et inversement, même avec le bon mot de passe', async () => {
    const ip = '203.0.113.31'
    await epuiser(ip, '/api/joueur/secours', { login: 'personne', code: 'x', password: 'court' })
    const res = await depuis(ip, '/api/auth/login', { login: ADMIN.login, password: ADMIN.password })
    assert.equal(res.status, 429)
  })
})

describe('un verrou par secret visé, quelle que soit la porte', () => {
  test('les échecs du rattachement comptent pour le mot de passe du profil', async () => {
    // « Rattacher mon profil » vérifie le même mot de passe que la connexion
    // au profil : cinq échecs d'un côté ne rouvrent pas cinq essais de l'autre.
    await inscrireProfil(banc.url, 'cible', 'Cible')
    const admin = await connexionAnimateur(banc.url)
    for (let i = 0; i < 5; i++) {
      const raté = await depuis('203.0.113.40', '/api/space/profil', { login: 'cible', password: 'pas-le-bon' }, admin)
      assert.equal(raté.status, 401)
    }
    const res = await depuis('198.51.100.41', '/api/joueur/connexion', { login: 'cible', password: 'motdepasse1' })
    assert.equal(res.status, 429, 'le profil est fermé un quart d’heure, d’où que vienne l’essai suivant')
  })

  test('un identifiant de 32 caractères ne s’allonge pas pour échapper au verrou', async () => {
    // La base ne lit que les 32 premiers caractères : « …x » visait le même
    // profil, mais sous une clé de verrou toute neuve.
    const long = 'identifiant-de-trente-deux-lettr'
    assert.equal(long.length, 32)
    await inscrireProfil(banc.url, long, 'Long')
    for (let i = 0; i < 5; i++) {
      await depuis('203.0.113.50', '/api/joueur/connexion', { login: long, password: 'pas-le-bon' })
    }
    const res = await depuis('198.51.100.51', '/api/joueur/connexion', { login: `${long}x`, password: 'motdepasse1' })
    assert.equal(res.status, 429)
  })
})

// ── Ce qu'une erreur laisse lire ────────────────────────────────────────

describe('les erreurs', () => {
  const NEUTRE = { error: 'Erreur serveur — réessaie dans un instant' }

  test('une erreur voulue garde son message', async () => {
    const admin = await connexionAnimateur(banc.url)
    const res = await ecrire(banc.url, '/api/admin/accounts', { login: ADMIN.login, name: 'Doublon', slug: 'doublon' }, admin)
    assert.equal(res.status, 400)
    assert.deepEqual(await res.json(), { error: 'Cet identifiant est déjà pris' })
  })

  test('une ligne illisible en base : l’historique et le renommage tiennent, la relire donne un 500 neutre, et le détail part au journal', async () => {
    const admin = await connexionAnimateur(banc.url)
    const me = (await (await fetch(`${banc.url}/api/auth/me`, { headers: { Cookie: admin } })).json()) as any
    // Une archive abîmée — écriture interrompue, retouche à la main dans la
    // console de Turso. Le message de JSON.parse en recopie le début : ce qui
    // est en base n'a pas à sortir par là.
    const base = createClient({ url: banc.quizDbUrl })
    const abime = 'contenu-prive-de-la-base {"joueurs": []}'
    await base.execute({
      sql: 'INSERT INTO soirees (space_id, id, title, held_at, archived_at, summary, data) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [me.account.id, 'abimee', 'Soirée abîmée', Date.now(), Date.now(), abime, abime],
    })
    const journal: string[] = []
    const errorAvant = console.error
    console.error = (...args: unknown[]) => {
      journal.push(args.map(a => (a instanceof Error ? `${a.name}: ${a.message}` : String(a))).join(' '))
    }
    try {
      // L'historique, lui, reste lisible : une archive abîmée ne doit pas
      // emporter toutes les autres. Elle s'y liste vide — sans rien recopier
      // de ce qui est en base.
      const liste = await fetch(`${banc.url}/s/${ADMIN.slug}/soirees.json`)
      const texteListe = await liste.text()
      assert.equal(liste.status, 200, `l’historique public : ${texteListe}`)
      assert.doesNotMatch(texteListe, /contenu-prive/, 'l’historique ne recopie rien de la ligne abîmée')
      assert.ok((JSON.parse(texteListe) as any).archives.some((a: any) => a.id === 'abimee'), 'la soirée abîmée reste listée')
      // La renommer non plus : son titre ne dépend pas de son contenu.
      const renommee = await ecrire(banc.url, '/api/soirees/abimee', { title: 'Autre' }, admin, 'PUT')
      const texteRenommee = await renommee.text()
      assert.equal(renommee.status, 200, `le renommage, derrière la session : ${texteRenommee}`)
      assert.doesNotMatch(texteRenommee, /contenu-prive/, 'le renommage ne recopie rien de la ligne abîmée')
      // La relire, elle, n'a pas de sens : un 500 neutre, sans le début de la ligne.
      const relue = await fetch(`${banc.url}/s/${ADMIN.slug}/soirees/abimee/recap.json`)
      const texteRelue = await relue.text()
      assert.equal(relue.status, 500, `une soirée archivée : ${texteRelue}`)
      assert.deepEqual(JSON.parse(texteRelue), NEUTRE, 'une soirée archivée')
      // Son résumé d'origine n'a pas été remplacé par une fiche vide.
      const reste = await base.execute({ sql: 'SELECT summary FROM soirees WHERE id = ?', args: ['abimee'] })
      assert.equal(String(reste.rows[0]?.summary), abime, 'la ligne abîmée reste telle quelle, pour qu’on puisse la réparer')
    } finally {
      console.error = errorAvant
      await base.execute({ sql: 'DELETE FROM soirees WHERE id = ?', args: ['abimee'] })
      base.close()
    }
    // L'historique la signale au journal, la relecture aussi : le détail est
    // là où l'on répare, jamais dans la réponse.
    assert.ok(journal.length >= 2, `chaque panne laisse sa trace au journal : ${journal.join(' | ')}`)
    assert.ok(journal.every(l => l.includes('SyntaxError')), `le journal garde le détail : ${journal.join(' | ')}`)
  })

  test('wrap : seul un Error nu parle à l’utilisateur', async () => {
    // La règle est dans la classe : le code lève exprès des `Error` nus, en
    // français ; tout le reste vient des entrailles et parle de tables, de
    // chemins ou de positions dans un JSON.
    class LibsqlError extends Error {
      code = 'SQLITE_ERROR'
    }
    const cas: [string, unknown, number, unknown][] = [
      ['voulue', new Error('Il faut un titre'), 400, { error: 'Il faut un titre' }],
      ['type', new TypeError("Cannot read properties of undefined (reading 'questions')"), 500, NEUTRE],
      ['base', new LibsqlError('SQLITE_ERROR: no such table: soirees'), 500, NEUTRE],
      ['portee', new RangeError('Invalid array length'), 500, NEUTRE],
      // Les erreurs du système sont des Error nus, mais portent un code — et
      // souvent un chemin du serveur.
      ['systeme', Object.assign(new Error("ENOENT: no such file or directory, open '/srv/data/quizz.db'"), { code: 'ENOENT' }), 500, NEUTRE],
      ['chaine', 'une chaîne levée telle quelle', 500, NEUTRE],
    ]
    const app = express()
    for (const [nom, erreur] of cas) {
      app.get(
        `/${nom}`,
        wrap(async () => {
          throw erreur
        }),
      )
    }
    const serveur = app.listen(0)
    await new Promise(r => serveur.once('listening', r))
    const errorAvant = console.error
    console.error = () => {}
    try {
      const { port } = serveur.address() as AddressInfo
      for (const [nom, , statut, corps] of cas) {
        const res = await fetch(`http://localhost:${port}/${nom}`)
        assert.equal(res.status, statut, nom)
        assert.deepEqual(await res.json(), corps, nom)
      }
    } finally {
      console.error = errorAvant
      serveur.close()
    }
  })
})

// ── Ce qu'Express répond quand il n'a pas su lire ───────────────────────

describe('les requêtes illisibles', () => {
  test('un JSON cassé reçoit un refus en JSON, sans la pile du serveur', async () => {
    const res = await fetch(`${banc.url}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'quizz' },
      body: '{pas du json',
    })
    assert.equal(res.status, 400)
    assert.match(res.headers.get('content-type') ?? '', /application\/json/)
    const texte = await res.text()
    // La page d'erreur d'Express citait `node_modules/body-parser/…` et les
    // chemins absolus du serveur : rien de tout ça ne doit sortir.
    assert.doesNotMatch(texte, /node_modules|at JSON\.parse|<pre>/)
    assert.deepEqual(JSON.parse(texte), { error: 'Requête illisible — recharge la page et réessaie' })
  })

  test('un corps trop lourd le dit, en JSON', async () => {
    const res = await fetch(`${banc.url}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'quizz' },
      body: JSON.stringify({ login: 'x'.repeat(20_000), password: 'y' }),
    })
    assert.equal(res.status, 413)
    assert.deepEqual(await res.json(), { error: 'Envoi trop lourd — allège-le et réessaie' })
  })
})

describe('les toasts de l’écran commun', () => {
  test('un message voulu passe, une panne des entrailles reste au journal', () => {
    const errorAvant = console.error
    const journal: unknown[] = []
    console.error = (...args: unknown[]) => journal.push(args)
    try {
      assert.equal(messagePourEcran(new Error('Quiz introuvable'), 'host:command'), 'Quiz introuvable')
      assert.equal(journal.length, 0, 'un message voulu ne salit pas le journal')
      // Projetée sur la TV, une erreur de base de données dirait le nom de ses tables.
      const panne = Object.assign(new Error('SQLITE_CORRUPT: database disk image is malformed'), { code: 'SQLITE_CORRUPT' })
      assert.equal(messagePourEcran(panne, 'host:resetParty'), 'Erreur serveur — réessaie dans un instant')
      assert.equal(messagePourEcran(new TypeError('x is undefined'), 'host:launch'), 'Erreur serveur — réessaie dans un instant')
      assert.equal(journal.length, 2, 'le détail des pannes part au journal')
    } finally {
      console.error = errorAvant
    }
  })
})

// ── La politique de contenu ─────────────────────────────────────────────

/** Les en-têtes d'une réponse pour un `Host` donné : `fetch` recalcule le sien depuis l'adresse. */
function entetes(host: string, extra: Record<string, string> = {}): Promise<http.IncomingHttpHeaders> {
  const { port } = new URL(banc.url)
  return new Promise((resolve, reject) => {
    http
      .get({ host: 'localhost', port, path: '/healthz', headers: { Host: host, ...extra } }, res => {
        res.resume()
        resolve(res.headers)
      })
      .on('error', reject)
  })
}

/** Les directives d'une politique, chacune avec ses sources. */
function directives(csp: string | string[] | undefined): Map<string, string[]> {
  assert.equal(typeof csp, 'string', 'la réponse doit porter une politique de contenu')
  return new Map(
    (csp as string)
      .split(';')
      .map(d => d.trim().split(/\s+/))
      .filter(d => d[0])
      .map(([nom, ...sources]) => [nom, sources]),
  )
}

describe('la politique de contenu', () => {
  test('le temps réel ne parle qu’à l’hôte de la page, et personne ne l’encadre', async () => {
    const res = await fetch(`${banc.url}/healthz`)
    const csp = directives(res.headers.get('content-security-policy') ?? undefined)
    const hote = new URL(banc.url).host
    assert.deepEqual(csp.get('connect-src'), ["'self'", `ws://${hote}`, `wss://${hote}`])
    assert.deepEqual(csp.get('frame-ancestors'), ["'none'"])
    // Le reste ne bouge pas.
    assert.deepEqual(csp.get('default-src'), ["'self'"])
    assert.deepEqual(csp.get('script-src'), ["'self'"])
    assert.deepEqual(csp.get('object-src'), ["'none'"])
    assert.deepEqual(csp.get('base-uri'), ["'self'"])
    assert.deepEqual(csp.get('form-action'), ["'self'"])
  })

  test('l’écran en localhost, les téléphones sur le wifi, l’hébergeur en https : chacun son hôte', async () => {
    for (const [host, extra] of [
      ['localhost:3001', {}],
      ['192.168.1.20:3001', {}],
      ['[::1]:3001', {}],
      // Derrière le proxy de l'hébergeur : la page est en https, le temps
      // réel en wss, et l'en-tête Host reste celui que le navigateur a demandé.
      ['fiestapp-quizz.onrender.com', { 'X-Forwarded-Proto': 'https', 'X-Forwarded-For': '203.0.113.60' }],
    ] as const) {
      const csp = directives((await entetes(host, extra))['content-security-policy'])
      assert.deepEqual(csp.get('connect-src'), ["'self'", `ws://${host}`, `wss://${host}`], host)
    }
  })

  test('un en-tête Host piégé n’écrit rien dans la politique', async () => {
    for (const host of ['evil.example; script-src *', "evil.example 'unsafe-inline'", 'evil.example,*', '*']) {
      const brute = (await entetes(host))['content-security-policy'] as string
      const csp = directives(brute)
      assert.deepEqual(csp.get('connect-src'), ["'self'"], host)
      assert.deepEqual(csp.get('script-src'), ["'self'"], host)
      assert.ok(!brute.includes('evil.example'), `${host} : ${brute}`)
    }
  })
})
