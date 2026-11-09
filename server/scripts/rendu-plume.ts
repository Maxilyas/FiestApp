// La plume, la question bonus et le signalement en plusieurs points,
// photographiés au téléphone (360 × 640) sur un serveur jetable : la page du
// jour avant de jouer — la question bonus annoncée, la bulle de la plume —,
// une partie du quiz du jour jouée jusqu'au bout — la feuille du signalement
// cochée puis corrigée —, puis la question bonus — l'écran qui la présente,
// elle dans son parchemin, sa révélation et le pouce —, la plume au pied du
// résultat, tracée puis encrée, et la feuille qu'elle ouvre ; puis le défi de
// la semaine — le signalement d'une question de campagne, qui sait sa marche,
// et la plume au pied de sa fin. Sous le thème qu'on veut (`THEME=ivoire`). Le
// client construit d'abord (`npm run build -w client`).
//
// Le circuit entier, par les vraies routes : Camille propose sa question — la
// danse en file, et son anecdote —, l'administrateur la relit au QG et
// l'accepte, l'anecdote déjà dans son champ ; elle passe au quiz du jour en
// question bonus, que Léa joue après ses dix, signée ; quatre autres la jouent
// par les routes, et le QG la suit sous « Question par question » ; puis
// Camille joue ses dix : sa question bonus ne se joue pas pour elle, sa carte
// lui dit ce que la salle en fait, La Plume tombe, et son accueil lui dit
// qu'elle est la question bonus du jour ; le lendemain, son bilan.
//
// La confiance (le 9 novembre 2026) : acceptée, Camille est de confiance — sa
// deuxième question, sa catégorie choisie, passe d'office ; le QG la voit close
// dans la file, la lit (« La lire »), ouvre « Retirer… » sans retirer. Elle
// devient la question bonus du lendemain, que le QG annule pour tous : son
// suivi, la page du jour de Léa et l'accueil de Camille le disent.
//
//   [THEME=ivoire] npx tsx scripts/rendu-plume.ts [dossier]
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { baseDEssai, connexionAnimateur, demarrer, ecrire, inscrireProfil } from '../test/banc'
import { ProfileStore } from '../src/auth/profiles'
import { CATEGORIES } from '../../shared/categories'

// L'Éclat est un tirage : sa carte n'a rien à faire sur ces photos.
ProfileStore.tirageEclat = () => false

const sortie = path.resolve(process.argv[2] ?? 'rendu-plume')
mkdirSync(sortie, { recursive: true })
const { chromium } = createRequire(path.join(spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim(), 'rendu.js'))('playwright')

