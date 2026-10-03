// Le lien entre les pages, de joueur à animateur (lot 12, la remarque du
// propriétaire du 27 septembre 2026) : « quand on a les deux rôles, on se perd
// sur comment aller dans un salon, comment aller sur les quiz ».
//
// L'accueil n'avait pour l'animateur qu'« Animer ma soirée » ; « Mes quiz »
// ne s'atteignait que par la salle d'attente de l'écran commun ; chaque page
// de l'animateur avait sa barre, aucune ne ramenait à l'accueil, et trois
// pages n'avaient aucune sortie. Sans navigateur : les composants rendus en
// HTML, et les sources telles qu'on les écrit ; les parcours, eux, ont été
// rejoués dans Chromium en 360 × 640 et 1366 × 768.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'

// Le client compile son JSX pour un `React` global, et lit son adresse une
// fois, au chargement : posés avant tout import d'un composant.
Object.assign(globalThis, {
  React,
  window: { location: { pathname: '/', search: '', hash: '', origin: 'http://banc' }, opener: null },
  location: { pathname: '/', search: '', hash: '', origin: 'http://banc' },
})

/** Un composant du client, rendu en HTML. */
async function rendu(fichier: string, composant: string, props: object): Promise<string> {
  const module = await import(new URL(`../../client/src/${fichier}.tsx`, import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[composant], props))
}

/** Une source du client, telle qu'on l'écrit. */
const source = (fichier: string) => readFileSync(new URL(`../../client/src/${fichier}`, import.meta.url), 'utf8')

/** Les liens et boutons d'un rendu, dans l'ordre : leur texte, et où ils mènent. */
function gestes(html: string): string[] {
  return [...html.matchAll(/<(a|button|span)\b([^>]*)>(.*?)<\/\1>/g)]
    .filter(([, balise, attributs]) => balise !== 'span' || /aria-current/.test(attributs))
    .map(([, balise, attributs, contenu]) => {
      const texte = contenu.replace(/<[^>]+>/g, '').replace(/&#x27;|&#39;/g, '’').trim()
      const href = /href="([^"]*)"/.exec(attributs)?.[1]
      const ici = /aria-current="page"/.test(attributs)
      return `${texte}${href ? ` → ${href}` : ''}${ici ? ' (ici)' : ''}${balise === 'button' ? ' [bouton]' : ''}`
    })
}

const ESPACE = { slug: 'chez-bob', name: 'Bob', title: 'La soirée de Bob', eyebrow: '', headline: '', dateLine: '', maxPlayers: 60 }

test('les pages de l’animateur ont la même barre, dans le même ordre, et elle ramène à l’accueil', async () => {
  const barre = (ici: string, admin: boolean) => rendu('components/NavAnimateur', 'NavAnimateur', { ici, slug: 'chez-bob', admin })
  assert.deepEqual(gestes(await barre('compte', false)), [
    'Accueil → /',
    'Écran commun → /host',
    'Mes quiz → /edit',
    'Mon compte (ici)',
    'Historique → /chez-bob/soirees',
  ])
  assert.deepEqual(gestes(await barre('quiz', true)), [
    'Accueil → /',
    'Écran commun → /host',
    'Mes quiz (ici)',
    'Mon compte → /compte',
    'Historique → /chez-bob/soirees',
    'Les comptes → /admin',
  ])
  assert.deepEqual(gestes(await barre('admin', true)).at(-1), 'Les comptes (ici)')
  // « Mes quiz », « Mon compte » et « Les comptes » la portent, chacun à sa place ;
  // leurs anciennes barres, qui changeaient d'ordre et de taille, sont parties.
  assert.match(source('views/EditorApp.tsx'), /<NavAnimateur ici="quiz" slug=\{slug\} admin=\{isAdmin\} \/>/)
  assert.match(source('views/AccountApp.tsx'), /<NavAnimateur ici="compte" slug=\{me\.space\.slug\} admin=\{me\.account\.role === 'admin'\} \/>/)
  assert.match(source('views/AdminApp.tsx'), /<NavAnimateur ici="admin" slug=\{me\.space\.slug\} admin \/>/)
  for (const f of ['views/EditorApp.tsx', 'views/AccountApp.tsx', 'views/AdminApp.tsx']) {
    assert.doesNotMatch(source(f), /bibliotheque-nav|<nav className="row bilan-tabs">/, `${f} garde sa propre barre`)
  }
})

