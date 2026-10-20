// La frise (la version 13 du départ, le 20 octobre 2026 — l'étape 5 de « La
// question au centre », `retours/2026-10-20/la-frise.md`), photographiée au
// téléphone (360 × 640) sur un serveur jetable qui ouvre la question au
// centre — le banc la ferme d'office. Ulysse part, son départ récrit comme le
// font les tests — les deux premiers étages, des questions d'Histoire en
// frise, une graine qui lui met Coup d'œil en main — : la frise sous les yeux,
// ses places et ses cartes ; Coup d'œil joué, un événement daté ; deux
// événements posés ; les quatre ; rangée juste, la révélation ; la suivante,
// rangée à l'envers, sa révélation ; puis « Mes réponses ». Ce qui élargit la
// page se dit (`[déborde]`). Le client construit d'abord (`npm run build -w
// client`).
//
//   npx tsx scripts/rendu-frise.ts [dossier] [ivoire]
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { baseDEssai, demarrer, ecrire, inscrireProfil } from '../test/banc'
import { BaseDeLaCampagne, lireLaBase } from '../src/core/baseCampagne'
import { pliDeLExpedition, type DepartDExpedition } from '../../shared/expedition'

const sortie = path.resolve(process.argv[2] ?? 'rendu-frise')
const ivoire = process.argv.includes('ivoire')
mkdirSync(sortie, { recursive: true })

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'rendu.js'))('playwright')
}
const { chromium } = chargerPlaywright()

// Une base d'essai, et les questions d'Histoire de la vraie que les événements de la frise récrivent.
const LIGNES = JSON.parse(readFileSync(new URL('../content/frises/evenements.json', import.meta.url), 'utf8')) as { id: string }[]
const ids = new Set(LIGNES.map(l => l.id))
const base = new BaseDeLaCampagne([...baseDEssai(240, { categories: ['Histoire'] }).questions, ...lireLaBase().questions.filter(q => ids.has(q.id) && q.meta.categorie === 'Histoire')])

