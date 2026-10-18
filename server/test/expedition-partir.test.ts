// « ← Partir », en haut de chaque écran de l'expédition : le retour du
// propriétaire du 18 octobre 2026, « Je ne peux pas partir de l'expédition ».
// Depuis l'étape 1, partir relisait la page et la montrait comme à l'arrivée :
// l'expédition en route reprenait aussitôt, sur l'écran même qu'on quittait —
// la carte, la préparation d'une rencontre — et l'on n'en sortait que par le
// navigateur. Partir mène au départ, qui la garde, avec « Reprendre » ;
// arriver sur la page la reprend toujours où elle en est.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import type { PageDeLExpedition, VueDeLExpedition } from '../../shared/expedition'

Object.assign(globalThis, { React, window: { location: { pathname: '/expedition', search: '', hash: '' } } })

type Composant = (props: Record<string, unknown>) => React.ReactNode

/** La page, chargée par son adresse : le typage du serveur ne lit pas le JSX du client. */
async function laPage(): Promise<{ ecranDeLaPage: (page: PageDeLExpedition, enPartant?: boolean) => { e: string; vue?: VueDeLExpedition; page?: PageDeLExpedition }; Depart: Composant }> {
  return import(new URL('../../client/src/views/ExpeditionApp.tsx', import.meta.url).href)
}

const rien = () => {}

/** Le départ tel que la page le sert. */
async function depart(page: PageDeLExpedition): Promise<string> {
  const { Depart } = await laPage()
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(Depart, { page, busy: false, erreur: '', onPartir: rien, onReprendre: rien, onAbandonner: rien }))
}

const prochaine: PageDeLExpedition['prochaine'] = { numero: 7, gardiens: ['lg:kraken', 'lg:dragon', 'lg:oracle'], aLui: [], invite: 'lg:lion', equipables: [] }
const enRoute = { id: 'x', numero: 7, acte: 0, rang: 3, issue: 'en-route' } as VueDeLExpedition

test('arriver sur la page reprend l’expédition en route ; sans elle, le départ', async () => {
  const { ecranDeLaPage } = await laPage()
  assert.equal(typeof ecranDeLaPage, 'function', 'la page dit quel écran ouvrir (`ecranDeLaPage`)')
  const avec: PageDeLExpedition = { expedition: enRoute, prochaine, passeport: [] }
  assert.deepEqual(ecranDeLaPage(avec), { e: 'route', vue: enRoute })
  const sans: PageDeLExpedition = { expedition: null, prochaine, passeport: [] }
  assert.deepEqual(ecranDeLaPage(sans), { e: 'depart', page: sans })
})

test('« ← Partir » mène au départ, qui garde l’expédition en route', async () => {
  const { ecranDeLaPage } = await laPage()
  assert.equal(typeof ecranDeLaPage, 'function', 'la page dit quel écran ouvrir (`ecranDeLaPage`)')
  const avec: PageDeLExpedition = { expedition: enRoute, prochaine, passeport: [] }
  // Pas la route : partir la rouvrait sur l'écran même qu'on quittait.
  assert.deepEqual(ecranDeLaPage(avec, true), { e: 'depart', page: avec })
})

test('du départ, l’expédition en route se reprend — ou s’abandonne', async () => {
  // « J'aimerais pouvoir abandonner une expédition » (le 18 octobre 2026) : le geste ne vivait qu'au fond de la feuille de la carte.
  const vue = { ...enRoute, gardiens: prochaine.gardiens.map(cle => ({ cle, vaincu: false })), vies: 3, justes: 2, courage: 41, equipee: [], invite: 'lg:lion' } as VueDeLExpedition
  const html = await depart({ expedition: vue, prochaine, passeport: [] })
  assert.match(html, /Reprendre<\/button>/)
  assert.match(html, /<button type="button" class="link-inline small exp-abandonner">Abandonner cette expédition<\/button>/)
  // Pas sans expédition : rien à abandonner.
  assert.doesNotMatch(await depart({ expedition: null, prochaine, passeport: [] }), /exp-abandonner/)
})

test('le départ d’un débutant ne lui demande pas de légendaires : l’invité du jour part d’office', async () => {
  // « C'est pas clair de devoir mettre des légendaires sur la première page, surtout qu'au début on n'a pas forcément ça. »
  const html = await depart({ expedition: null, prochaine: { ...prochaine, rencontres: true }, passeport: [] })
  assert.doesNotMatch(html, /exp-equipee|Ton équipe|Une place libre|Tes familles/)
  assert.match(html, /<p class="card exp-invite-seul">/)
  assert.match(html.replace(/<[^>]+>/g, ''), /Le Lion Couronné, l’invité du jour, part avec toi\s*: sa carte rejoint ton paquet\./)
  // Avec un légendaire à lui, l'équipe se choisit, comme avant — « Ton équipe » : « équipée » se lisait comme une faute.
  const sien = await depart({ expedition: null, prochaine: { ...prochaine, rencontres: true, equipables: ['lg:dragon'] }, passeport: [] })
  assert.match(sien, /exp-equipee/)
  assert.match(sien, /<h2 class="label" id="exp-equipee-titre">Ton équipe<\/h2>/)
  assert.doesNotMatch(sien, /exp-invite-seul|équipée/)
})

test('le départ sans paragraphes : les gardiens côte à côte, le paquet en un lien, les règles au « ? »', async () => {
  // « Trop d'infos écrites sur la page on s'y perd : sur chaque page beaucoup de trucs. […] Pas besoin d'explication pour tout,
  // il faudrait juste un onglet règles qu'on peut consulter de n'importe quelle page » (la revue du 18 octobre 2026).
  const html = await depart({ expedition: null, prochaine: { ...prochaine, rencontres: true, equipables: ['lg:dragon'] }, passeport: [] })
  const lu = html.replace(/<[^>]+>/g, ' ')
  // Ce que les règles disent ne se redit plus sur le départ.
  assert.doesNotMatch(lu, /points à lui faire perdre|quarantaine de questions|garde ta place|Chaque thème pointu|Tes familles|Chaque escale à question|Ton paquet au départ/)
  assert.match(html, /<div class="exp-haut-du-depart"><a[^>]*>[\s\S]*?<\/a><button type="button" class="exp-regles" aria-haspopup="dialog" aria-label="Les règles">/)
  assert.equal(/<ol class="exp-trois-gardiens">([\s\S]*?)<\/ol>/.exec(html)?.[1].match(/<li class="exp-gardien-col">/g)?.length, 3)
  assert.match(html, /<button type="button" class="link-inline small exp-voir-le-paquet" aria-haspopup="dialog">Ton paquet · 12 cartes/)
})
