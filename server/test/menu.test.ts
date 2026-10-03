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
  // L'entrée retient l'écran d'où l'on vient : un réglage de « Mon style » y revient d'un cran.
  assert.match(profil, /history\.pushState\(\{ \.\.\.history\.state, \[DEPUIS\]: lireEcran\(\) \}, '', `\$\{window\.location\.pathname\}\$\{window\.location\.search\}#\$\{e\}`\)/)
  assert.match(profil, /if \(history\.state\?\.\[DEPUIS\] === 'style'\) history\.back\(\)/)
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
  // Un seul profil (le choix du 3 octobre 2026) : dès qu'un profil tient l'espace, salon ou compte d'avant.
  assert.match(compte, /const parLeProfil = !!me\.profil/)
  assert.match(compte, /<span className="sr-only">Identifiant <\/span>\s*<strong>\{parLeProfil \? me\.profil!\.login : me\.account\.login\}<\/strong>/)
  assert.match(compte, /<ChangerMotDePasse login=\{me\.profil!\.login\} \/>/)
  assert.match(compte, /\(parLeProfil \? api\.joueur\.deconnexion\(\) : api\.auth\.logout\(\)\)/)
  // Le mot de passe du profil a quitté le profil pour le Compte.
  assert.doesNotMatch(source('views/ProfilApp.tsx'), /Identifiant et mot de passe/)
})

test('les pages publiques gardent leur fil — souvenir, bilan, historique — et le quiz du jour la sortie commune', () => {
  // « Jouer », depuis le souvenir d'une soirée close, menait à l'entrée de la suivante : une impasse le lendemain.
  assert.doesNotMatch(source('components/SpaceNav.tsx'), /<a href=\{spacePath\(slug\)\}>Jouer<\/a>/)
  // « ← Accueil » en tête, le même partout : le quiz du jour, la campagne, le salon.
  for (const f of ['views/JourApp.tsx', 'views/CampagneApp.tsx', 'views/SalonApp.tsx']) assert.match(source(f), /<Sortie \/>/, f)
})

test('chaque pièce a sa couleur, que la barre du menu pose sur la page', () => {
  const pieces = source('components/Pieces.tsx')
  assert.match(pieces, /const ZONE: Record<Piece, string> = \{ accueil: 'zone-jouer', quiz: 'zone-quiz', profil: 'zone-profil', boutique: 'zone-boutique', compte: 'zone-compte' \}/)
  assert.match(pieces, /if \(zone\) document\.body\.classList\.add\(zone\)/)
  const css = source('styles.css')
  for (const [zone, jeton] of [['jouer', 'accent-text'], ['quiz', 'shape-3'], ['profil', 'anneau-divin'], ['boutique', 'shape-0'], ['compte', 'argent-text']]) {
    assert.match(css, new RegExp(`--zone-${zone}: var\\(--${jeton}\\);`), zone)
    assert.match(css, new RegExp(`\\.zone-${zone} \\{ --zone: var\\(--zone-${zone}\\); \\}`), zone)
  }
  // Le titre de la page, ses icônes et la pièce courante de la barre la lisent.
  assert.match(css, /\.piece-tete \.label \{ color: var\(--zone, var\(--muted\)\); \}/)
  assert.match(css, /\.menu-barre a\[aria-current='page'\] \{ color: var\(--zone, var\(--accent-text\)\); font-weight: 600; \}/)
})

test('soi-même en tête : la carte au profil, une ligne à l’accueil — l’expérience qui manque, les confettis au bout', async () => {
  const profil = {
    id: 'p',
    login: 'lea',
    name: 'Léa',
    avatar: '🦊',
    finition: 'mat',
    niveau: 3,
    acquis: 40,
    requis: 100,
    titre: null,
    fond: null,
    laurier: false,
    legendaire: null,
    eclats: [],
    boutique: { confettis: { solde: 291 } },
  }
  const carte = await rendu('components/Identite', 'Identite', { profil })
  assert.match(carte, /<button type="button" class="identite" aria-label="Ma carte : la voir comme la salle la voit">/)
  assert.match(carte, /60 XP → niv\. 4/)
  assert.match(carte, /🎊<\/span> 291<span class="sr-only"> confettis<\/span>/)
  assert.match(carte, /Ma carte/)
  const ligne = await rendu('components/Identite', 'IdentiteLigne', { profil })
  assert.match(ligne, /<a class="identite-ligne" href="\/profil"/)
  assert.doesNotMatch(ligne, /Ma carte/, 'la ligne de l’accueil mène au profil, sans carte')
  assert.match(source('views/ProfilApp.tsx'), /<IdentiteLigne profil=\{profil\} \/>/)
})

test('le Compte en lignes : chacune dit son état et ouvre sa feuille, l’administration à part', () => {
  const compte = source('views/AccountApp.tsx')
  assert.match(compte, /<header className="compte-tete">\s*<h1>Compte<\/h1>/)
  // L'affiche, le mot de passe, le profil rattaché : une feuille chacun, plus une page de formulaires empilés.
  assert.match(compte, /\{ligne\('edit', 'L’affiche', me\.space\.title, 'affiche'\)\}/)
  assert.match(compte, /\{ligne\('lock', 'Mot de passe', '••••••••', 'mdp'\)\}/)
  assert.match(compte, /\{!parLeProfil && ligne\('users', 'Mon profil joueur', me\.profil\?\.name \?\? 'À rattacher', 'profil'\)\}/)
  // Le titre de la feuille dit « du compte » : l'animateur qui joue a deux mots de passe.
  assert.match(compte, /<Feuille titre=\{parLeProfil \? 'Mot de passe' : 'Le mot de passe du compte'\} onFermer=\{fermer\}>/)
  // L'administration, pour l'administrateur seul.
  assert.match(compte, /\{me\.account\.role === 'admin' && \(\s*<>\s*<h2 className="compte-groupe">/)
  // Une seule barre : l'animateur qui a un profil a la barre du menu, et l'historique en ligne.
  assert.match(compte, /\{!me\.profil && <NavAnimateur /)
  // L'écran commun ne se tient plus d'ici : le salon y mène, la télé s'y branche par son code.
  assert.doesNotMatch(compte, /ligne\('monitor', 'L’écran commun'/)
  // Les formulaires vivent dans leur feuille : plus de carte ni de titre à eux.
  assert.doesNotMatch(compte, /<h2>(Ma soirée|Mon profil joueur|Changer le mot de passe du compte|Se déconnecter)<\/h2>/)
})
