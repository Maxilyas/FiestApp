// Les familles en façons de répondre (la version 14 du départ, le 20 octobre
// 2026 — l'étape 6 de « La question au centre », `retours/2026-10-20/les-familles.md`),
// photographiées au téléphone (360 × 640) sur un serveur jetable qui ouvre la
// question au centre — le banc la ferme d'office. Rose a joué : une
// expédition abandonnée, sa renommée portée au niveau 10, ses six styles
// ouverts. Au départ, les tuiles des styles et la façon de répondre de
// chacun ; elle part au Rempart, son départ récrit comme le font les tests —
// le premier étage en questions d'Histoire à quatre choix, une graine qui lui
// met Parade en main — : Parade levée (« Tu réponds encore »), jouée, une
// réponse fausse — la bannière du second essai, sa réponse éteinte —, la
// bonne, la révélation ; puis les règles, leur ligne du second essai et les
// six styles. Ce qui élargit la page se dit (`[déborde]`). Le client construit
// d'abord (`npm run build -w client`).
//
//   npx tsx scripts/rendu-familles.ts [dossier] [ivoire]
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { baseDEssai, demarrer, ecrire, inscrireProfil } from '../test/banc'
import { ecrireLeBilan } from '../../shared/codex'
import { pliDeLExpedition, type DepartDExpedition } from '../../shared/expedition'

const sortie = path.resolve(process.argv[2] ?? 'rendu-familles')
const ivoire = process.argv.includes('ivoire')
mkdirSync(sortie, { recursive: true })

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'rendu.js'))('playwright')
}
const { chromium } = chargerPlaywright()

