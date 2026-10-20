// « Mon compagnon », chez lui (`client/src/components/MonCompagnon.tsx`, la
// maquette validée par le propriétaire le 20 octobre 2026), photographié au
// téléphone sur un serveur jetable. Léa et son loup adulte — six jours de
// complicité, trois trouvailles, le petit coin — : le premier passage du jour,
// il dort, volets fermés ; touché, il se réveille ; une caresse ; ses trois
// envies l'une après l'autre — le goûter et sa friandise qui vole, le câlin du
// doigt et sa jauge, la cueillette, son intro, une partie, sa fin — ; son
// cadeau, le septième jour, le grand, qui ouvre la cour, et la trouvaille
// posée dans son jardin ; « Décorer », ses deux onglets, une place choisie,
// ses trouvailles ; la galerie des compagnons et deux fiches ; une forme de son
// chemin regardée ; « Comment ça marche » ; son nom. Puis Max et son chat,
// soixante-quatre jours de complicité : tout le domaine, ses dix places
// remplies, qui défile de côté. Et Zoé, sans compagnon : tous ceux qu'elle
// peut avoir. À chaque photo, ce qui déborde de côté se dit — rien ne doit
// élargir la page (règle `css.md`). Le client construit d'abord (`npm run
// build -w client`).
//
//   npx tsx scripts/rendu-compagnon.ts [dossier]    (ECRAN=390x844, ENCOCHE=47, THEME=ivoire, SEULEMENT=lea|max|zoe)
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { demarrer, ecrire, inscrireProfil, patienter } from '../test/banc'
import { VERSION_BAREME } from '../src/auth/profiles'
import { xpDuNiveau } from '../../shared/profil'
import { jourDe } from '../../shared/jour'
import { TROUVAILLES } from '../../shared/trouvailles'

const sortie = path.resolve(process.argv[2] ?? 'rendu-compagnon')
mkdirSync(sortie, { recursive: true })
const [largeur, hauteur] = (process.env.ECRAN ?? '360x640').split('x').map(Number)
const theme = process.env.THEME ?? null
const encoche = Number(process.env.ENCOCHE ?? 0)
const seulement = process.env.SEULEMENT ?? null

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'rendu.js'))('playwright')
}
const { chromium } = chargerPlaywright()

// Le cadeau tiré au même endroit à chaque rendu : le grand cadeau de Léa, une épique.
const banc = await demarrer({ hasardDuCadeau: () => 0.9 })
const navigateur = await chromium.launch({ headless: true })
const rapport: string[] = []
const JOUR_MS = 86_400_000

/** Ce qui élargit la page : sa largeur, et ce qui dépasse le bord droit de l'écran. En texte : `tsx` glisserait des `__name` dans une fonction passée à la page. */
const DEBORDE = `(() => {
  const l = document.documentElement.clientWidth
  const trop = document.documentElement.scrollWidth - l
  if (trop <= 0) return []
  const vus = []
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.right > l + 1 && !el.closest('.jardin-panorama, .chez-chemin, .decorer-filtres')) {
      vus.push(el.tagName.toLowerCase() + '.' + (el.getAttribute('class') || '').split(/\\s+/).slice(0, 2).join('.') + ' (' + Math.round(r.right - l) + ' px)')
    }
  }
  return ['la page a ' + trop + ' px de trop', ...new Set(vus.slice(0, 6))]
})()`

/** Un profil et ce que la base lui donne d'avance, puis le serveur relancé : il relit ses compagnons. */
async function profil(login: string, prenom: string, avatar: string, remplir: (db: Database.Database, id: string) => void): Promise<string> {
  const cookie = await inscrireProfil(banc.url, login, prenom, avatar)
  const id = ((await (await fetch(`${banc.url}/api/joueur/moi?leger`, { headers: { Cookie: cookie } })).json()) as any).profile.id
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  db.prepare(`INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, '#rattrapage', '', ?, ?, 1)`).run(
    id,
    xpDuNiveau(12),
    JSON.stringify({ v: VERSION_BAREME }),
  )
  db.prepare('UPDATE profiles SET xp = ? WHERE id = ?').run(xpDuNiveau(12), id)
  // De quoi adopter un compagnon de plus : une partie du quiz du jour d'avant, ses bonnes réponses en confettis.
  db.prepare(`INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, '2026-09-20', 1, 10, NULL, 0, 3600, 1, 0)`).run(id)
  remplir(db, id)
  db.close()
  await banc.redemarrer()
  if (theme) await ecrire(banc.url, '/api/joueur/moi', { theme }, cookie, 'PUT')
  return cookie
}

