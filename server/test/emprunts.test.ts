// Les sessions d'emprunt : ce qu'une session d'animateur peut faire de plus
// que ce qu'on lui a confié.
//
// Deux portes sont volontairement faibles : la télé branchée par un code
// (une soirée, « souvent celle de quelqu'un d'autre ») et la console ouverte
// par le cookie d'un profil (« un téléphone se prête en soirée »). Le mot de
// passe du compte et celui du profil ne se changeaient qu'en donnant
// l'actuel ; mais par « Rattacher mon profil », qui tenait la télé ou le
// téléphone prêté rattachait SON profil à l'espace, à la place de celui de
// l'animateur, et rouvrait la console quand il voulait, bien après la
// soirée. Et un lien d'activation forgé pour son propre compte changeait le
// mot de passe sans l'ancien. « Mon compte », enfin, montrait à toute session
// du compte le profil rattaché au complet, récits des Divins compris.
//
// Chaque test a son propre serveur jetable.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { readFileSync } from 'node:fs'
import { ADMIN, connexionAnimateur, cookieDe, demarrer, ecrire, inscrireProfil, type Banc } from './banc'

async function avecBanc(scenario: (banc: Banc) => Promise<void>) {
  const banc = await demarrer()
  try {
    await scenario(banc)
  } finally {
    await banc.close()
  }
}

const moi = (banc: Banc, cookie: string) => fetch(`${banc.url}/api/auth/me`, { headers: { Cookie: cookie } })

/** Une télé branchée par la console `cookie` : le cookie de la télé. */
async function brancherTele(banc: Banc, cookie: string): Promise<string> {
  const { code, jeton } = (await (await ecrire(banc.url, '/api/auth/appairage', {})).json()) as { code: string; jeton: string }
  assert.equal((await ecrire(banc.url, '/api/auth/appairage/valider', { code }, cookie)).status, 200)
  return cookieDe(await ecrire(banc.url, '/api/auth/appairage/attente', { jeton }))
}

/** Un animateur ordinaire, activé, et le cookie de sa console. */
async function animateur(banc: Banc, login: string): Promise<{ cookie: string; id: string }> {
  const admin = await connexionAnimateur(banc.url)
  const cree = await ecrire(banc.url, '/api/admin/accounts', { login, name: login, slug: `chez-${login}` }, admin)
  const { account, activation } = (await cree.json()) as { account: { id: string }; activation: { token: string } }
  const cookie = cookieDe(await ecrire(banc.url, '/api/auth/activate', { token: activation.token, password: `${login}-secret-1` }))
  return { cookie, id: account.id }
}

test('une télé branchée ne rattache ni ne détache de profil, ne valide pas d’autre télé, et n’entre pas dans l’administration', () =>
  avecBanc(async banc => {
    const telephone = await connexionAnimateur(banc.url)
    const tele = await brancherTele(banc, telephone)
    await inscrireProfil(banc.url, 'intrus', 'Intrus')

    const lien = await ecrire(banc.url, '/api/space/profil', { login: 'intrus', password: 'motdepasse1' }, tele)
    assert.equal(lien.status, 403)
    assert.match(((await lien.json()) as { error: string }).error, /télé/)
    assert.equal((await ecrire(banc.url, '/api/space/profil', {}, tele, 'DELETE')).status, 403)
    assert.equal((await fetch(`${banc.url}/api/admin/accounts`, { headers: { Cookie: tele } })).status, 403)
    // Brancher une autre télé depuis celle-ci : la chaîne ne dépasserait plus la soirée.
    const { code } = (await (await ecrire(banc.url, '/api/auth/appairage', {})).json()) as { code: string }
    assert.equal((await ecrire(banc.url, '/api/auth/appairage/valider', { code }, tele)).status, 403)
    // Le reste de la soirée, lui, marche : la télé lit son compte.
    assert.equal((await moi(banc, tele)).status, 200)
  }))

test('un téléphone prêté, console ouverte par le profil de l’animateur : l’emprunteur ne se rattache pas l’espace', () =>
  avecBanc(async banc => {
    const compte = await connexionAnimateur(banc.url)
    const antoine = await inscrireProfil(banc.url, 'antoine-joue', 'Antoine')
    assert.equal((await ecrire(banc.url, '/api/space/profil', { login: 'antoine-joue', password: 'motdepasse1' }, compte)).status, 200)
    await inscrireProfil(banc.url, 'emprunteur', 'Emprunteur', '🐸', 'secret-emprunteur')

    const consolePretee = cookieDe(await ecrire(banc.url, '/api/joueur/console', {}, antoine))
    // Ses identifiants à lui ne suffisent pas : il faut le mot de passe du
    // profil rattaché, ou celui du compte.
    const sans = await ecrire(banc.url, '/api/space/profil', { login: 'emprunteur', password: 'secret-emprunteur' }, consolePretee)
    assert.equal(sans.status, 400)
    const faux = await ecrire(
      banc.url,
      '/api/space/profil',
      { login: 'emprunteur', password: 'secret-emprunteur', preuve: 'je-devine' },
      consolePretee,
    )
    assert.equal(faux.status, 400)
    // Ni détacher celui d'Antoine.
    assert.equal((await ecrire(banc.url, '/api/space/profil', {}, consolePretee, 'DELETE')).status, 400)
    // Antoine rouvre toujours sa console par son profil.
    assert.equal((await ecrire(banc.url, '/api/joueur/console', {}, antoine)).status, 200)
  }))

