// La niche du compagnon, photographiée sur chaque page du téléphone où elle
// vit (`client/src/components/Niche.tsx`) : l'accueil, le profil, la loge,
// la collection, la boutique et ses compagnons, le quiz du jour — sa page, une
// question, une révélation —, la campagne et ses onglets, les duels — la
// carte du verdict d'un duel au dé, un duel classé face cachée, « Duel
// envoyé » —, l'expédition, le salon, et une soirée — la salle d'attente, une
// question, la révélation, le podium. Puis sa fiche, une caresse, et le repli
// quand la page défile. À chaque page, ce qui passe sous la niche se dit : un
// texte, un bouton, une image que la page ne lui a pas laissé (« sous la
// niche »).
// Et ses réactions, dans la soirée (`shared/niche.ts`) : le souffle retenu
// quand elle touche une réponse, la bonne réponse qui le nourrit (« +1 », sa
// jauge), la ratée (il pleut chez lui), la rare (une bulle de cœurs), puis
// la sortie au podium et une caresse dehors. Et « Ma niche », sa gestion : un
// nom qu'on lui donne, une forme d'avant qu'on y montre, un autre de ses
// compagnons qu'on y installe d'un toucher.
// Léa, niveau 14, son loup adulte dans sa niche — 350 bonnes réponses avec
// lui, sa jauge aux trois quarts — et sa jeune tortue qui attend. Avec
// `PALIERS=n` (1 à 4), son loup a passé sa forme ultime et sa niche tant de
// paliers, ses ornements dessus (`shared/ornements.ts`). Et l'écran « Mon
// compagnon » du profil, et sa carte, où son compagnon se montre avec son
// nom. Le client construit d'abord (`npm run build -w client`).
//
//   npx tsx scripts/rendu-niche.ts [dossier]        (ECRAN=390x844, ENCOCHE=47, THEME=ivoire, PALIERS=2, SEULEMENT=solo)
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import {
  ADMIN,
  attendre,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  ecrire,
  inscrireProfil,
  invite,
  lancerQuiz,
  patienter,
  qcm,
  type Invite,
} from '../test/banc'
import { VERSION_BAREME } from '../src/auth/profiles'
import { xpDuNiveau } from '../../shared/profil'
import { PALIERS_DE_LA_NICHE } from '../../shared/ornements'

const sortie = path.resolve(process.argv[2] ?? 'rendu-niche')
mkdirSync(sortie, { recursive: true })
const [largeur, hauteur] = (process.env.ECRAN ?? '360x640').split('x').map(Number)
const theme = process.env.THEME ?? null
// L'encoche d'un iPhone, en pixels : Chromium sans écran la tient à zéro, et
// la niche descend avec elle (`env(safe-area-inset-top)`) — chaque page aussi,
// pas toujours d'autant.
const encoche = Number(process.env.ENCOCHE ?? 0)
/** Les paliers de sa niche, après sa forme ultime : 0, son loup adulte d'avant. */
const paliers = Math.max(0, Math.min(PALIERS_DE_LA_NICHE.length, Number(process.env.PALIERS ?? 0)))

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'rendu.js'))('playwright')
}
const { chromium } = chargerPlaywright()

/**
 * Ce qui passe sous la niche, page en haut : chaque ligne de texte (ses
 * boîtes de ligne, pas son bloc entier), chaque bouton, lien, champ ou image
 * dont la boîte la touche. En texte : `tsx` glisserait des `__name` dans une
 * fonction passée à la page.
 */
