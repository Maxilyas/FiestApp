// La télé, quand on anime depuis son téléphone.
//
// `/tele` s'ouvre sur l'écran de branchement — le code en six cases, les
// trois gestes du téléphone, le temps qu'il lui reste — et la porte par
// identifiant n'y vient que si on la demande. Branchée par un code, la télé
// est un pur écran de salle : ni console ni panneau des équipes, et en salle
// d'attente la salle vue de loin. Elle ne l'était que pendant qu'une
// télécommande se déclarait, et la barre du chef d'un salon ne le faisait
// pas : la télé montrait toute la console, « Mes quiz » et « Mon compte »
// compris (la revue du 12 octobre 2026, `scripts/rendu-tele.ts`).
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
  // Quelqu'un l'anime : rien à toucher, pas même un lien.
  assert.doesNotMatch(html, /<button/)
})

test('personne ne l’anime d’un téléphone : la salle d’attente se laisse piloter d’ici, d’un lien discret', async () => {
  const html = await rendu('SalleDeLaTele', {
    titre: 'La soirée d’Antoine',
    code: '482157',
    entreeUrl: 'http://banc/482157',
    players: [],
    chef: 'Antoine',
    onPiloter: () => {},
  })
  assert.match(html, /<footer class="tv-pied">Antoine lance la partie depuis son téléphone<button type="button" class="link-inline tv-connexion">Piloter d’ici<\/button><\/footer>/)
})

test('branchée par un code, la télé ne montre rien à toucher — dès son branchement, et quand le téléphone qui l’anime se verrouille', () => {
  const host = source('views/HostApp.tsx')
  // Plus de télécommande à attendre : le salon la branche avant que la barre
  // du chef ne s'ouvre, et un téléphone verrouillé la faisait retomber sur la console.
  assert.match(host, /const ecranDeSalle = me\.branchee && !telecommande && !piloteeIci/)
  // La salle d'attente vue de loin, pendant le choix du quiz aussi.
  assert.match(host, /\{ecranDeSalle && !staging \? \(\s*<main>\s*<SalleDeLaTele\b/)
  // Ses coulisses — la liste des quiz, la grille des prix — vont à qui l'anime.
  assert.match(host, /coulissesIci !== numeroDeScene && \(ecranDeSalle \|\| !!snap\.telecommande \|\| telecommandeVue === numeroDeScene\)/)
  // « Piloter d'ici », quand personne ne la tient : au pied de la salle
  // d'attente, qui couvre la console, et dans la console pendant la partie.
  assert.match(host, /onPiloter=\{snap\.telecommande \? undefined : \(\) => setPiloteeIci\(true\)\}/)
  assert.match(host, /\{ecranDeSalle && !snap\.telecommande && \(\s*<button className="btn btn-ghost btn-small piloter-ici" onClick=\{\(\) => setPiloteeIci\(true\)\}>/)
  // Le focus perdu ne se pose pas sur la question : personne n'y navigue au clavier.
  assert.match(host, /if \(scene\.current\?\.closest\('\.ecran-de-salle'\)\) return/)
  const css = source('styles.css')
  assert.match(css, /\.ecran-de-salle \.console-label, \.ecran-de-salle \.console-actions \{ display: none; \}/)
  // La télé grandit avec la hauteur de l'écran, comme l'écran commun.
  assert.match(css, /@media \(min-width: 1101px\) \{\s*html:has\(\.tv-branchement\) \{ font-size: max\(100%, min\(100vh \/ 48, 100vw \/ 85\)\); \}/)
  // La barre du chef est la télécommande de son salon, redite à chaque
  // connexion : la télé n'offre pas de se piloter tant qu'il est là.
  assert.match(source('socketDuChef.ts'), /s\.emit\('host:hello', \{\}, res => \{[\s\S]*?if \(res\.ok\) s\.emit\('host:telecommande', \{ active: true \}\)/)
})

test('la télé se branche par `/tele`, et chaque porte le dit', () => {
  // La télécommande disait d'ouvrir `/host` — la porte au formulaire de
  // connexion —, et que la télé « pourrait piloter » la soirée.
  const host = source('views/HostApp.tsx')
  assert.match(host, /message: `Sur la télé, ouvre \$\{window\.location\.host\}\/tele : elle affiche un code\. Tape-le ici, et elle montrera ta soirée\.`/)
  assert.doesNotMatch(host, /Ouvre \/host sur la télé/)
  assert.match(source('views/SalonApp.tsx'), /Sur la télé, ouvre <strong>\{window\.location\.host\}\/tele<\/strong>/)
  assert.match(source('views/AccountApp.tsx'), /Sur la télé, ouvre <strong>\{window\.location\.host\}\/tele<\/strong>/)
  // Branchée depuis le salon : elle s'ouvre dans un instant — et si elle a
  // été rechargée entre-temps, ou que ce n'était pas la bonne, le champ revient.
  const salon = source('views/SalonApp.tsx')
  assert.match(salon, /<span>Télé branchée : elle s’ouvre dans un instant<\/span>/)
  assert.match(salon, /setTeleBranchee\(false\)\s*setCodeTele\(''\)\s*\}\}\s*>\s*Une autre télé \?/)
})