test('l’écran commun mène à l’accueil, dans son onglet, et l’accueil ouvert par lui y ramène', async () => {
  // Dans la bande de la salle d'attente, comme « Mes quiz » : l'écran commun
  // ne quitte pas la télé.
  const host = source('views/HostApp.tsx')
  assert.match(host, /\s<a className="btn btn-ghost" href="\/" target=\{ONGLETS\.accueil\}>\s*<Icon name="home" \/>\s*Accueil\s*<\/a>/)
  assert.doesNotMatch(host, /\{telecommande && \(\s*<a className="btn btn-ghost" href="\/"/, 'au PC comme à la télécommande')
  assert.match(source('onglets.ts'), /accueil: 'fiestapp-accueil'/)
  // Ouvert par la console, l'accueil n'en ouvre pas une seconde : il y ramène.
  const anime = source('components/AccueilDesRoles.tsx')
  assert.match(anime, /const \[ouvreuse\] = useState\(\(\) => consoleOuvreuse\(\) !== null\)/)
  assert.match(anime, /ouvreuse &&\s*revenirALaConsole\(/)
  assert.match(anime, /\{ouvreuse \? 'Revenir à la console' : 'Ouvrir l’écran commun'\}/)
})

test('l’accueil de qui anime : l’écran commun, un salon, ses quiz, son compte, l’historique', async () => {
  const html = await rendu('components/AccueilDesRoles', 'JAnime', { espace: ESPACE, rouvrir: true })
  assert.match(html, /J’anime/)
  assert.match(html, /La soirée de Bob/)
  assert.deepEqual(gestes(html), [
    'Ouvrir l’écran commun [bouton]',
    'Nouveau salon → /salon',
    'Mes quiz → /edit',
    'Mon compte → /compte',
    'Historique → /chez-bob/soirees',
  ])
  // Un salon s'ouvre avec son profil : la console ouverte ici sans lui n'en propose pas.
  const sansProfil = await rendu('components/AccueilDesRoles', 'JAnime', { espace: ESPACE, rouvrir: false })
  assert.ok(!gestes(sansProfil).some(g => g.includes('/salon')))
  // Venu de son profil, la session d'animateur a pu expirer : elle se
  // rouvre avant de partir, sinon « Mes quiz » renverrait à une connexion.
  const anime = source('components/AccueilDesRoles.tsx')
  assert.match(anime, /if \(rouvrir\) await api\.joueur\.console\(\)\s*window\.location\.assign\(dest\)/)
  assert.match(anime, /href="\/edit" onClick=\{parLaSession\('\/edit'\)\}/)
  assert.match(anime, /href="\/compte" onClick=\{parLaSession\('\/compte'\)\}/)
  // Le profil rattaché l'anime, sinon la console ouverte ici ; l'animateur
  // sans profil retrouve sa carte au-dessus de « Me connecter ».
  const profil = source('views/ProfilApp.tsx')
  assert.match(profil, /const animateur = espace \?\? console_/)
  assert.match(profil, /\{animateur && <JAnime espace=\{animateur\} rouvrir=\{!!espace\} \/>\}/)
  assert.match(profil, /\{console_ && <JAnime espace=\{console_\} rouvrir=\{false\} \/>\}/)
  assert.match(profil, /pied=\{!console_ && <PorteAnimateur \/>\}/)
})

test('l’accueil d’un profil : une soirée en cours d’abord, puis le quiz du jour, un salon, rejoindre — en gros boutons, à la même place', async () => {
  const accueil = (props: object) =>
    rendu('components/AccueilDesRoles', 'AccueilJouer', { enCours: [], onRejoindre: () => {}, lendemain: null, ...props })
  const toujours = ['Le quiz du jourDix questions, les mêmes pour tous → /jour', 'Créer un salonTes quiz, tes amis, un code à dicter → /salon', 'Rejoindre une soiréeLe code à six chiffres de ton hôte [bouton]']

  // Rien en cours : les trois gestes, aucun principal — l'ordre ne dépend ni
  // de l'heure ni des rôles, contrairement à « Je joue » et « Ce soir ».
  const libre = await accueil({})
  assert.deepEqual(gestes(libre), toujours)
  assert.doesNotMatch(libre, /gros-principal/)

  // Inscrit chez Alice : y revenir passe devant tout, et seul en principal.
  const chezAlice = await accueil({ enCours: [{ nom: 'Alice', slug: 'chez-alice' }] })
  assert.deepEqual(gestes(chezAlice), ['Revenir chez AliceLa soirée continue sans toi → /chez-alice', ...toujours])
  assert.match(chezAlice, /class="gros-bouton gros-principal" href="\/chez-alice"/)
  assert.equal([...chezAlice.matchAll(/gros-principal/g)].length, 1)
})

test('les pages sans sortie en ont une : l’accueil', () => {
  // « Mon compte » en erreur, les comptes pour qui n'est pas administrateur :
  // une phrase seule.
  assert.match(source('views/AccountApp.tsx'), /<p className="error">\{error\}<\/p>\s*<a className="btn btn-ghost" href="\/">/)
  const admin = source('views/AdminApp.tsx')
  assert.match(admin, /<p className="error">\{error\}<\/p>\s*<div className="row">\s*<a className="btn btn-ghost" href="\/">/)
  assert.match(admin, /\{me && \(\s*<a className="btn btn-ghost" href="\/compte">/)
  // Un lien d'activation périmé ou incomplet ne proposait rien.
  const activer = source('views/ActivateApp.tsx')
  assert.match(activer, /\) : \(\s*\/\/[^\n]*\n\s*\/\/[^\n]*\n\s*<a className="btn btn-block" href="\/">/)
  assert.match(activer, /\{!token && \(\s*<a className="btn btn-block" href="\/">/)
  // Les pages publiques ramènent l'animateur de l'espace chez lui.
  assert.match(source('components/SpaceNav.tsx'), /\{host && \(\s*<div className="space-nav-hote">\s*<a className="space-nav-account" href="\/">/)
})
