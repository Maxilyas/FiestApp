// La traversée du Cabinet photographiée écran par écran, au doigt, sur un
// serveur jetable (skill `regarder-le-rendu`) : l'écran-titre, les trois
// gardiens, le choix des cartes, la carte d'un acte et son chemin, l'annonce
// d'une épreuve, l'épreuve elle-même (sa tête : les cœurs, l'or), son bilan, le
// coffre et son amélioration, le marchand, le gardien, le choix du légendaire
// et la fin. Le client se construit d'abord (`npm run build -w client`).
//
//   cd server && npx tsx scripts/rendu-traversee.ts            # 360 × 640
//   ECRAN=1366x768 npx tsx scripts/rendu-traversee.ts
//
// Les étapes lointaines — le marchand, le gardien, le légendaire — s'écrivent
// à la main dans la base, rejouées par le pli comme le serveur les aurait
// écrites, puis le serveur redémarre et les relit : vingt minutes de jeu en
// une seconde. À chaque photo, ce qui déborde de côté se dit.
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { demarrer, inscrireProfil } from '../test/banc'
import { DIX_HEURES } from '../test/cabinet-banc'
import { atteignables, etapeDe, etatDeLaTraversee, lireLeDepartDeLaTraversee, type GesteDeLaTraversee } from '../../shared/cabinet/traversee'

const [largeur, hauteur] = (process.env.ECRAN ?? '360x640').split('x').map(Number)
const telephone = largeur < 700
// Dans `export/`, que git ignore, comme `rendu-themes.ts` : des photos ne se committent pas.
const sortie = path.resolve(process.env.SORTIE ?? path.join(process.cwd(), '..', 'export', 'rendus', `traversee-${largeur}x${hauteur}`))
mkdirSync(sortie, { recursive: true })

function chargerPlaywright(): any {
  try {
    return createRequire(import.meta.url)('playwright')
  } catch {
    const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
    return createRequire(path.join(globale, 'rendu.js'))('playwright')
  }
}
const { chromium } = chargerPlaywright()

