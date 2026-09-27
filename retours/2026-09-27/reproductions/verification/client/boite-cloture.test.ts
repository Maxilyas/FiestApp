// Contre-expertise de client-13 : « La boîte « Clore la soirée » attend
// soirees.json sans délai ». On gèle la liaison de la console (relais en trou
// noir, comme reponse-trou-noir.test.ts), on touche « Clore la soirée », et
// on mesure quand la boîte paraît — avant, pendant et après la reconnexion
// de socket.io.
//
//   cd server && CLIENT_DIST=../verification/client/dist nice -n 10 node --import tsx \
//     --test --test-timeout=120000 ../export/evaluations/verification/client/boite-cloture.test.ts
import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { connexionAnimateur, creerQuiz, invite, qcm, type Banc } from '../../../../server/test/banc'
import { PORTABLE, bancAvecClient, contexte, navigateur, ouvrirEcranCommun } from '../../client/outils'
import { relais } from '../../client/trou-noir'

describe('la boîte « Clore la soirée » dans une liaison morte', () => {
  let banc: Banc
  let browser: any
  let r: Awaited<ReturnType<typeof relais>>
  before(async () => {
    banc = await bancAvecClient()
    const cookie = await connexionAnimateur(banc.url)
    await creerQuiz(banc.url, cookie, [qcm('Capitale de la France ?', ['Paris', 'Lyon'])])
    await invite(banc.url, 'Zoé')
    r = await relais(banc.server.port)
    browser = await navigateur()
  })
  after(async () => {
    await browser?.close()
    await r?.fermer()
    await banc?.close()
  })

  it('s’ouvre dans les 5 s', async () => {
    const ctx = await contexte(browser, PORTABLE, false)
    const page = await ctx.newPage()
    await ouvrirEcranCommun(page, `http://127.0.0.1:${r.port}`)
    await page.getByRole('button', { name: 'Clore la soirée' }).waitFor({ timeout: 10000 })
    await page.waitForTimeout(500)
    r.trouNoir()
    const t0 = Date.now()
    await page.getByRole('button', { name: 'Clore la soirée' }).click()
    const journal: string[] = []
    let ouverte: number | null = null
    let dernier = ''
    while (Date.now() - t0 < 30000) {
      const etat = await page.evaluate(() =>
        [document.querySelector('.dialog') ? '[boîte ouverte]' : '', document.querySelector('.offline-pill') ? '[reconnexion…]' : '']
          .filter(Boolean)
          .join(' '),
      )
      if (etat !== dernier) journal.push(`${((Date.now() - t0) / 1000).toFixed(1)} s · ${etat || '—'}`)
      dernier = etat
      if (etat.includes('boîte') && ouverte === null) ouverte = Date.now() - t0
      await page.waitForTimeout(250)
    }
    // La liaison de socket.io est revenue : l'animateur retouche.
    let seconde: number | null = null
    if (ouverte === null) {
      const t1 = Date.now()
      await page.getByRole('button', { name: 'Clore la soirée' }).click()
      while (Date.now() - t1 < 15000) {
        if ((await page.locator('.dialog').count()) > 0) {
          seconde = Date.now() - t1
          break
        }
        await page.waitForTimeout(250)
      }
      journal.push(`second toucher, liaison revenue : ${seconde === null ? 'pas de boîte en 15 s' : `boîte à ${(seconde / 1000).toFixed(1)} s`}`)
    }
    console.log(journal.join('\n'))
    assert.ok(ouverte !== null && ouverte < 5000, ouverte === null ? 'la boîte ne s’est pas ouverte en 30 s' : `ouverte à ${(ouverte / 1000).toFixed(1)} s`)
    await ctx.close()
  })
})
