// Les annonces à tous (`/admin#annonces`), photographiées sur un serveur
// jetable — le client construit d'abord (`npm run build -w client`) : la page
// du QG vide, puis un message et cinquante confettis pour chacun, son aperçu,
// la confirmation, la liste des annonces faites ; l'accueil d'un profil qui
// la lit, sa niche à côté ; un message seul après le cadeau, les deux cartes
// l'une sous l'autre ; la ligne de la maintenance qui y mène ; la page en
// 1366 × 768. À chaque photo, ce qui déborde en largeur, et ce qui passe sous
// la niche.
//
//   npx tsx scripts/rendu-annonces.ts [dossier]        (THEME=ivoire…)
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { connexionAnimateur, demarrer, ecrire, inscrireProfil } from '../test/banc'

const sortie = path.resolve(process.argv[2] ?? 'rendu-annonces')
mkdirSync(sortie, { recursive: true })
const theme = process.env.THEME ?? null

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'rendu.js'))('playwright')
}
const { chromium } = chargerPlaywright()

/** Ce qui déborde, en largeur, et ce qui passe sous la niche. En texte : `tsx` glisserait des `__name` dans une fonction passée à la page. */
const MESURES = `(() => {
  const large = document.documentElement.scrollWidth > window.innerWidth + 1
  const niche = document.querySelector('.niche')
  const sous = []
  if (niche && Number(getComputedStyle(niche).opacity) > 0) {
    const n = niche.getBoundingClientRect()
    const touche = r => r.width > 0 && r.height > 0 && r.right > n.left + 1 && r.left < n.right - 1 && r.bottom > n.top + 1 && r.top < n.bottom - 1
    const marcheur = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let t = marcheur.nextNode(); t; t = marcheur.nextNode()) {
      const el = t.parentElement
      if (!el || !t.textContent.trim() || el.closest('.niche, .sr-only, script, style')) continue
      const plage = document.createRange()
      plage.selectNodeContents(t)
      if ([...plage.getClientRects()].some(touche)) sous.push('« ' + t.textContent.trim().slice(0, 40) + ' »')
    }
  }
  return { large, niche: !!niche, sous }
})()`

