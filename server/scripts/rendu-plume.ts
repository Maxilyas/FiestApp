// La plume et le signalement en plusieurs points, photographiés au téléphone
// (360 × 640) sur un serveur jetable : une partie du quiz du jour jouée
// jusqu'au bout — une question signée par un joueur à sa révélation, la
// feuille du signalement cochée puis corrigée, la plume au pied du résultat,
// tracée puis encrée, et la feuille qu'elle ouvre — ; puis le défi de la
// semaine — le signalement d'une question de campagne, qui sait sa marche, et
// la plume au pied de sa fin. Sous le thème qu'on veut (`THEME=ivoire`). Le
// client construit d'abord (`npm run build -w client`).
//
// Le serveur ne dit pas encore qui a écrit une question : le script glisse
// l'auteur dans la révélation de la troisième, au passage (`page.route`),
// avec la question de la maquette — la danse en file, de Camille.
//
//   [THEME=ivoire] npx tsx scripts/rendu-plume.ts [dossier]
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { baseDEssai, demarrer, ecrire, inscrireProfil } from '../test/banc'
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

  // La révélation de la troisième question se signe : Camille l'a écrite.
  await page.route('**/api/jour/repondre', async (route: any) => {
    const reponse = await route.fetch()
    const r = await reponse.json()
    if (r.index === 2) {
      Object.assign(r, {
        auteur: { nom: 'Camille', avatar: '🦉' },
        texte: 'Quelle danse de fête fait-on en file, chacun les mains sur les épaules de celui de devant ?',
        reponses: ['Le madison', 'La chenille', 'La farandole', 'La macarena'],
        bonne: 1,
        choix: r.juste ? 1 : 0,
        // Une coquille, que le signalement corrigera dans le texte même.
        anecdote: 'Elle a même sa chanson, « La Chenille », un tube de la Bande à Basille.',
        trouveePar: 0.72,
      })
    }
    await route.fulfill({ response: reponse, json: r })
  })

  // 1. Le quiz du jour : chaque question juste, sauf la cinquième — neuf sur dix.
  await page.goto(`${banc.url}/jour`)
  await page.waitForSelector('.jour-heros')
  await page.locator('.jour-heros .btn-primary').click()
  await page.waitForSelector('.ans-btn')
  const tirage = (() => {
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    try {
      return JSON.parse((db.prepare('SELECT questions FROM jour_tirages ORDER BY jour DESC LIMIT 1').get() as { questions: string }).questions) as { bonne: number }[]
    } finally {
      db.close()
    }
  })()
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
    if (i === 2) {
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
      await page.locator('button.signaler-anecdote').click()
      const anecdote = page.locator('textarea.signaler-anecdote')
      await anecdote.fill('Elle a même sa chanson, « La Chenille », un tube de la Bande à Basile.')
      await photo('04-jour-signaler-en-edition', { attente: 300 })
      // Quitté, le champ se relit corrigé ; puis la difficulté.
      await page.keyboard.press('Tab')
      await page.locator('.signaler-pastille', { hasText: 'Trop facile' }).click()
      await photo('05-jour-signaler-corrige', { attente: 300 })
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
  const champs = page.locator('.plume-carte-champ')
  await champs.nth(0).fill('Le Bhoutan')
  await champs.nth(1).fill('Le Népal')
  await photo('10-plume-carte-en-cours', { attente: 300 })
  await champs.nth(2).fill('La Suisse')
  await champs.nth(3).fill('Le Vatican')
  await page.locator('.plume-carte-forme').nth(1).click()
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
      await page.locator('.signaler-reponse').nth(bonne === 0 ? 1 : 0).click()
      await page.locator('.signaler-pastille', { hasText: 'Trop dure' }).click()
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
} finally {
  await navigateur.close()
  await banc.close()
}
