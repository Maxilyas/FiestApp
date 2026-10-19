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

test('la feuille de l’équipe dit « Ton équipe » d’un bout à l’autre : « équipée » se lisait comme une faute', async () => {
  // La revue du 18 octobre 2026 : « Corriger orthographe : Ton équipée : ton équipe. » La feuille l'avait gardé, refus et bouton compris.
  const { FeuilleDeLEquipee } = (await laPage()) as unknown as { FeuilleDeLEquipee: Composant }
  const { renderToStaticMarkup } = await import('react-dom/server')
  for (const [equipee, rencontres] of [
    [['lg:dragon'], true],
    [[], false],
  ] as const) {
    const html = renderToStaticMarkup(
      React.createElement(FeuilleDeLEquipee, { prochaine: { ...prochaine, equipables: ['lg:dragon'] }, equipee, rencontres, onChoisir: rien, onFermer: rien }),
    )
    assert.match(html, /aria-label="Ton équipe"/)
    assert.doesNotMatch(html, /équipée/)
  }
})

test('au codex, le départ dit son niveau et sa jauge, ce qu’il a sur ce qu’il y a ; plus d’équipe à choisir — l’invité du jour, même avec des légendaires à lui ; sa catégorie fétiche attend son niveau', async () => {
  const { codexDuNiveau, NIVEAUX } = await import('../../shared/codex')
  const { CARTES_DES_RENCONTRES } = await import('../../shared/rencontres')
  const deux = codexDuNiveau(2, ['lg:dragon'])
  const html = await depart({ expedition: null, prochaine: { ...prochaine, rencontres: true, equipables: ['lg:dragon'], codex: { renommee: NIVEAUX[1] + 10, ...deux, ascension: 0 } }, passeport: [] })
  const lu = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
  assert.doesNotMatch(html, /exp-equipee|exp-changer[^>]*>Changer/, 'ses légendaires ouvrent leur carte au codex : plus d’équipe à choisir')
  assert.match(lu, /Le Lion Couronné, l’invité du jour, part avec toi\s*: sa carte rejoint ton paquet\./)
  assert.match(lu, new RegExp(`Niveau 2 d’explorateur : ${NIVEAUX[1] + 10} de renommée, ${NIVEAUX[2]} pour le niveau 3\\.`))
  assert.match(lu, new RegExp(`${deux.cartes.length} cartes sur ${CARTES_DES_RENCONTRES.length}`))
  assert.match(html, /exp-voir-le-paquet" aria-haspopup="dialog">Ton paquet · 11 cartes/, 'le paquet de départ et la carte de l’invité')
  assert.doesNotMatch(lu, /Ta catégorie fétiche/, 'au niveau 2, rien à choisir')
  const cinq = await depart({ expedition: null, prochaine: { ...prochaine, rencontres: true, codex: { renommee: NIVEAUX[4], ...codexDuNiveau(5, []), ascension: 0 } }, passeport: [] })
  assert.match(cinq.replace(/<[^>]+>/g, ' '), /Ta catégorie fétiche/, 'au niveau 5, elle se choisit')
})

test('l’Ascension au départ : rien avant une expédition menée au bout ; ensuite ses crans ouverts, aucun d’office ; en route, le bas du départ dit son cran', async () => {
  const { codexDuNiveau, NIVEAUX } = await import('../../shared/codex')
  const avec = (ascension: number): PageDeLExpedition => ({ expedition: null, prochaine: { ...prochaine, rencontres: true, codex: { renommee: NIVEAUX[2], ...codexDuNiveau(3, []), ascension } }, passeport: [] })
  assert.doesNotMatch(await depart(avec(0)), /exp-ascension/, 'sans victoire, rien à choisir')
  const html = await depart(avec(2))
  assert.match(html, /<h2 class="label" id="exp-ascension-titre">L’Ascension<\/h2>/)
  const crans = html.match(/<div class="exp-crans-d-ascension"[\s\S]*?<\/div>/)?.[0] ?? ''
  assert.deepEqual(
    [...crans.matchAll(/<button[^>]*aria-pressed="(true|false)"[^>]*>(.*?)<\/button>/g)].map(m => [m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), m[1]]),
    [
      ['Sans cran', 'true'],
      ['Cran 1', 'false'],
      ['Cran 2', 'false'],
    ],
    'rien de retenu : aucun cran — l’Ascension se choisit',
  )
  // En route, à son cran : la ligne sous « Reprendre ».
  const cartes = { v: 7, paquet: [], route: [], refus: {}, parQuestion: [3, 4, 5], ascension: 2 }
  const vue = { ...enRoute, gardiens: prochaine.gardiens.map(cle => ({ cle, vaincu: false })), vies: 3, justes: 2, courage: 41, equipee: [], invite: 'lg:lion', cartes } as unknown as VueDeLExpedition
  assert.match(await depart({ expedition: vue, prochaine, passeport: [] }), /Acte 1 · Ascension 2 · 41 de courage sur 50/)
})

test('aux rencontres, le départ ouvre le codex : toutes les cartes de l’expédition', async () => {
  const html = await depart({ expedition: null, prochaine: { ...prochaine, rencontres: true }, passeport: [] })
  assert.match(html, /<h2 class="label" id="exp-codex-titre">Ton codex<\/h2><button type="button" class="link-inline small exp-ouvrir" aria-haspopup="dialog">Ouvrir/)
  // Aux règles d'avant — la production —, des jokers : pas de codex.
  const avant = await depart({ expedition: null, prochaine, passeport: [] })
  assert.doesNotMatch(avant, /exp-codex/)
})
