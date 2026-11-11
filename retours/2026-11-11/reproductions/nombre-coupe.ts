// Un nombre à milliers qui se coupe en fin de ligne, entre ses groupes (le
// rendu de l'Épingle du Cabinet en 360 × 640, le 11 novembre 2026 : « à plus
// de 2 100 mètres » finissait sa ligne sur « 2 »). Le contenu écrit ses
// milliers d'une espace ordinaire, et rien ne la collait.
//
// Rejoué ici dans la vraie page : une traversée, sa carte du premier acte
// récrite dans la base pour que chaque épreuve soit une Épingle, et le lieu
// montré forcé sur un lieu du contenu qui écrit un nombre — ses textes pris à
// `server/content/cabinet/lieux.json`, posés sur la réponse du serveur (il en
// a tiré un autre du même jeu). Deux photos en 360 × 640 : l'écran tel qu'il
// sort, puis le même, l'espace des milliers rendue ordinaire — l'écran
// d'avant. Puis toutes les largeurs d'un téléphone, de 320 à 430 px : à
// chacune, les nombres qui passent sur deux lignes, avant et après, et les
// deux photos de la première largeur où l'écran d'avant en coupait un.
//
// Ce qu'il a montré, `espacesFines` corrigée (`milliersColles`,
// `shared/typographie.ts`) : à la grotte Chauvet, « il y a environ 36 000
// ans » se coupait dans le récit de 326 à 350 px de large ; au four solaire
// d'Odeillo, « 3 000 °C » de 374 à 380. Après, à aucune largeur. Aucun des
// deux ne tombe sur la coupe à 360 px juste : elle tient au mot près.
//
//   npm run build -w client
//   cd server && [LIEU="Le grand four solaire d'Odeillo"] [QUESTION="…"] npx tsx ../retours/2026-11-11/reproductions/nombre-coupe.ts [dossier]
//
// `QUESTION`, `RECIT` : un texte d'essai à la place de celui du lieu. Sans
// dossier, les photos vont dans `export/rendus/nombre`, que git ignore.
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { demarrer, inscrireProfil } from '../../../server/test/banc'
import { DIX_HEURES } from '../../../server/test/cabinet-banc'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const Database = createRequire(path.join(RACINE, 'server/package.json'))('better-sqlite3')
const { chromium } = createRequire(path.join(spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim(), 'rendu.js'))('playwright')

const sortie = path.resolve(process.argv[2] ?? path.join(RACINE, 'export', 'rendus', 'nombre'))
mkdirSync(sortie, { recursive: true })

interface Lieu {
  nom: string
  theme: string
  date: string
  recit: string
  question: string
}
const lieux = JSON.parse(readFileSync(path.join(RACINE, 'server/content/cabinet/lieux.json'), 'utf8')) as Lieu[]
const voulu = process.env.LIEU ?? 'La grotte Chauvet'
const lieu = lieux.find(l => l.nom === voulu)
if (!lieu) throw new Error(`Aucun lieu « ${voulu} » dans le contenu.`)
const recit = process.env.RECIT ?? lieu.recit
const question = process.env.QUESTION ?? lieu.question
console.log(`le lieu : ${lieu.nom} · ${lieu.date}\n  ${recit}\n  ${question}`)

const depart = Date.now()
const maintenant = () => DIX_HEURES + (Date.now() - depart)
const banc = await demarrer({ horlogeDuJour: maintenant })
const fichier = banc.quizDbUrl.replace(/^file:/, '')
// La carte d'un acte est en 3D : Chromium sans écran la rend par SwiftShader, comme `rendu-traversee.ts`.
const navigateur = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const cookie = await inscrireProfil(banc.url, 'voyageuse', 'Zoé')
const ctx = await navigateur.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' })
const [nom, valeur] = cookie.split('=')
await ctx.addCookies([{ name: nom, value: valeur, url: banc.url }])
const page = await ctx.newPage()
page.setDefaultTimeout(20_000)
page.on('pageerror', (e: Error) => console.error('[page]', e.message))

// Le lieu montré : toute manche d'Épingle que le serveur envoie prend les textes du lieu voulu.
const forcer = (v: any): void => {
  if (Array.isArray(v)) return v.forEach(forcer)
  if (!v || typeof v !== 'object') return
  if (typeof v.recit === 'string' && typeof v.question === 'string' && typeof v.date === 'string') Object.assign(v, { date: lieu.date, theme: lieu.theme, recit, question })
  Object.values(v).forEach(forcer)
}
await page.route('**/api/cabinet/**', async (route: any) => {
  const reponse = await route.fetch()
  let corps: unknown
  try {
    corps = await reponse.json()
  } catch {
    return route.fulfill({ response: reponse })
  }
  forcer(corps)
  await route.fulfill({ response: reponse, json: corps })
})

const toucher = async (texte: RegExp | string) => {
  await page.getByRole('button', { name: texte }).first().click()
  await page.waitForTimeout(650)
}

