// Les missions du jour et le coffre de la semaine, photographiés au téléphone
// (360 × 640) sur un serveur jetable : l'accueil d'un profil — « À la une »,
// la ligne des missions —, leur feuille, une série jouée qui en fait deux et
// sa fin (« Missions accomplies »), puis, de lundi en lundi, un coffre de
// chaque rang ouvert acte par acte — le repos, la charge, l'éclair, la
// révélation — sur chaque sorte d'objet : un compagnon, un fond de carte, un
// thème, une gerbe, des confettis ; enfin, au QG, le coffre ouvert pour voir,
// qui n'écrit rien (`ApercuDuCoffre`). Le hasard du coffre est réglé d'avance
// (`hasardDuCoffre`) : le script cherche, par le tirage lui-même
// (`tirerLeCoffre`), les deux nombres qui donnent l'objet voulu. Le client
// construit d'abord (`npm run build -w client`).
//
//   npx tsx scripts/rendu-missions.ts [dossier] [ivoire] [calme]
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { baseDEssai, connexionAnimateur, demarrer, ecrire, inscrireProfil } from '../test/banc'
import { CATEGORIES } from '../../shared/categories'
import { cleDeLObjet, type ObjetDuTresor, type RangDuCoffre } from '../../shared/coffre'
import { tirerLeCoffre } from '../../shared/tresor'

const sortie = path.resolve(process.argv[2] ?? 'rendu-missions')
const ivoire = process.argv.includes('ivoire')
const calme = process.argv.includes('calme')
mkdirSync(sortie, { recursive: true })

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'rendu.js'))('playwright')
}
const { chromium } = chargerPlaywright()

