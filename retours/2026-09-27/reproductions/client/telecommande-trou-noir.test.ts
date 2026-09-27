// « Révéler » touché à la télécommande dans une liaison morte : rien ne
// part, rien ne le dit, rien ne vérifie la liaison.
//
// Les gestes de l'animateur partent par `socket.emit('host:command', …)`,
// sans accusé : tant que socket.io croit la liaison vivante — le téléphone
// passé du wifi à la 4G, jusqu'à 18 s —, chaque clic part dans le vide, et
// la salle attend devant une question que personne ne révèle. Aucun délai ne
// déclenche `verifierLiaison()` : seul le battement de cœur finit par le voir,
// et le clic d'avant est perdu (il faut retoucher).
//
// Le test attend que la révélation, touchée une fois, ait lieu dans les 10 s.
import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { connexionAnimateur, creerQuiz, ecranCommun, invite, qcm, type Banc, type Socket } from '../../../server/test/banc'
import { TELEPHONE, bancAvecClient, contexte, navigateur, ouvrirEcranCommun } from './outils'
import { relais } from './trou-noir'

describe('la télécommande dans une liaison morte', () => {
  let banc: Banc
  let browser: any
  let r: Awaited<ReturnType<typeof relais>>
  let tele: Socket
  before(async () => {
    banc = await bancAvecClient()
    const cookie = await connexionAnimateur(banc.url)
    await creerQuiz(banc.url, cookie, [qcm('Capitale de la France ?', ['Paris', 'Lyon', 'Nice', 'Brest'], 0, 60)])
    // La télé, sur un réseau qui marche : elle dit quand la révélation a lieu.
    tele = await ecranCommun(banc.url, cookie)
    await invite(banc.url, 'Zoé')
    r = await relais(banc.server.port)
    browser = await navigateur()
  })
  after(async () => {
    await browser?.close()
    await r?.fermer()
    await banc?.close()
  })

  it('révèle la question touchée une seule fois', async () => {
    let phase = ''
    tele.on('session:view', (p: any) => {
      if (p?.view?.phase) phase = p.view.phase
    })
    const ctx = await contexte(browser, TELEPHONE, true)
    const page = await ctx.newPage()
    await ouvrirEcranCommun(page, `http://127.0.0.1:${r.port}`)
    await page.getByRole('button', { name: 'Lancer un quiz' }).click()
    await page.getByRole('button', { name: "C'est parti !" }).first().click()
    await page.getByRole('button', { name: 'Révéler' }).waitFor({ timeout: 15000 })
    // La garde d'une demi-seconde après un changement de phase.
    await page.waitForTimeout(800)
    assert.equal(phase, 'question')

    r.trouNoir()
    const t0 = Date.now()
    await page.getByRole('button', { name: 'Révéler' }).click()
    const journal: string[] = []
    let revelee: number | null = null
    let dernier = ''
    while (Date.now() - t0 < 20000) {
      const etat = await page.evaluate(() => (document.querySelector('.offline-pill') ? '[reconnexion…]' : '—'))
      const ligne = `${((Date.now() - t0) / 1000).toFixed(1)} s · serveur : ${phase} · télécommande : ${etat}`
      if (etat !== dernier) journal.push(ligne)
      dernier = etat
      if (phase === 'reveal' && revelee === null) {
        revelee = Date.now() - t0
        journal.push(ligne)
      }
      await page.waitForTimeout(250)
    }
    console.log(journal.join('\n'))
    assert.ok(
      revelee !== null && revelee < 10000,
      revelee === null ? 'la question n’a jamais été révélée : le clic s’est perdu (20 s)' : `révélée au bout de ${(revelee / 1000).toFixed(1)} s`,
    )
    await ctx.close()
  })
})
