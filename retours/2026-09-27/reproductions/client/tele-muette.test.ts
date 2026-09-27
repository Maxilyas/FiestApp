// La télé pilotée depuis la télécommande reste muette toute la soirée.
//
// `sound.ts` ne crée son contexte audio que dans `initAudio()`, et seuls trois
// clics SUR CETTE PAGE l'appellent : « Lancer un quiz », un changement de
// scène, le bouton des sons. Or quand l'animateur pilote au téléphone
// (télécommande), c'est la télé qui doit sonner — « la fanfare sonne sur
// l'écran qui montre la scène, pas sur la télécommande » (HostApp.tsx) — et
// personne ne clique jamais sur la télé : pas de contexte, `tone()` rend la
// main sans un son. La télé s'est pourtant bien connectée d'un clic (le
// formulaire) : le navigateur aurait laissé jouer.
//
// La reproduction compte les `AudioContext` créés et les oscillateurs joués
// par la page de la télé pendant un quiz lancé depuis la télécommande.
import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { connexionAnimateur, creerQuiz, invite, qcm, type Banc } from '../../../server/test/banc'
import { PORTABLE, TELEPHONE, attendreQue, bancAvecClient, contexte, navigateur, ouvrirEcranCommun } from './outils'

const ESPION_AUDIO = () => {
  const w = window as any
  w.__audio = { contextes: 0, oscillateurs: 0, etats: [] as string[] }
  const Orig = w.AudioContext
  if (!Orig) return
  w.AudioContext = class extends Orig {
    constructor(...a: any[]) {
      super(...a)
      w.__audio.contextes++
      w.__audio.etats.push(this.state)
    }
    createOscillator() {
      w.__audio.oscillateurs++
      return super.createOscillator()
    }
  }
}

describe('la télé pilotée par la télécommande', () => {
  let banc: Banc
  let browser: any
  before(async () => {
    banc = await bancAvecClient()
    const cookie = await connexionAnimateur(banc.url)
    await creerQuiz(banc.url, cookie, [qcm('Capitale de la France ?', ['Paris', 'Lyon']), qcm('2 + 2 ?', ['4', '5'])])
    browser = await navigateur()
  })
  after(async () => {
    await browser?.close()
    await banc?.close()
  })

  it('sonne quand la question paraît — la télé a eu son clic (la connexion)', async () => {
    const tele = await contexte(browser, PORTABLE, false)
    await tele.addInitScript(ESPION_AUDIO)
    const pageTele = await tele.newPage()
    await ouvrirEcranCommun(pageTele, banc.url)

    const main = await contexte(browser, TELEPHONE, true)
    const pageMain = await main.newPage()
    await ouvrirEcranCommun(pageMain, banc.url)
    // Un écran étroit est une télécommande par défaut.
    assert.equal(await pageMain.locator('.host.telecommande').count(), 1, 'le téléphone est une télécommande')

    await invite(banc.url, 'Zoé', '🦊')
    await pageMain.getByRole('button', { name: 'Lancer un quiz' }).click()
    await pageMain.getByRole('button', { name: "C'est parti !" }).first().click()
    // La question à la télé : c'est là que `sound.go()` doit sonner.
    await pageTele.locator('.quiz-host .quiz-question').waitFor({ timeout: 15000 })
    await pageTele.waitForTimeout(500)
    const audio = await pageTele.evaluate(() => (window as any).__audio)
    console.log('télé, question posée :', JSON.stringify(audio))

    // Le témoin : un clic sur la télé (le bouton des sons, deux fois), puis
    // la révélation depuis la télécommande — là, la télé sonne. L'espion
    // compte donc bien ce qu'il faut.
    await pageTele.getByRole('button', { name: 'Sons' }).click()
    await pageTele.getByRole('button', { name: 'Sons' }).click()
    await pageMain.getByRole('button', { name: 'Révéler' }).click()
    await attendreQue(async () => (await pageTele.locator('.quiz-host .ans-btn.correct').count()) > 0, 10000)
    await pageTele.waitForTimeout(300)
    const temoin = await pageTele.evaluate(() => (window as any).__audio)
    console.log('télé, après un clic sur elle et la révélation :', JSON.stringify(temoin))
    assert.ok(temoin.oscillateurs > 0, 'témoin : un clic sur la télé, et la révélation sonne')

    assert.ok(
      audio.oscillateurs > 0,
      `la télé est restée muette au départ de la question : ${audio.contextes} contexte audio, ${audio.oscillateurs} son joué`,
    )
    await tele.close()
    await main.close()
  })
})
