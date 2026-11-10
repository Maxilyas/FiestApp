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
// Puis ce qui tient sur l'écran (la passe `tailles`) : « Dans la mesure du
// possible j'aimerais que l'on puisse avoir tout sur le même écran ou presque »
// (le propriétaire, le 10 novembre 2026). Sa page à six tailles de téléphone,
// du petit téléphone de référence (360 × 640) au grand (412 × 915), dont un
// iPhone dans Safari (390 × 664) et un grand Android dans Chrome (412 × 800),
// dans chacun de ses états, ouvert tel quel : il dort, réveillé, le goûter, le
// câlin, une forme de son chemin regardée, son grand cadeau prêt, son cadeau
// du jour, tout fait pour aujourd'hui, un domaine qui défile, sans compagnon —
// et sous le bandeau du service, mesuré sans rien exiger. À chaque photo : où
// finissent sa scène, ses envies, son chemin et ses compagnons — le pli est le
// haut de la barre du menu —, de combien la page défile, la pastille de ses
// gestes sous sa plaque, ce que dit la ligne de son cadeau, chaque cible de
// doigt sondée au demi-pixel, le plus petit texte, ce qui passe sous la niche,
// et où tombe son titre, image par image, pendant que la page se charge. Le
// script sort en erreur si ce qui doit tenir ne tient plus : sa scène, ses
// envies et son chemin partout, le titre de « Tes compagnons » avec eux ;
// toute sa page dès 740 px de haut, sans défiler dès 800 ; ceux qu'on peut
// adopter, sans compagnon ; une cible sous 44 px, un texte sous 11 ; la ligne
// de son cadeau coupée au bout ; son jardin qui défile de haut en bas dans sa
// scène ; son titre qui bouge à l'arrivée de la page.
//
//   npx tsx scripts/rendu-compagnon.ts [dossier]
//
// `ECRAN=390x844` : la taille du tour (360 × 640 d'office) ; `ENCOCHE=47` : un
// iPhone en application installée, son encoche et sa barre d'accueil — la
// passe `tailles` ne joue alors que le 390 × 844 ; `THEME=ivoire` ;
// `SEULEMENT=lea,max,zoe,tailles` : ces tours-là ; `ETATS=chez,cadeau` : ces
// états de la passe `tailles` ; `TAILLES=768x1024,412x1100` : d'autres tailles,
// et `TEXTE=130` : le texte agrandi, qu'elle mesure sans rien exiger ;
// `CLIENT_DIST` : un autre client construit.
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { connexionAnimateur, demarrer, ecrire, inscrireProfil, patienter } from '../test/banc'
import { VERSION_BAREME } from '../src/auth/profiles'
import { xpDuNiveau } from '../../shared/profil'
import { jourDe } from '../../shared/jour'
import { TROUVAILLES } from '../../shared/trouvailles'
import { SOUS_LA_NICHE } from './a-l-ecran'

const sortie = path.resolve(process.argv[2] ?? 'rendu-compagnon')
mkdirSync(sortie, { recursive: true })
const [largeur, hauteur] = (process.env.ECRAN ?? '360x640').split('x').map(Number)
const theme = process.env.THEME ?? null
const encoche = Number(process.env.ENCOCHE ?? 0)
const seulement = (process.env.SEULEMENT ?? '').split(',').filter(Boolean)
const retenu = (nom: string) => !seulement.length || seulement.includes(nom)

type Ecran = [number, number]
/**
 * Le petit téléphone de référence, un iPhone dans Safari (ses barres dépliées), un moyen, un grand Android dans Chrome,
 * un iPhone d'aujourd'hui en application installée, un grand Android.
 */
const SIX_TAILLES: Ecran[] = [[360, 640], [390, 664], [360, 740], [412, 800], [390, 844], [412, 915]]
/** D'autres tailles pour la passe `tailles`, si on le demande (`TAILLES=768x1024,412x1100`) : une tablette, un écran plus haut que tous les téléphones. */
const AUTRES_TAILLES: Ecran[] | null = process.env.TAILLES ? process.env.TAILLES.split(',').map(t => t.split('x').map(Number) as Ecran) : null
/** Le texte agrandi, en pour cent (`TEXTE=130`), pour la passe `tailles` : ce qui grandit avec lui ne tient plus, et se mesure sans rien exiger. */
const texteAgrandi = Number(process.env.TEXTE ?? 0)

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'rendu.js'))('playwright')
}
const { chromium } = chargerPlaywright()