const SOUS_LA_NICHE = `(() => {
  const niche = document.querySelector('.niche')
  if (!niche) return ['(pas de niche)']
  // Repliée et effacée — la page a défilé sous une tête collée — : rien ne passe dessous.
  if (Number(getComputedStyle(niche).opacity) === 0) return []
  const n = niche.getBoundingClientRect()
  const touche = r => r.width > 0 && r.height > 0 && r.right > n.left + 1 && r.left < n.right - 1 && r.bottom > n.top + 1 && r.top < n.bottom - 1
  const visible = el => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const s = getComputedStyle(e)
      if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) return false
    }
    return true
  }
  const nom = el => {
    const classe = (el.getAttribute('class') || '').split(/\\s+/).filter(Boolean).slice(0, 2).join('.')
    return el.tagName.toLowerCase() + (classe ? '.' + classe : '')
  }
  const vus = []
  const marcheur = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let t = marcheur.nextNode(); t; t = marcheur.nextNode()) {
    const el = t.parentElement
    if (!el || !t.textContent.trim() || el.closest('.niche, .sr-only, script, style') || !visible(el)) continue
    const plage = document.createRange()
    plage.selectNodeContents(t)
    if ([...plage.getClientRects()].some(touche)) vus.push('texte « ' + t.textContent.trim().slice(0, 40) + ' » (' + nom(el) + ')')
  }
  for (const el of document.querySelectorAll('a, button, input, select, textarea, img, svg, [role=button]')) {
    if (el.closest('.niche') || !visible(el)) continue
    if (el.tagName === 'svg' && el.closest('a, button')) continue
    const r = el.getBoundingClientRect()
    // Une grande illustration (le cadran des duels) touche par sa boîte, pas par son dessin.
    if (el.tagName === 'svg' && r.width > 120 && r.height > 120) continue
    if (touche(r)) vus.push(nom(el))
  }
  return [...new Set(vus)]
})()`

const banc = await demarrer()
const navigateur = await chromium.launch({ headless: true })
let rapport: string[] = []

/** Léa, niveau 14, son loup adulte dans sa niche, le Phénix en avatar. */
async function lea(login: string): Promise<string> {
  const cookie = await inscrireProfil(banc.url, login, 'Léa', '🐸')
  const id = ((await (await fetch(`${banc.url}/api/joueur/moi?leger`, { headers: { Cookie: cookie } })).json()) as any).profile.id
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  db.prepare(`INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at) VALUES (?, '#rattrapage', '', ?, ?, 1)`).run(
    id,
    xpDuNiveau(14),
    JSON.stringify({ v: VERSION_BAREME }),
  )
  db.prepare('UPDATE profiles SET xp = ?, niche = ? WHERE id = ?').run(xpDuNiveau(14), 'loup', id)
  const compagnon = db.prepare('INSERT INTO profile_compagnons (profile_id, compagnon, prix, rang, created_at) VALUES (?, ?, 1000, ?, 1)')
  compagnon.run(id, 'loup', paliers > 0 ? 3 : 2)
  compagnon.run(id, 'tortue', 1)
  if (paliers > 0) {
    db.prepare(`UPDATE profile_compagnons SET paliers = ? WHERE profile_id = ? AND compagnon = 'loup'`).run(paliers, id)
    // Ses bonnes réponses avec lui, d'une série de campagne d'avant : ce palier
    // passé de 600, la jauge du suivant en route — les 350 du quiz du jour comptent aussi.
    const n = PALIERS_DE_LA_NICHE[paliers - 1] + 600 - 350
    db.prepare(`INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le) VALUES ('rendu-paliers', ?, '[]', ?, 3, ?, 1, 2)`).run(id, n, n)
    const reponse = db.prepare(`INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le, compagnon) VALUES ('rendu-paliers', ?, ?, 0, 1, 2, 'loup')`)
    db.transaction(() => {
      for (let i = 0; i < n; i++) reponse.run(i, `rendu-paliers-${i}`)
    })()
  }
  // De quoi les avoir payés, et adopter le chat : une partie du quiz du jour d'avant, ses bonnes réponses en confettis.
  db.prepare(`INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp) VALUES (?, '2026-09-20', 1, 10, NULL, 0, 3200, 1, 0)`).run(id)
  // Et 350 bonnes réponses données avec lui, aux quiz du jour de juillet — leurs
  // tirages avec, que le compte des bonnes réponses lit : sa jauge vers sa forme ultime en part.
  const questions = Array.from({ length: 10 }, (_, i) => ({ reserveId: `rendu-niche-${i}`, texte: `Question ${i + 1}`, reponses: ['A', 'B', 'C', 'D'], bonne: 0, categorie: null, duree: 20, lectureMs: 3000, anecdote: null }))
  const tirage = db.prepare(`INSERT OR IGNORE INTO jour_tirages (jour, questions, annulees, tire_le) VALUES (?, ?, '[]', 1)`)
  const juste = db.prepare(`INSERT INTO jour_reponses (profile_id, jour, question, choix, ms, juste, points, repondue_le, compagnon) VALUES (?, ?, ?, 0, 1000, 1, 100, 1, 'loup')`)
  for (let j = 0; j < 35; j++) {
    const jour = new Date(Date.UTC(2026, 6, 1 + j)).toISOString().slice(0, 10)
    tirage.run(jour, JSON.stringify(questions))
    for (let q = 0; q < 10; q++) juste.run(id, jour, q)
  }
  db.close()
  await banc.redemarrer()
  if (theme) await ecrire(banc.url, '/api/joueur/moi', { theme }, cookie, 'PUT')
  return cookie
}

