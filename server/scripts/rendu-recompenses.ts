// Les écrans des récompenses de la campagne et du quiz du jour, photographiés
// sur un serveur jetable : les records par catégorie, une fin de série qui
// fait tomber hauts faits, paliers et légendaire, le défi de la semaine
// (avant, pendant, après — l'Éclat de sa fin, forcé —, sa clôture et sa
// correction), le laurier d'argent sur le profil — au téléphone, en
// 360 × 640 —, et l'entrée en scène du champion du mois à l'écran commun, en
// 1366 × 768. Le client construit d'abord (`npm run build -w client`).
//
//   npx tsx scripts/rendu-recompenses.ts [dossier]
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { baseDEssai, connexionAnimateur, demarrer, ecrire, inscrireProfil, invite } from '../test/banc'
import { ProfileStore } from '../src/auth/profiles'
import { CATEGORIES } from '../../shared/categories'

// L'Éclat est un tirage : il ne tombe ici que là où on le photographie.
ProfileStore.tirageEclat = () => false

const sortie = path.resolve(process.argv[2] ?? 'rendu-recompenses')
mkdirSync(sortie, { recursive: true })
const { chromium } = createRequire(path.join(spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim(), 'rendu.js'))('playwright')

// Le serveur démarre le 30 septembre : septembre s'écrit avant que le mois se close.
const horloge = { t: Date.UTC(2026, 8, 30, 8, 0) }
const banc = await demarrer({ horlogeDuJour: () => horloge.t, baseDeLaCampagne: baseDEssai(12 * CATEGORIES.length, { categories: [...CATEGORIES] }) })
const navigateur = await chromium.launch({ headless: true })
const db = () => new Database(banc.quizDbUrl.replace(/^file:/, ''))
try {
  const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
  const hugo = await inscrireProfil(banc.url, 'hugo', 'Hugo', '🐻')
  const idDe = (login: string) => {
    const d = db()
    try {
      return (d.prepare('SELECT id FROM profiles WHERE login = ?').get(login) as { id: string }).id
    } finally {
      d.close()
    }
  }
  // Septembre joué par Léa et Hugo, Léa devant : la première visite d'octobre
  // le clôt, et l'écran commun saluera sa championne (section 5).
  {
    const d = db()
    const tirage = d.prepare(`INSERT OR IGNORE INTO jour_tirages (jour, questions, annulees, tire_le) VALUES (?, ?, '[]', 1)`)
    const partie = d.prepare(
      `INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, ?, ?, 10, NULL, ?, 8, ?, 0)`,
    )
    const questions = JSON.stringify(Array.from({ length: 10 }, () => ({ reponses: ['a', 'b'], bonne: 0 })))
    for (let j = 1; j <= 30; j++) {
      const jour = `2026-09-${String(j).padStart(2, '0')}`
      const midi = Date.UTC(2026, 8, j, 10, 0)
      tirage.run(jour, questions)
      partie.run(idDe('lea'), jour, midi, 1500, midi + 120_000)
      partie.run(idDe('hugo'), jour, midi, 1000, midi + 120_000)
    }
    d.close()
  }
  // Mardi 6 octobre : la première visite clôt septembre.
  horloge.t = Date.UTC(2026, 9, 6, 8, 0)
  // Quelques séries d'une seule catégorie, pour ses records.
  {
    const d = db()
    const ins = d.prepare(
      `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, categories) VALUES (?, ?, '[]', 0, 0, ?, 1, 2, 'serie', ?)`,
    )
    CATEGORIES.slice(0, 7).forEach((c, i) => ins.run(`r${i}`, idDe('lea'), [12, 10, 4, 15, 9, 10, 3][i], JSON.stringify([c])))
    d.close()
  }
  // Hugo relève le défi par l'API : sept bonnes réponses.
  {
    const s = (await (await ecrire(banc.url, '/api/campagne/defi', {}, hugo)).json()) as any
    const d = db()
    const qs = JSON.parse((d.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(s.id) as any).questions)
    d.close()
    let fin = false
    for (let i = 0; !fin; i++) {
      const q = qs[i]
      const r = (await (await ecrire(banc.url, `/api/campagne/serie/${s.id}/reponse`, { index: i, choix: i < 7 ? q.bonne : (q.bonne + 1) % q.reponses.length }, hugo)).json()) as any
      fin = r.finie
    }
  }

  const contexte = await navigateur.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 })
  const [nom, valeur] = lea.split('=')
  await contexte.addCookies([{ name: nom, value: valeur, url: banc.url }])
  const page = await contexte.newPage()
  page.on('pageerror', (e: Error) => console.error('[page]', e.message))
  page.on('console', (m: any) => m.type() === 'error' && console.error('[console]', m.text()))
  const photo = async (n: string, pleine = false) => {
    await page.waitForTimeout(700)
    await page.screenshot({ path: path.join(sortie, `${n}.png`), fullPage: pleine })
    console.log(path.join(sortie, `${n}.png`))
  }
  /** Joue la partie ouverte : `justes` bonnes réponses d'abord, des fautes ensuite, jusqu'à sa fin. */
  const jouer = async (justes: number) => {
    for (let i = 0; ; i++) {
      await page.waitForSelector('.ans-btn')
      const textes: string[] = await page.$$eval('.ans-btn .ans-text', (els: any[]) => els.map(e => String(e.textContent ?? '')))
      const bonne = textes.findIndex(t => t.startsWith('Bonne'))
      await page.locator('.ans-btn').nth(i < justes ? bonne : (bonne + 1) % textes.length).click()
      await page.waitForSelector('.result-banner')
      const suite = page.locator('.btn-primary.btn-big')
      const texte = await suite.textContent()
      await suite.click()
      if (texte?.includes('Voir ma série')) return
    }
  }

  // 1. La série : ses records par catégorie, dépliés.
  await page.goto(`${banc.url}/campagne`)
  await page.waitForSelector('.campagne-records')
  await page.click('.campagne-records summary')
  await photo('1-records', true)

  // 2. Une série de trente : la Grande Série, Sans une égratignure, L'Alpiniste, le Serpent à plumes.
  await page.click('text=Commencer une série')
  await jouer(30)
  await page.waitForSelector('.campagne-recompenses')
  // Le médaillon arrive à la demande : on attend que son image soit peinte.
  await page
    .waitForFunction(() => [...(globalThis as any).document.querySelectorAll('.fin-legendaire img')].some((i: any) => i.naturalWidth > 0), undefined, { timeout: 10000 })
    .catch(() => console.error('médaillon non chargé'))
  await photo('2-fin-de-serie', true)

  // 3. Le défi : avant, la partie, la fin, le classement.
  // Une ancre seule ne recharge pas la page : on recharge.
  await page.goto(`${banc.url}/campagne#defi`)
  await page.reload()
  await page.waitForSelector('.defi-heros')
  await photo('3-defi-avant', true)
  await page.click('text=Relever le défi')
  await page.waitForSelector('.ans-btn')
  await photo('4-defi-question')
  // Sa fin fait éclater son avatar, à coup sûr : la carte de l'Éclat.
  ProfileStore.tirageEclat = () => true
  await jouer(9)
  await page.waitForSelector('.fin-tete')
  await page.waitForSelector('.fin-eclat')
  ProfileStore.tirageEclat = () => false
  await photo('5-defi-fin', true)
  await page.click('text=Le classement du défi')
  await page.waitForSelector('.defi-classement .lb-row')
  await photo('6-defi-apres', true)

  // 4. Lundi : la clôture, le laurier d'argent, la semaine passée.
  horloge.t = Date.UTC(2026, 9, 12, 7, 0)
  await page.goto(`${banc.url}/campagne#defi`)
  await page.reload()
  await page.waitForSelector('.defi-passee')
  await photo('7-defi-semaine-passee', true)
  await page.click('text=La correction du défi')
  await page.waitForSelector('.campagne-correction')
  await photo('8-defi-correction')
  await page.goto(`${banc.url}/profil`)
  await page.waitForTimeout(1200)
  await photo('9-profil-laurier-argent')

  // 6. La gerbe : son choix dans « Mon thème », et l'éclat d'une bonne réponse.
  await page.goto(`${banc.url}/profil#theme`)
  await page.waitForSelector('.gerbes-choix')
  await photo('11-ma-gerbe', true)
  await page.click('.gerbes-choix >> text=Les confettis')
  await page.waitForTimeout(250)
  await page.screenshot({ path: path.join(sortie, '12-gerbe-apercu.png') })
  console.log(path.join(sortie, '12-gerbe-apercu.png'))
  await page.goto(`${banc.url}/campagne`)
  await page.reload()
  await page.locator('.btn-primary.btn-big').click()
  await page.waitForSelector('.ans-btn')
  {
    const textes: string[] = await page.$$eval('.ans-btn .ans-text', (els: any[]) => els.map(e => String(e.textContent ?? '')))
    await page.locator('.ans-btn').nth(textes.findIndex(t => t.startsWith('Bonne'))).click()
    await page.waitForSelector('.gerbe i')
    await page.waitForTimeout(550)
    await page.screenshot({ path: path.join(sortie, '13-gerbe-en-jeu.png') })
    console.log(path.join(sortie, '13-gerbe-en-jeu.png'))
  }

  // 5. L'entrée en scène du champion du mois, à l'écran commun.
  const animateur = await connexionAnimateur(banc.url)
  const ecranCtx = await navigateur.newContext({ viewport: { width: 1366, height: 768 } })
  const [n2, v2] = animateur.split('=')
  await ecranCtx.addCookies([{ name: n2, value: v2, url: banc.url }])
  await ecranCtx.addInitScript(() => localStorage.setItem('quizz.muted', '1'))
  const ecran = await ecranCtx.newPage()
  ecran.on('pageerror', (e: Error) => console.error('[écran]', e.message))
  await ecran.goto(`${banc.url}/host`)
  await ecran.waitForTimeout(2000)
  await invite(banc.url, 'Hugo', '🐻', { cookie: hugo })
  const salut = invite(banc.url, 'Léa', '🦊', { cookie: lea })
  await salut
  await ecran.waitForSelector('.entree-en-scene', { timeout: 5000 }).catch(() => console.error('pas d’entrée en scène'))
  await ecran.waitForTimeout(900)
  await ecran.screenshot({ path: path.join(sortie, '10-entree-en-scene.png') })
  console.log(path.join(sortie, '10-entree-en-scene.png'))
} finally {
  await navigateur.close()
  await banc.close()
}
