// Les portes en rafale : ce qui part ensemble ne passe pas mieux que ce qui
// part l'un après l'autre.
//
// Chaque verrou se lisait avant une attente — scrypt, la base — et ne se
// comptait qu'après : tous les essais partis ensemble passaient la porte
// avant que le premier échec ne soit compté. Dix-neuf mots de passe faux et
// le bon, lancés dans le même tour de boucle : le bon passait, et le verrou
// « cinq échecs par identifiant » ne bornait plus un attaquant à plusieurs
// adresses. Même motif pour « Recevoir par un code », et pour le code de
// secours, qui servait deux fois en même temps. Et une connexion à l'ancien
// mot de passe, en vol pendant qu'on le change, gardait sa session.
//
// Chaque test a son propre serveur jetable.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ADMIN, connexionAnimateur, cookieDe, creerQuiz, demarrer, ecrire, inscrireProfil, patienter, qcm } from './banc'
import { ProfileStore } from '../src/auth/profiles'
import { AuthStore } from '../src/auth/store'
import { PartageStore } from '../src/core/partages'

test('en série, le sixième essai est refusé', async () => {
  const banc = await demarrer()
  try {
    await inscrireProfil(banc.url, 'cible', 'Cible', '🦊', 'le-bon-mot-de-passe')
    const statuts: number[] = []
    for (let i = 0; i < 7; i++) {
      statuts.push((await ecrire(banc.url, '/api/joueur/connexion', { login: 'cible', password: `faux-${i}-xxxx` })).status)
    }
    assert.deepEqual(statuts, [401, 401, 401, 401, 401, 429, 429])
  } finally {
    await banc.close()
  }
})

test('en rafale, vingt essais partis ensemble : cinq au plus sont vérifiés, et le bon ne passe pas en vingtième', async () => {
  const banc = await demarrer()
  try {
    await inscrireProfil(banc.url, 'cible', 'Cible', '🦊', 'le-bon-mot-de-passe')
    const essais = [...Array.from({ length: 19 }, (_, i) => `faux-${i}-xxxx`), 'le-bon-mot-de-passe']
    const statuts = await Promise.all(
      essais.map(async password => (await ecrire(banc.url, '/api/joueur/connexion', { login: 'cible', password })).status),
    )
    assert.ok(statuts.filter(s => s === 401).length <= 5, statuts.join(' '))
    assert.equal(statuts.at(-1), 429, 'le bon mot de passe, arrivé derrière la rafale, attend le quart d’heure')
  } finally {
    await banc.close()
  }
})

test('le compte d’animateur aussi : la rafale ne traverse pas le verrou', async () => {
  const banc = await demarrer()
  try {
    const statuts = await Promise.all(
      Array.from({ length: 20 }, async (_, i) => (await ecrire(banc.url, '/api/auth/login', { login: 'antoine', password: `faux-${i}-xxxx` })).status),
    )
    assert.ok(statuts.filter(s => s === 401).length <= 5, statuts.join(' '))
  } finally {
    await banc.close()
  }
})

test('un code de secours servi deux fois en même temps : une réussite, et un code neuf qui marche', async () => {
  const banc = await demarrer()
  try {
    const inscription = await ecrire(banc.url, '/api/joueur/inscription', {
      login: 'oublieuse',
      password: 'premier-mot-de-passe',
      name: 'Nina',
      avatar: '🦊',
    })
    const { recovery } = (await inscription.json()) as { recovery: string }
    const [a, b] = await Promise.all(
      ['nouveau-mot-de-passe-a', 'nouveau-mot-de-passe-b'].map(async password => {
        const res = await ecrire(banc.url, '/api/joueur/secours', { login: 'oublieuse', code: recovery, password })
        return { status: res.status, corps: (await res.json()) as any }
      }),
    )
    const reussies = [a, b].filter(r => r.status === 200)
    assert.equal(reussies.length, 1, `${a.status} ${b.status}`)
    const neuf = reussies[0].corps.recovery as string
    const essai = await ecrire(banc.url, '/api/joueur/secours', { login: 'oublieuse', code: neuf, password: 'encore-un-autre-mdp' })
    assert.equal(essai.status, 200, 'le code neuf montré à l’écran marche')
  } finally {
    await banc.close()
  }
})