/** Mardi 6 octobre 2026, 10 h à Paris — l'heure avance pour de vrai : le chrono de chaque question court. */
const horloge = { t: Date.UTC(2026, 9, 6, 8, 0) }
const depart = Date.now()
const banc = await demarrer({
  horlogeDuJour: () => horloge.t + (Date.now() - depart),
  baseDeLaCampagne: baseDEssai(12 * CATEGORIES.length, { categories: [...CATEGORIES] }),
})
const navigateur = await chromium.launch({ headless: true })
try {
  const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
  if (process.env.THEME) await ecrire(banc.url, '/api/joueur/moi', { theme: process.env.THEME }, lea, 'PUT')

  const contexte = await navigateur.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, hasTouch: true })
  const [nom, valeur] = lea.split('=')
  await contexte.addCookies([{ name: nom, value: valeur, url: banc.url }])
  const page = await contexte.newPage()
  page.on('pageerror', (e: Error) => console.error('[page]', e.message))
  page.on('console', (m: any) => m.type() === 'error' && console.error('[console]', m.text()))
  const photo = async (n: string, { pleine = false, attente = 700 } = {}) => {
    await page.waitForTimeout(attente)
    await page.screenshot({ path: path.join(sortie, `${n}.png`), fullPage: pleine })
    console.log(path.join(sortie, `${n}.png`))
  }
  /**
   * Le geste de la plume, image par image, en GIF : la ligne cadrée de toute
   * la largeur, une image toutes les cent millisecondes environ, de son
   * arrivée jusqu'à l'encre posée — puis la dernière, tenue.
   */
  const rafale = async (n: string, selecteur: string) => {
    // Le bandeau du résultat grandit 0,4 s à son arrivée (`pop`) : mesurée avant, la ligne n'est pas encore à sa place.
    // La plume ne se trace qu'à 0,5 s : la rafale commence juste avant.
    await page.waitForTimeout(420)
    const boite = await page.locator(selecteur).first().boundingBox()
    if (!boite) return
    const clip = { x: 0, y: Math.max(0, boite.y - 18), width: 360, height: boite.height + 36 }
    const dossier = path.join(sortie, `.${n}`)
    mkdirSync(dossier, { recursive: true })
    const images: string[] = []
    for (let i = 0; i < 24; i++) {
      const fichier = path.join(dossier, `${String(i).padStart(2, '0')}.png`)
      await page.screenshot({ path: fichier, clip })
      images.push(fichier)
      await page.waitForTimeout(60)
    }
    spawnSync('convert', ['-delay', '10', ...images, '-delay', '160', images[images.length - 1], '-loop', '0', path.join(sortie, `${n}.gif`)])
    console.log(path.join(sortie, `${n}.gif`))
  }
  /** Ce qui élargit la page : au téléphone, rien ne doit déborder de côté (règle `css.md`). */
  const largeur = async (ou: string) => {
    const l = await page.evaluate('document.documentElement.scrollWidth')
    if (Number(l) > 360) console.warn(`[déborde] ${ou} : ${l} px de large`)
  }

  // 0. Camille propose sa question ; l'administrateur la relit au QG, au téléphone, et l'accepte.
  const camille = await inscrireProfil(banc.url, 'camille', 'Camille', '🦉')
  const CHENILLE = {
    texte: 'Quelle danse de fête fait-on en file, chacun les mains sur les épaules de celui de devant ?',
    reponses: ['Le madison', 'La chenille', 'La farandole', 'La macarena'],
    bonne: 1,
    // Son anecdote, avec sa coquille : le QG la reçoit telle quelle, et le signalement la corrigera dans le texte même.
    anecdote: 'Elle a même sa chanson, « La Chenille », un tube de la Bande à Basille.',
  }
  const proposee = await ecrire(banc.url, '/api/jour/propositions', CHENILLE, camille)
  if (!proposee.ok) throw new Error(`proposition refusée (${proposee.status})`)
  const admin = await connexionAnimateur(banc.url)
  const auQg = await navigateur.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, hasTouch: true })
  const [nomAdmin, valeurAdmin] = admin.split('=')
  await auQg.addCookies([{ name: nomAdmin, value: valeurAdmin, url: banc.url }])
  const qg = await auQg.newPage()
  qg.on('pageerror', (e: Error) => console.error('[qg]', e.message))
  await qg.goto(`${banc.url}/admin#jour`)
  // Par son titre : le sommaire de la page, replié au téléphone, porte le même texte, et le prenait avant lui.
  await qg.waitForSelector('#questions-du-public-titre')
  await qg.locator('article', { hasText: 'Question du public' }).first().scrollIntoViewIfNeeded()
  await qg.waitForTimeout(500)
  await qg.screenshot({ path: path.join(sortie, '00-qg-a-relire.png') })
  console.log(path.join(sortie, '00-qg-a-relire.png'))
  await qg.locator('article', { hasText: 'Question du public' }).locator('button', { hasText: 'Accepter' }).tap()
  await qg.locator('article select').selectOption('Autour de la fête')
  // L'anecdote de Camille est déjà dans son champ : l'administrateur la garde telle quelle.
  if ((await qg.locator('article textarea').nth(1).inputValue()) !== CHENILLE.anecdote) console.warn('[qg] l’anecdote de Camille n’est pas dans « Accepter »')
  await qg.waitForTimeout(300)
  await qg.locator('article', { hasText: 'Question du public' }).screenshot({ path: path.join(sortie, '00-qg-accepter.png') })
  console.log(path.join(sortie, '00-qg-accepter.png'))
  await qg.locator('button', { hasText: 'Ajouter au quiz du jour' }).tap()
  await qg.waitForSelector('text=Rien à relire')
  // Acceptée, Camille est de confiance : sa deuxième question, sa catégorie choisie, passe d'office — close dans la file.
  const DRAPEAU = {
    texte: 'Quel est le seul pays au monde dont le drapeau n’est pas un rectangle ?',
    reponses: ['Le Bhoutan', 'Le Népal', 'La Suisse', 'Le Vatican'],
    bonne: 1,
    categorie: 'Géographie',
  }
  const dOffice = (await (await ecrire(banc.url, '/api/jour/propositions', DRAPEAU, camille)).json()) as { statut?: string }
  if (dOffice.statut !== 'acceptee') console.warn(`[confiance] la deuxième question de Camille n’est pas passée d’office (${dOffice.statut})`)
  await qg.reload()
  await qg.waitForSelector('.qg-file-question', { timeout: 15000 })
  const close = qg.locator('.qg-file-question', { hasText: 'Pas encore lue' })
  await close.scrollIntoViewIfNeeded()
  await qg.waitForTimeout(400)
  await qg.locator('.qg-file').screenshot({ path: path.join(sortie, '00b-qg-la-file.png') })
  console.log(path.join(sortie, '00b-qg-la-file.png'))
  await close.locator('button', { hasText: 'La lire' }).tap()
  await qg.waitForSelector('.dialog-actions')
  await qg.screenshot({ path: path.join(sortie, '00c-qg-la-lire.png') })
  console.log(path.join(sortie, '00c-qg-la-lire.png'))
  await qg.locator('.dialog-actions button', { hasText: 'La lire' }).tap()
  await qg.waitForSelector(`.qg-file-question:has-text("${DRAPEAU.texte}")`)
  const lue = qg.locator('.qg-file-question', { hasText: DRAPEAU.texte })
  await lue.locator('button', { hasText: 'Retirer' }).tap()
  await qg.waitForTimeout(300)
  await lue.screenshot({ path: path.join(sortie, '00d-qg-retirer.png') })
  console.log(path.join(sortie, '00d-qg-retirer.png'))
  // Sans la retirer : elle sera la question bonus du lendemain, que le QG annulera.
  await lue.locator('button', { hasText: 'Annuler' }).tap()
  await auQg.close()

  // 1. La page du jour, avant de jouer : la question bonus de Camille annoncée sous « Jouer », et la bulle de la plume.
  await page.goto(`${banc.url}/jour`)
  await page.waitForSelector('.jour-heros')
  await page.waitForSelector('.plume-bulle')
  await photo('01-jour-avant-de-jouer')
  await photo('01-jour-avant-de-jouer-entiere', { pleine: true })
  await largeur('la page du jour, avant de jouer')
  // Chaque question juste, sauf la cinquième — neuf sur dix.
  await page.locator('.jour-heros .btn-primary').click()
  await page.waitForSelector('.ans-btn')
  const { jour, tirage, bonus } = (() => {
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    try {
      const r = db.prepare('SELECT jour, questions FROM jour_tirages ORDER BY jour DESC LIMIT 1').get() as { jour: string; questions: string }
      const b = db.prepare('SELECT question FROM jour_bonus WHERE jour = ?').get(r.jour) as { question: string } | undefined
      return { jour: r.jour, tirage: JSON.parse(r.questions) as { bonne: number }[], bonus: b ? (JSON.parse(b.question) as { bonne: number; auteur?: string }) : null }
    } finally {
      db.close()
    }
  })()
  // La question de Camille vient après les dix, à part : la question bonus.
  if (!bonus?.auteur) throw new Error('la question de Camille n’est pas la question bonus du jour')
  for (let i = 0; i < tirage.length; i++) {
    await page.waitForSelector('.ans-btn, .bonus-invitation, .fin-tete', { timeout: 15000 })
    if (await page.locator('.bonus-invitation, .fin-tete').count()) break
    const choix = i === 4 ? (tirage[i].bonne + 1) % 2 : tirage[i].bonne
    // Le temps de lecture d'abord, et rien dans la première demi-seconde : on retouche jusqu'à ce que la réponse parte.
    for (let essai = 0; essai < 30 && !(await page.locator('.result-banner').count()); essai++) {
      await page.waitForTimeout(400)
      await page.locator('.ans-btn').nth(choix).click({ timeout: 2000 }).catch(() => {})
    }
    await page.waitForSelector('.result-banner')
    if (i === 0) {
      // La signaler : la feuille est la question même. L'anecdote se corrige sur place, s'il y en a une ; la difficulté d'un toucher.
      await page.click('text=Signaler une erreur dans cette question')
      await page.waitForSelector('.signaler-feuille')
      await photo('02-jour-signaler', { attente: 400 })
      if (await page.locator('button.signaler-anecdote').count()) {
        await page.locator('button.signaler-anecdote').tap()
        const anecdote = page.locator('textarea.signaler-anecdote')
        await anecdote.fill(`${await anecdote.inputValue()} Corrigée sur place.`)
        await photo('03-jour-signaler-en-edition', { attente: 300 })
      }
      // Puis la difficulté, touchée au doigt sans quitter le champ d'abord : le texte se relit corrigé, et grandit, après le
      // geste (`RELIRE_APRES_MS`) — avant, la pastille glissait sous le doigt et le toucher se perdait.
      const facile = page.locator('.signaler-pastille', { hasText: 'Trop facile' })
      await facile.tap()
      if ((await facile.getAttribute('aria-pressed')) !== 'true') console.warn('[signaler] « Trop facile », touchée au sortir du champ, ne s’est pas cochée')
      await photo('04-jour-signaler-corrige', { attente: 400 })
      // Deux retouches dans la question : chacune se lit à sa place, la phrase entre elles intacte (`morceaux`). Quittée d'un
      // toucher dans la marge de la carte, hors de tout bouton.
      await page.locator('button.signaler-question').tap()
      const question = page.locator('textarea.signaler-question')
      await question.fill(`Au juste, ${(await question.inputValue()).replace(/\?$/, ', d’après toi ?')}`)
      await page.locator('.signaler-carte').tap({ position: { x: 6, y: 6 } })
      await photo('05-jour-signaler-deux-retouches', { attente: 500 })
      await page.locator('.signaler-feuille .carte-fermer').click()
      await page.waitForTimeout(400)
    }
    await page.waitForTimeout(600)
    await page.locator('.btn-primary.btn-big').click()
  }

  // 2. Juste après les dix : l'écran qui présente la question bonus, puis elle dans son parchemin, sa révélation et le pouce.
  await page.waitForSelector('.bonus-invitation', { timeout: 15000 })
  await photo('06-bonus-une-derniere')
  await largeur('l’écran de la question bonus')
  await page.locator('.bonus-invitation .btn-primary').click()
  await page.waitForSelector('.bonus-carte-question .quiz-question')
  await photo('07-bonus-question')
  await largeur('la question bonus')
  // Ses quatre réponses en vue, en 360 × 640 : sa tête de parchemin ne doit pas pousser la dernière sous le bord.
  const basDesReponses = Number(await page.evaluate("Math.max(...[...document.querySelectorAll('.ans-btn')].map(b => b.getBoundingClientRect().bottom))"))
  console.log(`[question bonus] sa dernière réponse finit à ${Math.round(basDesReponses)} px${basDesReponses > 640 ? ' : sous le bord, en 360 × 640' : ', en vue'}`)
  for (let essai = 0; essai < 30 && !(await page.locator('.result-banner').count()); essai++) {
    await page.waitForTimeout(400)
    await page.locator('.ans-btn').nth(bonus.bonne).tap({ timeout: 2000 }).catch(() => {})
  }
  await page.waitForSelector('.result-banner')
  await photo('08-bonus-revelation')
  await photo('08-bonus-revelation-entiere', { pleine: true })
  await largeur('la révélation de la question bonus')
  await page.locator('.bonus-pouce-btn').first().tap()
  await page.waitForSelector('.bonus-pouce-btn[aria-pressed="true"]')
  await page.locator('.bonus-pouce').scrollIntoViewIfNeeded()
  await photo('09-bonus-pouce', { attente: 400 })
  await page.waitForTimeout(600)
  await page.locator('.btn-primary.btn-big').click()

  // 3. La fin : la carte de la question bonus jouée, la plume au pied du résultat — à son arrivée, tracée, puis encrée.
  await page.waitForSelector('.fin-tete')
  await page.waitForSelector('.plume')
  await rafale('10-jour-fin-la-plume', '.plume')
  await photo('10-jour-fin', { attente: 200 })
  await photo('11-jour-fin-entiere', { pleine: true, attente: 200 })
  await largeur('la fin du jour')
  // La carte à écrire : vide, puis à moitié — le conseil dit le prochain geste —, puis prête, la bonne cochée.
  await page.click('.plume')
  await page.waitForSelector('.plume-feuille')
  await photo('12-plume-carte-vide', { attente: 400 })
  await page.locator('.plume-carte-question').fill('Quel est le seul pays au monde dont le drapeau n’est pas un rectangle ?')
  const champs = page.locator('.plume-carte-reponse .plume-carte-champ')
  await champs.nth(0).fill('Le Bhoutan')
  await champs.nth(1).fill('Le Népal')
  await photo('13-plume-carte-en-cours', { attente: 300 })
  await champs.nth(2).fill('La Suisse')
  await champs.nth(3).fill('Le Vatican')
  await page.locator('.plume-carte-forme').nth(1).click()
  await page.locator('.plume-carte-anecdote textarea').fill('Deux triangles superposés, pour deux branches de sa dynastie.')
  // Le dernier geste : sa catégorie, en haut de la carte.
  await photo('14-plume-carte-sans-categorie', { attente: 400 })
  await page.locator('.plume-carte-categorie select').selectOption('Géographie')
  await photo('14-plume-carte-prete', { attente: 500 })
  await page.locator('.plume-feuille .carte-fermer').click()

  // 4. Le défi de la semaine : une question signalée — la campagne sait sa marche —, puis sa fin, et la plume.
  await page.goto(`${banc.url}/campagne#defi`)
  await page.reload()
  await page.waitForSelector('.defi-heros')
  await page.click('text=Relever le défi')
  for (let i = 0; ; i++) {
    await page.waitForSelector('.ans-btn')
    const textes: string[] = await page.$$eval('.ans-btn .ans-text', (els: any[]) => els.map(e => String(e.textContent ?? '')))
    const bonne = textes.findIndex(t => t.startsWith('Bonne'))
    // Neuf justes, puis des fautes jusqu'à la dernière vie.
    await page.locator('.ans-btn').nth(i < 9 ? bonne : (bonne + 1) % textes.length).click()
    await page.waitForSelector('.result-banner')
    if (i === 0) {
      // Au défi : la coche se déplace sur une autre réponse, et la difficulté d'un toucher.
      await page.click('text=Signaler une erreur dans cette question')
      await page.waitForSelector('.signaler-feuille')
      await page.locator('.signaler-reponse').nth(bonne === 0 ? 1 : 0).tap()
      await page.locator('.signaler-pastille', { hasText: 'Trop dure' }).tap()
      await photo('15-defi-signaler', { attente: 400 })
      await page.locator('.signaler-feuille .carte-fermer').click()
      await page.waitForTimeout(300)
    }
    const suite = page.locator('.btn-primary.btn-big')
    const texte = await suite.textContent()
    await suite.click()
    if (texte?.includes('Voir ma série') || texte?.includes('Voir mon')) break
  }
  await page.waitForSelector('.fin-tete')
  await page.waitForSelector('.plume')
  await rafale('16-defi-fin-la-plume', '.plume')
  await photo('16-defi-fin', { attente: 200 })
  await photo('17-defi-fin-entiere', { pleine: true, attente: 200 })
  await largeur('la fin du défi')

  // 5. Quatre autres la jouent, par les routes — deux la trouvent, avec Léa trois sur cinq, de quoi juger son dosage —, et le
  // QG la suit sous « Question par question ».
  for (const [i, login] of ['hugo', 'ines', 'jules', 'kenza'].entries()) {
    const cookie = await inscrireProfil(banc.url, login, login.charAt(0).toUpperCase() + login.slice(1), ['🐻', '🐼', '🐸', '🐯'][i])
    let vue = (await (await ecrire(banc.url, '/api/jour/commencer', {}, cookie)).json()) as { etat: string; question?: { index: number } }
    for (let garde = 0; garde < 30 && vue.etat === 'en-cours'; garde++) {
      if (vue.question) await ecrire(banc.url, '/api/jour/repondre', { jour, index: vue.question.index, choix: tirage[vue.question.index].bonne }, cookie)
      vue = (await (await ecrire(banc.url, '/api/jour/suivante', {}, cookie)).json()) as typeof vue
    }
    await ecrire(banc.url, '/api/jour/bonus', {}, cookie)
    await ecrire(banc.url, '/api/jour/bonus/repondre', { jour, choix: i < 2 ? bonus.bonne : (bonus.bonne + 1) % 4 }, cookie)
    await ecrire(banc.url, '/api/jour/bonus/vote', { jour, vote: i < 3 ? 1 : -1 }, cookie)
  }
  const suiviAuQg = await navigateur.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, hasTouch: true })
  await suiviAuQg.addCookies([{ name: nomAdmin, value: valeurAdmin, url: banc.url }])
  const suivi = await suiviAuQg.newPage()
  suivi.on('pageerror', (e: Error) => console.error('[qg]', e.message))
  await suivi.goto(`${banc.url}/admin#jour`)
  await suivi.waitForSelector('.qg-bonus', { timeout: 15000 })
  await suivi.locator('.qg-bonus').scrollIntoViewIfNeeded()
  await suivi.waitForTimeout(500)
  await suivi.locator('.qg-bonus').screenshot({ path: path.join(sortie, '18-qg-question-bonus.png') })
  console.log(path.join(sortie, '18-qg-question-bonus.png'))
  await suiviAuQg.close()

  // 6. Camille joue ses dix : sa question bonus ne se joue pas pour elle — sa carte lui dit ce que la salle en fait —, La Plume
  // tombe à la fin ; son accueil lui dit qu'elle est la question bonus du jour, et le lendemain, son bilan.
  const chezCamille = await navigateur.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, hasTouch: true })
  const [nomC, valeurC] = camille.split('=')
  await chezCamille.addCookies([{ name: nomC, value: valeurC, url: banc.url }])
  const pc = await chezCamille.newPage()
  pc.on('pageerror', (e: Error) => console.error('[camille]', e.message))
  const photoDeCamille = async (n: string, { pleine = false } = {}) => {
    await pc.waitForTimeout(600)
    await pc.screenshot({ path: path.join(sortie, `${n}.png`), fullPage: pleine })
    console.log(path.join(sortie, `${n}.png`))
  }
  await pc.goto(`${banc.url}/jour`)
  await pc.waitForSelector('.jour-heros .bonus-annonce')
  await photoDeCamille('19-camille-avant-de-jouer')
  await pc.locator('.jour-heros .btn-primary').click()
  for (let n = 0; n < tirage.length + 2; n++) {
    await pc.waitForTimeout(700)
    await pc.waitForSelector('.ans-btn, .fin-tete', { timeout: 15000 })
    if (await pc.locator('.fin-tete').count()) break
    // Une réponse, la première venue, puis la suivante.
    for (let essai = 0; essai < 30 && !(await pc.locator('.result-banner').count()); essai++) {
      await pc.waitForTimeout(400)
      await pc.locator('.ans-btn').first().click({ timeout: 2000 }).catch(() => {})
    }
    await pc.waitForTimeout(500)
    await pc.locator('.btn-primary.btn-big').click()
  }
  await pc.waitForSelector('.fin-tete', { timeout: 15000 })
  await pc.locator('.bonus-carte').scrollIntoViewIfNeeded()
  await photoDeCamille('20-camille-fin-sa-question-bonus')
  await photoDeCamille('21-camille-fin-entiere', { pleine: true })
  await pc.goto(`${banc.url}/`)
  await pc.waitForSelector('.annonce-admin', { timeout: 15000 })
  await photoDeCamille('22-camille-accueil')
  // Le lendemain : la nuit a jugé son dosage — trois sur cinq, bien dosée —, et son accueil raconte son bilan.
  horloge.t += 24 * 3_600_000
  await pc.reload()
  await pc.waitForSelector('.annonce-admin', { timeout: 15000 })
  await photoDeCamille('23-camille-accueil-bilan')

  // 7. Le même jour, la question passée d'office est la question bonus : le QG l'annule pour tous, de son suivi.
  await page.goto(`${banc.url}/jour`)
  await page.waitForSelector('.jour-heros .bonus-annonce')
  const annulationAuQg = await navigateur.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, hasTouch: true })
  await annulationAuQg.addCookies([{ name: nomAdmin, value: valeurAdmin, url: banc.url }])
  const annulation = await annulationAuQg.newPage()
  annulation.on('pageerror', (e: Error) => console.error('[qg]', e.message))
  await annulation.goto(`${banc.url}/admin#jour`)
  await annulation.waitForSelector('.qg-bonus', { timeout: 15000 })
  await annulation.locator('.qg-bonus button', { hasText: 'Annuler pour tous' }).scrollIntoViewIfNeeded()
  await annulation.locator('.qg-bonus button', { hasText: 'Annuler pour tous' }).tap()
  await annulation.waitForSelector('.dialog-actions')
  await annulation.screenshot({ path: path.join(sortie, '24-qg-annuler-le-bonus.png') })
  console.log(path.join(sortie, '24-qg-annuler-le-bonus.png'))
  await annulation.locator('.dialog-actions button', { hasText: 'Annuler pour tous' }).tap()
  await annulation.waitForSelector('.qg-bonus .etiquette:has-text("annulée pour tous")', { timeout: 15000 })
  await annulation.waitForTimeout(400)
  await annulation.locator('.qg-bonus').screenshot({ path: path.join(sortie, '25-qg-bonus-annulee.png') })
  console.log(path.join(sortie, '25-qg-bonus-annulee.png'))
  await annulationAuQg.close()
  // Léa, avant de jouer : l'annonce sous « Jouer » le dit. Camille, sur son accueil.
  await page.reload()
  await page.waitForSelector('.jour-heros .bonus-annonce')
  await photo('26-jour-bonus-annulee')
  const chezCamilleEncore = await navigateur.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, hasTouch: true })
  await chezCamilleEncore.addCookies([{ name: nomC, value: valeurC, url: banc.url }])
  const pc2 = await chezCamilleEncore.newPage()
  await pc2.goto(`${banc.url}/`)
  await pc2.waitForSelector('.annonce-admin', { timeout: 15000 })
  await pc2.waitForTimeout(600)
  await pc2.screenshot({ path: path.join(sortie, '27-camille-accueil-annulee.png'), fullPage: true })
  console.log(path.join(sortie, '27-camille-accueil-annulee.png'))
  await chezCamilleEncore.close()
  await chezCamille.close()
} finally {
  await navigateur.close()
  await banc.close()
}
