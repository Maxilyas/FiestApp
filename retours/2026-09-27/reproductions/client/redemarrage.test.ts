// Le serveur redémarre en pleine question (un déploiement, un réveil) : le
// téléphone se reconnecte, se re-présente par son jeton (invariant 9), et la
// réponse touchée pendant la coupure part à la reconnexion, avec l'espace et
// le jeton qui rebranchent la connexion neuve sur son invité.
import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { connexionAnimateur, creerQuiz, ecranCommun, lancerQuiz, qcm, type Banc, type Socket } from '../../../server/test/banc'
import { TELEPHONE, attendreQue, bancAvecClient, contexte, navigateur } from './outils'

describe('le téléphone pendant un redémarrage du serveur', () => {
  let banc: Banc
  let browser: any
  let cookie: string
  let host: Socket
  let packId: string
  before(async () => {
    banc = await bancAvecClient()
    cookie = await connexionAnimateur(banc.url)
    packId = await creerQuiz(banc.url, cookie, [qcm('Capitale de la France ?', ['Paris', 'Lyon', 'Nice', 'Brest'], 0, 60)])
    host = await ecranCommun(banc.url, cookie)
    browser = await navigateur()
  })
  after(async () => {
    await browser?.close()
    await banc?.close()
  })

  it('reprend la question, et la réponse touchée pendant la coupure arrive', async () => {
    const ctx = await contexte(browser, TELEPHONE, true)
    const page = await ctx.newPage()
    await page.goto(`${banc.url}/banc`)
    await page.getByRole('button', { name: 'Jouer sans compte' }).click()
    await page.locator('#join-name').fill('Zoé')
    await page.getByRole('button', { name: 'Rejoindre la soirée' }).click()
    await page.locator('.me-header').waitFor({ timeout: 10000 })
    await lancerQuiz(host, packId)
    await page.locator('.quiz-player .ans-btn:not([disabled])').first().waitFor({ timeout: 15000 })

    const t0 = Date.now()
    const redemarrage = banc.redemarrer()
    // Pendant la coupure : le téléphone le sait (fermeture propre), la réponse attend dans la file.
    await attendreQue(async () => (await page.locator('.bandeau-coupure').count()) > 0, 5000, 20)
    await page.locator('.quiz-player .ans-btn').nth(1).click()
    const pendant = await page.locator('.envoi-en-cours').textContent().catch(() => null)
    await redemarrage
    // La télé, rebranchée sur le serveur neuf.
    host.close()
    host = await ecranCommun(banc.url, cookie)
    let repondu = 0
    host.on('session:view', (p: any) => {
      if (typeof p?.view?.answeredCount === 'number') repondu = p.view.answeredCount
    })
    const revenu = await attendreQue(async () => (await page.locator('.bandeau-coupure').count()) === 0, 15000)
    const tRetour = Date.now() - t0
    const arrivee = await attendreQue(async () => (await page.locator('.ans-btn.chosen').count()) > 0 || (await page.locator('.result-banner').count()) > 0, 15000)
    console.log(
      `pendant la coupure : « ${pendant} » · liaison revenue : ${revenu} (${(tRetour / 1000).toFixed(1)} s) · réponse vue par le serveur : ${arrivee} · compte à la télé : ${repondu}`,
    )
    assert.ok(revenu, 'la liaison revient')
    assert.ok(arrivee, 'la réponse touchée pendant la coupure est arrivée')
    await ctx.close()
  })
})