// Le cadeau tiré au même endroit à chaque rendu : le grand cadeau de Léa, une épique. `CLIENT_DIST` sert un autre client
// construit que celui du dépôt — celui d'avant une retouche, pour comparer deux rendus photo par photo.
const banc = await demarrer({ hasardDuCadeau: () => 0.9, ...(process.env.CLIENT_DIST && { clientDist: path.resolve(process.env.CLIENT_DIST) }) })
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

/**
 * Ce que la page mesure, bloc par bloc, le pli étant le haut de la barre du menu : où finissent sa tête, sa scène, la
 * pastille de ses gestes, ses envies, son chemin et ses compagnons ; de combien elle défile ; si elle déborde en
 * largeur ; l'échelle de sa scène, et ce qui s'y serre quand elle rétrécit — la pastille de ses gestes entière dans
 * son cadre, sous sa plaque sans la toucher, sa niche sous le bord du haut ; son plus petit texte. En texte, comme
 * `DEBORDE`.
 */
const LA_PAGE = `(() => {
  const menu = document.querySelector('.menu-barre')
  const pli = Math.round(menu ? menu.getBoundingClientRect().top : innerHeight)
  const boite = el => {
    if (!el) return null
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0 ? { haut: Math.round(r.top + scrollY), bas: Math.round(r.bottom + scrollY) } : null
  }
  const un = sel => boite(document.querySelector(sel))
  const rect = sel => { const el = document.querySelector(sel); return el ? el.getBoundingClientRect() : null }
  const dixieme = n => Math.round(n * 10) / 10
  const cartes = [...document.querySelectorAll('.chez-lui > .chez-carte')]
  const scene = document.querySelector('.chez-scene')
  const s = scene ? scene.getBoundingClientRect() : null
  const pastilles = [...document.querySelectorAll('.chez-gestes > *')].map(el => el.getBoundingClientRect()).filter(r => r.width > 0)
  const plaque = rect('.chez-plaque'), niche = rect('.chez-niche')
  const hautDesGestes = pastilles.length ? Math.min(...pastilles.map(r => r.top)) : null
  let petit = null
  const marcheur = document.createTreeWalker(document.querySelector('.player-shell'), NodeFilter.SHOW_TEXT)
  for (let t = marcheur.nextNode(); t; t = marcheur.nextNode()) {
    const el = t.parentElement
    if (!el || !t.textContent.trim() || el.closest('.sr-only, .menu-barre, script, style')) continue
    const r = el.getBoundingClientRect()
    // Caché à l'œil — une boîte d'un pixel, comme \`.sr-only\` — : il ne se lit qu'à l'oreille, sa taille ne compte pas.
    if (r.width < 2 || r.height < 2) continue
    const taille = parseFloat(getComputedStyle(el).fontSize)
    if (!petit || taille < petit.taille) petit = { taille, texte: [...t.textContent.trim()].slice(0, 24).join('') }
  }
  return {
    ecran: innerWidth + '×' + innerHeight,
    pli,
    defile: Math.max(0, document.documentElement.scrollHeight - innerHeight),
    large: document.documentElement.scrollWidth > innerWidth + 1,
    bandeau: (() => { const b = document.querySelector('#root .bandeau-du-service'); return b ? Math.round(b.parentElement.getBoundingClientRect().height) : 0 })(),
    k: scene ? Number(getComputedStyle(scene).getPropertyValue('--k')) : null,
    sortie: un('.player-shell > .jour-sortie'),
    tete: un('.chez-lui > .piece-tete, .player-shell > .piece-tete'),
    scene: boite(scene),
    gestes: pastilles.length ? { haut: Math.round(hautDesGestes + scrollY), bas: Math.round(Math.max(...pastilles.map(r => r.bottom)) + scrollY) } : null,
    gestesCoupes: s ? pastilles.filter(r => r.left < s.left - 0.5 || r.right > s.right + 0.5 || r.bottom > s.bottom + 0.5).length : 0,
    sousLaPlaque: plaque && hautDesGestes !== null ? dixieme(hautDesGestes - plaque.bottom) : null,
    nicheSousLeBord: niche && s ? dixieme(niche.top - s.top) : null,
    largeurDeLaNiche: niche ? dixieme(niche.width) : null,
    // Sa scène rognée, son terrain s'arrête avec elle : son jardin ne défile que de côté.
    jardinDeHautEnBas: (() => { const p = document.querySelector('.chez-scene .jardin-panorama'); return p ? p.scrollHeight - p.clientHeight : 0 })(),
    envies: boite(cartes[0]),
    chemin: boite(cartes[1]),
    amis: boite(cartes[2]),
    titreDesAmis: cartes[2] ? boite(cartes[2].querySelector('.chez-carte-tete')) : null,
    // La ligne de son cadeau : ce qu'elle montre sous son titre — l'essentiel, et ceux de ses morceaux qui tiennent sur sa ligne —, et si l'essentiel même est coupé au bout.
    cadeau: (() => {
      const essentiel = document.querySelector('.chez-cadeau-essentiel')
      if (!essentiel) return null
      const haut = essentiel.getBoundingClientRect().top
      const montre = [...essentiel.parentElement.children].filter(e => Math.abs(e.getBoundingClientRect().top - haut) < 2).map(e => e.textContent).join('')
      return { montre, coupe: essentiel.scrollWidth > essentiel.clientWidth + 1, titre: Math.round(document.querySelector('.chez-cadeau-texte b').getBoundingClientRect().height) }
    })(),
    sans: un('.profil-sans-compagnon'),
    voir: un('.profil-sans-compagnon > .btn'),
    petit,
  }
})()`

