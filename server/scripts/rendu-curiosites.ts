// Les curiosités (la version 12 du départ, le 19 octobre 2026 — l'étape 4 de
// « La question au centre », `retours/2026-10-19/les-curiosites.md`),
// photographiées au téléphone (360 × 640) sur un serveur jetable qui ouvre la
// question au centre — le banc la ferme d'office. Inès part, son départ récrit
// comme le font les tests — un rébus à chaque escale du premier étage, un plat
// au deuxième, un rébus au troisième — : le plan et la carte d'une curiosité,
// la ligne qu'elle dit touchée ; le rébus — ses emojis en grand, ses cases, ses
// tuiles —, composé juste, la révélation et sa lecture, la récompense au choix ;
// le plat, une question de la liste, raté — rien de perdu — ; le second rébus,
// composé faux ; puis « Mes réponses », où le rébus garde ses emojis. Ce qui
// élargit la page se dit (`[déborde]`). Le client construit d'abord (`npm run
// build -w client`).
//
//   npx tsx scripts/rendu-curiosites.ts [dossier] [ivoire]
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { baseDEssai, demarrer, ecrire, inscrireProfil } from '../test/banc'
import { BaseDeLaCampagne, lireLaBase } from '../src/core/baseCampagne'
import { CATEGORIES } from '../../shared/categories'
import { gabaritDe } from '../../shared/lettres'
import type { DepartDExpedition } from '../../shared/expedition'

const sortie = path.resolve(process.argv[2] ?? 'rendu-curiosites')
const ivoire = process.argv.includes('ivoire')
mkdirSync(sortie, { recursive: true })

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'rendu.js'))('playwright')
}
const { chromium } = chargerPlaywright()

// Une base d'essai, et quelques plats de la vraie : ceux de la liste que la curiosité tire.
const PLATS = JSON.parse(readFileSync(new URL('../content/curiosites/plats.json', import.meta.url), 'utf8')) as { id: string }[]
const ids = new Set(PLATS.slice(0, 20).map(p => p.id))
const base = new BaseDeLaCampagne([...baseDEssai(960, { categories: [...CATEGORIES] }).questions, ...lireLaBase().questions.filter(q => ids.has(q.id))])