async function contexte(cookie: string) {
  const ctx = await navigateur.newContext({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const [nom, valeur] = cookie.split('=')
  await ctx.addCookies([{ name: nom, value: valeur, url: banc.url }])
  return ctx
}

/** Une page du téléphone, son encoche posée avant qu'elle n'ouvre rien — et la barre d'accueil des iPhone qui en ont une, 34 pixels en bas. */
async function nouvellePage(ctx: any) {
  const page = await ctx.newPage()
  if (encoche) {
    const cdp = await ctx.newCDPSession(page)
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: encoche, topMax: encoche, bottom: 34, bottomMax: 34, left: 0, leftMax: 0, right: 0, rightMax: 0 } })
  }
  return page
}

/** La photo d'une page, en haut, sa niche arrivée — et ce qui passe dessous. */
async function photo(page: any, nom: string, { pleine = false, attente = 600 } = {}) {
  await page.waitForSelector('.niche .niche-bete img', { timeout: 8000 }).catch(() => {})
  await page.evaluate('Promise.all([...document.images].map(i => i.decode().catch(() => {})))')
  await page.waitForTimeout(attente)
  const fichier = path.join(sortie, `${nom}.png`)
  await page.screenshot({ path: fichier, fullPage: pleine })
  const dessous: string[] = await page.evaluate(SOUS_LA_NICHE)
  const ligne = `${nom} : ${dessous.length === 0 ? 'rien sous la niche' : 'sous la niche — ' + dessous.join(' · ')}`
  rapport.push(ligne)
  console.log(ligne)
}

/** Le tirage du jour : la bonne réponse de chaque question. */
function tirageDuJour() {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true })
  const r = db.prepare('SELECT questions FROM jour_tirages ORDER BY jour DESC LIMIT 1').get() as { questions: string }
  db.close()
  return JSON.parse(r.questions) as { reponses: string[]; bonne: number }[]
}

/** Une partie de la campagne jouée jusqu'à sa fin, la première réponse touchée à chaque question : trois fautes la finissent vite. */
async function jusquAuBout(page: any) {
  for (;;) {
    await page.locator('.ans-btn').first().click()
    const suite = page.getByRole('button', { name: /Question suivante|Voir qui a gagné|Voir mon duel/ })
    await suite.waitFor()
    const derniere = !(await suite.textContent())?.includes('Question suivante')
    await suite.click()
    if (derniere) return
  }
}

