// Les écrans de connexion, refaits clairs (la remarque du propriétaire du
// 4 octobre 2026) : l'accueil sans profil et l'entrée d'une soirée
// s'ouvrent sur trois gros boutons — « Jouer sans compte » d'abord, puis
// « Me connecter » et « Créer un profil » —, les champs ne venant qu'avec le
// choix. Et un profil naît d'un prénom et d'un mot de passe : l'identifiant
// s'en déduit, pris par un autre il prend celui que le serveur propose, et
// il ne s'ouvre en champ qu'à la demande.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'

const memoire = new Map<string, string>()
Object.assign(globalThis, {
  React,
  // L'entrée tire la liaison de la soirée (`socket.ts`), qui écoute la page :
  // de quoi l'évaluer, sans rien brancher.
  window: { location: { pathname: '/', search: '', hash: '', origin: 'http://banc', host: 'banc' }, addEventListener: () => {} },
  document: { addEventListener: () => {}, visibilityState: 'visible', hidden: false },
  localStorage: { getItem: (k: string) => memoire.get(k) ?? null, setItem: (k: string, v: string) => memoire.set(k, v), removeItem: (k: string) => memoire.delete(k) },
})
const client = (f: string) => new URL(`../../client/src/${f}`, import.meta.url).href
const rendu = async (fichier: string, nom: string, props: object) => {
  const module = await import(client(fichier))
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[nom], props))
}
const boutons = (html: string) => [...html.matchAll(/<button[^>]*>(.*?)<\/button>/g)].map(m => m[1].replace(/<[^>]+>/g, '').trim())

test('l’accueil sans profil : trois gros boutons, aucun champ', async () => {
  const echappee = React.createElement('button', { type: 'button', className: 'btn btn-accent btn-big btn-block' }, 'Jouer sans compte')
  const html = await rendu('components/ProfilForm.tsx', 'ProfilForm', { echappee, onDone: () => {} })
  assert.deepEqual(boutons(html), ['Jouer sans compte', 'Me connecter', 'Créer un profil'])
  assert.doesNotMatch(html, /<input/, 'les champs attendent le choix')
  // Même format pour les trois : personne ne cherche comment jouer sans compte.
  assert.equal(html.match(/btn-big btn-block/g)?.length, 3)
})

test('l’entrée d’une soirée : les mêmes trois boutons, dans le même ordre', async () => {
  const html = await rendu('components/Entree.tsx', 'Entree', {
    space: { slug: 'chez-nadia', title: 'La soirée de Nadia', eyebrow: 'La soirée', headline: 'de Nadia', dateLine: '', maxPlayers: 150 },
    players: [],
    teams: [],
    profil: null,
    reconnecter: async () => null,
    rejoindre: async () => null,
    oublierProfil: async () => {},
    reprendre: async () => null,
  })
  assert.deepEqual(boutons(html), ['Jouer sans compte', 'Me connecter', 'Créer un profil'])
  assert.doesNotMatch(html, /<input/)
})

test('un profil naît d’un prénom et d’un mot de passe : l’identifiant s’en déduit, sur une ligne', async () => {
  const html = await rendu('components/ProfilForm.tsx', 'ProfilForm', { creer: true, prefill: { name: 'Camille', avatar: '🦊' }, onDone: () => {} })
  assert.match(html, /id="pf-name"/)
  assert.match(html, /id="pf-pass"/)
  assert.doesNotMatch(html, /id="pf-login"/, 'pas de troisième champ')
  assert.match(html, /Pour te reconnecter : <b>camille<\/b>/)
  assert.match(html, />modifier<\/button>/)
  // En connexion, l'identifiant reste un champ : c'est lui qu'on tape.
  const connexion = await rendu('components/ProfilForm.tsx', 'ProfilForm', { onDone: () => {} })
  assert.match(connexion, /id="pf-login"/)
})

test('un identifiant deviné et pris prend celui que le serveur propose ; tapé à la main, jamais en silence', async () => {
  const { api, ApiError } = await import(client('api.ts'))
  const { inscrireAvecRepli } = await import(client('components/IdentifiantDiscret.tsx'))
  const essais: string[] = []
  const avant = api.joueur.inscription
  api.joueur.inscription = async (champs: { login: string }) => {
    essais.push(champs.login)
    if (champs.login === 'camille') throw new ApiError('« camille » est déjà pris', 'camille2')
    return { profile: { name: 'Camille' }, espace: null, recovery: 'ABCD-EFGH' }
  }
  try {
    const champs = { login: 'camille', password: 'motdepasse1', name: 'Camille', avatar: '🦊' }
    const fait = await inscrireAvecRepli(champs, true)
    assert.equal(fait.login, 'camille2', 'l’identifiant retenu, à noter avec le code')
    assert.deepEqual(essais, ['camille', 'camille2'])
    essais.length = 0
    await assert.rejects(inscrireAvecRepli(champs, false), /déjà pris/)
    assert.deepEqual(essais, ['camille'], 'un identifiant choisi ne se remplace pas')
  } finally {
    api.joueur.inscription = avant
  }
})
