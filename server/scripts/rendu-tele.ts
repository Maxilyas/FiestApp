// Brancher une télé, rejoué et photographié de bout en bout (la revue que
// le propriétaire a demandée le 12 octobre 2026 : « le scénario où on branche
// une télé »).
//
// Un serveur jetable. Une télé — Chromium en 1920 × 1080, sans souris ni
// clavier qu'on y toucherait — ouvre `/tele` et montre son code ; le
// téléphone du chef (360 × 640, son profil) prépare un salon, choisit « Sur
// une télé », tape le code et ouvre le salon ; des invités arrivent ; la
// barre du chef lance le quiz et révèle ; le téléphone du chef quitte la page
// puis revient ; la télé est rechargée, le serveur redémarre ; la barre mène
// le quiz jusqu'au podium, puis termine la soirée. Chaque moment est
// photographié à la télé (et en 1366 × 768 pour la salle d'attente et la
// question) et au téléphone du chef. Le client doit être construit :
//
//   npx tsx scripts/rendu-tele.ts ../export/rendu-tele
//
// Ce n'est pas un test : c'est l'œil qu'on pose sur le scénario avant et
// après une retouche (« Regarde le rendu », CLAUDE.md). Le journal, à la fin,
// dit ce que la télé montrait à chaque moment : `salle` pour l'écran de salle
// (rien à toucher), `console` pour la console de l'animateur.
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { demarrer, inscrireProfil, invite, patienter, type Invite } from '../test/banc'

const sortie = path.resolve(process.argv[2] ?? 'rendu-tele')
mkdirSync(sortie, { recursive: true })
const { chromium } = createRequire(path.join(spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim(), 'rendu.js'))('playwright')

const banc = await demarrer()
const navigateur = await chromium.launch({ headless: true })
const journal: string[] = []
const note = (ligne: string) => {
  journal.push(ligne)
  console.log(`· ${ligne}`)
}

