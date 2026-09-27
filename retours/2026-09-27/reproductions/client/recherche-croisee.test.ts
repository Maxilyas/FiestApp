// « Mes quiz » : deux recherches qui se croisent. La réponse de « fr »,
// arrivée après celle de « france », remplace la liste : sous « france »,
// la bibliothèque montre les quiz de « fr ».
//
// L'effet de recherche (EditorApp.tsx, `api.chercher(mots).then(setTrouves)`)
// retarde la requête de 250 ms, mais n'écarte pas une réponse périmée : il
// n'y a ni drapeau d'annulation ni comparaison avec la saisie du moment. Le
// même motif est dans la recherche des profils du quiz du jour
// (AdminDuJour.tsx). La réponse de « fr » est retardée par le navigateur
// (`page.route`) pour rendre l'ordre sûr — sur un réseau réel, c'est une
// recherche courte (plus de résultats, plus lente) suivie d'une longue.
import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { connexionAnimateur, creerQuiz, qcm, type Banc } from '../../../server/test/banc'
import { PORTABLE, bancAvecClient, contexte, navigateur } from './outils'

describe('la recherche de « Mes quiz »', () => {
  let banc: Banc
  let browser: any
  let cookie: string
  before(async () => {
    banc = await bancAvecClient()
    cookie = await connexionAnimateur(banc.url)
    await creerQuiz(banc.url, cookie, [qcm('Capitale de la France ?', ['Paris', 'Lyon'])], 'La France et ses régions')
    await creerQuiz(banc.url, cookie, [qcm('Le roquefort vient de ?', ['Aveyron', 'Jura'])], 'Fromages')
    await creerQuiz(banc.url, cookie, [qcm('Qui chante ?', ['Elle', 'Lui'])], 'Musique')
    browser = await navigateur()
  })
  after(async () => {
    await browser?.close()
    await banc?.close()
  })

  it('montre les résultats de ce qui est tapé, pas d’une saisie d’avant', async () => {
    const ctx = await contexte(browser, PORTABLE, false)
    const [nom, valeur] = cookie.split('=')
    await ctx.addCookies([{ name: nom, value: valeur, url: banc.url }])
    const page = await ctx.newPage()
    await page.route(
      (u: URL) => u.pathname === '/api/quizzes' && u.searchParams.get('q') === 'fr',
      async (route: any) => {
        await new Promise(r => setTimeout(r, 1500))
        await route.continue()
      },
    )
    await page.goto(`${banc.url}/edit`)
    const champ = page.getByRole('searchbox', { name: /Chercher dans mes quiz/ })
    await champ.waitFor({ timeout: 10000 })
    await champ.fill('fr')
    await page.waitForTimeout(400) // la requête de « fr » est partie
    await champ.fill('france')
    await page.waitForTimeout(700) // celle de « france » est revenue
    const titresDe = () => page.locator('ul.quiz-list .quiz-ligne-titre').allTextContents()
    const avant = await titresDe()
    await page.waitForTimeout(1500) // celle de « fr » revient à son tour
    const apres = await titresDe()
    const saisie = await champ.inputValue()
    console.log(`saisie « ${saisie} » · d'abord : ${avant.join(' | ')} · puis : ${apres.join(' | ')}`)
    assert.ok(avant.includes('La France et ses régions') && !avant.includes('Fromages'), 'la recherche « france » a répondu')
    assert.deepEqual(apres, avant, `sous « ${saisie} », la liste est devenue celle de « fr »`)
    await ctx.close()
  })
})