// Ce qui s'évalue dans la page part en texte : `tsx` y glisserait des `__name` qu'elle ne connaît pas.
/** Chaque nombre à milliers de la manche, et sur combien de lignes il passe : ses boîtes, une par ligne. */
const NOMBRES = `(() => {
  const vus = []
  const marche = document.createTreeWalker(document.querySelector('.cab-manche') ?? document.body, NodeFilter.SHOW_TEXT)
  for (let n = marche.nextNode(); n; n = marche.nextNode()) {
    const re = /\\d{1,3}(?:[ \\u00a0\\u202f]\\d{3})+/g
    for (let m = re.exec(n.data); m; m = re.exec(n.data)) {
      const r = document.createRange()
      r.setStart(n, m.index)
      r.setEnd(n, m.index + m[0].length)
      const lignes = new Set([...r.getClientRects()].filter(b => b.width > 0).map(b => Math.round(b.top)))
      vus.push({ nombre: m[0].replace(/\\u202f/g, '·'), dans: n.parentElement.className.split(' ').pop(), lignes: lignes.size })
    }
  }
  return vus
})()`
/** L'écran d'avant : la même page, l'espace des milliers rendue ordinaire. */
const AVANT = `(() => {
  const marche = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n = marche.nextNode(); n; n = marche.nextNode()) if (/\\d\\u202f\\d{3}/.test(n.data)) n.data = n.data.replace(/(\\d)\\u202f(?=\\d{3})/g, '$1 ')
})()`
/** Et retour à l'écran d'aujourd'hui. */
const APRES = `(() => {
  const marche = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n = marche.nextNode(); n; n = marche.nextNode()) if (/\\d \\d{3}(?!\\d)/.test(n.data)) n.data = n.data.replace(/(\\d) (?=\\d{3}(?!\\d))/g, '$1\\u202f')
})()`
type Vu = { nombre: string; dans: string; lignes: number }
const dire = (quoi: string, vus: Vu[]) =>
  console.log(`  ${quoi} : ${vus.map(v => `« ${v.nombre} » (${v.dans}) ${v.lignes > 1 ? `COUPÉ sur ${v.lignes} lignes` : 'entier'}`).join(' ; ') || 'aucun nombre'}`)
const coupes = (vus: Vu[]) => vus.filter(v => v.lignes > 1).map(v => `${v.nombre} (${v.dans})`)

try {
  await page.goto(`${banc.url}/cabinet`)
  await page.getByRole('button', { name: 'Commencer une traversée' }).waitFor()
  await page.waitForTimeout(1500)
  await toucher('Commencer une traversée')
  await page.waitForTimeout(2500)
  await toucher('Choisir mes trois cartes')
  // Trois cartes qui ne demandent rien avant une manche : Quitte ou double poserait sa question devant l'Épingle.
  await toucher('Voir la carte Coup d’œil')
  await toucher('Prendre cette carte')
  for (const c of [/^Cagnotte/, /^Panacée/]) await toucher(c)
  await toucher(/^Partir/)
  await page.waitForTimeout(3000)

  // La carte du premier acte, récrite : chaque épreuve y devient une Épingle. Le serveur la relit en redémarrant.
  const db = new Database(fichier)
  try {
    const ligne = db.prepare('SELECT id, depart FROM cabinet_traversees ORDER BY commencee_le DESC LIMIT 1').get() as { id: string; depart: string }
    const carte = JSON.parse(ligne.depart)
    for (const e of carte.actes[0].etapes) {
      if (e.sorte !== 'epreuve') continue
      Object.assign(e, { jeu: 'epingle', theme: lieu.theme })
      for (const champ of ['sujet', 'emoji', 'choix']) delete e[champ]
    }
    db.prepare('UPDATE cabinet_traversees SET depart = ? WHERE id = ?').run(JSON.stringify(carte), ligne.id)
  } finally {
    db.close()
  }
  await banc.redemarrer()
  await page.goto(`${banc.url}/cabinet`)
  await page.waitForTimeout(3000)

  await page.locator('.cab-tv-option').first().click()
  await page.waitForTimeout(700)
  await page.locator('.cab-tv-panneau .cab-tv-cta').click()
  await page.waitForTimeout(2200)
  await toucher(/^Commencer/)
  await page.locator('.cab-recit').waitFor()
  await page.waitForTimeout(1500)

  console.log('\n360 × 640')
  await page.screenshot({ path: path.join(sortie, 'epingle-360x640-apres.png') })
  dire('après', await page.evaluate(NOMBRES))
  await page.evaluate(AVANT)
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(sortie, 'epingle-360x640-avant.png') })
  dire('avant', await page.evaluate(NOMBRES))
  await page.evaluate(APRES)

  const largeurs: { largeur: number; avant: string[]; apres: string[] }[] = []
  for (let largeur = 320; largeur <= 430; largeur += 2) {
    await page.setViewportSize({ width: largeur, height: 640 })
    await page.waitForTimeout(120)
    const apres = coupes(await page.evaluate(NOMBRES))
    await page.evaluate(AVANT)
    const avant = coupes(await page.evaluate(NOMBRES))
    const premiere = avant.length > 0 && !largeurs.some(l => l.avant.length)
    if (premiere) await page.screenshot({ path: path.join(sortie, `epingle-${largeur}x640-avant.png`) })
    await page.evaluate(APRES)
    if (premiere) {
      await page.waitForTimeout(120)
      await page.screenshot({ path: path.join(sortie, `epingle-${largeur}x640-apres.png`) })
    }
    largeurs.push({ largeur, avant, apres })
  }
  const ou = (cote: 'avant' | 'apres') => largeurs.filter(l => l[cote].length).map(l => `${l.largeur} px [${l[cote].join(', ')}]`).join(' ; ') || 'à aucune largeur'
  console.log('\nde 320 à 430 px de large, un nombre coupé entre ses groupes :')
  console.log(`  avant : ${ou('avant')}`)
  console.log(`  après : ${ou('apres')}`)
  console.log(`\nles photos : ${sortie}`)
  if (largeurs.some(l => l.apres.length)) process.exitCode = 1
} catch (e) {
  console.error('[rendu]', (e as Error).message.split('\n')[0])
  await page.screenshot({ path: path.join(sortie, 'echec.png') }).catch(() => {})
  // Par le code de sortie de Node, pas `process.exit()` : ce qui vient de s'écrire part d'abord (règle `tests.md`).
  process.exitCode = 1
} finally {
  await navigateur.close()
  await banc.close()
}
