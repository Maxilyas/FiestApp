// Le quiz du jour et le rayon des objets de la boutique, photographiés au
// téléphone (360 × 640) sur un serveur jetable : l'accueil du jour avec une
// série en cours et la veille à raconter, une partie jouée jusqu'à sa fin,
// le jour joué qu'on retrouve en revenant, et la boutique — ses objets, la
// fiche d'un objet touché. Le client construit d'abord
// (`npm run build -w client`).
//
//   npx tsx scripts/rendu-jour.ts [dossier]
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { demarrer, inscrireProfil } from '../test/banc'

const sortie = path.resolve(process.argv[2] ?? 'rendu-jour')
mkdirSync(sortie, { recursive: true })
const { chromium } = createRequire(path.join(spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim(), 'rendu.js'))('playwright')

/** Mardi 6 octobre 2026, 10 h à Paris. */
const horloge = { t: Date.UTC(2026, 9, 6, 8, 0) }
const banc = await demarrer({ horlogeDuJour: () => horloge.t })
const navigateur = await chromium.launch({ headless: true })
try {
  const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
  const hugo = await inscrireProfil(banc.url, 'hugo', 'Hugo', '🐻')
  // Douze jours joués d'affilée jusqu'à hier : une série, une veille à
  // raconter, et de quoi payer un sablier en confettis.
  {
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    const idDe = (login: string) => (db.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id
    const tirage = db.prepare(`INSERT OR IGNORE INTO jour_tirages (jour, questions, annulees, tire_le) VALUES (?, ?, '[]', 1)`)
    const partie = db.prepare(
      `INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, ?, ?, 10, NULL, ?, ?, ?, 0)`,
    )
    const questions = JSON.stringify(Array.from({ length: 10 }, () => ({ reponses: ['a', 'b'], bonne: 0 })))
    for (let j = 12; j >= 1; j--) {
      const midi = horloge.t - j * 24 * 3600_000
      const jour = new Date(midi).toISOString().slice(0, 10)
      tirage.run(jour, questions)
      partie.run(idDe('lea'), jour, midi, 1400, 8, midi + 120_000)
      partie.run(idDe('hugo'), jour, midi, 1100, 7, midi + 120_000)
    }
    db.close()
  }
  void hugo

  const contexte = await navigateur.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 })
  const [nom, valeur] = lea.split('=')
  await contexte.addCookies([{ name: nom, value: valeur, url: banc.url }])
  const page = await contexte.newPage()
  page.on('pageerror', (e: Error) => console.error('[page]', e.message))
  const photo = async (n: string, pleine = false) => {
    await page.waitForTimeout(700)
    await page.screenshot({ path: path.join(sortie, `${n}.png`), fullPage: pleine })
    console.log(path.join(sortie, `${n}.png`))
  }

  // 1. L'accueil du jour : la série, la veille.
  await page.goto(`${banc.url}/jour`)
  await page.waitForSelector('.jour-heros')
  await photo('1-accueil', true)
  const serie = page.locator('.serie-du-jour')
  if (await serie.count()) {
    await serie.first().click()
    await page.waitForTimeout(300)
    await photo('2-serie-ouverte')
    await page.locator('.carte-fermer').click()
  }

  // 2. Une partie jouée jusqu'au bout, la première réponse à chaque fois.
  await page.locator('.jour-heros .btn-primary').click()
  for (let i = 0; i < 12; i++) {
    await page.waitForSelector('.ans-btn, .fin-tete', { timeout: 15000 })
    if (await page.locator('.fin-tete').count()) break
    // Le temps de lecture d'abord, et rien dans la première demi-seconde : on
    // retouche jusqu'à ce que la réponse parte.
    for (let essai = 0; essai < 20 && !(await page.locator('.result-banner').count()); essai++) {
      await page.waitForTimeout(500)
      await page.locator('.ans-btn').first().click({ timeout: 2000 }).catch(() => {})
    }
    await page.waitForSelector('.result-banner')
    await page.waitForTimeout(650)
    await page.locator('.btn-primary.btn-big').click()
  }
  await page.waitForSelector('.fin-tete')
  await photo('3-fin', true)

  // 3. Le jour joué, qu'on retrouve en revenant.
  await page.reload()
  await page.waitForSelector('.jour-joue')
  await photo('4-jour-joue', true)

  // 4. La boutique : ses objets, puis la fiche du sablier.
  await page.goto(`${banc.url}/boutique#objets`)
  await page.reload()
  await page.waitForTimeout(1200)
  await photo('5-boutique-objets', true)
  const sablier = page.locator('.objet-case', { hasText: 'Sablier' })
  if (await sablier.count()) {
    await sablier.first().click()
    await page.waitForTimeout(300)
    await photo('6-fiche-sablier', true)
  }
  await page.goto(`${banc.url}/boutique#objet-vie`)
  await page.reload()
  await page.waitForSelector('#fiche-objet')
  await photo('7-fiche-vie')
} finally {
  await navigateur.close()
  await banc.close()
}