const banc = await demarrer({ baseDeLaCampagne: base, questionAuCentre: true })
const navigateur = await chromium.launch({ headless: true })
try {
  const ulysse = await inscrireProfil(banc.url, 'ulysse', 'Ulysse', '🦊')
  if (ivoire) await ecrire(banc.url, '/api/joueur/moi', { theme: 'ivoire' }, ulysse, 'PUT')
  const partie = (await (await ecrire(banc.url, '/api/expedition', { rencontres: true, questionAuCentre: true }, ulysse)).json()) as { id: string }
  const db = () => new Database(banc.quizDbUrl.replace(/^file:/, ''))
  {
    const d0 = db()
    try {
      const d = JSON.parse((d0.prepare('SELECT expedition FROM campagne_series WHERE id = ?').get(partie.id) as { expedition: string }).expedition) as DepartDExpedition
      for (const e of d.cartes[0].escales) {
        if (e.etage > 1) continue
        for (const cle of ['curiosite', 'chance'] as const) delete e[cle]
        Object.assign(e, { sorte: 'question', theme: { categories: ['Histoire'] }, forme: 'frise' })
      }
      // Une graine qui ouvre la main de l'acte sur Coup d'œil : cherchée par le vrai pli, comme les tests.
      const premiere = { escale: d.cartes[0].depart[0], acte: 0, reponses: 4, niveau: 'facile' as const, tiree: 'frise' as const, forme: 'frise' as const, six: false, datee: false, categorie: 'Histoire' }
      d.graine =
        Array.from({ length: 2000 }, (_, k) => `rendu:frise:${k}`).find(
          g => pliDeLExpedition({ ...d, graine: g }, [{ quoi: 'avancer', vers: d.cartes[0].depart[0] }], [premiere], new Map()).cycle?.main.includes('coup-d-oeil'),
        ) ?? d.graine
      d0.prepare('UPDATE campagne_series SET expedition = ? WHERE id = ?').run(JSON.stringify(d), partie.id)
    } finally {
      d0.close()
    }
  }
  await banc.redemarrer()
  /** La frise gardée à ce rang, ordre du temps compris : ce que seul le serveur sait. */
  const gardee = (rang: number): { montre: number[] } => {
    const d0 = db()
    try {
      return JSON.parse((d0.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(partie.id) as { questions: string }).questions)[rang].frise
    } finally {
      d0.close()
    }
  }
  const rangDeLaQuestion = (): number => {
    const d0 = db()
    try {
      return JSON.parse((d0.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(partie.id) as { questions: string }).questions).length - 1
    } finally {
      d0.close()
    }
  }

  const contexte = await navigateur.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 })
  const [nom, valeur] = ulysse.split('=')
  await contexte.addCookies([{ name: nom, value: valeur, url: banc.url }])
  const page = await contexte.newPage()
  page.on('pageerror', (e: Error) => console.error('[page] Ulysse :', e.message))
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
  /** Pose les cartes à l'écran dans cet ordre (leur rang à l'écran), puis valide. */
  const poser = async (ordre: readonly number[], nomFichier: string) => {
    const lignes = (await page.locator('.exp-frise-carte').allTextContents()).map((t: string) => t.trim())
    for (const i of ordre) await page.locator('.exp-frise-carte', { hasText: lignes[i] }).first().click()
    await photo(nomFichier)
    await page.locator('.exp-frise .exp-composer-gestes .btn-primary').click()
    await page.waitForSelector('.result-banner')
  }

  await page.goto(`${banc.url}/expedition`)
  await page.waitForSelector('.exp-plan, .exp-depart-pied')
  if (!(await page.locator('.exp-plan').count())) await page.locator('.exp-depart-pied .btn-primary').first().click()
  await page.waitForSelector('.exp-plan')
  await largeur('le plan')
  await photo('1-plan')
  /** Touche la carte d'une escale permise, puis « Y aller ». */
  const yAller = async () => {
    await page.locator('.exp-carte-escale').first().click()
    await page.locator('.exp-panneau > .btn-primary').click()
  }
  await page.locator('.exp-carte-escale').first().click()
  await photo('1-plan-touchee')
  await page.locator('.exp-panneau > .btn-primary').click()
  // Les règles s'ouvrent d'elles-mêmes à la première rencontre : la frise y a sa ligne, puis on les referme.
  await page.waitForSelector('.exp-frise, .feuille-regles')
  if (await page.locator('.feuille-regles').count()) {
    await photo('2-regles', true)
    await page.locator('.feuille-regles .carte-pied .btn-primary').click()
  }
  await page.waitForSelector('.exp-frise')
  await largeur('la frise')
  await photo('2-frise')
  await photo('2-frise-entiere', true)
  // Coup d'œil, levé puis joué : un événement daté.
  const coup = page.locator('.exp-cartes .exp-face:not(.exp-face-eteinte)', { hasText: 'Coup d’œil' })
  if (await coup.count()) {
    await coup.first().click()
    await page.waitForSelector('.exp-leve')
    await photo('3-coup-d-oeil-leve')
    await page.locator('.exp-leve .btn-primary').click()
    await page.waitForSelector('.exp-frise-annee')
    await photo('3-frise-datee')
  } else console.error('[rendu] Ulysse : pas de Coup d’œil en main')
  // Deux posés, puis les quatre, dans le bon ordre.
  const { montre } = gardee(rangDeLaQuestion())
  const bon = montre.map((_, k) => montre.indexOf(k))
  const lignes = (await page.locator('.exp-frise-carte').allTextContents()).map((t: string) => t.trim())
  for (const i of bon.slice(0, 2)) await page.locator('.exp-frise-carte', { hasText: lignes[i] }).first().click()
  await photo('4-frise-deux-posees')
  await page.locator('.exp-frise .exp-composer-gestes .btn-ghost').click()
  await poser(bon, '5-frise-pleine')
  await largeur('la frise rangée')
  await photo('6-frise-juste')
  await photo('6-frise-juste-entiere', true)
  // La suivante, rangée à l'envers : la révélation dit où il avait mis chacun. L'adversaire tombé, sa carte prise.
  await page.locator('.result-banner ~ .btn-primary.btn-big').click()
  await page.waitForSelector('.exp-offre, .exp-plan')
  if (await page.locator('.exp-offre').count()) {
    await page.locator('.exp-a-prendre-carte, .exp-offre-ligne').first().click()
    await page.locator('.exp-offre .exp-depart-pied .btn-primary').click()
  }
  await page.waitForSelector('.exp-plan')
  await yAller()
  await page.waitForSelector('.exp-frise')
  const montre2 = gardee(rangDeLaQuestion()).montre
  await poser([3, 2, 1, 0].map(k => montre2.indexOf(k)), '7-frise-a-l-envers')
  await largeur('la frise ratée')
  await photo('8-frise-ratee', true)
  // « Mes réponses » : l'expédition abandonnée — « ← Partir », puis du départ —, chaque frise rangée.
  await page.locator('.exp-barre a[href="/expedition"]').first().click()
  await page.locator('.exp-abandonner').click()
  await page.locator('.dialog button[type="submit"]').click()
  await page.waitForSelector('.exp-fin-tete')
  const mesReponses = page.locator('.fin-actions .btn-ghost', { hasText: 'Mes réponses' })
  if (await mesReponses.count()) {
    await mesReponses.click()
    await page.waitForTimeout(600)
    await largeur('mes réponses')
    await photo('9-mes-reponses', true)
  } else console.error('[rendu] Ulysse : pas de « Mes réponses » à la fin')
  await contexte.close()
} finally {
  await navigateur.close()
  await banc.close()
}