async function solo() {
  const cookie = await lea('lea')
  const ctx = await contexte(cookie)
  const page = await nouvellePage(ctx)
  page.on('pageerror', (e: Error) => console.error('[page]', e.message))
  const aller = async (adresse: string, attendu: string) => {
    await page.goto('about:blank')
    await page.goto(`${banc.url}${adresse}`)
    await page.waitForSelector(attendu, { timeout: 15000 })
    await patienter(900)
  }
  await aller('/', 'button.identite-ligne')
  await photo(page, '01-accueil')
  // « Ma niche », au toucher de la niche : une caresse, un nom, une forme
  // d'avant, la tortue installée d'un toucher, puis le loup qui revient.
  const fiche = (nom: string) => page.screenshot({ path: path.join(sortie, `${nom}.png`) })
  await page.locator('.niche').click()
  await page.waitForSelector('.niche-fiche [aria-labelledby="niche-compagnons"] .niche-choix[aria-pressed="true"]')
  await patienter(700)
  await fiche('02-fiche')
  await page.locator('.niche-fiche-gestes .btn-primary').click()
  await patienter(420)
  await fiche('03-fiche-caresse')
  await page.locator('.niche-renommer').click()
  await page.locator('#niche-nom').fill('Nox')
  await patienter(300)
  await fiche('03b-fiche-nommer')
  await page.locator('.niche-nommer .btn-primary').click()
  await page.waitForSelector('.niche-fiche-nom >> text=Nox')
  await patienter(500)
  await fiche('03c-fiche-nommee')
  await page.locator('.niche-choix[aria-label="Le louveteau"]').click()
  await page.waitForSelector('.niche-choix[aria-label="Le louveteau"][aria-pressed="true"]')
  await patienter(800)
  await fiche('03d-fiche-louveteau')
  await page.evaluate(`document.querySelector('.niche-fiche .carte-corps').scrollTo(0, 99999)`)
  await patienter(500)
  await fiche('03e-fiche-compagnons')
  await page.locator('.niche-choix[aria-label^="La Tortue-île"]').click()
  await page.waitForSelector('.niche-choix[aria-label="La Tortue-île"][aria-pressed="true"]')
  await page.evaluate(`document.querySelector('.niche-fiche .carte-corps').scrollTo(0, 0)`)
  await patienter(800)
  await fiche('03f-fiche-tortue')
  await page.locator('.niche-choix[aria-label^="Nox"]').click()
  await page.waitForSelector('.niche-choix[aria-label="Nox"][aria-pressed="true"]')
  // Sa plus haute forme reprend sa niche : l'adulte, ou, ses paliers passés, le loup des étoiles.
  const plusHaute = paliers > 0 ? 'Le loup des étoiles' : 'Le loup adulte'
  await page.locator(`.niche-choix[aria-label="${plusHaute}"]`).click()
  await page.waitForSelector(`.niche-choix[aria-label="${plusHaute}"][aria-pressed="true"]`)
  await page.locator('.niche-fiche .carte-fermer').click()

  await aller('/profil', '.profil-boutons .gros-compte')
  await page.waitForSelector('.profil-boutons .gros-icone .niche-mini', { timeout: 8000 }).catch(() => console.error('[profil] pas de niche sur « Mon compagnon »'))
  await photo(page, '04-profil')
  // « Mon compagnon », son écran : sa gestion sans la feuille.
  await page.getByRole('button', { name: /Mon compagnon/ }).click()
  await page.waitForSelector('.niche-gestion [aria-labelledby="niche-compagnons"] .niche-choix[aria-pressed="true"]')
  await photo(page, '04b-mon-compagnon', { attente: 900 })
  await page.screenshot({ path: path.join(sortie, '04c-mon-compagnon-entier.png'), fullPage: true })
  // Sa carte, comme la salle l'ouvre : son compagnon dans sa niche, avec son nom.
  await aller('/profil', '.profil-boutons .gros-compte')
  await page.locator('button.identite-ligne').click()
  await page.waitForSelector('.carte-joueur .carte-compagnon .niche-bete img', { timeout: 10000 }).catch(() => console.error('[carte] pas de compagnon'))
  await patienter(800)
  await page.screenshot({ path: path.join(sortie, '04d-sa-carte.png') })
  await page.keyboard.press('Escape')
  await aller('/profil#avatar', '.loge-panneau .loge-page-avatars')
  await photo(page, '05-loge')
  // La carte de la loge, collée en haut quand la page défile : la niche repliée à son coin.
  await page.mouse.wheel(0, 360)
  await patienter(700)
  await page.screenshot({ path: path.join(sortie, '05b-loge-defilee.png') })
  await aller('/profil#collection', '.collection')
  await photo(page, '06-collection')
  await aller('/profil#soirees', '.player-shell')
  await photo(page, '07-soirees')
  await aller('/profil#carriere', '.player-shell')
  await photo(page, '08-carriere')
  await aller('/boutique', '.boutique-tete')
  await photo(page, '09-boutique')
  await aller('/boutique#compagnons', '.vitrine-compagnons')
  await photo(page, '10-boutique-compagnons')
  // Adopter le chat, le loup dans sa niche : l'y installer, ou l'adopter seulement — jamais le porter.
  await aller('/boutique#compagnon-chat', '.vitrine-compagnons')
  await page.locator('.compagnon-carte:nth-child(2) .compagnon-achat .btn-primary').click()
  await page.waitForSelector('.dialog-backdrop')
  await patienter(500)
  await page.screenshot({ path: path.join(sortie, '10b-boutique-adopter.png') })
  await page.keyboard.press('Escape')
  await aller('/boutique#compagnons', '.vitrine-compagnons')
  // Le repli : la page défile, la niche se fait petite au coin.
  await page.mouse.wheel(0, 420)
  await patienter(700)
  await page.screenshot({ path: path.join(sortie, '11-repli.png') })

  await aller('/jour', '.jour-heros')
  await photo(page, '12-jour')
  await page.locator('.jour-heros .btn-primary').click()
  await page.waitForSelector('.ans-btn')
  await photo(page, '13-jour-question')
  const tirage = tirageDuJour()
  const textes: string[] = await page.locator('.ans-btn').allTextContents()
  const bonne = Math.max(0, textes.findIndex(t => t.includes(tirage[0].reponses[tirage[0].bonne])))
  for (let essai = 0; essai < 24 && !(await page.locator('.result-banner').count()); essai++) {
    await page.locator('.ans-btn').nth(bonne).click({ timeout: 1500 }).catch(() => {})
    await patienter(350)
  }
  await page.waitForSelector('.result-banner')
  await photo(page, '14-jour-revelation', { attente: 1200 })

  await aller('/campagne', '.campagne')
  await photo(page, '15-campagne', { attente: 1200 })
  // Une série : sa première question, sous la niche.
  await page.locator('.campagne .btn-primary.btn-big').first().click()
  await page.waitForSelector('.ans-btn', { timeout: 15000 })
  await photo(page, '15b-serie-question', { attente: 900 })
  await aller('/campagne#sentiers', '.campagne')
  await photo(page, '16-sentiers', { attente: 1500 })
  // Un sentier : il descend de lui-même jusqu'au palier à jouer, sa tête collée en haut — la niche repliée s'efface ; revenu en haut, elle reparaît.
  await aller('/campagne#sentier-foret', '.sentier-tete')
  await patienter(1200)
  await page.screenshot({ path: path.join(sortie, '16b-sentier-defile.png') })
  await page.evaluate('window.scrollTo(0, 0)')
  await photo(page, '16c-sentier-en-haut', { attente: 700 })
  await aller('/campagne#defi', '.campagne')
  await photo(page, '17-defi', { attente: 1200 })
  await aller('/campagne#carnet', '.campagne')
  await photo(page, '18-carnet', { attente: 1200 })
  await aller('/duels', '.duels')
  await photo(page, '19-duels', { attente: 1500 })
  // Un duel au dé joué jusqu'au bout : la carte du verdict, et sa croix qui ramène aux duels.
  await page.getByRole('button', { name: 'Un duel contre Automate' }).click()
  await page.locator('.feuille-du-de').getByRole('button', { name: 'Jouer le duel' }).click()
  await jusquAuBout(page)
  await page.waitForSelector('.duels-carte3d.ouverte')
  await photo(page, '19b-duel-verdict', { attente: 1100 })
  // Un duel classé lancé contre Tom : sa page, ses deux cartes, puis « Duel envoyé » à sa dernière réponse.
  const cookieDeTom = await inscrireProfil(banc.url, 'tom', 'Tom', '🐻')
  const tom = ((await (await fetch(`${banc.url}/api/joueur/moi?leger`, { headers: { Cookie: cookieDeTom } })).json()) as any).profile.id
  const { code } = (await (await ecrire(banc.url, '/api/campagne/duel', { adversaire: tom }, cookie)).json()) as { code: string }
  await aller(`/duels#duel-${code}`, '.duels-cartes')
  await photo(page, '19c-duel-cartes')
  await page.getByRole('button', { name: 'Reprendre le duel' }).click()
  await jusquAuBout(page)
  await page.waitForSelector('.duels-envoye')
  await photo(page, '19d-duel-envoye')
  await aller('/expedition', '.expedition')
  await photo(page, '20-expedition', { attente: 1200 })
  await aller('/salon', '.player-shell')
  await photo(page, '21-salon', { attente: 1500 })
  await ctx.close()
}

