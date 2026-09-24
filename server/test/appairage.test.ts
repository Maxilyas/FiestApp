// Brancher la télé depuis son téléphone : un code court affiché par la télé,
// validé par la console déjà ouverte, et la télé reçoit une session de CET
// espace. Léa avait tapé deux adresses et deux connexions, mots de passe
// accentués compris, à la télécommande de la télé.
//
// C'est une porte d'authentification : chaque garde-fou a son test.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ADMIN,
  connexionAnimateur,
  cookieDe,
  demarrer,
  ecranCommun,
  ecrire,
  emitAck,
  connecter,
  inscrireProfil,
  type Banc,
} from './banc'
import { APPAIRAGE_MS, Appairages, normaliserCode } from '../src/auth/appairage'

async function avecBanc(scenario: (banc: Banc) => Promise<void>) {
  const banc = await demarrer()
  try {
    await scenario(banc)
  } finally {
    await banc.close()
  }
}

/** La télé, sans session, demande un code. */
async function demanderCode(banc: Banc): Promise<{ code: string; jeton: string; expireA: number }> {
  const res = await ecrire(banc.url, '/api/auth/appairage', {})
  assert.equal(res.status, 200, 'la télé obtient un code')
  return (await res.json()) as any
}

const valider = (banc: Banc, code: string, cookie?: string) =>
  ecrire(banc.url, '/api/auth/appairage/valider', { code }, cookie)

const attente = (banc: Banc, jeton: string) => ecrire(banc.url, '/api/auth/appairage/attente', { jeton })

const ouverte = async (banc: Banc, cookie: string) =>
  (await fetch(`${banc.url}/api/auth/me`, { headers: { Cookie: cookie } })).status === 200

test('la télé affiche un code, le téléphone le valide, la télé devient écran commun de cet espace', () =>
  avecBanc(async banc => {
    const telephone = await connexionAnimateur(banc.url)
    const { code, jeton, expireA } = await demanderCode(banc)
    assert.match(code, /^[A-HJ-NP-Z2-9]{6}$/, 'six signes sans ambiguïté')
    assert.ok(expireA - Date.now() <= APPAIRAGE_MS)

    // Tant que personne n'a validé, la télé attend — sans cookie.
    const avant = await attente(banc, jeton)
    assert.deepEqual(await avant.json(), { attente: true })
    assert.equal(avant.headers.get('set-cookie'), null)

    // Tapé comme on le lit : minuscules et espace compris.
    const tape = `${code.slice(0, 3)} ${code.slice(3)}`.toLowerCase()
    assert.equal((await valider(banc, tape, telephone)).status, 200)

    const apres = await attente(banc, jeton)
    assert.equal(apres.status, 200)
    const tele = cookieDe(apres)
    const ecran = connecter(banc.url, tele)
    const hello = await emitAck<any>(ecran, 'host:hello', {})
    assert.equal(hello.ok, true, 'la télé se présente comme écran commun')
    assert.equal(hello.slug, ADMIN.slug, 'celui de l’espace qui a validé')

    // Le jeton ne sert qu'une fois : rejoué, il ne rouvre rien.
    assert.equal((await attente(banc, jeton)).status, 410)
  }))

test('un code se valide une fois, depuis une console ouverte, et cinq erreurs ferment cette console', () =>
  avecBanc(async banc => {
    const telephone = await connexionAnimateur(banc.url)
    const { code } = await demanderCode(banc)

    // Sans console ouverte, personne ne valide rien.
    assert.equal((await valider(banc, code)).status, 401, 'sans session')
    // Un second téléphone ne détourne pas un code déjà validé vers son espace.
    assert.equal((await valider(banc, code, telephone)).status, 200)
    assert.equal((await valider(banc, code, telephone)).status, 400, 'usage unique')

    // Cinq codes faux — le code rejoué en était un —, et cette console
    // attend un quart d'heure, même avec le bon.
    for (let i = 0; i < 4; i++) assert.equal((await valider(banc, 'ZZZZZZ', telephone)).status, 400)
    const bon = (await demanderCode(banc)).code
    assert.equal((await valider(banc, bon, telephone)).status, 429, 'la console est verrouillée')
    // Une autre console de l'espace, elle, n'est pas punie pour celle-là.
    const autre = await connexionAnimateur(banc.url)
    assert.equal((await valider(banc, bon, autre)).status, 200)
  }))

test('un code périmé ne se valide plus, et la télé en redemande un', () => {
  const appairages = new Appairages()
  const t0 = 1_000_000
  const qui = { accountId: 'a', sessionId: 's', profileId: null }
  const ouvert = appairages.ouvrir(t0)!
  assert.equal(appairages.valider(ouvert.code, qui, t0 + APPAIRAGE_MS + 1), false, 'périmé')
  assert.deepEqual(appairages.reclamer(ouvert.jeton, t0 + APPAIRAGE_MS + 1), { etat: 'perime' })
  const neuf = appairages.ouvrir(t0)!
  assert.equal(appairages.valider(neuf.code, qui, t0 + APPAIRAGE_MS - 1), true, 'encore bon juste avant')
  assert.equal(normaliserCode(' ab-c 2 3 4 '), 'ABC234')
})

test('la télé hérite de la porte qui l’a validée : ouverte au profil, elle tombe avec lui (invariant 16)', () =>
  avecBanc(async banc => {
    // L'écran de la soirée, ouvert au mot de passe du compte.
    const compte = await connexionAnimateur(banc.url)
    await inscrireProfil(banc.url, 'anim', 'Antoine')
    assert.equal((await ecrire(banc.url, '/api/space/profil', { login: 'anim', password: 'motdepasse1' }, compte)).status, 200)
    const parProfil = cookieDe(await ecrire(banc.url, '/api/joueur/connexion', { login: 'anim', password: 'motdepasse1' }))

    /** Une télé branchée depuis cette console. */
    const brancher = async (console: string) => {
      const { code, jeton } = await demanderCode(banc)
      assert.equal((await valider(banc, code, console)).status, 200)
      return cookieDe(await attente(banc, jeton))
    }
    const teleDuProfil = await brancher(parProfil)
    const teleDuCompte = await brancher(compte)
    const ecran = await ecranCommun(banc.url, teleDuProfil)
    const coupe = new Promise(r => ecran.once('disconnect', r))

    // Le profil détache l'espace : ce qu'il avait ouvert se ferme, la télé
    // qu'il avait branchée comprise ; celle du compte tient.
    assert.equal((await ecrire(banc.url, '/api/space/profil', {}, compte, 'DELETE')).status, 200)
    assert.equal(await ouverte(banc, teleDuProfil), false, 'la télé branchée par le profil se ferme')
    await coupe
    assert.equal(await ouverte(banc, teleDuCompte), true, 'celle branchée par le compte tient')
  }))

test('la console qui a validé s’est fermée avant que la télé ne réclame : rien n’est ouvert', () =>
  avecBanc(async banc => {
    const telephone = await connexionAnimateur(banc.url)
    const { code, jeton } = await demanderCode(banc)
    assert.equal((await valider(banc, code, telephone)).status, 200)
    assert.equal((await ecrire(banc.url, '/api/auth/logout', {}, telephone)).status, 200)
    const res = await attente(banc, jeton)
    assert.equal(res.status, 410)
    assert.equal(res.headers.get('set-cookie'), null)
  }))