/** Des bonnes réponses données avec lui, aux quiz du jour de juillet — leurs tirages avec, que le compte lit. */
function justesAvecLui(db: Database.Database, id: string, compagnon: string, jours: number) {
  const questions = Array.from({ length: 10 }, (_, i) => ({ reserveId: `rendu-compagnon-${i}`, texte: `Question ${i + 1}`, reponses: ['A', 'B', 'C', 'D'], bonne: 0, categorie: null, duree: 20, lectureMs: 3000, anecdote: null }))
  const tirage = db.prepare(`INSERT OR IGNORE INTO jour_tirages (jour, questions, annulees, tire_le) VALUES (?, ?, '[]', 1)`)
  const juste = db.prepare(`INSERT INTO jour_reponses (profile_id, jour, question, choix, ms, juste, points, repondue_le, compagnon) VALUES (?, ?, ?, 0, 1000, 1, 100, 1, ?)`)
  for (let j = 0; j < jours; j++) {
    const jour = new Date(Date.UTC(2026, 6, 1 + j)).toISOString().slice(0, 10)
    tirage.run(jour, JSON.stringify(questions))
    for (let q = 0; q < 10; q++) juste.run(id, jour, q, compagnon)
  }
}

/** Ses cadeaux des jours d'avant — sa complicité les compte, ses trouvailles s'en relisent —, et son jardin aménagé. */
function complicite(db: Database.Database, id: string, compagnon: string, objets: readonly string[], jardin: Record<string, string>) {
  const cadeau = db.prepare('INSERT INTO profile_cadeaux (profile_id, compagnon, jour, objet, grand, ouvert_le) VALUES (?, ?, ?, ?, ?, ?)')
  const maintenant = Date.now()
  objets.forEach((objet, i) => {
    const quand = maintenant - (objets.length - i) * JOUR_MS
    cadeau.run(id, compagnon, jourDe(quand), objet, (i + 1) % 7 === 0 ? 1 : 0, quand)
  })
  db.prepare('UPDATE profile_compagnons SET jardin = ? WHERE profile_id = ? AND compagnon = ?').run(JSON.stringify(jardin), id, compagnon)
}

async function contexte(cookie: string) {
  const ctx = await navigateur.newContext({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const [nom, valeur] = cookie.split('=')
  await ctx.addCookies([{ name: nom, value: valeur, url: banc.url }])
  return ctx
}

async function nouvellePage(ctx: any) {
  const page = await ctx.newPage()
  if (encoche) {
    const cdp = await ctx.newCDPSession(page)
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: encoche, topMax: encoche, bottom: 34, bottomMax: 34, left: 0, leftMax: 0, right: 0, rightMax: 0 } })
  }
  page.on('pageerror', (e: Error) => console.error('[page]', e.message))
  return page
}

/** La photo, ses images arrivées — et ce qui déborde de côté. */
async function photo(page: any, nom: string, { pleine = false, attente = 500 } = {}) {
  await page.evaluate('Promise.all([...document.images].map(i => i.decode().catch(() => {})))')
  await patienter(attente)
  await page.screenshot({ path: path.join(sortie, `${nom}.png`), fullPage: pleine })
  const deborde: string[] = await page.evaluate(DEBORDE)
  const ligne = `${nom} : ${deborde.length === 0 ? 'rien ne déborde' : deborde.join(' · ')}`
  rapport.push(ligne)
  console.log(ligne)
}

/** « Mon compagnon », ouvert par son adresse : sa scène et ses envies arrivées. */
async function chezLui(page: any) {
  await page.goto(`${banc.url}/profil#compagnon`)
  await page.waitForSelector('.chez-scene .chez-niche .niche-bete img', { timeout: 15000 })
  await page.waitForSelector('.chez-envies, .chez-ligne, .chez-cadeau-ligne', { timeout: 15000 })
}

