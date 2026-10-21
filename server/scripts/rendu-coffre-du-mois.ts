// Le coffre du mois, photographié au téléphone (360 × 640) sur un serveur
// jetable : douze joueurs au classement d'octobre 2026, l'horloge au 1er
// novembre, puis — pour la première place, la troisième, la septième et la
// douzième — la ligne des missions qui s'allume, la feuille, et la scène du
// coffre au repos et révélé. Le client construit d'abord
// (`npm run build -w client`).
//
//   npx tsx scripts/rendu-coffre-du-mois.ts [dossier] [ivoire]
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { demarrer, ecrire, inscrireProfil } from '../test/banc'

const sortie = path.resolve(process.argv[2] ?? 'rendu-coffre-du-mois')
const ivoire = process.argv.includes('ivoire')
mkdirSync(sortie, { recursive: true })

const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
const { chromium } = createRequire(path.join(globale, 'rendu.js'))('playwright')

let maintenant = Date.UTC(2026, 9, 31, 9)
const banc = await demarrer({ horlogeDuJour: () => maintenant, hasardDuCoffre: () => 0.5 })
const navigateur = await chromium.launch({ headless: true })
try {
  const cookies: string[] = []
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  const midi = Date.UTC(2026, 9, 5, 10)
  db.prepare(`INSERT INTO jour_tirages (jour, questions, annulees, tire_le) VALUES ('2026-10-05', ?, '[]', 1)`).run(
    JSON.stringify(Array.from({ length: 10 }, () => ({ reponses: ['a', 'b'], bonne: 0 }))),
  )
  for (let i = 1; i <= 12; i++) {
    const cookie = await inscrireProfil(banc.url, `joueur${i}`, `Joueur ${i}`, '🦊')
    cookies.push(cookie)
    if (ivoire) await ecrire(banc.url, '/api/joueur/moi', { theme: 'ivoire' }, cookie, 'PUT')
    const id = (db.prepare('SELECT id FROM profiles WHERE login = ?').get(`joueur${i}`) as { id: string }).id
    db.prepare(
      `INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, '2026-10-05', ?, 10, NULL, ?, 5, ?, 0)`,
    ).run(id, midi, 13_000 - i * 1000, midi + 120_000)
  }
  db.close()
  maintenant = Date.UTC(2026, 10, 1, 9)

  for (const place of [1, 3, 7, 12]) {
    const contexte = await navigateur.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 })
    const [nom, valeur] = cookies[place - 1].split('=')
    await contexte.addCookies([{ name: nom, value: valeur, url: banc.url }])
    const page = await contexte.newPage()
    page.on('pageerror', (e: Error) => console.error('[page]', e.message))
    const photo = async (n: string, attente = 700) => {
      await page.waitForTimeout(attente)
      await page.screenshot({ path: path.join(sortie, `place-${place}-${n}.png`) })
      console.log(path.join(sortie, `place-${place}-${n}.png`))
    }
    await page.goto(`${banc.url}/`)
    await page.waitForSelector('.missions-ligne.missions-coffre', { timeout: 15000 })
    await photo('1-accueil', 1200)
    await page.click('.missions-ligne')
    await page.waitForSelector('.coffre-attend')
    await photo('2-feuille')
    await page.click('.coffre-attend')
    await page.waitForSelector('.coffre-scene.coffre-repos')
    await photo('3-repos', 900)
    await page.click('.coffre-ouvrir')
    await page.waitForSelector('.coffre-revele', { timeout: 15000 })
    await photo('4-revele', 2200)
    await contexte.close()
  }
} finally {
  await navigateur.close()
  await banc.close()
}