/**
 * Image par image, pendant que la page se charge : où tombe son titre. Sa tête se resserre sur un téléphone, et ses
 * mesures sont posées sur la coquille dès qu'on est chez lui (`.chez-page`) : posées par sa page à lui, qui n'arrive
 * qu'avec son code, le titre serait remonté sous le doigt à son arrivée.
 */
const SUIVRE_LE_TITRE = `(() => {
  const vus = []
  window.__leTitre = vus
  const voir = () => {
    const el = document.querySelector('.player-shell > .piece-tete h1, .chez-lui > .piece-tete h1')
    if (el) {
      const haut = Math.round(el.getBoundingClientRect().top)
      if (vus[vus.length - 1] !== haut) vus.push(haut)
    }
    requestAnimationFrame(voir)
  }
  requestAnimationFrame(voir)
})()`

/**
 * Les cibles de doigt de la page : chaque bouton, chaque lien, et ce qu'un doigt y touche vraiment — sondé de demi-pixel
 * en demi-pixel depuis son milieu (`elementFromPoint`) : une pastille basse que son `::before` élargit compte avec
 * lui, un bouton à demi couvert par son voisin sans ce qu'il couvre. La page défile jusqu'à chacune : à lancer après
 * la photo.
 */
const LES_CIBLES = `(() => {
  const vues = []
  for (const el of document.querySelectorAll('.player-shell a, .player-shell button')) {
    if (el.closest('.menu-barre, .carte-voile, .dialog-backdrop')) continue
    const boite = el.getBoundingClientRect()
    if (boite.width < 1 || boite.height < 1) continue
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' })
    const r = el.getBoundingClientRect()
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2
    const dedans = (x, y) => { const e = document.elementFromPoint(x, y); return !!e && el.contains(e) }
    let h = 0, l = 0
    if (dedans(cx, cy)) {
      h = l = 0.5
      for (let y = cy - 0.5; dedans(cx, y); y -= 0.5) h += 0.5
      for (let y = cy + 0.5; dedans(cx, y); y += 0.5) h += 0.5
      for (let x = cx - 0.5; dedans(x, cy); x -= 0.5) l += 0.5
      for (let x = cx + 0.5; dedans(x, cy); x += 0.5) l += 0.5
    }
    vues.push({ nom: (el.getAttribute('class') || el.tagName.toLowerCase()).split(/\\s+/)[0], dit: [...(el.getAttribute('aria-label') || el.textContent || '').trim()].slice(0, 28).join(''), l, h })
  }
  scrollTo(0, 0)
  return vues
})()`

/** Un profil et ce que la base lui donne d'avance, puis le serveur relancé : il relit ses compagnons — une fois pour plusieurs, si l'on préfère (`relance`). */
async function profil(login: string, prenom: string, avatar: string, remplir: (db: Database.Database, id: string) => void, relance = true): Promise<string> {
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
  if (relance) await relancer([cookie])
  return cookie
}

