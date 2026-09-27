// Deux états faux, petits, du téléphone d'un invité.
//
// 1. Un jeton d'une soirée passée (le téléphone éteint à la clôture, ou
//    exclu pendant son sommeil) : avant l'accusé qui le refuse, la page
//    montre la salle d'attente d'un invité sans prénom, « 0 pts », puis
//    l'entrée. `presente` passe à vrai dès `party:watch`, et `s.me` vient du
//    stockage : rien n'attend la re-présentation.
// 2. La carte d'un joueur, ouverte en salle d'attente quand le quiz part,
//    se rouvre toute seule à la fin du quiz : `carte` n'est jamais remise à
//    null quand l'écran change.
import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { connexionAnimateur, creerQuiz, ecranCommun, invite, lancerQuiz, qcm, type Banc, type Socket } from '../../../server/test/banc'
import { TELEPHONE, attendreQue, bancAvecClient, contexte, navigateur } from './outils'

describe('les petits états faux du téléphone', () => {
  let banc: Banc
  let browser: any
  let host: Socket
  let packId: string
  before(async () => {
    banc = await bancAvecClient()
    const cookie = await connexionAnimateur(banc.url)
    packId = await creerQuiz(banc.url, cookie, [qcm('Capitale de la France ?', ['Paris', 'Lyon'], 0, 20)])
    host = await ecranCommun(banc.url, cookie)
    browser = await navigateur()
  })
  after(async () => {
    await browser?.close()
    await banc?.close()
  })

  it('un jeton périmé ne fait pas voir une salle d’attente vide avant l’entrée', async () => {
    await invite(banc.url, 'Hugo', '🐻')
    const ctx = await contexte(browser, TELEPHONE, true)
    await ctx.addInitScript(() => {
      try {
        localStorage.setItem('quizz.me.banc', JSON.stringify({ playerId: 'fantome', token: 'jeton-d-une-autre-soiree' }))
        localStorage.setItem('quizz.profile.banc', JSON.stringify({ name: 'Zoé', avatar: '🦊' }))
      } catch {}
      // Ce que la page a montré, écran par écran, dès le premier rendu.
      const vus: string[] = []
      ;(window as any).__vus = vus
      new MutationObserver(() => {
        const ecran = document.querySelector('.me-header')
          ? `salle d'attente (« ${document.querySelector('.me-nom')?.textContent ?? ''} », ${document.querySelector('.me-header .muted')?.textContent ?? ''})`
          : document.querySelector('form.join.entree, .join.entree #join-name')
            ? 'entrée'
            : null
        if (ecran && vus[vus.length - 1] !== ecran) vus.push(ecran)
      }).observe(document, { childList: true, subtree: true })
    })
    const page = await ctx.newPage()
    await page.goto(`${banc.url}/banc`)
    await page.locator('#join-name').waitFor({ timeout: 10000 })
    const vus: string[] = await page.evaluate(() => (window as any).__vus)
    console.log('écrans vus :', vus.join(' → '))
    assert.ok(!vus.some(v => v.startsWith("salle d'attente")), `la page a montré : ${vus.join(' → ')}`)
    await ctx.close()
  })

  it('la carte fermée par le quiz ne se rouvre pas à la fin du quiz', async () => {
    const ctx = await contexte(browser, TELEPHONE, true)
    const page = await ctx.newPage()
    await page.goto(`${banc.url}/banc`)
    await page.getByRole('button', { name: 'Jouer sans compte' }).click()
    await page.locator('#join-name').fill('Léa')
    await page.getByRole('button', { name: 'Rejoindre la soirée' }).click()
    await page.locator('.me-header').waitFor({ timeout: 10000 })
    // Toucher un nom du classement : sa carte s'ouvre.
    await page.locator('.lb-ouvrable').first().click()
    await page.locator('.carte-joueur').waitFor({ timeout: 5000 })

    const sessionId = await lancerQuiz(host, packId)
    await page.locator('.quiz-player').waitFor({ timeout: 15000 })
    assert.equal(await page.locator('.carte-joueur').count(), 0, 'le quiz prend l’écran')
    ;(host as any).emit('host:endSession', { sessionId })
    await page.locator('.me-header').waitFor({ timeout: 10000 })
    await attendreQue(async () => (await page.locator('.carte-joueur').count()) > 0, 2000)
    const rouverte = await page.locator('.carte-joueur').count()
    console.log('carte à l’écran après le quiz :', rouverte)
    assert.equal(rouverte, 0, 'la carte ouverte avant le quiz s’est rouverte toute seule')
    await ctx.close()
  })
})
