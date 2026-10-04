// Un seul profil (le choix du propriétaire du 3 octobre 2026) : plus
// d'animateur d'un côté et de joueur de l'autre.
//
// Les comptes d'animateur d'avant — un mot de passe, pas de profil —
// reçoivent le leur au premier démarrage qui le connaît, au même identifiant
// et au même mot de passe, une fois pour toutes ; un identifiant déjà pris
// par un autre profil ne se devine pas, et l'administrateur le rattache d'un
// geste. Ce geste fusionne deux identités : le profil tient l'espace, et les
// quiz du salon qu'il tenait le rejoignent, photos comprises.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Database from 'better-sqlite3'
import { connexionAnimateur, cookieDe, creerQuiz, demarrer, ecrire, inscrireProfil, qcm, type Banc } from './banc'
import { DRAPEAU } from '../src/auth/profilUnique'
import type { EspaceDAdministration } from '../../shared/space'

const source = (fichier: string) => readFileSync(new URL(`../../client/src/${fichier}`, import.meta.url), 'utf8')
const lire = (banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as any }))

/** Un compte d'animateur à l'ancienne : créé par l'administrateur, activé avec son mot de passe. */
async function compteDAvant(banc: Banc, admin: string, login: string, nom: string, slug: string, password: string) {
  const cree = await ecrire(banc.url, '/api/admin/accounts', { login, name: nom, slug }, admin)
  const { activation } = (await cree.json()) as { activation: { token: string } }
  return cookieDe(await ecrire(banc.url, '/api/auth/activate', { token: activation.token, password }))
}

let banc: Banc
before(async () => {
  banc = await demarrer()
})
after(() => banc.close())

test('au premier démarrage qui le connaît, chaque compte d’avant reçoit son profil : même identifiant, même mot de passe', async () => {
  const admin = await connexionAnimateur(banc.url)
  const nadia = await compteDAvant(banc, admin, 'nadia', 'Nadia', 'chez-nadia', 'nadia-pass-1')
  await creerQuiz(banc.url, nadia, [qcm('La sienne ?')], 'Le quiz de Nadia')
  // Un identifiant déjà pris par un autre profil : le serveur ne devine pas.
  await inscrireProfil(banc.url, 'hugo', 'Hugo', '🐙')
  await compteDAvant(banc, admin, 'hugo', 'Hugo (compte)', 'chez-hugo', 'hugo-pass-1')

  // Une base neuve pose le drapeau sans rien adopter : les comptes créés depuis
  // ne sont pas « d'avant ». On rejoue ici le premier démarrage d'une base qui l'était.
  const permanente = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  assert.ok(permanente.prepare('SELECT 1 FROM meta WHERE key = ?').get(DRAPEAU), 'posé sur la base neuve')
  permanente.prepare('DELETE FROM meta WHERE key = ?').run(DRAPEAU)
  permanente.close()
  await banc.redemarrer()

  // Nadia se connecte à l'accueil, avec ses identifiants de toujours : son espace est son salon.
  const res = await ecrire(banc.url, '/api/joueur/connexion', { login: 'nadia', password: 'nadia-pass-1' })
  assert.equal(res.status, 200)
  const { profile, espace } = (await res.json()) as { profile: { name: string }; espace: { slug: string } | null }
  assert.equal(profile.name, 'Nadia')
  assert.equal(espace?.slug, 'chez-nadia', 'son espace d’avant, rattaché')
  const quiz = (await lire(banc, cookieDe(res, 'qz_session'), '/api/quizzes')).corps as { title: string }[]
  assert.ok(quiz.some(q => q.title === 'Le quiz de Nadia'), 'ses quiz sont là')

  // Hugo, lui, garde son compte tel quel : l'identifiant était pris.
  const espaces = (await lire(banc, await connexionAnimateur(banc.url), '/api/admin/espaces')).corps as EspaceDAdministration[]
  assert.equal(espaces.find(e => e.slug === 'chez-hugo')?.titulaire, null)
  assert.equal(espaces.find(e => e.slug === 'chez-nadia')?.titulaire?.nom, 'Nadia')

  // Une fois pour toutes : un compte détaché plus tard ne se voit pas recréer un profil.
  await banc.redemarrer()
  const apres = (await lire(banc, await connexionAnimateur(banc.url), '/api/admin/profils?q=nadia')).corps as { profils: unknown[] }
  assert.equal(apres.profils.length, 1, 'un seul profil Nadia')
})

