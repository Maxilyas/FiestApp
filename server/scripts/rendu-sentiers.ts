// Les écrans des sentiers du savoir, photographiés au téléphone (360 × 640)
// sur un serveur jetable : la carte des sentiers — sa chance sur chacun, en
// couleur de piste —, un sentier, sa fiche, l'épreuve, sa fin, la révélation
// d'un portrait, le rachat des vies. Le client construit d'abord
// (`npm run build -w client`).
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

const laBase = baseDEssai(960, { categories: [...CATEGORIES] })
const banc = await demarrer({ baseDeLaCampagne: laBase })
const navigateur = await chromium.launch({ headless: true })
try {
  const cookie = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
  const id = ((await (await fetch(`${banc.url}/api/joueur/moi?leger`, { headers: { Cookie: cookie } })).json()) as any).profile.id
  // Une joueuse en route : la forêt au septième palier, le stade au sommet, quelques autres commencés.
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  for (const [branche, paliers] of [['foret', 7], ['stade', 12], ['mythes', 2], ['scene', 5], ['carnaval', 1]] as const) {
    db.prepare('INSERT INTO sentier_acquis (profile_id, branche, paliers, retenu_le) VALUES (?, ?, ?, 1)').run(id, branche, paliers)
  }
  // Et son passé en campagne, de quoi dire sa chance sur chaque sentier : forte
  // en sport, fâchée avec la musique, et la nature qui monte depuis une semaine.
  // Des faciles et des expertes : les moyennes et les difficiles de la forêt
  // restent neuves pour ses épreuves.
  {
    const JOUR = 86_400_000
    const maintenant = Date.now()
    const serie = db.prepare(`INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode) VALUES (?, ?, '[]', 0, 0, 0, ?, ?, 'serie')`)
    const reponse = db.prepare('INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le) VALUES (?, ?, ?, 0, ?, ?)')
    const passe: [string, number, number, number, number][] = [
      // catégorie, il y a combien de jours, combien, dont justes, à partir de la combientième
      ['Nature', 10, 24, 9, 0],
      ['Nature', 2, 14, 12, 24],
      ['Sport', 4, 30, 26, 0],
      ['Musique', 3, 24, 6, 0],
      ['Histoire', 3, 12, 8, 0],
    ]
    passe.forEach(([categorie, jours, combien, justes, depuis], k) => {
      const quand = maintenant - jours * JOUR
      serie.run(`passe-${k}`, id, quand, quand + 3_600_000)
      const questions = laBase.questions.filter(q => q.meta.categorie === categorie && [1, 2, 5].includes(q.meta.difficulte)).slice(depuis, depuis + combien)
      questions.forEach((q, i) => reponse.run(`passe-${k}`, i, q.id, i < justes ? 1 : 0, quand + i * 20_000))
    })
  }
  db.close()
  // Le modèle du savoir : la page le lance en fond à sa première lecture, et ne dit sa chance qu'une fois ajusté.
  await fetch(`${banc.url}/api/campagne/sentiers`, { headers: { Cookie: cookie } })
  for (let essai = 0; essai < 200; essai++) {
    const sante = (await (await fetch(`${banc.url}/healthz`)).json()) as { campagne?: { savoir?: { ajusteLe: number | null } } }
    if (sante.campagne?.savoir?.ajusteLe) break
    await new Promise(rendre => setTimeout(rendre, 50))
  }

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

  // Rien de commencé : les règles, les vies, et le geste qui mène aux tuiles.
  const neo = await inscrireProfil(banc.url, 'neo', 'Néo', '🦉')
  const premiers = await navigateur.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 })
  const [nomN, valeurN] = neo.split('=')
  await premiers.addCookies([{ name: nomN, value: valeurN, url: banc.url }])
  const premierePage = await premiers.newPage()
  if (ivoire) await ecrire(banc.url, '/api/joueur/moi', { theme: 'ivoire' }, neo, 'PUT')
  await premierePage.goto(`${banc.url}/campagne#sentiers`)
  await premierePage.waitForSelector('.sentiers-haut-sans')
  await premierePage.waitForTimeout(600)
  await premierePage.screenshot({ path: path.join(sortie, '0-premier-pas.png') })
  console.log(path.join(sortie, '0-premier-pas.png'))
  await premiers.close()

  // Le haut des sentiers : la forêt en panorama, les règles en entier — ses paliers repris ne lui ont rien fait jouer.
  await page.goto(`${banc.url}/campagne#sentiers`)
  await page.waitForSelector('.sentiers-grille .sentiers-tuile:not(.sentiers-tuile-vide)')
  await page.waitForSelector('.sentiers-haut .pano')
  await photo('1-carte')
  await photo('1-carte-entiere', true)

  // Une tuile touchée : son sentier monte dans le bloc, on n'y entre pas encore.
  await page.click('.sentiers-tuile >> text=Les océans')
  await page.waitForSelector('.sentiers-haut .label >> text=Les océans')
  await photo('1-carte-oceans')
  // La forêt touchée la remonte ; le bouton du bloc y entre.
  await page.click('.sentiers-tuile >> text=La forêt')
  await page.waitForSelector('.sentiers-haut .label >> text=La forêt')
  await page.click('.sentiers-haut .btn-primary')
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

  // Le palier 9 n'ouvre rien : sous lui, ce qui l'attend après — puis « Palier validé », ses étoiles.
  await page.click('text=Continuer le sentier')
  await page.waitForSelector('.sentier-chemin')
  await photo('2-sentier-palier-9')
  await palierSuivant()
  await jouer(15)
  await page.waitForSelector('.epreuve-fin-tete')
  await photo('7-validee')
  await photo('7-validee-entiere', true)

  // Raté : la faute de trop (la septième, à 10 sur 16), d'affilée.
  await page.click('text=Retour au sentier')
  await palierSuivant()
  await jouer(3, { 7: '8-rate-reponse' })
  await page.waitForSelector('.epreuve-perte')
  await photo('8-rate')
  await photo('8-rate-entier', true)

  // L'accueil : le bouton de la campagne. Elle a joué la campagne : son carnet,
  // puis le défi de la semaine, passent devant le sentier qu'on avance tant
  // qu'il reste à revoir ou à relever (`boutonDeLaCampagne`, depuis le
  // 12 octobre 2026 — l'étape attendait le bouton des sentiers, et le rendu
  // s'arrêtait là).
  await page.goto(`${banc.url}/`)
  await page.waitForSelector('.gros-bouton[href^="/campagne"]')
  await photo('8-accueil')
  // La campagne ouverte sur ses sentiers — ses onglets, le sentier en tête —, jamais un sentier seul.
  await page.goto(`${banc.url}/campagne#sentiers`)
  await page.waitForSelector('.onglets-campagne')
  await page.waitForSelector('.sentiers-haut .pano')
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
  await page.waitForSelector('.pano-racheter')
  await page.click('.pano-racheter')
  await page.waitForSelector('.vies-achat')
  await photo('10-vies')

  // La série, onglet voisin.
  await page.goto(`${banc.url}/campagne`)
  await page.waitForSelector('.campagne-heros')
  await photo('11-serie')

  // La boutique, d'un seul tenant : les thèmes en tête, puis, par sa puce, le
  // comptoir des objets, où se vend la vie des sentiers (`RayonDesObjets`).
  await page.goto(`${banc.url}/boutique`)
  await page.waitForSelector('.boutique-rayons')
  await page.waitForSelector('.etagere .theme-vitrine')
  await photo('12-boutique-themes')
  await page.click('.boutique-rayons a:has-text("Objets")')
  await page.waitForSelector('.comptoir .comptoir-objet')
  await page.waitForTimeout(700)
  await photo('12-boutique-objets')

  // Les avatars du savoir, dans l'album de « Ma collection » : le visage de chaque sentier, sur la page commune.
  await page.goto(`${banc.url}/profil#collection-avatars-commune`)
  await page.waitForSelector('.album-avatars')
  await photo('13-avatars', true)

  // L'administration des sentiers — avec un rejeu, compté à part : le premier
  // palier de la forêt, repris des portraits d'avant, joué pour la première fois.
  let rejeu = (await (await ecrire(banc.url, '/api/campagne/sentiers/epreuve', { branche: 'foret', palier: 1 }, cookie)).json()) as any
  while (!rejeu.finie && rejeu.question) {
    const choix = rejeu.question.reponses.findIndex((r: string) => r.startsWith('Bonne'))
    rejeu = ((await (await ecrire(banc.url, `/api/campagne/epreuve/${rejeu.id}/reponse`, { index: rejeu.question.index, choix }, cookie)).json()) as any).epreuve
  }
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
  await page.click('button.identite-ligne')
  // C'est la carte ouverte, à fond, qu'on attend.
  await page.waitForSelector('.carte-joueur .carte-fond')
  await page.waitForTimeout(800)
  await photo('15-carte-cabinet')
  await page.goto(`${banc.url}/campagne#sentier-stade`)
  await page.waitForSelector('.sentier-chemin')
  await page.click('.palier-maitre')
  await page.waitForSelector('.maitres-recompenses')
  await page.locator('.maitres-recompenses').scrollIntoViewIfNeeded()
  await photo('16-maitres')

  // Trois paliers gagnés en jouant : les règles se replient sous « Comment ça marche ? ».
  await page.goto(`${banc.url}/campagne#sentiers`)
  await page.waitForSelector('.sentiers-haut details.pano-regles')
  await photo('17-haut-replie')
  await page.click('.pano-regles > summary')
  await photo('17-haut-deplie')

  // Une épreuve laissée en route : son sentier en panorama, et la reprendre.
  let laissee = (await (await ecrire(banc.url, '/api/campagne/sentiers/epreuve', { branche: 'foret', palier: 10 }, cookie)).json()) as any
  for (const juste of [true, true, false]) {
    const bonne = laissee.question.reponses.findIndex((r: string) => r.startsWith('Bonne'))
    const choix = juste ? bonne : (bonne + 1) % laissee.question.reponses.length
    laissee = ((await (await ecrire(banc.url, `/api/campagne/epreuve/${laissee.id}/reponse`, { index: laissee.question.index, choix }, cookie)).json()) as any).epreuve
  }
  // La même adresse ne recharge pas la page : l'état des sentiers doit se relire.
  await page.goto(`${banc.url}/campagne#sentiers`)
  await page.reload()
  await page.waitForSelector('.sentiers-haut .pano')
  await photo('18-haut-laissee')
} finally {
  await navigateur.close()
  await banc.close()
}