/** Léa, son loup adulte, six jours de complicité : son septième cadeau sera le grand. */
async function lea() {
  const cookie = await profil('lea', 'Léa', '🐸', (db, id) => {
    db.prepare('UPDATE profiles SET niche = ? WHERE id = ?').run('loup', id)
    const adopter = db.prepare('INSERT INTO profile_compagnons (profile_id, compagnon, prix, rang, created_at) VALUES (?, ?, 1000, ?, 1)')
    adopter.run(id, 'loup', 2)
    adopter.run(id, 'tortue', 1)
    // 350 bonnes réponses avec lui : l'or de son chemin aux trois quarts, vers le loup des étoiles.
    justesAvecLui(db, id, 'loup', 35)
    complicite(db, id, 'loup', ['gamelle', 'fanions', 'coussin', 'balle', 'gamelle', 'seau'], { s2: 'gamelle', s5: 'fanions' })
    // Son record d'il y a trois jours.
    db.prepare('INSERT INTO profile_cueillettes (profile_id, compagnon, jouee_le, score) VALUES (?, ?, ?, ?)').run(id, 'loup', Date.now() - 3 * JOUR_MS, 18)
  })
  const ctx = await contexte(cookie)
  const page = await nouvellePage(ctx)
  const niche = page.locator('.chez-niche')
  await chezLui(page)
  // Le premier passage du jour : il dort, volets fermés.
  await photo(page, '01-dort', { attente: 900 })
  await niche.click()
  await photo(page, '02-reveil', { attente: 250 })
  await patienter(2600)
  await photo(page, '03-chez')
  await page.screenshot({ path: path.join(sortie, '03b-entier.png'), fullPage: true })
  await niche.click()
  await photo(page, '03c-caresse', { attente: 350 })
  await patienter(1500)

  // Le goûter : sa friandise, du doigt jusqu'à lui.
  await page.locator('.chez-envie', { hasText: 'Goûter' }).click()
  await photo(page, '04-gouter')
  await page.locator('.chez-gestes .chez-pastille.or').click()
  await photo(page, '04b-gouter-vol', { attente: 200 })
  await photo(page, '04c-miam', { attente: 700 })
  await page.waitForSelector('.chez-envie.faite', { timeout: 5000 })
  await patienter(600)

  // Le câlin, du doigt sur sa niche : la jauge se remplit trait par trait.
  await page.locator('.chez-envie', { hasText: 'Câlin' }).click()
  await photo(page, '05-calin')
  const boite = await niche.boundingBox()
  const cx = boite.x + boite.width / 2
  const cy = boite.y + boite.height / 2
  await page.mouse.move(cx - 30, cy)
  await page.mouse.down()
  for (let i = 0; i < 10; i++) await page.mouse.move(cx + (i % 2 ? -30 : 30), cy + (i % 3) * 6, { steps: 4 })
  await page.mouse.up()
  await photo(page, '05b-calin-moitie', { attente: 200 })
  await page.mouse.move(cx - 30, cy)
  await page.mouse.down()
  for (let i = 0; i < 16; i++) await page.mouse.move(cx + (i % 2 ? -30 : 30), cy, { steps: 4 })
  await page.mouse.up()
  await photo(page, '05c-ronron', { attente: 250 })
  await page.waitForSelector('.chez-envie.faite:nth-child(2)', { timeout: 6000 })
  await patienter(600)

  // La cueillette : son intro, une partie le doigt en balayage, sa fin.
  await page.locator('.chez-envie', { hasText: 'Jouer' }).click()
  await page.waitForSelector('.cueillette-carte')
  await photo(page, '06-cueillette')
  await page.getByRole('button', { name: 'C’est parti !' }).click()
  await photo(page, '06b-cueillette-decompte', { attente: 300 })
  await patienter(2200)
  const aire = await page.locator('.cueillette-aire').boundingBox()
  const debut = Date.now()
  let photographiee = false
  while (Date.now() - debut < 31_000) {
    const t = (Date.now() - debut) / 1000
    await page.mouse.move(aire.x + aire.width * (0.5 + 0.42 * Math.sin(t * 2.2)), aire.y + aire.height * 0.8, { steps: 2 })
    if (!photographiee && t > 9) {
      await page.screenshot({ path: path.join(sortie, '06c-cueillette-jeu.png') })
      photographiee = true
    }
    await patienter(40)
  }
  await page.waitForSelector('.cueillette-carte.fin .cueillette-boutons .btn-primary:not([disabled])', { timeout: 10000 })
  await photo(page, '06d-cueillette-fin', { attente: 700 })
  await page.locator('.cueillette-boutons .btn-primary').click()
  await page.waitForSelector('.chez-cadeau-ligne', { timeout: 6000 })
  await page.locator('.chez-carte').first().scrollIntoViewIfNeeded()
  await photo(page, '07-cadeau-ligne', { attente: 700 })

  // Son cadeau, le septième jour : le grand, doré, qui ouvre la cour.
  await page.locator('.chez-cadeau-ligne').click()
  await page.waitForSelector('.cadeau-paquet')
  await photo(page, '07b-cadeau')
  await page.locator('.cadeau-paquet').click()
  await page.waitForSelector('.cadeau-objet')
  await photo(page, '07c-cadeau-ouvert', { attente: 1000 })
  await page.locator('.cadeau-boutons .btn-primary').click()
  await page.waitForSelector('.chez-toast', { timeout: 6000 })
  await page.evaluate('window.scrollTo(0, 0)')
  await photo(page, '07d-posee', { attente: 900 })

  // « Décorer » : son jardin, une place choisie, ses trouvailles ; puis sa niche.
  await page.locator('.chez-gestes .chez-pastille', { hasText: 'Décorer' }).click()
  await page.waitForSelector('.decorer-cadre .jardin-terrain')
  await photo(page, '08-decorer', { attente: 700 })
  const libre = page.locator('.decorer-cadre .jardin-libre').first()
  if (await libre.count()) {
    await libre.click()
    await photo(page, '08b-decorer-place')
  }
  await page.evaluate(`document.querySelector('.decorer-feuille .carte-corps').scrollTo(0, document.querySelector('.decorer-grille').offsetTop - 120)`)
  await photo(page, '08c-decorer-trouvailles')
  await page.getByRole('tab', { name: 'Sa niche' }).click()
  await photo(page, '08d-decorer-niche')
  await page.locator('.decorer-feuille .carte-fermer').click()

  // La galerie : les quatre, puis la fiche du chat et celle de la luciole.
  await page.getByRole('button', { name: /Tous les voir/ }).click()
  await page.waitForSelector('.galerie-grille .galerie-carte')
  await photo(page, '09-galerie', { attente: 900 })
  await page.locator('.galerie-carte', { hasText: 'chat' }).first().click()
  await page.waitForSelector('.galerie-fiche')
  await photo(page, '09b-fiche-chat', { attente: 900 })
  // L'adopter d'ici, sans passer par la boutique : le loup garde sa niche, et le chat reçoit son nom.
  await page.locator('.galerie-cta.btn-primary').click()
  await page.waitForSelector('.dialog-backdrop')
  await photo(page, '09d-adopter', { attente: 400 })
  await page.getByRole('button', { name: 'L’adopter seulement' }).click()
  await page.waitForSelector('.galerie-bienvenue')
  await page.locator('#galerie-nom').fill('Mochi')
  await photo(page, '09e-bienvenue', { attente: 900 })
  await page.locator('.galerie-bienvenue .btn-primary').click()
  await page.waitForSelector('.galerie-fiche')
  await photo(page, '09f-adopte', { attente: 700 })
  await page.locator('.galerie-retour').click()
  await page.locator('.galerie-carte', { hasText: /luciole/i }).first().click()
  await page.waitForSelector('.galerie-fiche')
  await photo(page, '09c-fiche-luciole', { attente: 900 })
  await page.locator('.galerie-feuille .carte-fermer').last().click()

  // Une forme de son chemin regardée : sa forme ultime, dans sa niche, le temps de la regarder.
  await page.locator('.chez-etape').nth(3).click()
  await page.evaluate('window.scrollTo(0, 0)')
  await photo(page, '10-apercu', { attente: 700 })
  await page.locator('.chez-pastille', { hasText: 'Revenir' }).click()

  await page.locator('.chez-info').click()
  await photo(page, '11-info')
  await page.locator('.chez-feuille .carte-fermer').click()
  await page.locator('.chez-plaque').click()
  await photo(page, '12-nom')
  await page.keyboard.press('Escape')
  await page.screenshot({ path: path.join(sortie, '13-entier-apres.png'), fullPage: true })
  // La tortue installée d'un toucher dans « Tes compagnons » : la page passe à elle — son premier passage du jour, elle dort.
  await page.locator('.chez-ami', { hasText: 'Tortue' }).click()
  await page.waitForSelector('.chez-scene .chez-niche.niche-tortue', { timeout: 8000 })
  await page.evaluate('window.scrollTo(0, 0)')
  await photo(page, '14-tortue', { attente: 1200 })
  await ctx.close()
}

