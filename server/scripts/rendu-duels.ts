// Les duels, photographiés au téléphone (360 × 640) sur un serveur jetable :
// le bouton de l'accueil, la page d'un débutant — comment ça marche et les
// ligues dépliés —, un duel classé (son enjeu en jeu, sa cote à la fin), une
// montée de ligue, la page d'un habitué — le classement et ses blasons, ses
// derniers duels —, puis défier un ami : la préparation, une partie jusqu'à
// sa fin — à qui il est parti —, et l'ami qui le reçoit, à l'accueil et dans
// ses duels. Les cotes des autres viennent de duels écrits dans la base : la
// cote se relit dans le journal des rencontres (`shared/duels.ts`).
// Le client construit d'abord (`npm run build -w client`).
//
//   npx tsx scripts/rendu-duels.ts [dossier]
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { baseDEssai, demarrer, ecrire, inscrireProfil, type Banc } from '../test/banc'
import { CATEGORIES } from '../../shared/categories'
import { VIES } from '../../shared/campagne'

const sortie = path.resolve(process.argv[2] ?? 'rendu-duels')
mkdirSync(sortie, { recursive: true })

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'rendu.js'))('playwright')
}
const { chromium } = chargerPlaywright()

const base = (banc: Banc) => new Database(banc.quizDbUrl.replace(/^file:/, ''), { fileMustExist: true })

/** L'identifiant d'un profil, lu par sa page. */
async function idDe(banc: Banc, cookie: string): Promise<string> {
  const r = await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: cookie } })
  return ((await r.json()) as { profile: { id: string } }).profile.id
}

/** Une série jouée jusqu'à sa dernière vie : de quoi servir d'adversaire. */
async function serieFinie(banc: Banc, cookie: string, justes: number) {
  const s = (await (await ecrire(banc.url, '/api/campagne/serie', {}, cookie)).json()) as { id: string }
  const db = base(banc)
  const qs = JSON.parse((db.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(s.id) as { questions: string }).questions) as { bonne: number; reponses: string[] }[]
  db.close()
  for (let i = 0; i < justes + VIES; i++) {
    const q = qs[i]
    await ecrire(banc.url, `/api/campagne/serie/${s.id}/reponse`, { index: i, choix: i < justes ? q.bonne : (q.bonne + 1) % q.reponses.length }, cookie)
  }
}

/** Des duels classés déjà joués, écrits dans le journal : `n` fois `justes` contre `sesJustes`. */
function duelsJoues(banc: Banc, profileId: string, n: number, justes: number, sesJustes: number) {
  const db = base(banc)
  const t = Date.now() - 3 * 24 * 3_600_000
  for (let i = 0; i < n; i++) {
    const adversaire = { serie: randomUUID(), profil: randomUUID(), reponses: [...Array(sesJustes).fill(true), ...Array(VIES).fill(false)] }
    db.prepare(
      `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, adversaire)
       VALUES (?, ?, '[]', ?, 0, ?, ?, ?, 'rencontre', ?)`,
    ).run(randomUUID(), profileId, justes + VIES, justes, t + i * 60_000, t + i * 60_000 + 30_000, JSON.stringify(adversaire))
  }
  db.close()
}