const banc = await demarrer({ baseDeLaCampagne: baseDEssai(240, { categories: ['Histoire'] }), questionAuCentre: true })
const navigateur = await chromium.launch({ headless: true })
try {
  const rose = await inscrireProfil(banc.url, 'rose', 'Rose', '🦉')
  if (ivoire) await ecrire(banc.url, '/api/joueur/moi', { theme: 'ivoire' }, rose, 'PUT')
  const db = () => new Database(banc.quizDbUrl.replace(/^file:/, ''))
  // Rose a déjà joué : une expédition abandonnée, dont le bilan la porte au niveau 10 — les six styles ouverts.
  {
    const partie = (await (await ecrire(banc.url, '/api/expedition', { rencontres: true, questionAuCentre: true }, rose)).json()) as { id: string }
    await ecrire(banc.url, `/api/expedition/${partie.id}/abandon`, {}, rose)
    const d0 = db()
    try {
      d0.prepare('UPDATE campagne_series SET bilan = ? WHERE id = ?').run(
        ecrireLeBilan({ escales: 300, adversaires: 150, elites: 40, gardiens: 20, auBout: true, exploits: ['pari-de-40', 'gardien-intact'], ascension: 1 }),
        partie.id,
      )
    } finally {
      d0.close()
    }
  }

  const contexte = await navigateur.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 })
  const [nom, valeur] = rose.split('=')
  await contexte.addCookies([{ name: nom, value: valeur, url: banc.url }])
  const page = await contexte.newPage()
  page.on('pageerror', (e: Error) => console.error('[page] Rose :', e.message))
  const photo = async (nomFichier: string, pleine = false) => {
    await page.waitForTimeout(450)
    const chemin = path.join(sortie, `${nomFichier}.png`)
    await page.screenshot({ path: chemin, fullPage: pleine })
    console.log(chemin)
  }
  /** Ce qui déborde de côté : rien ne doit élargir la page (règle `css.md`). */
  const largeur = async (ou: string) => {
    const l = Number(await page.evaluate('document.documentElement.scrollWidth'))
    if (l > 360) console.error(`[déborde] ${ou} : ${l} pixels de large`)
  }

  // Le départ : les six styles, et la façon de répondre de chacun.
  await page.goto(`${banc.url}/expedition`)
  await page.waitForSelector('.exp-un-style')
  await largeur('le départ')
  await photo('1-depart', true)
  for (const [i, s] of ['devin', 'metamorphe', 'erudit', 'flambeur', 'elan', 'rempart'].entries()) {
    const tuile = page.locator('.exp-un-style').nth(i)
    if (!(await tuile.count())) {
      console.error(`[rendu] Rose : pas de tuile ${i + 1} (${s})`)
      continue
    }
    await tuile.click()
    await page.locator('.exp-style').screenshot({ path: path.join(sortie, `1-style-${i + 1}.png`) })
    console.log(path.join(sortie, `1-style-${i + 1}.png`))
  }
  // Elle part au Rempart : la dernière tuile choisie.
  await page.locator('.exp-depart-pied .btn-primary').first().click()
  await page.waitForSelector('.exp-plan')
  const partie = ((await (await fetch(`${banc.url}/api/expedition`, { headers: { Cookie: rose } })).json()) as { expedition: { id: string } }).expedition
  {
    const d0 = db()
    try {
      const d = JSON.parse((d0.prepare('SELECT expedition FROM campagne_series WHERE id = ?').get(partie.id) as { expedition: string }).expedition) as DepartDExpedition
      if (d.style !== 'rempart') console.error(`[rendu] Rose : partie au style ${d.style}, pas au Rempart`)
      d.style = 'rempart'
      for (const e of d.cartes[0].escales) {
        if (e.etage !== 0) continue
        for (const cle of ['curiosite', 'chance'] as const) delete e[cle]
        Object.assign(e, { sorte: 'question', theme: { categories: ['Histoire'] }, forme: 'quatre', chance: 0.7 })
      }
      // Une graine qui ouvre la main de l'acte sur Parade : cherchée par le vrai pli, comme les tests.
      d.graine = Array.from({ length: 2000 }, (_, k) => `rendu:familles:${k}`).find(g => pliDeLExpedition({ ...d, graine: g }, [], [], new Map()).cycle?.main.includes('parade')) ?? d.graine
      d0.prepare('UPDATE campagne_series SET expedition = ? WHERE id = ?').run(JSON.stringify(d), partie.id)
    } finally {
      d0.close()
    }
  }
  await banc.redemarrer()
  /** La question gardée à ce rang, bonne réponse comprise : ce que seul le serveur sait. */
  const gardee = (): { reponses: string[]; bonne: number } => {
    const d0 = db()
    try {
      const qs = JSON.parse((d0.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(partie.id) as { questions: string }).questions)
      return qs[qs.length - 1]
    } finally {
      d0.close()
    }
  }

  await page.goto(`${banc.url}/expedition`)
  await page.waitForSelector('.exp-plan, .exp-depart-pied')
  if (!(await page.locator('.exp-plan').count())) await page.locator('.exp-depart-pied .btn-primary').first().click()
  await page.waitForSelector('.exp-plan')
  await page.locator('.exp-carte-escale').first().click()
  await page.locator('.exp-panneau > .btn-primary').click()
  // Les règles s'ouvrent d'elles-mêmes à la première rencontre ; puis l'annonce — le pari ouvert —, sans miser.
  await page.waitForSelector('.feuille-regles, .exp-voir, .ans-btn')
  if (await page.locator('.feuille-regles').count()) {
    await photo('2-regles', true)
    await page.locator('.feuille-regles .carte-pied .btn-primary').click()
  }
  if (await page.locator('.exp-voir').count()) await page.locator('.exp-voir').click()
  await page.waitForSelector('.ans-btn')
  await largeur('la question')
  await photo('3-question')
  // Parade, levée : ce qu'elle promet ; jouée, l'aperçu le redit.
  const parade = page.locator('.exp-cartes .exp-face:not(.exp-face-eteinte)[data-carte^="parade"]')
  if (!(await parade.count())) throw new Error('Rose : pas de Parade en main')
  await parade.first().click()
  await page.waitForSelector('.exp-leve')
  await photo('4-parade-levee')
  await page.locator('.exp-leve .btn-primary').click()
  await page.waitForTimeout(400)
  await photo('5-parade-jouee', true)
  // Une réponse fausse : la question ne se juge pas, sa réponse s'éteint, et il répond encore.
  const q = gardee()
  const textes: string[] = await page.$$eval('.ans-btn .ans-text', (els: any[]) => els.map(e => String(e.textContent ?? '').trim()))
  const bonne = textes.findIndex(t => t === q.reponses[q.bonne].trim())
  const fausse = textes.findIndex((_, i) => i !== bonne)
  await page.locator('.ans-btn').nth(fausse).click()
  await page.waitForSelector('.exp-essai')
  await largeur('le second essai')
  await photo('6-second-essai')
  await photo('6-second-essai-entier', true)
  // La bonne, au second essai : jugée, aidée.
  await page.locator('.ans-btn').nth(bonne).click()
  await page.waitForSelector('.result-banner')
  await largeur('la révélation')
  await photo('7-revelation', true)
  // Les règles, au « ? » : le second essai et les six styles.
  await page.locator('.result-banner ~ .btn-primary.btn-big').click()
  await page.waitForTimeout(400)
  const aide = page.locator('.exp-barre .exp-regles-bouton, .exp-barre button[aria-label*="règles" i]').first()
  if (await aide.count()) {
    await aide.click()
    await page.waitForSelector('.feuille-regles')
    await photo('8-regles-au-point-d-interrogation', true)
  } else console.error('[rendu] Rose : pas de « ? » dans la barre')
  await contexte.close()
} finally {
  await navigateur.close()
  await banc.close()
}