try {
  // ── 1. La télé allumée sur /tele : son code ──────────────────────────────
  const contexteTele = await navigateur.newContext({ viewport: { width: 1920, height: 1080 } })
  const tele = await contexteTele.newPage()
  tele.on('pageerror', (e: Error) => note(`[télé] erreur : ${e.message}`))
  const photo = async (page: any, nom: string, pleine = false) => {
    await page.waitForTimeout(600)
    await page.screenshot({ path: path.join(sortie, `${nom}.png`), fullPage: pleine })
    console.log(path.join(sortie, `${nom}.png`))
  }
  /** Ce que la télé montre : l'écran de salle, ou la console — et ce qui s'y toucherait. */
  const etatDeLaTele = async (moment: string) => {
    const etat = await tele.evaluate(() => {
      const doc = (globalThis as any).document
      const visibles = [...doc.querySelectorAll('.host-console button, .host-console a')].filter((b: any) => b.offsetParent !== null)
      return {
        salle: !!doc.querySelector('.ecran-de-salle'),
        salleDAttente: !!doc.querySelector('.tv-salle'),
        gestes: visibles.map((b: any) => (b.getAttribute('aria-label') || b.textContent || '').trim()).filter(Boolean) as string[],
      }
    })
    note(`${moment} : la télé montre ${etat.salle ? 'la salle' : 'la console'}${etat.salleDAttente ? ' (salle d’attente)' : ''} — gestes visibles : ${etat.gestes.join(', ') || 'aucun'}`)
  }
  await tele.goto(`${banc.url}/tele`)
  await tele.waitForSelector('.tv-cases')
  const lireCode = async () => ((await tele.locator('.tv-cases').getAttribute('aria-label')) ?? '').replace(/^Le code : /, '').replace(/ /g, '')
  const code = await lireCode()
  note(`la télé montre le code ${code}`)
  await photo(tele, '01-tele-a-brancher')

  // ── 2. Le téléphone du chef : préparer un salon, « Sur une télé », le code ─
  const cookieDuChef = await inscrireProfil(banc.url, 'nadia', 'Nadia', '🦊')
  const contexteChef = await navigateur.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await contexteChef.addCookies([{ name: 'qz_joueur', value: cookieDuChef.split('=')[1], url: banc.url }])
  const chef = await contexteChef.newPage()
  chef.on('pageerror', (e: Error) => note(`[chef] erreur : ${e.message}`))
  await chef.goto(`${banc.url}/salon`)
  await chef.getByRole('button', { name: /Ajouter un quiz/ }).click()
  // Un modèle livré, jouable tel quel : il rejoint sa bibliothèque, puis ce salon.
  await chef.locator('.choix-ligne', { hasText: 'Culture' }).first().click()
  await chef.waitForSelector('.salon-quiz-ligne')
  await chef.getByRole('button', { name: 'Sur une télé' }).click()
  await chef.fill('#code-tele', code)
  await photo(chef, '02-chef-tape-le-code')
  await chef.getByRole('button', { name: 'Brancher' }).click()
  await chef.waitForSelector('.tele-branchee')
  await photo(chef, '03-chef-tele-branchee')

  // ── 3. La télé branchée, avant que le salon ne s'ouvre ───────────────────
  await tele.waitForFunction(() => !(globalThis as any).document.querySelector('.tv-branchement'), undefined, { timeout: 15000 })
  await photo(tele, '04-tele-branchee-salon-pas-ouvert')
  await etatDeLaTele('branchée, salon pas encore ouvert')

  // ── 4. « Ouvrir le salon » : le chef entre dans sa soirée ────────────────
  await chef.getByRole('button', { name: 'Ouvrir le salon' }).click()
  await chef.waitForSelector('.barre-chef', { timeout: 15000 })
  const adresseDuChef = chef.url()
  const slug = new URL(adresseDuChef).pathname.split('/')[1]
  note(`le salon s'ouvre sur l'espace ${slug}`)
  await photo(chef, '05-chef-dans-sa-salle')
  await photo(tele, '06-tele-salle-d-attente')
  await etatDeLaTele('salon ouvert, la barre du chef branchée')

  // ── 5. Des invités arrivent ──────────────────────────────────────────────
  const invites: Invite[] = []
  for (const [nom, avatar] of [
    ['Léo', '🐼'],
    ['Zoé', '🐸'],
    ['Marie-Charlotte', '🦄'],
    ['Kévin', '🐧'],
  ] as const) {
    invites.push(await invite(banc.url, nom, avatar, { slug }))
  }
  await patienter(800)
  await photo(tele, '07-tele-salle-avec-invites')
  await tele.setViewportSize({ width: 1366, height: 768 })
  await photo(tele, '07b-tele-salle-1366')
  await tele.setViewportSize({ width: 1920, height: 1080 })

  // ── 6. La barre du chef lance le quiz : une question, sa révélation ──────
  await chef.getByRole('button', { name: 'Lancer le quiz' }).click()
  await chef.getByRole('button', { name: /Révéler/ }).waitFor({ timeout: 20000 })
  await patienter(1500)
  await photo(tele, '08-tele-question')
  await etatDeLaTele('une question')
  await tele.setViewportSize({ width: 1366, height: 768 })
  await photo(tele, '08b-tele-question-1366')
  await tele.setViewportSize({ width: 1920, height: 1080 })
  await photo(chef, '09-chef-question')
  // L'enchaînement au clic : la révélation reste le temps des photos.
  await chef.getByRole('button', { name: 'Plus de gestes' }).click()
  await chef.getByRole('button', { name: 'Au clic' }).click()
  await chef.getByRole('button', { name: 'Fermer' }).click()
  await chef.getByRole('button', { name: /Révéler/ }).click()
  await chef.getByRole('button', { name: /Question suivante|Le podium/ }).waitFor({ timeout: 15000 })
  await photo(tele, '10-tele-revelation')
  await etatDeLaTele('la révélation')

  // ── 7. Le téléphone du chef quitte la page — verrouillé, dans la poche ───
  await chef.goto('about:blank')
  await patienter(2500)
  await photo(tele, '11-tele-chef-parti')
  await etatDeLaTele('le téléphone du chef parti')
  await chef.goto(adresseDuChef)
  await chef.waitForSelector('.barre-chef', { timeout: 15000 })
  await patienter(1500)
  await etatDeLaTele('le téléphone du chef revenu')

  // ── 8. La télé rechargée, puis le serveur qui redémarre ─────────────────
  await tele.reload()
  await patienter(2500)
  await photo(tele, '12-tele-rechargee')
  await etatDeLaTele('la télé rechargée')
  await banc.redemarrer()
  await patienter(6000)
  await photo(tele, '13-tele-apres-redemarrage')
  await photo(chef, '14-chef-apres-redemarrage')
  await etatDeLaTele('après le redémarrage')

  // ── 9. « Terminer le quiz » sur le dernier du programme : ce qu'il dit ───
  await chef.getByRole('button', { name: 'Plus de gestes' }).click()
  await chef.getByRole('button', { name: 'Terminer le quiz' }).click()
  await photo(chef, '15-chef-terminer-le-dernier-quiz')
  await chef.keyboard.press('Escape')
  await patienter(400)

  // ── 10. La barre mène le quiz jusqu'au podium ────────────────────────────
  for (let i = 0; i < 40; i++) {
    const podium = chef.getByRole('button', { name: 'Le podium' })
    if (await podium.count()) {
      await podium.click()
      break
    }
    const geste = chef.locator('.barre-chef-gestes .btn-primary')
    if (await geste.count()) await geste.first().click().catch(() => {})
    await patienter(700)
  }
  await chef.getByRole('button', { name: 'Terminer la soirée' }).first().waitFor({ timeout: 20000 })
  await patienter(1500)
  await photo(tele, '16-tele-podium')
  await photo(chef, '17-chef-podium')
  await etatDeLaTele('le podium')

  // ── 11. La soirée se termine ─────────────────────────────────────────────
  await chef.getByRole('button', { name: 'Terminer la soirée' }).first().click()
  await patienter(4000)
  await photo(tele, '18-tele-cloture')
  await photo(chef, '19-chef-fin-de-soiree')
  await etatDeLaTele('la clôture')

  for (const i of invites) i.socket.close()
} finally {
  await navigateur.close()
  await banc.close()
  console.log(journal.join('\n'))
}