const banc = await demarrer()
const navigateur = await chromium.launch({ headless: true })
const rapport: string[] = []
try {
  // Léa, son loup dans sa niche : la carte de l'annonce vit en haut de l'accueil, à côté d'elle.
  const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
  await inscrireProfil(banc.url, 'tom', 'Tom', '🐸')
  const id = ((await (await fetch(`${banc.url}/api/joueur/moi?leger`, { headers: { Cookie: lea } })).json()) as any).profile.id as string
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  db.prepare('UPDATE profiles SET niche = ? WHERE id = ?').run('loup', id)
  // Offert : payé, il mettait son solde sous zéro, et l'accueil photographié ne disait plus les confettis de l'annonce.
  db.prepare('INSERT INTO profile_compagnons (profile_id, compagnon, prix, rang, created_at) VALUES (?, ?, 0, 1, 1)').run(id, 'loup')
  db.close()
  await banc.redemarrer()
  const admin = await connexionAnimateur(banc.url)
  if (theme) {
    const r = await ecrire(banc.url, '/api/joueur/moi', { theme }, lea, 'PUT')
    if (!r.ok) throw new Error(`Le thème ${theme} ne se porte pas (${r.status} ${await r.text()})`)
  }

  const contexte = async (cookies: string[], viewport = { width: 360, height: 640 }) => {
    const ctx = await navigateur.newContext({ viewport, deviceScaleFactor: 2, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 })
    await ctx.addCookies(
      cookies.map(c => {
        const [nom, valeur] = c.split('=')
        return { name: nom, value: valeur, url: banc.url }
      }),
    )
    return ctx
  }
  const photo = async (page: any, nom: string, { pleine = false } = {}) => {
    await page.waitForTimeout(900)
    await page.screenshot({ path: path.join(sortie, `${nom}.png`), fullPage: pleine })
    const m = await page.evaluate(MESURES)
    const ligne = `${nom}${m.large ? ' · DÉBORDE EN LARGEUR' : ''}${m.niche ? (m.sous.length ? ' · sous la niche — ' + m.sous.join(' · ') : ' · rien sous la niche') : ''}`
    rapport.push(ligne)
    console.log(ligne)
  }

  // 1. La page du QG, au téléphone : vide, puis l'annonce écrite et son aperçu, la confirmation, la liste.
  {
    const ctx = await contexte([admin])
    const page = await ctx.newPage()
    page.on('pageerror', (e: Error) => console.error('[page]', e.message))
    await page.goto(`${banc.url}/admin#annonces`)
    await page.waitForSelector('#annonce-message')
    await photo(page, '01-qg-annonces-vide', { pleine: true })
    await page.fill('#annonce-message', 'Le quiz du jour et le défi remarchent depuis ce soir. Merci de votre patience — voici de quoi vous faire pardonner !')
    await page.fill('#annonce-confettis', '50')
    await page.locator('#annonce-confettis').blur()
    await photo(page, '02-qg-annonce-ecrite', { pleine: true })
    await page.locator('.admin-geste-oui', { hasText: 'Annoncer' }).click()
    await page.waitForSelector('.dialog-backdrop')
    await photo(page, '03-qg-confirmation')
    await page.locator('.dialog-backdrop .btn-primary').click()
    await page.waitForSelector('.annonce-faite')
    await photo(page, '04-qg-annonce-faite', { pleine: true })
    await ctx.close()
  }

  // 2. L'accueil de Léa : la carte en haut, sa niche à côté — puis, un message seul plus tard, les deux d'un nouveau téléphone.
  {
    const ctx = await contexte([lea])
    const page = await ctx.newPage()
    page.on('pageerror', (e: Error) => console.error('[page]', e.message))
    await page.goto(`${banc.url}/`)
    await page.waitForSelector('.annonce-admin')
    await page.waitForSelector('.niche .niche-bete img', { timeout: 8000 }).catch(() => {})
    await photo(page, '05-accueil-annonce')
    await ctx.close()
  }
  console.log(
    'message seul :',
    (await ecrire(banc.url, '/api/admin/annonces', { id: 'expedition-ouverte', message: 'L’Expédition est ouverte à tous : trois gardiens vous attendent au bout du chemin.' }, admin)).status,
  )
  {
    const ctx = await contexte([lea])
    const page = await ctx.newPage()
    page.on('pageerror', (e: Error) => console.error('[page]', e.message))
    await page.goto(`${banc.url}/`)
    await page.waitForSelector('.annonce-admin')
    await page.waitForSelector('.niche .niche-bete img', { timeout: 8000 }).catch(() => {})
    await photo(page, '06-accueil-deux-annonces', { pleine: true })
    await ctx.close()
  }

  // 3. La maintenance, sa ligne vers les annonces ; puis la page des annonces en 1366 × 768.
  {
    const ctx = await contexte([admin])
    const page = await ctx.newPage()
    page.on('pageerror', (e: Error) => console.error('[page]', e.message))
    await page.goto(`${banc.url}/admin#maintenance`)
    await page.waitForSelector('#maintenance-texte')
    await page.locator('button.lien-discret', { hasText: 'Faire une annonce' }).scrollIntoViewIfNeeded()
    await photo(page, '07-maintenance-vers-les-annonces')
    await ctx.close()
  }
  {
    const ctx = await contexte([admin], { width: 1366, height: 768 })
    const page = await ctx.newPage()
    page.on('pageerror', (e: Error) => console.error('[page]', e.message))
    await page.goto(`${banc.url}/admin#annonces`)
    await page.waitForSelector('.annonce-faite')
    await photo(page, '08-qg-annonces-ordinateur', { pleine: true })
    await ctx.close()
  }
  console.log(`\n${rapport.join('\n')}\n→ ${sortie}`)
} finally {
  await navigateur.close()
  await banc.close()
}
