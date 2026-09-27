// Un double clic sur « Attribuer » remet le prix deux fois.
//
// Le bouton d'un prix calculé (AwardsBoard.tsx) émet `host:awardTeam` à
// chaque clic, et rien ne le rend inerte avant que l'instantané ne revienne
// (120 ms de regroupement au moins) : le second clic part aussi, et le
// serveur ajoute une seconde ligne — deux points d'équipe au lieu d'un, de
// quoi retourner la victoire. Le prix libre, lui, en est protégé par hasard :
// son motif se vide au clic, et le bouton se grise.
import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  attendre,
  connexionAnimateur,
  creerQuiz,
  ecranCommun,
  emitAck,
  instantane,
  invite,
  qcm,
  type Banc,
  type Socket,
} from '../../../server/test/banc'
import { PORTABLE, bancAvecClient, contexte, navigateur, ouvrirEcranCommun } from './outils'

describe('la remise d’un prix', () => {
  let banc: Banc
  let browser: any
  let host: Socket
  before(async () => {
    banc = await bancAvecClient()
    const cookie = await connexionAnimateur(banc.url)
    const packId = await creerQuiz(banc.url, cookie, [qcm('Un ?', ['Oui', 'Non'], 0, 10), qcm('Deux ?', ['Oui', 'Non'], 0, 10), qcm('Trois ?', ['Oui', 'Non'], 0, 10)])
    host = await ecranCommun(banc.url, cookie)
    ;(host as any).emit('host:seedTeams', { count: 2 })
    const snap = await instantane<any>(host, s => s.teams.length === 2, 'deux équipes')
    const joueurs = [await invite(banc.url, 'Alice', '🦊'), await invite(banc.url, 'Bob', '🐻')]
    for (const [i, j] of joueurs.entries()) {
      assert.equal((await emitAck<any>(j.socket, 'player:setTeam', { teamId: snap.teams[i].id })).ok, true)
    }
    // Un quiz de trois questions, tout juste pour les deux : de quoi faire naître des prix.
    const pick = attendre<any>(host, 'session:view', p => p.view.phase === 'pickPack', 'la liste des quiz')
    ;(host as any).emit('host:launch')
    const sessionId = (await pick).sessionId
    ;(host as any).emit('host:command', { sessionId, command: { type: 'selectPack', packId } })
    for (let q = 0; q < 3; q++) {
      const question = (await attendre<any>(host, 'session:view', p => p.view.phase === 'question' && p.view.qIndex === q, `la question ${q + 1}`, 15000)).view
      const revelee = attendre<any>(host, 'session:view', p => p.view.phase === 'reveal' && p.view.qIndex === q, 'la révélation', 15000)
      for (const j of joueurs) {
        await emitAck(j.socket, 'player:action', { sessionId, action: { type: 'answer', choice: 0, qIndex: q, round: question.round }, slug: 'banc', token: j.token })
      }
      const v = (await revelee).view
      ;(host as any).emit('host:command', { sessionId, command: { type: 'next', phase: v.phase, qIndex: v.qIndex, round: v.round } })
    }
    await attendre<any>(host, 'session:view', p => p.view.phase === 'finished', 'le podium du quiz', 15000)
    ;(host as any).emit('host:endSession', { sessionId })
    await instantane<any>(host, s => !s.session, 'la salle d’attente')
    browser = await navigateur()
  })
  after(async () => {
    await browser?.close()
    await banc?.close()
  })

  it('ne se remet qu’une fois pour un double clic', async () => {
    const ctx = await contexte(browser, PORTABLE, false)
    const page = await ctx.newPage()
    await ouvrirEcranCommun(page, banc.url)
    await page.getByRole('button', { name: 'Prix', exact: true }).click()
    const bouton = page.locator('.awards .award-give button').first()
    await bouton.waitFor({ timeout: 10000 })
    const titre = await page.locator('.awards .award h3').first().textContent()
    await bouton.dblclick()
    await page.waitForTimeout(1500)
    const snap = await instantane<any>(host)
    console.log(`prix « ${titre} » : ${snap.bonuses.length} remise(s) — ${snap.bonuses.map((b: any) => `${b.points > 0 ? '+' : ''}${b.points} ${b.reason}`).join(', ')}`)
    assert.equal(snap.bonuses.length, 1, `un double clic a remis le prix ${snap.bonuses.length} fois`)
    await ctx.close()
  })
  it('témoin : le prix libre, lui, ne part qu’une fois', async () => {
    const avant = (await instantane<any>(host)).bonuses.length
    const ctx = await contexte(browser, PORTABLE, false)
    const page = await ctx.newPage()
    await ouvrirEcranCommun(page, banc.url)
    // L'écran des prix est déjà la scène de la soirée (épreuve précédente).
    const choix = page.getByRole('combobox', { name: 'Équipe qui reçoit le prix' })
    await choix.waitFor({ timeout: 10000 })
    await choix.selectOption({ index: 1 })
    await page.getByRole('textbox', { name: 'Motif du prix' }).fill('Le plus beau déguisement')
    await page.locator('.free-award button.btn-primary').dblclick()
    await page.waitForTimeout(1500)
    const snap = await instantane<any>(host)
    const libres = snap.bonuses.filter((b: any) => b.reason === 'Le plus beau déguisement').length
    console.log(`prix libre : ${libres} remise(s) (${snap.bonuses.length - avant} de plus)`)
    assert.equal(libres, 1)
    await ctx.close()
  })
})