const banc = await demarrer({ baseDeLaCampagne: baseDEssai(960, { categories: [...CATEGORIES] }) })
const navigateur = await chromium.launch({ headless: true })
try {
  const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
  const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
  const hugo = await inscrireProfil(banc.url, 'hugo', 'Hugo', '🐼')
  const ines = await inscrireProfil(banc.url, 'ines', 'Inès', '🐙')
  const zoe = await inscrireProfil(banc.url, 'zoe', 'Zoé', '🐯')
  const max = await inscrireProfil(banc.url, 'max', 'Max', '🦉')
  // Max finit des séries de huit : les scores à battre.
  for (let i = 0; i < 4; i++) await serieFinie(banc, max, 8)
  // Les autres ont déjà joué : Inès chez les maîtres, Hugo en platine, Tom en argent, Zoé tout près de l'argent.
  duelsJoues(banc, await idDe(banc, ines), 12, 30, 25)
  duelsJoues(banc, await idDe(banc, hugo), 12, 30, 14)
  duelsJoues(banc, await idDe(banc, tom), 6, 12, 8)
  duelsJoues(banc, await idDe(banc, zoe), 4, 12, 8)
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
  /** Un duel classé joué jusqu'au bout depuis la page : les bonnes réponses lues dans la base, `justes` fois, puis des fautes. */
  const jouerLeDuel = async (page: any, cookie: string, justes: number, avant?: () => Promise<void>) => {
    await page.getByRole('button', { name: /Trouver un adversaire|Reprendre contre/ }).click()
    await page.waitForSelector('.ans-btn')
    if (avant) await avant()
    const id = await idDe(banc, cookie)
    const db = base(banc)
    const ligne = db.prepare(`SELECT questions FROM campagne_series WHERE profile_id = ? AND mode = 'rencontre' AND finie_le IS NULL`).get(id) as { questions: string }
    db.close()
    const qs = JSON.parse(ligne.questions) as { bonne: number; reponses: string[] }[]
    for (let i = 0; ; i++) {
      await page.waitForSelector('.ans-btn')
      const q = qs[i]
      await page.locator('.ans-btn').nth(i < justes ? q.bonne : (q.bonne + 1) % q.reponses.length).click()
      const suite = page.getByRole('button', { name: /Question suivante|Voir qui a gagné/ })
      await suite.waitFor()
      const derniere = (await suite.textContent())?.includes('Voir qui a gagné')
      await suite.click()
      if (derniere) break
    }
    await page.waitForSelector('.duels-fin')
  }

  // L'accueil de Léa : le bouton des duels, sous le quiz du jour.
  const page = await telephone(lea)
  await page.goto(banc.url)
  await page.waitForSelector('.gros-bouton[href="/duels"]')
  await photo(page, '01-accueil')
  // Sa page, avant son premier duel : comment ça marche et les ligues, dépliés.
  await page.click('.gros-bouton[href="/duels"]')
  await page.waitForSelector('.duels-ligues-liste')
  await photo(page, '02-debutant')
  await photo(page, '02-debutant-pleine', true)
  // Un duel classé : l'enjeu en jeu, la cote à la fin.
  await jouerLeDuel(page, lea, 9, () => photo(page, '03-en-jeu'))
  await photo(page, '04-gagne')
  await photo(page, '04-gagne-pleine', true)
  // De retour dans ses duels : le classement, ses blasons, son dernier duel.
  await page.getByRole('link', { name: 'Les duels' }).click()
  await page.waitForSelector('.duels-ligne')
  await photo(page, '05-habitue')
  await photo(page, '05-habitue-pleine', true)

  // Zoé, tout près de l'argent : un duel gagné, et elle y monte.
  const pourZoe = await telephone(zoe)
  await pourZoe.goto(`${banc.url}/duels`)
  await pourZoe.waitForSelector('.duels-heros h1')
  await jouerLeDuel(pourZoe, zoe, 10)
  await photo(pourZoe, '06-promotion')

  // Défier un ami : Tom touché, la préparation, lui déjà coché ; Hugo aussi, et l'histoire.
  await page.locator('.defier-visage[aria-label="Défier Tom"]').click()
  await page.waitForSelector('.defier-etape')
  await photo(page, '07-lancer')
  await page.getByRole('button', { name: /Hugo/ }).click()
  await page.getByRole('button', { name: 'Histoire', exact: true }).click()
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
  await photo(page, '08-parti')
  // Tom : le bouton de son accueil le dit, et le défi l'attend en tête de ses duels.
  const pourTom = await telephone(tom)
  await pourTom.goto(banc.url)
  await pourTom.waitForSelector('.gros-bouton[href="/duels"] .pastille-attente')
  await photo(pourTom, '09-accueil-de-tom')
  await pourTom.click('.gros-bouton[href="/duels"]')
  await pourTom.waitForSelector('.duel-recus')
  await photo(pourTom, '10-tom-le-recoit')
  // L'ancien lien d'un défi, parti avant les duels : il mène à sa page.
  await pourTom.goto(`${banc.url}/campagne#duel-${premier.code}`)
  await pourTom.waitForSelector('.defi-heros')
  console.log('ancien lien →', new URL(pourTom.url()).pathname + new URL(pourTom.url()).hash)
} finally {
  await navigateur.close()
  await banc.close()
}
