// Défier un ami, photographié au téléphone (360 × 640) sur un serveur
// jetable : l'onglet du défi — « Défier un ami » en tête, ses amis en
// visages —, la préparation d'un défi (avec qui, sur quoi), une partie jouée
// jusqu'à sa fin — à qui il vient de partir —, et l'onglet de l'ami qui le
// reçoit. Léa a trois amis : Tom, Hugo et Inès ont relevé un de ses défis.
// Le client construit d'abord (`npm run build -w client`).
//
//   npx tsx scripts/rendu-defis.ts [dossier]
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { baseDEssai, demarrer, ecrire, inscrireProfil } from '../test/banc'
import { CATEGORIES } from '../../shared/categories'

const sortie = path.resolve(process.argv[2] ?? 'rendu-defis')
mkdirSync(sortie, { recursive: true })

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'rendu.js'))('playwright')
}
const { chromium } = chargerPlaywright()

const banc = await demarrer({ baseDeLaCampagne: baseDEssai(960, { categories: [...CATEGORIES] }) })
const navigateur = await chromium.launch({ headless: true })
try {
  const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
  const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
  const hugo = await inscrireProfil(banc.url, 'hugo', 'Hugo', '🐼')
  const ines = await inscrireProfil(banc.url, 'ines', 'Inès', '🐙')
  // Un premier défi de Léa, que Tom, Hugo et Inès relèvent : ses amis.
  const premier = (await (await ecrire(banc.url, '/api/campagne/duel', {}, lea)).json()) as { code: string }
  for (const cookie of [tom, hugo, ines]) await ecrire(banc.url, `/api/campagne/duel/${premier.code}`, {}, cookie)

  const telephone = async (cookie: string) => {
    const contexte = await navigateur.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 })
    const [nom, valeur] = cookie.split('=')
    await contexte.addCookies([{ name: nom, value: valeur, url: banc.url }])
    const page = await contexte.newPage()
    page.on('pageerror', (e: Error) => console.error('[page]', e.message))
    return page
  }
  const photo = async (page: any, nomFichier: string, pleine = false) => {
    await page.waitForTimeout(600)
    await page.screenshot({ path: path.join(sortie, `${nomFichier}.png`), fullPage: pleine })
    console.log(path.join(sortie, `${nomFichier}.png`))
  }

  // L'onglet du défi : « Défier un ami » en tête.
  const page = await telephone(lea)
  await page.goto(`${banc.url}/campagne#defi`)
  await page.waitForSelector('.defier-un-ami .defier-visage')
  await photo(page, '1-onglet-du-defi')
  await photo(page, '1-onglet-du-defi-pleine', true)
  // Tom touché : la préparation, lui déjà coché ; Hugo aussi, et l'histoire.
  await page.locator('.defier-visage[aria-label="Défier Tom"]').click()
  await page.waitForSelector('.defier-etape')
  await photo(page, '2-lancer')
  await page.getByRole('button', { name: /Hugo/ }).click()
  await page.getByRole('button', { name: 'Histoire', exact: true }).click()
  await photo(page, '2-lancer-pleine', true)
  // La partie, jusqu'au bout : à sa fin, il est parti à Tom et Hugo.
  await page.getByRole('button', { name: 'Jouer le défi' }).click()
  for (let i = 0; i < 40; i++) {
    await page.waitForSelector('.ans-btn')
    await page.locator('.ans-btn').first().click()
    const suite = page.getByRole('button', { name: /Question suivante|Voir ma série/ })
    await suite.waitFor()
    const derniere = (await suite.textContent())?.includes('Voir ma série')
    await suite.click()
    if (derniere) break
  }
  await page.waitForSelector('.duel-parti')
  await photo(page, '3-fin')
  await photo(page, '3-fin-pleine', true)
  // Tom : le défi l'attend en tête de son onglet, compté sur l'onglet.
  const pourTom = await telephone(tom)
  await pourTom.goto(`${banc.url}/campagne#defi`)
  await pourTom.waitForSelector('.duel-recus')
  await photo(pourTom, '4-tom-le-recoit')
} finally {
  await navigateur.close()
  await banc.close()
}
