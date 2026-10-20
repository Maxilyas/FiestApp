// Le détail (la version 15 du départ, le 20 octobre 2026,
// `retours/2026-10-20/le-detail.md`), photographié au téléphone (360 × 640)
// sur un serveur jetable qui ouvre la question au centre — le banc la ferme
// d'office. Ulysse part, son départ récrit comme le font les tests — les deux
// premiers étages, des détails d'Arts & lettres — : d'abord, au codex du
// départ, Échauffement et Inarrêtable levés, et leurs mots des familles ; puis
// l'annonce d'un détail, ses quatre cadrages à leur heure — cinq secondes
// chacun, à l'horloge du serveur —, reconnu au deuxième, la révélation et le
// tableau entier ; le suivant, raté ; « Mes réponses ». Ce qui élargit la page
// se dit (`[déborde]`). Au doigt (`hasTouch`, `tap()`) : les réponses se
// prennent au lever du doigt (`client/src/toucher.ts`), ce qu'un clic de
// souris ne montre pas. Le client construit d'abord (`npm run build -w
// client`).
//
//   npx tsx scripts/rendu-detail.ts [dossier] [ivoire]
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { baseDEssai, demarrer, ecrire, inscrireProfil } from '../test/banc'
import { BaseDeLaCampagne, lireLaBase } from '../src/core/baseCampagne'
import { detailsDeLaBase } from '../src/core/details'
import { CATEGORIE_DU_DETAIL, MS_PAR_CADRAGE, type DepartDExpedition } from '../../shared/expedition'

const sortie = path.resolve(process.argv[2] ?? 'rendu-detail')
const ivoire = process.argv.includes('ivoire')
mkdirSync(sortie, { recursive: true })

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'rendu.js'))('playwright')
}
const { chromium } = chargerPlaywright()

// Une base d'essai, et les questions « Qui a peint… ? » de la vraie que les tableaux demandent.
const vraie = lireLaBase()
const details = detailsDeLaBase(new Map(vraie.questions.map(q => [q.id, q])))
const parId = new Map(details.map(d => [d.question.id, d.question]))
const base = new BaseDeLaCampagne([...baseDEssai(240, { categories: [CATEGORIE_DU_DETAIL] }).questions, ...details.map(d => d.question)])

