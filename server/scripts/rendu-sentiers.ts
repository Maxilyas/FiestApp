// Les écrans des sentiers du savoir, photographiés au téléphone (360 × 640)
// sur un serveur jetable : la carte des sentiers, un sentier, sa fiche,
// l'épreuve, sa fin, la révélation d'un portrait, le rachat des vies. Le
// client construit d'abord (`npm run build -w client`).
//
//   npx tsx scripts/rendu-sentiers.ts [dossier] [ivoire]
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { baseDEssai, connexionAnimateur, demarrer, ecrire, inscrireProfil } from '../test/banc'
import { CATEGORIES } from '../../shared/categories'

const sortie = path.resolve(process.argv[2] ?? 'rendu-sentiers')
const ivoire = process.argv.includes('ivoire')
mkdirSync(sortie, { recursive: true })

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'rendu.js'))('playwright')
}
const { chromium } = chargerPlaywright()

const banc = await demarrer({ baseDeLaCampagne: baseDEssai(960, { categories: [...CATEGORIES] }) })
const navigateur = await chromium.launch({ headless: true })
try {
  const cookie = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
  const id = ((await (await fetch(`${banc.url}/api/joueur/moi?leger`, { headers: { Cookie: cookie } })).json()) as any).profile.id
  // Une joueuse en route : la forêt au septième palier, le stade au sommet, quelques autres commencés.
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  for (const [branche, paliers] of [['foret', 7], ['stade', 12], ['mythes', 2], ['scene', 5], ['carnaval', 1]] as const) {
    db.prepare('INSERT INTO sentier_acquis (profile_id, branche, paliers, retenu_le) VALUES (?, ?, ?, 1)').run(id, branche, paliers)
  }
  db.close()

  const contexte = await navigateur.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 })
  const [nom, valeur] = cookie.split('=')
  await contexte.addCookies([{ name: nom, value: valeur, url: banc.url }])
  const page = await contexte.newPage()
  page.on('pageerror', (e: Error) => console.error('[page]', e.message))
  // Ivoire, le thème clair : celui du profil, que ses pages portent.
  if (ivoire) await ecrire(banc.url, '/api/joueur/moi', { theme: 'ivoire' }, cookie, 'PUT')
  const photo = async (nomFichier: string, pleine = false) => {
    await page.waitForTimeout(600)
    await page.screenshot({ path: path.join(sortie, `${nomFichier}.png`), fullPage: pleine })
    console.log(path.join(sortie, `${nomFichier}.png`))
  }

  await page.goto(`${banc.url}/campagne#sentiers`)
  await page.waitForSelector('.sentiers-grille .sentiers-tuile:not(.sentiers-tuile-vide)')
  await photo('1-carte')
  await photo('1-carte-entiere', true)

  await page.click('.sentiers-tuile >> text=La forêt')
  await page.waitForSelector('.sentier-chemin')
  await photo('2-sentier')
  await photo('2-sentier-entier', true)

  await page.click('.palier-courant')
  await page.waitForSelector('.sentier-fiche')
  await photo('3-fiche')

  /** Joue l'épreuve ouverte : `justes` bonnes réponses d'abord, des fautes ensuite, jusqu'à sa fin. */
  const jouer = async (justes: number, photos: Record<number, string> = {}) => {
    await page.waitForSelector('.epreuve .ans-btn')
    for (let i = 0; i < 16; i++) {
      const textes: string[] = await page.$$eval('.ans-btn .ans-text', (els: any[]) => els.map(e => String(e.textContent ?? '')))
      const bonne = textes.findIndex(t => t.startsWith('Bonne'))
      await page.locator('.ans-btn').nth(i < justes ? bonne : (bonne + 1) % textes.length).click()
      await page.waitForSelector('.result-banner')
      if (photos[i]) await photo(photos[i])
      const suite = page.locator('.btn-primary.btn-big')
      const texte = await suite.textContent()
      await suite.click()
      if (texte?.includes('résultat')) return
      await page.waitForSelector('.epreuve .ans-btn')
    }
  }
  const palierSuivant = async () => {
    await page.waitForSelector('.sentier-chemin')
    await page.click('.palier-courant')
    await page.click('.sentier-fiche .btn-primary')
  }

  // Le palier 8 ouvre le loup : treize bonnes réponses, la révélation.
  await page.click('.sentier-fiche .btn-primary')
  await page.waitForSelector('.epreuve .ans-btn')
  await photo('4-epreuve')
  await jouer(13, { 10: '5-reponse', 13: '5-validee-continue' })
  await page.waitForSelector('.epreuve-revelation')
  await page.waitForTimeout(1200)
  await photo('6-revelation')
  await photo('6-revelation-entiere', true)

  // Le palier 9 n'ouvre rien : « Palier validé », ses étoiles.
  await page.click('text=Continuer le sentier')
  await palierSuivant()
  await jouer(15)
  await page.waitForSelector('.epreuve-fin-tete')
  await photo('7-validee')
  await photo('7-validee-entiere', true)

  // Raté : cinq fautes d'affilée.
  await page.click('text=Retour au sentier')
  await palierSuivant()
  await jouer(3, { 7: '8-rate-reponse' })
  await page.waitForSelector('.epreuve-perte')
  await photo('8-rate')
  await photo('8-rate-entier', true)

  // L'accueil : le bouton de la campagne dit le sentier qu'on avance et ses vies.
  await page.goto(`${banc.url}/`)
  await page.waitForSelector('.gros-bouton[href="/campagne#sentiers"]')
  await photo('8-accueil')
  // Touché, il ouvre la campagne sur ses sentiers — ses onglets, le sentier en tête —, jamais un sentier seul.
  await page.click('.gros-bouton[href="/campagne#sentiers"]')
  await page.waitForSelector('.onglets-campagne')
  await page.waitForSelector('.sentiers-reprise')
  await photo('8-accueil-campagne')

  // Le maître : le stade est au sommet.
  await page.goto(`${banc.url}/campagne#sentier-stade`)
  await page.waitForSelector('.sentier-chemin')
  await photo('9-sommet')
  await page.click('.palier-maitre')
  await page.waitForSelector('.sentier-fiche')
  await photo('9-fiche-maitre')

  // Le rachat des vies.
  await page.goto(`${banc.url}/campagne#sentiers`)
  await page.waitForSelector('.sentiers-racheter')
  await page.click('.sentiers-racheter')
  await page.waitForSelector('.vies-achat')
  await photo('10-vies')

  // La série, onglet voisin.
  await page.goto(`${banc.url}/campagne`)
  await page.waitForSelector('.campagne-heros')
  await photo('11-serie')

  // La boutique : le rayon des vies, sous les thèmes.
  await page.goto(`${banc.url}/boutique`)
  await page.waitForSelector('.rayon-vies')
  await page.locator('.rayon-vies').scrollIntoViewIfNeeded()
  await photo('12-boutique-vies')

  // Les avatars du profil : la forêt et ses paliers.
  await page.goto(`${banc.url}/profil#avatars`)
  await page.waitForSelector('[role="tab"]')
  await page.locator('[role="tab"]', { hasText: /Savoir|Branches/ }).first().click()
  await page.waitForSelector('.rayon, .atlas-branche')
  await photo('13-avatars', true)

  // L'administration des sentiers.
  const admin = await connexionAnimateur(banc.url)
  const [nomA, valeurA] = admin.split('=')
  await contexte.addCookies([{ name: nomA, value: valeurA, url: banc.url }])
  await page.goto(`${banc.url}/admin#campagne`)
  await page.waitForSelector('.sentiers-admin-ligne')
  await photo('14-admin', true)

  // Trois maîtres : le Cabinet de curiosités derrière sa carte.
  const base = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  for (const branche of ['monde', 'oceans', 'espace']) {
    base.prepare('INSERT OR REPLACE INTO sentier_acquis (profile_id, branche, paliers, retenu_le) VALUES (?, ?, 13, 1)').run(id, branche)
  }
  base.close()
  await ecrire(banc.url, '/api/joueur/moi', { fond: 'cabinet', titre: 'maitre:oceans' }, cookie, 'PUT')
  await page.goto(`${banc.url}/profil`)
  await page.waitForSelector('.identite')
  await page.click('.identite')
  await page.waitForSelector('.carte-fond')
  await page.waitForTimeout(800)
  await photo('15-carte-cabinet')
  await page.goto(`${banc.url}/campagne#sentier-stade`)
  await page.waitForSelector('.sentier-chemin')
  await page.click('.palier-maitre')
  await page.waitForSelector('.maitres-recompenses')
  await page.locator('.maitres-recompenses').scrollIntoViewIfNeeded()
  await photo('16-maitres')
} finally {
  await navigateur.close()
  await banc.close()
}