const banc = await demarrer({ baseDeLaCampagne: base, questionAuCentre: true })
const navigateur = await chromium.launch({ headless: true })
try {
  const ines = await inscrireProfil(banc.url, 'ines', 'Inès', '🦉')
  if (ivoire) await ecrire(banc.url, '/api/joueur/moi', { theme: 'ivoire' }, ines, 'PUT')
  const partie = (await (await ecrire(banc.url, '/api/expedition', { rencontres: true, questionAuCentre: true }, ines)).json()) as { id: string }
  const db = () => new Database(banc.quizDbUrl.replace(/^file:/, ''))
  {
    const d0 = db()
    try {
      const d = JSON.parse((d0.prepare('SELECT expedition FROM campagne_series WHERE id = ?').get(partie.id) as { expedition: string }).expedition) as DepartDExpedition
      for (const e of d.cartes[0].escales) {
        if (e.etage > 2) continue
        for (const cle of ['theme', 'forme', 'chance'] as const) delete e[cle]
        Object.assign(e, { sorte: 'curiosite', curiosite: e.etage === 1 ? 'plat' : 'rebus' })
      }
      d0.prepare('UPDATE campagne_series SET expedition = ? WHERE id = ?').run(JSON.stringify(d), partie.id)
    } finally {
      d0.close()
    }
  }
  await banc.redemarrer()
  /** La question gardée à ce rang, bonne réponse comprise : ce que seul le serveur sait. */
  const gardee = (rang: number): { reponses: string[]; bonne: number } => {
    const d0 = db()
    try {
      return JSON.parse((d0.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(partie.id) as { questions: string }).questions)[rang]
    } finally {
      d0.close()
    }
  }

  const contexte = await navigateur.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 })
  const [nom, valeur] = ines.split('=')
  await contexte.addCookies([{ name: nom, value: valeur, url: banc.url }])
  const page = await contexte.newPage()
  page.on('pageerror', (e: Error) => console.error('[page] Inès :', e.message))
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
  /** Touche la carte d'une curiosité, puis « Y aller ». */
  const allerALaCuriosite = async (photoDuPlan?: string) => {
    await page.waitForSelector('.exp-plan')
    await largeur('le plan')
    if (photoDuPlan) await photo(photoDuPlan)
    await page.locator('.exp-carte-escale.exp-curiosite').first().click()
    if (photoDuPlan) await photo(`${photoDuPlan}-touchee`)
    await page.locator('.exp-panneau > .btn-primary').click()
  }
  /** Compose ces lettres, tuile après tuile — dans le désordre si `fausse` —, puis valide. */
  const composer = async (lettres: string, fausse: boolean, nomFichier: string) => {
    const aPoser = fausse ? [...lettres].reverse() : [...lettres]
    for (const l of aPoser) await page.locator('.exp-tuile', { hasText: new RegExp(`^${l}$`) }).first().click()
    await photo(nomFichier)
    await page.locator('.exp-composer-gestes .btn-primary').click()
    await page.waitForSelector('.result-banner')
  }

  await page.goto(`${banc.url}/expedition`)
  await page.waitForSelector('.exp-plan, .exp-depart-pied')
  if (!(await page.locator('.exp-plan').count())) await page.locator('.exp-depart-pied .btn-primary').first().click()
  // Le premier rébus : le plan, sa carte touchée, puis lui — ses emojis, ses cases, ses tuiles.
  await allerALaCuriosite('1-plan')
  await page.waitForSelector('.exp-rebus')
  await largeur('le rébus')
  await photo('2-rebus')
  await photo('2-rebus-entier', true)
  // Il est la première question de l'expédition : la première escale en est une.
  const rebus1 = gardee(0)
  await composer(gabaritDe(rebus1.reponses[rebus1.bonne])!.lettres, false, '2b-rebus-compose')
  await largeur('le rébus trouvé')
  await photo('3-rebus-trouve')
  await photo('3-rebus-trouve-entier', true)
  // Sa récompense : des cartes rares, au niveau 1 — une à prendre.
  await page.locator('.btn-big', { hasText: 'Choisir ta récompense' }).click()
  await page.waitForSelector('.exp-offre')
  await largeur('la récompense')
  await photo('4-recompense')
  await photo('4-recompense-entiere', true)
  await page.locator('.exp-a-prendre-carte').first().click()
  await photo('4b-recompense-touchee')
  await page.locator('.exp-depart-pied .btn-primary').click()
  // Le plat : une question de la liste, ratée — rien de perdu.
  await allerALaCuriosite('5-plan-du-plat')
  await page.waitForSelector('.ans-btn')
  await largeur('le plat')
  await photo('6-plat')
  const plat = gardee(1)
  const fausse = (plat.bonne + 1) % plat.reponses.length
  await page.locator('.ans-btn').nth(fausse).click()
  await page.waitForSelector('.result-banner')
  await photo('7-plat-rate')
  await photo('7-plat-rate-entier', true)
  await page.locator('button.btn-big', { hasText: 'Retour au plan' }).click()
  // Le second rébus, composé faux : ce qu'il fallait composer, et comment il se lit.
  await allerALaCuriosite()
  await page.waitForSelector('.exp-rebus')
  const rebus2 = gardee(2)
  await composer(gabaritDe(rebus2.reponses[rebus2.bonne])!.lettres, true, '8-rebus-plein')
  await largeur('le rébus raté')
  await photo('9-rebus-rate', true)
  // « Mes réponses » : l'expédition abandonnée, le rébus y garde ses emojis.
  await page.locator('button.btn-big', { hasText: 'Retour au plan' }).click()
  await page.waitForSelector('.exp-plan')
  await page.locator('.exp-barre a[href="/expedition"]').first().click()
  await page.locator('.exp-abandonner').click()
  await page.locator('.dialog button[type="submit"]').click()
  await page.waitForSelector('.exp-fin-tete')
  const mesReponses = page.locator('.fin-actions .btn-ghost', { hasText: 'Mes réponses' })
  if (await mesReponses.count()) {
    await mesReponses.click()
    await page.waitForTimeout(600)
    await largeur('mes réponses')
    await photo('10-mes-reponses', true)
  } else console.error('[rendu] Inès : pas de « Mes réponses » à la fin')
  await contexte.close()
} finally {
  await navigateur.close()
  await banc.close()
}