const banc = await demarrer({ baseDeLaCampagne: base, questionAuCentre: true })
const navigateur = await chromium.launch({ headless: true })
try {
  const ulysse = await inscrireProfil(banc.url, 'ulysse', 'Ulysse', '🦊')
  if (ivoire) await ecrire(banc.url, '/api/joueur/moi', { theme: 'ivoire' }, ulysse, 'PUT')
  const contexte = await navigateur.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
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

  // Le codex du départ : Échauffement et Inarrêtable, levés — leurs mots de la version 14 n'avaient jamais été photographiés.
  await page.goto(`${banc.url}/expedition`)
  await page.waitForSelector('.exp-codex-du-depart')
  await page.locator('.exp-codex-du-depart .exp-ouvrir').click()
  await page.waitForSelector('.feuille-codex')
  for (const [carte, fichier] of [
    ['Échauffement', '0-echauffement-leve'],
    ['Inarrêtable', '0-inarretable-leve'],
  ] as const) {
    let trouvee = false
    for (const onglet of await page.locator('.feuille-codex .onglet').all()) {
      await onglet.click()
      await page.waitForTimeout(250)
      const c = page.locator('.feuille-codex .exp-codex-carte', { hasText: carte })
      if (!(await c.count())) continue
      await c.first().click()
      await page.waitForSelector('.exp-leve')
      await largeur(carte)
      await photo(fichier)
      await page.locator('.exp-leve .exp-reposer').click()
      trouvee = true
      break
    }
    if (!trouvee) console.error(`[rendu] ${carte} introuvable au codex`)
  }
  await page.locator('.feuille-codex .carte-fermer').first().click()

  const partie = (await (await ecrire(banc.url, '/api/expedition', { rencontres: true, questionAuCentre: true }, ulysse)).json()) as { id: string }
  const db = () => new Database(banc.quizDbUrl.replace(/^file:/, ''))
  {
    const d0 = db()
    try {
      const d = JSON.parse((d0.prepare('SELECT expedition FROM campagne_series WHERE id = ?').get(partie.id) as { expedition: string }).expedition) as DepartDExpedition
      for (const e of d.cartes[0].escales) {
        if (e.etage > 1) continue
        for (const cle of ['curiosite', 'chance'] as const) delete e[cle]
        Object.assign(e, { sorte: 'question', theme: { categories: [CATEGORIE_DU_DETAIL] }, forme: 'detail' })
      }
      d0.prepare('UPDATE campagne_series SET expedition = ? WHERE id = ?').run(JSON.stringify(d), partie.id)
    } finally {
      d0.close()
    }
  }
  await banc.redemarrer()
  /** La question gardée au dernier rang : sa bonne réponse, que seul le serveur sait. */
  const laBonne = (): string => {
    const d0 = db()
    try {
      const qs = JSON.parse((d0.prepare('SELECT questions FROM campagne_series WHERE id = ?').get(partie.id) as { questions: string }).questions) as { id: string }[]
      const q = parId.get(qs[qs.length - 1].id)!
      return q.reponses[q.bonne]
    } finally {
      d0.close()
    }
  }
  const voir = async () => {
    await page.waitForSelector('.exp-voir, .feuille-regles')
    if (await page.locator('.feuille-regles').count()) {
      await photo('1-regles', true)
      await page.locator('.feuille-regles .carte-pied .btn-primary').click()
    }
    await page.waitForSelector('.exp-voir')
    await largeur('l’annonce')
    await photo('2-annonce')
    await page.locator('.exp-voir').tap()
    await page.waitForSelector('.exp-detail-cadre img')
  }

  await page.goto(`${banc.url}/expedition`)
  await page.waitForSelector('.exp-plan, .exp-depart-pied')
  if (!(await page.locator('.exp-plan').count())) await page.locator('.exp-depart-pied .btn-primary').first().click()
  await page.waitForSelector('.exp-plan')
  await page.locator('.exp-carte-escale').first().click()
  await photo('1-plan-touchee')
  await page.locator('.exp-panneau > .btn-primary').click()
  await voir()
  await largeur('le détail')
  await photo('3-cadrage-1')
  await page.waitForTimeout(MS_PAR_CADRAGE)
  await photo('3-cadrage-2')
  // Reconnu au deuxième cadrage : deux crans.
  await page.locator('.ans-btn', { hasText: laBonne() }).first().tap()
  await page.waitForSelector('.result-banner')
  await page.waitForTimeout(600)
  await largeur('la révélation')
  await photo('4-revele')
  await photo('4-revele-entiere', true)
  // Le suivant : chaque cadrage à son heure, puis raté.
  await page.locator('.result-banner ~ .btn-primary.btn-big').click()
  await page.waitForSelector('.exp-offre, .exp-plan')
  if (await page.locator('.exp-offre').count()) {
    await page.locator('.exp-a-prendre-carte, .exp-offre-ligne').first().click()
    await page.locator('.exp-offre .exp-depart-pied .btn-primary').click()
  }
  await page.waitForSelector('.exp-plan')
  await page.locator('.exp-carte-escale').first().click()
  await page.locator('.exp-panneau > .btn-primary').click()
  await voir()
  for (const k of [1, 2, 3, 4]) {
    if (k > 1) await page.waitForTimeout(MS_PAR_CADRAGE)
    await photo(`5-suivant-cadrage-${k}`)
  }
  const bonne = laBonne()
  const fausse = page.locator('.ans-btn:not(.exp-effacee)').filter({ hasNotText: bonne }).first()
  await fausse.tap()
  await page.waitForSelector('.result-banner')
  await page.waitForTimeout(600)
  await photo('6-rate', true)
  // « Mes réponses » : l'expédition abandonnée — « ← Partir », puis du départ —, chaque tableau entier, nommé.
  await page.locator('.exp-barre a[href="/expedition"]').first().click()
  await page.locator('.exp-abandonner').click()
  await page.locator('.dialog button[type="submit"]').click()
  await page.waitForSelector('.exp-fin-tete')
  const mesReponses = page.locator('.fin-actions .btn-ghost', { hasText: 'Mes réponses' })
  if (await mesReponses.count()) {
    await mesReponses.click()
    await page.waitForTimeout(1200)
    await largeur('mes réponses')
    await photo('7-mes-reponses', true)
  } else console.error('[rendu] Ulysse : pas de « Mes réponses » à la fin')
  await contexte.close()
} finally {
  await navigateur.close()
  await banc.close()
}
