// Une épreuve à la fois, dite à l'écran (le signalement du propriétaire du
// 5 octobre 2026 : un joueur ne pouvait pas faire le palier 7 de la scène
// alors qu'il lui restait deux vies). Il avait laissé une épreuve en cours
// dans la forêt : le serveur refusait la nouvelle — « Une épreuve t'attend… »
// —, mais la fiche du palier offrait « Jouer » quand même, et le refus
// s'écrivait en haut de la page, sous l'en-tête collé, pendant que le chemin
// montrait le palier : rien ne semblait se passer.
//
// Pas de serveur : la fiche, le sentier et la carte, rendus en HTML.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { BRANCHES, type CleDeBranche } from '../../shared/branches'
import { regleDuPalier, type EpreuveDeSentier, type EtatDesSentiers } from '../../shared/sentiers'

Object.assign(globalThis, {
  React,
  window: { location: { pathname: '/campagne', search: '', hash: '#sentier-scene', origin: 'http://banc', host: 'banc' }, addEventListener: () => {} },
  document: { addEventListener: () => {}, visibilityState: 'visible', hidden: false },
})

const page = () => import(new URL('../../client/src/views/Sentiers.tsx', import.meta.url).href)
const rendre = async (composant: string, props: Record<string, unknown>): Promise<string> => {
  const module = await page()
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[composant], props))
}

/** L'épreuve laissée dans la forêt : le palier 10, deux bonnes réponses sur trois. */
const DANS_LA_FORET: EpreuveDeSentier = { id: 'e1', branche: 'foret', palier: 10, rejeu: false, seuil: 12, justes: 2, fausses: 1, total: 16, issue: null, finie: false }

function etat(par: Partial<Record<CleDeBranche, number>>, epreuve: EpreuveDeSentier | null): EtatDesSentiers {
  return {
    vies: { jour: 2, reserve: 0, parJour: 12, prix: 25, renouveleesLe: Date.now() + 3_600_000 },
    sentiers: BRANCHES.map(b => ({ branche: b.key, paliers: par[b.key] ?? 0, acquis: par[b.key] ?? 0, etoiles: Array.from({ length: 13 }, () => 0) })),
    epreuve,
  }
}

/** La fiche d'un palier de la scène, où la scène en est à son septième. */
const fiche = (palier: number, epreuve: EpreuveDeSentier | null) =>
  rendre('FicheDuPalier', {
    regle: regleDuPalier(palier),
    branche: BRANCHES.find(b => b.key === 'scene'),
    sentier: etat({ scene: 6 }, epreuve).sentiers.find(s => s.branche === 'scene'),
    epreuve,
    maitres: 0,
    sansVie: false,
    busy: false,
    onJouer: () => {},
    onVies: () => {},
    onReprendre: () => {},
  })

test('une épreuve laissée ailleurs : la fiche du palier le dit, et mène à elle au lieu de « Jouer »', async () => {
  const html = await fiche(7, DANS_LA_FORET)
  assert.match(html, /Ton épreuve du palier 10 de la forêt t’attend/)
  assert.match(html, /Une seule épreuve à la fois/)
  assert.match(html, /Reprendre l’épreuve/)
  assert.doesNotMatch(html, /Jouer le palier 7/)
  // Rejouer un palier validé aussi attend qu'elle soit finie : le serveur le refuse pareil.
  const rejeu = await fiche(3, DANS_LA_FORET)
  assert.match(rejeu, /Ton épreuve du palier 10 de la forêt t’attend/)
  assert.doesNotMatch(rejeu, /Rejouer/)
  // Sans épreuve laissée, rien ne change.
  const libre = await fiche(7, null)
  assert.match(libre, /Jouer le palier 7/)
  assert.doesNotMatch(libre, /t’attend/)
  // Ni pour un rejeu laissé, ou une épreuve déjà validée : le serveur les referme de lui-même.
  assert.match(await fiche(7, { ...DANS_LA_FORET, rejeu: true }), /Jouer le palier 7/)
  assert.match(await fiche(7, { ...DANS_LA_FORET, issue: 'validee' }), /Jouer le palier 7/)
})

test('dans un sentier, un refus s’écrit dans l’en-tête collé : il reste en vue quand le chemin défile', async () => {
  const e = etat({ scene: 6 }, null)
  const html = await rendre('SentierVu', {
    sentier: e.sentiers.find(s => s.branche === 'scene'),
    etat: e,
    busy: false,
    erreur: 'Ce sentier n’a pas encore assez de questions : reviens bientôt',
    onRetour: () => {},
    onJouer: () => {},
    onReprendre: () => {},
    onVies: () => {},
  })
  const tete = html.slice(html.indexOf('class="sentier-tete"'), html.indexOf('class="sentier-chemin"'))
  assert.match(tete, /role="alert">Ce sentier n’a pas encore assez de questions/)
  assert.match(tete, /role="alert">[^<]*<\/p><\/div>/, 'dans l’en-tête, pas sous lui')
})

// « Le tour du monde » posait de la culture générale à qui attendait de la
// géographie (un retour de joueur du 10 octobre 2026) : les noms des
// sentiers sont des images, et la catégorie ne se lisait qu'une fois entré.
// Et les étoiles, qui paient désormais, se comptent.
test('chaque tuile dit sa catégorie et ses étoiles ; le bloc du haut, d’où viennent ses questions', async () => {
  const e = etat({ monde: 3 }, null)
  e.sentiers.find(s => s.branche === 'monde')!.etoiles = [3, 2, 1, ...Array(10).fill(0)]
  const html = await rendre('CarteDesSentiers', {
    etat: e,
    onglets: null,
    erreur: '',
    choisi: 'monde',
    onChoisir: () => {},
    onOuvrir: () => {},
    onReprendre: () => {},
    onVies: () => {},
  })
  assert.match(html, /<b>Le tour du monde<\/b><span class="sentiers-categorie"[^>]*>Culture générale<\/span>/)
  assert.match(html, /<b>Les océans<\/b><span class="sentiers-categorie"[^>]*>Géographie<\/span>/)
  assert.match(html, /aria-label="Le tour du monde, Culture générale : 1 avatar sur 6, palier 4, 6 étoiles"/)
  assert.match(html, /Palier 4<span class="sentiers-etoiles"> · ★ 6<\/span>/)
  const bloc = html.slice(html.indexOf('class="sentiers-haut'), html.indexOf('class="sentiers-compte"'))
  assert.match(bloc, /Ses questions : Culture générale · ★ 6 sur 39/)
  assert.match(html, /1 avatar sur 72 · 0 maître · ★ 6/)
})

test('le bloc du haut rappelle l’épreuve laissée quand il montre un autre sentier', async () => {
  const html = await rendre('CarteDesSentiers', {
    etat: etat({ scene: 6, foret: 9 }, DANS_LA_FORET),
    onglets: null,
    erreur: '',
    choisi: 'scene',
    onChoisir: () => {},
    onOuvrir: () => {},
    onReprendre: () => {},
    onVies: () => {},
  })
  const bloc = html.slice(html.indexOf('class="sentiers-haut'), html.indexOf('class="sentiers-compte"'))
  assert.match(bloc, /La scène · palier 7 sur 12/)
  assert.match(bloc, /Ton épreuve du palier 10 de la forêt t’attend/)
  assert.match(bloc, /La reprendre/)
})
