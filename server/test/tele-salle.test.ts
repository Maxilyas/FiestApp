// La télé, quand on anime depuis son téléphone.
//
// `/tele` s'ouvre sur l'écran de branchement — le code en six cases, les
// trois gestes du téléphone, le temps qu'il lui reste — et la porte par
// identifiant n'y vient que si on la demande. Branchée par un code pendant
// qu'une télécommande anime, la télé devient un pur écran de salle : ni
// console ni panneau des équipes, et en salle d'attente la salle vue de loin.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import type { PublicPlayer } from '../../shared/types'

Object.assign(globalThis, { React, window: { location: { pathname: '/tele', search: '', hash: '', origin: 'http://banc' } } })

const source = (fichier: string) => readFileSync(new URL(`../../client/src/${fichier}`, import.meta.url), 'utf8')

async function rendu(composant: string, props: object): Promise<string> {
  const module = await import(new URL('../../client/src/components/Tele.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[composant], props))
}

test('/tele : l’écran de branchement d’abord, la porte par identifiant d’un lien', async () => {
  const html = await rendu('EcranDeBranchement', { onBranchee: () => {}, onConnexion: () => {} })
  assert.match(html, /<h1 class="tv-sur" id="tv-brancher">Brancher cette télé<\/h1>/)
  assert.equal(html.match(/<li><b>\d<\/b>/g)?.length, 3, 'les trois gestes du téléphone')
  assert.match(html, /Créer un salon/)
  assert.match(html, /<em>Sur une télé<\/em>/)
  // Avant la réponse du serveur, la télé dit qu'un code arrive : jamais une case vide.
  assert.match(html, /Un code arrive…/)
  assert.match(html, /<button type="button" class="link-inline tv-connexion">J’ai un identifiant d’animateur<\/button>/)
  const host = source('views/HostApp.tsx')
  assert.match(host, /if \(needLogin && route\.kind === 'account' && route\.page === 'tele' && !porteParIdentifiant\) \{\s*return \(\s*<main>\s*<EcranDeBranchement onBranchee=\{branchee\} onConnexion=\{\(\) => setPorteParIdentifiant\(true\)\} \/>/)
  // `/host` garde sa porte : l'identifiant, et le code à côté.
  assert.match(host, /<LoginForm title="Écran commun" error=\{error\} busy=\{busy\} onSubmit=\{submitLogin\} \/>\s*<CodeDeLaTele onBranchee=\{branchee\} \/>/)
  // Le code et le compte à rebours viennent d'une seule logique, que les deux portes partagent.
  assert.match(source('components/Appairage.tsx'), /export function useCodeDeLaTele\(onBranchee: \(\) => void\)/)
  // Le compte à rebours se lit à l'heure du serveur (invariant 6).
  assert.match(source('components/Tele.tsx'), /Math\.round\(\(echeance - maintenant\) \/ 1000\)/)
  assert.match(source('components/Tele.tsx'), /useState\(serverNow\)/)
})

const joueur = (id: string, name: string, avatar: string, connected: boolean): PublicPlayer =>
  ({ id, name, avatar, connected, score: 0, teamId: null }) as unknown as PublicPlayer

test('la salle à la télé : le code et le QR de loin, la soirée et ceux qui sont là, qui lance', async () => {
  const html = await rendu('SalleDeLaTele', {
    titre: 'La soirée d’Antoine',
    code: '482157',
    entreeUrl: 'http://banc/482157',
    players: [joueur('a', 'Hugo', '🐙', true), joueur('b', 'Inès', '🦁', true), joueur('c', 'Bob', '🐻', false)],
    chef: 'Antoine',
  })
  assert.match(html, /<span class="tv-cases tv-cases-salon" role="img" aria-label="Le code : 4 8 2 1 5 7">/)
  assert.match(html, /<title>QR code pour rejoindre la soirée<\/title>/)
  assert.match(html, /<b>2<\/b> joueurs/)
  // Un téléphone éteint n'est pas dans la salle qu'on voit.
  assert.ok(html.includes('Hugo') && html.includes('Inès'))
  assert.ok(!html.includes('Bob'))
  assert.match(html, /Antoine lance la partie depuis son téléphone/)
})

test('branchée par un code pendant qu’une télécommande anime, la télé ne montre rien à toucher', () => {
  const host = source('views/HostApp.tsx')
  assert.match(host, /const ecranDeSalle = me\.branchee && !telecommande && !!snap\.telecommande/)
  assert.match(host, /\{ecranDeSalle && !staging && !quizView \? \(\s*<main>\s*<SalleDeLaTele /)
  // Le focus perdu ne se pose pas sur la question : personne n'y navigue au clavier.
  assert.match(host, /if \(scene\.current\?\.closest\('\.ecran-de-salle'\)\) return/)
  const css = source('styles.css')
  assert.match(css, /\.ecran-de-salle \.console-label, \.ecran-de-salle \.console-actions \{ display: none; \}/)
  // La télé grandit avec la hauteur de l'écran, comme l'écran commun.
  assert.match(css, /@media \(min-width: 1101px\) \{\s*html:has\(\.tv-branchement\) \{ font-size: max\(100%, min\(100vh \/ 48, 100vw \/ 85\)\); \}/)
})
