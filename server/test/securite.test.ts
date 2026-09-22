// Les garde-fous de sécurité : où l'on revient après la connexion, et ce que
// coûte un essai raté.
//
// Le serveur tourne « en ligne » : c'est derrière le proxy de l'hébergeur que
// l'adresse du client se lit dans `X-Forwarded-For`, et c'est la seule façon,
// depuis 127.0.0.1, de lui parler comme plusieurs adresses différentes.
// Chaque test prend les siennes (plages réservées à la documentation) : les
// réserves des uns n'entament pas celles des autres.
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { ADMIN, connexionAnimateur, cookieDe, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { pageDeRetour } from '../../shared/securite'

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