/** Max, son chat, soixante-quatre jours de complicité : tout le domaine, ses dix places. */
async function max() {
  const objets = Array.from({ length: 64 }, (_, i) => TROUVAILLES.filter(t => !t.exploit)[i % 28].cle)
  const cookie = await profil('max', 'Max', '🦊', (db, id) => {
    db.prepare('UPDATE profiles SET niche = ? WHERE id = ?').run('chat', id)
    db.prepare('INSERT INTO profile_compagnons (profile_id, compagnon, prix, rang, created_at) VALUES (?, ?, 1000, ?, 1)').run(id, 'chat', 1)
    justesAvecLui(db, id, 'chat', 15)
    complicite(db, id, 'chat', objets, {
      s1: 'lanterne',
      s2: 'feu',
      s3: 'pelote',
      s4: 'tournesols',
      s5: 'lune',
      s6: 'cerisier',
      s7: 'bassin',
      s8: 'cabane',
      s9: 'champignons',
      s10: 'arcenciel',
    })
    // Le goûter et le câlin d'aujourd'hui : réveillé, il attend sa partie.
    const envie = db.prepare('INSERT INTO profile_envies (profile_id, compagnon, jour, envie, faite_le) VALUES (?, ?, ?, ?, ?)')
    envie.run(id, 'chat', jourDe(Date.now()), 'gouter', Date.now())
    envie.run(id, 'chat', jourDe(Date.now()), 'calin', Date.now())
  })
  const ctx = await contexte(cookie)
  const page = await nouvellePage(ctx)
  await chezLui(page)
  await photo(page, '20-max-domaine', { attente: 900 })
  if (await page.locator('.chez-scene .jardin-fleche.droite').count()) {
    await page.locator('.chez-scene .jardin-fleche.droite').click()
    await photo(page, '20b-max-a-droite', { attente: 900 })
  }
  await page.evaluate(`document.querySelector('.chez-scene .jardin-panorama').scrollTo({ left: 0 })`)
  await photo(page, '20c-max-a-gauche', { attente: 700 })
  await page.locator('.chez-gestes .chez-pastille', { hasText: 'Décorer' }).click()
  await page.waitForSelector('.decorer-cadre .jardin-terrain')
  await photo(page, '21-max-decorer', { attente: 700 })
  await ctx.close()
}