test('l’administrateur fusionne deux identités : le profil tient l’espace, les quiz de son salon le rejoignent', async () => {
  const admin = await connexionAnimateur(banc.url)
  // Léa avait son salon, avec un quiz, et un compte d'avant sous un autre identifiant.
  const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
  const salon = await ecrire(banc.url, '/api/joueur/espace', {}, lea)
  const consoleDuSalon = cookieDe(salon)
  const { espace: ancien } = (await salon.json()) as { espace: { slug: string } }
  await creerQuiz(banc.url, consoleDuSalon, [qcm('Du salon ?')], 'Le quiz du salon')
  await compteDAvant(banc, admin, 'lea-anime', 'Chez Léa', 'chez-lea', 'lea-pass-1')

  const espaces = (await lire(banc, admin, '/api/admin/espaces')).corps as EspaceDAdministration[]
  const compte = espaces.find(e => e.slug === 'chez-lea')!
  assert.equal(compte.titulaire, null)
  const fait = await ecrire(banc.url, `/api/admin/espaces/${compte.id}/titulaire`, { login: 'lea' }, admin)
  assert.equal(fait.status, 200)
  assert.deepEqual(await fait.json(), { ok: true, recopies: 1, ancien: ancien.slug })

  const apres = (await lire(banc, admin, '/api/admin/espaces')).corps as EspaceDAdministration[]
  assert.equal(apres.find(e => e.slug === 'chez-lea')?.titulaire?.nom, 'Léa', 'le profil tient l’espace')
  assert.equal(apres.find(e => e.slug === ancien.slug)?.titulaire, null, 'l’ancien salon reste, détaché')
  // Sa console mène maintenant à l'espace gardé, ses quiz recopiés dedans.
  const ouverte = await ecrire(banc.url, '/api/joueur/espace', {}, lea)
  assert.equal(((await ouverte.json()) as { espace: { slug: string } }).espace.slug, 'chez-lea')
  const quiz = (await lire(banc, cookieDe(ouverte), '/api/quizzes')).corps as { title: string }[]
  assert.ok(quiz.some(q => q.title === 'Le quiz du salon'))

  // Un espace qui a déjà un titulaire ne se fusionne pas par-dessus.
  const encore = await ecrire(banc.url, `/api/admin/espaces/${compte.id}/titulaire`, { login: 'lea' }, admin)
  assert.equal(encore.status, 400)
})

test('au téléphone : une seule porte, et le Compte parle du profil', () => {
  // `/connexion` et l'écran commun : le profil d'abord, un compte d'avant ensuite.
  assert.match(source('views/LoginApp.tsx'), /await seConnecter\(login, password\)/)
  assert.match(source('views/HostApp.tsx'), /await seConnecter\(login, password\)/)
  assert.match(source('api.ts'), /const \{ espace \} = await api\.joueur\.connexion\(login, password\)\s*if \(!espace\) await api\.joueur\.espace\(\)/)
  // « J'anime une soirée », sous la connexion, doublait « Me connecter » et « Créer un profil » : un salon
  // s'ouvre avec son profil, depuis l'accueil (la remarque du 4 octobre 2026). Le chemin sans compte dit
  // le même mot qu'à l'entrée d'une soirée.
  const accueil = source('views/ProfilApp.tsx')
  assert.doesNotMatch(accueil, /J’anime une soirée|PorteAnimateur/)
  assert.match(accueil, /onClick=\{\(\) => setRejoindre\(true\)\}>\s*Jouer sans compte/)
  // Un profil qui tient l'espace : son mot de passe, sa déconnexion ; ni « Détacher » ni écran commun.
  const compte = source('views/AccountApp.tsx')
  assert.match(compte, /const parLeProfil = !!me\.profil/)
  assert.doesNotMatch(compte, /ligne\('monitor', 'L’écran commun'/)
  // La fusion, d'un geste, dans la feuille d'un espace sans titulaire.
  assert.match(source('components/AdminSalons.tsx'), /\{!e\.titulaire && !e\.toi && e\.status !== 'disabled' && \(\s*<button[^>]*onClick=\{\(\) => void rattacher\(\)\}/)
})
