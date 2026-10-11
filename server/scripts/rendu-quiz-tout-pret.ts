// Un quiz tout prêt, photographié au téléphone (360 × 640) sur un serveur
// jetable qui lit la vraie base de la campagne : « Créer un quiz » et sa
// ligne, la feuille réglée d'office puis choisie — deux catégories, facile,
// dix questions —, le quiz composé ouvert dans l'éditeur, et sa première
// estimation ; puis le salon d'un profil, où le quiz composé rejoint ce
// soir.
// Le client construit d'abord (`npm run build -w client`).
//
//   npx tsx scripts/rendu-quiz-tout-pret.ts [dossier]
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { connexionAnimateur, demarrer, inscrireProfil } from '../test/banc'

const sortie = path.resolve(process.argv[2] ?? 'rendu-quiz-tout-pret')
mkdirSync(sortie, { recursive: true })

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'rendu.js'))('playwright')
}
const { chromium } = chargerPlaywright()

const banc = await demarrer()
const navigateur = await chromium.launch({ headless: true })
try {
  const telephone = async (cookie: string) => {
    const contexte = await navigateur.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 })
    const [nom, valeur] = cookie.split('=')
    await contexte.addCookies([{ name: nom, value: valeur, url: banc.url }])
    const page = await contexte.newPage()
    page.on('pageerror', (e: Error) => console.error('[page]', e.message))
    return page
  }
  const photo = async (page: any, nomFichier: string) => {
    await page.waitForTimeout(500)
    await page.screenshot({ path: path.join(sortie, `${nomFichier}.png`) })
    console.log(path.join(sortie, `${nomFichier}.png`))
  }
  /** Le corps de la feuille ouverte, défilé jusqu'à `fraction` de sa hauteur — en texte : le typecheck du serveur ne connaît pas le DOM. */
  const defiler = (page: any, fraction: number) =>
    page.evaluate(`(() => {
      const corps = document.querySelector('.carte-corps')
      if (corps) corps.scrollTop = (corps.scrollHeight - corps.clientHeight) * ${fraction}
    })()`)

  // L'animateur : « Créer un quiz », sa ligne en tête.
  const page = await telephone(await connexionAnimateur(banc.url))
  await page.goto(`${banc.url}/edit`)
  await page.getByRole('button', { name: 'Créer un quiz' }).click()
  await page.waitForSelector('.carte-feuille')
  await photo(page, '01-creer-un-quiz')
  // La feuille, réglée d'office : « Composer » se touche tout de suite.
  await page.getByRole('button', { name: /Un quiz tout prêt/ }).click()
  await page.waitForSelector('.categories-grille')
  await photo(page, '02-feuille')
  await defiler(page, 0.5)
  await photo(page, '03-feuille-sujets')
  await defiler(page, 1)
  await photo(page, '04-feuille-bas')
  // Deux catégories, facile, dix questions — et des enfants.
  await defiler(page, 0)
  await page.getByRole('button', { name: 'Histoire', exact: true }).click()
  await page.getByRole('button', { name: 'Nature', exact: true }).click()
  await page.getByRole('button', { name: 'Facile', exact: true }).click()
  await page.getByRole('button', { name: '10', exact: true }).click()
  await page.getByText('Des enfants jouent').click()
  await page.evaluate(`document.getElementById('tout-pret-difficulte').scrollIntoView({ block: 'start' })`)
  await photo(page, '05-choisi')
  await page.getByRole('button', { name: /^Composer 10 questions/ }).click()
  // Composé, il s'ouvre dans l'éditeur.
  await page.waitForSelector('.carte-feuille', { state: 'detached' })
  await page.waitForTimeout(800)
  await photo(page, '06-compose')
  // Sa première estimation : la carte dont « Estimation » est choisi, sa cible et son unité.
  await page.evaluate(`[...document.querySelectorAll('button.active, button[aria-pressed="true"]')].find(b => b.textContent.includes('Estimation'))?.scrollIntoView({ block: 'start' })`)
  await photo(page, '06b-estimation')
  console.log('titre →', await page.locator('input[aria-label*="itre"], h1').first().inputValue().catch(() => page.locator('h1').first().textContent()))

  // Un profil crée son salon : le quiz tout prêt est dans « Ajouter un quiz ».
  const chef = await telephone(await inscrireProfil(banc.url, 'nadia', 'Nadia', '🦊'))
  await chef.goto(`${banc.url}/salon`)
  await chef.getByRole('button', { name: 'Ajouter un quiz' }).click()
  await chef.waitForSelector('.carte-feuille')
  await defiler(chef, 1)
  await photo(chef, '07-salon-ajouter')
  await chef.getByRole('button', { name: /Un quiz tout prêt/ }).click()
  await chef.waitForSelector('.categories-grille')
  await chef.getByRole('button', { name: /^Composer 15 questions/ }).click()
  await chef.waitForSelector('.salon-quiz-ligne')
  await photo(chef, '08-salon-ce-soir')
} finally {
  await navigateur.close()
  await banc.close()
}