test('changer ou détacher le profil de l’espace, avec la preuve : le mot de passe du profil rattaché, ou celui du compte', () =>
  avecBanc(async banc => {
    const compte = await connexionAnimateur(banc.url)
    await inscrireProfil(banc.url, 'premier', 'Premier')
    await inscrireProfil(banc.url, 'second', 'Second', '🐻', 'second-secret')
    assert.equal((await ecrire(banc.url, '/api/space/profil', { login: 'premier', password: 'motdepasse1' }, compte)).status, 200)
    // Le mot de passe du profil rattaché prouve qu'on peut le remplacer…
    const change = await ecrire(
      banc.url,
      '/api/space/profil',
      { login: 'second', password: 'second-secret', preuve: 'motdepasse1' },
      compte,
    )
    assert.equal(change.status, 200)
    // … celui du compte, qu'on peut le détacher.
    assert.equal((await ecrire(banc.url, '/api/space/profil', { preuve: ADMIN.password }, compte, 'DELETE')).status, 200)
    const { profil } = (await (await moi(banc, compte)).json()) as { profil: unknown }
    assert.equal(profil, null)
  }))

test('le profil ouvert sur ce navigateur se rattache par son seul mot de passe — jamais d’un clic', () =>
  avecBanc(async banc => {
    // Il fallait retaper l'identifiant qu'on venait de choisir : environ sept
    // touchers et cinq saisies. L'arbitrage du 27 septembre 2026 garde les
    // deux preuves de l'invariant 16 — la console, et le profil ouvert
    // confirmé par son mot de passe [parcours-profil-7].
    const compte = await connexionAnimateur(banc.url)
    const camille = await inscrireProfil(banc.url, 'camille-joue', 'Camille', '🦊', 'camille-secret')
    const lesDeux = `${compte}; ${camille}`
    // Un ami connecté à son profil sur l'ordinateur de l'animateur ne se rattache pas d'un clic.
    assert.equal((await ecrire(banc.url, '/api/space/profil', {}, lesDeux)).status, 401)
    assert.equal((await ecrire(banc.url, '/api/space/profil', { password: 'pas-le-sien' }, lesDeux)).status, 401)
    // Sans profil ouvert, l'identifiant reste demandé.
    assert.equal((await ecrire(banc.url, '/api/space/profil', { password: 'camille-secret' }, compte)).status, 401)
    const lie = await ecrire(banc.url, '/api/space/profil', { password: 'camille-secret' }, lesDeux)
    assert.equal(lie.status, 200)
    assert.equal(((await lie.json()) as { profil: { login: string } }).profil.login, 'camille-joue')
    // La console le propose : « Rattacher Camille », le mot de passe pour confirmer.
    const page = readFileSync(new URL('../../client/src/views/AccountApp.tsx', import.meta.url), 'utf8')
    assert.match(page, /api\.space\.lierProfil\(parLeProfilOuvert \? '' : login\.trim\(\), password\)/)
    assert.match(page, /\{parLeProfilOuvert \? `Rattacher \$\{ouvert!\.name\}` : 'Rattacher'\}/)
  }))

test('le lien d’activation ne sert pas à changer son propre mot de passe sans l’ancien', () =>
  avecBanc(async banc => {
    const telephone = await connexionAnimateur(banc.url)
    const { account } = (await (await moi(banc, telephone)).json()) as { account: { id: string } }
    const lien = await ecrire(banc.url, `/api/admin/accounts/${account.id}/activation`, {}, telephone)
    assert.equal(lien.status, 400)
    // Celui d'un autre compte, oui : c'est à ça qu'il sert.
    const nadia = await animateur(banc, 'nadia')
    assert.equal((await ecrire(banc.url, `/api/admin/accounts/${nadia.id}/activation`, {}, telephone)).status, 200)
  }))

test('« Mon compte » ne montre du profil rattaché que ce qu’il affiche : la télé du bar ne lit pas le récit d’un Divin', () =>
  avecBanc(async banc => {
    await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    // Hélios est descendu sur Alice, lors d'une soirée d'avant.
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    try {
      const id = (db.prepare('SELECT id FROM profiles WHERE login = ?').get('alice') as { id: string }).id
      db.prepare(
        `INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, 'dv:helios', 'ancienne', '', '☀️', 'Hélios', 1)`,
      ).run(id)
    } finally {
      db.close()
    }
    await banc.redemarrer()
    const console_ = await connexionAnimateur(banc.url)
    assert.equal((await ecrire(banc.url, '/api/space/profil', { login: 'alice', password: 'motdepasse1' }, console_)).status, 200)
    const tele = await brancherTele(banc, console_)
    const me = (await (await moi(banc, tele)).json()) as { profil: Record<string, unknown> }
    assert.deepEqual(Object.keys(me.profil).sort(), ['avatar', 'eclats', 'finition', 'legendaire', 'login', 'name', 'niveau'])
    // Le profil au complet reste à son porteur.
    const alice = cookieDe(await ecrire(banc.url, '/api/joueur/connexion', { login: 'alice', password: 'motdepasse1' }), 'qz_joueur')
    const sienne = (await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: alice } })).json()) as {
      profile: { divins: { key: string; legende?: string }[] }
    }
    assert.ok(sienne.profile.divins.some(d => d.key === 'dv:helios' && d.legende), 'Alice lit toujours son récit')
  }))
