// L'affiche d'une nouveauté (`/admin#affiches`), photographiée sur un serveur
// jetable — le client construit d'abord (`npm run build -w client`) : la page
// du QG, son aperçu, la confirmation, l'affiche posée ; l'accueil de Léa, sa
// niche à côté, l'affiche en haut et « Nouveau » sur le bouton du Cabinet ;
// « Plus tard », qui range l'affiche et garde la pastille ; Tom, qui ouvre le
// Cabinet et revient — ni affiche, ni pastille, ses confettis dits une fois ;
// l'affiche d'une page sans peinture à elle (les duels) ; la page du QG en
// 1366 × 768. À chaque photo, ce qui déborde en largeur, et ce qui passe sous
// la niche.
//
//   npx tsx scripts/rendu-affiches.ts [dossier]        (THEME=ivoire…)
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { connexionAnimateur, demarrer, ecrire, inscrireProfil } from '../test/banc'

const sortie = path.resolve(process.argv[2] ?? 'rendu-affiches')
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
  const affiche = document.querySelector('.affiche')
  const boutons = document.querySelector('.accueil-gestes .gros-bouton')
  return {
    large,
    niche: !!niche,
    sous,
    affiche: affiche ? Math.round(affiche.getBoundingClientRect().height) : null,
    premierBouton: boutons ? Math.round(boutons.getBoundingClientRect().top) : null,
  }
})()`

const banc = await demarrer()
const navigateur = await chromium.launch({ headless: true })
const rapport: string[] = []
try {
  // Léa, son loup dans sa niche : l'affiche vit sous elle, en haut de l'accueil.
  const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
  const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐸')
  const max = await inscrireProfil(banc.url, 'max', 'Max', '🐻')
  const id = ((await (await fetch(`${banc.url}/api/joueur/moi?leger`, { headers: { Cookie: lea } })).json()) as any).profile.id as string
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  db.prepare('UPDATE profiles SET niche = ? WHERE id = ?').run('loup', id)
  db.prepare('INSERT INTO profile_compagnons (profile_id, compagnon, prix, rang, created_at) VALUES (?, ?, 0, 1, 1)').run(id, 'loup')
  db.close()
  await banc.redemarrer()
  const admin = await connexionAnimateur(banc.url)
  if (theme) {
    for (const qui of [lea, tom, max]) {
      const r = await ecrire(banc.url, '/api/joueur/moi', { theme }, qui, 'PUT')
      if (!r.ok) throw new Error(`Le thème ${theme} ne se porte pas (${r.status} ${await r.text()})`)
    }
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
    await page.waitForTimeout(2600)
    await page.screenshot({ path: path.join(sortie, `${nom}.png`), fullPage: pleine })
    const m = await page.evaluate(MESURES)
    const ligne = `${nom}${m.large ? ' · DÉBORDE EN LARGEUR' : ''}${m.niche ? (m.sous.length ? ' · sous la niche — ' + m.sous.join(' · ') : ' · rien sous la niche') : ''}${
      m.affiche ? ` · affiche ${m.affiche} px` : ''
    }${m.premierBouton !== null ? ` · premier gros bouton à ${m.premierBouton} px` : ''}`
    rapport.push(ligne)
    console.log(ligne)
  }

  // 1. La page du QG, au téléphone : l'aperçu proposé d'office, puis des confettis, la confirmation, l'affiche posée.
  {
    const ctx = await contexte([admin])
    const page = await ctx.newPage()
    page.on('pageerror', (e: Error) => console.error('[page]', e.message))
    await page.goto(`${banc.url}/admin#affiches`)
    await page.waitForSelector('#affiche-titre')
    await page.waitForSelector('.affiche-apercu .affiche-medaillon img', { timeout: 8000 }).catch(() => {})
    await photo(page, '01-qg-affiche-vide', { pleine: true })
    await page.fill('#affiche-confettis', '50')
    await page.locator('#affiche-confettis').blur()
    await photo(page, '02-qg-affiche-confettis', { pleine: true })
    await page.locator('.admin-geste-oui', { hasText: 'Mettre à l’affiche' }).click()
    await page.waitForSelector('.dialog-backdrop')
    await photo(page, '03-qg-confirmation')
    await page.locator('.dialog-backdrop .btn-primary').click()
    await page.waitForSelector('.annonce-faite')
    await photo(page, '04-qg-affiche-posee', { pleine: true })
    await ctx.close()
  }

  // 2. L'accueil de Léa : l'affiche en haut, sa niche à côté ; « Nouveau » sur le bouton du Cabinet ; puis « Plus tard ».
  {
    const ctx = await contexte([lea])
    const page = await ctx.newPage()
    page.on('pageerror', (e: Error) => console.error('[page]', e.message))
    await page.goto(`${banc.url}/`)
    await page.waitForSelector('.affiche')
    await page.waitForSelector('.affiche-medaillon img', { timeout: 8000 }).catch(() => {})
    await page.waitForSelector('.niche .niche-bete img', { timeout: 8000 }).catch(() => {})
    await photo(page, '05-accueil-affiche')
    await photo(page, '06-accueil-affiche-entier', { pleine: true })
    await page.locator('.gros-bouton', { hasText: 'Le Cabinet de curiosités' }).scrollIntoViewIfNeeded()
    await photo(page, '07-accueil-pastille-nouveau')
    await page.evaluate('window.scrollTo(0, 0)')
    await page.locator('.affiche-plus-tard').tap()
    await page.waitForSelector('.affiche', { state: 'detached' })
    await photo(page, '08-accueil-apres-plus-tard')
    await ctx.close()
  }
  // Rechargé sur un autre appareil : l'affiche reste rangée, la pastille aussi reste.
  {
    const ctx = await contexte([lea])
    const page = await ctx.newPage()
    await page.goto(`${banc.url}/`)
    await page.waitForSelector('.accueil-gestes')
    await page.locator('.gros-bouton', { hasText: 'Le Cabinet de curiosités' }).scrollIntoViewIfNeeded()
    await photo(page, '09-accueil-rangee-ailleurs')
    await ctx.close()
  }

  // 3. Tom ouvre le Cabinet par l'affiche, puis revient à l'accueil : ni affiche ni pastille, et ses confettis, dits une fois.
  {
    const ctx = await contexte([tom])
    const page = await ctx.newPage()
    page.on('pageerror', (e: Error) => console.error('[page]', e.message))
    await page.goto(`${banc.url}/`)
    await page.waitForSelector('.affiche-aller')
    await page.locator('.affiche-aller').tap()
    await page.waitForURL(`${banc.url}/cabinet`)
    await page.waitForTimeout(1500)
    await photo(page, '10-le-cabinet-ouvert')
    await page.goto(`${banc.url}/`)
    await page.waitForSelector('.accueil-gestes')
    await photo(page, '11-accueil-apres-la-visite', { pleine: true })
    await ctx.close()
  }

  // 4. Une page sans peinture à elle : l'affiche des duels, son médaillon dessiné, chez Max — la plus récente passe devant.
  console.log(
    'les duels :',
    (await ecrire(banc.url, '/api/admin/affiches', { id: 'duels-neufs', page: 'duels', titre: 'Du nouveau dans les duels', phrase: 'Défie qui tu veux, ou Automate, et monte de ligue semaine après semaine.', jours: 7 }, admin))
      .status,
  )
  {
    const ctx = await contexte([max])
    const page = await ctx.newPage()
    page.on('pageerror', (e: Error) => console.error('[page]', e.message))
    await page.goto(`${banc.url}/`)
    await page.waitForSelector('.affiche')
    await photo(page, '12-accueil-affiche-des-duels', { pleine: true })
    await ctx.close()
  }

  // 5. La page du QG en 1366 × 768 : ce que chaque affiche a fait.
  {
    const ctx = await contexte([admin], { width: 1366, height: 768 })
    const page = await ctx.newPage()
    page.on('pageerror', (e: Error) => console.error('[page]', e.message))
    await page.goto(`${banc.url}/admin#affiches`)
    await page.waitForSelector('.annonce-faite')
    await photo(page, '13-qg-affiches-ordinateur', { pleine: true })
    await ctx.close()
  }
  console.log(`\n${rapport.join('\n')}\n→ ${sortie}`)
} finally {
  await navigateur.close()
  await banc.close()
}