/** L'heure du serveur, à la main : le jeudi 15 octobre 2026 à 10 h à Paris, puis de lundi en lundi. */
let maintenant = Date.UTC(2026, 9, 15, 8)
/** Les deux nombres que le prochain coffre tirera : sa rareté, puis son objet. */
const tirages: number[] = []
const banc = await demarrer({
  horlogeDuJour: () => maintenant,
  baseDeLaCampagne: baseDEssai(12 * CATEGORIES.length, { categories: [...CATEGORIES] }),
  hasardDuCoffre: () => tirages.shift() ?? 0,
})
const navigateur = await chromium.launch({ headless: true })
try {
  const cookie = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
  const id = ((await (await fetch(`${banc.url}/api/joueur/moi?leger`, { headers: { Cookie: cookie } })).json()) as any).profile.id
  if (ivoire) await ecrire(banc.url, '/api/joueur/moi', { theme: 'ivoire' }, cookie, 'PUT')
  const base = <T>(fn: (db: Database.Database) => T): T => {
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    try {
      return fn(db)
    } finally {
      db.close()
    }
  }
  /** Des jours aux trois missions faites : les tampons d'une semaine — celui d'un jour déjà tiré compris. */
  const tamponner = (jours: string[]) =>
    base(db => {
      const ins = db.prepare(
        "INSERT INTO profile_missions (profile_id, jour, rang, mission, tiree_le, faite_le) VALUES (?, ?, 3, '{}', ?, ?) ON CONFLICT (profile_id, jour, rang) DO UPDATE SET faite_le = excluded.faite_le",
      )
      for (const j of jours) ins.run(id, j, maintenant, maintenant)
    })
  // Ses missions de ce jeudi, posées d'avance — le tirage dépend de son identifiant — : une série, des bonnes réponses, l'Histoire.
  base(db => {
    const ins = db.prepare('INSERT INTO profile_missions (profile_id, jour, rang, mission, tiree_le) VALUES (?, ?, ?, ?, ?)')
    const missions = [
      { sorte: 'serie', cible: 3 },
      { sorte: 'justes', cible: 4 },
      { sorte: 'categorie', cible: 3, categorie: 'Histoire' },
    ]
    missions.forEach((m, rang) => ins.run(id, '2026-10-15', rang, JSON.stringify(m), maintenant))
  })
  // Lundi, mardi et mercredi : trois tampons déjà sur la carte.
  tamponner(['2026-10-12', '2026-10-13', '2026-10-14'])

  const contexte = await navigateur.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, ...(calme && { reducedMotion: 'reduce' }) })
  const [nom, valeur] = cookie.split('=')
  await contexte.addCookies([{ name: nom, value: valeur, url: banc.url }])
  const page = await contexte.newPage()
  page.on('pageerror', (e: Error) => console.error('[page]', e.message))
  page.on('console', (m: any) => m.type() === 'error' && console.error('[console]', m.text()))
  const photo = async (n: string, { pleine = false, attente = 700 } = {}) => {
    await page.waitForTimeout(attente)
    await page.screenshot({ path: path.join(sortie, `${n}.png`), fullPage: pleine })
    console.log(path.join(sortie, `${n}.png`))
  }

  // 1. L'accueil : « À la une », puis la ligne des missions ; le bandeau passe au suivant.
  await page.goto(`${banc.url}/`)
  await page.waitForSelector('.missions-ligne:not(.missions-en-chemin)')
  await page.waitForSelector('.une')
  await photo('1-accueil', { attente: 1500 })
  await page.mouse.move(0, 0)
  await photo('1-accueil-une-suivante', { attente: 7000 })
  // 2. La feuille : ses trois missions, ce que paient les trois, la carte de la semaine.
  await page.click('.missions-ligne')
  await page.waitForSelector('.feuille-des-missions .missions-liste')
  await photo('2-feuille')
  await page.locator('.feuille-des-missions .carte-corps').evaluate((e: any) => e.scrollTo(0, e.scrollHeight))
  await photo('2-feuille-bas')

  // 3. Une série jouée : cinq bonnes réponses, puis des fautes — la série et les bonnes réponses sont faites, pas l'Histoire.
  await page.goto(`${banc.url}/campagne`)
  await page.waitForSelector('text=Commencer une série')
  await page.click('text=Commencer une série')
  for (let i = 0; ; i++) {
    await page.waitForSelector('.ans-btn')
    const textes: string[] = await page.$$eval('.ans-btn .ans-text', (els: any[]) => els.map(e => String(e.textContent ?? '')))
    const bonne = textes.findIndex(t => t.startsWith('Bonne'))
    await page.locator('.ans-btn').nth(i < 5 ? bonne : (bonne + 1) % textes.length).click()
    await page.waitForSelector('.result-banner')
    const suite = page.locator('.btn-primary.btn-big')
    const texte = await suite.textContent()
    await suite.click()
    if (texte?.includes('Voir ma série')) break
  }
  await page.waitForSelector('.mission-accomplie')
  await page.locator('.mission-accomplie').scrollIntoViewIfNeeded()
  await photo('3-fin-de-serie')
  await photo('3-fin-de-serie-pleine', { pleine: true })

  // 4. De lundi en lundi : chaque semaine ses tampons, et son coffre ouvert acte par acte.
  const donnes: ObjetDuTresor[] = []
  const possede = (o: ObjetDuTresor) => donnes.some(d => cleDeLObjet(d) === cleDeLObjet(o))
  /** Les deux nombres qui font tirer à ce coffre un objet de cette sorte, ce jour-là — à la rareté la plus humble qui en donne : la plus probable. */
  const hasardPour = (rang: RangDuCoffre, sorte: ObjetDuTresor['sorte'], jour: string): [number, number] => {
    for (let r = 0; r < 1; r += 0.01) {
      for (let o = 0; o < 1; o += 0.02) {
        const suite = [r, o]
        const t = tirerLeCoffre(rang, { possede, hasard: () => suite.shift() ?? 0, jour })
        if (t.objet.sorte === sorte) return [r, o]
      }
    }
    throw new Error(`aucun tirage ne donne ${sorte} à un coffre ${rang}`)
  }
  const semaines: { lundi: number; jours: string[]; rang: RangDuCoffre; sorte: ObjetDuTresor['sorte'] }[] = [
    // Le jeudi 15 n'a pas eu son tampon — l'Histoire manquait — : quatre jours de plus, et la semaine est royale.
    { lundi: Date.UTC(2026, 9, 19, 8), jours: ['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'], rang: 'royal', sorte: 'compagnon' },
    { lundi: Date.UTC(2026, 9, 26, 8), jours: ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23'], rang: 'or', sorte: 'fond' },
    { lundi: Date.UTC(2026, 10, 2, 8), jours: ['2026-10-26', '2026-10-28', '2026-10-30'], rang: 'argent', sorte: 'theme' },
    { lundi: Date.UTC(2026, 10, 9, 8), jours: ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'], rang: 'royal', sorte: 'gerbe' },
    { lundi: Date.UTC(2026, 10, 16, 8), jours: ['2026-11-12'], rang: 'bois', sorte: 'confettis' },
  ]
  for (const [i, s] of semaines.entries()) {
    tamponner(s.jours)
    maintenant = s.lundi
    const jour = new Date(s.lundi).toISOString().slice(0, 10)
    const [r, o] = hasardPour(s.rang, s.sorte, jour)
    tirages.splice(0, tirages.length, r, o)
    const n = `4${String.fromCharCode(97 + i)}-${s.rang}-${s.sorte}`
    await page.goto(`${banc.url}/`)
    await page.waitForSelector('.missions-ligne.missions-coffre', { timeout: 15000 }).catch(async (e: Error) => {
      // Ce que la page montre, et ce que le serveur répond : de quoi comprendre un coffre qui ne paraît pas.
      await photo(`${n}-echec`)
      console.error(await page.evaluate(() => fetch('/api/joueur/missions').then(r => r.text())))
      throw e
    })
    if (i === 0) await photo('4-accueil-coffre')
    await page.click('.missions-ligne')
    await page.waitForSelector('.coffre-attend')
    if (i === 0) await photo('4-feuille-coffre')
    await page.click('.coffre-attend')
    await page.waitForSelector('.coffre-scene.coffre-repos')
    await photo(`${n}-1-repos`, { attente: 900 })
    await page.click('.coffre-ouvrir')
    // Sans mouvement, ni charge ni éclair : le coffre s'ouvre en fondu, il n'y a que la révélation à photographier.
    if (!calme) {
      await photo(`${n}-2-charge`, { attente: 1100 })
      await page.waitForSelector('.coffre-eclat', { timeout: 10000 })
      await photo(`${n}-3-eclat`, { attente: 120 })
    }
    await page.waitForSelector('.coffre-revele')
    await photo(`${n}-4-sort`, { attente: 450 })
    await photo(`${n}-5-revele`, { attente: 2200 })
    const ouvert = base(db => db.prepare('SELECT objet, confettis FROM profile_coffres WHERE profile_id = ? ORDER BY semaine DESC LIMIT 1').get(id) as { objet: string; confettis: number })
    console.log(`  ${s.rang} : ${ouvert.objet}${ouvert.confettis ? ` (${ouvert.confettis})` : ''}`)
    const m = /^(\w+):([\w-]+)$/.exec(ouvert.objet)
    if (m) donnes.push({ sorte: m[1], cle: m[2] } as ObjetDuTresor)
    await page.click('.coffre-gestes .btn-ghost')
    await page.waitForSelector('.coffre-scene', { state: 'detached' })
  }
  // 5. Ce que le coffre a donné, dans la loge : le fond du trésor essayé sur sa carte.
  const fond = donnes.find(d => d.sorte === 'fond')
  if (fond && fond.sorte === 'fond') {
    await page.goto(`${banc.url}/profil?essayer=${fond.cle}#fond`)
    await page.waitForSelector('.loge-carte')
    await photo('5-loge-fond-du-tresor', { attente: 1500 })
  }

  // 6. Au QG : le coffre ouvert pour voir, sans rien écrire — le royal, puis un autre d'un toucher.
  const admin = await connexionAnimateur(banc.url)
  const [cleAdmin, valeurAdmin] = admin.split('=')
  await contexte.addCookies([{ name: cleAdmin, value: valeurAdmin, url: banc.url }])
  await page.goto(`${banc.url}/admin#economie`)
  await page.waitForSelector('.qg-coffres')
  await page.locator('.qg-coffres').scrollIntoViewIfNeeded()
  await photo('6-qg-coffres')
  const avant = base(db => (db.prepare('SELECT COUNT(*) AS n FROM profile_coffres').get() as { n: number }).n)
  await page.click('.qg-coffres >> text=Le coffre royal')
  await page.waitForSelector('.coffre-scene.coffre-repos')
  await page.click('.coffre-ouvrir')
  await page.waitForSelector('.coffre-revele')
  await photo('6-qg-apercu', { attente: 2600 })
  await page.click('.coffre-gestes >> text=Encore un')
  await page.waitForSelector('.coffre-scene.coffre-repos')
  await page.click('.coffre-ouvrir')
  await page.waitForSelector('.coffre-revele')
  await photo('6-qg-apercu-encore', { attente: 2600 })
  const apres = base(db => (db.prepare('SELECT COUNT(*) AS n FROM profile_coffres').get() as { n: number }).n)
  if (apres !== avant) throw new Error(`l’aperçu du QG a écrit un coffre (${avant} → ${apres})`)
} finally {
  await navigateur.close()
  await banc.close()
}
