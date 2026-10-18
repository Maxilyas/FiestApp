// Le prototype des rencontres (la version 5 du départ d'une expédition, le
// 18 octobre 2026), photographié au téléphone (360 × 640) sur un serveur
// jetable : le départ et son interrupteur, la catégorie fétiche et sa feuille,
// l'équipée et les cartes des rencontres dépliées ; la carte de l'acte et ses
// cartes de route en petit ; une rencontre — l'adversaire, l'annonce,
// l'aperçu, la mise, la main de cinq cartes, une carte levée, ses tas —, puis
// la question vue et ses réflexes, une bonne réponse qui brise, une erreur
// que la Garde amortit, l'adversaire qui tombe et sa carte à prendre ; un
// coffre, le campement, l'échoppe s'il s'en trouve une ; le gardien, vaincu,
// et l'acte suivant. Il joue juste deux fois sur trois.
// Le client construit d'abord (`npm run build -w client`).
//
// Léa a quatre légendaires, rangés comme gardés au bout d'expéditions
// passées : elle part avec le Dragon d'Or et Janus — le Flambeur et le
// Métamorphe — ; le Lion et le Phénix restent à choisir.
//
//   npx tsx scripts/rendu-rencontres.ts [dossier] [ivoire]
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { baseDEssai, demarrer, ecrire, inscrireProfil } from '../test/banc'
import { CATEGORIES } from '../../shared/categories'
import { cleDeLExpedition } from '../../shared/legendaires'

const sortie = path.resolve(process.argv[2] ?? 'rendu-rencontres')
const ivoire = process.argv.includes('ivoire')
mkdirSync(sortie, { recursive: true })

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'rendu.js'))('playwright')
}
const { chromium } = chargerPlaywright()

const SIENS = ['lg:dragon', 'lg:janus', 'lg:lion', 'lg:phenix']

