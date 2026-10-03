// La barre du menu du joueur, et ses cinq pièces.
//
// Accueil · Mes quiz · Profil · Boutique · Compte : toujours au même
// endroit, sous le pouce, chacune à son adresse. L'accueil se lit en gros
// boutons, le profil en tuiles, la boutique a sa page. « Mes quiz » et
// « Compte » sont des pièces de tout profil : ils s'ouvrent par lui, sans
// compte d'animateur à demander.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import { parseRoute } from '../../shared/adresses'

Object.assign(globalThis, {
  React,
  window: { location: { pathname: '/', search: '', hash: '', origin: 'http://banc' } },
  location: { pathname: '/', search: '', hash: '', origin: 'http://banc' },
})

const source = (fichier: string) => readFileSync(new URL(`../../client/src/${fichier}`, import.meta.url), 'utf8')

async function rendu(fichier: string, composant: string, props: object): Promise<string> {
  const module = await import(new URL(`../../client/src/${fichier}.tsx`, import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[composant], props))
}

test('la barre du menu : cinq pièces, chacune son adresse, celle où l’on est dite sans couleur seule', async () => {
  const html = await rendu('components/Pieces', 'MenuBarre', { ici: 'profil' })
  const pieces = [...html.matchAll(/<a href="([^"]+)"( aria-current="page")?>.*?<\/svg>([^<]+)<\/a>/g)].map(([, href, ici, nom]) => `${nom} → ${href}${ici ? ' (ici)' : ''}`)
  assert.deepEqual(pieces, ['Accueil → /', 'Mes quiz → /edit', 'Profil → /profil (ici)', 'Boutique → /boutique', 'Compte → /compte'])
  assert.match(html, /<nav class="menu-barre" aria-label="Menu">/)
  // La pièce courante se dit en gras et par un filet, pas par sa seule couleur.
  const css = source('styles.css')
  assert.match(css, /\.menu-barre a\[aria-current='page'\] \{[^}]*font-weight: 600/)
  assert.match(css, /\.menu-barre a\[aria-current='page'\]::before \{/)
})

test('l’accueil, le profil et la boutique sont la même page, qui lit son adresse', () => {
  assert.deepEqual(parseRoute('/boutique'), { kind: 'account', page: 'boutique' })
  assert.match(source('main.tsx'), /boutique: ProfilApp,/)
  const profil = source('views/ProfilApp.tsx')
  for (const ici of ['accueil', 'profil', 'boutique']) assert.match(profil, new RegExp(`menu\\('${ici}'\\)`), `la barre sur « ${ici} »`)
  // Les tuiles ouvrent leurs écrans, chacun à son adresse ; le retour du navigateur y ramène.
  assert.match(profil, /history\.pushState\(history\.state, '', `\$\{window\.location\.pathname\}\$\{window\.location\.search\}#\$\{e\}`\)/)
  // Les adresses d'avant mènent encore quelque part.
  assert.match(profil, /const ANCIENNES: Record<string, EcranDuProfil> = \{ apparence: 'avatars' \}/)
  assert.match(profil, /window\.location\.hash === '#mes-themes'\) window\.location\.replace\('\/boutique'\)/)
  assert.match(source('components/FinDeSoiree.tsx'), /<a href="\/boutique">La boutique des thèmes<\/a>/)
  // L'accueil anonyme reste un écran de connexion : ni barre, ni tuiles.
  const anonyme = profil.slice(profil.indexOf('if (!profil) {'), profil.indexOf('const part = profil.requis'))
  assert.doesNotMatch(anonyme, /MenuBarre|menu\(/)
})

test('« Mes quiz » et « Compte » s’ouvrent par le profil, une fois, puis la connexion', () => {
  const editeur = source('views/EditorApp.tsx')
  assert.match(editeur, /<MenuBarre ici="quiz" \/>/)
  assert.match(editeur, /if \(!essaiParLeProfil\.current\) \{\s*essaiParLeProfil\.current = true\s*const ouverte = await ouvrirParLeProfil\(\)/)
  const compte = source('views/AccountApp.tsx')
  assert.match(compte, /<MenuBarre ici="compte" \/>/)
  // Une fois : un cookie refusé relirait la page sans fin.
  assert.match(compte, /window\.location\.replace\(ouverte \? '\/compte\?par-profil=1' : '\/connexion\?next=\/compte'\)/)
  // L'éditeur d'un quiz a sa propre barre d'enregistrement : celle du menu n'y est pas.
  const editeurDeQuiz = editeur.slice(editeur.indexOf('if (editingId) {'), editeur.indexOf('const filtreActif'))
  assert.doesNotMatch(editeurDeQuiz, /MenuBarre/)
})

test('le Compte d’un profil parle du profil : son identifiant, son mot de passe, son salon', () => {
  const compte = source('views/AccountApp.tsx')
  // L'espace créé par « Créer un salon » n'a pas de mot de passe : le profil est sa seule porte.
  assert.match(compte, /const parLeProfil = me\.account\.status === 'pending' && !!me\.profil/)
  assert.match(compte, /Identifiant <strong>\{parLeProfil \? me\.profil!\.login : me\.account\.login\}<\/strong>/)
  assert.match(compte, /<ChangerMotDePasse login=\{me\.profil!\.login\} \/>/)
  assert.match(compte, /\(parLeProfil \? api\.joueur\.deconnexion\(\) : api\.auth\.logout\(\)\)/)
  // Le mot de passe du profil a quitté le profil pour le Compte.
  assert.doesNotMatch(source('views/ProfilApp.tsx'), /Identifiant et mot de passe/)
})
