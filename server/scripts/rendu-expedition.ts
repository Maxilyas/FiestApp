// Les écrans de l'Expédition, photographiés au téléphone (360 × 640) sur un
// serveur jetable : le départ et ses gardiens, la carte d'un acte — sa chance
// sur chaque escale, le tracé le plus sûr, puis un autre —, une escale et sa
// révélation, le campement, le gardien et ses crans, le gardien vaincu, la
// carte de l'acte suivant, le choix au bout, la fin et ses gains ; puis une
// expédition perdue, et la page d'un invité sans profil. Le client construit
// d'abord (`npm run build -w client`).
//
//   npx tsx scripts/rendu-expedition.ts [dossier] [ivoire]
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { baseDEssai, demarrer, ecrire, inscrireProfil } from '../test/banc'
import { CATEGORIES } from '../../shared/categories'

const sortie = path.resolve(process.argv[2] ?? 'rendu-expedition')
const ivoire = process.argv.includes('ivoire')
mkdirSync(sortie, { recursive: true })

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'rendu.js'))('playwright')
}
const { chromium } = chargerPlaywright()

// Quatre-vingts questions par catégorie, de chaque difficulté : de quoi tirer trois actes et leurs gardiens.
const banc = await demarrer({ baseDeLaCampagne: baseDEssai(960, { categories: [...CATEGORIES] }) })
const navigateur = await chromium.launch({ headless: true })
try {
  const contexteDe = async (cookie: string | null) => {
    const contexte = await navigateur.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 })
    if (cookie) {
      const [nom, valeur] = cookie.split('=')
      await contexte.addCookies([{ name: nom, value: valeur, url: banc.url }])
    }
    const page = await contexte.newPage()
    page.on('pageerror', (e: Error) => console.error('[page]', e.message))
    return { contexte, page }
  }
  const photographe = (page: any) => async (nomFichier: string, pleine = false) => {
    await page.waitForTimeout(600)
    await page.screenshot({ path: path.join(sortie, `${nomFichier}.png`), fullPage: pleine })
    console.log(path.join(sortie, `${nomFichier}.png`))
  }

  // Sans profil : la page le dit, et propose de se connecter.
  {
    const { contexte, page } = await contexteDe(null)
    await page.goto(`${banc.url}/expedition`)
    await page.waitForSelector('.expedition .btn-primary')
    await photographe(page)('0-sans-profil')
    await contexte.close()
  }

  const cookie = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
  if (ivoire) await ecrire(banc.url, '/api/joueur/moi', { theme: 'ivoire' }, cookie, 'PUT')
  const { page } = await contexteDe(cookie)
  const photo = photographe(page)

  // Le départ : les trois gardiens, un par acte.
  await page.goto(`${banc.url}/expedition`)
  await page.waitForSelector('.exp-gardiens')
  await photo('1-depart')

  // La carte de l'acte 1 : le tracé le plus sûr d'abord.
  await page.click('.exp-depart-pied .btn-primary')
  await page.waitForSelector('.exp-carte')
  await photo('2-carte')
  await photo('2-carte-entiere', true)

  // Une escale touchée hors du tracé : il se redessine par elle.
  const horsDuTrace = page.locator('.exp-escale:not(.exp-tracee):not(.exp-loin):not(.exp-gardien):not(.exp-campement)').first()
  if (await horsDuTrace.count()) {
    await horsDuTrace.click()
    await photo('3-trace-retouche')
  }

  /** Répond à la question à l'écran : juste, ou la réponse d'à côté. */
  const repondre = async (juste: boolean) => {
    await page.waitForSelector('.ans-btn')
    const textes: string[] = await page.$$eval('.ans-btn .ans-text', (els: any[]) => els.map(e => String(e.textContent ?? '')))
    const bonne = textes.findIndex(t => t.startsWith('Bonne'))
    await page.locator('.ans-btn').nth(juste ? bonne : (bonne + 1) % textes.length).click()
    await page.waitForSelector('.result-banner')
  }
  const suite = async () => {
    await page.locator('.result-banner ~ .btn-primary.btn-big').click()
    await page.waitForTimeout(250)
  }
  const avancer = async () => {
    await page.locator('.exp-panneau .btn-primary').click()
    await page.waitForTimeout(250)
  }
  const ici = async () =>
    (await page.locator('.exp-carte').count())
      ? 'carte'
      : (await page.locator('.ans-btn').count())
        ? 'question'
        : (await page.locator('.exp-vaincu').count())
          ? 'vaincu'
          : (await page.locator('.exp-choix').count())
            ? 'choix'
            : (await page.locator('.exp-fin-tete').count())
              ? 'fin'
              : 'autre'

  /**
   * Joue un acte jusqu'à son gardien vaincu — ou jusqu'à la fin : `fautes`
   * dit, question après question, s'il se trompe ; les photos tombent aux
   * moments nommés.
   */
  const jouerLActe = async (
    fautes: (n: number) => boolean,
    photos: { escale?: string; revelation?: string; campement?: string; gardien?: string; gardienRevele?: string; derniere?: string } = {},
  ) => {
    let n = 0
    for (let tour = 0; tour < 60; tour++) {
      const ou = await ici()
      if (ou === 'vaincu' || ou === 'fin' || ou === 'choix') return ou
      if (ou === 'carte') {
        const auCampement = (await page.locator('.exp-panneau-titre').count()) > 0
        if (auCampement && photos.campement) {
          await photo(photos.campement)
          photos.campement = undefined
        }
        await avancer()
        continue
      }
      if (ou === 'question') {
        const auGardien = (await page.locator('.exp-gardien-tete').count()) > 0
        if (auGardien && photos.gardien) {
          await photo(photos.gardien)
          photos.gardien = undefined
        }
        if (!auGardien && photos.escale) {
          await photo(photos.escale)
          photos.escale = undefined
        }
        await repondre(!fautes(n++))
        if (!auGardien && photos.revelation) {
          await photo(photos.revelation)
          photos.revelation = undefined
        }
        if (auGardien && photos.gardienRevele) {
          await photo(photos.gardienRevele)
          photos.gardienRevele = undefined
        }
        if (photos.derniere && (await page.locator('.result-banner ~ .btn-primary.btn-big').textContent())?.includes('Voir la fin')) await photo(photos.derniere)
        await suite()
        continue
      }
      await page.waitForTimeout(300)
    }
    throw new Error('l’acte ne finit pas')
  }

  // L'acte 1 : une faute à la deuxième question, une au gardien.
  const acte1 = await jouerLActe(n => n === 1 || n === 7, { escale: '4-escale', revelation: '5-revelation', campement: '6-campement', gardien: '7-gardien', gardienRevele: '8-gardien-revele' })
  if (acte1 !== 'vaincu') throw new Error(`l’acte 1 finit en ${acte1}`)
  await photo('9-vaincu')
  await page.locator('.exp-vaincu .btn-primary').click()
  await page.waitForSelector('.exp-carte')
  await photo('10-acte-2')
  // Les actes 2 et 3 sans faute : le choix au bout.
  for (const acte of [2, 3]) {
    const fin = await jouerLActe(() => false)
    if (fin !== 'vaincu') throw new Error(`l’acte ${acte} finit en ${fin}`)
    await page.locator('.exp-vaincu .btn-primary').click()
  }
  await page.waitForSelector('.exp-choix')
  await photo('11-choix')
  await page.locator('.exp-choix-ligne').nth(1).click()
  await page.locator('.exp-choix > .btn-primary').click()
  await page.waitForSelector('.exp-fin-tete')
  await photo('12-fin')
  await photo('12-fin-entiere', true)

  // Une autre : le départ annonce la suivante ; puis perdue, toutes ratées.
  await page.locator('.fin-actions .btn-primary').click()
  await page.waitForSelector('.exp-gardiens')
  await photo('13-depart-suivant')
  await page.click('.exp-depart-pied .btn-primary')
  await page.waitForSelector('.exp-carte')
  const perdue = await jouerLActe(() => true, { revelation: '14-ratee', derniere: '14-derniere-vie' })
  if (perdue !== 'fin') throw new Error(`l’expédition ratée finit en ${perdue}`)
  await photo('15-perdue', true)
} finally {
  await navigateur.close()
  await banc.close()
}
