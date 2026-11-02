// La plume et le signalement en plusieurs points, photographiés au téléphone
// (360 × 640) sur un serveur jetable : une partie du quiz du jour jouée
// jusqu'au bout — une question signée par un joueur à sa révélation, la
// feuille du signalement cochée puis corrigée, la plume au pied du résultat,
// tracée puis encrée, et la feuille qu'elle ouvre — ; puis le défi de la
// semaine — le signalement d'une question de campagne, qui sait sa marche, et
// la plume au pied de sa fin. Sous le thème qu'on veut (`THEME=ivoire`). Le
// client construit d'abord (`npm run build -w client`).
//
// Le circuit entier, par les vraies routes : Camille propose sa question — la
// danse en file, et son anecdote —, l'administrateur la relit au QG et
// l'accepte, l'anecdote déjà dans son champ ; elle passe au quiz du jour, que
// Léa joue, signée ; puis
// Camille joue le sien jusqu'au bout : sa question se montre sans se jouer,
// La Plume tombe à la fin, et son accueil lui dit qu'elle est au quiz du jour,
// ses confettis avec ; enfin l'administrateur l'annule pour tous, et son
// accueil lui dit qu'elle ne compte plus.
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
  await qg.waitForSelector('text=Les questions du public')
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
  await auQg.close()

  // 1. Le quiz du jour : chaque question juste, sauf la cinquième — neuf sur dix.
  await page.goto(`${banc.url}/jour`)
  await page.waitForSelector('.jour-heros')
  await page.locator('.jour-heros .btn-primary').click()
  await page.waitForSelector('.ans-btn')
  const { jour, tirage } = (() => {
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    try {
      const r = db.prepare('SELECT jour, questions FROM jour_tirages ORDER BY jour DESC LIMIT 1').get() as { jour: string; questions: string }
      return { jour: r.jour, tirage: JSON.parse(r.questions) as { bonne: number; auteur?: string }[] }
    } finally {
      db.close()
    }
  })()
  // Sa place, tirée avec le jour : la question de Camille, mélangée parmi les autres.
  const k = tirage.findIndex(q => q.auteur)
  if (k < 0) throw new Error('la question de Camille n’est pas au quiz du jour')
  for (let i = 0; i < tirage.length; i++) {
    await page.waitForSelector('.ans-btn, .fin-tete', { timeout: 15000 })
    if (await page.locator('.fin-tete').count()) break
    const choix = i === 4 ? (tirage[i].bonne + 1) % 2 : tirage[i].bonne
    // Le temps de lecture d'abord, et rien dans la première demi-seconde : on retouche jusqu'à ce que la réponse parte.
    for (let essai = 0; essai < 30 && !(await page.locator('.result-banner').count()); essai++) {
      await page.waitForTimeout(400)
      await page.locator('.ans-btn').nth(choix).click({ timeout: 2000 }).catch(() => {})
    }
    await page.waitForSelector('.result-banner')
    if (i === k) {
      // La question du public : sa signature, au pied de son anecdote.
      await photo('01-jour-question-du-public')
      await photo('02-jour-question-du-public-entiere', { pleine: true })
      await largeur('la question du public')
      // Sa signature ne doit pas pousser « Question suivante » sous le bord de l'écran.
      const bas = Number(await page.evaluate("document.querySelector('.btn-primary.btn-big').getBoundingClientRect().bottom"))
      console.log(`[question du public] « Question suivante » finit à ${Math.round(bas)} px${bas > 640 ? ' : sous le bord, en 360 × 640' : ', en vue'}`)
      // La signaler : la feuille est la question même. La coquille de l'anecdote se corrige sur place, la difficulté d'un toucher.
      await page.click('text=Signaler une erreur dans cette question')
      await page.waitForSelector('.signaler-feuille')
      await photo('03-jour-signaler', { attente: 400 })
      await page.locator('button.signaler-anecdote').tap()
      const anecdote = page.locator('textarea.signaler-anecdote')
      await anecdote.fill('Elle a même sa chanson, « La Chenille », un tube de la Bande à Basile.')
      await photo('04-jour-signaler-en-edition', { attente: 300 })
      // Puis la difficulté, touchée au doigt sans quitter le champ d'abord : le texte se relit corrigé, et grandit, après le
      // geste (`RELIRE_APRES_MS`) — avant, la pastille glissait sous le doigt et le toucher se perdait.
      const facile = page.locator('.signaler-pastille', { hasText: 'Trop facile' })
      await facile.tap()
      if ((await facile.getAttribute('aria-pressed')) !== 'true') console.warn('[signaler] « Trop facile », touchée au sortir du champ, ne s’est pas cochée')
      await photo('05-jour-signaler-corrige', { attente: 400 })
      // Deux retouches dans la question : chacune se lit à sa place, la phrase entre elles intacte (`morceaux`). Quittée d'un
      // toucher dans la marge de la carte, hors de tout bouton.
      await page.locator('button.signaler-question').tap()
      await page.locator('textarea.signaler-question').fill('Quelle danse de fête fait-on en file indienne, chacun les mains sur les épaules de celui qui est devant ?')
      await page.locator('.signaler-carte').tap({ position: { x: 6, y: 6 } })
      await photo('06-jour-signaler-deux-retouches', { attente: 500 })
      await page.locator('.signaler-feuille .carte-fermer').click()
      await page.waitForTimeout(400)
    }
    await page.waitForTimeout(600)
    await page.locator('.btn-primary.btn-big').click()
  }

  // 2. La fin : la plume au pied du résultat — à son arrivée, tracée, puis encrée.
  await page.waitForSelector('.fin-tete')
  await page.waitForSelector('.plume')
  await rafale('07-jour-fin-la-plume', '.plume')
  await photo('07-jour-fin', { attente: 200 })
  await photo('08-jour-fin-entiere', { pleine: true, attente: 200 })
  await largeur('la fin du jour')
  // La carte à écrire : vide, puis à moitié — le conseil dit le prochain geste —, puis prête, la bonne cochée.
  await page.click('.plume')
  await page.waitForSelector('.plume-feuille')
  await photo('09-plume-carte-vide', { attente: 400 })
  await page.locator('.plume-carte-question').fill('Quel est le seul pays au monde dont le drapeau n’est pas un rectangle ?')
  const champs = page.locator('.plume-carte-reponse .plume-carte-champ')
  await champs.nth(0).fill('Le Bhoutan')
  await champs.nth(1).fill('Le Népal')
  await photo('10-plume-carte-en-cours', { attente: 300 })
  await champs.nth(2).fill('La Suisse')
  await champs.nth(3).fill('Le Vatican')
  await page.locator('.plume-carte-forme').nth(1).click()
  await page.locator('.plume-carte-anecdote textarea').fill('Deux triangles superposés, pour deux branches de sa dynastie.')
  await photo('11-plume-carte-prete', { attente: 500 })
  await page.locator('.plume-feuille .carte-fermer').click()

  // 3. Le défi de la semaine : une question signalée — la campagne sait sa marche —, puis sa fin, et la plume.
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
      await photo('12-defi-signaler', { attente: 400 })
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
  await rafale('13-defi-fin-la-plume', '.plume')
  await photo('13-defi-fin', { attente: 200 })
  await photo('14-defi-fin-entiere', { pleine: true, attente: 200 })
  await largeur('la fin du défi')

  // 4. Camille joue le sien jusqu'au bout : sa question se montre sans se jouer, La Plume tombe à la fin ; puis son accueil
  // le lui dit, ses confettis avec — et, sa question annulée pour tous, qu'elle ne compte plus.
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
  await pc.waitForSelector('.jour-heros')
  await pc.locator('.jour-heros .btn-primary').click()
  for (let n = 0; n < tirage.length; n++) {
    await pc.waitForTimeout(700)
    await pc.waitForSelector('.ans-btn, .plume-tienne-icone, .fin-tete', { timeout: 15000 })
    if (await pc.locator('.fin-tete').count()) break
    if (await pc.locator('.plume-tienne-icone').count()) {
      await photoDeCamille('15-camille-ta-question')
    } else {
      // Une autre question : une réponse, la première venue, puis la suivante.
      for (let essai = 0; essai < 30 && !(await pc.locator('.result-banner').count()); essai++) {
        await pc.waitForTimeout(400)
        await pc.locator('.ans-btn').first().click({ timeout: 2000 }).catch(() => {})
      }
    }
    await pc.waitForTimeout(500)
    await pc.locator('.btn-primary.btn-big').click()
  }
  await pc.waitForSelector('.fin-tete', { timeout: 15000 })
  await photoDeCamille('16-camille-fin-la-plume', { pleine: true })
  await pc.goto(`${banc.url}/`)
  await pc.waitForSelector('.annonce-admin', { timeout: 15000 })
  await photoDeCamille('17-camille-accueil')
  // Fausse, l'administrateur l'annule pour tous : son accueil remplace « +25 confettis » par ce qu'elle ne rapporte plus.
  const annulee = await ecrire(banc.url, '/api/admin/jour/annuler', { jour, index: k }, admin)
  if (!annulee.ok) throw new Error(`annulation refusée (${annulee.status})`)
  await pc.reload()
  await pc.waitForSelector('.annonce-admin', { timeout: 15000 })
  await photoDeCamille('18-camille-accueil-annulee')
  await chezCamille.close()
} finally {
  await navigateur.close()
  await banc.close()
}
