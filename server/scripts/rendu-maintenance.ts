// Le bandeau rouge et la maintenance (`/admin#maintenance`), photographiés
// sur un serveur jetable — le client construit d'abord
// (`npm run build -w client`) : l'accueil sans profil sous le bandeau — ses
// trois gros boutons toujours sans défiler —, l'accueil d'un profil, le quiz
// du jour et les duels fermés, l'Expédition bientôt disponible, sa niche sous
// le bandeau ; l'écran d'une page fermée, celui d'une page qui arrive ;
// l'onglet du défi fermé seul ; une question de la campagne, où le bandeau se
// tait ; la même page fermée pour l'administrateur, qui y entre encore ;
// l'accueil et l'Expédition de son testeur, sous le bandeau ; et la page du
// QG — ses testeurs, la recherche d'un autre —, au téléphone et en
// 1366 × 768. À chaque photo, ce qui déborde en largeur, et ce qui passe sous
// la niche.
//
//   npx tsx scripts/rendu-maintenance.ts [dossier]        (THEME=ivoire, THEME=sommet…)
//
// Léa et Tom ont tous les thèmes — achetés, et gagnés par les badges qui les
// ouvrent, comme Camille dans `rendu-themes.ts` : un thème peint posait son
// décor par-dessus le bandeau, et seul un thème gagné le montrait.
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { baseDEssai, connexionAnimateur, demarrer, ecrire, inscrireProfil } from '../test/banc'
import { THEMES } from '../../shared/themes'
import { BRANCHES } from '../../shared/branches'
import { PAGES, cleDeLaPage } from '../../shared/calendrier'

