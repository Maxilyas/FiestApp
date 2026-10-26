// L'annonce d'une partie (`client/src/views/cabinet/Annonce.tsx`, lot page-2 du 26 octobre 2026) dit,
// sous la carte-bonus emportée, ce qui ôterait le cadre doré (`CE_QUI_OTE_LE_CADRE`) : pour Changer,
// « T'en servir ôte le cadre doré. ». Mais à la Frise, Changer ne sert pas (`JEUX.frise.changeable`,
// `refusDuPouvoir`), et la ligne juste au-dessus le dit (`ceQueFaitLaCarte` : « Changer ne sert pas à la
// Frise ») : l'annonce avertit d'un geste que la partie refusera. Échange, une œuvre de départ, est la
// carte-bonus de Changer de tout nouveau joueur.
//
// Lancer : cd server && nice -n 10 node --import tsx --test --test-timeout=120000 ../retours/2026-10-26/reproductions/page-annonce-changer-frise.test.ts
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { inscrireProfil } from '../../../server/test/banc'
import { bancDuCabinet, fermerLesMagasins, laPage, ok, type BancDuCabinet } from '../../../server/test/cabinet-banc'
import { JEU_DE_L_OEUVRE, OEUVRES, OEUVRES_DE_DEPART } from '../../../shared/cabinet/oeuvres'

Object.assign(globalThis, { React, window: { location: { pathname: '/cabinet', search: '', hash: '', origin: 'http://banc' }, addEventListener: () => {} } })

let b: BancDuCabinet | undefined
after(() => b?.banc.close())
after(fermerLesMagasins)

const texte = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, '’')
    .replace(/[  ⁠]/g, ' ')
    .replace(/\s+/g, ' ')

test('l’annonce d’une chasse à la Frise, Changer emporté : « ne sert pas » puis « t’en servir ôte le cadre doré »', async () => {
  b = await bancDuCabinet()
  const cookie = await inscrireProfil(b.banc.url, 'theo', 'Théo')
  const page = ok(await laPage(b, cookie), 'la page')
  const aLaFrise = OEUVRES.find(o => JEU_DE_L_OEUVRE[o.cle] === 'frise' && !OEUVRES_DE_DEPART.includes(o.cle))!
  assert.ok(aLaFrise, 'une œuvre à gagner à la Frise')
  const { Annonce } = await import(new URL('../../../client/src/views/cabinet/Annonce.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const rien = () => {}
  const html = renderToStaticMarkup(
    React.createElement(Annonce, { page, demande: { origine: 'chasse', oeuvre: aLaFrise.cle }, carte: 'echange', busy: false, onCarte: rien, onCommencer: rien, onRetour: rien }),
  )
  const t = texte(html)
  assert.match(t, /Changer ne sert pas à la Frise/, 'la carte-bonus dit qu’elle ne sert pas ici')
  assert.match(t, /cadre doré/, 'une œuvre à gagner : l’annonce parle du cadre doré')
  // Une carte qui ne sert pas ici ne peut rien ôter : l'avertissement contredit la ligne d'au-dessus.
  assert.doesNotMatch(t, /T’en servir ôte le cadre doré/, t)
})