test('une connexion à l’ancien mot de passe, en vol pendant qu’on le change, ne survit pas', async () => {
  const banc = await demarrer()
  const verifier = ProfileStore.prototype.verifier
  try {
    const proprietaire = await inscrireProfil(banc.url, 'nadia', 'Nadia', '🦊', 'ancien-mot-de-passe')
    // La vérification de l'intrus a lu l'ancien haché et calcule encore
    // (scrypt) pendant que Nadia change son mot de passe : on la retient
    // jusqu'à ce que le changement soit fini.
    let verifie!: () => void
    const intrusVerifie = new Promise<void>(r => (verifie = r))
    let relacher!: () => void
    const porte = new Promise<void>(r => (relacher = r))
    ProfileStore.prototype.verifier = async function (this: ProfileStore, login: unknown, password: string, fallback: string) {
      const resultat = await verifier.call(this, login, password, fallback)
      if (password === 'ancien-mot-de-passe' && login === 'nadia') {
        verifie()
        await porte
      }
      return resultat
    }
    const connexionDeLIntrus = ecrire(banc.url, '/api/joueur/connexion', { login: 'nadia', password: 'ancien-mot-de-passe' })
    await intrusVerifie
    const change = await ecrire(banc.url, '/api/joueur/mot-de-passe', { current: 'ancien-mot-de-passe', next: 'nouveau-mot-de-passe' }, proprietaire)
    assert.equal(change.status, 200)
    relacher()
    const intrus = await connexionDeLIntrus
    const moi = intrus.ok ? await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: cookieDe(intrus, 'qz_joueur') } }) : null
    assert.notEqual(moi?.status, 200, 'la session ouverte avec l’ancien mot de passe ne survit pas au changement')
  } finally {
    ProfileStore.prototype.verifier = verifier
    await banc.close()
  }
})

test('une connexion au compte, en vol pendant qu’on change son mot de passe, ne survit pas', async () => {
  const banc = await demarrer()
  const creer = AuthStore.prototype.createSession
  try {
    const proprietaire = await connexionAnimateur(banc.url)
    // L'intrus connaît l'ancien mot de passe : sa session s'écrit pendant
    // que le propriétaire change le sien.
    let entre!: () => void
    const intrusEnVol = new Promise<void>(r => (entre = r))
    let relacher!: () => void
    const porte = new Promise<void>(r => (relacher = r))
    AuthStore.prototype.createSession = async function (this: AuthStore, ...args: Parameters<typeof creer>) {
      if (args[1] === 'intrus') {
        entre()
        await porte
      }
      return creer.apply(this, args)
    }
    const connexion = fetch(`${banc.url}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'quizz', 'User-Agent': 'intrus' },
      body: JSON.stringify({ login: ADMIN.login, password: ADMIN.password }),
    })
    await intrusEnVol
    const change = await ecrire(banc.url, '/api/auth/password', { current: ADMIN.password, next: 'nouveau-mot-de-passe-1' }, proprietaire)
    assert.equal(change.status, 200)
    relacher()
    const intrus = await connexion
    const moi = intrus.ok ? await fetch(`${banc.url}/api/auth/me`, { headers: { Cookie: cookieDe(intrus) } }) : null
    assert.notEqual(moi?.status, 200, 'la session ouverte avec l’ancien mot de passe survit au changement')
  } finally {
    AuthStore.prototype.createSession = creer
    await banc.close()
  }
})

test('« Recevoir par un code » en rafale : dix essais au plus par quart d’heure', async () => {
  const banc = await demarrer()
  // En ligne, la base permanente répond en dizaines de millisecondes ; le
  // fichier local du banc, avant même la requête suivante.
  const recevoir = PartageStore.prototype.recevoir
  PartageStore.prototype.recevoir = async function (...args: Parameters<typeof recevoir>) {
    await patienter(30)
    return recevoir.apply(this, args)
  }
  try {
    const cookie = await connexionAnimateur(banc.url)
    await creerQuiz(banc.url, cookie, [qcm('Q ?')], 'Témoin')
    // Des codes bien formés — six lettres de l'alphabet du partage — qui ne
    // mènent à rien : chacun attend la base avant d'être jugé.
    const lettres = 'ABCDEFGHJKMNPQRSTUVWXYZ'
    const code = (i: number) => `ZZZ${lettres[i % 23]}${lettres[Math.floor(i / 23) % 23]}Z`
    const statuts = await Promise.all(
      Array.from({ length: 40 }, async (_, i) => (await ecrire(banc.url, '/api/partages/recevoir', { code: code(i) }, cookie)).status),
    )
    const essayes = statuts.filter(s => s === 404 || s === 410 || s === 201).length
    assert.ok(essayes <= 10, `${essayes} codes essayés au lieu de dix au plus : ${statuts.join(' ')}`)
  } finally {
    PartageStore.prototype.recevoir = recevoir
    await banc.close()
  }
})
