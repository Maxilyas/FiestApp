// Une réponse tapée dans une liaison morte : le renvoi part dans la même
// liaison morte, et rien ne vérifie la liaison.
//
// `sendPlayerAction` (client/src/socket.ts) renvoie une fois la réponse dont
// l'accusé n'est pas venu en 4 s — « tant que sa question est ouverte, on la
// renvoie une fois ». Mais le renvoi part aussitôt, par la même liaison, que
// socket.io croit encore vivante : il se perd comme le premier envoi. Et à la
// différence de `demander()`, le délai dépassé n'appelle pas
// `verifierLiaison()` : le téléphone garde sa liaison morte jusqu'au
// battement de cœur manqué (jusqu'à 18 s), et chaque réponse retouchée
// d'ici là se perd encore.
//
// Le relais (`trou-noir.ts`) gèle les connexions ouvertes sans les fermer —
// le passage du wifi à la 4G, un tunnel. Le test attend que la réponse,
// touchée une seule fois, arrive au serveur dans les 12 s.
import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { connexionAnimateur, creerQuiz, ecranCommun, lancerQuiz, qcm, type Banc, type Socket } from '../../../server/test/banc'
import { TELEPHONE, bancAvecClient, contexte, navigateur } from './outils'
import { relais } from './trou-noir'

describe('une réponse touchée dans une liaison morte', () => {
  let banc: Banc
  let browser: any
  let r: Awaited<ReturnType<typeof relais>>
  let host: Socket
  let packId: string
  before(async () => {
    banc = await bancAvecClient()
    const cookie = await connexionAnimateur(banc.url)
    packId = await creerQuiz(banc.url, cookie, [qcm('Capitale de la France ?', ['Paris', 'Lyon', 'Nice', 'Brest'], 0, 60)])
    host = await ecranCommun(banc.url, cookie)
    r = await relais(banc.server.port)
    browser = await navigateur()
  })
  after(async () => {
    await browser?.close()
    await r?.fermer()
    await banc?.close()
  })

  it('arrive au serveur sans qu’on la retouche', async () => {
    const ctx = await contexte(browser, TELEPHONE, true)
    const page = await ctx.newPage()
    await page.goto(`http://127.0.0.1:${r.port}/banc`)
    await page.getByRole('button', { name: 'Jouer sans compte' }).click()
    await page.locator('#join-name').fill('Zoé')
    await page.getByRole('button', { name: 'Rejoindre la soirée' }).click()
    await page.locator('.me-header').waitFor({ timeout: 10000 })

    // Le compte des réponses, vu de l'écran commun.
    let repondu = 0
    host.on('session:view', (p: any) => {
      if (typeof p?.view?.answeredCount === 'number') repondu = p.view.answeredCount
    })
    await lancerQuiz(host, packId)
    await page.locator('.quiz-player .ans-btn:not([disabled])').first().waitFor({ timeout: 15000 })

    const gelees = r.trouNoir()
    const t0 = Date.now()
    await page.locator('.quiz-player .ans-btn').first().click()

    const journal: string[] = []
    let arrivee: number | null = null
    let dernier = ''
    while (Date.now() - t0 < 20000) {
      const etat = await page.evaluate(() =>
        [
          document.querySelector('.envoi-en-cours')?.textContent,
          document.querySelector('.envoi-perdu')?.textContent,
          document.querySelector('.bandeau-coupure') ? '[bandeau : connexion perdue]' : '',
          document.querySelector('.ans-btn.chosen') ? '[réponse cochée par le serveur]' : '',
        ]
          .filter(Boolean)
          .join(' '),
      )
      const ligne = `${((Date.now() - t0) / 1000).toFixed(1)} s · serveur : ${repondu} réponse · téléphone : ${etat || '—'}`
      if (etat !== dernier) journal.push(ligne)
      dernier = etat
      if (repondu > 0 && arrivee === null) {
        arrivee = Date.now() - t0
        journal.push(ligne)
      }
      await page.waitForTimeout(250)
    }
    console.log(`${gelees} connexions gelées\n` + journal.join('\n'))
    assert.ok(
      arrivee !== null && arrivee < 12000,
      arrivee === null
        ? 'la réponse, touchée une fois, n’est jamais arrivée au serveur (20 s)'
        : `la réponse est arrivée au bout de ${(arrivee / 1000).toFixed(1)} s`,
    )
    await ctx.close()
  })
})