/** Zoé, sans compagnon : tous ceux qu'elle peut avoir, sans passer par la boutique. */
async function zoe() {
  const cookie = await profil('zoe', 'Zoé', '🐼', () => {})
  const ctx = await contexte(cookie)
  const page = await nouvellePage(ctx)
  await page.goto(`${banc.url}/profil#compagnon`)
  await page.waitForSelector('.profil-sans-compagnon')
  await photo(page, '30-zoe-sans-compagnon')
  await page.getByRole('button', { name: 'Voir les compagnons' }).click()
  await page.waitForSelector('.galerie-grille .galerie-carte')
  await photo(page, '30b-zoe-galerie', { attente: 900 })
  // Son premier compagnon, adopté d'ici : la page passe chez lui sous la galerie, qui garde son accueil et le nom à donner.
  await page.locator('.galerie-carte', { hasText: 'Loup' }).first().click()
  await page.locator('.galerie-cta.btn-primary').click()
  await page.locator('.dialog-backdrop').getByRole('button', { name: /L’adopter/ }).click()
  await page.waitForSelector('.galerie-bienvenue')
  await page.waitForSelector('.chez-scene', { state: 'attached', timeout: 8000 })
  await page.locator('#galerie-nom').fill('Grisou')
  await photo(page, '30c-zoe-bienvenue', { attente: 900 })
  await page.locator('.galerie-bienvenue .btn-primary').click()
  await page.waitForSelector('.galerie-fiche')
  await page.locator('.galerie-feuille .carte-fermer').last().click()
  await page.waitForSelector('.chez-plaque >> text=Grisou', { timeout: 8000 })
  await photo(page, '30d-zoe-chez-lui', { attente: 900 })
  await ctx.close()
}

try {
  if (!seulement || seulement === 'lea') await lea()
  if (!seulement || seulement === 'max') await max()
  if (!seulement || seulement === 'zoe') await zoe()
} finally {
  console.log(`\n${rapport.filter(l => !l.endsWith('rien ne déborde')).length} photo(s) où quelque chose déborde, sur ${rapport.length} — dans ${sortie}`)
  await navigateur.close()
  await banc.close()
}
process.exit(0)