const horloge = { depart: Date.now() }
const maintenant = () => DIX_HEURES + (Date.now() - horloge.depart)
const banc = await demarrer({ horlogeDuJour: maintenant })
const fichier = banc.quizDbUrl.replace(/^file:/, '')
// La carte 3D a besoin de WebGL : Chromium sans écran le rend par SwiftShader.
const navigateur = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const cookie = await inscrireProfil(banc.url, 'voyageuse', 'Zoé')
const ctx = await navigateur.newContext({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: telephone ? 2 : 1, isMobile: telephone, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' })
const [nom, valeur] = cookie.split('=')
await ctx.addCookies([{ name: nom, value: valeur, url: banc.url }])
const page = await ctx.newPage()
page.setDefaultTimeout(20_000)
page.on('pageerror', (e: Error) => console.error('[page]', e.message))
const echecs: string[] = []
let n = 0

async function photo(nomDeLaPhoto: string) {
  n++
  await page.waitForTimeout(400)
  const f = path.join(sortie, `${String(n).padStart(2, '0')}-${nomDeLaPhoto}.png`)
  await page.screenshot({ path: f })
  // Rien ne déborde de côté : un élément poussé hors de l'écran élargit la page.
  // Le script tourne sous Node, sans les types du navigateur : ce qui s'évalue dans la page passe par `globalThis`, comme
  // dans les autres rendus.
  const debords = await page.evaluate(() => {
    const g = globalThis as any
    const l: number = g.document.documentElement.clientWidth
    const hors: string[] = []
    for (const el of g.document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.right > l + 1 && g.getComputedStyle(el).position !== 'fixed') hors.push(`${String(el.tagName).toLowerCase()}.${el.className}`.slice(0, 80))
    }
    return { large: g.document.documentElement.scrollWidth > l, hors: hors.slice(0, 5) }
  })
  console.log(`📸 ${path.basename(f)}${debords.large ? `  ⚠ la page déborde : ${debords.hors.join(' | ')}` : ''}`)
}

async function etape(nomDeLEtape: string, faire: () => Promise<void>) {
  try {
    await faire()
  } catch (e) {
    const ligne = `[rendu] ${nomDeLEtape} : ${(e as Error).message.split('\n')[0]}`
    echecs.push(ligne)
    console.error(ligne)
    await page.screenshot({ path: path.join(sortie, `echec-${nomDeLEtape.replace(/[^\p{L}\p{N}]+/gu, '-')}.png`) }).catch(() => {})
  }
}

const toucher = async (texte: RegExp | string) => {
  await page.getByRole('button', { name: texte }).first().click()
  await page.waitForTimeout(650)
}

/** Une traversée écrite à la main : ses gestes rejoués par le pli jusqu'à ce que `jusqua` dise stop, puis le serveur la relit. */
function avancerALaMain(jusqua: (sorte: string, e: ReturnType<typeof etatDeLaTraversee>) => boolean) {
  const db = new Database(fichier)
  try {
    const ligne = db.prepare('SELECT id, depart FROM cabinet_traversees ORDER BY commencee_le DESC LIMIT 1').get() as { id: string; depart: string }
    const depart = lireLeDepartDeLaTraversee(ligne.depart)!
    const lus = db.prepare('SELECT geste FROM cabinet_traversee_gestes WHERE traversee_id = ? ORDER BY rang').all(ligne.id) as { geste: string }[]
    const gestes: GesteDeLaTraversee[] = lus.map(l => JSON.parse(l.geste))
    const etat = () =>
      etatDeLaTraversee(
        depart,
        gestes.map(geste => ({ geste, faitLe: maintenant() })),
      )
    let e = etat()
    let p = 0
    // Une épreuve laissée en route par le rendu — un gardien affronté — se conclut sans faute d'abord.
    const enRoute = e.ou.sorte === 'epreuve' || e.ou.sorte === 'gardien' ? e.ou.partie : null
    if (enRoute) {
      gestes.push({ quoi: 'conclure', partie: enRoute, manches: [3, 3, 3].map(etoiles => ({ etoiles, misee: false })) })
      e = etat()
    }
    for (let garde = 0; garde < 200 && !jusqua(e.ou.sorte, e) && !e.fin; garde++) {
      if (e.ameliorations > 0) gestes.push({ quoi: 'ameliorer', carte: e.cartes.find(c => c.niveau < 3)!.cle })
      else {
        const ids = e.ou.sorte === 'gardien' && e.ou.partie === null ? [e.ou.etape] : atteignables(depart, e)
        const suivante = etapeDe(depart, ids.find(id => etapeDe(depart, id)?.sorte === 'epreuve') ?? ids[0])!
        if (suivante.sorte === 'coffre' || suivante.sorte === 'marchand') gestes.push({ quoi: 'aller', etape: suivante.id })
        else {
          const partie = `ecrite-${++p}`
          gestes.push({ quoi: 'epreuve', etape: suivante.id, partie })
          // Sans faute, sauf la troisième manche de la première épreuve écrite — son bilan montre de l'or et un cœur perdu —, et
          // seulement s'il en reste assez : la traversée tient jusqu'au légendaire.
          const uneRatee = p === 1 && e.coeurs > 2
          gestes.push({ quoi: 'conclure', partie, manches: (uneRatee ? [3, 2, 0] : [3, 3, 3]).map(etoiles => ({ etoiles, misee: false })) })
        }
      }
      e = etat()
    }
    db.prepare('DELETE FROM cabinet_traversee_gestes WHERE traversee_id = ?').run(ligne.id)
    const inserer = db.prepare('INSERT INTO cabinet_traversee_gestes (traversee_id, rang, geste, fait_le, uid) VALUES (?, ?, ?, ?, ?)')
    gestes.forEach((g, k) => inserer.run(ligne.id, k + 1, JSON.stringify(g), maintenant(), `main-${k}`))
  } finally {
    db.close()
  }
}

async function rouvrir() {
  await banc.redemarrer()
  await page.goto(`${banc.url}/cabinet`)
  await page.waitForTimeout(2500)
}

/** Les bilans pas encore lus passent d'abord : chacun photographié, puis « Continuer ». */
async function passerLesBilans(nomDesPhotos: string) {
  for (let k = 0; k < 4 && (await page.locator('.cab-tv-bilan').count()); k++) {
    await photo(`${nomDesPhotos}-${k + 1}`)
    await toucher('Continuer')
  }
}

await etape('titre', async () => {
  await page.goto(`${banc.url}/cabinet`)
  await page.getByRole('button', { name: 'Commencer une traversée' }).waitFor()
  await page.waitForTimeout(2500)
  await photo('titre')
})
await etape('gardiens', async () => {
  await toucher('Commencer une traversée')
  await page.waitForTimeout(2500)
  await photo('trois-gardiens')
})
await etape('cartes', async () => {
  await toucher('Choisir mes trois cartes')
  await photo('choix-des-cartes')
  for (const c of [/Coup d’œil/, /Quitte ou double/, /Cagnotte/]) await toucher(c)
  await page.evaluate(() => (globalThis as any).document.querySelector('.cab-tv-ecran')?.scrollTo(0, 99999))
  await photo('cartes-choisies')
})
await etape('carte', async () => {
  await toucher(/^Partir/)
  await page.waitForTimeout(1200)
  await photo('acte-1-carton')
  await page.waitForTimeout(2600)
  await photo('acte-1-carte')
})
await etape('annonce', async () => {
  await page.locator('.cab-tv-option').first().click()
  await page.waitForTimeout(700)
  await photo('etape-choisie')
  await page.locator('.cab-tv-panneau .cab-tv-cta').click()
  await page.waitForTimeout(2200)
  await photo('annonce-epreuve')
})
await etape('epreuve', async () => {
  await toucher(/^Commencer/)
  await page.waitForTimeout(1500)
  await photo('epreuve-premiere-manche')
})
await etape('quitter', async () => {
  // Sous Quitte ou double, la mise se décide d'abord : on ne mise pas.
  const pasCetteFois = page.getByRole('button', { name: 'Pas cette fois' })
  if (await pasCetteFois.count()) await toucher('Pas cette fois')
  await page.waitForTimeout(800)
  await photo('epreuve-manche')
  await page.getByRole('button', { name: 'Quitter' }).first().click()
  await page.waitForTimeout(800)
  await photo('quitter-l-epreuve')
  await page.getByRole('button', { name: 'Quitter la partie' }).click()
  await page.waitForTimeout(2500)
  await photo('bilan-de-l-epreuve')
  await toucher('Continuer')
  await page.waitForTimeout(1500)
  await photo('carte-apres-l-epreuve')
})
await etape('feuilles', async () => {
  await page.getByRole('button', { name: 'Tes cartes' }).click()
  await page.waitForTimeout(700)
  await photo('feuille-des-cartes')
  await page.getByRole('button', { name: 'Fermer' }).click()
  await page.getByRole('button', { name: 'Menu' }).click()
  await page.waitForTimeout(700)
  await photo('feuille-du-menu')
  await page.getByRole('button', { name: 'Fermer' }).click()
})
await etape('marchand', async () => {
  avancerALaMain(sorte => sorte === 'marchand')
  await rouvrir()
  await passerLesBilans('bilan-avant-le-marchand')
  await photo('marchand')
  await page.evaluate(() => (globalThis as any).document.querySelector('.cab-tv-ecran')?.scrollTo(0, 99999))
  await photo('marchand-bas')
})
await etape('gardien', async () => {
  await page.locator('.cab-tv-pied .cab-tv-cta').click()
  await page.waitForTimeout(2600)
  await photo('annonce-du-gardien')
})
await etape('legendaire', async () => {
  avancerALaMain(sorte => sorte === 'legendaire')
  await rouvrir()
  await passerLesBilans('bilan-avant-le-legendaire')
  await photo('choix-du-legendaire')
  await page.locator('.cab-tv-legendaire').first().click()
  await page.waitForTimeout(400)
  await page.locator('.cab-tv-pied .cab-tv-cta').click()
  await page.waitForTimeout(1500)
  await photo('legendaire-gagne')
})

console.log(echecs.length ? `\n${echecs.length} étape(s) en échec :\n${echecs.join('\n')}` : `\nToutes les étapes passent — ${n} photos dans ${sortie}`)
await navigateur.close()
await banc.close()
process.exit(echecs.length ? 1 : 0)