async function soiree() {
  const url = banc.url
  const cookie = await connexionAnimateur(url)
  // Trois questions : Léa trouve la première, rate la deuxième, et trouve la troisième, que ses amis ratent tous — la rare.
  const QUESTIONS = [
    { texte: 'Quelle planète surnomme-t-on la planète rouge ?', reponses: ['Vénus', 'Mars', 'Jupiter', 'Saturne'], bonne: 1 },
    { texte: 'Combien de cordes compte un violon ?', reponses: ['Trois', 'Quatre', 'Cinq', 'Six'], bonne: 1 },
    { texte: 'Quel est l’animal national de l’Écosse ?', reponses: ['Le cerf', 'L’aigle royal', 'La licorne', 'Le lion'], bonne: 2 },
  ]
  const packId = await creerQuiz(url, cookie, QUESTIONS.map(q => qcm(q.texte, q.reponses, q.bonne, 30)), 'Culture générale')
  const cookieLea = await lea('lea2')
  const host = await ecranCommun(url, cookie)
  const amis: Invite[] = []
  // Juste (1) ou non (0), question par question.
  const PLANS = [
    [1, 1, 0],
    [0, 0, 0],
    [0, 1, 0],
  ]
  for (const [nom, avatar] of [
    ['Tom', '🐼'],
    ['Julie', '🦊'],
    ['Karim', '🐙'],
  ] as const)
    amis.push(await invite(url, nom, avatar))
  amis.forEach((inv, i) =>
    inv.socket.on('session:view', ({ sessionId, view }: any) => {
      if (view.phase !== 'question' || view.myAnswer != null || view.answered) return
      const q = QUESTIONS[view.qIndex]
      const choix = PLANS[i][view.qIndex] ? q.bonne : (q.bonne + 1 + i) % 4
      setTimeout(() => (inv.socket as any).emit('player:action', { sessionId, action: { type: 'answer', choice: choix } }, () => {}), 2600 + i * 250)
    }),
  )
  const moi = await invite(url, 'Léa', '🐸', { cookie: cookieLea })
  moi.socket.close()
  const ctx = await contexte(cookieLea)
  await ctx.addInitScript(([cle, me]: string[]) => localStorage.setItem(cle, me), [`quizz.me.${ADMIN.slug}`, JSON.stringify({ playerId: moi.playerId, token: moi.token })])
  const telephone = await nouvellePage(ctx)
  telephone.on('pageerror', (e: Error) => console.error('[téléphone]', e.message))
  await telephone.goto(`${url}/${ADMIN.slug}`)
  await telephone.waitForSelector('.me-header')
  await patienter(1200)
  await photo(telephone, '22-soiree-attente')

  let vue: any = null
  host.on('session:view', (p: any) => (vue = p))
  const phase = (ph: string, q?: number) =>
    vue?.view.phase === ph && (q === undefined || vue.view.qIndex === q)
      ? Promise.resolve(vue)
      : attendre<any>(host, 'session:view', p => p.view.phase === ph && (q === undefined || p.view.qIndex === q), `${ph} ${q ?? ''}`, 30000)
  const suivant = () => {
    const { phase: ph, qIndex, round } = vue.view
    ;(host as any).emit('host:command', { sessionId: vue.sessionId, command: { type: 'next', phase: ph, qIndex, round } })
  }
  await lancerQuiz(host, packId)
  const LEA = [/Mars/, /Trois/, /licorne/]
  const REVELATIONS = ['24-soiree-revelation', '24b-soiree-ratee', '24c-soiree-rare']
  // Le temps du repas — « +1 » et sa jauge —, puis, pour la rare, sa bulle de cœurs, qui attend que « +1 » s'efface.
  const ATTENTES = [1300, 1300, 2600]
  for (let q = 0; q < QUESTIONS.length; q++) {
    await phase('question', q)
    await telephone.waitForSelector('.ans-btn')
    if (q === 0) await photo(telephone, '23-soiree-question')
    await telephone.getByRole('button', { name: LEA[q] }).first().click({ timeout: 4000 }).catch(() => {})
    // Elle a touché sa réponse : il retient son souffle, penché vers la page, son ciel assombri.
    if (q === 0) await photo(telephone, '23b-soiree-souffle', { attente: 700 })
    // Toute la salle répond, puis la révélation vient d'elle-même ; sinon, l'animateur la donne.
    await patienter(q === 0 ? 3200 : 3900)
    if (vue?.view.phase === 'question' && vue.view.qIndex === q) suivant()
    await phase('reveal', q)
    await telephone.waitForSelector('.result-banner')
    await photo(telephone, REVELATIONS[q], { attente: ATTENTES[q] })
    if (vue?.view.phase === 'reveal' && vue.view.qIndex === q) suivant()
  }
  await phase('finished')
  await telephone.waitForSelector('.fin-quiz-ligne')
  await photo(telephone, '25-soiree-podium', { attente: 1000 })
  // Sur le podium, après l'expérience : il sort de sa niche et se pose en bas, près du pouce.
  await telephone.waitForSelector('.niche-dehors.pose', { timeout: 15000 }).catch(() => console.error('[soirée] pas de sortie au podium'))
  await patienter(500)
  await telephone.screenshot({ path: path.join(sortie, '25b-soiree-sortie.png') })
  await telephone.locator('.niche-dehors').click({ timeout: 3000 }).catch(() => {})
  await patienter(450)
  await telephone.screenshot({ path: path.join(sortie, '25c-soiree-caresse.png') })
  // Puis il rentre chez lui.
  await telephone.waitForSelector('.niche-dehors', { state: 'detached', timeout: 15000 }).catch(() => console.error('[soirée] il n’est pas rentré'))
  await photo(telephone, '25d-soiree-rentre', { attente: 400 })
  host.close()
  await ctx.close()
}

try {
  if (process.env.SEULEMENT !== 'soiree') await solo()
  if (process.env.SEULEMENT !== 'solo') await soiree()
} finally {
  await navigateur.close()
  await banc.close()
}
console.log(`\n${rapport.filter(l => !l.endsWith('rien sous la niche')).length} page(s) où quelque chose passe sous la niche, sur ${rapport.length}.`)
process.exit(0)
