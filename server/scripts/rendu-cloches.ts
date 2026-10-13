// La cloche des notifications, photographiée au téléphone (360 × 640) sur un
// serveur jetable, comme dans l'application installée — elle ne paraît
// qu'elle : celle du soir, en haut à droite de la page du jour. Puis la page
// des duels, au même endroit, qui n'en a plus depuis le 13 octobre 2026 —
// « Comment ça marche ? » et ses amis seulement. Chromium sans écran refuse
// les notifications : la permission se dit vierge ici, comme sur un téléphone
// qui n'a encore rien demandé. Le client construit d'abord
// (`npm run build -w client`).
//
//   npx tsx scripts/rendu-cloches.ts [dossier]
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { demarrer, inscrireProfil } from '../test/banc'

const sortie = path.resolve(process.argv[2] ?? 'rendu-cloches')
mkdirSync(sortie, { recursive: true })

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'rendu.js'))('playwright')
}
const { chromium } = chargerPlaywright()

// Les services de push du banc : ceux de Chromium, pour que l'abonnement du navigateur passe.
const banc = await demarrer({ rappels: { servicesDePush: () => true } })
const navigateur = await chromium.launch({ headless: true })
try {
  const cookie = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
  const contexte = await navigateur.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 })
  // L'application installée, comme Safari le dit sur l'écran d'accueil d'un iPhone ; rien de demandé encore.
  // En texte : une fonction passée telle quelle emporterait les `__name` que tsx ajoute, inconnus de la page.
  await contexte.addInitScript(`
    Object.defineProperty(navigator, 'standalone', { value: true })
    Object.defineProperty(Notification, 'permission', { get() { return 'default' }, configurable: true })
  `)
  const [nom, valeur] = cookie.split('=')
  await contexte.addCookies([{ name: nom, value: valeur, url: banc.url }])
  const page = await contexte.newPage()
  page.on('pageerror', (e: Error) => console.error('[page]', e.message))
  const photo = async (nomFichier: string) => {
    await page.waitForTimeout(600)
    await page.screenshot({ path: path.join(sortie, `${nomFichier}.png`) })
    console.log(path.join(sortie, `${nomFichier}.png`))
  }

  await page.goto(`${banc.url}/jour`)
  await page.waitForSelector('.jour-barre .cloche-du-rappel')
  await photo('1-jour')

  await page.goto(`${banc.url}/duels`)
  await page.waitForSelector('.duels .duels-barre-haut .duels-icone')
  // Le temps que la page ait tout rendu : une cloche venue à la demande arriverait après les icônes.
  await page.waitForTimeout(600)
  const enHaut = await page.$$eval('.duels .duels-barre-haut .jour-barre-fin > *', (l: any[]) => l.map(b => b.getAttribute('aria-label')))
  console.log('en haut des duels :', enHaut.join(' · '), '— cloches :', await page.locator('.duels .cloche-du-rappel').count())
  await photo('2-duels')
} finally {
  await navigateur.close()
  await banc.close()
}
