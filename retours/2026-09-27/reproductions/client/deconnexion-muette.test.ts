// « Me déconnecter », à la page du profil : si la requête échoue (le wifi de
// la salle, l'hébergeur qui se réveille), la page montre quand même le
// formulaire de connexion — et le cookie du profil reste, un an. Le
// téléphone prêté « déconnecté » rouvre le profil de son propriétaire au
// rechargement suivant.
//
// ProfilApp.tsx : `await api.joueur.deconnexion().catch(() => {}); setProfil(null)`.
import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { inscrireProfil, type Banc } from '../../../server/test/banc'
import { TELEPHONE, bancAvecClient, contexte, navigateur } from './outils'

describe('se déconnecter de son profil', () => {
  let banc: Banc
  let browser: any
  let cookie: string
  before(async () => {
    banc = await bancAvecClient()
    cookie = await inscrireProfil(banc.url, 'camille', 'Camille', '🦊')
    browser = await navigateur()
  })
  after(async () => {
    await browser?.close()
    await banc?.close()
  })

  it('ne dit pas « déconnecté » quand la déconnexion n’a pas eu lieu', async () => {
    const ctx = await contexte(browser, TELEPHONE, true)
    const [nom, valeur] = cookie.split('=')
    await ctx.addCookies([{ name: nom, value: valeur, url: banc.url }])
    const page = await ctx.newPage()
    await page.goto(`${banc.url}/profil`)
    const bouton = page.getByRole('button', { name: 'Me déconnecter' })
    await bouton.waitFor({ timeout: 10000 })
    // Le réseau de la salle lâche au moment du geste.
    await page.route('**/api/joueur/deconnexion', (route: any) => route.abort('internetdisconnected'))
    await bouton.click()
    await page.getByRole('button', { name: /Me connecter/ }).first().waitFor({ timeout: 10000 })
    const message = await page.locator('.error').allTextContents()
    await page.unroute('**/api/joueur/deconnexion')
    await page.reload()
    await page.waitForTimeout(1500)
    const toujours = await page.getByRole('button', { name: 'Me déconnecter' }).count()
    console.log(`après l’échec : formulaire de connexion affiché, message : ${JSON.stringify(message)} · au rechargement, profil toujours ouvert : ${toujours > 0}`)
    assert.ok(message.length > 0 || toujours === 0, 'la page a montré « déconnecté » sans un mot, et le profil est toujours ouvert')
    await ctx.close()
  })
})