/** Le serveur relancé — ce qui s'est écrit derrière son dos ne se lit qu'après —, et le thème voulu porté par chacun. */
async function relancer(cookies: string[]) {
  await banc.redemarrer()
  if (theme) for (const cookie of cookies) await ecrire(banc.url, '/api/joueur/moi', { theme }, cookie, 'PUT')
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

async function contexte(cookie: string, [l, h]: Ecran = [largeur, hauteur], reglages: object = {}) {
  const ctx = await navigateur.newContext({ viewport: { width: l, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ...reglages })
  const [nom, valeur] = cookie.split('=')
  await ctx.addCookies([{ name: nom, value: valeur, url: banc.url }])
  return ctx
}

async function nouvellePage(ctx: any, avecEncoche = true) {
  const page = await ctx.newPage()
  if (encoche && avecEncoche) {
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

/** Ce que la page mesure à une taille, dans un état. */
type Mesure = Record<string, any>
const mesures: Record<string, Mesure> = {}
let rate = 0

/**
 * Sa page aux six tailles de téléphone, dans chacun de ses états : ce qui tient au-dessus du menu, bloc par bloc.
 * Sept profils, pour que chaque état s'ouvre tel quel, sans rien rejouer : Inès et Croc, son loup adulte — rien de
 * fait aujourd'hui : il dort au premier passage du jour, puis ses trois envies, le goûter, le câlin, une forme de son
 * chemin regardée — ; Paul et son loup au nom de seize lettres, ses trois envies comblées le septième jour — son
 * grand cadeau l'attend, la plus longue des lignes — ; Jade et son louveteau sans nom, son cadeau du jour ; Rose et
 * Mochi, sa chatte au bout de son chemin, sa niche ornée de partout, tout fait pour aujourd'hui, tous ses compagnons
 * adoptés sauf un ; Sam, la même chatte et rien de fait aujourd'hui, le plus haut de tous ; Lou et son domaine, plus
 * large que l'écran ; Noé, sans compagnon.
 */
async function tailles() {
  const maintenant = Date.now()
  const jour = jourDe(maintenant)
  const adopter = (db: Database.Database, id: string, compagnon: string, rang: number, nom: string | null, paliers = 0) => {
    db.prepare('INSERT INTO profile_compagnons (profile_id, compagnon, prix, rang, nom, paliers, created_at) VALUES (?, ?, 1000, ?, ?, ?, 1)').run(id, compagnon, rang, nom, paliers)
  }
  const enviesDuJour = (db: Database.Database, id: string, compagnon: string) => {
    const envie = db.prepare('INSERT INTO profile_envies (profile_id, compagnon, jour, envie, faite_le) VALUES (?, ?, ?, ?, ?)')
    for (const e of ['gouter', 'calin', 'jeu']) envie.run(id, compagnon, jour, e, maintenant)
  }
  const ines = await profil(
    'ines',
    'Inès',
    '🐱',
    (db, id) => {
      db.prepare('UPDATE profiles SET niche = ? WHERE id = ?').run('loup', id)
      adopter(db, id, 'loup', 2, 'Croc')
      adopter(db, id, 'tortue', 1, null)
      justesAvecLui(db, id, 'loup', 35)
      complicite(db, id, 'loup', ['gamelle', 'fanions', 'coussin', 'balle', 'gamelle', 'seau'], { s2: 'gamelle', s5: 'fanions' })
    },
    false,
  )
  const paul = await profil(
    'paul',
    'Paul',
    '🐻',
    (db, id) => {
      db.prepare('UPDATE profiles SET niche = ? WHERE id = ?').run('loup', id)
      adopter(db, id, 'loup', 1, 'Capitaine Flocon')
      justesAvecLui(db, id, 'loup', 12)
      complicite(db, id, 'loup', ['gamelle', 'fanions', 'coussin', 'balle', 'gamelle', 'seau'], { s2: 'gamelle', s3: 'balle', s5: 'fanions' })
      enviesDuJour(db, id, 'loup')
    },
    false,
  )
  const rose = await profil(
    'rose',
    'Rose',
    '🦉',
    (db, id) => {
      db.prepare('UPDATE profiles SET niche = ? WHERE id = ?').run('chat', id)
      // Au bout de son chemin : sa forme ultime et ses quatre ornements, peints — sa niche déborde de partout.
      adopter(db, id, 'chat', 3, 'Mochi', 4)
      adopter(db, id, 'loup', 3, 'Nox')
      adopter(db, id, 'tortue', 2, null)
      adopter(db, id, 'panda', 0, 'Petit Bambou Roux')
      justesAvecLui(db, id, 'chat', 40)
      complicite(db, id, 'chat', ['lanterne', 'pelote', 'tournesols', 'lune', 'gamelle', 'seau'], { s1: 'lanterne', s2: 'pelote', s3: 'gamelle', s4: 'tournesols', s5: 'lune' })
      enviesDuJour(db, id, 'chat')
      db.prepare('INSERT INTO profile_cadeaux (profile_id, compagnon, jour, objet, grand, ouvert_le) VALUES (?, ?, ?, ?, 1, ?)').run(id, 'chat', jour, 'feu', maintenant)
    },
    false,
  )
  // Lou et son chat, soixante-quatre jours de complicité : le domaine, plus large que l'écran, ses deux flèches au
  // bas de la scène ; le goûter et le câlin d'aujourd'hui faits, sa partie à jouer.
  const lou = await profil(
    'lou',
    'Lou',
    '🦊',
    (db, id) => {
      db.prepare('UPDATE profiles SET niche = ? WHERE id = ?').run('chat', id)
      adopter(db, id, 'chat', 1, null)
      justesAvecLui(db, id, 'chat', 15)
      const objets = Array.from({ length: 64 }, (_, i) => TROUVAILLES.filter(t => !t.exploit)[i % 28].cle)
      complicite(db, id, 'chat', objets, { s1: 'lanterne', s2: 'feu', s3: 'pelote', s4: 'tournesols', s5: 'lune', s6: 'cerisier', s7: 'bassin', s8: 'cabane', s9: 'champignons', s10: 'arcenciel' })
      const envie = db.prepare('INSERT INTO profile_envies (profile_id, compagnon, jour, envie, faite_le) VALUES (?, ?, ?, ?, ?)')
      for (const e of ['gouter', 'calin']) envie.run(id, 'chat', jour, e, maintenant)
    },
    false,
  )
  // Jade et son loup sans nom, trois jours de complicité : ses trois envies comblées, son cadeau du jour l'attend.
  const jade = await profil(
    'jade',
    'Jade',
    '🐰',
    (db, id) => {
      db.prepare('UPDATE profiles SET niche = ? WHERE id = ?').run('loup', id)
      adopter(db, id, 'loup', 0, null)
      complicite(db, id, 'loup', ['gamelle', 'fanions', 'coussin'], { s2: 'gamelle' })
      enviesDuJour(db, id, 'loup')
    },
    false,
  )
  const noe = await profil('noe', 'Noé', '🐼', () => {}, false)
  // Sam et sa chatte au bout de son chemin, comme celle de Rose — sa niche ornée, les titres de son chemin sur deux
  // lignes —, mais rien de fait aujourd'hui : la plus haute des cartes d'envies au-dessus du plus haut des chemins.
  // Le pire cas d'un téléphone : d'abord calculé seulement (5 px sous le menu en 360 × 740), il se mesure ici.
  const sam = await profil(
    'sam',
    'Sam',
    '🦁',
    (db, id) => {
      db.prepare('UPDATE profiles SET niche = ? WHERE id = ?').run('chat', id)
      adopter(db, id, 'chat', 3, 'Mochi', 4)
      adopter(db, id, 'loup', 3, 'Nox')
      adopter(db, id, 'tortue', 2, null)
      adopter(db, id, 'panda', 0, 'Petit Bambou Roux')
      justesAvecLui(db, id, 'chat', 40)
      complicite(db, id, 'chat', ['lanterne', 'pelote', 'tournesols', 'lune', 'gamelle', 'seau'], { s1: 'lanterne', s2: 'pelote', s3: 'gamelle', s4: 'tournesols', s5: 'lune' })
    },
    false,
  )
  await relancer([ines, paul, rose, lou, jade, noe, sam])

  /** Réveillé d'avance sur ce téléphone : sinon, au premier passage du jour, il dort. */
  const reveille = `try { localStorage.setItem('quizz.compagnon.reveil', ${JSON.stringify(`${jour}:loup`)}) } catch {}`
  const reveilleLeChat = `try { localStorage.setItem('quizz.compagnon.reveil', ${JSON.stringify(`${jour}:chat`)}) } catch {}`
  type Etat = { nom: string; cookie: string; avant?: string; attendu: string; geste?: (page: any) => Promise<void> }
  const ETATS: Etat[] = [
    { nom: 'dort', cookie: ines, attendu: '.chez-ligne.endormi' },
    { nom: 'chez', cookie: ines, avant: reveille, attendu: '.chez-envies' },
    {
      nom: 'gouter',
      cookie: ines,
      avant: reveille,
      attendu: '.chez-envies',
      geste: async page => {
        await page.locator('.chez-envie', { hasText: 'Goûter' }).click()
        await page.waitForSelector('.chez-gestes .chez-pastille.or')
      },
    },
    {
      nom: 'calin',
      cookie: ines,
      avant: reveille,
      attendu: '.chez-envies',
      geste: async page => {
        await page.locator('.chez-envie', { hasText: 'Câlin' }).click()
        await page.waitForSelector('.chez-jauge-calin')
      },
    },
    {
      // Sa première forme, regardée : « Revenir » et « La montrer dans sa niche », les deux pastilles côte à côte.
      nom: 'apercu',
      cookie: ines,
      avant: reveille,
      attendu: '.chez-envies',
      geste: async page => {
        await page.locator('.chez-etape').first().click()
        await page.waitForSelector('.chez-gestes .chez-pastille.or')
      },
    },
    { nom: 'cadeau', cookie: paul, attendu: '.chez-cadeau-ligne' },
    { nom: 'cadeau-du-jour', cookie: jade, attendu: '.chez-cadeau-ligne' },
    { nom: 'demain', cookie: rose, attendu: '.chez-ligne:not(.endormi)' },
    { nom: 'domaine', cookie: lou, attendu: '.chez-envies' },
    { nom: 'veteran', cookie: sam, avant: reveilleLeChat, attendu: '.chez-envies' },
    { nom: 'sans', cookie: noe, attendu: '.profil-sans-compagnon' },
    // Sous le bandeau du service — une panne que l'administrateur annonce, 58 px de moins : mesuré, sans rien exiger.
    { nom: 'bandeau', cookie: ines, avant: reveille, attendu: '.chez-envies' },
  ]
  const etatsVoulus = (process.env.ETATS ?? '').split(',').filter(Boolean)
  let admin: string | null = null
  const poserLeBandeau = async (texte: string | null) => {
    admin ??= await connexionAnimateur(banc.url)
    const r = await ecrire(banc.url, '/api/admin/maintenance/bandeau', { texte }, admin, 'PUT')
    if (!r.ok) throw new Error(`Le bandeau du service ne se pose pas (${r.status} ${await r.text()})`)
  }
  for (const etat of ETATS.filter(e => !etatsVoulus.length || etatsVoulus.includes(e.nom))) {
    if (etat.nom === 'bandeau') await poserLeBandeau('Le quiz du jour est en panne depuis ce matin : on répare, merci de votre patience !')
    // Une encoche ne se pose que sur un écran qui en a une : un iPhone d'aujourd'hui, pas le petit téléphone de référence.
    for (const ecran of AUTRES_TAILLES ?? (encoche ? ([[390, 844]] as Ecran[]) : SIX_TAILLES)) {
      const ctx = await contexte(etat.cookie, ecran, { reducedMotion: 'reduce' })
      if (etat.avant) await ctx.addInitScript(etat.avant)
      await ctx.addInitScript(SUIVRE_LE_TITRE)
      const page = await nouvellePage(ctx)
      await page.goto(`${banc.url}/profil#compagnon`)
      await page.waitForSelector(etat.attendu, { timeout: 15000 })
      if (etat.nom !== 'sans') await page.waitForSelector('.chez-scene .chez-niche .niche-bete img', { timeout: 15000 })
      if (etat.nom === 'bandeau') await page.waitForSelector('#root .bandeau-du-service', { timeout: 15000 })
      await page.waitForLoadState('networkidle').catch(() => {})
      if (etat.geste) await etat.geste(page)
      await page.evaluate('window.scrollTo(0, 0)')
      await page.evaluate('Promise.all([...document.images].map(i => i.decode().catch(() => {})))')
      await page.evaluate('document.fonts.ready')
      await patienter(500)
      // Avant d'agrandir le texte : c'est le script qui ferait bouger le titre, pas la page.
      const titre = (await page.evaluate('window.__leTitre')) as number[]
      if (texteAgrandi) {
        await page.addStyleTag({ content: `html { font-size: ${texteAgrandi}% !important; }` })
        await patienter(500)
      }
      const n = `tailles-${etat.nom}-${ecran[0]}x${ecran[1]}`
      const m = { ...((await page.evaluate(LA_PAGE)) as Mesure), deborde: (await page.evaluate(DEBORDE)) as string[], sousLaNiche: (await page.evaluate(SOUS_LA_NICHE)) as string[], titre } as Mesure
      await page.screenshot({ path: path.join(sortie, `${n}.png`) })
      if (m.defile > 0) {
        // La barre du menu, fixe, se poserait au milieu de la page entière : elle s'efface le temps de la photo.
        const style = await page.addStyleTag({ content: '.menu-barre { display: none !important; }' })
        await page.screenshot({ path: path.join(sortie, `${n}-entiere.png`), fullPage: true })
        await style.evaluate((s: any) => s.remove())
      }
      m.cibles = await page.evaluate(LES_CIBLES)
      mesures[n] = m
      await ctx.close()
      direLaMesure(n, etat.nom, ecran, m)
    }
    if (etat.nom === 'bandeau') await poserLeBandeau(null)
  }
}

/**
 * À partir de cette hauteur d'écran, toute sa page tient au-dessus du menu, « Tes compagnons » compris (mesuré le
 * 10 novembre 2026 : 8 px de libre en 360 × 740). Plus bas — le petit téléphone de référence, un iPhone dans Safari —,
 * il n'y a pas la place : sa scène, ses envies, son chemin et le titre de « Tes compagnons » se voient, sa rangée se
 * lit dessous.
 */
const TOUT_TIENT_DES = 740
/** Et à partir de celle-ci, la page ne défile plus du tout : en 360 × 740, elle tient au pixel — un rien d'arrondi la ferait défiler d'un. */
const NE_DEFILE_PLUS_DES = 800
/**
 * Un vétéran, lui — l'état `veteran` : un titre de son chemin sur deux lignes (« Amis pour la vie », dans une colonne
 * de 66 px), ses trois envies à combler —, a treize pixels de plus dans la carte de son chemin : tout ne tient qu'à
 * partir de 800 px de haut. En 360 × 740, le cadre de « Tes compagnons » passe de 5 px sous le menu, sans une ligne de
 * texte avec lui (mesuré le 10 novembre 2026) : le script tient ce chiffre, il ne promet pas mieux. Plus bas, sa
 * scène, ses envies et son chemin, comme tout le monde ; le titre de « Tes compagnons » passe dessous (7 px en
 * 360 × 640).
 */
const UN_VETERAN_TIENT_DES = 800
const CADRE_D_UN_VETERAN = 5
/** Une cible de doigt, à un demi-pixel près : la sonde avance par demi-pixels. */
const CIBLE = 44

/**
 * Une mesure, dite en une ligne : chaque bloc, entier au-dessus du menu ou de combien il passe dessous — et ce qui
 * devait tenir et ne tient plus, qui fait sortir le script en erreur. Aux six tailles et sur l'iPhone à encoche ; une
 * autre taille demandée (`TAILLES`), le texte agrandi (`TEXTE`) et le bandeau du service ne font que se mesurer.
 */
function direLaMesure(n: string, etat: string, [, hauteur]: Ecran, m: Mesure) {
  const sous = (b: { bas: number } | null) => (b ? b.bas - m.pli : null)
  const dit = (quoi: string, b: { haut: number; bas: number } | null) => {
    const de = sous(b)
    if (de === null || !b) return null
    return de <= 0 ? `${quoi} entier (${-de} px de libre)` : b.haut >= m.pli ? `${quoi} SOUS LE MENU (commence ${b.haut - m.pli} px dessous)` : `${quoi} coupé (${de} px sous le menu)`
  }
  const basses = (m.cibles as { nom: string; dit: string; l: number; h: number }[]).filter(c => Math.min(c.l, c.h) < CIBLE - 0.5)
  const dessous = (m.sousLaNiche as string[]).filter(x => x !== '(pas de niche)')
  // Son titre, d'une image à l'autre pendant le chargement : un pixel d'écart est un arrondi, il ne se voit pas.
  const titreBouge = (m.titre as number[]).length > 0 && Math.max(...(m.titre as number[])) - Math.min(...(m.titre as number[])) > 1
  const manques: string[] = []
  if (titreBouge) manques.push('son titre a bougé pendant le chargement')
  if (!AUTRES_TAILLES && !texteAgrandi && etat !== 'bandeau') {
    const doit = (quoi: string, b: { bas: number } | null) => {
      const de = sous(b)
      if (de === null) manques.push(`${quoi} : introuvable`)
      else if (de > 0) manques.push(`${quoi} : ${de} px sous le menu`)
    }
    if (etat === 'sans') doit('ceux qu’on peut adopter', m.sans)
    else {
      doit('sa scène', m.scene)
      doit('la pastille de ses gestes', m.gestes)
      doit('ses envies', m.envies)
      doit('son chemin', m.chemin)
      if (hauteur >= (etat === 'veteran' ? UN_VETERAN_TIENT_DES : TOUT_TIENT_DES)) doit('« Tes compagnons »', m.amis)
      else if (etat !== 'veteran') doit('le titre de « Tes compagnons »', m.titreDesAmis)
      else if (hauteur >= TOUT_TIENT_DES && (sous(m.amis) ?? Infinity) > CADRE_D_UN_VETERAN) manques.push(`« Tes compagnons » d’un vétéran : ${sous(m.amis)} px sous le menu, plus que son cadre (${CADRE_D_UN_VETERAN} px)`)
      if (m.gestesCoupes) manques.push('une pastille de ses gestes sort de sa scène')
      // Sa scène se rogne par le bas : jamais jusqu'à poser la pastille de ses gestes sur sa plaque, ni en laissant son jardin défiler de haut en bas.
      if (m.sousLaPlaque !== null && m.sousLaPlaque < 6) manques.push(`la pastille de ses gestes à ${m.sousLaPlaque} px de sa plaque`)
      if (m.jardinDeHautEnBas > 0) manques.push(`son jardin défile de ${m.jardinDeHautEnBas} px de haut en bas dans sa scène`)
      // La ligne de son cadeau montre des morceaux entiers : son essentiel, lui, ne se coupe jamais au bout.
      if (m.cadeau?.coupe) manques.push(`l’essentiel de la ligne de son cadeau est coupé au bout (« ${m.cadeau.montre} »)`)
    }
    // Sous l'encoche, la page tient à trois pixels près : elle ne s'exige que là où elle a de la marge.
    if (m.defile > 0 && (etat === 'sans' || (hauteur >= NE_DEFILE_PLUS_DES && !encoche))) manques.push(`la page défile de ${m.defile} px`)
    if (m.large || m.deborde.length) manques.push('la page déborde en largeur')
    if (basses.length) manques.push('une cible de doigt sous 44 px')
    if (m.petit && m.petit.taille < 11) manques.push('un texte sous 11 px')
    if (dessous.length) manques.push('quelque chose passe sous la niche')
  }
  // Ce qui passe sous le menu doit pouvoir remonter : la page défile au moins d'autant — à toute taille, sous le
  // bandeau et le texte agrandi aussi. Le ressort des marges (le bloc « La marge du bout se resserre », `styles.css`)
  // reprenait 24 px à cette page, qui n'en a plus sur un téléphone : le cadre de « Tes compagnons » d'un vétéran
  // passait de 5 px sous le menu en 360 × 740, et la page ne défilait plus du tout (mesuré le 10 novembre 2026, avant
  // que sa marge ne se dise au ressort : `--chez-bas`).
  const dessousDuMenu = Math.max(0, ...[m.scene, m.envies, m.chemin, m.amis, m.sans].map(b => sous(b) ?? 0))
  if (dessousDuMenu > m.defile) manques.push(`${dessousDuMenu} px passent sous le menu, et la page ne défile que de ${m.defile}`)
  if (manques.length) rate++
  const blocs = etat === 'sans' ? [dit('ceux à adopter', m.sans)] : [dit('la scène', m.scene), dit('ses envies', m.envies), dit('son chemin', m.chemin), dit('ses compagnons', m.amis)]
  console.log(`${n} — pli à ${m.pli} px · ${blocs.filter(Boolean).join(' · ')} · défile de ${m.defile} px${m.bandeau ? ` · bandeau ${m.bandeau} px` : ''}${manques.length ? ` — DEVAIT TENIR : ${manques.join(' ; ')}` : ''}`)
  if (titreBouge) console.log(`   SON TITRE A BOUGÉ pendant le chargement : ${(m.titre as number[]).join(' → ')} px`)
  if (m.scene) {
    console.log(
      `   la scène de ${m.scene.haut} à ${m.scene.bas} px (${m.scene.bas - m.scene.haut} de haut, à l’échelle ${String(Math.round(m.k * 1000) / 1000).replace('.', ',')}) · sa niche large de ${m.largeurDeLaNiche} px, à ${m.nicheSousLeBord} px du bord · sa pastille à ${m.sousLaPlaque} px sous sa plaque${m.titreDesAmis ? ` · le titre de « Tes compagnons » ${sous(m.titreDesAmis)! <= 0 ? 'au-dessus du menu' : 'sous le menu'}` : ''}`,
    )
  }
  if (m.cadeau) console.log(`   la ligne de son cadeau dit « ${m.cadeau.montre} »${m.cadeau.coupe ? ' — COUPÉ AU BOUT' : ''}, sous un titre haut de ${m.cadeau.titre} px`)
  if (m.large || m.deborde.length) console.log(`   DÉBORDE EN LARGEUR — ${m.deborde.join(' · ')}`)
  if (m.gestesCoupes) console.log('   UNE PASTILLE DE SES GESTES SORT DE SA SCÈNE')
  if (basses.length) console.log(`   CIBLES SOUS 44 PX : ${[...new Set(basses.map(c => `${c.nom} « ${c.dit} » ${c.l} × ${c.h}`))].join(' ; ')}`)
  if (m.petit && m.petit.taille < 11) console.log(`   UN TEXTE SOUS 11 PX : « ${m.petit.texte} » (${m.petit.taille} px)`)
  if (dessous.length) console.log(`   SOUS LA NICHE — ${dessous.join(' · ')}`)
}

try {
  if (retenu('lea')) await lea()
  if (retenu('max')) await max()
  if (retenu('zoe')) await zoe()
  if (retenu('tailles')) await tailles()
  if (Object.keys(mesures).length) writeFileSync(path.join(sortie, 'mesures.json'), JSON.stringify(mesures, null, 2))
  console.log(`\n${rapport.filter(l => !l.endsWith('rien ne déborde')).length} photo(s) où quelque chose déborde, sur ${rapport.length} — dans ${sortie}`)
  // Par le code de sortie de Node, pas `process.exit()` : ce qui vient de s'écrire part d'abord (règle `tests.md`).
  if (rate > 0) process.exitCode = 1
} finally {
  await navigateur.close()
  await banc.close()
}
