// « Clore la soirée » touché pendant que la console se reconnecte : le geste
// se perd sans un mot.
//
// Hors connexion, socket.io garde `host:closeParty` en réserve et l'envoie
// au retour — AVANT que la page ne se représente (`host:hello` part dans le
// gestionnaire `connect`, après la réserve). Le serveur le reçoit donc d'une
// connexion qui n'est pas encore l'écran commun (`requireHost()` : faux) et
// l'ignore. L'animateur a vu sa boîte se fermer ; la soirée reste ouverte,
// aucun invité ne reçoit sa fin, et rien ne le dit à la console.
import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { connexionAnimateur, creerQuiz, invite, qcm, type Banc } from '../../../server/test/banc'
import { PORTABLE, attendreQue, bancAvecClient, contexte, navigateur, ouvrirEcranCommun } from './outils'
import { relais } from './trou-noir'

describe('la clôture touchée pendant une reconnexion', () => {
  let banc: Banc
  let browser: any
  let r: Awaited<ReturnType<typeof relais>>
  before(async () => {
    banc = await bancAvecClient()
    const cookie = await connexionAnimateur(banc.url)
    await creerQuiz(banc.url, cookie, [qcm('Capitale de la France ?', ['Paris', 'Lyon'])])
    r = await relais(banc.server.port)
    browser = await navigateur()
  })
  after(async () => {
    await browser?.close()
    await r?.fermer()
    await banc?.close()
  })

  it('clôt la soirée, ou dit qu’elle ne l’est pas', async () => {
    const zoe = await invite(banc.url, 'Zoé')
    let fin = false
    // Une soirée où rien n'a été joué se clôt par `party:reset` ; sinon, par `soiree:fin`.
    for (const ev of ['soiree:fin', 'party:reset']) {
      zoe.socket.on(ev, () => {
        fin = true
      })
    }
    const ctx = await contexte(browser, PORTABLE, false)
    const page = await ctx.newPage()
    await ouvrirEcranCommun(page, `http://127.0.0.1:${r.port}`)
    await page.getByRole('button', { name: 'Clore la soirée' }).waitFor({ timeout: 10000 })

    r.couper()
    await page.locator('.offline-pill').waitFor({ timeout: 10000 })
    await page.getByRole('button', { name: 'Clore la soirée' }).click()
    // La boîte : son titre, puis le geste.
    await page.locator('.dialog').waitFor({ timeout: 10000 })
    await page.locator('.dialog button[type="submit"]').click()
    const toastPendant = await page.locator('.toast').allTextContents()

    r.retablir()
    const revenue = await attendreQue(async () => (await page.locator('.offline-pill').count()) === 0, 20000)
    await attendreQue(() => fin, 4000)
    const cloture = await page.locator('.cloture').count()
    const toastApres = await page.locator('.toast').allTextContents()
    console.log(
      `console revenue : ${revenue} · fin de soirée reçue par Zoé : ${fin} · clôture à l’écran : ${cloture > 0} · messages : ${JSON.stringify([...toastPendant, ...toastApres])}`,
    )
    assert.ok(fin || toastPendant.length + toastApres.length > 0, 'la clôture s’est perdue en silence : soirée toujours ouverte, rien à l’écran')
    await ctx.close()
  })
  it('témoin : la même clôture, liaison tenue, arrive', async () => {
    const leo = await invite(banc.url, 'Léo')
    let fin = false
    for (const ev of ['soiree:fin', 'party:reset']) {
      leo.socket.on(ev, () => {
        fin = true
      })
    }
    const ctx = await contexte(browser, PORTABLE, false)
    const page = await ctx.newPage()
    await ouvrirEcranCommun(page, `http://127.0.0.1:${r.port}`)
    await page.getByRole('button', { name: 'Clore la soirée' }).click()
    await page.locator('.dialog').waitFor({ timeout: 10000 })
    await page.locator('.dialog button[type="submit"]').click()
    await attendreQue(() => fin, 8000)
    console.log(`témoin : fin de soirée reçue par Léo : ${fin}`)
    assert.ok(fin, 'la clôture, liaison tenue, envoie sa fin à chaque invité')
    await ctx.close()
  })
})
