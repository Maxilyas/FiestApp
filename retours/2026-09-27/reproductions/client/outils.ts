// Les outils de l'audit « client » : un serveur jetable qui sert le client
// construit dans ce dossier, et un Chromium piloté par Playwright (pris parmi
// les modules globaux, comme la tablée).
//
//   cd client && npx vite build --outDir ../export/evaluations/client/dist
//   cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/client/<nom>.test.ts
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ADMIN, demarrer, type Banc } from '../../../server/test/banc'

const ici = path.dirname(fileURLToPath(import.meta.url))
/** Le client construit : celui du dépôt, ou (CLIENT_DIST=corrige/dist) la copie corrigée pour prouver une piste. */
export const DIST = process.env.CLIENT_DIST ? path.resolve(ici, process.env.CLIENT_DIST) : path.join(ici, 'dist')

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers'

function playwright(): any {
  try {
    return createRequire(import.meta.url)('playwright')
  } catch {
    const global = execSync('npm root -g').toString().trim()
    return createRequire(path.join(global, '/'))('playwright')
  }
}

export const { chromium } = playwright()

export const PORTABLE = { width: 1366, height: 768 }
export const TELEPHONE = { width: 360, height: 640 }

export async function bancAvecClient(): Promise<Banc> {
  return demarrer({ clientDist: DIST })
}

export async function navigateur() {
  return chromium.launch({ headless: true })
}

export async function contexte(browser: any, viewport = TELEPHONE, mobile = true) {
  return browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, locale: 'fr-FR' })
}

/** Connexion de l'animateur par le formulaire de l'écran commun (un vrai clic : une activation de la page). */
export async function ouvrirEcranCommun(page: any, url: string) {
  await page.goto(`${url}/host`)
  await page.locator('input[autocomplete="username"]').first().fill(ADMIN.login)
  await page.locator('input[type="password"]').first().fill(ADMIN.password)
  await page.locator('form button.btn-primary').first().click()
  await page.locator('.host-console').waitFor({ timeout: 15000 })
}

export const attendreQue = async (cond: () => Promise<boolean> | boolean, ms = 10000, pas = 50) => {
  const fin = Date.now() + ms
  while (Date.now() < fin) {
    if (await cond()) return true
    await new Promise(r => setTimeout(r, pas))
  }
  return false
}