const sortie = path.resolve(process.argv[2] ?? 'rendu-maintenance')
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
  const bandeau = document.querySelector('.bandeau-du-service')
  return {
    large,
    niche: !!niche,
    sous,
    bandeau: bandeau ? Math.round(bandeau.getBoundingClientRect().height) + ' px' + (getComputedStyle(bandeau).display === 'none' ? ' (tu)' : '') : 'aucun',
  }
})()`

const banc = await demarrer({ baseDeLaCampagne: baseDEssai(60) })
const navigateur = await chromium.launch({ headless: true })
const rapport: string[] = []
try {
  const admin = await connexionAnimateur(banc.url)
  // Léa, son loup dans sa niche : la niche descend sous le bandeau. Tom teste
  // l'Expédition, que l'administrateur garde pour bientôt.
  const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
  const tom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐸')
  const idDe = async (cookie: string) => ((await (await fetch(`${banc.url}/api/joueur/moi?leger`, { headers: { Cookie: cookie } })).json()) as any).profile.id as string
  const id = await idDe(lea)
  const idTom = await idDe(tom)
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  db.prepare('UPDATE profiles SET niche = ? WHERE id = ?').run('loup', id)
  db.prepare('INSERT INTO profile_compagnons (profile_id, compagnon, prix, rang, created_at) VALUES (?, ?, 1000, 1, 1)').run(id, 'loup')
  for (const qui of [id, idTom]) {
    const achat = db.prepare('INSERT INTO profile_achats (profile_id, theme, prix, created_at) VALUES (?, ?, 0, 1)')
    for (const t of THEMES) if (t.rarete !== 'offert' && !t.gagne) achat.run(qui, t.key)
    const maitre = db.prepare('INSERT INTO sentier_acquis (profile_id, branche, paliers, retenu_le) VALUES (?, ?, 13, 1)')
    for (const b of BRANCHES) maitre.run(qui, b.key)
    const badge = db.prepare(`INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, ?, ?, '', '🏅', ?, 1)`)
    for (let i = 0; i < 50; i++) badge.run(qui, 'hf:laurier', `#jour:2026-01-${i}`, 'Laurier')
    for (const cle of ['hf:infatigable:2', 'hf:alpiniste:3', 'hf:elite:2', 'mois:2026-09']) badge.run(qui, cle, '#jour:2026-09-30', cle)
    for (const p of PAGES) badge.run(qui, cleDeLaPage(p.mois), `#jour:2026-${p.mois}-24`, p.nom)
  }
  db.close()
  await banc.redemarrer()
  const adminDeNouveau = await connexionAnimateur(banc.url)
  for (const qui of [lea, tom]) {
    if (!theme) break
    const r = await ecrire(banc.url, '/api/joueur/moi', { theme }, qui, 'PUT')
    if (!r.ok) throw new Error(`Le thème ${theme} ne se porte pas (${r.status} ${await r.text()})`)
  }

  const poser = (chemin: string, corps: unknown) => ecrire(banc.url, chemin, corps, adminDeNouveau, 'PUT').then(r => r.status)
  console.log(
    'bandeau, jour, duels, expédition, son testeur :',
    await poser('/api/admin/maintenance/bandeau', { texte: 'Le quiz du jour et les duels sont en panne depuis ce matin : on répare, merci de votre patience !' }),
    await poser('/api/admin/maintenance/pages/jour', { etat: 'maintenance' }),
    await poser('/api/admin/maintenance/pages/duels', { etat: 'maintenance' }),
    await poser('/api/admin/maintenance/pages/expedition', { etat: 'bientot' }),
    await poser(`/api/admin/maintenance/pages/expedition/testeurs/${idTom}`, {}),
  )
  void admin

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
    const fichier = path.join(sortie, `${nom}.png`)
    await page.screenshot({ path: fichier, fullPage: pleine })
    const m = await page.evaluate(MESURES)
    const ligne = `${nom} : bandeau ${m.bandeau}${m.large ? ' · DÉBORDE EN LARGEUR' : ''}${m.niche ? (m.sous.length ? ' · sous la niche — ' + m.sous.join(' · ') : ' · rien sous la niche') : ''}`
    rapport.push(ligne)
    console.log(ligne)
  }

  // 1. L'accueil sans profil : ses trois gros boutons, sans défiler en 360 × 640.
  {
    const ctx = await contexte([])
    const page = await ctx.newPage()
    page.on('pageerror', (e: Error) => console.error('[page]', e.message))
    await page.goto(`${banc.url}/`)
    await page.waitForSelector('.entree-choix .join-actions .btn')
    await photo(page, '01-accueil-sans-profil')
    const bas: number[] = await page.$$eval('.entree-choix .join-actions .btn', (l: any[]) => l.map(b => Math.round(b.getBoundingClientRect().bottom)))
    const ligne = `   les trois gros boutons finissent à ${bas.join(', ')} px — ${Math.max(...bas) <= 640 ? 'sans défiler' : 'SOUS LE PLI'}`
    rapport.push(ligne)
    console.log(ligne)
    await ctx.close()
  }

  // 2. L'accueil de Léa : le quiz du jour et les duels éteints, sa niche sous le bandeau.
  {
    const ctx = await contexte([lea])
    const page = await ctx.newPage()
    page.on('pageerror', (e: Error) => console.error('[page]', e.message))
    await page.goto(`${banc.url}/`)
    await page.waitForSelector('.gros-ferme')
    await page.waitForSelector('.niche .niche-bete img', { timeout: 8000 }).catch(() => {})
    await photo(page, '02-accueil-profil')
    await photo(page, '02b-accueil-profil-entier', { pleine: true })
    // 3. Le quiz du jour, fermé : l'écran qui le dit ; l'Expédition, qui arrive : le sien.
    await page.goto(`${banc.url}/jour`)
    await page.waitForSelector('.en-maintenance')
    await photo(page, '03-jour-en-maintenance')
    await page.goto(`${banc.url}/expedition`)
    await page.waitForSelector('.en-bientot')
    await photo(page, '03b-expedition-bientot')
    // 4. Le défi seul fermé : son onglet le dit, le reste de la campagne reste ouvert.
    console.log('défi :', await poser('/api/admin/maintenance/pages/defi', { fermee: true }))
    await page.goto(`${banc.url}/campagne#defi`)
    await page.waitForSelector('.en-maintenance')
    await photo(page, '04-defi-en-maintenance')
    // 5. Une question de la campagne : le bandeau se tait, la page tient l'écran.
    await page.goto(`${banc.url}/campagne`)
    await page.waitForSelector('.btn-primary.btn-big')
    await page.locator('.btn-primary.btn-big').first().click()
    await page.waitForSelector('.ans-grid', { timeout: 8000 }).catch(() => {})
    await photo(page, '05-question-de-campagne')
    await ctx.close()
  }

  // 6. L'administrateur sur la page qu'il a fermée : il y entre, sa ligne le lui dit.
  {
    const ctx = await contexte([adminDeNouveau, lea])
    const page = await ctx.newPage()
    page.on('pageerror', (e: Error) => console.error('[page]', e.message))
    await page.goto(`${banc.url}/jour`)
    await page.waitForSelector('.bandeau-administrateur')
    await photo(page, '06-jour-pour-l-administrateur')
    // 7. La page du QG, au téléphone : l'Expédition et son testeur, puis un autre qu'on cherche.
    await page.goto(`${banc.url}/admin#maintenance`)
    await page.waitForSelector('.maintenance-testeurs')
    await photo(page, '07-qg-maintenance-telephone', { pleine: true })
    await page.fill('.maintenance-testeurs input[type="search"]', 'lé')
    await page.waitForSelector('.maintenance-testeurs .admin-geste-oui', { timeout: 8000 }).catch(() => {})
    await page.locator('.maintenance-testeurs').scrollIntoViewIfNeeded()
    await photo(page, '07b-qg-un-testeur-de-plus')
    await ctx.close()
  }

  // 7c. Tom, son testeur : son accueil le lui dit, et l'Expédition s'ouvre pour lui — sous le bandeau.
  {
    const ctx = await contexte([tom])
    const page = await ctx.newPage()
    page.on('pageerror', (e: Error) => console.error('[page]', e.message))
    await page.goto(`${banc.url}/`)
    await page.waitForSelector('.gros-bouton[href="/expedition"]')
    await photo(page, '07c-accueil-du-testeur', { pleine: true })
    await page.goto(`${banc.url}/expedition`)
    await page.waitForSelector('.exp-depart, .exp-carte, main', { timeout: 8000 }).catch(() => {})
    await photo(page, '07d-expedition-du-testeur')
    await ctx.close()
  }

  // 8. La page du QG en 1366 × 768, et la vue d'ensemble, sa pastille dans la barre de côté.
  {
    const ctx = await contexte([adminDeNouveau], { width: 1366, height: 768 })
    const page = await ctx.newPage()
    page.on('pageerror', (e: Error) => console.error('[page]', e.message))
    await page.goto(`${banc.url}/admin#maintenance`)
    await page.waitForSelector('.maintenance-page')
    await photo(page, '08-qg-maintenance-ordinateur', { pleine: true })
    await page.goto(`${banc.url}/admin`)
    await page.waitForSelector('.qg-cote')
    await photo(page, '09-qg-vue-d-ensemble')
    await ctx.close()
  }
  console.log(`\n${rapport.join('\n')}\n→ ${sortie}`)
} finally {
  await navigateur.close()
  await banc.close()
}
