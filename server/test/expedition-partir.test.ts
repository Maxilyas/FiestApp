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

/** La page, chargée par son adresse : le typage du serveur ne lit pas le JSX du client. */
async function laPage(): Promise<{ ecranDeLaPage: (page: PageDeLExpedition, enPartant?: boolean) => { e: string; vue?: VueDeLExpedition; page?: PageDeLExpedition } }> {
  return import(new URL('../../client/src/views/ExpeditionApp.tsx', import.meta.url).href)
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
