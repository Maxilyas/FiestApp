// Les outils communs des scripts du rapport « La gestion des quiz ».
//
// Pour les rejouer, sur un serveur jetable — jamais sur une vraie base :
//
//   npm run build
//   cd server && PORT=4123 DB_PATH=/tmp/gq/quizz.db QUIZ_DB_URL=file:/tmp/gq/quizzes.db \
//     PUBLIC_URL=http://localhost:4123 node --import tsx src/index.ts
//   node server/scripts/fake-player.mjs http://localhost:4123 Robot 1800 --slug demo   (un invité, pour « Lancer un quiz »)
//   node retours/2026-09-25/scripts/01-bibliotheque.mjs      (puis 02, 03… dans l'ordre : chacun part de l'état du précédent)
//
// Les captures vont dans $SORTIE/captures (par défaut, le dossier temporaire).
// Playwright n'est pas une dépendance du dépôt : pris dans le dépôt s'il y
// est, sinon parmi les modules globaux, comme la tablée.
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

function playwright() {
  try {
    return createRequire(import.meta.url)('playwright')
  } catch {
    const global = execSync('npm root -g').toString().trim()
    return createRequire(path.join(global, '/'))('playwright')
  }
}

export const { chromium } = playwright()

export const BASE = process.env.BASE ?? 'http://localhost:4123'
export const SCR = process.env.SORTIE ?? path.join(os.tmpdir(), 'gestion-des-quiz')
export const CAP = path.join(SCR, 'captures')
mkdirSync(CAP, { recursive: true })

export const PORTABLE = { width: 1366, height: 768 }
export const TELEPHONE = { width: 360, height: 640 }

export async function nouveauContexte(browser, viewport, mobile = false) {
  return browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    isMobile: mobile,
    hasTouch: mobile,
    locale: 'fr-FR',
  })
}

/** Connexion d'animateur par le formulaire de la page (antoine / demo, le compte d'une base neuve). */
export async function connecter(page, url = '/edit', login = 'antoine', mdp = 'demo') {
  await page.goto(BASE + url)
  await page.waitForLoadState('networkidle')
  const champ = page.locator('input[autocomplete="username"]').first()
  if (await champ.count()) {
    await champ.fill(login)
    await page.locator('input[type="password"]').first().fill(mdp)
    await page.locator('form.join button.btn-primary').first().click()
    await page.locator('form.join').first().waitFor({ state: 'detached', timeout: 15000 })
    await page.waitForLoadState('networkidle')
  }
}

/** Un appel d'API depuis la page connectée, avec l'en-tête qu'exige le serveur. */
export async function api(page, chemin, methode = 'GET', corps) {
  return page.evaluate(
    async ({ chemin, methode, corps }) => {
      const r = await fetch(chemin, {
        method: methode,
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'quizz' },
        body: corps === undefined ? undefined : JSON.stringify(corps),
      })
      return { status: r.status, json: await r.json().catch(() => null) }
    },
    { chemin, methode, corps },
  )
}

export async function capture(page, nom, fullPage = false) {
  await page.screenshot({ path: `${CAP}/${nom}.png`, fullPage })
  return `${CAP}/${nom}.png`
}

export async function hauteur(page) {
  return page.evaluate(() => document.documentElement.scrollHeight)
}