// Quatre-vingts questions par catégorie, de toutes les difficultés : de quoi tirer trois actes et leurs gardiens.
const banc = await demarrer({ baseDeLaCampagne: baseDEssai(960, { categories: [...CATEGORIES] }) })
const navigateur = await chromium.launch({ headless: true })
try {
  const cookie = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
  if (ivoire) await ecrire(banc.url, '/api/joueur/moi', { theme: 'ivoire' }, cookie, 'PUT')
  const id = ((await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: cookie } })).json()) as any).profile.id
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    const ranger = db.prepare(`INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, ?, '#campagne:rendu', '', '🧭', 'rendu', 1)`)
    for (const cle of SIENS) ranger.run(id, cleDeLExpedition(cle))
  } finally {
    db.close()
  }
  // Relus au démarrage : le profil sait ce qu'il a.
  await banc.redemarrer()
  const contexte = await navigateur.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 })
  const [nom, valeur] = cookie.split('=')
  await contexte.addCookies([{ name: nom, value: valeur, url: banc.url }])
  const page = await contexte.newPage()
  page.on('pageerror', (e: Error) => console.error('[page]', e.message))
  const photo = async (nomFichier: string, pleine = false) => {
    await page.waitForTimeout(500)
    await page.screenshot({ path: path.join(sortie, `${nomFichier}.png`), fullPage: pleine })
    console.log(path.join(sortie, `${nomFichier}.png`))
  }
  const fait = new Set<string>()
  /** Une photo, la première fois seulement. */
  const unePhoto = async (nomFichier: string, pleine = false) => {
    if (fait.has(nomFichier)) return
    fait.add(nomFichier)
    await photo(nomFichier, pleine)
  }
  /** Ce qui déborde de côté : rien ne doit élargir la page (règle `css.md`). */
  const largeur = async (ou: string) => {
    const l = await page.evaluate('document.documentElement.scrollWidth')
    if (Number(l) > 360) console.error(`[déborde] ${ou} : ${l} pixels de large`)
  }

  // Le départ : le prototype proposé d'office, sa catégorie fétiche à choisir.
  await page.goto(`${banc.url}/expedition`)
  await page.waitForSelector('.exp-prototype')
  await photo('1-depart')
  await photo('1-depart-entier', true)
  await page.locator('.exp-prototype .exp-changer').click()
  await page.waitForSelector('.feuille-fetiche')
  await photo('1b-fetiche')
  await page.locator('.exp-fetiche', { hasText: 'Histoire' }).click()
  await page.locator('.feuille-fetiche .carte-pied .btn-primary').click()
  // L'équipée : le Dragon et Janus, leurs cartes et leurs familles ; toutes les cartes des rencontres dépliées.
  await page.locator('.exp-equipee .exp-changer').click()
  await page.waitForSelector('.feuille-equipee')
  const partants = page.locator('.exp-equipable[aria-pressed="true"]')
  while (await partants.count()) await partants.first().click()
  for (const n of ['Dragon', 'Janus']) await page.locator('.exp-equipable', { hasText: n }).first().click()
  await photo('1c-equipee')
  await page.click('.exp-tous')
  await page.locator('#exp-toutes-les-cartes').scrollIntoViewIfNeeded()
  await photo('1d-toutes-les-cartes')
  await page.locator('.feuille-equipee .carte-pied .btn-primary').click()
  await page.waitForTimeout(200)
  await photo('1e-depart-pret', true)
  await page.click('.exp-depart-pied .btn-primary')
  await page.waitForSelector('.exp-plan')
  await largeur('la carte')
  await photo('2-carte')

  const ici = async (): Promise<string> => {
    if (await page.locator('.exp-plan').count()) return 'carte'
    if (await page.locator('.exp-rencontre').count()) return 'preparation'
    if (await page.locator('.exp-offre').count()) return 'offre'
    if (await page.locator('.exp-camper').count()) return 'campement'
    if (await page.locator('.exp-echoppe-page').count()) return 'echoppe'
    if (await page.locator('.exp-inconnu').count()) return 'inconnu'
    if (await page.locator('.result-banner').count()) return 'revelation'
    if (await page.locator('.ans-btn').count()) return 'question'
    if (await page.locator('.exp-vaincu').count()) return 'vaincu'
    if (await page.locator('.exp-choix').count()) return 'choix'
    if (await page.locator('.exp-fin-tete').count()) return 'fin'
    return 'autre'
  }

  /** Une carte de la main qui se joue : la première de ces clés, qui n'est pas éteinte ; levée, photographiée une fois, puis jouée. */
  const jouerUneCarte = async (cles: string[], photoDeLaLevee?: string): Promise<boolean> => {
    for (const cle of cles) {
      const carte = page.locator(`.exp-main-rencontre:not(.exp-main-en-petit) .exp-carte-rencontre[data-carte="${cle}"]:not(.exp-refuse)`).first()
      if (!(await carte.count())) continue
      await carte.click()
      await page.waitForSelector('.exp-leve')
      await page.waitForTimeout(300)
      if (photoDeLaLevee) await unePhoto(photoDeLaLevee)
      await page.locator('.exp-leve .btn-primary').click()
      await page.waitForTimeout(350)
      return true
    }
    return false
  }

  /** Répond à la question à l'écran : juste, ou une autre qui n'est pas effacée. */
  const repondre = async (juste: boolean) => {
    await page.waitForSelector('.ans-btn')
    const textes: string[] = await page.$$eval('.ans-btn .ans-text', (els: any[]) => els.map(e => String(e.textContent ?? '')))
    const effacees: boolean[] = await page.$$eval('.ans-btn', (els: any[]) => els.map(e => e.classList.contains('exp-effacee')))
    const proposee = (await page.locator('.exp-proposee b').count()) > 0 ? String(await page.locator('.exp-proposee b').textContent()) : null
    const bonne = proposee === null ? textes.findIndex(t => t.startsWith('Bonne')) : textes.indexOf(proposee.includes('Bonne') ? 'Vrai' : 'Faux')
    const fausse = textes.findIndex((t, i) => i !== bonne && !effacees[i])
    if ((await page.locator('.exp-consigne', { hasText: 'Double chance' }).count()) > 0) {
      await page.locator('.ans-btn').nth(juste ? bonne : fausse).click()
      await page.locator('.ans-btn').nth(textes.findIndex((t, i) => i !== bonne && i !== fausse && !effacees[i])).click()
      await page.locator('.quiz-player > .btn-primary').click()
    } else await page.locator('.ans-btn').nth(juste ? bonne : fausse).click()
    await page.waitForSelector('.result-banner')
  }

  let questions = 0
  for (let tour = 0; tour < 260; tour++) {
    const ou = await ici()
    if (ou === 'fin' || ou === 'choix') {
      await unePhoto(`9-${ou}`, true)
      break
    }
    if (ou === 'carte') {
      if (await page.locator('.exp-panneau .exp-carte-rencontre').count()) await unePhoto('2b-carte-route')
      if (await page.locator('.exp-panneau-titre').count()) await unePhoto('6-avant-le-gardien')
      // Le paquet, touché depuis la carte : tout ce qu'il a, et la règle du cycle.
      if (!fait.has('2c-paquet')) {
        await page.locator('.exp-panneau .exp-pioche').click()
        await page.waitForSelector('.feuille-paquet')
        await unePhoto('2c-paquet')
        await page.locator('.feuille-paquet .carte-fermer').click()
      }
      // Une rencontre d'abord, puis ce qu'il n'a pas encore vu : un coffre, une échoppe, une source.
      for (const sorte of ['question', 'coffre', 'echoppe', 'source', 'elite']) {
        const la = page.locator(`.exp-carte-escale.exp-${sorte}`).first()
        if (!fait.has(`vu-${sorte}`) && (await la.count())) {
          fait.add(`vu-${sorte}`)
          await la.click()
          break
        }
      }
      if (!(await page.locator('.exp-carte-escale[aria-pressed="true"]').count())) await page.locator('.exp-carte-escale').first().click()
      await page.locator('.exp-panneau > .btn-primary').click()
      await page.waitForTimeout(300)
      continue
    }
    if (ou === 'preparation') {
      await largeur('la préparation')
      const gardien = (await page.locator('.exp-adversaire-gardien').count()) > 0
      await unePhoto(gardien ? '7-gardien-preparation' : '3-preparation')
      if (!fait.has('3b-tas')) {
        await page.locator('.exp-main-rencontre .exp-pioche').click()
        await page.waitForSelector('.feuille-paquet')
        await unePhoto('3b-tas')
        await page.locator('.feuille-paquet .carte-fermer').click()
      }
      // Ses cartes de préparation, une par une, tant qu'il en a : la Charge, la Garde, la forme, la mise.
      for (let k = 0; k < 3; k++) {
        if (!(await jouerUneCarte(['corser', 'simplifier', 'concentration', 'prudence', 'tresor', 'doubler-la-mise'], '3c-carte-levee'))) break
      }
      await unePhoto('3d-preparee')
      // Il mise dix écus quand il le peut : l'aperçu le dit.
      const dix = page.locator('.exp-mise:not(.exp-refuse)', { hasText: '10' })
      if (await dix.count()) {
        await dix.first().click()
        await unePhoto('3e-mise')
      }
      await page.locator('.exp-voir').click()
      await page.waitForTimeout(300)
      continue
    }
    if (ou === 'question') {
      await largeur('la question')
      await unePhoto(questions === 0 ? '4-question' : '4-question-suivante')
      await jouerUneCarte(['coup-d-oeil', 'deux-visages', 'echange'], '4b-reflexe-leve')
      if (await page.locator('.exp-visages').count()) await page.locator('.exp-visages .pill-btn').first().click()
      await unePhoto('4c-reflexe-joue')
      questions++
      await repondre(questions % 3 !== 0)
      continue
    }
    if (ou === 'revelation') {
      const juste = (await page.locator('.result-banner.result-ok').count()) > 0
      const tombe = (await page.locator('.exp-adversaire-tombe').count()) > 0
      await unePhoto(tombe ? '5c-il-tombe' : juste ? '5-juste' : '5b-faux', true)
      await page.locator('.result-banner ~ .btn-primary.btn-big').click()
      await page.waitForTimeout(300)
      continue
    }
    if (ou === 'offre') {
      const coffre = (await page.locator('.exp-offre .exp-surtitre', { hasText: 'coffre' }).count()) > 0
      await unePhoto(coffre ? '8-coffre' : '5d-carte-a-prendre', true)
      await page.locator('.exp-offre-ligne').first().click()
      await page.locator('.exp-offre .exp-depart-pied .btn-primary').click()
      await page.waitForTimeout(300)
      continue
    }
    if (ou === 'campement') {
      await unePhoto('6b-campement')
      await page.locator('.exp-camper .exp-depart-pied .btn-primary').click()
      await page.waitForTimeout(300)
      continue
    }
    if (ou === 'echoppe') {
      await unePhoto('8b-echoppe', true)
      await page.locator('.exp-echoppe-page .btn-ghost').click()
      await page.waitForTimeout(300)
      continue
    }
    if (ou === 'inconnu' || ou === 'vaincu') {
      await unePhoto(ou === 'vaincu' ? '7b-gardien-vaincu' : '8c-inconnu')
      await page.locator('.btn-primary.btn-big').last().click()
      await page.waitForTimeout(300)
      continue
    }
    console.error(`[rendu] écran inconnu au tour ${tour}`)
    break
  }
  await contexte.close()
} finally {
  await navigateur.close()
  await banc.close()
}
